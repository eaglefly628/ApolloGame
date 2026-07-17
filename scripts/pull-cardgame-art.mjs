// pull-cardgame-art —— 从 GitHub 拉宽松授权的卡牌/麻将 placeholder 进共享货架（REQ：新游戏素材侦察）。
// 源均 raw.githubusercontent 逐文件可取（codeload zip 本环境被挡）·授权已核（PD / CC0）。
// 产物落 assets/{cards,mahjong}/ + 登记 assets/index.json（category/license/source/provenance）。幂等（按 id 跳过已存）。
// 用法：node scripts/pull-cardgame-art.mjs [--dry]（--dry 只打印计划不下载）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
const RANKW = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
const MJ_SUIT = { Man: '万 man', Pin: '筒 pin', Sou: '条 sou' };
const MJ_HONOR = { Ton: '东风 east', Nan: '南风 south', Shaa: '西风 west', Pei: '北风 north', Haku: '白 white-dragon', Hatsu: '发 green-dragon', Chun: '中 red-dragon' };

// 数据驱动源表：每条 = {类别, 授权, 源, base, files:[{url相对, id, ext, tags}]}
function buildSources() {
  const cards = [];
  const cbase = 'https://raw.githubusercontent.com/notpeter/Vector-Playing-Cards/master/cards-svg';
  for (const r of RANKS) for (const [s, sw] of Object.entries(SUITS))
    cards.push({ rel: `${r}${s}.svg`, id: `card/${RANKW[r]}-of-${sw}`, ext: 'svg', tags: ['playing-card', RANKW[r], sw, 'poker', 'card'] });
  cards.push({ rel: 'Joker1.svg', id: 'card/joker-red', ext: 'svg', tags: ['playing-card', 'joker', 'red'] });
  cards.push({ rel: 'Joker2.svg', id: 'card/joker-black', ext: 'svg', tags: ['playing-card', 'joker', 'black'] });

  const mj = [];
  const mbase = 'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular';
  for (const suit of ['Man', 'Pin', 'Sou']) for (let n = 1; n <= 9; n++)
    mj.push({ rel: `${suit}${n}.svg`, id: `mahjong/${suit.toLowerCase()}-${n}`, ext: 'svg', tags: ['mahjong', 'riichi', MJ_SUIT[suit], String(n)] });
  for (const suit of ['Man', 'Pin', 'Sou'])
    mj.push({ rel: `${suit}5-Dora.svg`, id: `mahjong/${suit.toLowerCase()}-5-red`, ext: 'svg', tags: ['mahjong', 'riichi', MJ_SUIT[suit], 'red-five', 'dora'] });
  for (const [h, tag] of Object.entries(MJ_HONOR))
    mj.push({ rel: `${h}.svg`, id: `mahjong/${h.toLowerCase()}`, ext: 'svg', tags: ['mahjong', 'riichi', 'honor', tag] });
  for (const x of ['Back', 'Front', 'Blank'])
    mj.push({ rel: `${x}.svg`, id: `mahjong/${x.toLowerCase()}`, ext: 'svg', tags: ['mahjong', 'riichi', x.toLowerCase()] });

  return [
    { category: 'cards', license: 'Public Domain', source: 'notpeter/Vector-Playing-Cards', base: cbase, files: cards },
    { category: 'cards', license: 'Public Domain', source: 'hayeah/playing-cards-assets', base: 'https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/png', files: [{ rel: 'back.png', id: 'card/back', ext: 'png', tags: ['playing-card', 'card-back'] }] },
    { category: 'mahjong', license: 'CC0-1.0', source: 'FluffyStuff/riichi-mahjong-tiles', base: mbase, files: mj },
  ];
}

async function main() {
  const dry = process.argv.includes('--dry');
  const sources = buildSources();
  const total = sources.reduce((n, s) => n + s.files.length, 0);
  console.log(`pull-cardgame-art: ${sources.length} 源 · ${total} 文件${dry ? '（dry-run）' : ''}`);

  const idxFile = join(ROOT, 'assets', 'index.json');
  const idx = JSON.parse(readFileSync(idxFile, 'utf8'));
  const have = new Set(idx.assets.map((a) => a.id));
  const at = new Date().toISOString().slice(0, 10);
  const added = [];
  let pulled = 0, skipped = 0, failed = 0;

  for (const src of sources) {
    for (const f of src.files) {
      if (have.has(f.id)) { skipped++; continue; }
      const destRel = `${src.category}/${f.id.split('/').pop()}.${f.ext}`;
      const abs = join(ROOT, 'assets', destRel);
      if (dry) { added.push({ ...f, destRel }); continue; }
      try {
        const r = await fetch(`${src.base}/${f.rel}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, buf);
        pulled++;
      } catch (e) { console.error(`  ✗ ${f.id}: ${e.message}`); failed++; continue; }
      const entry = {
        id: f.id, type: 'texture', description: `${f.tags.slice(1).join(' ')} (${src.category} placeholder)`, status: 'filled',
        path: destRel, category: src.category, style: 'flat', license: src.license, source: src.source,
        tags: [...new Set(f.tags)], spec: { format: f.ext === 'png' ? 'png' : 'svg', usage: 'sprite' },
        provenance: { pulledFrom: `${src.base}/${f.rel}`, license: src.license, date: at },
      };
      idx.assets.push(entry); have.add(f.id); added.push(entry);
    }
  }

  if (dry) { for (const a of added.slice(0, 8)) console.log(`  + ${a.id} ← ${a.rel ?? a.provenance?.pulledFrom ?? ''}`); console.log(`  …计划新增 ${added.length}·已有跳过 ${skipped}`); return; }
  writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
  console.log(`✓ 拉取 ${pulled} · 跳过 ${skipped} · 失败 ${failed} · 索引 +${added.length} → assets/index.json（${idx.assets.length} 条）`);
}

main();
