import { Handle, NodeResizer, Position, useReactFlow } from '@xyflow/react';
import React, { memo, useCallback, useState } from 'react';
import { WorkflowBrandedTypes, type WorkflowComponentProps } from './types';
import { Computed, Memo, useValue } from '@legendapp/state/react';
import { optimizationStore } from './optimization-store';

export const WorkflowNodeDefault = (props: WorkflowComponentProps) => {
  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="text-white">Node {props.id}</div>
      </WorkflowNodeWrapperSimple>
    </>
  );
};

export const WorkflowNodeWrapperSimple = (
  props: WorkflowComponentProps & {
    children: React.ReactNode;
  },
) => {
  return <WorkflowNodeWrapper {...props} />;
};

// const debug = false;

const BASE_HANDLE_TOP_OFFSET_PX = 20;
const BASE_HANDLE_SIDE_OFFSET_PX = 6;
const HANDLE_VERTICAL_SPACING_PX = 25;

const WorkflowNodeWrapper = ({
  children,
  id,
  selected,
  data: dataReactFlow,
}: WorkflowComponentProps & {
  children: React.ReactNode;
}) => {
  const isMultiSelect = useValue(() => optimizationStore.isMultiSelection$.get());
  return (
    <>
      <WorkflowNodeWrapperInner
        id={id}
        selected={selected}
        isMultiSelect={isMultiSelect}
        data={dataReactFlow}
      />
      {children}
    </>
  );
};

const WorkflowNodeWrapperInner = memo(
  ({
    id: nodeIdRaw,
    selected,
    isMultiSelect,
    data: dataReactFlow,
  }: Pick<WorkflowComponentProps, 'id' | 'selected' | 'data'> & {
    isMultiSelect: boolean;
  }) => {
    // console.log(`[NodeWrapper] rendering node ${id}`, { data });
    const { deleteElements, fitView } = useReactFlow();

    const [nodeId, setNodeId] = useState(WorkflowBrandedTypes.nodeIdToString(nodeIdRaw));
    const oldId = React.useRef(nodeIdRaw);
    // eslint-disable-next-line react-hooks/refs
    if (oldId.current !== nodeIdRaw) {
      // eslint-disable-next-line react-hooks/refs
      oldId.current = nodeIdRaw;
      setNodeId(nodeIdRaw);
    }

    const { node$, store$ } = dataReactFlow;

    const handleNodeIdChange = useCallback(() => {
      const value = nodeId.trim();
      console.log(`[NodeWrapper] handleNodeIdChange`, { value });
      store$.actions.renameNode({ oldId: nodeIdRaw, newId: value });
    }, [nodeId]);

    const handleDeleteNode = () => {
      console.log(`[NodeWrapper] handleDeleteNode`, { nodeId });
      deleteElements({ nodes: [{ id: nodeIdRaw }] });
    };

    const moveToNode = useCallback(
      (id: string) => fitView({ nodes: [{ id }], duration: 250 }),
      [fitView],
    );

    const [expandInfoRaw, setExpandInfo] = useState(false as false | `data` | `document`);
    const [expandInfoQuick, setExpandInfoQuick] = useState(false);
    const expandInfo = expandInfoRaw || (expandInfoQuick ? `data` : false);

    const typeName = useValue(() => node$.type.get());

    return (
      <>
        <NodeResizer isVisible={selected && !isMultiSelect} />
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
                      <div>{nodeId}</div>
                      <Memo>{() => <div>{node$.type.get()}</div>}</Memo>
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
                    <Computed>
                      {() => (
                        <textarea
                          className="min-h-[200px] flex-1 resize-none bg-black p-1"
                          value={JSON.stringify(
                            expandInfo === `data`
                              ? {
                                  inputs: node$.inputs.get(),
                                  data: node$.data.get(),
                                  outputs: node$.outputs.get(),
                                }
                              : node$.get(),
                            null,
                            2,
                          )}
                          readOnly
                        />
                      )}
                    </Computed>
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
                  title={`${nodeId}: ${typeName}`}
                  value={nodeId}
                  onChange={(x) => setNodeId(x.target.value)}
                  onBlur={handleNodeIdChange}
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
                    console.log(`dataReactFlow ${nodeId}`, dataReactFlow);
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
        <Computed>
          {() =>
            Object.values(node$.inputs).map((input$, index) => {
              const key = input$.name.get();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const edgeId = input$.edgeId.get();
              const edge = input$.getEdge();
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
            })
          }
        </Computed>
        <Computed>
          {() =>
            Object.values(node$.outputs).map((output$, index) => {
              const key = output$.name.get();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const edgeIds = output$.edgeIds.get();
              const edges = output$.getEdges();
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
            })
          }
        </Computed>
      </>
    );
  },
);
