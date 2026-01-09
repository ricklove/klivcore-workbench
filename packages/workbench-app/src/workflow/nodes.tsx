import { WorkflowNodeWrapperSimple } from './node-wrapper';
import { type WorkflowComponentProps } from './types';
import { useValue } from '@legendapp/state/react';

export const StringNodeComponent = (props: WorkflowComponentProps) => {
  const node$ = props.data.node$;
  const { text, isReadonly } = useValue(() => {
    const inputSlot = node$.getInputData<string>(`value`);
    const dataText = node$.getData<{ value: string }>(undefined)?.data?.value;
    return { text: inputSlot.data ?? dataText ?? ``, isReadonly: !!inputSlot.isConnected };
  });

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <textarea
          className={`w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan ${isReadonly ? 'bg-gray-800/25' : 'bg-black/25'}`}
          value={text}
          readOnly={!props.selected || isReadonly}
          onChange={(e) => {
            node$.data.data.set({
              value: e.target.value,
            });
          }}
        />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
