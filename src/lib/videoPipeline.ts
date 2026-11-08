import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { CreativeEffectSettings } from '../types';
import type { VideoClip, VideoDraft, VideoTextLayer } from '../types/video';
import { applyCreativeEffects, letterboxRatio } from './creativeEffects';
import { freshSettings } from './imageEngine';
import { clipOutputDuration, validateVideoDraft, videoDimensions } from './videoModel';

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

async function ffmpegCoreUrl() {
  const response = await fetch('/ffmpeg/ffmpeg-core.js');
  if (!response.ok) throw new Error('FFmpeg çekirdeği yüklenemedi.');
  // Blob URL prevents Vite dev from rewriting the public ESM core as a source import.
  return URL.createObjectURL(await response.blob());
}

async function loadFfmpeg(signal?: AbortSignal) {
  const ffmpeg = new FFmpeg(); const coreURL = await ffmpegCoreUrl();
  try { await ffmpeg.load({ coreURL, wasmURL: '/ffmpeg/ffmpeg-core.wasm.br' }, { signal }); }
  finally { URL.revokeObjectURL(coreURL); }
  return ffmpeg;
}

/** Technical local FFmpeg gate; this is not the user-facing video editor. */
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
    const coreURL = await ffmpegCoreUrl();
    try { await ffmpeg.load({ coreURL, wasmURL: '/ffmpeg/ffmpeg-core.wasm.br' }); }
    finally { URL.revokeObjectURL(coreURL); }
    await ffmpeg.exec(['-f','lavfi','-i','testsrc=size=64x64:rate=10','-f','lavfi','-i','sine=frequency=880:sample_rate=44100','-t','1','-c:v','libvpx','-b:v','80k','-c:a','libvorbis','-shortest','smoke-input.webm']);
    await ffmpeg.exec(['-i','smoke-input.webm','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','smoke-output.mp4']);
    const input = await ffmpeg.readFile('smoke-input.webm');
    const output = await ffmpeg.readFile('smoke-output.mp4');
    if (typeof input === 'string' || typeof output === 'string') throw new Error('FFmpeg binary çıktı üretmedi.');
    if (input.length < 100 || output.length < 500) throw new Error('FFmpeg çıktısı beklenenden küçük.');
    const signature = new TextDecoder().decode(output.slice(4, 8));
    if (signature !== 'ftyp') throw new Error('MP4 dosya imzası doğrulanamadı.');
    if (!logs.some(line => line.includes('Video: h264')) || !logs.some(line => line.includes('Audio: aac'))) throw new Error('MP4 video/ses akışları doğrulanamadı.');
    await Promise.allSettled([ffmpeg.deleteFile('smoke-input.webm'),ffmpeg.deleteFile('smoke-output.mp4')]);
    return { coreVersion: manifest.version, compressedBytes: manifest.compressedBytes, uncompressedBytes: manifest.uncompressedBytes, inputBytes: input.length, outputBytes: output.length, elapsedMs: Math.round(performance.now() - startedAt), progressEvents, logs, output: new Blob([Uint8Array.from(output).buffer], { type: 'video/mp4' }) };
  } finally { ffmpeg.terminate(); }
}

export interface VideoExportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  onStage?: (stage: 'load' | 'prepare' | 'encode' | 'verify') => void;
}

const abortError = () => new DOMException('Video dışa aktarma iptal edildi.', 'AbortError');
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw abortError(); };
const blobBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const extension = (blob: Blob) => blob.type.includes('webm') ? 'webm' : blob.type.includes('quicktime') ? 'mov' : 'mp4';

export function atempoFilters(speed: number) {
  const filters: string[] = []; let remaining = speed;
  while (remaining < 0.5) { filters.push('atempo=0.5'); remaining /= 0.5; }
  while (remaining > 2) { filters.push('atempo=2'); remaining /= 2; }
  filters.push(`atempo=${remaining.toFixed(4)}`);
  return filters;
}

/** FFmpeg counterpart of the shared creative model; overlays use the same Canvas engine. */
export function creativeVideoFilters(creative: CreativeEffectSettings) {
  const amount = creative.intensity / 100;
  if (creative.id === 'none' || amount <= 0) return [] as string[];
  const sigma = (2 + amount * 5).toFixed(2);
  const noise = Math.max(2, Math.round(amount * 18));
  switch (creative.id) {
    case 'glow': return [`gblur=sigma=${sigma}`, `eq=brightness=${(amount * .08).toFixed(3)}`];
    case 'soft-focus': return [`gblur=sigma=${sigma}`];
    case 'vhs': return [`hue=s=${(1 - amount * .25).toFixed(3)}`, `noise=alls=${noise}:allf=t`];
    case 'film': return [`colorbalance=rs=${(amount * .08).toFixed(3)}:bs=-${(amount * .06).toFixed(3)}`, `noise=alls=${noise}:allf=t`];
    case 'scanlines': return [`drawgrid=width=iw:height=4:thickness=1:color=black@${(amount * .28).toFixed(3)}`];
    case 'glitch': return [`noise=alls=${noise}:allf=t`, `eq=contrast=${(1 + amount * .12).toFixed(3)}`];
    case 'rgb-shift': return [`rgbashift=rh=${Math.round(amount * 6)}:bh=-${Math.round(amount * 6)}`];
    case 'shake': return [`rotate=${(amount * .006).toFixed(4)}*sin(12*t):fillcolor=black`];
    case 'pixelate': { const divisor = Math.max(2, Math.round(4 + amount * 12)); return [`scale=iw/${divisor}:ih/${divisor}`, `scale=iw*${divisor}:ih*${divisor}:flags=neighbor`]; }
    case 'monochrome': return ['hue=s=0'];
    case 'duotone': return ['hue=s=0', `colorbalance=rs=${(amount * .2).toFixed(3)}:bs=${(amount * .16).toFixed(3)}`];
    case 'sepia': return [`colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`];
    case 'vignette': return [`vignette=PI/${(7 - amount * 3).toFixed(3)}`];
    case 'letterbox': { const ratio = letterboxRatio(creative.intensity); return [`drawbox=x=0:y=0:w=iw:h=ih*${ratio}:color=black:t=fill`, `drawbox=x=0:y=ih*(1-${ratio}):w=iw:h=ih*${ratio}:color=black:t=fill`]; }
    // These two are generated by the shared Canvas engine and overlaid below.
    case 'light-leak': case 'flare': return [];
  }
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Video katmanı oluşturulamadı.')), 'image/png'));
}

async function creativeOverlay(width: number, height: number, creative: CreativeEffectSettings, includeLight: boolean) {
  const hasLight = includeLight && (creative.id === 'light-leak' || creative.id === 'flare') && creative.intensity > 0;
  if (!hasLight && !creative.particles && !creative.dateStamp) return null;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) return null;
  const settings = freshSettings(); settings.creative = { ...creative, id: hasLight ? creative.id : 'none', dateStamp: creative.dateStamp, particles: creative.particles };
  applyCreativeEffects(context, width, height, settings, { forceBackend: 'canvas2d', time: 0 });
  return canvasBlob(canvas);
}

async function textOverlay(width: number, height: number, layer: VideoTextLayer) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Metin katmanı oluşturulamadı.');
  const size = Math.max(12, layer.size / 100 * Math.min(width, height));
  context.font = `${layer.kind === 'sticker' ? 400 : 650} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0,0,0,.55)'; context.shadowBlur = size * .12;
  context.fillStyle = layer.color; context.fillText(layer.text.slice(0, 80), layer.x * width, layer.y * height, width * .88);
  return canvasBlob(canvas);
}

async function hasAudio(ffmpeg: FFmpeg, input: string, index: number) {
  const probe = `probe-${index}.txt`;
  await ffmpeg.ffprobe(['-v','error','-select_streams','a','-show_entries','stream=index','-of','csv=p=0',input,'-o',probe]);
  // ffmpeg.wasm may return -1 even after ffprobe successfully writes its output file.
  let data: Awaited<ReturnType<FFmpeg['readFile']>>;
  try { data = await ffmpeg.readFile(probe); } catch { return false; }
  const found = typeof data === 'string' ? data.trim().length > 0 : new TextDecoder().decode(data).trim().length > 0;
  await ffmpeg.deleteFile(probe);
  return found;
}

function transitionDuration(previous: VideoClip, next: VideoClip) {
  return previous.transition === 'fade' ? Math.min(.35, clipOutputDuration(previous) / 2, clipOutputDuration(next) / 2) : 0;
}

export function exportedVideoDuration(clips: VideoClip[]) {
  return clips.reduce((total, clip, index) => total + clipOutputDuration(clip) - (index ? transitionDuration(clips[index - 1], clip) : 0), 0);
}

export async function exportVideo(draft: VideoDraft, options: VideoExportOptions = {}): Promise<Blob> {
  const validation = validateVideoDraft(draft.clips); if (validation) throw new Error(validation);
  const { signal } = options; checkAbort(signal);
  options.onStage?.('load');
  const ffmpeg = await loadFfmpeg(signal);
  const files = new Set<string>();
  const args: string[] = [];
  const graph: string[] = [];
  const addInput = (name: string, inputArgs: string[] = []) => { const index = args.filter((value, i) => value === '-i' && args[i - 1] !== '-filter_complex').length; args.push(...inputArgs, '-i', name); return index; };
  const write = async (name: string, blob: Blob) => { checkAbort(signal); await ffmpeg.writeFile(name, await blobBytes(blob), { signal }); files.add(name); };
  const onProgress = ({ progress }: { progress: number }) => options.onProgress?.(Math.max(0, Math.min(1, progress)));
  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => { logs.push(message); if (logs.length > 120) logs.shift(); };
  ffmpeg.on('progress', onProgress);
  ffmpeg.on('log', onLog);
  try {
    options.onStage?.('prepare');
    const dimensions = videoDimensions(draft.aspectRatio, draft.resolution);
    const clipLabels: { video: string; audio: string; duration: number }[] = [];
    for (let index = 0; index < draft.clips.length; index += 1) {
      checkAbort(signal);
      const clip = draft.clips[index];
      const input = `clip-${index}.${extension(clip.blob)}`;
      await write(input, clip.blob);
      const videoIndex = addInput(input);
      const audio = await hasAudio(ffmpeg, input, index);
      let audioIndex = videoIndex;
      if (!audio) audioIndex = addInput('anullsrc=channel_layout=stereo:sample_rate=44100', ['-f','lavfi','-t',String(clip.duration)]);
      const rotation = clip.rotation === 90 ? 'transpose=1' : clip.rotation === 270 ? 'transpose=2' : clip.rotation === 180 ? 'transpose=1,transpose=1' : null;
      const videoFilters = [`trim=start=${clip.trimStart}:end=${clip.trimEnd}`, `setpts=(PTS-STARTPTS)/${clip.speed}`, rotation, `scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=increase`, `crop=${dimensions.width}:${dimensions.height}`, 'fps=30', 'setsar=1', 'format=yuv420p'].filter(Boolean).join(',');
      const audioFilters = [`atrim=start=${clip.trimStart}:end=${clip.trimEnd}`, 'asetpts=PTS-STARTPTS', ...atempoFilters(clip.speed), `volume=${clip.muted ? 0 : clip.volume}`].join(',');
      graph.push(`[${videoIndex}:v]${videoFilters}[v${index}]`, `[${audioIndex}:a]${audioFilters}[a${index}]`);
      clipLabels.push({ video: `v${index}`, audio: `a${index}`, duration: clipOutputDuration(clip) });
    }
    let currentVideo = clipLabels[0].video, currentAudio = clipLabels[0].audio, duration = clipLabels[0].duration;
    for (let index = 1; index < clipLabels.length; index += 1) {
      const next = clipLabels[index]; const fade = transitionDuration(draft.clips[index - 1], draft.clips[index]);
      const outV = `vx${index}`, outA = `ax${index}`;
      if (fade > 0) {
        graph.push(`[${currentVideo}][${next.video}]xfade=transition=fade:duration=${fade}:offset=${duration - fade}[${outV}]`, `[${currentAudio}][${next.audio}]acrossfade=d=${fade}[${outA}]`);
        duration += next.duration - fade;
      } else {
        graph.push(`[${currentVideo}][${currentAudio}][${next.video}][${next.audio}]concat=n=2:v=1:a=1[${outV}][${outA}]`);
        duration += next.duration;
      }
      currentVideo = outV; currentAudio = outA;
    }
    const creative = [...creativeVideoFilters(draft.creative), `scale=${dimensions.width}:${dimensions.height}`, 'setsar=1'];
    graph.push(`[${currentVideo}]${creative.join(',')}[veffect]`);
    currentVideo = 'veffect';
    const overlays: { blob: Blob; start?: number; end?: number }[] = [];
    const light = await creativeOverlay(dimensions.width, dimensions.height, { ...draft.creative, particles: false, dateStamp: false }, true); if (light) overlays.push({ blob: light });
    const particles = await creativeOverlay(dimensions.width, dimensions.height, { ...draft.creative, id: 'none' }, false); if (particles) overlays.push({ blob: particles });
    for (const layer of draft.texts) overlays.push({ blob: await textOverlay(dimensions.width, dimensions.height, layer), start: layer.start, end: layer.end });
    for (let index = 0; index < overlays.length; index += 1) {
      const overlay = overlays[index]; const name = `overlay-${index}.png`; await write(name, overlay.blob);
      const inputIndex = addInput(name, ['-loop','1']); const output = `vo${index}`;
      const enable = overlay.start !== undefined ? `:enable='between(t,${Math.max(0, overlay.start)},${Math.max(overlay.start, overlay.end ?? overlay.start)})'` : '';
      graph.push(`[${currentVideo}][${inputIndex}:v]overlay=0:0:eof_action=pass${enable}[${output}]`); currentVideo = output;
    }
    let finalAudio = currentAudio;
    if (draft.music) {
      await write('music-input', draft.music.blob); const musicIndex = addInput('music-input');
      const fadeOutStart = Math.max(0, duration - draft.music.fadeOut);
      graph.push(`[${musicIndex}:a]atrim=0:${duration},asetpts=PTS-STARTPTS,volume=${draft.music.volume},afade=t=in:st=0:d=${draft.music.fadeIn},afade=t=out:st=${fadeOutStart}:d=${draft.music.fadeOut}[music]`, `[${currentAudio}][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
      finalAudio = 'aout';
    }
    graph.push(`[${currentVideo}]null[vout]`);
    options.onStage?.('encode'); checkAbort(signal);
    const code = await ffmpeg.exec([...args, '-filter_complex',graph.join(';'), '-map','[vout]','-map',`[${finalAudio}]`,'-t',String(duration),'-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','video-output.mp4'], -1, { signal });
    if (code !== 0) { console.error('[video-export]', logs.slice(-40).join('\n')); throw new Error('Video kodlama tamamlanamadı. Taslağı kısaltıp 720p deneyin.'); }
    options.onStage?.('verify'); checkAbort(signal);
    const output = await ffmpeg.readFile('video-output.mp4'); files.add('video-output.mp4');
    if (typeof output === 'string' || output.length < 500 || new TextDecoder().decode(output.slice(4, 8)) !== 'ftyp') throw new Error('MP4 çıktı doğrulanamadı. Daha kısa bir taslak veya 720p deneyin.');
    options.onProgress?.(1);
    return new Blob([Uint8Array.from(output).buffer], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', onProgress);
    ffmpeg.off('log', onLog);
    await Promise.allSettled([...files].map(file => ffmpeg.deleteFile(file)));
    ffmpeg.terminate();
  }
}
