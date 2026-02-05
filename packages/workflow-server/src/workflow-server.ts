import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

export const run = async (): Promise<string> => {
  const PORT = Number(Bun.env.PORT) || 7601;
  const STORAGE_DIR_NAME = Bun.env.STORAGE_DIR ?? `../../`;
  const BASE_STORAGE_PATH = path.resolve(process.cwd(), STORAGE_DIR_NAME);
  const ALLOWED_ORIGIN = Bun.env.ALLOWED_ORIGIN ?? `*`;

  console.log(`Storage base path resolved to: ${BASE_STORAGE_PATH}`);

  const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': `GET, POST, DELETE, OPTIONS`,
    'Access-Control-Allow-Headers': `Content-Type`,
  };

  const safeResolvePath = (relativePath?: string | null): string | null => {
    if (
      !relativePath ||
      typeof relativePath !== `string` ||
      relativePath.includes(`..`)
    ) {
      return null;
    }
    const sanitized = path.normalize(
      relativePath.replace(/^[/\\]+|[/\\]+$/g, ``),
    );
    if (sanitized === `.` || sanitized === ``) return null;

    const absolutePath = path.resolve(BASE_STORAGE_PATH, sanitized);
    return absolutePath.startsWith(BASE_STORAGE_PATH) ? absolutePath : null;
  };

  /**
   * Bun-native file scanning using Glob
   */
  const listFiles = async (): Promise<string[]> => {
    try {
      await mkdir(BASE_STORAGE_PATH, { recursive: true });
      // Bun.Glob is significantly faster than fs.readdir recursive
      const glob = new Bun.Glob('**/*');
      const files: string[] = [];

      // Scans the directory and returns relative paths automatically
      for await (const file of glob.scan({
        cwd: BASE_STORAGE_PATH,
        onlyFiles: true,
      })) {
        files.push(file.split(path.sep).join('/'));
      }
      return files;
    } catch (error) {
      console.error(`listFiles: Error`, error);
      return [];
    }
  };

  const server = Bun.serve({
    port: PORT,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const method = request.method;
      let pathname = url.pathname.replace(/\/$/, ''); // Remove trailing slash
      if (pathname === '') pathname = '/';

      console.log(`\n--- [${method}] ${pathname}${url.search} ---`);

      // Preflight
      if (method === `OPTIONS`) {
        return new Response(null, { status: 204, headers: COMMON_HEADERS });
      }

      const reqPath = url.searchParams.get(`path`);
      const absolutePath = safeResolvePath(reqPath);

      try {
        // --- ROUTE: GET /list ---
        if (pathname === `/list` && method === `GET`) {
          const files = await listFiles();
          return Response.json(files, { headers: COMMON_HEADERS });
        }

        // Paths below require a valid 'path' param
        if (!absolutePath && pathname !== '/') {
          return Response.json(
            { error: 'Invalid path' },
            { status: 400, headers: COMMON_HEADERS },
          );
        }

        // --- ROUTE: GET /open ---
        if (pathname === `/open` && method === `GET`) {
          console.log(`Opening in editor: ${absolutePath}`);
          Bun.spawn({ cmd: [`code`, absolutePath!] });
          return new Response(null, { status: 200, headers: COMMON_HEADERS });
        }

        // --- ROUTE: GET /load ---
        if (pathname === `/load` && method === `GET`) {
          const file = Bun.file(absolutePath!);
          if (!(await file.exists())) {
            return Response.json(
              { error: 'Not Found' },
              { status: 404, headers: COMMON_HEADERS },
            );
          }
          return new Response(file, { headers: COMMON_HEADERS }); // Bun serves the file efficiently
        }

        // --- ROUTE: POST /save ---
        if (pathname === `/save` && method === `POST`) {
          const body = await request.text();
          await mkdir(path.dirname(absolutePath!), { recursive: true });
          await Bun.write(absolutePath!, body);
          return Response.json({ message: 'OK' }, { headers: COMMON_HEADERS });
        }

        // --- ROUTE: DELETE /delete ---
        if (pathname === `/delete` && method === `DELETE`) {
          const file = Bun.file(absolutePath!);
          if (await file.exists()) {
            await unlink(absolutePath!);
          }
          return new Response(null, { status: 204, headers: COMMON_HEADERS });
        }

        return Response.json(
          { error: 'Not Found' },
          { status: 404, headers: COMMON_HEADERS },
        );
      } catch (error: any) {
        console.error(`Server Error:`, error);
        return Response.json(
          { error: error.message || 'Internal Server Error' },
          { status: 500, headers: COMMON_HEADERS },
        );
      }
    },
    error(error) {
      return Response.json(
        { error: error.message },
        { status: 500, headers: COMMON_HEADERS },
      );
    },
  });

  console.log(`🚀 Bun server listening on http://localhost:${server.port}`);
  console.log(`📁 Serving from: ${BASE_STORAGE_PATH}`);

  return `ready`;
};
