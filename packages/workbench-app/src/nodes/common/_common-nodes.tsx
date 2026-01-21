import { cloneNodeType } from './clone-node';
import { numberInputNodeType } from './number-input-node';

const commonNodeTypesList = [
  //
  numberInputNodeType,
  cloneNodeType,
];

export const commonNodeTypes = Object.fromEntries(commonNodeTypesList.map((nt) => [nt.type, nt]));
