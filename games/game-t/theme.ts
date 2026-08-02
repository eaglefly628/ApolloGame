// Game T ·《墨消》—— 常量 / 观感令牌 / 棋盘几何（纯数据·设计真相=docs/design/game-t/{gdd,level-schema}.md）。
// 六品墨珠 tint 为程序化占位观感（S6 美术关对齐 apollo-toon 8 色板换真皮·MatchBoard.kindSkinEntities 皮肤槽已留位）。

// ── 竖屏三分区（GDD §五：顶=目标+步数 HUD · 中=棋盘 · 底=道具条）──────────────
export const FIELD_W = 440; // 逻辑画布（竖屏）
export const FIELD_H = 780;
export const TOP_BAR_H = 116;
export const BOTTOM_BAR_H = 92;
export const CELL = 50; // 格距
export const TILE = 44; // 珠体（box 边长·格距留缝）
export const BOARD_TOP = 150; // 板区世界坐标顶缘（世界坐标=画布逻辑坐标·无相机）

// 相位节拍：60tps × 8 tick ≈ 133ms —— GDD §五点五-9「连锁每级 ~150ms 呼吸感」的 sim 侧节拍
// （render-only 手感动画层=REQ-M3-三期④·落地后叠加，不改本节拍语义）。
export const STEP_DELAY = 8;
// 终步结算窗：moves 用尽 → flow 进 lastcall，等连锁收尾再判负（CC 惯例：末步连锁补齐目标仍算胜）。
// 引擎今日无「棋盘已稳定」可判条件（缺口已记 docs/design/game-t/requests.md），取宽裕定值 420 tick ≈ 7s。
export const SETTLE_TICKS = 420;

export const SCORE_PER_TILE = 60; // GDD §四：单珠消除 60 分（连锁每级 ×1.5=引擎 config 缺口·见 requests）
export const BRUSH_PER_MOVE = 1000; // 收笔：剩步 ×1000 计入总分（V1 简化·结算数据·sim 外纯函数）

// ── 六品墨珠（GDD §二 映射表·程序化占位色）────────────────────────────────────
export const INK_TINTS = [0x33363f, 0xbf4136, 0xd9a441, 0x4d8a54, 0x4f8fa8, 0x8a6aa0] as const;
export const INK_NAMES = ['墨玉', '朱砂', '缃金', '竹青', '天青', '藕紫'] as const;
export const INK_LABELS = ['玉', '砂', '金', '竹', '天', '紫'] as const; // kindLabel（ascii 渲染/调试用·画布走色块）
// 皮肤槽 key（art-pipeline 三行接入①：theme 定 key → 蓝图 Sprite 槽 → requirements 推导脚本）。
// 真图未生成前 index 无此 key → spriteReady=false → 回退 Shape 色块（观感零变·mock 纪律）。
export const INK_SKIN_KEYS = ['t/ink-0', 't/ink-1', 't/ink-2', 't/ink-3', 't/ink-4', 't/ink-5'] as const;

// ── 格层摆盘参考色（静态初始观感·REQ-M3-三期① LayerCell 落地前不随 sim 刷新——
//    洗墨/破瓷进度看 HUD 活计数；① 落地即换实时层视图）────────────────────────────
export const TINT_JELLY = 0x7a5f96; // 墨渍（果冻）
export const TINT_PORCELAIN = 0x9fb6c0; // 冰纹瓷（hp 障碍）
export const TINT_STONE = 0x4a453d; // 砚石（不可动地形）
export const TINT_EMPTY = 0xe8e0cd; // 开局未补格的宣纸底

export const boardLeft = (cols: number): number => Math.round((FIELD_W - cols * CELL) / 2);

/** 格心世界坐标（蓝图摆盘与走查测试共用·几何单一真相）。 */
export function cellCenter(cols: number, index: number): { x: number; y: number } {
  const c = index % cols;
  const r = Math.floor(index / cols);
  return { x: boardLeft(cols) + c * CELL + CELL / 2, y: BOARD_TOP + r * CELL + CELL / 2 };
}
