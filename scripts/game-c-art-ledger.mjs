#!/usr/bin/env node
// game-c《STORY-POKER V2》美术台账生成器（authored-inventory·mirror game-b/game-g）。
// 真相=docs/design/game-c/art-bible-story-poker-v2.md §1 风格 + §3 面清单；本脚本展开成机读账
//   → public/games/game-c/art/art-ledger.json（平台素材屏 + audit 读它）。改风格/面→改本脚本→重跑。
// 覆盖：背景 · 牌桌 · 全副 52 牌面+牌背 · 9 面额筹码 · UI 按钮/框贴图 · 特效(VFX·待接槽) · 衣柜图标。
// 红线：立绘=外部角色卡 Avatar.src（不入账·非我方资产）；status=placeholder（素坯占位·真图待出）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// §1 统一风格前缀（拼进每条 query·出图必守·钉死调色板）。
const P = 'luxury night poker parlor, violet-and-gold noir, cinematic rim light, moody purple palette (#7d5570 velvet, #d8b878 gold, #c9a9dd violet glow, #d0483e danger), painterly premium mobile-game art, refined tasteful';

const rows = [];
let n = 0;
/** 加一行台账。slot=消费槽位实名；sub=英文主体；spec；cn=中 prompt；cur=素坯现状；transparent。 */
const add = (skinKey, kind, desc, slot, servedPath, sub, spec, cn, cur, extra = {}) => {
  rows.push({
    no: `art-${String(++n).padStart(3, '0')}`,
    desc, kind,
    ref: { mechanism: slot.mechanism, component: slot.component, field: slot.field, resolver: slot.resolver, servedPath: `/games/game-c/art/${servedPath}` },
    query: `${sub}, ${P}, isolated subject${spec.transparent ? ', transparent background' : ''}, no watermark`,
    placeholder: { current: cur, source: 'procedural-placeholder', count: 1, instances: [skinKey] },
    spec,
    context: `game-c《STORY-POKER V2》${desc}·消费=${slot.resolver}（art-bible §3·render-only 不进 sim hash）`,
    status: 'placeholder',
    gen: { provider: 'pending', model: null, prompt: null, servedPath: `/games/game-c/art/${servedPath}`, localId: skinKey },
    provenance: { generator: 'placeholder', prompt: null, model: null, license: null, source: 'docs/design/game-c/art-bible-story-poker-v2.md', mock: false, note: '素坯占位·真图待出（照 §1 统一风格）', ...extra },
    prompt: cn,
  });
};

// ── ① 场景/背景 ───────────────────────────────────────────
add('game-c/scene/backdrop', 'texture', '夜景背幕（全屏落地窗+城市夜景+景深光斑）',
  { mechanism: 'url', component: 'ThreeRenderer', field: 'setBackgroundTexture', resolver: 'renderer.setBackgroundTexture' },
  'scene/backdrop.png', 'floor-to-ceiling window over a nocturnal city skyline, bokeh city lights, deep purple night, horizontal cinematic composition',
  { w: 2048, h: 1152, transparent: false }, '夜景背幕·落地窗+城市夜景+景深光斑', '素坯：声明式 SVG 夜景（theme STORY_BACKDROP）');

// ── ② 牌桌（隐形碰撞 + 2D 贴图呢面·owner 定）────────────────
const felt = { mechanism: 'index', component: 'Material3D', field: 'map', resolver: 'build3d table-felt Material3D.map' };
add('game-c/table/felt-albedo', 'texture', '呢面绒布 albedo（紫绒+桌心暖光池）', felt, 'table/felt-albedo.png',
  'purple velvet poker felt cloth, elliptical racetrack table surface, warm light pool at center, fine woven nap', { w: 1024, h: 1024, transparent: false }, '呢面 albedo·紫绒+暖光池', '素坯：Mesh3D 纯 tint(0x6a4462)+暖 point 光');
add('game-c/table/felt-normal', 'texture', '呢面法线（天鹅绒织纹）', { ...felt, field: 'normalMap', resolver: 'build3d table-felt Material3D.normalMap' }, 'table/felt-normal.png',
  'velvet cloth weave normal map, tangent-space, subtle fabric bump', { w: 1024, h: 1024, transparent: false }, '呢面法线·天鹅绒织纹·线性', '无（当前纯 tint）');
add('game-c/table/rail-albedo', 'texture', '木栏 albedo（胡桃木+皮革软边）', { ...felt, resolver: 'build3d table-base Material3D.map' }, 'table/rail-albedo.png',
  'dark walnut poker table rail with padded leather bumper, warm highlight, ring strip', { w: 1024, h: 256, transparent: false }, '木栏 albedo·胡桃木+皮革软边', '素坯：Mesh3D 纯 tint(0x6f5040)');
add('game-c/table/rail-normal', 'texture', '木栏法线（木纹+皮革缝线）', { ...felt, field: 'normalMap', resolver: 'build3d table-base Material3D.normalMap' }, 'table/rail-normal.png',
  'walnut wood grain plus leather stitch normal map, tangent-space', { w: 1024, h: 256, transparent: false }, '木栏法线·木纹+缝线', '无');
add('game-c/table/betline', 'texture', '下注线/发牌区贴花（桌面弧线）', { mechanism: 'index', component: 'Decal3D', field: 'tex', resolver: 'Decal3D 桌面贴花·下注线' }, 'table/betline.png',
  'subtle gold betting line arc and dealer area marking decal on felt, semi-transparent', { w: 1024, h: 512, transparent: true }, '下注线/发牌区贴花·金弧', '无');

// ── ③ 全副 52 牌面 + 牌背 ─────────────────────────────────
const RANKS = [['2', 'two', 'number'], ['3', 'three', 'number'], ['4', 'four', 'number'], ['5', 'five', 'number'], ['6', 'six', 'number'], ['7', 'seven', 'number'], ['8', 'eight', 'number'], ['9', 'nine', 'number'], ['T', 'ten', 'number'], ['J', 'jack', 'court'], ['Q', 'queen', 'court'], ['K', 'king', 'court'], ['A', 'ace', 'ace']];
const SUITS = [['S', 'spades', 'black'], ['H', 'hearts', 'red'], ['D', 'diamonds', 'red'], ['C', 'clubs', 'black']];
const cardCn = { S: '黑桃', H: '红心', D: '方块', C: '梅花' };
const rankCn = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
for (const [rk, rn, rt] of RANKS) for (const [sk, sn, color] of SUITS) {
  const sub = rt === 'court'
    ? `the ${rn} of ${sn}, poker court card, ornate ${color} ${rn} figure illustration in violet-and-gold noir dress, white card face, rank pip and suit symbol in corners`
    : rt === 'ace'
      ? `the ace of ${sn}, poker ace card, large ornate ${color} suit emblem centered, white card face, gilded flourish`
      : `the ${rn} of ${sn}, poker number card, ${color} suit pips arranged classic, white card face, clean bold rank`;
  add(`game-c/card/${rk}${sk}`, 'sprite', `牌面·${cardCn[sk]}${rankCn[rk]}`,
    { mechanism: 'index', component: 'PlayingCard', field: 'art', resolver: `cardNode PlayingCard.art（${rk}${sk}）` },
    `cards/${rk}${sk}.png`, sub, { w: 240, h: 336, transparent: false }, `牌面·${cardCn[sk]}${rankCn[rk]}·夜金 noir 扑克`,
    '素坯：PlayingCard 程序牌面（白底+红黑点数花色）·货架 52 PD 可 vendor');
}
add('game-c/card/back', 'texture', '牌背（紫绒底+金饰纹章·owner AI 定制）',
  { mechanism: 'index', component: 'PlayingCard', field: 'backArt', resolver: 'cardNode faceUp:false → PlayingCard.backArt' },
  'cards/back.png', 'poker card back, purple velvet ground with gilded ornamental crest and central emblem, symmetric, luxury noir',
  { w: 240, h: 336, transparent: false }, '牌背·紫绒底+金饰纹章+中央徽标', '素坯：PlayingCard face:dark（bg3 暖紫）');

// ── ④ 筹码 9 面额（顶/侧面贴图·owner AI·统一夜金边框）──────
const CHIPS = [['1', 'white', '白'], ['5', 'red', '红'], ['10', 'blue', '蓝'], ['25', 'green', '绿'], ['50', 'orange', '橙'], ['100', 'black', '黑'], ['500', 'purple', '紫'], ['1000', 'gold', '金'], ['5000', 'gray', '灰']];
for (const [denom, colorEn, colorCn] of CHIPS) {
  add(`game-c/chip/${denom}`, 'texture', `筹码·${denom}（${colorCn}·顶+侧面）`,
    { mechanism: 'index', component: 'Chip3D/Material3D', field: 'map', resolver: `3D 筹码柱贴图·面额 ${denom}` },
    `chips/${denom}.png`, `casino poker chip denomination ${denom}, ${colorEn} body with a unified gold rim and dark-violet inlay pattern, top and edge, premium`,
    { w: 256, h: 256, transparent: true }, `筹码 ${denom}·${colorCn}底+统一金边`, '素坯：程序分色圆柱（chip3d）·货架 9 面额可 vendor');
}

// ── ⑤ UI 按钮 / 框贴图（9-slice）─────────────────────────────
const btn = (field) => ({ mechanism: 'skin', component: 'theme.buttonSkins/Button', field, resolver: `buttonSkins 或 node Button.skin·${field}` });
add('game-c/ui/btn-fold', 'texture', '弃牌 按钮皮（哑光深皮金边）', btn('skin'), 'ui/btn-fold.png', 'matte dark leather UI button plate with thin gold rim, neutral, 9-slice', { w: 280, h: 88, transparent: true }, '弃牌按钮皮·哑光深皮金边', '素坯：Panel BTN_DARK+金边');
add('game-c/ui/btn-call', 'texture', '跟注/过牌 按钮皮（主操作）', btn('skin'), 'ui/btn-call.png', 'matte dark leather UI button plate with gold rim, primary action, warm sheen, 9-slice', { w: 280, h: 88, transparent: true }, '跟注按钮皮·金边主操作', '素坯：Panel BTN_DARK+金边');
add('game-c/ui/btn-raise', 'texture', '加注 按钮皮（紫辉进攻）', btn('skin'), 'ui/btn-raise.png', 'matte dark UI button plate with violet glow rim, aggressive, 9-slice', { w: 280, h: 88, transparent: true }, '加注按钮皮·紫辉', '素坯：Panel BTN_DARK+金边+press3d');
add('game-c/ui/btn-allin', 'texture', 'All-in 按钮皮（红渐变警示）', btn('skin'), 'ui/btn-allin.png', 'glowing crimson-to-maroon UI button plate, all-in warning, bright edge, 9-slice', { w: 200, h: 72, transparent: true }, 'All-in 按钮皮·红渐变', '素坯：Panel BTN_ALLIN');
add('game-c/ui/btn-hero', 'texture', '主键皮（开始/确认/再来·hero）', btn('skin'), 'ui/btn-hero.png', 'premium gold gilded primary CTA button plate, ornate, 9-slice', { w: 560, h: 96, transparent: true }, 'hero 主键皮·鎏金 CTA', '素坯：Button kind:hero（金渐变）');
add('game-c/ui/btn-ghost', 'texture', '次键皮（继续/设置/返回·ghost）', btn('skin'), 'ui/btn-ghost.png', 'subtle dark ghost button plate with faint violet outline, 9-slice', { w: 560, h: 96, transparent: true }, 'ghost 次键皮·暗紫描边', '素坯：Button kind:ghost');
add('game-c/ui/step', 'texture', '加注步进 −/+ 键皮', btn('skin'), 'ui/step.png', 'small round dark stepper button with violet rim, plus/minus', { w: 96, h: 96, transparent: true }, '步进 −/+ 键皮·圆形暗紫', '素坯：Button kind:ghost 小圆');
add('game-c/ui/panel-frame', 'texture', '面板/席卡框（9-slice·紫金边）', { mechanism: 'skin', component: 'Panel', field: 'bgTexture/frame', resolver: 'Panel 9-slice 框皮（席卡/顶带/底池）' }, 'ui/panel-frame.png', 'ornate dark violet panel frame with gold trim, 9-slice border', { w: 320, h: 200, transparent: true }, '面板/席卡框·紫金 9-slice', '素坯：Panel 渐变+edge 令牌（数据·可不出图）');
add('game-c/ui/avatar-frame', 'texture', '头像框（对手/主角·金环）', { mechanism: 'index', component: 'Avatar', field: 'frame', resolver: '头像外金环框（叠在 Avatar 外）' }, 'ui/avatar-frame.png', 'circular gold ornate avatar frame ring, luxury', { w: 128, h: 128, transparent: true }, '头像金环框', '素坯：Avatar 圆（bg3+line 边·无框）');
add('game-c/ui/dealer-D', 'texture', '庄家钮 D', { mechanism: 'index', component: 'Decal3D/Sprite', field: 'tex', resolver: '庄家位圆片' }, 'ui/dealer.png', 'round dealer button token letter D, ivory disc with gold rim', { w: 128, h: 128, transparent: true }, '庄家钮 D·象牙+金边', '素坯：Badge D（LayoutNode）');

// ── ⑥ 特效 VFX（owner「现在没特效·可以加」·slot 待接 Vfx3D/Billboard3D）──
const vfx = (r) => ({ mechanism: 'index', component: 'Vfx3D/Billboard3D', field: 'tex', resolver: `VFX 贴图·${r}（待接 Vfx3D/Billboard3D 槽）` });
add('game-c/fx/win-burst', 'texture', '特效·胜利爆花（收池/赢家）', vfx('win burst'), 'fx/win-burst.png', 'golden particle burst and light rays sprite sheet, celebratory, radial', { w: 512, h: 512, transparent: true }, '胜利爆花·金色粒子光芒', '无（待接 VFX 槽）');
add('game-c/fx/allin-flash', 'texture', '特效·All-in 冲击闪', vfx('all-in flash'), 'fx/allin-flash.png', 'crimson shockwave ring and flash sprite, dramatic', { w: 512, h: 512, transparent: true }, 'All-in 冲击闪·红色波纹', '无（待接 VFX 槽）');
add('game-c/fx/chip-spark', 'texture', '特效·筹码抛掷火花', vfx('chip toss spark'), 'fx/chip-spark.png', 'small gold spark and dust puff sprite for chip impact', { w: 256, h: 256, transparent: true }, '筹码抛掷火花·金色微尘', '无（待接 VFX 槽）');
add('game-c/fx/deal-glow', 'texture', '特效·发牌/翻牌流光', vfx('card deal glow'), 'fx/deal-glow.png', 'soft violet-gold streak glow sprite for card reveal', { w: 512, h: 256, transparent: true }, '发牌/翻牌流光·紫金拖尾', '无（待接 VFX 槽）');
add('game-c/fx/winner-ring', 'texture', '特效·赢家光环（座位高亮）', vfx('winner ring'), 'fx/winner-ring.png', 'glowing gold laurel ring halo sprite, seat highlight', { w: 512, h: 512, transparent: true }, '赢家光环·金桂环', '素坯：Panel fx glow（程序·可留）');
add('game-c/fx/pot-shine', 'texture', '特效·底池金光', vfx('pot shine'), 'fx/pot-shine.png', 'soft golden glow and coin shimmer sprite over the pot', { w: 512, h: 256, transparent: true }, '底池金光·硬币微闪', '无（待接 VFX 槽）');

// ── ⑦ 衣柜件图标 ×6（现 emoji·可升级真图标）────────────────
const WEAR = [['earrings', '耳环', 'diamond earrings'], ['gloves', '手套', 'silk opera gloves'], ['socks', '袜', 'stockings'], ['top', '上装', 'qipao top'], ['skirt', '裙', 'silk skirt'], ['lingerie', '内衣', 'lace lingerie (tasteful, non-explicit)']];
for (const [id, cn, en] of WEAR) {
  add(`game-c/icon/wear-${id}`, 'texture', `衣柜图标·${cn}`, { mechanism: 'url', component: 'Image', field: 'src', resolver: `衣柜件图标·${id}（替代 emoji）` }, `icons/wear-${id}.png`,
    `elegant icon of ${en}, gold-outlined, dark violet backdrop, tasteful boudoir item, game inventory icon`, { w: 128, h: 128, transparent: true }, `衣柜件图标·${cn}·金描边`, `素坯：emoji（${cn}）`);
}

const ledger = { version: 1, game: 'game-c', mode: 'authored-inventory', count: rows.length, instances: rows.length, rows };
const out = resolve(ROOT, 'public/games/game-c/art/art-ledger.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(ledger, null, 1)}\n`);
console.log(`game-c art-ledger → ${out} (${rows.length} 行)`);
console.log('  分类：场景1 · 牌桌5 · 牌面52+背1 · 筹码9 · UI 按钮/框10 · 特效6 · 衣柜图标6 ·（立绘=外部角色卡不入账）');
