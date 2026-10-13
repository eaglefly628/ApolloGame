import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { MAX_OXEN, type ScenarioControlState } from './scenario-controls';

const FLOW_LABELS = { off: '关闭', vertical: '牛群纵向', horizontal: '牛群横向', cart: '大车横向' } as const;

export function buildControls(state: ScenarioControlState): LayoutNode {
  return {
    type: 'Panel', id: 'crowd-controls', props: { bg: 'panel', edge: 'gold' },
    layout: { x: 16, y: 16, width: 334, direction: 'column', gap: 9, padding: 14 },
    children: [
      { type: 'Label', id: 'controls-title', props: { text: '穿插规避 · 压力测试', size: 'sm', color: 'text', bold: true } },
      { type: 'Label', id: 'agent-count', props: { text: `${state.oxen} 头牛  ·  1 辆大车`, size: 'lg', color: 'text', bold: true } },
      { type: 'Label', id: 'test-hint', props: { text: `每次增减 4 头 · 上限 ${MAX_OXEN} 头`, size: 'xs', color: 'sub' } },
      { type: 'Panel', id: 'agent-buttons', props: { bare: true }, layout: { direction: 'row', gap: 8 }, children: [
        { type: 'Button', id: 'agent-add', props: { label: '+ 4', kind: 'ghost', action: 'scenario.add', disabled: state.oxen >= MAX_OXEN }, layout: { width: 88, press3d: true } },
        { type: 'Button', id: 'agent-remove', props: { label: '− 4', kind: 'ghost', action: 'scenario.remove', disabled: state.oxen === 0 }, layout: { width: 88, press3d: true } },
        { type: 'Button', id: 'agent-double', props: { label: '× 2', kind: 'ghost', action: 'scenario.double', disabled: state.oxen >= MAX_OXEN }, layout: { width: 88, press3d: true, fx: [{ kind: 'sheen-hover' }] } },
      ] },
      { type: 'Button', id: 'line-toggle', props: { label: state.linesVisible ? '隐藏路线与规避矢量' : '显示路线与规避矢量', kind: 'ghost', action: 'scenario.lines' }, layout: { width: 294, press3d: true } },
      ...(state.linesVisible ? [
        { type: 'Label' as const, id: 'rvo-legend', props: { text: 'RVO：青意图 · 橙原解 · 绿采用 · 紫修正', size: 'xs' as const, color: 'sub' as const } },
      ] : []),
      { type: 'Button', id: 'flow-toggle', props: { label: `流场方向：${FLOW_LABELS[state.flowView]}`, kind: 'ghost', action: 'scenario.flow' }, layout: { width: 294, press3d: true } },
      ...(state.flowView === 'off' ? [] : [
        { type: 'Label' as const, id: 'flow-legend', props: { text: `亮箭头=路面 cost 1 · 灰箭头=场地 cost 2`, size: 'xs' as const, color: 'sub' as const } },
        { type: 'Label' as const, id: 'cost-legend', props: { text: `橙框=A*占用每单位 +${Math.round(state.occupancyPenalty * 100)}% · ${state.occupancyMarks} 格`, size: 'xs' as const, color: 'sub' as const } },
      ]),
    ],
  };
}
