import { memo } from 'react';
import type { WorkflowComponentProps } from './types';

export const NodeTypeWrapComponent = (
  InnerComponent: React.ComponentType<WorkflowComponentProps>,
): React.ComponentType<WorkflowComponentProps> => {
  return memo((props) => <InnerComponent {...props} />);
};
