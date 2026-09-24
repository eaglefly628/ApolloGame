#!/usr/bin/env node
// game112 · 爱诗(AIGP)视频生成代理（**开发期基建·不是游戏层代码，也不是引擎能力**）
// REQ-112-ENG-05 单子点名件，照 `scripts/game111-deepseek-proxy.mjs` 的先例。
//
// 为什么需要它，两条硬理由（同 game111 那本）：
//  ① **形状不同**。引擎的 `HttpAishePort` 按自己的契约走四条路
//     （POST 生成 · GET 查 · POST /cancel 撤 · DELETE 删），回 `{id,status,url,prompt}`；
//     provider 的字段名和路径是它自己的。两边对不上，中间必须有人翻译。
//  ② **钥匙不能进浏览器**。任何让前端直连生成服务的写法都等于把 API key 发给每个玩家。
//     key 只在本进程里（读 env），浏览器只看得到 localhost 的这个端点。
//
// ⚠ **诚实边界（别把下面的映射当成爱诗官方契约）**：本仓没有爱诗 API 文档，
//    `toProviderBody` / `fromProviderJob` / `PATHS` 三处写的是**占位映射**，形状照 REQ-112-ENG-05
//    的端口契约摆好、字段名按最常见的命名猜的。**真对接时只改这三处**，引擎与游戏侧一行不动
//    ——这正是端口契约的意义，也是为什么要先立端口（owner 2026-09-24 判 A「先立端口」）。
//    三处都是**纯函数 / 纯常量**，`--selftest` 不出网就能验它们。
//
// 用法：
//   export AISHE_API_KEY=...
//   node scripts/game112-aishe-proxy.mjs                  # 默认 http://127.0.0.1:8712
//   PORT=9100 node scripts/game112-aishe-proxy.mjs
// 自检（不花钱·不出网·CI 可跑）：
//   node scripts/game112-aishe-proxy.mjs --selftest
//
// 游戏/宿主侧接法：
//   new HttpAishePort({ endpoint: 'http://127.0.0.1:8712/gen', jobEndpoint: 'http://127.0.0.1:8712/gen' })
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8712);
const API_KEY = process.env.AISHE_API_KEY ?? '';
const BASE = process.env.AISHE_ENDPOINT ?? 'https://api.aishe.example/v1';

// ── 适配处 1/3：provider 的路径 ──（真对接时照文档改这一块）
export const PATHS = {
  submit: () => `${BASE}/videos`,
  job: (id) => `${BASE}/videos/${encodeURIComponent(id)}`,
  cancel: (id) => `${BASE}/videos/${encodeURIComponent(id)}/cancel`,
};

/**
 * 适配处 2/3：我们的 generate 请求体 → provider 请求体（**纯函数**）。
 *
 * 只做**改名与搬运**，不做业务判断：不猜默认时长、不替调用方压 seed、不过滤参考图。
 * 端口纪律③「只归一形状」在代理这一层同样成立——代理多做一分主张，
 * 将来换 provider 就多一分对不上的风险。
 */
export function toProviderBody(req) {
  const o = req && typeof req === 'object' ? req : {};
  const body = {
    prompt: typeof o.prompt === 'string' ? o.prompt : '',
    aspect_ratio: o.aspect ?? '9:16',
  };
  if (o.negativePrompt) body.negative_prompt = o.negativePrompt;
  if (typeof o.seconds === 'number') body.duration = o.seconds;
  if (typeof o.seed === 'number') body.seed = o.seed;
  // REQ-112-ENG-05 的参考输入四件（只走引用·绝不塞裸字节·同 AisheImageRef 契约）
  if (Array.isArray(o.referenceImages) && o.referenceImages.length > 0) body.reference_images = o.referenceImages;
  if (o.characterId) body.character_id = o.characterId;
  if (o.firstFrame) body.first_frame = o.firstFrame;
  if (o.lastFrame) body.last_frame = o.lastFrame;
  return body;
}

/**
 * 适配处 3/3：provider 回包 → `AisheVideoHandle`（**纯函数**）。
 *
 * status 归一到引擎闭集 `pending|ready|error`：provider 的 queued/processing/running 都算 pending，
 * succeeded/completed/done 算 ready，failed/canceled 算 error。
 * **认不出来的状态一律落 pending 而不是 ready**——猜错成 ready 会让 UI 去播一个不存在的 url
 * （fail-closed：宁可让用户多等一次 poll，不给他一个黑屏播放器）。
 */
export function fromProviderJob(data, fallbackId = '') {
  const d = data && typeof data === 'object' ? data : {};
  const id = d.id ?? d.video_id ?? fallbackId;
  const url = d.url ?? d.video_url ?? d.output?.url;
  const raw = String(d.status ?? '').toLowerCase();
  let status;
  if (['succeeded', 'completed', 'done', 'ready', 'success'].includes(raw)) status = 'ready';
  else if (['failed', 'error', 'canceled', 'cancelled'].includes(raw)) status = 'error';
  else if (raw) status = 'pending';
  else status = url ? 'ready' : 'pending';       // provider 没回 status：有 url 才算成
  const out = { id: id ?? '', status, prompt: d.prompt ?? '', ...(url ? { url } : {}) };
  if (status === 'error') out.error = d.error ?? d.failure_reason ?? raw ?? '生成失败';
  return out;
}

const headers = () => ({
  'content-type': 'application/json',
  ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 路由解析（纯函数·可自检）：把进来的 method+path 归成四个动作之一。 */
export function routeOf(method, path) {
  const p = path.replace(/\/+$/, '');
  if (method === 'POST' && p === '/gen') return { action: 'submit' };
  const m = p.match(/^\/gen\/([^/]+)(\/cancel)?$/);
  if (!m) return { action: 'unknown' };
  const id = decodeURIComponent(m[1]);
  if (m[2]) return method === 'POST' ? { action: 'cancel', id } : { action: 'unknown' };
  if (method === 'GET') return { action: 'poll', id };
  if (method === 'DELETE') return { action: 'delete', id };
  return { action: 'unknown' };
}

function serve() {
  if (!API_KEY) {
    console.error('[game112-proxy] 缺 AISHE_API_KEY —— 没有它每次请求都会被上游拒，句柄一律回 error。');
    console.error('[game112-proxy] export AISHE_API_KEY=... 之后重跑。');
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'content-type,authorization');
    res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    const json = (code, obj) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
    const r = routeOf(req.method, new URL(req.url, 'http://x').pathname);
    if (r.action === 'unknown') { json(404, { error: 'no such route（四条：POST /gen · GET /gen/:id · POST /gen/:id/cancel · DELETE /gen/:id）' }); return; }

    try {
      if (r.action === 'submit') {
        let reqBody;
        try { reqBody = JSON.parse(await readBody(req)); }
        catch { json(400, { id: '', status: 'error', prompt: '', error: '请求体不是 JSON' }); return; }
        const up = await fetch(PATHS.submit(), { method: 'POST', headers: headers(), body: JSON.stringify(toProviderBody(reqBody)) });
        if (!up.ok) { json(200, { id: '', status: 'error', prompt: reqBody.prompt ?? '', error: `上游 HTTP ${up.status}` }); return; }
        const out = fromProviderJob(await up.json());
        console.info(`[game112-proxy] submit → ${out.id} ${out.status}`);
        json(200, { ...out, prompt: out.prompt || (reqBody.prompt ?? '') });
        return;
      }
      if (r.action === 'poll') {
        const up = await fetch(PATHS.job(r.id), { method: 'GET', headers: headers() });
        if (!up.ok) { json(200, { id: r.id, status: 'error', prompt: '', error: `上游 HTTP ${up.status}` }); return; }
        json(200, fromProviderJob(await up.json(), r.id));
        return;
      }
      // cancel / delete：只把上游的 2xx 透传成 2xx（端口那边只看 res.ok·不解析体）
      const up = r.action === 'cancel'
        ? await fetch(PATHS.cancel(r.id), { method: 'POST', headers: headers() })
        : await fetch(PATHS.job(r.id), { method: 'DELETE', headers: headers() });
      console.info(`[game112-proxy] ${r.action} ${r.id} → 上游 ${up.status}`);
      res.writeHead(up.ok ? 200 : 502, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: up.ok }));
    } catch (e) {
      // 绝不把异常抛给调用方——端口那边的契约是「永不抛」，代理这层先把它兑现。
      console.warn(`[game112-proxy] ${r.action} 失败：${e.message}`);
      if (r.action === 'submit' || r.action === 'poll') json(200, { id: r.id ?? '', status: 'error', prompt: '', error: e.message });
      else json(502, { ok: false, error: e.message });
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.info(`[game112-proxy] listening http://127.0.0.1:${PORT}  上游=${BASE}`);
    console.info(`[game112-proxy] 宿主侧：new HttpAishePort({ endpoint: "http://127.0.0.1:${PORT}/gen", jobEndpoint: "http://127.0.0.1:${PORT}/gen" })`);
  });
}

// ── 自检（零网络·零 key·CI 可跑）────────────────────────────────────────
function selftest() {
  let fail = 0;
  const eq = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) { fail++; console.error(`✗ ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
    else console.info(`✓ ${name}`);
  };

  // toProviderBody：只改名搬运，不传的键不出现
  eq('缺省只出 prompt + 画幅', toProviderBody({ prompt: 'a cat' }), { prompt: 'a cat', aspect_ratio: '9:16' });
  eq('参考输入四件改名搬运', toProviderBody({
    prompt: 'p', referenceImages: ['art:a'], characterId: 'cat-7', firstFrame: 'f', lastFrame: 'l',
  }), { prompt: 'p', aspect_ratio: '9:16', reference_images: ['art:a'], character_id: 'cat-7', first_frame: 'f', last_frame: 'l' });
  eq('空参考图数组不出键（别给上游发空数组）', 'reference_images' in toProviderBody({ prompt: 'p', referenceImages: [] }), false);
  eq('seed=0 照传（0 是合法种子·别被 falsy 吃掉）', toProviderBody({ prompt: 'p', seed: 0 }).seed, 0);
  eq('非对象入参不炸', toProviderBody(null), { prompt: '', aspect_ratio: '9:16' });

  // fromProviderJob：status 归一到引擎闭集
  for (const s of ['succeeded', 'completed', 'done', 'ready', 'SUCCESS']) {
    eq(`ready 同义词 ${s}`, fromProviderJob({ id: 'v', status: s, url: 'u' }).status, 'ready');
  }
  for (const s of ['queued', 'processing', 'running']) {
    eq(`pending 同义词 ${s}`, fromProviderJob({ id: 'v', status: s }).status, 'pending');
  }
  for (const s of ['failed', 'canceled']) {
    eq(`error 同义词 ${s}`, fromProviderJob({ id: 'v', status: s }).status, 'error');
  }
  eq('★ 认不出的状态 → pending 不是 ready（fail-closed·别给黑屏播放器）',
    fromProviderJob({ id: 'v', status: 'weird_new_state', url: 'u' }).status, 'pending');
  eq('provider 没回 status：有 url 才 ready', fromProviderJob({ id: 'v', url: 'u' }).status, 'ready');
  eq('provider 没回 status 也没 url → pending', fromProviderJob({ id: 'v' }).status, 'pending');
  eq('id 别名 video_id', fromProviderJob({ video_id: 'v2', url: 'u' }).id, 'v2');
  eq('url 别名 output.url', fromProviderJob({ id: 'v', status: 'done', output: { url: 'oo' } }).url, 'oo');
  eq('无 id 回落调用方给的 id', fromProviderJob({ status: 'queued' }, 'fb').id, 'fb');
  eq('error 带上原因', fromProviderJob({ id: 'v', status: 'failed', failure_reason: '额度用尽' }).error, '额度用尽');
  eq('非对象入参不炸', fromProviderJob(undefined).status, 'pending');

  // routeOf：四条路 + 拒掉其余
  eq('POST /gen', routeOf('POST', '/gen'), { action: 'submit' });
  eq('GET /gen/:id', routeOf('GET', '/gen/v1'), { action: 'poll', id: 'v1' });
  eq('POST /gen/:id/cancel', routeOf('POST', '/gen/v1/cancel'), { action: 'cancel', id: 'v1' });
  eq('DELETE /gen/:id', routeOf('DELETE', '/gen/v1'), { action: 'delete', id: 'v1' });
  eq('id 里的 %20 被解回空格', routeOf('GET', '/gen/vid%201'), { action: 'poll', id: 'vid 1' });
  eq('尾斜杠容错', routeOf('GET', '/gen/v1/'), { action: 'poll', id: 'v1' });
  eq('GET /gen 不是路（生成必须 POST）', routeOf('GET', '/gen'), { action: 'unknown' });
  eq('DELETE /gen/:id/cancel 不是路', routeOf('DELETE', '/gen/v1/cancel'), { action: 'unknown' });
  eq('别的路径一律 unknown', routeOf('POST', '/whatever'), { action: 'unknown' });

  console.info(fail === 0 ? '\n[selftest] 全过' : `\n[selftest] ${fail} 条失败`);
  process.exit(fail === 0 ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest();
else serve();
