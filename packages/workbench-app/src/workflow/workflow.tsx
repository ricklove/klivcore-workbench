import { useState, useCallback, useMemo } from "react";
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
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { reactNodeStore } from "./store";

export const WorkflowView = () => {
  const store = reactNodeStore;

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

export const CustomEdge = (props: {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  source: string;
  target: string;
}) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  const { id } = props;

  const { fitView } = useReactFlow();
  const moveToNode = useCallback(
    (id: string) => fitView({ nodes: [{ id }] }),
    [fitView]
  );
  // const moveToPosition = useCallback(
  //   ({ x, y }: { x: number; y: number }) =>
  //     setViewport({ x, y, zoom: getViewport().zoom }, { duration: 250 }),
  //   [setViewport, getViewport]
  // );

  const { startX, startY, endX, endY } = useMemo(() => {
    const offset = 5;
    const { sourceX, sourceY, targetX, targetY } = {
      sourceX: props.sourceX + offset,
      sourceY: props.sourceY,
      targetX: props.targetX - offset,
      targetY: props.targetY,
    };

    const lenSq = (targetX - sourceX) ** 2 + (targetY - sourceY) ** 2;
    const len = Math.sqrt(lenSq);

    const gap = 5;
    const gapX = ((targetX - sourceX) / len) * gap;
    const gapY = ((targetY - sourceY) / len) * gap;

    const startX = sourceX + gapX;
    const startY = sourceY + gapY;
    const endX = targetX - gapX;
    const endY = targetY - gapY;

    return { startX, startY, endX, endY };
  }, [props.sourceX, props.sourceY, props.targetX, props.targetY]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <button
          className="nowheel nodrag nopan pointer-events-auto cursor-pointer z-10"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${startX}px, ${startY}px)`,
          }}
          onClick={() => moveToNode(props.target)}
        >
          <div className="rounded-full border-[0.25px] border-gray-600 bg-gray-900 w-1 h-1 hover:scale-200"></div>
        </button>
        <button
          className="nowheel nodrag nopan pointer-events-auto cursor-pointer z-10"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${endX}px, ${endY}px)`,
          }}
          onClick={() => moveToNode(props.source)}
        >
          <div className="rounded-full border-[0.25px] border-gray-600 bg-gray-900 w-1 h-1 hover:scale-200"></div>
        </button>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};
