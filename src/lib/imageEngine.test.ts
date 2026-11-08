import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../data/presets';
import { buildCssFilter, canvasBackingSize, computeCrop, normalizedRotation, orientationDimensions, outputDimensions, previewDimensions, readJpegDimensions, readJpegOrientation } from './imageEngine';

describe('image engine geometry', () => {
  it('crops a landscape source to a centered square', () => {
    expect(computeCrop(1600, 900, '1:1')).toEqual({ x: 350, y: 0, width: 900, height: 900 });
  });

  it('crops a portrait source to 16:9 without upscaling', () => {
    const crop = computeCrop(1000, 1600, '16:9');
    expect(crop.width).toBe(1000);
    expect(crop.height).toBe(562.5);
    expect(crop.y).toBe(518.75);
  });

  it('keeps original dimensions for original ratio', () => {
    expect(computeCrop(1200, 800, 'original')).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });

  it('swaps output dimensions on quarter turns', () => {
    const result = outputDimensions(1600, 900, { ...DEFAULT_SETTINGS, rotation: 90 }, 4096);
    expect(result.width).toBe(900);
    expect(result.height).toBe(1600);
  });

  it('limits exports while preserving aspect ratio', () => {
    const result = outputDimensions(8000, 4000, DEFAULT_SETTINGS, 2000);
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1000);
  });

  it('normalizes negative and repeated rotations', () => {
    expect(normalizedRotation(-90)).toBe(270);
    expect(normalizedRotation(450)).toBe(90);
  });

  it('restores a visible original preview after a square crop', () => {
    const square = previewDimensions(500, 500, 1600, 900, { ...DEFAULT_SETTINGS, aspectRatio: '1:1' });
    const original = previewDimensions(500, 500, 1600, 900, { ...DEFAULT_SETTINGS, aspectRatio: 'original' });
    expect(square).toMatchObject({ width: 500, height: 500, aspectRatio: 1 });
    expect(original.width).toBe(500);
    expect(original.height).toBe(281);
    expect(original.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('fits rotated previews without arbitrary shrinking or black side gaps', () => {
    const preview = previewDimensions(600, 400, 1600, 900, { ...DEFAULT_SETTINGS, rotation: 90 });
    expect(preview).toMatchObject({ width: 225, height: 400 });
    expect(preview.aspectRatio).toBeCloseTo(9 / 16);
  });

  it('keeps portrait previews visible in a narrow mobile stage', () => {
    const preview = previewDimensions(300, 500, 1200, 1800, DEFAULT_SETTINGS);
    expect(preview).toMatchObject({ width: 300, height: 450 });
  });
  it('fits a panorama without distorting its aspect ratio', () => {
    const preview = previewDimensions(360, 700, 4000, 1000, DEFAULT_SETTINGS);
    expect(preview).toMatchObject({ width: 360, height: 90, aspectRatio: 4 });
  });

  it('contains extra-long and 8000px sources without upscaling the stage', () => {
    expect(previewDimensions(320, 500, 1000, 4000, DEFAULT_SETTINGS)).toMatchObject({ width: 125, height: 500, aspectRatio: .25 });
    const large = previewDimensions(320, 500, 8000, 8000, DEFAULT_SETTINGS);
    expect(large).toMatchObject({ width: 320, height: 320, aspectRatio: 1 });
  });
});

describe('canvas backing resolution', () => {
  it('matches CSS size times device pixel ratio', () => {
    expect(canvasBackingSize(320, 180, 2)).toEqual({ width: 640, height: 360, ratio: 2 });
  });

  it('caps the backing store to the mobile pixel budget', () => {
    const result = canvasBackingSize(2000, 2000, 3, 1_000_000);
    expect(result.width * result.height).toBeLessThanOrEqual(1_002_000);
    expect(result.ratio).toBeLessThan(1);
  });

  it('handles an unmeasured container safely', () => {
    expect(canvasBackingSize(0, 0, 2)).toEqual({ width: 0, height: 0, ratio: 1 });
  });
});

function exifBuffer(orientation: number, littleEndian = true) {
  const buffer = new ArrayBuffer(40);
  const view = new DataView(buffer);
  view.setUint16(0, 0xFFD8);
  view.setUint8(2, 0xFF); view.setUint8(3, 0xE1);
  view.setUint16(4, 34);
  view.setUint32(6, 0x45786966);
  view.setUint16(10, 0);
  view.setUint16(12, littleEndian ? 0x4949 : 0x4D4D);
  view.setUint16(14, 42, littleEndian);
  view.setUint32(16, 8, littleEndian);
  view.setUint16(20, 1, littleEndian);
  view.setUint16(22, 0x0112, littleEndian);
  view.setUint16(24, 3, littleEndian);
  view.setUint32(26, 1, littleEndian);
  view.setUint16(30, orientation, littleEndian);
  view.setUint16(38, 0xFFD9);
  return buffer;
}

describe('EXIF orientation', () => {
  it('reads little and big endian orientation metadata', () => {
    expect(readJpegOrientation(exifBuffer(6))).toBe(6);
    expect(readJpegOrientation(exifBuffer(8, false))).toBe(8);
  });

  it('falls back safely for non-JPEG data', () => {
    expect(readJpegOrientation(new ArrayBuffer(12))).toBe(1);
  });

  it('reads raw SOF dimensions to detect whether a decoder already applied EXIF', () => {
    const buffer = new ArrayBuffer(28);
    const view = new DataView(buffer);
    view.setUint16(0, 0xFFD8);
    view.setUint8(2, 0xFF); view.setUint8(3, 0xC0);
    view.setUint16(4, 17);
    view.setUint16(7, 200);
    view.setUint16(9, 400);
    expect(readJpegDimensions(buffer)).toEqual({ width: 400, height: 200 });
  });

  it('swaps dimensions only for quarter-turn EXIF transforms', () => {
    expect(orientationDimensions(1200, 800, 6)).toEqual({ width: 800, height: 1200 });
    expect(orientationDimensions(1200, 800, 2)).toEqual({ width: 1200, height: 800 });
  });
});

describe('filter generation', () => {
  it('keeps neutral values readable', () => {
    expect(buildCssFilter(DEFAULT_SETTINGS)).toContain('brightness(1.000)');
    expect(buildCssFilter(DEFAULT_SETTINGS)).toContain('contrast(1.000)');
  });

  it('applies exposure and user contrast', () => {
    const filter = buildCssFilter({ ...DEFAULT_SETTINGS, exposure: 80, contrast: 120 });
    expect(filter).toContain('brightness(1.500)');
    expect(filter).toContain('contrast(1.200)');
  });

  it('creates a clearly visible monochrome preset', () => {
    const filter = buildCssFilter({ ...DEFAULT_SETTINGS, presetId: 'noir', intensity: 85 });
    expect(filter).toContain('grayscale(0.850)');
    expect(filter).not.toContain('contrast(1.000)');
  });

  it('renders clarity and soft focus in the live filter', () => {
    const filter = buildCssFilter({ ...DEFAULT_SETTINGS, clarity: 50, blur: 15 });
    expect(filter).toContain('contrast(1.227)');
    expect(filter).toContain('blur(1.5px)');
  });

  it('supports projects saved before clarity and blur existed', () => {
    const legacy = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete legacy.clarity;
    delete legacy.blur;
    const filter = buildCssFilter(legacy as unknown as typeof DEFAULT_SETTINGS);
    expect(filter).not.toContain('NaN');
    expect(filter).toContain('blur(0.0px)');
  });

  it('does not apply selective light twice during export', () => {
    const settings = { ...DEFAULT_SETTINGS, highlights: 65, shadows: 65 };
    const preview = buildCssFilter(settings);
    const exportFilter = buildCssFilter(settings, undefined, false, false);
    expect(preview).not.toEqual(exportFilter);
    expect(exportFilter).toContain('brightness(1.000)');
  });
});
