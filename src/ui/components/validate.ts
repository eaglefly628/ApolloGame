// UI 数据校验器（owner 2026-06-26·配 catalog.ts）：拿自描述目录验任意 LayoutNode 树。
// 弱模型产废数据时挡住、给具体反馈（未知组件 / 缺必填 / 错枚举 / children 规则 / 缺 id）。
// 这是「约束式数据合成」的 validate 环——和 catalog（喂 schema）+ sample（给范例）合成那台让弱模型也产对数据的机器。
//
// 纪律：lenient on 未列字段（目录字段表可增量补全，不误报未列的合法字段）；只验目录明确声明的 schema。

import type { LayoutNode } from './types.js';
import { catalogSpec } from './catalog.js';

export interface UiIssue {
  path: string;   // 节点路径（如 root/children[2]/bubble），定位用
  type: string;   // 组件 type
  kind: 'unknown-type' | 'missing-required' | 'bad-enum' | 'children-rule' | 'missing-id';
  detail: string;
}

// 视觉特效合集（layout.fx）闭集：kind/color 枚举·防拼错与注入（与 types.ts EffectKind/EffectColor 同源）。
const FX_KINDS = new Set(['pulse', 'float', 'shake', 'pop', 'glow', 'sheen', 'flash']);
const FX_COLORS = new Set(['danger', 'gold', 'jade', 'warn', 'ok', 'white']);

/** 验一棵 LayoutNode 树（递归 children + node 型 props），返回全部 issue（空=合法）。 */
export function validateLayoutNode(node: LayoutNode, path = 'root'): UiIssue[] {
  const issues: UiIssue[] = [];
  if (!node || typeof node !== 'object') {
    issues.push({ path, type: String((node as { type?: string } | null)?.type), kind: 'unknown-type', detail: '节点非对象' });
    return issues;
  }
  const t = node.type as string;
  if (!node.id) issues.push({ path, type: t, kind: 'missing-id', detail: '缺 id（mountUI diff / 引导锚点都需要每节点有 id）' });

  const spec = catalogSpec(t);
  if (!spec) {
    issues.push({ path, type: t, kind: 'unknown-type', detail: `未知组件 type:'${t}'（不在 UI_CATALOG·拼写错或该组件没建）` });
    return issues; // 类型未知 → 后续字段无从验
  }

  const props = (node.props ?? {}) as Record<string, unknown>;
  for (const ps of spec.props) {
    const v = props[ps.name];
    if (ps.required && (v === undefined || v === null)) {
      issues.push({ path, type: t, kind: 'missing-required', detail: `缺必填 props.${ps.name}（${ps.describe}）` });
    }
    if (ps.type === 'enum' && v !== undefined && ps.values && !ps.values.includes(String(v))) {
      issues.push({ path, type: t, kind: 'bad-enum', detail: `props.${ps.name}='${String(v)}' 非法·合法值: ${ps.values.join(' | ')}` });
    }
    // enum-or-number：数字直接放行（裸 px 精确档）；非数字仍须命中具名闭集（拦令牌拼写错）。
    if (ps.type === 'enum-or-number' && v !== undefined && typeof v !== 'number' && ps.values && !ps.values.includes(String(v))) {
      issues.push({ path, type: t, kind: 'bad-enum', detail: `props.${ps.name}='${String(v)}' 非法·合法值: ${ps.values.join(' | ')} 或裸 px 数字` });
    }
  }

  // layout.fx 闭集校验（视觉特效合集·kind/color 枚举·受控合成防拼错/注入）
  const fx = (node.layout as { fx?: Array<{ kind?: string; color?: string }> } | undefined)?.fx;
  if (Array.isArray(fx)) {
    fx.forEach((e, i) => {
      if (!e || !FX_KINDS.has(String(e.kind))) {
        issues.push({ path, type: t, kind: 'bad-enum', detail: `layout.fx[${i}].kind='${String(e?.kind)}' 非法·合法值: ${[...FX_KINDS].join(' | ')}` });
      }
      if (e?.color !== undefined && !FX_COLORS.has(String(e.color))) {
        issues.push({ path, type: t, kind: 'bad-enum', detail: `layout.fx[${i}].color='${String(e.color)}' 非法·合法值: ${[...FX_COLORS].join(' | ')}` });
      }
    });
  }

  // children 规则
  const kids = node.children;
  if (spec.children === 'none' && kids && kids.length > 0) {
    issues.push({ path, type: t, kind: 'children-rule', detail: `${t} 不收 children（内容应放 props）` });
  }
  if (spec.children === 'required' && (!kids || kids.length === 0)) {
    issues.push({ path, type: t, kind: 'children-rule', detail: `${t} 必须有 children（Tabs 每页 / Tooltip·ContextMenu 的触发元素）` });
  }

  // 递归：子节点 + node 型 props（backFace / bubble）
  kids?.forEach((ch, i) => issues.push(...validateLayoutNode(ch, `${path}/children[${i}]`)));
  for (const ps of spec.props) {
    if (ps.type === 'node') {
      const sub = props[ps.name] as LayoutNode | undefined;
      if (sub && typeof sub === 'object' && (sub as LayoutNode).type) {
        issues.push(...validateLayoutNode(sub, `${path}/${ps.name}`));
      }
    }
  }
  return issues;
}

/** 便捷：树是否合法（零 issue）。 */
export function isValidLayoutNode(node: LayoutNode): boolean {
  return validateLayoutNode(node).length === 0;
}
