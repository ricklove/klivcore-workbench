import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

// --- LOGIC: Node Definition ---
export const videoPreviewNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`video-preview`),
  getComponent: () => ({
    Component: NodeStandardContainer(VideoPreviewComponent),
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
export const VideoPreviewComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { url: string; autoplay?: boolean; loop?: boolean }, // Data
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

  // Settings with defaults (checked by default)
  const autoplay = useValue(() => data$.autoplay.get() ?? true);
  const loop = useValue(() => data$.loop.get() ?? true);

  const videoUrl = urlInput ?? urlData ?? '';
  const isConnected = urlInputSlot.isConnected;

  return (
    <div className="flex flex-col gap-1 p-1 w-full h-full min-w-[180px]">
      {/* Video Preview Area */}
      <div className="relative flex-1 flex items-center justify-center bg-black/40 rounded overflow-hidden border border-white/10 aspect-video">
        {videoUrl ? (
          <video
            key={`${videoUrl}-${autoplay}-${loop}`} // Re-mount when settings change to ensure browser respects flags
            src={videoUrl}
            controls
            muted
            autoPlay={autoplay}
            loop={loop}
            playsInline
            className="max-w-full max-h-full w-full h-full object-contain"
          />
        ) : (
          <div className="text-gray-500 text-xs italic">No Video URL</div>
        )}
      </div>

      {/* Manual URL Input */}
      {!isConnected && (
        <input
          type="text"
          placeholder="Video URL..."
          className="w-full bg-black/40 text-[10px] text-white/70 px-2 py-1 rounded outline-none border border-white/5 focus:border-blue-500/50"
          value={urlData ?? ''}
          onChange={(e) => data$.url.set(e.target.value)}
        />
      )}

      {/* Settings Row */}
      <div className="flex items-center gap-3 px-1 py-1 border-t border-white/5 mt-1">
        <label className="flex items-center gap-1.5 cursor-pointer group">
          <input
            type="checkbox"
            className="w-3 h-3 accent-blue-500 rounded border-white/20 bg-black/40"
            checked={autoplay}
            onChange={(e) => data$.autoplay.set(e.target.checked)}
          />
          <span className="text-[9px] text-white/50 group-hover:text-white/80 uppercase font-bold tracking-wider">
            Autoplay
          </span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer group">
          <input
            type="checkbox"
            className="w-3 h-3 accent-blue-500 rounded border-white/20 bg-black/40"
            checked={loop}
            onChange={(e) => data$.loop.set(e.target.checked)}
          />
          <span className="text-[9px] text-white/50 group-hover:text-white/80 uppercase font-bold tracking-wider">
            Loop
          </span>
        </label>
      </div>

      {/* Linked Indicator */}
      {isConnected && (
        <div className="text-[9px] text-blue-400 font-mono truncate px-1">
          Linked: {videoUrl}
        </div>
      )}
    </div>
  );
};
