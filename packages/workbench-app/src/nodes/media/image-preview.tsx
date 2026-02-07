import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

// --- LOGIC: Node Definition ---
export const imagePreviewNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`image-preview`),
  getComponent: () => ({
    Component: NodeStandardContainer(ImagePreviewComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`url`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`url`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
  ],
  execute: async ({ inputs, data }) => {
    const inputsTyped = inputs as { url: undefined | string };
    const dataTyped = data as undefined | { url: undefined | string };

    const finalUrl = inputsTyped.url ?? dataTyped?.url ?? null;

    return {
      outputs: {
        url: finalUrl,
      },
    };
  },
};

// --- UI: Component ---
export const ImagePreviewComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { url: string }, // Data
    { url: string }, // Inputs
    { url: string } // Outputs
  >,
) => {
  const { node$, inputs, data } = props.data;
  const data$ = data.asObservable();

  // Get values from Legend State
  const urlData = useValue(() => data$.url.get());
  const urlInput = useValue(() => inputs.url.asObservable().get());
  const urlInputSlot = useValue(() => node$.getInputInfo<string>(`url`));

  // Determine the URL to display: prefer the input wire, fallback to internal data
  const imageUrl = urlInput ?? urlData ?? '';
  const isConnected = urlInputSlot.isConnected;

  const handleUrlChange = (newUrl: string) => {
    data$.url.set(newUrl);
  };

  return (
    <div className="flex flex-col gap-1 p-1 w-full h-full">
      {/* Image Preview Area */}
      <div className="relative flex-1 flex items-center justify-center bg-black/20 rounded overflow-hidden border border-white/10">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-gray-500 text-xs italic">No Image URL</div>
        )}
      </div>

      {/* Manual URL Input (only editable if not connected) */}
      {!isConnected && (
        <input
          type="text"
          placeholder="Paste Image URL..."
          className="w-full bg-black/40 text-[10px] text-white/70 px-2 py-1 rounded outline-none border border-white/5 focus:border-blue-500/50"
          value={urlData ?? ''}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
      )}

      {/* Small Indicator if connected */}
      {isConnected && (
        <div className="text-[9px] text-blue-400 font-mono truncate">
          Linked: {imageUrl}
        </div>
      )}
    </div>
  );
};
