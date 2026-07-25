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
export interface CellView { emoji: string; gen?: string; deliverable?: boolean; timer?: number; cover?: number } // timer=剩余秒；cover=阻碍层数（>0 盖住·不可拖）
export interface SlotView { itemEmoji: string; filled: boolean; want: boolean } // filled=已交付·want=板上有该物且此槽未满(可交付)
export interface OrderView { char: string; slots: SlotView[]; coins: number; stars: number; deliverable: boolean; mood: number; moodFace: string; timed?: boolean; timeLeft?: number; fly?: { id: string; label: string } }
export interface S1State {
  energy: number; coins: number; gems: number; level: number;
  cells: (CellView | null)[]; orders: OrderView[];
  burstCell?: number; // 合成迸发格（juice·render-only·该格叠一次性星光爆）
}

type N = LayoutNode;
const FRAME = '#f2e3c2';   // 板外框奶油
const WELL = '#7f97dd';    // 蓝色板井
const CELL_BG = '#c3cef0'; // 格底浅蓝
const GEN_BG = '#c8871e';  // 生成器格金
const COVER_BG = '#b8895a'; // 阻碍层沙色（覆盖格·挖掘解锁）

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
      // 整卡=交付落点（宿主按 DOM id 几何识别）。限时特惠订单=金框 + ⏱ 倒计时（动态限时菜单）。
      // ⚠ 异型外形待 PUI REQ-UI-异型容器（Panel 无 shape 枚举）——现用矩形金框顶着，本件落地即升级异型。
      // 金框(edge)非金底(bg)：保内部素底·徽章对比达标（金底会压暗 warn/ok 徽章）。
      type: 'Panel', id: `ord-${i}`, props: o.timed ? { bg: 'panel', edge: 'gold' } : { bg: 'panel' },
      layout: { direction: 'column', align: 'center', justify: 'between', gap: 6, padding: 10, radius: 18, flex: 1 },
      children: [
        {
          type: 'Panel', id: `ord-${i}-top`, props: { bare: true },
          layout: { direction: 'row', align: 'center', gap: 8 },
          children: [
            ...(o.timed && o.timeLeft != null ? [{ type: 'Badge', id: `ord-${i}-clk`, props: { text: `⏱${o.timeLeft}`, tone: 'warn' } } as N] : []),
            { type: 'Avatar', id: `ord-${i}-av`, props: { name: o.char, size: 52, shape: 'circle' } },
            {
              type: 'Panel', id: `ord-${i}-idn`, props: { bare: true },
              layout: { direction: 'column', align: 'start', gap: 2 },
              children: [
                {
                  type: 'Panel', id: `ord-${i}-nmrow`, props: { bare: true },
                  layout: { direction: 'row', align: 'center', gap: 4 },
                  children: [
                    { type: 'Label', id: `ord-${i}-nm`, props: { text: o.char, size: 'sm', bold: true } },
                    { type: 'Label', id: `ord-${i}-mf`, props: { text: o.moodFace, size: 'md' } }, // 心情脸（满意度越高越开心）
                  ],
                },
                { type: 'ProgressBar', id: `ord-${i}-mood`, props: { value: Math.round(o.mood * 100), max: 100, tone: 'ok' } }, // 满意度条
              ],
            },
          ],
        },
        {
          // 餐盘（托盘）：最多 3 slot 横排——已交付=✓ 绿槽·可交付=金槽高亮·未满=素槽显需求物。
          type: 'Panel', id: `ord-${i}-plate`, props: { bg: 'sunken' },
          layout: { direction: 'row', align: 'center', justify: 'center', gap: 6, padding: 8, radius: 16, flex: 1 },
          children: o.slots.map((sl, j) => ({
            type: 'Panel', id: `ord-${i}-s${j}`, props: { bg: sl.filled ? 'ok' : sl.want ? 'gold' : 'raised' },
            layout: { direction: 'column', align: 'center', justify: 'center', padding: 6, radius: 12, height: 68, flex: 1 },
            children: [
              sl.filled
                ? { type: 'Label', id: `ord-${i}-s${j}-v`, props: { text: '✓', size: 34, bold: true, color: 'ink' } } as N
                : { type: 'Label', id: `ord-${i}-s${j}-v`, props: { text: sl.itemEmoji, size: 40 } } as N,
            ],
          })),
        },
        {
          type: 'Panel', id: `ord-${i}-rw`, props: { bare: true },
          layout: { direction: 'row', align: 'center', justify: 'center', gap: 8 },
          children: [
            { type: 'Badge', id: `ord-${i}-rc`, props: { text: `🪙${o.coins}`, tone: 'warn' } },
            ...(o.stars > 0 ? [{ type: 'Badge', id: `ord-${i}-rs`, props: { text: `⭐${o.stars}`, tone: 'ok' } } as N] : []),
          ],
        },
        // 交付发奖飞行轨迹（juice·render-only）：金币从顾客卡沿弧飞进 HUD 钱包（flyTo→hud-coins）。绝对定位不占流。
        ...(o.fly ? [{
          type: 'Label', id: o.fly.id, props: { text: o.fly.label, size: 30, bold: true, color: 'gold' },
          layout: { x: 20, y: 8, allowOverlap: true, flyTo: { to: 'hud-coins', ms: 820, arc: 70 } },
        } as N] : []),
      ],
    })),
  };
}

// ── 蓝色合并板井（7×9·物品小巧·生成器金格·可交付✓）──────────────────────────
function board(s: S1State): N {
  const cells: N[] = s.cells.map((cv, i) => {
    const kids: N[] = [];
    // 阻碍层覆盖格（挖掘解锁）：沙色 🔒 + 剩余层数·不可拖（邻近二消挖开）。
    if (cv?.cover != null) {
      return {
        type: 'Panel', id: `t-live-${i}`, props: { bg: { custom: COVER_BG } },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 4, radius: 16, height: 168 },
        children: [
          { type: 'Label', id: `t-live-${i}-lk`, props: { text: '🔒', size: 52 } },
          { type: 'Label', id: `t-live-${i}-cl`, props: { text: `${cv.cover}`, size: 'lg', bold: true, color: 'ink' } },
        ],
      } as N;
    }
    if (cv) {
      kids.push({ type: 'Label', id: `t-live-${i}-l`, props: { text: cv.emoji, size: 74 } });
      if (cv.deliverable) kids.push({ type: 'Badge', id: `t-live-${i}-b`, props: { text: '✓', tone: 'ok' } });
      if (cv.timer != null) kids.push({ type: 'Badge', id: `t-live-${i}-t`, props: { text: `⏱${cv.timer}`, tone: 'warn' } }); // 限时物倒计时

    }
    // 合成迸发（juice·render-only）：该格叠一次性星光爆（基座 Particles·非自造 CSS）。绝对定位不占流。
    if (i === s.burstCell) kids.push({
      type: 'Particles', id: `t-live-${i}-burst`, props: { kind: 'stars', count: 14, loop: false },
      layout: { x: 0, y: 0, width: 120, height: 120, allowOverlap: true },
    } as N);
    return {
      type: 'Panel', id: `t-live-${i}`,
      props: cv?.gen ? { bg: { custom: GEN_BG }, action: `tap_${cv.gen}` } : { bg: { custom: CELL_BG } },
      layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 4, radius: 16, height: 168 },
      children: kids,
    } as N;
  });
  return {
    type: 'Panel', id: 'board', props: { bg: { custom: FRAME } },
    layout: { direction: 'column', gap: 0, padding: 10, radius: 22, flex: 1 },
    children: [
      {
        type: 'Panel', id: 'board-well', props: { bg: { custom: WELL } },
        layout: { direction: 'grid', cols: GAME.board.cols, gap: 6, padding: 8, radius: 16, flex: 1 },
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
