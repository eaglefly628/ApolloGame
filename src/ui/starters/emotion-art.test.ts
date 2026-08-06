// 立绘/表情链守卫（REQ-DIALOGUE M2）：emotion→assetKey 表 + 分级降级（exact→neutral→none·绝不空白）+ resolver 接线。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode } from '@ui/components/index.js';
import { resolveEmotionArt, emotionArtResolver, SAMPLE_EMOTION_ART, buildPresence, type EmotionArtTable } from './index.js';

const T: EmotionArtTable = { A: { neutral: 'a/neu', happy: 'a/happy' } };

describe('REQ-DIALOGUE M2 · 立绘/表情链', () => {
  it('命中指定情绪 → exact + 对应 key', () => {
    expect(resolveEmotionArt(T, 'A', 'happy')).toEqual({ key: 'a/happy', fallback: 'exact' });
  });
  it('情绪缺 → 降级到角色 neutral 锚', () => {
    expect(resolveEmotionArt(T, 'A', 'furious')).toEqual({ key: 'a/neu', fallback: 'neutral' });
  });
  it('无情绪参数 → 也走 neutral（idle 无表情）', () => {
    expect(resolveEmotionArt(T, 'A')).toEqual({ key: 'a/neu', fallback: 'neutral' });
  });
  it('角色无表 → none（无 key·portrait 出占位·绝不报错）', () => {
    expect(resolveEmotionArt(T, 'Nobody', 'happy')).toEqual({ fallback: 'none' });
  });
  it('连 neutral 都缺 → none（不空白）', () => {
    expect(resolveEmotionArt({ B: { happy: 'b/h' } }, 'B', 'sad')).toEqual({ fallback: 'none' });
  });
  it('确定性：同输入 → 同输出（无随机）', () => {
    expect(resolveEmotionArt(SAMPLE_EMOTION_ART, '林清越', 'shy')).toEqual(resolveEmotionArt(SAMPLE_EMOTION_ART, '林清越', 'shy'));
  });

  it('emotionArtResolver：emotion → key → resolveAsset(URL)（缺图 → undefined 占位）', () => {
    const assets: Record<string, string> = { 'a/happy': 'https://x/happy.png' }; // a/neu 故意缺图
    const r = emotionArtResolver(T, 'A', (k) => assets[k]);
    expect(r('happy')).toBe('https://x/happy.png');   // exact + 有图
    expect(r('furious')).toBeUndefined();             // 降级到 a/neu·但 a/neu 无图 → undefined（portrait 占位）
  });

  it('buildPresence 接 resolveArt：按情绪填立绘 art（分级降级链贯通）', () => {
    const assets: Record<string, string> = { 'lin/happy': 'data:img/happy', 'lin/neutral': 'data:img/neu' };
    const resolveArt = emotionArtResolver(SAMPLE_EMOTION_ART, '林清越', (k) => assets[k]);
    const happy = buildPresence({ name: '林清越', reaction: { emotion: 'happy', line: '赢了！' }, resolveArt });
    const por = happy.children!.find((c) => c.type === 'portrait')!;
    expect((por.props as { art?: string }).art).toBe('data:img/happy'); // exact 情绪出图
    // 情绪缺图（excited 无 asset）→ 降级 neutral 有图 → 出 neutral 图。
    const ex = buildPresence({ name: '林清越', reaction: { emotion: 'excited', line: '哇' }, resolveArt });
    const por2 = ex.children!.find((c) => c.type === 'portrait')!;
    expect((por2.props as { art?: string }).art).toBe('data:img/neu');
    expect(validateLayoutNode(happy)).toEqual([]);
  });
});
