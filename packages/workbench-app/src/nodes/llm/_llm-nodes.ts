import { ollamaNodes } from './ollama';
import { type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';

export const llmNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  ...Object.fromEntries(ollamaNodes.map((nt) => [nt.type, nt])),
};
