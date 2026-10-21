// Canvas Slot 的 DOM 适配层。局部逻辑尺寸计算，不拿缩放后的截图坐标当布局输入。
import type { LayoutNode } from './types.js';
import { solveParentAnchor } from './parent-anchor.js';
import type { AnchorRect } from './parent-anchor.js';

/** 保留子像素逻辑尺寸；clientWidth 的逐层取整会让深层锚点漂移。 */
export function parentAnchorBox(element: HTMLElement): { w: number; h: number } {
  const s = element.ownerDocument.defaultView?.getComputedStyle(element);
  const axis = (dimension: string | undefined, client: number, outer: number, paddingStart: string | undefined, paddingEnd: string | undefined, borderStart: string | undefined, borderEnd: string | undefined): number => {
    const value = Number.parseFloat(dimension ?? '');
    if (!Number.isFinite(value)) return client;
    const px = (v?: string): number => Number.parseFloat(v ?? '') || 0;
    const border = px(borderStart) + px(borderEnd);
    const scrollbar = Math.max(0, Math.round(outer - client - border));
    return (s?.boxSizing === 'border-box' ? value - border : value + px(paddingStart) + px(paddingEnd)) - scrollbar;
  };
  return { w: axis(s?.width, element.clientWidth, element.offsetWidth, s?.paddingLeft, s?.paddingRight, s?.borderLeftWidth, s?.borderRightWidth), h: axis(s?.height, element.clientHeight, element.offsetHeight, s?.paddingTop, s?.paddingBottom, s?.borderTopWidth, s?.borderBottomWidth) };
}

export function mountParentAnchors(host: HTMLElement, getRoot: () => LayoutNode): { sync(): void; dispose(): void } {
  const win = host.ownerDocument.defaultView;
  let disposed = false;
  let entries: { node: LayoutNode; element: HTMLElement; parent: HTMLElement }[] = [];
  const lastValid = new Map<string, AnchorRect>();
  const frozenStyles = new WeakMap<HTMLElement, { minWidth: string; maxWidth: string; minHeight: string; maxHeight: string; visibility: string }>();
  const previousPosition = host.style.position;
  let positionedHost = false;
  const layout = (): void => {
    if (disposed) return;
    for (const { node, element, parent } of entries) {
      const frozen = frozenStyles.get(element);
      if (frozen) { Object.assign(element.style, frozen); frozenStyles.delete(element); }
      // 自顶向下写入父再量子，嵌套 canvas 在同一轮即可拿到新的父尺寸。
      const { w: width, h: height } = parentAnchorBox(parent);
      if (!width && !height) continue; // 隐藏页/尚未接入文档；显示或 resize 时重算。
      try {
        const c = node.layout!;
        const r = solveParentAnchor({ x: 0, y: 0, w: width, h: height }, { w: element.offsetWidth, h: element.offsetHeight }, c);
        const set = (key: 'left' | 'top' | 'width' | 'height', value: number): void => {
          const css = `${value}px`; if (element.style[key] !== css) element.style[key] = css;
        };
        set('left', r.x); set('top', r.y);
        // 点轴无显式尺寸时保留浏览器内容测量，字体加载后 ResizeObserver 会重定位。
        const a = c.parentAnchor!;
        if (c.width !== undefined || a.anchorMin && a.anchorMax && a.anchorMin.x < a.anchorMax.x) set('width', r.w);
        if (c.height !== undefined || a.anchorMin && a.anchorMax && a.anchorMin.y < a.anchorMax.y) set('height', r.h);
        lastValid.set(node.id, r);
        element.removeAttribute('data-parent-anchor-error');
      } catch (e) {
        const message = (e as Error).message;
        if (element.getAttribute('data-parent-anchor-error') !== message) console.warn(`[UI anchor ${node.id}] reject: ${message}`);
        element.setAttribute('data-parent-anchor-error', message); // 保留最后有效矩形，Debug 明确报告失败。
        frozenStyles.set(element, { minWidth: element.style.minWidth, maxWidth: element.style.maxWidth, minHeight: element.style.minHeight, maxHeight: element.style.maxHeight, visibility: element.style.visibility });
        const old = lastValid.get(node.id);
        if (old) Object.assign(element.style, { left: `${old.x}px`, top: `${old.y}px`, width: `${old.w}px`, height: `${old.h}px`, minWidth: `${old.w}px`, maxWidth: `${old.w}px`, minHeight: `${old.h}px`, maxHeight: `${old.h}px` });
        else element.style.visibility = 'hidden'; // 首次即失败，没有可提交的几何。
      }
    }
  };
  const Observer = win?.ResizeObserver;
  const observer = Observer ? new Observer(layout) : undefined;
  const sync = (): void => {
    observer?.disconnect(); entries = [];
    const elements = new Map(Array.from(host.querySelectorAll<HTMLElement>('[id]')).map(el => [el.id, el]));
    const walk = (node: LayoutNode, parent: HTMLElement): void => {
      const element = elements.get(node.id);
      if (!element) return;
      if (node.layout?.parentAnchor) entries.push({ node, element, parent });
      node.children?.forEach(child => walk(child, element));
    };
    walk(getRoot(), host);
    const activeIds = new Set(entries.map(e => e.node.id));
    for (const id of lastValid.keys()) if (!activeIds.has(id)) lastValid.delete(id);
    if (entries.some(e => e.parent === host) && win?.getComputedStyle(host).position === 'static') {
      host.style.position = 'relative'; positionedHost = true;
    }
    const observed = new Set<HTMLElement>();
    for (const e of entries) { observed.add(e.parent); observed.add(e.element); }
    observed.forEach(el => observer?.observe(el));
    layout();
  };
  win?.addEventListener('resize', layout);
  sync();
  return { sync, dispose: () => {
    disposed = true; observer?.disconnect(); win?.removeEventListener('resize', layout);
    if (positionedHost && host.style.position === 'relative') host.style.position = previousPosition;
  } };
}
