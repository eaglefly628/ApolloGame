// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Pocket Morning 屏（LayoutNode·像素级对齐 Designer frame a_pocket_morning）
//
//  「晨间问候 · 林七月」：拿起设备进入聊天态，七月发来早安。
//  640×480 设备内屏（底 #15101f）分三段：
//    · header 640×64：渐变条(#3a2f48→#1d182a) + 圆形像素头像 + 名字/在线态 + VT323 琥珀时钟 07:42
//    · messages flex:1（padding 18·gap 14）：居中日期分隔 + 她的蓝左边框气泡(#211a30) +
//        你的右对齐暖色气泡(#2a2410·暖橙字) + 她的第二条气泡 + 「她记得 · 近期记忆」小字
//    · input 640×56（底 #100d18）：药丸输入框(#1c1726 描边 #2e2640·占位字 + 静态琥珀光标) + 圆形琥珀发送键 ▶
//  全 LayoutNode 数据 + ZANKYOU 字体槽（VT323/Silkscreen/DotGothic16）。头像走 Image(svgUri 内联像素 SVG)。
//  设计色 → 令牌映射：奶油 #e8dcc8→text / #7a9aae 在线态→sub / #5a4f66 分隔→dim /
//    暖橙 #ffd9a8 你的字→warn / 琥珀 #caa05a·#ffb000→gold。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 圆形像素头像（七月·40×40·对齐设计稿 viewBox 16×16 rect·底 #46546b）────────
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

// ── header 640×64（渐变条 + 头像 + 名字/在线态 + VT323 时钟）──────────────────
function header(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-pm-header',
    props: { bg: 'linear-gradient(180deg,#3a2f48,#1d182a)' },
    layout: { width: 640, height: 64, direction: 'row', align: 'center', gap: 12, padding: 18 },
    children: [
      {
        type: 'Image', id: 'gx-pm-avatar',
        props: { src: avatarUri(), fit: 'cover', radius: 20 },
        layout: { width: 40, height: 40 },
      },
      {
        type: 'Panel', id: 'gx-pm-id', props: { bare: true },
        layout: { direction: 'column', gap: 2, flex: 1 },
        children: [
          { type: 'Label', id: 'gx-pm-name', props: { text: '林七月', color: 'text', size: 'md' } },
          { type: 'Label', id: 'gx-pm-status', props: { text: '· 在线 · 刚醒', color: 'sub', size: 'xs' } },
        ],
      },
      { type: 'Label', id: 'gx-pm-clock', props: { text: '07:42', font: 'display', color: 'gold', glow: true, size: 'lg' } },
    ],
  };
}

// ── 她的气泡（左·蓝左边框 #5a7a9a·底 #211a30·奶油字）────────────────────────
function herBubble(id: string, lines: string[]): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: '#211a30' },
    layout: { direction: 'column', gap: 2, padding: 10, maxWidth: 470 },
    children: lines.map((t, i): LayoutNode => ({
      type: 'Label', id: `${id}-l${i}`, props: { text: t, color: 'text', size: 'sm' },
    })),
  };
}

// ── 你的气泡（右对齐·暖色底 #2a2410·暖橙字 #ffd9a8→warn）────────────────────
function yourBubble(id: string, text: string): LayoutNode {
  return {
    type: 'Panel', id: `${id}-wrap`, props: { bare: true },
    layout: { direction: 'row', justify: 'end', width: 604 },
    children: [
      {
        type: 'Panel', id, props: { bg: '#2a2410' },
        layout: { direction: 'column', padding: 10, maxWidth: 470 },
        children: [
          { type: 'Label', id: `${id}-t`, props: { text, color: 'warn', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── input 640×56（药丸输入 + 静态琥珀光标 + 圆形琥珀发送键）────────────────────
function inputBar(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-pm-input',
    props: { bg: '#100d18' },
    layout: { width: 640, height: 56, direction: 'row', align: 'center', gap: 10, padding: 14 },
    children: [
      {
        type: 'Panel', id: 'gx-pm-field', props: { bg: '#1c1726' },
        layout: { direction: 'row', align: 'center', flex: 1, height: 36, padding: 14, gap: 2 },
        children: [
          { type: 'Label', id: 'gx-pm-ph', props: { text: '说点什么…', color: 'dim', size: 'sm' } },
          { type: 'Panel', id: 'gx-pm-caret', props: { bg: '#ffb000' }, layout: { width: 2, height: 16 } },
        ],
      },
      {
        type: 'Panel', id: 'gx-pm-send', props: { bg: '#ffb000' },
        layout: { width: 36, height: 36, direction: 'row', justify: 'center', align: 'center' },
        children: [
          { type: 'Label', id: 'gx-pm-send-i', props: { text: '▶', color: 'dim', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 整机（设备外框 + 内屏三段）──────────────────────────────────────────────
export function pocketMorningScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-pocket-morning',
    chip: '晨间问候 · 林七月',
    interior: [
      header(),
      // 消息区 flex:1（竖排·padding 18·gap 14）
      {
        type: 'Panel', id: 'gx-pm-msgs', props: { bare: true },
        layout: { direction: 'column', gap: 14, padding: 18, flex: 1, width: 640 },
        children: [
          // 居中日期分隔
          {
            type: 'Panel', id: 'gx-pm-date-wrap', props: { bare: true },
            layout: { direction: 'row', justify: 'center', width: 604 },
            children: [
              { type: 'Label', id: 'gx-pm-date', props: { text: '— 6月26日 周五 · 早上 —', color: 'dim', size: 'xs' } },
            ],
          },
          herBubble('gx-pm-b1', ['早。', '窗外有点阴，你今天要出门吗。']),
          yourBubble('gx-pm-b2', '要去交那个项目的初稿'),
          herBubble('gx-pm-b3', ['嗯。', '你上周就在说它了。', '……加油。']),
          { type: 'Label', id: 'gx-pm-memo', props: { text: '↑ 她记得 · 近期记忆', color: 'dim', size: 'xs' } },
        ],
      },
      inputBar(),
    ],
  });
}
