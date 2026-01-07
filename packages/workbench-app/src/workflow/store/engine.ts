/* eslint-disable @typescript-eslint/no-unused-vars */
import { subscribe } from 'valtio';
import {
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeEngine,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeStore,
  type WorkflowNodeId,
  type WorkflowRuntimeValue,
  type WorkflowEdgeId,
  type WorkflowRuntimeExecutionState,
  WorkflowBrandedTypes,
  type WorkflowExecutionArgs,
} from '../types';

const executeNode = async ({
  node,
  store,
  abortSignal,
}: {
  node: WorkflowRuntimeNode;
  store: WorkflowRuntimeStore;
  abortSignal: AbortSignal;
}) => {
  const nodeId = node.id;
  const typeDef = store.nodeTypes[node.type];
  if (!typeDef) {
    console.warn(`[createWorkflowEngine:processNodeQueue] Node type definition not found:`, {
      nodeId,
      type: node.type,
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
  const executionState: WorkflowRuntimeExecutionState =
    node.executionState ??
    (node.executionState = {
      status: `initial`,
      history: [],
    });

  if (executionState.status === `running`) {
    console.warn(
      `[createWorkflowEngine:processNodeQueue:executeNode] Node is already running, skipping execution:`,
      {
        nodeId,
        node,
        executionState,
      },
    );
    return;
  }

  executionState.status = `running`;
  executionState.startTimestamp = WorkflowBrandedTypes.now();
  executionState.endTimestamp = undefined;
  executionState.progressRatio = 0;
  executionState.progressMessage = undefined;
  executionState.errorMessage = undefined;

  const args: WorkflowExecutionArgs = {
    inputs: Object.fromEntries(node.inputs.map((input) => [input.name, input.value.data])),
    data: node.data.data,
    node,
    store,
    controller: {
      abortSignal,
      setProgress: ({ progressRatio, message }) => {
        console.log(`[createWorkflowEngine:processNodeQueue:executeNode] Node progress:`, {
          nodeId,
          progressRatio,
          message,
        });
        executionState.progressRatio = progressRatio;
        executionState.progressMessage = message;
      },
    },
  };

  try {
    const result = await typeDef.execute(args);
    abortSignal.throwIfAborted();

    executionState.status = `success`;
    executionState.endTimestamp = WorkflowBrandedTypes.now();

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
    for (const output of node.outputs) {
      if (output === undefined) continue;
      output.value.data = result.outputs[output.name] ?? undefined;
    }

    // set node data
    if (result.data !== undefined) {
      node.data.data = result.data ?? undefined;
    }
  } catch (err) {
    if (abortSignal.aborted) {
      executionState.status = `aborted`;
      executionState.endTimestamp = WorkflowBrandedTypes.now();
      console.log(`[createWorkflowEngine:processNodeQueue:executeNode] Node execution aborted:`, {
        nodeId,
        args,
      });
    } else {
      executionState.status = `error`;
      executionState.endTimestamp = WorkflowBrandedTypes.now();
      executionState.errorMessage = (err as Error)?.message ?? `Unknown error`;

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

  executionState.history.push({
    status: executionState.status,
    startTimestamp: executionState.startTimestamp!,
    endTimestamp: executionState.endTimestamp!,
    errorMessage: executionState.errorMessage,
  });
};

export const createWorkflowEngine = (store: WorkflowRuntimeStore): WorkflowRuntimeEngine => {
  const engineState = {
    running: false,
    isProcessing: false,
    wasRequestedDuringProcessing: false,
    /** add nodes to the nodeQueue when input changes
     * remove nodes from the nodeQueue when they finished executing and sent outputs
     */
    nodeQueue: new Set<WorkflowNodeId>(),
    /** nodes to execute, will resume after stop */
    nodeIdsToExecute: new Set<WorkflowNodeId>(),
    dataChangeCounters: new Map<WorkflowRuntimeValue, number>(),
    inputEdges: new Map<WorkflowRuntimeNode[`inputs`][number], undefined | WorkflowEdgeId>(),
    sub: undefined as undefined | { unsubscribe: () => void },
    abortController: new AbortController(),
    tickSpeed: 1000 as number | `slow` | `normal` | `fast`,
  };

  const addNodeToQueue = (nodeId: WorkflowNodeId) => {
    engineState.nodeQueue.add(nodeId);
  };
  const removeNodeFromQueue = (nodeId: WorkflowNodeId) => {
    // engineState.nodeQueue.delete(nodeId);
  };

  const clearNodeQueue = () => {
    // engineState.nodeQueue.clear();
  };
  const addAllNodesToQueue = (store: WorkflowRuntimeStore) => {
    if (Object.keys(store.nodes).length === engineState.nodeQueue.size) {
      return;
    }

    engineState.nodeQueue.clear();
    Object.values(store.nodes).forEach((node) => {
      engineState.nodeQueue.add(node.id);
    });
  };

  const channel = new MessageChannel();
  const queueMacrotask = (cb: () => void) => {
    if (typeof engineState.tickSpeed === `number` || engineState.tickSpeed === `slow`) {
      setTimeout(
        () => {
          cb();
        },
        typeof engineState.tickSpeed === `number` ? engineState.tickSpeed : 0,
      );
      return;
    }
    if (engineState.tickSpeed === `normal`) {
      requestAnimationFrame(() => {
        cb();
      });
      return;
    }

    channel.port1.onmessage = () => {
      cb();
    };
    channel.port2.postMessage(null);
  };

  const processNodeQueue = () => {
    if (engineState.isProcessing) {
      engineState.wasRequestedDuringProcessing = true;
      return;
    }
    engineState.isProcessing = true;
    engineState.wasRequestedDuringProcessing = false;

    queueMicrotask(() => {
      processNodeQueueInner();
    });
    // don't release until macro task
    queueMacrotask(() => {
      engineState.isProcessing = false;
      if (engineState.wasRequestedDuringProcessing) {
        processNodeQueue();
      }
    });
  };

  const processNodeQueueInner = () => {
    // forward data
    for (const nodeId of engineState.nodeQueue) {
      const node = store.nodes[nodeId];
      if (!node) {
        console.warn(`[createWorkflowEngine:processNodeQueue] Node not found in store:`, {
          nodeId,
        });
        removeNodeFromQueue(nodeId);
        continue;
      }

      console.log(
        `[createWorkflowEngine:processNodeQueue] Processing node: ${nodeId}`,
        // , { nodeId, node }
      );

      // send outputs to target inputs
      for (const output of node.outputs) {
        const hasChanged =
          output.value.dataChangeCounter !== engineState.dataChangeCounters.get(output.value);
        if (!hasChanged) {
          //   console.log(`[createWorkflowEngine:processNodeQueue] Node output has not changed:`, {
          //     nodeId,
          //     outputName: output.name,
          //     output,
          //   });
          continue;
        }
        engineState.dataChangeCounters.set(output.value, output.value.dataChangeCounter);

        for (const edge of output.getEdges()) {
          edge.value.data = output.value.data;
          edge.value.meta = output.value.meta;

          const targetNode = edge.target.getNode();
          const targetInput = targetNode?.inputs.find((i) => i.name === edge.target.inputName);
          if (!targetInput) {
            console.warn(
              `[createWorkflowEngine:processNodeQueue] Target node input not found for edge:`,
              { edge },
            );
            continue;
          }

          targetInput.value.data = edge.value.data;
          targetInput.value.meta = edge.value.meta;
        }
      }

      // check for new input edges, and pull if new edge
      for (const input of node.inputs) {
        if (input.edgeId === engineState.inputEdges.get(input)) {
          continue;
        }
        engineState.inputEdges.set(input, input.edgeId);

        // handle edge removal
        if (!input.edgeId) {
          input.value.data = undefined;
          input.value.meta = undefined;
          console.log(`[createWorkflowEngine:processNodeQueue] Input edge removed:`, {
            input,
            node,
          });
          continue;
        }

        const edge = store.edges[input.edgeId!];
        if (!edge) {
          console.warn(`[createWorkflowEngine:processNodeQueue] Input edge not found:`, {
            input,
            node,
          });
          continue;
        }

        const sourceNode = edge.source.getNode();
        const sourceOutput = sourceNode?.outputs.find((o) => o.name === edge.source.outputName);
        if (!sourceOutput) {
          console.warn(
            `[createWorkflowEngine:processNodeQueue] Source node output not found for edge:`,
            { edge },
          );
          continue;
        }

        input.value.data = edge.value.data = sourceOutput.value.data;
        input.value.meta = edge.value.meta = sourceOutput.value.meta;
      }
    }

    // execute nodes
    for (const nodeId of engineState.nodeQueue) {
      const node = store.nodes[nodeId];
      if (!node) {
        console.warn(`[createWorkflowEngine:processNodeQueue] Node not found in store:`, {
          nodeId,
        });
        removeNodeFromQueue(nodeId);
        continue;
      }

      const hasInputOrDataChanged =
        node.inputs.some(
          (input) =>
            input.value.dataChangeCounter !== engineState.dataChangeCounters.get(input.value),
        ) || node.data.dataChangeCounter !== engineState.dataChangeCounters.get(node.data);
      if (!hasInputOrDataChanged) {
        // console.log(`[createWorkflowEngine:processNodeQueue] Node inputs have not changed:`, {
        //   nodeId,
        // });
        removeNodeFromQueue(nodeId);
        continue;
      }
      // update data change counters
      for (const input of node.inputs) {
        engineState.dataChangeCounters.set(input.value, input.value.dataChangeCounter);
      }
      engineState.dataChangeCounters.set(node.data, node.data.dataChangeCounter);

      removeNodeFromQueue(nodeId);
      engineState.nodeIdsToExecute.add(nodeId);
    }

    for (const nodeId of engineState.nodeIdsToExecute) {
      const node = store.nodes[nodeId];
      if (!node) {
        console.warn(`[createWorkflowEngine:processNodeQueue] Node not found in store:`, {
          nodeId,
        });
        continue;
      }
      (async () => {
        await executeNode({ node, store, abortSignal: engineState.abortController.signal });
        // nodeIdsToExecute.push(nodeId);
        // processNodeQueue();
        if (!engineState.abortController.signal.aborted) {
          engineState.nodeIdsToExecute.delete(nodeId);
        }
      })();
    }
  };

  const engine: WorkflowRuntimeEngine = {
    get running() {
      return engineState.running;
    },
    get tickSpeed() {
      return engineState.tickSpeed;
    },
    set tickSpeed(value) {
      engineState.tickSpeed = value;
    },
    start: () => {
      if (engineState.running) {
        console.warn(`[createWorkflowEngine:start] Engine is already running`, { engine });
        return;
      }

      console.log(`[createWorkflowEngine:start] Starting workflow engine...`, { engine });
      engineState.running = true;
      engineState.isProcessing = false;
      engineState.wasRequestedDuringProcessing = false;
      engineState.abortController = new AbortController();

      // subscribe to store changes
      const sub = subscribe(store, (ops) => {
        console.log(`[createWorkflowEngine:store.subscribe] Store changed`, { ops });

        if (!engineState.running) {
          engineState.sub?.unsubscribe();
          engineState.sub = undefined;
          return;
        }

        // for (const op of ops) {
        //   const [, path, , ,] = op;
        //   type _0t = typeof store;
        //   type _1t = _0t[`nodes`];
        //   type _2t = _1t[WorkflowNodeId];
        //   type _3t = _2t[`inputs`] | _2t[`outputs`];
        //   type _4t = _2t[`inputs`][number] | _2t[`outputs`][number];
        //   type _5t = NonNullable<_4t[`value`]>;

        //   type _0 = keyof _0t;
        //   type _1 = keyof _1t;
        //   type _2 = keyof _2t;
        //   type _3 = number; //keyof _3t;
        //   type _4 = keyof _4t;
        //   type _5 = keyof _5t;

        //   const p = path as [_0, _1, _2, _3, _4, _5];

        //   // TODO: what if node structure changes? (nodes/edges/inputs/outputs added/removed)

        //   if (
        //     p[0] !== `nodes` ||
        //     (p[2] !== `inputs` && p[2] !== `outputs`) ||
        //     p[4] !== `value` ||
        //     p[5] !== `data`
        //   ) {
        //     continue;
        //   }

        //   addNodeToQueue(p[1]);
        // }

        // if (!engineState.nodeQueue.size) {
        //   return;
        // }

        // queue all nodes
        addAllNodesToQueue(store);
        processNodeQueue();
      });

      engineState.sub = { unsubscribe: sub };

      // queue all nodes
      addAllNodesToQueue(store);
      processNodeQueue();
    },
    stop: ({ shouldAbort }) => {
      if (!engineState.running) {
        console.warn(`[createWorkflowEngine:stop] Engine is not running`, { engine });
        return;
      }

      console.log(`[createWorkflowEngine:stop] Stopping workflow engine...`, { engine });
      engineState.running = false;
      engineState.sub?.unsubscribe();
      engineState.sub = undefined;

      if (shouldAbort) {
        engineState.abortController.abort();
      }
    },
    queueNode: (nodeId) => {
      addNodeToQueue(nodeId);
      processNodeQueue();
    },
  };

  return engine;
};
