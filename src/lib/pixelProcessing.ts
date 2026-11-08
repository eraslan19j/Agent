import type { EditSettings, HslColor } from '../types';

const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));
const hueCenters: Record<HslColor, number> = { red: 0, orange: 30, yellow: 60, green: 120, cyan: 180, blue: 235, purple: 285 };
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

export function curveValue(value: number, settings: Pick<EditSettings, 'curveShadows' | 'curveMidtones' | 'curveHighlights'>) {
  const n = value / 255;
  const shadows = settings.curveShadows / 100 * 0.32 * (1 - n) ** 2;
  const midtones = settings.curveMidtones / 100 * 0.24 * (1 - Math.abs(n - 0.5) * 2);
  const highlights = settings.curveHighlights / 100 * 0.32 * n ** 2;
  return clamp(Math.round((n + shadows + midtones + highlights) * 255));
}
export function backgroundAlpha(distance: number, tolerance: number) {
  if (!tolerance) return 1;
  return clamp((distance - tolerance * 0.55) / Math.max(1, tolerance * 0.75), 0, 1);
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
  const l = (max + min) / 2; const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l] as const;
}
function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const section = ((h % 360) + 360) % 360 / 60;
  const values = section < 1 ? [c, x, 0] : section < 2 ? [x, c, 0] : section < 3 ? [0, c, x] : section < 4 ? [0, x, c] : section < 5 ? [x, 0, c] : [c, 0, x];
  return values.map(value => clamp((value + m) * 255));
}
function applyBasePixels(data: Uint8ClampedArray, settings: EditSettings) {
  if (!settings.highlights && !settings.shadows && !settings.temperature && !settings.grain && !settings.fade) return;
  let seed = 419;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let index = 0; index < data.length; index += 4) {
    let red = data[index], green = data[index + 1], blue = data[index + 2];
    const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    const highlightWeight = Math.max(0, (luminance - 0.45) / 0.55);
    const shadowWeight = Math.max(0, (0.55 - luminance) / 0.55);
    const toneFactor = 1 + (settings.highlights / 100) * highlightWeight * 0.65 + (settings.shadows / 100) * shadowWeight * 0.65;
    const noise = settings.grain ? (random() - 0.5) * settings.grain * 0.48 : 0;
    red = red * toneFactor + settings.temperature * 0.22 + noise; green = green * toneFactor + noise; blue = blue * toneFactor - settings.temperature * 0.22 + noise;
    if (settings.fade) { const lift = settings.fade * 0.18; red += lift; green += lift; blue += lift; }
    data[index] = clamp(red); data[index + 1] = clamp(green); data[index + 2] = clamp(blue);
  }
}
function applyDetail(data: Uint8ClampedArray, width: number, height: number, settings: EditSettings) {
  if (!settings.noiseReduction && !settings.sharpen) return;
  const source = new Uint8ClampedArray(data);
  const noise = settings.noiseReduction / 100, sharpen = settings.sharpen / 100 * 0.85;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const index = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const i = index + channel;
      const average = (source[i - 4] + source[i + 4] + source[i - width * 4] + source[i + width * 4]) / 4;
      const difference = Math.abs(source[i] - average);
      const denoised = noise && difference < 70 ? source[i] * (1 - noise) + average * noise : source[i];
      data[i] = clamp(denoised + (denoised - average) * sharpen);
    }
  }
}
function maskWeights(settings: EditSettings, nx: number, ny: number) {
  let exposure = 0, saturation = 0, temperature = 0;
  for (const mask of settings.masks) {
    let distance: number;
    if (mask.type === 'radial') distance = Math.hypot(nx - mask.x, ny - mask.y) / Math.max(0.01, mask.radius);
    else { const angle = mask.angle * Math.PI / 180; distance = Math.abs((nx - mask.x) * Math.cos(angle) + (ny - mask.y) * Math.sin(angle)) / Math.max(0.01, mask.radius); }
    const weight = clamp(1 - (distance - (1 - mask.feather)) / Math.max(0.01, mask.feather), 0, 1);
    exposure += mask.exposure * weight; saturation += mask.saturation * weight; temperature += mask.temperature * weight;
  }
  return { exposure, saturation, temperature };
}
function borderColor(data: Uint8ClampedArray, width: number, height: number) {
  const points = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3], [Math.floor(width / 2), 2], [Math.floor(width / 2), height - 3]];
  const color = [0, 0, 0];
  for (const [x, y] of points) { const index = (y * width + x) * 4; for (let c = 0; c < 3; c += 1) color[c] += data[index + c] / points.length; }
  return color;
}
function applyAdvanced(data: Uint8ClampedArray, width: number, height: number, settings: EditSettings) {
  const hasHsl = Object.values(settings.hsl).some(channel => channel.hue || channel.saturation || channel.luminance);
  if (!hasHsl && !settings.curveShadows && !settings.curveMidtones && !settings.curveHighlights && !settings.masks.length && !settings.backgroundRemoval && !settings.repairs.some(mark => mark.type === 'redeye')) return;
  const curves = new Uint8ClampedArray(256); for (let i = 0; i < 256; i += 1) curves[i] = curveValue(i, settings);
  const background = settings.backgroundRemoval ? borderColor(data, width, height) : null;
  const tolerance = settings.backgroundRemoval * 1.7;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4;
    let r = curves[data[index]], g = curves[data[index + 1]], b = curves[data[index + 2]];
    if (hasHsl && r + g + b > 0) {
      let [h, s, l] = rgbToHsl(r, g, b);
      for (const key of Object.keys(hueCenters) as HslColor[]) {
        const channel = settings.hsl[key]; const weight = clamp(1 - hueDistance(h, hueCenters[key]) / 48, 0, 1);
        if (!weight) continue;
        h += channel.hue * weight; s = clamp(s * (1 + channel.saturation / 100 * weight), 0, 1); l = clamp(l + channel.luminance / 300 * weight, 0, 1);
      }
      [r, g, b] = hslToRgb(h, s, l);
    }
    if (settings.masks.length) {
      const local = maskWeights(settings, (x + .5) / width, (y + .5) / height); const light = 1 + local.exposure / 180;
      r = r * light + local.temperature * 0.16; g *= light; b = b * light - local.temperature * 0.16;
      if (local.saturation) { const luma = r * 0.2126 + g * 0.7152 + b * 0.0722; const amount = 1 + local.saturation / 100; r = luma + (r - luma) * amount; g = luma + (g - luma) * amount; b = luma + (b - luma) * amount; }
    }
    for (const mark of settings.repairs) {
      if (mark.type !== 'redeye') continue;
      const distance = Math.hypot((x + .5) / width - mark.x, (y + .5) / height - mark.y);
      if (distance < mark.radius && r > g * 1.3 && r > b * 1.25) { const neutral = (g + b) / 2; const weight = clamp(1 - distance / mark.radius, 0, 1); r = r * (1 - weight) + neutral * weight; }
    }
    data[index] = clamp(r); data[index + 1] = clamp(g); data[index + 2] = clamp(b);
    if (background) { const distance = Math.hypot(r - background[0], g - background[1], b - background[2]); data[index + 3] = Math.round(data[index + 3] * backgroundAlpha(distance, tolerance)); }
  }
}

/** Pure, worker-safe pixel pipeline. No DOM, network or paid runtime. */
export function processPixelData(data: Uint8ClampedArray, width: number, height: number, settings: EditSettings) {
  applyBasePixels(data, settings);
  applyDetail(data, width, height, settings);
  applyAdvanced(data, width, height, settings);
  return data;
}
