/* =========================================================
   AETHERION — HUD, touch controls, damage numbers, minimap
   ========================================================= */
import * as THREE from 'three';
import type { GameContext } from '../game/types';
import { ELEMENTS } from '../data/elements';
import { getCharacter, PARTY_ORDER } from '../data/characters';
import { clamp } from '../core/utils';
import { Minimap } from './minimap';
import { formatTime, formatNumber } from '../core/utils';
import type { WorldObj } from '../world/worldobjects';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface DmgEntry {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  driftX: number;
  used: boolean;
}

export class HUD {
  private hpFill = $('hp-fill');
  private hpText = $('hp-text');
  private energyFill = $('energy-fill');
  private staminaRing = $<any>('stamina-ring');
  private staminaWrap = $('stamina-wrap');
  private skillBtn = $('btn-skill');
  private skillCd = $('skill-cd');
  private skillIcon = $('skill-icon');
  private burstBtn = $('btn-burst');
  private partyBar = $('party-bar');
  private questTitle = $('quest-title');
  private questObjectives = $('quest-objectives');
  private interactBtn = $('interact');
  private interactLabel = $('interact-label');
  private toastLayer = $('toast-layer');
  private dmgLayer = $('dmg-layer');
  private minimapCanvas = $<HTMLCanvasElement>('minimap');
  private clockTime = $('clock-time');
  private clockIcon = $('clock-icon');
  private coords = $('coords');
  private bossBar = $('boss-bar');
  private bossName = $('boss-name');
  private bossFill = $('boss-fill');
  private elementStatus = $('element-status');
  private hintEl = $('hint');
  private pname = $('pname');
  private plvl = $('plvl');
  private minimap: Minimap;

  private dmgPool: DmgEntry[] = [];
  private toastTimer = 0;
  private sig = '';
  private partyEls: HTMLElement[] = [];
  private partyBars: HTMLElement[] = [];
  private lastNameHtml = '';
  private elTick = 0;
  private minimapTick = 0;
  private questTick = 0;
  private currentInteract: WorldObj | null = null;
  private fps = 60;
  private fpsAccum = 0;
  private fpsCount = 0;

  // touch state
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private camPointer: number | null = null;
  private camLast = { x: 0, y: 0 };

  constructor(private ctx: GameContext) {
    this.minimap = new Minimap(ctx.terrain);
    this.buildParty();
    this.buildDmgPool();
    this.bindTouch();
    this.bindButtons();
  }

  /* ---------------- construction ---------------- */
  private buildParty() {
    this.partyBar.innerHTML = '';
    PARTY_ORDER.forEach((id, i) => {
      const def = getCharacter(id);
      const el = document.createElement('div');
      el.className = 'party-member';
      el.dataset.index = String(i);
      el.innerHTML = `
        <span class="pm-key">${i + 1}</span>
        ${def.name[0]}
        <span class="pm-el" style="background:${ELEMENTS[def.element].color}">${ELEMENTS[def.element].glyph}</span>
        <span class="pm-hp"><i></i></span>`;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.ctx.player.switchTo(i);
        this.ctx.audio.ui();
      });
      this.partyBar.appendChild(el);
      this.partyEls.push(el);
      this.partyBars.push(el.querySelector('.pm-hp i') as HTMLElement);
    });
  }

  private buildDmgPool() {
    for (let i = 0; i < 44; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.opacity = '0';
      this.dmgLayer.appendChild(el);
      this.dmgPool.push({ el, pos: new THREE.Vector3(), life: 0, maxLife: 1, driftX: 0, used: false });
    }
  }

  private bindButtons() {
    const acts: Record<string, string> = {
      attack: 'attack', skill: 'skill', burst: 'burst', jump: 'jump',
      sprint: 'sprint-special', interact: 'interact',
    };
    document.querySelectorAll<HTMLElement>('[data-act]').forEach((btn) => {
      const act = btn.dataset.act!;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.ctx.audio.resume();
        if (act === 'sprint-special') {
          this.ctx.input.sprintHeld = true;
          btn.classList.add('press');
          return;
        }
        if (act === 'pause') {
          this.ctx.events.emit('toast', { text: '__pause__' });
          return;
        }
        this.ctx.input.press(act as any);
        this.ctx.audio.ui();
        btn.classList.add('press');
        setTimeout(() => btn.classList.remove('press'), 110);
      }, { passive: false });
      if (act === 'sprint-special') {
        const release = () => {
          this.ctx.input.sprintHeld = false;
          btn.classList.remove('press');
        };
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('pointerleave', release);
      }
    });
  }

  private bindTouch() {
    // ---- joystick ----
    const joy = $('joystick');
    const knob = $('joy-knob');
    const base = joy.querySelector('.joy-base') as HTMLElement;
    const radius = () => (base.clientWidth || 120) * 0.36;

    const updateJoy = (clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = radius();
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.ctx.input.usingJoystick = true;
      this.ctx.input.moveX = dx / max;
      this.ctx.input.moveY = -dy / max;
    };

    const resetJoy = () => {
      this.joyId = null;
      knob.style.transform = 'translate(0,0)';
      this.ctx.input.moveX = 0;
      this.ctx.input.moveY = 0;
      setTimeout(() => { this.ctx.input.usingJoystick = false; }, 60);
    };

    joy.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      joy.setPointerCapture?.(e.pointerId);
      updateJoy(e.clientX, e.clientY);
    }, { passive: false });

    joy.addEventListener('pointermove', (e) => {
      if (this.joyId !== e.pointerId) return;
      e.stopPropagation();
      updateJoy(e.clientX, e.clientY);
    });

    joy.addEventListener('pointerup', (e) => {
      if (this.joyId !== e.pointerId) return;
      e.stopPropagation();
      resetJoy();
    });
    joy.addEventListener('pointercancel', resetJoy);

    // ---- camera drag on the stage ----
    const stage = $('stage');
    stage.addEventListener('pointerdown', (e) => {
      if (this.camPointer !== null) return;
      this.camPointer = e.pointerId;
      this.camLast = { x: e.clientX, y: e.clientY };
      stage.setPointerCapture?.(e.pointerId);
      this.ctx.audio.resume();
    });
    stage.addEventListener('pointermove', (e) => {
      if (this.camPointer !== e.pointerId) return;
      const dx = e.clientX - this.camLast.x;
      const dy = e.clientY - this.camLast.y;
      this.camLast = { x: e.clientX, y: e.clientY };
      this.ctx.cam.sensitivity = this.ctx.settings.sensitivity;
      this.ctx.cam.addLook(dx, this.ctx.settings.invertY ? -dy : dy);
    });
    const endCam = (e: PointerEvent) => {
      if (this.camPointer === e.pointerId) this.camPointer = null;
    };
    stage.addEventListener('pointerup', endCam);
    stage.addEventListener('pointercancel', endCam);

    // desktop wheel = zoom
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.ctx.cam.distance = clamp(this.ctx.cam.distance + e.deltaY * 0.004, 2.6, 9);
    }, { passive: false });
  }

  /* ---------------- public API ---------------- */
  damageNumber(pos: THREE.Vector3, text: string, kind: 'phys' | 'crit' | 'heal' | 'reaction' | 'element' = 'phys') {
    if (!this.ctx.settings.showDamageNumbers) return;
    const entry = this.dmgPool.find((d) => !d.used);
    if (!entry) return;
    entry.used = true;
    entry.pos.copy(pos);
    entry.life = kind === 'reaction' ? 1.15 : 0.9;
    entry.maxLife = entry.life;
    entry.driftX = (Math.random() - 0.5) * 34;
    entry.el.textContent = text;
    entry.el.className = `dmg-num ${kind}`;
    entry.el.style.opacity = '1';
    entry.el.style.transform = 'translate(-50%,-50%) scale(1)';
  }

  toast(text: string, icon?: string) {
    if (text === '__pause__') return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = icon ? `${icon}  ${text}` : text;
    this.toastLayer.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    while (this.toastLayer.children.length > 4) this.toastLayer.firstChild?.remove();
  }

  setInteract(obj: WorldObj | null) {
    if (obj === this.currentInteract) return;
    this.currentInteract = obj;
    if (!obj) {
      this.interactBtn.classList.add('hidden');
      return;
    }
    this.interactBtn.classList.remove('hidden');
    this.interactLabel.textContent = obj.prompt(this.ctx);
  }

  showBoss(name: string) {
    this.bossBar.classList.remove('hidden');
    this.bossName.textContent = name.toUpperCase();
  }

  hideBoss() {
    this.bossBar.classList.add('hidden');
  }

  setHint(text: string | null) {
    if (!text) {
      this.hintEl.classList.add('hidden');
      return;
    }
    this.hintEl.classList.remove('hidden');
    this.hintEl.textContent = text;
  }

  /* ---------------- per frame ---------------- */
  update(dt: number) {
    const p = this.ctx.player;
    const def = p.activeDef;

    // fps
    this.fpsAccum += dt;
    this.fpsCount++;
    if (this.fpsAccum > 0.6) {
      this.fps = this.fpsCount / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsCount = 0;
    }

    // bars
    const hpPct = clamp(p.hp / p.maxHp, 0, 1);
    this.hpFill.style.width = `${hpPct * 100}%`;
    this.hpFill.style.background = hpPct < 0.3
      ? 'linear-gradient(90deg,#c0392b,#ff6b6b)'
      : 'linear-gradient(90deg,#34b57a,#7ff0ad)';
    this.hpText.textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`;
    this.energyFill.style.width = `${clamp(p.currentEnergy / def.burst.energyCost, 0, 1) * 100}%`;

    const withFps = this.ctx.settings.showFps ? `  ·  ${this.fps.toFixed(0)} FPS` : '';
    const nameHtml = `${def.name} <small>Lv.${p.save.player.level}${withFps}</small>`;
    if (nameHtml !== this.lastNameHtml) {
      this.lastNameHtml = nameHtml;
      this.pname.innerHTML = nameHtml;
      this.plvl.textContent = `Lv.${p.save.player.level}`;
    }

    // stamina
    const staminaPct = clamp(p.stamina / p.maxStamina, 0, 1);
    this.staminaRing.style.strokeDashoffset = String(264 * (1 - staminaPct));
    this.staminaRing.style.stroke = staminaPct < 0.25 ? '#ff8f8f' : '#bfe4ff';
    this.staminaWrap.classList.toggle('show', staminaPct < 0.995);

    // skill + burst
    const cd = Math.max(0, p.skillCd);
    if (cd > 0.05) {
      this.skillCd.classList.add('on');
      this.skillCd.textContent = cd.toFixed(1);
    } else {
      this.skillCd.classList.remove('on');
    }
    this.skillIcon.textContent = ELEMENTS[def.element].glyph;
    this.burstBtn.classList.toggle('ready', p.burstReady);
    this.burstBtn.classList.toggle('charging', !p.burstReady);

    // party
    PARTY_ORDER.forEach((id, i) => {
      const el = this.partyEls[i];
      const member = this.ctx.save.data.party[i];
      const cdef = getCharacter(id);
      const max = cdef.baseHp + (member.level - 1) * 105;
      this.partyBars[i].style.width = `${clamp(member.hp / max, 0, 1) * 100}%`;
      el.classList.toggle('active', p.activeId === id);
      el.classList.toggle('cd', p.switchCd > 0 && p.activeId !== id);
    });

    // clock + coords
    this.clockTime.textContent = this.ctx.sky.timeLabel;
    this.clockIcon.textContent = this.ctx.sky.dayFactor > 0.35 ? '☀' : '☾';
    this.coords.textContent = `${Math.round(p.position.x)} · ${Math.round(p.position.z)}`;

    // quest tracker (throttled)
    this.questTick -= dt;
    if (this.questTick <= 0) {
      this.questTick = 0.35;
      const tracker = this.ctx.quests.tracker();
      if (tracker) {
        const sig = `${tracker.title}|${tracker.objectives.map((o) => `${o.label}:${o.current}/${o.target}`).join(',')}`;
        if (sig !== this.sig) {
          this.sig = sig;
          this.questTitle.textContent = tracker.title;
          this.questObjectives.innerHTML = tracker.objectives
            .map((o) => `<li class="${o.done ? 'done' : ''}"><span>${o.label}</span><b>${Math.min(o.current, o.target)}/${o.target}</b></li>`)
            .join('');
        }
      }
    }

    // element chips (throttled — innerHTML is expensive)
    this.elTick -= dt;
    if (this.elTick <= 0) {
      this.elTick = 0.2;
      const shieldChip = p.shieldHp > 1
        ? `<span class="el-chip" style="background:#ffc857">🛡 ${Math.round(p.shieldHp)}</span>` : '';
      this.elementStatus.innerHTML = `<span class="el-chip" style="background:${ELEMENTS[def.element].color}">${ELEMENTS[def.element].short}</span>${shieldChip}`;
    }

    // boss bar
    const boss = this.ctx.enemies.activeBoss();
    if (boss) {
      if (this.bossBar.classList.contains('hidden')) this.showBoss(boss.def.name);
      this.bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
    } else if (!this.bossBar.classList.contains('hidden')) {
      this.hideBoss();
    }

    this.updateDamageNumbers(dt);

    // minimap (throttled)
    this.minimapTick -= dt;
    if (this.minimapTick <= 0) {
      this.minimapTick = 1 / 12;
      this.drawMinimap();
    }
  }

  private drawMinimap() {
    const markers: { x: number; z: number; color: string; kind: 'waypoint' | 'quest' | 'enemy' | 'chest' | 'boss' }[] = [];
    for (const o of this.ctx.world.objects) {
      if (o.kind === 'statue') markers.push({ x: o.position.x, z: o.position.z, color: '#9fe8ff', kind: 'waypoint' });
      else if (o.kind === 'chest' && o.active) markers.push({ x: o.position.x, z: o.position.z, color: '#ffc857', kind: 'chest' });
    }
    for (const e of this.ctx.enemies.enemies) {
      if (!e.alive) continue;
      markers.push({ x: e.position.x, z: e.position.z, color: e.def.elite ? '#ff5d6c' : '#ff9d8a', kind: e.def.elite ? 'boss' : 'enemy' });
    }
    const tracker = this.ctx.quests.tracker();
    if (tracker?.hint) markers.push({ x: tracker.hint.x, z: tracker.hint.z, color: '#ffe9a8', kind: 'quest' });
    this.minimap.drawMinimap(
      this.minimapCanvas, this.ctx.player.position, this.ctx.player.facing, markers, 190,
    );
  }

  private updateDamageNumbers(dt: number) {
    const cam = this.ctx.engine.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const d of this.dmgPool) {
      if (!d.used) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.used = false;
        d.el.style.opacity = '0';
        continue;
      }
      const k = 1 - d.life / d.maxLife;
      v.copy(d.pos);
      v.y += k * 1.5;
      v.project(cam);
      if (v.z > 1) {
        d.el.style.opacity = '0';
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * w + d.driftX * k;
      const y = (-v.y * 0.5 + 0.5) * h;
      d.el.style.left = `${x}px`;
      d.el.style.top = `${y}px`;
      d.el.style.opacity = String(clamp(1.6 - k * 1.8, 0, 1));
      const scale = k < 0.15 ? 0.7 + k * 2.6 : 1.05 - (k - 0.15) * 0.12;
      d.el.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(2)})`;
    }
  }

  setVisible(visible: boolean) {
    $('hud').classList.toggle('hidden', !visible);
  }
}
