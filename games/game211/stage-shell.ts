// game211 · 3D 台挂载壳（owner 2026-08-10「你应该用新的方法去做啊，不要再违反了」）。
//
// 解决什么：挂一块 3D 试验台需要**两个**宿主元素——一个装 canvas、一个装 LayoutNode HUD。
// 不能合并成一个，因为 `mountUI` **首次挂载**就是把渲染结果整片写进宿主的 inner-HTML
// （`src/ui/components/server.ts:311`）——把宿主原有内容整个抹掉。
// （精确一点：后续 `handle.update()` 走的是**按 id 的 diff/patch**、不整树重挂（server.ts:58-60），
//   但那也只保证「LayoutNode 树内」的节点稳定；把一块 canvas 塞进受 mountUI 管辖的宿主里，
//   靠 diff 恰好不动它是**赌**，不是契约。所以画布宿主必须在 mountUI 的管辖范围之外。）
//
// 旧写法直接用 DOM 造元素的 API 造这两个 div（duel-spike 里 3 处），踩硬红线「游戏层禁手写 DOM」。
// **新写法**：外层壳本身也是 LayoutNode 数据——`mountUI` 渲一次壳，再按 **id** 把两个宿主取出来
// （`renderNode` 会把 LayoutNode.id 落成元素 `id` 属性；`server.ts:65` 内部就是这么取节点的）。
// 壳**只渲染一次、永不 update**，所以里面的 canvas 不会被覆盖；HUD 的 `mountUI` 挂在**兄弟节点**上，
// 随便刷新都碰不到 canvas。→ 游戏层手写 DOM 归零。
//
// ⚠ 顺带绕掉一个老坑：旧壳把 HUD 做成**覆盖在 canvas 上的绝对定位浮层**，于是有了 duel-spike 头注坑①
//（HUD 宿主铺满 + pointer-events 没算准 → 变成透明挡板，点击全被 canvas 吃掉，Playwright 实证
// `<canvas> intercepts pointer events`）。这里改成**竖排两块**（画面在上、面板在下），
// 浮层这个 bug 类别整个不存在了。要浮层观感另说，别再用绝对定位换。
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode, UITheme } from '@zerocraft/engine/ui/components/types.js';

/** 壳句柄：两个宿主 + 拆卸。 */
export interface StageShell {
  /** 装 3D canvas（`engine.attachRenderer(renderer, stage)`）。壳不 update → canvas 安全。 */
  readonly stage: HTMLElement;
  /** 装 LayoutNode HUD（`mountUI(hud, tree, handlers, theme)`·随便刷新）。 */
  readonly hud: HTMLElement;
  readonly destroy: () => void;
}

/** 壳的 LayoutNode 数据（导出供测试钉死结构：两个具名宿主 + 竖排 + 无框）。 */
export function shellTree(stageId: string, hudId: string): LayoutNode {
  return {
    type: 'Panel',
    id: `${stageId}-root`,
    props: { bare: true },   // bare = 纯布局容器·不画边框/底（否则会在 canvas 外面套一圈框）
    layout: { direction: 'column', gap: 0, padding: 0, align: 'center' },
    children: [
      // 画布宿主：不设尺寸——canvas 自带显式像素宽高（ThreeRenderer 构造时给），容器裹着它即可。
      { type: 'Panel', id: stageId, props: { bare: true }, layout: { padding: 0 }, children: [] },
      // HUD 宿主：撑满可用宽度，内容由消费方自己 mountUI 进来。
      { type: 'Panel', id: hudId, props: { bare: true }, layout: { padding: 0, align: 'stretch' }, children: [] },
    ],
  };
}

/** 挂壳。`theme` 只用于渲染壳本身（bare 面板几乎不吃主题·传游戏主题保持一致即可）。 */
export function mountStageShell(container: HTMLElement, theme: UITheme, idPrefix = 'g211-stage'): StageShell {
  const stageId = `${idPrefix}-canvas`;
  const hudId = `${idPrefix}-hud`;
  const handle = mountUI(container, shellTree(stageId, hudId), {}, theme);
  const stage = container.querySelector<HTMLElement>(`[id="${stageId}"]`);
  const hud = container.querySelector<HTMLElement>(`[id="${hudId}"]`);
  if (!stage || !hud) {
    // 取不到 = 壳渲染契约变了（LayoutNode.id 不再落成元素 id）。宁可炸也不要静默退化成
    // 「canvas 挂了个 null 上、画面全黑还没人知道为什么」——那正是本仓最难查的那类 bug 的形状。
    throw new Error(`[stage-shell] 壳渲染后取不到宿主（stage=${!!stage} hud=${!!hud}）——renderNode 的 id 落法可能变了`);
  }
  return {
    stage,
    hud,
    destroy: () => { handle(); },   // MountHandle 本身可调用 = 卸载（server.ts:46）
  };
}
