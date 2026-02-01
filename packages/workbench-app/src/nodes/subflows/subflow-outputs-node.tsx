import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { FieldEditor } from './components/field-editor';

export const subflowOutputsNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-outputs`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowOutputsComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async () => {
    return {
      outputs: {},
    };
  },
};

export const SubflowOutputsComponent = (
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
        Subflow Outputs ({fields.length})
      </span>
    </div>
  );
};
