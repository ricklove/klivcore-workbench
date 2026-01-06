import { ref } from 'valtio';
import { NodeDefault } from '../node-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../types';
import { StringNodeComponent } from '../nodes';
import { TempWrapper } from '../node-temp-wrapper';

export const builtinNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  default: {
    type: WorkflowBrandedTypes.typeName(`default`),
    component: ref({ Component: NodeDefault }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
  string: {
    type: WorkflowBrandedTypes.typeName(`string`),
    component: ref({ Component: StringNodeComponent }),
    inputs: [],
    outputs: [],
    execute: async ({ inputs, data }) => {
      return {
        outputs: { value: inputs.value ?? data.value },
      };
    },
  },
  tempWrapper: {
    type: WorkflowBrandedTypes.typeName(`tempWrapper`),
    component: ref({ Component: TempWrapper }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
};
