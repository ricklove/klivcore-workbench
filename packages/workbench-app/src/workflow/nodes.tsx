import { useRef, useState } from 'react';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import type { WorkflowComponentProps, WorkflowRuntimeValue } from './types';
import { useValue } from '@legendapp/state/react';

export const StringNodeComponent = (props: WorkflowComponentProps) => {
  const nodeInputs = useValue(
    () =>
      props.data.inputs$.find((input) => input.name.get() === 'value')?.value as
        | WorkflowRuntimeValue<string>
        | undefined,
  );
  const nodeData = useValue(
    () => props.data.data$.get() as unknown as WorkflowRuntimeValue<{ value: string }> | undefined,
  );

  const propText = nodeInputs?.data ?? nodeData?.data.value ?? ``;
  const [text, setText] = useState(propText);

  const oldPropText = useRef(propText);
  if (oldPropText.current !== propText) {
    oldPropText.current = propText;
    setText(propText);
  }

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <textarea
          className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan"
          value={text}
          readOnly={!props.selected || !!nodeInputs?.data}
          onChange={(e) => {
            setText(e.target.value);
            props.data.node$.data.data.set({
              value: e.target.value,
            });
          }}
        />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
