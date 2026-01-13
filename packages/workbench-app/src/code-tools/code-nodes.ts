import React from 'react';
import {
  NodeTypeWrapComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../workflow/node-types-wrapper';
import { StringNodeComponent } from '../workflow/nodes';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../workflow/types';
import { useValue } from '@legendapp/state/react';

export const codeBuiltinNodeTypes: Record<string, WorkflowRuntimeNodeTypeDefinition> = {
  toFunction: {
    type: WorkflowBrandedTypes.typeName(`toFunction`),
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

      const code = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({ progressRatio: 0.1, message: 'Creating function...' });
      const fun = new Function(`${code} return main();`);
      controller.setProgress({ progressRatio: 0.5, message: 'Function creation complete' });
      console.log('[toFunction] Created function:', fun);
      const funResult = await fun();
      controller.setProgress({ progressRatio: 1, message: 'Function execution complete' });

      return {
        outputs: { value: funResult ?? null },
      };
    },
  },
  toComponentTypeNode: {
    type: WorkflowBrandedTypes.typeName(`toComponentTypeNode`),
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
        type: WorkflowBrandedTypes.valueType(`ReactComponentType`),
      },
    ],
    execute: async ({ inputs, data, controller, store, node }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      const code = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({ progressRatio: 0.1, message: 'Creating Component function...' });
      const fun = new Function(`React`, `useValue`, `${code} return Component;`);
      controller.setProgress({ progressRatio: 0.5, message: 'Function creation complete' });
      console.log('[toFunction] Created function:', fun);

      const Component = await fun(React, useValue);
      console.log('[toFunction] Created Component:', Component);

      const typeName = WorkflowBrandedTypes.typeName(`d-:${node.id}`);
      store.actions.deleteNodeType(typeName);
      store.actions.createNodeType({
        type: typeName,
        getComponent: () => ({ Component: NodeTypeWrapComponentWithNodeWrapper(Component) }),
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
          const dataTyped = data as undefined | { value: undefined | string };

          return {
            outputs: { value: inputsTyped.value ?? dataTyped?.value ?? null },
          };
        },
      });

      controller.setProgress({ progressRatio: 1, message: 'Component creation complete' });

      return {
        outputs: { value: Component ?? null },
      };
    },
  },

  transformTypescript: {
    type: WorkflowBrandedTypes.typeName(`transformTypescript`),
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

      const { transformTypescript: compileTypescript } = await import('./swc-tools.ts');
      const result = await compileTypescript(tsCode);

      controller.setProgress({ progressRatio: 1, message: 'Compiling TypeScript complete' });

      return {
        outputs: { value: result ?? null },
      };
    },
  },
};
