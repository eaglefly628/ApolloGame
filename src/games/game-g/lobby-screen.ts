// lobby-screen.ts —— 大厅设计稿「忠实港」（owner 2026-06-18：就是这个老文件 ui = design/UI/Game G 大厅.dc.html）。
// 逐字照搬该稿的招牌视觉：纸框(--paper/--frame-edge) + 顶栏 + 5 屏 IA + **HOME 绿呢牌桌(--felt) + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + 倒角 sheen 大 CTA**
//   + 玄铁(onyx)/锦霞(rosy=brocade)双皮（CSS 变量逐项对齐 .dc.html themes()）。数据接真存档；未接网项诚实占位。
// 纯表现"固定解释器"：只渲染 view + 抛 data-act 回调，零 gameplay 计算。CSS 全 scope 在 .ggl-root 下。

import { GI } from './icons.js';
import { HERO_CARDS } from './blueprint.js';

export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number; inDeck?: boolean; power?: number; phat?: number }
export type EarthRarity = 'bronze' | 'blue' | 'purple' | 'gold';
export interface EarthBranchCard {
  id: string; branch: string; name: string; effect: string;
  rarity: EarthRarity; owned: boolean; equipped: boolean;
}
export interface LobbyView {
  skin: 'onyx' | 'rosy';
  coin: number; energy: number; energyMax: number; foilCount: number;
  name: string; mainCard: string; rankText: string;
  stageLabel: string; archLine: string; bossLine: string;
  deckAvg: number; deckMin: number; deckMax: number; deck: number[];
  tiangangs: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
  ladderLines: string[];
  deckArchName?: string | null; deckArchActivated?: boolean;
  earthCards?: EarthBranchCard[];
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
.ggl-root .topbar{ display:flex; align-items:center; gap:14px; padding:14px 24px; background:linear-gradient(180deg,rgba(94,63,38,.16),transparent); border-bottom:1px solid var(--panel-border) }
.ggl-root .seal{ width:44px; height:44px; flex:none; border-radius:10px; background:linear-gradient(150deg,#3a4f78,#28385a); display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; box-shadow:0 0 12px rgba(74,99,144,.5); border:1px solid var(--hairline) }
.ggl-root .who{ display:flex; flex-direction:column; line-height:1.25 } .ggl-root .who .nm{ font-family:var(--fh); font-weight:700; font-size:18px; letter-spacing:.01em } .ggl-root .who .sub{ font-size:11px; color:var(--ink-dim) } .ggl-root .who .sub b{ font-family:var(--fd); color:var(--gold); font-size:14px; font-weight:400 }
.ggl-root .rankb{ display:flex; align-items:center; gap:7px; margin-left:6px; padding:6px 13px; border-radius:99px; background:var(--chip); border:1px solid var(--panel-border); font-family:var(--fh); font-weight:700; font-size:13px }
.ggl-root .rankb .lp{ font-family:var(--fn); font-size:11px; color:var(--gold) }
.ggl-root .seg{ padding:6px 13px; border-radius:9px; background:transparent; border:1px solid var(--panel-border); color:var(--ink-dim); font-size:12px; font-weight:700 } .ggl-root .seg.on{ background:var(--gold-grad); color:#2a1a08; border:0 }
.ggl-root .coin{ display:flex; align-items:center; gap:5px; padding:6px 11px; border-radius:9px; background:var(--chip); border:1px solid var(--panel-border); font-family:var(--fn); font-size:13px }
.ggl-root .icon{ width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-size:15px }
.ggl-root .tutbtn{ padding:0 12px; height:34px; border-radius:9px; background:var(--chip); border:1px solid var(--gold); color:var(--gold); font-size:13px; font-weight:700 }
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
.ggl-root h2{ font-family:var(--fh); font-size:16px; color:var(--gold); margin-bottom:10px; display:flex; align-items:center; gap:8px }
.ggl-root .card{ background:var(--panel); border:1px solid var(--panel-border); border-radius:14px; padding:16px; box-shadow:inset 0 0 0 1px var(--hairline) }
.ggl-root .full{ width:100%; flex-direction:column; overflow-y:auto }
.ggl-root .suit-row{ display:flex; align-items:center; gap:8px; margin:5px 0 }
.ggl-root .suit-hd{ width:22px; flex:none; font-size:18px; font-weight:700; text-align:center; line-height:1 }
.ggl-root .suit-line{ display:flex; flex:1; gap:4px }
.ggl-root .pcard-wrap{ flex:1; min-width:0; perspective:260px; cursor:pointer }
.ggl-root .pcard{ width:100%; aspect-ratio:5/7; border-radius:9px; border:1px solid var(--panel-border); background:var(--chip); font-size:13px; font-weight:700; position:relative; transform-style:preserve-3d; transition:transform .42s cubic-bezier(.4,0,.2,1),box-shadow .18s; will-change:transform; box-shadow:0 4px 10px rgba(0,0,0,.46),0 1px 3px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.10),inset 0 -1px 0 rgba(0,0,0,.18) }
.ggl-root .pcard-wrap:hover>.pcard{ transform:rotateY(180deg); box-shadow:0 9px 26px rgba(0,0,0,.62),0 2px 8px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.12) }
.ggl-root .pcard.leg{ border-color:var(--gold); box-shadow:0 4px 12px rgba(0,0,0,.44),0 0 10px rgba(232,205,130,.18),inset 0 1px 0 rgba(255,255,255,.14) }
.ggl-root .pcard.lock{ opacity:.42 }
.ggl-root .pcard-front,.ggl-root .pcard-back{ position:absolute; inset:0; border-radius:8px; backface-visibility:hidden; -webkit-backface-visibility:hidden }
.ggl-root .pcard-front{ display:flex; flex-direction:column; justify-content:space-between; padding:5px 5px 4px; overflow:hidden; background:linear-gradient(148deg,rgba(255,255,255,.055) 0%,transparent 55%,rgba(0,0,0,.045) 100%) }
.ggl-root .pcard-back{ transform:rotateY(180deg); background:linear-gradient(148deg,#0d1b2c 0%,#14243a 100%); border:1px solid rgba(232,205,138,.2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:4px; color:#e7edf3; text-align:center }
.ggl-root .pcard .r{ font-size:28px; line-height:1; text-shadow:0 1px 4px rgba(0,0,0,.55) }
.ggl-root .pcard .own{ position:absolute; bottom:3px; right:5px; font-size:9px; color:var(--ink-dim) }
.ggl-root .pcard-wm{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; user-select:none }
.ggl-root .pcard-lbl{ font-size:8.5px; font-weight:900; letter-spacing:.04em; line-height:1; text-align:center; text-shadow:0 1px 3px rgba(0,0,0,.7) }
.ggl-root .pcard-portrait{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:.28 }
.ggl-root .pcard-portrait svg{ width:66%; height:66% }
.ggl-root .deck-nav{ display:flex; gap:6px; margin-bottom:14px }
.ggl-root .deck-nav button{ padding:6px 20px; border-radius:8px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-family:var(--fh); font-weight:600; font-size:14px; cursor:pointer }
.ggl-root .deck-nav button.on{ background:var(--gold-grad); color:#2a1a08; border:0 }
.ggl-root .dsub{ display:none; flex-direction:column }
.ggl-root .dsub.on{ display:flex }
.ggl-root .gang-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(78px,1fr)); gap:8px; min-height:240px }
.ggl-root .gang-empty{ grid-column:1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:56px 0; color:var(--ink-dim); font-size:13px; text-align:center }
.ggl-root .earth-filter{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px }
.ggl-root .earth-filter button{ padding:4px 14px; border-radius:6px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-size:12px; cursor:pointer; transition:background .15s }
.ggl-root .earth-groups{ display:flex; flex-direction:column; gap:10px }
.ggl-root .earth-group{ background:rgba(255,255,255,.03); border:1px solid var(--panel-border); border-radius:10px; padding:10px 12px }
.ggl-root .earth-group-hd{ display:flex; align-items:center; gap:8px; margin-bottom:8px }
.ggl-root .earth-branch{ font-family:var(--fh); font-size:22px; font-weight:800; color:var(--gold); width:26px }
.ggl-root .earth-cards{ display:flex; gap:8px; flex-wrap:wrap }
.ggl-root .ecard{ border-radius:8px; padding:8px 10px; background:var(--chip); border:1px solid var(--panel-border); font-size:12px; min-width:84px; position:relative }
.ggl-root .ecard.r-bronze{ border-color:#b8732a }
.ggl-root .ecard.r-blue{ border-color:#4a9fd5 }
.ggl-root .ecard.r-purple{ border-color:#9b5fc7 }
.ggl-root .ecard.r-gold{ border-color:var(--gold); box-shadow:0 0 8px rgba(232,205,130,.18) }
.ggl-root .ecard.unowned{ opacity:.36 }
.ggl-root .ecard.equipped::after{ content:'⚔'; position:absolute; top:3px; right:5px; font-size:10px; color:var(--gold) }
.ggl-root .shelf{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px }
.ggl-root .good{ background:var(--chip); border:1px solid var(--panel-border); border-radius:10px; padding:10px; text-align:center; font-size:12px; position:relative; min-height:74px; clip-path:var(--chamfer) } .ggl-root .good .gnm{ font-weight:700; color:var(--ink); line-height:1.25 } .ggl-root .good .cost{ color:var(--gold); font-weight:700; margin-top:6px; font-family:var(--fn) }
.ggl-root .good.got{ border-color:var(--gold) } .ggl-root .good.buy{ cursor:pointer } .ggl-root .good.buy:hover{ box-shadow:0 0 0 1px var(--gold) inset } .ggl-root .good.lock{ opacity:.5 }
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
.ggl-root .hc2-fig{ font-family:var(--fd); font-size:52px; color:#fff; text-shadow:0 3px 10px rgba(0,0,0,.5); pointer-events:none }
.ggl-root .hc2-corner{ position:absolute; top:5px; left:7px; font-family:var(--fh); font-weight:700; font-size:14px; line-height:.85; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,.4) }
.ggl-root .hc2-gem{ position:absolute; top:6px; right:7px; width:11px; height:11px; border-radius:50%; box-shadow:0 0 8px currentColor }
.ggl-root .hc2-lock{ position:absolute; inset:0; background:rgba(6,9,14,.55); display:flex; align-items:center; justify-content:center; font-size:26px }
.ggl-root .hc2-name{ padding:7px 8px 3px; font-family:var(--fb); font-weight:700; font-size:13px; color:var(--ink); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .hc2-own{ padding:0 8px 8px; font-family:var(--fn); font-size:10px; text-align:center }
.ggl-root .hero-detail-pane{ width:300px; flex:none; padding:22px; border-radius:16px; clip-path:var(--chamfer); background:var(--panel); border:1px solid var(--panel-border); box-shadow:inset 0 0 0 1px var(--hairline); display:flex; flex-direction:column; overflow-y:auto }
.ggl-root .hd2-art{ position:relative; align-self:center; width:184px; height:256px; border-radius:15px; display:flex; align-items:center; justify-content:center; overflow:hidden }
.ggl-root .hd2-fig{ font-family:var(--fd); font-size:108px; color:#fff; text-shadow:0 4px 14px rgba(0,0,0,.5) }
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
const BRANCHES = [
  { b: '子', a: '鼠', t: '隐匿' }, { b: '丑', a: '牛', t: '坚韧' },
  { b: '寅', a: '虎', t: '猛攻' }, { b: '卯', a: '兔', t: '疾速' },
  { b: '辰', a: '龙', t: '威压' }, { b: '巳', a: '蛇', t: '毒创' },
  { b: '午', a: '马', t: '冲锋' }, { b: '未', a: '羊', t: '群势' },
  { b: '申', a: '猴', t: '奇袭' }, { b: '酉', a: '鸡', t: '号令' },
  { b: '戌', a: '狗', t: '守卫' }, { b: '亥', a: '猪', t: '蛮力' },
];
const RARITY_CLR: Record<EarthRarity, string> = { bronze: '#b8732a', blue: '#4a9fd5', purple: '#9b5fc7', gold: '#e8cd82' };
const RARITY_LBL: Record<EarthRarity, string> = { bronze: '青铜', blue: '蓝色', purple: '紫色', gold: '黄金' };

function earthSection(cards: EarthBranchCard[], filter: string): string {
  if (!cards.length) return `<div class="gang-empty"><span style="font-size:28px;opacity:.5">🌿</span><b>地支灵牌 · 尚未开放</b><span style="font-size:11px">战役推进后逐步解锁 · 12 支脉 · 青铜→蓝→紫→金</span></div>`;
  return BRANCHES.map(({ b, a, t }) => {
    const bc = cards.filter(c => c.branch === b);
    const shown = filter === 'all' ? bc : bc.filter(c => c.rarity === filter);
    if (shown.length === 0 && bc.length > 0 && filter !== 'all') return ''; // 当前等级无牌时折叠
    const cs = shown.map(c => {
      const cls = `ecard r-${c.rarity}${c.owned ? '' : ' unowned'}${c.equipped ? ' equipped' : ''}`;
      return `<div class="${cls}" title="${esc(c.effect)}"><div style="font-size:10px;font-weight:700;color:${RARITY_CLR[c.rarity]}">${RARITY_LBL[c.rarity]}</div><div style="font-size:12px;font-weight:700;color:var(--ink);margin:2px 0">${esc(c.name)}</div><div style="font-size:11px;color:var(--ink-dim)">${esc(c.effect)}</div></div>`;
    }).join('');
    return `<div class="earth-group"><div class="earth-group-hd"><span class="earth-branch">${b}</span><span style="font-size:13px;color:var(--ink)">${a}</span><span style="font-size:11px;color:var(--ink-dim)">· ${t}</span><span style="font-size:11px;color:var(--ink-dim);margin-left:auto">${bc.filter(c => c.owned).length}/${bc.length}</span></div>${cs ? `<div class="earth-cards">${cs}</div>` : ''}</div>`;
  }).join('');
}

// 人头牌（A/K/Q/J）中文标签（RANKS 索引 0-3 = A K Q J）
const FACE_LBL = ['尖兵', '王将', '王后', '先锋'];
// 人头牌内联 SVG 人像（currentColor = 花色色；fill 背衬画像；viewBox 0 0 40 56 = 5:7 近似）
const FACE_SVG = [
  // A 尖兵：甲胄兵戎执长矛
  '<svg viewBox="0 0 40 56" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="9" rx="4" ry="5"/><path d="M16 15h8l3 17H13Z"/><rect x="11" y="19" width="4" height="10" rx="2"/><rect x="25" y="19" width="4" height="10" rx="2"/><rect x="14" y="32" width="5" height="14" rx="2"/><rect x="21" y="32" width="5" height="14" rx="2"/><rect x="35" y="3" width="2" height="49" rx="1"/><polygon points="34,3 38,3 36,0"/></svg>',
  // K 王将：冕旒大将宽袍
  '<svg viewBox="0 0 40 56" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="9" r="5"/><path d="M11 4L14 0L17 4L20 1L23 4L26 0L29 4v5H11Z"/><path d="M12 18q-2 8-2 17h20q-2-9-2-17Z"/><rect x="13" y="35" width="6" height="13" rx="2"/><rect x="21" y="35" width="6" height="13" rx="2"/></svg>',
  // Q 王后：凤冠曳裾广袖
  '<svg viewBox="0 0 40 56" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="8" r="5"/><path d="M13 4L16 0L20 3L24 0L27 4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 18Q8 36 10 46h20Q32 36 30 18Q25 14 20 14Q15 14 10 18Z"/></svg>',
  // J 先锋：轻甲突将踏台
  '<svg viewBox="0 0 40 56" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="9" r="5"/><path d="M14 16L12 29h16L26 16Z"/><rect x="9" y="18" width="5" height="9" rx="2"/><rect x="26" y="18" width="5" height="9" rx="2"/><rect x="13" y="29" width="6" height="17" rx="2"/><rect x="21" y="29" width="6" height="17" rx="2"/><path d="M5 46L8 56H32L35 46Z"/></svg>',
];
function deckGrid(deck: number[], foils?: LobbyShopItem[]): string {
  const ownedFoilNames = (foils ?? []).filter(f => f.owned).map(f => f.name);
  const foilBack = ownedFoilNames.length
    ? `<div style="font-size:9px;color:var(--gold)">✨${esc(ownedFoilNames.join('+'))}</div>` : '';
  return SUITS.map(([su, c], si) => {
    const cards = Array.from({ length: 13 }, (_, ri) => {
      const fv = deck[si * 13 + ri] ?? 50;
      const rank = RANKS[ri];
      const isFace = ri <= 3;
      const qual = fv >= 70 ? '强' : fv >= 58 ? '良' : fv <= 50 ? '弱' : '中';
      const qualColor = fv >= 70 ? 'var(--gold)' : fv >= 58 ? 'var(--club)' : fv <= 50 ? 'var(--ink-dim)' : 'var(--ink)';
      const cls = 'pcard' + (fv >= 70 ? ' leg' : '') + (fv <= 50 ? ' lock' : '');
      const faceStyle = isFace ? `border-color:${c}90;` : '';
      const wmSize = isFace ? '36px' : '24px';
      const wmOpacity = isFace ? '.18' : '.08';
      // 正面（front）
      const front = `<div class="pcard-front">` +
        `<div class="pcard-wm" style="color:${c};font-size:${wmSize};opacity:${wmOpacity}">${su}</div>` +
        (isFace ? `<div class="pcard-portrait" style="color:${c}">${FACE_SVG[ri]}</div>` : '') +
        `<div class="r" style="color:${c}">${rank}</div>` +
        (isFace ? `<div class="pcard-lbl" style="color:${c};opacity:.72">${FACE_LBL[ri]}</div>` : '') +
        `<span class="own">${fv}</span>` +
      `</div>`;
      // 背面（back）：翻转后显示的信息面
      const back = `<div class="pcard-back">` +
        `<div style="font-size:13px;font-weight:700;color:${c}">${su}${rank}</div>` +
        (isFace ? `<div style="font-size:9px;font-weight:900;color:${c};opacity:.85">${FACE_LBL[ri]}</div>` : '') +
        `<div style="font-size:9px;color:var(--ink-dim)">favor</div>` +
        `<div style="font-size:13px;font-weight:700;color:${qualColor}">${fv}</div>` +
        `<div style="font-size:9px;color:${qualColor}">${qual}</div>` +
        foilBack +
      `</div>`;
      return `<div class="pcard-wrap" title="${esc(su + rank + ' · favor ' + fv)}">` +
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
function tutorialBox(): string {
  return `<div class="tut-ov" data-act="tut-close"><div class="tut-box" data-stop="1">
    <h3>📖 新手指导 · 一局怎么打</h3>
    <div class="step"><b>赛前（改造坊）</b>：构筑你的库——标准公平 54 牌 + 天罡牌/附魔/地支牌（强弱靠经营、不靠抽强牌）。</div>
    <div class="step"><b>开局</b>：三路预铺基础布局，起手摸手牌，读秒暂停银行满，短带迷雾亮。</div>
    <div class="step"><b>实时博弈</b>：① 看/侦查读三路 ② 田忌断舍·往哪路投牌、弃哪路 ③ 打天罡牌/功能牌给某路某牌加 buff/干涉。牌慢慢往敌家走=给你思考时间。</div>
    <div class="step"><b>对决核</b>：最前两张相遇 → 战力 P_eff 聚合 → 胜率(如 76:24) → 种子骰 → 正面活·前进 / 反面亡。<b>胜率可见</b>。</div>
    <div class="step"><b>赢条件</b>：幸存者突破到敌大本营 −1 血（共 3 血），<b>先破者胜</b>。</div>
    <div style="text-align:center;margin-top:14px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="tut-close">明白了，开打 →</button></div>
  </div></div>`;
}

// 改造坊天罡牌货架项（B3）：买入 + 选入/踢出战库双动作 + 牌力/P̂ 展示。
function craftTiangangItem(it: LobbyShopItem, deckFull: boolean): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  const buyAttr = it.buyable && !it.owned ? ` data-act="buyTiangang" data-k="${it.id}"` : '';
  const stars = it.power ? `<span class="power-stars">${'⭐'.repeat(Math.min(it.power, 5))}</span>` : '';
  const phat = it.phat !== undefined ? `<span class="phat-badge"> P̂${it.phat}</span>` : '';
  let foot: string;
  if (it.owned) {
    const togLabel = it.inDeck ? '⚔ 战库' : (deckFull ? '战库满' : '+ 战库');
    const togCls = 'tiangang-tog' + (it.inDeck ? ' active' : '');
    const togDis = !it.inDeck && deckFull ? ' disabled' : '';
    foot = `<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><span style="font-size:11px;color:var(--gold)">✓ 已解锁</span><button class="${togCls}" data-act="toggleTiangang" data-k="${it.id}"${togDis}>${togLabel}</button></div>`;
  } else {
    foot = `<div class="cost">🪙 ${it.cost}</div>`;
  }
  return `<div class="${cls}"${buyAttr} title="${esc(it.sub)}"><div class="gnm">⚡ ${esc(it.name)}${stars}${phat}</div>${foot}</div>`;
}
// 天罡战库预览面板（B3 · HOME+DECKS 屏）：≤5 已选天罡牌 每张【名 + 效果 + 牌力⭐ + P̂】+ 整库总加成汇总。
function deckPreviewPanel(tiangangs: LobbyShopItem[], archName: string | null | undefined, activated: boolean | undefined): string {
  const inDeck = tiangangs.filter((j) => j.inDeck);
  const totalPhat = inDeck.reduce((s, j) => s + (j.phat ?? 0), 0);
  const hasLeg = inDeck.some((j) => j.power === 5);
  const body = inDeck.length
    ? `<div class="jchips">${inDeck.map((j) => {
        const stars = j.power ? '⭐'.repeat(Math.min(j.power, 5)) : '';
        const phat = j.phat !== undefined ? ` P̂${j.phat}` : '';
        return `<div class="jchip" title="${esc(j.sub)}">⚡ <b>${esc(j.name)}</b><span class="power-stars">${stars}</span><span class="phat-badge">${phat}</span></div>`;
      }).join('')}</div>`
    : `<div class="note" style="text-align:left;margin:8px 0">战库空 · 去「改造坊」选入天罡牌（局内法术·≤5 张）</div>`;
  const arch = archName ? `流派 <b>${esc(archName)}</b>${activated ? '　🔥 招牌已激活' : ''}` : '流派未成型';
  const summary = inDeck.length ? `　整库 P̂ <b style="color:var(--gold)">${totalPhat}</b>${hasLeg ? '　🔥 传说激活' : ''}` : '';
  return `<div class="card" style="margin-bottom:14px"><h2>${GI.bolt} 天罡战库 <span class="ghost" style="font-size:12px;margin-left:auto">${inDeck.length}/5 · 局内打出生效</span></h2>${body}<div class="note" style="text-align:left;margin-top:4px">${arch}${summary}</div></div>`;
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
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px"><div style="width:32px;height:80px;background:var(--track);border-radius:6px;overflow:hidden;position:relative;border:1px solid var(--panel-border)"><div style="position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:${c}99;border-top:2px solid ${c}"></div></div><span style="font-size:18px;color:${c}">${su}</span><span style="font-family:var(--fn);font-size:10px;color:var(--ink-dim)">${avg.toFixed(0)}</span></div>`;
  }).join('');
  const stars = Math.min(4, Math.floor(deckAvg / 16));
  return `<div style="display:flex;align-items:center;gap:18px;padding:10px 0 12px;border-bottom:1px solid var(--panel-border);margin-bottom:10px"><div style="display:flex;gap:10px;align-items:flex-end;height:80px">${bars}</div><div style="display:flex;flex-direction:column;gap:5px"><span style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink)">花色均势</span><span style="font-size:12px;color:var(--ink-dim)">favor 均 <b style="color:var(--gold)">${deckAvg}</b></span><span style="font-size:12px;color:var(--ink-dim)">预估强度 <span style="color:var(--gold)">${'★'.repeat(stars)}${'☆'.repeat(4 - stars)}</span></span><span style="font-size:11px;color:var(--ink-dim)">公平骨架 52 张</span></div></div>`;
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
      return `<div class="hcard2${isSel?' sel':''}${locked?' locked':''}" data-act="heroDetail" data-k="${h.id}"><div class="hc2-portrait" style="background:linear-gradient(165deg,${sc}33,${sc}11),radial-gradient(circle at 50% 36%,${sc}55,transparent 62%);border-bottom:2px solid ${rc}"><div class="hc2-corner" style="color:${sc}">${h.rank}<br>${h.suit}</div><div class="hc2-fig">${esc(h.name[0])}</div><div class="hc2-gem" style="background:${rc};color:${rc}"></div>${locked?'<div class="hc2-lock">🔒</div>':''}</div><div class="hc2-name">${esc(h.name)}</div><div class="hc2-own" style="color:${locked?'var(--ink-dim)':rc}">${locked?'未拥有':'×'+h.own}</div></div>`;
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
    detailPane = `<div class="hero-detail-pane" style="overflow-y:auto"><div class="hd2-art" style="background:linear-gradient(165deg,${sc}44,${sc}14),radial-gradient(circle at 50% 34%,${sc}66,transparent 60%);border:4px solid ${rarColor};box-shadow:0 0 26px ${rarColor}55,inset 0 0 0 2px rgba(255,255,255,.5)"><div class="hd2-corner" style="top:10px;left:12px;color:${sc}">${selCard.rank}<br>${selCard.suit}</div><div class="hd2-fig">${esc(selCard.name[0])}</div><div class="hd2-corner" style="bottom:10px;right:12px;transform:rotate(180deg);color:${sc}">${selCard.rank}<br>${selCard.suit}</div></div><div style="display:flex;align-items:baseline;gap:10px;margin-top:14px"><div style="font-family:var(--fd);font-size:30px;color:var(--ink);line-height:1">${esc(selCard.name)}</div><span style="display:inline-block;padding:3px 10px;background:#9b2d22;color:#f5e6c8;border-radius:4px;font-family:var(--fh);font-weight:700;font-size:13px;box-shadow:0 1px 4px rgba(155,45,34,.5)">${esc(selCard.title)}</span></div><div style="font-size:12px;color:var(--ink-dim);margin-top:5px">${esc(selCard.era)} · 贡献度 第 ${selCard.contribRank} 位</div><div class="hd2-chips"><span class="hd2-chip" style="background:${rarColor}22;color:${rarColor};border:1px solid ${rarColor}66">${rarName}</span><span class="hd2-chip" style="background:${sc}22;color:${sc};border:1px solid ${sc}66">${selCard.suit} ${SUIT_N[selCard.suit] ?? ''}</span><span class="hd2-chip" style="background:var(--chip);color:var(--ink-dim);border:1px solid var(--panel-border)">军衔 ${selCard.rank}</span></div>${scroll('诅咒 · 序', curse)}${scroll('列传 · 生平', bio)}${battle}${quote}${origin}${scroll('战绩 · 成长弧', '<span class="ghost">尚未立功 · 杀敌 → 称号 → 数值后定（公平骨架：英雄层不进对战强度）</span>')}<div style="display:flex;gap:9px;margin-top:16px"><button style="flex:1;padding:11px;border-radius:11px;cursor:pointer;background:var(--chip);border:1px solid var(--panel-border);color:var(--ink);font-family:var(--fh);font-weight:700;font-size:14px">改造</button><button style="flex:2;padding:11px;border-radius:11px;clip-path:var(--chamfer);cursor:pointer;border:none;background:var(--gold-grad);color:#2a1a08;font-family:var(--fh);font-weight:700;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)">加入牌组</button></div></div>`;
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

export function renderLobby(view: LobbyView, tab: string, tutorialOpen: boolean, deckTab: 'base' | 'gang' = 'base', earthFilter = 'all', collTab = 'cards', heroSuit = 'all', heroDetail = '', heroRar = 'all', ownedOnly = false): string {
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
    <button class="seg ${view.skin === 'onyx' ? 'on' : ''}" data-act="skin" data-k="onyx">玄铁</button>
    <button class="seg ${view.skin === 'rosy' ? 'on' : ''}" data-act="skin" data-k="rosy">锦霞</button>
    <div class="coin"><span>🪙</span><b>${kfmt(view.coin)}</b></div>
    <div class="coin"><span>◈</span><span style="color:var(--gold)">${view.energy}/${view.energyMax}</span></div>
    <div class="coin"><span>✨</span><span style="color:#7fb0d8">${view.foilCount}</span></div>
    <button class="tutbtn" data-act="tut">📖 新手指导</button>
    <button class="icon" data-act="reset" title="重置进度">⚙</button>
  </div>
  <div class="nav">
    <button class="${on('home')}" data-act="tab" data-k="home">大厅</button>
    <button class="${on('decks')}" data-act="tab" data-k="decks">牌组</button>
    <button class="${on('coll')}" data-act="tab" data-k="coll">收藏</button>
    <button class="${on('craft')}" data-act="tab" data-k="craft">改造坊</button>
    <button class="${on('ladder')}" data-act="tab" data-k="ladder">天梯</button>
  </div>
  <div class="content">
    <section class="screen${on('home')} homerow">
      <div class="herocol">
        <div class="felt">
          <div class="vignette"></div>
          <div class="felt-h"><span class="t">戏牌师</span><span class="s">${esc(view.stageLabel)}</span></div>
          <div class="stags">${stags}</div>
          <div class="duel">
            <div class="dcard" style="border:3px solid var(--spade);transform:rotate(-9deg);--rot:-9deg"><div class="corner" style="color:var(--spade)">A<br>♠</div><div class="big" style="color:var(--spade)">♠</div></div>
            <div class="vs">掷</div>
            <div class="dback"><i></i></div>
          </div>
          <div class="ctawrap">
            <button class="cta-main" data-act="play"><span class="sheen"></span><span class="big">${GI.swords} 出征 · ${esc(view.rankText)}</span><span class="sm">DEPLOY · 单人战役 vs AI 庄家</span></button>
            <div class="ctarow"><button class="cta-sub" disabled>好友切磋（占位）</button><button class="cta-sub" disabled>天梯 1V1 DUEL（占位）</button></div>
          </div>
        </div>
        ${deckPreviewPanel(view.tiangangs, view.deckArchName, view.deckArchActivated)}
      </div>
      <div class="rail"><h2>🪖 牌友 · 戏牌师</h2>
        <div class="ghost" style="font-size:12px;line-height:1.8">好友切磋 / 天梯 1v1 DUEL 为设计 IA、尚未接入网络（占位）。<br>当前：单人战役 vs AI 庄家·Boss。</div>
        <div class="friend" style="margin-top:10px"><span class="dot"></span> 张飞_关张 <span class="tag">占位</span></div>
        <div class="friend"><span class="dot"></span> 周瑜 <span class="tag">占位</span></div>
        <div class="friend"><span class="dot"></span> 孔明 <span class="tag">占位</span></div></div>
    </section>
    <section class="screen${on('decks')} full">${deckPreviewPanel(view.tiangangs, view.deckArchName, view.deckArchActivated)}<div class="deck-nav"><button class="${deckTab==='base'?'on':''}" data-act="deckTab" data-k="base">扑克牌组</button><button class="${deckTab==='gang'?'on':''}" data-act="deckTab" data-k="gang">天罡战牌</button></div><div class="dsub${dOn('base')}"><div class="card"><h2>📜 扑克牌组 · 52 张 <span class="ghost" style="margin-left:auto;font-size:12px">favor 均 ${view.deckAvg} · 最低 ${view.deckMin} / 最高 ${view.deckMax}</span></h2>${suitBarsPanel(view.deck, view.deckAvg)}<div>${deckGrid(view.deck, view.foils)}</div><div class="note" style="text-align:left">favor=该牌掷命翻正面(存活)的概率底盘。<b style="color:var(--gold)">金边</b>=强(≥70) / 暗格=弱(≤50)。牌组强度靠<b>天罡牌/地支牌/流派</b>提升 → 去「改造坊」经营。</div></div></div><div class="dsub${dOn('gang')}"><div class="card" style="margin-bottom:14px"><h2>${GI.bolt} 天罡战牌 <span class="ghost" style="margin-left:auto;font-size:12px">三十六天罡 · 一期 20 张已上架</span></h2><div class="gang-grid"><div class="gang-empty"><span style="font-size:28px;opacity:.5">⚡</span><b>天罡战牌 · 去改造坊选入战库</b><span style="font-size:11px">改造坊买入 → 选 ≤5 入战库 → 局内打出生效</span></div></div></div><div class="card"><h2>${GI.planet} 地支牌 <span class="ghost" style="margin-left:auto;font-size:12px">12 支脉 · 青铜→蓝→紫→金</span></h2><div class="earth-filter">${efBtn('all','全部','background:var(--gold-grad);color:#2a1a08;border:0')}${efBtn('bronze','青铜','background:#b8732a;color:#fff;border:0')}${efBtn('blue','蓝色','background:#4a9fd5;color:#fff;border:0')}${efBtn('purple','紫色','background:#9b5fc7;color:#fff;border:0')}${efBtn('gold','黄金','background:var(--gold-grad);color:#2a1a08;border:0')}</div><div class="earth-groups">${earthSection(view.earthCards ?? [], earthFilter)}</div></div></div></section>
    <section class="screen${on('coll')} full" style="flex-direction:column"><div class="deck-nav"><button class="${collTab==='cards'?'on':''}" data-act="collTab" data-k="cards">收藏·牌谱</button><button class="${collTab==='ladder'?'on':''}" data-act="collTab" data-k="ladder">天梯·榜</button><button class="${collTab==='collect'?'on':''}" data-act="collTab" data-k="collect">天罡&amp;闪艺</button></div><div class="dsub${cOn('cards')}" style="flex:1;min-height:0;flex-direction:column">${heroCollSection(heroSuit, heroRar, heroDetail, ownedOnly)}</div><div class="dsub${cOn('ladder')}" style="flex:1;min-height:0;flex-direction:column">${ladderSection(view.name, view.rankText)}</div><div class="dsub${cOn('collect')}"><div class="card"><h2>🗃 天罡牌 · 收藏 ${view.tiangangs.filter((j) => j.owned).length}/${view.tiangangs.length}</h2><div class="note" style="text-align:left;margin-bottom:6px">⚡ 已解锁天罡牌（到改造坊选入战库 ≤5 张）</div><div class="shelf">${view.tiangangs.map((j) => shopItem('', '⚡', { ...j, buyable: false })).join('')}</div><div class="note" style="text-align:left;margin:12px 0 6px">✨ 闪艺 foil（纯装饰收集 · 点亮可购买）· ${view.foils.filter((f) => f.owned).length}/${view.foils.length}</div><div class="shelf">${view.foils.map((f) => shopItem('buyFoil', '✨', f)).join('')}</div></div></div></section>
    <section class="screen${on('craft')} full"><div class="craft-zones">
      <div class="card"><h2>♠ 扑克牌组 <span class="ghost" style="margin-left:auto;font-size:12px">52 张 · 公平骨架 · 上场打三路</span></h2>
        <div class="deck-sumbar"><span>favor 均 <b>${view.deckAvg}</b></span><span>最低 <b>${view.deckMin}</b></span><span>最高 <b>${view.deckMax}</b></span></div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0 8px;border-bottom:1px solid var(--panel-border);margin-bottom:8px"><div style="width:62px;height:88px;border-radius:9px;background:var(--chip);border:1px solid var(--panel-border);display:flex;flex-direction:column;justify-content:space-between;padding:5px 6px;flex:none"><span style="color:var(--spade);font-family:var(--fh);font-weight:700;font-size:14px;line-height:.9">7<br>♠</span><span style="color:var(--spade);font-size:32px;line-height:1;text-align:right">♠</span></div><div style="display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--gold)"><span style="font-size:22px">→</span><span style="font-family:var(--fn);font-size:9px;letter-spacing:.06em">CRAFT</span></div><div style="width:62px;height:88px;border-radius:9px;background:var(--chip);border:2px solid var(--gold);display:flex;flex-direction:column;justify-content:space-between;padding:5px 6px;position:relative;flex:none;box-shadow:0 0 10px rgba(232,205,130,.15)"><span style="color:var(--spade);font-family:var(--fh);font-weight:700;font-size:14px;line-height:.9">7<br>♠</span><span style="color:var(--spade);font-size:32px;line-height:1;text-align:right">♠</span><div style="position:absolute;bottom:-8px;right:5px;background:var(--gold);color:#2a1a08;font-family:var(--fn);font-size:8px;padding:2px 5px;border-radius:99px;font-weight:700">重翻</div></div><div style="display:flex;flex-direction:column;gap:5px"><span style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink)">改造台 · 卡牌改造</span><span style="font-size:12px;color:var(--ink-dim)">选一张扑克 → 镶 gem（重翻/镶字/配重）</span><div style="display:flex;gap:8px;margin-top:4px"><button class="btn ghost" style="font-size:12px;padding:7px 12px" data-act="tab" data-k="decks">选牌 →</button></div></div></div>
        <div class="note" style="text-align:left">扑克牌组 = 标准 52 张公平骨架；强度靠天罡/地支经营、不泵点数。<button class="btn ghost" style="margin-left:8px" data-act="tab" data-k="decks">查看牌组 →</button></div></div>
      <div class="forge">
        <div class="card"><h2>${GI.crafting} 改造台 · 天罡牌组（≤5 入战库·局内法术）</h2><div class="fuse"><div class="slot" style="color:var(--gold)">⚡</div><div class="arrow">→</div><div class="slot" style="color:var(--gold)">⚔</div></div>
          <div class="note" style="text-align:left;margin-bottom:8px">买入后「+ 战库」选入（≤5 张进战库）；战库=流派身份·法术牌，局内打出生效。</div>
          <div class="shelf">${(() => { const full = view.tiangangs.filter((j) => j.inDeck).length >= 5; return view.tiangangs.map((j) => craftTiangangItem(j, full)).join(''); })()}</div></div>
        <div class="card"><h2>${GI.planet} 地支牌 · 升档（可叠加 · 第二养成轴）</h2><div class="note" style="text-align:left;margin-bottom:8px">升档改 run 参数（命/能/兵档/牌型）· 持久存档 · 买一级累加</div>
          <div class="shelf">${view.planets.map((p) => shopItem('buyPlanet', '🪐', p)).join('')}</div></div>
      </div>
    </div></section>
    <section class="screen${on('ladder')} full">${ladderSection(view.name, view.rankText)}</section>
  </div>
  </div>${tutorialOpen ? tutorialBox() : ''}</div>`;
}

export interface LobbyHandlers {
  getView: () => LobbyView;
  onPlay: () => void;
  onBuyTiangang?: (id: string) => void;
  onBuyPlanet?: (id: string) => void;
  onBuyFoil?: (id: string) => void;
  onToggleTiangang?: (id: string) => void; // B3: 选入/踢出战库（≤5）
  onReset?: () => void;
  onSkin?: (skin: 'onyx' | 'rosy') => void;
}

export function mountLobby(host: HTMLElement, h: LobbyHandlers): { update: () => void; destroy: () => void } {
  if (!document.getElementById('ggl-css')) { const s = document.createElement('style'); s.id = 'ggl-css'; s.textContent = CSS; document.head.appendChild(s); }
  let tab = 'home';
  let deckTab: 'base' | 'gang' = 'base';
  let earthFilter = 'all';
  let collTab = 'cards';
  let heroSuit = 'all';
  let heroDetail = '';
  let heroRar = 'all';
  let ownedOnly = false;
  let skin: 'onyx' | 'rosy' = h.getView().skin;
  let tut = false;
  const render = (): void => { host.innerHTML = renderLobby({ ...h.getView(), skin }, tab, tut, deckTab, earthFilter, collTab, heroSuit, heroDetail, heroRar, ownedOnly); };
  const onClick = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act === 'tab') { tab = k; render(); }
    else if (act === 'deckTab') { deckTab = k === 'gang' ? 'gang' : 'base'; render(); }
    else if (act === 'earthFilter') { earthFilter = k; render(); }
    else if (act === 'collTab') { collTab = k; render(); }
    else if (act === 'heroSuit') { heroSuit = k; heroDetail = ''; render(); }
    else if (act === 'heroRar') { heroRar = k; heroDetail = ''; render(); }
    else if (act === 'heroDetail') { heroDetail = heroDetail === k ? '' : k; render(); }
    else if (act === 'heroOwned') { ownedOnly = !ownedOnly; render(); }
    else if (act === 'skin') { skin = k === 'rosy' ? 'rosy' : 'onyx'; h.onSkin?.(skin); render(); }
    else if (act === 'tut') { tut = true; render(); }
    else if (act === 'tut-close') { tut = false; render(); }
    else if (act === 'play') h.onPlay();
    else if (act === 'buyTiangang') { h.onBuyTiangang?.(k); render(); }
    else if (act === 'buyPlanet') { h.onBuyPlanet?.(k); render(); }
    else if (act === 'buyFoil') { h.onBuyFoil?.(k); render(); }
    else if (act === 'toggleTiangang') { h.onToggleTiangang?.(k); render(); }
    else if (act === 'reset') { h.onReset?.(); render(); }
  };
  host.addEventListener('click', onClick);
  render();
  return { update: render, destroy: () => { host.removeEventListener('click', onClick); host.replaceChildren(); } };
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Rajdhani:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@500;700;900&family=Zhi+Mang+Xing&family=Ma+Shan+Zheng&display=swap" rel="stylesheet">';

// 离线"看帧" golden：自包含 HTML（CSS + 字体 + 真渲染器输出）。浏览器开 = 真大厅。
export function renderLobbyDoc(view: LobbyView, tab = 'home'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FONTS}<style>html,body{margin:0;background:#0c0a08}${CSS}</style></head><body>${renderLobby(view, tab, false)}</body></html>`;
}
