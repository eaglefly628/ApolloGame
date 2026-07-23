// Game C ·《六人德州》—— 视觉常量 + 夜宴系 UITheme（纯数据·零逻辑）。
// 色锚=场景线风格锚 `vegas-victoriana`（art-data-manual §1 唯一权威·照抄十六进制）；
// 人物线（头像/立绘/衣物图标）走 sakura-nijigen 双锚（REQ-C-ART 修订①·美术台账件·S6 接）。
// 布局基准=ui-brief §1 / art-data-manual §5：横屏 1280×720 逻辑分辨率。
import type { UITheme } from '@ui/components/index.js';
import type { Card } from '@engine/protocol/components.js';

export const FIELD_W = 1280;
export const FIELD_H = 720;

// ── 色板（STORY-POKER V2·夜紫电影化·十六进制照抄 GD-C 稿 story-poker-v2.dc.html）───────────────
//   owner 2026-07-21「美术无限逼近设计稿」：把旧夜宴棕金色板整体换成稿里的紫罗兰调（面板/felt/立绘/搭档一体紫）。
export const C = {
  nightBg: '#1c1422', nightBg2: '#0b070d',        // 页背景紫黑（稿 backdrop 180deg #1c1422→#0b070d）
  walnutGlow: '#2a1f38',                            // 窗内壁暖冷晕
  panel0: '#221626', panel1: '#0f090c',            // 面板亮/暗（rgba(34,22,38)/rgba(15,9,18) 近似）
  cinnabar: '#d0483e',                              // all-in 红（稿 #d0483e→#a01e3a）
  goldA: '#ecca8a', goldB: '#d8b878',              // 金亮/金中（稿 #ecca8a/#d8b878）
  goldEdge: '#d8b878', goldSoft: '#c9b18a', goldPale: '#ecca8a',
  ivory: '#f0e6dc',                                 // 暖象牙主字（稿 #f0e6dc）
  mute: '#b3a08f', mute2: '#7a6a5c',               // 次级/弱字（稿 #b3a08f / #7a6a5c）
  jade: '#5fd39a', jadeBack: '#12281f',            // 跟注/已过 绿（稿 rgba(52,211,120)）
  clay: '#e6a0c4', clayBack: '#3a1a2e',            // 粉（胜利注 / 底池 label·稿 #e6a0c4）
  feltA: '#7d5570', feltB: '#5a3a52', feltC: '#281620', // 紫绒面（稿 radial 中亮 #7d5570 → 边暗 #281620）
  cardRed: '#c0392b',
  violet: '#c9a9dd', violetB: '#b98fd6', violetDeep: '#8a5fa8', // 立绘框 / 搭档 / 加注槽 紫（稿 #c9a9dd…）
  outGray: '#8a8a94',
} as const;

// 页背景（紫黑径向·稿 backdrop·3D 呢面桌背后夜景氛围·scene sceneBackground 回退层）。
export const ROOM_BG =
  'radial-gradient(140% 120% at 50% -10%, #1a121e 0%, #140d16 46%, #0b070d 100%)';
export const WRAPPER_BG = '#08050c';

// ── 电影化夜景背幕（STORY-POKER V2 稿·全屏落地窗+城市散景·纯声明式 SVG=数据·非手写自由 DOM）──────────
//   3D 呢面桌背后的场景（renderer.setBackgroundTexture 的既定用途「手绘天空渐变图·Cloud Design 素材」）：
//   紫黑竖渐变 + 落地窗(暖/冷散景点阵 + 窗棂 + 暖冷光晕) + 两侧暗角 + 桌心暖光池。照稿 backdrop 逐层复刻。
const BACKDROP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241734"/><stop offset=".44" stop-color="#1a1226"/><stop offset="1" stop-color="#100a18"/></linearGradient>
<linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2c50"/><stop offset=".58" stop-color="#241a34"/><stop offset="1" stop-color="#140d1e"/></linearGradient>
<radialGradient id="warm"><stop offset="0" stop-color="#ffc882" stop-opacity=".26"/><stop offset=".7" stop-color="#ffc882" stop-opacity="0"/></radialGradient>
<radialGradient id="cool"><stop offset="0" stop-color="#c39aee" stop-opacity=".24"/><stop offset=".7" stop-color="#c39aee" stop-opacity="0"/></radialGradient>
<radialGradient id="floor" cx=".5" cy=".4"><stop offset="0" stop-color="#ffd296" stop-opacity=".12"/><stop offset=".66" stop-color="#ffd296" stop-opacity="0"/></radialGradient>
<pattern id="dw" width="15" height="21" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".95" fill="#ffce8c" opacity=".62"/></pattern>
<pattern id="dc" width="26" height="30" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#c0a0ff" opacity=".44"/></pattern>
<linearGradient id="vl"><stop offset="0" stop-color="#0e0810"/><stop offset="1" stop-color="#0e0810" stop-opacity="0"/></linearGradient>
<linearGradient id="vr" x1="1" x2="0"><stop offset="0" stop-color="#0e0810"/><stop offset="1" stop-color="#0e0810" stop-opacity="0"/></linearGradient>
</defs>
<rect width="1280" height="720" fill="url(#bg)"/>
<g><rect x="48" y="-46" width="1184" height="404" rx="8" fill="url(#win)"/>
<rect x="48" y="-46" width="1184" height="404" fill="url(#dw)"/>
<rect x="48" y="-46" width="1184" height="404" fill="url(#dc)"/>
<circle cx="270" cy="150" r="200" fill="url(#warm)"/><circle cx="1010" cy="120" r="220" fill="url(#cool)"/>
<g stroke="#0a060e" stroke-opacity=".85"><line x1="344" y1="-46" x2="344" y2="358" stroke-width="6"/><line x1="640" y1="-46" x2="640" y2="358" stroke-width="6"/><line x1="936" y1="-46" x2="936" y2="358" stroke-width="6"/><line x1="48" y1="153" x2="1232" y2="153" stroke-width="5" stroke-opacity=".78"/></g></g>
<rect width="1280" height="720" fill="url(#floor)"/>
<rect width="220" height="720" fill="url(#vl)"/><rect x="1060" width="220" height="720" fill="url(#vr)"/>
</svg>`;
/** 夜景背幕 data-URL（3D 场景背景贴图·render-only·不进 sim/hash）。 */
export const STORY_BACKDROP = `data:image/svg+xml,${encodeURIComponent(BACKDROP_SVG)}`;

// 夜紫系 UITheme（令牌值照上方色板·稿 story-poker-v2·换皮即改这一份·游戏 LayoutNode 数据零改）。
export const GAME_C_THEME: UITheme = {
  bg0: '#0b070d', bg1: '#160e1a', bg2: '#221626', bg3: '#3a2842', // bg3 暖紫（牌背/头像底/进度槽·稿 card-back #4a2f42·避冷暗半透感）
  pageBg: ROOM_BG,
  line: 'rgba(201,169,221,0.28)',                  // 紫罗兰细线（稿 border rgba(185,143,214,.28)）
  text: '#f0e6dc', sub: '#b3a08f', dim: '#7a6a5c',
  jade: '#5fd39a', jadeWash: 'rgba(95,211,154,0.12)', jadeLine: 'rgba(95,211,154,0.42)',
  gold: '#ecca8a',
  ok: '#5fd39a', okWash: 'rgba(95,211,154,0.14)',
  warn: '#d8b878', warnWash: 'rgba(216,184,120,0.16)',
  danger: '#d0483e',
  mine: '#c9a9dd', foe: '#e6a0c4', // 紫罗兰(搭档/立绘/加注槽) / 粉(胜利注·底池 label)·稿 accent·借 mine/foe 令牌槽入闭集
  ink: '#2a1420',
  fontUi: "'Noto Sans SC','PingFang SC','Microsoft YaHei','Source Han Sans SC',sans-serif",
  fontMono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  fontSerif: "'Noto Serif SC','Songti SC','Source Han Serif SC',serif",
};

// ── 对手座位屏幕锚点（art-data-manual §5.2·%·座位卡中心·固定相机=固定屏幕常量）──
// nameEn（owner 2026-07-20 中英切换）：五姨太的英文名·取花/玉名·首字母各异(R/L/J/P/I)使头像首字不撞。
export interface SeatAnchor { seat: number; name: string; nameEn: string; xPct: number; yPct: number; }
export const OPPONENT_ANCHORS: readonly SeatAnchor[] = [
  { seat: 1, name: '大姨太', nameEn: 'Rose', xPct: 87, yPct: 38 },
  { seat: 2, name: '二姨太', nameEn: 'Lily', xPct: 71, yPct: 9 },
  { seat: 3, name: '三姨太', nameEn: 'Jade', xPct: 22, yPct: 8 },
  { seat: 4, name: '四姨太', nameEn: 'Pearl', xPct: 12, yPct: 38 },
  { seat: 5, name: '五姨太', nameEn: 'Iris', xPct: 20, yPct: 66 },
] as const;

// 对手座位锚点（owner 2026-07-20 入局人数 2~6 + 左侧主角立绘框）：把 (count-1) 个对手沿桌**上弧**均布——
//   弧**右移**（cx57·左端 ≥~28%）给左侧主角立绘框(x14~226px)让位·避撞；避开底部主角区（立绘框 + 底牌 + 行动条）。
export function opponentAnchors(count: number): SeatAnchor[] {
  const n = Math.max(2, Math.min(6, count));
  const k = n - 1; // 对手数
  const nm = (j: number): { name: string; nameEn: string } => ({ name: OPPONENT_ANCHORS[j]!.name, nameEn: OPPONENT_ANCHORS[j]!.nameEn });
  if (k === 5) {
    // 6 人满席：环绕**上方 + 右侧**铺开（避开左侧立绘框 x14~214px + 顶带 76px + 底部行动条）·手工微调不撞。
    const P: Array<[number, number]> = [[87, 33], [68, 19], [45, 18], [27, 31], [87, 57]];
    return P.map(([xPct, yPct], j) => ({ seat: j + 1, ...nm(j), xPct, yPct }));
  }
  // ≤5 人：上弧**均匀横布**（等 x 间距·避端点压缩相撞）·x 让开左侧立绘框、y 压顶带下浅拱。
  const xL = 25, xR = 88, cy = 41, ay = 22;
  return Array.from({ length: k }, (_, j) => {
    const fx = (j + 0.5) / k;
    return { seat: j + 1, ...nm(j), xPct: xL + fx * (xR - xL), yPct: cy - ay * Math.sin(Math.PI * fx) };
  });
}

// 座位卡尺寸（锚点=中心 → 绝对定位左上角需减半宽/半高）。owner 2026-07-20 略缩：给左侧立绘框 + 上弧多席让位防撞。
export const SEAT_W = 150;
export const SEAT_H = 86;

// ── 剧情局 STORY-POKER V2（owner 2026-07-21·GD-C 稿「四人德州·剧情局」·完全复刻·docs/design/game-c/cloud-design/story-poker-v2-ref.png）──
//   4 座：对面三座（左/中·主/右·各带分层立绘）+ 主角一座（你&林晚·底左面板）。固定斜俯视·电影化场景。
//   位置 = 1280×720 px（席卡中心 / 立绘矩形中心+尺寸）。中座=剧情主角（恋爱线对象·立绘最大）。
export interface StorySeatDef {
  seat: number; name: string; nameEn: string;
  cardCx: number; cardCy: number;                       // 席卡中心 px
  portCx: number; portCy: number; portW: number; portH: number; // 立绘矩形中心 + 尺寸 px
  holeCx: number; holeCy: number;                       // 对手底牌指示（两张小背牌·呢面上·在局/弃牌态区分）中心 px（稿 OPPONENT HOLE CARDS）
  main?: boolean;
}
// 位置照稿 story-poker-v2.dc.html 逐像素（立绘=busts behind rail 大且高·席卡在立绘下沿·中座立绘/卡都更大）：
//   立绘 LEFT 中心(269,144)186×252 / CENTER(640,122)214×288 / RIGHT(1011,144)186×252；
//   席卡 LEFT(256,288) / CENTER(640,194) / RIGHT(1024,288)。
export const STORY_OPPONENTS: readonly StorySeatDef[] = [
  // owner 2026-07-21：立绘太大占满屏 → 缩小 40%（×0.6·中座 214×288→128×172·边座 186×252→112×150）。
  // owner 2026-07-22：对手底牌**贴紧各自席位**（在他面前呢面上·不再飘向桌心）——原位太靠中心与公共牌(x462-818/y320-410)重合。
  //   中座=席卡下方、公共牌之上的窄带(holeCy 288)；边座=席卡正下方、各自那一侧(holeCy 384·避开公共牌 x 带)。
  // owner 2026-07-23 默认名定档（demo·三对手=三女主）：左=沈玉薇、中=林曼笙（冷色长发·恋爱线主）、右=顾念念（粉衣笑颜「三姨太」）。
  //   （沈玉薇原拟主角队友，因 owner「三个人都用这三女主」→ 落对手左座；搭档旁白改回林晚避免同名重影·见 STORY_PARTNER。）
  // owner 2026-07-23 长方桌排位：中座=对面远边（不动）；左/右座立绘从顶角下移贴各自席卡上沿（portCy 130→175·portCx 对齐 cardCx）——
  //   长方桌比旧椭圆窄，立绘留在顶角会飘在暗边；下移后每位对手=「立绘+名牌」一体、坐在长方桌左/右长边。
  { seat: 1, name: '林曼笙', nameEn: 'Lin Mansheng', cardCx: 640, cardCy: 194, portCx: 640, portCy: 108, portW: 128, portH: 172, holeCx: 640, holeCy: 288, main: true }, // 中·主（恋爱线·冷色长发·远边·底牌在席卡下/公共牌上窄带）
  { seat: 2, name: '沈玉薇', nameEn: 'Shen Yuwei', cardCx: 256, cardCy: 288, portCx: 256, portCy: 175, portW: 112, portH: 150, holeCx: 300, holeCy: 384 },              // 左长边（酒红旗袍·立绘贴名牌上沿·底牌贴左席下方·呢面左半）
  { seat: 3, name: '顾念念', nameEn: 'Gu Niannian', cardCx: 1024, cardCy: 288, portCx: 1024, portCy: 175, portW: 112, portH: 150, holeCx: 980, holeCy: 384 },          // 右长边（粉衣笑颜「三姨太」·立绘贴名牌上沿·底牌贴右席下方·呢面右半）
] as const;
export const STORY_HERO = { name: '你 & 林晚', nameEn: 'You & Linwan' };   // 主角一座（底左面板·搭档=林晚·三女主全落对手席）
export const STORY_PARTNER = { name: '林晚', nameEn: 'Linwan' };            // 搭档旁白（手牌建议 advice_show·非三女主之一·避免与左座沈玉薇同名）

/** 锚点 %（中心）→ 绝对定位左上角 px（1280×720 基准）。 */
export function anchorTopLeft(a: SeatAnchor): { x: number; y: number } {
  return { x: Math.round((a.xPct / 100) * FIELD_W - SEAT_W / 2), y: Math.round((a.yPct / 100) * FIELD_H - SEAT_H / 2) };
}

// ── holdem-eval Card → PlayingCard props（花色符号 + 点数文本）──────────────────
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
const RANK_TXT: Record<number, string> = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };
export function cardFace(c: Card): { rank: string; suit: string } {
  return { rank: RANK_TXT[c.rank] ?? String(c.rank), suit: SUIT_SYM[c.suit] ?? '♠' };
}

// ── 扑克牌 = 引擎渲染原语（PlayingCard 程序化牌面/牌背·render-only）───────────────────────
// owner 2026-07-22：扑克牌移出美术台账——牌不需要美术修饰，且 vendored 全牌 SVG（自带角标点数）
// 叠在 PlayingCard 组件自绘角标上=「双重」重影。故 cardNode 直用组件原生牌面/牌背，不再引任何贴图；
// 52 牌面 + 牌背既不在 art-ledger.json、也不在 index.json（筹码仍 vendored 保留）。
// 现由 holdem-eval Card{suit,rank} → cardFace() 出点数花色，PlayingCard 红黑自绘（见 hud.cardNode）。

// 牌型英文枚举 → 中文提示（底带牌型提示·art-data-manual §5.4「牌型」）。
export const HAND_NAME_CN: Record<string, string> = {
  'high-card': '高牌', 'pair': '一对', 'two-pair': '两对', 'three-of-a-kind': '三条',
  'straight': '顺子', 'flush': '同花', 'full-house': '葫芦', 'four-of-a-kind': '四条',
  'straight-flush': '同花顺',
};
