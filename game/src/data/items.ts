/* =========================================================
   AETHERION — items, loot tables, chests
   ========================================================= */
import type { Rng } from '../core/utils';
import { rngInt } from '../core/utils';

export type ItemId =
  | 'mora'
  | 'primogem'
  | 'aetherbloom'
  | 'crystal'
  | 'key'
  | 'artifact'
  | 'fur'
  | 'core';

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  icon: string;
  color: string;
  stack: number;
  rarity: 1 | 2 | 3 | 4 | 5;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  mora: { id: 'mora', name: 'Mora', desc: 'Aetheria’nın ortak parası. Yükseltmelerde kullanılır.', icon: '◉', color: '#e8c983', stack: 999999, rarity: 1 },
  primogem: { id: 'primogem', name: 'Yıldız Taşı', desc: 'Nadir kristal. Gelecek sürümlerde kader çağrısı için.', icon: '✦', color: '#b98cff', stack: 99999, rarity: 2 },
  aetherbloom: { id: 'aetherbloom', name: 'Yankı Çiçeği', desc: 'Yenilebilir. 320 can yeniler.', icon: '✿', color: '#6fe8c4', stack: 99, rarity: 2 },
  crystal: { id: 'crystal', name: 'Yankı Kristali', desc: 'Yükseltme malzemesi. Silah ve yetenek geliştirmede kullanılır.', icon: '◆', color: '#4fb8ff', stack: 999, rarity: 2 },
  key: { id: 'key', name: 'Vadi Anahtarı', desc: 'Değerli sandıkları açar.', icon: '⚿', color: '#ffc857', stack: 99, rarity: 3 },
  artifact: { id: 'artifact', name: 'Yankı Parçası', desc: 'Nadir yadigâr. Saldırı ve canı kalıcı olarak artırır.', icon: '✧', color: '#ffdca0', stack: 999, rarity: 4 },
  fur: { id: 'fur', name: 'Gölge Tüyü', desc: 'Gölge yaratıklarından düşer.', icon: '〜', color: '#8fb6ff', stack: 999, rarity: 1 },
  core: { id: 'core', name: 'Yedigök Özü', desc: 'Bekçi’nin kalbinden kopan element özü.', icon: '❂', color: '#ff8a3d', stack: 99, rarity: 5 },
};

export type ChestTier = 'common' | 'exquisite' | 'precious' | 'luxurious';

export interface ChestDef {
  tier: ChestTier;
  label: string;
  color: number;
  loot: { id: ItemId; min: number; max: number; chance: number }[];
  xp: number;
}

export const CHESTS: Record<ChestTier, ChestDef> = {
  common: {
    tier: 'common', label: 'Sıradan Sandık', color: 0x9a7b4a, xp: 12,
    loot: [
      { id: 'mora', min: 40, max: 90, chance: 1 },
      { id: 'aetherbloom', min: 1, max: 2, chance: 0.5 },
      { id: 'fur', min: 1, max: 2, chance: 0.4 },
    ],
  },
  exquisite: {
    tier: 'exquisite', label: 'Zarif Sandık', color: 0x6f9fd8, xp: 26,
    loot: [
      { id: 'mora', min: 110, max: 220, chance: 1 },
      { id: 'crystal', min: 1, max: 3, chance: 0.9 },
      { id: 'aetherbloom', min: 1, max: 3, chance: 0.7 },
      { id: 'key', min: 1, max: 1, chance: 0.2 },
    ],
  },
  precious: {
    tier: 'precious', label: 'Değerli Sandık', color: 0xb98cff, xp: 55,
    loot: [
      { id: 'mora', min: 240, max: 460, chance: 1 },
      { id: 'crystal', min: 2, max: 5, chance: 1 },
      { id: 'key', min: 1, max: 2, chance: 0.5 },
      { id: 'artifact', min: 1, max: 1, chance: 0.35 },
      { id: 'primogem', min: 2, max: 6, chance: 0.6 },
    ],
  },
  luxurious: {
    tier: 'luxurious', label: 'Görkemli Sandık', color: 0xffc857, xp: 120,
    loot: [
      { id: 'mora', min: 500, max: 900, chance: 1 },
      { id: 'crystal', min: 4, max: 8, chance: 1 },
      { id: 'artifact', min: 1, max: 2, chance: 0.9 },
      { id: 'primogem', min: 8, max: 20, chance: 1 },
      { id: 'core', min: 1, max: 1, chance: 0.2 },
    ],
  },
};

export interface LootRoll {
  id: ItemId;
  amount: number;
}

export function rollLoot(rng: Rng, tier: ChestTier): LootRoll[] {
  const def = CHESTS[tier];
  const out: LootRoll[] = [];
  for (const entry of def.loot) {
    if (rng() <= entry.chance) {
      out.push({ id: entry.id, amount: rngInt(rng, entry.min, entry.max) });
    }
  }
  return out;
}

/** XP required to reach next level. */
export function xpForLevel(level: number) {
  return Math.round(100 * Math.pow(level, 1.42));
}

export const LEVEL_GAINS = {
  hp: 105,
  atk: 6,
  def: 3.2,
};
