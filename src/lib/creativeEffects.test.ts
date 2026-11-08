import { describe, expect, it } from 'vitest';
import { CREATIVE_EFFECTS, creativeNoise, formatCreativeDate, hasCreativeEffect, letterboxRatio, normalizeCreativeSettings } from './creativeEffects';
import { freshSettings } from './imageEngine';

const creative = (id: 'glow' | 'vhs' | 'letterbox', intensity = 40) => ({ ...freshSettings().creative, id, intensity });

describe('shared creative effects', () => {
  it('covers every requested lightweight effect with unique ids', () => {
    const ids = CREATIVE_EFFECTS.map(effect => effect.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['glow','soft-focus','light-leak','flare','vhs','film','scanlines','glitch','rgb-shift','shake','pixelate','monochrome','duotone','sepia','vignette','letterbox']));
  });

  it('keeps defaults bounded and marks animated effects explicitly', () => {
    for (const effect of CREATIVE_EFFECTS) {
      expect(effect.defaultIntensity).toBeGreaterThanOrEqual(0);
      expect(effect.defaultIntensity).toBeLessThanOrEqual(75);
    }
    expect(CREATIVE_EFFECTS.filter(effect => effect.animated).map(effect => effect.id)).toEqual(expect.arrayContaining(['vhs','film','glitch','shake']));
    expect(CREATIVE_EFFECTS.find(effect => effect.id === 'glow')?.animated).toBe(false);
  });

  it('normalizes legacy and malformed settings without sharing nested state', () => {
    expect(normalizeCreativeSettings({ id: 'unknown' as 'glow', intensity: 999, particleIntensity: -4, dateStampText: 'x'.repeat(30) })).toMatchObject({ id: 'none', intensity: 0, particleIntensity: 0, dateStampText: 'x'.repeat(16) });
    expect(normalizeCreativeSettings({ id: 'glow' })).toMatchObject({ id: 'glow', intensity: 42 });
    const first = freshSettings({ creative: creative('glow') });
    const second = freshSettings();
    first.creative.intensity = 90;
    expect(second.creative).toMatchObject({ id: 'none', intensity: 0, particles: false });
  });

  it('restores valid creative settings through the existing project model', () => {
    const restored = freshSettings({ creative: { ...creative('vhs', 36), particles: true, particleIntensity: 28, dateStamp: true, dateStampText: '07.11.2026' } });
    expect(restored.creative).toEqual({ id: 'vhs', intensity: 36, particles: true, particleIntensity: 28, dateStamp: true, dateStampText: '07.11.2026' });
  });

  it('uses deterministic photo noise and explicit video frame time', () => {
    expect(creativeNoise(4, 0)).toBe(creativeNoise(4, 0));
    expect(creativeNoise(4, 0)).toBeGreaterThanOrEqual(0);
    expect(creativeNoise(4, 0)).toBeLessThan(1);
    expect(creativeNoise(4, 1)).not.toBe(creativeNoise(4, 0));
  });

  it('bounds letterbox size and disables it at zero intensity', () => {
    expect(letterboxRatio(0)).toBe(0);
    expect(letterboxRatio(50)).toBeCloseTo(.06);
    expect(letterboxRatio(100)).toBeCloseTo(.12);
    expect(letterboxRatio(400)).toBeCloseTo(.12);
  });

  it('formats a stable local date stamp for persisted output', () => {
    expect(formatCreativeDate(new Date(2026, 10, 7))).toBe('07.11.2026');
  });

  it('activates only visible effects and optional overlays', () => {
    const settings = freshSettings();
    expect(hasCreativeEffect(settings)).toBe(false);
    settings.creative = creative('letterbox', 0);
    expect(hasCreativeEffect(settings)).toBe(false);
    settings.creative.particles = true;
    expect(hasCreativeEffect(settings)).toBe(true);
    settings.creative.particles = false;
    settings.creative.dateStamp = true;
    settings.creative.dateStampText = '07.11.2026';
    expect(hasCreativeEffect(settings)).toBe(true);
  });
});
