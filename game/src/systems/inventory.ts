/* =========================================================
   AETHERION — inventory & rewards
   ========================================================= */
import { ITEMS, type ItemId } from '../data/items';
import type { GameContext } from '../game/types';

export class InventorySystem {
  private counts: Record<string, number> = {};

  constructor(private ctx: GameContext) {
    this.counts = ctx.save.data.collectibles ?? {};
  }

  count(id: ItemId) {
    return this.counts[id] ?? 0;
  }

  /** All owned items, sorted by rarity then name. */
  list() {
    return Object.entries(this.counts)
      .filter(([, v]) => v > 0)
      .map(([id, amount]) => ({ def: ITEMS[id as ItemId], amount }))
      .filter((e) => !!e.def)
      .sort((a, b) => b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name));
  }

  add(id: ItemId, amount: number, notify = true) {
    if (!ITEMS[id] || amount <= 0) return;
    this.counts[id] = (this.counts[id] ?? 0) + amount;
    this.ctx.save.data.collectibles = this.counts;
    this.ctx.save.markDirty();
    if (notify) {
      const def = ITEMS[id];
      this.ctx.notify(`${def.icon} ${def.name} +${amount}`, def.icon);
      this.ctx.audio.coin();
    }
    if (id === 'mora') this.ctx.save.data.player.mora += amount;
    if (id === 'primogem') this.ctx.save.data.player.primogems += amount;
    if (notify) this.ctx.events.emit('pickup:collected', { id, amount });
  }

  remove(id: ItemId, amount: number): boolean {
    if ((this.counts[id] ?? 0) < amount) return false;
    this.counts[id] -= amount;
    this.ctx.save.data.collectibles = this.counts;
    this.ctx.save.markDirty();
    return true;
  }

  grantXp(amount: number) {
    this.ctx.player.addXp(amount, this.ctx);
  }

  /** Consume one Aetherbloom to heal the active character. */
  useHeal(): boolean {
    if (this.count('aetherbloom') <= 0) {
      this.ctx.notify('Yankı Çiçeği yok', '✿');
      return false;
    }
    if (this.ctx.player.hp >= this.ctx.player.maxHp) {
      this.ctx.notify('Canın dolu', '❤');
      return false;
    }
    this.remove('aetherbloom', 1);
    this.ctx.player.heal(320);
    this.ctx.audio.pickup();
    return true;
  }
}
