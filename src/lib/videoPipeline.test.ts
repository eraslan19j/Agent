import { describe, expect, it } from 'vitest';
import { atempoFilters, creativeVideoFilters, exportedVideoDuration } from './videoPipeline';
import { CREATIVE_EFFECTS } from './creativeEffects';
import type { VideoClip } from '../types/video';

const clip = (id: string, transition: 'none' | 'fade' = 'none'): VideoClip => ({ id, name:id, source:'blob:a', blob:new Blob(['v'],{type:'video/mp4'}), duration:4, trimStart:0, trimEnd:4, speed:1, volume:1, muted:false, rotation:0, transition });

describe('video export planning', () => {
  it('chains atempo safely for the full 0.25–4x range', () => {
    for (const speed of [.25, .5, 1, 1.5, 2, 4]) {
      const filters = atempoFilters(speed);
      const factors = filters.map(filter => Number(filter.split('=')[1]));
      for (const factor of factors) { expect(factor).toBeGreaterThanOrEqual(.5); expect(factor).toBeLessThanOrEqual(2); }
      expect(factors.reduce((product, factor) => product * factor, 1)).toBeCloseTo(speed, 4);
    }
  });

  it('has an export plan for every creative effect without promising 4K', () => {
    for (const effect of CREATIVE_EFFECTS) {
      const filters = creativeVideoFilters({ id:effect.id,intensity:effect.defaultIntensity,particles:false,particleIntensity:35,dateStamp:false,dateStampText:'' });
      expect(Array.isArray(filters)).toBe(true);
      expect(filters.join(' ')).not.toContain('3840');
    }
    expect(creativeVideoFilters({ id:'light-leak',intensity:44,particles:false,particleIntensity:35,dateStamp:false,dateStampText:'' })).toEqual([]);
  });

  it('keeps pixelate output geometry bounded', () => {
    const filters = creativeVideoFilters({ id:'pixelate',intensity:34,particles:false,particleIntensity:35,dateStamp:false,dateStampText:'' });
    expect(filters[0]).toContain('scale=iw/');
    expect(filters[1]).toContain('scale=iw*');
  });

  it('subtracts only real fade overlap from export duration', () => {
    expect(exportedVideoDuration([clip('a'),clip('b'),clip('c')])).toBe(12);
    expect(exportedVideoDuration([clip('a','fade'),clip('b','fade'),clip('c')])).toBeCloseTo(11.3);
  });
});
