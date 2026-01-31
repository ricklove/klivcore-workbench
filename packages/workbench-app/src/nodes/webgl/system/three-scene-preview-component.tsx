import { useValue } from '@legendapp/state/react';
import type * as THREE from 'three';
import type { WorkflowComponentProps_Obs } from '../../../workflow/types';
import { unbox } from '../types';
import { useWebGLPreview } from './use-webgl-preview';

export const ScenePreviewNodeComponent = (
  props: WorkflowComponentProps_Obs<
    Record<string, never>,
    Record<string, never>, // Inputs
    Record<string, never> // Outputs
  >,
) => {
  // 1. Read Inputs directly (or outputs if you passed them through)
  // Accessing inputs$ directly is usually better for "View" nodes
  const { inputs$ } = props.data;

  const sceneBox = useValue(inputs$.scene);
  const cameraBox = useValue(inputs$.camera);

  const scene = sceneBox ? (unbox(sceneBox) as THREE.Scene) : undefined;
  const camera = cameraBox ? (unbox(cameraBox) as THREE.Camera) : undefined;

  // 2. Prepare Data Object
  const previewData =
    scene && camera ? { type: 'scene' as const, scene, camera } : null;

  // 3. Register with Global Renderer
  const containerRef = useWebGLPreview(previewData);

  return (
    <div
      ref={containerRef}
      className="w-full h-64 bg-gray-900 border border-gray-700 relative"
    >
      {!previewData && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          Waiting for Scene...
        </div>
      )}
    </div>
  );
};
