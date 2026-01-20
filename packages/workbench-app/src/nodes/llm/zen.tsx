import { createLlmNodes, isOpenAIStreamChunk } from './llm-generic';

export const zenNodes = createLlmNodes({
  name: 'Zen',
  typeSuffix: 'zen',
  defaultUrl: 'https://opencode.ai/zen/v1/chat/completions',
  defaultModel: 'big-pickle',

  authKind: 'bearer',

  transformRequest: ({ prompt, model, stream }) => ({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream,
    temperature: 0.7,
  }),

  parseStreamChunk: (chunk: unknown) => {
    if (!isOpenAIStreamChunk(chunk)) {
      return { error: 'Invalid stream chunk format' };
    }

    const choice = chunk.choices[0];
    return {
      response: choice?.delta?.content,
      done: choice?.finish_reason === 'stop',
      error: chunk.error,
    };
  },
});
