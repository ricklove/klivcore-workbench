// File: packages\workbench-app\src\nodes\webgl\system\webgl-preview-store.ts
import { observable } from '@legendapp/state';
import * as THREE from 'three';

export type TexturePreviewData = {
  type: 'texture';
  texture: THREE.Texture | THREE.DataArrayTexture;
  layerIndex: number;
};

export type ScenePreviewData = {
  type: 'scene';
  scene: THREE.Scene;
  camera: THREE.Camera;
};

export type PreviewRequest = {
  id: string;
  rect: DOMRect;
  enabled: boolean;
  data: TexturePreviewData | ScenePreviewData;
};

// Map of NodeID -> Preview Data
export const webglPreviewStore$ = observable<Record<string, PreviewRequest>>({});
