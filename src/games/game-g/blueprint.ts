// ═══════════════════════════════════════════════════════════════
//  Game G《翻命扑克 Fateflip》—— 历史名将 · 单机回合制 deck-builder 的**数据装配层**（doc24）。
//
//  本文件 = 薄 barrel：把已拆出的纯数据/能力叶子（*-data）统一 re-export（对外名字集合不变·下游 import 零改动），
//  外加两个仍留在此处的小 run 经济 helper（quartermasterEnergy / tiangangKeyBuffs·留着免给叶子加耦合边）。
//  54 张军阵(军衔=点数) / 布阵分兵 / 干预目录 / 天罡聚合 / 地支附魔 / 流派克制网 / 星球养成 / 经济 / 战役曲线 / Boss 名册
//  皆已下沉到各自叶子。战斗本身走回合制状态机 turn-combat
//  （三路×9 格 + 召唤源泉 + 四选一互斥动作 + 推进遭遇掷命对决 clash-resolve）。
//
//  （已退役 · REQ-G-退役旧战斗核：outcome-first 3D 翻牌核 decideFaceUp/buildGameG3DFlip/buildGameGDuel3D +
//   ECS 军阵对决 buildGameGArmyMatch/resolveArmy + Card3D/ThreeRenderer 渲染后端，均删；见 git 史。）
// ═══════════════════════════════════════════════════════════════


// ── T-G5 · 战役 / run 结构（design/11）·拆出至叶子 campaign-data（RUN_BATTLES/RUN_LIVES/BattleSpec/battleSpec）──
// 场间三选一增益（design/11 §三 · roguelike 养成核）：BuffKind/RunBuff/BuffTarget/BETWEEN_BUFFS/applyBuff
// 拆出至自洽叶子 buffs-data·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './buffs-data.js';
import type { RunBuff } from './buffs-data.js'; // tiangangKeyBuffs 返回 RunBuff[]（本地引用）

// ═══════════════════════════════════════════════════════════════
//  G2 · 战场结构（军衔 / 三路 / 布阵 / 将领牵动）—— design/06。owner 愿景核心。
//
//  一副 54 张(52+2王) = 一支按军衔(点数)成军、分三路(各18)列阵的军队。开局布阵分兵三路。
//  本段 = 纯数据装配：军衔→favor / 三路布阵 / 田忌赛马分兵 / 干预·天罡·星球对 favor 的 build 时变换。
//  装配产物 ArmyCard[] 经 game-g.tsx 折成扑克兵库，交回合制 turn-combat 推进遭遇掷命对决（clash-resolve）。
// ═══════════════════════════════════════════════════════════════

// 军阵装配（军衔→favor / 三路布阵 / 田忌赛马分兵）：ArmyCard/Formation/FORMATION_PRESETS/PRESET_NAMES/
// standardArmy/armyFromFormation/pickAiFormation（+ 专属内部 helper rankFavor/deployOfficers/OFFICER_RANKS/
// TROOP_RANKS/ARMY_RANKS/SUITS）拆出至自洽叶子 formation-data·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './formation-data.js';

// 干预卡 / 功能牌（design/10）：LEVER_START/LEVER_CAP/LEVER_REGEN/LeverKind/LEVER_CATALOG/Intervention
// 拆出至自洽叶子 lever-data·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './lever-data.js';

// 终局 Boss 阵容（design/13 · 每 run 轮换一名牌王座）：BossSpec/BOSS_ROSTER/bossFor 拆出至叶子
// boss-roster-data（import formation/lever/tiangang 叶子）·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './boss-roster-data.js';

// ── T-G6 · 天罡牌（融牌面的持久"改规则"被动 · design/12 §二）──
// 借 Game E 小丑的**声明式数据哲学**（每张 = 一条 {kind,params} 规则 + text 人话），但**域不同**：
//   Game E joker = 运行时计分(on_hand_scored→chips/mult)；Game G **outcome-first** → joker = **build 时军阵 favor 变换**（揭晓前定、不回灌）。
// 故复用"数据+解释器"范式、**不复用 Game E 运行时**（同 D0 §同花未复用 evaluateHand 之理）。applyTiangangs 在出战编排前跑、**零新能力**。
// 局外持久：融在玩家牌组上（save.jokers），跨 run 不清零——"牌组身份"养成核(owner 愿景)。
// 本批 4 张=纯 build 时 favor 变换(同袍/赌徒/先登/不屈)；士气放大族(旗手/枭雄)、结局联动族(死士/连环/督粮/影武者)待后续切片(需 resolve 时钩子)。
import { GAME_G_TIANGANGS } from './tiangang-data.js'; // 天罡数据拆出·tiangangKeyBuffs 本地引用 + 下方 export* 再导出
export * from './tiangang-data.js';
const QUARTERMASTER_PER_LANE = 1; // 督粮：每胜一路 +1◈（入下场 run 能量池，post-resolve）
/** 督粮：结算后按胜路数算给下场的 ◈ 增益（拥有才有；run 经济，不破本场揭晓前花能量的相位）。 */
export function quartermasterEnergy(tiangangIds: readonly string[], lanesWon: number): number {
  return tiangangIds.includes('quartermaster') ? QUARTERMASTER_PER_LANE * Math.max(0, lanesWon) : 0;
}

// ── T-G6 · 星球牌（第二养成轴 · design/12 §三 · 升档/可叠加）·拆出至叶子 planet-data ──
// PlanetKind/PlanetCard/GAME_G_PLANETS/PLANET_BY_ID/effectiveLives/effectiveLeverCap/effectiveLeverRegen
// 拆出至自洽叶子 planet-data（import campaign-data 的 RUN_LIVES、lever-data 的 LEVER_CAP/LEVER_REGEN）·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './planet-data.js';
export * from './economy-data.js'; // 经济/充值/闪艺数据（拆分·barrel 再导出）

// 地支附魔（owner 2026-06-20 · 乙简版 → 2026-06-21 改消耗品模型）·拆出至叶子 dizhi-data：
// INLAY_MAX/DIZHI_INLAY_FAVOR/DIZHI_TIER_NM/DIZHI_TIER_CAP/InlayEntry/DizhiBag/dizhiMerge/dizhiTotal/
// dizhiTopTier/inlayBonus/effectiveDeckFavors 拆出至自洽叶子 dizhi-data·blueprint 作 barrel 再导出（下游 import 不变）。

// === 牌组构筑：16 选 + 放牌费用 + 自动构筑（doc14 §九/§十）·拆出至叶子 deck-data ===
// POKER_PICK_SIZE/POOL_CARD_IDS/isPoolCardId/cardFavorIndex/deployCost/rankOfCardId/autoBuildPokerPicks/
// isHeroOwned（+ 专属内部常量 POOL_SUIT_LETTERS/POOL_RANK_ORDER/POOL_ID_SET/RANK_POINT）拆出至自洽叶子
// deck-data（import hero-codex 的 HERO_CARDS）·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './deck-data.js';

// === 抽卡商城（doc25 §四 · Demo）·拆出至叶子 economy-data（DIZHI_MAX_TIER/GACHA/gachaCost）===

/** 流派钥匙：把"未拥有的天罡牌"包成场间三选一可白嫖的 RunBuff（design reply#10：场间选择=构筑分叉）。已拥有的不再出。 */
export function tiangangKeyBuffs(ownedIds: readonly string[]): RunBuff[] {
  return GAME_G_TIANGANGS.filter((j) => !ownedIds.includes(j.id)).map((j) => ({
    id: `key_${j.id}`, name: `🃏钥匙·${j.name}`, desc: `融入天罡【${j.name}】：${j.text}`, kind: 'tiangang', amount: 0, tiangangId: j.id,
  }));
}

// 流派 + 克制网（design/12 §四 · 身份 + 石头剪刀布）：ArchetypeSpec/ARCHETYPES/detectArchetype/
// archetypeMatchup/activeArchetype（+ 内部 ARCH_BY_ID）拆出至叶子 archetype-data（import Archetype from
// tiangang 叶子）·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './archetype-data.js';


// === 英雄谱：52 位被诅咒的历史名将（doc22 世界观 + doc23 正典名册 · 每张牌一个英雄） ===
// 铁律（doc22 §四）：英雄层 = **纯叙事 / 皮肤**，不进对战强度（公平骨架）；列传逐期补、缺则优雅占位、0 篇也能跑。
// 映射（doc23 §三）：贡献度 #1→A♠ … #52→2♣（同档 ♠>♥>♦>♣）。rank=军衔基线（公平·双方同有），英雄身份只叙事。

// ── 数据叶子拆分（owner 2026-06-21·把超大数据表移出·blueprint 作 barrel 再导出·下游 import 不变）──
export * from './hero-codex.js';
export * from './dizhi-data.js';
export * from './campaign-data.js';
