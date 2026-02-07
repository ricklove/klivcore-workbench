import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const VIDEO_EXTS = new Set([
  '.mp4',
  '.mkv',
  '.mov',
  '.avi',
  '.webm',
  '.m4v',
  '.flv',
  '.wmv',
  '.mpg',
  '.mpeg',
]);

export async function getThumbnail({
  source,
  cacheDir,
  width,
  timeRatio = 0,
}: {
  source: string;
  cacheDir: string;
  width: number;
  timeRatio?: number;
}) {
  const isVideo = VIDEO_EXTS.has(path.extname(source).toLowerCase());
  const cacheKey = isVideo
    ? `${source}-${width}-${timeRatio}`
    : `${source}-${width}`;
  const cachePath = path.join(
    cacheDir,
    `${Bun.hash(cacheKey).toString(16)}.webp`,
  );

  console.log(`[getThumbnail] Generating thumbnail for:`, {
    source,
    width,
    timeRatio,
    cachePath,
  });

  const [original, cached] = [Bun.file(source), Bun.file(cachePath)];

  if (
    (await cached.exists()) &&
    (await stat(cachePath)).mtimeMs >= (await stat(source)).mtimeMs
  ) {
    console.log(
      `[getThumbnail] thumbnail cached. Source: ${source}, Time Ratio: ${timeRatio}`,
    );

    return cached;
  }

  await mkdir(cacheDir, { recursive: true });
  let buffer: Uint8Array | ArrayBuffer;

  if (isVideo) {
    console.log(
      `[getThumbnail] 01 getting thumbnail for video. Source: ${source}, Time Ratio: ${timeRatio}`,
    );

    // 1. Get duration using ffprobe
    const getDuration = async () => {
      try {
        const ffprobe = Bun.spawn([
          'ffprobe',
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'csv=p=0',
          source,
        ]);
        const duration =
          parseFloat(await new Response(ffprobe.stdout).text()) || 0;
        return duration;
      } catch (e) {
        console.error(
          `[getThumbnail] Error getting video duration with ffprobe:`,
          e,
        );
        return 0;
      }
    };
    const duration = await getDuration();
    console.log(
      `[getThumbnail] 02 got duration for video. Source: ${source}, Duration: ${duration}, Time Ratio: ${timeRatio}`,
    );

    // 2. Extract frame using ffmpeg
    const extractFrame = async () => {
      try {
        const ffmpeg = Bun.spawn([
          'ffmpeg',
          '-ss',
          (duration * timeRatio).toString(),
          '-i',
          source,
          '-vframes',
          '1',
          '-f',
          'image2pipe',
          '-vcodec',
          'png',
          '-',
        ]);

        console.log(
          `[getThumbnail] 03 extracting frame with ffmpeg. Source: ${source}, Time Ratio: ${timeRatio}`,
        );

        // Replacement for the deprecated readableStreamToBytes:
        return await new Response(ffmpeg.stdout).arrayBuffer();
      } catch (e) {
        console.error(
          `[getThumbnail] Error extracting frame with ffmpeg for video:`,
          e,
        );
        return await original.arrayBuffer();
      }
    };
    buffer = await extractFrame();
  } else {
    buffer = await original.arrayBuffer();
  }

  console.log(
    `[getThumbnail] creating image using sharp. Original buffer size: ${buffer.byteLength} bytes`,
  );

  const thumbBuffer = await sharp(buffer)
    .resize({ width, withoutEnlargement: true, fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  await Bun.write(cachePath, thumbBuffer);
  return Bun.file(cachePath);
}
