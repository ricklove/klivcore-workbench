import { type Observable, observable } from '@legendapp/state';
import type {
  WorkflowDocumentData,
  WorkflowJsonObject,
  WorkflowNodeId,
  WorkflowRuntimeNode,
  WorkflowRuntimeStore,
} from '../types';
import { observeBatched } from './observe-batched';

export const persistStoreToDocument = (
  store$: Observable<WorkflowRuntimeStore>,
): Observable<WorkflowDocumentData | undefined> => {
  const document$ = observable<WorkflowDocumentData>();

  const SYNC_TIMEOUT = 3000;
  observeBatched(() => {
    Object.values(store$.edges).forEach((edge$) => {
      edge$.id.get();
      edge$.isDeleted?.get();
    });

    const nodeIdMap = Object.fromEntries(
      Object.values(store$.nodes)
        .map((node$: Observable<WorkflowRuntimeNode>) => [
          node$.id.get(),
          node$.newIdUntilReload.get(),
        ])
        .filter(([, newId]) => !!newId),
    );
    const getNodeId = (id: undefined | WorkflowNodeId) =>
      nodeIdMap[id ?? ``] || id;

    const document: WorkflowDocumentData = {
      nodes: Object.values(store$.nodes)
        .map((node$: Observable<WorkflowRuntimeNode>) => {
          if (!node$.id.peek() || node$.isDeleted.get()) {
            return undefined;
          }

          return {
            id: getNodeId(node$.id.get()),
            type: node$.type.get(),
            position: {
              x: node$.position.x.get(),
              y: node$.position.y.get(),
              width: node$.position.width.get(),
              height: node$.position.height.get(),
            },
            inputs: node$.inputs.map((input$) => {
              const edge = input$.getEdge();
              //   const edge = Object.values(store.edges).find(
              //     (e) => e.target.nodeId === node.id && e.target.inputName === input.name,
              //   );
              return {
                name: input$.name.get(),
                type: input$.type.get(),
                source:
                  edge && !edge.isDeleted
                    ? {
                        nodeId: getNodeId(edge.source.nodeId),
                        name: edge.source.outputName,
                      }
                    : undefined,
              };
            }),
            outputs: node$.outputs.map((output$) => ({
              name: output$.name.get(),
              type: output$.type.get(),
            })),
            data:
              node$.data.get().getUiValue<WorkflowJsonObject>() ?? undefined,
            parentId: getNodeId(node$.parentId.get()),
            mode: node$.mode.get(),
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== undefined),
    };

    document$.set(document);
  }, SYNC_TIMEOUT);

  return document$;
};
