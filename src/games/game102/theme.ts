// Game 102 · Pixel Pour《色流工坊》—— 主题/配置常量（纯数据·authoring 期·无 Math.random）。
// 数值基线见 docs/design/game102/gdd.md §3；一切走配置、游戏层不写死。
//
// ⚠ S3 骨架关关键裁定（PE 落地核 tilemap 适配度 · docs/design/game102/pe-handoff.md §2 待验）：
//   中央「像素画棋盘」**不用 t2-tilemap**——tilemap 唯一系统是 tile-collision（把动态体推出实心墙）+ 渲染器画格，
//   没有 per-cell hp 递减 / 命中消除 / 按色计数 的解释器（瓦片「非实体」）。而本作核心循环=
//   「同色弹命中格 → hp-1 → 归零消除 → 按色 group-count → 收集钥匙」全部作用在**实体**上
//   （group-count / launch / hitbox 均 query 实体组件·不读 Tilemap）。故棋盘=**一格一实体**
//   （BoardCell：Transform+Shape+Tag(色位)+Resource(hp)+Color），由现有能力原生消费——
//   纯组合表达、零引擎缺口、守 Lead 裁①。详见 docs/design/game102/requests.md 的 S3 适配核对回执。

// ── 颜色闭集：调色板名 → { bit(用于 Tag 掩码·group-count 按色数), tint(渲染色) } ──────────
export interface PaletteColor { readonly name: string; readonly bit: number; readonly tint: number; }
export const PALETTE: Readonly<Record<string, PaletteColor>> = {
  blue:  { name: 'blue',  bit: 1 << 0, tint: 0x2e6cf6 },
  lblue: { name: 'lblue', bit: 1 << 1, tint: 0x7db8ff },
  teal:  { name: 'teal',  bit: 1 << 2, tint: 0x1fb6a6 },
  navy:  { name: 'navy',  bit: 1 << 3, tint: 0x1b3b8b },
  white: { name: 'white', bit: 1 << 4, tint: 0xeaf2ff },
  gold:  { name: 'gold',  bit: 1 << 5, tint: 0xf7c948 },
};

// 身份位（与颜色位分段·不冲突）。
export const CANNON_BIT = 1 << 12; // 传送带上的色炮
export const CELL_BIT   = 1 << 13; // 中央棋盘像素块
export const KEY_BIT    = 1 << 14; // 金钥匙收集件（叠加在其所在格上）

// ── 棋盘几何（世界坐标·渲染/命中共用）────────────────────────────────────────
export const CELL_SIZE = 32;   // 每格像素
export const BOARD_X = 40;      // 格(0,0)左上角世界 x
export const BOARD_Y = 120;     // 格(0,0)左上角世界 y

// ── 数值配置（gdd §3 基线·全部可被关卡覆盖）──────────────────────────────────
export const CONFIG = {
  AMMO_PER_CANNON: 20,  // 每炮弹药（连喷）
  CONVEYOR_CAP: 5,      // 传送带容量
  BURST_CAP: 10,        // 突破态容量
  SLOTS: 5,             // 待命槽数
  BELT_SPEED: 90,       // 传送带速度 px/s
  COMBO_WINDOW: 90,     // 连击窗口（tick·1.5s@60fps）
  SCORE_CLEAR: 10,      // 单次消除基分 ×combo
} as const;

// 传送带/待命槽几何（S3 立位·S4 接线）。
export const CONVEYOR = { minX: 8, minY: 40, maxX: 360, maxY: 96 } as const;
export const TRAY = { originX: 40, originY: 560, gap: 64, capacity: CONFIG.SLOTS } as const;
export const SUPPLY = { originX: 40, originY: 640, gap: 72 } as const;
