// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 设备外框 helper（所有屏复用·完全对齐 Designer bundle card）
//
//  每屏都是同一台 RP 设备：外框(#0a0810 边框圆角阴影) + 内屏(640×480)。
//  顶部可选 Silkscreen 标签条（对齐 bundle 卡片 data-drags-parent chip）。
//  屏模块只需给 interior(填满 640×480 的 LayoutNode 列表)，外壳一致由此产出。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

export interface ShellOpts {
  id: string;
  /** 顶部 Silkscreen 标签（如「林七月 · 黄昏 · 等你」）。 */
  chip?: string;
  /** 标签右侧强调小字（如「▍LIVE」）。 */
  chipFlag?: string;
  /** 内屏底色（缺省黄昏紫 #15101f；开机等用 #0c0a12）。 */
  interiorBg?: string;
  /** 内屏布局方向（缺省 column）。 */
  direction?: 'row' | 'column';
  /** 内屏 640×480 内的子节点。 */
  interior: LayoutNode[];
  /** 设备外可选工具条（演示按钮等·跟在设备下方）。 */
  footer?: LayoutNode;
}

export function deviceShell(o: ShellOpts): LayoutNode {
  const wrapChildren: LayoutNode[] = [];
  if (o.chip) {
    wrapChildren.push({
      type: 'Panel', id: `${o.id}-chipbar`, props: { bare: true },
      layout: { direction: 'row', gap: 6, align: 'center', width: 640 },
      children: [
        { type: 'Label', id: `${o.id}-chip`, props: { text: o.chip, font: 'pixel', color: 'sub', size: 'xs', tracking: 2 } },
        ...(o.chipFlag ? [{ type: 'Label' as const, id: `${o.id}-chipflag`, props: { text: o.chipFlag, font: 'pixel' as const, color: 'jade' as const, size: 'xs' as const, tracking: 1 } }] : []),
      ],
    });
  }
  wrapChildren.push({
    type: 'Panel', id: `${o.id}-device`, props: { bg: { custom: '#0a0810' } },
    layout: { width: 660, height: 500, padding: 10, direction: 'column' },
    children: [
      {
        type: 'Panel', id: `${o.id}-interior`, props: { bg: o.interiorBg ?? { custom: '#15101f' } },
        layout: { width: 640, height: 480, direction: o.direction ?? 'column' },
        children: o.interior,
      },
    ],
  });
  if (o.footer) wrapChildren.push(o.footer);
  return {
    type: 'Screen', id: o.id, props: { center: true, bg: { custom: '#05060a' } },
    layout: { direction: 'column', padding: 0 },
    children: [
      { type: 'Panel', id: `${o.id}-wrap`, props: { bare: true }, layout: { direction: 'column', gap: 6 }, children: wrapChildren },
    ],
  };
}
