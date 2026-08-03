// 爱诗工作室样例（game-i 适配）：薄消费 @ui/aishe kit——视图纯数据（含 Video + 8 模式）+ 端口生成流程。
import { describe, it, expect } from 'vitest';
import { renderNode } from '@zerocraft/engine/ui/components/index.js';
import { buildVideoLab, INITIAL_AISHE, composeAishePrompt, aisheOptsForMode, AISHE_MODES } from './video-lab.js';
import { NullAishePort } from '@zerocraft/engine/services/aigp/index.js';
import { SHELL } from '@zerocraft/engine/ui/shell-theme.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

describe('Game I · 爱诗工作室样例（薄消费 kit）', () => {
  it('视图纯数据·含 Video 控件 + 生成按钮 + 8 模式卡', () => {
    const tree: LayoutNode = buildVideoLab(INITIAL_AISHE);
    const ids: string[] = [];
    const walk = (n: LayoutNode): void => { ids.push(n.id); (n.children ?? []).forEach(walk); };
    walk(tree);
    expect(ids).toContain('aishe-video');
    expect(ids).toContain('aishe-gen');
    for (const m of AISHE_MODES) expect(ids).toContain(`aishe-mode-${m.id}`); // 8 模式卡齐
    const html = renderNode(tree, SHELL);
    expect(html).toContain('<video');
    expect(html).toContain('data-action="aisheGen"');
    expect(html).toContain('data-action="aisheMode"'); // 模式卡发信号
  });

  it('外观 look + 模式 → 组装提示词/选项（可复用方法·确定式）', () => {
    const p = composeAishePrompt({ subject: '赵子龙', style: '国风' }, 'trophy');
    expect(p).toContain('赵子龙');
    expect(p).toContain('成就炫耀'); // trophy 模式后缀
    expect(aisheOptsForMode('transition')).toMatchObject({ aspect: '16:9', seconds: 2 });
    expect(aisheOptsForMode('opening', 42).seed).toBe(42);
  });

  it('NullAishePort：generate(组装提示词) → ready 占位句柄（回显提示词）', async () => {
    const port = new NullAishePort();
    const prompt = composeAishePrompt(INITIAL_AISHE.look, INITIAL_AISHE.mode);
    const h = await port.generate(prompt, aisheOptsForMode(INITIAL_AISHE.mode));
    expect(h.status).toBe('ready');
    expect(h.prompt).toBe(prompt);
    expect(h.url).toBeTruthy();
  });

  it('就绪态视图把句柄 url 接到 Video.src', () => {
    const tree = buildVideoLab({ ...INITIAL_AISHE, handle: { id: 'a1', status: 'ready', prompt: 'p', url: 'about:aishe#1' } });
    expect(renderNode(tree, SHELL)).toContain('src="about:aishe#1"');
  });
});
