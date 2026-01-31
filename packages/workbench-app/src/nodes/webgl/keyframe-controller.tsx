import { useValue } from '@legendapp/state/react';
import React, { useCallback, useRef, useState } from 'react';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowJsonObject,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { NodeTypeWrapComponentWithNodeWrapper } from './_deps.tsx';

// --- TYPES ---

type KeyframeData = {
  keyframes: Record<number, WorkflowJsonObject>;
  currentFrame: number;
  isPlaying: boolean;
  lastSavedFrame?: number;
  interpolationEnabled: boolean;
};

type KeyframeInputs = {
  dataset: WorkflowJsonObject;
  frameIndex: number;
};

type KeyframeOutputs = {
  dataset: WorkflowJsonObject;
};

// --- INTERPOLATION UTILS ---

const interpolateValue = (start: unknown, end: unknown, t: number): unknown => {
  // Handle numbers
  if (typeof start === 'number' && typeof end === 'number') {
    return start + (end - start) * t;
  }

  // Handle arrays (vectors, colors, etc.)
  if (Array.isArray(start) && Array.isArray(end)) {
    if (start.length !== end.length) return start;
    return start.map((val, i) => interpolateValue(val, end[i], t));
  }

  // Handle objects
  if (
    typeof start === 'object' &&
    start !== null &&
    typeof end === 'object' &&
    end !== null
  ) {
    const result: Record<string, unknown> = {};
    const keys = Array.from(
      new Set([...Object.keys(start), ...Object.keys(end)]),
    );

    for (const key of keys) {
      const startVal = (start as Record<string, unknown>)[key];
      const endVal = (end as Record<string, unknown>)[key];

      if (startVal !== undefined && endVal !== undefined) {
        result[key] = interpolateValue(startVal, endVal, t);
      } else if (startVal !== undefined) {
        result[key] = startVal;
      } else {
        result[key] = endVal;
      }
    }

    return result;
  }

  // Fallback: return start if types don't match for interpolation
  return start;
};

const interpolateKeyframes = (
  keyframes: Record<number, WorkflowJsonObject>,
  frame: number,
): WorkflowJsonObject | null => {
  console.log('[keyframeController:interpolateKeyframes] START', {
    keyframes,
    frame,
  });

  if (Object.keys(keyframes).length === 0) return null;

  const frameNum = Math.floor(frame);

  // Exact keyframe match
  if (keyframes[frameNum] !== undefined) {
    return keyframes[frameNum];
  }

  // Find surrounding keyframes
  const frames = Object.keys(keyframes)
    .map(Number)
    .sort((a, b) => a - b);

  let prevFrame = -1;
  let nextFrame = -1;

  for (const f of frames) {
    if (f <= frameNum) {
      prevFrame = f;
    } else {
      nextFrame = f;
      break;
    }
  }

  // Handle edge cases
  if (prevFrame === -1 && nextFrame !== -1) {
    return keyframes[nextFrame] || null; // Before first keyframe
  }
  if (nextFrame === -1 && prevFrame !== -1) {
    return keyframes[prevFrame] || null; // After last keyframe
  }
  if (prevFrame === -1 || nextFrame === -1) {
    return null; // No valid keyframes
  }

  // Interpolate between surrounding keyframes
  const prevData = keyframes[prevFrame];
  const nextData = keyframes[nextFrame];
  const t = (frameNum - prevFrame) / (nextFrame - prevFrame);

  console.log('[keyframeController:interpolateKeyframes] interpolate frames', {
    prevFrame,
    nextFrame,
    prevData,
    nextData,
    t,
    keyframes,
    frame,
  });

  return interpolateValue(prevData, nextData, t) as WorkflowJsonObject;
};

// --- LOGIC: Node Definition ---

// eslint-disable-next-line react-refresh/only-export-components
export const keyframeControllerNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName('keyframeController'),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(
      KeyframeControllerComponent,
    ),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName('dataset'),
      type: WorkflowBrandedTypes.valueType('WorkflowJsonObject'),
    },
    {
      name: WorkflowBrandedTypes.inputName('frameIndex'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName('dataset'),
      type: WorkflowBrandedTypes.valueType('WorkflowJsonObject'),
    },
  ],
  execute: async ({ inputs, data, runtimeState }) => {
    console.log('[keyframeController:execute] START', {
      inputs,
      data,
      runtimeState,
    });

    const safeData = (data as unknown as KeyframeData) || {
      keyframes: {},
      currentFrame: 0,
      isPlaying: false,
      interpolationEnabled: true,
    };

    if (!safeData.isPlaying) {
      return;
    }

    const keyframes = safeData.keyframes || {};
    const currentFrame =
      typeof inputs.frameIndex === 'number'
        ? inputs.frameIndex
        : safeData.currentFrame || 0;

    const rs = runtimeState as {
      lastFrame?: number;
      lastOutput?: WorkflowJsonObject;
      isInterpolating?: boolean;
    };

    const frameChanged = rs.lastFrame !== currentFrame;
    if (!frameChanged && rs.lastOutput) {
      return;
    }

    rs.lastFrame = currentFrame;

    const targetData = !safeData.interpolationEnabled
      ? keyframes[currentFrame]
      : interpolateKeyframes(keyframes, currentFrame);

    if (!targetData) {
      return;
    }

    if (
      rs.lastOutput &&
      JSON.stringify(rs.lastOutput) === JSON.stringify(targetData)
    ) {
      return;
    }

    rs.lastOutput = targetData;

    return {
      outputs: {
        dataset: targetData,
      },
    };
  },
};

// --- UI COMPONENTS ---

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
  title?: string;
}

const Button = ({
  onClick,
  disabled,
  variant = 'secondary',
  children,
  title,
}: ButtonProps) => {
  const baseClasses = 'px-2 py-1 rounded text-xs font-medium transition-colors';
  const variantClasses = {
    primary:
      'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border border-blue-500/50',
    secondary:
      'bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700 border border-neutral-600',
    danger:
      'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50',
  };

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

const NumberScrubber = ({
  value,
  onChange,
  label,
  step = 1,
}: {
  value: number;
  onChange: (val: number) => void;
  label: string;
  step?: number;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue =
    typeof value === 'number' && !Number.isNaN(value) ? Math.round(value) : '0';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startValue = value || 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let multiplier = step;
      if (moveEvent.shiftKey) multiplier *= 10;
      if (moveEvent.altKey) multiplier *= 0.1;

      onChange(Math.round((startValue + deltaX * multiplier) * 100) / 100);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
    };

    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.detail === 2) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleBlur = () => setIsEditing(false);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider w-12">
        {label}
      </span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          className="flex-1 bg-neutral-800 text-white text-xs px-1 py-0.5 rounded border border-blue-500 outline-none"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          className="flex-1 flex items-center bg-neutral-900 border border-neutral-700 rounded overflow-hidden cursor-ew-resize hover:border-neutral-500 transition-colors select-none"
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          title="Drag to change, Double-click to edit"
        >
          <div className="flex-1 px-1.5 text-xs text-neutral-300 font-mono text-right truncate">
            {displayValue}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

export const KeyframeControllerComponent = (
  props: WorkflowComponentProps_Obs<
    KeyframeData,
    KeyframeInputs,
    KeyframeOutputs
  >,
) => {
  const { data$, inputs$ } = props.data;

  // State
  const keyframes = useValue(() => data$.keyframes.get() || {});
  const currentFrame = useValue(() => data$.currentFrame.get() || 0);
  const isPlaying = useValue(() => data$.isPlaying.get() || false);
  const interpolationEnabled = useValue(
    () => data$.interpolationEnabled.get() !== false,
  );

  // Inputs
  const inputFrameIndex = useValue(inputs$.frameIndex);
  const inputDataset = useValue(inputs$.dataset);

  // Reactive frame updates from input
  React.useEffect(() => {
    if (typeof inputFrameIndex === 'number') {
      data$.currentFrame.set(inputFrameIndex);
    }
  }, [inputFrameIndex, data$]);

  const saveKeyframe = useCallback(() => {
    if (!inputDataset) return;

    const newKeyframes = { ...keyframes };
    const frame = Math.floor(currentFrame);
    newKeyframes[frame] = inputDataset;

    data$.keyframes.set(newKeyframes);
    data$.lastSavedFrame.set(frame);
  }, [currentFrame, inputDataset, keyframes, data$]);

  const deleteKeyframe = useCallback(() => {
    const frame = Math.floor(currentFrame);
    const newKeyframes = { ...keyframes };
    delete newKeyframes[frame];

    data$.keyframes.set(newKeyframes);
    if (data$.lastSavedFrame.peek() === frame) {
      data$.lastSavedFrame.set(undefined);
    }
  }, [currentFrame, keyframes, data$]);

  const togglePlayPause = useCallback(() => {
    data$.isPlaying.set(!isPlaying);
  }, [isPlaying, data$]);

  const toggleInterpolation = useCallback(() => {
    data$.interpolationEnabled.set(!interpolationEnabled);
  }, [interpolationEnabled, data$]);

  const handleFrameChange = useCallback(
    (newFrame: number) => {
      data$.currentFrame.set(newFrame);
    },
    [data$],
  );

  const hasKeyframeAtCurrentFrame =
    keyframes[Math.floor(currentFrame)] !== undefined;
  const keyframeCount = Object.keys(keyframes).length;
  const keyframeFrames = Object.keys(keyframes)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="w-full bg-neutral-950 p-3 rounded-md shadow-sm flex flex-col gap-3 nowheel nodrag nopan">
      {/* Frame Control */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlayPause}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0 ${
            isPlaying
              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <title>Pause animation</title>
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <title>Play animation</title>
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <NumberScrubber
            value={currentFrame}
            onChange={handleFrameChange}
            label="FRAME"
            step={1}
          />
        </div>
      </div>

      {/* Keyframe Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={saveKeyframe}
          disabled={!inputDataset}
          variant="primary"
          title={
            hasKeyframeAtCurrentFrame
              ? 'Overwrite existing keyframe'
              : 'Save current data as keyframe'
          }
        >
          {hasKeyframeAtCurrentFrame ? 'UPDATE' : 'SAVE'}
        </Button>

        <Button
          onClick={deleteKeyframe}
          disabled={!hasKeyframeAtCurrentFrame}
          variant="danger"
          title="Delete keyframe at current frame"
        >
          DELETE
        </Button>

        <Button
          onClick={toggleInterpolation}
          variant={interpolationEnabled ? 'primary' : 'secondary'}
          title={
            interpolationEnabled
              ? 'Disable interpolation'
              : 'Enable interpolation'
          }
        >
          {interpolationEnabled ? 'INTERP' : 'NO INTERP'}
        </Button>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">Keyframes:</span>
          <span className="text-neutral-200 font-mono">{keyframeCount}</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${hasKeyframeAtCurrentFrame ? 'bg-green-500' : 'bg-neutral-600'}`}
          />
          <span className="text-neutral-400 text-[10px]">
            {hasKeyframeAtCurrentFrame ? 'HAS KEYFRAME' : 'NO KEYFRAME'}
          </span>
        </div>
      </div>

      {/* Keyframe Timeline */}
      {keyframeCount > 0 && (
        <div className="bg-neutral-900 rounded p-2">
          <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-wider">
            Timeline
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {keyframeFrames.map((frame) => (
              <div
                key={frame}
                className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-mono cursor-pointer transition-colors ${
                  Math.floor(currentFrame) === frame
                    ? 'bg-blue-500 text-white'
                    : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                }`}
                onClick={() => handleFrameChange(frame)}
                title={`Go to frame ${frame}`}
              >
                {frame}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
