// Game I · 控件测试场（UI Gallery）—— 把引擎数据驱动 UI 的全控件铺成可玩画廊。
//
// 它没有玩法——它的「玩法」就是玩 UI：填数据即出像素、动一下就有信号、换令牌即变脸。
// 卡带 launcher 槽契约：mount(container) → cleanup。
//
// 职责：在 container 里摆「画廊 + 事件日志」两栏 → 用引擎 mountUI 解释画廊数据。
// 换皮 = 换一份 UITheme 令牌包后重挂同一棵 LayoutNode（数据一字不改）。
//
// 注意：画廊本体（gallery.ts）是 100% 数据；事件日志面板与换皮重挂属于宿主运行时，
// 不是游戏数据——这正是契约里「工程师写 mountUI/host 层」该待的地方。

import { mountUI, showToast, resolveBindings } from '@ui/components/index.js';
import type { UITheme, UIDataSource, LayoutNode } from '@ui/components/index.js';
import { buildGallery, modalOverlay, drawerOverlay, INITIAL_CONTROLS, type ControlsState } from './gallery.js';
import { buildHandlers } from './handlers.js';
import { THEMES } from './themes.js';
import { applyShop, INITIAL_SHOP, type ShopState } from './shop.js';
import { applyPick, INITIAL_PICK, type PickState } from './pickcards.js';

export function mount(container: HTMLElement): () => void {
  // ── 两栏骨架：左画廊（弹性）+ 右事件日志（固定宽）──────────────
  const root = document.createElement('div');
  // -webkit-font-smoothing:antialiased：关掉 subpixel(LCD) 文字抗锯齿。
  // M1/Mac Chrome 下 subpixel 文字在合成滚动层上会被 GPU 栅格成黑（点击才恢复·滚动不行）；
  // 灰度抗锯齿不依赖不透明背景、不触发该缺陷。这是此 M1 黑字 bug 的对症修法。
  root.style.cssText =
    'position:absolute;inset:0;display:flex;overflow:hidden;background:#06080d;' +
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale';

  let galleryHost = document.createElement('div');
  // 不透明背景：合成滚动层背景透明时，部分 GPU 会算错文字栅格（字变黑）→ 给它实底色。
  const galleryHostCss = 'flex:1;min-width:0;overflow-y:auto;background:#06080d';
  galleryHost.style.cssText = galleryHostCss;

  const logPane = document.createElement('aside');
  logPane.style.cssText =
    'width:320px;flex-shrink:0;padding:16px;overflow-y:auto';

  const logTitle = document.createElement('div');
  logTitle.textContent = '事件日志 · EVENT LOG';
  logTitle.style.cssText = 'font-size:10px;letter-spacing:2.4px;margin-bottom:10px';

  const logBody = document.createElement('div');
  logBody.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:12px';

  logPane.append(logTitle, logBody);
  root.append(galleryHost, logPane);
  // 模态/抽屉的独立浮层宿主（满屏 fixed·开关它不碰画廊 → 不跳不黑）。
  const overlayHost = document.createElement('div');
  root.appendChild(overlayHost);
  container.appendChild(root);

  // ── 事件日志状态 ─────────────────────────────────────────────
  interface LogLine { action: string; arg?: string; t: string }
  const lines: LogLine[] = [];

  const now = (): string =>
    new Date().toLocaleTimeString('zh-CN', { hour12: false });

  function applyPaneTheme(theme: UITheme): void {
    logPane.style.background = theme.bg2;
    logPane.style.borderLeft = `1px solid ${theme.line}`;
    logPane.style.fontFamily = theme.fontMono;
    logTitle.style.color = theme.dim;
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderLog(theme: UITheme): void {
    logBody.innerHTML = '';
    if (lines.length === 0) {
      const hint = document.createElement('div');
      hint.textContent = '动一下任意控件，信号会出现在这里。';
      hint.style.color = theme.dim;
      logBody.append(hint);
      return;
    }
    for (const ln of lines.slice(-200).reverse()) {
      const row = document.createElement('div');
      row.style.fontFamily = theme.fontMono;
      const time = `<span style="color:${theme.dim}">${ln.t}</span>`;
      const name = `<span style="color:${theme.jade}">${ln.action}</span>`;
      const arg = ln.arg !== undefined
        ? ` <span style="color:${theme.text}">${escapeHtml(ln.arg)}</span>`
        : '';
      row.innerHTML = `${time} ${name}${arg}`;
      logBody.append(row);
    }
  }

  // ── 宿主状态（MVU：UI = 状态的纯函数；改状态 → ui.update 局部更新·不整树重挂）──
  let currentTheme = 'onyx';
  let shop: ShopState = INITIAL_SHOP;  // 组合演示·商店
  let pick: PickState = INITIAL_PICK;  // 组合演示·选牌
  let controls: ControlsState = INITIAL_CONTROLS; // 自定义画选中态的控件值（speed/view/rating/qty/city/flag/sound）

  // 演示用「世界」状态 + 注入式数据源（resolveBindings 活 HUD 用·解耦 ECS）。
  const world = { hp: { current: 70, max: 100 }, gold: { current: 1280 } };
  const dataSource: UIDataSource = {
    resource: (id) => (world as Record<string, { current: number; max?: number }>)[id],
  };

  const theme = (): UITheme => THEMES[currentTheme] ?? THEMES['onyx']!;

  // 模态/抽屉作独立浮层挂在 overlayHost（与画廊解耦·开关不触发画廊重渲 → 不跳不黑）。
  let overlayNode: LayoutNode | null = null;
  let overlayTeardown: (() => void) | null = null;
  function showOverlay(node: LayoutNode | null): void {
    overlayNode = node;
    if (overlayTeardown) { overlayTeardown(); overlayTeardown = null; }
    if (node) overlayTeardown = mountUI(overlayHost, node, handlers, theme());
  }

  const handlers = buildHandlers({
    log: (action, arg) => { lines.push({ action, arg, t: now() }); renderLog(theme()); },
    setTheme: (value) => { currentTheme = value; rerender(true); },
    setModal: (open) => { showOverlay(open ? modalOverlay : null); },
    setDrawer: (open) => { showOverlay(open ? drawerOverlay : null); },
    afterTabSwitch: () => { nudgeRepaint(); }, // 切到的新页（之前 display:none）强制重栅格 → 消除「显示即黑」
    setControl: (kind, arg) => {
      if (kind === 'flag') controls = { ...controls, flag: arg === 'true' };
      else if (kind === 'sound') controls = { ...controls, sound: arg === 'true' };
      else if (kind === 'speed') controls = { ...controls, speed: arg ?? controls.speed };
      else if (kind === 'view') controls = { ...controls, view: arg ?? controls.view };
      else if (kind === 'qty') controls = { ...controls, qty: Math.max(0, Number(arg) || 0) };
      else if (kind === 'rating') controls = { ...controls, rating: Number(arg) || controls.rating };
      else if (kind === 'city') controls = { ...controls, city: arg ?? controls.city };
      rerender();
    },
    toast: (tone) => {
      const text = { ok: '操作成功 ✓', warn: '请注意 ⚠', danger: '出错了 ✕' }[tone ?? 'ok'] ?? '提示';
      showToast(root, text, { tone: tone as 'ok' | 'warn' | 'danger' | undefined, theme: theme() });
    },
    hurt: (n) => { world.hp.current = Math.max(0, world.hp.current - n); rerender(); },
    heal: (n) => { world.hp.current = Math.min(world.hp.max, world.hp.current + n); world.gold.current += n; rerender(); },
    shopDispatch: (kind, arg) => {
      const { state, toast } = applyShop(shop, kind, arg); // 纯 reducer 出新状态 + toast 意图
      shop = state;
      if (toast) showToast(root, toast.text, { tone: toast.tone, theme: theme() });
      rerender();
    },
    pickDispatch: (kind, arg) => {
      const { state, toast } = applyPick(pick, kind, arg);
      pick = state;
      if (toast) showToast(root, toast.text, { tone: toast.tone, theme: theme() });
      rerender();
    },
  });

  // 渲染前用数据源把 bind 节点解析成字面值（活 HUD·resolveBindings 返回新树·纯函数）。
  // activeTab 恒为首页常量：Tab 切换由 mountUI 内建就地处理（不重渲），数据里 active 不变 →
  // reconcile 永不替换整个 Tabs（含各页/表格）→ 切页态/滚动/输入态全保留、不回弹、不黑。
  const buildTree = (): LayoutNode =>
    resolveBindings(buildGallery(currentTheme, false, false, shop, pick, 'tab-layout', controls), dataSource);

  // 整体挂载后延后一帧强制重绘：消除部分 GPU 在合成滚动层首帧把文字栅格成「陈旧黑字」的故障
  // （等效用户「点一下」，但时机对——必须晚于首帧黑色绘制，所以用双 rAF；同步切 display 在首帧前跑无效）。
  function nudgeRepaint(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // visibility 切换强制重绘但不重置滚动位（兜底·主修是 font-smoothing）。
      galleryHost.style.visibility = 'hidden';
      void galleryHost.offsetHeight; // 强制重排
      galleryHost.style.visibility = '';
    }));
  }

  // 挂载一次；之后改状态都走 ui.update 局部更新（只补丁变化的子树·不整树重挂·Tab/滚动/输入态不丢·无黑屏）。
  let ui = mountUI(galleryHost, buildTree(), handlers, theme());
  applyPaneTheme(theme());
  renderLog(theme());
  nudgeRepaint(); // 初次挂载

  function rerender(themeChanged = false): void {
    if (themeChanged) {
      // 换皮整盘换色：重建 galleryHost（全新元素 = 全新合成层），规避大改后旧滚动层「陈旧黑字」。
      ui();
      const fresh = document.createElement('div');
      fresh.style.cssText = galleryHostCss;
      galleryHost.replaceWith(fresh);
      galleryHost = fresh;
      ui = mountUI(galleryHost, buildTree(), handlers, theme());
      applyPaneTheme(theme());
      if (overlayNode) showOverlay(overlayNode); // 浮层也换新皮
      nudgeRepaint(); // 换皮整盘换色后同样消除陈旧黑字
    } else {
      ui.update(buildTree()); // 局部更新（diff/patch）
    }
    renderLog(theme());
  }

  // ── 卡带 cleanup ─────────────────────────────────────────────
  return () => {
    if (overlayTeardown) overlayTeardown();
    ui();
    root.remove();
  };
}
