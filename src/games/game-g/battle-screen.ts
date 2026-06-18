// Game G · 三路战场 —— 设计稿「完整复刻」的游戏内渲染器（owner 2026-06-17 确认 battle-faithful 无误后落地）。
// 忠实移植自 design/UI/「Game G 对战 三路战场.dc.html」/ doc/battle-faithful.html：themes()/几何/样式 逐字复用，
// 仅把样例数据换成 BattleView（由 game-g.tsx 从真 live-combat 逐拍 sim 派生）。纯表现"固定解释器"(同 ThreeRenderer，manifesto §2)：
//   不进 hash、不读 sim 真相外、不回灌胜负。胜负仍 live-combat outcome-first 定。
// 与 battle-faithful.html 同源——改样式须两处同步（doc 那份是 owner 核对基准）。
// WIRE-MARCH（owner 钉死「一格格慢慢走」）：兵位 = live-combat 的**真 slot 位置** pos01（0=我家…1=敌家），
//   不再按 FLIP/MARCH_DURATION 插值——慢慢爬/接敌才翻 全由 sim 真相驱动，渲染器只如实画当下那一拍。

// ── 战场视图数据（game-g.tsx 从 live-combat 逐拍 sim 派生，每帧喂） ──
// pos01 = 该牌沿本路的真实进度（0=A 家 / 1=B 家，= live pos/LANE_LEN）；revealed = 是否已接敌翻开（面朝下行军→接敌翻）；
// faceUp = 翻开后生死（活=正面 / 死=石板斩）。id 供驱动层插值匹配（不进渲染 HTML）。
export interface BattleUnit { id: string; lane: number; side: 'a' | 'b'; pos01: number; revealed: boolean; faceUp: boolean; rank: string; suit: 's' | 'h' | 'd' | 'c'; general: boolean }
export interface BattleLane { name: string; mine: number; enemy: number; lead: 'a' | 'b' | 'n'; state: string; mineText: string; enemyText: string }
export interface BattleLever { key: string; glyph: string; name: string; cost: number; desc: string; on?: boolean }
export interface BattleView {
  homeA: number; homeAMax: number; homeB: number; homeBMax: number;
  oppName: string; oppPersona: string; oppSuit: 's' | 'h' | 'd' | 'c';
  energy: number; energyMax: number; materials: number;
  phaseText: string; timeText: string;
  levers: BattleLever[]; lanes: BattleLane[]; units: BattleUnit[];
}

type Theme = Record<string, string>;
const st = (o: Record<string, string | number>): string => Object.entries(o).map(([k, v]) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + v).join(';');
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SUITC: Record<string, string> = { s: '#4a6390', h: '#d8504e', d: '#e0973a', c: '#3fae6e' };
const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

const THEMES: Record<string, Theme> = {
  onyx: {
    '--app-bg': 'radial-gradient(120% 120% at 50% -10%, #1a2230 0%, #0a0d12 55%, #06080b 100%)',
    '--texture': 'repeating-linear-gradient(45deg, rgba(135,175,215,.05) 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, rgba(135,175,215,.04) 0 1px, transparent 1px 9px)',
    '--hud-bg': 'linear-gradient(180deg,rgba(22,28,37,.95),rgba(14,18,24,.88))', '--dock-bg': 'linear-gradient(180deg,rgba(18,23,31,.7),rgba(10,13,18,.97))',
    '--panel-grad': 'linear-gradient(180deg,#1c2531,#121821)', '--panel-border': '#33404f', '--hairline': 'rgba(255,214,150,.12)', '--chip-bg': 'rgba(255,255,255,.05)',
    '--seg-track': '#161d27', '--seg-edge': '#2c313b', '--track': 'rgba(0,0,0,.5)', '--ink': '#e7edf3', '--ink-dim': '#7e8c9b',
    '--accent': '#ff5d2e', '--accent-grad': 'linear-gradient(180deg,#ff7a45,#ee4515)', '--accent-soft': 'rgba(255,93,46,.18)', '--accent-ink': '#1c0d06',
    '--hp': '#46d17a', '--gold': '#ffcb3d', '--gold-chip': 'rgba(255,203,61,.1)', '--danger': '#ff404f',
    '--btn-bg': 'linear-gradient(180deg,#283341,#1a222c)', '--btn-edge': '#3d4b5b', '--btn-text': '#dfe7ef',
    '--arena': 'radial-gradient(120% 120% at 50% 50%, #20402f, #11221a 78%)', '--arena-edge': '#0b1a13',
    '--ready-bg': 'linear-gradient(180deg,#ff7a45,#e8420f)', '--ready-text': '#1c0d06', '--ready-shadow': '0 0 22px rgba(255,93,46,.5), inset 0 1px 0 rgba(255,255,255,.4)',
    '--font-display': "'Zhi Mang Xing', cursive", '--font-heading': "'Rajdhani', sans-serif", '--font-body': "'Noto Sans SC', sans-serif", '--font-num': "'Silkscreen', monospace",
  },
  brocade: {
    '--app-bg': 'radial-gradient(120% 120% at 50% -10%, #fdf4ee 0%, #f3e2dc 60%, #ecd6cf 100%)',
    '--texture': 'radial-gradient(circle, rgba(201,148,72,.14) 1px, transparent 1.7px) 0 0/26px 26px, repeating-linear-gradient(45deg, rgba(201,148,72,.06) 0 1px, transparent 1px 26px), repeating-linear-gradient(-45deg, rgba(201,148,72,.06) 0 1px, transparent 1px 26px)',
    '--hud-bg': 'linear-gradient(180deg,rgba(255,250,244,.96),rgba(251,238,229,.9))', '--dock-bg': 'linear-gradient(180deg,rgba(255,250,244,.72),rgba(250,236,225,.98))',
    '--panel-grad': 'linear-gradient(180deg,#fffdfa,#fbeee4)', '--panel-border': '#e3c896', '--hairline': 'rgba(216,164,78,.4)', '--chip-bg': 'rgba(255,255,255,.55)',
    '--seg-track': '#f3e3d4', '--seg-edge': '#e3c896', '--track': 'rgba(150,110,90,.18)', '--ink': '#5a3f44', '--ink-dim': '#a98b8f',
    '--accent': '#d8607b', '--accent-grad': 'linear-gradient(180deg,#e887a0,#cf5070)', '--accent-soft': 'rgba(216,96,123,.16)', '--accent-ink': '#fff',
    '--hp': '#54ad8e', '--gold': '#cf9a3f', '--gold-chip': 'rgba(207,154,63,.12)', '--danger': '#d65668',
    '--btn-bg': 'linear-gradient(180deg,#fffaf4,#fbece1)', '--btn-edge': '#ecd3b2', '--btn-text': '#6a4a4f',
    '--arena': 'radial-gradient(120% 120% at 50% 50%, #b3727b, #884a58 78%)', '--arena-edge': '#5f323d',
    '--ready-bg': 'linear-gradient(180deg,#ec9f6f,#d77a86)', '--ready-text': '#fff', '--ready-shadow': '0 8px 24px rgba(208,120,120,.4), inset 0 1px 0 rgba(255,255,255,.6)',
    '--font-display': "'Ma Shan Zheng', cursive", '--font-heading': "'Cormorant Garamond', serif", '--font-body': "'Noto Serif SC', serif", '--font-num': "'Silkscreen', monospace",
  },
};

const CSS = `
@keyframes gg-tossL { 0%,100% { transform: translate(-50%,-50%) rotate(-15deg); } 50% { transform: translate(-50%,-64%) rotate(-21deg); } }
@keyframes gg-tossR { 0%,100% { transform: translate(-50%,-50%) rotate(16deg); } 50% { transform: translate(-50%,-38%) rotate(24deg); } }
@keyframes gg-pulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
@keyframes gg-shimmer { 0% { background-position: -120% 0; } 100% { background-position: 220% 0; } }
@keyframes gg-march { 0%,100% { transform: translate(-50%,-50%) rotate(var(--rot,0deg)); } 50% { transform: translate(-50%,-56%) rotate(var(--rot,0deg)); } }
@keyframes gg-dash { to { stroke-dashoffset: -68; } }
.gg-root input[type=range].gz { -webkit-appearance:none; appearance:none; height:6px; border-radius:99px; outline:none; }
.gg-root input[type=range].gz::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:2px solid var(--accent); cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.4); }
.gg-root [data-act="lever"]:hover, .gg-root [data-act="focus"]:hover, .gg-root [data-act="lane"]:hover, .gg-root [data-act="zoom"]:hover, .gg-root [data-act="gate"]:hover { filter:brightness(1.08); transform:translateY(-2px); border-color:var(--accent); }
.gg-root [data-act="lever"]:active, .gg-root [data-act="focus"]:active, .gg-root [data-act="lane"]:active, .gg-root [data-act="zoom"]:active, .gg-root [data-act="gate"]:active, .gg-root [data-act="ready"]:active { transform:translateY(1px) scale(.97); filter:brightness(.94); }
.gg-root [data-act="ready"]:hover { filter:brightness(1.08); transform:translateY(-2px); }
`;

// 贝塞尔三路几何（design 坐标系 3000×1500）。
const qb = (p0: number[], p1: number[], p2: number[], t: number): number[] => [Math.round((1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]), Math.round((1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])];
const A_POS = [300, 750], B_POS = [2700, 750];
// 三路皆走平滑二次贝塞尔曲线（owner：三条 smooth 曲线）：上拱/下拱/中路轻拱——不再有直线段。
const TP = [[380, 650], [1500, 150], [2620, 650]], BP = [[380, 850], [1500, 1350], [2620, 850]], MP = [[460, 750], [1500, 640], [2540, 750]];
const laneAt = (lane: number, t: number): number[] => (lane === 0 ? qb(TP[0], TP[1], TP[2], t) : lane === 2 ? qb(BP[0], BP[1], BP[2], t) : qb(MP[0], MP[1], MP[2], t));

interface CamState { theme: string; lever: string; lane: string; zoom: number; camX: number; camY: number; gates: Record<string, boolean> }

function buildHTML(view: BattleView, s: CamState): string {
  const T = THEMES[s.theme] ?? THEMES.onyx;
  const W = 3000, H = 1500, VPW = 1284, VPH = 612, Z = s.zoom, CX = s.camX, CY = s.camY;
  const forr = <X,>(arr: X[], fn: (x: X, i: number) => string): string => arr.map(fn).join('');
  const at = (p: number[]): Record<string, string> => ({ left: p[0] + 'px', top: p[1] + 'px' });
  const seg = (on: boolean): Record<string, string | number> => ({ padding: '7px 15px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', letterSpacing: '.03em', whiteSpace: 'nowrap', border: 'none', background: on ? 'var(--accent-grad)' : 'transparent', color: on ? 'var(--accent-ink)' : 'var(--ink-dim)', boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,.3)' : 'none', transition: 'all .15s ease' });
  const pct = (cur: number, max: number): number => Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)));

  const rootStyle = Object.assign({}, T, { background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-body)' });
  const phaseBanner = { padding: '6px 22px', borderRadius: '99px', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', letterSpacing: '.04em', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' };
  const nexBadgeA = { width: '46px', height: '46px', flex: 'none', borderRadius: '12px', background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', boxShadow: '0 0 14px var(--accent-soft)', border: '1px solid rgba(255,255,255,.3)' };
  const nexBadgeB = { width: '46px', height: '46px', flex: 'none', borderRadius: '12px', background: 'linear-gradient(180deg,#5ea0e0,#2a5f9e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', boxShadow: '0 0 14px rgba(58,134,212,.4)', border: '1px solid rgba(255,255,255,.3)' };

  const viewport = { position: 'relative', width: VPW + 'px', height: VPH + 'px', borderRadius: '20px', overflow: 'hidden', background: 'var(--arena-edge)', border: '8px solid var(--arena-edge)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.07), 0 18px 40px rgba(0,0,0,.45)', cursor: 'grab', userSelect: 'none' };
  const world = { position: 'absolute', top: '0', left: '0', width: W + 'px', height: H + 'px', transformOrigin: '0 0', transform: 'translate(' + (VPW / 2 - CX * Z) + 'px,' + (VPH / 2 - CY * Z) + 'px) scale(' + Z + ')', background: 'var(--arena)', backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 90px), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px 90px)' };

  const mkNexus = (p: number[], col: string, glow: string, hp: number, max: number, who: string, glyph: string): string => {
    const style = Object.assign({ position: 'absolute', width: '230px', height: '230px', transform: 'translate(-50%,-50%)', borderRadius: '40px', background: 'linear-gradient(160deg,#fbf7ef,#e7dac3)', border: '9px solid ' + col, boxShadow: '0 0 70px ' + glow + ', 0 24px 50px rgba(0,0,0,.55), inset 0 0 0 4px rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }, at(p));
    const broken = hp <= 0;
    return `<div style="${st(style)}">
      <div style="position:absolute; top:-46px; left:50%; transform:translateX(-50%); font-size:70px; color:var(--gold); text-shadow:0 3px 10px rgba(0,0,0,.5);">♔</div>
      <span style="font-size:128px; color:${broken ? '#7f1d1d' : col};">${glyph}</span>
      <div style="position:absolute; bottom:-52px; left:50%; transform:translateX(-50%); padding:5px 22px; border-radius:99px; background:rgba(8,12,10,.72); color:#fff; font-family:var(--font-heading); font-weight:700; font-size:26px; white-space:nowrap; border:2px solid ${col};">${esc(who)}${broken ? ' · 已破' : ''}</div>
      <div style="position:absolute; bottom:14px; left:24px; right:24px; height:14px; border-radius:99px; background:rgba(0,0,0,.45); overflow:hidden; border:2px solid rgba(255,255,255,.4);"><div style="width:${pct(hp, max)}%; height:100%; background:${broken ? 'var(--danger)' : col};"></div></div>
    </div>`;
  };

  const towerData: [number[], string, string, number][] = [[laneAt(0, 0.2), 'a', 's', 0.9], [laneAt(0, 0.8), 'b', 'h', 0.6], [laneAt(1, 0.22), 'a', 's', 1.0], [laneAt(1, 0.78), 'b', 'd', 0.55], [laneAt(2, 0.2), 'a', 'c', 0.85], [laneAt(2, 0.8), 'b', 'h', 0.6]];
  const towersHTML = forr(towerData, ([p, team, suit, hp]) => {
    const col = team === 'a' ? '#ff5d2e' : '#3a86d4';
    const style = Object.assign({ position: 'absolute', width: '100px', height: '120px', transform: 'translate(-50%,-50%)', borderRadius: '16px', background: 'linear-gradient(160deg,#fbf7ef,#e7dac3)', border: '6px solid ' + col, boxShadow: '0 0 26px ' + col + '66, 0 12px 26px rgba(0,0,0,.5), inset 0 0 0 3px rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }, at(p));
    return `<div style="${st(style)}"><span style="font-size:52px; color:${SUITC[suit]};">${SUITG[suit]}</span><div style="position:absolute; left:8px; right:8px; bottom:-15px; height:9px; border-radius:99px; background:rgba(0,0,0,.5); overflow:hidden;"><div style="width:${(hp as number) * 100}%; height:100%; background:${col};"></div></div></div>`;
  });

  // 兵：位置 = laneAt(pos01)，pos01 = live-combat 真 slot 进度（0=我家…1=敌家）。同路同侧多张按渲染序错三行、不重叠。
  // 一格格慢慢爬/接敌才翻——全由 sim 真相（pos / revealed）驱动，渲染器只如实画当下。
  const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
  const laneCounters: Record<string, number> = {};
  const unitsHTML = forr(view.units, (u) => {
    const key = u.side + u.lane;
    const n = laneCounters[key] = (laneCounters[key] ?? 0) + 1;
    const p = laneAt(u.lane, clamp01(u.pos01)); // 真 slot 位置 → 贝塞尔三路（一张接一张单列行进，不再三行错开）
    const cc = u.side === 'a' ? '#ff5d2e' : '#3a86d4';
    const rot = (((u.lane * 7 + n * 13) % 12) - 6).toFixed(1);
    const base: Record<string, string> = Object.assign({ position: 'absolute', width: '74px', height: '102px', '--rot': rot + 'deg', transform: 'translate(-50%,-50%) rotate(' + rot + 'deg)', animation: 'gg-march ' + (2.6 + (n % 4) * 0.4).toFixed(1) + 's ease-in-out infinite', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, at(p) as Record<string, string>);
    if (!u.revealed) { // 面朝下行军（还没接敌）
      const trim = u.side === 'a' ? '#a16207' : '#0e7490';
      return `<div style="${st(Object.assign({}, base, { background: '#274a73', border: '4px solid ' + (u.general ? trim : '#16314e'), boxShadow: '0 8px 18px rgba(0,0,0,.5)' }))}"><div style="position:absolute; inset:8px; border-radius:6px; border:2px solid rgba(255,255,255,.4); background:repeating-linear-gradient(45deg, rgba(255,255,255,.16) 0 8px, transparent 8px 16px), repeating-linear-gradient(-45deg, rgba(255,255,255,.16) 0 8px, transparent 8px 16px);"></div>${u.general ? `<span style="position:absolute; top:-22px; font-size:30px; color:${trim};">♔</span>` : ''}</div>`;
    }
    if (u.faceUp) { // 揭晓·活
      return `<div style="${st(Object.assign({}, base, { background: 'linear-gradient(160deg,#fbf7ef,#e9dcc6)', border: (u.general ? 6 : 4) + 'px solid ' + cc, boxShadow: '0 8px 18px rgba(0,0,0,.5), 0 0 18px ' + cc + '55, inset 0 0 0 2px rgba(255,255,255,.6)' }))}"><div style="position:absolute; top:5px; left:8px; font-family:var(--font-heading); font-weight:700; font-size:21px; color:${SUITC[u.suit]};">${esc(u.rank)}</div><span style="font-size:42px; color:${SUITC[u.suit]};">${SUITG[u.suit]}</span>${u.general ? '<span style="position:absolute; top:-22px; font-size:30px; color:var(--gold);">♔</span>' : ''}</div>`;
    }
    // 揭晓·死（石板压暗 + 主将红斩）
    return `<div style="${st(Object.assign({}, base, { background: '#9c3324', border: '4px solid var(--danger)', opacity: '.9', boxShadow: '0 8px 18px rgba(0,0,0,.5)' }))}"><div style="position:absolute; inset:9px; border-radius:6px; border:2px solid rgba(255,255,255,.35); background:repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 8px, transparent 8px 16px);"></div>${u.general ? '<span style="position:absolute; font-family:var(--font-heading); font-weight:800; font-size:34px; color:#fff;">斩</span>' : ''}</div>`;
  });

  const laneLbl = (lane: number, dy: number, name: string): string => { const p = laneAt(lane, 0.13); return `<div style="${st(Object.assign({ position: 'absolute', transform: 'translate(-50%,-50%)', padding: '6px 20px', borderRadius: '99px', background: 'rgba(8,12,10,.55)', color: 'rgba(255,255,255,.85)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '30px', letterSpacing: '.12em', border: '1px solid rgba(255,255,255,.18)' }, at([p[0], p[1] + dy])))}">${name}</div>`; };

  const gateDefs: [string, number, number, number, string][] = [['g1', 0.34, 0, 1, '上 ⇄ 中'], ['g2', 0.66, 1, 2, '中 ⇄ 下']];
  const gatesHTML = forr(gateDefs, ([key, t, la, lb, lanes]) => {
    const pA = laneAt(la, t), pB = laneAt(lb, t); const open = s.gates[key];
    const mxp = Math.round((pA[0] + pB[0]) / 2), myp = Math.round((pA[1] + pB[1]) / 2);
    const dx = pB[0] - pA[0], dy = pB[1] - pA[1]; const len = Math.round(Math.hypot(dx, dy)); const ang = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
    const col = open ? '#46d17a' : '#ff404f';
    const connector = { position: 'absolute', left: pA[0] + 'px', top: pA[1] + 'px', width: len + 'px', height: '26px', marginTop: '-13px', transformOrigin: '0 50%', transform: 'rotate(' + ang + 'deg)', borderRadius: '99px', border: '3px dashed ' + col, background: open ? 'repeating-linear-gradient(90deg, rgba(70,209,122,.5) 0 18px, rgba(70,209,122,.12) 18px 34px)' : 'repeating-linear-gradient(90deg, rgba(255,64,79,.4) 0 12px, transparent 12px 24px)', opacity: open ? '0.95' : '0.45', boxShadow: open ? '0 0 24px rgba(70,209,122,.55)' : 'none', zIndex: '3' };
    const node = { position: 'absolute', left: mxp + 'px', top: myp + 'px', transform: 'translate(-50%,-50%)', width: '96px', height: '104px', borderRadius: '18px', cursor: 'pointer', background: 'linear-gradient(160deg,#fbf7ef,#e7dac3)', border: '6px solid ' + col, boxShadow: '0 0 28px ' + col + '88, 0 12px 26px rgba(0,0,0,.5), inset 0 0 0 3px rgba(255,255,255,.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: '6' };
    return `<div style="${st(connector)}"></div><div data-act="gate" data-k="${key}" style="${st(node)}"><div style="position:absolute; top:-36px; left:50%; transform:translateX(-50%); padding:3px 13px; border-radius:99px; background:rgba(8,12,10,.7); color:#fff; font-family:var(--font-heading); font-weight:700; font-size:21px; white-space:nowrap; border:1px solid ${col};">${esc(lanes)}</div><span style="font-family:var(--font-display); font-size:56px; color:${col}; line-height:1;">门</span><div style="margin-top:5px; padding:2px 14px; border-radius:99px; background:${col}; color:${open ? '#06281a' : '#fff'}; font-family:var(--font-heading); font-weight:700; font-size:18px;">${open ? '通行' : '封锁'}</div></div>`;
  });

  const focusChip = { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '10px', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'rgba(12,16,14,.66)', color: 'rgba(255,255,255,.86)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', transition: 'all .15s ease' };
  const focusChipOn = Object.assign({}, focusChip, { background: 'var(--accent-grad)', color: '#fff', border: '1px solid var(--accent)' });
  const zp = (Z - 0.55) / (2.6 - 0.55) * 100;

  // 小地图
  const mmW = 236, mmH = Math.round(mmW * H / W), mmScale = mmW / W;
  const samp = (lane: number): number[][] => [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((t) => laneAt(lane, t));
  let mmLanesHTML = '';
  [samp(0), samp(2), [laneAt(1, 0), laneAt(1, 1)]].forEach((pts) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = (b[0] - a[0]) * mmScale, dy = (b[1] - a[1]) * mmScale; const len = Math.hypot(dx, dy); const ang = Math.atan2(dy, dx) * 180 / Math.PI; mmLanesHTML += `<div style="${st({ position: 'absolute', left: (a[0] * mmScale) + 'px', top: (a[1] * mmScale) + 'px', width: (len + 2) + 'px', height: '7px', marginTop: '-3.5px', borderRadius: '99px', background: 'rgba(238,222,180,.3)', transformOrigin: '0 50%', transform: 'rotate(' + ang + 'deg)' })}"></div>`; } });
  const blip = (p: number[], c: string, sz: number): string => `<div style="${st({ position: 'absolute', left: (p[0] * mmScale) + 'px', top: (p[1] * mmScale) + 'px', width: sz + 'px', height: sz + 'px', marginLeft: (-sz / 2) + 'px', marginTop: (-sz / 2) + 'px', borderRadius: '2px', background: c, boxShadow: '0 0 4px ' + c })}"></div>`;
  let mmBlipsHTML = blip(A_POS, '#ff5d2e', 12) + blip(B_POS, '#3a86d4', 12);
  towerData.forEach(([p, team]) => { mmBlipsHTML += blip(p, team === 'a' ? '#ff7a45' : '#5ea0e0', 7); });
  const visW = VPW / Z, visH = VPH / Z;
  const mmViewRect = { position: 'absolute', left: ((CX - visW / 2) * mmScale) + 'px', top: ((CY - visH / 2) * mmScale) + 'px', width: (visW * mmScale) + 'px', height: (visH * mmScale) + 'px', border: '2px solid #fff', borderRadius: '3px', boxShadow: '0 0 0 9999px rgba(0,0,0,.28)', pointerEvents: 'none' };

  // 右栏 三路战况
  const lanesHTML = forr(view.lanes, (l) => {
    const col = l.lead === 'a' ? 'var(--accent)' : l.lead === 'b' ? '#3a86d4' : 'var(--gold)';
    const tot = Math.max(1, l.mine + l.enemy);
    return `<div style="${st({ borderRadius: '13px', background: 'var(--chip-bg)', border: '1px solid var(--panel-border)', boxShadow: 'inset 0 0 0 1px var(--hairline)', padding: '12px 13px' })}">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:9px;"><div style="${st({ padding: '3px 11px', borderRadius: '8px', background: 'var(--track)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', color: 'var(--ink)' })}">${esc(l.name)}</div><span style="flex:1;"></span><span style="font-family:var(--font-heading); font-weight:700; font-size:12px; color:${col};">${esc(l.state)}</span></div>
      <div style="position:relative; height:10px; border-radius:99px; background:var(--track); overflow:hidden;"><div style="position:absolute; left:0; top:0; bottom:0; width:${Math.round(l.mine / tot * 100)}%; background:var(--accent-grad); border-radius:99px;"></div><div style="position:absolute; right:0; top:0; bottom:0; width:${Math.round(l.enemy / tot * 100)}%; background:linear-gradient(180deg,#5ea0e0,#2a5f9e); border-radius:99px;"></div><div style="position:absolute; left:50%; top:-2px; bottom:-2px; width:2px; background:rgba(255,255,255,.5);"></div></div>
      <div style="display:flex; justify-content:space-between; margin-top:6px;"><span style="font-family:var(--font-num); font-size:10px; color:var(--accent);">${esc(l.mineText)}</span><span style="font-family:var(--font-num); font-size:10px; color:#3a86d4;">${esc(l.enemyText)}</span></div></div>`;
  });

  const panel = { background: 'var(--panel-grad)', border: '1px solid var(--panel-border)', borderRadius: '11px', boxShadow: 'inset 0 0 0 1px var(--hairline), 0 4px 12px rgba(0,0,0,.15)', padding: '14px' };
  const panelHead = { fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: '11px' };
  const leversHTML = forr(view.levers, (l) => {
    const on = s.lever === l.key;
    const rowS = { display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', borderRadius: '11px', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--panel-border)'), background: on ? 'var(--accent-soft)' : 'var(--chip-bg)', boxShadow: on ? 'inset 0 0 0 1px var(--hairline), 0 0 14px var(--accent-soft)' : 'inset 0 0 0 1px var(--hairline)', transition: 'all .15s ease' };
    const iconS = { width: '36px', height: '36px', flex: 'none', borderRadius: '9px', background: on ? 'var(--accent-grad)' : 'var(--track)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#fff' };
    return `<div data-act="lever" data-k="${l.key}" style="${st(rowS)}"><div style="${st(iconS)}">${l.glyph}</div><div style="flex:1; min-width:0;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-heading); font-weight:700; font-size:15px; color:var(--ink);">${esc(l.name)}</span><span style="font-family:var(--font-num); font-size:12px; color:var(--accent);">⚡${l.cost}</span></div><div style="font-size:11px; color:var(--ink-dim); margin-top:3px; line-height:1.35;">${esc(l.desc)}</div></div></div>`;
  });
  const energyPips = [0, 1, 2, 3, 4].map((i) => `<div style="${st({ flex: 1, height: '8px', borderRadius: '99px', background: i < view.energy ? 'var(--accent-grad)' : 'var(--track)', boxShadow: i < view.energy ? '0 0 6px var(--accent-soft)' : 'none' })}"></div>`).join('');
  const laneBtnDefs: [string, string][] = [['top', '上路'], ['mid', '中路'], ['bot', '下路']];
  const laneBtnsHTML = forr(laneBtnDefs, ([key, label], i) => {
    const on = s.lane === key; const ln = view.lanes[i];
    const style = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '9px 6px', borderRadius: '11px', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--btn-edge)'), background: on ? 'var(--accent-grad)' : 'var(--btn-bg)', color: on ? '#fff' : 'var(--btn-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '15px', transition: 'all .15s ease', boxShadow: on ? '0 0 14px var(--accent-soft)' : 'none' };
    return `<button data-act="lane" data-k="${key}" style="${st(style)}">${label}<span style="font-family:var(--font-num); font-size:9px; opacity:.8; color:${on ? '#fff' : 'var(--ink-dim)'};">${esc(ln ? ln.state : '')}</span></button>`;
  });
  const readyBtn = { position: 'relative', overflow: 'hidden', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', cursor: 'pointer', border: 'none', background: 'var(--ready-bg)', color: 'var(--ready-text)', boxShadow: 'var(--ready-shadow)', transition: 'all .15s ease' };
  const LANE_CN: Record<string, string> = { top: '上路', mid: '中路', bot: '下路' };

  return `<div class="gg-root" style="${st(rootStyle)}">
    <div style="margin:0 auto; width:1280px; height:720px; overflow:hidden; border-radius:14px; box-shadow:0 24px 60px rgba(0,0,0,.35);">
    <div style="width:1920px; height:1080px; transform:scale(0.66667); transform-origin:top left; position:relative; overflow:hidden; background:var(--app-bg); color:var(--ink); font-family:var(--font-body);">
      <div style="position:absolute; inset:0; background:var(--texture); pointer-events:none;"></div>
      <div style="position:absolute; top:0; left:0; right:0; height:96px; display:flex; align-items:center; gap:18px; padding:0 30px; background:var(--hud-bg); border-bottom:1px solid var(--panel-border); z-index:8;">
        <div style="display:flex; align-items:center; gap:11px; min-width:280px;"><div style="${st(nexBadgeA)}">♠</div><div style="flex:1;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--ink);">我方老家</span><span style="font-family:var(--font-num); font-size:12px; color:var(--accent);">${view.homeA}/${view.homeAMax}</span></div><div style="height:11px; border-radius:99px; background:var(--track); overflow:hidden; margin-top:5px; border:1px solid var(--panel-border);"><div style="width:${pct(view.homeA, view.homeAMax)}%; height:100%; background:var(--accent-grad); border-radius:99px; box-shadow:0 0 8px var(--accent-soft);"></div></div></div></div>
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;"><div style="${st(phaseBanner)}">${esc(view.phaseText)}</div><div style="display:flex; align-items:center; gap:10px;"><span style="font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-dim);">TIME</span><span style="font-family:var(--font-num); font-size:22px; color:var(--ink);">${esc(view.timeText)}</span></div></div>
        <div style="display:flex; align-items:center; gap:11px; min-width:280px; justify-content:flex-end;"><div style="flex:1;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-num); font-size:12px; color:#3a86d4;">${view.homeB}/${view.homeBMax}</span><span style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--ink);">敌方老家</span></div><div style="height:11px; border-radius:99px; background:var(--track); overflow:hidden; margin-top:5px; border:1px solid var(--panel-border);"><div style="width:${pct(view.homeB, view.homeBMax)}%; height:100%; margin-left:${100 - pct(view.homeB, view.homeBMax)}%; background:linear-gradient(180deg,#5ea0e0,#2a5f9e); border-radius:99px; box-shadow:0 0 8px rgba(58,134,212,.5);"></div></div></div><div style="${st(nexBadgeB)}">${SUITG[view.oppSuit]}</div></div>
      </div>
      <div style="position:absolute; top:112px; left:18px; width:284px; bottom:172px; display:flex; flex-direction:column; gap:11px; overflow-y:auto; padding-right:4px;">
        <div style="display:flex; align-items:center; gap:8px; padding:2px 4px;"><span style="font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--ink-dim);">干预卡 · Levers</span><div style="flex:1;"></div><div style="display:flex; align-items:center; gap:5px; padding:3px 9px; border-radius:99px; background:var(--accent-soft); border:1px solid var(--accent);"><span style="font-size:12px;">⚡</span><span style="font-family:var(--font-num); font-size:12px; color:var(--accent);">${view.energy}</span></div></div>
        <div style="display:flex; flex-direction:column; gap:9px;">${leversHTML}</div>
      </div>
      <div style="position:absolute; top:104px; left:318px; right:318px; bottom:172px; display:flex; flex-direction:column; align-items:center; gap:12px;">
        <div data-act="vpdown" style="${st(viewport)}">
          <div style="${st(world)}">
            <svg viewBox="0 0 3000 1500" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;"><polygon points="1380,-40 1620,-40 1620,1540 1380,1540" fill="rgba(86,150,205,.10)"></polygon><g fill="none" stroke="rgba(238,222,180,.16)" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"><path d="M460,750 Q1500,640 2540,750"></path><path d="M380,650 Q1500,150 2620,650"></path><path d="M380,850 Q1500,1350 2620,850"></path></g><g fill="none" stroke="rgba(238,222,180,.34)" stroke-width="7" stroke-dasharray="40 28" style="animation:gg-dash 1.6s linear infinite;"><path d="M460,750 Q1500,640 2540,750"></path><path d="M380,650 Q1500,150 2620,650"></path><path d="M380,850 Q1500,1350 2620,850"></path></g></svg>
            ${mkNexus(A_POS, '#ff5d2e', 'rgba(255,93,46,.6)', view.homeA, view.homeAMax, '我方老家', '♠')}
            ${mkNexus(B_POS, '#3a86d4', 'rgba(58,134,212,.55)', view.homeB, view.homeBMax, '敌方老家', SUITG[view.oppSuit])}
            ${towersHTML}${unitsHTML}${gatesHTML}
            ${laneLbl(0, -34, '上路')}${laneLbl(1, -70, '中路')}${laneLbl(2, 34, '下路')}
          </div>
          <div style="position:absolute; top:14px; left:14px; display:flex; gap:8px; z-index:5;"><button data-act="focus" data-k="home" style="${st(focusChip)}">⌂ 我方老家</button><button data-act="focus" data-k="fight" style="${st(focusChipOn)}">⚔ 中路团战</button><button data-act="focus" data-k="enemy" style="${st(focusChip)}">⚑ 敌方老家</button><button data-act="focus" data-k="all" style="${st(focusChip)}">▦ 全局</button></div>
          <div style="position:absolute; top:14px; right:14px; display:flex; align-items:center; gap:9px; padding:8px 12px; border-radius:12px; background:rgba(12,16,14,.7); border:1px solid var(--panel-border); z-index:5;"><button data-act="zoom" data-k="out" style="${st({ width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'var(--chip-bg)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' })}">－</button><input type="range" class="gz" min="0.55" max="2.6" step="0.05" value="${Z}" data-act="zoominput" style="${st({ width: '140px', background: 'linear-gradient(90deg,var(--accent) ' + zp + '%, rgba(255,255,255,.25) ' + zp + '%)' })}"><button data-act="zoom" data-k="in" style="${st({ width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'var(--chip-bg)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' })}">＋</button><span style="font-family:var(--font-num); font-size:12px; color:#fff; min-width:42px; text-align:right;">${Math.round(Z * 100)}%</span></div>
          <div style="position:absolute; bottom:14px; left:14px; padding:5px 12px; border-radius:99px; background:rgba(12,16,14,.6); color:rgba(255,255,255,.7); font-size:12px; z-index:5;">🖱 拖拽平移 · 滚轮缩放 · 点「门」开/关捷径</div>
          <div style="position:absolute; bottom:14px; right:14px; width:${mmW}px; height:${mmH}px; border-radius:12px; overflow:hidden; border:2px solid var(--panel-border); box-shadow:0 10px 24px rgba(0,0,0,.5); z-index:6;"><div style="position:absolute; top:6px; left:9px; font-family:var(--font-heading); font-weight:700; font-size:11px; letter-spacing:.1em; color:rgba(255,255,255,.8); z-index:3;">战场全局</div><div style="position:absolute; inset:0; background:var(--arena);">${mmLanesHTML}${mmBlipsHTML}<div style="${st(mmViewRect)}"></div><div data-act="mmdown" style="position:absolute; inset:0; cursor:crosshair;"></div></div></div>
        </div>
      </div>
      <div style="position:absolute; top:112px; right:18px; width:284px; bottom:172px; display:flex; flex-direction:column; gap:11px;">
        <div style="font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--ink-dim); padding:2px 4px;">三路战况 · Lanes</div>
        <div style="display:flex; flex-direction:column; gap:9px;">${lanesHTML}</div>
        <div style="${st(panel)}"><div style="${st(panelHead)}">当前对手</div><div style="display:flex; align-items:center; gap:10px;"><div style="${st({ width: '40px', height: '40px', borderRadius: '11px', flex: 'none', background: 'linear-gradient(160deg,#3a86d4,#2a5f9e)', border: '2px solid #3a86d4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px' })}">${SUITG[view.oppSuit]}</div><div style="flex:1; min-width:0;"><div style="display:flex; align-items:center; gap:6px;"><span style="font-family:var(--font-heading); font-weight:700; font-size:15px; color:var(--ink);">${esc(view.oppName)}</span><span style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(58,134,212,.18); color:#3a86d4; border:1px solid #3a86d466; font-weight:700;">蓝方</span></div><div style="font-size:11px; color:var(--ink-dim); margin-top:3px;">${esc(view.oppPersona)}</div></div></div></div>
        <div style="${st(panel)}"><div style="${st(panelHead)}">台面机关</div><div style="display:flex; align-items:center; gap:11px; padding:9px 11px; border-radius:9px; background:var(--chip-bg); border:1px solid var(--panel-border);"><span style="font-size:18px;">🌪</span><div><div style="font-family:var(--font-heading); font-weight:700; font-size:13px; color:var(--ink);">河道·低重力</div><div style="font-size:11px; color:var(--ink-dim);">过河掷命滞空更久</div></div></div></div>
      </div>
      <div style="position:absolute; left:0; right:0; bottom:0; height:160px; background:var(--dock-bg); border-top:1px solid var(--panel-border); padding:18px 30px; z-index:7; display:flex; align-items:stretch; gap:16px;">
        <div style="display:flex; align-items:center; gap:10px;"><div style="display:flex; align-items:center; gap:9px; padding:0 16px; height:100%; border-radius:14px; background:var(--gold-chip); border:1px solid var(--gold);"><span style="font-size:22px;">◈</span><span style="font-family:var(--font-num); font-size:28px; color:var(--gold);">${view.materials}</span></div><div style="display:flex; flex-direction:column; justify-content:center; gap:7px; padding:0 16px; height:100%; border-radius:14px; background:var(--chip-bg); border:1px solid var(--panel-border); min-width:150px;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--ink);">干预能量</span><span style="font-family:var(--font-num); font-size:11px; color:var(--accent);">${view.energy}/${view.energyMax}</span></div><div style="display:flex; gap:5px;">${energyPips}</div></div></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:9px; justify-content:center; padding:0 18px; border-radius:16px; background:var(--accent-soft); border:1px solid var(--accent); box-shadow:inset 0 0 0 1px var(--hairline);"><div style="display:flex; align-items:center; gap:10px;"><span style="font-family:var(--font-heading); font-weight:700; font-size:18px; color:var(--accent); letter-spacing:.03em;">选路派牌</span><span style="font-size:12px; color:var(--ink-dim);">把牌派往一路推进,接敌即掷命</span></div><div style="display:flex; gap:10px;">${laneBtnsHTML}</div></div>
        <div style="width:210px; flex:none; display:flex; flex-direction:column; gap:8px;"><button data-act="ready" style="${st(readyBtn)}"><span style="position:absolute; inset:0; border-radius:inherit; background:linear-gradient(110deg,transparent 36%,rgba(255,255,255,.4) 50%,transparent 64%); background-size:230% 100%; animation:gg-shimmer 3s ease-in-out infinite; pointer-events:none;"></span><span style="position:relative; font-family:var(--font-heading); font-weight:700; font-size:24px; letter-spacing:.08em;">派牌出战</span><span style="position:relative; font-size:11px; letter-spacing:.22em; opacity:.85; margin-top:2px;">DEPLOY · ${esc(LANE_CN[s.lane])}</span></button></div>
      </div>
    </div></div></div>`;
}

// 挂载：把设计稿渲进 host，wire 相机/门/聚焦等交互；update() 每帧从 getView() 拉真数据重渲。
export function mountBattle(host: HTMLElement, getView: () => BattleView): { update: () => void; destroy: () => void } {
  if (!document.getElementById('gg-battle-css')) { const s = document.createElement('style'); s.id = 'gg-battle-css'; s.textContent = CSS; document.head.appendChild(s); }
  const W = 3000, H = 1500, VPW = 1284, VPH = 612, OUT = 0.66667;
  const state: CamState = { theme: 'onyx', lever: 'bless', lane: 'mid', zoom: 0.85, camX: 1500, camY: 750, gates: { g1: true, g2: false } };
  let drag: { mx: number; my: number; cx: number; cy: number } | null = null;
  let mm: HTMLElement | null = null;
  const clampAxis = (c: number, world: number, vp: number, z: number): number => { const half = vp / (2 * z); if (2 * half >= world) return world / 2; return Math.max(half, Math.min(world - half, c)); };
  const setCam = (x: number, y: number): void => { state.camX = clampAxis(x, W, VPW, state.zoom); state.camY = clampAxis(y, H, VPH, state.zoom); render(); };
  const setView = (x: number, y: number, z: number): void => { state.zoom = Math.max(0.55, Math.min(2.6, z)); setCam(x, y); };
  const render = (): void => { host.innerHTML = buildHTML(getView(), state); };

  const onClick = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act === 'lever') { state.lever = k; render(); }
    else if (act === 'lane') { state.lane = k; render(); }
    else if (act === 'gate') { state.gates[k] = !state.gates[k]; render(); }
    else if (act === 'zoom') setView(state.camX, state.camY, state.zoom + (k === 'in' ? 0.2 : -0.2));
    else if (act === 'focus') { if (k === 'home') setView(A_POS[0] + 260, 750, 1.5); else if (k === 'fight') setView(laneAt(1, 0.5)[0], laneAt(1, 0.5)[1], 1.4); else if (k === 'enemy') setView(B_POS[0] - 260, 750, 1.5); else setView(1500, 750, 0.55); }
  };
  const onInput = (e: Event): void => { const el = e.target as HTMLInputElement; if (el.dataset && el.dataset.act === 'zoominput') setView(state.camX, state.camY, parseFloat(el.value)); };
  const onWheel = (e: WheelEvent): void => { if ((e.target as HTMLElement).closest('[data-act="vpdown"]')) { e.preventDefault(); setView(state.camX, state.camY, state.zoom * (e.deltaY < 0 ? 1.12 : 0.89)); } };
  const onDown = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="mmdown"]')) { mm = t.closest('[data-act="mmdown"]'); mmTo(e); }
    else if (t.closest('[data-act="vpdown"]')) drag = { mx: e.clientX, my: e.clientY, cx: state.camX, cy: state.camY };
  };
  const mmTo = (e: MouseEvent): void => { if (!mm) return; const r = mm.getBoundingClientRect(); setCam((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); };
  const onMove = (e: MouseEvent): void => { if (drag) { const kf = OUT * state.zoom; setCam(drag.cx - (e.clientX - drag.mx) / kf, drag.cy - (e.clientY - drag.my) / kf); } else if (mm) mmTo(e); };
  const onUp = (): void => { drag = null; mm = null; };

  host.addEventListener('click', onClick); host.addEventListener('input', onInput);
  host.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  render();
  return {
    update: render,
    destroy: () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); host.replaceChildren(); },
  };
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Rajdhani:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@500;700;900&family=Zhi+Mang+Xing&family=Ma+Shan+Zheng&display=swap" rel="stylesheet">';

// 离线"看帧"：自包含 HTML 文档（CSS + 字体 + 真渲染器 buildHTML 输出）。浏览器直接开 = 真游戏战斗屏渲染。
// 容器内确定性生成（同 game-f frameSvg），可 toMatchFileSnapshot 做无头视觉回归 golden。theme 缺省玄铁。
export function renderBattleDoc(view: BattleView, theme: 'onyx' | 'brocade' = 'onyx'): string {
  const s: CamState = { theme, lever: 'bless', lane: 'mid', zoom: 0.85, camX: 1500, camY: 750, gates: { g1: true, g2: false } };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${FONTS}<style>body{margin:0;background:#0a0d12;display:flex;justify-content:center;}${CSS}</style></head><body>${buildHTML(view, s)}</body></html>`;
}
