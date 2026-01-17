import {
  EmptyNodeComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import * as THREE from 'three';
import { ObservableHint } from '@legendapp/state';
import { CanvasThreeRendererNodeComponent } from './canvas.tsx';
import { ImageUrlPreviewComponent } from './image.tsx';
import { unbox, box, type Box } from './types';
import { threePositionControllerNodeType } from './three-position.tsx';
import { orbitControlsNodeTypes } from './orbit-controls.tsx';
import { timelineControlNodeType } from './timeline.tsx';

const otherWebglNodeTypes: WorkflowRuntimeNodeTypeDefinition[] = [
  threePositionControllerNodeType,
  timelineControlNodeType,
  ...orbitControlsNodeTypes,
];

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
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Scene>`),
      },
    ],
    execute: async () => {
      const scene = new THREE.Scene();

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      return { outputs: { scene: ObservableHint.opaque(box(scene)) } };
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
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Scene>`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`renderer`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.WebGLRenderer>`),
      },
      {
        name: WorkflowBrandedTypes.outputName(`canvas`),
        type: WorkflowBrandedTypes.valueType(`Box<HTMLCanvasElement>`),
      },
      {
        name: WorkflowBrandedTypes.outputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const camera = unbox(inputs.camera as Box<THREE.Camera>);
      const scene = unbox(inputs.scene as Box<THREE.Scene>);
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
        renderer.render(scene!, camera!);
      }
      renderer.setAnimationLoop(animate);

      rs.dispose = () => {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      };

      return {
        outputs: {
          renderer: box(renderer),
          canvas: box(canvas),
          camera: box(camera),
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
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
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
      return { outputs: { camera: ObservableHint.opaque(box(camera)) } };
    },
  },

  threeLoadImageTexture: {
    type: WorkflowBrandedTypes.typeName(`threeLoadImageTexture`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(ImageUrlPreviewComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`url`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`texture`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const url = inputs.url as string;
      if (!url) {
        console.log('[threeImage] handleResize missing url', {
          url,
        });
        return;
      }

      const rs = runtimeState as {
        url?: string;
        dispose?: () => void;
      };

      if (url === rs.url) {
        return;
      }
      rs.dispose?.();
      rs.url = url;

      const loader = new THREE.TextureLoader();
      const texture = await new Promise<THREE.Texture<HTMLImageElement>>((resolve, reject) => {
        loader.load(
          url,
          (texture) => {
            rs.dispose = () => {
              texture.dispose();
            };

            texture.colorSpace = THREE.SRGBColorSpace;
            resolve(texture);
          },
          undefined,
          (err) => {
            console.error('[threeImage] Error loading texture', { url, err });
            reject(err);
          },
        );
      });

      return { outputs: { texture: ObservableHint.opaque(box(texture)) } };
    },
  },
  threeMeshPlane: {
    type: WorkflowBrandedTypes.typeName(`threeMeshPlane`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`texture`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
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
      if (!texture) {
        console.log('[threeImage] handleResize missing texture', {
          texture,
        });
        return;
      }

      const rs = runtimeState as {
        texture?: THREE.Texture<HTMLImageElement>;
        dispose?: () => void;
      };

      if (texture === rs.texture) {
        return;
      }
      rs.dispose?.();
      rs.texture = texture;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
      });

      const width = 5;
      const height = 5;
      const geometry = new THREE.PlaneGeometry(width, height);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Math.random(), Math.random(), Math.random());

      rs.dispose = () => {
        geometry.dispose();
        material.dispose();
      };

      return { outputs: { mesh: ObservableHint.opaque(box(mesh)) } };
    },
  },
  threeAddToScene: {
    type: WorkflowBrandedTypes.typeName(`threeAddToScene`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`scene`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Scene>`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`object`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Object3D>`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`success`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const scene = unbox(inputs.scene as Box<THREE.Scene>);
      const obj = unbox(inputs.object as Box<THREE.Object3D>);
      if (!scene || !obj) {
        console.log('[threeAddToScene] handleResize missing scene or object', {
          scene,
          obj,
        });
        return;
      }

      const rs = runtimeState as {
        scene?: THREE.Scene;
        object?: THREE.Object3D;
        dispose?: () => void;
      };

      if (obj === rs.object && scene === rs.scene) {
        console.log('[threeAddToScene] already added', {
          scene,
          obj,
        });
        return;
      }
      rs.dispose?.();
      rs.object = obj;
      rs.scene = scene;

      scene.add(obj);
      console.log('[threeAddToScene] added', {
        scene,
        obj,
      });

      rs.dispose = () => {
        scene.remove(obj);
      };

      return { outputs: { success: `added ${obj.uuid} at ${Date.now()}` } };
    },
  },
  ...Object.fromEntries(otherWebglNodeTypes.map((nt) => [nt.type, nt])),
};
