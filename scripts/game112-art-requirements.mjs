// scripts/game112-art-requirements.mjs —— game112《星尾会客厅》美术需求台账（capability-plan §4.5 承诺·S3 落地）。
// 台账 = 手工枚举视觉面（照 game-g 先例·行带 skinKey）：**只列有消费槽的行**（art-pipeline 红线·孤儿行禁入册）。
//   · 猫锚图 ×2 态（rest/notice）——消费点 `games/game112/cat-art.ts` catArt() → `SKIN_OVERRIDES[skinKey]` 优先
//     （REQ-112-ENG-11「内嵌 AI 视频播放」交付后，猫画面由它接管；本行退为回退链末端「静态锚图」）
//   · 主厅热点图标 ×3（晶球/星牌桌/玩具篮）——消费点 hotspotArt()
// 用法：npx vite-node scripts/game112-art-requirements.mjs
// append-only：重跑 mergeLedger 并入现台账——保编号/状态/prompt/history；台账落 public/games/game112/art/。
import { CATS } from '../games/game112/world-data.ts';
import { catArt, hotspotArt, SKIN_KEYS } from '../games/game112/cat-art.ts';
import { hallSceneSvg } from '../games/game112/scene-art.ts';
import { mergeLedger } from './art-replace.mjs';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE = 'photoreal ragdoll cat, blue eyes, seal point, long fluffy fur, warm practical light with faint cool starlight rim, '
  + 'lived-in old wooden cafe table, slightly asymmetric, no perfect rim light, isolated subject, transparent background';

const catRows = CATS.flatMap((c) => [
  ['rest', `${c.name}·趴姿待机（主厅/牌桌回退锚图·眼半眯）`, 'lying on old wooden table, paws tucked, half-closed eyes, calm'],
  ['notice', `${c.name}·注意（兴致高时·眼睁大）`, 'lying but alert, eyes wide open, ears forward, tail tip lifted'],
].map(([state, desc, pose]) => ({
  skinKey: SKIN_KEYS.cat(c.id, state),
  kind: 'sprite',
  slot: { entity: `cat/${c.id}`, component: 'Image', field: `src(${state})` },
  query: `${STYLE}, ${pose}`,
  prompt: null,
  spec: { w: 840, h: 600, transparent: true },
  desc,
  context: `用途=sprite·猫画面层静态锚图（主厅 hall-cat / 牌桌 table-cat 的 Image.src）·消费=cat-art.ts catArt('${c.id}','${state}')·`
    + `写回=SKIN_OVERRIDES['${SKIN_KEYS.cat(c.id, state)}']（未填=程序化矢量回退）·视觉锚=docs/design/game112/visual/cat-art-direction-ragdoll-v2-lived-in.png`,
  status: 'needs-art', gen: null, provenance: null,
})));

const ICONS = [
  ['orb', '忆光晶球（主厅热点·磨砂晶球内流动微光+照片残影）', 'frosted memory orb with soft inner glow and faint photo ghost, on worn wooden stand'],
  ['table', '星牌桌（主厅热点·旧木桌+三张歪牌）', 'small old wooden card table with three slightly crooked worn cards, moon and star motifs'],
  ['basket', '玩具篮（主厅热点·藤篮+羽毛杆+毛线球）', 'woven cat toy basket with a feather wand and a yarn ball, well used'],
];
const iconRows = ICONS.map(([kind, desc, q]) => ({
  skinKey: SKIN_KEYS.hotspot(kind),
  kind: 'sprite',
  slot: { entity: `hotspot/${kind}`, component: 'Image', field: 'src' },
  query: `${q}, cozy storybook prop, soft warm light, isolated, transparent background`,
  prompt: null,
  spec: { w: 192, h: 192, transparent: true },
  desc,
  context: `用途=sprite·主厅场景热点图标（hot-${kind}-img Image.src）·消费=cat-art.ts hotspotArt('${kind}')·写回=SKIN_OVERRIDES['${SKIN_KEYS.hotspot(kind)}']`,
  status: 'needs-art', gen: null, provenance: null,
}));

// 主厅定调图（hall-framework.md §6.1 art-06）：猫画面层容器 hall-stage 的 Panel.skin·整个美术方向先由它定调。
const sceneRows = [{
  skinKey: SKIN_KEYS.scene('hall'),
  kind: 'scene',
  slot: { entity: 'room/hall', component: 'Panel', field: 'skin(hall-stage)' },
  query: 'storybook interior of an old house on Cat Star, main hall, mid shot, warm amber lamplight from the left, faint cool starlight through the window, '
    + 'worn oak long table with cup rings, plaid blanket on a chair, frosted memory orb glowing softly on a shelf, visible brushwork, slightly loose perspective, '
    + 'lived-in imperfections, empty cushion left for a cat, clean empty area in the lower middle for compositing a cat, no cat, no text',
  prompt: null,
  spec: { w: 1680, h: 1200, transparent: false },
  desc: '主厅定调图（猫画面层背景·暖灯旧木长桌·窗外雾青星光·下中留白给猫）',
  context: '用途=scene·主厅猫画面层容器 hall-stage 的 Panel.skin（cover·猫 Image 叠其上）·消费=cat-art.ts sceneSkin(\'hall\')·'
    + '写回=SKIN_OVERRIDES[\'game112/scene/hall\']（未填=回退主题 sunken 面）·风格包=docs/design/game112/style-pack.starlit-lived-in.json·'
    + '视觉锚=visual/cat-art-direction-ragdoll-v2-lived-in.png·安全区=hall-framework.md §4（顶 12%·底 18%·右上 ⚙）',
  status: 'needs-art', gen: null, provenance: null,
}];

const rows = [...catRows, ...iconRows, ...sceneRows].map((r, i) => ({ no: 'art-' + String(i + 1).padStart(2, '0'), ...r }));
const fresh = { version: 1, game: 'game112', mode: 'requirements', count: rows.length, rows };

const LEDGER_FILE = join(ROOT, 'public', 'games', 'game112', 'art', 'art-ledger.json');
const PH_DIR = join(ROOT, 'public', 'games', 'game112', 'art', 'placeholder');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
const merged = mergeLedger(prev, fresh, null);
mkdirSync(PH_DIR, { recursive: true });
const decode = (dataUri) => decodeURIComponent(dataUri.replace(/^data:image\/svg\+xml;utf8,/, ''));
let phN = 0;
for (const r of merged.rows) {
  if (r.gen || r.status === 'replaced' || r.status === 'retired') continue;
  const svg = r.skinKey.startsWith('game112/cat/')
    ? decode(catArt(r.slot.entity.split('/')[1], r.slot.field.includes('notice') ? 'notice' : 'rest'))
    : r.skinKey.startsWith('game112/scene/')
      ? hallSceneSvg()
      : decode(hotspotArt(r.slot.entity.split('/')[1]));
  const base = r.skinKey.split('/').slice(1).join('-') + '.svg';
  writeFileSync(join(PH_DIR, base), svg);
  r.placeholder = { servedPath: `/games/game112/art/placeholder/${base}`, current: '现况=程序化矢量占位（cat-art.ts）' };
  phN += 1;
}
writeFileSync(LEDGER_FILE, JSON.stringify(merged, null, 2) + '\n');
console.error(`[game112 artreq] ${merged.rows.length} 行台账（${phN} 行带现况占位快照）→ ${LEDGER_FILE}`);
console.log(JSON.stringify({ ok: true, rows: merged.rows.length, placeholders: phN }));
