// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Desk Mode 屏幕（LayoutNode 纯数据 · GDD §五）
//
//  构图严格对齐 GDD（640×480, 4:3）：
//    · 上半 640×280：她的"房间"场景（随时间/季节/天气变化，角色在场景中活动）
//    · 左下 160×160：时钟（琥珀磷光、等宽字体、日期/时刻/天气图标）
//    · 右下 320×160：状态提示（她在做什么 / 上次对话摘要 / 今天特别提示）
//    · 底部 640×8：情感温度细线（冷→暖，不是明显进度条）
//
//  UI 铁律：全是 ui/components 的 LayoutNode；交互只发 action 信号（无本地自由逻辑）。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import type { Companion } from './characters.js';
import type { ClockReading, DeskView, Weather } from './companion.js';
import { portraitUri, sceneUri } from './portraits.js';

const WX_ICON: Record<Weather, string> = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️' };
const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const STAGE_LABEL = { acquaint: '初识', familiar: '熟悉', deep: '相知' } as const;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

// 情感温度 0..1 → 一条由冷到暖的颜色（HSL 文本插值·细线）。
function tempColor(t: number): string {
  const hue = Math.round(210 - t * 200); // 210 冷蓝 → 10 暖橙红
  const sat = 40 + Math.round(t * 35);
  return `hsl(${hue} ${sat}% 56%)`;
}

// ── 顶部场景区（背景图 + 角色立绘 + 缺席痕迹浮字）────────────────────────
function sceneRegion(c: Companion, view: DeskView): LayoutNode {
  const children: LayoutNode[] = [
    {
      type: 'Image', id: 'gx-portrait',
      props: { src: portraitUri(c, view.entry.pose), fit: 'contain' },
      layout: { x: 360, y: 36, width: 230, height: 210, anim: 'fadeIn', animMs: 500 },
    },
  ];
  // 缺席痕迹（24/48/72h）—— 桌面上浮现的一句话。
  if (view.absenceNote) {
    children.push({
      type: 'Label', id: 'gx-absence',
      props: { text: view.absenceNote, size: 'sm', color: 'dim' },
      layout: { x: 20, y: 244, width: 320 },
    });
  }
  // 纪念日提示。
  if (view.isAnniversary) {
    children.push({
      type: 'Badge', id: 'gx-anniv',
      props: { text: '🎀 今天，是你们的纪念日', tone: 'warn' },
      layout: { x: 20, y: 18 },
    });
  }
  return {
    type: 'Panel', id: 'gx-scene',
    props: { bg: `center/cover no-repeat url("${sceneUri(c, view.entry, view.weather)}")` },
    layout: { width: 640, height: 280 },
    children,
  };
}

// ── 左下时钟（160×160，琥珀磷光等宽）────────────────────────────────────
function clockRegion(clock: ClockReading, view: DeskView): LayoutNode {
  return {
    type: 'Panel', id: 'gx-clock',
    props: { bg: '#0b0d08' },
    layout: { width: 160, height: 160, direction: 'column', gap: 4, padding: 14, justify: 'center' },
    children: [
      { type: 'Label', id: 'gx-time', props: { text: `${pad2(clock.hour)}:${pad2(clock.minute)}`, size: 'xl', bold: true, mono: true, color: 'gold' } },
      { type: 'Label', id: 'gx-date', props: { text: `${WEEKDAY[clock.weekday]} · ${WX_ICON[view.weather]}`, size: 'sm', mono: true, color: 'gold' } },
      { type: 'Label', id: 'gx-scenelabel', props: { text: view.sceneLabel, size: 'xs', mono: true, color: 'dim' } },
    ],
  };
}

// ── 右下状态（320×160：她在做什么 / 上次摘要 / 特别提示）───────────────────
function statusRegion(c: Companion, view: DeskView, lastSummary: string): LayoutNode {
  return {
    type: 'Panel', id: 'gx-status',
    props: { title: `${c.name} · ${STAGE_LABEL[view.stage]}` },
    layout: { width: 320, height: 160, direction: 'column', gap: 8, padding: 12, justify: 'start' },
    children: [
      { type: 'Label', id: 'gx-doing', props: { text: view.statusText, size: 'sm', color: 'text' } },
      { type: 'Divider', id: 'gx-div', props: {} },
      { type: 'Label', id: 'gx-last', props: { text: lastSummary ? `上次：${lastSummary}` : '还没有和她说过话。', size: 'xs', color: 'dim' } },
      {
        type: 'Button', id: 'gx-pickup',
        props: { label: '拿起 RP · 和她说说话', kind: 'hero', action: 'mode.pickup' },
        layout: { margin: 4 },
      },
    ],
  };
}

// ── 整屏装配 ──────────────────────────────────────────────────────────
export function deskScreen(
  c: Companion,
  clock: ClockReading,
  view: DeskView,
  lastSummary: string,
): LayoutNode {
  return {
    type: 'Screen', id: 'gx-desk',
    props: { center: true, bg: '#05060a' },
    layout: { direction: 'column', padding: 0 },
    children: [
      {
        type: 'Panel', id: 'gx-frame',
        props: { bare: true },
        layout: { width: 640, height: 480, direction: 'column' },
        children: [
          sceneRegion(c, view),
          // 下半 640×200：左时钟 + 右状态。
          {
            type: 'Panel', id: 'gx-bottom',
            props: { bare: true },
            layout: { direction: 'row', width: 640, height: 192 },
            children: [clockRegion(clock, view), statusRegion(c, view, lastSummary)],
          },
          // 底部情感温度细线（640×8）。
          {
            type: 'Panel', id: 'gx-temp',
            props: { bg: tempColor(view.emotionTemp) },
            layout: { width: 640, height: 8 },
          },
        ],
      },
      // 调试/演示工具条（基础框架期：切角色 + 切天气 + 快进时刻；正式版由真实时钟/天气 API 驱动）。
      devBar(),
    ],
  };
}

// 演示工具条：用 action 信号驱动宿主切换演示参数（仍走信号、无自由逻辑）。
function devBar(): LayoutNode {
  const btn = (id: string, label: string, action: string, arg?: string): LayoutNode => ({
    type: 'Button', id, props: { label, kind: 'ghost', action, ...(arg ? { actionArg: arg } : {}) },
  });
  return {
    type: 'Panel', id: 'gx-dev',
    props: { bare: true },
    layout: { direction: 'row', gap: 6, padding: 8, justify: 'center', width: 640 },
    children: [
      btn('gx-dev-char', '切换角色', 'dev.swapChar'),
      btn('gx-dev-sun', '☀️', 'dev.weather', 'sunny'),
      btn('gx-dev-cloud', '☁️', 'dev.weather', 'cloudy'),
      btn('gx-dev-rain', '🌧️', 'dev.weather', 'rainy'),
      btn('gx-dev-snow', '❄️', 'dev.weather', 'snowy'),
      btn('gx-dev-back', '⏪ 早 1h', 'dev.hour', '-1'),
      btn('gx-dev-fwd', '⏩ 晚 1h', 'dev.hour', '1'),
    ],
  };
}
