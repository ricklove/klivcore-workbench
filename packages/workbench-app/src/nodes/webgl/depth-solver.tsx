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

const SOLVER_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D tCurrentDepth;
uniform sampler2D tInitialDepth;
uniform sampler2D tColor;

uniform vec2 uResolution;
uniform float uSmoothStrength;
uniform float uColorSensitivity;
uniform float uAnchorStrength;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 onePixel = 1.0 / uResolution;

  float dCenter = texture(tCurrentDepth, uv).r;
  vec3 cCenter = texture(tColor, uv).rgb;
  float dInitial = texture(tInitialDepth, uv).r;

  vec2 offsets[4];
  offsets[0] = vec2(-1, 0);
  offsets[1] = vec2(1, 0);
  offsets[2] = vec2(0, -1);
  offsets[3] = vec2(0, 1);

  float dSum = 0.0;
  float wSum = 0.0;

  for(int i = 0; i < 4; i++) {
      vec2 sampleUV = uv + offsets[i] * onePixel;
      
      float dNeighbor = texture(tCurrentDepth, sampleUV).r;
      vec3 cNeighbor = texture(tColor, sampleUV).rgb;

      float colorDiff = length(cCenter - cNeighbor);
      float w = 1.0 / (1.0 + colorDiff * uColorSensitivity);

      dSum += dNeighbor * w;
      wSum += w;
  }

  float dSmooth = dCenter;
  if (wSum > 0.0) {
      dSmooth = dSum / wSum;
  }

  float dNext = mix(dCenter, dSmooth, uSmoothStrength);
  dNext = mix(dNext, dInitial, uAnchorStrength);

  fragColor = vec4(dNext, 0.0, 0.0, 1.0);
}`;

const COPY_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D tInput;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = texture(tInput, vUv);
}`;

// ---------------------------------------------------------------------------
// Types & State
// ---------------------------------------------------------------------------

interface SolverUniforms {
  tCurrentDepth: { value: THREE.Texture | null };
  tInitialDepth: { value: THREE.Texture };
  tColor: { value: THREE.Texture };
  uResolution: { value: THREE.Vector2 };
  uSmoothStrength: { value: number };
  uColorSensitivity: { value: number };
  uAnchorStrength: { value: number };
}

interface CopyUniforms {
  tInput: { value: THREE.Texture | null };
}

type RuntimeState = {
  // Resources
  ping?: THREE.WebGLRenderTarget;
  pong?: THREE.WebGLRenderTarget;
  output?: THREE.WebGLRenderTarget;
  solverMat?: THREE.RawShaderMaterial;
  copyMat?: THREE.RawShaderMaterial;
  quadScene?: THREE.Scene;
  quadCamera?: THREE.Camera;
  runner?: THREE.Mesh;

  // Internal Tracking
  initialized?: boolean;
  currentTexture?: THREE.Texture;

  // Dynamic Control Flags (Read by onBeforeRender)
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
      // Default false (Paused)
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
    const smoothStrength = (inputs.smoothStrength as number) ?? 0.0001;
    const colorSensitivity = (inputs.colorSensitivity as number) ?? 20.0;
    const anchorStrength = (inputs.anchorStrength as number) ?? 0.01;
    const reset = (inputs.reset as boolean) ?? false;

    if (!colorTexture || !depthTexture) return;

    const rs = runtimeState as RuntimeState;

    // Update Control State
    rs.enabled = enabled;
    rs.iterations = iterations;
    if (reset) rs.shouldReset = true;

    // Update Material Uniforms (if they exist)
    if (rs.solverMat) {
      const u = rs.solverMat.uniforms as unknown as SolverUniforms;
      u.tInitialDepth.value = depthTexture;
      u.tColor.value = colorTexture;
      u.uSmoothStrength.value = smoothStrength;
      u.uColorSensitivity.value = colorSensitivity;
      u.uAnchorStrength.value = anchorStrength;
    }

    // EARLY RETURN: If runner exists, we just updated state. Return undefined.
    if (rs.runner) {
      return undefined;
    }

    // --- INITIAL CREATION ---

    const width = colorTexture.image?.width ?? 512;
    const height = colorTexture.image?.height ?? 512;

    // 1. Initialize Render Targets
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

    // 2. Initialize GPGPU Scene
    if (!rs.solverMat) {
      rs.solverMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: SOLVER_FRAGMENT_SHADER,
        uniforms: {
          tCurrentDepth: { value: null },
          tInitialDepth: { value: depthTexture },
          tColor: { value: colorTexture },
          uResolution: { value: new THREE.Vector2(width, height) },
          uSmoothStrength: { value: smoothStrength },
          uColorSensitivity: { value: colorSensitivity },
          uAnchorStrength: { value: anchorStrength },
        },
      });

      rs.copyMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: COPY_FRAGMENT_SHADER,
        uniforms: { tInput: { value: depthTexture } },
      });

      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rs.solverMat);
      quad.frustumCulled = false;
      rs.quadScene = new THREE.Scene();
      rs.quadScene.add(quad);
      rs.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    // 3. Initialize Runner
    if (!rs.runner) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

      rs.runner = new THREE.Mesh(geometry, material);
      rs.runner.frustumCulled = false;
      rs.runner.renderOrder = -Infinity; // Ensure initialization happens first

      rs.runner.onBeforeRender = (renderer) => {
        if (!rs.quadScene || !rs.quadCamera || !rs.solverMat || !rs.copyMat) return;
        if (!rs.ping || !rs.pong || !rs.output) return;

        const r = renderer as THREE.WebGLRenderer;
        const currentRt = r.getRenderTarget();
        const currentAutoClear = r.autoClear;
        r.autoClear = false;

        // A. INITIALIZATION
        // Runs on start, on reset, or if texture reference changed.
        // Populates ALL buffers with the initial depth map.
        if (!rs.initialized || rs.shouldReset || rs.currentTexture !== depthTexture) {
          const quad = rs.quadScene.children[0] as THREE.Mesh;
          quad.material = rs.copyMat!;
          (rs.copyMat!.uniforms as unknown as CopyUniforms).tInput.value = depthTexture;

          // Fill Read, Write, and Output buffers so they are valid immediately
          r.setRenderTarget(rs.ping);
          r.render(rs.quadScene, rs.quadCamera);

          r.setRenderTarget(rs.pong);
          r.render(rs.quadScene, rs.quadCamera);

          r.setRenderTarget(rs.output);
          r.render(rs.quadScene, rs.quadCamera);

          rs.initialized = true;
          rs.shouldReset = false; // Clear trigger
          rs.currentTexture = depthTexture;
        }

        // B. SOLVER LOOP (Only if Enabled)
        if (rs.enabled) {
          const quad = rs.quadScene.children[0] as THREE.Mesh;
          quad.material = rs.solverMat!;
          const u = rs.solverMat!.uniforms as unknown as SolverUniforms;

          let read = rs.ping!;
          let write = rs.pong!;

          rs.runIndex = (rs.runIndex || 0) + 1;
          const iterationMod = (rs.iterations < 1 ? Math.ceil(1 / rs.iterations) : 1) || 0;

          //   console.log(`[threeDepthRefinement] Solver is enabled`, {
          //     runIndex: rs.runIndex,
          //     iterations: rs.iterations,
          //     iterationMod,
          //   });

          if (rs.runIndex % iterationMod === 0) {
            console.log(`[threeDepthRefinement] Running solver`, {
              runIndex: rs.runIndex,
              iterations: rs.iterations,
              iterationMod,
            });
            for (let i = 0; i < rs.iterations; i++) {
              u.tCurrentDepth.value = read.texture;
              r.setRenderTarget(write);
              r.render(rs.quadScene, rs.quadCamera);

              const temp = read;
              read = write;
              write = temp;
            }

            rs.ping = read;
            rs.pong = write;
          }

          // C. OUTPUT UPDATE (Only if solver ran)
          quad.material = rs.copyMat!;
          (rs.copyMat!.uniforms as unknown as CopyUniforms).tInput.value = read.texture;
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
