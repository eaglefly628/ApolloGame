// game101 · S1 主界面 —— buildS1(): LayoutNode（Claude Design 稿 MergeBeach.dc.html 沙滩美食·1:1 复刻）。
//
// UI 铁律：全 LayoutNode 闭集控件（Screen/Panel/Label/Button/Avatar/Badge/ProgressBar）·纯数据·零手写 DOM。
// 稿=1:1 复刻基准（CLAUDE.md Claude Design 稿铁律）：竖屏·亮蓝沙滩风·HUD 行 / 4 顾客订单 / 7×9 合并板 / 底部生成器条。
// 交互写世界=action 信号（handler 无自由逻辑）：open_shop / gen_left / gen_right / serve_<n> / delete_sel / boost。
//
// 边界（UI 铁律）：`board-*` 为 **LayoutNode 占位·仅设计示意**；合并板正装=引擎 play-field render 组件
// （blueprint.ts merge-rule/prefab/资源/体力恢复·headless 绿）。把占位换成引擎实时棋盘=后续集成步。
// 美术：稿中 HUD/物品为参照观感；本树用 emoji/主题色占位，真皮走美术台账皮肤槽（PA 原创·禁抠稿 PNG）。
import type { LayoutNode } from '@ui/components/types.js';

// ── 沙滩物品 emoji 占位（皮肤槽就绪即换真套图·art-ledger.json）───────────────
const E = {
  coffee: '☕', latte: '🥛', croissant: '🥐', bread: '🍞', fries: '🍟', fish: '🐟',
  donut: '🍩', pretzel: '🥨', sandwich: '🥪', shell: '🐚', duck: '🦆', ring: '💍',
  machine: '⚙️', washer: '🫧', tea: '🧋', cake: '🍰', star: '⭐',
} as const;

// 板样例（7×9=63·灰盒占位·部分格带徽标/生成器高亮）。null=空格。
// { e:emoji, hi?:生成器高亮格, badge?:'check'|'crown'|'sparkle'|'clock' }
type Cell = { e: string; hi?: boolean; badge?: string } | null;
const BOARD: Cell[] = (() => {
  const b: Cell[] = new Array(63).fill(null);
  const put = (i: number, e: string, hi?: boolean, badge?: string): void => { b[i] = { e, hi, badge }; };
  put(0, E.shell, false, 'clock'); put(1, E.machine, true, 'clock'); put(2, E.croissant, false, 'clock');
  put(3, E.washer, true, 'sparkle'); put(4, E.machine, true, 'clock'); put(5, E.shell, false, 'sparkle'); put(6, E.washer, true, 'sparkle');
  put(7, E.shell, false, 'check'); put(8, E.duck); put(10, E.fish); put(11, E.tea); put(12, E.coffee, false, 'check'); put(13, E.fries);
  put(14, E.donut); put(16, E.fries); put(18, E.pretzel); put(19, E.donut); put(20, E.tea);
  put(25, E.shell); put(26, E.croissant); put(27, E.latte);
  put(28, E.sandwich); put(30, E.shell); put(31, E.bread); put(32, E.croissant); put(34, E.latte, false, 'check');
  put(39, E.cake); put(40, E.bread); put(41, E.donut);
  put(42, E.sandwich); put(43, E.latte, false, 'crown'); put(45, E.fish); put(46, E.coffee); put(47, E.latte, false, 'crown'); put(48, E.fries);
  put(57, E.ring); put(58, E.ring); put(60, E.ring); put(61, E.ring);
  return b;
})();

const BADGE_GLYPH: Record<string, string> = { check: '✅', crown: '👑', sparkle: '➤', clock: '⏱' };

// 顾客订单（4 张·头像首字 + 需求物 + 金币奖励 + 可交付态）。
const CUSTOMERS = [
  { id: 'c0', name: '林', item: E.sandwich, reward: 240, done: true },
  { id: 'c1', name: '周', item: E.latte, reward: 160, done: false },
  { id: 'c2', name: '陈', item: E.duck, reward: 56, done: false },
  { id: 'c3', name: '晴', item: E.ring, reward: 88, done: false },
];

function hudCell(id: string, glyph: string, value: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: 'panel' },
    layout: { direction: 'row', align: 'center', gap: 4, padding: 6, radius: 14 },
    children: [
      { type: 'Label', id: `${id}-g`, props: { text: glyph, size: 'lg' } },
      { type: 'Label', id: `${id}-v`, props: { text: value, color: 'text', bold: true } },
    ],
  };
}

function buildHud(): LayoutNode {
  return {
    type: 'Panel', id: 'hud', props: { bare: true },
    layout: { direction: 'row', align: 'center', justify: 'between', gap: 6, padding: 8 },
    children: [
      { type: 'Avatar', id: 'hud-lvl', props: { name: '33', size: 52, shape: 'circle' } },
      {
        type: 'Panel', id: 'hud-energy', props: { bg: 'panel' },
        layout: { direction: 'row', align: 'center', gap: 6, padding: 6, radius: 14 },
        children: [
          { type: 'Label', id: 'hud-e-i', props: { text: '⚡', size: 'lg' } },
          { type: 'ProgressBar', id: 'hud-e-bar', props: { value: 19, max: 100, tone: 'warn', showValue: true } },
          { type: 'Label', id: 'hud-e-t', props: { text: '⏱01:12', color: 'sub', size: 'sm' } },
        ],
      },
      hudCell('hud-coins', '🪙', '1'),
      hudCell('hud-gems', '💎', '30'),
      { type: 'Button', id: 'hud-cart', props: { label: '🛒', kind: 'primary', action: 'open_shop' } },
    ],
  };
}

function buildCustomerBar(): LayoutNode {
  return {
    type: 'Panel', id: 'orders', props: { bare: true },
    layout: { direction: 'row', align: 'stretch', justify: 'between', gap: 6, padding: 8 },
    children: CUSTOMERS.map((c) => ({
      type: 'Panel', id: c.id, props: {},
      layout: { direction: 'column', align: 'center', gap: 2, padding: 6, radius: 14 },
      children: [
        { type: 'Avatar', id: `${c.id}-av`, props: { name: c.name, size: 40, shape: 'circle' } },
        {
          type: 'Panel', id: `${c.id}-plate`, props: { bg: 'panel' },
          layout: { direction: 'row', align: 'center', justify: 'center', gap: 3, padding: 4, radius: 12 },
          children: [
            { type: 'Label', id: `${c.id}-it`, props: { text: c.done ? '✅' : c.item, size: 'lg' } },
            { type: 'Badge', id: `${c.id}-rw`, props: { text: `🪙${c.reward}`, tone: 'warn' } },
          ],
        },
      ],
    })),
  };
}

function buildBoard(): LayoutNode {
  return {
    type: 'Panel', id: 'board', props: {},
    layout: { direction: 'column', gap: 4, padding: 9, radius: 20 },
    children: [
      {
        type: 'Panel', id: 'board-well', props: { bg: 'panel' },
        layout: { direction: 'grid', cols: 7, gap: 4, padding: 5, radius: 14 },
        children: BOARD.map((cell, i) => {
          const kids: LayoutNode[] = [];
          if (cell) {
            kids.push({ type: 'Label', id: `bc-${i}-e`, props: { text: cell.e, size: 'xxl' } });
            if (cell.badge) kids.push({ type: 'Badge', id: `bc-${i}-b`, props: { text: BADGE_GLYPH[cell.badge] ?? '•', tone: cell.badge === 'check' ? 'ok' : cell.badge === 'sparkle' ? 'warn' : 'dim' } });
          }
          return {
            type: 'Panel', id: `bc-${i}`, props: { bg: cell?.hi ? 'gold' : 'panel' },
            layout: { direction: 'column', align: 'center', justify: 'center', gap: 1, padding: 6, radius: 12, height: 128 },
            children: kids,
          };
        }),
      },
    ],
  };
}

function buildBottomBar(): LayoutNode {
  return {
    type: 'Panel', id: 'toolbar', props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 6, padding: 8 },
    children: [
      { type: 'Button', id: 'gen-left', props: { label: '☕', kind: 'primary', action: 'gen_left' } },
      {
        type: 'Panel', id: 'sel-info', props: {},
        layout: { direction: 'row', align: 'center', gap: 6, padding: 8, radius: 18 },
        children: [
          { type: 'Label', id: 'sel-thumb', props: { text: '🍞', size: 'xl' } },
          {
            type: 'Panel', id: 'sel-meta', props: { bare: true },
            layout: { direction: 'column', gap: 1 },
            children: [
              { type: 'Label', id: 'sel-name', props: { text: '招牌面包 (Lv 3)', color: 'text', bold: true } },
              { type: 'Label', id: 'sel-hint', props: { text: 'MERGE 合并升级', color: 'warn', size: 'sm' } },
            ],
          },
          { type: 'Button', id: 'sel-del', props: { label: '🗑', kind: 'quiet', action: 'delete_sel' } },
        ],
      },
      { type: 'Button', id: 'gen-right', props: { label: '🫧', kind: 'primary', action: 'gen_right' } },
    ],
  };
}

export function buildS1(): LayoutNode {
  return {
    type: 'Screen', id: 's1', props: {},
    layout: { direction: 'column', gap: 8, padding: 12, width: 1080, height: 1920 },
    children: [
      buildHud(),
      buildCustomerBar(),
      buildBoard(),
      buildBottomBar(),
    ],
  };
}
