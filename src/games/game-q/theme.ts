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
  skin: string;     // 皮肤槽 key（本地美术 index 登记此 id 即换装·未填时渲染器回退 Shape 色块）
}
export const TOWERS: Record<'pulse' | 'cannon', TowerDef> = {
  pulse: { key: 'pulse', name: 'PULSE', cost: 50, tint: TINT.pulse, coreTint: TINT.pulseCore, reload: 20, range: 132, radius: 15, dmg: 9, zapTint: TINT.zapPulse, skin: 'q/tower-pulse' },
  cannon: { key: 'cannon', name: 'RAIL', cost: 115, tint: TINT.cannon, coreTint: TINT.cannonCore, reload: 56, range: 208, radius: 18, dmg: 58, zapTint: TINT.zapCannon, skin: 'q/tower-cannon' },
};

// ── 敌档（pathfind·类型差异化轮廓）─────────────────────────────────────────
export interface EnemyDef {
  key: 'basic' | 'fast' | 'tank';
  hp: number;
  speed: number;
  radius: number;
  tint: number;
  inTint: number;
  shape: 'circle' | 'diamond' | 'hex';
  skin: string;     // 皮肤槽 key（同 TowerDef.skin）
}
export const ENEMIES: Record<'basic' | 'fast' | 'tank', EnemyDef> = {
  basic: { key: 'basic', hp: 58, speed: 1.35, radius: 12, tint: TINT.enemyBasic, inTint: TINT.enemyBasicIn, shape: 'circle', skin: 'q/enemy-basic' },
  fast: { key: 'fast', hp: 34, speed: 2.35, radius: 10, tint: TINT.enemyFast, inTint: TINT.enemyFastIn, shape: 'diamond', skin: 'q/enemy-fast' },
  tank: { key: 'tank', hp: 300, speed: 0.82, radius: 16, tint: TINT.enemyTank, inTint: TINT.enemyTankIn, shape: 'hex', skin: 'q/enemy-tank' },
};

// ── 皮肤槽 key（场景件·R2 ①）：本地美术 index 登记这些 id 即换装（chooseRenderMode：
// 贴图就绪盖过 Shape·未就绪回退现程序化观感——观感一字不变是硬承诺）。
export const SKIN = { base: 'q/base', pad: 'q/pad' } as const;

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
