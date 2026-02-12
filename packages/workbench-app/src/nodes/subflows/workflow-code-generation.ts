import {
  WorkflowBrandedTypes,
  type WorkflowDocumentData,
  type WorkflowNodeId,
  type WorkflowNodeTypeName,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';

const sortNodes = (nodes: WorkflowDocumentData['nodes']) => {
  const sorted: WorkflowDocumentData['nodes'] = [];
  const visited = new Set<string>();

  nodes = [
    ...nodes.filter(
      (n) => n.type === WorkflowBrandedTypes.typeName(`subflow-inputs`),
    ),
    ...nodes.filter(
      (n) =>
        n.type !== WorkflowBrandedTypes.typeName(`subflow-inputs`) &&
        n.type !== WorkflowBrandedTypes.typeName(`subflow-outputs`),
    ),
    ...nodes.filter(
      (n) => n.type === WorkflowBrandedTypes.typeName(`subflow-outputs`),
    ),
  ];

  const visit = (node: (typeof nodes)[number]) => {
    if (visited.has(node.id)) {
      return;
    }
    visited.add(node.id);

    const inputSources = node.inputs
      .map((input) => input.source)
      .filter((source): source is NonNullable<typeof source> =>
        Boolean(source && 'nodeId' in source && 'name' in source),
      );

    inputSources.forEach((source) => {
      const sourceNode = nodes.find((n) => n.id === source.nodeId);
      if (sourceNode) {
        visit(sourceNode);
      }
    });

    sorted.push(node);
  };

  nodes.forEach(visit);

  return sorted;
};

export const generateCodeForWorkflow = ({
  doc,
  nodeTypes,
}: {
  doc: WorkflowDocumentData;
  nodeTypes: Record<WorkflowNodeTypeName, WorkflowRuntimeNodeTypeDefinition>;
}) => {
  const nodesRaw = [...doc.nodes];
  const nodes = sortNodes(nodesRaw);

  const variableNames = nodes.flatMap((node) => {
    return node.outputs.map((output) => {
      return {
        sourceNodeId: node.id,
        sourceOutputName: output.name,
        variableName: `${node.id}_${output.name}`,
      };
    });
  });

  const usedNames = new Set<string>();
  variableNames.forEach((v) => {
    let varName = v.sourceOutputName as string;
    let counter = 1;
    while (usedNames.has(varName)) {
      counter++;
      varName = `${v.sourceOutputName}_${counter}`;
    }

    v.variableName = varName;
    usedNames.add(v.variableName);
    return;
  });

  const iSubflowInput = Math.max(
    0,
    nodes.findIndex(
      (node) => node.type === WorkflowBrandedTypes.typeName(`subflow-inputs`),
    ),
  );
  const iSubflowOutputRaw = nodes.findIndex(
    (node) => node.type === WorkflowBrandedTypes.typeName(`subflow-outputs`),
  );
  const iSubflowOutput =
    iSubflowOutputRaw < 0 ? nodes.length - 1 : iSubflowOutputRaw;

  const nodesBetweenSubflowIO = nodes.filter((_, i) => {
    if (i > iSubflowInput && i < iSubflowOutput) {
      return true;
    }
    return false;
  });

  const nodeCode = nodesBetweenSubflowIO
    .map((node) => {
      const inputAssignments = node.inputs
        .filter((input) => !!input.source)
        .map((input) => {
          const source = input.source;
          if (!source) {
            return undefined;
          }

          const variable = variableNames.find(
            (v) =>
              v.sourceNodeId === source.nodeId &&
              v.sourceOutputName === source.name,
          );
          return {
            inputName: input.name,
            variableName: variable?.variableName ?? input.name,
          };
        })
        .filter((x) => !!x);

      const nodeType = nodeTypes[node.type];
      if (!nodeType) {
        return undefined;
      }

      const inputNames = Object.fromEntries(
        inputAssignments.map((input) => [input.inputName, input.variableName]),
      );

      const genCode = nodeType.generateCode?.({
        data: node.data,
        inputNames,
      }) ?? {
        typescript: `nodeTypes[${JSON.stringify(node.type)}].execute(/*...*/)`,
      };

      if (genCode.kind === `none`) {
        return undefined;
      }

      if (genCode.kind === `passthrough`) {
        for (const output of node.outputs) {
          const outVariable = variableNames.find(
            (v) =>
              v.sourceNodeId === node.id && v.sourceOutputName === output.name,
          );
          const input = node.inputs.find(
            (i) => (i.name as string) === output.name,
          );
          const inVariable = variableNames.find(
            (v) =>
              v.sourceNodeId === input?.source?.nodeId &&
              v.sourceOutputName === input?.source?.name,
          );

          if (!outVariable || !inVariable) {
            continue;
          }

          outVariable.variableName = inVariable.variableName;
        }
        return undefined;
      }

      if (genCode.kind === `void`) {
        return `${genCode.typescript}`;
      }

      if (genCode.kind === `value` && node.outputs.length === 1) {
        const outputArgs = node.outputs.map((output) => {
          const variable = variableNames.find(
            (v) =>
              v.sourceNodeId === node.id && v.sourceOutputName === output.name,
          );
          if ((variable?.variableName ?? output.name) === output.name) {
            return `${output.name}`;
          }

          return `${variable?.variableName ?? output.name}`;
        })[0];

        return `const ${outputArgs} = ${genCode.typescript}`;
      }

      const outputArgs = node.outputs
        .map((output) => {
          const variable = variableNames.find(
            (v) =>
              v.sourceNodeId === node.id && v.sourceOutputName === output.name,
          );
          if ((variable?.variableName ?? output.name) === output.name) {
            return `${output.name}`;
          }

          return `${output.name}: ${variable?.variableName ?? output.name}`;
        })
        .join(', ');

      return `const { ${outputArgs} } = ${genCode.typescript}`;
    })
    .filter((x) => !!x)
    .join('\n\n');

  const inputs = nodes
    .find((n) => n.type === WorkflowBrandedTypes.typeName(`subflow-inputs`))
    ?.outputs.map((output) => {
      return {
        name: output.name,
        type: output.type,
      };
    });

  const outputs = nodes
    .find((n) => n.type === WorkflowBrandedTypes.typeName(`subflow-outputs`))
    ?.inputs.map((input) => {
      return {
        name: input.name,
        type: input.type,
        source: input.source,
      };
    });

  const body = nodeCode.trim();

  const fun = `
function subflow({
  ${inputs?.map((i) => `${i.name}`).join(',\n  ')}
}:{
  ${inputs?.map((i) => `${i.name}: ${i.type}`).join(',\n  ')}
}) : Promise<{
  ${outputs?.map((o) => `${o.name}: ${o.type}`).join(',\n  ')}
}>{
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}

  return {
    ${outputs?.map((o) => `${o.name}: ${variableNames.find((v) => v.sourceNodeId === o.source?.nodeId && v.sourceOutputName === o.source?.name)?.variableName ?? o.name}`).join(',\n    ')}
  };
}`.trim();

  return fun;
};
