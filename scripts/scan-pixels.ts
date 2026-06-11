// 像素扫描器 —— 确定性程序打标（零 API、零花费；同输入永远同输出）。
// 核心逻辑在 src/assets/import/{png-decode,pixel-tags}.ts（纯函数、已单测），本脚本只是壳。
//
// 用法（vite-node）：
//   npx vite-node scripts/scan-pixels.ts            # 扫 FreeArtLib 全量（PNG）
//       → assets/FreeArtLib/tags-scan.json（id→事实标签 + 语义对账嫌疑单）
//       之后跑 node scripts/build-artlib-index.mjs 把标签并进 index.json
//   npx vite-node scripts/scan-pixels.ts --assets   # 扫 assets/index.json 已填 PNG 贴图
//       → tags 合并写回条目 + provenance.pixelScan 留痕（导入后由 apollo 自动调用）
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from '../src/assets/import/png-decode.js';
import { pixelTags, auditSemanticTags, type TagSuspicion } from '../src/assets/import/pixel-tags.js';
import { artlibSemanticTags, type ArtLibIndex } from '../src/assets/artlib.js';

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');

function scanArtlib(): void {
  const index = JSON.parse(readFileSync(join(ROOT, 'assets/FreeArtLib/index.json'), 'utf8')) as ArtLibIndex;
  const tags: Record<string, string[]> = {};
  const suspects: Array<{ id: string; semantic: string[]; suspicions: TagSuspicion[] }> = [];
  let scanned = 0;
  let skipped = 0;

  for (const a of [...index.assets].sort((x, y) => x.id.localeCompare(y.id))) {
    const sample = a.sample ?? `${a.subject}.png`;
    if (!sample.toLowerCase().endsWith('.png')) {
      skipped++; // cardgame webp 等非 PNG（解码器只做 PNG；webp 卡面本就不需要色彩检索）
      continue;
    }
    const file = join(ROOT, index.root, a.cat, a.sub, sample);
    try {
      const { w, h, px } = decodePng(readFileSync(file));
      const r = pixelTags(px, w, h);
      if (r.tags.length) tags[a.id] = r.tags;
      const sem = artlibSemanticTags(a);
      const sus = auditSemanticTags(sem, r.stats);
      if (sus.length) suspects.push({ id: a.id, semantic: sem, suspicions: sus });
      scanned++;
    } catch {
      skipped++;
    }
  }

  const out = {
    version: 1,
    generator: 'scripts/scan-pixels.ts（确定性像素扫描；事实标签，非语义识别）',
    scanned,
    skipped,
    suspectCount: suspects.length,
    tags,
    suspects,
  };
  writeFileSync(join(ROOT, 'assets/FreeArtLib/tags-scan.json'), JSON.stringify(out));
  console.log(`FreeArtLib 扫描：${scanned} 张，跳过 ${skipped}（非 PNG/解码失败），打标 ${Object.keys(tags).length} 条`);
  console.log(`语义对账嫌疑：${suspects.length} 条`);
  for (const s of suspects.slice(0, 12)) {
    console.log(`  ⚠ ${s.id} — ${s.suspicions.map((x) => `声称 ${x.claim}，${x.expect} 实测 ${x.actual}`).join('；')}`);
  }
  console.log('下一步：node scripts/build-artlib-index.mjs 把标签并进 index.json');
}

function scanAssetsIndex(): void {
  const p = join(ROOT, 'assets/index.json');
  const index = JSON.parse(readFileSync(p, 'utf8')) as {
    assets: Array<{ id: string; type: string; status: string; path?: string; tags?: string[]; provenance?: Record<string, unknown> }>;
  };
  let scanned = 0;
  for (const e of index.assets) {
    if (e.type !== 'texture' || e.status !== 'filled' || !e.path?.toLowerCase().endsWith('.png')) continue;
    try {
      const { w, h, px } = decodePng(readFileSync(join(ROOT, 'assets', e.path)));
      const { tags } = pixelTags(px, w, h);
      const old = e.tags ?? [];
      e.tags = [...old, ...tags.filter((t) => !old.includes(t))];
      e.provenance = { ...(e.provenance ?? {}), pixelScan: { v: 1 } };
      scanned++;
    } catch {
      /* 单张失败跳过 */
    }
  }
  writeFileSync(p, JSON.stringify(index, null, 2) + '\n');
  console.log(`assets/index.json：像素扫描合并 ${scanned} 条`);
}

if (process.argv.includes('--assets')) scanAssetsIndex();
else scanArtlib();
