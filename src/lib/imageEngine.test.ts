import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../data/presets';
import { buildCssFilter, computeCrop, normalizedRotation, outputDimensions } from './imageEngine';

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
