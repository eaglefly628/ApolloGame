import { describe, it, expect } from 'vitest';
import {
  resolveChain, selectClip, canCutClean, preloadCandidates, validateCatalog, isPlayable,
  poseIn, poseOut, type VideoClip, type VideoClipCatalog,
} from './video-clips.js';

// REQ-112-ENG-11 纯核。钉的是「不需要 DOM/网络就能判对错」的四件：
// 回退链的**顺序与全序** · 审核门 · **链尾必达** · 换片能不能直切。
// 播放器本身（<video> 就地换 src / ended 信号）在 UI 面钉，见 src/ui/components。

const C = (over: Partial<VideoClip> & { clipKey: string; state: string }): VideoClip =>
  ({ ticks: 30, review: 'approved', ...over });

const CAT = (over: Partial<VideoClipCatalog> = {}): VideoClipCatalog => ({
  id: 'cat-7',
  clips: [
    C({ clipKey: 'rest-generic', state: 'Rest' }),
    C({ clipKey: 'rest-mine', state: 'Rest', subjectId: 'cat-7' }),
    C({ clipKey: 'pounce-generic', state: 'Pounce' }),
  ],
  baseClipKey: 'base-idle',
  stillRef: 'still-photo',
  ...over,
});

describe('回退链 resolveChain：个性 → 通用 → 声明 fallback → 基础活照片 → 静态图', () => {
  it('★ 五环顺序就是这个顺序（这是单子第 4 条的全部内容）', () => {
    const cat = CAT({
      clips: [
        C({ clipKey: 'rest-generic', state: 'Rest', fallbackClipKey: 'rest-spare' }),
        C({ clipKey: 'rest-mine', state: 'Rest', subjectId: 'cat-7' }),
        C({ clipKey: 'rest-spare', state: 'Rest' }),
      ],
    });
    // 注：rest-spare 自己也是通用片，故它先以 generic 身份进链（同一 ref 不重复入链）
    expect(resolveChain(cat, 'Rest', { subjectId: 'cat-7' })).toEqual([
      { kind: 'personal', ref: 'rest-mine' },
      { kind: 'generic', ref: 'rest-generic' },
      { kind: 'generic', ref: 'rest-spare' },
      { kind: 'base', ref: 'base-idle' },
      { kind: 'still', ref: 'still-photo' },
    ]);
  });

  it('声明式 fallback 指向**非本状态**的片时，作为独立一环进链', () => {
    const cat = CAT({
      clips: [
        C({ clipKey: 'rest-generic', state: 'Rest', fallbackClipKey: 'any-idle' }),
        C({ clipKey: 'any-idle', state: 'Idle' }),
      ],
    });
    expect(resolveChain(cat, 'Rest').map((c) => `${c.kind}:${c.ref}`))
      .toEqual(['generic:rest-generic', 'declared-fallback:any-idle', 'base:base-idle', 'still:still-photo']);
  });

  it('★ 环内按 clipKey 升序，**与数组插入序无关**（不许「看谁先来」）', () => {
    const mk = (keys: string[]): VideoClipCatalog =>
      CAT({ clips: keys.map((k) => C({ clipKey: k, state: 'Rest' })) });
    const want = ['a-clip', 'm-clip', 'z-clip'];
    expect(resolveChain(mk(['z-clip', 'a-clip', 'm-clip']), 'Rest').filter((c) => c.kind === 'generic').map((c) => c.ref)).toEqual(want);
    expect(resolveChain(mk(['a-clip', 'z-clip', 'm-clip']), 'Rest').filter((c) => c.kind === 'generic').map((c) => c.ref)).toEqual(want);
  });

  it('没给 subjectId → 个性片一环都不出（别把别人的猫播出来）', () => {
    expect(resolveChain(CAT(), 'Rest').some((c) => c.kind === 'personal')).toBe(false);
    expect(resolveChain(CAT(), 'Rest', { subjectId: 'cat-99' }).some((c) => c.kind === 'personal')).toBe(false);
  });

  it('未知状态 → 链上只剩兜底两环（base + still），不空手', () => {
    expect(resolveChain(CAT(), 'NoSuchState').map((c) => c.kind)).toEqual(['base', 'still']);
  });
});

describe('审核门（「无自动入库」）：没审过的生成片不许自己爬上画面', () => {
  it('rejected 永不可选，allowPending 也救不了它', () => {
    const rej = C({ clipKey: 'bad', state: 'Rest', review: 'rejected' });
    expect(isPlayable(rej)).toBe(false);
    expect(isPlayable(rej, { allowPending: true })).toBe(false);
  });

  it('★ review 缺省 = pending：默认不播；开 allowPending 才播（开发期）', () => {
    const cat = CAT({ clips: [{ clipKey: 'fresh', state: 'Rest', ticks: 10 }] });   // 没写 review
    expect(resolveChain(cat, 'Rest').some((c) => c.ref === 'fresh')).toBe(false);
    expect(resolveChain(cat, 'Rest', { allowPending: true }).some((c) => c.ref === 'fresh')).toBe(true);
  });
});

describe('选片 selectClip + ★ 链尾必达（断网不黑屏）', () => {
  it('取回退链上第一个就绪的', () => {
    const ready = new Set(['rest-generic', 'base-idle']);
    expect(selectClip(CAT(), 'Rest', { subjectId: 'cat-7', ready })).toEqual({ kind: 'generic', ref: 'rest-generic' });
  });

  it('★ 全链一个都没就绪（= 断网）→ **仍然返回静态图**，不是 null', () => {
    const got = selectClip(CAT(), 'Rest', { subjectId: 'cat-7', ready: new Set<string>() });
    expect(got).toEqual({ kind: 'still', ref: 'still-photo' });
  });

  it('不给 ready 集合 = 无缓存信息 → 不自我降级，照第一顺位走', () => {
    expect(selectClip(CAT(), 'Rest', { subjectId: 'cat-7' })).toEqual({ kind: 'personal', ref: 'rest-mine' });
  });

  it('目录没声明 stillRef 且全不就绪 → null（端口不替调用方编一个出来）', () => {
    const cat = CAT({ stillRef: undefined });
    expect(selectClip(cat, 'Rest', { ready: new Set<string>() })).toBeNull();
  });
});

describe('换片不黑帧 canCutClean：尾姿势 == 首姿势', () => {
  it('对得上可直切；对不上要过渡；缺省姿势都是 neutral', () => {
    const a = C({ clipKey: 'a', state: 'S', poseOut: 'crouch' });
    const b = C({ clipKey: 'b', state: 'S', poseIn: 'crouch' });
    const c = C({ clipKey: 'c', state: 'S', poseIn: 'stand' });
    expect(canCutClean(a, b)).toBe(true);
    expect(canCutClean(a, c)).toBe(false);
    expect(canCutClean(C({ clipKey: 'x', state: 'S' }), C({ clipKey: 'y', state: 'S' }))).toBe(true); // 都缺省 neutral
    expect(poseIn(C({ clipKey: 'x', state: 'S' }))).toBe('neutral');
    expect(poseOut(C({ clipKey: 'x', state: 'S' }))).toBe('neutral');
  });

  it('开场（没有上一片）永远算能切', () => {
    expect(canCutClean(null, C({ clipKey: 'b', state: 'S', poseIn: 'weird' }))).toBe(true);
  });
});

describe('预载 preloadCandidates', () => {
  it('★ 只出**未就绪**的；每状态只押第一顺位；升序；排除静态图', () => {
    const cat = CAT();
    const got = preloadCandidates(cat, ['Pounce', 'Rest'], { subjectId: 'cat-7', ready: new Set(['rest-mine']) });
    expect(got).toEqual(['pounce-generic']);      // Rest 的第一顺位 rest-mine 已就绪 → 不重复拉
    expect(got).not.toContain('still-photo');
  });

  it('limit 封顶（一次别拉爆带宽）·limit=0 出空·小数被 trunc', () => {
    const cat = CAT({
      clips: ['s1', 's2', 's3', 's4'].map((k) => C({ clipKey: `${k}-clip`, state: k })),
      baseClipKey: undefined,
    });
    const states = ['s1', 's2', 's3', 's4'];
    expect(preloadCandidates(cat, states, {}, 2)).toEqual(['s1-clip', 's2-clip']);
    expect(preloadCandidates(cat, states, {}, 0)).toEqual([]);
    expect(preloadCandidates(cat, states, {}, 2.9)).toHaveLength(2);
  });

  it('同一片被多个状态押中只出一次', () => {
    const cat = CAT({ clips: [C({ clipKey: 'shared', state: 'A' }), C({ clipKey: 'shared2', state: 'B' })] });
    expect(preloadCandidates(cat, ['A', 'A', 'A'], {})).toEqual(['shared']);
  });
});

describe('目录体检 validateCatalog', () => {
  it('合法目录零错', () => {
    expect(validateCatalog(CAT())).toEqual([]);
  });

  it('★ 悬空 fallbackClipKey 被点名（否则那一环静默消失·最难查的形状）', () => {
    const cat = CAT({ clips: [C({ clipKey: 'a', state: 'S', fallbackClipKey: 'ghost' })] });
    expect(validateCatalog(cat).join(' ')).toContain('ghost');
  });

  it('★ 缺 stillRef 被点名（断网时链尾没东西可显示）', () => {
    expect(validateCatalog(CAT({ stillRef: undefined })).join(' ')).toContain('stillRef');
  });

  it('clipKey 重复 / ticks 非整数或负 / review 越闭集 各自点名', () => {
    const dup = CAT({ clips: [C({ clipKey: 'a', state: 'S' }), C({ clipKey: 'a', state: 'T' })] });
    expect(validateCatalog(dup).join(' ')).toContain('重复');
    for (const ticks of [1.5, -3, NaN]) {
      expect(validateCatalog(CAT({ clips: [C({ clipKey: 'a', state: 'S', ticks })] })).join(' ')).toContain('ticks');
    }
    const bad = CAT({ clips: [{ clipKey: 'a', state: 'S', ticks: 1, review: 'ok' as never }] });
    expect(validateCatalog(bad).join(' ')).toContain('闭集');
  });

  it('缺 id / 缺 state / 空 clipKey 都点名', () => {
    expect(validateCatalog(CAT({ id: '' })).join(' ')).toContain('id');
    expect(validateCatalog(CAT({ clips: [C({ clipKey: 'a', state: '' })] })).join(' ')).toContain('state');
    expect(validateCatalog(CAT({ clips: [C({ clipKey: '', state: 'S' })] })).join(' ')).toContain('clipKey');
  });
});
