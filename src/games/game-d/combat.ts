// Game D ·《骰途》战斗模型 —— 可玩原型/调参台的纯逻辑（从 scripts/game-d-balance-sim.mjs 移植）。
//
// ⚠️ 原型说明：这是「先做出能玩、慢慢调数值」的原型逻辑（owner 2026-06-29）。真正上线版战斗要走
// 数据驱动（蓝图 + 引擎 EventWhen/Effect/Resource 能力·同 game-e）——那需 M0 + 主程。本模块是验证手感
// + 调参用的游戏层纯函数，手感定了再迁。数值与 docs/design/game-d-balance-design.md / 模拟器一一对应。
//
// 纯函数 + 显式 rnd 注入（无 Math.random 散落·可测）。

export type Elem = 'jin' | 'mu' | 'shui' | 'huo' | 'tu' | 'none' | 'wild';

/** 元素展示：彩色 emoji（顺带给颜色·绕开 UI 5 色令牌限制）+ 中文名。 */
export const ELEM_INFO: Record<Elem, { emoji: string; cn: string }> = {
  jin: { emoji: '🟡', cn: '金' }, mu: { emoji: '🟢', cn: '木' }, shui: { emoji: '🔵', cn: '水' },
  huo: { emoji: '🔴', cn: '火' }, tu: { emoji: '🟤', cn: '土' }, none: { emoji: '⚪', cn: '无' }, wild: { emoji: '🌈', cn: '百搭' },
};
export const FIVE: Elem[] = ['jin', 'mu', 'shui', 'huo', 'tu'];
/** 相克五环：A 克 BEATS[A]（金→木→土→水→火→金）。 */
export const BEATS: Record<string, Elem> = { jin: 'mu', mu: 'tu', tu: 'shui', shui: 'huo', huo: 'jin' };

// ── 数值常量（= 设计文档 / 模拟器·调参在这）──────────────────────────────
const MULT_BY_M: Record<number, number> = { 1: 1.0, 2: 1.4, 3: 1.8, 4: 2.2, 5: 2.6 };
const COUNTER_HIT = 2.2, COUNTER_BAD = 0.3;
const BASE_HP = 22, GROWTH = 1.18, BOSS_MULT = 1.9;

export function counterMult(atk: Elem, def: Elem): number {
  if (atk === 'none' || atk === 'wild') return 1.0;
  if (BEATS[atk] === def) return COUNTER_HIT;
  if (BEATS[def] === atk) return COUNTER_BAD;
  return 1.0;
}
export function multByM(m: number): number { return m >= 6 ? 3.0 : (MULT_BY_M[m] ?? 1.0); }

// ── 骰子 ───────────────────────────────────────────────────────────────
export interface Face { v: number; el: Elem; }
export interface Die { id: string; name: string; faces: Face[]; }
export interface RolledDie { dieId: string; v: number; el: Elem; }

const faces = (vals: number[], el: Elem): Face[] => vals.map((v) => ({ v, el }));
let dieSeq = 0;
const mkDie = (name: string, f: Face[]): Die => ({ id: `d${dieSeq++}`, name, faces: f });
export const plainDie = () => mkDie('朴骰', faces([1, 2, 3, 4, 5, 6], 'none'));
export const elemDie = (c: Elem) => mkDie(`${ELEM_INFO[c].cn}骰`, faces([1, 2, 3, 4, 5, 6], c));
export const heavyDie = () => mkDie('重骰', faces([4, 5, 6, 7, 8, 9], 'none'));
export const wildDie = () => mkDie('百搭骰', faces([1, 2, 3, 4, 5, 6], 'wild'));

/** 掷一池骰：每颗随机取一面（rnd ∈ [0,1)）。 */
export function rollPool(pool: Die[], rnd: () => number): RolledDie[] {
  return pool.map((d) => { const f = d.faces[Math.floor(rnd() * d.faces.length)]!; return { dieId: d.id, v: f.v, el: f.el }; });
}

/** 给定玩家选中的一组骰 + 敌人元素，算这次攻击伤害（自动取最优主元素解读·对玩家友好）。 */
export function damageOf(selected: RolledDie[], enemyEl: Elem): { dmg: number; mainEl: Elem; mult: number; counter: number } {
  if (selected.length === 0) return { dmg: 0, mainEl: 'none', mult: 1, counter: 1 };
  let best = { dmg: -1, mainEl: 'none' as Elem, mult: 1, counter: 1 };
  // 中性解读（全算 none）
  const sumAll = selected.reduce((s, r) => s + r.v, 0);
  best = { dmg: sumAll, mainEl: 'none', mult: 1, counter: 1 };
  // 各元素主解读：投入算 base，E/wild 计入 m
  for (const E of FIVE) {
    let base = 0, m = 0;
    for (const r of selected) { base += r.v; if (r.el === E || r.el === 'wild') m += 1; }
    if (m === 0) continue;
    const mult = multByM(m), counter = counterMult(E, enemyEl);
    const dmg = Math.round(base * mult * counter);
    if (dmg > best.dmg) best = { dmg, mainEl: E, mult, counter };
  }
  return best;
}

// ── 敌人 ───────────────────────────────────────────────────────────────
export interface Enemy { name: string; hp: number; maxHp: number; el: Elem; isBoss: boolean; }
const ENEMY_NAMES = ['石魅', '焰怨', '苔妖', '潮灵', '砂卫'];
export function makeEnemy(globalRoom: number, isBoss: boolean, el: Elem, mode: 'single' | 'coop'): Enemy {
  let hp = BASE_HP * Math.pow(GROWTH, globalRoom - 1);
  if (isBoss) hp *= BOSS_MULT;
  if (mode === 'coop') hp *= 1.9;
  hp = Math.round(hp);
  return { name: isBoss ? '守关者·' + ENEMY_NAMES[(globalRoom) % 5] : ENEMY_NAMES[globalRoom % 5]!, hp, maxHp: hp, el, isBoss };
}

/** 敌人弱点（被谁克）= 对它 ×2.2 的攻击元素。 */
export function weaknessOf(enemyEl: Elem): Elem { return (Object.keys(BEATS) as Elem[]).find((a) => BEATS[a] === enemyEl) ?? 'none'; }
