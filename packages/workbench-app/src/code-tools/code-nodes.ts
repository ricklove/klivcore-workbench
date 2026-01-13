import { NodeTypeWrapComponent } from '../workflow/node-types-wrapper';
import { StringNodeComponent } from '../workflow/nodes';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../workflow/types';

export const codeBuiltinNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  compileTypescript: {
    type: WorkflowBrandedTypes.typeName(`compileTypescript`),
    getComponent: () => ({ Component: NodeTypeWrapComponent(StringNodeComponent) }),
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
    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      const tsCode = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({ progressRatio: 0.5, message: 'Compiling TypeScript...' });

      const { compileTypescript } = await import('./swc-tools.ts');
      const result = await compileTypescript(tsCode);

      controller.setProgress({ progressRatio: 1, message: 'Compiling TypeScript complete' });

      return {
        outputs: { value: result ?? null },
      };
    },
  },
};
