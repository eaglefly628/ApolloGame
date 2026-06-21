// Game G · 大厅共享小工具/常量（拆分自 lobby-screen.ts·零依赖叶子·供各 section 模块复用，免循环引用）。
export type EarthRarity = 'bronze' | 'silver' | 'gold';
export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const kfmt = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
export const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['♦', 'var(--diamond)'], ['♣', 'var(--club)']];
export const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
export const ENCH_TIER_CLR = ['', '#cd7f32', '#c4ccd6', '#e8cd82']; // 铜银金
export const KIND_LABEL: Record<string, string> = { odds: '概率·掷命', power: '战力·加成', combo: '牌型·连携', morale: '士气·将领', tempo: '节奏·行军', stamina: '续航·耐久', draw: '抽牌·手牌', lane: '路线·调度', siege: '攻城·破阵', arcane: '流派·印记' };
export function ggTip(inner: string): string { return `<div class="gg-tip">${inner}</div>`; }
export const tipRow = (label: string, value: string, color = 'var(--ink)'): string =>
  `<div class="gg-tip-row"><span>${label}</span><b style="color:${color}">${value}</b></div>`;
export type LuckyRoll = { val: number; label: string; line: string; color: string };
export interface FortuneView { rolls: number; max: number; keptVal: number | null } // 今日卦象状态（owner 2026-06-21·持久化于存档）
