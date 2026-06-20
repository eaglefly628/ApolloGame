// UI Server — mountUI()：将 LayoutNode 树挂载到 DOM，分发事件到 handlers。
//
// 事件模型：HTML 用 data-action / data-arg 标记交互点；
// server 在根节点监听冒泡，按 action key 路由到 handlers。
// 游戏层只提供 LayoutNode（数据）+ HandlerMap（回调），无需写 DOM 代码。

import { renderNode } from './render.js';
import type { LayoutNode, HandlerMap } from './types.js';

/**
 * 挂载静态 UI：渲染 LayoutNode 树到 host，绑定事件，返回清理函数。
 *
 * @param host     - 挂载目标容器
 * @param root     - LayoutNode 树（纯数据，弱模型填写）
 * @param handlers - action key → 回调函数（引擎或游戏层提供）
 * @returns        - teardown()：移除 DOM + 解绑事件
 */
export function mountUI(
  host: HTMLElement,
  root: LayoutNode,
  handlers: HandlerMap = {},
): () => void {
  host.innerHTML = renderNode(root);

  const dispatch = (e: Event): void => {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset['action'];
    if (!action) return;
    const fn = handlers[action];
    if (!fn) return;

    if (e.type === 'change') {
      if (el.tagName === 'SELECT') {
        fn((el as HTMLSelectElement).value);
      } else if (el.tagName === 'INPUT') {
        const inp = el as HTMLInputElement;
        fn(inp.type === 'checkbox' ? String(inp.checked) : inp.value);
      }
    } else {
      fn(el.dataset['arg']);
    }
  };

  host.addEventListener('click',  dispatch);
  host.addEventListener('change', dispatch);

  return () => {
    host.removeEventListener('click',  dispatch);
    host.removeEventListener('change', dispatch);
    host.innerHTML = '';
  };
}
