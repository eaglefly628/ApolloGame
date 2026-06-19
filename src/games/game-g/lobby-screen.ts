// lobby-screen.ts —— 大厅设计稿「忠实港」（owner 2026-06-18：就是这个老文件 ui = design/UI/Game G 大厅.dc.html）。
// 逐字照搬该稿的招牌视觉：纸框(--paper/--frame-edge) + 顶栏 + 5 屏 IA + **HOME 绿呢牌桌(--felt) + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + 倒角 sheen 大 CTA**
//   + 玄铁(onyx)/锦霞(rosy=brocade)双皮（CSS 变量逐项对齐 .dc.html themes()）。数据接真存档；未接网项诚实占位。
// 纯表现"固定解释器"：只渲染 view + 抛 data-act 回调，零 gameplay 计算。CSS 全 scope 在 .ggl-root 下。

export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number }
export interface LobbyView {
  skin: 'onyx' | 'rosy';
  coin: number; energy: number; energyMax: number; foilCount: number;
  name: string; mainCard: string; rankText: string;
  stageLabel: string; archLine: string; bossLine: string;
  deckAvg: number; deckMin: number; deckMax: number; deck: number[];
  jokers: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
  ladderLines: string[];
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
.ggl-root .homerow{ display:flex; gap:14px; width:100% } @media(max-width:1000px){ .ggl-root .homerow{ flex-direction:column } }
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
.ggl-root .colgrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(64px,1fr)); gap:8px; margin:8px 0 }
.ggl-root .pcard{ aspect-ratio:5/7; border-radius:9px; border:1px solid var(--panel-border); background:var(--chip); display:flex; flex-direction:column; justify-content:space-between; padding:6px; font-size:13px; position:relative; font-weight:700 }
.ggl-root .pcard.leg{ border-color:var(--gold); box-shadow:0 0 0 1px var(--gold) inset } .ggl-root .pcard.lock{ opacity:.4 } .ggl-root .pcard .r{ font-size:17px } .ggl-root .pcard .own{ position:absolute; bottom:4px; right:6px; font-size:10px; color:var(--ink-dim) }
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
`;

const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['♦', 'var(--diamond)'], ['♣', 'var(--club)']];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const kfmt = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function deckGrid(deck: number[]): string {
  return deck.map((fv, i) => {
    const [su, c] = SUITS[Math.floor(i / 13) % 4];
    const cls = 'pcard' + (fv >= 70 ? ' leg' : '') + (fv <= 50 ? ' lock' : '');
    return `<div class="${cls}"><div class="r" style="color:${c}">${su}</div><div style="text-align:right;color:${c}">${RANKS[i % 13]}</div><span class="own">${fv}</span></div>`;
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

export function renderLobby(view: LobbyView, tab: string, tutorialOpen: boolean): string {
  const on = (t: string): string => (tab === t ? ' on' : '');
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
    <section class="screen${on('decks')} full"><div class="card"><h2>📜 出战牌组 · 52 张 <span class="ghost" style="margin-left:auto;font-size:12px">favor 均 ${view.deckAvg} · 最低 ${view.deckMin} / 最高 ${view.deckMax}</span></h2>
      <div class="colgrid">${deckGrid(view.deck)}</div>
      <div class="tools"><button class="btn" data-act="deckTool" data-k="all">强化全军 +3 favor <span style="opacity:.7">🪙12</span></button><button class="btn ghost" data-act="deckTool" data-k="weak">精炼最弱 12 张 +8 <span class="ghost">🪙8</span></button></div>
      <div class="note" style="text-align:left">favor=该牌掷命翻正面(存活)的概率底盘。<b style="color:var(--gold)">金边</b>=强(≥70) / 暗格=弱(≤50)。花材料改造让更多牌活下来。</div></div></section>
    <section class="screen${on('coll')} full"><div class="card"><h2>🗃 卡牌收藏 · 小丑 ${view.jokers.filter((j) => j.owned).length}/${view.jokers.length} · 闪艺 ${view.foils.filter((f) => f.owned).length}/${view.foils.length}</h2>
      <div class="note" style="text-align:left;margin-bottom:6px">🃏 小丑牌（改掷命规则=流派身份 · 到改造坊融取）</div>
      <div class="shelf">${view.jokers.map((j) => shopItem('', '🃏', { ...j, buyable: false })).join('')}</div>
      <div class="note" style="text-align:left;margin:12px 0 6px">✨ 闪艺 foil（纯装饰收集 · 点亮可购买）</div>
      <div class="shelf">${view.foils.map((f) => shopItem('buyFoil', '✨', f)).join('')}</div></div></section>
    <section class="screen${on('craft')} full"><div class="forge">
      <div class="card"><h2>⚒ 改造台 · 融小丑（持久牌组身份·公平骨架不泵点数）</h2><div class="fuse"><div class="slot" style="color:var(--club)">♣</div><div class="arrow">→</div><div class="slot" style="color:var(--gold)">🃏</div></div>
        <div class="shelf">${view.jokers.map((j) => shopItem('buyJoker', '🃏', j)).join('')}</div></div>
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
  onDeckTool?: (kind: string) => void;
  onReset?: () => void;
  onSkin?: (skin: 'onyx' | 'rosy') => void;
}

export function mountLobby(host: HTMLElement, h: LobbyHandlers): { update: () => void; destroy: () => void } {
  if (!document.getElementById('ggl-css')) { const s = document.createElement('style'); s.id = 'ggl-css'; s.textContent = CSS; document.head.appendChild(s); }
  let tab = 'home';
  let skin: 'onyx' | 'rosy' = h.getView().skin;
  let tut = false;
  const render = (): void => { host.innerHTML = renderLobby({ ...h.getView(), skin }, tab, tut); };
  const onClick = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act === 'tab') { tab = k; render(); }
    else if (act === 'skin') { skin = k === 'rosy' ? 'rosy' : 'onyx'; h.onSkin?.(skin); render(); }
    else if (act === 'tut') { tut = true; render(); }
    else if (act === 'tut-close') { tut = false; render(); }
    else if (act === 'play') h.onPlay();
    else if (act === 'buyJoker') { h.onBuyJoker?.(k); render(); }
    else if (act === 'buyPlanet') { h.onBuyPlanet?.(k); render(); }
    else if (act === 'buyFoil') { h.onBuyFoil?.(k); render(); }
    else if (act === 'deckTool') { h.onDeckTool?.(k); render(); }
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
