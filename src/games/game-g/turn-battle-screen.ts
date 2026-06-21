// turn-battle-screen.ts —— doc24 单机回合制战斗屏渲染器（忠实端口 owner 给的 Cloud Design「Game G 回合制战场.dc.html」）。
// 与设计稿同 1340×858 固定画布、玄铁/锦霞双皮；样式逐字搬自设计稿 renderVals。纯表现「固定解释器」(manifesto §2)：
//   只读 TurnBattleView（由 buildTurnBattleView 从 turn-combat 真状态派生）→ 出 HTML 串；不进 hash、不回灌判定。
// 静态渲染 = 设计稿"静息态"(无 hover tooltip / 无 boss 飞出)；clash 特写覆盖层按 view.clash 选渲。live mount + 交互为后续切片。
import { cardPoints } from './clash-resolve.js';
import { SLOTS, MANA_PER_TURN, GATES, A_DEPLOY_SLOT, B_DEPLOY_SLOT, DEPLOY_COST, CAST_COST, clashOdds, type TurnBattle, type TurnUnit } from './turn-combat.js';
import { FONTS } from './fonts.js'; // 自托管字体（替代外部 Google Fonts <link>）

type Style = Record<string, string | number | undefined>;
const st = (o: Style): string => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + v).join(';');
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const forr = <X,>(arr: X[], fn: (x: X, i: number) => string): string => arr.map(fn).join('');

const SUITC: Record<string, string> = { s: '#22303f', h: '#c0392b', d: '#c0651a', c: '#2d6a3f' };
const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUITNM: Record<string, string> = { s: '黑桃', h: '红桃', d: '方块', c: '梅花' };
const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇: '🐍', 马: '🐎', 羊: '🐑', 猴: '🐒', 鸡: '🐓', 狗: '🐕', 猪: '🐖' };
const RAR: Record<string, [string, string]> = { white: ['普通', '#b9bec8'], green: ['优良', '#5bbf7a'], blue: ['稀有', '#3a9bff'], gold: ['传世', '#e8cd82'] };

// 敌我牌面（owner 2026-06-20：底纹要好看·斜纹太丑）：改干净暖/冷渐变 + 左上玻璃高光。我方暖橙·敌方冷蓝（色温+描边色分清）。
const sideFace = (mine: boolean): string => mine
  ? 'radial-gradient(120% 78% at 26% 12%, rgba(255,255,255,.55), rgba(255,255,255,0) 58%), linear-gradient(160deg,#fff5ef 0%,#ffe0cf 68%,#ffceb5 100%)'
  : 'radial-gradient(120% 78% at 26% 12%, rgba(255,255,255,.6), rgba(255,255,255,0) 58%), linear-gradient(160deg,#f0f6fe 0%,#d6e4f8 68%,#c1d6f2 100%)';

// 双皮 token（逐字搬自设计稿 themes()）。
type Theme = Record<string, string>;
export const THEMES: Record<string, Theme> = {
  onyx: {
    '--ink': '#e7edf3', '--ink-dim': '#8493a3', '--gold': '#e8cd82', '--gold-grad': 'linear-gradient(180deg,#f5e6ad,#c69a44)',
    '--accent': '#ff7a45', '--accent-grad': 'linear-gradient(180deg,#ff8d5a,#ee5a25)', '--accent-soft': 'rgba(255,122,69,.22)',
    '--paper': 'radial-gradient(130% 120% at 50% -10%, #16273a 0%, #0e1b28 52%, #070e16 100%)',
    '--board': 'radial-gradient(120% 100% at 50% 50%, #1d3a2c, #112318 78%)', '--board-edge': '#0b1a12',
    '--lane': 'linear-gradient(90deg, rgba(255,122,69,.08), rgba(0,0,0,.12) 50%, rgba(58,134,212,.08))',
    '--cell': 'rgba(255,255,255,.04)', '--cell-edge': 'rgba(255,255,255,.1)', '--cell-mine': 'rgba(255,122,69,.07)', '--cell-foe': 'rgba(58,134,212,.07)',
    '--panel': 'linear-gradient(165deg,#172636,#0f1d2a)', '--panel-border': '#33485f', '--hairline': 'rgba(232,205,138,.18)', '--chip': 'rgba(255,255,255,.05)', '--track': 'rgba(0,0,0,.5)',
    '--frame-edge': '#26384a', '--hp': '#46d17a', '--danger': '#ff5d62', '--card-face': 'linear-gradient(158deg,#fcf9f1,#e6d8bd)',
    '--chamfer': 'polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)',
    '--fd': "'Zhi Mang Xing', cursive", '--fh': "'Rajdhani', sans-serif", '--fb': "'Noto Sans SC', sans-serif", '--fn': "'Silkscreen', monospace",
  },
  brocade: {
    '--ink': '#5a3f44', '--ink-dim': '#9a7a7e', '--gold': '#cf9a3f', '--gold-grad': 'linear-gradient(180deg,#f3e2a4,#cf9a3f)',
    '--accent': '#cf5070', '--accent-grad': 'linear-gradient(180deg,#e887a0,#cf5070)', '--accent-soft': 'rgba(207,80,112,.2)',
    '--paper': 'radial-gradient(130% 120% at 50% -10%, #fdf4ee 0%, #f3e2dc 60%, #ecd6cf 100%)',
    '--board': 'radial-gradient(120% 100% at 50% 50%, #cf9aa0, #ab6470 78%)', '--board-edge': '#7a4450',
    '--lane': 'linear-gradient(90deg, rgba(207,80,112,.1), rgba(255,255,255,.1) 50%, rgba(58,134,212,.08))',
    '--cell': 'rgba(255,255,255,.34)', '--cell-edge': 'rgba(122,68,80,.3)', '--cell-mine': 'rgba(207,80,112,.12)', '--cell-foe': 'rgba(58,134,212,.1)',
    '--panel': 'linear-gradient(165deg,#fffaf3,#f8e7d6)', '--panel-border': '#e0c290', '--hairline': 'rgba(207,154,63,.45)', '--chip': 'rgba(255,255,255,.55)', '--track': 'rgba(150,110,90,.18)',
    '--frame-edge': '#caa463', '--hp': '#2f8f6b', '--danger': '#d65668', '--card-face': 'linear-gradient(158deg,#fffdf8,#f1e2cf)',
    '--chamfer': 'polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)',
    '--fd': "'Ma Shan Zheng', cursive", '--fh': "'Cormorant Garamond', serif", '--fb': "'Noto Serif SC', serif", '--fn': "'Silkscreen', monospace",
  },
};
const CSS = `
@keyframes g-spark { 0%,100% { opacity:.6; transform:translate(-50%,-50%) scale(1);} 50% { opacity:1; transform:translate(-50%,-50%) scale(1.12);} }
@keyframes g-gate { 0%,100% { opacity:.5;} 50% { opacity:1;} }
@keyframes g-emblem { 0% { transform:translate(-50%,-50%) scale(.6); opacity:0;} 60% { transform:translate(-50%,-50%) scale(1.12); opacity:1;} 100% { transform:translate(-50%,-50%) scale(1); opacity:1;} }
@keyframes g-pulse { 0%,100% { box-shadow:0 0 0 0 var(--accent-soft);} 50% { box-shadow:0 0 0 6px transparent;} }
@keyframes g-water { 0% { background-position:0 0;} 100% { background-position:0 -28px;} }
@keyframes g-aura { 0%,100% { opacity:.5; transform:scale(1);} 50% { opacity:.95; transform:scale(1.04);} }
@keyframes g-flow { to { stroke-dashoffset: -32; } }
@keyframes g-knob { 0%,100% { box-shadow:0 0 6px var(--kc), inset 0 1px 1px rgba(255,255,255,.3);} 50% { box-shadow:0 0 16px var(--kc), 0 0 24px var(--kc), inset 0 1px 1px rgba(255,255,255,.3);} }
@keyframes g-fade { from { opacity:0; } to { opacity:1; } }
@keyframes g-fly-mine { 0% { transform: translate(-90px,140px) scale(.16) rotateX(76deg) rotateY(-30deg); } 100% { transform: none; } }
@keyframes g-fly-foe  { 0% { transform: translate(90px,140px) scale(.16) rotateX(76deg) rotateY(30deg); } 100% { transform: none; } }
@keyframes g-coin-pop { 0% { transform: scale(0) rotate(-200deg); opacity:0; } 70% { transform: scale(1.14) rotate(10deg); } 100% { transform: scale(1) rotate(0); opacity:1; } }
@keyframes g-hl { 0%,100% { box-shadow:0 0 0 0 var(--gold), 0 0 10px var(--gold); } 50% { box-shadow:0 0 0 5px rgba(232,205,138,.5), 0 0 18px var(--gold); } }
@keyframes g-adv-a { 0%{transform:translateX(-38px) scale(.88);opacity:0} 65%{transform:translateX(3px)} 100%{transform:none;opacity:1} }
@keyframes g-adv-b { 0%{transform:translateX(38px) scale(.88);opacity:0} 65%{transform:translateX(-3px)} 100%{transform:none;opacity:1} }
@keyframes g-drop { 0%{transform:translateY(-26px) scale(.5);opacity:0} 55%{transform:translateY(3px) scale(1.08);opacity:1} 75%{transform:translateY(-1px) scale(.99)} 100%{transform:none;opacity:1} }
@keyframes g-deal { 0%{transform:translateY(74px) scale(.62) rotateY(-92deg);opacity:0} 45%{opacity:1} 72%{transform:translateY(-7px) scale(1.05) rotateY(0deg)} 100%{transform:none;opacity:1} }
@keyframes g-place { 0%,100% { box-shadow:inset 0 0 0 2px rgba(232,205,138,.55), 0 0 12px rgba(232,205,138,.3); } 50% { box-shadow:inset 0 0 0 3px var(--gold), 0 0 22px rgba(232,205,138,.6); } }
/* 放牌指示手指（owner 2026-06-21·点这里）：手指轻点 + 点击涟漪 */
@keyframes g-tap { 0%,100% { transform:translate(-50%,-50%) scale(1);} 45% { transform:translate(-50%,-74%) scale(1.16);} }
@keyframes g-ripple { 0% { opacity:.6; transform:translate(-50%,-50%) scale(.45);} 100% { opacity:0; transform:translate(-50%,-50%) scale(1.75);} }
/* 召唤源泉消耗（owner 2026-06-21·往后退·别 biang 剪掉）：花掉的格亮闪一下→向源头收退淡出 + 升腾火花 */
@keyframes g-drain { 0% { opacity:1; transform:scaleX(1); filter:brightness(1.85);} 65% { opacity:.7;} 100% { opacity:0; transform:scaleX(0);} }
@keyframes g-drainspark { 0% { opacity:.95; transform:translate(-50%,0) scale(1);} 100% { opacity:0; transform:translate(-50%,-24px) scale(.35);} }
/* 磨砂详情浮层（owner 2026-06-21·悬浮看牌：战力=点数+加成，对决再 +随机骰）：纯 CSS hover，重渲不丢 */
.gg-tipwrap>.gg-tip{ position:absolute; left:50%; bottom:calc(100% + 9px); transform:translateX(-50%) translateY(5px) scale(1); transform-origin:50% 100%; width:194px; padding:11px 13px 9px; border-radius:13px; background:rgba(18,24,36,.58); backdrop-filter:blur(13px) saturate(1.5); -webkit-backdrop-filter:blur(13px) saturate(1.5); border:1px solid rgba(255,255,255,.2); box-shadow:0 16px 44px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14); color:#eaf0f6; font-family:var(--fb); font-size:11px; line-height:1.5; text-align:left; opacity:0; pointer-events:none; transition:opacity .15s ease, transform .15s ease; z-index:80; }
.gg-tipwrap>.gg-tip::after{ content:''; position:absolute; left:50%; top:100%; transform:translateX(-50%); border:7px solid transparent; border-top-color:rgba(18,24,36,.58); }
.gg-tipwrap:hover>.gg-tip{ opacity:1; transform:translateX(-50%) translateY(0) scale(1.5); } /* 悬浮放大 50%·看得清(owner 2026-06-21) */
/* 顶排(上路)牌：浮层朝下弹，否则朝上会顶出画框被裁掉(owner 2026-06-21) */
.gg-tipwrap.tip-down>.gg-tip{ bottom:auto; top:calc(100% + 9px); transform:translateX(-50%) translateY(-5px) scale(1); transform-origin:50% 0%; }
.gg-tipwrap.tip-down>.gg-tip::after{ top:auto; bottom:100%; border-top-color:transparent; border-bottom-color:rgba(18,24,36,.58); }
.gg-tipwrap.tip-down:hover>.gg-tip{ transform:translateX(-50%) translateY(0) scale(1.5); }
/* 边缘左右弹（owner 2026-06-21·别弹出屏幕外）：最左牌→向右弹，最右牌→向左弹。从该侧角缩放，放大也不溢出。 */
.gg-tipwrap.tip-left>.gg-tip{ left:auto; right:0; transform:translateX(0) translateY(5px) scale(1); transform-origin:100% 100%; }
.gg-tipwrap.tip-left>.gg-tip::after{ left:auto; right:16px; transform:translateX(0); }
.gg-tipwrap.tip-left:hover>.gg-tip{ transform:translateX(0) translateY(0) scale(1.5); }
.gg-tipwrap.tip-right>.gg-tip{ left:0; right:auto; transform:translateX(0) translateY(5px) scale(1); transform-origin:0% 100%; }
.gg-tipwrap.tip-right>.gg-tip::after{ left:16px; transform:translateX(0); }
.gg-tipwrap.tip-right:hover>.gg-tip{ transform:translateX(0) translateY(0) scale(1.5); }
/* 顶排 + 边缘 复合：朝下且贴角 */
.gg-tipwrap.tip-down.tip-left>.gg-tip{ bottom:auto; top:calc(100% + 9px); transform-origin:100% 0%; }
.gg-tipwrap.tip-down.tip-right>.gg-tip{ bottom:auto; top:calc(100% + 9px); transform-origin:0% 0%; }
/* 悬浮的牌+浮层整体抬层（owner 2026-06-21）：手牌/棋格 position:relative 但 z 默认 auto，
   悬浮时拔高 → 浮层不再被相邻牌或棋盘(Table)盖住。 */
.gg-tipwrap:hover{ z-index:90; }`;
// 教学高亮（doc28 教学钩子·纯表现）：金描边 + 脉冲，套在被强制点击的元素上。
const HL = ';outline:3px solid var(--gold);outline-offset:2px;animation:g-hl 1s ease-in-out infinite;position:relative;z-index:55';

// ── 视图（buildTurnBattleView 从 turn-combat 派生喂渲染器；纯数据） ──
export interface TurnSlotView { hasUnit: boolean; mine: boolean; isBorder: boolean; isClash: boolean; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; power?: number; pts?: number; buff?: number; name?: string; rar?: 'white' | 'green' | 'blue' | 'gold'; zod?: string[]; deploy?: 1 | 2; deployLabel?: boolean; placeable?: boolean; unitId?: string; justMoved?: boolean; fresh?: number; tipDown?: boolean; tipSide?: 'left' | 'right' | ''; forecast?: number } // placeable=选牌待放可落子(高亮)；fresh=新部署落子序号(g-drop)；tipDown=顶排牌磨砂浮层朝下弹避免被画框裁；tipSide=边缘列浮层往内弹避免溢出左右屏(owner 2026-06-21)；forecast=此前锋若开战的我方胜率0~1(掷命预报·owner 2026-06-21)
export interface TurnLaneView { name: string; slots: TurnSlotView[] }
// 捷径门箭头（占位·8 门·真视觉待 owner 参考图）。idx=GATES 下标·供 live mount data-gate 钩子。
export interface TurnGateView { idx: number; open: boolean; side: 'a' | 'b'; fromLane: number; fromSlot: number; toLane: number; toSlot: number }
export interface TurnHandCardView { kind: 'pawn' | 'gang'; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; name: string; power?: number; pts?: number; buff?: number; cost: number; zod?: string[]; rar: 'white' | 'green' | 'blue' | 'gold'; desc?: string; glyph?: string; selected?: boolean; dealt?: boolean; affordable?: boolean } // dealt=刚抽到的牌·飞入翻面入场动画(owner 2026-06-21)
export interface TurnActionView { key: string; glyph: string; label: string; on: boolean; dim: boolean }
export interface TurnClashCardView { rank: string; suit: 's' | 'h' | 'd' | 'c'; name: string; zod?: string; won: boolean }
export interface TurnClashView { laneName: string; mine: TurnClashCardView; foe: TurnClashCardView; oddsMine: number; rollPct: number; bonusMine: [string, number][]; bonusFoe: [string, number][]; pEffMine?: number; pEffFoe?: number }
export interface TurnShaView { filled: boolean; name: string; rar: 'white' | 'green' | 'blue' | 'gold'; desc: string; used?: boolean }
export interface TurnBattleView {
  theme: 'onyx' | 'brocade';
  turnWho: string; roundNo: number; timerLabel: string;
  water: number; waterMax: number; waterB: number; deckA: number; deckB: number;
  homeA: number; homeB: number; homeMax: number;
  lanes: TurnLaneView[]; gates: TurnGateView[]; gatesLive: boolean;
  hand: TurnHandCardView[]; handPawnCount: number; handGangCount: number;
  actions: TurnActionView[]; actionSub: string; drawPick: boolean;
  sha: TurnShaView[]; bossName: string;
  clash: TurnClashView | null;
  tutorial: { narration: string; highlight: string } | null;
  notice: string | null;
  battleLabel: string; sfxOn: boolean; settingsOpen: boolean;
  bgmOn: boolean; bgmIdx: number; bgmVol: number; bgmNames: string[];
}

// ── 上下通路梯子（owner 2026-06-20 Cloud Design 参考图·忠实端口 LAD 像素坐标·900×400 viewBox）──
// 8 道：我方(a) 上1→中2 · 下1→中2 · 中3→上4 · 中3→下4；敌方(b·镜像)。index 同 turn-combat GATES。
const GATE_LAD: ['a' | 'b', number, number, number, number][] = [
  ['a', 205, 110, 295, 156], ['a', 205, 290, 295, 244], ['a', 385, 156, 475, 110], ['a', 385, 244, 475, 290],
  ['b', 745, 110, 655, 156], ['b', 745, 290, 655, 244], ['b', 565, 156, 475, 110], ['b', 565, 244, 475, 290],
];
// 斜梯路径 d（取中段 44% 显形）。
const ladderPath = ([, x1, y1, x2, y2]: ['a' | 'b', number, number, number, number]): string => {
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, f = 0.44;
  return `M${(cx + (x1 - cx) * f).toFixed(0)},${(cy + (y1 - cy) * f).toFixed(0)} L${(cx + (x2 - cx) * f).toFixed(0)},${(cy + (y2 - cy) * f).toFixed(0)}`;
};
// 一道梯子的双 path（底轨 + 流动虚线箭头）。live = 放牌中(本方梯子高亮)。
const ladderSvg = (lad: ['a' | 'b', number, number, number, number], open: boolean, live: boolean): string => {
  const mine = lad[0] === 'a';
  const d = ladderPath(lad);
  const baseStroke = mine ? '#3c2010' : '#12283e', flowStroke = mine ? '#6b3c20' : '#21425f';
  const baseOpacity = open ? (live ? 0.5 : 0.32) : 0.16;
  const marker = open ? (mine ? 'url(#ar-a)' : 'url(#ar-b)') : '';
  const flowStyle: Style = { opacity: open ? (live ? 0.62 : 0.38) : 0, animation: open ? 'g-flow .9s linear infinite' : 'none' };
  return `<path d="${d}" fill="none" stroke="${baseStroke}" stroke-width="17" stroke-linecap="round" opacity="${baseOpacity}"></path><path d="${d}" fill="none" stroke="${flowStroke}" stroke-width="11" stroke-linecap="butt" stroke-dasharray="10 11" marker-end="${marker}" style="${st(flowStyle)}"></path>`;
};
// 梯子中点门钮（◉ 通路 / ✕ 闭）·data-gate 供 live mount 翻门。
const gateKnob = (lad: ['a' | 'b', number, number, number, number], idx: number, open: boolean): string => {
  const [team, x1, y1, x2, y2] = lad; const mine = team === 'a';
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2; const col = mine ? '#c46a38' : '#3a6e9e';
  const wrap: Style = { position: 'absolute', left: (cx / 900 * 100) + '%', top: (cy / 400 * 100) + '%', transform: 'translate(-50%,-50%)', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: open ? `radial-gradient(circle at 38% 32%, ${col}, #1a1208)` : 'radial-gradient(circle at 38% 32%, #4a4640, #15130f)', border: '1.5px solid ' + (open ? col : '#6a4a3a'), boxShadow: open ? `0 0 8px ${col}88, inset 0 1px 1px rgba(255,255,255,.3)` : 'inset 0 1px 2px rgba(0,0,0,.6)', '--kc': col + '99', animation: open ? 'g-knob 1.6s ease-in-out infinite' : 'none', pointerEvents: 'auto', zIndex: 7 };
  const mark: Style = { fontSize: open ? '9px' : '12px', fontWeight: 700, lineHeight: 1, color: open ? 'rgba(255,255,255,.85)' : '#d8504e', fontFamily: 'var(--fh)' };
  return `<div data-gate="${idx}" style="${st(wrap)}"><span style="${st(mark)}">${open ? '◉' : '✕'}</span></div>`;
};
// 梯层（SVG 斜梯 + 门钮）·覆盖三路区。
const laddersLayer = (view: TurnBattleView): string => {
  const svgStyle: Style = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4, overflow: 'visible' };
  const layerStyle: Style = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 };
  const paths = forr(GATE_LAD, (lad, i) => ladderSvg(lad, view.gates[i]?.open ?? false, lad[0] === 'a' && view.gatesLive));
  const knobs = forr(GATE_LAD, (lad, i) => gateKnob(lad, i, view.gates[i]?.open ?? false));
  return `<svg viewBox="0 0 900 400" preserveAspectRatio="none" style="${st(svgStyle)}"><defs><marker id="ar-a" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 L1.3,2 Z" fill="#6b3c20"></path></marker><marker id="ar-b" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 L1.3,2 Z" fill="#21425f"></path></marker></defs>${paths}</svg><div style="${st(layerStyle)}">${knobs}</div>`;
};

const hpGem = (alive: boolean): string => {
  const col = '#ff5d62';
  const gem = { position: 'relative', width: '15px', height: '15px', transform: 'rotate(45deg)', borderRadius: '4px', background: alive ? `linear-gradient(135deg,${col},${col}aa)` : 'rgba(0,0,0,.3)', border: '1px solid ' + (alive ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.15)'), boxShadow: alive ? `0 0 9px ${col}` : 'none' };
  const facet = { position: 'absolute', top: '2px', left: '2px', width: '5px', height: '5px', borderRadius: '2px', background: alive ? 'rgba(255,255,255,.8)' : 'transparent' };
  return `<div style="${st(gem)}"><div style="${st(facet)}"></div></div>`;
};

// 紧凑堡垒大本营（设计稿 mkBase/mkFort）。isMine 决定阵营色 + 花色。
function fortBase(view: TurnBattleView, isMine: boolean): string {
  const col = isMine ? '#ff7a45' : '#3a86d4'; const glyph = isMine ? '♠' : '♥'; const glyphCol = isMine ? '#22303f' : '#c0392b';
  const aura = { position: 'absolute', top: '50%', left: '50%', width: '120px', height: '120px', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(circle, ${isMine ? 'rgba(255,122,69,.32)' : 'rgba(58,134,212,.3)'}, transparent 68%)`, animation: 'g-aura 3s ease-in-out infinite', pointerEvents: 'none' };
  const fort = { position: 'relative', width: '74px', height: '88px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '12px', borderRadius: '12px 12px 10px 10px', background: 'linear-gradient(170deg,#fbf7ef,#dccaa8)', border: '3px solid ' + col, boxShadow: `0 0 24px ${col}66, 0 10px 22px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.5)` };
  const crown = { position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)', fontSize: '26px', color: 'var(--gold)', textShadow: '0 2px 8px rgba(0,0,0,.6)', zIndex: 3 };
  const merlons = { position: 'absolute', top: '-7px', left: '6px', right: '6px', height: '12px', display: 'flex', justifyContent: 'space-between' };
  const merlon = { width: '11px', height: '12px', borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg,#fbf7ef,#d8c39e)', border: '2px solid ' + col, borderBottom: 'none' };
  const shield = { width: '42px', height: '48px', borderRadius: '50% 50% 50% 50% / 38% 38% 62% 62%', background: 'linear-gradient(160deg,#fff,#ece0c6)', border: '2px solid ' + col, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.6)' };
  const tag = { padding: '2px 11px', borderRadius: '99px', background: 'rgba(20,16,10,.8)', color: '#fff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', zIndex: 2 };
  const hpRow = { display: 'flex', gap: '5px', zIndex: 2 };
  const conn = isMine
    ? { position: 'absolute', top: '50%', right: '-6px', width: '14px', height: '4px', transform: 'translateY(-50%)', background: 'linear-gradient(90deg, #ff7a45, transparent)', borderRadius: '99px', boxShadow: '0 0 8px rgba(255,122,69,.6)' }
    : { position: 'absolute', top: '50%', left: '-6px', width: '14px', height: '4px', transform: 'translateY(-50%)', background: 'linear-gradient(270deg, #3a86d4, transparent)', borderRadius: '99px', boxShadow: '0 0 8px rgba(58,134,212,.6)' };
  const blood = isMine ? view.homeA : view.homeB;
  const gems = forr(Array.from({ length: view.homeMax }, (_, i) => i < blood), (a) => hpGem(a));
  const baseStyle = { position: 'relative', width: '92px', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '7px' };
  const fortInner = `<div style="${st(aura)}"></div>
    <div style="${st(fort)}"><div style="${st(crown)}">♔</div><div style="${st(merlons)}">${forr([0, 1, 2, 3], () => `<div style="${st(merlon)}"></div>`)}</div><div style="${st(shield)}"><span style="font-size:30px; color:${glyphCol};">${glyph}</span></div></div>
    <div style="${st(tag)}">${isMine ? '我方' : '敌方'}</div>
    <div style="${st(hpRow)}">${gems}</div>`;
  if (isMine) {
    const timer = { display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', padding: '3px 11px', borderRadius: '99px', background: 'rgba(255,255,255,.06)', border: '1px solid var(--panel-border)', zIndex: 2 };
    return `<div style="${st(baseStyle)}">${fortInner}<div style="${st(timer)}"><span style="font-size:12px;">⏳</span><span style="font-family:var(--fn); font-size:12px; color:var(--ink-dim); white-space:nowrap;">${esc(view.timerLabel)}</span></div><div style="${st(conn)}"></div></div>`;
  }
  // 敌方：+ 地煞牌行
  const shaLabel = { fontSize: '9px', letterSpacing: '.1em', color: 'var(--ink-dim)', marginTop: '6px' };
  const shaRow = { display: 'flex', gap: '5px', marginTop: '5px', zIndex: 2 };
  const shaSlot = (s: TurnShaView): string => {
    const rc = RAR[s.rar] || RAR.white;
    const used = s.used ?? false;
    const slot: Style = { position: 'relative', width: '26px', height: '34px', borderRadius: '5px', background: s.filled ? (used ? 'rgba(20,24,34,.8)' : 'linear-gradient(160deg,#2a3346,#1a2230)') : 'rgba(255,255,255,.04)', border: '1px solid ' + (s.filled ? (used ? 'rgba(255,255,255,.2)' : rc[1]) : 'rgba(255,255,255,.15)'), boxShadow: s.filled && !used ? `0 0 8px ${rc[1]}66` : 'inset 0 1px 2px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', opacity: used ? 0.55 : 1, cursor: 'help' };
    if (!s.filled) {
      const qMark: Style = { fontFamily: 'var(--fd)', fontSize: '15px', color: 'rgba(255,255,255,.2)' };
      const tip = `<div class="gg-tip" style="width:170px"><div style="font-size:11px;color:#cdd6e2;line-height:1.55">尚未揭示的地煞牌位。</div></div>`;
      return `<div class="gg-tipwrap tip-down" style="${st(slot)}"><span style="${st(qMark)}">？</span>${tip}</div>`;
    }
    const shortName = s.name.replace('地煞·', '').replace('地煞 · ', '').slice(0, 2);
    const mark: Style = { fontFamily: 'var(--fd)', fontSize: '13px', color: used ? 'rgba(255,255,255,.38)' : rc[1], lineHeight: '1' };
    const usedPip = used ? `<span style="font-family:var(--fb);font-size:6px;color:rgba(255,180,140,.7);line-height:1;">已用</span>` : '';
    const tipContent = `<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;"><span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${rc[1]};box-shadow:0 0 5px ${rc[1]}"></span><b style="font-size:11px;color:#fff">${esc(s.name)}</b></div>${s.desc ? `<div style="font-size:10px;color:rgba(255,255,255,.75);line-height:1.4;margin-bottom:5px;">${esc(s.desc)}</div>` : ''}<div style="font-size:9px;color:${used ? '#ff9966' : '#7fcc9a'};">${used ? '● 已使用' : '○ 待发动'}</div>`;
    return `<div class="gg-tipwrap tip-down" style="${st(slot)}"><span style="${st(mark)}">${esc(shortName)}</span>${usedPip}<div class="gg-tip" style="width:152px;">${tipContent}</div></div>`;
  };
  // 敌方大本营可点 → 弹 Boss 名号 + 战役故事（owner 2026-06-21）。
  const bossTipRows = forr(view.sha.filter((s) => s.filled), (s) => { const rc = RAR[s.rar] || RAR.white; const used = s.used ?? false; return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid rgba(255,255,255,.08);"><span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${rc[1]};"></span><span style="flex:1;font-size:10px;color:rgba(255,255,255,.85);">${esc(s.name)}</span><span style="font-size:9px;color:${used ? '#ff9966' : '#7fcc9a'};">${used ? '已用' : '备用'}</span></div>`; });
  const bossTip = `<div class="gg-tip" style="width:210px;text-align:left;"><div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px;">👑 ${esc(view.bossName)}</div>${bossTipRows}<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font-size:10px;color:rgba(255,255,255,.55);">牌库剩余 <b style="color:#cdeeff;">${view.deckB}</b> 张</div></div>`;
  return `<div data-act="boss-info" class="gg-tipwrap" style="${st(baseStyle)}; cursor:pointer"><div style="${st(conn)}"></div>${fortInner}<div style="${st(shaLabel)}">地煞牌</div><div style="${st(shaRow)}">${forr(view.sha, shaSlot)}</div>${bossTip}</div>`;
}

// 一格 slot（设计稿 lanes.slots）。
// 掷命预报档位（玩家视角胜率 → 词 + 色）：占优 小优/优势/大优/碾压；吃亏 小弱/弱势/大弱/被碾压；中间均势。
export function oddsTier(p: number): [string, string] {
  const pc = p * 100;
  if (pc >= 90) return ['碾压', '#2fbf6a'];
  if (pc >= 80) return ['大优', '#5bbf7a'];
  if (pc >= 65) return ['优势', '#84c97f'];
  if (pc >= 55) return ['小优', '#bcc857'];
  if (pc > 45) return ['均势', '#cdb86a'];
  if (pc > 35) return ['小弱', '#e8a64a'];
  if (pc > 20) return ['弱势', '#e8814a'];
  if (pc > 10) return ['大弱', '#e25a4a'];
  return ['被碾压', '#cf3b3b'];
}

function slotCell(s: TurnSlotView): string {
  const isMineZone = !s.isBorder && s.mine; const dotCol = s.isBorder ? 'rgba(232,205,138,.8)' : (s.hasUnit ? (s.mine ? 'rgba(255,122,69,.55)' : 'rgba(58,134,212,.55)') : (isMineZone ? 'rgba(255,122,69,.55)' : 'rgba(58,134,212,.55)'));
  // 放牌区底纹（贴各自大本营 3 格·owner 2026-06-20）：我方暖橙 / 敌方冷蓝·虚线内框 + 中格「放牌区」标。
  const depBg = s.deploy === 1 ? 'rgba(255,122,69,.10)' : s.deploy === 2 ? 'rgba(58,134,212,.09)' : 'transparent';
  const depEdge = s.deploy === 1 ? 'inset 0 0 0 1.5px rgba(255,122,69,.34)' : s.deploy === 2 ? 'inset 0 0 0 1.5px rgba(58,134,212,.3)' : '';
  const cell = { position: 'relative', minWidth: 0, height: '100%', minHeight: 0, borderRadius: '11px', background: s.isBorder ? 'rgba(232,205,138,.16)' : depBg, boxShadow: s.isBorder ? 'inset 0 0 0 1px rgba(232,205,138,.35), inset 0 0 18px rgba(232,205,138,.18)' : depEdge, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const depLabel = s.deployLabel ? `<div style="${st({ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '9px', letterSpacing: '.12em', color: s.deploy === 1 ? 'rgba(255,160,110,.9)' : 'rgba(120,180,240,.85)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1 })}">放牌区</div>` : '';
  const dot = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '40px', height: '40px', borderRadius: '50%', border: '2px dashed ' + dotCol, opacity: s.hasUnit ? 0.35 : 0.8, boxShadow: s.isBorder ? '0 0 10px rgba(232,205,138,.4)' : 'none' };
  let unitHTML = '';
  if (s.hasUnit && s.rank && s.suit) {
    const col = s.mine ? '#ff7a45' : '#3a86d4'; const sc = SUITC[s.suit]; const zod = s.zod || [];
    // 敌我分明（owner 2026-06-21）：边框描粗 + 背景打淡淡的「我 / 敌」水印字。
    const unit = { position: 'relative', width: '100%', height: '90%', borderRadius: '10px', background: sideFace(s.mine), border: '4px solid ' + col, boxShadow: `0 3px 8px rgba(0,0,0,.45), 0 0 0 2px ${col}, inset 0 0 0 1px rgba(255,255,255,.5)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
    const sideMark = `<div style="${st({ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fh)', fontWeight: 900, fontSize: '50px', color: col, opacity: s.mine ? 0.13 : 0.18, pointerEvents: 'none', zIndex: 0 })}">${s.mine ? '我' : '敌'}</div>`;
    const corner = { position: 'absolute', top: '4px', left: '5px', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '15px', color: sc, zIndex: 2 };
    const big = { fontSize: '40px', color: sc, marginTop: '-6px' };
    const badge = { position: 'absolute', top: '4px', right: '5px', minWidth: '22px', padding: '1px 6px', borderRadius: '99px', background: col, color: '#fff', fontFamily: 'var(--fn)', fontSize: '11px', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,.4)', zIndex: 2 };
    const zodRow = { position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '3px' };
    const zodCell = (g: string | undefined): string => {
      const filled = !!g; const cs = { width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', lineHeight: 1, background: filled ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.06)', border: '1px solid ' + (filled ? sc : 'rgba(120,90,60,.3)'), color: filled ? sc : 'transparent', boxShadow: filled ? `0 0 6px ${sc}66, inset 0 0 0 1px rgba(255,255,255,.6)` : 'inset 0 1px 2px rgba(0,0,0,.15)' };
      return `<div style="${st(cs)}">${filled ? (ZOD_ICON[g!] || g) : ''}</div>`;
    };
    // 新部署的兵 → 逐张落子 g-drop（fresh 序号错峰·叭叭叭）；否则推进了的兵 → g-adv 滑入。
    const advAnim = s.fresh != null ? `;animation:g-drop .34s cubic-bezier(.2,.9,.3,1.25) both;animation-delay:${(s.fresh * 0.15).toFixed(2)}s` : (s.justMoved ? `;animation:${s.mine ? 'g-adv-a' : 'g-adv-b'} .45s cubic-bezier(.2,.8,.3,1) both` : '');
    unitHTML = `<div style="${st(unit)}${advAnim}">${sideMark}<div style="${st(corner)}">${esc(s.rank)}${SUITG[s.suit]}</div><span style="${st(big)};position:relative;z-index:1">${SUITG[s.suit]}</span><div style="${st(badge)}">${s.power ?? ''}</div><div style="${st(zodRow)}">${forr([0, 1, 2], (z) => zodCell(zod[z]))}</div></div>`;
  }
  const ring = s.isClash ? `<div style="${st({ position: 'absolute', inset: '-3px', borderRadius: '11px', border: '2px solid var(--accent)', boxShadow: '0 0 16px var(--accent-soft)', animation: 'g-pulse 1.4s ease-in-out infinite' })}"></div>` : '';
  // 放牌区可落点高亮（owner 2026-06-21）：选牌待放时，此格金边脉冲 + 「＋放这」提示，点该路即落子。
  const placeMark = s.placeable
    ? `<div style="${st({ position: 'absolute', inset: '2px', borderRadius: '10px', animation: 'g-place 1.05s ease-in-out infinite', pointerEvents: 'none', zIndex: 3 })}"></div>`
      + `<div style="${st({ position: 'absolute', top: '50%', left: '50%', width: '46px', height: '46px', borderRadius: '50%', border: '2px solid var(--gold)', animation: 'g-ripple 1.05s ease-out infinite', pointerEvents: 'none', zIndex: 3 })}"></div>`
      + `<div style="${st({ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '27px', lineHeight: 1, animation: 'g-tap 1.05s ease-in-out infinite', pointerEvents: 'none', zIndex: 4, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.75))' })}">👆</div>`
      + `<div style="${st({ position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '10px', letterSpacing: '.04em', color: 'var(--gold)', textShadow: '0 1px 3px rgba(0,0,0,.8)', pointerEvents: 'none', zIndex: 4, whiteSpace: 'nowrap' })}">放这里</div>`
    : '';
  // 场上兵的磨砂详情浮层（与手牌同 cardTip·战力拆解）。
  const tip = s.hasUnit && s.rank && s.suit ? cardTip({ name: s.name ?? (SUITNM[s.suit] + s.rank), rar: s.rar ?? 'white', isGang: false, mine: s.mine, suit: s.suit, pts: s.pts, buff: s.buff, power: s.power, zod: s.zod }) : '';
  const wrapCls = s.hasUnit ? ` class="gg-tipwrap${s.tipDown ? ' tip-down' : ''}${s.tipSide === 'left' ? ' tip-left' : s.tipSide === 'right' ? ' tip-right' : ''}"` : '';
  // 掷命预报徽标（owner 2026-06-21·让玩家落子前就知道这仗几成赢）：贴此前锋格顶·档位词 + 具体 %。
  let fcast = '';
  if (s.forecast != null) {
    const [lab, col] = oddsTier(s.forecast); const pct = Math.round(s.forecast * 100);
    fcast = `<div style="${st({ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', padding: '2px 9px', borderRadius: '99px', background: 'rgba(10,14,20,.92)', border: '1px solid ' + col, color: col, fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap', zIndex: 8, boxShadow: `0 2px 9px rgba(0,0,0,.55), 0 0 10px ${col}55` })}">⚔ ${lab} ${pct}%</div>`;
  }
  return `<div${wrapCls} style="${st(cell)}">${depLabel}<div style="${st(dot)}"></div>${unitHTML}${placeMark}${ring}${tip}${fcast}</div>`;
}

function laneRow(L: TurnLaneView, li: number, hiOn = false): string {
  const row = { flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '10px' };
  const tag = { width: '40px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', textAlign: 'center', padding: '8px 3px', borderRadius: '8px', background: 'var(--chip)', border: '1px solid var(--panel-border)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '13px', color: 'var(--ink)', letterSpacing: '.1em' };
  const track = { position: 'relative', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '6px', alignItems: 'stretch', padding: '8px 6px', borderRadius: '12px', background: 'var(--lane)', border: '1px solid var(--cell-edge)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 26px rgba(0,0,0,.28)' };
  return `<div style="${st(row)}"><div style="${st(tag)}">${esc(L.name)}</div><div data-lane="${li}" style="${st(track)}${hiOn ? HL : ''}">${forr(L.slots, slotCell)}</div></div>`;
}

// 磨砂详情浮层内容（owner 2026-06-21）：战力拆解(点数+期待加成) + 对决随机骰提示 / 天罡效果文案。手牌与场上兵共用。
function cardTip(o: { name: string; rar: string; isGang: boolean; mine: boolean; suit?: string; pts?: number; buff?: number; power?: number; zod?: string[]; desc?: string; cost?: number }): string {
  const rc = RAR[o.rar] || RAR.white;
  const rows: string[] = [];
  if (o.isGang) {
    rows.push(`<span style="color:#a98bff;font-weight:700">持续战法</span> · 消耗 ${o.cost ?? CAST_COST} 召唤源泉`);
    if (o.desc) rows.push(`<span style="opacity:.9">${esc(o.desc)}</span>`);
    rows.push(`<span style="opacity:.58">打出后整场为你加成</span>`);
  } else {
    const sn = o.suit ? SUITNM[o.suit] : ''; const sg = o.suit ? SUITG[o.suit] : ''; const sc = o.suit ? SUITC[o.suit] : '#888';
    const buff = o.buff ?? 0; const pts = o.pts ?? ((o.power ?? 0) - buff); const pow = o.power ?? (pts + buff);
    const calc = buff ? `点数 ${pts} ${buff > 0 ? '+' : '−'} 加成 ${Math.abs(buff)}` : `点数 ${pts}`;
    rows.push(`花色 <b style="color:${sc}">${sn} ${sg}</b>`);
    rows.push(`战力 <b style="color:#ffd27a;font-size:13px">${pow}</b> <span style="opacity:.62">= ${calc}</span>`);
    rows.push(`<span style="opacity:.6">掷命对决再 +一次随机骰(±) 定胜负</span>`);
    const zods = (o.zod || []).filter(Boolean);
    if (zods.length) rows.push(`生肖 ${zods.map((z) => ZOD_ICON[z] || z).join(' ')}`);
  }
  const head = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${rc[1]};box-shadow:0 0 6px ${rc[1]}"></span><b style="font-size:12px;color:#fff">${esc(o.name)}</b><span style="margin-left:auto;font-size:10px;color:${rc[1]}">${rc[0]}</span></div>`;
  const body = rows.map((r) => `<div>${r}</div>`).join('');
  return `<div class="gg-tip">${head}<div style="display:flex;flex-direction:column;gap:3px;">${body}</div><div style="margin-top:7px;font-size:9px;opacity:.5;letter-spacing:.05em">${o.mine ? '我方' : '敌方'}牌 · 悬浮查看</div></div>`;
}

const costDropHtml = (n: number): string => {
  if (n <= 0) return '';
  const drop = st({ display: 'inline-block', width: '7px', height: '9px', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'linear-gradient(180deg,#8fe0ff,#2f93cf)', boxShadow: '0 0 3px rgba(95,200,240,.7)', flexShrink: '0' });
  const drops = Array.from({ length: Math.min(n, 5) }, () => `<div style="${drop}"></div>`).join('');
  return `<div style="display:flex;gap:2px;align-items:center;">${drops}</div>`;
};

function handCard(c: TurnHandCardView, i: number, hiOn = false, edge: 'left' | 'right' | '' = ''): string {
  const rc = RAR[c.rar] || RAR.white;
  const edgeCls = edge === 'left' ? ' tip-left' : edge === 'right' ? ' tip-right' : ''; // 边缘牌浮层往内弹·不溢出屏幕（owner 2026-06-21）
  const notAfford = c.affordable === false;
  const affordSty = notAfford ? ';opacity:0.42;filter:grayscale(0.65)' : '';
  const selSty = (c.selected ? ';outline:3px solid var(--gold);outline-offset:2px' : '') + (hiOn ? HL : '');
  const rarDot = { position: 'absolute', top: c.kind === 'gang' ? '8px' : '-4px', left: c.kind === 'gang' ? '8px' : '50%', transform: c.kind === 'gang' ? 'none' : 'translateX(-50%)', width: c.kind === 'gang' ? '10px' : '9px', height: c.kind === 'gang' ? '10px' : '9px', borderRadius: '50%', background: rc[1], boxShadow: `0 0 7px ${rc[1]}`, border: '1px solid rgba(255,255,255,.6)' };
  const costPill = { position: 'absolute', top: c.kind === 'gang' ? '7px' : '6px', right: c.kind === 'gang' ? '8px' : '7px', minWidth: '22px', padding: '1px 6px', borderRadius: '99px', background: 'var(--gold-grad)', color: '#2a1a08', fontFamily: 'var(--fn)', fontSize: '11px', textAlign: 'center', fontWeight: 700 };
  if (c.kind === 'gang') {
    const tint = '#a98bff';
    const card = { position: 'relative', width: '96px', height: '120px', borderRadius: '12px', background: 'var(--panel)', border: '2px solid ' + rc[1], boxShadow: '0 6px 16px rgba(0,0,0,.4), inset 0 0 0 1px var(--hairline)' };
    const top = { height: '44px', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg,${tint}44,${tint}11)`, borderBottom: '1px solid ' + tint };
    const icon = { width: '40px', height: '40px', borderRadius: '50%', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontSize: '24px', color: '#fff', boxShadow: `0 0 14px ${tint}` };
    return `<div data-hand="${i}" class="gg-tipwrap${edgeCls}" style="${st(card)};cursor:pointer${selSty}${affordSty}${c.dealt ? ';animation:g-deal .46s cubic-bezier(.2,.85,.3,1.12) both' : ''}"><div style="${st(rarDot)}"></div><div style="${st(top)}"><div style="${st(icon)}">${esc(c.glyph || '✦')}</div></div><div style="padding:10px 9px;"><div style="font-family:var(--fb); font-weight:700; font-size:13px; color:var(--ink); text-align:center;">${esc(c.name)}</div><div style="font-size:10px; color:var(--ink-dim); text-align:center; line-height:1.4; margin-top:4px;">${esc(c.desc || '')}</div></div>${c.cost > 0 ? `<div style="position:absolute;bottom:7px;left:8px;">${costDropHtml(c.cost)}</div>` : ''}${cardTip({ name: c.name, rar: c.rar, isGang: true, mine: true, desc: c.desc, cost: c.cost })}</div>`;
  }
  const sc = c.suit ? SUITC[c.suit] : '#22303f'; const zod = c.zod || [];
  const card = { position: 'relative', width: '96px', height: '120px', borderRadius: '12px', background: sideFace(true), border: '2px solid ' + rc[1], boxShadow: '0 6px 16px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }; // 手牌=我方·暖橙底纹
  const cornerTL = { position: 'absolute', top: '5px', left: '7px', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '14px', lineHeight: '.86', color: sc, textAlign: 'center' };
  const big = { fontSize: '36px', color: sc, marginTop: '-14px' };
  const nameP = { position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', padding: '1px 9px', borderRadius: '99px', background: 'rgba(20,16,10,.8)', color: '#fff', fontFamily: 'var(--fb)', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' };
  const badge = { position: 'absolute', top: '6px', right: '7px', minWidth: '22px', padding: '1px 6px', borderRadius: '99px', background: '#ff7a45', color: '#fff', fontFamily: 'var(--fn)', fontSize: '10px', textAlign: 'center', fontWeight: 700 };
  const zodRow = { position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '3px' };
  const zodCell = (g: string | undefined): string => { const f = !!g; return `<div style="${st({ width: '20px', height: '20px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', lineHeight: 1, background: f ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.06)', border: '1px solid ' + (f ? sc : 'rgba(120,90,60,.3)'), boxShadow: f ? `0 0 5px ${sc}66` : 'inset 0 1px 2px rgba(0,0,0,.15)' })}">${f ? (ZOD_ICON[g!] || g) : ''}</div>`; };
  const g = c.suit ? SUITG[c.suit] : '';
  return `<div data-hand="${i}" class="gg-tipwrap${edgeCls}" style="${st(card)};cursor:pointer${selSty}${affordSty}${c.dealt ? ';animation:g-deal .46s cubic-bezier(.2,.85,.3,1.12) both' : ''}"><div style="${st(rarDot)}"></div><div style="${st(cornerTL)}">${esc(c.rank || '')}<br>${g}</div><span style="${st(big)}">${g}</span><div style="${st(nameP)}">${esc(c.name)}</div><div style="${st(badge)}">${c.power ?? ''}</div>${c.cost > 0 ? `<div style="position:absolute;bottom:7px;left:7px;">${costDropHtml(c.cost)}</div>` : ''}<div style="${st(zodRow)}">${forr([0, 1, 2], (z) => zodCell(zod[z]))}</div>${cardTip({ name: c.name, rar: c.rar, isGang: false, mine: true, suit: c.suit, pts: c.pts, buff: c.buff, power: c.power, zod: c.zod })}</div>`;
}

function clashOverlay(cv: TurnClashView): string {
  const backdrop = { position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,9,13,.74)', backdropFilter: 'blur(5px)', animation: 'g-fade .3s ease both' }; // z60 > 底部手牌坞(z50)：对决覆盖层盖住一切·确认钮不被遮
  const panel = { position: 'relative', width: '760px', padding: '22px 34px 24px', borderRadius: '22px', background: 'radial-gradient(80% 70% at 50% 30%, #1c2940, #0e1828)', border: '2px solid var(--gold)', boxShadow: 'inset 0 0 0 1px var(--hairline), 0 40px 90px rgba(0,0,0,.7), 0 0 60px rgba(232,205,138,.2)' };
  const duelCard = (c: TurnClashCardView, isMine: boolean): string => {
    const col = isMine ? '#ff7a45' : '#3a86d4'; const sc = SUITC[c.suit];
    // 入场：从「桌面」3D 翻起飞到眼前（我方左下 / 敌方右下·flat→竖立·小→大），落到特写就位点。owner 2026-06-20。
    const flyIn = isMine ? 'g-fly-mine .6s cubic-bezier(.16,.84,.3,1) both' : 'g-fly-foe .6s cubic-bezier(.16,.84,.3,1) both';
    const card = { position: 'relative', width: '180px', height: '252px', borderRadius: '15px', background: sideFace(isMine), border: '4px solid ' + col, boxShadow: c.won ? `0 0 44px ${col}aa, 0 20px 40px rgba(0,0,0,.5)` : `0 0 0 3px ${col}66, 0 20px 40px rgba(0,0,0,.6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: c.won ? 1 : 0.72, filter: c.won ? 'none' : 'grayscale(.35) brightness(.82)', backfaceVisibility: 'hidden', animation: flyIn };
    const corner = { position: 'absolute', top: '9px', left: '11px', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '22px', lineHeight: '.86', color: sc, textAlign: 'center' };
    const big = { fontSize: '96px', color: sc };
    const zchip = { position: 'absolute', top: '10px', right: '12px', width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid ' + sc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontSize: '21px', color: sc };
    const nameP = { position: 'absolute', bottom: '34px', left: '50%', transform: 'translateX(-50%)', padding: '3px 15px', borderRadius: '99px', background: 'rgba(20,16,10,.8)', color: '#fff', fontFamily: 'var(--fb)', fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap' };
    const verdict = { position: 'absolute', bottom: '-15px', left: '50%', transform: 'translateX(-50%)', padding: '4px 16px', borderRadius: '99px', background: c.won ? 'var(--hp)' : 'var(--danger)', color: c.won ? '#06281a' : '#fff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.4)' };
    const glow = c.won && isMine ? `<div style="${st({ position: 'absolute', inset: '-20px', borderRadius: '24px', background: 'radial-gradient(circle, rgba(255,122,69,.4), transparent 70%)', pointerEvents: 'none' })}"></div>` : '';
    const sideTag = `<div style="${st({ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', padding: '4px 18px', borderRadius: '99px', background: col, color: '#fff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '15px', letterSpacing: '.08em', whiteSpace: 'nowrap', boxShadow: `0 4px 14px ${col}88`, zIndex: 4 })}">${isMine ? '我方' : '敌方'}</div>`;
    return `<div style="${st(card)}">${glow}${sideTag}<div style="${st(corner)}">${esc(c.rank)}<br>${SUITG[c.suit]}</div><span style="${st(big)}">${SUITG[c.suit]}</span>${c.zod ? `<div style="${st(zchip)}">${esc(c.zod)}</div>` : ''}<div style="${st(nameP)}">${esc(c.name)}</div><div style="${st(verdict)}">${c.won ? '正面 · 存活' : '反面 · 阵亡'}</div></div>`;
  };
  const spark = { width: '90px', height: '90px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,235,160,.95), rgba(255,150,40,.4) 50%, transparent 72%)', animation: 'g-spark 1.2s ease-in-out infinite' };
  const coin = { width: '72px', height: '72px', borderRadius: '50%', background: 'var(--gold-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a1a08', border: '3px solid #fff', boxShadow: '0 0 26px rgba(232,205,138,.6)', marginTop: '-30px', animation: 'g-coin-pop .45s .4s cubic-bezier(.2,1.3,.4,1) both' };
  const foePct = 100 - cv.oddsMine;
  const oddsTrack = { position: 'relative', height: '26px', borderRadius: '99px', background: 'rgba(0,0,0,.5)', overflow: 'hidden', display: 'flex' };
  const bonusCol = (rows: [string, number][], head: string, headCol: string, valCol: string, total?: number): string => {
    const col = { flex: 1, padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)' };
    const hd = { fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: headCol, marginBottom: '9px', fontWeight: 700 };
    const rowHtml = ([label, num]: [string, number]): string => {
      const sub = label.startsWith('　'); // 逐张溯源子行：缩进/淡化
      return `<div style="${st({ display: 'flex', alignItems: 'center', padding: sub ? '2px 0' : '4px 0' })}"><span style="flex:1; font-size:${sub ? '11px' : '12px'}; color:rgba(255,255,255,${sub ? '.58' : '.82'});">${esc(label)}</span><span style="font-family:var(--fn); font-size:${sub ? '12px' : '14px'}; color:${num < 0 ? '#e8804a' : valCol}; opacity:${sub ? 0.82 : 1};">${num > 0 ? '+' : ''}${num}</span></div>`;
    };
    const totalRow = total != null ? `<div style="${st({ display: 'flex', alignItems: 'center', marginTop: '6px', paddingTop: '7px', borderTop: '1px solid rgba(255,255,255,.16)' })}"><span style="flex:1; font-size:12px; font-weight:700; color:#fff;">＝ 战力</span><span style="font-family:var(--fn); font-size:18px; font-weight:700; color:${headCol};">${total}</span></div>` : '';
    return `<div style="${st(col)}"><div style="${st(hd)}">${esc(head)}</div>${forr(rows, rowHtml)}${totalRow}</div>`;
  };
  return `<div style="${st(backdrop)}"><div style="${st(panel)}">
    <div style="position:absolute; top:14px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:10px; padding:6px 22px; border-radius:99px; background:rgba(232,205,138,.14); border:1px solid var(--gold);"><span style="${st({ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' })}"></span><span style="font-family:var(--fh); font-weight:700; font-size:19px; color:var(--gold); letter-spacing:.08em;">⚔ ${esc(cv.laneName)} · 掷命对决</span><span style="${st({ width: '10px', height: '10px', borderRadius: '50%', background: '#3a86d4', boxShadow: '0 0 10px #3a86d4' })}"></span></div>
    <div style="display:flex; align-items:center; justify-content:center; gap:36px; margin-top:42px; perspective:1100px;">
      ${duelCard(cv.mine, true)}
      <div style="display:flex; flex-direction:column; align-items:center; gap:14px;"><div style="${st(spark)}"></div><div style="${st(coin)}"><span style="font-family:var(--fd); font-size:30px;">掷</span></div><div style="font-family:var(--fn); font-size:13px; color:var(--gold);">命点 ${cv.rollPct}/100</div></div>
      ${duelCard(cv.foe, false)}
    </div>
    <div style="margin-top:22px; padding:0 30px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;"><span style="font-family:var(--fn); font-size:24px; color:var(--accent);">${cv.oddsMine}%</span><span style="font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.6);">胜率 · 战力差→概率</span><span style="font-family:var(--fn); font-size:24px; color:#5ea0e0;">${foePct}%</span></div>
      <div style="${st(oddsTrack)}"><div style="${st({ width: cv.oddsMine + '%', background: 'var(--accent-grad)', boxShadow: '0 0 14px var(--accent-soft)' })}"></div><div style="${st({ width: foePct + '%', background: 'linear-gradient(180deg,#5ea0e0,#2a5f9e)' })}"></div></div>
      <div style="display:flex; gap:10px; margin-top:16px;">${bonusCol(cv.bonusMine, '我方加成明细', 'var(--accent)', 'var(--accent)', cv.pEffMine)}${bonusCol(cv.bonusFoe, '敌方加成明细', '#5ea0e0', '#5ea0e0', cv.pEffFoe)}</div>
      <div style="margin-top:11px; text-align:center; font-size:11px; line-height:1.6; color:rgba(255,255,255,.62);">战力 = 点数 + 经营 + 天罡(逐张) + 士气　→　双方战力比差过 S 形曲线出<b style="color:var(--accent)">胜率 ${cv.oddsMine}%</b>（永留 3% 爆冷缝）　→　掷命点 <b style="color:var(--gold)">${cv.rollPct}</b> ${cv.rollPct < cv.oddsMine ? '＜' : '≥'} ${cv.oddsMine} 定${cv.mine.won ? '生' : '死'}</div>
    </div>
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; margin-top:16px;">
      <div style="font-family:var(--fh); font-weight:700; font-size:17px; letter-spacing:.06em; color:${cv.mine.won ? 'var(--hp)' : 'var(--danger)'};">本场 ${cv.mine.won ? '我方胜' : '敌方胜'}｜${esc(cv.laneName)}前锋对决</div>
      <button data-act="clash-ok" style="${st({ padding: '13px 40px', borderRadius: '13px', border: 'none', cursor: 'pointer', background: 'var(--gold-grad)', color: '#2a1a08', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '17px', letterSpacing: '.04em', boxShadow: '0 10px 28px rgba(232,205,138,.4)' })}">看明白了 · 继续 ▸</button>
    </div>
  </div></div>`;
}

/** 回合制战斗屏「画框」HTML（固定 1340×858·无页 root·供 live mount 缩放嵌入）。双皮 token 由外层挂。
 *  drain：本次刚消耗的召唤源泉（from=收退起格·count=退几格）→ 源泉「往后退」收退动效（owner 2026-06-21）。静态渲染/golden 默认无。 */
export function buildTurnFrameHTML(view: TurnBattleView, drain: { from: number; count: number } = { from: 0, count: 0 }): string {
  const frame = { position: 'relative', width: '1340px', height: '858px', borderRadius: '16px', overflow: 'hidden', background: 'var(--paper)', border: '3px solid var(--frame-edge)', boxShadow: '0 30px 80px rgba(0,0,0,.6), inset 0 0 0 1px var(--hairline)', display: 'flex', flexDirection: 'column' };
  const topbar = { display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 22px', borderBottom: '1px solid var(--panel-border)' };
  const seal = { width: '42px', height: '42px', flex: 'none', borderRadius: '11px', background: 'linear-gradient(150deg,#3a4f78,#28385a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', border: '1px solid var(--hairline)' };
  const turnBox = { display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 14px', borderRadius: '11px', background: 'var(--accent-soft)', border: '1px solid var(--accent)' };
  const turnDot = { width: '9px', height: '9px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' };
  const endBtn = { padding: '10px 20px', borderRadius: '11px', clipPath: 'var(--chamfer)', cursor: 'pointer', border: 'none', background: 'var(--gold-grad)', color: '#2a1a08', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '15px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)' };
  const seg = (on: boolean): Style => ({ padding: '7px 13px', borderRadius: '9px', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--gold)' : 'var(--panel-border)'), background: on ? 'var(--gold-grad)' : 'transparent', color: on ? '#2a1a08' : 'var(--ink-dim)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' });
  const body = { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '10px 22px 6px', gap: '10px' };
  const boardWrap = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '6px', padding: '12px 10px', borderRadius: '18px', background: 'var(--board)', backgroundImage: 'radial-gradient(46% 80% at 50% 50%, rgba(232,205,138,.10), transparent 70%), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 34px)', border: '6px solid var(--board-edge)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.06), inset 0 0 90px rgba(0,0,0,.5)' };
  const lanesCol = { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'stretch', minHeight: 0 };
  // water bar
  const litCells = Math.max(0, Math.min(view.waterMax, Math.floor(view.water)));
  const waterBar = { flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 18px', borderRadius: '14px', background: 'var(--panel)', border: '1px solid var(--panel-border)', boxShadow: 'inset 0 0 0 1px var(--hairline)' };
  const waterCap = { width: '36px', height: '36px', flex: 'none', borderRadius: '10px', background: 'radial-gradient(circle at 38% 30%, #7fd8f5, #2a7fb8)', border: '2px solid #bfeaff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(77,182,232,.7), inset 0 1px 0 rgba(255,255,255,.6)' };
  const waterTube = { position: 'relative', flex: 1, height: '34px', borderRadius: '12px', background: 'linear-gradient(180deg, rgba(10,30,46,.9), rgba(6,16,26,.95))', border: '2px solid #2f5e7e', overflow: 'hidden', display: 'flex', gap: '4px', padding: '4px', boxShadow: 'inset 0 0 14px rgba(0,0,0,.7), 0 0 0 1px rgba(191,234,255,.12)' };
  // 收退残影：刚花掉的格里覆一层「仍亮」的鬼影，g-drain 向源头收退淡出 + 升腾火花（owner 2026-06-21·别 biang 剪掉）。
  const drainGhost = { position: 'absolute', inset: 0, borderRadius: '5px', transformOrigin: 'left center', background: 'linear-gradient(180deg,#8fe0ff,#2f93cf)', boxShadow: '0 0 14px rgba(95,200,240,.95), inset 0 1px 0 rgba(255,255,255,.6)', animation: 'g-drain .52s ease both', pointerEvents: 'none', zIndex: 2 };
  const drainSpark = { position: 'absolute', top: '-2px', left: '50%', width: '6px', height: '6px', borderRadius: '50%', background: 'radial-gradient(circle,#dff6ff,#7fd0f0 60%,transparent)', boxShadow: '0 0 8px rgba(150,220,255,.9)', animation: 'g-drainspark .52s ease-out both', pointerEvents: 'none', zIndex: 3 };
  const waterCellsHTML = forr(Array.from({ length: view.waterMax }, (_, i) => i), (i) => {
    const lit = i < litCells;
    const draining = drain.count > 0 && i >= drain.from && i < drain.from + drain.count;
    const cs = { position: 'relative', flex: 1, borderRadius: '5px', zIndex: 1, background: lit ? 'linear-gradient(180deg,#8fe0ff,#2f93cf)' : 'rgba(255,255,255,.05)', border: '1px solid ' + (lit ? 'rgba(190,238,255,.8)' : 'rgba(255,255,255,.08)'), boxShadow: lit ? '0 0 10px rgba(95,200,240,.7), inset 0 1px 0 rgba(255,255,255,.6)' : 'none' };
    return `<div style="${st(cs)}">${draining ? `<div style="${st(drainGhost)}"></div><div style="${st(drainSpark)}"></div>` : ''}</div>`;
  });
  const waterPlus = { padding: '2px 9px', borderRadius: '99px', background: 'rgba(70,209,122,.18)', border: '1px solid var(--hp)', color: 'var(--hp)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' };
  // bottom
  const bottomBar = { position: 'relative', zIndex: 50, flex: 'none', height: '212px', display: 'flex', gap: '14px', padding: '12px 22px 16px', borderTop: '1px solid var(--panel-border)', background: 'linear-gradient(180deg,transparent,rgba(0,0,0,.18))' };
  const actionMenu = { width: '230px', flex: 'none', padding: '13px 14px', borderRadius: '14px', background: 'var(--panel)', border: '1px solid var(--panel-border)', boxShadow: 'inset 0 0 0 1px var(--hairline)' };
  const hi = view.tutorial?.highlight ?? '';
  const actBtn = (a: TurnActionView): string => {
    const s = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px 8px', borderRadius: '10px', cursor: a.dim ? 'not-allowed' : 'pointer', border: '1px solid ' + (a.on ? 'var(--accent)' : 'var(--panel-border)'), background: a.on ? 'var(--accent-grad)' : 'var(--chip)', color: a.on ? '#fff' : 'var(--ink)', opacity: a.dim ? 0.4 : 1, boxShadow: a.on ? '0 4px 14px var(--accent-soft)' : 'none', textAlign: 'center' };
    const icon = { width: '26px', height: '26px', flex: 'none', borderRadius: '7px', background: a.on ? 'rgba(255,255,255,.2)' : 'var(--track)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' };
    return `<button data-act="${esc(a.key)}" data-anchor="combat-${esc(a.key)}" style="${st(s)}${hi === 'act:' + a.key ? HL : ''}"><span style="${st(icon)}">${esc(a.glyph)}</span><span style="font-family:var(--fh); font-weight:700; font-size:14px;">${esc(a.label)}</span></button>`;
  };
  // 教学旁白横幅（doc28·教官旁白·覆于棋盘上方·不挡操作）。
  const narrationBanner = view.tutorial?.narration
    ? `<div style="${st({ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 56, maxWidth: '74%', padding: '10px 20px', borderRadius: '14px', background: 'linear-gradient(180deg,rgba(28,40,58,.97),rgba(14,24,38,.98))', border: '2px solid var(--gold)', boxShadow: '0 10px 30px rgba(0,0,0,.5), 0 0 30px rgba(232,205,138,.25)', color: 'var(--ink)', fontFamily: 'var(--fb)', fontSize: '14px', lineHeight: 1.5, textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px' })}"><span style="font-size:22px;">🎓</span><span>${esc(view.tutorial.narration)}</span></div>`
    : '';
  // 临时提示 toast（放牌后可翻一道机关门 / 非时翻门无效）。✗ 开头=警示红·否则金提示。
  const isWarn = view.notice?.startsWith('✗');
  const noticeBanner = view.notice
    ? `<div style="${st({ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 57, maxWidth: '78%', padding: '9px 20px', borderRadius: '99px', background: isWarn ? 'rgba(60,18,18,.96)' : 'rgba(20,34,26,.96)', border: '1.5px solid ' + (isWarn ? 'var(--danger)' : 'var(--hp)'), boxShadow: '0 8px 24px rgba(0,0,0,.5)', color: isWarn ? '#ffd2d2' : '#cdeccd', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', animation: 'g-fade .2s ease both' })}">${esc(view.notice)}</div>`
    : '';
  const actionHint = { marginTop: '9px', padding: '8px 10px', borderRadius: '9px', background: 'var(--chip)', border: '1px solid var(--panel-border)', fontSize: '11px', color: 'var(--ink-dim)', lineHeight: 1.4, textAlign: 'center' };
  const handArea = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '13px 16px', borderRadius: '14px', background: 'var(--panel)', border: '1px solid var(--panel-border)', boxShadow: 'inset 0 0 0 1px var(--hairline)' };
  const handCount = { padding: '3px 10px', borderRadius: '99px', background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '11px', border: '1px solid var(--accent)' };
  const handCountGang = { padding: '3px 10px', borderRadius: '99px', background: 'rgba(140,110,255,.16)', color: '#a98bff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '11px', border: '1px solid #a98bff' };

  const drawPanel = view.drawPick
    ? `<div style="display:flex; gap:7px; margin-top:8px;"><button data-act="draw-poker" style="${st({ flex: 1, padding: '8px 6px', borderRadius: '9px', cursor: 'pointer', border: '1px solid var(--accent)', background: 'var(--chip)', color: 'var(--ink)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '12px' })}">🎴 摸扑克</button><button data-act="draw-tengang" style="${st({ flex: 1, padding: '8px 6px', borderRadius: '9px', cursor: 'pointer', border: '1px solid #a98bff', background: 'var(--chip)', color: '#cdbcff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '12px' })}">✦ 摸天罡</button></div>`
    : '';
  const backBtnSty: Style = { padding: '7px 13px', borderRadius: '9px', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'transparent', color: 'var(--ink-dim)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' };
  const gearSty: Style = { padding: '7px 10px', borderRadius: '9px', cursor: 'pointer', border: '1px solid ' + (view.settingsOpen ? 'var(--gold)' : 'var(--panel-border)'), background: view.settingsOpen ? 'rgba(232,205,138,.18)' : 'transparent', color: view.settingsOpen ? 'var(--gold)' : 'var(--ink-dim)', fontSize: '15px', lineHeight: 1 };
  const togSty = (on: boolean, col = 'var(--hp)'): Style => ({ padding: '4px 11px', borderRadius: '7px', cursor: 'pointer', border: '1px solid ' + (on ? col : 'var(--panel-border)'), background: on ? 'rgba(70,209,122,.14)' : 'transparent', color: on ? col : 'var(--ink-dim)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '12px' });
  const sfxTogSty: Style = togSty(view.sfxOn);
  const volBtnSty: Style = { width: '24px', height: '24px', borderRadius: '7px', cursor: 'pointer', border: '1px solid var(--panel-border)', background: 'transparent', color: 'var(--ink)', fontWeight: 700, fontSize: '14px', lineHeight: 1, fontFamily: 'var(--fh)' };
  const trackRow = (nm: string, i: number): string => `<button data-act="bgm-track" data-k="${i}" style="${st({ display: 'block', width: '100%', textAlign: 'left', padding: '5px 9px', marginBottom: '4px', borderRadius: '7px', cursor: 'pointer', border: '1px solid ' + (view.bgmIdx === i ? 'var(--accent)' : 'var(--panel-border)'), background: view.bgmIdx === i ? 'var(--accent-soft)' : 'transparent', color: view.bgmIdx === i ? 'var(--accent)' : 'var(--ink-dim)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '12px' })}">${view.bgmIdx === i ? '♪ ' : ''}${esc(nm)}</button>`;
  const bgmBlock = view.bgmOn ? `<div style="margin:8px 0 2px;">${forr(view.bgmNames, (nm, i) => trackRow(nm, i))}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="flex:1;font-size:11px;color:var(--ink-dim);font-family:var(--fh);">音量</span><button data-act="bgm-vol" data-k="down" style="${st(volBtnSty)}">−</button><span style="min-width:34px;text-align:center;font-size:12px;color:var(--ink);font-family:var(--fn);">${Math.round(view.bgmVol * 100)}%</span><button data-act="bgm-vol" data-k="up" style="${st(volBtnSty)}">＋</button></div>` : '';
  const settingsPanel = view.settingsOpen ? `<div style="${st({ position: 'absolute', top: '70px', right: '22px', zIndex: 80, padding: '14px 16px', borderRadius: '14px', background: 'var(--panel)', border: '1px solid var(--panel-border)', boxShadow: '0 8px 30px rgba(0,0,0,.6), inset 0 0 0 1px var(--hairline)', minWidth: '214px', animation: 'g-fade .18s ease both' })}">
    <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:10px;font-weight:700;">⚙ 设置</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="flex:1;font-size:13px;color:var(--ink);font-family:var(--fh);">${view.sfxOn ? '🔊' : '🔇'} 音效</span><button data-act="toggle-sfx" style="${st(sfxTogSty)}">${view.sfxOn ? '开' : '关'}</button></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><span style="flex:1;font-size:13px;color:var(--ink);font-family:var(--fh);">${view.bgmOn ? '🎵' : '🎵'} 背景音乐</span><button data-act="toggle-bgm" style="${st(togSty(view.bgmOn, 'var(--accent)'))}">${view.bgmOn ? '开' : '关'}</button></div>
    ${bgmBlock}
    <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:6px;font-weight:700;">主题</div>
    <div style="display:flex;gap:6px;"><button data-act="theme" data-k="onyx" style="${st(seg(view.theme === 'onyx'))}">玄铁</button><button data-act="theme" data-k="brocade" style="${st(seg(view.theme === 'brocade'))}">锦霞</button></div>
  </div>` : '';
  return `<div style="${st(frame)}">
    <div style="${st(topbar)}">
      <div style="display:flex; align-items:center; gap:11px;"><div style="${st(seal)}">♠</div><div style="display:flex; flex-direction:column; line-height:1.2;"><span style="font-family:var(--fh); font-weight:700; font-size:15px; color:var(--ink); white-space:nowrap;">${esc(view.battleLabel)}</span><span style="font-size:10px; color:var(--ink-dim);">单机 · 回合制</span></div></div>
      <div style="flex:1;"></div>
      <div style="${st(turnBox)}"><span style="${st(turnDot)}"></span><div style="display:flex; flex-direction:column; line-height:1.15;"><span style="font-family:var(--fh); font-weight:700; font-size:14px; color:var(--ink);">${esc(view.turnWho)}</span><span style="font-size:10px; color:var(--ink-dim);">第 ${view.roundNo} 回合</span></div></div>
      <button data-act="end" data-anchor="combat-end" style="${st(endBtn)}${hi === 'end' ? HL : ''}">结束回合 ▸</button>
      <div style="width:1px; height:26px; background:var(--panel-border); margin:0 4px;"></div>
      <button data-act="go-back" style="${st(backBtnSty)}">← 返回大厅</button>
      <button data-act="settings-toggle" style="${st(gearSty)}">⚙</button>
    </div>
    ${settingsPanel}
    <div style="${st(body)}">
      <div style="${st(boardWrap)}">
        ${narrationBanner}${noticeBanner}
        ${fortBase(view, true)}
        <div style="${st(lanesCol)}">${forr(view.lanes, (L, li) => laneRow(L, li, hi === 'lane:' + li))}${laddersLayer(view)}</div>
        ${fortBase(view, false)}
      </div>
      <div style="${st(waterBar)}">
        <div style="${st(waterCap)}"><span style="font-family:var(--fd); font-size:20px; color:#dff4ff;">源</span></div>
        <span style="font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-dim); white-space:nowrap;">召唤源泉 · SUMMON FONT</span>
        <div style="${st(waterTube)}">${waterCellsHTML}</div>
        <span style="font-family:var(--fn); font-size:22px; color:#cdeeff; text-shadow:0 0 10px rgba(77,182,232,.9);">${litCells}</span>
        <div style="width:1px;height:28px;background:var(--panel-border);flex-shrink:0;"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0;">
          <span style="font-size:9px;letter-spacing:.1em;color:var(--ink-dim);white-space:nowrap;">敌源泉</span>
          <span style="font-family:var(--fn);font-size:18px;color:#5ea0e0;">${view.waterB}</span>
        </div>
        <div style="width:1px;height:28px;background:var(--panel-border);flex-shrink:0;"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0;">
          <span style="font-size:9px;letter-spacing:.1em;color:var(--ink-dim);white-space:nowrap;">牌库</span>
          <span style="font-family:var(--fn);font-size:12px;color:var(--ink);">我 ${view.deckA} ｜ 敌 ${view.deckB}</span>
        </div>
        <span style="${st(waterPlus)}">本回合 +${MANA_PER_TURN}</span>
      </div>
    </div>
    <div style="${st(bottomBar)}">
      <div style="${st(actionMenu)}">
        <div style="font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-dim); margin-bottom:8px;">本回合动作（弃牌可追加）</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">${forr(view.actions, actBtn)}</div>
        ${drawPanel}
        <div style="${st(actionHint)}">${esc(view.actionSub)}</div>
      </div>
      <div style="${st(handArea)}">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"><span style="font-family:var(--fh); font-weight:700; font-size:14px; color:var(--ink); letter-spacing:.04em;">手牌</span><span style="${st(handCount)}">兵牌 ${view.handPawnCount}</span><span style="${st(handCountGang)}">天罡 ${view.handGangCount}</span><div style="flex:1;"></div><span style="font-size:11px; color:var(--ink-dim);">放牌消耗召唤源泉 · 点动作选「放牌」后落子</span></div>
        <div style="display:flex; gap:11px; align-items:flex-end;">${forr(view.hand, (c, i) => handCard(c, i, hi === 'hand:' + i, i === 0 ? 'right' : i === view.hand.length - 1 ? 'left' : ''))}</div>
      </div>
    </div>
    ${view.clash ? clashOverlay(view.clash) : ''}
  </div>`;
}

/** 出回合制战斗屏 HTML（整页·忠实端口设计稿；静息态 + 可选 clash 覆盖层）。root 上挂双皮 token。 */
export function buildTurnBattleHTML(view: TurnBattleView): string {
  const rootStyle: Style = { ...(THEMES[view.theme] ?? THEMES.onyx), minHeight: '100vh', background: '#0c0a08', padding: '22px', display: 'flex', justifyContent: 'center', fontFamily: 'var(--fb)' };
  return `<div style="${st(rootStyle)}">${buildTurnFrameHTML(view)}</div>`;
}

const SUIT_KEYS: Record<string, 's' | 'h' | 'd' | 'c'> = { S: 's', H: 'h', D: 'd', C: 'c', s: 's', h: 'h', d: 'd', c: 'c' };
const lc = (s: string): 's' | 'h' | 'd' | 'c' => SUIT_KEYS[s] ?? 's';
const rankOf = (r: string): 'white' | 'green' | 'blue' | 'gold' => (r === 'A' ? 'gold' : r === 'K' || r === 'Q' || r === 'J' ? 'blue' : 'white');

export interface TurnViewOpts { theme?: 'onyx' | 'brocade'; tengangName?: (id: string) => string; tengangDesc?: (id: string) => string; clash?: TurnClashView | null; sha?: TurnShaView[]; bossName?: string; selMode?: string | null; selHand?: number; tutorial?: { narration: string; highlight: string } | null; gatesLive?: boolean; notice?: string | null; movedIds?: Set<string>; freshIds?: Map<string, number>; dealtId?: string; battleLabel?: string; sfxOn?: boolean; settingsOpen?: boolean; bgmOn?: boolean; bgmIdx?: number; bgmVol?: number; bgmNames?: string[] }
/** 从 turn-combat 真状态派生战斗屏视图（玩家 = side a 视角）。纯读、不改 battle。 */
export function buildTurnBattleView(b: TurnBattle, opts: TurnViewOpts = {}): TurnBattleView {
  const laneNames = ['上路', '中路', '下路'];
  // 选牌待放(放的是兵牌)→ 各路放牌区「下一落点」高亮（owner 2026-06-21·与 turn-combat deployUnit 同找法：贴家那格起首个空位）。
  const selDeploy = opts.selMode === 'deploy' && (opts.selHand ?? -1) >= 0 && b.a.hand[opts.selHand ?? -1]?.kind === 'poker';
  const lanes: TurnLaneView[] = b.lanes.map((L, li) => {
    const bySlot = new Map<number, { u: TurnUnit; mine: boolean }>();
    for (const u of L.a) bySlot.set(u.slot, { u, mine: true });
    for (const u of L.b) bySlot.set(u.slot, { u, mine: false });
    const adj = L.a.length > 0 && L.b.length > 0 && Math.abs(L.a[0].slot - L.b[0].slot) <= 1;
    const odds = L.a.length > 0 && L.b.length > 0 ? clashOdds(b, li) : null; // 掷命预报：只要两路都有前锋就预览我方胜率（新同步推进模型下·放置期就看得见·不必相邻·owner 2026-06-21）
    const occA = new Set(L.a.map((u) => u.slot));
    const target = selDeploy ? [A_DEPLOY_SLOT, A_DEPLOY_SLOT + 1, A_DEPLOY_SLOT + 2].find((sl) => !occA.has(sl)) : undefined;
    const dep = (i: number): 1 | 2 | undefined => (i <= A_DEPLOY_SLOT + 2 ? 1 : i >= B_DEPLOY_SLOT - 2 ? 2 : undefined); // 我方放牌区 0..2 / 敌方 6..8
    const slots: TurnSlotView[] = Array.from({ length: SLOTS }, (_, i) => {
      const hit = bySlot.get(i);
      // isClash 标在两军真前锋格(landed bugfix·非固定中线 4) + 放牌区底纹/标签(标在贴各自城堡那格) + 待放落点高亮
      const base = { isBorder: i === 4, isClash: adj && (i === L.a[0]?.slot || i === L.b[0]?.slot), deploy: dep(i), deployLabel: i === A_DEPLOY_SLOT || i === B_DEPLOY_SLOT, placeable: !hit && i === target, forecast: i === L.a[0]?.slot && odds != null ? odds : undefined };
      return hit
        ? { ...base, hasUnit: true, mine: hit.mine, rank: hit.u.rank, suit: lc(hit.u.suit), power: hit.u.points + hit.u.buff, pts: hit.u.points, buff: hit.u.buff, name: SUITNM[lc(hit.u.suit)] + hit.u.rank, rar: rankOf(hit.u.rank), zod: [], unitId: hit.u.id, justMoved: opts.movedIds?.has(hit.u.id) ?? false, fresh: opts.freshIds?.get(hit.u.id), tipDown: li === 0, tipSide: (i >= 7 ? 'left' : i <= 1 ? 'right' : '') as 'left' | 'right' | '' }
        : { ...base, hasUnit: false, mine: i < 4 };
    });
    return { name: laneNames[li] ?? ('路' + li), slots };
  });
  const nameOf = opts.tengangName ?? ((id: string) => id);
  const descOf = opts.tengangDesc ?? (() => '持续战法·打出后整场生效');
  const hand: TurnHandCardView[] = b.a.hand.map((c, i) => c.kind === 'poker'
    ? { kind: 'pawn', rank: c.rank, suit: lc(c.suit), name: SUITNM[lc(c.suit)] + c.rank, power: cardPoints(c.rank) + c.buff, pts: cardPoints(c.rank), buff: c.buff, cost: c.cost ?? DEPLOY_COST, zod: [], rar: rankOf(c.rank), selected: opts.selHand === i, dealt: opts.dealtId != null && c.id === opts.dealtId, affordable: (c.cost ?? DEPLOY_COST) <= b.a.mana }
    : { kind: 'gang', name: nameOf(c.id), cost: CAST_COST, rar: 'gold', desc: descOf(c.id), glyph: '✦', selected: opts.selHand === i, dealt: opts.dealtId != null && c.id === opts.dealtId, affordable: CAST_COST <= b.a.mana });
  const ACT: [string, string, string][] = [['draw', '🎴', '抽牌'], ['deploy', '♟', '放牌'], ['cast', '✦', '打天罡'], ['discard', '🗑', '弃牌']];
  const sel = b.actionTaken;
  const mode = opts.selMode ?? sel; // 当前高亮动作类：未提交时取 UI 选中(selMode)，已锁则取 actionTaken
  const SUB: Record<string, string> = { draw: '抽牌:天罡/扑克二选一', deploy: '放牌:免费·有牌就一直放(放牌区=贴家3格)→放完可点机关门(箭头)翻门调度·或结束回合', cast: '打天罡:选一张法术牌施放', discard: '弃牌:不互斥·弃后可再选一类动作(抽/放/打天罡)', '': '选一类动作·其余本回合锁定（弃牌例外：弃后可追加）' };
  const actions: TurnActionView[] = ACT.map(([key, glyph, label]) => ({ key, glyph, label, on: mode === key, dim: !!sel && sel !== key }));
  return {
    theme: opts.theme ?? 'onyx',
    turnWho: b.active === 'a' ? '我方回合' : '敌方回合', roundNo: b.turn, timerLabel: '∞ 无限时',
    water: b.a.mana, waterMax: 10, waterB: b.b.mana,
    deckA: b.a.pokerDeck.length + b.a.tengangDeck.length,
    deckB: b.b.pokerDeck.length + b.b.tengangDeck.length,
    homeA: b.homeA, homeB: b.homeB, homeMax: b.homeMax,
    lanes, gates: GATES.map((g, i) => ({ idx: i, open: b.gatesOpen[i], side: g.side, fromLane: g.fromLane, fromSlot: g.fromSlot, toLane: g.toLane, toSlot: g.toSlot })), gatesLive: opts.gatesLive ?? (mode === 'deploy'),
    hand, handPawnCount: hand.filter((c) => c.kind === 'pawn').length, handGangCount: hand.filter((c) => c.kind === 'gang').length,
    actions, actionSub: SUB[mode ?? ''] ?? SUB[''], drawPick: mode === 'draw',
    sha: opts.sha ?? [{ filled: true, name: '地煞·破军', rar: 'gold', desc: '' }, { filled: true, name: '地煞·贪狼', rar: 'blue', desc: '' }, { filled: false, name: '未知', rar: 'white', desc: '' }],
    bossName: opts.bossName ?? '楚霸王 · 项羽',
    clash: opts.clash ?? null,
    tutorial: opts.tutorial ?? null,
    notice: opts.notice ?? null,
    battleLabel: opts.battleLabel ?? '回合制 · 翻命扑克',
    sfxOn: opts.sfxOn ?? false,
    settingsOpen: opts.settingsOpen ?? false,
    bgmOn: opts.bgmOn ?? false, bgmIdx: opts.bgmIdx ?? 0, bgmVol: opts.bgmVol ?? 0.35, bgmNames: opts.bgmNames ?? [],
  };
}

// ── live mount（驱动层接 turn-combat·owner「运转逻辑跟以前一样」）──
export interface TurnBattleActions {
  pickAction?: (kind: string) => void;
  drawFrom?: (from: 'poker' | 'tengang') => void;
  selectHand?: (i: number) => void;
  playLane?: (lane: number) => void;
  toggleGate?: (idx: number) => void;
  endTurn?: () => void;
  setTheme?: (theme: 'onyx' | 'brocade') => void;
  clashConfirm?: () => void;
  goBack?: () => void;       // 返回大厅（带确认）
  bossInfo?: () => void;     // 点敌方大本营 → 弹 Boss 名号 + 战役故事
  toggleSfx?: () => void;    // 切换音效开/关
  toggleSettings?: () => void; // 开/关设置面板
  toggleBgm?: () => void;    // 切换背景音乐开/关（与音效分开）
  selectBgm?: (idx: number) => void; // 选第几首 BGM
  setBgmVol?: (dir: 'up' | 'down') => void; // BGM 音量 −/＋
}

/** live mount（忠实 mirror battle-screen.mountBattle）：按需重渲 + pointerdown 委派——重渲再频繁也夹不进按下→抬起。
 *  固定 1340×858 画框按 host 宽显式 scale 铺满（不靠 cqw）。getView 每次重渲实时派生当前态。返回 {update,destroy}。 */
export function mountTurnBattle(host: HTMLElement, getView: () => TurnBattleView, actions: TurnBattleActions = {}): { update: () => void; destroy: () => void } {
  if (!document.getElementById('gg-turn-css')) { const s = document.createElement('style'); s.id = 'gg-turn-css'; s.textContent = CSS; document.head.appendChild(s); }
  // 召唤源泉收退动效（owner 2026-06-21）：跨重渲对比上次亮格数 → 本次刚花掉的格走 g-drain「往后退」收退。
  // 重渲极频(选牌也重渲)：只在亮格「减少」时记一次 drain，并用计时器在动画时长后清掉——中途无关重渲不会打断/重放。
  let prevLit = -1; let drain = { from: 0, count: 0 }; let drainTimer = 0;
  let localNotice = ''; let localNoticeTimer = 0;
  const render = (): void => {
    const viewRaw = getView();
    const view: TurnBattleView = localNotice ? { ...viewRaw, notice: localNotice } : viewRaw;
    const litNow = Math.max(0, Math.min(view.waterMax, Math.floor(view.water)));
    if (prevLit >= 0 && litNow < prevLit) {
      drain = { from: litNow, count: prevLit - litNow };
      if (drainTimer) clearTimeout(drainTimer);
      drainTimer = window.setTimeout(() => { drain = { from: 0, count: 0 }; drainTimer = 0; render(); }, 540);
    }
    prevLit = litNow;
    const innerStyle: Style = { ...(THEMES[view.theme] ?? THEMES.onyx), width: '1340px', height: '858px', transformOrigin: 'top left', fontFamily: 'var(--fb)' };
    host.innerHTML = `<div class="ggt-outer" style="position:relative; width:100%; overflow:hidden; background:#0c0a08;"><div class="ggt-inner" style="${st(innerStyle)}">${buildTurnFrameHTML(view, drain)}</div></div>`;
    const outer = host.querySelector('.ggt-outer') as HTMLElement | null;
    const inner = host.querySelector('.ggt-inner') as HTMLElement | null;
    if (outer && inner) { const w = outer.clientWidth || host.clientWidth; if (w > 0) { const sc = w / 1340; inner.style.transform = `scale(${sc})`; outer.style.height = Math.round(858 * sc) + 'px'; } }
  };
  // 坞/格/牌/门 交互用 pointerdown（同 battle-screen）：rAF/重渲在按下↔抬起间整片重建 DOM，click 会落空 → 用单次离散 pointerdown。
  const onPress = (e: MouseEvent): void => {
    if (e.button > 0) return;
    const t = e.target as HTMLElement;
    const gate = t.closest('[data-gate]') as HTMLElement | null;
    if (gate) { actions.toggleGate?.(parseInt(gate.dataset.gate ?? '-1', 10)); render(); return; }
    const hand = t.closest('[data-hand]') as HTMLElement | null;
    if (hand) {
      const idx = parseInt(hand.dataset.hand ?? '-1', 10);
      const hc = getView().hand[idx];
      if (hc && hc.affordable === false) {
        localNotice = '✗ 源泉不足';
        if (localNoticeTimer) clearTimeout(localNoticeTimer);
        localNoticeTimer = window.setTimeout(() => { localNotice = ''; render(); }, 1600);
        render(); return;
      }
      actions.selectHand?.(idx); render(); return;
    }
    const act = t.closest('[data-act]') as HTMLElement | null;
    if (act) {
      const a = act.dataset.act, k = act.dataset.k ?? '';
      if (a === 'end') actions.endTurn?.();
      else if (a === 'clash-ok') actions.clashConfirm?.();
      else if (a === 'go-back') { actions.goBack?.(); render(); return; }
      else if (a === 'boss-info') { actions.bossInfo?.(); return; }
      else if (a === 'settings-toggle') { actions.toggleSettings?.(); }
      else if (a === 'toggle-sfx') { actions.toggleSfx?.(); }
      else if (a === 'toggle-bgm') { actions.toggleBgm?.(); }
      else if (a === 'bgm-track') { actions.selectBgm?.(parseInt(k, 10)); }
      else if (a === 'bgm-vol') { actions.setBgmVol?.(k === 'up' ? 'up' : 'down'); }
      else if (a === 'theme') actions.setTheme?.(k === 'brocade' ? 'brocade' : 'onyx');
      else if (a === 'draw-poker') actions.drawFrom?.('poker');
      else if (a === 'draw-tengang') actions.drawFrom?.('tengang');
      else if (a === 'draw' || a === 'deploy' || a === 'cast' || a === 'discard') actions.pickAction?.(a);
      render(); return;
    }
    const lane = t.closest('[data-lane]') as HTMLElement | null;
    if (lane) { actions.playLane?.(parseInt(lane.dataset.lane ?? '-1', 10)); render(); return; }
  };
  host.addEventListener('pointerdown', onPress);
  render();
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => render()); ro.observe(host); }
  return { update: render, destroy: () => { if (ro) ro.disconnect(); if (drainTimer) clearTimeout(drainTimer); if (localNoticeTimer) clearTimeout(localNoticeTimer); host.removeEventListener('pointerdown', onPress); host.replaceChildren(); } };
}

/** 自包含 HTML 文档（看帧/预览/无头截图；固定 1340×858·非 cqw·无需缩放注入）。 */
export function renderTurnBattleDoc(view: TurnBattleView): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${FONTS}<style>*{box-sizing:border-box;}body{margin:0;background:#0c0a08;}${CSS}</style></head><body>${buildTurnBattleHTML(view)}</body></html>`;
}
