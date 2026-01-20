import { createLlmRequestNodes } from './llm-request';

export const ollamaNodes = createLlmRequestNodes({
  name: 'Ollama',
  typeSuffix: 'ollama',
  defaultUrl: 'http://localhost:11434',
  defaultModel: 'llama3.1',
});
