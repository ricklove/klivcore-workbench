import { observable, type Observable } from '@legendapp/state';
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
    console.warn(`[createWorkflowEngine:processNodeQueue] Node type definition not found:`, {
      nodeId,
      type: node$.type.peek(),
    });
    return;
  }

  console.log(
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
    console.warn(
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
        console.log(`[createWorkflowEngine:processNodeQueue:executeNode] Node progress:`, {
          nodeId,
          progressRatio,
          message,
        });
        executionState$.runState.progressRatio.set(progressRatio);
        executionState$.runState.progressMessage.set(message);
      },
    },
  };

  try {
    const result = await typeDef.execute(args);
    abortSignal.throwIfAborted();

    executionState$.status.set(`success`);
    executionState$.runState.endTimestamp.set(WorkflowBrandedTypes.now());

    console.log(
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
      console.log(`[createWorkflowEngine:processNodeQueue:executeNode] Node execution aborted:`, {
        nodeId,
        args,
      });
    } else {
      executionState$.status.set(`error`);
      executionState$.runState.endTimestamp.set(WorkflowBrandedTypes.now());
      executionState$.runState.errorMessage.set((err as Error)?.message ?? `Unknown error`);

      console.error(
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
        console.warn(`[createWorkflowEngine:start] Engine is already running`, { engine });
        return;
      }

      console.log(`[createWorkflowEngine:start] Starting workflow engine...`, { engine });
      engineState.running = true;
      engineState.abortController = new AbortController();

      const unsubMain = observeBatched(() => {
        if (!engineState.running) {
          unsubMain();
          return;
        }

        // subscribe to every node
        Object.keys(store$.nodes).forEach((nodeIdKey) => {
          const nodeId = WorkflowBrandedTypes.nodeId(nodeIdKey);
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

          const node$ = store$.nodes[nodeId];
          const unsubInputs = observeBatched(() => {
            if (!engineState.running) {
              return;
            }

            console.log(
              `[createWorkflowEngine:nodeSubscription:inputs] Node data or input changed, queuing execution: ${nodeId}`,
              {
                node: node$.peek(),
              },
            );

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

              console.log(
                `[createWorkflowEngine:nodeSubscription:inputs] Pulling input value from new edge for input: ${input.name} on node: ${nodeId}`,
                { input },
              );

              const edge = store$.edges[input.edgeId]?.peek();
              if (!edge) {
                console.warn(
                  `[createWorkflowEngine:nodeSubscription:inputs] Input edge not found:`,
                  {
                    input,
                    node: node$.peek(),
                  },
                );
                continue;
              }

              if (edge.value.getValue() !== undefined) {
                console.log(
                  `[createWorkflowEngine:nodeSubscription:inputs] Using edge value for input: ${input.name} on node: ${nodeId}`,
                  { edge },
                );
                input.value.setValue(edge.value.getValue());
                continue;
              }

              const sourceNode = edge.source.getNode();
              const sourceOutput = sourceNode?.outputs.find(
                (o) => o.name === edge.source.outputName,
              );
              if (!sourceOutput) {
                console.warn(
                  `[createWorkflowEngine:nodeSubscription:inputs] Source node output not found for edge:`,
                  { edge },
                );
                continue;
              }

              console.log(
                `[createWorkflowEngine:nodeSubscription:inputs] Pulling value from source output for input: ${input.name} on node: ${nodeId}`,
                { sourceOutput },
              );
              edge.value.setValue(sourceOutput.value.getValue());
              input.value.setValue(sourceOutput.value.getValue());
            }

            // queue node for execution
            engineState.nodeIdsToExecute.add(nodeId);
          }, engineState.triggerKind);

          const unsubPropogateOutputs = observeBatched(() => {
            if (!engineState.running) {
              return;
            }

            console.log(
              `[createWorkflowEngine:nodeSubscription:outputs] Node outputs changed, propogating outputs: ${nodeId}`,
              {
                node: node$.peek(),
              },
            );

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_outputValues] = node$.outputs.map((x) => [x.value.getValue()]);

            // send outputs to target inputs
            for (const output of node$.outputs.peek()) {
              const hasChanged =
                output.value.dataChangeCounter !== engineState.dataChangeCounters.get(output.value);

              if (!hasChanged) {
                //   console.log(
                //     `[createWorkflowEngine:nodeSubscription:outputs] Node output has not changed:`,
                //     {
                //       nodeId,
                //       outputName: output.name,
                //       output,
                //     },
                //   );
                continue;
              }

              // send the output through edges
              engineState.dataChangeCounters.set(output.value, output.value.dataChangeCounter);
              for (const edge of output.getEdges()) {
                edge.value.setValue(output.value.getValue());

                const targetNode = edge.target.getNode();
                const targetInput = targetNode?.inputs.find(
                  (i) => i.name === edge.target.inputName,
                );
                if (!targetInput) {
                  console.warn(
                    `[createWorkflowEngine:nodeSubscription:outputs] Target node input not found for edge:`,
                    { edge },
                  );
                  continue;
                }
                targetInput.value.setValue(edge.value.getValue());
              }
            }
          }, engineState.triggerKind);

          engineState.nodeSubscriptions.set(nodeId, {
            unsubscribe: () => {
              unsubInputs();
              unsubPropogateOutputs();
            },
          });
        });

        return () => {
          Object.values(engineState.nodeSubscriptions).forEach((unsub) => unsub.unsubscribe());
          engineState.nodeSubscriptions.clear();
        };
      }, engineState.triggerKind);

      const unsubExecuteNodes = observeBatched(() => {
        if (!engineState.running) {
          unsubExecuteNodes();
          return;
        }

        const nodeIdsToExecute = Array.from(engineState.nodeIdsToExecute.get());
        if (nodeIdsToExecute.length === 0) {
          return;
        }

        console.log(`[createWorkflowEngine:executeNodes] Executing queued nodes:`, {
          nodeIdsToExecute,
        });

        (async () => {
          const promises = nodeIdsToExecute.map(async (nodeId) => {
            const node$ = store$.nodes[nodeId];
            if (!node$?.id.get()) {
              console.warn(
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
        console.warn(`[createWorkflowEngine:stop] Engine is not running`, { engine });
        return;
      }

      console.log(`[createWorkflowEngine:stop] Stopping workflow engine...`, { engine });
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
