import { FFmpeg } from '@ffmpeg/ffmpeg';

export interface FfmpegSmokeResult {
  coreVersion: string;
  compressedBytes: number;
  uncompressedBytes: number;
  inputBytes: number;
  outputBytes: number;
  elapsedMs: number;
  progressEvents: number;
  logs: string[];
  output: Blob;
}

/**
 * Aşama 1 teknik kapısıdır; kullanıcı arayüzündeki bir video editörü değildir.
 * Gerçek bir WebM oluşturur, Worker içinde MP4/H.264 + AAC çıktıya dönüştürür.
 */
export async function runFfmpegSmokeTest(): Promise<FfmpegSmokeResult> {
  const manifest = await fetch('/ffmpeg/manifest.json').then(async response => {
    if (!response.ok) throw new Error('FFmpeg manifesti okunamadı.');
    return response.json() as Promise<{ version: string; compressedBytes: number; uncompressedBytes: number }>;
  });
  const ffmpeg = new FFmpeg();
  const logs: string[] = [];
  let progressEvents = 0;
  ffmpeg.on('log', ({ message }) => { logs.push(message); });
  ffmpeg.on('progress', () => { progressEvents += 1; });
  const startedAt = performance.now();
  try {
    await ffmpeg.load({
      coreURL: '/ffmpeg/ffmpeg-core.js',
      wasmURL: '/ffmpeg/ffmpeg-core.wasm.br',
    });
    await ffmpeg.exec([
      '-f', 'lavfi', '-i', 'testsrc=size=64x64:rate=10',
      '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=44100',
      '-t', '1', '-c:v', 'libvpx', '-b:v', '80k', '-c:a', 'libvorbis',
      '-shortest', 'smoke-input.webm',
    ]);
    await ffmpeg.exec([
      '-i', 'smoke-input.webm', '-c:v', 'libx264', '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', 'smoke-output.mp4',
    ]);
    const input = await ffmpeg.readFile('smoke-input.webm');
    const output = await ffmpeg.readFile('smoke-output.mp4');
    if (typeof input === 'string' || typeof output === 'string') throw new Error('FFmpeg binary çıktı üretmedi.');
    if (input.length < 100 || output.length < 500) throw new Error('FFmpeg çıktısı beklenenden küçük.');
    const signature = new TextDecoder().decode(output.slice(4, 8));
    if (signature !== 'ftyp') throw new Error('MP4 dosya imzası doğrulanamadı.');
    if (!logs.some(line => line.includes('Video: h264')) || !logs.some(line => line.includes('Audio: aac'))) {
      throw new Error('MP4 video/ses akışları doğrulanamadı.');
    }
    await Promise.allSettled([ffmpeg.deleteFile('smoke-input.webm'), ffmpeg.deleteFile('smoke-output.mp4')]);
    return {
      coreVersion: manifest.version,
      compressedBytes: manifest.compressedBytes,
      uncompressedBytes: manifest.uncompressedBytes,
      inputBytes: input.length,
      outputBytes: output.length,
      elapsedMs: Math.round(performance.now() - startedAt),
      progressEvents,
      logs,
      output: new Blob([Uint8Array.from(output).buffer], { type: 'video/mp4' }),
    };
  } finally {
    ffmpeg.terminate();
  }
}
