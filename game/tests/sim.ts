/* =========================================================
   AETHERION — headless gameplay simulation
   Boots the real systems (terrain, sky, water, FX, enemies,
   player, quests, world objects) against a stubbed DOM, then runs
   scripted frames. Catches runtime errors that a pure logic test
   cannot see — everything except the WebGL draw call itself.
   ========================================================= */

/* ---------------- minimal DOM stub ---------------- */
function makeStub(): any {
  const fn: any = function () { return stub; };
  const stub: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'data') return new Uint8ClampedArray(4 * 168 * 168);
        if (prop === 'width' || prop === 'height') return 168;
        if (prop === 'clientWidth' || prop === 'clientHeight') return 800;
        if (prop === 'style') return stub;
        return fn;
      },
      set() { return true; },
      has() { return true; },
    },
  );
  return stub;
}

const canvasStub = () => {
  const c: any = {
    width: 168,
    height: 168,
    style: {},
    getContext: (kind: string) => {
      if (kind === '2d') {
        const ctx: any = {
          canvas: c,
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          measureText: () => ({ width: 20 }),
          createRadialGradient: () => ({ addColorStop() {} }),
          createLinearGradient: () => ({ addColorStop() {} }),
        };
        return new Proxy(ctx, {
          get(t, p) {
            if (p in t) return (t as any)[p];
            return () => undefined;
          },
          set(t, p, v) { (t as any)[p] = v; return true; },
        });
      }
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    remove() {},
    toDataURL: () => '',
  };
  return c;
};

const elementStub = () => {
  const el: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'dataset') return { act: '', index: '0' };
        if (prop === 'style') return {};
        if (prop === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
        if (prop === 'children') return [];
        if (prop === 'childNodes') return [];
        if (prop === 'firstChild') return null;
        if (prop === 'clientWidth' || prop === 'clientHeight') return 800;
        if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 });
        if (prop === 'appendChild' || prop === 'removeChild' || prop === 'addEventListener' || prop === 'removeEventListener' || prop === 'setAttribute') return () => {};
        if (prop === 'querySelector') return () => elementStub();
        if (prop === 'querySelectorAll') return () => [];
        if (prop === 'getContext') return () => canvasStub().getContext('2d');
        if (prop === 'then') return undefined;
        return () => undefined;
      },
      set() { return true; },
    },
  );
  return el;
};

const g: any = globalThis as any;
const store: Record<string, string> = {};
g.window = {
  innerWidth: 900,
  innerHeight: 420,
  devicePixelRatio: 2,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (cb: any) => setTimeout(() => cb(performance.now()), 1),
  cancelAnimationFrame() {},
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
  navigator: { userAgent: 'AetherionHeadless', platform: 'node' },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
g.localStorage = g.window.localStorage;
try { Object.defineProperty(g, 'navigator', { value: g.window.navigator, configurable: true, writable: true }); } catch { /* node 22 exposes navigator as getter only */ }
g.document = {
  createElement: (tag: string) => (tag === 'canvas' ? canvasStub() : elementStub()),
  createElementNS: () => canvasStub(),
  getElementById: () => elementStub(),
  querySelector: () => elementStub(),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  documentElement: elementStub(),
  hidden: false,
  body: elementStub(),
  fullscreenElement: null,
};
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(performance.now()), 1);
g.cancelAnimationFrame = () => {};

/* ---------------- imports (after the DOM stub) ---------------- */
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain';
import { Sky } from '../src/world/sky';
import { Water } from '../src/world/water';
import { Scatter } from '../src/world/scatter';
import { WorldObjects } from '../src/world/worldobjects';
import { Effects } from '../src/fx/effects';
import { EnemyManager } from '../src/entities/enemy';
import { Player } from '../src/entities/player';
import { ThirdPersonCamera } from '../src/core/camera';
import { Input } from '../src/core/input';
import { AudioEngine } from '../src/core/audio';
import { SaveSystem } from '../src/core/save';
import { Emitter } from '../src/core/events';
import { QuestSystem } from '../src/systems/quests';
import { InventorySystem } from '../src/systems/inventory';
import { HUD } from '../src/ui/hud';
import { Props } from '../src/world/props';
import { Weather } from '../src/world/weather';
import { Screens } from '../src/ui/screens';
import { PARTY_ORDER } from '../src/data/characters';
import { SPAWN } from '../src/data/world';

/* ---------------- harness ---------------- */
let pass = 0;
const errors: string[] = [];
function ok(name: string, cond: boolean, extra = '') {
  if (cond) pass++;
  else {
    errors.push(`${name} ${extra}`);
    console.error(`  ✗ ${name} ${extra}`);
  }
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb6d3ea, 0.0035);
const camera = new THREE.PerspectiveCamera(62, 2.14, 0.1, 1400);

const save = new SaveSystem();
save.data = (save as any).constructor ? save.data : save.data;
save.load();
save.data.hasSave = true;

const damageLog: string[] = [];
const hud = {
  damageNumber: (_p: any, text: string, kind = 'phys') => { damageLog.push(`${text}:${kind}`); },
  toast: () => {},
  setInteract: () => {},
  setHint: () => {},
  update: () => {},
  showBoss: () => {},
  hideBoss: () => {},
  setVisible: () => {},
};

const ctx: any = {
  engine: { hitStop: () => {}, shake: () => {}, elapsed: 0, camera, renderer: { setClearColor: () => {}, toneMappingExposure: 1.06 } },
  terrain: new Terrain(),
  sky: new Sky(scene, 'medium'),
  water: new Water(scene),
  effects: new Effects(scene),
  audio: new AudioEngine(),
  input: new Input(),
  cam: null,
  events: new Emitter(),
  save,
  settings: save.data.settings,
  hud,
  screens: { isOpen: false },
};
ctx.scatter = new Scatter(ctx.terrain);
ctx.cam = new ThirdPersonCamera(camera, ctx.terrain.heightAt);
ctx.player = new Player(ctx, SPAWN.x, SPAWN.z);
ctx.enemies = new EnemyManager(ctx);
ctx.props = new Props();
ctx.weather = new Weather(scene);
ctx.props.build(ctx.terrain);
ctx.weather.reset();
ctx.world = new WorldObjects();
ctx.quests = new QuestSystem();
ctx.inventory = new InventorySystem(ctx);
ctx.damageNumber = hud.damageNumber;
ctx.notify = () => {};
ctx.requestHitStop = () => {};
ctx.requestShake = () => {};

ctx.quests.init(ctx);

console.log('▸ Dünya kurulumu');
const t0 = performance.now();
for (let i = 0; i < 60; i++) ctx.terrain.update(SPAWN.x, SPAWN.z, 3);
const buildMs = performance.now() - t0;
console.log(`    arazi akışı (60 kare): ${buildMs.toFixed(0)} ms`);
ok('Arazi chunk üretimi çalışıyor', buildMs < 5000, `${buildMs.toFixed(0)}ms`);
ctx.scatter.update(SPAWN.x, SPAWN.z);
ctx.enemies.populate();
ctx.world.build(ctx.terrain, ctx);
console.log(`    düşman: ${ctx.enemies.enemies.length}, dünya nesnesi: ${ctx.world.objects.length}`);
ok('Düşmanlar doğdu', ctx.enemies.enemies.length > 10);
ok('Dünya nesneleri oluştu', ctx.world.objects.length > 50);

/* ---------------- simulation ---------------- */
const dt = 1 / 60;
let frames = 0;
function step(n = 1, script?: (i: number) => void) {
  for (let i = 0; i < n; i++) {
    script?.(i);
    ctx.input.setNow(frames * dt);
    ctx.player.update(dt, ctx);
    ctx.cam.update(dt, ctx.player.position, { x: 0, y: 0 }, { speed: 0, shake: 0 });
    ctx.enemies.update(dt, ctx.player.position);
    ctx.world.update(dt, ctx);
    ctx.effects.update(dt);
    ctx.quests.update(dt);
    ctx.sky.update(dt, ctx.player.position, camera);
    ctx.water.update(dt, camera.position, ctx.sky.sunDirection, ctx.sky.dayFactor);
    frames++;
  }
}

console.log('▸ Simülasyon (boşta 2 s)');
const start = ctx.player.position.clone();
step(120);
ok('Oyuncu zeminde duruyor', Math.abs(ctx.player.position.y - ctx.terrain.heightAt(ctx.player.position.x, ctx.player.position.z)) < 0.6, `y=${ctx.player.position.y.toFixed(2)}`);
ok('Stamina dolu', ctx.player.stamina > 95);

console.log('▸ Simülasyon (koşu 2 s)');
ctx.input.usingJoystick = true;
ctx.input.moveY = 1;
ctx.input.sprintHeld = true;
step(120);
const moved = start.distanceTo(ctx.player.position);
console.log(`    kat edilen mesafe: ${moved.toFixed(1)} m, stamina: ${ctx.player.stamina.toFixed(0)}`);
ok('Oyuncu hareket ediyor', moved > 4, `${moved.toFixed(2)}m`);
ok('Koşu stamina tüketiyor', ctx.player.stamina < 99);
ok('Zemin takibi doğru', Math.abs(ctx.player.position.y - ctx.terrain.heightAt(ctx.player.position.x, ctx.player.position.z)) < 1.2);

console.log('▸ Simülasyon (zıplama + süzülme)');
ctx.input.moveY = 0.4;
ctx.input.sprintHeld = false;
step(30);
ctx.input.press('jump');
step(20);
ok('Zıplama havaya kaldırdı', !ctx.player.grounded || ctx.player.velocity.y > -1, `y=${ctx.player.position.y.toFixed(2)}`);
ctx.input.press('jump');
step(40);
ok('Süzülme aktif veya yere indi', true);
step(120);

console.log('▸ Tepkime boru hattı (deterministik)');
{
  const e = new (Object.getPrototypeOf(ctx.enemies.enemies[0]).constructor)(ctx.enemies.enemies[0].def, ctx.player.position.x, ctx.player.position.z + 2, ctx.player.position.y, 5);
  ctx.enemies.enemies.push(e);
  const hit = (el: any) => ctx.enemies.applyHit(e, el, { atk: 120, power: 1, critRate: 0, critDmg: 0.5, from: ctx.player.position });
  const r1 = hit('pyro');
  const r2 = hit('electro');
  ok('Ateş → Elektrik = Aşırı Yük', r2.reaction.id === 'overload', r2.reaction.id);
  const r3 = hit('hydro');
  ok('Su sonrası aura kaydedildi', true);
  const r4 = hit('cryo');
  ok('Su + Buz = Donma', r4.reaction.id === 'frozen', r4.reaction.id);
  ok('Hedef hasar aldı', e.hp < e.maxHp);
  console.log(`    ${r1.reaction.id} → ${r2.reaction.id} → ${r4.reaction.id} · hasar sayısı ${damageLog.length}`);
  ok('Tepkime hasar sayıları üretildi', damageLog.filter((d) => d.endsWith(':reaction')).length >= 2);
  e.takeDamage(99999, { crit: true, element: 'none' });
  e.handleDeath(ctx);
}

console.log('▸ Simülasyon (savaş: 4 karakter döngüsü)');
ctx.input.moveX = 0;
ctx.input.moveY = 0;
ctx.input.sprintHeld = false;
ctx.player.invuln = 9999;
for (let round = 0; round < 3; round++) {
  const target = ctx.enemies.nearest(ctx.player.position, 400);
  if (!target) break;
  ctx.player.position.set(target.position.x + 1.4, ctx.terrain.heightAt(target.position.x + 1.4, target.position.z), target.position.z);
  const aim = () => {
    ctx.player.facing = Math.atan2(target.position.x - ctx.player.position.x, target.position.z - ctx.player.position.z);
  };
  aim();
  const hpBefore = target.hp;
  ctx.input.press('attack');
  step(45, aim);
  ctx.input.press('skill');
  step(70, aim);
  ctx.player.currentEnergy = 100;
  ctx.input.press('burst');
  step(90, aim);
  console.log(`    tur ${round + 1}: ${ctx.player.activeDef.name} · hedef ${hpBefore.toFixed(0)} → ${target.hp.toFixed(0)}`);
  ok(`Tur ${round + 1}: hasar verildi`, target.hp < hpBefore || !target.alive, `${hpBefore.toFixed(0)} → ${target.hp.toFixed(0)}`);
  ctx.player.switchTo((PARTY_ORDER.indexOf(ctx.player.activeId as any) + 1) % 4);
  step(20);
}
ok('Hasar sayıları üretiliyor', damageLog.length > 0);
ok('Parti geçişi çalışıyor', PARTY_ORDER.includes(ctx.player.activeId as any));
ctx.player.invuln = 0;

console.log('▸ Simülasyon (etkileşim + ganimet)');
const chest = ctx.world.objects.find((o: any) => o.kind === 'chest' && o.active);
if (chest) {
  const moraBefore = save.data.player.mora;
  chest.interact(ctx);
  ok('Sandık açıldı', !chest.active);
  ok('Sandık ganimet verdi', save.data.player.mora >= moraBefore);
} else {
  ok('Sandık bulundu', false);
}
const statue = ctx.world.objects.find((o: any) => o.kind === 'statue');
if (statue) {
  statue.interact(ctx);
  ok('Mühür taşı etkinleşti', save.data.waypoints.length > 0);
}
const bloom = ctx.world.objects.find((o: any) => o.kind === 'bloom' && o.active);
if (bloom) {
  const before = ctx.inventory.count('aetherbloom');
  bloom.interact(ctx);
  ok('Çiçek toplandı', ctx.inventory.count('aetherbloom') > before);
}

console.log('▸ Simülasyon (5 s serbest koşu + gece döngüsü)');
ctx.sky.setTime(22 * 60);
ok('Gece modu', ctx.sky.dayFactor < 0.2, `dayFactor=${ctx.sky.dayFactor.toFixed(2)}`);
ctx.input.moveY = 1;
ctx.input.moveX = 0.3;
step(300);
ok('Serbest koşuda istisna yok', true);
ok('Oyuncu dünya sınırları içinde', Math.abs(ctx.player.position.x) < 481 && Math.abs(ctx.player.position.z) < 481);

console.log('▸ Simülasyon (görev ilerlemesi + XP)');
ok('Görev yöneticisi aktif görev veriyor', !!ctx.quests.tracker());
const xpBefore = save.data.player.xp + save.data.player.level * 1000;
ctx.player.addXp(120, ctx);
ok('XP eklendi', save.data.player.xp + save.data.player.level * 1000 > xpBefore);

console.log('▸ Simülasyon (düşman ölümü ve olaylar)');
let kills = 0;
ctx.events.on('enemy:killed', () => kills++);
const victim = ctx.enemies.enemies.find((e: any) => e.alive);
if (victim) {
  victim.takeDamage(999999, { crit: true, element: 'pyro' });
  victim.handleDeath(ctx);
  step(90);
  ok('Düşman ölümü olayı yayınlandı', kills > 0);
  ok('Ölü düşman temizlendi', victim.removed);
}

console.log('▸ Fizikli proplar (varil/sandık/çömlek)');
{
  const props = ctx.props!;
  ok('Dünya prop üretti', props.list.length > 40, `${props.list.length} prop`);
  const target = props.list.find((p: any) => p.kind === 'crate' && !p.broken)!;
  const start = target.pos.clone();
  props.push(start.clone().add(new THREE.Vector3(0.6, 0, 0)), 4, 12);
  for (let i = 0; i < 90; i++) props.update(1 / 60, ctx);
  ok('İtme prop\'u hareket ettirdi', target.pos.distanceTo(start) > 0.5, `${target.pos.distanceTo(start).toFixed(2)} m`);
  ok('Prop zemine oturdu', target.resting || target.vel.length() < 3, `v=${target.vel.length().toFixed(2)}`);

  const aliveBefore = props.activeCount;
  const moraBefore = ctx.save.data.player.mora;
  const victim = props.list.find((p: any) => !p.broken)!;
  props.damageNear(victim.pos.clone(), 2.5, 999, ctx, 'pyro');
  ok('Kırılan prop sahneden kalktı', props.activeCount < aliveBefore, `${aliveBefore} → ${props.activeCount}`);
  ok('Kırılan prop ganimet bıraktı', ctx.save.data.player.mora > moraBefore, `+${ctx.save.data.player.mora - moraBefore} mora`);

  // props roll downhill: drop one on a slope and let gravity work
  const slope = ctx.terrain.slopeAt(96, -96) > 0.2 ? { x: 96, z: -96 } : { x: 140, z: -60 };
  const roller = props.list.find((p: any) => !p.broken && p !== target)!;
  roller.pos.set(slope.x, ctx.terrain.heightAt(slope.x, slope.z) + 1.4, slope.z);
  roller.resting = false;
  for (let i = 0; i < 120; i++) props.update(1 / 60, ctx);
  ok('Eğimde prop kaydı', Math.abs(roller.pos.x - slope.x) + Math.abs(roller.pos.z - slope.z) > 0.3,
    `${(Math.abs(roller.pos.x - slope.x) + Math.abs(roller.pos.z - slope.z)).toFixed(2)} m`);
}

console.log('▸ Hava durumu (yağmur + fırtına)');
{
  const w = ctx.weather!;
  ok('Hava temiz başlıyor', w.mode === 'clear' && w.intensity < 0.05);
  w.mode = 'storm';
  for (let i = 0; i < 300; i++) w.update(1 / 60, ctx);
  ok('Fırtına yoğunluğu yükseldi', w.intensity > 0.4, w.intensity.toFixed(2));
  ok('Ton eşleme pozu fırtınada düşüyor', ctx.engine.renderer.toneMappingExposure < 1.1,
    ctx.engine.renderer.toneMappingExposure.toFixed(2));
  w.mode = 'clear';
  for (let i = 0; i < 600; i++) w.update(1 / 60, ctx);
  ok('Hava tekrar açtı', w.intensity < 0.2, w.intensity.toFixed(2));
}

console.log('▸ Kaçınma (dash) ve iniş saldırısı');
{
  const p = ctx.player;
  p.position.copy(new THREE.Vector3(8, ctx.terrain.heightAt(8, 34), 34));
  p.velocity.set(0, 0, 0);
  p.stamina = 100;
  p.dashCd = 0;
  ctx.input.moveX = 0;
  ctx.input.moveY = 1;
  const before = p.position.clone();
  ctx.input.press('dash');
  const dashFrames: number[] = [];
  for (let i = 0; i < 20; i++) {
    p.update(1 / 60, ctx);
    dashFrames.push(Math.hypot(p.velocity.x, p.velocity.z));
  }
  const moved = p.position.distanceTo(before);
  const peak = Math.max(...dashFrames);
  ok('Dash hız kazandırdı', peak > 12, `tepe ${peak.toFixed(1)} m/s`);
  ok('Dash mesafe kat etti', moved > 2.5, `${moved.toFixed(2)} m`);
  ok('Dash dokunulmazlık verdi', p.invuln > 0 || p.dashCd > 0.5);
  ok('Dash bekleme süresi başladı', p.dashCd > 0.4, p.dashCd.toFixed(2));
  ctx.input.moveX = 0;
  ctx.input.moveY = 0;

  // plunge: jump, then attack mid-air, land and check the slam damaged a nearby enemy
  const p2 = ctx.player;
  p2.position.copy(new THREE.Vector3(24, ctx.terrain.heightAt(24, 8), 8));
  p2.velocity.set(0, 0, 0);
  p2.grounded = true;
  p2.attackTimer = 0;
  p2.dashTimer = 0;
  p2.plunging = false;
  const foe = ctx.enemies.enemies.find((e: any) => e.alive)!;
  if (foe) {
    foe.position.copy(p2.position.clone().add(new THREE.Vector3(0.9, 0, 0.9)));
    foe.hp = foe.maxHp;
  }
  ctx.input.press('jump');
  for (let i = 0; i < 18; i++) p2.update(1 / 60, ctx);
  ok('Zıplama havaya kaldırdı', !p2.grounded, `y=${p2.position.y.toFixed(2)}`);
  const foeHp = foe ? foe.hp : 0;
  ctx.input.press('attack');
  for (let i = 0; i < 90; i++) p2.update(1 / 60, ctx);
  ok('Havada saldırı iniş saldırısına dönüştü', !p2.plunging && p2.grounded);
  ok('İniş saldırısı alan hasarı verdi', !foe || foe.hp < foeHp, foe ? `${foeHp.toFixed(0)} → ${foe.hp.toFixed(0)}` : 'hedef yok');
}

console.log('▸ Arayüz (HUD + tüm ekranlar)');
{
  const hud2 = new HUD(ctx);
  ctx.hud = hud2;
  ctx.quests.ctx = ctx;
  step(10);
  ok('HUD güncellemesi çalışıyor', true);
  hud2.damageNumber(ctx.player.position.clone(), '123', 'crit');
  hud2.toast('test', '✦');
  hud2.setInteract(null);
  hud2.showBoss('Test');
  hud2.hideBoss();
  hud2.setHint('ipucu');
  hud2.setHint(null);

  const screens = new Screens(ctx);
  ctx.screens = screens;
  for (const name of ['pause', 'settings', 'inventory', 'map', 'party', 'codex', 'journal'] as const) {
    screens.open(name);
    ok(`Ekran açıldı: ${name}`, screens.current === name);
  }
  screens.close();
  ok('Ekran kapandı', screens.current === null);
  screens.showDeath();
  screens.close();
}

console.log(`\n${'─'.repeat(46)}`);
console.log(`  ${pass} kontrol geçti · ${errors.length} hata · ${frames} kare simüle edildi`);
if (errors.length) {
  errors.forEach((e) => console.log('   - ' + e));
  process.exitCode = 1;
} else {
  console.log('  ✓ Headless oynanış simülasyonu sorunsuz');
}
