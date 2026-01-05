import { useState, useCallback } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { reactStore } from "./temp-store";
import { CustomEdge } from "./edge";

const edgeTypes = {
  custom: CustomEdge,
};

export const WorkflowView = () => {
  const store = reactStore;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [nodeTypes, setNodeTypes] = useState(store.types);
  const [nodes, setNodes] = useState(store.nodes);
  const [edges, setEdges] = useState(store.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange<(typeof store.nodes)[number]>[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<(typeof store.edges)[number]>[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
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
