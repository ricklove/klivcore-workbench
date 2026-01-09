import { WorkflowNodeWrapperSimple } from './node-wrapper';
import type { WorkflowComponentProps } from './types';
import { useValue } from '@legendapp/state/react';

export const StringNodeComponent = (props: WorkflowComponentProps) => {
  const { text, isReadonly } = useValue(() => {
    const inputSlot$ = props.data.node$.inputs.find((input) => input.name.get() === 'value');
    const inputEdgeId = !!inputSlot$?.edgeId.get();
    const inputText = (inputSlot$?.value.data.get() as undefined | { value: undefined | string })
      ?.value;
    const dataText = (props.data.node$.data.data.get() as undefined | { value: string })?.value;
    return { text: inputText ?? dataText ?? ``, isReadonly: !!inputEdgeId };
  });

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <textarea
          className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan"
          value={text}
          readOnly={!props.selected || isReadonly}
          onChange={(e) => {
            props.data.node$.data.data.set({
              value: e.target.value,
            });
          }}
        />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
