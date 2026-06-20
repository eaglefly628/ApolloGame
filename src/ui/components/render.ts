// renderNode — LayoutNode 树 → HTML 字符串。纯函数，无副作用，可单测。
// 样式全部来自 SHELL 主题，不接受内联色值。

import { SHELL } from '../shell-theme.js';
import type {
  LayoutNode, LayoutConstraints,
  ButtonProps, LabelProps, DropdownProps, BadgeProps, InputProps, PanelProps,
  CheckboxProps, ToggleProps, RadioGroupProps, ImageProps, ScreenProps, SliderProps,
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

function renderButton(id: string, p: ButtonProps, ls: string): string {
  const kindStyle: Record<string, string> = {
    primary: `background:${SHELL.jadeWash};color:${SHELL.jade};border:1px solid ${SHELL.jadeLine};font-weight:600`,
    ghost:   `background:rgba(255,255,255,0.03);color:${SHELL.sub};border:1px solid ${SHELL.line}`,
    quiet:   `background:transparent;color:${SHELL.dim};border:1px solid transparent`,
  };
  const kind = p.kind ?? 'ghost';
  const base = `padding:6px 14px;border-radius:7px;font-size:12px;cursor:${p.disabled ? 'not-allowed' : 'pointer'};font-family:${SHELL.fontUi};outline:none;transition:all .15s;opacity:${p.disabled ? 0.4 : 1}`;
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  return `<button id="${esc(id)}"${action}${p.disabled ? ' disabled' : ''} style="${base};${kindStyle[kind]};${ls}">${esc(p.label)}</button>`;
}

function renderLabel(id: string, p: LabelProps, ls: string): string {
  const sizeMap: Record<string, number> = { xs: 10, sm: 11, md: 13, lg: 16, xl: 22 };
  const colorMap: Record<string, string> = {
    text: SHELL.text, sub: SHELL.sub, dim: SHELL.dim,
    jade: SHELL.jade, gold: SHELL.gold,
    ok: SHELL.ok, warn: SHELL.warn, danger: SHELL.danger,
  };
  const sz = sizeMap[p.size ?? 'md'] ?? 13;
  const cl = colorMap[p.color ?? 'text'] ?? SHELL.text;
  const style = [
    `font-size:${sz}px`, `color:${cl}`,
    p.bold ? 'font-weight:700' : '',
    p.mono ? `font-family:${SHELL.fontMono}` : `font-family:${SHELL.fontUi}`,
    ls,
  ].filter(Boolean).join(';');
  return `<span id="${esc(id)}" style="${style}">${esc(p.text)}</span>`;
}

function renderDropdown(id: string, p: DropdownProps, ls: string): string {
  const base = `background:${SHELL.bg2};color:${SHELL.sub};border:1px solid ${SHELL.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${SHELL.fontUi};cursor:pointer`;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const ph = p.placeholder
    ? `<option value="" disabled${!p.value ? ' selected' : ''}>${esc(p.placeholder)}</option>`
    : '';
  const opts = p.options
    .map(o => `<option value="${esc(o.value)}"${p.value === o.value ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
  return `<select id="${esc(id)}"${action} style="${base};${ls}">${ph}${opts}</select>`;
}

function renderBadge(id: string, p: BadgeProps, ls: string): string {
  const toneStyle: Record<string, string> = {
    ok:   `background:${SHELL.okWash};color:${SHELL.ok}`,
    warn: `background:${SHELL.warnWash};color:${SHELL.warn}`,
    dim:  `background:rgba(154,170,196,0.10);color:${SHELL.dim}`,
  };
  const style = `${toneStyle[p.tone ?? 'dim']};font-size:9px;padding:1px 7px;border-radius:8px;white-space:nowrap;font-family:${SHELL.fontUi};${ls}`;
  return `<span id="${esc(id)}" style="${style}">${esc(p.text)}</span>`;
}

function renderInput(id: string, p: InputProps, ls: string): string {
  const base = `background:rgba(0,0,0,0.35);color:${SHELL.text};border:1px solid ${SHELL.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${SHELL.fontUi}`;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  return `<input id="${esc(id)}" type="${p.type ?? 'text'}" value="${esc(p.value ?? '')}" placeholder="${esc(p.placeholder ?? '')}"${action} style="${base};${ls}">`;
}

function renderDivider(id: string, ls: string): string {
  return `<hr id="${esc(id)}" style="border:none;border-top:1px solid ${SHELL.line};margin:8px 0;${ls}">`;
}

function renderPanel(id: string, p: PanelProps, c: LayoutConstraints | undefined, children: LayoutNode[]): string {
  const dir = c?.direction ?? 'column';
  const gap = c?.gap ?? 8;
  const align = c?.align ?? 'stretch';
  const pad = c?.padding ?? 16;
  const ls = layoutStyle(c);
  const overflow = p.scroll ? 'overflow-y:auto;' : '';
  const style = `display:flex;flex-direction:${dir};gap:${gap}px;align-items:${align};padding:${pad}px;background:${SHELL.bg1};border:1px solid ${SHELL.line};border-radius:10px;position:relative;${overflow}${ls}`;
  const title = p.title
    ? `<div style="font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${SHELL.dim};font-family:${SHELL.fontUi};margin-bottom:4px">${esc(p.title)}</div>`
    : '';
  const inner = children.map(renderNode).join('');
  return `<div id="${esc(id)}" style="${style}">${title}${inner}</div>`;
}

// ── 新增 6 个控件 ───────────────────────────────────────────────

// hidden input 辅助：opacity:0 + 零尺寸，<label for> 触发它；change 事件冒泡给 dispatch。
const hiddenInput = (id: string, type: string, action: string, extra = ''): string =>
  `<input type="${type}" id="${esc(id)}"${action ? ` data-action="${esc(action)}"` : ''} ${extra} style="opacity:0;width:0;height:0;position:absolute">`;

function renderCheckbox(id: string, p: CheckboxProps, ls: string): string {
  const checked = p.checked ?? false;
  const boxBg     = checked ? SHELL.jadeWash : 'rgba(0,0,0,0.25)';
  const boxBorder = checked ? SHELL.jadeLine  : SHELL.line;
  const mark      = checked ? `<span style="color:${SHELL.jade};font-size:10px;line-height:1;font-weight:700">✓</span>` : '';
  return `<span id="${esc(id)}" style="display:inline-flex;align-items:center;${ls}">
  ${hiddenInput(`${id}-i`, 'checkbox', p.action ?? '', checked ? 'checked' : '')}
  <label for="${esc(id)}-i" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid ${boxBorder};border-radius:3px;background:${boxBg};flex-shrink:0">${mark}</span>
    <span style="font-size:12px;color:${SHELL.sub};font-family:${SHELL.fontUi}">${esc(p.label)}</span>
  </label>
</span>`;
}

function renderToggle(id: string, p: ToggleProps, ls: string): string {
  const on = p.checked ?? false;
  const trackBg = on ? SHELL.jade        : SHELL.bg3;
  const border   = on ? SHELL.jadeLine   : SHELL.line;
  const knob     = on ? SHELL.bg0        : SHELL.dim;
  const knobLeft = on ? '18px'           : '2px';
  return `<span id="${esc(id)}" style="display:inline-flex;align-items:center;${ls}">
  ${hiddenInput(`${id}-i`, 'checkbox', p.action ?? '', on ? 'checked' : '')}
  <label for="${esc(id)}-i" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer">
    <span style="display:inline-block;width:36px;height:20px;border-radius:10px;background:${trackBg};border:1px solid ${border};position:relative;flex-shrink:0">
      <span style="width:14px;height:14px;border-radius:50%;background:${knob};position:absolute;top:2px;left:${knobLeft}"></span>
    </span>
    <span style="font-size:12px;color:${SHELL.sub};font-family:${SHELL.fontUi}">${esc(p.label)}</span>
  </label>
</span>`;
}

function renderRadioGroup(id: string, p: RadioGroupProps, ls: string): string {
  const items = p.options.map((opt, i) => {
    const rid = `${id}-r${i}`;
    const sel = p.value === opt.value;
    const dot    = sel ? `<span style="width:7px;height:7px;border-radius:50%;background:${SHELL.jade}"></span>` : '';
    const border = sel ? SHELL.jade : SHELL.line;
    return `<span style="display:inline-flex;align-items:center">
    ${hiddenInput(rid, 'radio', p.action ?? '', `name="${esc(p.name)}" value="${esc(opt.value)}"${sel ? ' checked' : ''}`)}
    <label for="${esc(rid)}" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
      <span style="width:14px;height:14px;border-radius:50%;border:1.5px solid ${border};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${dot}</span>
      <span style="font-size:12px;color:${SHELL.sub};font-family:${SHELL.fontUi}">${esc(opt.label)}</span>
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

function renderScreen(id: string, p: ScreenProps, children: LayoutNode[]): string {
  const bg     = p.bg ?? SHELL.pageBg;
  const center = p.center ? 'align-items:center;justify-content:center;' : 'align-items:stretch;';
  const bgImg  = p.image ? `background-image:url('${esc(p.image)}');background-size:cover;background-position:center;` : '';
  const blur   = p.blur ? `backdrop-filter:blur(${p.blur}px);` : '';
  const style  = `width:100%;min-height:100vh;display:flex;flex-direction:column;${center}background:${bg};${bgImg}${blur}font-family:${SHELL.fontUi};position:relative;`;
  return `<div id="${esc(id)}" style="${style}">${children.map(renderNode).join('')}</div>`;
}

function renderSlider(id: string, p: SliderProps, ls: string): string {
  const min   = p.min   ?? 0;
  const max   = p.max   ?? 100;
  const step  = p.step  ?? 1;
  const value = p.value ?? Math.round((min + max) / 2);
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const header = p.label
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:${SHELL.sub};font-family:${SHELL.fontUi}">${esc(p.label)}</span>
        <span style="font-size:11px;color:${SHELL.dim};font-family:${SHELL.fontMono}">${value}</span>
      </div>`
    : '';
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;${ls}">
  ${header}<input type="range" min="${min}" max="${max}" step="${step}" value="${value}"${action} style="width:100%;accent-color:${SHELL.jade};cursor:pointer">
</div>`;
}

// ── 统一入口 ────────────────────────────────────────────────────

/** 将 LayoutNode 树渲染为 HTML 字符串。弱模型提供数据，此函数是解释器。 */
export function renderNode(node: LayoutNode): string {
  const ls = layoutStyle(node.layout);
  switch (node.type) {
    case 'Button':     return renderButton(node.id, node.props as ButtonProps, ls);
    case 'Label':      return renderLabel(node.id, node.props as LabelProps, ls);
    case 'Dropdown':   return renderDropdown(node.id, node.props as DropdownProps, ls);
    case 'Badge':      return renderBadge(node.id, node.props as BadgeProps, ls);
    case 'Input':      return renderInput(node.id, node.props as InputProps, ls);
    case 'Divider':    return renderDivider(node.id, ls);
    case 'Panel':      return renderPanel(node.id, node.props as PanelProps, node.layout, node.children ?? []);
    case 'Checkbox':   return renderCheckbox(node.id, node.props as CheckboxProps, ls);
    case 'Toggle':     return renderToggle(node.id, node.props as ToggleProps, ls);
    case 'RadioGroup': return renderRadioGroup(node.id, node.props as RadioGroupProps, ls);
    case 'Image':      return renderImage(node.id, node.props as ImageProps, ls);
    case 'Screen':     return renderScreen(node.id, node.props as ScreenProps, node.children ?? []);
    case 'Slider':     return renderSlider(node.id, node.props as SliderProps, ls);
    default:           return `<!-- unknown: ${String((node as LayoutNode).type)} -->`;
  }
}
