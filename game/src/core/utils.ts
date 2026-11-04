/* =========================================================
   AETHERION — math / noise / misc utilities
   Deterministic, dependency-light, mobile friendly.
   ========================================================= */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (v - a) / (b - a || 1);
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export const saturate = (v: number) => clamp(v, 0, 1);
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let d = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return current + d * (1 - Math.exp(-lambda * dt));
}
export const moveTowards = (cur: number, target: number, maxDelta: number) =>
  cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target);

/** Shortest signed angle difference. */
export function angleDelta(a: number, b: number) {
  return ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

/** mulberry32 — tiny deterministic PRNG. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;
export const rngRange = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const rngInt = (r: Rng, a: number, b: number) => Math.floor(a + (b - a + 1) * r()) | 0;
export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}

/** Integer hash → [0,1). Used by noise. */
export function hash2(ix: number, iy: number, seed = 0) {
  let h = ix * 374761393 + iy * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1]. */
export function valueNoise2(x: number, y: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = smoothstep(fx), uy = smoothstep(fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/** Fractal brownian motion in [0,1]. */
export function fbm2(x: number, y: number, octaves = 4, seed = 0, lacunarity = 2.0, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 71);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged noise — good for mountain crests. */
export function ridge2(x: number, y: number, octaves = 4, seed = 0) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2(x * freq, y * freq, seed + i * 131) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Simple object pool. */
export class Pool<T> {
  private items: T[] = [];
  constructor(private factory: () => T, prefill = 0) {
    for (let i = 0; i < prefill; i++) this.items.push(factory());
  }
  get(): T {
    return this.items.pop() ?? this.factory();
  }
  put(item: T) {
    if (this.items.length < 512) this.items.push(item);
  }
}

export function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return Math.round(n).toString();
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Cheap deterministic shake curve. */
export function shakeCurve(t: number) {
  return Math.sin(t * 47.3) * Math.cos(t * 23.7) * (1 - t);
}
