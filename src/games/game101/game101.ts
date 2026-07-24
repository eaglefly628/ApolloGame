// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 当前挂载 = 完整 S1 主界面（buildS1·GD 布局稿·HUD + 顾客订单 + Twemoji 合并板 + 底部导航）+ game101 暖色主题。
// 全 UI = LayoutNode 闭集控件·纯数据·零手写 DOM（UI 铁律）。
//
// ⚠ 现状与路线（owner 2026-07-24 取舍）：这张 S1 好看但**板是静态 Twemoji 占位**（未接真拖拽合并）。
//   玩法逻辑（生成器点击产出/资源/体力恢复/自动合并）已在 blueprint.ts 写实且 headless 12 测绿——
//   但**尚未整合进这张界面**（引擎 play-field 真板需拖拽合并能力 REQ-MERGE-ON-PLACE·主程域 + 板上真美术 S6）。
//   整合前：打开=这张完整 S1（chrome 齐全）；真·可玩板整合=后续步（chrome=LayoutNode + 中间嵌引擎真板）。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap } from '@ui/components/index.js';
import { buildS1 } from './s1.js';
import { GAME101_THEME } from './ui-theme.js';

const SCREEN_W = 1080;
const SCREEN_H = 1920;

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const { scene, teardown } = mountHost(container, {
    fieldW: SCREEN_W,
    fieldH: SCREEN_H,
    sceneBackground: GAME101_THEME.pageBg,
    wrapperBackground: '#2a1c12',
  });

  // 导航/交互信号占位（真交付/弹层=后续 slice·此处不塞自由逻辑）。
  const noop = (): void => {};
  const handlers: HandlerMap = {
    open_shop: noop, open_menu: noop, open_tasks: noop, open_reno: noop, open_events: noop,
    deliver_order: noop, gen_left: noop, gen_right: noop, delete_sel: noop,
  };

  const ui = mountUI(scene, buildS1(), handlers, GAME101_THEME);

  return () => {
    ui();
    teardown();
  };
}
