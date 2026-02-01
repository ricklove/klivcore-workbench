import initSwc, { parseSync, transformSync, type Module } from '@swc/wasm-web';

async function setupSwc() {
  const wasmUrl = '/wasm/wasm_bg.wasm';

  // 1. Fetch the file manually
  const response = await fetch(wasmUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to load WASM file from ${wasmUrl} - Status: ${response.status}`,
    );
  }

  // 2. Turn it into a binary buffer
  // This bypasses 'instantiateStreaming' and strict MIME type checks
  const buffer = await response.arrayBuffer();

  // 3. Initialize SWC with the buffer
  await initSwc(buffer);
}

let isLoaded = false;
async function ensureSwcIsLoaded() {
  if (isLoaded) {
    return;
  }
  await setupSwc();
  isLoaded = true;
}

export const transformTypescript = async (tsCode: string) => {
  await ensureSwcIsLoaded();

  // 1. Get AST (for types)
  const ast = parseSync(tsCode, { syntax: 'typescript', tsx: true });
  console.log('[transformTypescript] parsed', ast);

  // 2. Run Code
  const { code } = transformSync(tsCode, {
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
      },
      externalHelpers: true,
      target: 'es2016',
    },
    // env: {
    //   targets: 'Chrome >= 48',
    // },
  });

  return code;
};

export const parseTypescript = async (tsCode: string) => {
  await ensureSwcIsLoaded();

  // 1. Get AST (for types)
  const ast = parseSync(tsCode, { syntax: 'typescript', tsx: true });
  console.log('[parseTypescript] parsed', ast);

  return ast;
};

const getObjectTypeFields = (x: Module, y: string) => {
  const typeDeclaration = x.body[0];
  if (typeDeclaration?.type !== 'BlockStatement') {
    return;
  }
  const codeOffset = typeDeclaration.span.start;
  const fieldsStatements = typeDeclaration.stmts;
  const fields = fieldsStatements
    .map((item) => ({
      name: item.type === `LabeledStatement` ? item.label.value : undefined,
      fieldSpan: item.span,
      fieldCode: y.substring(item.span.start),
    }))
    .map((item) => ({
      fieldStart: item.fieldSpan.start - codeOffset,
      fieldEnd: item.fieldSpan.end - codeOffset,
    }))
    .map((item) => ({
      fieldCode: y.substring(item.fieldStart, item.fieldEnd),
    }))
    .map((item) => {
      const iColon = item.fieldCode.indexOf(`:`);
      if (iColon === -1) {
        return undefined;
      }
      return {
        name: item.fieldCode.substring(0, iColon).trim(),
        type: item.fieldCode
          .substring(iColon + 1)
          .replace(/;$/g, ``)
          .trim(),
      };
    })
    .filter((x): x is TypeField => !!x);

  return fields;
};

export const verifyTypescriptSyntax = async (tsCode: string) => {
  await ensureSwcIsLoaded();

  try {
    parseSync(tsCode, { syntax: 'typescript', tsx: true });
    return { isValid: true, error: undefined };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

interface TypeField {
  name: string;
  type: string;
}

export const parseObjectTypeDefinition = async (
  typeCode: string,
): Promise<{ fields: TypeField[]; error: undefined } | { error: string }> => {
  try {
    const ast = await parseTypescript(typeCode);
    const fields = getObjectTypeFields(ast, typeCode);
    return { fields: fields ?? [], error: undefined };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
