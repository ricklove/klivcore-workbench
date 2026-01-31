import {
  type Observable,
  ObservableHint,
  type ObservablePrimitive,
  observable,
  observe,
} from '@legendapp/state';
import type {
  WorkflowComponentSimplePropsBase,
  WorkflowJsonObject,
  WorkflowRuntimeNode,
  WorkflowRuntimeStore,
  WorkflowRuntimeValue,
} from '../types';

export const getReactFlowNodeDataProp = (
  store$: Observable<WorkflowRuntimeStore>,
  node$: Observable<WorkflowRuntimeNode>,
) => ({
  node$,
  store$,
  getValues: () => {
    const result = {
      inputs$: observable(
        ObservableHint.plain(
          Object.fromEntries(
            node$.inputs.map((input$) => [
              input$.name.get(),
              input$.value.get().getObservableBox(),
            ]),
          ),
        ),
      ),
      outputs$: observable(
        ObservableHint.plain(
          Object.fromEntries(
            node$.outputs.map((output$) => [
              output$.name.get(),
              output$.value.get().getObservableBox(),
            ]),
          ),
        ),
      ),
      data$: node$.data
        .get()
        .getObservableBox() as Observable<WorkflowJsonObject>,
    };
    // console.log(`[useReactFlowStore:getValues] node '${node$.id.peek()}' values`, { result });
    return result;
  },
  getStandardNodeDataProp: (): Pick<
    WorkflowComponentSimplePropsBase[`data`],
    `data` | `inputs` | `outputs`
  > => {
    {
      const createStandardAccess = <TBase>(
        runtimeValue: WorkflowRuntimeValue,
      ) => {
        return {
          asObservable: <T extends TBase>() =>
            runtimeValue.getObservableBox() as Observable<T>,
          getDirectValue: <T extends TBase>() => {
            return runtimeValue.getDirectValue() as unknown as T;
          },
          setValue: <T extends TBase>(value: T) => {
            runtimeValue.setValue(value);
          },
        };
      };

      return {
        data: createStandardAccess<WorkflowJsonObject>(node$.data.peek()),
        inputs: Object.fromEntries(
          node$.inputs.map((input$) => [
            input$.name.peek(),
            createStandardAccess(input$.value.peek()) as {
              asObservable: <T>() => ObservablePrimitive<T>;
              getDirectValue: <T>() => T;
              setValue: <T>(value: T) => void;
            },
          ]),
        ),
        outputs: Object.fromEntries(
          node$.outputs.map((output$) => [
            output$.name.peek(),
            createStandardAccess(output$.value.peek()) as {
              asObservable: <T>() => ObservablePrimitive<T>;
              getDirectValue: <T>() => T;
              setValue: <T>(value: T) => void;
            },
          ]),
        ),
      };
    }
  },
});
