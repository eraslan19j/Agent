import type { VideoAspectRatio, VideoClip, VideoResolution } from '../types/video';

export const VIDEO_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const;
export const MAX_VIDEO_CLIPS = 8;
export const MAX_VIDEO_DURATION = 120;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeTrim(duration: number, trimStart: number, trimEnd: number) {
  const safeDuration = Math.max(0, duration);
  if (safeDuration < 0.04) return { trimStart: 0, trimEnd: safeDuration };
  const start = clamp(Number.isFinite(trimStart) ? trimStart : 0, 0, safeDuration - 0.04);
  const end = clamp(Number.isFinite(trimEnd) ? trimEnd : safeDuration, start + 0.04, safeDuration);
  return { trimStart: start, trimEnd: Math.max(start, end) };
}

export function clipOutputDuration(clip: Pick<VideoClip, 'trimStart' | 'trimEnd' | 'speed'>) {
  return Math.max(0, (clip.trimEnd - clip.trimStart) / clip.speed);
}

export function totalVideoDuration(clips: Pick<VideoClip, 'trimStart' | 'trimEnd' | 'speed'>[]) {
  return clips.reduce((total, clip) => total + clipOutputDuration(clip), 0);
}

export function splitVideoClip(clip: VideoClip, atSourceTime: number, id: string): [VideoClip, VideoClip] | null {
  if (atSourceTime <= clip.trimStart + 0.04 || atSourceTime >= clip.trimEnd - 0.04) return null;
  const first: VideoClip = { ...clip, trimEnd: atSourceTime, transition: 'none' };
  const second: VideoClip = { ...clip, id, name: `${clip.name} · 2`, trimStart: atSourceTime };
  return [first, second];
}

export function moveVideoClip(clips: VideoClip[], id: string, direction: -1 | 1) {
  const index = clips.findIndex(clip => clip.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= clips.length) return clips;
  const next = [...clips];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function videoDimensions(aspectRatio: VideoAspectRatio, resolution: VideoResolution) {
  const long = resolution;
  if (aspectRatio === '16:9') return { width: long * 16 / 9, height: long };
  if (aspectRatio === '9:16') return { width: long, height: long * 16 / 9 };
  if (aspectRatio === '4:5') return { width: long, height: long * 5 / 4 };
  return { width: long, height: long };
}

export function validateVideoDraft(clips: VideoClip[]) {
  if (!clips.length) return 'En az bir video klip ekle.';
  if (clips.length > MAX_VIDEO_CLIPS) return `En fazla ${MAX_VIDEO_CLIPS} klip kullanılabilir.`;
  const duration = totalVideoDuration(clips);
  if (duration <= 0) return 'Klip süreleri boş olamaz.';
  if (duration > MAX_VIDEO_DURATION) return `Toplam süre ${MAX_VIDEO_DURATION} saniyeyi aşamaz.`;
  return null;
}

export function videoMemoryWarning(clips: VideoClip[], resolution: VideoResolution) {
  const duration = totalVideoDuration(clips);
  if (resolution === 1080 && duration > 30) return '1080p ve 30 saniyeden uzun çıktı cihazda yüksek bellek kullanabilir. 720p deneyebilir veya taslağı kısaltabilirsin.';
  if (duration > 60) return '60 saniyeden uzun çıktı bu cihazda yavaş olabilir. Export sırasında uygulamayı açık tut.';
  return null;
}

export async function detectVideoCapabilities() {
  const mediaRecorder = typeof MediaRecorder !== 'undefined';
  const canvasCapture = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  let webcodecs = false;
  let h264 = false;
  if (typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function') {
    try {
      const support = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width: 1280, height: 720, bitrate: 5_000_000, framerate: 30 });
      webcodecs = true; h264 = support.supported === true;
    } catch { webcodecs = false; }
  }
  const webmRecorder = mediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus');
  const mp4Recorder = mediaRecorder && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a');
  return {
    webcodecs,
    h264,
    mediaRecorder: mediaRecorder && canvasCapture,
    webmRecorder,
    mp4Recorder,
    webgl: (() => { try { return Boolean(document.createElement('canvas').getContext('webgl')); } catch { return false; } })(),
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  };
}

export type VideoCapabilities = Awaited<ReturnType<typeof detectVideoCapabilities>>;
