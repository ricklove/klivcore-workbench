import { useValue } from '@legendapp/state/react';
import { memo } from 'react';
import { ErrorBoundary } from './error-boundary';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps,
  type WorkflowComponentPropsOnlyNode,
  type WorkflowComponentSimplePropsBase,
  type WorkflowRuntimeNodeTypeDefinition,
} from './types';

export const builtinNodeTypes: Record<
  string,
  WorkflowRuntimeNodeTypeDefinition
> = {
  default: {
    type: WorkflowBrandedTypes.typeName(`default`),
    getComponent: () => ({
      Component: NodeStandardContainer(WorkflowNodeDefault),
    }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
};

export const WorkflowNodeDefault = (props: WorkflowComponentPropsOnlyNode) => {
  return (
    <WorkflowNodeWrapperSimple {...props}>
      <div className="text-white">Node {props.id}</div>
    </WorkflowNodeWrapperSimple>
  );
};

export const EmptyNodeComponent = () => (
  <>
    <div className="bg-gray-950/25 w-full h-full"></div>
  </>
);

export const NodeStandardContainer = <
  TInputs extends Record<string, unknown>,
  TOutputs extends Record<string, unknown>,
  TData extends Record<string, unknown>,
>(
  InnerComponent: React.ComponentType<
    Omit<WorkflowComponentSimplePropsBase, 'data'> & {
      data: WorkflowComponentSimplePropsBase[`data`] & {
        inputs: TInputs;
        outputs: TOutputs;
        data: TData;
      };
    }
  >,
): React.ComponentType<WorkflowComponentProps> => {
  return memo((props) => {
    const node = useValue(props.data.node$.id.get());
    if (!node) {
      return (
        <div className="w-full h-full p-1 whitespace-pre-wrap bg-red-400 text-white rounded">
          {`Error: Node not found`}
        </div>
      );
    }

    const data: WorkflowComponentSimplePropsBase[`data`] = {
      node$: props.data.node$,
      store$: props.data.store$,
      ...props.data.getStandardNodeDataProp(),
    };

    return (
      <WorkflowNodeWrapperSimple {...props} data={data}>
        <ErrorBoundary message={`Error rendering Component`}>
          <InnerComponent
            {...props}
            data={
              data as WorkflowComponentSimplePropsBase[`data`] & {
                inputs: TInputs;
                outputs: TOutputs;
                data: TData;
              }
            }
          />
        </ErrorBoundary>
      </WorkflowNodeWrapperSimple>
    );
  });
};
