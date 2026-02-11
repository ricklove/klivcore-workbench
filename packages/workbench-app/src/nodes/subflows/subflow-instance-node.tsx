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
import { workflowTreeStore$ } from '../../workflow/workflow-tree';
import type { SubflowOutputsData } from './subflow-outputs-node';
import type { SubflowInputsData } from './subflow-inputs-node';
import { storageStore$ } from '../storage/_storage-store';

type SubflowInstanceData = {
  url: string;
  autoLoad?: boolean;
};

type RuntimeStateType = {
  runtimeStore$?: Observable<WorkflowRuntimeStore>;
  isLoaded$: Observable<boolean>;
  shouldLoad$: Observable<boolean>;
};

export const subflowInstanceNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-instance`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInstanceComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async ({ runtimeState, data, inputs, node }) => {
    const runtimeStateTyped = runtimeState as RuntimeStateType;

    if (data?.autoLoad) {
      console.log(
        `[${node.id}.subflowInstanceNodeType.execute] autoLoad is enabled, skipping execute`,
      );

      return;
    }
    if (inputs.loadTrigger == null) {
      console.log(
        `[${node.id}.subflowInstanceNodeType.execute] loadTrigger is not active, skipping execute`,
      );
      return;
    }
    if (runtimeStateTyped.shouldLoad$.peek()) {
      console.log(
        `[${node.id}.subflowInstanceNodeType.execute] subflow is already marked to load, skipping execute`,
      );
      return;
    }

    console.log(
      `[${node.id}.subflowInstanceNodeType.execute] marking subflow to load`,
    );

    runtimeStateTyped.shouldLoad$.set(true);
    return {
      outputs: {},
    };
  },
  load: async ({ runtimeState, store$, node$ }) => {
    const runtimeStateTyped = runtimeState as RuntimeStateType;
    runtimeStateTyped.isLoaded$ = observable(false);
    runtimeStateTyped.shouldLoad$ = observable(false);

    const data = node$.data.peek() as WorkflowRuntimeValue<SubflowInstanceData>;
    const dataValue$ =
      data.getObservableBox() as Observable<SubflowInstanceData>;

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
      const shouldLoad = runtimeStateTyped.shouldLoad$.get();
      if (!autoLoad && !shouldLoad) {
        console.log(
          `[${node$.id.peek()}.subflowInstanceNodeType.load.subflowStoreSub] not auto loading subflow (autoLoad: ${autoLoad}, shouldLoad: ${shouldLoad})`,
        );
        return;
      }
      const url = dataValue$.url.get();
      if (!url) {
        console.warn(
          `[${node$.id.peek()}.subflowInstanceNodeType.load.subflowStoreSub] no subflow URL defined`,
        );
        structure$.subflowStoreAndEngine$.set(undefined);
        return;
      }

      const { provider } =
        storageStore$.getProviderWithPath(dataValue$.url.get()) ?? {};
      const providerPrefix = provider?.prefix.get();

      console.log(
        `[${node$.id.peek()}.subflowInstanceNodeType.load.subflowStoreSub] 00 loading (autoLoad: ${autoLoad}, shouldLoad: ${shouldLoad}, provider: ${providerPrefix})`,
        { e, url, nodeId: node$.peek().id, provider },
      );

      let unsubStore = () => {};
      setTimeout(() => {
        const workflowStoreAndEngine = workflowTreeStore$.actions.createSubflow(
          {
            documentUrl: url,
          },
        );
        runtimeStateTyped.runtimeStore$ = workflowStoreAndEngine.runtimeStore$;
        structure$.subflowStoreAndEngine$.set(
          ObservableHint.opaque(workflowStoreAndEngine),
        );

        console.log(
          `[${node$.id.peek()}.subflowInstanceNodeType.load.subflowStoreSub] 01 loaded subflow store and engine`,
          {
            workflowStoreAndEngine,
            runtimeStateTyped,
          },
        );

        unsubStore = () => workflowStoreAndEngine.unsubscribe();
      });

      return () => {
        unsubStore();
      };
    });

    const autoLoadSub = observe(() => {
      const autoLoad = dataValue$.autoLoad.get();

      // setTimeout(() => {
      const loadTrigger = node$.inputs
        .peek()
        ?.find((x) => x.name === 'loadTrigger');
      if (loadTrigger && !autoLoad) {
        return;
      }
      if (!loadTrigger && autoLoad) {
        return;
      }

      store$.actions.updateInputs(node$.id.peek(), [
        ...(autoLoad
          ? []
          : [
              {
                name: WorkflowBrandedTypes.inputName(`loadTrigger`),
                type: WorkflowBrandedTypes.valueType(`unknown`),
              },
            ]),
        ...node$.inputs.peek().filter((x) => x.name !== 'loadTrigger'),
      ]);
      console.log(
        `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub.updateInputs] updated instance inputs on node with internal inputs:`,
        {
          nodeInputs: node$.inputs.peek(),
        },
      );
      // });
    });

    const subflowNodesSub = observe((e) => {
      const subflowStore$ =
        structure$.subflowStoreAndEngine$.get()?.runtimeStore$;

      const subflowStore = subflowStore$?.peek();
      const _storeInstanceId = subflowStore$?._instanceId.get();

      if (!subflowStore || !Object.values(subflowStore.nodes).length) {
        structure$.subflowInputsNode$.set(undefined);
        structure$.subflowOutputsNode$.set(undefined);
        return;
      }

      // if (
      //   structure$.subflowInputsNode$.peek() &&
      //   structure$.subflowOutputsNode$.peek()
      // ) {
      //   return;
      // }

      console.log(
        `[${node$.id.peek()}.subflowInstanceNodeType.load.subflowNodesSub] 01`,
        {
          event: e,
        },
      );

      const inputsNode = Object.values(subflowStore.nodes).find(
        (n) => n.type === WorkflowBrandedTypes.typeName(`subflow-inputs`),
      );
      const outputsNode = Object.values(subflowStore.nodes).find(
        (n) => n.type === WorkflowBrandedTypes.typeName(`subflow-outputs`),
      );

      structure$.subflowInputsNode$.set(inputsNode);
      structure$.subflowOutputsNode$.set(outputsNode);

      runtimeStateTyped.isLoaded$.set(true);

      console.log(
        `[${node$.id.peek()}.subflowInstanceNodeType.load.subflowNodesSub] 01 DONE`,
        {
          event: e,
          subflowStore,
          inputsNode,
          outputsNode,
          inputsNode$: structure$.subflowInputsNode$.peek(),
          outputsNode$: structure$.subflowOutputsNode$.peek(),
        },
      );
    });

    const instanceInputsSub = observe(async (e) => {
      const inputsNode$ = structure$.subflowInputsNode$;
      const inputsNodeId = inputsNode$?.id.get();
      if (!inputsNode$ || !inputsNodeId || !inputsNode$.get()) {
        console.log(
          `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub] !02a no inputs node found, skipping instance inputs subscription`,
          {
            event: e,
          },
        );
        return;
      }

      const subflowStore = structure$.subflowStoreAndEngine$
        .peek()
        ?.runtimeStore$.peek();
      if (!subflowStore) {
        return;
      }

      console.log(
        `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub] 02a`,
        {
          event: e,
        },
      );

      const internalInputFields = (
        inputsNode$.data
          .peek()
          ?.getObservableBox() as Observable<SubflowInputsData>
      ).fields
        .get()
        .map((field) => ({
          name: WorkflowBrandedTypes.inputName(field.name),
          type: WorkflowBrandedTypes.valueType(field.type),
        }));

      setTimeout(() => {
        store$.actions.updateInputs(node$.id.peek(), [
          ...(data.getDirectValue()?.autoLoad
            ? []
            : [
                {
                  name: WorkflowBrandedTypes.inputName(`loadTrigger`),
                  type: WorkflowBrandedTypes.valueType(`unknown`),
                },
              ]),
          ...(internalInputFields.map((f) => ({
            name: f.name,
            type: f.type,
          })) ?? node$.inputs.peek().filter((x) => x.name !== 'loadTrigger')),
        ]);
        console.log(
          `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub.updateInputs] updated instance inputs on node with internal inputs:`,
          {
            internalInputFields,
            nodeInputs: node$.inputs.peek(),
          },
        );
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
      //     `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub] 02a No internal node data observable found`,
      //     {
      //       inputsNode$: inputsNode$,
      //     },
      //   );
      //   return;
      // }

      for (const inputField of internalInputFields) {
        const externalInput = node$.inputs
          .peek()
          ?.find((x) => x.name === inputField.name);
        if (!externalInput) {
          continue;
        }

        // actually set inputs` output values
        const internalInputRuntimeValue = inputsNode$
          .peek()
          ?.outputs.find(
            (x) => x.name === WorkflowBrandedTypes.outputName(inputField.name),
          )?.value;
        if (!internalInputRuntimeValue) {
          console.error(
            `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub] 02a No internal input runtime value found for field ${inputField.name}`,
            {
              inputsNode$: inputsNode$,
              inputField,
            },
          );
          continue;
        }

        directSubs.push(
          externalInput.value.subscribeDirect((v) => {
            console.log(
              `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceInputsSub] setting injected input value for field ${inputField.name}`,
              { v },
            );

            internalInputRuntimeValue.setValue(v);
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
      if (!outputsNode$ || !outputsNodeId || !outputsNode$.get()) {
        console.log(
          `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceOutputsSub] !02b no outputs node found, skipping instance outputs subscription`,
          {
            event: e,
          },
        );
        return;
      }

      const subflowStore = structure$.subflowStoreAndEngine$
        .peek()
        ?.runtimeStore$.peek();
      if (!subflowStore) {
        return;
      }

      console.log(
        `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceOutputsSub] 02b`,
        {
          event: e,
        },
      );

      const internalOutputFields = (
        outputsNode$.data
          .peek()
          ?.getObservableBox() as Observable<SubflowOutputsData>
      ).fields
        .get()
        .map((field) => ({
          name: WorkflowBrandedTypes.outputName(field.name),
          type: WorkflowBrandedTypes.valueType(field.type),
        }));

      setTimeout(() => {
        store$.actions.updateOutputs(node$.id.peek(), [
          ...(internalOutputFields.map((field) => ({
            name: field.name,
            type: field.type,
          })) ?? node$.outputs.peek()),
        ]);
      });

      // value subscriptions
      const directSubs = [] as Array<() => void>;

      for (const outputField of internalOutputFields) {
        const externalOutput = node$.outputs
          .peek()
          ?.find((x) => x.name === outputField.name);
        if (!externalOutput) {
          continue;
        }

        const internalOutputRuntimeValue = outputsNode$
          .peek()
          ?.inputs.find(
            (x) => x.name === WorkflowBrandedTypes.inputName(outputField.name),
          )?.value;
        if (!internalOutputRuntimeValue) {
          console.error(
            `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceOutputsSub] 02b No internal output runtime value found for field ${outputField.name}`,
            {
              outputsNode$: outputsNode$,
              outputField,
            },
          );
          continue;
        }

        directSubs.push(
          internalOutputRuntimeValue.subscribeDirect((v) => {
            console.log(
              `[${node$.id.peek()}.subflowInstanceNodeType.load.instanceOutputsSub] setting external output value for field ${outputField.name}`,
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
        autoLoadSub?.();
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
      () =>
        runtimeStateTyped.isLoaded$.get() &&
        runtimeStateTyped.runtimeStore$?.get(),
    ) ?? false;

  const urlInput$ = useObservable(data$.url.peek());
  const urlInput = useValue(urlInput$) ?? '';

  const autoLoad = useValue(data$.autoLoad) ?? false;

  const handleLoadPress = () => {
    const newUrl = urlInput$.peek();
    if (data$.url.peek() !== newUrl) {
      data$.url.set(newUrl);
    }
    runtimeStateTyped.shouldLoad$.set(true);
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
