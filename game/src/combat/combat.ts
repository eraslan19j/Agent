/* =========================================================
   AETHERION — damage maths
   Pure functions, deterministic when a rng is injected.
   ========================================================= */

export interface DamageInput {
  atk: number;
  power: number;
  critRate: number;
  critDmg: number;
  reactionMult?: number;
  defShred?: number;
  targetDef?: number;
  /** rng in [0,1) — defaults to Math.random */
  rng?: () => number;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
}

/** Genshin-like defence curve: never reduces damage below 35%. */
export function defFactor(targetDef: number, defShred = 0) {
  const def = Math.max(0, targetDef * (1 - defShred));
  return Math.max(0.35, 1 - def / (def + 420));
}

export function computeDamage(input: DamageInput): DamageResult {
  const rng = input.rng ?? Math.random;
  const crit = rng() < input.critRate;
  const base = input.atk * input.power;
  const withCrit = base * (crit ? 1 + input.critDmg : 1);
  const mult = input.reactionMult ?? 1;
  const amount = withCrit * mult * defFactor(input.targetDef ?? 0, input.defShred ?? 0);
  return { amount: Math.max(1, Math.round(amount)), crit };
}

/** Incoming damage on the player (defence mitigates, shields absorb). */
export function incomingDamage(atk: number, playerDef: number, power = 1) {
  return Math.max(1, Math.round(atk * power * defFactor(playerDef)));
}

export const COMBO_MULTIPLIERS = [1.0, 1.05, 1.45] as const;
export const CHARGE_MULTIPLIER = 1.8;

export function hitStopFor(damage: number, crit: boolean) {
  const base = Math.min(0.09, 0.03 + damage / 4200);
  return crit ? Math.min(0.14, base + 0.035) : base;
}

export function shakeFor(damage: number, crit: boolean) {
  return Math.min(0.55, 0.06 + damage / 3000) * (crit ? 1.5 : 1);
}
