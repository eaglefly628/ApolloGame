import { mountUI, apolloOnyx, validateLayoutNode } from '__ROOT__/src/ui/components/index.ts';
import { KeyboardInputSource } from '__ROOT__/src/net/host/local-input.ts';
import { solveLayout } from '__ROOT__/src/ui/components/layout-solver.ts';

const host = document.getElementById('host');
let handle, tree, tick = 0;
const actions = [];
const keyboard = new KeyboardInputSource('anchor-regression', window, {
  KeyF: { action: 'review.fire' }, Enter: { action: 'review.enter' },
  Space: { action: 'review.space' }, Tab: { action: 'review.tab' },
  Escape: { action: 'review.escape' }, ArrowRight: { dx: 1 },
});
const panel = (id, children, layout = {}) => ({ type: 'Panel', id, props: { bare: true }, layout: { direction: 'overlay', ...layout }, children });
const pin = (id = 'pin', layout = {}) => ({ type: 'Button', id, props: { label: id, action: 'act', kind: 'ghost' }, layout: { width: 90, height: 34, parentAnchor: { preset: 'bottom-right', offset: { x: -12, y: -12 } }, ...layout } });
const stretch = { anchorMin: { x: 0, y: .5 }, anchorMax: { x: 1, y: .5 }, pivot: { x: .5, y: .5 } };
const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
function reset(css = '') {
  handle?.(); handle = undefined;
  if (!host.isConnected) document.body.append(host);
  host.style.cssText = 'margin:24px;width:720px;height:520px;position:relative;' + css;
  host.replaceChildren(); actions.length = 0;
  keyboard.commandsForTick(++tick);
}
function mount(next, debug = false) {
  tree = next;
  const issues = validateLayoutNode(tree);
  if (issues.length) throw Error('Invalid regression fixture: ' + JSON.stringify(issues));
  handle = mountUI(host, tree, { act: (...args) => actions.push(args) }, apolloOnyx, undefined, { debugAnchors: debug });
}
function debug() {
  const chrome = document.querySelector('[data-anchor-debug]');
  return {
    open: chrome?.querySelector('[data-anchor-debug-toggle]')?.getAttribute('aria-pressed') === 'true',
    hidden: chrome?.querySelector('[data-anchor-debug-details]')?.hidden,
    text: chrome?.querySelector('[data-anchor-debug-details]')?.textContent,
    shapes: [...chrome?.querySelector('[data-anchor-debug-overlay]')?.children ?? []].map(el => ({ tag: el.tagName, attrs: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])) })),
  };
}
const legacy = id => ({ type: 'Button', id, props: { label: 'legacy' }, layout: { x: 20, y: 10, width: 100, height: 40 } });
const freshHost = css => { const h = document.createElement('div'); h.style.cssText = css; document.body.append(h); return h; };
window.probe = {
  debug, actions,
  commands: () => keyboard.commandsForTick(++tick),
  debugMount() { reset(); mount(panel('canvas', [pin('pin', { parentAnchor: { preset: 'center' } })], { width: 600, height: 400 }), true); },
  scrollMount(scale = 1) {
    reset(`transform-origin:0 0;transform:scale(${scale});`);
    const next = panel('canvas', [pin(), { type: 'Label', id: 'filler', props: { text: 'scroll extent' }, layout: { x: 1100, y: 900, width: 100, height: 30 } }], { width: 500, height: 300 });
    next.props.scroll = true;
    mount(next, true);
    // Integer borders avoid the independent fractional-border candidate (not part of F2).
    document.getElementById('canvas').style.border = '4px solid #adf';
  },
  scroll(left, top) { const p = document.getElementById('canvas'); p.scrollLeft = left; p.scrollTop = top; },
  scrollRead() {
    const p = document.getElementById('canvas'), el = document.getElementById('pin');
    const r = p.getBoundingClientRect(), c = el.getBoundingClientRect();
    return { parent: rect(p), child: rect(el), sx: r.width / p.offsetWidth, sy: r.height / p.offsetHeight, scrollLeft: p.scrollLeft, scrollTop: p.scrollTop, debug: debug(), expectedRange: { x: c.right + 12 * r.width / p.offsetWidth, y: c.bottom + 12 * r.height / p.offsetHeight } };
  },
  lifecycle(externalPosition) {
    reset('position:static;');
    mount(panel('root-pin', [pin()], { width: 350, height: 200, parentAnchor: { preset: 'bottom-right' } }));
    const ownedPosition = host.style.position;
    if (externalPosition !== undefined) host.style.position = externalPosition;
    handle.update(legacy('updated-legacy'));
    const updated = rect(document.getElementById('updated-legacy'));
    const expectedPosition = externalPosition ?? 'static';
    const f = freshHost('margin:24px;width:720px;height:520px;position:' + expectedPosition);
    const cleanup = mountUI(f, legacy('fresh-legacy'), {}, apolloOnyx);
    const fresh = rect(document.getElementById('fresh-legacy'));
    // For positioned hosts compare child-local geometry (fresh host is later in normal flow).
    const local = (r, h) => { const b = h.getBoundingClientRect(); return { x: r.x - b.x, y: r.y - b.y, w: r.w, h: r.h }; };
    const result = { ownedPosition, afterPosition: host.style.position, expectedPosition, updated, fresh, updatedLocal: local(updated, host), freshLocal: local(fresh, f) };
    cleanup(); f.remove(); return result;
  },
  naturalMount(width = 300) {
    reset('width:' + width + 'px;');
    const label = { type: 'Label', id: 'natural', props: { text: 'The natural content wraps over several lines as the available space changes. ' + 'Readable text content. '.repeat(5) }, layout: { minWidth: 100, parentAnchor: stretch } };
    mount(panel('canvas', [label], { height: 200 }));
  },
  resize(width) { host.style.width = width + 'px'; },
  naturalRead() {
    const p = document.getElementById('canvas'), c = document.getElementById('natural'), b = p.getBoundingClientRect(), r = c.getBoundingClientRect();
    return { parent: rect(p), child: { x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height }, error: c.dataset.parentAnchorError ?? null, css: { width: c.style.width, height: c.style.height, minHeight: c.style.minHeight, maxHeight: c.style.maxHeight, visibility: getComputedStyle(c).visibility } };
  },
  zeroMount(mode) {
    reset();
    const child = { type: 'Label', id: 'zero-pin', props: { text: 'content' }, layout: { minWidth: 100, height: 20, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 0 } } } };
    if (mode === 'hidden') host.style.display = 'none';
    if (mode === 'detached') host.remove();
    mount(panel('canvas', [child], mode === 'explicit' ? { width: 0, height: 0 } : { height: 200 }));
  },
  zeroRead() {
    const p = host.querySelector('#canvas'), c = host.querySelector('#zero-pin');
    return { connected: p.isConnected, display: getComputedStyle(host).display, parent: rect(p), child: rect(c), error: c.dataset.parentAnchorError ?? null, visibility: getComputedStyle(c).visibility };
  },
  zeroRecover(mode) {
    if (mode === 'explicit') { tree = { ...tree, layout: { ...tree.layout, width: 300, height: 200 } }; handle.update(tree); }
    if (mode === 'hidden') host.style.display = '';
    if (mode === 'detached') document.body.append(host);
    window.dispatchEvent(new Event('resize'));
  },
  centerOverflowMount(direction = 'column') {
    reset();
    const size = direction === 'column' ? { width: 220, height: 20 } : { width: 20, height: 220 };
    mount(panel('canvas', [{ type: 'Label', id: 'subject', props: { text: 'overflow' }, layout: size }], { direction, align: 'center', width: 100, height: 100, padding: 0, gap: 0 }));
  },
  constraintsMount(path, constraint) {
    reset();
    const limit = constraint === 'minWidth' ? { minWidth: 220 } : constraint === 'minHeight' ? { minHeight: 220 } : { maxHeight: 60 };
    // A plain Label has no Button chrome minimum or padding; isolate layout constraints.
    const child = { type: 'Label', id: 'constraint-pin', props: { text: 'p' }, layout: { width: 20, height: 20, parentAnchor: { preset: 'bottom-right' } } };
    const subject = panel('subject', [child], { width: 100, height: 100, ...limit });
    if (path === 'root') mount(subject);
    else if (path === 'intrinsic') {
      // Parent auto-width is allocated from constrained child's intrinsic width.
      const wrapper = panel('wrapper', [subject], { direction: 'column', align: 'start', padding: 0, gap: 0 });
      mount(panel('canvas', [wrapper], { direction: 'row', align: 'start', width: 600, height: 400, padding: 0, gap: 0 }));
    } else {
      // CSS cross-axis stretch is clamped by child min/max dimensions.
      const direction = constraint === 'minWidth' ? 'column' : 'row';
      delete subject.layout[constraint === 'minWidth' ? 'width' : 'height'];
      mount(panel('canvas', [subject], { direction, align: 'stretch', width: 100, height: 100, padding: 0, gap: 0 }));
    }
    return { tree };
  },
  constraintsRead() {
    const h = host.getBoundingClientRect();
    const dom = Object.fromEntries([...host.querySelectorAll('[id]')].map(el => { const r = el.getBoundingClientRect(); return [el.id, { x: r.x - h.x, y: r.y - h.y, w: r.width, h: r.height }]; }));
    const solver = Object.fromEntries(solveLayout(tree, { w: 720, h: 520 }, node => { const el = document.getElementById(node.id); return { w: el.offsetWidth, h: el.offsetHeight }; }));
    return { dom, solver };
  },
  destroy() { handle?.(); handle = undefined; keyboard.dispose(); return { remainingDebug: document.querySelectorAll('[data-anchor-debug]').length }; },
};
