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
// 素材库=**完整但干净**的美术清单（owner「要更全·含背景」+ 反前次「59 个纯色块·多是内部几何」）。规则：
//  ① 有 skinKey 的实体：按 skinKey 去重（多敌变体共用一张图→一行）——玩家/各敌/Boss/三宝石/各武器弹/障碍。
//  ② 无 skinKey 的**有意义程序化视觉**：每类归并一行（敌弹/冲击波/爆炸/命中火花）——现走程序化·但美术可换皮，入库列为需求。
//  ③ 补全场景层：**战场背景**（art-spec §6·现用几何网格占位）。
//  ④ 丢纯 UI/几何噪声：血条/网格线实例/光环/内芯/障碍帽/计分区（程序化·无需独立美术图）。
const KEEP_VFX = [
  { re: /ebolt/, id: 'vfx:enemy-bolt', name: '敌方子弹（射手弹幕）', desc: 'enemy projectile bolt, glowing crimson hostile energy orb with red halo, top-down 2d, isolated subject, transparent background', w: 20, h: 20 },
  { re: /sparks_shock|proj_shock/, id: 'vfx:shock', name: '冲击波特效', desc: 'shockwave nova burst, radial cyan energy particles exploding outward, top-down 2d, isolated subject, transparent background', w: 120, h: 120 },
  { re: /explosion/, id: 'vfx:explosion', name: '炸弹爆炸特效', desc: 'bomb explosion blast, orange fireball ring, top-down 2d, isolated subject, transparent background', w: 208, h: 208 },
  { re: /hitfx/, id: 'vfx:hit-spark', name: '命中火花', desc: 'hit spark impact, tiny white-yellow flash burst, top-down 2d, isolated subject, transparent background', w: 12, h: 12 },
  { re: /proj_trail/, id: 'vfx:trail', name: '尾迹刃灼烧段', desc: 'movement trail scorch segment, glowing cyan energy burn circle fading out, top-down 2d, isolated subject, transparent background', w: 30, h: 30 },
];
const DROP_RE = /hpbar|:inner|-core\b|core$|glow|gridh-|gridv-|obstacle-cap|killbox|collector/;
{
  const seen = new Set();
  const out = [];
  for (const r of ledger.rows) {
    if (r.skinKey) {
      if (seen.has(r.skinKey)) continue;
      seen.add(r.skinKey); out.push(r); continue;
    }
    const e = r.slot?.entity || '';
    if (DROP_RE.test(e)) continue;                      // 纯几何/子件（含敌弹 glow）→ 丢
    const vfx = KEEP_VFX.find((v) => v.re.test(e));
    if (!vfx) continue;                                 // 其余无名几何 → 丢
    if (seen.has(vfx.id)) continue;                     // 同类 VFX 多实例 → 只留一行
    seen.add(vfx.id);
    r.query = vfx.name; r.desc = vfx.name;
    r.context = `美术需求：${vfx.name}（程序化视觉·可换皮）·${vfx.desc}`;
    r.prompt = vfx.desc;
    r.spec = { ...(r.spec || {}), w: vfx.w, h: vfx.h, displayW: vfx.w, displayH: vfx.h, transparent: true };
    out.push(r);
  }
  // ③ 战场背景槽（game 现用几何网格·art-spec §6 要背景/地砖·库里应列出为需求）。
  // 先剔除任何旧 field-bg 行（含上次非法编号 art-bg）→ 再以合法 art-NN 数字重注（后端 regenerate 校验 `art-\d+`）。
  const outNoBg = out.filter((r) => r.skinKey !== '103/field-bg');
  const maxNo = outNoBg.reduce((m, r) => { const n = parseInt(String(r.no || '').replace(/^art-/, ''), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
  const bgNo = `art-${String(maxNo + 1).padStart(2, '0')}`;
  outNoBg.push({
    no: bgNo, kind: 'bg', skinKey: '103/field-bg',
    slot: { entity: 'field-background', component: 'Tilemap', field: 'art' },
    query: '战场地面背景', desc: '战场地面背景',
    prompt: 'top-down survival arena ground, dark tileable terrain with subtle texture, seamless repeat, no subject',
    spec: { w: 512, h: 512, displayW: 512, displayH: 512, transparent: false },
    placeholder: { current: '几何网格线（程序化·gridh/gridv）', source: 'procedural', count: 1 },
    context: '美术需求：战场地面背景（可平铺 tile·art-spec §6）·当前=世界网格线占位·填后地面贴图化',
    status: 'needs-art',
  });
  ledger.rows = outNoBg;
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
