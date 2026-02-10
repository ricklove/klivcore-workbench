import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { FieldDisplay, FieldEditor } from './components/field-editor';
import { observe, type Observable } from '@legendapp/state';

export type SubflowOutputsData = {
  fields: Array<{ name: string; type: string }>;
};

export const subflowOutputsNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-outputs`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowOutputsComponent),
  }),
  inputs: [],
  outputs: [],
  load: async ({ node$, store$ }) => {
    const unsub = observe(() => {
      const data = node$.data.get();
      const dataValue$ = data.getObservableBox() as Observable<
        SubflowOutputsData | undefined
      >;
      const fields = dataValue$?.fields.get() ?? [];
      if (!fields) {
        return;
      }

      const store = store$.peek();
      const node = node$.peek();

      store.actions.updateInputs(
        node.id,
        fields.map((field) => ({
          name: WorkflowBrandedTypes.inputName(field.name),
          type: WorkflowBrandedTypes.valueType(field.type),
        })),

        // TODO: add input upon attach edge
        // {
        //   name: WorkflowBrandedTypes.inputName(`add`),
        //   type: WorkflowBrandedTypes.valueType(`unknown`),
        // },
      );

      store.actions.updateOutputs(
        node.id,
        fields.map((field) => ({
          name: WorkflowBrandedTypes.outputName(`ext_${field.name}`),
          type: WorkflowBrandedTypes.valueType(field.type),
        })),
      );
    });
    return {
      unsubscribe: () => {
        unsub();
      },
    };
  },
  execute: async ({ inputs }) => {
    return {
      outputs: Object.fromEntries(
        Object.entries(inputs).map(([key, value]) => [`ext_${key}`, value]),
      ),
    };
  },
};

export const SubflowOutputsComponent = (
  props: WorkflowComponentSimplePropsTyped<
    SubflowOutputsData,
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
