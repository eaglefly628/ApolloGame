// game101 · S1 主界面 —— buildS1(): LayoutNode（静态·validate 测/audit 用）+ buildS1Live(state)：**活板**。
//
// UI 铁律：全 LayoutNode 闭集控件·纯数据·零手写 DOM。buildS1Live 对齐 benchmark 设计稿（MergeBeach）——
//   不是美术风格而是**核心 gameplay 可用性**：点击目标够大、顾客需求看得清、可交付/冷却反馈齐全。
//   结构：HUD（等级/体力+计时/金币/宝石/商店）+ 顾客订单卡（头像+盘子放需求物·大而清晰+金币奖励+可交付✓）
//   + 蓝色合并板井（7×9·物品小巧 size74≈占格50%·生成器格金色·可交付格标✓）。全由引擎世界态每帧投影。
import type { LayoutNode } from '@ui/components/types.js';
import s1Tree from './layout/s1.layout.json';
import { GAME, ENERGY } from './theme.js';

export function buildS1(): LayoutNode {
  return s1Tree as unknown as LayoutNode;
}

// ── 活板状态 ─────────────────────────────────────────────────────────────────
export interface CellView { emoji: string; gen?: string; deliverable?: boolean }
export interface OrderView { char: string; itemEmoji: string; coins: number; deliverable: boolean }
export interface S1State {
  energy: number; coins: number; gems: number; level: number;
  cells: (CellView | null)[]; orders: OrderView[];
}

type N = LayoutNode;
const FRAME = '#f2e3c2';   // 板外框奶油
const WELL = '#7f97dd';    // 蓝色板井
const CELL_BG = '#c3cef0'; // 格底浅蓝
const GEN_BG = '#c8871e';  // 生成器格金

// ── HUD 行（等级 / 体力+计时 / 金币 / 宝石 / 商店）────────────────────────────
function hud(s: S1State): N {
  const pill = (id: string, glyph: string, val: string, color: 'gold' | 'jade' | 'text'): N => ({
    type: 'Panel', id, props: { bg: 'panel' },
    layout: { direction: 'row', align: 'center', gap: 4, padding: 8, radius: 16 },
    children: [
      { type: 'Label', id: `${id}-g`, props: { text: glyph, size: 'lg' } },
      { type: 'Label', id: `${id}-v`, props: { text: val, color, bold: true, size: 'lg' } },
    ],
  });
  return {
    type: 'Panel', id: 'hud', props: { bare: true },
    layout: { direction: 'row', align: 'center', justify: 'between', gap: 8, padding: 10 },
    children: [
      {
        type: 'Panel', id: 'hud-lvl', props: { bg: 'gold' },
        layout: { align: 'center', justify: 'center', padding: 10, radius: 26 },
        children: [{ type: 'Label', id: 'hud-lvl-l', props: { text: `Lv ${s.level}`, color: 'ink', bold: true } }],
      },
      {
        type: 'Panel', id: 'hud-energy', props: { bg: 'panel' },
        layout: { direction: 'row', align: 'center', gap: 8, padding: 8, radius: 16 },
        children: [
          { type: 'Label', id: 'hud-e-g', props: { text: '⚡', size: 'lg' } },
          { type: 'ProgressBar', id: 'hud-e-bar', props: { value: Math.round(s.energy), max: ENERGY.cap, tone: 'warn', showValue: true } },
        ],
      },
      pill('hud-coins', '🪙', `${Math.round(s.coins)}`, 'gold'),
      pill('hud-gems', '💎', `${s.gems}`, 'jade'),
      { type: 'Button', id: 'hud-cart', props: { label: '🛒', kind: 'primary', action: 'open_shop' } },
    ],
  };
}

// ── 顾客订单卡：头像 + 盘子（大而清晰的需求物）+ 金币奖励 + 可交付✓ ──────────────
function orders(s: S1State): N {
  return {
    type: 'Panel', id: 'orders', props: { bare: true },
    layout: { direction: 'row', align: 'stretch', justify: 'between', gap: 8, padding: 8 },
    children: s.orders.map((o, i) => ({
      type: 'Panel', id: `ord-${i}`, props: { bg: o.deliverable ? 'ok' : 'panel' },
      layout: { direction: 'column', align: 'center', gap: 3, padding: 8, radius: 16, flex: 1 },
      children: [
        {
          type: 'Panel', id: `ord-${i}-top`, props: { bare: true },
          layout: { direction: 'row', align: 'center', justify: 'between', gap: 6 },
          children: [
            { type: 'Avatar', id: `ord-${i}-av`, props: { name: o.char, size: 44, shape: 'rounded' } },
            ...(o.deliverable ? [{ type: 'Badge', id: `ord-${i}-ok`, props: { text: '✓ 可交付', tone: 'ok' } } as N] : []),
          ],
        },
        {
          type: 'Panel', id: `ord-${i}-plate`, props: { bg: 'raised' },
          layout: { direction: 'row', align: 'center', justify: 'center', gap: 6, padding: 8, radius: 14 },
          children: [
            { type: 'Label', id: `ord-${i}-it`, props: { text: o.itemEmoji, size: 44 } }, // 大·需求物看得清
            { type: 'Badge', id: `ord-${i}-rw`, props: { text: `🪙${o.coins}`, tone: 'warn' } },
          ],
        },
      ],
    })),
  };
}

// ── 蓝色合并板井（7×9·物品小巧·生成器金格·可交付✓）──────────────────────────
function board(s: S1State): N {
  const cells: N[] = s.cells.map((cv, i) => {
    const kids: N[] = [];
    if (cv) {
      kids.push({ type: 'Label', id: `t-live-${i}-l`, props: { text: cv.emoji, size: 74 } });
      if (cv.deliverable) kids.push({ type: 'Badge', id: `t-live-${i}-b`, props: { text: '✓', tone: 'ok' } });
    }
    return {
      type: 'Panel', id: `t-live-${i}`,
      props: cv?.gen ? { bg: { custom: GEN_BG }, action: `tap_${cv.gen}` } : { bg: { custom: CELL_BG } },
      layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 4, radius: 16, height: 150 },
      children: kids,
    } as N;
  });
  return {
    type: 'Panel', id: 'board', props: { bg: { custom: FRAME } },
    layout: { direction: 'column', gap: 0, padding: 10, radius: 22 },
    children: [
      {
        type: 'Panel', id: 'board-well', props: { bg: { custom: WELL } },
        layout: { direction: 'grid', cols: GAME.board.cols, gap: 6, padding: 8, radius: 16 },
        children: cells,
      },
    ],
  };
}

export function buildS1Live(s: S1State): LayoutNode {
  return {
    type: 'Screen', id: 's1', props: {},
    layout: { direction: 'column', gap: 8, padding: 12, width: 1080, height: 1920 },
    children: [hud(s), orders(s), board(s)],
  };
}
