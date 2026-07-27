// scripts/game-103-art-derive.mjs —— game-103《幸存者核心原型》美术需求推导（台账·零孤儿）。
// 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 模板的 Sprite 皮肤槽）→ 产 art-ledger.json（每条=一个
// 视觉实体的美术需求 + 当前占位几何体）。M1 阶段=零真资产·全占位色块 → 本表即「该配哪些美术」的完整清单。
// vite-node 跑（import game-103 的 TS buildBlueprint）。用法：npx vite-node scripts/game-103-art-derive.mjs [--gen]
import { buildBlueprint } from '../src/games/game-103/index.ts';
import { deriveRequirements, batchGenerate, mergeLedger } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bp = buildBlueprint();
const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-103', 'art', 'art-ledger.json');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
// append-only 并入现台账：旧槽位保原编号/状态/prompt，新槽位顺延，消失槽位墓碑保号。
const ledger = mergeLedger(prev, deriveRequirements({ entities: bp.entities }, { game: 'game-103' }));

const OUT = process.env.ARTREQ_OUT || join(tmpdir(), 'game-103-artreq');
// 素材库=「有意义的美术资产」清单（owner 反馈：创作台里 59 个纯色块·多是内部几何非游戏素材）。
// 全实体扫描会把血条/网格线/光环/粒子/核/多敌变体逐个当独立槽 → 噪声。收敛为**每个唯一皮肤（skinKey）一行**：
//  ① 丢无 skinKey 的纯几何（血条/网格/光环/粒子/障碍帽/核=程序化渲染件·无需美术图）；
//  ② 同一皮肤被多实体（如各敌变体共用 enemy-brute）复用 → 只留代表行（首见·保编号）。
// → 库里剩「玩家/各敌/Boss/三宝石/各武器弹/障碍」等一眼认得的真资产。纯 VFX（冲击波粒子/敌弹）走程序化·不入库。
{
  const seenSkin = new Set();
  ledger.rows = ledger.rows.filter((r) => {
    if (!r.skinKey) return false;
    if (seenSkin.has(r.skinKey)) return false;
    seenSkin.add(r.skinKey);
    return true;
  });
  ledger.count = ledger.rows.length;
  ledger.instances = ledger.rows.length;
  // 状态/路径对齐真相：以游戏实载 index.json（filled 资产）回填 status + provenance.path，令徽标(已填回/待配)与
  // 「现用」预览都指向玩家真正看到的图（emoji/SVG）——修台账 status/provenance 陈旧（如 shambler 标 .svg 实为 .png）。
  const INDEX_FILE = join(ROOT, 'public', 'games', 'game-103', 'art', 'index.json');
  if (existsSync(INDEX_FILE)) {
    const idx = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
    const filled = new Map((idx.assets || []).filter((a) => a.status === 'filled' && a.id && a.path).map((a) => [a.id, a.path]));
    for (const r of ledger.rows) {
      const p = r.skinKey && filled.get(r.skinKey);
      // servedPath 也指真图：现网创作台缩略图读 gen.servedPath → 无需重部署前端即可显示真图（服务端实时读本台账）。
      if (p) { r.status = 'filled'; r.provenance = { ...(r.provenance || {}), path: p }; r.gen = { ...(r.gen || {}), servedPath: p }; }
    }
  }
}
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  const r = await batchGenerate(ledger, 'pixel-retro', { root: OUT, game: 'game-103', mock: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');
  console.error('[gen]', JSON.stringify(r.summary));
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# game-103《幸存者核心原型》资产需求表（${ledger.rows.length} 项·管线自动推导）\n`);
lines.push('> 来源：美术替换管线 deriveRequirements 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 模板）。M1 现状=零真资产·全占位几何体 → 本表即完整美术需求清单。\n');
lines.push('| 编号 | 类型 | 实体/槽位 | 当前占位 | 美术需求描述 | 规格 |');
lines.push('|---|---|---|---|---|---|');
for (const r of ledger.rows) {
  const spec = r.kind === 'model3d' ? `scale ${r.spec.scale}·poly≤${r.spec.polyBudget}` : `${r.spec.w}×${r.spec.h}${r.spec.transparent ? '·透明底' : '·满幅'}`;
  lines.push(`| ${r.no} | ${r.kind} | ${esc(r.slot.entity)} | ${esc(r.placeholder.current)} | ${esc(r.context)} | ${spec} |`);
}
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON（工具读此路径）：public/games/game-103/art/art-ledger.json`);
const md = lines.join('\n');
console.log(md);
writeFileSync(join(OUT, 'game-103-art-requirements.md'), md + '\n');
