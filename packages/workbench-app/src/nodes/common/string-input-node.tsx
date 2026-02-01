import { useValue } from '@legendapp/state/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

// --- LOGIC: Node Definition ---
export const stringInputNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`string`),
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
};

export const StringInputComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { value: string; overrideInput: boolean },
    { value: string },
    { value: string }
  >,
) => {
  const { node$, inputs, data } = props.data;
  const data$ = data.asObservable();

  const textData = useValue(data$.value);
  const overrideInput = useValue(data$.overrideInput);
  const textInput = useValue(inputs.value.asObservable());
  const textInputSlot = useValue(() => node$.getInputInfo<string>(`value`));

  const text = overrideInput ? textData : (textInput ?? textData ?? '');
  const isReadonly = !overrideInput && textInputSlot.isConnected;

  const [textValue, setTextValue] = useState(text);
  const changeTextValue = (newValue: string) => {
    setTextValue(newValue);
    node$.data.get().setValue({
      value: newValue,
    });
  };

  const initialTextValueRef = useRef(text);
  // eslint-disable-next-line react-hooks/refs
  if (initialTextValueRef.current !== text) {
    // eslint-disable-next-line react-hooks/refs
    initialTextValueRef.current = text;
    if (text !== textValue) {
      setTextValue(text);
    }
  }

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
      value={textValue}
      readOnly={!props.selected || isReadonly}
      onChange={(e) => {
        changeTextValue(e.target.value);
      }}
    />
  );
};
