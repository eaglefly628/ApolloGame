// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 一起听一首歌（Pocket·Now Listening Together 屏）
//
//  对齐 Designer frame「一起听一首歌 · 林七月」（a_weekend_song.html）：
//  640×480 内屏居中竖排——NOW LISTENING TOGETHER 微标 / 150×150 唱片封面像素图
//  / 曲名「雨夜 · lo-fi」/ 副标「为今晚生成 · 3:24」/ 7 条均衡器（静态渲染）
//  / 380×4 琥珀进度条(42%) / 她的左侧蓝边评论气泡。
//  全 LayoutNode 数据 + ZANKYOU 字体槽（Silkscreen/DotGothic16）；封面走 Image(内联像素 SVG)。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 唱片封面像素图（viewBox 30×30·对齐设计稿磁带/唱片：蓝底 + 琥珀轴心）────────
function coverUri(): string {
  const inner =
    '<rect width="30" height="30" fill="#2a3b52"/>' +
    '<rect x="6" y="6" width="18" height="18" fill="#46546b"/>' +
    '<circle cx="15" cy="15" r="5" fill="#0a0810"/>' +
    '<circle cx="15" cy="15" r="1.5" fill="#ffb000"/>' +
    '<rect x="13" y="2" width="4" height="4" fill="#5a7a9a"/>';
  return svgUri(inner, '0 0 30 30');
}

// ── 均衡器（7 条·静态渲染·色彩对齐设计稿逐条 hex）─────────────────────────
function equalizer(): LayoutNode {
  const bars: Array<{ h: number; c: string }> = [
    { h: 20, c: '#5a7a9a' },
    { h: 30, c: '#7a6a9a' },
    { h: 34, c: '#ffb000' },
    { h: 16, c: '#b86a8a' },
    { h: 26, c: '#5a7a9a' },
    { h: 22, c: '#ff9b6b' },
    { h: 12, c: '#7a6a9a' },
  ];
  return {
    type: 'Panel', id: 'gx-ws-eq', props: { bare: true },
    layout: { direction: 'row', gap: 4, align: 'end', height: 34 },
    children: bars.map((b, i) => ({
      type: 'Panel', id: `gx-ws-eq-${i}`, props: { bg: b.c },
      layout: { width: 5, height: b.h },
    })),
  };
}

export function weekendSongScreen(): LayoutNode {
  const interior: LayoutNode[] = [
    // NOW LISTENING TOGETHER 微标（Silkscreen·dim·tracking 3）
    {
      type: 'Label', id: 'gx-ws-hdr',
      props: { text: 'NOW LISTENING TOGETHER', font: 'pixel', color: 'dim', size: 'xs', tracking: 3 },
      layout: { margin: 26 },
    },
    // 封面框 150×150（#1c1726 卡片底·内 120×120 像素唱片）
    {
      type: 'Panel', id: 'gx-ws-cover', props: { bg: { custom: '#1c1726' } },
      layout: { width: 150, height: 150, direction: 'row', justify: 'center', align: 'center', margin: 22 },
      children: [
        {
          type: 'Image', id: 'gx-ws-cover-art',
          props: { src: coverUri(), fit: 'contain' },
          layout: { width: 120, height: 120 },
        },
      ],
    },
    // 曲名（DotGothic16·奶油）
    {
      type: 'Label', id: 'gx-ws-title',
      props: { text: '雨夜 · lo-fi', color: 'text', size: 'lg' },
      layout: { margin: 18 },
    },
    // 副标（为今晚生成·时长）—— #8a7d92 ≈ sub
    {
      type: 'Label', id: 'gx-ws-sub',
      props: { text: '为今晚生成 · 3:24', color: 'sub', size: 'sm' },
    },
    // 均衡器
    equalizer(),
    // 进度条 380×4（#2a2036 槽·42% 琥珀填充）
    {
      type: 'Panel', id: 'gx-ws-track', props: { bg: { custom: '#2a2036' } },
      layout: { width: 380, height: 4, direction: 'row', margin: 20 },
      children: [
        {
          type: 'Panel', id: 'gx-ws-fill', props: { bg: { custom: '#ffb000' } },
          layout: { width: 160, height: 4 },
        },
      ],
    },
    // 她的评论气泡（左侧蓝边·#211a30 底·430 宽）
    {
      type: 'Panel', id: 'gx-ws-bubble', props: { bg: { custom: '#211a30' } },
      layout: { width: 430, padding: 13, margin: 24, direction: 'column' },
      children: [
        {
          type: 'Label', id: 'gx-ws-bubble-text',
          props: { text: '这首让我想起去年那场雨。你听到第二段那里——会不会也觉得有点想哭。', color: 'text', size: 'md' },
        },
      ],
    },
  ];

  return deviceShell({
    id: 'gx-weekend-song',
    chip: '一起听一首歌 · 林七月',
    interior: [
      {
        type: 'Panel', id: 'gx-ws-stack', props: { bare: true },
        layout: { width: 640, height: 480, direction: 'column', align: 'center', justify: 'center', gap: 10, padding: 20 },
        children: interior,
      },
    ],
  });
}
