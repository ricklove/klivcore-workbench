import {
  EmptyNodeComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import { CanvasNodeComponent, CanvasWebglNodeComponent } from './canvas';
import * as THREE from 'three';
// import { observable } from '@legendapp/state';

export const webglNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  canvas: {
    type: WorkflowBrandedTypes.typeName(`canvas`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(CanvasNodeComponent),
    }),
    inputs: [
      //   {
      //     name: WorkflowBrandedTypes.inputName(`value`),
      //     type: WorkflowBrandedTypes.valueType(`string`),
      //   },
      //   {
      //     name: WorkflowBrandedTypes.inputName(`x`),
      //     type: WorkflowBrandedTypes.valueType(`unknown`),
      //   },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`canvas`),
        type: WorkflowBrandedTypes.valueType(`HtmlCanvasElement`),
      },
    ],
    execute: async () => {
      return undefined;
    },
  },
  canvasWebgl: {
    type: WorkflowBrandedTypes.typeName(`canvasWebgl`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(CanvasWebglNodeComponent),
    }),
    inputs: [
      //   {
      //     name: WorkflowBrandedTypes.inputName(`value`),
      //     type: WorkflowBrandedTypes.valueType(`string`),
      //   },
      //   {
      //     name: WorkflowBrandedTypes.inputName(`x`),
      //     type: WorkflowBrandedTypes.valueType(`unknown`),
      //   },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`canvas`),
        type: WorkflowBrandedTypes.valueType(`HtmlCanvasElement`),
      },
      {
        name: WorkflowBrandedTypes.outputName(`webgl`),
        type: WorkflowBrandedTypes.valueType(`WebGL2RenderingContext`),
      },
    ],
    execute: async () => {
      return undefined;
    },
  },
  threeScene: {
    type: WorkflowBrandedTypes.typeName(`threeScene`),
    getComponent: () => ({ Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent) }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`canvas`),
        type: WorkflowBrandedTypes.valueType(`HtmlCanvasElement`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`scene`),
        type: WorkflowBrandedTypes.valueType(`THREE.Scene`),
      },
      {
        name: WorkflowBrandedTypes.outputName(`renderer`),
        type: WorkflowBrandedTypes.valueType(`THREE.WebGLRenderer`),
      },
    ],
    execute: async ({ inputs }) => {
      const scene = new THREE.Scene();

      const canvas = inputs.canvas as HTMLCanvasElement;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
      });

      renderer.setSize(canvas.width, canvas.height);

      new ResizeObserver(() => {
        renderer.setSize(canvas.width, canvas.height);
      }).observe(canvas);

      return { outputs: { scene, renderer } };
    },
  },
};
