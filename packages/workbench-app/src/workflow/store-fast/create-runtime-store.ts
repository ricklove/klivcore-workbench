import {
  WorkflowBrandedTypes,
  type WorkflowDocumentData,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowRuntimeStore,
  type WorkflowRuntimeValue,
} from '../types';
import { builtinNodeTypes } from '../node-types';
import { observable, ObservableHint, type Observable } from '@legendapp/state';

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

      if (!missingSourceNode && !missingTargetNode && !missingSourceOutput && !missingTargetInput) {
        return undefined;
      }

      return [
        ...(missingSourceNode ? [{ kind: `missing-source-node` as const }] : []),
        ...(missingTargetNode ? [{ kind: `missing-target-node` as const }] : []),
        ...(missingSourceOutput ? [{ kind: `missing-source-output` as const }] : []),
        ...(missingTargetInput ? [{ kind: `missing-target-input` as const }] : []),
      ];
    },
  },
};

const createRuntimeValue = <T = Record<string, unknown>>({
  data,
  meta,
}: {
  data: T;
  meta?: WorkflowRuntimeValue['meta'];
}): WorkflowRuntimeValue<T> => {
  const box = ObservableHint.opaque({ data });
  const v = {
    dataChangeCounter: 0,
    get data() {
      return box.data;
    },
    set data(value: T) {
      box.data = value;
      this.dataChangeCounter++;
    },
    meta,
  };

  return v as WorkflowRuntimeValue<T>;
};

const loadWorkflowStoreFromDocument = (
  document: WorkflowDocumentData,
): Pick<WorkflowRuntimeStore, `nodes` | `edges` | `nodeTypes`> => {
  const storeObj: Pick<WorkflowRuntimeStore, `nodes` | `edges` | `nodeTypes`> = {
    nodeTypes: {},
    nodes: {},
    edges: {},
  };

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
      outputs: n.outputs.map((x) => ({
        name: x.name,
        type: x.type,
        value: createRuntimeValue({ data: undefined }),
        edgeIds: undefined,
        getEdges() {
          return getters.node.outputs.getEdges(storeObj, this);
        },
      })),
      data: createRuntimeValue({ data: n.data || {} }),
      mode: n.mode,
      getGraphErrors() {
        return getters.node.getGraphErrors(storeObj, this);
      },
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
      const targetNode = storeObj.nodes[n.id]!;
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
      }

      const sourceOutput = sourceNode?.outputs.find((o) => o.name === input.source!.name);
      if (sourceOutput) {
        sourceOutput.edgeIds = sourceOutput.edgeIds || [];
        sourceOutput.edgeIds.push(edge.id);
      }
    }
  }

  return storeObj;
};

const populateNodeType = (store: WorkflowRuntimeStore, node: WorkflowRuntimeNode) => {
  const typeDef = store.nodeTypes[node.type];
  if (!typeDef) {
    console.error(
      `[createWorkflowStoreFromDocument] Missing node type definition for type ${node.type}`,
    );
    return;
  }

  console.log(
    `Populating node ${node.id} of type ${node.type}`,
    // , { node, typeDef, store }
  );

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

export const createWorkflowStoreFromDocument = (
  document: WorkflowDocumentData,
): Observable<WorkflowRuntimeStore> => {
  const storeObj = loadWorkflowStoreFromDocument(document);
  const nodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
    ...builtinNodeTypes,
  };

  const store$: Observable<WorkflowRuntimeStore> = observable({
    ...storeObj,
    nodeTypes,
    actions: {
      createNodeType: (definition) => {
        store$.nodeTypes[definition.type]?.set(definition);
        // populate existing nodes of this type
        for (const node of Object.values(store$.nodes.get())) {
          if (node.type === definition.type) {
            populateNodeType(store$.get(), node);
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
          store$.nodes[nodeId]?.set({
            ...args,
            id: nodeId,
            inputs: [],
            outputs: [],
            data: createRuntimeValue({ data: {} }),
            getGraphErrors() {
              return getters.node.getGraphErrors(store$.get(), this as WorkflowRuntimeNode);
            },
          });
          return;
        }

        store$.nodes[nodeId]?.set({
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
          data: createRuntimeValue({ data: {} }),
          getGraphErrors() {
            return getters.node.getGraphErrors(store$.get(), this as WorkflowRuntimeNode);
          },
        });
      },
      deleteNode: (nodeId) => {
        store$.nodes[nodeId]?.delete();
      },
      renameNode: ({ oldId, newId }) => {
        const node = store$.nodes[oldId];
        if (!node) {
          console.warn(`[renameNode] Node with id ${oldId} does not exist`);
          return;
        }
        const newNodeId = WorkflowBrandedTypes.nodeId(newId);
        if (store$.nodes[newNodeId]) {
          console.warn(`[renameNode] Node with id ${newId} already exists`);
          return;
        }

        node.id.set(newNodeId);
        store$.nodes[newNodeId] = node;
        store$.nodes[oldId]?.delete();

        // update parents
        for (const n of Object.values(store$.nodes.get())) {
          if (n.parentId === oldId) {
            n.parentId = newNodeId;
          }
        }

        // update edges
        for (const edge of Object.values(store$.edges.get())) {
          if (edge.source.nodeId === oldId) {
            edge.source.nodeId = newNodeId;
          }
          if (edge.target.nodeId === oldId) {
            edge.target.nodeId = newNodeId;
          }
        }
      },
      createEdge: (args) => {
        const targetNode = store$.nodes[args.target.nodeId]?.get();
        const targetInput = targetNode?.inputs.find((i) => i.name === args.target.inputName);

        const sourceNode = store$.nodes[args.source.nodeId]?.get();
        const sourceOutput = sourceNode?.outputs.find((o) => o.name === args.source.outputName);

        if (!targetNode || !targetInput || !sourceNode || !sourceOutput) {
          console.warn(`[createEdge] Cannot create edge, missing source or target`, {
            args,
            targetNode,
            targetInput,
            sourceNode,
            sourceOutput,
          });
          return;
        }

        if (targetInput.edgeId) {
          // remove existing edge
          store$.edges[targetInput.edgeId]?.delete();
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
            return getters.edge.getGraphErrors(store$.get(), this as WorkflowRuntimeEdge);
          },
        });

        // update nodes
        if (targetInput) {
          targetInput.edgeId = edgeId;
        }

        if (sourceOutput) {
          sourceOutput.edgeIds = sourceOutput.edgeIds || [];
          sourceOutput.edgeIds.push(edgeId);
        }
      },
      deleteEdge: (edgeId) => {
        const edge = store$.edges[edgeId]?.get();
        if (!edge) {
          return;
        }
        store$.edges[edgeId]?.delete();

        // remove edge from nodes
        const targetNode = store$.nodes[edge.target.nodeId]?.get();
        const targetInput = targetNode?.inputs.find((i) => i.name === edge.target.inputName);

        const sourceNode = store$.nodes[edge.source.nodeId]?.get();
        const sourceOutput = sourceNode?.outputs.find((o) => o.name === edge.source.outputName);

        if (!targetNode || !targetInput || !sourceNode || !sourceOutput) {
          console.warn(`[createEdge] Cannot create edge, missing source or target`, {
            edge,
            targetNode,
            targetInput,
            sourceNode,
            sourceOutput,
          });
          return;
        }

        if (targetInput) {
          targetInput.edgeId = undefined;
        }

        if (sourceOutput) {
          sourceOutput.edgeIds = sourceOutput.edgeIds || [];
          sourceOutput.edgeIds.splice(sourceOutput.edgeIds.indexOf(edgeId), 1);
        }
      },
    },
  });

  // populate all nodes with their type definitions
  for (const node of Object.values(store$.nodes.get())) {
    populateNodeType(store$.get(), node);
  }

  return store$;
};
