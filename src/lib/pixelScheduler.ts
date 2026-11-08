import { processPixelData } from './pixelProcessing';
import type { EditSettings } from '../types';

interface Job { resolve: (buffer: ArrayBuffer) => void; reject: (reason: Error) => void; timer: number; }
let worker: Worker | null = null;
let sequence = 0;
const jobs = new Map<number, Job>();

function rejectAll(reason: Error) {
  for (const job of jobs.values()) { window.clearTimeout(job.timer); job.reject(reason); }
  jobs.clear();
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/pixelWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = event => {
    const job = jobs.get(event.data.id); if (!job) return;
    jobs.delete(event.data.id); window.clearTimeout(job.timer); job.resolve(event.data.buffer);
  };
  worker.onerror = () => { rejectAll(new Error('Piksel worker’ı durdu. İşlem yeniden denenebilir.')); worker?.terminate(); worker = null; };
  return worker;
}

const abortError = () => new DOMException('Önizleme işlemi iptal edildi.', 'AbortError');

function processCancelable(image: ImageData, width: number, height: number, settings: EditSettings, signal: AbortSignal): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const target = new Worker(new URL('../workers/pixelWorker.ts', import.meta.url), { type: 'module' });
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('Piksel işlemi zaman aşımına uğradı.')), 60000);
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      target.terminate();
    };
    const finish = (reason?: Error, buffer?: ArrayBuffer) => {
      if (settled) return;
      settled = true; cleanup();
      if (reason) reject(reason); else resolve(buffer!);
    };
    const onAbort = () => finish(abortError());
    target.onmessage = event => finish(undefined, event.data.buffer as ArrayBuffer);
    target.onerror = () => finish(new Error('Piksel worker’ı durdu. İşlem yeniden denenebilir.'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }
    try { target.postMessage({ id: ++sequence, width, height, settings, buffer: image.data.buffer }, [image.data.buffer]); }
    catch (reason) { finish(reason instanceof Error ? reason : new Error('Piksel verisi worker’a aktarılamadı.')); }
  });
}

export async function processCanvasPixels(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings, signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
  const image = context.getImageData(0, 0, width, height);
  if (signal && typeof Worker !== 'undefined') {
    const buffer = await processCancelable(image, width, height, settings, signal);
    if (signal.aborted) throw abortError();
    context.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
    return;
  }
  if (typeof Worker === 'undefined') {
    processPixelData(image.data, width, height, settings); context.putImageData(image, 0, 0); return;
  }
  let target: Worker;
  try { target = getWorker(); } catch {
    processPixelData(image.data, width, height, settings); context.putImageData(image, 0, 0); return;
  }
  const id = ++sequence;
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const stalled = worker; worker = null; stalled?.terminate();
      rejectAll(new Error('Piksel işlemi zaman aşımına uğradı. Daha küçük çıktı deneyin.'));
    }, 60000);
    jobs.set(id, { resolve, reject, timer });
    try { target.postMessage({ id, width, height, settings, buffer: image.data.buffer }, [image.data.buffer]); }
    catch (reason) { jobs.delete(id); window.clearTimeout(timer); reject(reason instanceof Error ? reason : new Error('Piksel verisi worker’a aktarılamadı.')); }
  });
  context.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
}
