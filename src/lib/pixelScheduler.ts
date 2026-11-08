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

export async function processCanvasPixels(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  const image = context.getImageData(0, 0, width, height);
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
