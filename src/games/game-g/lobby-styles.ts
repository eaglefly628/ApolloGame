// Game G · 大厅 CSS（双皮变量 + 招牌类·拆分自 lobby-screen.ts·纯样式字符串·零依赖）。
export const LOBBY_CSS = `
@keyframes ggl-sheen { 0% { background-position:-130% 0 } 100% { background-position:230% 0 } }
@keyframes ggl-float { 0%,100% { transform:translateY(0) rotate(var(--rot,0deg)) } 50% { transform:translateY(-12px) rotate(var(--rot,0deg)) } }
@keyframes ggl-pulse { 0%,100% { opacity:.45 } 50% { opacity:1 } }
.ggl-root[data-skin="onyx"]{ --ink:#e7edf3; --ink-dim:#7e8c9b; --gold:#e8cd82; --gold-grad:linear-gradient(180deg,#f5e6ad,#c69a44);
  --paper:radial-gradient(120% 120% at 50% -8%,#1d2d42 0%,#0f1b29 55%,#070e17 100%);
  --panel:radial-gradient(130% 95% at 22% 10%,rgba(82,120,158,.30),transparent 56%),linear-gradient(165deg,#1a2a3c,#0f1c2a);
  --panel-border:#3a516e; --hairline:rgba(232,205,138,.24); --chip:rgba(255,255,255,.05); --track:rgba(0,0,0,.5);
  --frame-edge:#2a3a4e; --felt:radial-gradient(120% 110% at 50% 26%,#3a6b5b 0%,#274e43 46%,#15302a 100%); --felt-edge:#1a3a2e;
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
.ggl-root{ background:#0c0a08; color:var(--ink); font-family:'Noto Sans SC',sans-serif; height:100vh; box-sizing:border-box; padding:12px; overflow:hidden; display:flex; justify-content:center; user-select:none; -webkit-user-select:none; cursor:default }
.ggl-root button,.ggl-root [data-act]{ cursor:pointer }
.ggl-root input,.ggl-root textarea{ user-select:text; -webkit-user-select:text; cursor:text }
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
.ggl-root .disha-num{ display:block; margin-top:3px; font-size:11px; font-weight:700; color:#e6b96a; line-height:1.5 }
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
.ggl-root .vs-btn{ cursor:pointer; padding:0; transition:transform .12s } .ggl-root .vs-btn:hover{ transform:scale(1.08) } .ggl-root .vs-btn:active{ transform:scale(.94) }
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
/* 翻牌：绕竖轴 scaleX 横向翻转（背面正向缩放·文字永不镜像）。前面翻没→背面翻出。 */
.ggl-root .pcard-front,.ggl-root .pcard-back{ position:absolute; inset:0; border-radius:8px; transition:transform .3s cubic-bezier(.4,0,.2,1); transform-origin:50% 50%; backface-visibility:hidden }
.ggl-root .pcard-front{ display:flex; flex-direction:column; justify-content:space-between; padding:5px 5px 4px; overflow:hidden; background:linear-gradient(148deg,rgba(255,255,255,.055) 0%,transparent 55%,rgba(0,0,0,.045) 100%); transform:scaleX(1) }
.ggl-root .pcard-back{ transform:scaleX(0); background:linear-gradient(148deg,#0d1b2c 0%,#14243a 100%); border:1px solid rgba(232,205,138,.2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:4px; color:#e7edf3; text-align:center }
.ggl-root .pcard-wrap:hover .pcard-front{ transform:scaleX(0) }
.ggl-root .pcard-wrap:hover .pcard-back{ transform:scaleX(1) }
.ggl-root .pcard .r{ position:relative; z-index:1; font-size:22px; line-height:1; text-shadow:0 1px 4px rgba(0,0,0,.6) }
.ggl-root .pcard .own{ position:absolute; bottom:3px; right:5px; font-size:9px; color:var(--ink-dim) }
.ggl-root .pcard-wm{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; user-select:none }
.ggl-root .pcard-lbl{ position:relative; z-index:1; max-width:100%; font-size:8.5px; font-weight:900; letter-spacing:.02em; line-height:1; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 1px; text-shadow:0 1px 3px rgba(0,0,0,.8) }
.ggl-root .pcard-portrait{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:.26 }
.ggl-root .pcard-bk-nm{ font-size:9px; font-weight:900; color:#e7edf3; line-height:1.05; text-align:center; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .pcard-bk-tt{ font-size:7.5px; color:#9fb0c0; line-height:1; text-align:center; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ggl-root .pcard-portrait svg{ width:66%; height:66% }
/* 构筑选牌（乙1）：选中态金描边 + ✓ 角标 + 费用角标 */
.ggl-root .pcard.picked{ border-color:var(--gold); box-shadow:0 0 0 2px var(--gold),0 4px 14px rgba(232,205,130,.4) }
.ggl-root .pcard-cost{ position:absolute; top:3px; left:4px; z-index:2; height:13px; padding:0 3px; border-radius:5px; background:rgba(10,14,22,.82); color:#cfe0f3; font-size:8px; font-weight:800; line-height:13px; text-align:center; letter-spacing:-1px; white-space:nowrap } /* 放牌费用=小水滴(owner 2026-06-21) */
.ggl-root .pcard-pick{ position:absolute; top:2px; right:3px; z-index:3; width:15px; height:15px; border-radius:50%; background:var(--gold-grad); color:#2a1a08; font-size:11px; font-weight:900; line-height:15px; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,.5) }
.ggl-root .pcard:not(.picked) .pcard-pick{ display:none } /* ✓ 常驻·未选隐藏（定点切 .picked 类·不重建格） */
.ggl-root .pcard-ench{ position:absolute; bottom:3px; left:3px; z-index:4; min-width:15px; height:15px; padding:0 3px; border-radius:8px; background:rgba(12,16,24,.78); border:1px solid var(--hairline); color:var(--ink-dim); font-size:9px; font-weight:800; line-height:14px; text-align:center; cursor:pointer; transition:transform .12s,border-color .12s } /* 牌库内附魔徽标（owner 2026-06-21·E·挪左下避开左上费用水滴）*/
.ggl-root .pcard-ench:hover{ transform:scale(1.18); border-color:var(--gold) }
.ggl-root .pcard-ench.on{ background:var(--gold-grad); color:#2a1a08; border-color:var(--gold) }
.ggl-root .pbuild-grid.full .pcard-wrap:not(.is-picked) .pcard{ opacity:.42 } /* 满 16 → 未选置灰（容器类·无逐卡 DOM 改） */
.ggl-root .build-row{ display:flex; gap:14px; align-items:stretch; margin:10px 0 12px }
.ggl-root .cost-curve{ display:flex; gap:8px; align-items:flex-end; flex:none; height:78px; padding:8px 12px; border-radius:11px; background:var(--chip); border:1px solid var(--panel-border) }
.ggl-root .cc-col{ display:flex; flex-direction:column; align-items:center; justify-content:flex-end; width:34px; height:100% }
.ggl-root .cc-bar{ width:18px; min-height:3px; border-radius:4px 4px 0 0; transition:height .2s }
.ggl-root .cc-n{ font-size:11px; font-weight:800; color:var(--ink); margin-top:2px }
.ggl-root .cc-l{ font-size:8.5px; color:var(--ink-dim); white-space:nowrap }
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
.ggl-root .dz-inv{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; padding:9px 12px; margin-bottom:12px; border-radius:10px; background:rgba(232,205,130,.06); border:1px solid var(--panel-border); font-size:12px; color:var(--ink-dim) }
.ggl-root .dz-inv-chip{ font-size:12px; font-weight:700; padding:3px 9px; border-radius:99px; background:var(--chip); border:1px solid }
.ggl-root .zo-slots{ display:flex; align-items:center; gap:8px; margin-top:8px }
.ggl-root .zo-slot{ min-width:64px; height:40px; border-radius:9px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; font-size:11px }
.ggl-root .zo-slot.have{ background:rgba(232,205,130,.08); border:1px solid }
.ggl-root .zo-slot.empty{ border:1px dashed var(--panel-border); color:var(--ink-dim); font-size:14px }
.ggl-root .zo-slot-t{ font-size:9px; font-weight:700 }
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
.ggl-root .gg-tipwrap{ position:relative }
.ggl-root .gg-tip{ position:absolute; left:50%; top:calc(100% + 8px); transform:translateX(-50%) translateY(-4px); width:240px; max-width:86vw; padding:11px 13px; border-radius:10px; background:linear-gradient(160deg,#1b2233,#10141d); border:1px solid var(--gold); box-shadow:0 14px 34px rgba(0,0,0,.65); opacity:0; pointer-events:none; transition:opacity .12s,transform .12s; z-index:200; text-align:left }
.ggl-root .gg-tipwrap:hover>.gg-tip{ opacity:1; transform:translateX(-50%) translateY(0) }
.ggl-root .gg-tip h4{ font-family:var(--fh); font-weight:700; font-size:15px; margin:0 0 6px; padding-bottom:6px; border-bottom:1px solid rgba(232,205,130,.25) }
.ggl-root .gg-tip-eff{ font-size:12px; color:#cdd6e2; line-height:1.65; margin-bottom:8px }
.ggl-root .gg-tip-row{ display:flex; justify-content:space-between; gap:10px; font-size:12px; color:var(--ink-dim); padding:1px 0 }
/* 浮层左右弹（owner 2026-06-21·别弹出屏幕外）：tip-left=贴右缘向左展开(右侧栏用·不溢出右屏)；tip-right=贴左缘向右展开(最左侧用)。 */
.ggl-root .gg-tipwrap.tip-left>.gg-tip{ left:auto; right:0; transform:translateX(0) translateY(-4px) }
.ggl-root .gg-tipwrap.tip-left:hover>.gg-tip{ transform:translateX(0) translateY(0) }
.ggl-root .gg-tipwrap.tip-right>.gg-tip{ left:0; right:auto; transform:translateX(0) translateY(-4px) }
.ggl-root .gg-tipwrap.tip-right:hover>.gg-tip{ transform:translateX(0) translateY(0) }
.ggl-root .good.got{ border-color:var(--gold) } .ggl-root .good.buy{ cursor:pointer } .ggl-root .good.buy:hover{ box-shadow:0 0 0 1px var(--gold) inset } .ggl-root .good.lock{ opacity:.62 }
.ggl-root .unlock-badge{ display:inline-block; font-size:9px; font-weight:700; padding:1px 5px; border-radius:5px; background:rgba(232,205,138,.16); border:1px solid var(--hairline); color:var(--gold); vertical-align:middle }
.ggl-root .boss-block{ margin-bottom:14px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid var(--panel-border) }
.ggl-root .boss-block.locked{ opacity:.5 }
.ggl-root .fiend-stage{ font-family:var(--fh); font-weight:700; font-size:11px; color:#2a1a08; background:var(--gold-grad); padding:2px 8px; border-radius:99px }
.ggl-root .fiend-stage.lk{ background:var(--chip); color:var(--ink-dim); border:1px solid var(--panel-border) }
.ggl-root .boss-hd{ display:flex; align-items:center; gap:10px; margin-bottom:8px } .ggl-root .boss-name{ font-family:var(--fd); font-size:19px; color:var(--gold) }
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
@keyframes gg-coach-ring { 0%,100%{ box-shadow:0 0 0 3px var(--gold),0 0 16px 3px rgba(232,205,130,.55) } 50%{ box-shadow:0 0 0 4px var(--gold),0 0 28px 7px rgba(232,205,130,.9) } }
@keyframes gg-coach-arrow { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-5px) } }
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
.ggl-root .hcard2.locked .hc2-fig{ filter:blur(7px) saturate(.4); opacity:.7 }
.ggl-root .hd2-art.locked .hd2-fig{ filter:blur(11px) saturate(.4); opacity:.7 }
.ggl-root .hd2-art.locked::after{ content:'🔒 未解锁'; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(6,9,14,.5); font-family:var(--fh); font-weight:700; color:#cdd6e2; font-size:18px }
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
