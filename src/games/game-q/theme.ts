// Game Q · Neon Siege —— 视觉常量 + 数值配置 + UITheme（纯数据·无逻辑）。
// 玩法规则不在这里；这里只是「填给引擎能力的数字」与「HUD 的换皮令牌」。
import type { UITheme } from '@ui/components/index.js';

// ── 画布逻辑尺寸（CanvasRenderer·世界坐标 1:1·无相机）──────────────────────
export const FIELD_W = 960;
export const FIELD_H = 560;
export const TOP_BAR_H = 56;   // 顶部状态条（覆盖画布顶部·play-field 让出）
export const BOTTOM_BAR_H = 98; // 底部建造条

// ── Tag 位掩码（bit0 = ZONE_FLAG 为引擎 trigger-zone 保留·我方从 bit1 起）─────
export const ZONE = 1 << 0; // 引擎保留：触发区
export const ENEMY = 1 << 1;
export const TOWER = 1 << 2;
export const BASE = 1 << 3;
export const TICKET = 1 << 4; // 生怪票据（self-rule 定时展开一只怪·数据驱动波次）

// ── 波次表（每条 = 一张生怪票·at tick 展开一只怪·纯数据）─────────────────────
export interface SpawnRow { at: number; key: 'basic' | 'fast' | 'tank' }
export const WAVE_SCHEDULE: SpawnRow[] = [
  // 第一波：6 基础
  ...[90, 150, 210, 270, 330, 390].map((at): SpawnRow => ({ at, key: 'basic' })),
  // 第二波：5 基础 + 3 快速
  ...[560, 600, 640, 680, 720].map((at): SpawnRow => ({ at, key: 'basic' })),
  ...[580, 650, 715].map((at): SpawnRow => ({ at, key: 'fast' })),
  // 第三波：6 基础 + 2 快速 + 2 重甲
  ...[900, 942, 984, 1026, 1068, 1110].map((at): SpawnRow => ({ at, key: 'basic' })),
  ...[1000, 1055].map((at): SpawnRow => ({ at, key: 'fast' })),
  ...[960, 1095].map((at): SpawnRow => ({ at, key: 'tank' })),
];

// ── 调色板（Color.tint 十六进制数·霓虹/合成波）───────────────────────────
export const TINT = {
  laneFill: 0x14263f,
  laneEdge: 0x1f6f8b,
  base: 0x34d399,
  baseCore: 0x6ee7b7,
  enemyBasic: 0xff5c7a,
  enemyFast: 0xffd23f,
  enemyTank: 0xc084fc,
  hpBar: 0x4ade80,
  hpBack: 0x0b1a12,
  pulse: 0x38bdf8,
  cannon: 0xf472b6,
  boltPulse: 0x7dd3fc,
  boltCannon: 0xfbcfe8,
  ghost: 0x38bdf8,
} as const;

// ── 塔档（消费 self-rule/launch/hitbox·range = boltSpeed × boltLife）─────────
export interface TowerDef {
  key: 'pulse' | 'cannon';
  name: string;
  cost: number;
  tint: number;
  reload: number;    // Timer.duration（tick·越小射速越快）
  radius: number;    // 塔体半径（渲染 + 命中）
  bolt: { speed: number; life: number; dmg: number; radius: number; tint: number };
}

export const TOWERS: Record<'pulse' | 'cannon', TowerDef> = {
  pulse: {
    key: 'pulse', name: 'PULSE', cost: 55, tint: TINT.pulse,
    reload: 26, radius: 15,
    bolt: { speed: 6.4, life: 46, dmg: 11, radius: 5, tint: TINT.boltPulse }, // range ≈ 294
  },
  cannon: {
    key: 'cannon', name: 'RAIL', cost: 120, tint: TINT.cannon,
    reload: 68, radius: 18,
    bolt: { speed: 5.2, life: 80, dmg: 46, radius: 8, tint: TINT.boltCannon }, // range ≈ 416
  },
};

// ── 敌档（消费 pathfind/mortal·speed=NavAgent 模长·hp=Resource）────────────
export interface EnemyDef {
  key: 'basic' | 'fast' | 'tank';
  hp: number;
  speed: number;
  radius: number;
  tint: number;
}
export const ENEMIES: Record<'basic' | 'fast' | 'tank', EnemyDef> = {
  basic: { key: 'basic', hp: 40, speed: 1.3, radius: 12, tint: TINT.enemyBasic },
  fast: { key: 'fast', hp: 26, speed: 2.2, radius: 9, tint: TINT.enemyFast },
  tank: { key: 'tank', hp: 200, speed: 0.85, radius: 15, tint: TINT.enemyTank },
};

// ── 经济 / 局面 ────────────────────────────────────────────────────────────
export const START_GOLD = 300;
export const START_LIVES = 20;
export const INCOME_PER = 8;    // 金币涓流：每 INCOME_EVERY tick +INCOME_PER（over-time 被动收入）
export const INCOME_EVERY = 60;

// ── 车道（NavGraph 数据·enemies 沿它走向 base）+ 出生/大本营几何 ────────────
// 世界坐标；y 落在 [TOP_BAR_H, FIELD_H-BOTTOM_BAR_H] 之间，避免被 HUD 条盖住。
// 单调右进的锯齿道（x 严格递增）——pathfind 按「最近节点」入图，若后继节点在几何上落到智能体身后，
// repath 会让它掉头（早期回字形道踩过：敌人在 y 平行道间反复横跳）。x 单调 → 任一次重锚都指向前方 → 不倒走。
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
export const SPAWN = { x: 10, y: 180 };       // 敌人出生点（node0 附近·屏内）
export const BASE_POS = { x: 900, y: 290 };   // 大本营（车道终点右侧·node5 水平引入）
export const LANE_WIDTH = 26;
export const PROBE_R = 14;                    // 漏怪探针半径（几何见 blueprint 注释）
export const ARRIVE_RANGE = 12;               // NavAgent 到点停距

// ── HUD 霓虹主题（UITheme 全字段·换皮即改这里）─────────────────────────────
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
