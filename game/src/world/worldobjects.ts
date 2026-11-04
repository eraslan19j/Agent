/* =========================================================
   AETHERION — interactive world objects
   Waypoint statues, chests, harvest nodes, campfires.
   ========================================================= */
import * as THREE from 'three';
import { CHESTS, type ChestTier, rollLoot } from '../data/items';
import { LANDMARKS } from '../data/world';
import { clamp, mulberry32, TAU } from '../core/utils';
import type { GameContext } from '../game/types';

export type ObjKind = 'chest' | 'statue' | 'bloom' | 'ore' | 'campfire';

export interface WorldObj {
  id: string;
  kind: ObjKind;
  name: string;
  position: THREE.Vector3;
  interactRadius: number;
  active: boolean;
  tier?: ChestTier;
  group: THREE.Group;
  update(dt: number, ctx: GameContext): void;
  interact(ctx: GameContext): void;
  prompt(ctx: GameContext): string;
  markerColor: string;
}

function markGlow(mesh: THREE.Mesh, color: string, opacity = 0.5) {
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.emissive = new THREE.Color(color);
  m.emissiveIntensity = 1.2;
  m.opacity = opacity;
}

/* ---------------- chest ---------------- */
class Chest implements WorldObj {
  kind: ObjKind = 'chest';
  active = true;
  group = new THREE.Group();
  position: THREE.Vector3;
  interactRadius = 2.6;
  private lid: THREE.Group;
  private glowRing: THREE.Mesh;
  private t = 0;
  markerColor = '#ffc857';

  constructor(readonly id: string, public name: string, x: number, y: number, z: number, readonly tier: ChestTier) {
    this.position = new THREE.Vector3(x, y, z);
    const def = CHESTS[tier];
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 });
    const metal = new THREE.MeshStandardMaterial({
      color: def.color, metalness: 0.75, roughness: 0.35,
      emissive: new THREE.Color(def.color), emissiveIntensity: 0.25,
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.78), wood);
    base.position.y = 0.31;
    base.castShadow = true;
    this.group.add(base);

    const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.1, 0.82), metal);
    band.position.y = 0.5;
    this.group.add(band);

    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.62, -0.39);
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 1.1, 10, 1, false, 0, Math.PI), wood);
    lidMesh.rotation.z = Math.PI / 2;
    lidMesh.rotation.y = Math.PI;
    lidMesh.position.set(0, 0.0, 0.39);
    lidMesh.castShadow = true;
    this.lid.add(lidMesh);
    const lockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.1), metal);
    lockMesh.position.set(0, 0.02, 0.75);
    this.lid.add(lockMesh);
    this.group.add(this.lid);

    this.glowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.9, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(def.color), transparent: true, opacity: 0.55,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.glowRing.rotation.x = -Math.PI / 2;
    this.glowRing.position.y = 0.03;
    this.group.add(this.glowRing);

    this.group.position.copy(this.position);
    this.group.rotation.y = (x * 13.7 + z * 7.3) % TAU;
  }

  update(dt: number, ctx: GameContext) {
    this.t += dt;
    this.glowRing.rotation.z += dt * 0.6;
    const mat = this.glowRing.material as THREE.MeshBasicMaterial;
    mat.opacity = this.active ? 0.35 + Math.sin(this.t * 2.2) * 0.2 : 0;
    if (this.active && Math.random() < dt * 1.5) {
      ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.8, this.position.z), CHESTS[this.tier].color, 1, 0.5);
    }
    if (!this.active) {
      this.lid.rotation.x = Math.min(-2.1, this.lid.rotation.x - dt * 6);
    }
  }

  prompt() {
    return CHESTS[this.tier].label;
  }

  interact(ctx: GameContext) {
    if (!this.active) return;
    this.active = false;
    const rng = mulberry32(this.id.length * 9973 + this.position.x * 31 + this.position.z * 17);
    const loot = rollLoot(rng, this.tier);
    ctx.audio.chest();
    ctx.effects.burst(new THREE.Vector3(this.position.x, this.position.y + 0.8, this.position.z), CHESTS[this.tier].color, 40, 4.5, 0.9);
    ctx.effects.ring(this.position.clone(), CHESTS[this.tier].color, 0.3, 3.2, 0.6);
    ctx.requestShake(0.18);
    for (const l of loot) ctx.inventory.add(l.id, l.amount, false);
    ctx.inventory.grantXp(CHESTS[this.tier].xp);
    ctx.save.data.chests.push(this.id);
    ctx.save.data.stats.chests++;
    ctx.save.markDirty();
    ctx.events.emit('chest:opened', { id: this.id, tier: this.tier });
    ctx.notify(`${CHESTS[this.tier].label} açıldı!`, '▣');
  }
}

/* ---------------- waypoint statue ---------------- */
class Statue implements WorldObj {
  kind: ObjKind = 'statue';
  active = true;
  group = new THREE.Group();
  position: THREE.Vector3;
  interactRadius = 4.2;
  markerColor = '#9fe8ff';
  private crystal: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private beam: THREE.Mesh;
  private t = 0;
  private unlocked: boolean;

  constructor(readonly id: string, public name: string, x: number, y: number, z: number, unlocked: boolean) {
    this.position = new THREE.Vector3(x, y, z);
    this.unlocked = unlocked;

    const stone = new THREE.MeshStandardMaterial({ color: 0x535b6b, roughness: 0.9 });
    const plate = new THREE.MeshStandardMaterial({
      color: 0x2f6f7a, metalness: 0.4, roughness: 0.4,
      emissive: new THREE.Color(unlocked ? '#9fe8ff' : '#1e4a56'), emissiveIntensity: unlocked ? 1.4 : 0.35,
    });

    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 0.42, 8), stone);
    base1.position.y = 0.21;
    base1.receiveShadow = true;
    base1.castShadow = true;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.8, 0.5, 8), stone);
    base2.position.y = 0.66;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.3, 0.6), stone);
    pillar.position.y = 1.9;
    pillar.castShadow = true;
    this.group.add(base1, base2, pillar);

    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), plate);
    this.crystal.position.y = 3.35;
    this.group.add(this.crystal);

    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95 + i * 0.25, 0.035, 4, 28),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#9fe8ff'), transparent: true,
          opacity: unlocked ? 0.75 : 0.18, depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      ring.position.y = 3.35;
      ring.rotation.x = Math.PI / 2 + i * 0.5;
      this.rings.push(ring);
      this.group.add(ring);
    }

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.9, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#9fe8ff'), transparent: true, opacity: unlocked ? 0.14 : 0.03,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.beam.position.y = 16;
    this.group.add(this.beam);

    this.group.position.copy(this.position);
  }

  update(dt: number, ctx: GameContext) {
    this.t += dt;
    this.crystal.rotation.y += dt * 0.8;
    this.crystal.position.y = 3.35 + Math.sin(this.t * 1.4) * 0.12;
    this.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.6 + i * 0.4) * (i % 2 ? -1 : 1);
      r.position.y = this.crystal.position.y;
    });
    const targetOpacity = this.unlocked ? 0.75 : 0.18;
    const mat = this.crystal.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = this.unlocked ? 1.5 + Math.sin(this.t * 2) * 0.3 : 0.35;

    if (this.unlocked && Math.random() < dt * 3) {
      ctx.effects.trail(new THREE.Vector3(this.position.x, this.crystal.position.y + this.position.y, this.position.z), '#9fe8ff', 1, 1.2);
    }
  }

  prompt(ctx: GameContext) {
    return this.unlocked ? 'Mühür Taşı — Dinlen' : 'Mühür Taşı’nı Etkinleştir';
  }

  interact(ctx: GameContext) {
    const isNew = !this.unlocked;
    this.unlocked = true;
    const mat = this.crystal.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.6;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.14;
    for (const r of this.rings) (r.material as THREE.MeshBasicMaterial).opacity = 0.75;

    ctx.audio.chest();
    ctx.effects.ring(this.position.clone(), '#9fe8ff', 0.5, 9, 0.9);
    ctx.effects.burst(new THREE.Vector3(this.position.x, this.position.y + 3, this.position.z), '#9fe8ff', 60, 6, 1.2);
    ctx.requestShake(0.3);

    ctx.player.healAll(1);
    ctx.player.stamina = ctx.player.maxStamina;
    ctx.save.data.player.respawn = { x: this.position.x, z: this.position.z + 2.5 };
    if (isNew && !ctx.save.data.waypoints.includes(this.id)) {
      ctx.save.data.waypoints.push(this.id);
      ctx.events.emit('waypoint:activated', { id: this.id });
      ctx.notify(`${this.name} etkinleşti — hızlı seyahat açıldı`, '◈');
      ctx.player.addXp(60, ctx);
    } else {
      ctx.notify(`${this.name}: tüm yaralar iyileşti`, '◈');
    }
    ctx.save.markDirty();
  }
}

/* ---------------- harvest node (bloom / ore) ---------------- */
class Harvest implements WorldObj {
  readonly kind: 'bloom' | 'ore';
  active = true;
  group = new THREE.Group();
  position: THREE.Vector3;
  interactRadius = 1.7;
  markerColor: string;
  private t = 0;
  private spin: THREE.Mesh;

  constructor(
    readonly id: string,
    kind: 'bloom' | 'ore',
    public name: string,
    x: number, y: number, z: number,
    private itemId: 'aetherbloom' | 'crystal',
    private amount = 1,
  ) {
    this.kind = kind;
    this.position = new THREE.Vector3(x, y, z);
    this.markerColor = kind === 'bloom' ? '#6fe8c4' : '#4fb8ff';

    const color = new THREE.Color(this.markerColor);
    if (kind === 'bloom') {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.45, 5),
        new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.9 }),
      );
      stem.position.y = 0.22;
      this.group.add(stem);
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(
          new THREE.ConeGeometry(0.09, 0.2, 4),
          new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4,
          }),
        );
        const a = (i / 5) * TAU;
        petal.position.set(Math.cos(a) * 0.09, 0.5, Math.sin(a) * 0.09);
        petal.rotation.z = Math.cos(a) * 0.5;
        petal.rotation.x = Math.sin(a) * 0.5;
        this.group.add(petal);
      }
      this.spin = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: '#d6fff4' }),
      );
      this.spin.position.y = 0.52;
      this.group.add(this.spin);
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 0),
        new THREE.MeshStandardMaterial({ color: 0x55606e, roughness: 0.9, flatShading: true }),
      );
      rock.position.y = 0.32;
      rock.castShadow = true;
      this.group.add(rock);
      this.spin = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.0, roughness: 0.2 }),
      );
      this.spin.position.y = 0.72;
      this.group.add(this.spin);
    }
    this.group.position.copy(this.position);
  }

  update(dt: number, ctx: GameContext) {
    this.t += dt;
    this.spin.rotation.y += dt * 1.6;
    this.spin.position.y = (this.kind === 'bloom' ? 0.52 : 0.72) + Math.sin(this.t * 2) * 0.05;
    if (!this.active) this.group.visible = false;
    else if (Math.random() < dt * 0.8) {
      ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.5, this.position.z), this.markerColor, 1, 0.3);
    }
  }

  prompt() {
    return `${this.name} topla`;
  }

  interact(ctx: GameContext) {
    if (!this.active) return;
    this.active = false;
    this.group.visible = false;
    ctx.inventory.add(this.itemId, this.amount);
    ctx.audio.pickup();
    ctx.effects.burst(new THREE.Vector3(this.position.x, this.position.y + 0.5, this.position.z), this.markerColor, 16, 3, 0.6);
    ctx.save.data.collectiblesTaken.push(this.id);
    ctx.save.markDirty();
  }
}

/* ---------------- campfire ---------------- */
class Campfire implements WorldObj {
  kind: ObjKind = 'campfire';
  active = true;
  group = new THREE.Group();
  position: THREE.Vector3;
  interactRadius = 2.4;
  markerColor = '#ff9d5c';
  private t = 0;
  private flames: THREE.Mesh[] = [];

  constructor(readonly id: string, public name: string, x: number, y: number, z: number) {
    this.position = new THREE.Vector3(x, y, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
      s.position.set(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62);
      s.scale.set(1, 0.7, 1);
      this.group.add(s);
    }
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 1.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 }),
    );
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.16;
    this.group.add(log);

    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 - i * 0.04, 0.55 - i * 0.1, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(i === 0 ? '#ffcf6b' : i === 1 ? '#ff8a3d' : '#ff5a2a'),
          transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      flame.position.y = 0.42 + i * 0.18;
      this.flames.push(flame);
      this.group.add(flame);
    }
    this.group.position.copy(this.position);
  }

  update(dt: number, ctx: GameContext) {
    this.t += dt;
    this.flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(this.t * (8 + i * 2)) * 0.18;
      f.position.y = 0.42 + i * 0.18 + Math.sin(this.t * 3 + i) * 0.03;
      f.rotation.y += dt * 2;
    });
    if (Math.random() < dt * 5) {
      ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.7, this.position.z), '#ff9a4a', 1, 0.3);
    }
  }

  prompt() {
    return 'Kamp Ateşi — Dinlen';
  }

  interact(ctx: GameContext) {
    ctx.player.healAll(1);
    ctx.player.stamina = ctx.player.maxStamina;
    ctx.audio.chest();
    ctx.effects.heal(this.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
    ctx.notify('Kamp ateşinde dinlendin', '🔥');
  }
}

/* =========================================================
   Manager
   ========================================================= */
export class WorldObjects {
  readonly group = new THREE.Group();
  objects: WorldObj[] = [];

  constructor() {
    this.group.name = 'worldobjects';
  }

  build(terrain: any, ctx: GameContext) {
    const save = ctx.save.data;

    // --- statues from landmarks ---
    for (const lm of LANDMARKS) {
      if (lm.kind !== 'statue' && lm.kind !== 'summit' && lm.kind !== 'coast') continue;
      const y = terrain.heightAt(lm.x, lm.z);
      const st = new Statue(lm.id, lm.name, lm.x, y, lm.z, save.waypoints.includes(lm.id));
      this.add(st);
    }

    // --- campfires near enemy camps ---
    const fires: [string, number, number][] = [
      ['fire_meadow', 2, 40],
      ['fire_forest', -58, 12],
      ['fire_coast', -150, 96],
      ['fire_ridge', 120, -60],
      ['fire_arena', 18, -186],
    ];
    for (const [id, x, z] of fires) {
      const y = terrain.heightAt(x, z);
      if (y < 0.5) continue;
      this.add(new Campfire(id, 'Kamp Ateşi', x, y, z));
    }

    // --- chests (deterministic placement) ---
    const rng = mulberry32(20261104);
    const tiers: ChestTier[] = ['common', 'common', 'exquisite', 'common', 'exquisite', 'precious', 'exquisite', 'luxurious'];
    let ci = 0;
    for (let i = 0; i < 22; i++) {
      const angle = rng() * TAU;
      const radius = 40 + Math.pow(rng(), 0.7) * 300;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const spot = terrain.findFlatSpot(x, z, 12, i + 1);
      if (spot.y < 0.8) continue;
      const tier = tiers[ci % tiers.length];
      const obj = new Chest(`chest_${i}`, CHESTS[tier].label, spot.x, spot.y, spot.z, tier);
      if (save.chests.includes(obj.id)) obj.active = false;
      this.add(obj);
      ci++;
    }

    // --- harvest nodes ---
    const taken = new Set(save.collectiblesTaken);
    for (let i = 0; i < 46; i++) {
      const angle = rng() * TAU;
      const radius = 25 + Math.pow(rng(), 0.65) * 330;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = terrain.heightAt(x, z);
      if (y < 1.2) continue;
      const isOre = rng() < 0.3;
      const id = `${isOre ? 'ore' : 'bloom'}_${i}`;
      const obj = new Harvest(
        id, isOre ? 'ore' : 'bloom',
        isOre ? 'Yankı Kristali' : 'Yankı Çiçeği',
        x, y, z,
        isOre ? 'crystal' : 'aetherbloom',
        isOre ? 1 : 1,
      );
      if (taken.has(id)) obj.active = false;
      this.add(obj);
    }
  }

  private add(obj: WorldObj) {
    this.objects.push(obj);
    this.group.add(obj.group);
  }

  nearest(pos: THREE.Vector3, maxRadius = 3.2): WorldObj | null {
    let best: WorldObj | null = null;
    let bestD = Infinity;
    for (const o of this.objects) {
      if (!o.active && o.kind !== 'campfire') continue;
      if (o.kind === 'chest' && !o.active) continue;
      const d = Math.hypot(o.position.x - pos.x, o.position.z - pos.z);
      if (d < o.interactRadius && d < bestD && Math.abs(o.position.y - pos.y) < 3.5) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  update(dt: number, ctx: GameContext) {
    const p = ctx.player.position;
    for (const o of this.objects) {
      const d = Math.hypot(o.position.x - p.x, o.position.z - p.z);
      if (d > 120) continue;
      o.update(dt, ctx);
      // auto-collect harvest nodes
      if ((o.kind === 'bloom' || o.kind === 'ore') && o.active && d < o.interactRadius) {
        o.interact(ctx);
      }
    }
    this.group.visible = true;
  }

  /** Statues that are unlocked, for fast travel. */
  waypoints() {
    return this.objects.filter((o) => o.kind === 'statue') as unknown as (WorldObj & { unlocked?: boolean })[];
  }

  dispose() {
    for (const o of this.objects) {
      o.group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat.dispose();
        }
      });
    }
    this.objects.length = 0;
  }
}
