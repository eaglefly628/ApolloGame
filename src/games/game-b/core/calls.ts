// Game B ·《雀宴》麻将核切片⑤ —— 鸣牌合法性检测（纯函数·headless 逻辑核·naki-design §2/§3）。
//
// 积木边界（owner 铁令·加法扩展不破门清核）：
//   · 牌码/基元 = tiles-def.ts（kindOf 归赤5·floor(k/9) 花色段）· 副露模型 = meld.ts（Meld/MeldKind）。
//   · 本文件只判「某弃牌 / 自家手能否鸣」+ 一张弃牌多家争鸣的优先级——纯查询·零状态·零随机·零 IO/UI。
//   · 和了判定（荣）走 hand-eval.winsWithMelds（不在此重造）；流程接线（call window / 应用副露）= game-state（P3）。
// 口径真相 = naki-design §2/§3：吃仅下家·同花色数牌成顺；碰/大明杠任意家；暗杠/加杠自家回合；
//   喰い替え禁（R-2·現物 + 両面筋）；优先级 荣 > 碰/大明杠 > 吃（碰/杠对一张弃牌至多一家）。
import { kindOf } from './tiles-def.js';
import type { Meld } from './meld.js';

/** 该花色段起始牌种（man=0·pin=9·sou=18；字牌无段·调用方先排除）。 */
const suitBase = (k: number): number => Math.floor(k / 9) * 9;
/** 牌种 k 是否与 base 同花色段内（1-9·不跨色）。 */
const inSuit = (k: number, base: number): boolean => k >= base && k < base + 9;

/** 吃候选：消耗的两张暗手牌种（升序）——被吃牌补第三张成同色顺子。 */
export interface ChiCandidate {
  /** 两张暗手牌种（kind·升序·赤5 归普5 种）。 */
  consume: [number, number];
}

/**
 * 吃（仅下家对上家弃牌·调用方保证座次）：discard 与暗手两张成同花色连续顺子。
 * 三型搭子候选 {d-2,d-1} / {d-1,d+1} / {d+1,d+2}，逐一验暗手持有且不跨花色段。
 * 字牌 / 暗手无搭 → 空数组。赤5 经 kindOf 归普5 种参与判定。
 */
export function chiCandidates(hand: number[], discard: number): ChiCandidate[] {
  const d = kindOf(discard);
  if (d >= 27) return []; // 字牌不可吃
  const base = suitBase(d);
  const num = d - base; // 0-8（点数-1）·同色段内位置
  const has = (k: number): boolean => inSuit(k, base) && hand.some((t) => kindOf(t) === k);
  const out: ChiCandidate[] = [];
  if (num >= 2 && has(d - 2) && has(d - 1)) out.push({ consume: [d - 2, d - 1] }); // 高端吃（低两张）
  if (num >= 1 && num <= 7 && has(d - 1) && has(d + 1)) out.push({ consume: [d - 1, d + 1] }); // 嵌张吃
  if (num <= 6 && has(d + 1) && has(d + 2)) out.push({ consume: [d + 1, d + 2] }); // 低端吃（高两张）
  return out;
}

/** 碰：任意家（非弃牌者）暗手 ≥2 张同 discard 种（赤5 归普5 计）。 */
export function canPon(hand: number[], discard: number): boolean {
  const d = kindOf(discard);
  return hand.filter((t) => kindOf(t) === d).length >= 2;
}

/** 大明杠：任意家暗手 3 张同 discard 种（连弃牌成 4·一副恒 4 枚故手中至多 3）。 */
export function canDaiminkan(hand: number[], discard: number): boolean {
  const d = kindOf(discard);
  return hand.filter((t) => kindOf(t) === d).length >= 3;
}

/** 每种牌在（含刚摸的）暗手中的枚数。 */
function countByKind(handWithDrawn: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of handWithDrawn) m.set(kindOf(t), (m.get(kindOf(t)) ?? 0) + 1);
  return m;
}

/**
 * 暗杠候选（自家回合·handWithDrawn=暗手含刚摸）：某种恰 4 张 → 可暗杠。返回牌种升序。
 * ⚠ 立直后仅「不变听」方可暗杠（naki-design §2）——该约束需比对听牌·由流程层 game-state 把关，本函数只报形式候选。
 */
export function ankanCandidates(handWithDrawn: number[]): number[] {
  const out: number[] = [];
  for (const [k, c] of countByKind(handWithDrawn)) if (c === 4) out.push(k);
  return out.sort((a, b) => a - b);
}

/**
 * 加杠候选（自家回合）：已有该种的**碰**副露 + 手中（含刚摸）持第 4 张 → 可升杠。返回牌种升序。
 * ⚠ 加杠可被抢杠（R-6·暗杠不可抢）——抢杠窗口由流程层开，本函数只报形式候选。
 */
export function kakanCandidates(handWithDrawn: number[], melds: Meld[]): number[] {
  const cnt = countByKind(handWithDrawn);
  const out: number[] = [];
  for (const m of melds) {
    if (m.kind !== 'pon') continue;
    const k = kindOf(m.tiles[0]!);
    if ((cnt.get(k) ?? 0) >= 1) out.push(k);
  }
  return out.sort((a, b) => a - b);
}

/**
 * 喰い替え禁（R-2）：吃/碰后**本巡**不得打出的牌种。
 * · 碰：現物（同碰牌种）禁。
 * · 吃：現物禁 + **両面吃**的筋牌禁（4-5 吃 3 → 禁打 6；5-6 吃 7 → 禁打 4）；嵌张/边张（penchan）只禁現物。
 * consume = 吃消耗的两张暗手牌种（chiCandidates 的 [lo,hi]）；碰传 consume=null。返回禁打牌种升序。
 */
export function kuikaeForbidden(called: number, consume: [number, number] | null): number[] {
  const d = kindOf(called);
  const forbid = new Set<number>([d]); // 現物恒禁（碰=仅此）
  if (consume) {
    const run = [consume[0], consume[1], d].sort((a, b) => a - b);
    const [lo, mid, hi] = run as [number, number, number];
    const base = suitBase(d);
    // 両面吃 = 被吃在顺子端 + 暗手两张相邻；另一端筋牌禁（在同花色段内才存在）。
    if (d === lo && hi === mid + 1 && inSuit(hi + 1, base)) forbid.add(hi + 1); // 吃低端·筋=高端+1
    if (d === hi && lo === mid - 1 && inSuit(lo - 1, base)) forbid.add(lo - 1); // 吃高端·筋=低端-1
    // d===mid（嵌张吃）→ 无筋·仅現物。
  }
  return [...forbid].sort((a, b) => a - b);
}

/** 一次鸣牌主张（call window 内某家对某弃牌的意向）。 */
export type CallType = 'ron' | 'pon' | 'minkan' | 'chi';
export interface CallClaim {
  seat: number;
  type: CallType;
}

/**
 * 优先级裁决（naki-design §3）：荣 > 碰/大明杠 > 吃。
 * · 多家荣 → 全部返回（双/三响制·结算由 game-state·gdd）。
 * · 碰/大明杠对一张弃牌至多一家（4 枚中 1 已弃·余 3 无法两家各持 ≥2）→ 取其一。
 * · 吃仅下家·唯一。返回胜出主张（空=无人鸣·原流程下家摸）。
 */
export function resolveClaims(claims: CallClaim[]): CallClaim[] {
  const rons = claims.filter((c) => c.type === 'ron');
  if (rons.length > 0) return rons; // 双响制：全部荣家
  const ponKan = claims.filter((c) => c.type === 'pon' || c.type === 'minkan');
  if (ponKan.length > 0) return [ponKan[0]!];
  const chi = claims.filter((c) => c.type === 'chi');
  if (chi.length > 0) return [chi[0]!];
  return [];
}
