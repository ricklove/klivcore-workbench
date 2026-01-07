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
} from '../types';

export const createWorkflowEngine = (store: WorkflowRuntimeStore): WorkflowRuntimeEngine => {
  const state = {
    running: false,
    /** add nodes to the nodeQueue when input changes
     * remove nodes from the nodeQueue when they finished executing and sent outputs
     */
    nodeQueue: new Set<WorkflowNodeId>(),
    dataChangeCounters: new Map<WorkflowRuntimeValue, number>(),
    inputEdges: new Map<WorkflowRuntimeNode[`inputs`][number], undefined | WorkflowEdgeId>(),
    sub: undefined as undefined | { unsubscribe: () => void },
    abortController: new AbortController(),
  };

  const processNodeQueue = () => {
    // forward data
    for (const nodeId of state.nodeQueue) {
      const node = store.nodes[nodeId];
      if (!node) {
        console.warn(`[createWorkflowEngine:processNodeQueue] Node not found in store:`, {
          nodeId,
        });
        state.nodeQueue.delete(nodeId);
        continue;
      }

      console.log(`[createWorkflowEngine:processNodeQueue] Processing node:`, { nodeId, node });

      // send outputs to target inputs
      for (const output of node.outputs) {
        const hasChanged =
          output.value.dataChangeCounter !== state.dataChangeCounters.get(output.value);
        if (!hasChanged) {
          console.log(`[createWorkflowEngine:processNodeQueue] Node output has changed:`, {
            nodeId,
            outputName: output.name,
          });
          continue;
        }
        state.dataChangeCounters.set(output.value, output.value.dataChangeCounter);

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
        if (input.edgeId === state.inputEdges.get(input)) {
          continue;
        }
        state.inputEdges.set(input, input.edgeId);

        const edge = store.edges[input.edgeId!];
        if (!edge) {
          console.warn(`[createWorkflowEngine:processNodeQueue] Input edge not found:`, { input });
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
    for (const nodeId of state.nodeQueue) {
      const node = store.nodes[nodeId];
      if (!node) {
        console.warn(`[createWorkflowEngine:processNodeQueue] Node not found in store:`, {
          nodeId,
        });
        state.nodeQueue.delete(nodeId);
        continue;
      }

      const hasInputChanges = node.inputs.some(
        (input) => input.value.dataChangeCounter !== state.dataChangeCounters.get(input.value),
      );
      if (!hasInputChanges) {
        console.log(`[createWorkflowEngine:processNodeQueue] Node inputs have not changed:`, {
          nodeId,
        });
        state.nodeQueue.delete(nodeId);
        continue;
      }

      const typeDef = store.nodeTypes[node.type];
      if (!typeDef) {
        console.warn(`[createWorkflowEngine:processNodeQueue] Node type definition not found:`, {
          nodeId,
          type: node.type,
        });
        state.nodeQueue.delete(nodeId);
        continue;
      }

      (async () => {
        console.log(`[createWorkflowEngine:processNodeQueue] Executing node:`, { nodeId, node });
        const executionState: WorkflowRuntimeExecutionState =
          node.executionState ??
          (node.executionState = {
            status: `initial`,
            history: [],
          });

        executionState.status = `running`;
        executionState.startTimestamp = WorkflowBrandedTypes.now();
        executionState.endTimestamp = undefined;
        executionState.progressRatio = 0;
        executionState.progressMessage = undefined;
        executionState.errorMessage = undefined;

        try {
          const result = await typeDef.execute({
            inputs: Object.fromEntries(node.inputs.map((input) => [input.name, input.value.data])),
            data: node.data.data,
            node,
            store,
            controller: {
              abortSignal: state.abortController.signal,
              setProgress: ({ progressRatio, message }) => {
                console.log(`[createWorkflowEngine:processNodeQueue] Node progress:`, {
                  nodeId,
                  progressRatio,
                  message,
                });
                executionState.progressRatio = progressRatio;
                executionState.progressMessage = message;
              },
            },
          });
          state.abortController.signal.throwIfAborted();

          executionState.status = `success`;
          executionState.endTimestamp = WorkflowBrandedTypes.now();

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
          if (state.abortController.signal.aborted) {
            executionState.status = `aborted`;
            executionState.endTimestamp = WorkflowBrandedTypes.now();
            console.log(`[createWorkflowEngine:processNodeQueue] Node execution aborted:`, {
              nodeId,
            });
          } else {
            executionState.status = `error`;
            executionState.endTimestamp = WorkflowBrandedTypes.now();
            executionState.errorMessage = (err as Error)?.message ?? `Unknown error`;

            console.error(`[createWorkflowEngine:processNodeQueue] Error executing node:`, {
              nodeId,
              err,
            });
          }
        }

        executionState.history.push({
          status: executionState.status,
          startTimestamp: executionState.startTimestamp!,
          endTimestamp: executionState.endTimestamp!,
          errorMessage: executionState.errorMessage,
        });

        state.nodeQueue.delete(nodeId);
      })();
    }
  };

  const engine: WorkflowRuntimeEngine = {
    get running() {
      return state.running;
    },
    start: () => {
      if (state.running) {
        console.warn(`[createWorkflowEngine:start] Engine is already running`, { engine });
        return;
      }

      console.log(`[createWorkflowEngine:start] Starting workflow engine...`, { engine });
      state.running = true;
      state.abortController = new AbortController();

      // subscribe to store changes
      subscribe(store, (ops) => {
        if (!state.running) {
          state.sub?.unsubscribe();
          state.sub = undefined;
          return;
        }

        for (const op of ops) {
          const [, path, , ,] = op;
          type _0t = typeof store;
          type _1t = _0t[`nodes`];
          type _2t = _1t[WorkflowNodeId];
          type _3t = _2t[`inputs`] | _2t[`outputs`];
          type _4t = _2t[`inputs`][number] | _2t[`outputs`][number];
          type _5t = NonNullable<_4t[`value`]>;

          type _0 = keyof _0t;
          type _1 = keyof _1t;
          type _2 = keyof _2t;
          type _3 = number; //keyof _3t;
          type _4 = keyof _4t;
          type _5 = keyof _5t;

          const p = path as [_0, _1, _2, _3, _4, _5];

          // TODO: what if node structure changes? (nodes/edges/inputs/outputs added/removed)

          if (
            p[0] !== `nodes` ||
            (p[2] !== `inputs` && p[2] !== `outputs`) ||
            p[4] !== `value` ||
            p[5] !== `data`
          ) {
            continue;
          }

          state.nodeQueue.add(p[1]);
        }

        if (!state.nodeQueue.size) {
          return;
        }

        processNodeQueue();
      });

      // queue all nodes
      state.nodeQueue = new Set(Object.keys(store.nodes) as WorkflowNodeId[]);
      processNodeQueue();
    },
    stop: ({ shouldAbort }) => {
      if (!state.running) {
        console.warn(`[createWorkflowEngine:stop] Engine is not running`, { engine });
        return;
      }

      console.log(`[createWorkflowEngine:stop] Stopping workflow engine...`, { engine });
      state.running = false;
      state.sub?.unsubscribe();
      state.sub = undefined;

      if (shouldAbort) {
        state.abortController.abort();
      }
    },
    queueNode: (nodeId) => {
      state.nodeQueue.add(nodeId);
      processNodeQueue();
    },
  };

  return engine;
};
