import type { EditSettings, HslColor } from '../types';

const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));
const hueCenters: Record<HslColor, number> = { red: 0, orange: 30, yellow: 60, green: 120, cyan: 180, blue: 235, purple: 285 };
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

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

export function curveValue(value: number, settings: Pick<EditSettings, 'curveShadows' | 'curveMidtones' | 'curveHighlights'>) {
  const n = value / 255;
  const shadows = settings.curveShadows / 100 * 0.32 * (1 - n) ** 2;
  const midtones = settings.curveMidtones / 100 * 0.24 * (1 - Math.abs(n - 0.5) * 2);
  const highlights = settings.curveHighlights / 100 * 0.32 * n ** 2;
  return clamp(Math.round((n + shadows + midtones + highlights) * 255));
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l] as const;
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const section = ((h % 360) + 360) % 360 / 60;
  const values = section < 1 ? [c, x, 0] : section < 2 ? [x, c, 0] : section < 3 ? [0, c, x] : section < 4 ? [0, x, c] : section < 5 ? [x, 0, c] : [c, 0, x];
  return values.map(value => clamp((value + m) * 255));
}

function applyDetail(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  if (!settings.noiseReduction && !settings.sharpen) return;
  const image = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(image.data);
  const output = image.data;
  const noise = settings.noiseReduction / 100;
  const sharpen = settings.sharpen / 100 * 0.85;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const i = index + channel;
        const average = (source[i - 4] + source[i + 4] + source[i - width * 4] + source[i + width * 4]) / 4;
        const difference = Math.abs(source[i] - average);
        const denoised = noise && difference < 70 ? source[i] * (1 - noise) + average * noise : source[i];
        output[i] = clamp(denoised + (denoised - average) * sharpen);
      }
    }
  }
  context.putImageData(image, 0, 0);
}

function maskWeights(settings: EditSettings, nx: number, ny: number) {
  let exposure = 0, saturation = 0, temperature = 0;
  for (const mask of settings.masks) {
    let distance: number;
    if (mask.type === 'radial') distance = Math.hypot(nx - mask.x, ny - mask.y) / Math.max(0.01, mask.radius);
    else {
      const angle = mask.angle * Math.PI / 180;
      distance = Math.abs((nx - mask.x) * Math.cos(angle) + (ny - mask.y) * Math.sin(angle)) / Math.max(0.01, mask.radius);
    }
    const weight = clamp(1 - (distance - (1 - mask.feather)) / Math.max(0.01, mask.feather), 0, 1);
    exposure += mask.exposure * weight;
    saturation += mask.saturation * weight;
    temperature += mask.temperature * weight;
  }
  return { exposure, saturation, temperature };
}

function borderColor(data: Uint8ClampedArray, width: number, height: number) {
  const points = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3], [Math.floor(width / 2), 2], [Math.floor(width / 2), height - 3]];
  const color = [0, 0, 0];
  for (const [x, y] of points) {
    const index = (y * width + x) * 4;
    for (let c = 0; c < 3; c += 1) color[c] += data[index + c] / points.length;
  }
  return color;
}

export function backgroundAlpha(distance: number, tolerance: number) {
  if (!tolerance) return 1;
  return clamp((distance - tolerance * 0.55) / Math.max(1, tolerance * 0.75), 0, 1);
}

function applyAdvancedPixels(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  const hasHsl = Object.values(settings.hsl).some(channel => channel.hue || channel.saturation || channel.luminance);
  if (!hasHsl && !settings.curveShadows && !settings.curveMidtones && !settings.curveHighlights && !settings.masks.length && !settings.backgroundRemoval && !settings.repairs.some(mark => mark.type === 'redeye')) return;
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const curves = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) curves[i] = curveValue(i, settings);
  const background = settings.backgroundRemoval ? borderColor(data, width, height) : null;
  const tolerance = settings.backgroundRemoval * 1.7;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      let r = curves[data[index]], g = curves[data[index + 1]], b = curves[data[index + 2]];
      if (hasHsl && r + g + b > 0) {
        let [h, s, l] = rgbToHsl(r, g, b);
        for (const key of Object.keys(hueCenters) as HslColor[]) {
          const channel = settings.hsl[key];
          const weight = clamp(1 - hueDistance(h, hueCenters[key]) / 48, 0, 1);
          if (!weight) continue;
          h += channel.hue * weight;
          s = clamp(s * (1 + channel.saturation / 100 * weight), 0, 1);
          l = clamp(l + channel.luminance / 300 * weight, 0, 1);
        }
        [r, g, b] = hslToRgb(h, s, l);
      }
      if (settings.masks.length) {
        const local = maskWeights(settings, x / width, y / height);
        const light = 1 + local.exposure / 180;
        r = r * light + local.temperature * 0.16;
        g *= light;
        b = b * light - local.temperature * 0.16;
        if (local.saturation) {
          const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
          const amount = 1 + local.saturation / 100;
          r = luma + (r - luma) * amount; g = luma + (g - luma) * amount; b = luma + (b - luma) * amount;
        }
      }
      for (const mark of settings.repairs) {
        if (mark.type !== 'redeye') continue;
        const distance = Math.hypot(x / width - mark.x, y / height - mark.y);
        if (distance < mark.radius && r > g * 1.3 && r > b * 1.25) {
          const neutral = (g + b) / 2;
          const weight = clamp(1 - distance / mark.radius, 0, 1);
          r = r * (1 - weight) + neutral * weight;
        }
      }
      data[index] = clamp(r); data[index + 1] = clamp(g); data[index + 2] = clamp(b);
      if (background) {
        const distance = Math.hypot(r - background[0], g - background[1], b - background[2]);
        data[index + 3] = Math.round(data[index + 3] * backgroundAlpha(distance, tolerance));
      }
    }
  }
  context.putImageData(image, 0, 0);
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

export function applyAdvancedRendering(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings) {
  applyRepairs(context, width, height, settings);
  applyDetail(context, width, height, settings);
  applyAdvancedPixels(context, width, height, settings);
  applyPerspective(context, width, height, settings);
  drawCreativeLayers(context, width, height, settings);
}
