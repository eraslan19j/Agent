import { runFfmpegSmokeTest } from '../src/lib/videoPipeline';

declare global {
  interface Window {
    ffmpegSmoke?: { status: 'running' | 'passed' | 'failed'; result?: Record<string, unknown>; error?: string };
  }
}

const status = document.querySelector<HTMLPreElement>('#status')!;
const playback = document.querySelector<HTMLVideoElement>('#playback')!;
window.ffmpegSmoke = { status: 'running' };

async function verify() {
  try {
    const result = await runFfmpegSmokeTest();
    const url = URL.createObjectURL(result.output);
    playback.src = url;
    await new Promise<void>((resolve, reject) => {
      playback.onloadedmetadata = () => resolve();
      playback.onerror = () => reject(new Error('Üretilen MP4 tarayıcıda açılamadı.'));
    });
    if (Math.abs(playback.duration - 1) > .2 || playback.videoWidth !== 64 || playback.videoHeight !== 64) {
      throw new Error(`MP4 metadata hatası: ${playback.duration}s, ${playback.videoWidth}×${playback.videoHeight}`);
    }
    await playback.play();
    await new Promise(resolve => setTimeout(resolve, 150));
    playback.pause();
    const summary = {
      coreVersion: result.coreVersion,
      compressedBytes: result.compressedBytes,
      uncompressedBytes: result.uncompressedBytes,
      inputBytes: result.inputBytes,
      outputBytes: result.outputBytes,
      elapsedMs: result.elapsedMs,
      progressEvents: result.progressEvents,
      playbackDuration: playback.duration,
      playbackWidth: playback.videoWidth,
      playbackHeight: playback.videoHeight,
    };
    window.ffmpegSmoke = { status: 'passed', result: summary };
    status.textContent = `PASS\n${JSON.stringify(summary, null, 2)}`;
    URL.revokeObjectURL(url);
  } catch (reason) {
    const error = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
    window.ffmpegSmoke = { status: 'failed', error };
    status.textContent = `FAIL\n${error}`;
    console.error(reason);
  }
}

void verify();
