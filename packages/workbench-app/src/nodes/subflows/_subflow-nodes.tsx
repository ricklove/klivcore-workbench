import { subflowCodeGenerationNodeType } from './subflow-code-generation-node';
import { subflowInputsNodeType } from './subflow-inputs-node';
import { subflowInstanceNodeType } from './subflow-instance-node';
import { subflowOutputsNodeType } from './subflow-outputs-node';
import { subflowUiNodeType } from './subflow-ui-node';

const subflowNodeTypesList = [
  //
  subflowInputsNodeType,
  subflowOutputsNodeType,
  subflowUiNodeType,
  subflowInstanceNodeType,
  subflowCodeGenerationNodeType,
];

export const subflowNodeTypes = Object.fromEntries(
  subflowNodeTypesList.map((nt) => [nt.type, nt]),
);
