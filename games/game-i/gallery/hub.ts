// Game I 展示台 · 落地积木墙 Hub + 渲染舞台壳
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { TEXTURE_URI } from './shared.js';
import { MODULES, MODULE_NO } from './modules.js';
/**
 * 渲染舞台样例（canvas/three 宿主挂载点）：标题条（图标 + LIVE）+ 说明 + 高亮框住的 #sim-stage 视口
 * + 「组合能力」标签条。chrome 全是 LayoutNode 数据（accent Panel / Badge / Tag），不手写 CSS。
 */
export function buildSimStage(id: string, glyph: string, title: string, desc: string, caps: string[], tune?: LayoutNode): LayoutNode {
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
      // 现场调参台（可选·REQ-DEMO-调参台）：客户点档即改蓝图数据 → 渲染舞台实时换画。
      ...(tune ? [tune] : []),
      // #sim-stage：高亮框住的活动视口（宿主在此 init 引擎渲染器·canvas 实时绘制·非 DOM）。
      { type: 'Panel', id: 'sim-stage', props: { accent: true, bg: { custom: '#0a0f1e' } }, layout: { width: 656, height: 416, padding: 8, align: 'center' } },
      // 「组合能力」标签条：本样例由哪些现成 capability 拼出来（信息 + 装饰·强化数据驱动叙事）。
      { type: 'Panel', id: `${id}-caps`, props: {}, layout: { direction: 'row', align: 'center', gap: 6, padding: 10 },
        children: [
          { type: 'Label', id: `${id}-capl`, props: { text: '组合能力', color: 'dim', size: 'xs', bold: true } },
          ...caps.map((c, i): LayoutNode => ({ type: 'Tag', id: `${id}-cap-${i}`, props: { label: c, tone: 'accent' } })),
        ] },
    ],
  };
}

function moduleCard(m: typeof MODULES[number]): LayoutNode {
  const no = MODULE_NO.get(m.id) ?? 0;
  return {
    type: 'Card', id: `hub-${m.id}`,
    props: {
      media: m.glyph, title: `#${no} ${m.label}`, sub: m.desc, // 编号直接进标题（一眼可见）
      corner: m.soon ? `#${no}·规划中` : `#${no}`,             // 角标也标编号
      tone: m.soon ? 'locked' : m.tone,
      ...(m.soon ? {} : { action: 'enterModule', actionArg: m.id }),
    },
  };
}

/** 编号快速跳转条：一排可点的效果编号（点编号=直达该效果）。demo 时「我要看 12 号」点 12 即跳。 */
function buildJumpBar(): LayoutNode {
  return {
    type: 'Panel', id: 'hub-jump', props: { bg: 'jade', title: '🔢 效果编号快速跳转 · 点编号直达（demo 指哪看哪）' },
    layout: { direction: 'grid', minCol: 44, gap: 6, padding: 12 }, // grid=自动换行（无 wrap 字段）
    children: MODULES.map((m): LayoutNode => {
      const no = MODULE_NO.get(m.id) ?? 0;
      return {
        type: 'Button', id: `jump-${m.id}`,
        props: {
          label: String(no), kind: m.dim === '3d' ? 'primary' : 'ghost', disabled: m.soon,
          ...(m.soon ? {} : { action: 'enterModule', actionArg: m.id }),
        },
        layout: { width: 40 },
      };
    }),
  };
}

/** 一个维度分区：分区标题 + 该维度模块的自适应网格。 */
function hubSection(id: string, title: string, sub: string, dim: '2d' | '3d'): LayoutNode {
  return {
    type: 'Panel', id: `hub-sec-${id}`, props: { bare: true },
    layout: { direction: 'column', gap: 10, padding: 0 },
    children: [
      { type: 'Panel', id: `hub-sechd-${id}`, props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 10 },
        children: [
          { type: 'Label', id: `hub-sect-${id}`, props: { text: title, size: 'lg', bold: true, color: 'gold' } },
          { type: 'Label', id: `hub-secs-${id}`, props: { text: sub, size: 'xs', color: 'sub' }, layout: { flex: 1 } },
        ] },
      { type: 'Panel', id: `hub-grid-${id}`, props: {}, layout: { direction: 'grid', minCol: 200, gap: 14, padding: 0 },
        children: MODULES.filter((m) => m.dim === dim).map(moduleCard) },
    ],
  };
}

/** 落地页：拆 2D / 3D 两区，每区一墙模块积木（点 Card 进各自子菜单）。 */
export function buildHub(): LayoutNode {
  return {
    // 落地积木墙底：平铺点阵贴图 + 缓慢 UV 滚动（owner 早前想要的「积木墙点阵底纹」·现用 bgTexture/bgScroll 数据实现）。
    type: 'Panel', id: 'hub', props: { title: '🧩 ZeroCraft 引擎 · 底座能力展示台', scroll: true, bgTexture: TEXTURE_URI, bgTextureSize: 26, bgScroll: { y: 26, ms: 7000 } },
    layout: { direction: 'column', gap: 18, padding: 20 },
    children: [
      { type: 'Label', id: 'hub-sub', props: {
        text: '每块积木是一类底座能力的活样例——点一块进去，看它怎么用纯数据驱动。分 2D 与 3D 两区。每个效果带编号（卡片标题/角标 #N），也可用下面的编号条直达。', color: 'sub', size: 'sm' } },
      buildJumpBar(),
      hubSection('2d', '🟦 2D 能力', 'UI / 声音 / 输入 / 动画 / AI / 物理 / 战斗 / 特效 / 状态机 / 视频', '2d'),
      { type: 'Divider', id: 'hub-div', props: {} },
      hubSection('3d', '🧊 3D 能力', '消费 ZeroCraft 3D 渲染线（ThreeRenderer）——光照 / 景深 / 寻路 / 碰撞 / 粒子', '3d'),
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
