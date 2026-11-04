/* =========================================================
   AETHERION — playable roster
   ========================================================= */
import type { ElementId } from './elements';

export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';

export interface SkillDef {
  name: string;
  desc: string;
  cooldown: number;
  /** Multiplier applied to ATK. */
  power: number;
  radius: number;
  kind: 'vortex' | 'burst-aoe' | 'dash-strike' | 'shield' | 'beam' | 'heal-field';
  duration: number;
  dots?: number;
  cdText?: string;
}

export interface BurstDef {
  name: string;
  desc: string;
  energyCost: number;
  power: number;
  radius: number;
  kind: 'storm' | 'meteor' | 'nova' | 'sanctuary';
  duration: number;
}

export interface Palette {
  hair: string;
  hairDark: string;
  cloth: string;
  clothDark: string;
  accent: string;
  skin: string;
  metal: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  element: ElementId;
  weapon: WeaponType;
  rarity: 4 | 5;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  moveSpeed: number;
  attackSpeed: number;
  reach: number;
  palette: Palette;
  skill: SkillDef;
  burst: BurstDef;
  quote: string;
  bio: string;
}

export const CHARACTERS: Record<string, CharacterDef> = {
  kael: {
    id: 'kael',
    name: 'KAEL',
    title: 'Rüzgârın Son Kılıcı',
    element: 'anemo',
    weapon: 'sword',
    rarity: 5,
    baseHp: 1200,
    baseAtk: 62,
    baseDef: 24,
    moveSpeed: 4.6,
    attackSpeed: 1.0,
    reach: 2.4,
    palette: {
      hair: '#d9e6ff', hairDark: '#8fa6cc', cloth: '#2c4a72', clothDark: '#16263c',
      accent: '#6fe8c4', skin: '#f0d2bb', metal: '#cfe0f5',
    },
    skill: {
      name: 'Yankı Girdabı', desc: 'Önüne bir rüzgâr girdabı açar; düşmanları içine çeker ve Anemo hasarı verir.',
      cooldown: 6.5, power: 1.9, radius: 4.4, kind: 'vortex', duration: 2.4,
    },
    burst: {
      name: 'Fırtına Yemini', desc: 'Etrafında dönen bir kasırga çağırır: sürekli Anemo hasarı + element yayılımı.',
      energyCost: 60, power: 2.6, radius: 6.5, kind: 'storm', duration: 6,
    },
    quote: '“Rüzgâr nereye eserse, ben oradayım.”',
    bio: 'Yedigök’ün son koruyucusu. Kılıcı, yankıyı kesen bir vadi rüzgârı gibi hareket eder.',
  },
  sera: {
    id: 'sera',
    name: 'SERA',
    title: 'Güneş Kadar Yakın',
    element: 'pyro',
    weapon: 'catalyst',
    rarity: 5,
    baseHp: 980,
    baseAtk: 74,
    baseDef: 18,
    moveSpeed: 4.2,
    attackSpeed: 0.85,
    reach: 8.5,
    palette: {
      hair: '#ffd39a', hairDark: '#c98a4a', cloth: '#7a2430', clothDark: '#3d1018',
      accent: '#ff8a3d', skin: '#f3d3b8', metal: '#ffcf8a',
    },
    skill: {
      name: 'Yakıcı Lotus', desc: 'Ayağının altında bir ateş lotusu açar; alandaki düşmanlar yanar.',
      cooldown: 7.5, power: 2.1, radius: 5.0, kind: 'burst-aoe', duration: 4, dots: 0.22,
    },
    burst: {
      name: 'Güneş Alevi', desc: 'Gökyüzünden bir alev sütunu indirir; geniş alanda Pyro hasarı.',
      energyCost: 70, power: 3.2, radius: 7.5, kind: 'meteor', duration: 2.5,
    },
    quote: '“Bir kıvılcım yeter, gerisi merak.”',
    bio: 'Vadinin ateş kâtibi. Katalizörü, güneşin kendisinden bir parça gibi yanar.',
  },
  rin: {
    id: 'rin',
    name: 'RIN',
    title: 'Sessiz Kıvılcım',
    element: 'electro',
    weapon: 'polearm',
    rarity: 4,
    baseHp: 1050,
    baseAtk: 68,
    baseDef: 22,
    moveSpeed: 4.8,
    attackSpeed: 1.12,
    reach: 2.9,
    palette: {
      hair: '#c9b6ff', hairDark: '#7a63b8', cloth: '#2b2350', clothDark: '#141024',
      accent: '#b98cff', skin: '#ecd0c2', metal: '#cfc4ff',
    },
    skill: {
      name: 'Zincir Kıvılcım', desc: 'En yakın hedefe elektrik atar, 3 hedefe zincirlenir.',
      cooldown: 5.5, power: 1.5, radius: 7.0, kind: 'beam', duration: 0.4,
    },
    burst: {
      name: 'Fırtına Çağrısı', desc: 'Alanda sürekli elektrik boşalması; Elektrik Çarpması tetikler.',
      energyCost: 55, power: 2.2, radius: 6.0, kind: 'storm', duration: 5.5,
    },
    quote: '“Gök gürültüsünü duymadan şimşek çaktı.”',
    bio: 'Yıldırım vadilerinde yetişmiş bir mızrak ustası. Sessiz, hızlı, acımasız derecede dikkatli.',
  },
  bora: {
    id: 'bora',
    name: 'BORA',
    title: 'Kışın Ağırlığı',
    element: 'cryo',
    weapon: 'claymore',
    rarity: 4,
    baseHp: 1500,
    baseAtk: 78,
    baseDef: 34,
    moveSpeed: 3.9,
    attackSpeed: 0.68,
    reach: 3.1,
    palette: {
      hair: '#a9d8ff', hairDark: '#5d87b0', cloth: '#1e3346', clothDark: '#0d1822',
      accent: '#9fe8ff', skin: '#e8cdbd', metal: '#dff2ff',
    },
    skill: {
      name: 'Donmuş Zırh', desc: 'Etrafına buz kalkanı örer ve yakındaki düşmanları dondurur.',
      cooldown: 9.0, power: 1.4, radius: 3.8, kind: 'shield', duration: 6,
    },
    burst: {
      name: 'Kış Uykusu', desc: 'Alanda kar fırtınası; sürekli Cryo hasarı ve yavaşlatma.',
      energyCost: 60, power: 2.0, radius: 6.8, kind: 'nova', duration: 6,
    },
    quote: '“Soğuk, sabırlı olanındır.”',
    bio: 'Kuzey buzullarından gelen ağır kılıç ustası. Attığı her adım karı ezerek ilerler.',
  },
};

export const PARTY_ORDER = ['kael', 'sera', 'rin', 'bora'] as const;

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? CHARACTERS.kael;
}

export const WEAPON_LABEL: Record<WeaponType, string> = {
  sword: 'Tek El Kılıç',
  claymore: 'Çift El Kılıç',
  polearm: 'Mızrak',
  bow: 'Yay',
  catalyst: 'Katalizör',
};
