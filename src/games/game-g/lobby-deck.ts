// Game G · 牌组构筑/收藏渲染（地支收藏区 + 52 扑克构筑网格 + 费用头 + 通用货架条目·拆分自 lobby-screen.ts）。
import { esc, SUITS, RANKS, SUIT_LETTER, ENCH_TIER_CLR, KIND_LABEL, ggTip, tipRow, type EarthRarity } from './lobby-util.js';
import { GI } from './icons.js';
import { heroPortrait } from './portraits.js';
import { HERO_CARDS, DIZHI_ZODIACS, DIZHI_TRINES, DIZHI_PAIRS, DIZHI_TIER_NM, DIZHI_TIER_CAP, dizhiTopTier, dizhiTotal, deployCost, POKER_PICK_SIZE, INLAY_MAX, type InlayEntry } from './blueprint.js';
import type { LobbyView, LobbyShopItem } from './lobby-screen.js';

const RARITY_CLR: Record<EarthRarity, string> = { bronze: '#cd7f32', silver: '#c4ccd6', gold: '#e8cd82' };
const RARITY_LBL: Record<EarthRarity, string> = { bronze: '铜', silver: '银', gold: '金' };

// 地支 codex（doc20 §三 + doc23 §五 · 美术 zodiac.json）：12 生肖 × 铜银金三档 + 牌背传说 + 三合连携。
// 镶嵌/揉获取/连携 gameplay 待契约④（甲战斗侧 apply）；此处为养成图鉴展示（图标真接美术库 twemoji）。
// 地支卡包（owner 2026-06-21 消耗品模型）：每生肖按档位计活化数 [铜,银,金]·满3自动升档·钻/史待开放·镶一张少一张。
export function earthSection(filter: string, bag: Record<string, number[]> = {}): string {
  const TIER_CLR = ['', '#cd7f32', '#c4ccd6', '#e8cd82', '#7fd0ff', '#bf6bff']; // 铜银金钻史
  const tier = (z: typeof DIZHI_ZODIACS[number], r: EarthRarity, eff: string, n: number): string =>
    `<div class="ecard r-${r}${n > 0 ? ' have' : ''}" title="${esc(eff)}"><div style="font-size:10px;font-weight:700;color:${RARITY_CLR[r]}">${RARITY_LBL[r]}${n > 0 ? ` ×${Math.min(n, 3)}` : ''}</div><div style="font-size:11px;color:var(--ink-dim);line-height:1.5">${esc(eff)}</div></div>`;
  const TIER_IDX: Record<EarthRarity, number> = { bronze: 1, silver: 2, gold: 3 };
  const cntOf = (b: string, t: number): number => (bag[b] ?? [])[t - 1] ?? 0;
  const ownedN = DIZHI_ZODIACS.filter((z) => dizhiTotal(bag[z.branch]) > 0).length;
  const totalCards = DIZHI_ZODIACS.reduce((s, z) => s + dizhiTotal(bag[z.branch]), 0);
  // 单生肖持有徽：各档 ×n 小数字（最多显示3个/档·满3已自动并上一档）+ 钻/史 待开放占位。
  const cntSty = (clr: string): string => `display:inline-flex;align-items:center;gap:2px;padding:1px 7px;border-radius:99px;border:1px solid ${clr};color:${clr};font-size:11px;font-weight:700;background:rgba(0,0,0,.12)`;
  const heldChips = (b: string): string => {
    const cells: string[] = [];
    for (let t = 1; t <= DIZHI_TIER_CAP; t++) { const n = cntOf(b, t); if (n > 0) cells.push(`<span style="${cntSty(TIER_CLR[t])}">${DIZHI_TIER_NM[t]} ×${Math.min(n, 3)}</span>`); }
    cells.push(`<span style="${cntSty('var(--ink-dim)')};opacity:.6" title="钻石档·待开放">钻 🔒</span>`);
    return cells.join('');
  };
  const groups = DIZHI_ZODIACS.map(z => {
    const total = dizhiTotal(bag[z.branch]);
    const top = dizhiTopTier(bag[z.branch]); // 1铜2银3金 · 0无
    const tiers: [EarthRarity, string][] = [['bronze', z.bronze], ['silver', z.silver], ['gold', z.gold]];
    const shown = filter === 'all' ? tiers : tiers.filter(([r]) => r === filter);
    const cs = shown.map(([r, eff]) => tier(z, r, eff, cntOf(z.branch, TIER_IDX[r]))).join('');
    const ownBadge = total >= 1
      ? `<span class="zo-own" style="color:${TIER_CLR[top]}">持有 ${total} 张 · 最高 ${DIZHI_TIER_NM[top]}</span>`
      : `<span class="zo-own" style="color:var(--ink-dim)">卡包中无</span>`;
    return `<div class="earth-group${total >= 1 ? ' owned' : ''}"><div class="earth-group-hd"><img class="zo-icon" src="${z.png}" alt="${z.animal}" loading="lazy"><span class="earth-branch">${z.branch}</span><span style="font-size:13px;color:var(--ink)">${z.animal}</span><span style="font-size:11px;color:var(--ink-dim)">· ${z.symbol}</span>${ownBadge}</div><div class="earth-legend">${esc(z.legend)}</div><div class="zo-slots"><span class="note" style="margin:0;font-size:10px">卡包：</span>${total >= 1 ? heldChips(z.branch) : '<span class="ghost" style="font-size:11px">空 · 去🛒商城抽卡</span>'}</div>${cs ? `<div class="earth-cards">${cs}</div>` : ''}</div>`;
  }).join('');
  const invChips = DIZHI_ZODIACS.filter((z) => dizhiTotal(bag[z.branch]) > 0)
    .map((z) => { const top = dizhiTopTier(bag[z.branch]); const n = dizhiTotal(bag[z.branch]); const cl = TIER_CLR[top]; return `<span class="dz-inv-chip" style="border-color:${cl};color:${cl}">${z.animal} ×${n}${n > 1 ? '' : ''}·${DIZHI_TIER_NM[top]}</span>`; }).join('');
  const header = `<div class="note" style="text-align:left;margin-bottom:8px">🀄 我的地支卡包 <b style="color:var(--gold)">${ownedN}/12</b> 生肖 · 共 <b style="color:var(--gold)">${totalCards}</b> 张活化 · 抽卡获取（🛒商城）· 满 3 同档自动升档 铜→银→金（钻/史待开放）</div>
    <div class="dz-inv">🎴 地支=<b>消耗牌</b>（镶一张少一张·永久消耗）：<b style="color:var(--gold)">${totalCards}</b> 张　${invChips || '<span class="ghost">暂无 · 去「🛒商城」抽卡获取</span>'}</div>`;
  const trineRow = (t: { name: string; members: string; effect: string }): string =>
    `<div class="trine-row"><b style="color:var(--gold);min-width:120px">${t.name}</b><span style="color:var(--ink-dim);min-width:120px">${esc(t.members)}</span><span style="color:var(--ink)">${esc(t.effect)}</span></div>`;
  const trines = DIZHI_TRINES.map(trineRow).join('');
  const pairs = DIZHI_PAIRS.map(trineRow).join('');
  return `${header}<div class="earth-groups">${groups}</div>
    <div style="margin-top:14px"><div style="font-family:var(--fh);font-size:14px;color:var(--gold);margin-bottom:8px">🔗 三合连携（镶满 3 颗同组 · 强力质变 · 待战斗实装）</div>${trines}</div>
    <div style="margin-top:14px"><div style="font-family:var(--fh);font-size:14px;color:var(--gold);margin-bottom:8px">🔗 二合连携 · 六合（两颗相合 · 门槛低·效果轻 · 待战斗实装）</div>${pairs}</div>`;
}

export function deckGrid(deck: number[], foils?: LobbyShopItem[], picks?: Set<string>, inlays?: Record<string, InlayEntry[]>): string {
  const ownedFoilNames = (foils ?? []).filter(f => f.owned).map(f => f.name);
  const foilBack = ownedFoilNames.length
    ? `<div style="font-size:9px;color:var(--gold)">✨${esc(ownedFoilNames.join('+'))}</div>` : '';
  const pickMode = !!picks; // 传 picks=进入构筑选牌模式（卡可点入/出战组·亮选中态·画费用角标）
  return SUITS.map(([su, c], si) => {
    const cards = Array.from({ length: 13 }, (_, ri) => {
      const fv = deck[si * 13 + ri] ?? 50;
      const rank = RANKS[ri];
      // 每张牌 = 一位名将（doc23 · 52 张全对应）：花色+点数 → 英雄
      const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
      const cardId = rank + (SUIT_LETTER[su] ?? 'S'); // 卡 id（'AS'/'10D'…·与 pokerPicks/blueprint 同口径）
      const picked = pickMode && picks.has(cardId);
      const cost = deployCost(rank); // 放牌费用角标（契约 B·doc14 §九）
      const isFace = ri <= 3;
      const qual = fv >= 70 ? '强' : fv >= 58 ? '良' : fv <= 50 ? '弱' : '中';
      const qualColor = fv >= 70 ? 'var(--gold)' : fv >= 58 ? 'var(--club)' : fv <= 50 ? 'var(--ink-dim)' : 'var(--ink)';
      const cls = 'pcard' + (fv >= 70 ? ' leg' : '') + (fv <= 50 ? ' lock' : '') + (picked ? ' picked' : '');
      const faceStyle = isFace ? `border-color:${c}90;` : '';
      // 放牌费用画成「源泉水滴」(owner 2026-06-21)：1/2/3 滴蓝水滴；0 费=免（不再是个挡字的数字）。
      const costBadge = pickMode ? `<span class="pcard-cost" title="放牌费用 ${cost} 源泉">${cost > 0 ? '💧'.repeat(cost) : '免'}</span>` : '';
      const pickMark = pickMode ? '<span class="pcard-pick">✓</span>' : ''; // 常驻·选中态由 .picked 控制显隐（定点切类·不重建）
      // 牌库内附魔小徽标（owner 2026-06-21·E）：点它弹单牌附魔编辑·不影响选牌点击（自带 data-act·closest 命中徽标本身）。
      const inlayN = (inlays?.[String(si * 13 + ri)] ?? []).length;
      const enchBadge = pickMode ? `<span class="pcard-ench${inlayN ? ' on' : ''}" data-act="enchSel" data-k="${si * 13 + ri}" title="地支附魔（镶 ${inlayN}/${INLAY_MAX}）">🀄${inlayN || ''}</span>` : '';
      // 正面（front）：花色水印 + 该将立绘剪影（全 52 张统一）+ 点数 + 将名 + favor
      const front = `<div class="pcard-front">` +
        `<div class="pcard-wm" style="color:${c};font-size:24px;opacity:.07">${su}</div>` +
        (hero ? `<div class="pcard-portrait">${heroPortrait(hero.suit, hero.era, hero.rank, hero.rar)}</div>` : '') +
        `<div class="r" style="color:${c}">${rank}</div>` +
        (hero ? `<div class="pcard-lbl" style="color:${c};opacity:.82">${esc(hero.name)}</div>` : '') +
        `<span class="own">${fv}</span>${costBadge}${pickMark}${enchBadge}` +
      `</div>`;
      // 背面（back）：翻面看这位名将的身份 + favor（全 52 张统一·不再"有的有字有的没字"）
      const back = `<div class="pcard-back">` +
        `<div style="font-size:12px;font-weight:700;color:${c}">${su}${rank}</div>` +
        (hero ? `<div class="pcard-bk-nm">${esc(hero.name)}</div><div class="pcard-bk-tt">${esc(hero.title)}</div>` : '') +
        `<div style="font-size:8px;color:var(--ink-dim);margin-top:2px">favor</div>` +
        `<div style="font-size:13px;font-weight:700;color:${qualColor};line-height:1">${fv}</div>` +
        `<div style="font-size:8px;color:${qualColor}">${qual}</div>` +
        foilBack +
      `</div>`;
      // 构筑模式：整卡可点 → pickCard 切入/出战组。满槽的置灰由容器 .full 类管（定点·不重建）。非构筑：纯展示。
      const wrapAttr = pickMode ? ` data-act="pickCard" data-k="${cardId}" style="cursor:pointer"` : '';
      return `<div class="pcard-wrap${picked ? ' is-picked' : ''}"${wrapAttr} title="${esc(su + rank + (hero ? ' · ' + hero.name + '「' + hero.title + '」' : '') + ' · favor ' + fv + ' · 费 ' + cost)}">` +
        `<div class="${cls}" style="${faceStyle}">${front}${back}</div>` +
      `</div>`;
    }).join('');
    return `<div class="suit-row"><div class="suit-hd" style="color:${c}">${su}</div><div class="suit-line">${cards}</div></div>`;
  }).join('');
}
// 构筑屏「动态头」（计数 + 一键/清空 + 费用曲线）：随选牌变化·定点重渲（pbuild-head innerHTML），不重建 52 网格、不跳屏。
export function pokerBuildHead(view: LobbyView): string {
  const max = view.pokerPickMax ?? POKER_PICK_SIZE;
  const picks = new Set(view.pokerPicks ?? []);
  const n = picks.size;
  const byTier = [0, 0, 0, 0];
  for (const id of picks) byTier[deployCost(id.slice(0, -1))]++;
  const tierMax = Math.max(1, ...byTier);
  const TIER_LABEL = ['0 费', '1 费', '2 费', '3 费'];
  const TIER_COLOR = ['var(--club)', 'var(--ink)', 'var(--diamond)', 'var(--gold)'];
  const curve = byTier.map((cnt, t) => `<div class="cc-col" title="${TIER_LABEL[t]} · ${cnt} 张"><div class="cc-bar" style="height:${Math.round((cnt / tierMax) * 100)}%;background:${TIER_COLOR[t]}"></div><div class="cc-n">${cnt}</div><div class="cc-l">${TIER_LABEL[t]}</div></div>`).join('');
  const okColor = n === max ? 'var(--gold)' : 'var(--ink-dim)';
  return `<h2 style="margin:0">🎴 扑克牌库 ·「<b style="color:var(--gold)">${esc(view.activeDeckName ?? '')}</b>」· 从 52 选 <b style="color:${okColor}">${n}/${max}</b>
    <span style="display:flex;gap:8px;margin-left:auto">
      <button class="cta-sub" data-act="autoBuildDeck" data-anchor="autobuild-poker" title="按费用曲线+偏好已养成自动凑一副">✨ 一键自动构筑</button>
      <button class="cta-sub" data-act="clearPicks" title="清空已选">清空</button>
    </span></h2>
    <div class="cost-curve" title="放牌费用曲线（别全大点·低费才铺得开场面）" style="margin-top:10px">${curve}</div>`;
}
// 出战扑克牌组构筑屏（乙1·DEV-CHECKLIST §3）：从 52 池点选 ≤16 张入战斗牌库；费用曲线柱 + 一键自动构筑 + 清空。
export function pokerBuildPanel(view: LobbyView): string {
  const max = view.pokerPickMax ?? POKER_PICK_SIZE;
  const picks = new Set(view.pokerPicks ?? []);
  const full = picks.size >= max;
  return `<div class="card"><div class="pbuild-head">${pokerBuildHead(view)}</div>
    <div class="note" style="text-align:left;margin:9px 0 4px">点牌入/出 <b>出战牌库</b>（满 ${max} 张）。左下角数字＝<b>放牌费用</b>（点 2-4=0 / 5-7=1 / 8-10=2 / JQKA=3）。<b style="color:var(--gold)">✓</b>＝已入战库；favor 越高越能扛掷命。带进下一场战斗的就是这 ${max} 张。</div>
    <div class="pbuild-grid${full ? ' full' : ''}">${deckGrid(view.deck, view.foils, picks, view.inlays)}</div></div>`;
}
export function shopItem(act: string, glyph: string, it: LobbyShopItem): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  const attr = it.buyable && !it.owned ? ` data-act="${act}" data-k="${it.id}"` : '';
  const lv = it.level !== undefined ? ` <span class="ghost">Lv.${it.level}</span>` : '';
  const foot = it.owned && it.level === undefined ? '<div class="cost">✓ 已融</div>' : `<div class="cost">🪙 ${it.cost}</div>`;
  return `<div class="gg-tipwrap"><div class="${cls}"${attr}><div class="gnm">${glyph} ${esc(it.name)}${lv}</div>${foot}</div>${itemTipHTML(it, glyph)}</div>`;
}
// 通用条目富文本说明（闪艺/天罡收藏等·共用 shopItem）。
export function itemTipHTML(it: LobbyShopItem, glyph: string): string {
  const rows = [
    it.power ? tipRow('牌力', '⭐'.repeat(Math.min(it.power, 5)), 'var(--gold)') : '',
    it.phat !== undefined ? tipRow('胜率 P̂', `+${it.phat}`, '#56be84') : '',
    it.level !== undefined ? tipRow('等级', `Lv.${it.level}`, 'var(--gold)') : '',
    it.owned ? tipRow('状态', '✓ 已拥有', 'var(--gold)') : tipRow('价格', `🪙 ${it.cost}`, 'var(--gold)'),
  ].join('');
  return ggTip(`<h4 style="color:var(--gold)">${glyph} ${esc(it.name)}</h4><div class="gg-tip-eff">${esc(it.sub)}</div>${rows}`);
}
