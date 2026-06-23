// renderNode — LayoutNode 树 → HTML 字符串。纯函数，无副作用，可单测。
// 样式来自传入的 UITheme（缺省 = 引擎 SHELL 脸）。游戏传自己那份主题即「换皮」，不接受内联色值。

import { SHELL } from '../shell-theme.js';
import type {
  LayoutNode, LayoutConstraints, UITheme,
  ButtonProps, LabelProps, DropdownProps, BadgeProps, InputProps, PanelProps,
  CheckboxProps, ToggleProps, RadioGroupProps, ImageProps, ScreenProps, SliderProps,
  TableProps, TableColumn, TabsProps, ProgressBarProps, TagProps, ModalProps, ToastProps, TooltipProps,
} from './types.js';

const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layoutStyle(c?: LayoutConstraints): string {
  if (!c) return '';
  const p: string[] = [];
  if (c.x !== undefined) { p.push(`left:${c.x}px`); p.push(`top:${c.y ?? 0}px`); p.push('position:absolute'); }
  else if (c.y !== undefined) { p.push(`top:${c.y}px`); p.push('position:absolute'); }
  if (c.width   !== undefined) p.push(`width:${c.width}px`);
  if (c.height  !== undefined) p.push(`height:${c.height}px`);
  if (c.flex    !== undefined) p.push(`flex:${c.flex}`);
  if (c.padding !== undefined) p.push(`padding:${c.padding}px`);
  if (c.margin  !== undefined) p.push(`margin:${c.margin}px`);
  return p.join(';');
}

// ── 原有 7 个控件 ───────────────────────────────────────────────

function renderButton(id: string, p: ButtonProps, ls: string, t: UITheme): string {
  const kindStyle: Record<string, string> = {
    primary: `background:${t.jadeWash};color:${t.jade};border:1px solid ${t.jadeLine};font-weight:600`,
    ghost:   `background:rgba(255,255,255,0.03);color:${t.sub};border:1px solid ${t.line}`,
    quiet:   `background:transparent;color:${t.dim};border:1px solid transparent`,
  };
  const kind = p.kind ?? 'ghost';
  const base = `padding:6px 14px;border-radius:7px;font-size:12px;cursor:${p.disabled ? 'not-allowed' : 'pointer'};font-family:${t.fontUi};outline:none;transition:all .15s;opacity:${p.disabled ? 0.4 : 1}`;
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  return `<button id="${esc(id)}"${action}${p.disabled ? ' disabled' : ''} style="${base};${kindStyle[kind]};${ls}">${esc(p.label)}</button>`;
}

function renderLabel(id: string, p: LabelProps, ls: string, t: UITheme): string {
  const sizeMap: Record<string, number> = { xs: 10, sm: 11, md: 13, lg: 16, xl: 22 };
  const colorMap: Record<string, string> = {
    text: t.text, sub: t.sub, dim: t.dim,
    jade: t.jade, gold: t.gold,
    ok: t.ok, warn: t.warn, danger: t.danger,
  };
  const sz = sizeMap[p.size ?? 'md'] ?? 13;
  const cl = colorMap[p.color ?? 'text'] ?? t.text;
  const style = [
    `font-size:${sz}px`, `color:${cl}`,
    p.bold ? 'font-weight:700' : '',
    p.mono ? `font-family:${t.fontMono}` : `font-family:${t.fontUi}`,
    ls,
  ].filter(Boolean).join(';');
  return `<span id="${esc(id)}" style="${style}">${esc(p.text)}</span>`;
}

function renderDropdown(id: string, p: DropdownProps, ls: string, t: UITheme): string {
  const base = `background:${t.bg2};color:${t.sub};border:1px solid ${t.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${t.fontUi};cursor:pointer`;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const ph = p.placeholder
    ? `<option value="" disabled${!p.value ? ' selected' : ''}>${esc(p.placeholder)}</option>`
    : '';
  const opts = p.options
    .map(o => `<option value="${esc(o.value)}"${p.value === o.value ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
  return `<select id="${esc(id)}"${action} style="${base};${ls}">${ph}${opts}</select>`;
}

function renderBadge(id: string, p: BadgeProps, ls: string, t: UITheme): string {
  const toneStyle: Record<string, string> = {
    ok:   `background:${t.okWash};color:${t.ok}`,
    warn: `background:${t.warnWash};color:${t.warn}`,
    dim:  `background:rgba(154,170,196,0.10);color:${t.dim}`,
  };
  const style = `${toneStyle[p.tone ?? 'dim']};font-size:9px;padding:1px 7px;border-radius:8px;white-space:nowrap;font-family:${t.fontUi};${ls}`;
  return `<span id="${esc(id)}" style="${style}">${esc(p.text)}</span>`;
}

function renderInput(id: string, p: InputProps, ls: string, t: UITheme): string {
  const base = `background:rgba(0,0,0,0.35);color:${t.text};border:1px solid ${t.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${t.fontUi}`;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  return `<input id="${esc(id)}" type="${p.type ?? 'text'}" value="${esc(p.value ?? '')}" placeholder="${esc(p.placeholder ?? '')}"${action} style="${base};${ls}">`;
}

function renderDivider(id: string, ls: string, t: UITheme): string {
  return `<hr id="${esc(id)}" style="border:none;border-top:1px solid ${t.line};margin:8px 0;${ls}">`;
}

function renderPanel(id: string, p: PanelProps, c: LayoutConstraints | undefined, children: LayoutNode[], t: UITheme): string {
  const dir = c?.direction ?? 'column';
  const gap = c?.gap ?? 8;
  const align = c?.align ?? 'stretch';
  const pad = c?.padding ?? 16;
  const ls = layoutStyle(c);
  const overflow = p.scroll ? 'overflow-y:auto;' : '';
  // grid 排布模式（卡牌格/货架）：auto-fill 自适应列数（minCol 定最小列宽）；非 grid 走原 flex 行/列。
  const box = dir === 'grid'
    ? `display:grid;grid-template-columns:repeat(auto-fill,minmax(${c?.minCol ?? 96}px,1fr));gap:${gap}px;align-items:${align}`
    : `display:flex;flex-direction:${dir};gap:${gap}px;align-items:${align}`;
  const style = `${box};padding:${pad}px;background:${t.bg1};border:1px solid ${t.line};border-radius:10px;position:relative;${overflow}${ls}`;
  const title = p.title
    ? `<div style="font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${t.dim};font-family:${t.fontUi};margin-bottom:4px${dir === 'grid' ? ';grid-column:1/-1' : ''}">${esc(p.title)}</div>`
    : '';
  const inner = children.map((ch) => renderNode(ch, t)).join('');
  return `<div id="${esc(id)}" style="${style}">${title}${inner}</div>`;
}

// ── 新增 6 个控件 ───────────────────────────────────────────────

// hidden input 辅助：opacity:0 + 零尺寸，<label for> 触发它；change 事件冒泡给 dispatch。
const hiddenInput = (id: string, type: string, action: string, extra = ''): string =>
  `<input type="${type}" id="${esc(id)}"${action ? ` data-action="${esc(action)}"` : ''} ${extra} style="opacity:0;width:0;height:0;position:absolute">`;

function renderCheckbox(id: string, p: CheckboxProps, ls: string, t: UITheme): string {
  const checked = p.checked ?? false;
  const boxBg     = checked ? t.jadeWash : 'rgba(0,0,0,0.25)';
  const boxBorder = checked ? t.jadeLine  : t.line;
  const mark      = checked ? `<span style="color:${t.jade};font-size:10px;line-height:1;font-weight:700">✓</span>` : '';
  return `<span id="${esc(id)}" style="display:inline-flex;align-items:center;${ls}">
  ${hiddenInput(`${id}-i`, 'checkbox', p.action ?? '', checked ? 'checked' : '')}
  <label for="${esc(id)}-i" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid ${boxBorder};border-radius:3px;background:${boxBg};flex-shrink:0">${mark}</span>
    <span style="font-size:12px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>
  </label>
</span>`;
}

function renderToggle(id: string, p: ToggleProps, ls: string, t: UITheme): string {
  const on = p.checked ?? false;
  const trackBg = on ? t.jade        : t.bg3;
  const border   = on ? t.jadeLine   : t.line;
  const knob     = on ? t.bg0        : t.dim;
  const knobLeft = on ? '18px'           : '2px';
  return `<span id="${esc(id)}" style="display:inline-flex;align-items:center;${ls}">
  ${hiddenInput(`${id}-i`, 'checkbox', p.action ?? '', on ? 'checked' : '')}
  <label for="${esc(id)}-i" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer">
    <span style="display:inline-block;width:36px;height:20px;border-radius:10px;background:${trackBg};border:1px solid ${border};position:relative;flex-shrink:0">
      <span style="width:14px;height:14px;border-radius:50%;background:${knob};position:absolute;top:2px;left:${knobLeft}"></span>
    </span>
    <span style="font-size:12px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>
  </label>
</span>`;
}

function renderRadioGroup(id: string, p: RadioGroupProps, ls: string, t: UITheme): string {
  const items = p.options.map((opt, i) => {
    const rid = `${id}-r${i}`;
    const sel = p.value === opt.value;
    const dot    = sel ? `<span style="width:7px;height:7px;border-radius:50%;background:${t.jade}"></span>` : '';
    const border = sel ? t.jade : t.line;
    return `<span style="display:inline-flex;align-items:center">
    ${hiddenInput(rid, 'radio', p.action ?? '', `name="${esc(p.name)}" value="${esc(opt.value)}"${sel ? ' checked' : ''}`)}
    <label for="${esc(rid)}" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
      <span style="width:14px;height:14px;border-radius:50%;border:1.5px solid ${border};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${dot}</span>
      <span style="font-size:12px;color:${t.sub};font-family:${t.fontUi}">${esc(opt.label)}</span>
    </label>
  </span>`;
  }).join('');
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;gap:8px;${ls}">${items}</div>`;
}

function renderImage(id: string, p: ImageProps, ls: string): string {
  const fit    = p.fit ?? 'contain';
  const radius = p.radius ?? 0;
  return `<img id="${esc(id)}" src="${esc(p.src)}" alt="${esc(p.alt ?? '')}" style="object-fit:${fit};border-radius:${radius}px;display:block;max-width:100%;${ls}">`;
}

function renderScreen(id: string, p: ScreenProps, children: LayoutNode[], t: UITheme): string {
  const bg     = p.bg ?? t.pageBg;
  const center = p.center ? 'align-items:center;justify-content:center;' : 'align-items:stretch;';
  const bgImg  = p.image ? `background-image:url('${esc(p.image)}');background-size:cover;background-position:center;` : '';
  const blur   = p.blur ? `backdrop-filter:blur(${p.blur}px);` : '';
  const style  = `width:100%;min-height:100vh;display:flex;flex-direction:column;${center}background:${bg};${bgImg}${blur}font-family:${t.fontUi};position:relative;`;
  return `<div id="${esc(id)}" style="${style}">${children.map((ch) => renderNode(ch, t)).join('')}</div>`;
}

function renderSlider(id: string, p: SliderProps, ls: string, t: UITheme): string {
  const min   = p.min   ?? 0;
  const max   = p.max   ?? 100;
  const step  = p.step  ?? 1;
  const value = p.value ?? Math.round((min + max) / 2);
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const header = p.label
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>
        <span style="font-size:11px;color:${t.dim};font-family:${t.fontMono}">${value}</span>
      </div>`
    : '';
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;${ls}">
  ${header}<input type="range" min="${min}" max="${max}" step="${step}" value="${value}"${action} style="width:100%;accent-color:${t.jade};cursor:pointer">
</div>`;
}

// ── Table / Tabs（以 game-g 大厅榜单/数值表 + 抗闪屏切页为出发点·下沉成引擎组件）────────

const colFlex = (c: TableColumn): string => (c.width !== undefined ? `flex:0 0 ${c.width}px` : 'flex:1');

// 数据表：列定义 + 行数据 → 表头(淡色阔字距) + 行(发丝线分隔·可点·tone 着色)。游戏只填 columns/rows。
function renderTable(id: string, p: TableProps, ls: string, t: UITheme): string {
  const title = p.title
    ? `<div style="font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${t.dim};font-family:${t.fontUi};margin-bottom:8px">${esc(p.title)}</div>`
    : '';
  const head = `<div style="display:flex;gap:10px;padding:0 4px 6px;border-bottom:1px solid ${t.line}">${p.columns.map((c) => `<span style="${colFlex(c)};text-align:${c.align ?? 'left'};font-size:9px;letter-spacing:1.6px;text-transform:uppercase;color:${t.dim};font-family:${t.fontUi}">${esc(c.label)}</span>`).join('')}</div>`;
  const toneColor: Record<string, string> = { normal: t.text, accent: t.gold, dim: t.dim };
  const body = p.rows.length
    ? p.rows.map((r) => {
        const act = r.action ? ` data-action="${esc(r.action)}" data-arg="${esc(r.id)}"` : '';
        const cur = r.action ? 'cursor:pointer;' : '';
        const cells = p.columns.map((c) => `<span style="${colFlex(c)};text-align:${c.align ?? 'left'};font-size:12px;color:${toneColor[r.tone ?? 'normal'] ?? t.text};font-family:${t.fontUi};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.cells[c.key] ?? '')}</span>`).join('');
        return `<div${act} style="display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid ${t.line};${cur}">${cells}</div>`;
      }).join('')
    : `<div style="padding:18px 4px;text-align:center;font-size:12px;color:${t.dim};font-family:${t.fontUi}">${esc(p.empty ?? '—')}</div>`;
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;background:${t.bg1};border:1px solid ${t.line};border-radius:10px;padding:12px 14px;${ls}">${title}${head}${body}</div>`;
}

// 多页(Table Pages)：nav 标签栏 + 各页全渲染(仅 active 显示)。切页由 mountUI 就地 toggle display(不重建·抗闪屏)。
// children 顺序对齐 tabs；data-tab/data-tabpage/data-tabs 是 mountUI 切页的锚点。
function renderTabs(id: string, p: TabsProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const active = p.active ?? p.tabs[0]?.id ?? '';
  const navBtn = (tb: { id: string; label: string }): string => {
    const on = tb.id === active;
    const act = p.action ? ` data-action="${esc(p.action)}" data-arg="${esc(tb.id)}"` : '';
    const style = `padding:7px 14px;font-size:12px;cursor:pointer;background:none;outline:none;font-family:${t.fontUi};border:none;border-bottom:2px solid ${on ? t.gold : 'transparent'};color:${on ? t.gold : t.sub};transition:all .15s`;
    return `<button data-tab="${esc(tb.id)}"${act} style="${style}">${esc(tb.label)}</button>`;
  };
  const nav = `<div style="display:flex;gap:4px;border-bottom:1px solid ${t.line};flex-wrap:wrap">${p.tabs.map(navBtn).join('')}</div>`;
  const pages = p.tabs.map((tb, i) => {
    const content = children[i] ? renderNode(children[i], t) : '';
    return `<div data-tabpage="${esc(tb.id)}" style="display:${tb.id === active ? 'block' : 'none'}">${content}</div>`;
  }).join('');
  return `<div id="${esc(id)}" data-tabs="${esc(id)}" style="display:flex;flex-direction:column;gap:12px;${ls}">${nav}${pages}</div>`;
}

// ── ProgressBar / Tag（纯展示比例条 + 可点标签·下沉自游戏 HUD/筛选条）──────────

// 比例条：value/max → 填充宽度%（钳 0..100）；tone 映射主题令牌；可选标签 + 右上数值。纯展示·无事件。
function renderProgressBar(id: string, p: ProgressBarProps, ls: string, t: UITheme): string {
  const max = p.max ?? 1;
  const pct = Math.max(0, Math.min(100, max > 0 ? (p.value / max) * 100 : 0));
  const fillColor: Record<string, string> = { accent: t.jade, gold: t.gold, ok: t.ok, warn: t.warn, danger: t.danger };
  const fill = fillColor[p.tone ?? 'accent'] ?? t.jade;
  const valTxt = max === 1 ? `${Math.round(pct)}%` : `${p.value}/${max}`;
  const header = (p.label || p.showValue)
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">${p.label ? `<span style="font-size:11px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>` : '<span></span>'}${p.showValue ? `<span style="font-size:11px;color:${t.dim};font-family:${t.fontMono}">${esc(valTxt)}</span>` : ''}</div>`
    : '';
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;${ls}">${header}<div style="height:8px;border-radius:5px;background:${t.bg3};overflow:hidden"><div style="width:${pct}%;height:100%;background:${fill};border-radius:5px;transition:width .2s"></div></div></div>`;
}

// 可点标签：active 或 tone 决定底/字/线色；有 action 则整体可点(arg=actionArg)；removable 加 ×。
function renderTag(id: string, p: TagProps, ls: string, t: UITheme): string {
  const on = p.active ?? false;
  const toneBg: Record<string, string> = { normal: 'rgba(255,255,255,0.04)', accent: t.jadeWash, dim: 'transparent' };
  const toneFg: Record<string, string> = { normal: t.sub, accent: t.jade, dim: t.dim };
  const bg = on ? t.jadeWash : (toneBg[p.tone ?? 'normal'] ?? 'rgba(255,255,255,0.04)');
  const fg = on ? t.jade : (toneFg[p.tone ?? 'normal'] ?? t.sub);
  const border = on ? t.jadeLine : t.line;
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  const cursor = p.action ? 'cursor:pointer;' : '';
  const x = p.removable ? '<span style="margin-left:6px;opacity:.7">×</span>' : '';
  return `<span id="${esc(id)}"${action} style="display:inline-flex;align-items:center;padding:3px 10px;font-size:11px;border-radius:12px;background:${bg};color:${fg};border:1px solid ${border};font-family:${t.fontUi};white-space:nowrap;${cursor}${ls}">${esc(p.label)}${x}</span>`;
}

// 飘字提示药丸：tone 着色（语义令牌）。挂载器 showToast() 复用它做定时自消浮层。
function renderToast(id: string, p: ToastProps, ls: string, t: UITheme): string {
  const toneMap: Record<string, [string, string, string]> = {
    ok:     [t.okWash, t.ok, t.ok],
    warn:   [t.warnWash, t.warn, t.warn],
    danger: ['rgba(211,137,122,0.16)', t.danger, t.danger],
    accent: [t.jadeWash, t.jade, t.jadeLine],
    dim:    ['rgba(255,255,255,0.06)', t.sub, t.line],
  };
  const [bg, fg, bd] = toneMap[p.tone ?? 'dim'] ?? toneMap['dim'] as [string, string, string];
  return `<div id="${esc(id)}" style="display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:9px;background:${bg};color:${fg};border:1px solid ${bd};font-size:12px;font-family:${t.fontUi};box-shadow:0 6px 20px rgba(0,0,0,0.3);${ls}">${esc(p.text)}</div>`;
}

// 悬浮提示：包裹 children 作触发元素 + 一颗隐藏气泡(按 placement 定位)。显隐由 mountUI hover 内建。
function renderTooltip(id: string, p: TooltipProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const inner = children.map((ch) => renderNode(ch, t)).join('');
  const posMap: Record<string, string> = {
    top:    'bottom:calc(100% + 6px);left:50%;transform:translateX(-50%)',
    bottom: 'top:calc(100% + 6px);left:50%;transform:translateX(-50%)',
    left:   'right:calc(100% + 6px);top:50%;transform:translateY(-50%)',
    right:  'left:calc(100% + 6px);top:50%;transform:translateY(-50%)',
  };
  const pos = posMap[p.placement ?? 'top'] ?? posMap['top'];
  const bubble = `<span data-tooltip-bubble style="display:none;position:absolute;${pos};z-index:250;padding:5px 9px;border-radius:6px;background:${t.bg3};color:${t.text};border:1px solid ${t.line};font-size:11px;font-family:${t.fontUi};white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,0.4);pointer-events:none">${esc(p.content)}</span>`;
  return `<span id="${esc(id)}" data-tooltip tabindex="0" style="position:relative;display:inline-flex;${ls}">${inner}${bubble}</span>`;
}

// ── Modal（居中模态浮层 + 遮罩·下沉自各游戏手搭确认框/详情弹窗）─────────────────

// 遮罩满屏居中弹窗体；点 ×(data-action) 或点遮罩本身(data-modal-close·mountUI 内建) → closeAction。
function renderModal(id: string, p: ModalProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const widthMap: Record<string, number> = { sm: 320, md: 460, lg: 640 };
  const w = widthMap[p.size ?? 'md'] ?? 460;
  const closable = p.closable ?? true;
  const scrimClose = p.closeAction ? ` data-modal-close="${esc(p.closeAction)}"` : '';
  const xBtn = (closable && p.closeAction)
    ? `<button data-action="${esc(p.closeAction)}" aria-label="close" style="position:absolute;top:10px;right:13px;width:26px;height:26px;background:none;border:none;color:${t.dim};font-size:19px;line-height:1;cursor:pointer;font-family:${t.fontUi}">×</button>`
    : '';
  const title = p.title
    ? `<div style="font-size:15px;font-weight:700;color:${t.text};font-family:${t.fontUi};margin-bottom:12px;padding-right:26px">${esc(p.title)}</div>`
    : '';
  const body = children.map((ch) => renderNode(ch, t)).join('');
  return `<div id="${esc(id)}"${scrimClose} style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0.62);${ls}"><div style="position:relative;width:${w}px;max-width:100%;max-height:88vh;overflow-y:auto;background:${t.bg1};border:1px solid ${t.line};border-radius:12px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,0.55)">${xBtn}${title}${body}</div></div>`;
}

// ── 统一入口 ────────────────────────────────────────────────────

/** 将 LayoutNode 树渲染为 HTML 字符串。弱模型提供数据 + 可选主题；此函数是解释器。缺省主题 = 引擎 SHELL 脸。 */
export function renderNode(node: LayoutNode, theme: UITheme = SHELL): string {
  const t = theme;
  const ls = layoutStyle(node.layout);
  switch (node.type) {
    case 'Button':     return renderButton(node.id, node.props as ButtonProps, ls, t);
    case 'Label':      return renderLabel(node.id, node.props as LabelProps, ls, t);
    case 'Dropdown':   return renderDropdown(node.id, node.props as DropdownProps, ls, t);
    case 'Badge':      return renderBadge(node.id, node.props as BadgeProps, ls, t);
    case 'Input':      return renderInput(node.id, node.props as InputProps, ls, t);
    case 'Divider':    return renderDivider(node.id, ls, t);
    case 'Panel':      return renderPanel(node.id, node.props as PanelProps, node.layout, node.children ?? [], t);
    case 'Checkbox':   return renderCheckbox(node.id, node.props as CheckboxProps, ls, t);
    case 'Toggle':     return renderToggle(node.id, node.props as ToggleProps, ls, t);
    case 'RadioGroup': return renderRadioGroup(node.id, node.props as RadioGroupProps, ls, t);
    case 'Image':      return renderImage(node.id, node.props as ImageProps, ls);
    case 'Screen':     return renderScreen(node.id, node.props as ScreenProps, node.children ?? [], t);
    case 'Slider':     return renderSlider(node.id, node.props as SliderProps, ls, t);
    case 'Table':      return renderTable(node.id, node.props as TableProps, ls, t);
    case 'Tabs':       return renderTabs(node.id, node.props as TabsProps, node.children ?? [], ls, t);
    case 'ProgressBar':return renderProgressBar(node.id, node.props as ProgressBarProps, ls, t);
    case 'Tag':        return renderTag(node.id, node.props as TagProps, ls, t);
    case 'Modal':      return renderModal(node.id, node.props as ModalProps, node.children ?? [], ls, t);
    case 'Toast':      return renderToast(node.id, node.props as ToastProps, ls, t);
    case 'Tooltip':    return renderTooltip(node.id, node.props as TooltipProps, node.children ?? [], ls, t);
    default:           return `<!-- unknown: ${String((node as LayoutNode).type)} -->`;
  }
}
