// Opt-in engine inspector. Its chrome lives outside the inspected tree and never emits game actions.
import type { LayoutNode } from './types.js';
import { normalizeParentAnchor } from './parent-anchor.js';
import { parentAnchorBox } from './parent-anchor-dom.js';

const occupiedSlots = new WeakMap<Document, Set<number>>();
const inspectorChrome = new WeakMap<Document, Set<HTMLElement>>();
const SVG_NS = 'http://www.w3.org/2000/svg';

type Entry = { node: LayoutNode; ancestors: LayoutNode[] };

/** Mount only when debugAnchors is explicitly enabled. sync() follows mountUI updates. */
export function mountAnchorDebug(host: HTMLElement, getRoot: () => LayoutNode): { sync(): void; dispose(): void } {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const slots = occupiedSlots.get(doc) ?? new Set<number>();
  occupiedSlots.set(doc, slots);
  let slot = 0;
  while (slots.has(slot)) slot++;
  slots.add(slot);

  const chrome = doc.createElement('div');
  chrome.dataset.anchorDebug = '';
  const chromeInstances = inspectorChrome.get(doc) ?? new Set<HTMLElement>();
  inspectorChrome.set(doc, chromeInstances);
  chromeInstances.add(chrome);
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = '锚点 Debug';
  button.dataset.anchorDebugToggle = '';
  button.setAttribute('aria-pressed', 'false');
  button.style.cssText = `position:fixed;right:12px;top:${12 + slot * 42}px;z-index:2147483647;padding:8px 12px;border:1px solid #95baff;border-radius:6px;background:#172033;color:#fff;font:13px/1.3 system-ui;cursor:pointer;`;
  const panel = doc.createElement('section');
  panel.dataset.anchorDebugPanel = '';
  panel.setAttribute('aria-label', '锚点调试信息');
  panel.hidden = true;
  panel.style.cssText = `position:fixed;right:12px;top:${58 + slot * 42}px;z-index:2147483647;width:360px;max-width:calc(100vw - 24px);max-height:calc(100vh - ${82 + slot * 42}px);overflow:auto;box-sizing:border-box;padding:14px;border:1px solid #95baff;border-radius:8px;background:#111827;color:#fff;box-shadow:0 6px 24px #0008;font:12px/1.6 system-ui;`;
  const instructions = doc.createElement('div');
  const fullInstructions = '检查模式：点击控件查看；Esc 退出。金框=选中，蓝框=几何父容器，紫框/线=父锚点范围与 pivot。检查期间不触发业务动作。';
  instructions.textContent = fullInstructions;
  const fold = doc.createElement('button');
  fold.type = 'button';
  fold.dataset.anchorDebugFold = '';
  fold.textContent = '收起详情以点选';
  fold.setAttribute('aria-expanded', 'true');
  fold.style.cssText = 'display:block;margin:0 0 8px;padding:5px 8px;background:#25334c;color:#fff;border:1px solid #95baff;border-radius:4px;font:12px/1.3 system-ui;cursor:pointer;';
  const details = doc.createElement('pre');
  details.dataset.anchorDebugDetails = '';
  details.style.cssText = 'margin:10px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace;color:#fff;';
  panel.append(fold, instructions, details);
  const overlay = doc.createElementNS(SVG_NS, 'svg');
  overlay.dataset.anchorDebugOverlay = '';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'display:none;position:fixed;inset:0;width:100%;height:100%;z-index:2147483646;pointer-events:none;overflow:visible;';
  chrome.append(overlay, button, panel);
  doc.body.append(chrome);

  let open = false;
  let disposed = false;
  let selectedId: string | undefined;
  let selectedUnknown: HTMLElement | undefined;
  let folded = false;
  // Track physical holds, including holds begun before inspection. A blurred input source
  // must not see an OS repeat as a fresh action edge when inspection closes.
  const heldKeys = new Set<string>();
  const quarantinedKeys = new Set<string>();
  let hasInspected = false;
  const observed = new Set<HTMLElement>();
  const observer = win?.ResizeObserver ? new win.ResizeObserver(() => sync()) : undefined;
  function watch(elements: HTMLElement[]): void {
    const next = new Set(elements);
    for (const el of observed) if (!next.has(el)) { observer?.unobserve(el); observed.delete(el); }
    for (const el of next) if (!observed.has(el)) { observer?.observe(el); observed.add(el); }
  }

  function entries(): Map<string, Entry> {
    const result = new Map<string, Entry>();
    function walk(node: LayoutNode, ancestors: LayoutNode[]): void {
      result.set(node.id, { node, ancestors });
      for (const child of node.children ?? []) walk(child, [...ancestors, node]);
    }
    walk(getRoot(), []);
    return result;
  }
  function findElement(id: string): HTMLElement | undefined {
    // IDs are data, never interpolated into CSS selectors (quotes/brackets remain harmless).
    if (host.id === id) return host;
    return [...host.querySelectorAll<HTMLElement>('[id]')].find(el => el.id === id);
  }
  function rect(el: HTMLElement): DOMRect { return el.getBoundingClientRect(); }
  function fmt(n: number): string { return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '?'; }
  function rectText(el: HTMLElement): string {
    const r = rect(el);
    return `x=${fmt(r.left)}, y=${fmt(r.top)}, w=${fmt(r.width)}, h=${fmt(r.height)} (视口 px)`;
  }
  function svg(tag: string, attrs: Record<string, number | string>): void {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    overlay.append(el);
  }
  function box(el: HTMLElement, color: string, kind: string): void {
    const r = rect(el);
    svg('rect', { x: r.left, y: r.top, width: Math.max(0, r.width), height: Math.max(0, r.height), fill: 'none', stroke: color, 'stroke-width': 2, 'data-debug-box': kind });
  }
  function anchorDrawing(el: HTMLElement, parent: HTMLElement, value: NonNullable<LayoutNode['layout']>['parentAnchor']): void {
    if (!value) return;
    try {
      const normalized = normalizeParentAnchor(value);
      const r = rect(parent);
      const sx = parent.offsetWidth ? r.width / parent.offsetWidth : 1;
      const sy = parent.offsetHeight ? r.height / parent.offsetHeight : 1;
      const left = r.left + (parent.clientLeft - parent.scrollLeft) * sx;
      const top = r.top + (parent.clientTop - parent.scrollTop) * sy;
      const logicalBox = parentAnchorBox(parent);
      const width = logicalBox.w * sx;
      const height = logicalBox.h * sy;
      const x1 = left + width * normalized.anchorMin.x;
      const y1 = top + height * normalized.anchorMin.y;
      const x2 = left + width * normalized.anchorMax.x;
      const y2 = top + height * normalized.anchorMax.y;
      svg('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, fill: 'none', stroke: '#dc9aff', 'stroke-width': 2, 'stroke-dasharray': '4 3', 'data-debug-anchor': 'range' });
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        svg('path', { d: `M${x - 6},${y}h12 M${x},${y - 6}v12`, stroke: '#dc9aff', 'stroke-width': 2, 'data-debug-anchor': 'point' });
      }
      const selected = rect(el);
      const px = selected.left + selected.width * normalized.pivot.x;
      const py = selected.top + selected.height * normalized.pivot.y;
      svg('line', { x1: x1 + (x2 - x1) * normalized.pivot.x, y1: y1 + (y2 - y1) * normalized.pivot.y, x2: px, y2: py, stroke: '#dc9aff', 'stroke-width': 2, 'data-debug-anchor': 'link' });
      svg('circle', { cx: px, cy: py, r: 5, fill: '#111827', stroke: '#dc9aff', 'stroke-width': 2, 'data-debug-anchor': 'pivot' });
    } catch {
      // Invalid declarations are reported below; never invent usable geometry for rejected data.
    }
  }
  function geometricParent(entry: Entry): { el?: HTMLElement; id: string; mode: string } {
    const parent = entry.ancestors.at(-1);
    if (!parent) return { el: host, id: host.id || '(host)', mode: 'host（根节点参考容器）' };
    return {
      el: findElement(parent.id), id: parent.id,
      mode: `${parent.type} / ${parent.layout?.direction ?? 'column'}（直属 LayoutNode 父级）`,
    };
  }
  function sync(): void {
    if (disposed || !open) return;
    overlay.replaceChildren();
    const index = entries();
    const el = selectedId !== undefined ? findElement(selectedId) : selectedUnknown;
    const entry = selectedId !== undefined ? index.get(selectedId) : undefined;
    if (!el || !host.contains(el)) {
      watch([host]);
      details.textContent = selectedId === undefined ? '尚未选中控件。' : `id: ${selectedId}\n节点当前未渲染或已移除。`;
      return;
    }
    box(el, '#ffd166', 'selected');
    if (!entry) {
      watch([host, el]);
      details.textContent = `id: ${el.id || '(无 id)'}\n未知 DOM 节点（LayoutNode 树中无对应项）\n实际矩形: ${rectText(el)}\n未推断锚点。`;
      return;
    }
    const { node, ancestors } = entry;
    const parent = geometricParent(entry);
    watch([host, el, ...(parent.el ? [parent.el] : [])]);
    if (parent.el) box(parent.el, '#7ab7ff', 'parent');
    const ownAnchor = node.layout?.parentAnchor;
    const outer = [...ancestors].reverse().find(n => n.layout?.parentAnchor);
    const layoutMode = ownAnchor ? '显式 parentAnchor' : node.layout?.x !== undefined || node.layout?.y !== undefined ? 'legacy x/y' : 'flow（自身未声明 parentAnchor）';
    const lines = [
      `id: ${node.id} (${node.type})`,
      `自身模式: ${layoutMode}`,
      `几何父 id: ${parent.id}`,
      `几何父模式: ${parent.mode}`,
      `逻辑父 id: ${ancestors.at(-1)?.id ?? '(root)'}`,
      `最近外层显式锚点组: ${outer?.id ?? '(无)'}`,
      `实际矩形: ${rectText(el)}`,
      `父容器矩形: ${parent.el ? rectText(parent.el) : '(父节点未渲染，不推断替代容器)'}`,
      `求解错误: ${el.getAttribute('data-parent-anchor-error') ?? '(无)'}`,
    ];
    if (ownAnchor) {
      try {
        const a = normalizeParentAnchor(ownAnchor);
        const point = (p: { x: number; y: number }): string => `(${fmt(p.x)}, ${fmt(p.y)})`;
        lines.push(
          `预设: ${ownAnchor.preset ?? '(自定义)'}`,
          `Anchor Min: ${point(a.anchorMin)}`,
          `Anchor Max: ${point(a.anchorMax)}`,
          `Pivot: ${point(a.pivot)}`,
          `Offset: ${point(a.offset)}`,
          `Insets: 上 ${a.insets.top} / 右 ${a.insets.right} / 下 ${a.insets.bottom} / 左 ${a.insets.left}`,
        );
        if (parent.el) anchorDrawing(el, parent.el, ownAnchor);
      } catch (error) {
        lines.push(`锚点声明错误: ${error instanceof Error ? error.message : String(error)}`);
      }
      lines.push(`声明 parentAnchor: ${JSON.stringify(ownAnchor)}`);
    } else {
      lines.push('自身 parentAnchor: 未声明（不从 flow 位置反推）');
      if (outer) lines.push(`外层组 parentAnchor: ${JSON.stringify(outer.layout?.parentAnchor)}`);
    }
    details.textContent = lines.join('\n');
  }
  function setOpen(value: boolean): void {
    open = value;
    if (open) {
      hasInspected = true;
      heldKeys.forEach(code => quarantinedKeys.add(code));
      // KeyboardInputSource and the browser's other blur-aware sources clear held
      // movement here. Already queued pre-inspection commands remain owned by the input source.
      if (win) win.dispatchEvent(new win.Event('blur'));
    }
    button.setAttribute('aria-pressed', String(open));
    panel.hidden = !open;
    overlay.style.display = open ? 'block' : 'none';
    if (open) sync();
    else { overlay.replaceChildren(); watch([]); }
  }
  function toggle(): void { setOpen(!open); }
  function toggleDetails(): void {
    folded = !folded;
    details.hidden = folded;
    fold.textContent = folded ? '展开详情' : '收起详情以点选';
    fold.setAttribute('aria-expanded', String(!folded));
    instructions.textContent = folded ? '点选控件 · Esc 退出检查' : fullInstructions;
    panel.style.width = folded ? '210px' : '360px';
  }
  function interceptKeyboard(event: KeyboardEvent): void {
    if (disposed) return;
    const code = event.code || event.key;
    const wasHeld = heldKeys.has(code);
    const keyup = event.type === 'keyup';
    if (event.type === 'keydown') heldKeys.add(code);
    const target = event.target;
    const onChrome = target instanceof doc.defaultView!.Node && [...chromeInstances].some(el => el.contains(target));
    const nativeChromeKey = onChrome && ['Enter', ' ', 'Spacebar', 'Tab'].includes(event.key);
    const nativeTab = open && event.key === 'Tab'; // Keep native focus navigation even after Tab leaves chrome.
    if (open && event.type === 'keydown') quarantinedKeys.add(code);
    if (!open && hasInspected && event.type === 'keydown' && event.repeat && !wasHeld) quarantinedKeys.add(code);
    const quarantine = quarantinedKeys.has(code);
    if (keyup) { heldKeys.delete(code); quarantinedKeys.delete(code); }
    if (!open && !quarantine && !nativeChromeKey) return;
    // Window capture runs ahead of KeyboardInputSource(window)'s bubbling listener,
    // even when the latter was registered before this inspector and focus is outside host.
    event.stopImmediatePropagation();
    if (open && event.type === 'keydown' && event.key === 'Escape') {
      event.preventDefault(); setOpen(false); button.focus(); return;
    }
    // stopPropagation alone leaves native button activation / focus traversal intact;
    // preventing these defaults would make the Debug toggle unusable from the keyboard.
    if (!nativeChromeKey && !nativeTab) event.preventDefault();
  }
  function intercept(event: Event): void {
    if (!open || disposed) return;
    if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      button.focus();
      return;
    }
    const target = event.target;
    if (target instanceof doc.defaultView!.Node && chrome.contains(target)) return;
    if (!(target instanceof doc.defaultView!.Node) || !host.contains(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'click' && event.type !== 'pointerdown') return;
    const index = entries();
    let el = target instanceof doc.defaultView!.Element ? target : target.parentElement;
    selectedId = undefined;
    selectedUnknown = undefined;
    const clicked = el as HTMLElement | null;
    while (el && host.contains(el)) {
      const id = el.getAttribute('data-ui-id') ?? el.id;
      if (id && index.has(id)) { selectedId = id; break; }
      if (el === host) break;
      el = el.parentElement;
    }
    if (selectedId === undefined && clicked) selectedUnknown = clicked;
    sync();
  }
  const events = ['pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'pointercancel', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'keydown', 'keyup', 'keypress', 'input', 'change', 'dragstart', 'dragover', 'drop'] as const;
  for (const name of events) doc.addEventListener(name, intercept, { capture: true, passive: false });
  for (const name of ['keydown', 'keyup', 'keypress'] as const) win?.addEventListener(name, interceptKeyboard, { capture: true, passive: false });
  button.addEventListener('click', toggle);
  fold.addEventListener('click', toggleDetails);
  win?.addEventListener('resize', sync);
  doc.addEventListener('scroll', sync, true);
  return {
    sync,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const name of events) doc.removeEventListener(name, intercept, true);
      for (const name of ['keydown', 'keyup', 'keypress'] as const) win?.removeEventListener(name, interceptKeyboard, true);
      heldKeys.clear(); quarantinedKeys.clear();
      chromeInstances.delete(chrome);
      button.removeEventListener('click', toggle);
      fold.removeEventListener('click', toggleDetails);
      observer?.disconnect();
      observed.clear();
      win?.removeEventListener('resize', sync);
      doc.removeEventListener('scroll', sync, true);
      chrome.remove();
      slots.delete(slot);
    },
  };
}
