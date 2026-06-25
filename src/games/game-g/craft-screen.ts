// craft-screen.ts —— Game G 大厅「改造坊」屏·数据驱动 pilot（Step B 收官·接力 home/campaign/collection/deck 范式）。
//
// 纯数据 `LayoutNode` + 引擎 `mountUI` + `GG_LOBBY_THEME`·零手写 DOM（红线·同 home-screen）。
// 左：地支附魔台（52 牌 ench 卡格 → 选一张 craftSel → 详情：已镶槽 removeInlay + 卡包可镶项 inlay）·MVU：选牌→reducer→update。
// 右：天罡牌购买货架（金币 buyTiangang / 关未到 💎 diamondUnlock / 已拥有展示）。
// 诚实边界：原稿镶嵌槽/牌面立绘是 bespoke 美术，pilot 用 Card + Label 近似；内容/选牌交互/换皮全数据化。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import { HERO_CARDS } from './hero-codex.js';
import { DIZHI_ZODIACS, DIZHI_TIER_NM, DIZHI_TIER_CAP, DIZHI_INLAY_FAVOR, INLAY_MAX, inlayBonus, type InlayEntry } from './blueprint.js';
import { SUITS, RANKS } from './lobby-util.js';
import type { LobbyView } from './lobby-screen.js';

const zodOf = (b: string): typeof DIZHI_ZODIACS[number] | undefined => DIZHI_ZODIACS.find((z) => z.branch === b);

// ── 选中牌的附魔详情（已镶槽 + 卡包可镶项）────────────────────────
function buildEnchantDetail(view: LobbyView, idx: number): LayoutNode {
  const deck = view.deck; const inlays = view.inlays ?? {}; const bag = view.dizhiBag ?? {};
  const si = Math.floor(idx / 13), ri = idx % 13;
  const [su] = SUITS[si]; const rank = RANKS[ri];
  const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
  const inlaid = inlays[String(idx)] ?? [];
  const bonus = inlayBonus(inlaid);
  const full = inlaid.length >= INLAY_MAX;

  const kids: LayoutNode[] = [
    { type: 'Label', id: 'ench-sel-card', props: { text: `${rank}${su}　${hero?.name ?? ''}　favor ${deck[idx] ?? 50}${bonus ? `（含附魔 +${bonus}）` : ''}`, size: 'md', color: 'gold', bold: true } },
    { type: 'Label', id: 'ench-slot-h', props: { text: `镶嵌槽（${inlaid.length}/${INLAY_MAX}）· 点已镶项卸下（永久消耗·不退卡包）`, size: 'xs', color: 'sub' } },
  ];
  if (inlaid.length) inlaid.forEach((e: InlayEntry, k) => kids.push({ type: 'Tag', id: `ench-slot-${k}`,
    props: { label: `${zodOf(e.b)?.animal ?? e.b}·${DIZHI_TIER_NM[e.t]} ✕`, tone: 'accent', action: 'removeInlay', actionArg: `${idx}:${k}` } }));
  else kids.push({ type: 'Label', id: 'ench-slot-empty', props: { text: '（空·尚未镶嵌）', size: 'xs', color: 'dim' } });

  kids.push({ type: 'Label', id: 'ench-pick-h', props: { text: full ? '槽位已满' : '点卡包里的地支镶入（消耗一张）：', size: 'xs', color: full ? 'gold' : 'sub' } });
  if (!full) {
    let any = false;
    for (const z of DIZHI_ZODIACS) for (let t = DIZHI_TIER_CAP; t >= 1; t--) {
      const n = (bag[z.branch] ?? [])[t - 1] ?? 0;
      if (n > 0) { any = true; kids.push({ type: 'Tag', id: `ench-pick-${z.branch}-${t}`,
        props: { label: `${z.animal}·${DIZHI_TIER_NM[t]} ×${Math.min(n, 3)} (+${DIZHI_INLAY_FAVOR[t]})`, tone: 'normal', action: 'inlay', actionArg: `${idx}:${z.branch}:${t}` } }); }
    }
    if (!any) kids.push({ type: 'Label', id: 'ench-pick-none', props: { text: '卡包里没有地支了 · 去「🛒商城」抽卡获取', size: 'xs', color: 'dim' } });
  }
  return { type: 'Panel', id: 'ench-detail', props: { title: '附魔详情', scroll: true }, layout: { direction: 'column', gap: 6, padding: 12, width: 320 }, children: kids };
}

// ── 左·地支附魔台（52 牌 ench 卡格 + 详情）──────────────────────
function enchantPanel(view: LobbyView, craftSel: string): LayoutNode {
  const deck = view.deck; const inlays = view.inlays ?? {};
  const cards: LayoutNode[] = SUITS.flatMap(([su], si) => RANKS.map((rank, ri) => {
    const idx = si * 13 + ri;
    const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
    const fv = deck[idx] ?? 50;
    const n = (inlays[String(idx)] ?? []).length;
    const sel = craftSel === String(idx);
    // 保真：用 PlayingCard 原语（真扑克牌面·名将名 + favor·镶嵌数 value + 选中金边）。
    return { type: 'PlayingCard', id: `ench-c-${idx}`,
      props: { rank, suit: su, label: hero?.name, value: n ? `${fv}·🀄${n}` : String(fv),
        selected: sel, action: 'craftSel', actionArg: String(idx) } };
  }));
  const grid: LayoutNode = { type: 'Panel', id: 'ench-grid', props: { scroll: true }, layout: { direction: 'grid', minCol: 76, gap: 6, padding: 8, flex: 1 }, children: cards };
  const detail: LayoutNode = (craftSel !== '' && deck[+craftSel] !== undefined)
    ? buildEnchantDetail(view, +craftSel)
    : { type: 'Panel', id: 'ench-detail', props: { title: '附魔详情' }, layout: { width: 320, padding: 12 },
        children: [{ type: 'Label', id: 'ench-detail-empty', props: { text: '← 选一张牌，给它镶地支附魔（消耗卡包·镶一张少一张·真提升 favor）', size: 'sm', color: 'dim' } }] };
  return {
    type: 'Panel', id: 'craft-ench', props: { title: `🔨 地支牌 · 生肖镶嵌（附魔）· ≤${INLAY_MAX} 槽` }, layout: { direction: 'column', gap: 8, padding: 10, flex: 1 },
    children: [
      { type: 'Label', id: 'ench-note', props: { text: `铜 +${DIZHI_INLAY_FAVOR[1]} / 银 +${DIZHI_INLAY_FAVOR[2]} / 金 +${DIZHI_INLAY_FAVOR[3]} favor · 消耗品：镶一张少一张 · 真提升战力。`, size: 'xs', color: 'sub' } },
      { type: 'Panel', id: 'ench-row', props: {}, layout: { direction: 'row', gap: 12, flex: 1 }, children: [grid, detail] },
    ],
  };
}

// ── 右·天罡牌购买货架 ──────────────────────────────────────────
function tiangangShelf(view: LobbyView): LayoutNode {
  const cards: LayoutNode[] = view.tiangangs.map((j) => {
    const us = j.unlockStage ?? 1;
    let sub: string; let tone: 'accent' | 'locked' | 'normal'; let action: string | undefined; let actionArg: string | undefined;
    if (j.owned) { sub = `✓ 已解锁${j.inDeck ? ' · ⚔ 已入组' : ''}`; tone = 'accent'; }
    else if (j.locked) { sub = `🔒 通关第 ${us} 关解锁（💎${us} 速解）`; tone = 'locked'; action = 'diamondUnlock'; actionArg = j.id; }
    else { sub = `🪙 ${j.cost}`; tone = 'normal'; action = 'buyTiangang'; actionArg = j.id; }
    return { type: 'Card', id: `craft-tg-${j.id}`,
      props: { title: `${j.icon ?? '⚡'} ${j.name}`, sub, corner: j.power ? '⭐'.repeat(Math.min(j.power, 5)) : `关${us}`, tone, action, actionArg } };
  });
  return {
    type: 'Panel', id: 'craft-shelf', props: { title: '⚡ 天罡牌 · 购买（局内法术·买入后到「牌组」屏编入）', scroll: true },
    layout: { direction: 'column', gap: 8, padding: 10, width: 360 },
    children: [
      { type: 'Label', id: 'shelf-note', props: { text: '花金币买入天罡牌（解锁后入「拥有」）·关未到可花 💎 速解（跳 grind）。', size: 'xs', color: 'sub' } },
      { type: 'Panel', id: 'shelf-grid', props: {}, layout: { direction: 'grid', minCol: 160, gap: 8 }, children: cards },
    ],
  };
}

/** 改造坊屏内容 → LayoutNode（纯数据）。craftSel 给附魔台选中牌（缺省 ''=未选）。 */
export function buildCraftScreen(view: LobbyView, craftSel = ''): LayoutNode {
  return {
    type: 'Screen', id: 'craft-screen', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'row', padding: 16, gap: 12 },
    children: [enchantPanel(view, craftSel), tiangangShelf(view)],
  };
}

/** 挂载改造坊屏（MVU：选牌 craftSel → 改内部态 → ui.update·局部 diff。inlay/removeInlay/buyTiangang 等真改存档信号由 extra 注入）。 */
export function mountCraft(host: HTMLElement, getView: () => LobbyView, extra: HandlerMap = {}): { update: () => void; destroy: () => void } {
  let craftSel = '';
  const rebuild = (): void => ui.update(buildCraftScreen(getView(), craftSel));
  const handlers: HandlerMap = {
    craftSel: (k) => { craftSel = craftSel === k ? '' : (k ?? ''); rebuild(); },
    ...extra,
  };
  const ui = mountUI(host, buildCraftScreen(getView(), craftSel), handlers, GG_LOBBY_THEME);
  return { update: rebuild, destroy: () => ui() };
}
