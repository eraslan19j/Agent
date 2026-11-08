import { describe, expect, it } from 'vitest';
import { curveValue, straightenCoverScale } from './advancedImageEngine';
import { computeSettingsCrop, freshSettings } from './imageEngine';
import { processPixelData } from './pixelProcessing';

describe('advanced image geometry and pixels', () => {
  it('covers a square at 45 degrees without empty corners', () => {
    expect(straightenCoverScale(1000, 1000, 45)).toBeCloseTo(Math.SQRT2, 4);
    expect(straightenCoverScale(1000, 1000, 0)).toBe(1);
    expect(straightenCoverScale(1000, 1000, 90)).toBeCloseTo(1, 4);
  });

  it('calculates enough cover for a landscape straighten', () => {
    expect(straightenCoverScale(1600, 900, 8)).toBeGreaterThan(1.05);
  });

  it('keeps neutral curves lossless', () => {
    for (const value of [0, 32, 128, 200, 255]) expect(curveValue(value, { curveShadows: 0, curveMidtones: 0, curveHighlights: 0 })).toBe(value);
  });

  it('applies curve weights to the intended tonal range', () => {
    const lifted = { curveShadows: 50, curveMidtones: 0, curveHighlights: 0 };
    expect(curveValue(30, lifted)).toBeGreaterThan(30);
    expect(curveValue(255, lifted)).toBe(255);
  });


  it('drops fields from removed tools when restoring a legacy project', () => {
    const legacy = { ...freshSettings(), repairs: [{ id: 'old' }], stickers: [{ id: 'old' }], brushStrokes: [{ id: 'old' }], backgroundRemoval: 80 };
    const restored = freshSettings(legacy) as unknown as Record<string, unknown>;
    expect(restored).not.toHaveProperty('repairs');
    expect(restored).not.toHaveProperty('stickers');
    expect(restored).not.toHaveProperty('brushStrokes');
    expect(restored).not.toHaveProperty('backgroundRemoval');
    expect(restored.texts).toEqual([]);
  });

  it('uses a real normalized free crop for output geometry', () => {
    expect(computeSettingsCrop(2000, 1000, { aspectRatio: 'free', crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 } })).toEqual({ x: 200, y: 200, width: 1000, height: 600 });
  });

  it('does not share nested settings between editor sessions', () => {
    const first = freshSettings(); const second = freshSettings();
    first.hsl.red.saturation = 50; first.frame.width = 20;
    expect(second.hsl.red.saturation).toBe(0);
    expect(second.frame.width).toBe(0);
  });

  it('keeps neutral worker pixels unchanged', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255, 200, 150, 100, 255]);
    expect([...processPixelData(pixels, 2, 1, freshSettings())]).toEqual([10, 20, 30, 255, 200, 150, 100, 255]);
  });

  it('applies local exposure only inside the mask', () => {
    const settings = freshSettings({ masks: [{ id: 'm', type: 'radial', x: .25, y: .5, radius: .2, angle: 0, feather: .5, exposure: 60, saturation: 0, temperature: 0 }] });
    const pixels = new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255]);
    processPixelData(pixels, 2, 1, settings);
    expect(pixels[0]).toBeGreaterThan(100);
    expect(pixels[4]).toBe(100);
  });


});
