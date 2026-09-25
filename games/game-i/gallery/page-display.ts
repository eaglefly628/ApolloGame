// Game I 展示台 · 页 2 · 数据展示
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { DEMO_IMG, sectionTitle, divider } from './shared.js';
import { buildItemSlot, buildStatTile } from '@zerocraft/engine/ui/starters/index.js';
// ── 页 2 · 数据展示 ──────────────────────────────────────────
// 11 语义色令牌全档（与 LabelProps.color 闭集对齐·mine/foe=阵营·ink=深墨压金底）。
const labelColors: Array<'text' | 'sub' | 'dim' | 'jade' | 'gold' | 'ok' | 'warn' | 'danger' | 'mine' | 'foe' | 'ink'> =
  ['text', 'sub', 'dim', 'jade', 'gold', 'ok', 'warn', 'danger', 'mine', 'foe', 'ink'];

// 7 具名字号档全档（xs10…xxxl34）；另可填裸 px 任意字号（复刻像素稿用）。
const labelSizes: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'> = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'];

export function pageDisplay(): LayoutNode { return {
  type: 'Panel',
  id: 'page-display',
  props: { scroll: true },
  layout: { direction: 'column', gap: 18, padding: 20 },
  children: [
    sectionTitle('t-lbl-size', 'LABEL · 字号（7 具名档 xs10…xxxl34 + 裸 px 任意档）'),
    {
      type: 'Panel',
      id: 'demo-lbl-size',
      props: {},
      layout: { direction: 'row', gap: 14, align: 'end', padding: 10 },
      children: labelSizes.map((s): LayoutNode => ({
        type: 'Label', id: `lbl-size-${s}`, props: { text: s.toUpperCase(), size: s, bold: true },
      })),
    },
    // 裸 px：复刻像素稿/设计稿精确字号时用（具名档保和谐、裸 px 保精确）。
    {
      type: 'Panel', id: 'demo-lbl-px', props: { bare: true },
      layout: { direction: 'row', gap: 16, align: 'end', padding: 10 },
      children: [
        ...[9, 15, 26, 44].map((n): LayoutNode => ({
          type: 'Label', id: `lbl-px-${n}`, props: { text: `${n}px`, size: n, bold: true, color: 'jade' },
        })),
        { type: 'Label', id: 'lbl-px-hint', props: { text: '← size 填数字=裸 px（复刻稿子精确字号）；填令牌=7 具名档（保排版和谐）', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
      ],
    },
    // 用法模式：同一件 Label 在真实屏上的四种典型角色（层级靠字号+色+粗细拉开·别全用一档）。
    { type: 'Label', id: 'lbl-usage-note', props: { text: '典型用法：标题 / 正文 / 副文 / 爆数字——层级靠「字号 + 色 + bold」三者一起拉开', color: 'sub', size: 'sm' } },
    {
      type: 'Panel', id: 'demo-lbl-usage', props: { bg: 'sunken' },
      layout: { direction: 'column', gap: 4, padding: 14, radius: 10 },
      children: [
        { type: 'Label', id: 'lu-title', props: { text: '第 12 关 · 雨夜书斋', size: 'xl', bold: true, color: 'gold' } },
        { type: 'Label', id: 'lu-body', props: { text: '收集三枚印章即可通关。', size: 'md', color: 'text' } },
        { type: 'Label', id: 'lu-sub', props: { text: '提示：印章藏在书架后', size: 'sm', color: 'sub' } },
        { type: 'Label', id: 'lu-dmg', props: { text: '-240', size: 'xxl', bold: true, color: 'danger', stroke: true } },
      ],
    },
    sectionTitle('t-lbl-color', 'LABEL · 11 语义色令牌（换皮自适应）+ {custom} 自由色逃生'),
    {
      type: 'Panel',
      id: 'demo-lbl-color',
      props: {},
      layout: { direction: 'row', gap: 14, padding: 10 },
      children: [
        // ink 不进这一排：它是**深墨**令牌，专给金/浅底上的深色字（压在暗底上必然读不清）——单独演在金底上。
        ...labelColors.filter((c) => c !== 'ink').map((c): LayoutNode => ({
          type: 'Label', id: `lbl-color-${c}`, props: { text: c, color: c, bold: true },
        })),
        { type: 'Label', id: 'lbl-mono', props: { text: 'mono 0123', mono: true, color: 'sub' } },
      ],
    },
    // ink 令牌的正确用法：坐在金/浅底上当深色字（放暗底=自造低对比·ui-audit 会当场抓）。
    {
      type: 'Panel', id: 'demo-lbl-ink', props: { bare: true },
      layout: { direction: 'row', gap: 12, align: 'center', padding: 10 },
      children: [
        {
          type: 'Panel', id: 'lbl-ink-chip', props: { bg: 'gold' },
          layout: { padding: 8, radius: 8, align: 'center' },
          children: [{ type: 'Label', id: 'lbl-color-ink', props: { text: 'ink 深墨字', color: 'ink', bold: true } }],
        },
        { type: 'Label', id: 'lbl-ink-hint', props: { text: '← ink = 金底/浅底上的深色字（如金 CTA 的键面字）。压暗底会读不清——色要配底选，不是随便挑。', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
      ],
    },
    // 语义色 = 换皮自适应（换主题自动跟着变）；{custom} = 特别指定才用（花色/稿子精确墨色·仍非裸串）。
    {
      type: 'Panel', id: 'demo-lbl-custom', props: { bare: true },
      layout: { direction: 'row', gap: 18, align: 'center', padding: 10 },
      children: [
        { type: 'Label', id: 'lc-suit', props: { spans: [{ text: '♠13 ', color: { custom: '#8a94a6' } }, { text: '♥13 ', color: { custom: '#d8483f' } }, { text: '♦13 ', color: { custom: '#d3a03a' } }, { text: '♣13', color: { custom: '#3f9a5a' } }], size: 'xl', bold: true } },
        { type: 'Label', id: 'lc-hint', props: { text: '← 四花色=令牌装不下的用色，走 {custom} 逃生（audit 会提示优先迁令牌）', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
      ],
    },
    // 常见语义配对：别自己发明配色，按「状态→令牌」照抄。
    {
      type: 'Panel', id: 'demo-lbl-semantic', props: { bg: 'sunken' },
      layout: { direction: 'row', gap: 18, padding: 14, radius: 10 },
      children: [
        { type: 'Label', id: 'ls-buff', props: { text: '+12 攻击', color: 'ok', bold: true } },
        { type: 'Label', id: 'ls-debuff', props: { text: '-8 防御', color: 'danger', bold: true } },
        { type: 'Label', id: 'ls-coin', props: { text: '1280 金币', color: 'gold', bold: true } },
        { type: 'Label', id: 'ls-lock', props: { text: '未解锁', color: 'dim' } },
        { type: 'Label', id: 'ls-mine', props: { text: '我方', color: 'mine', bold: true } },
        { type: 'Label', id: 'ls-foe', props: { text: '敌方', color: 'foe', bold: true } },
      ],
    },
    divider('d-d1'),
    sectionTitle('t-badge', 'BADGE · 6 语义色 + icon 图标槽（角标/状态/红点/数量）'),
    {
      type: 'Panel',
      id: 'demo-badge',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 10, align: 'center' },
      children: [
        { type: 'Badge', id: 'bdg-ok', props: { text: '在线', tone: 'ok' } },
        { type: 'Badge', id: 'bdg-warn', props: { text: '警示', tone: 'warn' } },
        { type: 'Badge', id: 'bdg-dim', props: { text: '离线', tone: 'dim' } },
        { type: 'Badge', id: 'bdg-accent', props: { text: '新', tone: 'accent' } },
        { type: 'Badge', id: 'bdg-gold', props: { text: '限定', tone: 'gold' } },
        { type: 'Badge', id: 'bdg-danger', props: { text: '危', tone: 'danger' } },
        { type: 'Badge', id: 'bdg-icon', props: { text: '冠军', tone: 'ok', icon: DEMO_IMG } }, // icon 槽（补齐 Tag/Button 一致性·2026-08 查缺补漏）
      ],
    },
    divider('d-d2'),
    sectionTitle('t-image', 'IMAGE · 图片（内联 data-URI · fit 三态 + 圆角 radius）'),
    {
      type: 'Panel',
      id: 'demo-image',
      props: {},
      layout: { direction: 'row', gap: 12, padding: 10 },
      children: [
        { type: 'Image', id: 'img-cover', props: { src: DEMO_IMG, alt: 'cover', fit: 'cover' }, layout: { width: 110, height: 70 } },
        { type: 'Image', id: 'img-contain', props: { src: DEMO_IMG, alt: 'contain', fit: 'contain' }, layout: { width: 110, height: 70 } },
        { type: 'Image', id: 'img-fill', props: { src: DEMO_IMG, alt: 'fill', fit: 'fill' }, layout: { width: 110, height: 70 } },
        { type: 'Image', id: 'img-radius', props: { src: DEMO_IMG, alt: 'radius 12', fit: 'cover', radius: 12 }, layout: { width: 110, height: 70 } },
      ],
    },
    divider('d-d3'),
    sectionTitle('t-progress', 'PROGRESSBAR · 线性条 5 语义色（环形 ring / 液面 liquid 见 🧊 3D UI 页）'),
    {
      type: 'Panel',
      id: 'demo-progress',
      props: {},
      layout: { direction: 'column', gap: 10, padding: 10 },
      children: [
        // ⚠ max 必填对：不给 max 时缺省 max=1，value:72 会被夹成满格（这段旧版就踩过）。
        { type: 'ProgressBar', id: 'pb-accent', props: { value: 72, max: 100, label: '加载进度', showValue: true, tone: 'accent' } },
        { type: 'ProgressBar', id: 'pb-ok', props: { value: 100, max: 100, label: '已完成', showValue: true, tone: 'ok' } },
        { type: 'ProgressBar', id: 'pb-warn', props: { value: 45, max: 100, label: '体力', tone: 'warn' } },
        { type: 'ProgressBar', id: 'pb-danger', props: { value: 12, max: 100, label: '血量', showValue: true, tone: 'danger' } },
      ],
    },
    // 典型 HUD 四条：同一件换 tone/max 即成血/蓝/经验/护盾——别为每种条各搓一个件。
    { type: 'Label', id: 'pb-usage-note', props: { text: '典型用法：血/蓝/经验/护盾 = 同一件换 tone + max（换皮自适应）。绑世界资源见下方 t-bind 段。', color: 'sub', size: 'sm' } },
    {
      type: 'Panel', id: 'demo-progress-hud', props: { bg: 'sunken' },
      layout: { direction: 'column', gap: 8, padding: 14, radius: 10 },
      children: [
        { type: 'ProgressBar', id: 'pbh-hp', props: { value: 340, max: 520, label: '生命', showValue: true, tone: 'danger' } },
        { type: 'ProgressBar', id: 'pbh-mp', props: { value: 88, max: 120, label: '法力', showValue: true, tone: 'accent' } },
        { type: 'ProgressBar', id: 'pbh-xp', props: { value: 7300, max: 10000, label: '经验', showValue: true, tone: 'gold' } },
        { type: 'ProgressBar', id: 'pbh-sh', props: { value: 60, max: 100, label: '护盾', showValue: true, tone: 'ok' } },
      ],
    },
    divider('d-d4'),
    sectionTitle('t-tag', 'TAG · 标签 / 筛选 chip（可点 → 信号 pickTag·active/removable）'),
    {
      type: 'Panel',
      id: 'demo-tag',
      props: {},
      layout: { direction: 'row', gap: 8, align: 'center', padding: 10 },
      children: [
        { type: 'Tag', id: 'tag-all', props: { label: '全部', active: true, tone: 'accent', action: 'pickTag', actionArg: 'all' } },
        { type: 'Tag', id: 'tag-new', props: { label: '最新', action: 'pickTag', actionArg: 'new' } },
        { type: 'Tag', id: 'tag-hot', props: { label: '热门', action: 'pickTag', actionArg: 'hot' } },
        { type: 'Tag', id: 'tag-dim', props: { label: '已归档', tone: 'dim' } },
        { type: 'Tag', id: 'tag-rm', props: { label: '可移除', removable: true, action: 'pickTag', actionArg: 'remove' } },
      ],
    },
    sectionTitle('t-tagsize', 'TAG · size 缩放档（sm 紧凑筛选 / md 默认 / lg「大气药丸」货币计数·≈2x）'),
    {
      type: 'Panel', id: 'demo-tagsize', props: {},
      layout: { direction: 'row', gap: 12, align: 'center', padding: 10 },
      children: [
        { type: 'Tag', id: 'tg-sm', props: { label: '筛选·sm', size: 'sm', tone: 'dim' } },
        { type: 'Tag', id: 'tg-md', props: { label: '默认·md', size: 'md' } },
        { type: 'Tag', id: 'tg-lg1', props: { label: '💎 1280', size: 'lg', tone: 'accent' } },
        { type: 'Tag', id: 'tg-lg2', props: { label: '💰 99999', size: 'lg', tone: 'accent' } },
        { type: 'Label', id: 'tg-hint', props: { text: '← 同 Modal/PlayingCard.size 体系：闭集尺寸档，货币/稀有度药丸放大用 lg。', color: 'dim', size: 'sm' }, layout: { flex: 1 } },
      ],
    },
    divider('d-d5'),
    sectionTitle('t-avatar', 'AVATAR · 头像（图片/首字母占位·circle/rounded/square·多尺寸）'),
    {
      type: 'Panel',
      id: 'demo-avatar',
      props: {},
      layout: { direction: 'row', gap: 14, align: 'center', padding: 10 },
      children: [
        { type: 'Avatar', id: 'av-img', props: { src: DEMO_IMG, name: '图片头像', size: 48, shape: 'circle' } },
        { type: 'Avatar', id: 'av-circle', props: { name: '赵', size: 48, shape: 'circle' } },
        { type: 'Avatar', id: 'av-rounded', props: { name: '关', size: 48, shape: 'rounded' } },
        { type: 'Avatar', id: 'av-square', props: { name: '张', size: 48, shape: 'square' } },
        { type: 'Avatar', id: 'av-sm', props: { name: '马', size: 32, shape: 'circle' } },
        { type: 'Avatar', id: 'av-lg', props: { name: '黄', size: 64, shape: 'circle' } },
        // ring 环形进度描边（回合计时/蓄力·2026-08 查缺补漏）：conic 弧环绕头像到 value/max 比例。
        { type: 'Avatar', id: 'av-ring1', props: { name: '甲', size: 48, ring: { value: 0.72, tone: 'accent' } } },
        { type: 'Avatar', id: 'av-ring2', props: { src: DEMO_IMG, name: '计时', size: 48, ring: { value: 0.4, tone: 'warn' } } },
        { type: 'Avatar', id: 'av-ring3', props: { name: '满', size: 48, ring: { value: 1, tone: 'ok' } } },
      ],
    },
    divider('d-uifill'),
    sectionTitle('t-uifill', '★ 2D 查缺补漏（owner 2026-08）· Label 色 {custom} · fx:wobble · flyIn 方向 · ItemSlot / StatTile 组合助手'),
    { type: 'Label', id: 'uifill-note', props: {
      text: 'Label.color 三态（令牌 + {custom} 逃生·同 Panel.bg）：花色/精确墨色靠 {custom}·仍是闭集令牌优先。fx:wobble=循环 rotate+scale 摇摆（蓄势/摇拳）。flyIn 加 animFrom/animDist=可配方向大幅伸入。ItemSlot/StatTile=跨游戏反复手搓的簇→@ui/starters builder 去重（不加新控件）。', color: 'sub', size: 'sm' } },
    { type: 'Panel', id: 'uifill-color', props: { bare: true }, layout: { direction: 'row', gap: 16, align: 'center', padding: 8 },
      children: [
        { type: 'Label', id: 'uf-c1', props: { spans: [{ text: '♠13 ', color: { custom: '#8a94a6' } }, { text: '♥13 ', color: { custom: '#d8483f' } }, { text: '♦13 ', color: { custom: '#d3a03a' } }, { text: '♣13', color: { custom: '#3f9a5a' } }], size: 'xl', bold: true } },
        { type: 'Label', id: 'uf-c2', props: { text: 'Label.color {custom} 花色 4 色（令牌装不下→逃生·仍非裸串）', color: 'sub', size: 'sm' } },
      ] },
    { type: 'Panel', id: 'uifill-anim', props: { bare: true }, layout: { direction: 'row', gap: 26, align: 'center', padding: 12 },
      children: [
        { type: 'Label', id: 'uf-wob', props: { text: '✊ 摇拳', size: 'xl', bold: true, color: 'gold' }, layout: { fx: [{ kind: 'wobble', intensity: 1.2 }] } },
        { type: 'Label', id: 'uf-wob2', props: { text: '⚡ 蓄势', size: 'xl', bold: true, color: 'warn' }, layout: { fx: [{ kind: 'wobble' }] } },
        { type: 'Label', id: 'uf-fly', props: { text: '大幅右伸入 →', size: 'lg', bold: true, color: 'jade' }, layout: { anim: 'flyIn', animFrom: 'right', animDist: 120, animMs: 700 } },
        { type: 'Label', id: 'uf-flyhint', props: { text: 'fx:wobble（循环摇摆）· flyIn animFrom:right animDist:120（大幅伸入）', color: 'sub', size: 'sm' }, layout: { flex: 1 } },
      ] },
    { type: 'Panel', id: 'uifill-slots', props: { bare: true }, layout: { direction: 'row', gap: 14, align: 'end', padding: 8 },
      children: [
        buildItemSlot({ id: 'uf-slot1', icon: DEMO_IMG, edge: 'gold', count: 3, label: '长剑' }),
        buildItemSlot({ id: 'uf-slot2', icon: DEMO_IMG, edge: 'jade', selected: true, label: '选中' }),
        buildItemSlot({ id: 'uf-slot3', icon: DEMO_IMG, cooldown: '3', label: '冷却' }),
        buildItemSlot({ id: 'uf-slot4', empty: true, label: '空槽' }),
        buildStatTile({ id: 'uf-stat1', value: '140', label: '伤害', tone: 'gold', shadow: 4 }),
        buildStatTile({ id: 'uf-stat2', value: '×9', label: '连击', tone: 'danger' }),
      ] },
    divider('d-d6a'),
    sectionTitle('t-card', 'CARD · 内容卡（media/title/sub/角标·可点 → 信号 pickCard·四态）'),
    {
      type: 'Panel',
      id: 'demo-card',
      props: {},
      layout: { direction: 'grid', minCol: 130, gap: 10, padding: 10 },
      children: [
        { type: 'Card', id: 'card-1', props: { media: '⚔️', title: '青釭剑', sub: '攻击 +12', corner: 'SSR', tone: 'accent', action: 'pickCard', actionArg: 'sword' } },
        { type: 'Card', id: 'card-2', props: { media: '🛡️', title: '玄铁盾', sub: '防御 +8', corner: 'SR', tone: 'normal', action: 'pickCard', actionArg: 'shield' } },
        { type: 'Card', id: 'card-3', props: { media: '🏹', title: '连弩', sub: '暴击 +5%', tone: 'normal', action: 'pickCard', actionArg: 'bow' } },
        { type: 'Card', id: 'card-4', props: { media: '🔒', title: '未解锁', sub: '通关第三章', tone: 'locked' } },
      ],
    },
    divider('d-d6b'),
    sectionTitle('t-bind', 'BINDINGS · 世界数据绑定（bind=resourceId·resolveBindings 读世界填值·活 HUD）'),
    {
      type: 'Panel',
      id: 'demo-bind',
      props: { title: '活 HUD（绑定数据·非手搭文字）' },
      layout: { direction: 'column', gap: 10, padding: 12 },
      children: [
        { type: 'Label', id: 'bind-hp-lbl', props: { text: '生命值 ', bind: 'hp', size: 'md', bold: true, color: 'danger' } },
        { type: 'ProgressBar', id: 'bind-hp-bar', props: { value: 0, bind: 'hp', tone: 'danger', showValue: true } },
        { type: 'Label', id: 'bind-gold-lbl', props: { text: '金币 ', bind: 'gold', color: 'gold', bold: true } },
        {
          type: 'Panel',
          id: 'bind-btns',
          props: {},
          layout: { direction: 'row', gap: 10, padding: 0 },
          children: [
            { type: 'Button', id: 'bind-hurt', props: { label: '受伤 −10', kind: 'ghost', action: 'hurt', actionArg: '10' } },
            { type: 'Button', id: 'bind-heal', props: { label: '治疗 +10', kind: 'primary', action: 'heal', actionArg: '10' } },
          ],
        },
      ],
    },
    divider('d-d6c'),
    sectionTitle('t-vlist', 'VIRTUALLIST · 虚拟滚动列表（500 行只渲可视窗口·千行不卡·行可点 → pickVRow）'),
    {
      type: 'VirtualList',
      id: 'demo-vlist',
      props: {
        rows: Array.from({ length: 500 }, (_, i) => ({
          id: `v${i}`,
          cells: { idx: String(i + 1).padStart(3, '0'), name: `单位 #${i + 1}`, hp: String(((i * 37) % 100) + 1) },
        })),
        columns: [
          { key: 'idx', label: '#', align: 'center', width: 56 },
          { key: 'name', label: '名称', align: 'left' },
          { key: 'hp', label: '生命', align: 'right' },
        ],
        rowHeight: 34,
        height: 240,
        action: 'pickVRow',
      },
    },
    divider('d-d6d'),
    sectionTitle('t-toast', 'TOAST · 飘字提示（静态样式预览·五语义色；实时弹出见「输入与交互」页）'),
    {
      type: 'Panel',
      id: 'demo-toast',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Toast', id: 'toast-ok', props: { text: '保存成功', tone: 'ok' } },
        { type: 'Toast', id: 'toast-warn', props: { text: '网络不稳', tone: 'warn' } },
        { type: 'Toast', id: 'toast-danger', props: { text: '操作失败', tone: 'danger' } },
        { type: 'Toast', id: 'toast-accent', props: { text: '有新消息', tone: 'accent' } },
      ],
    },
    divider('d-d6'),
    sectionTitle('t-tooltip', 'TOOLTIP · 悬浮提示（hover 触发元素 → 气泡·四方位·引擎内建 hover）'),
    {
      type: 'Panel',
      id: 'demo-tooltip',
      props: {},
      layout: { direction: 'row', gap: 18, align: 'center', padding: 14 },
      children: [
        {
          type: 'Tooltip', id: 'tip-top', props: { content: '上方提示气泡', placement: 'top' },
          children: [{ type: 'Badge', id: 'tip-top-t', props: { text: '悬停我 · top', tone: 'ok' } }],
        },
        {
          type: 'Tooltip', id: 'tip-bottom', props: { content: '下方提示气泡', placement: 'bottom' },
          children: [{ type: 'Badge', id: 'tip-bottom-t', props: { text: '悬停我 · bottom', tone: 'warn' } }],
        },
        {
          type: 'Tooltip', id: 'tip-right', props: { content: '右侧说明文本', placement: 'right' },
          children: [{ type: 'Button', id: 'tip-right-t', props: { label: '按钮 + 提示', kind: 'ghost', action: 'click', actionArg: 'tooltip-btn' } }],
        },
      ],
    },
    divider('d-d7'),
    sectionTitle('t-table', 'TABLE · 数据表 / 榜单（行可点 → 信号 pickRow）'),
    {
      type: 'Table',
      id: 'demo-table',
      props: {
        title: '排行榜',
        columns: [
          { key: 'rank', label: '#', align: 'center', width: 48 },
          { key: 'name', label: '玩家', align: 'left' },
          { key: 'score', label: '分数', align: 'right' },
        ],
        rows: [
          { id: 'p1', cells: { rank: '1', name: '赵子龙', score: '9,820' }, tone: 'accent', action: 'pickRow' },
          { id: 'p2', cells: { rank: '2', name: '关云长', score: '9,410' }, action: 'pickRow' },
          { id: 'p3', cells: { rank: '3', name: '张翼德', score: '8,930' }, action: 'pickRow' },
          { id: 'p4', cells: { rank: '4', name: '马孟起', score: '8,610' }, tone: 'dim', action: 'pickRow' },
        ],
        empty: '暂无数据',
      },
    },
  ],
}; }
