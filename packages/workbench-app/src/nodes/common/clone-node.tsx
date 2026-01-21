import { useMemo } from 'react';
import { getReactFlowNodeDataProp } from '../../workflow/store-fast/react-flow-node-data-prop';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps,
  type WorkflowJsonObject,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { useValue } from '@legendapp/state/react';

export const cloneNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`clone`),
  getComponent: () => ({
    Component: CloneComponent,
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`clone`),
      type: WorkflowBrandedTypes.valueType(`unknown`),
    },
  ],
  outputs: [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async ({ node }) => {
    // const inputSlot = node.inputs[0]?.getEdge()?.source.getNode();

    // const inputValue = inputSlot.isConnected ? inputSlot.getValue() : undefined;
    // const dataValue = (node.data as undefined | { value?: unknown })?.value;
    // const value = inputValue ?? dataValue;
    return undefined;
  },
};

// eslint-disable-next-line react-refresh/only-export-components
const CloneComponent = (props: WorkflowComponentProps) => {
  const nodeId = useValue(props.data.node$.id.get());
  const targetNode = useValue(() => props.data.node$.inputs[0]?.getEdge()?.source.getNode());
  const targetNodeType = useValue(() =>
    !targetNode ? undefined : props.data.store$.nodeTypes[targetNode.type]?.get(),
  );
  const TargetComponent = useMemo(() => targetNodeType?.getComponent?.(), [targetNodeType]);

  if (!nodeId || !targetNode || !TargetComponent) {
    return (
      <div className="w-full h-full p-1 whitespace-pre-wrap bg-red-400 text-white rounded">
        {`Error: Node not found`}
      </div>
    );
  }

  return (
    <TargetComponent.Component
      {...props}
      data={
        getReactFlowNodeDataProp(
          props.data.store$,
          props.data.store$.nodes[targetNode.id]!,
        ) as unknown as WorkflowComponentProps<
          WorkflowJsonObject,
          WorkflowJsonObject,
          WorkflowJsonObject
        >['data']
      }
    />
  );
};
