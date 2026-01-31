import { useValue } from '@legendapp/state/react';
import { memo } from 'react';
import { ErrorBoundary } from './error-boundary';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import type {
  WorkflowComponentProps,
  WorkflowComponentPropsAny_Ops,
} from './types';

export const EmptyNodeComponent = () => (
  <>
    <div className="bg-gray-950/25 w-full h-full"></div>
  </>
);

export const NodeTypeWrapComponent = (
  InnerComponent: React.ComponentType<WorkflowComponentPropsAny_Ops>,
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

    return (
      <ErrorBoundary message={`Error rendering Component`}>
        <InnerComponent
          {...props}
          data={{
            node$: props.data.node$,
            store$: props.data.store$,
            ...props.data.getValues(),
          }}
        />
      </ErrorBoundary>
    );
  });
};

export const NodeTypeWrapComponentWithNodeWrapper = (
  InnerComponent: React.ComponentType<WorkflowComponentPropsAny_Ops>,
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

    const data = {
      node$: props.data.node$,
      store$: props.data.store$,
      ...props.data.getValues(),
    };

    return (
      <WorkflowNodeWrapperSimple {...props} data={data}>
        <ErrorBoundary message={`Error rendering Component`}>
          <InnerComponent {...props} data={data} />
        </ErrorBoundary>
      </WorkflowNodeWrapperSimple>
    );
  });
};

export const NodeStandardContainer = (
  InnerComponent: React.ComponentType<WorkflowComponentPropsAny_Ops>,
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

    const data = {
      node$: props.data.node$,
      store$: props.data.store$,
      ...props.data.getValues(),
    };

    return (
      <WorkflowNodeWrapperSimple {...props} data={data}>
        <ErrorBoundary message={`Error rendering Component`}>
          <InnerComponent {...props} data={data} />
        </ErrorBoundary>
      </WorkflowNodeWrapperSimple>
    );
  });
};
