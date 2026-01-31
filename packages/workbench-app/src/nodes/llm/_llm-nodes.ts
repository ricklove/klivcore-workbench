import type { WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import { ollamaNodes } from './ollama';
import { zenNodes } from './zen';

export const llmNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  ...Object.fromEntries(ollamaNodes.map((nt) => [nt.type, nt])),
  ...Object.fromEntries(zenNodes.map((nt) => [nt.type, nt])),
};
