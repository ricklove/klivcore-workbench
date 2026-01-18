import { observable } from '@legendapp/state';
import * as THREE from 'three';

export type PreviewRequest = {
  id: string;
  rect: DOMRect; // Screen position of the node
  texture: THREE.Texture | THREE.DataArrayTexture;
  layerIndex: number; // For DataArrayTexture
  enabled: boolean;
};

// Map of NodeID -> Preview Data
export const texturePreviewStore$ = observable<Record<string, PreviewRequest>>({});
