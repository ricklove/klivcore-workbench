import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import { type WorkflowComponentProps_Obs } from '../../workflow/types';
import { useValue } from '@legendapp/state/react';

export const ImageUrlPreviewComponent = (props: WorkflowComponentProps_Obs<{ url: string }>) => {
  const { inputs$ } = props.data;
  const url = useValue(() => inputs$.url.get() || '');

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="bg-black w-full h-full nowheel nodrag nopan">
          {url ? (
            <img
              src={url}
              alt="Image Preview"
              className="max-w-full max-h-full object-contain mx-auto my-auto"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No Image URL
            </div>
          )}
        </div>
      </WorkflowNodeWrapperSimple>
    </>
  );
};
