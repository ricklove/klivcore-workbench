import { observable, type Observable, type ObserveEvent } from '@legendapp/state';
import {
  type WorkflowRuntimeEngine,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
  type WorkflowNodeId,
  type WorkflowRuntimeValue,
  WorkflowBrandedTypes,
  type WorkflowExecutionArgs,
  type WorkflowJsonObject,
} from '../types';
import { observeBatched, type BatchedTriggerKind } from './observe-batched';

type Logger = {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
};
const loggingEnabled = false;
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

const executeNode = async ({
  node$,
  store$,
  abortSignal,
}: {
  node$: Observable<WorkflowRuntimeNode>;
  store$: Observable<WorkflowRuntimeStore>;
  abortSignal: AbortSignal;
}) => {
  const nodeId = node$.id.peek();
  const typeDef = store$.nodeTypes[node$.type.peek()]?.peek();
  if (!typeDef) {
    logger.warn(`[createWorkflowEngine:processNodeQueue] Node type definition not found:`, {
      nodeId,
      type: node$.type.peek(),
    });
    return;
  }

  logger.log(
    `[createWorkflowEngine:processNodeQueue:executeNode] Executing node: ${nodeId}`,
    //     , {
    //     nodeId,
    //     node,
    //   }
  );
  const executionState$ = node$.executionState;
  if (!executionState$.peek()) {
    executionState$.set({
      status: `initial`,
      runState: {},
      history: [],
    });
  }

  if (executionState$.status.peek() === `running`) {
    logger.warn(
      `[createWorkflowEngine:processNodeQueue:executeNode] Node is already running, skipping execution:`,
      {
        nodeId,
        node: node$.peek(),
        executionState: executionState$.peek(),
      },
    );
    return;
  }

  executionState$.status.set(`running`);
  executionState$.runState.set({
    startTimestamp: WorkflowBrandedTypes.now(),
  });

  const args: WorkflowExecutionArgs = {
    inputs: Object.fromEntries(
      node$.inputs.map((input$) => [input$.name.peek(), input$.value.peek().getValue()]),
    ),
    data: node$.data.get().getValue<WorkflowJsonObject>() ?? undefined,
    node: node$.peek(),
    store: store$.peek(),
    controller: {
      abortSignal,
      setProgress: ({ progressRatio, message }) => {
        logger.log(`[createWorkflowEngine:processNodeQueue:executeNode] Node progress:`, {
          nodeId,
          progressRatio,
          message,
        });
        executionState$.runState.progressRatio.set(progressRatio);
        executionState$.runState.progressMessage.set(message);
      },
    },
  };

  // await new Promise<void>((resolve) => {
  //   // queue microtask to allow UI to update
  //   queueMicrotask(() => resolve());
  // });
  // await new Promise<void>((resolve) => {
  //   resolve();
  // });

  try {
    const result = await typeDef.execute(args);
    abortSignal.throwIfAborted();

    executionState$.status.set(`success`);
    executionState$.runState.endTimestamp.set(WorkflowBrandedTypes.now());

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
      return;
    }

    // set outputs
    for (const output of node$.outputs.peek()) {
      if (output === undefined) continue;
      output.value.setValue(result.outputs[output.name] ?? null);
    }

    // set node data
    if (result.data !== undefined) {
      node$.data.get().setValue(result.data ?? null);
    }
  } catch (err) {
    if (abortSignal.aborted) {
      executionState$.status.set(`aborted`);
      executionState$.runState.endTimestamp.set(WorkflowBrandedTypes.now());
      logger.log(`[createWorkflowEngine:processNodeQueue:executeNode] Node execution aborted:`, {
        nodeId,
        args,
      });
    } else {
      executionState$.status.set(`error`);
      executionState$.runState.endTimestamp.set(WorkflowBrandedTypes.now());
      executionState$.runState.errorMessage.set((err as Error)?.message ?? `Unknown error`);

      logger.error(
        `[createWorkflowEngine:processNodeQueue:executeNode] Error executing node: ${nodeId}`,
        //     , {
        //     nodeId,
        //     err,
        //     args,
        //   }
      );
    }
  }

  executionState$.history.push({
    status: executionState$.status.peek() as `success` | `error` | `aborted`,
    startTimestamp: executionState$.runState.startTimestamp.peek()!,
    endTimestamp: executionState$.runState.endTimestamp.peek()!,
    errorMessage: executionState$.runState.errorMessage.peek(),
  });
};

export const createWorkflowEngine = (
  store$: Observable<WorkflowRuntimeStore>,
): WorkflowRuntimeEngine => {
  const engineState = {
    running: false,

    engineSubscription: undefined as undefined | { unsubscribe: () => void },
    nodeSubscriptions: new Map<WorkflowNodeId, { unsubscribe: () => void }>(),

    /** nodes to execute, will resume after stop */
    nodeIdsToExecute: observable(new Set<WorkflowNodeId>()),
    dataChangeCounters: new Map<WorkflowRuntimeValue, number>(),

    abortController: new AbortController(),
    triggerKind: 1000 as BatchedTriggerKind,
  };

  const engine: WorkflowRuntimeEngine = {
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
          return;
        case `normal`:
          engineState.triggerKind = `requestAnimationFrame`;
          return;
        case `slow`:
          engineState.triggerKind = 0;
          return;
        default:
          engineState.triggerKind = value;
          return;
      }
    },
    start: () => {
      if (engineState.running) {
        logger.warn(`[createWorkflowEngine:start] Engine is already running`, { engine });
        return;
      }

      logger.log(`[createWorkflowEngine:start] Starting workflow engine...`, { engine });
      engineState.running = true;
      engineState.abortController = new AbortController();

      // subscribe to every node
      const subscribeNode = (nodeId: WorkflowNodeId, e: ObserveEvent<unknown>) => {
        if (!store$.nodes[nodeId]?.id.get()) {
          // missing node, unsub
          engineState.nodeSubscriptions.get(nodeId)?.unsubscribe();
          engineState.nodeSubscriptions.delete(nodeId);
          return;
        }
        if (engineState.nodeSubscriptions.has(nodeId)) {
          // already subscribed
          return;
        }

        logger.log(`[createWorkflowEngine:subscribeNode] Setup node subscription...`, {
          nodeId,
          e,
        });

        const node$ = store$.nodes[nodeId];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const unsubInputs = observeBatched((e) => {
          // logger.log(
          //   `[createWorkflowEngine:subscribeNode:subInputs:observeBatched] Setup node subscriptions...`,
          //   { e },
          // );
          if (!engineState.running) {
            return;
          }

          // logger.log(
          //   `[createWorkflowEngine:subscribeNode:nodeSubscription:inputs] Node data or input changed, queuing execution: ${nodeId}`,
          //   {
          //     node: node$.peek(),
          //   },
          // );

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_inputValues, _inputEdges] = node$.inputs.map((x) => [
            x.value.getValue(),
            x.edgeId.get(),
          ]);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _dataValue = node$.data.get().getValue();

          // pull any missing input values from new edges
          for (const input of node$.inputs.peek()) {
            const val = input.value.getValue() ?? unsubInputs;
            if (val !== undefined) {
              continue;
            }
            if (!input.edgeId) {
              continue;
            }

            // logger.log(
            //   `[createWorkflowEngine:subscribeNode:nodeSubscription:inputs] Pulling input value from new edge for input: ${input.name} on node: ${nodeId}`,
            //   { input },
            // );

            const edge = store$.edges[input.edgeId]?.peek();
            if (!edge) {
              logger.warn(
                `[createWorkflowEngine:subscribeNode:nodeSubscription:inputs] Input edge not found:`,
                {
                  input,
                  node: node$.peek(),
                },
              );
              continue;
            }

            if (edge.value.getValue() !== undefined) {
              logger.log(
                `[createWorkflowEngine:subscribeNode:nodeSubscription:inputs] Using edge value for input: ${input.name} on node: ${nodeId}`,
                { edge },
              );
              input.value.setValue(edge.value.getValue());
              continue;
            }

            const sourceNode = edge.source.getNode();
            const sourceOutput = sourceNode?.outputs.find((o) => o.name === edge.source.outputName);
            if (!sourceOutput) {
              logger.warn(
                `[createWorkflowEngine:subscribeNode:nodeSubscription:inputs] Source node output not found for edge:`,
                { edge },
              );
              continue;
            }

            logger.log(
              `[createWorkflowEngine:subscribeNode:nodeSubscription:inputs] Pulling value from source output for input: ${input.name} on node: ${nodeId}`,
              { sourceOutput },
            );
            edge.value.setValue(sourceOutput.value.getValue());
            input.value.setValue(sourceOutput.value.getValue());
          }

          // queue node for execution
          engineState.nodeIdsToExecute.add(nodeId);
        }, engineState.triggerKind);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const unsubPropagateOutputs = observeBatched((e) => {
          // logger.log(
          //   `[createWorkflowEngine:subscribeNode:subPropagateOutputs:observeBatched] Propagate outputs...`,
          //   { e },
          // );
          if (!engineState.running) {
            return;
          }

          const outputInfos = node$.outputs.get().map((x) => ({
            output: x,
            outputRuntimeValue: x.value,
            outputValue: x.value.getValue(),
            dataChangeCounter: x.value.dataChangeCounter,
          }));

          // logger.log(
          //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Propagating outputs for node '${nodeId}':`,
          //   {
          //     values: outputInfos.map((info) => info.outputValue),
          //     names: outputInfos.map((info) => info.output.name),
          //     outputInfos,
          //   },
          // );

          // send outputs to target inputs
          for (const outputInfo of outputInfos) {
            const hasChanged =
              outputInfo.dataChangeCounter !==
              engineState.dataChangeCounters.get(outputInfo.outputRuntimeValue);

            if (!hasChanged) {
              // logger.log(
              //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Node output has not changed:`,
              //   {
              //     nodeId,
              //     outputInfo,
              //   },
              // );
              continue;
            }

            // send the output through edges
            engineState.dataChangeCounters.set(
              outputInfo.outputRuntimeValue,
              outputInfo.outputRuntimeValue.dataChangeCounter,
            );

            const edges = outputInfo.output.getEdges();

            if (!edges.length) {
              // logger.log(
              //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] No edges to Propagate output '${nodeId}:${outputInfo.output.name}'`,
              //   {
              //     nodeId,
              //     outputInfo,
              //   },
              // );
              continue;
            }

            // logger.log(
            //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Propagating output '${nodeId}:${outputInfo.output.name}':`,
            //   {
            //     nodeId,
            //     outputInfo,
            //     edges,
            //   },
            // );

            for (const edge of edges) {
              // logger.warn(
              //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Settings edge value:`,
              //   {
              //     edge,
              //     outputInfo,
              //   },
              // );

              edge.value.setValue(outputInfo.outputValue);

              const targetNode = edge.target.getNode();
              const targetInput = targetNode?.inputs.find((i) => i.name === edge.target.inputName);
              if (!targetInput) {
                logger.warn(
                  `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Target node input not found for edge:`,
                  { edge, outputInfo, targetNode, targetInput },
                );
                continue;
              }

              // logger.warn(
              //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Settings target node input:`,
              //   { edge, outputInfo, targetNode, targetInput },
              // );

              targetInput.value.setValue(outputInfo.outputValue);
            }

            // logger.log(
            //   `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Done propagating output '${nodeId}:${outputInfo.output.name}':`,
            //   { outputInfo },
            // );
          }

          logger.log(
            `[createWorkflowEngine:subscribeNode:nodeSubscription:outputs] Done propagating outputs '${nodeId}':`,
            { outputInfos },
          );
        }, engineState.triggerKind);

        engineState.nodeSubscriptions.set(nodeId, {
          unsubscribe: () => {
            unsubInputs();
            unsubPropagateOutputs();
          },
        });
      };

      const unsubMain = observeBatched((e) => {
        logger.log(
          `[createWorkflowEngine:mainSubscription:observeBatched] Setup node subscriptions...`,
          { e },
        );
        if (!engineState.running) {
          unsubMain();
          return;
        }

        Object.keys(store$.nodes).forEach((nodeIdRaw: string) => {
          subscribeNode(WorkflowBrandedTypes.nodeId(nodeIdRaw), e);
        });

        return () => {
          Object.values(engineState.nodeSubscriptions).forEach((unsub) => unsub.unsubscribe());
          engineState.nodeSubscriptions.clear();
        };
      }, engineState.triggerKind);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const unsubExecuteNodes = observeBatched((e) => {
        // logger.log(`[createWorkflowEngine:subExecuteNodes:observeBatched] Execute nodes...`, {
        //   e,
        // });
        if (!engineState.running) {
          unsubExecuteNodes();
          return;
        }

        const nodeIdsToExecute = Array.from(engineState.nodeIdsToExecute.get());
        if (nodeIdsToExecute.length === 0) {
          return;
        }

        logger.log(`[createWorkflowEngine:executeNodes] Executing queued nodes:`, {
          nodeIdsToExecute,
        });

        (async () => {
          const promises = nodeIdsToExecute.map(async (nodeId) => {
            const node$ = store$.nodes[nodeId];
            if (!node$?.id.get()) {
              logger.warn(
                `[createWorkflowEngine:executeNodes] Node not found, skipping execution:`,
                {
                  nodeId,
                },
              );
              engineState.nodeIdsToExecute.delete(nodeId);
              return;
            }

            await executeNode({
              node$,
              store$,
              abortSignal: engineState.abortController.signal,
            });

            engineState.nodeIdsToExecute.delete(nodeId);
          });

          await Promise.all(promises);
        })();
      }, engineState.triggerKind);

      engineState.engineSubscription = {
        unsubscribe: () => {
          unsubMain();
          unsubExecuteNodes();
        },
      };

      // // queue all nodes
      // addAllNodesToQueue(store$.get());
      // processNodeQueue();
    },
    stop: ({ shouldAbort }) => {
      if (!engineState.running) {
        logger.warn(`[createWorkflowEngine:stop] Engine is not running`, { engine });
        return;
      }

      logger.log(`[createWorkflowEngine:stop] Stopping workflow engine...`, { engine });
      engineState.running = false;
      engineState.engineSubscription?.unsubscribe();
      engineState.engineSubscription = undefined;

      if (shouldAbort) {
        engineState.abortController.abort();
      }
    },
    queueNode: (nodeId) => {
      engineState.nodeIdsToExecute.add(nodeId);
      // addNodeToQueue(nodeId);
      // processNodeQueue();
    },
  };

  return engine;
};
