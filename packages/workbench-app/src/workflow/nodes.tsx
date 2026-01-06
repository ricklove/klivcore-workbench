import { useRef, useState } from 'react';
import { NodeWrapperSimple } from './node-wrapper';
import type { WorkflowRuntimeNode, WorkflowRuntimeStore, WorkflowRuntimeValue } from './types';

export const StringNodeComponent = (props: {
  id: string;
  selected: boolean;
  data: { node: WorkflowRuntimeNode; store: WorkflowRuntimeStore };
}) => {
  const nodeData = props.data.node.data as WorkflowRuntimeValue<{ value: string }>;
  const propText = nodeData.data.value;
  const [text, setText] = useState(propText);

  const oldPropText = useRef(propText);
  if (oldPropText.current !== propText) {
    oldPropText.current = propText;
    setText(propText);
  }

  return (
    <>
      <NodeWrapperSimple {...props}>
        <textarea
          className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan"
          value={text}
          readOnly={!props.selected}
          onChange={(e) => {
            setText(e.target.value);
            // eslint-disable-next-line react-hooks/immutability
            nodeData.data.value = e.target.value;
          }}
        />
      </NodeWrapperSimple>
    </>
  );
};
