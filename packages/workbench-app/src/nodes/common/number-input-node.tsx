import { useValue } from '@legendapp/state/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

// --- LOGIC: Node Definition ---
// eslint-disable-next-line react-refresh/only-export-components
export const numberInputNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`number-input`),
  getComponent: () => ({
    Component: NodeStandardContainer(NumberInputComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`value`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`value`),
      type: WorkflowBrandedTypes.valueType(`number`),
    },
  ],
  execute: async ({ inputs, data }) => {
    const inputValue = (inputs as undefined | { value?: number })?.value;
    const dataValue = (data as undefined | { value?: number })?.value ?? 0;
    const value = inputValue ?? dataValue;
    return {
      outputs: {
        value,
      },
      ...(!inputValue ? { data: { value } } : {}),
    };
  },
};

export const NumberInputComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { value: number },
    { value: number }
  >,
) => {
  const { data, inputs, node$ } = props.data;
  const data$ = data.asObservable();

  const valueInputSlot = useValue(() => node$.getInputInfo<number>(`value`));
  const isReadonly = valueInputSlot.isConnected;

  const inputValue = useValue(inputs.value.asObservable());
  const dataValue = useValue(data$.value) ?? 0;
  const currentValue = inputValue ?? dataValue;

  const updateValue = (newValue: number) => {
    if (isReadonly) return;
    data$.value.set(newValue);
  };

  return (
    <div className="p-2 w-full bg-neutral-950 rounded-md shadow-sm nowheel nodrag nopan">
      <NumberScrubber
        //   label="Value"
        value={currentValue}
        onChange={updateValue}
        readonly={isReadonly}
      />
    </div>
  );
};

interface NumberScrubberProps {
  label?: string;
  colorClassName?: string;
  value: number;
  onChange: (val: number) => void;
  readonly?: boolean;
}

export const NumberScrubber = ({
  label,
  colorClassName,
  value,
  onChange,
  readonly,
}: NumberScrubberProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isIntegerMode, setIsIntegerMode] = useState(value % 1 === 0);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = Number.isNaN(value)
    ? isIntegerMode
      ? '0'
      : '0.00'
    : isIntegerMode
      ? Number(value).toFixed(0)
      : Number(value).toFixed(2);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing || readonly) return;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startValue = value || 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let multiplier = 1.0;
      if (moveEvent.shiftKey) multiplier = 100.0;
      if (moveEvent.altKey) multiplier = 0.001;
      if (!isIntegerMode) {
        // Normalize Y position relative to startY: 0 at startY, 1 at top, -1 at bottom
        const normalizedY =
          (startY - moveEvent.clientY) / (window.innerHeight / 2);
        // Clamp to ensure it's within -1 to 1
        const clampedY = Math.max(-1, Math.min(1, normalizedY));
        // Exponent ranges from -3 (bottom, 0.001x) to 3 (top, 1000x), with 0 at startY (1x)
        const s = 10 ** (clampedY * 3);
        multiplier *= s;
      }
      const newValue = startValue + deltaX * multiplier;
      if (newValue % 1 !== 0) setIsIntegerMode(false);
      onChange(Math.round(newValue * 1000000) / 1000000);
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
    if (readonly) return;
    if (e.detail === 2) {
      setIsEditing(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.select();
        }
      }, 0);
    }
  };

  const handleBlur = () => setIsEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (num % 1 !== 0) setIsIntegerMode(false);
    onChange(num);
  };

  return (
    <div
      className="flex flex-col items-start gap-0.5 flex-1 min-w-0 group"
      title={
        readonly
          ? 'Value is set by input'
          : 'Drag to change, Double-click to type'
      }
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          className={`w-full bg-neutral-800 text-white text-xs px-1 py-0.5 rounded border border-blue-500 outline-none`}
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          role="button"
          tabIndex={readonly ? -1 : 0}
          aria-label="Number input"
          className={`w-full flex items-center bg-neutral-900 border rounded overflow-hidden select-none ${
            readonly
              ? 'cursor-default border-neutral-600'
              : 'cursor-ew-resize border-neutral-700 hover:border-neutral-500 transition-colors'
          }`}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          onKeyDown={
            readonly
              ? undefined
              : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Trigger the click behavior directly without the event
                    if (e.detail === 2) {
                      setIsEditing(true);
                      setTimeout(() => {
                        if (inputRef.current) {
                          inputRef.current.select();
                        }
                      }, 0);
                    }
                  }
                }
          }
        >
          {label && (
            <div
              className={`px-1.5 py-0.5 text-[10px] font-bold select-none bg-neutral-800/50 ${colorClassName ?? 'text-neutral-400'}`}
            >
              {label}
            </div>
          )}
          <div
            className={`flex-1 px-1.5 text-xs font-mono text-right truncate ${
              readonly ? 'text-neutral-500' : 'text-neutral-300'
            }`}
          >
            {displayValue}
          </div>
        </div>
      )}
    </div>
  );
};
