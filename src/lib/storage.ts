import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { freshSettings } from './imageEngine';
import type { EditSettings, PhotoProject } from '../types';

const PROJECTS_KEY = 'myvision.projects.v1';
const ONBOARDING_KEY = 'myvision.onboarded.v1';
const DATABASE_NAME = 'myvision-studio';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';

interface StoredPhotoProject extends Omit<PhotoProject, 'source' | 'previewSource' | 'thumbnail'> {
  source: Blob;
  preview?: Blob;
  thumbnail?: Blob;
}
interface StudioDatabase extends DBSchema {
  projects: { key: string; value: StoredPhotoProject };
}
export interface StorageLoadResult {
  projects: PhotoProject[];
  migratedCount: number;
  warning?: string;
}

let databasePromise: Promise<IDBPDatabase<StudioDatabase>> | null = null;
function database() {
  databasePromise ??= openDB<StudioDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) { db.createObjectStore(PROJECT_STORE, { keyPath: 'id' }); },
  });
  return databasePromise;
}

function dataUrlToBlob(source: string): Blob {
  const match = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Yerel fotoğraf biçimi okunamadı.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

async function sourceToBlob(source: string): Promise<Blob> {
  const blob = source.startsWith('data:') ? dataUrlToBlob(source) : source.startsWith('blob:') ? await fetch(source).then(response => response.blob()) : null;
  if (!blob || blob.size === 0 || !blob.type.startsWith('image/')) throw new Error('Proje fotoğrafı doğrulanamadı.');
  return blob;
}

async function toStoredProject(project: PhotoProject): Promise<StoredPhotoProject> {
  if (!project.id || !project.name || !project.settings) throw new Error('Proje kaydı eksik.');
  const { previewSource, ...metadata } = project;
  const source = await sourceToBlob(project.source);
  const preview = previewSource && previewSource !== project.source ? await sourceToBlob(previewSource) : undefined;
  const thumbnail = project.thumbnail ? await sourceToBlob(project.thumbnail) : undefined;
  return { ...metadata, settings: freshSettings(project.settings), source, preview, thumbnail, isSample: false };
}

async function fromStoredProject(project: StoredPhotoProject): Promise<PhotoProject> {
  const { preview, ...metadata } = project;
  return {
    ...metadata,
    settings: freshSettings(project.settings),
    source: URL.createObjectURL(project.source),
    previewSource: preview ? URL.createObjectURL(preview) : undefined,
    thumbnail: project.thumbnail ? URL.createObjectURL(project.thumbnail) : undefined,
  };
}

async function verifyStoredProject(expected: StoredPhotoProject) {
  const db = await database();
  const actual = await db.get(PROJECT_STORE, expected.id);
  if (!actual || actual.source.size !== expected.source.size || actual.source.type !== expected.source.type) {
    throw new Error('Proje yazıldıktan sonra doğrulanamadı.');
  }
}

function legacyProjects(value: string | null): PhotoProject[] | null {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as PhotoProject[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(project => project && typeof project.id === 'string' && project.source && project.settings && !project.isSample && !project.id.startsWith('sample-'));
  } catch { return null; }
}

async function loadStorage(): Promise<StorageLoadResult> {
  const db = await database();
  let migratedCount = 0;
  let warning: string | undefined;
  const rawLegacy = localStorage.getItem(PROJECTS_KEY);
  const legacy = legacyProjects(rawLegacy);

  if (rawLegacy && legacy === null) {
    warning = 'Eski proje kaydı okunamadı; güvenlik için eski veri silinmedi.';
  } else if (legacy?.length) {
    let failed = 0;
    for (const project of legacy) {
      try {
        const stored = await toStoredProject(project);
        await db.put(PROJECT_STORE, stored);
        await verifyStoredProject(stored);
        migratedCount += 1;
      } catch { failed += 1; }
    }
    if (failed === 0) {
      localStorage.removeItem(PROJECTS_KEY);
    } else {
      warning = `${failed} eski proje doğrulanamadı. Eski veri korunuyor; desteklenen projeler açılabilir.`;
    }
  } else if (rawLegacy) {
    localStorage.removeItem(PROJECTS_KEY);
  }

  // IndexedDB içinde bulunabilecek eski ayarları da kalıcı olarak temizle.
  const storedProjects = await db.getAll(PROJECT_STORE);
  for (const project of storedProjects) {
    const settings = freshSettings(project.settings as Partial<EditSettings>);
    if (JSON.stringify(settings) !== JSON.stringify(project.settings)) {
      const cleaned = { ...project, settings };
      await db.put(PROJECT_STORE, cleaned);
      Object.assign(project, cleaned);
    }
  }
  const projects = await Promise.all(storedProjects.map(fromStoredProject));
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return { projects, migratedCount, warning };
}

let initializationPromise: Promise<StorageLoadResult> | null = null;
export function initializeStorage(): Promise<StorageLoadResult> {
  initializationPromise ??= loadStorage().catch(reason => {
    initializationPromise = null;
    throw reason;
  });
  return initializationPromise;
}

export async function saveStoredProject(project: PhotoProject): Promise<PhotoProject> {
  const stored = await toStoredProject(project);
  const db = await database();
  await db.put(PROJECT_STORE, stored);
  await verifyStoredProject(stored);
  return fromStoredProject(stored);
}

export async function updateStoredProject(id: string, patch: Partial<PhotoProject>): Promise<void> {
  const db = await database();
  const current = await db.get(PROJECT_STORE, id);
  if (!current) throw new Error('Proje bulunamadı.');
  const metadata = { ...patch };
  delete metadata.source; delete metadata.previewSource; delete metadata.thumbnail;
  const updated: StoredPhotoProject = { ...current, ...metadata, id, source: current.source, preview: current.preview, thumbnail: current.thumbnail };
  await db.put(PROJECT_STORE, updated);
  await verifyStoredProject(updated);
}

export async function deleteStoredProject(id: string): Promise<void> {
  const db = await database();
  await db.delete(PROJECT_STORE, id);
  if (await db.get(PROJECT_STORE, id)) throw new Error('Proje silinemedi.');
}

export function releaseProjectUrls(projects: PhotoProject[]) {
  for (const project of projects) {
    if (project.source.startsWith('blob:')) URL.revokeObjectURL(project.source);
    if (project.previewSource && project.previewSource !== project.source && project.previewSource.startsWith('blob:')) URL.revokeObjectURL(project.previewSource);
    if (project.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(project.thumbnail);
  }
}

export function hasOnboarded() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function setOnboarded() {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}
