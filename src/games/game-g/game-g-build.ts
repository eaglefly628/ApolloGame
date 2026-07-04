// Game G · 出战编排纯函数（favor→战力桥 + 牌库构筑 + 天罡聚合 + 洗牌/阵型/三选一）。
// 全是确定性纯函数，不依赖 mount() 运行态；game-g.tsx 装配牌库时调用，部分(buildPickDeck/bossHeroCard/
// aggregateTengang/tengangFxOf)还经 game-g.tsx 再导出供 deck-wiring/live-combat 测试用。
import { FORMATION_PRESETS, PRESET_NAMES, TIANGANG_BY_ID, cardFavorIndex, rankOfCardId, deployCost, heroCardByName, type ArmyCard } from './index.js';
import { cardPoints, P_MAX } from './clash-resolve.js';
import { NO_TENGANG, type TengangFx } from './combat-types.js';
import { type PokerCard } from './turn-combat.js';
import { aggregateModifiers, type ModifierRow, type ModifierCtx } from '@skills/tier2/modifier-stack.js';

export const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));
export const avg = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
// 牌组均 favor → 全军 favor 偏置（改造越多越强）。
export const myBias = (deck: number[]): number => avg(deck) - 50;
// 布阵 → 名称（命中预设则用预设名，否则"自定义 x/y/z"），用于战后揭晓敌阵。
export function describeFormation(off: number[]): string {
  for (const n of PRESET_NAMES) {
    const p = FORMATION_PRESETS[n].officers;
    if (p[0] === off[0] && p[1] === off[1] && p[2] === off[2]) return n;
  }
  return `自定义 ${off[0]}/${off[1]}/${off[2]}`;
}
// 场间三选一：从增益池随机取 3 张（Fisher–Yates；元层奖励，非确定性 gameplay，用 Math.random 即可）。
export function pick3<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

// favor → 战力（公平骨架 doc19）：rank→points(fair) 走 cardPoints；该牌全部强度经 favor 折算进 buff，使 P_eff=clamp(favorToP(favor))
//   单调随 favor（军衔已在 favor 里）——buff 抵消 cardPoints 噪声，让既有 favor 经济无缝驱动 pairwise 对决核。
export const FAVOR_LO = 5, FAVOR_HI = 95; // favor 钳域（blueprint clampFavor）
export const favorToP = (favor: number): number => ((Math.max(FAVOR_LO, Math.min(FAVOR_HI, favor)) - FAVOR_LO) / (FAVOR_HI - FAVOR_LO)) * P_MAX; // favor → P_eff 空间 [0,30]
export const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank); // 显示 + cardPoints/cardStamina 同口径（★≡JOKER：点数15/续航3）
// 契约A·甲读（owner 2026-06-21 #15/#16）：把你配的 pokerPicks(卡 id) 折成回合制战斗牌库——每张挂自己的
// effectiveDeckFavors(base favor + 逐张地支附魔)→战力 buff，suit/rank 取自卡 id，主将=favor 最高那张(留士气)。
// 纯函数·确定性（同 picks+effFav → 同牌库），让大厅配的牌(含附魔)真正按 ID 进场，不再被揉成平均 bias。
export function buildPickDeck(picks: readonly string[], effFav: readonly number[]): PokerCard[] {
  const favOf = (id: string): number => { const fi = cardFavorIndex(id); return fi >= 0 ? (effFav[fi] ?? 50) : 50; };
  const genId = picks.length ? picks.reduce((best, id) => (favOf(id) > favOf(best) ? id : best), picks[0]) : '';
  return picks.map((id) => { const rk = rankOfCardId(id); return { kind: 'poker', id, rank: rk, suit: id.slice(-1), general: id === genId, buff: Math.round(favorToP(favOf(id)) - cardPoints(rk)), cost: deployCost(rk) }; });
}
// Boss 主将牌 = 本关英雄那张牌（owner 2026-06-21·传奇主将·强化）：用英雄谱 rank/suit + 强 favor(随关卡 bias 略升)
// → 一张强力主将 PokerCard(general:true·点数虽弱但战力高)。heroName=关卡 heroId(Boss 名)；查无 → null。纯函数·可测。
export const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
export function bossHeroCard(heroName: string, enemyBias: number): PokerCard | null {
  const heroDef = heroCardByName(heroName);
  if (!heroDef) return null;
  const hr = heroDef.rank === 'JOKER' ? '★' : heroDef.rank;
  const hFav = Math.min(FAVOR_HI, 65 + enemyBias); // 强 favor·随 bias 略升（细调留给重跑仿真）
  return { kind: 'poker', id: `boss-hero-${heroDef.id}`, rank: hr, suit: SUIT_SYM2LET[heroDef.suit] ?? 'S', general: true, buff: Math.round(favorToP(hFav) - cardPoints(hr)), cost: deployCost(hr) };
}
// A-JOKER：已施天罡(契约②·玩家施法集) → 聚合扁平战斗修正（live-combat 钩子读·只己方）。读 GAME_G_TIANGANGS 的 {kind,params}（契约③）。
// 一种牌算一次（不叠）。v1 实装 6 kind；v2 待接（背水 reroll / 顺子阵 straight / 擒王 decapCost·依干预 / tempo / lane 一次性 / siege / arcane 印记 / 战潮 pulse·CR 已取代被动涌牌）—— 未实装 kind 返回零修正、不崩。
export function aggregateTengang(castIds: readonly string[]): TengangFx {
  const cards: { kind: string; params?: Record<string, unknown> }[] = [];
  for (const id of castIds) { const j = TIANGANG_BY_ID.get(id); if (j) cards.push({ kind: j.kind, params: j.params as Record<string, unknown> | undefined }); }
  return tengangFxOf(cards);
}
// 天罡 op 注册表（doc20 §二·op→IR 单一真相）：DSL 的「op 词汇」枚举在此一处。
// 聚合内芯已迁引擎能力 `t2-modifier-stack`（REQ-G-修正栈迁移·owner 2026-07-04）：删本地自写累加循环 → 走 aggregateModifiers。
// 注册表由「改 fx 的 handler」改成「返回 ModifierSource 行(target 字段/op 算子/value 值)」的描述子——**op 词汇仍闭集在此一处**·未知 op 返 null(空头卡=零效果·与旧 if-else 落空一致)。
// 新增一个 op = 加一行描述子。key=`${kind}:${op}`；v=params.value · bonus=params.bonus · p=原始 params(取 filter/scope)。
// 语义映射（对齐旧 handler + modifier-stack.test 夹具②）：`+=` → add · 擎天 powerMulHighest 取最强 → max · 督战 noRout「=1」→ max value 1。
type TgRow = { target: keyof TengangFx; op: ModifierRow['op']; value: number };
type TgDesc = (v: number, bonus: number, p: Record<string, unknown>) => TgRow | null;
const TENGANG_ROWS: Record<string, TgDesc> = {
  'odds:add': (v) => ({ target: 'pEffAdd', op: 'add', value: v }),                    // (遗留·战力加·现无卡用·保留兜底)
  // ⭐掷骰系（REQ-G-天罡原生重构 §四.2·替死 logistic winFloor/kHard/noUpset）：改掷落点·作用持方战力骰。
  'roll:bonus': (v) => ({ target: 'rollBonus', op: 'add', value: v }),                // 鬼手：改掷 +v（掷后加）
  'roll:floor': (v) => ({ target: 'rollFloor', op: 'add', value: v }),                // 磐石：掷下界抬 +v（掷 [1+v,P]·收窄下风）
  'roll:twice': (v) => ({ target: 'rollTwice', op: 'add', value: v || 1 }),           // 灌铅骰：多掷 v 次取高（缺省 1=掷两次取高）
  'roll:autoWinGE': () => ({ target: 'autoWinGE', op: 'max', value: 1 }),             // 铁骰：占优必胜（前锋战力≥敌→免掷直接胜·max 幂等）
  'power:mul': (v, _b, p) => (p.filter === 'highest' || p.scope === 'highestRank' ? { target: 'powerMulHighest', op: 'max', value: v } : null), // 擎天：最强单张 ×v（取最大·非叠加）。空头卡修（owner 2026-07-04·REQ-G 片3）：数据用 filter:'highest'，旧 handler 只认 scope:'highestRank' → 擎天曾 no-op；两种键都认。
  'power:add': (v, _b, p) => ({ target: p.filter === 'countLE3' ? 'powerLE3' : p.filter === 'sameSuit' ? 'powerSameSuit' : p.filter === 'front' || p.scope === 'front' ? 'powerFront' : 'powerAll', op: 'add', value: v }), // 寡兵/同花魁/锋矢/虎符(全军)。空头卡修（REQ-G-天罡原生重构 §四.4）：锋矢 arrowhead 数据 filter:'front'，旧描述子只认 scope:'front' → 落 else 变全军+4；filter:'front' 也认 → 只前锋。
  'combo:pair': (_v, bonus) => ({ target: 'comboPair', op: 'add', value: bonus }),    // 对子诀
  'combo:trips': (_v, bonus) => ({ target: 'comboTrips', op: 'add', value: bonus }),  // 鼎立
  'morale:leaderBuff': (v) => ({ target: 'moraleLeader', op: 'add', value: v }),      // 旗手
  'morale:revenge': (v) => ({ target: 'revenge', op: 'add', value: v }),             // 哀兵
  'morale:noRout': () => ({ target: 'noRout', op: 'max', value: 1 }),                 // 督战（=1·取 max 幂等）
  'stamina:stamPlus': (v, _b, p) => ({ target: p.filter === 'faces' ? 'stamFaces' : 'stamPlus', op: 'add', value: v }), // 老兵(faces)/不屈(全军)
  'stamina:relay': (v) => ({ target: 'relay', op: 'add', value: v }),                // 薪火
  'draw:handMax': (v) => ({ target: 'handMaxAdd', op: 'add', value: v }),             // 广纳
  'draw:onPlay': (v) => ({ target: 'onPlay', op: 'add', value: v }),                  // 川流
  'draw:clashElixir': (v) => ({ target: 'clashElixir', op: 'add', value: v }),        // 战潮
  'siege:defend': (v) => ({ target: 'siegeDefend', op: 'add', value: v }),            // 死守
  'siege:chipMore': (v) => ({ target: 'siegeChip', op: 'add', value: v }),            // 攻城锤
};
const NO_CTX: ModifierCtx = { resource: () => undefined, gate: () => true }; // 天罡无 valueFrom/无门控 → 空 ctx

// 已施天罡卡集 → ModifierSource 行（每张按描述子映一行·未知 op 无行=零效果）。供 aggregateModifiers 消费。
export function tengangRows(cards: Iterable<{ kind: string; params?: Record<string, unknown> }>): ModifierRow[] {
  const rows: ModifierRow[] = []; let n = 0;
  for (const j of cards) {
    const p = j.params; if (!p) continue;
    const v = typeof p.value === 'number' ? p.value : 0; const bonus = typeof p.bonus === 'number' ? p.bonus : 0;
    const key = `${j.kind}:${String(p.op)}`;
    const row = TENGANG_ROWS[key]?.(v, bonus, p);
    if (row) rows.push({ id: `${key}:${n++}`, target: row.target, op: row.op, value: row.value }); // id 唯一即可(add/max 交换·序无关)
  }
  return rows;
}
// totals(字段→数) → TengangFx（全数值字段·缺字段回落 NO_TENGANG）。
function tengangFxFromTotals(t: Record<string, number | boolean>): TengangFx {
  const fx: TengangFx = { ...NO_TENGANG };
  const f = fx as unknown as Record<string, number>;
  for (const k of Object.keys(NO_TENGANG) as (keyof TengangFx)[]) if (k in t) f[k] = Number(t[k]);
  return fx;
}

// 纯映射（注入卡集·不依赖 blueprint 数据 → 可用合成卡单测新 op，先于乙上架数据）。
// op 词汇 = TENGANG_ROWS 注册表（单一真相·上方）；聚合走引擎 aggregateModifiers（确定性·add/max 固定序）。
export function tengangFxOf(cards: Iterable<{ kind: string; params?: Record<string, unknown> }>): TengangFx {
  return tengangFxFromTotals(aggregateModifiers(tengangRows(cards), NO_CTX));
}

// 确定性洗牌已收敛到 atoms 单一真相（mulberry32·零漂移·见 atoms/random/seeded-shuffle.test）。保留同名 export 不破现有 import。
export { seededShuffle as seededShuffleArr } from '@atom-skills/index.js';
