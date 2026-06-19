// renderNode — LayoutNode 树 → HTML 字符串。纯函数，无副作用，可单测。
// 样式全部来自 SHELL 主题，不接受内联色值。

import { SHELL } from '../shell-theme.js';
import type {
  LayoutNode, LayoutConstraints,
  ButtonProps, LabelProps, DropdownProps, BadgeProps, InputProps, PanelProps,
} from './types.js';

const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layoutStyle(c?: LayoutConstraints): string {
  if (!c) return '';
  const p: string[] = [];
  if (c.x !== undefined) { p.push(`left:${c.x}px`); p.push(`top:${c.y ?? 0}px`); p.push('position:absolute'); }
  else if (c.y !== undefined) { p.push(`top:${c.y}px`); p.push('position:absolute'); }
  if (c.width  !== undefined) p.push(`width:${c.width}px`);
  if (c.height !== undefined) p.push(`height:${c.height}px`);
  if (c.flex   !== undefined) p.push(`flex:${c.flex}`);
  if (c.padding !== undefined) p.push(`padding:${c.padding}px`);
  if (c.margin  !== undefined) p.push(`margin:${c.margin}px`);
  return p.join(';');
}

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
  const rel = 'position:relative;';  // 让绝对定位子项有锚点
  const style = `display:flex;flex-direction:${dir};gap:${gap}px;align-items:${align};padding:${pad}px;background:${SHELL.bg1};border:1px solid ${SHELL.line};border-radius:10px;${overflow}${rel}${ls}`;
  const title = p.title
    ? `<div style="font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${SHELL.dim};font-family:${SHELL.fontUi};margin-bottom:4px">${esc(p.title)}</div>`
    : '';
  const inner = children.map(renderNode).join('');
  return `<div id="${esc(id)}" style="${style}">${title}${inner}</div>`;
}

/** 将 LayoutNode 树渲染为 HTML 字符串。弱模型提供数据，此函数是解释器。 */
export function renderNode(node: LayoutNode): string {
  const ls = layoutStyle(node.layout);
  switch (node.type) {
    case 'Button':   return renderButton(node.id, node.props as ButtonProps, ls);
    case 'Label':    return renderLabel(node.id, node.props as LabelProps, ls);
    case 'Dropdown': return renderDropdown(node.id, node.props as DropdownProps, ls);
    case 'Badge':    return renderBadge(node.id, node.props as BadgeProps, ls);
    case 'Input':    return renderInput(node.id, node.props as InputProps, ls);
    case 'Divider':  return renderDivider(node.id, ls);
    case 'Panel':    return renderPanel(node.id, node.props as PanelProps, node.layout, node.children ?? []);
    default:         return `<!-- unknown: ${String((node as LayoutNode).type)} -->`;
  }
}
