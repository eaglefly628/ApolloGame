// scripts/game112-art-requirements.mjs —— game112《星尾会客厅》美术需求台账（capability-plan §4.5 承诺·S3 落地）。
// 台账 = 手工枚举视觉面（照 game-g 先例·行带 skinKey）：**只列有消费槽的行**（art-pipeline 红线·孤儿行禁入册）。
//   · 猫锚图 ×2 态（rest/notice）——消费点 `games/game112/cat-art.ts` catArt() → `SKIN_OVERRIDES[skinKey]` 优先
//     （REQ-112-ENG-11「内嵌 AI 视频播放」交付后，猫画面由它接管；本行退为回退链末端「静态锚图」）
//   · 主厅热点图标 ×3（晶球/星牌桌/玩具篮）——消费点 hotspotArt()
//   · 00 全馆剖面 + 01–10 十房背景——消费点 mapSkin()/sceneSkin()；批准图必须逐槽入账，禁孤儿图
// 用法：npx vite-node scripts/game112-art-requirements.mjs
// append-only：重跑 mergeLedger 并入现台账——保编号/状态/prompt/history；台账落 public/games/game112/art/。
import { CATS, ROOMS } from '../games/game112/world-data.ts';
import { catArt, hotspotArt, SKIN_KEYS } from '../games/game112/cat-art.ts';
import { hallSceneSvg } from '../games/game112/scene-art.ts';
import { mergeLedger } from './art-replace.mjs';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE = 'photoreal ragdoll cat, blue eyes, seal point, long fluffy fur, warm practical light with faint cool starlight rim, '
  + 'lived-in old wooden cafe table, slightly asymmetric, no perfect rim light, isolated subject, transparent background';

const CAT_ART = {
  rest: {
    desc: '安静坐姿（十房静态陪伴锚图）',
    pose: 'relaxed full-body seated pose, calm companion expression',
    path: '/games/game112/art/cat/xuetuan-rest-v1.png',
    prompt: 'Transparent full-body sprite of Xuetuan, preserving the approved lived-in ragdoll concept: blue eyes, seal-bicolor mask, warm cream-and-white long fur, pink nose and natural asymmetry; relaxed seated resting pose; neutral multi-room lighting; no background or props.',
  },
  notice: {
    desc: '注意玩耍姿态（呼唤后或兴致高时）',
    pose: 'gentle low play crouch, chest down, paws ahead, tail raised, ears attentive',
    path: '/games/game112/art/cat/xuetuan-notice-v1.png',
    prompt: 'Transparent full-body sprite of the same approved Xuetuan identity in a gentle low play crouch, chest down, paws ahead and tail raised; preserve the rest sprite proportions, palette and neutral lighting; clean alpha with no haze, background or props.',
  },
};
const catRows = CATS.flatMap((c) => Object.entries(CAT_ART).map(([state, art]) => ({
  skinKey: SKIN_KEYS.cat(c.id, state),
  kind: 'sprite',
  slot: { entity: `cat/${c.id}`, component: 'Image', field: `src(${state})` },
  query: `${STYLE}, ${art.pose}`,
  prompt: art.prompt,
  spec: { w: 1312, h: 1199, transparent: true },
  desc: `${c.name}·${art.desc}`,
  context: `用途=sprite·猫画面层静态锚图（十房猫位 hall-cat 的 Image.src·名册 Avatar）·消费=cat-art.ts catArt('${c.id}','${state}')·`
    + `写回=SKIN_OVERRIDES['${SKIN_KEYS.cat(c.id, state)}']·视觉锚=docs/design/game112/visual/cat-art-direction-ragdoll-v2-lived-in.png`,
  status: 'approved',
  gen: { servedPath: art.path, width: 1312, height: 1199, review: 'approved', reviewedAt: '2026-09-30' },
  provenance: { generator: 'OpenAI image generation', model: 'OpenAI built-in image generation', mock: false, generatedAt: '2026-09-30' },
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
  context: `用途=sprite·旧版主厅白卡热点图标（巡游版 v3 起物件直接用画里的东西·hotspotArt 已无消费点·保号退役）`,
  status: 'retired', gen: null, provenance: null,
}));

// 主厅定调图（hall-framework.md §6.1 art-06）：猫画面层容器 hall-stage 的 Panel.skin·整个美术方向先由它定调。
const hallSceneRows = [{
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
  status: 'approved', gen: null, provenance: null,
}];

const APPROVED_ROOM_PATHS = {
  hall: '/games/game112/art/scene/star-tail-main-hall-bg-v2.png',
  orbs: '/games/game112/art/ai/openai-imagegen/02-star-tail-orbs-bg-v2.png',
  cardroom: '/games/game112/art/ai/openai-imagegen/03-star-tail-cardroom-bg-v2.png',
  gallery: '/games/game112/art/ai/openai-imagegen/04-star-tail-gallery-bg-v2.png',
  playroom: '/games/game112/art/ai/openai-imagegen/05-star-tail-playroom-bg-v2.png',
  sunroom: '/games/game112/art/ai/openai-imagegen/06-star-tail-sunroom-bg-v2.png',
  pantry: '/games/game112/art/ai/openai-imagegen/07-star-tail-pantry-bg-v2.png',
  attic: '/games/game112/art/ai/openai-imagegen/08-star-tail-attic-bg-v2.png',
  garden: '/games/game112/art/ai/openai-imagegen/09-star-tail-garden-bg-v2.png',
  shopfront: '/games/game112/art/ai/openai-imagegen/10-star-tail-shopfront-bg-v2.png',
};

const approvedMapRows = [{
  skinKey: SKIN_KEYS.map,
  kind: 'scene',
  slot: { entity: 'map/hall', component: 'Panel', field: 'skin(map-cutaway)' },
  query: 'deterministic house cutaway composed from the exact approved room images 01 through 10',
  prompt: null,
  spec: { w: 1920, h: 1080, transparent: false },
  desc: '00 星尾馆全馆剖面（十房逐槽拼合·图内热区直接跳转）',
  context: `用途=scene·全馆预览 map-cutaway 的 Panel.skin·消费=cat-art.ts mapSkin()·写回=SKIN_OVERRIDES['${SKIN_KEYS.map}']·热区坐标=world-data.ts ROOMS.mapRect`,
  status: 'approved',
  gen: { servedPath: '/games/game112/art/ai/openai-imagegen/00-star-tail-house-cutaway-v2.png', width: 1920, height: 1080, review: 'approved', reviewedAt: '2026-09-27' },
  provenance: { generator: 'deterministic-composite', model: 'Pillow exact-room composite', mock: false, generatedAt: '2026-09-27' },
}];

const approvedRoomRows = ROOMS.filter((room) => room.id !== 'hall').map((room) => ({
  skinKey: SKIN_KEYS.scene(room.scene),
  kind: 'scene',
  slot: { entity: `room/${room.id}`, component: 'Panel', field: `skin(room-${room.id}-stage)` },
  query: `approved cat-native storybook room ${String(room.number).padStart(2, '0')} ${room.name}, connected to ${room.adjacent.join(', ')}`,
  prompt: null,
  spec: { w: 1680, h: 1200, transparent: false },
  desc: `${String(room.number).padStart(2, '0')} ${room.name}背景（固定镜头·猫尺度空间）`,
  context: `用途=scene·${room.name}固定镜头背景·消费=cat-art.ts sceneSkin('${room.scene}')·写回=SKIN_OVERRIDES['${SKIN_KEYS.scene(room.scene)}']·拓扑邻接=${room.adjacent.join('/')}`,
  status: 'approved',
  gen: { servedPath: APPROVED_ROOM_PATHS[room.id], width: 1680, height: 1200, review: 'approved', reviewedAt: '2026-09-27' },
  provenance: { generator: 'openai-imagegen', model: 'OpenAI built-in image generation', mock: false, generatedAt: '2026-09-27' },
}));

const rows = [...catRows, ...iconRows, ...hallSceneRows, ...approvedMapRows, ...approvedRoomRows]
  .map((r, i) => ({ no: 'art-' + String(i + 1).padStart(2, '0'), ...r }));
const fresh = {
  version: 1,
  game: 'game112',
  mode: 'requirements',
  artStyle: {
    stylePrompt: '猫原生绘本老屋：猫尺度家具、旧木与手作灰泥、琥珀暖光衔接雾青月色；笔触可见、透视略松、生活痕迹真实；各房保留独特色相但以木色自然过渡。',
    negativePrompt: '人类尺度家具、人物、豪华咖啡厅、霓虹太空酒吧、天堂符号、完全对称样板间、文字、水印、货币 UI',
  },
  count: rows.length,
  rows,
};

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
