// game102《色流工坊 / Pixel Pour》· UI 皮 + 展示常量（REQ-G102-UI·PUI）
//
// 视觉锚 = docs/design/game102/game102-screens.dc.html（卡通像素风·「稿=1:1 复刻基准」铁律）。
// 全部由既有 UITheme 闭集令牌 + 程序化 data-URI 糖果皮表达——零新控件、render-only、确定性（无裸随机·encodeURIComponent 一次）。
// 谱系同 apollo-toon：candySkin 厚底唇钮皮是既有形状的另一套配色实例（数据·非新能力）。
// 分工同 game-t：sim 常量/几何/调色闭集在 `theme.ts`（PE 域·单一真相）；本文件只出「UI 皮 + HUD 展示常量」（PUI 域）。
//
// 8 色板（GD 布局稿）：夜紫底 #16122e / 品紫面 #231d45 / 缃金 #ffd54a / 天青 #4fc3ff /
//   渲染橙 #ff9d4d(PE 层专用·UI 不取) / 翠绿 #5ee8a0 / 玫红 #ff6fae / 警红 #ff5d6c。

import { SHELL } from '@zerocraft/engine/ui/shell-theme.js';
import type { UITheme } from '@zerocraft/engine/ui/components/index.js';
import { CONFIG } from './theme.js';

// ── 展示常量（UI 侧只读·数值真相在 PE 的 theme.ts CONFIG；此处仅转 UI 语义 + HUD 缺省态）────────
export const KEYS_TOTAL = 8; // 金钥匙集齐数（宝箱门开启条件·UI 目标显示）
export const DOOR_GOAL = 100; // 宝箱门计量满值（%·UI 进度条基准）
export const TRAY_SLOTS = CONFIG.SLOTS; // 待命槽位数（源自 sim CONFIG·防漂移）
export const AMMO_MAX = CONFIG.AMMO_PER_CANNON; // 单色弹药上限（源自 sim CONFIG）
export const CAPACITY = CONFIG.CONVEYOR_CAP; // 传送带容量（突破态切 BURST_CAP·数据两档·非 UI 逻辑）

// ── data-URI 编码（确定性·一次求值·同 apollo-toon：残留 ' ( ) 也转 %XX·三落点安全存活）──
const dataUri = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg).replace(/[()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;

// ── 程序化糖果厚底唇钮皮（64×64·9-slice slice=12·像素风厚底唇 + 顶高光·同 apollo-toon 结构）──
export const G102_SLICE = 12;
function candySkin(top: string, body: string, bodyDk: string, lip: string, rim: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${top}"/>` +
    `<stop offset="0.55" stop-color="${body}"/>` +
    `<stop offset="1" stop-color="${bodyDk}"/>` +
    `</linearGradient></defs>` +
    `<rect x="3" y="4" width="58" height="57" rx="11" fill="${lip}"/>` + // 厚底唇底座
    `<rect x="3" y="3" width="58" height="52" rx="10" fill="url(#g)" stroke="${rim}" stroke-width="2"/>` + // 糖体 + 描边
    `<rect x="9" y="7" width="46" height="9" rx="4" fill="#ffffff" fill-opacity="0.40"/>` + // 顶玻璃高光带
    `</svg>`;
  return dataUri(svg);
}

// 四 kind 各一皮（全游戏按钮一体换）：hero=缃金糖(主 CTA·下一关/看广告) / primary=天青糖(品牌) /
//  ghost=翠绿糖(次正向·续命) / quiet=夜紫糖(克制·放弃/重来)。皮内文字由 skinCss 强制白字 + 重投影。
const SKIN_HERO    = candySkin('#ffe27a', '#ffcf3f', '#e0a015', '#9c6c0e', '#6e4a08');
const SKIN_PRIMARY = candySkin('#7bd6ff', '#4fc3ff', '#2b93d6', '#1a5f96', '#0e3d64');
const SKIN_GHOST   = candySkin('#8cf3c0', '#5ee8a0', '#35b878', '#1f7a52', '#125638');
const SKIN_QUIET   = candySkin('#4a4276', '#332b58', '#241d45', '#181233', '#0f0b22');

// ── 程序化像素点阵底纹（panelTexture·16×16 平铺·极淡格阵·呼应像素画气质·让面纸色透出）──
const PIXEL_GRID =
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
  `<path d="M0 0 H16 M0 0 V16" stroke="#b7add9" stroke-opacity="0.045" stroke-width="1"/>` +
  `</svg>`;
const PIXEL_GRID_LAYER = `url(${dataUri(PIXEL_GRID)}) 0 0 / 16px repeat`;

// 页面背景：夜紫径向 + 顶部品紫晕（同布局稿 radial）。
const PAGE_BG = 'radial-gradient(circle at 50% -10%, #241d4a 0%, #16122e 55%)';
// 柔光晕染（顶提亮 + 底压暗·暗皮不伤可读）。
const WASH = 'radial-gradient(130% 90% at 50% -12%, rgba(150,120,255,0.16), transparent 48%), radial-gradient(120% 100% at 50% 116%, rgba(6,4,18,0.35), transparent 55%)';

/** 《色流工坊》pixelPour —— 夜紫底 + 天青主强调 + 缃金点睛 + 像素糖果厚唇钮。暗皮（深底浅字）。 */
export const pixelPour: UITheme = {
  // 夜紫四级底（由深到浅）
  bg0: '#0f0b22', bg1: '#16122e', bg2: '#1b1636', bg3: '#231d45',
  pageBg: PAGE_BG,
  // 紫灰发丝描边（面框）
  line: 'rgba(120,105,190,0.30)',
  // 三级文字（浅字）
  text: '#ece8ff', sub: '#b7add9', dim: '#8a7fc4',
  // 主强调 · 天青（UITheme 的 jade 槽即"主强调色"）
  jade: '#4fc3ff', jadeWash: 'rgba(79,195,255,0.14)', jadeLine: 'rgba(79,195,255,0.42)',
  // 缃金点睛（数字/星级/得分）
  gold: '#ffd54a',
  // 语义：翠绿 / 琥珀 / 警红
  ok: '#5ee8a0', okWash: 'rgba(94,232,160,0.16)',
  warn: '#ffab4d', warnWash: 'rgba(255,171,77,0.16)',
  danger: '#ff5d6c',
  // 深字（缃金钮/浅底上的深色文字）
  ink: '#2a1f00',
  // 暗皮输入底（深半透）
  inputBg: 'rgba(0,0,0,0.30)',
  // 字体：UI 走无衬线 / pixel+display 走像素点阵（Silkscreen·无则回退等宽·同 apollo-kit）
  fontUi: "'Noto Sans SC', -apple-system, 'Segoe UI', 'PingFang SC', sans-serif",
  fontMono: SHELL.fontMono,
  fontPixel: SHELL.fontPixel,
  fontDisplay: SHELL.fontPixel,
  // 背景像素晕染 + 面板像素格底
  texture: PIXEL_GRID_LAYER,
  wash: WASH,
  panelTexture: PIXEL_GRID_LAYER,
  // 主题级像素糖果厚唇钮皮（一 kind 一皮·9-slice 任意尺寸不糊）
  buttonSkins: {
    hero:    { skin: SKIN_HERO,    skinSlice: G102_SLICE },
    primary: { skin: SKIN_PRIMARY, skinSlice: G102_SLICE },
    ghost:   { skin: SKIN_GHOST,   skinSlice: G102_SLICE },
    quiet:   { skin: SKIN_QUIET,   skinSlice: G102_SLICE },
  },
};
