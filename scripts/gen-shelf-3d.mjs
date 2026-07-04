// gen-shelf-3d —— 给共享货架（assets/index.json）备齐**公用 3D 基础素材**（REQ-PA-3D公用货架 ①）。
// 数据驱动 + 确定性 + 零网络：材质=数据条目（引 pbr 预设）；mesh=程序化 glb（基础体）；贴图/天空盒=登记已产/程序化产物。
// 幂等：按 id upsert，可复放、可审计。游戏**不直引货架**——用 scripts/vendor-asset.mjs copy 进本地 art/ 再引。
//
// 用法: node scripts/gen-shelf-3d.mjs [materials|meshes|textures|env|all]
//
// 边界：只写共享货架 assets/index.json（+ assets/{meshes,textures,env}/ 文件）。渲染消费端(P3D)不动。

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'assets', 'index.json');

// ── 公用材质货架（数据型·无文件·引 pbr 预设，与 src/assets/pbr-materials.ts 同名）──
// 每条 = 一个可 vendor 的「内置材质资源」；游戏 vendor 后 Material3D.materialRef 引它，物件 inline 字段可覆盖。
const MATERIALS = [
  ['matte', '哑光（陶土/塑料感·默认）'],
  ['plastic', '光面塑料（介电）'],
  ['steel', '钢（抛光·低粗糙）'],
  ['iron', '铸铁（暗·粗糙）'],
  ['gold', '金'],
  ['copper', '铜'],
  ['glass', '玻璃（透射）'],
  ['rock', '岩石（花岗岩/混凝土）'],
  ['dirt', '土（干土壤）'],
  ['wood', '木（橡木）'],
  ['emissive', '自发光'],
];

function materialEntries() {
  return MATERIALS.map(([preset, desc]) => ({
    id: `mat/${preset}`,
    type: 'material',
    description: `${desc} · 公用材质`,
    status: 'filled', // material 免 path（数据全在 spec·asset-index 校验放行）
    category: 'material',
    tags: ['material', 'pbr', 'shared-3d', preset],
    license: 'CC0-1.0', // 我方数据（引内置预设·无外部素材）
    source: 'apollo-shelf',
    spec: { preset },
  }));
}

// ── 汇总各类 → 一份 upsert 计划 ──
function buildPlan(which) {
  const plan = [];
  if (which === 'materials' || which === 'all') plan.push(...materialEntries());
  return plan;
}

const which = process.argv[2] ?? 'all';
const plan = buildPlan(which);
if (plan.length === 0) {
  console.error(`gen-shelf-3d: 无 "${which}" 类产物（可选 materials|meshes|textures|env|all）`);
  process.exit(1);
}

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const byId = new Map(idx.assets.map((a) => [a.id, a]));
let added = 0, updated = 0;
for (const e of plan) {
  if (byId.has(e.id)) updated++; else added++;
  byId.set(e.id, e);
}
idx.assets = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n');
console.log(`✓ 货架 3D「${which}」：新增 ${added} · 更新 ${updated} → assets/index.json（共 ${idx.assets.length} 项）`);
