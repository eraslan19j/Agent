/* =========================================================
   AETHERION — elements & reaction matrix
   Pure data + pure resolver (unit-testable, no THREE dependency).
   ========================================================= */

export type ElementId = 'pyro' | 'hydro' | 'electro' | 'cryo' | 'anemo' | 'geo' | 'dendro' | 'none';

export interface ElementMeta {
  id: ElementId;
  name: string;
  short: string;
  color: string;
  colorHex: number;
  glow: string;
  glyph: string;
  blurb: string;
}

export const ELEMENTS: Record<ElementId, ElementMeta> = {
  pyro: {
    id: 'pyro', name: 'Ateş', short: 'PYRO', color: '#ff6b3d', colorHex: 0xff6b3d, glow: '#ffb08a', glyph: '🔥',
    blurb: 'Yakıcı irade. Ateş, sürekli hasar bırakır ve buz/su ile yıkıcı tepkimeler kurar.',
  },
  hydro: {
    id: 'hydro', name: 'Su', short: 'HYDRO', color: '#4fb8ff', colorHex: 0x4fb8ff, glow: '#a9dcff', glyph: '💧',
    blurb: 'Akışkan hafıza. Su, ıslatır; ateşle buharlaşır, elektrikle zincirlenir, buzdan donar.',
  },
  electro: {
    id: 'electro', name: 'Elektrik', short: 'ELECTRO', color: '#b98cff', colorHex: 0xb98cff, glow: '#dcc4ff', glyph: '⚡',
    blurb: 'Kıvılcımlı hız. Elektrik zincirler, aşırı yükler ve süper iletken yaratır.',
  },
  cryo: {
    id: 'cryo', name: 'Buz', short: 'CRYO', color: '#9fe8ff', colorHex: 0x9fe8ff, glow: '#dcf7ff', glyph: '❄',
    blurb: 'Sessiz keskinlik. Buz yavaşlatır, dondurur; ateşle erir, elektrikle süper iletken olur.',
  },
  anemo: {
    id: 'anemo', name: 'Rüzgâr', short: 'ANEMO', color: '#6fe8c4', colorHex: 0x6fe8c4, glow: '#b9ffe8', glyph: '🌀',
    blurb: 'Özgür yankı. Rüzgâr elementleri savurur, düşmanı toplar ve sürüklenmeyi besler.',
  },
  geo: {
    id: 'geo', name: 'Toprak', short: 'GEO', color: '#ffc857', colorHex: 0xffc857, glow: '#ffe6a8', glyph: '⛰',
    blurb: 'Sarsılmaz yapı. Toprak kristal kalkanlar üretir ve zırhı kırar.',
  },
  dendro: {
    id: 'dendro', name: 'Doğa', short: 'DENDRO', color: '#9ede6a', colorHex: 0x9ede6a, glyph: '🌿', glow: '#d6ffb0',
    blurb: 'Büyüyen bellek. Doğa filizlenir; suyla çiçeklenir, ateşle yanar.',
  },
  none: {
    id: 'none', name: 'Fiziksel', short: 'FIZ', color: '#dfe8f7', colorHex: 0xdfe8f7, glow: '#ffffff', glyph: '✦',
    blurb: 'Element taşımayan saf darbe.',
  },
};

export type ReactionId =
  | 'vaporize'
  | 'melt'
  | 'overload'
  | 'electrocharged'
  | 'superconduct'
  | 'frozen'
  | 'swirl'
  | 'crystallize'
  | 'bloom'
  | 'burning'
  | 'quicken'
  | 'none';

export interface ReactionResult {
  id: ReactionId;
  name: string;
  color: string;
  /** Damage multiplier applied to the triggering hit. */
  mult: number;
  /** AoE burst (radius in metres, damage as fraction of the hit). */
  aoe?: { radius: number; factor: number; element: ElementId; knockback: number };
  /** Debuff duration in seconds. */
  statusDuration?: number;
  /** Damage-over-time ticks. */
  dot?: { dps: number; duration: number; element: ElementId };
  /** Hard crowd control duration (frozen / staggered). */
  stun?: number;
  /** Anemo spread radius. */
  spread?: number;
  /** Shield amount as a fraction of dealt damage. */
  shield?: number;
  /** Consumes the existing aura. */
  consumes: boolean;
  text: string;
}

const NONE: ReactionResult = { id: 'none', name: '', color: '#fff', mult: 1, consumes: false, text: '' };

const R = {
  vaporize: (strong: boolean): ReactionResult => ({
    id: 'vaporize', name: 'BUHARLAŞMA', color: '#ffd2a8', mult: strong ? 2 : 1.5,
    aoe: { radius: 1.6, factor: 0.25, element: 'pyro', knockback: 0.4 },
    consumes: true, text: 'Buharlaşma!',
  }),
  melt: (strong: boolean): ReactionResult => ({
    id: 'melt', name: 'ERİME', color: '#ffb47a', mult: strong ? 2 : 1.5,
    aoe: { radius: 1.4, factor: 0.2, element: 'pyro', knockback: 0.2 },
    consumes: true, text: 'Erime!',
  }),
  overload: (): ReactionResult => ({
    id: 'overload', name: 'AŞIRI YÜK', color: '#ff9d6b', mult: 1,
    aoe: { radius: 4.2, factor: 0.9, element: 'pyro', knockback: 3.2 },
    stun: 0.5, consumes: true, text: 'Aşırı Yük!',
  }),
  electrocharged: (): ReactionResult => ({
    id: 'electrocharged', name: 'ELEKTRİK ÇARPMASI', color: '#b98cff', mult: 1,
    aoe: { radius: 3.0, factor: 0.3, element: 'electro', knockback: 0.2 },
    dot: { dps: 0.22, duration: 4, element: 'electro' }, consumes: false, text: 'Elektrik Çarpması!',
  }),
  superconduct: (): ReactionResult => ({
    id: 'superconduct', name: 'SÜPER İLETKEN', color: '#9fe8ff', mult: 0.9,
    aoe: { radius: 3.4, factor: 0.4, element: 'cryo', knockback: 0.6 },
    statusDuration: 8, consumes: true, text: 'Süper İletken!',
  }),
  frozen: (): ReactionResult => ({
    id: 'frozen', name: 'DONMA', color: '#cdf3ff', mult: 0.6, stun: 2.0, consumes: true, text: 'Dondu!',
  }),
  swirl: (el: ElementId): ReactionResult => ({
    id: 'swirl', name: 'GİRDAP', color: ELEMENTS[el].color, mult: 0.7,
    aoe: { radius: 4.5, factor: 0.55, element: el, knockback: 1.4 }, spread: 4.5, consumes: true, text: 'Girdap!',
  }),
  crystallize: (el: ElementId): ReactionResult => ({
    id: 'crystallize', name: 'KRİSTALLEŞME', color: ELEMENTS[el].color, mult: 1,
    shield: 0.4, consumes: true, text: 'Kristal Kalkan',
  }),
  bloom: (): ReactionResult => ({
    id: 'bloom', name: 'ÇİÇEKLENME', color: '#9ede6a', mult: 1,
    aoe: { radius: 3.2, factor: 1.4, element: 'dendro', knockback: 0.8 }, consumes: true, text: 'Çiçeklenme!',
  }),
  burning: (): ReactionResult => ({
    id: 'burning', name: 'YANMA', color: '#ff8a4c', mult: 1,
    dot: { dps: 0.35, duration: 5, element: 'pyro' }, consumes: false, text: 'Yanıyor!',
  }),
  quicken: (): ReactionResult => ({
    id: 'quicken', name: 'HIZLANMA', color: '#c9f08a', mult: 1.25,
    dot: { dps: 0.15, duration: 6, element: 'dendro' }, consumes: false, text: 'Hızlanma!',
  }),
};

/**
 * Resolve an elemental reaction.
 * @param aura element already applied to the target (null if clean)
 * @param incoming element of the hit that landed
 */
export function resolveReaction(aura: ElementId | null, incoming: ElementId): ReactionResult {
  if (!aura || aura === 'none' || incoming === 'none' || aura === incoming) return NONE;
  const a = aura, i = incoming;
  const pair = (x: ElementId, y: ElementId) => (a === x && i === y) || (a === y && i === x);

  if (pair('hydro', 'pyro')) return R.vaporize(a === 'hydro');
  if (pair('cryo', 'pyro')) return R.melt(a === 'cryo');
  if (pair('electro', 'pyro')) return R.overload();
  if (pair('electro', 'hydro')) return R.electrocharged();
  if (pair('electro', 'cryo')) return R.superconduct();
  if (pair('cryo', 'hydro')) return R.frozen();
  if (pair('dendro', 'hydro')) return R.bloom();
  if (pair('dendro', 'pyro')) return R.burning();
  if (pair('dendro', 'electro')) return R.quicken();

  if (i === 'anemo' && a !== 'anemo' && a !== 'geo' && a !== 'dendro') return R.swirl(a);
  if (i === 'geo' && a !== 'geo' && a !== 'anemo' && a !== 'dendro') return R.crystallize(a);

  return NONE;
}

/** Which aura remains on a target after a hit. */
export function nextAura(aura: ElementId | null, incoming: ElementId, reaction: ReactionResult): ElementId | null {
  if (incoming === 'none') return aura;
  if (reaction.id === 'none') return incoming;
  if (reaction.id === 'electrocharged' || reaction.id === 'burning' || reaction.id === 'quicken') return incoming;
  if (reaction.id === 'swirl' || reaction.id === 'crystallize') return null;
  return null;
}

export const REACTION_CODEX: { id: ReactionId; name: string; pair: string; text: string; color: string }[] = [
  { id: 'vaporize', name: 'Buharlaşma', pair: 'Su + Ateş', text: 'Ateş suyu buharlaştırır: ×2 hasar. Su, ateşin üstüne gelirse ×1.5.', color: '#ffd2a8' },
  { id: 'melt', name: 'Erime', pair: 'Buz + Ateş', text: 'Ateş buzu eritir: ×2 hasar. Buz, ateşin üstüne gelirse ×1.5.', color: '#ffb47a' },
  { id: 'overload', name: 'Aşırı Yük', pair: 'Ateş + Elektrik', text: 'Patlama yaratır, çevredeki düşmanları savurur ve sersemletir.', color: '#ff9d6b' },
  { id: 'electrocharged', name: 'Elektrik Çarpması', pair: 'Su + Elektrik', text: 'Yakındaki ıslak hedeflere zincirlenen sürekli elektrik hasarı.', color: '#b98cff' },
  { id: 'superconduct', name: 'Süper İletken', pair: 'Buz + Elektrik', text: 'Buz patlaması + 8 saniye savunma kırılması.', color: '#9fe8ff' },
  { id: 'frozen', name: 'Donma', pair: 'Su + Buz', text: 'Hedefi 2 saniye tamamen dondurur — ağır silahla kırılabilir.', color: '#cdf3ff' },
  { id: 'swirl', name: 'Girdap', pair: 'Rüzgâr + Herhangi', text: 'Elementi çevreye yayar ve hedefleri merkeze çeker.', color: '#6fe8c4' },
  { id: 'crystallize', name: 'Kristalleşme', pair: 'Toprak + Herhangi', text: 'Element kalkanı üretir; hasarı emer.', color: '#ffc857' },
  { id: 'bloom', name: 'Çiçeklenme', pair: 'Doğa + Su', text: 'Gecikmeli doğa patlaması oluşturur.', color: '#9ede6a' },
  { id: 'burning', name: 'Yanma', pair: 'Doğa + Ateş', text: 'Yanan zemin sürekli ateş hasarı verir.', color: '#ff8a4c' },
];
