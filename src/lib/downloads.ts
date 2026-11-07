import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Dosya hazırlanamadı.'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    const dataUrl = await blobToDataUrl(blob);
    try {
      await Filesystem.writeFile({
        path: `My Vision/${Date.now()}-${filename}`,
        data: dataUrl.split(',')[1],
        directory: Directory.Documents,
        recursive: true,
      });
      return;
    } catch {
      const cached = await Filesystem.writeFile({
        path: `my-vision-${Date.now()}-${filename}`,
        data: dataUrl.split(',')[1],
        directory: Directory.Cache,
      });
      await Share.share({ title: 'My Vision fotoğrafı', url: cached.uri, dialogTitle: 'Fotoğrafı paylaş veya kaydet' });
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareProject(blob: Blob) {
  if (Capacitor.isNativePlatform()) {
    const dataUrl = await blobToDataUrl(blob);
    const path = `my-vision-share-${Date.now()}.jpg`;
    const cached = await Filesystem.writeFile({ path, data: dataUrl.split(',')[1], directory: Directory.Cache });
    try {
      await Share.share({ title: 'My Vision', text: 'Görüşünü paylaş.', url: cached.uri, dialogTitle: 'Fotoğrafını paylaş' });
    } finally {
      window.setTimeout(() => { void Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined); }, 30000);
    }
    return;
  }
  const file = new File([blob], 'my-vision.jpg', { type: blob.type });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'My Vision', text: 'Görüşünü paylaş.' });
    return;
  }
  await downloadBlob(blob, 'my-vision.jpg');
}
