/* =========================================================
   AETHERION — procedural audio engine (WebAudio, zero assets)
   Every sound is synthesised at runtime, so the APK stays tiny
   and there are no third-party audio licences to worry about.
   ========================================================= */
import type { ElementId } from '../data/elements';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;
  private musicTimer = 0;
  private musicStep = 0;
  private wind: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  masterVolume = 0.85;
  sfxVolume = 0.9;
  musicVolume = 0.42;

  init() {
    if (this.started) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 6;
      comp.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(comp);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(comp);

      // pre-bake a noise buffer for whooshes / impacts / wind
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
      this.started = true;
      this.startWind();
    } catch (err) {
      console.warn('[audio] unavailable', err);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(master: number, sfx: number, music: number) {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (!this.ctx) return;
    this.master.gain.value = master;
    this.sfxBus.gain.value = sfx;
    this.musicBus.gain.value = music;
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noise(duration: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = this.now();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, duration * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  private tone(
    freq: number,
    duration: number,
    gain = 0.18,
    type: OscillatorType = 'sine',
    slideTo?: number,
    delay = 0,
  ) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now() + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // ---------------- gameplay SFX ----------------
  swing(kind: 'light' | 'heavy' | 'spear' | 'bow' = 'light') {
    if (!this.started) return;
    const cfg = {
      light: { f: 2600, g: 0.16, d: 0.16 },
      heavy: { f: 900, g: 0.28, d: 0.3 },
      spear: { f: 3400, g: 0.14, d: 0.2 },
      bow: { f: 1800, g: 0.12, d: 0.12 },
    }[kind];
    this.noise(cfg.d, cfg.g, 'bandpass', cfg.f, 1.2);
  }

  impact(heavy = false) {
    if (!this.started) return;
    this.tone(heavy ? 90 : 150, heavy ? 0.24 : 0.12, heavy ? 0.35 : 0.2, 'square', 42);
    this.noise(heavy ? 0.22 : 0.12, 0.22, 'lowpass', 1200);
  }

  hurt() {
    if (!this.started) return;
    this.tone(320, 0.28, 0.22, 'sawtooth', 120);
    this.noise(0.2, 0.16, 'lowpass', 800);
  }

  element(el: ElementId) {
    if (!this.started) return;
    const map: Record<string, { f: number; to: number; type: OscillatorType; g: number }> = {
      pyro: { f: 220, to: 660, type: 'sawtooth', g: 0.14 },
      hydro: { f: 440, to: 220, type: 'sine', g: 0.16 },
      electro: { f: 1200, to: 300, type: 'square', g: 0.1 },
      cryo: { f: 1800, to: 2600, type: 'triangle', g: 0.12 },
      anemo: { f: 660, to: 1400, type: 'sine', g: 0.13 },
      geo: { f: 140, to: 90, type: 'square', g: 0.18 },
      dendro: { f: 520, to: 700, type: 'triangle', g: 0.12 },
      none: { f: 400, to: 400, type: 'sine', g: 0.1 },
    };
    const c = map[el] ?? map.none;
    this.tone(c.f, 0.34, c.g, c.type, c.to);
    this.noise(0.3, 0.12, 'bandpass', c.f * 2, 0.8);
  }

  jump() { if (this.started) this.tone(420, 0.16, 0.1, 'sine', 700); }
  land() { if (this.started) this.noise(0.14, 0.14, 'lowpass', 500); }
  glide() { if (this.started) this.noise(0.5, 0.09, 'bandpass', 700, 0.6); }
  pickup() { if (this.started) { this.tone(880, 0.12, 0.12, 'triangle'); this.tone(1320, 0.16, 0.09, 'sine', undefined, 0.06); } }
  coin() { if (this.started) { this.tone(1180, 0.08, 0.1, 'square'); this.tone(1560, 0.1, 0.08, 'square', undefined, 0.05); } }
  ui() { if (this.started) this.tone(760, 0.05, 0.06, 'sine'); }
  uiBack() { if (this.started) this.tone(420, 0.06, 0.05, 'sine'); }
  levelUp() {
    if (!this.started) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 0.12, 'triangle', undefined, i * 0.09));
  }
  chest() {
    if (!this.started) return;
    [392, 523, 659, 880].forEach((f, i) => this.tone(f, 0.6, 0.1, 'sine', undefined, i * 0.08));
    this.noise(0.5, 0.1, 'highpass', 2400);
  }
  burst() {
    if (!this.started) return;
    this.tone(110, 0.9, 0.28, 'sine', 55);
    this.noise(0.8, 0.24, 'lowpass', 900);
  }
  death() { if (this.started) { this.tone(220, 1.1, 0.2, 'sine', 60); this.noise(0.7, 0.16, 'lowpass', 500); } }

  // ---------------- ambience ----------------
  private startWind() {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 480;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.musicBus);
    src.start();
    this.wind = { src, filter, gain };
  }

  setWindIntensity(v: number) {
    if (!this.wind) return;
    this.wind.gain.gain.value = 0.035 + v * 0.06;
    this.wind.filter.frequency.value = 380 + v * 420;
  }

  /** Generative, non-looping-feeling ambient score. Called every frame. */
  updateMusic(dt: number, tension = 0) {
    if (!this.ctx || this.musicVolume <= 0.01) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 2.4 - tension * 0.6;
    const scale = [0, 3, 5, 7, 10];
    const root = tension > 0.5 ? 110 : 146.83;
    const step = this.musicStep++;
    const semi = scale[(step * 3 + 1) % scale.length];
    const f = root * Math.pow(2, semi / 12);
    const ctx = this.ctx;
    const t = this.now();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.6);
    const del = ctx.createDelay(0.6);
    del.delayTime.value = 0.34;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    osc.connect(g).connect(this.musicBus);
    g.connect(del).connect(fb).connect(del);
    del.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 4.8);

    // low drone every 4 steps
    if (step % 4 === 0) {
      const drone = ctx.createOscillator();
      drone.type = 'triangle';
      drone.frequency.value = root / 2;
      const dg = ctx.createGain();
      dg.gain.setValueAtTime(0.0001, t);
      dg.gain.exponentialRampToValueAtTime(0.05, t + 2);
      dg.gain.exponentialRampToValueAtTime(0.0001, t + 9);
      drone.connect(dg).connect(this.musicBus);
      drone.start(t);
      drone.stop(t + 9.2);
    }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resumeAll() { this.resume(); }
}
