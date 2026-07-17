// Game B ·《雀宴》—— 视觉常量 + sakura UITheme + 机位表（纯数据·无逻辑）。
// 规格真相：docs/design/game-b/scene-layout-handoff.md（场景）+ docs/design/game-b/ui-mockup.html（HUD 1:1）。
// 主题基调=库内 sakura-otome 樱花乙女（src/ui/themes/sakura-otome/spec.md 色板）映射成 UITheme 令牌；
// 深底浮层（场况/字幕）取线框稿的暗梅色。⚖ owner 2026-07-17：全部从库取、不自己发明。
import type { UITheme } from '@ui/components/index.js';

// ── 画面（mockup 线框稿坐标系 1:1：stage 1120×630·16:9·mountHost 等比信箱化）────────
export const FIELD_W = 1120;
export const FIELD_H = 630;

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
};

// ── 场景色（3D 占位件着色·线框稿取色·真美术=S6 台账 B-22/23/26~29 保号替换）────────────
export const TINT = {
  stageBg: 0x2a1e2b, // 渲染底色（暗梅·线框稿 --bg1）
  feltTop: 0x3f7d5a, // 桌呢（传统雀庄绿呢·牌面/红牌背都跳得出来·真美术=B-22 可换绯/樱）
  feltEdge: 0x2f5f45,
  wood: 0x4a2a20, // 桌体深木（B-23 占位）
  tileBody: 0xf2ead2, // 牌身象牙（自家牌身 + 侧面）
  tileFaceFallback: 0xfaf4e4, // 牌面回退色（贴图未就绪）
  tileBack: 0xcf3a35, // 牌背红（back.png 红·牌山/三家一眼是背面·区别桌呢绿）
  tileBackEdge: 0x9c2b27,
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
