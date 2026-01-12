import { useLayoutEffect, useRef } from 'react';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import { type WorkflowComponentProps_Obs } from './types';
import { useValue } from '@legendapp/state/react';

export const StringNodeComponent = (props: WorkflowComponentProps_Obs<{ value: string }>) => {
  const { node$, inputs$, data$ } = props.data;

  // const data$ = getData();
  const textData = useValue(() => data$.value.get());
  // const textData = useValue(() => node$.data.get().getValue<{ value: string }>()?.value);
  const textInput = useValue(() => inputs$.value.get());
  const textInputSlot = useValue(() => node$.getInputInfo<string>(`value`));

  const text = textInput ?? textData ?? '';
  const isReadonly = textInputSlot.isConnected;

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
          value={text}
          readOnly={!props.selected || isReadonly}
          onChange={(e) => {
            node$.data.get().setValue({
              value: e.target.value,
            });
          }}
          autoFocus={props.selected}
        />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
