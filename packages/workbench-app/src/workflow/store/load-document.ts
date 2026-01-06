import {
  WorkflowBrandedTypes,
  type WorkflowDocumentData,
  type WorkflowRuntimeEdge,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowRuntimeStore,
} from '../types';
import { proxy } from 'valtio';
import { builtinNodeTypes } from './node-types';

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

const loadWorkflowStoreFromDocument = (
  document: WorkflowDocumentData,
): Pick<WorkflowRuntimeStore, `nodes` | `edges` | `nodeTypes`> => {
  const storeObj: Pick<WorkflowRuntimeStore, `nodes` | `edges` | `nodeTypes`> = proxy({
    nodeTypes: {},
    nodes: {},
    edges: {},
  });

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
        edgeId: undefined,
        getEdge() {
          return getters.node.inputs.getEdge(storeObj, this);
        },
      })),
      outputs: n.outputs.map((x) => ({
        name: x.name,
        type: x.type,
        edgeIds: undefined,
        getEdges() {
          return getters.node.outputs.getEdges(storeObj, this);
        },
      })),
      data: n.data || {},
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
      //   const sourceNode = storeObj.nodes[input.source.nodeId];
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
        getGraphErrors() {
          return getters.edge.getGraphErrors(storeObj, this);
        },
      };
      storeObj.edges[edgeId] = edge;

      //   // add edges to nodes
      //   const targetInput = targetNode.inputs.find((i) => i.name === input.name);
      //   if (targetInput) {
      //     targetInput.edge = edge;
      //   } else {
      //     edge.graphErrors = edge.graphErrors || [];
      //     edge.graphErrors.push({ kind: `missing-target-input` });
      //     console.error(`Edge ${edgeId} has missing target input ${input.name} on node ${n.id}`);
      //   }

      //   const sourceOutput = sourceNode?.outputs.find((o) => o.name === input.source!.name);
      //   if (sourceOutput) {
      //     sourceOutput.edges = sourceOutput.edges || [];
      //     sourceOutput.edges.push(edge);
      //   } else {
      //     edge.graphErrors = edge.graphErrors || [];
      //     edge.graphErrors.push({ kind: `missing-source-output` });
      //     console.error(
      //       `Edge ${edgeId} has missing source output ${input.source!.name} on node ${input.source!.nodeId}`,
      //     );
      //   }
    }
  }

  return storeObj;
};

// type Subscribable<T> = {
//     subscribe: (callback: (data: T) => void) => { unsubscribe: () => void };
// };

// const persistStore = (store: WorkflowRuntimeStore): Subscribable<WorkflowDocumentData> => {

// }

export const createWorkflowStoreFromDocument = (
  document: WorkflowDocumentData,
): WorkflowRuntimeStore => {
  const storeObj = loadWorkflowStoreFromDocument(document);
  const nodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
    ...builtinNodeTypes,
  };
  const store: WorkflowRuntimeStore = proxy({
    ...storeObj,
    nodeTypes,
    actions: {
      createNodeType: (definition) => {
        store.nodeTypes[definition.type] = definition;
      },
      deleteNodeType: (typeName: string) => {
        delete store.nodeTypes[WorkflowBrandedTypes.typeName(typeName)];
      },
      createNode: (args) => {
        const nodeId = WorkflowBrandedTypes.nodeId(args.id);
        const nodeType = store.nodeTypes[args.type];
        if (!nodeType) {
          store.nodes[nodeId] = {
            ...args,
            id: nodeId,
            inputs: [],
            outputs: [],
            data: {},
            getGraphErrors() {
              return getters.node.getGraphErrors(store, this);
            },
          };
          return;
        }

        store.nodes[nodeId] = {
          ...args,
          id: nodeId,
          inputs: nodeType.inputs.map((i) => ({
            name: i.name,
            type: i.type,
            edgeId: undefined,
            getEdge() {
              return getters.node.inputs.getEdge(store, this);
            },
          })),
          outputs: nodeType.outputs.map((o) => ({
            name: o.name,
            type: o.type,
            edgeIds: undefined,
            getEdges() {
              return getters.node.outputs.getEdges(store, this);
            },
          })),
          data: {},
          getGraphErrors() {
            return getters.node.getGraphErrors(store, this);
          },
        };
      },
      deleteNode: (nodeId) => {
        delete store.nodes[nodeId];
      },
      createEdge: (args) => {
        const edgeId = WorkflowBrandedTypes.edgeId(
          args.source.nodeId,
          args.source.outputName,
          args.target.nodeId,
          args.target.inputName,
        );
        store.edges[edgeId] = {
          id: edgeId,
          source: {
            nodeId: args.source.nodeId,
            outputName: args.source.outputName,
            getNode() {
              return getters.edge.source.getNode(store, this);
            },
          },
          target: {
            nodeId: args.target.nodeId,
            inputName: args.target.inputName,
            getNode() {
              return getters.edge.target.getNode(store, this);
            },
          },
          getGraphErrors() {
            return getters.edge.getGraphErrors(store, this);
          },
        };
      },
      deleteEdge: (edgeId) => {
        delete store.edges[edgeId];
      },
    },
  });

  return store;
};
