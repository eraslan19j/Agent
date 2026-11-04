/* =========================================================
   AETHERION — rendering core
   WebGL2 renderer, ACES tonemapping, quality tiers,
   adaptive resolution, optional HDR bloom, hit-stop clock.
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { clamp } from './utils';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface EngineOptions {
  quality?: QualityLevel;
  bloom?: boolean;
  shadows?: boolean;
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  quality: QualityLevel = 'high';
  bloomEnabled = true;
  shadowsEnabled = true;

  /** Accumulated real time in seconds. */
  elapsed = 0;
  /** Last frame delta, clamped and time-scaled. */
  dt = 0;
  /** Gameplay time scale (hit-stop uses this). */
  timeScale = 1;
  private hitStopTimer = 0;

  /** dynamic resolution multiplier 0.55 – 1 */
  renderScale = 1;
  private baseDpr = 1;
  private adaptiveEnabled = true;
  private frameAccum = 0;
  private frameCount = 0;
  private lastAdjust = 0;

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private composerBroken = false;

  /** camera shake state */
  shakeAmp = 0;

  constructor(private container: HTMLElement, opts: EngineOptions = {}) {
    this.quality = opts.quality ?? 'high';
    this.bloomEnabled = opts.bloom ?? true;
    this.shadowsEnabled = opts.shadows ?? true;

    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x9dc4e8, 1);

    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1400);
    this.camera.position.set(0, 6, 10);

    this.scene.fog = new THREE.FogExp2(0xb6d3ea, 0.0035);

    this.applyQuality(this.quality);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.onOrientation);
  }

  private onOrientation = () => setTimeout(this.resize, 120);

  get canvas() {
    return this.renderer.domElement;
  }

  applyQuality(q: QualityLevel) {
    this.quality = q;
    const cap = (v: number) => Math.min(v, window.devicePixelRatio || 1);
    if (q === 'low') {
      this.baseDpr = cap(1.0);
      this.adaptiveEnabled = true;
      this.shadowsEnabled = false;
    } else if (q === 'medium') {
      this.baseDpr = cap(1.35);
      this.adaptiveEnabled = true;
      this.shadowsEnabled = true;
    } else {
      this.baseDpr = cap(2.0);
      this.adaptiveEnabled = true;
      this.shadowsEnabled = true;
    }
    this.renderer.setPixelRatio(this.baseDpr * this.renderScale);
    this.rebuildComposer();
    this.renderer.shadowMap.enabled = this.shadowsEnabled;
    this.resize();
  }

  setBloom(on: boolean) {
    this.bloomEnabled = on;
    this.rebuildComposer();
  }

  private rebuildComposer() {
    if (this.composer) {
      this.composer.dispose?.();
      this.composer = null;
      this.renderPass = null;
      this.bloomPass = null;
    }
    if (!this.bloomEnabled || this.quality === 'low') return;
    try {
      const size = this.renderer.getSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), {
        type: THREE.HalfFloatType,
        samples: 0,
      });
      const composer = new EffectComposer(this.renderer, rt);
      const rp = new RenderPass(this.scene, this.camera);
      composer.addPass(rp);
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.max(2, size.x), Math.max(2, size.y)),
        this.quality === 'high' ? 0.62 : 0.4,
        0.6,
        0.82,
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      composer.setSize(size.x, size.y);
      this.composer = composer;
      this.renderPass = rp;
      this.bloomPass = bloom;
    } catch (err) {
      console.warn('[engine] post-processing unavailable, using direct render', err);
      this.composer = null;
      this.composerBroken = true;
    }
  }

  resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    // widen FOV a touch on very wide/short screens so the character stays framed
    this.camera.fov = clamp(62 * (1.35 / Math.min(1.9, w / h)), 52, 78);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.baseDpr * this.renderScale);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio?.(this.baseDpr * this.renderScale);
      this.composer.setSize(w, h);
    }
  };

  /** Advance clocks, handle hit-stop. Returns gameplay dt. */
  tick(rawDelta: number): number {
    const raw = clamp(rawDelta, 0, 0.1);
    this.elapsed += raw;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= raw;
      this.timeScale = 0.06;
      if (this.hitStopTimer <= 0) this.timeScale = 1;
    } else {
      this.timeScale = 1;
    }
    this.dt = raw * this.timeScale;
    return this.dt;
  }

  hitStop(duration: number) {
    this.hitStopTimer = Math.max(this.hitStopTimer, Math.min(0.14, duration));
  }

  shake(amount: number) {
    this.shakeAmp = Math.min(1.4, this.shakeAmp + amount);
  }

  consumeShake(dt: number) {
    const amt = this.shakeAmp;
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 3.2);
    return amt;
  }

  render() {
    if (this.composer && !this.composerBroken) {
      try {
        this.composer.render();
        return;
      } catch (err) {
        console.warn('[engine] composer render failed, falling back', err);
        this.composerBroken = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Measure fps and adapt internal resolution. Called once per frame with real delta. */
  adapt(rawDelta: number) {
    if (!this.adaptiveEnabled) return;
    this.frameAccum += rawDelta;
    this.frameCount++;
    if (this.frameAccum < 1.2) return;
    const avgMs = (this.frameAccum / this.frameCount) * 1000;
    this.frameAccum = 0;
    this.frameCount = 0;
    if (this.elapsed - this.lastAdjust < 1.2) return;
    this.lastAdjust = this.elapsed;

    const minScale = 0.6;
    if (avgMs > 26 && this.renderScale > minScale) {
      this.renderScale = Math.max(minScale, this.renderScale - 0.12);
      this.renderer.setPixelRatio(this.baseDpr * this.renderScale);
      this.resize();
    } else if (avgMs < 15 && this.renderScale < 1) {
      this.renderScale = Math.min(1, this.renderScale + 0.06);
      this.renderer.setPixelRatio(this.baseDpr * this.renderScale);
      this.resize();
    }
  }

  dispose() {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.onOrientation);
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
