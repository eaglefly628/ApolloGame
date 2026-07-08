// Game Q · Neon Siege —— 视觉常量 + 数值配置 + UITheme（纯数据·无逻辑）。
import type { UITheme } from '@ui/components/index.js';

// ── 画布逻辑尺寸（CanvasRenderer·世界坐标 1:1·无相机）──────────────────────
export const FIELD_W = 960;
export const FIELD_H = 560;
export const TOP_BAR_H = 56;
export const BOTTOM_BAR_H = 98;

// ── Tag 位掩码（bit0 = ZONE_FLAG 引擎 trigger-zone 保留）─────────────────────
export const ZONE = 1 << 0;
export const ENEMY = 1 << 1;
export const TOWER = 1 << 2;
export const BASE = 1 << 3;
export const TICKET = 1 << 4;

// ── 波次表（每条 = 一张生怪票·纯数据）───────────────────────────────────────
export interface SpawnRow { at: number; key: 'basic' | 'fast' | 'tank' }
export const WAVE_SCHEDULE: SpawnRow[] = [
  ...[90, 150, 210, 270, 330, 390, 450].map((at): SpawnRow => ({ at, key: 'basic' })),
  ...[560, 600, 640, 680, 720, 760].map((at): SpawnRow => ({ at, key: 'basic' })),
  ...[585, 655, 725, 795].map((at): SpawnRow => ({ at, key: 'fast' })),
  ...[930, 972, 1014, 1056, 1098, 1140].map((at): SpawnRow => ({ at, key: 'basic' })),
  ...[1000, 1070, 1150].map((at): SpawnRow => ({ at, key: 'fast' })),
  ...[960, 1090, 1200].map((at): SpawnRow => ({ at, key: 'tank' })),
];

// ── 调色板（Color.tint·霓虹/合成波）─────────────────────────────────────────
export const TINT = {
  laneFill: 0x1c3a5c,
  laneEdge: 0x33c2e8,
  padRim: 0x2b6f86,
  padCore: 0x9fe8ff,
  padGlow: 0x33c2e8,
  base: 0x2fbf87,
  baseRim: 0x1c6f52,
  baseCore: 0x8effc9,
  enemyBasic: 0xff5c7a, enemyBasicIn: 0xffb3c2,
  enemyFast: 0xffd23f, enemyFastIn: 0xfff0b0,
  enemyTank: 0xc084fc, enemyTankIn: 0xe6ccff,
  hpBar: 0x4ade80,
  pulse: 0x38bdf8, pulseCore: 0xd6f4ff,
  cannon: 0xf472b6, cannonCore: 0xffe0f2,
  zapPulse: 0xbdf0ff,
  zapCannon: 0xffd6f0,
} as const;

// ── 塔档（命中制·range=Perception.sightRadius·单发结算 consumeOnHit）─────────
// mesh/mat = 3D 盒庭渲染描述（render-only·groundPose 落地面·bloom 拾取 emissive 发霓虹光）。
export interface Mesh3DSpec { shape: 'box' | 'sphere' | 'cylinder' | 'cone'; w: number; h: number }
export interface TowerDef {
  key: 'pulse' | 'cannon';
  name: string;
  cost: number;
  tint: number;
  coreTint: number;
  reload: number;   // Timer.duration（tick）
  range: number;    // Perception.sightRadius（像素）
  radius: number;
  dmg: number;
  zapTint: number;
  mesh: Mesh3DSpec;  // 3D 塔身图元
  mat: string;       // PBR 预设（闭集·见 assets/pbr-materials）
  emissive: number;  // 自发光色（霓虹辉光·bloom 拾取）
}
export const TOWERS: Record<'pulse' | 'cannon', TowerDef> = {
  pulse: { key: 'pulse', name: 'PULSE', cost: 50, tint: TINT.pulse, coreTint: TINT.pulseCore, reload: 20, range: 132, radius: 15, dmg: 9, zapTint: TINT.zapPulse, mesh: { shape: 'cone', w: 30, h: 52 }, mat: 'steel', emissive: 0x1892d6 },
  cannon: { key: 'cannon', name: 'RAIL', cost: 115, tint: TINT.cannon, coreTint: TINT.cannonCore, reload: 56, range: 208, radius: 18, dmg: 58, zapTint: TINT.zapCannon, mesh: { shape: 'cylinder', w: 40, h: 42 }, mat: 'steel', emissive: 0xd63e9a },
};

// ── 敌档（pathfind·类型差异化轮廓）─────────────────────────────────────────
export interface EnemyDef {
  key: 'basic' | 'fast' | 'tank';
  hp: number;
  speed: number;
  radius: number;   // 碰撞半径（2D Shape·sensor 命中）
  tint: number;
  inTint: number;
  shape: 'circle' | 'diamond' | 'hex';  // 2D 碰撞轮廓
  mesh: Mesh3DSpec; // 3D 盒庭图元（groundPose 落地面）
  mat: string;      // PBR 预设
  emissive: number; // 自发光（bloom 霓虹）
}
export const ENEMIES: Record<'basic' | 'fast' | 'tank', EnemyDef> = {
  basic: { key: 'basic', hp: 58, speed: 1.35, radius: 12, tint: TINT.enemyBasic, inTint: TINT.enemyBasicIn, shape: 'circle', mesh: { shape: 'sphere', w: 26, h: 26 }, mat: 'plastic', emissive: 0xff5c7a },
  fast: { key: 'fast', hp: 34, speed: 2.35, radius: 10, tint: TINT.enemyFast, inTint: TINT.enemyFastIn, shape: 'diamond', mesh: { shape: 'cone', w: 22, h: 32 }, mat: 'plastic', emissive: 0xffd23f },
  tank: { key: 'tank', hp: 300, speed: 0.82, radius: 16, tint: TINT.enemyTank, inTint: TINT.enemyTankIn, shape: 'hex', mesh: { shape: 'cylinder', w: 40, h: 30 }, mat: 'steel', emissive: 0xc084fc },
};

// ── 经济 / 局面 ────────────────────────────────────────────────────────────
export const START_GOLD = 245;
export const START_LIVES = 20;
export const INCOME_PER = 9;
export const INCOME_EVERY = 54;

// ── 车道（NavGraph·x 单调右进防 pathfind 倒走）+ 出生/大本营几何 ────────────
export const LANE_NODES: Array<{ x: number; y: number }> = [
  { x: -40, y: 180 },
  { x: 170, y: 180 },
  { x: 330, y: 400 },
  { x: 500, y: 180 },
  { x: 670, y: 400 },
  { x: 820, y: 290 },
];
export const LANE_EDGES: Array<{ a: number; b: number }> = [
  { a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 4 }, { a: 4, b: 5 },
];
export const SPAWN = { x: 10, y: 180 };
export const BASE_POS = { x: 900, y: 290 };
export const LANE_WIDTH = 26;
export const PROBE_R = 16;
export const ARRIVE_RANGE = 14;

// ── 建造位（数据·手摆在车道旁的合法空位·只此可布塔）───────────────────────
// 每个 spot 紧贴某段车道(~40px)以进塔射程；避开车道折线本身与彼此。落地后按截图微调。
export const PAD_SPOTS: Array<{ x: number; y: number }> = [
  { x: 92, y: 138 }, { x: 92, y: 224 },
  { x: 250, y: 250 },
  { x: 330, y: 300 },
  { x: 410, y: 250 },
  { x: 500, y: 246 },
  { x: 590, y: 250 },
  { x: 700, y: 306 },
  { x: 760, y: 224 },
];

// ── 3D 盒庭渲染（render-only·2D→3D 桥：Camera3D 在场 → 2D sim 实体 groundPose 落地面）──────────
// 世界单位 = 2D 像素坐标（sim x→X 右、sim y→Z 景深、地面 y=0）。相机/灯/天/雾/后处理皆 render-only 单例·不进 hash。
export const FIELD_CX = FIELD_W / 2;   // 场地中心 X (=480)
export const FIELD_CZ = FIELD_H / 2;   // 场地中心 Z (=280)

// 轨道相机：对角微俯正交盒庭（Captain-Toad 桌面微缩感·yaw 斜看露深度 + 塔高）。
export const CAMERA_3D = {
  yaw: 0.6, pitch: 0.72, projection: 'ortho' as const,
  orthoSize: 450, distance: 1500,
  pivotX: FIELD_CX, pivotY: 6, pivotZ: FIELD_CZ,
  near: 1, far: 3800,
};

// 数据化光照：冷白主光（投软影·斜掠·压低强度让暗底沉下去）+ 对侧冷紫补 + 弱冷蓝环境（霓虹夜靠自发光起亮）。
export const SUN_3D = { color: 0xdce8ff, intensity: 0.95, dirX: -0.5, dirY: -1, dirZ: -0.35 };
export const FILL_3D = { color: 0x5a6cff, intensity: 0.32, dirX: 0.6, dirY: -0.5, dirZ: 0.45 };
export const AMBIENT_3D = { color: 0x24406a, intensity: 0.55 };

// 天空盒（霓虹夜渐变·压暗地平线消除亮穹 + 弱 IBL env·金属微反射不泛白·关调色以免暖染上翻）。
export const SKY_3D = { top: 0x02040b, bottom: 0x081020, env: 0.2 };
// 距离雾（远处柔化·"装在玻璃盒里"的纵深·暗蓝隐去天穹）。
export const FOG_3D = { color: 0x05091a, near: 1150, far: 2350 };
// 后处理：泛光（**仅最亮的自发光核心辉光**·高阈值防糊底）+ 轻移轴（微缩感·不糊全场）+ AO + SMAA。
// 刻意不挂 grade 色彩分级：分级 pass 在此暗场把地台上翻成灰橄榄浊底（截图验证）——霓虹自发光已够饱和，无需分级。
export const POST_3D = {
  bloom: { strength: 0.5, radius: 0.5, threshold: 0.72 },
  tiltShift: { focus: 0.56, intensity: 1.0 },
  ao: { intensity: 0.55, radius: 42, scale: 1 },
  aa: true,
} as const;

// 地台（大平板·顶在 y=0·下沉 box·加大到出框·消除"悬浮卡片"边·近黑霓虹底让霓虹跳出 + 极轻起伏）。
export const GROUND_3D = { w: 1600, d: 1160, h: 28, top: 0x05080f, side: 0x03050b };

// 大本营 3D 堡（Transform3D 真三维·多层堆叠·authored 静态·独立于碰撞 base 实体）。
export const BASE_3D = { w: 60, h: 46, d: 92 };

// HUD 屏幕留白（3D 满幅画布·顶/底 HUD 叠加·相机取景已居中·此处仅注释口径）。

// ── HUD 霓虹主题（UITheme 全字段）──────────────────────────────────────────
export const NEON_THEME: UITheme = {
  bg0: '#05070f', bg1: '#0b1322', bg2: '#111d33', bg3: '#1a2947', pageBg: '#05070f',
  line: 'rgba(56,189,248,0.22)',
  text: '#e6f6ff', sub: '#9fb6cf', dim: '#64788f',
  jade: '#38bdf8', jadeWash: 'rgba(56,189,248,0.12)', jadeLine: 'rgba(56,189,248,0.45)',
  gold: '#fbbf24',
  ok: '#4ade80', okWash: 'rgba(74,222,128,0.14)', warn: '#f59e0b', warnWash: 'rgba(245,158,11,0.14)',
  danger: '#fb7185',
  ink: '#04121a',
  fontUi: "'Segoe UI',system-ui,-apple-system,sans-serif",
  fontMono: "ui-monospace,'SFMono-Regular',Menlo,monospace",
};
