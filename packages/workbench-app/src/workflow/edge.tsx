import {
  getBezierPath,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
} from "@xyflow/react";
import { useCallback, useMemo } from "react";

export const CustomEdge = (props: {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  source: string;
  target: string;
  selected?: boolean;
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
    (id: string) => fitView({ nodes: [{ id }], duration: 250 }),
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
          className="nowheel nodrag nopan pointer-events-auto cursor-pointer z-50"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${startX}px, ${startY}px)`,
          }}
          onClick={() => moveToNode(props.target)}
        >
          <div
            className={`rounded-full   hover:scale-200 ${
              props.selected
                ? `w-3 h-3 border border-blue-600 bg-blue-900`
                : `w-1 h-1 border-[0.25px] border-gray-600 bg-gray-900`
            }`}
          ></div>
        </button>
        <button
          className="nowheel nodrag nopan pointer-events-auto cursor-pointer z-50"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${endX}px, ${endY}px)`,
          }}
          onClick={() => moveToNode(props.source)}
        >
          <div
            className={`rounded-full   hover:scale-200 ${
              props.selected
                ? `w-3 h-3 border border-blue-600 bg-blue-900`
                : `w-1 h-1 border-[0.25px] border-gray-600 bg-gray-900`
            }`}
          ></div>
        </button>
      </EdgeLabelRenderer>
    </>
  );
};
