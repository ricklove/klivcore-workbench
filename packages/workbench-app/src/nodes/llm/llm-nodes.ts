import { ollamaNodeTypes } from './ollama';
import { type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';

export const llmNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  ...Object.fromEntries(ollamaNodeTypes.map((nt) => [nt.type, nt])),
};
