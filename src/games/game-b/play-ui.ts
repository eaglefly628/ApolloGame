// Game B ·《雀宴》—— 对局屏 SC-play v2（LayoutNode·从 MatchState 投影·owner 2026-07-20 新布局稿 506ef9d6 1:1）。
// 画布 1280×720（PLAY_W×PLAY_H·mountHost 整块等比缩放·不乱位）。皮=NIGHT 暗紫。全 LayoutNode 闭集·写世界只走 action 信号。
// 布局（照稿）：顶币栏 + 左侧栏 + 三姨太角色卡列（立绘/好感/心情/情绪钮）+ 右侧对局盘（顶开关 + 桌上三头像框
//   東/北/西 贴立绘 + 出牌区绿呢梯形【2D 牌河先行·3D 后做】+ 中央场况 + 玩家座条 + 底部大牌手排[动态] + 吃碰区 + 聊天）。
import type { LayoutNode } from '@ui/components/index.js';
import type { MatchState } from './core/game-state.js';
import { canTsumo, canRiichi, canAnkan, canKakan, labelTile, seatWind, isWinLikeEnd, isPlayerTurn, isPlayerCallWindow, CLOTH_LABELS, STRIP_ITEMS } from './core/game-state.js';
import { kindStr, isRed, kindOf } from './core/tiles-def.js';
import type { Meld } from './core/meld.js';
import type { ChiCandidate } from './core/calls.js';
import { doraFromIndicator } from './core/wall.js';
import { PLAY_W, PLAY_H } from './theme.js';

export const PLAY_TILE = 'play-tile'; // arg=手牌位 key（'0'..'12' 暗手位 / 'd' 摸牌）·两步：先选中再打出
export const ACT_TSUMO = 'act-tsumo';
export const ACT_RIICHI = 'act-riichi';
export const ACT_KAN = 'act-kan'; // 自家回合暗杠/加杠（P3b·自动取首个可杠）
export const NEXT_ROUND = 'next-round';
export const TOGGLE_LOG = 'toggle-log';
export const BACK_MENU = 'back-menu';
export const COPY_LOG = 'copy-log'; // 复制完整日志到剪贴板（查 bug·贴给 owner）
// 鸣牌窗口按钮（P4·owner「先上鸣牌」·玩家可碰/吃/荣/过）。
export const CALL_PON = 'call-pon';
export const CALL_CHI = 'call-chi'; // arg=搭子候选 index
export const CALL_KAN = 'call-kan'; // 大明杠（他家弃牌）
export const CALL_RON = 'call-ron';
export const CALL_PASS = 'call-pass';

// ── 牌面占位贴图（B-007 FluffyStuff CC0·600×800 象牙牌·赤5 带 -red）─────────────────────
const ART = '/games/game-b/art/mahjong';
/** 牌码 → 牌面 PNG URL（view 层解析·sim 只持整数牌码·纯度不破）。 */
function faceUrl(code: number): string {
  const base = isRed(code) ? `${kindStr(code)}-red` : kindStr(code);
  return `${ART}/${base}.png`;
}

// ── 立绘资产（owner 2026-07-20 交·临时带背景·art/tachie/·座↔立绘映射照稿）──────────────────
const TACHIE = '/games/game-b/art/tachie';
// 对家座 1/2/3 → 立绘 URL（座 1=東/左=大姨太优子·2=北/上=二姨太怜奈·3=西/右=三姨太绫香）。
const OPP_TACHIE: Record<number, string> = { 1: `${TACHIE}/tachie-daiyi.png`, 2: `${TACHIE}/tachie-eryi.png`, 3: `${TACHIE}/tachie-sanyi.png` };
// 角色卡「姨太」称谓（照稿·静态·真名走 m.seatNames）+ 心情台词（占位·待接好感系统）。
const OPP_TITLE: Record<number, string> = { 1: '大姨太', 2: '二姨太', 3: '三姨太' };
const OPP_MOOD: Record<number, string> = { 1: '不动声色', 2: '正在算你的牌', 3: '等着看你出丑' };

const WIND = ['東', '南', '西', '北'];
// 牌尺寸（px）。
const HW = 46, HH = 62;   // 自家手牌（底部大排）
const RW = 22, RH = 30;   // 牌河（出牌区 2D 弃牌）
const DW = 24, DH = 32;   // 宝牌

// ── 布局区块常量（照稿 1280×720 DOM 量测·1:1 锚点·owner「左缩右放·比例对齐」）────────────────
const HEADER_H = 72;
const RAIL_W = 90;                  // 左导航栏（窄·x8-90）
const CARD_X = 98, CARD_W = 280, CARD_H = 190; // 角色卡（照稿缩小·主诉「左边太大」→ 280×190·非 436）
const CARD_Y = [76, 278, 480];      // 三卡 y（pitch 202·量测）
const PORT_W = 80, PORT_H = 102;    // 立绘缩略图（照稿 80×102·非满高·主诉「立绘比例不对」）
const PANEL_X = 392, PANEL_W = 866, PANEL_Y = 76, PANEL_H = 626; // 对局盘（照稿放大·x392-1258 y76-702）
const FELT = 'linear-gradient(168deg,#1e6a5b 0%,#175349 52%,#123c3a 100%)'; // 出牌区绿呢
// 出牌区透视梯形（照稿量测·outer x525 y157 w601 h431·rotateX 透视→上窄下宽梯形·owner「很重要·与右侧一致」）。
const FELT_X = 525, FELT_Y = 132, FELT_W = 601, FELT_H = 404;

// ══════════════════════════════════════════════════════════════════════════════════════════
//  顶栏（logo + 币三档 + 邮件/语言/头像）· 静态到稿（币/邮件/语言=占位·待接系统）
// ══════════════════════════════════════════════════════════════════════════════════════════
function iconBtn(id: string, label: string, action: string): LayoutNode {
  return { type: 'Button', id, props: { label, kind: 'ghost', action }, layout: { width: 40, height: 40 } };
}
function coinPill(id: string, icon: string, val: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: { custom: 'rgba(38,22,44,0.85)' } },
    layout: { direction: 'row', gap: 7, align: 'center', padding: 6, height: 34 },
    children: [
      { type: 'Label', id: `${id}-i`, props: { text: icon, size: 'md' } },
      { type: 'Label', id: `${id}-v`, props: { text: val, size: 'md', bold: true, color: 'gold' } },
      { type: 'Label', id: `${id}-p`, props: { text: '＋', size: 'sm', color: 'jade' } },
    ],
  };
}
function topBar(): LayoutNode {
  return {
    type: 'Panel', id: 'topbar', props: { bg: { custom: 'rgba(18,10,22,0.72)' } },
    layout: { x: 0, y: 0, width: PLAY_W, height: HEADER_H, direction: 'row', align: 'center', justify: 'between', padding: 16 },
    children: [
      {
        type: 'Panel', id: 'tb-left', props: { bare: true }, layout: { direction: 'row', gap: 12, align: 'center' },
        children: [
          { type: 'Label', id: 'tb-logo', props: { text: '雀宴', size: 30, bold: true, glow: true, font: 'serif', color: 'jade' } },
          iconBtn('tb-home', '⌂', BACK_MENU), iconBtn('tb-list', '☰', TOGGLE_LOG), iconBtn('tb-set', '⚙', BACK_MENU),
        ],
      },
      {
        type: 'Panel', id: 'tb-right', props: { bare: true }, layout: { direction: 'row', gap: 10, align: 'center' },
        children: [
          coinPill('tb-c1', '🌸', '2,850'), coinPill('tb-c2', '◈', '120'), coinPill('tb-c3', '🪙', '6,688'),
          iconBtn('tb-mail', '✉', BACK_MENU), iconBtn('tb-lang', '🌐', BACK_MENU),
          { type: 'Avatar', id: 'tb-me', props: { name: '主', size: 40, shape: 'circle' } },
        ],
      },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  左导航栏（主角像 + 图标）· 静态到稿
// ══════════════════════════════════════════════════════════════════════════════════════════
function sideBar(): LayoutNode {
  const nav = (id: string, ic: string): LayoutNode => ({ type: 'Button', id, props: { label: ic, kind: 'ghost', action: BACK_MENU }, layout: { width: 48, height: 48 } });
  return {
    type: 'Panel', id: 'siderail', props: { bare: true },
    layout: { x: 8, y: HEADER_H + 16, width: RAIL_W - 16, direction: 'column', gap: 16, align: 'center' },
    children: [
      { type: 'Avatar', id: 'rail-me', props: { name: '主', size: 58, shape: 'circle' } },
      nav('rail-n1', '👥'), nav('rail-n2', '🎒'), nav('rail-n3', '🪭'), nav('rail-n4', '🌸'),
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  三姨太角色卡（立绘 + 好感条 + 心情台词 + 情绪三钮）· 好感接 clothing·情绪钮静态
// ══════════════════════════════════════════════════════════════════════════════════════════
function charCard(m: MatchState, seat: number, idx: number): LayoutNode {
  const favor = Math.round((m.clothing[seat]! / STRIP_ITEMS) * 100); // 好感≈剩余衣物比例（占位映射·待真好感系统）
  const active = m.cur.turn === seat && m.cur.phase === 'playing';
  const emoji = (id: string, e: string, on: boolean): LayoutNode => ({ type: 'Button', id, props: { label: e, kind: on ? 'primary' : 'ghost', action: BACK_MENU }, layout: { width: 32, height: 32 } });
  return {
    type: 'Panel', id: `char-${seat}`, props: { bg: { custom: 'rgba(32,18,38,0.78)' }, accent: active, glow: active },
    layout: { x: CARD_X, y: CARD_Y[idx], width: CARD_W, height: CARD_H, direction: 'row', gap: 10, padding: 10, align: 'start' },
    children: [
      { type: 'Image', id: `char-${seat}-p`, props: { src: OPP_TACHIE[seat]!, fit: 'cover' }, layout: { width: PORT_W, height: PORT_H, radius: 8 } },
      {
        type: 'Panel', id: `char-${seat}-info`, props: { bare: true }, layout: { direction: 'column', gap: 5, flex: 1 },
        children: [
          { type: 'Label', id: `char-${seat}-nm`, props: { text: OPP_TITLE[seat]!, size: 'md', bold: true, font: 'serif', color: 'text' } },
          {
            type: 'Panel', id: `char-${seat}-fv`, props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' },
            children: [
              { type: 'Label', id: `char-${seat}-fl`, props: { text: '好感', size: 'xs', color: 'sub' } },
              { type: 'Label', id: `char-${seat}-fn`, props: { text: String(favor), size: 'sm', bold: true, color: 'jade' } },
            ],
          },
          { type: 'ProgressBar', id: `char-${seat}-bar`, props: { value: favor, max: 100, tone: 'accent' }, layout: { width: CARD_W - PORT_W - 40 } },
          { type: 'Label', id: `char-${seat}-mood`, props: { text: OPP_MOOD[seat]!, size: 'xs', color: active ? 'jade' : 'dim' } },
          {
            type: 'Panel', id: `char-${seat}-em`, props: { bare: true }, layout: { direction: 'row', gap: 6 },
            children: [emoji(`char-${seat}-e0`, '☺', idx === 0), emoji(`char-${seat}-e1`, '⊙', idx === 1), emoji(`char-${seat}-e2`, '☹', false)],
          },
        ],
      },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  桌上头像框（東/北/西·贴立绘 + 风位徽 + 名 + 点）= seat-1/2/3（测试钉 seat-* 齐 4）
// ══════════════════════════════════════════════════════════════════════════════════════════
// 对家屏幕位（座 1=東/左·2=北/上·3=西/右）——照稿 DOM 量测（立绘 76×76·围梯形三边）。
const OPP_POS: Record<number, { x: number; y: number }> = {
  1: { x: 420, y: 262 },   // 東 左（量测 424,266）
  2: { x: 784, y: 54 },    // 北 上中（靠上边·owner 微调·量测 788,87）
  3: { x: 1148, y: 262 },  // 西 右（量测 1152,266）
};
function tableAvatar(m: MatchState, seat: number): LayoutNode {
  const p = OPP_POS[seat]!;
  const active = m.cur.turn === seat && m.cur.phase === 'playing';
  const wind = WIND[seatWind(seat, m.dealer)]!;
  return {
    type: 'Panel', id: `seat-${seat}`, props: { bare: true },
    layout: { x: p.x, y: p.y, width: 76, direction: 'column', gap: 3, align: 'center' },
    children: [
      {
        type: 'Panel', id: `seat-${seat}-fr`, props: { bg: { custom: 'rgba(24,14,28,0.6)' }, accent: active, glow: active },
        layout: { width: 76, height: 76, padding: 3 },
        children: [{ type: 'Image', id: `seat-${seat}-p`, props: { src: OPP_TACHIE[seat]!, fit: 'cover' }, layout: { width: 70, height: 70, radius: 8 } }],
      },
      {
        type: 'Panel', id: `seat-${seat}-nm`, props: { bg: { custom: 'rgba(16,10,20,0.85)' } },
        layout: { direction: 'row', gap: 5, align: 'center', padding: 4 },
        children: [
          { type: 'Tag', id: `seat-${seat}-w`, props: { label: wind, tone: active ? 'accent' : 'normal', size: 'sm' } },
          { type: 'Label', id: `seat-${seat}-n`, props: { text: m.seatNames[seat]!, size: 'sm', bold: true, color: 'text' } },
          { type: 'Label', id: `seat-${seat}-s`, props: { text: m.scores[seat]!.toLocaleString('en-US'), size: 'sm', bold: true, color: 'gold' } },
        ],
      },
      ...(active ? [{ type: 'Tag' as const, id: `seat-${seat}-t`, props: { label: '打牌中', tone: 'accent' as const, size: 'sm' as const } }] : []),
      ...(m.cur.riichi[seat] ? [{ type: 'Tag' as const, id: `seat-${seat}-r`, props: { label: '● 立直', tone: 'accent' as const, size: 'sm' as const } }] : []),
    ],
  };
}

// 玩家座条（南·底部）= seat-0。
function playerBar(m: MatchState): LayoutNode {
  const active = m.cur.turn === 0 && m.cur.phase === 'playing';
  const wind = WIND[seatWind(0, m.dealer)]!;
  return {
    type: 'Panel', id: 'seat-0', props: { bg: { custom: 'rgba(20,12,26,0.9)' }, accent: active, glow: active },
    layout: { x: PANEL_X + PANEL_W / 2 - 138, y: FELT_Y + FELT_H - 26, width: 276, height: 30, direction: 'row', gap: 8, align: 'center', padding: 6 },
    children: [
      { type: 'Tag', id: 'seat-0-w', props: { label: wind, tone: 'accent', size: 'sm' } },
      { type: 'Label', id: 'seat-0-n', props: { text: m.seatNames[0]!, size: 'sm', bold: true, color: 'text' }, layout: { flex: 1 } },
      ...(m.cur.riichi[0] ? [{ type: 'Tag' as const, id: 'seat-0-r', props: { label: '● 立直', tone: 'accent' as const, size: 'sm' as const } }] : []),
      { type: 'Label', id: 'seat-0-s', props: { text: m.scores[0]!.toLocaleString('en-US'), size: 'sm', bold: true, color: 'gold' } },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  出牌区（绿呢梯形盘·2D 牌河先行·中央场况）· 3D 留下一波
// ══════════════════════════════════════════════════════════════════════════════════════════
// 各家牌河在盘内的位（座 0 下·1 左·2 上·3 右）。
const RIVER_POS: Record<number, { x: number; y: number }> = {
  0: { x: FELT_X + FELT_W / 2 - 68, y: FELT_Y + FELT_H - 108 }, // 南 下
  1: { x: FELT_X + 26, y: FELT_Y + 150 },                       // 東 左
  2: { x: FELT_X + FELT_W / 2 - 68, y: FELT_Y + 44 },           // 北 上
  3: { x: FELT_X + FELT_W - 160, y: FELT_Y + 150 },             // 西 右
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
  // 透视梯形绿呢（rotateX→上窄下宽·gold 虚线=牌区黄线·内嵌白虚线内区·owner「透视梯形·很重要」）。
  const trapezoid: LayoutNode = {
    type: 'Panel', id: 'felt', props: { bg: { custom: FELT }, dashed: true, edge: 'gold' },
    layout: { x: FELT_X, y: FELT_Y, width: FELT_W, height: FELT_H, rotateX: 34, perspective: 1050, radius: 14 },
    children: [
      { type: 'Panel', id: 'felt-inner', props: { bg: 'transparent', dashed: true, edge: 'jade' }, layout: { x: 64, y: 40, width: FELT_W - 128, height: FELT_H - 96, radius: 10 } },
    ],
  };
  // 中央场况（平面浮层·不随透视倾斜·可读）。
  const info: LayoutNode = {
    type: 'Panel', id: 'felt-info', props: { bare: true },
    layout: { x: FELT_X + FELT_W / 2 - 110, y: FELT_Y + 128, width: 220, direction: 'column', align: 'center', gap: 5 },
    children: [
      { type: 'Label', id: 'felt-round', props: { text: `${m.roundNo <= 4 ? '東' : '南'}場 · ${WIND[seatWind(m.dealer, m.dealer)]}家`, size: 'xl', bold: true, font: 'serif', color: 'gold' } },
      { type: 'Label', id: 'felt-wall', props: { text: `余牌 ${m.cur.wall.length} · ${m.honba} 本場 · 供托 ${m.kyotaku / 1000}`, size: 'xs', color: 'jade' } },
      { type: 'Panel', id: 'felt-dora', props: { bare: true }, layout: { direction: 'row', gap: 4, align: 'center' }, children: [{ type: 'Label', id: 'felt-dl', props: { text: '宝牌', size: 'xs', color: 'sub' } }, ...doraTiles] },
    ],
  };
  return [trapezoid, info];
}

// ══════════════════════════════════════════════════════════════════════════════════════════
//  自家手牌（底部大排·真牌面·两步打牌·动态张数·贴底靠玩家座）
// ══════════════════════════════════════════════════════════════════════════════════════════
function playerHand(m: MatchState, selectedKey: string | null): LayoutNode[] {
  const rs = m.cur;
  const hand = rs.hands[0]!;
  const canPlay = isPlayerTurn(m);
  const locked = rs.riichi[0];
  const showDrawn = rs.drawn !== null && rs.turn === 0;
  const step = HW + 4;
  const drawnGap = 22;
  const n = hand.length;
  const totalW = n * step - 4 + (showDrawn ? drawnGap + HW : 0);
  const x0 = Math.round(PANEL_X + (PANEL_W - totalW) / 2); // 居对局盘水平中（避左栏）
  const BASE_Y = PLAY_H - HH - 10;
  const RAISE = 18;
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
  if (showDrawn) out.push(mkTile(rs.drawn!, 'd', x0 + n * step + drawnGap - 4, !canPlay));
  return out;
}

// ── 副露展示（吃/碰/杠·来源标签·owner「吃谁碰谁」）· 摆玩家座上方左侧（吃碰区·自定位）───────────
const MELD_VERB: Record<string, string> = { chi: '吃', pon: '碰', minkan: '杠', ankan: '暗杠', kakan: '加杠' };
function meldBlock(m: MatchState, seat: number): LayoutNode | null {
  const melds = m.cur.melds[seat]!;
  if (melds.length === 0) return null;
  const w = seat === 0 ? 24 : 18, h = seat === 0 ? 32 : 24;
  // 吃碰区位：玩家(0)=座条上方·他家=各自头像框下。
  const pos = seat === 0
    ? { x: PANEL_X + 6, y: PLAY_H - HH - 120 }              // 玩家吃碰区：上移·避免跟手牌重叠（owner 微调）
    : { x: OPP_POS[seat]!.x - 12, y: OPP_POS[seat]!.y + 94 }; // 他家：头像+名下
  return {
    type: 'Panel', id: `melds-${seat}`, props: { bg: { custom: 'rgba(20,10,20,0.5)' } },
    layout: { x: pos.x, y: pos.y, direction: 'row', gap: 6, padding: 4, align: 'center' },
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

// ── 顶部开关（祈祷模式/托管/牌面标记）· 静态到稿 ──────────────────────────────────────────────
function topToggles(): LayoutNode {
  const tg = (id: string, label: string, on: boolean): LayoutNode => ({
    type: 'Panel', id, props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' },
    children: [
      { type: 'Toggle', id: `${id}-t`, props: { label: '', checked: on, action: BACK_MENU } },
      { type: 'Label', id: `${id}-l`, props: { text: label, size: 'sm', color: on ? 'jade' : 'sub' } },
    ],
  });
  return {
    type: 'Panel', id: 'toptoggles', props: { bare: true },
    layout: { x: PANEL_X + 20, y: PANEL_Y + 14, width: PANEL_W - 40, direction: 'row', gap: 18, align: 'center', justify: 'between' },
    children: [
      { type: 'Panel', id: 'tt-l', props: { bare: true }, layout: { direction: 'row', gap: 16, align: 'center' }, children: [{ type: 'Button', id: 'tt-help', props: { label: '?', kind: 'ghost', action: BACK_MENU }, layout: { width: 32, height: 32 } }, tg('tt-pray', '祈祷模式', false)] },
      { type: 'Panel', id: 'tt-r', props: { bare: true }, layout: { direction: 'row', gap: 16, align: 'center' }, children: [tg('tt-auto', '托管', false), tg('tt-mark', '牌面标记', true)] },
    ],
  };
}

// ── 聊天条 + 演示行动栏（底部·静态到稿）──────────────────────────────────────────────────────
function chatBtn(): LayoutNode {
  return { type: 'Button', id: 'chat', props: { label: '💬 说点什么…', kind: 'ghost', action: BACK_MENU }, layout: { x: PANEL_X + PANEL_W - 154, y: PANEL_Y + PANEL_H - 108, width: 142, height: 36 } };
}

// ── 行动按钮排（自摸/立直/杠·日志/菜单）= acts（测试钉）──────────────────────────────────────
function actionBar(m: MatchState): LayoutNode {
  return {
    type: 'Panel', id: 'acts', props: { bare: true },
    layout: { x: PANEL_X + PANEL_W / 2 - 176, y: PANEL_Y + PANEL_H - 100, direction: 'row', gap: 8, align: 'center' },
    children: [
      { type: 'Button', id: 'act-tsumo', props: { label: '自摸', kind: 'hero', disabled: !canTsumo(m), action: ACT_TSUMO } },
      ...(canAnkan(m) || canKakan(m) ? [{ type: 'Button' as const, id: 'act-kan', props: { label: '杠', kind: 'primary' as const, action: ACT_KAN } }] : []),
      { type: 'Button', id: 'act-riichi', props: { label: '立直', kind: 'primary', disabled: !canRiichi(m), action: ACT_RIICHI } },
      { type: 'Button', id: 'act-log', props: { label: '📜', kind: 'quiet', action: TOGGLE_LOG } },
      { type: 'Button', id: 'act-menu', props: { label: '☰', kind: 'quiet', action: BACK_MENU } },
    ],
  };
}

// ── 鸣牌窗口按钮条（有人打出可鸣牌·亮碰/吃/荣/过）────────────────────────────────────────────
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
    layout: { x: PANEL_X + PANEL_W / 2 - 230, y: PANEL_Y + PANEL_H - 106, width: 460, padding: 8, gap: 9, direction: 'row', justify: 'center', align: 'center' },
    children: btns,
  };
}

// ── 回合流向指示（谁在打·打到谁那里·中央指向条）─────────────────────────────────────────────
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
    layout: { x: PANEL_X + 10, y: PANEL_Y + PANEL_H - 98, width: 214, padding: 6, gap: 1, direction: 'column', align: 'start' },
    children: [
      { type: 'Label', id: 'tb-head', props: { text: head, size: 'sm', bold: true, color: hot ? 'gold' : 'jade' } },
      { type: 'Label', id: 'tb-flow', props: { text: flow, size: 'xs', color: 'sub' } },
    ],
  };
}

// ── 日志面板（覆盖对局盘·可关·种子可复现）────────────────────────────────────────────────────
function logPanel(m: MatchState, logCopied: boolean): LayoutNode {
  const evs = m.log.recent(24);
  return {
    type: 'Panel', id: 'logpanel', props: { bg: { custom: 'rgba(18,12,20,0.98)' }, title: `游戏日志 · 跨局累计 · 种子 ${m.rng.seed}` },
    layout: { x: PANEL_X + 12, y: PANEL_Y + 12, width: PANEL_W - 24, height: PANEL_H - 24, padding: 10, gap: 3, direction: 'column' },
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
//  结算浮层（暗手/副露分开·役种逐行·一眼看出为什么赢）· 保留 owner 2026-07-18 重设计
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
    // 底层背景盘（对局区暗底）。
    { type: 'Panel', id: 'playpanel', props: { bg: { custom: 'rgba(14,26,26,0.5)' } }, layout: { x: PANEL_X, y: PANEL_Y, width: PANEL_W, height: PANEL_H } },
    // chrome：顶栏 + 左栏 + 角色卡 + 顶开关。
    topBar(), sideBar(),
    ...[1, 2, 3].map((s, i) => charCard(m, s, i)),
    topToggles(),
    // 对局盘：出牌区透视梯形 + 牌河（2D）+ 桌上头像框（seat 1/2/3）+ 玩家座条（seat 0）。
    ...playField(m),
    ...[0, 1, 2, 3].map((s) => riverBlock(m, s)).filter((n): n is LayoutNode => n !== null),
    ...[1, 2, 3].map((s) => tableAvatar(m, s)),
    playerBar(m),
    ...[0, 1, 2, 3].map((s) => meldBlock(m, s)).filter((n): n is LayoutNode => n !== null),
    ...playerHand(m, sel),
    chatBtn(),
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
