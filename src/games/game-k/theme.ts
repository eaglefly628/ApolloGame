// Game K · Zombie Slots —— 数值/主题数据（纯数据·最弱 LLM 也能产）。
//
// 老虎机的全部数学模型都摆在这里当数据：符号目录、加权轮带（→ dice-roll 的 DicePool）、
// 20 条赔付线、赔付表、经济数值。没有任何解释器写在这里——解释它们的是引擎能力
// （dice-roll 掷轮、t3-slot-payout 判线赔付）。美术风格：迪士尼亲和 + 次表面散射柔光（见 art.ts）。

// ── 符号 id（整数·骰面 value）────────────────────────────────────────────────
export const SYM = {
  T: 0, J: 1, Q: 2, K: 3, A: 4,   // 低分（碑文字牌）
  DOG: 5, GIRL: 6, DOC: 7,        // 高分（僵尸角色）
  WILD: 8, SCAT: 9,               // 百搭 / 分散
} as const;
export type SymId = (typeof SYM)[keyof typeof SYM];

export interface SymMeta { id: number; key: string; name: string; hue: number; tier: 'low' | 'high' | 'wild' | 'scatter'; }
export const SYMBOLS: SymMeta[] = [
  { id: SYM.T, key: 'T', name: 'Ten', hue: 176, tier: 'low' },
  { id: SYM.J, key: 'J', name: 'Jack', hue: 210, tier: 'low' },
  { id: SYM.Q, key: 'Q', name: 'Queen', hue: 280, tier: 'low' },
  { id: SYM.K, key: 'K', name: 'King', hue: 42, tier: 'low' },
  { id: SYM.A, key: 'A', name: 'Ace', hue: 8, tier: 'low' },
  { id: SYM.DOG, key: 'DOG', name: 'Zombie Hound', hue: 96, tier: 'high' },
  { id: SYM.GIRL, key: 'GIRL', name: 'Undead Bride', hue: 300, tier: 'high' },
  { id: SYM.DOC, key: 'DOC', name: 'Mad Scientist', hue: 52, tier: 'high' },
  { id: SYM.WILD, key: 'WILD', name: 'Zombie King (Wild)', hue: 120, tier: 'wild' },
  { id: SYM.SCAT, key: 'SCAT', name: 'Biohazard (Scatter)', hue: 82, tier: 'scatter' },
];
export const SYM_META: Record<number, SymMeta> = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));

// ── 赔付表：symbolId → { 连线数(3/4/5) → 线注倍率 }。SCAT 为分散(×总注) ────────
export const PAYTABLE: Record<number, Record<number, number>> = {
  [SYM.T]: { 3: 5, 4: 15, 5: 40 },
  [SYM.J]: { 3: 5, 4: 15, 5: 40 },
  [SYM.Q]: { 3: 10, 4: 25, 5: 60 },
  [SYM.K]: { 3: 10, 4: 25, 5: 60 },
  [SYM.A]: { 3: 15, 4: 40, 5: 90 },
  [SYM.DOG]: { 3: 20, 4: 60, 5: 150 },
  [SYM.GIRL]: { 3: 30, 4: 90, 5: 250 },
  [SYM.DOC]: { 3: 40, 4: 150, 5: 400 },
  [SYM.WILD]: { 3: 60, 4: 250, 5: 750 },
};
// 分散赔付：命中数 → 总注倍率（≥3 同时触发免费旋转）。
export const SCATTER_PAY: Record<number, number> = { 3: 2, 4: 10, 5: 50 };

// ── 网格 ─────────────────────────────────────────────────────────────────────
export const REELS = 5;
export const ROWS = 3;
// dice 下标约定（列优先）：cell(reel r, row y) = r*ROWS + y。blueprint 与 slot-payout 同此约定。
export const cellIndex = (reel: number, row: number): number => reel * ROWS + row;

// ── 加权轮带：每列一份符号权重表（重复次数=权重）。独立轮模型（逐格取样）──────────
// 百搭在首尾轮更稀（1）、中三轮略密（2）；分散全轮各 2。低分密、高分稀 = 大奖罕见。
function strip(w: Partial<Record<keyof typeof SYM, number>>): number[] {
  const out: number[] = [];
  for (const k in w) { const id = SYM[k as keyof typeof SYM]; for (let i = 0; i < (w[k as keyof typeof SYM] ?? 0); i++) out.push(id); }
  return out;
}
export const REEL_WEIGHTS: number[][] = [
  strip({ T: 6, J: 6, Q: 5, K: 5, A: 4, DOG: 3, GIRL: 2, DOC: 2, WILD: 1, SCAT: 2 }),
  strip({ T: 6, J: 6, Q: 5, K: 5, A: 4, DOG: 3, GIRL: 2, DOC: 2, WILD: 2, SCAT: 2 }),
  strip({ T: 6, J: 6, Q: 5, K: 5, A: 4, DOG: 3, GIRL: 2, DOC: 2, WILD: 2, SCAT: 2 }),
  strip({ T: 6, J: 6, Q: 5, K: 5, A: 4, DOG: 3, GIRL: 2, DOC: 2, WILD: 2, SCAT: 2 }),
  strip({ T: 6, J: 6, Q: 5, K: 5, A: 4, DOG: 3, GIRL: 2, DOC: 2, WILD: 1, SCAT: 2 }),
];

// ── 20 条赔付线：每条 = 每轮的行号(0=上,1=中,2=下)，左→右 ──────────────────────
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
  [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [0, 2, 0, 2, 0],
];

// ── 经济 / 特色数值 ──────────────────────────────────────────────────────────
export const START_BALANCE = 5000;
export const BET_MIN = 20;
export const BET_MAX = 500;
export const BET_STEP = 20;      // 线注 = 总注 / 20 条线 → 1..25（整数）
export const DEFAULT_BET = 20;
export const SCATTER_MIN = 3;    // ≥3 分散 = 触发免费旋转
export const FREE_AWARD = 10;    // 触发/再触发赠送的免费旋转数
export const FREE_MULTIPLIER = 2; // 免费旋转期间线赢 ×2
export const SEED = 0x5c0f21e9;   // 固定种子（确定性·bench 双跑可回放；序列逐旋进位 → 局内各旋不同）

// 中奖档位（× 总注）：大奖演出分级。
export const BIG_WIN = 15;
export const MEGA_WIN = 40;
export const ZOMBIE_WIN = 100;
export function winTier(win: number, bet: number): 'none' | 'win' | 'big' | 'mega' | 'zombie' {
  if (win <= 0) return 'none';
  const x = win / bet;
  if (x >= ZOMBIE_WIN) return 'zombie';
  if (x >= MEGA_WIN) return 'mega';
  if (x >= BIG_WIN) return 'big';
  return 'win';
}

// ── 画布尺寸（宿主定尺缩放盒）────────────────────────────────────────────────
export const FIELD_W = 960;
export const FIELD_H = 640;
export const TOP_BAR_H = 72;
export const BOTTOM_BAR_H = 104;

// ── UITheme（迪士尼亲和暖调 + 次表面散射毒绿柔光）────────────────────────────
import type { UITheme } from '@ui/components/index.js';
export const ZOMBIE_THEME: UITheme = {
  bg0: '#0a0f0b', bg1: '#111b12', bg2: '#17271a', bg3: '#20361f', pageBg: '#070b08',
  line: 'rgba(122,222,120,0.22)',
  text: '#eafff0', sub: '#a7c9ac', dim: '#6d8a72',
  jade: '#5ef08a', jadeWash: 'rgba(94,240,138,0.12)', jadeLine: 'rgba(94,240,138,0.5)',
  gold: '#ffd166',
  ok: '#7bed9f', okWash: 'rgba(123,237,159,0.14)', warn: '#ffb703', warnWash: 'rgba(255,183,3,0.14)',
  danger: '#ff6b6b',
  ink: '#0a2011',
  fontUi: "'Trebuchet MS','Segoe UI',system-ui,sans-serif",
  fontMono: "ui-monospace,'SFMono-Regular',Menlo,monospace",
  texture:
    'radial-gradient(circle at 50% 8%, rgba(94,240,138,0.10), transparent 60%),' +
    'radial-gradient(circle at 12% 90%, rgba(180,94,240,0.10), transparent 55%)',
  wash: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(3,7,5,0.55) 100%)',
};
