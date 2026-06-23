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
import type { UITheme, UIDataSource } from '@ui/components/index.js';
import { buildGallery } from './gallery.js';
import { buildHandlers } from './handlers.js';
import { THEMES } from './themes.js';
import { applyShop, INITIAL_SHOP, type ShopState } from './shop.js';

export function mount(container: HTMLElement): () => void {
  // ── 两栏骨架：左画廊（弹性）+ 右事件日志（固定宽）──────────────
  const root = document.createElement('div');
  root.style.cssText =
    'position:absolute;inset:0;display:flex;overflow:hidden;background:#06080d';

  const galleryHost = document.createElement('div');
  galleryHost.style.cssText = 'flex:1;min-width:0;overflow-y:auto';

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

  // ── 挂载 / 换皮重挂 / 模态·抽屉开关 ──────────────────────────
  let currentTheme = 'onyx';
  let modalOpen = false;
  let drawerOpen = false;
  let teardown: (() => void) | null = null;

  // 演示用「世界」状态 + 注入式数据源（resolveBindings 活 HUD 用·解耦 ECS）。
  const world = { hp: { current: 70, max: 100 }, gold: { current: 1280 } };
  const dataSource: UIDataSource = {
    resource: (id) => (world as Record<string, { current: number; max?: number }>)[id],
  };

  // 组合演示「商店」的有状态存储（UI = 状态的纯函数·联动从 applyShop reducer 涌现）。
  let shop: ShopState = INITIAL_SHOP;

  const handlers = buildHandlers({
    log: (action, arg) => {
      lines.push({ action, arg, t: now() });
      renderLog(THEMES[currentTheme] ?? THEMES['onyx']!);
    },
    setTheme: (value) => {
      currentTheme = value;
      remount();
    },
    setModal: (open) => {
      modalOpen = open;
      remount();
    },
    setDrawer: (open) => {
      drawerOpen = open;
      remount();
    },
    toast: (tone) => {
      const theme = THEMES[currentTheme] ?? THEMES['onyx']!;
      const text = { ok: '操作成功 ✓', warn: '请注意 ⚠', danger: '出错了 ✕' }[tone ?? 'ok'] ?? '提示';
      // 挂进外层 root（跨画廊重挂存活·teardown 时随 root 一并清理）。
      showToast(root, text, { tone: tone as 'ok' | 'warn' | 'danger' | undefined, theme });
    },
    hurt: (n) => {
      world.hp.current = Math.max(0, world.hp.current - n);
      remount();
    },
    heal: (n) => {
      world.hp.current = Math.min(world.hp.max, world.hp.current + n);
      world.gold.current += n; // 顺带演示第二个绑定资源变化
      remount();
    },
    shopDispatch: (kind, arg) => {
      const theme = THEMES[currentTheme] ?? THEMES['onyx']!;
      const { state, toast } = applyShop(shop, kind, arg); // 纯 reducer 出新状态 + toast 意图
      shop = state;
      if (toast) showToast(root, toast.text, { tone: toast.tone, theme });
      remount(); // UI = 状态的纯函数 → 联动（过滤/详情/合计/禁用）一次重渲全部成立
    },
  });

  function remount(): void {
    const theme = THEMES[currentTheme] ?? THEMES['onyx']!;
    if (teardown) teardown();
    // 渲染前先用数据源把 bind 节点解析成字面值（活 HUD·resolveBindings 返回新树·纯函数）。
    const tree = resolveBindings(buildGallery(currentTheme, modalOpen, drawerOpen, shop), dataSource);
    teardown = mountUI(galleryHost, tree, handlers, theme);
    applyPaneTheme(theme);
    renderLog(theme);
  }

  remount();

  // ── 卡带 cleanup ─────────────────────────────────────────────
  return () => {
    if (teardown) teardown();
    root.remove();
  };
}
