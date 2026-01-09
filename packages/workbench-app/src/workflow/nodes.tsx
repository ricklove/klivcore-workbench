import { useRef, useState } from 'react';
import { WorkflowNodeWrapperSimple } from './node-wrapper';
import type { WorkflowComponentProps, WorkflowRuntimeValue } from './types';

export const StringNodeComponent = (props: WorkflowComponentProps) => {
  const nodeInputs = props.data.inputs.find((input) => input.name === 'value')
    ?.value as WorkflowRuntimeValue<string>;
  const nodeData = props.data.data as unknown as WorkflowRuntimeValue<{ value: string }>;

  const propText = nodeInputs.data ?? nodeData.data.value;
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
          readOnly={!props.selected || !!nodeInputs.data}
          onChange={(e) => {
            setText(e.target.value);
            // eslint-disable-next-line react-hooks/immutability
            props.data.node.data.data = {
              value: e.target.value,
            };
          }}
        />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
