import { useValue } from '@legendapp/state/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { WrapperHandles } from './node-wrapper';
import type { WorkflowComponentSimplePropsTyped } from './types';

export const StringNodeComponent = (
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

  // console.log(`[StringNodeComponent]`, { textInput, textData, text, isReadonly });

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
      // autoFocus={props.selected}
    />
  );
};

export const JsonNodeComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { value: string; overrideInput: boolean },
    { value: Record<string, unknown> },
    { value: Record<string, unknown> }
  >,
) => {
  const { data, inputs } = props.data;
  const data$ = data.asObservable();
  const textData = useValue(data$.value);
  const overrideInput = useValue(data$.overrideInput);
  const textInput = useValue(inputs.value.asObservable());

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
      value={textValue}
      readOnly={!props.selected || isReadonly}
      onChange={(e) => {
        changeTextValue(e.target.value);
      }}
    />
  );
};

export const RerouteComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { value: string },
    { value: Record<string, unknown> }
  >,
) => {
  // useLayoutEffect(() => {
  //   const size = 24;
  //   const pos$ = props.data.node$.position;

  //   if (pos$.peek().width === size && pos$.peek().height === size) {
  //     return;
  //   }
  //   console.log('[RerouteComponent] resetting size', { size, pos$: pos$.peek() });
  //   pos$.width.set(size);
  //   pos$.height.set(size);
  // }, []);
  return (
    <>
      <div className="w-4 h-6 flex flex-row items-center">
        <div className="flex-1 h-2 bg-gray-400/25"></div>
      </div>
      <WrapperHandles {...props} />
    </>
  );
};
