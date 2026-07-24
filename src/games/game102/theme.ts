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
// 色板对齐 design-ref/README「补给罐」闭集（花园主题·绿/黑/红/橙/黄）+ 像素画常用白。
export interface PaletteColor { readonly name: string; readonly bit: number; readonly tint: number; }
export const PALETTE: Readonly<Record<string, PaletteColor>> = {
  green:  { name: 'green',  bit: 1 << 0, tint: 0x5cb544 },
  black:  { name: 'black',  bit: 1 << 1, tint: 0x2f3140 },
  red:    { name: 'red',    bit: 1 << 2, tint: 0xe0433f },
  orange: { name: 'orange', bit: 1 << 3, tint: 0xef8a2b },
  yellow: { name: 'yellow', bit: 1 << 4, tint: 0xf2c21e },
  white:  { name: 'white',  bit: 1 << 5, tint: 0xeaf2ff },
};

// 身份位（与颜色位分段·不冲突）。
export const CANNON_BIT = 1 << 12; // 传送带上的色炮
export const CELL_BIT   = 1 << 13; // 中央棋盘像素块
export const KEY_BIT    = 1 << 14; // 金钥匙收集件（叠加在其所在格上）

// ── play-field 尺寸 = design-ref 定尺舞台 650×1424（1:1 复刻基准·mountHost 等比信箱缩放到设备）──
export const FIELD_W = 650;
export const FIELD_H = 1424;

// ── 管道框（装饰·render-only·design-ref README「Pipe track」）──────────────────
// 金属管渐变/圆角/内阴影靠 S6 Sprite；S3 素坯用分层灰盒近似结构。
export const PIPE = { x: 15, y: 118, w: 620, h: 758 } as const;

// ── 像素画窗口（board_picture.png 底图 + 棋盘格覆盖·design-ref README「Picture window」）──
export const PICTURE = { x: 93, y: 248, w: 467, h: 512, bg: 0x1a1c2e } as const;

// ── 棋盘几何：格阵铺满 PICTURE 窗口（每关 cols×rows 自适应·居中）。BOARD_* 由 blueprint 按关算。
export const BOARD_PAD = 6;    // 窗口内边距
export const BOARD_GAP = 3;    // 格间距（design gap:3）

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

// 传送带容量区（沿管道环·design-ref 管道框内圈）+ 待命槽/补给几何（design-ref 定尺坐标）。
export const CONVEYOR = { minX: PIPE.x, minY: PIPE.y, maxX: PIPE.x + PIPE.w, maxY: PIPE.y + PIPE.h } as const;
// 待命槽 ×5：top:956 · 104×80 · left=40+i*118（README「Standby slots」）。
export const TRAY = { originX: 40 + 52, originY: 956 + 40, gap: 118, capacity: CONFIG.SLOTS, w: 104, h: 80, top: 956 } as const;
// 补给罐：前排(可点) top:1040 + 后备两排(装饰) top:1150/1248 · 列 left=[104,218,332,446] · 104×118。
export const SUPPLY = { colLeft: [104, 218, 332, 446], w: 104, h: 118, frontTop: 1040, midTop: 1150, backTop: 1248 } as const;
// 底部红色操作栏（装饰底衬·4 圆钮 = PUI chrome）。
export const ACTION_BAR = { x: 0, y: 1424 - 118, w: 650, h: 118 } as const;
