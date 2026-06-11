// 视觉打标汇合 —— 把并行批次产出（/tmp/vision-out/agent-*.json）合并成货架的
// 生成式数据层 assets/FreeArtLib/tags-vision.json（id → 语义标签，定序、去重、过滤废词）。
// 用法：node scripts/merge-vision-tags.mjs [--in /tmp/vision-out]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const IN = process.argv.includes('--in') ? process.argv[process.argv.indexOf('--in') + 1] : '/tmp/vision-out';
const OUT = 'assets/FreeArtLib/tags-vision.json';
const BATCH_DIR = '/tmp/vision-batches';

// 纪律兜底：废词/颜色词（像素层已有）一律过滤；标签必须 snake_case 小写。
const BANNED = new Set([
  'pixel', 'sprite', 'game', 'art', 'image', 'asset', 'icon', 'tile',
  'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'brown', 'white', 'gray', 'grey', 'black',
  'dark', 'bright', 'small', 'large', 'big', 'tiny',
]);
const VALID = /^[a-z][a-z0-9_]*$/;

const merged = {};
let files = 0;
let dropped = 0;
for (const name of readdirSync(IN).filter((n) => n.endsWith('.json')).sort()) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(IN, name), 'utf8'));
  } catch (e) {
    console.error(`✗ ${name} 解析失败：${e.message}`);
    continue;
  }
  files++;
  for (const [id, tags] of Object.entries(data)) {
    if (!Array.isArray(tags)) continue;
    const clean = [...new Set(tags
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => VALID.test(t) && !BANNED.has(t)))].slice(0, 10);
    dropped += tags.length - clean.length;
    if (clean.length) merged[id] = clean;
  }
}

// 完整性核对：批次清单里每个 id 是否都有产出
let expected = 0;
const missing = [];
if (existsSync(BATCH_DIR)) {
  for (const name of readdirSync(BATCH_DIR).filter((n) => n.endsWith('.json')).sort()) {
    for (const item of JSON.parse(readFileSync(join(BATCH_DIR, name), 'utf8'))) {
      expected++;
      if (!merged[item.id]) missing.push(item.id);
    }
  }
}

const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
const out = {
  version: 1,
  generator: 'in-session visual scan（claude 沙盒内逐格看图；语义层，与像素事实层/人工精标分层）',
  tagged: Object.keys(sorted).length,
  expected,
  missingCount: missing.length,
  missing: missing.slice(0, 200),
  tags: sorted,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`合并 ${files} 个批次文件 → ${OUT}`);
console.log(`打标 ${out.tagged}/${expected || '?'}，缺失 ${missing.length}，过滤废词/越界 ${dropped} 个`);
if (missing.length) console.log('缺失样例:', missing.slice(0, 10).join(', '));
