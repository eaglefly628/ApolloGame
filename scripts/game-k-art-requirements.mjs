// scripts/game-k-art-requirements.mjs —— game-k《Zombie Slots》完整美术需求推导（美术替换管线）。
// 老虎机完整 BOM：10 符号 + 16 非符号（背景×2/机台框/符号底板/Logo/金币/HUD 面板/中奖横幅×4/按钮×5）= 26 项。
// 各带皮肤槽（symbols=k/sym-<key>·chrome=k/<slot>），宿主 fail-soft 消费（art.ts/game-k.ts/hud.ts）。
// 头挂 artStyle=disney-supercell（迪士尼×Supercell·owner 点题风格），逐行回填 subject 提示词（风格由风格包驱动）。
//   默认：只产/刷新台账 public/games/game-k/art/art-ledger.json（status=needs-art·不生成·游戏走程序化占位）。
//   --gen：第一遍 mock 全链 smoke（batchGenerate·mock·工作流 §六.1 验收）→ 落 scratch·**不入库**（避免噪声占位污染可玩态）。
// 用法：npx vite-node scripts/game-k-art-requirements.mjs [--gen]
import { SYMBOLS, CHROME_ART } from '../src/games/game-k/theme.ts';
import { deriveRequirements, mergeLedger, batchGenerate } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'disney-supercell';
const GAME_STYLE = 'unified spooky-cute zombie slot game set, glossy premium mobile game art, all pieces belong to the same polished set';

// subject 提示词（风格交给 disney-supercell 风格包·此处只描主体）。
const PROMPT = {
  // 符号
  'k/sym-wild': 'a friendly cartoon undead zombie king character head, green skin, big glowing eyes, exposed pink brain, small golden crown, stitched jaw, spooky but adorable, banner reading WILD',
  'k/sym-scat': 'a glowing biohazard toxin jar icon, bright green radioactive trefoil hazard symbol, bubbling ooze, banner reading FREE SPINS, scatter symbol',
  'k/sym-dog': 'a cute cartoon zombie puppy character head, green fur, floppy ears, big adorable puppy eyes, one little fang, lolling pink tongue, stitched patch',
  'k/sym-girl': 'a cute cartoon undead zombie bride girl character, pale purple skin, huge sparkly eyes, flower crown, stitched sweet smile, rosy cheeks, veil',
  'k/sym-doc': 'a wacky cartoon zombie mad scientist character head, green face, wild frizzy white hair, cracked round goggles, big toothy grin',
  'k/sym-a': "a chunky cartoon glowing gravestone game icon tile engraved with the big letter 'A', red glow, cracked mossy tombstone",
  'k/sym-k': "a chunky cartoon glowing gravestone game icon tile engraved with the big letter 'K', amber glow, cracked mossy tombstone",
  'k/sym-q': "a chunky cartoon glowing gravestone game icon tile engraved with the big letter 'Q', purple glow, cracked mossy tombstone",
  'k/sym-j': "a chunky cartoon glowing gravestone game icon tile engraved with the big letter 'J', blue glow, cracked mossy tombstone",
  'k/sym-t': "a chunky cartoon glowing gravestone game icon tile engraved with '10', teal glow, cracked mossy tombstone",
  // 背景 / 机台 / 底板
  'k/bg-main': 'a spooky-cute cartoon graveyard scene background at night, big full moon, purple sky, rows of tombstones, bare dead trees, low mist, wide game background, no characters',
  'k/bg-free': 'a spooky-cute cartoon graveyard background under a blood-red moon, zombie horde silhouettes rising from graves, eerie green glow, wide game background, no characters',
  'k/reel-frame': 'an ornate cartoon slot machine cabinet frame, carved tombstone stone with green glowing runes, bones and vines around the edges, large rounded rectangular window opening in the center, game UI frame, transparent center and background',
  'k/sym-tile': 'a dark rounded square slot cell tile socket, subtle green inner glow, carved stone, seamless game icon backing, soft transparent edges',
  // 品牌 / 特效 / 面板
  'k/logo': "a glossy cartoon game logo lettering reading 'ZOMBIE SLOTS', dripping green slime, little bones, spooky-cute, thick clean white outline, transparent background",
  'k/coin': 'a shiny golden coin with an embossed biohazard skull, cartoon mobile game coin icon, thick white outline, transparent background',
  'k/hud-panel': 'a dark carved stone UI panel bar texture with green glowing trim and rivets, cartoon game HUD frame, seamless horizontal, transparent ends',
  // 中奖横幅
  'k/banner-big': "a ribbon banner reading 'BIG WIN', gold and toxic green, little bones, spooky-cute cartoon, thick white outline, transparent background",
  'k/banner-mega': "a large ribbon banner reading 'MEGA WIN', bursting gold explosion and green slime, cartoon, thick white outline, transparent background",
  'k/banner-zombie': "an epic dramatic banner reading 'ZOMBIE APOCALYPSE', gold and toxic green, bursting brains and coins, cartoon, transparent background",
  'k/banner-free': "a banner reading 'FREE SPINS', purple and green, bats and a full moon, spooky-cute cartoon, thick white outline, transparent background",
  // 按钮
  'k/btn-spin': 'a big round glossy cartoon SPIN button, green and gold, biohazard motif, premium mobile game button, thick white outline, transparent background',
  'k/btn-plus': 'a small round glossy cartoon plus (+) button, green, mobile game UI button, thick white outline, transparent background',
  'k/btn-minus': 'a small round glossy cartoon minus (-) button, green, mobile game UI button, thick white outline, transparent background',
  'k/btn-mute': 'a small round glossy cartoon speaker sound toggle button, green, mobile game UI button, transparent background',
  'k/btn-info': 'a small round glossy cartoon info (i) paytable button, green, mobile game UI button, transparent background',
};

const hslHex = (h, s = 0.7, l = 0.58) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255); };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};

// 「美术目录」合成 manifest：符号 + chrome 各一实体（Sprite 皮肤槽 + Shape 占位）。
const entities = {};
const ENT_SYM = { T: 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace', DOG: 'zombie-hound', GIRL: 'undead-bride', DOC: 'mad-scientist', WILD: 'zombie-king-wild', SCAT: 'biohazard-scatter' };
for (const s of SYMBOLS) entities[`sym-${ENT_SYM[s.key]}`] = { Sprite: { textureKey: s.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 0 }, Shape: { kind: 'box', width: 120, height: 120 }, Color: { tint: hslHex(s.hue), alpha: 1 } };
for (const a of CHROME_ART) entities[`chrome-${a.skin.replace('k/', '')}`] = { Sprite: { textureKey: a.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 0 }, Shape: { kind: 'box', width: a.w, height: a.h }, Color: { tint: 0x2a3a2c, alpha: 1 } };

const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-k', 'art', 'art-ledger.json');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
const ledger = mergeLedger(prev, deriveRequirements({ entities }, { game: 'game-k' }));
ledger.artStyle = { stylePrompt: GAME_STYLE, packId: PACK };

const CHROME_BY_SKIN = Object.fromEntries(CHROME_ART.map((a) => [a.skin, a]));
for (const row of ledger.rows) {
  if (PROMPT[row.skinKey]) row.prompt = PROMPT[row.skinKey];
  const ch = CHROME_BY_SKIN[row.skinKey];
  if (ch) { // chrome 行：修正 kind/spec/描述为该槽真规格
    row.kind = ch.kind;
    row.spec = { w: ch.w, h: ch.h, displayW: ch.w, displayH: ch.h, transparent: ch.transparent };
    row.query = ch.name.toLowerCase();
    row.context = `美术需求：「${ch.name}」·${ch.use}·${ch.transparent ? '需透明底' : '不透明满幅'}·${ch.w}×${ch.h}`;
  }
}

mkdirSync(dirname(LEDGER_FILE), { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  // 第一遍 mock 全链 smoke → scratch（**不入库**：mock=噪声占位，入库会毁可玩态；真图走带 key session）。
  const OUT = join(tmpdir(), 'game-k-artgen');
  mkdirSync(OUT, { recursive: true });
  const r = await batchGenerate(ledger, PACK, { root: OUT, game: 'game-k', mock: true });
  console.error('[gen·scratch·not-committed]', OUT, JSON.stringify(r.summary));
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const byKind = {};
for (const r of ledger.rows) (byKind[r.kind] ??= []).push(r);
const lines = [];
lines.push(`# game-k《Zombie Slots》完整资产需求表（${ledger.rows.length} 项·风格 disney-supercell）\n`);
lines.push('> 机读真相=`public/games/game-k/art/art-ledger.json`（平台 GET /api/art/ledger?slug=game-k 读此）。风格包=迪士尼×Supercell。');
lines.push('> 完整老虎机 BOM：符号 + 背景/机台/UI/横幅/特效全类型。宿主 fail-soft 消费皮肤槽（真图就绪即用·否则程序化/CSS 占位·游戏始终可玩）。\n');
lines.push('| 编号 | 类型 | 皮肤槽 | 规格 | 用途 |');
lines.push('|---|---|---|---|---|');
for (const r of ledger.rows) lines.push(`| ${r.no} | ${r.kind} | ${esc(r.skinKey || '-')} | ${r.spec.w}×${r.spec.h}${r.spec.transparent ? '·透明' : '·满幅'} | ${esc(r.context)} |`);
lines.push(`\n共 ${ledger.rows.length} 项：${Object.entries(byKind).map(([k, v]) => `${k}×${v.length}`).join(' · ')}。`);
console.log(lines.join('\n'));
