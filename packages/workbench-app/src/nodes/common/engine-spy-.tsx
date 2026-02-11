import {
  EmptyNodeComponent,
  NodeStandardContainer,
} from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

export const engineSpyNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`engineSpy`),
  getComponent: () => ({
    Component: NodeStandardContainer(EmptyNodeComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`trigger`),
      type: WorkflowBrandedTypes.valueType(`unknown`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`stats`),
      type: WorkflowBrandedTypes.valueType(`unknown`),
    },
  ],

  execute: async ({ store }) => {
    const engineInternals = store.engine as unknown as {
      __engineState: {
        stats: Record<string, number>;
      };
    };

    const stats = { ...engineInternals.__engineState.stats };

    return {
      outputs: {
        stats,
      },
    };
  },
  generateFunction: async () => {
    return undefined;
  },
};
