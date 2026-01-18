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
  vUv = uv; 

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

  // 3. Geometric Reconstruction (Local Space)
  // We reconstruct the 3D shape relative to the "Original Camera" (the mesh object's origin).
  
  float viewHeight = 2.0 * zMeters * tan(uFovRadians * 0.5);
  float viewWidth = viewHeight * uAspect;

  // position.x is -0.5 to 0.5. Scale to full frustum width.
  float xLocal = position.x * viewWidth;
  float yLocal = position.y * viewHeight;

  // The vertex position in LOCAL space (relative to the mesh origin)
  vec4 localPos = vec4(xLocal, yLocal, -zMeters, 1.0);

  // 4. Standard Transform
  // modelViewMatrix: Transforms Local -> World -> Camera View
  // projectionMatrix: Transforms Camera View -> Clip Space
  gl_Position = projectionMatrix * modelViewMatrix * localPos;
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tColor;
in vec2 vUv;
in float vDepthMeters;

out vec4 fragColor;

void main() {
  vec4 color = texture(tColor, vUv);
  
  // Optional: Debug depth if needed
  // fragColor = vec4(vec3(vDepthMeters / 10.0), 1.0);
  
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
      return;
    }

    const rs = runtimeState as {
      texture?: THREE.Texture<HTMLImageElement>;
      depthTexture?: THREE.Texture<HTMLImageElement>;
      mesh?: THREE.Mesh;
      material?: THREE.ShaderMaterial;
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

    if (rs.mesh && rs.material && !hasTextureChanged) {
      if (hasParamsChanged) {
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

    rs.dispose?.();
    rs.texture = texture;
    rs.depthTexture = depthTexture;
    rs.cachedParams = { fov, near, far, depthPower };

    function getTextureDimensions(tex: THREE.Texture) {
      const img = tex.image as undefined | HTMLImageElement;
      if (img && 'width' in img && 'height' in img) {
        return { width: img.width, height: img.height };
      }
      return undefined;
    }

    const dims = getTextureDimensions(depthTexture) ??
      getTextureDimensions(texture) ?? { width: 512, height: 512 };

    const aspect = dims.width / dims.height;

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

    const geometry = new THREE.PlaneGeometry(1, 1, segsX, segsY);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);

    rs.mesh = mesh;
    rs.material = material;
    rs.dispose = () => {
      geometry.dispose();
      material.dispose();
    };

    return { outputs: { mesh: ObservableHint.opaque(box(mesh)) } };
  },
};
