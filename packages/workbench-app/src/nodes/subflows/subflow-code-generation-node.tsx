import { useObservable, useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { generateCodeForWorkflow } from './workflow-code-generation';
import { persistStoreToDocument } from '../../workflow/store-fast/save-document';
import { useMemo } from 'react';

export const subflowCodeGenerationNodeType: WorkflowRuntimeNodeTypeDefinition =
  {
    type: WorkflowBrandedTypes.typeName(`subflow-code-generation`),
    getComponent: () => ({
      Component: NodeStandardContainer(SubflowCodeGenerationComponent),
    }),
    inputs: [],
    outputs: [],
    execute: async () => {
      return undefined;
    },
    generateCode: () => {
      return {
        kind: `none`,
      };
    },
  };

export const SubflowCodeGenerationComponent = ({
  data: { store$ },
}: WorkflowComponentSimplePropsTyped<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>
>) => {
  const storePersistence$ = useMemo(
    () => persistStoreToDocument(store$),
    [store$],
  );

  const { doc, code } = useValue(() => {
    const doc = storePersistence$.get();
    if (!doc) {
      return {};
    }

    const code = generateCodeForWorkflow({
      doc,
      nodeTypes: store$.nodeTypes.peek(),
    });
    return { doc, code };
  });

  return (
    <div className="w-full h-full flex flex-col text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25">
      <div className="flex flex-row justify-start">Doc</div>
      <textarea
        className=" flex-1 whitespace-pre-wrap resize-none"
        value={JSON.stringify(doc, null, 2)}
        readOnly
      />
      <div className="flex flex-row justify-start">Code</div>
      <textarea
        className="flex-1 whitespace-pre-wrap resize-none"
        value={code}
        readOnly
      />
    </div>
  );
};
