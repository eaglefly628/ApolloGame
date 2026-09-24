import { describe, it, expect } from 'vitest';
import {
  NullMediaJobPort, MemoryMediaCachePort,
  sortReviewQueue, pendingReviews, decideReview,
  type MediaReviewItem,
} from './index.js';

// REQ-112-ENG-06（owner 2026-09-24 判 A·先立端口）。
// 这里钉的是**端口契约本身**：不抛 · 全序 · 终态不可改判 · 驳回必带理由 · 进度是整数。
// 真后端形状归一留给接入时（同 HttpAishePort 的注入 fetch 打法）。

describe('NullMediaJobPort · 作业生命周期', () => {
  it('★ 空 refs 当场落 error，不提交注定失败的作业（调用方的 bug 别甩给后端）', async () => {
    const port = new NullMediaJobPort();
    const j = await port.submit('animate', { refs: [] });
    expect(j.status).toBe('error');
    expect(j.id).toBe('');
    expect(port.log).toHaveLength(0);        // 没记日志 = 真没提交
  });

  it('★ pending → running（进度爬）→ ready，**按 poll 次数不按墙钟**', async () => {
    const port = new NullMediaJobPort({ readyAfterPolls: 4 });
    const j = await port.submit('animate', { refs: ['art:photo-1'], subjectId: 'cat-7' });
    expect(j).toMatchObject({ status: 'pending', progress: 0 });

    const p1 = await port.poll(j.id);
    expect(p1.status).toBe('running');
    expect(p1.progress).toBe(250);
    const p2 = await port.poll(j.id);
    expect(p2.progress).toBe(500);
    await port.poll(j.id);                  // 3
    const done = await port.poll(j.id);     // 4 → ready
    expect(done).toMatchObject({ status: 'ready', progress: 1000 });
    expect(done.outputRef).toBeTruthy();
  });

  it('进度**永远是整数** 0–1000（浮点进日志/比较会出 1 ULP 噪声）', async () => {
    const port = new NullMediaJobPort({ readyAfterPolls: 3 });   // 1000/3 不整除
    const j = await port.submit('matte', { refs: ['a'] });
    for (let i = 0; i < 3; i++) {
      const p = await port.poll(j.id);
      expect(Number.isInteger(p.progress)).toBe(true);
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(1000);
    }
  });

  it('poll 未知 id → error（**不抛**）', async () => {
    const j = await new NullMediaJobPort().poll('nope');
    expect(j.status).toBe('error');
    expect(j.error).toBeTruthy();
  });

  it('cancel：running 可撤 → cancelled；终态撤不回；未知 id → ok:false', async () => {
    const port = new NullMediaJobPort({ readyAfterPolls: 9 });
    const j = await port.submit('stitch', { refs: ['a', 'b'] });
    await port.poll(j.id);                                   // → running
    expect(await port.cancel(j.id)).toEqual({ ok: true });
    expect((await port.poll(j.id)).status).toBe('cancelled'); // 撤了就不再往前爬
    expect((await port.cancel(j.id)).ok).toBe(false);         // 已 cancelled → 撤不回
    expect((await port.cancel('nope')).ok).toBe(false);
  });

  it('delete：删掉后查不到；重复删 → ok:false（隐私面必须真删得掉）', async () => {
    const port = new NullMediaJobPort();
    const j = await port.submit('transcode', { refs: ['a'] });
    expect(await port.delete(j.id)).toEqual({ ok: true });
    expect((await port.poll(j.id)).status).toBe('error');
    expect((await port.delete(j.id)).ok).toBe(false);
  });

  it('export：未就绪不给 url；ready 才给；未知 id → ok:false', async () => {
    const port = new NullMediaJobPort({ readyAfterPolls: 1 });
    const j = await port.submit('animate', { refs: ['a'] });
    const early = await port.export(j.id);
    expect(early.ok).toBe(false);
    expect(early.url).toBeUndefined();
    await port.poll(j.id);                                   // → ready
    const ok = await port.export(j.id);
    expect(ok.ok).toBe(true);
    expect(ok.url).toBeTruthy();
    expect((await port.export('nope')).ok).toBe(false);
  });

  it('透传 params 原样进日志（引擎一概不解释·这是解耦的实现方式）', async () => {
    const port = new NullMediaJobPort();
    await port.submit('animate', { refs: ['a'], params: { fps: 24, loop: true, style: 'soft' } });
    expect(port.log[0].inputs.params).toEqual({ fps: 24, loop: true, style: 'soft' });
  });
});

describe('MemoryMediaCachePort · Blob 级（不是 string KV）', () => {
  it('put / get / has / delete / size 走 Blob 字节', async () => {
    const c = new MemoryMediaCachePort();
    expect(await c.get('k')).toBeNull();
    expect(await c.has('k')).toBe(false);
    expect(await c.put('k', new Blob(['abcde']))).toEqual({ ok: true });
    expect(await c.has('k')).toBe(true);
    expect((await c.get('k'))?.size).toBe(5);
    expect(await c.size()).toBe(5);
    await c.put('j', new Blob(['xyz']));
    expect(await c.size()).toBe(8);                 // 累加真字节数
    expect(await c.delete('k')).toEqual({ ok: true });
    expect((await c.delete('k')).ok).toBe(false);   // 重复删
    expect(await c.size()).toBe(3);
  });

  it('★ keys() **按 key 升序**（全序·否则调用方的逐出决策不可复现）', async () => {
    const c = new MemoryMediaCachePort();
    for (const k of ['zz', 'aa', 'mm']) await c.put(k, new Blob(['x']));
    expect(await c.keys()).toEqual(['aa', 'mm', 'zz']);   // 插入序是 zz,aa,mm
  });

  it('空 key 被拒（别让「忘了给 key」变成一条查不到的缓存）', async () => {
    expect((await new MemoryMediaCachePort().put('', new Blob(['x']))).ok).toBe(false);
  });
});

describe('审核队列（「无自动入库」的形状 + 纯函数转移）', () => {
  const Q: MediaReviewItem[] = [
    { jobId: 'mj-3', subjectId: 'cat-1', kind: 'animate', status: 'pending' },
    { jobId: 'mj-1', subjectId: 'cat-2', kind: 'matte', status: 'approved' },
    { jobId: 'mj-2', subjectId: 'cat-1', kind: 'stitch', status: 'pending' },
  ];

  it('sortReviewQueue 按 jobId 升序；pendingReviews 只留待审且同样有序', () => {
    expect(sortReviewQueue(Q).map((i) => i.jobId)).toEqual(['mj-1', 'mj-2', 'mj-3']);
    expect(pendingReviews(Q).map((i) => i.jobId)).toEqual(['mj-2', 'mj-3']);
  });

  it('通过：落 approved，**不改入参**（纯函数）', () => {
    const r = decideReview(Q, 'mj-2', 'approved');
    expect(r.changed).toBe(true);
    expect(r.queue.find((i) => i.jobId === 'mj-2')?.status).toBe('approved');
    expect(Q.find((i) => i.jobId === 'mj-2')?.status).toBe('pending');   // 原队列没被动
  });

  it('★ 驳回必须带理由（不写理由的驳回等于没审）', () => {
    for (const reason of [undefined, '', '   ']) {
      const r = decideReview(Q, 'mj-2', 'rejected', reason);
      expect(r.changed).toBe(false);
      expect(r.error).toContain('理由');
    }
    const ok = decideReview(Q, 'mj-2', 'rejected', '猫脸糊了');
    expect(ok.changed).toBe(true);
    expect(ok.queue.find((i) => i.jobId === 'mj-2')?.reason).toBe('猫脸糊了');
  });

  it('★ 已终态不许改判（审完就是审完·要翻案重新提作业）', () => {
    const r = decideReview(Q, 'mj-1', 'rejected', '反悔了');
    expect(r.changed).toBe(false);
    expect(r.error).toContain('不许改判');
  });

  it('未知 jobId 不静默吞（changed:false + 点名）', () => {
    const r = decideReview(Q, 'nope', 'approved');
    expect(r.changed).toBe(false);
    expect(r.error).toContain('未知');
  });
});
