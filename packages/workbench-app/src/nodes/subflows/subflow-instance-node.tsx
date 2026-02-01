import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

export const subflowInstanceNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-instance`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInstanceComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async () => {
    return {
      outputs: {},
    };
  },
};

export const SubflowInstanceComponent = (
  _: WorkflowComponentSimplePropsTyped<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>
  >,
) => {
  return (
    <div className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25 flex items-center justify-center">
      <span className="text-sm text-gray-400">Subflow Instance</span>
    </div>
  );
};
