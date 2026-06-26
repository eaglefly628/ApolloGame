// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Pocket Memory 屏（LayoutNode·像素级对齐 Designer frame a_pocket_memory）
//
//  「记忆驱动 · 边界」：拿起设备进入 Pocket 对话态，七月引用两个月前你说过的话，
//  拒绝替你做决定——AI 对话的记忆与边界。640×480 设备内屏分三段：
//    · 顶栏 64px（渐变 #3a2f48→#1d182a）：圆形头像 Image(16×16 像素 SVG) +
//      名字「林七月」+ 心情「· 若有所思」+ 右侧 VT323 琥珀时钟「22:13」
//    · 聊天区 flex（padding 18·gap 13）：逐条气泡 Panel——
//        她（左·#211a30·左 2px 蓝边 #5a7a9a·奶油字）/ 你（右·align:end·#2a2410·暖字）
//    · 输入栏 56px（#100d18）：圆角输入框（草稿「谢谢」+ 琥珀光标静态）+ 圆形琥珀发送键 ▶
//  全 LayoutNode 数据 + ZANKYOU 字体槽（VT323/DotGothic16）。头像走 Image(svgUri 内联像素 SVG)。
//  纯 CSS 的光标闪烁（rp-caret）按规则渲染成静态琥珀竖条。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 顶栏头像：七月圆形像素头（viewBox 16×16·忠实移植设计稿 rect·圆底 #46546b）─────
function avatarUri(): string {
  const inner = `
  <rect x="0" y="0" width="16" height="16" fill="#46546b"/>
  <rect x="3" y="2" width="10" height="6" fill="#241f2e"/>
  <rect x="2" y="4" width="3" height="8" fill="#241f2e"/>
  <rect x="11" y="4" width="3" height="9" fill="#241f2e"/>
  <rect x="4" y="5" width="8" height="9" fill="#d9b8a0"/>
  <rect x="6" y="9" width="1" height="2" fill="#1a1622"/>
  <rect x="9" y="9" width="1" height="2" fill="#1a1622"/>`;
  return svgUri(inner, '0 0 16 16');
}

// ── 顶栏 64px（渐变底 + 头像 + 名字/心情 + VT323 时钟）─────────────────────────
function header(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-pmem-header',
    props: { bg: 'linear-gradient(180deg,#3a2f48,#1d182a)' },
    layout: { width: 640, height: 64, direction: 'row', align: 'center', gap: 12, padding: 18 },
    children: [
      {
        type: 'Image', id: 'gx-pmem-avatar',
        props: { src: avatarUri(), fit: 'cover', radius: 20 },
        layout: { width: 40, height: 40 },
      },
      {
        type: 'Panel', id: 'gx-pmem-id', props: { bare: true },
        layout: { direction: 'column', flex: 1 },
        children: [
          { type: 'Label', id: 'gx-pmem-name', props: { text: '林七月', color: 'text', size: 'md' } },
          { type: 'Label', id: 'gx-pmem-mood', props: { text: '· 若有所思', color: 'sub', size: 'xs' } },
        ],
      },
      { type: 'Label', id: 'gx-pmem-clock', props: { text: '22:13', font: 'display', color: 'gold', size: 'lg' } },
    ],
  };
}

// ── 单条气泡 ───────────────────────────────────────────────────────────────
//   她（左）：#211a30 底 + 左 2px 蓝边（用 border-left 渐变近似）+ 奶油字。
//   你（右）：#2a2410 底 + align:end + 暖字（warn≈#ffd9a8）。
//   左边框用一个 2px 宽蓝条 Panel + 内容 Panel 拼出（PanelProps 无单边 border 字段·用复合）。
function herBubble(id: string, lines: string[]): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'row', width: 460 },
    children: [
      { type: 'Panel', id: `${id}-bar`, props: { bg: '#5a7a9a' }, layout: { width: 2 } },
      {
        type: 'Panel', id: `${id}-body`, props: { bg: '#211a30' },
        layout: { direction: 'column', gap: 2, padding: 10, flex: 1 },
        children: lines.map((t, i) => ({
          type: 'Label' as const, id: `${id}-l${i}`,
          props: { text: t, color: 'text' as const, size: 'sm' as const },
        })),
      },
    ],
  };
}

function yourBubble(id: string, text: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'row', width: 604, justify: 'end' },
    children: [
      {
        type: 'Panel', id: `${id}-body`, props: { bg: '#2a2410' },
        layout: { direction: 'column', padding: 10 },
        children: [
          { type: 'Label', id: `${id}-l`, props: { text, color: 'warn', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 聊天区（flex·padding 18·gap 13·五条记忆对话）──────────────────────────────
function chat(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-pmem-chat', props: { bare: true },
    layout: { direction: 'column', width: 640, gap: 13, padding: 18, flex: 1 },
    children: [
      herBubble('gx-pmem-b1', ['你两个月前说，你讨厌别人替你做决定。']),
      yourBubble('gx-pmem-b2', '我说过吗'),
      herBubble('gx-pmem-b3', ['说过。', '所以你刚才问我"我该怎么做"——', '我不会替你回答。']),
      yourBubble('gx-pmem-b4', '……有点讨厌你说得对'),
      herBubble('gx-pmem-b5', ['嗯。']),
    ],
  };
}

// ── 输入栏 56px（#100d18·圆角输入框 + 琥珀光标静态 + 圆形发送键）────────────────
function inputBar(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-pmem-inputbar',
    props: { bg: '#100d18' },
    layout: { width: 640, height: 56, direction: 'row', align: 'center', gap: 10, padding: 14 },
    children: [
      {
        type: 'Panel', id: 'gx-pmem-field', props: { bg: '#1c1726' },
        layout: { height: 36, direction: 'row', align: 'center', gap: 2, padding: 14, flex: 1 },
        children: [
          { type: 'Label', id: 'gx-pmem-draft', props: { text: '谢谢', color: 'text', size: 'sm' } },
          // 静态琥珀光标（设计稿的 rp-caret 闪烁渲成静态 2×16 竖条）
          { type: 'Panel', id: 'gx-pmem-caret', props: { bg: '#ffb000' }, layout: { width: 2, height: 16 } },
        ],
      },
      // 圆形琥珀发送键 ▶（深色字标在亮底·用 dim 近似 #15101f 内屏底色字）
      {
        type: 'Panel', id: 'gx-pmem-send', props: { bg: '#ffb000' },
        layout: { width: 36, height: 36, direction: 'row', justify: 'center', align: 'center' },
        children: [
          { type: 'Label', id: 'gx-pmem-send-i', props: { text: '▶', color: 'dim', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 整机（设备外框 + 内屏三段：顶栏 / 聊天 / 输入栏）────────────────────────────
export function pocketMemoryScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-pocket-memory',
    chip: 'AI 对话 · 记忆驱动 · 边界',
    interior: [header(), chat(), inputBar()],
  });
}
