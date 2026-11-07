import { DEFAULT_SETTINGS, getPreset } from '../data/presets';
import type { AspectRatio, EditSettings, ExportOptions, PhotoPreset } from '../types';

export const ratioValue = (ratio: AspectRatio): number | null => {
  if (ratio === 'original') return null;
  const [width, height] = ratio.split(':').map(Number);
  return width / height;
};

export const interpolate = (base: number, target: number, intensity: number) =>
  base + (target - base) * Math.min(100, Math.max(0, intensity)) / 100;

export function buildCssFilter(
  settings: EditSettings,
  preset: PhotoPreset = getPreset(settings.presetId),
  includeTemperature = true,
): string {
  const amount = settings.intensity / 100;
  const brightness = interpolate(1, preset.tone.brightness, amount) * settings.brightness / 100 * (1 + settings.exposure / 160);
  const contrast = interpolate(1, preset.tone.contrast, amount) * settings.contrast / 100;
  const saturation = interpolate(1, preset.tone.saturation, amount) * settings.saturation / 100;
  const grayscale = interpolate(0, preset.tone.grayscale, amount);
  const sepia = interpolate(0, preset.tone.sepia, amount) + (includeTemperature ? Math.max(0, settings.temperature) / 650 : 0);
  const hueRotate = interpolate(0, preset.tone.hueRotate, amount) + (includeTemperature ? Math.min(0, settings.temperature) / 12 : 0);
  const fadeContrast = 1 - settings.fade / 450;

  return `brightness(${Math.max(0, brightness).toFixed(3)}) contrast(${Math.max(0, contrast * fadeContrast).toFixed(3)}) saturate(${Math.max(0, saturation).toFixed(3)}) grayscale(${grayscale.toFixed(3)}) sepia(${Math.max(0, sepia).toFixed(3)}) hue-rotate(${hueRotate.toFixed(1)}deg)`;
}

export function computeCrop(width: number, height: number, ratio: AspectRatio) {
  const target = ratioValue(ratio);
  if (!target) return { x: 0, y: 0, width, height };
  const sourceRatio = width / height;
  if (sourceRatio > target) {
    const cropWidth = height * target;
    return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height };
  }
  const cropHeight = width / target;
  return { x: 0, y: (height - cropHeight) / 2, width, height: cropHeight };
}

export function normalizedRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

export function outputDimensions(width: number, height: number, settings: EditSettings, maxDimension: number) {
  const crop = computeCrop(width, height, settings.aspectRatio);
  const quarterTurn = normalizedRotation(settings.rotation) % 180 !== 0;
  const rotatedWidth = quarterTurn ? crop.height : crop.width;
  const rotatedHeight = quarterTurn ? crop.width : crop.height;
  const scale = Math.min(1, maxDimension / Math.max(rotatedWidth, rotatedHeight));
  return {
    crop,
    width: Math.max(1, Math.round(rotatedWidth * scale)),
    height: Math.max(1, Math.round(rotatedHeight * scale)),
    scale,
  };
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Fotoğraf açılamadı. Lütfen başka bir dosya deneyin.'));
    image.src = source;
  });
}

function applyPixelAdjustments(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  if (!settings.highlights && !settings.shadows && !settings.temperature && !settings.grain && !settings.fade) return;
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  let seed = 419;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];
    const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    const highlightWeight = Math.max(0, (luminance - 0.45) / 0.55);
    const shadowWeight = Math.max(0, (0.55 - luminance) / 0.55);
    const toneFactor = 1 + (settings.highlights / 100) * highlightWeight * 0.65 + (settings.shadows / 100) * shadowWeight * 0.65;
    const noise = settings.grain ? (random() - 0.5) * settings.grain * 0.48 : 0;
    red = red * toneFactor + settings.temperature * 0.22 + noise;
    green = green * toneFactor + noise;
    blue = blue * toneFactor - settings.temperature * 0.22 + noise;
    if (settings.fade) {
      const lift = settings.fade * 0.18;
      red += lift;
      green += lift;
      blue += lift;
    }
    data[index] = Math.max(0, Math.min(255, red));
    data[index + 1] = Math.max(0, Math.min(255, green));
    data[index + 2] = Math.max(0, Math.min(255, blue));
  }
  context.putImageData(pixels, 0, 0);
}

function applyVignette(context: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  if (!amount) return;
  const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18, width / 2, height / 2, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.68, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.82, amount / 105)})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

export async function renderPhoto(source: string, settings: EditSettings, options: ExportOptions): Promise<Blob> {
  const image = await loadImage(source);
  const dimensions = outputDimensions(image.naturalWidth, image.naturalHeight, settings, options.maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Dışa aktarma motoru başlatılamadı.');

  const rotation = normalizedRotation(settings.rotation);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.scale(settings.flipHorizontal ? -1 : 1, settings.flipVertical ? -1 : 1);
  context.filter = buildCssFilter(settings, getPreset(settings.presetId), false);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const { crop, scale } = dimensions;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -crop.width * scale / 2,
    -crop.height * scale / 2,
    crop.width * scale,
    crop.height * scale,
  );
  context.restore();
  applyPixelAdjustments(context, canvas.width, canvas.height, settings);
  applyVignette(context, canvas.width, canvas.height, settings.vignette);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Fotoğraf oluşturulamadı. Daha küçük bir boyut deneyin.'));
    }, `image/${options.format}`, options.quality);
  });
}

export async function createThumbnail(source: string, settings: EditSettings): Promise<string> {
  const blob = await renderPhoto(source, settings, { format: 'jpeg', quality: 0.72, maxDimension: 560 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Önizleme oluşturulamadı.'));
    reader.readAsDataURL(blob);
  });
}

export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Lütfen JPG, PNG veya WebP formatında bir fotoğraf seçin.');
  if (file.size > 30 * 1024 * 1024) throw new Error('Fotoğraf 30 MB sınırını aşıyor.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(dataUrl);
  const maxDimension = 2800;
  if (Math.max(image.naturalWidth, image.naturalHeight) <= maxDimension) return dataUrl;
  const scale = maxDimension / Math.max(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export const freshSettings = (): EditSettings => ({ ...DEFAULT_SETTINGS });
