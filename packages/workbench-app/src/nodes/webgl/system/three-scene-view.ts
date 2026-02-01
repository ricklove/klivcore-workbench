import type * as THREE from 'three';
import {
  WorkflowBrandedTypes,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../../workflow/types';
import { NodeTypeWrapComponentWithNodeWrapper } from '../_deps';
import { type Box, box, unbox } from '../types';
import { ScenePreviewNodeComponent } from './three-scene-preview-component';

export const threeSceneView: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threeSceneView`),
  getComponent: () => ({
    // We point to our new component below
    Component: NodeTypeWrapComponentWithNodeWrapper(ScenePreviewNodeComponent),
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
    // We keep outputs for compatibility, but 'renderer' and 'canvas'
    // are now essentially useless for downstream nodes unless we want to lie.
    // Ideally, you remove them or pass through the scene.
    {
      name: WorkflowBrandedTypes.outputName(`scene`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Scene>`),
    },
  ],
  execute: async ({ inputs }) => {
    const camera = unbox(inputs.camera as Box<THREE.Camera>);
    const scene = unbox(inputs.scene as Box<THREE.Scene>);

    if (!scene || !camera) return;

    // We do NOT create a renderer here anymore.
    // We just pass the data through to the component via inputs/outputs
    // or simply return it so the output ports work.

    return {
      outputs: {
        scene: box(scene), // Pass through if needed
      },
    };
  },
};
