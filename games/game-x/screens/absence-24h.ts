// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Absence +24H 屏（LayoutNode·像素级对齐 Designer frame a_absence24）
//
//  「她把书摊开放着，像在等」：离开你 24 小时后的桌面态。
//  640×480 设备内屏分三段：
//    · 场景 640×300（空椅 + 摊开的书 + 暗下来的窗·viewBox 320×150 slice）+ 右上「○ AWAY 24H」徽
//    · 信息带 640×172（底 #0c0913）：左 VT323 琥珀时钟 21:30·11 / 日期 / 天气；右 NOW 文案 + LAST SEEN
//    · 情感温度线 640×8（冷蓝渐变·她不在身边·比 Desk Mode 更冷）
//  全 LayoutNode 数据 + ZANKYOU 字体槽（VT323/Silkscreen/DotGothic16）。场景走 Image(svgUri 内联像素 SVG)。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 空椅场景像素 SVG（忠实移植设计稿 rect·暗下来的房间·她坐着低头看门）──────────
//    viewBox 0 0 320 150，preserveAspectRatio 由 svgUri 给（meet）；填进 640×300 区域。
function absenceSceneUri(): string {
  const inner = `
  <defs>
    <linearGradient id="sky24" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2a44"/><stop offset="1" stop-color="#5a4a5e"/></linearGradient>
    <radialGradient id="lamp24" cx="0.5" cy="0.4" r="0.55"><stop offset="0" stop-color="#ffd27f" stop-opacity="0.32"/><stop offset="1" stop-color="#ffd27f" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="320" height="150" fill="#221c30"/>
  <rect x="0" y="0" width="320" height="60" fill="#1d1828"/>
  <rect x="150" y="14" width="120" height="86" fill="#13101d"/>
  <rect x="155" y="19" width="110" height="76" fill="url(#sky24)"/>
  <rect x="208" y="19" width="4" height="76" fill="#13101d"/>
  <rect x="155" y="54" width="110" height="4" fill="#13101d"/>
  <rect x="20" y="8" width="300" height="120" fill="url(#lamp24)"/>
  <rect x="278" y="78" width="6" height="34" fill="#2a2036"/>
  <rect x="270" y="70" width="26" height="10" fill="#caa05a"/>
  <rect x="274" y="80" width="18" height="3" fill="#e8b96a"/>
  <rect x="0" y="112" width="320" height="38" fill="#352720"/>
  <rect x="0" y="112" width="320" height="4" fill="#473329"/>
  <rect x="20" y="100" width="46" height="12" fill="#d9d2c4"/>
  <rect x="42" y="100" width="2" height="12" fill="#b0a890"/>
  <rect x="18" y="98" width="50" height="3" fill="#7a5a52"/>
  <g transform="translate(150,58)" opacity="0.95">
    <rect x="44" y="6" width="8" height="54" fill="#2a2036"/>
    <rect x="6" y="34" width="40" height="26" fill="#3e4858"/>
    <rect x="18" y="26" width="14" height="10" fill="#c9aa94"/>
    <rect x="15" y="6" width="22" height="24" fill="#c9aa94"/>
    <rect x="13" y="2" width="26" height="12" fill="#201b2a"/>
    <rect x="11" y="8" width="6" height="20" fill="#201b2a"/>
    <rect x="35" y="8" width="6" height="22" fill="#201b2a"/>
    <rect x="20" y="18" width="3" height="2" fill="#1a1622"/>
    <rect x="29" y="18" width="3" height="2" fill="#1a1622"/>
  </g>`;
  return svgUri(inner, '0 0 320 150');
}

// ── 信息带 · 时钟列（168px·VT323 琥珀磷光 21:30 + 秒 11 + 日期 + 天气）────────
function clockCol(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-abs24-clockcol', props: { bg: { custom: '#0c0913' } },
    layout: { width: 168, height: 172, direction: 'column', justify: 'center', padding: 16, gap: 6 },
    children: [
      {
        type: 'Panel', id: 'gx-abs24-clockrow', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'end' },
        children: [
          { type: 'Label', id: 'gx-abs24-clock', props: { text: '21:30', font: 'display', color: 'gold', glow: true, size: 'xl' } },
          { type: 'Label', id: 'gx-abs24-sec', props: { text: '11', font: 'display', color: 'gold', size: 'lg' } },
        ],
      },
      { type: 'Label', id: 'gx-abs24-date', props: { text: '6月27日 周六', font: 'display', color: 'gold', size: 'md', tracking: 1 } },
      { type: 'Label', id: 'gx-abs24-wx', props: { text: '🌙 阴 · 17°', font: 'ui', color: 'sub', size: 'sm' } },
    ],
  };
}

// ── 信息带 · 状态列（NOW 文案 + LAST SEEN）────────────────────────────────
function statusCol(): LayoutNode {
  const micro = (id: string, text: string): LayoutNode =>
    ({ type: 'Label', id, props: { text, font: 'pixel', color: 'dim', size: 'xs', tracking: 2 } });
  return {
    type: 'Panel', id: 'gx-abs24-statuscol', props: { bg: { custom: '#0c0913' } },
    layout: { width: 472, height: 172, direction: 'column', justify: 'center', padding: 20, gap: 12 },
    children: [
      {
        type: 'Panel', id: 'gx-abs24-now', props: { bare: true },
        layout: { direction: 'column', gap: 5 },
        children: [
          micro('gx-abs24-now-l', 'NOW'),
          { type: 'Label', id: 'gx-abs24-now-t', props: { text: '书摊开放着，没有合上。她偶尔看一眼门的方向。', color: 'text', size: 'lg' } },
        ],
      },
      {
        type: 'Panel', id: 'gx-abs24-meta', props: { bare: true },
        layout: { direction: 'row', gap: 24 },
        children: [
          {
            type: 'Panel', id: 'gx-abs24-last', props: { bare: true }, layout: { direction: 'column', gap: 4 },
            children: [micro('gx-abs24-last-l', 'LAST SEEN'), { type: 'Label', id: 'gx-abs24-last-t', props: { text: '昨天 21:14', color: 'sub', size: 'sm' } }],
          },
        ],
      },
    ],
  };
}

// ── 整机（设备外框 + 内屏三段）──────────────────────────────────────────
export function absence24Screen(): LayoutNode {
  return deviceShell({
    id: 'gx-absence-24h',
    chip: '+24H · 她把书摊开放着，像在等',
    interior: [
      // 场景 640×300（含右上 AWAY 徽·绝对定位叠在场景上）
      {
        type: 'Panel', id: 'gx-abs24-scenewrap', props: { bare: true },
        layout: { width: 640, height: 300, direction: 'column' },
        children: [
          {
            type: 'Image', id: 'gx-abs24-scene',
            props: { src: absenceSceneUri(), fit: 'cover' },
            layout: { width: 640, height: 300 },
          },
          {
            type: 'Panel', id: 'gx-abs24-away', props: { bg: { custom: 'rgba(10,8,16,.7)' } },
            layout: { x: 538, y: 12, direction: 'row', align: 'center', padding: 4 },
            children: [
              { type: 'Label', id: 'gx-abs24-away-t', props: { text: '○ AWAY 24H', font: 'pixel', color: 'sub', size: 'xs', tracking: 1 } },
            ],
          },
        ],
      },
      // 信息带 640×172
      {
        type: 'Panel', id: 'gx-abs24-band', props: { bg: { custom: '#0c0913' } },
        layout: { direction: 'row', width: 640, height: 172 },
        children: [clockCol(), statusCol()],
      },
      // 情感温度线 640×8（冷蓝·她不在身边）
      {
        type: 'Panel', id: 'gx-abs24-temp',
        props: { bg: { custom: 'linear-gradient(90deg,#3c5a78 0%,#4a5670 70%,#5a5070 100%)' } },
        layout: { width: 640, height: 8 },
      },
    ],
  });
}
