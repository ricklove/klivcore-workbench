import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function getThumbnail(
  source: string,
  cacheDir: string,
  width: number,
) {
  const cachePath = path.join(
    cacheDir,
    `${Bun.hash(source + width).toString(16)}.webp`,
  );
  const [cached, original] = [Bun.file(cachePath), Bun.file(source)];

  // Fast check: If cache exists, check if it's newer than the original
  if (await cached.exists()) {
    const [s1, s2] = await Promise.all([stat(source), stat(cachePath)]);
    if (s2.mtimeMs >= s1.mtimeMs) return cached;
  }

  // Otherwise, build it
  await mkdir(cacheDir, { recursive: true });
  const buf = await sharp(await original.arrayBuffer())
    .resize({ width, withoutEnlargement: true })
    .webp()
    .toBuffer();
  await Bun.write(cachePath, buf);
  return Bun.file(cachePath);
}
