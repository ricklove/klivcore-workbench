import { observable, ObservableHint, observe } from '@legendapp/state';
import { createWorkflowStoreFromDocument } from './store-fast/create-runtime-store';
import { persistStoreToDocument } from './store-fast/save-document';
import { createWorkflowEngine } from './store-fast/engine-direct';
import { engineController$ } from './engine-controller';
import { storageStore$ } from '../nodes/storage/_storage-store';
import type { WorkflowDocumentData, WorkflowRuntimeStore } from './types';

export const createWorkflowSet = ({ documentUrl }: { documentUrl: string }) => {
  const storageProvider = storageStore$.getProviderWithPath(documentUrl);
  if (!storageProvider) {
    console.error(
      `[createWorkflowSet] No storage provider found for URL: ${documentUrl}`,
    );
    return;
  }

  console.log(`[createWorkflowSet] setup subflow store from ${documentUrl}`);

  const runtimeStore$ = createWorkflowStoreFromDocument({ nodes: [] });

  const storeEngine = createWorkflowEngine(runtimeStore$);
  runtimeStore$.engine.set(storeEngine);

  storageProvider.provider
    ?.load<WorkflowDocumentData>(storageProvider.path)
    ?.then((doc) => {
      console.log(
        `[createWorkflowSet] Loaded document for ${documentUrl}:`,
        doc,
      );
      runtimeStore$.set(createWorkflowStoreFromDocument(doc));
      const [host, ...rest] = documentUrl.split('/');
      runtimeStore$.name.set(rest.join(`/`));
    })
    .catch((err) => {
      console.error(
        `[createWorkflowSet] Failed to load document for ${documentUrl}:`,
        err,
      );
    });

  let isAfterFirstLoad = false;
  const storePersistence$ = persistStoreToDocument(runtimeStore$);
  const unsubPersistence = observe(() => {
    const x = storePersistence$.get();
    if (!x?.nodes.length) {
      // console.warn(
      //   `[WorkflowView] Persisted document is empty, skipping save.`,
      //   { documentUrl },
      // );
      return;
    }

    if (!isAfterFirstLoad) {
      isAfterFirstLoad = true;
      return;
    }

    console.log(`[WorkflowView] Persisted document:`, {
      documentUrl,
      doc: x,
      runtimeStore$,
    });

    storageProvider.provider?.save(storageProvider.path, x).catch((err) => {
      console.error(
        `[WorkflowView] Failed to save document for ${documentUrl}:`,
        err,
      );
    });
  });

  const unsubEngine = observe(() => {
    const running = engineController$.running.get();
    const tickSpeed = engineController$.tickSpeed.get();
    if (!storeEngine) {
      return;
    }
    if (running && !storeEngine.running) {
      storeEngine.start();
    } else if (!running && storeEngine.running) {
      storeEngine.stop({ shouldAbort: true });
    }
    storeEngine.tickSpeed = tickSpeed;
  });

  return {
    runtimeStore$,
    unsubscribe: () => {
      unsubPersistence();
      unsubEngine();
    },
  };
};

export type WorkflowTreeNode = ReturnType<typeof createWorkflowSet> & {
  parent?: WorkflowTreeNode;
  children?: WorkflowTreeNode[];
};

const rooNode = createWorkflowSet({
  documentUrl: `@localstorage/klivcore-workflow-document`,
}) as WorkflowTreeNode;

export const workflowTreeStore$ = observable({
  workflowRoot: ObservableHint.opaque(rooNode),
  active: ObservableHint.opaque(rooNode),
  activePathSegments: () => {
    let a = workflowTreeStore$.active.get();
    const paths = [] as {
      name: string;
      instanceId: string;
    }[];
    paths.push({
      name: a.runtimeStore$.name.peek(),
      instanceId: a.runtimeStore$._instanceId.peek(),
    });
    while (a.parent) {
      a = a.parent;
      paths.push({
        name: a.runtimeStore$.name.peek(),
        instanceId: a.runtimeStore$._instanceId.peek(),
      });
    }
    return paths.reverse();
  },
  actions: ObservableHint.plain({
    createSubflow({ documentUrl }: { documentUrl: string }) {
      const subflow = createWorkflowSet({
        documentUrl,
      }) as WorkflowTreeNode;
      const n = workflowTreeStore$.active.peek();
      n.children = n.children || [];
      n.children.push(subflow);
      subflow.parent = workflowTreeStore$.active.peek();
      return subflow;
    },
    openSubflow(store: WorkflowRuntimeStore) {
      const child = workflowTreeStore$.active
        .peek()
        .children?.find(
          (x) => x.runtimeStore$.peek()._instanceId === store._instanceId,
        );
      if (!child) {
        console.error(`[openSubflow] No subflow found for store`, {
          storeId: store._instanceId,
          childrenIds: workflowTreeStore$.active
            .peek()
            .children?.map((c) => c.runtimeStore$.peek()._instanceId),
          store,
          active: workflowTreeStore$.active.peek(),
        });
        return;
      }
      workflowTreeStore$.active.set(ObservableHint.opaque(child));
    },
    popSubflow(instanceId?: string) {
      let a = workflowTreeStore$.active.peek();

      if (instanceId === a.runtimeStore$._instanceId.peek()) {
        return;
      }

      while (a.parent) {
        if (instanceId === a.runtimeStore$._instanceId.peek()) {
          break;
        }
        a = a.parent;
      }

      workflowTreeStore$.active.set(ObservableHint.opaque(a));
    },
  }),
});
