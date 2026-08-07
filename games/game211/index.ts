// Game G ·《翻命扑克 Fateflip》—— 历史名将 · 单机回合制 deck-builder（doc24）。
// 战斗走回合制状态机 turn-combat（三路×9 格 + 召唤源泉 + 四选一互斥动作 + 推进遭遇掷命对决 clash-resolve）。
// 本 barrel 再导出 blueprint 的纯数据装配（军阵/布阵/干预/天罡/地支/流派/星球/经济/战役）。旧 outcome-first 3D 翻牌核已退役（REQ-G-退役旧战斗核）。
// 军阵/干预/增益/流派/Boss 数据表已拆成自洽叶子 *-data；本 barrel 直接从叶子再导出（对外名字集合不变·下游 import 零改动）。
export { standardArmy, armyFromFormation, pickAiFormation, FORMATION_PRESETS, PRESET_NAMES } from './formation-data.js';
export { LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN } from './lever-data.js';
export { BETWEEN_BUFFS, applyBuff } from './buffs-data.js';
export { BOSS_ROSTER, bossFor } from './boss-roster-data.js';
export { ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype } from './archetype-data.js';
export { quartermasterEnergy, GAME_G_TIANGANGS, TIANGANG_BY_ID, OFFERABLE_TIANGANGS, RETIRED_TIANGANG_IDS, isRetiredTiangang, tiangangKeyBuffs, GAME_G_PLANETS, PLANET_BY_ID, effectiveLives, effectiveLeverCap, effectiveLeverRegen } from './blueprint.js';
export { battleSpec, RUN_BATTLES, RUN_LIVES, GAME_G_FOILS, RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, RECHARGE_PASSWORD, GACHA, gachaCost, DIZHI_MAX_TIER, DIZHI_TIER_NM, DIZHI_TIER_CAP, dizhiMerge, dizhiTotal, dizhiTopTier, DIZHI_ZODIACS, INLAY_MAX, DIZHI_INLAY_FAVOR, inlayBonus, effectiveDeckFavors, POKER_PICK_SIZE, POOL_CARD_IDS, isPoolCardId, cardFavorIndex, deployCost, rankOfCardId, autoBuildPokerPicks, isHeroOwned, heroCardByName, heroNameOf, STAGE_CAMPAIGN, campaignFor, STORY_OPENING, TIANGANG_UNLOCK, unlockStageOf } from './blueprint.js';
export type { ArmyCard, Formation } from './formation-data.js';
export type { Intervention, LeverKind } from './lever-data.js';
export type { RunBuff, BuffKind, BuffTarget } from './buffs-data.js';
export type { BossSpec } from './boss-roster-data.js';
export type { ArchetypeSpec } from './archetype-data.js';
export type { BattleSpec, TiangangCard, TiangangKind, Archetype, PlanetCard, PlanetKind, RechargePack, DiamondExchange, ShardPack, StageCampaign, StageFiend, StageBossLines, StoryBeat, InlayEntry, DizhiBag } from './blueprint.js';
