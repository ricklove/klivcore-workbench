import { useValue } from '@legendapp/state/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

// --- LOGIC: Node Definition ---
export const jsonInputNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`json`),
  getComponent: () => ({
    Component: NodeStandardContainer(JsonInputComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`value`),
      type: WorkflowBrandedTypes.valueType(`T extends Record<string, unknown>`),
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
    );

    controller.setProgress({
      progressRatio: 0.1,
      message: 'Creating object...',
    });

    const obj = inputsTyped.value ?? dataFromJs() ?? undefined;

    controller.setProgress({
      progressRatio: 1,
      message: 'Object creation complete',
    });

    return {
      outputs: { value: obj },
    };
  },
  generateFunction: async ({ data, functionName }) => {
    const dataTyped = data as undefined | { value: undefined | string };
    const dataValueCode = `${dataTyped?.value ?? `undefined`}`;

    return {
      typescript: `const ${functionName} = <T extends undefined | Record<string, unknown>>(inputs: { value?: T }) => ({ value: inputs?.value ?? ${dataValueCode} });`,
    };
  },
};

export const JsonInputComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { value: string; overrideInput: boolean },
    { value: Record<string, unknown> },
    { value: Record<string, unknown> }
  >,
) => {
  const { data, inputs } = props.data;
  const data$ = data.asObservable();
  const textData = useValue(data$.value);
  // const overrideInput = useValue(data$.overrideInput);
  const overrideInput = useValue(false);
  const textInput = useValue(() => inputs.value.asObservable().get());

  const text = overrideInput
    ? textData
    : (JSON.stringify(textInput, null, 2) ??
      JSON.stringify(textData, null, 2) ??
      '{}');
  const isReadonly = !overrideInput && textInput !== undefined;

  const [textValue, setTextValue] = useState(text);

  const changeTextValue = (newValue: string) => {
    setTextValue(newValue);
    try {
      const parsed = JSON.parse(newValue);
      data$.value.set(JSON.stringify(parsed, null, 2));
      data$.overrideInput.set(true);
    } catch (_e) {
      // Invalid JSON, just store as string
      data$.value.set(newValue);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (props.selected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [props.selected]);

  return (
    <textarea
      ref={textareaRef}
      className={`w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan ${isReadonly ? 'bg-gray-800/25' : 'bg-black/25'}`}
      value={!overrideInput ? text : textValue}
      readOnly={!props.selected || isReadonly}
      onChange={(e) => {
        changeTextValue(e.target.value);
      }}
    />
  );
};
