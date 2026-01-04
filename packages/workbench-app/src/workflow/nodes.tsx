import { NodeWrapperSimple } from "./node-wrapper";
import type { ReactNodeData } from "./store";

export const StringNodeComponent = (props: {
  id: string;
  selected: boolean;
  data: ReactNodeData<unknown, { value: string }>;
}) => {
  return (
    <>
      <NodeWrapperSimple {...props}>
        <div className="text-white">{props.data.outputs.value?.lastValue}</div>
      </NodeWrapperSimple>
    </>
  );
};
