import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { FieldEditor } from './components/field-editor';

export const subflowInputsNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-inputs`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInputsComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async () => {
    return {
      outputs: {},
    };
  },
};

export const SubflowInputsComponent = (
  props: WorkflowComponentSimplePropsTyped<
    { fields: Array<{ name: string; type: string }> },
    Record<string, never>,
    Record<string, never>
  >,
) => {
  const { data } = props.data;
  const data$ = data.asObservable();

  const fields = useValue(data$.fields) ?? [];

  if (props.selected) {
    return <FieldEditor fields$={data$.fields} />;
  }

  return (
    <div className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25 flex items-center justify-center">
      <span className="text-sm text-gray-400">
        Subflow Inputs ({fields.length})
      </span>
    </div>
  );
};
