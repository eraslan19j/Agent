/* =========================================================
   AETHERION — quest director
   ========================================================= */
import { QUESTS, type QuestDef, type ObjectiveDef } from '../data/quests';
import { LANDMARKS } from '../data/world';
import type { QuestSave } from '../core/save';
import type { GameContext } from '../game/types';

export interface TrackerObjective {
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export interface TrackerInfo {
  title: string;
  chapter: string;
  objectives: TrackerObjective[];
  hint?: { x: number; z: number; label: string } | null;
  allDone: boolean;
}

export class QuestSystem {
  private ctx!: GameContext;

  init(ctx: GameContext) {
    this.ctx = ctx;
    if (!ctx.save.data.quests) ctx.save.data.quests = {};
    // seed the first quest
    if (!this.state(QUESTS[0].id)) {
      ctx.save.data.quests[QUESTS[0].id] = { stage: 0, progress: 0, completed: false };
      ctx.save.markDirty();
    }
  }

  state(id: string): QuestSave | undefined {
    return this.ctx.save.data.quests[id];
  }

  current(): QuestDef | undefined {
    for (const q of QUESTS) {
      const s = this.state(q.id);
      if (!s || !s.completed) return q;
    }
    return undefined;
  }

  private currentSave(q: QuestDef): QuestSave {
    let s = this.state(q.id);
    if (!s) {
      s = { stage: 0, progress: 0, completed: false };
      this.ctx.save.data.quests[q.id] = s;
    }
    return s;
  }

  private objective(q: QuestDef, s: QuestSave): ObjectiveDef | undefined {
    return q.objectives[s.stage];
  }

  progressEvent(type: 'kill' | 'chest' | 'collect' | 'waypoint' | 'boss', data: { id?: string; type?: string; amount?: number; elite?: boolean }) {
    const q = this.current();
    if (!q) return;
    const s = this.currentSave(q);
    const obj = this.objective(q, s);
    if (!obj) return;

    let match = false;
    let inc = 1;
    switch (type) {
      case 'kill': {
        if (obj.type !== 'kill') break;
        const target = obj.target ?? 'any';
        if (target === 'any') match = true;
        else if (target === 'elite') match = !!data.elite;
        else match = target === data.type;
        break;
      }
      case 'boss':
        match = obj.type === 'boss';
        break;
      case 'chest':
        match = obj.type === 'chest';
        break;
      case 'waypoint':
        match = obj.type === 'waypoint' && obj.target === data.id;
        break;
      case 'collect':
        if (obj.type !== 'collect') break;
        match = !obj.target || obj.target === data.id;
        inc = data.amount ?? 1;
        break;
    }
    if (!match) return;
    this.advance(q, s, inc);
  }

  private advance(q: QuestDef, s: QuestSave, inc: number) {
    const obj = q.objectives[s.stage];
    if (!obj) return;
    s.progress += inc;
    if (s.progress >= obj.count) {
      s.progress = 0;
      s.stage++;
      this.ctx.audio.pickup();
      if (s.stage >= q.objectives.length) {
        this.complete(q, s);
        return;
      }
      this.ctx.notify(`Hedef tamam: ${q.objectives[s.stage].label}`, '◈');
    }
    this.ctx.events.emit('quest:updated', { questId: q.id });
    this.ctx.save.markDirty();
  }

  private complete(q: QuestDef, s: QuestSave) {
    s.completed = true;
    s.stage = q.objectives.length;
    const r = q.rewards;
    this.ctx.inventory.add('mora', r.mora, false);
    if (r.primogem) this.ctx.inventory.add('primogem', r.primogem, false);
    if (r.item) this.ctx.inventory.add(r.item.id as any, r.item.amount, false);
    this.ctx.player.addXp(r.xp, this.ctx);
    this.ctx.audio.levelUp();
    this.ctx.effects.ring(this.ctx.player.position.clone(), '#ffe9a8', 0.6, 6, 1.0, true);
    this.ctx.notify(`Görev tamamlandı: ${q.title} (+${r.mora} Mora)`, '✓');
    this.ctx.events.emit('quest:completed', { questId: q.id });
    this.ctx.save.markDirty();

    // start the next quest
    const next = this.current();
    if (next) {
      this.currentSave(next);
      this.ctx.notify(`Yeni görev: ${next.title}`, '◈');
    }
  }

  update(dt: number) {
    const q = this.current();
    if (!q) return;
    const s = this.currentSave(q);
    const obj = this.objective(q, s);
    if (!obj || obj.type !== 'reach' || !obj.pos) return;
    const p = this.ctx.player.position;
    const d = Math.hypot(p.x - obj.pos.x, p.z - obj.pos.z);
    if (d <= (obj.radius ?? 6)) {
      this.advance(q, s, 1);
    }
  }

  /** Data for the HUD tracker and the compass. */
  tracker(): TrackerInfo | null {
    const q = this.current();
    if (!q) return null;
    const s = this.currentSave(q);
    const objectives = q.objectives.map((o, i) => ({
      label: o.label,
      current: i < s.stage ? o.count : i === s.stage ? s.progress : 0,
      target: o.count,
      done: i < s.stage,
    }));
    const obj = this.objective(q, s);
    let hint: TrackerInfo['hint'] = null;
    if (obj) {
      if (obj.type === 'reach' && obj.pos) hint = { x: obj.pos.x, z: obj.pos.z, label: obj.label };
      else if (obj.type === 'waypoint') {
        const lm = LANDMARKS.find((l) => l.id === obj.target);
        if (lm) hint = { x: lm.x, z: lm.z, label: lm.name };
      } else if (obj.type === 'chest') {
        const chest = this.ctx.world.objects.find((o) => o.kind === 'chest' && o.active);
        if (chest) hint = { x: chest.position.x, z: chest.position.z, label: 'Sandık' };
      } else if (obj.type === 'collect') {
        const node = this.ctx.world.objects.find((o) => (o.kind === 'bloom' || o.kind === 'ore') && o.active);
        if (node) hint = { x: node.position.x, z: node.position.z, label: node.name };
      } else if (obj.type === 'kill') {
        const e = this.ctx.enemies.nearest(this.ctx.player.position, 260);
        if (e) hint = { x: e.position.x, z: e.position.z, label: e.def.name };
      }
    }
    return { title: q.title, chapter: q.chapter, objectives, hint, allDone: false };
  }

  /** Progress summary for the pause / journal screen. */
  summary() {
    return QUESTS.map((q) => ({
      def: q,
      state: this.state(q.id) ?? { stage: 0, progress: 0, completed: false },
      isCurrent: this.current()?.id === q.id,
    }));
  }
}
