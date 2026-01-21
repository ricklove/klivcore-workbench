import { cloneNodeType } from './clone-node';
import { engineSpyNodeType } from './engine-spy-';
import { numberInputNodeType } from './number-input-node';

const commonNodeTypesList = [
  //
  numberInputNodeType,
  cloneNodeType,
  // TODO: move to debug tools
  engineSpyNodeType,
];

export const commonNodeTypes = Object.fromEntries(commonNodeTypesList.map((nt) => [nt.type, nt]));
