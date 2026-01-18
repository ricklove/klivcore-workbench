import {
  EmptyNodeComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import * as THREE from 'three';
import { ObservableHint } from '@legendapp/state';
import { unbox, box, type Box } from './types';

// ---------------------------------------------------------------------------
// Shaders (THREE.ShaderMaterial / GLSL 3.0)
// ---------------------------------------------------------------------------

// Note: In ShaderMaterial with GLSL3, standard attributes (position, uv)
// and uniforms (projectionMatrix, modelViewMatrix) are auto-prepended.
// We only declare what we need to pass out or custom uniforms.

const VERTEX_SHADER = `
precision highp float;

// Custom Uniforms
uniform sampler2D tDepth;
uniform float uFovRadians;
uniform float uAspect;
uniform float uNearMeters;
uniform float uFarMeters;
uniform float uDepthPower;

// Varyings
out vec2 vUv;
out float vDepthMeters;

void main() {
  vUv = uv; // 'uv' is a standard attribute provided by Three.js

  // 1. Sample Depth
  float dRaw = texture(tDepth, uv).r;

  // 2. Inverse Depth Mapping (White=Close, Black=Far)
  float minDisp = 1.0 / uFarMeters;
  float maxDisp = 1.0 / uNearMeters;
  float dCurve = pow(dRaw, uDepthPower);
  float currentDisp = mix(minDisp, maxDisp, dCurve);
  float zMeters = 1.0 / currentDisp;

  // Skybox / Infinity clamp
  if (dRaw < 0.001) {
    zMeters = uFarMeters;
  }

  vDepthMeters = zMeters;

  // 3. Reprojection Logic
  // We calculate the View Space coordinates directly based on the ray math.
  // This essentially "pins" the geometry to the camera origin (0,0,0) in View Space.
  
  float viewHeight = 2.0 * zMeters * tan(uFovRadians * 0.5);
  float viewWidth = viewHeight * uAspect;

  // 'position.x' is standard PlaneGeometry attribute (-0.5 to 0.5)
  float xMeters = position.x * viewWidth;
  float yMeters = position.y * viewHeight;

  // Construct View Position (Camera looks down -Z)
  vec4 viewPos = vec4(xMeters, yMeters, -zMeters, 1.0);

  // 4. Project using the rendering camera's projection matrix
  // 'projectionMatrix' is auto-provided by ShaderMaterial
  gl_Position = projectionMatrix * viewPos;
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tColor;
in vec2 vUv;
in float vDepthMeters;

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
      type: WorkflowBrandedTypes.valueType(`number`), // Vertical Field of View (Degrees)
    },
    {
      name: WorkflowBrandedTypes.inputName(`near`),
      type: WorkflowBrandedTypes.valueType(`number`), // Near plane in meters
    },
    {
      name: WorkflowBrandedTypes.inputName(`far`),
      type: WorkflowBrandedTypes.valueType(`number`), // Far plane in meters
    },
    {
      name: WorkflowBrandedTypes.inputName(`depthPower`),
      type: WorkflowBrandedTypes.valueType(`number`), // Curve adjustment (e.g. 1.0 linear)
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

    console.log('[threeMeshDepthProjectionPlane] START', { texture, depthTexture });

    if (!texture || !depthTexture) {
      console.log('[threeMeshDepthProjectionPlane] missing texture or depthTexture');
      return;
    }

    const rs = runtimeState as {
      texture?: THREE.Texture<HTMLImageElement>;
      depthTexture?: THREE.Texture<HTMLImageElement>;
      mesh?: THREE.Mesh;
      material?: THREE.ShaderMaterial; // Changed to ShaderMaterial
      dispose?: () => void;
      cachedParams?: { fov: number; near: number; far: number; depthPower: number };
    };

    const hasTextureChanged = texture !== rs.texture || depthTexture !== rs.depthTexture;
    const hasParamsChanged =
      !rs.cachedParams ||
      rs.cachedParams.fov !== fov ||
      rs.cachedParams.near !== near ||
      rs.cachedParams.far !== far ||
      rs.cachedParams.depthPower !== depthPower;

    // 1. Update Existing Material (Fast Path)
    if (rs.mesh && rs.material && !hasTextureChanged) {
      if (hasParamsChanged) {
        console.log('[threeMeshDepthProjectionPlane] Updating uniforms');
        const uniforms = rs.material.uniforms as unknown as {
          uFovRadians: { value: number };
          uNearMeters: { value: number };
          uFarMeters: { value: number };
          uDepthPower: { value: number };
          uAspect: { value: number };
        };

        uniforms.uFovRadians.value = fov * (Math.PI / 180);
        uniforms.uNearMeters.value = near;
        uniforms.uFarMeters.value = far;
        uniforms.uDepthPower.value = depthPower;
        rs.cachedParams = { fov, near, far, depthPower };

        if (texture.image) {
          const aspect = texture.image.width / texture.image.height;
          uniforms.uAspect.value = aspect;
        }
      }
      return { outputs: { mesh: ObservableHint.opaque(box(rs.mesh)) } };
    }

    // 2. Full Rebuild
    rs.dispose?.();
    rs.texture = texture;
    rs.depthTexture = depthTexture;
    rs.cachedParams = { fov, near, far, depthPower };

    function getTextureDimensions(
      tex: THREE.Texture,
    ): undefined | { width: number; height: number } {
      const img = tex.image as undefined | HTMLImageElement;
      if (img && 'width' in img && 'height' in img) {
        return { width: img.width, height: img.height };
      }
      return;
    }

    const dims = getTextureDimensions(depthTexture) ??
      getTextureDimensions(texture) ?? { width: 512, height: 512 };

    const aspect = dims.width / dims.height;

    // Material Setup: Using ShaderMaterial + GLSL3 for stability
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
      },
      side: THREE.DoubleSide,
      transparent: false,
    });

    const segsX = Math.min(dims.width, 512);
    const segsY = Math.min(dims.height, 512);

    // 1x1 Plane. The shader reshapes it.
    const geometry = new THREE.PlaneGeometry(1, 1, segsX, segsY);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; // Essential
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);

    console.log('[threeMeshDepthProjectionPlane] DONE', { dims, aspect, segsX });

    rs.mesh = mesh;
    rs.material = material;
    rs.dispose = () => {
      geometry.dispose();
      material.dispose();
    };

    return { outputs: { mesh: ObservableHint.opaque(box(mesh)) } };
  },
};
