import { describe, it, expect } from 'vitest';
import { NullAishePort, HttpAishePort } from './index.js';

describe('AIGP NullAishePort（REQ-C-004，表现层旁路）', () => {
  it('即时返回 ready 占位句柄，回显提示词，记录日志', async () => {
    const port = new NullAishePort();
    const h = await port.generate('a knight in silver armor, 9:16', { aspect: '9:16' });
    expect(h.status).toBe('ready');
    expect(h.prompt).toContain('silver armor');
    expect(h.url).toBeTruthy();
    expect(port.log).toHaveLength(1);
  });

  it('句柄 id 自增（确定性，可复现）：连续分配 = 前缀相同·数值恰 +1', async () => {
    const port = new NullAishePort();
    const a = await port.generate('p1');
    const b = await port.generate('p2');
    // 加强（测试加固 2026-08-24）：原只断 a.id !== b.id——随机 id 也能绿，测不出「自增·确定性」。
    // 断实际序列形状：从 1 起、逐次 +1、跨实例可复现。
    expect(a.id).toBe('aishe-null-1');
    expect(b.id).toBe('aishe-null-2');
    const num = (id: string): number => Number(id.slice('aishe-null-'.length));
    expect(num(b.id) - num(a.id)).toBe(1); // 连续两次分配数值恰差 1
    expect((await new NullAishePort().generate('q')).id).toBe('aishe-null-1'); // 新实例从头计（确定性可复现）
  });
});

describe('AIGP HttpAishePort — 注入 fetch（provider 无关骨架）', () => {
  it('POST 提示词与选项，解析回视频句柄', async () => {
    let captured: { url: string; body: Record<string, unknown> } | undefined;
    const fakeFetch: typeof fetch = async (input, init) => {
      captured = { url: String(input), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ id: 'vid_1', url: 'https://cdn/v.mp4', status: 'ready' }), { status: 200 });
    };
    const port = new HttpAishePort({ endpoint: 'https://api/gen', apiKey: 'k', fetchImpl: fakeFetch });
    const h = await port.generate('prompt here', { aspect: '9:16', seed: 7 });
    expect(h.status).toBe('ready');
    expect(h.url).toBe('https://cdn/v.mp4');
    expect(captured?.body.prompt).toBe('prompt here');
    expect(captured?.body.seed).toBe(7);
  });

  it('HTTP 非 2xx → error 句柄（不抛，sim 不受后端故障影响）', async () => {
    const fakeFetch: typeof fetch = async () => new Response(null, { status: 500 });
    const port = new HttpAishePort({ endpoint: 'x', fetchImpl: fakeFetch });
    const h = await port.generate('p');
    expect(h.status).toBe('error');
  });
});

// ═══════════════════════════════════════════════════════════════
//  REQ-112-ENG-05（owner 2026-09-24 判 A）—— 作业生命周期 + 参考输入
//  这批钉的是「pending 句柄有出路」：改前 generate 能回 pending 而全仓无人能把它解出来。
// ═══════════════════════════════════════════════════════════════

describe('NullAishePort · 作业生命周期（poll / cancel / delete）', () => {
  it('缺省行为零回归：不开 pendingFirst 时 generate 仍即时 ready', async () => {
    const h = await new NullAishePort().generate('p');
    expect(h.status).toBe('ready');
    expect(h.url).toBeTruthy();
  });

  it('★ pendingFirst：generate→pending，poll 满次数才转 ready（**按次数不按墙钟**）', async () => {
    const port = new NullAishePort({ pendingFirst: true, readyAfterPolls: 3 });
    const h = await port.generate('slow one');
    expect(h.status).toBe('pending');
    expect((await port.poll(h.id)).status).toBe('pending');   // 1
    expect((await port.poll(h.id)).status).toBe('pending');   // 2
    const ready = await port.poll(h.id);                      // 3 → 转
    expect(ready.status).toBe('ready');
    expect(ready.url).toBeTruthy();
    expect(ready.prompt).toBe('slow one');                    // 提示词一路带着
  });

  it('readyAfterPolls 归一：小数被 trunc、0/负数下钳到 1（一次 poll 即 ready）', async () => {
    for (const n of [0, -5, 0.9]) {
      const port = new NullAishePort({ pendingFirst: true, readyAfterPolls: n });
      const h = await port.generate('p');
      expect((await port.poll(h.id)).status).toBe('ready');
    }
  });

  it('poll 未知 id → error 句柄（**不抛**·调用方不必 try/catch）', async () => {
    const h = await new NullAishePort().poll('nope');
    expect(h.status).toBe('error');
    expect(h.error).toBeTruthy();
  });

  it('cancel：pending 可撤（转 error 带「已撤回」）；已 ready 撤不回', async () => {
    const port = new NullAishePort({ pendingFirst: true, readyAfterPolls: 9 });
    const h = await port.generate('p');
    expect(await port.cancel(h.id)).toEqual({ ok: true });
    const after = await port.poll(h.id);
    expect(after.status).toBe('error');
    expect(after.error).toContain('撤回');

    const ready = new NullAishePort();
    const r = await ready.generate('q');
    expect((await ready.cancel(r.id)).ok).toBe(false);        // 已 ready → 撤不回
    expect((await ready.cancel('nope')).ok).toBe(false);      // 未知 id → 不抛
  });

  it('delete：删掉后 poll 就查不到了；重复删 / 未知 id → ok:false', async () => {
    const port = new NullAishePort();
    const h = await port.generate('p');
    expect(await port.delete(h.id)).toEqual({ ok: true });
    expect((await port.poll(h.id)).status).toBe('error');
    expect((await port.delete(h.id)).ok).toBe(false);
  });
});

describe('HttpAishePort · 参考输入四件 + 作业方法（注入 fetch·零真网络）', () => {
  const rec = () => {
    const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input), method: String(init?.method ?? 'GET'),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(JSON.stringify({ id: 'vid_1', status: 'ready', url: 'https://cdn/v.mp4' }), { status: 200 });
    };
    return { calls, fetchImpl };
  };

  it('★ referenceImages / characterId / firstFrame / lastFrame 真进请求体', async () => {
    const { calls, fetchImpl } = rec();
    await new HttpAishePort({ endpoint: 'https://api/gen', fetchImpl }).generate('p', {
      referenceImages: ['art:cat-a', 'https://cdn/ref.png'], characterId: 'cat-7',
      firstFrame: 'art:photo-1', lastFrame: 'art:photo-2',
    });
    expect(calls[0].body?.referenceImages).toEqual(['art:cat-a', 'https://cdn/ref.png']);
    expect(calls[0].body?.characterId).toBe('cat-7');
    expect(calls[0].body?.firstFrame).toBe('art:photo-1');
    expect(calls[0].body?.lastFrame).toBe('art:photo-2');
  });

  it('不传新字段 → 请求体里根本没这些键（旧 provider 不会收到意外字段）', async () => {
    const { calls, fetchImpl } = rec();
    await new HttpAishePort({ endpoint: 'x', fetchImpl }).generate('p');
    for (const k of ['referenceImages', 'characterId', 'firstFrame', 'lastFrame']) {
      expect(Object.prototype.hasOwnProperty.call(calls[0].body ?? {}, k)).toBe(false);
    }
  });

  it('poll / cancel / delete 打对路径与方法（jobEndpoint 缺省回落 endpoint）', async () => {
    const { calls, fetchImpl } = rec();
    const port = new HttpAishePort({ endpoint: 'https://api/gen', jobEndpoint: 'https://api/jobs', fetchImpl });
    await port.poll('vid 1');      // 带空格 → 必须被 encodeURIComponent
    await port.cancel('v2');
    await port.delete('v3');
    expect(calls[0]).toMatchObject({ url: 'https://api/jobs/vid%201', method: 'GET' });
    expect(calls[1]).toMatchObject({ url: 'https://api/jobs/v2/cancel', method: 'POST' });
    expect(calls[2]).toMatchObject({ url: 'https://api/jobs/v3', method: 'DELETE' });

    const fb = rec();
    await new HttpAishePort({ endpoint: 'https://api/gen', fetchImpl: fb.fetchImpl }).poll('z');
    expect(fb.calls[0].url).toBe('https://api/gen/z');   // 没给 jobEndpoint → 回落
  });

  it('★ 非 2xx / 网络抛错 → 四个方法**全落失败态且都不抛**（纪律①）', async () => {
    const bad: typeof fetch = async () => new Response(null, { status: 503 });
    const boom: typeof fetch = async () => { throw new Error('ECONNRESET'); };
    for (const fetchImpl of [bad, boom]) {
      const p = new HttpAishePort({ endpoint: 'x', fetchImpl });
      await expect(p.generate('p')).resolves.toMatchObject({ status: 'error' });
      await expect(p.poll('i')).resolves.toMatchObject({ status: 'error' });
      await expect(p.cancel('i')).resolves.toMatchObject({ ok: false });
      await expect(p.delete('i')).resolves.toMatchObject({ ok: false });
    }
  });

  it('★ 200 + 坏 JSON：generate/poll 降级为 error，**cancel/delete 仍算成功**（契约：它们不解析体）', async () => {
    // 这条是 2026-09-24 施工时把断言写错撞出来的，钉下来防后人"顺手统一"：
    // cancel/delete 的语义是「后端收下了这个动作吗」——200 就是收下了，体里写什么都不改变这件事。
    // 反过来 generate/poll 必须解析体才能拿到 id/url/status，坏 JSON 就只能降级。
    const garbage: typeof fetch = async () => new Response('not json', { status: 200 });
    const p = new HttpAishePort({ endpoint: 'x', fetchImpl: garbage });
    await expect(p.generate('p')).resolves.toMatchObject({ status: 'error' });
    await expect(p.poll('i')).resolves.toMatchObject({ status: 'error' });
    await expect(p.cancel('i')).resolves.toEqual({ ok: true });
    await expect(p.delete('i')).resolves.toEqual({ ok: true });
  });

  it('poll 时 provider 不回 prompt → 落 \'\'（不是丢了，是没回·契约明说）', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ id: 'v', status: 'ready', url: 'u' }), { status: 200 });
    const h = await new HttpAishePort({ endpoint: 'x', fetchImpl }).poll('v');
    expect(h.prompt).toBe('');
    expect(h.status).toBe('ready');
  });
});
