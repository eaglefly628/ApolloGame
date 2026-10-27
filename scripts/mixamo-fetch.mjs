// Mixamo 动作批量下载到本机私有目录（owner 2026-10-25 令：先下载、不入库、不上传）。
// - 走 mixamo.com 网页端同一组接口（非官方 API，接口形状可能随时变）：搜索 → 取详情 → 发起导出 → 轮询 → 下载。
// - 凭证 = 你自己浏览器里登录 mixamo.com 后的 access_token，只从环境变量 MIXAMO_TOKEN 读，不落盘、不打印。
// - 保守节流：串行、每个间隔 --delay-ms（缺省 4000）、单次最多 --max（缺省 40）；401/403/429 立即停，不重试。
// - 输出目录必须在仓库外（公开仓库不得含 Mixamo 原件）；manifest.json 记来源与 SHA，可断点续传。
// 用法见 docs/design/ai-pipeline/mixamo-library.md。
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve, dirname, relative, isAbsolute, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://www.mixamo.com/api/v1';
export const DEFAULT_OUT = join(homedir(), 'ApolloAssets', 'mixamo');
export const DEFAULT_LIST = join(ROOT, 'docs', 'design', 'ai-pipeline', 'mixamo-list.json');
const LICENSE_URL = 'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html';
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export const MIN_EXPORT_DELAY_MS = 4000;
export const MAX_EXPORTS_PER_RUN = 40;
export class StopError extends Error {}
function reject(message) { console.error(`[mixamo-fetch] reject: ${message}`); throw Object.assign(new Error(message), { logged: true }); }

function validateRateLimits(max, delayMs) {
  if (!Number.isInteger(max) || max < 1 || max > MAX_EXPORTS_PER_RUN) reject('--max 必须为 1–40');
  // Values above the native timer range wrap to ~1ms in Node, defeating the floor.
  if (!Number.isInteger(delayMs) || delayMs < MIN_EXPORT_DELAY_MS || delayMs > 2147483647) reject('--delay-ms 必须为 4000–2147483647（防限流封号）');
}

/** 清单：[{ id, query, pick?, inPlace?, note? }]。id 即本地文件名。 */
export function validateList(list) {
  if (!Array.isArray(list) || !list.length) reject('清单必须是非空数组');
  const ids = new Set();
  for (const [i, e] of list.entries()) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) reject(`第 ${i} 项必须是对象`);
    for (const k of Object.keys(e)) if (!['id', 'query', 'pick', 'inPlace', 'note'].includes(k)) reject(`第 ${i} 项未知字段 ${k}`);
    if (typeof e.id !== 'string' || !ID.test(e.id) || ids.has(e.id)) reject(`第 ${i} 项 id 非法或重复（小写字母开头，字母数字连字符）`);
    ids.add(e.id);
    if (typeof e.query !== 'string' || !e.query.trim()) reject(`${e.id}: 缺 query`);
    if (e.pick !== undefined && (typeof e.pick !== 'string' || !e.pick.trim())) reject(`${e.id}: pick 必须是非空字符串`);
    if (e.inPlace !== undefined && typeof e.inPlace !== 'boolean') reject(`${e.id}: inPlace 必须是布尔`);
  }
  return list;
}

/** 公开仓库不得含 Mixamo 原件：输出目录落在仓库内一律拒绝。 */
export function assertOutsideRepo(outDir, repoRoot = ROOT) {
  const requested = resolve(outDir);
  let ancestor = requested;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const physical = resolve(realpathSync(ancestor), relative(ancestor, requested));
  const rel = relative(realpathSync(resolve(repoRoot)), physical);
  if (rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))) reject(`输出目录 ${outDir} 在仓库内；Mixamo 原件只能放仓库外（缺省 ${DEFAULT_OUT}）`);
  for (let parent = physical; ; parent = dirname(parent)) {
    if (existsSync(join(parent, '.git'))) reject(`输出目录 ${outDir} 在仓库内；Mixamo 原件只能放仓库外`);
    if (dirname(parent) === parent) break;
  }
  return physical;
}

function localOutput(outDir, name) {
  if (typeof name !== 'string' || basename(name) !== name) reject('输出文件必须在下载目录内');
  if (assertOutsideRepo(outDir) !== outDir) reject('输出目录的物理路径已改变');
  const file = join(outDir, name);
  if (assertOutsideRepo(file) !== file) reject('输出文件存在物理别名');
  return file;
}
function publishFile(outDir, name, bytes) {
  const file = localOutput(outDir, name), temporary = localOutput(outDir, name + '.tmp');
  let created = false;
  try {
    // Exclusive temp creation never follows an existing symlink or hard link.
    writeFileSync(temporary, bytes, { flag: 'wx' }); created = true;
    localOutput(outDir, name); localOutput(outDir, name + '.tmp');
    // rename replaces the local directory entry, never writes through a final symlink.
    renameSync(temporary, file); created = false;
  } finally {
    if (created) {
      try { if (localOutput(outDir, name + '.tmp') === temporary) rmSync(temporary); }
      catch { /* Preserve evidence instead of following a changed path during cleanup. */ }
    }
  }
}
function publicFailure(error, stage) {
  if (error instanceof StopError) {
    const status = /\b(401|403|429)\b/.exec(String(error.message))?.[1];
    return status === '429' ? 'HTTP 429：限流，停止本轮' : status ? `HTTP ${status}：token 失效或无权限，停止本轮` : '安全停止本轮';
  }
  // Remote messages/network exceptions may echo Authorization. Never publish them.
  return `${stage} 阶段失败（远端或文件诊断已省略）`;
}

export function createClient({ token, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !token.trim()) reject('缺 MIXAMO_TOKEN：浏览器登录 mixamo.com → 开发者工具 Console 执行 localStorage.access_token → 复制到环境变量');
  const headers = { Authorization: `Bearer ${token.trim()}`, 'X-Api-Key': 'mixamo2', Accept: 'application/json' };
  async function call(path, init = {}) {
    let res;
    try { res = await fetchImpl(`${API}${path}`, { ...init, headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } }); }
    catch { throw new Error('Mixamo 网络请求失败（诊断已省略）'); }
    if (res.status === 401 || res.status === 403) throw new StopError(`HTTP ${res.status}：token 失效或无权限（重新登录 mixamo.com 取新 token；中国区 Adobe 账号不可用 Mixamo）`);
    if (res.status === 429) throw new StopError('HTTP 429：被限流，停止本轮，稍后再跑（已下的会续传跳过）');
    if (!res.ok) throw new Error(`HTTP ${res.status} Mixamo API`);
    try { return await res.json(); } catch { throw new Error('Mixamo JSON 响应读取失败（诊断已省略）'); }
  }
  return {
    primaryCharacter: async () => {
      const r = await call('/characters/primary');
      if (typeof r?.primary_character_id !== 'string') throw new Error('取不到当前角色；请用 --character <id> 指定');
      return { id: r.primary_character_id, name: r.primary_character_name ?? '' };
    },
    search: async (query) => {
      const r = await call(`/products?page=1&limit=24&order=&type=Motion%2CMotionPack&query=${encodeURIComponent(query)}`);
      if (!Array.isArray(r?.results)) throw new Error('搜索返回形状不认识（接口可能已变）');
      return r.results.filter((x) => x.type === 'Motion');
    },
    product: (id, characterId) => call(`/products/${encodeURIComponent(id)}?similar=0&character_id=${encodeURIComponent(characterId)}`),
    exportMotion: (body) => call('/animations/export', { method: 'POST', body: JSON.stringify(body) }),
    monitor: (characterId) => call(`/characters/${encodeURIComponent(characterId)}/monitor`),
    download: async (url) => {
      let res;
      try { res = await fetchImpl(url); } catch { throw new Error('Mixamo 下载请求失败（诊断已省略）'); }
      if ([401, 403, 429].includes(res.status)) throw new StopError(`下载 HTTP ${res.status}：停止本轮`);
      if (!res.ok) throw new Error(`下载 HTTP ${res.status}`);
      try { return Buffer.from(await res.arrayBuffer()); } catch { throw new Error('Mixamo 下载响应读取失败（诊断已省略）'); }
    },
  };
}

/** 选结果：有 pick 按显示名精确（不分大小写）匹配，否则取第一个。 */
export function pickResult(entry, results) {
  if (!results.length) return null;
  if (!entry.pick) return results[0];
  const want = entry.pick.trim().toLowerCase();
  return results.find((r) => String(r.description ?? r.name ?? '').trim().toLowerCase() === want) ?? null;
}

/** 导出请求体：沿用详情里的 gms_hash，params 压成逗号串；inPlace 只在动作支持时开。 */
export function exportBody(product, characterId, { inPlace = false, fps = 30 } = {}) {
  const gms = product?.details?.gms_hash;
  if (!gms || typeof gms !== 'object' || !Array.isArray(gms.params)) throw new Error('动作详情缺 gms_hash（接口可能已变）');
  const supportsInPlace = !!product.details.supports_inplace;
  return {
    body: {
      character_id: characterId,
      gms_hash: [{ ...gms, params: gms.params.map((p) => (Array.isArray(p) ? p[1] : p)).join(','), inplace: inPlace && supportsInPlace }],
      preferences: { format: 'fbx7', skin: 'false', fps: String(fps), reducekf: '0' },
      product_name: product.description ?? product.name,
      type: 'Motion',
    },
    inPlaceApplied: inPlace && supportsInPlace,
  };
}

async function waitJob(client, characterId, { pollMs, timeoutMs }) {
  for (let waited = 0; waited <= timeoutMs; waited += pollMs) {
    const m = await client.monitor(characterId);
    if (m?.status === 'completed' && typeof m.job_result === 'string') return m.job_result;
    if (m?.status === 'failed') throw new Error(`导出失败：${m.message ?? '未知原因'}`);
    await sleep(pollMs);
  }
  throw new Error(`导出超时（${timeoutMs}ms）`);
}

function fileKind(buf) {
  if (buf.subarray(0, 18).toString('latin1') === 'Kaydara FBX Binary') return 'fbx';
  if (buf.subarray(0, 2).toString('latin1') === 'PK') return 'zip';
  return null;
}

function readManifest(outDir) {
  const file = localOutput(outDir, 'manifest.json');
  if (!existsSync(file)) return { version: 1, source: 'mixamo-fetch', licenseUrl: LICENSE_URL, clips: {} };
  const m = JSON.parse(readFileSync(file, 'utf8'));
  if (m?.version !== 1 || !m.clips || typeof m.clips !== 'object') reject(`${file} 不是本工具的 manifest`);
  return m;
}
function writeManifest(outDir, m) {
  publishFile(outDir, 'manifest.json', JSON.stringify(m, null, 2) + '\n');
}

/**
 * 跑一轮。searchOnly=true 只搜不下（先核对搜索词选中了什么）。
 * 返回 { downloaded, skipped, failed, stopped, plan }。
 */
export async function runFetch({ list, outDir = DEFAULT_OUT, client, characterId, searchOnly = false, max = 40, delayMs = 4000, pollMs = 2000, timeoutMs = 120000, fps = 30, only = null, now = () => new Date().toISOString(), wait = sleep }) {
  validateRateLimits(max, delayMs);
  if (typeof wait !== 'function') reject('wait 必须是等待函数');
  validateList(list);
  outDir = assertOutsideRepo(outDir);
  const entries = only ? list.filter((e) => only.includes(e.id)) : list;
  const result = { downloaded: [], skipped: [], failed: [], stopped: null, plan: [] };
  let manifest = null;
  if (!searchOnly) { mkdirSync(outDir, { recursive: true }); manifest = readManifest(outDir); }
  let exported = 0;
  for (const entry of entries) {
    const prev = manifest?.clips[entry.id];
    if (prev && existsSync(join(outDir, prev.file)) && sha256(readFileSync(join(outDir, prev.file))) === prev.sha256) {
      console.info(`[mixamo-fetch] skip: ${entry.id} 已下载且 SHA 一致`); result.skipped.push(entry.id); continue;
    }
    if (!searchOnly && exported >= max) { console.info(`[mixamo-fetch] skip: 已达本轮上限 ${max}，其余下次续传`); break; }
    let stage = 'search';
    try {
      const results = await client.search(entry.query);
      const hit = pickResult(entry, results);
      if (!hit) {
        console.warn(`[mixamo-fetch] reject: ${entry.id} 搜「${entry.query}」${entry.pick ? `无精确匹配「${entry.pick}」` : '无结果'}；候选：${results.slice(0, 5).map((r) => r.description ?? r.name).join(' / ') || '—'}`);
        result.failed.push({ id: entry.id, error: 'no-match' }); continue;
      }
      const name = hit.description ?? hit.name;
      if (searchOnly) {
        console.info(`[mixamo-fetch] decision: ${entry.id} ← 「${name}」（候选：${results.slice(0, 5).map((r) => r.description ?? r.name).join(' / ')}）`);
        result.plan.push({ id: entry.id, name, mixamoId: hit.id }); continue;
      }
      if (exported > 0) await wait(delayMs);
      exported++;
      stage = 'product';
      const product = await client.product(hit.id, characterId);
      const { body, inPlaceApplied } = exportBody(product, characterId, { inPlace: !!entry.inPlace, fps });
      if (entry.inPlace && !inPlaceApplied) console.warn(`[mixamo-fetch] decision: ${entry.id} 动作不支持 In Place，按原位移下载`);
      stage = 'export';
      await client.exportMotion(body);
      stage = 'monitor';
      const url = await waitJob(client, characterId, { pollMs, timeoutMs });
      stage = 'download';
      const buf = await client.download(url);
      const kind = fileKind(buf);
      if (!kind) throw new Error('下载内容既不是二进制 FBX 也不是 zip');
      const file = `${entry.id}.${kind}`;
      stage = 'publish';
      publishFile(outDir, file, buf);
      manifest.clips[entry.id] = { file, sha256: sha256(buf), bytes: buf.length, searchTerm: entry.query, mixamoName: name, mixamoId: hit.id, characterId, download: { format: 'FBX', skin: false, fps, inPlace: inPlaceApplied }, downloadedAt: now() };
      writeManifest(outDir, manifest);
      console.info(`[mixamo-fetch] commit: ${entry.id} ← 「${name}」 ${buf.length} bytes${kind === 'zip' ? '（zip：需手动解压）' : ''}`);
      result.downloaded.push(entry.id);
    } catch (e) {
      const message = publicFailure(e, stage);
      if (e instanceof StopError) { console.error(`[mixamo-fetch] reject: ${message}`); result.stopped = message; break; }
      console.warn(`[mixamo-fetch] reject: ${entry.id} ${message}`); result.failed.push({ id: entry.id, error: message });
    }
  }
  return result;
}

function parseArgs(argv) {
  const o = { list: DEFAULT_LIST, out: DEFAULT_OUT, searchOnly: false, max: 40, delayMs: 4000, fps: 30, character: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { const x = argv[++i]; if (x === undefined) reject(`${a} 缺参数`); return x; };
    if (a === '--list') o.list = v(); else if (a === '--out') o.out = v(); else if (a === '--search-only') o.searchOnly = true;
    else if (a === '--max') o.max = Number(v()); else if (a === '--delay-ms') o.delayMs = Number(v()); else if (a === '--fps') o.fps = Number(v());
    else if (a === '--character') o.character = v(); else if (a === '--only') o.only = v().split(',').map((s) => s.trim()).filter(Boolean);
    else reject(`未知参数 ${a}`);
  }
  validateRateLimits(o.max, o.delayMs);
  if (![24, 30, 60].includes(o.fps)) reject('--fps 只收 24 / 30 / 60');
  return o;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  try {
    const o = parseArgs(argv);
    const list = validateList(JSON.parse(readFileSync(o.list, 'utf8')));
    const client = createClient({ token: env.MIXAMO_TOKEN });
    let characterId = o.character;
    if (!characterId) { const c = await client.primaryCharacter(); characterId = c.id; console.info(`[mixamo-fetch] decision: 用当前角色 ${c.name || c.id}（建议在网页上先选 Y Bot）`); }
    const r = await runFetch({ list, outDir: o.out, client, characterId, searchOnly: o.searchOnly, max: o.max, delayMs: o.delayMs, fps: o.fps, only: o.only });
    console.log(`[mixamo-fetch] ${o.searchOnly ? `核对 ${r.plan.length}` : `下载 ${r.downloaded.length}`} · 跳过 ${r.skipped.length} · 失败 ${r.failed.length}${r.stopped ? ' · 已停止' : ''} · 目录 ${o.out}`);
    return r.stopped || r.failed.length ? 1 : 0;
  } catch (e) {
    if (!e.logged) console.error(`[mixamo-fetch] reject: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
