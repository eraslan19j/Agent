/* =========================================================
   AETHERION — dynamic weather
   clear → overcast → rain → storm cycles with GPU points for
   rain, a lightning flash, drifting fog and a wet colour grade.
   Everything is procedural; no textures are loaded.
   ========================================================= */
import * as THREE from 'three';
import type { GameContext } from '../game/types';
import { clamp, lerp } from '../core/utils';

export type WeatherMode = 'clear' | 'rain' | 'storm';

const RAIN_COUNT = 2200;
const AREA = 46;
const HEIGHT = 26;

const CLEAR_FOG = new THREE.Color(0xb6d3ea);
const RAIN_FOG = new THREE.Color(0x8d9aa8);
const STORM_FOG = new THREE.Color(0x5f6a78);

/** Rain streak shader: a point cloud stretched into vertical dashes. */
function makeRainMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xaecbe4) },
      uOpacity: { value: 0.0 },
      uSize: { value: 34.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize / max(1.0, -mv.z) * 40.0;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        // narrow vertical streak
        float a = smoothstep(0.5, 0.0, abs(uv.x) * 6.0) * smoothstep(0.5, 0.1, abs(uv.y));
        if (a <= 0.01) discard;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
  }) as THREE.ShaderMaterial;
}

export class Weather {
  mode: WeatherMode = 'clear';
  /** 0 = dry, 1 = full downpour */
  intensity = 0;
  /** flash value used for lightning, decays every frame */
  flash = 0;
  private timer = 44;
  private rain: THREE.Points;
  private material: THREE.ShaderMaterial;
  private positions: Float32Array;
  private speeds: Float32Array;
  private drift = new THREE.Vector3();
  private lightningTimer = 6;
  private scene: THREE.Scene;
  private baseExposure = 1.06;
  private rnd = Math.random;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.positions = new Float32Array(RAIN_COUNT * 3);
    this.speeds = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.positions[i * 3 + 0] = (Math.random() - 0.5) * AREA;
      this.positions[i * 3 + 1] = Math.random() * HEIGHT;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * AREA;
      this.speeds[i] = 26 + Math.random() * 22;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = makeRainMaterial();
    this.rain = new THREE.Points(geo, this.material);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.name = 'rain';
    scene.add(this.rain);
  }

  reset() {
    this.mode = 'clear';
    this.intensity = 0;
    this.flash = 0;
    this.timer = 50 + this.rnd() * 40;
    this.rain.visible = false;
    this.material.uniforms.uOpacity.value = 0;
  }

  /** Next weather state, chosen with a bias towards clear skies. */
  private rollNext() {
    const r = this.rnd();
    if (this.mode === 'clear') this.mode = r < 0.72 ? 'rain' : 'storm';
    else if (this.mode === 'rain') this.mode = r < 0.45 ? 'storm' : 'clear';
    else this.mode = r < 0.7 ? 'rain' : 'clear';
    this.timer = this.mode === 'clear'
      ? 70 + this.rnd() * 80
      : this.mode === 'rain' ? 55 + this.rnd() * 50 : 40 + this.rnd() * 35;
    this.lightningTimer = 1.5 + this.rnd() * 3;
  }

  update(dt: number, ctx: GameContext) {
    this.timer -= dt;
    if (this.timer <= 0) this.rollNext();

    const target = this.mode === 'clear' ? 0 : this.mode === 'rain' ? 0.65 : 1;
    this.intensity = lerp(this.intensity, target, 1 - Math.exp(-dt * 0.35));

    // ---- rain particles follow the camera ----
    const cam = ctx.engine.camera;
    const camPos = cam.position;
    const visible = this.intensity > 0.02;
    this.rain.visible = visible;
    this.material.uniforms.uOpacity.value = this.intensity * 0.75;
    this.material.uniforms.uSize.value = 26 + this.intensity * 16;

    if (visible) {
      const fallScale = 0.55 + this.intensity * 0.75;
      const wind = this.mode === 'storm' ? 6.5 : 2.2;
      this.drift.set(wind * this.intensity, 0, wind * 0.35 * this.intensity);
      const arr = this.positions;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const i3 = i * 3;
        arr[i3 + 1] -= this.speeds[i] * fallScale * dt;
        arr[i3 + 0] += this.drift.x * dt;
        arr[i3 + 2] += this.drift.z * dt;
        if (arr[i3 + 1] < camPos.y - 8) {
          // respawn above the camera, inside the moving box
          arr[i3 + 0] = camPos.x + (this.rnd() - 0.5) * AREA;
          arr[i3 + 1] = camPos.y + HEIGHT * (0.55 + this.rnd() * 0.45);
          arr[i3 + 2] = camPos.z + (this.rnd() - 0.5) * AREA;
        } else if (Math.abs(arr[i3] - camPos.x) > AREA * 0.6) {
          arr[i3] = camPos.x + (this.rnd() - 0.5) * AREA;
        } else if (Math.abs(arr[i3 + 2] - camPos.z) > AREA * 0.6) {
          arr[i3 + 2] = camPos.z + (this.rnd() - 0.5) * AREA;
        }
      }
      (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    // ---- atmosphere ----
    const fog = this.scene.fog as THREE.FogExp2 | null;
    if (fog && (fog as any).isFogExp2) {
      const store = fog as any;
      store.__baseDensity = store.__baseDensity ?? fog.density;
      fog.density = store.__baseDensity * (1 + this.intensity * 1.35);
      if (!store.__baseColor) store.__baseColor = fog.color.clone();
      const baseColor = store.__baseColor as THREE.Color;
      const targetColor = this.mode === 'storm' ? STORM_FOG : this.mode === 'rain' ? RAIN_FOG : CLEAR_FOG;
      fog.color.copy(baseColor).lerp(targetColor, this.intensity);
    }

    // ---- lightning ----
    this.flash = Math.max(0, this.flash - dt * 6.5);
    if (this.mode === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 2.4 + this.rnd() * 5;
        this.flash = 0.85 + this.rnd() * 0.15;
        const p = ctx.player?.position;
        if (p) {
          const a = this.rnd() * Math.PI * 2;
          const d = 24 + this.rnd() * 26;
          const from = new THREE.Vector3(p.x + Math.cos(a) * d, p.y + 40, p.z + Math.sin(a) * d);
          const to = new THREE.Vector3(from.x + (this.rnd() - 0.5) * 6, ctx.terrain.heightAt(from.x, from.z), from.z + (this.rnd() - 0.5) * 6);
          ctx.effects?.lightning?.(from, to, '#dfeaff');
          ctx.audio?.thunder?.();
          ctx.requestShake(0.18);
        }
      }
    }

    // exposure bump on flash
    const exposure = this.baseExposure + this.flash * 0.55 - this.intensity * 0.10;
    ctx.engine.renderer.toneMappingExposure = exposure;
  }

  /** 0..1 how wet/stormy it is — used by the HUD and audio mix. */
  get storm() {
    return clamp(this.intensity, 0, 1);
  }

  dispose() {
    this.scene.remove(this.rain);
    this.rain.geometry.dispose();
    this.material.dispose();
  }
}
