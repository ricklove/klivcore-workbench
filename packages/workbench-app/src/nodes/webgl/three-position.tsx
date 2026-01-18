import React, { useState, useRef, useCallback } from 'react';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { useObservable, useValue } from '@legendapp/state/react';
import { box, unbox, type Box } from './types';
import * as THREE from 'three';

type Vector3Array = [number, number, number];

// --- LOGIC: Node Definition ---
// eslint-disable-next-line react-refresh/only-export-components
export const threePositionControllerNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threePositionController`),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(ThreePositionControllerComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`object`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Object3D>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`dataset`),
      type: WorkflowBrandedTypes.valueType(
        `{id: string; position: Vector3Array; rotation: Vector3Array}`,
      ),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`position`),
      type: WorkflowBrandedTypes.valueType(`Vector3Array`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`rotation`),
      type: WorkflowBrandedTypes.valueType(`Vector3Array`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`vector`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Vector3>`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`dataset`),
      type: WorkflowBrandedTypes.valueType(
        `{id: string; position: Vector3Array; rotation: Vector3Array}`,
      ),
    },
  ],
  execute: async ({ inputs, data, runtimeState, node }) => {
    const obj = unbox(inputs.object as Box<THREE.Object3D>);

    const { position: positionRaw } = (data as undefined | { position?: Vector3Array }) ?? {};
    const { rotation: rotationRaw } = (data as undefined | { rotation?: Vector3Array }) ?? {};
    const { dataset } =
      (inputs as undefined | { dataset?: { position: Vector3Array; rotation: Vector3Array } }) ??
      {};
    const datasetInputId = node.inputs
      .find((i) => i.name === 'dataset')
      ?.value.getImmediateChangeCounter();

    if (!obj) return;

    const rs = runtimeState as {
      obj?: THREE.Object3D;
      position?: Vector3Array;
      rotation?: Vector3Array;
      rotationVec?: THREE.Vector3;
      lastDatasetId?: number;
    };

    const shouldUseDataset = dataset && datasetInputId !== rs.lastDatasetId;
    console.log('[threePositionController] execute', {
      lastDatasetId: rs.lastDatasetId,
      datasetInputId,
      positionRaw,
      rotationRaw,
      dataset,
      shouldUseDataset,
      rs,
    });

    if (shouldUseDataset) {
      rs.lastDatasetId = datasetInputId;
    }

    const position = shouldUseDataset ? dataset.position : positionRaw;
    const rotation = shouldUseDataset ? dataset.rotation : rotationRaw;

    if (
      rs.obj === obj &&
      rs.position?.[0] === position?.[0] &&
      rs.position?.[1] === position?.[1] &&
      rs.position?.[2] === position?.[2] &&
      rs.rotation?.[0] === rotation?.[0] &&
      rs.rotation?.[1] === rotation?.[1] &&
      rs.rotation?.[2] === rotation?.[2]
    ) {
      return;
    }

    const pos = position ?? [obj.position.x, obj.position.y, obj.position.z];
    const rot = rotation ?? [obj.rotation.x, obj.rotation.y, obj.rotation.z];

    if (rs.obj !== obj) rs.obj = obj;
    rs.position = [...pos];
    rs.rotation = [...rot];
    rs.rotationVec = rs.rotationVec || new THREE.Vector3();
    rs.rotationVec.set(rot[0], rot[1], rot[2]);

    obj.position.set(pos[0], pos[1], pos[2]);
    obj.rotation.setFromVector3(rs.rotationVec);

    return {
      outputs: {
        vector: box(obj.position),
        position: [...pos],
        rotation: [...rot],
        dataset: { position: [...pos], rotation: [...rot] },
      },
      ...(!position ? { data: { position: [...pos], rotation: [...rot] } } : {}),
    };
  },
};

export const ThreePositionControllerComponent = (
  props: WorkflowComponentProps_Obs<
    { position: Vector3Array; rotation: Vector3Array },
    { dataset: { id: string; position: Vector3Array; rotation: Vector3Array } }
  >,
) => {
  const { data$, inputs$, node$ } = props.data;

  const overridingMode$ = useObservable({ mode: `data` as `data` | `dataset`, lastDatasetId: -1 });
  const datasetInputId = node$
    .get()
    .inputs.find((i) => i.name === 'dataset')
    ?.value.getImmediateChangeCounter();

  if (
    overridingMode$.mode.peek() === `data` &&
    datasetInputId !== overridingMode$.lastDatasetId.peek()
  ) {
    overridingMode$.set({ mode: `dataset`, lastDatasetId: datasetInputId || -1 });
  }

  const position = useValue(() => {
    const datasetPos = inputs$.dataset.get()?.position;
    const dataPos = [
      data$.position.get()?.[0] || 0,
      data$.position.get()?.[1] || 0,
      data$.position.get()?.[2] || 0,
    ];
    return (
      (overridingMode$.mode.get() === `dataset` ? datasetPos : dataPos) ?? dataPos ?? [0, 0, 0]
    );
  });
  const rotation = useValue(() => {
    const datasetRot = inputs$.dataset.get()?.rotation;
    const dataRot = [
      data$.rotation.get()?.[0] || 0,
      data$.rotation.get()?.[1] || 0,
      data$.rotation.get()?.[2] || 0,
    ];
    return (
      (overridingMode$.mode.get() === `dataset` ? datasetRot : dataRot) ?? dataRot ?? [0, 0, 0]
    );
  });

  // Helper to update specific index safely without type assertions on every call
  const updatePositionIndex = useCallback(
    (index: 0 | 1 | 2, val: number) => {
      const current = data$.position.peek() ?? [0, 0, 0];
      const newPos = [...current];
      newPos[index] = val;
      data$.position.set(newPos as Vector3Array);
      overridingMode$.set({ mode: `data`, lastDatasetId: overridingMode$.lastDatasetId.peek() });
    },
    [data$, overridingMode$],
  );

  const updateRotationIndex = useCallback(
    (index: 0 | 1 | 2, val: number) => {
      const current = data$.rotation.peek() ?? [0, 0, 0];
      const newRot = [...current];
      newRot[index] = val;
      data$.rotation.set(newRot as Vector3Array);
      overridingMode$.set({ mode: `data`, lastDatasetId: overridingMode$.lastDatasetId.peek() });
    },
    [data$, overridingMode$],
  );

  return (
    <WorkflowNodeWrapperSimple {...props}>
      <>
        <div className="flex flex-row gap-2 p-2 w-full bg-neutral-950 rounded-md shadow-sm nowheel nodrag nopan">
          <NumberScrubber
            label="X"
            colorClass="text-red-500"
            value={position[0] || 0}
            onChange={(v) => updatePositionIndex(0, v)}
          />
          <NumberScrubber
            label="Y"
            colorClass="text-green-500"
            value={position[1] || 0}
            onChange={(v) => updatePositionIndex(1, v)}
          />
          <NumberScrubber
            label="Z"
            colorClass="text-blue-500"
            value={position[2] || 0}
            onChange={(v) => updatePositionIndex(2, v)}
          />
        </div>
        <div className="flex flex-row gap-2 p-2 w-full bg-neutral-950 rounded-md shadow-sm nowheel nodrag nopan">
          <NumberScrubber
            label="X"
            colorClass="text-red-500"
            value={rotation[0] || 0}
            onChange={(v) => updateRotationIndex(0, v)}
          />
          <NumberScrubber
            label="Y"
            colorClass="text-green-500"
            value={rotation[1] || 0}
            onChange={(v) => updateRotationIndex(1, v)}
          />
          <NumberScrubber
            label="Z"
            colorClass="text-blue-500"
            value={rotation[2] || 0}
            onChange={(v) => updateRotationIndex(2, v)}
          />
        </div>
      </>
    </WorkflowNodeWrapperSimple>
  );
};

interface ScrubberProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  colorClass: string; // e.g. "text-red-500"
}

const NumberScrubber = ({ label, value, onChange, colorClass }: ScrubberProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Formatting for display
  const displayValue = isNaN(value) ? '0.00' : Number(value).toFixed(2);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;

    // Capture the target. 'currentTarget' refers to the div this handler is attached to.
    const target = e.currentTarget;

    // Explicit pointer capture ensures we receive events even if cursor leaves the element
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startValue = value || 0;

    // Define handlers with strict native PointerEvent types
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;

      // UX: Shift for speed (1.0), Alt for precision (0.01), default (0.1)
      let multiplier = 0.1;
      if (moveEvent.shiftKey) multiplier = 1.0;
      if (moveEvent.altKey) multiplier = 0.001;

      const newValue = startValue + deltaX * multiplier;
      // Round to 3 decimals to avoid floating point artifacts
      onChange(Math.round(newValue * 1000000) / 1000000);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);

      // Cleanup native listeners
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
    };

    // Attach native listeners to the DOM element
    // TypeScript correctly infers 'pointermove' expects a PointerEvent handler on HTMLElement
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Double click to enter edit mode
    if (e.detail === 2) {
      setIsEditing(true);
      // Process focus on next tick
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

  return (
    <div
      className="flex flex-col items-start gap-0.5 flex-1 min-w-0 group"
      title="Drag to change, Double-click to type"
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          className="w-full bg-neutral-800 text-white text-xs px-1 py-0.5 rounded border border-blue-500 outline-none"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <div
          className="w-full flex items-center bg-neutral-900 border border-neutral-700 rounded overflow-hidden cursor-ew-resize hover:border-neutral-500 transition-colors select-none"
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          {/* Axis Label */}
          <div
            className={`px-1.5 py-0.5 text-[10px] font-bold select-none bg-neutral-800/50 ${colorClass}`}
          >
            {label}
          </div>
          {/* Value Display */}
          <div className="flex-1 px-1.5 text-xs text-neutral-300 font-mono text-right truncate">
            {displayValue}
          </div>
        </div>
      )}
    </div>
  );
};
