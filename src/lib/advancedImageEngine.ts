import type { EditSettings } from '../types';
import { processCanvasPixels } from './pixelScheduler';
import { textAvailableRatio, wrapTextLines } from './textLayout';

export { curveValue } from './pixelProcessing';

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
  for (const text of settings.texts) {
    const family = text.font === 'serif' ? 'ui-serif, Georgia, serif' : text.font === 'mono' ? 'ui-monospace, SFMono-Regular, Consolas, monospace' : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.save(); context.translate(text.x * width, text.y * height); context.rotate(text.rotation * Math.PI / 180);
    const maxWidth = width * textAvailableRatio(text);
    let fontSize = Math.max(8, text.size / 550 * unit);
    context.font = `600 ${fontSize}px ${family}`;
    const longestWordWidth = Math.max(0, ...text.text.split(/\s+/).map(word => context.measureText(word).width));
    if (longestWordWidth > maxWidth) {
      fontSize = Math.max(8, fontSize * maxWidth / longestWordWidth);
      context.font = `600 ${fontSize}px ${family}`;
    }
    context.fillStyle = text.color; context.textAlign = text.align; context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0,0,0,.28)'; context.shadowBlur = unit * 0.006;
    const lines = wrapTextLines(text.text, maxWidth, value => context.measureText(value).width);
    const lineHeight = fontSize * 1.1;
    lines.forEach((line, index) => context.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight));
    context.restore();
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
    settings.masks.length || settings.texts.length || settings.frame.width);
}

export async function applyAdvancedRendering(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings, signal?: AbortSignal) {
  await processCanvasPixels(context, width, height, settings, signal);
  applyPerspective(context, width, height, settings);
  drawCreativeLayers(context, width, height, settings);
}
