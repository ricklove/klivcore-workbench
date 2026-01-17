import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { useValue } from '@legendapp/state/react';
import { box, unbox, type Box } from './types';
import * as THREE from 'three';

type Vector3Array = [number, number, number];

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
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`position`),
      type: WorkflowBrandedTypes.valueType(`Vector3Array`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`vector`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Vector3>`),
    },
  ],
  execute: async ({ inputs, data, runtimeState }) => {
    const obj = unbox(inputs.object as Box<THREE.Object3D>);
    const { position } = (data as undefined | { position?: Vector3Array }) ?? {};

    if (!obj) {
      return;
    }

    const rs = runtimeState as {
      obj?: THREE.Object3D;
      position?: Vector3Array;
    };
    if (
      rs.obj === obj &&
      rs.position?.[0] === position?.[0] &&
      rs.position?.[1] === position?.[1] &&
      rs.position?.[2] === position?.[2]
    ) {
      return;
    }

    const pos = position ?? [obj.position.x, obj.position.y, obj.position.z];
    console.log('[threePositionController] execute', { obj, pos, runtimeState });

    if (rs.obj !== obj) {
      rs.obj = obj;
    }

    rs.position = [...pos];
    obj.position.set(pos[0], pos[1], pos[2]);

    return {
      outputs: { vector: box(obj.position), position: [...pos] },
      ...(!position
        ? {
            data: { position: [...pos] },
          }
        : {}),
    };
  },
};

export const ThreePositionControllerComponent = (
  props: WorkflowComponentProps_Obs<{ position: Vector3Array }>,
) => {
  const { data$ } = props.data;
  const position = useValue(() => data$.position.get() ?? [0, 0, 0]);
  console.log('[ThreePositionControllerComponent] render', { position });

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="bg-black w-full h-full nowheel nodrag nopan">
          <input
            type="number"
            step="0.1"
            value={position?.[0] || 0}
            onChange={(e) => {
              data$.position[0].set(parseFloat(e.target.value));
            }}
          />
          <input
            type="number"
            step="0.1"
            value={position?.[1] || 0}
            onChange={(e) => {
              data$.position[1].set(parseFloat(e.target.value));
            }}
          />
          <input
            type="number"
            step="0.1"
            value={position?.[2] || 0}
            onChange={(e) => {
              data$.position[2].set(parseFloat(e.target.value));
            }}
          />
        </div>
      </WorkflowNodeWrapperSimple>
    </>
  );
};
