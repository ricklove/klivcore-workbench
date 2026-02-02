import { useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowDocumentData,
  type WorkflowOutputName,
  type WorkflowRuntimeEngine,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowRuntimeStore,
} from '../../workflow/types';
import { createWorkflowStoreFromDocument } from '../../workflow/store-fast/create-runtime-store';
import { observable, observe, type Observable } from '@legendapp/state';
import { createWorkflowEngine } from '../../workflow/store-fast/engine-direct';
import { engineController$ } from '../../workflow/engine-controller';

type RuntimeStateType = {
  subflowUrl?: string;
  runtimeStore$?: Observable<WorkflowRuntimeStore>;
  storeEngine?: WorkflowRuntimeEngine;
  subflowNodes$?: Observable<{
    inputsNode: WorkflowRuntimeNode | undefined;
    outputsNode: WorkflowRuntimeNode | undefined;
  }>;
};

export const subflowInstanceNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-instance`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInstanceComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`trigger`),
      type: WorkflowBrandedTypes.valueType(`unknown`),
    },
  ],
  outputs: [],
  execute: async ({ data, runtimeState, controller, store, node }) => {
    const dataTyped = data as SubflowInstanceData;
    if (!dataTyped?.url) {
      return;
    }

    const runtimeStateTyped = runtimeState as RuntimeStateType;

    if (!runtimeStateTyped.subflowUrl) {
      // setup subflow store and engine
      if (!dataTyped.url.startsWith(`@localhost/`)) {
        console.log(
          'Only localhost subflow URLs are supported in this version.',
        );
        throw new Error(
          'Only localhost subflow URLs are supported in this version.',
        );
      }

      const localStorageKey = dataTyped.url.replace(`@localhost/`, `ksub-`);

      const storeDoc = (() => {
        try {
          return JSON.parse(
            localStorage.getItem(localStorageKey) || ``,
          ) as WorkflowDocumentData;
        } catch (err) {
          console.error(
            `[WorkflowView] Error parsing stored workflow document`,
            {
              err,
            },
          );
        }

        return undefined;
      })();

      const runtimeStore$ = createWorkflowStoreFromDocument(
        storeDoc ?? {
          nodes: [],
        },
      );

      const storeEngine = createWorkflowEngine(runtimeStore$);

      runtimeStateTyped.runtimeStore$ = runtimeStore$;
      runtimeStateTyped.storeEngine = storeEngine;

      // no persistance for now (workflow is not being edited here)
      // const storePersistance$ = persistStoreToDocument(runtimeStore$);
      // runtimeStateTyped.storePersistance$ = storePersistance$;
      // observe(() => {
      //   const doc = storePersistance$.get();
      //   if (!doc) {
      //     return;
      //   }
      //   localStorage.setItem(localStorageKey, JSON.stringify(doc));
      // });

      console.log(
        `[subflowInstanceNodeType.execute] created subflow runtime store and engine: `,
        {
          runtimeStore$,
          storeEngine,
        },
      );

      observe(() => {
        const running = engineController$.running.get();
        const tickSpeed = engineController$.tickSpeed.get();
        if (!runtimeStateTyped.storeEngine) {
          return;
        }
        if (running && !runtimeStateTyped.storeEngine.running) {
          runtimeStateTyped.storeEngine.start();
        } else if (!running && runtimeStateTyped.storeEngine.running) {
          runtimeStateTyped.storeEngine.stop({ shouldAbort: true });
        }
        runtimeStateTyped.storeEngine.tickSpeed = tickSpeed;
      });

      console.log(`[subflowInstanceNodeType.execute] setup engine controls: `, {
        runtimeStore$,
        storeEngine,
      });

      // setup inputs and outputs
      runtimeStateTyped.subflowNodes$ = observable({
        inputsNode: undefined as WorkflowRuntimeNode | undefined,
        outputsNode: undefined as WorkflowRuntimeNode | undefined,
      });
      observe(() => {
        if (!runtimeStateTyped.runtimeStore$?.get()) {
          return;
        }

        const inputsNode$ = Object.values(
          runtimeStateTyped.runtimeStore$.nodes,
        )?.find(
          (n: Observable<WorkflowRuntimeNode>) =>
            n.type.get() === WorkflowBrandedTypes.typeName(`subflow-inputs`),
        ) as Observable<WorkflowRuntimeNode | undefined> | undefined;
        const outputsNode$ = Object.values(
          runtimeStateTyped.runtimeStore$.nodes,
        )?.find(
          (n: Observable<WorkflowRuntimeNode>) =>
            n.type.get() === WorkflowBrandedTypes.typeName(`subflow-outputs`),
        ) as Observable<WorkflowRuntimeNode | undefined> | undefined;

        runtimeStateTyped.subflowNodes$?.outputsNode.set(outputsNode$?.get());
        runtimeStateTyped.subflowNodes$?.inputsNode.set(inputsNode$?.get());

        console.log(
          `[subflowInstanceNodeType.execute.setup inputs and outputs.observe] nodes changed: `,
          {
            inputsNode$: inputsNode$,
            outputsNode$: outputsNode$,
            runtimeStore$: runtimeStateTyped.runtimeStore$?.peek(),
          },
        );
      });

      store.actions.updateInputs(node.id, [
        {
          name: WorkflowBrandedTypes.inputName(`trigger`),
          type: WorkflowBrandedTypes.valueType(`unknown`),
        },
        ...(runtimeStateTyped.subflowNodes$?.inputsNode
          ?.peek()
          ?.outputs.map((field) => ({
            name: WorkflowBrandedTypes.inputName(field.name),
            type: WorkflowBrandedTypes.valueType(field.type),
          })) ?? []),
      ]);

      store.actions.updateOutputs(
        node.id,
        runtimeStateTyped.subflowNodes$?.outputsNode
          ?.peek()
          ?.inputs?.map((field) => ({
            name: WorkflowBrandedTypes.outputName(field.name),
            type: WorkflowBrandedTypes.valueType(field.type),
          })) ?? [],
      );

      runtimeStateTyped.subflowUrl = dataTyped.url;
    }

    // setup output subscriptions
    controller.registerEvent((emit) => {
      const outputSubs = new Map<WorkflowOutputName, () => void>();

      observe(() => {
        const subflowOutputsNode$ =
          runtimeStateTyped.subflowNodes$?.outputsNode;
        const subflowOutputsNode = subflowOutputsNode$?.get();
        if (!subflowOutputsNode$ || !subflowOutputsNode) {
          console.log(
            `[subflowInstanceNodeType.execute.registerEvent] no subflowOutputsNode`,
            {
              subflowOutputsNode,
              subflowOutputsNode$,
              runtimeStore$: runtimeStateTyped.runtimeStore$?.get(),
            },
          );

          return;
        }

        const outputs = subflowOutputsNode$.outputs.map((output) =>
          output.get(),
        );

        console.log(
          `[subflowInstanceNodeType.execute.registerEvent] outputs: `,
          { outputs },
        );

        const removedOutputs = [...outputSubs.keys()].filter(
          (outputName) => !outputs.find((output) => output.name === outputName),
        );
        for (const removedOutput of removedOutputs) {
          const unsub = outputSubs.get(removedOutput);
          if (unsub) {
            unsub();
            outputSubs.delete(removedOutput);
          }
        }

        for (const output of outputs) {
          if (outputSubs.has(output.name)) {
            continue;
          }

          const unsub = output.value.subscribeDirect((value) => {
            const nameRaw = output.name;
            const name = output.name.replace(`ext_`, ``) as WorkflowOutputName;
            console.log(
              `[subflowInstanceNodeType.execute.registerEvent.subscribeDirect] emitting value`,
              { name, nameRaw, value },
            );

            emit({
              [name]: value,
            });
          });
          outputSubs.set(output.name, unsub);
        }
      });

      return {
        unsubscribe: () => {
          for (const unsub of outputSubs.values()) {
            unsub();
          }
          outputSubs.clear();
        },
      };
    });

    // setup input subscriptions

    return {
      outputs: {},
    };
  },
};

type SubflowInstanceData = {
  url: string;
};

export const SubflowInstanceComponent = (
  props: WorkflowComponentSimplePropsTyped<
    SubflowInstanceData,
    Record<string, never>,
    Record<string, never>
  >,
) => {
  const { node$, data } = props.data;
  const data$ = data.asObservable();
  const url = useValue(data$.url) ?? '';

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    node$.data.get().setValue({
      url: newUrl,
    });
  };

  return (
    <div className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25 flex flex-col p-2">
      <span className="text-sm text-gray-400 mb-2">Subflow Instance</span>
      <div className="w-full">
        <label className="text-xs text-gray-500 block mb-1">URL Path:</label>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          className="w-full px-2 py-1 text-xs bg-black/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
          placeholder="/path/to/subflow"
        />
      </div>
    </div>
  );
};
