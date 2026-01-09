import { WorkflowNodeWrapperSimple } from './node-wrapper';
import { type WorkflowComponentProps } from './types';
import { useValue } from '@legendapp/state/react';

export const StringNodeComponent = (props: WorkflowComponentProps<{ value: string }>) => {
  const node$ = props.data.node$;
  const textInput = useValue(props.data.inputs$.value.get());
  const textInputSlot = useValue(() => node$.getInputInfo<string>(`value`));
  const textData = useValue(() => {
    return node$.data.get().getValue<{ value: string }>()?.value;
  });

  const text = textInput ?? textData ?? '';
  const isReadonly = textInputSlot.isConnected;

  console.log(`[StringNodeComponent]`, { textInput, textData, text, isReadonly });

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <textarea
          className={`w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan ${isReadonly ? 'bg-gray-800/25' : 'bg-black/25'}`}
          value={text}
          readOnly={!props.selected || isReadonly}
          onChange={(e) => {
            node$.data.setValue({
              value: e.target.value,
            });
          }}
        />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
