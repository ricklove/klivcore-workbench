import { useLayoutEffect, useRef, useState } from 'react';
import { WorkflowNodeWrapperSimple, WrapperHandles } from './node-wrapper';
import { type WorkflowComponentProps_Obs } from './types';
import { useObservable, useValue } from '@legendapp/state/react';
import { linked } from '@legendapp/state';

export const StringNodeComponent = (
  props: WorkflowComponentProps_Obs<
    { value: string; overrideInput: boolean },
    { value: string },
    { value: string }
  >,
) => {
  const { node$, inputs$, data$ } = props.data;

  // const data$ = getData();
  const textData = useValue(() => data$.value.get());
  const overrideInput = useValue(() => data$.overrideInput.get());
  // const textData = useValue(() => node$.data.get().getValue<{ value: string }>()?.value);
  const textInput = useValue(() => inputs$.value.get());
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
    <>
      <WorkflowNodeWrapperSimple {...props}>
        {/* {textInputSlot.isConnected && (
          <div className="absolute top-1 left-0 w-0 text-xs text-gray-400 italic select-none">
            <div className="absolute bottom-0 right-0 text-xs text-gray-400 italic select-none">
              <input
                type="checkbox"
                checked={overrideInput}
                onChange={(e) => {
                  data$.overrideInput.set(e.target.checked);
                }}
                title="override input"
              />
            </div>
          </div>
        )} */}
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
  props: WorkflowComponentProps_Obs<
    { value: string; overrideInput: boolean },
    { value: Record<string, unknown> },
    { value: Record<string, unknown> }
  >,
) => {
  const inputs$ = useObservable(() =>
    linked({
      get: () => ({ value: JSON.stringify(props.data.inputs$.value.get(), null, 2) }),
      set: (v) => {
        console.log(`Cannot set input`, v.value.value);
      },
    }),
  );
  const data$ = useObservable<{ value: string; overrideInput: boolean }>(() =>
    linked({
      get: () => ({
        value: props.data.data$.value.get(),
        overrideInput: props.data.data$.overrideInput.get(),
      }),
      set: ({ value: { value, overrideInput } }) => {
        props.data.data$.value.set(value);
        props.data.data$.overrideInput.set(overrideInput);
      },
    }),
  );
  const outputs$ = useObservable(() =>
    linked({
      get: () => ({ value: JSON.stringify(props.data.outputs$.value.get(), null, 2) }),
      set: (v) => {
        props.data.outputs$.value.set(JSON.parse(v.value.value));
      },
    }),
  );
  return <StringNodeComponent {...props} data={{ ...props.data, inputs$, data$, outputs$ }} />;
};

export const RerouteComponent = (
  props: WorkflowComponentProps_Obs<{ value: string }, { value: Record<string, unknown> }>,
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
