const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const publicBase = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export interface SharedPhoto {
  id: string;
  name: string;
  caption: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  createdAt: string;
  url: string;
  shareUrl: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Sunucu isteği başarısız (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function resolveContentUrl(photo: SharedPhoto) {
  return { ...photo, url: new URL(photo.url, apiBase || window.location.origin).href };
}

export async function listSharedPhotos() {
  const result = await api<{ photos: SharedPhoto[] }>('/api/photos?limit=60');
  return result.photos.map(resolveContentUrl);
}

export async function uploadSharedPhoto(file: File, caption = '') {
  const body = new FormData(); body.append('photo', file); body.append('name', file.name); body.append('caption', caption);
  const result = await api<{ photo: SharedPhoto }>('/api/photos', { method: 'POST', body });
  return resolveContentUrl(result.photo);
}

export async function sharedPhotoFile(photo: SharedPhoto) {
  const response = await fetch(photo.url);
  if (!response.ok) throw new Error('Paylaşılan fotoğraf indirilemedi.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Sunucudan geçerli bir fotoğraf gelmedi.');
  const extension = blob.type === 'image/png' ? '.png' : blob.type === 'image/webp' ? '.webp' : '.jpg';
  return new File([blob], `${photo.name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'paylasilan-fotograf'}${extension}`, { type: blob.type });
}

export function sharedPhotoLink(photo: SharedPhoto) {
  return new URL(photo.shareUrl, publicBase || window.location.origin).href;
}
