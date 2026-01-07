import { Handle, NodeResizer, Position, useReactFlow } from '@xyflow/react';
import React, { useCallback, useState } from 'react';
import { WorkflowBrandedTypes, type WorkflowComponentProps } from './types';

export const NodeDefault = (props: WorkflowComponentProps) => {
  return (
    <>
      <NodeWrapperSimple {...props}>
        <div className="text-white">Node {props.id}</div>
      </NodeWrapperSimple>
    </>
  );
};

export const NodeWrapperSimple = (
  props: WorkflowComponentProps & {
    children: React.ReactNode;
  },
) => {
  return <NodeWrapper {...props} />;
};

// const debug = false;

const BASE_HANDLE_TOP_OFFSET_PX = 20;
const BASE_HANDLE_SIDE_OFFSET_PX = 6;
const HANDLE_VERTICAL_SPACING_PX = 25;

const NodeWrapper = ({
  children,
  id,
  selected,
  data: dataReactFlow,
}: WorkflowComponentProps & {
  children: React.ReactNode;
}) => {
  // console.log(`[NodeWrapper] rendering node ${id}`, { data });
  const { deleteElements, fitView } = useReactFlow();

  const [displayName, setDisplayName] = useState(WorkflowBrandedTypes.nodeIdToString(id));
  const oldId = React.useRef(id);
  // eslint-disable-next-line react-hooks/refs
  if (oldId.current !== id) {
    // eslint-disable-next-line react-hooks/refs
    oldId.current = id;
    setDisplayName(id);
  }

  const { node, store } = dataReactFlow;

  const handleDisplayNameChange = useCallback(() => {
    const value = displayName.trim();
    console.log(`[NodeWrapper] handleDisplayNameChange`, { value });
    store.actions.renameNode({ oldId: node.id, newId: value });
  }, [displayName]);

  const handleDeleteNode = () => {
    console.log(`[NodeWrapper] handleDeleteNode`, { id });
    deleteElements({ nodes: [{ id }] });
  };

  const moveToNode = useCallback(
    (id: string) => fitView({ nodes: [{ id }], duration: 250 }),
    [fitView],
  );

  const [expandInfoRaw, setExpandInfo] = useState(false as false | `data` | `document`);
  const [expandInfoQuick, setExpandInfoQuick] = useState(false);
  const expandInfo = expandInfoRaw || (expandInfoQuick ? `data` : false);

  const typeName = node.type;
  const inputs = node.inputs;
  const outputs = node.outputs;

  return (
    <>
      <NodeResizer isVisible={selected} />
      <div className="absolute top-0 left-0 right-0 z-10 h-0">
        <div className="absolute bottom-0 left-0 right-0 ">
          {expandInfo && (
            <div className="absolute top-0 left-0 right-0 h-0 scale-50">
              <div
                className="absolute bottom-10 flex min-h-[600px] flex-col justify-end gap-1"
                style={{ width: `200%`, marginLeft: `-50%` }}
              >
                <div className="flex flex-col flex-1 p-1 text-xs bg-blue-950 border border-blue-800 rounded nowheel nodrag nopan">
                  <div className="flex flex-row items-center justify-between gap-1 p-0.5">
                    <div>{id}</div>
                    <div>{typeName}</div>
                    <div
                      className={`flex h-4 w-4 cursor-pointer flex-row items-center justify-center ${
                        `` //`rounded border border-white p-1 text-white`
                      } ${
                        `` //expandInfo ? `bg-blue-800` : `bg-blue-400`
                      }`}
                      onClick={() => {
                        setExpandInfo(false);
                      }}
                    >
                      ✖
                    </div>
                  </div>
                  <textarea
                    className="min-h-[200px] flex-1 resize-none bg-black p-1"
                    value={JSON.stringify(
                      expandInfo === `data`
                        ? { inputs: node.inputs, data: node.data, outputs: node.outputs }
                        : node,
                      null,
                      2,
                    )}
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-row items-center gap-1 p-1 rounded-t opacity-0 hover:opacity-100 bg-slate-500/25">
            <div className="">{`🔷`}</div>
            <div className="flex flex-row items-center flex-1 min-w-0 gap-1 nowheel nodrag nopan ">
              <input
                type="text"
                className={`min-w-0 flex-1 font-bold text-xs text-white`}
                // className={`mb-1 flex-1 overflow-hidden border-none font-bold bg-transparent overflow-ellipsis focus:outline-none`}
                title={`${displayName}: ${typeName}`}
                value={displayName}
                onChange={(x) => setDisplayName(x.target.value)}
                onBlur={handleDisplayNameChange}
              />
              {/* {data.refresh && (
                <div
                  className={`flex h-4 w-4 cursor-pointer flex-row items-center justify-center rounded border border-white p-1 text-white`}
                  onClick={() => data.refresh?.()}
                >
                  {`▶️`}
                </div>
              )} */}
              <div
                className={`flex h-4 w-4 cursor-help flex-row items-center justify-center rounded border border-white p-1 text-white`}
                onClick={() => {
                  setExpandInfo((s) => (s === `data` ? false : `data`));
                  console.log(`dataReactFlow ${id}`, dataReactFlow);
                }}
                onMouseEnter={() => setExpandInfoQuick(true)}
                onMouseLeave={() => setExpandInfoQuick(false)}
              >
                {`🔎`}
              </div>
              <div
                className={`flex h-4 w-4 cursor-help flex-row items-center justify-center rounded border border-white p-1 text-white ${
                  expandInfo ? `bg-blue-800` : `bg-blue-400`
                }`}
                onClick={() => setExpandInfo((s) => (s === `document` ? false : `document`))}
              >
                {`ℹ`}
              </div>
              <div
                className={`flex h-4 w-4 cursor-pointer flex-row items-center justify-center rounded border border-white bg-red-400 p-1 text-white`}
                onClick={handleDeleteNode}
              >
                {`🗑️`}
              </div>
            </div>
          </div>
        </div>
      </div>
      {children}
      {Object.values(inputs).map((input, index) => {
        const key = input.name;
        const edge = input.getEdge();
        return (
          <React.Fragment key={key}>
            {/* {debug && (
            <div
              className="absolute top-0 left-0 p-1 text-xs text-white bg-black rounded opacity-90"
              style={{
                top: `${BASE_HANDLE_TOP_OFFSET_PX + index * HANDLE_VERTICAL_SPACING_PX}px`,
                left: `-${BASE_HANDLE_SIDE_OFFSET_PX + 40}px`,
              }}
            >
              in {key} {value.id}: {JSON.stringify(value.lastValue)?.substring(0, 100)}
            </div>
          )} */}
            <Handle
              type="target"
              position={Position.Left}
              id={key}
              style={{
                width: `12px`,
                height: `12px`,
                ...(edge
                  ? { background: `#44aa44`, borderColor: `#44aa44` }
                  : { background: `#777777`, borderColor: `#777777` }),
                top: `${BASE_HANDLE_TOP_OFFSET_PX + index * HANDLE_VERTICAL_SPACING_PX}px`,
                left: `-${BASE_HANDLE_SIDE_OFFSET_PX}px`,
                borderTopRightRadius: `0px`,
                borderBottomRightRadius: `0px`,
              }}
              // className="hover:top-0"
            >
              <div className="absolute right-0 opacity-0 hover:opacity-100">
                <div className="flex flex-row items-center gap-1 relative p-1 text-xs border rounded bg-slate-700 border-slate-800 bottom-2 right-4 pointer-events-none">
                  {edge && (
                    <div
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => moveToNode(edge.source.nodeId)}
                      title={`Go to '${edge.source.nodeId}'`}
                    >
                      🔗
                    </div>
                  )}
                  <div>{key}</div>
                </div>
              </div>
            </Handle>
          </React.Fragment>
        );
      })}
      {Object.values(outputs).map((output, index) => {
        const key = output.name;
        const edges = output.getEdges();
        return (
          <React.Fragment key={key}>
            {/* {debug && (
            <div
              className="absolute left-0 p-1 text-xs text-white bg-black rounded top-16 opacity-90"
              style={{
                top: `${BASE_HANDLE_TOP_OFFSET_PX + index * HANDLE_VERTICAL_SPACING_PX}px`,
                left: `-${BASE_HANDLE_SIDE_OFFSET_PX + 40}px`,
              }}
            >
              out {key} {value.id}: {JSON.stringify(value.lastValue)?.substring(0, 100)}
            </div>
          )} */}
            <Handle
              type="source"
              position={Position.Right}
              id={key}
              style={{
                width: `12px`,
                height: `12px`,
                ...(edges.length
                  ? { background: `#44aa44`, borderColor: `#44aa44` }
                  : { background: `#777777`, borderColor: `#777777` }),
                top: `${BASE_HANDLE_TOP_OFFSET_PX + index * HANDLE_VERTICAL_SPACING_PX}px`,
                right: `-${BASE_HANDLE_SIDE_OFFSET_PX}px`,
                borderTopLeftRadius: `0px`,
                borderBottomLeftRadius: `0px`,
              }}
            >
              <div className="absolute left-0 opacity-0 hover:opacity-100">
                <div className="relative p-1 text-xs border rounded pointer-events-none bg-slate-700 border-slate-800 bottom-2 left-4">
                  {key}
                </div>
              </div>
            </Handle>
          </React.Fragment>
        );
      })}
    </>
  );
};
