// Game C ·《六人德州》—— 视觉常量 + 夜宴系 UITheme（纯数据·零逻辑）。
// 色锚=场景线风格锚 `vegas-victoriana`（art-data-manual §1 唯一权威·照抄十六进制）；
// 人物线（头像/立绘/衣物图标）走 sakura-nijigen 双锚（REQ-C-ART 修订①·美术台账件·S6 接）。
// 布局基准=ui-brief §1 / art-data-manual §5：横屏 1280×720 逻辑分辨率。
import type { UITheme } from '@ui/components/index.js';
import type { Card } from '@engine/protocol/components.js';

export const FIELD_W = 1280;
export const FIELD_H = 720;

// ── 色板（art-data-manual §1·跨夜宴系统一）───────────────────────────────────
export const C = {
  nightBg: '#160e0a', nightBg2: '#0d0806',
  walnutGlow: '#33221a',
  panel0: '#1e140e', panel1: '#160f0b',
  cinnabar: '#c8352b',
  goldA: '#f0c96a', goldB: '#d3a247',
  goldEdge: '#e0b458', goldSoft: '#d8b878', goldPale: '#ecca8a',
  ivory: '#f3ece0',
  mute: '#b8a894', mute2: '#8a7862',
  jade: '#7fd6b0', jadeBack: '#0e2620',
  clay: '#e08a5a', clayBack: '#5a1a12',
  feltA: '#166f4f', feltB: '#0e5540', feltC: '#093a2c',
  cardRed: '#c0392b',
  outGray: '#8a8a94',
} as const;

// 页背景（暖夜黑径向渐变·3D 房间 M3 接前的程序化占位）。
export const ROOM_BG =
  'radial-gradient(ellipse at 50% 22%, #33221a 0%, #241812 45%, #160e0a 78%, #0d0806 100%)';
// 牌桌呢绒（占位 3D 桌面·真 3D=M3·美术贴图=S6 台账件）。
export const FELT_BG =
  'radial-gradient(ellipse at 50% 44%, #166f4f 0%, #0e5540 54%, #093a2c 100%)';
export const WRAPPER_BG = '#0a0605';

// 夜宴系 UITheme（令牌值照 §1 色板映射·换皮即改这一份·游戏 LayoutNode 数据零改）。
export const GAME_C_THEME: UITheme = {
  bg0: '#0d0806', bg1: '#1e140e', bg2: '#241812', bg3: '#2c1f16',
  pageBg: ROOM_BG,
  line: 'rgba(224,180,120,0.30)',
  text: '#f3ece0', sub: '#b8a894', dim: '#8a7862',
  jade: '#7fd6b0', jadeWash: 'rgba(127,214,176,0.12)', jadeLine: 'rgba(127,214,176,0.42)',
  gold: '#f0c96a',
  ok: '#7fd6b0', okWash: 'rgba(127,214,176,0.14)',
  warn: '#e0b458', warnWash: 'rgba(224,180,88,0.14)',
  danger: '#c8352b',
  ink: '#241009',
  fontUi: "'Noto Sans SC','Source Han Sans SC',system-ui,sans-serif",
  fontMono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  fontSerif: "'Noto Serif SC','Songti SC','Source Han Serif SC',serif",
};

// ── 对手座位屏幕锚点（art-data-manual §5.2·%·座位卡中心·固定相机=固定屏幕常量）──
export interface SeatAnchor { seat: number; name: string; xPct: number; yPct: number; }
export const OPPONENT_ANCHORS: readonly SeatAnchor[] = [
  { seat: 1, name: '大姨太', xPct: 87, yPct: 38 },
  { seat: 2, name: '二姨太', xPct: 71, yPct: 9 },
  { seat: 3, name: '三姨太', xPct: 22, yPct: 8 },
  { seat: 4, name: '四姨太', xPct: 12, yPct: 38 },
  { seat: 5, name: '五姨太', xPct: 20, yPct: 66 },
] as const;

// 座位卡尺寸（锚点=中心 → 绝对定位左上角需减半宽/半高）。
export const SEAT_W = 158;
export const SEAT_H = 92;

/** 锚点 %（中心）→ 绝对定位左上角 px（1280×720 基准）。 */
export function anchorTopLeft(a: SeatAnchor): { x: number; y: number } {
  return { x: Math.round((a.xPct / 100) * FIELD_W - SEAT_W / 2), y: Math.round((a.yPct / 100) * FIELD_H - SEAT_H / 2) };
}

// ── holdem-eval Card → PlayingCard props（花色符号 + 点数文本）──────────────────
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
const RANK_TXT: Record<number, string> = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };
export function cardFace(c: Card): { rank: string; suit: string } {
  return { rank: RANK_TXT[c.rank] ?? String(c.rank), suit: SUIT_SYM[c.suit] ?? '♠' };
}

// 牌型英文枚举 → 中文提示（底带牌型提示·art-data-manual §5.4「牌型」）。
export const HAND_NAME_CN: Record<string, string> = {
  'high-card': '高牌', 'pair': '一对', 'two-pair': '两对', 'three-of-a-kind': '三条',
  'straight': '顺子', 'flush': '同花', 'full-house': '葫芦', 'four-of-a-kind': '四条',
  'straight-flush': '同花顺',
};
