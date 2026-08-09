// scripts/game108-art-previews.mjs —— 把**当前的程序化画法**导出成台账每一行的预览图。
//
// ══ 为什么（owner 2026-08-08 review）══
//   「占位符，但是我看不到原来的样子。哪怕你用矢量画一个样子出来我也知道。
//     现在的话，看到的都是占位符，但我看不到本来是什么样子。」
//
//   台账里那 12 行新面标着 needs-art、缩略图墙上一律是通用占位块——可**游戏里明明正画着它们**
//   （亮拳大手/手臂/石板/烟雾/背景全是程序矢量现画的）。于是「替换」变成了盲替：
//   美术不知道自己要顶掉的是什么，owner 也看不出这一行到底指屏上哪一块。
//
//   手册的「**程序矢量 = 索引一等公民**」（REQ-VECTOR-ART 步3）就是为这一步立的：
//   程序美术不该只活在渲染代码里，它该是索引里一条**看得见、可替换**的资产。
//   本脚本把每个槽的当前画法落成 `.svg` 预览 + 把台账那一行标成 **placeholder（有图可看）**，
//   而不是 needs-art（什么都没有）。
//
// ⚠ **placeholder ≠ mock**（两者天差地别，别混）：
//   · placeholder = **游戏里真正在用的那张**，上画面、可 approve 前的合法中间态（手册「首版占位」）。
//   · mock        = 无 key 时的假图，**永不上画面、不写回、不可 approve**（手册红线）。
//   所以本脚本写的是 `gen.source:'procedural-preview'`，**绝不**碰 `gen.mock`。
//
// 用法：npx vite-node scripts/game108-art-previews.mjs
// 幂等：同一份代码跑两次产出逐字节相同（程序矢量是确定性纯函数）。
import { ART_SLOTS, skinKeyOf, handIconSlot, gestureSlot, armSlot, SLAB_SLOT, SMOKE_SLOT, SCENE_SLOT } from '../games/game108/art-slots.ts';
import { handArt, armArt } from '../games/game108/hand-art.ts';
import { plate, scene } from '../games/game108/plate-art.ts';
import { C, R } from '../games/game108/design-tokens.ts';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART_DIR = join(ROOT, 'public', 'games', 'game108', 'art');
const PREVIEW_DIR = join(ART_DIR, 'preview');
const LEDGER = join(ART_DIR, 'art-ledger.json');

/** data:image/svg+xml,<encoded> → 原始 SVG 文本（`svgUri` 的逆运算）。 */
function svgOf(dataUri) {
  const i = dataUri.indexOf(',');
  if (i < 0 || !dataUri.startsWith('data:image/svg+xml')) return null;
  return decodeURIComponent(dataUri.slice(i + 1));
}

/**
 * 每个槽「当前长什么样」—— **直接调游戏里那几个画图函数**，不另画一份。
 * 另画一份就是第二处真相：改了游戏的画法而预览没跟着改，owner 看到的还是旧样子。
 */
function currentLook(key) {
  const g = /^gesture-(p1|p2)-(rock|paper|scissors)$/.exec(key);
  if (g) return svgOf(handArt(g[2], g[1]));
  const a = /^arm-(p1|p2)$/.exec(key);
  if (a) return svgOf(armArt(a[1], 256, 512));
  if (key === SLAB_SLOT) {
    return svgOf(plate({
      w: 512, h: 384, fill: C.slabFace, border: 5, radius: R.chip,
      shadow: 6, shadowColor: 'rgba(0,0,0,.3)', insetTop: 'rgba(255,255,255,.22)',
    }));
  }
  if (key === SCENE_SLOT) return svgOf(scene(1920, 1080, C));
  if (key === SMOKE_SLOT) {
    // 现状就是一个 emoji —— 如实画出来（画个"设计稿里的烟雾弹"会是**撒谎**：
    // owner 要看的是"本来是什么样子"，不是"我希望它是什么样子"）。
    return '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">'
      + '<rect width="192" height="192" rx="24" fill="#fdf3e0"/>'
      + '<text x="96" y="130" font-size="112" text-anchor="middle">💨</text></svg>';
  }
  return null;   // 手型图标已是真 PNG（filled），不需要预览
}

mkdirSync(PREVIEW_DIR, { recursive: true });
const led = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : null;
if (!led) { console.error('✗ 没有台账，先跑 game108-art-requirements.mjs'); process.exit(1); }

const byKey = new Map(led.rows.map((r) => [r.skinKey, r]));
let wrote = 0, skipped = 0;
for (const slot of ART_SLOTS) {
  const key = skinKeyOf(slot.key);
  const row = byKey.get(key);
  if (!row) { console.error(`✗ 台账缺行：${key}（先跑 game108-art-requirements.mjs）`); process.exit(1); }
  // 已经是真图的行**一个字都不碰**——预览的活是补空白，不是盖掉已有的美术。
  if (row.status === 'filled' || row.status === 'approved') { skipped++; continue; }
  const svg = currentLook(slot.key);
  if (svg === null) { console.error(`✗ ${slot.key} 没有当前画法可导（槽接了但屏上没人画？）`); process.exit(1); }
  const file = slot.key.replace(/\//g, '-') + '.svg';
  writeFileSync(join(PREVIEW_DIR, file), svg);
  row.status = 'placeholder';
  row.gen = {
    source: 'procedural-preview',          // ⚠ 不是 'mock'：这是游戏里真正在用的那张
    script: 'scripts/game108-art-previews.mjs',
    style: slot.look,                       // 现状实话（与预览图并排显示·见 art-slots.ts 的 look 字段）
    servedPath: `/games/game108/art/preview/${file}`,
  };
  wrote++;
}
writeFileSync(LEDGER, JSON.stringify(led, null, 1) + '\n');
console.log(`预览导出：${wrote} 张（已是真图跳过 ${skipped} 行）· 落 ${PREVIEW_DIR}`);
for (const r of led.rows.filter((x) => x.status !== 'retired')) {
  console.log(`  ${r.no} ${r.skinKey.padEnd(26)} ${r.status.padEnd(12)} ${r.gen?.servedPath ?? '—'}`);
}
