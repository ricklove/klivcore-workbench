import {
  EmptyNodeComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import * as THREE from 'three';
import { ObservableHint } from '@legendapp/state';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { CanvasThreeRendererNodeComponent } from './canvas.tsx';
// import { observable } from '@legendapp/state';

export const webglNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  // canvas: {
  //   type: WorkflowBrandedTypes.typeName(`canvas`),
  //   getComponent: () => ({
  //     Component: NodeTypeWrapComponentWithNodeWrapper(CanvasNodeComponent),
  //   }),
  //   inputs: [
  //     //   {
  //     //     name: WorkflowBrandedTypes.inputName(`value`),
  //     //     type: WorkflowBrandedTypes.valueType(`string`),
  //     //   },
  //     //   {
  //     //     name: WorkflowBrandedTypes.inputName(`x`),
  //     //     type: WorkflowBrandedTypes.valueType(`unknown`),
  //     //   },
  //   ],
  //   outputs: [
  //     {
  //       name: WorkflowBrandedTypes.outputName(`canvas`),
  //       type: WorkflowBrandedTypes.valueType(`HtmlCanvasElement`),
  //     },
  //   ],
  //   execute: async () => {
  //     return undefined;
  //   },
  // },
  // canvasThreerenderer: {
  //   type: WorkflowBrandedTypes.typeName(`canvasThreerenderer`),
  //   getComponent: () => ({
  //     Component: NodeTypeWrapComponentWithNodeWrapper(CanvasThreerenderereNodeComponent),
  //   }),
  //   inputs: [
  //     //   {
  //     //     name: WorkflowBrandedTypes.inputName(`value`),
  //     //     type: WorkflowBrandedTypes.valueType(`string`),
  //     //   },
  //     //   {
  //     //     name: WorkflowBrandedTypes.inputName(`x`),
  //     //     type: WorkflowBrandedTypes.valueType(`unknown`),
  //     //   },
  //   ],
  //   outputs: [
  //     {
  //       name: WorkflowBrandedTypes.outputName(`canvas`),
  //       type: WorkflowBrandedTypes.valueType(`HtmlCanvasElement`),
  //     },
  //     {
  //       name: WorkflowBrandedTypes.outputName(`webgl`),
  //       type: WorkflowBrandedTypes.valueType(`WebGL2rendereringContext`),
  //     },
  //   ],
  //   execute: async () => {
  //     return undefined;
  //   },
  // },
  threeScene: {
    type: WorkflowBrandedTypes.typeName(`threeScene`),
    getComponent: () => ({ Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent) }),
    inputs: [],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`scene`),
        type: WorkflowBrandedTypes.valueType(`{ scene: THREE.Scene }`),
      },
    ],
    execute: async () => {
      const scene = new THREE.Scene();

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      return { outputs: { scene: ObservableHint.opaque({ scene }) } };
    },
  },
  threeSceneView: {
    type: WorkflowBrandedTypes.typeName(`threeSceneView`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(CanvasThreeRendererNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`scene`),
        type: WorkflowBrandedTypes.valueType(`{ scene: THREE.Scene }`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`{ camera: THREE.Camera }`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`renderer`),
        type: WorkflowBrandedTypes.valueType(`{ renderer: THREE.WebGLRenderer }`),
      },
      {
        name: WorkflowBrandedTypes.outputName(`canvas`),
        type: WorkflowBrandedTypes.valueType(`{ canvas: HTMLCanvasElement }`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const camera = (inputs.camera as { camera: THREE.Camera })?.camera;
      const scene = (inputs.scene as { scene: THREE.Scene })?.scene;
      if (!scene || !camera) {
        console.log('[threeSceneView] execute missing scene or camera', {
          scene,
          camera,
        });
        return;
      }

      const rs = runtimeState as {
        camera?: THREE.Camera;
        scene?: THREE.Scene;
        dispose?: () => void;
      };

      if (camera === rs.camera && scene === rs.scene) {
        return;
      }
      rs.dispose?.();
      rs.camera = camera;
      rs.scene = scene;
      rs.dispose = () => {};

      const canvas = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
      });

      function animate() {
        renderer.render(scene, camera);
      }
      renderer.setAnimationLoop(animate);

      rs.dispose = () => {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      };

      return {
        outputs: {
          renderer: { renderer },
          canvas: { canvas },
        },
      };
    },
  },
  threeCamera: {
    type: WorkflowBrandedTypes.typeName(`threeCamera`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
    }),
    inputs: [],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`{ camera: THREE.Camera }`),
      },
    ],
    execute: async () => {
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.z = 5;
      return { outputs: { camera: ObservableHint.opaque({ camera }) } };
    },
  },
  threeOrbitControls: {
    type: WorkflowBrandedTypes.typeName(`threeOrbitControls`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`{ camera: THREE.Camera }`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`renderer`),
        type: WorkflowBrandedTypes.valueType(`{ renderer: THREE.WebGLRenderer }`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`controls`),
        type: WorkflowBrandedTypes.valueType(`{ controls: OrbitControls }`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const camera = (inputs.camera as { camera: THREE.Camera })?.camera;
      const renderer = (inputs.renderer as { renderer: THREE.WebGLRenderer })?.renderer;
      if (!renderer || !camera) {
        console.log('[threeOrbitControls] handleResize missing camera or renderer', {
          camera,
          renderer,
        });
        return;
      }

      const rs = runtimeState as {
        camera?: THREE.Camera;
        renderer?: THREE.WebGLRenderer;
        dispose?: () => void;
      };

      if (camera === rs.camera && renderer === rs.renderer) {
        return;
      }
      rs.dispose?.();
      rs.camera = camera;
      rs.renderer = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      const update = () => {
        controls.update();
        id = requestAnimationFrame(update);
      };
      let id = requestAnimationFrame(update);

      rs.dispose = () => {
        controls.dispose();
        cancelAnimationFrame(id);
      };

      return { outputs: { controls: ObservableHint.opaque({ controls }) } };
    },
  },
};
