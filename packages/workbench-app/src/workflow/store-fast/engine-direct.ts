import {
  beginBatch,
  endBatch,
  type Observable,
  ObservableHint,
} from '@legendapp/state';
import {
  WorkflowBrandedTypes,
  type WorkflowEdgeId,
  type WorkflowExecutionArgs,
  type WorkflowJsonObject,
  type WorkflowNodeId,
  type WorkflowRuntimeEngine,
  type WorkflowRuntimeExecutionState,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
  type WorkflowRuntimeValue,
} from '../types';
import {
  type BatchedTriggerKind,
  createBatchTrigger,
  observeBatched,
} from './observe-batched';

const loggingEnabled = false;

type Logger = {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
};
const logger: Logger = {
  log: (...args: unknown[]) => {
    if (!loggingEnabled) return;
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (!loggingEnabled) return;
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (!loggingEnabled) return;
    console.error(...args);
  },
};

const createEmptyExecutionState = (): WorkflowRuntimeExecutionState => ({
  status: `initial`,
  runState: {},
  stats: {
    runCount: 0,
    successCount: 0,
    errorCount: 0,
    abortedCount: 0,
    totalExecutionTime: 0,
    totalAsyncExecutionTime: 0,
    totalAsyncMicrotaskLagTime: 0,
    errorMessageCounts: {},
    get averageExecutionTime() {
      return this.runCount === 0 ? 0 : this.totalExecutionTime / this.runCount;
    },
    get averageAsyncExecutionTime() {
      return this.runCount === 0
        ? 0
        : this.totalAsyncExecutionTime / this.runCount;
    },
    get averageAsyncMicrotaskLagTime() {
      return this.runCount === 0
        ? 0
        : this.totalAsyncMicrotaskLagTime / this.runCount;
    },
  },
});

const executeNode = async ({
  node,
  store,
  controller,
  onExecutionStateChange,
}: {
  node: WorkflowRuntimeNode;
  store: WorkflowRuntimeStore;
  controller: WorkflowExecutionArgs['controller'];
  onExecutionStateChange: (state: WorkflowRuntimeExecutionState) => void;
}): Promise<undefined | WorkflowRuntimeExecutionState> => {
  const nodeId = node.id;
  if (node.isDeleted) {
    logger.log(
      `[createWorkflowEngine:processNodeQueue:executeNode] Node is deleted, skipping execution:`,
      {
        nodeId,
        node,
      },
    );
    return undefined;
  }

  const typeDef = store.nodeTypes[node.type];
  if (!typeDef) {
    logger.warn(
      `[createWorkflowEngine:processNodeQueue] Node type definition not found:`,
      {
        nodeId,
        type: node.type,
      },
    );
    return undefined;
  }

  logger.log(
    `[createWorkflowEngine:processNodeQueue:executeNode] Executing node: ${nodeId}`,
    //     , {
    //     nodeId,
    //     node,
    //   }
  );

  if (node.executionState?.status === `running`) {
    logger.warn(
      `[createWorkflowEngine:processNodeQueue:executeNode] Node is already running, skipping execution:`,
      {
        nodeId,
        node,
        executionState: node.executionState,
      },
    );
    return undefined;
  }

  // node.executionState = node.executionState ?? createEmptyExecutionState();
  // // prevent running twice
  // node.executionState.status = `running`;
  // onExecutionStateChange(node.executionState);

  // const executionState: WorkflowRuntimeExecutionState = {
  //   ...node.executionState,
  // };
  const executionState: WorkflowRuntimeExecutionState =
    createEmptyExecutionState();
  executionState.status = `running`;
  onExecutionStateChange(executionState);

  executionState.runState = {
    startTimestamp: WorkflowBrandedTypes.now(),
  };

  const args: WorkflowExecutionArgs = {
    inputs: Object.fromEntries(
      node.inputs.map((input) => [input.name, input.value.getDirectValue()]),
    ),
    data: node.data.getDirectValue<WorkflowJsonObject>() ?? undefined,
    runtimeState: node.runtimeState.getDirectValue<Record<string, unknown>>()!,
    node,
    store,
    controller,
  };

  // await new Promise<void>((resolve) => {
  //   // queue microtask to allow UI to update
  //   queueMicrotask(() => resolve());
  // });
  // await new Promise<void>((resolve) => {
  //   resolve();
  // });

  try {
    const asyncStartTime = performance.now();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const asyncMicrotaskLagTime = performance.now() - asyncStartTime;

    const result = await typeDef.execute(args);
    const asyncExecutionTime = performance.now() - asyncStartTime;
    controller.abortSignal.throwIfAborted();

    executionState.status = `success`;
    executionState.runState.errorMessage = undefined;
    executionState.runState.endTimestamp = WorkflowBrandedTypes.now();
    executionState.runState.asyncExecutionTime = asyncExecutionTime;
    executionState.runState.asyncMicrotaskLagTime = asyncMicrotaskLagTime;
    onExecutionStateChange(executionState);

    logger.log(
      `[createWorkflowEngine:processNodeQueue:executeNode] Node execution done: ${nodeId}`,
      //     , {
      //   nodeId,
      //   result,
      //   executionState,
      //   node,
      //   args,
      // }
    );

    if (!result) {
      return executionState;
    }

    // set outputs
    for (const output of node.outputs) {
      if (result.outputs[output.name] === undefined) continue;
      output.value.setValue(result.outputs[output.name]);
    }

    // set node data
    if (result.data !== undefined) {
      node.data.setValue(result.data);
    }
  } catch (err) {
    if (controller.abortSignal.aborted) {
      executionState.status = `aborted`;
      executionState.runState.endTimestamp = WorkflowBrandedTypes.now();
      onExecutionStateChange(executionState);

      logger.log(
        `[createWorkflowEngine:processNodeQueue:executeNode] Node execution aborted:`,
        {
          nodeId,
          args,
        },
      );
    } else {
      executionState.status = `error`;
      executionState.runState.endTimestamp = WorkflowBrandedTypes.now();
      executionState.runState.errorMessage =
        (err as Error)?.message ?? `Unknown error`;
      onExecutionStateChange(executionState);

      console.error(
        `[createWorkflowEngine:processNodeQueue:executeNode] Error executing node: ${nodeId}`,
        {
          nodeId,
          err,
          args,
        },
      );
    }
  }

  const stats = executionState.stats;
  stats.runCount += 1;
  stats.successCount += executionState.status === `success` ? 1 : 0;
  stats.errorCount += executionState.status === `error` ? 1 : 0;
  stats.abortedCount += executionState.status === `aborted` ? 1 : 0;
  stats.totalExecutionTime +=
    executionState.runState.endTimestamp! -
    executionState.runState.startTimestamp!;
  stats.totalAsyncExecutionTime +=
    executionState.runState.asyncExecutionTime ?? 0;
  stats.totalAsyncMicrotaskLagTime +=
    executionState.runState.asyncMicrotaskLagTime ?? 0;
  if (
    executionState.status === `error` &&
    executionState.runState.errorMessage
  ) {
    const errorMessage = executionState.runState.errorMessage;
    stats.errorMessageCounts[errorMessage] =
      (stats.errorMessageCounts[errorMessage] ?? 0) + 1;
  }
  // executionState.history.push({
  //   status: executionState.status as `success` | `error` | `aborted`,
  //   startTimestamp: rs.startTimestamp!,
  //   endTimestamp: rs.endTimestamp!,
  //   asyncExecutionTime: rs.asyncExecutionTime ?? 0,
  //   asyncMicrotaskLagTime: rs.asyncMicrotaskLagTime ?? 0,
  //   errorMessage: rs.errorMessage,
  // });

  onExecutionStateChange(executionState);
  return executionState;
};

export const createWorkflowEngine = (
  store$: Observable<WorkflowRuntimeStore>,
): WorkflowRuntimeEngine => {
  const engineState = {
    running: false,

    engineSubscription: undefined as undefined | { unsubscribe: () => void },
    tickTriggerSubscription: undefined as
      | undefined
      | { unsubscribe: () => void },

    /** process:
     * - one subscription (edge key or node key changes)
     * - any edge key change => outputValues list
     * - outputValues are polled to:
     *     - update target edge and input values
     *     - queue node exection
     * - any node key change => nodeDataValues list
     * - nodeDataValues are polled to update node data values
     *     - queue node exection
     */
    previousEdgeIds: [] as WorkflowEdgeId[],
    previousNodeIds: [] as WorkflowNodeId[],

    outputValues: [] as {
      sourceOutputRuntimeValue: WorkflowRuntimeValue;
      targetInputRuntimeValue: WorkflowRuntimeValue;
      targetEdgeRuntimeValue: WorkflowRuntimeValue;
      edgeId: WorkflowEdgeId;
      sourceNodeId: WorkflowNodeId;
      targetNodeId: WorkflowNodeId;
    }[],
    nodeDataValues: [] as {
      dataRuntimeValue: WorkflowRuntimeValue;
      nodeId: WorkflowNodeId;
    }[],

    nodeIdsToExecute: new Set<WorkflowNodeId>(),
    nodeIdsExecuting: new Set<WorkflowNodeId>(),

    executionEmitters: new Map<WorkflowNodeId, { unsubscribe: () => void }>(),

    dataChangeCounters: new Map<WorkflowRuntimeValue, number>(),
    abortController: new AbortController(),
    triggerKind: 1000 as BatchedTriggerKind,

    stats: {
      tickCount: 0,
      tickTotalTime: 0,
      get tickAverageTime() {
        return this.tickCount === 0 ? 0 : this.tickTotalTime / this.tickCount;
      },
      propagationCount: 0,
      propagationTotalTime: 0,
      get propagationAverageTime() {
        return this.propagationCount === 0
          ? 0
          : this.propagationTotalTime / this.propagationCount;
      },
      executionCount: 0,
      executionTotalTime: 0,
      get executionAverageTime() {
        return this.executionCount === 0
          ? 0
          : this.executionTotalTime / this.executionCount;
      },
      executionMicrotaskLagTotalTime: 0,
      get executionMicrotaskLagAverageTime() {
        return this.executionCount === 0
          ? 0
          : this.executionMicrotaskLagTotalTime / this.executionCount;
      },
      get executionHistoryCount() {
        return Object.values(store$.nodes.peek())
          .map((x) => x.executionState?.stats.runCount ?? 0)
          .reduce((acc, cur) => acc + cur, 0);
      },
      get executionHistoryTotalTime() {
        return Object.values(store$.nodes.peek())
          .map((x) => x.executionState?.stats.totalExecutionTime ?? 0)
          .reduce((acc, cur) => acc + cur, 0);
      },
      get executionHistoryAverageTime() {
        const count = this.executionHistoryCount;
        return count === 0 ? 0 : this.executionHistoryTotalTime / count;
      },
      get executionHistoryAsyncTotalTime() {
        return Object.values(store$.nodes.peek())
          .map((x) => x.executionState?.stats.totalAsyncExecutionTime ?? 0)
          .reduce((acc, cur) => acc + cur, 0);
      },
      get executionHistoryAsyncAverageTime() {
        const count = this.executionHistoryCount;
        return count === 0 ? 0 : this.executionHistoryAsyncTotalTime / count;
      },
      get executionHistoryAsyncMicrotaskLagTotalTime() {
        return Object.values(store$.nodes.peek())
          .map((x) => x.executionState?.stats.totalAsyncMicrotaskLagTime ?? 0)
          .reduce((acc, cur) => acc + cur, 0);
      },
      get executionHistoryAsyncMicrotaskLagAverageTime() {
        const count = this.executionHistoryCount;
        return count === 0
          ? 0
          : this.executionHistoryAsyncMicrotaskLagTotalTime / count;
      },
    },
  };
  const stats = engineState.stats;
  const changeCountersToUpdate = new Set<WorkflowRuntimeValue>();

  const propagationKind = `polling` as `polling` | `subscription`;
  const propagateValues = () => {
    if (propagationKind !== `polling`) {
      return;
    }

    const startTime = performance.now();

    logger.log(`[createWorkflowEngine:propagateValues] Propagating values...`, {
      engineState,
    });

    beginBatch();

    changeCountersToUpdate.clear();

    // process output values
    for (const ov of engineState.outputValues) {
      const currentCounter =
        engineState.dataChangeCounters.get(ov.sourceOutputRuntimeValue) ?? -1;
      const newCounter =
        ov.sourceOutputRuntimeValue.getImmediateChangeCounter();

      if (newCounter === currentCounter) {
        continue;
      }

      stats.propagationCount++;

      // source output value has changed
      const newValue = ov.sourceOutputRuntimeValue.getDirectValue();

      // update target values
      ov.targetEdgeRuntimeValue.setValue(newValue);
      ov.targetInputRuntimeValue.setValue(newValue);

      // queue target node for execution
      engineState.nodeIdsToExecute.add(ov.targetNodeId);

      changeCountersToUpdate.add(ov.sourceOutputRuntimeValue);
    }

    // process node data values
    for (const nv of engineState.nodeDataValues) {
      const currentCounter =
        engineState.dataChangeCounters.get(nv.dataRuntimeValue) ?? -1;
      const newCounter = nv.dataRuntimeValue.getImmediateChangeCounter();
      if (newCounter === currentCounter) {
        continue;
      }

      stats.propagationCount++;

      // queue node for execution
      engineState.nodeIdsToExecute.add(nv.nodeId);

      changeCountersToUpdate.add(nv.dataRuntimeValue);
    }

    for (const dc of changeCountersToUpdate) {
      engineState.dataChangeCounters.set(dc, dc.getImmediateChangeCounter());
    }

    endBatch();

    stats.propagationTotalTime += performance.now() - startTime;
  };

  const executeNodesInParallel = async () => {
    logger.log(
      `[createWorkflowEngine:executeNodesInParallel] #${stats.executionCount} Executing nodes in parallel...`,
      {
        engineState,
      },
    );

    stats.executionCount++;
    const startTime = performance.now();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    stats.executionMicrotaskLagTotalTime += performance.now() - startTime;

    let isInBatch = true;
    beginBatch();
    let rafId = 0;

    const flushBatch = () => {
      if (!isInBatch) {
        return;
      }
      if (rafId) {
        return;
      }
      endBatch();
      beginBatch();

      rafId = requestAnimationFrame(() => {
        rafId = 0;
        endBatch();
        isInBatch = false;
      });
    };

    flushBatch();

    const store = store$.peek();
    const promises = [] as Promise<
      | undefined
      | {
          nodeId: WorkflowNodeId;
          executionState: undefined | WorkflowRuntimeExecutionState;
        }
    >[];
    for (const nodeId of engineState.nodeIdsExecuting) {
      const node = store.nodes[nodeId];

      if (!node) {
        logger.warn(
          `[createWorkflowEngine:executeNodes] Node not found, skipping execution:`,
          {
            nodeId,
          },
        );
        engineState.nodeIdsExecuting.delete(nodeId);
        continue;
      }

      if (node.executionState?.status === `running`) {
        // do not rerun a node already running
        continue;
      }

      const executionState$ = store$.nodes[nodeId]!.executionState;
      if (!executionState$.peek()) {
        executionState$.set({
          ...createEmptyExecutionState(),
        });
      }
      if (!executionState$.runState.peek()) {
        executionState$.runState.set({});
      }

      const promise = (async () => {
        executionState$.runState.promiseStartTime.set(
          WorkflowBrandedTypes.now(),
        );

        // if (node.executionState?.status !== `running`) {
        engineState.executionEmitters.get(nodeId)?.unsubscribe();
        engineState.executionEmitters.delete(nodeId);
        // }

        const executionState = await executeNode({
          onExecutionStateChange: (executionState) => {
            executionState$.assign(executionState);
          },
          node,
          store,
          controller: {
            abortSignal: engineState.abortController.signal,
            setProgress: ({ progressRatio, message }) => {
              logger.log(
                `[createWorkflowEngine:processNodeQueue:executeNode] Node progress:`,
                {
                  nodeId,
                  progressRatio,
                  message,
                },
              );

              // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
              const executionState$ = store$.nodes[nodeId]?.executionState!;
              if (!executionState$.peek()) {
                executionState$.set({
                  ...createEmptyExecutionState(),
                  status: `running`,
                });
              }
              executionState$.status.set(`running`);
              executionState$.runState.progressRatio.set(progressRatio);
              executionState$.runState.progressMessage.set(message);

              if (progressRatio >= 1) {
                executionState$.status.set(`success`);
              }

              // purgeBatch();
            },
            registerEvent: (event) => {
              const lastUnsub = engineState.executionEmitters.get(nodeId);
              const unsub = event((result) => {
                // console.log(
                //   `[createWorkflowEngine:executeNode:registerEvent] Node event emitted:`,
                //   {
                //     nodeId,
                //     result,
                //   },
                // );
                for (const output of node.outputs) {
                  if (result[output.name] === undefined) continue;
                  output.value.setValue(result[output.name]);
                }
                // purgeBatch();
              });
              engineState.executionEmitters.set(
                nodeId,
                !lastUnsub
                  ? unsub
                  : {
                      unsubscribe: () => {
                        unsub.unsubscribe();
                        lastUnsub.unsubscribe();
                      },
                    },
              );
            },
          },
        });

        if (executionState) {
          const node$ = store$.nodes[nodeId]!;
          node$.executionState.assign(executionState);
          flushBatch();
        }

        executionState$.runState.promiseInstance.set(undefined);
        executionState$.runState.promiseEndTime.set(WorkflowBrandedTypes.now());
        engineState.nodeIdsExecuting.delete(nodeId);
        return { nodeId, executionState };
      })();

      executionState$.runState.promiseInstance.set(
        ObservableHint.opaque({ promise }),
      );
      promises.push(promise);
    }

    // try to finish in parallel, but with a max time limit
    await new Promise<void>((resolve) => {
      const MAX_EXECUTION_TIME_MS = 25;
      const timeoutId = setTimeout(() => {
        resolve();
      }, MAX_EXECUTION_TIME_MS);

      Promise.all(promises).then(() => {
        clearTimeout(timeoutId);
        resolve();
      });
    });
    // const results = await Promise.all(promises);
    // for (const result of results) {
    //   // const node$ = store$.nodes[result.nodeId]!;
    //   // if (result.executionState) {
    //   //   node$.executionState.set(result.executionState);
    //   // }
    // }

    flushBatch();
    // if (isInBatch) {
    //   isInBatch = false;
    //   endBatch();
    //   cancelAnimationFrame(rafId);
    // }

    if (engineState.nodeIdsExecuting.size > 0) {
      // this should not be possible
      logger.error(
        `[createWorkflowEngine:executeNodesInParallel] Some nodes are still executing after execution:`,
        {
          nodeIdsExecuting: [...engineState.nodeIdsExecuting],
        },
      );
      engineState.nodeIdsExecuting.clear();
    }

    stats.executionTotalTime += performance.now() - startTime;
    queueTick();
  };

  const queueTick = () => {
    engineState.tickTriggerSubscription?.unsubscribe();
    engineState.tickTriggerSubscription = {
      unsubscribe: createBatchTrigger(engineState.triggerKind)(tick),
    };
  };

  const tick = () => {
    logger.log(`[createWorkflowEngine:tick] #${stats.tickCount} ...`, {
      engineState,
      stats,
    });
    engineState.tickTriggerSubscription = undefined;
    if (!engineState.running) {
      return;
    }

    // // don't overlap ticks
    // // actually this is ok, each node will track it's own execution state
    // if (engineState.nodeIdsExecuting.size > 0) {
    //   return;
    // }

    stats.tickCount++;
    const tickStartTime = performance.now();

    propagateValues();

    // execute nodes
    for (const nodeId of engineState.nodeIdsToExecute) {
      engineState.nodeIdsExecuting.add(nodeId);
    }
    engineState.nodeIdsToExecute.clear();

    if (engineState.nodeIdsExecuting.size === 0) {
      logger.log(`[createWorkflowEngine:tick] No nodes to execute, skipping.`, {
        engineState,
      });
      queueTick();
      stats.tickTotalTime += performance.now() - tickStartTime;
      return;
    }

    // execute in parallel
    logger.log(`[createWorkflowEngine:tick] Executing queued nodes:`, {
      nodeIdsExecuting: engineState.nodeIdsExecuting,
    });

    stats.tickTotalTime += performance.now() - tickStartTime;
    void executeNodesInParallel();
  };

  const engine: WorkflowRuntimeEngine = {
    ...({ __engineState: engineState } as unknown as Record<string, never>),
    get running() {
      return engineState.running;
    },
    get tickSpeed() {
      switch (engineState.triggerKind) {
        case `MessageChannel`:
          return `fast`;
        case `requestAnimationFrame`:
          return `normal`;
        case 0:
          return `slow`;
        default:
          return Number(engineState.triggerKind) || 0;
      }
    },
    set tickSpeed(value) {
      switch (value) {
        case `fast`:
          engineState.triggerKind = `MessageChannel`;
          break;
        case `normal`:
          engineState.triggerKind = `requestAnimationFrame`;
          break;
        case `slow`:
          engineState.triggerKind = 0;
          break;
        default:
          engineState.triggerKind = value;
          break;
      }

      if (engineState.running) {
        queueTick();
      }

      return;
    },
    start: () => {
      if (engineState.running) {
        logger.warn(`[createWorkflowEngine:start] Engine is already running`, {
          engine,
        });
        return;
      }

      logger.log(`[createWorkflowEngine:start] Starting workflow engine...`, {
        engine,
      });
      engineState.running = true;

      if (engineState.abortController.signal.aborted) {
        // resume aborted executions
        for (const nodeId of engineState.nodeIdsExecuting) {
          engineState.nodeIdsToExecute.add(nodeId);
        }
        engineState.nodeIdsExecuting.clear();
      }

      engineState.abortController = new AbortController();

      const unsubMain = observeBatched((e) => {
        logger.log(
          `[createWorkflowEngine:mainSubscription:observeBatched] Setup node subscriptions...`,
          { e, engineState },
        );

        if (!engineState.running) {
          unsubMain();
          return;
        }

        // subscribe to all structure changes (node and edge additions/removals)
        // i.e. only node and edge keys (and if deleted)

        const _edgeIds = Object.keys(store$.edges);
        const edgesAll = Object.values(store$.edges.peek());
        for (const edge of edgesAll) {
          store$.edges[edge.id]?.isDeleted.get();
        }
        const edges = edgesAll.filter((x) => !x.isDeleted);

        const _nodeIds = Object.keys(store$.nodes);
        const nodesAll = Object.values(store$.nodes.peek());
        for (const node of nodesAll) {
          store$.nodes[node.id]?.isDeleted.get();
        }
        const nodes = nodesAll.filter((x) => !x.isDeleted);

        if (
          engineState.previousEdgeIds.length === edges.length &&
          engineState.previousNodeIds.length === nodes.length &&
          engineState.previousEdgeIds.every((id, i) => id === edges[i]?.id) &&
          engineState.previousNodeIds.every((id, i) => id === nodes[i]?.id)
        ) {
          console.log(
            `[createWorkflowEngine:mainSubscription] change triggered, but no changes detected - skipping`,
            {
              engineState,
              nodes,
              edges,
              _edgeIds,
              _nodeIds,
              unsubMain,
            },
          );

          return;
        }

        engineState.previousEdgeIds = edges.map((e) => e.id);
        engineState.previousNodeIds = nodes.map((n) => n.id);

        const oldOutputValues = engineState.outputValues;

        engineState.outputValues = edges.flatMap((edge) => {
          const sourceNode = edge.source.getNode();
          const targetNode = edge.target.getNode();
          if (!sourceNode || !targetNode) {
            return [];
          }
          const sourceOutput = sourceNode.outputs.find(
            (o) => o.name === edge.source.outputName,
          );
          const targetInput = targetNode.inputs.find(
            (i) => i.name === edge.target.inputName,
          );
          if (!sourceOutput || !targetInput) {
            return [];
          }
          return [
            {
              sourceOutputRuntimeValue: sourceOutput.value,
              targetInputRuntimeValue: targetInput.value,
              targetEdgeRuntimeValue: edge.value,
              edgeId: edge.id,
              sourceNodeId: edge.source.nodeId,
              targetNodeId: edge.target.nodeId,
            },
          ];
        });

        const removedOutputValues = oldOutputValues.filter((oldOv) => {
          return !engineState.outputValues.find(
            (ov) => ov.edgeId === oldOv.edgeId,
          );
        });

        // clean up removed output values from dataChangeCounters
        for (const rov of removedOutputValues) {
          rov.targetInputRuntimeValue.clearValue();
          engineState.nodeIdsToExecute.add(rov.targetNodeId);
        }

        engineState.nodeDataValues = nodes.map((node) => {
          return {
            dataRuntimeValue: node.data as WorkflowRuntimeValue,
            nodeId: node.id,
          };
        });

        const unsubs = [] as (() => void)[];
        if (propagationKind === `subscription`) {
          engineState.outputValues.forEach((ov) => {
            unsubs.push(
              ov.sourceOutputRuntimeValue.subscribeDirect((x) => {
                stats.propagationCount++;
                const startTime = performance.now();
                ov.targetEdgeRuntimeValue.setValue(x);
                ov.targetInputRuntimeValue.setValue(x);
                engineState.nodeIdsToExecute.add(ov.targetNodeId);
                stats.propagationTotalTime += performance.now() - startTime;
              }),
            );
          });

          engineState.nodeDataValues.forEach((nv) => {
            unsubs.push(
              nv.dataRuntimeValue.subscribeDirect(() => {
                stats.propagationCount++;
                engineState.nodeIdsToExecute.add(nv.nodeId);
              }),
            );
          });
        }

        console.log(
          `[createWorkflowEngine:mainSubscription] Subscribed to workflow changes`,
          {
            engineState,
            nodes,
            edges,
            _edgeIds,
            _nodeIds,
            unsubMain,
          },
        );

        return () => {
          unsubs.forEach((u) => u());
        };
      }, `requestAnimationFrame`);

      engineState.engineSubscription = {
        unsubscribe: unsubMain,
      };

      // resume if stopped executing

      // begin ticking
      queueTick();
    },
    stop: ({ shouldAbort }) => {
      if (!engineState.running) {
        logger.warn(`[createWorkflowEngine:stop] Engine is not running`, {
          engine,
        });
        return;
      }

      logger.log(`[createWorkflowEngine:stop] Stopping workflow engine...`, {
        engine,
      });
      engineState.running = false;
      engineState.engineSubscription?.unsubscribe();
      engineState.engineSubscription = undefined;

      if (shouldAbort) {
        engineState.abortController.abort();
      }
    },
    queueNode: (nodeId) => {
      engineState.nodeIdsToExecute.add(nodeId);
    },
  };

  store$.engine.set(engine);
  return engine;
};
