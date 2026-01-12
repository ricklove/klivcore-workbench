import { WorkflowNodeDefault } from './node-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from './types';
import { StringNodeComponent } from './nodes';
import { TempWrapper } from './node-temp-wrapper';
import { NodeTypeWrapComponent } from './node-types-wrapper';

export const builtinNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  default: {
    type: WorkflowBrandedTypes.typeName(`default`),
    getComponent: () => ({ Component: NodeTypeWrapComponent(WorkflowNodeDefault) }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
  string: {
    type: WorkflowBrandedTypes.typeName(`string`),
    getComponent: () => ({ Component: NodeTypeWrapComponent(StringNodeComponent) }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`value`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`value`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      // TEMP: testing
      controller.setProgress({ progressRatio: 0, message: 'Starting delay...' });
      if (Math.random() < 0.1) {
        throw new Error('Random error for testing purposes');
      }
      if (Math.random() < 0.001) {
        await new Promise((resolve) => setTimeout(resolve, 5000 * Math.random()));
      }
      if (Math.random() < 0.5) {
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.random()));
      }
      controller.setProgress({ progressRatio: 1, message: 'Delay complete' });

      return {
        outputs: { value: inputsTyped.value ?? dataTyped?.value ?? null },
      };
    },
  },
  tempWrapper: {
    type: WorkflowBrandedTypes.typeName(`tempWrapper`),
    getComponent: () => ({ Component: NodeTypeWrapComponent(TempWrapper) }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
};
