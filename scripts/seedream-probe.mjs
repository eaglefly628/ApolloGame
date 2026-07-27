// seedream-probe —— 直连火山方舟 images/generations 探活（绕过工坊全栈·定位 ModelNotOpen 真因）。
// owner 2026-07-21：「Seedream 应有文生图权限·怎么验证」→ 本脚本拿你本地 key 直打 API·打印原始返回，
// 分清「代码问题 vs 账号/模型 ID 问题」。挨个试候选模型 ID + 你自定义的 ID/接入点(ep-)。
//
// 用法（在你跑 app 的机器上）：
//   node scripts/seedream-probe.mjs                 # 读 .apollo-config.json 或 env 的 ARK_API_KEY·试内置候选
//   node scripts/seedream-probe.mjs ep-2024xxxx     # 额外试你控制台的接入点 ID / 或某个精确模型 ID
//   ARK_API_KEY=xxx node scripts/seedream-probe.mjs # 直接用环境变量的 key
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

// key 来源：env 优先 → 本地配置 .apollo-config.json 的 genKeys.ARK_API_KEY（工坊设置存的地方）。
function loadKey() {
  if (process.env.ARK_API_KEY) return { key: process.env.ARK_API_KEY, from: 'env ARK_API_KEY' };
  const cf = join(ROOT, '.apollo-config.json');
  if (existsSync(cf)) {
    try {
      const cfg = JSON.parse(readFileSync(cf, 'utf8'));
      const k = cfg?.genKeys?.ARK_API_KEY;
      if (typeof k === 'string' && k.trim()) return { key: k.trim(), from: '.apollo-config.json genKeys.ARK_API_KEY' };
    } catch { /* ignore */ }
  }
  return { key: null, from: null };
}

// 候选模型 ID（工坊下拉那三个）+ 命令行额外传入的（你控制台的精确 ID / ep- 接入点）。
const CANDIDATES = ['doubao-seedream-4-0-250828', 'doubao-seedream-4-5-251128', 'doubao-seedream-5-0-260128'];
const extra = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const models = [...extra, ...CANDIDATES];

async function tryModel(key, model) {
  const body = { model, prompt: 'a single red apple on a white table, product photo', size: '1024x1024', response_format: 'url', watermark: false };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    const url = json?.data?.[0]?.url;
    const errCode = json?.error?.code || json?.code;
    const errMsg = json?.error?.message || json?.message;
    if (res.ok && url) return { model, ok: true, status: res.status, note: '✅ 出图成功 → ' + url.slice(0, 80) + '…' };
    return { model, ok: false, status: res.status, note: `✗ HTTP ${res.status}` + (errCode ? ` · code=${errCode}` : '') + (errMsg ? ` · ${String(errMsg).slice(0, 160)}` : ` · ${text.slice(0, 160)}`) };
  } catch (e) {
    // 摊平 e.cause 链的真因：ENOTFOUND=DNS 解析不到（域名/网络）·ECONNREFUSED=拒连·UND_ERR_CONNECT_TIMEOUT=连接超时·
    // CERT_*=证书（多为代理中间人）——全是「连不上」，与 key 无关（key 错会是 HTTP 4xx 走上一分支）。
    const cause = e && e.cause;
    const code = (cause && (cause.code || (Array.isArray(cause.errors) && cause.errors[0] && cause.errors[0].code))) || '';
    return { model, ok: false, status: 0, note: `✗ 网络/连接失败：${code ? code + ' · ' : ''}${String(e && e.message || e).slice(0, 120)}（连不上·非 key 问题；本机能否访问 ark.cn-beijing.volces.com？走代理的话 Node 不自动用系统代理）` };
  }
}

const { key, from } = loadKey();
if (!key) {
  console.error('✗ 没找到 ARK_API_KEY——先在工坊设置页填 Seedream key（存 .apollo-config.json），或 ARK_API_KEY=xxx 前缀运行。');
  process.exit(1);
}
console.log(`🔑 key 来源：${from} · 打码 ${key.slice(0, 3)}***${key.slice(-4)}`);
console.log(`🎯 端点：${ENDPOINT}`);
console.log(`🧪 依次试 ${models.length} 个模型 ID …\n`);
let anyOk = false;
for (const m of models) {
  const r = await tryModel(key, m);
  if (r.ok) anyOk = true;
  console.log(`  ${r.ok ? '✅' : '  '} ${m}\n     ${r.note}\n`);
}
console.log(anyOk
  ? '结论：至少一个模型 ID 出图成功 → 把它填进工坊「Seedream 模型版本」（或设置里的自定义 ID）即可真出图。'
  : '结论：全部失败。若都是 ModelNotOpen=账号未开通该模型（去火山方舟控制台「开通管理」开通 Doubao-Seedream）；\n' +
    '  若报 InvalidEndpoint/找不到模型=需用控制台「模型推理→预置推理接入点」的 ep- 开头 ID（把它作参数再跑：node scripts/seedream-probe.mjs ep-xxxx）；\n' +
    '  若网络失败=本机访问不到火山方舟域名。把上面每行原始返回发我，我据此接线。');
