import { useValue } from '@legendapp/state/react';
import { useMemo } from 'react';
import {
  EmptyNodeComponent,
  NodeStandardContainer,
} from '../../workflow/node-types-wrapper';
import { WrapperHandles } from '../../workflow/node-wrapper';
import { getReactFlowNodeDataProp } from '../../workflow/store-fast/react-flow-node-data-prop';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps,
  type WorkflowJsonObject,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

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
  execute: async () => {
    // const inputSlot = node.inputs[0]?.getEdge()?.source.getNode();

    // const inputValue = inputSlot.isConnected ? inputSlot.getValue() : undefined;
    // const dataValue = (node.data as undefined | { value?: unknown })?.value;
    // const value = inputValue ?? dataValue;

    return undefined;
  },
  generateCode: () => {
    return { kind: `none` };
  },
};

// eslint-disable-next-line react-refresh/only-export-components
const CloneComponent = (props: WorkflowComponentProps) => {
  const { nodeId, targetNode, targetNodeType } = useValue(() => {
    const nodeId = props.data.node$.id.get();
    const targetNode = props.data.node$.inputs[0]?.getEdge()?.source.getNode();
    const targetNodeType = !targetNode
      ? undefined
      : props.data.store$.nodeTypes[targetNode.type]?.get();
    return { nodeId, targetNode, targetNodeType };
  });

  const TargetComponent = useMemo(
    () => targetNodeType?.getComponent?.(),
    [targetNodeType],
  );

  if (!nodeId || !targetNode || !TargetComponent) {
    const DefaultComponent = NodeStandardContainer(EmptyNodeComponent);
    return <DefaultComponent {...props} />;
  }

  return (
    <>
      <TargetComponent.Component
        {...props}
        hideHandles={true}
        data={(() => {
          const nodeObservable = props.data.store$.nodes[targetNode.id];
          if (!nodeObservable) {
            throw new Error(`Node with id ${targetNode.id} not found`);
          }
          return getReactFlowNodeDataProp(
            props.data.store$,
            nodeObservable,
          ) as unknown as WorkflowComponentProps<
            WorkflowJsonObject,
            WorkflowJsonObject,
            WorkflowJsonObject
          >['data'];
        })()}
      />
      <WrapperHandles
        selected={props.selected}
        data={{ node$: props.data.node$ }}
      />
    </>
  );
};
