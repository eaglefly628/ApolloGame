// Game G · 改造坊/牌组构筑渲染（地支附魔台 + 天罡货架/战库 + 牌组预览/选择 + 花色条·拆分自 lobby-screen.ts）。
import { esc, SUITS, RANKS, ENCH_TIER_CLR, KIND_LABEL, ggTip, tipRow } from './lobby-util.js';
import { GI, tiangangIcon } from './icons.js';
import { HERO_CARDS, DIZHI_ZODIACS, DIZHI_TIER_NM, DIZHI_TIER_CAP, dizhiTopTier, dizhiTotal, DIZHI_INLAY_FAVOR, inlayBonus, INLAY_MAX, POKER_PICK_SIZE } from './blueprint.js';
import type { LobbyView, LobbyShopItem } from './lobby-screen.js';

export function inlayDetail(view: LobbyView, ix: number): string {
  const deck = view.deck; const inlays = view.inlays ?? {}; const bag = view.dizhiBag ?? {};
  const zodOf = (b: string): typeof DIZHI_ZODIACS[number] | undefined => DIZHI_ZODIACS.find((z) => z.branch === b);
  const [su, c] = SUITS[Math.floor(ix / 13)];
  const rank = RANKS[ix % 13];
  const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
  const inlaid = inlays[String(ix)] ?? [];
  const bonus = inlayBonus(inlaid);
  const full = inlaid.length >= INLAY_MAX;
  const slots = Array.from({ length: INLAY_MAX }, (_, k) => {
    const e = inlaid[k];
    if (e) { const z = zodOf(e.b); return `<button class="ench-slot filled" data-act="removeInlay" data-k="${ix}:${k}" title="卸下 ${z?.animal ?? e.b}·${DIZHI_TIER_NM[e.t]}（不退卡包）" style="border-color:${ENCH_TIER_CLR[e.t] ?? 'var(--gold)'}"><span>${esc(z?.animal ?? e.b)}<sub style="font-size:8px;color:${ENCH_TIER_CLR[e.t]}">${DIZHI_TIER_NM[e.t]}</sub></span><span class="ench-rm">✕</span></button>`; }
    return `<div class="ench-slot empty">＋</div>`;
  }).join('');
  // 可镶 = 卡包里每个 (生肖×档位) 有在持活化的，逐项可选（点哪个消耗哪个档）。
  const picks: string[] = [];
  for (const z of DIZHI_ZODIACS) {
    for (let t = DIZHI_TIER_CAP; t >= 1; t--) {
      const n = (bag[z.branch] ?? [])[t - 1] ?? 0;
      if (n > 0) picks.push(`<button class="ench-pick"${full ? ' disabled' : ` data-act="inlay" data-k="${ix}:${z.branch}:${t}"`} style="border-color:${ENCH_TIER_CLR[t]}"><span style="color:${ENCH_TIER_CLR[t]}">${esc(z.animal)}·${DIZHI_TIER_NM[t]}</span> <span style="opacity:.6">×${Math.min(n, 3)}</span> <b style="color:var(--gold)">+${DIZHI_INLAY_FAVOR[t]}</b></button>`);
    }
  }
  const pick = picks.length ? picks.join('') : '<span class="ghost" style="font-size:12px">卡包里没有地支了 · 去「🛒商城」抽卡获取</span>';
  return `<div class="ench-detail"><div class="ench-sel-card" style="border-color:${c}"><div class="ench-sel-rk" style="color:${c}">${rank}<br>${su}</div><div class="ench-sel-nm">${hero ? esc(hero.name) : ''}</div><div class="ench-sel-fv">favor <b style="color:var(--gold)">${deck[ix]}</b>${bonus ? ` <span style="color:var(--club);font-size:11px">(含附魔 +${bonus})</span>` : ''}</div></div>
    <div style="flex:1"><div class="note" style="text-align:left;margin-bottom:5px">镶嵌槽（${inlaid.length}/${INLAY_MAX}）· 点✕卸下（永久消耗·不退卡包）</div><div class="ench-slots">${slots}</div>
    <div class="note" style="text-align:left;margin:10px 0 5px">${full ? '<span style="color:var(--gold)">槽位已满</span>' : '点卡包里的地支镶入（消耗一张）：'}</div><div class="ench-picks">${pick}</div></div></div>`;
}
export function enchantPanel(view: LobbyView, craftSel: string): string {
  const deck = view.deck;
  const inlays = view.inlays ?? {};
  const picksSet = new Set(view.pokerPicks ?? []);
  const SUIT_LETTERS = ['S', 'H', 'D', 'C']; // 与 POOL_CARD_IDS 同序
  const grid = SUITS.flatMap(([su, c], si) => RANKS.map((rank, ri) => {
    const idx = si * 13 + ri;
    const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
    const fv = deck[idx] ?? 50;
    const n = (inlays[String(idx)] ?? []).length;
    const sel = craftSel === String(idx);
    const inDeck = picksSet.has(rank + SUIT_LETTERS[si]);
    // inDeck：当前出战牌组包含此牌 → 加金色外框 + 小勋章提示玩家「这是我带上去的牌」
    return `<button class="ench-card${sel ? ' sel' : ''}${inDeck ? ' in-deck' : ''}" data-act="craftSel" data-k="${idx}" title="${inDeck ? '已入出战牌组' : ''}"><span class="ench-rk" style="color:${c}">${rank}${su}</span><span class="ench-nm">${hero ? esc(hero.name) : ''}</span><span class="ench-fv">${fv}${n ? ` <span style="color:var(--gold)">🀄${n}</span>` : ''}${inDeck ? ' <span style="color:var(--gold);font-size:9px">⚔</span>' : ''}</span></button>`;
  })).join('');
  // 选中牌的镶嵌详情（与牌库内附魔弹窗共用 inlayDetail）
  const detail = (craftSel !== '' && deck[+craftSel] !== undefined)
    ? inlayDetail(view, +craftSel)
    : `<div class="note" style="text-align:left;color:var(--ink-dim);padding:14px 0">← 选一张牌，给它镶地支附魔（消耗卡包·镶一张少一张）</div>`;
  return `<div class="card"><h2>${GI.crafting} 地支牌 · 生肖镶嵌（附魔） <span class="ghost" style="margin-left:auto;font-size:12px">消耗卡包·镶进牌 → +favor · ≤${INLAY_MAX} 槽</span></h2>
    <div class="note" style="text-align:left;margin-bottom:8px">用卡包里的地支生肖给扑克牌附魔（铜+${DIZHI_INLAY_FAVOR[1]}/银+${DIZHI_INLAY_FAVOR[2]}/金+${DIZHI_INLAY_FAVOR[3]} favor）·<b style="color:var(--heart)">消耗品：镶一张少一张</b>·真提升战力。</div>
    <div class="ench-grid">${grid}</div>
    ${detail}</div>`;
}
// 统一富文本 tooltip（owner 2026-06-20 · MMO 装备框风格）：悬浮弹一个框·彩色数值·一套逻辑。
// 用 .gg-tipwrap 包住任意条目 + 内嵌 .gg-tip 富文本框；纯 CSS 悬浮显示·pointer-events:none 不挡点击。
// 天罡牌富文本说明（名/效果/类型/牌力/P̂/解锁/价）。
export function tiangangTipHTML(it: LobbyShopItem): string {
  const us = it.unlockStage ?? 1;
  const rows = [
    it.kind ? tipRow('类型', KIND_LABEL[it.kind] ?? it.kind, '#a78bfa') : '',
    it.power ? tipRow('牌力', '⭐'.repeat(Math.min(it.power, 5)), 'var(--gold)') : '',
    it.phat !== undefined ? tipRow('胜率影响 P̂', `+${it.phat}`, '#56be84') : '',
    tipRow('解锁', `通关第 ${us} 关`, it.locked ? '#e0635f' : 'var(--club)'),
    it.owned ? tipRow('状态', it.inDeck ? '✓ 已入出战牌组' : '✓ 已拥有', 'var(--gold)') : tipRow('价格', `🪙 ${it.cost}`, 'var(--gold)'),
  ].join('');
  return ggTip(`<h4 style="color:${it.tint || 'var(--gold)'}">${esc(it.name)}</h4><div class="gg-tip-eff">${esc(it.sub)}</div>${rows}`);
}
export function craftTiangangItem(it: LobbyShopItem): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  // 金币解锁仅在「已解锁关·可购」时挂点击；关未到 → 锁态（钻石速购单独按钮）。
  const buyAttr = it.buyable && !it.owned ? ` data-act="buyTiangang" data-k="${it.id}"` : '';
  const stars = it.power ? `<span class="power-stars">${'⭐'.repeat(Math.min(it.power, 5))}</span>` : '';
  const phat = it.phat !== undefined ? `<span class="phat-badge"> P̂${it.phat}</span>` : '';
  const us = it.unlockStage ?? 1;
  const stageBadge = `<span class="unlock-badge" title="第 ${us} 关解锁">关${us}</span>`;
  let foot: string;
  if (it.owned) {
    // 改造坊只管"拥有"；编入牌组到「牌组」屏做（不在两处都能编·避免跳转混乱）
    foot = `<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><span style="font-size:11px;color:var(--gold)">✓ 已解锁${it.inDeck ? ' · ⚔ 已入组' : ''}</span><button class="tiangang-tog" data-act="editDeck">→ 牌组编入</button></div>`;
  } else if (it.locked) {
    // 关未到 → 金币锁；可花钻石(=关序)速解（doc25·跳 grind）。
    foot = `<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><span style="font-size:11px;color:var(--ink-dim)">🔒 通关第 ${us} 关解锁</span><button class="tiangang-tog" data-act="diamondUnlock" data-k="${it.id}" style="color:#7fd0ff;border-color:#3a6ea5">💎${us} 速解</button></div>`;
  } else {
    foot = `<div class="cost">🪙 ${it.cost}</div>`;
  }
  return `<div class="gg-tipwrap tip-up"><div class="${cls}"${buyAttr}><div class="gnm">${stageBadge} ${tiangangIcon(it.icon, it.tint)} ${esc(it.name)}${stars}${phat}</div>${foot}</div>${tiangangTipHTML(it)}</div>`;
}
// 天罡战库预览面板（B3 · HOME+DECKS 屏）：≤5 已选天罡牌 每张【名 + 效果 + 牌力⭐ + P̂】+ 整库总加成汇总。
export function deckPreviewPanel(tiangangs: LobbyShopItem[], archName: string | null | undefined, activated: boolean | undefined, size = 12, deckName = ''): string {
  const inDeck = tiangangs.filter((j) => j.inDeck);
  const totalPhat = inDeck.reduce((s, j) => s + (j.phat ?? 0), 0);
  const hasLeg = inDeck.some((j) => j.power === 5);
  const body = inDeck.length
    ? `<div class="jchips">${inDeck.map((j) => {
        const stars = j.power ? '⭐'.repeat(Math.min(j.power, 5)) : '';
        const phat = j.phat !== undefined ? ` P̂${j.phat}` : '';
        return `<div class="jchip" title="${esc(j.sub)}">${tiangangIcon(j.icon, j.tint)} <b>${esc(j.name)}</b><span class="power-stars">${stars}</span><span class="phat-badge">${phat}</span></div>`;
      }).join('')}</div>`
    : `<div class="note" style="text-align:left;margin:8px 0">战库空 · 去「改造坊」选入天罡牌（局内法术·≤5 张）</div>`;
  const arch = archName ? `流派 <b>${esc(archName)}</b>${activated ? '　🔥 招牌已激活' : ''}` : '流派未成型';
  const summary = inDeck.length ? `　整库 P̂ <b style="color:var(--gold)">${totalPhat}</b>${hasLeg ? '　🔥 传说激活' : ''}` : '';
  const title = deckName ? `天罡牌组 · ${esc(deckName)}` : '天罡牌组';
  return `<div class="card" style="margin-bottom:14px"><h2>${GI.bolt} ${title} <span class="ghost" style="font-size:12px;margin-left:auto">${inDeck.length}/${size} · 出战带 ${size} 张</span></h2>${body}<div style="display:flex;align-items:center;gap:10px;margin-top:8px"><div class="note" style="text-align:left;margin:0;flex:1">${arch}${summary}</div><button class="cta-sub" data-act="editDeck" style="flex:none">✏ 编辑牌组</button></div></div>`;
}

// 出战牌组选择条（owner 2026-06-21「出征牌组和天罡牌组是一套的·选一套出征」）：一套 = 16 扑克 + 5 天罡。
// 顶级选择器·统领下面两子页（扑克牌库 / 天罡战法 同改这选中的一套）。选一套=设为⚔出战；可新建/删。
export function deckSetSelector(view: LobbyView): string {
  const decks = view.decks ?? [];
  const pokerMax = view.pokerPickMax ?? POKER_PICK_SIZE;
  const tgMax = view.deckSize ?? 12;
  const chips = decks.map((d) => `<button class="deck-chip${d.active ? ' on' : ''}" data-act="selectDeck" data-k="${d.id}">${d.active ? '⚔ ' : ''}${esc(d.name)} <span class="ghost">扑${d.pokerSize ?? 0}/罡${d.size}</span>${decks.length > 1 ? `<span class="deck-del" data-act="delDeck" data-k="${d.id}" title="删除这套牌组">✕</span>` : ''}</button>`).join('');
  const addBtn = view.canAddDeck ? `<button class="deck-chip add" data-act="newDeck">＋ 新建一套</button>` : '';
  return `<div class="card" style="margin-bottom:14px"><h2>🎖 我的出战牌组 <span class="ghost" style="font-size:12px;margin-left:auto">一套 = ${pokerMax} 扑克 + ${tgMax} 天罡</span></h2>
    <div class="note" style="text-align:left;margin-bottom:7px">点一套设为 <b style="color:var(--gold)">⚔ 出战</b>（带去打的就是它·已保存）。下面两页分别配<b>这一套</b>的扑克牌库与天罡战法；地支牌是通用养成材料。</div>
    <div class="deck-chips">${chips}${addBtn}</div></div>`;
}
// 天罡战法编辑器：当前出战这套牌组的 ≤size 天罡槽（满槽可✕移除·空槽＋添加从已拥有里选）。选哪套在顶部选择条。
export function tiangangDeckManager(view: LobbyView): string {
  const size = view.deckSize ?? 12;
  const inDeck = view.tiangangs.filter((j) => j.inDeck);
  const deckFull = inDeck.length >= size;
  const filled = inDeck.map((j) => `<div class="tg-slot" title="${esc(j.sub)}"><div class="tg-slot-ic">${tiangangIcon(j.icon, j.tint)}</div><b>${esc(j.name)}</b><button class="tg-rm" data-act="toggleTiangang" data-k="${j.id}" title="移出牌组">✕</button></div>`).join('');
  const empties = Array.from({ length: Math.max(0, size - inDeck.length) }, () => `<button class="tg-slot empty" data-act="deckAdd" title="添加天罡牌"><span>＋</span></button>`).join('');
  return `<div class="card"><h2>${GI.bolt} 天罡战法 ·「<b style="color:var(--gold)">${esc(view.activeDeckName ?? '')}</b>」
    <span style="display:flex;gap:8px;margin-left:auto"><button class="cta-sub" data-act="autoBuildTiangang" data-anchor="autobuild-gang" title="从已拥有天罡自动凑满这套">✨ 一键配置天罡</button></span></h2>
    <div class="note" style="text-align:left;margin:2px 0 7px">当前出战牌组的天罡（局内法术·≤${size}）——满槽点 <b>✕ 移除</b>，空槽点 <b>＋ 添加</b>（从已拥有里选），或上方<b>一键配置</b>。换哪套到顶部「我的出战牌组」选。</div>
    <div class="tg-deck">${filled}${empties}</div>
    ${deckFull ? `<div class="note" style="text-align:left;margin-top:8px;color:var(--gold)">天罡已满 ${size} 张。</div>` : ''}</div>`;
}
// 选卡弹窗（添加天罡入组）：从已拥有但未入组的天罡里点选 → 加入。
export function deckPickerBox(view: LobbyView): string {
  const size = view.deckSize ?? 12;
  const deckFull = view.tiangangs.filter((j) => j.inDeck).length >= size;
  const avail = view.tiangangs.filter((j) => j.owned && !j.inDeck);
  const list = avail.length
    ? avail.map((j) => { const stars = j.power ? '⭐'.repeat(Math.min(j.power, 5)) : ''; return `<button class="pick-item"${deckFull ? ' disabled' : ` data-act="toggleTiangang" data-k="${j.id}"`}><div class="pick-hd">${tiangangIcon(j.icon, j.tint)} <b>${esc(j.name)}</b> <span class="power-stars">${stars}</span></div><div class="pick-sub">${esc(j.sub)}</div></button>`; }).join('')
    : `<div class="gang-empty"><span style="font-size:28px;opacity:.5">⚡</span><b>已拥有的天罡都进组了</b><span style="font-size:11px">去「改造坊 / 🛒商城」获取更多天罡牌</span></div>`;
  return `<div class="tut-ov" data-act="deckPicker-close"><div class="tut-box intro-scroll" data-stop="1" style="max-width:480px">
    <h3>添加天罡牌 · 选一张入组</h3>
    <div class="note" style="text-align:left;margin-bottom:8px">${deckFull ? '<span style="color:var(--gold)">牌组已满，先移除再添加。</span>' : '从已拥有的天罡牌里点选 → 即加入出战牌组（可连选多张）'}</div>
    <div class="pick-list">${list}</div>
    <div style="text-align:center;margin-top:12px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="deckPicker-close">完成 →</button></div>
  </div></div>`;
}

// 花色均势面板（B1 · DECKS 扑克牌组）：4 花色 favor 平均值 → 竖条高度 + 预估强度 ★
export function suitBarsPanel(deck: number[], deckAvg: number): string {
  const suits = SUITS.map(([su, c], si) => {
    const fvs = deck.slice(si * 13, si * 13 + 13);
    return { su, c, avg: fvs.reduce((a, b) => a + b, 0) / 13 };
  });
  const maxAvg = Math.max(...suits.map(s => s.avg));
  const bars = suits.map(({ su, c, avg }) => {
    const pct = (avg / maxAvg * 100).toFixed(0);
    return `<div style="width:40px;flex:none;display:flex;flex-direction:column;align-items:center;gap:5px"><div style="width:32px;height:80px;background:var(--track);border-radius:6px;overflow:hidden;position:relative;border:1px solid var(--panel-border)"><div style="position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:${c}99;border-top:2px solid ${c}"></div></div><span style="font-size:18px;color:${c}">${su}</span><span style="font-family:var(--fn);font-size:10px;color:var(--ink-dim)">${avg.toFixed(0)}</span></div>`;
  }).join('');
  const stars = Math.min(4, Math.floor(deckAvg / 16));
  return `<div style="display:flex;align-items:center;gap:18px;padding:10px 0 12px;border-bottom:1px solid var(--panel-border);margin-bottom:10px"><div style="display:flex;gap:10px;align-items:flex-end;flex:none">${bars}</div><div style="display:flex;flex-direction:column;gap:5px"><span style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink)">花色均势</span><span style="font-size:12px;color:var(--ink-dim)">favor 均 <b style="color:var(--gold)">${deckAvg}</b></span><span style="font-size:12px;color:var(--ink-dim)">预估强度 <span style="color:var(--gold)">${'★'.repeat(stars)}${'☆'.repeat(4 - stars)}</span></span><span style="font-size:11px;color:var(--ink-dim)">公平骨架 52 张</span></div></div>`;
}


// 弹层独立层（owner 2026-06-20 抗闪屏）：所有 overlay 抽到这里，mountLobby 单独更新 #gv-ov，
// 不重建大厅主体（含 52 SVG）→ 开/点商城·设置·帮助不再整屏闪。
// 卦值(1-100) → 吉凶档（纯表现·主页徽标与弹框共用一处推导·不进战斗）。
