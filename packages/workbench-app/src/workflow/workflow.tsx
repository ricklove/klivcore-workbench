import {
  ReactFlow,
  MiniMap,
  Controls,
  type NodeTypes,
  useReactFlow,
  type Node,
  ReactFlowProvider,
  type XYPosition,
  Panel,
  type OnConnectStartParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomEdge } from './edge';
import { createExampleWorkflowDocumentChain } from './example-document';
import { createWorkflowStoreFromDocument } from './store-fast/create-runtime-store';
import { useReactFlowStore } from './store-fast/create-react-flow-store';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { persistStoreToDocument } from './store-fast/save-document';
import { WorkflowBrandedTypes, type WorkflowDocumentData, type WorkflowNodeId } from './types';
import { createWorkflowEngine as createWorkflowEngine_direct } from './store-fast/engine-direct';
import { demo_observeBatched } from './store-fast/observe-batched';
import { observe } from '@legendapp/state';
import { optimizationStore } from './optimization-store';
import { NodeSelectionMenu } from './node-selection-menu';

const edgeTypes = {
  custom: CustomEdge,
};

const runtimeStore$ = createWorkflowStoreFromDocument(
  (() => {
    try {
      return JSON.parse(
        localStorage.getItem(`klivcore-workflow-document`) || ``,
      ) as WorkflowDocumentData;
    } catch (err) {
      console.error(`[WorkflowView] Error parsing stored workflow document`, { err });
    }

    return createExampleWorkflowDocumentChain(16);
  })(),
);
const storePersistance$ = persistStoreToDocument(runtimeStore$);

const storeEngine = createWorkflowEngine_direct(runtimeStore$);

export const WorkflowView = () => {
  return (
    <ReactFlowProvider>
      <WorkflowViewInner />
    </ReactFlowProvider>
  );
};
const WorkflowViewInner = () => {
  // const store = reactStore;

  // const runtimeStore = useMemo(() => createWorkflowStoreFromDocument(exampleWorkflowDocument), []);
  const reactFlowStore = useReactFlowStore(runtimeStore$);
  const store = reactFlowStore;

  useEffect(() => {
    const unsubscribe = observe(() => {
      const x = storePersistance$.get();
      if (!x?.nodes.length) {
        console.warn(`[WorkflowView] Persisted document is empty, skipping save.`);
        return;
      }

      console.log(`[WorkflowView] Persisted document:`, { doc: x, runtimeStore$ });
      localStorage.setItem(`klivcore-workflow-document`, JSON.stringify(x));
    });

    return () => {
      unsubscribe();
    };
  }, [runtimeStore$]);

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

  const { nodeTypes, nodes, edges, onNodesChange, onEdgesChange, onConnect } = store;

  const { setCenter, setViewport } = useReactFlow();
  const handleMiniMapNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      console.log(`MiniMap node clicked:`, { node });
      setCenter(node.position.x, node.position.y, { zoom: 1, duration: 250 });
    },
    [setCenter, setViewport],
  );
  const handleMiniMapClick = useCallback(
    (e: React.MouseEvent, position: XYPosition) => {
      console.log(`MiniMap node clicked:`, { position });
      setCenter(position.x, position.y, { zoom: 1, duration: 250 });
    },
    [setCenter, setViewport],
  );

  const [, setEngineRunning] = useState(storeEngine.running);
  const [tickSpeed, setTickSpeed] = useState(
    typeof storeEngine.tickSpeed === 'number' ? storeEngine.tickSpeed : 1000,
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

  const [autoSelectNodeId, setAutoSelectNodeId] = useState(undefined as undefined | WorkflowNodeId);
  type MenuContext = { type: `pane` } | { type: `connection`; params: OnConnectStartParams };
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    context: MenuContext;
    timestamp: number;
  } | null>(null);
  const lastClickRef = useRef<{ time: number; x: number; y: number; count: number } | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const addNodeToWorkflow = useCallback(
    async (typeNameRaw: string, position: XYPosition, connectionParams?: OnConnectStartParams) => {
      const typeName = WorkflowBrandedTypes.typeName(typeNameRaw);
      const nodeType = runtimeStore$.nodeTypes[typeName];
      if (!nodeType) {
        throw new Error(`Unknown node type: ${typeName}`);
      }
      const newId = WorkflowBrandedTypes.nodeId(`n-${typeName}-${Date.now()}`);

      const inputEdge = (() => {
        const { nodeId, handleId } = connectionParams ?? {};
        if (!nodeId || !handleId) return;

        const targetInputName =
          Object.entries(nodeType.inputs).find(([k]) => k === connectionParams?.handleId)?.[0] ??
          Object.keys(nodeType.inputs)[0];

        if (!targetInputName) {
          console.warn(`[addNode]  Target input not found: ${handleId} on node type: ${typeName}`);
          return;
        }

        return {
          inputName: targetInputName,
          fromNodeId: nodeId,
          fromOutputName: handleId,
        };
      })();

      runtimeStore$.actions.createNode({
        id: newId,
        type: typeName,
        position: { x: position.x - 64, y: position.y - 24, width: 128, height: 24 },
      });

      if (inputEdge) {
        runtimeStore$.actions.createEdge({
          source: {
            nodeId: WorkflowBrandedTypes.nodeId(inputEdge!.fromNodeId),
            outputName: WorkflowBrandedTypes.outputName(inputEdge!.fromOutputName),
          },
          target: {
            nodeId: newId,
            inputName: WorkflowBrandedTypes.inputName(inputEdge!.inputName),
          },
        });
      }

      setAutoSelectNodeId(newId);
    },
    [nodeTypes, onNodesChange],
  );

  useEffect(() => {
    if (!autoSelectNodeId) {
      return;
    }

    const node = nodes.find((n) => n.id === autoSelectNodeId);
    if (!node) {
      console.warn(`[WorkflowView] Auto-select node not found: ${autoSelectNodeId}`);
      return;
    }

    onNodesChange([{ id: autoSelectNodeId, type: `select`, selected: true }]);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoSelectNodeId(undefined);
  }, [autoSelectNodeId, nodes]);

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

              console.log(`Double click detected, opening node selection menu`, {
                x: e.clientX,
                y: e.clientY,
              });
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
              className={`px-2 py-1 rounded bg-blue-600 hover:bg-blue-700`}
              onClick={() => {
                demo_observeBatched();
              }}
            >
              {`test`}
            </button>
            <button
              className={`px-2 py-1 rounded ${storeEngine.running ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={() => {
                if (storeEngine.running) {
                  storeEngine.stop({ shouldAbort: true });
                } else {
                  storeEngine.start();
                }
                setEngineRunning(storeEngine.running);
              }}
            >
              {storeEngine.running ? `⏹ Stop` : `▶ Run`}
            </button>
            <input
              type="range"
              min="-1000"
              max="2000"
              step="10"
              value={tickSpeed}
              title={storeEngine.tickSpeed.toString()}
              className="ml-4"
              onChange={(e) => {
                const val = Number(e.target.value);
                storeEngine.tickSpeed = val < -500 ? `fast` : val < 0 ? `normal` : val;
                setTickSpeed(val);
                console.log(`[WorkflowView] Set engine tick speed to ${val}ms`);
              }}
            />
            <div>{storeEngine.tickSpeed}</div>
          </div>
        </Panel>
      </ReactFlow>
      {menu && (
        <NodeSelectionMenu
          store$={runtimeStore$}
          position={menu}
          onSelect={(type) => {
            const position = screenToFlowPosition({ x: menu.x, y: menu.y });

            if (menu.context.type === `connection`) {
              addNodeToWorkflow(type, position, menu.context.params);
            } else {
              addNodeToWorkflow(type, position);
            }

            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};
