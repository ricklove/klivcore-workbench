/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowJsonObject,
} from '../../workflow/types';
import { useValue } from '@legendapp/state/react';
import { clsx } from '../../utils/clsx';

// --- TYPE DEFINITIONS ---

interface OllamaData extends WorkflowJsonObject {
  ollamaUrl: string;
  model: string;
}

interface OllamaInputs {
  prompt: string;
  model?: string;
  ollamaUrl?: string;
}

interface OllamaOutputs {
  chunk: OllamaStreamChunk;
  response: undefined | string;
  done: boolean;
  error: undefined | string;
  status: 'idle' | 'connecting' | 'streaming' | 'error' | 'completed';
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

    let cumulativeResponse = '';

    controller.registerEvent((emit) => {
      let reader: undefined | ReadableStreamDefaultReader<Uint8Array>;

      const processStream = async (): Promise<void> => {
        try {
          emit({
            chunk: {},
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

          emit({
            chunk: {},
            response: undefined,
            done: false,
            error: undefined,
            status: 'streaming',
          });

          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              emit({
                chunk: { done: true },
                response: cumulativeResponse,
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
                  cumulativeResponse += parsedChunk.response;
                }

                emit({
                  chunk: parsedChunk,
                  response: parsedChunk.response,
                  done: parsedChunk.done ?? false,
                  error: parsedChunk.error,
                  status: 'streaming',
                });

                if (parsedChunk.done) {
                  emit({
                    chunk: parsedChunk,
                    response: cumulativeResponse,
                    done: true,
                    error: undefined,
                    status: 'completed',
                  });
                  return;
                }
              } catch (parseError) {
                emit({
                  chunk: {
                    error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                  },
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

          emit({
            chunk: { error: errorMessage },
            response: undefined,
            done: false,
            error: errorMessage,
            status: 'error',
          });
        }
      };

      processStream();

      return {
        unsubscribe: () => {
          if (reader) {
            reader.cancel();
          }
        },
      };
    });

    return {
      outputs: {
        chunk: {},
        response: undefined,
        done: false,
        error: undefined,
        status: 'idle',
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
  const currentResponse = useValue(() => props.data.outputs$.response.get() ?? '');
  const currentError = useValue(() => props.data.outputs$.error.get());

  const [localOllamaUrl, setLocalOllamaUrl] = useState(ollamaUrlData);
  const [localModel, setLocalModel] = useState(modelData);

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
      <div className="w-full bg-neutral-950 p-3 rounded-md shadow-sm flex flex-col gap-3 nowheel nodrag nopan">
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

        {/* Response Preview */}
        <div className="flex flex-col gap-1 border-t border-neutral-800 pt-2">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Response Preview
          </div>
          <div className="bg-black/25 border border-neutral-800 rounded p-2 h-20 overflow-y-auto">
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
    </WorkflowNodeWrapperSimple>
  );
};

export const ollamaNodeTypes = [ollamaStreamingNodeType];
