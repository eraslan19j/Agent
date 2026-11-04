/* =========================================================
   AETHERION — bestiary
   ========================================================= */
import type { ElementId } from './elements';

export type EnemyModel = 'humanoid' | 'blob' | 'golem' | 'spirit' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  model: EnemyModel;
  element: ElementId;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  windup: number;
  xp: number;
  mora: number;
  elite: boolean;
  ranged?: { projectileSpeed: number; count: number };
  scale: number;
  color: { body: string; accent: string; glow: string };
  drops?: { id: string; chance: number; min: number; max: number }[];
  behavior: 'melee' | 'ranged' | 'charger' | 'boss';
}

export const ENEMIES: Record<string, EnemyDef> = {
  husk: {
    id: 'husk', name: 'Gölge Sürüngeni', model: 'humanoid', element: 'none',
    hp: 420, atk: 44, def: 12, speed: 3.4, aggroRange: 15, attackRange: 2.6,
    attackCooldown: 2.0, windup: 0.42, xp: 24, mora: 18, elite: false, scale: 1,
    color: { body: '#2b3244', accent: '#5d6c8a', glow: '#8fb6ff' },
    drops: [{ id: 'mora', chance: 1, min: 8, max: 22 }, { id: 'crystal', chance: 0.12, min: 1, max: 1 }],
    behavior: 'melee',
  },
  wisp: {
    id: 'wisp', name: 'Yankı Ateşi', model: 'spirit', element: 'pyro',
    hp: 280, atk: 36, def: 6, speed: 2.8, aggroRange: 19, attackRange: 12,
    attackCooldown: 2.6, windup: 0.7, xp: 20, mora: 14, elite: false, scale: 0.9,
    color: { body: '#4a2418', accent: '#ff8a3d', glow: '#ffb066' },
    ranged: { projectileSpeed: 16, count: 1 },
    drops: [{ id: 'mora', chance: 1, min: 6, max: 16 }],
    behavior: 'ranged',
  },
  slime_cryo: {
    id: 'slime_cryo', name: 'Buzlu Yankı', model: 'blob', element: 'cryo',
    hp: 240, atk: 30, def: 4, speed: 3.0, aggroRange: 13, attackRange: 2.2,
    attackCooldown: 2.4, windup: 0.5, xp: 16, mora: 12, elite: false, scale: 1,
    color: { body: '#7fc8e8', accent: '#cdf3ff', glow: '#9fe8ff' },
    drops: [{ id: 'mora', chance: 1, min: 5, max: 14 }],
    behavior: 'charger',
  },
  slime_electro: {
    id: 'slime_electro', name: 'Kıvılcım Yankısı', model: 'blob', element: 'electro',
    hp: 250, atk: 32, def: 4, speed: 3.2, aggroRange: 13, attackRange: 2.2,
    attackCooldown: 2.2, windup: 0.45, xp: 17, mora: 13, elite: false, scale: 1,
    color: { body: '#6b4fa8', accent: '#dcc4ff', glow: '#b98cff' },
    drops: [{ id: 'mora', chance: 1, min: 5, max: 15 }],
    behavior: 'charger',
  },
  sentinel: {
    id: 'sentinel', name: 'Taş Muhafız', model: 'golem', element: 'geo',
    hp: 2800, atk: 86, def: 60, speed: 2.4, aggroRange: 17, attackRange: 3.6,
    attackCooldown: 2.8, windup: 0.72, xp: 180, mora: 140, elite: true, scale: 1.5,
    color: { body: '#5b5347', accent: '#ffc857', glow: '#ffe6a8' },
    drops: [
      { id: 'mora', chance: 1, min: 80, max: 160 },
      { id: 'crystal', chance: 1, min: 2, max: 4 },
      { id: 'artifact', chance: 0.75, min: 1, max: 1 },
    ],
    behavior: 'melee',
  },
  warden: {
    id: 'warden', name: 'Yedigök Bekçisi', model: 'boss', element: 'electro',
    hp: 14000, atk: 140, def: 90, speed: 2.9, aggroRange: 26, attackRange: 4.6,
    attackCooldown: 2.2, windup: 0.8, xp: 900, mora: 600, elite: true, scale: 2.6,
    color: { body: '#232a3d', accent: '#b98cff', glow: '#dcc4ff' },
    drops: [
      { id: 'mora', chance: 1, min: 400, max: 700 },
      { id: 'primogem', chance: 1, min: 20, max: 40 },
      { id: 'artifact', chance: 1, min: 1, max: 2 },
    ],
    behavior: 'boss',
  },
};

export const ELITE_IDS = ['sentinel', 'warden'];

/** Enemy spawn camps — fixed, deterministic world content. */
export interface CampDef {
  id: string;
  x: number;
  z: number;
  enemies: string[];
  radius: number;
  respawn: number;
}

export const CAMPS: CampDef[] = [
  { id: 'camp_a', x: 24, z: 8, enemies: ['husk', 'husk', 'slime_cryo'], radius: 7, respawn: 75 },
  { id: 'camp_b', x: -46, z: 32, enemies: ['wisp', 'husk', 'slime_electro'], radius: 8, respawn: 80 },
  { id: 'camp_c', x: 68, z: -52, enemies: ['husk', 'husk', 'wisp', 'slime_cryo'], radius: 9, respawn: 90 },
  { id: 'camp_d', x: -88, z: -70, enemies: ['slime_electro', 'slime_electro', 'husk'], radius: 7, respawn: 80 },
  { id: 'camp_e', x: 118, z: 64, enemies: ['wisp', 'wisp', 'slime_cryo'], radius: 9, respawn: 95 },
  { id: 'camp_f', x: -140, z: 96, enemies: ['sentinel'], radius: 8, respawn: 180 },
  { id: 'camp_g', x: 168, z: -128, enemies: ['husk', 'wisp', 'slime_electro', 'husk'], radius: 10, respawn: 100 },
  { id: 'boss_arena', x: 0, z: -205, enemies: ['warden'], radius: 22, respawn: 400 },
];
