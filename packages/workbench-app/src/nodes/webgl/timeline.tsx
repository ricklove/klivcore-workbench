import { useObservable, useValue } from '@legendapp/state/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { clsx } from '../../utils/clsx';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

type TimelineData = {
  initialValue: number;
  playing: boolean;

  // Local Config
  localMin: number;
  localMax: number;
  localTick: number;
  localInc: number;
  localLoop: boolean;

  // Override Flags
  overrideMin: boolean;
  overrideMax: boolean;
  overrideTick: boolean;
  overrideInc: boolean;
  overrideLoop: boolean;
};

type TimelineInputs = {
  min: number;
  max: number;
  tickTimeMs: number;
  incrementValue: number;
  autoLoop: boolean;
};

type TimelineOutputs = {
  value: number;
  min: number;
  max: number;
};

// Union type for our inputs to avoid 'any'
type ParamValue = number | boolean;

// Helper to resolve the effective value (Input vs Local)
const resolveParam = <T extends ParamValue>(
  inputVal: T | undefined,
  localVal: T,
  isOverridden: boolean,
): T => {
  if (inputVal !== undefined && inputVal !== null && !isOverridden) {
    return inputVal;
  }
  return localVal;
};

// --- LOGIC: Node Definition ---

// eslint-disable-next-line react-refresh/only-export-components
export const timelineControlNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName('timelineControl'),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(TimelineControlComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName('min'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
    {
      name: WorkflowBrandedTypes.inputName('max'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
    {
      name: WorkflowBrandedTypes.inputName('tickTimeMs'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
    {
      name: WorkflowBrandedTypes.inputName('incrementValue'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
    {
      name: WorkflowBrandedTypes.inputName('autoLoop'),
      type: WorkflowBrandedTypes.valueType('boolean'),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName('value'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
    {
      name: WorkflowBrandedTypes.outputName('min'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
    {
      name: WorkflowBrandedTypes.outputName('max'),
      type: WorkflowBrandedTypes.valueType('number'),
    },
  ],
  execute: async ({ inputs, data, controller }) => {
    // 1. Initialize State
    const safeData = (data as unknown as TimelineData) || {};

    // 2. Read Inputs (No unbox needed for primitives)
    const iMin = inputs.min as number | undefined;
    const iMax = inputs.max as number | undefined;
    const iTick = inputs.tickTimeMs as number | undefined;
    const iInc = inputs.incrementValue as number | undefined;
    const iLoop = inputs.autoLoop as boolean | undefined;

    // 3. Resolve Effective Parameters
    const min = resolveParam(
      iMin,
      safeData.localMin ?? 0,
      safeData.overrideMin,
    );
    const max = resolveParam(
      iMax,
      safeData.localMax ?? 100,
      safeData.overrideMax,
    );
    const inc = resolveParam(
      iInc,
      safeData.localInc ?? 1,
      safeData.overrideInc,
    );
    const loop = resolveParam(
      iLoop,
      safeData.localLoop ?? true,
      safeData.overrideLoop,
    );
    // tick is unused in math logic but resolved for consistency

    const tick = resolveParam(
      iTick,
      safeData.localTick ?? 1000,
      safeData.overrideTick,
    );

    // 4. Handle Playback Logic
    const initialValue = safeData.initialValue ?? min;
    const isPlaying = safeData.playing ?? false;

    controller.registerEvent((emit) => {
      let currentValue = initialValue;

      const update = () => {
        if (!isPlaying) return;

        currentValue += inc;
        if (currentValue > max) {
          if (loop) {
            currentValue = min;
          } else {
            currentValue = max;
          }
        }

        // Safety clamp (unless purely wrapping)
        if (currentValue < min) currentValue = min;

        emit({
          value: currentValue,
        });

        id = setTimeout(update, tick);
      };

      let id = setTimeout(update, tick);

      return { unsubscribe: () => clearTimeout(id) };
    });

    // 5. Return (No box needed)
    return {
      outputs: {
        value: initialValue,
        min: min,
        max: max,
      },
      //   data: {
      //     ...safeData,
      //     value: initialValue,
      //   },
    };
  },
};

// --- COMPONENTS ---

interface ScrubberProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  step?: number;
  className?: string;
  label?: string;
}

const NumberScrubber = ({
  value,
  onChange,
  disabled,
  step = 0.1,
  className,
  label,
}: ScrubberProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue =
    typeof value === 'number' && !Number.isNaN(value)
      ? Number(value).toFixed(2)
      : '0.00';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isEditing) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startValue = value || 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let multiplier = step;
      if (moveEvent.shiftKey) multiplier *= 10;
      if (moveEvent.altKey) multiplier *= 0.1;
      onChange(Math.round((startValue + deltaX * multiplier) * 1000) / 1000);
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
    if (disabled) return;
    if (e.detail === 2) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleBlur = () => setIsEditing(false);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className={clsx(
          'w-full bg-neutral-800 text-white text-xs px-1 py-0.5 rounded outline-none border border-blue-500',
          className,
        )}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div
      className={clsx(
        'relative flex items-center justify-between px-2 py-0.5 rounded overflow-hidden select-none border border-transparent transition-colors',
        disabled
          ? 'bg-neutral-900/50 opacity-50 cursor-not-allowed'
          : 'bg-neutral-900 hover:border-neutral-600 cursor-ew-resize',
        className,
      )}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      title={
        disabled ? 'Controlled by input' : 'Drag to scrub, Double-click to edit'
      }
    >
      {label && (
        <span className="text-[10px] font-bold text-neutral-500 mr-2">
          {label}
        </span>
      )}
      <span className="text-xs font-mono text-neutral-300 ml-auto">
        {displayValue}
      </span>
    </div>
  );
};

const BooleanToggle = ({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) => (
  <button
    className={clsx(
      'flex items-center justify-center px-2 py-0.5 rounded text-xs border border-transparent transition-colors w-full',
      disabled
        ? 'bg-neutral-900/50 opacity-50 cursor-not-allowed'
        : 'bg-neutral-900 hover:border-neutral-600 cursor-pointer',
      value ? 'text-green-400' : 'text-neutral-500',
    )}
    onClick={() => !disabled && onChange(!value)}
  >
    {label && (
      <span className="mr-2 text-[10px] font-bold text-neutral-500">
        {label}
      </span>
    )}
    {value ? 'ON' : 'OFF'}
  </button>
);

// 3. Param Row (Strictly Typed)
interface ParamRowProps {
  label: string;
  hasInput: boolean;
  isOverridden: boolean;
  inputValue: ParamValue | undefined;
  localValue: ParamValue;
  onToggleOverride: (val: boolean) => void;
  onLocalChange: (val: ParamValue) => void;
  type?: 'number' | 'boolean';
}

const ParamRow = ({
  label,
  hasInput,
  isOverridden,
  inputValue,
  localValue,
  onToggleOverride,
  onLocalChange,
  type = 'number',
}: ParamRowProps) => {
  const showLocal = !hasInput || isOverridden;
  const effectiveValue = showLocal ? localValue : inputValue;

  return (
    <div className="flex items-center gap-2 h-6">
      <div className="flex items-center w-24 shrink-0 gap-1">
        <div className="w-4 h-4 flex items-center justify-center">
          {hasInput && (
            <input
              type="checkbox"
              className="w-3 h-3 accent-blue-500 bg-neutral-800 border-neutral-600 rounded cursor-pointer"
              checked={isOverridden}
              onChange={(e) => onToggleOverride(e.target.checked)}
              title="Override input"
            />
          )}
        </div>
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          {label}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {type === 'number' ? (
          <NumberScrubber
            value={(effectiveValue as number) ?? 0}
            onChange={(v) => onLocalChange(v)}
            disabled={!showLocal}
            step={label === 'TICK' ? 10 : label === 'INC' ? 0.1 : 1}
          />
        ) : (
          <BooleanToggle
            value={!!effectiveValue}
            onChange={(v) => onLocalChange(v)}
            disabled={!showLocal}
          />
        )}
      </div>
    </div>
  );
};

// 4. Main Timeline Component
export const TimelineControlComponent = (
  props: WorkflowComponentProps_Obs<
    TimelineData,
    TimelineInputs,
    TimelineOutputs
  >,
) => {
  const { data$, inputs$, outputs$ } = props.data;

  // Data State
  const playing = useValue(data$.playing);
  const initialValueFromData = useValue(data$.initialValue) ?? 0;
  const valueFromOutput = useValue(outputs$.value) ?? 0;

  const ignoreOutputValue$ = useObservable(initialValueFromData);
  const shouldUseOutputValue = useValue(
    () => ignoreOutputValue$.get() !== valueFromOutput,
  );
  const value = shouldUseOutputValue ? valueFromOutput : initialValueFromData;

  // Local Config State
  const localMin = useValue(data$.localMin);
  const localMax = useValue(data$.localMax);
  const localTick = useValue(data$.localTick);
  const localInc = useValue(data$.localInc);
  const localLoop = useValue(data$.localLoop);

  // Override State
  const overrideMin = useValue(data$.overrideMin);
  const overrideMax = useValue(data$.overrideMax);
  const overrideTick = useValue(data$.overrideTick);
  const overrideInc = useValue(data$.overrideInc);
  const overrideLoop = useValue(data$.overrideLoop);

  // Reactive Inputs
  // We use useValue on the input observables. If the input is not connected, this returns undefined.
  const inpMin = useValue(inputs$.min) ?? undefined;
  const inpMax = useValue(inputs$.max) ?? undefined;
  const inpTick = useValue(inputs$.tickTimeMs) ?? undefined;
  const inpInc = useValue(inputs$.incrementValue) ?? undefined;
  const inpLoop = useValue(inputs$.autoLoop) ?? undefined;

  // Availability Checks
  const hasMin = inpMin !== undefined && inpMin !== null;
  const hasMax = inpMax !== undefined && inpMax !== null;
  const hasTick = inpTick !== undefined && inpTick !== null;
  const hasInc = inpInc !== undefined && inpInc !== null;
  const hasLoop = inpLoop !== undefined && inpLoop !== null;

  // Helper to get effective for UI rendering (Strictly Typed)
  const getEff = (
    has: boolean,
    over: boolean,
    loc: ParamValue,
    inputVal: ParamValue | undefined,
  ): ParamValue => {
    if (has && !over) {
      return inputVal ?? loc;
    }
    return loc;
  };

  const effMin = getEff(hasMin, !!overrideMin, localMin ?? 0, inpMin) as number;
  const effMax = getEff(
    hasMax,
    !!overrideMax,
    localMax ?? 100,
    inpMax,
  ) as number;
  const effInc = getEff(hasInc, !!overrideInc, localInc ?? 1, inpInc) as number;

  const range = effMax - effMin;
  const progress =
    range === 0 ? 0 : Math.min(Math.max((value - effMin) / range, 0), 1);

  const togglePlay = () => {
    const currentOutput = outputs$.value.peek() ?? value;
    ignoreOutputValue$.set(currentOutput);
    data$.initialValue.set(currentOutput);
    data$.playing.set(!playing);
  };

  const handleMainScrub = (newVal: number) => {
    const roundedToStep =
      Math.round((newVal - effMin) / Math.abs(effInc)) * Math.abs(effInc) +
      effMin;
    const clamped = Math.max(effMin, Math.min(roundedToStep, effMax));

    ignoreOutputValue$.set(outputs$.value.peek() ?? value);
    data$.initialValue.set(clamped);
  };

  return (
    <WorkflowNodeWrapperSimple {...props}>
      <div className="w-full bg-neutral-950 p-3 rounded-md shadow-sm flex flex-col gap-3 nowheel nodrag nopan">
        {/* --- Header: Playback & Scrubber --- */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className={clsx(
              'w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0',
              playing
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-500 hover:bg-green-500/30',
            )}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <NumberScrubber
              value={value}
              onChange={handleMainScrub}
              step={(effMax - effMin) / 100}
              className="bg-neutral-900 border-neutral-700"
            />
            <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-75 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* --- Settings Grid --- */}
        <div className="flex flex-col gap-1 border-t border-neutral-800 pt-2">
          <ParamRow
            label="MIN"
            hasInput={hasMin}
            isOverridden={!!overrideMin}
            inputValue={inpMin}
            localValue={localMin ?? 0}
            onToggleOverride={(v) => data$.overrideMin.set(v)}
            onLocalChange={(v) => data$.localMin.set(v as number)}
          />

          <ParamRow
            label="MAX"
            hasInput={hasMax}
            isOverridden={!!overrideMax}
            inputValue={inpMax}
            localValue={localMax ?? 100}
            onToggleOverride={(v) => data$.overrideMax.set(v)}
            onLocalChange={(v) => data$.localMax.set(v as number)}
          />

          <ParamRow
            label="STEP"
            hasInput={hasInc}
            isOverridden={!!overrideInc}
            inputValue={inpInc}
            localValue={localInc ?? 1}
            onToggleOverride={(v) => data$.overrideInc.set(v)}
            onLocalChange={(v) => data$.localInc.set(v as number)}
          />

          <ParamRow
            label="TICK (ms)"
            hasInput={hasTick}
            isOverridden={!!overrideTick}
            inputValue={inpTick}
            localValue={localTick ?? 1000}
            onToggleOverride={(v) => data$.overrideTick.set(v)}
            onLocalChange={(v) => data$.localTick.set(v as number)}
          />

          <ParamRow
            label="LOOP"
            type="boolean"
            hasInput={hasLoop}
            isOverridden={!!overrideLoop}
            inputValue={inpLoop}
            localValue={localLoop ?? true}
            onToggleOverride={(v) => data$.overrideLoop.set(v)}
            onLocalChange={(v) => data$.localLoop.set(v as boolean)}
          />
        </div>
      </div>
    </WorkflowNodeWrapperSimple>
  );
};
