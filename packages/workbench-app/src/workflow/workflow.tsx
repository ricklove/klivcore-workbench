import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  MiniMap,
  Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { reactStore } from './temp-store';
import { CustomEdge } from './edge';
import { exampleWorkflowDocument } from './store/example-document';
import { createWorkflowStoreFromDocument } from './store/load-document';
import { useReactFlowStore } from './store/create-react-flow-store';

const edgeTypes = {
  custom: CustomEdge,
};

const runtimeStore = createWorkflowStoreFromDocument(exampleWorkflowDocument);
export const WorkflowView = () => {
  const store = reactStore;

  // const runtimeStore = useMemo(() => createWorkflowStoreFromDocument(exampleWorkflowDocument), []);
  const reactFlowStore = useReactFlowStore(runtimeStore);
  console.log(`[WorkflowView:RENDER] reactFlowStore`, {
    reactFlowStore,
    runtimeStore,
    reactFlowStore_dec: { ...reactFlowStore },
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const node = Object.values(runtimeStore.nodes)[0];
      if (!node) return;
      node.position.x += 42;
      // node.position = {
      //   ...node.position,
      //   x: node.position.x + 42,
      // };
      // runtimeStore.nodes = { ...runtimeStore.nodes };
      // node.mode = node.mode === `disabled` ? `passthrough` : `disabled`;
      console.log(`[WorkflowView:setInterval] updated node position`, {
        node,
        runtimeStore,
        posX: node.position.x,
        mode: node.mode,
      });
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [nodeTypes, setNodeTypes] = useState(store.types);
  const [nodes, setNodes] = useState(store.nodes);
  const [edges, setEdges] = useState(store.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange<(typeof store.nodes)[number]>[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<(typeof store.edges)[number]>[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  return (
    <div className="w-full h-full bg-slate-900 text-white">
      <ReactFlow
        colorMode={`dark`}
        nodeTypes={nodeTypes}
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
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
