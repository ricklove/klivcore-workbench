import { fileServerNodeType } from './file-server';
import { storageUrlNodeType } from './storage-url';
import { textFileNodeType } from './text-file';

const nodeTypesList = [
  //
  fileServerNodeType,
  textFileNodeType,
  storageUrlNodeType,
];

export const storageNodeTypes = Object.fromEntries(
  nodeTypesList.map((nt) => [nt.type, nt]),
);
