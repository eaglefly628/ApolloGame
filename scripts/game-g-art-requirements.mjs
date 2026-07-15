// scripts/game-g-art-requirements.mjs —— game-g 美术需求台账（owner 07-14「全面台账化替换·美术升级前置」）。
// game-g=代码驱动无单一蓝图（58539995 实证），台账=**手工枚举视觉面**（照 game-k 先例·行带 skinKey）：
//   · 54 将立绘（hero-codex 富字段合成生成描述·skinKey=game-g/hero/<键>·真图经 fill 别名登记→步2 覆盖即上画面）
//   · 7 个贴图/模型槽（牌桌呢面/三块背景板/硬币双面/3D 骰）——消费点已接覆盖（07-14 批28）
//   · 3 个 UI 按钮皮（hero/primary/ghost·主题级 UITheme.buttonSkins 一体换）+ 牌背/对战背景接线（07-15 批29）
// 用法：npx vite-node scripts/game-g-art-requirements.mjs
// append-only：重跑 mergeLedger 并入现台账——保编号/状态/prompt/history；台账落 public/games/game-g/art/。
import { HERO_CARDS } from '../src/games/game-g/hero-codex.ts';
import { STORY_OPENING } from '../src/games/game-g/campaign-data.ts';
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
    { w: 1280, h: 720, transparent: false }, '对战屏背景板（批29 已接线·画框外衬底）', '消费点=turn-battle-screen buildTurnBattleHTML 根（底色叠 cover·覆盖在场才生效）'],
  ['game-g/tex/coin-heads', 'sprite', 'antique gold coin face, embossed imperial chinese warrior profile, ornate rim, game coin art, circular, transparent background',
    { w: 256, h: 256, transparent: true }, '战胜硬币·人面（留场）·现=CSS 渐变+文字', '消费点=coin-flip .face.heads 背景（覆盖在场才换·文字仍叠显）'],
  ['game-g/tex/coin-tails', 'sprite', 'antique silver coin back, embossed chinese calligraphy character, ornate rim, game coin art, circular, transparent background',
    { w: 256, h: 256, transparent: true }, '战胜硬币·字面（回库）·现=CSS 渐变+文字', '消费点=coin-flip .face.tails 背景（覆盖在场才换）'],
  ['game-g/tex/card-back', 'sprite', 'ornate playing card back design, chinese brocade pattern, gold on deep lacquer red, symmetrical, rectangular game card back',
    { w: 480, h: 640, transparent: false }, '牌背图（批29 引擎 PlayingCard.backArt prop 落地·已接线）', '消费点=home-screen duel-back PlayingCard.backArt（整面 cover·覆盖在场才换·无=原棋盘格纹）'],
  // ── 批30（owner 07-15「全部美术台账加升级」）：剩余四屏 + 大厅整壳 + 三选一 的背景板全部立行接线 ──
  ['game-g/tex/lobby-backdrop', 'bg', 'imperial chinese gambling hall interior, ornate wooden pillars, hanging red lanterns, subdued dark ambience, wide game lobby background',
    { w: 1280, h: 720, transparent: false }, '大厅整壳背景板（罩五 tab 最外层·现=纯主题色）', '消费点=lobby-dd Screen.image（cover·覆盖在场才生效）'],
  ['game-g/tex/collection-backdrop', 'bg', 'ancient chinese archive hall, wooden card cabinets and scroll shelves, warm candlelight, subdued wide game background',
    { w: 1280, h: 720, transparent: false }, '收藏屏背景板（现=纯主题色）', '消费点=collection-screen Screen.image（cover·覆盖在场才生效）'],
  ['game-g/tex/deck-backdrop', 'bg', 'war council tent interior, campaign maps and banners on long table, strategic candlelit atmosphere, subdued wide game background',
    { w: 1280, h: 720, transparent: false }, '牌组屏背景板（现=纯主题色）', '消费点=deck-screen Screen.image（cover·覆盖在场才生效）'],
  ['game-g/tex/craft-backdrop', 'bg', 'mystic chinese forge workshop, zodiac talismans on walls, ember glow over anvil, subdued wide game background',
    { w: 1280, h: 720, transparent: false }, '改造坊屏背景板（现=纯主题色）', '消费点=craft-screen Screen.image（cover·覆盖在场才生效）'],
  ['game-g/tex/between-backdrop', 'bg', 'victorious army camp at night, bonfire and war banners, three glowing reward pedestals, wide game background, celebratory but subdued',
    { w: 1280, h: 720, transparent: false }, '战间三选一屏背景板（现=纯主题底）', '消费点=game-g.tsx showBetween Screen.image（cover·覆盖在场才生效）'],
];

// 开场故事逐幕插画（批30·6 幕）：storyModal 真图在场才插 Image 节点（16:9 cover）·无=原纯旁白。
const STORY_QUERY = [
  'dim casino at night, green felt card table, an antique deck glowing faintly in shadows, cinematic game illustration',
  'close-up of a hand flipping an ancient brass switch beneath a card table, dramatic chiaroscuro, cinematic game illustration',
  'lights extinguished, a whole deck of cards levitating in a blinding burst of light, supernatural, cinematic game illustration',
  'silhouettes of legendary ancient generals flashing across floating card faces, epic montage, cinematic game illustration',
  'two regal joker dealers materializing at the far end of a card table, ominous golden mist, cinematic game illustration',
  'a chosen card master seizing a glowing deck of destiny, heroic wide shot, cinematic game illustration',
];
const storyRows = STORY_OPENING.map((b, i) => ({
  skinKey: `game-g/story/beat-${i + 1}`, kind: 'bg',
  slot: { entity: `story:beat-${i + 1}`, component: 'Image', field: 'src' },
  query: `${STORY_QUERY[i] ?? STORY_QUERY[0]}, chinese ink-and-gold palette`, prompt: null,
  spec: { w: 1024, h: 576, transparent: false },
  desc: `开场故事插画 · 第${i + 1}幕「${b.scene}」（现=纯旁白无图）`,
  context: `幕旁白="${b.text.slice(0, 30)}…"·消费点=overlays storyModal（真图在场才插 Image·16:9 cover）`,
  status: 'needs-art', gen: null, provenance: null,
}));

// 商城卡池 banner（批30·2 条）：poolPanel 真图在场才插 Image。
const shopRows = [
  ['game-g/shop/banner-tiangang', 'gacha banner, fanned thunder talisman cards, gold lightning motif on dark lacquer, wide game shop banner',
    '天罡卡池 banner（现=纯文案面板）', '消费点=overlays shopModal poolPanel tiangang（Image·覆盖在场才插）'],
  ['game-g/shop/banner-dizhi', 'gacha banner, twelve chinese zodiac animals in a circle, jade and bronze motif, wide game shop banner',
    '地支卡池 banner（现=纯文案面板）', '消费点=overlays shopModal poolPanel dizhi（Image·覆盖在场才插）'],
].map(([skinKey, query, desc, context]) => ({
  skinKey, kind: 'sprite',
  slot: { entity: `shop:${skinKey.split('/').pop()}`, component: 'Image', field: 'src' },
  query, prompt: null, spec: { w: 640, h: 200, transparent: false }, desc, context,
  status: 'needs-art', gen: null, provenance: null,
}));
const texRows = TEX_ROWS.map(([skinKey, kind, query, spec, desc, context]) => ({
  skinKey, kind,
  // felt 对齐现况账身份 table/felt（保号保现身）；其余为新槽位（顺延新号）。
  slot: skinKey === 'game-g/tex/felt-brocade'
    ? { entity: 'table/felt', component: 'Panel', field: 'bgTexture' }
    : { entity: `tex:${skinKey.split('/').pop()}`, component: 'Sprite', field: 'textureKey' },
  query, prompt: null, spec, desc, context, status: 'needs-art', gen: null, provenance: null,
}));

// UI 按钮皮三行（批29 owner 07-15「按键/背景/牌面都可换」）：一个 kind 一张皮——引擎 UITheme.buttonSkins
// 主题级槽（ui-theme.ts getter 消费），全游戏 35+ 按钮一体换、零逐点改。9-slice 契约：边饰须画在源图外缘 10px 内
// （接线 skinSlice=10·任意尺寸不变形）；hero 大 CTA=整图 cover（480×160 横幅·配倒角 clip-path）。
const UI_ROWS = [
  ['game-g/ui/btn-hero', 'gilded ornate banner button, chinese bronze coin motif, gold gradient on dark lacquer, chamfered corners, game UI hero call-to-action button, wide rectangle',
    { w: 480, h: 160, transparent: true }, '出征大 CTA 按钮皮（kind:hero·整图 cover）', '消费点=主题级 buttonSkins.hero（GG 三主题 getter·所有 hero 键一体换：出征/掷骰/结束回合）'],
  ['game-g/ui/btn-primary', 'antique gold frame button, subtle jade inlay border, dark parchment center, ornament confined to outer 10px edge, seamless stretchable middle, game UI button, 9-slice',
    { w: 240, h: 80, transparent: false }, '主按钮皮（kind:primary·9-slice slice=10）', '消费点=主题级 buttonSkins.primary（确认/继续/完成类主键一体换·边饰限外缘 10px）'],
  ['game-g/ui/btn-ghost', 'thin bronze outline button, translucent dark center, faint gold hairline border, ornament confined to outer 10px edge, understated game UI secondary button, 9-slice',
    { w: 240, h: 80, transparent: true }, '次按钮皮（kind:ghost·9-slice slice=10）', '消费点=主题级 buttonSkins.ghost（返回/取消/工具类次键一体换·边饰限外缘 10px）'],
];
const uiRows = UI_ROWS.map(([skinKey, query, spec, desc, context]) => ({
  skinKey, kind: 'sprite',
  slot: { entity: `ui:${skinKey.split('/').pop()}`, component: 'Button', field: 'skin' },
  query, prompt: null, spec, desc, context, status: 'needs-art', gen: null, provenance: null,
}));

// ── 套装图标 34 枚（批32 owner 07-15「很多图标我都要统一风格升级」）：界面 emoji 记号（🪙💎⚡🀄…）+
// 生肖 12 枚全部图标化。**统一风格锚**写死在每条 query 尾（成套出图不跑风格）；消费=引擎四个图文位
// （Button.icon/Tag.icon/Label span.img/Card.media URL）+ game-g iconUri 注册表——覆盖在场才换、无=原 emoji。
// 排印记号（→ ← ✓ ✗ ★ ⚠ 🔒）**不图标化**——那是文字排版，不是美术。
const ICON_STYLE = 'engraved antique bronze and gold game icon, chinese bronze-ware motif, clean bold silhouette, centered emblem, flat, transparent background, unified icon set style';
const ICON_ROWS = [
  // 资源（5）
  ['coin', '🪙', 'round gold coin with square hole, chinese ancient currency', '金币', '已接：顶栏/商城余额（Tag.icon+span.img）'],
  ['diamond', '💎', 'faceted precious gemstone', '钻石', '已接：顶栏/商城余额'],
  ['shard-tiangang', '🔶', 'glowing amber talisman shard', '天罡碎片', '已接：商城余额条'],
  ['shard-dizhi', '🧩', 'carved jade puzzle shard', '地支碎片', '已接：顶栏/商城余额'],
  ['mana', '💧', 'glowing water droplet, summoning spring essence', '召唤源泉', '接线待战斗屏改造（行先立·图先出）'],
  // 徽记（17）
  ['battle', '⚔', 'crossed chinese dao sabers', '出征/战斗', '已接：顶栏战役 pill；后续出征键 Button.icon'],
  ['fortune', '🎴', 'ornate fate card with mystic glyph', '卦象/命运牌', '已接：浮层启动器'],
  ['deck', '🃏', 'fanned playing cards', '牌组', '接线随屏改造（tab 导航）'],
  ['dice', '🎲', 'six-sided battle die showing pips', '战力骰', '接线随屏改造（战斗屏）'],
  ['shield', '🛡', 'round bronze war shield', '防御/守护', '接线随屏改造'],
  ['tiangang', '⚡', 'thunderbolt talisman emblem', '天罡', '接线随屏改造（收藏/牌组卡标）'],
  ['dizhi', '🀄', 'mahjong-style zodiac tile', '地支', '接线随屏改造'],
  ['foil', '✨', 'four-point radiant sparkle', '闪艺', '已接：顶栏+收藏页头'],
  ['trophy', '🏆', 'bronze victory cup', '战利品/天梯', '接线随屏改造'],
  ['skull', '💀', 'ancient warrior skull', '阵亡/败北', '接线随屏改造（战斗屏）'],
  ['shop', '🛒', 'market stall with hanging coins', '商城', '已接：顶栏+浮层启动器'],
  ['settings', '⚙', 'bronze mechanical gear', '设置', '已接：顶栏+浮层启动器'],
  ['manual', '📖', 'open bound war manual', '手册/帮助', '已接：顶栏+浮层启动器'],
  ['story', '📜', 'unrolled ancient scroll', '开场故事', '已接：浮层启动器'],
  ['craft', '🔨', 'smith hammer over anvil', '改造坊', '接线随屏改造（tab 导航）'],
  ['collection', '🗃', 'card archive chest', '收藏', '已接：收藏页头'],
  ['target', '🎯', 'archery target with arrow', '克制提示', '接线随屏改造'],
  // 生肖（12·改造坊镶嵌/卡包 chips 已接 Tag.icon·商城兑换随屏改造）
  ['zodiac-rat', '🐀', 'rat head emblem, chinese zodiac', '生肖·鼠', '已接：改造坊生肖 chips（Tag.icon）'],
  ['zodiac-ox', '🐂', 'ox head emblem, chinese zodiac', '生肖·牛', '已接：改造坊生肖 chips'],
  ['zodiac-tiger', '🐅', 'tiger head emblem, chinese zodiac', '生肖·虎', '已接：改造坊生肖 chips'],
  ['zodiac-rabbit', '🐇', 'rabbit head emblem, chinese zodiac', '生肖·兔', '已接：改造坊生肖 chips'],
  ['zodiac-dragon', '🐉', 'dragon head emblem, chinese zodiac', '生肖·龙', '已接：改造坊生肖 chips'],
  ['zodiac-snake', '🐍', 'snake head emblem, chinese zodiac', '生肖·蛇', '已接：改造坊生肖 chips'],
  ['zodiac-horse', '🐎', 'horse head emblem, chinese zodiac', '生肖·马', '已接：改造坊生肖 chips'],
  ['zodiac-goat', '🐑', 'goat head emblem, chinese zodiac', '生肖·羊', '已接：改造坊生肖 chips'],
  ['zodiac-monkey', '🐒', 'monkey head emblem, chinese zodiac', '生肖·猴', '已接：改造坊生肖 chips'],
  ['zodiac-rooster', '🐓', 'rooster head emblem, chinese zodiac', '生肖·鸡', '已接：改造坊生肖 chips'],
  ['zodiac-dog', '🐕', 'dog head emblem, chinese zodiac', '生肖·狗', '已接：改造坊生肖 chips'],
  ['zodiac-pig', '🐖', 'pig head emblem, chinese zodiac', '生肖·猪', '已接：改造坊生肖 chips'],
];
const ICON_EMOJI = Object.fromEntries(ICON_ROWS.map(([tok, emoji]) => [`game-g/icon/${tok}`, emoji]));
const iconRows = ICON_ROWS.map(([token, emoji, subject, name, wired]) => ({
  skinKey: `game-g/icon/${token}`, kind: 'sprite',
  slot: { entity: `icon:${token}`, component: 'Icon', field: 'src' },
  query: `${subject}, ${ICON_STYLE}`, prompt: null,
  spec: { w: 128, h: 128, transparent: true },
  desc: `套装图标·${name}（现=emoji ${emoji}）`,
  context: `统一图标集 34 枚之一（风格锚在 query 尾·成套生成勿单换风格）·消费=iconUri('${token}')·${wired}`,
  status: 'needs-art', gen: null, provenance: null,
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

// ── 占位图（owner 07-15「art-54~63 没有预览占位符」）：给每个未出真图的行生成**当前游戏实际观感**的
// 确定性 SVG 快照（主题色底/CSS 金币渐变/棋盘格牌背/按钮现皮近似）→ 工坊行封面回落 placeholder.servedPath。
// 语义与 gen 分开：gen=生成的真图（fill 流水线写）；placeholder=现况快照（本脚本重跑即重derive·不进 gen）。
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svgDoc = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const backdropPh = (w, h, label) => svgDoc(w, h,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0a07"/><stop offset="1" stop-color="#171109"/></linearGradient></defs>`
  + `<rect width="${w}" height="${h}" fill="url(#g)"/><rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="#d4bd8a" stroke-opacity=".22" stroke-width="2"/>`
  + `<text x="50%" y="46%" text-anchor="middle" fill="#e8cd82" font-size="${Math.round(h / 16)}" font-family="serif">${esc(label)}</text>`
  + `<text x="50%" y="58%" text-anchor="middle" fill="#7c6e54" font-size="${Math.round(h / 26)}" font-family="serif">现况：纯主题色底 · 出图后整幅替换</text>`);
const coinPh = (label, inner, outer) => svgDoc(256, 256,
  `<defs><radialGradient id="c" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient></defs>`
  + `<circle cx="128" cy="128" r="118" fill="url(#c)" stroke="#f1d792" stroke-width="6"/>`
  + `<text x="50%" y="55%" text-anchor="middle" fill="#2a1a08" font-size="88" font-weight="bold" font-family="serif">${esc(label)}</text>`);
const cardBackPh = () => svgDoc(480, 640,
  `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b34a4a"/><stop offset="1" stop-color="#8c3535"/></linearGradient>`
  + `<pattern id="ck" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#ffffff" opacity=".06"/><rect x="12" y="12" width="12" height="12" fill="#ffffff" opacity=".06"/></pattern></defs>`
  + `<rect width="480" height="640" rx="24" fill="url(#b)"/><rect width="480" height="640" rx="24" fill="url(#ck)"/>`
  + `<rect x="14" y="14" width="452" height="612" rx="16" fill="none" stroke="#f1d792" stroke-opacity=".5" stroke-width="3"/>`
  + `<text x="50%" y="53%" text-anchor="middle" fill="#e3c275" font-size="120" font-family="serif">❖</text>`);
const btnPh = (w, h, kind) => {
  if (kind === 'hero') return svgDoc(w, h,
    `<defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d792"/><stop offset="1" stop-color="#dcbb79"/></linearGradient></defs>`
    + `<polygon points="26,0 ${w},0 ${w},${h - 26} ${w - 26},${h} 0,${h} 0,26" fill="url(#h)"/>`
    + `<text x="50%" y="60%" text-anchor="middle" fill="#2a1a08" font-size="${Math.round(h / 3)}" font-weight="bold" font-family="serif">⚔ 出征</text>`);
  const fill = kind === 'primary' ? 'rgba(227,194,117,.14)' : 'rgba(255,255,255,.04)';
  const line = kind === 'primary' ? '#e3c275' : '#5a4f3d';
  const txt = kind === 'primary' ? '主按钮' : '次按钮';
  return svgDoc(w, h, `<rect width="${w}" height="${h}" rx="10" fill="#14100a"/><rect width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${line}" stroke-width="3"/>`
    + `<text x="50%" y="62%" text-anchor="middle" fill="${kind === 'primary' ? '#e3c275' : '#bda984'}" font-size="${Math.round(h / 3)}" font-family="serif">${txt}</text>`);
};
const dicePh = () => svgDoc(256, 256,
  `<rect x="28" y="28" width="200" height="200" rx="34" fill="#3a332a" stroke="#8a7a5c" stroke-width="6"/>`
  + [[78, 78], [178, 78], [128, 128], [78, 178], [178, 178]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="#e8cd82"/>`).join('')
  );
const iconPh = (emoji) => svgDoc(128, 128,
  `<rect width="128" height="128" rx="24" fill="#171109" stroke="#d4bd8a" stroke-opacity=".3" stroke-width="3"/>`
  + `<text x="50%" y="58%" text-anchor="middle" font-size="64">${esc(emoji)}</text>`);
const bannerPh = (label) => svgDoc(640, 200,
  `<rect width="640" height="200" fill="#171109"/><rect x="6" y="6" width="628" height="188" fill="none" stroke="#d4bd8a" stroke-opacity=".3" stroke-width="2"/>`
  + `<text x="50%" y="56%" text-anchor="middle" fill="#e8cd82" font-size="34" font-family="serif">${esc(label)}</text>`);
function placeholderFor(r) {
  const k = r.skinKey;
  if (k === 'game-g/tex/coin-heads') return [coinPh('正', '#f6e3a8', '#8a6a20'), '现况=CSS 金渐变圆+文字'];
  if (k === 'game-g/tex/coin-tails') return [coinPh('反', '#e7e7ea', '#6f7480'), '现况=CSS 银渐变圆+文字'];
  if (k === 'game-g/tex/card-back') return [cardBackPh(), '现况=红底棋盘格程序纹+❖'];
  if (k === 'game-g/model/clash-dice') return [dicePh(), '现况=程序化 3D 图元骰'];
  if (k.startsWith('game-g/ui/btn-')) return [btnPh(r.spec?.w ?? 240, r.spec?.h ?? 80, k.split('btn-')[1]), '现况=引擎 kind 底（CSS）'];
  if (k.startsWith('game-g/icon/')) return [iconPh(ICON_EMOJI[k] ?? '❓'), `现况=emoji ${ICON_EMOJI[k] ?? ''} 记号`];
  if (k.startsWith('game-g/shop/banner-')) return [bannerPh(r.desc.split('（')[0]), '现况=纯文案面板无图'];
  if (k.startsWith('game-g/story/')) return [backdropPh(1024, 576, r.desc.split('（')[0]), '现况=纯旁白无插画'];
  return [backdropPh(r.spec?.w ?? 1280, r.spec?.h ?? 720, r.desc.split('（')[0]), '现况=纯主题色底'];
}

// uiRows/storyRows/shopRows/iconRows 排在 diceRow 后（新行顺延·不动既有编号——mergeLedger 老行保号、新行 maxNo 顺延）。
const rows = [...heroRows, ...texRows, diceRow, ...uiRows, ...storyRows, ...shopRows, ...iconRows].map((r, i) => ({ no: 'art-' + String(i + 1).padStart(2, '0'), ...r }));
const fresh = { version: 1, game: 'game-g', mode: 'requirements', count: rows.length, rows };

const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-g', 'art', 'art-ledger.json');
const PH_DIR = join(ROOT, 'public', 'games', 'game-g', 'art', 'placeholder');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
const merged = mergeLedger(prev, fresh, null);
mkdirSync(PH_DIR, { recursive: true });
let phN = 0;
for (const r of merged.rows) {
  if (r.gen || r.status === 'replaced' || r.status === 'retired') continue; // 有真图/现身图的行不需要占位快照
  const [svg, current] = placeholderFor(r);
  const base = r.skinKey.split('/').slice(1).join('-') + '.svg';
  writeFileSync(join(PH_DIR, base), svg);
  r.placeholder = { servedPath: `/games/game-g/art/placeholder/${base}`, current };
  phN += 1;
}
writeFileSync(LEDGER_FILE, JSON.stringify(merged, null, 2) + '\n');
console.error(`[game-g artreq] ${merged.rows.length} 行台账（${phN} 行带现况占位快照）→ ${LEDGER_FILE}`);
console.log(JSON.stringify({ ok: true, rows: merged.rows.length, placeholders: phN }));
