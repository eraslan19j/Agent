import { openDB, type DBSchema } from 'idb';
import type { VideoClip, VideoDraft, VideoDraftSummary, VideoMusic } from '../types/video';
import { totalVideoDuration } from './videoModel';

const DATABASE_NAME = 'myvision-video';
const STORE = 'drafts';

type StoredClip = Omit<VideoClip, 'source'>;
type StoredMusic = Omit<VideoMusic, 'source'>;
interface StoredDraft extends Omit<VideoDraft, 'clips' | 'music'> { clips: StoredClip[]; music?: StoredMusic; }
interface VideoDatabase extends DBSchema { drafts: { key: string; value: StoredDraft } }

function database() {
  return openDB<VideoDatabase>(DATABASE_NAME, 1, { upgrade(db) { db.createObjectStore(STORE, { keyPath: 'id' }); } });
}

function validateBlob(blob: Blob, kind: 'video' | 'audio') {
  if (!blob || blob.size === 0 || !blob.type.startsWith(`${kind}/`)) throw new Error(`${kind === 'video' ? 'Video' : 'Ses'} dosyası doğrulanamadı.`);
}

function toStored(draft: VideoDraft): StoredDraft {
  if (!draft.id || !draft.name.trim()) throw new Error('Video taslağı adı eksik.');
  for (const clip of draft.clips) validateBlob(clip.blob, 'video');
  if (draft.music) validateBlob(draft.music.blob, 'audio');
  return {
    ...draft,
    clips: draft.clips.map(({ source, ...clip }) => { void source; return clip; }),
    music: draft.music ? (({ source, ...music }) => { void source; return music; })(draft.music) : undefined,
  };
}

function fromStored(draft: StoredDraft): VideoDraft {
  return {
    ...draft,
    clips: draft.clips.map(clip => ({ ...clip, source: URL.createObjectURL(clip.blob) })),
    music: draft.music ? { ...draft.music, source: URL.createObjectURL(draft.music.blob) } : undefined,
  };
}

export async function saveVideoDraft(draft: VideoDraft) {
  const stored = toStored(draft);
  const db = await database();
  await db.put(STORE, stored);
  const persisted = await db.get(STORE, draft.id);
  if (!persisted || persisted.clips.length !== draft.clips.length) throw new Error('Video taslağı doğrulanamadı.');
  return fromStored(persisted);
}

export async function loadVideoDraft(id: string) {
  const db = await database(); const draft = await db.get(STORE, id);
  return draft ? fromStored(draft) : null;
}

export async function listVideoDrafts(): Promise<VideoDraftSummary[]> {
  const db = await database(); const drafts = await db.getAll(STORE);
  return drafts.map(draft => ({ id: draft.id, name: draft.name, updatedAt: draft.updatedAt, duration: totalVideoDuration(draft.clips), clipCount: draft.clips.length })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteVideoDraft(id: string) {
  const db = await database(); await db.delete(STORE, id);
}

export function releaseVideoDraft(draft?: VideoDraft | null) {
  if (!draft) return;
  for (const clip of draft.clips) if (clip.source.startsWith('blob:')) URL.revokeObjectURL(clip.source);
  if (draft.music?.source.startsWith('blob:')) URL.revokeObjectURL(draft.music.source);
}
