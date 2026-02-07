import { imagePreviewNodeType } from './image-preview';
import { videoPreviewNodeType } from './video-preview';

const mediaNodeTypesList = [
  //
  imagePreviewNodeType,
  videoPreviewNodeType,
];

export const mediaNodeTypes = Object.fromEntries(
  mediaNodeTypesList.map((nt) => [nt.type, nt]),
);
