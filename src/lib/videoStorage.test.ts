import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteVideoDraft, listVideoDrafts, loadVideoDraft, releaseVideoDraft, saveVideoDraft } from './videoStorage';
import type { VideoDraft } from '../types/video';

const draft = (): VideoDraft => ({
  id: 'draft-1', name: 'Müşteri videosu', createdAt: 1, updatedAt: 2, aspectRatio: '9:16', resolution: 1080,
  creative: { id: 'vhs', intensity: 36, particles: true, particleIntensity: 35, dateStamp: true, dateStampText: '07.11.2026' }, texts: [],
  clips: [{ id: 'clip-1', name: 'a.mp4', source: 'blob:runtime', blob: new Blob(['video-data'], { type: 'video/mp4' }), duration: 8, trimStart: 1, trimEnd: 7, speed: 2, volume: .8, muted: false, rotation: 90, transition: 'fade' }],
  music: { name: 'music.mp3', source: 'blob:music', blob: new Blob(['audio-data'], { type: 'audio/mpeg' }), volume: .4, fadeIn: 1, fadeOut: 2 },
});

describe('IndexedDB video drafts', () => {
  beforeEach(async () => { await deleteVideoDraft('draft-1'); });

  it('persists clip and music blobs with full editing state', async () => {
    const source = draft();
    const saved = await saveVideoDraft(source);
    expect(saved.clips[0].source).not.toBe(source.clips[0].source);
    expect(saved.clips[0].blob.size).toBeGreaterThan(0);
    expect(saved.music?.blob.type).toBe('audio/mpeg');
    releaseVideoDraft(saved);

    const loaded = await loadVideoDraft('draft-1');
    expect(loaded).toMatchObject({ name: 'Müşteri videosu', aspectRatio: '9:16', resolution: 1080 });
    expect(loaded?.clips[0]).toMatchObject({ trimStart: 1, trimEnd: 7, speed: 2, rotation: 90, transition: 'fade' });
    expect(loaded?.creative.id).toBe('vhs');
    expect(loaded?.music?.fadeOut).toBe(2);
    expect(await listVideoDrafts()).toEqual([{ id: 'draft-1', name: 'Müşteri videosu', updatedAt: 2, duration: 3, clipCount: 1 }]);
    releaseVideoDraft(loaded);
  });

  it('deletes a draft without affecting other records', async () => {
    await saveVideoDraft(draft());
    await deleteVideoDraft('draft-1');
    expect(await loadVideoDraft('draft-1')).toBeNull();
    expect(await listVideoDrafts()).toEqual([]);
  });
});
