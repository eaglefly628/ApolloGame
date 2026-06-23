import { HERO_CARDS } from './hero-codex.js'; // isHeroOwned 本地引用（拆分后从 hero-codex 取·并经下方 export* 再导出）
import { isStraightRanks } from '@skills/tier3/poker-hand.js'; // 复用 Game E 牌型算法(顺子检测)
import type { HandType } from '@skills/tier3/poker-hand.js';

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

const SUITS = ['S', 'H', 'D', 'C']; // ♠♥♦♣


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

// ── 场间三选一增益（design/11 §三 · roguelike 养成核）──
// 胜一场后的短窗：三随机增益里选一项，改 牌组 favor / 命 / 干预能量◈ / 材料。**纯数据**（最弱 LLM 能填 {kind,amount}）
// + 小解释器 applyBuff，与大厅商城同类的存档变更——零新 capability、headless 可测。选择即流派（养成核）。
// kind 'joker' = 流派钥匙（白嫖一张天罡 → 构筑分叉，design reply#10 StS/Balatro 式，T-G6 天罡就绪后接）。
export type BuffKind = 'deck-all' | 'deck-weak' | 'lives' | 'energy' | 'materials' | 'tiangang';
export interface RunBuff { id: string; name: string; desc: string; kind: BuffKind; amount: number; count?: number; tiangangId?: string }
// 被增益作用的存档子集（Save 的子结构；解耦 mount 的 Save 类型，便于 headless 测）。含 jokers（流派钥匙落点）。
export interface BuffTarget { deck: number[]; lives: number; leverEnergy: number; materials: number; tiangangs: string[] }
export const BETWEEN_BUFFS: RunBuff[] = [
  { id: 'drill', name: '整训', desc: '全军 favor +4', kind: 'deck-all', amount: 4 },
  { id: 'elite', name: '精兵', desc: '最弱 10 张 favor +8', kind: 'deck-weak', amount: 8, count: 10 },
  { id: 'conscript', name: '征兵', desc: '战役 +1 命 ❤', kind: 'lives', amount: 1 },
  { id: 'stockpile', name: '囤能', desc: '干预能量 +3 ◈', kind: 'energy', amount: 3 },
  { id: 'revenue', name: '财源', desc: '材料 +25', kind: 'materials', amount: 25 },
];
/** 施加一项场间增益（就地改存档子集）。纯函数式语义：同 target+buff → 同结果（可测、可重放）。 */
export function applyBuff(t: BuffTarget, b: RunBuff): void {
  if (b.kind === 'deck-all') t.deck = t.deck.map((f) => clampFavor(f + b.amount));
  else if (b.kind === 'deck-weak') {
    const order = t.deck.map((f, i) => [f, i] as const).sort((x, y) => x[0] - y[0]);
    const n = Math.min(b.count ?? t.deck.length, t.deck.length);
    for (let k = 0; k < n; k++) t.deck[order[k][1]] = clampFavor(t.deck[order[k][1]] + b.amount);
  } else if (b.kind === 'lives') t.lives += b.amount;
  else if (b.kind === 'energy') t.leverEnergy = Math.min(LEVER_CAP, t.leverEnergy + b.amount);
  else if (b.kind === 'materials') t.materials += b.amount;
  else if (b.kind === 'tiangang') { if (b.tiangangId && !t.tiangangs.includes(b.tiangangId)) t.tiangangs.push(b.tiangangId); } // 流派钥匙：白嫖天罡（去重）
}

// ═══════════════════════════════════════════════════════════════
//  G2 · 战场结构（军衔 / 三路 / 布阵 / 将领牵动）—— design/06。owner 愿景核心。
//
//  一副 54 张(52+2王) = 一支按军衔(点数)成军、分三路(各18)列阵的军队。开局布阵分兵三路。
//  本段 = 纯数据装配：军衔→favor / 三路布阵 / 田忌赛马分兵 / 干预·天罡·星球对 favor 的 build 时变换。
//  装配产物 ArmyCard[] 经 game-g.tsx 折成扑克兵库，交回合制 turn-combat 推进遭遇掷命对决（clash-resolve）。
// ═══════════════════════════════════════════════════════════════

// 军衔 → 基础 favor（高军衔更易活）。JOKER/K=大队长, Q/J=中队长, 10-7=小队长, A-6=兵。
function rankFavor(rank: string): number {
  if (rank === 'JOKER' || rank === 'K') return 80;
  if (rank === 'Q' || rank === 'J') return 66;
  if (rank === '10' || rank === '9' || rank === '8' || rank === '7') return 56;
  return 46;
}
const ARMY_RANKS = ['K', 'Q', 'J', '10', '9', '8', '7', 'A', '2', '3', '4', '5', '6'];

export interface ArmyCard {
  id: string;
  rank: string;
  lane: number; // 0/1/2 = 上/中/下路
  favor: number; // 含 favorBias 的基础 favor（未含士气/溃散）
  general: boolean; // 是否本路主将（最高军衔）
  suit: string; // 花色 S/H/D/C（同花卡数花色用；render 也用）
}

/** 一方 54 张(52+2王)成军：按军衔降序蛇形发三路(各18)，每路首张(最高军衔)=路主将。favorBias=该方整体强弱。 */
export function standardArmy(prefix: string, favorBias = 0): ArmyCard[] {
  const ranks: string[] = ['JOKER', 'JOKER'];
  for (const r of ARMY_RANKS) for (let s = 0; s < 4; s++) ranks.push(r);
  const order = ranks.map((r, i) => ({ r, i, f: rankFavor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  const army: ArmyCard[] = [];
  const counts = [0, 0, 0];
  order.forEach((o, k) => {
    const lane = k % 3;
    const idx = counts[lane]++;
    army.push({ id: `${prefix}_l${lane}_${idx}`, rank: o.r, lane, favor: clampFavor(rankFavor(o.r) + favorBias), general: idx === 0, suit: SUITS[army.length % 4] });
  });
  return army;
}

// 结局联动族天罡（design/12 §五.5）：在确定性单遍解析里**前向生效**（只改未翻牌 → 无二次解析、hash 稳）。
export interface LinkTiangangs { martyr: boolean; chain: boolean }

// ── T-G3 · 开局布阵 / 分兵（design/09，田忌赛马）──
// 30 军官(大队长6/中队长8/小队长16) 由玩家分三路，24 兵自动补到 18/路；每路最高军衔=主将。
// Formation = 各路军官数(和=30) → 决定哪路强/弃。预设给易上手，AI 暗布阵给读心。纯数据、零新能力。
const OFFICER_RANKS: string[] = (() => {
  const r = ['JOKER', 'JOKER'];
  for (const x of ['K', 'Q', 'J', '10', '9', '8', '7']) for (let i = 0; i < 4; i++) r.push(x);
  return r; // 30，军衔降序
})();
const TROOP_RANKS: string[] = (() => {
  const r: string[] = [];
  for (const x of ['A', '2', '3', '4', '5', '6']) for (let i = 0; i < 4; i++) r.push(x);
  return r; // 24
})();

export interface Formation {
  officers: [number, number, number]; // 各路(上/中/下)军官数，和必须=30
}
// 首版 4 预设（命名分布；石头剪刀布闭环 → 读心有意义，见 design/09 §三）。
export const FORMATION_PRESETS: Record<string, Formation> = {
  均衡: { officers: [10, 10, 10] },
  锋矢: { officers: [6, 18, 6] }, // 攻中
  两翼: { officers: [13, 4, 13] }, // 弃中
  田忌: { officers: [2, 14, 14] }, // 弃上
};
export const PRESET_NAMES = ['均衡', '锋矢', '两翼', '田忌'];

/**
 * AI 暗布阵（纯函数·可测；游戏层 mount 调用）。低关均衡 / 中关随 stage+materials 变化 / 高关或**committed**(玩家集齐招牌流派)→
 * **反制：全程猛攻你最弱一路**(读 lastOfficers 最小路)。committed 让"亮出招牌的强玩家"面对更尖的 AI（U6 按克制反制布阵的一种落地）。
 * ⚠️ 注(待 design 校准)：克制网是 archetype↔archetype，而 AI 杠杆是 formation；formation 无法精确"克制某流派"(best-of-3 下攻弱路才是稳解)，
 *   故此处取"committed→AI 更尖(攻最弱路)"而非逐流派映 formation(后者数学上弱/糊)。若要 AI 真按流派差异化布阵，需给 AI 自己的 archetype/levers。
 */
export function pickAiFormation(stage: number, materials: number, lastOfficers: readonly number[], committed: boolean): Formation {
  if (committed || stage > 5) {
    const min = Math.min(...lastOfficers);
    const weak = lastOfficers.indexOf(min);
    const off: [number, number, number] = [6, 6, 6];
    off[weak >= 0 ? weak : 1] = 18;
    return { officers: off };
  }
  if (stage <= 2) return FORMATION_PRESETS['均衡'];
  return FORMATION_PRESETS[PRESET_NAMES[(stage + materials) % 4]];
}

// 按军官配额把军衔降序的军官轮转发三路（跳过已满路）→ 每路得均衡的高低军官，配额精确。
function deployOfficers(quota: readonly number[]): string[][] {
  const lanes: string[][] = [[], [], []];
  const cap = [...quota];
  let li = 0;
  for (const off of OFFICER_RANKS) {
    let guard = 0;
    while (cap[li] === 0 && guard++ < 3) li = (li + 1) % 3;
    if (cap[li] === 0) break; // 全满（理论上不会，sum=30）
    lanes[li].push(off);
    cap[li]--;
    li = (li + 1) % 3;
  }
  return lanes;
}

/**
 * 按布阵发兵成军：30 军官按 Formation 分三路、24 兵自动补到 18/路，每路首席(最高军衔)=主将。
 * 无 Formation → 回退 standardArmy(军衔蛇形=均衡，零迁移)。输出与 standardArmy 同构(ArmyCard[])，供出战编排（→ turn-combat）。
 */
export function armyFromFormation(prefix: string, favorBias: number, formation?: Formation): ArmyCard[] {
  if (!formation) return standardArmy(prefix, favorBias);
  const offLanes = deployOfficers(formation.officers);
  const need = [0, 1, 2].map((l) => 18 - offLanes[l].length); // 各路补兵数(和=24)
  const troopLanes: string[][] = [[], [], []];
  let li = 0;
  for (const t of TROOP_RANKS) {
    let guard = 0;
    while (need[li] === 0 && guard++ < 3) li = (li + 1) % 3;
    if (need[li] === 0) break;
    troopLanes[li].push(t);
    need[li]--;
    li = (li + 1) % 3;
  }
  const army: ArmyCard[] = [];
  for (const lane of [0, 1, 2]) {
    const laneRanks = [...offLanes[lane], ...troopLanes[lane]]; // 军官在前(高 favor)→ idx0=主将
    laneRanks.forEach((rank, idx) => {
      army.push({ id: `${prefix}_l${lane}_${idx}`, rank, lane, favor: clampFavor(rankFavor(rank) + favorBias), general: idx === 0, suit: SUITS[army.length % 4] });
    });
  }
  return army;
}

// ── T-G4 · 干预卡 / 功能牌（design/10）──
// 干预 = 花「干预能量◈」在**揭晓前**改 favor/主将/兵力 → 三路掷命读改后值。outcome-first 红线：只改掷命前输入、不回灌。
// 首发 4 张(favor-mod + 斩将 + 增援)，同花/护盾/重翻 留后续(需 D0 核 poker-hand / status)。
export const LEVER_START = 3; // 开局能量
export const LEVER_CAP = 6; // 上限
export const LEVER_REGEN = 2; // 每关回能
export type LeverKind = 'bless' | 'curse' | 'shield' | 'decapitate' | 'reinforce' | 'flush';
export const LEVER_CATALOG: Record<LeverKind, { name: string; cost: number; side: 'a' | 'b'; desc: string }> = {
  bless: { name: '祝福', cost: 1, side: 'a', desc: '我某路全员 favor +20' },
  curse: { name: '诅咒', cost: 1, side: 'b', desc: '敌某路全员 favor −20' },
  shield: { name: '护盾', cost: 2, side: 'a', desc: '我某路最弱牌反面免死(favor→92)' },
  decapitate: { name: '斩首令', cost: 3, side: 'b', desc: '敌某路主将必掉→该路溃散(−14)' },
  reinforce: { name: '增援', cost: 3, side: 'a', desc: '我某路 +2 兵(go-wide 该路)' },
  flush: { name: '牌型', cost: 2, side: 'a', desc: '我某路凑成的最高牌型→逐级 +favor(对子→同花顺)' },
};
export interface Intervention { kind: LeverKind; lane: number }
const BLESS = 20, CURSE = 20, DECAP_FAVOR = 8;

// 牌型阶梯（design/10 D 类，复用 Game E poker-hand 思想）：评一路(18+张)凑成的最高扑克牌型 → 逐级 favor。
// 注：evaluateHand 限定恰 5 张/全同花，整路不适用——故按"路"语义算特征(同花=≥5 同色/顺子=路内含 5 连点,
//   用 poker-hand 的 isStraightRanks 真算法 + HandType 枚举)，体现"52 张扑克身份的回报"。
const RANK_NUM: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2, JOKER: 15 };
const TIER_BUFF: Partial<Record<HandType, number>> = {
  'straight-flush': 18, 'four-of-a-kind': 14, 'full-house': 12, flush: 10, straight: 9, 'three-of-a-kind': 7, 'two-pair': 5, pair: 3, 'high-card': 0,
};
// tierBonus（星球·型）：成型(非高牌)时整条阶梯全局 +bonus —— 放大牌型流的羁绊回报（design reply#15 全局形，零目标 UI）。
export function laneHandTier(cards: ArmyCard[], tierBonus = 0): { type: HandType; buff: number } {
  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<string, number>();
  for (const c of cards) {
    const r = RANK_NUM[c.rank] ?? 0;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const maxR = counts[0] ?? 0, secR = counts[1] ?? 0;
  const maxSuit = Math.max(0, ...suitCounts.values());
  const distinct = [...rankCounts.keys()].sort((a, b) => a - b);
  let hasStraight = false;
  for (let i = 0; i + 5 <= distinct.length && !hasStraight; i++) hasStraight = isStraightRanks(distinct.slice(i, i + 5));
  if (!hasStraight && [2, 3, 4, 5, 14].every((r) => rankCounts.has(r))) hasStraight = isStraightRanks([2, 3, 4, 5, 14]); // A 低轮子
  const isFlush = maxSuit >= 5; // 路内同色 ≥5
  let type: HandType;
  if (isFlush && hasStraight) type = 'straight-flush';
  else if (maxR >= 4) type = 'four-of-a-kind';
  else if (maxR === 3 && secR >= 2) type = 'full-house';
  else if (isFlush) type = 'flush';
  else if (hasStraight) type = 'straight';
  else if (maxR === 3) type = 'three-of-a-kind';
  else if (maxR === 2 && secR === 2) type = 'two-pair';
  else if (maxR === 2) type = 'pair';
  else type = 'high-card';
  const base = TIER_BUFF[type] ?? 0;
  return { type, buff: base + (base > 0 ? tierBonus : 0) }; // 成型(非高牌)才吃星球·型加成
}

/**
 * 揭晓前施加干预（改 favor / 斩将 / 加兵）→ 返回改后的 a/b 军，供出战编排（→ turn-combat）。
 * outcome-first：只改掷命前输入；胜负仍 build 时由规则定、可回放（同 seed+同干预序列 → 同结果）。
 * 斩首=把敌该路主将 favor 压到 8(极易掉)，掉则经 06 将领牵动自动 −14 溃散；增援=该路 +2 兵(路可达 20)。
 *
 * **对称（design/13 §二）**：`caster` = 施加方。增益(bless/shield/reinforce/flush)落己方、削弱(curse/decapitate)落敌方——
 * side 参数化、非两套算子。玩家干预 caster='a'(默认，行为不变)；**Boss 起手干预 caster='b'**：诅咒/斩首落玩家(a)、增益落 Boss(b)。
 * bias = 施加方整体偏置（增援新兵用）。两次调用(先玩家 caster='a'、再 Boss caster='b')链式叠加，均揭晓前、outcome-first 不破。
 */
export function applyInterventions(armyA: ArmyCard[], armyB: ArmyCard[], list: Intervention[], bias = 0, caster: 'a' | 'b' = 'a', tierBonus = 0): { a: ArmyCard[]; b: ArmyCard[] } {
  let a = armyA.map((c) => ({ ...c }));
  let b = armyB.map((c) => ({ ...c }));
  const selfIsA = caster === 'a';
  const self = (): ArmyCard[] => (selfIsA ? a : b); // 施加方己军
  const enemy = (): ArmyCard[] => (selfIsA ? b : a); // 对手军
  const setSelf = (next: ArmyCard[]): void => { if (selfIsA) a = next; else b = next; };
  const setEnemy = (next: ArmyCard[]): void => { if (selfIsA) b = next; else a = next; };
  for (const iv of list) {
    if (iv.kind === 'bless') setSelf(self().map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor + BLESS) } : c)));
    else if (iv.kind === 'curse') setEnemy(enemy().map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor - CURSE) } : c)));
    else if (iv.kind === 'decapitate') setEnemy(enemy().map((c) => (c.lane === iv.lane && c.general ? { ...c, favor: DECAP_FAVOR } : c)));
    else if (iv.kind === 'reinforce') {
      const cur = self();
      const n = cur.filter((c) => c.lane === iv.lane).length;
      setSelf([...cur,
        { id: `${caster}_l${iv.lane}_rf${n}`, rank: 'A', lane: iv.lane, favor: clampFavor(46 + bias), general: false, suit: 'S' },
        { id: `${caster}_l${iv.lane}_rf${n + 1}`, rank: '2', lane: iv.lane, favor: clampFavor(46 + bias), general: false, suit: 'H' }]);
    } else if (iv.kind === 'shield') {
      // 护盾：本路最弱牌 favor 拉到 92（≈反面免死，揭晓前抬高其活率）。
      const cur = self();
      const lane = cur.filter((c) => c.lane === iv.lane);
      if (lane.length) {
        const weak = lane.reduce((m, c) => (c.favor < m.favor ? c : m), lane[0]);
        setSelf(cur.map((c) => (c.id === weak.id ? { ...c, favor: 92 } : c)));
      }
    } else if (iv.kind === 'flush') {
      // 牌型：评本路凑成的最高扑克牌型 → 逐级 +favor（对子→同花顺，复用 poker-hand 阶梯）；星球·型 全局抬整条阶梯。
      const cur = self();
      const { buff } = laneHandTier(cur.filter((c) => c.lane === iv.lane), tierBonus);
      if (buff > 0) setSelf(cur.map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor + buff) } : c)));
    }
  }
  return { a, b };
}

const SHADOW_REVENGE = 12; // 影武者：本路主将被斩(favor≤8)→该路余部 +favor 复仇
/**
 * 影武者（design/12 §五.5 退路·零缺口）：敌斩首把我某路主将压到 favor≤8(=被斩) → 该路**余部** +复仇 favor（替身死战）。
 * 揭晓前 build-时变换（在 Boss 起手干预之后调用，故能侦测被斩主将）；只升余部 favor、主将仍被斩 → outcome-first、可重放。
 */
export function applyShadowRevenge(army: ArmyCard[]): ArmyCard[] {
  const hitLanes = new Set(army.filter((c) => c.general && c.favor <= DECAP_FAVOR).map((c) => c.lane));
  return army.map((c) => (!c.general && hitLanes.has(c.lane) ? { ...c, favor: clampFavor(c.favor + SHADOW_REVENGE) } : { ...c }));
}

/** 布阵预估（build 时算，喂布阵屏预估条）：每路 Σfavor / 主将军衔点数 / 牌数。 */
export function laneEstimates(army: ArmyCard[]): { sumFavor: number; general: string; count: number }[] {
  return [0, 1, 2].map((lane) => {
    const lc = army.filter((c) => c.lane === lane);
    const gen = lc.find((c) => c.general);
    return { sumFavor: lc.reduce((a, c) => a + c.favor, 0), general: gen ? (gen.rank === 'JOKER' ? '★' : gen.rank) : '-', count: lc.length };
  });
}

// ── 终局 Boss 阵容（design/13 · 每 run 轮换一名牌王座）──
// 每 Boss = 一个拟人化扑克人格，强度全用 3 个**数据**杠杆表达：formation(力压哪路)/favorBias(多强)/openingLevers(起手干预)。
// 起手干预 = 对 Boss(B)侧跑 applyInterventions(caster='b')：增益落 Boss 己方、诅咒/斩首落玩家——**对称、零新算子**(design/13 §二)。
// taunt/persona 仅 flavor(UI 台词)、无可执行逻辑——力量全在三杠杆，守"整个游戏是数据"(最弱 LLM 能填 BossSpec)。
export interface BossSpec { id: string; name: string; persona: string; formation: Formation; favorBias: number; openingLevers: Intervention[]; taunt: string; archetype: Archetype }
const BOSS_BIAS = 14; // 终局基准偏置(≈battleSpec(4)=18 同档，余强度由 openingLevers 补)；数值可调，平衡总表归 design G。
export const BOSS_ROSTER: BossSpec[] = [
  { id: 'spadeK', name: '黑桃王·铁壁', persona: '沉稳防守', archetype: 'general', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'bless', lane: 0 }, { kind: 'bless', lane: 1 }, { kind: 'bless', lane: 2 }], taunt: '铜墙铁壁，寸土不让。' },
  { id: 'heartQ', name: '红桃皇后·倾国', persona: '妖艳压制', archetype: 'probability', formation: FORMATION_PRESETS['锋矢'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'curse', lane: 0 }, { kind: 'curse', lane: 1 }], taunt: '一顾倾人城，再顾倾你军。' },
  { id: 'diamondJ', name: '方块J·诡牌', persona: '花哨赌徒', archetype: 'cardtype', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'flush', lane: 0 }, { kind: 'flush', lane: 1 }, { kind: 'flush', lane: 2 }], taunt: '满手好牌，张张要命。' },
  { id: 'clubK', name: '梅花K·人海', persona: '暴兵碾压', archetype: 'wide', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS - 4, openingLevers: [{ kind: 'reinforce', lane: 0 }, { kind: 'reinforce', lane: 1 }, { kind: 'reinforce', lane: 2 }], taunt: '人海无尽，淹没你的旗。' },
  { id: 'bigJoker', name: '大王·天命', persona: '疯赌', archetype: 'tianji', formation: FORMATION_PRESETS['锋矢'], favorBias: BOSS_BIAS + 6, openingLevers: [{ kind: 'flush', lane: 1 }], taunt: '天命在我，一掷定乾坤！' },
  { id: 'smallJoker', name: '小王·无常', persona: '阴狠刺客', archetype: 'decap', formation: FORMATION_PRESETS['两翼'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'decapitate', lane: 0 }, { kind: 'decapitate', lane: 1 }, { kind: 'decapitate', lane: 2 }], taunt: '擒贼擒王，先取你将首。' },
];
/** 取第 idx 名 Boss（每 run 轮换；越界自动归一）。 */
export function bossFor(idx: number): BossSpec {
  const n = BOSS_ROSTER.length;
  return BOSS_ROSTER[((idx % n) + n) % n];
}

// ── T-G6 · 天罡牌（融牌面的持久"改规则"被动 · design/12 §二）──
// 借 Game E 小丑的**声明式数据哲学**（每张 = 一条 {kind,params} 规则 + text 人话），但**域不同**：
//   Game E joker = 运行时计分(on_hand_scored→chips/mult)；Game G **outcome-first** → joker = **build 时军阵 favor 变换**（揭晓前定、不回灌）。
// 故复用"数据+解释器"范式、**不复用 Game E 运行时**（同 D0 §同花未复用 evaluateHand 之理）。applyTiangangs 在出战编排前跑、**零新能力**。
// 局外持久：融在玩家牌组上（save.jokers），跨 run 不清零——"牌组身份"养成核(owner 愿景)。
// 本批 4 张=纯 build 时 favor 变换(同袍/赌徒/先登/不屈)；士气放大族(旗手/枭雄)、结局联动族(死士/连环/督粮/影武者)待后续切片(需 resolve 时钩子)。
import { GAME_G_TIANGANGS, type TiangangCard, type Archetype } from './tiangang-data.js'; // 天罡数据拆出·本地引用 + 下方 export* 再导出
export * from './tiangang-data.js';
/** 从已融天罡取结局联动开关（死士/连环）→ 出战编排前向生效。 */
export function tiangangLinks(tiangangIds: readonly string[]): LinkTiangangs {
  return { martyr: tiangangIds.includes('martyr'), chain: tiangangIds.includes('chain') };
}
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
export function effectiveTierBonus(planets: Record<string, number>): number { return planetBump(planets, 'mercury'); } // 星球·型：牌型阶梯全局加成
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

const PLANET_TROOP_RANKS = new Set(['A', '2', '3', '4', '5', '6']); // 「兵」档（星球·军作用域）
/** 星球·军：揭晓前给军阵「兵」档 +favor（叠加级数）。build-时变换、outcome-first；作用 built 军阵结构（非 deck 均值）。 */
export function applyPlanetArmy(army: ArmyCard[], planets: Record<string, number>): ArmyCard[] {
  const bump = planetBump(planets, 'mars');
  return army.map((c) => (bump > 0 && PLANET_TROOP_RANKS.has(c.rank) ? { ...c, favor: clampFavor(c.favor + bump) } : { ...c }));
}
export const TIANGANG_BY_ID: ReadonlyMap<string, TiangangCard> = new Map(GAME_G_TIANGANGS.map((j) => [j.id, j]));

/** 流派钥匙：把"未拥有的天罡牌"包成场间三选一可白嫖的 RunBuff（design reply#10：场间选择=构筑分叉）。已拥有的不再出。 */
export function tiangangKeyBuffs(ownedIds: readonly string[]): RunBuff[] {
  return GAME_G_TIANGANGS.filter((j) => !ownedIds.includes(j.id)).map((j) => ({
    id: `key_${j.id}`, name: `🃏钥匙·${j.name}`, desc: `融入天罡【${j.name}】：${j.text}`, kind: 'tiangang', amount: 0, tiangangId: j.id,
  }));
}

// ── T-G6 · 流派 + 克制网（design/12 §四 · 身份 + 石头剪刀布）──
// 流派 = 由已融天罡浮现的身份；克制网 = **双 3-环** rock-paper-scissors（无唯一最优 → 看对手临场调布阵/干预）。
// 纯数据：每流派 {keyJokers, counters} 最弱 LLM 能填；detectArchetype 数已融天罡归属、archetypeMatchup 查克制——零新能力。
export interface ArchetypeSpec { id: Archetype; name: string; desc: string; keyTiangangs: string[]; counters: Archetype }
export const ARCHETYPES: ArchetypeSpec[] = [
  // 核心 3-环（`12` §四明示）：斩首 克 将领 克 铺场 克 斩首。
  { id: 'decap', name: '斩首流', desc: '擒贼擒王引溃散', keyTiangangs: ['capturektg', 'markdecap'], counters: 'general' },
  { id: 'general', name: '将领流', desc: '主将光环碾压一路', keyTiangangs: ['bannerman', 'markmorale'], counters: 'wide' },
  { id: 'wide', name: '铺场流', desc: 'go-wide 铺满三路', keyTiangangs: ['rush', 'markswarm'], counters: 'decap' },
  // 次 3-环（doc20 §二尾 印记定稿）：同 rank 克 概率·确定 克 弃一保二 克 同 rank。
  { id: 'cardtype', name: '同rank流', desc: '堆同点数凑对子/三条', keyTiangangs: ['twinblade', 'tripod', 'marksamerank'], counters: 'probability' },
  { id: 'probability', name: '概率·确定流', desc: '抬下限收方差·占优稳拿', keyTiangangs: ['ghosthand', 'bedrock', 'markodds'], counters: 'tianji' },
  { id: 'tianji', name: '弃一保二流', desc: '弃一路、集中滚两路', keyTiangangs: ['discard2', 'marktianji'], counters: 'cardtype' },
];
const ARCH_BY_ID: ReadonlyMap<Archetype, ArchetypeSpec> = new Map(ARCHETYPES.map((a) => [a.id, a]));
/** 由已融天罡浮现的主流派：数每流派 keyTiangangs 命中数，取最高（平局取 ARCHETYPES 靠前）；无命中 → null。 */
export function detectArchetype(tiangangIds: readonly string[]): ArchetypeSpec | null {
  let best: ArchetypeSpec | null = null;
  let bestN = 0;
  for (const a of ARCHETYPES) {
    const n = a.keyTiangangs.filter((k) => tiangangIds.includes(k)).length;
    if (n > bestN) { bestN = n; best = a; }
  }
  return best;
}
/** 流派克制：a 对 b = 克制 / 被克 / 中立（双 3-环，无自克）。 */
export function archetypeMatchup(a: Archetype, b: Archetype): 'counter' | 'countered' | 'neutral' {
  if (ARCH_BY_ID.get(a)?.counters === b) return 'counter';
  if (ARCH_BY_ID.get(b)?.counters === a) return 'countered';
  return 'neutral';
}

// ── T-G6 · 流派激活质变（design/12 §四.5 · "钥匙解锁招牌强度" → 闭合"选择即流派"）──
// 触发：你的**主流派**(detectArchetype 多数决)且**集齐其 keyJokers**(全融承诺) → 施该流派**招牌增益**。只主流派激活(防混搭叠猛)。
// ⚠️ 与 design#16 的差异(已报 finish，待 design 核)：① 原阈值"≥3 keyJokers"与现 keyJoker 数(多为 2)不符 → 改"集齐主流派全 keyJokers"(6 流派皆可达)；
//    ② 原招式 概率(改对决胜率下限·clash-resolve)/弃一保二(favor 转移)/斩首(−1◈+溃散−20) 需新机制/改核 → 取**等价 build-时近似**(各注)。全 build 时、零新能力。
const ACTIVATION_FAVOR = 8; // 弃一保二：两强路集中 +favor
export function activeArchetype(tiangangIds: readonly string[]): Archetype | null {
  const main = detectArchetype(tiangangIds); // 多数决主流派
  if (!main || main.keyTiangangs.length === 0) return null;
  return main.keyTiangangs.every((k) => tiangangIds.includes(k)) ? main.id : null; // 集齐主流派 keyJokers 才质变
}
/**
 * 施主流派招牌增益（揭晓前 build-时）。返回改后 a/b + 士气倍率/牌型阶梯加成（喂下游 moraleA / 干预 tierBonus）。
 * 纯函数、确定性：将领=士气×1.3 / 铺场=每路+2兵 / 牌型=阶梯+12(≈×2) / 概率=favor下限15 / 斩首=敌主将−12先怯 / 弃一保二=两强路+favor。
 */
export function applyArchetypeActivation(active: Archetype, armyA: ArmyCard[], armyB: ArmyCard[], biasA: number): { a: ArmyCard[]; b: ArmyCard[]; moraleMul: number; tierBonusAdd: number } {
  let a = armyA.map((c) => ({ ...c }));
  let b = armyB.map((c) => ({ ...c }));
  let moraleMul = 1;
  let tierBonusAdd = 0;
  if (active === 'general') moraleMul = 1.3; // 将领流：主将士气 ×1.3
  else if (active === 'wide') {
    for (const lane of [0, 1, 2]) a.push(
      { id: `a_l${lane}_act0`, rank: 'A', lane, favor: clampFavor(46 + biasA), general: false, suit: 'S' },
      { id: `a_l${lane}_act1`, rank: '2', lane, favor: clampFavor(46 + biasA), general: false, suit: 'H' },
    ); // 铺场流：每路 +2 兵
  } else if (active === 'cardtype') tierBonusAdd = 12; // 牌型流：阶梯近 ×2（近似 design 的 ×2）
  else if (active === 'probability') a = a.map((c) => (c.favor < 15 ? { ...c, favor: 15 } : c)); // 概率流：favor 下限 15（≈下限 5%→15%）
  else if (active === 'decap') b = b.map((c) => (c.general ? { ...c, favor: clampFavor(c.favor - 12) } : c)); // 斩首流：敌主将先怯 −12（近似 −1◈/溃散−20）
  else if (active === 'tianji') {
    const sums = [0, 1, 2].map((l) => a.filter((c) => c.lane === l).reduce((s, c) => s + c.favor, 0));
    const weakest = sums.indexOf(Math.min(...sums));
    a = a.map((c) => (c.lane !== weakest ? { ...c, favor: clampFavor(c.favor + ACTIVATION_FAVOR) } : c)); // 弃一保二：两强路集中
  }
  return { a, b, moraleMul, tierBonusAdd };
}

// 从已融天罡算每路士气倍率（旗手全路、枭雄仅顶级主将路）→ 供出战编排。复用 `06` 士气、不新机制。
const TOP_RANKS = new Set(['JOKER', 'K']); // 顶级军衔（枭雄触发档）
export function tiangangMoraleScale(army: ArmyCard[], tiangangIds: readonly string[]): number[] {
  const scale = [1, 1, 1];
  for (const id of tiangangIds) {
    const j = TIANGANG_BY_ID.get(id);
    if (!j || j.kind !== 'morale') continue;
    for (const lane of [0, 1, 2]) {
      if (j.id === 'warlord') {
        const gen = army.find((c) => c.lane === lane && c.general); // 枭雄：仅本路主将顶级时放大
        if (gen && TOP_RANKS.has(gen.rank)) scale[lane] *= j.moraleMul ?? 1;
      } else scale[lane] *= j.moraleMul ?? 1; // 旗手：全路
    }
  }
  return scale;
}

/**
 * 融天罡：揭晓前按已融天罡（持久）把军阵 favor 变换 → 返回新军，喂 applyInterventions/build。
 * outcome-first：只改掷命前输入；同军+同天罡集 → 同结果（确定性、可回放）。纯 build 时、零 rng、零新能力。
 */
export function applyTiangangs(army: ArmyCard[], tiangangIds: readonly string[]): ArmyCard[] {
  let out = army.map((c) => ({ ...c }));
  for (const id of tiangangIds) {
    const j = TIANGANG_BY_ID.get(id);
    if (!j) continue;
    const amt = j.amount ?? 0;
    if (j.kind === 'suit-synergy') {
      const src = out; // 同花色计数基于当前花色分布（花色不变，计数稳定）
      out = out.map((c) => ({ ...c, favor: clampFavor(c.favor + amt * src.filter((d) => d.lane === c.lane && d.suit === c.suit).length) }));
    } else if (j.kind === 'polarize') {
      out = out.map((c) => ({ ...c, favor: clampFavor(c.favor + (c.favor >= 50 ? amt : -amt)) }));
    } else if (j.kind === 'lane-pref') {
      const lane = j.lane ?? 0;
      out = out.map((c) => (c.lane === lane ? { ...c, favor: clampFavor(c.favor + amt) } : c));
    } else if (j.kind === 'diehard') {
      out = out.map((c) => (c.favor < amt ? { ...c, favor: amt } : c));
    }
  }
  return out;
}

/**
 * 揭晓前的**完整 build 时编排**（单一真相 · 出战编排与测试共用，杜绝两路漂移）：
 *   成军(布阵+deck偏置) → 融天罡(applyTiangangs) → 玩家干预(caster='a') → Boss 起手干预(caster='b') → 算士气倍率。
 * 全在揭晓前、不回灌 gameplay（outcome-first）；返回 {a,b,moraleA}（供出战编排 → turn-combat）。纯函数、可重放。
 */
export interface MatchSetup { formation: Formation; deckBias: number; tiangangs: readonly string[]; interventions: Intervention[]; enemyForm?: Formation; enemyBias: number; boss?: BossSpec | null; planets?: Record<string, number> }
// 确保全军 rank+suit 不重复：按出现顺序为每张牌分配未用花色；rank 全满(>4张)时换 JOKER/临近 rank 吸收溢出。
// 所有 favor/掷命运算已在调用前完成 → outcome-first 安全；只改展示身份。
function ensureUniqueSuits(army: ArmyCard[]): ArmyCard[] {
  const OVERFLOW = ['JOKER', 'K', 'Q', 'J', '10', '9', '8', '7', 'A', '2', '3', '4', '5', '6'];
  const used = new Map<string, Set<string>>();
  const grab = (rank: string): { rank: string; suit: string } | null => {
    if (!used.has(rank)) used.set(rank, new Set());
    const u = used.get(rank)!;
    const s = SUITS.find((x) => !u.has(x));
    if (s) { u.add(s); return { rank, suit: s }; }
    return null;
  };
  return army.map((c) => {
    if (!used.has(c.rank)) used.set(c.rank, new Set());
    const u = used.get(c.rank)!;
    if (!u.has(c.suit)) { u.add(c.suit); return c; }
    const alt = SUITS.find((s) => !u.has(s));
    if (alt) { u.add(alt); return { ...c, suit: alt }; }
    // rank fully saturated (>4 cards) → absorb into nearest rank that still has a free suit
    for (const nr of OVERFLOW) { const slot = grab(nr); if (slot) return { ...c, ...slot }; }
    return c; // exhausted (>54 unique cards) — unavoidable
  });
}

export function prepareArmies(s: MatchSetup): { a: ArmyCard[]; b: ArmyCard[]; moraleA: number[]; linksA: LinkTiangangs } {
  const planets = s.planets ?? {};
  let a = applyTiangangs(applyPlanetArmy(armyFromFormation('a', s.deckBias, s.formation), planets), s.tiangangs); // 星球·军(兵档底盘) → 融天罡（持久 favor 变换）
  let b = armyFromFormation('b', s.enemyBias, s.enemyForm);
  // 流派激活质变：主流派集齐 keyJokers → 招牌增益（改 a/b + 士气倍率/牌型阶梯加成）。
  const active = activeArchetype(s.tiangangs);
  let moraleMul = 1;
  let tierAdd = 0;
  if (active) { const r = applyArchetypeActivation(active, a, b, s.deckBias); a = r.a; b = r.b; moraleMul = r.moraleMul; tierAdd = r.tierBonusAdd; }
  ({ a, b } = applyInterventions(a, b, s.interventions, s.deckBias, 'a', effectiveTierBonus(planets) + tierAdd)); // 玩家干预（flush 吃星球·型 + 牌型流激活）
  if (s.boss && s.boss.openingLevers.length) ({ a, b } = applyInterventions(a, b, s.boss.openingLevers, s.enemyBias, 'b')); // Boss 起手（对称）
  if (s.tiangangs.includes('shadow')) a = applyShadowRevenge(a); // 影武者：敌斩首命中我主将 → 该路余部复仇（在 Boss 干预后侦测）
  return { a: ensureUniqueSuits(a), b: ensureUniqueSuits(b), moraleA: tiangangMoraleScale(a, s.tiangangs).map((m) => m * moraleMul), linksA: tiangangLinks(s.tiangangs) }; // 士气倍率(×将领流激活) + 结局联动
}


// === 英雄谱：52 位被诅咒的历史名将（doc22 世界观 + doc23 正典名册 · 每张牌一个英雄） ===
// 铁律（doc22 §四）：英雄层 = **纯叙事 / 皮肤**，不进对战强度（公平骨架）；列传逐期补、缺则优雅占位、0 篇也能跑。
// 映射（doc23 §三）：贡献度 #1→A♠ … #52→2♣（同档 ♠>♥>♦>♣）。rank=军衔基线（公平·双方同有），英雄身份只叙事。

// ── 数据叶子拆分（owner 2026-06-21·把超大数据表移出·blueprint 作 barrel 再导出·下游 import 不变）──
export * from './hero-codex.js';
export * from './dizhi-data.js';
export * from './campaign-data.js';
