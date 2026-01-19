/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { useValue } from '@legendapp/state/react';
import { clsx } from '../../utils/clsx';

// --- TYPE DEFINITIONS ---

type OllamaData = {
  ollamaUrl: string;
  model: string;
};

interface OllamaInputs {
  prompt: string;
  model?: string;
  ollamaUrl?: string;
}

interface OllamaOutputs {
  chunk: OllamaStreamChunk;
  thought: undefined | string;
  response: undefined | string;
  done: boolean;
  error: undefined | string;
  status: 'idle' | 'connecting' | 'thinking' | 'streaming' | 'error' | 'completed';
}

interface OllamaStreamChunk {
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

// --- LOGIC: Node Definition ---

export const ollamaStreamingNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName('ollamaStreaming'),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(OllamaStreamingComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName('prompt'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
    {
      name: WorkflowBrandedTypes.inputName('model'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
    {
      name: WorkflowBrandedTypes.inputName('ollamaUrl'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName('chunk'),
      type: WorkflowBrandedTypes.valueType('OllamaStreamChunk'),
    },
    {
      name: WorkflowBrandedTypes.outputName('thought'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
    {
      name: WorkflowBrandedTypes.outputName('response'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
    {
      name: WorkflowBrandedTypes.outputName('done'),
      type: WorkflowBrandedTypes.valueType('boolean'),
    },
    {
      name: WorkflowBrandedTypes.outputName('error'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
    {
      name: WorkflowBrandedTypes.outputName('status'),
      type: WorkflowBrandedTypes.valueType('string'),
    },
  ],
  execute: async ({ inputs, data, controller }) => {
    const safeData = (data as unknown as OllamaData) ?? {
      ollamaUrl: 'http://localhost:11434',
      model: 'llama3.1',
    };

    const promptInput = inputs.prompt as string | undefined;
    const modelInput = inputs.model as string | undefined;
    const ollamaUrlInput = inputs.ollamaUrl as string | undefined;

    const prompt = promptInput ?? '';
    const model = modelInput ?? safeData.model ?? 'llama3.1';
    const ollamaUrl = ollamaUrlInput ?? safeData.ollamaUrl ?? 'http://localhost:11434';

    if (!prompt.trim()) {
      return {
        outputs: {
          chunk: { error: 'Prompt is required' },
          response: undefined,
          done: false,
          error: 'Prompt is required',
          status: 'error',
        },
      };
    }

    let cumulativeThought = '';
    let cumulativeResponse = '';
    let thoughtClosed = false;

    const processStream = async (emit: (output: OllamaOutputs) => void): Promise<void> => {
      let reader: undefined | ReadableStreamDefaultReader<Uint8Array>;

      try {
        controller.setProgress({ progressRatio: 0.1, message: 'Connecting to Ollama...' });
        emit({
          chunk: {},
          thought: undefined,
          response: undefined,
          done: false,
          error: undefined,
          status: 'connecting',
        });

        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt,
            stream: true,
          }),
          signal: controller.abortSignal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
          throw new Error('Response body is missing');
        }

        controller.setProgress({ progressRatio: 0.3, message: 'Starting stream...' });
        emit({
          chunk: {},
          thought: undefined,
          response: undefined,
          done: false,
          error: undefined,
          status: 'thinking',
        });

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let chunkCount = 0;

        const THINK_CLOSE_TAGS = ['</thinking>', '</think>', '</thought>'];

        while (true) {
          const { done, value } = await reader.read();
          if (controller.abortSignal.aborted) {
            throw new Error('Request was aborted');
          }

          if (done) {
            // If thought was never closed, copy everything to response
            if (!thoughtClosed) {
              cumulativeResponse = cumulativeThought;
              cumulativeThought = '';
            }

            controller.setProgress({ progressRatio: 1.0, message: 'Response complete' });
            emit({
              chunk: { done: true },
              thought: cumulativeThought || undefined,
              response: cumulativeResponse || undefined,
              done: true,
              error: undefined,
              status: 'completed',
            });
            return;
          }

          const chunkText = decoder.decode(value, { stream: true });
          buffer += chunkText;

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
              const parsedChunk: OllamaStreamChunk = JSON.parse(trimmedLine);

              if (parsedChunk.response) {
                // Always add to cumulative thought initially
                cumulativeThought += parsedChunk.response;

                // Check if this is the first time we're finding the closing tag
                const foundCloseThoughtTag = thoughtClosed
                  ? undefined
                  : THINK_CLOSE_TAGS.find((tag) => cumulativeThought.includes(tag))!;

                if (foundCloseThoughtTag) {
                  // Find the first closing tag that appears
                  const splitIndex = cumulativeThought.indexOf(foundCloseThoughtTag);
                  const thoughtContent = cumulativeThought.substring(0, splitIndex);
                  const responseContent = cumulativeThought.substring(
                    splitIndex + foundCloseThoughtTag.length,
                  );

                  // Update cumulative variables
                  cumulativeThought = thoughtContent;
                  cumulativeResponse = responseContent;
                  thoughtClosed = true;
                }
                // If thought is already closed, add to response
                else if (thoughtClosed) {
                  cumulativeResponse += parsedChunk.response;
                }
              }

              chunkCount++;
              const progressRatio = Math.min(0.3 + chunkCount * 0.05, 0.9);
              const currentStatus = thoughtClosed ? 'streaming' : 'thinking';
              controller.setProgress({
                progressRatio,
                message: `${currentStatus === 'thinking' ? 'Thinking' : 'Streaming'}... (${chunkCount} chunks)`,
              });

              emit({
                chunk: parsedChunk,
                thought: cumulativeThought || undefined,
                response: cumulativeResponse || undefined,
                done: parsedChunk.done ?? false,
                error: parsedChunk.error,
                status: currentStatus,
              });

              if (parsedChunk.done) {
                // If thought was never closed, copy everything to response
                if (!thoughtClosed) {
                  cumulativeResponse = cumulativeThought;
                  cumulativeThought = '';
                }

                controller.setProgress({ progressRatio: 1.0, message: 'Response complete' });
                emit({
                  chunk: parsedChunk,
                  thought: cumulativeThought || undefined,
                  response: cumulativeResponse || undefined,
                  done: true,
                  error: undefined,
                  status: 'completed',
                });
                return;
              }
            } catch (parseError) {
              controller.setProgress({ progressRatio: 0.0, message: 'Error parsing response' });
              emit({
                chunk: {
                  error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                },
                thought: undefined,
                response: undefined,
                done: false,
                error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                status: 'error',
              });
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        controller.setProgress({ progressRatio: 0.0, message: `Error: ${errorMessage}` });

        emit({
          chunk: { error: errorMessage },
          thought: undefined,
          response: undefined,
          done: false,
          error: errorMessage,
          status: 'error',
        });
      }
    };

    await new Promise<void>((resolve, reject) => {
      controller.registerEvent((emit) => {
        processStream(emit as () => void)
          .then(resolve)
          .catch(reject);
        return {
          unsubscribe: () => {},
        };
      });
    });

    // Final processing for the return statement
    if (!thoughtClosed && cumulativeThought) {
      cumulativeResponse = cumulativeThought;
      cumulativeThought = '';
    }

    return {
      outputs: {
        chunk: null,
        thought: cumulativeThought || undefined,
        response: cumulativeResponse || undefined,
        done: true,
        error: null,
        status: 'success',
      },
    };
  },
};

// --- COMPONENTS ---

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readonly: boolean;
  placeholder?: string;
  type?: 'text' | 'url';
}

const InputField = ({
  label,
  value,
  onChange,
  readonly,
  placeholder,
  type = 'text',
}: InputFieldProps) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
      {label}
    </label>
    <input
      type={type}
      className={clsx(
        'w-full bg-black/25 text-white text-xs px-2 py-1 rounded outline-none border border-transparent transition-colors',
        readonly
          ? 'bg-neutral-800/25 border-neutral-700 cursor-not-allowed'
          : 'hover:border-neutral-600',
      )}
      value={value}
      onChange={(e) => !readonly && onChange(e.target.value)}
      readOnly={readonly}
      placeholder={placeholder}
      title={readonly ? 'Controlled by input connection' : `Enter ${label.toLowerCase()}`}
    />
  </div>
);

export const OllamaStreamingComponent = (
  props: WorkflowComponentProps_Obs<OllamaData, OllamaInputs, OllamaOutputs>,
) => {
  const { node$, data$ } = props.data;

  const ollamaUrlData = useValue(() => data$.ollamaUrl.get() ?? 'http://localhost:11434');
  const modelData = useValue(() => data$.model.get() ?? 'llama3.1');

  const modelSlot = useValue(() => node$.getInputInfo<string>('model'));
  const ollamaUrlSlot = useValue(() => node$.getInputInfo<string>('ollamaUrl'));

  const isModelReadonly = modelSlot.isConnected;
  const isOllamaUrlReadonly = ollamaUrlSlot.isConnected;

  const currentStatus = useValue(() => props.data.outputs$.status.get() ?? 'idle');
  const currentThought = useValue(() => props.data.outputs$.thought.get() ?? '');
  const currentResponse = useValue(() => props.data.outputs$.response.get() ?? '');
  const currentError = useValue(() => props.data.outputs$.error.get());

  const [localOllamaUrl, setLocalOllamaUrl] = useState(ollamaUrlData);
  const [localModel, setLocalModel] = useState(modelData);
  const [thoughtCollapsed, setThoughtCollapsed] = useState(false);

  useEffect(() => {
    data$.ollamaUrl.set(localOllamaUrl);
  }, [localOllamaUrl, data$]);

  useEffect(() => {
    data$.model.set(localModel);
  }, [localModel, data$]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connecting':
        return 'text-yellow-500';
      case 'thinking':
        return 'text-purple-500';
      case 'streaming':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'thinking':
        return 'Thinking...';
      case 'streaming':
        return 'Streaming';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  return (
    <WorkflowNodeWrapperSimple {...props}>
      <div className="w-full h-full bg-neutral-950 p-3 rounded-md shadow-sm flex flex-col gap-3 nowheel nodrag nopan">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <div className="text-xs font-bold text-white">Ollama Streaming</div>
          <div className={clsx('text-xs font-medium', getStatusColor(currentStatus))}>
            {getStatusText(currentStatus)}
          </div>
        </div>

        {/* Configuration */}
        <div className="flex flex-col gap-2">
          <InputField
            label="Ollama URL"
            value={localOllamaUrl}
            onChange={setLocalOllamaUrl}
            readonly={isOllamaUrlReadonly}
            placeholder="http://localhost:11434"
            type="url"
          />

          <InputField
            label="Model"
            value={localModel}
            onChange={setLocalModel}
            readonly={isModelReadonly}
            placeholder="llama3.1"
          />
        </div>

        {/* Content Sections */}
        <div className="flex flex-col gap-2 flex-1 border-t border-neutral-800 pt-2">
          {/* Thought Preview */}
          {currentThought && (
            <div className={`flex flex-col gap-1 ${thoughtCollapsed ? '' : 'flex-1'}`}>
              <button
                onClick={() => setThoughtCollapsed(!thoughtCollapsed)}
                className="flex items-center justify-between text-[10px] font-bold text-purple-400 uppercase tracking-wider hover:text-purple-300 transition-colors cursor-pointer"
              >
                <span>Thought Process</span>
                <span className="text-purple-400">{thoughtCollapsed ? '▶' : '▼'}</span>
              </button>
              {!thoughtCollapsed && (
                <div className="bg-black/25 border border-purple-800/50 rounded p-2 flex-1 overflow-y-auto min-h-[60px]">
                  <div className="text-purple-400 text-xs font-mono whitespace-pre-wrap">
                    {currentThought}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Response Preview */}
          <div className="flex flex-col gap-1 flex-1">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Response Preview
            </div>
            <div className="bg-black/25 border border-neutral-800 rounded p-2 flex-1 overflow-y-auto min-h-[60px]">
              {currentError ? (
                <div className="text-red-500 text-xs whitespace-pre-wrap">{currentError}</div>
              ) : (
                <div className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                  {currentResponse || 'No response yet...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </WorkflowNodeWrapperSimple>
  );
};

export const ollamaNodeTypes = [ollamaStreamingNodeType];
