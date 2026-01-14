import React from 'react';
import {
  NodeTypeWrapComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../workflow/node-types-wrapper';
import { StringNodeComponent } from '../workflow/nodes';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../workflow/types';
import { useValue } from '@legendapp/state/react';
import { ComponentSwapper } from './component-swapper.tsx';
import { observable, type Observable } from '@legendapp/state';
// import { observable } from '@legendapp/state';

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
      const fun = new Function(`${code}; return main();`);
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
    execute: async ({ inputs, data, controller, store, node, runtimeState }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };
      const runtimeStateTyped = runtimeState as {
        holder$: undefined | Observable<{ Component: React.ComponentType; instanceId: string }>;
      };

      const code = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({ progressRatio: 0.1, message: 'Creating Component function...' });
      const fun = new Function(`React`, `useValue`, `${code} return Component;`);
      controller.setProgress({ progressRatio: 0.5, message: 'Function creation complete' });
      console.log('[toFunction] Created function:', fun);

      const Component = (await fun(React, useValue)) as React.ComponentType;
      console.log('[toFunction] Created Component:', Component);

      const typeName = WorkflowBrandedTypes.typeName(`d:${node.id}`);
      const holder$ = (runtimeStateTyped.holder$ ??= observable({
        Component,
        instanceId: `${Date.now()}-${Math.random()}`,
      }));
      holder$.Component.set(Component);
      holder$.instanceId.set(`${Date.now()}-${Math.random()}`);

      if (!store.nodeTypes[typeName]) {
        store.actions.deleteNodeType(typeName);
        store.actions.createNodeType({
          type: typeName,
          getComponent: () => ({
            Component: NodeTypeWrapComponentWithNodeWrapper(ComponentSwapper(holder$)),
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
            const dataTyped = data as undefined | { value: undefined | string };

            return {
              outputs: { value: inputsTyped.value ?? dataTyped?.value ?? null },
            };
          },
        });
      }

      controller.setProgress({ progressRatio: 1, message: 'Component creation complete' });

      return {
        outputs: { value: Component ?? null },
      };
    },
  },
  detectMissingClasses: {
    type: WorkflowBrandedTypes.typeName(`detectMissingClasses`),
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

      controller.setProgress({ progressRatio: 0.5, message: 'Detecting missing classes...' });

      const { detectMissingClassesInCode } = await import('./detect-missing-classes.ts');
      const result = detectMissingClassesInCode(tsCode);

      controller.setProgress({ progressRatio: 1, message: 'Detecting missing classes complete' });

      return {
        outputs: { value: result ?? null },
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
