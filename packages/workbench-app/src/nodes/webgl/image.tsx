import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import { type WorkflowComponentProps_Obs } from '../../workflow/types';
import { useValue } from '@legendapp/state/react';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import * as THREE from 'three';
import { ObservableHint } from '@legendapp/state';
import { box } from './types';

const loader = new THREE.TextureLoader();

// eslint-disable-next-line react-refresh/only-export-components
export const threeLoadImageTexture: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threeLoadImageTexture`),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(ImageUrlPreviewComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`url`),
      type: WorkflowBrandedTypes.valueType(`string`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`texture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
  ],
  execute: async ({ inputs, runtimeState }) => {
    const url = inputs.url as string;
    if (!url) {
      console.log('[threeImage] handleResize missing url', {
        url,
      });
      return;
    }

    const rs = runtimeState as {
      url?: string;
      dispose?: () => void;
    };

    if (url === rs.url) {
      return;
    }
    rs.dispose?.();
    rs.url = url;

    const texture = await new Promise<THREE.Texture<HTMLImageElement>>((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          rs.dispose = () => {
            texture.dispose();
          };

          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        (err) => {
          console.error('[threeImage] Error loading texture', { url, err });
          reject(err);
        },
      );
    });

    return { outputs: { texture: ObservableHint.opaque(box(texture)) } };
  },
};

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
