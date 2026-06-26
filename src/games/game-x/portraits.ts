// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 立绘 / 场景 SVG（宿主表现层素材，非 sim 数据）
//
//  与渲染器同侧：sim/数据只持 pose / sceneId / weather 字符串，表现层把它解析成内联 SVG。
//  复古像素风 + 简洁化（GDD「复古像素 + AI 生成特殊场景」基调的占位实现，零外部资产、确定性）。
// ════════════════════════════════════════════════════════════════════════

import type { Companion, ScheduleEntry } from './characters.js';
import type { Weather } from './companion.js';

function uri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── 角色立绘：按姿态换表情/动作（极简像素脸）──────────────────────────────
interface Pose { eyes: string; mouth: string; tilt: number; note: string; }
function poseOf(p: ScheduleEntry['pose']): Pose {
  switch (p) {
    case 'sleep': return { eyes: 'M64 104 h22 M134 104 h22', mouth: 'M104 132 q16 4 32 0', tilt: 8, note: '💤' };
    case 'nap': return { eyes: 'M64 104 h22 M134 104 h22', mouth: 'M108 132 h24', tilt: 10, note: '💤' };
    case 'wake': return { eyes: 'M66 104 q11 4 22 0 M132 104 q11 4 22 0', mouth: 'M108 134 h24', tilt: 3, note: '🍵' };
    case 'read': return { eyes: 'M66 102 q11 -3 22 0 M132 102 q11 -3 22 0', mouth: 'M110 134 h20', tilt: 2, note: '📖' };
    case 'write': return { eyes: 'M64 98 l22 6 M134 104 l22 -6', mouth: 'M108 138 q16 -6 32 0', tilt: 1, note: '✍️' };
    case 'eat': return { eyes: 'M66 102 q11 -4 22 0 M132 102 q11 -4 22 0', mouth: 'M104 130 q16 12 32 0', tilt: 0, note: '🍙' };
    case 'draw': return { eyes: 'M66 100 q11 -5 22 0 M132 100 q11 -5 22 0', mouth: 'M104 132 q16 10 32 0', tilt: -3, note: '🎨' };
    case 'wait': return { eyes: 'M66 102 q11 -3 22 0 M132 102 q11 -3 22 0', mouth: 'M110 134 h20', tilt: 0, note: '…' };
    case 'lively': return { eyes: 'M64 98 q12 -10 24 0 M132 98 q12 -10 24 0', mouth: 'M100 130 q22 18 44 0', tilt: -2, note: '✨' };
    default: return { eyes: 'M66 102 q11 -3 22 0 M132 102 q11 -3 22 0', mouth: 'M110 134 h20', tilt: 0, note: '' };
  }
}

export function portraitUri(c: Companion, pose: ScheduleEntry['pose']): string {
  const f = poseOf(pose);
  const { hair, skin, accent } = c.palette;
  const blush = pose === 'lively' || pose === 'eat'
    ? `<rect x="52" y="116" width="22" height="10" rx="5" fill="#f3a0ad" opacity="0.6"/><rect x="146" y="116" width="22" height="10" rx="5" fill="#f3a0ad" opacity="0.6"/>` : '';
  // 七月短发齐整 / Mika 马尾翘——用 id 区分一处发型。
  const ponytail = c.id === 'mika'
    ? `<path d="M150 70 q60 -10 46 60 q-6 30 -28 40 q18 -40 -18 -100z" fill="${hair}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 250">
    <rect width="220" height="250" fill="none"/>
    <g transform="rotate(${f.tilt} 110 120)">
      ${ponytail}
      <path d="M44 150 q-6 -116 66 -122 q72 6 66 122 q4 60 -66 96 q-70 -36 -66 -96z" fill="${hair}"/>
      <ellipse cx="110" cy="116" rx="60" ry="66" fill="${skin}"/>
      <path d="M50 96 q60 -66 120 0 q-8 -50 -60 -52 q-52 2 -60 52z" fill="${hair}"/>
      ${blush}
      <path d="${f.eyes}" stroke="#3a2c34" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="${f.mouth}" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
    <text x="186" y="48" font-size="26" text-anchor="middle">${f.note}</text>
  </svg>`;
  return uri(svg);
}

// ── 场景背景：场景基调 × 天气 → 一张房间 SVG（窗 + 光 + 天气效果）──────────────
const SCENE_SKY: Record<string, [string, string]> = {
  dawn: ['#ffd9a8', '#f3b27a'],
  day: ['#bfe3ff', '#e9f5ff'],
  afternoon: ['#ffe1b0', '#ffd089'],
  evening: ['#f3a87a', '#7d5a86'],
  night: ['#2a2740', '#15131f'],
};
function weatherSky(weather: Weather, base: [string, string]): [string, string] {
  if (weather === 'rainy') return ['#9fb0bf', '#6f7e8c'];
  if (weather === 'cloudy') return ['#cfd6dc', '#aab3bb'];
  if (weather === 'snowy') return ['#dce6ef', '#b9c6d2'];
  return base;
}

export function sceneUri(c: Companion, entry: ScheduleEntry, weather: Weather): string {
  const isNight = entry.scene === 'night' || entry.pose === 'sleep';
  const room = isNight ? c.palette.roomNight : c.palette.roomDay;
  const [skyA, skyB] = weatherSky(weather, SCENE_SKY[entry.scene] ?? SCENE_SKY['day']);
  // 天气效果（窗内可见）。
  let wx = '';
  if (weather === 'rainy') {
    for (let i = 0; i < 7; i++) wx += `<line x1="${60 + i * 26}" y1="40" x2="${52 + i * 26}" y2="92" stroke="#cfe3f2" stroke-width="2" opacity="0.7"/>`;
  } else if (weather === 'snowy') {
    for (let i = 0; i < 8; i++) wx += `<circle cx="${56 + i * 24}" cy="${48 + (i % 3) * 22}" r="3" fill="#fff" opacity="0.85"/>`;
  } else if (weather === 'sunny' && !isNight) {
    wx = `<circle cx="210" cy="46" r="22" fill="#ffe89a" opacity="0.9"/>`;
  }
  const lamp = isNight ? `<ellipse cx="500" cy="150" rx="120" ry="60" fill="#ffe9a8" opacity="0.18"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280" preserveAspectRatio="xMidYMid slice">
    <rect width="640" height="280" fill="${room}"/>
    <!-- 窗 -->
    <rect x="40" y="24" width="240" height="120" rx="6" fill="#1a2230" opacity="0.25"/>
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyA}"/><stop offset="1" stop-color="${skyB}"/></linearGradient></defs>
    <rect x="48" y="32" width="224" height="104" rx="4" fill="url(#sky)"/>
    ${wx}
    <rect x="156" y="32" width="8" height="104" fill="${room}"/>
    <rect x="48" y="80" width="224" height="8" fill="${room}"/>
    ${lamp}
    <!-- 桌面 -->
    <rect x="0" y="232" width="640" height="48" fill="#000" opacity="0.18"/>
    <rect x="0" y="224" width="640" height="10" fill="${c.palette.accent}" opacity="0.5"/>
  </svg>`;
  return uri(svg);
}
