import { ollamaNodes } from './ollama';
import { zenNodes } from './zen';
import { type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';

export const llmNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  ...Object.fromEntries(ollamaNodes.map((nt) => [nt.type, nt])),
  ...Object.fromEntries(zenNodes.map((nt) => [nt.type, nt])),
};
