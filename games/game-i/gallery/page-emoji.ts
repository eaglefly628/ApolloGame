// Game I 展示台 · 页 · emoji 美术
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { sectionTitle } from './shared.js';
// ── 页 6 · 主程新增控件 / 新特性（把库里新加的能力全摆出来）─────────────────────
/** 🎨 emoji 美术 tab（REQ-UI-emoji图渲 活范例·独立顶层 tab·文本 emoji 自动成库里 Twemoji 美术图）。 */
export function buildPageEmoji(): LayoutNode {
  return {
    type: 'Panel', id: 'page-emoji', props: { scroll: true },
    layout: { direction: 'column', gap: 16, padding: 20 },
    children: [
      sectionTitle('t-emoji', '🎮 文本 EMOJI 自动图渲（写 emoji 字形 → 渲染成库里 Twemoji 美术图·render-only·REQ-UI-emoji图渲）'),
      { type: 'Label', id: 't-emoji-sub', props: { text: '整个展示台开了 theme.emoji（base=/games/game-i/art/emoji）——所有 Label/Button/Tag/Badge/Tabs/Card 文本里的 emoji 字形都自动换成美术图（1em·随字号·baseline）。不必逐个手转 Image 槽；一处配置覆盖全线（连这个 tab 名的 🎨、上面各 tab 的 🧊🆕🎴 也都是自动成图）。', color: 'sub', size: 'sm' } },
      { type: 'Panel', id: 'emoji-demo', props: { title: '同一份文本数据·emoji 自动成图' }, layout: { direction: 'column', gap: 12, padding: 16 },
        children: [
          { type: 'Label', id: 'emoji-l1', props: { text: '大厅：🎮 开始 · 🏆 排行榜 · 💎 商店 · ⚔️ 竞技场 · 🎁 每日奖励', size: 'lg' } },
          { type: 'Label', id: 'emoji-l2', props: { spans: [{ text: '💰 金币 12,340', color: 'gold', bold: true }, { text: '　🔥 连胜 7', color: 'danger' }, { text: '　★ 段位 白金', color: 'jade' }] } },
          { type: 'Panel', id: 'emoji-btns', props: { bare: true }, layout: { direction: 'row', gap: 10, align: 'center' },
            children: [
              { type: 'Button', id: 'emoji-b1', props: { label: '⚔️ 出战', kind: 'hero' } },
              { type: 'Button', id: 'emoji-b2', props: { label: '🛡️ 防守', kind: 'primary' } },
              { type: 'Button', id: 'emoji-b3', props: { label: '🎒 背包', kind: 'ghost' } },
              { type: 'Tag', id: 'emoji-t1', props: { label: '🀄 麻将', tone: 'accent', size: 'lg' } },
              { type: 'Badge', id: 'emoji-g1', props: { text: '🔥 HOT', tone: 'warn' } },
            ] },
          { type: 'Panel', id: 'emoji-cmp', props: {}, layout: { direction: 'row', gap: 24, padding: 12, align: 'center' },
            children: [
              { type: 'Label', id: 'emoji-cmp-a', props: { spans: [{ text: '自动图渲：', color: 'dim' }, { text: '🎲🎴🎯🏅' }] } },
              { type: 'Label', id: 'emoji-cmp-b', props: { text: 'raw 逃生保字形：🎲🎴🎯🏅', color: 'sub', raw: true } },
            ] },
          { type: 'Label', id: 't-emoji-note', props: { text: 'theme.emoji={base}（游戏级开关·美术图 vendor 进本地 served 目录=hermetic）；码点解析与 PA emoji-resolve 一致（★→⭐ 等符号走 alias）；逐 Label raw:true 保字形（代码块/刻意）。缺省不配=文本 emoji 零变化。', color: 'dim', size: 'xs' } },
        ] },
    ],
  };
}
