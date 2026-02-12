import type {
  Observable,
  ObservablePrimitive,
  OpaqueObject,
  PlainObject,
} from '@legendapp/state';

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
  T: (strings: TemplateStringsArray) =>
    strings[0] as unknown as WorkflowNodeTypeName,
  valueType: (value: string) => value as unknown as WorkflowValueType,
  V: (strings: TemplateStringsArray) =>
    strings[0] as unknown as WorkflowValueType,
  inputName: (value: string) => value as unknown as WorkflowInputName,
  I: (strings: TemplateStringsArray) =>
    strings[0] as unknown as WorkflowInputName,
  outputName: (value: string) => value as unknown as WorkflowOutputName,
  O: (strings: TemplateStringsArray) =>
    strings[0] as unknown as WorkflowOutputName,

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

  now: () =>
    (performance.timeOrigin +
      performance.now()) as unknown as WorkflowTimestamp,
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
    data: WorkflowComponentPropsDataAccess<
      WorkflowJsonObject,
      unknown,
      unknown
    >;
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

export type WorkflowComponentPropsDataAccess<
  TData extends WorkflowJsonObject = WorkflowJsonObject,
  TInputs = TData,
  TOutputs = TData,
> = {
  node$: Observable<WorkflowRuntimeNode>;
  store$: Observable<WorkflowRuntimeStore>;
  // getValues: () => {
  //   inputs$: TInputs;
  //   outputs$: TOutputs;
  //   data$: Observable<undefined | null | Partial<TData>>;
  // };
  getStandardNodeDataProp: () => Pick<
    WorkflowComponentSimplePropsBase[`data`],
    `data` | `inputs` | `outputs`
  >;
  // inputs$: Observable<PartialNull<TInputs>>;
  // outputs$: Observable<PartialNull<TOutputs>>;
  // getData: () => Observable<undefined | null | Partial<TData>>;
};

export type WorkflowComponentPropsData_Obs<
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

export type WorkflowComponentPropsBase =
  WorkflowReactFlowStore['nodes'][number] & {
    selected: boolean;
    hideHandles?: boolean;
  };
export type WorkflowComponentPropsOnlyNode = Omit<
  WorkflowComponentPropsBase,
  'data'
> & {
  data: {
    store$: Observable<WorkflowRuntimeStore>;
    node$: Observable<WorkflowRuntimeNode>;
  };
};

export type WorkflowComponentProps<
  TData extends WorkflowJsonObject = WorkflowJsonObject,
  TInputs = TData,
  TOutputs = TData,
> = Omit<WorkflowComponentPropsBase, 'data'> & {
  data: WorkflowComponentPropsDataAccess<TData, TInputs, TOutputs>;
};

export type WorkflowComponentProps_Obs<
  TData extends WorkflowJsonObject = WorkflowJsonObject,
  TInputs = TData,
  TOutputs = TData,
> = Omit<WorkflowComponentPropsBase, 'data'> & {
  data: WorkflowComponentPropsData_Obs<TData, TInputs, TOutputs>;
};

export type WorkflowComponentPropsAny_Ops = Omit<
  WorkflowComponentPropsBase,
  'data'
> & {
  data: {
    node$: Observable<WorkflowRuntimeNode>;
    store$: Observable<WorkflowRuntimeStore>;
    // biome-ignore lint/suspicious/noExplicitAny: required for component type asserting
    inputs$: any;
    // biome-ignore lint/suspicious/noExplicitAny: required for component type asserting
    outputs$: any;
    // biome-ignore lint/suspicious/noExplicitAny: required for component type asserting
    data$: any;
  };
};

export type WorkflowComponentSimplePropsTyped<
  TData extends WorkflowJsonObject = WorkflowJsonObject,
  TInputs = TData,
  TOutputs = TData,
> = Omit<WorkflowComponentSimplePropsBase, 'data'> & {
  data: {
    node$: Observable<WorkflowRuntimeNode>;
    store$: Observable<WorkflowRuntimeStore>;
    inputs: {
      [K in keyof TInputs]: {
        asObservable: () => ObservablePrimitive<TInputs[K]>;
        getDirectValue: () => TInputs[K];
        setValue: (value: TInputs[K]) => void;
      };
    };
    outputs: {
      [K in keyof TOutputs]: {
        asObservable: () => ObservablePrimitive<TOutputs[K]>;
        getDirectValue: () => TOutputs[K];
        setValue: (value: TOutputs[K]) => void;
      };
    };
    data: {
      asObservable: () => Observable<TData>;
      getDirectValue: () => TData;
      setValue: (value: TData) => void;
    };
  };
};

export type WorkflowComponentSimplePropsBase = Omit<
  WorkflowComponentPropsBase,
  'data'
> & {
  data: {
    node$: Observable<WorkflowRuntimeNode>;
    store$: Observable<WorkflowRuntimeStore>;
    inputs: Record<
      string,
      {
        asObservable: <T>() => ObservablePrimitive<T>;
        getDirectValue: <T>() => T;
        setValue: <T>(value: T) => void;
      }
    >;
    outputs: Record<
      string,
      {
        asObservable: <T>() => ObservablePrimitive<T>;
        getDirectValue: <T>() => T;
        setValue: <T>(value: T) => void;
      }
    >;
    data: {
      asObservable: <T extends WorkflowJsonObject>() => Observable<T>;
      getDirectValue: <T extends WorkflowJsonObject>() => T;
      setValue: <T extends WorkflowJsonObject>(value: T) => void;
    };
  };
};

export interface WorkflowRuntimeNode {
  isDeleted?: boolean;

  id: WorkflowNodeId;
  newIdUntilReload?: WorkflowNodeId;
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
    value: OpaqueObject<WorkflowRuntimeValue>;
    edgeId?: WorkflowEdgeId;
    getEdge: () => undefined | WorkflowRuntimeEdge;
  }[];
  getInputInfo: <T>(inputName: string) => {
    data: T | undefined | null;
    isConnected: boolean;
  };

  outputs: {
    name: WorkflowOutputName;
    type: WorkflowValueType;
    value: OpaqueObject<WorkflowRuntimeValue>;
    edgeIds?: WorkflowEdgeId[];
    getEdges: () => WorkflowRuntimeEdge[];
  }[];
  getOutputInfo: <T>(outputName: string) => {
    data: T | undefined | null;
    isConnected: boolean;
  };

  data: OpaqueObject<WorkflowRuntimeValue<undefined | WorkflowJsonObject>>;
  runtimeState: OpaqueObject<WorkflowRuntimeValue<Record<string, unknown>>>;
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

  unloader: OpaqueObject<OpaqueObject<{ unload?: () => void }>>;
}

export type WorkflowRuntimeNodeInput = WorkflowRuntimeNode['inputs'][number];
export type WorkflowRuntimeNodeOutput = WorkflowRuntimeNode['outputs'][number];

export interface WorkflowRuntimeEdge {
  isDeleted?: boolean;

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
  value: OpaqueObject<WorkflowRuntimeValue>;
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

export type ReadonlyObservable<T> = Omit<
  Observable<T>,
  'set' | 'assign' | 'delete'
>;
/** null indicates the value was set to undefined or null, undefined means it is unset */
export type WorkflowRuntimeValue<TBase = unknown> = OpaqueObject<{
  getObservableBox: () => unknown;
  // box: undefined | null | TBase;
  // readonly uiValue$: ReadonlyObservable<undefined | null | TBase>;
  getUiValue: <T = TBase>() => undefined | null | T;
  getDirectValue: <T = TBase>() => undefined | null | T;
  setValue: <T = TBase>(v: null | T) => void;
  clearValue: (v?: undefined) => void;
  subscribeDirect: (
    callback: (v: null | TBase | undefined) => void,
  ) => () => void;
  readonly uiChangeCounter$: ReadonlyObservable<number>;
  getImmediateChangeCounter: () => number;
}>;
export interface WorkflowRuntimeStore {
  _instanceId: string;
  name: string;
  nodeTypes: Record<WorkflowNodeTypeName, WorkflowRuntimeNodeTypeDefinition>;
  nodes: Record<WorkflowNodeId, WorkflowRuntimeNode>;
  edges: Record<WorkflowEdgeId, WorkflowRuntimeEdge>;
  actions: PlainObject<WorkflowRuntimeStoreActions>;
  engine: undefined | WorkflowRuntimeEngine;
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

  updateInputs: (
    nodeId: WorkflowNodeId,
    inputs: { name: WorkflowInputName; type: WorkflowValueType }[],
  ) => void;
  updateOutputs: (
    nodeId: WorkflowNodeId,
    outputs: { name: WorkflowOutputName; type: WorkflowValueType }[],
  ) => void;
}

export interface WorkflowExecutionController {
  abortSignal: AbortSignal;
  setProgress: (value: { progressRatio: number; message?: string }) => void;
  registerEvent: <TOutput extends Record<string, unknown>>(
    event: (emit: (data: TOutput) => void) => { unsubscribe: () => void },
  ) => void;
}

export interface WorkflowRuntimeNodeTypeDefinition {
  type: WorkflowNodeTypeName;
  getComponent: () => {
    Component: React.ComponentType<WorkflowComponentProps>;
  };
  defaultSize?: { width: number; height: number };
  inputs: {
    name: WorkflowInputName;
    type: WorkflowValueType;
  }[];
  outputs: {
    name: WorkflowOutputName;
    type: WorkflowValueType;
  }[];
  /** load the node
   * use null to reset output value or the data object
   * undefined output keys will not be changed
   * undefined data will not update the node's data
   */
  load?: (args: WorkflowLoadArgs) => Promise<{ unsubscribe: () => void }>;

  /** execute the node's logic
   * use null to reset output value or the data object
   * undefined output keys will not be changed
   * undefined data will not update the node's data
   */
  execute: (args: WorkflowExecutionArgs) => Promise<WorkflowExecutionResult>;

  generateCode?: (args: {
    data: undefined | WorkflowJsonObject;
    inputNames: Record<WorkflowInputName, string>;
  }) =>
    | undefined
    | { kind: `none` }
    | {
        kind?: undefined | `expression` | `passthrough` | `value` | `void`;
        typescript: string;
      };

  // TODO: node lifecycle methods (to replace automatic population of inputs/outputs)
  // loadNodeType?: (store: WorkflowRuntimeStore) => void;
  // unloadNodeType?: (store: WorkflowRuntimeStore) => void;
}

export interface WorkflowLoadArgs {
  runtimeState: Record<string, unknown>;
  node$: Observable<WorkflowRuntimeNode>;
  store$: Observable<WorkflowRuntimeStore>;
  controller: {
    registerEvent: <TOutput extends Record<string, unknown>>(
      event: (emit: (data: TOutput) => void) => { unsubscribe: () => void },
    ) => { unsubscribe: () => void };
  };
}

export interface WorkflowExecutionArgs {
  inputs: Record<string, unknown>;
  data: undefined | WorkflowJsonObject;
  runtimeState: Record<string, unknown>;
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
    promiseInstance?: { promise: Promise<unknown> };
    promiseStartTime?: WorkflowTimestamp;
    promiseEndTime?: WorkflowTimestamp;
    startTimestamp?: WorkflowTimestamp;
    endTimestamp?: WorkflowTimestamp;
    asyncExecutionTime?: number;
    asyncMicrotaskLagTime?: number;
    progressRatio?: number;
    progressMessage?: string;
    errorMessage?: string;
  };

  /** Completed execution states */
  // history: {
  //   status: `success` | `error` | `aborted`;
  //   startTimestamp: WorkflowTimestamp;
  //   endTimestamp: WorkflowTimestamp;
  //   asyncExecutionTime?: number;
  //   asyncMicrotaskLagTime?: number;
  //   errorMessage?: string;
  // }[];
  stats: {
    runCount: number;
    successCount: number;
    errorCount: number;
    errorMessageCounts: Record<string, number>;
    abortedCount: number;
    totalExecutionTime: number;
    totalAsyncExecutionTime: number;
    totalAsyncMicrotaskLagTime: number;
    readonly averageExecutionTime: number;
    readonly averageAsyncExecutionTime: number;
    readonly averageAsyncMicrotaskLagTime: number;
  };
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
