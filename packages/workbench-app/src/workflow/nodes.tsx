import { useRef, useState } from "react";
import { NodeWrapperSimple } from "./node-wrapper";
import type { ReactNodeData } from "./temp-store";

export const StringNodeComponent = (props: {
  id: string;
  selected: boolean;
  data: ReactNodeData<unknown, { value: string }>;
}) => {
  const propText = props.data.outputs.value?.lastValue || ``;
  const [text, setText] = useState(propText);
  const previousLastValue = useRef(text);
  if (previousLastValue.current !== propText) {
    previousLastValue.current = propText;
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
          }}
        />
      </NodeWrapperSimple>
    </>
  );
};
