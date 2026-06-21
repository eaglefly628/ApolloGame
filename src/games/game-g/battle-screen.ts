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
export interface BattleUnit { id: string; lane: number; side: 'a' | 'b'; pos01: number; revealed: boolean; faceUp: boolean; rank: string; suit: 's' | 'h' | 'd' | 'c'; general: boolean; fogged: boolean }
// 手牌（底部坞展示·点选派往三路）：rank/suit/将；id 供出牌回调定位。
export interface HandCardView { id: string; rank: string; suit: 's' | 'h' | 'd' | 'c'; general: boolean }
// 天罡（法术）手牌：名 + id（cost 是摸牌时花的点数·固定·见 BattleView.tengangDrawCost，故牌上不带 cost）。
export interface TengangCardView { id: string; name: string }
export interface BattleLane { name: string; mine: number; enemy: number; lead: 'a' | 'b' | 'n'; state: string; mineText: string; enemyText: string }
export interface BattleLever { key: string; glyph: string; name: string; cost: number; desc: string; on?: boolean }
// 对决特写（owner：拉到屏幕前·战斗表演）：两张牌放大 + 点数/加成/战力计算 + 胜率区间条 + 掷点落区间 → 生/死翻转。
export interface ClashCardView { rank: string; suit: 's' | 'h' | 'd' | 'c'; general: boolean; points: number; buff: number; morale: number; tengang: number; pEff: number }
export interface ClashView { lane: number; winrate: number; roll: number; aWins: boolean; tie: 'points' | 'stamina' | 'roll' | null; a: ClashCardView; b: ClashCardView }
// 板上瞬时特效（A6 死亡闪帧 / A2 出牌啪嗒 —— 纯表现 juice）：t∈[0,1] 由驱动层按真实时间算好的淡出进度，渲染器只如实画当下那一帧
//   （故每帧重画 innerHTML 也连续，不靠会被重渲打断的 CSS 关键帧）。kind=death → 斩残影(石板+斩，外扩红环淡出·延续 overlay→棋盘)；
//   kind=deploy → 入场啪嗒(己橙/敌蓝环放大淡出)。位置同兵 = laneAt(lane, pos01)。不进 hash、不改判定（同 ThreeRenderer 固定解释器）。
export interface BattleFx { kind: 'death' | 'deploy'; lane: number; side: 'a' | 'b'; pos01: number; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; general?: boolean; t: number }
export interface BattleView {
  homeA: number; homeAMax: number; homeB: number; homeBMax: number;
  oppName: string; oppPersona: string; oppSuit: 's' | 'h' | 'd' | 'c';
  energy: number; energyMax: number; materials: number;
  phaseText: string; timeText: string;
  levers: BattleLever[]; lanes: BattleLane[]; units: BattleUnit[];
  // CR 局内经济层（doc21 · 抄皇室战争）：点数(召唤源泉)随真实时间回复 → 花点数摸牌(玩家选库) → 普通部署三路 / 天罡施法。砍读秒暂停。
  hand: HandCardView[]; selectedCard: number; deckCount: number; // 普通手牌(可囤积) / 选中(-1 无) / 普通库余量
  tengang: TengangCardView[]; selectedTengang: number; tengangDeckCount: number; // 天罡手牌(法术·cap5) / 选中(-1 无) / 天罡库可摸余量
  points: number; pointsMax: number; // 点数池(召唤源泉·回复) / 上限
  normalDrawCost: number; tengangDrawCost: number; canDrawNormal: boolean; canDrawTengang: boolean; // 摸牌花点数 + 是否可摸(点数够 & 未到上限 & 库有)
  migrateSource: number; // 三路兵力迁移：已选迁出路(-1 无 · 无选中牌时点路 = 迁移模式)
  clash?: ClashView | null; // 非空 → 叠加对决特写表演（冻结战场、放大两牌、读数、掷点定生死）
  encounter?: ClashView | null; // 非空 → 叠加「遭遇」前奏（两张牌战场相遇·知道谁和谁打·在哪条路·先于 clash 特写）
  fx?: BattleFx[]; // 板上瞬时特效（斩残影 / 出牌啪嗒）—— 缺省无；纯表现 juice
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
@keyframes gg-clashin { 0% { transform: scale(.82); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes gg-clashL { 0% { transform: translateX(-120px) rotate(-12deg); opacity: 0; } 100% { transform: translateX(0) rotate(0); opacity: 1; } }
@keyframes gg-clashR { 0% { transform: translateX(120px) rotate(12deg); opacity: 0; } 100% { transform: translateX(0) rotate(0); opacity: 1; } }
@keyframes gg-rolldrop { 0% { top: -70px; opacity: 0; } 55% { opacity: 1; } 78% { top: -2px; } 100% { top: -14px; } }
@keyframes gg-winglow { 0%,100% { box-shadow: 0 0 26px var(--gold), 0 12px 30px rgba(0,0,0,.6); } 50% { box-shadow: 0 0 54px var(--gold), 0 12px 30px rgba(0,0,0,.6); } }
@keyframes gg-flip-win { 0% { transform: rotateY(0) scale(1); } 55% { transform: rotateY(200deg) scale(1.07); } 100% { transform: rotateY(360deg) scale(1); } }
@keyframes gg-flip-lose { 0% { transform: rotateY(0); } 100% { transform: rotateY(180deg); } }
@keyframes gg-spark { 0%,100% { opacity:.55; transform:translate(-50%,-50%) scale(1);} 50% { opacity:1; transform:translate(-50%,-50%) scale(1.14);} }
@keyframes gg-rays { to { transform:translate(-50%,-50%) rotate(360deg); } }
@keyframes gg-emblem { 0% { transform:translate(-50%,-50%) scale(.5); opacity:0;} 55% { transform:translate(-50%,-50%) scale(1.16); opacity:1;} 100% { transform:translate(-50%,-50%) scale(1); opacity:1;} }
@keyframes gg-burst { 0% { transform:translate(-50%,-50%) scale(.2); opacity:.9;} 100% { transform:translate(-50%,-50%) scale(2.4); opacity:0;} }
@keyframes gg-flash { 0% { opacity:0;} 12% { opacity:1;} 100% { opacity:0;} }
@keyframes gg-fatebob { 0%,100% { transform:translateY(0) rotate(-10deg);} 50% { transform:translateY(-14px) rotate(10deg);} }
@keyframes gg-fatedrop { 0% { top:-180px; opacity:0; } 40% { opacity:1; } 100% { top:-2px; opacity:1; } }
@keyframes gg-shatter { 0%,100% { transform:translate(0,0) rotate(0);} 20% { transform:translate(-5px,3px) rotate(-1.6deg);} 60% { transform:translate(5px,-2px) rotate(1.6deg);} }
@keyframes gg-cardflip { 0% { transform:rotateY(180deg);} 100% { transform:rotateY(0);} }
@keyframes gg-enc-l { 0% { transform:translateX(-280px) rotate(-9deg); opacity:0; } 100% { transform:translateX(0) rotate(0); opacity:1; } }
@keyframes gg-enc-r { 0% { transform:translateX(280px) rotate(9deg); opacity:0; } 100% { transform:translateX(0) rotate(0); opacity:1; } }
@keyframes gg-enc-pop { 0% { transform:scale(.4); opacity:0; } 60% { transform:scale(1.16); opacity:1; } 100% { transform:scale(1); opacity:1; } }
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

interface CamState { theme: string; lane: string; zoom: number; camX: number; camY: number; gates: Record<string, boolean> }

// 对决特写 —— 忠实复刻 owner 委托 Core Design 的「Game G 对决特写.dc.html」（与本渲染器同 1920×1080 画布·坐标直用）。
// 冻结战场 = 我们真棋盘在后（本层做暗化舞台）；入场/翻牌/掷命/定格用 CSS 一次播完（配合 showMatch 演出期定格一次渲染）。
// 三态：我方胜(活·金爆)/我方负(斩·红斩+碎)/平局裁定(50:50·点数大者胜·不掷命)。双皮玄铁(暗)/锦霞(亮)。英雄立绘/生肖=占位(doc22·暂用花色字)。
function clashCloseup(cv: ClashView, theme: string): string {
  const onyx = theme !== 'brocade';
  const T = onyx
    ? { ink: '#eaf0f6', dim: '#8493a3', gold: '#f0d488', goldGrad: 'linear-gradient(180deg,#ffe9a8,#c89a42)', accent: '#ff7a45', accentGrad: 'linear-gradient(180deg,#ff8d5a,#ee5a25)', accentSoft: 'rgba(255,122,69,.2)', stageBg: 'radial-gradient(72% 64% at 50% 36%,#1b2638 0%,#0d1420 52%,#070b12 100%)', stageBd: '#3a526e', stageGlow: 'rgba(240,212,136,.16)', vig: 'radial-gradient(60% 58% at 50% 42%,transparent 38%,rgba(0,0,0,.74) 100%)', ray: 'rgba(255,214,140,.06)', spot: 'rgba(255,221,150,.12)', panel: 'linear-gradient(180deg,rgba(26,38,54,.9),rgba(14,22,34,.94))', panelBd: '#37506c', hair: 'rgba(240,212,136,.18)', track: 'rgba(0,0,0,.55)', cardFace: 'linear-gradient(158deg,#fcf9f1,#e6d8bd)', cardBack: 'linear-gradient(150deg,#1f2f44,#13202f)', backPat: 'rgba(240,212,136,.5)', fd: "'Zhi Mang Xing',cursive", fh: "'Rajdhani',sans-serif", fb: "'Noto Sans SC',sans-serif", fn: "'Silkscreen',monospace" }
    : { ink: '#5a3f44', dim: '#9a7a7e', gold: '#b9842f', goldGrad: 'linear-gradient(180deg,#f3e2a4,#cf9a3f)', accent: '#cf5070', accentGrad: 'linear-gradient(180deg,#e887a0,#cf5070)', accentSoft: 'rgba(207,80,112,.18)', stageBg: 'radial-gradient(72% 64% at 50% 34%,#fbeede 0%,#f0d2c8 54%,#d49a98 100%)', stageBd: '#e0b890', stageGlow: 'rgba(185,132,47,.22)', vig: 'radial-gradient(60% 58% at 50% 42%,transparent 42%,rgba(110,40,48,.5) 100%)', ray: 'rgba(255,255,255,.16)', spot: 'rgba(255,255,255,.28)', panel: 'linear-gradient(180deg,rgba(255,250,243,.95),rgba(250,234,222,.97))', panelBd: '#e0b890', hair: 'rgba(185,132,47,.4)', track: 'rgba(150,90,80,.2)', cardFace: 'linear-gradient(158deg,#fffdf8,#f1e2cf)', cardBack: 'linear-gradient(150deg,#c0566f,#9c3f57)', backPat: 'rgba(255,240,220,.6)', fd: "'Ma Shan Zheng',cursive", fh: "'Cormorant Garamond',serif", fb: "'Noto Serif SC',serif", fn: "'Silkscreen',monospace" };
  const sgC: Record<string, string> = { s: '#22303f', h: '#c0392b', d: '#c0651a', c: '#2d6a3f' };
  const sgG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const LN = ['上路', '中路', '下路'][cv.lane] ?? '';
  const laneCol = cv.lane === 0 ? '#ff7a45' : cv.lane === 1 ? '#e0973a' : '#46c6ff';
  const wrPct = Math.round(cv.winrate * 100), foePct = 100 - wrPct, rollPct = Math.round(cv.roll * 100);
  const isTie = cv.tie === 'points' || cv.tie === 'stamina';
  const isWin = !isTie && cv.aWins, isLose = !isTie && !cv.aWins;
  const sgn = (n: number): string => (n >= 0 ? '+' + n : String(n));
  const sideCard = (c: ClashCardView, mine: boolean, won: boolean, dead: boolean): string => {
    const teamCol = mine ? T.accent : '#3a86d4', sc = sgC[c.suit], tilt = mine ? -6 : 6;
    const rows: [string, string, number][] = [['点', '点数(公平基础)', c.points], ['营', '经营(养成)', c.buff], ['罡', '天罡(法术)', c.tengang], ['气', '士气(主将)', c.morale]];
    const rowsHTML = rows.map(([tag, label, num]) => `<div style="display:flex;align-items:center;gap:10px;padding:4px 0;"><span style="width:28px;height:28px;flex:none;border-radius:7px;background:${mine ? T.accentSoft : 'rgba(58,134,212,.18)'};display:flex;align-items:center;justify-content:center;font-family:${T.fb};font-weight:700;font-size:13px;color:${teamCol};">${tag}</span><span style="flex:1;font-size:14px;color:${T.dim};">${label}</span><span style="font-family:${T.fn};font-size:16px;color:${T.ink};">${sgn(num)}</span></div>`).join('');
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;width:378px;flex:none;animation:${mine ? 'gg-clashL' : 'gg-clashR'} .5s cubic-bezier(.2,.8,.3,1) both${dead ? ',gg-shatter .4s ease 1s 2' : ''};${dead ? 'filter:grayscale(.55) brightness(.62);opacity:.62;' : ''}">
      <div style="position:relative;perspective:1300px;transform:rotate(${tilt}deg);">
        <div style="position:relative;width:188px;height:264px;transform-style:preserve-3d;animation:gg-cardflip .65s cubic-bezier(.4,.1,.2,1) .3s both;box-shadow:${won ? '0 0 56px ' + T.accentSoft + ',0 22px 44px rgba(0,0,0,.6)' : '0 22px 44px rgba(0,0,0,.6)'};">
          <div style="position:absolute;inset:0;border-radius:15px;background:${T.cardBack};border:4px solid #fff;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);background-image:repeating-linear-gradient(45deg,${T.backPat} 0 7px,transparent 7px 15px);"></div>
          <div style="position:absolute;inset:0;border-radius:15px;background:${T.cardFace};border:4px solid ${won ? teamCol : '#fff'};backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;top:9px;left:11px;font-family:${T.fh};font-weight:700;font-size:23px;line-height:.84;color:${sc};text-align:center;">${esc(c.rank)}<br>${sgG[c.suit]}</div>
            ${c.general ? `<div style="position:absolute;top:48px;right:10px;padding:2px 8px;border-radius:99px;background:${T.goldGrad};color:#2a1a08;font-family:${T.fh};font-weight:700;font-size:11px;">♔ 主将</div>` : ''}
            <div style="font-family:${T.fd};font-size:120px;color:${sc};text-shadow:0 4px 12px rgba(0,0,0,.25);">${sgG[c.suit]}</div>
            <div style="position:absolute;bottom:9px;right:11px;font-family:${T.fh};font-weight:700;font-size:23px;line-height:.84;color:${sc};text-align:center;transform:rotate(180deg);">${esc(c.rank)}<br>${sgG[c.suit]}</div>
          </div>
        </div>
        ${c.general ? `<div style="position:absolute;top:-36px;left:50%;transform:translateX(-50%);font-size:38px;color:${T.gold};text-shadow:0 2px 10px rgba(0,0,0,.6);">♔</div>` : ''}
      </div>
      <div style="width:358px;padding:14px 16px;border-radius:13px;background:${T.panel};border:1px solid ${won ? teamCol : T.panelBd};box-shadow:inset 0 0 0 1px ${T.hair},0 10px 24px rgba(0,0,0,.4);animation:gg-clashin .5s ease .25s both;">
        <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${mine ? T.accent : '#3a86d4'};margin-bottom:7px;font-weight:700;">${mine ? '我方' : '敌方'} · 战力拆解</div>
        ${rowsHTML}
        <div style="display:flex;align-items:center;margin-top:7px;padding-top:9px;border-top:1px solid ${T.panelBd};"><span style="flex:1;font-family:${T.fh};font-weight:700;font-size:16px;color:${T.ink};">＝ 战力</span><span style="font-family:${T.fn};font-size:23px;color:${mine ? T.accent : '#3a86d4'};">${c.pEff}</span></div>
      </div>
    </div>`;
  };
  const mineWon = isTie ? cv.aWins : isWin, foeWon = isTie ? !cv.aWins : isLose;
  const mineDead = !isTie && isLose, foeDead = !isTie && isWin;
  const fateMarker = isTie ? '' : `<div style="position:absolute;left:${rollPct}%;top:-2px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:9;animation:gg-fatedrop .6s cubic-bezier(.4,.1,.3,1) 1.1s both;"><div style="width:3px;height:46px;background:${T.gold};box-shadow:0 0 10px ${T.gold};margin-bottom:-4px;"></div><div style="width:26px;height:58px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#c0452f,#7d2a1e);border:2px solid ${T.gold};display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px ${T.accentSoft};"><span style="font-family:${T.fd};font-size:20px;color:#ffe9a8;writing-mode:vertical-rl;">命</span></div></div>`;
  const tieReason = cv.tie === 'stamina' ? '续航高者胜' : '点数大者胜';
  const winnerRank = (cv.aWins ? cv.a : cv.b).rank;
  const emblem = isTie
    ? `<div style="font-family:${T.fd};font-size:76px;color:${T.gold};line-height:1;text-shadow:0 4px 22px rgba(0,0,0,.7);">平 · 裁定</div><div style="font-family:${T.fh};font-weight:700;font-size:19px;color:#fff;margin-top:7px;">战力相等 50:50 · 不掷命 · ${tieReason}</div><div style="font-family:${T.fh};font-weight:700;font-size:16px;color:${T.gold};margin-top:5px;">${cv.aWins ? '我方' : '敌方'} ${esc(winnerRank)} 胜</div>`
    : isWin
      ? `<div style="position:absolute;top:50%;left:50%;width:300px;height:300px;border-radius:50%;border:6px solid rgba(255,220,120,.8);transform:translate(-50%,-50%);animation:gg-burst 1s ease-out 1.7s infinite;"></div><div style="position:absolute;top:50%;left:50%;width:440px;height:440px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,205,90,.55),transparent 64%);"></div><div style="position:relative;font-family:${T.fd};font-size:116px;line-height:1;color:#ffe9a8;text-shadow:0 0 46px rgba(255,205,90,.95),0 4px 18px rgba(0,0,0,.6);">活</div><div style="position:relative;font-family:${T.fh};font-weight:700;font-size:21px;color:#fff;letter-spacing:.06em;margin-top:5px;">我方${esc(cv.a.rank)} 翻正 · 英雄显形</div>`
      : `<div style="position:absolute;top:50%;left:50%;width:480px;height:480px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,40,60,.5),transparent 64%);"></div><div style="position:absolute;top:50%;left:50%;width:560px;height:10px;transform:translate(-50%,-50%) rotate(-32deg);background:linear-gradient(90deg,transparent,#ff2f3c,#fff,#ff2f3c,transparent);box-shadow:0 0 26px rgba(255,40,60,.9);border-radius:99px;"></div><div style="position:relative;font-family:${T.fd};font-size:138px;line-height:1;color:#ff2f3c;text-shadow:0 0 50px rgba(255,40,60,.95),0 4px 18px rgba(0,0,0,.7);">斩</div><div style="position:relative;font-family:${T.fh};font-weight:700;font-size:21px;color:#ffd9dc;letter-spacing:.06em;margin-top:5px;">我方${esc(cv.a.rank)} 阵亡 · 该路溃退</div>`;
  return `<div style="position:absolute;inset:0;z-index:30;font-family:${T.fb};">
    <div style="position:absolute;inset:0;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);background:radial-gradient(60% 60% at 50% 44%,${isLose ? 'rgba(120,10,16,.45)' : 'rgba(0,0,0,.4)'},rgba(0,0,0,.82));"></div>
    <div style="position:absolute;top:120px;left:260px;width:1400px;height:786px;border-radius:26px;overflow:hidden;background:${T.stageBg};border:2px solid ${T.stageBd};box-shadow:0 30px 90px rgba(0,0,0,.7),0 0 60px ${T.stageGlow},inset 0 0 0 1px ${T.hair};animation:gg-clashin .5s cubic-bezier(.2,.8,.3,1) both;">
      <div style="position:absolute;inset:0;background:${T.vig};pointer-events:none;z-index:2;"></div>
      <div style="position:absolute;top:40%;left:50%;width:1200px;height:1200px;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,${T.ray} 0deg 5deg,transparent 5deg 16deg);animation:gg-rays 60s linear infinite;opacity:${isLose ? '.4' : '1'};pointer-events:none;z-index:1;"></div>
      <div style="position:absolute;bottom:120px;left:50%;width:1100px;height:260px;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 50%,${T.spot},transparent 72%);pointer-events:none;z-index:1;"></div>
      <div style="position:absolute;top:24px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:7px;z-index:6;">
        <div style="display:flex;align-items:center;gap:8px;padding:6px 18px;border-radius:99px;background:rgba(8,12,18,.6);border:1px solid ${laneCol};color:#fff;font-family:${T.fh};font-weight:700;font-size:16px;letter-spacing:.06em;"><span style="width:10px;height:10px;border-radius:50%;background:${laneCol};box-shadow:0 0 10px ${laneCol};"></span>${LN} · 前锋相遇</div>
        <div style="font-family:${T.fd};font-size:34px;color:${T.gold};letter-spacing:.06em;text-shadow:0 3px 14px rgba(0,0,0,.6);">命运一掷</div>
      </div>
      <div style="position:absolute;top:118px;left:0;right:0;height:340px;display:flex;align-items:center;justify-content:center;z-index:4;">
        ${sideCard(cv.a, true, mineWon, mineDead)}
        <div style="position:relative;width:120px;flex:none;display:flex;align-items:center;justify-content:center;z-index:5;">
          <div style="position:absolute;top:50%;left:50%;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(255,235,160,.9),rgba(255,150,40,.4) 45%,transparent 72%);transform:translate(-50%,-50%);animation:gg-spark 1.2s ease-in-out infinite;${isLose ? 'filter:hue-rotate(-45deg) saturate(1.4);' : ''}"></div>
          <div style="position:relative;width:72px;height:72px;border-radius:50%;background:${T.goldGrad};display:flex;align-items:center;justify-content:center;color:#2a1a08;box-shadow:0 0 26px rgba(240,212,136,.6),inset 0 2px 0 rgba(255,255,255,.5);border:3px solid #fff;"><span style="font-family:${T.fd};font-size:34px;">${isTie ? '裁' : '掷'}</span></div>
        </div>
        ${sideCard(cv.b, false, foeWon, foeDead)}
      </div>
      <div style="position:absolute;bottom:50px;left:50%;transform:translateX(-50%);width:1180px;z-index:6;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:9px;">
          <div style="display:flex;align-items:baseline;gap:8px;"><span style="font-family:${T.fh};font-weight:700;font-size:16px;color:${T.accent};">我方</span><span style="font-family:${T.fn};font-size:26px;color:${T.accent};">${wrPct}%</span></div>
          <div style="text-align:center;"><div style="font-size:11px;letter-spacing:.16em;color:${T.dim};text-transform:uppercase;">胜率区间 · 战力差 → 概率</div><div style="font-size:10px;color:${T.dim};margin-top:2px;">保留 3%–97% 爆冷缝 · 弱者亦可翻盘</div></div>
          <div style="display:flex;align-items:baseline;gap:8px;"><span style="font-family:${T.fn};font-size:26px;color:#3a86d4;">${foePct}%</span><span style="font-family:${T.fh};font-weight:700;font-size:16px;color:#3a86d4;">敌方</span></div>
        </div>
        <div style="position:relative;height:30px;border-radius:99px;background:${T.track};border:1px solid ${T.panelBd};box-shadow:inset 0 2px 8px rgba(0,0,0,.4);">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${wrPct}%;border-radius:99px 0 0 99px;background:${T.accentGrad};box-shadow:0 0 16px ${T.accentSoft};"></div>
          <div style="position:absolute;right:0;top:0;bottom:0;width:${foePct}%;border-radius:0 99px 99px 0;background:linear-gradient(180deg,#5ea0e0,#2a5f9e);"></div>
          <div style="position:absolute;top:-5px;bottom:-5px;left:3%;width:2px;background:rgba(255,255,255,.6);"></div>
          <div style="position:absolute;top:-5px;bottom:-5px;left:97%;width:2px;background:rgba(255,255,255,.6);"></div>
          ${fateMarker}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:${T.dim};"><span>3% 底缝</span><span style="font-family:${T.fn};font-size:11px;color:${T.gold};">${isTie ? '平局裁定 · 不掷命' : '命点 ' + rollPct + ' / 100 · 落于' + (rollPct <= wrPct ? '我方侧 → 活' : '敌方侧 → 斩')}</span><span>97% 顶缝</span></div>
      </div>
      <div style="position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;text-align:center;z-index:10;animation:gg-emblem .6s cubic-bezier(.2,.9,.3,1) 1.6s both;pointer-events:none;">${emblem}</div>
    </div>
  </div>`;
}

// 「遭遇」前奏（owner：开打前看清谁和谁打、在哪条路）—— 两张牌在该路战场相遇·左右滑入对撞 + ⚔ + 路名；先于 clashCloseup 演 ENCOUNTER_MS。纯表现·不入 hash。
function clashEncounter(cv: ClashView, theme: string): string {
  const onyx = theme !== 'brocade';
  const gold = onyx ? '#f0d488' : '#b9842f';
  const fh = onyx ? "'Rajdhani',sans-serif" : "'Cormorant Garamond',serif";
  const fd = onyx ? "'Zhi Mang Xing',cursive" : "'Ma Shan Zheng',cursive";
  const sgc: Record<string, string> = { s: '#22303f', h: '#c0392b', d: '#c0651a', c: '#2d6a3f' };
  const sgg: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const LN = ['上路', '中路', '下路'][cv.lane] ?? '';
  const laneCol = cv.lane === 0 ? '#ff7a45' : cv.lane === 1 ? '#e0973a' : '#46c6ff';
  const laneY = [330, 510, 690][cv.lane] ?? 510; // 该路在 1080 画布的纵向锚（上/中/下 → 看清在哪条路）
  const mini = (c: ClashCardView, mine: boolean): string => {
    const sc = sgc[c.suit], team = mine ? '#ff7a45' : '#3a86d4';
    return `<div style="animation:${mine ? 'gg-enc-l' : 'gg-enc-r'} .42s cubic-bezier(.2,.8,.3,1) both;display:flex;flex-direction:column;align-items:center;gap:9px;">
      <div style="position:relative;width:152px;height:212px;border-radius:14px;background:linear-gradient(158deg,#fcf9f1,#e6d8bd);border:4px solid ${team};box-shadow:0 18px 38px rgba(0,0,0,.6),0 0 34px ${mine ? 'rgba(255,122,69,.45)' : 'rgba(58,134,212,.45)'};display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <div style="position:absolute;top:9px;left:12px;font-family:${fh};font-weight:700;font-size:30px;line-height:.82;color:${sc};text-align:center;">${esc(c.rank)}<br>${sgg[c.suit]}</div>
        <div style="font-family:${fd};font-size:98px;color:${sc};text-shadow:0 3px 9px rgba(0,0,0,.22);">${sgg[c.suit]}</div>
        ${c.general ? `<div style="position:absolute;top:-32px;left:50%;transform:translateX(-50%);font-size:36px;color:${gold};text-shadow:0 2px 8px rgba(0,0,0,.6);">♔</div>` : ''}
        <div style="position:absolute;bottom:9px;right:12px;font-family:${fh};font-weight:700;font-size:30px;line-height:.82;color:${sc};text-align:center;transform:rotate(180deg);">${esc(c.rank)}<br>${sgg[c.suit]}</div>
      </div>
      <div style="padding:4px 16px;border-radius:99px;background:${mine ? 'rgba(255,122,69,.2)' : 'rgba(58,134,212,.2)'};border:1px solid ${team};color:${team};font-family:${fh};font-weight:700;font-size:14px;">${mine ? '我方' : '敌方'}</div>
    </div>`;
  };
  return `<div style="position:absolute;inset:0;z-index:28;pointer-events:none;font-family:${fh};">
    <div style="position:absolute;inset:0;background:radial-gradient(58% 46% at 50% ${((laneY / 1080) * 100).toFixed(1)}%,rgba(4,7,12,.28),rgba(4,7,12,.72));animation:gg-clashin .26s ease both;"></div>
    <div style="position:absolute;left:0;right:0;top:${laneY}px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;gap:48px;">
      ${mini(cv.a, true)}
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;animation:gg-enc-pop .4s cubic-bezier(.2,1.5,.4,1) both;">
        <div style="display:flex;align-items:center;gap:9px;padding:8px 22px;border-radius:99px;background:rgba(8,12,18,.72);border:1px solid ${laneCol};color:#fff;font-weight:700;font-size:19px;letter-spacing:.08em;"><span style="width:11px;height:11px;border-radius:50%;background:${laneCol};box-shadow:0 0 12px ${laneCol};"></span>${LN} · 遭遇</div>
        <div style="position:relative;width:104px;height:104px;border-radius:50%;background:radial-gradient(circle,rgba(255,236,164,.95),rgba(255,150,40,.42) 50%,transparent 74%);display:flex;align-items:center;justify-content:center;"><span style="font-size:58px;filter:drop-shadow(0 3px 7px rgba(0,0,0,.55));">⚔</span></div>
        <div style="font-family:'Silkscreen',monospace;font-size:17px;color:${gold};letter-spacing:.12em;">VS</div>
      </div>
      ${mini(cv.b, false)}
    </div>
  </div>`;
}

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
    if (!u.revealed) { // 附魔·迷雾牌面朝下行军（owner：默认无迷雾 → 走这里的只剩 fogged 附魔牌）；过线即 3D 翻显形（gg-reveal）。紫雾皮 + ✦ 标记区分。
      const trim = u.side === 'a' ? '#a16207' : '#0e7490';
      return `<div style="${st(Object.assign({}, base, { background: 'linear-gradient(160deg,#3b2a5e,#241640)', border: '4px solid ' + (u.general ? trim : '#7c5cc4'), boxShadow: '0 8px 18px rgba(0,0,0,.5), 0 0 14px rgba(140,110,230,.55)' }))}"><div style="position:absolute; inset:8px; border-radius:6px; border:2px solid rgba(190,170,255,.5); background:repeating-linear-gradient(45deg, rgba(190,170,255,.18) 0 8px, transparent 8px 16px), repeating-linear-gradient(-45deg, rgba(190,170,255,.18) 0 8px, transparent 8px 16px);"></div><span style="position:absolute; font-size:26px; color:#c9b6ff;">✦</span>${u.general ? `<span style="position:absolute; top:-22px; font-size:30px; color:${trim};">♔</span>` : ''}</div>`;
    }
    if (u.faceUp) { // 揭晓·活
      return `<div style="${st(Object.assign({}, base, { background: 'linear-gradient(160deg,#fbf7ef,#e9dcc6)', border: (u.general ? 6 : 4) + 'px solid ' + cc, boxShadow: '0 8px 18px rgba(0,0,0,.5), 0 0 18px ' + cc + '55, inset 0 0 0 2px rgba(255,255,255,.6)' }))}"><div style="position:absolute; top:5px; left:8px; font-family:var(--font-heading); font-weight:700; font-size:21px; color:${SUITC[u.suit]};">${esc(u.rank)}</div><span style="font-size:42px; color:${SUITC[u.suit]};">${SUITG[u.suit]}</span>${u.general ? '<span style="position:absolute; top:-22px; font-size:30px; color:var(--gold);">♔</span>' : ''}</div>`;
    }
    // 揭晓·死（石板压暗 + 主将红斩）
    return `<div style="${st(Object.assign({}, base, { background: '#9c3324', border: '4px solid var(--danger)', opacity: '.9', boxShadow: '0 8px 18px rgba(0,0,0,.5)' }))}"><div style="position:absolute; inset:9px; border-radius:6px; border:2px solid rgba(255,255,255,.35); background:repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 8px, transparent 8px 16px);"></div>${u.general ? '<span style="position:absolute; font-family:var(--font-heading); font-weight:800; font-size:34px; color:#fff;">斩</span>' : ''}</div>`;
  });

  // 板上瞬时特效层（A6 斩残影 / A2 出牌啪嗒）：位置同兵 laneAt(pos01)，opacity/scale 全由 t 算 → 每帧重画也连续（不靠 CSS 关键帧）。
  const fxHTML = forr(view.fx ?? [], (f) => {
    const p = laneAt(f.lane, clamp01(f.pos01));
    const t = f.t < 0 ? 0 : f.t > 1 ? 1 : f.t;
    const op = 1 - t;
    if (f.kind === 'death') { // 斩残影：石板上浮放大旋出 + 外扩红环，淡出
      const slab = Object.assign({ position: 'absolute', width: '74px', height: '102px', transform: 'translate(-50%,-50%) scale(' + (1 + t * 0.8).toFixed(3) + ') rotate(' + (t * 16).toFixed(1) + 'deg)', borderRadius: '11px', background: '#9c3324', border: '4px solid var(--danger)', opacity: op.toFixed(3), boxShadow: '0 0 ' + Math.round(34 * op) + 'px rgba(255,64,79,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: '5' }, at(p));
      const ring = Object.assign({ position: 'absolute', width: '120px', height: '120px', transform: 'translate(-50%,-50%) scale(' + (0.7 + t * 2).toFixed(3) + ')', borderRadius: '50%', border: '5px solid rgba(255,64,79,' + (op * 0.85).toFixed(3) + ')', opacity: op.toFixed(3), pointerEvents: 'none', zIndex: '4' }, at(p));
      return `<div style="${st(ring)}"></div><div style="${st(slab)}"><span style="font-family:var(--font-heading); font-weight:800; font-size:36px; color:#fff;">斩</span></div>`;
    }
    // deploy 啪嗒：入场彩色环放大淡出 + 中心亮点（己方橙 / 敌蓝）
    const col = f.side === 'a' ? '#ff5d2e' : '#3a86d4';
    const ring = Object.assign({ position: 'absolute', width: '108px', height: '108px', transform: 'translate(-50%,-50%) scale(' + (0.4 + t * 1.5).toFixed(3) + ')', borderRadius: '50%', border: '5px solid ' + col, opacity: (op * 0.9).toFixed(3), boxShadow: '0 0 24px ' + col, pointerEvents: 'none', zIndex: '4' }, at(p));
    const dot = Object.assign({ position: 'absolute', width: '26px', height: '26px', transform: 'translate(-50%,-50%) scale(' + (1 + t).toFixed(3) + ')', borderRadius: '50%', background: col, opacity: (op * 0.7).toFixed(3), pointerEvents: 'none', zIndex: '5' }, at(p));
    return `<div style="${st(ring)}"></div><div style="${st(dot)}"></div>`;
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
  // CR 出牌坞：选普通牌(部署) / 天罡牌(施法) / 无选中→三路兵力迁移（点首路=迁出·点次路=迁入）。lane 按钮三用，按选中态切。
  const castMode = view.selectedTengang >= 0 && view.selectedTengang < view.tengang.length; // 选中天罡 → lane 按钮 = 施法
  const hasSel = (view.selectedCard >= 0 && view.selectedCard < view.hand.length) || castMode;
  const migMode = !hasSel; const migSrc = view.migrateSource; // 无选中牌 = 迁移模式
  const laneBtnDefs: [string, number, string][] = [['top', 0, '上路'], ['mid', 1, '中路'], ['bot', 2, '下路']];
  const laneBtnsHTML = forr(laneBtnDefs, ([key, i, label]) => {
    const ln = view.lanes[i]; const mine = ln ? ln.mine : 0; const isSrc = migMode && migSrc === i;
    const enabled = hasSel || (migMode && (migSrc < 0 ? mine > 0 : migSrc !== i)); // 迁移：未选源→该路有兵 / 已选源→非源路
    const active = hasSel || isSrc; // 高亮：派牌/施法=全部可投；迁移=已选迁出路
    const sub = hasSel ? (castMode ? '施法' : (ln ? ln.state : '')) : (migSrc < 0 ? `迁出 ${mine}` : (isSrc ? '取消' : '迁入此路'));
    const style = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '9px 6px', borderRadius: '11px', cursor: enabled ? 'pointer' : 'not-allowed', border: '1px solid ' + (active ? 'var(--accent)' : enabled && migMode ? 'var(--gold)' : 'var(--btn-edge)'), background: active ? 'var(--accent-grad)' : 'var(--btn-bg)', color: active ? '#fff' : 'var(--btn-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '15px', transition: 'all .15s ease', opacity: enabled ? '1' : '.55', boxShadow: active ? '0 0 14px var(--accent-soft)' : 'none' };
    return `<button data-act="play" data-k="${key}" style="${st(style)}">${label}<span style="font-family:var(--font-num); font-size:9px; opacity:.85; color:${active ? '#fff' : 'var(--ink-dim)'};">${esc(sub)}</span></button>`;
  });
  // 普通手牌：点选 → 高亮(抬起) → 点上/中/下部署慢行军。将领带♔。
  const handHTML = view.hand.length ? forr(view.hand, (c, i) => {
    const sel = i === view.selectedCard; const sc = SUITC[c.suit];
    const cardS = { position: 'relative', width: '58px', height: '82px', flex: 'none', borderRadius: '9px', cursor: 'pointer', background: 'linear-gradient(160deg,#fbf7ef,#e9dcc6)', border: (c.general ? 3 : 2) + 'px solid ' + (sel ? 'var(--accent)' : sc), boxShadow: sel ? '0 0 0 2px var(--accent), 0 10px 20px rgba(0,0,0,.55)' : '0 4px 10px rgba(0,0,0,.45)', transform: sel ? 'translateY(-10px)' : 'none', transition: 'all .12s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    return `<div data-act="hand" data-i="${i}" style="${st(cardS)}"><div style="position:absolute; top:3px; left:6px; font-family:var(--font-heading); font-weight:700; font-size:16px; color:${sc};">${esc(c.rank)}</div><span style="font-size:32px; color:${sc};">${SUITG[c.suit]}</span>${c.general ? '<span style="position:absolute; top:-15px; left:50%; transform:translateX(-50%); font-size:20px; color:var(--gold);">♔</span>' : ''}</div>`;
  }) : `<span style="color:var(--ink-dim); font-size:13px; padding:0 8px;">（普通手牌空 · 花点数摸牌）</span>`;
  // 天罡（法术）手牌：紫皮 · 显名 · 点选 → 点上/中/下施法。
  const tengangHTML = forr(view.tengang, (c, i) => {
    const sel = i === view.selectedTengang;
    const cardS = { position: 'relative', width: '58px', height: '82px', flex: 'none', borderRadius: '9px', cursor: 'pointer', background: 'linear-gradient(160deg,#3b2a5e,#241640)', border: '2px solid ' + (sel ? 'var(--gold)' : '#7c5cc4'), boxShadow: sel ? '0 0 0 2px var(--gold), 0 10px 20px rgba(0,0,0,.55)' : '0 6px 14px rgba(80,50,160,.5)', transform: sel ? 'translateY(-10px)' : 'none', transition: 'all .12s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px', textAlign: 'center' };
    return `<div data-act="tengang" data-i="${i}" style="${st(cardS)}"><span style="font-size:20px; color:#c9b6ff;">✦</span><span style="font-family:var(--font-body); font-weight:700; font-size:10px; line-height:1.1; color:#e7deff;">${esc(c.name)}</span></div>`;
  });
  // 点数(召唤源泉)条 + 摸牌按钮（花点数·玩家选库；CR 经济核心·可见）。
  const elixirPct = Math.max(0, Math.min(100, Math.round((view.points / Math.max(1, view.pointsMax)) * 100)));
  const drawBtn = (act: string, label: string, cost: number, can: boolean): string => {
    const s = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 6px', borderRadius: '11px', cursor: can ? 'pointer' : 'not-allowed', border: '1px solid ' + (can ? '#a855f7' : 'var(--btn-edge)'), background: can ? 'linear-gradient(180deg,#b06bf5,#8b3fd9)' : 'var(--btn-bg)', color: can ? '#fff' : 'var(--ink-dim)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', opacity: can ? '1' : '.55', transition: 'all .15s ease' };
    return `<button data-act="${act}" style="${st(s)}">${label}<span style="font-family:var(--font-num); font-size:11px;">◈${cost}</span></button>`;
  };

  // 对决特写：忠实复刻 Core Design「Game G 对决特写.dc.html」→ clashCloseup（自包含·冻结战场叠加·居中舞台·活/斩/平裁定·玄铁/锦霞）。
  const cv = view.clash;

  return `<div class="gg-root" style="${st(rootStyle)}">
    <div class="gg-scale-outer" style="container-type:size; width:100%; aspect-ratio:16 / 9; margin:0 auto; overflow:hidden; border-radius:14px; box-shadow:0 24px 60px rgba(0,0,0,.35);">
    <div class="gg-scale-inner" style="width:1920px; height:1080px; transform:scale(calc(100cqw / 1920)); transform-origin:top left; position:relative; overflow:hidden; background:var(--app-bg); color:var(--ink); font-family:var(--font-body);">
      <div style="position:absolute; inset:0; background:var(--texture); pointer-events:none;"></div>
      <div style="position:absolute; top:0; left:0; right:0; height:96px; display:flex; align-items:center; gap:18px; padding:0 30px; background:var(--hud-bg); border-bottom:1px solid var(--panel-border); z-index:8;">
        <div style="display:flex; align-items:center; gap:11px; min-width:280px;"><div style="${st(nexBadgeA)}">♠</div><div style="flex:1;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--ink);">我方老家</span><span style="font-family:var(--font-num); font-size:12px; color:var(--accent);">${view.homeA}/${view.homeAMax}</span></div><div style="height:11px; border-radius:99px; background:var(--track); overflow:hidden; margin-top:5px; border:1px solid var(--panel-border);"><div style="width:${pct(view.homeA, view.homeAMax)}%; height:100%; background:var(--accent-grad); border-radius:99px; box-shadow:0 0 8px var(--accent-soft);"></div></div></div></div>
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;"><div style="${st(phaseBanner)}">${esc(view.phaseText)}</div><div style="display:flex; align-items:center; gap:10px;"><span style="font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-dim);">TIME</span><span style="font-family:var(--font-num); font-size:22px; color:var(--ink);">${esc(view.timeText)}</span></div></div>
        <div style="display:flex; align-items:center; gap:11px; min-width:280px; justify-content:flex-end;"><div style="flex:1;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-num); font-size:12px; color:#3a86d4;">${view.homeB}/${view.homeBMax}</span><span style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--ink);">敌方老家</span></div><div style="height:11px; border-radius:99px; background:var(--track); overflow:hidden; margin-top:5px; border:1px solid var(--panel-border);"><div style="width:${pct(view.homeB, view.homeBMax)}%; height:100%; margin-left:${100 - pct(view.homeB, view.homeBMax)}%; background:linear-gradient(180deg,#5ea0e0,#2a5f9e); border-radius:99px; box-shadow:0 0 8px rgba(58,134,212,.5);"></div></div></div><div style="${st(nexBadgeB)}">${SUITG[view.oppSuit]}</div></div>
      </div>
      <div style="position:absolute; top:104px; left:18px; right:318px; bottom:172px; display:flex; flex-direction:column; align-items:center; gap:12px;">
        <div style="${st(viewport)}">
          <div style="${st(world)}">
            <svg viewBox="0 0 3000 1500" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;"><polygon points="1380,-40 1620,-40 1620,1540 1380,1540" fill="rgba(86,150,205,.10)"></polygon><g fill="none" stroke="rgba(238,222,180,.16)" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"><path d="M460,750 Q1500,640 2540,750"></path><path d="M380,650 Q1500,150 2620,650"></path><path d="M380,850 Q1500,1350 2620,850"></path></g><g fill="none" stroke="rgba(238,222,180,.34)" stroke-width="7" stroke-dasharray="40 28" style="animation:gg-dash 1.6s linear infinite;"><path d="M460,750 Q1500,640 2540,750"></path><path d="M380,650 Q1500,150 2620,650"></path><path d="M380,850 Q1500,1350 2620,850"></path></g></svg>
            ${mkNexus(A_POS, '#ff5d2e', 'rgba(255,93,46,.6)', view.homeA, view.homeAMax, '我方老家', '♠')}
            ${mkNexus(B_POS, '#3a86d4', 'rgba(58,134,212,.55)', view.homeB, view.homeBMax, '敌方老家', SUITG[view.oppSuit])}
            ${towersHTML}${unitsHTML}${gatesHTML}${fxHTML}
            ${laneLbl(0, -34, '上路')}${laneLbl(1, -70, '中路')}${laneLbl(2, 34, '下路')}
          </div>
        </div>
      </div>
      <div style="position:absolute; top:112px; right:18px; width:284px; bottom:172px; display:flex; flex-direction:column; gap:11px;">
        <div style="font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--ink-dim); padding:2px 4px;">三路战况 · Lanes</div>
        <div style="display:flex; flex-direction:column; gap:9px;">${lanesHTML}</div>
        <div style="${st(panel)}"><div style="${st(panelHead)}">当前对手</div><div style="display:flex; align-items:center; gap:10px;"><div style="${st({ width: '40px', height: '40px', borderRadius: '11px', flex: 'none', background: 'linear-gradient(160deg,#3a86d4,#2a5f9e)', border: '2px solid #3a86d4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px' })}">${SUITG[view.oppSuit]}</div><div style="flex:1; min-width:0;"><div style="display:flex; align-items:center; gap:6px;"><span style="font-family:var(--font-heading); font-weight:700; font-size:15px; color:var(--ink);">${esc(view.oppName)}</span><span style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(58,134,212,.18); color:#3a86d4; border:1px solid #3a86d466; font-weight:700;">蓝方</span></div><div style="font-size:11px; color:var(--ink-dim); margin-top:3px;">${esc(view.oppPersona)}</div></div></div></div>
        <div style="${st(panel)}"><div style="${st(panelHead)}">台面机关</div><div style="display:flex; align-items:center; gap:11px; padding:9px 11px; border-radius:9px; background:var(--chip-bg); border:1px solid var(--panel-border);"><span style="font-size:18px;">🌪</span><div><div style="font-family:var(--font-heading); font-weight:700; font-size:13px; color:var(--ink);">河道·低重力</div><div style="font-size:11px; color:var(--ink-dim);">过河掷命滞空更久</div></div></div></div>
      </div>
      <div style="position:absolute; left:0; right:0; bottom:0; height:160px; background:var(--dock-bg); border-top:1px solid var(--panel-border); padding:18px 30px; z-index:7; display:flex; align-items:stretch; gap:16px;">
        <div style="display:flex; align-items:center; gap:10px;"><div style="display:flex; align-items:center; gap:9px; padding:0 14px; height:100%; border-radius:14px; background:var(--gold-chip); border:1px solid var(--gold);"><span style="font-size:20px;">◈</span><span style="font-family:var(--font-num); font-size:24px; color:var(--gold);">${view.materials}</span></div><div style="display:flex; flex-direction:column; justify-content:center; gap:6px; padding:0 16px; height:100%; border-radius:14px; background:rgba(168,85,247,.12); border:1px solid #a855f7; min-width:172px;"><div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:#c9a6ff;">点数 · 召唤源泉</span><span style="font-family:var(--font-num); font-size:13px; color:#c9a6ff;">${Math.floor(view.points)}/${view.pointsMax}</span></div><div style="height:12px; border-radius:99px; background:var(--track); overflow:hidden; border:1px solid rgba(168,85,247,.5);"><div style="width:${elixirPct}%; height:100%; background:linear-gradient(90deg,#8b3fd9,#c77dff); box-shadow:0 0 8px rgba(168,85,247,.6);"></div></div></div></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:7px; justify-content:center; padding:8px 18px; border-radius:16px; background:var(--accent-soft); border:1px solid var(--accent); box-shadow:inset 0 0 0 1px var(--hairline);"><div style="display:flex; align-items:center; gap:10px;"><span style="font-family:var(--font-heading); font-weight:700; font-size:17px; color:var(--accent); letter-spacing:.03em;">手牌 · 出牌</span><span style="font-size:12px; color:var(--ink-dim);">点选一张 → 上/中/下（普通=部署 · 天罡=施法）；空手点路 = 三路调兵（迁出→迁入）；点数攒够花点数摸牌</span><span style="flex:1;"></span><span style="font-family:var(--font-num); font-size:11px; color:var(--ink-dim);">普通库 ${view.deckCount} · 天罡库 ${view.tengangDeckCount}</span></div><div style="display:flex; gap:8px; align-items:flex-end; min-height:86px;">${handHTML}${view.tengang.length ? `<div style="width:1px; align-self:stretch; margin:6px 4px; background:var(--hairline);"></div>${tengangHTML}` : ''}</div></div>
        <div style="width:236px; flex:none; display:flex; flex-direction:column; gap:8px; justify-content:center;"><div style="display:flex; gap:8px;">${laneBtnsHTML}</div><div style="display:flex; gap:8px;">${drawBtn('draw-normal', '摸普通', view.normalDrawCost, view.canDrawNormal)}${drawBtn('draw-tengang', '摸天罡', view.tengangDrawCost, view.canDrawTengang)}</div><div style="font-size:10px; color:var(--ink-dim); text-align:center; letter-spacing:.03em;">花点数摸牌 · 选普通/天罡库（天罡 cap5 · 打掉才补）</div></div>
      </div>
      ${view.encounter ? clashEncounter(view.encounter, s.theme) : ''}
      ${cv ? clashCloseup(cv, s.theme) : ''}
    </div></div></div>`;
}

// CR 出牌控盘回调（game-g.tsx 提供）：选普通/天罡手牌 · 把选中牌派往某路(0/1/2 · 普通部署/天罡施法) · 花点数摸普通/天罡库。
export interface BattleActions { selectCard: (i: number) => void; selectTengang: (i: number) => void; playLane: (lane: number) => void; drawNormal: () => void; drawTengang: () => void }

// 挂载：把设计稿渲进 host，wire 相机/门/聚焦 + 出牌/暂停交互；update() 每帧从 getView() 拉真数据重渲。
export function mountBattle(host: HTMLElement, getView: () => BattleView, actions?: BattleActions): { update: () => void; destroy: () => void } {
  if (!document.getElementById('gg-battle-css')) { const s = document.createElement('style'); s.id = 'gg-battle-css'; s.textContent = CSS; document.head.appendChild(s); }
  // 固定全局视角（owner：不放缩了）：相机锁定 zoom=0.4·居中，整片三路战场一屏尽收；占屏比由外层 container-query 撑满容器宽。
  const state: CamState = { theme: 'onyx', lane: 'mid', zoom: 0.4, camX: 1500, camY: 750, gates: { g1: true, g2: false } };
  const render = (): void => {
    host.innerHTML = buildHTML(getView(), state);
    // 占屏缩放（owner「只看到左上角」修复）：不靠 container-query cqw（部分环境不解析→内层 1920×1080 不缩放、只露左上角）；
    //   JS 实测容器宽 → 显式 scale 内层适配 720p，整屏（含底部召唤源泉/摸牌坞）都进可视区。每帧 render 都重算 → 自然随窗口缩放。
    const outer = host.querySelector('.gg-scale-outer') as HTMLElement | null;
    const inner = host.querySelector('.gg-scale-inner') as HTMLElement | null;
    if (outer && inner) { const w = outer.clientWidth || host.clientWidth; if (w > 0) { const sc = w / 1920; inner.style.transform = 'scale(' + sc + ')'; outer.style.height = Math.round(1080 * sc) + 'px'; } }
  };
  const LANE_IDX: Record<string, number> = { top: 0, mid: 1, bot: 2 };
  // 出牌坞交互用 pointerdown，不是 click：驱动层 rAF 每 ~33ms 整片 host.innerHTML 重建一次，
  // 一次人手「按下→抬起」(~80–150ms) 期间 DOM 被重建数次 → 按下时那个按钮节点已被销毁、
  // click 找不到落点（owner 报「召唤源泉摸牌/出牌按键摁了都无效」）。pointerdown 是单次离散事件，
  // 在按下那一刻就派发到当下活着的 DOM，重渲再频繁也夹不进 down/up 之间 → 必中。
  const onPress = (e: MouseEvent): void => {
    if (e.button > 0) return; // 仅主键（触屏/笔 button=0）；右/中键不触发
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (!el) return;
    const act = el.dataset.act, k = el.dataset.k ?? '';
    if (act === 'hand') { actions?.selectCard(parseInt(el.dataset.i ?? '-1', 10)); render(); }
    else if (act === 'tengang') { actions?.selectTengang(parseInt(el.dataset.i ?? '-1', 10)); render(); }
    else if (act === 'play') { actions?.playLane(LANE_IDX[k] ?? 0); render(); }
    else if (act === 'draw-normal') { actions?.drawNormal(); render(); }
    else if (act === 'draw-tengang') { actions?.drawTengang(); render(); }
    else if (act === 'gate') { state.gates[k] = !state.gates[k]; render(); }
  };
  host.addEventListener('pointerdown', onPress);
  render();
  return {
    update: render,
    destroy: () => { host.replaceChildren(); },
  };
}

import { FONTS } from './fonts.js'; // 自托管字体（替代外部 Google Fonts <link>·owner 2026-06-21）

// 离线"看帧"：自包含 HTML 文档（CSS + 字体 + 真渲染器 buildHTML 输出）。浏览器直接开 = 真游戏战斗屏渲染。
// 容器内确定性生成（同 game-f frameSvg），可 toMatchFileSnapshot 做无头视觉回归 golden。theme 缺省玄铁。
export function renderBattleDoc(view: BattleView, theme: 'onyx' | 'brocade' = 'onyx'): string {
  const s: CamState = { theme, lane: 'mid', zoom: 0.4, camX: 1500, camY: 750, gates: { g1: true, g2: false } };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${FONTS}<style>body{margin:0;background:#0a0d12;display:flex;justify-content:center;}${CSS}</style></head><body>${buildHTML(view, s)}</body></html>`;
}

// 对决特写「看帧」—— 自包含 SVG（无需浏览器/字体；矢量图，客户端多能内联预览，解 owner「HTML 看不到」）。
// 静态呈现 HTML 特写的同款信息：放大两牌(赢金/输斩) + 主 Buff 明细(点数/经营/士气=战力) + 胜率区间 + 掷点落区间定生死。
export function renderClashSvg(cv: ClashView): string {
  const LN = ['上路', '中路', '下路'][cv.lane] ?? '';
  const wrPct = Math.round(cv.winrate * 100), rollPct = Math.round(cv.roll * 100);
  const W = 940, Hh = 590;
  const sg: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const sgn = (n: number): string => (n >= 0 ? '+' + n : String(n));
  const detail = (c: ClashCardView): string => `点数 ${c.points} · 经营 ${sgn(c.buff)}${c.tengang ? ' · 天罡 ' + sgn(c.tengang) : ''}${c.morale ? ' · 士气 ' + sgn(c.morale) : ''} ＝ 战力 ${c.pEff}`;
  const card = (c: ClashCardView, x: number, win: boolean, mine: boolean): string => {
    const sc = SUITC[c.suit], bcol = win ? '#e0a93a' : '#d8504e', bg = win ? '#fff7e8' : '#7e2a20';
    return `<g transform="translate(${x},116)">
      <rect width="210" height="286" rx="16" fill="${bg}" stroke="${bcol}" stroke-width="6"/>
      ${c.general ? '<text x="105" y="6" font-size="34" text-anchor="middle" fill="#e0a93a">♔</text>' : ''}
      <text x="22" y="52" font-size="42" font-weight="800" fill="${win ? sc : '#fff'}">${esc(c.rank)}</text>
      <text x="105" y="176" font-size="98" text-anchor="middle" fill="${win ? sc : 'rgba(255,255,255,.92)'}">${sg[c.suit]}</text>
      ${win ? '' : '<text x="105" y="210" font-size="94" font-weight="800" text-anchor="middle" fill="#fff">斩</text>'}
      <text x="105" y="324" font-size="15" text-anchor="middle" fill="${mine ? '#ff7a45' : '#5ea0e0'}" font-family="monospace">${esc(detail(c))}</text>
    </g>`;
  };
  const barX = 120, barY = 486, barW = 700, barH = 26, splitX = barX + barW * cv.winrate, rollX = barX + barW * cv.roll;
  const resultTxt = cv.aWins ? '我方' + cv.a.rank + ' 翻正 · 敌 ' + cv.b.rank + ' 斩' : '敌 ' + cv.b.rank + ' 翻正 · 我方 ' + cv.a.rank + ' 斩';
  // 50:50 平局裁定（owner）：点数/续航决出时掷点无意义 → 不画掷标；result 行写明裁定理由。
  const reason = cv.tie === 'points' ? '战力相等 50:50 → 点数大者胜' : cv.tie === 'stamina' ? '战力·点数皆平 → 续航高者胜' : cv.tie === 'roll' ? '全平 → 重揉定' : '掷点 ' + rollPct + ' 落在 ' + (cv.aWins ? '我方生区' : '敌方生区');
  const showRoll = cv.tie !== 'points' && cv.tie !== 'stamina';
  const rollLabelX = Math.max(barX + 26, Math.min(barX + barW - 26, rollX)); // 贴边夹住·不溢出/不压两端胜率标签
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" font-family="'Noto Sans SC','PingFang SC',sans-serif">
    <rect width="${W}" height="${Hh}" fill="#0e1117"/>
    <text x="${W / 2}" y="58" font-size="28" font-weight="700" text-anchor="middle" fill="#ff7a45">⚔ ${LN} · 命运一掷</text>
    ${card(cv.a, 160, cv.aWins, true)}
    <text x="${W / 2}" y="270" font-size="36" font-weight="800" text-anchor="middle" fill="#8b94a3">VS</text>
    ${card(cv.b, 570, !cv.aWins, false)}
    <text x="${barX}" y="470" font-size="14" fill="#ff7a45" font-family="monospace">我方 ${sg[cv.a.suit]}${esc(cv.a.rank)} 生 ${wrPct}%</text>
    <text x="${barX + barW}" y="470" font-size="14" fill="#5ea0e0" text-anchor="end" font-family="monospace">${100 - wrPct}% 生 ${sg[cv.b.suit]}${esc(cv.b.rank)} 敌方</text>
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="13" fill="#2f72b8"/>
    <rect x="${barX}" y="${barY}" width="${Math.round(barW * cv.winrate)}" height="${barH}" rx="13" fill="#ee5520"/>
    <line x1="${splitX}" y1="${barY - 7}" x2="${splitX}" y2="${barY + barH + 7}" stroke="#fff" stroke-width="2"/>
    ${showRoll ? `<polygon points="${rollX - 11},${barY - 24} ${rollX + 11},${barY - 24} ${rollX},${barY - 4}" fill="#fff"/><text x="${rollLabelX}" y="${barY + barH + 20}" font-size="13" text-anchor="middle" fill="#fff" font-family="monospace">掷 ${rollPct}</text>` : ''}
    <text x="${W / 2}" y="${barY + barH + 44}" font-size="15" text-anchor="middle" fill="#cbd5e1" font-family="monospace">${reason} → ${esc(resultTxt)}</text>
  </svg>`;
}
