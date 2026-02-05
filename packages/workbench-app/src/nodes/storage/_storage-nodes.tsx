import { fileServerNodeType } from './file-server';
import { textFileNodeType } from './text-file';

const nodeTypesList = [
  //
  fileServerNodeType,
  textFileNodeType,
];

export const storageNodeTypes = Object.fromEntries(
  nodeTypesList.map((nt) => [nt.type, nt]),
);
