import { HERO_CARDS } from './hero-codex.js'; // isHeroOwned 本地引用（拆分后从 hero-codex 取·并经下方 export* 再导出）

// ═══════════════════════════════════════════════════════════════
//  Game G《翻命扑克 Fateflip》—— 历史名将 · 单机回合制 deck-builder 的**数据装配层**（doc24）。
//
//  本文件 = 纯数据 + 装配 helper：54 张军阵(军衔=点数) / 布阵分兵 / 干预目录 / 天罡聚合 / 地支附魔 /
//  流派克制网 / 星球养成 / 经济 / 战役曲线 / Boss 名册。战斗本身走回合制状态机 turn-combat
//  （三路×9 格 + 召唤源泉 + 四选一互斥动作 + 推进遭遇掷命对决 clash-resolve）。
//
//  （已退役 · REQ-G-退役旧战斗核：outcome-first 3D 翻牌核 decideFaceUp/buildGameG3DFlip/buildGameGDuel3D +
//   ECS 军阵对决 buildGameGArmyMatch/resolveArmy + Card3D/ThreeRenderer 渲染后端，均删；见 git 史。）
// ═══════════════════════════════════════════════════════════════


// favor 钳到 [5,95] 整数（士气/溃散叠加后用）。
const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));


// ── T-G5 · 战役 / run 结构（design/11）──
// 一个 run = 5 场连战 + 3 命线：输一场扣 1 命，命尽=结束，打穿 5 场=通关。
// 战役曲线：敌方 favor 偏置逐场升，终局第 5 场=Boss 牌王座(更强 + 起手干预)。场间养成另在 mount。
export const RUN_BATTLES = 5;
export const RUN_LIVES = 3;
const BATTLE_LABELS = ['序战 · 杂兵', '前哨 · 偏师', '中军 · 名将', '精锐 · 机关', '终局 · 牌王座 BOSS'];
export interface BattleSpec { enemyBias: number; boss: boolean; label: string }
/** 第 i 场(0-based)的敌军强度/是否 Boss。敌 favor 偏置逐场升(-10,-5,0,5)，终局 Boss 额外 +8(=18,牌王座)。 */
export function battleSpec(i: number): BattleSpec {
  const boss = i >= RUN_BATTLES - 1;
  return { enemyBias: -10 + i * 5 + (boss ? 8 : 0), boss, label: BATTLE_LABELS[i] ?? `第 ${i + 1} 战` };
}

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
import { LEVER_CAP, LEVER_REGEN } from './lever-data.js'; // 本地引用：effectiveLeverCap/effectiveLeverRegen

// 终局 Boss 阵容（design/13 · 每 run 轮换一名牌王座）：BossSpec/BOSS_ROSTER/bossFor 拆出至叶子
// boss-roster-data（import formation/lever/tiangang 叶子）·blueprint 作 barrel 再导出（下游 import 不变）。
export * from './boss-roster-data.js';

// ── T-G6 · 天罡牌（融牌面的持久"改规则"被动 · design/12 §二）──
// 借 Game E 小丑的**声明式数据哲学**（每张 = 一条 {kind,params} 规则 + text 人话），但**域不同**：
//   Game E joker = 运行时计分(on_hand_scored→chips/mult)；Game G **outcome-first** → joker = **build 时军阵 favor 变换**（揭晓前定、不回灌）。
// 故复用"数据+解释器"范式、**不复用 Game E 运行时**（同 D0 §同花未复用 evaluateHand 之理）。applyTiangangs 在出战编排前跑、**零新能力**。
// 局外持久：融在玩家牌组上（save.jokers），跨 run 不清零——"牌组身份"养成核(owner 愿景)。
// 本批 4 张=纯 build 时 favor 变换(同袍/赌徒/先登/不屈)；士气放大族(旗手/枭雄)、结局联动族(死士/连环/督粮/影武者)待后续切片(需 resolve 时钩子)。
import { GAME_G_TIANGANGS, type TiangangCard } from './tiangang-data.js'; // 天罡数据拆出·本地引用 + 下方 export* 再导出
export * from './tiangang-data.js';
const QUARTERMASTER_PER_LANE = 1; // 督粮：每胜一路 +1◈（入下场 run 能量池，post-resolve）
/** 督粮：结算后按胜路数算给下场的 ◈ 增益（拥有才有；run 经济，不破本场揭晓前花能量的相位）。 */
export function quartermasterEnergy(tiangangIds: readonly string[], lanesWon: number): number {
  return tiangangIds.includes('quartermaster') ? QUARTERMASTER_PER_LANE * Math.max(0, lanesWon) : 0;
}

// ── T-G6 · 星球牌（第二养成轴 · design/12 §三 · 升档/可叠加）──
// 与天罡（一次性·改规则·身份）正交：星球 = **可叠加的升档**（买 N 级累加），改 run 参数 / 军阵底盘。持久存档、跨 run。
// 本批 3 张：命(run 命线上限)/能(干预能量上限+回能)/军(「兵」档 favor 底盘)——皆**与大厅 deck-favor 商店不重叠**的新轴
// （命/能=run 经济无现成；军=作用在 built 军阵的兵档结构，非 deck 均值偏置）。路(选路)/型(牌型档) 待 design 定目标 UI，见 finish。
export type PlanetKind = 'lives' | 'energy' | 'rank-favor' | 'tier';
export interface PlanetCard { id: string; name: string; kind: PlanetKind; cost: number; amount: number; text: string }
export const GAME_G_PLANETS: PlanetCard[] = [
  { id: 'saturn', name: '地支·命', kind: 'lives', cost: 24, amount: 1, text: '战役命线上限 +1/级（更长的 run）' },
  { id: 'jupiter', name: '地支·能', kind: 'energy', cost: 20, amount: 1, text: '干预能量上限 +1 且每胜回能 +1/级' },
  { id: 'mars', name: '地支·军', kind: 'rank-favor', cost: 14, amount: 3, text: '全军「兵」档(A–6) favor +3/级（夯实底盘）' },
  { id: 'mercury', name: '地支·型', kind: 'tier', cost: 16, amount: 4, text: '牌型羁绊（同花/顺子卡）整条阶梯 +4/级（牌型流升档）' },
];
export const PLANET_BY_ID: ReadonlyMap<string, PlanetCard> = new Map(GAME_G_PLANETS.map((p) => [p.id, p]));
const planetBump = (planets: Record<string, number> | undefined, id: string): number => (planets?.[id] ?? 0) * (PLANET_BY_ID.get(id)?.amount ?? 0);
/** 派生 run 参数（叠加星球级数；纯函数、可测）。星球持久 → run 重开读它。 */
export function effectiveLives(planets: Record<string, number>): number { return RUN_LIVES + planetBump(planets, 'saturn'); }
export function effectiveLeverCap(planets: Record<string, number>): number { return LEVER_CAP + planetBump(planets, 'jupiter'); }
export function effectiveLeverRegen(planets: Record<string, number>): number { return LEVER_REGEN + planetBump(planets, 'jupiter'); }
export * from './economy-data.js'; // 经济/充值/闪艺数据（拆分·barrel 再导出）

// 地支附魔（owner 2026-06-20 · 乙简版 → 2026-06-21 改消耗品模型）：地支生肖镶进扑克牌 → 给那张牌 +favor（铜/银/金 递增）。
// 地支是**消耗牌**：镶一张少一张（永久消耗·不退）。每张牌 ≤INLAY_MAX 槽。
// save.inlays 记「牌位索引(0-51) → 已镶条目 {b:生肖 branch, t:档位 1铜/2银/3金}[]」——**档位在镶入时锁定**（消耗的就是那张·favor 固定，不随后续升档变）。连携(三合/六合)留甲契约④。
export const INLAY_MAX = 3;
export const DIZHI_INLAY_FAVOR = [0, 4, 8, 14, 22, 32]; // 索引=档位（1铜/2银/3金 · 4钻/5史 待开放占位）→ +favor
export const DIZHI_TIER_NM = ['', '铜', '银', '金', '钻', '史']; // 1铜2银3金 · 4钻5史(待开放)
export const DIZHI_TIER_CAP = 3; // 当前开放到「金(3)」；钻4/史5 待开放（merge 不越过此档）
export interface InlayEntry { b: string; t: number } // 镶入条目：生肖 branch + 锁定档位
/** 地支卡包：每生肖按档位计活化数（消耗品库存）。数组 index 0=铜,1=银,2=金（钻/史待开放·不计入）。 */
export type DizhiBag = Record<string, number[]>;
/** 三合升档：每满 3 张同档 → 合并成 1 张高一档（铜→银→金；封顶金·钻待开放）。返回规整后的新数组。 */
export function dizhiMerge(counts: number[]): number[] {
  const out = counts.slice();
  for (let t = 0; t < DIZHI_TIER_CAP - 1; t++) { while ((out[t] ?? 0) >= 3) { out[t] -= 3; out[t + 1] = (out[t + 1] ?? 0) + 1; } }
  return out;
}
/** 卡包某生肖的活化总数（跨档求和）。 */
export function dizhiTotal(counts: number[] | undefined): number { return (counts ?? []).reduce((s, n) => s + (n || 0), 0); }
/** 卡包某生肖的最高在持档位（1铜/2银/3金 · 0=无）。 */
export function dizhiTopTier(counts: number[] | undefined): number { const c = counts ?? []; for (let t = c.length - 1; t >= 0; t--) if ((c[t] ?? 0) > 0) return t + 1; return 0; }
/** 一张牌镶入若干地支条目 → 总 +favor（各条目按其锁定档位）。 */
export function inlayBonus(entries: InlayEntry[] | undefined): number {
  return (entries ?? []).reduce((s, e) => s + (DIZHI_INLAY_FAVOR[e.t] ?? 0), 0);
}
/** 应用附魔：返回 effective deck favor（base + 各牌位镶嵌加成）。喂 myBias(战斗) 与 牌面展示——52 牌单一真相。 */
export function effectiveDeckFavors(deck: number[], inlays: Record<string, InlayEntry[]> | undefined): number[] {
  if (!inlays) return deck;
  const out = deck.slice();
  for (const k in inlays) { const i = +k; if (i >= 0 && i < out.length) out[i] = clampFavor(out[i] + inlayBonus(inlays[k])); }
  return out;
}

// === 牌组构筑：16 选 + 放牌费用 + 自动构筑（doc14 §九/§十 · DEV-CHECKLIST 契约 A/B + 乙3）===
// 出战扑克牌库 = 从 52 收藏池自选 16 张（owner 2026-06-21：13→16·别太少）。结构同收藏：花色♠♥♦♣ × 点 A K Q J 10..2·与 deckGrid/inlays 同序·单一真相。
export const POKER_PICK_SIZE = 16;
const POOL_SUIT_LETTERS = ['S', 'H', 'D', 'C']; // ♠♥♦♣（与大厅 deckGrid 同序）
const POOL_RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']; // favor 索引内点序（与大厅一致）
/** 收藏池 52 卡 id（index 即 favor/inlays 索引：suit*13 + rank）。id = 点+花色字母，如 'AS'/'10D'/'2C'。 */
export const POOL_CARD_IDS: string[] = POOL_SUIT_LETTERS.flatMap((su) => POOL_RANK_ORDER.map((rank) => rank + su));
const POOL_ID_SET = new Set(POOL_CARD_IDS);
export const isPoolCardId = (id: string): boolean => POOL_ID_SET.has(id);
/** 卡 id → favor 索引（0..51·与 save.deck/inlays 同序）；非法 id → -1。 */
export function cardFavorIndex(id: string): number {
  const i = POOL_CARD_IDS.indexOf(id);
  return i;
}
// 放牌费用（契约 B·doc14 §九 4 档·单一真相在此·甲 turn-combat 与乙 UI 都读这里）：点 2-4=0 / 5-7=1 / 8-10=2 / J Q K A=3。
const RANK_POINT: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
/** 放牌召唤源泉费用（按点数 4 档）。rank 取牌点（'A'/'2'..'10'/'J'/'Q'/'K'）。 */
export function deployCost(rank: string): number {
  const p = RANK_POINT[rank] ?? 14; // 未知（JOKER/★）按最高档
  return p <= 4 ? 0 : p <= 7 ? 1 : p <= 10 ? 2 : 3;
}
/** 卡 id → 点 rank（'10S'→'10'·'AS'→'A'）。 */
export const rankOfCardId = (id: string): string => id.slice(0, -1);
/** 一键自动构筑（乙3·纯函数·确定性·零随机）：16 张铺开费用曲线(各档 [4,4,4,4]·不全大点) + 偏好已拥有/已养成(favor 高)。
 *  favors=effectiveDeckFavors(52·按 favor 索引)；isOwned(id)=该卡是否已解锁(偏好·非硬门)。同输入恒同输出。 */
export function autoBuildPokerPicks(opts: { favors: number[]; isOwned: (id: string) => boolean; size?: number }): string[] {
  const size = opts.size ?? POKER_PICK_SIZE;
  const cands = POOL_CARD_IDS.map((id, idx) => ({ id, idx, cost: deployCost(rankOfCardId(id)), favor: opts.favors[idx] ?? 50, owned: opts.isOwned(id) }));
  const score = (c: { owned: boolean; favor: number }): number => (c.owned ? 1000 : 0) + c.favor; // 已拥有优先·再比 favor
  const byScore = (a: { idx: number } & { owned: boolean; favor: number }, b: { idx: number } & { owned: boolean; favor: number }): number => score(b) - score(a) || a.idx - b.idx;
  const target = [4, 4, 4, 4]; // 4 档目标张数（铺开曲线·别全大点）→ 16
  const picks: string[] = [];
  for (let t = 0; t < 4; t++) {
    const tier = cands.filter((c) => c.cost === t).sort(byScore);
    for (let i = 0; i < target[t] && i < tier.length; i++) picks.push(tier[i].id);
  }
  if (picks.length < size) { // 某档不足 → 从剩余全局最高分补满
    const have = new Set(picks);
    for (const c of cands.filter((c) => !have.has(c.id)).sort(byScore)) { if (picks.length >= size) break; picks.push(c.id); }
  }
  return picks.slice(0, size);
}
/** 该收藏卡是否已解锁（读 HERO_CARDS.own·自动构筑偏好用·非战斗硬门·懒查 HERO_CARDS）。 */
export const isHeroOwned = (id: string): boolean => (HERO_CARDS.find((h) => h.id === id)?.own ?? 0) > 0;

// === 抽卡商城（doc25 §四 · Demo）===
// 商城=抽卡枢纽：花🪙/💎 从「已解锁池」随机出天罡/地支；天罡重复→天罡碎片→定向兑换(保底·可控build)；
// 地支 新得=铜·重复=升档(铜→银→金)·满金重复→地支碎片。全数据驱动·价格/汇率可调。
export const DIZHI_MAX_TIER = 3; // 1铜 2银 3金
export const GACHA = {
  tiangang: { singleGold: 80, singleDiamond: 8, tenGold: 720, tenDiamond: 72, dupShards: 5, craftShards: 20 },
  dizhi: { singleGold: 60, singleDiamond: 6, tenGold: 540, tenDiamond: 54, maxDupShards: 8, craftShards: 12 },
};
/** 抽卡花费（pool×count×pay）。返回 {gold,diamond} 其一>0。 */
export function gachaCost(pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond'): { gold: number; diamond: number } {
  const g = GACHA[pool];
  const gold = pay === 'gold' ? (count === 10 ? g.tenGold : g.singleGold) : 0;
  const diamond = pay === 'diamond' ? (count === 10 ? g.tenDiamond : g.singleDiamond) : 0;
  return { gold, diamond };
}

export const TIANGANG_BY_ID: ReadonlyMap<string, TiangangCard> = new Map(GAME_G_TIANGANGS.map((j) => [j.id, j]));

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
