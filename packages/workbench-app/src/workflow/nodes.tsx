import { useLayoutEffect, useRef, useState } from 'react';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import { type WorkflowComponentProps_Obs } from './types';
import { useObservable, useValue } from '@legendapp/state/react';
import { linked } from '@legendapp/state';

export const StringNodeComponent = (props: WorkflowComponentProps_Obs<{ value: string }>) => {
  const { node$, inputs$, data$ } = props.data;

  // const data$ = getData();
  const textData = useValue(() => data$.value.get());
  // const textData = useValue(() => node$.data.get().getValue<{ value: string }>()?.value);
  const textInput = useValue(() => inputs$.value.get());
  const textInputSlot = useValue(() => node$.getInputInfo<string>(`value`));

  const text = textInput ?? textData ?? '';
  const isReadonly = textInputSlot.isConnected;

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
    setTextValue(text);
  }

  // console.log(`[StringNodeComponent]`, { textInput, textData, text, isReadonly });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (props.selected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [props.selected]);

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
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
      </WorkflowNodeWrapperSimple>
    </>
  );
};

export const JsonNodeComponent = (
  props: WorkflowComponentProps_Obs<{ value: string }, { value: Record<string, unknown> }>,
) => {
  const inputs$ = useObservable(() =>
    linked({
      get: () => ({ value: JSON.stringify(props.data.inputs$.value.get(), null, 2) }),
      set: (v) => {
        console.log(`Cannot set input`, v.value as unknown as string);
      },
    }),
  );
  const data$ = useObservable<{ value: string }>(() =>
    linked({
      get: () => ({ value: props.data.data$.value.get() }),
      set: (v) => {
        props.data.data$.value.set(v.value as unknown as string);
      },
    }),
  );
  const outputs$ = useObservable(() =>
    linked({
      get: () => ({ value: JSON.stringify(props.data.outputs$.value.get(), null, 2) }),
      set: (v) => {
        props.data.outputs$.value.set(JSON.parse(v.value as unknown as string));
      },
    }),
  );
  return <StringNodeComponent {...props} data={{ ...props.data, inputs$, data$, outputs$ }} />;
};
