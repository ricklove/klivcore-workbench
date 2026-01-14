import initSwc, { transformSync, parseSync } from '@swc/wasm-web';

async function setupSwc() {
  const wasmUrl = '/wasm/wasm_bg.wasm';

  // 1. Fetch the file manually
  const response = await fetch(wasmUrl);

  if (!response.ok) {
    throw new Error(`Failed to load WASM file from ${wasmUrl} - Status: ${response.status}`);
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
