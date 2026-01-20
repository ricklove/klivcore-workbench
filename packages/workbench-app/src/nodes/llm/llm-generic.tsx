/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowComponentPropsAny_Ops,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { useValue } from '@legendapp/state/react';
import { clsx } from '../../utils/clsx';

// --- CONFIGURATION TYPE ---

interface LlmConfig {
  name: string;
  typeSuffix: string;
  defaultUrl: string;
  defaultModel: string;
  authKind?: 'bearer';
  transformRequest?: (config: {
    prompt: string;
    model: string;
    stream: boolean;
  }) => Record<string, unknown>;
  parseStreamChunk: (chunk: string) => {
    content?: string;
    thought?: string;
    done?: boolean;
    error?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
}

// --- TYPE DEFINITIONS ---

type LlmData = {
  url: string;
  model: string;
  apiKey?: string;
};

interface LlmSettings {
  model: string;
  url: string;
  apiKey?: string;
}

interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface LlmInputs {
  prompt: string;
  model?: string;
  url?: string;
  apiKey?: string;
  settings?: LlmSettings;
}

interface LlmOutputs {
  chunk: string | undefined;
  thought: undefined | string;
  response: undefined | string;
  done: boolean;
  error: undefined | string;
  status: 'idle' | 'connecting' | 'thinking' | 'streaming' | 'error' | 'completed';
  settings: LlmSettings;
  usage: undefined | LlmUsage;
  raw: string | undefined;
}

// --- COMPONENTS ---

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readonly: boolean;
  placeholder?: string;
  type?: 'text' | 'url' | 'password';
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

// --- NODE TYPE FACTORY ---

export const createLlmRequestNodeType = (
  config: LlmConfig,
  ConfiguredComponent: React.ComponentType<WorkflowComponentPropsAny_Ops>,
): WorkflowRuntimeNodeTypeDefinition => {
  return {
    type: WorkflowBrandedTypes.typeName(`${config.typeSuffix}LlmRequest`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(ConfiguredComponent),
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
        name: WorkflowBrandedTypes.inputName('url'),
        type: WorkflowBrandedTypes.valueType('string'),
      },
      {
        name: WorkflowBrandedTypes.inputName('apiKey'),
        type: WorkflowBrandedTypes.valueType('string'),
      },
      {
        name: WorkflowBrandedTypes.inputName('settings'),
        type: WorkflowBrandedTypes.valueType('LlmSettings'),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName('chunk'),
        type: WorkflowBrandedTypes.valueType('string'),
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
      {
        name: WorkflowBrandedTypes.outputName('settings'),
        type: WorkflowBrandedTypes.valueType('LlmSettings'),
      },
      {
        name: WorkflowBrandedTypes.outputName('usage'),
        type: WorkflowBrandedTypes.valueType('LlmUsage'),
      },
      {
        name: WorkflowBrandedTypes.outputName('raw'),
        type: WorkflowBrandedTypes.valueType('string'),
      },
    ],
    execute: async ({ inputs, data, controller }) => {
      const safeData = (data as unknown as LlmData) ?? {
        url: config.defaultUrl,
        model: config.defaultModel,
      };

      const promptInput = inputs.prompt as string | undefined;
      const modelInput = inputs.model as string | undefined;
      const urlInput = inputs.url as string | undefined;
      const apiKeyInput = inputs.apiKey as string | undefined;
      const settingsInput = inputs.settings as LlmSettings | undefined;

      const prompt = promptInput ?? '';
      // Priority: settingsInput > individual inputs > data > defaults
      const model = settingsInput?.model ?? modelInput ?? safeData.model ?? config.defaultModel;
      const url = settingsInput?.url ?? urlInput ?? safeData.url ?? config.defaultUrl;
      const apiKey = settingsInput?.apiKey ?? apiKeyInput ?? safeData.apiKey;

      const resolvedSettings: LlmSettings = { model, url, apiKey };

      if (!prompt.trim()) {
        return;
      }

      type PartialNull<T> = {
        [P in keyof T]?: T[P] | null;
      };

      let cumulativeRaw = '';
      let cumulativeThought = '';
      let cumulativeResponse = '';
      let thoughtClosed = false;

      const processStream = async (
        emit: (output: Omit<PartialNull<LlmOutputs>, `settings`>) => void,
      ): Promise<void> => {
        let reader: undefined | ReadableStreamDefaultReader<Uint8Array>;

        try {
          controller.setProgress({
            progressRatio: 0.1,
            message: `Connecting to ${config.name}...`,
          });
          emit({
            chunk: null,
            thought: null,
            response: null,
            done: false,
            error: null,
            status: 'connecting',
            usage: null,
          });

          // Build headers
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };

          if (config.authKind === 'bearer' && apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }

          // Build request body
          let requestBody: Record<string, unknown>;
          if (config.transformRequest) {
            requestBody = config.transformRequest({ prompt, model, stream: true });
          } else {
            requestBody = {
              model,
              prompt,
              stream: true,
            };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
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
            status: 'thinking',
          });

          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let chunkCount = 0;

          const THINK_CLOSE_TAGS = ['</thinking>', '</thought>'];

          while (true) {
            const { done: doneStream, value } = await reader.read();
            if (controller.abortSignal.aborted) {
              throw new Error('Request was aborted');
            }

            const chunkText = decoder.decode(value, { stream: true });
            cumulativeRaw += chunkText;
            emit({ raw: cumulativeRaw });

            buffer += chunkText;

            const lines = buffer.split('\n');
            buffer = doneStream ? `` : (lines.pop() ?? '');

            let doneChunk = false;

            const processLine = (line: string) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return;

              try {
                console.log('[llm-generic] stream chunk line', { trimmedLine, chunkText });
                const rawChunk = trimmedLine;

                const parsedChunk = config.parseStreamChunk(rawChunk);
                if (!thoughtClosed && parsedChunk.thought) {
                  // models that have dedicated thought field close immediately
                  thoughtClosed = true;
                }

                if (parsedChunk.usage) {
                  emit({
                    usage: parsedChunk.usage,
                  });
                }

                if (parsedChunk.thought) {
                  cumulativeThought += parsedChunk.thought;
                }

                if (parsedChunk.content) {
                  if (thoughtClosed) {
                    // If thought is already closed, add directly to response
                    cumulativeResponse += parsedChunk.content;
                  } else {
                    // Add to thought and check for closing tag
                    cumulativeThought += parsedChunk.content;

                    // Check if this is first time we're finding the closing tag
                    const foundCloseThoughtTag = THINK_CLOSE_TAGS.find((tag) =>
                      cumulativeThought.includes(tag),
                    );

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
                  }
                }

                chunkCount++;
                const progressRatio = Math.min(0.3 + chunkCount * 0.05, 0.9);
                const currentStatus = thoughtClosed ? 'streaming' : 'thinking';
                controller.setProgress({
                  progressRatio,
                  message: `${currentStatus === 'thinking' ? 'Thinking' : 'Responding'}... (${chunkCount} chunks)`,
                });

                emit({
                  chunk: rawChunk,
                  thought: cumulativeThought,
                  response: cumulativeResponse,
                  done: parsedChunk.done ?? false,
                  error: parsedChunk.error,
                  status: currentStatus,
                });

                if (parsedChunk.done) {
                  doneChunk = true;
                }
              } catch (parseError) {
                console.error('[llm-generic] ERROR stream chunk line', { trimmedLine, chunkText });

                controller.setProgress({ progressRatio: 0.0, message: 'Error parsing response' });
                emit({
                  error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                  status: 'error',
                });
              }
            };

            for (const line of lines) {
              processLine(line);
            }

            const isDone = (doneChunk || doneStream) && !buffer;
            if (isDone) {
              // If thought was never closed, copy everything to response
              if (!thoughtClosed) {
                cumulativeResponse = cumulativeThought;
                cumulativeThought = '';
              }

              controller.setProgress({ progressRatio: 1.0, message: 'Response complete' });
              emit({
                thought: cumulativeThought,
                response: cumulativeResponse,
                done: true,
                status: 'completed',
              });
              return;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          controller.setProgress({ progressRatio: 0.0, message: `Error: ${errorMessage}` });

          emit({
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
          thought: cumulativeThought,
          response: cumulativeResponse,
          done: true,
          status: 'success',
          settings: resolvedSettings,
          // raw: cumulativeRaw,
        },
      };
    },
  };
};

export const LlmRequestComponent = (
  props: WorkflowComponentProps_Obs<LlmData, LlmInputs, LlmOutputs> & {
    config: LlmConfig;
  },
) => {
  const { node$, data$ } = props.data;

  const urlData = useValue(() => data$.url.get() ?? props.config.defaultUrl);
  const modelData = useValue(() => data$.model.get() ?? props.config.defaultModel);
  const apiKeyData = useValue(() => data$.apiKey.get() ?? '');

  const modelSlot = useValue(() => node$.getInputInfo<string>('model'));
  const urlSlot = useValue(() => node$.getInputInfo<string>('url'));
  const apiKeySlot = useValue(() => node$.getInputInfo<string>('apiKey'));
  const settingsSlot = useValue(() => node$.getInputInfo<LlmSettings>('settings'));

  const isModelReadonly = modelSlot.isConnected || settingsSlot.isConnected;
  const isUrlReadonly = urlSlot.isConnected || settingsSlot.isConnected;
  const isApiKeyReadonly = apiKeySlot.isConnected || settingsSlot.isConnected;

  const currentStatus = useValue(() => props.data.outputs$.status.get() ?? 'idle');
  const currentThought = useValue(() => props.data.outputs$.thought.get() ?? '');
  const currentResponse = useValue(() => props.data.outputs$.response.get() ?? '');
  const currentError = useValue(() => props.data.outputs$.error.get());

  const [localUrl, setLocalUrl] = useState(urlData);
  const [localModel, setLocalModel] = useState(modelData);
  const [localApiKey, setLocalApiKey] = useState(apiKeyData);
  const [thoughtCollapsed, setThoughtCollapsed] = useState(false);

  useEffect(() => {
    data$.url.set(localUrl);
  }, [localUrl, data$]);

  useEffect(() => {
    data$.model.set(localModel);
  }, [localModel, data$]);

  useEffect(() => {
    data$.apiKey.set(localApiKey);
  }, [localApiKey, data$]);

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
          <div className="text-xs font-bold text-white">{props.config.name} LLM Request</div>
          <div className={clsx('text-xs font-medium', getStatusColor(currentStatus))}>
            {getStatusText(currentStatus)}
          </div>
        </div>

        {/* Configuration */}
        <div className="flex flex-col gap-2">
          <InputField
            label={`${props.config.name} URL`}
            value={localUrl}
            onChange={setLocalUrl}
            readonly={isUrlReadonly}
            placeholder={props.config.defaultUrl}
            type="url"
          />

          <InputField
            label="Model"
            value={localModel}
            onChange={setLocalModel}
            readonly={isModelReadonly}
            placeholder={props.config.defaultModel}
          />

          {props.config.authKind && (
            <InputField
              label="API Key"
              value={localApiKey}
              onChange={setLocalApiKey}
              readonly={isApiKeyReadonly}
              placeholder="Enter API key"
              type="password"
            />
          )}
        </div>

        {/* Content Sections */}
        <div className="flex flex-col gap-2 flex-1 border-t border-neutral-800 pt-2 overflow-hidden">
          {/* Thought Preview */}
          {currentThought && (
            <div className={`flex flex-col gap-1 ${thoughtCollapsed ? '' : 'flex-1 min-h-0'}`}>
              <button
                onClick={() => setThoughtCollapsed(!thoughtCollapsed)}
                className="flex items-center justify-between text-[10px] font-bold text-purple-400 uppercase tracking-wider hover:text-purple-300 transition-colors cursor-pointer"
              >
                <span>Thought Process</span>
                <span className="text-purple-400">{thoughtCollapsed ? '▶' : '▼'}</span>
              </button>
              {!thoughtCollapsed && (
                <div className="bg-black/25 border border-purple-800/50 rounded p-2 flex-1 overflow-y-auto">
                  <div className="text-purple-400 text-xs font-mono whitespace-pre-wrap">
                    {currentThought}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Response Preview */}
          <div className="flex flex-col gap-1 flex-1 min-h-0">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Response Preview
            </div>
            <div className="bg-black/25 border border-neutral-800 rounded p-2 flex-1 overflow-y-auto">
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

// --- MAIN FACTORY FUNCTION ---

export const createLlmNodes = (config: LlmConfig) => {
  return [
    createLlmRequestNodeType(config, (props) => <LlmRequestComponent {...props} config={config} />),
  ];
};
