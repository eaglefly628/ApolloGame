// Game D ·《骰途》战斗模型 v2 —— HP + 挑战要求 + 反制（统一模型·owner 2026-06-29 拍）。
//
// ⚠️ 原型：游戏层纯函数·上线版迁数据驱动。设计见 docs/design/game-d/combat-design.md §12。
//
// 统一核心：敌人 = HP（血量）+ 一道**门槛挑战(conds)** + **反制**。每回合你掷骰、可重掷、提交一手：
//   · 这手**满足门槛** → 命中、扣敌 HP = 本手点数和；HP 归零即胜。
//   · 不满足 → 落空，吃威胁（扣队伍心）。
// 「砸血」= 大 HP + 低门槛（靠多次砸）；「pattern」= 小 HP + 严门槛（含某点/同色对·一两手）；BOSS = 高门槛+大HP+反制。

export type Elem = 'jin' | 'mu' | 'shui' | 'huo' | 'tu' | 'none' | 'wild';

export const ELEM_INFO: Record<Elem, { emoji: string; cn: string }> = {
  jin: { emoji: '🟡', cn: '金' }, mu: { emoji: '🟢', cn: '木' }, shui: { emoji: '🔵', cn: '水' },
  huo: { emoji: '🔴', cn: '火' }, tu: { emoji: '🟤', cn: '土' }, none: { emoji: '⚪', cn: '无' }, wild: { emoji: '🌈', cn: '百搭' },
};
export const FIVE: Elem[] = ['jin', 'mu', 'shui', 'huo', 'tu'];

// ── 骰子 ───────────────────────────────────────────────────────────────
export interface Face { v: number; el: Elem; }
export interface Die { id: string; name: string; faces: Face[]; }
export interface RolledDie { dieId: string; v: number; el: Elem; }

const faces = (vals: number[], el: Elem): Face[] => vals.map((v) => ({ v, el }));
let dieSeq = 0;
const mkDie = (name: string, f: Face[]): Die => ({ id: `d${dieSeq++}`, name, faces: f });
export const plainDie = (): Die => mkDie('朴骰', faces([1, 2, 3, 4, 5, 6], 'none'));
export const elemDie = (c: Elem): Die => mkDie(`${ELEM_INFO[c].cn}骰`, faces([1, 2, 3, 4, 5, 6], c));
export const heavyDie = (): Die => mkDie('重骰', faces([4, 5, 6, 7, 8, 9], 'none'));
export const wildDie = (): Die => mkDie('百搭骰', faces([1, 2, 3, 4, 5, 6], 'wild'));

export function rollPool(pool: Die[], rnd: () => number): RolledDie[] {
  return pool.map((d) => { const f = d.faces[Math.floor(rnd() * d.faces.length)]!; return { dieId: d.id, v: f.v, el: f.el }; });
}

// ── 门槛挑战（可组合条件）─────────────────────────────────────────────────
export type Condition =
  | { kind: 'sum'; t: number }       // 总和 ≥ t
  | { kind: 'contains'; v: number }  // 含一个点数 v
  | { kind: 'pair' };                // 一对同色（两颗同色同点）
export function condLabel(c: Condition): string {
  if (c.kind === 'sum') return `总和≥${c.t}`;
  if (c.kind === 'contains') return `含一个 ${c.v}`;
  return '一对同色';
}

// ── 反制 ───────────────────────────────────────────────────────────────
export interface Counter { kind: 'none' | 'discardHighLow'; label: string; }

// ── 敌人 = HP + 门槛 + 反制 ──────────────────────────────────────────────
export interface Foe { name: string; isBoss: boolean; el: Elem; hp: number; maxHp: number; conds: Condition[]; counter: Counter; kindLabel: string; }
const FOE_NAMES = ['石魅', '焰怨', '苔妖', '潮灵', '砂卫'];

/** 按房间生成敌人（一层 3 间：砸血杂兵 / pattern 杂兵 / 混合 BOSS）。数值随 globalRoom 升·待模拟器调。 */
export function makeFoe(globalRoom: number, roomInAct: number): Foe {
  const tSum = Math.round(8 + globalRoom * 3); // 门槛随层升
  const el = FIVE[globalRoom % 5]!;
  let conds: Condition[]; let hp: number; let counter: Counter = { kind: 'none', label: '' }; let kindLabel: string;
  if (roomInAct === 0) {            // 砸血杂兵：低门槛·大血·多次砸
    conds = [{ kind: 'sum', t: Math.round(tSum * 0.7) }];
    hp = Math.round(tSum * 2.4); kindLabel = '砸血';
  } else if (roomInAct === 1) {     // pattern 杂兵：含某点·小血·一两手
    conds = [{ kind: 'sum', t: tSum }, { kind: 'contains', v: 6 }];
    hp = Math.round(tSum * 1.1); kindLabel = 'pattern';
  } else {                          // 混合 BOSS：高门槛 + 同色对 + 大血 + 反制
    conds = [{ kind: 'sum', t: Math.round(tSum * 1.25) }, { kind: 'pair' }];
    hp = Math.round(tSum * 2.2); counter = { kind: 'discardHighLow', label: '弃你最高+最低各一颗' }; kindLabel = 'BOSS';
  }
  return { name: (roomInAct === 2 ? '守关者·' : '') + FOE_NAMES[globalRoom % 5]!, isBoss: roomInAct === 2, el, hp, maxHp: hp, conds, counter, kindLabel };
}

/** 反制 → 被禁用的 rolled 索引（弃高低 = 最高 + 最低各一颗·不可投入）。 */
export function counterDisabled(rolled: RolledDie[], counter: Counter): Set<number> {
  const dis = new Set<number>();
  if (counter.kind === 'discardHighLow' && rolled.length >= 2) {
    let hi = 0, lo = 0;
    rolled.forEach((r, i) => { if (r.v > rolled[hi]!.v) hi = i; if (r.v < rolled[lo]!.v) lo = i; });
    dis.add(hi); dis.add(lo);
  }
  return dis;
}

// ── 评估一手是否满足门槛 ─────────────────────────────────────────────────
function hasPair(dice: RolledDie[]): boolean {
  const seen = new Map<string, number>();
  let wilds = 0;
  for (const r of dice) {
    if (r.el === 'wild') { wilds++; continue; }
    const k = `${r.el}-${r.v}`; seen.set(k, (seen.get(k) ?? 0) + 1);
    if ((seen.get(k) ?? 0) >= 2) return true;
  }
  if (wilds >= 1 && dice.some((r) => r.el !== 'wild')) return true; // 百搭顶任意色凑对
  return wilds >= 2;
}
export function evalCond(dice: RolledDie[], c: Condition): boolean {
  if (c.kind === 'sum') return dice.reduce((s, r) => s + r.v, 0) >= c.t;
  if (c.kind === 'contains') return dice.some((r) => r.v === c.v);
  return hasPair(dice);
}
export function handSum(dice: RolledDie[]): number { return dice.reduce((s, r) => s + r.v, 0); }
export function evalChallenge(dice: RolledDie[], conds: Condition[]): { met: boolean; results: { label: string; ok: boolean }[]; sum: number } {
  const results = conds.map((c) => ({ label: condLabel(c), ok: evalCond(dice, c) }));
  return { met: results.length > 0 && results.every((r) => r.ok), results, sum: handSum(dice) };
}

// ── 牌型乘子（player 的"乘法"·伤害 = 点数和 × 牌型倍率·creative-ideas #5）──
export interface Pattern { name: string; mult: number; }
const PAT: Record<string, Pattern> = {
  baozi: { name: '豹子', mult: 4.0 }, four: { name: '四条', mult: 3.5 }, full: { name: '葫芦', mult: 3.0 },
  straight: { name: '顺子', mult: 2.5 }, three: { name: '三条', mult: 2.5 }, flush: { name: '同色', mult: 2.0 },
  twopair: { name: '两对', mult: 2.0 }, pair: { name: '一对', mult: 1.5 }, high: { name: '高牌', mult: 1.0 },
};
/** 检测一手的最高牌型（点数同点=对/三/四/豹·颜色同色=同色·连续=顺子·百搭顶色/顶点）。 */
export function detectPattern(dice: RolledDie[]): Pattern {
  if (dice.length === 0) return PAT.high!;
  const valCount = new Map<number, number>(); const colCount = new Map<Elem, number>(); let wilds = 0;
  for (const r of dice) {
    if (r.el === 'wild') wilds++;
    valCount.set(r.v, (valCount.get(r.v) ?? 0) + 1);
    if (r.el !== 'wild') colCount.set(r.el, (colCount.get(r.el) ?? 0) + 1);
  }
  const counts = [...valCount.values()].sort((a, b) => b - a);
  const maxSame = (counts[0] ?? 0) + wilds;                 // 百搭顶点凑同点
  const pairs = counts.filter((c) => c >= 2).length;
  const maxColor = Math.max(0, ...[...colCount.values()]) + wilds; // 百搭顶色凑同色
  const uniq = [...new Set(dice.map((r) => r.v))].sort((a, b) => a - b);
  let run = 1, bestRun = 1; for (let i = 1; i < uniq.length; i++) { if (uniq[i] === uniq[i - 1]! + 1) { run++; bestRun = Math.max(bestRun, run); } else run = 1; }
  if (maxSame >= 5) return PAT.baozi!;
  if (maxSame >= 4) return PAT.four!;
  if (counts[0]! >= 3 && pairs >= 2) return PAT.full!;
  if (bestRun >= 4) return PAT.straight!;
  if (maxSame >= 3) return PAT.three!;
  if (maxColor >= 4) return PAT.flush!;
  if (pairs >= 2) return PAT.twopair!;
  if (maxSame >= 2) return PAT.pair!;
  return PAT.high!;
}
/** 一手伤害 = 点数和 × 牌型倍率。 */
export function damageOf(dice: RolledDie[]): { dmg: number; pat: Pattern; sum: number } {
  const sum = handSum(dice); const pat = detectPattern(dice);
  return { dmg: Math.round(sum * pat.mult), pat, sum };
}
