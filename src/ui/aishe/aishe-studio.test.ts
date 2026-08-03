// @vitest-environment happy-dom
// 爱诗工作室 kit 守卫（owner 2026-07·可复用 drop-in）：8 模式齐 + 合法 LayoutNode + 组装方法确定式 + 状态流。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@ui/components/index.js';
import {
  buildAisheStudio, composeAishePrompt, aisheOptsForMode, modeById,
  AISHE_MODES, INITIAL_AISHE_STUDIO, type AisheStudioState,
} from './index.js';

function types(node: LayoutNode, acc = new Set<string>()): Set<string> {
  acc.add(node.type);
  for (const c of node.children ?? []) types(c, acc);
  return acc;
}
function findId(node: LayoutNode, id: string): LayoutNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const h = findId(c, id); if (h) return h; }
  return null;
}

describe('爱诗工作室 Kit', () => {
  it('8 种输出模式齐·各带画幅/时长/后缀（第八个菜单）', () => {
    expect(AISHE_MODES.length).toBe(8);
    expect(AISHE_MODES.map((m) => m.id)).toEqual(['opening', 'share', 'transition', 'avatar', 'preview', 'invite', 'cover', 'trophy']);
    for (const m of AISHE_MODES) {
      expect(m.aspect).toMatch(/^\d+:\d+$/);
      expect(m.seconds).toBeGreaterThan(0);
      expect(m.suffix).toBeTruthy();
    }
    expect(modeById('nope').id).toBe('opening'); // 未知 id 回退首模式
  });

  it('composeAishePrompt / aisheOptsForMode 确定式（可复用方法）', () => {
    const p = composeAishePrompt({ subject: '赵子龙', style: '国风', motion: '挑枪' }, 'share');
    expect(p).toContain('赵子龙'); expect(p).toContain('挑枪');
    expect(p).toContain(modeById('share').suffix);
    expect(p).toContain('9:16');
    expect(aisheOptsForMode('cover')).toEqual({ aspect: '16:9', seconds: 3 });
    expect(aisheOptsForMode('avatar', 7)).toEqual({ aspect: '1:1', seconds: 4, seed: 7 });
  });

  it('buildAisheStudio 是合法 LayoutNode（多态·含 Video/模式卡/状态）·零 issue', () => {
    const base = INITIAL_AISHE_STUDIO;
    const states: AisheStudioState[] = [
      base,
      { ...base, mode: 'cover' },
      { ...base, generating: true },
      { ...base, handle: { id: 'x', status: 'ready', prompt: 'p', url: 'about:aishe#1' } },
      { ...base, handle: { id: 'x', status: 'pending', prompt: 'p' } },
      { ...base, handle: { id: 'x', status: 'error', prompt: 'p', error: '超时' } },
    ];
    for (const s of states) {
      const node = buildAisheStudio(s);
      expect(validateLayoutNode(node)).toEqual([]);
      expect(types(node).has('Video')).toBe(true);
      // 选中模式卡带金边高亮
      const card = findId(node, `aishe-mode-${s.mode}`)!;
      expect((card.props as { edge?: string }).edge).toBe('gold');
    }
  });

  it('就绪句柄 → Video.src 接 url；未就绪 → 无 src（走占位海报）', () => {
    const ready = findId(buildAisheStudio({ ...INITIAL_AISHE_STUDIO, handle: { id: 'x', status: 'ready', prompt: 'p', url: 'u1' } }), 'aishe-video')!;
    expect((ready.props as { src?: string }).src).toBe('u1');
    const pending = findId(buildAisheStudio({ ...INITIAL_AISHE_STUDIO, handle: { id: 'x', status: 'pending', prompt: 'p' } }), 'aishe-video')!;
    expect((pending.props as { src?: string }).src).toBeUndefined(); // pending 不接 url（避免播空）
  });
});
