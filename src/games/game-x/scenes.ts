// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 像素场景 / 角色 SVG（宿主表现层·忠实移植 Designer bundle）
//
//  与渲染器同侧：sim/数据只持 sceneId / pose / weather；表现层解析成内联像素 SVG。
//  动画用 SMIL <animate>（在 <img> data-URI 里也能动·区别于 CSS keyframes 在 <img> 内不跑）。
//  美术完全对齐 Designer comp：黄昏紫房间、窗外远景城市、台灯辉光、茶杯蒸汽、七月读书眨眼。
// ════════════════════════════════════════════════════════════════════════

import type { Companion } from './characters.js';
import type { Weather } from './companion.js';

function uri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 通用：把 SVG 内容 + viewBox 包成 data-URI（各屏模块自建像素图用·SMIL 动画在 <img> 内也跑）。 */
export function svgUri(inner: string, viewBox = '0 0 320 150'): string {
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${inner}</svg>`);
}

// ── 七月：黄昏读书房间（HERO·完全对齐 bundle frame_01）─────────────────────
function duskRoom(): string {
  return `
  <defs>
    <linearGradient id="sky7" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46406e"/><stop offset="0.5" stop-color="#8a5e7a"/><stop offset="1" stop-color="#e0935f"/></linearGradient>
    <radialGradient id="lamp7" cx="0.5" cy="0.4" r="0.55"><stop offset="0" stop-color="#ffd27f" stop-opacity="0.5"/><stop offset="1" stop-color="#ffd27f" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="320" height="150" fill="#2a2036"/>
  <rect x="0" y="0" width="320" height="60" fill="#241b30"/>
  <rect x="150" y="14" width="120" height="86" fill="#13101d"/>
  <rect x="155" y="19" width="110" height="76" fill="url(#sky7)"/>
  <rect x="208" y="19" width="4" height="76" fill="#13101d"/>
  <rect x="155" y="54" width="110" height="4" fill="#13101d"/>
  <rect x="160" y="78" width="10" height="17" fill="#3a2c4d"/><rect x="174" y="70" width="8" height="25" fill="#3a2c4d"/><rect x="188" y="82" width="12" height="13" fill="#3a2c4d"/><rect x="222" y="74" width="9" height="21" fill="#3a2c4d"/><rect x="236" y="84" width="11" height="11" fill="#3a2c4d"/><rect x="250" y="68" width="8" height="27" fill="#3a2c4d"/>
  <rect x="178" y="74" width="2" height="2" fill="#ffd27f"/><rect x="252" y="72" width="2" height="2" fill="#ffd27f"/>
  <rect x="20" y="8" width="300" height="120" fill="url(#lamp7)"/>
  <rect x="14" y="40" width="58" height="5" fill="#3a2c4d"/>
  <rect x="22" y="22" width="14" height="18" fill="#2d4a3a"/><rect x="18" y="26" width="6" height="10" fill="#356b4a"/><rect x="34" y="24" width="6" height="12" fill="#356b4a"/>
  <rect x="48" y="28" width="12" height="12" fill="#6b4a52"/><rect x="50" y="30" width="8" height="8" fill="#9a6a72"/>
  <rect x="0" y="112" width="320" height="38" fill="#3a2b22"/>
  <rect x="0" y="112" width="320" height="4" fill="#4d3a2c"/>
  <rect x="278" y="78" width="6" height="34" fill="#2a2036"/><rect x="270" y="70" width="26" height="10" fill="#caa05a"/><rect x="274" y="80" width="18" height="3" fill="#ffd27f"/>
  <rect x="16" y="98" width="34" height="6" fill="#5a4a6b"/><rect x="20" y="92" width="34" height="6" fill="#7a5a52"/><rect x="14" y="104" width="40" height="8" fill="#46546b"/>
  <rect x="64" y="100" width="14" height="12" fill="#d9d2c4"/><rect x="78" y="103" width="4" height="6" fill="#d9d2c4"/><rect x="64" y="100" width="14" height="3" fill="#a89070"/>
  <g><rect x="69" y="88" width="3" height="3" fill="#e8dcc8" opacity="0.5"><animate attributeName="y" values="88;80;88" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/></rect></g>
  <g><rect x="73" y="90" width="3" height="3" fill="#e8dcc8" opacity="0.5"><animate attributeName="y" values="90;82;90" dur="3s" begin="0.9s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="3s" begin="0.9s" repeatCount="indefinite"/></rect></g>
  <g transform="translate(150,58)">
    <rect x="44" y="6" width="8" height="54" fill="#2a2036"/>
    <rect x="6" y="34" width="40" height="26" fill="#46546b"/>
    <rect x="6" y="34" width="40" height="4" fill="#56657d"/>
    <rect x="2" y="40" width="10" height="16" fill="#3e4c60"/>
    <rect x="40" y="40" width="8" height="16" fill="#3e4c60"/>
    <rect x="18" y="26" width="14" height="10" fill="#d9b8a0"/>
    <rect x="15" y="6" width="22" height="24" fill="#d9b8a0"/>
    <rect x="13" y="2" width="26" height="12" fill="#241f2e"/>
    <rect x="11" y="8" width="6" height="20" fill="#241f2e"/>
    <rect x="35" y="8" width="6" height="22" fill="#241f2e"/>
    <rect x="13" y="2" width="26" height="3" fill="#332b40"/>
    <g><rect x="19" y="18" width="3" height="2" fill="#1a1622"/><rect x="29" y="18" width="3" height="2" fill="#1a1622"/>
      <animate attributeName="opacity" values="1;1;1;0;1" keyTimes="0;0.92;0.95;0.97;1" dur="6s" repeatCount="indefinite"/></g>
    <rect x="6" y="46" width="40" height="16" fill="#d9d2c4"/><rect x="24" y="46" width="2" height="16" fill="#b0a890"/><rect x="4" y="44" width="44" height="3" fill="#7a5a52"/>
  </g>`;
}

// ── Mika：午后画画房间（对齐 bundle frame_02 基调·暖橙）──────────────────────
function mikaRoom(): string {
  return `
  <defs><linearGradient id="skyM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb0d9"/><stop offset="1" stop-color="#ffd9a8"/></linearGradient></defs>
  <rect x="0" y="0" width="320" height="150" fill="#2e2336"/>
  <rect x="0" y="0" width="320" height="64" fill="#28203a"/>
  <rect x="150" y="12" width="120" height="80" fill="#13101d"/>
  <rect x="155" y="17" width="110" height="70" fill="url(#skyM)"/>
  <rect x="170" y="24" width="22" height="10" fill="#fff" opacity="0.7"/><rect x="216" y="32" width="26" height="9" fill="#fff" opacity="0.6"/>
  <rect x="240" y="22" width="14" height="14" fill="#ffe89a"/>
  <rect x="22" y="20" width="20" height="16" fill="#e8dcc8"/><rect x="48" y="24" width="18" height="14" fill="#e8dcc8"/><rect x="26" y="40" width="16" height="14" fill="#e8dcc8"/>
  <rect x="24" y="22" width="16" height="9" fill="#ff9b6b"/><rect x="50" y="26" width="14" height="7" fill="#6bb6d9"/><rect x="28" y="42" width="12" height="8" fill="#9ad9a0"/>
  <rect x="0" y="112" width="320" height="38" fill="#3a2b22"/>
  <rect x="0" y="112" width="320" height="4" fill="#5a4030"/>
  <rect x="40" y="96" width="10" height="16" fill="#caa05a"/><rect x="38" y="92" width="14" height="5" fill="#8a6a4a"/>
  <rect x="60" y="100" width="8" height="12" fill="#46546b"/><rect x="62" y="98" width="4" height="4" fill="#ff6b6b"/>
  <g transform="translate(150,60)">
    <rect x="2" y="2" width="5" height="16" fill="#6b4631"/>
    <rect x="6" y="14" width="36" height="38" fill="#e08a5f"/>
    <rect x="6" y="14" width="36" height="4" fill="#f0a070"/>
    <rect x="14" y="6" width="22" height="22" fill="#e8c4a8"/>
    <rect x="12" y="0" width="26" height="10" fill="#6b4631"/>
    <rect x="10" y="6" width="6" height="16" fill="#6b4631"/><rect x="36" y="6" width="6" height="16" fill="#6b4631"/>
    <rect x="40" y="2" width="8" height="20" fill="#6b4631"/>
    <rect x="28" y="18" width="3" height="2" fill="#3a2218"/>
    <g><rect x="18" y="14" width="3" height="2" fill="#1a1622"/><rect x="28" y="14" width="3" height="2" fill="#1a1622"/>
      <animate attributeName="opacity" values="1;1;0;1" keyTimes="0;0.9;0.95;1" dur="5s" repeatCount="indefinite"/></g>
    <rect x="38" y="30" width="22" height="16" fill="#2a2740"/><rect x="40" y="32" width="18" height="12" fill="#3a4f6b"/>
    <rect x="44" y="36" width="4" height="4" fill="#ff9b6b"/>
  </g>`;
}

// ── 七月：雨天看窗（对齐 frame_03 基调·冷蓝雨线）────────────────────────────
function rainRoom(): string {
  let rain = '';
  for (let i = 0; i < 9; i++) rain += `<rect x="${156 + i * 12}" y="20" width="1" height="8" fill="#9fc3e0" opacity="0.6"><animate attributeName="y" values="20;70;20" dur="0.7s" begin="${(i % 5) * 0.13}s" repeatCount="indefinite"/></rect>`;
  return `
  <defs><linearGradient id="skyR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4658"/><stop offset="1" stop-color="#5a6f86"/></linearGradient></defs>
  <rect x="0" y="0" width="320" height="150" fill="#1c2230"/>
  <rect x="0" y="0" width="320" height="62" fill="#181f2c"/>
  <rect x="150" y="14" width="120" height="84" fill="#10141d"/>
  <rect x="155" y="19" width="110" height="74" fill="url(#skyR)"/>
  ${rain}
  <rect x="208" y="19" width="4" height="74" fill="#10141d"/><rect x="155" y="54" width="110" height="4" fill="#10141d"/>
  <rect x="0" y="112" width="320" height="38" fill="#2b2b32"/><rect x="0" y="112" width="320" height="4" fill="#3a3a44"/>
  <rect x="60" y="100" width="14" height="12" fill="#d9d2c4"/><rect x="60" y="100" width="14" height="3" fill="#a89070"/>
  <g transform="translate(150,52)">
    <rect x="6" y="20" width="40" height="40" fill="#46546b"/>
    <rect x="6" y="20" width="40" height="4" fill="#56657d"/>
    <rect x="12" y="8" width="22" height="22" fill="#d9b8a0"/>
    <rect x="10" y="2" width="26" height="12" fill="#241f2e"/>
    <rect x="8" y="8" width="6" height="20" fill="#241f2e"/><rect x="32" y="8" width="6" height="22" fill="#241f2e"/>
    <g><rect x="15" y="18" width="3" height="2" fill="#1a1622"/><rect x="26" y="18" width="3" height="2" fill="#1a1622"/>
      <animate attributeName="opacity" values="1;1;0;1" keyTimes="0;0.93;0.96;1" dur="7s" repeatCount="indefinite"/></g>
    <rect x="2" y="40" width="44" height="6" fill="#3e4c60"/>
  </g>`;
}

const ROOMS: Record<string, () => string> = {
  qiyue_dusk: duskRoom,
  qiyue_rain: rainRoom,
  mika_day: mikaRoom,
};

/** 桌面场景：按角色 + 日程场景 + 天气挑一张房间像素图（640×300 区域·viewBox 320×150 slice）。 */
export function deskSceneUri(c: Companion, scene: string, weather: Weather): string {
  let key = `${c.id}_dusk`;
  if (c.id === 'mika') key = 'mika_day';
  else if (weather === 'rainy' || scene === 'afternoon') key = 'qiyue_rain';
  else key = 'qiyue_dusk';
  const body = (ROOMS[key] ?? duskRoom)();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMax slice">${body}</svg>`;
  return uri(svg);
}

// ── 角色头像小人 sprite（marketplace 卡 / 开机·对齐 bundle viewBox 24×22）──────
export function charSpriteUri(id: 'qiyue' | 'mika'): string {
  const body = id === 'mika'
    ? `<rect x="4" y="3" width="4" height="14" fill="#6b4631"/><rect x="6" y="14" width="12" height="8" fill="#e08a5f"/><rect x="8" y="7" width="8" height="8" fill="#e8c4a8"/><rect x="6" y="2" width="12" height="7" fill="#6b4631"/><rect x="5" y="5" width="3" height="8" fill="#6b4631"/><rect x="16" y="5" width="3" height="8" fill="#6b4631"/><rect x="9" y="10" width="2" height="1" fill="#3a2218"/><rect x="13" y="10" width="2" height="1" fill="#3a2218"/>`
    : `<rect x="6" y="14" width="12" height="8" fill="#46546b"/><rect x="8" y="7" width="8" height="8" fill="#d9b8a0"/><rect x="6" y="2" width="12" height="7" fill="#241f2e"/><rect x="5" y="5" width="3" height="9" fill="#241f2e"/><rect x="16" y="5" width="3" height="9" fill="#241f2e"/><rect x="9" y="10" width="2" height="1" fill="#1a1622"/><rect x="13" y="10" width="2" height="1" fill="#1a1622"/>`;
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 22" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${body}</svg>`);
}

// ── 开机醒来剪影（对齐 bundle boot·七月睁眼·琥珀眼）──────────────────────────
export function wakingSpriteUri(): string {
  const body = `<rect x="6" y="14" width="12" height="14" fill="#2a2740"/><rect x="8" y="6" width="8" height="9" fill="#5a5468"/><rect x="6" y="2" width="12" height="7" fill="#1c1828"/><rect x="5" y="5" width="3" height="9" fill="#1c1828"/><rect x="16" y="5" width="3" height="9" fill="#1c1828"/><rect x="9" y="9" width="2" height="1" fill="#ffb000"><animate attributeName="opacity" values="1;0.3;1" dur="3s" repeatCount="indefinite"/></rect><rect x="13" y="9" width="2" height="1" fill="#ffb000"><animate attributeName="opacity" values="1;0.3;1" dur="3s" repeatCount="indefinite"/></rect>`;
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${body}</svg>`);
}

// ── 大立绘（Pocket Mode 对话·角色半身·按情绪·简洁但成体系）──────────────────
export function portraitUri(c: Companion, _pose: string): string {
  return charSpriteUri(c.id === 'mika' ? 'mika' : 'qiyue');
}
