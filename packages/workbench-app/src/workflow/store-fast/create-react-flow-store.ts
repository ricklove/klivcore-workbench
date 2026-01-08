import type { Observable, ObserveEvent } from '@legendapp/state';
import {
  WorkflowBrandedTypes,
  type WorkflowEdgeId,
  type WorkflowNodeId,
  type WorkflowReactFlowStore,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeNodeTypeDefinition,
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
import { useEffect, useState } from 'react';
import { observeBatched, type BatchedTriggerKind } from './observe-batched';

export const useReactFlowStore = (
  store$: Observable<WorkflowRuntimeStore>,
): WorkflowReactFlowStore & {
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (params: Connection) => void;
} => {
  const [nodeTypes, setNodeTypes] = useState(() => ({}) as WorkflowReactFlowStore[`nodeTypes`]);
  const [nodes, setNodes] = useState(() => [] as WorkflowReactFlowStore[`nodes`]);
  const [edges, setEdges] = useState(() => [] as WorkflowReactFlowStore[`edges`]);

  useEffect(() => {
    const unsubs = [] as (() => void)[];

    // type changes
    unsubs.push(
      observeBatched(() => {
        setNodeTypes(() =>
          Object.fromEntries(
            Object.values(store$.nodeTypes).map(
              (nodeType$: Observable<WorkflowRuntimeNodeTypeDefinition>) => [
                nodeType$.type.get(),
                nodeType$.getComponent().Component as React.ComponentType,
              ],
            ),
          ),
        );
      }, `requestAnimationFrame`),
    );

    // TODO: delete nodes/edges

    //   unsubs.push(
    //   observeBatched(() => {
    //     setNodes((s) =>{
    //       const nodeIds =             Object.values(store$.nodeTypes).map(
    //           (node$:Observable<WorkflowRuntimeNode>) => ({
    //             nodeId: node$.id.get(),
    //     }));

    //           return s;
    //     });
    //   }, `requestAnimationFrame`),
    // );

    const trigger: BatchedTriggerKind = 250;

    // node changes
    const nodesByOldId = new Map<WorkflowNodeId, WorkflowRuntimeNode>();
    const handleNodeMissing = (oldNodeId: WorkflowNodeId, e: ObserveEvent<unknown>) => {
      const oldNodeById = nodesByOldId.get(oldNodeId);
      const newNodeId = oldNodeById?.id;
      if (newNodeId && newNodeId !== oldNodeId) {
        console.log(
          `[useReactFlowStore:handleNodeMissing] node renamed from '${oldNodeId}' to '${newNodeId}' - renaming in react flow store`,
          {
            e,
            nodeId: oldNodeId,
            oldNodeById,
            store$: store$.peek(),
          },
        );

        setNodes((s) => s.map((x) => (x.id === oldNodeId ? { ...x, id: newNodeId } : x)));
        return;
      }

      console.log(
        `[useReactFlowStore:handleNodeMissing] node '${oldNodeId}' not found - deleting from react flow store`,
        {
          e,
          nodeId: oldNodeId,
          store$: store$.peek(),
        },
      );

      nodesByOldId.delete(oldNodeId);
      setNodes((s) => s.filter((n) => n.id !== oldNodeId));
    };

    const subscribeNode = (nodeId: WorkflowNodeId, e: ObserveEvent<unknown>) => {
      const node$ = store$.nodes[nodeId];
      if (!node$) {
        handleNodeMissing(nodeId, e);
        return;
      }

      if (nodesByOldId.has(nodeId)) {
        // console.log(
        //   `[useReactFlowStore:Object.values(store$.nodes):node$] node '${nodeId}' already subscribed - skipping`,
        //   {
        //     e,
        //     nodeId,
        //     node$,
        //     node: node$.peek(),
        //   },
        // );
        return;
      }

      nodesByOldId.set(nodeId, node$.peek());
      console.log(
        `[useReactFlowStore:Object.values(store$.nodes):node$] node '${nodeId}' subscribing`,
        {
          e,
          nodeId,
          node$,
          node: node$.peek(),
        },
      );

      observeBatched((e) => {
        if (e.num > 0) {
          console.log(
            `[useReactFlowStore:Object.values(store$.nodes):node$: content] node '${nodeId}' content changed`,
            {
              e,
              nodeId,
              node$,
              node: node$.peek(),
            },
          );
        } else {
          console.log(
            `[useReactFlowStore:Object.values(store$.nodes):node$: content] node '${nodeId}' content subscribing`,
            {
              e,
              nodeId,
              node$,
              node: node$.peek(),
            },
          );
        }

        if (!node$.get()) {
          handleNodeMissing(nodeId, e);
          return;
        }
        nodesByOldId.set(nodeId, node$.peek());

        const oldId = nodeId !== node$.id.get() ? nodeId : undefined;

        const node: WorkflowReactFlowStore[`nodes`][number] = {
          id: node$.id.get(),
          type: node$.type.get(),
          position: { x: node$.position.x.get(), y: node$.position.y.get() },
          width: node$.position.width.get(),
          height: node$.position.height.get(),
          parentId: node$.parentId.get(),
          extent: node$.parentId.get() ? 'parent' : undefined,
          data: {
            node: node$.peek(),
            store: store$.peek(),
            inputs: node$.inputs.get(),
            outputs: node$.outputs.get(),
            data: node$.data.get(),
          },
        };

        setNodes((s) => {
          const index = s.findIndex((x) => x.id === (oldId ?? node.id));
          if (index === -1) {
            return [...s, node];
          }
          const newNodes = [...s];
          newNodes[index] = {
            ...newNodes[index],
            ...node,
          };
          return newNodes;
        });
      }, trigger);
    };

    unsubs.push(
      observeBatched((e) => {
        console.log(`[useReactFlowStore:nodes] node keys changed `, { e });

        Object.keys(store$.nodes).forEach((nodeIdRaw: string) => {
          subscribeNode(WorkflowBrandedTypes.nodeId(nodeIdRaw), e);
        });
      }, trigger),
    );

    // edge changes
    const handleEdgeMissing = (edgeId: WorkflowEdgeId, e: ObserveEvent<unknown>) => {
      console.log(
        `[useReactFlowStore:handleEdgeMissing] edge '${edgeId}' not found - deleting from react flow store`,
        {
          e,
          edgeId,
          store$: store$.peek(),
        },
      );

      setEdges((s) => s.filter((e) => e.id !== edgeId));
    };

    const subscribeEdge = (edgeId: WorkflowEdgeId, e: ObserveEvent<unknown>) => {
      const edge$ = store$.edges[edgeId];
      if (!edge$?.get()) {
        handleEdgeMissing(edgeId, e);
        return;
      }

      if (e.num > 0) {
        // console.log(
        //   `[useReactFlowStore:Object.values(store$.edges):edge$] edge '${edgeId}' already subscribed - skipping`,
        //   { e, edgeId, edge$, edge: edge$.peek() },
        // );
        return;
      }

      observeBatched((e) => {
        const edge$ = store$.edges[edgeId];
        if (!edge$?.get()) {
          handleEdgeMissing(edgeId, e);
          return;
        }

        console.log(
          `[useReactFlowStore:Object.values(store$.edges):edge$: content] edge '${edgeId}' content ${e.num > 0 ? `changed` : `subscribed`}`,
          {
            e,
            edgeId,
            edge$,
            edge: edge$.peek(),
          },
        );

        const edge: WorkflowReactFlowStore[`edges`][number] = {
          id: edge$.id.get(),
          type: `custom`,
          source: edge$.source.nodeId.get(),
          sourceHandle: edge$.source.outputName.get(),
          target: edge$.target.nodeId.get(),
          targetHandle: edge$.target.inputName.get(),
          data: {
            edge: edge$.peek(),
            store: store$.peek(),
          },
        };

        setEdges((s) => {
          const index = s.findIndex((x) => x.id === edge.id);
          if (index === -1) {
            return [...s, edge];
          }
          const newEdges = [...s];
          newEdges[index] = {
            ...newEdges[index],
            ...edge,
          };
          return newEdges;
        });
      }, trigger);
    };

    unsubs.push(
      observeBatched((e) => {
        console.log(`[useReactFlowStore:edges] edge keys changed `, { e });

        Object.keys(store$.edges).forEach((edgeIdRaw) => {
          subscribeEdge(WorkflowBrandedTypes.edgeIdFormString(edgeIdRaw), e);
        });
      }, trigger),
    );
    return () => {
      unsubs.forEach((x) => x());
    };
  }, [store$]);

  // const SYNC_TIMEOUT = 10000;

  // // refresh on any store change
  // const forceUpdate = () => {
  //   const reactFlowStore = reactFlowStoreAccess.getStore();
  //   setNodeTypes(() => reactFlowStore.nodeTypes);
  //   setNodes((s) => {
  //     return reactFlowStore.nodes.map((n, i) => ({
  //       ...s[i],
  //       ...n,
  //     }));
  //   });
  //   setEdges((s) => {
  //     return reactFlowStore.edges.map((n, i) => ({
  //       ...s[i],
  //       ...n,
  //     }));
  //   });
  // };

  // useEffect(() => {
  //   let timeoutId = 0 as unknown as ReturnType<typeof setTimeout>;
  //   return subscribe(store$, () => {
  //     if (timeoutId) {
  //       return;
  //     }

  //     timeoutId = setTimeout(() => {
  //       timeoutId = 0;
  //       setTimeout(() => {
  //         forceUpdate();
  //       });
  //     }, SYNC_TIMEOUT);
  //   });
  // }, [store$]);

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

        const node = store$.nodes[WorkflowBrandedTypes.nodeId(change.id)];
        if (!node?.id.get()) {
          console.log(`[useReactFlowStore] Node not found for change`, { change });
          continue;
        }

        if (change.type === 'select') {
          // ignore
          continue;
        }

        const SNAP_POS_SIZE = 8;
        const SNAP_DIM_SIZE = 8;

        if (change.type === 'position' && change.position) {
          node.position.x.set(Math.round(change.position.x / SNAP_POS_SIZE) * SNAP_POS_SIZE);
          node.position.y.set(Math.round(change.position.y / SNAP_POS_SIZE) * SNAP_POS_SIZE);
          continue;
        }

        if (change.type === 'dimensions' && change.dimensions) {
          node.position.width.set(
            Math.round(change.dimensions.width / SNAP_DIM_SIZE) * SNAP_DIM_SIZE,
          );
          node.position.height.set(
            Math.round(change.dimensions.height / SNAP_DIM_SIZE) * SNAP_DIM_SIZE,
          );
          continue;
        }

        if (change.type === `remove`) {
          store$.actions.deleteNode(node.id.get());
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

        const edge = store$.edges[WorkflowBrandedTypes.edgeIdFormString(change.id)];
        if (!edge?.id.get()) {
          console.log(`[useReactFlowStore] Edge not found for change`, { change });
          continue;
        }

        if (change.type === 'select') {
          // ignore
          continue;
        }

        if (change.type === `remove`) {
          store$.actions.deleteEdge(edge.id.get());
          continue;
        }

        console.log(`[useReactFlowStore:onEdgesChange] Unhandled edge change: `, { change, edge });
      }
    },
    onConnect: (params: Connection) => {
      const targetNode = store$.nodes[WorkflowBrandedTypes.nodeId(params.target)];
      if (!targetNode?.id.get()) {
        console.warn(`[useReactFlowStore:onConnect] Target node not found`, { params });
        return;
      }
      const targetInput = targetNode.inputs.find((x) => x.name.get() === params.targetHandle);
      if (!targetInput?.get()) {
        console.warn(`[useReactFlowStore:onConnect] Target input not found`, {
          params,
          targetNode,
        });
        return;
      }

      store$.actions.createEdge({
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
