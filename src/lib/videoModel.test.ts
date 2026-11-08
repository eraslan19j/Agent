import { describe, expect, it } from 'vitest';
import { clipOutputDuration, moveVideoClip, normalizeTrim, splitVideoClip, totalVideoDuration, validateVideoDraft, videoDimensions, videoMemoryWarning } from './videoModel';
import type { VideoClip } from '../types/video';

const clip = (id = 'a', overrides: Partial<VideoClip> = {}): VideoClip => ({ id, name: id, source: 'blob:a', blob: new Blob(['video'], { type: 'video/mp4' }), duration: 10, trimStart: 0, trimEnd: 10, speed: 1, volume: 1, muted: false, rotation: 0, transition: 'none', ...overrides });

describe('video timeline model', () => {
  it('normalizes trim bounds including very short clips', () => {
    expect(normalizeTrim(10, -2, 20)).toEqual({ trimStart: 0, trimEnd: 10 });
    expect(normalizeTrim(10, 9.99, 2)).toEqual({ trimStart: 9.96, trimEnd: 10 });
    expect(normalizeTrim(.02, 0, 10)).toEqual({ trimStart: 0, trimEnd: .02 });
  });

  it('calculates duration after trim and 0.25–4x speed', () => {
    expect(clipOutputDuration(clip('a', { trimStart: 2, trimEnd: 8, speed: 2 }))).toBe(3);
    expect(clipOutputDuration(clip('a', { trimStart: 2, trimEnd: 8, speed: .25 }))).toBe(24);
    expect(totalVideoDuration([clip(), clip('b', { speed: 4 })])).toBe(12.5);
  });

  it('splits only inside the visible trim range without sharing clip state', () => {
    const original = clip();
    const parts = splitVideoClip(original, 4, 'new');
    expect(parts?.map(part => [part.trimStart,part.trimEnd])).toEqual([[0,4],[4,10]]);
    expect(parts?.[0].id).toBe('a'); expect(parts?.[1].id).toBe('new');
    expect(splitVideoClip(original, 0, 'x')).toBeNull();
    expect(splitVideoClip(original, 10, 'x')).toBeNull();
    parts![1].trimEnd = 8; expect(original.trimEnd).toBe(10);
  });

  it('moves clips without crossing timeline boundaries', () => {
    const clips = [clip('a'),clip('b'),clip('c')];
    expect(moveVideoClip(clips,'b',-1).map(item => item.id)).toEqual(['b','a','c']);
    expect(moveVideoClip(clips,'a',-1)).toBe(clips);
    expect(moveVideoClip(clips,'c',1)).toBe(clips);
  });

  it('produces even 720p and 1080p dimensions for all supported ratios', () => {
    expect(videoDimensions('9:16',1080)).toEqual({ width:1080,height:1920 });
    expect(videoDimensions('16:9',720)).toEqual({ width:1280,height:720 });
    expect(videoDimensions('4:5',1080)).toEqual({ width:1080,height:1350 });
    expect(videoDimensions('1:1',720)).toEqual({ width:720,height:720 });
  });

  it('validates count and duration before export', () => {
    expect(validateVideoDraft([])).toContain('En az');
    expect(validateVideoDraft(Array.from({length:9},(_,i)=>clip(String(i))))).toContain('8');
    expect(validateVideoDraft([clip('a',{duration:121,trimEnd:121})])).toContain('120');
    expect(validateVideoDraft([clip()])).toBeNull();
  });

  it('warns about memory without promising 4K video', () => {
    expect(videoMemoryWarning([clip('a',{duration:40,trimEnd:40})],1080)).toContain('1080p');
    expect(videoMemoryWarning([clip('a',{duration:70,trimEnd:70})],720)).toContain('60');
    expect(videoMemoryWarning([clip()],720)).toBeNull();
  });
});
