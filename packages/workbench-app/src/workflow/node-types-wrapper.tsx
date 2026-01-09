import { memo } from 'react';
import type { WorkflowComponentProps, WorkflowComponentPropsAny } from './types';
import { ErrorBoundary } from './error-boundary';
import { useValue } from '@legendapp/state/react';

export const NodeTypeWrapComponent = (
  InnerComponent: React.ComponentType<WorkflowComponentPropsAny>,
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
        <InnerComponent {...props} />
      </ErrorBoundary>
    );
  });
};
