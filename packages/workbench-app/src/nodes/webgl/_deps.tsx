import { type Observable, ObservableHint, observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { memo } from 'react';
import { ErrorBoundary } from '../../workflow/error-boundary';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import type {
  WorkflowComponentProps,
  WorkflowComponentPropsAny_Ops,
  WorkflowJsonObject,
} from '../../workflow/types';

const getValues = (data: WorkflowComponentProps[`data`]) => {
  const { node$ } = data;

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
};

/** @deprecated */
export const NodeTypeWrapComponentWithNodeWrapper = (
  InnerComponent: React.ComponentType<WorkflowComponentPropsAny_Ops>,
): React.ComponentType<WorkflowComponentProps> => {
  return memo((props) => {
    const node = useValue(props.data.node$.id.get());
    if (!node) {
      return (
        <div className="w-full h-full p-1 whitespace-pre-wrap bg-red-400 text-white rounded">
          {`Error: Node not found`}
        </div>
      );
    }

    const data = {
      node$: props.data.node$,
      store$: props.data.store$,
      ...getValues(props.data),
    };

    return (
      <WorkflowNodeWrapperSimple {...props} data={data}>
        <ErrorBoundary message={`Error rendering Component`}>
          <InnerComponent {...props} data={data} />
        </ErrorBoundary>
      </WorkflowNodeWrapperSimple>
    );
  });
};
