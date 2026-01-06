import { WorkflowBrandedTypes, type WorkflowDocumentData } from '../types';

const { T, V, I, O, N } = WorkflowBrandedTypes;

export const exampleWorkflowDocument: WorkflowDocumentData = {
  nodes: [
    {
      id: N`n1`,
      type: T`string`,
      position: { x: 0, y: 0, width: 100, height: 50 },
      inputs: [],
      outputs: [
        {
          name: O`value`,
          type: V`string`,
        },
      ],
      data: {
        value: 'test',
      },
      mode: undefined,
      parentId: undefined,
    },
    {
      id: N`n2`,
      type: T`string`,
      position: { x: 0, y: 100, width: 100, height: 50 },
      inputs: [
        {
          name: I`value`,
          type: V`string`,
          source: {
            nodeId: N`n1`,
            name: O`value`,
          },
        },
      ],
      outputs: [
        {
          name: O`value`,
          type: V`string`,
        },
      ],
      data: {
        value: 'test2',
      },
      mode: undefined,
      parentId: undefined,
    },
    {
      id: N`n3`,
      type: T`string`,
      position: { x: 0, y: 400, width: 100, height: 50 },
      inputs: [
        {
          name: I`value`,
          type: V`string`,
          source: {
            nodeId: N`n2`,
            name: O`value`,
          },
        },
      ],
      outputs: [
        {
          name: O`value`,
          type: V`string`,
        },
      ],
      data: {
        value: 'test3',
      },
      mode: undefined,
      parentId: undefined,
    },
    {
      id: N`n2b`,
      type: T`string`,
      position: { x: -200, y: 300, width: 100, height: 50 },
      inputs: [
        {
          name: I`value`,
          type: V`string`,
          source: {
            nodeId: N`n1`,
            name: O`value`,
          },
        },
      ],
      outputs: [
        {
          name: O`value`,
          type: V`string`,
        },
      ],
      data: {
        value: 'test also',
      },
      mode: undefined,
      parentId: undefined,
    },
    {
      id: N`nb`,
      type: T`string`,
      position: { x: 200, y: -100, width: 100, height: 50 },
      inputs: [],
      outputs: [
        {
          name: O`value`,
          type: V`string`,
        },
      ],
      data: {
        value: `../temp/temp-01.tsx`,
      },
      mode: undefined,
      parentId: undefined,
    },
    {
      id: N`temp1`,
      type: T`tempWrapper`,
      position: { x: 200, y: 0, width: 200, height: 200 },
      inputs: [
        {
          name: I`importPath`,
          type: V`string`,
          source: {
            nodeId: N`nb`,
            name: O`value`,
          },
        },
      ],
      outputs: [],
      data: undefined,
      mode: undefined,
      parentId: undefined,
    },
  ],
};
