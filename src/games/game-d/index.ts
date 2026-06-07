// Game D · 暗黑类 ARPG 垂直切片（PoC）。负责人：Programmer D。
// 纯数据装配，零 ARPG 专属代码。整套战斗循环由通用能力涌现：
//   ai-chase = aggro(感知→Relation target) + steering(追逐) + motion-apply（行为=数据组合，对齐周期表 Tier4）
//   放技能   = Signal → caster → SpawnRequest → prefab 展开（D-002）
//   冰冻/灼烧/解冻 = hitbox(statusDuration/dot*) → over-time（D-003）；冻=定身 = steering.haltStatusMask
//   死亡掉落 = resource → mortal(hp≤0 销毁 + dropTemplate) → destroy（D-001 配套）
// follow-up：玩家输入/canvas 渲染/序列帧 VFX、按键→Signal 绑定、§3 资产管线落地真序列帧。
export {
  buildGameDBlueprint,
  GAME_D_TEMPLATES,
  TEAM_PLAYER,
  TEAM_ENEMY,
  LOOT_FLAG,
  STATUS_FROZEN,
} from './blueprint.js';
export { KEYMAP_D, PLAYER_D, VIEWPORT_W, VIEWPORT_H } from './keymaps.js';
export { GAME_D_ASSETS, ASSET_HERO, ASSET_ENEMY, ASSET_LOOT, ASSET_NOVA, ASSET_SMASH, ASSET_FLAME, ASSET_TILES } from './assets.js';
export { buildDungeonRoom, MAP_COLS, MAP_ROWS, MAP_TILE } from './map.js';
