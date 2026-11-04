/* =========================================================
   AETHERION — shared runtime context (type-only, no cycles)
   ========================================================= */
import type * as THREE from 'three';
import type { Engine } from '../core/engine';
import type { ThirdPersonCamera } from '../core/camera';
import type { Input } from '../core/input';
import type { AudioEngine } from '../core/audio';
import type { SaveSystem, SettingsSave } from '../core/save';
import type { Emitter, GameEvents } from '../core/events';
import type { Terrain } from '../world/terrain';
import type { Sky } from '../world/sky';
import type { Water } from '../world/water';
import type { Scatter } from '../world/scatter';
import type { WorldObjects } from '../world/worldobjects';
import type { Props } from '../world/props';
import type { Weather } from '../world/weather';
import type { Effects } from '../fx/effects';
import type { EnemyManager } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { HUD } from '../ui/hud';
import type { QuestSystem } from '../systems/quests';
import type { InventorySystem } from '../systems/inventory';

export interface GameContext {
  engine: Engine;
  terrain: Terrain;
  sky: Sky;
  water: Water;
  scatter: Scatter;
  effects: Effects;
  audio: AudioEngine;
  input: Input;
  cam: ThirdPersonCamera;
  events: Emitter<GameEvents>;
  save: SaveSystem;
  settings: SettingsSave;
  enemies: EnemyManager;
  world: WorldObjects;
  /** destructible physics props (barrels, crates, pots, blocks) */
  props?: Props;
  /** dynamic weather: clear / rain / storm */
  weather?: Weather;
  hud: HUD;
  player: Player;
  quests: QuestSystem;
  inventory: InventorySystem;
  /** Add a floating damage/heal number at a world position. */
  damageNumber(pos: THREE.Vector3, text: string, kind?: 'phys' | 'crit' | 'heal' | 'reaction' | 'element'): void;
  notify(text: string, icon?: string): void;
  requestHitStop(seconds: number): void;
  requestShake(amount: number): void;
}
