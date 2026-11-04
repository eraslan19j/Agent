/* =========================================================
   AETHERION — game orchestration
   Boot sequence, world streaming, main loop, event wiring.
   ========================================================= */
import * as THREE from 'three';
import { Engine } from './core/engine';
import { ThirdPersonCamera } from './core/camera';
import { Input } from './core/input';
import { AudioEngine } from './core/audio';
import { SaveSystem, defaultSettings, newSave } from './core/save';
import { Emitter, type GameEvents } from './core/events';
import { Terrain } from './world/terrain';
import { Sky } from './world/sky';
import { Water } from './world/water';
import { Scatter } from './world/scatter';
import { WorldObjects } from './world/worldobjects';
import { Props } from './world/props';
import { Weather } from './world/weather';
import { Effects } from './fx/effects';
import { EnemyManager } from './entities/enemy';
import { Player } from './entities/player';
import { HUD } from './ui/hud';
import { Screens } from './ui/screens';
import { QuestSystem } from './systems/quests';
import { InventorySystem } from './systems/inventory';
import { CHARACTERS, PARTY_ORDER } from './data/characters';
import { ELEMENTS } from './data/elements';
import { ENEMIES } from './data/enemies';
import { CHESTS, ITEMS } from './data/items';
import { ZONE_NAMES, LANDMARKS, SPAWN } from './data/world';
import { clamp, damp, formatNumber } from './core/utils';
import type { GameContext } from './game/types';

type Mode = 'boot' | 'menu' | 'play' | 'paused' | 'dead';

const $ = (id: string) => document.getElementById(id)!;

export class Game implements GameContext {
  engine!: Engine;
  terrain!: Terrain;
  sky!: Sky;
  water!: Water;
  scatter!: Scatter;
  effects!: Effects;
  audio!: AudioEngine;
  input!: Input;
  cam!: ThirdPersonCamera;
  events!: Emitter<GameEvents>;
  save!: SaveSystem;
  settings = defaultSettings();
  enemies!: EnemyManager;
  world!: WorldObjects;
  props!: Props;
  weather!: Weather;
  hud!: HUD;
  player!: Player;
  quests!: QuestSystem;
  inventory!: InventorySystem;
  screens!: Screens;

  mode: Mode = 'boot';
  lockTarget: any = null;
  private lastTime = 0;
  private raf = 0;
  private zoneName = '';
  private started = false;
  private menuAngle = 0;
  private cinematicFocus = new THREE.Vector3();
  private lastMenuSave = false;
  private titleBound = false;

  constructor(private container: HTMLElement) {}

  /* =======================================================
     Boot
     ======================================================= */
  async boot() {
    const tips = [
      'İpucu: Element tepkimeleri hasarı iki katına çıkarır — Sera’nın ateşi + Rin’in elektriği Aşırı Yük patlatır.',
      'İpucu: Dik yamaca doğru ilerlersen tırmanmaya başlarsın. Dayanıklılığını izle.',
      'İpucu: Havadayken zıplama tuşu sürüklenmeyi açar. Yamadan atla, vadiye süzül.',
      'İpucu: Mühür taşları hem iyileştirir hem hızlı seyahat noktası olur.',
      'İpucu: Sandıklar parlar. Yaklaş ve etkileşim tuşuna bas.',
      'İpucu: Gölge yaratıkları element zayıflıklarına göre farklı davranır.',
    ];
    let tipIndex = 0;
    const tipEl = $('boot-tip');
    tipEl.textContent = tips[0];
    const tipTimer = setInterval(() => {
      tipIndex = (tipIndex + 1) % tips.length;
      tipEl.textContent = tips[tipIndex];
    }, 3000);

    await this.progress(0.05, 'Motor başlatılıyor…', async () => {
      this.save = new SaveSystem();
      const loaded = this.save.load();
      this.settings = loaded ? this.save.data.settings : defaultSettings();
      this.lastMenuSave = !!loaded?.hasSave;

      this.engine = new Engine(this.container, {
        quality: this.settings.quality,
        bloom: this.settings.bloom,
        shadows: this.settings.shadows,
      });
      this.engine.scene.background = null;
      this.audio = new AudioEngine();
      this.audio.setVolumes(this.settings.master, this.settings.sfx, this.settings.music);
      this.input = new Input();
      this.input.attach();
      this.events = new Emitter<GameEvents>();
      this.quests = new QuestSystem();
      this.screens = new Screens(this);
    });

    await this.progress(0.16, 'Aetheria şekilleniyor…', async () => {
      this.terrain = new Terrain();
      this.engine.scene.add(this.terrain.group);
      this.sky = new Sky(this.engine.scene, this.settings.quality);
      this.sky.setTime(this.save.data.world.time);
      this.water = new Water(this.engine.scene);
      this.effects = new Effects(this.engine.scene);
      this.scatter = new Scatter(this.terrain);
      this.engine.scene.add(this.scatter.group);
      this.cam = new ThirdPersonCamera(this.engine.camera, this.terrain.heightAt);
    });

    await this.progress(0.42, 'Vadiler işleniyor…', async () => {
      // force-build the chunk rings around spawn so the world is solid
      for (let i = 0; i < 40; i++) {
        this.terrain.size; // keep bundler honest
        this.terrain.update(SPAWN.x, SPAWN.z, 3);
        if (i % 8 === 0) await this.tick();
      }
      this.scatter.update(SPAWN.x, SPAWN.z);
      this.scatter.setQuality(this.settings.quality);
    });

    await this.progress(0.62, 'Yolcu uyandırılıyor…', async () => {
      this.player = new Player(this, SPAWN.x, SPAWN.z);
      this.engine.scene.add(this.player.root);
      this.enemies = new EnemyManager(this);
      this.engine.scene.add(this.enemies.group);
      this.world = new WorldObjects();
      this.engine.scene.add(this.world.group);
      this.props = new Props();
      this.engine.scene.add(this.props.group);
      this.weather = new Weather(this.engine.scene);
      this.inventory = new InventorySystem(this);
      this.hud = new HUD(this);
      this.quests.init(this);
      this.cam.snapTo(this.player.position);
    });

    await this.progress(0.78, 'Gölgeler uyanıyor…', async () => {
      this.enemies.populate();
      this.world.build(this.terrain, this);
      this.props.build(this.terrain);
      this.weather.reset();
      this.wireEvents();
      await this.tick();
    });

    await this.progress(1.0, 'Hazır.', async () => {
      this.sky.update(0.016, this.player.position, this.engine.camera);
      this.water.update(0.016, this.engine.camera.position, this.sky.sunDirection, this.sky.dayFactor);
      this.engine.render();
    });

    clearInterval(tipTimer);
    $('boot').classList.add('hidden');
    this.showMenu();
    this.startLoop();
  }

  private async tick() {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  private async progress(value: number, label: string, fn: () => Promise<void> | void) {
    $('boot-fill').style.width = `${Math.round(value * 100)}%`;
    $('boot-msg').textContent = label;
    await this.tick();
    await fn();
    await this.tick();
  }

  /* =======================================================
     Menu
     ======================================================= */
  private showMenu() {
    this.mode = 'menu';
    $('menu').classList.remove('hidden');
    this.hud.setVisible(false);
    const data = this.save.data;
    const hasSave = this.save.hasSave() && data.hasSave;
    const info = hasSave
      ? `Sv.${data.player.level} · ${data.stats.kills} düşman · ${formatNumber(data.player.mora)} Mora`
      : 'Kayıt bulunamadı';
    if (!this.titleBound) {
      this.titleBound = true;
      Screens.bindTitle(
        () => this.startNew(),
        () => this.startContinue(),
        () => { this.screens.open('settings'); },
        () => { this.screens.open('codex'); },
        hasSave,
        info,
      );
    } else {
      this.updateContinueInfo();
    }
    this.screens.onExitToMenu = () => {
      this.save.flush();
      this.mode = 'menu';
      this.hud.setVisible(false);
      $('menu').classList.remove('hidden');
      this.updateContinueInfo();
    };
    this.screens.onResume = () => {
      this.mode = 'play';
      this.input.clearTransient();
    };
    this.cinematicFocus.set(SPAWN.x, this.terrain.heightAt(SPAWN.x, SPAWN.z) + 2.2, SPAWN.z);
  }

  private updateContinueInfo() {
    const cont = $('btn-continue') as HTMLButtonElement;
    const data = this.save.data;
    const hasSave = this.save.hasSave() && data.hasSave;
    cont.disabled = !hasSave;
    $('continue-info').textContent = hasSave
      ? `Sv.${data.player.level} · ${data.stats.kills} düşman · ${formatNumber(data.player.mora)} Mora`
      : 'Kayıt bulunamadı';
  }

  private startNew() {
    this.save.data = newSave();
    this.save.data.hasSave = true;
    this.save.flush();
    this.resetWorld();
    this.beginPlay(true);
  }

  /** Rebuild dynamic world content for a fresh playthrough. */
  private resetWorld() {
    try {
      this.enemies.clearAll();
      this.enemies.populate();
      this.engine.scene.remove(this.world.group);
      this.world.dispose();
      this.world = new WorldObjects();
      this.engine.scene.add(this.world.group);
      this.world.build(this.terrain, this);
      if (this.props) {
        this.props.clear();
        this.props.build(this.terrain);
      }
      if (this.weather) this.weather.reset();
      this.quests.init(this);
      this.zoneName = '';
      this.player.healAll(1);
      for (const id of Object.keys(this.player.energy)) this.player.energy[id] = 20;
    } catch (err) {
      console.warn('[game] reset failed', err);
    }
  }

  private startContinue() {
    this.beginPlay(false);
  }

  private beginPlay(fresh: boolean) {
    this.save.data.hasSave = true;
    this.settings = this.save.data.settings;
    this.input.clearTransient();
    this.audio.init();
    this.audio.resume();
    this.audio.setVolumes(this.settings.master, this.settings.sfx, this.settings.music);

    if (fresh) {
      this.player.position.set(SPAWN.x, this.terrain.heightAt(SPAWN.x, SPAWN.z) + 0.2, SPAWN.z);
      this.player.velocity.set(0, 0, 0);
      this.player.hp = this.player.maxHp;
      this.player.stamina = this.player.maxStamina;
    } else {
      const p = this.save.data.player.position;
      const x = p.x || SPAWN.x;
      const z = p.z || SPAWN.z;
      this.player.position.set(x, this.terrain.heightAt(x, z) + 0.3, z);
      this.player.velocity.set(0, 0, 0);
    }
    const idx = this.save.data.activeChar ?? 0;
    this.player.switchTo(idx);
    this.player.activeId = PARTY_ORDER[idx] ?? 'kael';

    this.cam.snapTo(this.player.position);
    this.mode = 'play';
    this.started = true;
    $('menu').classList.add('hidden');
    this.hud.setVisible(true);
    this.sky.setTime(this.save.data.world.time);

    if (fresh) {
      setTimeout(() => {
        this.notify('Aetheria seni çağırdı. Uyanış Taşı’nı bul.', '✦');
        this.hud.setHint('Sol alt: hareket · Sağ yarı: kamera · Sağ alt: saldırı & yetenekler');
        setTimeout(() => this.hud.setHint(null), 9000);
      }, 700);
    }
  }

  /* =======================================================
     Event wiring
     ======================================================= */
  private wireEvents() {
    this.events.on('enemy:killed', (e) => {
      const def = Object.values(ENEMIES).find((d) => d.id === e.type);
      if (!def) return;
      this.save.data.stats.kills++;
      const moraAmount = Math.round(def.mora * (0.8 + Math.random() * 0.5));
      this.inventory.add('mora', moraAmount, false);
      this.player.addXp(def.xp, this);
      if (def.drops) {
        for (const d of def.drops) {
          if (Math.random() <= d.chance) {
            const amount = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
            if (d.id === 'mora') this.inventory.add('mora', amount, false);
            else this.inventory.add(d.id as any, amount, false);
          }
        }
      }
      this.quests.progressEvent('kill', { type: e.type, elite: def.elite });
      this.effects.burst(new THREE.Vector3(e.x, this.terrain.heightAt(e.x, e.z) + 1, e.z), '#ffe9a8', 12, 3, 0.7);
      this.save.markDirty();
    });

    this.events.on('chest:opened', (e) => this.quests.progressEvent('chest', { id: e.id }));
    this.events.on('pickup:collected', (e) => this.quests.progressEvent('collect', { id: e.id, amount: e.amount }));
    this.events.on('waypoint:activated', (e) => this.quests.progressEvent('waypoint', { id: e.id }));

    this.events.on('player:levelup', (e) => {
      this.hud.toast(`Seviye ${e.level}!`, '★');
    });
    this.events.on('player:died', () => {
      this.mode = 'dead';
      this.screens.showDeath();
      setTimeout(() => {
        if (this.mode === 'dead') {
          this.screens.close();
          this.mode = 'play';
        }
      }, 3200);
    });
    this.events.on('toast', (e) => this.hud.toast(e.text, e.icon));
    this.events.on('quest:completed', () => this.hud.toast('Görev tamamlandı', '✓'));
    this.events.on('world:zone', (e) => this.hud.toast(e.name, '◈'));
  }

  damageNumber(pos: THREE.Vector3, text: string, kind?: any) {
    this.hud?.damageNumber(pos, text, kind);
  }

  notify(text: string, icon?: string) {
    this.hud?.toast(text, icon);
  }

  requestHitStop(seconds: number) {
    this.engine?.hitStop(seconds);
  }

  requestShake(amount: number) {
    this.engine?.shake(amount);
  }

  /* =======================================================
     Loop
     ======================================================= */
  private startLoop() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const raw = this.lastTime ? (now - this.lastTime) / 1000 : 0.016;
      this.lastTime = now;
      try {
        this.frame(raw);
      } catch (err) {
        console.error(err);
        this.fatal(err);
      }
    };
    this.raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save.flush();
    });
    window.addEventListener('beforeunload', () => this.save.flush());
    // android hardware back / in-app pause hook
    (window as any).__androidBack = () => {
      if (this.screens.isOpen) this.screens.close();
      else if (this.mode === 'play') this.screens.open('pause');
    };
    // pause button in the HUD
    document.querySelectorAll('[data-act="pause"]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this.mode === 'play') this.screens.toggle('pause');
        else if (this.screens.isOpen) this.screens.close();
      });
    });
  }

  private frame(raw: number) {
    const engine = this.engine;
    engine.adapt(raw);
    const dt = engine.tick(raw);
    this.input.setNow(engine.elapsed);

    const screensOpen = this.screens.isOpen;
    if (screensOpen && this.mode === 'play') this.mode = 'paused';
    if (!screensOpen && this.mode === 'paused') this.mode = 'play';

    // pause shortcut
    if (this.input.consume('pause')) {
      if (this.screens.isOpen) {
        this.screens.close();
        this.mode = 'play';
      } else if (this.mode === 'play') {
        this.screens.open('pause');
      }
    }
    if (this.input.consume('map') && this.mode === 'play') this.screens.open('map');

    if (this.mode === 'menu') {
      this.updateCinematic(dt, raw);
      engine.render();
      return;
    }

    if (this.mode === 'play' || this.mode === 'dead') {
      this.input.updateKeyboardAxis();
      this.updateWorld(dt, raw);
    } else {
      // paused / dead: keep the world breathing, but frozen
      this.effects.update(dt * 0.25);
      this.sky.update(dt * 0.15, this.player.position, engine.camera);
      engine.render();
      return;
    }

    this.save.tick(raw);
    engine.render();
  }

  private updateCinematic(dt: number, raw: number) {
    this.menuAngle += dt * 0.075;
    const focus = this.cinematicFocus;
    const r = 26;
    const cam = this.engine.camera;
    cam.position.set(
      focus.x + Math.cos(this.menuAngle) * r,
      focus.y + 9 + Math.sin(this.menuAngle * 0.7) * 2.5,
      focus.z + Math.sin(this.menuAngle) * r,
    );
    cam.lookAt(focus);
    cam.fov = 58;
    cam.updateProjectionMatrix();
    this.sky.update(dt, focus, cam);
    this.terrain.update(focus.x, focus.z, 3);
    this.scatter.update(focus.x, focus.z);
    this.water.update(dt, cam.position, this.sky.sunDirection, this.sky.dayFactor);
    this.effects.update(dt);
    this.props?.update(dt, this);
    this.weather?.update(dt, this);
    this.audio.updateMusic(raw, 0);
    this.engine.renderer.setClearColor(this.sky.rendererClear);
  }

  private updateWorld(dt: number, raw: number) {
    const p = this.player;
    const cam = this.cam;

    // target selection (soft lock)
    const lock = this.ctxLockTarget();
    this.lockTarget = lock;

    // ---- interaction ----
    const interactTarget = this.world.nearest(p.position, 3.4);
    this.hud.setInteract(interactTarget);
    if (this.input.consume('interact') && interactTarget) {
      interactTarget.interact(this);
    }

    // ---- player ----
    p.update(dt, this);
    cam.update(dt, p.position, { x: this.input.lookX, y: this.input.lookY }, {
      speed: Math.hypot(p.velocity.x, p.velocity.z),
      shake: this.engine.consumeShake(dt),
      lockOn: lock ? lock.position.clone().add(new THREE.Vector3(0, 1, 0)) : null,
    });
    this.input.lookX = 0;
    this.input.lookY = 0;

    // ---- world streaming ----
    this.terrain.update(p.position.x, p.position.z, 3);
    this.scatter.update(p.position.x, p.position.z);
    this.sky.update(dt, p.position, this.engine.camera);
    this.water.update(dt, this.engine.camera.position, this.sky.sunDirection, this.sky.dayFactor);
    this.engine.renderer.setClearColor(this.sky.rendererClear);
    this.engine.scene.fog && (this.engine.scene.fog as any);

    // ---- simulation ----
    this.enemies.update(dt, p.position);
    this.world.update(dt, this);
    this.props?.update(dt, this);
    this.weather?.update(dt, this);
    this.effects.update(dt);
    this.quests.update(dt);
    this.hud.update(dt);
    this.audio.updateMusic(raw, lock ? 0.8 : 0.1);
    this.audio.setWindIntensity(clamp(p.stamina > 0 ? 0.35 : 0.6, 0, 1) * (0.6 + p.velocity.length() * 0.05));
    this.save.data.world.time = this.sky.timeMinutes;

    // ---- zone discovery ----
    let bestZone = '';
    let bestDist = Infinity;
    for (const z of ZONE_NAMES) {
      const d = Math.hypot(p.position.x - z.x, p.position.z - z.z);
      if (d < z.radius && d < bestDist) {
        bestDist = d;
        bestZone = z.name;
      }
    }
    if (bestZone && bestZone !== this.zoneName) {
      this.zoneName = bestZone;
      this.events.emit('world:zone', { name: bestZone });
    }

    // ---- save position ----
    this.save.data.playtime += raw;
    this.save.markDirty();
  }

  private ctxLockTarget() {
    if (!this.settings.autoTarget) return null;
    const p = this.player;
    if (!p.alive) return null;
    const camDir = this.cam.getLookDirection(new THREE.Vector3());
    return this.enemies.nearest(p.position, 14, (e) => {
      const dx = e.position.x - p.position.x;
      const dz = e.position.z - p.position.z;
      const len = Math.hypot(dx, dz) || 1;
      const dot = (dx / len) * camDir.x + (dz / len) * camDir.z;
      return dot > 0.25;
    });
  }

  fatal(err: unknown) {
    cancelAnimationFrame(this.raf);
    $('fatal').classList.remove('hidden');
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
    $('fatal-msg').textContent = msg;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.engine.dispose();
    this.terrain.dispose();
    this.effects.clear();
  }
}

export { CHARACTERS, CHESTS, ITEMS, LANDMARKS, ELEMENTS, damp };
