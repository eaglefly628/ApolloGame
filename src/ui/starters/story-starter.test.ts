// @vitest-environment happy-dom
// 剧情起手屏守卫（REQ-DIALOGUE M4·PUI 半）：合法闭集 + 三件 bind 就位 + resolveDialogue 投影后信号全通 + 复制即跑挂载。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, renderNode, resolveDialogue, resolveBindings, mountUI, type LayoutNode, type DialogueSource, type UIDataSource } from '@ui/components/index.js';
import { STARTER_THEME, buildStoryStarter } from './index.js';

function types(n: LayoutNode, acc = new Set<string>()): Set<string> { acc.add(n.type); for (const c of n.children ?? []) types(c, acc); return acc; }

// 桩源：当前停在 choice 节点·带情绪/立绘图/选项（含门控项）。
const view = {
  kind: 'choice' as const, speaker: '林清越', text: '要不要陪我下完这局？', emotion: 'warm', art: 'data:img/warm',
  options: [{ label: '「我来了。」', available: true }, { label: '「握手（需暖场）」', available: false }],
};
const dsrc: DialogueSource = { current: (id) => (id === 'npc' ? view : undefined) };

describe('REQ-DIALOGUE M4 · 剧情起手屏 buildStoryStarter', () => {
  it('合法闭集（validate 零 issue）+ 三件 bind 就位', () => {
    const tree = buildStoryStarter({ dialogueEntityId: 'npc', place: '第三章 · 雨夜书斋', affinityBind: 'aff' });
    expect(validateLayoutNode(tree)).toEqual([]);
    expect(types(tree).has('dialog')).toBe(true);
    expect(types(tree).has('choiceList')).toBe(true);
    expect(types(tree).has('portrait')).toBe(true);
  });

  it('resolveDialogue 投影后：台词/选项/立绘随世界当前节点·信号全通', () => {
    const projected = resolveDialogue(buildStoryStarter({ dialogueEntityId: 'npc' }), dsrc);
    const html = renderNode(projected, STARTER_THEME);
    expect(html).toContain('要不要陪我下完这局');                       // dialog text 投影
    expect(html).toContain('data-action="dialogue.choose" data-arg="0"'); // 可选项发 choose+下标
    expect(html).not.toContain('data-arg="1"');                        // 门控项灰显不发信号
    expect(html).toContain('data:img/warm');                           // 立绘 art 随节点情绪投影（M2 表情链贯通）
  });

  it('好感 pill 走 resolveBindings（bind Resource·活值）', () => {
    const world: Record<string, { current: number }> = { aff: { current: 12 } };
    const ds: UIDataSource = { resource: (id) => world[id] };
    const tree = resolveBindings(buildStoryStarter({ dialogueEntityId: 'npc', affinityBind: 'aff' }), ds);
    expect(renderNode(tree, STARTER_THEME)).toContain('好感 12');
  });

  it('复制即跑：resolveDialogue → mountUI(STARTER_THEME) 不炸·可驱动控件带标签', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const teardown = mountUI(host, resolveDialogue(buildStoryStarter({ dialogueEntityId: 'npc' }), dsrc), {}, STARTER_THEME);
    expect(host.querySelector('[data-action="dialogue.choose"]')).toBeTruthy();
    teardown(); host.remove();
  });
});
