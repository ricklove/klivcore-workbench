import { useObservable, useValue } from '@legendapp/state/react';
import { useCallback } from 'react';
import * as THREE from 'three';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { NumberScrubber } from '../common/number-input-node';
import { type Box, box, unbox } from './types';

type Vector3Array = [number, number, number];

// --- LOGIC: Node Definition ---
// eslint-disable-next-line react-refresh/only-export-components
export const threePositionControllerNodeType: WorkflowRuntimeNodeTypeDefinition =
  {
    type: WorkflowBrandedTypes.typeName(`threePositionController`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(
        ThreePositionControllerComponent,
      ),
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

      const { position: positionRaw } =
        (data as undefined | { position?: Vector3Array }) ?? {};
      const { rotation: rotationRaw } =
        (data as undefined | { rotation?: Vector3Array }) ?? {};
      const { dataset } =
        (inputs as
          | undefined
          | { dataset?: { position: Vector3Array; rotation: Vector3Array } }) ??
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
        ...(!position
          ? { data: { position: [...pos], rotation: [...rot] } }
          : {}),
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

  const overridingMode$ = useObservable({
    mode: `data` as `data` | `dataset`,
    lastDatasetId: -1,
  });
  const datasetInputId = node$
    .get()
    .inputs.find((i) => i.name === 'dataset')
    ?.value.getImmediateChangeCounter();

  if (
    overridingMode$.mode.peek() === `data` &&
    datasetInputId !== overridingMode$.lastDatasetId.peek()
  ) {
    overridingMode$.set({
      mode: `dataset`,
      lastDatasetId: datasetInputId || -1,
    });
  }

  const position = useValue(() => {
    const datasetPos = inputs$.dataset.get()?.position;
    const dataPos = [
      data$.position.get()?.[0] || 0,
      data$.position.get()?.[1] || 0,
      data$.position.get()?.[2] || 0,
    ];
    return (
      (overridingMode$.mode.get() === `dataset` ? datasetPos : dataPos) ??
      dataPos ?? [0, 0, 0]
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
      (overridingMode$.mode.get() === `dataset` ? datasetRot : dataRot) ??
      dataRot ?? [0, 0, 0]
    );
  });

  // Helper to update specific index safely without type assertions on every call
  const updatePositionIndex = useCallback(
    (index: 0 | 1 | 2, val: number) => {
      const current = data$.position.peek() ?? [0, 0, 0];
      const newPos = [...current];
      newPos[index] = val;
      data$.position.set(newPos as Vector3Array);
      overridingMode$.set({
        mode: `data`,
        lastDatasetId: overridingMode$.lastDatasetId.peek(),
      });
    },
    [data$, overridingMode$],
  );

  const updateRotationIndex = useCallback(
    (index: 0 | 1 | 2, val: number) => {
      const current = data$.rotation.peek() ?? [0, 0, 0];
      const newRot = [...current];
      newRot[index] = val;
      data$.rotation.set(newRot as Vector3Array);
      overridingMode$.set({
        mode: `data`,
        lastDatasetId: overridingMode$.lastDatasetId.peek(),
      });
    },
    [data$, overridingMode$],
  );

  return (
    <WorkflowNodeWrapperSimple {...props}>
      <>
        <div className="flex flex-row gap-2 p-2 w-full bg-neutral-950 rounded-md shadow-sm nowheel nodrag nopan">
          <NumberScrubber
            label="X"
            colorClassName="text-red-500"
            value={position[0] || 0}
            onChange={(v) => updatePositionIndex(0, v)}
          />
          <NumberScrubber
            label="Y"
            colorClassName="text-green-500"
            value={position[1] || 0}
            onChange={(v) => updatePositionIndex(1, v)}
          />
          <NumberScrubber
            label="Z"
            colorClassName="text-blue-500"
            value={position[2] || 0}
            onChange={(v) => updatePositionIndex(2, v)}
          />
        </div>
        <div className="flex flex-row gap-2 p-2 w-full bg-neutral-950 rounded-md shadow-sm nowheel nodrag nopan">
          <NumberScrubber
            label="X"
            colorClassName="text-red-500"
            value={rotation[0] || 0}
            onChange={(v) => updateRotationIndex(0, v)}
          />
          <NumberScrubber
            label="Y"
            colorClassName="text-green-500"
            value={rotation[1] || 0}
            onChange={(v) => updateRotationIndex(1, v)}
          />
          <NumberScrubber
            label="Z"
            colorClassName="text-blue-500"
            value={rotation[2] || 0}
            onChange={(v) => updateRotationIndex(2, v)}
          />
        </div>
      </>
    </WorkflowNodeWrapperSimple>
  );
};
