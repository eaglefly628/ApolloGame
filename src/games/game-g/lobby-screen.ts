// lobby-screen.ts —— 大厅设计稿「忠实港」（owner 2026-06-18：就是这个老文件 ui = design/UI/Game G 大厅.dc.html）。
// 逐字照搬该稿的招牌视觉：纸框(--paper/--frame-edge) + 顶栏 + 5 屏 IA + **HOME 绿呢牌桌(--felt) + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + 倒角 sheen 大 CTA**
//   + 玄铁(onyx)/锦霞(rosy=brocade)双皮（CSS 变量逐项对齐 .dc.html themes()）。数据接真存档；未接网项诚实占位。
// 纯表现"固定解释器"：只渲染 view + 抛 data-act 回调，零 gameplay 计算。CSS 全 scope 在 .ggl-root 下。

export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number; inDeck?: boolean }
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
  jokers: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
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
  --fd:'Zhi Mang Xing',cursive; --fh:'Rajdhani',sans-serif; --fb:'Noto Sans SC',sans-serif; --fn:'Silkscreen',monospace; }
.ggl-root[data-skin="rosy"]{ --ink:#5a3f44; --ink-dim:#a98b8f; --gold:#cf9a3f; --gold-grad:linear-gradient(180deg,#f3e2a4,#cf9a3f);
  --paper:radial-gradient(120% 120% at 50% -10%,#fdf4ee 0%,#f3e2dc 60%,#ecd6cf 100%);
  --panel:radial-gradient(130% 95% at 22% 10%,rgba(216,170,120,.20),transparent 56%),linear-gradient(165deg,#fffaf3,#f8e7d6);
  --panel-border:#e0c290; --hairline:rgba(207,154,63,.5); --chip:rgba(255,255,255,.55); --track:rgba(150,110,90,.18);
  --frame-edge:#6b4a2e; --felt:radial-gradient(120% 110% at 50% 26%,#c97f86 0%,#b15f6b 46%,#8c4654 100%); --felt-edge:#6e3a44;
  --spade:#4a6390; --heart:#c14b66; --diamond:#b8862f; --club:#2f8f56;
  --chamfer:polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);
  --fd:'Ma Shan Zheng',cursive; --fh:'Cormorant Garamond',serif; --fb:'Noto Serif SC',serif; --fn:'Silkscreen',monospace; }
.ggl-root{ background:#0c0a08; color:var(--ink); font-family:'Noto Sans SC',sans-serif; min-height:100%; padding:22px; display:flex; justify-content:center }
.ggl-root *{ box-sizing:border-box; margin:0 }
.ggl-root button{ font-family:inherit; cursor:pointer } .ggl-root button:disabled{ opacity:.5; cursor:not-allowed }
.ggl-root .ghost{ opacity:.62 }
.ggl-root .frame{ position:relative; width:1340px; max-width:100%; min-height:820px; border-radius:16px; overflow:hidden; background:var(--paper); border:3px solid var(--frame-edge); box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 0 0 1px var(--hairline); display:flex; flex-direction:column }
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
.ggl-root .screen{ display:none } .ggl-root .screen.on{ display:flex }
.ggl-root .homerow{ gap:14px; width:100% } @media(max-width:1000px){ .ggl-root .homerow{ flex-direction:column } }
.ggl-root .herocol{ flex:1; display:flex; flex-direction:column; gap:14px; min-width:0 }
.ggl-root .felt{ position:relative; flex:1; min-height:440px; border-radius:16px; overflow:hidden; background:var(--felt); border:6px solid var(--felt-edge); box-shadow:inset 0 0 0 2px rgba(255,255,255,.08), inset 0 0 120px rgba(0,0,0,.5) }
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
.ggl-root .full{ width:100%; flex-direction:column }
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
.ggl-root .joker-tog{ padding:2px 8px; border-radius:6px; background:var(--chip); border:1px solid var(--panel-border); color:var(--ink-dim); font-size:11px; cursor:pointer }
.ggl-root .joker-tog.active{ background:var(--gold-grad); color:#2a1a08; border:0 }
.ggl-root .jchips{ display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 4px }
.ggl-root .jchip{ display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:8px; background:var(--chip); border:1px solid var(--gold); font-size:12px }
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
    <div class="step"><b>赛前（改造坊）</b>：构筑你的库——标准公平 54 牌 + 小丑/附魔/星球（强弱靠经营、不靠抽强牌）。</div>
    <div class="step"><b>开局</b>：三路预铺基础布局，起手摸手牌，读秒暂停银行满，短带迷雾亮。</div>
    <div class="step"><b>实时博弈</b>：① 看/侦查读三路 ② 田忌断舍·往哪路投牌、弃哪路 ③ 打小丑/功能牌给某路某牌加 buff/干涉。牌慢慢往敌家走=给你思考时间。</div>
    <div class="step"><b>对决核</b>：最前两张相遇 → 战力 P_eff 聚合 → 胜率(如 76:24) → 种子骰 → 正面活·前进 / 反面亡。<b>胜率可见</b>。</div>
    <div class="step"><b>赢条件</b>：幸存者突破到敌大本营 −1 血（共 3 血），<b>先破者胜</b>。</div>
    <div style="text-align:center;margin-top:14px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="tut-close">明白了，开打 →</button></div>
  </div></div>`;
}

// 改造坊小丑货架项（B3）：展示买入 + 选入/踢出战库的双动作。
function craftJokerItem(it: LobbyShopItem, deckFull: boolean): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  const buyAttr = it.buyable && !it.owned ? ` data-act="buyJoker" data-k="${it.id}"` : '';
  let foot: string;
  if (it.owned) {
    const togLabel = it.inDeck ? '⚔ 战库' : (deckFull ? '战库满' : '+ 战库');
    const togCls = 'joker-tog' + (it.inDeck ? ' active' : '');
    const togDis = !it.inDeck && deckFull ? ' disabled' : '';
    foot = `<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><span style="font-size:11px;color:var(--gold)">✓ 已融</span><button class="${togCls}" data-act="toggleJoker" data-k="${it.id}"${togDis}>${togLabel}</button></div>`;
  } else {
    foot = `<div class="cost">🪙 ${it.cost}</div>`;
  }
  return `<div class="${cls}"${buyAttr} title="${esc(it.sub)}"><div class="gnm">🃏 ${esc(it.name)}</div>${foot}</div>`;
}
// 命牌战库预览面板（B3 · DECKS 屏顶部）：≤5 已选小丑 + 流派印记状态。
function deckPreviewPanel(jokers: LobbyShopItem[], archName: string | null | undefined, activated: boolean | undefined): string {
  const inDeck = jokers.filter((j) => j.inDeck);
  const body = inDeck.length
    ? `<div class="jchips">${inDeck.map((j) => `<div class="jchip" title="${esc(j.sub)}">🃏 <b>${esc(j.name)}</b></div>`).join('')}</div>`
    : `<div class="note" style="text-align:left;margin:8px 0">战库空 · 去「改造坊」选入小丑（影响掷命规则·≤5 张）</div>`;
  const arch = archName ? `流派 <b>${esc(archName)}</b>${activated ? '　🔥 招牌已激活' : ''}` : '流派未成型';
  return `<div class="card" style="margin-bottom:14px"><h2>⚔ 命牌战库 <span class="ghost" style="font-size:12px;margin-left:auto">${inDeck.length}/5 · 局内打出生效</span></h2>${body}<div class="note" style="text-align:left;margin-top:4px">${arch}</div></div>`;
}

export function renderLobby(view: LobbyView, tab: string, tutorialOpen: boolean, deckTab: 'base' | 'gang' = 'base', earthFilter = 'all'): string {
  const on = (t: string): string => (tab === t ? ' on' : '');
  const dOn = (t: string): string => (deckTab === t ? ' on' : '');
  const efBtn = (k: string, lbl: string, style: string): string =>
    `<button class="${earthFilter===k?'on':''}" style="${earthFilter===k?style:''}" data-act="earthFilter" data-k="${k}">${lbl}</button>`;
  const stags = SUITS.map(([g, c], i) => `<div class="stag"><span style="color:${c};font-size:14px;text-shadow:0 0 6px ${c}">${g}</span>${['黑桃', '红桃', '方块', '梅花'][i]}</div>`).join('');
  return `<div class="ggl-root" data-skin="${view.skin}"><div class="frame">
  <div class="topbar">
    <div class="seal">♠</div>
    <div class="who"><span class="nm">${esc(view.name)}</span><span class="sub">主牌 · <b>${esc(view.mainCard)}</b></span></div>
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
          <div class="felt-h"><span class="t">命运牌桌</span><span class="s">${esc(view.stageLabel)}</span></div>
          <div class="stags">${stags}</div>
          <div class="duel">
            <div class="dcard" style="border:3px solid var(--spade);transform:rotate(-9deg);--rot:-9deg"><div class="corner" style="color:var(--spade)">A<br>♠</div><div class="big" style="color:var(--spade)">♠</div></div>
            <div class="vs">掷</div>
            <div class="dback"><i></i></div>
          </div>
          <div class="ctawrap">
            <button class="cta-main" data-act="play"><span class="sheen"></span><span class="big">🎲 ⚔ 出征 · ${esc(view.rankText)}</span><span class="sm">DEPLOY · 单人战役 vs AI 庄家</span></button>
            <div class="ctarow"><button class="cta-sub" disabled>好友切磋（占位）</button><button class="cta-sub" disabled>天梯 1V1 DUEL（占位）</button></div>
          </div>
        </div>
        <div class="quick">
          <div class="qcard"><span class="ic">🃏</span><div>出战牌组<br><b>favor 均 ${view.deckAvg} ▸</b></div></div>
          <div class="qcard"><span class="ic">🪙</span><div>材料<br><b>${kfmt(view.coin)}</b></div></div>
          <div class="qcard"><span class="ic">◈</span><div>干预能量<br><b>${view.energy}/${view.energyMax}</b></div></div>
        </div>
        <div class="card" style="line-height:1.7">${view.archLine}<div class="note" style="text-align:left;margin-top:6px">${view.bossLine}</div></div>
      </div>
      <div class="rail"><h2>🪖 牌友 · 命运牌桌</h2>
        <div class="ghost" style="font-size:12px;line-height:1.8">好友切磋 / 天梯 1v1 DUEL 为设计 IA、尚未接入网络（占位）。<br>当前：单人战役 vs AI 庄家·Boss。</div>
        <div class="friend" style="margin-top:10px"><span class="dot"></span> 张飞_关张 <span class="tag">占位</span></div>
        <div class="friend"><span class="dot"></span> 周瑜 <span class="tag">占位</span></div>
        <div class="friend"><span class="dot"></span> 孔明 <span class="tag">占位</span></div></div>
    </section>
    <section class="screen${on('decks')} full">${deckPreviewPanel(view.jokers, view.deckArchName, view.deckArchActivated)}<div class="deck-nav"><button class="${deckTab==='base'?'on':''}" data-act="deckTab" data-k="base">基础牌组</button><button class="${deckTab==='gang'?'on':''}" data-act="deckTab" data-k="gang">天罡战牌</button></div><div class="dsub${dOn('base')}"><div class="card"><h2>📜 基础牌组 · 52 张 <span class="ghost" style="margin-left:auto;font-size:12px">favor 均 ${view.deckAvg} · 最低 ${view.deckMin} / 最高 ${view.deckMax}</span></h2><div>${deckGrid(view.deck, view.foils)}</div><div class="note" style="text-align:left">favor=该牌掷命翻正面(存活)的概率底盘。<b style="color:var(--gold)">金边</b>=强(≥70) / 暗格=弱(≤50)。牌组强度靠<b>小丑/星球/流派</b>提升 → 去「改造坊」经营。</div></div></div><div class="dsub${dOn('gang')}"><div class="card" style="margin-bottom:14px"><h2>⚡ 天罡战牌 <span class="ghost" style="margin-left:auto;font-size:12px">天罡三十六将 · 尚未开放</span></h2><div class="gang-grid"><div class="gang-empty"><span style="font-size:28px;opacity:.5">⚡</span><b>天罡三十六将 · 尚未开放</b><span style="font-size:11px">战役推进后解锁</span></div></div></div><div class="card" style="margin-bottom:14px"><h2>🔥 地煞战牌 <span class="ghost" style="margin-left:auto;font-size:12px">地煞七十二煞 · 尚未开放</span></h2><div class="gang-grid"><div class="gang-empty"><span style="font-size:28px;opacity:.5">🔥</span><b>地煞七十二煞 · 尚未开放</b><span style="font-size:11px">战役推进后解锁</span></div></div></div><div class="card"><h2>🌿 地支灵牌 <span class="ghost" style="margin-left:auto;font-size:12px">12 支脉 · 青铜→蓝→紫→金</span></h2><div class="earth-filter">${efBtn('all','全部','background:var(--gold-grad);color:#2a1a08;border:0')}${efBtn('bronze','青铜','background:#b8732a;color:#fff;border:0')}${efBtn('blue','蓝色','background:#4a9fd5;color:#fff;border:0')}${efBtn('purple','紫色','background:#9b5fc7;color:#fff;border:0')}${efBtn('gold','黄金','background:var(--gold-grad);color:#2a1a08;border:0')}</div><div class="earth-groups">${earthSection(view.earthCards ?? [], earthFilter)}</div></div></div></section>
    <section class="screen${on('coll')} full"><div class="card"><h2>🗃 卡牌收藏 · 小丑 ${view.jokers.filter((j) => j.owned).length}/${view.jokers.length} · 闪艺 ${view.foils.filter((f) => f.owned).length}/${view.foils.length}</h2>
      <div class="note" style="text-align:left;margin-bottom:6px">🃏 小丑牌（改掷命规则=流派身份 · 到改造坊融取）</div>
      <div class="shelf">${view.jokers.map((j) => shopItem('', '🃏', { ...j, buyable: false })).join('')}</div>
      <div class="note" style="text-align:left;margin:12px 0 6px">✨ 闪艺 foil（纯装饰收集 · 点亮可购买）</div>
      <div class="shelf">${view.foils.map((f) => shopItem('buyFoil', '✨', f)).join('')}</div></div></section>
    <section class="screen${on('craft')} full"><div class="forge">
      <div class="card"><h2>⚒ 改造台 · 融小丑（持久牌组身份·公平骨架不泵点数）</h2><div class="fuse"><div class="slot" style="color:var(--club)">♣</div><div class="arrow">→</div><div class="slot" style="color:var(--gold)">🃏</div></div>
        <div class="note" style="text-align:left;margin-bottom:8px">买入后「+ 战库」选入（≤5 张进战库）；战库=流派身份，局内打出生效。</div>
        <div class="shelf">${(() => { const full = view.jokers.filter((j) => j.inDeck).length >= 5; return view.jokers.map((j) => craftJokerItem(j, full)).join(''); })()}</div></div>
      <div class="card"><h2>🪐 星球牌 · 升档（可叠加 · 第二养成轴）</h2><div class="note" style="text-align:left;margin-bottom:8px">改 run 参数（命/能/兵档/牌型）· 持久存档 · 买一级累加</div>
        <div class="shelf">${view.planets.map((p) => shopItem('buyPlanet', '🪐', p)).join('')}</div></div>
    </div><div class="note" style="text-align:left">材料 🪙 ${kfmt(view.coin)} · 融小丑=改掷命规则(流派身份·持久) / 星球=升 run 参数。庄家货架买一张少一张为设计 IA（占位）。</div></section>
    <section class="screen${on('ladder')} full"><div class="ladder-top">${view.ladderLines.map((l) => `<div class="card box">${l}</div>`).join('')}</div>
      <div class="card" style="margin-top:14px"><div class="rankrow"><span class="n">1</span> 不败战神 <span class="lp">2480</span></div><div class="rankrow"><span class="n">2</span> 一掷千金 <span class="lp">2310</span></div><div class="rankrow"><span class="n">…</span> ${esc(view.name)} <span class="lp">${esc(view.rankText)}</span></div></div>
      <div class="note" style="text-align:left">天梯 1v1 / LP / 全服榜为设计 IA、尚未接入网络（占位）。当前=单人战役 vs AI Boss，段位即战役进度。</div></section>
  </div>
  <div class="note" style="margin:0 0 14px">大厅忠实港 · 对照 UI/Game G 大厅.dc.html：纸框 + 顶栏 + 绿呢牌桌(漂浮对决卡/掷 emblem/sheen 出征) + 5 屏 + 玄铁/锦霞双皮 · 真实存档数据 · 未接网项诚实占位</div>
  </div>${tutorialOpen ? tutorialBox() : ''}</div>`;
}

export interface LobbyHandlers {
  getView: () => LobbyView;
  onPlay: () => void;
  onBuyJoker?: (id: string) => void;
  onBuyPlanet?: (id: string) => void;
  onBuyFoil?: (id: string) => void;
  onToggleJoker?: (id: string) => void; // B3: 选入/踢出战库（≤5）
  onReset?: () => void;
  onSkin?: (skin: 'onyx' | 'rosy') => void;
}

export function mountLobby(host: HTMLElement, h: LobbyHandlers): { update: () => void; destroy: () => void } {
  if (!document.getElementById('ggl-css')) { const s = document.createElement('style'); s.id = 'ggl-css'; s.textContent = CSS; document.head.appendChild(s); }
  let tab = 'home';
  let deckTab: 'base' | 'gang' = 'base';
  let earthFilter = 'all';
  let skin: 'onyx' | 'rosy' = h.getView().skin;
  let tut = false;
  const render = (): void => { host.innerHTML = renderLobby({ ...h.getView(), skin }, tab, tut, deckTab, earthFilter); };
  const onClick = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act === 'tab') { tab = k; render(); }
    else if (act === 'deckTab') { deckTab = k === 'gang' ? 'gang' : 'base'; render(); }
    else if (act === 'earthFilter') { earthFilter = k; render(); }
    else if (act === 'skin') { skin = k === 'rosy' ? 'rosy' : 'onyx'; h.onSkin?.(skin); render(); }
    else if (act === 'tut') { tut = true; render(); }
    else if (act === 'tut-close') { tut = false; render(); }
    else if (act === 'play') h.onPlay();
    else if (act === 'buyJoker') { h.onBuyJoker?.(k); render(); }
    else if (act === 'buyPlanet') { h.onBuyPlanet?.(k); render(); }
    else if (act === 'buyFoil') { h.onBuyFoil?.(k); render(); }
    else if (act === 'toggleJoker') { h.onToggleJoker?.(k); render(); }
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
