/* eslint-disable react-hooks/immutability */
import { proxy, snapshot, subscribe, useSnapshot } from 'valtio';
import {
  WorkflowBrandedTypes,
  type WorkflowReactFlowStore,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
} from '../types';
import { type EdgeChange, type NodeChange } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { memoize } from 'proxy-memoize';

export const createReactFlowStore = (store: WorkflowRuntimeStore): WorkflowReactFlowStore => {
  type StoreSnap = ReturnType<typeof snapshot<typeof store>>;

  const getNodeTypes = memoize((store: StoreSnap) =>
    Object.fromEntries(
      Object.values(store.nodeTypes).map((x) => [x.type, x.component as React.ComponentType]),
    ),
  );

  const getNode = memoize((x: WorkflowRuntimeNode) => {
    const nodeDirect = store.nodes[x.id]!;
    const pos = x.position;
    return {
      id: x.id,
      type: x.type,
      position: { x: pos.x, y: pos.y },
      width: pos.width,
      height: pos.height,

      parentId: x.parentId,
      data: { node: nodeDirect },
    };
  });
  const getNodes = memoize((snap: StoreSnap) =>
    Object.values(snap.nodes as unknown as WorkflowRuntimeNode[]).map((x) => getNode(x)),
  );

  const getEdge = memoize((x: WorkflowRuntimeEdge) =>
    x.source.error
      ? undefined
      : {
          id: x.id,
          type: `custom` as const,
          source: x.source.node.id,
          sourceHandle: x.source.outputName,
          target: x.target.node.id,
          targetHandle: x.target.inputName,
          data: { edge: store.edges[x.id]! as WorkflowRuntimeEdge },
        },
  );
  const getEdges = memoize((snap: StoreSnap) =>
    Object.values(snap.edges as unknown as WorkflowRuntimeEdge[])
      .map((x) => getEdge(x))
      .filter((x): x is NonNullable<typeof x> => !!x),
  );

  const reactStore: WorkflowReactFlowStore & {
    _store: WorkflowRuntimeStore;
  } = {
    _store: store,
    get nodeTypes() {
      return getNodeTypes(snapshot(this._store));
    },
    get nodes() {
      return getNodes(snapshot(this._store));
    },
    get edges() {
      return getEdges(snapshot(this._store));
    },
  };

  return proxy(reactStore);
};

export const useReactFlowStore = (
  store: WorkflowRuntimeStore,
): WorkflowReactFlowStore & {
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
} => {
  const [nodeTypes, setNodeTypes] = useState({} as WorkflowReactFlowStore['nodeTypes']);
  useEffect(() => {
    const unsub = subscribe(store.nodeTypes, () => {
      setNodeTypes(
        Object.fromEntries(
          Object.values(store.nodeTypes).map((x) => [x.type, x.component as React.ComponentType]),
        ),
      );
    });
    return () => unsub();
  }, [store]);

  const snap = useSnapshot(store) as unknown as typeof store;

  const reactFlowStore: WorkflowReactFlowStore = {
    nodeTypes,
    nodes: Object.values(snap.nodes).map((x) => {
      const nodeDirect = store.nodes[x.id]!;
      const pos = x.position;
      return {
        id: x.id,
        type: x.type,
        position: { x: pos.x, y: pos.y },
        width: pos.width,
        height: pos.height,

        parentId: x.parentId,
        data: { node: nodeDirect },
      };
    }),
    edges: Object.values(snap.edges)
      .map((x) =>
        x.source.error
          ? undefined
          : {
              id: x.id,
              type: `custom` as const,
              source: x.source.node.id,
              sourceHandle: x.source.outputName,
              target: x.target.node.id,
              targetHandle: x.target.inputName,
              data: { edge: store.edges[x.id]! as WorkflowRuntimeEdge },
            },
      )
      .filter((x): x is NonNullable<typeof x> => !!x),
  };

  return {
    ...reactFlowStore,
    onNodesChange: (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' || change.type === 'dimensions') {
          const node = store.nodes[WorkflowBrandedTypes.nodeId(change.id)];
          if (!node) continue;

          if (change.type === `position`) {
            node.position.x = change.position?.x ?? node.position.x;
            node.position.y = change.position?.y ?? node.position.y;
          }
          if (change.type === `dimensions`) {
            node.position.width = change.dimensions?.width ?? node.position.width;
            node.position.height = change.dimensions?.height ?? node.position.height;
          }
          continue;
        }

        if (change.type === `remove`) {
          store.actions.deleteNode(WorkflowBrandedTypes.nodeId(change.id));
          continue;
        }

        console.log(`[useReactFlowStore] Unhandled node change: `, { change });
      }
    },
    onEdgesChange: (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === `remove`) {
          store.actions.deleteEdge(WorkflowBrandedTypes.edgeIdFormString(change.id));
          continue;
        }

        console.log(`[useReactFlowStore:onEdgesChange] Unhandled edge change: `, { change });
      }
    },
  };
};

// import {
//   Edge,
//   EdgeChange,
//   Node,
//   NodeChange,
//   OnNodesChange,
//   OnEdgesChange,
//   applyNodeChanges,
//   applyEdgeChanges,
// } from '@xyflow/react';
// import { createWithEqualityFn } from 'zustand/traditional';

// export type RFState = {
//   nodes: Node[];
//   edges: Edge[];
//   onNodesChange: OnNodesChange;
//   onEdgesChange: OnEdgesChange;
// };

// const useStore = createWithEqualityFn<RFState>((set, get) => ({
//   nodes: [
//     {
//       id: 'root',
//       type: 'mindmap',
//       data: { label: 'React Flow Mind Map' },
//       position: { x: 0, y: 0 },
//     },
//   ],
//   edges: [],
//   onNodesChange: (changes: NodeChange[]) => {
//     set({
//       nodes: applyNodeChanges(changes, get().nodes),
//     });
//   },
//   onEdgesChange: (changes: EdgeChange[]) => {
//     set({
//       edges: applyEdgeChanges(changes, get().edges),
//     });
//   },
// }));

// export default useStore;
