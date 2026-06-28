// Game G · 大厅共享小工具/常量（拆分自 lobby-screen.ts·零依赖叶子·供各 section 模块复用，免循环引用）。
// 去腐 2026-06-28：手写 DOM 大厅删除后遗留的 kfmt/ENCH_TIER_CLR/KIND_LABEL/ggTip/tipRow/EarthRarity 全无引用→已剪。
export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['♦', 'var(--diamond)'], ['♣', 'var(--club)']];
export const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
export type LuckyRoll = { val: number; label: string; line: string; color: string };
export interface FortuneView { rolls: number; max: number; keptVal: number | null } // 今日卦象状态（owner 2026-06-21·持久化于存档）
