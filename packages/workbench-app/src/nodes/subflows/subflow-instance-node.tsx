import {
  observable,
  type Observable,
  ObservableHint,
  observe,
  type OpaqueObject,
} from '@legendapp/state';
import { useObservable, useValue } from '@legendapp/state/react';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowDocumentData,
  type WorkflowRuntimeEngine,
  type WorkflowRuntimeNode,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowRuntimeStore,
  type WorkflowRuntimeValue,
} from '../../workflow/types';
import type {
  SubflowInputsData,
  SubflowInputsRuntimeData,
} from './subflow-inputs-node';
import { workflowTreeStore$ } from '../../workflow/workflow-tree';

type SubflowInstanceData = {
  url: string;
  autoLoad?: boolean;
  isLoaded?: boolean;
  shouldLoad?: boolean;
};

type RuntimeStateType = {
  shouldLoad?: boolean;
  subflowUrl?: string;
  dataTrigger?: number;
  runtimeStore$?: Observable<WorkflowRuntimeStore>;
  storeEngine?: WorkflowRuntimeEngine;
  unsubs: Array<() => void>;
};

export const subflowInstanceNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-instance`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInstanceComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async ({ runtimeState, data, inputs }) => {
    if (data?.autoLoad) {
      console.log(
        `[subflowInstanceNodeType.execute] autoLoad is enabled, skipping execute`,
      );

      return;
    }
    if (inputs.loadTrigger == null) {
      console.log(
        `[subflowInstanceNodeType.execute] loadTrigger is not active, skipping execute`,
      );
      return;
    }
    if (runtimeState.shouldLoad) {
      console.log(
        `[subflowInstanceNodeType.execute] subflow is already marked to load, skipping execute`,
      );
      return;
    }

    console.log(`[subflowInstanceNodeType.execute] marking subflow to load`);

    runtimeState.shouldLoad = true;
    return {
      outputs: {},
      data: {
        ...data,
        trigger: Math.random(),
        shouldLoad: true,
      },
    };
  },
  load: async ({ runtimeState, controller, store$, node$ }) => {
    const data = node$.data.peek() as WorkflowRuntimeValue<SubflowInstanceData>;
    const dataValue$ =
      data.getObservableBox() as Observable<SubflowInstanceData>;
    dataValue$.isLoaded.set(false);

    const structure$ = observable({
      subflowStoreAndEngine$: undefined as
        | undefined
        | OpaqueObject<
            ReturnType<typeof workflowTreeStore$.actions.createSubflow>
          >,
      subflowInputsNode$: undefined as undefined | WorkflowRuntimeNode,
      subflowOutputsNode$: undefined as undefined | WorkflowRuntimeNode,
    });

    const subflowStoreSub = observe(async (e) => {
      const autoLoad = dataValue$.autoLoad.get();
      const shouldLoad = dataValue$.shouldLoad.get();
      if (!autoLoad && !shouldLoad) {
        console.log(
          `[subflowInstanceNodeType.load.structureSub] not auto loading subflow (autoLoad: ${autoLoad}, shouldLoad: ${shouldLoad})`,
        );
        return;
      }
      const url = dataValue$.url.get();
      if (!url) {
        console.warn(
          `[subflowInstanceNodeType.load.structureSub] no subflow URL defined`,
        );
        structure$.subflowStoreAndEngine$.set(undefined);
        return;
      }

      console.log(`[subflowInstanceNodeType.load.subflowStoreSub] 00`, {
        event: e,
      });

      dataValue$.isLoaded.set(true);

      console.log(
        `[subflowInstanceNodeType.load.structureSub] loading (autoLoad: ${autoLoad}, shouldLoad: ${shouldLoad})`,
        { e, url, nodeId: node$.peek().id },
      );

      let unsubStore = () => {};
      setTimeout(() => {
        const workflowStoreAndEngine = workflowTreeStore$.actions.createSubflow(
          {
            documentUrl: url,
          },
        );
        const runtimeStateTyped = runtimeState as RuntimeStateType;
        runtimeStateTyped.runtimeStore$ = workflowStoreAndEngine.runtimeStore$;
        structure$.subflowStoreAndEngine$.set(
          ObservableHint.opaque(workflowStoreAndEngine),
        );
        unsubStore = () => workflowStoreAndEngine.unsubscribe();
      });

      return () => {
        unsubStore();
      };
    });

    const subflowNodesSub = observe((e) => {
      const subflowStore = structure$.subflowStoreAndEngine$
        .get()
        ?.runtimeStore$.get();
      if (!subflowStore || !Object.values(subflowStore.nodes).length) {
        structure$.subflowInputsNode$.set(undefined);
        structure$.subflowOutputsNode$.set(undefined);
        return;
      }

      console.log(`[subflowInstanceNodeType.load.subflowNodesSub] 01`, {
        event: e,
      });

      const inputsNode = Object.values(subflowStore.nodes).find(
        (n) => n.type === WorkflowBrandedTypes.typeName(`subflow-inputs`),
      );
      const outputsNode = Object.values(subflowStore.nodes).find(
        (n) => n.type === WorkflowBrandedTypes.typeName(`subflow-outputs`),
      );

      structure$.subflowInputsNode$.set(inputsNode);
      structure$.subflowOutputsNode$.set(outputsNode);

      console.log(`[subflowInstanceNodeType.load.subflowNodesSub] 01 DONE`, {
        event: e,
        subflowStore,
        inputsNode,
        outputsNode,
        inputsNode$: structure$.subflowInputsNode$.peek(),
        outputsNode$: structure$.subflowOutputsNode$.peek(),
      });
    });

    const instanceInputsSub = observe(async (e) => {
      const inputsNode$ = structure$.subflowInputsNode$;
      const inputsNodeId = inputsNode$?.id.get();
      if (!inputsNode$ || !inputsNodeId) {
        return;
      }

      const store = structure$.subflowStoreAndEngine$
        .peek()
        ?.runtimeStore$.peek();
      if (!store) {
        return;
      }

      console.log(`[subflowInstanceNodeType.load.instanceInputsSub] 02a`, {
        event: e,
      });

      const internalInputs =
        inputsNode$.outputs.map((field) => ({
          name: WorkflowBrandedTypes.inputName(field.name.get()),
          type: field.type.get(),
          runtimeValue: field.value.get(),
        })) ?? [];

      setTimeout(() => {
        store.actions.updateInputs(inputsNodeId, [
          ...(data.getDirectValue()?.autoLoad
            ? []
            : [
                {
                  name: WorkflowBrandedTypes.inputName(`loadTrigger`),
                  type: WorkflowBrandedTypes.valueType(`unknown`),
                },
              ]),
          ...(internalInputs.map((f) => ({
            name: f.name,
            type: f.type,
          })) ?? node$.inputs.peek().filter((x) => x.name !== 'loadTrigger')),
        ]);
      });

      // value subscriptions
      const directSubs = [] as Array<() => void>;
      // const internalRuntimeState =
      //   inputsNode$.runtimeState.peek() as SubflowInputsRuntimeData;
      // const internalNodeData$ = inputsNode$?.data?.peek()?.getObservableBox() as
      //   | undefined
      //   | Observable<SubflowInputsData>;

      // if (!internalNodeData$) {
      //   console.error(
      //     `[subflowInstanceNodeType.load.instanceInputsSub] 02a No internal node data observable found`,
      //     {
      //       inputsNode$: inputsNode$,
      //     },
      //   );
      //   return;
      // }

      for (const inputField of internalInputs) {
        const externalInput = node$.inputs
          .peek()
          ?.find((x) => x.name === inputField.name);
        if (!externalInput) {
          continue;
        }

        // const internalInputRuntimeValue = inputsNode$
        //   .peek()
        //   ?.inputs.find((x) => x.name === inputField.name)?.value;
        // if (!internalInputRuntimeValue) {
        //   console.error(
        //     `[subflowInstanceNodeType.load.instanceInputsSub] 02a No internal input runtime value found for field ${inputField.name}`,
        //     {
        //       inputsNode$: inputsNode$,
        //       inputField,
        //     },
        //   );
        //   continue;
        // }

        // if (!internalRuntimeState.injectedInputs) {
        //   internalRuntimeState.injectedInputs = {};
        // }
        // const injectedInputs = internalRuntimeState.injectedInputs;

        directSubs.push(
          externalInput.value.subscribeDirect((v) => {
            console.log(
              `[subflowInstanceNodeType.load.instanceInputsSub] setting injected input value for field ${inputField.name}`,
              { v },
            );

            inputField.runtimeValue.setValue(v);

            // injectedInputs[inputField.name] = {
            //   changeCounter: externalInput.value.getImmediateChangeCounter(),
            //   value: v,
            // };
            // internalInputRuntimeValue.setValue(v);
            // inputsNode$.inputs
            // // TEMP
            // setTimeout(() => {
            //   internalNodeData$._trigger.set(
            //     (internalNodeData$._trigger.get() ?? 0) + 1,
            //   );
            // });
          }),
        );
      }

      return () => {
        directSubs.forEach((unsub) => {
          unsub();
        });
      };
    });

    const instanceOutputsSub = observe(async (e) => {
      const outputsNode$ = structure$.subflowOutputsNode$;
      const outputsNodeId = outputsNode$?.id.get();
      if (!outputsNode$ || !outputsNodeId) {
        return;
      }

      const store = structure$.subflowStoreAndEngine$
        .peek()
        ?.runtimeStore$.peek();
      if (!store) {
        return;
      }

      console.log(`[subflowInstanceNodeType.load.instanceOutputsSub] 02b`, {
        event: e,
      });

      const internalOutputs = outputsNode$.inputs.map((field) => ({
        name: WorkflowBrandedTypes.outputName(field.name.get()),
        type: field.type.get(),
        runtimeValue: field.value.get(),
      }));

      setTimeout(() => {
        store.actions.updateOutputs(outputsNodeId, [
          ...(outputsNode$?.outputs.map((field) => ({
            name: field.name.get(),
            type: field.type.get(),
          })) ?? node$.outputs.peek()),
        ]);
      });

      // value subscriptions
      const directSubs = [] as Array<() => void>;

      for (const outputField of internalOutputs) {
        const externalOutput = node$.outputs
          .peek()
          ?.find((x) => x.name === outputField.name);
        if (!externalOutput) {
          continue;
        }

        directSubs.push(
          outputField.runtimeValue.subscribeDirect((v) => {
            console.log(
              `[subflowInstanceNodeType.load.instanceOutputsSub] setting external output value for field ${outputField.name}`,
              { v },
            );

            externalOutput.value.setValue(v);
          }),
        );
      }

      return () => {
        directSubs.forEach((unsub) => {
          unsub();
        });
      };
    });

    return {
      unsubscribe: () => {
        subflowStoreSub?.();
        subflowNodesSub?.();
        instanceInputsSub?.();
        instanceOutputsSub?.();
      },
    };
  },
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

  const runtimeStateTyped = useValue(
    () => node$.runtimeState.get().getDirectValue() as RuntimeStateType,
  );
  const isLoaded =
    useValue(
      () => data$.isLoaded.get() && runtimeStateTyped.runtimeStore$?.get(),
    ) ?? false;

  const urlInput$ = useObservable(data$.url.peek());
  const urlInput = useValue(urlInput$) ?? '';

  const autoLoad = useValue(data$.autoLoad) ?? false;

  const handleLoadPress = () => {
    const newUrl = urlInput$.peek();
    data$.url.set(newUrl);
    data$.shouldLoad.set(true);
  };
  const handleOpenPress = () => {
    const s = runtimeStateTyped.runtimeStore$?.peek();
    if (!s) {
      console.error(
        `[SubflowInstanceComponent.handleOpenPress] no runtime store to open subflow with`,
        {
          runtimeStateTyped,
        },
      );
      return;
    }
    workflowTreeStore$.actions.openSubflow(s);
  };
  const handleCreatePress = () => {
    const newUrl = urlInput$.peek();
    const localStorageKey = newUrl.replace(`@localStorage/`, `ksub-`);
    const newDoc: WorkflowDocumentData = {
      nodes: [],
    };
    localStorage.setItem(localStorageKey, JSON.stringify(newDoc));
    handleOpenPress();
  };

  return (
    <div className="w-full h-full text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25 flex flex-col p-2">
      <span className="text-sm text-gray-400">Subflow Instance</span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 block mb-1">URL Path:</label>
          <input
            type="text"
            value={urlInput}
            onChange={(x) => urlInput$.set(x.target.value)}
            className="w-full px-2 py-1 text-xs bg-black/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            placeholder="/path/to/subflow"
          />
        </div>
        <div className="flex flex-row items-center justify-between gap-1">
          <div className="flex flex-row items-center justify-start gap-1">
            <input
              type="checkbox"
              checked={autoLoad}
              onChange={(x) => {
                data$.autoLoad.set(x.target.checked);
              }}
              className="text-xs"
            />
            <label className="text-xs">Auto Load</label>
          </div>
          <div className="flex flex-row gap-1 items-center text-xs">
            <div
              className={`rounded-full w-2 h-2 border ${isLoaded ? 'bg-green-500 border-green-700' : 'bg-red-500 border-red-700'}`}
            ></div>
            <span>{isLoaded ? `Loaded` : 'Unloaded'}</span>
          </div>
        </div>
        <div className="flex flex-row justify-end gap-1">
          <button
            onClick={handleLoadPress}
            className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
          >
            Load
          </button>
          <button
            onClick={handleCreatePress}
            className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
          >
            Create
          </button>
          <button
            onClick={handleOpenPress}
            className={`mt-2 px-3 py-1  text-white text-xs rounded ${isLoaded ? `bg-green-600 hover:bg-green-700` : 'bg-gray-600 cursor-not-allowed'} `}
            disabled={!isLoaded}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
};
