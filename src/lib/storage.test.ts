import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { DEFAULT_SETTINGS } from '../data/presets';
import type { PhotoProject } from '../types';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(), getItem: key => values.get(key) ?? null,
  key: index => [...values.keys()][index] ?? null,
  removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
};
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
let urlSequence = 0;
Object.defineProperty(URL, 'createObjectURL', { value: () => `blob:test-${++urlSequence}`, configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });

function project(patch: Partial<PhotoProject> = {}): PhotoProject {
  return {
    id: 'project-1', name: 'Deneme', source: PIXEL, settings: { ...DEFAULT_SETTINGS, brightness: 118 },
    createdAt: 100, updatedAt: 200, ...patch,
  };
}

async function moduleUnderTest() {
  vi.resetModules();
  return import('./storage');
}

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
});

describe('IndexedDB project storage', () => {
  it('migrates legacy photos to blobs, removes obsolete fields and preserves supported edits', async () => {
    const legacy = project({
      settings: {
        ...DEFAULT_SETTINGS,
        brightness: 118,
        texts: [{ id: 'text', text: 'Koru', x: .4, y: .5, size: 44, color: '#FFFFFF', font: 'sans', align: 'center', rotation: 4 }],
        repairs: [{ id: 'old', type: 'heal', x: .5, y: .5, radius: .1 }],
        stickers: [{ id: 'old', value: '*', x: .5, y: .5, size: 20, rotation: 0 }],
        brushStrokes: [],
        backgroundRemoval: 70,
      } as PhotoProject['settings'],
    });
    localStorage.setItem('myvision.projects.v1', JSON.stringify([legacy]));
    const store = await moduleUnderTest();
    const result = await store.initializeStorage();

    expect(result.migratedCount).toBe(1);
    expect(result.warning).toBeUndefined();
    expect(localStorage.getItem('myvision.projects.v1')).toBeNull();
    expect(result.projects[0].settings.brightness).toBe(118);
    expect(result.projects[0].settings.texts[0]).toMatchObject({ text: 'Koru', rotation: 4 });
    expect(result.projects[0].settings).not.toHaveProperty('repairs');
    expect(result.projects[0].settings).not.toHaveProperty('stickers');
    expect(result.projects[0].settings).not.toHaveProperty('brushStrokes');
    expect(result.projects[0].settings).not.toHaveProperty('backgroundRemoval');

    const db = await openDB('myvision-studio', 1);
    const persisted = await db.get('projects', 'project-1');
    expect(persisted.source).toBeInstanceOf(Blob);
    expect(persisted.source.type).toBe('image/png');
    expect(persisted.source.size).toBeGreaterThan(0);
    expect(persisted.settings.brightness).toBe(118);
  });

  it('keeps the complete legacy payload when any project cannot be verified', async () => {
    const valid = project();
    const invalid = project({ id: 'broken', source: 'not-a-local-image' });
    const payload = JSON.stringify([valid, invalid]);
    localStorage.setItem('myvision.projects.v1', payload);
    const store = await moduleUnderTest();
    const result = await store.initializeStorage();

    expect(result.migratedCount).toBe(1);
    expect(result.warning).toContain('1 eski proje');
    expect(localStorage.getItem('myvision.projects.v1')).toBe(payload);
    expect(result.projects.map(item => item.id)).toEqual(['project-1']);
  });

  it('keeps malformed legacy data instead of silently discarding it', async () => {
    localStorage.setItem('myvision.projects.v1', '{broken-json');
    const store = await moduleUnderTest();
    const result = await store.initializeStorage();
    expect(result.projects).toEqual([]);
    expect(result.warning).toContain('eski veri silinmedi');
    expect(localStorage.getItem('myvision.projects.v1')).toBe('{broken-json');
  });

  it('saves, verifies and deletes a project', async () => {
    const store = await moduleUnderTest();
    await store.initializeStorage();
    const saved = await store.saveStoredProject(project({ name: 'Yeni çalışma', previewSource: PIXEL.replace('iVBOR', 'iVBPS'), width: 8000, height: 4000 }));
    expect(saved.name).toBe('Yeni çalışma');
    expect(saved.previewSource).toMatch(/^blob:/);
    expect(saved.width).toBe(8000);
    const db = await openDB('myvision-studio', 1);
    const persisted = await db.get('projects', saved.id);
    expect(persisted).toBeDefined();
    expect(persisted.preview).toBeInstanceOf(Blob);
    expect(persisted.previewSource).toBeUndefined();
    expect(persisted.height).toBe(4000);
    await store.deleteStoredProject(saved.id);
    expect(await db.get('projects', saved.id)).toBeUndefined();
  });
});
