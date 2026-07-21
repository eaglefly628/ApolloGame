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
const RW = 20, RH = 27;   // 牌河（出牌区 2D 弃牌）
const DW = 22, DH = 30;   // 宝牌

// ── 布局区块常量（精简牌桌·920×640·牌桌居中）────────────────────────────────────────────
const PANEL_X = 8, PANEL_W = PLAY_W - 16, PANEL_Y = 6, PANEL_H = PLAY_H - 12; // 对局盘=整画布
const FELT = 'linear-gradient(168deg,#1e6a5b 0%,#175349 52%,#123c3a 100%)';
// 出牌区透视梯形（居中·rotateX 透视）·**尽量放大让玩家视野更大**（owner 2026-07-21）。
const FELT_W = 728, FELT_H = 448, FELT_X = Math.round((PLAY_W - FELT_W) / 2), FELT_Y = 44;
// 对家屏幕位（座 1=東/左·2=北/上·3=西/右）——贴牌桌左右/上三边。
const OPP_POS: Record<number, { x: number; y: number }> = {
  1: { x: 40, y: 214 },     // 東 左（名条 128 居中溢出·两侧不切边）
  2: { x: 356, y: 4 },      // 北 上中（横排）
  3: { x: 808, y: 214 },    // 西 右（名条 128 居中溢出·两侧不切边）
};

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
    children: [{ type: 'Image', id: `seat-${seat}-p`, props: { src: OPP_TACHIE[seat]!, fit: 'cover' }, layout: { width: 66, height: 66, radius: 8 } }],
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

// 玩家座条（南·felt 底）= seat-0（精简·点数不放大）。
function playerBar(m: MatchState): LayoutNode {
  const active = m.cur.turn === 0 && m.cur.phase === 'playing';
  const wind = WIND[seatWind(0, m.dealer)]!;
  return {
    type: 'Panel', id: 'seat-0', props: { bg: { custom: 'rgba(20,12,26,0.9)' }, accent: active, glow: active },
    layout: { x: FELT_X + FELT_W / 2 - 130, y: FELT_Y + FELT_H - 24, width: 260, height: 30, direction: 'row', gap: 8, align: 'center', padding: 6 },
    children: [
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
const RIVER_POS: Record<number, { x: number; y: number }> = {
  0: { x: FELT_X + FELT_W / 2 - 62, y: FELT_Y + FELT_H - 100 }, // 南 下
  1: { x: FELT_X + 26, y: FELT_Y + 142 },                       // 東 左
  2: { x: FELT_X + FELT_W / 2 - 62, y: FELT_Y + 42 },           // 北 上
  3: { x: FELT_X + FELT_W - 148, y: FELT_Y + 142 },             // 西 右
};
function riverBlock(m: MatchState, seat: number): LayoutNode | null {
  const river = m.cur.rivers[seat]!;
  if (!river.length) return null;
  const show = river.slice(-18);
  const p = RIVER_POS[seat]!;
  const rows: LayoutNode[] = [];
  for (let r = 0; r < Math.ceil(show.length / 6); r++) {
    const slice = show.slice(r * 6, r * 6 + 6);
    rows.push({
      type: 'Panel', id: `river-${seat}-row${r}`, props: { bare: true }, layout: { direction: 'row', gap: 2 },
      children: slice.map((c, i): LayoutNode => ({ type: 'Image', id: `river-${seat}-${r * 6 + i}`, props: { src: faceUrl(c), fit: 'contain' }, layout: { width: RW, height: RH } })),
    });
  }
  return { type: 'Panel', id: `river-${seat}`, props: { bg: { custom: 'rgba(8,20,18,0.35)' } }, layout: { x: p.x, y: p.y, direction: 'column', gap: 2, padding: 3 }, children: rows };
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
  const trapezoid: LayoutNode = {
    type: 'Panel', id: 'felt', props: { bg: { custom: FELT }, dashed: true, edge: 'gold' },
    layout: { x: FELT_X, y: FELT_Y, width: CW, height: CH, rotateX: 34, perspective: 1000, radius: 14 },
    children: [
      { type: 'Panel', id: 'felt-wall', props: { bg: 'transparent', dashed: true, edge: 'jade' }, layout: { x: 24, y: 18, width: CW - 48, height: CH - 36, radius: 12 } }, // 牌山（外圈两层）
      zone('felt-dead', CW / 2 - 62, CH / 2 - 38, 124, 76, '报牌区', 'gold'),                 // 报牌区（正当中）
      zone('river-z-0', CW / 2 - 98, CH - 112, 196, 52, '你 · 河', 'jade'),                   // 南 下（自家）
      zone('river-z-2', CW / 2 - 94, 58, 188, 48, '对家 · 河', 'jade'),                        // 北 上
      zone('river-z-1', 70, CH / 2 - 50, 52, 100, '河', 'jade'),                               // 左
      zone('river-z-3', CW - 122, CH / 2 - 50, 52, 100, '河', 'jade'),                         // 右
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

// ── 最小控制（右上角·📜日志 + ☰返回菜单·owner「只留菜单/返回/日志」）───────────────────────────
function controls(): LayoutNode {
  return {
    type: 'Panel', id: 'controls', props: { bare: true },
    layout: { x: PANEL_X + PANEL_W - 184, y: PANEL_Y + 4, direction: 'row', gap: 8, align: 'center' },
    children: [
      { type: 'Button', id: 'act-log', props: { label: '日志', kind: 'ghost', action: TOGGLE_LOG }, layout: { width: 72, height: 34 } },
      { type: 'Button', id: 'act-menu', props: { label: '返回', kind: 'ghost', action: BACK_MENU }, layout: { width: 72, height: 34 } },
    ],
  };
}

// ── 行动键排（自摸/杠/立直·居中底部·acts 测试钉）────────────────────────────────────────────
function actionBar(m: MatchState): LayoutNode {
  return {
    type: 'Panel', id: 'acts', props: { bare: true },
    layout: { x: PANEL_X + PANEL_W / 2 - 90, y: FELT_Y + FELT_H + 20, direction: 'row', gap: 8, align: 'center' },
    children: [
      { type: 'Button', id: 'act-tsumo', props: { label: '自摸', kind: 'hero', disabled: !canTsumo(m), action: ACT_TSUMO } },
      ...(canAnkan(m) || canKakan(m) ? [{ type: 'Button' as const, id: 'act-kan', props: { label: '杠', kind: 'primary' as const, action: ACT_KAN } }] : []),
      { type: 'Button', id: 'act-riichi', props: { label: '立直', kind: 'primary', disabled: !canRiichi(m), action: ACT_RIICHI } },
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
    layout: { x: PANEL_X + PANEL_W / 2 - 220, y: FELT_Y + FELT_H + 14, width: 440, padding: 8, gap: 8, direction: 'row', justify: 'center', align: 'center' },
    children: btns,
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
    layout: { x: PANEL_X + 6, y: FELT_Y + FELT_H + 18, width: 206, padding: 6, gap: 1, direction: 'column', align: 'start' },
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

export interface PlayHudOpts { logOpen: boolean; selectedKey?: string | null; logCopied?: boolean }

export function buildPlayHud(m: MatchState, opts: PlayHudOpts): LayoutNode {
  const sel = opts.selectedKey ?? null;
  const children: LayoutNode[] = [
    // 底层对局盘（暗底）。
    { type: 'Panel', id: 'playpanel', props: { bg: { custom: 'rgba(14,26,26,0.5)' } }, layout: { x: PANEL_X, y: PANEL_Y, width: PANEL_W, height: PANEL_H } },
    // 出牌区透视梯形 + 牌河（2D）+ 桌上头像框（seat 1/2/3）+ 玩家座条（seat 0）。
    ...playField(m),
    ...[0, 1, 2, 3].map((s) => riverBlock(m, s)).filter((n): n is LayoutNode => n !== null),
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
  return { type: 'Panel', id: 'play-root', props: { bare: true }, layout: { x: 0, y: 0, width: PLAY_W, height: PLAY_H }, children };
}
