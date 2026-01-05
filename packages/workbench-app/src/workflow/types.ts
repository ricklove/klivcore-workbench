import type { NodeTypes } from "@xyflow/react";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type WorkflowValueType = string & { __brand: "WorkflowValueType" };

export type WorkflowDocumentData = {
    nodes: {
        id: string;
        type: string;
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
    types: NodeTypes;
    nodes: {
        id: string;
        type: string;
        position: { x: number; y: number };
        width: number;
        height: number;
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

export type WorkflowComponentSimpleProps<TInputs extends Record<string, unknown> = Record<string, never>, TOutputs extends Record<string, unknown> = Record<string, never>, TData extends undefined | JsonObject = undefined> = {
    store: WorkflowRuntimeStore;
    node: WorkflowRuntimeNode;
    inputs: TInputs;
    // onInputsChange: (newInputs: Partial<TInputs>) => void;
    data: TData;
    onDataChange: (newData: Partial<TData>) => void;
    outputs: TOutputs;
    onOutputsChange: (newOutputs: Partial<TOutputs>) => void;
};

// export type WorkflowComponentValtioProps<TInputs extends Record<string, unknown> = Record<string, never>, TOutputs extends Record<string, unknown> = Record<string, never>, TData extends undefined | JsonObject = undefined> = {
//     /** Uses valtio, so can write to any value and mutate it directly, useSnapshot to get precise re-rendering of deeply nested data */
//     state: {
//         inputs: TInputs;
//         data: TData;
//         outputs: TOutputs;
//     };
// };

export type WorkflowRuntimeNode = {
    id: string;
    type: string;
    position: {
        x: number;
        y: number,
        width: number;
        height: number;
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
    /** Lazy getters to allow getting various styles of props */
    props: {
        subscribeSimpleProps<TInputs extends Record<string, unknown>, TOutputs extends Record<string, unknown>, TData extends undefined | JsonObject = undefined>(callback: (props: WorkflowComponentSimpleProps<TInputs, TOutputs, TData>) => void): void;
        // getValtioProps<TInputs extends Record<string, unknown>, TOutputs extends Record<string, unknown>, TData extends undefined | JsonObject = undefined>(): WorkflowComponentValtioProps<TInputs, TOutputs, TData>;
    };
    actions: {
        updatePosition: (newPosition: { x: number; y: number, width: number, height: number }) => void;
        updateInputs: (newInputs: Partial<WorkflowRuntimeNode[`inputs`]>) => void;
        updateOutputs: (newOutputs: Partial<WorkflowRuntimeNode[`outputs`]>) => void;
        updateData: (newData: undefined | Partial<JsonObject>) => void;
        // refresh: () => void;
        delete: () => void;
        addInput: (args: { name: string, type: WorkflowValueType }) => void;
        addOutput: (args: { name: string, type: WorkflowValueType }) => void;
        addInputEdge: (args: {
            name: string,
            source: {
                nodeId: string;
                name: string;
            };
        }) => void;
    };
};

export type WorkflowRuntimeEdge = {
    id: string;
    type: string;
    value: unknown;
    source: {
        node: WorkflowRuntimeNode;
        outputName: string;
    };
    target: {
        node: WorkflowRuntimeNode;
        inputName: string;
    };
    actions: {
        delete: () => void;
    };
}

export type WorkflowRuntimeStore = {
    nodes: WorkflowRuntimeNode[];
    edges: WorkflowRuntimeEdge[];
    actions: {
        addNode: (args: WorkflowDocumentData[`nodes`][number]) => WorkflowRuntimeNode;
    };
};