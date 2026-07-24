// game101 · S1 主界面 —— buildS1(): LayoutNode（GD 布局稿 layout/s1.layout.json 移植·数据一致）。
//
// UI 铁律：全 LayoutNode 闭集控件（Screen/Panel/Label/Button/Avatar/Badge/ProgressBar）·纯数据·零手写 DOM。
// 布局稿由 GD-101 用真 UI 库产出（docs/design/game101/layout·validateLayoutNode 0 issue）→ 本文件原样落地。
// 交互写世界=action 信号（handler 无自由逻辑）：open_shop/open_menu/open_tasks/open_reno/open_events / deliver_order。
//
// 边界（layout/README §边界）：树里的 `board-grid` 是 **LayoutNode 占位·仅设计示意**；合并板正装=引擎 render
// 组件（play-field·见 game101.ts）。M1b 视觉对齐先原样挂稿；把 board-grid 槽换成引擎实时棋盘=后续集成步。
import type { LayoutNode } from '@ui/components/types.js';
import s1Tree from './layout/s1.layout.json';

export function buildS1(): LayoutNode {
  return s1Tree as unknown as LayoutNode;
}
