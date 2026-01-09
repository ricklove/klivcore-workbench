import { memo } from 'react';
import type { WorkflowComponentProps, WorkflowComponentPropsAny } from './types';

export const NodeTypeWrapComponent = (
  InnerComponent: React.ComponentType<WorkflowComponentPropsAny>,
): React.ComponentType<WorkflowComponentProps> => {
  return memo((props) => <InnerComponent {...props} />);
};
