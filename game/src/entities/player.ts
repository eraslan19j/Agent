/* =========================================================
   AETHERION — player character controller
   Third person locomotion (run / sprint / jump / climb / glide /
   swim), 4-character party, skills, bursts, stamina and levelling.
   ========================================================= */
import * as THREE from 'three';
import { CHARACTERS, getCharacter, PARTY_ORDER, type CharacterDef } from '../data/characters';
import { ELEMENTS, type ElementId } from '../data/elements';
import { buildCharacterRig, type HumanoidRig } from './rig';
import { COMBO_MULTIPLIERS, incomingDamage } from '../combat/combat';
import { clamp, damp, dampAngle, lerp, TAU } from '../core/utils';
import { WORLD } from '../data/world';
import { xpForLevel, LEVEL_GAINS } from '../data/items';
import type { GameContext } from '../game/types';

export type PlayerState =
  | 'idle' | 'run' | 'sprint' | 'jump' | 'fall' | 'glide'
  | 'climb' | 'swim' | 'attack' | 'skill' | 'burst' | 'hurt' | 'dead';

interface DamageZone {
  pos: THREE.Vector3;
  radius: number;
  element: ElementId;
  power: number;
  remaining: number;
  tick: number;
  tickInterval: number;
  pull: boolean;
  visual: THREE.Mesh;
  vertical: boolean;
}

const GRAVITY = -26;
const JUMP_VELOCITY = 8.4;
const GLIDE_FALL = -1.9;
const CLIMB_SPEED = 2.3;
const SWIM_SPEED = 3.1;
const STAMINA_REGEN = 19;
const SPRINT_DRAIN = 9.5;
const CLIMB_DRAIN = 7.5;
const GLIDE_DRAIN = 5.5;
const SWIM_DRAIN = 4.2;

export class Player {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  rigs = new Map<string, HumanoidRig>();
  activeId = 'kael';
  facing = 0;
  state: PlayerState = 'idle';

  grounded = true;
  gliding = false;
  climbing = false;
  swimming = false;

  stamina = 100;
  maxStamina = 100;
  shieldHp = 0;
  shieldMax = 0;
  invuln = 0;
  alive = true;
  respawnTimer = 0;

  // combat timers
  attackTimer = 0;
  attackDuration = 0;
  attackHitDone = false;
  attackQueued = false;
  comboIndex = 0;
  comboTimer = 0;
  busyTimer = 0;
  busyKind: 'skill' | 'burst' | null = null;
  /** Skill cooldowns are tracked per character (switching must not share them). */
  readonly skillCds: Record<string, number> = {};
  get skillCd() {
    return this.skillCds[this.activeId] ?? 0;
  }
  set skillCd(v: number) {
    this.skillCds[this.activeId] = v;
  }
  switchCd = 0;
  hurtTimer = 0;

  // dodge / plunge
  dashTimer = 0;
  dashCd = 0;
  readonly dashDuration = 0.24;
  readonly dashDir = new THREE.Vector3(0, 0, 1);
  plunging = false;
  private plungeBase = 0;
  footstepTimer = 0;
  private zones: DamageZone[] = [];
  private elapsed = 0;

  readonly energy: Record<string, number> = { kael: 30, sera: 20, rin: 25, bora: 20 };

  constructor(private ctx: GameContext, startX: number, startZ: number) {
    this.root.name = 'player';
    for (const id of PARTY_ORDER) {
      const rig = buildCharacterRig(CHARACTERS[id]);
      rig.object.visible = false;
      rig.object.position.y = 0;
      this.rigs.set(id, rig);
      this.root.add(rig.object);
    }
    this.activeId = ctx.save.data.party[ctx.save.data.activeChar]?.id ?? 'kael';
    this.setVisibleRig(this.activeId);
    this.maxStamina = ctx.save.data.player.staminaMax;
    this.stamina = this.maxStamina;
    this.position.set(startX, ctx.terrain.heightAt(startX, startZ), startZ);
    this.root.position.copy(this.position);
    this.facing = 0;
  }

  get activeDef(): CharacterDef {
    return getCharacter(this.activeId);
  }

  get save() {
    return this.ctx.save.data;
  }

  get hp() {
    const c = this.save.party.find((p) => p.id === this.activeId);
    return c ? c.hp : 100;
  }
  set hp(v: number) {
    const c = this.save.party.find((p) => p.id === this.activeId);
    if (c) c.hp = clamp(v, 0, this.maxHp);
  }

  get maxHp() {
    const partyIndex = Math.max(0, PARTY_ORDER.indexOf(this.activeId as any));
    const def = this.activeDef;
    const entry = this.save.party[partyIndex];
    const lvl = entry ? entry.level : 1;
    return Math.round(def.baseHp + (lvl - 1) * LEVEL_GAINS.hp);
  }

  get atk() {
    return this.save.player.atk * (this.activeDef.baseAtk / 62);
  }

  get def_() {
    return this.save.player.def * (this.activeDef.baseDef / 24);
  }

  get critRate() {
    return this.save.player.critRate + (this.save.player.level - 1) * 0.004;
  }

  get critDmg() {
    return this.save.player.critDmg;
  }

  get currentEnergy() {
    return this.energy[this.activeId] ?? 0;
  }

  set currentEnergy(v: number) {
    this.energy[this.activeId] = clamp(v, 0, 100);
  }

  get burstReady() {
    return this.currentEnergy >= this.activeDef.burst.energyCost;
  }

  private setVisibleRig(id: string) {
    for (const [key, rig] of this.rigs) rig.object.visible = key === id;
  }

  switchTo(index: number) {
    const id = PARTY_ORDER[index];
    if (!id || id === this.activeId || this.switchCd > 0 || !this.alive) return false;
    this.activeId = id;
    this.save.activeChar = index;
    this.switchCd = 0.45;
    this.setVisibleRig(id);
    this.attackTimer = 0;
    this.busyTimer = 0;
    this.busyKind = null;
    this.ctx.audio.ui();
    this.ctx.effects.burst(this.center, ELEMENTS[this.activeDef.element].color, 20, 3.5, 0.5);
    this.ctx.effects.ring(this.position.clone(), ELEMENTS[this.activeDef.element].color, 0.3, 2.6, 0.45);
    this.ctx.save.markDirty();
    return true;
  }

  get center() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.0, this.position.z);
  }

  /* =======================================================
     Frame update
     ======================================================= */
  update(dt: number, ctx: GameContext) {
    this.elapsed += dt;
    const def = this.activeDef;

    if (this.switchCd > 0) this.switchCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    for (const id in this.skillCds) {
      if (this.skillCds[id] > 0) this.skillCds[id] = Math.max(0, this.skillCds[id] - dt);
    }
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.dashCd > 0) this.dashCd = Math.max(0, this.dashCd - dt);
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.shieldHp > 0) {
      this.shieldHp = Math.max(0, this.shieldHp - dt * 2.5);
    }

    if (!this.alive) {
      this.respawnTimer -= dt;
      this.rigs.get(this.activeId)?.update(dt, { state: 'dead', speed: 0, time: this.elapsed, dead: true });
      if (this.respawnTimer <= 0) this.respawn(ctx);
      return;
    }

    // ---- input ----
    const input = ctx.input;
    const wish = ctx.cam.getMoveBasis(input.moveX, input.moveY, new THREE.Vector3());
    const wishLen = Math.min(1, wish.length());
    const sprintHeld = input.sprintHeld;
    const wantJump = input.consume('jump');
    const wantAttack = input.consume('attack');
    const wantSkill = input.consume('skill');
    const wantBurst = input.consume('burst');
    const wantDash = input.consume('dash');
    for (let i = 0; i < 4; i++) {
      if (input.consume(`switch${i + 1}` as any)) this.switchTo(i);
    }

    // ---- timers ----
    if (this.busyTimer > 0) {
      this.busyTimer -= dt;
      if (this.busyTimer <= 0) this.busyKind = null;
    }

    // ---- ground / environment probes ----
    const groundY = ctx.terrain.heightAt(this.position.x, this.position.z);
    const inWater = groundY < WORLD.waterLevel - 0.35 && this.position.y < WORLD.waterLevel + 0.6;

    // ---- state: climbing ----
    const slopeAhead = wishLen > 0.25
      ? ctx.terrain.slopeAt(this.position.x + wish.x * 0.9, this.position.z + wish.z * 0.9)
      : 0;
    if (!this.climbing && this.stamina > 4 && slopeAhead > 0.63 && (this.grounded || this.velocity.y < 2) && input.moveY > 0.2 && !this.swimming) {
      this.climbing = true;
      this.gliding = false;
      this.grounded = false;
      this.velocity.set(0, 0, 0);
      ctx.audio.glide();
    }

    if (this.climbing) {
      this.stamina -= CLIMB_DRAIN * dt;
      const up = input.moveY;
      this.velocity.y = up * CLIMB_SPEED;
      this.velocity.x = wish.x * 0.85 + (this.velocity.x * 0.2);
      this.velocity.z = wish.z * 0.85 + (this.velocity.z * 0.2);
      this.facing = dampAngle(this.facing, Math.atan2(wish.x || -Math.sin(ctx.cam.yaw), wish.z || -Math.cos(ctx.cam.yaw)), 8, dt);

      // vault onto the ledge
      const aheadH = ctx.terrain.heightAt(this.position.x + wish.x * 1.1, this.position.z + wish.z * 1.1);
      if (aheadH < this.position.y - 0.15 && this.position.y > groundY + 0.2) {
        this.position.y = Math.max(aheadH, groundY);
        this.climbing = false;
        this.grounded = true;
        this.velocity.set(wish.x * 3, 2, wish.z * 3);
      }
      if (this.stamina <= 0 || (input.moveY < -0.5 && this.position.y <= groundY + 0.1)) {
        this.climbing = false;
      }
      if (Math.random() < dt * 6) {
        ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.4, this.position.z), '#d8d2c4', 1, 0.5);
      }
    }

    // ---- state: dodge/dash ----
    if (wantDash && this.dashCd <= 0 && this.dashTimer <= 0 && !this.climbing && !this.swimming && this.busyKind !== 'burst') {
      this.startDash(ctx, wish, wishLen);
    }
    const dashing = this.dashTimer > 0;

    // ---- state: swimming ----
    if (inWater && !this.climbing) {
      this.swimming = true;
      this.gliding = false;
      this.position.y = damp(this.position.y, WORLD.waterLevel + 0.15, 8, dt);
      this.velocity.y = 0;
      this.stamina -= SWIM_DRAIN * dt;
      In: {
        const spd = def.moveSpeed * (SWIM_SPEED / 4.5);
        this.velocity.x = damp(this.velocity.x, wish.x * spd, 6, dt);
        this.velocity.z = damp(this.velocity.z, wish.z * spd, 6, dt);
      }
      if (this.stamina <= 0) {
        this.drown(ctx);
        return;
      }
      if (Math.random() < dt * 4) {
        ctx.effects.trail(new THREE.Vector3(this.position.x, WORLD.waterLevel + 0.1, this.position.z), '#bfe6f5', 1, 0.5);
      }
    } else {
      this.swimming = false;
    }

    // ---- horizontal locomotion ----
    const busy = this.busyKind !== null;
    const attacking = this.attackTimer > 0;
    const moveScale = busy ? 0.12 : attacking ? 0.42 : 1;
    const canSprint = sprintHeld && this.stamina > 1 && wishLen > 0.2 && !attacking && !busy && !this.climbing && !this.swimming;
    const speed = def.moveSpeed * (canSprint ? 1.7 : 1) * moveScale;

    if (!this.climbing && !this.swimming && !dashing) {
      const accel = this.grounded ? 16 : 6;
      this.velocity.x = damp(this.velocity.x, wish.x * speed, accel, dt);
      this.velocity.z = damp(this.velocity.z, wish.z * speed, accel, dt);
    }
    if (dashing) {
      this.dashTimer -= dt;
      const k = clamp(this.dashTimer / this.dashDuration, 0, 1);
      const dashSpeed = 7 + 12 * k * k;
      this.velocity.x = this.dashDir.x * dashSpeed;
      this.velocity.z = this.dashDir.z * dashSpeed;
      if (!this.grounded) this.velocity.y = Math.max(this.velocity.y, -4);
      if (this.dashTimer <= 0) {
        this.dashTimer = 0;
        this.velocity.x *= 0.45;
        this.velocity.z *= 0.45;
      }
      if (Math.random() < dt * 30) {
        ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.25, this.position.z), '#dcefff', 2, 0.5);
      }
    }

    if (canSprint) this.stamina -= SPRINT_DRAIN * dt;

    // ---- vertical ----
    if (!this.climbing && !this.swimming) {
      if (this.grounded) {
        if (wantJump && !busy) {
          this.velocity.y = JUMP_VELOCITY;
          this.grounded = false;
          ctx.audio.jump();
        }
      } else if (wantJump && !this.gliding && this.stamina > 8 && this.velocity.y < 1.5) {
        this.gliding = true;
        ctx.audio.glide();
        ctx.effects.ring(this.position.clone(), ELEMENTS.anemo.color, 0.3, 2.2, 0.4);
      }

      if (this.gliding) {
        this.stamina -= GLIDE_DRAIN * dt;
        this.velocity.y = damp(this.velocity.y, GLIDE_FALL, 5, dt);
        const glideDir = wishLen > 0.2 ? wish : ctx.cam.getLookDirection(new THREE.Vector3()).multiplyScalar(-1);
        this.velocity.x = damp(this.velocity.x, glideDir.x * 7.4, 3.5, dt);
        this.velocity.z = damp(this.velocity.z, glideDir.z * 7.4, 3.5, dt);
        if (this.stamina <= 0) this.gliding = false;
        if (Math.random() < dt * 8) {
          ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.8, this.position.z), ELEMENTS.anemo.color, 1, 0.8);
        }
      } else {
        this.velocity.y += GRAVITY * dt;
        if (this.velocity.y < -55) this.velocity.y = -55;
      }
    }

    // ---- integrate ----
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const lim = WORLD.half - 6;
    this.position.x = clamp(this.position.x, -lim, lim);
    this.position.z = clamp(this.position.z, -lim, lim);

    // terrain resolution
    const newGround = ctx.terrain.heightAt(this.position.x, this.position.z);
    if (this.plunging && this.position.y - newGround < 1.1) {
      this.plunging = false;
      this.plungeImpact(ctx, newGround);
    }
    if (this.position.y <= newGround) {
      if (!this.grounded && this.velocity.y < -6) {
        ctx.audio.land();
        ctx.effects.burst(new THREE.Vector3(this.position.x, newGround + 0.1, this.position.z), '#cfc6b4', 8, 2, 0.35);
      }
      this.position.y = newGround;
      this.velocity.y = 0;
      this.grounded = true;
      this.gliding = false;
      this.climbing = false;
    } else if (this.velocity.y > 0.01) {
      // rising (jump / ramp / launch): never snap back down, even on the first frame
      this.grounded = false;
    } else if (this.position.y > newGround + 0.35) {
      this.grounded = false;
    } else {
      this.grounded = true;
      this.velocity.y = Math.min(0, this.velocity.y);
      this.position.y = newGround;
    }

    // ---- stamina regen ----
    const draining = canSprint || this.climbing || this.gliding || this.swimming;
    if (!draining) {
      this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * dt);
    }
    this.stamina = clamp(this.stamina, 0, this.maxStamina);

    // ---- facing ----
    const lock = ctx.settings.autoTarget ? (ctx as any).lockTarget ?? null : null;
    const hasLock = lock && lock.alive && lock.position.distanceTo(this.position) < 16;
    if (attacking || busy) {
      if (hasLock) this.facing = dampAngle(this.facing, Math.atan2(lock.position.x - this.position.x, lock.position.z - this.position.z), 12, dt);
      else if (wishLen > 0.1) this.facing = dampAngle(this.facing, Math.atan2(wish.x, wish.z), 10, dt);
    } else if (wishLen > 0.15 && !this.climbing) {
      this.facing = dampAngle(this.facing, Math.atan2(wish.x, wish.z), 13, dt);
    }

    // ---- actions ----
    if (wantAttack && !busy) this.startAttack(ctx);
    if (wantSkill && this.skillCd <= 0 && !busy) this.useSkill(ctx);
    if (wantBurst && !busy) this.useBurst(ctx);

    // attack timeline
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      const progress = 1 - this.attackTimer / this.attackDuration;
      if (!this.attackHitDone && progress >= 0.34) {
        this.attackHitDone = true;
        this.performHit(ctx);
      }
      if (this.attackTimer <= 0) {
        this.attackTimer = 0;
        if (this.attackQueued) {
          this.attackQueued = false;
          this.startAttack(ctx);
        }
      }
    }

    // damage zones (skills / bursts)
    this.updateZones(dt, ctx);

    // footsteps
    const speedNow = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && speedNow > 1.2) {
      this.footstepTimer -= dt * speedNow;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 2.4;
        ctx.audio.swing('light');
        if (canSprint) ctx.effects.trail(new THREE.Vector3(this.position.x, this.position.y + 0.1, this.position.z), '#d7cdb8', 1, 0.45);
      }
    }

    // ---- energy trickle for the active character ----
    this.currentEnergy += dt * 1.1;

    // ---- apply transform + animation ----
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;

    const animState = this.resolveAnimState(speedNow, attacking);
    const rig = this.rigs.get(this.activeId);
    if (rig) {
      rig.update(dt, {
        state: animState,
        speed: speedNow / 5,
        attackProgress: this.attackTimer > 0 ? 1 - this.attackTimer / this.attackDuration : 0,
        time: this.elapsed,
      });
    }

    // save position periodically
    this.save.player.position.x = this.position.x;
    this.save.player.position.z = this.position.z;
  }

  private resolveAnimState(speed: number, attacking: boolean): any {
    if (this.hurtTimer > 0) return 'hurt';
    if (this.plunging) return 'fall';
    if (this.dashTimer > 0) return 'sprint';
    if (this.busyKind === 'burst') return 'burst';
    if (this.busyKind === 'skill') return 'skill';
    if (attacking) return 'attack';
    if (this.climbing) return 'climb';
    if (this.swimming) return 'swim';
    if (this.gliding) return 'glide';
    if (!this.grounded) return this.velocity.y > 0.4 ? 'jump' : 'fall';
    if (speed > 6.2) return 'sprint';
    if (speed > 0.6) return 'run';
    return 'idle';
  }

  /* =======================================================
     Combat actions
     ======================================================= */
  /** Dodge roll: short burst of speed with invulnerability frames. */
  startDash(ctx: GameContext, wish: THREE.Vector3, wishLen: number) {
    if (this.stamina < 6) return;
    const dir = wishLen > 0.2
      ? new THREE.Vector3(wish.x, 0, wish.z).normalize()
      : new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.dashDir.copy(dir);
    this.dashTimer = this.dashDuration;
    this.dashCd = 1.0;
    this.stamina = Math.max(0, this.stamina - 7);
    this.invuln = Math.max(this.invuln, 0.32);
    this.facing = Math.atan2(dir.x, dir.z);
    this.attackTimer = 0;
    this.attackHitDone = false;
    this.gliding = false;
    ctx.audio?.swing?.('light');
    const at = new THREE.Vector3(this.position.x, this.position.y + 0.2, this.position.z);
    ctx.effects.burst(at, '#dff0ff', 10, 2.6, 0.35, 4);
    ctx.effects.ring(at, '#bfe6ff', 0.2, 1.8, 0.3);
  }

  /** Dive attack from the air: heavy AoE slam on landing. */
  private startPlunge(ctx: GameContext) {
    this.plunging = true;
    this.gliding = false;
    this.attackTimer = 0;
    this.attackHitDone = true;
    this.velocity.y = -26;
    this.plungeBase = this.atk;
    ctx.audio?.glide?.();
    ctx.effects.ring(this.position.clone(), ELEMENTS[this.activeDef.element].color, 1.2, 0.4, 0.25);
  }

  private plungeImpact(ctx: GameContext, groundY: number) {
    const def = this.activeDef;
    const at = new THREE.Vector3(this.position.x, groundY + 0.3, this.position.z);
    const radius = 4.4;
    ctx.enemies.damageInRadius(at, radius, {
      atk: this.plungeBase,
      power: 2.15,
      critRate: this.critRate,
      critDmg: this.critDmg,
      element: def.element,
      knockback: 2.2,
    });
    ctx.props?.damageNear(at, radius, this.plungeBase * 1.6, ctx, def.element);
    ctx.props?.push(at, radius * 1.3, 9);
    ctx.effects.ring(at, ELEMENTS[def.element].color, 0.3, radius, 0.55);
    ctx.effects.burst(at, '#e9e0cc', 24, 6, 0.6, 9);
    ctx.effects.burst(at, ELEMENTS[def.element].color, 16, 4.5, 0.5, 7);
    ctx.requestShake(0.55);
    ctx.requestHitStop(0.08);
    ctx.audio?.land?.();
    this.currentEnergy += 6;
  }

  startAttack(ctx: GameContext) {
    // attacking in mid-air becomes a dive slam
    if (!this.grounded && !this.climbing && !this.swimming && !this.plunging && this.velocity.y < 3.5) {
      this.startPlunge(ctx);
      return;
    }
    if (this.attackTimer > 0) {
      this.attackQueued = true;
      return;
    }
    const def = this.activeDef;
    const durations: Record<string, number> = { sword: 0.42, claymore: 0.66, polearm: 0.4, bow: 0.5, catalyst: 0.55 };
    this.attackDuration = durations[def.weapon] ?? 0.45;
    this.attackTimer = this.attackDuration;
    this.attackHitDone = false;
    this.comboIndex = this.comboTimer > 0 ? (this.comboIndex + 1) % 3 : 0;
    this.comboTimer = 1.15;
    ctx.audio.swing(def.weapon === 'claymore' ? 'heavy' : def.weapon === 'polearm' ? 'spear' : def.weapon === 'bow' ? 'bow' : 'light');
  }

  private performHit(ctx: GameContext) {
    const def = this.activeDef;
    const mult = COMBO_MULTIPLIERS[this.comboIndex] ?? 1;
    const isFinisher = this.comboIndex === 2;
    const origin = this.position.clone();
    const element = def.element;

    if (def.weapon === 'catalyst' || def.weapon === 'bow') {
      // ranged bolt: instant travel with a visible beam
      const target = ctx.enemies.nearest(this.position, def.reach + 2, (e) => {
        const ang = Math.atan2(e.position.x - this.position.x, e.position.z - this.position.z);
        let diff = ((ang - this.facing + Math.PI) % TAU + TAU) % TAU - Math.PI;
        return Math.abs(diff) < 0.9;
      });
      const hitPos = target ? target.center : this.center.clone().addScaledVector(
        new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), def.reach,
      );
      ctx.effects.beam(this.center, hitPos, ELEMENTS[element].color, 0.18, isFinisher ? 0.2 : 0.12);
      ctx.effects.burst(hitPos, ELEMENTS[element].color, isFinisher ? 20 : 10, 3, 0.45);
      if (target) {
        ctx.enemies.applyHit(target, element, {
          atk: this.atk,
          power: 1.15 * mult,
          critRate: this.critRate,
          critDmg: this.critDmg,
          knockback: 0.2,
          from: origin,
        });
      }
      ctx.props?.damageNear(hitPos, 1.5, this.atk * 1.1 * mult, ctx, element);
      return;
    }

    const hitAngle = Math.atan2(Math.sin(this.facing), Math.cos(this.facing));
    const halfAngle = def.weapon === 'claymore' ? 1.35 : 1.0;
    const targets = ctx.enemies.inCone(origin, hitAngle, def.reach, halfAngle);
    const arcPos = origin.clone().add(new THREE.Vector3(Math.sin(this.facing), 0.9, Math.cos(this.facing)).multiplyScalar(def.reach * 0.55));
    ctx.effects.arc(arcPos, new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), ELEMENTS[element].color, def.reach * 0.9, 0.2, this.comboIndex % 2 ? 0.5 : 0);

    for (const e of targets) {
      ctx.enemies.applyHit(e, element, {
        atk: this.atk,
        power: (isFinisher ? 1.5 : 1.0) * mult,
        critRate: this.critRate,
        critDmg: this.critDmg,
        knockback: isFinisher ? 1.6 : 0.45,
        from: origin,
      });
      this.currentEnergy += 2.4;
    }
    if (targets.length === 0) {
      // whiff — small energy, keeps feedback honest
      this.currentEnergy += 0.4;
    }
    ctx.props?.damageNear(arcPos, def.reach * 0.9, this.atk * (isFinisher ? 1.4 : 0.9), ctx, element);
  }

  useSkill(ctx: GameContext) {
    const def = this.activeDef;
    if (this.skillCd > 0) return;
    this.skillCd = def.skill.cooldown;
    this.busyTimer = 0.5;
    this.busyKind = 'skill';
    this.currentEnergy += 13;
    ctx.audio.element(def.element);
    ctx.requestShake(0.16);

    const forward = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const origin = this.position.clone();

    switch (def.skill.kind) {
      case 'vortex': {
        const pos = origin.clone().addScaledVector(forward, 2.6);
        this.addZone(ctx, pos, def.skill.radius, def.element, def.skill.power, def.skill.duration, 0.55, true, true);
        ctx.effects.ring(pos, ELEMENTS[def.element].color, 0.4, def.skill.radius, 0.7);
        break;
      }
      case 'burst-aoe': {
        this.addZone(ctx, origin, def.skill.radius, def.element, def.skill.power, def.skill.duration, 0.6, false, false);
        ctx.effects.ring(origin, ELEMENTS[def.element].color, 0.4, def.skill.radius, 0.6);
        break;
      }
      case 'beam': {
        const targets: any[] = [];
        let from = this.center.clone();
        let cur = ctx.enemies.nearest(this.position, def.skill.radius);
        let guard = 0;
        while (cur && guard < 3) {
          targets.push(cur);
          ctx.effects.lightning(from, cur.center, ELEMENTS[def.element].color);
          ctx.enemies.applyHit(cur, def.element, {
            atk: this.atk, power: def.skill.power, critRate: this.critRate, critDmg: this.critDmg,
            knockback: 0.3, from: this.position,
          });
          from = cur.center.clone();
          cur = ctx.enemies.nearest(cur.position, 7, (e) => !targets.includes(e));
          guard++;
        }
        if (!targets.length) {
          ctx.effects.beam(this.center, this.center.clone().addScaledVector(forward, 6), ELEMENTS[def.element].color, 0.2, 0.12);
        }
        break;
      }
      case 'shield': {
        this.addShield(Math.round(this.maxHp * 0.32), ELEMENTS[def.element].color);
        ctx.enemies.damageInRadius(this.position, def.skill.radius, {
          atk: this.atk, power: def.skill.power, critRate: this.critRate, critDmg: this.critDmg,
          element: def.element, knockback: 1.4,
        });
        ctx.effects.ring(this.position.clone(), ELEMENTS[def.element].color, 0.4, def.skill.radius, 0.7);
        ctx.effects.burst(this.center, ELEMENTS[def.element].color, 26, 4, 0.6);
        break;
      }
      default:
        this.addZone(ctx, origin, def.skill.radius, def.element, def.skill.power, def.skill.duration, 0.7, false, false);
    }
    ctx.save.markDirty();
  }

  useBurst(ctx: GameContext) {
    const def = this.activeDef;
    if (this.currentEnergy < def.burst.energyCost) {
      ctx.notify('Enerji yetersiz — düşmanlara vurarak doldur', '⚡');
      return;
    }
    this.currentEnergy = 0;
    this.busyTimer = 1.15;
    this.busyKind = 'burst';
    this.invuln = Math.max(this.invuln, 0.6);
    ctx.audio.burst();
    ctx.requestShake(0.75);
    ctx.requestHitStop(0.1);
    ctx.cam.fovBoost = -6;
    setTimeout(() => { ctx.cam.fovBoost = 0; }, 700);

    const color = ELEMENTS[def.element].color;
    this.addZone(ctx, this.position.clone(), def.burst.radius, def.element, def.burst.power, def.burst.duration, 0.75, false, def.burst.kind === 'storm');
    ctx.effects.ring(this.position.clone(), color, 0.5, def.burst.radius, 0.9);
    ctx.effects.ring(this.position.clone(), color, 0.2, def.burst.radius * 0.6, 0.7, true);
    ctx.effects.burst(this.center, color, 70, 8, 1.0);
    ctx.events.emit('toast', { text: `${def.name}: ${def.burst.name}!`, icon: ELEMENTS[def.element].glyph });
    ctx.save.markDirty();
  }

  private addZone(
    ctx: GameContext, pos: THREE.Vector3, radius: number, element: ElementId,
    power: number, duration: number, tickInterval: number, pull: boolean, vertical: boolean,
  ) {
    const color = ELEMENTS[element].color;
    const visual = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, vertical ? 6 : 0.06, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color), transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    visual.position.copy(pos);
    visual.position.y += vertical ? 2.4 : 0.12;
    ctx.effects.group.add(visual);
    this.zones.push({
      pos: pos.clone(), radius, element, power, remaining: duration, tick: 0,
      tickInterval, pull, visual, vertical,
    });
  }

  private updateZones(dt: number, ctx: GameContext) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.remaining -= dt;
      z.tick -= dt;
      const mat = z.visual.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.10 + 0.10 * Math.sin(this.elapsed * 9) * (z.remaining > 0.4 ? 1 : 0.3);
      z.visual.rotation.y += dt * 1.6;

      if (z.tick <= 0 && z.remaining > 0) {
        z.tick = z.tickInterval;
        ctx.enemies.damageInRadius(z.pos, z.radius, {
          atk: this.atk, power: z.power * (z.tickInterval / Math.max(0.4, z.remaining + z.tickInterval)) * 0.9,
          critRate: this.critRate * 0.6, critDmg: this.critDmg,
          element: z.element, knockback: z.pull ? 0 : 0.35, pull: z.pull,
        });
        ctx.props?.damageNear(z.pos, z.radius, this.atk * z.power * 0.8, ctx, z.element);
        ctx.props?.push(z.pos, z.radius, z.pull ? -3 : 2.5);
        ctx.effects.ring(z.pos, ELEMENTS[z.element].color, 0.25, z.radius, 0.45);
        if (Math.random() < 0.6) {
          ctx.effects.burst(new THREE.Vector3(
            z.pos.x + (Math.random() - 0.5) * z.radius * 1.4,
            z.pos.y + 0.5 + Math.random() * (z.vertical ? 4 : 0.8),
            z.pos.z + (Math.random() - 0.5) * z.radius * 1.4,
          ), ELEMENTS[z.element].color, 6, 2.4, 0.5);
        }
      }

      if (z.remaining <= 0) {
        ctx.effects.group.remove(z.visual);
        z.visual.geometry.dispose();
        mat.dispose();
        this.zones.splice(i, 1);
      }
    }
  }

  /* =======================================================
     Damage / healing
     ======================================================= */
  takeDamage(raw: number, element: ElementId, fromPos: THREE.Vector3) {
    if (!this.alive || this.invuln > 0) return;
    let amount = incomingDamage(raw, this.def_);
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, amount);
      this.shieldHp -= absorbed;
      amount -= absorbed;
    }
    if (amount <= 0) {
      this.ctx.effects.burst(this.center, '#cfeaff', 10, 3, 0.4);
      return;
    }
    this.hp -= amount;
    this.invuln = 0.55;
    this.hurtTimer = 0.28;
    this.ctx.audio.hurt();
    this.ctx.requestShake(0.3);
    this.ctx.damageNumber(this.center, `-${Math.round(amount)}`, 'phys');
    this.ctx.effects.burst(this.center, ELEMENTS[element].color, 16, 3.6, 0.5);
    this.ctx.events.emit('player:damaged', { amount });

    // knockback away from source
    const dir = new THREE.Vector3(this.position.x - fromPos.x, 0, this.position.z - fromPos.z);
    if (dir.lengthSq() > 0.001) {
      dir.normalize();
      this.velocity.addScaledVector(dir, 3.2);
      this.velocity.y = Math.max(this.velocity.y, 2.0);
      this.grounded = false;
    }

    if (this.hp <= 0) this.die();
  }

  addShield(amount: number, color: string) {
    this.shieldHp = Math.min(this.maxHp * 0.6, this.shieldHp + amount);
    this.shieldMax = Math.max(this.shieldMax, this.shieldHp);
    this.ctx.effects.ring(this.position.clone(), color, 0.4, 1.6, 0.5);
    this.ctx.notify(`Kalkan +${amount}`, '🛡');
  }

  heal(amount: number) {
    if (!this.alive) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = Math.round(this.hp - before);
    if (healed > 0) {
      this.ctx.damageNumber(this.center, `+${healed}`, 'heal');
      this.ctx.effects.heal(this.position.clone());
      this.ctx.events.emit('player:healed', { amount: healed });
    }
  }

  healAll(percent = 1) {
    for (const c of this.save.party) {
      const def = getCharacter(c.id);
      const max = Math.round(def.baseHp + (c.level - 1) * LEVEL_GAINS.hp);
      c.hp = Math.min(max, c.hp + max * percent);
    }
    this.ctx.effects.heal(this.position.clone());
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead';
    this.respawnTimer = 3.2;
    this.hp = 0;
    this.ctx.audio.death();
    this.ctx.requestShake(0.8);
    this.ctx.events.emit('player:died', {});
    this.save.stats.deaths++;
    this.ctx.save.markDirty();
  }

  private drown(ctx: GameContext) {
    this.hp -= Math.round(this.maxHp * 0.25);
    this.stamina = this.maxStamina * 0.5;
    ctx.notify('Dayanıklılık bitti! Kıyıya dönüyorsun.', '💧');
    const r = this.save.player.respawn;
    this.position.set(r.x, ctx.terrain.heightAt(r.x, r.z) + 0.2, r.z);
    this.velocity.set(0, 0, 0);
    if (this.hp <= 0) this.die();
  }

  private respawn(ctx: GameContext) {
    const r = this.save.player.respawn;
    this.position.set(r.x, ctx.terrain.heightAt(r.x, r.z) + 0.3, r.z);
    this.velocity.set(0, 0, 0);
    this.alive = true;
    this.state = 'idle';
    this.invuln = 2;
    this.hp = Math.round(this.maxHp * 0.45);
    for (const c of this.save.party) {
      if (c.hp <= 0) c.hp = Math.round(this.maxHp * 0.3);
    }
    ctx.cam.snapTo(this.position);
    ctx.notify('Yeniden doğdun — mühür taşına dön.', '✦');
    this.ctx.save.markDirty();
  }

  /* =======================================================
     Progression
     ======================================================= */
  addXp(amount: number, ctx: GameContext) {
    const p = this.save.player;
    p.xp += amount;
    let leveled = false;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpForLevel(p.level);
      p.maxHp = Math.round(1200 + (p.level - 1) * LEVEL_GAINS.hp);
      p.hp = p.maxHp;
      p.atk = Math.round((62 + (p.level - 1) * LEVEL_GAINS.atk) * 1.0);
      p.def = Math.round(24 + (p.level - 1) * LEVEL_GAINS.def);
      leveled = true;
      // party levels up with the traveller
      for (const c of this.save.party) {
        c.level = p.level;
        const def = getCharacter(c.id);
        c.hp = Math.round(def.baseHp + (c.level - 1) * LEVEL_GAINS.hp);
      }
    }
    if (leveled) {
      ctx.audio.levelUp();
      ctx.events.emit('player:levelup', { level: p.level });
      ctx.effects.ring(this.position.clone(), '#ffe9a8', 0.5, 5, 0.9, true);
      ctx.effects.burst(this.center, '#ffe9a8', 50, 6, 1.0);
      ctx.notify(`Seviye ${p.level}! Saldırı ${p.atk}`, '★');
    }
    ctx.save.markDirty();
  }

  get xpProgress() {
    const p = this.save.player;
    return clamp(p.xp / p.xpNext, 0, 1);
  }

  dispose() {
    for (const rig of this.rigs.values()) rig.dispose();
    this.rigs.clear();
  }
}

export const PLAYER_CONSTANTS = { GRAVITY, JUMP_VELOCITY, GLIDE_FALL, CLIMB_SPEED, SWIM_SPEED };
