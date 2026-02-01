import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import {
  FieldDisplay,
  FieldEditor,
  formatFieldTypeText,
} from './components/field-editor';

export const subflowOutputsNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-outputs`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowOutputsComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async ({ data, node, store }) => {
    const { fields } =
      (data as { fields: Array<{ name: string; type: string }> }) ?? {};
    if (!fields) {
      return;
    }

    // the subflow outputs come into the subflow node as inputs of this node
    store.actions.updateInputs(
      node.id,
      fields.map((field) => ({
        name: WorkflowBrandedTypes.inputName(field.name),
        type: WorkflowBrandedTypes.valueType(field.type),
      })),
    );

    store.actions.updateOutputs(
      node.id,
      fields.map((field) => ({
        name: WorkflowBrandedTypes.outputName(`ext_${field.name}`),
        type: WorkflowBrandedTypes.valueType(field.type),
      })),
    );

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

  return <FieldDisplay label="Subflow Outputs" fields={fields} />;
};
