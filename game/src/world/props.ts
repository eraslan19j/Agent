/* =========================================================
   AETHERION — destructible physics props
   Lightweight rigid-body-ish simulation: barrels, crates,
   pots and stone blocks get knocked around, roll down slopes,
   bounce off the terrain and shatter when hit hard enough.
   No external physics engine: everything collides against the
   analytic terrain height field, which keeps it cheap and exact.
   ========================================================= */
import * as THREE from 'three';
import type { GameContext } from '../game/types';
import { CAMPS } from '../data/enemies';
import { LANDMARKS } from '../data/world';
import { clamp } from '../core/utils';
import { ELEMENTS, type ElementId } from '../data/elements';

export type PropKind = 'barrel' | 'crate' | 'pot' | 'block';

interface PropDef {
  hp: number;
  radius: number;
  mass: number;
  color: number;
  accent: number;
  scale: number;
  loot: number;
  breakColor: string;
}

const PROPS: Record<PropKind, PropDef> = {
  barrel: { hp: 46, radius: 0.42, mass: 1.0, color: 0x8a5a30, accent: 0x4a4a52, scale: 1.05, loot: 9, breakColor: '#b07a42' },
  crate:  { hp: 62, radius: 0.52, mass: 1.35, color: 0x9c7442, accent: 0x6b4a24, scale: 1.0, loot: 12, breakColor: '#c09a5c' },
  pot:    { hp: 24, radius: 0.34, mass: 0.7, color: 0xa8543c, accent: 0x6d3324, scale: 1.0, loot: 6, breakColor: '#cf7a58' },
  block:  { hp: 140, radius: 0.62, mass: 3.2, color: 0x8b8b90, accent: 0x5c5c63, scale: 1.0, loot: 20, breakColor: '#b8b8bd' },
};

/** deterministic PRNG so the world is identical on every device */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAVITY = -24;
const RESTITUTION = 0.26;
const GROUND_FRICTION = 0.82;
const AIR_DRAG = 0.995;
const SLEEP_SPEED = 0.32;

export interface Prop {
  kind: PropKind;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  mass: number;
  hp: number;
  maxHp: number;
  broken: boolean;
  resting: boolean;
  water: boolean;
}

const GEO = {
  barrel: new THREE.CylinderGeometry(0.34, 0.38, 0.86, 12, 1),
  hoop: new THREE.CylinderGeometry(0.395, 0.395, 0.075, 12, 1),
  crate: new THREE.BoxGeometry(0.8, 0.8, 0.8),
  crateInset: new THREE.BoxGeometry(0.66, 0.06, 0.66),
  pot: new THREE.SphereGeometry(0.34, 12, 9),
  potNeck: new THREE.CylinderGeometry(0.17, 0.22, 0.16, 10, 1),
  block: new THREE.BoxGeometry(0.92, 0.92, 0.92),
};

/**
 * Physics + destruction for small set dressing objects.
 * Runs cheaply: a few dozen bodies, sphere-vs-heightfield collision.
 */
export class Props {
  readonly group = new THREE.Group();
  list: Prop[] = [];
  private materials = new Map<PropKind, { body: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial }>();
  private rnd = mulberry32(0x5eed1);

  constructor() {
    this.group.name = 'props';
  }

  /* ---------------------------------------------------------
     construction
     --------------------------------------------------------- */
  private matsFor(kind: PropKind) {
    let m = this.materials.get(kind);
    if (!m) {
      const def = PROPS[kind];
      m = {
        body: new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.78, metalness: 0.05 }),
        accent: new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.45, metalness: 0.55 }),
      };
      this.materials.set(kind, m);
    }
    return m;
  }

  private makeMesh(kind: PropKind): THREE.Group {
    const g = new THREE.Group();
    const mats = this.matsFor(kind);
    if (kind === 'barrel') {
      const body = new THREE.Mesh(GEO.barrel, mats.body);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      for (const y of [-0.28, 0.28]) {
        const hoop = new THREE.Mesh(GEO.hoop, mats.accent);
        hoop.position.y = y;
        hoop.castShadow = true;
        g.add(hoop);
      }
    } else if (kind === 'crate') {
      const body = new THREE.Mesh(GEO.crate, mats.body);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      for (const y of [-0.4, 0, 0.4]) {
        const band = new THREE.Mesh(GEO.crateInset, mats.accent);
        band.position.y = y;
        band.scale.set(1.02, 1, 1.02);
        g.add(band);
      }
    } else if (kind === 'pot') {
      const body = new THREE.Mesh(GEO.pot, mats.body);
      body.scale.y = 1.25;
      body.castShadow = true;
      g.add(body);
      const neck = new THREE.Mesh(GEO.potNeck, mats.accent);
      neck.position.y = 0.4;
      g.add(neck);
    } else {
      const body = new THREE.Mesh(GEO.block, mats.body);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
    }
    return g;
  }

  private spawn(kind: PropKind, x: number, z: number, terrain: any, vel?: THREE.Vector3): Prop {
    const def = PROPS[kind];
    const y = terrain.heightAt(x, z) + def.radius * 0.9;
    const mesh = this.makeMesh(kind);
    mesh.position.set(x, y, z);
    mesh.rotation.y = this.rnd() * Math.PI * 2;
    mesh.scale.setScalar(def.scale);
    this.group.add(mesh);
    const prop: Prop = {
      kind,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      vel: vel ? vel.clone() : new THREE.Vector3(),
      radius: def.radius,
      mass: def.mass,
      hp: def.hp,
      maxHp: def.hp,
      broken: false,
      resting: true,
      water: false,
    };
    this.list.push(prop);
    return prop;
  }

  /** Populate the world: supply clusters at camps, cargo at landmarks. */
  build(terrain: any) {
    this.clear();
    const rnd = this.rnd;

    for (const camp of CAMPS) {
      const count = camp.id === 'boss_arena' ? 2 : 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2;
        const r = camp.radius * (0.55 + rnd() * 0.5);
        const x = camp.x + Math.cos(a) * r;
        const z = camp.z + Math.sin(a) * r;
        const kind: PropKind = i === 0 ? 'barrel' : i === 1 ? 'crate' : rnd() < 0.4 ? 'pot' : 'crate';
        this.spawn(kind, x, z, terrain);
      }
    }

    for (const lm of LANDMARKS) {
      if (lm.kind !== 'statue' && lm.kind !== 'poi' && lm.kind !== 'coast') continue;
      const count = 4 + Math.floor(rnd() * 4);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rnd() * 0.6;
        const r = lm.radius * (0.5 + rnd() * 0.55);
        const x = lm.x + Math.cos(a) * r;
        const z = lm.z + Math.sin(a) * r;
        const kind: PropKind = rnd() < 0.3 ? 'pot' : rnd() < 0.75 ? 'crate' : 'barrel';
        this.spawn(kind, x, z, terrain);
      }
    }

    // a few loose boulders near the highlands for impact testing
    for (let i = 0; i < 8; i++) {
      const x = -240 + rnd() * 480;
      const z = -240 + rnd() * 480;
      if (terrain.slopeAt(x, z) > 0.45) continue;
      this.spawn('block', x, z, terrain);
    }
  }

  /* ---------------------------------------------------------
     interaction
     --------------------------------------------------------- */
  /** Damage every prop inside a sphere. Returns the number destroyed. */
  damageNear(pos: THREE.Vector3, radius: number, damage: number, ctx: GameContext, element?: ElementId): number {
    let destroyed = 0;
    for (const p of this.list) {
      if (p.broken) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d > radius + p.radius) continue;
      if (Math.abs(p.pos.y - pos.y) > 2.6) continue;
      p.hp -= damage;
      p.resting = false;
      const kick = new THREE.Vector3(p.pos.x - pos.x, 0, p.pos.z - pos.z);
      if (kick.lengthSq() < 0.0001) kick.set(0, 0, 1);
      kick.normalize().multiplyScalar(Math.min(9, damage * 0.08) / p.mass);
      kick.y = 2.4 / p.mass;
      p.vel.add(kick);
      if (p.hp <= 0) {
        this.shatter(p, ctx, element);
        destroyed++;
      }
    }
    return destroyed;
  }

  /** Radial impulse (explosions, bursts, landing shockwaves). */
  push(pos: THREE.Vector3, radius: number, strength: number) {
    for (const p of this.list) {
      if (p.broken) continue;
      const dx = p.pos.x - pos.x;
      const dz = p.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const dir = d < 0.05 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(dx / d, 0, dz / d);
      p.vel.addScaledVector(dir, (strength * falloff) / p.mass);
      p.vel.y += (strength * 0.35 * falloff) / p.mass;
      p.resting = false;
    }
  }

  private shatter(p: Prop, ctx: GameContext, element?: ElementId) {
    p.broken = true;
    this.group.remove(p.mesh);
    const def = PROPS[p.kind];
    ctx.effects.burst(p.pos.clone(), def.breakColor, 16, 5.2, 0.7, 9);
    const tint = element && element !== 'none' ? ELEMENTS[element].color : def.breakColor;
    ctx.effects.ring(p.pos.clone(), tint, 0.2, p.radius * 4, 0.32);
    ctx.audio?.land?.();
    if (p.kind === 'pot' || p.kind === 'crate') {
      ctx.inventory.add('mora', def.loot);
      if (this.rnd() < 0.16) ctx.inventory.add('crystal', 1);
    } else if (this.rnd() < 0.5) {
      ctx.inventory.add('mora', Math.round(def.loot * 0.6));
    }
  }

  /* ---------------------------------------------------------
     simulation
     --------------------------------------------------------- */
  update(dt: number, ctx: GameContext) {
    const player = ctx.player;
    const step = Math.min(dt, 0.033);
    for (const p of this.list) {
      if (p.broken) continue;

      // player bump: walking into a prop shoves it
      if (player && player.alive) {
        const dx = p.pos.x - player.position.x;
        const dz = p.pos.z - player.position.z;
        const d = Math.hypot(dx, dz);
        const minD = p.radius + 0.42;
        if (d < minD && Math.abs(p.pos.y - player.position.y) < 1.8) {
          const spd = Math.hypot(player.velocity.x, player.velocity.z);
          const inv = d > 0.001 ? 1 / d : 0;
          const nx = d > 0.001 ? dx * inv : 0;
          const nz = d > 0.001 ? dz * inv : 1;
          p.pos.x += nx * (minD - d);
          p.pos.z += nz * (minD - d);
          if (spd > 1.5) {
            p.vel.x += nx * spd * 0.55;
            p.vel.z += nz * spd * 0.55;
            p.resting = false;
            if (spd > 7 && this.rnd() < 0.25) ctx.effects.burst(p.pos.clone(), '#cfc6b4', 4, 1.6, 0.3);
          }
        }
      }

      if (p.resting) {
        // still check that the ground did not vanish underneath (terrain is static, so cheap)
        continue;
      }

      // ---- integrate ----
      p.vel.y += GRAVITY * step;
      p.vel.x *= AIR_DRAG;
      p.vel.z *= AIR_DRAG;
      p.pos.addScaledVector(p.vel, step);

      // ---- world bounds ----
      const lim = 476;
      if (Math.abs(p.pos.x) > lim) {
        p.pos.x = clamp(p.pos.x, -lim, lim);
        p.vel.x *= -0.4;
      }
      if (Math.abs(p.pos.z) > lim) {
        p.pos.z = clamp(p.pos.z, -lim, lim);
        p.vel.z *= -0.4;
      }

      // ---- terrain ----//
      const gy = ctx.terrain.heightAt(p.pos.x, p.pos.z);
      const support = gy + p.radius * 0.85;
      if (p.pos.y <= support) {
        p.pos.y = support;
        const n = ctx.terrain.normalAt(p.pos.x, p.pos.z);
        const vn = p.vel.dot(n);
        if (vn < 0) {
          // reflect along the surface normal and lose energy
          p.vel.addScaledVector(n, -vn * (1 + RESTITUTION));
        }
        // tangential friction
        const t = 1 - Math.abs(n.y);
        p.vel.x *= GROUND_FRICTION;
        p.vel.z *= GROUND_FRICTION;

        // gravity component along the slope makes round props roll downhill
        const rolliness = p.kind === 'barrel' || p.kind === 'pot' ? 1 : p.kind === 'block' ? 0.55 : 0.3;
        if (t > 0.04) {
          p.vel.x += -n.x * 26 * rolliness * step;
          p.vel.z += -n.z * 26 * rolliness * step;
        }
        if (Math.abs(p.vel.y) < 0.9) p.vel.y = 0;
        if (p.vel.lengthSq() < SLEEP_SPEED * SLEEP_SPEED) {
          p.vel.set(0, 0, 0);
          p.resting = true;
        }
      }

      // ---- water: floats and slows ----
      p.water = gy < -0.5 && p.pos.y < 0.6;
      if (p.water) {
        p.pos.y = Math.max(p.pos.y, 0.12);
        p.vel.multiplyScalar(0.9);
        p.vel.y = Math.min(p.vel.y, 0.2);
        if (p.vel.lengthSq() < SLEEP_SPEED * SLEEP_SPEED) {
          p.vel.set(0, 0, 0);
          p.resting = true;
        }
      }

      // ---- visual transform ----
      p.mesh.position.copy(p.pos);
      const speed = Math.hypot(p.vel.x, p.vel.z);
      if (speed > 0.05) {
        // roll about the axis perpendicular to motion
        const axis = new THREE.Vector3(p.vel.z, 0, -p.vel.x).normalize();
        p.mesh.rotateOnWorldAxis(axis, (speed / p.radius) * step * 0.85);
      }
    }
  }

  /** Break any prop the player is standing on? No — but reset broken ones on world reset. */
  clear() {
    for (const p of this.list) {
      if (!p.broken) this.group.remove(p.mesh);
    }
    this.list.length = 0;
    this.rnd = mulberry32(0x5eed1);
  }

  dispose() {
    this.clear();
    for (const m of this.materials.values()) {
      m.body.dispose();
      m.accent.dispose();
    }
    this.materials.clear();
  }

  get activeCount() {
    let n = 0;
    for (const p of this.list) if (!p.broken) n++;
    return n;
  }
}
