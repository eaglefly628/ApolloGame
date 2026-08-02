// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Pocket Recap 屏（LayoutNode·像素级对齐 Designer frame a_pocket_recap）
//
//  「夜间复盘 · 宋 Mika」：拿起设备进入 Pocket 对话态，Mika 兴奋汇报今天画了三张、
//  楼下橘猫让她摸了，还配了一张猫的像素照片——活泼跳脱的主动倾诉。
//  640×480 设备内屏分三段：
//    · 顶栏 64px（渐变 #46324a→#221729·底 1px #3a2438）：圆形头像 Image(16×16 像素 SVG·
//      圆底 #e08a5f) + 名字「宋 Mika」+ 心情「· 停不下来 ✦」(珊瑚 jade) + 右侧 VT323 琥珀时钟「23:05」
//    · 聊天区 flex（padding 16 18·gap 9·六条气泡）：
//        她（左·#2a1f30·左 2px 珊瑚边 #ff9b6b·奶油字）/ 你（右·align:end·#2a2410·暖字 warn）
//        其中一条她的气泡内嵌猫的像素照片 Image(48×32 SVG·蓝天绿地橘猫) + 说明「今天的它 ↑」
//    · 输入栏 56px（#120e1a·底 1px #2a2038）：圆角输入框（占位「回复 Mika…」dim + 琥珀光标静态）
//      + 圆形珊瑚发送键 ▶
//  全 LayoutNode 数据 + ZANKYOU 字体槽（VT323/DotGothic16）。头像 / 猫照走 Image(svgUri 内联像素 SVG)。
//  纯 CSS 的光标闪烁（rp-caret）按规则渲染成静态琥珀竖条。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 顶栏头像：Mika 圆形像素头（viewBox 16×16·忠实移植设计稿 rect·圆底 #e08a5f）─────
function avatarUri(): string {
  const inner = `
  <rect x="1" y="3" width="3" height="9" fill="#6b4631"/>
  <rect x="3" y="2" width="10" height="6" fill="#6b4631"/>
  <rect x="4" y="5" width="9" height="9" fill="#e8c4a8"/>
  <rect x="6" y="9" width="1" height="2" fill="#3a2218"/>
  <rect x="9" y="9" width="1" height="2" fill="#3a2218"/>
  <rect x="11" y="10" width="1" height="1" fill="#46546b"/>`;
  return svgUri(inner, '0 0 16 16');
}

// ── 气泡内猫照：橘猫像素照片（viewBox 48×32·蓝天 #3a4f6b·绿地 #5e7a4a·橘猫 #e08a5f）───
function catUri(): string {
  const inner = `
  <rect x="0" y="0" width="48" height="32" fill="#3a4f6b"/>
  <rect x="0" y="22" width="48" height="10" fill="#5e7a4a"/>
  <rect x="20" y="14" width="12" height="10" fill="#e08a5f"/>
  <rect x="20" y="11" width="3" height="4" fill="#6b4631"/>
  <rect x="29" y="11" width="3" height="4" fill="#6b4631"/>
  <rect x="23" y="17" width="1" height="1" fill="#1a1622"/>
  <rect x="28" y="17" width="1" height="1" fill="#1a1622"/>`;
  return svgUri(inner, '0 0 48 32');
}

// ── 顶栏 64px（渐变底 + 头像 + 名字/心情 + VT323 时钟）─────────────────────────
function header(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-prec-header',
    props: { bg: { custom: 'linear-gradient(180deg,#46324a,#221729)' } },
    layout: { width: 640, height: 64, direction: 'row', align: 'center', gap: 12, padding: 18 },
    children: [
      {
        type: 'Image', id: 'gx-prec-avatar',
        props: { src: avatarUri(), fit: 'cover', radius: 20 },
        layout: { width: 40, height: 40 },
      },
      {
        type: 'Panel', id: 'gx-prec-id', props: { bare: true },
        layout: { direction: 'column', flex: 1 },
        children: [
          { type: 'Label', id: 'gx-prec-name', props: { text: '宋 Mika', color: 'text', size: 'md' } },
          { type: 'Label', id: 'gx-prec-mood', props: { text: '· 停不下来 ✦', color: 'jade', size: 'xs' } },
        ],
      },
      { type: 'Label', id: 'gx-prec-clock', props: { text: '23:05', font: 'display', color: 'gold', size: 'lg' } },
    ],
  };
}

// ── 单条气泡 ───────────────────────────────────────────────────────────────
//   她（左）：#2a1f30 底 + 左 2px 珊瑚边（用 2px 宽珊瑚条 Panel + 内容 Panel 拼出）+ 奶油字。
//   你（右）：#2a2410 底 + align:end + 暖字（warn≈#ffd9a8）。
function herBubble(id: string, text: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'row', width: 496 },
    children: [
      { type: 'Panel', id: `${id}-bar`, props: { bg: { custom: '#ff9b6b' } }, layout: { width: 2 } },
      {
        type: 'Panel', id: `${id}-body`, props: { bg: { custom: '#2a1f30' } },
        layout: { direction: 'column', padding: 10, flex: 1 },
        children: [
          { type: 'Label', id: `${id}-l`, props: { text, color: 'text', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 她的猫照气泡（左·珊瑚边·内嵌像素猫照 Image + 说明小字）─────────────────────────
function herPhotoBubble(id: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'row', width: 496 },
    children: [
      { type: 'Panel', id: `${id}-bar`, props: { bg: { custom: '#ff9b6b' } }, layout: { width: 2 } },
      {
        type: 'Panel', id: `${id}-body`, props: { bg: { custom: '#2a1f30' } },
        layout: { direction: 'column', gap: 4, padding: 7, flex: 1 },
        children: [
          {
            type: 'Image', id: `${id}-cat`,
            props: { src: catUri(), fit: 'cover', radius: 3 },
            layout: { width: 120, height: 80 },
          },
          { type: 'Label', id: `${id}-cap`, props: { text: '今天的它 ↑', color: 'sub', size: 'xs' } },
        ],
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
        type: 'Panel', id: `${id}-body`, props: { bg: { custom: '#2a2410' } },
        layout: { direction: 'column', padding: 10 },
        children: [
          { type: 'Label', id: `${id}-l`, props: { text, color: 'warn', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 聊天区（flex·padding 16 18·gap 9·六条夜间复盘对话）────────────────────────────
function chat(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-prec-chat', props: { bare: true },
    layout: { direction: 'column', width: 640, gap: 9, padding: 16, flex: 1 },
    children: [
      herBubble('gx-prec-b1', '你回来啦！！今天我画了三张'),
      herBubble('gx-prec-b2', '然后楼下的橘猫又来了，它今天居然让我摸了？？'),
      yourBubble('gx-prec-b3', '哈哈 给我看看猫'),
      herPhotoBubble('gx-prec-b4'),
      herBubble('gx-prec-b5', '对了你吃饭了没？？'),
    ],
  };
}

// ── 输入栏 56px（#120e1a·圆角输入框 + 琥珀光标静态 + 圆形珊瑚发送键）──────────────
function inputBar(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-prec-inputbar',
    props: { bg: { custom: '#120e1a' } },
    layout: { width: 640, height: 56, direction: 'row', align: 'center', gap: 10, padding: 14 },
    children: [
      {
        type: 'Panel', id: 'gx-prec-field', props: { bg: { custom: '#1e1828' } },
        layout: { height: 36, direction: 'row', align: 'center', gap: 2, padding: 14, flex: 1 },
        children: [
          { type: 'Label', id: 'gx-prec-ph', props: { text: '回复 Mika…', color: 'dim', size: 'sm' } },
          // 静态琥珀光标（设计稿的 rp-caret 闪烁渲成静态 2×16 竖条）
          { type: 'Panel', id: 'gx-prec-caret', props: { bg: { custom: '#ffb000' } }, layout: { width: 2, height: 16 } },
        ],
      },
      // 圆形珊瑚发送键 ▶（深色字标在亮底·用 dim 近似 #15101f 内屏底色字）
      {
        type: 'Panel', id: 'gx-prec-send', props: { bg: { custom: '#ff9b6b' } },
        layout: { width: 36, height: 36, direction: 'row', justify: 'center', align: 'center' },
        children: [
          { type: 'Label', id: 'gx-prec-send-i', props: { text: '▶', color: 'dim', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 整机（设备外框 + 内屏三段：顶栏 / 聊天 / 输入栏）────────────────────────────
export function pocketRecapScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-pocket-recap',
    chip: '夜间复盘 · 宋 Mika',
    interior: [header(), chat(), inputBar()],
  });
}
