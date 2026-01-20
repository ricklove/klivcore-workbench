import { createLlmNodes } from './llm-generic';

export const zenNodes = createLlmNodes({
  name: 'Zen',
  typeSuffix: 'zen',
  // using vite proxy to avoid CORS issues
  defaultUrl: '/zen-api/chat/completions',
  // defaultUrl: 'https://opencode.ai/zen/v1/chat/completions',
  defaultModel: 'big-pickle',

  authKind: 'bearer',

  transformRequest: ({ prompt, model, stream }) => ({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream,
    temperature: 0.7,
  }),

  parseStreamChunk: (chunkRaw: string) => {
    const chunkResult = parseOpenAIStreamChunk(chunkRaw);
    if (chunkResult.done) {
      return { done: true };
    }

    const chunk = chunkResult.data;
    console.log('[zenNodes:parseStreamChunk] zen stream chunk', { chunk });

    const choice = chunk.choices[0];
    return {
      response: choice?.delta?.content,
      done: choice?.finish_reason === 'stop',
      error: chunk.error,
    };
  },
});

// OpenAI-compatible streaming response types
interface OpenAIStreamDelta {
  content?: string;
}

interface OpenAIStreamChoice {
  delta: OpenAIStreamDelta;
  finish_reason?: 'stop' | 'length' | null;
}

interface OpenAIStreamChunk {
  choices: OpenAIStreamChoice[];
  error?: string;
}

export const parseOpenAIStreamChunk = (
  chunk: string,
): { data: OpenAIStreamChunk; done: undefined } | { done: true } => {
  // sample chunk: data: {"id":"202601201012272d050670fdfb4755","created":1768875147,"object":"chat.completion.chunk","model":"glm-4.6","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":".\""}}]}
  // sample chunk: data: [DONE]
  // data: {"id":"202601201023337549e8e30c944322","created":1768875813,"object":"chat.completion.chunk","model":"glm-4.6","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":" feeling"}}]}

  const chunkDataText = chunk
    .trim()
    .replace(/^data:\s*/, '')
    .trim();
  if (chunkDataText === '[DONE]') {
    return { done: true };
  }

  try {
    const parsed = JSON.parse(chunkDataText) as OpenAIStreamChunk;
    if (
      !(
        parsed &&
        typeof parsed === 'object' &&
        'choices' in parsed &&
        Array.isArray((parsed as { choices: unknown }).choices)
      )
    ) {
      throw new Error('Invalid OpenAI stream chunk format');
    }
    return { data: parsed, done: undefined };
  } catch (err) {
    console.error('[parseOpenAIStreamChunk] error parsing chunk', { chunk, err });
    throw err;
  }
};
