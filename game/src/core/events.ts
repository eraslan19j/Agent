/* =========================================================
   AETHERION — tiny typed event bus
   ========================================================= */
export type Handler<T = any> = (payload: T) => void;

export class Emitter<E extends Record<string, any>> {
  private map = new Map<keyof E, Set<Handler>>();

  on<K extends keyof E>(event: K, fn: Handler<E[K]>): () => void {
    let set = this.map.get(event);
    if (!set) this.map.set(event, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  off<K extends keyof E>(event: K, fn: Handler<E[K]>) {
    this.map.get(event)?.delete(fn);
  }

  emit<K extends keyof E>(event: K, payload: E[K]) {
    const set = this.map.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[emitter] ${String(event)}`, err);
      }
    }
  }

  clear() {
    this.map.clear();
  }
}

/** Global gameplay event contract. Systems communicate through this. */
export interface GameEvents {
  'enemy:killed': { type: string; x: number; z: number; elite: boolean };
  'enemy:damaged': { amount: number; crit: boolean; x: number; y: number; z: number; reaction?: string };
  'player:damaged': { amount: number };
  'player:healed': { amount: number };
  'player:died': {};
  'player:levelup': { level: number };
  'pickup:collected': { id: string; amount: number };
  'chest:opened': { id: string; tier: string };
  'waypoint:activated': { id: string };
  'statue:used': { id: string };
  'quest:updated': { questId: string };
  'quest:completed': { questId: string };
  'toast': { text: string; icon?: string };
  'boss:spawn': { name: string; hp: number };
  'boss:hp': { hp: number; max: number };
  'boss:defeated': { name: string };
  'hit:stop': { duration: number };
  'camera:shake': { amount: number };
  'world:zone': { name: string };
}
