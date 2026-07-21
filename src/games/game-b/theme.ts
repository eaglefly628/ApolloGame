// Game B ·《雀宴》—— 视觉常量 + UITheme（夜宴暗紫主菜单 + sakura 亮纸 HUD）+ 机位表（纯数据·无逻辑）。
// 规格真相：docs/design/game-b/mockups/（Claude Design 参考稿·⚖ owner 点名 1:1 复刻）+ scene-layout-handoff.md。
// 两套色调（对标参考包）：主菜单/演出=夜宴暗紫（NIGHT·凤翎粉金）；牌桌 HUD 席位卡=sakura 亮纸面。
// 游戏层 UITheme 数据合法（game-q/g/d 先例）；凤翎 texture=主题作者写（apolloToon MOUNTAINS 先例）。
import type { UITheme } from '@ui/components/index.js';

// ── 画面（mockup 线框稿坐标系 1:1：stage 1120×630·16:9·mountHost 等比信箱化）────────
export const FIELD_W = 1120;
export const FIELD_H = 630;

// ── 对局屏 SC-play v2 画布（owner 2026-07-20 新稿 506ef9d6·1280×720·mountHost 整块等比缩放·不乱位）──
export const PLAY_W = 1280;
export const PLAY_H = 720;

// ── 3D 世界（交接档归一单位 × U：桌面半宽=1 → U 世界单位；桌面 2×2 → 20×20）──────────
export const U = 10;

// ── sakura UITheme（sakura-otome 色板 → UI 库令牌；jade 槽=樱粉 accent）─────────────
// 令牌对位：纸面卡=浅粉白纸（bg1/2/3·墨字 text），深底浮层=暗梅（bg0·jade 樱粉字可读），
// 点数强调=danger 绯红（线框稿 .pts #7c2739 系）。S5 /check-ui 量化对比度后再微调。
export const SAKURA: UITheme = {
  bg0: '#2a1e2b', // 暗梅（深底浮层：场况角标/字幕条底）
  bg1: 'rgba(255,247,249,0.94)', // 纸面（席位卡·线框稿 --paper）
  bg2: '#fff0f5',
  bg3: '#ffe4ee',
  pageBg: '#1c141d',
  line: '#f0c4d8',
  text: '#3a2433', // 墨（暖棕黑·纸面正文）
  sub: '#8b7080',
  dim: '#a58897',
  jade: '#e8899e', // 樱粉 accent（深底上作亮字·纸面上作强调）
  jadeWash: 'rgba(232,137,158,0.16)',
  jadeLine: 'rgba(232,137,158,0.45)',
  gold: '#d9a441',
  ok: '#81c784',
  okWash: 'rgba(129,199,132,0.15)',
  warn: '#ffb74d',
  warnWash: 'rgba(255,183,77,0.15)',
  danger: '#c03a52', // 绯红（立直/点数强调）
  ink: '#3a2433',
  inputBg: '#fff8fa',
  fontUi: "'Noto Sans SC','Zen Maru Gothic','Hiragino Sans',system-ui,sans-serif",
  fontMono: "'JetBrains Mono','Fira Code',Consolas,monospace",
  fontSerif: "'Shippori Mincho','Noto Serif SC','Songti SC','Yu Mincho',serif",
};

// ── 夜宴暗紫主题（NIGHT·主菜单/演出·对标 mockups/main-menu.dc.html 精致度）─────────────
// 凤翎暗纹 SVG（从参考稿提取·孔雀翎径向扇 + 星点）→ 程序化 data-uri texture（主题作者写·apolloToon MOUNTAINS 先例）。
function feather(rot: number, eye: boolean): string {
  return `<g transform="rotate(${rot})"><path d="M0,0 C7,-42 7,-120 0,-172 C-7,-120 -7,-42 0,0 Z"/>`
    + (eye ? `<ellipse cx="0" cy="-150" rx="6" ry="11" fill="#d94a6a" fill-opacity="0.32" stroke="#ffc9de" stroke-opacity="0.5"/>` : '')
    + `</g>`;
}
const FAN1 = [-6, -22, -38, -54, -70, -86, -102].map((r) => feather(r, true)).join('');
const FAN2 = [-30, -52, -74].map((r) => feather(r, true)).join('');
const STAR_SEED: Array<[number, number, number]> = [
  [12, 18, 2], [22, 54, 3], [34, 12, 2], [46, 72, 2], [58, 22, 3], [63, 60, 2], [71, 14, 2], [77, 48, 3],
  [84, 68, 2], [90, 28, 2], [95, 54, 2], [17, 84, 2], [41, 40, 2], [52, 88, 3], [68, 80, 2], [88, 88, 2],
];
const STARS = STAR_SEED.map(([x, y, s]) => `<circle cx="${(x * 12.8).toFixed(0)}" cy="${(y * 7.2).toFixed(0)}" r="${s}" fill="#f6d0a8" opacity="0.5"/>`).join('');
const PHOENIX_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">`
  + `<defs><linearGradient id="qf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d94a6a" stop-opacity="0"/><stop offset="1" stop-color="#f6a8c4" stop-opacity="0.5"/></linearGradient></defs>`
  + STARS
  + `<g transform="translate(1160,772) scale(1.75)" opacity="0.15" fill="url(#qf)" stroke="#f6a8c4" stroke-width="0.8" stroke-opacity="0.5">${FAN1}</g>`
  + `<g transform="translate(96,-40) scale(1.05) rotate(150)" opacity="0.08" fill="url(#qf)" stroke="#f6a8c4" stroke-width="0.8" stroke-opacity="0.5">${FAN2}</g>`
  + `</svg>`;
const NIGHT_TEXTURE = `url("data:image/svg+xml,${encodeURIComponent(PHOENIX_SVG)}") center/cover no-repeat`;

// ── 主菜单按钮皮（对标 main-menu.dc.html·hero=粉红渐变主 CTA / ghost=暗底粉边次钮）─────────
// 简洁渐变圆角 9-slice（区别 apolloToon 糖果厚唇·此稿钮观感更平实）。同 apolloToon SKIN 先例=SVG data-uri。
function menuSkin(top: string, bottom: string, rim: string, hi: boolean, fillOp = 1, strokeOp = 1): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`
    + `<rect x="2" y="2" width="60" height="60" rx="12" fill="url(#g)" fill-opacity="${fillOp}" stroke="${rim}" stroke-opacity="${strokeOp}" stroke-width="1.5"/>`
    + (hi ? `<rect x="8" y="6" width="48" height="9" rx="4.5" fill="#ffffff" fill-opacity="0.26"/>` : '')
    + `</svg>`;
  // escape ()' —— skin 进 CSS url() 无引号时，data-uri 里 url(#g) 的括号会截断皮（apolloToon dataUri 先例）。
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/[()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
const NIGHT_SLICE = 12;
const SKIN_HERO_NIGHT = menuSkin('#f6a8c4', '#d94a6a', '#c0355a', true); // 粉红渐变主 CTA
const SKIN_GHOST_NIGHT = menuSkin('#2e1a34', '#241528', '#f6a8c4', false, 0.9, 0.42); // 暗底粉边次钮

// SAKURA 行动键 hero 皮（自摸=绯红渐变·Button.skin 强制白字投影→绯红底白字高对比·
// 治「默认 hero 浅金底浅字」低对比·check-ui 阻断项）。深色 skin 才配得起白字。
SAKURA.buttonSkins = { hero: { skin: menuSkin('#e86a86', '#c03a52', '#8f2038', true), skinSlice: NIGHT_SLICE } };

export const NIGHT: UITheme = {
  bg0: '#160d1b', bg1: '#241528', bg2: '#2e1a34', bg3: '#3a2338',
  pageBg: 'radial-gradient(100% 120% at 78% 26%, #3a2338, #241528 46%, #160d1b 82%)',
  line: 'rgba(246,168,196,0.20)',
  text: '#f7ecdd', sub: 'rgba(247,236,221,0.62)', dim: 'rgba(247,236,221,0.42)',
  jade: '#f6a8c4', jadeWash: 'rgba(246,168,196,0.12)', jadeLine: 'rgba(246,168,196,0.38)',
  gold: '#f2c98a',
  ok: '#81c784', okWash: 'rgba(129,199,132,0.15)',
  warn: '#f2c98a', warnWash: 'rgba(242,201,138,0.15)',
  danger: '#d94a6a',
  ink: '#2a1020',
  inputBg: 'rgba(20,12,26,0.6)',
  fontUi: "'Zen Kaku Gothic New','Noto Sans SC','Hiragino Sans',system-ui,sans-serif",
  fontMono: "'JetBrains Mono','Fira Code',Consolas,monospace",
  fontSerif: "'Shippori Mincho','Noto Serif SC','Songti SC','Yu Mincho',serif",
  texture: NIGHT_TEXTURE,
  wash: 'radial-gradient(120% 80% at 70% -6%, rgba(120,50,90,0.40), transparent 55%)',
  buttonSkins: {
    hero: { skin: SKIN_HERO_NIGHT, skinSlice: NIGHT_SLICE }, // 开始上桌=粉红渐变
    ghost: { skin: SKIN_GHOST_NIGHT, skinSlice: NIGHT_SLICE }, // 继续/设置=暗底粉边
  },
};

// 主菜单宿主背景层（凤翎 texture 叠深紫渐变·game-t sceneBackground 先例·宿主装饰层）。
export const MENU_BG = `${NIGHT_TEXTURE}, ${NIGHT.pageBg}`;
// 主菜单画面尺寸（对标 mockups/main-menu.dc.html·1280×720）。
export const MENU_W = 1280;
export const MENU_H = 720;

// ── 场景色（3D 占位件着色·线框稿取色·真美术=S6 台账 B-22/23/26~29 保号替换）────────────
export const TINT = {
  stageBg: 0x2a1e2b, // 渲染底色（暗梅·线框稿 --bg1）
  feltTop: 0xcf7d96, // 桌呢樱粉（对标 ui-mockup 真稿·sakura 桌呢·B1 视觉 1:1·真美术=B-22 定稿）
  feltEdge: 0xa85f78,
  wood: 0x4a2a20, // 桌体深木（B-23 占位）
  tileBody: 0xf7f0e0, // 牌身象牙（自家牌身 + 侧面）
  tileFaceFallback: 0xfaf4e4, // 牌面回退色（贴图未就绪）
  tileBack: 0xe0cea0, // 牌背米黄象牙（对标真稿·牌山/三家整齐墩·比牌面暖黄区分；粉呢上不糊）
  tileBackEdge: 0xc0aa78,
  cushion: 0x7c4052, // 座垫暗绯
  tray: 0x5a3242, // 点棒托
  die: 0xfaf6ee, // 骰白
  tatami: 0x6e5a42, // 地席（B-29 占位）
  shoji: 0xd9b98a, // 障子暖纸（B-26 占位）
  lantern: 0xd97a4a, // 灯笼体（B-27 占位）
  lanternGlow: 0xffb066, // 灯笼光晕
  moon: 0x39466b, // 月窗远景板（B-28 占位）
  keyLight: 0xfff2e0, // 主光暖白（交接档）
  fillLight: 0xffb98a, // 补光琥珀（灯笼位）
} as const;

// ── 机位表（Camera3D 数据·交接档 §二 镜头表）──────────────────────────────────────
// 语义：orbit 相机 eye 位 = pivot + 球面(yaw,pitch,distance)（渲染器 three-projection orbitCamera）。
// 交接档给的是 eye/lookAt 对 → orbitFromEye 换算（纯函数·测试钉死 ~55° 俯角口径）。
export interface CamPreset {
  yaw: number;
  pitch: number;
  distance: number;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  fov: number;
}

/** eye/lookAt 对 → 轨道参数（与渲染器球面约定互逆：x=sin(yaw)·horiz·z=cos(yaw)·horiz·y=sin(pitch)·dist）。 */
export function orbitFromEye(
  eye: { x: number; y: number; z: number },
  pivot: { x: number; y: number; z: number },
): { yaw: number; pitch: number; distance: number } {
  const dx = eye.x - pivot.x;
  const dy = eye.y - pivot.y;
  const dz = eye.z - pivot.z;
  const distance = Math.hypot(dx, dy, dz);
  const horiz = Math.hypot(dx, dz);
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, horiz), distance };
}

// 主机位（雀魂式·压低聚焦自家手牌）：位 (0,2.05,2.75)·看向桌心偏南 (0,0,0.15)·俯角 ~41°·FOV 42
// ——比纯 55° 俯视更平，让屏幕底部那排自家手牌立面正对镜头、看得清万筒索（owner「手上没看到牌」修正）。
const MAIN_ORBIT = orbitFromEye({ x: 0, y: 2.05 * U, z: 2.75 * U }, { x: 0, y: 0, z: 0.15 * U });
// 掷骰特写：俯视桌心 (0,2.2,0.6)（开局定亲/开杠翻宝牌复用；跟骰=S4 接 tween/follow）。
const DICE_ORBIT = orbitFromEye({ x: 0, y: 2.2 * U, z: 0.6 * U }, { x: 0, y: 0, z: 0 });

export const CAM_MAIN: CamPreset = { ...MAIN_ORBIT, pivotX: 0, pivotY: 0, pivotZ: 0.15 * U, fov: 42 };
export const CAM_DICE: CamPreset = { ...DICE_ORBIT, pivotX: 0, pivotY: 0, pivotZ: 0, fov: 40 };

// 相对运镜（立直推近/和牌俯冲/脱衣特写·向该席平移+拉近·S4 依席位换算成 Camera3D+tween）。
export const CAM_MOVES = {
  riichi: { zoom: 0.25, dur: 0.6, ease: 'inOut' }, // 立直宣言：向该席拉近 25%
  win: { zoom: 0.35, dur: 0.8, ease: 'cubicOut' }, // 荣和/自摸：快速推向和牌席牌河
  strip: { zoom: 0.35, dur: 0.6, ease: 'inOut' }, // 直击脱衣：推近 35% + 全局光 -30%（灯光开关同表出）
} as const;
