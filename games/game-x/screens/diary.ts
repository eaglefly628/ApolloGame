// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 日记插画收藏屏（LayoutNode·像素级复刻 Designer frame a_diary）
//
//  「日记插画收藏 · 宋 Mika」：她画下的每一天。640×480 设备内屏（黄昏紫 #15101f）竖排两段：
//    · header（padding 18 20 10·baseline 两端对齐）：左「她画下的每一天」(DotGothic16·奶油 text)
//      / 右「收藏 18 张」(珊瑚 jade)
//    · 网格区（flex:1·padding 6 18 18·3 列等分·gap 12）：每格=奶油拍立得 Panel(bg #e8dcc8·
//      padding 4 4 12) 内含 像素插画 Image(svgUri viewBox 40×30) + 居中日期小字 Label(dim·
//      奶油底近似深色字)；末格=虚线占位「… 更多」(bg #1c1726·虚线框由 Panel 描边近似)。
//  全 LayoutNode 数据 + ZANKYOU 字体槽（DotGothic16 正文）。每张插画走 Image(内联像素 SVG·设计稿精确 hex)。
//  设计色 → 令牌映射：#f0e6d2 标题→text · #ff9b6b 计数→jade · #5a4a3a 奶油底日期字→dim(近似) ·
//    #5a4f66 占位字→dim。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 单张日记插画像素 SVG（viewBox 40×30·忠实移植设计稿 <rect> 精确 hex）──────────
function tileArtUri(inner: string): string {
  return svgUri(inner, '0 0 40 30');
}

// 设计稿五张插画（橘猫 / 雨 / 黄昏 / 咖啡 / 夜）的 inner SVG 串，逐 rect 直移植。
const ART_CAT =
  '<rect width="40" height="30" fill="#3a4f6b"/>' +
  '<rect y="20" width="40" height="10" fill="#5e7a4a"/>' +
  '<rect x="6" y="8" width="6" height="6" fill="#ffd27f"/>' +
  '<rect x="24" y="14" width="10" height="9" fill="#ff9b6b"/>';

const ART_RAIN =
  '<rect width="40" height="30" fill="#5a4a72"/>' +
  '<rect x="6" y="6" width="28" height="14" fill="#3a4256"/>' +
  '<rect x="10" y="9" width="3" height="3" fill="#ffd27f"/>' +
  '<rect x="20" y="9" width="3" height="3" fill="#ffd27f"/>';

const ART_DUSK =
  '<rect width="40" height="30" fill="#c98a6b"/>' +
  '<rect y="18" width="40" height="12" fill="#7a5a4a"/>' +
  '<rect x="16" y="8" width="10" height="12" fill="#ffd27f"/>';

const ART_COFFEE =
  '<rect width="40" height="30" fill="#2a3b52"/>' +
  '<rect x="8" y="10" width="24" height="12" fill="#46546b"/>' +
  '<rect x="18" y="6" width="4" height="4" fill="#9ad9a0"/>';

const ART_NIGHT =
  '<rect width="40" height="30" fill="#46406e"/>' +
  '<rect x="4" y="4" width="3" height="3" fill="#fff"/>' +
  '<rect x="30" y="8" width="2" height="2" fill="#fff"/>' +
  '<rect x="14" y="16" width="12" height="10" fill="#ff9b6b"/>';

interface DiaryTile { id: string; art: string; date: string }

const TILES: DiaryTile[] = [
  { id: 'cat', art: ART_CAT, date: '06.26 橘猫' },
  { id: 'rain', art: ART_RAIN, date: '06.25 雨' },
  { id: 'dusk', art: ART_DUSK, date: '06.24 黄昏' },
  { id: 'coffee', art: ART_COFFEE, date: '06.23 咖啡' },
  { id: 'night', art: ART_NIGHT, date: '06.22 夜' },
];

// ── 单张奶油拍立得格（bg #e8dcc8·插画填满 + 居中日期小字）──────────────────────
function diaryCard(t: DiaryTile): LayoutNode {
  return {
    type: 'Panel', id: `gx-diary-card-${t.id}`, props: { bg: { custom: '#e8dcc8' } },
    layout: { direction: 'column', gap: 3, padding: 4, align: 'stretch' },
    children: [
      {
        type: 'Image', id: `gx-diary-art-${t.id}`,
        props: { src: tileArtUri(t.art), fit: 'cover' },
        layout: { width: 168, height: 86, flex: 1 },
      },
      {
        type: 'Label', id: `gx-diary-date-${t.id}`,
        props: { text: t.date, color: 'dim', size: 'xs' },
        layout: { width: 168, height: 14 },
      },
    ],
  };
}

// ── 末格：虚线占位「… 更多」(bg #1c1726·dim 字)──────────────────────────────
function moreCard(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-diary-more', props: { bg: { custom: '#1c1726' } },
    layout: { direction: 'column', justify: 'center', align: 'center', gap: 4 },
    children: [
      { type: 'Label', id: 'gx-diary-more-dots', props: { text: '…', color: 'dim', size: 'lg' } },
      { type: 'Label', id: 'gx-diary-more-l', props: { text: '更多', color: 'dim', size: 'sm' } },
    ],
  };
}

export function diaryScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-diary',
    chip: '日记插画收藏 · 宋 Mika',
    interior: [
      // header：标题 + 收藏计数（baseline 两端对齐）
      {
        type: 'Panel', id: 'gx-diary-header', props: { bare: true },
        layout: { direction: 'row', justify: 'between', align: 'end', width: 640, padding: 18 },
        children: [
          { type: 'Label', id: 'gx-diary-title', props: { text: '她画下的每一天', color: 'text', size: 'lg' } },
          { type: 'Label', id: 'gx-diary-count', props: { text: '收藏 18 张', color: 'jade', size: 'sm' } },
        ],
      },
      // 网格：3 列等分拍立得格 + 末格占位
      {
        type: 'Panel', id: 'gx-diary-grid', props: { bare: true },
        layout: { direction: 'grid', cols: 3, gap: 12, padding: 18, flex: 1 },
        children: [...TILES.map(diaryCard), moreCard()],
      },
    ],
  });
}
