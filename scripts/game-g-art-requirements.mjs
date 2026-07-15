// scripts/game-g-art-requirements.mjs —— game-g 美术需求台账（owner 07-14「全面台账化替换·美术升级前置」）。
// game-g=代码驱动无单一蓝图（58539995 实证），台账=**手工枚举视觉面**（照 game-k 先例·行带 skinKey）：
//   · 54 将立绘（hero-codex 富字段合成生成描述·skinKey=game-g/hero/<键>·真图经 fill 别名登记→步2 覆盖即上画面）
//   · 7 个贴图/模型槽（牌桌呢面/三块背景板/硬币双面/3D 骰）——消费点已接覆盖（07-14 批28）
// 用法：npx vite-node scripts/game-g-art-requirements.mjs
// append-only：重跑 mergeLedger 并入现台账——保编号/状态/prompt/history；台账落 public/games/game-g/art/。
import { HERO_CARDS } from '../src/games/game-g/hero-codex.ts';
import { mergeLedger } from './art-replace.mjs';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUIT_KEY = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
const SUIT_TONE = {
  '♠': 'deep steel blue tone', '♥': 'crimson red tone', '♦': 'amber gold tone', '♣': 'jade green tone',
};
const RAR_STYLE = {
  orange: 'legendary, ornate gilded armor, radiant aura',
  purple: 'epic, elaborate engraved armor',
  blue: 'rare, fine detailed armor',
  green: 'sturdy campaign armor',
  white: 'simple practical armor',
};

// era 文案 → 文化关键词（与 portraits.ts regionOf 同一套判词·生成描述用英文文化锚）
function culture(era) {
  const e = String(era);
  if (/蒙古|突厥|匈奴|草原/.test(e)) return 'mongol steppe warlord, fur-trimmed helm, composite bow motif';
  if (/马其顿|罗马|希腊|迦太基|BC/.test(e) && !/春秋|战国|秦|汉/.test(e)) return 'classical antiquity general, bronze cuirass, crested helm';
  if (/普鲁士|俄国|法国|英国|瑞典|欧|18C|19C/.test(e)) return 'european early-modern commander, tricorn or plumed bicorne, epaulettes';
  if (/日本|日/.test(e)) return 'japanese sengoku daimyo, lacquered samurai armor, crescent kabuto';
  if (/波斯|阿拉伯|奥斯曼|中东/.test(e)) return 'middle-eastern conqueror, turban helm, scale armor';
  return 'ancient chinese general, ornate dynasty armor, tassled helm';
}

const heroRows = HERO_CARDS.map((h) => {
  const key = `${SUIT_KEY[h.suit] ?? 'x'}${h.rank}`;
  const skinKey = `game-g/hero/${key}`;
  const query = `${culture(h.era)}, ${SUIT_TONE[h.suit] ?? 'neutral tone'}, ${RAR_STYLE[h.rar] ?? RAR_STYLE.white}, `
    + 'dignified bust portrait, painterly collectible card art, dramatic rim light, isolated subject, transparent background';
  return {
    skinKey,
    kind: 'sprite',
    // slot 身份对齐 PST 步1 现况账（hero/AS·PlayingCard.art）——mergeLedger 按它保编号/保现身（replaced·程序化 svg），
    // 同时刷新本脚本的升级字段（skinKey/query/desc/spec）：regenerate 该行即出新图换皮。
    slot: { entity: `hero/${h.id}`, component: 'PlayingCard', field: 'art' },
    query,
    prompt: null,
    spec: { w: 480, h: 640, transparent: true },
    desc: `立绘·${h.name}「${h.title}」（${h.era}·${h.suit}${h.rank}·${h.rar}）：${(h.contrib || '').slice(0, 40)}`,
    context: `用途=sprite·牌面立绘（牌库/收藏/改造坊 PlayingCard.art）·覆盖键「${key}」·`
      + `写回=fill 别名登记 ${skinKey}（步2 覆盖注册表消费·未填=程序化矢量回退）`,
    status: 'needs-art', gen: null, provenance: null,
  };
});

const TEX_ROWS = [
  ['game-g/tex/felt-brocade', 'sprite', 'chinese bronze coin lattice pattern, antique gold thin lines on dark green felt, subtle elegant, seamless tile texture',
    { w: 128, h: 128, transparent: false }, '主页牌桌呢面底纹（无缝平铺·现=程序化钱币纹）', '消费点=home-screen home-felt Panel.bgTexture（feltBrocadeUri 覆盖优先）'],
  ['game-g/tex/home-backdrop', 'bg', 'grand chinese war-room hall interior, dark wood, hanging banners, candle glow, cinematic wide game menu background',
    { w: 1280, h: 720, transparent: false }, '主页整幅背景板（现=纯主题色·填图即上）', '消费点=home-screen Screen.image（cover 整图·覆盖在场才生效）'],
  ['game-g/tex/campaign-backdrop', 'bg', 'ancient asian campaign map on aged parchment, mountains rivers passes, ink wash style, wide game background',
    { w: 1280, h: 720, transparent: false }, '战役选关屏背景板（现=纯主题色）', '消费点=campaign-screen Screen.image（cover·覆盖在场才生效）'],
  ['game-g/tex/battle-backdrop', 'bg', 'ancient battlefield plain at dusk, war banners, distant fortress walls, dramatic sky, wide game background',
    { w: 1280, h: 720, transparent: false }, '对战屏背景板（**接线待定**：战斗屏根节点在 game-g.tsx 战局挂载处·下一批接）', '消费点=待接（turn-battle 屏根 Screen.image）——行先立·描述先审'],
  ['game-g/tex/coin-heads', 'sprite', 'antique gold coin face, embossed imperial chinese warrior profile, ornate rim, game coin art, circular, transparent background',
    { w: 256, h: 256, transparent: true }, '战胜硬币·人面（留场）·现=CSS 渐变+文字', '消费点=coin-flip .face.heads 背景（覆盖在场才换·文字仍叠显）'],
  ['game-g/tex/coin-tails', 'sprite', 'antique silver coin back, embossed chinese calligraphy character, ornate rim, game coin art, circular, transparent background',
    { w: 256, h: 256, transparent: true }, '战胜硬币·字面（回库）·现=CSS 渐变+文字', '消费点=coin-flip .face.tails 背景（覆盖在场才换）'],
  ['game-g/tex/card-back', 'sprite', 'ornate playing card back design, chinese brocade pattern, gold on deep lacquer red, symmetrical, rectangular game card back',
    { w: 480, h: 640, transparent: false }, '牌背图（**控件缺口**：引擎 PlayingCard 暂无 back 贴图 prop——REQ-UI 提缺口后接线）', '消费点=待引擎控件扩 back prop（requests.md 记缺口）——行先立·美术可先出图'],
];
const texRows = TEX_ROWS.map(([skinKey, kind, query, spec, desc, context]) => ({
  skinKey, kind,
  // felt 对齐现况账身份 table/felt（保号保现身）；其余为新槽位（顺延新号）。
  slot: skinKey === 'game-g/tex/felt-brocade'
    ? { entity: 'table/felt', component: 'Panel', field: 'bgTexture' }
    : { entity: `tex:${skinKey.split('/').pop()}`, component: 'Sprite', field: 'textureKey' },
  query, prompt: null, spec, desc, context, status: 'needs-art', gen: null, provenance: null,
}));

const diceRow = {
  skinKey: 'game-g/model/clash-dice',
  kind: 'model3d',
  slot: { entity: 'model:clash-dice', component: 'Model3D', field: 'modelKey' },
  query: 'ornate bronze six-sided battle die, engraved chinese numerals, worn antique metal, game-ready low-poly 3d model',
  prompt: null,
  spec: { polyBudget: 3000, scale: 1 },
  desc: '对决 3D 骰（P3D 独占域：clash-dice-3d.ts——台账行先立·3D 接线动作知会 P3D）',
  context: '用途=model3d·对决特写掷骰·现=程序化 3D 图元；替换=P3D 接 Model3D（P3D-game-z-handoff §0.1 边界）',
  status: 'needs-art', gen: null, provenance: null,
};

const rows = [...heroRows, ...texRows, diceRow].map((r, i) => ({ no: 'art-' + String(i + 1).padStart(2, '0'), ...r }));
const fresh = { version: 1, game: 'game-g', mode: 'requirements', count: rows.length, rows };

const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-g', 'art', 'art-ledger.json');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
const merged = mergeLedger(prev, fresh, null);
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(merged, null, 2) + '\n');
console.error(`[game-g artreq] ${merged.rows.length} 行台账 → ${LEDGER_FILE}`);
console.log(JSON.stringify({ ok: true, rows: merged.rows.length }));
