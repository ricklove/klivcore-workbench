/* eslint-disable react-refresh/only-export-components */

import { ObservableHint } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import * as THREE from 'three';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { box } from './types';

/**
 * Loads a sequence of image URLs into a DataArrayTexture.
 * Includes async gaps to prevent blocking the main thread during heavy processing.
 */
export const loadTextureArray = async (
  urls: string[],
  width?: number,
  height?: number,
  onProgress?: (progress: number) => void,
): Promise<THREE.DataArrayTexture> => {
  const urlCount = urls.length;

  if (urlCount === 0) {
    throw new Error('No URLs provided to loadTextureArray.');
  }

  const loader = new THREE.ImageBitmapLoader();
  loader.setOptions({ imageOrientation: 'flipY' });

  // 1. Load all images concurrently (Network/Decoding phase)
  const bitmaps: ImageBitmap[] = await Promise.all(
    urls.map((url) => loader.loadAsync(url)),
  );

  const firstBitmap = bitmaps[0];
  if (!firstBitmap) {
    throw new Error('Failed to load initial image bitmap.');
  }

  const finalWidth = width ?? firstBitmap.width;
  const finalHeight = height ?? firstBitmap.height;

  // 2. Allocate Buffer
  const layerSize = finalWidth * finalHeight * 4;
  const totalSize = layerSize * urlCount;
  const allPixels = new Uint8Array(totalSize);

  // 3. Setup Canvas
  const canvas = new OffscreenCanvas(finalWidth, finalHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Failed to initialize OffscreenCanvas context.');
  }

  // 4. Process Bitmaps with Async Gaps
  // We process this many frames before yielding to the event loop
  const BATCH_SIZE = 5;

  for (let i = 0; i < urlCount; i++) {
    const bitmap = bitmaps[i];

    // Strict check since array access is technically undefined-able
    if (!bitmap) continue;

    // A. Draw and Extract
    ctx.clearRect(0, 0, finalWidth, finalHeight);
    ctx.drawImage(bitmap, 0, 0, finalWidth, finalHeight);
    const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);

    // B. Copy to giant buffer
    const offset = i * layerSize;
    allPixels.set(imageData.data, offset);

    // C. Cleanup memory immediately
    bitmap.close();

    // D. Optional Progress Callback
    if (onProgress) {
      onProgress((i + 1) / urlCount);
    }

    // E. Yield to event loop to unblock UI
    // We yield every BATCH_SIZE frames to balance speed vs responsiveness
    if (i % BATCH_SIZE === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  // 5. Create Texture
  const textureArray = new THREE.DataArrayTexture(
    allPixels,
    finalWidth,
    finalHeight,
    urlCount,
  );

  textureArray.format = THREE.RGBAFormat;
  textureArray.type = THREE.UnsignedByteType;
  textureArray.needsUpdate = true;

  return textureArray;
};

const threeLoadImageTexture: WorkflowRuntimeNodeTypeDefinition = {
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
      type: WorkflowBrandedTypes.valueType(
        `Box<THREE.Texture<HTMLImageElement>>`,
      ),
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

    const loader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture<HTMLImageElement>>(
      (resolve, reject) => {
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
      },
    );

    return { outputs: { texture: ObservableHint.opaque(box(texture)) } };
  },
};

export const ImageUrlPreviewComponent = (
  props: WorkflowComponentProps_Obs<{ url: string }>,
) => {
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

export const imageNodeTypes = [threeLoadImageTexture];
