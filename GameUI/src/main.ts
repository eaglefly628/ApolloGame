// GameUI — 宿主入口（工程师胶水层）。
//
// 职责：拿 #app 容器 → 摆「画廊 + 事件日志」两栏 → 用引擎 mountUI 解释画廊数据。
// 换皮 = 换一份 UITheme 令牌包后重挂同一棵 LayoutNode（数据一字不改）。
//
// 注意：画廊本体（gallery.ts）是 100% 数据；事件日志面板与换皮重挂属于宿主运行时，
// 不是游戏数据——这正是契约里「工程师写 mountUI/host 层」该待的地方。

import { mountUI } from '@ui/components/index.js';
import type { UITheme } from '@ui/components/index.js';
import { buildGallery } from './gallery.js';
import { buildHandlers } from './handlers.js';
import { THEMES } from './themes.js';

const app = document.getElementById('app');
if (!app) throw new Error('GameUI: #app not found');

// ── 两栏骨架：左画廊（弹性）+ 右事件日志（固定宽）──────────────
app.style.display = 'flex';
app.style.minHeight = '100vh';

const galleryHost = document.createElement('div');
galleryHost.style.flex = '1';
galleryHost.style.minWidth = '0';

const logPane = document.createElement('aside');
logPane.style.width = '320px';
logPane.style.flexShrink = '0';
logPane.style.padding = '16px';
logPane.style.overflowY = 'auto';
logPane.style.maxHeight = '100vh';

const logTitle = document.createElement('div');
logTitle.textContent = '事件日志 · EVENT LOG';
logTitle.style.fontSize = '10px';
logTitle.style.letterSpacing = '2.4px';
logTitle.style.marginBottom = '10px';

const logBody = document.createElement('div');
logBody.style.display = 'flex';
logBody.style.flexDirection = 'column';
logBody.style.gap = '4px';
logBody.style.fontSize = '12px';

logPane.append(logTitle, logBody);
app.append(galleryHost, logPane);

// ── 事件日志状态 ─────────────────────────────────────────────
interface LogLine { action: string; arg?: string; t: string }
const lines: LogLine[] = [];

function now(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function applyPaneTheme(theme: UITheme): void {
  logPane.style.background = theme.bg2;
  logPane.style.borderLeft = `1px solid ${theme.line}`;
  logPane.style.fontFamily = theme.fontMono;
  logTitle.style.color = theme.dim;
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
    const arg = ln.arg !== undefined ? ` <span style="color:${theme.text}">${escapeHtml(ln.arg)}</span>` : '';
    row.innerHTML = `${time} ${name}${arg}`;
    logBody.append(row);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 挂载 / 换皮重挂 ──────────────────────────────────────────
let currentTheme = 'onyx';
let teardown: (() => void) | null = null;

function mount(): void {
  const theme = THEMES[currentTheme] ?? THEMES['onyx']!;
  if (teardown) teardown();
  teardown = mountUI(galleryHost, buildGallery(currentTheme), handlers, theme);
  applyPaneTheme(theme);
  renderLog(theme);
}

const handlers = buildHandlers({
  log: (action, arg) => {
    lines.push({ action, arg, t: now() });
    renderLog(THEMES[currentTheme] ?? THEMES['onyx']!);
  },
  setTheme: (value) => {
    currentTheme = value;
    mount();
  },
});

mount();
