/* =========================================================
   AETHERION — enemies, AI and the combat pipeline
   ========================================================= */
import * as THREE from 'three';
import { CAMPS, ENEMIES, type EnemyDef } from '../data/enemies';
import { ELEMENTS, nextAura, resolveReaction, type ElementId, type ReactionResult } from '../data/elements';
import { buildEnemyModel, type CreatureModel } from './rig';
import { computeDamage, hitStopFor, shakeFor } from '../combat/combat';
import { clamp, damp, dampAngle, mulberry32, rngRange, TAU } from '../core/utils';
import type { GameContext } from '../game/types';
import { WORLD } from '../data/world';

type EnemyState = 'idle' | 'patrol' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead';

export interface HitOptions {
  element?: ElementId;
  critRate?: number;
  critDmg?: number;
  power?: number;
  knockback?: number;
  from?: THREE.Vector3;
  source?: 'player' | 'reaction' | 'environment';
}

let enemyCounter = 0;

export class Enemy {
  readonly id: number;
  readonly root = new THREE.Group();
  readonly model: CreatureModel;
  readonly position = new THREE.Vector3();
  readonly spawnPoint = new THREE.Vector3();
  velocity = new THREE.Vector3();
  facing = 0;
  hp: number;
  maxHp: number;
  state: EnemyState = 'idle';
  stateTime = 0;
  attackCd = 0;
  stunTimer = 0;
  aura: ElementId | null = null;
  auraTimer = 0;
  dot: { dps: number; element: ElementId; remaining: number } | null = null;
  defShred = 0;
  defShredTimer = 0;
  shield = 0;
  aggro = false;
  deadTimer = 0;
  removed = false;
  private wanderAngle = 0;
  private wanderTimer = 0;
  private flashTimer = 0;
  private scaleJitter: number;

  constructor(readonly def: EnemyDef, x: number, z: number, y: number, private rngSeed = 1) {
    this.id = ++enemyCounter;
    this.position.set(x, y, z);
    this.spawnPoint.copy(this.position);
    this.hp = this.maxHp = def.hp;
    this.model = buildEnemyModel(def);
    const jitter = 0.92 + (mulberry32(rngSeed * 97 + 13)() * 0.16);
    this.scaleJitter = jitter;
    this.root.add(this.model.root);
    this.root.scale.setScalar(def.scale * jitter);
    this.root.position.copy(this.position);
    const r = mulberry32(rngSeed * 31 + 7);
    this.wanderAngle = r() * TAU;
  }

  get alive() {
    return this.state !== 'dead';
  }

  get isBoss() {
    return this.def.behavior === 'boss';
  }

  get center() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.0 * this.def.scale, this.position.z);
  }

  faceTowards(x: number, z: number, dt: number, rate = 9) {
    const want = Math.atan2(x - this.position.x, z - this.position.z);
    this.facing = dampAngle(this.facing, want, rate, dt);
    this.root.rotation.y = this.facing;
  }

  /** Apply an element, returning the reaction triggered. */
  applyElement(element: ElementId): ReactionResult {
    if (!this.alive || element === 'none') return resolveReaction(null, 'none');
    const reaction = resolveReaction(this.aura, element);
    // innate auras of elemental creatures always react
    const innate = this.def.element !== 'none' && this.def.element !== element
      ? resolveReaction(this.def.element, element)
      : null;
    let result = reaction;
    if (result.id === 'none' && innate && innate.id !== 'none') result = innate;
    this.aura = nextAura(this.aura ?? (this.def.element !== element ? this.def.element : null), element, result);
    if (this.aura && this.aura !== 'none') this.auraTimer = 8;
    else this.aura = null;

    if (result.stun) this.stunTimer = Math.max(this.stunTimer, result.stun);
    if (result.dot) {
      this.dot = { dps: result.dot.dps, element: result.dot.element, remaining: result.dot.duration };
    }
    if (result.id === 'superconduct') {
      this.defShred = 0.4;
      this.defShredTimer = result.statusDuration ?? 8;
    }
    if (result.shield) this.shield += 0.0; // crystallise shields the *player*
    return result;
  }

  takeDamage(amount: number, opts: { crit: boolean; element: ElementId; reaction?: ReactionResult; knockback?: number; from?: THREE.Vector3; source?: string }) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.flashTimer = 0.12;
    this.model.hitFlash(0.12);
    this.aggro = true;
    if (dmg > 0 && this.state !== 'windup') {
      // brief stagger for light hits, no stun-lock for elites
      if (!this.def.elite && this.stunTimer <= 0 && Math.random() < 0.28) this.stunTimer = 0.18;
    }
    if (opts.knockback && this.def.behavior !== 'boss') {
      const dir = opts.from
        ? new THREE.Vector3(this.position.x - opts.from.x, 0, this.position.z - opts.from.z).normalize()
        : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      const k = opts.knockback / (this.def.elite ? 3.2 : 1);
      this.velocity.addScaledVector(dir, k * 3.2);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    return dmg;
  }

  private die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deadTimer = 0;
    this.velocity.set(0, 0, 0);
  }

  update(dt: number, ctx: GameContext, all: Enemy[]) {
    if (this.removed) return;
    const t = (this.model as any).__t ?? 0;
    const time = ((this.model as any).__t = t + dt);

    if (this.flashTimer > 0) this.flashTimer -= dt;

    if (this.state === 'dead') {
      this.deadTimer += dt;
      const k = clamp(this.deadTimer / 1.1, 0, 1);
      this.root.scale.setScalar(this.def.scale * this.scaleJitter * (1 - k * 0.85));
      this.root.position.y = this.position.y - k * 0.4;
      this.root.rotation.z = k * 0.7;
      if (this.deadTimer > 1.2) this.removed = true;
      return;
    }

    // ---- status effects ----
    if (this.auraTimer > 0) {
      this.auraTimer -= dt;
      if (this.auraTimer <= 0) this.aura = null;
    }
    if (this.dot) {
      this.dot.remaining -= dt;
      const tick = this.dot.dps * this.maxHp * dt * 0.22;
      this.hp -= tick;
      if (Math.random() < dt * 8) {
        ctx.effects.trail(this.center, ELEMENTS[this.dot.element].color, 1, 0.6);
      }
      if (this.dot.remaining <= 0) this.dot = null;
      if (this.hp <= 0) {
        this.die();
        this.handleDeath(ctx);
        return;
      }
    }
    if (this.defShredTimer > 0) {
      this.defShredTimer -= dt;
      if (this.defShredTimer <= 0) this.defShred = 0;
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.model.update(dt, time, 'stagger', 0);
      this.root.position.copy(this.position);
      return;
    }
    if (this.attackCd > 0) this.attackCd -= dt;

    const playerPos = ctx.player.position;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const playerAlive = ctx.player.alive;

    this.stateTime += dt;

    // ---- state machine ----
    switch (this.state) {
      case 'idle':
      case 'patrol': {
        if (playerAlive && dist < this.def.aggroRange) {
          this.aggro = true;
          this.state = 'chase';
          this.stateTime = 0;
          break;
        }
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2 + Math.random() * 4;
          this.wanderAngle = Math.random() * TAU;
        }
        const homeDist = Math.hypot(this.position.x - this.spawnPoint.x, this.position.z - this.spawnPoint.z);
        const move = homeDist > 9 ? Math.atan2(this.spawnPoint.x - this.position.x, this.spawnPoint.z - this.position.z) : this.wanderAngle;
        const spd = this.def.speed * 0.28;
        this.velocity.x = damp(this.velocity.x, Math.sin(move) * spd, 4, dt);
        this.velocity.z = damp(this.velocity.z, Math.cos(move) * spd, 4, dt);
        if (homeDist > 9) this.faceTowards(this.spawnPoint.x, this.spawnPoint.z, dt, 4);
        else this.faceTowards(this.position.x + Math.sin(move), this.position.z + Math.cos(move), dt, 3);
        break;
      }
      case 'chase': {
        if (!playerAlive || dist > this.def.aggroRange * 1.9) {
          this.state = 'idle';
          this.aggro = false;
          break;
        }
        this.faceTowards(playerPos.x, playerPos.z, dt, 8);
        const maxSpeed = this.def.speed;
        if (dist > this.def.attackRange * 0.85) {
          const push = new THREE.Vector3(dx / (dist || 1), 0, dz / (dist || 1)).multiplyScalar(maxSpeed);
          this.velocity.x = damp(this.velocity.x, push.x, 6, dt);
          this.velocity.z = damp(this.velocity.z, push.z, 6, dt);
        } else {
          this.velocity.x = damp(this.velocity.x, 0, 8, dt);
          this.velocity.z = damp(this.velocity.z, 0, 8, dt);
        }
        if (dist < this.def.attackRange && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateTime = 0;
          this.velocity.multiplyScalar(0.2);
        }
        break;
      }
      case 'windup': {
        this.faceTowards(playerPos.x, playerPos.z, dt, 6);
        this.velocity.x = damp(this.velocity.x, 0, 10, dt);
        this.velocity.z = damp(this.velocity.z, 0, 10, dt);
        if (this.stateTime >= this.def.windup) {
          this.state = 'attack';
          this.stateTime = 0;
          this.performAttack(ctx, dist, playerPos);
        }
        break;
      }
      case 'attack': {
        if (this.def.behavior === 'charger') {
          const spd = this.def.speed * 1.9;
          this.velocity.x = Math.sin(this.facing) * spd;
          this.velocity.z = Math.cos(this.facing) * spd;
          if (dist < this.def.attackRange * 1.2 && !(this as any).__contactDone) {
            (this as any).__contactDone = true;
            this.hitPlayer(ctx, playerPos);
          }
        }
        if (this.stateTime > 0.35) {
          (this as any).__contactDone = false;
          this.state = 'recover';
          this.stateTime = 0;
          this.attackCd = this.def.attackCooldown;
        }
        break;
      }
      case 'recover': {
        this.velocity.x = damp(this.velocity.x, 0, 7, dt);
        this.velocity.z = damp(this.velocity.z, 0, 7, dt);
        if (this.stateTime > 0.45) {
          this.state = 'chase';
          this.stateTime = 0;
        }
        break;
      }
      case 'stagger': {
        if (this.stateTime > 0.3) {
          this.state = 'chase';
          this.stateTime = 0;
        }
        break;
      }
    }

    // ---- separation from other enemies ----
    for (const other of all) {
      if (other === this || !other.alive) continue;
      const ox = this.position.x - other.position.x;
      const oz = this.position.z - other.position.z;
      const d2 = ox * ox + oz * oz;
      const minD = 1.1 * (this.def.scale + other.def.scale) * 0.5;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const f = (1 - d / minD) * 2.2;
        this.velocity.x += (ox / d) * f * dt * 6;
        this.velocity.z += (oz / d) * f * dt * 6;
      }
    }

    // ---- integrate ----
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.velocity.x *= Math.max(0, 1 - 5 * dt);
    this.velocity.z *= Math.max(0, 1 - 5 * dt);

    // keep in world
    const lim = WORLD.half - 8;
    this.position.x = clamp(this.position.x, -lim, lim);
    this.position.z = clamp(this.position.z, -lim, lim);

    // terrain + water
    const groundY = ctx.terrain.heightAt(this.position.x, this.position.z);
    this.position.y = this.def.model === 'spirit' ? Math.max(groundY + 0.6, groundY) : groundY;
    if (this.def.model === 'spirit' && groundY < WORLD.waterLevel) this.position.y = WORLD.waterLevel + 0.8;
    this.root.position.copy(this.position);

    // animation state
    let animState = 'idle';
    if (this.state === 'chase') animState = 'chase';
    else if (this.state === 'windup') animState = 'windup';
    else if (this.state === 'attack') animState = 'attack';
    else if (this.state === 'stagger') animState = 'stagger';
    const charge = this.state === 'windup' ? clamp(this.stateTime / this.def.windup, 0, 1) : 0;
    this.model.update(dt, time, animState, charge);

    // telegraph particles while charging
    if (this.state === 'windup' && Math.random() < dt * 14) {
      ctx.effects.trail(this.center, ELEMENTS[this.def.element].color, 1, 0.5);
    }
  }

  private performAttack(ctx: GameContext, dist: number, playerPos: THREE.Vector3) {
    if (this.def.ranged) {
      const count = this.def.ranged.count;
      for (let i = 0; i < count; i++) {
        const origin = this.center;
        const target = new THREE.Vector3(playerPos.x, playerPos.y + 1.0, playerPos.z);
        const dir = target.clone().sub(origin).normalize();
        if (count > 1) {
          dir.x += (Math.random() - 0.5) * 0.12;
          dir.normalize();
        }
        ctx.enemies.spawnProjectile(origin, dir, this.def.ranged.projectileSpeed, this.def.atk, this.def.element);
      }
      ctx.audio.element(this.def.element);
      return;
    }

    if (this.def.behavior === 'boss') {
      // every other attack is a shockwave slam
      if (Math.random() < 0.45) {
        ctx.effects.ring(this.position.clone(), ELEMENTS[this.def.element].color, 0.5, 7, 0.7);
        ctx.effects.burst(this.center, ELEMENTS[this.def.element].color, 30, 7, 0.8);
        ctx.audio.element(this.def.element);
        ctx.requestShake(0.4);
        if (dist < 7.5) this.hitPlayer(ctx, playerPos, 1.15);
        ctx.enemies.damagePlayerInRadius(this.position, 7.5, this.def.atk * 1.15, this.def.element);
      } else if (dist < this.def.attackRange * 1.35) {
        this.hitPlayer(ctx, playerPos);
      }
      return;
    }

    if (dist < this.def.attackRange * 1.45) {
      this.hitPlayer(ctx, playerPos);
    }
  }

  private hitPlayer(ctx: GameContext, playerPos: THREE.Vector3, power = 1) {
    ctx.player.takeDamage(this.def.atk * power, this.def.element, this.position);
    ctx.effects.arc(
      new THREE.Vector3((this.position.x + playerPos.x) / 2, playerPos.y + 1, (this.position.z + playerPos.z) / 2),
      new THREE.Vector3(playerPos.x - this.position.x, 0.2, playerPos.z - this.position.z).normalize(),
      ELEMENTS[this.def.element].color, 1.6, 0.2,
    );
    ctx.audio.impact(this.def.elite);
    ctx.requestShake(0.2);
  }

  handleDeath(ctx: GameContext) {
    if ((this as any).__deathHandled) return;
    (this as any).__deathHandled = true;
    ctx.effects.burst(this.center, ELEMENTS[this.def.element].color, this.def.elite ? 70 : 28, this.def.elite ? 8 : 4.5, 0.9);
    ctx.effects.ring(this.position.clone(), ELEMENTS[this.def.element].color, 0.3, this.def.elite ? 7 : 2.4, 0.6);
    ctx.audio.death();
    this.die();
    ctx.events.emit('enemy:killed', {
      type: this.def.id,
      x: this.position.x,
      z: this.position.z,
      elite: this.def.elite,
    });
    if (this.def.elite) {
      ctx.hud.hideBoss();
      ctx.requestShake(0.5);
      ctx.events.emit('boss:defeated', { name: this.def.name });
    }
  }
}

/* =========================================================
   Enemy projectiles
   ========================================================= */
interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
  element: ElementId;
  radius: number;
}

/* =========================================================
   Enemy manager
   ========================================================= */
export class EnemyManager {
  readonly group = new THREE.Group();
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private projGeo = new THREE.SphereGeometry(0.22, 10, 8);
  private campTimers = new Map<string, number>();
  private rng = mulberry32(WORLD.seed + 991);
  private targetCache: Enemy | null = null;

  constructor(private ctx: GameContext) {
    this.group.name = 'enemies';
  }

  populate() {
    for (const camp of CAMPS) {
      this.spawnCamp(camp.id, camp.x, camp.z, camp.enemies);
    }
  }

  spawnCamp(campId: string, cx: number, cz: number, list: string[]) {
    for (let i = 0; i < list.length; i++) {
      const def = ENEMIES[list[i]];
      if (!def) continue;
      const angle = (i / list.length) * TAU + this.rng() * 0.8;
      const radius = 2.5 + this.rng() * 5;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const y = this.ctx.terrain.heightAt(x, z);
      if (y < WORLD.waterLevel + 0.3) continue;
      const enemy = new Enemy(def, x, z, y, i + 1);
      this.enemies.push(enemy);
      this.group.add(enemy.root);
    }
    this.campTimers.set(campId, 0);
  }

  /** Nearest living enemy to a point, optionally filtered. */
  nearest(pos: THREE.Vector3, maxDist = 12, filter?: (e: Enemy) => boolean): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (filter && !filter(e)) continue;
      const dx = e.position.x - pos.x;
      const dz = e.position.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Enemies inside a cone in front of a position (used by melee swings). */
  inCone(origin: THREE.Vector3, facingRad: number, range: number, halfAngle: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - origin.x;
      const dz = e.position.z - origin.z;
      const d = Math.hypot(dx, dz);
      const reach = range + e.def.scale * 0.45;
      if (d > reach) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ((ang - facingRad + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (Math.abs(diff) <= halfAngle) out.push(e);
    }
    return out;
  }

  inRadius(pos: THREE.Vector3, radius: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
      if (d <= radius + e.def.scale * 0.35) out.push(e);
    }
    return out;
  }

  /**
   * Central elemental damage pipeline: applies aura, resolves the reaction,
   * rolls crit, applies damage, spawns popups and secondary reactions.
   */
  applyHit(
    target: Enemy,
    element: ElementId,
    opts: {
      atk: number;
      power: number;
      critRate: number;
      critDmg: number;
      knockback?: number;
      from?: THREE.Vector3;
      elementLabel?: boolean;
      aoeElement?: boolean;
    },
  ): { damage: number; crit: boolean; reaction: ReactionResult } {
    const reaction = target.applyElement(element);
    const dmg = computeDamage({
      atk: opts.atk,
      power: opts.power,
      critRate: opts.critRate,
      critDmg: opts.critDmg,
      reactionMult: reaction.mult,
      defShred: target.defShred,
      targetDef: target.def.def,
    });

    target.takeDamage(dmg.amount, {
      crit: dmg.crit,
      element,
      reaction,
      knockback: opts.knockback ?? 0.2,
      from: opts.from ?? this.ctx.player.position,
    });

    const center = target.center;
    this.ctx.damageNumber(center, String(dmg.amount), dmg.crit ? 'crit' : 'phys');
    if (reaction.id !== 'none') {
      this.ctx.damageNumber(center.clone().add(new THREE.Vector3(0, 0.55, 0)), reaction.name, 'reaction');
      this.ctx.effects.burst(center, reaction.color, 18, 3.4, 0.55);
      this.ctx.audio.element(element);
      this.ctx.save.data.stats.reactions++;
    }
    this.ctx.audio.impact(dmg.crit);
    this.ctx.requestHitStop(hitStopFor(dmg.amount, dmg.crit));
    this.ctx.requestShake(shakeFor(dmg.amount, dmg.crit));

    // secondary reaction effects
    if (reaction.aoe) {
      const aoeMult = reaction.aoe.factor;
      const others = this.inRadius(target.position, reaction.aoe.radius);
      this.ctx.effects.ring(target.position.clone(), reaction.color, 0.4, reaction.aoe.radius, 0.5);
      for (const other of others) {
        if (other === target) continue;
        other.applyElement(reaction.aoe.element);
        const d2 = computeDamage({
          atk: opts.atk, power: opts.power * aoeMult, critRate: opts.critRate, critDmg: opts.critDmg,
          targetDef: other.def.def, defShred: other.defShred,
        });
        other.takeDamage(d2.amount, {
          crit: false, element: reaction.aoe.element, knockback: reaction.aoe.knockback,
          from: target.position,
        });
        this.ctx.damageNumber(other.center, String(d2.amount), 'phys');
        if (!other.alive) other.handleDeath(this.ctx);
      }
    }
    if (reaction.id === 'swirl' && reaction.spread) {
      // anemo spreads the aura it swirled
      const el = reaction.aoe?.element ?? 'anemo';
      for (const other of this.inRadius(target.position, reaction.spread)) {
        if (other === target || !other.alive) continue;
        const r = other.applyElement(el);
        if (r.id !== 'none') {
          this.ctx.damageNumber(other.center.clone().add(new THREE.Vector3(0, 0.5, 0)), r.name, 'reaction');
        }
      }
    }
    if (reaction.shield) {
      this.ctx.player.addShield(Math.round(dmg.amount * reaction.shield), reaction.color);
    }

    if (!target.alive) target.handleDeath(this.ctx);
    return { damage: dmg.amount, crit: dmg.crit, reaction };
  }

  /** Damage everything in a radius (skills and bursts). */
  damageInRadius(
    pos: THREE.Vector3,
    radius: number,
    opts: { atk: number; power: number; critRate: number; critDmg: number; element: ElementId; knockback?: number; pull?: boolean },
  ) {
    const list = this.inRadius(pos, radius);
    for (const e of list) {
      this.applyHit(e, opts.element, {
        atk: opts.atk,
        power: opts.power,
        critRate: opts.critRate,
        critDmg: opts.critDmg,
        knockback: opts.knockback ?? 0.4,
        from: pos,
      });
      if (opts.pull) {
        const dir = new THREE.Vector3(pos.x - e.position.x, 0, pos.z - e.position.z);
        const d = dir.length();
        if (d > 0.5) {
          e.velocity.addScaledVector(dir.normalize(), 5.5 / Math.max(1, d * 0.3));
        }
      }
    }
    return list.length;
  }

  damagePlayerInRadius(pos: THREE.Vector3, radius: number, atk: number, element: ElementId) {
    const p = this.ctx.player.position;
    if (Math.hypot(p.x - pos.x, p.z - pos.z) < radius) {
      this.ctx.player.takeDamage(atk, element, pos);
    }
  }

  spawnProjectile(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, damage: number, element: ElementId) {
    const mat = new THREE.MeshBasicMaterial({ color: ELEMENTS[element].color });
    const mesh = new THREE.Mesh(this.projGeo, mat);
    mesh.position.copy(origin);
    mesh.scale.setScalar(element === 'geo' ? 1.4 : 1);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 6),
      new THREE.MeshBasicMaterial({ color: ELEMENTS[element].glow, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    mesh.add(glow);
    this.group.add(mesh);
    this.projectiles.push({
      mesh,
      velocity: dir.clone().multiplyScalar(speed),
      life: 4,
      damage,
      element,
      radius: 0.85,
    });
  }

  private updateProjectiles(dt: number) {
    const p = this.ctx.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.mesh.position.addScaledVector(pr.velocity, dt);
      pr.mesh.rotation.y += dt * 6;
      const hitY = pr.mesh.position.y;
      const groundY = this.ctx.terrain.heightAt(pr.mesh.position.x, pr.mesh.position.z) + 0.1;
      const distToPlayer = pr.mesh.position.distanceTo(new THREE.Vector3(p.position.x, p.position.y + 1, p.position.z));
      if (distToPlayer < pr.radius + 0.5) {
        p.takeDamage(pr.damage, pr.element, pr.mesh.position.clone());
        this.ctx.effects.burst(pr.mesh.position, ELEMENTS[pr.element].color, 14, 3, 0.45);
        pr.life = -1;
      } else if (hitY < groundY || pr.life <= 0) {
        this.ctx.effects.burst(pr.mesh.position, ELEMENTS[pr.element].color, 10, 2.4, 0.4);
        pr.life = -1;
      }
      if (pr.life <= 0) {
        this.group.remove(pr.mesh);
        (pr.mesh.material as THREE.Material).dispose();
        (pr.mesh.children[0] as THREE.Mesh)?.geometry?.dispose?.();
        ((pr.mesh.children[0] as THREE.Mesh)?.material as THREE.Material)?.dispose?.();
        this.projectiles.splice(i, 1);
      }
    }
  }

  update(dt: number, playerPos: THREE.Vector3) {
    for (const e of this.enemies) {
      // cull distant idle enemies for performance
      const d = Math.hypot(e.position.x - playerPos.x, e.position.z - playerPos.z);
      if (d > 190) {
        if (e.state === 'chase') {
          e.state = 'idle';
          e.aggro = false;
        }
        continue;
      }
      e.update(dt, this.ctx, this.enemies);
    }

    // cleanup dead
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.removed) {
        this.group.remove(e.root);
        e.model.dispose();
        this.enemies.splice(i, 1);
      }
    }

    this.updateProjectiles(dt);

    // camp respawns
    for (const camp of CAMPS) {
      const aliveCount = this.enemies.some((e) => e.alive && Math.hypot(e.spawnPoint.x - camp.x, e.spawnPoint.z - camp.z) < camp.radius + 12);
      if (!aliveCount) {
        const timer = (this.campTimers.get(camp.id) ?? 0) + dt;
        this.campTimers.set(camp.id, timer);
        if (timer > camp.respawn) {
          this.campTimers.set(camp.id, 0);
          const dist = Math.hypot(playerPos.x - camp.x, playerPos.z - camp.z);
          if (dist > 45) this.spawnCamp(camp.id, camp.x, camp.z, camp.enemies);
        }
      } else {
        this.campTimers.set(camp.id, 0);
      }
    }
  }

  /** Boss health feed for the HUD. */
  activeBoss(): Enemy | null {
    for (const e of this.enemies) {
      if (e.alive && e.def.elite) {
        const d = Math.hypot(e.position.x - this.ctx.player.position.x, e.position.z - this.ctx.player.position.z);
        if (d < 60) return e;
      }
    }
    return null;
  }

  clearAll() {
    for (const e of this.enemies) {
      this.group.remove(e.root);
      e.model.dispose();
    }
    this.enemies.length = 0;
    for (const pr of this.projectiles) {
      this.group.remove(pr.mesh);
    }
    this.projectiles.length = 0;
  }
}
