import { type Observable, observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import React from 'react';
import { StringInputComponent } from '../nodes/common/string-input-node';
import { NodeStandardContainer } from '../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../workflow/types';
import { ComponentSwapper } from './component-swapper.tsx';
// import { observable } from '@legendapp/state';

export const codeBuiltinNodeTypes: Record<
  string,
  WorkflowRuntimeNodeTypeDefinition
> = {
  toFunction: {
    type: WorkflowBrandedTypes.typeName(`toFunction`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringInputComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`value`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`x`),
        type: WorkflowBrandedTypes.valueType(`unknown`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`y`),
        type: WorkflowBrandedTypes.valueType(`unknown`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`z`),
        type: WorkflowBrandedTypes.valueType(`unknown`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`value`),
        type: WorkflowBrandedTypes.valueType(`string`),
      },
    ],
    execute: async ({ inputs, data, runtimeState, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
        x: unknown;
        y: unknown;
        z: unknown;
      };
      const dataTyped = data as undefined | { value: undefined };

      const rs = runtimeState as {
        fun?: (...args: unknown[]) => unknown;
        formattedCode?: string;
      };

      const code = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({
        progressRatio: 0.1,
        message: 'Creating function...',
      });

      const argNames = [`x`, `y`, `z`];

      const codeLines = code
        .split(`\n`)
        .map((line) => line.trim())
        .filter((line) => !!line);
      const formattedCode = code.startsWith(`return`)
        ? code
        : code.startsWith(`const `)
          ? `${code}; return main(${argNames.join(',')});`
          : codeLines[0]?.includes(`=>`)
            ? `const main = ${code}; return main(${argNames.join(',')});`
            : `return (${code});`;
      if (rs.formattedCode !== formattedCode) {
        rs.formattedCode = formattedCode;
        rs.fun = undefined;
      }

      let fun = rs.fun;
      if (!fun) {
        fun = new Function(...argNames, formattedCode) as (
          ...args: unknown[]
        ) => unknown;
        rs.fun = fun;
      }
      controller.setProgress({
        progressRatio: 0.5,
        message: 'Function creation complete',
      });
      console.log('[toFunction] Created function:', fun);
      if (!fun) {
        throw new Error('Function was not created');
      }
      const funResult = await fun(
        inputsTyped?.x,
        inputsTyped?.y,
        inputsTyped?.z,
      );
      controller.setProgress({
        progressRatio: 1,
        message: 'Function execution complete',
      });

      if (funResult === undefined) {
        return;
      }

      return {
        outputs: { value: funResult ?? null },
      };
    },
  },
  toComponentTypeNode: {
    type: WorkflowBrandedTypes.typeName(`toComponentTypeNode`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringInputComponent),
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
        type: WorkflowBrandedTypes.valueType(`ReactComponentType`),
      },
    ],
    execute: async ({
      inputs,
      data,
      controller,
      store,
      node,
      runtimeState,
    }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };
      const runtimeStateTyped = runtimeState as {
        holder$:
          | undefined
          | Observable<{ Component: React.ComponentType; instanceId: string }>;
      };

      const code = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({
        progressRatio: 0.1,
        message: 'Creating Component function...',
      });
      const fun = new Function(
        `React`,
        `useValue`,
        `${code} return Component;`,
      );
      controller.setProgress({
        progressRatio: 0.5,
        message: 'Function creation complete',
      });
      console.log('[toFunction] Created function:', fun);

      const Component = (await fun(React, useValue)) as React.ComponentType;
      console.log('[toFunction] Created Component:', Component);

      const typeName = WorkflowBrandedTypes.typeName(`d:${node.id}`);
      let holder$ = runtimeStateTyped.holder$;
      if (!holder$) {
        holder$ = observable({
          Component,
          instanceId: `${Date.now()}-${Math.random()}`,
        });
        runtimeStateTyped.holder$ = holder$;
      }
      holder$.Component.set(Component);
      holder$.instanceId.set(`${Date.now()}-${Math.random()}`);

      if (!store.nodeTypes[typeName]) {
        store.actions.deleteNodeType(typeName);
        store.actions.createNodeType({
          type: typeName,
          getComponent: () => ({
            Component: NodeStandardContainer(ComponentSwapper(holder$)),
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

      controller.setProgress({
        progressRatio: 1,
        message: 'Component creation complete',
      });

      return {
        outputs: { value: Component ?? null },
      };
    },
  },
  detectMissingClasses: {
    type: WorkflowBrandedTypes.typeName(`detectMissingClasses`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringInputComponent),
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

    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };
      const tsCode = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({
        progressRatio: 0.5,
        message: 'Detecting missing classes...',
      });

      const { detectMissingClassesInCode } = await import(
        './detect-missing-classes.ts'
      );
      const result = detectMissingClassesInCode(tsCode);

      controller.setProgress({
        progressRatio: 1,
        message: 'Detecting missing classes complete',
      });

      return {
        outputs: { value: result ?? null },
      };
    },
  },

  transformTypescript: {
    type: WorkflowBrandedTypes.typeName(`transformTypescript`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringInputComponent),
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
    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      const tsCode = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({
        progressRatio: 0.5,
        message: 'Compiling TypeScript...',
      });

      const { transformTypescript: compileTypescript } = await import(
        './swc-tools.ts'
      );
      const result = await compileTypescript(tsCode);

      controller.setProgress({
        progressRatio: 1,
        message: 'Compiling TypeScript complete',
      });

      return {
        outputs: { value: result ?? null },
      };
    },
  },

  parseTypescript: {
    type: WorkflowBrandedTypes.typeName(`parseTypescript`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringInputComponent),
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
        type: WorkflowBrandedTypes.valueType(`unknown`),
      },
    ],
    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      const tsCode = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({
        progressRatio: 0.5,
        message: 'Compiling TypeScript...',
      });

      const { parseTypescript } = await import('./swc-tools.ts');
      const result = await parseTypescript(tsCode);

      controller.setProgress({
        progressRatio: 1,
        message: 'Compiling TypeScript complete',
      });

      return {
        outputs: { value: result ?? null },
      };
    },
  },

  parseObjectTypeDefinition: {
    type: WorkflowBrandedTypes.typeName(`parseObjectTypeDefinition`),
    getComponent: () => ({
      Component: NodeStandardContainer(StringInputComponent),
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
        type: WorkflowBrandedTypes.valueType(`unknown`),
      },
    ],
    execute: async ({ inputs, data, controller }) => {
      const inputsTyped = inputs as {
        value: undefined | string;
      };
      const dataTyped = data as undefined | { value: undefined | string };

      const tsCode = inputsTyped.value ?? dataTyped?.value ?? ``;

      controller.setProgress({
        progressRatio: 0.5,
        message: 'Compiling TypeScript...',
      });

      const { parseObjectTypeDefinition } = await import('./swc-tools.ts');
      const result = await parseObjectTypeDefinition(tsCode);

      controller.setProgress({
        progressRatio: 1,
        message: 'Compiling TypeScript complete',
      });

      return {
        outputs: { value: result ?? null },
      };
    },
  },
};
