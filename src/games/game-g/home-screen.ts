// home-screen.ts —— Game G 大厅「主页」屏·数据驱动 pilot（owner 2026-06-23）。
//
// 用引擎 Apollo UI 层（`LayoutNode` 纯数据 + `mountUI` 解释器 + `GG_LOBBY_THEME` 换皮令牌）重写主页。
// 红线（同 game-i）：本文件**只产数据 + 接信号**，不写一行 HTML/DOM 模板。证明 game-g UI 可落「纯数据 + 引擎固定解释器」。
//
// 诚实边界：原主页的「绿呢牌桌 / 旋转对决卡 / vignette」是 bespoke 视觉，数据驱动控件集只能近似——
// 本 pilot 把主页的**内容 / 交互 / 换皮**全部数据化（标题/Boss 情报/今日卦象/出征 CTA/地煞），
// 那层 flourish 视觉留作后续 bespoke 渲染层（关注点分离·见 docs apollo-ui 移植契约）。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import type { LobbyView } from './lobby-screen.js';

/** 主页内容 → LayoutNode（纯数据）。view 给关卡/Boss/卦象/资源；交互全走 action 信号：play(出征)/man(手册)/lucky(卦象)。 */
export function buildHomeScreen(view: LobbyView): LayoutNode {
  const c = view.campaign;
  const keptFortune = view.fortune?.keptVal;

  // 左栏·戏牌台：今日卦象 + 标题 + 对决牌(近似) + 出征 CTA + 手册。
  const felt: LayoutNode = {
    type: 'Panel', id: 'home-felt', props: { title: '' },
    layout: { direction: 'column', align: 'center', gap: 14, padding: 22, flex: 1 },
    children: [
      { type: 'Button', id: 'home-fortune',
        props: { label: keptFortune != null ? `🎴 今日卦象 · ${keptFortune}` : '🎴 掷今日卦象', kind: 'ghost', action: 'lucky' } },
      { type: 'Label', id: 'home-title',
        props: { text: c ? `第 ${c.stage} 关 · ${c.battle}` : '戏牌师', size: 'xl', color: 'gold', bold: true } },
      { type: 'Label', id: 'home-sub',
        props: { text: c ? `执掌命运之人 · 挑战被诅咒的 ${c.boss}` : view.stageLabel, size: 'sm', color: 'sub' } },
      // 对决牌（原 bespoke 绿呢旋转 A♠ → 数据里用一张 Card 近似表达·点它=掷卦）
      { type: 'Card', id: 'home-duel',
        props: { title: 'A ♠', sub: c ? `⚔ 对决 ${c.boss}` : '掷命之牌', tone: 'accent', action: 'lucky' },
        layout: { width: 150 } },
      { type: 'Label', id: 'home-duelline',
        props: { text: c ? c.oneLiner : '', size: 'xs', color: 'dim' } },
      { type: 'Button', id: 'home-play',
        props: { label: c ? `⚔ 出征 · 第 ${c.stage} 关` : `⚔ 出征 · ${view.rankText}`, kind: 'primary', action: 'play' } },
      { type: 'Button', id: 'home-man', props: { label: '📖 玩法手册', kind: 'ghost', action: 'man' } },
    ],
  };

  // 右栏·Boss 情报 + 地煞（明牌可破）。每张地煞 = Tooltip(说明) 裹一张 Card。
  const fiendNodes: LayoutNode[] = (c?.fiends ?? []).map((fd, i) => ({
    type: 'Tooltip', id: `home-fiend-${i}`, props: { content: fd.desc, placement: 'left' },
    children: [{ type: 'Card', id: `home-fiend-c-${i}`, props: { title: `🎴 ${fd.name}`, sub: fd.desc, tone: 'normal' } }],
  }));
  const rail: LayoutNode = {
    type: 'Panel', id: 'home-rail', props: { title: `⚔ 本关 Boss · ${c?.boss ?? '—'}`, scroll: true },
    layout: { direction: 'column', gap: 8, padding: 16, width: 320 },
    children: [
      { type: 'Label', id: 'home-boss-diff',
        props: { text: c ? `难度 ${'★'.repeat(c.stars)} · ${c.oneLiner}` : '', size: 'sm', color: 'gold' } },
      { type: 'Label', id: 'home-fiend-h',
        props: { text: '🎴 地煞（明牌 · 公平可破）— Boss 招牌历史战术：', size: 'xs', color: 'sub' } },
      ...fiendNodes,
      { type: 'Label', id: 'home-unlock',
        props: { text: c ? `🏆 打赢 = 破其诅咒 · 通关解锁天罡 ${c.unlock}` : '', size: 'xs', color: 'gold' } },
      { type: 'Label', id: 'home-ghost',
        props: { text: '好友切磋 / 天梯 1v1 待接网络。当前 = 单人 52 战役 vs AI 庄家。', size: 'xs', color: 'dim' } },
    ],
  };

  return {
    type: 'Screen', id: 'home-screen', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'row', gap: 16, padding: 16 },
    children: [felt, rail],
  };
}

/** 挂载主页（MVU：mountUI 一次 → 改状态走 update(buildHomeScreen(getView()))·局部 diff·不整树重挂）。返回 update/destroy。 */
export function mountHome(host: HTMLElement, getView: () => LobbyView, handlers: HandlerMap): { update: () => void; destroy: () => void } {
  const ui = mountUI(host, buildHomeScreen(getView()), handlers, GG_LOBBY_THEME);
  return { update: () => ui.update(buildHomeScreen(getView())), destroy: () => ui() };
}
