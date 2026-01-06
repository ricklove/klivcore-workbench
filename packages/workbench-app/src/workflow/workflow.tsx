import { ReactFlow, MiniMap, Controls, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomEdge } from './edge';
import { exampleWorkflowDocument } from './store/example-document';
import { createWorkflowStoreFromDocument } from './store/create-runtime-store';
import { useReactFlowStore } from './store/create-react-flow-store';
import { useEffect } from 'react';
import { persistStoreToDocument } from './store/save-document';
import type { WorkflowDocumentData } from './types';

const edgeTypes = {
  custom: CustomEdge,
};

const runtimeStore = createWorkflowStoreFromDocument(
  (() => {
    try {
      return JSON.parse(
        localStorage.getItem(`klivcore-workflow-document`) || ``,
      ) as WorkflowDocumentData;
    } catch (err) {
      console.error(`[WorkflowView] Error parsing stored workflow document`, { err });
    }

    return exampleWorkflowDocument;
  })(),
);
const storePersistance = persistStoreToDocument(runtimeStore);

export const WorkflowView = () => {
  // const store = reactStore;

  // const runtimeStore = useMemo(() => createWorkflowStoreFromDocument(exampleWorkflowDocument), []);
  const reactFlowStore = useReactFlowStore(runtimeStore);
  const store = reactFlowStore;

  useEffect(() => {
    const { unsubscribe } = storePersistance.subscribe((x) => {
      console.log(`[WorkflowView] Persisted document:`, { doc: x, runtimeStore, store });
      localStorage.setItem(`klivcore-workflow-document`, JSON.stringify(x, null, 2));
    });

    return () => {
      unsubscribe();
    };
  }, [runtimeStore]);

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
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
