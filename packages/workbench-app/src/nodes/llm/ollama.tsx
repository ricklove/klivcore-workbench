import { createLlmNodes } from './llm-generic';

export const ollamaNodes = createLlmNodes({
  name: 'Ollama',
  typeSuffix: 'ollama',
  defaultUrl: 'http://localhost:11434/api/generate',
  defaultModel: 'llama3.1',

  parseStreamChunk: (chunkRaw: string) => {
    const chunkResult = JSON.parse(chunkRaw) as LlmStreamChunk;
    return {
      content: chunkResult.response,
      thought: undefined,
      error: chunkResult.error,
      done: chunkResult.done,
      usage: !chunkResult.eval_count
        ? undefined
        : {
            inputTokens: chunkResult.prompt_eval_count ?? 0,
            outputTokens: chunkResult.eval_count ?? 0,
            totalTokens: (chunkResult.prompt_eval_count ?? 0) + (chunkResult.eval_count ?? 0),
          },
    };
  },
});

interface LlmStreamChunk {
  response?: string;
  done?: boolean;
  model?: string;
  created_at?: string;
  error?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}
