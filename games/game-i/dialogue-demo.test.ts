// VN 对话展台守卫：合法 LayoutNode（validate 零 issue）+ 三件闭集控件在位 + 门控项灰显。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, renderNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { apolloToon } from '@zerocraft/engine/ui/apollo-toon-theme.js';
import { buildDialogueScene } from './dialogue-demo.js';

function types(node: LayoutNode, acc = new Set<string>()): Set<string> {
  acc.add(node.type);
  for (const c of node.children ?? []) types(c, acc);
  return acc;
}

describe('Game I · 剧情 · VN 对话三件', () => {
  it('合法 LayoutNode（validate 零 issue）', () => {
    expect(validateLayoutNode(buildDialogueScene())).toEqual([]);
  });
  it('用上 VN 三件（dialog + choiceList + portrait）', () => {
    const t = types(buildDialogueScene());
    for (const ty of ['dialog', 'choiceList', 'portrait']) expect(t.has(ty)).toBe(true);
  });
  it('渲染成立：台词推进信号 + 选项下标 + 门控项灰显', () => {
    const html = renderNode(buildDialogueScene(), apolloToon);
    expect(html).toContain('data-action="dialogue.advance"');
    expect(html).toContain('data-action="dialogue.choose" data-arg="0"');
    expect(html).toContain('cursor:not-allowed'); // 第三条门控项
  });
});
