// Game I · 控件画廊（纯 LayoutNode 数据，零渲染逻辑）。
//
// 这就是「玩 UI」的测试场：把引擎现有 15 个控件全部铺开、可交互、可换皮。
// 红线：本文件只产出数据。渲染/事件/换皮由引擎 renderNode + mountUI 解释（见 game-i.ts）。
// 母法：docs/design/apollo-ui-contract.md（控件契约总表）。

import type { LayoutNode } from '@ui/components/index.js';
import { THEME_OPTIONS } from './themes.js';
import { buildShop, INITIAL_SHOP, type ShopState } from './shop.js';
import { buildPickHand, INITIAL_PICK, type PickState } from './pickcards.js';
import { buildInputLab, INITIAL_INPUT, type InputLabState } from './input-lab.js';
import { buildVideoLab, INITIAL_AISHE, type AisheState } from './video-lab.js';
import { buildMmoHud } from './mmo-hud.js';
import { SOUNDS, BGM } from './sounds.js';

// 自定义画选中态的交互控件值（必须进 state·点击改值 + 局部更新才会动）。
export interface ControlsState {
  flag: boolean; sound: boolean; speed: string; view: string; qty: number; rating: number; city: string;
  muted: boolean; reverb: boolean; vol: number; pan: number;
}
export const INITIAL_CONTROLS: ControlsState = { flag: true, sound: true, speed: '1', view: 'grid', qty: 3, rating: 3, city: '', muted: false, reverb: false, vol: 70, pan: 0 };

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

// 平铺点阵贴图（自包含 SVG data-URI）：用 fill-opacity 而非 rgba()，避开 texLayer 的 ()'" 净化；
// encodeURIComponent 把空格/引号/尖括号全转 %XX → 过得了净化。配 bgTexture/bgScroll 即得「贴图底 + 滚动」。
const DOT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="1.6" fill="#9cd2c5" fill-opacity="0.30"/></svg>';
export const TEXTURE_URI = `data:image/svg+xml,${encodeURIComponent(DOT_SVG)}`;

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
    divider('d-l-tex'),
    sectionTitle('t-tex', 'PANEL · 贴图底 + UV 滚动（bgTexture / bgScroll）'),
    {
      type: 'Panel',
      id: 'demo-tex',
      props: { title: '平铺点阵贴图底·无缝向上滚动', bgTexture: TEXTURE_URI, bgTextureSize: 26, bgScroll: { y: 26, ms: 2600 } },
      layout: { direction: 'column', gap: 8, padding: 18, height: 150 },
      children: [
        { type: 'Label', id: 'tex-l1', props: { text: '这块面板的底是平铺的点阵贴图，并在 UV 上无缝滚动（看背景的点在动）。', color: 'sub', size: 'sm' } },
        { type: 'Label', id: 'tex-l2', props: { text: '纯数据：props.bgTexture(贴图URL) + bgTextureSize(平铺单元) + bgScroll{y,ms}（滚动周期）。最弱 LLM 能填。', color: 'dim', size: 'xs' } },
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
      sectionTitle('snd-t-play', '单音 · 点击播放（→ 信号 playSound·应用当前声像/混响）'),
      {
        type: 'Panel', id: 'demo-sounds', props: {},
        layout: { direction: 'grid', minCol: 120, gap: 10, padding: 8 },
        children: SOUNDS.map((s): LayoutNode => ({
          type: 'Button', id: `snd-${s.id}`,
          props: { label: s.label, kind: 'ghost', action: 'playSound', actionArg: s.id },
        })),
      },
      divider('snd-d1'),
      sectionTitle('snd-t-mix', '混音 · 多音同时发声（Web Audio 天然混合·多声道）'),
      {
        type: 'Panel', id: 'snd-mix', props: {},
        layout: { direction: 'row', gap: 10, align: 'center', padding: 8 },
        children: [
          { type: 'Button', id: 'snd-chord', props: { label: '🎶 和弦（3 音齐发）', kind: 'primary', action: 'playChord', actionArg: 'major' } },
          { type: 'Button', id: 'snd-all', props: { label: '💥 8 音齐发', kind: 'ghost', action: 'playChord', actionArg: 'all' } },
        ],
      },
      divider('snd-d2'),
      sectionTitle('snd-t-pan', '立体声 · 左右声像（StereoPanner·-100 左 ~ +100 右）'),
      {
        type: 'Panel', id: 'snd-pan', props: {},
        layout: { direction: 'column', gap: 10, padding: 8 },
        children: [
          { type: 'Slider', id: 'snd-pan-sl', props: { min: -100, max: 100, step: 10, value: c.pan, label: `声像 ${c.pan < 0 ? '偏左' : c.pan > 0 ? '偏右' : '居中'}`, action: 'setPan' } },
          {
            type: 'Panel', id: 'snd-pan-btn', props: {},
            layout: { direction: 'row', gap: 10, align: 'center', padding: 0 },
            children: [
              { type: 'Button', id: 'snd-pan-l', props: { label: '◀ 左', kind: 'ghost', action: 'playPan', actionArg: 'left' } },
              { type: 'Button', id: 'snd-pan-c', props: { label: '● 中', kind: 'ghost', action: 'playPan', actionArg: 'center' } },
              { type: 'Button', id: 'snd-pan-r', props: { label: '右 ▶', kind: 'ghost', action: 'playPan', actionArg: 'right' } },
              { type: 'Label', id: 'snd-pan-hint', props: { text: '戴耳机更明显', size: 'sm', color: 'dim' } },
            ],
          },
        ],
      },
      divider('snd-d3'),
      sectionTitle('snd-t-bgm', '背景音乐 · 循环播放（音序数据驱动）'),
      {
        type: 'Panel', id: 'snd-bgm', props: {},
        layout: { direction: 'row', gap: 10, align: 'center', padding: 8 },
        children: [
          ...BGM.map((b): LayoutNode => ({
            type: 'Button', id: `snd-bgm-${b.id}`,
            props: { label: `▶ ${b.label}`, kind: 'ghost', action: 'startBgm', actionArg: b.id },
          })),
          { type: 'Button', id: 'snd-bgm-stop', props: { label: '⏹ 停止', kind: 'quiet', action: 'stopBgm' } },
        ],
      },
      divider('snd-d4'),
      sectionTitle('snd-t-ctl', '混响 / 音量 / 静音'),
      {
        type: 'Panel', id: 'snd-ctl', props: {},
        layout: { direction: 'column', gap: 12, padding: 8 },
        children: [
          { type: 'Toggle', id: 'snd-reverb', props: { label: '混响（Convolver 卷积）', checked: c.reverb, action: 'toggleReverb' } },
          { type: 'Slider', id: 'snd-vol', props: { min: 0, max: 100, step: 5, value: c.vol, label: '音量', action: 'setSndVol' } },
          { type: 'Toggle', id: 'snd-mute', props: { label: c.muted ? '静音（已静音·点此恢复）' : '静音', checked: c.muted, action: 'toggleMute' } },
        ],
      },
    ],
  };
}

/**
 * 展示台模块清单——每块「积木」是一类底座能力的活样例。点一块进它自己的子菜单。
 * soon=规划中（占位·灰块不可点）。后续精灵动画/3D/视频逐块点亮。
 */
export const MODULES: ReadonlyArray<{ id: string; glyph: string; label: string; desc: string; tone: 'accent' | 'normal' | 'dim'; soon?: boolean }> = [
  { id: 'mod-ui', glyph: '🎛', label: 'UI 控件', desc: '30+ 数据驱动控件 · 换皮', tone: 'accent' as const },
  { id: 'mod-mmo', glyph: '🗡', label: '组合 · MMO HUD', desc: '纯数据复现 WoW 风最复杂 HUD', tone: 'accent' as const },
  { id: 'mod-sound', glyph: '🔊', label: '声音', desc: '合成 / 混音 / 立体声 / 混响', tone: 'normal' as const },
  { id: 'mod-input', glyph: '🎮', label: '输入底座', desc: 'RawInput → KeyBinding → 信号', tone: 'normal' as const },
  { id: 'mod-anim', glyph: '✨', label: '精灵动画', desc: 'tween 驱动 · Canvas 实时绘制', tone: 'normal' as const },
  { id: 'mod-ai', glyph: '🧠', label: '游戏 AI', desc: '索敌 aggro / 寻路 grid-move', tone: 'normal' as const },
  { id: 'mod-3d', glyph: '🧊', label: '3D 渲染', desc: 'Mesh3D · three 实时渲染', tone: 'normal' as const },
  { id: 'mod-physics', glyph: '🟢', label: '运动与碰撞', desc: 'motion + overlap + 碰撞响应', tone: 'normal' as const },
  { id: 'mod-combat', glyph: '⚔️', label: '战斗结算', desc: '命中 → 伤害 → DoT → 死亡', tone: 'normal' as const },
  { id: 'mod-spawn', glyph: '🎆', label: '生成与寿命', desc: 'spawn → 飞 → 寿命自毁', tone: 'normal' as const },
  { id: 'mod-fx', glyph: '💥', label: '战场特效（库B）', desc: '爆炸环 prefab · 火花叠在画面上', tone: 'normal' as const },
  { id: 'mod-fsm', glyph: '🔀', label: '状态机', desc: 'condition → signal → set-state', tone: 'normal' as const },
  { id: 'mod-video', glyph: '🎬', label: '爱诗视频', desc: 'AIGP 端口 → 竖屏短视频', tone: 'normal' as const },
];

/**
 * 渲染舞台样例（canvas/three 宿主挂载点）：标题条（图标 + LIVE）+ 说明 + 高亮框住的 #sim-stage 视口
 * + 「组合能力」标签条。chrome 全是 LayoutNode 数据（accent Panel / Badge / Tag），不手写 CSS。
 */
function buildSimStage(id: string, glyph: string, title: string, desc: string, caps: string[]): LayoutNode {
  return {
    type: 'Panel', id: `${id}-mod`, props: {},
    layout: { direction: 'column', gap: 12, padding: 18 },
    children: [
      // 标题条：图标 + 标题 + LIVE 徽标
      { type: 'Panel', id: `${id}-hd`, props: {}, layout: { direction: 'row', align: 'center', gap: 10, padding: 12 },
        children: [
          { type: 'Label', id: `${id}-ttl`, props: { text: `${glyph}  ${title}`, size: 'lg', bold: true }, layout: { flex: 1 } },
          { type: 'Badge', id: `${id}-live`, props: { text: '● LIVE', tone: 'ok' } },
        ] },
      { type: 'Label', id: `${id}-desc`, props: { text: desc, color: 'sub', size: 'sm' } },
      // #sim-stage：高亮框住的活动视口（宿主在此 init 引擎渲染器·canvas 实时绘制·非 DOM）。
      { type: 'Panel', id: 'sim-stage', props: { accent: true, bg: '#0a0f1e' }, layout: { width: 656, height: 416, padding: 8, align: 'center' } },
      // 「组合能力」标签条：本样例由哪些现成 capability 拼出来（信息 + 装饰·强化数据驱动叙事）。
      { type: 'Panel', id: `${id}-caps`, props: {}, layout: { direction: 'row', align: 'center', gap: 6, padding: 10 },
        children: [
          { type: 'Label', id: `${id}-capl`, props: { text: '组合能力', color: 'dim', size: 'xs', bold: true } },
          ...caps.map((c, i): LayoutNode => ({ type: 'Tag', id: `${id}-cap-${i}`, props: { label: c, tone: 'accent' } })),
        ] },
    ],
  };
}

/** 落地页：一块块「积木」拼起来的模块入口（grid 自适应·点 Card 进各自子菜单）。 */
function buildHub(): LayoutNode {
  return {
    // 落地积木墙底：平铺点阵贴图 + 缓慢 UV 滚动（owner 早前想要的「积木墙点阵底纹」·现用 bgTexture/bgScroll 数据实现）。
    type: 'Panel', id: 'hub', props: { title: '🧩 Apollo 引擎 · 底座能力展示台', bgTexture: TEXTURE_URI, bgTextureSize: 26, bgScroll: { y: 26, ms: 7000 } },
    layout: { direction: 'column', gap: 14, padding: 20 },
    children: [
      { type: 'Label', id: 'hub-sub', props: {
        text: '每块积木是一类底座能力的活样例——点一块进去，看它怎么用纯数据驱动。', color: 'sub', size: 'sm' } },
      {
        type: 'Panel', id: 'hub-grid', props: {},
        layout: { direction: 'grid', minCol: 200, gap: 14, padding: 0 },
        children: MODULES.map((m) => ({
          type: 'Card', id: `hub-${m.id}`,
          props: {
            media: m.glyph, title: m.label, sub: m.desc,
            corner: m.soon ? '规划中' : '',
            tone: m.soon ? 'locked' : m.tone,
            ...(m.soon ? {} : { action: 'enterModule', actionArg: m.id }),
          },
        })),
      },
    ],
  };
}

/** 规划中模块的占位页。 */
function comingSoon(id: string, label: string): LayoutNode {
  return {
    type: 'Panel', id: `soon-${id}`, props: { title: label },
    layout: { direction: 'column', gap: 8, padding: 24, align: 'center' },
    children: [
      { type: 'Label', id: `soon-${id}-t`, props: { text: '🚧 规划中', size: 'lg', bold: true } },
      { type: 'Label', id: `soon-${id}-d`, props: { text: '该底座能力的活样例即将点亮。', color: 'dim', size: 'sm' } },
    ],
  };
}

// ── 页 6 · 主程新增控件 / 新特性（把库里新加的能力全摆出来）─────────────────────
function buildPageNew(controls: ControlsState): LayoutNode {
  const pcard = (id: string, p: Record<string, unknown>): LayoutNode => ({ type: 'PlayingCard', id, props: p });
  return {
    type: 'Panel', id: 'page-new', props: { scroll: true },
    layout: { direction: 'column', gap: 18, padding: 20 },
    children: [
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
      { type: 'Panel', id: 'pp-felt', props: { title: 'bg 自定义底（felt）+ vignette 暗角', bg: 'linear-gradient(180deg,#16402c,#0e2a1c)', vignette: true },
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
          { type: 'Panel', id: 'cham-1', props: { bg: 'linear-gradient(180deg,#1c2a44,#101826)' }, layout: { chamfer: 14, padding: 16 },
            children: [{ type: 'Label', id: 'cham-l', props: { text: 'chamfer:14 切角面板', color: 'sub', size: 'sm' } }] },
          { type: 'Button', id: 'cham-btn', props: { label: '切角 CTA', kind: 'primary', action: 'click', actionArg: 'chamfer' }, layout: { chamfer: 10 } },
        ] },

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
          { type: 'Panel', id: 'pat-stripe', props: { title: 'stripe 45°斜纹', bg: 'linear-gradient(180deg,#16402c,#0e2a1c)', pattern: 'stripe' },
            layout: { direction: 'column', padding: 16, height: 76, flex: 1 },
            children: [{ type: 'Label', id: 'pat-sl', props: { text: '绿呢底叠斜条纹（纯 CSS·零贴图）。', color: 'sub', size: 'sm' } }] },
          { type: 'Panel', id: 'pat-checker', props: { title: 'checker 棋盘格', bg: 'linear-gradient(180deg,#2a1c40,#16102a)', pattern: 'checker' },
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
          { type: 'Panel', id: 'sheen-card', props: { bg: 'linear-gradient(180deg,#1c2a44,#101826)' }, layout: { sheen: true, chamfer: 12, padding: 16 },
            children: [{ type: 'Label', id: 'sheen-cl', props: { text: 'sheen 切角卡：一道流光斜扫而过。', color: 'sub', size: 'sm' } }] },
        ] },

      divider('d-n16'),
      sectionTitle('t-pixel', 'LABEL · font:pixel 像素字体（REQ-UI-fontPixel令牌·已落地·不再静默回退）'),
      { type: 'Panel', id: 'pixel-col', props: {}, layout: { direction: 'column', gap: 8, padding: 14 },
        children: [
          { type: 'Label', id: 'pixel-l', props: { text: 'PIXEL 8-BIT 像素标题 1942', size: 'lg', bold: true, color: 'jade', font: 'pixel' } },
          { type: 'Label', id: 'pixel-l2', props: { text: 'font:pixel · 复古街机/像素风（SHELL fontPixel 令牌已补默认值）', size: 'sm', color: 'sub', font: 'pixel' } },
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

/** UI 控件模块（6 个 UI 子 tab：容器/展示/输入/新特性/商店/选牌）。 */
function buildUIModule(shop: ShopState, pick: PickState, activeTab: string, controls: ControlsState): LayoutNode {
  return {
    type: 'Tabs', id: 'gallery-tabs',
    props: {
      tabs: [
        { id: 'tab-layout', label: '容器与布局' },
        { id: 'tab-display', label: '数据展示' },
        { id: 'tab-input', label: '输入与交互' },
        { id: 'tab-new', label: '🆕 新控件/特性' },
        { id: 'tab-shop', label: '🧩 组合演示·商店' },
        { id: 'tab-pick', label: '🎴 组合演示·选牌' },
      ],
      active: activeTab,
      action: 'switchTab',
    },
    layout: { flex: 1 },
    children: [pageLayout, pageDisplay, buildPageInput(controls), buildPageNew(controls), buildShop(shop), buildPickHand(pick)],
  };
}

/** 模块体：按当前模块出对应样例。 */
function moduleBody(
  currentModule: string, shop: ShopState, pick: PickState, activeTab: string,
  controls: ControlsState, input: InputLabState, aishe: AisheState,
): LayoutNode {
  switch (currentModule) {
    case 'mod-ui': return buildUIModule(shop, pick, activeTab, controls);
    case 'mod-mmo': return buildMmoHud();
    case 'mod-sound': return buildSoundPage(controls);
    case 'mod-input': return buildInputLab(input);
    case 'mod-video': return buildVideoLab(aishe);
    case 'mod-anim': return buildSimStage('anim', '✨', '精灵动画 · tween 驱动',
      '引擎 Canvas 渲染器实时绘制：4 个形状由 tween 能力（平移巡逻 / 呼吸缩放 / 匀速自转 / 淡入淡出）驱动，纯蓝图数据、无专属代码。',
      ['tween', 'transform', 'shape', 'color', 'CanvasRenderer']);
    case 'mod-ai': return buildSimStage('ai', '🧠', '游戏 AI · 索敌 + 寻路',
      '玩家居中（金圆），五个敌人挂 Perception（索敌 aggro：锁定最近玩家）+ GridMover（寻路 grid-move：hex A* 逐格逼近、到相邻停）。纯蓝图组合现成能力，无专属代码。',
      ['aggro', 'grid-move', 'hex A*', 'Perception']);
    case 'mod-3d': return buildSimStage('3d', '🧊', '3D 渲染 · Mesh3D',
      '引擎 ThreeRenderer 实时渲染：翻面卡 / 翻滚立方 / 倾转薄面，由 tween 转 Transform.rotation 当翻面角驱动。同一份 collectRenderables 换 three 后端即换维度。',
      ['Mesh3D', 'tween', 'ThreeRenderer']);
    case 'mod-physics': return buildSimStage('phys', '🟢', '运动与碰撞',
      'motion-apply（Velocity→Transform 运动学）+ overlap-detect（碰撞检测）+ collision-resolve（按质量推开=碰撞响应）。四物体相向运动、于中心相撞被推开。纯蓝图，无专属代码。',
      ['motion-apply', 'overlap-detect', 'collision-resolve']);
    case 'mod-combat': return buildSimStage('combat', '⚔️', '战斗结算',
      '弹道（Sensor+Hitbox）飞行命中敌人 → trigger-zone → hitbox 扣血 / 挂灼烧 DoT → mortal 判死 → destroy 移除。整条战斗链全是现成能力组合，零游戏代码。',
      ['hitbox', 'trigger-zone', 'over-time', 'mortal']);
    case 'mod-spawn': return buildSimStage('spawn', '🎆', '生成与寿命',
      '发射器 Timer→event-when→caster 周期性从 PrefabLibrary 模板生成粒子，粒子带 Velocity 飞 + Tween 淡出 + Timer 到期 → lifetime 自毁。生成与销毁全数据驱动。',
      ['caster', 'prefab', 'event-when', 'lifetime']);
    case 'mod-fx': return buildSimStage('fx', '💥', '战场特效（库B·挂在画面上）',
      '特效架构「库 B」：世界里生成的特效实体。定时引爆「爆炸环」prefab——caster 一次展开整圈放射火花 + 冲击核（飞 + 淡出 + Timer 到期 lifetime 自毁）。与「库 A·UI 特效（layout.fx）」正交、可叠加。新特效 = 加一份 prefab 数据，零新 system。',
      ['caster', 'prefab', 'tween', 'lifetime']);
    case 'mod-fsm': return buildSimStage('fsm', '🔀', '状态机 / 行为',
      '自由计时器驱动 condition→signal→effect：idle→alert→flee→循环。状态转移（set-state）+ 指示块切换（set-visible）三段全是数据，非代码。',
      ['state', 'event-when', 'effect-apply']);
    default: return buildHub();
  }
}

/**
 * 整棵展示台 = 顶栏 + （落地积木墙 Hub｜某模块子菜单）。currentModule=null → Hub；否则进该模块。
 * modalOpen / drawerOpen = UI 模块里叠加演示用模态/抽屉（宿主状态驱动·开关都是数据/信号）。
 * 整棵树是纯数据：换主题只是换令牌包重挂，这份数据一字不改。
 */
export function buildGallery(
  activeTheme: string, currentModule: string | null = null, modalOpen = false, drawerOpen = false,
  shop: ShopState = INITIAL_SHOP, pick: PickState = INITIAL_PICK, activeTab = 'tab-layout',
  controls: ControlsState = INITIAL_CONTROLS, input: InputLabState = INITIAL_INPUT,
  aishe: AisheState = INITIAL_AISHE,
): LayoutNode {
  const mod = currentModule ? MODULES.find((m) => m.id === currentModule) : undefined;
  const title = mod ? `${mod.glyph} ${mod.label}` : 'Game I · 底座能力展示台';
  return {
    type: 'Screen',
    id: 'gameui-root',
    props: { center: false },
    layout: { direction: 'column', padding: 0 },
    children: [
      // 顶栏：（返回展台·进模块时）+ 标题 + 换皮下拉
      {
        type: 'Panel',
        id: 'topbar',
        props: {},
        layout: { direction: 'row', gap: 12, align: 'center', padding: 16 },
        children: [
          ...(currentModule ? [{ type: 'Button', id: 'hub-back', props: { label: '← 展台', kind: 'ghost', action: 'exitModule' } } as LayoutNode] : []),
          { type: 'Label', id: 'app-title', props: { text: title, size: 'lg', bold: true }, layout: { flex: 1 } },
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
      // 落地积木墙 或 某模块子菜单
      currentModule ? moduleBody(currentModule, shop, pick, activeTab, controls, input, aishe) : buildHub(),
      // 模态浮层 / 抽屉按需叠加（满屏遮罩·盖在主界面之上）
      ...(modalOpen ? [modalOverlay] : []),
      ...(drawerOpen ? [drawerOverlay] : []),
    ],
  };
}
