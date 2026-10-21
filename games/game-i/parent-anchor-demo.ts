// 父锚点活范例：一份数据，九点 + 嵌套父画布 + 单轴伸缩。
import type { AnchorPreset, LayoutNode } from '@zerocraft/engine/ui/components/index.js';

export function buildParentAnchorDemo(): LayoutNode {
  const presets: AnchorPreset[] = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  return {
    type: 'Panel', id: 'parent-anchor-demo', props: { bare: true }, layout: { direction: 'column', gap: 16 }, children: [
      { type: 'Label', id: 'anchor-intro', props: { text: '父锚点 · 九点预设 / 独立 Pivot / 嵌套与伸缩', size: 'lg', color: 'text' } },
      { type: 'Label', id: 'anchor-help', props: { text: '缩放窗口观察边距；点击「锚点 Debug」后点选控件，Esc 退出。', color: 'sub' } },
      { type: 'Panel', id: 'anchor-nine', props: { bare: true, bg: 'sunken' }, layout: { direction: 'overlay', height: 240 }, children: presets.map((preset, i) => ({
        type: 'Button', id: `anchor-nine-${preset}`, props: { label: ['左上', '上中', '右上', '左中', '中心', '右中', '左下', '下中', '右下'][i], action: 'anchorDemo', kind: 'ghost' },
        layout: { width: 88, height: 44, parentAnchor: { preset, offset: { x: i % 3 === 0 ? 12 : i % 3 === 2 ? -12 : 0, y: i < 3 ? 12 : i > 5 ? -12 : 0 } } },
      })) },
      { type: 'Panel', id: 'anchor-nested-stage', props: { bare: true, bg: 'sunken' }, layout: { direction: 'overlay', height: 220 }, children: [
        { type: 'Panel', id: 'anchor-nested-parent', props: { bare: true, bg: 'raised' }, layout: {
          direction: 'overlay', height: 160, parentAnchor: { anchorMin: { x: 0, y: .5 }, anchorMax: { x: 1, y: .5 }, insets: { left: 20, right: 20 }, pivot: { x: .5, y: .5 } },
        }, children: [
          { type: 'Label', id: 'anchor-nested-title', props: { text: '这是直接父画布', color: 'text' }, layout: { width: 160, height: 24, parentAnchor: { preset: 'top-left', offset: { x: 12, y: 12 } } } },
          { type: 'Button', id: 'anchor-nested-button', props: { label: '距父右下 12', action: 'anchorDemo', kind: 'ghost' }, layout: { width: 140, height: 44, parentAnchor: { preset: 'bottom-right', offset: { x: -12, y: -12 } } } },
          { type: 'Panel', id: 'anchor-stretch-bar', props: { bg: 'gold' }, layout: { height: 8, padding: 0, parentAnchor: { anchorMin: { x: 0, y: .5 }, anchorMax: { x: 1, y: .5 }, insets: { left: 12, right: 12 } } } },
        ] },
      ] },
    ],
  };
}
