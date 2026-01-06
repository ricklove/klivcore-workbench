import { useRef, useState } from 'react';
import { NodeWrapperSimple } from './node-wrapper';
import type { WorkflowRuntimeNode } from './types';

export const StringNodeComponent = (props: {
  id: string;
  selected: boolean;
  data: { node: WorkflowRuntimeNode };
}) => {
  const propText = props.data.node.data.value as string;
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
            props.data.node.data.value = e.target.value;
          }}
        />
      </NodeWrapperSimple>
    </>
  );
};
