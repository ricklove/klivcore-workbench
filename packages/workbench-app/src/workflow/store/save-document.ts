import { subscribe } from 'valtio';
import type { WorkflowDocumentData, WorkflowRuntimeStore } from '../types';

type Subscribable<T> = {
  subscribe: (callback: (data: T) => void) => { unsubscribe: () => void };
};

const createSubject = <T>() => {
  const subject = {
    subscribers: [] as ((data: T) => void)[],
    next: (data: T) => {
      for (const subscriber of subject.subscribers) {
        try {
          subscriber(data);
        } catch (err) {
          console.error(`[persistStoreToDocument:subject.next] subscriber error`, {
            err,
            subscriber,
          });
        }
      }
    },
    subscribe: (callback: (data: T) => void) => {
      subject.subscribers.push(callback);
      return {
        unsubscribe: () => {
          subject.subscribers = subject.subscribers.filter((x) => x !== callback);
        },
      };
    },
  };

  return subject;
};

export const persistStoreToDocument = (
  store: WorkflowRuntimeStore,
): Subscribable<WorkflowDocumentData> => {
  const subject = createSubject<WorkflowDocumentData>();

  const SYNC_TIMEOUT = 1000;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  subscribe(store, () => {
    clearTimeout(timeoutId!);
    timeoutId = setTimeout(() => {
      const document: WorkflowDocumentData = {
        nodes: Object.values(store.nodes).map((node) => {
          return {
            id: node.id,
            type: node.type,
            position: node.position,
            inputs: node.inputs.map((input) => {
              const edge = input.getEdge();
              //   const edge = Object.values(store.edges).find(
              //     (e) => e.target.nodeId === node.id && e.target.inputName === input.name,
              //   );
              return {
                name: input.name,
                type: input.type,
                source: edge
                  ? {
                      nodeId: edge.source.nodeId,
                      name: edge.source.outputName,
                    }
                  : undefined,
              };
            }),
            outputs: node.outputs.map((output) => ({
              name: output.name,
              type: output.type,
            })),
            data: node.data,
            parentId: node.parentId,
            mode: node.mode,
          };
        }),
      };
      subject.next(document);
    }, SYNC_TIMEOUT);
  });

  return {
    subscribe: subject.subscribe,
  };
};
