import { getBezierPath, useReactFlow, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { useCallback, useMemo, useState } from 'react';
import type { WorkflowRuntimeEdge, WorkflowRuntimeStore } from './types';

export const CustomEdge = (props: {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  source: string;
  target: string;
  selected?: boolean;
  data: {
    edge: WorkflowRuntimeEdge;
    store: WorkflowRuntimeStore;
  };
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
    [fitView],
  );

  const { startX, startY, endX, endY, midX, midY } = useMemo(() => {
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

    return { startX, startY, endX, endY, midX: (startX + endX) / 2, midY: (startY + endY) / 2 };
  }, [props.sourceX, props.sourceY, props.targetX, props.targetY]);

  const [expandInfoQuick, setExpandInfoQuick] = useState(false);
  const [expandInfoSticky, setExpandInfoSticky] = useState(false);
  const expandInfo = expandInfoQuick || expandInfoSticky;

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <button
          className="nowheel nodrag nopan pointer-events-auto cursor-pointer z-50"
          style={{
            position: 'absolute',
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
            position: 'absolute',
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
        <div
          className="nowheel nodrag nopan pointer-events-auto cursor-pointer z-50"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
          }}
        >
          <div
            className={`flex h-4 w-4 cursor-help flex-row items-center justify-center rounded border border-white p-1 text-white opacity-10 hover:opacity-100 bg-black`}
            onMouseEnter={() => setExpandInfoQuick(true)}
            onMouseLeave={() => setExpandInfoQuick(false)}
            onClick={() => setExpandInfoSticky((x) => !x)}
          >
            {`🔎`}
          </div>
        </div>
        {expandInfo && (
          <div
            className="absolute z-50 text-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px) scale(0.5)`,
            }}
          >
            <div className="absolute bottom-10 flex h-50 w-50 flex-col justify-end gap-1 pointer-events-auto">
              <div className="flex flex-col flex-1 p-1 text-xs bg-blue-950 border border-blue-800 rounded nowheel nodrag nopan">
                <div className="flex flex-row items-center justify-between gap-1 p-0.5">
                  <div>{id}</div>
                  <div
                    className={`flex h-4 w-4 cursor-pointer flex-row items-center justify-center ${
                      `` //`rounded border border-white p-1 text-white`
                    } ${
                      `` //expandInfo ? `bg-blue-800` : `bg-blue-400`
                    }`}
                    onClick={() => {
                      setExpandInfoSticky(false);
                    }}
                  >
                    ✖
                  </div>
                </div>
                <textarea
                  className="flex-1 resize-none bg-black p-1"
                  value={JSON.stringify(props.data.edge.value, null, 2)}
                  readOnly
                />
              </div>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};
