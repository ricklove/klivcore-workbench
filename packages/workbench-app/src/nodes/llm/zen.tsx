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

    const usage = !chunk.usage
      ? undefined
      : {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
          totalTokens: chunk.usage.total_tokens ?? 0,
        };

    if (usage) {
      console.log('[zenNodes:parseStreamChunk] zen stream chunk usage', { chunk, usage });
    }

    const choice = chunk.choices[0];
    return {
      content: choice?.delta?.content,
      thought: choice?.delta?.reasoning_content,
      done: choice?.finish_reason === 'stop',
      usage,
      error: chunk.error,
    };
  },
});

// OpenAI-compatible streaming response types
interface OpenAIStreamDelta {
  content?: string;
  reasoning_content?: string;
}

interface OpenAIStreamChoice {
  delta: OpenAIStreamDelta;
  finish_reason?: 'stop' | 'length' | null;
}

interface OpenAIStreamChunk {
  choices: OpenAIStreamChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details: {
      text_tokens: number;
      audio_tokens: number;
      image_tokens: number;
      cached_tokens: number;
    };
    completion_tokens_details: {
      reasoning_tokens: number;
      audio_tokens: number;
      accepted_prediction_tokens: number;
      rejected_prediction_tokens: number;
    };
    num_sources_used: number;
    cost_in_usd_ticks: number;
  };
  // system_fingerprint?: string;
  error?: string;
}

// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// const testSample: OpenAIStreamChunk = {
//   // id: '77bb004e-8f47-6a47-5fed-bef260ce8c54',
//   // object: 'chat.completion.chunk',
//   // created: 1768888354,
//   // model: 'grok-code',
//   choices: [],
//   usage: {
//     prompt_tokens: 4812,
//     completion_tokens: 4624,
//     total_tokens: 10388,
//     prompt_tokens_details: {
//       text_tokens: 4812,
//       audio_tokens: 0,
//       image_tokens: 0,
//       cached_tokens: 192,
//     },
//     completion_tokens_details: {
//       reasoning_tokens: 952,
//       audio_tokens: 0,
//       accepted_prediction_tokens: 0,
//       rejected_prediction_tokens: 0,
//     },
//     num_sources_used: 0,
//     cost_in_usd_ticks: 0,
//   },
//   // system_fingerprint: 'fp_c85e32c255',
// };

export const parseOpenAIStreamChunk = (
  chunk: string,
):
  | { data: OpenAIStreamChunk; done: undefined; usage?: OpenAIStreamChunk['usage'] }
  | { done: true } => {
  // data: {"id":"202601201012272d050670fdfb4755","created":1768875147,"object":"chat.completion.chunk","model":"glm-4.6","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":".\""}}]}
  // data: [DONE]
  // data: {"id":"202601201023337549e8e30c944322","created":1768875813,"object":"chat.completion.chunk","model":"glm-4.6","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":" feeling"}}]}
  // data: {"id":"62eefc90-7f8b-365e-4ca4-9a0ce13a119a","object":"chat.completion.chunk","created":1768885157,"model":"grok-code","choices":[],"usage":{"prompt_tokens":740,"completion_tokens":308,"total_tokens":3613,"prompt_tokens_details":{"text_tokens":740,"audio_tokens":0,"image_tokens":0,"cached_tokens":704},"completion_tokens_details":{"reasoning_tokens":2565,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0},"num_sources_used":0,"cost_in_usd_ticks":0},"system_fingerprint":"fp_c85e32c255"}
  // data: {"id":"77bb004e-8f47-6a47-5fed-bef260ce8c54","object":"chat.completion.chunk","created":1768888354,"model":"grok-code","choices":[{"index":0,"delta":{"content":"```"}}],"system_fingerprint":"fp_c85e32c255"}
  // data: {"id":"77bb004e-8f47-6a47-5fed-bef260ce8c54","object":"chat.completion.chunk","created":1768888354,"model":"grok-code","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"system_fingerprint":"fp_c85e32c255"}
  // data: {"id":"77bb004e-8f47-6a47-5fed-bef260ce8c54","object":"chat.completion.chunk","created":1768888354,"model":"grok-code","choices":[],"usage":{"prompt_tokens":4812,"completion_tokens":4624,"total_tokens":10388,"prompt_tokens_details":{"text_tokens":4812,"audio_tokens":0,"image_tokens":0,"cached_tokens":192},"completion_tokens_details":{"reasoning_tokens":952,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0},"num_sources_used":0,"cost_in_usd_ticks":0},"system_fingerprint":"fp_c85e32c255"}
  // data: [DONE]
  const chunkDataText = chunk
    .trim()
    .replace(/^data:\s*/, '')
    .trim();
  if (chunkDataText === '[DONE]') {
    return { done: true };
  }

  try {
    const parsed = JSON.parse(chunkDataText) as OpenAIStreamChunk;
    if (!(parsed && typeof parsed === 'object' && 'choices' in parsed)) {
      throw new Error('Invalid OpenAI stream chunk format');
    }
    return { data: parsed, done: undefined };
  } catch (err) {
    console.error('[parseOpenAIStreamChunk] error parsing chunk', { chunk, err });
    throw err;
  }
};
