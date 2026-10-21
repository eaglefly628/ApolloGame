// 父锚点的唯一几何公式：浏览器与纯布局核共同消费，不依赖 DOM。
import type { AnchorPoint, AnchorPreset, LayoutConstraints, LayoutNode, ParentAnchor } from './types.js';

export const ANCHOR_PRESETS: Readonly<Record<AnchorPreset, AnchorPoint>> = {
  'top-left': { x: 0, y: 0 }, 'top-center': { x: .5, y: 0 }, 'top-right': { x: 1, y: 0 },
  'center-left': { x: 0, y: .5 }, center: { x: .5, y: .5 }, 'center-right': { x: 1, y: .5 },
  'bottom-left': { x: 0, y: 1 }, 'bottom-center': { x: .5, y: 1 }, 'bottom-right': { x: 1, y: 1 },
};
export interface NormalizedParentAnchor {
  anchorMin: AnchorPoint; anchorMax: AnchorPoint; pivot: AnchorPoint;
  offset: { x: number; y: number };
  insets: { top: number; right: number; bottom: number; left: number };
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fail = (field: string): never => { throw new Error(`parentAnchor: ${field}`); };
const point = (v: AnchorPoint | undefined, field: string): AnchorPoint => {
  if (!v || !finite(v.x) || !finite(v.y) || v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1) return fail(`${field} 必须为 0..1 的 {x,y}`);
  if (Object.keys(v).some(k => k !== 'x' && k !== 'y')) return fail(`${field} 含未知字段`);
  return { x: v.x, y: v.y };
};

export function normalizeParentAnchor(a: ParentAnchor): NormalizedParentAnchor {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return fail('必须为对象');
  const allowed = new Set(['preset', 'anchorMin', 'anchorMax', 'pivot', 'offset', 'insets']);
  for (const key of Object.keys(a)) if (!allowed.has(key)) fail(`未知字段 ${key}`);
  let min: AnchorPoint, max: AnchorPoint;
  if (a.preset !== undefined) {
    if (!Object.hasOwn(ANCHOR_PRESETS, a.preset)) return fail('preset 非法');
    if (a.anchorMin !== undefined || a.anchorMax !== undefined) return fail('preset 与 anchorMin/anchorMax 互斥');
    min = point(ANCHOR_PRESETS[a.preset], 'preset'); max = { ...min };
  } else { min = point(a.anchorMin, 'anchorMin'); max = point(a.anchorMax, 'anchorMax'); }
  if (min.x > max.x || min.y > max.y) return fail('anchorMin 不能大于 anchorMax');
  if (a.pivot === null) return fail('pivot 不能为 null');
  const pivot = point(a.pivot ?? (a.preset ? min : { x: .5, y: .5 }), 'pivot');
  for (const [value, fields, field] of [[a.offset, ['x', 'y'], 'offset'], [a.insets, ['top', 'right', 'bottom', 'left'], 'insets']] as const) {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !(fields as readonly string[]).includes(k)))) fail(`${field} 必须为已声明字段的对象`);
    if (value) for (const [key, v] of Object.entries(value)) if (v !== undefined && !finite(v)) fail(`${field}.${key} 必须为有限数`);
  }
  const offset = { x: a.offset?.x ?? 0, y: a.offset?.y ?? 0 };
  const insets = { top: a.insets?.top ?? 0, right: a.insets?.right ?? 0, bottom: a.insets?.bottom ?? 0, left: a.insets?.left ?? 0 };
  for (const [key, v] of Object.entries(offset)) if (!finite(v)) fail(`offset.${key} 必须为有限数`);
  for (const [key, v] of Object.entries(insets)) if (!finite(v) || v < 0) fail(`insets.${key} 必须为非负有限数`);
  if (min.x < max.x && offset.x !== 0 || min.y < max.y && offset.y !== 0) fail('伸缩轴使用 insets，不能再用 offset');
  if (min.x === max.x && (insets.left || insets.right) || min.y === max.y && (insets.top || insets.bottom)) fail('定点轴使用 offset，不能再用 insets');
  return { anchorMin: min, anchorMax: max, pivot, offset, insets };
}

/** 返回本节点的契约错误；只约束新字段，旧树保持原行为。 */
export function parentAnchorIssues(node: LayoutNode, parent?: LayoutNode): string[] {
  const c = node.layout;
  const errors: string[] = [];
  const hasAnchor = (n: LayoutNode): boolean => n.layout?.parentAnchor !== undefined || !!n.children?.some(hasAnchor);
  for (const [key, value] of Object.entries(node.props ?? {})) {
    const sub = value as LayoutNode | null;
    if (sub && typeof sub === 'object' && typeof sub.type === 'string' && typeof sub.id === 'string' && hasAnchor(sub)) errors.push(`props.${key} 属控件内部布局；父锚点请放在普通 children 画布中`);
  }
  if (c?.direction === 'overlay') {
    if (node.type !== 'Panel') errors.push('direction:overlay 只用于 Panel');
    if ((node.props as { bare?: boolean }).bare !== true) errors.push('overlay 画布使用 bare:true；边框/标题放在外层或子节点');
    if ((node.props as { title?: string }).title) errors.push('overlay 的标题请声明为子节点，不能使用隐式 title');
    if ((node.children ?? []).some(k => !k.layout?.parentAnchor && k.layout?.x === undefined && k.layout?.y === undefined)) errors.push('overlay 子项必须声明 parentAnchor 或旧 x/y；流式内容放入子 Panel');
  }
  if (c?.parentAnchor === undefined) return errors;
  try {
    const a = normalizeParentAnchor(c.parentAnchor);
    if (parent && (parent.type !== 'Panel' || parent.layout?.direction !== 'overlay')) errors.push('parentAnchor 的直接父节点必须为 Panel direction:overlay');
    if (c.x !== undefined || c.y !== undefined || c.flex !== undefined || c.margin !== undefined) errors.push('parentAnchor 不与 x/y、flex、margin 混用');
    if (a.anchorMin.x < a.anchorMax.x && c.width !== undefined || a.anchorMin.y < a.anchorMax.y && c.height !== undefined) errors.push('伸缩轴尺寸归锚点控制，不能同时声明 width/height');
    for (const key of ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'] as const) {
      if (c[key] !== undefined && (!finite(c[key]) || c[key]! < 0)) errors.push(`${key} 必须为非负有限数`);
    }
    if ((c.minWidth ?? 0) > (c.maxWidth ?? Infinity) || (c.minHeight ?? 0) > (c.maxHeight ?? Infinity)) errors.push('min 尺寸不能大于 max');
    // 这些控件的内部 chrome/跟随定位会夺取几何控制权，不能伪装成普通 Canvas Slot。
    if (['Screen', 'Modal', 'Drawer', 'Toast', 'Float', 'Connector', 'Tooltip', 'ContextMenu'].includes(node.type)) errors.push(`${node.type} 具有专用布局；请在锚定 Panel 内组合普通控件`);
    if (c.flyTo || c.anim || c.fx?.some(f => ['pulse', 'float', 'shake', 'pop', 'wobble'].includes(f.kind))) errors.push('位移动画请放入锚定壳的子节点，保持几何控制权唯一');
  } catch (e) { errors.push((e as Error).message); }
  return errors;
}

export function assertParentAnchorTree(root: LayoutNode): void {
  const ids = new Set<string>();
  const hasAnchors = (node: LayoutNode): boolean => node.layout?.parentAnchor !== undefined || node.layout?.direction === 'overlay' || !!node.children?.some(hasAnchors);
  const strictIds = hasAnchors(root);
  const walk = (node: LayoutNode, parent?: LayoutNode): void => {
    if (strictIds && (!node.id || ids.has(node.id))) throw new Error(`[UI anchor ${node.id}] missing/duplicate instance id`);
    ids.add(node.id);
    const errors = parentAnchorIssues(node, parent);
    if (errors.length) throw new Error(`[UI anchor ${node.id}] ${errors.join('; ')}`);
    node.children?.forEach(k => walk(k, node));
  };
  walk(root);
}

export interface AnchorRect { x: number; y: number; w: number; h: number }
/** 点轴：P+L*A+offset-D*pivot。伸缩轴：区间扣边距，封顶后按 pivot 排列。 */
export function solveParentAnchor(parent: AnchorRect, size: { w: number; h: number }, c: LayoutConstraints): AnchorRect {
  const a = normalizeParentAnchor(c.parentAnchor!);
  const axis = (p: number, length: number, lo: number, hi: number, pivot: number, offset: number, start: number, end: number, preferred: number, min = 0, max = Infinity): [number, number] => {
    const stretch = lo < hi;
    const available = length * (hi - lo) - start - end;
    if (!finite(length) || length < 0 || !finite(preferred) || preferred < 0) return fail('父矩形/控件尺寸非法');
    if (stretch && available < min) return fail(`伸缩空间 ${available} 小于最小尺寸 ${min}`);
    const d = Math.max(min, Math.min(stretch ? available : preferred, max));
    return stretch ? [p + length * lo + start + pivot * (available - d), d] : [p + length * lo + offset - d * pivot, d];
  };
  const [x, w] = axis(parent.x, parent.w, a.anchorMin.x, a.anchorMax.x, a.pivot.x, a.offset.x, a.insets.left, a.insets.right, c.width ?? size.w, c.minWidth, c.maxWidth);
  const [y, h] = axis(parent.y, parent.h, a.anchorMin.y, a.anchorMax.y, a.pivot.y, a.offset.y, a.insets.top, a.insets.bottom, c.height ?? size.h, c.minHeight, c.maxHeight);
  return { x, y, w, h };
}
