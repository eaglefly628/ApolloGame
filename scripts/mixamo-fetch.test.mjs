// mixamo-fetch：用假 Mixamo 服务钉住请求形状、节流/停止、续传、仓库外目录与 token 不外泄。真实 Mixamo 接口未验。
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateList, assertOutsideRepo, createClient, pickResult, exportBody, runFetch, main, DEFAULT_LIST } from './mixamo-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FBX = Buffer.concat([Buffer.from('Kaydara FBX Binary  \0'), Buffer.alloc(64, 7)]);
const TOKEN = 'secret-token-abc';
const withOut = async (fn) => { const d = mkdtempSync(join(tmpdir(), 'mixamo-')); try { return await fn(join(d, 'lib')); } finally { rmSync(d, { recursive: true, force: true }); } };
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) });

/** 假服务：记录每个请求；按 routes 覆盖个别响应。 */
function fakeMixamo(routes = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null });
    for (const [pat, fn] of Object.entries(routes)) if (url.includes(pat)) return fn(url, init);
    if (url.includes('/products?')) {
      const q = decodeURIComponent(/query=([^&]*)/.exec(url)[1]);
      return json({ results: [{ id: `pack-${q}`, type: 'MotionPack', description: `${q} Pack` }, { id: `m-${q}`, type: 'Motion', description: q }, { id: `m2-${q}`, type: 'Motion', description: `${q} Variant` }] });
    }
    if (url.includes('/products/')) return json({ description: 'X', details: { supports_inplace: true, gms_hash: { 'model-id': 42, mirror: false, trim: [0, 100], overdrive: 0, params: [['Posture', 0], ['Speed', 1.5]], 'arm-space': 0, inplace: false } } });
    if (url.includes('/animations/export')) return json({ status: 'processing' });
    if (url.includes('/monitor')) return json({ status: 'completed', job_result: 'https://s3.example/clip.fbx' });
    if (url.startsWith('https://s3.example/')) return { ok: true, status: 200, arrayBuffer: async () => FBX.buffer.slice(FBX.byteOffset, FBX.byteOffset + FBX.length) };
    return json({}, 404);
  };
  return { calls, fetchImpl };
}
const fast = { delayMs: 0, pollMs: 0, timeoutMs: 10 };

describe('mixamo-fetch 清单与边界', () => {
  it('仓库内置清单合法', () => { expect(validateList(JSON.parse(readFileSync(DEFAULT_LIST, 'utf8'))).length).toBeGreaterThan(20); });
  it.each([[[]], [[{ id: 'Bad', query: 'x' }]], [[{ id: 'a', query: 'x' }, { id: 'a', query: 'y' }]], [[{ id: 'a', query: '' }]], [[{ id: 'a', query: 'x', extra: 1 }]], [[{ id: 'a', query: 'x', inPlace: 'yes' }]]])('非法清单拒收 %j', (list) => {
    expect(() => validateList(list)).toThrow();
  });
  it('输出目录在仓库内一律拒绝（公开仓库不得含 Mixamo 原件），仓库外放行', () => {
    expect(() => assertOutsideRepo(ROOT)).toThrow('仓库内');
    expect(() => assertOutsideRepo(join(ROOT, 'assets', '_inbox', 'mixamo'))).toThrow('仓库内');
    expect(() => assertOutsideRepo(join(tmpdir(), 'mixamo-lib'))).not.toThrow();
  });
  it('缺 token 拒绝并给出取 token 的办法', () => { expect(() => createClient({ token: '' })).toThrow('MIXAMO_TOKEN'); });
  it('选结果：无 pick 取第一个 Motion；pick 精确匹配显示名，匹配不到返回 null', () => {
    const rs = [{ description: 'Walking' }, { description: 'Walking Backwards' }];
    expect(pickResult({ query: 'walk' }, rs)).toBe(rs[0]);
    expect(pickResult({ query: 'walk', pick: 'walking backwards' }, rs)).toBe(rs[1]);
    expect(pickResult({ query: 'walk', pick: 'Strut' }, rs)).toBeNull();
  });
  it('导出体：沿用 gms_hash、params 压成逗号串、FBX 无皮、inPlace 仅在支持时开', () => {
    const product = { description: 'Walking', details: { supports_inplace: false, gms_hash: { 'model-id': 1, params: [['a', 0], ['b', 2]], inplace: false } } };
    const { body, inPlaceApplied } = exportBody(product, 'char-1', { inPlace: true, fps: 30 });
    expect(inPlaceApplied).toBe(false);
    expect(body).toEqual({ character_id: 'char-1', gms_hash: [{ 'model-id': 1, params: '0,2', inplace: false }], preferences: { format: 'fbx7', skin: 'false', fps: '30', reducekf: '0' }, product_name: 'Walking', type: 'Motion' });
    expect(exportBody({ ...product, details: { ...product.details, supports_inplace: true } }, 'c', { inPlace: true }).body.gms_hash[0].inplace).toBe(true);
    expect(() => exportBody({ details: {} }, 'c')).toThrow('gms_hash');
  });
});

describe('mixamo-fetch 下载流程（假服务）', () => {
  it('搜索 → 详情 → 导出 → 轮询 → 下载：文件、manifest、请求头都对，token 不进日志与 manifest', () => withOut(async (out) => {
    const { calls, fetchImpl } = fakeMixamo();
    const logs = []; const spies = ['info', 'warn', 'error', 'log'].map((k) => vi.spyOn(console, k).mockImplementation((...a) => logs.push(a.join(' '))));
    try {
      const r = await runFetch({ list: [{ id: 'walk', query: 'Walking', inPlace: true }], outDir: out, client: createClient({ token: TOKEN, fetchImpl }), characterId: 'char-1', ...fast, now: () => 'T' });
      expect(r).toMatchObject({ downloaded: ['walk'], failed: [], stopped: null });
      expect(readFileSync(join(out, 'walk.fbx'))).toEqual(FBX);
      const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
      expect(m.clips.walk).toMatchObject({ file: 'walk.fbx', bytes: FBX.length, searchTerm: 'Walking', mixamoName: 'Walking', mixamoId: 'm-Walking', characterId: 'char-1', download: { format: 'FBX', skin: false, fps: 30, inPlace: true }, downloadedAt: 'T' });
      expect(m.licenseUrl).toBe('https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html');
      const api = calls.filter((c) => c.url.startsWith('https://www.mixamo.com/'));
      expect(api.every((c) => c.headers.Authorization === `Bearer ${TOKEN}` && c.headers['X-Api-Key'] === 'mixamo2')).toBe(true);
      expect(calls.find((c) => c.url.startsWith('https://s3.example/')).headers.Authorization).toBeUndefined();
      expect(calls.find((c) => c.method === 'POST').body.gms_hash[0]).toMatchObject({ 'model-id': 42, params: '0,1.5', inplace: true });
      expect(logs.join('\n')).not.toContain(TOKEN);
      expect(readFileSync(join(out, 'manifest.json'), 'utf8')).not.toContain(TOKEN);
    } finally { spies.forEach((s) => s.mockRestore()); }
  }));
  it('续传：已下且 SHA 一致的跳过，不再请求；文件被改则重下', () => withOut(async (out) => {
    const list = [{ id: 'idle', query: 'Idle' }];
    const a = fakeMixamo(); await runFetch({ list, outDir: out, client: createClient({ token: TOKEN, fetchImpl: a.fetchImpl }), characterId: 'c', ...fast });
    const b = fakeMixamo(); const r = await runFetch({ list, outDir: out, client: createClient({ token: TOKEN, fetchImpl: b.fetchImpl }), characterId: 'c', ...fast });
    expect(r.skipped).toEqual(['idle']); expect(b.calls).toEqual([]);
    writeFileSync(join(out, 'idle.fbx'), 'tampered');
    const c = fakeMixamo(); const r2 = await runFetch({ list, outDir: out, client: createClient({ token: TOKEN, fetchImpl: c.fetchImpl }), characterId: 'c', ...fast });
    expect(r2.downloaded).toEqual(['idle']);
  }));
  it.each([[401, 'token'], [403, 'token'], [429, '限流']])('HTTP %i 立即整轮停止、不再请求后续动作', (status, word) => withOut(async (out) => {
    const { calls, fetchImpl } = fakeMixamo({ '/products?': () => json({}, status) });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const r = await runFetch({ list: [{ id: 'a', query: 'A' }, { id: 'b', query: 'B' }], outDir: out, client: createClient({ token: TOKEN, fetchImpl }), characterId: 'c', ...fast });
      expect(r.stopped).toContain(word); expect(r.downloaded).toEqual([]); expect(calls.length).toBe(1);
    } finally { err.mockRestore(); }
  }));
  it('单个失败（无匹配 / 导出失败 / 非 FBX）记失败并继续下一个', () => withOut(async (out) => {
    let n = 0;
    const { fetchImpl } = fakeMixamo({ '/monitor': () => json(++n === 1 ? { status: 'failed', message: 'boom' } : { status: 'completed', job_result: 'https://s3.example/x' }) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = await runFetch({ list: [{ id: 'a', query: 'A' }, { id: 'b', query: 'B', pick: 'Nope' }, { id: 'c', query: 'C' }], outDir: out, client: createClient({ token: TOKEN, fetchImpl }), characterId: 'c', ...fast });
      expect(r.failed.map((f) => f.id)).toEqual(['a', 'b']); expect(r.failed[0].error).toContain('boom'); expect(r.downloaded).toEqual(['c']);
    } finally { warn.mockRestore(); }
  }));
  it('--max 上限：本轮只导出 max 个，其余留到下次', () => withOut(async (out) => {
    const { calls, fetchImpl } = fakeMixamo();
    const r = await runFetch({ list: [{ id: 'a', query: 'A' }, { id: 'b', query: 'B' }, { id: 'c', query: 'C' }], outDir: out, client: createClient({ token: TOKEN, fetchImpl }), characterId: 'c', max: 2, ...fast });
    expect(r.downloaded).toEqual(['a', 'b']); expect(calls.filter((x) => x.method === 'POST').length).toBe(2);
  }));
  it('--search-only 只搜不下：不建目录、不发导出', () => withOut(async (out) => {
    const { calls, fetchImpl } = fakeMixamo();
    const r = await runFetch({ list: [{ id: 'a', query: 'Walking' }], outDir: out, client: createClient({ token: TOKEN, fetchImpl }), characterId: 'c', searchOnly: true, ...fast });
    expect(r.plan).toEqual([{ id: 'a', name: 'Walking', mixamoId: 'm-Walking' }]);
    expect(existsSync(out)).toBe(false); expect(calls.some((c) => c.method === 'POST')).toBe(false);
  }));
  it('CLI：节流下限与仓库内目录在发请求前就拒绝', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await main(['--delay-ms', '100'], { MIXAMO_TOKEN: TOKEN })).toBe(1);
      const inRepo = join(ROOT, `tmp-mixamo-${process.pid}-${Date.now()}`);
      try {
        expect(await main(['--out', inRepo, '--character', 'c'], { MIXAMO_TOKEN: TOKEN })).toBe(1);
        expect(existsSync(inRepo)).toBe(false);
      } finally { rmSync(inRepo, { recursive: true, force: true }); }
    } finally { err.mockRestore(); }
  });
});
