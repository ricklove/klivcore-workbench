import { createLlmNodes } from './llm-generic';

export const zenNodes = createLlmNodes({
  name: 'Zen',
  typeSuffix: 'zen',
  defaultUrl: 'https://opencode.ai/zen/v1/chat/completions',
  defaultModel: 'big-pickle',
});
