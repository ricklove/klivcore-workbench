import {
  Controls,
  MiniMap,
  type Node,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStartParams,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { enableReactTracking } from '@legendapp/state/config/enableReactTracking';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { CustomEdge } from './edge';
import { engineController$ } from './engine-controller';
import { NodeSelectionMenu } from './node-selection-menu';
import { optimizationStore } from './optimization-store';
import { useReactFlowStore } from './store-fast/create-react-flow-store';
import { demo_observeBatched } from './store-fast/observe-batched';
import {
  WorkflowBrandedTypes,
  type WorkflowNodeId,
  type WorkflowRuntimeStore,
} from './types';
import { workflowTreeStore$ } from './workflow-tree';
import { Memo, useValue } from '@legendapp/state/react';
import type { Observable } from '@legendapp/state';

enableReactTracking({
  warnMissingUse: true,
});

const edgeTypes = {
  custom: CustomEdge,
};

export const WorkflowView = () => {
  const { runtimeStore$ } = useValue(() => workflowTreeStore$.active.get());

  if (!runtimeStore$) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white">
        No active workflow
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkflowViewInner
        runtimeStore$={runtimeStore$}
        key={runtimeStore$._instanceId.peek()}
      />
    </ReactFlowProvider>
  );
};
const WorkflowViewInner = ({
  runtimeStore$,
}: {
  runtimeStore$: Observable<WorkflowRuntimeStore>;
}) => {
  // const storeEngine = useValue(() => runtimeStore$.engine.get());

  // const runtimeStore = useMemo(() => createWorkflowStoreFromDocument(exampleWorkflowDocument), []);
  const reactFlowStore = useReactFlowStore(runtimeStore$);
  const store = reactFlowStore;

  // console.log(`[WorkflowView:RENDER] reactFlowStore`, {
  //   reactFlowStore,
  //   runtimeStore,
  //   reactFlowStore_dec: { ...reactFlowStore },
  // });

  // useEffect(() => {
  //   const intervalId = setInterval(() => {
  //     const node = Object.values(runtimeStore.nodes)[0];
  //     if (!node) return;
  //     node.position.x += 42;
  //     // node.position = {
  //     //   ...node.position,
  //     //   x: node.position.x + 42,
  //     // };
  //     // runtimeStore.nodes = { ...runtimeStore.nodes };
  //     // node.mode = node.mode === `disabled` ? `passthrough` : `disabled`;
  //     console.log(`[WorkflowView:setInterval] updated node position`, {
  //       node,
  //       runtimeStore,
  //       posX: node.position.x,
  //       mode: node.mode,
  //     });
  //   }, 10000);
  //   return () => clearInterval(intervalId);
  // }, []);

  // const [nodeTypes, setNodeTypes] = useState(store.nodeTypes);
  // const [nodes, setNodes] = useState(store.nodes);
  // const [edges, setEdges] = useState(store.edges);

  // const onNodesChange = useCallback(
  //   (changes: NodeChange<(typeof store.nodes)[number]>[]) =>
  //     setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
  //   [],
  // );
  // const onEdgesChange = useCallback(
  //   (changes: EdgeChange<(typeof store.edges)[number]>[]) =>
  //     setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
  //   [],
  // );
  // const onConnect = useCallback(
  //   (params: Connection) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
  //   [],
  // );

  const { nodeTypes, nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    store;

  const { setCenter } = useReactFlow();
  const handleMiniMapNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      console.log(`MiniMap node clicked:`, { node });
      setCenter(node.position.x, node.position.y, { zoom: 1, duration: 250 });
    },
    [setCenter],
  );
  const handleMiniMapClick = useCallback(
    (_e: React.MouseEvent, position: XYPosition) => {
      console.log(`MiniMap node clicked:`, { position });
      setCenter(position.x, position.y, { zoom: 1, duration: 250 });
    },
    [setCenter],
  );

  useLayoutEffect(() => {
    const isMultiSelection = (() => {
      let selectedCount = 0;
      for (const n of nodes as { selected?: boolean }[]) {
        if (n.selected) {
          selectedCount++;
          if (selectedCount > 1) {
            return true;
          }
        }
      }
      return false;
    })();

    if (optimizationStore.isMultiSelection$.get() === isMultiSelection) {
      return;
    }
    optimizationStore.isMultiSelection$.set(isMultiSelection);
  }, [nodes]);

  const [autoSelectNodeId, setAutoSelectNodeId] = useState(
    undefined as undefined | WorkflowNodeId,
  );
  type MenuContext =
    | { type: `pane` }
    | { type: `connection`; params: OnConnectStartParams };
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    context: MenuContext;
    timestamp: number;
  } | null>(null);
  const lastClickRef = useRef<{
    time: number;
    x: number;
    y: number;
    count: number;
  } | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const addNodeToWorkflow = useCallback(
    async (
      typeNameRaw: string,
      position: XYPosition,
      connectionParams?: OnConnectStartParams,
    ) => {
      const typeName = WorkflowBrandedTypes.typeName(typeNameRaw);
      const nodeType = runtimeStore$.nodeTypes[typeName]?.peek();
      if (!nodeType) {
        throw new Error(`Unknown node type: ${typeName}`);
      }
      const newId = WorkflowBrandedTypes.nodeId(`n-${typeName}-${Date.now()}`);

      const inputEdge = (() => {
        const { nodeId, handleId } = connectionParams ?? {};
        if (!nodeId || !handleId) return;

        const targetInputName =
          Object.entries(nodeType.inputs).find(
            ([k]) => k === connectionParams?.handleId,
          )?.[0] ?? Object.values(nodeType.inputs)[0]?.name;

        if (!targetInputName) {
          console.warn(
            `[addNode]  Target input not found: ${handleId} on node type: ${typeName}`,
          );
          return;
        }

        return {
          inputName: targetInputName,
          fromNodeId: nodeId,
          fromOutputName: handleId,
        };
      })();

      const s = nodeType.defaultSize ??
        (() => {
          // clone the last nodes size as the default size
          const nodes = runtimeStore$.get().nodes;
          const nodesOfType = Object.values(nodes).filter(
            (n) => n.type === typeName,
          );
          if (nodesOfType.length === 0) {
            return undefined;
          }
          const lastNode = nodesOfType[nodesOfType.length - 1];
          if (!lastNode) {
            return undefined;
          }
          return {
            width: lastNode.position.width,
            height: lastNode.position.height,
          };
        })() ?? { width: 128, height: 24 };
      runtimeStore$.actions.createNode({
        id: newId,
        type: typeName,
        position: { x: position.x - s.width / 2, y: position.y - 24, ...s },
      });

      console.log(`[WorkflowView] Added node to workflow`, {
        typeName,
        position,
        newId,
        inputEdge,
      });

      if (inputEdge) {
        runtimeStore$.actions.createEdge({
          source: {
            nodeId: WorkflowBrandedTypes.nodeId(inputEdge?.fromNodeId),
            outputName: WorkflowBrandedTypes.outputName(
              inputEdge?.fromOutputName,
            ),
          },
          target: {
            nodeId: newId,
            inputName: WorkflowBrandedTypes.inputName(inputEdge?.inputName),
          },
        });
      }

      setAutoSelectNodeId(newId);
    },
    [runtimeStore$],
  );

  useEffect(() => {
    if (!autoSelectNodeId) {
      return;
    }

    const node = nodes.find((n) => n.id === autoSelectNodeId);
    if (!node) {
      console.warn(
        `[WorkflowView] Auto-select node not found: ${autoSelectNodeId}`,
      );
      return;
    }

    onNodesChange([{ id: autoSelectNodeId, type: `select`, selected: true }]);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoSelectNodeId(undefined);
  }, [autoSelectNodeId, nodes, onNodesChange]);

  const onConnectEnd: OnConnectEnd = useCallback((event, connectionState) => {
    if (connectionState.isValid) {
      // handled
      return;
    }
    const { clientX, clientY } =
      ('changedTouches' in event ? event.changedTouches[0] : event) ?? {};
    if (!clientX || !clientY) {
      console.warn('[onConnectEnd] No clientX/clientY on event', { event });
      return;
    }

    const fromNodeId = connectionState.fromNode?.id;
    const fromHandleId = connectionState.fromHandle?.id;

    const toNodeId = connectionState.toNode?.id;
    const toHandleId = connectionState.toHandle?.id;
    const params =
      fromNodeId && fromHandleId
        ? {
            nodeId: fromNodeId,
            handleId: fromHandleId,
            handleType: `source` as const,
          }
        : toNodeId && toHandleId
          ? {
              nodeId: toNodeId,
              handleId: toHandleId,
              handleType: `target` as const,
            }
          : undefined;

    if (!params) {
      console.warn('[onConnectEnd] missing fromNodeId or fromHandleId', {
        fromNodeId,
        fromHandleId,
      });
      return;
    }

    setMenu({
      timestamp: Date.now(),
      x: clientX,
      y: clientY,
      context: {
        type: `connection`,
        params,
      },
    });

    // const position = screenToFlowPosition({
    //   x: clientX,
    //   y: clientY,
    // });

    // // when a connection is dropped on the pane it's not valid
    // addNodeToWorkflow(`string`, position, {
    //   nodeId: connectionState.nodeId,
    //   handleId: connectionState.handleId,
    // });
  }, []);

  const isEngineRunning = useValue(() => engineController$.running.get());
  const tickSpeed = useValue(() => engineController$.tickSpeed.get());
  const workflowTreeActivePathSegments = useValue(() =>
    workflowTreeStore$.activePathSegments.get(),
  );

  return (
    <div className="w-full h-full bg-slate-900 text-white">
      <ReactFlow
        colorMode={`dark`}
        nodeTypes={nodeTypes as NodeTypes}
        edgeTypes={edgeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        fitView
        minZoom={0.1}
        maxZoom={4}
        deleteKeyCode={[`Delete`]}
        onlyRenderVisibleElements={true}
        snapToGrid={true}
        snapGrid={[8, 8]}
        zoomOnDoubleClick={false}
        onPaneClick={(e) => {
          console.log(`onPaneClick`, { e });
          if (menu && Date.now() > menu.timestamp + 500) {
            setMenu(null);
            lastClickRef.current = null;
            return;
          }

          const now = Date.now();

          // if (
          //   lastClickRef.current &&
          //   now - lastClickRef.current.time < 400 &&
          //   lastClickRef.current.count >= 2
          // ) {
          //   console.log(`Triple click detected, adding default node`, {
          //     x: e.clientX,
          //     y: e.clientY,
          //   });
          //   addNodeToWorkflow(`string`, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
          //   lastClickRef.current = null;
          //   return;
          // }

          if (
            lastClickRef.current &&
            now - lastClickRef.current.time < 300 &&
            lastClickRef.current.count >= 1
          ) {
            // wait to see if it's a triple click
            setTimeout(() => {
              if (!lastClickRef.current) {
                // already handled as triple click
                return;
              }

              console.log(
                `Double click detected, opening node selection menu`,
                {
                  x: e.clientX,
                  y: e.clientY,
                },
              );
              setMenu({
                timestamp: Date.now(),
                x: e.clientX,
                y: e.clientY,
                context: { type: `pane` },
              });
              lastClickRef.current = null;
            }, 0);
            return;
          }

          lastClickRef.current = {
            time: now,
            x: e.clientX,
            y: e.clientY,
            count: (lastClickRef.current?.count ?? 0) + 1 || 1,
          };
        }}
      >
        {/* <Background /> */}
        <Controls />
        <MiniMap
          pannable
          zoomable
          onNodeClick={handleMiniMapNodeClick}
          onClick={handleMiniMapClick}
        />
        <Panel position="top-left">
          <div className="flex flex-row items-center gap-1">
            <button
              type="button"
              className={`px-2 py-1 rounded bg-blue-600 hover:bg-blue-700`}
              onClick={() => {
                demo_observeBatched();
              }}
            >
              {`test`}
            </button>
            <button
              className={`px-2 py-1 rounded ${isEngineRunning ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={() => {
                engineController$.running.set(
                  !engineController$.running.peek(),
                );
              }}
            >
              {isEngineRunning ? `⏹ Stop` : `▶ Run`}
            </button>
            <input
              type="range"
              min="-1000"
              max="2000"
              step="10"
              value={tickSpeed}
              title={tickSpeed.toString()}
              className="ml-4"
              onChange={(e) => {
                const val = Number(e.target.value);
                const tickSpeed =
                  val < -500 ? `fast` : val < 0 ? `normal` : val;
                engineController$.tickSpeed.set(tickSpeed);
                console.log(`[WorkflowView] Set engine tick speed to ${val}ms`);
              }}
            />
            <div>{tickSpeed}</div>
            <div className="flex flex-row items-center gap-1 flex-wrap">
              {workflowTreeActivePathSegments.map((segment, i) =>
                i === workflowTreeActivePathSegments.length - 1 ? (
                  <div
                    key={segment.instanceId}
                    className="font-bold text-blue-400"
                  >
                    {segment.name}
                  </div>
                ) : (
                  <div
                    key={segment.instanceId}
                    className="flex flex-row items-center gap-1"
                  >
                    <button
                      className="hover:text-blue-400 cursor-pointer"
                      onClick={() => {
                        workflowTreeStore$.actions.popSubflow(
                          segment.instanceId,
                        );
                      }}
                    >
                      {segment.name}
                    </button>
                    <span className="text-gray-400">{`/`}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </Panel>
      </ReactFlow>
      {menu && (
        <NodeSelectionMenu
          store$={runtimeStore$}
          position={menu}
          onSelect={(type) => {
            const position = screenToFlowPosition({ x: menu.x, y: menu.y });

            console.log(`[WorkflowView] Node type selected: ${type}`, {
              position,
              menu,
            });
            if (menu.context.type === `connection`) {
              addNodeToWorkflow(type, position, menu.context.params);
            } else {
              addNodeToWorkflow(type, position);
            }

            setMenu(null);
          }}
          onClose={() => setMenu(null)}
          filterDefaultNodeTypes={
            menu.context.type !== `connection`
              ? (x) => x.type !== `reroute`
              : undefined
          }
        />
      )}
    </div>
  );
};
