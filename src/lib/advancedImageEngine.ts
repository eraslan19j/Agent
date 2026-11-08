import type { EditSettings } from '../types';
import { processCanvasPixels } from './pixelScheduler';

export { backgroundAlpha, curveValue } from './pixelProcessing';

const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));

export function straightenCoverScale(width: number, height: number, degrees: number) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let scale = 1;
  for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) {
    const sourceX = x * cos + y * sin;
    const sourceY = -x * sin + y * cos;
    scale = Math.max(scale, Math.abs(sourceX) / (width / 2), Math.abs(sourceY) / (height / 2));
  }
  return Number.isFinite(scale) ? Math.min(3, scale) : 1;
}

function applyRepairs(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  const marks = settings.repairs.filter(mark => mark.type !== 'redeye');
  if (!marks.length) return;
  const backup = document.createElement('canvas'); backup.width = width; backup.height = height;
  backup.getContext('2d')!.drawImage(context.canvas, 0, 0);
  for (const mark of marks) {
    const x = mark.x * width, y = mark.y * height;
    const radius = Math.max(2, mark.radius * Math.min(width, height));
    const sourceX = clamp(x + (x + radius * 3 < width ? radius * 1.8 : -radius * 1.8), radius, width - radius);
    const sourceY = clamp(y + radius * 0.7, radius, height - radius);
    const patch = document.createElement('canvas'); patch.width = patch.height = Math.ceil(radius * 2);
    const patchContext = patch.getContext('2d')!;
    patchContext.drawImage(backup, sourceX - radius, sourceY - radius, radius * 2, radius * 2, 0, 0, patch.width, patch.height);
    patchContext.globalCompositeOperation = 'destination-in';
    const gradient = patchContext.createRadialGradient(radius, radius, radius * 0.55, radius, radius, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    patchContext.fillStyle = gradient; patchContext.fillRect(0, 0, patch.width, patch.height);
    context.drawImage(patch, x - radius, y - radius);
  }
}

function applyPerspective(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  if (!settings.perspectiveX && !settings.perspectiveY) return;
  const copy = () => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(context.canvas, 0, 0); return canvas;
  };
  if (settings.perspectiveX) {
    const source = copy(); const p = settings.perspectiveX / 100;
    context.clearRect(0, 0, width, height);
    for (let y = 0; y < height; y += 1) {
      const scale = 1 + Math.abs(p) + p * (y / height * 2 - 1);
      context.drawImage(source, 0, y, width, 1, width * (1 - scale) / 2, y, width * scale, 1);
    }
  }
  if (settings.perspectiveY) {
    const source = copy(); const p = settings.perspectiveY / 100;
    context.clearRect(0, 0, width, height);
    for (let x = 0; x < width; x += 1) {
      const scale = 1 + Math.abs(p) + p * (x / width * 2 - 1);
      context.drawImage(source, x, 0, 1, height, x, height * (1 - scale) / 2, 1, height * scale);
    }
  }
}

function drawCreativeLayers(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  const unit = Math.min(width, height);
  for (const stroke of settings.brushStrokes) {
    if (stroke.points.length < 2) continue;
    context.save(); context.globalAlpha = stroke.opacity; context.strokeStyle = stroke.color;
    context.lineWidth = Math.max(1, stroke.size / 1000 * unit); context.lineCap = 'round'; context.lineJoin = 'round';
    context.beginPath(); stroke.points.forEach((point, index) => index ? context.lineTo(point.x * width, point.y * height) : context.moveTo(point.x * width, point.y * height));
    context.stroke(); context.restore();
  }
  for (const text of settings.texts) {
    const family = text.font === 'serif' ? '"Instrument Serif", Georgia, serif' : text.font === 'mono' ? 'monospace' : 'Manrope, Arial, sans-serif';
    context.save(); context.translate(text.x * width, text.y * height); context.rotate(text.rotation * Math.PI / 180);
    context.font = `700 ${Math.max(8, text.size / 550 * unit)}px ${family}`;
    context.fillStyle = text.color; context.textAlign = text.align; context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0,0,0,.35)'; context.shadowBlur = unit * 0.008;
    context.fillText(text.text, 0, 0, width * 0.9); context.restore();
  }
  for (const sticker of settings.stickers) {
    context.save(); context.translate(sticker.x * width, sticker.y * height); context.rotate(sticker.rotation * Math.PI / 180);
    context.font = `${Math.max(8, sticker.size / 550 * unit)}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(sticker.value, 0, 0); context.restore();
  }
  if (settings.frame.width) {
    const thickness = settings.frame.width / 1000 * unit;
    context.save(); context.strokeStyle = settings.frame.color; context.lineWidth = thickness;
    context.strokeRect(thickness / 2, thickness / 2, width - thickness, height - thickness); context.restore();
  }
}

export function hasAdvancedRendering(settings: EditSettings) {
  return Boolean(settings.straighten || settings.perspectiveX || settings.perspectiveY || settings.noiseReduction || settings.sharpen ||
    settings.curveShadows || settings.curveMidtones || settings.curveHighlights || Object.values(settings.hsl).some(value => value.hue || value.saturation || value.luminance) ||
    settings.masks.length || settings.repairs.length || settings.texts.length || settings.stickers.length || settings.brushStrokes.length || settings.frame.width || settings.backgroundRemoval);
}

export async function applyAdvancedRendering(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  applyRepairs(context, width, height, settings);
  await processCanvasPixels(context, width, height, settings);
  applyPerspective(context, width, height, settings);
  drawCreativeLayers(context, width, height, settings);
}
