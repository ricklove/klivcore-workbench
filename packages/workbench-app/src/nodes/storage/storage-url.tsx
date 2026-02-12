import {
  EmptyNodeComponent,
  NodeStandardContainer,
} from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { storageStore$ } from './_storage-store';

export const storageUrlNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`storage-url`),
  getComponent: () => ({
    Component: NodeStandardContainer(EmptyNodeComponent),
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
  execute: async ({ inputs }) => {
    const inputsTyped = inputs as { value: string };

    const { provider: provider$, path } =
      storageStore$.getProviderWithPath(inputsTyped.value) ?? {};
    const provider = provider$?.peek();

    console.log('[storageUrlNodeType] Storage URL Node executing with:', {
      inputValue: inputsTyped.value,
      provider,
      path,
    });

    if (!path || !provider || !provider.getUrl) {
      return;
    }

    return {
      outputs: {
        value: provider?.getUrl(path),
      },
    };
  },
  generateCode: ({ inputNames }) => {
    return {
      typescript: `
(()=>{
  const { provider: provider$, path } =
    storageStore$.getProviderWithPath(${inputNames[WorkflowBrandedTypes.inputName(`value`)]}) ?? {};
  const provider = provider$?.peek();
  if (!path || !provider || !provider.getUrl) {
    return { value: undefined };
  }
  return {
    value: provider.getUrl(path),
  };
})()`.trim(),
    };
  },
};
