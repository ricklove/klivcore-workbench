import { type Observable, observable } from '@legendapp/state';
import { Computed, Memo, useValue } from '@legendapp/state/react';
import { Handle, NodeResizer, Position, useReactFlow } from '@xyflow/react';
import React, { memo, useCallback, useState } from 'react';
import { optimizationStore } from './optimization-store';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentPropsAny_Ops as WorkflowComponentPropsAny,
  type WorkflowNodeId,
  type WorkflowRuntimeNode,
} from './types';

export const WorkflowNodeDefault = (props: WorkflowComponentPropsAny) => {
  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="text-white">Node {props.id}</div>
      </WorkflowNodeWrapperSimple>
    </>
  );
};

export const WorkflowNodeWrapperSimple = (
  props: WorkflowComponentPropsAny & {
    children: React.ReactNode;
  },
) => {
  return <WorkflowNodeWrapper {...props} />;
};

// const debug = false;

const WorkflowNodeWrapper = ({
  children,
  id,
  selected,
  hideHandles,
  data: dataReactFlow,
}: WorkflowComponentPropsAny & {
  children: React.ReactNode;
}) => {
  const isMultiSelect = useValue(() =>
    optimizationStore.isMultiSelection$.get(),
  );
  // const nodeId = useValue(
  //   () => dataReactFlow.node$.newIdUntilReload.get() ?? dataReactFlow.node$.id.get(),
  // );
  return (
    <>
      <NodeResizer isVisible={selected && !isMultiSelect} />
      <WrapperHeader id={id} selected={selected} data={dataReactFlow} />
      {children}
      {!hideHandles && (
        <WrapperHandles
          selected={selected}
          data={{ node$: dataReactFlow.node$ }}
        />
      )}
    </>
  );
};

const expandedInfoByNode$ = observable(
  {} as Record<WorkflowNodeId, false | `data` | `document`>,
);

const WrapperHeader = memo(
  ({
    id: nodeIdRaw,
    selected,
    data: dataReactFlow,
  }: Pick<WorkflowComponentPropsAny, 'id' | 'data' | `selected`>) => {
    // console.log(`[NodeWrapper] rendering node ${nodeIdRaw}`, { dataReactFlow });
    const { deleteElements } = useReactFlow();

    const [nodeIdWarning, setNodeIdWarning] = useState(
      undefined as undefined | string,
    );
    const [nodeId, setNodeId] = useState(
      WorkflowBrandedTypes.nodeIdToString(nodeIdRaw),
    );
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

      if (!value) {
        setNodeIdWarning(`Node ID '${value}' is blank`);
        return;
      }

      const hasConflict = Object.values(store$.nodes.get()).some((n) => {
        if (n.id === nodeIdRaw) {
          return false;
        }
        return (n.newIdUntilReload ?? n.id) === value;
      });

      if (hasConflict) {
        setNodeIdWarning(`Node ID '${value}' is already in use`);
        return;
      }

      setNodeIdWarning(undefined);
      store$.actions.renameNode({ oldId: nodeIdRaw, newId: value });
    }, [nodeId]);

    const handleDeleteNode = () => {
      console.log(`[NodeWrapper] handleDeleteNode`, { nodeId });
      deleteElements({ nodes: [{ id: nodeIdRaw }] });
    };

    const expandInfoRaw = useValue(() => expandedInfoByNode$[nodeIdRaw]?.get());
    const setExpandInfo = (value: false | `data` | `document`) => {
      expandedInfoByNode$[nodeIdRaw]?.set(value);
    };

    const [expandInfoQuick, setExpandInfoQuick] = useState(false);
    const expandInfo = expandInfoRaw || (expandInfoQuick ? `data` : false);

    const typeName = useValue(() => node$.type.get());

    return (
      <>
        <div className="absolute top-0 left-0 right-0 z-10 h-0">
          <div className="absolute bottom-0 left-0 right-0 ">
            {expandInfo && (
              <div className="absolute top-0 left-0 right-0 h-0 scale-50">
                <div
                  className="absolute bottom-1 flex flex-col justify-end gap-1 min-w-75 min-h-75"
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
                          className="flex-1 resize-none bg-black p-1 text-[8px]"
                          value={JSON.stringify(
                            expandInfo === `data`
                              ? {
                                  // id: node$.id.get(),
                                  // newIdUntilReload: node$.newIdUntilReload.get(),
                                  inputs: dataReactFlow.inputs$.get(),
                                  data: dataReactFlow.data$.get(),
                                  outputs: dataReactFlow.outputs$.get(),
                                  // node: {
                                  //   inputs: node$.inputs.get(),
                                  //   data: node$.data.get(),
                                  //   outputs: node$.outputs.get(),
                                  // },
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
            <div className="flex flex-col">
              <div className="relative">
                <div className="absolute bottom-0 right-0">
                  <div className="flex flex-row items-center gap-1 ">
                    <div className="flex-1 self-stretch nowheel nodrag nopan pointer-events-none" />
                    <div className="flex flex-row items-center gap-1 p-1 rounded-t opacity-0 hover:opacity-100 bg-slate-500/25">
                      {/* <div className="flex-1">{`🔷`}</div> */}
                      <div className="flex flex-row items-center min-w-0 gap-1 nowheel nodrag nopan ">
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
                            setExpandInfo(
                              expandInfoRaw === `data` ? false : `data`,
                            );
                            console.log(
                              `dataReactFlow ${nodeId}`,
                              dataReactFlow,
                            );
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
                          onClick={() =>
                            setExpandInfo(
                              expandInfoRaw === `document` ? false : `document`,
                            )
                          }
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
              </div>
              <div className="flex flex-col gap-0">
                {nodeIdWarning && (
                  <div
                    className={`min-w-0 flex-1 font-bold text-xs text-white outline-none bg-transparent  p-0 m-0 leading-tight  text-[8px] ${
                      nodeIdWarning
                        ? 'border border-red-500'
                        : 'border-none opacity-5 hover:opacity-100 focus:opacity-100'
                    }`}
                  >
                    {`[${nodeIdRaw}] ${nodeIdWarning}`}
                  </div>
                )}
                <div
                  className={`flex flex-row items-center gap-0.5 border-none ${
                    nodeIdWarning || selected
                      ? ''
                      : 'opacity-5 hover:opacity-100 focus:opacity-100'
                  }`}
                >
                  <div className="w-1 h-1 bg-blue-800 rounded-full" />
                  <input
                    type="text"
                    className={`min-w-0 flex-1 font-bold text-white outline-none bg-transparent p-0 m-0 leading-tight  text-[8px] ${
                      nodeIdWarning
                        ? ''
                        : 'opacity-5 hover:opacity-100 focus:opacity-100'
                    }`}
                    title={`${nodeId}: ${typeName}`}
                    value={nodeId}
                    onChange={(x) => setNodeId(x.target.value)}
                    onBlur={handleNodeIdChange}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  />
                </div>
              </div>
              <Memo>
                {() => (
                  <>
                    <div
                      className={`transition delay-50 duration-300 text-[8px] ${
                        node$.executionState.status.get() === 'running'
                          ? 'bg-green-700 opacity-100'
                          : node$.executionState.status.get() === 'error'
                            ? 'bg-red-700 opacity-100'
                            : node$.executionState.status.get() === 'aborted'
                              ? 'bg-yellow-700 opacity-50'
                              : node$.executionState.status.get() === 'success'
                                ? 'bg-gray-600 opacity-10'
                                : 'bg-gray-700 opacity-10'
                      }`}
                    >
                      {node$.executionState.status.get()}
                      {node$.executionState.status.get() === 'error'
                        ? ` - ${node$.executionState.runState.errorMessage.get() ?? ``}`
                        : ``}
                    </div>
                  </>
                )}
              </Memo>
            </div>
          </div>
        </div>
      </>
    );
  },
);

export const WrapperHandles = memo(
  (props: {
    selected: boolean;
    data: { node$: Observable<WorkflowRuntimeNode> };
  }) => {
    const BASE_HANDLE_TOP_OFFSET_PX = 12;
    const BASE_HANDLE_SIDE_OFFSET_PX = 6;
    const HANDLE_VERTICAL_SPACING_PX = 24;

    // const { fitView } = useReactFlow();
    // const moveToNode = useCallback(
    //   (id: string) => fitView({ nodes: [{ id }], duration: 250 }),
    //   [fitView],
    // );

    const inputs = useValue(() =>
      props.data.node$.inputs.map((x) => ({
        name: x.name.get(),
        edgeId: x.edgeId.get(),
        edge: x.getEdge(),
      })),
    );
    const outputs = useValue(() =>
      props.data.node$.outputs.map((x) => ({
        name: x.name.get(),
        edgeIds: x.edgeIds.get(),
        edges: x.getEdges(),
      })),
    );

    return (
      <>
        {Object.values(inputs).map((input, index) => {
          const key = input.name;

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const edgeId = input.edgeId;
          const edge = input.edge;
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
                className={`${
                  edge
                    ? 'bg-green-800! border-green-400! hover:bg-green-600!'
                    : props.selected
                      ? `bg-gray-400! opacity-75 hover:opacity-100`
                      : 'bg-gray-400! opacity-10 hover:opacity-100'
                }`}
                style={{
                  width: `12px`,
                  height: `12px`,
                  top: `${BASE_HANDLE_TOP_OFFSET_PX + index * HANDLE_VERTICAL_SPACING_PX}px`,
                  left: `-${BASE_HANDLE_SIDE_OFFSET_PX}px`,
                  borderTopRightRadius: `0px`,
                  borderBottomRightRadius: `0px`,
                }}
                // className="hover:top-0"
              >
                <div className="absolute right-0 opacity-0 hover:opacity-100 w-4 h-4">
                  <div className="absolute right-0 pointer-events-none">
                    <div className="flex flex-row items-center gap-1 relative p-1 text-xs border rounded bg-slate-700 border-slate-800 bottom-2 right-2 pointer-events-none">
                      {/* {edge && (
                      <div
                        className="pointer-events-auto cursor-pointer"
                        onClick={() => moveToNode(edge.source.nodeId)}
                        title={`Go to '${edge.source.nodeId}'`}
                      >
                        🔗
                      </div>
                    )} */}
                      <div>{key}</div>
                    </div>
                  </div>
                </div>
              </Handle>
            </React.Fragment>
          );
        })}
        {Object.values(outputs).map((output, index) => {
          const key = output.name;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const edgeIds = output.edgeIds;
          const edges = output.edges;
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
                className={`${
                  edges.length
                    ? 'bg-green-800! border-green-400! hover:bg-green-600!'
                    : props.selected
                      ? `bg-gray-400! opacity-75 hover:opacity-100`
                      : 'bg-gray-400! opacity-10 hover:opacity-100'
                }`}
                style={{
                  width: `12px`,
                  height: `12px`,
                  top: `${BASE_HANDLE_TOP_OFFSET_PX + index * HANDLE_VERTICAL_SPACING_PX}px`,
                  right: `-${BASE_HANDLE_SIDE_OFFSET_PX}px`,
                  borderTopLeftRadius: `0px`,
                  borderBottomLeftRadius: `0px`,
                }}
              >
                <div className="absolute left-0 opacity-0 hover:opacity-100 w-4 h-4">
                  <div className="absolute left-0 pointer-events-none">
                    <div className="relative p-1 text-xs border rounded pointer-events-none bg-slate-700 border-slate-800 bottom-2 left-2">
                      {key}
                    </div>
                  </div>
                </div>
              </Handle>
            </React.Fragment>
          );
        })}
      </>
    );
  },
);
