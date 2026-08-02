// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 生日事件屏（LayoutNode·像素级对齐 Designer frame a_event_birthday）
//
//  640×480 设备内屏，三段（自上而下）：
//    1) 场景带 640×300：生日派对房间像素 SVG（彩旗 bunting + 蛋糕 + 派对帽 Mika）+ 顶部飘落彩纸(SMIL 下落)
//    2) 消息带 640×172（bg #120e1a · 上沿珊瑚细线）：奶油拍立得照片(rotate -3deg) + 生日祝福正文
//    3) 底部情感线 640×8：珊瑚→琥珀→珊瑚 暖色渐变
//  全 LayoutNode 数据 + ZANKYOU 字体槽（Silkscreen 微标 / DotGothic16 正文）。像素图走 Image(svgUri)。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 派对房间像素场景（viewBox 320×150·xMidYMax slice 填 640×300）─────────────
//  对齐设计稿 scene <svg>：黄昏紫墙 + 顶部彩旗三角 + 木桌 + 蛋糕(三蜡烛) + 派对帽 Mika。
function partySceneSvg(): string {
  return [
    '<defs><radialGradient id="bdayGlow" cx="0.5" cy="0.4" r="0.6">',
    '<stop offset="0" stop-color="#ffcf8f" stop-opacity="0.5"/>',
    '<stop offset="1" stop-color="#ffcf8f" stop-opacity="0"/></radialGradient></defs>',
    // 墙 + 天花 + 暖光晕
    '<rect width="320" height="150" fill="#332540"/>',
    '<rect width="320" height="60" fill="#2a1f38"/>',
    '<rect x="20" y="8" width="300" height="130" fill="url(#bdayGlow)"/>',
    // 彩旗 bunting（三角小旗）
    '<polygon points="20,8 32,8 26,18" fill="#ff9b6b"/>',
    '<polygon points="40,9 52,9 46,19" fill="#7ec47a"/>',
    '<polygon points="60,8 72,8 66,18" fill="#6bb6d9"/>',
    '<polygon points="248,8 260,8 254,18" fill="#ffd27f"/>',
    '<polygon points="268,9 280,9 274,19" fill="#ff9b6b"/>',
    '<polygon points="288,8 300,8 294,18" fill="#9a8ad9"/>',
    // 木桌
    '<rect x="0" y="112" width="320" height="38" fill="#4a3528"/>',
    '<rect x="0" y="112" width="320" height="4" fill="#5e4534"/>',
    // 蛋糕 + 三支蜡烛（火苗 SMIL 闪烁）
    '<rect x="40" y="92" width="34" height="20" fill="#e8c4a8"/>',
    '<rect x="40" y="92" width="34" height="5" fill="#f4dcc4"/>',
    '<rect x="44" y="86" width="2" height="6" fill="#ffb000"/>',
    '<rect x="55" y="86" width="2" height="6" fill="#ffb000"/>',
    '<rect x="66" y="86" width="2" height="6" fill="#ffb000"/>',
    '<rect x="44" y="82" width="2" height="3" fill="#ffe9a8"><animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite"/></rect>',
    '<rect x="55" y="82" width="2" height="3" fill="#ffe9a8"><animate attributeName="opacity" values="1;0.4;1" dur="1.4s" begin="0.4s" repeatCount="indefinite"/></rect>',
    '<rect x="66" y="82" width="2" height="3" fill="#ffe9a8"><animate attributeName="opacity" values="1;0.4;1" dur="1.4s" begin="0.8s" repeatCount="indefinite"/></rect>',
    // Mika（派对帽·对齐设计稿 g transform translate(150,54)）
    '<g transform="translate(150,54)">',
    '<rect x="4" y="4" width="8" height="28" fill="#6b4631"/>',
    '<rect x="0" y="6" width="6" height="4" fill="#ff9b6b"/>',
    '<rect x="8" y="36" width="38" height="24" fill="#e08a5f"/>',
    '<rect x="6" y="42" width="10" height="16" fill="#cf7a50"/>',
    '<rect x="40" y="42" width="8" height="16" fill="#cf7a50"/>',
    '<rect x="18" y="26" width="14" height="10" fill="#e8c4a8"/>',
    '<rect x="14" y="6" width="24" height="24" fill="#e8c4a8"/>',
    '<rect x="12" y="2" width="28" height="12" fill="#6b4631"/>',
    '<rect x="10" y="8" width="6" height="14" fill="#6b4631"/>',
    '<rect x="36" y="8" width="6" height="14" fill="#6b4631"/>',
    '<rect x="19" y="16" width="3" height="3" fill="#3a2218"/>',
    '<rect x="29" y="16" width="3" height="3" fill="#3a2218"/>',
    // 微笑 + 派对帽
    '<rect x="22" y="22" width="8" height="2" fill="#c25a4a"/>',
    '<polygon points="20,2 32,2 26,-8" fill="#ff9b6b"/>',
    '<rect x="25" y="-9" width="2" height="2" fill="#ffd27f"/>',
    '</g>',
    // 飘落彩纸（设计稿用 CSS 动画·此处用 SMIL 在 viewBox 内下落·确保 <img> 内跑）
    '<rect x="60" y="-6" width="3" height="3" fill="#ff9b6b"><animate attributeName="y" values="-6;150" dur="2.4s" repeatCount="indefinite"/></rect>',
    '<rect x="120" y="-6" width="3" height="3" fill="#6bb6d9"><animate attributeName="y" values="-6;150" dur="2.8s" begin="0.6s" repeatCount="indefinite"/></rect>',
    '<rect x="180" y="-6" width="3" height="3" fill="#ffd27f"><animate attributeName="y" values="-6;150" dur="2.2s" begin="1.1s" repeatCount="indefinite"/></rect>',
    '<rect x="240" y="-6" width="3" height="3" fill="#9a8ad9"><animate attributeName="y" values="-6;150" dur="3s" begin="0.3s" repeatCount="indefinite"/></rect>',
    '<rect x="290" y="-6" width="3" height="3" fill="#7ec47a"><animate attributeName="y" values="-6;150" dur="2.6s" begin="0.9s" repeatCount="indefinite"/></rect>',
  ].join('');
}

// ── 拍立得照片像素图（viewBox 40×32·对齐设计稿 polaroid 内 svg）─────────────
//  暖底相纸里印着「你+蛋糕」：暖橙底 + 蛋糕 + 三支红蜡烛 + 角落小亮点。
function polaroidPhotoSvg(): string {
  return [
    '<rect width="40" height="32" fill="#ffcf8f"/>',
    '<rect x="10" y="14" width="20" height="14" fill="#e8c4a8"/>',
    '<rect x="12" y="9" width="2" height="5" fill="#ff5a4a"/>',
    '<rect x="19" y="9" width="2" height="5" fill="#ff5a4a"/>',
    '<rect x="26" y="9" width="2" height="5" fill="#ff5a4a"/>',
    '<rect x="6" y="4" width="3" height="3" fill="#ff9b6b"/>',
    '<rect x="31" y="6" width="3" height="3" fill="#6bb6d9"/>',
  ].join('');
}

// ── 拍立得卡（奶油相纸·rotate -3deg·照片 + 手写小标）────────────────────────
function polaroidCard(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-bday-polaroid', props: { bg: { custom: '#e8dcc8' } },
    layout: { width: 96, height: 100, direction: 'column', align: 'center', gap: 4, padding: 5, rotate: -3 },
    children: [
      {
        type: 'Image', id: 'gx-bday-photo',
        props: { src: svgUri(polaroidPhotoSvg(), '0 0 40 32'), fit: 'fill' },
        layout: { width: 86, height: 68 },
      },
      // 奶油底上深色手写小标（深色字 → 用 dim 近似）
      { type: 'Label', id: 'gx-bday-photocap', props: { text: '给你的 ♥', color: 'dim', size: 'xs' } },
    ],
  };
}

// ── 消息文案列（HAPPY BIRTHDAY 微标 + 祝福正文 + 来源小字）────────────────────
function messageCol(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-bday-msgcol', props: { bare: true },
    layout: { direction: 'column', gap: 8, flex: 1, justify: 'center' },
    children: [
      { type: 'Label', id: 'gx-bday-tag', props: { text: '★ HAPPY BIRTHDAY', font: 'pixel', color: 'jade', size: 'xs', tracking: 2 } },
      { type: 'Label', id: 'gx-bday-l1', props: { text: '生日快乐！！我准备了一整天——', color: 'text', size: 'md' } },
      { type: 'Label', id: 'gx-bday-l2', props: { text: '这张画里有你，你能找到吗？', color: 'text', size: 'md' } },
      { type: 'Label', id: 'gx-bday-src', props: { text: 'Pixverse 生成 · 专属生日插画', color: 'sub', size: 'sm' } },
    ],
  };
}

// ── 整机 ────────────────────────────────────────────────────────────────
export function eventBirthdayScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-event-birthday',
    chip: '你的生日 · 宋 Mika',
    interior: [
      // 场景带 640×300（设计稿 inset:0 0 180px 0 → 上 300）
      {
        type: 'Image', id: 'gx-bday-scene',
        props: { src: svgUri(partySceneSvg(), '0 0 320 150'), fit: 'cover' },
        layout: { width: 640, height: 300 },
      },
      // 消息带 640×172（bg #120e1a · 上沿珊瑚细线 + 拍立得 + 文案）
      {
        type: 'Panel', id: 'gx-bday-band', props: { bg: { custom: '#120e1a' } },
        layout: { width: 640, height: 172, direction: 'column' },
        children: [
          // 上沿珊瑚细线（对齐设计稿 border-top #2a2038 偏暖一点取珊瑚弱化）
          { type: 'Panel', id: 'gx-bday-bandline', props: { bg: { custom: '#2a2038' } }, layout: { width: 640, height: 1 } },
          {
            type: 'Panel', id: 'gx-bday-bandbody', props: { bare: true },
            layout: { direction: 'row', align: 'center', gap: 16, padding: 22, flex: 1 },
            children: [polaroidCard(), messageCol()],
          },
        ],
      },
      // 底部情感线 640×8（珊瑚→琥珀→珊瑚 暖色渐变）
      {
        type: 'Panel', id: 'gx-bday-temp',
        props: { bg: { custom: 'linear-gradient(90deg, #ff9b6b, #ffd27f 50%, #ff9b6b)' } },
        layout: { width: 640, height: 8 },
      },
    ],
  });
}
