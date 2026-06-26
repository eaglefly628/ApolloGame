// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Desk Mode 屏（LayoutNode·完全对齐 Designer HERO frame）
//
//  640×480 设备：上半场景(640×300 像素房间) / 信息带(640×172：VT323 琥珀时钟 + 状态)
//  / 情感温度线(640×8 冷→暖渐变)。全 LayoutNode 数据 + ZANKYOU 主题字体槽（VT323/Silkscreen/DotGothic16）。
//  场景像素图走 Image(data-URI SVG·SMIL 动蒸汽/眨眼)。交互只发 action 信号。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import type { Companion } from './characters.js';
import type { ClockReading, DeskView, Weather } from './companion.js';
import { deskSceneUri } from './scenes.js';

const WX_LABEL: Record<Weather, string> = { sunny: '晴', cloudy: '阴', rainy: '雨', snowy: '雪' };
const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

// 情感温度 0..1 → 冷蓝→暖珊瑚 三段渐变（对齐 bundle 情感线）。
function tempGradient(t: number): string {
  const cold = '#3c5a78', mid = '#6b5278', warm = '#9a6a72';
  const a = t < 0.5 ? cold : mid;
  const b = t < 0.5 ? mid : warm;
  const mix = Math.round((t < 0.5 ? t * 2 : (t - 0.5) * 2) * 100);
  return `linear-gradient(90deg, ${a} 0%, ${b} ${mix}%, ${warm} 100%)`;
}

// ── 信息带 · 时钟列（168px·VT323 琥珀磷光）──────────────────────────────
function clockCol(c: Companion, clock: ClockReading, view: DeskView): LayoutNode {
  const moon = clock.hour >= 18 || clock.hour < 6 ? '🌙' : '☀️';
  return {
    type: 'Panel', id: 'gx-clockcol',
    props: { bg: '#0d0a14' },
    layout: { width: 168, height: 172, direction: 'column', justify: 'center', padding: 16, gap: 6 },
    children: [
      {
        type: 'Panel', id: 'gx-clockrow', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'end' },
        children: [
          { type: 'Label', id: 'gx-clock', props: { text: `${pad2(clock.hour)}:${pad2(clock.minute)}`, font: 'display', color: 'gold', glow: true, size: 'xl' } },
          { type: 'Label', id: 'gx-sec', props: { text: pad2(clock.second ?? 0), font: 'display', color: 'warn', size: 'lg' } },
        ],
      },
      { type: 'Label', id: 'gx-date', props: { text: `${clock.month}月${clock.date}日 ${WEEKDAY[clock.weekday]}`, font: 'display', color: 'gold', size: 'md', tracking: 1 } },
      { type: 'Label', id: 'gx-wx', props: { text: `${moon} ${WX_LABEL[view.weather]} · 19°`, font: 'pixel', color: 'sub', size: 'sm' } },
    ],
  };
}

// ── 信息带 · 状态列（NOW / LAST TALK / TODAY）─────────────────────────────
function statusCol(view: DeskView, lastSummary: string): LayoutNode {
  const micro = (id: string, text: string): LayoutNode =>
    ({ type: 'Label', id, props: { text, font: 'pixel', color: 'dim', size: 'xs', tracking: 2 } });
  return {
    type: 'Panel', id: 'gx-statuscol',
    props: { bg: '#0d0a14' },
    layout: { width: 472, height: 172, direction: 'column', justify: 'center', padding: 20, gap: 12 },
    children: [
      {
        type: 'Panel', id: 'gx-now', props: { bare: true },
        layout: { direction: 'column', gap: 5 },
        children: [
          micro('gx-now-l', 'NOW'),
          { type: 'Label', id: 'gx-now-t', props: { text: view.statusText, color: 'text', size: 'lg' } },
        ],
      },
      {
        type: 'Panel', id: 'gx-meta', props: { bare: true },
        layout: { direction: 'row', gap: 24 },
        children: [
          {
            type: 'Panel', id: 'gx-last', props: { bare: true }, layout: { direction: 'column', gap: 4 },
            children: [micro('gx-last-l', 'LAST TALK'), { type: 'Label', id: 'gx-last-t', props: { text: lastSummary || '— 还没说过话', color: 'sub', size: 'sm' } }],
          },
          {
            type: 'Panel', id: 'gx-today', props: { bare: true }, layout: { direction: 'column', gap: 4 },
            children: [micro('gx-today-l', 'TODAY'), { type: 'Label', id: 'gx-today-t', props: { text: view.isAnniversary ? '🎀 纪念日' : '— 平静的一天', color: view.isAnniversary ? 'gold' : 'sub', size: 'sm' } }],
          },
          {
            type: 'Panel', id: 'gx-pickwrap', props: { bare: true }, layout: { direction: 'column', justify: 'center', flex: 1, align: 'end' },
            children: [{ type: 'Button', id: 'gx-pickup', props: { label: '拿起 ▶', kind: 'primary', action: 'mode.pickup' } }],
          },
        ],
      },
    ],
  };
}

// ── 整机（设备外框 + 内屏三段）──────────────────────────────────────────
export function deskScreen(c: Companion, clock: ClockReading, view: DeskView, lastSummary: string): LayoutNode {
  const live = `${c.name} · ${view.sceneLabel.split('·')[0]} · 等你`;
  return {
    type: 'Screen', id: 'gx-desk',
    props: { center: true, bg: '#05060a' },
    layout: { direction: 'column', padding: 0 },
    children: [
      {
        type: 'Panel', id: 'gx-devwrap', props: { bare: true },
        layout: { direction: 'column', gap: 6 },
        children: [
          // 顶部 LIVE 标签条
          {
            type: 'Panel', id: 'gx-livebar', props: { bare: true },
            layout: { direction: 'row', gap: 6, align: 'center', width: 640 },
            children: [
              { type: 'Label', id: 'gx-live', props: { text: live, font: 'pixel', color: 'sub', size: 'xs', tracking: 2 } },
              { type: 'Label', id: 'gx-liveflag', props: { text: '▍LIVE', font: 'pixel', color: 'jade', size: 'xs', tracking: 1 } },
            ],
          },
          // 设备外框
          {
            type: 'Panel', id: 'gx-device', props: { bg: '#0a0810' },
            layout: { width: 660, height: 500, padding: 10, direction: 'column' },
            children: [
              {
                type: 'Panel', id: 'gx-screen-in', props: { bg: '#15101f' },
                layout: { width: 640, height: 480, direction: 'column' },
                children: [
                  // 场景 640×300
                  {
                    type: 'Image', id: 'gx-scene',
                    props: { src: deskSceneUri(c, view.entry.scene, view.weather), fit: 'cover' },
                    layout: { width: 640, height: 300 },
                  },
                  // 信息带 640×172
                  {
                    type: 'Panel', id: 'gx-band', props: { bare: true },
                    layout: { direction: 'row', width: 640, height: 172 },
                    children: [clockCol(c, clock, view), statusCol(view, lastSummary)],
                  },
                  // 情感温度线 640×8
                  { type: 'Panel', id: 'gx-temp', props: { bg: tempGradient(view.emotionTemp) }, layout: { width: 640, height: 8 } },
                ],
              },
            ],
          },
          // 演示工具条（真实版由实时时钟/天气 API 驱动）
          devBar(),
        ],
      },
    ],
  };
}

function devBar(): LayoutNode {
  const btn = (id: string, label: string, action: string, arg?: string): LayoutNode =>
    ({ type: 'Button', id, props: { label, kind: 'ghost', action, ...(arg ? { actionArg: arg } : {}) } });
  return {
    type: 'Panel', id: 'gx-dev', props: { bare: true },
    layout: { direction: 'row', gap: 6, justify: 'center', width: 660, padding: 4 },
    children: [
      btn('gx-dev-char', '切角色', 'dev.swapChar'),
      btn('gx-dev-sun', '☀️', 'dev.weather', 'sunny'),
      btn('gx-dev-rain', '🌧️', 'dev.weather', 'rainy'),
      btn('gx-dev-snow', '❄️', 'dev.weather', 'snowy'),
      btn('gx-dev-back', '⏪', 'dev.hour', '-1'),
      btn('gx-dev-fwd', '⏩', 'dev.hour', '1'),
      btn('gx-dev-lobby', '◀ 大厅', 'mode.lobby'),
    ],
  };
}
