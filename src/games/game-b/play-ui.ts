// Game B ·《雀宴》—— 对局屏 SC-play v3（LayoutNode·从 MatchState 投影）。
// owner 2026-07-21 精简：**只留牌桌一块**——去掉左栏（角色卡/导航）+ 顶栏（币/头像/开关）+ 聊天；
// 只保留 出牌区透视梯形（牌区占位框·2D 先行·3D 后放上面）+ 桌上三头像框 + 玩家座条 + 手牌 + 行动键，
// 加最小控制：📜日志 + ☰返回菜单。画布缩到 920×640（mountHost 整块等比缩放·不乱位）。皮=NIGHT 暗紫。
// 全 LayoutNode 闭集·写世界只走 action 信号。
import type { LayoutNode } from '@ui/components/index.js';
import type { MatchState } from './core/game-state.js';
import { canTsumo, canRiichi, canAnkan, canKakan, labelTile, seatWind, isWinLikeEnd, isPlayerTurn, isPlayerCallWindow, STRIP_ITEMS } from './core/game-state.js';
import { kindStr, isRed, kindOf } from './core/tiles-def.js';
import type { Meld } from './core/meld.js';
import type { ChiCandidate } from './core/calls.js';
import { doraFromIndicator } from './core/wall.js';
import { PLAY_W, PLAY_H } from './theme.js';

export const PLAY_TILE = 'play-tile'; // arg=手牌位 key（'0'..'12' 暗手位 / 'd' 摸牌）·两步：先选中再打出
export const ACT_TSUMO = 'act-tsumo';
export const ACT_RIICHI = 'act-riichi';
export const ACT_KAN = 'act-kan';
export const NEXT_ROUND = 'next-round';
export const TOGGLE_LOG = 'toggle-log';
export const BACK_MENU = 'back-menu';
export const COPY_LOG = 'copy-log';
export const MENU_OPEN = 'menu-open';     // 开/关 游戏内菜单浮层
export const RULES_OPEN = 'rules-open';   // 开/关 规则说明浮层
export const TOGGLE_SOUND = 'toggle-sound'; // 声音开关（视觉态·音频系统待接）
export const CALL_PON = 'call-pon';
export const CALL_CHI = 'call-chi';
export const CALL_KAN = 'call-kan';
export const CALL_RON = 'call-ron';
export const CALL_PASS = 'call-pass';

// ── 牌面占位贴图（B-007 FluffyStuff CC0·600×800 象牙牌·赤5 带 -red）─────────────────────
const ART = '/games/game-b/art/mahjong';
function faceUrl(code: number): string {
  const base = isRed(code) ? `${kindStr(code)}-red` : kindStr(code);
  return `${ART}/${base}.png`;
}
// 立绘（座 1=東/左·2=北/上·3=西/右）。
const TACHIE = '/games/game-b/art/tachie';
const OPP_TACHIE: Record<number, string> = { 1: `${TACHIE}/tachie-daiyi.png`, 2: `${TACHIE}/tachie-eryi.png`, 3: `${TACHIE}/tachie-sanyi.png` };

const WIND = ['東', '南', '西', '北'];
const HW = 44, HH = 60;   // 自家手牌
const DW = 22, DH = 30;   // 宝牌

// ── 布局区块常量（精简牌桌·920×640·牌桌居中）────────────────────────────────────────────
const PANEL_X = 8, PANEL_W = PLAY_W - 16, PANEL_Y = 6, PANEL_H = PLAY_H - 12; // 对局盘=整画布
const FELT = 'linear-gradient(168deg,#1e6a5b 0%,#175349 52%,#123c3a 100%)';
// 出牌区透视梯形（居中·rotateX 透视）·**尽量放大让玩家视野更大**（owner 2026-07-21）。
const FELT_W = 728, FELT_H = 448, FELT_X = Math.round((PLAY_W - FELT_W) / 2), FELT_Y = 44;
// 桌底控制带（Y·锚定在梯形投影底边 ~516 之下、手牌顶 ~574 之上的 58px 带内·行动键/回合条贴这里·不压桌不压手牌）。
const BAND_Y = 520;
// 对家屏幕位（座 1=東/左·2=北/上·3=西/右）——贴牌桌左右/上三边。
const OPP_POS: Record<number, { x: number; y: number }> = {
  1: { x: 40, y: 214 },     // 東 左（名条 128 居中溢出·两侧不切边）
  2: { x: 356, y: 4 },      // 北 上中（横排）
  3: { x: 808, y: 214 },    // 西 右（名条 128 居中溢出·两侧不切边）
};

// ── 出牌倒计时环（当前手·闭集件 ProgressBar shape:ring conic 环 + anim:spin 自转·纯 CSS 无重渲染）──
// owner 2026-07-21「每个人头像打牌时有个倒计时圆圈转一转·五秒」——头像角标小环·当前手时自旋提示"读秒中"（不糊脸）。
function countdownRing(id: string, size: number, x: number, y: number): LayoutNode {
  return { type: 'ProgressBar', id, props: { value: 68, max: 100, tone: 'gold', shape: 'ring', size }, layout: { x, y, anim: 'spin' } };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  桌上头像框（東/北/西·贴立绘 + 风位徽 + 名 + 点）= seat-1/2/3（测试钉 seat-* 齐 4）
// ══════════════════════════════════════════════════════════════════════════════════════════
function tableAvatar(m: MatchState, seat: number): LayoutNode {
  const p = OPP_POS[seat]!;
  const active = m.cur.turn === seat && m.cur.phase === 'playing';
  const wind = WIND[seatWind(seat, m.dealer)]!;
  const frame: LayoutNode = {
    type: 'Panel', id: `seat-${seat}-fr`, props: { bg: { custom: 'rgba(24,14,28,0.6)' }, accent: active, glow: active },
    layout: { width: 72, height: 72, padding: 3 },
    children: [
      { type: 'Image', id: `seat-${seat}-p`, props: { src: OPP_TACHIE[seat]!, fit: 'cover' }, layout: { width: 66, height: 66, radius: 8 } },
      // 出牌倒计时环（当前手·右上角小环角标·anim:spin 纯 CSS 自转不触发重渲染·不糊脸）。
      ...(active ? [countdownRing(`seat-${seat}-ring`, 26, 48, -9)] : []),
    ],
  };
  const nameRow: LayoutNode = {
    type: 'Panel', id: `seat-${seat}-nm`, props: { bg: { custom: 'rgba(16,10,20,0.85)' } },
    // 名条固定宽居中：窄于内容时会挤压 Label 换行（「小夜」竖叠）——给定宽 + justify center，
    // 侧座（1/3）的名条比 72 框宽、居中溢出不切边（Panel 非 scroll 不裁溢出）。
    layout: { direction: 'row', gap: 5, align: 'center', justify: 'center', width: 128, padding: 4 },
    children: [
      { type: 'Tag', id: `seat-${seat}-w`, props: { label: wind, tone: active ? 'accent' : 'normal', size: 'sm' } },
      { type: 'Label', id: `seat-${seat}-n`, props: { text: m.seatNames[seat]!, size: 'sm', bold: true, color: 'text' } },
      { type: 'Label', id: `seat-${seat}-s`, props: { text: m.scores[seat]!.toLocaleString('en-US'), size: 'sm', bold: true, color: 'gold' } },
    ],
  };
  const tags: LayoutNode[] = [
    ...(active ? [{ type: 'Tag' as const, id: `seat-${seat}-t`, props: { label: '打牌中', tone: 'accent' as const, size: 'sm' as const } }] : []),
    ...(m.cur.riichi[seat] ? [{ type: 'Tag' as const, id: `seat-${seat}-r`, props: { label: '● 立直', tone: 'accent' as const, size: 'sm' as const } }] : []),
  ];
  // 顶座（2·北位）：横排——头像 beside 名（不竖叠·不上超框）。
  if (seat === 2) {
    return {
      type: 'Panel', id: `seat-${seat}`, props: { bare: true },
      layout: { x: p.x, y: p.y, direction: 'row', gap: 8, align: 'center' },
      children: [frame, { type: 'Panel', id: `seat-${seat}-side`, props: { bare: true }, layout: { direction: 'column', gap: 3, align: 'start' }, children: [nameRow, ...tags] }],
    };
  }
  return {
    type: 'Panel', id: `seat-${seat}`, props: { bare: true },
    layout: { x: p.x, y: p.y, width: 72, direction: 'column', gap: 3, align: 'center' },
    children: [frame, nameRow, ...tags],
  };
}

// 玩家座条（主角·锚定牌桌左下角·owner 2026-07-21）= seat-0（精简·点数不放大·恰在行动键正上方）。
function playerBar(m: MatchState): LayoutNode {
  const active = m.cur.turn === 0 && m.cur.phase === 'playing';
  const wind = WIND[seatWind(0, m.dealer)]!;
  return {
    type: 'Panel', id: 'seat-0', props: { bg: { custom: 'rgba(20,12,26,0.9)' }, accent: active, glow: active },
    layout: { x: FELT_X + 8, y: FELT_Y + FELT_H - 30, width: 200, height: 32, direction: 'row', gap: 8, align: 'center', padding: 6 },
    children: [
      ...(active ? [{ type: 'ProgressBar' as const, id: 'seat-0-ring', props: { value: 70, max: 100, tone: 'gold' as const, shape: 'ring' as const, size: 22 }, layout: { anim: 'spin' as const } }] : []),
      { type: 'Tag', id: 'seat-0-w', props: { label: wind, tone: 'accent', size: 'sm' } },
      { type: 'Label', id: 'seat-0-n', props: { text: m.seatNames[0]!, size: 'sm', bold: true, color: 'text' }, layout: { flex: 1 } },
      ...(m.cur.riichi[0] ? [{ type: 'Tag' as const, id: 'seat-0-r', props: { label: '● 立直', tone: 'accent' as const, size: 'sm' as const } }] : []),
      { type: 'Label', id: 'seat-0-s', props: { text: m.scores[0]!.toLocaleString('en-US'), size: 'sm', bold: true, color: 'gold' } },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  出牌区（透视梯形 + 全部牌区占位框·2D 先标出·3D 后放上面）
// ══════════════════════════════════════════════════════════════════════════════════════════
// 牌河区（梯形**局部**坐标·四家 = 合牌区四边·左右对称·弃牌当梯形子获同款透视/远近放缩·owner 2026-07-21）。
const RG = 2; // 河内牌间距
const RIVER_ZONE: Record<number, { x: number; y: number; w: number; h: number; cols: number; tw: number; th: number }> = {
  0: { x: FELT_W / 2 - 98, y: FELT_H - 112, w: 196, h: 52, cols: 6, tw: 20, th: 24 }, // 你 下（宽·6 列）
  2: { x: FELT_W / 2 - 94, y: 58, w: 188, h: 48, cols: 6, tw: 18, th: 22 },           // 对家 上（宽·6 列·稍小）
  1: { x: 70, y: FELT_H / 2 - 50, w: 52, h: 100, cols: 2, tw: 20, th: 24 },           // 東 左（窄高·2 列）
  3: { x: FELT_W - 122, y: FELT_H / 2 - 50, w: 52, h: 100, cols: 2, tw: 20, th: 24 }, // 西 右（窄高·2 列·镜像左）
};
// 弃牌网格：在各家河区**居中排开**（grid cols·满自动换行·取最近若干张）——梯形子·透视自适应。
function riverTiles(m: MatchState, seat: number): LayoutNode | null {
  const river = m.cur.rivers[seat]!;
  if (!river.length) return null;
  const z = RIVER_ZONE[seat]!;
  const rowsMax = Math.max(1, Math.floor((z.h + RG) / (z.th + RG)));
  const show = river.slice(-(z.cols * rowsMax));
  const rows = Math.ceil(show.length / z.cols);
  const gridW = z.cols * z.tw + (z.cols - 1) * RG;
  const gridH = rows * z.th + (rows - 1) * RG;
  return {
    type: 'Panel', id: `river-${seat}`, props: { bare: true },
    layout: { x: z.x + Math.round((z.w - gridW) / 2), y: z.y + Math.round((z.h - gridH) / 2), width: gridW, direction: 'grid', cols: z.cols, gap: RG },
    children: show.map((c, i): LayoutNode => ({ type: 'Image', id: `river-${seat}-${i}`, props: { src: faceUrl(c), fit: 'contain' }, layout: { width: z.tw, height: z.th } })),
  };
}
function playField(m: MatchState): LayoutNode[] {
  const doraTiles: LayoutNode[] = m.cur.doraInd.map((d, i): LayoutNode => ({
    type: 'Image', id: `dora-${i}`, props: { src: faceUrl(doraFromIndicator(d)), fit: 'contain' }, layout: { width: DW, height: DH },
  }));
  const zone = (id: string, x: number, y: number, w: number, h: number, label: string, tone: 'gold' | 'jade'): LayoutNode => ({
    type: 'Panel', id, props: { bg: { custom: 'rgba(8,20,18,0.22)' }, dashed: true, edge: tone },
    layout: { x, y, width: w, height: h, radius: 6, align: 'center', justify: 'center' },
    children: label ? [{ type: 'Label', id: `${id}-l`, props: { text: label, size: 'xs', color: 'sub' } }] : [],
  });
  const CW = FELT_W, CH = FELT_H;
  const zLabel: Record<number, string> = { 0: '你 · 河', 2: '对家 · 河', 1: '河', 3: '河' };
  // 四家河区占位框（据 RIVER_ZONE·左右对称）+ 实际弃牌网格（同为梯形子·共享透视）。
  const riverZones: LayoutNode[] = [0, 2, 1, 3].map((s) => { const z = RIVER_ZONE[s]!; return zone(`river-z-${s}`, z.x, z.y, z.w, z.h, zLabel[s]!, 'jade'); });
  const discards: LayoutNode[] = [0, 1, 2, 3].map((s) => riverTiles(m, s)).filter((n): n is LayoutNode => n !== null);
  const trapezoid: LayoutNode = {
    type: 'Panel', id: 'felt', props: { bg: { custom: FELT }, dashed: true, edge: 'gold' },
    layout: { x: FELT_X, y: FELT_Y, width: CW, height: CH, rotateX: 34, perspective: 1000, radius: 14 },
    children: [
      { type: 'Panel', id: 'felt-wall', props: { bg: 'transparent', dashed: true, edge: 'jade' }, layout: { x: 24, y: 18, width: CW - 48, height: CH - 36, radius: 12 } }, // 牌山（外圈两层）
      zone('felt-dead', CW / 2 - 62, CH / 2 - 38, 124, 76, '报牌区', 'gold'),                 // 报牌区（正当中）
      ...riverZones,
      ...discards,
    ],
  };
  // 顶部场况状态条（左上·不压牌区）。
  const topStatus: LayoutNode = {
    type: 'Panel', id: 'felt-status', props: { bg: { custom: 'rgba(18,10,22,0.6)' } },
    layout: { x: PANEL_X + 4, y: PANEL_Y + 4, direction: 'row', gap: 8, align: 'center', padding: 6 },
    children: [
      { type: 'Label', id: 'felt-round', props: { text: `${m.roundNo <= 4 ? '東' : '南'}場 · ${WIND[seatWind(m.dealer, m.dealer)]}家`, size: 'sm', bold: true, font: 'serif', color: 'gold' } },
      { type: 'Label', id: 'felt-wall-n', props: { text: `余牌 ${m.cur.wall.length} · ${m.honba}本場 · 供托 ${m.kyotaku / 1000}`, size: 'xs', color: 'jade' } },
    ],
  };
  const centerDora: LayoutNode = {
    type: 'Panel', id: 'felt-info', props: { bare: true },
    layout: { x: FELT_X + FELT_W / 2 - 58, y: FELT_Y + 150, width: 116, direction: 'row', gap: 4, align: 'center', justify: 'center' },
    children: [{ type: 'Label', id: 'felt-dl', props: { text: '宝牌', size: 'xs', color: 'sub' } }, ...doraTiles],
  };
  return [trapezoid, topStatus, centerDora];
}

// ── 自家手牌（底部大排·真牌面·两步打牌·动态张数）──────────────────────────────────────────
function playerHand(m: MatchState, selectedKey: string | null): LayoutNode[] {
  const rs = m.cur;
  const hand = rs.hands[0]!;
  const canPlay = isPlayerTurn(m);
  const locked = rs.riichi[0];
  const showDrawn = rs.drawn !== null && rs.turn === 0;
  const step = HW + 3;
  const drawnGap = 20;
  const n = hand.length;
  const totalW = n * step - 3 + (showDrawn ? drawnGap + HW : 0);
  const x0 = Math.round((PLAY_W - totalW) / 2);
  const BASE_Y = PLAY_H - HH - 6;
  const RAISE = 16;
  const dimOthers = selectedKey != null && canPlay && !locked;
  const forbid = (c: number): boolean => rs.forbiddenDiscard.includes(kindOf(c));
  const mkTile = (c: number, key: string, x: number, disabled: boolean): LayoutNode => {
    const sel = selectedKey === key && !disabled;
    const kuikaeDim = canPlay && forbid(c);
    const op = kuikaeDim ? 0.4 : dimOthers && !sel ? 0.68 : 1;
    return {
      type: 'Button', id: `h-${key}`,
      props: { label: '', skin: faceUrl(c), kind: sel ? 'primary' : 'ghost', disabled, action: PLAY_TILE, actionArg: key },
      layout: { x, y: sel ? BASE_Y - RAISE : BASE_Y, width: HW, height: HH, opacity: op },
    };
  };
  const out: LayoutNode[] = hand.map((c, i) => mkTile(c, String(i), x0 + i * step, !canPlay || locked || forbid(c)));
  if (showDrawn) out.push(mkTile(rs.drawn!, 'd', x0 + n * step + drawnGap - 3, !canPlay));
  return out;
}

// ── 副露展示（吃/碰/杠·来源标签）· 玩家=出牌区左下·他家=头像下 ───────────────────────────────
const MELD_VERB: Record<string, string> = { chi: '吃', pon: '碰', minkan: '杠', ankan: '暗杠', kakan: '加杠' };
function meldBlock(m: MatchState, seat: number): LayoutNode | null {
  const melds = m.cur.melds[seat]!;
  if (melds.length === 0) return null;
  const w = seat === 0 ? 22 : 17, h = seat === 0 ? 30 : 23;
  const pos = seat === 0
    ? { x: FELT_X + 8, y: FELT_Y + FELT_H - 82 }
    : { x: OPP_POS[seat]!.x - 10, y: OPP_POS[seat]!.y + 90 };
  return {
    type: 'Panel', id: `melds-${seat}`, props: { bg: { custom: 'rgba(20,10,20,0.5)' } },
    layout: { x: pos.x, y: pos.y, direction: 'row', gap: 5, padding: 4, align: 'center' },
    children: melds.map((md, i): LayoutNode => ({
      type: 'Panel', id: `meld-${seat}-${i}`, props: { bare: true }, layout: { direction: 'column', gap: 1, align: 'center' },
      children: [
        {
          type: 'Panel', id: `meld-${seat}-${i}-t`, props: { bare: true }, layout: { direction: 'row', gap: 1, align: 'center' },
          children: md.tiles.map((c, j): LayoutNode => ({
            type: 'Image', id: `meld-${seat}-${i}-${j}`, props: { src: faceUrl(c), fit: 'contain' },
            layout: { width: w, height: h, opacity: c === md.called && md.from !== seat ? 0.72 : 1 },
          })),
        },
        { type: 'Label', id: `meld-${seat}-${i}-src`, props: { text: md.from !== seat ? `${MELD_VERB[md.kind]}◄${m.seatNames[md.from]}` : MELD_VERB[md.kind]!, size: 'xs', bold: true, color: 'gold' } },
      ],
    })),
  };
}

// ── 最小控制（右上角·日志 + 菜单·横排）───────────────────────────────────────────────────────
// 按钮宽必须容下 2 字+左右内边距（30px×2）否则字被挤竖排（owner 目击 bug）——定宽 100 保横排。
function controls(): LayoutNode {
  const W = 100, H = 36;
  return {
    type: 'Panel', id: 'controls', props: { bare: true },
    layout: { x: PANEL_X + PANEL_W - (W * 2 + 8), y: PANEL_Y + 4, direction: 'row', gap: 8, align: 'center' },
    children: [
      { type: 'Button', id: 'act-log', props: { label: '日志', kind: 'ghost', action: TOGGLE_LOG }, layout: { width: W, height: H } },
      { type: 'Button', id: 'act-menu', props: { label: '菜单', kind: 'ghost', action: MENU_OPEN }, layout: { width: W, height: H } },
    ],
  };
}

// ── 游戏内菜单浮层（菜单钮开·规则说明/声音/返回主菜单·语言开关下一版接 i18n）─────────────────────
function menuOverlay(soundOn: boolean): LayoutNode {
  const row = (id: string, label: string, action: string, hint: string, kind: 'primary' | 'ghost' | 'quiet' = 'ghost', disabled = false): LayoutNode => ({
    type: 'Panel', id: `gm-${id}-row`, props: { bare: true }, layout: { direction: 'row', gap: 10, align: 'center', width: 340 },
    children: [
      { type: 'Label', id: `gm-${id}-l`, props: { text: label, size: 'sm', bold: true, color: 'text' }, layout: { flex: 1 } },
      { type: 'Button', id: `gm-${id}`, props: { label: hint, kind, action, disabled }, layout: { width: 120, height: 38 } },
    ],
  });
  return {
    type: 'Modal', id: 'gmenu', props: { title: '菜单 · 雀宴', closable: true, closeAction: MENU_OPEN },
    children: [{
      type: 'Panel', id: 'gm-body', props: { bare: true }, layout: { direction: 'column', gap: 12, align: 'center', padding: 6 },
      children: [
        row('rules', '规则说明 · 番数', RULES_OPEN, '查看', 'primary'),
        row('sound', '声音', TOGGLE_SOUND, soundOn ? '🔊 开' : '🔇 关'),
        row('lang', '语言 / 言語', MENU_OPEN, '日本語 ▾'), // 占位·下一版接 i18n 日/中切换
        row('home', '返回主菜单', BACK_MENU, '返回', 'quiet'),
        { type: 'Label', id: 'gm-tip', props: { text: '语言（日/中）切换即将上线', size: 'xs', color: 'sub' } },
      ],
    }],
  };
}

// ── 规则说明浮层（全日式番数速览·菜单→规则说明·详见 docs yaku-guide）──────────────────────────────
const RULES_LINES: { t: string; b: boolean }[] = [
  { t: '雀宴 · 全日式立直麻将（東風戦一圈·四人）', b: true },
  { t: '基本：13 张起手·摸一打一凑 4 面子 + 1 雀头和了。门前清可立直（1000 点·翻宝牌里）。', b: false },
  { t: '役（常用）：立直 / 断幺九 / 平和 / 一盃口 / 役牌 = 1 番；三色 / 一気通貫 / 七対子 = 2 番（副露降 1）。', b: false },
  { t: '符：底 20 符 + 面子/雀头/待ち/自摸/门清荣加符；連風雀頭 = 4 符（天鳳準拠）。', b: false },
  { t: '点数：满贯 5 番 8000 · 跳满 6-7 番 12000 · 倍满 8-10 番 16000 · 三倍满 11-12 番 24000 · 役満 13 番+ 32000。', b: false },
  { t: '鸣牌：碰（任家）/ 吃（上家）/ 杠（明·暗·加）·杠后岭上摸 + 翻新宝牌·抢杠可荣。', b: false },
];
function rulesOverlay(): LayoutNode {
  return {
    type: 'Modal', id: 'grules', props: { title: '规则说明 · 番数速览', closable: true, closeAction: RULES_OPEN },
    children: [{
      type: 'Panel', id: 'gr-body', props: { bare: true }, layout: { direction: 'column', gap: 8, align: 'start', padding: 6, width: 460 },
      children: RULES_LINES.map((ln, i): LayoutNode => ({
        type: 'Label', id: `gr-${i}`, props: { text: ln.t, size: ln.b ? 'md' : 'sm', bold: ln.b, color: ln.b ? 'gold' : 'text' },
      })),
    }],
  };
}

// ── 行动键排（自摸/杠/立直·贴桌底左·acts 测试钉）───────────────────────────────────────────────
// 按钮定高 48 挤进 58px 控制带（梯形投影底 516 ↔ 手牌顶 574）·靠左贴边·不压桌不压手牌（owner 锚定要求）。
function actionBar(m: MatchState): LayoutNode {
  const BH = 48;
  return {
    type: 'Panel', id: 'acts', props: { bare: true },
    layout: { x: PANEL_X + 4, y: BAND_Y, direction: 'row', gap: 8, align: 'center' },
    children: [
      // 均用 primary（jade）：hero 大字 + overflow:hidden 会把「自摸」次字裁掉（组件特性）——primary 定宽 96 稳显两字。
      { type: 'Button', id: 'act-tsumo', props: { label: '自摸', kind: 'primary', disabled: !canTsumo(m), action: ACT_TSUMO }, layout: { width: 96, height: BH } },
      ...(canAnkan(m) || canKakan(m) ? [{ type: 'Button' as const, id: 'act-kan', props: { label: '杠', kind: 'primary' as const, action: ACT_KAN }, layout: { width: 66, height: BH } }] : []),
      { type: 'Button', id: 'act-riichi', props: { label: '立直', kind: 'primary', disabled: !canRiichi(m), action: ACT_RIICHI }, layout: { width: 96, height: BH } },
    ],
  };
}

// ── 鸣牌窗口按钮条（碰/吃/荣/过）────────────────────────────────────────────────────────────
function chiLabel(c: ChiCandidate, tile: number): string {
  const kinds = [c.consume[0], c.consume[1], kindOf(tile)].sort((a, b) => a - b);
  const nums = kinds.map((k) => (k % 9) + 1).join('');
  const suit = ['萬', '筒', '索'][Math.floor(kinds[0]! / 9)];
  return `${nums}${suit}`;
}
function callBar(m: MatchState): LayoutNode | null {
  const cw = m.cur.callWindow;
  if (!cw) return null;
  const o = cw.options;
  const btns: LayoutNode[] = [
    { type: 'Label', id: 'call-hint', props: { text: `${m.seatNames[cw.discarder]} 打【${labelTile(cw.tile)}】`, size: 'sm', bold: true, color: 'gold' } },
  ];
  if (o.ron) btns.push({ type: 'Button', id: 'call-ron', props: { label: cw.robKakan ? '🀄 抢杠' : '🀄 荣和', kind: 'primary', action: CALL_RON } });
  if (o.pon) btns.push({ type: 'Button', id: 'call-pon', props: { label: '碰', kind: 'primary', action: CALL_PON } });
  if (o.minkan) btns.push({ type: 'Button', id: 'call-kan', props: { label: '杠', kind: 'primary', action: CALL_KAN } });
  o.chi.forEach((c, i) => btns.push({ type: 'Button', id: `call-chi-${i}`, props: { label: `吃 ${chiLabel(c, cw.tile)}`, kind: 'primary', action: CALL_CHI, actionArg: String(i) } }));
  btns.push({ type: 'Button', id: 'call-pass', props: { label: '过', kind: 'quiet', action: CALL_PASS } });
  return {
    type: 'Panel', id: 'callbar', props: { bg: { custom: 'rgba(32,16,28,0.97)' }, glow: true, accent: true },
    // 居中贴桌底控制带（鸣牌窗口态·与手牌不叠·按钮压扁到 40 高）。
    layout: { x: PANEL_X + PANEL_W / 2 - 220, y: BAND_Y, width: 440, padding: 6, gap: 8, direction: 'row', justify: 'center', align: 'center' },
    children: btns.map((b): LayoutNode => (b.type === 'Button' ? { ...b, layout: { ...(b.layout ?? {}), height: 40 } } : b)),
  };
}

// ── 回合流向指示（谁在打·中央指向条·左下角·不占中央要位）─────────────────────────────────────
const DIR_ARROW = ['▼', '▶', '▲', '◀'];
function turnBanner(m: MatchState): LayoutNode | null {
  const rs = m.cur;
  if (rs.phase !== 'playing') return null;
  const t = rs.turn;
  const waiting = rs.callWindow !== null;
  const hot = waiting || t === 0;
  const head = waiting ? '⚡ 轮到你 · 鸣牌' : t === 0 ? '▶ 轮到你 · 出牌' : `${DIR_ARROW[t]} ${m.seatNames[t]} 出牌中`;
  const lastDisc = [...m.log.all()].reverse().find((e) => e.kind === 'discard' && e.tile != null);
  const flow = lastDisc ? `刚打：${lastDisc.actor} 打【${labelTile(lastDisc.tile!)}】` : '开局';
  return {
    type: 'Panel', id: 'turnbanner', props: { bg: { custom: hot ? 'rgba(52,22,36,0.95)' : 'rgba(26,15,24,0.9)' }, glow: hot, accent: hot },
    // 贴桌底右（与左下角行动键分居两侧·中间留给手牌）·同在 58px 控制带内不压桌不压手牌。
    layout: { x: PANEL_X + PANEL_W - 212, y: BAND_Y, width: 206, padding: 6, gap: 1, direction: 'column', align: 'start' },
    children: [
      { type: 'Label', id: 'tb-head', props: { text: head, size: 'sm', bold: true, color: hot ? 'gold' : 'jade' } },
      { type: 'Label', id: 'tb-flow', props: { text: flow, size: 'xs', color: 'sub' } },
    ],
  };
}

// ── 日志面板（覆盖对局盘·可关·种子可复现）────────────────────────────────────────────────────
function logPanel(m: MatchState, logCopied: boolean): LayoutNode {
  const evs = m.log.recent(22);
  return {
    type: 'Panel', id: 'logpanel', props: { bg: { custom: 'rgba(18,12,20,0.98)' }, title: `游戏日志 · 跨局累计 · 种子 ${m.rng.seed}` },
    layout: { x: PANEL_X + 6, y: PANEL_Y + 6, width: PANEL_W - 12, height: PANEL_H - 12, padding: 10, gap: 3, direction: 'column' },
    children: [
      {
        type: 'Panel', id: 'log-hdr', props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' },
        children: [
          { type: 'Button', id: 'log-close', props: { label: '✕ 关闭', kind: 'quiet', action: TOGGLE_LOG }, layout: { flex: 0 } },
          { type: 'Button', id: 'log-copy', props: { label: logCopied ? '✓ 已复制 —— 粘贴给我' : `📋 复制完整日志（${m.log.size()} 条）`, kind: logCopied ? 'quiet' : 'primary', action: COPY_LOG }, layout: { flex: 1 } },
        ],
      },
      ...evs.map((e, i): LayoutNode => ({
        type: 'Label', id: `log-${i}`,
        props: { text: `[${e.round}] ${e.actor}·${e.text}`, size: 'xs', color: e.kind === 'tsumo' || e.kind === 'ron' ? 'gold' : e.kind === 'score' ? 'danger' : e.kind === 'draw' || e.kind === 'discard' ? 'sub' : 'jade' },
      })),
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  结算浮层（暗手/副露分开·役种逐行·一眼看出为什么赢）
// ══════════════════════════════════════════════════════════════════════════════════════════
type RoundResultView = NonNullable<MatchState['cur']['result']>;
function resultHand(m: MatchState, r: RoundResultView): LayoutNode {
  const CW = 28, CH = 38;
  const concealed = (r.handSnapshot ?? []);
  let winMarked = false;
  const concealedRow: LayoutNode = {
    type: 'Panel', id: 'res-cc', props: { bare: true }, layout: { direction: 'row', gap: 2, align: 'end' },
    children: concealed.map((c, i): LayoutNode => {
      const isWin = !winMarked && c === r.winTile;
      if (isWin) winMarked = true;
      return { type: 'Image', id: `res-h-${i}`, props: { src: faceUrl(c), fit: 'contain' }, layout: { width: CW, height: isWin ? CH + 8 : CH } };
    }),
  };
  const melds = r.meldsSnapshot ?? [];
  const meldClusters: LayoutNode[] = melds.map((md, i): LayoutNode => ({
    type: 'Panel', id: `res-md-${i}`, props: { bg: { custom: 'rgba(44,22,34,0.6)' } }, layout: { direction: 'column', gap: 1, padding: 3, align: 'center' },
    children: [
      { type: 'Panel', id: `res-md-${i}-t`, props: { bare: true }, layout: { direction: 'row', gap: 1, align: 'center' },
        children: md.tiles.map((c, j): LayoutNode => ({ type: 'Image', id: `res-md-${i}-${j}`, props: { src: faceUrl(c), fit: 'contain' }, layout: { width: 24, height: 32 } })) },
      { type: 'Label', id: `res-md-${i}-s`, props: { text: md.from !== r.winner ? `${MELD_VERB[md.kind]}◄${m.seatNames[md.from]}` : MELD_VERB[md.kind]!, size: 'xs', bold: true, color: 'gold' } },
    ],
  }));
  const cols: LayoutNode[] = [{
    type: 'Panel', id: 'res-hand-c', props: { bare: true }, layout: { direction: 'column', gap: 2, align: 'center' },
    children: [{ type: 'Label', id: 'res-hand-cl', props: { text: '暗手', size: 'xs', color: 'sub' } }, concealedRow],
  }];
  if (melds.length) cols.push({
    type: 'Panel', id: 'res-hand-m', props: { bare: true }, layout: { direction: 'column', gap: 2, align: 'center' },
    children: [
      { type: 'Label', id: 'res-hand-ml', props: { text: '副露（吃/碰/杠·来源）', size: 'xs', color: 'sub' } },
      { type: 'Panel', id: 'res-mds', props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'end' }, children: meldClusters },
    ],
  });
  return { type: 'Panel', id: 'res-hand', props: { bare: true }, layout: { direction: 'row', gap: 14, align: 'end', justify: 'center' }, children: cols };
}
function yakuTable(r: RoundResultView): LayoutNode {
  const rows: LayoutNode[] = (r.yakuList ?? []).map((y, i): LayoutNode => ({
    type: 'Panel', id: `res-yk-${i}`, props: { bare: true }, layout: { direction: 'row', gap: 10, align: 'center', width: 250 },
    children: [
      { type: 'Label', id: `res-yk-${i}-n`, props: { text: y.name, size: 'sm', bold: true, color: 'jade' }, layout: { flex: 1 } },
      { type: 'Label', id: `res-yk-${i}-h`, props: { text: y.han > 0 ? `${y.han} 番` : '役満', size: 'sm', bold: true, color: 'gold' } },
    ],
  }));
  const totalTxt = r.yakuman && r.yakuman > 0 ? `${r.yakuman > 1 ? r.yakuman + ' 倍' : ''}役満` : `${r.han} 翻 ${r.fu} 符`;
  rows.push({
    type: 'Panel', id: 'res-yk-total', props: { bg: { custom: 'rgba(64,30,46,0.85)' } }, layout: { direction: 'row', gap: 10, align: 'center', width: 250, padding: 5 },
    children: [
      { type: 'Label', id: 'res-yk-total-l', props: { text: '合计', size: 'sm', bold: true, color: 'gold' }, layout: { flex: 1 } },
      { type: 'Label', id: 'res-yk-total-r', props: { text: `${totalTxt} · ${r.scoreLabel}`, size: 'md', bold: true, color: 'gold', font: 'serif' } },
    ],
  });
  return { type: 'Panel', id: 'res-yaku', props: { bg: { custom: 'rgba(18,10,18,0.5)' } }, layout: { direction: 'column', gap: 2, align: 'center', padding: 6 }, children: rows };
}
function resultOverlay(m: MatchState): LayoutNode {
  const r = m.cur.result!;
  const isWin = r.type !== 'draw';
  const title = r.type === 'draw' ? '荒牌流局' : (r.type === 'tsumo' ? `${m.seatNames[r.winner!]} 自摸和了` : `${m.seatNames[r.winner!]} 荣和`);
  const rows: LayoutNode[] = [
    { type: 'Label', id: 'res-t', props: { text: title, size: 'xl', bold: true, color: 'gold', font: 'serif' } },
  ];
  if (isWin && r.handSnapshot) {
    rows.push(resultHand(m, r));
    rows.push({ type: 'Label', id: 'res-w', props: { text: `和了牌 ${labelTile(r.winTile!)}${r.loser !== null ? `（放铳 ${m.seatNames[r.loser]}）` : '（自摸）'}`, size: 'sm', color: 'sub' } });
    if (r.yakuList && r.yakuList.length) rows.push(yakuTable(r));
    else if (r.scoreLabel) rows.push({ type: 'Label', id: 'res-score', props: { text: r.scoreLabel, size: 'lg', bold: true, color: 'gold', font: 'serif' } });
  }
  const stripSum = (r.stripped ?? []).map((n, i) => (n > 0 ? `${m.seatNames[i]} 脱${n}（余 ${m.clothing[i]}/${STRIP_ITEMS}）` : null)).filter(Boolean);
  if (stripSum.length) rows.push({ type: 'Label', id: 'res-strip', props: { text: `直击脱衣 · ${stripSum.join('　')}`, size: 'sm', color: 'danger' } });
  rows.push({
    type: 'Panel', id: 'res-delta', props: { bare: true }, layout: { direction: 'column', gap: 2 },
    children: r.delta.map((d, i): LayoutNode => ({ type: 'Label', id: `res-d-${i}`, props: { text: `${m.seatNames[i]}　${d >= 0 ? '+' : ''}${d}　→ ${m.scores[i]!.toLocaleString('en-US')}`, size: 'sm', color: d > 0 ? 'ok' : d < 0 ? 'danger' : 'sub' } })),
  });
  rows.push({ type: 'Button', id: 'res-next', props: { label: m.over ? '返回主菜单' : '下一局 ▸', kind: 'hero', action: m.over ? BACK_MENU : NEXT_ROUND } });
  return {
    type: 'Modal', id: 'result', props: { title: m.over ? '终局' : '本局结算', closable: false },
    children: [{ type: 'Panel', id: 'res-body', props: { bare: true }, layout: { direction: 'column', gap: 9, align: 'center', padding: 6 }, children: rows }],
  };
}

export interface PlayHudOpts { logOpen: boolean; selectedKey?: string | null; logCopied?: boolean; menuOpen?: boolean; rulesOpen?: boolean; soundOn?: boolean }

export function buildPlayHud(m: MatchState, opts: PlayHudOpts): LayoutNode {
  const sel = opts.selectedKey ?? null;
  const children: LayoutNode[] = [
    // 底层对局盘（暗底）。
    { type: 'Panel', id: 'playpanel', props: { bg: { custom: 'rgba(14,26,26,0.5)' } }, layout: { x: PANEL_X, y: PANEL_Y, width: PANEL_W, height: PANEL_H } },
    // 出牌区透视梯形（含四家牌河弃牌·梯形子共享透视）+ 桌上头像框（seat 1/2/3）+ 玩家座条（seat 0）。
    ...playField(m),
    ...[1, 2, 3].map((s) => tableAvatar(m, s)),
    playerBar(m),
    ...[0, 1, 2, 3].map((s) => meldBlock(m, s)).filter((n): n is LayoutNode => n !== null),
    ...playerHand(m, sel),
    controls(),
  ];
  const tb = turnBanner(m);
  if (tb) children.push(tb);
  if (opts.logOpen && !isPlayerCallWindow(m)) children.push(logPanel(m, opts.logCopied ?? false));
  children.push(actionBar(m));
  const cb = callBar(m);
  if (cb) children.push(cb);
  if (isWinLikeEnd(m)) children.push(resultOverlay(m));
  // 用户浮层（菜单/规则说明·互斥·菜单钮开·盖最上层）。
  if (opts.rulesOpen) children.push(rulesOverlay());
  else if (opts.menuOpen) children.push(menuOverlay(opts.soundOn ?? true));
  return { type: 'Panel', id: 'play-root', props: { bare: true }, layout: { x: 0, y: 0, width: PLAY_W, height: PLAY_H }, children };
}
