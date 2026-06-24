// Game I · 控件画廊（纯 LayoutNode 数据，零渲染逻辑）。
//
// 这就是「玩 UI」的测试场：把引擎现有 15 个控件全部铺开、可交互、可换皮。
// 红线：本文件只产出数据。渲染/事件/换皮由引擎 renderNode + mountUI 解释（见 game-i.ts）。
// 母法：docs/design/apollo-ui-contract.md（控件契约总表）。

import type { LayoutNode } from '@ui/components/index.js';
import { THEME_OPTIONS } from './themes.js';
import { buildShop, INITIAL_SHOP, type ShopState } from './shop.js';
import { buildPickHand, INITIAL_PICK, type PickState } from './pickcards.js';
import { SOUNDS } from './sounds.js';

// 自定义画选中态的交互控件值（必须进 state·点击改值 + 局部更新才会动）。
export interface ControlsState {
  flag: boolean; sound: boolean; speed: string; view: string; qty: number; rating: number; city: string; muted: boolean;
}
export const INITIAL_CONTROLS: ControlsState = { flag: true, sound: true, speed: '1', view: 'grid', qty: 3, rating: 3, city: '', muted: false };

// 自包含演示图：内联 data-URI SVG（纯数据·不依赖外部资源文件），用于 Image 控件展示。
const DEMO_IMG =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22160%22%20height%3D%22100%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2322d3ee%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%237c3aed%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22160%22%20height%3D%22100%22%20fill%3D%22url(%23g)%22%2F%3E%3Ctext%20x%3D%2280%22%20y%3D%2258%22%20font-size%3D%2222%22%20fill%3D%22white%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-weight%3D%22bold%22%3EAPOLLO%3C%2Ftext%3E%3C%2Fsvg%3E';

// ── 段落标题小工具（统一风格：阔字距小标签）──────────────────
function sectionTitle(id: string, text: string): LayoutNode {
  return { type: 'Label', id, props: { text, size: 'xs', color: 'dim', bold: true } };
}
function divider(id: string): LayoutNode {
  return { type: 'Divider', id, props: {} };
}

// ── 页 1 · 容器与布局 ────────────────────────────────────────
const pageLayout: LayoutNode = {
  type: 'Panel',
  id: 'page-layout',
  props: { scroll: true },
  layout: { direction: 'column', gap: 18, padding: 20 },
  children: [
    sectionTitle('t-row', 'PANEL · 横向 row'),
    {
      type: 'Panel',
      id: 'demo-row',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 12 },
      children: [
        { type: 'Badge', id: 'r1', props: { text: '弹性 1', tone: 'ok' }, layout: { flex: 1 } },
        { type: 'Badge', id: 'r2', props: { text: '弹性 2', tone: 'warn' }, layout: { flex: 2 } },
        { type: 'Badge', id: 'r3', props: { text: '弹性 1', tone: 'dim' }, layout: { flex: 1 } },
      ],
    },
    divider('d-l1'),
    sectionTitle('t-col', 'PANEL · 纵向 column（带标题容器）'),
    {
      type: 'Panel',
      id: 'demo-col',
      props: { title: '一个有标题的面板' },
      layout: { direction: 'column', gap: 8, padding: 12 },
      children: [
        { type: 'Label', id: 'c1', props: { text: '第一行', color: 'sub' } },
        { type: 'Label', id: 'c2', props: { text: '第二行', color: 'sub' } },
        { type: 'Label', id: 'c3', props: { text: '第三行', color: 'sub' } },
      ],
    },
    divider('d-l2'),
    sectionTitle('t-grid', 'PANEL · 自适应网格 grid（minCol 控列宽·卡牌格/货架）'),
    {
      type: 'Panel',
      id: 'demo-grid',
      props: {},
      layout: { direction: 'grid', minCol: 120, gap: 10, padding: 12 },
      children: Array.from({ length: 8 }, (_, i): LayoutNode => ({
        type: 'Panel',
        id: `cell-${i}`,
        props: { title: `格 ${i + 1}` },
        layout: { direction: 'column', gap: 4, padding: 10, align: 'center' },
        children: [
          { type: 'Badge', id: `cell-b-${i}`, props: { text: `#${i + 1}`, tone: 'dim' } },
        ],
      })),
    },
    divider('d-l3'),
    sectionTitle('t-accordion', 'ACCORDION · 折叠面板（点标题展开/收起·引擎内建 → 信号 toggleAcc）'),
    {
      type: 'Accordion',
      id: 'demo-accordion',
      props: { title: '点我展开这段说明', open: false, action: 'toggleAcc' },
      children: [
        { type: 'Label', id: 'acc-l1', props: { text: '折叠面板用于收纳次要内容，点标题即可展开/收起。', color: 'sub' } },
        { type: 'Label', id: 'acc-l2', props: { text: '开合由引擎 mountUI 内建处理，数据只填 title / open / action。', color: 'dim', size: 'sm' } },
      ],
    },
  ],
};

// ── 页 2 · 数据展示 ──────────────────────────────────────────
const labelColors: Array<'text' | 'sub' | 'dim' | 'jade' | 'gold' | 'ok' | 'warn' | 'danger'> =
  ['text', 'sub', 'dim', 'jade', 'gold', 'ok', 'warn', 'danger'];
const labelSizes: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl'> = ['xs', 'sm', 'md', 'lg', 'xl'];

const pageDisplay: LayoutNode = {
  type: 'Panel',
  id: 'page-display',
  props: { scroll: true },
  layout: { direction: 'column', gap: 18, padding: 20 },
  children: [
    sectionTitle('t-lbl-size', 'LABEL · 五尺寸'),
    {
      type: 'Panel',
      id: 'demo-lbl-size',
      props: {},
      layout: { direction: 'row', gap: 14, align: 'end', padding: 10 },
      children: labelSizes.map((s): LayoutNode => ({
        type: 'Label', id: `lbl-size-${s}`, props: { text: s.toUpperCase(), size: s, bold: true },
      })),
    },
    sectionTitle('t-lbl-color', 'LABEL · 八语义色 + 等宽'),
    {
      type: 'Panel',
      id: 'demo-lbl-color',
      props: {},
      layout: { direction: 'row', gap: 14, padding: 10 },
      children: [
        ...labelColors.map((c): LayoutNode => ({
          type: 'Label', id: `lbl-color-${c}`, props: { text: c, color: c, bold: true },
        })),
        { type: 'Label', id: 'lbl-mono', props: { text: 'mono 0123', mono: true, color: 'sub' } },
      ],
    },
    divider('d-d1'),
    sectionTitle('t-badge', 'BADGE · 三态徽章'),
    {
      type: 'Panel',
      id: 'demo-badge',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 10 },
      children: [
        { type: 'Badge', id: 'bdg-ok', props: { text: '在线', tone: 'ok' } },
        { type: 'Badge', id: 'bdg-warn', props: { text: '警示', tone: 'warn' } },
        { type: 'Badge', id: 'bdg-dim', props: { text: '离线', tone: 'dim' } },
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
    sectionTitle('t-progress', 'PROGRESSBAR · 进度条（五语义色 + 标签 + 显数值）'),
    {
      type: 'Panel',
      id: 'demo-progress',
      props: {},
      layout: { direction: 'column', gap: 10, padding: 10 },
      children: [
        { type: 'ProgressBar', id: 'pb-accent', props: { value: 72, label: '加载进度', showValue: true, tone: 'accent' } },
        { type: 'ProgressBar', id: 'pb-ok', props: { value: 100, label: '已完成', showValue: true, tone: 'ok' } },
        { type: 'ProgressBar', id: 'pb-warn', props: { value: 45, max: 100, label: '体力', tone: 'warn' } },
        { type: 'ProgressBar', id: 'pb-danger', props: { value: 12, label: '血量', showValue: true, tone: 'danger' } },
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
      ],
    },
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
};

// ── 页 3 · 输入与交互 ────────────────────────────────────────
function buildPageInput(c: ControlsState): LayoutNode {
  return {
  type: 'Panel',
  id: 'page-input',
  props: { scroll: true },
  layout: { direction: 'column', gap: 18, padding: 20 },
  children: [
    sectionTitle('t-btn', 'BUTTON · 三态 + 禁用（→ 信号 click）'),
    {
      type: 'Panel',
      id: 'demo-btn',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 10 },
      children: [
        { type: 'Button', id: 'btn-p', props: { label: '主操作', kind: 'primary', action: 'click', actionArg: 'primary' } },
        { type: 'Button', id: 'btn-g', props: { label: '次操作', kind: 'ghost', action: 'click', actionArg: 'ghost' } },
        { type: 'Button', id: 'btn-q', props: { label: '安静', kind: 'quiet', action: 'click', actionArg: 'quiet' } },
        { type: 'Button', id: 'btn-d', props: { label: '禁用', kind: 'primary', disabled: true, action: 'click', actionArg: 'disabled' } },
      ],
    },
    divider('d-i1'),
    sectionTitle('t-input', 'INPUT · 文本 / 数字（→ 信号 setText / setNum）'),
    {
      type: 'Panel',
      id: 'demo-input',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 10 },
      children: [
        { type: 'Input', id: 'in-text', props: { placeholder: '玩家名称…', type: 'text', action: 'setText' }, layout: { flex: 2 } },
        { type: 'Input', id: 'in-num', props: { placeholder: '数量', type: 'number', value: '1', action: 'setNum' }, layout: { flex: 1 } },
      ],
    },
    sectionTitle('t-dropdown', 'DROPDOWN · 下拉选择（→ 信号 setDifficulty）'),
    {
      type: 'Dropdown',
      id: 'dd-diff',
      props: {
        options: [
          { value: 'easy', label: '简单' },
          { value: 'normal', label: '普通' },
          { value: 'hard', label: '困难' },
        ],
        value: 'normal',
        action: 'setDifficulty',
      },
    },
    divider('d-i2'),
    sectionTitle('t-check', 'CHECKBOX / TOGGLE · 开关（→ 信号 setFlag / setSound）'),
    {
      type: 'Panel',
      id: 'demo-check',
      props: {},
      layout: { direction: 'row', gap: 24, align: 'center', padding: 10 },
      children: [
        { type: 'Checkbox', id: 'cb-tutorial', props: { label: '开启新手引导', checked: c.flag, action: 'setFlag' } },
        { type: 'Toggle', id: 'tg-sound', props: { label: '音效', checked: c.sound, action: 'setSound' } },
      ],
    },
    sectionTitle('t-radio', 'RADIOGROUP · 互斥单选（→ 信号 setSpeed）'),
    {
      type: 'RadioGroup',
      id: 'rg-speed',
      props: {
        name: 'speed',
        options: [
          { value: '1', label: '1×' },
          { value: '2', label: '2×' },
          { value: '4', label: '4×' },
        ],
        value: c.speed,
        action: 'setSpeed',
      },
    },
    divider('d-i3'),
    sectionTitle('t-slider', 'SLIDER · 数值滑块（→ 信号 setVolume）'),
    {
      type: 'Slider',
      id: 'sl-volume',
      props: { min: 0, max: 100, step: 5, value: 60, label: '音量', action: 'setVolume' },
    },
    divider('d-i3b'),
    sectionTitle('t-segmented', 'SEGMENTED · 分段选择器（互斥·紧凑·→ 信号 setView）'),
    {
      type: 'Segmented',
      id: 'seg-view',
      props: {
        options: [
          { value: 'grid', label: '网格' },
          { value: 'list', label: '列表' },
          { value: 'card', label: '卡片' },
        ],
        value: c.view,
        action: 'setView',
      },
    },
    sectionTitle('t-stepper', 'STEPPER · 步进器（±按钮调数值·边界禁用·→ 信号 setQty）'),
    {
      type: 'Stepper',
      id: 'stp-qty',
      props: { value: c.qty, min: 0, max: 10, step: 1, action: 'setQty' },
    },
    sectionTitle('t-combobox', 'COMBOBOX · 可搜索下拉（输入过滤·点项回填·引擎内建 → 信号 setCity）'),
    {
      type: 'Combobox',
      id: 'cb-city',
      props: {
        options: [
          { value: 'cd', label: '成都' },
          { value: 'luoyang', label: '洛阳' },
          { value: 'xuchang', label: '许昌' },
          { value: 'jianye', label: '建业' },
          { value: 'changan', label: '长安' },
        ],
        placeholder: '搜索城市…',
        value: c.city,
        action: 'setCity',
      },
    },
    sectionTitle('t-rating', 'RATING · 星级评分（点星 → 信号 setRating）'),
    {
      type: 'Rating',
      id: 'rt-stars',
      props: { value: c.rating, max: 5, action: 'setRating' },
    },
    divider('d-i4'),
    sectionTitle('t-modal', 'MODAL · 模态浮层（按钮开 → 点遮罩/× 关·引擎内建 closeAction）'),
    {
      type: 'Panel',
      id: 'demo-modal',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Button', id: 'btn-open-modal', props: { label: '打开模态框', kind: 'primary', action: 'openModal' } },
        { type: 'Label', id: 'modal-hint', props: { text: '点遮罩本身或右上角 × 即关闭', size: 'sm', color: 'dim' } },
      ],
    },
    divider('d-i4b'),
    sectionTitle('t-drawer', 'DRAWER · 抽屉浮层（按钮开 → 右侧滑入·点遮罩/× 关·引擎内建）'),
    {
      type: 'Panel',
      id: 'demo-drawer',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Button', id: 'btn-open-drawer', props: { label: '打开抽屉', kind: 'primary', action: 'openDrawer' } },
        { type: 'Label', id: 'drawer-hint', props: { text: '从右侧滑入·遮罩/× 关闭', size: 'sm', color: 'dim' } },
      ],
    },
    divider('d-i4c'),
    sectionTitle('t-ctxmenu', 'CONTEXTMENU · 右键菜单（在下方区域点右键 → 光标处弹菜单·引擎内建 → ctxAction）'),
    {
      type: 'ContextMenu',
      id: 'demo-ctxmenu',
      props: {
        items: [
          { id: 'open', label: '打开', action: 'ctxAction' },
          { id: 'rename', label: '重命名', action: 'ctxAction' },
          { id: 'dup', label: '复制', action: 'ctxAction' },
          { id: 'delete', label: '删除', action: 'ctxAction' },
        ],
      },
      children: [
        {
          type: 'Panel',
          id: 'ctx-target',
          props: { title: '右键点我' },
          layout: { direction: 'column', gap: 4, padding: 18, align: 'center' },
          children: [
            { type: 'Label', id: 'ctx-hint', props: { text: '在此区域点鼠标右键，菜单会在光标处弹出', color: 'sub', size: 'sm' } },
          ],
        },
      ],
    },
    divider('d-i5'),
    sectionTitle('t-toast-live', 'TOAST · 实时飘字（点击 → showToast·底部居中堆叠·到时自动消失）'),
    {
      type: 'Panel',
      id: 'demo-toast-live',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Button', id: 'btn-toast-ok', props: { label: '成功提示', kind: 'primary', action: 'showToast', actionArg: 'ok' } },
        { type: 'Button', id: 'btn-toast-warn', props: { label: '警告提示', kind: 'ghost', action: 'showToast', actionArg: 'warn' } },
        { type: 'Button', id: 'btn-toast-danger', props: { label: '错误提示', kind: 'ghost', action: 'showToast', actionArg: 'danger' } },
      ],
    },
  ],
  };
}

// ── 模态浮层（按需叠加于 Screen 之上）─────────────────────────
// Modal 是满屏遮罩浮层：开 = 宿主把它挂进树重渲染；关 = 引擎内建（点遮罩/× → closeModal）。
// 模态/抽屉浮层节点（导出供宿主作「独立浮层」挂载·不进画廊树 → 开关不触发画廊重渲）。
export const modalOverlay: LayoutNode = {
  type: 'Modal',
  id: 'demo-modal-overlay',
  props: { title: '示例模态框', size: 'md', closable: true, closeAction: 'closeModal' },
  layout: {},
  children: [
    { type: 'Label', id: 'mo-body', props: { text: '这是一个数据驱动的模态浮层——标题/尺寸/可关均由数据配置。', color: 'sub' } },
    { type: 'Divider', id: 'mo-div', props: {} },
    {
      type: 'Panel',
      id: 'mo-actions',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 0 },
      children: [
        { type: 'Tag', id: 'mo-tag', props: { label: '弹窗内也能放控件', tone: 'accent' } },
        { type: 'Button', id: 'mo-ok', props: { label: '知道了', kind: 'primary', action: 'closeModal' } },
      ],
    },
  ],
};

// ── 抽屉浮层（按需叠加·右侧滑入·开靠宿主、关靠引擎内建 closeAction）─────
export const drawerOverlay: LayoutNode = {
  type: 'Drawer',
  id: 'demo-drawer-overlay',
  props: { side: 'right', title: '示例抽屉', closeAction: 'closeDrawer' },
  layout: {},
  children: [
    { type: 'Label', id: 'dw-body', props: { text: '抽屉常用于侧边设置 / 详情面板，从屏幕一侧滑入。', color: 'sub' } },
    { type: 'Divider', id: 'dw-div', props: {} },
    { type: 'Toggle', id: 'dw-tg', props: { label: '抽屉里的开关', checked: true, action: 'setFlag' } },
    { type: 'Button', id: 'dw-ok', props: { label: '收起抽屉', kind: 'primary', action: 'closeDrawer' } },
  ],
};

// ── 页 6 · 声音测试（Web Audio 合成·无需音频文件）────────────────
function buildSoundPage(c: ControlsState): LayoutNode {
  return {
    type: 'Panel',
    id: 'page-sound',
    props: { scroll: true },
    layout: { direction: 'column', gap: 16, padding: 20 },
    children: [
      {
        type: 'Panel', id: 'snd-hud', props: {},
        layout: { direction: 'row', gap: 12, align: 'center', padding: 12 },
        children: [
          { type: 'Label', id: 'snd-title', props: { text: '🔊 声音测试', size: 'lg', bold: true }, layout: { flex: 1 } },
          { type: 'Badge', id: 'snd-engine', props: { text: 'Web Audio 合成 · 无需音频文件', tone: 'dim' } },
        ],
      },
      { type: 'Label', id: 'snd-hint', props: { text: '点按钮播放合成音（纯频率/波形数据驱动）。下方可调音量、静音。', color: 'dim', size: 'sm' } },
      sectionTitle('snd-t-play', 'PLAY · 点击播放（→ 信号 playSound）'),
      {
        type: 'Panel', id: 'demo-sounds', props: {},
        layout: { direction: 'grid', minCol: 120, gap: 10, padding: 8 },
        children: SOUNDS.map((s): LayoutNode => ({
          type: 'Button', id: `snd-${s.id}`,
          props: { label: s.label, kind: 'ghost', action: 'playSound', actionArg: s.id },
        })),
      },
      divider('snd-d1'),
      sectionTitle('snd-t-ctl', '音量 / 静音'),
      {
        type: 'Panel', id: 'snd-ctl', props: {},
        layout: { direction: 'column', gap: 12, padding: 8 },
        children: [
          { type: 'Slider', id: 'snd-vol', props: { min: 0, max: 100, step: 5, value: 70, label: '音量', action: 'setSndVol' } },
          { type: 'Toggle', id: 'snd-mute', props: { label: '静音', checked: c.muted, action: 'toggleMute' } },
        ],
      },
    ],
  };
}

/**
 * modalOpen / drawerOpen = 是否叠加演示用模态浮层 / 抽屉（宿主状态驱动·开关都是数据/信号）。
 * 整棵树是纯数据：换主题只是换令牌包重挂载，这份数据一字不改。
 */
export function buildGallery(
  activeTheme: string, modalOpen = false, drawerOpen = false,
  shop: ShopState = INITIAL_SHOP, pick: PickState = INITIAL_PICK, activeTab = 'tab-layout',
  controls: ControlsState = INITIAL_CONTROLS,
): LayoutNode {
  return {
    type: 'Screen',
    id: 'gameui-root',
    props: { center: false },
    layout: { direction: 'column', padding: 0 },
    children: [
      // 顶栏：标题 + 换皮下拉
      {
        type: 'Panel',
        id: 'topbar',
        props: {},
        layout: { direction: 'row', gap: 12, align: 'center', padding: 16 },
        children: [
          { type: 'Label', id: 'app-title', props: { text: 'Game I · 控件测试场', size: 'lg', bold: true }, layout: { flex: 1 } },
          { type: 'Badge', id: 'app-engine', props: { text: 'Apollo Engine · 数据驱动 UI', tone: 'dim' } },
          { type: 'Label', id: 'theme-lbl', props: { text: '换皮', size: 'sm', color: 'sub' } },
          {
            type: 'Dropdown',
            id: 'theme-pick',
            props: { options: THEME_OPTIONS, value: activeTheme, action: 'setTheme' },
          },
        ],
      },
      { type: 'Divider', id: 'top-div', props: {} },
      // 分类多页
      {
        type: 'Tabs',
        id: 'gallery-tabs',
        props: {
          tabs: [
            { id: 'tab-layout', label: '容器与布局' },
            { id: 'tab-display', label: '数据展示' },
            { id: 'tab-input', label: '输入与交互' },
            { id: 'tab-shop', label: '🧩 组合演示·商店' },
            { id: 'tab-pick', label: '🎴 组合演示·选牌' },
            { id: 'tab-sound', label: '🔊 声音测试' },
          ],
          active: activeTab,
          action: 'switchTab',
        },
        layout: { flex: 1 },
        children: [pageLayout, pageDisplay, buildPageInput(controls), buildShop(shop), buildPickHand(pick), buildSoundPage(controls)],
      },
      // 模态浮层 / 抽屉按需叠加（满屏遮罩·盖在主界面之上）
      ...(modalOpen ? [modalOverlay] : []),
      ...(drawerOpen ? [drawerOverlay] : []),
    ],
  };
}
