import { memo } from 'react';
import type { WorkflowComponentPropsAny_Ops, WorkflowComponentProps } from './types';
import { ErrorBoundary } from './error-boundary';
import { useValue } from '@legendapp/state/react';

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
        <InnerComponent {...props} data={{ ...props.data, data$: props.data.getData() }} />
      </ErrorBoundary>
    );
  });
};
