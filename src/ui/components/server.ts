// UI Server — mountUI()：将 LayoutNode 树挂载到 DOM，分发事件到 handlers。
//
// 事件模型：HTML 用 data-action / data-arg 标记交互点；
// server 在根节点监听冒泡，按 action key 路由到 handlers。
// 游戏层只提供 LayoutNode（数据）+ HandlerMap（回调），无需写 DOM 代码。

import { renderNode, renderVListWindow } from './render.js';
import { SHELL } from '../shell-theme.js';
import type { LayoutNode, HandlerMap, ActionSink, UITheme, ToastProps, VirtualListProps } from './types.js';

/** mountUI 句柄：调用即 teardown（向后兼容）；`.update(newTree, theme?)` 做局部更新（最小 diff）。 */
export type MountHandle = (() => void) & { update: (root: LayoutNode, theme?: UITheme) => void };

// 背景滚动关键帧名全局序号（多 mount 不撞名）。
let __bgScrollSeq = 0;

// 按 id 在 LayoutNode 树里找节点（VirtualList 滚动重渲要从 root 取行数据）。
function findNode(node: LayoutNode, id: string): LayoutNode | undefined {
  if (node.id === id) return node;
  for (const ch of node.children ?? []) { const f = findNode(ch, id); if (f) return f; }
  return undefined;
}

// ── 局部更新（diff/patch）核心 ───────────────────────────────────
// 标准 UI 做法：不整树重挂，按 id 最小化打补丁——只替换「自身或子集真变了」的最浅子树，
// 其余 DOM 原样保留（Tab 切页态/滚动位/焦点/native 输入态天然不丢；避免整树 innerHTML 替换
// 在合成滚动容器上的陈旧重绘故障）。每个节点都渲染成带 id 的元素，故可按 id 定位与递归。

function uiEscId(id: string): string { return id.replace(/(["\\])/g, '\\$1'); }
function uiFindById(scope: ParentNode, id: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(`[id="${uiEscId(id)}"]`);
}
/** 节点「自身」是否未变（类型 + props + layout 相等；不看 children）。 */
function uiOwnSame(a: LayoutNode, b: LayoutNode): boolean {
  return a.type === b.type
    && JSON.stringify(a.props) === JSON.stringify(b.props)
    && JSON.stringify(a.layout ?? null) === JSON.stringify(b.layout ?? null);
}
/** 子节点的「键序」（id + type）是否一致（增删/换位/换型 → 不一致）。 */
function uiChildKeysSame(a: LayoutNode, b: LayoutNode): boolean {
  const ak = a.children ?? [], bk = b.children ?? [];
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) if (ak[i]!.id !== bk[i]!.id || ak[i]!.type !== bk[i]!.type) return false;
  return true;
}
/**
 * 焦点保护：若将被销毁重建的子树里含当前焦点的输入元素（Input/Combobox 的 <input>），
 * 用「就地覆写 value/属性」替代 outerHTML 重建——保住焦点/光标/IME 组合态。返回是否已就地处理。
 */
function patchFocusedInput(el: HTMLElement, newN: LayoutNode): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active || !(el === active || el.contains(active))) return false;
  if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && active.tagName !== 'SELECT') return false;
  // 仅同步可控值，不动焦点元素本身的结构。
  const p = newN.props as { value?: string | number; placeholder?: string };
  if (newN.type === 'Input' && el === active) {
    const inp = el as HTMLInputElement;
    if (p.value !== undefined && inp.value !== String(p.value)) inp.value = String(p.value);
    if (p.placeholder !== undefined) inp.placeholder = String(p.placeholder);
    return true;
  }
  // Combobox 等：焦点在内部 input → 保守跳过本帧重建（避免毁焦点），下次失焦再整体对齐。
  return true;
}

/** 把 newN 最小化打补丁到 scope 内 id=newN.id 的元素上（与 oldN 比较）。 */
function reconcileNode(scope: ParentNode, oldN: LayoutNode, newN: LayoutNode, theme: UITheme): void {
  const el = uiFindById(scope, newN.id);
  if (!el) return; // 上层未变才会递进到此；找不到则跳过（安全）
  if (!uiOwnSame(oldN, newN) || !uiChildKeysSame(oldN, newN)) {
    // 焦点在内的输入元素：就地覆写值，不销毁重建（保焦点/光标/IME）。
    if (patchFocusedInput(el, newN)) return;
    el.outerHTML = renderNode(newN, theme); // 自身或子集变了 → 整体替换这棵最浅子树
    return;
  }
  const ak = oldN.children ?? [], bk = newN.children ?? [];
  for (let i = 0; i < ak.length; i++) reconcileNode(el, ak[i]!, bk[i]!, theme); // 自身同 → 递归子节点
}

/**
 * 挂载静态 UI：渲染 LayoutNode 树到 host，绑定事件，返回清理函数。
 *
 * @param host     - 挂载目标容器
 * @param root     - LayoutNode 树（纯数据，弱模型填写）
 * @param handlers - action key → 回调函数（引擎或游戏层提供）
 * @returns        - teardown()：移除 DOM + 解绑事件
 */
// 动画关键帧预设（引擎内建·一次注入 document·LayoutConstraints.anim 引用）。
const APOLLO_KEYFRAMES = `
@keyframes apollo-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes apollo-slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes apollo-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes apollo-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes apollo-dealIn{from{opacity:0;transform:translateY(-20px) rotate(-8deg)}to{opacity:1;transform:translateY(0) rotate(0)}}
@keyframes apollo-flyIn{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
@keyframes apollo-coin-heads{0%{transform:rotateX(60deg)}100%{transform:rotateX(1800deg)}}
@keyframes apollo-coin-tails{0%{transform:rotateX(60deg)}100%{transform:rotateX(1980deg)}}
@keyframes apollo-spark{0%{transform:scale(.4);opacity:0}40%{transform:scale(1.25);opacity:1}100%{transform:scale(1);opacity:.9}}
@keyframes apollo-clash{0%,100%{transform:translateX(0)}30%{transform:translateX(-5px)}60%{transform:translateX(5px)}}
@keyframes apollo-sheen{0%{left:-60%}60%,100%{left:140%}}
@keyframes apollo-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes apollo-glow{0%,100%{box-shadow:0 0 22px rgba(232,205,130,.5)}50%{box-shadow:0 0 50px rgba(232,205,130,.95)}}
@keyframes apollo-pulse{0%,100%{opacity:.55}50%{opacity:1}}
[data-flipcard] [data-flip-front],[data-flipcard] [data-flip-back]{transition:transform .3s cubic-bezier(.4,0,.2,1);backface-visibility:hidden;transform-origin:50% 50%}
[data-flipcard] [data-flip-back]{transform:scaleX(0)}
[data-flipcard]:hover [data-flip-front]{transform:scaleX(0)}
[data-flipcard]:hover [data-flip-back]{transform:scaleX(1)}
@keyframes apollo-sheen-sweep{0%{background-position:220% 0}100%{background-position:-60% 0}}
[data-sheen]{position:relative}
[data-sheen]::after,[data-fx~="sheen"]::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.4) 50%,transparent 58%);background-size:250% 100%;animation:apollo-sheen-sweep 3.2s ease-in-out infinite}
@keyframes apollo-fx-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(calc(-1 * var(--fx-amp,4px)))}60%{transform:translateX(var(--fx-amp,4px))}}
@keyframes apollo-fx-flash{0%{opacity:0}25%{opacity:.7}100%{opacity:0}}
[data-fx~="flash"]::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:var(--fx-flash,#d3897a);mix-blend-mode:screen;animation:apollo-fx-flash var(--fx-flash-ms,420ms) ease-out both}`;
function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('apollo-ui-keyframes')) return;
  const st = document.createElement('style');
  st.id = 'apollo-ui-keyframes';
  st.textContent = APOLLO_KEYFRAMES;
  (document.head ?? document.documentElement).appendChild(st);
}

export function mountUI(
  host: HTMLElement,
  root: LayoutNode,
  handlers: HandlerMap = {},
  theme: UITheme = SHELL,
  input?: ActionSink, // 传它 → 无本地 handler 的 action 走信号入队（UI 只发信号·逻辑入 sim 能力层·人/AI 共用动作总线）
): MountHandle {
  ensureKeyframes();
  host.innerHTML = renderNode(root, theme);

  // 当前已挂载的树与主题（update 做最小 diff 的基线·VirtualList 复绑取数据）。
  let curRoot = root;
  let curTheme = theme;

  // 打字机（收编 VN DialogBox 逐字显）：挂载时把带 data-typewriter 的元素逐字揭示；teardown 清定时器。
  const typers: ReturnType<typeof setInterval>[] = [];
  host.querySelectorAll<HTMLElement>('[data-typewriter]').forEach((el) => {
    const speed = Number(el.dataset['typewriter']) || 30;
    const full = el.textContent ?? '';
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
      el.textContent = full.slice(0, ++i);
      if (i >= full.length) clearInterval(iv);
    }, speed);
    typers.push(iv);
  });

  // 数字滚动补间（收编自掷骰滚到命点/计分跳动·render-only）：把带 data-tween-to 的元素从当前值(=from)动画到 to。
  // 定时器分步 + easeOutCubic；与打字机共用 typers 数组 → teardown 一并清。纯表现·不碰 sim/hash。
  host.querySelectorAll<HTMLElement>('[data-tween-to]').forEach((el) => {
    const to = Number(el.dataset['tweenTo']);
    if (!Number.isFinite(to)) return;
    const ms = Number(el.dataset['tweenMs']) || 600;
    const dec = Number(el.dataset['tweenDec']) || 0;
    const from = Number(el.textContent) || 0;
    const steps = Math.max(1, Math.round(ms / 16));
    let i = 0;
    const iv = setInterval(() => {
      i++;
      const k = i >= steps ? 1 : 1 - Math.pow(1 - i / steps, 3); // easeOutCubic
      el.textContent = (from + (to - from) * k).toFixed(dec);
      if (i >= steps) clearInterval(iv);
    }, 16);
    typers.push(iv);
  });

  // 背景 UV 滚动（render-only·滚动 UI 特效）：给带 data-bgscroll 的元素注入逐元素关键帧（平移 background-position），
  // 无限循环。配 repeating 贴图(texture)即得无缝滚动底纹；teardown 移除注入的 style。
  const scrollStyles: HTMLStyleElement[] = [];
  if (typeof document !== 'undefined') {
    host.querySelectorAll<HTMLElement>('[data-bgscroll]').forEach((el) => {
      const [x, y, ms] = (el.dataset['bgscroll'] ?? '0,0,6000').split(',').map(Number);
      const name = `apollo-bgs-${__bgScrollSeq++}`;
      const st = document.createElement('style');
      st.textContent = `@keyframes ${name}{from{background-position:0 0}to{background-position:${x || 0}px ${y || 0}px}}`;
      (document.head ?? document.documentElement).appendChild(st);
      el.style.animation = `${name} ${ms || 6000}ms linear infinite`;
      scrollStyles.push(st);
    });
  }

  const dispatch = (e: Event): void => {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset['action'];
    if (!action) return;

    // 本次动作的参数：change 取控件值（select / checkbox / 文本 input），其余取 data-arg。
    let arg: string | undefined;
    if (e.type === 'change') {
      if (el.tagName === 'SELECT') arg = (el as HTMLSelectElement).value;
      else if (el.tagName === 'INPUT') {
        const inp = el as HTMLInputElement;
        arg = inp.type === 'checkbox' ? String(inp.checked) : inp.value;
      } else return; // change 只认 select/input
    } else {
      arg = el.dataset['arg'];
    }

    // 路由：本地 handler 优先（迁移期旧屏不破）；无 handler + 有 sink → 发信号入队（UI 只发信号·逻辑在 sim 能力层）。
    const fn = handlers[action];
    if (fn) { fn(arg); return; }
    input?.enqueueAction(action, { arg });
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

  // Accordion 折叠切换（引擎内建）：点标题行 → 就地 toggle 折叠体 display + 箭头旋转（不重建·可选 action 信号另由 dispatch 发）。
  const accordionToggle = (e: Event): void => {
    const head = (e.target as HTMLElement).closest('[data-accordion-head]') as HTMLElement | null;
    if (!head) return;
    const root = head.closest('[data-accordion]') as HTMLElement | null;
    if (!root) return;
    const body = root.querySelector<HTMLElement>(':scope > [data-accordion-body]');
    if (!body) return;
    const willOpen = body.style.display === 'none';
    body.style.display = willOpen ? 'block' : 'none';
    const caret = head.querySelector<HTMLElement>('[data-accordion-caret]');
    if (caret) caret.style.transform = `rotate(${willOpen ? 90 : 0}deg)`;
  };

  // Combobox 搜索下拉（引擎内建）：focus 开面板、input 过滤项、点项回填+发 action(arg=value)+合、点外合。
  const comboOpen = (e: Event): void => {
    const input = (e.target as HTMLElement).closest('[data-combo-search]') as HTMLElement | null;
    if (!input) return;
    const panel = input.closest('[data-combo]')?.querySelector<HTMLElement>(':scope > [data-combo-panel]');
    if (panel) panel.style.display = 'block';
  };
  const comboFilter = (e: Event): void => {
    const input = (e.target as HTMLElement).closest('[data-combo-search]') as HTMLInputElement | null;
    if (!input) return;
    const q = input.value.toLowerCase();
    input.closest('[data-combo]')?.querySelectorAll<HTMLElement>('[data-combo-opt]').forEach((opt) => {
      opt.style.display = (opt.dataset['comboLabel'] ?? '').toLowerCase().includes(q) ? 'block' : 'none';
    });
  };
  const comboClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const opt = target.closest('[data-combo-opt]') as HTMLElement | null;
    if (opt) {
      const root = opt.closest('[data-combo]') as HTMLElement | null;
      const input = root?.querySelector<HTMLInputElement>(':scope > [data-combo-search]');
      const panel = root?.querySelector<HTMLElement>(':scope > [data-combo-panel]');
      if (input) input.value = opt.dataset['comboLabel'] ?? '';
      if (panel) panel.style.display = 'none';
      const action = root?.dataset['combo'], val = opt.dataset['comboOpt'];
      if (action && val != null) { const fn = handlers[action]; if (fn) fn(val); }
      return;
    }
    host.querySelectorAll<HTMLElement>('[data-combo-panel]').forEach((panel) => { // 点外 → 合
      const root = panel.closest('[data-combo]');
      if (root && !root.contains(target)) panel.style.display = 'none';
    });
  };

  // VirtualList 虚拟滚动（引擎内建）：滚动时只把可视窗口的行渲进 spacer（不一次性渲全部·解决千行级卡顿）。
  // 行数据从 root 树取（mountUI 持 root）；每个列表一个 scroll 监听，teardown 逐个解绑。
  const vlistScrolls: Array<{ el: HTMLElement; fn: (e: Event) => void }> = [];
  const bindVlists = (): void => {
    // 幂等：局部更新后剔除已脱离 DOM 的旧监听，再给新出现的 vlist 绑定（读 curRoot/curTheme）。
    for (let i = vlistScrolls.length - 1; i >= 0; i--) {
      if (!host.contains(vlistScrolls[i]!.el)) {
        vlistScrolls[i]!.el.removeEventListener('scroll', vlistScrolls[i]!.fn);
        vlistScrolls.splice(i, 1);
      }
    }
    host.querySelectorAll<HTMLElement>('[data-vlist]').forEach((el) => {
      if (vlistScrolls.some((v) => v.el === el)) return; // 已绑过
      const node = findNode(curRoot, el.dataset['vlist'] ?? '');
      const spacer = el.querySelector<HTMLElement>(':scope > [data-vlist-spacer]');
      if (!node || !spacer) return;
      const p = node.props as VirtualListProps;
      const fn = (): void => { spacer.innerHTML = renderVListWindow(p, el.scrollTop, curTheme); };
      el.addEventListener('scroll', fn);
      vlistScrolls.push({ el, fn });
    });
  };
  bindVlists();

  // ContextMenu 右键菜单（引擎内建）：右键在光标处弹菜单；任意点击合（项的 action 由 dispatch 发）。
  const ctxOpen = (e: Event): void => {
    const trigger = (e.target as HTMLElement).closest('[data-ctxmenu]') as HTMLElement | null;
    if (!trigger) return;
    e.preventDefault();
    host.querySelectorAll<HTMLElement>('[data-ctxmenu-pop]').forEach((pp) => { pp.style.display = 'none'; });
    const pop = trigger.querySelector<HTMLElement>(':scope > [data-ctxmenu-pop]');
    if (!pop) return;
    const me = e as MouseEvent;
    pop.style.left = `${me.clientX}px`;
    pop.style.top = `${me.clientY}px`;
    pop.style.display = 'block';
  };
  const ctxClose = (): void => {
    host.querySelectorAll<HTMLElement>('[data-ctxmenu-pop]').forEach((pp) => { pp.style.display = 'none'; });
  };

  // 拖放（引擎内建·声明式 draggable/dropZone）：dragstart 记下被拖节点 id；
  // 在 [data-drop] 上 dragover 放行、drop 时调 handlers[dropZone信号](被拖节点 id)。HTML5 DnD 一次做完。
  let dragId: string | null = null;
  const onDragStart = (e: Event): void => {
    const el = (e.target as HTMLElement).closest('[data-drag]') as HTMLElement | null;
    if (!el) return;
    dragId = el.dataset['drag'] ?? null;
    const dt = (e as DragEvent).dataTransfer;
    if (dt && dragId != null) dt.setData('text/plain', dragId);
  };
  const onDragOver = (e: Event): void => {
    const zone = (e.target as HTMLElement).closest('[data-drop]') as HTMLElement | null;
    if (zone) e.preventDefault(); // 允许 drop
  };
  const onDrop = (e: Event): void => {
    const zone = (e.target as HTMLElement).closest('[data-drop]') as HTMLElement | null;
    if (!zone) return;
    e.preventDefault();
    const action = zone.dataset['drop'];
    const payload = dragId ?? (e as DragEvent).dataTransfer?.getData('text/plain') ?? '';
    dragId = null;
    if (!action) return;
    const fn = handlers[action];
    if (fn) { fn(payload); return; }                // 本地 handler 优先
    input?.enqueueAction(action, { arg: payload }); // 无 handler + 有 sink → 落点信号 + 被拖 id 作 arg（带参动作走 Signal.arg）
  };

  host.addEventListener('click',       dispatch);
  host.addEventListener('click',       switchTab);
  host.addEventListener('click',       modalClose);
  host.addEventListener('click',       accordionToggle);
  host.addEventListener('click',       comboClick);
  host.addEventListener('click',       ctxClose);
  host.addEventListener('change',      dispatch);
  host.addEventListener('input',       comboFilter);
  host.addEventListener('contextmenu', ctxOpen);
  host.addEventListener('dragstart',   onDragStart);
  host.addEventListener('dragover',    onDragOver);
  host.addEventListener('drop',        onDrop);
  host.addEventListener('mouseover',   tipShow);
  host.addEventListener('mouseout',    tipHide);
  host.addEventListener('focusin',     tipShow);
  host.addEventListener('focusin',     comboOpen);
  host.addEventListener('focusout',    tipHide);

  // 局部更新（标准 UI patch）：把新树最小化打补丁到现有 DOM，不整树重挂。
  // 换皮（theme 变）：颜色烤进渲染串、props 不变 → diff 测不出，整根子树按新主题重渲一次
  // （替换 host 的单个子元素，非 host.innerHTML 全清）；其余情况走按 id 的 reconcile。
  const update = (newRoot: LayoutNode, newTheme?: UITheme): void => {
    if (newTheme && newTheme !== curTheme) {
      curTheme = newTheme;
      const rootEl = uiFindById(host, curRoot.id);
      if (rootEl) rootEl.outerHTML = renderNode(newRoot, newTheme);
      else host.innerHTML = renderNode(newRoot, newTheme);
    } else {
      reconcileNode(host, curRoot, newRoot, curTheme);
    }
    curRoot = newRoot;
    bindVlists(); // 子树可能被替换 → 复绑 vlist 滚动监听
  };

  const teardown = (() => {
    host.removeEventListener('click',       dispatch);
    host.removeEventListener('click',       switchTab);
    host.removeEventListener('click',       modalClose);
    host.removeEventListener('click',       accordionToggle);
    host.removeEventListener('click',       comboClick);
    host.removeEventListener('click',       ctxClose);
    host.removeEventListener('change',      dispatch);
    host.removeEventListener('input',       comboFilter);
    host.removeEventListener('contextmenu', ctxOpen);
    host.removeEventListener('dragstart',   onDragStart);
    host.removeEventListener('dragover',    onDragOver);
    host.removeEventListener('drop',        onDrop);
    host.removeEventListener('mouseover',   tipShow);
    host.removeEventListener('mouseout',    tipHide);
    host.removeEventListener('focusin',     tipShow);
    host.removeEventListener('focusin',     comboOpen);
    host.removeEventListener('focusout',    tipHide);
    vlistScrolls.forEach(({ el, fn }) => el.removeEventListener('scroll', fn));
    typers.forEach((iv) => clearInterval(iv));
    scrollStyles.forEach((s) => s.remove()); // 移除背景滚动注入的 keyframe style
    host.innerHTML = '';
  }) as MountHandle;
  teardown.update = update;
  return teardown;
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
