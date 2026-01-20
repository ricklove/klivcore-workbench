import { numberInputNodeType } from './number-input-node';

const commonNodeTypesList = [
  //
  numberInputNodeType,
];

export const commonNodeTypes = Object.fromEntries(commonNodeTypesList.map((nt) => [nt.type, nt]));
