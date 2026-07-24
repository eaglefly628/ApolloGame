// game101 · S1 主界面 —— buildS1(): LayoutNode（GD 布局稿 layout/s1.layout.json 移植·数据一致）。
//
// UI 铁律：全 LayoutNode 闭集控件（Screen/Panel/Label/Button/Avatar/Badge/ProgressBar）·纯数据·零手写 DOM。
// buildS1()=静态稿（validate 测/audit 用）。buildS1Live(state)=**活板**：把引擎世界态投影进这张漂亮 S1——
//   板格显真物品 Twemoji（合并即变）、生成器格可点（Panel.action→信号→sim）、HUD 体力/金币绑真资源。
//   玩法+美术**结合**：同一张 GD 漂亮界面，板是活的（点生成器产出→自动合并·体力/金币实时）。
import type { LayoutNode } from '@ui/components/types.js';
import s1Tree from './layout/s1.layout.json';

export function buildS1(): LayoutNode {
  return s1Tree as unknown as LayoutNode;
}

// ── 活板投影 ─────────────────────────────────────────────────────────────────
export interface CellView { emoji: string; gen?: string } // gen=生成器 id（可点·发 tap_<id> 信号）
export interface S1State { energy: number; coins: number; cells: (CellView | null)[] }

type Node = Record<string, unknown> & { id?: string; type?: string; props?: Record<string, unknown>; children?: Node[]; layout?: Record<string, unknown> };

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }
function find(n: Node, id: string): Node | null {
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const r = find(c, id); if (r) return r; }
  return null;
}

// 把静态 S1 的板格/HUD 用世界态改写：board-grid 换成活格、hud 体力条/金币绑真值。
export function buildS1Live(state: S1State): LayoutNode {
  const tree = clone(s1Tree) as unknown as Node;

  // 板格：取原格 layout 作模板（保观感一致），按 state.cells 重建 63 格。
  const grid = find(tree, 'board-grid');
  if (grid) {
    const tmpl = (grid.children?.[0]?.layout ?? { align: 'center', justify: 'center', padding: 6, radius: 12, height: 154 }) as Record<string, unknown>;
    grid.children = state.cells.map((cv, i) => {
      const props: Record<string, unknown> = cv?.gen ? { bg: 'gold', action: `tap_${cv.gen}` } : { bg: 'panel' };
      const kids: Node[] = cv ? [{ type: 'Label', id: `t-live-${i}-l`, props: { text: cv.emoji, size: 96 } }] : [];
      return { type: 'Panel', id: `t-live-${i}`, props, layout: { ...tmpl }, children: kids } as Node;
    });
  }

  // HUD 实时绑定：体力条 value、金币值。
  const bar = find(tree, 'hud-e-bar');
  if (bar && bar.props) bar.props['value'] = Math.round(state.energy);
  const coin = find(tree, 'hud-coin-v');
  if (coin && coin.props) coin.props['text'] = String(Math.round(state.coins));

  return tree as unknown as LayoutNode;
}
