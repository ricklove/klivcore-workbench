import { observable, type Observable, ObservableHint } from '@legendapp/state';
import type { WorkflowRuntimeStore, WorkflowRuntimeNode, WorkflowJsonObject } from '../types';

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
      data$: node$.data.get().getObservableBox() as Observable<WorkflowJsonObject>,
    };

    console.log(`[useReactFlowStore:getValues] node '${node$.id.peek()}' values`, { result });
    return result;
  },
});
