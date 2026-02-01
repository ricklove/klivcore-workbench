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

export const subflowInputsNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-inputs`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInputsComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async ({ data, node, store }) => {
    const { fields } =
      (data as { fields: Array<{ name: string; type: string }> }) ?? {};
    if (!fields) {
      return;
    }

    // the subflow inputs come into the subflow node as outputs of this node
    store.actions.updateOutputs(
      node.id,
      fields.map((field) => ({
        name: WorkflowBrandedTypes.outputName(field.name),
        type: WorkflowBrandedTypes.valueType(field.type),
      })),
    );

    store.actions.updateInputs(node.id, [
      ...fields.map((field) => ({
        name: WorkflowBrandedTypes.inputName(`default_${field.name}`),
        type: WorkflowBrandedTypes.valueType(field.type),
      })),
      // TODO: add input upon attach edge
      // {
      //   name: WorkflowBrandedTypes.inputName(`add`),
      //   type: WorkflowBrandedTypes.valueType(`unknown`),
      // },
    ]);

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

  return <FieldDisplay label="Subflow Inputs" fields={fields} />;
};
