import { createLlmNodes } from './llm-generic';

export const ollamaNodes = createLlmNodes({
  name: 'Ollama',
  typeSuffix: 'ollama',
  defaultUrl: 'http://localhost:11434',
  defaultModel: 'llama3.1',
});
