import { snapshot, subscribe } from 'valtio';
import {
  WorkflowBrandedTypes,
  type WorkflowReactFlowStore,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
} from '../types';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
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

  const memoizeObjToArray = memoize(<T>(x: Record<string, T>) => {
    const result = Object.values(x) as T[];
    console.log(`[createReactFlowStore:memoizeObjToArray] result`, { result, memoizeObjToArray });
    return result;
  });

  const memoizeNode = memoize((x: NodeSnap): WorkflowReactFlowStore['nodes'][number] => {
    const nodeDirect = store.nodes[x.id]!;
    const result: WorkflowReactFlowStore['nodes'][number] = {
      id: x.id,
      type: x.type,
      position: { x: x.position.x, y: x.position.y },
      width: x.position.width,
      height: x.position.height,

      parentId: x.parentId,
      // mode: x.mode,
      selected: x.selected ?? false,
      data: { node: nodeDirect },
    };

    console.log(`[createReactFlowStore:memoizeNode] result`, { result, memoizeNode });
    return result;
  });
  const memoizeNodes = memoize((snap: StoreSnap) => {
    const items = memoizeObjToArray(snap.nodes as unknown as Record<string, NodeSnap>);
    const result = items.map((x) => memoizeNode(x as unknown as NodeSnap));
    // console.log(`[createReactFlowStore:memoizeNodes] result`, { result, memoizeNodes });
    return result;
  });

  const memoizeEdge = memoize((x: EdgeSnap): WorkflowReactFlowStore['edges'][number] => {
    const result = {
      id: x.id,
      type: `custom` as const,
      source: x.source.nodeId,
      sourceHandle: x.source.outputName,
      target: x.target.nodeId,
      targetHandle: x.target.inputName,
      selected: x.selected ?? false,
      data: { edge: store.edges[x.id]! as WorkflowRuntimeEdge },
    };

    console.log(`[createReactFlowStore:memoizeEdge] result`, { result, memoizeEdge });
    return result;
  });
  const memoizeEdges = memoize((snap: StoreSnap) => {
    const items = memoizeObjToArray(snap.edges as unknown as Record<string, EdgeSnap>);
    const result = items
      .map((x) => memoizeEdge(x as unknown as EdgeSnap))
      .filter((x): x is NonNullable<typeof x> => !!x);
    // console.log(`[createReactFlowStore:memoizeEdges] result`, { result, memoizeEdges });
    return result;
  });

  return {
    getStore: () => {
      const snap = snapshot(store);
      return {
        get nodeTypes() {
          // console.log(`[createReactFlowStore:get nodeTypes()]`, {
          //   store,
          //   posX: Object.values(store.nodes)[0]?.position.x,
          //   snap,
          // });
          return memoizeNodeTypes(snap as unknown as StoreSnap);
        },
        get nodes() {
          // console.log(`[createReactFlowStore:get nodes()]`, {
          //   store,
          //   posX: Object.values(store.nodes)[0]?.position.x,
          //   snap,
          // });
          return memoizeNodes(snap as unknown as StoreSnap);
        },
        get edges() {
          // console.log(`[createReactFlowStore:get edges()]`, {
          //   store,
          //   posX: Object.values(store.nodes)[0]?.position.x,
          //   snap,
          // });
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
  // const { nodeTypes, nodes, edges } = reactFlowStore;

  const [nodeTypes, setNodeTypes] = useState(() => reactFlowStore.nodeTypes);
  const [nodes, setNodes] = useState(() => reactFlowStore.nodes);
  const [edges, setEdges] = useState(() => reactFlowStore.edges);

  const SYNC_TIMEOUT = 100;
  useEffect(() => {
    const id = setTimeout(() => {
      setNodeTypes(reactFlowStore.nodeTypes);
    }, SYNC_TIMEOUT);
    return () => clearTimeout(id);
  }, [reactFlowStore.nodeTypes]);
  useEffect(() => {
    const id = setTimeout(() => {
      setNodes(reactFlowStore.nodes);
    }, SYNC_TIMEOUT);
    return () => clearTimeout(id);
  }, [reactFlowStore.nodes]);
  useEffect(() => {
    const id = setTimeout(() => {
      setEdges(reactFlowStore.edges);
    }, SYNC_TIMEOUT);
    return () => clearTimeout(id);
  }, [reactFlowStore.edges]);

  // refresh on any store change
  const [, setRenderId] = useState(0);
  useEffect(() => {
    return subscribe(store, () => {
      setTimeout(() => {
        setRenderId((s) => s + 1);
      }, SYNC_TIMEOUT);
    });
  }, [store]);

  const _store = { store }.store;
  return {
    nodeTypes,
    nodes,
    edges,
    onNodesChange: (changes: NodeChange[]) => {
      setNodes((s) => applyNodeChanges(changes, s as unknown as Node[]) as typeof nodes);

      for (const change of changes) {
        if (change.type === 'add') {
          console.log(`[useReactFlowStore] Unhandled node add`, { change });
          continue;
        }

        const node = _store.nodes[WorkflowBrandedTypes.nodeId(change.id)];
        if (!node) {
          console.log(`[useReactFlowStore] Node not found for change`, { change });
          continue;
        }

        if (change.type === 'select') {
          node.selected = change.selected;
          continue;
        }
        if (change.type === 'position') {
          node.position.x = change.position?.x ?? node.position.x;
          node.position.y = change.position?.y ?? node.position.y;
          continue;
        }

        if (change.type === 'dimensions') {
          node.position.width = change.dimensions?.width ?? node.position.width;
          node.position.height = change.dimensions?.height ?? node.position.height;
          continue;
        }

        if (change.type === `remove`) {
          store.actions.deleteNode(node.id);
          continue;
        }

        console.log(`[useReactFlowStore] Unhandled node change: `, { change, node });
      }
    },
    onEdgesChange: (changes: EdgeChange[]) => {
      setEdges((s) => applyEdgeChanges(changes, s as unknown as Edge[]) as typeof edges);

      for (const change of changes) {
        if (change.type === 'add') {
          console.log(`[useReactFlowStore] Unhandled edge add`, { change });
          continue;
        }

        const edge = _store.edges[WorkflowBrandedTypes.edgeIdFormString(change.id)];
        if (!edge) {
          console.log(`[useReactFlowStore] Node not found for change`, { change });
          continue;
        }

        if (change.type === 'select') {
          edge.selected = change.selected;
          continue;
        }

        if (change.type === `remove`) {
          store.actions.deleteEdge(edge.id);
          continue;
        }

        console.log(`[useReactFlowStore:onEdgesChange] Unhandled edge change: `, { change, edge });
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
