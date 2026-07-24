// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// M1b 视觉：挂 S1 主界面 LayoutNode 稿（buildS1·GD 布局稿移植·数据一致）+ game101 暖色主题。
// 全 UI = LayoutNode 闭集控件（HUD/顾客订单/棋盘占位/底部导航）·纯数据·零手写 DOM（UI 铁律）。
// 交互写世界=action 信号（handler 无自由逻辑）；导航信号目前为壳层占位（sim 弹层=M2）。
//
// 边界：合并板正装=引擎 render 组件（play-field·blueprint.ts 已备 merge-rule/prefab/资源/体力恢复，
// headless 7/7 绿）；把 S1 的 board-grid 占位换成引擎实时棋盘=后续集成步（见 s1.ts 头注）。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap } from '@ui/components/index.js';
import { buildS1 } from './s1.js';
import { GAME101_THEME } from './ui-theme.js';

const SCREEN_W = 1080;
const SCREEN_H = 1920;

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  // 定尺缩放盒（1080×1920 竖屏·等比信箱化嵌容器）。
  const { scene, teardown } = mountHost(container, {
    fieldW: SCREEN_W,
    fieldH: SCREEN_H,
    sceneBackground: GAME101_THEME.pageBg,
    wrapperBackground: '#2a1c12',
  });

  // 导航信号占位（M2 接商店/任务/装修/活动弹层·此处不塞自由逻辑）。
  const noop = (): void => {};
  const handlers: HandlerMap = {
    open_shop: noop, open_menu: noop, open_tasks: noop, open_reno: noop, open_events: noop,
    deliver_order: noop,
  };

  const ui = mountUI(scene, buildS1(), handlers, GAME101_THEME);

  return () => {
    ui();
    teardown();
  };
}
