type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type WorkflowNodeTypeName = string & { __brand: "WorkflowNodeTypeName" };
type WorkflowValueType = string & { __brand: "WorkflowValueType" };
type WorkflowTimestamp = number & { __brand: "WorkflowTimestamp", __kind: `performance.now()` };

export type WorkflowDocumentData = {
    nodes: {
        id: string;
        type: WorkflowNodeTypeName;
        parentId?: string;
        position: {
            x: number;
            y: number,
            width: number;
            height: number;
        };
        inputs: {
            name: string;
            type: WorkflowValueType;
            source?: {
                nodeId: string;
                name: string;
            };
        }[];
        outputs: {
            name: string;
            type: WorkflowValueType;
        }[];
        data: JsonObject;
    }[];
};

export type ReactFlowStore = {
    nodeTypes: Record<WorkflowNodeTypeName, React.ComponentType>;
    nodes: {
        id: string;
        type: WorkflowNodeTypeName;
        position: { x: number; y: number };
        width: number;
        height: number;
        parentId?: string;
        extent?: 'parent',
        data: {
            node: WorkflowRuntimeNode;
        };
    }[];
    edges: {
        id: string;
        type: `custom`;
        source: string;
        sourceHandle: string;
        target: string;
        targetHandle: string;
        data: {
            edge: WorkflowRuntimeEdge;
        };
    }[];
};

export type WorkflowRuntimeNode = {
    id: string;
    type: WorkflowNodeTypeName;
    parentId?: string;
    position: {
        x: number;
        y: number,
        width: number;
        height: number;
        extent?: 'parent',
    };
    inputs: {
        name: string;
        type: WorkflowValueType;
        value?: WorkflowRuntimeValue;
        edge?: WorkflowRuntimeEdge;
    }[];
    outputs: {
        name: string;
        type: WorkflowValueType;
        value?: WorkflowRuntimeValue;
        edges?: WorkflowRuntimeEdge[];
    }[];
    data: JsonObject;
    mode?: `passthrough` | `disabled`;
    executionState?: WorkflowRuntimeExecutionState;
    graphErrorState?: {
        kind: `missing-type-definition`;
        message: string;
    };
};

export type WorkflowRuntimeEdge = {
    id: string;
    value: WorkflowRuntimeValue;
    source: {
        node: WorkflowRuntimeNode;
        outputName: string;
    };
    target: {
        node: WorkflowRuntimeNode;
        inputName: string;
    };
};

export type WorkflowRuntimeValue<T = unknown> = {
    /** valtio ref() */
    data: T;
    /** valtio ref() */
    meta: {
        type: WorkflowValueType;
        source: {
            nodeId: string;
            outputName: string;
            timestamp: WorkflowTimestamp;
        };
    };
};

/** This whole store is a valtio object, just change it directly */
export type WorkflowRuntimeStore = {
    nodeTypes: Record<WorkflowNodeTypeName, WorkflowRuntimeNodeTypeDefinition>;
    nodes: Record<string, WorkflowRuntimeNode>;
    edges: Record<string, WorkflowRuntimeEdge>;
    actions: WorkflowRuntimeStoreActions;
};

/** helpers to simplify some actions */
export type WorkflowRuntimeStoreActions = {
    createNodeType: (args: WorkflowRuntimeNodeTypeDefinition) => void;
    deleteNodeType: (nodeType: WorkflowNodeTypeName) => void;

    createNode: (node: {
        id: string;
        type: string;
        parentId?: string;
        position: {
            x: number;
            y: number,
            width: number;
            height: number;
        };
    }) => void;
    deleteNode: (nodeId: string) => void;

    createEdge: (edge: {
        source: {
            nodeId: string;
            outputName: string;
        };
        target: {
            nodeId: string;
            inputName: string;
        };
    }) => void;
    deleteEdge: (edgeId: string) => void;
};

export type WorkflowExecutionController = {
    abortSignal: AbortSignal;
    setProgress: (valueOrSetter: { progressRatio: number, message?: string } | ((prev: { progressRatio: number, message?: string }) => { progressRatio: number, message?: string })) => void;
};

export type WorkflowRuntimeNodeTypeDefinition = {
    type: WorkflowNodeTypeName,
    component: React.ComponentType,
    inputs: {
        name: string;
        type: WorkflowValueType;
    }[];
    outputs: {
        name: string;
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
    queueNode: (nodeId: string) => void;
};