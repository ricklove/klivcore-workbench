import { NodeStandardContainer } from './node-types-wrapper';
import { WorkflowNodeDefault } from './node-wrapper';
import {
  JsonNodeComponent,
  RerouteComponent,
  StringNodeComponent,
} from './nodes';
import {
  WorkflowBrandedTypes,
  type WorkflowRuntimeNodeTypeDefinition,
} from './types';

export const builtinNodeTypes: Record<
  string,
  WorkflowRuntimeNodeTypeDefinition
> = {
  default: {
    type: WorkflowBrandedTypes.typeName(`default`),
    getComponent: () => ({
      Component: NodeStandardContainer(WorkflowNodeDefault),
    }),
    inputs: [],
    outputs: [],
    execute: async () => {
      throw new Error('Not implemented');
    },
  },
  reroute: {
    type: WorkflowBrandedTypes.typeName(`reroute`),
    getComponent: () => ({
      Component: NodeStandardContainer(RerouteComponent),
    }),
    defaultSize: { width: 16, height: 24 },
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`value`),
        type: WorkflowBrandedTypes.valueType(`T`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`value`),
        type: WorkflowBrandedTypes.valueType(`T`),
      },
    ],
    execute: async ({ inputs }) => {
      const inputsTyped = inputs as {
        value: undefined | unknown;
      };

      return {
        outputs: { value: inputsTyped.value },
      };
    },
  },
  string: {
    type: WorkflowBrandedTypes.typeName(`string`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`value`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`value`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    execute: async ({ inputs, data }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as
        | undefined
        | { value: undefined | string; overrideInput?: boolean };

      return {
        outputs: {
          value:
            (dataTyped?.overrideInput ? dataTyped?.value : undefined) ??
            inputsTyped.value ??
            dataTyped?.value ??
            null,
        },
      };
    },
  },
  json: {
    type: WorkflowBrandedTypes.typeName(`json`),
    getComponent: () => ({
      Component: NodeStandardContainer(JsonNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`value`),
        type: WorkflowBrandedTypes.valueType(
          `T extends Record<string, unknown>`,
        ),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`value`),
        type: WorkflowBrandedTypes.valueType(`T`),
      },
    ],
    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | unknown;
      };
      const dataTyped = data as undefined | { value: undefined | string };
      const dataFromJs = new Function(
        `return ${dataTyped?.value ?? 'undefined'}`,
      )();
      // const dataFromJson = JSON.parse(dataTyped?.value ?? ``);

      const obj = inputsTyped.value ?? dataFromJs ?? undefined;

      controller.setProgress({
        progressRatio: 0.1,
        message: 'Creating object...',
      });
      // const obj = JSON.parse(JSON.stringify(code));
      // const obj = JSON.parse(JSON.stringify(code));
      controller.setProgress({
        progressRatio: 1,
        message: 'Object creation complete',
      });

      return {
        outputs: { value: obj },
      };
    },
  },
};
