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
  type WorkflowRuntimeValue,
} from '../../workflow/types';
import { createWorkflowStoreFromDocument } from '../../workflow/store-fast/create-runtime-store';
import { observable, observe, type Observable } from '@legendapp/state';
import { createWorkflowEngine } from '../../workflow/store-fast/engine-direct';
import { engineController$ } from '../../workflow/engine-controller';
import type {
  SubflowInputsData,
  SubflowInputsRuntimeData,
} from './subflow-inputs-node';

type RuntimeStateType = {
  subflowUrl?: string;
  runtimeStore$?: Observable<WorkflowRuntimeStore>;
  storeEngine?: WorkflowRuntimeEngine;
  subflowNodes$?: Observable<{
    inputsNode: WorkflowRuntimeNode | undefined;
    outputsNode: WorkflowRuntimeNode | undefined;
  }>;
  unsubs: Array<() => void>;
};

export const subflowInstanceNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`subflow-instance`),
  getComponent: () => ({
    Component: NodeStandardContainer(SubflowInstanceComponent),
  }),
  inputs: [],
  outputs: [],
  execute: async () => {
    return undefined;
  },
  load: async ({ runtimeState, controller, store$, node$ }) => {
    const nodeUnsub = observe(() => {
      const data =
        node$.data.get() as WorkflowRuntimeValue<SubflowInstanceData>;
      const dataValue =
        data.getObservableBox() as Observable<SubflowInstanceData>;
      const url = dataValue.url.get();
      if (!url) {
        console.warn(`[subflowInstanceNodeType.load] no subflow URL defined`, {
          nodeId: node$.id.peek(),
          data: node$.data.peek(),
        });
        return undefined;
      }

      const runtimeStateTyped = runtimeState as RuntimeStateType;

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
        runtimeStateTyped.subflowNodes$ = undefined;
        runtimeStateTyped.subflowUrl = undefined;
      }

      runtimeStateTyped.subflowUrl = url;
      runtimeStateTyped.unsubs = [];
      const unsubs = {
        set addUnsubFun(item: () => void) {
          runtimeStateTyped.unsubs.push(item);
        },
        set addUnsubObj(item: { unsubscribe: () => void }) {
          runtimeStateTyped.unsubs.push(item.unsubscribe);
        },
      };

      // setup subflow store and engine
      if (!url.startsWith(`@localhost/`)) {
        console.log(
          'Only localhost subflow URLs are supported in this version.',
        );
        throw new Error(
          'Only localhost subflow URLs are supported in this version.',
        );
      }

      console.log(
        `[subflowInstanceNodeType.load] setup subflow store from ${url}`,
      );

      const localStorageKey = url.replace(`@localhost/`, `ksub-`);

      const storeDoc = (() => {
        try {
          return JSON.parse(
            localStorage.getItem(localStorageKey) || ``,
          ) as WorkflowDocumentData;
        } catch (err) {
          console.error(
            `[subflowInstanceNodeType.load] Error parsing stored workflow document`,
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
        `[subflowInstanceNodeType.load] created subflow runtime store and engine: `,
        {
          runtimeStore$,
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

      console.log(`[subflowInstanceNodeType.load] setup engine controls: `, {
        runtimeStore$,
        storeEngine,
      });

      // setup inputs and outputs
      runtimeStateTyped.subflowNodes$ = observable({
        inputsNode: Object.values(runtimeStore$.nodes)
          ?.find(
            (n: Observable<WorkflowRuntimeNode>) =>
              n.type.get() === WorkflowBrandedTypes.typeName(`subflow-inputs`),
          )
          ?.get() as WorkflowRuntimeNode | undefined,
        outputsNode: Object.values(runtimeStore$.nodes)
          ?.find(
            (n: Observable<WorkflowRuntimeNode>) =>
              n.type.get() === WorkflowBrandedTypes.typeName(`subflow-outputs`),
          )
          ?.get() as WorkflowRuntimeNode | undefined,
      });

      const store = store$.get();
      const nodeId = node$.id.get();
      store.actions.updateInputs(nodeId, [
        ...(runtimeStateTyped.subflowNodes$?.inputsNode
          ?.peek()
          ?.outputs.map((field) => ({
            name: WorkflowBrandedTypes.inputName(field.name),
            type: WorkflowBrandedTypes.valueType(field.type),
          })) ?? []),
      ]);

      store.actions.updateOutputs(
        nodeId,
        runtimeStateTyped.subflowNodes$?.outputsNode
          ?.peek()
          ?.inputs?.map((field) => ({
            name: WorkflowBrandedTypes.outputName(field.name),
            type: WorkflowBrandedTypes.valueType(field.type),
          })) ?? [],
      );

      // setup output subscriptions
      unsubs.addUnsubObj = controller.registerEvent((emit) => {
        const outputSubs = new Map<WorkflowOutputName, () => void>();

        const mainUnsub = observe(() => {
          const subflowOutputsNode$ =
            runtimeStateTyped.subflowNodes$?.outputsNode;
          const subflowOutputsNode = subflowOutputsNode$?.get();
          if (!subflowOutputsNode$ || !subflowOutputsNode) {
            console.log(
              `[subflowInstanceNodeType.load.registerEvent.observe] no subflowOutputsNode`,
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
        const subflowInputsNode$ = runtimeStateTyped.subflowNodes$?.inputsNode;
        const subflowInputsNode = subflowInputsNode$?.get();
        if (!subflowInputsNode$ || !subflowInputsNode) {
          console.error(
            `[subflowInstanceNodeType.load.observe] no subflowInputsNode to provide inputs`,
            {
              subflowInputsNode,
              subflowInputsNode$,
              runtimeStore$: runtimeStateTyped.runtimeStore$?.get(),
            },
          );
        }

        inputs.forEach((input, index) => {
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
