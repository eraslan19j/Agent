import { describe, expect, it } from 'vitest';
import { backgroundAlpha, curveValue, straightenCoverScale } from './advancedImageEngine';
import { computeSettingsCrop, freshSettings } from './imageEngine';

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

  it('feathers background alpha instead of making a hard binary edge', () => {
    expect(backgroundAlpha(0, 100)).toBe(0);
    expect(backgroundAlpha(200, 100)).toBe(1);
    expect(backgroundAlpha(90, 100)).toBeGreaterThan(0);
    expect(backgroundAlpha(90, 100)).toBeLessThan(1);
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
});
