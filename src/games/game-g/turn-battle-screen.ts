// turn-battle-screen.ts —— doc24 单机回合制战斗屏渲染器（忠实端口 owner 给的 Cloud Design「Game G 回合制战场.dc.html」）。
// 与设计稿同 1340×858 固定画布、玄铁/锦霞双皮；样式逐字搬自设计稿 renderVals。纯表现「固定解释器」(manifesto §2)：
//   只读 TurnBattleView（由 buildTurnBattleView 从 turn-combat 真状态派生）→ 出 HTML 串；不进 hash、不回灌判定。
// 静态渲染 = 设计稿"静息态"(无 hover tooltip / 无 boss 飞出)；clash 特写覆盖层按 view.clash 选渲。live mount + 交互为后续切片。
import { cardPoints } from './clash-resolve.js';
import { SLOTS, manaGain, GATES, A_DEPLOY_SLOT, B_DEPLOY_SLOT, DEPLOY_COST, CAST_COST, clashOdds, unitPowerParts, type TurnBattle, type TurnUnit } from './turn-combat.js';
import { powerRows } from './game-g-clash-view.js'; // 战力逐行明细共享格式器（④ 掷命特写 + ⑥ 场上兵 hover 单一真相）
import type { InlayEntry } from './dizhi-data.js';
import { FONTS } from './fonts.js'; // 自托管字体（替代外部 Google Fonts <link>）
import { heroNameOf } from './hero-codex.js'; // 场上牌悬浮显其对应武将名（owner 2026-06-21·数据已在 HERO_CARDS）
import { renderNode, ensureUiKeyframes, type LayoutNode } from '@ui/components/index.js'; // 数据驱动 UI 库：HUD chrome 由 LayoutNode 描述、renderNode 出串（UI 铁律·战斗屏 HUD 迁移）。ensureUiKeyframes=手动注入 fx 关键帧（战斗走 renderNode+innerHTML 不经 mountUI·主程导出·REQ-UI-fx控件叠层②）
import { GG_BATTLE_THEME } from './ui-theme.js'; // 桥接 CSS 变量的引擎组件主题 → renderNode 片段随玄铁/锦霞皮自动换色

type Style = Record<string, string | number | undefined>;
const st = (o: Style): string => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + v).join(';');
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const forr = <X,>(arr: X[], fn: (x: X, i: number) => string): string => arr.map(fn).join('');

const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUITNM: Record<string, string> = { s: '黑桃', h: '红桃', d: '方块', c: '梅花' };
const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇: '🐍', 马: '🐎', 羊: '🐑', 猴: '🐒', 鸡: '🐓', 狗: '🐕', 猪: '🐖' };
const RAR: Record<string, [string, string]> = { white: ['普通', '#b9bec8'], green: ['优良', '#5bbf7a'], blue: ['稀有', '#3a9bff'], gold: ['传世', '#e8cd82'] };

// 敌我牌面（owner 2026-06-20：底纹要好看·斜纹太丑）：改干净暖/冷渐变 + 左上玻璃高光。我方暖橙·敌方冷蓝（色温+描边色分清）。
const sideFace = (mine: boolean): string => mine
  ? 'radial-gradient(120% 78% at 26% 12%, rgba(255,255,255,.5), rgba(255,255,255,0) 56%), linear-gradient(160deg,#ffdcae 0%,#ffb277 56%,#ff8f4d 100%)'  // 我方·浓暖橙（owner 2026-06-29「白底太多·要反差大」→ 深暖 vs 深冷·非白底）
  : 'radial-gradient(120% 78% at 26% 12%, rgba(255,255,255,.5), rgba(255,255,255,0) 56%), linear-gradient(160deg,#b9d2ef 0%,#7ea7d8 56%,#4f82c4 100%)';  // 敌方·浓冷蓝

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
    '--fd': "'Zhi Mang Xing', cursive", '--fh': "'Rajdhani', sans-serif", '--fb': "'Noto Sans SC', sans-serif", '--fn': 'ui-monospace,"SF Mono",Menlo,Consolas,monospace',
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
    '--fd': "'Ma Shan Zheng', cursive", '--fh': "'Cormorant Garamond', serif", '--fb': "'Noto Serif SC', serif", '--fn': 'ui-monospace,"SF Mono",Menlo,Consolas,monospace',
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
@keyframes g-die-ready { 0%,100% { transform: scale(1) rotate(-4deg); box-shadow:0 0 22px rgba(232,205,138,.55), 0 8px 22px rgba(0,0,0,.5); } 50% { transform: scale(1.1) rotate(4deg); box-shadow:0 0 40px rgba(232,205,138,.95), 0 8px 22px rgba(0,0,0,.5); } }
@keyframes g-finger { 0%,100% { transform: translate(58px,-6px); } 50% { transform: translate(50px,-14px); } }
@keyframes g-die-shake { 0%,100%{transform:translate(-50%,-50%) rotate(-12deg) scale(1.05);} 25%{transform:translate(-50%,-50%) rotate(10deg) scale(.95);} 50%{transform:translate(-50%,-50%) rotate(-8deg) scale(1.08);} 75%{transform:translate(-50%,-50%) rotate(12deg) scale(.97);} }
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
/* 离场动画（owner 2026-06-29「牌离场要明确发生了什么·谁被战败撕裂/谁光荣离场」）。战败=被撕裂：抖+血红闪+下坠粉碎淡出。 */
@keyframes g-tear { 0%{transform:none;opacity:1;filter:none} 12%{transform:translateX(-4px) rotate(-5deg);filter:brightness(1.7) saturate(2) drop-shadow(0 0 6px #ff3b30)} 24%{transform:translateX(5px) rotate(6deg)} 36%{transform:translateX(-4px) rotate(-5deg)} 100%{transform:translateY(34px) scale(.62) rotate(-16deg);opacity:0;filter:brightness(.45) saturate(.5)} }
/* 光荣离场（胜方回库）：上升 + 金光环 + 放大淡出（凯旋回营）。 */
@keyframes g-glory { 0%{transform:none;opacity:1;filter:drop-shadow(0 0 0 rgba(232,205,138,0))} 35%{transform:translateY(-12px) scale(1.06);filter:drop-shadow(0 0 16px rgba(232,205,138,.95)) brightness(1.25)} 100%{transform:translateY(-66px) scale(1.02);opacity:0;filter:drop-shadow(0 0 24px rgba(232,205,138,.9))} }
/* 突破入营（无敌路推进到底·攻入敌家）：向前冲刺淡出。 */
@keyframes g-charge { 0%{transform:none;opacity:1} 60%{opacity:1} 100%{transform:translateX(var(--chg,40px)) scale(.8);opacity:0;filter:brightness(1.4)} }
/* 离场标签（战败/光荣回库）浮字：升起淡出。 */
@keyframes g-exitlabel { 0%{transform:translate(-50%,0) scale(.7);opacity:0} 25%{transform:translate(-50%,-10px) scale(1);opacity:1} 80%{opacity:1} 100%{transform:translate(-50%,-30px) scale(1);opacity:0} }
/* 钉守在场（胜方留场续战）：钉子砸下 + 金环脉冲（凯旋钉桩·card 真牌仍在场）。 */
@keyframes g-pin { 0%{transform:translateX(-50%) translateY(-30px) scale(.6);opacity:0} 55%{transform:translateX(-50%) translateY(2px) scale(1.18);opacity:1} 75%{transform:translateX(-50%) translateY(0) scale(.94)} 100%{transform:translateX(-50%) translateY(0) scale(1);opacity:1} }
@keyframes g-pinring { 0%{transform:scale(1.25);opacity:0} 35%{transform:scale(1);opacity:1} 100%{transform:scale(1);opacity:0} }
/* 磨砂详情浮层（owner 2026-06-21·悬浮看牌：战力=点数+加成，对决再 +随机骰）：纯 CSS hover，重渲不丢 */
.gg-tipwrap>.gg-tip{ position:absolute; left:50%; bottom:calc(100% + 9px); transform:translateX(-50%) translateY(5px) scale(1); transform-origin:50% 100%; width:214px; padding:12px 14px 10px; border-radius:13px; background:rgba(18,24,36,.58); backdrop-filter:blur(13px) saturate(1.5); -webkit-backdrop-filter:blur(13px) saturate(1.5); border:1px solid rgba(255,255,255,.2); box-shadow:0 16px 44px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14); color:#eaf0f6; font-family:var(--fb); font-size:12px; line-height:1.5; text-align:left; opacity:0; pointer-events:none; transition:opacity .15s ease, transform .15s ease; z-index:80; }
.gg-tipwrap>.gg-tip::after{ content:''; position:absolute; left:50%; top:100%; transform:translateX(-50%); border:7px solid transparent; border-top-color:rgba(18,24,36,.58); }
.gg-tipwrap:hover>.gg-tip{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); } /* 淡入+滑入·不缩放：放大用更大基础尺寸(214/12px·清晰可预测)替 scale(1.5)·后者会糊+溢出被外框裁(GA 2026-06-28 修出界) */
/* 顶排(上路)牌：浮层朝下弹，否则朝上会顶出画框被裁掉(owner 2026-06-21) */
.gg-tipwrap.tip-down>.gg-tip{ bottom:auto; top:calc(100% + 9px); transform:translateX(-50%) translateY(-5px) scale(1); transform-origin:50% 0%; }
.gg-tipwrap.tip-down>.gg-tip::after{ top:auto; bottom:100%; border-top-color:transparent; border-bottom-color:rgba(18,24,36,.58); }
.gg-tipwrap.tip-down:hover>.gg-tip{ transform:translateX(-50%) translateY(0) scale(1); }
/* 边缘左右弹（owner 2026-06-21·别弹出屏幕外）：最左牌→向右弹，最右牌→向左弹。从该侧角缩放，放大也不溢出。 */
.gg-tipwrap.tip-left>.gg-tip{ left:auto; right:0; transform:translateX(0) translateY(5px) scale(1); transform-origin:100% 100%; }
.gg-tipwrap.tip-left>.gg-tip::after{ left:auto; right:16px; transform:translateX(0); }
.gg-tipwrap.tip-left:hover>.gg-tip{ transform:translateX(0) translateY(0) scale(1); }
.gg-tipwrap.tip-right>.gg-tip{ left:0; right:auto; transform:translateX(0) translateY(5px) scale(1); transform-origin:0% 100%; }
.gg-tipwrap.tip-right>.gg-tip::after{ left:16px; transform:translateX(0); }
.gg-tipwrap.tip-right:hover>.gg-tip{ transform:translateX(0) translateY(0) scale(1); }
/* 顶排 + 边缘 复合：朝下且贴角 */
.gg-tipwrap.tip-down.tip-left>.gg-tip{ bottom:auto; top:calc(100% + 9px); transform-origin:100% 0%; }
.gg-tipwrap.tip-down.tip-right>.gg-tip{ bottom:auto; top:calc(100% + 9px); transform-origin:0% 0%; }
/* 侧弹（高元素如敌方大本营·浮层弹到左侧·垂直居中·不再朝上顶出画框被裁·owner 2026-06-28） */
.gg-tipwrap.tip-side>.gg-tip{ left:auto; right:calc(100% + 11px); bottom:auto; top:50%; transform:translateY(-50%) translateX(6px) scale(1); transform-origin:100% 50%; }
.gg-tipwrap.tip-side>.gg-tip::after{ left:auto; right:-13px; top:50%; bottom:auto; transform:translateY(-50%); border:7px solid transparent; border-top-color:transparent; border-left-color:rgba(18,24,36,.58); }
.gg-tipwrap.tip-side:hover>.gg-tip{ transform:translateY(-50%) translateX(0) scale(1); }
/* 悬浮的牌+浮层整体抬层（owner 2026-06-21）：手牌/棋格 position:relative 但 z 默认 auto，
   悬浮时拔高 → 浮层不再被相邻牌或棋盘(Table)盖住。 */
.gg-tipwrap:hover{ z-index:90; }`;

// ── 视图（buildTurnBattleView 从 turn-combat 派生喂渲染器；纯数据） ──
export interface TurnSlotView { hasUnit: boolean; mine: boolean; isBorder: boolean; isClash: boolean; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; power?: number; pts?: number; buff?: number; name?: string; rar?: 'white' | 'green' | 'blue' | 'gold'; zod?: string[]; deploy?: 1 | 2; deployLabel?: boolean; placeable?: boolean; unitId?: string; justMoved?: boolean; fresh?: number; tipDown?: boolean; tipSide?: 'left' | 'right' | ''; forecast?: number; general?: boolean; ench?: [string, number][]; live?: [string, number][]; livePower?: number } // live=此刻若评估的战力逐行明细(含天罡/士气/地煞·hover 透出来源·owner 2026-06-29 ⑥)；livePower=其和后的有效战力 pEff // placeable=选牌待放可落子(高亮)；fresh=新部署落子序号(g-drop)；tipDown=顶排牌磨砂浮层朝下弹避免被画框裁；tipSide=边缘列浮层往内弹避免溢出左右屏(owner 2026-06-21)；forecast=此前锋若开战的我方胜率0~1(掷命预报·owner 2026-06-21)
export interface TurnLaneView { name: string; slots: TurnSlotView[] }
// 捷径门箭头（占位·8 门·真视觉待 owner 参考图）。idx=GATES 下标·供 live mount data-gate 钩子。
export interface TurnGateView { idx: number; open: boolean; side: 'a' | 'b'; fromLane: number; fromSlot: number; toLane: number; toSlot: number }
export interface TurnHandCardView { kind: 'pawn' | 'gang'; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; name: string; power?: number; pts?: number; buff?: number; cost: number; zod?: string[]; rar: 'white' | 'green' | 'blue' | 'gold'; desc?: string; glyph?: string; selected?: boolean; dealt?: boolean; affordable?: boolean; general?: boolean; ench?: [string, number][] } // dealt=刚抽到的牌·飞入翻面入场动画(owner 2026-06-21)
export interface TurnActionView { key: string; glyph: string; label: string; on: boolean; dim: boolean }
export interface TurnClashCardView { rank: string; suit: 's' | 'h' | 'd' | 'c'; name: string; zod?: string; won: boolean; lastStand?: boolean } // lastStand：败者触发「死战不退·首负不亡」→ 显"死战不退"而非"阵亡"(owner 2026-06-21)
export interface TurnClashView { laneName: string; mine: TurnClashCardView; foe: TurnClashCardView; oddsMine: number; rollPct: number; bonusMine: [string, number][]; bonusFoe: [string, number][]; pEffMine?: number; pEffFoe?: number; extras?: string[]; revealed?: boolean } // revealed=false：掷命前·藏命点/胜负·等玩家点骰（owner 2026-06-21）
export interface TurnShaView { filled: boolean; name: string; rar: 'white' | 'green' | 'blue' | 'gold'; desc: string; used?: boolean }
export interface TurnBattleView {
  theme: 'onyx' | 'brocade';
  turnWho: string; roundNo: number; timerLabel: string;
  water: number; waterMax: number; waterB: number; waterGain: number; deckA: number; deckB: number;
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
  guideOn?: boolean; // 新手引导开/关（owner 2026-06-21·卡住保险阀·默认关）
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

// 大本营血灯（数据驱动·棋枰数据化②·owner 2026-06-28）：每点士气=一颗菱形宝石 → Label '◆'(亮·danger 血红+磷光) / '◇'(暗·dim)。
// 替手写旋转 div+facet：菱形字符天然就是斜方宝石，色走战斗 token(danger=var(--danger)=#ff5d62)·最弱 LLM 只填 ◆/◇ 与令牌。
function hpRowNode(blood: number, max: number, who: string): LayoutNode {
  return {
    type: 'Panel', id: `fort-hp-${who}`, props: { bare: true }, layout: { direction: 'row', gap: 5, justify: 'center', align: 'center' },
    children: Array.from({ length: max }, (_, i): LayoutNode => ({
      type: 'Label', id: `fort-hp-${who}-${i}`,
      props: { text: i < blood ? '◆' : '◇', size: 16, color: i < blood ? 'danger' : 'dim', glow: i < blood },
    })),
  };
}

// 紧凑堡垒大本营（数据驱动·棋枰数据化②·owner 2026-06-28·用主程 Panel.edge/radius 阵营框+异形圆角）。
// 城堡=Panel 组（body+城垛 merlons+盾 shield+冠 crown），阵营色走 edge:'mine'/'foe'（替 #ff7a45/#3a86d4 硬 hex），
// 小件圆角走 layout.radius（替 Panel 恒 10），光环走 fx glow（替手写 g-aura 浮层）。血灯=hpRowNode。
function fortBaseNode(view: TurnBattleView, isMine: boolean): LayoutNode {
  const edge = isMine ? 'mine' : 'foe'; const who = isMine ? 'a' : 'b';
  const blood = isMine ? view.homeA : view.homeB;
  const merlon = (i: number): LayoutNode => ({ type: 'Panel', id: `fort-${who}-merlon-${i}`, props: { bg: 'linear-gradient(180deg,#fbf7ef,#d8c39e)', edge }, layout: { width: 11, height: 12, radius: 3, padding: 0 } });
  const crown: LayoutNode = { type: 'Label', id: `fort-${who}-crown`, props: { text: '♔', size: 26, color: 'gold', glow: true }, layout: { x: 25, y: -28 } };
  const merlons: LayoutNode = { type: 'Panel', id: `fort-${who}-merlons`, props: { bare: true }, layout: { x: 6, y: -7, width: 62, direction: 'row', justify: 'between', gap: 0 }, children: [0, 1, 2, 3].map(merlon) };
  const shield: LayoutNode = { type: 'Panel', id: `fort-${who}-shield`, props: { bg: 'linear-gradient(160deg,#fff,#ece0c6)', edge }, layout: { width: 42, height: 48, radius: 16, align: 'center', justify: 'center', padding: 0, margin: 11 }, children: [{ type: 'Label', id: `fort-${who}-glyph`, props: { text: isMine ? '♠' : '♥', size: 30, color: isMine ? 'dim' : 'danger' } }] };
  const body: LayoutNode = { type: 'Panel', id: `fort-${who}-body`, props: { bg: 'linear-gradient(170deg,#fbf7ef,#dccaa8)', edge }, layout: { width: 74, height: 88, radius: 12, direction: 'column', justify: 'end', align: 'center', padding: 0, fx: [{ kind: 'glow', color: isMine ? 'warn' : 'jade', ms: 3000 }] }, children: [crown, merlons, shield] };
  const tag: LayoutNode = { type: 'Panel', id: `fort-${who}-tag`, props: { bg: 'rgba(20,16,10,.8)' }, layout: { radius: 99, padding: 5 }, children: [{ type: 'Label', id: `fort-${who}-tagtx`, props: { text: isMine ? '我方' : '敌方', size: 12, color: 'text', bold: true } }] };
  const children: LayoutNode[] = [body, tag, hpRowNode(blood, view.homeMax, who)];
  if (isMine) children.push({ type: 'Panel', id: 'fort-a-timer', props: {}, layout: { direction: 'row', gap: 5, align: 'center', padding: 5, radius: 99 }, children: [{ type: 'Label', id: 'fort-a-timer-ic', props: { text: '⏳', size: 12 } }, { type: 'Label', id: 'fort-a-timer-tx', props: { text: view.timerLabel, size: 12, color: 'dim', mono: true } }] });
  return { type: 'Panel', id: `fort-${who}`, props: { bare: true }, layout: { width: 92, direction: 'column', align: 'center', gap: 7 }, children };
}
function fortBase(view: TurnBattleView, isMine: boolean): string {
  const html = renderNode(fortBaseNode(view, isMine), GG_BATTLE_THEME);
  if (isMine) return html;
  // 敌方大本营可点 → 弹 Boss 名号 + 战役故事（owner 2026-06-21）。hover bossTip 仍 bespoke（Tooltip 富文本待后续切）。
  const bossTipRows = forr(view.sha.filter((s) => s.filled), (s) => { const rc = RAR[s.rar] || RAR.white; const used = s.used ?? false; return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid rgba(255,255,255,.08);"><span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${rc[1]};"></span><span style="flex:1;font-size:10px;color:rgba(255,255,255,.85);">${esc(s.name)}</span><span style="font-size:9px;color:${used ? '#ff9966' : '#7fcc9a'};">${used ? '已用' : '备用'}</span></div>`; });
  const bossTip = `<div class="gg-tip" style="width:210px;text-align:left;"><div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px;">👑 ${esc(view.bossName)}</div>${bossTipRows}<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font-size:10px;color:rgba(255,255,255,.55);">牌库剩余 <b style="color:#cdeeff;">${view.deckB}</b> 张</div></div>`;
  return `<div data-act="boss-info" class="gg-tipwrap tip-side" style="position:relative;cursor:pointer">${html}${bossTip}</div>`;
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

// 花色→语义令牌近似（4 色牌·Label 令牌无暗色/任意 hex：黑桃灰/红桃红/方块金/梅花绿·向区分·色微让）。
const SUIT_TONE: Record<string, 'sub' | 'danger' | 'warn' | 'ok'> = { s: 'sub', h: 'danger', d: 'warn', c: 'ok' };

// 场上兵牌（数据驱动·棋枰数据化②/③）：Panel(sideFace bg + edge 阵营/将框) flex 列 [角标+战力 / 大花色 / 生肖行]。
// 花色色走令牌近似(SUIT_TONE)；战力角标 bg 任意色 + 白字；主将=gold edge + 浮标 + glow。水印「我/敌/将」略(边框+花色承载阵营)。
function unitNode(s: TurnSlotView): LayoutNode {
  const id = s.unitId ?? `${s.rank}${s.suit}`; const isGen = !!s.general; const tone = SUIT_TONE[s.suit!] ?? 'sub'; const g = SUITG[s.suit!];
  const top: LayoutNode = { type: 'Panel', id: `u-${id}-top`, props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'start', gap: 2 }, children: [
    { type: 'Label', id: `u-${id}-cn`, props: { text: `${s.rank}${g}`, size: 14, color: tone, bold: true } },
    { type: 'Panel', id: `u-${id}-bd`, props: { bg: s.mine ? '#dc2626' : '#111111' }, layout: { radius: 99, padding: 2 }, children: [{ type: 'Label', id: `u-${id}-bv`, props: { text: String(s.power ?? ''), size: 11, color: 'text', mono: true, bold: true } }] },
  ] };
  const zod = s.zod || [];
  const zc = (z: string | undefined, i: number): LayoutNode => ({ type: 'Panel', id: `u-${id}-z${i}`, props: { bg: z ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.06)' }, layout: { width: 18, height: 18, radius: 5, align: 'center', justify: 'center', padding: 0 }, children: z ? [{ type: 'Label', id: `u-${id}-zg${i}`, props: { text: ZOD_ICON[z] || z, size: 12 } }] : [] });
  // 中央=大花色（owner 2026-06-29「先不显我/敌·只靠红框/黑框分辨·看够不够」）：敌我暂仅靠 edge 红/黑框 + 红/黑战力角标区分。
  const center: LayoutNode = { type: 'Label', id: `u-${id}-big`, props: { text: g, size: 30, color: tone } };
  const children: LayoutNode[] = [
    top,
    center,
    { type: 'Panel', id: `u-${id}-zr`, props: { bare: true }, layout: { direction: 'row', gap: 3, justify: 'center' }, children: [0, 1, 2].map((i) => zc(zod[i], i)) },
  ];
  if (isGen) children.push({ type: 'Label', id: `u-${id}-gen`, props: { text: s.mine ? '⭐主将' : '☠敌将', size: 8, color: 'gold', bold: true }, layout: { y: -12, x: 14 } });
  return { type: 'Panel', id: `u-${id}`, props: { bg: sideFace(s.mine), edge: isGen ? 'gold' : (s.mine ? 'mine' : 'foe') }, layout: { flex: 1, direction: 'column', justify: 'between', align: 'center', padding: 4, radius: 10, ...(isGen ? { fx: [{ kind: 'glow', color: 'gold', ms: 1400 }] } : {}) }, children };
}
// 磨砂详情浮层内容（战力拆解·场上兵 hover 气泡·owner 2026-06-29 ⑥）。
// ⚠ 战斗屏 renderNode+innerHTML 不跑 mountUI → 不能用 LayoutNode Tooltip(气泡靠 mountUI 显隐+定位·且 tabindex 点击触发画框 scroll 缩放·GA 2987b0e2 已拆)。
// 改由 mountTurnBattle 的 live hover 把此内容渲进 position:fixed 气泡(随光标·逃出棋盘 overflow 裁剪·无 tabindex)。仅 live 调用·不进静态帧 → golden 不变。
// hover 透出**此刻若评估**的全部加成来源——点数/经营(逐地支源)/天罡(逐张)/士气/地煞·恰好加到＝当前战力。
export function cardTipNode(s: TurnSlotView): LayoutNode {
  const tone = SUIT_TONE[s.suit!] ?? 'sub';
  const rows = s.live ?? [];
  const live = s.livePower; // 含天罡/士气/地煞后的有效战力（与真实掷命同源）
  const children: LayoutNode[] = [
    { type: 'Label', id: 'tipb-n', props: { text: s.name ?? (SUITNM[s.suit!] + s.rank), size: 12, color: 'text', bold: true } },
    { type: 'Label', id: 'tipb-f', props: { spans: [{ text: `牌面 ${SUITNM[s.suit!]} ${s.rank} ${SUITG[s.suit!]}`, color: tone }, { text: s.general ? '　⭐ 主将' : '', color: 'gold', bold: true }], size: 11, color: tone } },
    { type: 'Label', id: 'tipb-p', props: { spans: [{ text: '当前战力 ' }, { text: String(live ?? s.power ?? ''), color: 'gold', bold: true }, { text: '　（加成来源↓）' }], size: 11, color: 'sub' } },
  ];
  // 逐行加成明细：缩进子行(以全角空格起头·如天罡逐张/封顶)走 dim + 略缩；主行 sub。正负染色(+绿/−红)。
  for (let k = 0; k < rows.length; k++) {
    const [label, num] = rows[k]; const indent = label.startsWith('　');
    const numTone = num > 0 ? 'ok' : num < 0 ? 'danger' : 'dim';
    children.push({ type: 'Label', id: `tipb-r${k}`, props: { size: indent ? 9 : 10, color: indent ? 'dim' : 'sub',
      spans: [{ text: label }, { text: `  ${num > 0 ? '+' : ''}${num}`, color: numTone, bold: !indent }] } });
  }
  // 兜底：无 live（旧路径/无加成）→ 提示按场计入。
  if (!rows.length) children.push({ type: 'Label', id: 'tipb-z', props: { text: '天罡/士气 对决时按场计入 · 再 +随机骰', size: 10, color: 'dim' } });
  return { type: 'Panel', id: 'tipb', props: {}, layout: { direction: 'column', gap: 3, padding: 10, width: 210 }, children };
}
function slotCellNode(s: TurnSlotView, idx: number): LayoutNode {
  const cid = `cell-${idx}`;
  const depBg = s.deploy === 1 ? 'rgba(255,122,69,.10)' : s.deploy === 2 ? 'rgba(58,134,212,.09)' : undefined;
  const bg = s.isBorder ? 'rgba(232,205,138,.16)' : depBg;
  const edge = s.isClash ? 'warn' : s.isBorder ? 'gold' : s.deploy === 1 ? 'mine' : s.deploy === 2 ? 'foe' : undefined;
  const special = !!(bg || edge || s.placeable);
  const inner: LayoutNode[] = [];
  if (s.deployLabel) inner.push({ type: 'Label', id: `${cid}-dl`, props: { text: '放牌区', size: 9, color: s.deploy === 1 ? 'warn' : 'sub', bold: true, tracking: 1 }, layout: { y: 4, x: 0 } });
  if (s.hasUnit && s.rank && s.suit) inner.push(unitNode(s));
  // 空格虚线落点圈：色改用暗底可见令牌（阵营 mine/foe=红/黑·黑在暗棋盘上看不清·owner 2026-06-29）→ 我方红、敌方金、边界格金。
  else inner.push({ type: 'Panel', id: `${cid}-dot`, props: { bg: 'transparent', dashed: true, edge: s.isBorder ? 'gold' : (s.mine ? 'danger' : 'jade') }, layout: { width: 38, height: 38, radius: 99, padding: 0 } });
  if (s.placeable) inner.push(
    { type: 'Label', id: `${cid}-tap`, props: { text: '👆', size: 25 } },
    { type: 'Label', id: `${cid}-ph`, props: { text: '放这里', size: 10, color: 'gold', bold: true }, layout: { y: 56, x: 0 } },
  );
  if (s.forecast != null) { const [lab] = oddsTier(s.forecast); const pct = Math.round(s.forecast * 100); const fc = pct >= 55 ? 'ok' : pct > 45 ? 'warn' : 'danger'; inner.push({ type: 'Panel', id: `${cid}-fc`, props: { bg: 'rgba(10,14,20,.92)', edge: fc }, layout: { y: -19, x: 0, radius: 99, padding: 2 }, children: [{ type: 'Label', id: `${cid}-fcl`, props: { text: `⚔ ${lab} ${pct}%`, size: 11, color: fc, bold: true } }] }); }
  const fx = s.isClash ? [{ kind: 'pulse' as const, ms: 1400 }] : s.placeable ? [{ kind: 'pulse' as const, color: 'gold' as const, ms: 1050 }] : undefined;
  return { type: 'Panel', id: cid, props: special ? { bg: bg ?? 'transparent', edge } : { bare: true }, layout: { flex: 1, direction: 'column', align: s.hasUnit ? 'stretch' : 'center', justify: 'center', radius: 11, padding: 3, ...(fx ? { fx } : {}) }, children: inner };
}
function laneRowNode(L: TurnLaneView, li: number, hiOn: boolean): LayoutNode {
  const tag: LayoutNode = { type: 'Panel', id: `lane-${li}-tag`, props: { bg: 'var(--chip)' }, layout: { width: 40, direction: 'column', align: 'center', justify: 'center', gap: 1, radius: 8 }, children: [...L.name].map((ch, i) => ({ type: 'Label', id: `lane-${li}-tag-${i}`, props: { text: ch, size: 13, color: 'text', bold: true } })) };
  const track: LayoutNode = { type: 'Panel', id: `lane-${li}-track`, props: { bg: 'var(--lane)', action: 'lane', actionArg: String(li), ...(hiOn ? { edge: 'gold' } : {}) }, layout: { flex: 1, direction: 'grid', cols: 9, gap: 6, padding: 8, radius: 12, ...(hiOn ? { fx: [{ kind: 'pulse', color: 'gold', ms: 1000 }] } : {}) }, children: L.slots.map((s, i) => slotCellNode(s, li * 9 + i)) };
  return { type: 'Panel', id: `lane-${li}`, props: { bare: true }, layout: { flex: 1, direction: 'row', align: 'stretch', gap: 10 }, children: [tag, track] };
}

// 召唤源泉水滴（cost·小蓝滴排）。
function costDropNode(n: number, idp: string): LayoutNode {
  return { type: 'Panel', id: `${idp}-cost`, props: { bare: true }, layout: { y: 4, x: 30, direction: 'row', gap: 3, justify: 'center' }, children: Array.from({ length: Math.min(n, 5) }, (_, k): LayoutNode => ({ type: 'Panel', id: `${idp}-cd${k}`, props: { bg: 'linear-gradient(180deg,#8fe0ff,#2f93cf)' }, layout: { width: 9, height: 12, radius: 4, padding: 0 } })) };
}
// 手牌牌面（数据驱动·棋枰数据化②/③·同场上兵套路）：天罡=紫顶徽 + 名/描述；兵牌=sideFace + edge mine/将 gold + 角标/战力/大花色/生肖。
function handCardNode(c: TurnHandCardView, i: number, hiOn: boolean): LayoutNode {
  const sel = c.selected || hiOn;
  let card: LayoutNode;
  if (c.kind === 'gang') {
    card = { type: 'Panel', id: `h${i}`, props: { bg: 'var(--panel)', edge: 'gold' }, layout: { width: 88, height: 112, radius: 12, direction: 'column', gap: 0, padding: 0, ...(sel ? { fx: [{ kind: 'glow', color: 'gold', ms: 900 }] } : {}) }, children: [
      { type: 'Panel', id: `h${i}-top`, props: { bg: 'linear-gradient(180deg,#a98bff44,#a98bff11)' }, layout: { height: 42, align: 'center', justify: 'center', radius: 10 }, children: [{ type: 'Panel', id: `h${i}-ic`, props: { bg: '#a98bff' }, layout: { width: 38, height: 38, radius: 99, align: 'center', justify: 'center', padding: 0 }, children: [{ type: 'Label', id: `h${i}-icg`, props: { text: c.glyph || '✦', size: 22, color: 'text' } }] }] },
      { type: 'Panel', id: `h${i}-bd`, props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 4, padding: 8 }, children: [
        { type: 'Label', id: `h${i}-nm`, props: { text: c.name, size: 13, color: 'text', bold: true } },
        { type: 'Label', id: `h${i}-ds`, props: { text: c.desc || '', size: 10, color: 'sub' } },
      ] },
      ...(c.cost > 0 ? [costDropNode(c.cost, `h${i}`)] : []),
    ] };
  } else {
    const tone = SUIT_TONE[c.suit!] ?? 'sub'; const isGen = !!c.general; const g = c.suit ? SUITG[c.suit] : '';
    const zod = c.zod || [];
    const zc = (z: string | undefined, k: number): LayoutNode => ({ type: 'Panel', id: `h${i}-z${k}`, props: { bg: z ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.06)' }, layout: { width: 18, height: 18, radius: 5, align: 'center', justify: 'center', padding: 0 }, children: z ? [{ type: 'Label', id: `h${i}-zg${k}`, props: { text: ZOD_ICON[z] || z, size: 12 } }] : [] });
    const children: LayoutNode[] = [
      { type: 'Panel', id: `h${i}-top`, props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'start' }, children: [
        { type: 'Label', id: `h${i}-cn`, props: { text: `${c.rank ?? ''}${g}`, size: 14, color: tone, bold: true } },
        { type: 'Panel', id: `h${i}-bd`, props: { bg: '#dc2626' }, layout: { radius: 99, padding: 2 }, children: [{ type: 'Label', id: `h${i}-bv`, props: { text: String(c.power ?? ''), size: 10, color: 'text', mono: true, bold: true } }] },
      ] },
      { type: 'Panel', id: `h${i}-mid`, props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 2 }, children: [
        { type: 'Label', id: `h${i}-big`, props: { text: g, size: 32, color: tone } },
        { type: 'Panel', id: `h${i}-nm`, props: { bg: 'rgba(20,16,10,.8)' }, layout: { radius: 99, padding: 2 }, children: [{ type: 'Label', id: `h${i}-nml`, props: { text: c.name, size: 11, color: 'text', bold: true } }] },
      ] },
      { type: 'Panel', id: `h${i}-zr`, props: { bare: true }, layout: { direction: 'row', gap: 3, justify: 'center' }, children: [0, 1, 2].map((k) => zc(zod[k], k)) },
    ];
    if (c.cost > 0) children.push(costDropNode(c.cost, `h${i}`));
    if (isGen) children.push({ type: 'Label', id: `h${i}-gen`, props: { text: '⭐ 主将', size: 9, color: 'gold', bold: true }, layout: { y: -13, x: 18 } });
    card = { type: 'Panel', id: `h${i}`, props: { bg: sideFace(true), edge: sel || isGen ? 'gold' : 'mine' }, layout: { width: 88, height: 112, radius: 12, direction: 'column', justify: 'between', align: 'center', padding: 4, ...(sel || isGen ? { fx: [{ kind: 'glow', color: 'gold', ms: 1200 }] } : {}) }, children };
  }
  return card;
}
function handCard(c: TurnHandCardView, i: number, hiOn = false): string {
  const aff = c.affordable === false ? ';opacity:.45;filter:grayscale(.6)' : ''; // 买不起=灰显（Label 令牌无 opacity·留在 data-hand 壳上）
  return `<div data-hand="${i}" style="cursor:pointer${aff}${c.dealt ? ';animation:g-deal .46s cubic-bezier(.2,.85,.3,1.12) both' : ''}">${renderNode(handCardNode(c, i, hiOn), GG_BATTLE_THEME)}</div>`;
}


// ── 掷命对决特写（数据驱动·阶段①·owner 2026-06-28 拍板棋枰数据化）：Versus 双牌+胜方 + 明细/掷骰/继续组合。
// 牌面花色色由 Versus/PlayingCard 内建；标签色用语义 token(ok/warn/danger) 近似；牌库收退/逐路编排仍 game 侧驱动(re-render)。
function clashBonusCol(rows: [string, number][], head: string, headTone: 'accent' | 'sub', total?: number): LayoutNode {
  const valTone = headTone === 'accent' ? 'gold' : 'sub';
  const rowNodes: LayoutNode[] = rows.map(([label, num], i) => ({
    type: 'Panel', id: `clash-bc-${head}-${i}`, props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' },
    children: [
      { type: 'Label', id: `clash-bc-${head}-${i}-l`, props: { text: label, size: label.startsWith('　') ? 'xs' : 'sm', color: 'sub' }, layout: { flex: 1 } },
      { type: 'Label', id: `clash-bc-${head}-${i}-v`, props: { text: `${num > 0 ? '+' : ''}${num}`, size: 'sm', color: num < 0 ? 'warn' : valTone, mono: true } },
    ],
  }));
  if (total != null) rowNodes.push({
    type: 'Panel', id: `clash-bc-${head}-tot`, props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' },
    children: [
      { type: 'Label', id: `clash-bc-${head}-tot-l`, props: { text: '＝ 战力', size: 'sm', color: 'text', bold: true }, layout: { flex: 1 } },
      { type: 'Label', id: `clash-bc-${head}-tot-v`, props: { text: String(total), size: 'lg', color: headTone === 'accent' ? 'gold' : 'jade', bold: true, mono: true } },
    ],
  });
  return {
    type: 'Panel', id: `clash-bc-${head}`, props: {}, layout: { direction: 'column', gap: 2, flex: 1, padding: 12 },
    children: [{ type: 'Label', id: `clash-bc-${head}-h`, props: { text: head, size: 'xs', color: headTone === 'accent' ? 'gold' : 'sub', bold: true, tracking: 1.5 } }, ...rowNodes],
  };
}
function clashNode(cv: TurnClashView): LayoutNode {
  const revealed = cv.revealed !== false;
  const foePct = 100 - cv.oddsMine;
  const versus: LayoutNode = {
    type: 'Versus', id: 'clash-versus',
    props: {
      left: { rank: cv.mine.rank, suit: SUITG[cv.mine.suit], face: 'light' },
      right: { rank: cv.foe.rank, suit: SUITG[cv.foe.suit], face: 'light' },
      label: revealed ? `${cv.oddsMine} : ${foePct}` : '⚔',
      winner: revealed ? (cv.mine.won ? 'left' : 'right') : 'none',
    },
    layout: { anim: 'flyIn' },
  };
  // 中央掷骰/揭晓：掷命前=掷骰钮(action clash-roll)·揭晓后=命点 + CoinFlip。
  const center: LayoutNode = revealed
    ? { type: 'Panel', id: 'clash-center', props: { bare: true }, layout: { direction: 'column', gap: 6, align: 'center' }, children: [
        { type: 'CoinFlip', id: 'clash-coin', props: { outcome: cv.mine.won ? 'heads' : 'tails', headsLabel: '生', tailsLabel: '死', spinning: false, size: 64 } },
        { type: 'Label', id: 'clash-roll-pct', props: { text: `命点 ${cv.rollPct}/100`, size: 'sm', color: 'gold', mono: true } },
      ] }
    : { type: 'Panel', id: 'clash-center', props: { bare: true }, layout: { direction: 'column', gap: 8, align: 'center' }, children: [
        { type: 'Button', id: 'clash-roll-btn', props: { label: '🎲 掷命', kind: 'hero', action: 'clash-roll' }, layout: { anchor: 'combat-roll', fx: [{ kind: 'pulse', ms: 1000 }] } },
        { type: 'Label', id: 'clash-roll-hint', props: { text: '看清战力来源后 · 点击掷命（不自动·慢慢看）', size: 'xs', color: 'sub' } },
      ] };
  const oddsBar: LayoutNode = {
    type: 'Panel', id: 'clash-odds', props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' }, children: [
      { type: 'Label', id: 'clash-odds-m', props: { text: `${cv.oddsMine}%`, size: 'xl', color: 'gold', mono: true } },
      { type: 'Label', id: 'clash-odds-mid', props: { text: '胜率 · 战力差→概率', size: 'xs', color: 'sub' }, layout: { flex: 1 } },
      { type: 'Label', id: 'clash-odds-f', props: { text: `${foePct}%`, size: 'xl', color: 'jade', mono: true } },
    ],
  };
  const breakdown: LayoutNode = {
    type: 'Panel', id: 'clash-breakdown', props: { bare: true }, layout: { direction: 'row', gap: 10 },
    children: [clashBonusCol(cv.bonusMine, '我方加成明细', 'accent', cv.pEffMine), clashBonusCol(cv.bonusFoe, '敌方加成明细', 'sub', cv.pEffFoe)],
  };
  const verdict = (c: TurnClashCardView): string => c.won ? '正面 · 存活' : c.lastStand ? '🛡 死战不退 · 退守' : '反面 · 阵亡';
  const verdictRow: LayoutNode = {
    type: 'Panel', id: 'clash-verdicts', props: { bare: true }, layout: { direction: 'row', gap: 40, align: 'center', justify: 'center' },
    children: [
      { type: 'Label', id: 'clash-vd-m', props: { text: `我方 ${verdict(cv.mine)}`, size: 'sm', color: cv.mine.won ? 'ok' : cv.mine.lastStand ? 'warn' : 'danger', bold: true } },
      { type: 'Label', id: 'clash-vd-f', props: { text: `敌方 ${verdict(cv.foe)}`, size: 'sm', color: cv.foe.won ? 'ok' : cv.foe.lastStand ? 'warn' : 'danger', bold: true } },
    ],
  };
  // 对峙双方阵营标（owner 2026-06-29「对峙时忘了哪张是我方」）：Versus 左=我方(暖橙) / 右=敌方(冷蓝)·恒显带牌名。
  const sideLabels: LayoutNode = {
    type: 'Panel', id: 'clash-sides', props: { bare: true }, layout: { direction: 'row', gap: 20, align: 'center', justify: 'center' },
    children: [
      { type: 'Label', id: 'clash-side-m', props: { text: `🟠 我方 · ${cv.mine.name}${cv.pEffMine != null ? ` · 战力 ${cv.pEffMine}` : ''}`, size: 'md', color: 'mine', bold: true } },
      { type: 'Label', id: 'clash-side-vs', props: { text: 'VS', size: 'sm', color: 'dim', bold: true } },
      { type: 'Label', id: 'clash-side-f', props: { text: `敌方 · ${cv.foe.name}${cv.pEffFoe != null ? ` · 战力 ${cv.pEffFoe}` : ''} 🔵`, size: 'md', color: 'foe', bold: true } },
    ],
  };
  const children: LayoutNode[] = [
    { type: 'Label', id: 'clash-title', props: { text: `⚔ ${cv.laneName} · 掷命对决`, size: 'lg', color: 'gold', bold: true, tracking: 2 } },
    sideLabels,
    { type: 'Panel', id: 'clash-duel', props: { bare: true }, layout: { direction: 'row', gap: 24, align: 'center', justify: 'center' }, children: [versus, center] },
    ...(revealed ? [verdictRow] : []),
    oddsBar, breakdown,
  ];
  if (cv.extras && cv.extras.length) children.push({
    type: 'Panel', id: 'clash-extras', props: { accent: true }, layout: { direction: 'column', gap: 3, padding: 10 },
    children: [{ type: 'Label', id: 'clash-extras-h', props: { text: '额外效果', size: 'xs', color: 'gold', bold: true, tracking: 1.5 } },
      ...cv.extras.map((e, i) => ({ type: 'Label' as const, id: `clash-extra-${i}`, props: { text: e, size: 'sm', color: 'text' as const } }))],
  });
  children.push(revealed
    ? { type: 'Panel', id: 'clash-foot', props: { bare: true }, layout: { direction: 'column', gap: 8, align: 'center' }, children: [
        { type: 'Label', id: 'clash-foot-r', props: { text: `本场 ${cv.mine.won ? '我方胜' : '敌方胜'}｜${cv.laneName}前锋对决`, size: 'md', color: cv.mine.won ? 'ok' : 'danger', bold: true } },
        { type: 'Button', id: 'clash-ok', props: { label: '看明白了 · 继续 ▸', kind: 'hero', action: 'clash-ok' } },
      ] }
    : { type: 'Label', id: 'clash-foot-pre', props: { text: '⚔ 命悬一掷 · 点骰定生死', size: 'md', color: 'gold', bold: true } });
  return {
    type: 'Panel', id: 'clash-panel', props: { accent: true, bg: 'radial-gradient(80% 70% at 50% 30%, #1c2940, #0e1828)' },
    layout: { direction: 'column', gap: 14, padding: 22, width: 760, chamfer: 16 },
    children,
  };
}

/** 回合制战斗屏「画框」HTML（固定 1340×858·无页 root·供 live mount 缩放嵌入）。双皮 token 由外层挂。
 *  drain：本次刚消耗的召唤源泉（from=收退起格·count=退几格）→ 源泉「往后退」收退动效（owner 2026-06-21）。静态渲染/golden 默认无。 */
// ── 顶栏（数据驱动·UI 铁律）：章 + 战斗名 + 回合盒 + 返回/设置 ────────────────────
// 取代手写 topbar HTML：纯 LayoutNode 数据 → renderNode（喂 GG_BATTLE_THEME 桥接 CSS 变量·随皮换色）。
// action 信号（go-back / settings-toggle）经 renderNode 渲成 data-action → mountTurnBattle 的 pointerdown 委托统一接（同 data-act）。
function topbarNode(view: TurnBattleView): LayoutNode {
  const idCol: LayoutNode = {
    type: 'Panel', id: 'ggt-tb-idcol', props: { bare: true }, layout: { direction: 'column', gap: 1 },
    children: [
      { type: 'Label', id: 'ggt-tb-label', props: { text: view.battleLabel, size: 15, color: 'text', bold: true } }, // 裸 px 像素级对齐原版（原 15px·主程 Label.size 收裸数字）
      { type: 'Label', id: 'ggt-tb-mode', props: { text: '单机 · 回合制', size: 'xs', color: 'dim' } },
    ],
  };
  const idGroup: LayoutNode = {
    type: 'Panel', id: 'ggt-tb-id', props: { bare: true }, layout: { direction: 'row', gap: 11, align: 'center' },
    children: [{ type: 'Avatar', id: 'ggt-tb-seal', props: { name: '♠', shape: 'rounded', size: 42 } }, idCol],
  };
  const turnBox: LayoutNode = {
    type: 'Panel', id: 'ggt-tb-turn', props: { accent: true }, layout: { direction: 'row', gap: 9, align: 'center', padding: 7 },
    children: [
      // 当前回合状态灯：发光 + 呼吸（layout.fx pulse·主程特效库）——呼吸放在点上、不放整盒（pulse=透明度.55↔1·套盒会把字读糊）。
      { type: 'Label', id: 'ggt-tb-dot', props: { text: '●', size: 'xs', color: 'warn', glow: true }, layout: { fx: [{ kind: 'pulse', ms: 1600 }] } },
      { type: 'Panel', id: 'ggt-tb-turncol', props: { bare: true }, layout: { direction: 'column', gap: 1 }, children: [
        { type: 'Label', id: 'ggt-tb-who', props: { text: view.turnWho, size: 14, color: 'text', bold: true } }, // 裸 px 对齐原版（原 14px）
        { type: 'Label', id: 'ggt-tb-round', props: { text: `第 ${view.roundNo} 回合`, size: 'xs', color: 'dim' } },
      ] },
    ],
  };
  return {
    type: 'Panel', id: 'ggt-topbar', props: { bare: true }, layout: { direction: 'row', gap: 10, align: 'center' },
    children: [
      idGroup,
      { type: 'Panel', id: 'ggt-tb-spacer', props: { bare: true }, layout: { flex: 1 } },
      turnBox,
      { type: 'Button', id: 'ggt-tb-back', props: { label: '← 返回大厅', kind: 'ghost', action: 'go-back' } },
      { type: 'Button', id: 'ggt-tb-gear', props: { label: '⚙', kind: view.settingsOpen ? 'primary' : 'ghost', action: 'settings-toggle' } },
    ],
  };
}

// ── 动作菜单（数据驱动·UI 铁律）：四选一 + 摸牌二选 + 操作提示 ──────────────────────
// 取代手写 actBtn 网格：四动作=Button（glyph 入 label·on→primary / dim→quiet / 常态→ghost·均可点·同原 dim 仍可点）。
// 锚点（combat-draw/deploy/cast/discard·combat-draw-pick）经 layout.anchor → data-anchor，battle-coach spotlight 不变。
function actionMenuNode(view: TurnBattleView): LayoutNode {
  const actBtn = (a: TurnActionView): LayoutNode => ({
    type: 'Button', id: `ggt-act-${a.key}`,
    props: { label: `${a.glyph} ${a.label}`, kind: a.on ? 'primary' : a.dim ? 'quiet' : 'ghost', action: a.key },
    layout: { anchor: `combat-${a.key}`, chamfer: 8 }, // chamfer=倒角艺术边（owner 2026-06-28「按钮加点设计感/花纹」·复用引擎倒角原语·非手写 CSS）
  });
  const grid: LayoutNode = {
    type: 'Panel', id: 'ggt-act-grid', props: { bare: true }, layout: { direction: 'grid', cols: 2, gap: 8 },
    children: view.actions.map(actBtn),
  };
  const drawPick: LayoutNode = {
    type: 'Panel', id: 'ggt-draw-pick', props: { bare: true }, layout: { direction: 'row', gap: 7, anchor: 'combat-draw-pick' },
    children: [
      { type: 'Button', id: 'ggt-draw-poker', props: { label: '🎴 摸扑克', kind: 'ghost', action: 'draw-poker' }, layout: { flex: 1 } },
      { type: 'Button', id: 'ggt-draw-tengang', props: { label: '✦ 摸天罡', kind: 'ghost', action: 'draw-tengang' }, layout: { flex: 1 } },
    ],
  };
  const hint: LayoutNode = { type: 'Label', id: 'ggt-act-hint', props: { text: view.actionSub, size: 'xs', color: 'dim' } };
  return {
    type: 'Panel', id: 'ggt-actionmenu', props: { accent: true, pattern: 'stripe' }, layout: { direction: 'column', gap: 11, width: 300, padding: 16, chamfer: 14 }, // 装饰框：accent 金描边+柔光 / stripe 斜纹花纹 / chamfer 倒角（owner 2026-06-28「加点艺术设计感/花纹」·复用引擎装饰原语·非手写 CSS）
    children: view.drawPick ? [grid, drawPick, hint] : [grid, hint],
  };
}

// ── 结束回合钮（数据驱动）：金色倒角 CTA = Button kind:'hero'（下沉自出征键的同款金色 sheen·锚点 combat-end）。
function endTurnNode(): LayoutNode {
  return { type: 'Button', id: 'ggt-end', props: { label: '结束回合 ▸', kind: 'hero', action: 'end' }, layout: { width: 156, anchor: 'combat-end' } };
}

// ── 设置浮层（数据驱动·UI 铁律）：音效/BGM(+曲目+音量)/新手引导 开关 + 主题分段 ──────────
// 取代手写 settingsPanel：开关=Button(开/关)·曲目=Button(active)·音量=±Button·主题=Segmented。
// 信号 toggle-sfx/toggle-bgm/toggle-guide / bgm-track(arg=序号) / bgm-vol(arg=up|down) / theme(arg=皮)
// 经 renderNode → data-action[+data-arg]，统一 pointerdown 委托接（同 data-act/data-k 路）。
function settingsNode(view: TurnBattleView): LayoutNode {
  const tog = (id: string, label: string, on: boolean, action: string): LayoutNode => ({
    type: 'Panel', id: `ggt-set-${id}`, props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' },
    children: [
      { type: 'Label', id: `ggt-set-${id}-l`, props: { text: label, size: 'sm', color: 'text' }, layout: { flex: 1 } },
      { type: 'Button', id: `ggt-set-${id}-b`, props: { label: on ? '开' : '关', kind: on ? 'primary' : 'ghost', action } },
    ],
  });
  const children: LayoutNode[] = [
    { type: 'Label', id: 'ggt-set-title', props: { text: '⚙ 设置', size: 'xs', color: 'dim', bold: true, tracking: 2 } },
    tog('sfx', `${view.sfxOn ? '🔊' : '🔇'} 音效`, view.sfxOn, 'toggle-sfx'),
    tog('bgm', '🎵 背景音乐', view.bgmOn, 'toggle-bgm'),
  ];
  if (view.bgmOn) {
    children.push({
      type: 'Panel', id: 'ggt-set-tracks', props: { bare: true }, layout: { direction: 'column', gap: 4 },
      children: view.bgmNames.map((nm, i) => ({
        type: 'Button', id: `ggt-set-track-${i}`,
        props: { label: (view.bgmIdx === i ? '♪ ' : '') + nm, kind: view.bgmIdx === i ? 'primary' : 'ghost', action: 'bgm-track', actionArg: String(i) },
      })),
    });
    children.push({
      type: 'Panel', id: 'ggt-set-vol', props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' },
      children: [
        { type: 'Label', id: 'ggt-set-vol-l', props: { text: '音量', size: 'xs', color: 'dim' }, layout: { flex: 1 } },
        { type: 'Button', id: 'ggt-set-vol-d', props: { label: '−', kind: 'ghost', action: 'bgm-vol', actionArg: 'down' } },
        { type: 'Label', id: 'ggt-set-vol-v', props: { text: `${Math.round(view.bgmVol * 100)}%`, size: 'sm', color: 'text', mono: true } },
        { type: 'Button', id: 'ggt-set-vol-u', props: { label: '＋', kind: 'ghost', action: 'bgm-vol', actionArg: 'up' } },
      ],
    });
  }
  children.push(tog('guide', '🎓 新手引导', !!view.guideOn, 'toggle-guide'));
  children.push({ type: 'Label', id: 'ggt-set-theme-l', props: { text: '主题', size: 'xs', color: 'dim', bold: true, tracking: 2 } });
  children.push({ type: 'Segmented', id: 'ggt-set-theme', props: { options: [{ value: 'onyx', label: '玄铁' }, { value: 'brocade', label: '锦霞' }], value: view.theme, action: 'theme' } });
  return { type: 'Panel', id: 'ggt-settings', props: {}, layout: { direction: 'column', gap: 9, padding: 14, width: 214 }, children };
}

// ── 教学旁白 / 临时提示横幅（数据驱动·UI 铁律·棋枰数据化②外的战斗 chrome 去 bespoke）──────
// 教官旁白=金描边(accent)横幅；提示 toast=警示红/金提示靠 bg 染色 + 文字令牌(danger/ok)承载语义。
// 定位/淡入仍由外层绝对定位壳承担（同 clash/settings·renderNode 不进位置壳）。
function narrationNode(text: string): LayoutNode {
  return {
    type: 'Panel', id: 'ggt-narr', props: { accent: true, bg: 'linear-gradient(180deg,rgba(28,40,58,.97),rgba(14,24,38,.98))' },
    layout: { direction: 'row', gap: 10, align: 'center', padding: 12 },
    children: [
      { type: 'Label', id: 'ggt-narr-ic', props: { text: '🎓', size: 22 } },
      { type: 'Label', id: 'ggt-narr-tx', props: { text, size: 14, color: 'text' } },
    ],
  };
}
function noticeNode(text: string, warn: boolean): LayoutNode {
  return {
    type: 'Panel', id: 'ggt-notice', props: { bg: warn ? 'rgba(60,18,18,.96)' : 'rgba(20,34,26,.96)' },
    layout: { direction: 'row', align: 'center', justify: 'center', padding: 9 },
    children: [{ type: 'Label', id: 'ggt-notice-tx', props: { text, size: 14, color: warn ? 'danger' : 'ok', bold: true } }],
  };
}

// ── 敌方右栏（数据驱动·棋枰数据化②）：Boss 抬头 + 敌源泉/敌牌库 stat + 地煞概览。稀有度色走 bg 圆点（任意色合法）；
// 空格走 Panel.dashed（主程新能力）；蓝色数字 token 缺 → 用 text 近似（结构数据化为先·色微让）。
function railStatNode(id: string, label: string, val: string | number): LayoutNode {
  return { type: 'Panel', id: `rail-${id}`, props: { bg: 'var(--chip)' }, layout: { direction: 'row', align: 'center', gap: 10, padding: 9, radius: 11 }, children: [
    { type: 'Label', id: `rail-${id}-l`, props: { text: label, size: 11, color: 'sub', tracking: 0.6 }, layout: { flex: 1 } },
    { type: 'Label', id: `rail-${id}-v`, props: { text: String(val), size: 22, color: 'text', mono: true, glow: true } },
  ] };
}
function shaRowNode(s: TurnShaView, i: number): LayoutNode {
  const rc = RAR[s.rar] || RAR.white;
  if (!s.filled) return { type: 'Panel', id: `rail-sha-${i}`, props: { dashed: true }, layout: { direction: 'row', align: 'center', gap: 7, padding: 5, radius: 8 }, children: [
    { type: 'Label', id: `rail-sha-${i}-q`, props: { text: '？', size: 13, color: 'dim' } },
    { type: 'Label', id: `rail-sha-${i}-u`, props: { text: '未揭示', size: 10, color: 'dim' } },
  ] };
  const used = s.used ?? false;
  return { type: 'Panel', id: `rail-sha-${i}`, props: { bg: used ? 'rgba(20,24,34,.6)' : 'var(--chip)' }, layout: { direction: 'row', align: 'center', gap: 7, padding: 5, radius: 8 }, children: [
    { type: 'Panel', id: `rail-sha-${i}-dot`, props: { bg: rc[1] }, layout: { width: 7, height: 7, radius: 99, padding: 0 } },
    { type: 'Label', id: `rail-sha-${i}-n`, props: { text: s.name.replace('地煞·', '').replace('地煞 · ', ''), size: 11, color: used ? 'dim' : 'text' }, layout: { flex: 1 } },
    { type: 'Label', id: `rail-sha-${i}-s`, props: { text: used ? '已用' : '待发', size: 9, color: used ? 'warn' : 'ok' } },
  ] };
}
function enemyRailNode(view: TurnBattleView): LayoutNode {
  const header: LayoutNode = { type: 'Panel', id: 'rail-hdr', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 9 }, children: [
    { type: 'Panel', id: 'rail-hdr-ic', props: { bg: 'linear-gradient(150deg,#7a3340,#4a1f28)' }, layout: { width: 36, height: 36, radius: 9, align: 'center', justify: 'center', padding: 0 }, children: [{ type: 'Label', id: 'rail-hdr-ic-g', props: { text: '♥', size: 19, color: 'text' } }] },
    { type: 'Panel', id: 'rail-hdr-tx', props: { bare: true }, layout: { direction: 'column', flex: 1 }, children: [
      { type: 'Label', id: 'rail-hdr-name', props: { text: view.bossName || '敌方', size: 14, color: 'text', bold: true } },
      { type: 'Label', id: 'rail-hdr-sub', props: { text: 'BOSS · 敌方', size: 9, color: 'sub', tracking: 1.4 } },
    ] },
  ] };
  const shaCol: LayoutNode = { type: 'Panel', id: 'rail-sha-col', props: { bare: true }, layout: { direction: 'column', gap: 6 }, children: [
    { type: 'Label', id: 'rail-sha-h', props: { text: `地煞牌 · ${view.sha.filter((s) => s.filled).length}/${view.sha.length}`, size: 10, color: 'sub', bold: true, tracking: 1.2 } },
    ...view.sha.map(shaRowNode),
  ] };
  return { type: 'Panel', id: 'rail', props: {}, layout: { width: 206, direction: 'column', gap: 12, padding: 14, radius: 16 }, children: [header, { type: 'Divider', id: 'rail-div', props: {} }, railStatNode('src', '💧 敌源泉', view.waterB), railStatNode('deck', '🎴 敌牌库', view.deckB), shaCol] };
}

// ── 召唤源泉条（数据驱动·棋枰数据化②）：源帽 + 分段管 + 余量 + 我牌库 + 本回合+N。分段=Panel bg 渐变（蓝填/半填/空）；
// 收退走 fx fade（主程新 kind·替 g-drain）。蓝色余量数字 token 缺 → text 近似。
function waterSegNode(i: number, lit: boolean, half: boolean, draining: boolean): LayoutNode {
  const litFill = 'linear-gradient(180deg,#8fe0ff,#2f93cf)';
  const bg = lit ? litFill : half ? 'linear-gradient(90deg,#8fe0ff,#2f93cf 50%,rgba(255,255,255,.05) 50%)' : 'rgba(255,255,255,.05)';
  return { type: 'Panel', id: `water-seg-${i}`, props: { bg }, layout: { flex: 1, radius: 5, padding: 0, ...(draining ? { fx: [{ kind: 'fade', ms: 520 }] } : {}) } };
}
function waterBarNode(view: TurnBattleView, litCells: number, halfCell: boolean, litLabel: string, drain: { from: number; count: number }): LayoutNode {
  const segs: LayoutNode[] = Array.from({ length: view.waterMax }, (_, i) => waterSegNode(i, i < litCells, !((i < litCells)) && i === litCells && halfCell, drain.count > 0 && i >= drain.from && i < drain.from + drain.count));
  const cap: LayoutNode = { type: 'Panel', id: 'water-cap', props: { bg: 'radial-gradient(circle at 38% 30%, #7fd8f5, #2a7fb8)' }, layout: { width: 36, height: 36, radius: 10, align: 'center', justify: 'center', padding: 0 }, children: [{ type: 'Label', id: 'water-cap-g', props: { text: '源', size: 20, color: 'text' } }] };
  const tube: LayoutNode = { type: 'Panel', id: 'water-tube', props: { bg: 'linear-gradient(180deg, rgba(10,30,46,.9), rgba(6,16,26,.95))', edge: 'foe' }, layout: { flex: 1, height: 34, radius: 12, direction: 'row', gap: 4, padding: 4 }, children: segs };
  const deckCol: LayoutNode = { type: 'Panel', id: 'water-deck', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 1 }, children: [
    { type: 'Label', id: 'water-deck-l', props: { text: '我牌库', size: 9, color: 'sub', tracking: 1 } },
    { type: 'Label', id: 'water-deck-v', props: { text: String(view.deckA), size: 16, color: 'text', mono: true } },
  ] };
  const plus: LayoutNode = { type: 'Panel', id: 'water-plus', props: { bg: 'rgba(70,209,122,.18)', edge: 'ok' }, layout: { radius: 99, padding: 4 }, children: [{ type: 'Label', id: 'water-plus-l', props: { text: `本回合 +${view.waterGain}`, size: 11, color: 'ok', bold: true } }] };
  return { type: 'Panel', id: 'water-bar', props: {}, layout: { direction: 'row', align: 'center', gap: 12, padding: 9, radius: 14 }, children: [
    cap,
    { type: 'Label', id: 'water-title', props: { text: '召唤源泉 · SUMMON FONT', size: 10, color: 'sub', tracking: 1.6 } },
    tube,
    { type: 'Label', id: 'water-level', props: { text: litLabel, size: 22, color: 'text', mono: true, glow: true } },
    deckCol,
    plus,
  ] };
}

export function buildTurnFrameHTML(view: TurnBattleView, drain: { from: number; count: number } = { from: 0, count: 0 }): string {
  const frame = { position: 'relative', width: '1520px', height: '858px', borderRadius: '16px', overflow: 'hidden', background: 'var(--paper)', border: '3px solid var(--frame-edge)', boxShadow: '0 30px 80px rgba(0,0,0,.6), inset 0 0 0 1px var(--hairline)', display: 'flex', flexDirection: 'column' }; // 1520×858≈16:9：contain 缩放在宽屏near-填满·多出的宽给敌方右栏(owner 2026-06-28·不拉伸牌面)
  const topbar = { display: 'flex', alignItems: 'center', padding: '13px 22px', borderBottom: '1px solid var(--panel-border)' }; // 仅留 chrome（padding+下边线）·内容已迁 topbarNode(LayoutNode)
  const body = { flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 0, overflow: 'hidden', padding: '10px 22px 6px', gap: '12px' }; // 行：棋盘列 + 敌方右栏（多出的宽给敌方信息·棋盘不拉伸·owner 2026-06-28）
  const boardCol = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '10px' }; // 棋盘 + 源泉条（竖排·占主区）
  const boardWrap = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '6px', padding: '12px 10px', borderRadius: '18px', background: 'var(--board)', backgroundImage: 'radial-gradient(46% 80% at 50% 50%, rgba(232,205,138,.10), transparent 70%), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 34px)', border: '6px solid var(--board-edge)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.06), inset 0 0 90px rgba(0,0,0,.5)' };
  const lanesCol = { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'stretch', minHeight: 0 };
  // water bar
  const litCells = Math.max(0, Math.min(view.waterMax, Math.floor(view.water + 1e-6)));
  const halfCell = view.water - litCells >= 0.5 - 1e-6 && litCells < view.waterMax; // 半格：源泉含 0.5（每回合 +1.5·弃牌返 0.5）
  const litLabel = Number.isInteger(view.water) ? String(view.water) : view.water.toFixed(1);
  // 源泉条 → 数据驱动 waterBarNode（分段 Panel + fx fade 收退·见上）。litCells/halfCell/litLabel 传入。
  // bottom
  const bottomBar = { position: 'relative', zIndex: 50, flex: 'none', height: '212px', display: 'flex', gap: '14px', padding: '12px 22px 16px', borderTop: '1px solid var(--panel-border)', background: 'linear-gradient(180deg,transparent,rgba(0,0,0,.18))' };
  const hi = view.tutorial?.highlight ?? ''; // 棋格/手牌教学高亮（生产态 tutorial 恒空·留作未来教学）
  // 教学旁白横幅（doc28·教官旁白·覆于棋盘上方·不挡操作）。
  const narrationBanner = view.tutorial?.narration
    ? `<div style="${st({ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 56, maxWidth: '74%' })}">${renderNode(narrationNode(view.tutorial.narration), GG_BATTLE_THEME)}</div>`
    : '';
  // 临时提示 toast（放牌后可翻一道机关门 / 非时翻门无效）。✗ 开头=警示红·否则金提示。
  const isWarn = view.notice?.startsWith('✗');
  const noticeBanner = view.notice
    ? `<div style="${st({ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 57, maxWidth: '78%', animation: 'g-fade .2s ease both' })}">${renderNode(noticeNode(view.notice, !!isWarn), GG_BATTLE_THEME)}</div>`
    : '';
  const handArea = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '13px 16px', borderRadius: '14px', background: 'var(--panel)', border: '1px solid var(--panel-border)', boxShadow: 'inset 0 0 0 1px var(--hairline)' };
  const handCount = { padding: '3px 10px', borderRadius: '99px', background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '11px', border: '1px solid var(--accent)' };
  const handCountGang = { padding: '3px 10px', borderRadius: '99px', background: 'rgba(140,110,255,.16)', color: '#a98bff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: '11px', border: '1px solid #a98bff' };

  const settingsPanel = view.settingsOpen
    ? `<div style="${st({ position: 'absolute', top: '70px', right: '22px', zIndex: 80, animation: 'g-fade .18s ease both' })}">${renderNode(settingsNode(view), GG_BATTLE_THEME)}</div>`
    : '';
  return `<div style="${st(frame)}">
    <div style="${st(topbar)}">${renderNode(topbarNode(view), GG_BATTLE_THEME)}</div>
    ${settingsPanel}
    <div style="${st(body)}">
      <div style="${st(boardCol)}">
        <div style="${st(boardWrap)}">
          ${narrationBanner}${noticeBanner}
          ${fortBase(view, true)}
          <div style="${st(lanesCol)}">${forr(view.lanes, (L, li) => renderNode(laneRowNode(L, li, hi === 'lane:' + li), GG_BATTLE_THEME))}${laddersLayer(view)}</div>
          ${fortBase(view, false)}
        </div>
        ${renderNode(waterBarNode(view, litCells, halfCell, litLabel, drain), GG_BATTLE_THEME)}
      </div>
      ${renderNode(enemyRailNode(view), GG_BATTLE_THEME)}
    </div>
    <div style="${st(bottomBar)}">
      ${renderNode(actionMenuNode(view), GG_BATTLE_THEME)}
      <div style="${st(handArea)}">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"><span style="font-family:var(--fh); font-weight:700; font-size:14px; color:var(--ink); letter-spacing:.04em;">手牌</span><span style="${st(handCount)}">兵牌 ${view.handPawnCount}</span><span style="${st(handCountGang)}">天罡 ${view.handGangCount}</span><div style="flex:1;"></div><span style="font-size:11px; color:var(--ink-dim);">放牌消耗召唤源泉 · 点动作选「放牌」后落子</span></div>
        <div style="display:flex; gap:11px; align-items:flex-end;">${forr(view.hand, (c, i) => handCard(c, i, hi === 'hand:' + i))}</div>
      </div>
      ${renderNode(endTurnNode(), GG_BATTLE_THEME)}
    </div>
    ${view.clash ? `<div style="${st({ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,9,13,.74)', backdropFilter: 'blur(5px)', animation: 'g-fade .3s ease both' })}">${renderNode(clashNode(view.clash), GG_BATTLE_THEME)}</div>` : ''}
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

export interface TurnViewOpts { theme?: 'onyx' | 'brocade'; tengangName?: (id: string) => string; tengangDesc?: (id: string) => string; clash?: TurnClashView | null; sha?: TurnShaView[]; bossName?: string; selMode?: string | null; selHand?: number; tutorial?: { narration: string; highlight: string } | null; gatesLive?: boolean; notice?: string | null; movedIds?: Set<string>; freshIds?: Map<string, number>; dealtId?: string; battleLabel?: string; sfxOn?: boolean; settingsOpen?: boolean; bgmOn?: boolean; bgmIdx?: number; bgmVol?: number; bgmNames?: string[]; guideOn?: boolean; enchOf?: (rank: string, suit: string) => [string, number][]; inlays?: Record<string, InlayEntry[]> }
/** 从 turn-combat 真状态派生战斗屏视图（玩家 = side a 视角）。纯读、不改 battle。 */
export function buildTurnBattleView(b: TurnBattle, opts: TurnViewOpts = {}): TurnBattleView {
  const laneNames = ['上路', '中路', '下路'];
  const tgNm = opts.tengangName ?? ((id: string) => id);
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
      if (!hit) return { ...base, hasUnit: false, mine: i < 4 };
      // ⑥ 此刻若评估的战力拆解（含天罡/士气/地煞·与真实掷命同源 unitPowerParts）→ hover 透出全部加成来源（owner 2026-06-29）。
      const parts = unitPowerParts(b, hit.mine ? 'a' : 'b', li, hit.u);
      // 角标=**当前有效战力 pEff**（含天罡/士气/地煞·与掷命预报/实判同源·owner 2026-06-29「两边都19却碾压」＝旧角标只显静态点数+养成·没把加成算进去）。
      return { ...base, hasUnit: true, mine: hit.mine, rank: hit.u.rank, suit: lc(hit.u.suit), power: parts.pEff, pts: hit.u.points, buff: hit.u.buff, name: heroNameOf(hit.u.rank, lc(hit.u.suit)) ?? (SUITNM[lc(hit.u.suit)] + hit.u.rank), rar: rankOf(hit.u.rank), zod: [], unitId: hit.u.id, justMoved: opts.movedIds?.has(hit.u.id) ?? false, fresh: opts.freshIds?.get(hit.u.id), tipDown: li === 0, tipSide: (i >= 7 ? 'left' : i <= 1 ? 'right' : '') as 'left' | 'right' | '', general: hit.u.general, ench: hit.mine ? opts.enchOf?.(hit.u.rank, hit.u.suit) : undefined, live: powerRows(parts, hit.mine, tgNm, opts.inlays), livePower: parts.pEff };
    });
    return { name: laneNames[li] ?? ('路' + li), slots };
  });
  const descOf = opts.tengangDesc ?? (() => '持续战法·打出后整场生效');
  const hand: TurnHandCardView[] = b.a.hand.map((c, i) => c.kind === 'poker'
    ? { kind: 'pawn', rank: c.rank, suit: lc(c.suit), name: SUITNM[lc(c.suit)] + c.rank, power: cardPoints(c.rank) + c.buff, pts: cardPoints(c.rank), buff: c.buff, cost: c.cost ?? DEPLOY_COST, zod: [], rar: rankOf(c.rank), selected: opts.selHand === i, dealt: opts.dealtId != null && c.id === opts.dealtId, affordable: (c.cost ?? DEPLOY_COST) <= b.a.mana, general: c.general, ench: opts.enchOf?.(c.rank, c.suit) }
    : { kind: 'gang', name: tgNm(c.id), cost: CAST_COST, rar: 'gold', desc: descOf(c.id), glyph: '✦', selected: opts.selHand === i, dealt: opts.dealtId != null && c.id === opts.dealtId, affordable: CAST_COST <= b.a.mana });
  const ACT: [string, string, string][] = [['draw', '🎴', '抽牌'], ['deploy', '♟', '放牌'], ['cast', '✦', '打天罡'], ['discard', '🗑', '弃牌']];
  const sel = b.actionTaken;
  const mode = opts.selMode ?? sel; // 当前高亮动作类：未提交时取 UI 选中(selMode)，已锁则取 actionTaken
  const SUB: Record<string, string> = { draw: '抽牌:天罡/扑克二选一', deploy: '放牌:免费·有牌就一直放(放牌区=贴家3格)→放完可点机关门(箭头)翻门调度·或结束回合', cast: '打天罡:选一张法术牌施放', discard: '弃牌:不互斥·弃后可再选一类动作(抽/放/打天罡)', '': '选一类动作·其余本回合锁定（弃牌例外：弃后可追加）' };
  const actions: TurnActionView[] = ACT.map(([key, glyph, label]) => ({ key, glyph, label, on: mode === key, dim: !!sel && sel !== key }));
  return {
    theme: opts.theme ?? 'onyx',
    turnWho: b.active === 'a' ? '我方回合' : '敌方回合', roundNo: b.turn, timerLabel: '∞ 无限时',
    water: b.a.mana, waterMax: 10, waterB: b.b.mana, waterGain: manaGain(b.turn),
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
    bgmOn: opts.bgmOn ?? false, bgmIdx: opts.bgmIdx ?? 0, bgmVol: opts.bgmVol ?? 0.35, bgmNames: opts.bgmNames ?? [], guideOn: opts.guideOn ?? false,
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
  clashRoll?: () => void;    // 掷命对决·玩家点骰（owner 2026-06-21）→ 蓄力+数字滚动→揭晓胜负
  goBack?: () => void;       // 返回大厅（带确认）
  bossInfo?: () => void;     // 点敌方大本营 → 弹 Boss 名号 + 战役故事
  toggleSfx?: () => void;    // 切换音效开/关
  toggleSettings?: () => void; // 开/关设置面板
  toggleBgm?: () => void;    // 切换背景音乐开/关（与音效分开）
  toggleGuide?: () => void;  // 切换新手引导开/关（owner 2026-06-21·卡住保险阀）
  selectBgm?: (idx: number) => void; // 选第几首 BGM
  setBgmVol?: (dir: 'up' | 'down') => void; // BGM 音量 −/＋
}

/** live mount（忠实 mirror battle-screen.mountBattle）：按需重渲 + pointerdown 委派——重渲再频繁也夹不进按下→抬起。
 *  固定 1340×858 画框按 host 宽显式 scale 铺满（不靠 cqw）。getView 每次重渲实时派生当前态。返回 {update,destroy}。 */
export function mountTurnBattle(host: HTMLElement, getView: () => TurnBattleView, actions: TurnBattleActions = {}): { update: () => void; destroy: () => void } {
  if (!document.getElementById('gg-fonts')) { const f = document.createElement('div'); f.id = 'gg-fonts'; f.style.display = 'none'; f.innerHTML = FONTS; const st = f.querySelector('style'); if (st) document.head.appendChild(st); }
  if (!document.getElementById('gg-turn-css')) { const s = document.createElement('style'); s.id = 'gg-turn-css'; s.textContent = CSS; document.head.appendChild(s); }
  ensureUiKeyframes(document); // fx 关键帧（topbar 灯/掷命钮 pulse 等）自注入——战斗走 renderNode+innerHTML 不经 mountUI·不再靠大厅先挂(主程 2026-06-28 导出)

  // 召唤源泉收退动效（owner 2026-06-21）：跨重渲对比上次亮格数 → 本次刚花掉的格走 g-drain「往后退」收退。
  // 重渲极频(选牌也重渲)：只在亮格「减少」时记一次 drain，并用计时器在动画时长后清掉——中途无关重渲不会打断/重放。
  let prevLit = -1; let drain = { from: 0, count: 0 }; let drainTimer = 0;
  let localNotice = ''; let localNoticeTimer = 0;
  // contain 缩放（owner 2026-06-28·对齐大厅占满感·消四周留白）：取「宿主宽/1340」与「宿主高/858」较小者，
  // 棋盘整张可见、最大化、居中·只在不匹配的那一轴留对称小白边（替旧「按宽缩放 + 140vh 盖」的四面留白）。
  // 宿主须有确定宽高（game-g.tsx stage 已 100%×100% 占满 root）；无头(happy-dom)量到 0 → 回退 1（全尺寸·测只看 DOM）。
  const scaleOf = (): number => { const w = host.clientWidth, h = host.clientHeight; return (w > 0 && h > 0) ? Math.min(w / 1520, h / 858) : (w > 0 ? w / 1520 : 1); };
  const applyScale = (): void => { // ResizeObserver 走这条：只重算缩放·不整片重建 DOM（断「RO→render→改高→再触发 RO」循环·消掌机闪烁·owner 2026-06-22）
    const inner = host.querySelector('.ggt-inner') as HTMLElement | null;
    if (!inner) return; inner.style.setProperty('zoom', String(scaleOf())); // outer 现 100%×100% flex 居中·只改 inner zoom（仍 CSS zoom·不合成图层·掌机安全）
  };
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
    const sc = scaleOf(); // 先量后写：缩放烤进首帧 markup（单次绘制·无未缩放帧）。
    // ── 行军滑动动画（owner 2026-06-29「要看到牌往前移动的过程」·FLIP：First-Last-Invert-Play）──
    // 棋盘整片 innerHTML 重建·原本兵牌瞬移到新格（无过渡）。FLIP：重建前记每个兵元素旧屏幕坐标 → 重建后比新坐标 →
    // 给兵元素先 invert 回旧位(transform)·下一帧过渡到 0 → 视觉=从旧格滑到新格（含疾行 2 格·真实位移）。
    // 仅在「本帧有兵 justMoved」时跑（推进帧）→ 选牌/hover 等高频重渲不付 reflow 代价（掌机友好）。
    const willMove = view.lanes.some((L) => L.slots.some((s) => s.hasUnit && s.justMoved));
    const unitBoxes = (): Map<string, DOMRect> => { // 各兵容器(#u-<id>·每格首个 [id^=u-])的当前屏幕矩形
      const m = new Map<string, DOMRect>();
      host.querySelectorAll('[id^="cell-"]').forEach((cell) => { const u = cell.querySelector('[id^="u-"]') as HTMLElement | null; if (u) m.set(u.id, u.getBoundingClientRect()); });
      return m;
    };
    const first = willMove ? unitBoxes() : null; // FIRST：重建前旧位
    // ⚠ 用 CSS zoom 而非 transform:scale —— zoom 是 CPU 布局缩放、不生成合成图层；掌机弱 GPU 合成「整屏 transform 缩放图层」会失败→黑屏（Mac 好 GPU 正常·owner 2026-06-22 烧版「apollo 绿字+黑屏」=此因）。zoom 即便不被支持也只是不缩放=裁切·绝不黑。
    const innerStyle: Style = { ...(THEMES[view.theme] ?? THEMES.onyx), width: '1520px', height: '858px', zoom: sc, fontFamily: 'var(--fb)' };
    host.innerHTML = `<div class="ggt-outer" style="position:relative; width:100%; height:100%; overflow:hidden; background:#0c0a08; display:flex; align-items:center; justify-content:center"><div class="ggt-inner" style="${st(innerStyle)}">${buildTurnFrameHTML(view, drain)}</div></div>`; // outer 占满 stage·flex 居中棋盘·四周对称留白(contain)
    // ⚠ zoom 必须经 JS setProperty 落地，不能只靠 style 属性串——浏览器解析 innerHTML 的 style 属性时会丢弃 zoom（非标准属性·
    //   属性串里被吞），只有 setProperty('zoom',…) 才生效。此前仅 mount 时 RO→applyScale 落了一次 zoom；点击重渲后 zoom 丢失→
    //   画框退回原始 1520×858（窗口小于此即溢出出界=「点一下放大一圈/边缘看不到」·owner 2026-06-29 反复撞）。每帧补设即根除。
    const giz = host.querySelector('.ggt-inner') as HTMLElement | null; if (giz) giz.style.setProperty('zoom', String(sc));
    if (first) { // LAST + INVERT + PLAY
      const z = sc || 1; // getBoundingClientRect 是 zoom 后屏幕坐标；transform 在元素本地空间(zoom 前) → 位移除以 zoom
      host.querySelectorAll('[id^="cell-"]').forEach((cell) => {
        const u = cell.querySelector('[id^="u-"]') as HTMLElement | null; if (!u) return;
        const old = first.get(u.id); if (!old) return; // 新部署兵无旧位 → 不滑（走落子动画/直接出现）
        const now = u.getBoundingClientRect(); const dx = (old.left - now.left) / z, dy = (old.top - now.top) / z;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return; // 没动 → 跳过
        u.style.transform = `translate(${dx}px,${dy}px)`; u.style.transition = 'none';
        requestAnimationFrame(() => { u.style.transition = 'transform .68s cubic-bezier(.22,.7,.3,1)'; u.style.transform = 'none'; }); // owner 2026-06-29「行军慢一半」：.34s→.68s
      });
    }
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
    const act = t.closest('[data-act],[data-action]') as HTMLElement | null; // data-act=手写片段；data-action=renderNode 数据驱动片段（顶栏等迁 LayoutNode·UI 铁律）·同一委托统一接
    if (act) {
      const a = act.dataset.act ?? act.dataset.action, k = act.dataset.k ?? act.dataset.arg ?? '';
      if (a === 'end') actions.endTurn?.();
      else if (a === 'clash-ok') actions.clashConfirm?.();
      else if (a === 'clash-roll') { actions.clashRoll?.(); return; } // 自己播掷骰动效·不整片重渲(防卡牌飞入重启)
      else if (a === 'go-back') { actions.goBack?.(); render(); return; }
      else if (a === 'boss-info') { actions.bossInfo?.(); return; }
      else if (a === 'settings-toggle') { actions.toggleSettings?.(); }
      else if (a === 'toggle-sfx') { actions.toggleSfx?.(); }
      else if (a === 'toggle-bgm') { actions.toggleBgm?.(); }
      else if (a === 'toggle-guide') { actions.toggleGuide?.(); }
      else if (a === 'bgm-track') { actions.selectBgm?.(parseInt(k, 10)); }
      else if (a === 'bgm-vol') { actions.setBgmVol?.(k === 'up' ? 'up' : 'down'); }
      else if (a === 'theme') actions.setTheme?.(k === 'brocade' ? 'brocade' : 'onyx');
      else if (a === 'draw-poker') actions.drawFrom?.('poker');
      else if (a === 'draw-tengang') actions.drawFrom?.('tengang');
      else if (a === 'lane') { actions.playLane?.(parseInt(k, 10)); render(); return; } // 棋枰数据化②：路轨迁 Panel.action='lane'（替 data-lane）·点该路落子
      else if (a === 'draw' || a === 'deploy' || a === 'cast' || a === 'discard') actions.pickAction?.(a);
      render(); return;
    }
    const lane = t.closest('[data-lane]') as HTMLElement | null;
    if (lane) { actions.playLane?.(parseInt(lane.dataset.lane ?? '-1', 10)); render(); return; }
  };
  host.addEventListener('pointerdown', onPress);
  // ── 场上兵 hover 战力拆解气泡（owner 2026-06-29 ⑥）──
  // 战斗屏走 renderNode+innerHTML·不跑 mountUI → 不能用 LayoutNode Tooltip(气泡靠 mountUI 显隐+定位·且 tabindex 点击触发画框 scroll 缩放·GA 2987b0e2 已拆)。
  // 自管一个 position:fixed 气泡(挂 document.body·逃出棋盘多层 overflow:hidden 裁剪·无 tabindex 不触发 scroll-into-view)，
  // 内容 = cardTipNode(该兵 live 拆解·含天罡/士气/地煞来源)·随光标上/下弹 + clamp 视口内。
  let tipEl: HTMLDivElement | null = null;
  const hideTip = (): void => { if (tipEl) { tipEl.style.display = 'none'; tipEl.innerHTML = ''; } };
  const cellOf = (t: HTMLElement | null): HTMLElement | null => { // climb 到 id 恰为 cell-<idx> 的格容器（子件 id 如 cell-3-fc 也以 cell- 起头·需精确匹配）
    let el = t?.closest('[id^="cell-"]') as HTMLElement | null;
    while (el && !/^cell-\d+$/.test(el.id)) el = (el.parentElement?.closest('[id^="cell-"]') as HTMLElement | null) ?? null;
    return el;
  };
  const onHover = (e: MouseEvent): void => {
    const cell = cellOf(e.target as HTMLElement);
    const m = cell ? /^cell-(\d+)$/.exec(cell.id) : null;
    if (!cell || !m) { hideTip(); return; }
    const idx = parseInt(m[1], 10); const s = getView().lanes[Math.floor(idx / 9)]?.slots[idx % 9];
    if (!s || !s.hasUnit) { hideTip(); return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.style.cssText = 'position:fixed;z-index:400;pointer-events:none;display:none'; document.body.appendChild(tipEl); }
    const th = THEMES[getView().theme] ?? THEMES.onyx; for (const k in th) tipEl.style.setProperty(k, th[k]); tipEl.style.fontFamily = 'var(--fb)'; // 气泡在 body 顶层·须自带战斗皮令牌(var(--ink)/--panel…) 否则 var() 解析失败
    tipEl.innerHTML = renderNode(cardTipNode(s), GG_BATTLE_THEME);
    tipEl.style.display = 'block';
    const r = cell.getBoundingClientRect(); const bw = tipEl.offsetWidth || 220, bh = tipEl.offsetHeight || 130;
    let left = r.left + r.width / 2 - bw / 2; let top = r.top - bh - 8; // 默认上弹
    if (top < 6) top = r.bottom + 8; // 顶部空间不足 → 改下弹
    tipEl.style.left = Math.max(6, Math.min(left, window.innerWidth - bw - 6)) + 'px';
    tipEl.style.top = Math.max(6, Math.min(top, window.innerHeight - bh - 6)) + 'px';
  };
  host.addEventListener('mouseover', onHover);
  host.addEventListener('mouseleave', hideTip);
  const onPressHide = (): void => hideTip(); host.addEventListener('pointerdown', onPressHide); // 点击改状态 → 收起气泡防陈旧
  render();
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => applyScale()); ro.observe(host); } // 只重缩放·不整片重渲（断 RO 反馈循环·owner 2026-06-22 掌机闪烁修）
  return { update: render, destroy: () => { if (ro) ro.disconnect(); if (drainTimer) clearTimeout(drainTimer); if (localNoticeTimer) clearTimeout(localNoticeTimer); host.removeEventListener('pointerdown', onPress); host.removeEventListener('mouseover', onHover); host.removeEventListener('mouseleave', hideTip); host.removeEventListener('pointerdown', onPressHide); if (tipEl) { tipEl.remove(); tipEl = null; } host.replaceChildren(); } };
}

/** 自包含 HTML 文档（看帧/预览/无头截图；固定 1340×858·非 cqw·无需缩放注入）。 */
export function renderTurnBattleDoc(view: TurnBattleView): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${FONTS}<style>*{box-sizing:border-box;}body{margin:0;background:#0c0a08;}${CSS}</style></head><body>${buildTurnBattleHTML(view)}</body></html>`;
}
