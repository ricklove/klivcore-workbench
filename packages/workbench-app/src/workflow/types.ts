type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type WorkflowNodeTypeName = string & { __brand: 'WorkflowNodeTypeName' };
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

export type WorkflowDocumentData = {
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
    data: undefined | JsonObject;
    mode: undefined | `passthrough` | `disabled`;
  }[];
};

export type WorkflowReactFlowStore = {
  nodeTypes: Record<WorkflowNodeTypeName, React.ComponentType>;
  nodes: {
    id: WorkflowNodeId;
    type: WorkflowNodeTypeName;
    position: { x: number; y: number };
    width: number;
    height: number;
    selected: boolean;
    parentId: undefined | WorkflowNodeId;
    extent: undefined | 'parent';
    data: {
      node: WorkflowRuntimeNode;
      store: WorkflowRuntimeStore;
      inputs: WorkflowRuntimeNode['inputs'];
      outputs: WorkflowRuntimeNode['outputs'];
      data: WorkflowRuntimeNode['data'];
    };
  }[];
  edges: {
    id: WorkflowEdgeId;
    type: `custom`;
    source: WorkflowNodeId;
    sourceHandle: WorkflowOutputName;
    target: WorkflowNodeId;
    targetHandle: WorkflowInputName;
    selected: boolean;
    data: {
      edge: WorkflowRuntimeEdge;
      store: WorkflowRuntimeStore;
    };
  }[];
};

export type WorkflowComponentProps = WorkflowReactFlowStore['nodes'][number];

export type WorkflowRuntimeNode = {
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
  outputs: {
    name: WorkflowOutputName;
    type: WorkflowValueType;
    value: WorkflowRuntimeValue;
    edgeIds?: WorkflowEdgeId[];
    getEdges: () => WorkflowRuntimeEdge[];
  }[];
  data: WorkflowRuntimeValue<undefined | JsonObject>;
  selected?: boolean;
  mode?: `passthrough` | `disabled`;
  executionState?: WorkflowRuntimeExecutionState;
  getGraphErrors():
    | undefined
    | {
        kind: `missing-type-definition`;
      }[];
};

export type WorkflowRuntimeEdge = {
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
  selected?: boolean;
  getGraphErrors():
    | undefined
    | {
        kind:
          | `missing-source-node`
          | `missing-target-node`
          | `missing-source-output`
          | `missing-target-input`;
      }[];
};

export type WorkflowRuntimeValue<T = unknown> = {
  /** valtio ref() */
  get data(): T;
  set data(value: T);
  /** increment each time data changes, used for change tracking */
  dataChangeCounter: number;
  meta?: {
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
};

export type WorkflowExecutionController = {
  abortSignal: AbortSignal;
  setProgress: (value: { progressRatio: number; message?: string }) => void;
};

// type PlainObject<T> =
//   | (T & {
//       $$valtioSnapshot: T;
//     })
//   | OpaqueObject<T>;
export type WorkflowRuntimeNodeTypeDefinition = {
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
};

export type WorkflowExecutionArgs = {
  inputs: Record<string, unknown>;
  data: undefined | JsonObject;
  controller: WorkflowExecutionController;
  node: WorkflowRuntimeNode;
  store: WorkflowRuntimeStore;
};
export type WorkflowExecutionResult =
  | undefined
  | {
      outputs: Record<string, unknown>;
      data?: null | JsonObject;
    };

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
};

export type WorkflowRuntimeEngine = {
  running: boolean;
  /** get or set the engine tick speed */
  tickSpeed: number | `slow` | `normal` | `fast`;
  /** start running the nodes, based on the engines scheduling logic */
  start: () => void;
  /** stop running the nodes, optionally abort current node executions */
  stop: (args: { shouldAbort: boolean }) => void;
  /** manually trigger a node to execute */
  queueNode: (nodeId: WorkflowNodeId) => void;
};
