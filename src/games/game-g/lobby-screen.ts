// lobby-screen.ts —— 大厅设计稿「忠实港」（owner 2026-06-18：就是这个老文件 ui = design/UI/Game G 大厅.dc.html）。
// 逐字照搬该稿的招牌视觉：纸框(--paper/--frame-edge) + 顶栏 + 5 屏 IA + **HOME 绿呢牌桌(--felt) + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + 倒角 sheen 大 CTA**
//   + 玄铁(onyx)/锦霞(rosy=brocade)双皮（CSS 变量逐项对齐 .dc.html themes()）。数据接真存档；未接网项诚实占位。
// 纯表现"固定解释器"：只渲染 view + 抛 data-act 回调，零 gameplay 计算。CSS 全 scope 在 .ggl-root 下。

import { GI, tiangangIcon } from './icons.js';
import { HERO_CARDS, DIZHI_ZODIACS, DIZHI_TRINES, EARTH_FIENDS, STAGE_CAMPAIGN, STORY_OPENING, type StageCampaign, type StoryBeat } from './blueprint.js';
import { heroPortrait } from './portraits.js';
import { RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, GACHA, INLAY_MAX, DIZHI_INLAY_FAVOR, inlayBonus } from './blueprint.js';

export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number; inDeck?: boolean; power?: number; phat?: number; kind?: string; icon?: string; tint?: string; unlockStage?: number; locked?: boolean }
export interface GachaResult { kind: 'tiangang' | 'dizhi'; id: string; name: string; rarity?: string; outcome: 'new' | 'dup-shard' | 'dizhi-up' | 'dizhi-shard'; detail: string } // 抽卡结果（开包演出读）
export type EarthRarity = 'bronze' | 'silver' | 'gold';
export interface LobbyView {
  skin: 'onyx' | 'rosy';
  coin: number; diamond?: number; dizhiShards?: number; tiangangShards?: number; dizhiOwned?: Record<string, number>; inlays?: Record<string, string[]>; rechargeNeedsPassword?: boolean; energy: number; energyMax: number; foilCount: number;
  name: string; mainCard: string; rankText: string;
  stageLabel: string; archLine: string; bossLine: string;
  deckAvg: number; deckMin: number; deckMax: number; deck: number[];
  tiangangs: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
  ladderLines: string[];
  deckArchName?: string | null; deckArchActivated?: boolean;
  // 天罡牌组（owner 2026-06-20 多牌组）：decks=各牌组概览 / deckSize=每组上限 / activeDeckName=出战组名 / canAddDeck=可否再建
  decks?: { id: string; name: string; size: number; active: boolean }[];
  deckSize?: number; activeDeckName?: string; canAddDeck?: boolean;
  campaign?: StageCampaign; // 当前关战役（Boss/战役/难度/地煞/解锁 · doc23 §八）
  campaignMax?: number; // 已抵达的最高关（战役进度屏 锁/通关判定）
  firstLaunch?: boolean; // 首次启动（未看过开场故事）→ 进大厅自动播放（doc28 §一）
  guideStep?: number; // 新手引导进度（doc28 §二）：0..N 进行中 · -1 完成/跳过
}

// ── 双皮 CSS 变量（逐项照搬 .dc.html themes() · onyx 绿呢 / rosy=brocade 红呢）+ 招牌类 ──
const CSS = `
@keyframes ggl-sheen { 0% { background-position:-130% 0 } 100% { background-position:230% 0 } }
@keyframes ggl-float { 0%,100% { transform:translateY(0) rotate(var(--rot,0deg)) } 50% { transform:translateY(-12px) rotate(var(--rot,0deg)) } }
@keyframes ggl-pulse { 0%,100% { opacity:.45 } 50% { opacity:1 } }
.ggl-root[data-skin="onyx"]{ --ink:#e7edf3; --ink-dim:#7e8c9b; --gold:#e8cd82; --gold-grad:linear-gradient(180deg,#f5e6ad,#c69a44);
  --paper:radial-gradient(120% 120% at 50% -8%,#1d2d42 0%,#0f1b29 55%,#070e17 100%);
  --panel:radial-gradient(130% 95% at 22% 10%,rgba(82,120,158,.30),transparent 56%),linear-gradient(165deg,#1a2a3c,#0f1c2a);
  --panel-border:#3a516e; --hairline:rgba(232,205,138,.24); --chip:rgba(255,255,255,.05); --track:rgba(0,0,0,.5);
  --frame-edge:#2a3a4e; --felt:radial-gradient(120% 110% at 50% 26%,#1d6f4e 0%,#11543a 46%,#0a3325 100%); --felt-edge:#0c2a1f;
  --spade:#8ba2c9; --heart:#d8504e; --diamond:#e0973a; --club:#3fae6e;
  --chamfer:polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);
  --hp:#46d17a; --danger:#ff5d62;
  --fd:'Zhi Mang Xing',cursive; --fh:'Rajdhani',sans-serif; --fb:'Noto Sans SC',sans-serif; --fn:'Silkscreen',monospace; }
.ggl-root[data-skin="rosy"]{ --ink:#5a3f44; --ink-dim:#a98b8f; --gold:#cf9a3f; --gold-grad:linear-gradient(180deg,#f3e2a4,#cf9a3f);
  --paper:radial-gradient(120% 120% at 50% -10%,#fdf4ee 0%,#f3e2dc 60%,#ecd6cf 100%);
  --panel:radial-gradient(130% 95% at 22% 10%,rgba(216,170,120,.20),transparent 56%),linear-gradient(165deg,#fffaf3,#f8e7d6);
  --panel-border:#e0c290; --hairline:rgba(207,154,63,.5); --chip:rgba(255,255,255,.55); --track:rgba(150,110,90,.18);
  --frame-edge:#6b4a2e; --felt:radial-gradient(120% 110% at 50% 26%,#c97f86 0%,#b15f6b 46%,#8c4654 100%); --felt-edge:#6e3a44;
  --spade:#4a6390; --heart:#c14b66; --diamond:#b8862f; --club:#2f8f56;
  --chamfer:polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);
  --hp:#2f8f6b; --danger:#d65668;
  --fd:'Ma Shan Zheng',cursive; --fh:'Cormorant Garamond',serif; --fb:'Noto Serif SC',serif; --fn:'Silkscreen',monospace; }
.ggl-root{ background:#0c0a08; color:var(--ink); font-family:'Noto Sans SC',sans-serif; height:100vh; box-sizing:border-box; padding:12px; overflow:hidden; display:flex; justify-content:center }
.ggl-root *{ box-sizing:border-box; margin:0 }
.ggl-root button{ font-family:inherit; cursor:pointer } .ggl-root button:disabled{ opacity:.5; cursor:not-allowed }
.ggl-root .ghost{ opacity:.62 }
.ggl-root .frame{ position:relative; width:1340px; max-width:100%; height:100%; border-radius:16px; overflow:hidden; background:var(--paper); border:3px solid var(--frame-edge); box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 0 0 1px var(--hairline); display:flex; flex-direction:column }
.ggl-root .topbar{ display:flex; align-items:center; flex-wrap:wrap; gap:10px; row-gap:8px; padding:14px 24px; background:linear-gradient(180deg,rgba(94,63,38,.16),transparent); border-bottom:1px solid var(--panel-border) }
.ggl-root .seal{ width:44px; height:44px; flex:none; border-radius:10px; background:linear-gradient(150deg,#3a4f78,#28385a); display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; box-shadow:0 0 12px rgba(74,99,144,.5); border:1px solid var(--hairline) }
.ggl-root .who{ display:flex; flex-direction:column; line-height:1.25; min-width:0 } .ggl-root .who .nm{ font-family:var(--fh); font-weight:700; font-size:18px; letter-spacing:.01em } .ggl-root .who .sub{ font-size:11px; color:var(--ink-dim) } .ggl-root .who .sub b{ font-family:var(--fd); color:var(--gold); font-size:14px; font-weight:400 }
.ggl-root .rankb{ display:flex; align-items:center; gap:7px; margin-left:6px; padding:6px 13px; border-radius:99px; background:var(--chip); border:1px solid var(--panel-border); font-family:var(--fh); font-weight:700; font-size:13px }
.ggl-root .rankb .lp{ font-family:var(--fn); font-size:11px; color:var(--gold) }
.ggl-root .seg{ flex:none; white-space:nowrap; padding:6px 13px; border-radius:9px; background:transparent; border:1px solid var(--panel-border); color:var(--ink-dim); font-size:12px; font-weight:700 } .ggl-root .seg.on{ background:var(--gold-grad); color:#2a1a08; border:0 }
.ggl-root .coin{ flex:none; white-space:nowrap; display:flex; align-items:center; gap:5px; padding:6px 11px; border-radius:9px; background:var(--chip); border:1px solid var(--panel-border); font-family:var(--fn); font-size:13px }
.ggl-root .coin.tap{ cursor:pointer }
.ggl-root .coin.tap:hover{ border-color:var(--gold) }
.ggl-root .rc-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px }
.ggl-root .rc-pack{ display:flex; flex-direction:column; align-items:center; gap:3px; padding:14px 6px 10px; border-radius:12px; background:var(--chip); border:1px solid var(--panel-border); cursor:pointer; transition:border-color .12s }
.ggl-root .rc-pack:hover{ border-color:var(--gold) }
.ggl-root .rc-pack.off{ opacity:.4; cursor:not-allowed }
.ggl-root .rc-amt{ font-family:var(--fh); font-weight:700; font-size:18px; color:#7fd0ff }
.ggl-root .rc-price{ margin-top:5px; font-family:var(--fn); font-size:14px; font-weight:700; color:var(--ink); padding:3px 12px; border-radius:99px; background:var(--gold-grad); color:#2a1a08 }
.ggl-root .camp-list{ display:flex; flex-direction:column; gap:12px }
.ggl-root .camp-card{ padding:16px 18px; border-radius:14px; background:var(--panel); border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline) }
.ggl-root .camp-card.cur{ border-color:var(--gold); box-shadow:0 0 22px rgba(232,205,130,.18) }
.ggl-root .camp-card.locked{ opacity:.62 }
.ggl-root .camp-fiends{ display:flex; flex-wrap:wrap; gap:7px }
.ggl-root .camp-fiend{ font-size:11px; padding:4px 9px; border-radius:8px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim) }
.ggl-root .camp-fiend b{ color:var(--ink) }
.ggl-root .story-ov{ background:rgba(6,8,11,.88) }
.ggl-root .story-box{ max-width:520px; text-align:left }
.ggl-root .gacha-pool{ padding:13px 15px; border-radius:12px; background:var(--chip); border:1px solid var(--panel-border); margin-bottom:11px }
.ggl-root .gacha-pool-hd{ font-family:var(--fh); font-weight:700; font-size:15px; color:var(--ink) }
.ggl-root .gacha-btns{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px }
.ggl-root .gacha-draw{ display:flex; flex-direction:column; align-items:center; gap:3px; padding:9px 4px; border-radius:10px; background:var(--panel); border:1px solid var(--gold); color:var(--ink); cursor:pointer; font-size:12px }
.ggl-root .gacha-draw b{ font-size:13px; color:var(--gold) }
.ggl-root .gacha-draw:hover{ background:rgba(232,205,130,.12) }
.ggl-root .gacha-draw.off{ opacity:.4; cursor:not-allowed; border-color:var(--panel-border) }
.ggl-root .gacha-crafts{ display:flex; flex-wrap:wrap; gap:7px }
.ggl-root .gacha-craft{ font-size:12px; padding:6px 11px; border-radius:8px; background:var(--panel); border:1px solid #b8862f; color:var(--ink); cursor:pointer }
.ggl-root .gacha-craft span{ color:#e6b96a; font-weight:700 }
.ggl-root .gacha-craft.off{ opacity:.4; cursor:not-allowed; border-color:var(--panel-border) }
.ggl-root .reveal-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:12px; margin-top:14px }
.ggl-root .reveal-card{ padding:14px 8px; border-radius:12px; background:var(--chip); border:2px solid; display:flex; flex-direction:column; align-items:center; gap:6px; animation:ggl-pulse .5s ease }
.ggl-root .reveal-emoji{ font-size:34px }
.ggl-root .reveal-name{ font-family:var(--fh); font-weight:700; font-size:13px; color:var(--ink) }
.ggl-root .reveal-tag{ font-size:11px }
.ggl-root .guide-coach{ position:absolute; left:50%; bottom:22px; transform:translateX(-50%); width:min(560px,90%); z-index:40; padding:15px 18px; border-radius:14px; background:var(--panel); border:1px solid var(--gold); box-shadow:0 10px 40px rgba(0,0,0,.5),0 0 22px rgba(232,205,130,.2) }
.ggl-root .guide-hd{ display:flex; align-items:center; font-family:var(--fn); font-size:11px; letter-spacing:.1em; color:var(--gold) }
.ggl-root .guide-skip{ margin-left:auto; background:none; border:0; color:var(--ink-dim); font-size:12px; text-decoration:underline; cursor:pointer }
.ggl-root .guide-title{ font-family:var(--fh); font-weight:700; font-size:17px; color:var(--ink); margin:8px 0 5px }
.ggl-root .guide-body{ font-size:13px; line-height:1.7; color:var(--ink-dim) }
.ggl-root .guide-act{ display:flex; gap:10px; margin-top:12px }
.ggl-root .icon{ flex:none; width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-size:15px }
.ggl-root .tutbtn{ flex:none; display:inline-flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap; line-height:1; padding:0 12px; height:34px; border-radius:9px; background:var(--chip); border:1px solid var(--gold); color:var(--gold); font-size:12px; font-weight:700 }
.ggl-root .nav{ display:flex; gap:4px; padding:10px 22px 0 }
.ggl-root .nav button{ position:relative; padding:10px 20px; border:none; background:transparent; border-radius:11px 11px 0 0; font-family:var(--fh); font-weight:700; font-size:15px; letter-spacing:.03em; color:var(--ink-dim); border-bottom:2px solid transparent }
.ggl-root .nav button.on{ background:var(--panel); color:var(--ink); border-bottom:2px solid var(--gold) }
.ggl-root .content{ flex:1; padding:18px 24px 24px; display:flex; min-height:0; flex-direction:column }
.ggl-root .screen{ display:none } .ggl-root .screen.on{ display:flex; flex:1; min-height:0 }
.ggl-root .homerow{ gap:14px; width:100% } @media(max-width:1000px){ .ggl-root .homerow{ flex-direction:column } }
.ggl-root .herocol{ flex:1; display:flex; flex-direction:column; gap:14px; min-width:0 }
.ggl-root .felt{ position:relative; flex:1; min-height:280px; border-radius:16px; overflow:hidden; background:var(--felt); border:6px solid var(--felt-edge); box-shadow:inset 0 0 0 2px rgba(255,255,255,.08), inset 0 0 120px rgba(0,0,0,.5) }
.ggl-root .vignette{ position:absolute; inset:0; pointer-events:none; background:radial-gradient(60% 50% at 50% 44%,rgba(255,255,255,.10),transparent 70%),repeating-linear-gradient(45deg,rgba(0,0,0,.05) 0 2px,transparent 2px 12px) }
.ggl-root .felt-h{ position:absolute; top:18px; left:24px; display:flex; flex-direction:column; gap:3px } .ggl-root .felt-h .t{ font-family:var(--fd); font-size:34px; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,.6) } .ggl-root .felt-h .s{ font-size:12px; color:rgba(255,255,255,.82); letter-spacing:.04em }
.ggl-root .stags{ position:absolute; top:22px; right:24px; display:flex; gap:7px }
.ggl-root .stag{ display:flex; align-items:center; gap:6px; padding:5px 11px; border-radius:99px; background:rgba(12,20,16,.5); color:#fff; font-size:12px; font-family:var(--fh); font-weight:700 }
.ggl-root .duel{ position:absolute; left:50%; top:47%; transform:translate(-50%,-50%); display:flex; align-items:center; gap:34px }
.ggl-root .dcard{ position:relative; width:116px; height:160px; border-radius:12px; background:linear-gradient(160deg,#fbf7ef,#e9dcc6); box-shadow:0 18px 40px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.6); animation:ggl-float 4s ease-in-out infinite }
.ggl-root .dcard .corner{ position:absolute; top:7px; left:9px; font-family:var(--fh); font-weight:700; font-size:15px; line-height:.95; text-align:center } .ggl-root .dcard .big{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:64px; text-shadow:0 2px 6px rgba(0,0,0,.2) }
.ggl-root .dback{ position:relative; width:116px; height:160px; border-radius:12px; background:#b1402f; border:3px solid #7d2a1e; box-shadow:0 18px 40px rgba(0,0,0,.45); transform:rotate(11deg); --rot:11deg; animation:ggl-float 4.6s ease-in-out infinite }
.ggl-root .dback i{ position:absolute; inset:7px; border-radius:7px; border:2px solid rgba(255,255,255,.5); background:repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 6px,transparent 6px 12px),repeating-linear-gradient(-45deg,rgba(255,255,255,.14) 0 6px,transparent 6px 12px) }
.ggl-root .vs{ width:64px; height:64px; border-radius:50%; flex:none; background:radial-gradient(circle at 38% 32%,#ffe6a6,#c69a44); display:flex; align-items:center; justify-content:center; color:#2a1a08; box-shadow:0 0 30px rgba(232,205,130,.7), inset 0 1px 0 rgba(255,255,255,.5); border:2px solid #fff; font-family:var(--fd); font-size:30px }
.ggl-root .ctawrap{ position:absolute; left:0; right:0; bottom:24px; display:flex; flex-direction:column; align-items:center; gap:13px }
.ggl-root .cta-main{ position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; gap:2px; padding:14px 52px; clip-path:var(--chamfer); border:none; background:linear-gradient(180deg,#e7b052,#bb7f2c); color:#2a1a08; box-shadow:0 10px 28px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.4) }
.ggl-root .cta-main .big{ font-family:var(--fh); font-weight:700; font-size:21px; letter-spacing:.04em } .ggl-root .cta-main .sm{ font-size:11px; letter-spacing:.18em; opacity:.8 }
.ggl-root .cta-main .sheen{ position:absolute; inset:0; background:linear-gradient(110deg,transparent 36%,rgba(255,255,255,.4) 50%,transparent 64%); background-size:230% 100%; animation:ggl-sheen 3s ease-in-out infinite; pointer-events:none }
.ggl-root .ctarow{ display:flex; gap:10px } .ggl-root .cta-sub{ padding:10px 22px; border-radius:11px; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.4); color:#fff; font-family:var(--fh); font-weight:700; font-size:14px }
.ggl-root .quick{ display:flex; gap:12px } .ggl-root .qcard{ flex:1; display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:12px; clip-path:var(--chamfer); background:var(--panel); border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline); font-size:13px } .ggl-root .qcard .ic{ font-size:20px } .ggl-root .qcard b{ color:var(--gold) }
.ggl-root .rail{ width:256px; flex:none; padding:16px; border-radius:14px; background:var(--panel); border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline); display:flex; flex-direction:column }
.ggl-root .friend{ display:flex; align-items:center; gap:9px; padding:8px 4px; border-bottom:1px solid var(--panel-border); font-size:13px } .ggl-root .friend:last-child{ border:0 } .ggl-root .dot{ width:8px; height:8px; border-radius:50%; background:#5557 } .ggl-root .friend .tag{ margin-left:auto; font-size:11px; color:var(--ink-dim) }
.ggl-root .fiend{ display:flex; flex-direction:column; gap:1px; padding:7px 10px; margin-bottom:6px; border-radius:8px; background:rgba(216,80,78,.08); border:1px solid rgba(216,80,78,.28) } .ggl-root .fiend b{ font-size:12px; color:var(--heart) } .ggl-root .fiend span{ font-size:11px; color:var(--ink-dim); line-height:1.5 }
.ggl-root .intro-scroll{ max-width:560px; line-height:1.95; font-size:14px; color:var(--ink) } .ggl-root .intro-scroll h2{ font-family:var(--fd); font-size:26px; color:var(--gold); margin:2px 0 12px; display:block } .ggl-root .intro-scroll b{ color:var(--gold) } .ggl-root .intro-scroll .lead{ font-family:var(--fd); font-size:19px; color:var(--ink); margin:12px 0 }
.ggl-root h2{ font-family:var(--fh); font-size:16px; color:var(--gold); margin-bottom:10px; display:flex; align-items:center; gap:8px }
.ggl-root .card{ background:var(--panel); border:1px solid var(--panel-border); border-radius:14px; padding:16px; box-shadow:inset 0 0 0 1px var(--hairline) }
.ggl-root .full{ width:100%; flex-direction:column; overflow-y:auto }
.ggl-root .suit-row{ display:flex; align-items:center; gap:8px; margin:5px 0 }
.ggl-root .suit-hd{ width:22px; flex:none; font-size:18px; font-weight:700; text-align:center; line-height:1 }
.ggl-root .suit-line{ display:flex; flex:1; gap:4px }
.ggl-root .pcard-wrap{ flex:1; min-width:0; cursor:pointer }
.ggl-root .pcard{ width:100%; aspect-ratio:5/7; border-radius:9px; border:1px solid var(--panel-border); background:var(--chip); font-size:13px; font-weight:700; position:relative; transition:box-shadow .18s; box-shadow:0 4px 10px rgba(0,0,0,.46),0 1px 3px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.10),inset 0 -1px 0 rgba(0,0,0,.18) }
.ggl-root .pcard-wrap:hover>.pcard{ box-shadow:0 9px 26px rgba(0,0,0,.62),0 2px 8px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.12) }
.ggl-root .pcard.leg{ border-color:var(--gold); box-shadow:0 4px 12px rgba(0,0,0,.44),0 0 10px rgba(232,205,130,.18),inset 0 1px 0 rgba(255,255,255,.14) }
.ggl-root .pcard.lock{ opacity:.42 }
.ggl-root .pcard-front,.ggl-root .pcard-back{ position:absolute; inset:0; border-radius:8px; transition:opacity .26s ease }
.ggl-root .pcard-front{ display:flex; flex-direction:column; justify-content:space-between; padding:5px 5px 4px; overflow:hidden; background:linear-gradient(148deg,rgba(255,255,255,.055) 0%,transparent 55%,rgba(0,0,0,.045) 100%) }
.ggl-root .pcard-back{ opacity:0; background:linear-gradient(148deg,#0d1b2c 0%,#14243a 100%); border:1px solid rgba(232,205,138,.2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:4px; color:#e7edf3; text-align:center }
.ggl-root .pcard-wrap:hover .pcard-front{ opacity:0 }
.ggl-root .pcard-wrap:hover .pcard-back{ opacity:1 }
.ggl-root .pcard .r{ position:relative; z-index:1; font-size:22px; line-height:1; text-shadow:0 1px 4px rgba(0,0,0,.6) }
.ggl-root .pcard .own{ position:absolute; bottom:3px; right:5px; font-size:9px; color:var(--ink-dim) }
.ggl-root .pcard-wm{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; user-select:none }
.ggl-root .pcard-lbl{ position:relative; z-index:1; max-width:100%; font-size:8.5px; font-weight:900; letter-spacing:.02em; line-height:1; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 1px; text-shadow:0 1px 3px rgba(0,0,0,.8) }
.ggl-root .pcard-portrait{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:.26 }
.ggl-root .pcard-bk-nm{ font-size:9px; font-weight:900; color:#e7edf3; line-height:1.05; text-align:center; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .pcard-bk-tt{ font-size:7.5px; color:#9fb0c0; line-height:1; text-align:center; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .pcard-portrait svg{ width:66%; height:66% }
.ggl-root .deck-nav{ display:flex; gap:6px; margin-bottom:14px }
.ggl-root .deck-nav button{ padding:6px 20px; border-radius:8px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-family:var(--fh); font-weight:600; font-size:14px; cursor:pointer }
.ggl-root .deck-nav button.on{ background:var(--gold-grad); color:#2a1a08; border:0 }
.ggl-root .dsub{ display:none; flex-direction:column }
.ggl-root .dsub.on{ display:flex }
.ggl-root .gang-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(78px,1fr)); gap:8px; min-height:240px }
.ggl-root .gang-empty{ grid-column:1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:56px 0; color:var(--ink-dim); font-size:13px; text-align:center }
.ggl-root .deck-chips{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:4px }
.ggl-root .deck-chip{ position:relative; display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink); font-family:var(--fh); font-weight:700; font-size:13px }
.ggl-root .deck-chip.on{ border-color:var(--gold); background:rgba(232,205,130,.12); color:var(--gold) }
.ggl-root .deck-chip.add{ color:var(--gold); border-style:dashed }
.ggl-root .deck-chip .deck-del{ margin-left:4px; width:16px; height:16px; line-height:15px; text-align:center; border-radius:50%; background:rgba(0,0,0,.25); color:var(--danger); font-size:11px }
.ggl-root .deck-chip .deck-del:hover{ background:var(--danger); color:#fff }
.ggl-root .tg-deck{ display:grid; grid-template-columns:repeat(6,1fr); gap:8px }
.ggl-root .tg-slot{ position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-height:64px; padding:8px 5px; border-radius:10px; background:var(--chip); border:1px solid var(--gold); color:var(--ink); font-size:11px; font-weight:700; text-align:center }
.ggl-root .tg-slot .tg-slot-ic{ font-size:15px; line-height:1 }
.ggl-root .tg-slot.empty{ border-style:dashed; border-color:var(--panel-border); color:var(--ink-dim); cursor:pointer; font-size:20px }
.ggl-root .tg-slot.empty:hover{ border-color:var(--gold); color:var(--gold) }
.ggl-root .tg-rm{ position:absolute; top:-7px; right:-7px; width:18px; height:18px; line-height:16px; text-align:center; border-radius:50%; background:var(--panel); border:1px solid var(--danger); color:var(--danger); font-size:11px; cursor:pointer }
.ggl-root .tg-rm:hover{ background:var(--danger); color:#fff }
.ggl-root .pick-list{ display:flex; flex-direction:column; gap:8px; max-height:48vh; overflow-y:auto }
.ggl-root .pick-item{ display:block; width:100%; text-align:left; padding:10px 12px; border-radius:10px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink); cursor:pointer }
.ggl-root .pick-item:hover{ border-color:var(--gold); background:rgba(232,205,130,.10) }
.ggl-root .pick-item:disabled{ opacity:.4; cursor:not-allowed }
.ggl-root .pick-hd{ font-family:var(--fh); font-weight:700; font-size:14px }
.ggl-root .pick-sub{ font-size:11px; color:var(--ink-dim); margin-top:2px }
.ggl-root .ench-grid{ display:grid; grid-template-columns:repeat(13,1fr); gap:4px; margin-bottom:12px }
.ggl-root .ench-card{ display:flex; flex-direction:column; align-items:center; gap:1px; padding:5px 2px; border-radius:7px; background:var(--chip); border:1px solid var(--panel-border); cursor:pointer; overflow:hidden }
.ggl-root .ench-card:hover{ border-color:var(--gold) }
.ggl-root .ench-card.sel{ border-color:var(--gold); background:rgba(232,205,130,.14); box-shadow:0 0 8px rgba(232,205,130,.3) }
.ggl-root .ench-rk{ font-family:var(--fh); font-weight:700; font-size:12px; line-height:1 }
.ggl-root .ench-nm{ font-size:8px; color:var(--ink-dim); max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .ench-fv{ font-family:var(--fn); font-size:9px; color:var(--ink) }
.ggl-root .ench-detail{ display:flex; gap:14px; padding-top:10px; border-top:1px solid var(--panel-border) }
.ggl-root .ench-sel-card{ flex:none; width:90px; border-radius:10px; border:2px solid; background:var(--chip); padding:8px; display:flex; flex-direction:column; align-items:center; gap:6px }
.ggl-root .ench-sel-rk{ font-family:var(--fh); font-weight:700; font-size:20px; line-height:1; text-align:center }
.ggl-root .ench-sel-nm{ font-family:var(--fh); font-weight:700; font-size:12px; text-align:center; color:var(--ink) }
.ggl-root .ench-sel-fv{ font-size:11px; color:var(--ink-dim); text-align:center }
.ggl-root .ench-slots{ display:flex; gap:8px }
.ggl-root .ench-slot{ position:relative; width:44px; height:44px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:20px }
.ggl-root .ench-slot.empty{ border:1px dashed var(--panel-border); color:var(--ink-dim) }
.ggl-root .ench-slot.filled{ border:1px solid var(--gold); background:rgba(232,205,130,.12); cursor:pointer }
.ggl-root .ench-rm{ position:absolute; top:-6px; right:-6px; width:16px; height:16px; line-height:14px; text-align:center; font-size:10px; border-radius:50%; background:var(--panel); border:1px solid var(--danger); color:var(--danger) }
.ggl-root .ench-picks{ display:flex; flex-wrap:wrap; gap:6px }
.ggl-root .ench-pick{ font-size:12px; padding:6px 10px; border-radius:8px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink); cursor:pointer }
.ggl-root .ench-pick:hover{ border-color:var(--gold) }
.ggl-root .ench-pick:disabled{ opacity:.4; cursor:not-allowed }
.ggl-root .earth-filter{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px }
.ggl-root .earth-filter button{ padding:4px 14px; border-radius:6px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-size:12px; cursor:pointer; transition:background .15s }
.ggl-root .earth-groups{ display:flex; flex-direction:column; gap:10px }
.ggl-root .earth-group{ background:rgba(255,255,255,.03); border:1px solid var(--panel-border); border-radius:10px; padding:10px 12px }
.ggl-root .earth-group.owned{ border-color:var(--gold); background:rgba(232,205,130,.06) }
.ggl-root .earth-group-hd{ display:flex; align-items:center; gap:8px; margin-bottom:8px }
.ggl-root .zo-own{ margin-left:auto; font-size:11px; font-weight:700 }
.ggl-root .ecard.have{ border-color:var(--gold); box-shadow:inset 0 0 0 1px rgba(232,205,130,.3) }
.ggl-root .earth-branch{ font-family:var(--fh); font-size:22px; font-weight:800; color:var(--gold); width:26px }
.ggl-root .earth-cards{ display:flex; gap:8px; flex-wrap:wrap }
.ggl-root .ecard{ border-radius:8px; padding:8px 10px; background:var(--chip); border:1px solid var(--panel-border); font-size:12px; min-width:84px; position:relative }
.ggl-root .ecard.r-bronze{ border-color:#cd7f32 }
.ggl-root .ecard.r-silver{ border-color:#c4ccd6 }
.ggl-root .ecard.r-gold{ border-color:var(--gold); box-shadow:0 0 8px rgba(232,205,130,.18) }
.ggl-root .zo-icon{ width:34px; height:34px; flex:none; image-rendering:auto }
.ggl-root .earth-legend{ font-size:11px; color:var(--ink-dim); line-height:1.55; margin:2px 0 8px; font-style:italic }
.ggl-root .trine-row{ display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:8px; background:rgba(255,255,255,.03); border:1px solid var(--panel-border); font-size:12px; margin-bottom:6px }
.ggl-root .ecard.unowned{ opacity:.36 }
.ggl-root .ecard.equipped::after{ content:'⚔'; position:absolute; top:3px; right:5px; font-size:10px; color:var(--gold) }
.ggl-root .shelf{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px }
.ggl-root .good{ background:var(--chip); border:1px solid var(--panel-border); border-radius:10px; padding:10px; text-align:center; font-size:12px; position:relative; min-height:74px; clip-path:var(--chamfer) } .ggl-root .good .gnm{ font-weight:700; color:var(--ink); line-height:1.25 } .ggl-root .good .cost{ color:var(--gold); font-weight:700; margin-top:6px; font-family:var(--fn) }
.ggl-root .good.got{ border-color:var(--gold) } .ggl-root .good.buy{ cursor:pointer } .ggl-root .good.buy:hover{ box-shadow:0 0 0 1px var(--gold) inset } .ggl-root .good.lock{ opacity:.62 }
.ggl-root .unlock-badge{ display:inline-block; font-size:9px; font-weight:700; padding:1px 5px; border-radius:5px; background:rgba(232,205,138,.16); border:1px solid var(--hairline); color:var(--gold); vertical-align:middle }
.ggl-root .boss-block{ margin-bottom:14px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid var(--panel-border) }
.ggl-root .boss-hd{ display:flex; align-items:baseline; gap:10px; margin-bottom:8px } .ggl-root .boss-name{ font-family:var(--fd); font-size:19px; color:var(--gold) }
.ggl-root .fiend-row{ display:grid; grid-template-columns:repeat(auto-fill,minmax(216px,1fr)); gap:8px }
.ggl-root .fiend-card{ padding:8px 10px; border-radius:8px; background:rgba(216,80,78,.07); border:1px solid rgba(216,80,78,.26) }
.ggl-root .fiend-hd{ display:flex; align-items:center; gap:6px; margin-bottom:3px } .ggl-root .fiend-hd b{ font-size:12px; color:var(--heart) } .ggl-root .fiend-kind{ margin-left:auto; font-size:9px; padding:1px 6px; border-radius:5px; border:1px solid; font-family:var(--fn) }
.ggl-root .fiend-eff{ font-size:11px; color:var(--ink); line-height:1.5 } .ggl-root .fiend-cnt{ font-size:10px; color:var(--ink-dim); margin-top:4px }
.ggl-root .tools{ display:flex; gap:10px; flex-wrap:wrap; margin-top:12px } .ggl-root .btn{ padding:9px 15px; border-radius:10px; clip-path:var(--chamfer); background:var(--gold-grad); color:#2a1a08; border:0; font-family:var(--fh); font-weight:700; font-size:13px } .ggl-root .btn.ghost{ background:var(--chip); color:var(--ink); border:1px solid var(--panel-border) }
.ggl-root .forge{ display:grid; grid-template-columns:1fr 1fr; gap:14px } @media(max-width:780px){ .ggl-root .forge{ grid-template-columns:1fr } }
.ggl-root .fuse{ display:flex; align-items:center; gap:12px; justify-content:center; padding:12px 0 } .ggl-root .slot{ width:62px; height:86px; border-radius:10px; border:1px dashed var(--panel-border); display:flex; align-items:center; justify-content:center; font-size:26px; background:var(--chip) } .ggl-root .arrow{ font-size:24px; color:var(--gold) }
.ggl-root .ladder-top{ display:flex; gap:16px; flex-wrap:wrap } .ggl-root .ladder-top .box{ flex:1; min-width:180px } .ggl-root .bigrank{ font-family:var(--fh); font-size:26px; font-weight:800; color:var(--gold) }
.ggl-root .rankrow{ display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid var(--panel-border); font-size:13px } .ggl-root .rankrow .n{ width:22px; color:var(--ink-dim); text-align:center } .ggl-root .rankrow .lp{ margin-left:auto; color:var(--gold); font-family:var(--fn) }
.ggl-root .note{ font-size:11px; color:var(--ink-dim); text-align:center; margin-top:18px; line-height:1.7 }
.ggl-root .tut-ov{ position:absolute; inset:0; background:#000a; display:flex; align-items:center; justify-content:center; padding:24px; z-index:50 }
.ggl-root .tut-box{ max-width:920px; max-height:90%; overflow:auto; background:var(--panel); border:1px solid var(--gold); border-radius:14px; padding:22px } .ggl-root .tut-box h3{ color:var(--gold); font-size:18px; margin-bottom:12px } .ggl-root .tut-box .step{ border-left:3px solid var(--gold); padding:6px 0 6px 12px; margin:8px 0; font-size:14px; line-height:1.7 } .ggl-root .tut-box .step b{ color:var(--ink) }
.ggl-root .tiangang-tog{ padding:2px 8px; border-radius:6px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-size:11px; cursor:pointer }
.ggl-root .tiangang-tog.active{ background:var(--gold-grad); color:#2a1a08; border:0 }
.ggl-root .jchips{ display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 4px }
.ggl-root .jchip{ display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:8px; background:var(--chip); border:1px solid var(--gold); font-size:12px }
.ggl-root .power-stars{ font-size:9px; letter-spacing:-.1em; color:var(--gold); margin-left:2px }
.ggl-root .phat-badge{ font-family:var(--fn); font-size:9px; color:var(--ink-dim); margin-left:2px }
.ggl-root .rarity-c{ color:#9ca3af }
.ggl-root .rarity-r{ color:#4a9fd5 }
.ggl-root .rarity-e{ color:#9b5fc7 }
.ggl-root .rarity-l{ color:var(--gold) }
.ggl-root .craft-zones{ display:flex; flex-direction:column; gap:14px }
.ggl-root .gi{ width:1em; height:1em; display:inline-block; vertical-align:-0.125em; flex-shrink:0; fill:currentColor }
.ggl-root .deck-sumbar{ display:flex; gap:16px; flex-wrap:wrap; font-size:12px; padding:8px 0; border-bottom:1px solid var(--panel-border); margin-bottom:10px }
.ggl-root .deck-sumbar b{ color:var(--gold) }
/* ── polish: 入场 · hover · 点击手感 · 徽章生命感 ── */
@keyframes ggl-fadein { from{ opacity:0; transform:translateY(7px) } to{ opacity:1; transform:translateY(0) } }
@keyframes ggl-glow { 0%,100%{ box-shadow:0 0 22px rgba(232,205,130,.5),inset 0 1px 0 rgba(255,255,255,.5) } 50%{ box-shadow:0 0 50px rgba(232,205,130,.95),inset 0 1px 0 rgba(255,255,255,.65) } }
.ggl-root .screen.on{ animation:ggl-fadein .22s ease-out both }
.ggl-root .vs{ animation:ggl-glow 2.6s ease-in-out infinite }
.ggl-root .nav button{ transition:background .15s,color .15s }
.ggl-root .nav button:not(.on):hover{ background:rgba(255,255,255,.07); color:var(--ink) }
.ggl-root .cta-main{ transition:transform .12s,box-shadow .12s }
.ggl-root .cta-main:hover{ transform:translateY(-2px); box-shadow:0 18px 40px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.45) }
.ggl-root .cta-main:active{ transform:translateY(1px) scale(.98); transition-duration:.06s }
.ggl-root .cta-main::after{ content:''; position:absolute; inset:0; background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.30) 0%,transparent 68%); opacity:0; pointer-events:none; transition:opacity .35s }
.ggl-root .cta-main:active::after{ opacity:1; transition:none }
.ggl-root .cta-sub{ transition:background .15s,transform .12s }
.ggl-root .cta-sub:hover{ background:rgba(255,255,255,.25); transform:translateY(-1px) }
.ggl-root .cta-sub:active{ transform:translateY(0) scale(.97) }
.ggl-root .tutbtn{ transition:background .15s,box-shadow .15s }
.ggl-root .tutbtn:hover{ background:rgba(232,205,130,.10); box-shadow:0 0 0 1px var(--gold) }
.ggl-root .seg{ transition:background .15s,color .15s,border-color .15s }
.ggl-root .good{ transition:transform .15s,box-shadow .15s }
.ggl-root .good.buy:hover{ transform:translateY(-2px); box-shadow:0 0 0 1px var(--gold) inset,0 0 14px rgba(232,205,130,.15) }
.ggl-root .good.buy:active{ transform:translateY(0) scale(.97) }
.ggl-root .qcard{ transition:transform .15s,box-shadow .15s }
.ggl-root .qcard:hover{ transform:translateY(-2px); box-shadow:0 8px 22px rgba(0,0,0,.32),inset 0 0 0 1px var(--hairline) }
.ggl-root .tiangang-tog{ transition:background .12s,color .12s,border-color .12s }
.ggl-root .tiangang-tog:not(.active):hover{ color:var(--ink); border-color:var(--gold) }
.ggl-root .deck-nav button{ transition:background .15s,color .15s }
.ggl-root .deck-nav button:not(.on):hover{ background:rgba(255,255,255,.08); color:var(--ink) }
.ggl-root .earth-filter button{ transition:background .15s,color .15s }
.ggl-root .earth-filter button:hover{ background:rgba(255,255,255,.10); color:var(--ink) }
.ggl-root .btn{ transition:transform .10s,box-shadow .10s }
.ggl-root .btn:not(.ghost):hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,0,0,.32) }
.ggl-root .btn:active{ transform:scale(.97) }
/* ── 收藏·牌谱 ── */
.ggl-root .coll-filter-bar{ display:flex; align-items:center; gap:14px; padding:12px 2px; margin-bottom:6px; flex-wrap:wrap }
.ggl-root .filter-lbl{ font-size:11px; letter-spacing:.14em; color:var(--ink-dim); text-transform:uppercase; white-space:nowrap }
.ggl-root .filter-pill{ padding:5px 13px; border-radius:99px; cursor:pointer; border:1px solid var(--panel-border); background:var(--chip); color:var(--ink-dim); font-family:var(--fh); font-weight:700; font-size:13px; white-space:nowrap; transition:all .12s }
.ggl-root .filter-pill.on{ border-color:var(--gold); background:var(--gold-grad); color:#2a1a08 }
.ggl-root .filter-div{ width:1px; height:24px; background:var(--panel-border); flex:none }
.ggl-root .hero-grid6{ display:grid; grid-template-columns:repeat(6,1fr); gap:14px }
.ggl-root .hcard2{ border-radius:12px; overflow:hidden; cursor:pointer; background:var(--chip); border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline); transition:all .15s }
.ggl-root .hcard2:hover{ border-color:var(--gold); box-shadow:0 6px 18px rgba(0,0,0,.4),inset 0 0 0 1px var(--hairline) }
.ggl-root .hcard2.sel{ border-color:var(--gold); box-shadow:0 0 16px rgba(232,205,130,.18),inset 0 0 0 1px var(--hairline) }
.ggl-root .hcard2.locked{ opacity:.58 }
.ggl-root .hc2-portrait{ position:relative; height:128px; display:flex; align-items:center; justify-content:center; overflow:hidden }
.ggl-root .hc2-fig{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; pointer-events:none }
.ggl-root .hc2-corner{ position:absolute; top:5px; left:7px; font-family:var(--fh); font-weight:700; font-size:14px; line-height:.85; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,.4) }
.ggl-root .hc2-gem{ position:absolute; top:6px; right:7px; width:11px; height:11px; border-radius:50%; box-shadow:0 0 8px currentColor }
.ggl-root .hc2-lock{ position:absolute; inset:0; background:rgba(6,9,14,.55); display:flex; align-items:center; justify-content:center; font-size:26px }
.ggl-root .hc2-name{ padding:7px 8px 3px; font-family:var(--fb); font-weight:700; font-size:13px; color:var(--ink); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .hc2-own{ padding:0 8px 8px; font-family:var(--fn); font-size:10px; text-align:center }
.ggl-root .hero-detail-pane{ width:300px; flex:none; padding:22px; border-radius:16px; clip-path:var(--chamfer); background:var(--panel); border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline); display:flex; flex-direction:column; overflow-y:auto }
.ggl-root .hd2-art{ position:relative; align-self:center; width:184px; height:256px; border-radius:15px; display:flex; align-items:center; justify-content:center; overflow:hidden }
.ggl-root .hd2-fig{ width:100%; height:100%; display:flex; align-items:center; justify-content:center }
.ggl-root .hd2-corner{ position:absolute; font-family:var(--fh); font-weight:700; font-size:22px; line-height:.86; text-align:center; text-shadow:0 1px 3px rgba(0,0,0,.4) }
.ggl-root .hd2-chips{ display:flex; gap:7px; margin-top:12px; flex-wrap:wrap }
.ggl-root .hd2-chip{ font-size:11px; padding:3px 11px; border-radius:99px; font-weight:700 }
/* ── 天梯·榜 ── */
.ggl-root .rank-card{ display:flex; flex-direction:column; align-items:center; padding:26px 22px; border-radius:16px; clip-path:var(--chamfer); background:var(--panel); border:1px solid var(--gold); box-shadow:inset 0 0 0 1px var(--hairline) }
.ggl-root .rank-crest{ width:92px; height:92px; border-radius:20px; background:var(--gold-grad); display:flex; align-items:center; justify-content:center; font-size:50px; color:#2a1a08; box-shadow:0 8px 22px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5) }
.ggl-root .rank-bar-wrap{ width:100%; height:9px; border-radius:99px; background:var(--track); overflow:hidden; margin-top:16px; border:1px solid var(--panel-border) }
.ggl-root .rank-bar-fill{ height:100%; border-radius:99px; background:var(--gold-grad) }
.ggl-root .mini-stat{ flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:10px 4px; border-radius:11px; background:var(--chip); border:1px solid var(--panel-border) }
.ggl-root .mini-num{ font-family:var(--fn); font-size:16px; color:var(--ink) }
.ggl-root .mini-num-hp{ font-family:var(--fn); font-size:16px; color:var(--hp) }
.ggl-root .mini-lbl{ font-size:10px; color:var(--ink-dim) }
.ggl-root .rec-sheet{ background:var(--panel); border-radius:16px; border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline); padding:20px 22px; display:flex; flex-direction:column; flex:1; min-height:0 }
.ggl-root .rec-sheet-hd{ font-family:var(--fh); font-weight:700; font-size:15px; color:var(--ink); letter-spacing:.04em; margin-bottom:13px }
.ggl-root .rec-row{ display:flex; align-items:center; gap:11px; padding:9px 11px; border-radius:11px; background:var(--chip); border:1px solid var(--panel-border) }
.ggl-root .rec-result{ width:34px; height:34px; flex:none; border-radius:9px; display:flex; align-items:center; justify-content:center; font-family:var(--fh); font-weight:700; font-size:14px }
.ggl-root .rec-result.win{ background:rgba(70,209,122,.18); color:var(--hp); border:1px solid var(--hp) }
.ggl-root .rec-result.lose{ background:rgba(255,93,98,.16); color:var(--danger); border:1px solid var(--danger) }
.ggl-root .ldr-head-row{ display:flex; align-items:center; gap:11px; padding:0 11px 9px; border-bottom:1px solid var(--panel-border); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-dim) }
.ggl-root .ldr-row{ display:flex; align-items:center; gap:11px; padding:10px 11px; border-radius:10px; margin-top:4px; border-bottom:1px solid var(--panel-border) }
.ggl-root .ldr-av{ width:34px; height:34px; flex:none; border-radius:9px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:17px }
.ggl-root .scope-on{ padding:5px 12px; border-radius:8px; background:var(--gold-grad); color:#2a1a08; font-family:var(--fh); font-weight:700; font-size:12px; cursor:pointer; border:none }
.ggl-root .scope-off{ padding:5px 12px; border-radius:8px; background:var(--chip); color:var(--ink-dim); border:1px solid var(--panel-border); font-family:var(--fh); font-weight:700; font-size:12px; cursor:pointer }
`;

const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['♦', 'var(--diamond)'], ['♣', 'var(--club)']];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const kfmt = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 十二地支支脉（子→亥，animal，theme）
const RARITY_CLR: Record<EarthRarity, string> = { bronze: '#cd7f32', silver: '#c4ccd6', gold: '#e8cd82' };
const RARITY_LBL: Record<EarthRarity, string> = { bronze: '铜', silver: '银', gold: '金' };

// 地支 codex（doc20 §三 + doc23 §五 · 美术 zodiac.json）：12 生肖 × 铜银金三档 + 牌背传说 + 三合连携。
// 镶嵌/揉获取/连携 gameplay 待契约④（甲战斗侧 apply）；此处为养成图鉴展示（图标真接美术库 twemoji）。
function earthSection(filter: string, owned: Record<string, number> = {}): string {
  const TIER_NM = ['', '铜', '银', '金'];
  const tier = (z: typeof DIZHI_ZODIACS[number], r: EarthRarity, eff: string, has: boolean): string =>
    `<div class="ecard r-${r}${has ? ' have' : ''}" title="${esc(eff)}"><div style="font-size:10px;font-weight:700;color:${RARITY_CLR[r]}">${RARITY_LBL[r]}${has ? ' ✓' : ''}</div><div style="font-size:11px;color:var(--ink-dim);line-height:1.5">${esc(eff)}</div></div>`;
  const ownedN = DIZHI_ZODIACS.filter((z) => (owned[z.branch] ?? 0) >= 1).length;
  const TIER_IDX: Record<EarthRarity, number> = { bronze: 1, silver: 2, gold: 3 };
  const groups = DIZHI_ZODIACS.map(z => {
    const t = owned[z.branch] ?? 0; // 0未拥有 1铜 2银 3金
    const tiers: [EarthRarity, string][] = [['bronze', z.bronze], ['silver', z.silver], ['gold', z.gold]];
    const shown = filter === 'all' ? tiers : tiers.filter(([r]) => r === filter);
    const cs = shown.map(([r, eff]) => tier(z, r, eff, t >= TIER_IDX[r])).join('');
    const ownBadge = t >= 1
      ? `<span class="zo-own" style="color:${RARITY_CLR[t === 1 ? 'bronze' : t === 2 ? 'silver' : 'gold']}">已拥有 · ${TIER_NM[t]}</span>`
      : `<span class="zo-own" style="color:var(--ink-dim)">未拥有</span>`;
    return `<div class="earth-group${t >= 1 ? ' owned' : ''}"><div class="earth-group-hd"><img class="zo-icon" src="${z.png}" alt="${z.animal}" loading="lazy"><span class="earth-branch">${z.branch}</span><span style="font-size:13px;color:var(--ink)">${z.animal}</span><span style="font-size:11px;color:var(--ink-dim)">· ${z.symbol}</span>${ownBadge}</div><div class="earth-legend">${esc(z.legend)}</div>${cs ? `<div class="earth-cards">${cs}</div>` : ''}</div>`;
  }).join('');
  const header = `<div class="note" style="text-align:left;margin-bottom:10px">🀄 我的地支收藏 <b style="color:var(--gold)">${ownedN}/12</b> 生肖 · 抽卡获取（🛒商城）· 重复升档 铜→银→金 · 到「改造坊」镶进牌附魔</div>`;
  const trines = DIZHI_TRINES.map(t => `<div class="trine-row"><b style="color:var(--gold);min-width:104px">${t.name}</b><span style="color:var(--ink-dim);min-width:96px">${esc(t.members)}</span><span style="color:var(--ink)">${esc(t.effect)}</span></div>`).join('');
  return `${header}<div class="earth-groups">${groups}</div><div style="margin-top:14px"><div style="font-family:var(--fh);font-size:14px;color:var(--gold);margin-bottom:8px">🔗 三合连携（一卡镶满 3 槽 · 凑成组合激发·待战斗实装）</div>${trines}</div>`;
}

function deckGrid(deck: number[], foils?: LobbyShopItem[]): string {
  const ownedFoilNames = (foils ?? []).filter(f => f.owned).map(f => f.name);
  const foilBack = ownedFoilNames.length
    ? `<div style="font-size:9px;color:var(--gold)">✨${esc(ownedFoilNames.join('+'))}</div>` : '';
  return SUITS.map(([su, c], si) => {
    const cards = Array.from({ length: 13 }, (_, ri) => {
      const fv = deck[si * 13 + ri] ?? 50;
      const rank = RANKS[ri];
      // 每张牌 = 一位名将（doc23 · 52 张全对应）：花色+点数 → 英雄
      const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
      const isFace = ri <= 3;
      const qual = fv >= 70 ? '强' : fv >= 58 ? '良' : fv <= 50 ? '弱' : '中';
      const qualColor = fv >= 70 ? 'var(--gold)' : fv >= 58 ? 'var(--club)' : fv <= 50 ? 'var(--ink-dim)' : 'var(--ink)';
      const cls = 'pcard' + (fv >= 70 ? ' leg' : '') + (fv <= 50 ? ' lock' : '');
      const faceStyle = isFace ? `border-color:${c}90;` : '';
      // 正面（front）：花色水印 + 该将立绘剪影（全 52 张统一）+ 点数 + 将名 + favor
      const front = `<div class="pcard-front">` +
        `<div class="pcard-wm" style="color:${c};font-size:24px;opacity:.07">${su}</div>` +
        (hero ? `<div class="pcard-portrait">${heroPortrait(hero.suit, hero.era, hero.rank, hero.rar)}</div>` : '') +
        `<div class="r" style="color:${c}">${rank}</div>` +
        (hero ? `<div class="pcard-lbl" style="color:${c};opacity:.82">${esc(hero.name)}</div>` : '') +
        `<span class="own">${fv}</span>` +
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
      return `<div class="pcard-wrap" title="${esc(su + rank + (hero ? ' · ' + hero.name + '「' + hero.title + '」' : '') + ' · favor ' + fv)}">` +
        `<div class="${cls}" style="${faceStyle}">${front}${back}</div>` +
      `</div>`;
    }).join('');
    return `<div class="suit-row"><div class="suit-hd" style="color:${c}">${su}</div><div class="suit-line">${cards}</div></div>`;
  }).join('');
}
function shopItem(act: string, glyph: string, it: LobbyShopItem): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  const attr = it.buyable && !it.owned ? ` data-act="${act}" data-k="${it.id}"` : '';
  const lv = it.level !== undefined ? ` <span class="ghost">Lv.${it.level}</span>` : '';
  const foot = it.owned && it.level === undefined ? '<div class="cost">✓ 已融</div>' : `<div class="cost">🪙 ${it.cost}</div>`;
  return `<div class="${cls}"${attr} title="${esc(it.sub)}"><div class="gnm">${glyph} ${esc(it.name)}${lv}</div>${foot}</div>`;
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
    <p><b>经营要点</b>：召唤源泉紧（每回合 +1）→ 每个抉择都重要；机关门换路；同点数凑对子/三条加战力；田忌赛马以强避弱、集中突破。</p>`;
  const hard = `<h3 style="color:#f87171">🔴 高级 · 构筑 · 克制 · 养成</h3>
    <p><b>赛前构筑</b>：天罡 loadout <b>针对当关 Boss 配牌</b>（每关 Boss 明牌亮 3 张地煞·照着 counter-pick）；地支镶嵌凑<b>三合/六合连携</b>质变；集齐流派天罡解锁<b>招牌印</b>。</p>
    <p><b>Boss 战（非对称）</b>：Boss 库 = 12 随机天罡 + 3 专属地煞 = 15 张，比你猛；开局看清地煞、<b>明牌可破</b>。</p>
    <p><b>爆冷缝管理</b>：胜率 = clamp(logistic((P我−P敌)/k), 3%, 97%)。铁骰·磐石·灌铅骰·鬼手 各调爆冷。</p>`;
  const manualBody = `<div class="ctarow" style="margin-bottom:12px">${tb('easy', '🟢 初级', '#4ade80')}${tb('mid', '🟡 中级', '#facc15')}${tb('hard', '🔴 高级', '#f87171')}</div><div style="min-height:200px">${tier === 'easy' ? easy : tier === 'mid' ? mid : hard}</div>`;
  const body = helpTab === 'intro' ? introBody : helpTab === 'tut' ? tutBody : manualBody;
  return `<div class="tut-ov" data-act="help-close"><div class="tut-box intro-scroll" data-stop="1">
    <div class="ctarow" style="margin-bottom:12px">${nav('intro', '📜 游戏介绍')}${nav('tut', '📖 新手指导')}${nav('manual', '📚 玩法手册')}</div>
    <div>${body}</div>
    <div style="text-align:center;margin-top:12px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="help-close">明白了 →</button></div>
  </div></div>`;
}
// 设置（owner 2026-06-20）：皮肤(默认玄铁) + 重看开场/引导 + 重置数据(调试)。
function settingsBox(view: LobbyView): string {
  const seg = (k: 'onyx' | 'rosy', lbl: string): string =>
    `<button class="cta-sub" style="${view.skin === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="skin" data-k="${k}">${lbl}</button>`;
  return `<div class="tut-ov" data-act="settings-close"><div class="tut-box" data-stop="1" style="max-width:420px">
    <h2>⚙ 设置</h2>
    <div style="text-align:left;margin-top:10px"><div class="note" style="text-align:left;margin-bottom:6px">大厅皮肤</div><div class="ctarow">${seg('onyx', '玄铁（默认）')}${seg('rosy', '锦霞')}</div></div>
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">新手内容</div><button class="cta-sub" data-act="replayIntro">↻ 重看开场故事与新手引导</button></div>
    <div style="text-align:left;margin-top:16px;padding-top:12px;border-top:1px solid var(--panel-border)"><div class="note" style="text-align:left;margin-bottom:6px">调试</div><button class="cta-sub" data-act="reset" style="color:var(--danger);border-color:var(--danger)">⚠ 重置所有数据（调试用）</button></div>
    <div style="text-align:center;margin-top:16px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="settings-close">完成 →</button></div>
  </div></div>`;
}
// 商城（owner 2026-06-20 · Demo）：🎴抽卡(doc25 §四·从已解锁池随机·重复转碎片·碎片定向兑换) + 💎钱包(充值/兑换)。
// 全数据驱动：池/价格/汇率读 GACHA / RECHARGE_PACKS / DIAMOND_EXCHANGES；点击 = 真发卡/发币。
function shopBox(view: LobbyView, shopTab: 'gacha' | 'wallet', rechargeErr = ''): string {
  const dia = view.diamond ?? 0;
  const shards = view.dizhiShards ?? 0;
  const tShards = view.tiangangShards ?? 0;
  const needPw = !!view.rechargeNeedsPassword;
  const tabBtn = (k: 'gacha' | 'wallet', lbl: string): string =>
    `<button class="cta-sub" style="${shopTab === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="shopTab" data-k="${k}">${lbl}</button>`;
  const bal = `<div style="display:flex;align-items:center;gap:14px;color:var(--ink-dim);font-size:12px;margin:6px 0 12px"><span>🪙 <b style="color:var(--ink)">${view.coin}</b></span><span>💎 <b style="color:#7fd0ff">${dia}</b></span><span>🔶 <b style="color:#e6b96a">${tShards}</b> 天罡碎片</span><span>🧩 <b style="color:#e6b96a">${shards}</b> 地支碎片</span></div>`;
  // ── 🎴 抽卡 tab ──
  const poolN = view.tiangangs.filter((j) => !j.locked).length;
  const dizhiN = Object.keys(view.dizhiOwned ?? {}).length;
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
  const gachaTab = `${poolCard('tiangang', '🎴', '天罡卡池', `已解锁 ${poolN} 张 · 抽到重复 → +${GACHA.tiangang.dupShards} 天罡碎片`)}
    ${poolCard('dizhi', '🀄', '地支卡池', `12 生肖（已集 ${dizhiN}/12）· 重复自动升档 铜→银→金 · 满金转地支碎片`)}
    <div class="gacha-pool"><div class="gacha-pool-hd">🔶 天罡碎片 · 定向兑换（保底）</div><div class="note" style="text-align:left;margin:2px 0 8px">攒够碎片直接换你想要的天罡——防"抽不到配不出 build"。每张 ${GACHA.tiangang.craftShards} 碎片。</div><div class="gacha-crafts">${craftChips}</div></div>
    <div class="note" style="text-align:left;margin-top:10px;font-size:11px">从「已解锁池」随机（通关解锁更多）。地支镶嵌入战待养成系统开放。</div>`;
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
  // 投资人彩蛋：第二次起需密码（首充免密·已由 needPw 标识）
  const pwBlock = needPw
    ? `<div style="margin-top:8px;display:flex;gap:8px;align-items:center"><input class="rc-pw" type="password" placeholder="充值密码" autocomplete="off" style="flex:1;padding:9px 11px;border-radius:9px;background:var(--chip);border:1px solid ${rechargeErr ? '#e0635f' : 'var(--panel-border)'};color:var(--ink);font-size:13px"><span style="font-size:11px;color:var(--ink-dim)">🔒 复充需密码</span></div>${rechargeErr ? `<div style="color:#e0635f;font-size:12px;margin-top:5px">${rechargeErr}</div>` : ''}`
    : `<div class="note" style="text-align:left;margin-top:6px;font-size:11px">🎁 首充免密「送一点点」体验。</div>`;
  const walletTab = `<div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:4px 0 8px">充值 · 越充越送（Demo·点即到账）</div>
    <div class="rc-grid">${RECHARGE_PACKS.map(packCard).join('')}</div>
    ${pwBlock}
    <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:16px 0 8px">兑换金币 · 💎 → 🪙（改造坊通用材料）</div>
    <div class="rc-grid">${DIAMOND_EXCHANGES.map(exCard).join('')}</div>
    <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:16px 0 8px">兑换地支碎片 · 💎 → 🧩（养地支专属材料）</div>
    <div class="rc-grid">${DIZHI_SHARD_PACKS.map(shardCard).join('')}</div>
    <div class="note" style="text-align:left;margin-top:12px;font-size:11px">Demo 演示：充值为模拟，点击直接到账、不走真实支付。</div>`;
  return `<div class="tut-ov" data-act="recharge-close"><div class="tut-box intro-scroll" data-stop="1" style="max-width:560px">
    <h2>🛒 商城</h2>
    <div class="ctarow" style="margin:4px 0 2px">${tabBtn('gacha', '🎴 抽卡')}${tabBtn('wallet', '💎 钱包')}</div>
    ${bal}
    ${shopTab === 'gacha' ? gachaTab : walletTab}
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

// 新手引导 coach（doc28 §二 · 线性·底部锚定·可跳过）。教学关战斗=甲（turn-combat 脚本弱敌），此处=菜单引导壳。
const GUIDE_STEPS = 2;
function guideBox(step: number): string {
  const s = Math.max(0, Math.min(GUIDE_STEPS - 1, step));
  const card = (title: string, body: string, action: string): string =>
    `<div class="guide-coach"><div class="guide-hd"><span>🧭 新手引导 · 第 ${s + 1}/${GUIDE_STEPS} 步</span><button class="guide-skip" data-act="guide-skip">跳过引导</button></div><div class="guide-title">${title}</div><div class="guide-body">${body}</div><div class="guide-act">${action}</div></div>`;
  if (s === 0) return card('先翻一遍《玩法手册》', '30 秒看懂怎么打：三路九格 · 每回合四选一 · 掷命对决（正面活/反面亡）· 先破对面 3 血大本营。', `<button class="cta-sub" data-act="man">📖 打开手册</button><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="guide-next">看过了，下一步 →</button>`);
  return card('打你的第一战', '准备好了——进第一场命运之战：温泉关 · 列奥尼达（最易）。打赢，解封你的第一缕英雄之魂。', `<button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="guide-finish">${GI.swords} 开始第一战 →</button>`);
}
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
    const fiends = c.fiends.map((f) => `<span class="camp-fiend"><b>${esc(f.name)}</b> ${esc(f.desc)}</span>`).join('');
    const cta = isCur ? `<button class="cta-sub" style="margin-top:12px;color:#2a1a08;background:var(--gold-grad);border:0" data-act="play">${GI.swords} 出征 · 第 ${c.stage} 关 →</button>` : '';
    return `<div class="camp-card${isCur ? ' cur' : ''}">${head}<div style="font-size:13px;line-height:1.85;color:var(--ink);margin-top:9px">${esc(c.intro ?? c.oneLiner)}</div>${lines}<div style="margin-top:10px"><div class="note" style="text-align:left;margin-bottom:5px">🎴 地煞（明牌可破）</div><div class="camp-fiends">${fiends}</div></div>${cta}</div>`;
  }).join('');
  return `<div class="card" style="background:none;border:0;box-shadow:none;padding:0"><h2 style="margin-bottom:4px">⚔️ 命运之战 · 战役进度 <span class="ghost" style="margin-left:auto;font-size:12px">第 ${cur} / ${STAGE_CAMPAIGN.length} 关 · 全 52 役逐步解封</span></h2><div class="note" style="text-align:left;margin-bottom:12px">五十二位被诅咒的名将，每一关是一位英雄的成名之战。打赢=破其诅咒、收魂入麾。</div><div class="camp-list">${cards}</div><div class="note" style="text-align:left;margin-top:14px;color:var(--ink-dim)">🔮 关 6–52（孙武 · 成吉思汗 · 汉尼拔……）战役背景与 Boss 对白已入库，随战役章节逐步开放。</div></div>`;
}

// 改造坊天罡牌货架项（B3）：买入 + 选入/踢出战库双动作 + 牌力/P̂ 展示。
// 地支附魔台（owner 2026-06-20 · 乙简版）：① 选一张扑克牌 → ② 把已拥有的地支生肖镶进去（≤INLAY_MAX 槽）→ +favor。
// 真影响战斗（经 effectiveDeckFavors→myBias）。连携(三合/六合)留甲契约④。
function enchantPanel(view: LobbyView, craftSel: string): string {
  const deck = view.deck;
  const inlays = view.inlays ?? {};
  const owned = view.dizhiOwned ?? {};
  const tierName = ['', '铜', '银', '金'];
  const zodOf = (b: string): typeof DIZHI_ZODIACS[number] | undefined => DIZHI_ZODIACS.find((z) => z.branch === b);
  // 52 牌选择网格
  const grid = SUITS.flatMap(([su, c], si) => RANKS.map((rank, ri) => {
    const idx = si * 13 + ri;
    const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
    const fv = deck[idx] ?? 50;
    const n = (inlays[String(idx)] ?? []).length;
    const sel = craftSel === String(idx);
    return `<button class="ench-card${sel ? ' sel' : ''}" data-act="craftSel" data-k="${idx}"><span class="ench-rk" style="color:${c}">${rank}${su}</span><span class="ench-nm">${hero ? esc(hero.name) : ''}</span><span class="ench-fv">${fv}${n ? ` <span style="color:var(--gold)">🀄${n}</span>` : ''}</span></button>`;
  })).join('');
  // 选中牌的镶嵌详情
  let detail = `<div class="note" style="text-align:left;color:var(--ink-dim);padding:14px 0">← 选一张牌，给它镶地支附魔</div>`;
  if (craftSel !== '' && deck[+craftSel] !== undefined) {
    const ix = +craftSel;
    const [su, c] = SUITS[Math.floor(ix / 13)];
    const rank = RANKS[ix % 13];
    const hero = HERO_CARDS.find((h) => h.suit === su && h.rank === rank);
    const inlaid = inlays[String(ix)] ?? [];
    const bonus = inlayBonus(inlaid, owned);
    const full = inlaid.length >= INLAY_MAX;
    const slots = Array.from({ length: INLAY_MAX }, (_, k) => {
      const b = inlaid[k];
      if (b) { const z = zodOf(b); return `<button class="ench-slot filled" data-act="removeInlay" data-k="${ix}:${b}" title="卸下 ${z?.animal ?? b}"><span>${esc(z?.animal ?? b)}</span><span class="ench-rm">✕</span></button>`; }
      return `<div class="ench-slot empty">＋</div>`;
    }).join('');
    const ownedZ = DIZHI_ZODIACS.filter((z) => (owned[z.branch] ?? 0) >= 1);
    const pick = ownedZ.length
      ? ownedZ.map((z) => { const t = owned[z.branch]; return `<button class="ench-pick"${full ? ' disabled' : ` data-act="inlay" data-k="${ix}:${z.branch}"`}>${esc(z.branch)}·${esc(z.animal)}·${tierName[t]} <b style="color:var(--gold)">+${DIZHI_INLAY_FAVOR[t]}</b></button>`; }).join('')
      : '<span class="ghost" style="font-size:12px">还没有地支生肖 · 去「🛒商城」抽卡获取</span>';
    detail = `<div class="ench-detail"><div class="ench-sel-card" style="border-color:${c}"><div class="ench-sel-rk" style="color:${c}">${rank}<br>${su}</div><div class="ench-sel-nm">${hero ? esc(hero.name) : ''}</div><div class="ench-sel-fv">favor <b style="color:var(--gold)">${deck[ix]}</b>${bonus ? ` <span style="color:var(--club);font-size:11px">(含附魔 +${bonus})</span>` : ''}</div></div>
      <div style="flex:1"><div class="note" style="text-align:left;margin-bottom:5px">镶嵌槽（${inlaid.length}/${INLAY_MAX}）· 点✕卸下</div><div class="ench-slots">${slots}</div>
      <div class="note" style="text-align:left;margin:10px 0 5px">${full ? '<span style="color:var(--gold)">槽位已满</span>' : '点一个地支镶入：'}</div><div class="ench-picks">${pick}</div></div></div>`;
  }
  return `<div class="card"><h2>${GI.crafting} 地支牌 · 生肖镶嵌（附魔） <span class="ghost" style="margin-left:auto;font-size:12px">生肖镶进牌 → +favor · ≤${INLAY_MAX} 槽</span></h2>
    <div class="note" style="text-align:left;margin-bottom:8px">用收集的地支生肖给扑克牌附魔（铜+${DIZHI_INLAY_FAVOR[1]}/银+${DIZHI_INLAY_FAVOR[2]}/金+${DIZHI_INLAY_FAVOR[3]} favor），真提升战力。</div>
    <div class="ench-grid">${grid}</div>
    ${detail}</div>`;
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
  return `<div class="${cls}"${buyAttr} title="${esc(it.sub)}"><div class="gnm">${stageBadge} ${tiangangIcon(it.icon, it.tint)} ${esc(it.name)}${stars}${phat}</div>${foot}</div>`;
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

// 天罡牌组编辑器（owner 2026-06-20 重做）：① 选/建/删牌组 → ② 一排 size 槽（满槽可✕移除·空槽＋添加）
// → ③ 点＋弹「选卡弹窗」从已拥有天罡里挑一张入组。买卡=商城/改造坊；编组只在此处，不两地跳。
function tiangangDeckManager(view: LobbyView): string {
  const decks = view.decks ?? [];
  const size = view.deckSize ?? 12;
  const inDeck = view.tiangangs.filter((j) => j.inDeck);
  const deckFull = inDeck.length >= size;
  const chips = decks.map((d) => `<button class="deck-chip${d.active ? ' on' : ''}" data-act="selectDeck" data-k="${d.id}">${d.active ? '⚔ ' : ''}${esc(d.name)} <span class="ghost">${d.size}/${size}</span>${decks.length > 1 ? `<span class="deck-del" data-act="delDeck" data-k="${d.id}" title="删除牌组">✕</span>` : ''}</button>`).join('');
  const addDeckBtn = view.canAddDeck ? `<button class="deck-chip add" data-act="newDeck">＋ 新建牌组</button>` : '';
  const filled = inDeck.map((j) => `<div class="tg-slot" title="${esc(j.sub)}"><div class="tg-slot-ic">${tiangangIcon(j.icon, j.tint)}</div><b>${esc(j.name)}</b><button class="tg-rm" data-act="toggleTiangang" data-k="${j.id}" title="移出牌组">✕</button></div>`).join('');
  const empties = Array.from({ length: Math.max(0, size - inDeck.length) }, () => `<button class="tg-slot empty" data-act="deckAdd" title="添加天罡牌"><span>＋</span></button>`).join('');
  return `<div class="card" style="margin-bottom:14px"><h2>${GI.bolt} 天罡牌组 · 编辑 <span class="ghost" style="margin-left:auto;font-size:12px">出战带 ${size} 张 · 自建多套切换</span></h2>
    <div class="note" style="text-align:left;margin-bottom:6px">① 选一个牌组（= 这场出战带的那套），或新建</div>
    <div class="deck-chips">${chips}${addDeckBtn}</div>
    <div class="note" style="text-align:left;margin:12px 0 7px">② 出战牌组「<b style="color:var(--gold)">${esc(view.activeDeckName ?? '')}</b>」 ${inDeck.length}/${size} —— 满槽点 <b>✕ 移除</b>，空槽点 <b>＋ 添加</b></div>
    <div class="tg-deck">${filled}${empties}</div>
    ${deckFull ? '<div class="note" style="text-align:left;margin-top:8px;color:var(--gold)">牌组已满 12 张，出战即带这套。</div>' : ''}</div>`;
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

const RAR_META: Record<string, [string, string]> = {
  white: ['普通', '#b9bec8'], green: ['精良', '#5bbf7a'], blue: ['稀有', '#3a9bff'],
  purple: ['史诗', '#bf6bff'], orange: ['传说', '#f0972f'],
};
const SUIT_H: Record<string, string> = { '♠': '#5b7fb0', '♥': '#d8504e', '♦': '#e0973a', '♣': '#3fae6e' };
const SUIT_N: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };
function heroCollSection(heroSuit: string, heroRar: string, heroDetail: string, ownedOnly: boolean): string {
  const filtered = HERO_CARDS.filter(h =>
    (heroSuit === 'all' || h.suit === heroSuit) &&
    (heroRar === 'all' || h.rar === heroRar) &&
    (!ownedOnly || h.own > 0)
  );
  const selId = heroDetail || filtered[0]?.id || '';
  const selCard = HERO_CARDS.find(h => h.id === selId);
  const pill = (on: boolean, act: string, k: string, lbl: string): string =>
    `<button class="filter-pill${on?' on':''}" data-act="${act}" data-k="${esc(k)}">${lbl}</button>`;
  const suitPills: [string, string][] = [['all','全部'],['♠','♠'],['♥','♥'],['♦','♦'],['♣','♣']];
  const rarPills: [string, string][] = [['all','全部'],['blue','稀有'],['purple','史诗'],['orange','传说'],['white','普通']];
  const filterBar = `<div class="coll-filter-bar"><div style="display:flex;align-items:center;gap:10px"><span class="filter-lbl">花色</span>${suitPills.map(([k,l]) => pill(heroSuit===k,'heroSuit',k,l)).join('')}</div><div class="filter-div"></div><div style="display:flex;align-items:center;gap:10px"><span class="filter-lbl">稀有度</span>${rarPills.map(([k,l]) => pill(heroRar===k,'heroRar',k,l)).join('')}</div><div style="flex:1"></div><button class="filter-pill${ownedOnly?' on':''}" data-act="heroOwned" data-k="">${ownedOnly?'☑ 仅已拥有':'☐ 仅已拥有'}</button><div class="filter-pill" style="cursor:pointer">点数 ▾</div></div>`;
  const grid = `<div style="flex:1;min-width:0;overflow-y:auto;padding-right:6px"><div class="hero-grid6">${
    filtered.map(h => {
      const sc = SUIT_H[h.suit] ?? '#9ca3af';
      const rc = RAR_META[h.rar]?.[1] ?? '#9ca3af';
      const locked = h.own === 0;
      const isSel = selId === h.id;
      return `<div class="hcard2${isSel?' sel':''}${locked?' locked':''}" data-act="heroDetail" data-k="${h.id}"><div class="hc2-portrait" style="background:linear-gradient(165deg,${sc}33,${sc}11),radial-gradient(circle at 50% 36%,${sc}55,transparent 62%);border-bottom:2px solid ${rc}"><div class="hc2-corner" style="color:${sc}">${h.rank}<br>${h.suit}</div><div class="hc2-fig">${heroPortrait(h.suit, h.era, h.rank, h.rar)}</div><div class="hc2-gem" style="background:${rc};color:${rc}"></div>${locked?'<div class="hc2-lock">🔒</div>':''}</div><div class="hc2-name">${esc(h.name)}</div><div class="hc2-own" style="color:${locked?'var(--ink-dim)':rc}">${locked?'未拥有':'×'+h.own}</div></div>`;
    }).join('')
  }</div></div>`;
  let detailPane = `<div class="hero-detail-pane" style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ink-dim);font-size:13px">← 选择英雄查看详情</div>`;
  if (selCard) {
    const sc = SUIT_H[selCard.suit] ?? '#9ca3af';
    const [rarName, rarColor] = RAR_META[selCard.rar] ?? ['普通', '#9ca3af'];
    // 二阶「列传」（doc23 §一）：如展开一卷古书——先叙事后数值；缺字段优雅占位；英雄层=纯叙事·不进对战强度（公平骨架·doc22 §四）。
    const scroll = (label: string, body: string): string =>
      `<div style="margin-top:15px"><div style="font-family:var(--fd);font-size:15px;color:var(--gold);margin-bottom:5px">${label}</div><div style="font-size:13px;color:var(--ink);line-height:1.85">${body}</div></div>`;
    const curse = selCard.curseIntro ? esc(selCard.curseIntro) : '<span class="ghost">此魂之诅咒序待录 · 命运待解封</span>';
    const bio = selCard.bio ? esc(selCard.bio) : `${esc(selCard.contrib)}<br><span class="ghost">—— 全传逐期补录。</span>`;
    const battle = selCard.battleName ? scroll('名 战', `<b style="color:var(--ink)">${esc(selCard.battleName)}</b> —— ${esc(selCard.battleResult ?? '')}`) : '';
    const quote = selCard.quote ? `<div style="margin-top:15px;text-align:center;font-family:var(--fd);font-size:20px;color:var(--gold);padding:11px 0;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)">「${esc(selCard.quote)}」</div>` : '';
    const origin = selCard.titleOrigin ? scroll('称号由来', esc(selCard.titleOrigin)) : '';
    detailPane = `<div class="hero-detail-pane" style="overflow-y:auto"><div class="hd2-art" style="background:linear-gradient(165deg,${sc}44,${sc}14),radial-gradient(circle at 50% 34%,${sc}66,transparent 60%);border:4px solid ${rarColor};box-shadow:0 0 26px ${rarColor}55,inset 0 0 0 2px rgba(255,255,255,.5)"><div class="hd2-corner" style="top:10px;left:12px;color:${sc}">${selCard.rank}<br>${selCard.suit}</div><div class="hd2-fig">${heroPortrait(selCard.suit, selCard.era, selCard.rank, selCard.rar)}</div><div class="hd2-corner" style="bottom:10px;right:12px;transform:rotate(180deg);color:${sc}">${selCard.rank}<br>${selCard.suit}</div></div><div style="display:flex;align-items:baseline;gap:10px;margin-top:14px"><div style="font-family:var(--fd);font-size:30px;color:var(--ink);line-height:1">${esc(selCard.name)}</div><span style="display:inline-block;padding:3px 10px;background:#9b2d22;color:#f5e6c8;border-radius:4px;font-family:var(--fh);font-weight:700;font-size:13px;box-shadow:0 1px 4px rgba(155,45,34,.5)">${esc(selCard.title)}</span></div><div style="font-size:12px;color:var(--ink-dim);margin-top:5px">${esc(selCard.era)} · 贡献度 第 ${selCard.contribRank} 位</div><div class="hd2-chips"><span class="hd2-chip" style="background:${rarColor}22;color:${rarColor};border:1px solid ${rarColor}66">${rarName}</span><span class="hd2-chip" style="background:${sc}22;color:${sc};border:1px solid ${sc}66">${selCard.suit} ${SUIT_N[selCard.suit] ?? ''}</span><span class="hd2-chip" style="background:var(--chip);color:var(--ink-dim);border:1px solid var(--panel-border)">军衔 ${selCard.rank}</span></div>${scroll('诅咒 · 序', curse)}${scroll('列传 · 生平', bio)}${battle}${quote}${origin}${scroll('战绩 · 成长弧', '<span class="ghost">尚未立功 · 杀敌 → 称号 → 数值后定（公平骨架：英雄层不进对战强度）</span>')}<div style="display:flex;gap:9px;margin-top:16px"><button style="flex:1;padding:11px;border-radius:11px;cursor:pointer;background:var(--chip);border:1px solid var(--panel-border);color:var(--ink);font-family:var(--fh);font-weight:700;font-size:14px">改造</button><button style="flex:2;padding:11px;border-radius:11px;clip-path:var(--chamfer);cursor:pointer;border:none;background:var(--gold-grad);color:#2a1a08;font-family:var(--fh);font-weight:700;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)">加入牌组</button></div></div>`;
  }
  return `${filterBar}<div style="display:flex;gap:20px;flex:1;min-height:0">${grid}${detailPane}</div>`;
}

function ladderSection(name: string, rankText: string): string {
  const RECENTS: [string, string, string, string, string][] = [
    ['胜', 'win', '天梯掷命 1v1', '黑桃急袭 · 翻正 4/5', '+22'],
    ['胜', 'win', '天梯掷命 1v1', '红桃火攻 · 斩首奏效', '+19'],
    ['负', 'lose', '天梯掷命 1v1', '田忌阵被识破', '−16'],
    ['胜', 'win', '天梯掷命 1v1', '锋矢破中路', '+21'],
    ['胜', 'win', '天梯掷命 1v1', '黑杰克级正面率', '+18'],
    ['负', 'lose', '天梯掷命 1v1', '能量误判', '−14'],
  ];
  const LADDER_DATA: [string, string, string, string, string, string, string][] = [
    ['1', '同花顺王', '♠', '黑桃A', '♠ 顺子', '78%', '2880'],
    ['2', '红桃皇后', '♥', '红桃K', '♥ 火攻', '74%', '2710'],
    ['3', '方块老千', '♦', '方块Q', '♦ 配重', '71%', '2640'],
    ['4', '梅花骑士', '♣', '梅花J', '♣ 连携', '69%', '2510'],
    ['5', '百搭天罡', '♠', '黑桃10', '混 · 干预', '67%', '2380'],
    ['6', '黑桃暗影', '♠', '黑桃A', '♠ 速攻', '65%', '2240'],
    ['7', name, '♠', '黑桃A', '♠ 急袭', '64%', '1240'],
    ['8', '掷地有声', '♦', '方块K', '♦ 稳翻', '61%', '1180'],
  ];
  const recentsHtml = RECENTS.map(([result, k, mode, detail, lp]) => {
    const win = k === 'win';
    return `<div class="rec-row"><div class="rec-result ${win?'win':'lose'}">${result}</div><div style="flex:1;min-width:0"><div style="font-family:var(--fh);font-weight:700;font-size:13px;color:var(--ink)">${esc(mode)}</div><div style="font-size:10px;color:var(--ink-dim)">${esc(detail)}</div></div><span style="font-family:var(--fn);font-size:13px;color:${win?'var(--hp)':'var(--danger)'}">${esc(lp)}</span></div>`;
  }).join('');
  const ladderHtml = LADDER_DATA.map(([rank, lname, suit, mainCard, deck, wr, lp]) => {
    const top3 = +rank <= 3;
    const isMe = lname === name;
    const sc = SUIT_H[suit] ?? '#9ca3af';
    return `<div class="ldr-row" style="${isMe?'background:rgba(232,205,130,.08);border-color:var(--gold);':''}"><span style="width:48px;text-align:center;font-family:var(--fn);font-size:${top3?'18px':'14px'};color:${top3?'var(--gold)':'var(--ink-dim)'}">${esc(rank)}</span><div class="ldr-av" style="background:linear-gradient(150deg,${sc}dd,${sc}88)">${esc(suit)}</div><div style="flex:1;min-width:0"><div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lname)}</div><div style="font-size:10px;color:var(--ink-dim);white-space:nowrap">主牌 ${esc(mainCard)}</div></div><span style="width:90px;flex:none;text-align:center;font-family:var(--fh);font-weight:700;font-size:12px;color:var(--ink-dim);white-space:nowrap">${esc(deck)}</span><span style="width:70px;text-align:right;font-family:var(--fn);font-size:12px;color:var(--ink-dim)">${esc(wr)}</span><span style="width:80px;text-align:right;font-family:var(--fn);font-size:14px;color:var(--gold)">${esc(lp)}</span></div>`;
  }).join('');
  return `<div style="display:flex;gap:20px;flex:1;min-height:0"><div style="width:340px;flex:none;display:flex;flex-direction:column;gap:16px"><div class="rank-card"><div class="rank-crest">♠</div><div style="font-family:var(--fd);font-size:40px;color:var(--ink);margin-top:10px;line-height:1">${esc(rankText)}</div><div style="font-family:var(--fn);font-size:15px;color:var(--gold);margin-top:6px">1240 LP</div><div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:62%"></div></div><div style="display:flex;justify-content:space-between;width:100%;margin-top:8px;font-size:11px;color:var(--ink-dim)"><span>${esc(rankText)}</span><span>距晋级 60 LP</span><span>—</span></div><div style="display:flex;gap:8px;margin-top:16px;width:100%"><div class="mini-stat"><span class="mini-num">64%</span><span class="mini-lbl">胜率</span></div><div class="mini-stat"><span class="mini-num-hp">3</span><span class="mini-lbl">连胜</span></div><div class="mini-stat"><span class="mini-num">71%</span><span class="mini-lbl">翻正率</span></div></div></div><div class="rec-sheet"><div class="rec-sheet-hd">近 10 局</div><div style="display:flex;flex-direction:column;gap:7px">${recentsHtml}</div></div></div><div class="rec-sheet"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="font-family:var(--fd);font-size:26px;color:var(--ink)">全服榜</span><div style="display:flex;gap:5px;margin-left:6px"><button class="scope-on">全服</button><button class="scope-off">好友</button><button class="scope-off">同段</button></div><div style="flex:1"></div><span style="font-size:11px;color:var(--ink-dim)">每 5 分钟刷新 · 赛季 7</span></div><div class="ldr-head-row"><span style="width:48px">名次</span><span style="flex:1">玩家 / 主牌</span><span style="width:90px;text-align:center">主流派</span><span style="width:70px;text-align:right">胜率</span><span style="width:80px;text-align:right">LP</span></div><div style="flex:1;overflow-y:auto">${ladderHtml}</div></div></div>`;
}

const FIEND_KIND_CLR: Record<string, string> = { power: '#ef4444', odds: '#a78bfa', combo: '#2dd4bf', morale: '#fcd34d', tempo: '#22c55e', stamina: '#38bdf8', draw: '#06b6d4', lane: '#94a3b8', siege: '#a8a29e' };
// 地煞图鉴（doc23 §八/§九 · 52 Boss × 3 招牌历史战术·明牌可破）。kind 借天罡词汇配色。
function fiendsCodex(): string {
  return `<div style="flex:1;min-height:0;overflow-y:auto;padding-right:6px"><div class="note" style="text-align:left;margin-bottom:10px">🎴 <b>地煞</b> = 每位 Boss 的招牌历史战术（明牌·公平可破）。开局看清、针对构筑 counter-pick。共 ${EARTH_FIENDS.length} 位 Boss。</div>${EARTH_FIENDS.map((b) => {
    const fs = b.fiends.map((f) => {
      const clr = FIEND_KIND_CLR[f.kind.split('+')[0]] ?? '#9ca3af';
      return `<div class="fiend-card"><div class="fiend-hd"><b>${esc(f.name)}</b><span class="fiend-kind" style="color:${clr};border-color:${clr}66">${esc(f.kind)}</span></div><div class="fiend-eff">${esc(f.effect)}</div><div class="fiend-cnt">🛡 破：${esc(f.counter)}</div></div>`;
    }).join('');
    return `<div class="boss-block"><div class="boss-hd"><span class="boss-name">${esc(b.boss)}</span><span class="ghost" style="font-size:11px">招牌战术 ×${b.fiends.length}</span></div><div class="fiend-row">${fs}</div></div>`;
  }).join('')}</div>`;
}

export function renderLobby(view: LobbyView, tab: string, helpOpen: boolean, deckTab: 'base' | 'gang' | 'dizhi' = 'base', earthFilter = 'all', collTab = 'cards', heroSuit = 'all', heroDetail = '', heroRar = 'all', ownedOnly = false, settingsOpen = false, manualTier: 'easy' | 'mid' | 'hard' = 'easy', rechargeOpen = false, rechargeErr = '', story: { beats: StoryBeat[]; idx: number; label: string; cta: string } | null = null, guideSkipAsk = false, shopTab: 'gacha' | 'wallet' = 'wallet', gachaReveal: GachaResult[] | null = null, deckPickerOpen = false, craftSel = '', helpTab: 'intro' | 'tut' | 'manual' = 'intro'): string {
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
    <button class="tutbtn" data-act="shop" title="商城 · 抽卡 / 充值 / 兑换">🛒 商城</button>
    <div class="coin" title="金币 · 打战斗赚 · 解锁天罡/地支"><span>🪙</span><b>${kfmt(view.coin)}</b></div>
    <button class="coin tap" data-act="recharge" title="钻石 · 充值 / 兑换材料"><span>💎</span><b style="color:#7fd0ff">${kfmt(view.diamond ?? 0)}</b><span style="color:var(--gold);font-weight:700;margin-left:2px">＋</span></button>
    <button class="coin tap" data-act="recharge" title="地支碎片 · 养地支专属材料（💎可换）"><span>🧩</span><b style="color:#e6b96a">${kfmt(view.dizhiShards ?? 0)}</b></button>
    <div class="coin" title="闪艺 · 牌面皮肤收集（纯装饰·改造坊点亮）"><span>✨</span><span style="color:#7fb0d8">${view.foilCount}</span></div>
    <button class="tutbtn" data-act="man">📚 玩法手册</button>
    <button class="icon" data-act="settings" title="设置 · 皮肤 / 重看引导 / 重置">⚙</button>
  </div>
  <div class="nav">
    <button class="${on('home')}" data-act="tab" data-k="home">大厅</button>
    <button class="${on('campaign')}" data-act="tab" data-k="campaign">战役</button>
    <button class="${on('decks')}" data-act="tab" data-k="decks">牌组</button>
    <button class="${on('coll')}" data-act="tab" data-k="coll">收藏</button>
    <button class="${on('craft')}" data-act="tab" data-k="craft">改造坊</button>
    <button class="${on('ladder')}" data-act="tab" data-k="ladder">天梯</button>
  </div>
  <div class="content">
    ${(() => {
      const c = view.campaign;
      const stars = c ? '★'.repeat(c.stars) + '<span style="opacity:.35">' + '★'.repeat(3 - c.stars) + '</span>' : '';
      const fiends = c ? c.fiends.map((f) => `<div class="fiend"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span></div>`).join('') : '';
      return `<section class="screen${on('home')} homerow">
      <div class="herocol">
        <div class="felt">
          <div class="vignette"></div>
          <div class="felt-h"><span class="t">${c ? `第 ${c.stage} 关 · ${esc(c.battle)}` : '戏牌师'}</span><span class="s">${c ? `执掌命运之人 · 挑战被诅咒的 ${esc(c.boss)}` : esc(view.stageLabel)}</span></div>
          <div class="stags">${stags}</div>
          <div class="duel">
            <div class="dcard" style="border:3px solid var(--spade);transform:rotate(-9deg);--rot:-9deg"><div class="corner" style="color:var(--spade)">A<br>♠</div><div class="big" style="color:var(--spade)">♠</div></div>
            <div class="vs">掷</div>
            <div class="dback"><i></i></div>
          </div>
          ${c ? `<div style="position:absolute;left:0;right:0;bottom:104px;text-align:center;color:#fff;font-size:13px;text-shadow:0 2px 8px rgba(0,0,0,.7)">⚔ 对决 <b style="font-family:var(--fd);font-size:18px">${esc(c.boss)}</b> · <span style="opacity:.85">${esc(c.oneLiner)}</span></div>` : ''}
          <div class="ctawrap">
            <button class="cta-main" data-act="play"><span class="sheen"></span><span class="big">${GI.swords} 出征 · ${c ? `第 ${c.stage} 关` : esc(view.rankText)}</span><span class="sm">${c ? `挑战 ${esc(c.boss)} · ${esc(c.battle)} · 难度 ${stars}` : 'DEPLOY · 单人战役 vs AI 庄家'}</span></button>
            <div class="ctarow"><button class="cta-sub" data-act="intro">📜 游戏介绍</button><button class="cta-sub" data-act="tut">📖 怎么打</button></div>
          </div>
        </div>
        ${deckPreviewPanel(view.tiangangs, view.deckArchName, view.deckArchActivated, view.deckSize ?? 12, view.activeDeckName)}
      </div>
      <div class="rail"><h2>⚔ 本关 Boss · ${esc(c?.boss ?? '—')}</h2>
        <div style="font-size:13px;color:var(--ink);margin-bottom:4px">${c ? `${esc(c.boss)} · <span class="ghost">${esc(c.battle)}</span>` : ''}</div>
        <div style="font-size:12px;color:var(--ink-dim);margin-bottom:10px">难度 <span style="color:var(--gold)">${stars}</span>　${c ? esc(c.oneLiner) : ''}</div>
        <div class="note" style="text-align:left;margin-bottom:8px">🎴 <b>地煞</b>（明牌·公平可破）— Boss 的招牌历史战术：</div>
        ${fiends}
        ${c ? `<div style="margin-top:12px;padding:9px 11px;border-radius:9px;background:rgba(232,205,130,.10);border:1px solid var(--hairline);font-size:12px">🏆 打赢 = 破其诅咒 · 通关解锁天罡 <b style="color:var(--gold)">${esc(c.unlock)}</b></div>` : ''}
        <div class="ghost" style="font-size:11px;line-height:1.7;margin-top:10px">好友切磋 / 天梯 1v1 = 设计 IA·待接网络。当前 = 单人 52 战役 vs AI 庄家。</div>
      </div>
    </section>`;
    })()}
    <section class="screen${on('campaign')} full" style="flex-direction:column;overflow-y:auto">${campaignSection(view)}</section>
    <section class="screen${on('decks')} full">${deckPreviewPanel(view.tiangangs, view.deckArchName, view.deckArchActivated, view.deckSize ?? 12, view.activeDeckName)}<div class="deck-nav"><button class="${deckTab==='base'?'on':''}" data-act="deckTab" data-k="base">扑克牌组</button><button class="${deckTab==='gang'?'on':''}" data-act="deckTab" data-k="gang">天罡牌组</button><button class="${deckTab==='dizhi'?'on':''}" data-act="deckTab" data-k="dizhi">地支牌</button></div><div class="dsub${dOn('base')}"><div class="card"><h2>📜 扑克牌组 · 52 张 <span class="ghost" style="margin-left:auto;font-size:12px">favor 均 ${view.deckAvg} · 最低 ${view.deckMin} / 最高 ${view.deckMax}</span></h2>${suitBarsPanel(view.deck, view.deckAvg)}<div>${deckGrid(view.deck, view.foils)}</div><div class="note" style="text-align:left">favor=该牌掷命翻正面(存活)的概率底盘。<b style="color:var(--gold)">金边</b>=强(≥70) / 暗格=弱(≤50)。牌组强度靠<b>天罡牌/地支牌/流派</b>提升 → 去「改造坊」经营。</div></div></div><div class="dsub${dOn('gang')}">${tiangangDeckManager(view)}</div><div class="dsub${dOn('dizhi')}"><div class="card"><h2>${GI.planet} 地支牌 · 十二生肖 <span class="ghost" style="margin-left:auto;font-size:12px">铜→银→金 · 镶进牌附魔（改造坊）</span></h2><div class="earth-filter">${efBtn('all','全部','background:var(--gold-grad);color:#2a1a08;border:0')}${efBtn('bronze','铜','background:#cd7f32;color:#fff;border:0')}${efBtn('silver','银','background:#c4ccd6;color:#2a2a2a;border:0')}${efBtn('gold','金','background:var(--gold-grad);color:#2a1a08;border:0')}</div>${earthSection(earthFilter, view.dizhiOwned ?? {})}</div></div></section>
    <section class="screen${on('coll')} full" style="flex-direction:column"><div class="deck-nav"><button class="${collTab==='cards'?'on':''}" data-act="collTab" data-k="cards">收藏·牌谱</button><button class="${collTab==='ladder'?'on':''}" data-act="collTab" data-k="ladder">天梯·榜</button><button class="${collTab==='fiends'?'on':''}" data-act="collTab" data-k="fiends">地煞·战法</button><button class="${collTab==='collect'?'on':''}" data-act="collTab" data-k="collect">天罡&amp;闪艺</button></div><div class="dsub${cOn('cards')}" style="flex:1;min-height:0;flex-direction:column">${heroCollSection(heroSuit, heroRar, heroDetail, ownedOnly)}</div><div class="dsub${cOn('ladder')}" style="flex:1;min-height:0;flex-direction:column">${ladderSection(view.name, view.rankText)}</div><div class="dsub${cOn('fiends')}" style="flex:1;min-height:0;flex-direction:column">${fiendsCodex()}</div><div class="dsub${cOn('collect')}"><div class="card"><h2>🗃 天罡牌 · 收藏 ${view.tiangangs.filter((j) => j.owned).length}/${view.tiangangs.length}</h2><div class="note" style="text-align:left;margin-bottom:6px">⚡ 已解锁天罡牌（到「牌组」屏编入出战牌组）</div><div class="shelf">${view.tiangangs.map((j) => shopItem('', tiangangIcon(j.icon, j.tint), { ...j, buyable: false })).join('')}</div><div class="note" style="text-align:left;margin:12px 0 6px">✨ 闪艺 foil（纯装饰收集 · 点亮可购买）· ${view.foils.filter((f) => f.owned).length}/${view.foils.length}</div><div class="shelf">${view.foils.map((f) => shopItem('buyFoil', '✨', f)).join('')}</div></div></div></section>
    <section class="screen${on('craft')} full"><div class="craft-zones">
      ${enchantPanel(view, craftSel)}
      <div class="forge">
        <div class="card"><h2>${GI.bolt} 天罡牌 · 购买 <span class="ghost" style="margin-left:auto;font-size:12px">局内法术·买入后到牌组编入</span></h2>
          <div class="note" style="text-align:left;margin-bottom:8px">花金币买入天罡牌（解锁后入「拥有」）；编进出战牌组到「牌组」屏做。</div>
          <div class="shelf">${view.tiangangs.map((j) => craftTiangangItem(j)).join('')}</div></div>
      </div>
    </div></section>
    <section class="screen${on('ladder')} full">${ladderSection(view.name, view.rankText)}</section>
  </div>
  </div>${helpOpen ? helpBox(helpTab, manualTier) : ''}${settingsOpen ? settingsBox(view) : ''}${rechargeOpen ? shopBox(view, shopTab, rechargeErr) : ''}${gachaReveal ? gachaRevealBox(gachaReveal) : ''}${story ? narrationBox(story.beats, story.idx, story.label, story.cta) : (!view.firstLaunch && (view.guideStep ?? -1) >= 0 ? guideBox(view.guideStep ?? 0) : '')}${guideSkipAsk ? guideSkipDialog() : ''}${deckPickerOpen ? deckPickerBox(view) : ''}</div>`;
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
  onExchange?: (exId: string) => void; // 兑换 💎→🪙金币
  onBuyShards?: (exId: string) => void; // 兑换 💎→🧩地支碎片
  onGacha?: (pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond') => GachaResult[] | null; // 抽卡（doc25 §四）→ 结果/null(买不起)
  onCraftTiangang?: (id: string) => boolean | void; // 天罡碎片定向兑换指定天罡（保底）
  onInlay?: (idx: string, branch: string) => boolean | void; // 地支附魔：生肖镶进牌位（≤INLAY_MAX）
  onRemoveInlay?: (idx: string, branch: string) => void; // 卸下某牌位的某生肖
  onSelectDeck?: (id: string) => void; // 选某牌组出战
  onNewDeck?: () => void; // 新建牌组
  onDelDeck?: (id: string) => void; // 删除牌组
  onReset?: () => void;
  onSkin?: (skin: 'onyx' | 'rosy') => void;
  onIntroSeen?: () => void; // 看完开场故事（doc28 §一）→ 标记已看 + 起引导
  onGuideStep?: (n: number) => void; // 新手引导步进（doc28 §二）
  onGuideDone?: () => void; // 完成/跳过引导
  onReplayIntro?: () => void; // 重看开场故事 + 引导
}

export function mountLobby(host: HTMLElement, h: LobbyHandlers): { update: () => void; destroy: () => void } {
  if (!document.getElementById('ggl-css')) { const s = document.createElement('style'); s.id = 'ggl-css'; s.textContent = CSS; document.head.appendChild(s); }
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
  let story: { beats: StoryBeat[]; idx: number; label: string; cta: string; then: 'close' | 'play' | 'guide' } | null = null;
  let guideSkipAsk = false;
  let shopTab: 'gacha' | 'wallet' = 'wallet';
  let gachaReveal: GachaResult[] | null = null;
  let deckPicker = false;
  let craftSel = '';
  const render = (): void => { host.innerHTML = renderLobby({ ...h.getView(), skin }, tab, help, deckTab, earthFilter, collTab, heroSuit, heroDetail, heroRar, ownedOnly, settings, manTier, recharge, rechargeErr, story, guideSkipAsk, shopTab, gachaReveal, deckPicker, craftSel, helpTab); };
  // 每关开局演出（doc27 §五）：战役背景 + Boss 开场白 → 出征。缺 intro 则直接进战斗。
  const levelBeats = (c: StageCampaign): StoryBeat[] => [
    { scene: c.battle, text: c.intro ?? c.oneLiner },
    ...(c.bossLines ? [{ scene: `${c.boss} · 开场`, text: c.bossLines.open }] : []),
  ];
  const startPlay = (): void => { const c = h.getView().campaign; if (c && c.intro) { story = { beats: levelBeats(c), idx: 0, label: `第 ${c.stage} 关 · ${c.battle}`, cta: `出征 · 第 ${c.stage} 关`, then: 'play' }; render(); } else h.onPlay(); };
  const playOpeningStory = (): void => { story = { beats: STORY_OPENING, idx: 0, label: '翻命扑克 · 序章', cta: '执掌命运 →', then: 'guide' }; };
  const finishStory = (): void => { const then = story?.then ?? 'close'; story = null; if (then === 'play') { render(); h.onPlay(); } else if (then === 'guide') { h.onIntroSeen?.(); render(); } else render(); };
  const onClick = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act === 'tab') { tab = k; render(); }
    else if (act === 'deckTab') { deckTab = k === 'gang' ? 'gang' : k === 'dizhi' ? 'dizhi' : 'base'; render(); }
    else if (act === 'earthFilter') { earthFilter = k; render(); }
    else if (act === 'collTab') { collTab = k; render(); }
    else if (act === 'heroSuit') { heroSuit = k; heroDetail = ''; render(); }
    else if (act === 'heroRar') { heroRar = k; heroDetail = ''; render(); }
    else if (act === 'heroDetail') { heroDetail = heroDetail === k ? '' : k; render(); }
    else if (act === 'heroOwned') { ownedOnly = !ownedOnly; render(); }
    else if (act === 'skin') { skin = k === 'rosy' ? 'rosy' : 'onyx'; h.onSkin?.(skin); render(); }
    // 帮助中心（介绍/指导/手册 三合一）：各入口开到对应页
    else if (act === 'intro') { help = true; helpTab = 'intro'; render(); }
    else if (act === 'tut') { help = true; helpTab = 'tut'; render(); }
    else if (act === 'man') { help = true; helpTab = 'manual'; render(); }
    else if (act === 'helpTab') { helpTab = k === 'tut' ? 'tut' : k === 'manual' ? 'manual' : 'intro'; render(); }
    else if (act === 'manTier') { manTier = k as 'easy' | 'mid' | 'hard'; render(); }
    else if (act === 'help-close') { help = false; render(); }
    // 设置
    else if (act === 'settings') { settings = true; render(); }
    else if (act === 'settings-close') { settings = false; render(); }
    else if (act === 'play') { startPlay(); }
    else if (act === 'story-next') { if (!story) return; if (story.idx < story.beats.length - 1) { story.idx++; render(); } else finishStory(); }
    else if (act === 'story-skip') { finishStory(); }
    // 新手引导（doc28 §二）：步进 / 末步开打 / 跳过确认 / 重看
    else if (act === 'guide-next') { h.onGuideStep?.((h.getView().guideStep ?? 0) + 1); render(); }
    else if (act === 'guide-finish') { h.onGuideDone?.(); startPlay(); }
    else if (act === 'guide-skip') { guideSkipAsk = true; render(); }
    else if (act === 'guide-skip-cancel') { guideSkipAsk = false; render(); }
    else if (act === 'guide-skip-confirm') { guideSkipAsk = false; h.onGuideDone?.(); render(); }
    else if (act === 'replayIntro') { h.onReplayIntro?.(); settings = false; tab = 'home'; playOpeningStory(); render(); }
    else if (act === 'buyTiangang') { h.onBuyTiangang?.(k); render(); }
    else if (act === 'buyPlanet') { h.onBuyPlanet?.(k); render(); }
    else if (act === 'buyFoil') { h.onBuyFoil?.(k); render(); }
    else if (act === 'toggleTiangang') { h.onToggleTiangang?.(k); render(); }
    else if (act === 'diamondUnlock') { h.onDiamondUnlock?.(k); render(); }
    else if (act === 'shop') { recharge = true; shopTab = 'gacha'; rechargeErr = ''; render(); }
    else if (act === 'recharge') { recharge = true; shopTab = 'wallet'; rechargeErr = ''; render(); }
    else if (act === 'recharge-close') { recharge = false; rechargeErr = ''; render(); }
    else if (act === 'shopTab') { shopTab = k === 'gacha' ? 'gacha' : 'wallet'; render(); }
    else if (act === 'rechargeBuy') { const pw = (host.querySelector('.rc-pw') as HTMLInputElement | null)?.value ?? ''; const ok = h.onRecharge?.(k, pw); rechargeErr = ok === false ? '密码错误，请重试' : ''; render(); }
    else if (act === 'exchangeBuy') { h.onExchange?.(k); render(); }
    else if (act === 'shardBuy') { h.onBuyShards?.(k); render(); }
    // 抽卡（doc25 §四）：data-k="pool:count:pay" → onGacha → 开包演出；定向兑换 / 关闭演出
    else if (act === 'gacha') { const [pool, cnt, pay] = k.split(':'); const r = h.onGacha?.(pool as 'tiangang' | 'dizhi', cnt === '10' ? 10 : 1, pay === 'diamond' ? 'diamond' : 'gold'); if (r && r.length) gachaReveal = r; render(); }
    else if (act === 'craftTiangang') { const ok = h.onCraftTiangang?.(k); if (ok) { const nm = h.getView().tiangangs.find((t) => t.id === k)?.name ?? k; gachaReveal = [{ kind: 'tiangang', id: k, name: nm, outcome: 'new', detail: '碎片定向兑换 ✓' }]; } render(); }
    else if (act === 'reveal-close') { gachaReveal = null; render(); }
    else if (act === 'selectDeck') { h.onSelectDeck?.(k); render(); }
    else if (act === 'newDeck') { h.onNewDeck?.(); render(); }
    else if (act === 'delDeck') { h.onDelDeck?.(k); render(); }
    // 天罡牌组编辑：主页「编辑牌组」跳牌组屏天罡页 / 空槽弹选卡窗 / 关窗
    else if (act === 'editDeck') { tab = 'decks'; deckTab = 'gang'; render(); }
    else if (act === 'deckAdd') { deckPicker = true; render(); }
    else if (act === 'deckPicker-close') { deckPicker = false; render(); }
    // 地支附魔台：选牌 / 镶入 / 卸下
    else if (act === 'craftSel') { craftSel = craftSel === k ? '' : k; render(); }
    else if (act === 'inlay') { const [idx, br] = k.split(':'); h.onInlay?.(idx, br); render(); }
    else if (act === 'removeInlay') { const [idx, br] = k.split(':'); h.onRemoveInlay?.(idx, br); render(); }
    else if (act === 'reset') { h.onReset?.(); settings = false; render(); }
  };
  host.addEventListener('click', onClick);
  if (h.getView().firstLaunch) playOpeningStory(); // 首启自动播开场故事 → 引导（doc28）
  render();
  return { update: render, destroy: () => { host.removeEventListener('click', onClick); host.replaceChildren(); } };
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Rajdhani:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@500;700;900&family=Zhi+Mang+Xing&family=Ma+Shan+Zheng&display=swap" rel="stylesheet">';

// 离线"看帧" golden：自包含 HTML（CSS + 字体 + 真渲染器输出）。浏览器开 = 真大厅。
export function renderLobbyDoc(view: LobbyView, tab = 'home', collTab = 'cards', deckTab: 'base' | 'gang' | 'dizhi' = 'base', rechargeOpen = false, story: { beats: StoryBeat[]; idx: number; label: string; cta: string } | null = null, guideSkipAsk = false, shopTab: 'gacha' | 'wallet' = 'wallet', gachaReveal: GachaResult[] | null = null, deckPickerOpen = false, craftSel = '', settingsOpen = false): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FONTS}<style>html,body{margin:0;background:#0c0a08}${CSS}</style></head><body>${renderLobby(view, tab, false, deckTab, 'all', collTab, 'all', '', 'all', false, settingsOpen, 'easy', rechargeOpen, '', story, guideSkipAsk, shopTab, gachaReveal, deckPickerOpen, craftSel)}</body></html>`;
}
