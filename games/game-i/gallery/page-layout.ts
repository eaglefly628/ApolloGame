// Game I 展示台 · 页 1 · 容器与布局
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { sectionTitle, divider, TEXTURE_URI } from './shared.js';
// ── 页 1 · 容器与布局 ────────────────────────────────────────
// 函数（非 const）：每次渲染重建，让内部 sectionTitle 参与当次「子编号」计数（与其它 tab 页一致递增）。
export function pageLayout(): LayoutNode { return {
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
}; }
