import {
  EmptyNodeComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import * as THREE from 'three';
import { ObservableHint } from '@legendapp/state';
import { unbox, box, type Box } from './types';

// ---------------------------------------------------------------------------
// Shaders (GLSL 3.0)
// ---------------------------------------------------------------------------

const VERTEX_SHADER = `
precision highp float;

// Custom Uniforms
uniform sampler2D tDepth;
uniform float uFovRadians;
uniform float uAspect;
uniform float uNearMeters;
uniform float uFarMeters;
uniform float uDepthPower;
uniform float uPerspectiveMix; // 0.0 = Ortho, 1.0 = Persp
uniform int uDepthMode;        // 0 = Inverse (1/d), 1 = Linear

// Varyings
out vec2 vUv;
out float vDepthMeters;

void main() {
  vUv = uv; 

  // 1. Sample Depth
  float dRaw = texture(tDepth, uv).r;
  float dCurve = pow(dRaw, uDepthPower);
  float zMeters = 0.0;

  // 2. Map Depth
  if (uDepthMode == 1) {
     // Linear Mapping (Common for "Displacement")
     // White (1.0) = Near, Black (0.0) = Far
     zMeters = mix(uFarMeters, uNearMeters, dCurve);
  } else {
     // Inverse/Reciprocal Mapping (Physically correct for Camera Z)
     float minDisp = 1.0 / uFarMeters;
     float maxDisp = 1.0 / uNearMeters;
     float currentDisp = mix(minDisp, maxDisp, dCurve);
     zMeters = 1.0 / currentDisp;
  }

  // Clamp Skybox
  if (dRaw < 0.001) zMeters = uFarMeters;

  vDepthMeters = zMeters;

  // 3. Calculate Frustum Slice Dimensions
  // Perspective Width at depth Z
  float viewHeightAtZ = 2.0 * zMeters * tan(uFovRadians * 0.5);
  float viewWidthAtZ  = viewHeightAtZ * uAspect;

  // Orthographic Width (Reference at Near Plane or 1.0m)
  // We use the Near Plane size as the "Ortho" reference size
  float viewHeightOrtho = 2.0 * uNearMeters * tan(uFovRadians * 0.5);
  float viewWidthOrtho  = viewHeightOrtho * uAspect;

  // 4. Mix Perspective Width
  // If Mix is 0.0, we use the same width for all Z (Straight Extrusion)
  // If Mix is 1.0, we use the expanding width (Cone)
  float effectiveWidth  = mix(viewWidthOrtho, viewWidthAtZ, uPerspectiveMix);
  float effectiveHeight = mix(viewHeightOrtho, viewHeightAtZ, uPerspectiveMix);

  // Position (-0.5 to 0.5) -> Local Space
  // We need to scale position based on the Z-plane we are effectively "at"
  // For Ortho (Mix=0), we are geometrically projecting parallel, 
  // but to keep the image covering the screen, we scale by the Z ratio if we want it to look right?
  // Actually, standard displacement just keeps X/Y constant relative to UV.
  // UV 0..1 maps to -0.5..0.5.
  
  // To keep alignment with the camera image at the origin:
  // At the origin, Ray(u,v) hits (x,y,z).
  // x = z * tan(angle).
  // If we reduce x (Ortho), the pixel moves INWARD.
  // This means from the origin, the image will look "pinched" if uPerspectiveMix < 1.0.
  // BUT, from the side, it looks like a clean extrusion.
  
  float xLocal = position.x * effectiveWidth;
  float yLocal = position.y * effectiveHeight;

  // Local Position
  vec4 localPos = vec4(xLocal, yLocal, -zMeters, 1.0);

  // Transform
  gl_Position = projectionMatrix * modelViewMatrix * localPos;
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tColor;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 color = texture(tColor, vUv);
  fragColor = color;
}`;

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const threeMeshDepthProjectionPlane: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threeMeshDepthProjectionPlane`),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`texture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`depthTexture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`fov`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`near`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`far`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`depthPower`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: `perspectiveMix`,
      type: WorkflowBrandedTypes.valueType(`number`),
      // 0.0 = Cylindrical/Ortho, 1.0 = Conical/Perspective
    },
    {
      name: `depthMode`,
      type: WorkflowBrandedTypes.valueType(`string`),
      // 'inverse' | 'linear'
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`mesh`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Mesh>`),
    },
  ],
  execute: async ({ inputs, runtimeState }) => {
    const texture = unbox(inputs.texture as Box<THREE.Texture<HTMLImageElement>>);
    const depthTexture = unbox(inputs.depthTexture as Box<THREE.Texture<HTMLImageElement>>);

    const fov = (inputs.fov as number) ?? 45;
    const near = (inputs.near as number) ?? 0.5;
    const far = (inputs.far as number) ?? 100.0;
    const depthPower = (inputs.depthPower as number) ?? 1.0;
    const perspectiveMix = (inputs.perspectiveMix as number) ?? 1.0; // Default to correct physics
    const depthModeStr = (inputs.depthMode as string) ?? 'inverse';

    // Map string to int for shader
    const depthModeInt = depthModeStr === 'linear' ? 1 : 0;

    if (!texture || !depthTexture) return;

    const rs = runtimeState as {
      texture?: THREE.Texture;
      depthTexture?: THREE.Texture;
      mesh?: THREE.Mesh;
      material?: THREE.ShaderMaterial;
      dispose?: () => void;
      cachedParams?: Record<string, any>;
    };

    const hasTextureChanged = texture !== rs.texture || depthTexture !== rs.depthTexture;

    // Helper to check params
    const currentParams = { fov, near, far, depthPower, perspectiveMix, depthModeInt };
    const paramsChanged = JSON.stringify(currentParams) !== JSON.stringify(rs.cachedParams);

    if (rs.mesh && rs.material && !hasTextureChanged) {
      if (paramsChanged) {
        const uniforms = rs.material.uniforms as unknown as {
          uFovRadians: { value: number };
          uNearMeters: { value: number };
          uFarMeters: { value: number };
          uDepthPower: { value: number };
          uPerspectiveMix: { value: number };
          uDepthMode: { value: number };
          uAspect: { value: number };
        };

        uniforms.uFovRadians.value = fov * (Math.PI / 180);
        uniforms.uNearMeters.value = near;
        uniforms.uFarMeters.value = far;
        uniforms.uDepthPower.value = depthPower;
        uniforms.uPerspectiveMix.value = perspectiveMix;
        uniforms.uDepthMode.value = depthModeInt;

        if (texture.image) {
          const aspect = texture.image.width / texture.image.height;
          uniforms.uAspect.value = aspect;
        }
        rs.cachedParams = currentParams;
      }
      return { outputs: { mesh: ObservableHint.opaque(box(rs.mesh)) } };
    }

    rs.dispose?.();
    rs.texture = texture;
    rs.depthTexture = depthTexture;
    rs.cachedParams = currentParams;

    function getDims(tex: THREE.Texture) {
      const img = tex.image as undefined | HTMLImageElement;
      if (img && 'width' in img && 'height' in img) return { w: img.width, h: img.height };
      return undefined;
    }
    const dims = getDims(depthTexture) ?? getDims(texture) ?? { w: 512, h: 512 };
    const aspect = dims.w / dims.h;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        tColor: { value: texture },
        tDepth: { value: depthTexture },
        uFovRadians: { value: fov * (Math.PI / 180) },
        uAspect: { value: aspect },
        uNearMeters: { value: near },
        uFarMeters: { value: far },
        uDepthPower: { value: depthPower },
        uPerspectiveMix: { value: perspectiveMix },
        uDepthMode: { value: depthModeInt },
      },
      side: THREE.DoubleSide,
      transparent: false,
    });

    const segsX = Math.min(dims.w, 512);
    const segsY = Math.min(dims.h, 512);
    const geometry = new THREE.PlaneGeometry(1, 1, segsX, segsY);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;

    rs.mesh = mesh;
    rs.material = material;
    rs.dispose = () => {
      geometry.dispose();
      material.dispose();
    };

    return { outputs: { mesh: ObservableHint.opaque(box(mesh)) } };
  },
};
