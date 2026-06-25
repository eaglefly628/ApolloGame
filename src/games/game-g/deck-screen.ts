// deck-screen.ts —— Game G 大厅「我的牌组」屏·数据驱动 pilot（Step B·接力 home/campaign/collection 范式）。
//
// 纯数据 `LayoutNode` + 引擎 `mountUI` + `GG_LOBBY_THEME`·零手写 DOM（红线·同 home-screen）。
// 顶部出战牌组选择条（selectDeck 信号）+ 引擎 Tabs 三子页：
//   ① 扑克牌库：52 牌卡格（4 花色 × 13）·点牌入/出出战库（≤16·MVU：pickCard→reducer→update）+ 费用曲线 ProgressBar + 一键/清空。
//   ② 天罡战法：当前出战这套的 ≤size 天罡槽（已入组卡 + 空槽计数）。
//   ③ 地支牌：12 生肖卡（铜/银/金档效果 + 卡包持有数）·养成图鉴展示。
// 诚实边界：原稿翻牌 3D/立绘 SVG 是 bespoke 美术，pilot 用 Card 媒体字形 + tone 近似；内容/构筑交互/换皮全数据化。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import { HERO_CARDS } from './hero-codex.js';
import { DIZHI_ZODIACS, DIZHI_TIER_NM, dizhiTopTier, dizhiTotal, deployCost, POKER_PICK_SIZE } from './blueprint.js';
import { SUITS, RANKS, SUIT_LETTER } from './lobby-util.js';
import type { LobbyView } from './lobby-screen.js';

// ── 顶部·出战牌组选择条 ────────────────────────────────────────
function deckSelector(view: LobbyView): LayoutNode {
  const decks = view.decks ?? [];
  const chips: LayoutNode[] = decks.map((d) => ({
    type: 'Tag', id: `deck-chip-${d.id}`,
    props: { label: `${d.active ? '⚔ ' : ''}${d.name} · 扑${d.pokerSize ?? 0}/罡${d.size}`, active: d.active, action: 'selectDeck', actionArg: d.id },
  }));
  if (view.canAddDeck) chips.push({ type: 'Button', id: 'deck-new', props: { label: '＋ 新建一套', kind: 'ghost', action: 'newDeck' } });
  return {
    type: 'Panel', id: 'deck-selector', props: { title: `🎖 我的出战牌组 · 一套 = ${view.pokerPickMax ?? POKER_PICK_SIZE} 扑克 + ${view.deckSize ?? 12} 天罡` },
    layout: { direction: 'row', gap: 8, padding: 12, align: 'center' }, children: chips.length ? chips : [{ type: 'Label', id: 'deck-none', props: { text: '暂无牌组', size: 'sm', color: 'dim' } }],
  };
}

// ── ① 扑克牌库（52 牌·点选构筑 + 费用曲线）──────────────────────
function costCurve(picks: Set<string>): LayoutNode {
  const byTier = [0, 0, 0, 0];
  for (const id of picks) byTier[deployCost(id.slice(0, -1))]++;
  const tierMax = Math.max(1, ...byTier);
  const TIER_LABEL = ['0 费', '1 费', '2 费', '3 费'];
  const bars: LayoutNode[] = byTier.map((cnt, t) => ({
    type: 'ProgressBar', id: `cc-${t}`,
    props: { value: cnt, max: tierMax, tone: 'gold', label: `${TIER_LABEL[t]} · ${cnt} 张`, showValue: false },
  }));
  return { type: 'Panel', id: 'poker-curve', props: { title: '放牌费用曲线（低费才铺得开场面）' }, layout: { direction: 'column', gap: 6, padding: 10 }, children: bars };
}

function pokerGrid(view: LobbyView, picks: Set<string>): LayoutNode {
  const rows: LayoutNode[] = SUITS.map(([su], si) => {
    const cards: LayoutNode[] = RANKS.map((rank, ri) => {
      const fv = view.deck[si * 13 + ri] ?? 50;
      const cardId = rank + (SUIT_LETTER[su] ?? 'S');
      const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
      const cost = deployCost(rank);
      const picked = picks.has(cardId);
      const tone: 'accent' | 'dim' | 'normal' = picked ? 'accent' : fv <= 50 ? 'dim' : 'normal';
      return {
        type: 'Card', id: `pc-${cardId}`,
        props: { title: `${rank}${su}`, sub: `${hero ? hero.name + ' · ' : ''}favor ${fv}`, corner: cost > 0 ? '💧'.repeat(cost) : '免',
          tone, action: 'pickCard', actionArg: cardId },
      };
    });
    return { type: 'Panel', id: `poker-row-${si}`, props: { title: su }, layout: { direction: 'grid', minCol: 96, gap: 6, padding: 8 }, children: cards };
  });
  return { type: 'Panel', id: 'poker-grid', props: { scroll: true }, layout: { direction: 'column', gap: 8, padding: 4 }, children: rows };
}

function pokerPage(view: LobbyView, picks: Set<string>): LayoutNode {
  const max = view.pokerPickMax ?? POKER_PICK_SIZE;
  const head: LayoutNode = {
    type: 'Panel', id: 'poker-head', props: {}, layout: { direction: 'row', gap: 8, padding: 10, align: 'center' },
    children: [
      { type: 'Label', id: 'poker-count', props: { text: `🎴 扑克牌库 ·「${view.activeDeckName ?? ''}」· 从 52 选 ${picks.size}/${max}`, size: 'md', color: picks.size === max ? 'gold' : 'sub', bold: true } },
      { type: 'Button', id: 'poker-auto', props: { label: '✨ 一键自动构筑', kind: 'ghost', action: 'autoBuildDeck' } },
      { type: 'Button', id: 'poker-clear', props: { label: '清空', kind: 'ghost', action: 'clearPicks' } },
    ],
  };
  return {
    type: 'Panel', id: 'deck-poker', props: {}, layout: { direction: 'column', gap: 8 },
    children: [head, costCurve(picks), pokerGrid(view, picks)],
  };
}

// ── ② 天罡战法（≤size 天罡槽）─────────────────────────────────
function tiangangPage(view: LobbyView): LayoutNode {
  const size = view.deckSize ?? 12;
  const inDeck = view.tiangangs.filter((j) => j.inDeck);
  const slots: LayoutNode[] = inDeck.map((j) => ({
    type: 'Card', id: `tg-${j.id}`, props: { title: `${j.icon ?? '⚡'} ${j.name}`, sub: j.sub, corner: j.power ? '⭐'.repeat(Math.min(j.power, 5)) : undefined, tone: 'accent', action: 'toggleTiangang', actionArg: j.id },
  }));
  const emptyN = Math.max(0, size - inDeck.length);
  for (let i = 0; i < emptyN; i++) slots.push({ type: 'Card', id: `tg-empty-${i}`, props: { title: '＋', sub: '空槽 · 点添加', tone: 'dim', action: 'deckAdd' } });
  return {
    type: 'Panel', id: 'deck-tiangang', props: { title: `⚡ 天罡战法 ·「${view.activeDeckName ?? ''}」· ${inDeck.length}/${size}（局内法术）`, scroll: true },
    layout: { direction: 'column', gap: 8, padding: 10 },
    children: [
      { type: 'Label', id: 'tg-note', props: { text: '当前出战这套的天罡：已入组点✕移出·空槽点添加（从已拥有里选）·或一键配置。', size: 'xs', color: 'sub' } },
      { type: 'Button', id: 'tg-auto', props: { label: '✨ 一键配置天罡', kind: 'ghost', action: 'autoBuildTiangang' } },
      { type: 'Panel', id: 'tg-slots', props: {}, layout: { direction: 'grid', minCol: 150, gap: 8 }, children: slots },
    ],
  };
}

// ── ③ 地支牌（12 生肖养成图鉴）─────────────────────────────────
function dizhiPage(view: LobbyView): LayoutNode {
  const bag = view.dizhiBag ?? {};
  const ownedN = DIZHI_ZODIACS.filter((z) => dizhiTotal(bag[z.branch]) > 0).length;
  const cards: LayoutNode[] = DIZHI_ZODIACS.map((z) => {
    const total = dizhiTotal(bag[z.branch]);
    const top = dizhiTopTier(bag[z.branch]);
    const held = total >= 1 ? `持 ${total} 张 · 最高 ${DIZHI_TIER_NM[top]}` : '卡包中无';
    return {
      type: 'Card', id: `dz-${z.branch}`,
      props: { title: `${z.branch} ${z.animal} · ${z.symbol}`, sub: `${held}　|　铜:${z.bronze}`, tone: (total >= 1 ? 'accent' : 'normal') as 'accent' | 'normal' },
    };
  });
  return {
    type: 'Panel', id: 'deck-dizhi', props: { title: `🀄 地支牌 · 卡包 ${ownedN}/12 生肖（满 3 同档自动升档 铜→银→金）`, scroll: true },
    layout: { direction: 'column', gap: 8, padding: 10 },
    children: [
      { type: 'Label', id: 'dz-note', props: { text: '地支=消耗牌（镶进扑克牌附魔·镶一张少一张）·抽卡获取（🛒商城）。三合/六合连携待战斗实装。', size: 'xs', color: 'sub' } },
      { type: 'Panel', id: 'dz-grid', props: {}, layout: { direction: 'grid', minCol: 200, gap: 8 }, children: cards },
    ],
  };
}

/** 牌组屏内容 → LayoutNode（纯数据）。Tabs 托管三子页；picks 给扑克构筑选中态（缺省取 view.pokerPicks）。 */
export function buildDeckScreen(view: LobbyView, picks?: Set<string>): LayoutNode {
  const p = picks ?? new Set(view.pokerPicks ?? []);
  const tabs: LayoutNode = {
    type: 'Tabs', id: 'deck-tabs',
    props: { tabs: [{ id: 'poker', label: '🎴 扑克牌库' }, { id: 'tiangang', label: '⚡ 天罡战法' }, { id: 'dizhi', label: '🀄 地支牌' }] },
    layout: { flex: 1 }, children: [pokerPage(view, p), tiangangPage(view), dizhiPage(view)],
  };
  return {
    type: 'Screen', id: 'deck-screen', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'column', padding: 16, gap: 10 }, children: [deckSelector(view), tabs],
  };
}

/** 挂载牌组屏（MVU：扑克 pickCard/清空/一键 → 改内部 picks → ui.update·局部 diff·Tabs 切页态由引擎守）。 */
export function mountDeck(host: HTMLElement, getView: () => LobbyView, extra: HandlerMap = {}): { update: () => void; destroy: () => void } {
  let picks = new Set(getView().pokerPicks ?? []);
  const max = getView().pokerPickMax ?? POKER_PICK_SIZE;
  const rebuild = (): void => ui.update(buildDeckScreen(getView(), picks));
  const handlers: HandlerMap = {
    pickCard: (k) => { if (!k) return; if (picks.has(k)) picks.delete(k); else if (picks.size < max) picks.add(k); rebuild(); },
    clearPicks: () => { picks = new Set(); rebuild(); },
    ...extra,
  };
  const ui = mountUI(host, buildDeckScreen(getView(), picks), handlers, GG_LOBBY_THEME);
  return { update: rebuild, destroy: () => ui() };
}
