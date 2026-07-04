// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 缺席 48 小时屏（LayoutNode·像素级复刻 Designer frame「a_absence48」）
//
//  Desk Mode 的「冷却」状态：玩家离开 48 小时后，桌上的她还在，但茶凉了、杯子空着、
//  她没有再泡——画面更暗、她背身、温度线退回冷蓝。对齐设计稿三段竖排：
//    场景(640×300 暗化房间·倾倒空杯·她侧身) / 信息带(640×172：VT323 琥珀时钟 + NOW/LAST SEEN)
//    / 情感温度线(640×8 冷蓝渐变)。全 LayoutNode 数据 + ZANKYOU 字体槽（VT323/Silkscreen/DotGothic16）。
//  场景像素图走 Image(内联 SVG data-URI)，精确 hex 移植自设计稿（无蒸汽·静态·她 opacity 0.8 背身）。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 暗化的黄昏房间：倾倒的空茶杯（无蒸汽）+ 她侧身坐着（opacity 0.8·dimmer）──────
//    精确移植设计稿 <svg viewBox="0 0 320 150">：天空冷化、桌面冷棕、空杯翻倒、她背向窗。
function absenceRoom(): string {
  return `
  <defs>
    <linearGradient id="sky48" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23203a"/><stop offset="1" stop-color="#403850"/></linearGradient>
  </defs>
  <rect x="0" y="0" width="320" height="150" fill="#1c1828"/>
  <rect x="0" y="0" width="320" height="60" fill="#181420"/>
  <rect x="150" y="14" width="120" height="86" fill="#100d18"/>
  <rect x="155" y="19" width="110" height="76" fill="url(#sky48)"/>
  <rect x="208" y="19" width="4" height="76" fill="#100d18"/>
  <rect x="155" y="54" width="110" height="4" fill="#100d18"/>
  <rect x="278" y="78" width="6" height="34" fill="#241f2e"/>
  <rect x="270" y="70" width="26" height="10" fill="#5a4d3a"/>
  <rect x="0" y="112" width="320" height="38" fill="#2c2019"/>
  <rect x="0" y="112" width="320" height="4" fill="#3a2a20"/>
  <rect x="60" y="102" width="16" height="10" fill="#9a8e7e"/>
  <rect x="60" y="102" width="16" height="3" fill="#6a5e4e"/>
  <rect x="20" y="100" width="46" height="12" fill="#b8b0a2" opacity="0.7"/>
  <g transform="translate(150,58)" opacity="0.8">
    <rect x="44" y="6" width="8" height="54" fill="#241f2e"/>
    <rect x="8" y="34" width="38" height="26" fill="#34303f"/>
    <rect x="20" y="26" width="14" height="10" fill="#a89384"/>
    <rect x="17" y="6" width="22" height="24" fill="#a89384"/>
    <rect x="15" y="2" width="26" height="12" fill="#1c1826"/>
    <rect x="13" y="8" width="6" height="20" fill="#1c1826"/>
    <rect x="37" y="8" width="6" height="22" fill="#1c1826"/>
  </g>`;
}

// ── 角落 AWAY 标签（○ AWAY 48H·Silkscreen·暗半透底）──────────────────────────
function awayBadge(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-abs-badge', props: { bg: { custom: 'rgba(10,8,16,.7)' } },
    layout: { x: 480, y: 12, padding: 4, direction: 'row', align: 'center' },
    children: [
      { type: 'Label', id: 'gx-abs-badge-t', props: { text: '○ AWAY 48H', font: 'pixel', color: 'sub', size: 'xs', tracking: 1 } },
    ],
  };
}

// ── 信息带 · 时钟列（168px·VT323 琥珀磷光·border-right 用 bg 块隔开）──────────────
function clockCol(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-abs-clockcol', props: { bg: { custom: '#0a070f' } },
    layout: { width: 168, height: 172, direction: 'column', justify: 'center', padding: 16, gap: 8 },
    children: [
      {
        type: 'Panel', id: 'gx-abs-clockrow', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'end' },
        children: [
          { type: 'Label', id: 'gx-abs-clock', props: { text: '19:02', font: 'display', color: 'gold', glow: true, size: 'xl' } },
          { type: 'Label', id: 'gx-abs-sec', props: { text: '40', font: 'display', color: 'warn', size: 'lg' } },
        ],
      },
      { type: 'Label', id: 'gx-abs-date', props: { text: '6月28日 周日', font: 'display', color: 'gold', size: 'md', tracking: 1 } },
      {
        type: 'Panel', id: 'gx-abs-wxrow', props: { bare: true },
        layout: { direction: 'row', gap: 6, align: 'center' },
        children: [
          { type: 'Label', id: 'gx-abs-wx-i', props: { text: '☁️', size: 'sm' } },
          { type: 'Label', id: 'gx-abs-wx-t', props: { text: '阴 · 15°', color: 'dim', size: 'sm' } },
        ],
      },
    ],
  };
}

// ── 信息带 · 状态列（NOW / LAST SEEN·冷淡退场文案）────────────────────────────
function statusCol(): LayoutNode {
  const micro = (id: string, text: string): LayoutNode =>
    ({ type: 'Label', id, props: { text, font: 'pixel', color: 'dim', size: 'xs', tracking: 2 } });
  return {
    type: 'Panel', id: 'gx-abs-statuscol', props: { bg: { custom: '#0a070f' } },
    layout: { width: 472, height: 172, direction: 'column', justify: 'center', padding: 20, gap: 12 },
    children: [
      {
        type: 'Panel', id: 'gx-abs-now', props: { bare: true },
        layout: { direction: 'column', gap: 5 },
        children: [
          micro('gx-abs-now-l', 'NOW'),
          { type: 'Label', id: 'gx-abs-now-t', props: { text: '茶凉了，杯子空着。她没有再泡。', color: 'text', size: 'md' } },
        ],
      },
      {
        type: 'Panel', id: 'gx-abs-meta', props: { bare: true },
        layout: { direction: 'row', gap: 24 },
        children: [
          {
            type: 'Panel', id: 'gx-abs-last', props: { bare: true }, layout: { direction: 'column', gap: 4 },
            children: [
              micro('gx-abs-last-l', 'LAST SEEN'),
              { type: 'Label', id: 'gx-abs-last-t', props: { text: '2 天前', color: 'dim', size: 'sm' } },
            ],
          },
        ],
      },
    ],
  };
}

// ── 整机：设备外框（chip = +48H · 茶杯空了）+ 内屏三段竖排 ─────────────────────
export function absence48Screen(): LayoutNode {
  return deviceShell({
    id: 'gx-absence-48h',
    chip: '+48H · 茶杯空了',
    interiorBg: '#120e1a',
    interior: [
      // 场景层 640×300：暗化房间 + 角落 AWAY 标签（绝对定位叠在场景上）
      {
        type: 'Panel', id: 'gx-abs-scenewrap', props: { bare: true },
        layout: { width: 640, height: 300 },
        children: [
          {
            type: 'Image', id: 'gx-abs-scene',
            props: { src: svgUri(absenceRoom(), '0 0 320 150'), fit: 'cover' },
            layout: { width: 640, height: 300 },
          },
          awayBadge(),
        ],
      },
      // 信息带 640×172（border-top #1b1626 用细线块表达）
      {
        type: 'Panel', id: 'gx-abs-bandtop', props: { bg: { custom: '#1b1626' } },
        layout: { width: 640, height: 2 },
      },
      {
        type: 'Panel', id: 'gx-abs-band', props: { bare: true },
        layout: { direction: 'row', width: 640, height: 170 },
        children: [
          clockCol(),
          // 列分隔细线（border-right #1b1626）
          { type: 'Panel', id: 'gx-abs-banddiv', props: { bg: { custom: '#1b1626' } }, layout: { width: 1, height: 170 } },
          statusCol(),
        ],
      },
      // 情感温度线 640×8（冷蓝渐变·48H 退回冷端）
      {
        type: 'Panel', id: 'gx-abs-temp',
        props: { bg: { custom: 'linear-gradient(90deg,#34506e 0%,#3e4860 70%,#454060 100%)' } },
        layout: { width: 640, height: 8 },
      },
    ],
  });
}
