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
import { heroPortraitUri, type Suit } from './portraits.js';
import { DIZHI_ZODIACS, DIZHI_TIER_NM, DIZHI_TIER_CAP, DIZHI_INLAY_FAVOR, INLAY_MAX, inlayBonus, type InlayEntry } from './blueprint.js';
import { SUITS, RANKS } from './lobby-util.js';
import type { LobbyView } from './lobby-screen.js';

const zodOf = (b: string): typeof DIZHI_ZODIACS[number] | undefined => DIZHI_ZODIACS.find((z) => z.branch === b);

// ── 选中牌 → 就地弹出「附魔」子菜单 Modal（owner 2026-06-28 重设计：点牌即弹·不下沉到底部·更像游戏）──
// 结构：选中牌大图 + 战力/附魔 → 镶嵌槽（满 INLAY_MAX 槽·实心宝石可卸/空槽占位）→ 卡包地支可镶项（点即镶·消耗一张）→ 没地支给获取入口。
function enchantModal(view: LobbyView, idx: number): LayoutNode {
  const deck = view.deck; const inlays = view.inlays ?? {}; const bag = view.dizhiBag ?? {};
  const si = Math.floor(idx / 13), ri = idx % 13;
  const [su] = SUITS[si]; const rank = RANKS[ri];
  const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
  const inlaid = inlays[String(idx)] ?? [];
  const bonus = inlayBonus(inlaid);
  const fv = deck[idx] ?? 50;
  const full = inlaid.length >= INLAY_MAX;

  // 头：选中牌大图 + 战力（含附魔加成）。
  const header: LayoutNode = {
    type: 'Panel', id: 'ench-head', props: { bare: true }, layout: { direction: 'row', gap: 16, align: 'center', padding: 0 },
    children: [
      { type: 'PlayingCard', id: 'ench-head-card', props: { rank, suit: su, label: hero?.name, size: 'md',
        art: hero ? heroPortraitUri(su as Suit, hero.era, rank, hero.rar) : undefined } },
      { type: 'Panel', id: 'ench-head-meta', props: { bare: true }, layout: { direction: 'column', gap: 4, flex: 1 },
        children: [
          { type: 'Label', id: 'ench-head-fv', props: { size: 26, color: 'gold', bold: true, font: 'display', spans: [{ text: `${fv}` }, ...(bonus ? [{ text: ` (+${bonus})`, color: 'ok' as const, bold: true }] : [])] } },
          { type: 'Label', id: 'ench-head-l', props: { text: bonus ? '战力（底盘 + 地支附魔）' : '战力 · 镶地支可永久提升', size: 12, color: 'sub' } },
        ] },
    ],
  };

  // 镶嵌槽：INLAY_MAX 格·实心=已镶宝石(点卸下)·空=占位。
  const sockets: LayoutNode[] = [];
  for (let k = 0; k < INLAY_MAX; k++) {
    const e = inlaid[k] as InlayEntry | undefined;
    sockets.push(e
      ? { type: 'Tag', id: `ench-slot-${k}`, props: { label: `${zodOf(e.b)?.animal ?? e.b}·${DIZHI_TIER_NM[e.t]} ✕`, tone: 'accent', size: 'md', action: 'removeInlay', actionArg: `${idx}:${k}` } }
      : { type: 'Tag', id: `ench-slot-e${k}`, props: { label: '◇ 空槽', tone: 'dim', size: 'md' } });
  }

  const kids: LayoutNode[] = [
    header,
    { type: 'Divider', id: 'ench-div', props: {} },
    { type: 'Label', id: 'ench-slot-h', props: { text: `💎 镶嵌槽 ${inlaid.length}/${INLAY_MAX}　·　点已镶宝石卸下（永久消耗·不退卡包）`, size: 13, color: 'sub' } },
    { type: 'Panel', id: 'ench-slots', props: { bare: true }, layout: { direction: 'row', gap: 8, padding: 0, align: 'center' }, children: sockets },
  ];

  // 卡包可镶地支（点即镶·消耗一张）。没有 → 给「去商城抽地支」入口（owner：要有添加地支的方法）。
  const picks: LayoutNode[] = [];
  if (!full) {
    for (const z of DIZHI_ZODIACS) for (let t = DIZHI_TIER_CAP; t >= 1; t--) {
      const n = (bag[z.branch] ?? [])[t - 1] ?? 0;
      if (n > 0) picks.push({ type: 'Tag', id: `ench-pick-${z.branch}-${t}`,
        props: { label: `${z.animal}·${DIZHI_TIER_NM[t]} ×${Math.min(n, 3)} (+${DIZHI_INLAY_FAVOR[t]})`, tone: 'normal', size: 'md', action: 'inlay', actionArg: `${idx}:${z.branch}:${t}` } });
    }
    kids.push({ type: 'Label', id: 'ench-pick-h', props: { text: picks.length ? '🀄 点卡包里的地支镶入（消耗一张·真提升战力）：' : '卡包里没有地支了——去商城抽取：', size: 13, color: 'gold' } });
    if (picks.length) kids.push({ type: 'Panel', id: 'ench-picks', props: { bare: true }, layout: { direction: 'grid', minCol: 120, gap: 6, padding: 0 }, children: picks });
    else kids.push({ type: 'Button', id: 'ench-getdizhi', props: { label: '🛒 去商城抽地支', kind: 'primary', action: 'openShop' } });
  } else {
    kids.push({ type: 'Label', id: 'ench-pick-h', props: { text: '✅ 镶嵌槽已满（卸下一颗才能再镶）', size: 13, color: 'gold' } });
  }

  return {
    type: 'Modal', id: 'ench-modal', props: { title: `🔨 附魔 · ${rank}${su} ${hero?.name ?? ''}`, size: 'md', closeAction: 'craftClose' },
    children: [{ type: 'Panel', id: 'ench-modal-body', props: { bare: true }, layout: { direction: 'column', gap: 12, padding: 0 }, children: kids }],
  };
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
    // 保真：用 PlayingCard 原语（真扑克牌面 + 英雄立绘 + 名将名 + favor·镶嵌数 value + 选中金边）。
    return { type: 'PlayingCard', id: `ench-c-${idx}`,
      props: { rank, suit: su, label: hero?.name, value: n ? `${fv}·🀄${n}` : String(fv), fluid: true,
        art: hero ? heroPortraitUri(su as Suit, hero.era, rank, hero.rar) : undefined,
        selected: sel, action: 'craftSel', actionArg: String(idx) } };
  }));
  // 13 列 × 4 花色行（对齐原版 .ench-grid{repeat(13,1fr)}）+ fluid 卡填满格·零空隙。卡按花色主序生成→每花色自占一行。
  // 选牌不再下沉详情到底部（owner 2026-06-28）——改为就地弹 enchantModal（见 buildCraftScreen）。grid 标记选中态。
  const grid: LayoutNode = { type: 'Panel', id: 'ench-grid', props: { bare: true }, layout: { direction: 'grid', cols: 13, gap: 6, padding: 8 }, children: cards };
  return {
    type: 'Panel', id: 'craft-ench', props: { title: `🔨 地支牌 · 生肖镶嵌（附魔）· ≤${INLAY_MAX} 槽` }, layout: { direction: 'column', gap: 8, padding: 10, flex: 1 },
    children: [
      { type: 'Label', id: 'ench-note', props: { text: `点一张牌 → 弹出附魔台镶地支（铜 +${DIZHI_INLAY_FAVOR[1]} / 银 +${DIZHI_INLAY_FAVOR[2]} / 金 +${DIZHI_INLAY_FAVOR[3]} favor·消耗品·镶一张少一张·真提升战力）。`, size: 13, color: 'sub' } },
      grid,
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
      props: { title: `⚡ ${j.name}`, sub, corner: j.power ? '⭐'.repeat(Math.min(j.power, 5)) : `关${us}`, tone, action, actionArg } };
  });
  return {
    type: 'Panel', id: 'craft-shelf', props: { title: '⚡ 天罡牌 · 购买（局内法术·买入后到「牌组」屏编入）', scroll: true },
    layout: { direction: 'column', gap: 8, padding: 10 },
    children: [
      { type: 'Label', id: 'shelf-note', props: { text: '花金币买入天罡牌（解锁后入「拥有」）·关未到可花 💎 速解（跳 grind）。', size: 'md', color: 'sub' } },
      { type: 'Panel', id: 'shelf-grid', props: { bare: true }, layout: { direction: 'grid', minCol: 160, gap: 8 }, children: cards },
    ],
  };
}

/** 改造坊屏内容 → LayoutNode（纯数据）。craftSel 给附魔台选中牌（缺省 ''=未选）·选中则就地弹 enchantModal。 */
export function buildCraftScreen(view: LobbyView, craftSel = ''): LayoutNode {
  // 竖排（对齐原版改造坊）：附魔台（13×4 卡墙）在上、天罡购买货架在下；选中一张牌 → 弹出附魔 Modal（position:fixed 覆盖本页）。
  const selected = craftSel !== '' && view.deck[+craftSel] !== undefined;
  const children: LayoutNode[] = [enchantPanel(view, craftSel), tiangangShelf(view)];
  if (selected) children.push(enchantModal(view, +craftSel));
  return {
    type: 'Screen', id: 'craft-screen', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'column', padding: 16, gap: 12 },
    children,
  };
}

/** 挂载改造坊屏（MVU：选牌 craftSel → 改内部态 → ui.update·局部 diff。inlay/removeInlay/buyTiangang 等真改存档信号由 extra 注入）。 */
export function mountCraft(host: HTMLElement, getView: () => LobbyView, extra: HandlerMap = {}): { update: () => void; destroy: () => void } {
  let craftSel = '';
  const rebuild = (): void => ui.update(buildCraftScreen(getView(), craftSel));
  const handlers: HandlerMap = {
    craftSel: (k) => { craftSel = craftSel === k ? '' : (k ?? ''); rebuild(); },
    craftClose: () => { craftSel = ''; rebuild(); },
    ...extra,
  };
  const ui = mountUI(host, buildCraftScreen(getView(), craftSel), handlers, GG_LOBBY_THEME);
  return { update: rebuild, destroy: () => ui() };
}
