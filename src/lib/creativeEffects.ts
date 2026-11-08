import type { CreativeEffectId, CreativeEffectSettings, EditSettings } from '../types';

export interface CreativeEffectDefinition {
  id: CreativeEffectId;
  name: string;
  defaultIntensity: number;
  animated: boolean;
}

export const CREATIVE_EFFECTS: readonly CreativeEffectDefinition[] = [
  { id: 'none', name: 'Kapalı', defaultIntensity: 0, animated: false },
  { id: 'glow', name: 'Glow / Bloom', defaultIntensity: 42, animated: false },
  { id: 'soft-focus', name: 'Yumuşak odak', defaultIntensity: 38, animated: false },
  { id: 'light-leak', name: 'Işık sızıntısı', defaultIntensity: 44, animated: false },
  { id: 'flare', name: 'Lens flare', defaultIntensity: 38, animated: false },
  { id: 'vhs', name: 'VHS', defaultIntensity: 36, animated: true },
  { id: 'film', name: 'Film', defaultIntensity: 34, animated: true },
  { id: 'scanlines', name: 'Tarama çizgileri', defaultIntensity: 32, animated: false },
  { id: 'glitch', name: 'Glitch', defaultIntensity: 28, animated: true },
  { id: 'rgb-shift', name: 'RGB kayması', defaultIntensity: 32, animated: false },
  { id: 'shake', name: 'Titreşim', defaultIntensity: 24, animated: true },
  { id: 'pixelate', name: 'Pixel', defaultIntensity: 34, animated: false },
  { id: 'monochrome', name: 'Monokrom', defaultIntensity: 72, animated: false },
  { id: 'duotone', name: 'Duotone', defaultIntensity: 58, animated: false },
  { id: 'sepia', name: 'Sepya', defaultIntensity: 62, animated: false },
  { id: 'vignette', name: 'Vinyet', defaultIntensity: 42, animated: false },
  { id: 'letterbox', name: 'Letterbox', defaultIntensity: 58, animated: false },
] as const;

export const DEFAULT_CREATIVE_SETTINGS: CreativeEffectSettings = {
  id: 'none', intensity: 0, particles: false, particleIntensity: 35, dateStamp: false, dateStampText: '',
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const effectDefinition = (id: string) => CREATIVE_EFFECTS.find(effect => effect.id === id);

export function normalizeCreativeSettings(input?: Partial<CreativeEffectSettings>): CreativeEffectSettings {
  const definition = input?.id ? effectDefinition(input.id) : undefined;
  const intensity = Number(input?.intensity);
  const particles = Number(input?.particleIntensity);
  return {
    id: definition?.id ?? 'none',
    intensity: definition ? clamp(Number.isFinite(intensity) ? intensity : definition.defaultIntensity, 0, 100) : 0,
    particles: input?.particles === true,
    particleIntensity: clamp(Number.isFinite(particles) ? particles : 35, 0, 100),
    dateStamp: input?.dateStamp === true,
    dateStampText: typeof input?.dateStampText === 'string' ? input.dateStampText.slice(0, 16) : '',
  };
}

export function hasCreativeEffect(settings: Pick<EditSettings, 'creative'>) {
  const creative = normalizeCreativeSettings(settings.creative);
  return Boolean((creative.id !== 'none' && creative.intensity > 0) || creative.particles || creative.dateStamp);
}

/** Stable across preview/export; video can vary the explicit frame time. */
export function creativeNoise(index: number, time = 0) {
  const value = Math.sin(index * 127.1 + Math.floor(time * 12) * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function letterboxRatio(intensity: number) { return clamp(intensity, 0, 100) / 100 * 0.12; }

export function formatCreativeDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

export type CreativeBackend = 'webgl' | 'canvas2d' | 'none';
interface CreativeRenderOptions { time?: number; forceBackend?: 'webgl' | 'canvas2d'; }

const effectNumbers: Record<CreativeEffectId, number> = {
  none: 0, glow: 1, 'soft-focus': 2, 'light-leak': 3, flare: 4, vhs: 5, film: 6,
  scanlines: 7, glitch: 8, 'rgb-shift': 9, shake: 10, pixelate: 11, monochrome: 12,
  duotone: 13, sepia: 14, vignette: 15, letterbox: 16,
};

const vertexShader = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }
`;
const fragmentShader = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_time;
uniform float u_particles;
uniform int u_effect;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
vec4 sampleImage(vec2 uv) { return texture2D(u_image, clamp(uv, 0.001, 0.999)); }
vec4 blurred(vec2 uv, float radius) {
  vec2 p = radius / u_resolution;
  vec4 color = sampleImage(uv) * 0.20;
  color += sampleImage(uv + vec2(p.x,0.0)) * 0.12;
  color += sampleImage(uv - vec2(p.x,0.0)) * 0.12;
  color += sampleImage(uv + vec2(0.0,p.y)) * 0.12;
  color += sampleImage(uv - vec2(0.0,p.y)) * 0.12;
  color += sampleImage(uv + p) * 0.08;
  color += sampleImage(uv - p) * 0.08;
  color += sampleImage(uv + vec2(p.x,-p.y)) * 0.08;
  color += sampleImage(uv + vec2(-p.x,p.y)) * 0.08;
  return color;
}
void main() {
  vec2 uv = v_uv;
  float a = u_amount;
  float frame = floor(u_time * 12.0);
  if (u_effect == 5) uv.x += (hash(vec2(floor(uv.y * 90.0),frame)) - 0.5) * 0.018 * a;
  if (u_effect == 8) {
    float row = floor(uv.y * 24.0);
    float block = step(0.76, hash(vec2(row,frame)));
    uv.x += block * (hash(vec2(row + 4.0,frame)) - 0.5) * 0.14 * a;
  }
  if (u_effect == 10) uv += vec2(sin(u_time * 12.0 + 0.7),cos(u_time * 9.0 + 0.4)) * 0.009 * a;
  if (u_effect == 11) { float cells = mix(190.0,28.0,a); uv = (floor(uv * cells) + 0.5) / cells; }
  vec4 base = sampleImage(uv);
  vec3 color = base.rgb;
  if (u_effect == 1) {
    vec3 blur = blurred(uv,10.0).rgb;
    float light = smoothstep(0.42,0.9,dot(blur,vec3(0.2126,0.7152,0.0722)));
    color += blur * light * 0.72 * a;
  } else if (u_effect == 2) {
    color = mix(color,blurred(uv,7.0).rgb,0.72 * a);
  } else if (u_effect == 3) {
    vec2 p = vec2(0.92,0.10);
    float leak = exp(-distance(uv,p) * 3.6) + 0.45 * exp(-distance(uv,vec2(0.02,0.88)) * 5.0);
    color += vec3(1.0,0.24,0.045) * leak * 0.75 * a;
  } else if (u_effect == 4) {
    vec2 p = vec2(0.76,0.24);
    float glow = exp(-distance(uv,p) * 8.0);
    float ring = smoothstep(0.012,0.0,abs(distance(uv,vec2(0.34,0.68)) - 0.09));
    color += vec3(1.0,0.76,0.43) * glow * a + vec3(0.25,0.65,1.0) * ring * 0.25 * a;
  } else if (u_effect == 5) {
    color = mix(color,blurred(uv,2.0).rgb,0.24 * a);
    color *= 0.90 + 0.10 * sin(uv.y * u_resolution.y * 2.2);
    color += (hash(uv * u_resolution + frame) - 0.5) * 0.13 * a;
  } else if (u_effect == 6) {
    float luma = dot(color,vec3(0.2126,0.7152,0.0722));
    color = mix(color,vec3(luma) * vec3(1.12,1.02,0.82),0.34 * a);
    color += (hash(uv * u_resolution + frame) - 0.5) * 0.17 * a;
  } else if (u_effect == 7) {
    color *= 1.0 - step(0.5,fract(uv.y * u_resolution.y / 4.0)) * 0.34 * a;
  } else if (u_effect == 8) {
    color = mix(color,blurred(uv,2.0).rgb,0.16 * a);
    color += (hash(uv * 60.0 + frame) - 0.5) * 0.10 * a;
  } else if (u_effect == 9) {
    vec2 shift = vec2(0.012 * a,0.0);
    color = vec3(sampleImage(uv + shift).r,color.g,sampleImage(uv - shift).b);
  } else if (u_effect == 10) {
    color = mix(color,sampleImage(v_uv).rgb,0.35);
  } else if (u_effect == 12) {
    float luma = dot(color,vec3(0.2126,0.7152,0.0722));
    color = mix(color,vec3(luma),a);
  } else if (u_effect == 13) {
    float luma = dot(color,vec3(0.2126,0.7152,0.0722));
    vec3 duo = mix(vec3(0.08,0.04,0.18),vec3(1.0,0.55,0.24),luma);
    color = mix(color,duo,a);
  } else if (u_effect == 14) {
    float luma = dot(color,vec3(0.2126,0.7152,0.0722));
    color = mix(color,vec3(luma) * vec3(1.18,1.0,0.72),a);
  } else if (u_effect == 15) {
    float edge = smoothstep(0.30,0.76,distance(v_uv,vec2(0.5)));
    color *= 1.0 - edge * 0.82 * a;
  } else if (u_effect == 16) {
    float bar = 0.12 * a;
    if (v_uv.y < bar || v_uv.y > 1.0 - bar) color = vec3(0.0);
  }
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    vec2 p = vec2(hash(vec2(fi,2.0)),fract(hash(vec2(fi,7.0)) + u_time * (0.015 + fi * 0.001)));
    float d = distance(v_uv,p);
    float sparkle = smoothstep(0.009,0.0,d) * (0.45 + 0.55 * hash(vec2(fi,frame)));
    color += vec3(1.0,0.82,0.52) * sparkle * u_particles;
  }
  gl_FragColor = vec4(clamp(color,0.0,1.0),base.a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader oluşturulamadı.');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'WebGL shader derlenemedi.';
    gl.deleteShader(shader); throw new Error(message);
  }
  return shader;
}

function renderWebGL(source: HTMLCanvasElement, settings: CreativeEffectSettings, time: number) {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let buffer: WebGLBuffer | null = null;
  try {
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    program = gl.createProgram();
    if (!program) throw new Error('WebGL programı oluşturulamadı.');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL programı bağlanamadı.');
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_amount'), settings.id === 'none' ? 0 : settings.intensity / 100);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time);
    gl.uniform1f(gl.getUniformLocation(program, 'u_particles'), settings.particles ? settings.particleIntensity / 100 : 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_effect'), effectNumbers[settings.id]);
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLES, 0, 6);
    return { canvas, dispose: () => gl.getExtension('WEBGL_lose_context')?.loseContext() };
  } catch {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  } finally {
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
  }
}

function copyCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  canvas.getContext('2d')!.drawImage(source, 0, 0); return canvas;
}

function drawParticles(context: CanvasRenderingContext2D, width: number, height: number, settings: CreativeEffectSettings, time: number) {
  if (!settings.particles || settings.particleIntensity <= 0) return;
  const amount = settings.particleIntensity / 100;
  const unit = Math.min(width, height);
  context.save(); context.fillStyle = '#FFE0A3';
  for (let index = 0; index < 12; index += 1) {
    const x = creativeNoise(index + 2, 0) * width;
    const y = (creativeNoise(index + 7, 0) + time * (0.015 + index * 0.001)) % 1 * height;
    const radius = Math.max(1, unit * 0.006 * (0.6 + creativeNoise(index + 13, time)));
    context.globalAlpha = amount * (0.35 + creativeNoise(index + 19, time) * 0.55);
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

function drawDateStamp(context: CanvasRenderingContext2D, width: number, height: number, settings: CreativeEffectSettings) {
  if (!settings.dateStamp || !settings.dateStampText) return;
  const unit = Math.min(width, height);
  const size = Math.max(12, unit * 0.035);
  const padding = size * 0.38;
  context.save(); context.font = `600 ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  context.textAlign = 'right'; context.textBaseline = 'bottom';
  const x = width - unit * 0.035, y = height - unit * 0.03;
  const measured = context.measureText(settings.dateStampText).width;
  context.fillStyle = 'rgba(0,0,0,.58)';
  context.fillRect(x - measured - padding * 2, y - size - padding * 2, measured + padding * 2, size + padding * 1.6);
  context.fillStyle = '#FFB15C'; context.fillText(settings.dateStampText, x - padding, y - padding * 0.55);
  context.restore();
}

function renderCanvas2D(context: CanvasRenderingContext2D, source: HTMLCanvasElement, settings: CreativeEffectSettings, time: number) {
  const { width, height } = source;
  const amount = settings.intensity / 100;
  const id = settings.id;
  context.save(); context.clearRect(0, 0, width, height);
  if (id === 'pixelate') {
    const cells = Math.round(190 - amount * 162);
    const small = document.createElement('canvas'); small.width = Math.max(1, Math.round(width / cells * 12)); small.height = Math.max(1, Math.round(height / cells * 12));
    small.getContext('2d')!.drawImage(source, 0, 0, small.width, small.height);
    context.imageSmoothingEnabled = false; context.drawImage(small, 0, 0, width, height);
  } else {
    const filters: Partial<Record<CreativeEffectId, string>> = {
      monochrome: `grayscale(${amount})`, sepia: `sepia(${amount})`,
      duotone: `grayscale(${amount})`, film: `sepia(${amount * .3}) contrast(${1 + amount * .08}) saturate(${1 - amount * .2})`,
      vhs: `contrast(${1 + amount * .1}) saturate(${1 - amount * .2})`,
    };
    context.filter = filters[id] ?? 'none'; context.drawImage(source, 0, 0); context.filter = 'none';
  }
  if (id === 'glow' || id === 'soft-focus') {
    context.save(); context.globalAlpha = id === 'glow' ? amount * .58 : amount * .72;
    context.globalCompositeOperation = id === 'glow' ? 'screen' : 'source-over';
    context.filter = `blur(${Math.max(1, Math.min(width, height) * (id === 'glow' ? .012 : .007))}px) brightness(${id === 'glow' ? 1.25 : 1})`;
    context.drawImage(source, 0, 0); context.restore();
  }
  if (id === 'light-leak' || id === 'flare') {
    const x = width * (id === 'flare' ? .76 : .92), y = height * (id === 'flare' ? .24 : .1);
    const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * .72);
    gradient.addColorStop(0, `rgba(255,190,105,${amount * .75})`); gradient.addColorStop(.35, `rgba(255,75,35,${amount * .3})`); gradient.addColorStop(1, 'rgba(255,60,20,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    if (id === 'flare') { context.strokeStyle = `rgba(100,170,255,${amount * .35})`; context.lineWidth = Math.max(1, Math.min(width, height) * .008); context.beginPath(); context.arc(width * .34, height * .68, Math.min(width, height) * .09, 0, Math.PI * 2); context.stroke(); }
  }
  if (id === 'duotone') {
    context.save(); context.globalCompositeOperation = 'multiply'; context.globalAlpha = amount * .65;
    const gradient = context.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, '#24113F'); gradient.addColorStop(1, '#FF8C47'); context.fillStyle = gradient; context.fillRect(0, 0, width, height); context.restore();
  }
  if (id === 'vhs' || id === 'glitch' || id === 'shake' || id === 'rgb-shift') {
    if (id === 'shake') {
      context.save(); context.globalAlpha = amount * .55;
      const dx = Math.sin(time * 12 + .7) * width * .02 * amount;
      const dy = Math.cos(time * 9 + .4) * height * .02 * amount;
      context.drawImage(source, dx, dy); context.restore();
    }
    const slices = id === 'glitch' ? 8 : 3;
    for (let index = 0; index < slices; index += 1) {
      const sy = Math.floor(creativeNoise(index + 31, time) * height);
      const sh = Math.max(1, Math.floor(height * (id === 'glitch' ? .045 : .018)));
      const offset = (creativeNoise(index + 41, time) - .5) * width * amount * (id === 'glitch' ? .14 : .025);
      context.drawImage(source, 0, sy, width, sh, offset, sy, width, sh);
    }
    if (id === 'rgb-shift') { context.save(); context.globalAlpha = amount * .2; context.globalCompositeOperation = 'screen'; context.drawImage(source, width * .012 * amount, 0); context.restore(); }
  }
  if (id === 'vhs' || id === 'film') {
    context.fillStyle = '#FFFFFF';
    const dots = Math.round(Math.min(900, width * height / 3000) * amount);
    for (let index = 0; index < dots; index += 1) { context.globalAlpha = creativeNoise(index + 51, time) * .18; context.fillRect(creativeNoise(index + 61, time) * width, creativeNoise(index + 71, time) * height, 1, 1); }
    context.globalAlpha = 1;
  }
  if (id === 'vhs' || id === 'scanlines') {
    const step = Math.max(3, Math.round(height / 240 * 3)); context.fillStyle = `rgba(0,0,0,${amount * .25})`;
    for (let y = 0; y < height; y += step) context.fillRect(0, y, width, Math.max(1, step / 3));
  }
  if (id === 'vignette') {
    const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .2, width / 2, height / 2, Math.max(width, height) * .68);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${amount * .82})`); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  }
  if (id === 'letterbox') { const bar = height * letterboxRatio(settings.intensity); context.fillStyle = '#000'; context.fillRect(0, 0, width, bar); context.fillRect(0, height - bar, width, bar); }
  context.restore();
  drawParticles(context, width, height, settings, time);
}

/**
 * Shared photo/video frame effects. One WebGL pass when available, otherwise a
 * bounded Canvas2D path. Date typography stays deterministic in project data.
 */
export function applyCreativeEffects(context: CanvasRenderingContext2D, width: number, height: number, settings: EditSettings, options: CreativeRenderOptions = {}): CreativeBackend {
  const creative = normalizeCreativeSettings(settings.creative);
  const time = options.time ?? 0;
  const active = creative.id !== 'none' && creative.intensity > 0;
  if (!active && !creative.particles) { drawDateStamp(context, width, height, creative); return 'none'; }
  const source = copyCanvas(context.canvas);
  let backend: CreativeBackend = 'canvas2d';
  const rendered = options.forceBackend === 'canvas2d' ? null : renderWebGL(source, creative, time);
  if (rendered) {
    backend = 'webgl';
    try { context.save(); context.clearRect(0, 0, width, height); context.drawImage(rendered.canvas, 0, 0); context.restore(); }
    finally { rendered.dispose(); }
  } else renderCanvas2D(context, source, creative, time);
  drawDateStamp(context, width, height, creative);
  return backend;
}
