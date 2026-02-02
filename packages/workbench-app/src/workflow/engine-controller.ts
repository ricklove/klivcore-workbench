import { observable } from '@legendapp/state';
import type { WorkflowRuntimeEngine } from './types';

export const engineController$ = observable<
  Pick<WorkflowRuntimeEngine, 'running' | 'tickSpeed'>
>({
  running: false,
  tickSpeed: 1000,
});
