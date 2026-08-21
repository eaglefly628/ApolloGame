// 起手组合助手 · Tiles（查缺补漏 #6·owner 2026-08-21「扩建 2D UI」）。
//
// 背景：ItemSlot（稀有边 + 数量角标 + 冷却 + 图标）与 StatTile（大数 + 副标）是**跨游戏反复手搓**的原语簇——
//   game101 订单槽 / game102 炮槽 / game-a 收藏格 / game108 duel stat 各拼一遍。按 manifesto**不加新 ComponentType**
//   （Panel+Image+Badge+ProgressBar+Label 已能拼），改给**官方 builder** 去重：产的仍是纯 LayoutNode 数据·控件闭集。
// 红线不破：返回值是数据·写世界=action 信号·无自由 DOM/CSS。
import type { LayoutNode } from '@ui/components/index.js';

type EdgeColor = 'jade' | 'gold' | 'ok' | 'warn' | 'danger' | 'mine' | 'foe';
type Tone = 'accent' | 'gold' | 'ok' | 'warn' | 'danger';

/** 库存/道具/技能槽：稀有框 + 图标 + 数量角标 + 可选冷却遮罩 + 选中高亮。整槽可点（action 信号）。 */
export interface ItemSlotSpec {
  id: string;
  icon?: string;            // 已解析图 URL（道具/技能图）·缺省=占位
  count?: number;           // 数量角标（>1 才显·1/0 不显）
  edge?: EdgeColor;         // 稀有/阵营框色（闭集令牌）
  cooldown?: string;        // 冷却显示（如 '3' / '2.5s'）→ 暗遮罩 + 居中大字；缺省=无冷却
  label?: string;           // 底部名（缺省无）
  size?: number;            // 槽边长 px（缺省 64）
  action?: string; actionArg?: string; // 整槽点击信号
  selected?: boolean;       // 选中态（金光 glow）
  empty?: boolean;          // 空槽（虚线框·忽略 icon）
}

/** 组合出一个库存/技能槽（Panel 框 + Image 图 + 数量 Badge + 冷却遮罩 + 选中 glow）。 */
export function buildItemSlot(s: ItemSlotSpec): LayoutNode {
  const size = s.size ?? 64;
  const children: LayoutNode[] = [];
  if (!s.empty && s.icon) {
    children.push({ type: 'Image', id: `${s.id}-img`, props: { src: s.icon, fit: 'contain' }, layout: { width: size - 12, height: size - 12 } });
  }
  // 数量角标（右下·绝对定位·intent 叠层豁免 audit 重叠）。
  if (s.count !== undefined && s.count > 1) {
    children.push({ type: 'Badge', id: `${s.id}-n`, props: { text: `×${s.count}`, tone: 'ok' }, layout: { x: size - 26, y: size - 18, allowOverlap: true } });
  }
  // 冷却遮罩（暗层 + 居中读数）——absolute 铺满槽。
  if (s.cooldown) {
    children.push({
      type: 'Panel', id: `${s.id}-cd`, props: { bg: { custom: 'rgba(0,0,0,0.55)' } },
      layout: { x: 0, y: 0, width: size, height: size, align: 'center', justify: 'center', allowOverlap: true, radius: 10 },
      children: [{ type: 'Label', id: `${s.id}-cd-t`, props: { text: s.cooldown, size: 'lg', bold: true, color: 'text', font: 'round' } }],
    });
  }
  const slot: LayoutNode = {
    type: 'Panel', id: s.id,
    props: {
      ...(s.edge ? { edge: s.edge } : {}),
      ...(s.empty ? { dashed: true } : {}),
      ...(s.action ? { action: s.action, ...(s.actionArg ? { actionArg: s.actionArg } : {}) } : {}),
      bg: 'sunken',
    },
    layout: {
      width: size, height: size, align: 'center', justify: 'center', radius: 10,
      ...(s.selected ? { fx: [{ kind: 'glow' as const, color: 'gold' as const }] } : {}),
    },
    children,
  };
  if (!s.label) return slot;
  // 带底部名 → 竖排包一层 bare Panel。
  return {
    type: 'Panel', id: `${s.id}-wrap`, props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 4 },
    children: [slot, { type: 'Label', id: `${s.id}-lb`, props: { text: s.label, size: 'sm', color: 'sub' } }],
  };
}

/** 数值瓦片（大数 + 副标·计分/资源/结算常见）。tone 染大数·icon 可选前缀图。 */
export interface StatTileSpec {
  id: string;
  value: string;            // 大数（已格式化的串）
  label: string;            // 副标
  tone?: Tone;              // 大数色（accent/gold/ok/warn/danger·缺省 text）
  icon?: string;            // 已解析图 URL（副标前）·缺省无
  shadow?: number;          // Panel 硬边浮空投影 y（缺省无·填如 4 得卡通浮空）
}

const TONE_COLOR: Record<string, 'jade' | 'gold' | 'ok' | 'warn' | 'danger'> = {
  accent: 'jade', gold: 'gold', ok: 'ok', warn: 'warn', danger: 'danger',
};

/** 组合出一个数值瓦片（Panel + 大数 Label + 副标 Label·数字走 round 圆润字）。 */
export function buildStatTile(s: StatTileSpec): LayoutNode {
  const numColor = s.tone ? TONE_COLOR[s.tone] : 'text';
  const sub: LayoutNode = { type: 'Label', id: `${s.id}-lb`, props: { text: s.label, size: 'sm', color: 'sub', ...(s.icon ? { spans: [{ text: s.label, img: s.icon }] } : {}) } };
  return {
    type: 'Panel', id: s.id,
    props: { bg: 'raised', ...(s.shadow ? { shadow: { y: s.shadow } } : {}) },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 2, padding: 12, radius: 12 },
    children: [
      { type: 'Label', id: `${s.id}-v`, props: { text: s.value, size: 'xxl', bold: true, color: numColor, font: 'round' } },
      sub,
    ],
  };
}
