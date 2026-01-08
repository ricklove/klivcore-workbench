import { observable, type Observable } from '@legendapp/state';
import type { WorkflowDocumentData, WorkflowRuntimeNode, WorkflowRuntimeStore } from '../types';
import { observeBatched } from './observe-batched';

export const persistStoreToDocument = (
  store$: Observable<WorkflowRuntimeStore>,
): Observable<WorkflowDocumentData | undefined> => {
  const document$ = observable<WorkflowDocumentData>();

  const SYNC_TIMEOUT = 1000;
  observeBatched(() => {
    const document: WorkflowDocumentData = {
      nodes: Object.values(store$.nodes).map((node: Observable<WorkflowRuntimeNode>) => {
        return {
          id: node.id.get(),
          type: node.type.get(),
          position: node.position.get(),
          inputs: node.inputs.map((input) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const edgeId = input.edgeId.get();
            const edge = input.getEdge();
            //   const edge = Object.values(store.edges).find(
            //     (e) => e.target.nodeId === node.id && e.target.inputName === input.name,
            //   );
            return {
              name: input.name.get(),
              type: input.type.get(),
              source: edge
                ? {
                    nodeId: edge.source.nodeId,
                    name: edge.source.outputName,
                  }
                : undefined,
            };
          }),
          outputs: node.outputs.map((output) => ({
            name: output.name.get(),
            type: output.type.get(),
          })),
          // TODO: fix data observation
          data: node.data.get().data,
          parentId: node.parentId.get(),
          mode: node.mode.get(),
        };
      }),
    };

    document$.set(document);
  }, SYNC_TIMEOUT);

  return document$;
};
