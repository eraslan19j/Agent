/// <reference lib="webworker" />
import { processPixelData } from '../lib/pixelProcessing';
import type { EditSettings } from '../types';

interface PixelJob { id: number; width: number; height: number; settings: EditSettings; buffer: ArrayBuffer; }
self.onmessage = (event: MessageEvent<PixelJob>) => {
  const { id, width, height, settings, buffer } = event.data;
  const pixels = new Uint8ClampedArray(buffer);
  processPixelData(pixels, width, height, settings);
  self.postMessage({ id, buffer: pixels.buffer }, [pixels.buffer]);
};
