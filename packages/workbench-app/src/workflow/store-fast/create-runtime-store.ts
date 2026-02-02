import { type Observable, ObservableHint, observable } from '@legendapp/state';
import { codeBuiltinNodeTypes } from '../../code-tools/code-nodes';
import { commonNodeTypes } from '../../nodes/common/_common-nodes';
import { llmNodeTypes } from '../../nodes/llm/_llm-nodes';
import { subflowNodeTypes } from '../../nodes/subflows/_subflow-nodes';
import { valueGateNodeTypes } from '../../nodes/utility/value-gate';
import { webglNodeTypes } from '../../nodes/webgl/_webgl-nodes';
import { builtinNodeTypes } from '../node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowDocumentData,
  type WorkflowEdgeId,
  type WorkflowInputName,
  type WorkflowNodeId,
  type WorkflowNodeTypeName,
  type WorkflowOutputName,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowRuntimeStore,
  type WorkflowRuntimeStoreActions,
} from '../types';
import { createRuntimeValue } from './runtime-value';

const getters = {
  node: {
    inputs: {
      getEdge: (
        storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
        x: WorkflowRuntimeNode[`inputs`][number],
      ) => {
        if (!x.edgeId) {
          return undefined;
        }
        return storeObj.edges[x.edgeId];
      },
    },
    outputs: {
      getEdges: (
        storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
        x: WorkflowRuntimeNode[`outputs`][number],
      ) => {
        if (!x.edgeIds) {
          return [];
        }
        return x.edgeIds.map((id) => storeObj.edges[id]).filter((e) => !!e);
      },
    },
    getInputData: <T>(
      _storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
      node: WorkflowRuntimeNode,
      inputName: WorkflowInputName,
    ): { data: T | undefined | null; isConnected: boolean } => {
      const input = node.inputs.find((i) => i.name === inputName);
      const isConnected = !!input?.edgeId;
      const data = input ? input.value.getUiValue<T>() : undefined;
      return { data, isConnected };
    },
    getOutputData: <T>(
      _storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
      node: WorkflowRuntimeNode,
      outputName: WorkflowOutputName,
    ): { data: T | undefined | null; isConnected: boolean } => {
      const output = node.outputs.find((o) => o.name === outputName);
      const isConnected = !!output?.edgeIds && output.edgeIds.length > 0;
      const data = output ? output.value.getUiValue<T>() : undefined;
      return { data, isConnected };
    },
    getData: <T>(
      _storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
      node: WorkflowRuntimeNode,
    ): { data: T | undefined | null } => {
      const data = node.data.getUiValue<T>();
      return { data };
    },
    getGraphErrors(
      storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
      x: WorkflowRuntimeNode,
    ) {
      const nodeTypeDef = storeObj.nodeTypes[x.type];

      if (nodeTypeDef) {
        return undefined;
      }

      return [
        {
          kind: `missing-type-definition` as const,
        },
      ];
    },
  },
  edge: {
    source: {
      getNode(
        storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
        x: WorkflowRuntimeEdge[`source`],
      ) {
        if (!x.nodeId) {
          return undefined;
        }
        return storeObj.nodes[x.nodeId];
      },
    },
    target: {
      getNode(
        storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
        x: WorkflowRuntimeEdge[`target`],
      ) {
        if (!x.nodeId) {
          return undefined;
        }
        return storeObj.nodes[x.nodeId];
      },
    },
    getGraphErrors(
      _storeObj: Pick<WorkflowRuntimeStore, 'nodes' | 'edges' | 'nodeTypes'>,
      x: WorkflowRuntimeEdge,
    ) {
      const missingSourceNode = !x.source.getNode();
      const missingTargetNode = !x.target.getNode();
      const missingSourceOutput = !x.source
        .getNode()
        ?.outputs.find((o) => o.name === x.source.outputName);
      const missingTargetInput = !x.target
        .getNode()
        ?.inputs.find((i) => i.name === x.target.inputName);

      if (
        !missingSourceNode &&
        !missingTargetNode &&
        !missingSourceOutput &&
        !missingTargetInput
      ) {
        return undefined;
      }

      return [
        ...(missingSourceNode
          ? [{ kind: `missing-source-node` as const }]
          : []),
        ...(missingTargetNode
          ? [{ kind: `missing-target-node` as const }]
          : []),
        ...(missingSourceOutput
          ? [{ kind: `missing-source-output` as const }]
          : []),
        ...(missingTargetInput
          ? [{ kind: `missing-target-input` as const }]
          : []),
      ];
    },
  },
};

// const createRuntimeValue = ({
//   data,
//   // meta,
// }: {
//   data: unknown;
//   // meta?: WorkflowRuntimeValue['meta'];
// }): WorkflowRuntimeValue => {
//   const inner$ = observable(ObservableHint.opaque({ content: data }));
//   const dataChangeCounter$ = observable(0);

//   const v: WorkflowRuntimeValue = {
//     box: ObservableHint.opaque({
//       getValue: <T>() => {
//         return inner$.peek().content as T | undefined;
//       },
//       setValue: <T>(v: T | undefined) => {
//         inner$.set(ObservableHint.opaque({ content: v as T }));
//       },
//       get dataChangeCounter() {
//         return dataChangeCounter$.peek();
//       },
//       // meta,
//     }),
//   };

//   observe(() => {
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     const _boxChanged = inner$.get();
//     dataChangeCounter$.set(dataChangeCounter$.peek() + 1);
//   });

//   return {
//     get box() {
//       // subscribe to dataChangeCounter to trigger reactivity
//       dataChangeCounter$.get();
//       return v.box;
//     },
//   };
// };

const loadWorkflowStoreFromDocument = (
  document: WorkflowDocumentData,
): Observable<WorkflowRuntimeStore> => {
  const store$ = createEmptyStore();
  const storeObj = store$.get() as WorkflowRuntimeStore;

  // create nodes
  for (const n of document.nodes) {
    const runtimeNode: WorkflowRuntimeNode = {
      id: n.id,
      type: n.type,
      parentId: n.parentId,
      position: n.position,
      inputs: n.inputs.map((x) => ({
        name: x.name,
        type: x.type,
        value: createRuntimeValue({ data: undefined }),
        edgeId: undefined,
        getEdge() {
          return getters.node.inputs.getEdge(storeObj, this);
        },
      })),
      getInputInfo: <T>(inputName: string) => {
        return getters.node.getInputData<T>(
          storeObj,
          runtimeNode,
          WorkflowBrandedTypes.inputName(inputName),
        );
      },
      outputs: n.outputs.map((x) => ({
        name: x.name,
        type: x.type,
        value: createRuntimeValue({ data: undefined }),
        edgeIds: undefined,
        getEdges() {
          return getters.node.outputs.getEdges(storeObj, this);
        },
      })),
      getOutputInfo: <T>(outputName: string) => {
        return getters.node.getOutputData<T>(
          storeObj,
          runtimeNode,
          WorkflowBrandedTypes.outputName(outputName),
        );
      },
      getData: <T>() => {
        return getters.node.getData<T>(storeObj, runtimeNode);
      },
      data: createRuntimeValue({ data: n.data }),
      runtimeState: createRuntimeValue({ data: {} }),
      mode: n.mode,
      getGraphErrors() {
        return getters.node.getGraphErrors(storeObj, this);
      },
      unloader: ObservableHint.opaque({}),
    };

    storeObj.nodes[runtimeNode.id] = runtimeNode;
  }

  // create edges
  for (const n of document.nodes) {
    for (const input of n.inputs) {
      if (!input.source) {
        continue;
      }
      const edgeId = WorkflowBrandedTypes.edgeId(
        input.source.nodeId,
        input.source.name,
        n.id,
        input.name,
      );
      const sourceNode = storeObj.nodes[input.source.nodeId];
      const targetNode = storeObj.nodes[n.id];
      if (!targetNode) {
        continue;
      }
      const edge: WorkflowRuntimeEdge = {
        id: edgeId,
        source: {
          nodeId: input.source.nodeId,
          outputName: input.source.name,

          getNode() {
            return getters.edge.source.getNode(storeObj, this);
          },
        },
        target: {
          nodeId: targetNode.id,
          inputName: input.name,
          getNode() {
            return getters.edge.target.getNode(storeObj, this);
          },
        },
        value: createRuntimeValue({ data: undefined }),
        getGraphErrors() {
          return getters.edge.getGraphErrors(storeObj, this);
        },
      };
      storeObj.edges[edgeId] = edge;

      // add edges to nodes
      const targetInput = targetNode.inputs.find((i) => i.name === input.name);
      if (targetInput) {
        targetInput.edgeId = edge.id;
        targetInput.value.setValue(null);
      }

      const sourceOutput = sourceNode?.outputs.find(
        (o) => o.name === input.source?.name,
      );
      if (sourceOutput) {
        sourceOutput.edgeIds = sourceOutput.edgeIds || [];
        sourceOutput.edgeIds.push(edge.id);
      }
    }
  }
  return store$;
};

const populateNodeType = (
  store: WorkflowRuntimeStore,
  node: WorkflowRuntimeNode,
) => {
  const typeDef = store.nodeTypes[node.type];
  if (!typeDef) {
    console.error(
      `[createWorkflowStoreFromDocument] Missing node type definition for type ${node.type}`,
    );
    return;
  }

  // console.log(
  //   `Populating node ${node.id} of type ${node.type}`,
  //   // , { node, typeDef, store }
  // );

  // add type input and outputs
  for (const typeInput of typeDef.inputs) {
    if (node.inputs.find((i) => i.name === typeInput.name)) {
      // skip existing inputs
      continue;
    }

    node.inputs.push({
      name: typeInput.name,
      type: typeInput.type,
      value: createRuntimeValue({ data: undefined }),
      edgeId: undefined,
      getEdge() {
        return getters.node.inputs.getEdge(store, this);
      },
    });
  }
  for (const typeOutput of typeDef.outputs) {
    if (node.outputs.find((o) => o.name === typeOutput.name)) {
      // skip existing outputs
      continue;
    }

    node.outputs.push({
      name: typeOutput.name,
      type: typeOutput.type,
      value: createRuntimeValue({ data: undefined }),
      edgeIds: undefined,
      getEdges() {
        return getters.node.outputs.getEdges(store, this);
      },
    });
  }
};

const loadNode = async ({
  store$,
  nodeId,
}: {
  store$: Observable<WorkflowRuntimeStore>;
  nodeId: WorkflowNodeId;
}) => {
  const node$ = store$.nodes[nodeId];
  if (!node$) {
    return;
  }
  const nodeTypeName = node$.type.peek();
  const nodeType = store$.nodeTypes[nodeTypeName]?.peek();
  const sub = await nodeType?.load?.({
    node$,
    store$,
    runtimeState: node$.peek().runtimeState,
    controller: {
      registerEvent: (event) => {
        console.log(`[loadNode] registering event for node ${nodeId}`);
        const sub = event((outputs) => {
          // console.log(
          //   `[loadNode] Setting outputs of node ${nodeId} with ${Object.keys(
          //     outputs,
          //   )
          //     .map((x) => `'${x}'`)
          //     .join(', ')}`,
          //   {
          //     outputs,
          //   },
          // );
          node$.outputs.forEach((output$) => {
            output$.value.get().setValue(outputs[output$.name.get()]);
          });
        });

        //         for (const output of node.outputs) {
        //   if (result.outputs[output.name] === undefined) continue;
        //   output.value.setValue(result.outputs[output.name]);
        // }

        return sub;
      },
    },
  });

  const node = node$.peek();
  const lastUnload = node.unloader.unload;
  node.unloader.unload = () => {
    sub?.unsubscribe();
    lastUnload?.();
  };
};

const createEmptyStore = (): Observable<WorkflowRuntimeStore> => {
  const actions: WorkflowRuntimeStoreActions = {
    createNodeType: (definition) => {
      store$.nodeTypes[definition.type]?.set(definition);
      // populate existing nodes of this type
      for (const node of Object.values(store$.nodes.get())) {
        if (node.type === definition.type) {
          populateNodeType(store$.get(), node);
          loadNode({
            store$,
            nodeId: node.id,
          });
        }
      }
    },
    deleteNodeType: (typeName: string) => {
      store$.nodeTypes[WorkflowBrandedTypes.typeName(typeName)]?.delete();
    },
    createNode: (args) => {
      const nodeId = WorkflowBrandedTypes.nodeId(args.id);
      const nodeType = store$.nodeTypes[args.type]?.get();
      if (!nodeType) {
        const runtimeNode: WorkflowRuntimeNode = {
          ...args,
          id: nodeId,
          inputs: [],
          outputs: [],
          data: createRuntimeValue({ data: undefined }),
          runtimeState: createRuntimeValue({ data: {} }),
          getInputInfo: <T>(inputName: string) => {
            return getters.node.getInputData<T>(
              store$.get(),
              runtimeNode,
              WorkflowBrandedTypes.inputName(inputName),
            );
          },
          getOutputInfo: <T>(outputName: string) => {
            return getters.node.getOutputData<T>(
              store$.get(),
              runtimeNode,
              WorkflowBrandedTypes.outputName(outputName),
            );
          },
          getData: <T>() => {
            return getters.node.getData<T>(store$.get(), runtimeNode);
          },
          getGraphErrors() {
            return getters.node.getGraphErrors(store$.get(), runtimeNode);
          },
          unloader: ObservableHint.opaque({}),
        };

        store$.nodes[nodeId]?.set(runtimeNode);
        return;
      }

      const runtimeNode: WorkflowRuntimeNode = {
        ...args,
        id: nodeId,
        inputs: nodeType.inputs.map((i) => ({
          name: i.name,
          type: i.type,
          value: createRuntimeValue({ data: undefined }),
          edgeId: undefined,
          getEdge() {
            return getters.node.inputs.getEdge(store$.get(), this);
          },
        })),
        outputs: nodeType.outputs.map((o) => ({
          name: o.name,
          type: o.type,
          value: createRuntimeValue({ data: undefined }),
          edgeIds: undefined,
          getEdges() {
            return getters.node.outputs.getEdges(store$.get(), this);
          },
        })),
        data: createRuntimeValue({ data: undefined }),
        runtimeState: createRuntimeValue({ data: {} }),
        getInputInfo: <T>(inputName: string) => {
          return getters.node.getInputData<T>(
            store$.get(),
            runtimeNode,
            WorkflowBrandedTypes.inputName(inputName),
          );
        },
        getOutputInfo: <T>(outputName: string) => {
          return getters.node.getOutputData<T>(
            store$.get(),
            runtimeNode,
            WorkflowBrandedTypes.outputName(outputName),
          );
        },
        getData: <T>() => {
          return getters.node.getData<T>(store$.get(), runtimeNode);
        },
        getGraphErrors: () => {
          return getters.node.getGraphErrors(store$.get(), runtimeNode);
        },
        unloader: ObservableHint.opaque({}),
      };

      store$.nodes[nodeId]?.set(runtimeNode);
      loadNode({
        store$,
        nodeId,
      });
    },
    deleteNode: (nodeId) => {
      console.log(`[deleteNode] Deleting node with id ${nodeId}`, { store$ });

      const node$ = store$.nodes[nodeId];
      if (node$?.isDeleted.peek()) {
        // already deleted
        return;
      }

      console.log(`[deleteNode] isDeleted=true ${nodeId}`, { store$ });

      if (!node$?.id.peek()) {
        console.warn(`[deleteNode] Node with id ${nodeId} does not exist`);
        return;
      }

      console.log(`[deleteNode] deleting edges ${nodeId}`, { store$ });

      node$.inputs.forEach((input$) => {
        const edgeId = input$.edgeId.peek();
        if (edgeId) {
          store$.actions.deleteEdge(edgeId);
        }
      });
      node$.outputs.forEach((output$) => {
        output$.edgeIds?.forEach((edgeId$) => {
          const edgeId = edgeId$.peek();
          if (edgeId) {
            store$.actions.deleteEdge(edgeId);
          }
        });
      });

      node$?.isDeleted.set(true);
      node$?.peek().unloader.unload?.();
      // node$?.delete();
    },
    renameNode: ({ oldId, newId }) => {
      const node = store$.nodes[oldId];
      if (!node?.id.get()) {
        console.warn(`[renameNode] Node with id ${oldId} does not exist`);
        return;
      }
      const newNodeId = WorkflowBrandedTypes.nodeId(newId);
      if (store$.nodes[newNodeId]?.id.get()) {
        console.warn(`[renameNode] Node with id ${newId} already exists`);
        return;
      }

      node.newIdUntilReload.set(newNodeId);
    },
    createEdge: (args) => {
      const targetNode = store$.nodes[args.target.nodeId]?.get();
      const targetInput = targetNode?.inputs.find(
        (i) => i.name === args.target.inputName,
      );

      const sourceNode = store$.nodes[args.source.nodeId]?.get();
      const sourceOutput = sourceNode?.outputs.find(
        (o) => o.name === args.source.outputName,
      );

      if (!targetNode || !targetInput || !sourceNode || !sourceOutput) {
        console.warn(
          `[createEdge] Cannot create edge, missing source or target`,
          {
            args,
            targetNode,
            targetInput,
            sourceNode,
            sourceOutput,
          },
        );
        return;
      }

      if (targetInput.edgeId) {
        // remove existing edge
        store$.actions.deleteEdge(targetInput.edgeId);
      }

      const edgeId = WorkflowBrandedTypes.edgeId(
        args.source.nodeId,
        args.source.outputName,
        args.target.nodeId,
        args.target.inputName,
      );
      store$.edges[edgeId]?.set({
        id: edgeId,
        source: {
          nodeId: args.source.nodeId,
          outputName: args.source.outputName,
          getNode() {
            return getters.edge.source.getNode(
              store$.get(),
              this as WorkflowRuntimeEdge['source'],
            );
          },
        },
        target: {
          nodeId: args.target.nodeId,
          inputName: args.target.inputName,
          getNode() {
            return getters.edge.target.getNode(
              store$.get(),
              this as WorkflowRuntimeEdge['target'],
            );
          },
        },
        value: createRuntimeValue({ data: undefined }),
        getGraphErrors() {
          return getters.edge.getGraphErrors(
            store$.get(),
            this as WorkflowRuntimeEdge,
          );
        },
      });

      // update nodes
      if (targetInput) {
        targetInput.edgeId = edgeId;
        targetInput.value.setValue(null);
      }

      if (sourceOutput) {
        sourceOutput.edgeIds = sourceOutput.edgeIds || [];
        sourceOutput.edgeIds.push(edgeId);
      }

      console.log(`[createEdge] Created edge ${edgeId}`, {
        args,
        store$,
        edgeId,
        targetInput,
        sourceOutput,
      });
    },
    deleteEdge: (edgeId) => {
      const edge = store$.edges[edgeId]?.get();
      if (!edge) {
        return;
      }
      if (edge.isDeleted) {
        // already deleted
        return;
      }

      // remove edge from nodes
      const targetNode = store$.nodes[edge.target.nodeId]?.get();
      const targetInput = targetNode?.inputs.find(
        (i) => i.name === edge.target.inputName,
      );

      const sourceNode = store$.nodes[edge.source.nodeId]?.get();
      const sourceOutput = sourceNode?.outputs.find(
        (o) => o.name === edge.source.outputName,
      );

      // if (!targetNode || !targetInput || !sourceNode || !sourceOutput) {
      //   console.warn(`[createEdge] Cannot remove edge, missing source or target`, {
      //     edge,
      //     targetNode,
      //     targetInput,
      //     sourceNode,
      //     sourceOutput,
      //   });
      //   return;
      // }

      if (targetInput) {
        targetInput.edgeId = undefined;
        targetInput.value.clearValue(undefined);
      }

      if (sourceOutput) {
        sourceOutput.edgeIds = sourceOutput.edgeIds || [];
        sourceOutput.edgeIds.splice(sourceOutput.edgeIds.indexOf(edgeId), 1);
      }

      store$.edges[edgeId]?.isDeleted.set(true);
      // store$.edges[edgeId]?.delete();
    },
    updateInputs: (nodeId, inputs) => {
      const node$ = store$.nodes[nodeId];
      const node = store$.nodes[nodeId]?.peek();
      if (!node$ || !node) {
        console.warn(`[updateInputs] Node with id ${nodeId} does not exist`);
        return;
      }

      const addedInputs = inputs.filter(
        (input) => !node.inputs.find((i) => i.name === input.name),
      );
      const removedInputs = node.inputs.filter(
        (input) => !inputs.find((i) => i.name === input.name),
      );
      const changedInputs = node.inputs.filter((input) => {
        const newInput = inputs.find((i) => i.name === input.name);
        return newInput && newInput.type !== input.type;
      });

      for (const item of addedInputs) {
        node$.inputs.push({
          name: item.name,
          type: item.type,
          value: createRuntimeValue({ data: undefined }),
          edgeId: undefined,
          getEdge() {
            return getters.node.inputs.getEdge(store$.get(), this);
          },
        });
      }

      for (const item of removedInputs) {
        const input$ = node$.inputs.find((i) => i.name.peek() === item.name);
        const edgeId = input$?.edgeId.peek();
        if (edgeId) {
          store$.actions.deleteEdge(edgeId);
        }
        input$?.delete();
      }

      for (const item of changedInputs) {
        const input$ = node$.inputs.find((i) => i.name.peek() === item.name);
        if (!input$) {
          continue;
        }
        input$.type.set(item.type);
      }
    },
    updateOutputs: (nodeId, outputs) => {
      const node$ = store$.nodes[nodeId];
      const node = store$.nodes[nodeId]?.peek();
      if (!node$ || !node) {
        console.warn(`[updateOutputs] Node with id ${nodeId} does not exist`);
        return;
      }

      const addedOutputs = outputs.filter(
        (output) => !node.outputs.find((o) => o.name === output.name),
      );
      const removedOutputs = node.outputs.filter(
        (output) => !outputs.find((o) => o.name === output.name),
      );
      const changedOutputs = node.outputs.filter((output) => {
        const newOutput = outputs.find((o) => o.name === output.name);
        return newOutput && newOutput.type !== output.type;
      });

      for (const item of addedOutputs) {
        node$.outputs.push({
          name: item.name,
          type: item.type,
          value: createRuntimeValue({ data: undefined }),
          edgeIds: undefined,
          getEdges() {
            return getters.node.outputs.getEdges(store$.get(), this);
          },
        });
      }

      for (const item of removedOutputs) {
        const output$ = node$.outputs.find((o) => o.name.peek() === item.name);
        const edgeIds = output$?.edgeIds.peek() || [];
        for (const edgeId of edgeIds) {
          store$.actions.deleteEdge(edgeId);
        }
        output$?.delete();
      }

      for (const item of changedOutputs) {
        const output$ = node$.outputs.find((o) => o.name.peek() === item.name);
        if (!output$) {
          continue;
        }
        output$.type.set(item.type);
      }
    },
  };

  const store$: Observable<WorkflowRuntimeStore> = observable({
    nodeTypes: {} as Record<
      WorkflowNodeTypeName,
      WorkflowRuntimeNodeTypeDefinition
    >,
    nodes: {} as Record<WorkflowNodeId, WorkflowRuntimeNode>,
    edges: {} as Record<WorkflowEdgeId, WorkflowRuntimeEdge>,
    actions: ObservableHint.plain(actions),
    engine: undefined as WorkflowRuntimeStore['engine'],
  });
  return store$;
};

export const createWorkflowStoreFromDocument = (
  document: WorkflowDocumentData,
): Observable<WorkflowRuntimeStore> => {
  const store$ = loadWorkflowStoreFromDocument(document);
  const nodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
    ...builtinNodeTypes,
    ...commonNodeTypes,
    ...subflowNodeTypes,
    ...codeBuiltinNodeTypes,
    ...webglNodeTypes,
    ...llmNodeTypes,
    ...valueGateNodeTypes,
  };

  // populate node types
  store$.nodeTypes.set(nodeTypes);

  // populate all nodes with their type definitions
  for (const node of Object.values(store$.nodes.get())) {
    populateNodeType(store$.get(), node);
    loadNode({
      store$,
      nodeId: node.id,
    });
  }

  return store$;
};
