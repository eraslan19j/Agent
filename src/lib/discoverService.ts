export interface DiscoverPhoto {
  id: string;
  author: string;
  width: number;
  height: number;
  thumbnailUrl: string;
  fullUrl: string;
  sourceName: 'Lorem Picsum';
  sourceUrl: string;
}

interface PicsumPhoto {
  id: string;
  author: string;
  width: number;
  height: number;
  url: string;
  download_url: string;
}

const cache = new Map<number, { photos: DiscoverPhoto[]; savedAt: number }>();
const CACHE_TIME = 5 * 60 * 1000;

function sizedUrl(id: string, width: number, height: number, targetWidth: number) {
  const scale = Math.min(1, targetWidth / width);
  const targetHeight = Math.max(1, Math.round(height * scale));
  const actualWidth = Math.max(1, Math.round(width * scale));
  return `https://picsum.photos/id/${encodeURIComponent(id)}/${actualWidth}/${targetHeight}.jpg`;
}

function mapPhoto(photo: PicsumPhoto): DiscoverPhoto {
  return {
    id: photo.id,
    author: photo.author,
    width: photo.width,
    height: photo.height,
    thumbnailUrl: sizedUrl(photo.id, photo.width, photo.height, 720),
    fullUrl: sizedUrl(photo.id, photo.width, photo.height, 2200),
    sourceName: 'Lorem Picsum',
    sourceUrl: photo.url || 'https://picsum.photos/',
  };
}

export async function fetchDiscoverPhotos(page: number, force = false): Promise<DiscoverPhoto[]> {
  const cached = cache.get(page);
  if (!force && cached && Date.now() - cached.savedAt < CACHE_TIME) return cached.photos;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=24`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Fotoğraf servisi ${response.status} yanıtı verdi.`);
    const data = await response.json() as PicsumPhoto[];
    if (!Array.isArray(data) || data.length === 0) throw new Error('Bu seçkide fotoğraf bulunamadı.');
    const photos = data.filter((photo) => photo.id && photo.width > 0 && photo.height > 0).map(mapPhoto);
    cache.set(page, { photos, savedAt: Date.now() });
    return photos;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function randomDiscoverPage(exclude = 0) {
  let page: number;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    page = 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 40);
  } else {
    page = 1 + Math.floor(Math.random() * 40);
  }
  return page === exclude ? (page % 40) + 1 : page;
}
