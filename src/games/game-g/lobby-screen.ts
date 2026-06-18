// lobby-screen.ts —— 大厅设计稿「忠实港」（owner ⚡ UI 高优先 · 照 battle-screen 同法）。
// 忠实移植 design/UI/「Game G 大厅.dc.html」（owner 2026-06-18 确认「就是这个老文件 ui」）：CSS/双皮/5 屏 IA 逐字照搬，
// 数据接真存档（材料/能量/牌组 favor/小丑/星球/闪艺/战役进度/流派↔Boss 克制）；未接网项（好友/天梯1v1/全服榜/每日箱）诚实占位。
// 纯表现"固定解释器"（同 battle-screen/ThreeRenderer）：只渲染 view + 抛 data-act 回调，绝不自己算 gameplay。
// CSS 全 scope 在 .ggl-root 下（不漏到别处）；双皮 = .ggl-root[data-skin]。
// 用法：mountLobby(host, handlers) → 渲染 + wire tab/皮肤/出征/改造购买/新手指导；update() 重渲、destroy() 卸载。

// 货架项（小丑/星球/闪艺通用）：游戏侧给真 owned/level/buyable，渲染器只画。
export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number }
export interface LobbyView {
  skin: 'onyx' | 'rosy';
  coin: number;      // 🪙 材料
  energy: number; energyMax: number; // ◈ 干预能量 / 上限
  foilCount: number; // ✨ 已藏闪艺数（替设计稿占位 💎）
  name: string; mainCard: string; rankText: string; // 顶栏身份（rankText=战役进度段位）
  // —— HOME ——
  stageLabel: string; // "第 N 战 / 共 M · 终局 Boss【…】"
  archLine: string;   // 你的流派 + 对 Boss 克制（预格式化 HTML 小句）
  bossLine: string;   // Boss 人格 + 流派（预格式化）
  deckAvg: number; deckMin: number; deckMax: number;
  // —— DECKS（真 52 张 favor 牌组）——
  deck: number[];
  // —— COLL / CRAFT ——
  jokers: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
  // —— LADDER ——
  ladderLines: string[]; // 战役进度若干行（预格式化 HTML）
}

// ── 双皮 CSS 变量 + 全套类（逐字照搬 lobby-faithful.html，scope 到 .ggl-root）──
const CSS = `
.ggl-root[data-skin="onyx"]{ --bg:#0e0d12; --bg2:#16141c; --panel:#1b1822; --panel2:#221e2c; --line:#332c40;
  --ink:#ece6f5; --ink2:#a99fbc; --gold:#e0973a; --accent:#d8504e; --accent2:#ff7a45; --seal:#c0392b; --silk:#191620;
  --shadow:0 6px 22px #0009; --rare-leg:#e0973a; --spade:#4a6390; --heart:#d8504e; --diamond:#e0973a; --club:#3fae6e;
  --scroll:linear-gradient(135deg,#1b1822,#16141c); }
.ggl-root[data-skin="rosy"]{ --bg:#f3ead9; --bg2:#ece0cb; --panel:#fbf4e6; --panel2:#f5ead4; --line:#d9c3a3;
  --ink:#3a2b22; --ink2:#7a6450; --gold:#b8862f; --accent:#c14b66; --accent2:#d8607c; --seal:#b03050; --silk:#fbf4e6;
  --shadow:0 6px 22px #0002; --rare-leg:#b8862f; --spade:#4a6390; --heart:#c14b66; --diamond:#b8862f; --club:#3fae6e;
  --scroll:linear-gradient(135deg,#fbf4e6,#f0e3cc); }
.ggl-root{ background:var(--bg); color:var(--ink); font-family:"Noto Serif SC","Songti SC",serif; min-height:100%; }
.ggl-root *{ box-sizing:border-box; margin:0 }
.ggl-root button{ font-family:inherit; cursor:pointer }
.ggl-root button:disabled{ opacity:.4; cursor:not-allowed }
.ggl-root .ghost{ opacity:.62 } .ggl-root .zh{ font-family:"Ma Shan Zheng","Zhi Mang Xing","Noto Serif SC",serif }
.ggl-root .wrap{ max-width:1340px; margin:0 auto; padding:14px 18px 40px }
.ggl-root .top{ display:flex; align-items:center; gap:14px; padding:10px 16px; border:1px solid var(--line); border-radius:14px; background:var(--scroll); box-shadow:var(--shadow) }
.ggl-root .avatar{ width:46px; height:46px; border-radius:11px; display:grid; place-items:center; font-size:24px; background:radial-gradient(circle at 30% 30%,var(--panel2),var(--bg2)); border:1px solid var(--line); color:var(--spade) }
.ggl-root .me .name{ font-weight:700; font-size:16px; letter-spacing:.5px } .ggl-root .me .sub{ font-size:12px; color:var(--ink2) }
.ggl-root .rank{ margin-left:auto; font-size:13px; color:var(--gold); border:1px solid var(--line); padding:5px 11px; border-radius:20px; background:var(--panel) }
.ggl-root .cur{ display:flex; gap:12px; font-size:13px } .ggl-root .cur b{ color:var(--gold) }
.ggl-root .skin{ display:flex; border:1px solid var(--line); border-radius:20px; overflow:hidden }
.ggl-root .skin button{ background:transparent; color:var(--ink2); border:0; padding:5px 13px; font-size:12px }
.ggl-root .skin button.on{ background:var(--accent); color:#fff }
.ggl-root .gear{ background:var(--panel); border:1px solid var(--line); color:var(--ink2); border-radius:10px; width:34px; height:34px }
.ggl-root .tut{ background:var(--panel); border:1px solid var(--gold); color:var(--gold); border-radius:10px; padding:0 12px; height:34px; font-size:13px; font-weight:700 }
.ggl-root .nav{ display:flex; gap:8px; margin:14px 0 }
.ggl-root .nav button{ flex:0 0 auto; background:var(--panel); color:var(--ink2); border:1px solid var(--line); border-radius:11px; padding:9px 20px; font-size:15px; font-weight:600; position:relative }
.ggl-root .nav button.on{ color:var(--ink); border-color:var(--gold); background:var(--panel2); box-shadow:0 0 0 1px var(--gold) inset }
.ggl-root .nav button.on::after{ content:""; position:absolute; left:18%; right:18%; bottom:-1px; height:2px; background:var(--gold); border-radius:2px }
.ggl-root .screen{ display:none } .ggl-root .screen.on{ display:block }
.ggl-root .layout{ display:grid; grid-template-columns:1fr 300px; gap:16px }
@media(max-width:980px){ .ggl-root .layout{ grid-template-columns:1fr } }
.ggl-root .card{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; box-shadow:var(--shadow) }
.ggl-root .card.silk{ background:var(--scroll) }
.ggl-root h2{ font-size:15px; color:var(--gold); margin-bottom:10px; letter-spacing:1px; display:flex; align-items:center; gap:8px }
.ggl-root h2 .seal{ font-size:11px; background:var(--seal); color:#fff; padding:2px 8px; border-radius:4px; font-family:"Ma Shan Zheng",serif }
.ggl-root .hero{ position:relative; border-radius:16px; overflow:hidden; border:1px solid var(--line);
  background: radial-gradient(120% 80% at 80% 0%,color-mix(in srgb,var(--accent) 28%,transparent),transparent 60%),
   radial-gradient(100% 100% at 0% 100%,color-mix(in srgb,var(--spade) 30%,transparent),transparent 55%), var(--scroll);
  padding:26px 24px; min-height:236px; display:flex; flex-direction:column; justify-content:space-between }
.ggl-root .hero .season{ font-size:13px; color:var(--ink2) }
.ggl-root .hero .title{ font-size:30px; font-weight:800; letter-spacing:2px; text-shadow:0 2px 10px #0006 }
.ggl-root .cta{ display:flex; gap:12px; flex-wrap:wrap }
.ggl-root .btn{ border:1px solid var(--line); border-radius:12px; padding:12px 20px; font-size:15px; font-weight:700; background:var(--panel2); color:var(--ink) }
.ggl-root .btn.primary{ background:linear-gradient(180deg,var(--accent2),var(--accent)); color:#fff; border:0; box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 45%,transparent) }
.ggl-root .btn.dice{ font-size:18px }
.ggl-root .quick{ display:flex; gap:10px; margin-top:14px; flex-wrap:wrap }
.ggl-root .qbtn{ flex:1; min-width:150px; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:11px 13px; display:flex; align-items:center; gap:10px; color:var(--ink); font-size:13px }
.ggl-root .qbtn .ic{ font-size:20px } .ggl-root .qbtn .red{ color:var(--accent); font-weight:700 } .ggl-root .dot{ color:var(--accent); font-size:11px }
.ggl-root .friend{ display:flex; align-items:center; gap:9px; padding:8px 6px; border-bottom:1px solid var(--line); font-size:13px }
.ggl-root .friend:last-child{ border:0 }
.ggl-root .on-dot{ width:8px; height:8px; border-radius:50%; background:var(--club) } .ggl-root .off-dot{ width:8px; height:8px; border-radius:50%; background:#5557 }
.ggl-root .friend .tag{ margin-left:auto; font-size:11px; color:var(--ink2) }
.ggl-root .deckgrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px }
.ggl-root .deck{ background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:13px; position:relative }
.ggl-root .deck .suit{ position:absolute; top:10px; right:12px; font-size:22px; color:var(--spade) }
.ggl-root .deck .nm{ font-weight:700; font-size:16px } .ggl-root .deck .meta{ font-size:12px; color:var(--ink2); margin:3px 0 8px } .ggl-root .deck .key{ font-size:12px; color:var(--gold) }
.ggl-root .deck .row{ display:flex; gap:8px; margin-top:10px }
.ggl-root .deck .row button{ flex:1; background:var(--panel); border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:7px; font-size:12px }
.ggl-root .deck .row button.go{ background:var(--accent); color:#fff; border:0 } .ggl-root .stars{ color:var(--gold); letter-spacing:2px }
.ggl-root .filters{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px }
.ggl-root .filters .f{ background:var(--panel2); border:1px solid var(--line); color:var(--ink2); border-radius:9px; padding:7px 12px; font-size:12px }
.ggl-root .colgrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(70px,1fr)); gap:9px }
.ggl-root .pcard{ aspect-ratio:5/7; border-radius:9px; border:1px solid var(--line); background:var(--panel2); display:flex; flex-direction:column; justify-content:space-between; padding:7px; font-size:13px; position:relative }
.ggl-root .pcard.leg{ border-color:var(--rare-leg); box-shadow:0 0 0 1px var(--rare-leg) inset } .ggl-root .pcard.lock{ opacity:.4 }
.ggl-root .pcard.buy{ cursor:pointer; border-color:var(--accent2) } .ggl-root .pcard.buy:hover{ box-shadow:0 0 0 1px var(--accent2) inset }
.ggl-root .pcard .r{ font-size:18px; font-weight:800 } .ggl-root .pcard .own{ position:absolute; bottom:5px; right:6px; font-size:10px; color:var(--ink2) }
.ggl-root .pcard .jn{ font-size:11px; line-height:1.2; color:var(--ink2) }
.ggl-root .detail{ margin-top:14px; border-top:1px solid var(--line); padding-top:12px } .ggl-root .detail .nm{ font-weight:700; font-size:16px } .ggl-root .detail .rare{ color:var(--rare-leg); font-size:12px; font-weight:700 } .ggl-root .detail .eff{ font-size:13px; color:var(--ink2); margin:6px 0; line-height:1.6 } .ggl-root .meta{ font-size:12px; color:var(--ink2) }
.ggl-root .forge{ display:grid; grid-template-columns:1fr 1fr; gap:14px } @media(max-width:760px){ .ggl-root .forge{ grid-template-columns:1fr } }
.ggl-root .fuse{ display:flex; align-items:center; gap:12px; justify-content:center; padding:14px 0 }
.ggl-root .slot{ width:64px; height:88px; border-radius:10px; border:1px dashed var(--line); display:grid; place-items:center; font-size:26px; background:var(--panel2) } .ggl-root .arrow{ font-size:24px; color:var(--gold) }
.ggl-root .shelf{ display:grid; grid-template-columns:repeat(auto-fill,minmax(118px,1fr)); gap:10px }
.ggl-root .good{ background:var(--panel2); border:1px solid var(--line); border-radius:9px; padding:10px; text-align:center; font-size:12px; position:relative; min-height:74px } .ggl-root .good .cost{ color:var(--gold); font-weight:700; margin-top:6px }
.ggl-root .good.got{ border-color:var(--rare-leg); opacity:.9 } .ggl-root .good.buy{ cursor:pointer } .ggl-root .good.buy:hover{ border-color:var(--accent2); box-shadow:0 0 0 1px var(--accent2) inset } .ggl-root .good.lock{ opacity:.5 }
.ggl-root .good .gnm{ font-weight:700; color:var(--ink); font-size:12px; line-height:1.25 }
.ggl-root .ladder-top{ display:flex; gap:16px; flex-wrap:wrap } .ggl-root .ladder-top .box{ flex:1; min-width:180px } .ggl-root .bigrank{ font-size:26px; font-weight:800; color:var(--gold) }
.ggl-root .rankrow{ display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid var(--line); font-size:13px } .ggl-root .rankrow:last-child{ border:0 } .ggl-root .rankrow .n{ width:22px; color:var(--ink2); text-align:center } .ggl-root .rankrow .lp{ margin-left:auto; color:var(--gold) }
.ggl-root .note{ font-size:11px; color:var(--ink2); text-align:center; margin-top:22px; line-height:1.7 }
.ggl-root .tut-ov{ position:absolute; inset:0; background:#000a; display:flex; align-items:center; justify-content:center; padding:24px; z-index:50 }
.ggl-root .tut-box{ max-width:920px; max-height:90%; overflow:auto; background:var(--panel); border:1px solid var(--gold); border-radius:14px; padding:22px; box-shadow:var(--shadow) }
.ggl-root .tut-box h3{ color:var(--gold); font-size:18px; margin-bottom:12px } .ggl-root .tut-box .step{ border-left:3px solid var(--accent); padding:6px 0 6px 12px; margin:8px 0; font-size:14px; line-height:1.7 } .ggl-root .tut-box .step b{ color:var(--ink) }
`;

const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['♦', 'var(--diamond)'], ['♣', 'var(--club)']];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const kfmt = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 真 52 张 favor 牌组网格（花色 i/13、点数 i%13；金边=强 favor≥70 / 暗格=弱 ≤50）。
function deckGrid(deck: number[]): string {
  return deck.map((fv, i) => {
    const [su, c] = SUITS[Math.floor(i / 13) % 4];
    const r = RANKS[i % 13];
    const cls = 'pcard' + (fv >= 70 ? ' leg' : '') + (fv <= 50 ? ' lock' : '');
    return `<div class="${cls}"><div class="r" style="color:${c}">${su}</div><div style="text-align:right;color:${c}">${r}</div><span class="own">${fv}</span></div>`;
  }).join('');
}
// 货架/收藏项渲染（小丑/星球/闪艺）：owned→金边、buyable→可点 data-act、否则锁。
function shopItem(act: string, glyph: string, it: LobbyShopItem): string {
  const cls = 'good' + (it.owned ? ' got' : it.buyable ? ' buy' : ' lock');
  const attr = it.buyable && !it.owned ? ` data-act="${act}" data-k="${it.id}"` : '';
  const lv = it.level !== undefined ? ` <span class="ghost">Lv.${it.level}</span>` : '';
  const foot = it.owned && it.level === undefined ? '<div class="cost">✓ 已融</div>' : `<div class="cost">🪙 ${it.cost}</div>`;
  return `<div class="${cls}"${attr} title="${esc(it.sub)}"><div class="gnm">${glyph} ${esc(it.name)}${lv}</div>${foot}</div>`;
}

// 对局流程图 overlay（新手指导 · in-game 简版，详图见 doc/match-flow.html）。
function tutorialBox(): string {
  return `<div class="tut-ov" data-act="tut-close"><div class="tut-box" data-stop="1">
    <h3>📖 新手指导 · 一局怎么打</h3>
    <div class="step"><b>赛前（改造坊）</b>：构筑你的库——标准公平 54 牌 + 小丑/附魔/星球（强弱靠经营，不靠抽强牌）。</div>
    <div class="step"><b>开局</b>：三路预铺基础布局，起手摸手牌（点数牌+功能牌），读秒暂停银行满，短带迷雾亮。</div>
    <div class="step"><b>实时博弈（核心）</b>：① 看/侦查读三路战线 ② 田忌断舍·往哪路投牌、弃哪路 ③ 打小丑/功能牌给某路某牌加 buff/干涉。牌慢慢往敌家走 = 给你思考时间。</div>
    <div class="step"><b>对决核</b>：最前两张相遇 → 战力 P_eff 聚合 → 胜率(如 76:24) → 种子骰 → 正面活·前进 / 反面亡。<b>胜率可见</b>，你戳得动对方布阵缺陷。</div>
    <div class="step"><b>赢条件</b>：幸存者突破到敌大本营 −1 血（共 3 血），<b>先破者胜</b>；续航+冷却逼牌组轮转（神牌也得回家歇）。</div>
    <div class="step">关键：用<b>构筑 + 时机 + 组合</b>掰动随机，以少胜多。这就是「扑克翻转大战」的灵魂。</div>
    <div style="text-align:center;margin-top:14px"><button class="btn primary" data-act="tut-close">明白了，开打 →</button></div>
  </div></div>`;
}

export function renderLobby(view: LobbyView, tab: string, tutorialOpen: boolean): string {
  const on = (t: string): string => (tab === t ? ' on' : '');
  const deckAvgTxt = `favor 均 ${view.deckAvg} · 最低 ${view.deckMin} / 最高 ${view.deckMax}`;
  return `<div class="ggl-root" data-skin="${view.skin}"><div class="wrap">
  <div class="top">
    <div class="avatar">♠</div>
    <div class="me"><div class="name zh">${esc(view.name)}</div><div class="sub">主牌 · <b style="color:var(--spade)">${esc(view.mainCard)}</b></div></div>
    <div class="rank">⚔️ ${esc(view.rankText)}</div>
    <div class="cur"><span>🪙 <b>${kfmt(view.coin)}</b></span><span>◈ <b>${view.energy}/${view.energyMax}</b></span><span>✨ <b>${view.foilCount}</b></span></div>
    <button class="tut" data-act="tut">📖 新手指导</button>
    <div class="skin"><button class="${view.skin === 'onyx' ? 'on' : ''}" data-act="skin" data-k="onyx">玄铁</button><button class="${view.skin === 'rosy' ? 'on' : ''}" data-act="skin" data-k="rosy">锦霞</button></div>
    <button class="gear" data-act="reset" title="重置进度">⚙</button>
  </div>
  <div class="nav">
    <button class="${on('home')}" data-act="tab" data-k="home">大厅</button>
    <button class="${on('decks')}" data-act="tab" data-k="decks">牌组</button>
    <button class="${on('coll')}" data-act="tab" data-k="coll">收藏</button>
    <button class="${on('craft')}" data-act="tab" data-k="craft">改造坊</button>
    <button class="${on('ladder')}" data-act="tab" data-k="ladder">天梯</button>
  </div>
  <section class="screen${on('home')}"><div class="layout"><div>
    <div class="hero"><div><div class="season">${esc(view.stageLabel)}</div><div class="title zh">命运牌桌</div><div class="season" style="margin-top:6px">${view.bossLine}</div></div>
      <div class="cta"><button class="btn primary" data-act="play"><span class="dice">🎲</span> ⚔ 出征 · ${esc(view.rankText)}</button><button class="btn" disabled>好友切磋（占位）</button><button class="btn" disabled>天梯 1V1（占位）</button></div></div>
    <div class="card" style="margin-top:14px"><div style="line-height:1.7">${view.archLine}</div></div>
    <div class="quick"><div class="qbtn"><span class="ic">🃏</span><div>出战牌组<br><b style="color:var(--spade)">favor 均 ${view.deckAvg} ▸</b></div></div>
      <div class="qbtn"><span class="ic">🪙</span><div>材料<br><b>${kfmt(view.coin)}</b></div></div>
      <div class="qbtn"><span class="ic">◈</span><div>干预能量<br><b>${view.energy}/${view.energyMax}</b></div></div></div>
    </div>
    <div class="card silk"><h2>🪖 牌友 · 命运牌桌</h2>
      <div class="ghost" style="font-size:12px;line-height:1.8">好友切磋 / 天梯 1v1 DUEL 为设计 IA、尚未接入网络（占位）。<br>当前：单人战役 vs AI 庄家·Boss。</div>
      <div class="friend" style="margin-top:10px"><span class="off-dot"></span> 张飞_关张 <span class="tag">占位</span></div>
      <div class="friend"><span class="off-dot"></span> 周瑜 <span class="tag">占位</span></div></div>
  </div></section>
  <section class="screen${on('decks')}"><div class="card"><h2>📜 出战牌组 · 52 张 <span style="margin-left:auto;font-size:12px;color:var(--ink2)">${deckAvgTxt}</span></h2>
    <div class="colgrid">${deckGrid(view.deck)}</div>
    <div class="filters" style="margin-top:14px"><button class="btn" data-act="deckTool" data-k="all" style="font-size:13px;padding:9px 14px">强化全军 +3 favor <span class="ghost">🪙12</span></button><button class="btn" data-act="deckTool" data-k="weak" style="font-size:13px;padding:9px 14px">精炼最弱 12 张 +8 <span class="ghost">🪙8</span></button></div>
    <div class="note" style="text-align:left">favor = 该牌掷命翻正面(存活)的概率底盘。<b style="color:var(--gold)">金边</b>=强(≥70) / 暗格=弱(≤50)。花材料改造让更多牌活下来。</div></div></section>
  <section class="screen${on('coll')}"><div class="card"><h2>🗃 卡牌收藏 · 小丑 ${view.jokers.filter((j) => j.owned).length}/${view.jokers.length} · 闪艺 ${view.foils.filter((f) => f.owned).length}/${view.foils.length}</h2>
    <div class="meta" style="margin-bottom:6px">🃏 小丑牌（改掷命规则 = 流派身份 · 到改造坊融取）</div>
    <div class="shelf">${view.jokers.map((j) => shopItem('', '🃏', { ...j, buyable: false })).join('')}</div>
    <div class="meta" style="margin:12px 0 6px">✨ 闪艺 foil（纯装饰收集 · 点亮可购买）</div>
    <div class="shelf">${view.foils.map((f) => shopItem('buyFoil', '✨', f)).join('')}</div></div></section>
  <section class="screen${on('craft')}"><div class="forge">
    <div class="card silk"><h2>⚒ 改造台 · 融小丑（持久牌组身份·公平骨架不泵点数）</h2><div class="fuse"><div class="slot" style="color:var(--club)">♣</div><div class="arrow">→</div><div class="slot" style="color:var(--gold)">🃏</div></div>
      <div class="shelf">${view.jokers.map((j) => shopItem('buyJoker', '🃏', j)).join('')}</div></div>
    <div class="card"><h2>🪐 星球牌 · 升档（可叠加 · 第二养成轴）</h2><div class="meta" style="font-size:12px;margin-bottom:8px">改 run 参数（命/能/兵档/牌型）· 持久存档 · 买一级累加</div>
      <div class="shelf">${view.planets.map((p) => shopItem('buyPlanet', '🪐', p)).join('')}</div></div>
  </div><div class="note" style="text-align:left">材料 🪙 ${kfmt(view.coin)} · 融小丑=改掷命规则(流派身份·持久) / 星球=升 run 参数。出征赢取材料。庄家货架买一张少一张为设计 IA（占位）。</div></section>
  <section class="screen${on('ladder')}"><div class="ladder-top">
    ${view.ladderLines.map((l) => `<div class="card box">${l}</div>`).join('')}
  </div><div class="rankrow" style="margin-top:14px"><span class="n">1</span> 不败战神 <span class="lp">2480</span></div><div class="rankrow"><span class="n">2</span> 一掷千金 <span class="lp">2310</span></div><div class="rankrow"><span class="n">…</span> ${esc(view.name)} <span class="lp">${esc(view.rankText)}</span></div>
  <div class="note" style="text-align:left">天梯 1v1 / LP / 全服榜为设计 IA、尚未接入网络（占位）。当前=单人战役 vs AI Boss，段位即战役进度。</div></section>
  <div class="note">大厅忠实港 · 对照 UI/Game G 大厅.dc.html 五屏 IA + 顶栏 + 玄铁/锦霞双皮 · 真实存档数据 · 未接网项已诚实标占位</div>
  </div>${tutorialOpen ? tutorialBox() : ''}</div>`;
}

// 大厅交互回调（game-g.tsx 提供真 gameplay；渲染器只抛事件、不算 gameplay）。
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

// 挂载大厅设计稿到 host：注入 scoped CSS、渲染、wire tab/皮肤/出征/改造购买/重置/新手指导 overlay。
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

// 离线"看帧" golden：自包含 HTML 文档（CSS + 真渲染器输出）。浏览器开 = 真大厅。
export function renderLobbyDoc(view: LobbyView, tab = 'home'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#0e0d12}${CSS}</style></head><body>${renderLobby(view, tab, false)}</body></html>`;
}
