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
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

// SOLVER: Solves for the Offset (Error) relative to Initial Depth
const SOLVER_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tCurrentOffset; // Stores the accumulated offset (starts at 0)
uniform sampler2D tInitialDepth;  // The fixed AI depth
uniform sampler2D tColor;

uniform vec2 uResolution;
uniform float uSmoothStrength;
uniform float uColorSensitivity;
uniform float uAnchorStrength;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 onePixel = 1.0 / uResolution;

  // 1. Reconstruct Total Depth at Center
  float dInitial = texture(tInitialDepth, uv).r;
  float offCenter = texture(tCurrentOffset, uv).r;
  float dCenter = dInitial + offCenter; // dTotal
  
  vec3 cCenter = texture(tColor, uv).rgb;

  // 2. Neighbor Sampling
  vec2 offsets[4];
  offsets[0] = vec2(-1, 0);
  offsets[1] = vec2(1, 0);
  offsets[2] = vec2(0, -1);
  offsets[3] = vec2(0, 1);

  float dSum = 0.0;
  float wSum = 0.0;

  for(int i = 0; i < 4; i++) {
      vec2 sampleUV = uv + offsets[i] * onePixel;
      
      // Reconstruct Neighbor Total Depth
      float dInitN = texture(tInitialDepth, sampleUV).r;
      float offN = texture(tCurrentOffset, sampleUV).r;
      float dNeighbor = dInitN + offN;
      
      vec3 cNeighbor = texture(tColor, sampleUV).rgb;

      // Weight Logic
      float colorDiff = length(cCenter - cNeighbor);
      float w = 1.0 / (1.0 + colorDiff * uColorSensitivity);

      dSum += dNeighbor * w;
      wSum += w;
  }

  // 3. Calculate Target (Smoothed Total Depth)
  float dSmooth = dCenter;
  if (wSum > 0.0) {
      dSmooth = dSum / wSum;
  }

  // 4. Update Step
  // Move actual depth towards smoothed depth
  float dNextTotal = mix(dCenter, dSmooth, uSmoothStrength);
  
  // 5. Convert back to Offset
  float offNext = dNextTotal - dInitial;

  // 6. Anchor / Decay
  // Decay the offset back towards zero (Initial Depth)
  // If AnchorStrength is 0, offset can grow indefinitely.
  // If AnchorStrength is 1, offset is forced to 0.
  offNext *= (1.0 - uAnchorStrength);

  fragColor = vec4(offNext, 0.0, 0.0, 1.0);
}`;

// COMBINE: Outputs Initial + Offset
const COMBINE_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D tInitial;
uniform sampler2D tOffset;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float init = texture(tInitial, vUv).r;
  float off = texture(tOffset, vUv).r;
  fragColor = vec4(init + off, 0.0, 0.0, 1.0);
}`;

// ZERO: Initializes texture to 0.0
const ZERO_FRAGMENT_SHADER = `
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0, 0.0, 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------
// Types & State
// ---------------------------------------------------------------------------

interface SolverUniforms {
  tCurrentOffset: { value: THREE.Texture | null };
  tInitialDepth: { value: THREE.Texture };
  tColor: { value: THREE.Texture };
  uResolution: { value: THREE.Vector2 };
  uSmoothStrength: { value: number };
  uColorSensitivity: { value: number };
  uAnchorStrength: { value: number };
}

interface CombineUniforms {
  tInitial: { value: THREE.Texture | null };
  tOffset: { value: THREE.Texture | null };
}

type RuntimeState = {
  ping?: THREE.WebGLRenderTarget;
  pong?: THREE.WebGLRenderTarget;
  output?: THREE.WebGLRenderTarget;

  solverMat?: THREE.RawShaderMaterial;
  combineMat?: THREE.RawShaderMaterial;
  zeroMat?: THREE.RawShaderMaterial;

  quadScene?: THREE.Scene;
  quadCamera?: THREE.Camera;

  runner?: THREE.Mesh;

  initialized?: boolean;
  currentTexture?: THREE.Texture;

  enabled: boolean;
  shouldReset: boolean;
  iterations: number;
  runIndex: number;
};

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const threeDepthRefinement: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threeDepthRefinement`),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`colorTexture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`depthTexture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`enabled`),
      type: WorkflowBrandedTypes.valueType(`boolean`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`iterations`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`smoothStrength`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`colorSensitivity`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`anchorStrength`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`reset`),
      type: WorkflowBrandedTypes.valueType(`boolean`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`refinedDepthTexture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture>`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`runner`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Object3D>`),
    },
  ],
  execute: async ({ inputs, runtimeState }) => {
    const colorTexture = unbox(inputs.colorTexture as Box<THREE.Texture<HTMLImageElement>>);
    const depthTexture = unbox(inputs.depthTexture as Box<THREE.Texture<HTMLImageElement>>);

    const enabled = (inputs.enabled as boolean) ?? false;
    const iterations = (inputs.iterations as number) ?? 1;
    const smoothStrength = (inputs.smoothStrength as number) ?? 0.1;
    const colorSensitivity = (inputs.colorSensitivity as number) ?? 20.0;
    const anchorStrength = (inputs.anchorStrength as number) ?? 0.01;
    const reset = (inputs.reset as boolean) ?? false;

    if (!colorTexture || !depthTexture) return;

    const rs = runtimeState as RuntimeState;

    rs.enabled = enabled;
    rs.iterations = iterations;
    if (reset) rs.shouldReset = true;

    if (rs.solverMat) {
      const u = rs.solverMat.uniforms as unknown as SolverUniforms;
      u.tInitialDepth.value = depthTexture;
      u.tColor.value = colorTexture;
      u.uSmoothStrength.value = smoothStrength;
      u.uColorSensitivity.value = colorSensitivity;
      u.uAnchorStrength.value = anchorStrength;
    }

    if (rs.runner) return undefined;

    // --- INITIALIZATION ---
    const width = colorTexture.image?.width ?? 512;
    const height = colorTexture.image?.height ?? 512;

    if (!rs.ping || rs.ping.width !== width || rs.ping.height !== height) {
      rs.ping?.dispose();
      rs.pong?.dispose();
      rs.output?.dispose();

      const opts = {
        type: THREE.FloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RedFormat,
        generateMipmaps: false,
        depthBuffer: false,
        stencilBuffer: false,
      };

      rs.ping = new THREE.WebGLRenderTarget(width, height, opts);
      rs.pong = new THREE.WebGLRenderTarget(width, height, opts);
      rs.output = new THREE.WebGLRenderTarget(width, height, opts);
      rs.initialized = false;
    }

    if (!rs.solverMat) {
      rs.solverMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: SOLVER_FRAGMENT_SHADER,
        uniforms: {
          tCurrentOffset: { value: null },
          tInitialDepth: { value: depthTexture },
          tColor: { value: colorTexture },
          uResolution: { value: new THREE.Vector2(width, height) },
          uSmoothStrength: { value: smoothStrength },
          uColorSensitivity: { value: colorSensitivity },
          uAnchorStrength: { value: anchorStrength },
        },
      });

      rs.combineMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: COMBINE_FRAGMENT_SHADER,
        uniforms: {
          tInitial: { value: depthTexture },
          tOffset: { value: null },
        },
      });

      rs.zeroMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: ZERO_FRAGMENT_SHADER,
      });

      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rs.solverMat);
      quad.frustumCulled = false;
      rs.quadScene = new THREE.Scene();
      rs.quadScene.add(quad);
      rs.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    if (!rs.runner) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

      rs.runner = new THREE.Mesh(geometry, material);
      rs.runner.frustumCulled = false;
      rs.runner.renderOrder = -Infinity;

      rs.runner.onBeforeRender = (renderer) => {
        if (!rs.quadScene || !rs.quadCamera || !rs.solverMat || !rs.combineMat || !rs.zeroMat)
          return;
        if (!rs.ping || !rs.pong || !rs.output) return;

        const r = renderer as THREE.WebGLRenderer;
        const currentRt = r.getRenderTarget();
        const currentAutoClear = r.autoClear;
        r.autoClear = false;

        // A. INITIALIZATION
        // Reset Ping/Pong to Zero (0 Offset)
        // Populate Output with Initial + 0
        if (!rs.initialized || rs.shouldReset || rs.currentTexture !== depthTexture) {
          const quad = rs.quadScene.children[0] as THREE.Mesh;

          // 1. Zero out Ping/Pong
          quad.material = rs.zeroMat!;
          r.setRenderTarget(rs.ping);
          r.render(rs.quadScene, rs.quadCamera);
          r.setRenderTarget(rs.pong);
          r.render(rs.quadScene, rs.quadCamera);

          // 2. Initialize Output (Initial + 0)
          quad.material = rs.combineMat!;
          const combineU = rs.combineMat!.uniforms as unknown as CombineUniforms;
          combineU.tInitial.value = depthTexture;
          combineU.tOffset.value = rs.ping.texture; // Ping is zero

          r.setRenderTarget(rs.output);
          r.render(rs.quadScene, rs.quadCamera);

          rs.initialized = true;
          rs.shouldReset = false;
          rs.currentTexture = depthTexture;
        }

        // B. SOLVER LOOP
        if (rs.enabled) {
          const quad = rs.quadScene.children[0] as THREE.Mesh;
          quad.material = rs.solverMat!;
          const u = rs.solverMat!.uniforms as unknown as SolverUniforms;

          let read = rs.ping!;
          let write = rs.pong!;

          rs.runIndex = (rs.runIndex || 0) + 1;
          const iterationMod = (rs.iterations < 1 ? Math.ceil(1 / rs.iterations) : 1) || 0;

          if (rs.runIndex % iterationMod === 0) {
            console.log(`[threeDepthRefinement] Running solver`, {
              runIndex: rs.runIndex,
              iterations: rs.iterations,
              iterationMod,
            });
            for (let i = 0; i < rs.iterations; i++) {
              u.tCurrentOffset.value = read.texture;
              r.setRenderTarget(write);
              r.render(rs.quadScene, rs.quadCamera);

              const temp = read;
              read = write;
              write = temp;
            }

            rs.ping = read;
            rs.pong = write;
          }

          // C. COMBINE & OUTPUT
          quad.material = rs.combineMat!;
          const combineU = rs.combineMat!.uniforms as unknown as CombineUniforms;
          combineU.tInitial.value = depthTexture;
          combineU.tOffset.value = read.texture; // The calculated offset

          r.setRenderTarget(rs.output);
          r.render(rs.quadScene, rs.quadCamera);
        }

        r.setRenderTarget(currentRt);
        r.autoClear = currentAutoClear;
      };
    }

    return {
      outputs: {
        refinedDepthTexture: ObservableHint.opaque(box(rs.output!.texture)),
        runner: ObservableHint.opaque(box(rs.runner)),
      },
    };
  },
};
