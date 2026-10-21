// 平台无关布局求解 —— 「逻辑/视觉分离」的**逻辑核**。
//
// LayoutNode 树 + LayoutConstraints → 各节点盒子 {x,y,w,h}。纯函数·无 DOM·无 CSS。
//
// · HTML 后端：普通 flow 交给 CSS；父锚点与本模块共享 parent-anchor.ts 的几何公式。
// · Canvas / 微信小游戏等**无 CSS** 的后端：import 本模块即得布局，只需自己写"画"(视觉)。
//
// 契约边界：求解器按 LayoutConstraints 排「容器 → children」的**通用**布局
// （direction row/column/grid、gap、align、flex、padding、绝对定位 x/y）。
// 控件**内部**结构（Table 行/Tabs 页/Stepper ± 钮/Segmented 段…）由各后端的绘制函数
// 在分到的盒子内自排——求解器只给外框 + 通用容器排布。叶子内在尺寸由注入的 measure 提供
// （后端相关：Canvas 用 ctx.measureText + 控件内边距规则；测试用 stub）。

import type { LayoutNode } from './types.js';
import { assertParentAnchorTree, solveParentAnchor } from './parent-anchor.js';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }
/** 叶子/控件内在尺寸（注入·后端相关）。容器尺寸由布局算，不调用本函数。 */
export type MeasureFn = (node: LayoutNode) => Size;

const DEF_GAP = 8;
const DEF_PAD = 16;
const hasKids = (n: LayoutNode): n is LayoutNode & { children: LayoutNode[] } =>
  Array.isArray(n.children) && n.children.length > 0;
const isAbs = (n: LayoutNode): boolean => !!n.layout?.parentAnchor || n.layout?.x !== undefined || n.layout?.y !== undefined;
// 与 CSS min/max 相同：最小约束优先，任何阶段不能再把受限的父画布放大/缩小回原值。
const constrain = (node: LayoutNode, size: Size): Size => {
  const c = node.layout ?? {};
  return { w: Math.max(c.minWidth ?? 0, Math.min(size.w, c.maxWidth ?? Infinity)), h: Math.max(c.minHeight ?? 0, Math.min(size.h, c.maxHeight ?? Infinity)) };
};

// —— 第一趟：内在尺寸（自底向上）——
function intrinsic(node: LayoutNode, measure: MeasureFn): Size {
  const c = node.layout ?? {};
  if (!hasKids(node)) {
    const measured = measure(node);
    return constrain(node, { w: c.width ?? measured.w, h: c.height ?? measured.h });
  }

  const dir = c.direction ?? 'column';
  const gap = c.gap ?? DEF_GAP;
  const pad = c.padding ?? (node.type === 'Panel' && (node.props as { bare?: boolean }).bare === true ? 0 : DEF_PAD);
  const kids = node.children.filter(k => !isAbs(k)).map((k) => intrinsic(k, measure));
  const sum = (pick: (s: Size) => number): number => kids.reduce((s, k) => s + pick(k), 0) + gap * Math.max(0, kids.length - 1);
  const max = (pick: (s: Size) => number): number => kids.reduce((m, k) => Math.max(m, pick(k)), 0);

  let w: number, h: number;
  if (dir === 'overlay') { w = 0; h = 0; }
  else if (dir === 'row') { w = sum((s) => s.w); h = max((s) => s.h); }
  else { w = max((s) => s.w); h = sum((s) => s.h); } // column 与 grid 内在同（grid 真实列数在 arrange 用分到的宽算）
  return constrain(node, { w: c.width ?? w + pad * 2, h: c.height ?? h + pad * 2 });
}

// —— 第二趟：分配位置（自顶向下）——
function arrange(node: LayoutNode, rect: Rect, measure: MeasureFn, out: Map<string, Rect>): void {
  rect = { ...rect, ...constrain(node, rect) };
  out.set(node.id, rect);
  if (!hasKids(node)) return;

  const c = node.layout ?? {};
  const dir = c.direction ?? 'column';
  const gap = c.gap ?? DEF_GAP;
  const pad = c.padding ?? (node.type === 'Panel' && (node.props as { bare?: boolean }).bare === true ? 0 : DEF_PAD);
  const align = c.align ?? 'stretch';
  const innerX = rect.x + pad, innerY = rect.y + pad;
  const innerW = rect.w - pad * 2, innerH = rect.h - pad * 2;
  const kids = node.children;
  const sizes = kids.map((k) => intrinsic(k, measure));

  // Canvas Slot 不进入 Flex/Grid 占位；锚定壳内部仍可继续 flow 或嵌套 canvas。
  kids.forEach((k, i) => {
    if (k.layout?.parentAnchor) {
      arrange(k, solveParentAnchor(rect, sizes[i]!, k.layout), measure, out);
    } else if (isAbs(k)) {
      arrange(k, { x: rect.x + (k.layout?.x ?? 0), y: rect.y + (k.layout?.y ?? 0), w: sizes[i]!.w, h: sizes[i]!.h }, measure, out);
    }
  });
  if (dir === 'overlay') return;
  const flow = kids.map((k, i) => ({ k, i })).filter(({ k }) => !isAbs(k));

  if (dir === 'grid') {
    const minCol = c.minCol ?? 96;
    const cols = c.cols ?? Math.max(1, Math.floor((innerW + gap) / (minCol + gap)));
    const colW = (innerW - gap * (cols - 1)) / cols;
    const rows = Math.ceil(flow.length / cols);
    const rowH = Array.from({ length: rows }, (_, r) => {
      let mh = 0;
      for (let ci = 0; ci < cols; ci++) { const idx = r * cols + ci; if (idx < flow.length) mh = Math.max(mh, sizes[flow[idx]!.i]!.h); }
      return mh;
    });
    flow.forEach(({ k, i: sourceIndex }, i) => {
      const r = Math.floor(i / cols), ci = i % cols;
      const size = constrain(k, { w: k.layout?.width ?? colW, h: sizes[sourceIndex]!.h });
      const x = innerX + ci * (colW + gap) + (k.layout?.maxWidth !== undefined ? Math.max(0, colW - size.w) / 2 : 0);
      let y = innerY;
      for (let rr = 0; rr < r; rr++) y += rowH[rr]! + gap;
      arrange(k, { x, y, ...size }, measure, out);
    });
    return;
  }

  // 流式（row/column）：flex 分主轴 · align 排交叉轴
  const mainOf = (s: Size): number => (dir === 'row' ? s.w : s.h);
  const crossAvail = dir === 'row' ? innerH : innerW;
  const mainAvail = dir === 'row' ? innerW : innerH;
  const totalGap = gap * Math.max(0, flow.length - 1);
  const fixedMain = flow.reduce((s, { k, i }) => s + (k.layout?.flex ? 0 : mainOf(sizes[i]!)), 0);
  const totalFlex = flow.reduce((s, { k }) => s + (k.layout?.flex ?? 0), 0);
  const freeMain = Math.max(0, mainAvail - totalGap - fixedMain);

  const mainSizes = flow.map(({ k, i }) => {
    const raw = (k.layout?.flex ?? 0) > 0 ? freeMain * k.layout!.flex! / totalFlex : mainOf(sizes[i]!);
    return mainOf(constrain(k, dir === 'row' ? { w: raw, h: sizes[i]!.h } : { w: sizes[i]!.w, h: raw }));
  });
  const usedMain = mainSizes.reduce((s, size) => s + size, 0) + totalGap;
  const remaining = Math.max(0, mainAvail - usedMain);
  const justify = c.justify ?? 'start';
  const leading = justify === 'center' ? remaining / 2 : justify === 'end' ? remaining : justify === 'around' ? remaining / (2 * Math.max(1, flow.length)) : justify === 'evenly' ? remaining / (flow.length + 1) : 0;
  const extraGap = justify === 'between' && flow.length > 1 ? remaining / (flow.length - 1) : justify === 'around' ? remaining / Math.max(1, flow.length) : justify === 'evenly' ? remaining / (flow.length + 1) : 0;
  let cursor = (dir === 'row' ? innerX : innerY) + leading;
  flow.forEach(({ k, i }, flowIndex) => {
    const mainSize = mainSizes[flowIndex]!;
    const intrinsicCross = dir === 'row' ? sizes[i]!.h : sizes[i]!.w;
    const explicitCross = dir === 'row' ? k.layout?.height : k.layout?.width;
    const rawCross = align === 'stretch' && explicitCross === undefined ? crossAvail : intrinsicCross;
    const crossSize = dir === 'row' ? constrain(k, { w: mainSize, h: rawCross }).h : constrain(k, { w: rawCross, h: mainSize }).w;
    const centeredWidth = dir === 'column' && k.layout?.maxWidth !== undefined;
    const crossOff = centeredWidth ? Math.max(0, crossAvail - crossSize) / 2 : align === 'center' ? (crossAvail - crossSize) / 2 : align === 'end' ? crossAvail - crossSize : 0;
    const r: Rect = dir === 'row'
      ? { x: cursor, y: innerY + crossOff, w: mainSize, h: crossSize }
      : { x: innerX + crossOff, y: cursor, w: crossSize, h: mainSize };
    arrange(k, r, measure, out);
    cursor += mainSize + gap + extraGap;
  });
}

/**
 * 解出整棵树的盒子坐标。根节点默认占满 viewport（除非显式 width/height）。
 * @returns Map<节点 id, {x,y,w,h}>（绝对坐标·像素）
 */
export function solveLayout(root: LayoutNode, viewport: Size, measure: MeasureFn): Map<string, Rect> {
  const out = new Map<string, Rect>();
  assertParentAnchorTree(root);
  const c = root.layout ?? {};
  const size = constrain(root, { w: c.width ?? viewport.w, h: c.height ?? viewport.h });
  const rect = c.parentAnchor
    ? solveParentAnchor({ x: 0, y: 0, ...viewport }, intrinsic(root, measure), c)
    : { x: c.x ?? (c.maxWidth !== undefined ? Math.max(0, viewport.w - size.w) / 2 : 0), y: c.y ?? 0, ...size };
  arrange(root, rect, measure, out);
  return out;
}
