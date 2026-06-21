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
export type { EarthRarity } from './lobby-util.js';
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
import { helpBox, settingsBox, shopBox, gachaRevealBox, narrationBox, guideSkipDialog, GUIDE_COACH } from './lobby-overlays.js';
import { inlayDetail, enchantPanel, craftTiangangItem, deckPreviewPanel, deckSetSelector, tiangangDeckManager, deckPickerBox, suitBarsPanel } from './lobby-build.js';
import { earthSection, pokerBuildHead, pokerBuildPanel, shopItem } from './lobby-deck.js';
import { luckyFromVal, luckyBox, rechargeThanksBox } from './lobby-overlays.js';
export { luckyFromVal, luckyBattleBuff } from './lobby-overlays.js';

import { esc, kfmt, SUITS, RANKS, SUIT_LETTER, ENCH_TIER_CLR, KIND_LABEL, ggTip, tipRow, type EarthRarity, type LuckyRoll, type FortuneView } from './lobby-util.js';
export type { LuckyRoll, FortuneView } from './lobby-util.js';

// 十二地支支脉（子→亥，animal，theme）
// 帮助中心（owner 2026-06-20 合并）：游戏介绍 + 新手指导 + 玩法手册(初/中/高) 三合一·一个入口。
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
// 单牌镶嵌详情（slots + 卡包可镶项）·改造坊附魔台与牌库内附魔弹窗共用（owner 2026-06-21）。
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
      const fiends = c ? c.fiends.map((f, i) => { const nums = dishaNumberLine(hDisha[i] ?? ''); return `<div class="fiend gg-tipwrap tip-left tip-up" style="cursor:help"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span>${nums ? `<span class="disha-num">📊 ${esc(nums)}</span>` : ''}<div class="gg-tip"><h4 style="color:var(--gold)">🎴 ${esc(f.name)}</h4><div class="gg-tip-eff">${esc(f.desc)}</div>${nums ? `<div class="gg-tip-row"><span>📊 数值</span><b style="color:var(--gold)">${esc(nums)}</b></div>` : ''}<div class="gg-tip-row"><span>性质</span><b style="color:var(--club)">明牌 · 公平可破</b></div></div></div>`; }).join('') : '';
      return `<section class="screen${on('home')} homerow" data-screen="home">
      <div class="herocol">
        <div class="felt">
          <div class="vignette"></div>
          ${(() => {
            // 今日卦象徽标（owner 2026-06-21）：收下卦后显示在主页顶；点徽标可再开掷命弹框。
            const f = view.fortune;
            const keptVal = f?.keptVal ?? 50; // 默认中庸
            const lk = luckyFromVal(keptVal);
            const hasKept = f?.keptVal != null;
            return `<button class="gg-fortune" data-act="lucky" title="今日卦象 · 点开再掷/查看" style="position:absolute;left:50%;top:22%;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;cursor:pointer;background:linear-gradient(160deg,rgba(20,28,40,.92),rgba(12,18,28,.92));border:1px solid var(--gold);box-shadow:0 4px 14px rgba(0,0,0,.4);white-space:nowrap"><span style="font-size:14px">🎴</span><span style="font-family:var(--fh);font-weight:700;font-size:12px;color:var(--ink-dim)">今日卦象</span><span style="font-family:var(--fd);font-size:18px;color:${lk.color};line-height:1">${esc(lk.label)}</span>${hasKept ? `<span style="font-family:var(--fn);font-size:13px;color:var(--gold)">${keptVal}</span>` : ''}</button>`;
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
    else if (act === 'reset') { h.onReset?.(); settings = false; tab = 'home'; playOpeningStory(); render(); } // 重置=回到首启态：清数据(freshSave 已清 seenIntro/guideStep/seen) + 立刻重播开场故事与新手引导（owner 2026-06-21）
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
