import { useValue } from '@legendapp/state/react';
import type * as THREE from 'three';
import { WorkflowNodeWrapperSimple } from '../../../workflow/node-wrapper';
import type { WorkflowComponentProps_Obs } from '../../../workflow/types';
import { type Box, unbox } from '../types';
import { useWebGLPreview } from './use-webgl-preview';

export const TexturePreviewNodeComponent = (
  props: WorkflowComponentProps_Obs<
    Record<string, never>,
    Record<string, never>,
    { texture: Box<THREE.Texture> }
  >,
) => {
  // 1. Unwrap the Boxed texture
  const textureBox = useValue(props.data.outputs$.texture);
  const texture = textureBox ? unbox(textureBox) : undefined;

  const containerRef = useWebGLPreview(
    !texture ? undefined : { type: 'texture', texture, layerIndex: 0 },
  );

  return (
    <WorkflowNodeWrapperSimple {...props}>
      {/* 
        This div is just a placeholder. 
        The GlobalRenderer draws pixels ON TOP of this area.
      */}
      <div
        ref={containerRef}
        className="w-64 h-64 bg-gray-900 border border-gray-700"
      >
        {!texture && (
          <div className="flex items-center justify-center h-full text-gray-500 text-xs">
            No Texture
          </div>
        )}
      </div>
    </WorkflowNodeWrapperSimple>
  );
};
