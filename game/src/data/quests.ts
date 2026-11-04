/* =========================================================
   AETHERION — chapter I quest chain
   ========================================================= */

export type ObjectiveType = 'reach' | 'kill' | 'chest' | 'collect' | 'waypoint' | 'boss';

export interface ObjectiveDef {
  type: ObjectiveType;
  label: string;
  count: number;
  /** filter for kill objectives: enemy id or 'any' / 'elite' */
  target?: string;
  /** world position for reach objectives */
  pos?: { x: number; z: number };
  radius?: number;
}

export interface QuestDef {
  id: string;
  chapter: string;
  title: string;
  summary: string;
  objectives: ObjectiveDef[];
  rewards: { mora: number; xp: number; primogem?: number; item?: { id: string; amount: number } };
  hint: string;
  levelReq?: number;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'q_awakening',
    chapter: 'BÖLÜM I · UYANIŞ',
    title: 'Uyanış Taşı',
    summary: 'Vadiye düşen Gözcü, ilk mühür taşını bulmak zorunda. Taş, Yedigök’ün haritasını açar.',
    objectives: [
      { type: 'reach', label: 'Uyanış Taşı’na yaklaş', count: 1, pos: { x: 12, z: 22 }, radius: 6 },
      { type: 'waypoint', label: 'Uyanış Taşı’nı etkinleştir', count: 1, target: 'statue_dawn' },
    ],
    rewards: { mora: 300, xp: 120, primogem: 5 },
    hint: 'Minimapteki ◈ işareti taşın yerini gösterir.',
  },
  {
    id: 'q_cleansing',
    chapter: 'BÖLÜM I · UYANIŞ',
    title: 'Vadi Temizliği',
    summary: 'Gölge yaratıkları çayıra inmiş. Taşın uyanmasıyla uyanan onlar, vadinin dengesini bozuyor.',
    objectives: [{ type: 'kill', label: 'Gölge yaratığı yen', count: 5, target: 'any' }],
    rewards: { mora: 420, xp: 180, item: { id: 'crystal', amount: 3 } },
    hint: 'Element tepkimeleri düşmanı hızla eritir. Sera ile başla, Rin ile zincirle.',
  },
  {
    id: 'q_treasure',
    chapter: 'BÖLÜM I · UYANIŞ',
    title: 'Kayıp Sandıklar',
    summary: 'Vadide dağılmış sandıklar, eski Gözcüler’in bıraktığı donanımı saklıyor.',
    objectives: [{ type: 'chest', label: 'Sandık aç', count: 3 }],
    rewards: { mora: 500, xp: 200, primogem: 8 },
    hint: 'Sandıklar parlayan altın bir siluetle görünür. Yaklaş ve F / “Etkinleştir”.',
  },
  {
    id: 'q_bloom',
    chapter: 'BÖLÜM I · UYANIŞ',
    title: 'Yankı Çiçeği',
    summary: 'Bora’nın yaraları için Yankı Çiçeği topla. Çiçekler yalnızca yumuşak çayırlarda açar.',
    objectives: [{ type: 'collect', label: 'Yankı Çiçeği topla', count: 4, target: 'aetherbloom' }],
    rewards: { mora: 380, xp: 160, item: { id: 'aetherbloom', amount: 3 } },
    hint: 'Çiçekler turkuaz ışıkla parlar; toplamak için yanından geçmen yeterli.',
  },
  {
    id: 'q_sentinel',
    chapter: 'BÖLÜM I · UYANIŞ',
    title: 'Taş Muhafız',
    summary: 'Kıyı yolundaki Taş Muhafız, mühür taşlarının yolunu kesiyor. Onu devir.',
    objectives: [{ type: 'kill', label: 'Taş Muhafız’ı yen', count: 1, target: 'sentinel' }],
    rewards: { mora: 900, xp: 380, primogem: 12, item: { id: 'artifact', amount: 1 } },
    hint: 'Toprak zırhı ateşle erimez — Bora’nın buzu ile savunmasını kır.',
  },
  {
    id: 'q_echo',
    chapter: 'BÖLÜM I · UYANIŞ',
    title: 'Yedigök’ün Yankısı',
    summary: 'Zirve Mührü’nü uyandır ve Yedigök’ün ilk yankısını duy. Vadinin kalbi seni bekliyor.',
    objectives: [
      { type: 'reach', label: 'Zirve’ye tırman', count: 1, pos: { x: 156, z: -176 }, radius: 14 },
      { type: 'waypoint', label: 'Zirve Mührü’nü etkinleştir', count: 1, target: 'statue_summit' },
    ],
    rewards: { mora: 1600, xp: 700, primogem: 30, item: { id: 'core', amount: 1 } },
    hint: 'Zirve yüksek: tırmanmak için dayanıklılığını yönet, sürüklenmeyi kullan.',
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export function nextQuest(currentIds: string[]): QuestDef | undefined {
  return QUESTS.find((q) => !currentIds.includes(q.id));
}
