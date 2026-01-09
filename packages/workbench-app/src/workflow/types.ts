import { type Observable, type PlainObject } from '@legendapp/state';

// type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
// type JsonArray = JsonValue[];
// interface JsonObject {
//   [key: string]: JsonValue;

// }
export type WorkflowJsonObject = Record<
  string,
  string | number | boolean | null | Record<string, unknown> | Array<unknown>
>;

export type WorkflowNodeTypeName = string & { __brand: 'WorkflowNodeTypeName' };
type WorkflowValueType = string & { __brand: 'WorkflowValueType' };
type WorkflowTimestamp = number & {
  __brand: 'WorkflowTimestamp';
  __kind: `performance.timeOrigin+performance.now()`;
};

// TODO: make these objects so they can be renamed
export type WorkflowNodeId = string & { __brand: 'WorkflowNodeId' };
export type WorkflowEdgeId = string & { __brand: 'WorkflowEdgeId' };
export type WorkflowOutputName = string & { __brand: 'WorkflowOutputName' };
export type WorkflowInputName = string & { __brand: 'WorkflowInputName' };

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
  nodeIdToString: (id: WorkflowNodeId) => id as unknown as string,

  edgeIdFormString: (value: string) => value as unknown as WorkflowEdgeId,
  edgeId: (
    sourceNodeId: string,
    sourceOutputName: string,
    targetNodeId: string,
    targetInputName: string,
  ): WorkflowEdgeId => {
    return `${sourceNodeId}:${sourceOutputName}=>${targetNodeId}:${targetInputName}` as unknown as WorkflowEdgeId;
  },

  now: () => (performance.timeOrigin + performance.now()) as unknown as WorkflowTimestamp,
};

export interface WorkflowDocumentData {
  nodes: {
    id: WorkflowNodeId;
    type: WorkflowNodeTypeName;
    parentId: undefined | WorkflowNodeId;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    inputs: {
      name: WorkflowInputName;
      type: WorkflowValueType;
      source:
        | undefined
        | {
            nodeId: WorkflowNodeId;
            name: WorkflowOutputName;
          };
    }[];
    outputs: {
      name: WorkflowOutputName;
      type: WorkflowValueType;
    }[];
    data: undefined | WorkflowJsonObject;
    mode: undefined | `passthrough` | `disabled`;
  }[];
}

export interface WorkflowReactFlowStore {
  nodeTypes: Record<WorkflowNodeTypeName, React.ComponentType>;
  nodes: {
    id: WorkflowNodeId;
    type: WorkflowNodeTypeName;
    position: { x: number; y: number };
    width: number;
    height: number;
    parentId: undefined | WorkflowNodeId;
    extent: undefined | 'parent';
    data: WorkflowComponentPropsData<WorkflowJsonObject, unknown, unknown>;
  }[];
  edges: {
    id: WorkflowEdgeId;
    type: `custom`;
    source: WorkflowNodeId;
    sourceHandle: WorkflowOutputName;
    target: WorkflowNodeId;
    targetHandle: WorkflowInputName;
    data: {
      edge$: Observable<WorkflowRuntimeEdge>;
      store$: Observable<WorkflowRuntimeStore>;
    };
  }[];
}

export type WorkflowComponentPropsData<
  TData extends WorkflowJsonObject = WorkflowJsonObject,
  TInputs = TData,
  TOutputs = TData,
> = {
  node$: Observable<WorkflowRuntimeNode>;
  store$: Observable<WorkflowRuntimeStore>;
  inputs$: Observable<PartialNull<TInputs>>;
  outputs$: Observable<PartialNull<TOutputs>>;
  data$: Observable<undefined | null | Partial<TData>>;
};

type PartialNull<T> = {
  [P in keyof T]?: T[P] | null;
};

export type WorkflowComponentPropsBase = WorkflowReactFlowStore['nodes'][number] & {
  selected: boolean;
};
export type WorkflowComponentProps<
  TData extends WorkflowJsonObject = WorkflowJsonObject,
  TInputs = TData,
  TOutputs = TData,
> = Omit<WorkflowComponentPropsBase, 'data'> & {
  data: WorkflowComponentPropsData<TData, TInputs, TOutputs>;
};

export type WorkflowComponentPropsAny = Omit<WorkflowComponentPropsBase, 'data'> & {
  data: {
    node$: Observable<WorkflowRuntimeNode>;
    store$: Observable<WorkflowRuntimeStore>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputs$: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputs$: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data$: any;
  };
};

// type WorkflowRuntimeNodeInputsTyped<T extends Record<string, unknown>> = {
//     name: WorkflowInputName;
//     type: WorkflowValueType;
//     value: WorkflowRuntimeValue<T[keyof T]>;
//     edgeId?: WorkflowEdgeId;
//     getEdge: () => undefined | WorkflowRuntimeEdge;
// }

export interface WorkflowRuntimeNode {
  id: WorkflowNodeId;
  type: WorkflowNodeTypeName;
  parentId?: WorkflowNodeId;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    extent?: 'parent';
  };

  inputs: {
    name: WorkflowInputName;
    type: WorkflowValueType;
    value: WorkflowRuntimeValue;
    edgeId?: WorkflowEdgeId;
    getEdge: () => undefined | WorkflowRuntimeEdge;
  }[];
  getInputInfo: <T>(inputName: string) => { data: T | undefined | null; isConnected: boolean };

  outputs: {
    name: WorkflowOutputName;
    type: WorkflowValueType;
    value: WorkflowRuntimeValue;
    edgeIds?: WorkflowEdgeId[];
    getEdges: () => WorkflowRuntimeEdge[];
  }[];
  getOutputInfo: <T>(outputName: string) => {
    data: T | undefined | null;
    isConnected: boolean;
  };

  data: WorkflowRuntimeValue<undefined | WorkflowJsonObject>;
  getData: <T extends WorkflowJsonObject>(
    _fake: undefined,
  ) => {
    data: T | undefined | null;
  };

  mode?: `passthrough` | `disabled`;
  executionState?: WorkflowRuntimeExecutionState;
  getGraphErrors():
    | undefined
    | {
        kind: `missing-type-definition`;
      }[];
}

export type WorkflowRuntimeNodeInput = WorkflowRuntimeNode['inputs'][number];
export type WorkflowRuntimeNodeOutput = WorkflowRuntimeNode['outputs'][number];

export interface WorkflowRuntimeEdge {
  id: WorkflowEdgeId;
  source: {
    nodeId: WorkflowNodeId;
    getNode: () => undefined | WorkflowRuntimeNode;
    outputName: WorkflowOutputName;
  };
  target: {
    nodeId: WorkflowNodeId;
    getNode: () => undefined | WorkflowRuntimeNode;
    inputName: WorkflowInputName;
  };
  value: WorkflowRuntimeValue;
  getGraphErrors():
    | undefined
    | {
        kind:
          | `missing-source-node`
          | `missing-target-node`
          | `missing-source-output`
          | `missing-target-input`;
      }[];
}

/** null indicates the value was set to undefined or null, undefined means it is unset */
export type WorkflowRuntimeValue<TBase = unknown> = PlainObject<{
  box$: undefined | null | TBase;
  getValue: <T = TBase>() => undefined | null | T;
  setValue: <T = TBase>(v: null | T) => void;
  clearValue: (v?: undefined) => void;
  readonly dataChangeCounter: number;
}>;
export interface WorkflowRuntimeStore {
  nodeTypes: Record<WorkflowNodeTypeName, WorkflowRuntimeNodeTypeDefinition>;
  nodes: Record<WorkflowNodeId, WorkflowRuntimeNode>;
  edges: Record<WorkflowEdgeId, WorkflowRuntimeEdge>;
  actions: WorkflowRuntimeStoreActions;
}

/** helpers to simplify some actions */
export interface WorkflowRuntimeStoreActions {
  createNodeType: (args: WorkflowRuntimeNodeTypeDefinition) => void;
  deleteNodeType: (nodeType: WorkflowNodeTypeName) => void;

  createNode: (node: {
    id: string;
    type: WorkflowNodeTypeName;
    parentId?: WorkflowNodeId;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }) => void;
  deleteNode: (nodeId: WorkflowNodeId) => void;
  renameNode: (args: { oldId: WorkflowNodeId; newId: string }) => void;

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
}

export interface WorkflowExecutionController {
  abortSignal: AbortSignal;
  setProgress: (value: { progressRatio: number; message?: string }) => void;
}

export interface WorkflowRuntimeNodeTypeDefinition {
  type: WorkflowNodeTypeName;
  getComponent: () => { Component: React.ComponentType<WorkflowComponentProps> };
  inputs: {
    name: WorkflowInputName;
    type: WorkflowValueType;
  }[];
  outputs: {
    name: WorkflowOutputName;
    type: WorkflowValueType;
  }[];
  /** execute the node's logic
   * use null to reset output value or the data object
   * undefined output keys will not be changed
   * undefined data will not update the node's data
   */
  execute: (args: WorkflowExecutionArgs) => Promise<WorkflowExecutionResult>;

  // TODO: node lifecycle methods (to replace automatic population of inputs/outputs)
  // loadNodeType?: (store: WorkflowRuntimeStore) => void;
  // unloadNodeType?: (store: WorkflowRuntimeStore) => void;
}

export interface WorkflowExecutionArgs {
  inputs: Record<string, unknown>;
  data: undefined | WorkflowJsonObject;
  controller: WorkflowExecutionController;
  node: WorkflowRuntimeNode;
  store: WorkflowRuntimeStore;
}
export type WorkflowExecutionResult =
  | undefined
  | {
      outputs: Record<string, unknown>;
      data?: null | WorkflowJsonObject;
    };

export interface WorkflowRuntimeExecutionState {
  status: `initial` | `running` | `success` | `error` | `aborted`;
  runState: {
    startTimestamp?: WorkflowTimestamp;
    endTimestamp?: WorkflowTimestamp;
    progressRatio?: number;
    progressMessage?: string;
    errorMessage?: string;
  };

  /** Completed execution states */
  history: {
    status: `success` | `error` | `aborted`;
    startTimestamp: WorkflowTimestamp;
    endTimestamp: WorkflowTimestamp;
    errorMessage?: string;
  }[];
}

export interface WorkflowRuntimeEngine {
  running: boolean;
  /** get or set the engine tick speed */
  tickSpeed: number | `slow` | `normal` | `fast`;
  /** start running the nodes, based on the engines scheduling logic */
  start: () => void;
  /** stop running the nodes, optionally abort current node executions */
  stop: (args: { shouldAbort: boolean }) => void;
  /** manually trigger a node to execute */
  queueNode: (nodeId: WorkflowNodeId) => void;
}
