// Game I 展示台 · 页 · 新控件/特性
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { nextSubNo, sectionTitle, divider, ALPHA_TILE_URI, SKIN_METAL_URL, SKIN_WOOD_URL, SKIN_STONE_URL, SKIN_SCROLL_URL, BTN_BLUE_URL, BTN_GREEN_URL, BTN_RED_URL, BTN_YELLOW_URL, BTN_GREY_URL, BTN_ROUND_URL, BTN_GLOSSY_URL, BTN_GHOST_URL, CARD_JOKER_URL, CARD_FLOWER_URL, CARTOON_ASTRO, CARTOON_CAT, CARTOON_DOG, CARTOON_CAMP, CARTOON_GAME, CARTOON_MUSIC, CARTOON_BDAY, CARTOON_ROBOT, CARTOON_TRAVEL } from './shared.js';
import type { ControlsState } from './shared.js';
import { uiTextureUrl } from '../ui-assets.js';
export function buildPageNew(controls: ControlsState): LayoutNode {
  const pcard = (id: string, p: Record<string, unknown>): LayoutNode => ({ type: 'PlayingCard', id, props: p });
  return {
    type: 'Panel', id: 'page-new', props: { scroll: true },
    layout: { direction: 'column', gap: 18, padding: 20 },
    children: [
      sectionTitle('t-anchor', '★ 锚定层 FLOAT / CONNECTOR（把浮层/连线钉在活动目标上·取代手写 getElementById·REQ-UI-锚定①）'),
      { type: 'Label', id: 't-anchor-sub', props: { text: '下方三个单位是普通 LayoutNode（各有 id）。名牌 Float 锚在单位头顶(at:top)、每帧跟随；VS 连线 Connector 从赵→关(arrow·danger)。滚动/换 tab 时浮层自动跟随或隐藏（目标消失不悬空）。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'anchor-field', props: { bg: { custom: 'linear-gradient(160deg,#16402c,#0e2a1c)' }, vignette: true }, layout: { direction: 'row', gap: 40, padding: 30, justify: 'center', align: 'center', height: 160 },
        children: [
          { type: 'PlayingCard', id: 'anchor-u1', props: { rank: 'A', suit: '♠', label: '赵子龙', size: 'lg' } },
          { type: 'PlayingCard', id: 'anchor-u2', props: { rank: 'K', suit: '♥', label: '关云长', size: 'lg', face: 'light' } },
          { type: 'PlayingCard', id: 'anchor-u3', props: { rank: 'Q', suit: '♣', label: '小兵', size: 'md', dimmed: true } },
        ] },
      // 浮层：名牌钉在单位头顶（at:top·offset 上抬）·血条钉在脚下。目标 id = 上面卡的 id。
      { type: 'Float', id: 'anchor-plate1', props: { anchorTo: { kind: 'node', id: 'anchor-u1', at: 'top', offset: { y: -6 } } },
        children: [{ type: 'Badge', id: 'anchor-p1b', props: { text: '★ 赵子龙 Lv.9', tone: 'warn' } }] },
      { type: 'Float', id: 'anchor-hp1', props: { anchorTo: { kind: 'node', id: 'anchor-u1', at: 'bottom', offset: { y: 12 } } },
        children: [{ type: 'ProgressBar', id: 'anchor-hp1b', props: { value: 0.72, tone: 'ok', label: 'HP', showValue: true }, layout: { width: 96 } }] },
      { type: 'Float', id: 'anchor-plate2', props: { anchorTo: { kind: 'node', id: 'anchor-u2', at: 'top', offset: { y: -6 } } },
        children: [{ type: 'Badge', id: 'anchor-p2b', props: { text: '关云长 Lv.8', tone: 'ok' } }] },
      // 连线：赵→关 攻击指向（arrow·danger·带伤害标）+ 关→小兵 关系线（dashed·jade）。
      { type: 'Connector', id: 'anchor-atk', props: { from: { kind: 'node', id: 'anchor-u1', at: 'right' }, to: { kind: 'node', id: 'anchor-u2', at: 'left' }, style: 'arrow', tone: 'danger', label: '−120' } },
      { type: 'Connector', id: 'anchor-rel', props: { from: { kind: 'node', id: 'anchor-u2' }, to: { kind: 'node', id: 'anchor-u3' }, style: 'dashed', tone: 'jade' } },
      { type: 'Label', id: 't-anchor-note', props: { text: 'anchorTo:{kind:node/entity, id, at, offset} —— node=同树 LayoutNode id（现一律用这路·game-g 战场单位本身就是 LayoutNode）；entity=预留契约·生产端未接（2D canvas/3D WebGL 无逐实体 DOM）·别用。render-only·不进 sim/hash。', color: 'dim', size: 'xs' } },
      divider('d-anchor'),

      sectionTitle('t-pc', 'PLAYINGCARD · 扑克牌原语（rank/suit · 正反 · selected/dimmed · 暗卡/白扑克）'),
      { type: 'Panel', id: 'pc-row', props: {}, layout: { direction: 'row', gap: 12, padding: 14, align: 'center' },
        children: [
          pcard('pc-1', { rank: 'A', suit: '♠', label: '赵子龙', value: '9' }),
          pcard('pc-2', { rank: 'K', suit: '♥', label: '关云长', value: '8', selected: true }),
          pcard('pc-3', { rank: 'Q', suit: '♦', label: '未拥有', dimmed: true }),
          pcard('pc-4', { rank: 'J', suit: '♣', faceUp: false }),
          pcard('pc-5', { rank: '10', suit: '♥', face: 'light', label: '白扑克' }),
        ] },

      divider('d-n1'),
      sectionTitle('t-versus', 'VERSUS · 对决卡（左右牌 + 胜方高亮 + 中央火花）'),
      { type: 'Panel', id: 'vs-wrap', props: {}, layout: { direction: 'row', padding: 14, align: 'center' },
        children: [
          { type: 'Versus', id: 'vs-1', props: {
            left: { rank: 'A', suit: '♠', label: '赵子龙' }, right: { rank: 'K', suit: '♥', label: '关云长' },
            label: '76 : 24', winner: 'left' } },
        ] },

      divider('d-n2'),
      sectionTitle('t-coin', 'COINFLIP · 抛硬币（spinning 翻转落定 / 静态结果）'),
      { type: 'Panel', id: 'coin-row', props: {}, layout: { direction: 'row', gap: 28, padding: 14, align: 'center' },
        children: [
          { type: 'CoinFlip', id: 'coin-1', props: { outcome: 'heads', spinning: true, headsLabel: '胜', tailsLabel: '负' } },
          { type: 'CoinFlip', id: 'coin-2', props: { outcome: 'tails', spinning: false, headsLabel: '胜', tailsLabel: '负' } },
        ] },

      divider('d-n3'),
      sectionTitle('t-hero', 'BUTTON · hero 金色倒角 sheen 大 CTA（含副标）'),
      { type: 'Panel', id: 'hero-wrap', props: {}, layout: { direction: 'row', padding: 14, align: 'center' },
        children: [
          { type: 'Button', id: 'btn-hero', props: { label: '出 征', kind: 'hero', sub: '挑战 曹操 · 难度 ★★★', action: 'click', actionArg: 'hero' } },
        ] },

      divider('d-n4'),
      sectionTitle('t-lblnew', 'LABEL · 数字滚动补间 tween + 富文本多段着色 spans'),
      { type: 'Panel', id: 'lbl-new', props: {}, layout: { direction: 'column', gap: 12, padding: 14 },
        children: [
          { type: 'Label', id: 'lbl-tween', props: { text: '', size: 'xl', bold: true, color: 'gold', tween: { from: 0, to: 9820, ms: 1300 } } },
          { type: 'Label', id: 'lbl-spans', props: { text: '', spans: [
            { text: '词条：', color: 'dim' }, { text: '青钢剑', color: 'jade', bold: true },
            { text: ' 攻击 ', color: 'sub' }, { text: '+12', color: 'ok', bold: true },
            { text: ' 暴击 ', color: 'sub' }, { text: '-5', color: 'danger' },
          ] } },
        ] },

      divider('d-n5'),
      sectionTitle('t-panelprops', 'PANEL · bare 无框 / bg 自定义底 + vignette 暗角 / maxWidth 封顶居中'),
      { type: 'Panel', id: 'pp-bare', props: { bare: true }, layout: { direction: 'row', gap: 10 },
        children: [
          { type: 'Badge', id: 'pp-b1', props: { text: 'bare', tone: 'ok' } },
          { type: 'Label', id: 'pp-bl', props: { text: 'bare 容器：无边框/底，只做 row/column 分组（不堆千层框）。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
        ] },
      { type: 'Panel', id: 'pp-felt', props: { title: 'bg 自定义底（felt）+ vignette 暗角', bg: { custom: 'linear-gradient(180deg,#16402c,#0e2a1c)' }, vignette: true },
        layout: { direction: 'column', padding: 18, height: 84 },
        children: [{ type: 'Label', id: 'pp-fl', props: { text: '绿呢牌桌底 + 四周渐暗暗角（纯表现）。', color: 'sub', size: 'sm' } }] },
      { type: 'Panel', id: 'pp-maxw', props: { title: 'maxWidth 封顶居中' }, layout: { maxWidth: 360, padding: 14 },
        children: [{ type: 'Label', id: 'pp-ml', props: { text: '窄屏铺满、宽屏封顶 360px 居中（整页 chrome 用）。', color: 'sub', size: 'sm' } }] },

      divider('d-n6'),
      sectionTitle('t-vw', 'VISIBLEWHEN · 条件显隐（数据替代 if/else 重建树）'),
      { type: 'Panel', id: 'vw-wrap', props: {}, layout: { direction: 'column', gap: 10, padding: 14 },
        children: [
          { type: 'Toggle', id: 'vw-tg', props: { label: '显示下方内容（绑 demoFlag）', checked: controls.flag, action: 'setFlag' } },
          { type: 'Label', id: 'vw-target', props: { text: '👋 我由 visibleWhen:"demoFlag" 控制——关掉开关，我就被 resolveBindings 从树里整体剔除（不靠游戏写 if/else 重建）。', color: 'jade', size: 'sm' }, visibleWhen: 'demoFlag' },
        ] },

      divider('d-n7'),
      sectionTitle('t-anim', 'ANIM · 循环环境动效（float 浮动 / glow 发光 / pulse 脉冲·infinite）'),
      { type: 'Panel', id: 'anim-row', props: {}, layout: { direction: 'row', gap: 22, padding: 22, align: 'center' },
        children: [
          { type: 'Badge', id: 'anim-float', props: { text: 'float 浮动', tone: 'ok' }, layout: { anim: 'float' } },
          { type: 'Badge', id: 'anim-glow', props: { text: 'glow 发光', tone: 'warn' }, layout: { anim: 'glow' } },
          { type: 'Badge', id: 'anim-pulse', props: { text: 'pulse 脉冲', tone: 'dim' }, layout: { anim: 'pulse' } },
        ] },

      divider('d-n8'),
      sectionTitle('t-font', 'LABEL · 字体槽 font / 磷光 glow / 字距 tracking'),
      { type: 'Panel', id: 'font-col', props: {}, layout: { direction: 'column', gap: 10, padding: 14 },
        children: [
          { type: 'Label', id: 'font-disp', props: { text: '展示字体 font:display（衬线）· 千军万马避白袍', size: 'lg', bold: true, font: 'display' } },
          { type: 'Label', id: 'font-glow', props: { text: 'GLOW 磷光发光标题', size: 'lg', bold: true, color: 'gold', glow: true } },
          { type: 'Label', id: 'font-track', props: { text: 'T R A C K I N G · 宽字距微标', size: 'sm', color: 'jade', tracking: 3 } },
        ] },

      divider('d-n9'),
      sectionTitle('t-chamfer', 'CHAMFER · 倒角切角（clip-path 八边形·art-deco/扑克美学）'),
      { type: 'Panel', id: 'cham-row', props: {}, layout: { direction: 'row', gap: 16, padding: 18, align: 'center' },
        children: [
          { type: 'Panel', id: 'cham-1', props: { bg: { custom: 'linear-gradient(180deg,#1c2a44,#101826)' } }, layout: { chamfer: 14, padding: 16 },
            children: [{ type: 'Label', id: 'cham-l', props: { text: 'chamfer:14 切角面板', color: 'sub', size: 'sm' } }] },
          { type: 'Button', id: 'cham-btn', props: { label: '切角 CTA', kind: 'primary', action: 'click', actionArg: 'chamfer' }, layout: { chamfer: 10 } },
        ] },

      divider('d-shape'),
      sectionTitle('t-shape', 'BUTTON.shape · 异形按钮（闭集 ShapeToken·引擎预置 clip-path·弱 LLM 只选名·非自由坐标）'),
      { type: 'Panel', id: 'shape-row', props: {}, layout: { direction: 'grid', cols: 4, gap: 14, padding: 18 },
        children: ([
          ['pill', '胶囊', 'primary'], ['hexagon', '六边', 'hero'], ['diamond', '菱形', 'primary'],
          ['shield', '盾徽', 'hero'], ['ribbon', '绶带', 'primary'], ['chevron', '前进 ▶', 'ghost'],
          ['tag', '标签', 'ghost'], ['cut', '切角', 'primary'],
        ] as const).map(([shape, label, kind]): LayoutNode => ({
          type: 'Button', id: `shape-${shape}`,
          props: { label, kind, shape, action: 'click', actionArg: shape },
          // 异形须给足宽高避免裁掉文字（六边/菱形尤其）——见 catalog shape describe。
          layout: { width: 108, height: 54 },
        })) },

      divider('d-panelshadow'),
      sectionTitle('t-panelshadow', 'PANEL.shadow · 硬边平移投影（REQ-108-UI-03·卡通"浮空感"基件·闭集 {y,color}·非模糊阴影·非贴图）'),
      { type: 'Label', id: 'panelshadow-note', props: {
        text: '卡通 UI 的立体浮空全靠一条硬边偏移投影（box-shadow:0 <y>px 0 <color>）。以前要么手搓 CSS、要么每块面生成一张带投影的 SVG 贴皮。现在是 Panel 的闭集数据字段：y=下沉像素、color 优先填 SurfaceToken（换皮自适应）。稿子体系：身份牌 y=4 / 相位牌 y=5 / 招式卡 y=7 / 主 CTA y=8。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'panelshadow-row', props: {}, layout: { direction: 'grid', cols: 4, gap: 20, padding: 22 },
        children: ([
          { label: '你', y: 4, color: 'jade', edge: 'jade' },
          { label: '蓄力', y: 5, color: 'gold', edge: 'gold' },
          { label: '复读机', y: 7, color: 'danger', edge: 'danger' },
          { label: '开 始', y: 8, edge: 'gold' },
        ] as Array<{ label: string; y: number; color?: 'jade' | 'gold' | 'danger'; edge: 'jade' | 'gold' | 'danger' }>)
          .map(({ label, y, color, edge }): LayoutNode => ({
            type: 'Panel', id: `pshadow-${label}`,
            props: { edge, shadow: { y, ...(color ? { color } : {}) } },
            layout: { direction: 'column', align: 'center', justify: 'center', width: 132, height: 76, radius: 12 },
            children: [
              { type: 'Label', id: `pshadow-l-${label}`, props: { text: label, size: 'lg', bold: true, font: 'cnround', color: 'text' } },
              { type: 'Label', id: `pshadow-y-${label}`, props: { text: `shadow.y=${y}`, size: 'sm', color: 'sub' } },
            ],
          })) },
      { type: 'Label', id: 'panelshadow-cmp', props: { text: '对照：无 shadow 的面板贴在底面上、没有浮空感（下面这块）。同一块面加 shadow:{y:6} 就"抬"起来了。', size: 'sm', color: 'sub' } },
      { type: 'Panel', id: 'panelshadow-flat', props: { edge: 'jade' }, layout: { direction: 'row', gap: 16, padding: 14, align: 'center' },
        children: [
          { type: 'Panel', id: 'pshadow-flat-a', props: { bg: 'raised' }, layout: { width: 120, height: 56, align: 'center', justify: 'center', radius: 10 },
            children: [{ type: 'Label', id: 'pshadow-flat-al', props: { text: '无投影', color: 'sub', size: 'sm' } }] },
          { type: 'Panel', id: 'pshadow-flat-b', props: { bg: 'raised', shadow: { y: 6, color: '#14776a' } }, layout: { width: 120, height: 56, align: 'center', justify: 'center', radius: 10 },
            children: [{ type: 'Label', id: 'pshadow-flat-bl', props: { text: 'shadow y=6', color: 'text', size: 'sm', bold: true } }] },
        ] },

      divider('d-skin'),
      sectionTitle('t-skin', 'BUTTON.skin · 贴图按钮（资产 key→uiTextureUrl 解析→已解析 URL·入库自 public/games/game-i/art·配 shape=异形贴图键）'),
      { type: 'Panel', id: 'skin-row', props: {}, layout: { direction: 'grid', cols: 4, gap: 14, padding: 18 },
        children: ([
          ['sk-metal', '金属板', SKIN_METAL_URL, undefined], ['sk-wood-rib', '木纹绶带', SKIN_WOOD_URL, 'ribbon'],
          ['sk-stone-hex', '石纹六边', SKIN_STONE_URL, 'hexagon'], ['sk-scroll-tag', '卷轴标签', SKIN_SCROLL_URL, 'tag'],
          ['sk-metal-sh', '金属盾', SKIN_METAL_URL, 'shield'], ['sk-wood-cut', '木纹切角', SKIN_WOOD_URL, 'cut'],
          ['sk-stone-dia', '石纹菱形', SKIN_STONE_URL, 'diamond'], ['sk-scroll-pill', '卷轴胶囊', SKIN_SCROLL_URL, 'pill'],
        ] as const).map(([id, label, skin, shape]): LayoutNode => ({
          type: 'Button', id,
          props: { label, skin, ...(shape ? { shape } : {}), action: 'click', actionArg: id },
          layout: { width: 150, height: 60 },
        })) },
      { type: 'Label', id: 't-skin-vendored', props: { text: '↓ 卡通风格按钮 · vendored 自 Kenney UI Pack（CC0）· scripts/vendor-asset.mjs 从共享货架搬进本地库 · 带 vendoredFrom 溯源', size: 'sm', color: 'sub' } },
      { type: 'Panel', id: 'skin-kenney-row', props: {}, layout: { direction: 'grid', cols: 5, gap: 14, padding: 18 },
        children: ([
          ['sk-k-blue', '蓝', BTN_BLUE_URL], ['sk-k-green', '绿', BTN_GREEN_URL], ['sk-k-red', '红', BTN_RED_URL],
          ['sk-k-yellow', '黄', BTN_YELLOW_URL], ['sk-k-grey', '灰', BTN_GREY_URL],
        ] as const).map(([id, label, skin]): LayoutNode => ({
          type: 'Button', id, props: { label, skin, action: 'click', actionArg: id },
          layout: { width: 140, height: 44 }, // 贴合 Kenney 190×48 原始比例
        })) },
      { type: 'Label', id: 't-skin-styles', props: { text: '同包不同款式（弱 LLM 换 skin key 即换风格·数据不改结构）：圆润 / 高光 / 描边幽灵', size: 'xs', color: 'dim' } },
      { type: 'Panel', id: 'skin-style-row', props: {}, layout: { direction: 'grid', cols: 3, gap: 14, padding: 18 },
        children: ([
          ['sk-s-round', '圆润 round', BTN_ROUND_URL], ['sk-s-glossy', '高光 glossy', BTN_GLOSSY_URL], ['sk-s-ghost', '描边 ghost', BTN_GHOST_URL],
        ] as const).map(([id, label, skin]): LayoutNode => ({
          type: 'Button', id, props: { label, skin, action: 'click', actionArg: id },
          layout: { width: 150, height: 46 },
        })) },
      { type: 'Label', id: 't-skin-card', props: { text: '贴图=一张卡的按钮（skin 直接贴一张卡牌图·牌面即按钮·卡牌比例·fluentui 卡牌·MIT）', size: 'xs', color: 'dim' } },
      { type: 'Panel', id: 'skin-card-row', props: { bare: true }, layout: { direction: 'row', gap: 16, padding: 18, align: 'center' },
        children: [
          { type: 'Button', id: 'sk-card-joker', props: { label: '', skin: CARD_JOKER_URL, action: 'click', actionArg: 'card-joker' }, layout: { width: 120, height: 168 } },
          { type: 'Button', id: 'sk-card-flower', props: { label: '', skin: CARD_FLOWER_URL, action: 'click', actionArg: 'card-flower' }, layout: { width: 120, height: 168 } },
          { type: 'Button', id: 'sk-card-play', props: { label: '出 王牌', skin: CARD_JOKER_URL, action: 'click', actionArg: 'card-play' }, layout: { width: 120, height: 168 } },
        ] },
      { type: 'Label', id: 't-skin-9slice', props: { text: '9-slice 无损缩放（skinSlice=源边距 px）：cover 拉大糊角（左）vs 九宫格四角始终清晰（右）——商业 UI 皮标配', size: 'xs', color: 'dim' } },
      { type: 'Panel', id: 'skin-9slice-row', props: { bare: true }, layout: { direction: 'row', gap: 24, padding: 18, align: 'center' },
        children: [
          { type: 'Button', id: 'sk-9-cover', props: { label: 'cover 糊角', skin: BTN_BLUE_URL, action: 'click', actionArg: '9-cover' }, layout: { width: 180, height: 110 } },
          { type: 'Button', id: 'sk-9-slice', props: { label: '9-slice 清晰', skin: BTN_GREEN_URL, skinSlice: 9, action: 'click', actionArg: '9-slice' }, layout: { width: 180, height: 110 } },
          { type: 'Button', id: 'sk-9-big', props: { label: '任意尺寸不变形', skin: BTN_GREEN_URL, skinSlice: 9, action: 'click', actionArg: '9-big' }, layout: { width: 240, height: 72 } },
        ] },

      { type: 'Label', id: 't-skin-alpha', props: { text: '带透明色的贴图（透明处 see-through）：默认框面=不透明底吃掉透明（左·间隙显面色）vs bg:"transparent" 令牌=透明底保边框透见身后（右·间隙透见彩底）。贴图按钮/Image 本就透明·框面加此令牌即可。', size: 'xs', color: 'dim' } },
      // 彩色底衬（custom 渐变）→ 上面两块框面各铺同一张「金片+透明间隙」贴图：左默认底吃掉透明、右 transparent 令牌透见彩底。
      { type: 'Panel', id: 'skin-alpha-wrap', props: { bg: { custom: 'linear-gradient(120deg,#22d3ee,#7c3aed 55%,#ec4899)' } }, layout: { direction: 'row', gap: 22, padding: 20, align: 'center' },
        children: [
          { type: 'Panel', id: 'alpha-opaque', props: { title: '默认底(吃透明)', bgTexture: ALPHA_TILE_URI, bgTextureSize: 34 }, layout: { width: 190, height: 120, padding: 10 }, children: [] },
          { type: 'Panel', id: 'alpha-see', props: { title: 'bg:transparent(透见)', bg: 'transparent', bgTexture: ALPHA_TILE_URI, bgTextureSize: 34 }, layout: { width: 190, height: 120, padding: 10 }, children: [] },
          { type: 'Button', id: 'alpha-skinbtn', props: { label: '皮·透明角', skin: BTN_ROUND_URL, action: 'click', actionArg: 'alpha-skin' }, layout: { width: 120, height: 120 } },
        ] },

      divider('d-3d'),
      sectionTitle('t-3d-ptr', 'LAYOUT · 3D UI 表达 → 已独立成「🧊 3D UI」子 tab（透视倾斜 / 景深叠层 / 3D 旋转木马 / 真 3D 翻面卡 / tilt3d 悬停抬起）'),
      { type: 'Panel', id: '3d-ptr', props: { bg: 'sunken' }, layout: { direction: 'row', gap: 10, padding: 14, align: 'center' },
        children: [
          { type: 'Badge', id: '3d-ptr-b', props: { text: '🧊 3D UI', tone: 'accent' } },
          { type: 'Label', id: '3d-ptr-l', props: { text: 'CSS-3D 通用化的 3D UI 控件已聚到上方「🧊 3D UI」标签页——点过去看完整一组。', color: 'sub', size: 'sm' } },
        ] },

      divider('d-cartoon'),
      sectionTitle('t-cartoon', 'IMAGE · 卡通美术画廊（vendored 自 undraw·MIT·内容丰富的彩色卡通场景插画·按资产 key 解析喂 Image）'),
      { type: 'Panel', id: 'cartoon-row', props: {}, layout: { direction: 'grid', cols: 3, gap: 12, padding: 16 },
        children: ([
          [CARTOON_ASTRO, '宇航员'], [CARTOON_CAT, '顽皮猫'], [CARTOON_DOG, '遛狗'],
          [CARTOON_CAMP, '露营'], [CARTOON_GAME, '游戏手柄'], [CARTOON_MUSIC, '听歌起舞'],
          [CARTOON_BDAY, '生日气球'], [CARTOON_ROBOT, '机器人'], [CARTOON_TRAVEL, '邮轮旅行'],
        ] as const).map(([url, label]): LayoutNode => ({
          type: 'Panel', id: `ct-${label}`, props: { bg: 'sunken' }, layout: { direction: 'column', gap: 4, padding: 8, align: 'center' },
          children: [
            { type: 'Image', id: `ct-img-${label}`, props: { src: url, alt: label, fit: 'contain', radius: 8 }, layout: { width: 200, height: 128 } },
            { type: 'Label', id: `ct-lbl-${label}`, props: { text: label, size: 'xs', color: 'sub' } },
          ],
        })) },

      divider('d-fill'),
      sectionTitle('t-fill-preset', 'PANEL.bg · 预设配色（FillPreset·8 组主动配色·引擎内建·固定观感·owner 2026-07-04 拍板）'),
      { type: 'Panel', id: 'fill-preset-row', props: {}, layout: { direction: 'grid', cols: 4, gap: 12, padding: 16 },
        children: ([
          ['jade-sheen', '青玉'], ['gold-sheen', '金铜'], ['ink-deep', '深墨'], ['steel', '冷钢'],
          ['blood', '暗红'], ['frost', '冰蓝'], ['ember', '橙炭'], ['void', '幽紫'],
        ] as const).map(([preset, label]): LayoutNode => ({
          type: 'Panel', id: `fp-${preset}`, props: { bg: preset }, layout: { height: 56, padding: 12, align: 'center', justify: 'center' },
          children: [{ type: 'Label', id: `fp-${preset}-l`, props: { text: `${label} · ${preset}`, size: 'sm', bold: true, color: 'text' } }],
        })) },
      sectionTitle('t-fill-token', 'PANEL.bg · 语义令牌（SurfaceToken·映射主题·换皮自适应）＋ {custom} 显式逃生'),
      { type: 'Panel', id: 'fill-token-row', props: {}, layout: { direction: 'grid', cols: 5, gap: 12, padding: 16 },
        children: ([
          ['panel', '面'], ['raised', '凸起'], ['sunken', '凹陷'], ['jade', '青玉washed'], ['gold', '金'],
        ] as const).map(([tok, label]): LayoutNode => ({
          type: 'Panel', id: `ft-${tok}`, props: { bg: tok }, layout: { height: 48, padding: 10, align: 'center', justify: 'center' },
          children: [{ type: 'Label', id: `ft-${tok}-l`, props: { text: `${label}·${tok}`, size: 'xs', color: 'sub' } }],
        })).concat([{
          type: 'Panel', id: 'ft-custom', props: { bg: { custom: 'repeating-linear-gradient(45deg,#3a2a5a 0 8px,#2a1a4a 8px 16px)' } },
          layout: { height: 48, padding: 10, align: 'center', justify: 'center' },
          children: [{ type: 'Label', id: 'ft-custom-l', props: { text: '{custom}·特别指定', size: 'xs', color: 'text' } }],
        }]) },

      divider('d-n10'),
      sectionTitle('t-grid', 'PANEL · cols 固定列数 grid + justify 主轴分布'),
      { type: 'Panel', id: 'grid-cols', props: { title: 'grid · cols:4（严格 4 列等分·消空隙）' }, layout: { direction: 'grid', cols: 4, gap: 8, padding: 14 },
        children: [1, 2, 3, 4, 5, 6, 7, 8].map((n): LayoutNode => ({ type: 'Badge', id: `gc-${n}`, props: { text: `格 ${n}`, tone: 'dim' } })) },
      { type: 'Panel', id: 'just-row', props: { title: 'flex row · justify:between（两端对齐均分）' }, layout: { direction: 'row', justify: 'between', padding: 14 },
        children: [
          { type: 'Badge', id: 'jr-1', props: { text: '左', tone: 'ok' } },
          { type: 'Badge', id: 'jr-2', props: { text: '中', tone: 'warn' } },
          { type: 'Badge', id: 'jr-3', props: { text: '右', tone: 'dim' } },
        ] },
      { type: 'Panel', id: 'fluid-grid', props: { title: 'cols:5 + PlayingCard.fluid（卡填满格·5:7 比例·零卡间空隙）' }, layout: { direction: 'grid', cols: 5, gap: 6, padding: 14 },
        children: ([['A', '♠'], ['K', '♥'], ['Q', '♦'], ['J', '♣'], ['10', '♠']] as const).map(([r, s], i): LayoutNode =>
          ({ type: 'PlayingCard', id: `fl-${i}`, props: { rank: r, suit: s, fluid: true } })) },

      divider('d-n11'),
      sectionTitle('t-flip', 'PLAYINGCARD · flipOnHover 悬停翻面（鼠标悬停露背面信息子树）'),
      { type: 'Panel', id: 'flip-row', props: {}, layout: { direction: 'row', padding: 14, align: 'center' },
        children: [
          { type: 'PlayingCard', id: 'flip-1', props: {
            rank: 'A', suit: '♠', label: '赵子龙', size: 'lg', flipOnHover: true,
            backFace: { type: 'Panel', id: 'flip-back', props: { bare: true }, layout: { direction: 'column', gap: 4 },
              children: [
                { type: 'Label', id: 'fb-1', props: { text: '赵子龙', color: 'jade', bold: true, size: 'sm' } },
                { type: 'Label', id: 'fb-2', props: { text: '蜀 · 五虎上将', color: 'sub', size: 'xs' } },
                { type: 'Label', id: 'fb-3', props: { text: '长坂坡七进七出。', color: 'dim', size: 'xs' } },
              ] },
          } },
          { type: 'Label', id: 'flip-hint', props: { text: '← 鼠标悬停这张牌看它翻面（front→back scaleX 翻转·CSS 内建）。', color: 'dim', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-n12'),
      sectionTitle('t-bigtext', 'LABEL · 大标题档 size:xxl(28) / xxxl(34)（原版 felt 标题 34px）'),
      { type: 'Panel', id: 'big-col', props: {}, layout: { direction: 'column', gap: 8, padding: 14 },
        children: [
          { type: 'Label', id: 'big-xxl', props: { text: '群英荟萃 · xxl 28px', size: 'xxl', bold: true, color: 'gold' } },
          { type: 'Label', id: 'big-xxxl', props: { text: '三 国 杀 · xxxl 34px', size: 'xxxl', bold: true, color: 'jade', font: 'display' } },
          { type: 'Label', id: 'big-cmp', props: { text: '对比：xl 22px 副标题（旧上限）', size: 'xl', color: 'sub' } },
        ] },

      sectionTitle('t-multiline', 'LABEL · 多行文本（text 含 \\n → white-space:pre-line 真换行·手册/多段说明用）'),
      { type: 'Panel', id: 'ml-col', props: {}, layout: { direction: 'column', gap: 8, padding: 14 },
        children: [
          { type: 'Label', id: 'ml-1', props: {
            text: '第一行：一份 Label 用 \\n 直接排多行。\n第二行：不再被迫拆成 N 个 Label 堆容器。\n第三行：帮助手册/物品说明/对话段落，一个字段搞定。',
            color: 'sub', size: 'sm' } },
        ] },

      divider('d-n13'),
      sectionTitle('t-pattern', 'PANEL · pattern 程序化纹理叠层（stripe 斜纹 / checker 棋盘·felt 牌桌质感）'),
      { type: 'Panel', id: 'pat-row', props: {}, layout: { direction: 'row', gap: 14, padding: 14 },
        children: [
          { type: 'Panel', id: 'pat-stripe', props: { title: 'stripe 45°斜纹', bg: { custom: 'linear-gradient(180deg,#16402c,#0e2a1c)' }, pattern: 'stripe' },
            layout: { direction: 'column', padding: 16, height: 76, flex: 1 },
            children: [{ type: 'Label', id: 'pat-sl', props: { text: '绿呢底叠斜条纹（纯 CSS·零贴图）。', color: 'sub', size: 'sm' } }] },
          { type: 'Panel', id: 'pat-checker', props: { title: 'checker 棋盘格', bg: { custom: 'linear-gradient(180deg,#2a1c40,#16102a)' }, pattern: 'checker' },
            layout: { direction: 'column', padding: 16, height: 76, flex: 1 },
            children: [{ type: 'Label', id: 'pat-cl', props: { text: '紫底叠棋盘格纹理。', color: 'sub', size: 'sm' } }] },
        ] },

      divider('d-n14'),
      sectionTitle('t-backpat', 'PLAYINGCARD · backPattern 牌背纹理（原版红牌背棋盘格/斜纹）'),
      { type: 'Panel', id: 'backpat-row', props: {}, layout: { direction: 'row', gap: 12, padding: 14, align: 'center' },
        children: [
          pcard('bp-1', { rank: 'A', suit: '♠', faceUp: false, backPattern: 'checker', size: 'md' }),
          pcard('bp-2', { rank: 'K', suit: '♥', faceUp: false, backPattern: 'stripe', size: 'md' }),
          pcard('bp-3', { rank: 'Q', suit: '♦', faceUp: false, size: 'md' }),
          { type: 'Label', id: 'bp-hint', props: { text: '← checker / stripe / 无纹理 三张牌背对比（faceUp:false 时叠）。', color: 'dim', size: 'sm' }, layout: { flex: 1 } },
        ] },

      divider('d-n15'),
      sectionTitle('t-sheen', 'SHEEN · 流光扫过（layout.sheen·斜向湿润反光循环·原 hero 内建通用化）'),
      { type: 'Panel', id: 'sheen-row', props: {}, layout: { direction: 'row', gap: 16, padding: 18, align: 'center' },
        children: [
          { type: 'Button', id: 'sheen-btn', props: { label: '流光按钮', kind: 'primary', action: 'click', actionArg: 'sheen' }, layout: { sheen: true } },
          { type: 'Panel', id: 'sheen-card', props: { bg: { custom: 'linear-gradient(180deg,#1c2a44,#101826)' } }, layout: { sheen: true, chamfer: 12, padding: 16 },
            children: [{ type: 'Label', id: 'sheen-cl', props: { text: 'sheen 切角卡：一道流光斜扫而过。', color: 'sub', size: 'sm' } }] },
        ] },

      divider('d-n16'),
      sectionTitle('t-pixel', 'LABEL · font:pixel 像素字体（REQ-UI-fontPixel令牌·已落地·不再静默回退）'),
      { type: 'Panel', id: 'pixel-col', props: {}, layout: { direction: 'column', gap: 8, padding: 14 },
        children: [
          { type: 'Label', id: 'pixel-l', props: { text: 'PIXEL 8-BIT 像素标题 1942', size: 'lg', bold: true, color: 'jade', font: 'pixel' } },
          { type: 'Label', id: 'pixel-l2', props: { text: 'font:pixel · 复古街机/像素风（SHELL fontPixel 令牌已补默认值）', size: 'sm', color: 'sub', font: 'pixel' } },
        ] },

      divider('d-fontwall'),
      sectionTitle('t-artfont', 'LABEL · 艺术字体墙（内嵌 Google Fonts·OFL 开源·18 款闭集艺术字·真渲染不回退）'),
      { type: 'Label', id: 'artfont-note', props: {
        text: '之前 font 槽只是字体名栈、靠系统装字（多数机器回退成单调系统字）。现在 18 款艺术字 woff2 已 base64 内嵌 @font-face——真渲染、离线自带。中文/缺字自动回退主字体。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'artfont-wall', props: {}, layout: { direction: 'column', gap: 6, padding: 16 },
        children: ([
          ['impact', 'IMPACT · Bebas Neue 冲击标题', 'gold'],
          ['heavy', 'HEAVY · Anton 厚重海报字', 'text'],
          ['epic', 'EPIC · Cinzel 史诗罗马衬线', 'gold'],
          ['fantasy', 'FANTASY · MedievalSharp 奇幻 RPG', 'jade'],
          ['elegant', 'Elegant · Playfair Display 优雅高衬线', 'text'],
          ['script', 'Script · Pacifico 花体手写', 'jade'],
          ['hand', 'Hand · Caveat 随性手写便签', 'sub'],
          ['scifi', 'SCIFI · Orbitron 科幻界面 2026', 'ok'],
          ['terminal', 'TERMINAL · VT323 复古终端 > run', 'ok'],
          ['comic', 'COMIC · Bangers 漫画拟声 BOOM!', 'warn'],
          ['stencil', 'STENCIL · Black Ops One 军械镂空', 'text'],
          ['western', 'WESTERN · Rye 西部通缉令', 'gold'],
          ['retro', 'RETRO · Monoton 复古霓虹', 'jade'],
          ['marker', 'Marker · Permanent Marker 记号笔涂鸦', 'danger'],
          ['bubbly', 'BUBBLY · Baloo 2 圆润可爱', 'ok'],
          ['gothic', 'Gothic · Pirata One 哥特海盗', 'text'],
          ['fashion', 'Fashion · Abril Fatface 时尚粗衬', 'gold'],
          ['shadow', 'SHADOW · Bungee Shade 立体投影', 'jade'],
        ] as const).map(([f, txt, color]): LayoutNode => ({
          // 每款字一行：左=子编号（普通字·好读）+ 右=艺术字样张。owner 可按号跟美术点名换某款字。
          type: 'Panel', id: `afr-${f}`, props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 12 },
          children: [
            { type: 'Label', id: `afn-${f}`, props: { text: `#${nextSubNo()}`, size: 'sm', color: 'gold', bold: true }, layout: { width: 52 } },
            { type: 'Label', id: `af-${f}`, props: { text: txt, size: 'xl', font: f, color } },
          ],
        })) },

      divider('d-cjkfont'),
      sectionTitle('t-cjkfont', 'LABEL · CJK 艺术字（内嵌 SIL OFL 中/日字·**能渲汉字/假名**·url 惰性载·owner 2026-07-23）'),
      { type: 'Label', id: 'cjkfont-note', props: {
        text: '前 18 款艺术字皆拉丁字形（贴 CJK 自动回退主字体）。这 5 款是真 CJK 字体，能把「雀宴」这类汉字/假名渲成毛笔/文艺/楷体/卡通粗圆黑。woff2 子集化（只留 src 用到的字 + 全假名）·浏览器按需惰性下载（只在真用时拉那一个）。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'cjkfont-wall', props: {}, layout: { direction: 'column', gap: 8, padding: 16 },
        children: ([
          ['cnbrush', '雀宴 · 中文毛笔行楷 · 東南西北發財', 'gold'],
          ['cnwen', '雀宴 · 中文文艺细宋 · 立直門前清', 'text'],
          ['cnround', '雀宴 · 中文卡通粗圆黑 · 欢迎来到雨夜书斋', 'danger'],
          ['jpbrush', '雀宴 · 日文毛筆明朝 · リーチ一発ツモ', 'jade'],
          ['jppen', '雀宴 · 日文楷書ペン · 麻雀あがり', 'ok'],
        ] as const).map(([f, txt, color]): LayoutNode => ({
          type: 'Panel', id: `cjkr-${f}`, props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 12 },
          children: [
            { type: 'Label', id: `cjkn-${f}`, props: { text: `#${nextSubNo()}`, size: 'sm', color: 'gold', bold: true }, layout: { width: 52 } },
            { type: 'Label', id: `cjk-${f}`, props: { text: txt, size: 'xl', font: f, color } },
          ],
        })) },

      divider('d-roundfont'),
      sectionTitle('t-roundfont', 'LABEL · font:round · 圆润数字艺术字 Fredoka（REQ-108-UI-06·可变字重 300–700·url 惰性载·配 cnround 成卡通底色）'),
      { type: 'Label', id: 'roundfont-note', props: {
        text: '拉丁圆润里 bubbly(Baloo 2) 之外补 round(Fredoka)：数字骨架不同（4/7 尤其），大字号（伤害大数）下更贴卡通稿。可变字体一颗 woff2 覆 300–700 全字重·bold→700·url 惰性载（主 bundle 零增·非 base64 常驻）。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'roundfont-wall', props: {}, layout: { direction: 'column', gap: 10, padding: 16 },
        children: [
          { type: 'Panel', id: 'rf-big', props: { bare: true }, layout: { direction: 'row', align: 'end', gap: 20 },
            children: [
              { type: 'Label', id: 'rf-dmg', props: { text: '140', size: 'xxxl', bold: true, font: 'round', color: 'gold' } },
              { type: 'Label', id: 'rf-hp', props: { text: '血量 100 · 3/3 · ⏱ 09', size: 'xl', bold: true, font: 'round', color: 'text' } },
            ] },
          { type: 'Panel', id: 'rf-cmp', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 24 },
            children: [
              { type: 'Label', id: 'rf-a', props: { text: 'round(Fredoka) 0123456789', size: 'lg', bold: true, font: 'round', color: 'jade' } },
              { type: 'Label', id: 'rf-b', props: { text: 'bubbly(Baloo 2) 0123456789', size: 'lg', bold: true, font: 'bubbly', color: 'sub' } },
            ] },
        ] },

      divider('d-n17'),
      sectionTitle('t-fx', 'FX · UI 特效库（库 A·layout.fx 闭集合集·可叠加·render-only CSS·一个字段一串特效）'),
      { type: 'Label', id: 'fx-note', props: {
        text: '特效架构「库 A」：UI 元素的自我动画。layout.fx:[{kind,color,ms,intensity,once}] —— 闭集 7 个 kind，绝不每效一个布尔开关。与「库 B·战场粒子特效」正交（见展台 💥 战场特效模块）。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'fx-kinds', props: { title: '7 个 kind 各来一发（循环态·状态特效）' }, layout: { direction: 'row', gap: 14, align: 'center', padding: 18 },
        children: [
          { type: 'Badge', id: 'fx-pulse', props: { text: 'pulse 呼吸', tone: 'ok' }, layout: { fx: [{ kind: 'pulse' }] } },
          { type: 'Badge', id: 'fx-float', props: { text: 'float 浮动', tone: 'ok' }, layout: { fx: [{ kind: 'float' }] } },
          { type: 'Badge', id: 'fx-shake', props: { text: 'shake 抖动', tone: 'warn' }, layout: { fx: [{ kind: 'shake', intensity: 1.4 }] } },
          { type: 'Badge', id: 'fx-pop', props: { text: 'pop 弹', tone: 'accent' }, layout: { fx: [{ kind: 'pop' }] } },
          { type: 'Badge', id: 'fx-glow', props: { text: 'glow 发光', tone: 'warn' }, layout: { fx: [{ kind: 'glow', color: 'gold' }] } },
          { type: 'Badge', id: 'fx-sheen', props: { text: 'sheen 流光', tone: 'dim' }, layout: { fx: [{ kind: 'sheen' }] } },
          { type: 'Badge', id: 'fx-flash', props: { text: 'flash 闪色', tone: 'danger' }, layout: { fx: [{ kind: 'flash', color: 'danger' }] } },
        ] },
      { type: 'Panel', id: 'fx-stack', props: { title: '叠加（一个字段挂多效·战斗反馈）' }, layout: { direction: 'row', gap: 20, align: 'center', padding: 18 },
        children: [
          { type: 'PlayingCard', id: 'fx-hit', props: { rank: 'K', suit: '♥', label: '受击', size: 'md' },
            layout: { fx: [{ kind: 'shake', intensity: 1.6 }, { kind: 'flash', color: 'danger' }] } },
          { type: 'Label', id: 'fx-hit-l', props: { text: 'fx:[shake + flash danger] —— 受击：抖 + 冒红，同字段两效叠加。', color: 'sub', size: 'sm' } },
          { type: 'PlayingCard', id: 'fx-buff', props: { rank: 'A', suit: '♠', label: 'BUFF', size: 'md' },
            layout: { fx: [{ kind: 'glow', color: 'gold' }, { kind: 'pulse' }] } },
          { type: 'Label', id: 'fx-buff-l', props: { text: 'fx:[glow gold + pulse] —— 增益：金光 + 呼吸，transform 与 filter 正交叠。', color: 'sub', size: 'sm' } },
        ] },
    ],
  };
}
