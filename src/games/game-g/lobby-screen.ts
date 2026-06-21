// lobby-screen.ts —— 大厅设计稿「忠实港」（owner 2026-06-18：就是这个老文件 ui = design/UI/Game G 大厅.dc.html）。
// 逐字照搬该稿的招牌视觉：纸框(--paper/--frame-edge) + 顶栏 + 5 屏 IA + **HOME 绿呢牌桌(--felt) + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + 倒角 sheen 大 CTA**
//   + 玄铁(onyx)/锦霞(rosy=brocade)双皮（CSS 变量逐项对齐 .dc.html themes()）。数据接真存档；未接网项诚实占位。
// 纯表现"固定解释器"：只渲染 view + 抛 data-act 回调，零 gameplay 计算。CSS 全 scope 在 .ggl-root 下。

import { GI, tiangangIcon } from './icons.js';
import { HERO_CARDS, DIZHI_ZODIACS, DIZHI_TRINES, DIZHI_PAIRS, EARTH_FIENDS, STAGE_CAMPAIGN, STORY_OPENING, type StageCampaign, type StoryBeat } from './blueprint.js';
import { heroPortrait } from './portraits.js';
import { coachmarkGeometry } from '@renderer/coachmark.js'; // 引擎通用高亮纯几何（REQ-ARCH-COACH·下沉能力·此处薄 DOM 适配）
import { playSfx, sfxForAct, isSfxMuted, setSfxMuted } from './sfx.js';
import { isBgmOn, toggleBgm, bgmTrackIdx, selectBgm, bgmVolume, setBgmVolume, BGM_TRACKS } from './bgm.js';
import { DISHA_SPECS, stageDisha } from './disha.js';
import { RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, GACHA, INLAY_MAX, DIZHI_INLAY_FAVOR, DIZHI_TIER_NM, DIZHI_TIER_CAP, dizhiTopTier, dizhiTotal, inlayBonus, deployCost, POKER_PICK_SIZE, canonSuitPw, type InlayEntry } from './blueprint.js';

export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number; inDeck?: boolean; power?: number; phat?: number; kind?: string; icon?: string; tint?: string; unlockStage?: number; locked?: boolean }
export interface GachaResult { kind: 'tiangang' | 'dizhi'; id: string; name: string; rarity?: string; outcome: 'new' | 'dup-shard' | 'dizhi-up' | 'dizhi-shard'; detail: string } // 抽卡结果（开包演出读）
export type EarthRarity = 'bronze' | 'silver' | 'gold';
export interface LobbyView {
  skin: 'onyx' | 'rosy';
  coin: number; diamond?: number; dizhiShards?: number; tiangangShards?: number; dizhiBag?: Record<string, number[]>; inlays?: Record<string, InlayEntry[]>; rechargeNeedsPassword?: boolean; energy: number; energyMax: number; foilCount: number;
  name: string; mainCard: string; rankText: string;
  stageLabel: string; archLine: string; bossLine: string;
  deckAvg: number; deckMin: number; deckMax: number; deck: number[];
  tiangangs: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
  ladderLines: string[];
  deckArchName?: string | null; deckArchActivated?: boolean;
  // 天罡牌组（owner 2026-06-20 多牌组）：decks=各牌组概览 / deckSize=每组上限 / activeDeckName=出战组名 / canAddDeck=可否再建
  decks?: { id: string; name: string; size: number; pokerSize?: number; active: boolean }[];
  deckSize?: number; activeDeckName?: string; canAddDeck?: boolean;
  // 出战扑克牌组构筑（乙1·DEV-CHECKLIST 契约 A）：从 52 池自选 ≤pokerPickMax 张；pokerPicks=当前出战组已选卡 id；cost 角标读 deployCost。
  pokerPicks?: string[]; pokerPickMax?: number;
  campaign?: StageCampaign; // 当前关战役（Boss/战役/难度/地煞/解锁 · doc23 §八）
  campaignMax?: number; // 已抵达的最高关（战役进度屏 锁/通关判定）
  firstLaunch?: boolean; // 首次启动（未看过开场故事）→ 进大厅自动播放（doc28 §一）
  guideStep?: number; // 新手引导进度（doc28 §二）：0..N 进行中 · -1 完成/跳过
  fortune?: FortuneView; // 今日卦象（owner 2026-06-21）：制卦次数 + 收下的卦值 → 主页顶展示
}

import { LOBBY_CSS } from './lobby-styles.js';
import { heroCollSection, ladderSection, fiendsCodex, dishaNumberLine } from './lobby-collection.js';

const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['♦', 'var(--diamond)'], ['♣', 'var(--club)']];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const kfmt = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
import { esc } from './lobby-util.js';

// 十二地支支脉（子→亥，animal，theme）
const RARITY_CLR: Record<EarthRarity, string> = { bronze: '#cd7f32', silver: '#c4ccd6', gold: '#e8cd82' };
const RARITY_LBL: Record<EarthRarity, string> = { bronze: '铜', silver: '银', gold: '金' };

// 地支 codex（doc20 §三 + doc23 §五 · 美术 zodiac.json）：12 生肖 × 铜银金三档 + 牌背传说 + 三合连携。
// 镶嵌/揉获取/连携 gameplay 待契约④（甲战斗侧 apply）；此处为养成图鉴展示（图标真接美术库 twemoji）。
// 地支卡包（owner 2026-06-21 消耗品模型）：每生肖按档位计活化数 [铜,银,金]·满3自动升档·钻/史待开放·镶一张少一张。
function earthSection(filter: string, bag: Record<string, number[]> = {}): string {
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

const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
function deckGrid(deck: number[], foils?: LobbyShopItem[], picks?: Set<string>, inlays?: Record<string, InlayEntry[]>): string {
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
function pokerBuildHead(view: LobbyView): string {
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
function pokerBuildPanel(view: LobbyView): string {
  const max = view.pokerPickMax ?? POKER_PICK_SIZE;
  const picks = new Set(view.pokerPicks ?? []);
  const full = picks.size >= max;
  return `<div class="card"><div class="pbuild-head">${pokerBuildHead(view)}</div>
    <div class="note" style="text-align:left;margin:9px 0 4px">点牌入/出 <b>出战牌库</b>（满 ${max} 张）。左下角数字＝<b>放牌费用</b>（点 2-4=0 / 5-7=1 / 8-10=2 / JQKA=3）。<b style="color:var(--gold)">✓</b>＝已入战库；favor 越高越能扛掷命。带进下一场战斗的就是这 ${max} 张。</div>
    <div class="pbuild-grid${full ? ' full' : ''}">${deckGrid(view.deck, view.foils, picks, view.inlays)}</div></div>`;
}
function shopItem(act: string, glyph: string, it: LobbyShopItem): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  const attr = it.buyable && !it.owned ? ` data-act="${act}" data-k="${it.id}"` : '';
  const lv = it.level !== undefined ? ` <span class="ghost">Lv.${it.level}</span>` : '';
  const foot = it.owned && it.level === undefined ? '<div class="cost">✓ 已融</div>' : `<div class="cost">🪙 ${it.cost}</div>`;
  return `<div class="gg-tipwrap"><div class="${cls}"${attr}><div class="gnm">${glyph} ${esc(it.name)}${lv}</div>${foot}</div>${itemTipHTML(it, glyph)}</div>`;
}
// 通用条目富文本说明（闪艺/天罡收藏等·共用 shopItem）。
function itemTipHTML(it: LobbyShopItem, glyph: string): string {
  const rows = [
    it.power ? tipRow('牌力', '⭐'.repeat(Math.min(it.power, 5)), 'var(--gold)') : '',
    it.phat !== undefined ? tipRow('胜率 P̂', `+${it.phat}`, '#56be84') : '',
    it.level !== undefined ? tipRow('等级', `Lv.${it.level}`, 'var(--gold)') : '',
    it.owned ? tipRow('状态', '✓ 已拥有', 'var(--gold)') : tipRow('价格', `🪙 ${it.cost}`, 'var(--gold)'),
  ].join('');
  return ggTip(`<h4 style="color:var(--gold)">${glyph} ${esc(it.name)}</h4><div class="gg-tip-eff">${esc(it.sub)}</div>${rows}`);
}
// 帮助中心（owner 2026-06-20 合并）：游戏介绍 + 新手指导 + 玩法手册(初/中/高) 三合一·一个入口。
function helpBox(helpTab: 'intro' | 'tut' | 'manual', tier: 'easy' | 'mid' | 'hard'): string {
  const nav = (k: 'intro' | 'tut' | 'manual', lbl: string): string =>
    `<button class="cta-sub" style="${helpTab === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="helpTab" data-k="${k}">${lbl}</button>`;
  const introBody = `<h2>翻命扑克 · Fateflip</h2>
    <div class="lead">你，执掌命运之人。</div>
    <p>历史上最伟大的 <b>52 位名将</b>——孙武、成吉思汗、亚历山大、汉尼拔、韩信……他们的魂被诅咒，封进了一副扑克。每一位，都困在他<b>一生最关键的那场战役</b>里，命运定格在那一刻。</p>
    <p><b>掷命，即翻命。</b>你抛下手中的牌，正面则生、反面则亡——用一掷之力，去翻动这些被诅咒英雄的命运：重续辉煌，或改写败局。</p>
    <p class="lead" style="font-size:16px">三牌组，三层天命：</p>
    <p>· <b>扑克 52 · 名将</b>：上阵的兵，每张都是一位有名有姓的历史英雄。<br>· <b>天罡 36 · 兵法</b>：三十六记战术，你的法术——虎符、擒王、连环、背水……<br>· <b>地支 12 · 天命</b>：十二生肖的命格，镶进你的英雄，越养越强。</p>
    <p><b>52 场命运之战。</b>你将重走井陉、巨鹿、坎尼、温泉关……每一关，是一位英雄的成名之战。打赢，便解封他的魂，收他入麾下。</p>
    <p style="font-family:var(--fd);font-size:17px;color:var(--gold);text-align:center;margin-top:14px">配一副好牌，去翻天下英雄的命。</p>`;
  const tutBody = `<h3>📖 新手指导 · 一局怎么打</h3>
    <div class="step"><b>赛前（改造坊/牌组）</b>：构筑你的库——公平扑克 52 + 天罡牌（带 ≤12 进出战牌组）+ 地支镶嵌附魔。强弱靠经营、不靠抽强牌。</div>
    <div class="step"><b>开局</b>：三路 9 格、两端大本营各 3 血。每回合 <b>+1 召唤源泉</b>，四选一（抽/放/打天罡/弃）。</div>
    <div class="step"><b>对决核</b>：两军碰头 → 比战力 → 胜率(如 76:24) → 抛牌定生死（正面活·前进 / 反面亡）。<b>胜率可见</b>，永远有 3% 爆冷缝。</div>
    <div class="step"><b>赢条件</b>：把对面大本营 3 血打光，<b>先破者胜</b>。</div>`;
  const tb = (k: 'easy' | 'mid' | 'hard', lbl: string, col: string): string =>
    `<button class="cta-sub" data-act="manTier" data-k="${k}" style="${tier === k ? `background:${col};color:#1a1206;border:0` : ''}">${lbl}</button>`;
  const easy = `<h3 style="color:#4ade80">🟢 初级 · 打赢第一场</h3>
    <p><b>战场</b>：三条横路（上/中/下），每路 <b>9 格</b>（你 4 · 中 1 · 敌 4）；两端大本营各 <b>3 血</b>。<b>先把对面 3 血打光 = 赢。</b></p>
    <p><b>回合制·每回合做一件事</b>：回合开始 <b>+1 召唤源泉</b>，然后<b>四选一</b>（互斥）：<br>· <b>抽牌</b>· <b>放牌</b>（部署一兵到某路·可顺手开关机关门）· <b>打天罡</b>· <b>弃牌</b>。<br>做完 → 棋盘走一格，两军碰头 → <b>掷命对决</b>。</p>
    <p><b>掷命对决（核心）</b>：比战力 → 算胜率 → 抛牌定生死。战力高则胜率高，但永远有 <b>爆冷缝</b>（再强 3% 翻车·再弱 3% 翻盘）。</p>`;
  const mid = `<h3 style="color:#facc15">🟡 中级 · 三牌组 + 经营</h3>
    <p><b>三套牌</b>：<br>· <b>扑克 52（名将·兵）</b>：上场部队，点数=战力、花色=阵营，双方同副（公平）。<br>· <b>天罡 36（兵法·法术）</b>：赛前挑带上场，局内打出持续整局（虎符全军+2 / 疾行加速 / 擒王斩敌主将崩路）。<br>· <b>地支 12（天命·养成）</b>：局外镶到牌上叠属性（附魔台）。</p>
    <p><b>⚔ 掷命预报（落子前就看得见·owner 2026-06-21 新增）</b>：两军前锋将要相遇的那一路，棋盘上会在你前锋头顶浮出<b>档位词 + 具体胜率%</b>，让你<b>开战前</b>就心里有数：<br>
    · 占优：<span style="color:#bcc857;font-weight:700">小优 55%↑</span> → <span style="color:#84c97f;font-weight:700">优势 65%↑</span> → <span style="color:#5bbf7a;font-weight:700">大优 80%↑</span> → <span style="color:#2fbf6a;font-weight:700">碾压 90%↑</span><br>
    · 吃亏：<span style="color:#e8a64a;font-weight:700">小弱</span> → <span style="color:#e8814a;font-weight:700">弱势</span> → <span style="color:#e25a4a;font-weight:700">大弱</span> → <span style="color:#cf3b3b;font-weight:700">被碾压</span>；中间 <span style="color:#cdb86a;font-weight:700">均势 ~50%</span><br>
    （胜率含天罡/地支/士气全部加成，与真实开战同一套算法——预报即结果的概率，详见 🔴 高级）。</p>
    <p><b>经营要点</b>：召唤源泉紧（每回合 +1）→ 每个抉择都重要；机关门换路；同点数凑对子/三条加战力；<b>看预报田忌赛马</b>——避开"大弱/被碾压"的路、把强牌送去"大优/碾压"集中突破。</p>`;
  const hard = `<h3 style="color:#f87171">🔴 高级 · 概率算法 · 连携 · 克制</h3>
    <p><b>⭐ 掷命对决——最终概率怎么算出来的</b>（透明·非黑箱）：<br>
    ① <b>各取战力</b>：碰头的两张牌，各算<b>有效战力 P_eff</b> = 点数底盘 + 天罡加成（虎符全军+2…）+ 地支附魔(镶嵌+favor) + 士气(主将活则全路涨) + 干预。<br>
    ② <b>算差值</b>：取双方差 Δ = P我 − P敌。<br>
    ③ <b>过 S 形曲线</b>：胜率 = <b>logistic(Δ / k)</b> = 1 / (1 + e^(−Δ/k))。差越大胜率越高，但平滑——不是"高 1 点就必胜"。k 是缓和系数。<br>
    ④ <b>夹爆冷缝</b>：胜率 = <b>clamp(上式, 3%, 97%)</b>——再强也有 3% 翻车、再弱也有 3% 翻盘。<br>
    ⑤ <b>种子骰</b>：用确定性随机数掷这个胜率 → 正面活·前进 / 反面亡。<b>同一局同种子结果可复现</b>。</p>
    <p><b>调概率的牌</b>：铁骰(占优封顶不被爆冷) · 磐石(抬你下限) · 灌铅骰(强者愈强) · 鬼手(指定一场 +25%) · 巧手(P_eff +1) · 稳手(胜率下限 +5%)。</p>
    <p><b>地支连携（镶嵌质变）</b>：<br>· <b>二合·六合</b>（两颗相合）：门槛低、效果轻——如 子丑合 大本营+1血、午未合 濒死免死。<br>· <b>三合</b>（三颗同组）：强力质变——如 水(申子辰)一局1次必重掷、火(寅午戌)赢后连推。<br>（镶嵌战斗 apply 待实装。）</p>
    <p><b>赛前构筑</b>：天罡针对当关 Boss 明牌的 3 张地煞 counter-pick；集齐流派天罡解锁<b>招牌印</b>。Boss 库=12 随机天罡+3 专属地煞，比你猛但<b>明牌可破</b>。</p>`;
  const manualBody = `<div class="ctarow" style="margin-bottom:12px">${tb('easy', '🟢 初级', '#4ade80')}${tb('mid', '🟡 中级', '#facc15')}${tb('hard', '🔴 高级', '#f87171')}</div><div style="min-height:200px">${tier === 'easy' ? easy : tier === 'mid' ? mid : hard}</div>`;
  const body = helpTab === 'intro' ? introBody : helpTab === 'tut' ? tutBody : manualBody;
  return `<div class="tut-ov" data-act="help-close"><div class="tut-box intro-scroll" data-stop="1" style="width:560px;max-width:100%;display:flex;flex-direction:column">
    <div class="ctarow" style="margin-bottom:12px">${nav('intro', '📜 游戏介绍')}${nav('tut', '📖 新手指导')}${nav('manual', '📚 玩法手册')}</div>
    <div style="height:46vh;min-height:340px;overflow-y:auto;padding-right:4px">${body}</div>
    <div style="text-align:center;margin-top:12px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="help-close">明白了 →</button></div>
  </div></div>`;
}
// 背景音乐设置（owner 2026-06-21「把开关加菜单·让我选 3 首」）：开/关 + 3 首选曲 + 音量。状态读 bgm.ts（localStorage·与 SFX 分开）。
function bgmSettingsBlock(): string {
  const on = isBgmOn();
  const cur = bgmTrackIdx();
  const vol = Math.round(bgmVolume() * 100);
  const trackBtns = BGM_TRACKS.map((t, i) =>
    `<button class="cta-sub" style="${i === cur ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="bgmTrack" data-k="${i}">${i === cur ? '♪ ' : ''}${esc(t.name)}</button>`).join('');
  return `<div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">背景音乐</div>
    <button class="cta-sub" data-act="bgmToggle">${on ? '🎵 音乐：开（点击关闭）' : '🔇 音乐：关（点击开启）'}</button>
    ${on ? `<div class="ctarow" style="flex-wrap:wrap;gap:6px;margin-top:8px">${trackBtns}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px"><span class="note" style="margin:0">音量</span><button class="cta-sub" data-act="bgmVol" data-k="down" style="min-width:34px">−</button><b style="min-width:42px;text-align:center;color:var(--ink)">${vol}%</b><button class="cta-sub" data-act="bgmVol" data-k="up" style="min-width:34px">＋</button></div>` : ''}
  </div>`;
}
// 设置（owner 2026-06-20）：皮肤(默认玄铁) + 重看开场/引导 + 重置数据(调试)。
function settingsBox(view: LobbyView): string {
  const seg = (k: 'onyx' | 'rosy', lbl: string): string =>
    `<button class="cta-sub" style="${view.skin === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="skin" data-k="${k}">${lbl}</button>`;
  return `<div class="tut-ov" data-act="settings-close"><div class="tut-box" data-stop="1" style="max-width:420px">
    <h2>⚙ 设置</h2>
    <div style="text-align:left;margin-top:10px"><div class="note" style="text-align:left;margin-bottom:6px">大厅皮肤</div><div class="ctarow">${seg('onyx', '玄铁（默认）')}${seg('rosy', '锦霞')}</div></div>
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">音效</div><button class="cta-sub" data-act="sfxToggle">${isSfxMuted() ? '🔇 音效：关（点击开启）' : '🔊 音效：开（点击静音）'}</button></div>
    ${bgmSettingsBlock()}
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">新手内容</div><button class="cta-sub" data-act="replayIntro">↻ 重看开场故事与新手引导</button></div>
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">退出</div><button class="cta-sub" data-act="exitGame">⏏ 退出到游戏库</button></div>
    <div style="text-align:left;margin-top:16px;padding-top:12px;border-top:1px solid var(--panel-border)"><div class="note" style="text-align:left;margin-bottom:6px">调试</div><button class="cta-sub" data-act="reset" style="color:var(--danger);border-color:var(--danger)">⚠ 重置所有数据（调试用）</button></div>
    <div style="text-align:center;margin-top:16px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="settings-close">完成 →</button></div>
  </div></div>`;
}
// 商城（owner 2026-06-20 · Demo）：🎴抽卡(doc25 §四·从已解锁池随机·重复转碎片·碎片定向兑换) + 💎钱包(充值/兑换)。
// 全数据驱动：池/价格/汇率读 GACHA / RECHARGE_PACKS / DIAMOND_EXCHANGES；点击 = 真发卡/发币。
function shopBox(view: LobbyView, shopTab: 'gacha' | 'wallet' | 'foil', rechargeErr = '', rcSuits: string[] = []): string {
  const dia = view.diamond ?? 0;
  const shards = view.dizhiShards ?? 0;
  const tShards = view.tiangangShards ?? 0;
  const needPw = !!view.rechargeNeedsPassword;
  const tabBtn = (k: 'gacha' | 'wallet' | 'foil', lbl: string): string =>
    `<button class="cta-sub" style="${shopTab === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="shopTab" data-k="${k}">${lbl}</button>`;
  const bal = `<div style="display:flex;align-items:center;gap:14px;color:var(--ink-dim);font-size:12px;margin:6px 0 12px"><span>🪙 <b style="color:var(--ink)">${view.coin}</b></span><span>💎 <b style="color:#7fd0ff">${dia}</b></span><span>🔶 <b style="color:#e6b96a">${tShards}</b> 天罡碎片</span><span>🧩 <b style="color:#e6b96a">${shards}</b> 地支碎片</span></div>`;
  // ── 🎴 抽卡 tab ──
  const poolN = view.tiangangs.filter((j) => !j.locked).length;
  const dizhiN = DIZHI_ZODIACS.filter((z) => dizhiTotal((view.dizhiBag ?? {})[z.branch]) > 0).length;
  const drawBtn = (pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond'): string => {
    const g = GACHA[pool];
    const cost = pay === 'gold' ? (count === 10 ? g.tenGold : g.singleGold) : (count === 10 ? g.tenDiamond : g.singleDiamond);
    const afford = pay === 'gold' ? view.coin >= cost : dia >= cost;
    return `<button class="gacha-draw${afford ? '' : ' off'}"${afford ? ` data-act="gacha" data-k="${pool}:${count}:${pay}"` : ' disabled'}><span>${count === 10 ? '十连' : '单抽'}</span><b>${pay === 'gold' ? '🪙' : '💎'}${cost}</b></button>`;
  };
  const poolCard = (pool: 'tiangang' | 'dizhi', emoji: string, title: string, sub: string): string =>
    `<div class="gacha-pool"><div class="gacha-pool-hd">${emoji} ${title}</div><div class="note" style="text-align:left;margin:2px 0 8px">${sub}</div><div class="gacha-btns">${drawBtn(pool, 1, 'gold')}${drawBtn(pool, 1, 'diamond')}${drawBtn(pool, 10, 'gold')}${drawBtn(pool, 10, 'diamond')}</div></div>`;
  const craftable = view.tiangangs.filter((j) => !j.locked && !j.owned);
  const craftChips = craftable.length
    ? craftable.map((j) => { const can = tShards >= GACHA.tiangang.craftShards; return `<button class="gacha-craft${can ? '' : ' off'}"${can ? ` data-act="craftTiangang" data-k="${j.id}"` : ' disabled'}>${esc(j.name)} <span>🔶${GACHA.tiangang.craftShards}</span></button>`; }).join('')
    : '<span class="ghost" style="font-size:12px">已解锁天罡均已拥有 🎉</span>';
  // 地支碎片定向兑换（owner 2026-06-21「走通用碎片兑换地支牌」）：花地支碎片 → 卡包 +1 铜活化（满3自动升档·消耗品）。
  const dizhiBag = view.dizhiBag ?? {};
  const dizhiCraftChips = DIZHI_ZODIACS.map((z) => {
    const top = dizhiTopTier(dizhiBag[z.branch]); const n = dizhiTotal(dizhiBag[z.branch]);
    const can = shards >= GACHA.dizhi.craftShards;
    const label = `${z.animal}${n > 0 ? `·${DIZHI_TIER_NM[top]}×${n}` : ''} +1`;
    return `<button class="gacha-craft${can ? '' : ' off'}"${can ? ` data-act="craftDizhi" data-k="${z.branch}"` : ' disabled'} title="${esc(z.animal)}（${esc(z.symbol)}）· 兑一张铜活化进卡包">${esc(label)} <span>🧩${GACHA.dizhi.craftShards}</span></button>`;
  }).join('');
  const gachaTab = `${poolCard('tiangang', '🎴', '天罡卡池', `已解锁 ${poolN} 张 · 抽到重复 → +${GACHA.tiangang.dupShards} 天罡碎片`)}
    ${poolCard('dizhi', '🀄', '地支卡池', `12 生肖（已集 ${dizhiN}/12）· 重复自动升档 铜→银→金 · 满金转地支碎片`)}
    <div class="gacha-pool"><div class="gacha-pool-hd">🔶 天罡碎片 · 定向兑换（保底）</div><div class="note" style="text-align:left;margin:2px 0 8px">攒够碎片直接换你想要的天罡——防"抽不到配不出 build"。每张 ${GACHA.tiangang.craftShards} 碎片。</div><div class="gacha-crafts">${craftChips}</div></div>
    <div class="gacha-pool"><div class="gacha-pool-hd">🧩 地支碎片 · 定向兑换（升档）</div><div class="note" style="text-align:left;margin:2px 0 8px">攒够地支碎片直接换/升你想要的生肖（铜→银→金）。每次 ${GACHA.dizhi.craftShards} 碎片。<b style="color:#e6b96a">你有 ${shards} 🧩</b></div><div class="gacha-crafts">${dizhiCraftChips}</div></div>
    <div class="note" style="text-align:left;margin-top:10px;font-size:11px">从「已解锁池」随机（通关解锁更多）。地支镶嵌到「改造坊」给牌附魔。</div>`;
  // ── 💎 钱包 tab（充值 + 兑换）──
  const packCard = (p: typeof RECHARGE_PACKS[number]): string => {
    const total = rechargeTotal(p);
    const bonus = p.bonus > 0 ? `<span style="color:var(--gold);font-size:11px">含赠 +${p.bonus}</span>` : `<span style="color:var(--ink-dim);font-size:11px">&nbsp;</span>`;
    const tag = p.tag ? `<div style="position:absolute;top:-9px;right:8px;background:var(--gold-grad);color:#2a1a08;font-family:var(--fn);font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px">${p.tag}</div>` : '';
    return `<button class="rc-pack" data-act="rechargeBuy" data-k="${p.id}" style="position:relative">${tag}<div class="rc-amt">💎 ${total}</div>${bonus}<div class="rc-price">¥${p.price}</div></button>`;
  };
  const exCard = (x: typeof DIAMOND_EXCHANGES[number]): string => {
    const afford = dia >= x.diamond;
    const tag = x.tag ? `<div style="position:absolute;top:-9px;right:8px;background:#3a6ea5;color:#dff;font-family:var(--fn);font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px">${x.tag}</div>` : '';
    return `<button class="rc-pack${afford ? '' : ' off'}"${afford ? ` data-act="exchangeBuy" data-k="${x.id}"` : ' disabled'} style="position:relative">${tag}<div class="rc-amt" style="color:var(--gold)">🪙 ${x.gold}</div><div class="rc-price" style="background:#1c3a5a;color:#9fe0ff">💎 ${x.diamond}</div></button>`;
  };
  const shardCard = (x: typeof DIZHI_SHARD_PACKS[number]): string => {
    const afford = dia >= x.diamond;
    const tag = x.tag ? `<div style="position:absolute;top:-9px;right:8px;background:#7a5a2a;color:#ffe;font-family:var(--fn);font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px">${x.tag}</div>` : '';
    return `<button class="rc-pack${afford ? '' : ' off'}"${afford ? ` data-act="shardBuy" data-k="${x.id}"` : ' disabled'} style="position:relative">${tag}<div class="rc-amt" style="color:#e6b96a">🧩 ${x.shards}</div><div class="rc-price" style="background:#1c3a5a;color:#9fe0ff">💎 ${x.diamond}</div></button>`;
  };
  // 投资人彩蛋：第二次起需密码（首充免密·已由 needPw 标识）。
  // 测试版改「点选花色」当密码（owner 2026-06-21·不让打字）：点亮 2 张花色 → 即密码。正确=♥+♠。
  const SUIT_PW: [string, string, string][] = [['♠', '黑桃', '#5b7fb0'], ['♥', '红桃', '#d8504e'], ['♦', '方块', '#e0973a'], ['♣', '梅花', '#3fae6e']];
  const suitTiles = SUIT_PW.map(([g, nm, c]) => {
    const on = rcSuits.includes(g);
    return `<button class="rc-suit${on ? ' on' : ''}" data-act="rcSuit" data-k="${g}" style="flex:1;padding:10px 0;border-radius:10px;cursor:pointer;background:${on ? c : 'var(--chip)'};border:2px solid ${on ? c : 'var(--panel-border)'};color:${on ? '#fff' : c};display:flex;flex-direction:column;align-items:center;gap:2px;box-shadow:${on ? `0 0 12px ${c}88` : 'none'};transition:all .12s"><span style="font-size:24px;line-height:1">${g}</span><span style="font-size:11px;color:${on ? '#fff' : 'var(--ink-dim)'}">${nm}</span></button>`;
  }).join('');
  const pwBlock = needPw
    ? `<div style="margin-top:10px"><div style="font-size:12px;color:var(--ink-dim);margin-bottom:6px">🔒 复充需密码 · <b style="color:var(--ink)">点选 2 张花色</b>（测试版·免打字）<span style="color:var(--gold);margin-left:4px">已选 ${rcSuits.length}/2</span></div><div style="display:flex;gap:8px">${suitTiles}</div>${rechargeErr ? `<div style="color:#e0635f;font-size:12px;margin-top:6px">${rechargeErr}</div>` : ''}</div>`
    : `<div class="note" style="text-align:left;margin-top:6px;font-size:11px">🎁 首充免密「送一点点」体验。</div>`;
  const walletTab = `<div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:4px 0 8px">充值 · 越充越送（Demo·点即到账）</div>
    <div class="rc-grid">${RECHARGE_PACKS.map(packCard).join('')}</div>
    ${pwBlock}
    <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:16px 0 8px">兑换金币 · 💎 → 🪙（改造坊通用材料）</div>
    <div class="rc-grid">${DIAMOND_EXCHANGES.map(exCard).join('')}</div>
    <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:16px 0 8px">兑换地支碎片 · 💎 → 🧩（养地支专属材料）</div>
    <div class="rc-grid">${DIZHI_SHARD_PACKS.map(shardCard).join('')}</div>
    <div class="note" style="text-align:left;margin-top:12px;font-size:11px">Demo 演示：充值为模拟，点击直接到账、不走真实支付。</div>`;
  // ── ✨ 皮肤 tab（闪艺·牌面皮肤·金币购买）──
  const foilCard = (f: LobbyShopItem): string => {
    const st = f.owned ? '<span style="color:var(--gold);font-size:11px">✓ 已拥有</span>' : f.buyable ? `<button class="gacha-craft" data-act="buyFoil" data-k="${f.id}">🪙 ${f.cost}</button>` : `<span style="color:var(--ink-dim);font-size:11px">🪙 ${f.cost}（金币不足）</span>`;
    return `<div class="gacha-pool" style="display:flex;align-items:center;gap:10px"><div style="font-size:24px">✨</div><div style="flex:1"><div class="gacha-pool-hd">${esc(f.name)}</div><div class="note" style="text-align:left;margin:1px 0 0">${esc(f.sub)}</div></div>${st}</div>`;
  };
  const foilTab = `<div class="note" style="text-align:left;margin:2px 0 10px">✨ 闪艺 = 牌面皮肤（纯装饰·不影响战力）。点亮后牌组里的牌带流光皮肤。已拥有 ${view.foils.filter((f) => f.owned).length}/${view.foils.length}。</div>${view.foils.map(foilCard).join('')}`;
  const body = shopTab === 'gacha' ? gachaTab : shopTab === 'foil' ? foilTab : walletTab;
  return `<div class="tut-ov" data-act="recharge-close"><div class="tut-box intro-scroll" data-stop="1" style="width:560px;max-width:100%;display:flex;flex-direction:column">
    <h2>🛒 商城</h2>
    <div class="ctarow" style="margin:4px 0 2px">${tabBtn('gacha', '🎴 抽卡')}${tabBtn('foil', '✨ 皮肤')}${tabBtn('wallet', '💎 钱包')}</div>
    ${bal}
    <div style="height:48vh;min-height:320px;overflow-y:auto;padding-right:4px">${body}</div>
    <div style="text-align:center;margin-top:14px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="recharge-close">完成 →</button></div>
  </div></div>`;
}
// 开包演出（doc25 §四）：展示抽到的卡 + 新得/重复转化结果。
function gachaRevealBox(results: GachaResult[]): string {
  const OUT_CLR: Record<GachaResult['outcome'], string> = { new: 'var(--gold)', 'dup-shard': '#7fb0d8', 'dizhi-up': '#56be84', 'dizhi-shard': '#7fb0d8' };
  const cards = results.map((r) => {
    const clr = OUT_CLR[r.outcome];
    const isNew = r.outcome === 'new' || r.outcome === 'dizhi-up';
    return `<div class="reveal-card" style="border-color:${clr};box-shadow:0 0 16px ${clr}55"><div class="reveal-emoji">${r.kind === 'tiangang' ? '🎴' : '🀄'}</div><div class="reveal-name">${esc(r.name)}</div><div class="reveal-tag" style="color:${clr}">${isNew ? '✦ ' : ''}${esc(r.detail)}</div></div>`;
  }).join('');
  return `<div class="tut-ov" data-act="reveal-close"><div class="tut-box" data-stop="1" style="max-width:560px;text-align:center">
    <h2>🎴 开 包</h2>
    <div class="reveal-grid">${cards}</div>
    <div style="margin-top:14px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="reveal-close">收下 →</button></div>
  </div></div>`;
}

// 叙事演出 overlay（首启开场故事 doc28 §一 / 每关开局演出 doc27 §五 共用）：逐幕旁白 + 下一幕/跳过。
function narrationBox(beats: StoryBeat[], idx: number, label: string, cta: string): string {
  const i = Math.max(0, Math.min(beats.length - 1, idx));
  const b = beats[i];
  const last = i >= beats.length - 1;
  const dots = beats.map((_, k) => `<span style="width:7px;height:7px;border-radius:50%;background:${k === i ? 'var(--gold)' : 'var(--panel-border)'}"></span>`).join('');
  return `<div class="tut-ov story-ov"><div class="tut-box story-box" data-stop="1">
    <div style="font-family:var(--fn);font-size:11px;letter-spacing:.18em;color:var(--gold);text-transform:uppercase">${esc(label)}</div>
    <div style="font-family:var(--fd);font-size:23px;color:var(--ink);margin:10px 0 16px">〔 ${esc(b.scene)} 〕</div>
    <div style="font-size:16px;line-height:2.05;color:var(--ink);min-height:104px">${esc(b.text)}</div>
    <div style="display:flex;align-items:center;gap:7px;margin:18px 0 14px">${dots}</div>
    <div style="display:flex;gap:10px;align-items:center"><button class="cta-sub" data-act="story-skip">跳过</button><div style="flex:1"></div><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="story-next">${last ? esc(cta) : '下一幕 →'}</button></div>
  </div></div>`;
}

// 新手引导（doc28 §二 A/B/C · 线性·点对推进）：每步高亮一个锚点 + 一句话，点中该锚点的动作即进下一步。
// 高亮遮罩复用引擎通用 coachmark 能力（@renderer/coachmark 纯几何 + mountLobby 内薄 DOM 适配·OnboardingOverlay 同法）。教学关战斗本体=甲。
export const GUIDE_COACH: { anchor: string; text: string; advanceAct: string; advanceK?: string; placement: 'top' | 'bottom' }[] = [
  { anchor: 'help', text: '① 先翻一遍《玩法手册》——30 秒看懂怎么打（三路九格 · 每回合四选一 · 掷命对决）。点这里 📖', advanceAct: 'man', placement: 'bottom' },
  { anchor: 'decks', text: '② 配一套出战牌组——点这里进「我的牌组」。', advanceAct: 'tab', advanceK: 'decks', placement: 'bottom' },
  { anchor: 'autobuild-poker', text: '③ 点「✨一键自动构筑」，自动帮你凑 16 张扑克牌库。', advanceAct: 'autoBuildDeck', placement: 'bottom' },
  { anchor: 'tab-gang', text: '④ 再切到「⚡天罡战法」页配天罡。', advanceAct: 'deckTab', advanceK: 'gang', placement: 'bottom' },
  { anchor: 'autobuild-gang', text: '⑤ 点「✨一键配置天罡」，自动凑满天罡战法。', advanceAct: 'autoBuildTiangang', placement: 'bottom' },
  { anchor: 'home', text: '⑥ 配好了！点这里返回「大厅」。', advanceAct: 'tab', advanceK: 'home', placement: 'bottom' },
  { anchor: 'play', text: '⑦ 点「出征」打第一战——温泉关 · 列奥尼达（最易），解封你的第一缕英雄之魂！', advanceAct: 'play', placement: 'top' },
];
// 跳过引导确认对话框（owner 2026-06-20「首页加个跳过引导的对话框」）。
function guideSkipDialog(): string {
  return `<div class="tut-ov"><div class="tut-box" data-stop="1" style="max-width:380px;text-align:center">
    <h3>跳过新手引导？</h3>
    <div class="note" style="margin-top:6px">老手可直接上手。你随时能在顶栏「↻ 引导」重新观看开场与引导。</div>
    <div style="display:flex;gap:10px;margin-top:18px"><button class="cta-sub" style="flex:1" data-act="guide-skip-cancel">继续引导</button><button class="cta-sub" style="flex:1;color:#2a1a08;background:var(--gold-grad);border:0" data-act="guide-skip-confirm">跳过</button></div>
  </div></div>`;
}

// 战役进度屏（doc27 · 关卡选择/进度 + 每关战役背景/Boss对白/地煞/解锁）。锁/通关/当前 由 campaignMax/当前 stage。
function campaignSection(view: LobbyView): string {
  const cur = view.campaign?.stage ?? 1;
  const maxReached = view.campaignMax ?? cur;
  const cards = STAGE_CAMPAIGN.map((c) => {
    const locked = c.stage > maxReached;
    const isCur = c.stage === cur;
    const cleared = c.stage < cur;
    const stars = '★'.repeat(c.stars) + `<span style="opacity:.3">${'★'.repeat(Math.max(0, 3 - c.stars))}</span>`;
    const badge = locked ? `<span style="color:var(--ink-dim)">🔒 未解锁</span>` : isCur ? `<span style="color:var(--gold)">▶ 当前</span>` : cleared ? `<span style="color:var(--club)">✓ 已通关</span>` : `<span style="color:var(--ink-dim)">可重打</span>`;
    const head = `<div style="display:flex;align-items:baseline;gap:10px"><span style="font-family:var(--fd);font-size:26px;color:${locked ? 'var(--ink-dim)' : 'var(--gold)'}">第 ${c.stage} 关</span><span style="font-family:var(--fh);font-weight:700;font-size:16px;color:var(--ink)">${esc(c.battle)}</span><span style="font-size:13px;color:var(--ink-dim)">vs ${esc(c.boss)}</span><span style="margin-left:auto;font-size:12px">${badge}</span></div><div style="font-size:12px;color:var(--gold);margin-top:3px">难度 ${stars}　·　通关解锁天罡 <b>${esc(c.unlock)}</b></div>`;
    if (locked) return `<div class="camp-card locked">${head}<div class="note" style="text-align:left;margin-top:8px;color:var(--ink-dim)">通关第 ${c.stage - 1} 关后解封这一缕英雄之魂。</div></div>`;
    const lines = c.bossLines ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:5px;font-size:12px"><div>🗣️ <span style="color:var(--ink-dim)">开场</span>「${esc(c.bossLines.open)}」</div><div>⚔️ <span style="color:var(--ink-dim)">劣势</span>「${esc(c.bossLines.mid)}」</div><div>💀 <span style="color:var(--ink-dim)">败北</span>「${esc(c.bossLines.lose)}」</div></div>` : '';
    const cDisha = stageDisha(c.stage);
    const fiends = c.fiends.map((f, i) => { const nums = dishaNumberLine(cDisha[i] ?? ''); return `<span class="camp-fiend"><b>${esc(f.name)}</b> ${esc(f.desc)}${nums ? `<br><span class="disha-num">📊 ${esc(nums)}</span>` : ''}</span>`; }).join('');
    const cta = isCur ? `<button class="cta-sub" style="margin-top:12px;color:#2a1a08;background:var(--gold-grad);border:0" data-act="play">${GI.swords} 出征 · 第 ${c.stage} 关 →</button>` : '';
    return `<div class="camp-card${isCur ? ' cur' : ''}">${head}<div style="font-size:13px;line-height:1.85;color:var(--ink);margin-top:9px">${esc(c.intro ?? c.oneLiner)}</div>${lines}<div style="margin-top:10px"><div class="note" style="text-align:left;margin-bottom:5px">🎴 地煞（明牌可破）</div><div class="camp-fiends">${fiends}</div></div>${cta}</div>`;
  }).join('');
  return `<div class="card" style="background:none;border:0;box-shadow:none;padding:0"><h2 style="margin-bottom:4px">⚔️ 命运之战 · 战役进度 <span class="ghost" style="margin-left:auto;font-size:12px">第 ${cur} / ${STAGE_CAMPAIGN.length} 关 · 全 52 役逐步解封</span></h2><div class="note" style="text-align:left;margin-bottom:12px">五十二位被诅咒的名将，每一关是一位英雄的成名之战。打赢=破其诅咒、收魂入麾。</div><div class="camp-list">${cards}</div><div class="note" style="text-align:left;margin-top:14px;color:var(--ink-dim)">🔮 关 6–52（孙武 · 成吉思汗 · 汉尼拔……）战役背景与 Boss 对白已入库，随战役章节逐步开放。</div></div>`;
}

// 改造坊天罡牌货架项（B3）：买入 + 选入/踢出战库双动作 + 牌力/P̂ 展示。
// 地支附魔台（owner 2026-06-20 · 乙简版）：① 选一张扑克牌 → ② 把已拥有的地支生肖镶进去（≤INLAY_MAX 槽）→ +favor。
// 真影响战斗（经 effectiveDeckFavors→myBias）。连携(三合/六合)留甲契约④。
const ENCH_TIER_CLR = ['', '#cd7f32', '#c4ccd6', '#e8cd82']; // 铜银金
// 单牌镶嵌详情（slots + 卡包可镶项）·改造坊附魔台与牌库内附魔弹窗共用（owner 2026-06-21）。
function inlayDetail(view: LobbyView, ix: number): string {
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
function enchantPanel(view: LobbyView, craftSel: string): string {
  const deck = view.deck;
  const inlays = view.inlays ?? {};
  const grid = SUITS.flatMap(([su, c], si) => RANKS.map((rank, ri) => {
    const idx = si * 13 + ri;
    const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
    const fv = deck[idx] ?? 50;
    const n = (inlays[String(idx)] ?? []).length;
    const sel = craftSel === String(idx);
    return `<button class="ench-card${sel ? ' sel' : ''}" data-act="craftSel" data-k="${idx}"><span class="ench-rk" style="color:${c}">${rank}${su}</span><span class="ench-nm">${hero ? esc(hero.name) : ''}</span><span class="ench-fv">${fv}${n ? ` <span style="color:var(--gold)">🀄${n}</span>` : ''}</span></button>`;
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
function ggTip(inner: string): string { return `<div class="gg-tip">${inner}</div>`; }
const KIND_LABEL: Record<string, string> = { odds: '概率·掷命', power: '战力·加成', combo: '牌型·连携', morale: '士气·将领', tempo: '节奏·行军', stamina: '续航·耐久', draw: '抽牌·手牌', lane: '路线·调度', siege: '攻城·破阵', arcane: '流派·印记' };
const tipRow = (label: string, value: string, color = 'var(--ink)'): string =>
  `<div class="gg-tip-row"><span>${label}</span><b style="color:${color}">${value}</b></div>`;
// 天罡牌富文本说明（名/效果/类型/牌力/P̂/解锁/价）。
function tiangangTipHTML(it: LobbyShopItem): string {
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
function craftTiangangItem(it: LobbyShopItem): string {
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
  return `<div class="gg-tipwrap"><div class="${cls}"${buyAttr}><div class="gnm">${stageBadge} ${tiangangIcon(it.icon, it.tint)} ${esc(it.name)}${stars}${phat}</div>${foot}</div>${tiangangTipHTML(it)}</div>`;
}
// 天罡战库预览面板（B3 · HOME+DECKS 屏）：≤5 已选天罡牌 每张【名 + 效果 + 牌力⭐ + P̂】+ 整库总加成汇总。
function deckPreviewPanel(tiangangs: LobbyShopItem[], archName: string | null | undefined, activated: boolean | undefined, size = 12, deckName = ''): string {
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
function deckSetSelector(view: LobbyView): string {
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
function tiangangDeckManager(view: LobbyView): string {
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
function deckPickerBox(view: LobbyView): string {
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
function suitBarsPanel(deck: number[], deckAvg: number): string {
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
export type LuckyRoll = { val: number; label: string; line: string; color: string };
export interface FortuneView { rolls: number; max: number; keptVal: number | null } // 今日卦象状态（owner 2026-06-21·持久化于存档）
// 卦值(1-100) → 吉凶档（纯表现·主页徽标与弹框共用一处推导·不进战斗）。
export function luckyFromVal(val: number): LuckyRoll {
  return val >= 90 ? { val, label: '大吉', color: 'var(--gold)', line: '天命在你·此局必有奇遇，放胆去翻！' }
    : val >= 70 ? { val, label: '吉', color: 'var(--club)', line: '顺风顺水·正是出征好时机。' }
    : val >= 40 ? { val, label: '中平', color: 'var(--ink)', line: '胜负在人·稳扎稳打、看准爆冷缝。' }
    : val >= 15 ? { val, label: '小凶', color: 'var(--diamond)', line: '谨慎出牌·手里留张保命天罡。' }
    : { val, label: '凶', color: 'var(--heart)', line: '爆冷之日——正好赌一把翻盘命！' };
}
// 主页「掷」字互动（owner 2026-06-20）：掷一卦看今日卦象·纯趣味·不进战斗。
// owner 2026-06-21：每日限掷 max 次（显示「今日制卦 N/M」）；「收下此卦」= 选中持久化 → 主页顶显示。
function luckyBox(r: LuckyRoll, fortune?: FortuneView): string {
  const canRoll = !fortune || fortune.rolls < fortune.max;
  const countLine = fortune ? `<div class="note" style="margin-top:8px;font-size:12px">今日制卦 <b style="color:var(--gold)">${fortune.rolls}/${fortune.max}</b> 次${canRoll ? '' : ' · 次数已尽（明日刷新）'}</div>` : '';
  const reroll = canRoll
    ? `<button class="cta-sub" style="flex:1" data-act="lucky">再掷一卦</button>`
    : `<button class="cta-sub" style="flex:1;opacity:.4;cursor:not-allowed" disabled>次数已尽</button>`;
  return `<div class="tut-ov" data-act="lucky-close"><div class="tut-box" data-stop="1" style="max-width:340px;text-align:center">
    <div class="note">🎴 掷命 · 今日卦象</div>
    <div style="font-family:var(--fd);font-size:66px;line-height:1;color:var(--gold);margin:8px 0">${r.val}</div>
    <div style="font-family:var(--fd);font-size:28px;color:${r.color}">${esc(r.label)}</div>
    <div class="note" style="margin-top:8px">${esc(r.line)}</div>
    ${countLine}
    <div style="display:flex;gap:10px;margin-top:18px">${reroll}<button class="cta-sub" style="flex:1;color:#2a1a08;background:var(--gold-grad);border:0" data-act="lucky-keep">收下此卦</button></div>
  </div></div>`;
}
// 充值致谢弹框（owner 2026-06-21·Demo 彩蛋）：确认充值后弹「谢谢老板·已打到君白工资卡」。
function rechargeThanksBox(): string {
  return `<div class="tut-ov" data-act="thanks-close"><div class="tut-box" data-stop="1" style="max-width:360px;text-align:center">
    <div style="font-size:52px;line-height:1;margin:6px 0">💰</div>
    <div style="font-family:var(--fd);font-size:24px;color:var(--gold)">谢谢老板！</div>
    <div class="note" style="margin-top:10px;font-size:14px;line-height:1.7">您充值的金额已如数打到<br><b style="color:var(--ink)">君白</b> 的工资卡 🧧<br><span class="ghost" style="font-size:11px">（Demo 彩蛋·实为模拟到账）</span></div>
    <div style="margin-top:18px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="thanks-close">收下祝福 →</button></div>
  </div></div>`;
}
export interface LobbyOverlayState { helpOpen: boolean; helpTab: 'intro' | 'tut' | 'manual'; manualTier: 'easy' | 'mid' | 'hard'; settingsOpen: boolean; rechargeOpen: boolean; shopTab: 'gacha' | 'wallet' | 'foil'; rechargeErr: string; rcSuits: string[]; rechargeThanks: boolean; gachaReveal: GachaResult[] | null; story: { beats: StoryBeat[]; idx: number; label: string; cta: string } | null; guideSkipAsk: boolean; deckPickerOpen: boolean; lucky: LuckyRoll | null }
export function lobbyOverlaysHTML(view: LobbyView, s: LobbyOverlayState): string {
  return `${s.helpOpen ? helpBox(s.helpTab, s.manualTier) : ''}${s.settingsOpen ? settingsBox(view) : ''}${s.rechargeOpen ? shopBox(view, s.shopTab, s.rechargeErr, s.rcSuits) : ''}${s.rechargeThanks ? rechargeThanksBox() : ''}${s.gachaReveal ? gachaRevealBox(s.gachaReveal) : ''}${s.lucky ? luckyBox(s.lucky, view.fortune) : ''}${s.story ? narrationBox(s.story.beats, s.story.idx, s.story.label, s.story.cta) : ''}${s.guideSkipAsk ? guideSkipDialog() : ''}${s.deckPickerOpen ? deckPickerBox(view) : ''}`;
}
export function renderLobby(view: LobbyView, tab: string, helpOpen: boolean, deckTab: 'base' | 'gang' | 'dizhi' = 'base', earthFilter = 'all', collTab = 'cards', heroSuit = 'all', heroDetail = '', heroRar = 'all', ownedOnly = false, settingsOpen = false, manualTier: 'easy' | 'mid' | 'hard' = 'easy', rechargeOpen = false, rechargeErr = '', story: { beats: StoryBeat[]; idx: number; label: string; cta: string } | null = null, guideSkipAsk = false, shopTab: 'gacha' | 'wallet' | 'foil' = 'wallet', gachaReveal: GachaResult[] | null = null, deckPickerOpen = false, craftSel = '', helpTab: 'intro' | 'tut' | 'manual' = 'intro'): string {
  const on = (t: string): string => (tab === t ? ' on' : '');
  const dOn = (t: string): string => (deckTab === t ? ' on' : '');
  const cOn = (t: string): string => (collTab === t ? ' on' : '');
  const efBtn = (k: string, lbl: string, style: string): string =>
    `<button class="${earthFilter===k?'on':''}" style="${earthFilter===k?style:''}" data-act="earthFilter" data-k="${k}">${lbl}</button>`;
  const stags = SUITS.map(([g, c], i) => `<div class="stag"><span style="color:${c};font-size:14px;text-shadow:0 0 6px ${c}">${g}</span>${['黑桃', '红桃', '方块', '梅花'][i]}</div>`).join('');
  return `<div class="ggl-root" data-skin="${view.skin}"><div class="frame">
  <div class="topbar">
    <div class="seal">♠</div>
    <div class="who"><span class="nm">${esc(view.name)}</span><span class="sub">主牌 · <b>${esc(view.mainCard)}</b></span><span class="sub" style="font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px">${view.archLine}</span><span class="sub" style="font-size:10px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px">${esc(view.bossLine)}</span></div>
    <div class="rankb"><span>♠</span>${esc(view.rankText)}</div>
    <div style="flex:1"></div>
    <button class="tutbtn" data-act="shop" data-anchor="shop" title="商城 · 抽卡 / 充值 / 兑换">🛒 商城</button>
    <button class="coin tap" data-act="recharge" title="金币 · 打战斗赚 · 商城可用💎兑换"><span>🪙</span><b>${kfmt(view.coin)}</b></button>
    <button class="coin tap" data-act="recharge" title="钻石 · 充值 / 兑换材料"><span>💎</span><b style="color:#7fd0ff">${kfmt(view.diamond ?? 0)}</b><span style="color:var(--gold);font-weight:700;margin-left:2px">＋</span></button>
    <button class="coin tap" data-act="recharge" title="地支碎片 · 养地支专属材料（💎可换）"><span>🧩</span><b style="color:#e6b96a">${kfmt(view.dizhiShards ?? 0)}</b></button>
    <button class="coin tap" data-act="shopFoil" title="闪艺 · 牌面皮肤（商城购买）"><span>✨</span><span style="color:#7fb0d8">${view.foilCount}</span></button>
    <button class="tutbtn" data-act="man" data-anchor="help">📚 玩法手册</button>
    <button class="icon" data-act="settings" title="设置 · 皮肤 / 重看引导 / 重置">⚙</button>
  </div>
  <div class="nav">
    <button class="${on('home')}" data-act="tab" data-k="home" data-anchor="home">大厅</button>
    <button class="${on('campaign')}" data-act="tab" data-k="campaign">战役</button>
    <button class="${on('decks')}" data-act="tab" data-k="decks" data-anchor="decks">我的牌组</button>
    <button class="${on('coll')}" data-act="tab" data-k="coll">收藏</button>
    <button class="${on('craft')}" data-act="tab" data-k="craft">改造坊</button>
    <button class="${on('ladder')}" data-act="tab" data-k="ladder">天梯</button>
  </div>
  <div class="content">
    ${(() => {
      const c = view.campaign;
      const stars = c ? '★'.repeat(c.stars) + '<span style="opacity:.35">' + '★'.repeat(3 - c.stars) + '</span>' : '';
      const hDisha = c ? stageDisha(c.stage) : [];
      // 地煞牌悬浮即出详情（owner 2026-06-21·不用点·往左弹不溢出右屏）：名 + 招牌战术说明 + 数值。
      const fiends = c ? c.fiends.map((f, i) => { const nums = dishaNumberLine(hDisha[i] ?? ''); return `<div class="fiend gg-tipwrap tip-left" style="cursor:help"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span>${nums ? `<span class="disha-num">📊 ${esc(nums)}</span>` : ''}<div class="gg-tip"><h4 style="color:var(--gold)">🎴 ${esc(f.name)}</h4><div class="gg-tip-eff">${esc(f.desc)}</div>${nums ? `<div class="gg-tip-row"><span>📊 数值</span><b style="color:var(--gold)">${esc(nums)}</b></div>` : ''}<div class="gg-tip-row"><span>性质</span><b style="color:var(--club)">明牌 · 公平可破</b></div></div></div>`; }).join('') : '';
      return `<section class="screen${on('home')} homerow" data-screen="home">
      <div class="herocol">
        <div class="felt">
          <div class="vignette"></div>
          ${(() => {
            // 今日卦象徽标（owner 2026-06-21）：收下卦后显示在主页顶；点徽标可再开掷命弹框。
            const f = view.fortune;
            if (!f || f.keptVal == null) return '';
            const lk = luckyFromVal(f.keptVal);
            return `<button class="gg-fortune" data-act="lucky" title="今日卦象 · 点开再掷/查看" style="position:absolute;top:12px;right:14px;z-index:4;display:flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;cursor:pointer;background:linear-gradient(160deg,rgba(20,28,40,.92),rgba(12,18,28,.92));border:1px solid var(--gold);box-shadow:0 4px 14px rgba(0,0,0,.4)"><span style="font-size:14px">🎴</span><span style="font-family:var(--fh);font-weight:700;font-size:12px;color:var(--ink-dim)">今日卦象</span><span style="font-family:var(--fd);font-size:18px;color:${lk.color};line-height:1">${esc(lk.label)}</span><span style="font-family:var(--fn);font-size:13px;color:var(--gold)">${f.keptVal}</span></button>`;
          })()}
          <div class="felt-h"><span class="t">${c ? `第 ${c.stage} 关 · ${esc(c.battle)}` : '戏牌师'}</span><span class="s">${c ? `执掌命运之人 · 挑战被诅咒的 ${esc(c.boss)}` : esc(view.stageLabel)}</span></div>
          <div class="stags">${stags}</div>
          <div class="duel">
            <div class="dcard" style="border:3px solid var(--spade);transform:rotate(-9deg);--rot:-9deg"><div class="corner" style="color:var(--spade)">A<br>♠</div><div class="big" style="color:var(--spade)">♠</div></div>
            <button class="vs vs-btn" data-act="lucky" title="掷一卦 · 看今日运势">掷</button>
            <div class="dback"><i></i></div>
          </div>
          ${c ? `<div style="position:absolute;left:0;right:0;bottom:104px;text-align:center;color:#fff;font-size:13px;text-shadow:0 2px 8px rgba(0,0,0,.7)">⚔ 对决 <b style="font-family:var(--fd);font-size:18px">${esc(c.boss)}</b> · <span style="opacity:.85">${esc(c.oneLiner)}</span></div>` : ''}
          <div class="ctawrap">
            <button class="cta-main" data-act="play" data-anchor="play"><span class="sheen"></span><span class="big">${GI.swords} 出征 · ${c ? `第 ${c.stage} 关` : esc(view.rankText)}</span><span class="sm">${c ? `挑战 ${esc(c.boss)} · ${esc(c.battle)} · 难度 ${stars}` : 'DEPLOY · 单人战役 vs AI 庄家'}</span></button>
            <div class="ctarow"><button class="cta-sub" data-act="man">📖 玩法手册</button></div>
          </div>
        </div>
        ${deckPreviewPanel(view.tiangangs, view.deckArchName, view.deckArchActivated, view.deckSize ?? 12, view.activeDeckName)}
      </div>
      <div class="rail"><h2 class="${c ? 'gg-tipwrap tip-left' : ''}" style="${c ? 'cursor:help' : ''}">⚔ 本关 Boss · ${esc(c?.boss ?? '—')}${c ? `<div class="gg-tip"><h4 style="color:var(--heart)">${esc(c.boss)} · ${esc(c.battle)}</h4><div class="gg-tip-eff">${esc(c.intro ?? c.oneLiner)}</div>${c.bossLines ? `<div style="font-family:var(--fd);font-size:14px;color:var(--gold);margin-top:6px">「${esc(c.bossLines.open)}」</div>` : ''}<div class="gg-tip-row"><span>难度</span><b style="color:var(--gold)">${stars}</b></div><div class="gg-tip-row"><span>通关解锁</span><b style="color:var(--gold)">${esc(c.unlock)}</b></div></div>` : ''}</h2>
        <div style="font-size:13px;color:var(--ink);margin-bottom:4px">${c ? `${esc(c.boss)} · <span class="ghost">${esc(c.battle)}</span>` : ''}</div>
        <div style="font-size:12px;color:var(--ink-dim);margin-bottom:10px">难度 <span style="color:var(--gold)">${stars}</span>　${c ? esc(c.oneLiner) : ''}</div>
        <div class="note" style="text-align:left;margin-bottom:8px">🎴 <b>地煞</b>（明牌·公平可破）— Boss 的招牌历史战术：</div>
        ${fiends}
        ${c ? `<div style="margin-top:12px;padding:9px 11px;border-radius:9px;background:rgba(232,205,130,.10);border:1px solid var(--hairline);font-size:12px">🏆 打赢 = 破其诅咒 · 通关解锁天罡 <b style="color:var(--gold)">${esc(c.unlock)}</b></div>` : ''}
        <div class="ghost" style="font-size:11px;line-height:1.7;margin-top:10px">好友切磋 / 天梯 1v1 = 设计 IA·待接网络。当前 = 单人 52 战役 vs AI 庄家。</div>
      </div>
    </section>`;
    })()}
    <section class="screen${on('campaign')} full" data-screen="campaign" style="flex-direction:column;overflow-y:auto">${campaignSection(view)}</section>
    <section class="screen${on('decks')} full" data-screen="decks">${deckSetSelector(view)}<div class="deck-nav"><button class="${deckTab==='base'?'on':''}" data-act="deckTab" data-k="base">🎴 扑克牌库</button><button class="${deckTab==='gang'?'on':''}" data-act="deckTab" data-k="gang" data-anchor="tab-gang">⚡ 天罡战法</button><button class="${deckTab==='dizhi'?'on':''}" data-act="deckTab" data-k="dizhi">🀄 地支牌</button></div><div class="dsub${dOn('base')}" data-dsub="base">${pokerBuildPanel(view)}</div><div class="dsub${dOn('gang')}" data-dsub="gang">${tiangangDeckManager(view)}</div><div class="dsub${dOn('dizhi')}" data-dsub="dizhi"><div class="card"><h2>${GI.planet} 地支牌 · 十二生肖 <span class="ghost" style="margin-left:auto;font-size:12px">铜→银→金 · 镶进牌附魔（改造坊）</span></h2><div class="earth-filter">${efBtn('all','全部','background:var(--gold-grad);color:#2a1a08;border:0')}${efBtn('bronze','铜','background:#cd7f32;color:#fff;border:0')}${efBtn('silver','银','background:#c4ccd6;color:#2a2a2a;border:0')}${efBtn('gold','金','background:var(--gold-grad);color:#2a1a08;border:0')}</div>${earthSection(earthFilter, view.dizhiBag ?? {})}</div></div></section>
    <section class="screen${on('coll')} full" data-screen="coll" style="flex-direction:column"><div class="deck-nav"><button class="${collTab==='cards'?'on':''}" data-act="collTab" data-k="cards">收藏·牌谱</button><button class="${collTab==='ladder'?'on':''}" data-act="collTab" data-k="ladder">天梯·榜</button><button class="${collTab==='fiends'?'on':''}" data-act="collTab" data-k="fiends">地煞·战法</button><button class="${collTab==='collect'?'on':''}" data-act="collTab" data-k="collect">天罡&amp;闪艺</button></div><div class="dsub${cOn('cards')}" data-dsub="cards" style="flex:1;min-height:0;flex-direction:column">${heroCollSection(heroSuit, heroRar, heroDetail, ownedOnly)}</div><div class="dsub${cOn('ladder')}" data-dsub="ladder" style="flex:1;min-height:0;flex-direction:column">${ladderSection(view.name, view.rankText)}</div><div class="dsub${cOn('fiends')}" data-dsub="fiends" style="flex:1;min-height:0;flex-direction:column">${fiendsCodex(view.campaignMax ?? 1)}</div><div class="dsub${cOn('collect')}" data-dsub="collect"><div class="card"><h2>🗃 天罡牌 · 收藏 ${view.tiangangs.filter((j) => j.owned).length}/${view.tiangangs.length}</h2><div class="note" style="text-align:left;margin-bottom:6px">⚡ 已解锁天罡牌（到「牌组」屏编入出战牌组）</div><div class="shelf">${view.tiangangs.map((j) => shopItem('', tiangangIcon(j.icon, j.tint), { ...j, buyable: false })).join('')}</div><div class="note" style="text-align:left;margin:12px 0 6px">✨ 闪艺 foil（纯装饰收集 · 点亮可购买）· ${view.foils.filter((f) => f.owned).length}/${view.foils.length}</div><div class="shelf">${view.foils.map((f) => shopItem('buyFoil', '✨', f)).join('')}</div></div></div></section>
    <section class="screen${on('craft')} full" data-screen="craft"><div class="craft-zones">
      ${enchantPanel(view, craftSel)}
      <div class="card"><h2>${GI.bolt} 天罡牌 · 购买 <span class="ghost" style="margin-left:auto;font-size:12px">局内法术·买入后到牌组编入</span></h2>
        <div class="note" style="text-align:left;margin-bottom:8px">花金币买入天罡牌（解锁后入「拥有」）；编进出战牌组到「牌组」屏做。</div>
        <div class="shelf">${view.tiangangs.map((j) => craftTiangangItem(j)).join('')}</div></div>
    </div></section>
    <section class="screen${on('ladder')} full" data-screen="ladder">${ladderSection(view.name, view.rankText)}</section>
  </div>
  </div><div id="gv-ov" style="display:contents">${lobbyOverlaysHTML(view, { helpOpen, helpTab, manualTier, settingsOpen, rechargeOpen, shopTab, rechargeErr, rcSuits: [], rechargeThanks: false, gachaReveal, story, guideSkipAsk, deckPickerOpen, lucky: null })}</div></div>`;
}

export interface LobbyHandlers {
  getView: () => LobbyView;
  onPlay: () => void;
  onBuyTiangang?: (id: string) => void;
  onBuyPlanet?: (id: string) => void;
  onBuyFoil?: (id: string) => void;
  onToggleTiangang?: (id: string) => void; // 选入/踢出**出战牌组**（≤deckSize）
  onDiamondUnlock?: (id: string) => void; // 钻石速购解锁天罡（doc25·跳关门槛）
  onRecharge?: (packId: string, password: string) => boolean | void; // 充值 ¥→💎（Demo·首充免密/复充需密码）→ true=成功
  onRollFortune?: () => number | null; // 掷今日卦象（持久计数·返卦值1-100；次数已尽返 null）（owner 2026-06-21）
  onKeepFortune?: (val: number) => void; // 收下今日卦象（持久化选中→主页顶展示）
  onExchange?: (exId: string) => void; // 兑换 💎→🪙金币
  onBuyShards?: (exId: string) => void; // 兑换 💎→🧩地支碎片
  onGacha?: (pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond') => GachaResult[] | null; // 抽卡（doc25 §四）→ 结果/null(买不起)
  onCraftTiangang?: (id: string) => boolean | void; // 天罡碎片定向兑换指定天罡（保底）
  onCraftDizhi?: (branch: string) => boolean | void; // 地支碎片定向兑换/升指定生肖（owner 2026-06-21）
  onInlay?: (idx: string, branch: string, tier: number) => boolean | void; // 地支附魔：把卡包某档生肖镶进牌位（消耗一张·≤INLAY_MAX）
  onRemoveInlay?: (idx: string, slot: number) => void; // 卸下某牌位第 slot 个镶嵌（永久消耗不退）
  onSelectDeck?: (id: string) => void; // 选某牌组出战
  onNewDeck?: () => void; // 新建牌组
  onDelDeck?: (id: string) => void; // 删除牌组
  onTogglePick?: (cardId: string) => void; // 出战扑克牌组：点牌入/出（≤POKER_PICK_SIZE·乙1）
  onAutoBuildDeck?: () => void; // 一键自动构筑出战扑克牌组（乙3）
  onClearPicks?: () => void; // 清空出战扑克牌组
  onAutoBuildTiangang?: () => void; // 一键配置天罡战法（从已拥有里自动凑满·owner 2026-06-21）
  onReset?: () => void;
  onSkin?: (skin: 'onyx' | 'rosy') => void;
  onIntroSeen?: () => void; // 看完开场故事（doc28 §一）→ 标记已看 + 起引导
  onGuideStep?: (n: number) => void; // 新手引导步进（doc28 §二）
  onGuideDone?: () => void; // 完成/跳过引导
  onReplayIntro?: () => void; // 重看开场故事 + 引导
  onExitGame?: () => void; // 退出到游戏库（壳层钩子·收进设置·owner 2026-06-21）
}

export function mountLobby(host: HTMLElement, h: LobbyHandlers): { update: () => void; destroy: () => void } {
  if (!document.getElementById('ggl-css')) { const s = document.createElement('style'); s.id = 'ggl-css'; s.textContent = LOBBY_CSS; document.head.appendChild(s); }
  let tab = 'home';
  let deckTab: 'base' | 'gang' | 'dizhi' = 'base';
  let earthFilter = 'all';
  let collTab = 'cards';
  let heroSuit = 'all';
  let heroDetail = '';
  let heroRar = 'all';
  let ownedOnly = false;
  let skin: 'onyx' | 'rosy' = h.getView().skin;
  let help = false;
  let helpTab: 'intro' | 'tut' | 'manual' = 'intro';
  let manTier: 'easy' | 'mid' | 'hard' = 'easy';
  let settings = false;
  let recharge = false;
  let rechargeErr = '';
  let rcSuits: string[] = []; // 充值密码点选的花色（测试版·≤2·owner 2026-06-21）
  let rechargeThanks = false; // 充值成功致谢弹框
  let story: { beats: StoryBeat[]; idx: number; label: string; cta: string; then: 'close' | 'play' | 'guide' } | null = null;
  let guideSkipAsk = false;
  let shopTab: 'gacha' | 'wallet' | 'foil' = 'wallet';
  let gachaReveal: GachaResult[] | null = null;
  let deckPicker = false;
  let craftSel = '';
  const render = (): void => { host.innerHTML = renderLobby({ ...h.getView(), skin }, tab, help, deckTab, earthFilter, collTab, heroSuit, heroDetail, heroRar, ownedOnly, settings, manTier, recharge, rechargeErr, story, guideSkipAsk, shopTab, gachaReveal, deckPicker, craftSel, helpTab); updateCoach(); };
  let lucky: LuckyRoll | null = null;
  // 新手引导高亮层（doc28 A/B/C·复用引擎 coachmark 纯几何 + 薄 DOM 适配）：全屏 dim 镂空当前步锚点 + 气泡 + 跳过。
  // 挂 document.body 真视口固定（避开 .ggl-root 若有 transform 包住 fixed 的坑）；render 不会动它，只 updateCoach 重算。
  const coachLayer = (host.ownerDocument ?? document).createElement('div');
  coachLayer.className = 'gg-coach-layer';
  coachLayer.style.cssText = 'position:fixed;inset:0;z-index:70;pointer-events:none';
  const anyOverlayOpen = (): boolean => help || recharge || settings || guideSkipAsk || deckPicker || rechargeThanks || !!story || !!gachaReveal || !!lucky;
  const updateCoach = (): void => {
    const v = h.getView();
    const gs = v.guideStep ?? -1;
    if (v.firstLaunch || gs < 0 || gs >= GUIDE_COACH.length || anyOverlayOpen()) { coachLayer.innerHTML = ''; return; }
    const spec = GUIDE_COACH[gs];
    const el = host.querySelector(`[data-anchor="${spec.anchor}"]`) as HTMLElement | null;
    if (!el) { coachLayer.innerHTML = ''; return; } // 锚点不在当前 DOM → 本次不画
    if (el.closest('.dsub:not(.on), .screen:not(.on)')) { coachLayer.innerHTML = ''; return; } // 锚点在隐藏子页/未激活屏 → 不画歪
    const r = el.getBoundingClientRect();
    const vp = { w: window.innerWidth || 1280, h: window.innerHeight || 800 };
    const g = coachmarkGeometry({ x: r.left, y: r.top, w: r.width, h: r.height }, vp, { shape: 'rect', pad: 7, placement: spec.placement, bubbleW: 304, bubbleH: 66 });
    const c = g.cutout, b = g.bubble;
    const cx = c.x + c.w / 2;
    const ax = Math.max(b.x + 12, Math.min(cx, b.x + b.w - 12)); // 箭头横向对齐高亮中心（夹进气泡）
    const up = g.placement === 'bottom'; // 气泡在下方 → 箭头朝上指向高亮；否则朝下
    // 气泡竖向锚定：朝上(placement top)时按**底边**锚定(气泡向上长·绝不盖住高亮按钮·owner 2026-06-21「往上一点」)；朝下时按顶边。
    const vpos = up ? `top:${b.y}px` : `bottom:${Math.round(vp.h - (c.y - 14))}px`;
    const arrow = `<div style="position:absolute;left:${ax - 10}px;top:${up ? c.y + c.h + 3 : c.y - 15}px;width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;${up ? 'border-bottom:12px solid var(--gold)' : 'border-top:12px solid var(--gold)'};filter:drop-shadow(0 0 5px rgba(232,205,130,.7));animation:gg-coach-arrow 1.1s ease-in-out infinite"></div>`;
    coachLayer.innerHTML =
      `<div style="position:absolute;left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;border-radius:9px;box-shadow:0 0 0 9999px rgba(8,10,14,.72);transition:all .18s"></div>` +
      `<div style="position:absolute;left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;border-radius:9px;animation:gg-coach-ring 1.4s ease-in-out infinite;pointer-events:none"></div>` + // 金边脉冲圈·让高亮醒目
      arrow +
      `<div style="position:absolute;left:${b.x}px;${vpos};width:${b.w}px;background:linear-gradient(160deg,#1b2233,#10141d);border:1px solid var(--gold);border-radius:12px;color:#ece6f5;font:600 13px/1.62 var(--fb);padding:11px 14px;box-shadow:0 12px 32px rgba(0,0,0,.6);pointer-events:auto">` +
        `<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;letter-spacing:.1em;color:var(--gold)">🧭 新手引导 ${gs + 1}/${GUIDE_COACH.length}</span><button data-act="guide-skip" style="margin-left:auto;background:none;border:0;color:#9fb0c0;font-size:11px;text-decoration:underline;cursor:pointer">跳过引导</button></div>` +
        `<div style="margin-top:5px">${esc(spec.text)}</div>` +
      `</div>`;
  };
  const onCoachClick = (e: MouseEvent): void => { const t = (e.target as HTMLElement).closest('[data-act="guide-skip"]'); if (t) { playSfx(sfxForAct('guide-skip')); guideSkipAsk = true; renderOv(); updateCoach(); } };
  coachLayer.addEventListener('click', onCoachClick);
  const onResize = (): void => updateCoach();
  const ovState = (): LobbyOverlayState => ({ helpOpen: help, helpTab, manualTier: manTier, settingsOpen: settings, rechargeOpen: recharge, shopTab, rechargeErr, rcSuits, rechargeThanks, gachaReveal, story, guideSkipAsk, deckPickerOpen: deckPicker, lucky });
  const localRollVal = (): number => 1 + Math.floor(Math.random() * 100); // 无 onRollFortune 句柄时的本地兜底（测试/独立预览）
  // 抗闪屏：只更新弹层 #gv-ov（不重建大厅主体）。弹层打开/内部导航/关闭都走它 → 不再整屏闪。
  const renderOv = (): void => { const o = host.querySelector('#gv-ov'); if (o) o.innerHTML = lobbyOverlaysHTML({ ...h.getView(), skin }, ovState()); else render(); updateCoach(); };
  // 抗闪屏·导航：切 tab/子页 = 只切 .on class，不重建任何内容（含 52 张 SVG）→ 不闪。
  const setTab = (t: string): void => {
    tab = t;
    const root = host.querySelector('.ggl-root'); if (!root) { render(); return; }
    root.querySelectorAll('.nav button[data-act="tab"]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === t));
    root.querySelectorAll('section[data-screen]').forEach((s) => s.classList.toggle('on', (s as HTMLElement).dataset.screen === t));
    updateCoach(); // 换屏后锚点可见性变 → 重算高亮
  };
  // 构筑选牌定点刷新（owner 2026-06-21 bug：点牌不该整屏重渲+跳回顶部）：只切卡的选中态类 + 重渲动态头（计数/曲线），不重建 52 网格、不动滚动。
  const renderPicks = (): void => {
    const base = host.querySelector('section[data-screen="decks"] .dsub[data-dsub="base"]');
    if (!base) { render(); return; }
    const picks = new Set(h.getView().pokerPicks ?? []);
    const max = h.getView().pokerPickMax ?? POKER_PICK_SIZE;
    base.querySelectorAll('.pcard-wrap[data-act="pickCard"]').forEach((w) => {
      const on = picks.has((w as HTMLElement).dataset.k ?? '');
      w.classList.toggle('is-picked', on);
      w.querySelector('.pcard')?.classList.toggle('picked', on);
    });
    base.querySelector('.pbuild-grid')?.classList.toggle('full', picks.size >= max);
    const head = base.querySelector('.pbuild-head'); if (head) head.innerHTML = pokerBuildHead({ ...h.getView(), skin });
  };
  const setSub = (section: string, actName: string, k: string): void => {
    const sec = host.querySelector(`section[data-screen="${section}"]`); if (!sec) { render(); return; }
    sec.querySelectorAll(`[data-act="${actName}"]`).forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === k));
    sec.querySelectorAll('.dsub[data-dsub]').forEach((d) => d.classList.toggle('on', (d as HTMLElement).dataset.dsub === k));
  };
  // 每关开局演出（doc27 §五）：战役背景 + Boss 开场白 → 出征。缺 intro 则直接进战斗。
  const levelBeats = (c: StageCampaign): StoryBeat[] => [
    { scene: c.battle, text: c.intro ?? c.oneLiner },
    ...(c.bossLines ? [{ scene: `${c.boss} · 开场`, text: c.bossLines.open }] : []),
  ];
  const startPlay = (): void => { const c = h.getView().campaign; if (c && c.intro) { story = { beats: levelBeats(c), idx: 0, label: `第 ${c.stage} 关 · ${c.battle}`, cta: `出征 · 第 ${c.stage} 关`, then: 'play' }; renderOv(); } else h.onPlay(); };
  const playOpeningStory = (): void => { story = { beats: STORY_OPENING, idx: 0, label: '翻命扑克 · 序章', cta: '执掌命运 →', then: 'guide' }; };
  const finishStory = (): void => { const then = story?.then ?? 'close'; story = null; if (then === 'play') { renderOv(); h.onPlay(); } else if (then === 'guide') { h.onIntroSeen?.(); renderOv(); } else renderOv(); };
  const onClick = (e: MouseEvent): void => {
    const tgt = e.target as HTMLElement;
    const el = tgt.closest('[data-act]') as HTMLElement | null; if (!el) return;
    // 弹层「点背景关闭」防误触（owner 2026-06-21 bug：充值想点密码框→反而关了菜单）：
    // 命中的 data-act 是背景(.tut-ov)、但点击其实落在对话框(data-stop)内空白处 → 不关。真背景点(stop=null)或框内按钮(el 在 stop 内)照常。
    const stop = tgt.closest('[data-stop]');
    if (stop && el !== stop && el.contains(stop)) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act) playSfx(sfxForAct(act)); // 菜单音效（程序化合成·静音/无音频上下文则静默）
    // 新手引导点对推进（doc28·coachmark）：点中当前步锚点的动作（advanceAct[+advanceK]）→ 进下一步/完成。
    const _gs = h.getView().guideStep ?? -1;
    if (_gs >= 0 && _gs < GUIDE_COACH.length) { const _st = GUIDE_COACH[_gs]; if (act === _st.advanceAct && (!_st.advanceK || k === _st.advanceK)) { if (_gs < GUIDE_COACH.length - 1) h.onGuideStep?.(_gs + 1); else h.onGuideDone?.(); } }
    if (act === 'sfxToggle') { setSfxMuted(!isSfxMuted()); renderOv(); }
    // 背景音乐（menu 设置·owner 2026-06-21）：开关 / 选 3 首之一 / 音量 −＋。直接调 bgm.ts（点击=用户手势·可起播）。
    else if (act === 'bgmToggle') { toggleBgm(); renderOv(); }
    else if (act === 'bgmTrack') { selectBgm(parseInt(k, 10) || 0); renderOv(); }
    else if (act === 'bgmVol') { setBgmVolume(bgmVolume() + (k === 'up' ? 0.1 : -0.1)); renderOv(); }
    else if (act === 'tab') { setTab(k); }
    else if (act === 'deckTab') { deckTab = k === 'gang' ? 'gang' : k === 'dizhi' ? 'dizhi' : 'base'; setSub('decks', 'deckTab', deckTab); }
    else if (act === 'earthFilter') { earthFilter = k; render(); }
    else if (act === 'collTab') { collTab = k; setSub('coll', 'collTab', k); }
    else if (act === 'heroSuit') { heroSuit = k; heroDetail = ''; render(); }
    else if (act === 'heroRar') { heroRar = k; heroDetail = ''; render(); }
    else if (act === 'heroDetail') { heroDetail = heroDetail === k ? '' : k; render(); }
    else if (act === 'heroOwned') { ownedOnly = !ownedOnly; render(); }
    else if (act === 'skin') { skin = k === 'rosy' ? 'rosy' : 'onyx'; h.onSkin?.(skin); const r = host.querySelector('.ggl-root') as HTMLElement | null; if (r) r.dataset.skin = skin; renderOv(); } // 皮肤=改 data-skin 属性，不重建
    // 帮助中心（介绍/指导/手册 三合一）：弹层导航 → 只更新弹层（不闪）
    else if (act === 'intro') { help = true; helpTab = 'intro'; renderOv(); }
    else if (act === 'tut') { help = true; helpTab = 'tut'; renderOv(); }
    else if (act === 'man') { help = true; helpTab = 'manual'; renderOv(); }
    else if (act === 'helpTab') { helpTab = k === 'tut' ? 'tut' : k === 'manual' ? 'manual' : 'intro'; renderOv(); }
    else if (act === 'manTier') { manTier = k as 'easy' | 'mid' | 'hard'; renderOv(); }
    else if (act === 'help-close') { help = false; renderOv(); }
    // 设置
    else if (act === 'settings') { settings = true; renderOv(); }
    else if (act === 'settings-close') { settings = false; renderOv(); }
    else if (act === 'play') { startPlay(); }
    // 掷命卦象（owner 2026-06-21）：还能掷→走 onRollFortune（持久计数+1）取新卦；次数已尽→展示已收下的卦。
    else if (act === 'lucky') { const fo = h.getView().fortune; if (!fo || fo.rolls < fo.max) { const v = h.onRollFortune?.(); lucky = luckyFromVal(typeof v === 'number' ? v : localRollVal()); } else { lucky = luckyFromVal(fo.keptVal ?? 50); } renderOv(); }
    // 收下此卦：持久化为今日选中 → 关弹框 + 整屏重渲（主页顶徽标随之出现/更新）。
    else if (act === 'lucky-keep') { if (lucky) h.onKeepFortune?.(lucky.val); lucky = null; render(); }
    else if (act === 'lucky-close') { lucky = null; renderOv(); }
    else if (act === 'story-next') { if (!story) return; if (story.idx < story.beats.length - 1) { story.idx++; renderOv(); } else finishStory(); }
    else if (act === 'story-skip') { finishStory(); }
    // 新手引导（doc28 A/B/C·coachmark）：跳过确认 / 重看（步进=点对推进·见上方 advanceAct）
    else if (act === 'guide-skip') { guideSkipAsk = true; renderOv(); }
    else if (act === 'guide-skip-cancel') { guideSkipAsk = false; renderOv(); }
    else if (act === 'guide-skip-confirm') { guideSkipAsk = false; h.onGuideDone?.(); renderOv(); }
    else if (act === 'replayIntro') { h.onReplayIntro?.(); settings = false; tab = 'home'; playOpeningStory(); render(); }
    // 直购天罡也走开包演出（owner 2026-06-21 bug：购买天罡没见卡牌包）：买成功(新解锁)→弹开包卡
    else if (act === 'buyTiangang') { const was = h.getView().tiangangs.find((t) => t.id === k)?.owned ?? false; h.onBuyTiangang?.(k); const t = h.getView().tiangangs.find((t) => t.id === k); if (t?.owned && !was) gachaReveal = [{ kind: 'tiangang', id: k, name: t.name, outcome: 'new', detail: '🎴 购买解锁 ✓ 已入收藏与出战牌组' }]; render(); }
    else if (act === 'buyPlanet') { h.onBuyPlanet?.(k); render(); }
    else if (act === 'buyFoil') { h.onBuyFoil?.(k); if (recharge) renderOv(); else render(); } // 商城里买→只刷弹层
    else if (act === 'toggleTiangang') { h.onToggleTiangang?.(k); if (deckPicker) renderOv(); else render(); } // 弹窗选卡时只更新弹层
    else if (act === 'diamondUnlock') { const was = h.getView().tiangangs.find((t) => t.id === k)?.owned ?? false; h.onDiamondUnlock?.(k); const t = h.getView().tiangangs.find((t) => t.id === k); if (t?.owned && !was) gachaReveal = [{ kind: 'tiangang', id: k, name: t.name, outcome: 'new', detail: '💎 速解解锁 ✓ 已入收藏与出战牌组' }]; render(); }
    else if (act === 'shop') { recharge = true; shopTab = 'gacha'; rechargeErr = ''; renderOv(); }
    else if (act === 'shopFoil') { recharge = true; shopTab = 'foil'; rechargeErr = ''; renderOv(); }
    else if (act === 'recharge') { recharge = true; shopTab = 'wallet'; rechargeErr = ''; renderOv(); }
    else if (act === 'recharge-close') { recharge = false; rechargeErr = ''; rcSuits = []; render(); } // 关商城→刷新主体（拥有/余额可能变）
    else if (act === 'shopTab') { shopTab = k === 'gacha' ? 'gacha' : k === 'foil' ? 'foil' : 'wallet'; renderOv(); }
    // 充值密码点选花色（测试版·owner 2026-06-21）：点亮/熄灭花色（≤2）；满 2 后再点别的先顶掉最早一张。
    else if (act === 'rcSuit') { if (rcSuits.includes(k)) rcSuits = rcSuits.filter((s) => s !== k); else { rcSuits = [...rcSuits, k]; if (rcSuits.length > 2) rcSuits = rcSuits.slice(-2); } rechargeErr = ''; renderOv(); }
    // 确认充值：花色组合→规范化密码→onRecharge。成功(非 false)→清花色+弹「谢谢老板」致谢；失败→提示密码错。
    else if (act === 'rechargeBuy') { const pw = canonSuitPw(rcSuits); const ok = h.onRecharge?.(k, pw); if (ok === false) { rechargeErr = '密码不对·请点选正确的 2 张花色'; renderOv(); } else { rcSuits = []; rechargeErr = ''; rechargeThanks = true; renderOv(); } }
    else if (act === 'thanks-close') { rechargeThanks = false; renderOv(); }
    else if (act === 'exchangeBuy') { h.onExchange?.(k); renderOv(); }
    else if (act === 'shardBuy') { h.onBuyShards?.(k); renderOv(); }
    // 抽卡（doc25 §四）：data-k="pool:count:pay" → onGacha → 开包演出；定向兑换 / 关闭演出
    else if (act === 'gacha') { const [pool, cnt, pay] = k.split(':'); const r = h.onGacha?.(pool as 'tiangang' | 'dizhi', cnt === '10' ? 10 : 1, pay === 'diamond' ? 'diamond' : 'gold'); if (r && r.length) gachaReveal = r; renderOv(); }
    else if (act === 'craftTiangang') { const ok = h.onCraftTiangang?.(k); if (ok) { const nm = h.getView().tiangangs.find((t) => t.id === k)?.name ?? k; gachaReveal = [{ kind: 'tiangang', id: k, name: nm, outcome: 'new', detail: '碎片定向兑换 ✓' }]; } renderOv(); }
    else if (act === 'craftDizhi') { const ok = h.onCraftDizhi?.(k); if (ok) { const z = DIZHI_ZODIACS.find((z) => z.branch === k); const top = dizhiTopTier((h.getView().dizhiBag ?? {})[k]); const n = dizhiTotal((h.getView().dizhiBag ?? {})[k]); gachaReveal = [{ kind: 'dizhi', id: k, name: `${z?.animal ?? k}·${DIZHI_TIER_NM[top]}×${n}`, outcome: 'dizhi-up', detail: '🧩 地支碎片兑换 ✓ 进卡包' }]; } renderOv(); }
    else if (act === 'reveal-close') { gachaReveal = null; render(); } // 关开包→刷新主体（新卡入库）
    else if (act === 'selectDeck') { h.onSelectDeck?.(k); render(); }
    else if (act === 'newDeck') { h.onNewDeck?.(); render(); }
    else if (act === 'delDeck') { h.onDelDeck?.(k); render(); }
    // 出战扑克牌组构筑（乙1/乙3）：点牌入/出 · 一键自动构筑 · 清空 → 改 save.pokerPicks → **定点刷新**（不重建网格·不跳屏）
    else if (act === 'pickCard') { h.onTogglePick?.(k); renderPicks(); }
    else if (act === 'autoBuildDeck') { h.onAutoBuildDeck?.(); renderPicks(); }
    else if (act === 'clearPicks') { h.onClearPicks?.(); renderPicks(); }
    else if (act === 'autoBuildTiangang') { h.onAutoBuildTiangang?.(); render(); }
    // 天罡牌组编辑：主页「编辑牌组」跳牌组屏天罡页 / 空槽弹选卡窗 / 关窗
    else if (act === 'editDeck') { tab = 'decks'; deckTab = 'gang'; render(); }
    else if (act === 'deckAdd') { deckPicker = true; renderOv(); }
    else if (act === 'deckPicker-close') { deckPicker = false; render(); } // 关弹窗→刷新主体（牌组槽变化）
    // 地支附魔台：选牌 / 镶入 / 卸下
    else if (act === 'craftSel') { craftSel = craftSel === k ? '' : k; render(); }
    // 牌库内附魔（owner 2026-06-21·E）：点小徽标 → 进「改造坊」并跳到这张牌做附魔（复用真·附魔台·不动选牌点击）。
    else if (act === 'enchSel') { tab = 'craft'; craftSel = k; render(); host.querySelector('.ench-card.sel')?.scrollIntoView({ block: 'nearest' }); }
    else if (act === 'inlay') { const [idx, br, t] = k.split(':'); h.onInlay?.(idx, br, parseInt(t, 10) || 1); render(); }
    else if (act === 'removeInlay') { const [idx, slot] = k.split(':'); h.onRemoveInlay?.(idx, parseInt(slot, 10) || 0); render(); }
    else if (act === 'exitGame') { settings = false; h.onExitGame?.(); } // 退出到游戏库（壳层接管·不再 render）
    else if (act === 'reset') { h.onReset?.(); settings = false; render(); }
    updateCoach(); // 任何点击后重算引导高亮（步进/开关弹层都可能改可见步）
  };
  host.addEventListener('click', onClick);
  (host.ownerDocument ?? document).body.appendChild(coachLayer); // 引导高亮层挂 body（真视口固定）
  if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
  if (h.getView().firstLaunch) playOpeningStory(); // 首启自动播开场故事 → 引导（doc28）
  render();
  return { update: render, destroy: () => { host.removeEventListener('click', onClick); if (typeof window !== 'undefined') window.removeEventListener('resize', onResize); coachLayer.remove(); host.replaceChildren(); } };
}

import { FONTS } from './fonts.js'; // 自托管字体（替代外部 Google Fonts <link>·owner 2026-06-21）

// 离线"看帧" golden：自包含 HTML（CSS + 字体 + 真渲染器输出）。浏览器开 = 真大厅。
export function renderLobbyDoc(view: LobbyView, tab = 'home', collTab = 'cards', deckTab: 'base' | 'gang' | 'dizhi' = 'base', rechargeOpen = false, story: { beats: StoryBeat[]; idx: number; label: string; cta: string } | null = null, guideSkipAsk = false, shopTab: 'gacha' | 'wallet' | 'foil' = 'wallet', gachaReveal: GachaResult[] | null = null, deckPickerOpen = false, craftSel = '', settingsOpen = false): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FONTS}<style>html,body{margin:0;background:#0c0a08}${LOBBY_CSS}</style></head><body>${renderLobby(view, tab, false, deckTab, 'all', collTab, 'all', '', 'all', false, settingsOpen, 'easy', rechargeOpen, '', story, guideSkipAsk, shopTab, gachaReveal, deckPickerOpen, craftSel)}</body></html>`;
}
