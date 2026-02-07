import { cloneNodeType } from './clone-node';
import { engineSpyNodeType } from './engine-spy-';
import { imagePreviewNodeType } from './image-preview';
import { jsonInputNodeType } from './json-input-node';
import { numberInputNodeType } from './number-input-node';
import { rerouteNodeType } from './reroute-node';
import { stringInputNodeType } from './string-input-node';

const commonNodeTypesList = [
  //
  stringInputNodeType,
  jsonInputNodeType,
  numberInputNodeType,
  rerouteNodeType,
  cloneNodeType,
  imagePreviewNodeType,
  // TODO: move to debug tools
  engineSpyNodeType,
];

export const commonNodeTypes = Object.fromEntries(
  commonNodeTypesList.map((nt) => [nt.type, nt]),
);
