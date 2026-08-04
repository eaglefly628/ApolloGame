// 剧情/VN 三件点名测试（REQ-DIALOGUE M1）：闭集 validate 零 issue + 渲染成立 + resolveDialogue 结构投影 + 可选性门控。
import { describe, it, expect } from 'vitest';
import {
  validateLayoutNode, renderNode, resolveDialogue,
  type LayoutNode, type DialogueSource, type DialogueView,
} from './index.js';
import { apolloToon } from '../apollo-toon-theme.js';

// 一幕组合场景：立绘 + 台词 + 选项（含一条不可选门控项）。
function scene(): LayoutNode {
  return {
    type: 'Panel', id: 'vn', props: { bare: true }, layout: { direction: 'column', gap: 12 },
    children: [
      { type: 'portrait', id: 'vn-por', props: { name: '林清越', emotion: 'warm', side: 'left' }, layout: { width: 120, height: 168 } },
      { type: 'dialog', id: 'vn-say', props: { speaker: '林清越', text: '你终于来了。', emotion: 'warm', kind: 'line' } },
      { type: 'choiceList', id: 'vn-pick', props: { options: [
        { label: '坦白心意' }, { label: '岔开话题' }, { label: '沉默（需好感 ≥ 10）', available: false },
      ] } },
    ],
  };
}

describe('REQ-DIALOGUE M1 · VN 三件', () => {
  it('闭集合法（validate 零 issue·三件全在目录）', () => {
    expect(validateLayoutNode(scene())).toEqual([]);
  });

  it('未知枚举被 validate 挡（kind/side 闭集）', () => {
    const bad: LayoutNode = { type: 'dialog', id: 'd', props: { kind: 'monologue' as never } };
    expect(validateLayoutNode(bad).some((i) => i.kind === 'bad-enum')).toBe(true);
  });

  it('渲染成立（说话人/台词/推进信号/选项下标）', () => {
    const html = renderNode(scene(), apolloToon);
    expect(html).toContain('林清越');
    expect(html).toContain('你终于来了');
    expect(html).toContain('data-action="dialogue.advance"'); // line 节点整框可点推进
  });

  it('choiceList 可选项发 dialogue.choose+下标·不可选项灰显无信号', () => {
    const html = renderNode(scene(), apolloToon);
    expect(html).toContain('data-action="dialogue.choose" data-arg="0"');
    expect(html).toContain('data-arg="1"');
    expect(html).not.toContain('data-arg="2"'); // 第三项 available:false → 不发信号
    expect(html).toContain('cursor:not-allowed');
  });

  it('choice 节点 dialog 不发推进信号（推进交给 choiceList）', () => {
    const html = renderNode({ type: 'dialog', id: 'd', props: { speaker: 'A', text: '选一个', kind: 'choice' } }, apolloToon);
    expect(html).not.toContain('data-action');
  });

  it('立绘缺图→占位不空白（名首字）', () => {
    const html = renderNode({ type: 'portrait', id: 'p', props: { name: '林清越' } }, apolloToon);
    expect(html).toContain('林'); // 名首字占位（缺 art 不空白）
  });

  it('resolveDialogue 结构投影（读世界填 speaker/text/options + 逐项可选性）', () => {
    // 桩数据源：模拟一个当前处于 choice 节点、含门控项的对话实体。
    const view: DialogueView = {
      kind: 'choice', speaker: '沈墨', text: '你想怎么做？', emotion: 'tense',
      options: [{ label: '进攻', available: true }, { label: '智取（需智力 ≥ 8）', available: false }],
    };
    const dsrc: DialogueSource = { current: (id) => (id === 'npc-1' ? view : undefined) };
    const tree: LayoutNode = {
      type: 'Panel', id: 'r', props: { bare: true }, children: [
        { type: 'dialog', id: 'say', props: { bind: 'npc-1', speaker: '占位', text: '占位' } },
        { type: 'choiceList', id: 'pick', props: { bind: 'npc-1' } },
        { type: 'portrait', id: 'por', props: { bind: 'npc-1' } },
      ],
    };
    const out = resolveDialogue(tree, dsrc);
    const say = out.children![0].props as { speaker?: string; text?: string; kind?: string; emotion?: string };
    const pick = out.children![1].props as { options?: Array<{ label: string; available?: boolean }> };
    const por = out.children![2].props as { name?: string; emotion?: string };
    expect(say.speaker).toBe('沈墨');
    expect(say.text).toBe('你想怎么做？');
    expect(say.kind).toBe('choice');
    expect(pick.options).toEqual([{ label: '进攻', available: true }, { label: '智取（需智力 ≥ 8）', available: false }]);
    expect(por.name).toBe('沈墨');           // 立绘名投影自 speaker
    expect(por.emotion).toBe('tense');

    // 投影后渲染：门控项灰显无信号，仍是零 validate issue。
    expect(validateLayoutNode(out)).toEqual([]);
    const html = renderNode(out, apolloToon);
    expect(html).toContain('data-action="dialogue.choose" data-arg="0"');
    expect(html).not.toContain('data-arg="1"'); // 智取不可选
  });

  it('bind 未命中→原 literal props 透传（安全默认·不误删/不报错）', () => {
    const dsrc: DialogueSource = { current: () => undefined };
    const node: LayoutNode = { type: 'dialog', id: 'd', props: { bind: 'ghost', speaker: '默认', text: '默认台词' } };
    const out = resolveDialogue(node, dsrc);
    expect((out.props as { speaker?: string }).speaker).toBe('默认');
  });
});
