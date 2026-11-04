/* =========================================================
   AETHERION — world layout constants & landmarks
   Everything the map, quests, POIs and terrain shaping share.
   ========================================================= */

export const WORLD = {
  /** half extent in metres */
  half: 480,
  chunkSize: 64,
  waterLevel: 0,
  seed: 20261104,
  viewChunks: 3,
};

export interface Landmark {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: 'statue' | 'boss' | 'camp' | 'poi' | 'summit' | 'coast';
  radius: number;
  flat?: boolean;
  blurb?: string;
}

export const LANDMARKS: Landmark[] = [
  { id: 'statue_dawn', name: 'Uyanış Taşı', x: 12, z: 22, kind: 'statue', radius: 12, flat: true, blurb: 'Gözcü’nün ilk mühür taşı. Vadiye açılan kapı.' },
  { id: 'statue_summit', name: 'Zirve Mührü', x: 156, z: -176, kind: 'summit', radius: 14, flat: true, blurb: 'Yedigök’ün en yüksek noktası; tüm vadi ayaklarının altında.' },
  { id: 'statue_coast', name: 'Kıyı Mührü', x: -168, z: 118, kind: 'coast', radius: 12, flat: true, blurb: 'Sisli kıyıda, dalgaların kestiği eski bir sunak.' },
  { id: 'boss_arena', name: 'Bekçi Alanı', x: 0, z: -205, kind: 'boss', radius: 30, flat: true, blurb: 'Yedigök Bekçisi’nin uyuduğu çökük arena.' },
  { id: 'spawn', name: 'Başlangıç', x: 8, z: 34, kind: 'poi', radius: 18, flat: true, blurb: 'Yolculuğun başladığı çayır.' },
  { id: 'lake', name: 'Sisli Göl', x: -140, z: 130, kind: 'coast', radius: 95, blurb: 'Derin, soğuk ve sessiz.' },
];

export const FLAT_ZONES = LANDMARKS.filter((l) => l.flat);

export function landmark(id: string): Landmark {
  const found = LANDMARKS.find((l) => l.id === id);
  if (!found) throw new Error(`unknown landmark ${id}`);
  return found;
}

export const SPAWN = { x: 8, z: 34 };

export type Biome = 'sand' | 'meadow' | 'forest' | 'highland' | 'snow' | 'ash' | 'water';

export const BIOME_COLORS: Record<Biome, [number, number, number]> = {
  sand: [0.83, 0.76, 0.56],
  meadow: [0.35, 0.55, 0.29],
  forest: [0.24, 0.42, 0.24],
  highland: [0.44, 0.45, 0.4],
  snow: [0.88, 0.92, 0.96],
  ash: [0.24, 0.22, 0.24],
  water: [0.2, 0.35, 0.4],
};

export const ZONE_NAMES: { name: string; x: number; z: number; radius: number }[] = [
  { name: 'Yankı Çayırı', x: 8, z: 34, radius: 130 },
  { name: 'Gölgeli Orman', x: -70, z: -40, radius: 120 },
  { name: 'Sisli Kıyı', x: -150, z: 120, radius: 120 },
  { name: 'Yüksek Yamaçlar', x: 110, z: -90, radius: 130 },
  { name: 'Zirve', x: 156, z: -176, radius: 90 },
  { name: 'Bekçi Çukuru', x: 0, z: -205, radius: 90 },
];
