import { snapshot, subscribe } from 'valtio';
import {
  WorkflowBrandedTypes,
  type WorkflowReactFlowStore,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
} from '../types';
import { type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { memoize } from 'proxy-memoize';

export const createReactFlowStore = (
  store: WorkflowRuntimeStore,
): { getStore: () => WorkflowReactFlowStore } => {
  // typescript is breaking when trying to infer Snapshot<>
  type StoreSnap = WorkflowRuntimeStore;

  type NodeSnap = WorkflowRuntimeNode;
  type EdgeSnap = WorkflowRuntimeEdge;

  const memoizeNodeTypes = memoize((store: StoreSnap) =>
    Object.fromEntries(
      Object.values(store.nodeTypes).map((x) => [
        x.type,
        x.component.Component as React.ComponentType,
      ]),
    ),
  );

  const memorizeObjToArray = memoize(<T>(x: Record<string, T>) => {
    const result = Object.values(x) as T[];
    console.log(`[createReactFlowStore:memorizeObjToArray] result`, { result, memorizeObjToArray });
    return result;
  });

  const memoizeNode = memoize((x: NodeSnap) => {
    const nodeDirect = store.nodes[x.id]!;
    const result = {
      id: x.id,
      type: x.type,
      position: { x: x.position.x, y: x.position.y },
      width: x.position.width,
      height: x.position.height,

      parentId: x.parentId,
      mode: x.mode,
      data: { node: nodeDirect },
    };

    console.log(`[createReactFlowStore:memoizeNode] result`, { result, memoizeNode });
    return result;
  });
  const memoizeNodes = (snap: StoreSnap) => {
    const items = memorizeObjToArray(snap.nodes as unknown as Record<string, NodeSnap>);
    const result = items.map((x) => memoizeNode(x as unknown as NodeSnap));
    console.log(`[createReactFlowStore:memoizeNodes] result`, { result, memoizeNodes });
    return result;
  };

  const memoizeEdge = memoize((x: EdgeSnap) => ({
    id: x.id,
    type: `custom` as const,
    source: x.source.nodeId,
    sourceHandle: x.source.outputName,
    target: x.target.nodeId,
    targetHandle: x.target.inputName,
    data: { edge: store.edges[x.id]! as WorkflowRuntimeEdge },
  }));
  const memoizeEdges = memoize((snap: StoreSnap) => {
    const items = memorizeObjToArray(snap.edges as unknown as Record<string, EdgeSnap>);
    const result = items
      .map((x) => memoizeEdge(x as unknown as EdgeSnap))
      .filter((x): x is NonNullable<typeof x> => !!x);
    console.log(`[createReactFlowStore:memoizeEdges] result`, { result, memoizeEdges });
    return result;
  });

  return {
    getStore: () => {
      const snap = snapshot(store);
      return {
        get nodeTypes() {
          console.log(`[createReactFlowStore:get nodeTypes()]`, {
            store,
            posX: Object.values(store.nodes)[0]?.position.x,
            snap,
          });
          return memoizeNodeTypes(snap as unknown as StoreSnap);
        },
        get nodes() {
          console.log(`[createReactFlowStore:get nodes()]`, {
            store,
            posX: Object.values(store.nodes)[0]?.position.x,
            snap,
          });
          return memoizeNodes(
            snap as unknown as StoreSnap,
          ) as unknown as WorkflowReactFlowStore['nodes'];
        },
        get edges() {
          console.log(`[createReactFlowStore:get edges()]`, {
            store,
            posX: Object.values(store.nodes)[0]?.position.x,
            snap,
          });
          return memoizeEdges(snap as unknown as StoreSnap);
        },
      };
    },
  };
};

export const useReactFlowStore = (
  store: WorkflowRuntimeStore,
): WorkflowReactFlowStore & {
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (params: Connection) => void;
} => {
  const reactFlowStoreAccess = useMemo(() => createReactFlowStore(store), [store]);
  const reactFlowStore = reactFlowStoreAccess.getStore();

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
    onConnect: (params: Connection) => {
      store.actions.createEdge({
        source: {
          nodeId: WorkflowBrandedTypes.nodeId(params.source),
          outputName: WorkflowBrandedTypes.outputName(params.sourceHandle!),
        },
        target: {
          nodeId: WorkflowBrandedTypes.nodeId(params.target),
          inputName: WorkflowBrandedTypes.inputName(params.targetHandle!),
        },
      });
    },
  };
};
