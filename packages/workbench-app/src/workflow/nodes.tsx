import { WorkflowNodeWrapperSimple } from './node-wrapper';
import { type WorkflowComponentProps } from './types';
import { useValue } from '@legendapp/state/react';

export const StringNodeComponent = (props: WorkflowComponentProps) => {
  const node$ = props.data.node$;
  const textInputSlot = useValue(() => node$.getInputData<string>(`value`));
  const textData = useValue(() => {
    return node$.data.get().getValue<{ value: string }>()?.value;
  });

  const text = textInputSlot.data ?? textData ?? '';
  const isReadonly = textInputSlot.isConnected;

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
