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
  includeSelectiveLight = true,
): string {
  // interpolate() expects the 0–100 UI value and performs normalization once.
  const amount = Math.min(100, Math.max(0, settings.intensity));
  const clarity = settings.clarity ?? 0;
  const blur = settings.blur ?? 0;
  const selectiveLight = includeSelectiveLight ? 1 + settings.shadows / 520 + settings.highlights / 650 : 1;
  const brightness = interpolate(1, preset.tone.brightness, amount) * settings.brightness / 100 * (1 + settings.exposure / 160) * selectiveLight;
  const contrast = interpolate(1, preset.tone.contrast, amount) * settings.contrast / 100 * (1 + clarity / 220);
  const saturation = interpolate(1, preset.tone.saturation, amount) * settings.saturation / 100;
  const grayscale = interpolate(0, preset.tone.grayscale, amount);
  const sepia = interpolate(0, preset.tone.sepia, amount) + (includeTemperature ? Math.max(0, settings.temperature) / 650 : 0);
  const hueRotate = interpolate(0, preset.tone.hueRotate, amount) + (includeTemperature ? Math.min(0, settings.temperature) / 12 : 0);
  const fadeContrast = 1 - settings.fade / 450;

  return `brightness(${Math.max(0, brightness).toFixed(3)}) contrast(${Math.max(0, contrast * fadeContrast).toFixed(3)}) saturate(${Math.max(0, saturation).toFixed(3)}) grayscale(${grayscale.toFixed(3)}) sepia(${Math.max(0, sepia).toFixed(3)}) hue-rotate(${hueRotate.toFixed(1)}deg) blur(${Math.max(0, blur / 10).toFixed(1)}px)`;
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

export function previewDimensions(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number, settings: Pick<EditSettings, 'aspectRatio' | 'rotation'>) {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { width: 0, height: 0, aspectRatio: 1 };
  }
  const crop = computeCrop(imageWidth, imageHeight, settings.aspectRatio);
  const quarterTurn = normalizedRotation(settings.rotation) % 180 !== 0;
  const outputWidth = quarterTurn ? crop.height : crop.width;
  const outputHeight = quarterTurn ? crop.width : crop.height;
  const aspectRatio = outputWidth / outputHeight;
  const scale = Math.min(containerWidth / outputWidth, containerHeight / outputHeight);
  return {
    width: Math.max(1, Math.floor(outputWidth * scale)),
    height: Math.max(1, Math.floor(outputHeight * scale)),
    aspectRatio,
  };
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
  context.filter = buildCssFilter(settings, getPreset(settings.presetId), false, false);
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

export function readJpegOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xDA || marker === 0xD9) break;
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) break;
    if (marker === 0xE1 && segmentLength >= 16 && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      const littleEndian = view.getUint16(tiff) === 0x4949;
      if (!littleEndian && view.getUint16(tiff) !== 0x4D4D) return 1;
      if (view.getUint16(tiff + 2, littleEndian) !== 42) return 1;
      const ifd = tiff + view.getUint32(tiff + 4, littleEndian);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, littleEndian);
      for (let index = 0; index < entries; index += 1) {
        const entry = ifd + 2 + index * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, littleEndian) === 0x0112) {
          const orientation = view.getUint16(entry + 8, littleEndian);
          return orientation >= 1 && orientation <= 8 ? orientation : 1;
        }
      }
      return 1;
    }
    offset += 2 + segmentLength;
  }
  return 1;
}

export function readJpegDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return null;
  let offset = 2;
  while (offset + 8 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) return null;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xDA || marker === 0xD9) return null;
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > view.byteLength) return null;
    const isStartOfFrame = [0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(marker);
    if (isStartOfFrame) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    offset += 2 + length;
  }
  return null;
}

export function orientationDimensions(width: number, height: number, orientation: number) {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

function applyExifTransform(context: CanvasRenderingContext2D, orientation: number, width: number, height: number) {
  switch (orientation) {
    case 2: context.transform(-1, 0, 0, 1, width, 0); break;
    case 3: context.transform(-1, 0, 0, -1, width, height); break;
    case 4: context.transform(1, 0, 0, -1, 0, height); break;
    case 5: context.transform(0, 1, 1, 0, 0, 0); break;
    case 6: context.transform(0, 1, -1, 0, height, 0); break;
    case 7: context.transform(0, -1, -1, 0, height, width); break;
    case 8: context.transform(0, -1, 1, 0, 0, width); break;
    default: break;
  }
}

export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Lütfen JPG, PNG veya WebP formatında bir fotoğraf seçin.');
  if (file.size > 30 * 1024 * 1024) throw new Error('Fotoğraf 30 MB sınırını aşıyor.');
  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  const jpegBuffer = isJpeg ? await file.arrayBuffer() : null;
  const orientation = jpegBuffer ? readJpegOrientation(jpegBuffer) : 1;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.onabort = () => reject(new DOMException('Dosya okuma iptal edildi.', 'AbortError'));
    reader.readAsDataURL(file);
  });

  let bitmap: ImageBitmap | null = null;
  let fallbackImage: HTMLImageElement | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      try { bitmap = await createImageBitmap(file, { imageOrientation: 'none' }); } catch { bitmap = null; }
    }
    if (!bitmap) fallbackImage = await loadImage(dataUrl);
    const source = bitmap ?? fallbackImage!;
    const rawWidth = bitmap ? bitmap.width : fallbackImage!.naturalWidth;
    const rawHeight = bitmap ? bitmap.height : fallbackImage!.naturalHeight;
    // Some Chromium/WebView versions ignore imageOrientation:'none' and return an
    // already-oriented bitmap. Compare SOF dimensions to avoid rotating it twice.
    let effectiveOrientation = bitmap ? orientation : 1;
    if (bitmap && jpegBuffer && orientation !== 1) {
      const encoded = readJpegDimensions(jpegBuffer);
      const decoderAppliedExif = encoded
        ? orientation >= 5 && orientation <= 8
          ? rawWidth === encoded.height && rawHeight === encoded.width
          : true
        : true;
      if (decoderAppliedExif) effectiveOrientation = 1;
    }
    const oriented = orientationDimensions(rawWidth, rawHeight, effectiveOrientation);
    const maxDimension = 2800;
    if (orientation === 1 && effectiveOrientation === 1 && Math.max(oriented.width, oriented.height) <= maxDimension) return dataUrl;

    const scale = Math.min(1, maxDimension / Math.max(oriented.width, oriented.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(oriented.width * scale));
    canvas.height = Math.max(1, Math.round(oriented.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Fotoğraf bellekte hazırlanamadı. Daha küçük bir fotoğraf deneyin.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.scale(scale, scale);
    applyExifTransform(context, effectiveOrientation, rawWidth, rawHeight);
    context.drawImage(source, 0, 0);
    return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
  } finally {
    bitmap?.close();
  }
}

export const freshSettings = (): EditSettings => ({ ...DEFAULT_SETTINGS });
