import { snapshot, subscribe } from 'valtio';
import {
  WorkflowBrandedTypes,
  type WorkflowReactFlowStore,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
} from '../types';
import { type EdgeChange, type NodeChange } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { memoize } from 'proxy-memoize';

export const createReactFlowStore = (store: WorkflowRuntimeStore): WorkflowReactFlowStore => {
  // typescript is breaking when trying to infer Snapshot<>
  type StoreSnap = WorkflowRuntimeStore;
  type NodeSnap = WorkflowRuntimeNode;
  type EdgeSnap = WorkflowRuntimeEdge;

  const memoizeNodeTypes = memoize((store: StoreSnap) =>
    Object.fromEntries(
      Object.values(store.nodeTypes).map((x) => [x.type, x.component as React.ComponentType]),
    ),
  );

  const memoizeNode = memoize((x: NodeSnap) => {
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
  const memoizeNodes = memoize((snap: StoreSnap) =>
    Object.values(snap.nodes).map((x) => memoizeNode(x)),
  );

  const memoizeEdge = memoize((x: EdgeSnap) =>
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
  const memoizeEdges = memoize((snap: StoreSnap) =>
    Object.values(snap.edges as unknown as WorkflowRuntimeEdge[])
      .map((x) => memoizeEdge(x))
      .filter((x): x is NonNullable<typeof x> => !!x),
  );

  return {
    get nodeTypes() {
      return memoizeNodeTypes(snapshot(store) as unknown as StoreSnap);
    },
    get nodes() {
      return memoizeNodes(snapshot(store) as unknown as StoreSnap);
    },
    get edges() {
      return memoizeEdges(snapshot(store) as unknown as StoreSnap);
    },
  };
};

export const useReactFlowStore = (
  store: WorkflowRuntimeStore,
): WorkflowReactFlowStore & {
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
} => {
  const reactFlowStore = useMemo(() => createReactFlowStore(store), [store]);

  // refresh on any store change
  const [, setRenderId] = useState(0);
  useEffect(() => {
    return subscribe(store, () => {
      setRenderId((s) => s + 1);
    });
  }, [store]);

  const _store = { store }.store;
  return {
    nodeTypes: reactFlowStore.nodeTypes,
    nodes: reactFlowStore.nodes,
    edges: reactFlowStore.edges,
    onNodesChange: (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' || change.type === 'dimensions') {
          const node = _store.nodes[WorkflowBrandedTypes.nodeId(change.id)];
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
