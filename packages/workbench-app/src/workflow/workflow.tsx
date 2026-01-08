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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomEdge } from './edge';
import { createExampleWorkflowDocumentChain } from './example-document';
import { createWorkflowStoreFromDocument } from './store-fast/create-runtime-store';
import { useReactFlowStore } from './store-fast/create-react-flow-store';
import { useCallback, useEffect, useState } from 'react';
import { persistStoreToDocument } from './store-fast/save-document';
import type { WorkflowDocumentData } from './types';
import { createWorkflowEngine } from './store/engine';
import { demo_observeBatched } from './store-fast/observe-batched';
import { observe } from '@legendapp/state';

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

    return createExampleWorkflowDocumentChain(100);
  })(),
);
const storePersistance$ = persistStoreToDocument(runtimeStore$);
const storeEngine = createWorkflowEngine(runtimeStore$.get());

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
      console.log(`[WorkflowView] Persisted document:`, { doc: x, runtimeStore$ });
      localStorage.setItem(`klivcore-workflow-document`, JSON.stringify(x, null, 2));
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
    </div>
  );
};
