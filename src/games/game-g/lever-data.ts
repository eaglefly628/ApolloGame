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
