import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import { WrapperHandles } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

// --- LOGIC: Node Definition ---
export const rerouteNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`reroute`),
  getComponent: () => ({
    Component: NodeStandardContainer(RerouteComponent),
  }),
  defaultSize: { width: 16, height: 24 },
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`value`),
      type: WorkflowBrandedTypes.valueType(`T`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`value`),
      type: WorkflowBrandedTypes.valueType(`T`),
    },
  ],
  execute: async ({ inputs }) => {
    const inputsTyped = inputs as {
      value: undefined | unknown;
    };

    return {
      outputs: { value: inputsTyped.value },
    };
  },
  generateCode: ({ inputNames }) => {
    return {
      kind: 'passthrough',
      typescript: `${inputNames[WorkflowBrandedTypes.inputName(`value`)]}`,
    };
  },
};

export const RerouteComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { value: string },
    { value: Record<string, unknown> }
  >,
) => {
  return (
    <>
      <div className="w-4 h-6 flex flex-row items-center">
        <div className="flex-1 h-2 bg-gray-400/25"></div>
      </div>
      <WrapperHandles {...props} />
    </>
  );
};
