import fs from 'node:fs/promises';
import path from 'node:path';

export const run = async () => {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 7601;

  const STORAGE_DIR_NAME = process.env.STORAGE_DIR ?? `../lofr-app/src`;

  const BASE_STORAGE_PATH = path.resolve(process.cwd(), STORAGE_DIR_NAME);

  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? `*`;

  console.log(`Storage base path resolved to: ${BASE_STORAGE_PATH}`);

  const safeResolvePath = (relativePath?: string | null): string | null => {
    if (
      !relativePath ||
      typeof relativePath !== `string` ||
      relativePath.includes(`..`)
    ) {
      console.warn(`safeResolvePath: Invalid path detected - ${relativePath}`);
      return null;
    }
    const sanitized = path.normalize(
      relativePath.replace(/^[/\\]+|[/\\]+$/g, ``),
    );
    if (sanitized === `.` || sanitized === ``) {
      console.warn(
        `safeResolvePath: Invalid sanitized path detected - ${relativePath}`,
      );
      return null;
    }
    const absolutePath = path.resolve(BASE_STORAGE_PATH, sanitized);
    const startsWithBase = absolutePath.startsWith(BASE_STORAGE_PATH);
    if (!startsWithBase) {
      console.warn(
        `safeResolvePath: Path traversal attempt blocked? Resolved ${absolutePath} is outside ${BASE_STORAGE_PATH}`,
      );
    }
    return startsWithBase ? absolutePath : null;
  };

  const listFiles = async (dir: string): Promise<string[]> => {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`listFiles: Reading directory ${dir}`);
      const entries = await fs.readdir(dir, {
        withFileTypes: true,
        recursive: true,
      });
      const files = entries
        .filter((entry) => entry.isFile())

        .map((entry) => path.join(entry.path ?? dir, entry.name))
        .map((fullPath) =>
          path.relative(BASE_STORAGE_PATH, fullPath).split(path.sep).join(`/`),
        );
      console.log(`listFiles: Found ${files.length} files.`);
      return files;
    } catch (errorRaw: unknown) {
      const error = errorRaw as { code?: string };
      if (error.code === `ENOENT`) {
        console.log(
          `listFiles: Base directory ${dir} does not exist, returning empty list.`,
        );
        return [];
      }
      console.error(`listFiles: Error listing files in ${dir}`, error);
      throw error;
    }
  };

  const server = Bun.serve({
    port: PORT,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);

      let pathname = url.pathname;
      if (pathname.endsWith(`/`) && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }

      const method = request.method;
      const requestIdentifier = `${method} ${pathname}${url.search}`;
      console.log(`\n--- Request Received: ${requestIdentifier} ---`);

      const headers = {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': `GET, POST, DELETE, OPTIONS`,
        'Access-Control-Allow-Headers': `Content-Type`,
      };

      if (method === `OPTIONS`) {
        console.log(`Handler: OPTIONS (Preflight)`);
        return new Response(null, { status: 204, headers });
      }

      try {
        if (pathname === `/open` && method === `GET`) {
          console.log(`Handler: GET /open`);
          const reqPath = url.searchParams.get(`path`);
          console.log(`  Path Param: ${reqPath}`);
          const absolutePath = safeResolvePath(reqPath);
          if (!absolutePath) {
            console.log(`  Error: Invalid path resolved.`);
            return new Response(`{"error":"Invalid path"}`, {
              status: 400,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }

          // open in code
          console.log(`opening in editor: ${absolutePath}`);
          Bun.spawn({ cmd: [`code`, absolutePath] });

          return new Response(undefined, {
            status: 200,
          });
        }
        if (pathname === `/load` && method === `GET`) {
          console.log(`Handler: GET /load`);
          const reqPath = url.searchParams.get(`path`);
          console.log(`  Path Param: ${reqPath}`);
          const absolutePath = safeResolvePath(reqPath);
          if (!absolutePath) {
            console.log(`  Error: Invalid path resolved.`);
            return new Response(`{"error":"Invalid path"}`, {
              status: 400,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }
          console.log(`  Resolved Path: ${absolutePath}`);
          try {
            const file = Bun.file(absolutePath);
            if (!(await file.exists())) {
              console.log(`  Error: File not found.`);
              return new Response(`{"error":"Not Found"}`, {
                status: 404,
                headers: { ...headers, 'Content-Type': `application/json` },
              });
            }
            const content = await file.text();
            // JSON.parse(content);
            console.log(`  Success: File loaded and parsed.`);
            return new Response(content, {
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          } catch (errorRaw: unknown) {
            const e = errorRaw as { code?: string; message?: string };
            const status =
              e instanceof SyntaxError ? 400 : e.code === `ENOENT` ? 404 : 500;
            const message =
              e instanceof SyntaxError
                ? `Invalid JSON content`
                : `Load failed: ${e.message}`;
            console.error(`  Error loading/parsing file: ${message}`, e);
            return new Response(JSON.stringify({ error: message }), {
              status,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }
        }

        if (pathname === `/save` && method === `POST`) {
          console.log(`Handler: POST /save`);
          const reqPath = url.searchParams.get(`path`);
          console.log(`  Path Param: ${reqPath}`);
          const absolutePath = safeResolvePath(reqPath);
          if (!absolutePath) {
            console.log(`  Error: Invalid path resolved.`);
            return new Response(`{"error":"Invalid path"}`, {
              status: 400,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }
          console.log(`  Resolved Path: ${absolutePath}`);
          try {
            const body = await request.text();
            // JSON.parse(body);
            console.log(
              `  Body size: ${body.length} bytes, attempting write...`,
            );
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await Bun.write(absolutePath, body);
            console.log(`  Success: File saved.`);
            return new Response(`{"message":"OK"}`, {
              status: 200,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          } catch (errorRaw: unknown) {
            const e = errorRaw as { code?: string; message?: string };
            const status = e instanceof SyntaxError ? 400 : 500;
            const message =
              e instanceof SyntaxError
                ? `Invalid JSON body`
                : `Save failed: ${e.message}`;
            console.error(`  Error parsing body or saving file: ${message}`, e);
            return new Response(JSON.stringify({ error: message }), {
              status,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }
        }

        if (pathname === `/delete` && method === `DELETE`) {
          console.log(`Handler: DELETE /delete`);
          const reqPath = url.searchParams.get(`path`);
          console.log(`  Path Param: ${reqPath}`);
          const absolutePath = safeResolvePath(reqPath);
          if (!absolutePath) {
            console.log(`  Error: Invalid path resolved.`);
            return new Response(`{"error":"Invalid path"}`, {
              status: 400,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }
          console.log(`  Resolved Path: ${absolutePath}`);
          try {
            const file = Bun.file(absolutePath);
            if (!(await file.exists())) {
              console.log(
                `  Warning: File already deleted or never existed (ENOENT). Returning 204.`,
              );
              return new Response(null, { status: 204, headers });
            }
            await fs.unlink(absolutePath);
            console.log(`  Success: File deleted.`);
            return new Response(null, { status: 204, headers });
          } catch (errorRaw: unknown) {
            const e = errorRaw as { code?: string; message?: string };
            if (e.code === `ENOENT`) {
              console.log(
                `  Warning: File deletion failed with ENOENT (race condition?). Returning 204.`,
              );
              return new Response(null, { status: 204, headers });
            }
            console.error(`  Error deleting file: ${e.message}`, e);
            return new Response(`{"error":"Delete failed: ${e.message}"}`, {
              status: 500,
              headers: { ...headers, 'Content-Type': `application/json` },
            });
          }
        }

        if (pathname === `/list` && method === `GET`) {
          console.log(`Handler: GET /list`);
          const files = await listFiles(BASE_STORAGE_PATH);
          console.log(`  Success: Found ${files.length} files.`);
          return new Response(JSON.stringify(files), {
            headers: { ...headers, 'Content-Type': `application/json` },
          });
        }

        console.log(`Handler: No match found - Returning 404 Not Found`);
        return new Response(`{"error":"Not Found"}`, {
          status: 404,
          headers: { ...headers, 'Content-Type': `application/json` },
        });
      } catch (errorRaw: unknown) {
        const error = errorRaw as { code?: string; message?: string };
        console.error(
          `Unhandled Server Error during request processing: ${requestIdentifier}`,
          error,
        );
        return new Response(`{"error":"Internal Server Error"}`, {
          status: 500,
          headers: { ...headers, 'Content-Type': `application/json` },
        });
      }
    },
    error(error: Error): Response {
      console.error(`Fatal Server Error (Bun.serve level):`, error);

      return new Response(`Internal Server Error`, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      });
    },
  });

  console.log(
    `🚀 Server listening on http://localhost:${server.port} serving from ${BASE_STORAGE_PATH}`,
  );

  return `ready`;
};
