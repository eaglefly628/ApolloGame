// AI 资产生成框架 —— 文本→资产。适配器：tripo(文本→3D glb)· qwen(文本→2D png，走 DashScope 万相)。
//
// 架构（同 src/services/aigp 端口哲学）：外部**非确定性 AI 服务**走旁路；产物 = 提交进库的**固定资产**（带
//   provenance：厂商/prompt/模型/日期/许可），**不碰 sim/hash**（渲染层数据·确定性不受威胁）。
// 密钥走 env（TRIPO_API_KEY / DASHSCOPE_API_KEY），**绝不入库**；缺 key 或 --mock → mock 模式（产占位、可测）。
// 本环境 GitHub-only → 真调 API 被挡；用 --mock 把整套框架跑通、门禁全绿。真调等放宽网络的 session。
//
// 用法: node scripts/ai-gen.mjs <tripo|qwen> "<prompt>" [--game <g>] [--id <local-id>] [--mock]
//   例: node scripts/ai-gen.mjs tripo "a wooden chair" --game game-z --mock
//       node scripts/ai-gen.mjs qwen "pixel sword icon" --game game-z --mock
//   自测: node scripts/ai-gen.mjs demo      （两适配器各 mock 一个到临时目录·打印落库条目·跑完自动清理）
//   设置: node scripts/ai-gen.mjs providers （看各 provider 的 envKey / 是否已配 key·打码）

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 最小 PNG 编码（qwen mock 用·纯 Node·确定性）──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, c]); }
export function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 3)] = 0; rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// prompt 播种的确定性噪声图（mock：不同 prompt→不同图，一眼看出是占位）
export function mockImage(prompt, N = 128) {
  let seed = 2166136261; for (let i = 0; i < prompt.length; i++) { seed ^= prompt.charCodeAt(i); seed = (seed * 16777619) >>> 0; }
  const h2 = (x, y) => { let h = ((x * 374761393) ^ (y * 668265263) ^ seed) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const rgb = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = (h2(Math.floor(x / 8), Math.floor(y / 8)) * 0.7 + h2(x, y) * 0.3), o = (y * N + x) * 3;
    rgb[o] = 40 + v * 180; rgb[o + 1] = 40 + h2(y, x) * 180; rgb[o + 2] = 60 + v * 150;
  }
  return { buffer: encodePng(N, N, rgb), w: N, h: N };
}

// ── 适配器（kind=资产类型·envKey=密钥环境变量·generate=产 buffer+meta）──
export const ADAPTERS = {
  tripo: {
    kind: 'mesh', ext: 'glb', envKey: 'TRIPO_API_KEY', license: 'Tripo (按订阅商用授权)',
    async generate(prompt, { mock, apiKey }) {
      if (mock || !apiKey) {
        const cube = join(ROOT, 'assets', 'meshes', 'cube.glb'); // 复用现成基础体作占位 glb
        return { buffer: existsSync(cube) ? readFileSync(cube) : Buffer.alloc(0), model: 'tripo-mock', mock: true, spec: { scale: 1, genCollision: 'hull' } };
      }
      // 真调（网络门控·Tripo v2 openapi）：submit → poll → download glb
      const base = 'https://api.tripo3d.ai/v2/openapi';
      const sub = await fetch(`${base}/task`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'text_to_model', prompt }) }).then((r) => r.json());
      const taskId = sub?.data?.task_id; if (!taskId) throw new Error('tripo: 无 task_id ' + JSON.stringify(sub));
      let url = null;
      for (let i = 0; i < 60; i++) {
        const st = await fetch(`${base}/task/${taskId}`, { headers: { authorization: `Bearer ${apiKey}` } }).then((r) => r.json());
        const s = st?.data?.status; if (s === 'success') { url = st.data.output?.pbr_model || st.data.output?.model; break; }
        if (s === 'failed' || s === 'banned') throw new Error('tripo 任务失败: ' + s);
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!url) throw new Error('tripo: 轮询超时');
      const buffer = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
      return { buffer, model: 'tripo-text-to-model', mock: false, spec: { scale: 1, genCollision: 'hull' } };
    },
  },
  qwen: {
    kind: 'texture', ext: 'png', envKey: 'DASHSCOPE_API_KEY', license: 'Qwen/DashScope 万相 (按订阅授权)',
    async generate(prompt, { mock, apiKey }) {
      if (mock || !apiKey) { const { buffer, w, h } = mockImage(prompt); return { buffer, model: 'wanx-mock', mock: true, spec: { format: 'png', width: w, height: h, usage: 'sprite' } }; }
      // 真调 DashScope 万相 text2image（异步任务·门控）
      const H = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'X-DashScope-Async': 'enable' };
      const sub = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', { method: 'POST', headers: H, body: JSON.stringify({ model: 'wanx2.1-t2i-turbo', input: { prompt }, parameters: { n: 1, size: '1024*1024' } }) }).then((r) => r.json());
      const taskId = sub?.output?.task_id; if (!taskId) throw new Error('qwen: 无 task_id ' + JSON.stringify(sub));
      let url = null;
      for (let i = 0; i < 60; i++) {
        const st = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, { headers: { authorization: `Bearer ${apiKey}` } }).then((r) => r.json());
        const s = st?.output?.task_status; if (s === 'SUCCEEDED') { url = st.output.results?.[0]?.url; break; }
        if (s === 'FAILED') throw new Error('qwen 任务失败');
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!url) throw new Error('qwen: 轮询超时');
      const buffer = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
      return { buffer, model: 'wanx2.1-t2i-turbo', mock: false, spec: { format: 'png', width: 1024, height: 1024, usage: 'sprite' } };
    },
  },
};

// ── 落地：产物 → 文件 + 索引条目（带 provenance）。game 给了=游戏本地 art/ai/；否则=共享货架 assets/ai/。──
export function buildEntry({ adapter, prompt, id, kind, spec, model, license, mock, servedPath, at }) {
  return {
    id, type: kind, description: `${prompt} · AI 生成(${adapter}${mock ? '·mock' : ''})`, status: 'filled',
    ...(servedPath ? { path: servedPath } : {}),
    category: kind === 'mesh' ? 'mesh' : 'ai-gen',
    tags: ['ai-gen', adapter, ...(mock ? ['mock'] : []), ...prompt.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)],
    license, source: `ai:${adapter}`, spec,
    provenance: { generator: adapter, prompt, model, mock: !!mock, generatedAt: at ?? '' },
  };
}

// 设置视图（可被 server /api 或 UI 复用）：列出各生成 provider 的 envKey + 是否已配 key（打码·绝不回明文）。
export function providerSettings(env = process.env) {
  const mask = (k) => (k ? k.slice(0, 3) + '***' + k.slice(-4) : '');
  return Object.entries(ADAPTERS).map(([id, a]) => ({
    id, kind: a.kind, license: a.license, envKey: a.envKey,
    keyConfigured: !!env[a.envKey], apiKeyMasked: mask(env[a.envKey]),
  }));
}

// 一键自测：两个适配器各 mock 生成一个到临时目录 → 打印落库条目 → 跑完自动清理（零仓库污染·零网络）。
export async function demo(env = process.env) {
  const dir = join(tmpdir(), 'apollo-ai-gen-demo');
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const out = [];
  try {
    for (const [name, prompt] of [['tripo', 'a wooden treasure chest'], ['qwen', 'pixel fire sword icon']]) {
      const A = ADAPTERS[name];
      const g = await A.generate(prompt, { mock: true, apiKey: env[A.envKey] });
      const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
      const file = join(dir, `${name}-${slug}.${A.ext}`); writeFileSync(file, g.buffer);
      const entry = buildEntry({ adapter: name, prompt, id: `ai/${name}/${slug}`, kind: A.kind, spec: g.spec, model: g.model, license: A.license, mock: g.mock, servedPath: `ai/${name}/${slug}.${A.ext}`, at: '' });
      out.push({ file, bytes: g.buffer.length, entry });
      console.log(`✓ ${name} mock → ${file} (${g.buffer.length} 字节)  条目 id=${entry.id} type=${entry.type}`);
    }
    console.log('\n落库条目（会 upsert 进 index.json 的正是这个 shape）：');
    console.log(JSON.stringify(out.map((o) => o.entry), null, 2));
    console.log('\n设置视图 providers（key 打码·绝不回明文）：');
    console.log(JSON.stringify(providerSettings(env), null, 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    console.log(`\n已清理临时目录 ${dir}（自测无副作用·未碰仓库文件）`);
  }
  return out;
}

async function run(argv) {
  const adapterName = argv[0];
  if (adapterName === 'demo') { await demo(); return; }
  if (adapterName === 'providers') { console.log(JSON.stringify(providerSettings(), null, 2)); return; }
  const A = ADAPTERS[adapterName];
  if (!A) { console.error(`用法: node scripts/ai-gen.mjs <${Object.keys(ADAPTERS).join('|')}|providers> "<prompt>" [--game <g>] [--id <id>] [--mock]`); process.exit(1); }
  const mock = argv.includes('--mock');
  const asJson = argv.includes('--json'); // 机读：后端/UI 解析用（打印一行 JSON，压过人读行）
  const gi = argv.indexOf('--game'), game = gi >= 0 ? argv[gi + 1] : null;
  const ii = argv.indexOf('--id'), forcedId = ii >= 0 ? argv[ii + 1] : null;
  const prompt = argv.slice(1).filter((a, i) => !a.startsWith('--') && argv[i] !== '--game' && argv[i] !== '--id').join(' ').trim();
  if (!prompt) { console.error('缺 prompt'); process.exit(1); }
  const apiKey = process.env[A.envKey];
  if (!mock && !apiKey) console.warn(`⚠ 未设 ${A.envKey}，改走 mock（真调需 key + 放宽网络）`);

  const g = await A.generate(prompt, { mock, apiKey });
  const slug = (forcedId ?? prompt).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'asset';
  const id = forcedId ?? `ai/${adapterName}/${slug}`;
  const fileRel = `ai/${adapterName}/${slug}.${A.ext}`;

  let servedPath, indexFile;
  if (game) {
    const abs = join(ROOT, 'public', 'games', game, 'art', fileRel);
    mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, g.buffer);
    servedPath = `/games/${game}/art/${fileRel}`;
    indexFile = join(ROOT, 'public', 'games', game, 'art', 'index.json');
  } else {
    const abs = join(ROOT, 'assets', fileRel);
    mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, g.buffer);
    servedPath = fileRel;
    indexFile = join(ROOT, 'assets', 'index.json');
  }
  const entry = buildEntry({ adapter: adapterName, prompt, id, kind: A.kind, spec: g.spec, model: g.model, license: A.license, mock: g.mock, servedPath, at: new Date().toISOString() });
  const idx = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : { version: 1, assets: [] };
  const byId = new Map(idx.assets.map((a) => [a.id, a])); byId.set(id, entry);
  idx.assets = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  writeFileSync(indexFile, JSON.stringify(idx, null, 2) + '\n');
  if (asJson) { console.log(JSON.stringify({ ok: true, id, type: A.kind, servedPath, mock: g.mock, scope: game ? `game:${game}` : 'shelf', entry })); return; }
  console.log(`✓ 生成 ${id}${g.mock ? ' (mock)' : ''} → ${servedPath}（登记进 ${game ? game + ' 本地' : '共享货架'}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2));
