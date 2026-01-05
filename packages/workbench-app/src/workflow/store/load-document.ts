import { WorkflowBrandedTypes, type WorkflowDocumentData, type WorkflowRuntimeEdge, type WorkflowRuntimeNode, type WorkflowRuntimeNodeTypeDefinition, type WorkflowRuntimeStore, } from "../types";
import { proxy, ref } from 'valtio';



const loadWorkflowStoreFromDocument = (document: WorkflowDocumentData): Pick<WorkflowRuntimeStore, `nodes` | `edges`> => {
    const storeObj: Pick<WorkflowRuntimeStore, `nodes` | `edges`> = {
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
            inputs: n.inputs.map(x => ({
                name: x.name,
                type: x.type,
            })),
            outputs: n.outputs.map(x => ({
                name: x.name,
                type: x.type,
            })),
            data: n.data || {},
            mode: n.mode,
        };
        storeObj.nodes[runtimeNode.id] = runtimeNode;
    }

    // create edges
    for (const n of document.nodes) {
        for (const input of n.inputs) {
            if (!input.source) { continue; }
            const edgeId = WorkflowBrandedTypes.edgeId(input.source.nodeId, input.source.name, n.id, input.name);
            const sourceNode = storeObj.nodes[input.source.nodeId];
            const targetNode = storeObj.nodes[n.id]!;
            const edge: WorkflowRuntimeEdge = {
                id: edgeId,
                source: sourceNode ? {
                    node: sourceNode,
                    outputName: input.source.name,
                } : {
                    error: `missing-source-node`,
                    nodeId: input.source.nodeId,
                    outputName: input.source.name,
                },
                target: {
                    node: targetNode,
                    inputName: input.name,
                },
            };
            storeObj.edges[edgeId] = edge;

            if (edge.source.error) {
                edge.graphErrors = edge.graphErrors || [];
                edge.graphErrors.push({ kind: `missing-source-node`, });
                console.error(`Edge ${edgeId} has missing source node ${input.source.nodeId}`);
            }

            // add edges to nodes
            const targetInput = targetNode.inputs.find(i => i.name === input.name);
            if (targetInput) {
                targetInput.edge = edge;
            } else {
                edge.graphErrors = edge.graphErrors || [];
                edge.graphErrors.push({ kind: `missing-target-input`, });
                console.error(`Edge ${edgeId} has missing target input ${input.name} on node ${n.id}`);
            }

            const sourceOutput = sourceNode?.outputs.find(o => o.name === input.source!.name);
            if (sourceOutput) {
                sourceOutput.edges = sourceOutput.edges || [];
                sourceOutput.edges.push(edge);
            } else {
                edge.graphErrors = edge.graphErrors || [];
                edge.graphErrors.push({ kind: `missing-source-output`, });
                console.error(`Edge ${edgeId} has missing source output ${input.source!.name} on node ${input.source!.nodeId}`);
            }
        }
    }

    return storeObj;
}

// type Subscribable<T> = {
//     subscribe: (callback: (data: T) => void) => { unsubscribe: () => void };
// };

// const persistStore = (store: WorkflowRuntimeStore): Subscribable<WorkflowDocumentData> => {

// }

export const createWorkflowStoreFromDocument = (document: WorkflowDocumentData): WorkflowRuntimeStore => {
    const storeObj = loadWorkflowStoreFromDocument(document);
    const nodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {};
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
                        graphErrors: [{
                            kind: `missing-type-definition`,
                        }],
                    };
                    return;
                }

                store.nodes[nodeId] = {
                    ...args,
                    id: nodeId,
                    inputs: nodeType.inputs.map(i => ({ name: i.name, type: i.type })),
                    outputs: nodeType.outputs.map(o => ({ name: o.name, type: o.type })),
                    data: {},
                };
            },
            deleteNode: (nodeId) => {
                delete store.nodes[nodeId];
            },
            createEdge: (args) => {
                const edgeId = WorkflowBrandedTypes.edgeId(args.source.nodeId, args.source.outputName, args.target.nodeId, args.target.inputName);
                store.edges[edgeId] = {
                    id: edgeId,
                    source: {
                        node: store.nodes[args.source.nodeId]!,
                        outputName: args.source.outputName,
                    },
                    target: {
                        node: store.nodes[args.target.nodeId]!,
                        inputName: args.target.inputName,
                    },
                };
            },
            deleteEdge: (edgeId) => {
                delete store.edges[edgeId];
            },
        }
    });

    // prevent cascading subscriptions
    for (const node of Object.values(store.nodes)) {
        for (const input of node.inputs) {
            if (!input.edge) { continue; }
            input.edge = ref(input.edge);
        }
        for (const output of node.outputs) {
            const edges = output.edges;
            if (!edges) { continue; }

            edges.forEach((e, index) => {
                if (!e) { return; }
                edges[index] = ref(e);
            });
        }
    }
    for (const edge of Object.values(store.edges)) {
        if (!edge.source.error && edge.source.node) {
            edge.source.node = ref(edge.source.node);
        }
        if (edge.target.node) {
            edge.target.node = ref(edge.target.node);
        }
    }

    return store;
}