import { type Observable, observable, observe } from '@legendapp/state';
import { useObservable, useValue } from '@legendapp/state/react';
import { engineController$ } from '../../workflow/engine-controller';
import { NodeStandardContainer } from '../../workflow/node-types-wrapper';
import { createWorkflowStoreFromDocument } from '../../workflow/store-fast/create-runtime-store';
import { createWorkflowEngine } from '../../workflow/store-fast/engine-direct';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentSimplePropsTyped,
  type WorkflowDocumentData,
  type WorkflowOutputName,
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

type SubflowInstanceData = {
  url: string;
  autoLoad?: boolean;
  trigger?: number;
};

type RuntimeStateType = {
  shouldLoad?: boolean;
  subflowUrl?: string;
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
      },
    };
  },
  load: async ({ runtimeState, controller, store$, node$ }) => {
    const nodeUnsub = observe((e) => {
      console.log(
        `[subflowInstanceNodeType.load] 00 loading subflow instance node`,
        {
          event: e,
        },
      );
      const data =
        node$.data.peek() as WorkflowRuntimeValue<SubflowInstanceData>;
      const dataValue =
        data.getObservableBox() as Observable<SubflowInstanceData>;
      const autoLoad = dataValue.autoLoad.get();
      dataValue.trigger.get();

      const runtimeStateTyped = runtimeState as RuntimeStateType;

      const store = store$.peek();
      const nodeId = node$.id.peek();
      const getSubflowInputsAndOutputsNodes = () => {
        if (!runtimeStateTyped.runtimeStore$) {
          return {
            inputsNode$: undefined,
            outputsNode$: undefined,
          };
        }
        return {
          inputsNode$: Object.values(
            runtimeStateTyped.runtimeStore$.nodes,
          )?.find(
            (n: Observable<WorkflowRuntimeNode>) =>
              n.type.get() === WorkflowBrandedTypes.typeName(`subflow-inputs`),
          ) as Observable<WorkflowRuntimeNode | undefined>,
          outputsNode$: Object.values(
            runtimeStateTyped.runtimeStore$.nodes,
          )?.find(
            (n: Observable<WorkflowRuntimeNode>) =>
              n.type.get() === WorkflowBrandedTypes.typeName(`subflow-outputs`),
          ) as Observable<WorkflowRuntimeNode | undefined>,
        };
      };

      const updateInputsAndOutputs = () => {
        const subflowNodes = getSubflowInputsAndOutputsNodes();
        const inputsNode = subflowNodes.inputsNode$?.get();
        const outputsNode = subflowNodes.outputsNode$?.get();

        console.log(
          `[subflowInstanceNodeType.load.updateInputsAndOutputs] updating inputs and outputs for subflow instance node ${nodeId}`,
          {
            inputsNode,
            outputsNode,
            runtimeStateTyped,
            runtimeStore$: runtimeStateTyped.runtimeStore$?.peek(),
          },
        );

        store.actions.updateInputs(nodeId, [
          ...(data.getDirectValue()?.autoLoad
            ? []
            : [
                {
                  name: WorkflowBrandedTypes.inputName(`loadTrigger`),
                  type: WorkflowBrandedTypes.valueType(`unknown`),
                },
              ]),
          ...(inputsNode?.outputs.map((field) => ({
            name: WorkflowBrandedTypes.inputName(field.name),
            type: WorkflowBrandedTypes.valueType(field.type),
          })) ?? node$.inputs.peek().filter((x) => x.name !== 'loadTrigger')),
        ]);

        store.actions.updateOutputs(
          nodeId,
          outputsNode?.inputs?.map((field) => ({
            name: WorkflowBrandedTypes.outputName(field.name),
            type: WorkflowBrandedTypes.valueType(field.type),
          })) ?? node$.outputs.peek(),
        );

        console.log(
          `[subflowInstanceNodeType.load.updateInputsAndOutputs] updated inputs and outputs ${nodeId}`,
          {
            inputs: node$
              .peek()
              .inputs.map((x) => x.name)
              .join(', '),
            outputs: node$
              .peek()
              .outputs.map((x) => x.name)
              .join(', '),
            runtimeStateTyped,
            runtimeStore$: runtimeStateTyped.runtimeStore$?.peek(),
          },
        );
      };
      updateInputsAndOutputs();

      const shouldLoad = runtimeStateTyped.shouldLoad;
      if (!autoLoad && !shouldLoad) {
        console.log(
          `[subflowInstanceNodeType.load] not auto loading subflow (autoLoad: ${autoLoad}, shouldLoad: ${shouldLoad})`,
        );
        return;
      }
      console.log(
        `[subflowInstanceNodeType.load] 01 loading (autoLoad: ${autoLoad}, shouldLoad: ${shouldLoad})`,
      );

      const url = dataValue.url.get();
      if (!url) {
        console.warn(`[subflowInstanceNodeType.load] no subflow URL defined`, {
          nodeId: node$.id.peek(),
          data: node$.data.peek(),
        });
        return undefined;
      }

      if (runtimeStateTyped.subflowUrl === url) {
        console.warn(`[subflowInstanceNodeType.load] subflow URL unchanged`, {
          nodeId: node$.id.peek(),
          url,
        });
        return;
      }

      if (runtimeStateTyped.subflowUrl) {
        console.log(
          `[subflowInstanceNodeType.load] subflow URL changed from ${runtimeStateTyped.subflowUrl} to ${url}`,
        );
        runtimeStateTyped.unsubs.forEach((unsub) => {
          unsub();
        });
        runtimeStateTyped.storeEngine?.stop({ shouldAbort: true });
        runtimeStateTyped.runtimeStore$ = undefined;
        runtimeStateTyped.storeEngine = undefined;
        runtimeStateTyped.subflowUrl = undefined;
      }
      runtimeStateTyped.subflowUrl = url;

      console.log(`[subflowInstanceNodeType.load] 02 preparing unsubs`);

      runtimeStateTyped.unsubs = [];
      const unsubs = {
        set addUnsubFun(item: () => void) {
          runtimeStateTyped.unsubs.push(item);
        },
        set addUnsubObj(item: { unsubscribe: () => void }) {
          runtimeStateTyped.unsubs.push(item.unsubscribe);
        },
      };

      console.log(`[subflowInstanceNodeType.load] 02b checking url protocol`, {
        url,
      });

      // setup subflow store and engine
      if (!url.toLowerCase().startsWith(`@localstorage/`)) {
        console.log(
          'Only localhost subflow URLs are supported in this version.',
        );
        return;
        // throw new Error(
        //   'Only localhost subflow URLs are supported in this version.',
        // );
      }

      console.log(
        `[subflowInstanceNodeType.load] 03 setup subflow store from ${url}`,
      );

      const localStorageKey = `ksub-${url.substring(`@localstorage/`.length)}`;

      const storeDoc = (() => {
        try {
          return JSON.parse(
            localStorage.getItem(localStorageKey) || ``,
          ) as WorkflowDocumentData;
        } catch (err) {
          console.error(
            `[subflowInstanceNodeType.load] Error parsing stored workflow document`,
            {
              localStorageKey,
              err,
            },
          );
        }
        return;
      })();

      console.log(
        `[subflowInstanceNodeType.load] 04 creating store from document: `,
        {},
      );

      runtimeStateTyped.runtimeStore$ = createWorkflowStoreFromDocument(
        storeDoc ?? {
          nodes: [],
        },
      );
      console.log(
        `[subflowInstanceNodeType.load] 05 created store from document: `,
        {
          runtimeStore$: runtimeStateTyped.runtimeStore$.peek(),
        },
      );

      unsubs.addUnsubFun = observe(() => {
        updateInputsAndOutputs();
      });

      console.log(`[subflowInstanceNodeType.load] 06 updatedInputsAndOutputs`, {
        runtimeStore$: runtimeStateTyped.runtimeStore$.peek(),
      });

      const storeEngine = createWorkflowEngine(runtimeStateTyped.runtimeStore$);
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
        `[subflowInstanceNodeType.load] 07 created subflow runtime engine: `,
        {
          storeEngine,
        },
      );

      unsubs.addUnsubFun = observe(() => {
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

      console.log(`[subflowInstanceNodeType.load] 08 setup engine controls: `, {
        runtimeStore$: runtimeStateTyped.runtimeStore$.peek(),
        storeEngine,
      });

      // setup output subscriptions
      unsubs.addUnsubObj = controller.registerEvent((emit) => {
        const outputSubs = new Map<WorkflowOutputName, () => void>();

        const mainUnsub = observe(() => {
          const subflowOutputsNode$ =
            getSubflowInputsAndOutputsNodes().outputsNode$;
          const subflowOutputsNode = subflowOutputsNode$?.get();
          if (!subflowOutputsNode$ || !subflowOutputsNode) {
            console.error(
              `[subflowInstanceNodeType.load.registerEvent.observe] no subflowOutputsNode`,
              {
                subflowOutputsNode,
                subflowOutputsNode$,
                runtimeStore$: runtimeStateTyped.runtimeStore$?.peek(),
              },
            );

            return;
          }

          const outputs = subflowOutputsNode$.outputs.map((output) =>
            output.get(),
          );

          console.log(
            `[subflowInstanceNodeType.load.registerEvent.observe] outputs: `,
            { outputs },
          );

          const removedOutputs = [...outputSubs.keys()].filter(
            (outputName) =>
              !outputs.find((output) => output.name === outputName),
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
              const name = output.name.replace(
                `ext_`,
                ``,
              ) as WorkflowOutputName;
              console.log(
                `[subflowInstanceNodeType.load.registerEvent.observe.subscribeDirect] emitting value`,
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
            mainUnsub();
            for (const unsub of outputSubs.values()) {
              unsub();
            }
            outputSubs.clear();
          },
        };
      });

      // setup input subscriptions
      unsubs.addUnsubFun = observe(() => {
        const inputs = node$.inputs.get();
        const inputValues = inputs
          .map((x) => x.value.getObservableBox() as Observable<unknown>)
          .map((o) => o.get());
        const subflowInputsNode$ =
          getSubflowInputsAndOutputsNodes().inputsNode$;
        const subflowInputsNode = subflowInputsNode$?.get();
        if (!subflowInputsNode$ || !subflowInputsNode) {
          console.error(
            `[subflowInstanceNodeType.load.observe] no subflowInputsNode to provide inputs`,
            {
              subflowInputsNode,
              subflowInputsNode$,
              runtimeStore$: runtimeStateTyped.runtimeStore$?.peek(),
            },
          );
          return;
        }

        inputs.forEach((input, index) => {
          if (input.name === `loadTrigger`) {
            return;
          }

          const subflowInput = subflowInputsNode?.inputs.find(
            (n) => n.name === `default_${input.name}`,
          );
          if (!subflowInputsNode || !subflowInput) {
            console.error(
              `[subflowInstanceNodeType.load.observe] no subflowInput found for input '${input.name}'`,
              {
                subflowInputs: subflowInputsNode?.inputs,
              },
            );
            return;
          }
          const subRuntimeState =
            subflowInputsNode.runtimeState as WorkflowRuntimeValue<SubflowInputsRuntimeData>;
          const r = subRuntimeState.getDirectValue() ?? {};
          if (!subRuntimeState.getDirectValue()) {
            subRuntimeState.setValue(r);
          }

          r.injectedInputs = r.injectedInputs || {};
          r.injectedInputs[input.name] = inputValues[index];
        });

        // trigger an execute on the subflow engine by changing the data
        (
          subflowInputsNode?.data.getObservableBox() as Observable<SubflowInputsData>
        ).__trigger.set(Math.random());
      });
    });

    return {
      unsubscribe: nodeUnsub,
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

  const urlInput$ = useObservable(data$.url.peek());
  const urlInput = useValue(urlInput$) ?? '';

  const autoLoad = useValue(data$.autoLoad) ?? false;

  const handleLoadPress = () => {
    const newUrl = urlInput$.peek();
    node$.data.get().setValue({
      url: newUrl,
    });
  };
  const handleOpenPress = () => {
    const docUrl = urlInput$.peek();
    const localStorageKey = docUrl.replace(`@localStorage/`, `ksub-`);
    const doc = localStorage.getItem(localStorageKey);
    if (!doc) {
      console.error(`No subflow found at ${docUrl}`);
      return;
    }

    const mainDoc = localStorage.getItem(`klivcore-workflow-document`) ?? ``;
    localStorage.setItem(`${localStorageKey}-RETURN`, mainDoc);
    localStorage.setItem(`klivcore-workflow-document`, doc);
    window.location.reload();
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
        </div>
      </div>
    </div>
  );
};
