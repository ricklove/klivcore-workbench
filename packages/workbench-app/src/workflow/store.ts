import type { NodeTypes } from "@xyflow/react";
import { NodeDefault } from "./node-wrapper";
import { TempWrapper } from "./node-temp-wrapper";
import { StringNodeComponent } from "./nodes";

// const initialNodes = [
//   { id: "n1", position: { x: 0, y: 0 }, data: { label: "Node 1" } },
//   { id: "n2", position: { x: 0, y: 100 }, data: { label: "Node 2" } },
// ];
// const initialEdges = [{ id: "n1-n2", source: "n1", target: "n2" }];

// TEMP
type WorkflowEdgeBase = {
  id: string;
  lastValue: unknown;
  source?: {
    nodeId: string;
    handleId: string;
  };
  hasSubscribers?: boolean;
};

export type ReactNodeDataBase = {
  typeName: string;
  refresh?: () => void;
  inputs: Record<string, WorkflowEdgeBase>;
  outputs: Record<string, WorkflowEdgeBase>;
}

type WorkflowEdgeOf<T> = {
  [K in keyof T]: WorkflowEdgeBase & { lastValue: T[K] };
}

export type ReactNodeData<TInput = unknown, TOutput = unknown> = {
  typeName: string;
  refresh?: () => void;
  inputs: WorkflowEdgeOf<TInput>;
  outputs: WorkflowEdgeOf<TOutput>;
}

export const reactNodeStore = {
  types: {} as NodeTypes,
  nodes: [] as {
    id: string;
    type: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    data: ReactNodeDataBase;
  }[],
  edges: [] as {
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }[],
};

reactNodeStore.types = {
  default: NodeDefault,
  string: StringNodeComponent,
  tempWrapper: TempWrapper,
};

reactNodeStore.nodes = [
  {
    id: "n1",
    type: `string`,
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    data: {
      typeName: `string`,
      inputs: {},
      outputs: {
        value: {
          id: "n1-a",
          lastValue: `test`,
          hasSubscribers: true,
        },
      }
    },
  },
  {
    id: "n2",
    type: `string`,
    position: { x: 0, y: 100 },
    width: 100,
    height: 50,
    data: {
      typeName: `string`,
      inputs: {
        value: {
          id: "n1-a",
          lastValue: `test`,
          source: {
            nodeId: "n1",
            handleId: "value",
          },
          hasSubscribers: true,
        },
      },
      outputs: {
        value: {
          id: "n2-a",
          lastValue: `test2`,
        }
      }
    },
  },
  {
    id: "n3",
    type: `string`,
    position: { x: 200, y: -100 },
    width: 100,
    height: 50,
    data: {
      typeName: `string`,
      inputs: {},
      outputs: {
        value: {
          id: "n3-value",
          lastValue: `../temp/temp-01.tsx`,
          hasSubscribers: true,
        }
      }
    },
  },
  {
    id: "temp1",
    type: `tempWrapper`,
    position: { x: 200, y: 0 }, width: 200, height: 200, data: {
      typeName: `tempWrapper`,
      inputs: {
        importPath: {
          id: "temp1-inp-1",
          lastValue: `../temp/temp-01.tsx`,
          source: {
            nodeId: "n3",
            handleId: "value",
          },
          hasSubscribers: true,
        }
      },
      outputs: {},
    }
  },
];

reactNodeStore.edges = [
  {
    id: "n1-n2",
    source: "n1",
    sourceHandle: "value",
    target: "n2",
    targetHandle: "value",
  },
  {
    id: "n3-temp1",
    source: "n3",
    sourceHandle: "value",
    target: "temp1",
    targetHandle: "importPath",
  }
];
