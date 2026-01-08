import { NodeDefault } from './node-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from './types';
import { StringNodeComponent } from './nodes';
import { TempWrapper } from './node-temp-wrapper';

export const builtinNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  default: {
    type: WorkflowBrandedTypes.typeName(`default`),
    getComponent: () => ({ Component: NodeDefault }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
  string: {
    type: WorkflowBrandedTypes.typeName(`string`),
    getComponent: () => ({ Component: StringNodeComponent }),
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
    execute: async ({ inputs, data }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      return {
        outputs: { value: inputsTyped.value ?? dataTyped?.value ?? null },
      };
    },
  },
  tempWrapper: {
    type: WorkflowBrandedTypes.typeName(`tempWrapper`),
    getComponent: () => ({ Component: TempWrapper }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
};
