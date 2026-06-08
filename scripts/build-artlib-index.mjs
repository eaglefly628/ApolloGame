// 从 assets/FreeArtLib 生成资产索引（名字 → 分类/标签；尺寸读 PNG 头）。
// 用法：node scripts/build-artlib-index.mjs   → 写 assets/FreeArtLib/index.json
//
// 「从名字」：目录结构 + 文件名已是 DCSS 的精细分类（cat/sub/subject_variant）。
// 「从图像」：slot 语义（瓦片不透明可平铺 / 精灵透明 / 纸娃娃分层 / 图标 / 特效）来自人工看样图，
//   编码进下面的 SLOT/transparent 规则（见 docs/design/art-library-tags.md）。
import { readdirSync, statSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'assets/FreeArtLib';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.toLowerCase().endsWith('.png')) acc.push(p);
  }
  return acc;
}

function pngSize(file) {
  const fd = openSync(file, 'r');
  const b = Buffer.alloc(24);
  readSync(fd, b, 0, 24, 0);
  closeSync(fd);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// cat → 游戏怎么消费它（看样图定的语义槽位）。
const SLOT = {
  dungeon: 'tile', // 不透明、可平铺地形 → Tilemap
  monster: 'sprite.character', // 透明生物精灵 → Sprite.textureKey
  emissaries: 'sprite.character',
  player: 'sprite.paperdoll', // 纸娃娃分层(base+body+head+hands 叠合)
  item: 'icon.item', // 透明物品图标 → 拾取/背包
  effect: 'fx', // 透明特效/投射物
  gui: 'icon.ui', // UI/法术/技能图标
  misc: 'decal', // 血迹/铭牌/旗帜等叠加
};

const all = walk(ROOT)
  .map((p) => relative(ROOT, p).split(/[\\/]/).join('/'))
  .sort();

const groups = new Map();
for (const rel of all) {
  const noExt = rel.replace(/\.png$/i, '');
  const segs = noExt.split('/');
  const cat = segs[0];
  const filename = segs[segs.length - 1];
  const sub = segs.slice(1, -1).join('/'); // 中间目录
  const m = filename.match(/^(.*?)_(\d+)$/); // 仅 _<数字> 视作变体
  const subject = m ? m[1] : filename;
  const dir = [cat, sub].filter(Boolean).join('/');
  const id = [dir, subject].join('/');

  let g = groups.get(id);
  if (!g) {
    const slot = SLOT[cat] ?? 'misc';
    // tags 不入库——它 = cat + sub 各段 + subject 各词（+slot+'dcss'），全可由结构字段推出。
    // 查询时用 artlibTokens() 现算（见 src/assets/artlib.ts），避免每行存冗余字符串（省 ~半体积）。
    g = { id, cat, sub, subject, slot, transparent: cat !== 'dungeon', variants: 0, w: 32, h: 32, sample: rel.split('/').pop() };
    groups.set(id, g);
    try {
      const s = pngSize(join(ROOT, rel));
      g.w = s.w;
      g.h = s.h;
    } catch { /* keep 32 */ }
  }
  g.variants++;
}

const assets = [...groups.values()]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((g) => {
    // 精简：dir 可由 cat+'/'+sub 推出；w/h 仅在 ≠32(basePixel) 时存。
    const o = { id: g.id, cat: g.cat, sub: g.sub, subject: g.subject, slot: g.slot, transparent: g.transparent, variants: g.variants, sample: g.sample };
    if (g.w !== 32 || g.h !== 32) { o.w = g.w; o.h = g.h; }
    return o;
  });
const cats = {};
const slots = {};
for (const a of assets) {
  cats[a.cat] = (cats[a.cat] || 0) + 1;
  slots[a.slot] = (slots[a.slot] || 0) + 1;
}

const index = {
  version: 1,
  source: 'Dungeon Crawl Stone Soup (DCSS) 32x32 tiles — opengameart.org',
  license: 'CC0 (public domain; attribution appreciated, see LICENSE.txt)',
  root: ROOT,
  basePixel: 32,
  fileCount: all.length,
  assetCount: assets.length,
  cats,
  slots,
  assets, // 每条 = 一个逻辑资产(同 subject 的变体合一)：{id,cat,sub,dir,subject,slot,transparent,variants,w,h,tags}
};
writeFileSync(join(ROOT, 'index.json'), JSON.stringify(index));
console.log(`files=${all.length} assets=${assets.length}`);
console.log('cats:', JSON.stringify(cats));
console.log('slots:', JSON.stringify(slots));
