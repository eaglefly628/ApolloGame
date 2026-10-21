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
  const geometryKeys = ['left', 'top', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'visibility'] as const;
  type GeometryStyles = Record<typeof geometryKeys[number], string>;
  const frozenStyles = new WeakMap<HTMLElement, GeometryStyles>();
  let previousPosition = '';
  let previousPositionPriority = '';
  let positionedHost = false;
  const releaseHostPosition = (): void => {
    if (positionedHost && host.style.position === 'relative' && !host.style.getPropertyPriority('position')) {
      if (previousPosition) host.style.setProperty('position', previousPosition, previousPositionPriority);
      else host.style.removeProperty('position');
    }
    positionedHost = false;
  };
  const deferred = (parent: HTMLElement): boolean => {
    if (!parent.isConnected) return true;
    for (let el: HTMLElement | null = parent; el; el = el.parentElement) {
      if (win?.getComputedStyle(el).display === 'none') return true;
    }
    return false;
  };
  const layout = (): void => {
    if (disposed) return;
    for (const { node, element, parent } of entries) {
      const frozen = frozenStyles.get(element);
      if (frozen) { Object.assign(element.style, frozen); frozenStyles.delete(element); }
      if (deferred(parent)) continue;
      // 自顶向下写入父再量子，嵌套 canvas 在同一轮即可拿到新的父尺寸。
      const { w: width, h: height } = parentAnchorBox(parent);
      try {
        const c = node.layout!;
        const solve = (): AnchorRect => solveParentAnchor({ x: 0, y: 0, w: width, h: height }, { w: element.offsetWidth, h: element.offsetHeight }, c);
        let r = solve();
        const set = (key: 'left' | 'top' | 'width' | 'height', value: number): void => {
          const css = `${value}px`; if (element.style[key] !== css) element.style[key] = css;
        };
        // 点轴无显式尺寸时保留浏览器内容测量，字体加载后 ResizeObserver 会重定位。
        const a = c.parentAnchor!;
        if (c.width !== undefined || a.anchorMin && a.anchorMax && a.anchorMin.x < a.anchorMax.x) set('width', r.w);
        if (c.height !== undefined || a.anchorMin && a.anchorMax && a.anchorMin.y < a.anchorMax.y) set('height', r.h);
        // 伸缩宽度先落地，再测换行后的自然高度；否则 pivot 会使用上一档宽度的高度。
        r = solve();
        set('left', r.x); set('top', r.y);
        lastValid.set(node.id, r);
        element.removeAttribute('data-parent-anchor-error');
      } catch (e) {
        const message = (e as Error).message;
        if (element.getAttribute('data-parent-anchor-error') !== message) console.warn(`[UI anchor ${node.id}] reject: ${message}`);
        element.setAttribute('data-parent-anchor-error', message); // 保留最后有效矩形，Debug 明确报告失败。
        frozenStyles.set(element, Object.fromEntries(geometryKeys.map(key => [key, element.style[key]])) as GeometryStyles);
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
    const needsHostPosition = entries.some(e => e.parent === host);
    if (!needsHostPosition) releaseHostPosition();
    else if (win?.getComputedStyle(host).position === 'static') {
      previousPosition = host.style.position;
      previousPositionPriority = host.style.getPropertyPriority('position');
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
    releaseHostPosition();
  } };
}
