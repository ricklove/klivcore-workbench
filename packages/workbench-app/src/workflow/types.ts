type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type WorkflowNodeTypeName = string & { __brand: "WorkflowNodeTypeName" };
type WorkflowValueType = string & { __brand: "WorkflowValueType" };
type WorkflowTimestamp = number & { __brand: "WorkflowTimestamp", __kind: `performance.timeOrigin+performance.now()` };

type WorkflowNodeId = string & { __brand: "WorkflowNodeId" };
type WorkflowEdgeId = string & { __brand: "WorkflowEdgeId" };
type WorkflowOutputName = string & { __brand: "WorkflowOutputName" };
type WorkflowInputName = string & { __brand: "WorkflowInputName" };

export const WorkflowBrandedTypes = {
    typeName: (value: string) => value as unknown as WorkflowNodeTypeName,
    T: (strings: TemplateStringsArray) => strings[0] as unknown as WorkflowNodeTypeName,
    valueType: (value: string) => value as unknown as WorkflowValueType,
    V: (strings: TemplateStringsArray) => strings[0] as unknown as WorkflowValueType,
    inputName: (value: string) => value as unknown as WorkflowInputName,
    I: (strings: TemplateStringsArray) => strings[0] as unknown as WorkflowInputName,
    outputName: (value: string) => value as unknown as WorkflowOutputName,
    O: (strings: TemplateStringsArray) => strings[0] as unknown as WorkflowOutputName,
    nodeId: (value: string) => value as unknown as WorkflowNodeId,
    N: (strings: TemplateStringsArray) => strings[0] as unknown as WorkflowNodeId,
    edgeId: (sourceNodeId: string, sourceOutputName: string, targetNodeId: string, targetInputName: string): WorkflowEdgeId => {
        return `e-${sourceNodeId}-${sourceOutputName}-to-${targetNodeId}-${targetInputName}` as unknown as WorkflowEdgeId;
    },

    now: () => performance.timeOrigin + performance.now() as unknown as WorkflowTimestamp,

};

export type WorkflowDocumentData = {
    nodes: {
        id: WorkflowNodeId;
        type: WorkflowNodeTypeName;
        parentId?: WorkflowNodeId;
        position: {
            x: number;
            y: number,
            width: number;
            height: number;
        };
        inputs: {
            name: WorkflowInputName;
            type: WorkflowValueType;
            source?: {
                nodeId: WorkflowNodeId;
                name: WorkflowOutputName;
            };
        }[];
        outputs: {
            name: WorkflowOutputName;
            type: WorkflowValueType;
        }[];
        data?: JsonObject;
        mode?: `passthrough` | `disabled`;
    }[];
};

export type ReactFlowStore = {
    nodeTypes: Record<WorkflowNodeTypeName, React.ComponentType>;
    nodes: {
        id: WorkflowNodeId;
        type: WorkflowNodeTypeName;
        position: { x: number; y: number };
        width: number;
        height: number;
        parentId?: WorkflowNodeId;
        extent?: 'parent',
        data: {
            node: WorkflowRuntimeNode;
        };
    }[];
    edges: {
        id: WorkflowEdgeId;
        type: `custom`;
        source: WorkflowNodeId;
        sourceHandle: WorkflowOutputName;
        target: WorkflowNodeId;
        targetHandle: WorkflowInputName;
        data: {
            edge: WorkflowRuntimeEdge;
        };
    }[];
};

export type WorkflowRuntimeNode = {
    id: WorkflowNodeId;
    type: WorkflowNodeTypeName;
    parentId?: WorkflowNodeId;
    position: {
        x: number;
        y: number,
        width: number;
        height: number;
        extent?: 'parent',
    };
    inputs: {
        name: WorkflowInputName;
        type: WorkflowValueType;
        value?: WorkflowRuntimeValue;
        edge?: WorkflowRuntimeEdge;
    }[];
    outputs: {
        name: WorkflowOutputName;
        type: WorkflowValueType;
        value?: WorkflowRuntimeValue;
        edges?: WorkflowRuntimeEdge[];
    }[];
    data: JsonObject;
    mode?: `passthrough` | `disabled`;
    executionState?: WorkflowRuntimeExecutionState;
    graphErrors?: {
        kind: `missing-type-definition`;
    }[];
};

export type WorkflowRuntimeEdge = {
    id: WorkflowEdgeId;
    value?: WorkflowRuntimeValue;
    source: {
        node: WorkflowRuntimeNode;
        outputName: WorkflowOutputName;
        error?: undefined;
    } | {
        nodeId: WorkflowNodeId;
        outputName: WorkflowOutputName;
        error: `missing-source-node`;
    };
    target: {
        node: WorkflowRuntimeNode;
        inputName: WorkflowInputName;
    };
    graphErrors?: {
        kind: `missing-source-node` | `missing-source-output` | `missing-target-input`;
    }[];
};

export type WorkflowRuntimeValue<T = unknown> = {
    /** valtio ref() */
    data: T;
    /** valtio ref() */
    meta: {
        type: WorkflowValueType;
        source: {
            nodeId: WorkflowNodeId;
            outputName: WorkflowOutputName;
            timestamp: WorkflowTimestamp;
        };
    };
};

/** This whole store is a valtio object, just change it directly */
export type WorkflowRuntimeStore = {
    nodeTypes: Record<WorkflowNodeTypeName, WorkflowRuntimeNodeTypeDefinition>;
    nodes: Record<WorkflowNodeId, WorkflowRuntimeNode>;
    edges: Record<WorkflowEdgeId, WorkflowRuntimeEdge>;
    actions: WorkflowRuntimeStoreActions;
};

/** helpers to simplify some actions */
export type WorkflowRuntimeStoreActions = {
    createNodeType: (args: WorkflowRuntimeNodeTypeDefinition) => void;
    deleteNodeType: (nodeType: WorkflowNodeTypeName) => void;

    createNode: (node: {
        id: string;
        type: WorkflowNodeTypeName;
        parentId?: WorkflowNodeId;
        position: {
            x: number;
            y: number,
            width: number;
            height: number;
        };
    }) => void;
    deleteNode: (nodeId: WorkflowNodeId) => void;

    createEdge: (edge: {
        source: {
            nodeId: WorkflowNodeId;
            outputName: WorkflowOutputName;
        };
        target: {
            nodeId: WorkflowNodeId;
            inputName: WorkflowInputName;
        };
    }) => void;
    deleteEdge: (edgeId: WorkflowEdgeId) => void;
};

export type WorkflowExecutionController = {
    abortSignal: AbortSignal;
    setProgress: (valueOrSetter: { progressRatio: number, message?: string } | ((prev: { progressRatio: number, message?: string }) => { progressRatio: number, message?: string })) => void;
};

export type WorkflowRuntimeNodeTypeDefinition = {
    type: WorkflowNodeTypeName,
    component: React.ComponentType,
    inputs: {
        name: WorkflowInputName;
        type: WorkflowValueType;
    }[];
    outputs: {
        name: WorkflowOutputName;
        type: WorkflowValueType;
    }[];
    execute: (args: {
        inputs: Record<string, unknown>,
        data: JsonObject,
        controller: WorkflowExecutionController,
        node: WorkflowRuntimeNode,
        store: WorkflowRuntimeStore,
    }) => Promise<{ outputs: Record<string, unknown>, data?: JsonObject }>;
}

export type WorkflowRuntimeExecutionState = {
    status: `initial` | `running` | `success` | `error` | `aborted`;
    startTimestamp?: WorkflowTimestamp;
    endTimestamp?: WorkflowTimestamp;
    progressRatio?: number;
    progressMessage?: string;
    errorMessage?: string;

    /** Completed execution states */
    history: {
        status: `success` | `error` | `aborted`;
        startTimestamp: WorkflowTimestamp;
        endTimestamp: WorkflowTimestamp;
        errorMessage?: string;
    }[];
}

export type WorkflowRuntimeEngine = {
    setup: (store: WorkflowRuntimeStore) => void;
    /** start running the nodes, based on the engines scheduling logic */
    start: () => void;
    /** stop running the nodes, optionally abort current node executions */
    stop: (args: { shouldAbort: boolean }) => void;
    /** manually trigger a node to execute */
    queueNode: (nodeId: WorkflowNodeId) => void;
};