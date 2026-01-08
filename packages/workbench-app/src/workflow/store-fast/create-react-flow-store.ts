import type { Observable } from '@legendapp/state';
import {
  WorkflowBrandedTypes,
  type WorkflowReactFlowStore,
  type WorkflowRuntimeEdge,
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
    unsubs.push(
      observeBatched((e) => {
        Object.values(store$.nodes).forEach((node$: Observable<WorkflowRuntimeNode>) => {
          console.log(
            `[useReactFlowStore:Object.values(store$.nodes):node$] node '${node$.id.peek()}' instance changed`,
            {
              e,
              id: node$.id.peek(),
              node$,
              node: node$.peek(),
            },
          );

          observeBatched((e) => {
            console.log(
              `[useReactFlowStore:Object.values(store$.nodes):node$: content] node '${node$.id.peek()}' content changed`,
              {
                e,
                id: node$.id.peek(),
                node$,
                node: node$.peek(),
              },
            );

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
              const index = s.findIndex((x) => x.id === node.id);
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
        });
      }, trigger),
    );

    // edge changes
    unsubs.push(
      observeBatched(() => {
        Object.values(store$.edges).forEach((edge$: Observable<WorkflowRuntimeEdge>) => {
          observeBatched(() => {
            const edge: WorkflowReactFlowStore[`edges`][number] = {
              id: edge$.id.get(),
              type: `custom`,
              source: edge$.source.nodeId.get(),
              sourceHandle: edge$.source.outputName.get(),
              target: edge$.target.nodeId.get(),
              targetHandle: edge$.target.inputName.get(),
              data: {
                edge: edge$.get(),
                store: store$.get(),
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
          console.log(`[useReactFlowStore] Node not found for change`, { change });
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
