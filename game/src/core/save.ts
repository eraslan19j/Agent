/* =========================================================
   AETHERION — persistence
   localStorage-backed save slot with safe defaults + migration.
   ========================================================= */

export interface CharacterSave {
  id: string;
  level: number;
  xp: number;
  hp: number;
  talentLv: number;
}

export interface SettingsSave {
  quality: 'low' | 'medium' | 'high';
  bloom: boolean;
  shadows: boolean;
  sensitivity: number;
  invertY: boolean;
  master: number;
  sfx: number;
  music: number;
  showFps: boolean;
  showDamageNumbers: boolean;
  autoTarget: boolean;
  language: 'tr' | 'en';
  leftHanded: boolean;
}

export interface QuestSave {
  stage: number;
  progress: number;
  completed: boolean;
}

export interface SaveData {
  version: number;
  hasSave: boolean;
  createdAt: number;
  updatedAt: number;
  playtime: number;
  player: {
    name: string;
    level: number;
    xp: number;
    xpNext: number;
    mora: number;
    primogems: number;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    critRate: number;
    critDmg: number;
    staminaMax: number;
    position: { x: number; z: number };
    respawn: { x: number; z: number };
  };
  party: CharacterSave[];
  activeChar: number;
  waypoints: string[];
  chests: string[];
  collectibles: Record<string, number>;
  collectiblesTaken: string[];
  quests: Record<string, QuestSave>;
  stats: { kills: number; deaths: number; chests: number; distance: number; reactions: number };
  settings: SettingsSave;
  world: { time: number };
}

export const SAVE_KEY = 'aetherion.save.v1';
export const SAVE_VERSION = 1;

export function defaultSettings(): SettingsSave {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return {
    quality: mobile ? 'medium' : 'high',
    bloom: !mobile,
    shadows: true,
    sensitivity: 1,
    invertY: false,
    master: 0.85,
    sfx: 0.9,
    music: 0.4,
    showFps: false,
    showDamageNumbers: true,
    autoTarget: true,
    language: 'tr',
    leftHanded: false,
  };
}

export function newSave(): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    hasSave: false,
    createdAt: now,
    updatedAt: now,
    playtime: 0,
    player: {
      name: 'Gözcü',
      level: 1,
      xp: 0,
      xpNext: 100,
      mora: 0,
      primogems: 0,
      hp: 1200,
      maxHp: 1200,
      atk: 62,
      def: 24,
      critRate: 0.08,
      critDmg: 0.55,
      staminaMax: 100,
      position: { x: 6, z: 34 },
      respawn: { x: 6, z: 34 },
    },
    party: [
      { id: 'kael', level: 1, xp: 0, hp: 1200, talentLv: 1 },
      { id: 'sera', level: 1, xp: 0, hp: 980, talentLv: 1 },
      { id: 'rin', level: 1, xp: 0, hp: 1050, talentLv: 1 },
      { id: 'bora', level: 1, xp: 0, hp: 1500, talentLv: 1 },
    ],
    activeChar: 0,
    waypoints: [],
    chests: [],
    collectibles: {},
    collectiblesTaken: [],
    quests: {},
    stats: { kills: 0, deaths: 0, chests: 0, distance: 0, reactions: 0 },
    settings: defaultSettings(),
    world: { time: 8 * 60 },
  };
}

function mergeDefaults(base: any, incoming: any): any {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return incoming ?? base;
  const out: any = { ...base };
  for (const key of Object.keys(incoming ?? {})) {
    if (key in base) out[key] = mergeDefaults(base[key], incoming[key]);
    else out[key] = incoming[key];
  }
  return out;
}

export class SaveSystem {
  data: SaveData = newSave();
  private dirty = false;
  private saveTimer = 0;
  available = true;

  constructor() {
    try {
      localStorage.setItem('__ae_test', '1');
      localStorage.removeItem('__ae_test');
    } catch {
      this.available = false;
    }
  }

  load(): SaveData | null {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const merged = mergeDefaults(newSave(), parsed) as SaveData;
      merged.version = SAVE_VERSION;
      this.data = merged;
      return merged;
    } catch (err) {
      console.warn('[save] load failed', err);
      return null;
    }
  }

  hasSave() {
    return this.available && !!localStorage.getItem(SAVE_KEY);
  }

  markDirty() {
    this.dirty = true;
  }

  tick(dt: number) {
    this.saveTimer += dt;
    if (this.dirty && this.saveTimer > 4) this.flush();
  }

  flush() {
    if (!this.available) return;
    this.saveTimer = 0;
    this.dirty = false;
    try {
      this.data.updatedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[save] write failed', err);
    }
  }

  wipe() {
    this.data = newSave();
    if (this.available) localStorage.removeItem(SAVE_KEY);
  }

  exportText() {
    return JSON.stringify(this.data);
  }

  importText(text: string) {
    const parsed = JSON.parse(text);
    this.data = mergeDefaults(newSave(), parsed);
    this.flush();
  }
}
