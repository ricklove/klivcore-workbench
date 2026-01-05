import { WorkflowBrandedTypes, type WorkflowDocumentData } from "../types";

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
                    type: V`string`
                },
            ],
            data: {
                value: "test",
            },
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
                    type: V`string`
                },
            ],
            data: {
                value: "test2",
            },
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
                    type: V`string`
                },
            ],
            data: {
                value: "test2",
            },
        },
        {
            id: N`n3`,
            type: T`string`,
            position: { x: 200, y: -100, width: 100, height: 50 },
            inputs: [],
            outputs: [
                {
                    name: O`value`,
                    type: V`string`
                },
            ],
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
                        nodeId: N`n3`,
                        name: O`value`,
                    },
                },
            ],
            outputs: [],
        },
    ]
};