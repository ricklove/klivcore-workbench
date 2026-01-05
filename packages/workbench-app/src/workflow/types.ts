type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type WorkflowNodeTypeName = string & { __brand: "WorkflowNodeTypeName" };
type WorkflowValueType = string & { __brand: "WorkflowValueType" };

export type WorkflowDocumentData = {
    nodes: {
        id: string;
        type: WorkflowNodeTypeName;
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
    position: {
        x: number;
        y: number,
        width: number;
        height: number;
        parentId?: string;
        extent?: 'parent',
    };
    inputs: {
        name: string;
        type: WorkflowValueType;
        value?: unknown;
        edge?: WorkflowRuntimeEdge;
    }[];
    outputs: {
        name: string;
        type: WorkflowValueType;
        value?: unknown;
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
    value: unknown;
    source: {
        nodeId: string;
        outputName: string;
        node?: WorkflowRuntimeNode;
    };
    target: {
        nodeId: string;
        inputName: string;
        node?: WorkflowRuntimeNode;
    };
    graphErrorState?: {
        kind: `missing-node`;
        message: string;
    };
}

/** This whole store is a valtio object, just change it directly */
export type WorkflowRuntimeStore = {
    nodeTypes: Record<WorkflowNodeTypeName, WorkflowRuntimeNodeTypeDefinition>;
    nodes: Record<string, WorkflowRuntimeNode>;
    edges: Record<string, WorkflowRuntimeEdge>;
    actions: WorkflowRuntimeStoreActions;
};

/** helpers to simplify some actions */
export type WorkflowRuntimeStoreActions = {
    registerNodeType: (args: WorkflowRuntimeNodeTypeDefinition) => void;
    createNode: (node: {
        id: string;
        type: string;
        position: {
            x: number;
            y: number,
            width: number;
            height: number;
        };
    }) => void;
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
    deleteNode: (nodeId: string) => void;
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
    startTimestamp?: number;
    endTimestamp?: number;
    progressRatio?: number;
    progressMessage?: string;
    errorMessage?: string;

    /** Completed execution states */
    history: {
        status: `success` | `error` | `aborted`;
        startTimestamp: number;
        endTimestamp: number;
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