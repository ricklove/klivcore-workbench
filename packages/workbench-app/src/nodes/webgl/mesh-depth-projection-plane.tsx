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

uniform sampler2D tDepth;
uniform float uFovRadians;
uniform float uAspect;
uniform float uNearMeters;
uniform float uFarMeters;
uniform float uDepthPower;
uniform float uPerspectiveMix; 
uniform int uDepthMode;        

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
     // Linear
     zMeters = mix(uFarMeters, uNearMeters, dCurve);
  } else {
     // Inverse
     float minDisp = 1.0 / uFarMeters;
     float maxDisp = 1.0 / uNearMeters;
     float currentDisp = mix(minDisp, maxDisp, dCurve);
     zMeters = 1.0 / currentDisp;
  }

  // Clamp Skybox
  if (dRaw < 0.001) zMeters = uFarMeters;

  vDepthMeters = zMeters;

  // 3. Projection Logic
  float viewHeightAtZ = 2.0 * zMeters * tan(uFovRadians * 0.5);
  float viewWidthAtZ  = viewHeightAtZ * uAspect;

  float viewHeightOrtho = 2.0 * uNearMeters * tan(uFovRadians * 0.5);
  float viewWidthOrtho  = viewHeightOrtho * uAspect;

  float effectiveWidth  = mix(viewWidthOrtho, viewWidthAtZ, uPerspectiveMix);
  float effectiveHeight = mix(viewHeightOrtho, viewHeightAtZ, uPerspectiveMix);
  
  float xLocal = position.x * effectiveWidth;
  float yLocal = position.y * effectiveHeight;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(xLocal, yLocal, -zMeters, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tDepth;

uniform float uNearMeters;
uniform float uFarMeters;
uniform float uDepthPower;
uniform int uDepthMode;

uniform float uGapThreshold; 
uniform float uGapSoftness; 

in vec2 vUv;
in float vDepthMeters;

out vec4 fragColor;

float getDepthMeters(vec2 uvCoord) {
    float dRaw = texture(tDepth, uvCoord).r;
    float dCurve = pow(dRaw, uDepthPower);
    if (dRaw < 0.001) return uFarMeters;

    if (uDepthMode == 1) {
         return mix(uFarMeters, uNearMeters, dCurve);
    } else {
         float minDisp = 1.0 / uFarMeters;
         float maxDisp = 1.0 / uNearMeters;
         float currentDisp = mix(minDisp, maxDisp, dCurve);
         return 1.0 / currentDisp;
    }
}

void main() {
    vec4 color = texture(tColor, vUv);

    // GAP DETECTION
    if (uGapThreshold > 0.0) {
        ivec2 size = textureSize(tDepth, 0);
        vec2 onePixel = 1.0 / vec2(size);
        
        float dCenter = getDepthMeters(vUv);
        float dRight  = getDepthMeters(vUv + vec2(onePixel.x, 0.0));
        float dUp     = getDepthMeters(vUv + vec2(0.0, onePixel.y));
        
        float diff = max(abs(dCenter - dRight), abs(dCenter - dUp));
        
        if (diff > uGapThreshold) {
            if (uGapSoftness <= 0.0) {
                discard;
            } else {
                float fade = clamp(1.0 - (diff - uGapThreshold) / uGapSoftness, 0.0, 1.0);
                color.a *= fade;
                
                // Discard near-invisible pixels to prevent Z-buffer pollution
                if (color.a < 0.01) discard;
            }
        }
    }

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
      name: WorkflowBrandedTypes.inputName(`perspectiveMix`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`depthMode`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`gapThreshold`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`gapSoftness`),
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
    const perspectiveMix = (inputs.perspectiveMix as number) ?? 1.0;
    const depthModeStr = (inputs.depthMode as string) ?? 'inverse';
    const gapThreshold = (inputs.gapThreshold as number) ?? 0.0;
    const gapSoftness = (inputs.gapSoftness as number) ?? 0.0;

    const depthModeInt = depthModeStr === 'linear' ? 1 : 0;

    if (!texture || !depthTexture) return;

    // Filter Logic: Nearest is required for Gap Cutting to look clean
    if (gapThreshold > 0) {
      if (depthTexture.minFilter !== THREE.NearestFilter) {
        depthTexture.minFilter = THREE.NearestFilter;
        depthTexture.magFilter = THREE.NearestFilter;
        depthTexture.needsUpdate = true;
      }
    } else {
      if (depthTexture.minFilter !== THREE.LinearFilter) {
        depthTexture.minFilter = THREE.LinearFilter;
        depthTexture.magFilter = THREE.LinearFilter;
        depthTexture.needsUpdate = true;
      }
    }

    const rs = runtimeState as {
      texture?: THREE.Texture;
      depthTexture?: THREE.Texture;
      mesh?: THREE.Mesh;
      material?: THREE.ShaderMaterial;
      dispose?: () => void;
      cachedParams?: Record<string, unknown>;
    };

    const hasTextureChanged = texture !== rs.texture || depthTexture !== rs.depthTexture;

    const currentParams = {
      fov,
      near,
      far,
      depthPower,
      perspectiveMix,
      depthModeInt,
      gapThreshold,
      gapSoftness,
    };
    const paramsChanged = JSON.stringify(currentParams) !== JSON.stringify(rs.cachedParams);

    // Transparency Logic:
    // Only enable expensive transparency if we actually use Soft Gaps.
    // Otherwise, use Opaque mode (transparent=false) with 'discard' for performance and correct Z-sorting.
    const useTransparent = gapSoftness > 0;

    if (rs.mesh && rs.material && !hasTextureChanged) {
      if (paramsChanged) {
        const uniforms = rs.material.uniforms as unknown as {
          uFovRadians: { value: number };
          uNearMeters: { value: number };
          uFarMeters: { value: number };
          uDepthPower: { value: number };
          uPerspectiveMix: { value: number };
          uDepthMode: { value: number };
          uGapThreshold: { value: number };
          uGapSoftness: { value: number };
          uAspect: { value: number };
        };

        uniforms.uFovRadians.value = fov * (Math.PI / 180);
        uniforms.uNearMeters.value = near;
        uniforms.uFarMeters.value = far;
        uniforms.uDepthPower.value = depthPower;
        uniforms.uPerspectiveMix.value = perspectiveMix;
        uniforms.uDepthMode.value = depthModeInt;
        uniforms.uGapThreshold.value = gapThreshold;
        uniforms.uGapSoftness.value = gapSoftness;

        if (texture.image) {
          const aspect = texture.image.width / texture.image.height;
          uniforms.uAspect.value = aspect;
        }

        // Toggle transparency state dynamically
        rs.material.transparent = useTransparent;
        rs.material.depthWrite = true; // Always write depth to fix overlap issues
        rs.material.needsUpdate = true;

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
        uGapThreshold: { value: gapThreshold },
        uGapSoftness: { value: gapSoftness },
      },
      side: THREE.DoubleSide,
      transparent: useTransparent, // Only true if needed
      depthTest: true,
      depthWrite: true, // Crucial for self-occlusion and background sorting
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
