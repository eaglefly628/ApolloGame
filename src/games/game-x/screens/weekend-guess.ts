// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 「猜你的一天」屏（LayoutNode·像素级对齐 Designer frame a_weekend_guess）
//
//  对齐设计稿 frame「猜你的一天 · 宋 Mika」：640×480 内屏（底 #15101f）三段竖排——
//    ① header(padding 22)：GUESS YOUR DAY(Silkscreen 珊瑚微标) + 两行 DotGothic16 正文
//    ② 猜测列表(flex·gap 12)：3 张猜测条·前两条「问句 + ✓/✗ 双钮」·末条「温柔句 + ？」（异色暖框）
//    ③ footer：进度圆点(2 实珊瑚 / 1 空) + 右侧「猜中 2 / 3」
//  全 LayoutNode 数据·Panel.bg 填设计稿精确 hex·Label 令牌字体/颜色·禁止手写 React/CSS。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';

// ── 头部（标题微标 + 引导两行）─────────────────────────────────────────────
function header(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-wg-header', props: { bare: true },
    layout: { direction: 'column', gap: 8, width: 640, padding: 22 },
    children: [
      { type: 'Label', id: 'gx-wg-kicker', props: { text: 'GUESS YOUR DAY', font: 'pixel', color: 'jade', size: 'xs', tracking: 2 } },
      { type: 'Label', id: 'gx-wg-title', props: { text: '我来猜猜你今天干了什么——', color: 'text', size: 'md' } },
      { type: 'Label', id: 'gx-wg-sub', props: { text: '（其实是想让你知道，我有在听）', color: 'sub', size: 'sm' } },
    ],
  };
}

// ── 猜测条 · 问句型（左侧问句 flex·右侧 ✓/✗ 两枚 34×34 方钮）───────────────────
function guessRow(id: string, text: string): LayoutNode {
  const chip = (cid: string, glyph: string, bg: string, line: string, color: 'ok' | 'danger'): LayoutNode => ({
    type: 'Panel', id: cid, props: { bg },
    layout: { width: 34, height: 34, direction: 'row', justify: 'center', align: 'center' },
    children: [{ type: 'Label', id: `${cid}-g`, props: { text: glyph, color, size: 'md' } }],
  });
  return {
    type: 'Panel', id, props: { bg: { custom: '#1e1828' } },
    layout: { direction: 'row', gap: 12, align: 'center', padding: 13 },
    children: [
      { type: 'Label', id: `${id}-q`, props: { text, color: 'text', size: 'sm' }, layout: { flex: 1 } },
      chip(`${id}-yes`, '✓', '#2a3320', '#4a6342', 'ok'),
      chip(`${id}-no`, '✗', '#2a1620', '#5a3040', 'danger'),
    ],
  };
}

// ── 猜测条 · 温柔句型（异色暖框 + 右侧 ？）──────────────────────────────────
function tenderRow(id: string, text: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: { custom: '#221b2e' } },
    layout: { direction: 'row', gap: 12, align: 'center', padding: 13 },
    children: [
      { type: 'Label', id: `${id}-q`, props: { text, color: 'text', size: 'sm' }, layout: { flex: 1 } },
      { type: 'Label', id: `${id}-mark`, props: { text: '？', color: 'jade', size: 'sm' } },
    ],
  };
}

// ── 底部进度条（圆点 + 计数）────────────────────────────────────────────────
function footer(): LayoutNode {
  const dot = (id: string, on: boolean): LayoutNode =>
    ({ type: 'Panel', id, props: { bg: on ? { custom: '#ff9b6b' } : { custom: '#3a2f48' } }, layout: { width: 8, height: 8 } });
  return {
    type: 'Panel', id: 'gx-wg-footer', props: { bare: true },
    layout: { direction: 'row', gap: 6, align: 'center', width: 640, padding: 14 },
    children: [
      dot('gx-wg-dot1', true),
      dot('gx-wg-dot2', true),
      dot('gx-wg-dot3', false),
      { type: 'Panel', id: 'gx-wg-spacer', props: { bare: true }, layout: { flex: 1 } },
      { type: 'Label', id: 'gx-wg-count', props: { text: '猜中 2 / 3', color: 'sub', size: 'sm' } },
    ],
  };
}

// ── 整屏（设备外壳 + 内屏三段）──────────────────────────────────────────────
export function weekendGuessScreen(): LayoutNode {
  const list: LayoutNode = {
    type: 'Panel', id: 'gx-wg-list', props: { bare: true },
    layout: { direction: 'column', gap: 12, flex: 1, padding: 4, width: 640 },
    children: [
      guessRow('gx-wg-r1', '你今天又熬夜赶东西了，对不对？'),
      guessRow('gx-wg-r2', '午饭……是不是又只喝了咖啡？'),
      tenderRow('gx-wg-r3', '但你有想起我一次。'),
    ],
  };
  return deviceShell({
    id: 'gx-weekend-guess',
    chip: '猜你的一天 · 宋 Mika',
    interior: [header(), list, footer()],
  });
}
