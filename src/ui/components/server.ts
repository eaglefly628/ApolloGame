// UI Server — mountUI()：将 LayoutNode 树挂载到 DOM，分发事件到 handlers。
//
// 事件模型：HTML 用 data-action / data-arg 标记交互点；
// server 在根节点监听冒泡，按 action key 路由到 handlers。
// 游戏层只提供 LayoutNode（数据）+ HandlerMap（回调），无需写 DOM 代码。

import { renderNode } from './render.js';
import { SHELL } from '../shell-theme.js';
import type { LayoutNode, HandlerMap, UITheme, ToastProps } from './types.js';

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
  theme: UITheme = SHELL,
): () => void {
  host.innerHTML = renderNode(root, theme);

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

  // Tabs 切页（抗闪屏·引擎内建·下沉自 game-g 大厅 setTab）：点 [data-tab] → 就地 toggle 页 display + nav 高亮，
  // **不重建页内容**（解决"切页重建大网格/跳滚动"一类 bug 一次·所有游戏受益）。嵌套 Tabs 按 closest 归属隔离。
  const switchTab = (e: Event): void => {
    const btn = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (!btn) return;
    const tabsRoot = btn.closest('[data-tabs]') as HTMLElement | null;
    if (!tabsRoot) return;
    const id = btn.dataset['tab'];
    if (!id) return;
    tabsRoot.querySelectorAll<HTMLElement>('[data-tabpage]').forEach((pg) => {
      if (pg.closest('[data-tabs]') !== tabsRoot) return; // 跳过嵌套 Tabs 的页
      pg.style.display = pg.dataset['tabpage'] === id ? 'block' : 'none';
    });
    tabsRoot.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => {
      if (b.closest('[data-tabs]') !== tabsRoot) return;
      const on = b.dataset['tab'] === id;
      b.style.color = on ? theme.gold : theme.sub;
      b.style.borderBottomColor = on ? theme.gold : 'transparent';
    });
  };

  // Modal 遮罩点击关闭（引擎内建）：仅当点击**落在遮罩本身**（非弹窗体内部）时触发 closeAction。
  // 弹窗体的 × 按钮走 data-action（上面 dispatch 处理）；此处只管点背景关闭。
  const modalClose = (e: Event): void => {
    const scrim = (e.target as HTMLElement).closest('[data-modal-close]') as HTMLElement | null;
    if (!scrim || e.target !== scrim) return; // 点的是弹窗体内部 → 不关
    const action = scrim.dataset['modalClose'];
    if (!action) return;
    const fn = handlers[action];
    if (fn) fn();
  };

  // Tooltip 悬浮显隐（引擎内建·内联样式表达不了 :hover）：mouseover/focusin 显气泡、移出隐。
  // 用冒泡的 mouseover/mouseout（mouseenter 不冒泡）；移到同一触发元素内部(child↔气泡)不隐藏。
  const bubbleOf = (trigger: HTMLElement): HTMLElement | null =>
    trigger.querySelector<HTMLElement>(':scope > [data-tooltip-bubble]');
  const tipShow = (e: Event): void => {
    const trigger = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
    if (!trigger) return;
    const b = bubbleOf(trigger);
    if (b) b.style.display = 'block';
  };
  const tipHide = (e: Event): void => {
    const trigger = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
    if (!trigger) return;
    const to = (e as MouseEvent | FocusEvent).relatedTarget as Node | null;
    if (to && trigger.contains(to)) return; // 仍在触发元素内部 → 不隐
    const b = bubbleOf(trigger);
    if (b) b.style.display = 'none';
  };

  host.addEventListener('click',     dispatch);
  host.addEventListener('click',     switchTab);
  host.addEventListener('click',     modalClose);
  host.addEventListener('change',    dispatch);
  host.addEventListener('mouseover', tipShow);
  host.addEventListener('mouseout',  tipHide);
  host.addEventListener('focusin',   tipShow);
  host.addEventListener('focusout',  tipHide);

  return () => {
    host.removeEventListener('click',     dispatch);
    host.removeEventListener('click',     switchTab);
    host.removeEventListener('click',     modalClose);
    host.removeEventListener('change',    dispatch);
    host.removeEventListener('mouseover', tipShow);
    host.removeEventListener('mouseout',  tipHide);
    host.removeEventListener('focusin',   tipShow);
    host.removeEventListener('focusout',  tipHide);
    host.innerHTML = '';
  };
}

/**
 * 飘字提示（非模态·定时自消）—— fire-and-forget 的挂载器 API。
 * 复用 renderNode 出 Toast 药丸标记，挂到 host 底部居中的堆叠容器；duration(ms·缺省 2600) 后移除。
 * 返回手动关闭函数（提前清掉）。游戏层只调 showToast(host, '保存成功', { tone:'ok' })，不写 DOM。
 *
 * @param host - 挂载目标（toast 浮层挂在它内部·fixed 定位）
 * @param text - 提示文本
 * @param opts - tone 着色 / duration 自消毫秒 / theme 主题
 */
export function showToast(
  host: HTMLElement,
  text: string,
  opts: { tone?: ToastProps['tone']; duration?: number; theme?: UITheme } = {},
): () => void {
  const theme = opts.theme ?? SHELL;
  let stack = host.querySelector<HTMLElement>(':scope > [data-toast-stack]');
  if (!stack) {
    stack = document.createElement('div');
    stack.setAttribute('data-toast-stack', '');
    stack.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:300;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none';
    host.appendChild(stack);
  }
  const holder = document.createElement('div');
  holder.innerHTML = renderNode({ type: 'Toast', id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, props: { text, tone: opts.tone } }, theme);
  const toastEl = holder.firstElementChild as HTMLElement | null;
  if (!toastEl) return () => {};
  stack.appendChild(toastEl);

  let done = false;
  const remove = (): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    toastEl.remove();
    if (stack && stack.childElementCount === 0) stack.remove();
  };
  const timer = setTimeout(remove, opts.duration ?? 2600);
  return remove;
}
