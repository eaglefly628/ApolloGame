// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 事件屏「第一次纪念日」（LayoutNode·对齐 Designer frame a_event_anniversary）
//
//  640×480 内屏（黄昏紫 #15101f）居中竖排：
//    · 顶部 Silkscreen 微标「ONE YEAR · 一周年」（dim·tracking 3）
//    · 中部 Pixverse「一年前那天」相框（奶油 6px 边·内嵌像素黄昏窗景 SVG）+ 右下水印
//    · 下部 她的留言气泡（蓝左边框 #5a7a9a·奶油正文 3 行）
//  全 LayoutNode 数据 + ZANKYOU 字体槽。像素相片走 Image(data-URI SVG·svgUri)。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── Pixverse「一年前那天」相片：黄昏窗景 + 她（更小·第一天）（viewBox 60×40·对齐设计稿）──
function annivPhotoSvg(): string {
  return `
  <defs><linearGradient id="annivSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46406e"/><stop offset="1" stop-color="#e0935f"/></linearGradient></defs>
  <rect width="60" height="40" fill="#241b30"/>
  <rect x="6" y="4" width="48" height="24" fill="url(#annivSky)"/>
  <rect x="29" y="4" width="2" height="24" fill="#241b30"/><rect x="6" y="15" width="48" height="2" fill="#241b30"/>
  <rect width="60" height="12" y="28" fill="#3a2b22"/>
  <g transform="translate(24,18)"><rect x="2" y="8" width="14" height="9" fill="#46546b"/><rect x="5" y="2" width="8" height="7" fill="#d9b8a0"/><rect x="4" y="0" width="10" height="4" fill="#241f2e"/></g>
  <rect x="40" y="24" width="6" height="5" fill="#d9d2c4"/>`;
}

// ── Pixverse 相框（奶油 6px 边 + 内嵌像素相片 + 右下水印）─────────────────────
function photoFrame(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-anniv-framewrap', props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 6 },
    children: [
      {
        type: 'Panel', id: 'gx-anniv-frame', props: { bg: { custom: '#e8dcc8' } },
        layout: { width: 292, height: 199, padding: 6, align: 'center', justify: 'center' },
        children: [
          {
            type: 'Image', id: 'gx-anniv-photo',
            props: { src: svgUri(annivPhotoSvg(), '0 0 60 40'), fit: 'fill' },
            layout: { width: 280, height: 187 },
          },
        ],
      },
      {
        type: 'Panel', id: 'gx-anniv-caprow', props: { bare: true },
        layout: { direction: 'row', width: 292, justify: 'end' },
        children: [
          { type: 'Label', id: 'gx-anniv-cap', props: { text: 'Pixverse · 一年前那天', color: 'sub', size: 'xs' } },
        ],
      },
    ],
  };
}

// ── 她的留言气泡（蓝左边框 #5a7a9a·奶油正文·3 行）────────────────────────────
function messageBubble(): LayoutNode {
  const line = (id: string, text: string): LayoutNode =>
    ({ type: 'Label', id, props: { text, color: 'text', size: 'md' } });
  return {
    type: 'Panel', id: 'gx-anniv-bubblewrap', props: { bare: true },
    layout: { direction: 'row', width: 640, justify: 'center' },
    children: [
      {
        type: 'Panel', id: 'gx-anniv-bubble', props: { bg: { custom: '#211a30' } },
        layout: { width: 460, direction: 'column', gap: 4, padding: 14 },
        children: [
          // 蓝左边框（设计稿 border-left:2px #5a7a9a）
          {
            type: 'Panel', id: 'gx-anniv-bubble-accent', props: { bg: { custom: '#5a7a9a' } },
            layout: { x: 0, y: 0, width: 2, height: 96 },
          },
          line('gx-anniv-l1', '一年前的今天，你第一句话问我"在吗"。'),
          line('gx-anniv-l2', '……我那天没回你第二句。'),
          line('gx-anniv-l3', '你还记得吗？'),
        ],
      },
    ],
  };
}

// ── 整屏（设备外框 + 内屏内容）─────────────────────────────────────────────
export function eventAnniversaryScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-event-anniversary',
    chip: '第一次纪念日 · 林七月',
    interior: [
      {
        type: 'Panel', id: 'gx-anniv-body', props: { bare: true },
        layout: { width: 640, height: 480, direction: 'column', align: 'center', gap: 18, padding: 24 },
        children: [
          { type: 'Label', id: 'gx-anniv-tag', props: { text: 'ONE YEAR · 一周年', font: 'pixel', color: 'dim', size: 'xs', tracking: 3 } },
          photoFrame(),
          messageBubble(),
        ],
      },
    ],
  });
}
