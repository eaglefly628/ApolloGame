// Game G ·《翻命扑克 Fateflip》—— outcome-first + 3D 表现（v2）。
// 胜负先由"属性加权种子硬币"(decideFaceUp)定，物理翻牌是反推的 3D 表现(tween 翻到既定面)。
// 零游戏专属系统、零新 capability；3D 只在 ThreeRenderer 渲染后端 + render-only Card3D 组件。设计见 ./DESIGN.md。
export { buildGameG3DFlip, buildGameGDuel3D, buildGameGMatch, buildGameGArmyMatch, standardArmy, armyFromFormation, laneEstimates, applyInterventions, laneHandTier, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, cardFace, decideFaceUp, flipTarget, CARD_W, CARD_H, FLIP_DURATION, FLIP_SPINS, MATCH_REWARD, TEAM_A, TEAM_B, ALIVE, LANE } from './blueprint.js';
export { battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, BOSS_ROSTER, bossFor, GAME_G_JOKERS, JOKER_BY_ID, applyJokers, jokerMoraleScale, jokerKeyBuffs, ARCHETYPES, detectArchetype, archetypeMatchup } from './blueprint.js';
export type { FateCard, ArmyCard, Formation, Intervention, LeverKind, BattleSpec, RunBuff, BuffKind, BuffTarget, BossSpec, JokerCard, JokerKind, Archetype, ArchetypeSpec } from './blueprint.js';
