import { cloneNodeType } from './clone-node';
import { engineSpyNodeType } from './engine-spy-';
import { jsonInputNodeType } from './json-input-node';
import { numberInputNodeType } from './number-input-node';
import { rerouteNodeType } from './reroute-node';
import { stringInputNodeType } from './string-input-node';

const commonNodeTypesList = [
  //
  rerouteNodeType,
  stringInputNodeType,
  jsonInputNodeType,
  numberInputNodeType,
  cloneNodeType,
  // TODO: move to debug tools
  engineSpyNodeType,
];

export const commonNodeTypes = Object.fromEntries(
  commonNodeTypesList.map((nt) => [nt.type, nt]),
);
