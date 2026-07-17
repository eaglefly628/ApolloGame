// Game C ·《六人德州》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·夜宴系主题皮）。
// 两层 1:1 律（生产总线红线·Lead 2026-07-17）：S4 结构 1:1（布局/信息层级/状态可见性照稿·素皮）；
//   本文件=S5 视觉 1:1「换正装」——字体/渐变/纹样/发光纯观感替换，**布局锚点零改动**（对齐 art-data-manual §5 视觉·
//   闭集控件表达：Panel bg 令牌(FillPreset/SurfaceToken)+edge+fx glow、Label impact 艺术字+glow、layout.rotate 斜摆、
//   ProgressBar ring 读秒、Panel action 三色按钮）。闭集真缺的质感件走 requests.md 报 PUI（绝不手写 CSS 逃生）。
// 写世界只经 action 信号；S5 骨架期 action 由宿主 HandlerMap 消化（衣柜开关=本地 state；下注真接 sim=M4）。
// 3D 视口（牌桌/凳/立体筹码）=M3 render-only 接（原型标注层自标 Camera3D/Mesh3D/Decal3D/Glow3D）；本层 felt 平面占位。
import type { LayoutNode } from '@ui/components/index.js';
import type { Card } from '@engine/protocol/components.js';
import {
  FELT_BG, OPPONENT_ANCHORS, anchorTopLeft, cardFace, SEAT_W, SEAT_H, FIELD_W, FIELD_H,
} from './theme.js';
import type { GameEvent } from './game-log.js';

// ── 视图数据（宿主从 M1 sim 状态纯读投影·outcome-first）─────────────────────────
export interface SeatView {
  seat: number; name: string; chips: number; committed: number; clothes: number;
  folded: boolean; allIn: boolean; out: boolean; isActor: boolean; isHero: boolean; isButton: boolean;
}
export interface WardrobeRow { id: string; name: string; value: number; pawned: boolean; }
export interface WardrobeView { seat: number; name: string; isHero: boolean; rows: WardrobeRow[]; }
export interface TableView {
  blindLabel: string; handNo: number; pot: number;
  board: Card[]; heroHole: Card[]; heroHandName: string;
  seats: SeatView[]; toCall: number; canRaise: boolean; minRaise: number; maxRaise: number; raiseValue: number;
  muted: boolean; openWardrobe: number | null; wardrobe?: WardrobeView;
  showLog: boolean; log: GameEvent[]; // 游戏日志（确定性事件流·查 bug·owner 2026-07-17）
}

const ITEM_EMOJI: Record<string, string> = { earrings: '💎', gloves: '🧤', socks: '🧦', top: '👚', skirt: '👗', lingerie: '🎀' };
const fmt = (n: number): string => n.toLocaleString('en-US');
// 夜宴系面渐变（原型座位卡/面板底·§1 深胡桃·custom 保质感·主题特定纹样）。
const CARD_FILL = 'linear-gradient(160deg,rgba(30,20,34,0.94),rgba(14,9,18,0.96))';
const CARD_FILL_HERO = 'linear-gradient(160deg,rgba(40,26,44,0.96),rgba(16,10,22,0.97))';

// ── 公共牌 / 底牌（白牌 face:light·红黑对比·§5.3 Decal3D 牌面正装）──────────────
function cardNode(id: string, c: Card | null, size: 'md' | 'lg', rotate?: number): LayoutNode {
  const layout = rotate ? { rotate } : {};
  if (!c) return { type: 'PlayingCard', id, props: { rank: '', suit: '♠', faceUp: false, face: 'dark', size }, layout };
  const f = cardFace(c);
  return { type: 'PlayingCard', id, props: { rank: f.rank, suit: f.suit, faceUp: true, face: 'light', size }, layout };
}

function buildBoard(v: TableView): LayoutNode {
  const slots: LayoutNode[] = [];
  for (let i = 0; i < 5; i++) slots.push(cardNode(`c-board-${i}`, v.board[i] ?? null, 'md'));
  return {
    type: 'Panel', id: 'c-board', props: { bare: true },
    layout: { x: Math.round(FIELD_W / 2 - 195), y: 250, width: 390, direction: 'row', gap: 8, justify: 'center' },
    children: slots,
  };
}

// ── 座位卡（正装：夜宴渐变底 + 状态 edge 金/翠/红 + active/allin 发光 + 读秒 + 状态气泡）────
function statusBubble(v: SeatView): LayoutNode | null {
  const mk = (text: string, bg: string, color: 'ok' | 'danger' | 'dim' | 'gold'): LayoutNode => ({
    type: 'Panel', id: `c-bub-${v.seat}`, props: { bg: { custom: bg } },
    layout: { direction: 'row', justify: 'center', padding: 3, radius: 12 },
    children: [{ type: 'Label', id: `c-bub-t-${v.seat}`, props: { text, size: 'xs', bold: true, color } }],
  });
  if (v.out) return mk('出局 OUT', 'rgba(80,80,88,0.3)', 'dim');
  if (v.folded) return mk('已弃 FOLD', 'rgba(120,120,130,0.2)', 'dim');
  if (v.allIn) return mk('ALL-IN', 'linear-gradient(90deg,rgba(200,53,43,0.9),rgba(192,57,43,0.9))', 'gold');
  if (v.isActor) return mk('● 思考中 · 0:15', 'rgba(127,214,176,0.15)', 'ok');
  return null;
}

function seatCard(v: SeatView, x: number, y: number, w: number, h: number): LayoutNode {
  const edge = v.allIn ? 'danger' : v.isActor ? 'jade' : v.out || v.folded ? undefined : 'gold';
  const fx = v.isActor ? [{ kind: 'glow' as const, color: 'jade' as const }] : v.allIn ? [{ kind: 'glow' as const, color: 'danger' as const }] : undefined;
  const bub = statusBubble(v);

  const head: LayoutNode = {
    type: 'Panel', id: `c-seat-head-${v.seat}`, props: { bare: true },
    layout: { direction: 'row', gap: 9, align: 'center' },
    children: [
      { type: 'Avatar', id: `c-av-${v.seat}`, props: { name: v.name.slice(0, 1), size: v.isHero ? 56 : 44, shape: 'circle' } },
      {
        type: 'Panel', id: `c-seat-col-${v.seat}`, props: { bare: true },
        layout: { direction: 'column', gap: 1, flex: 1 },
        children: [
          {
            type: 'Panel', id: `c-name-row-${v.seat}`, props: { bare: true },
            layout: { direction: 'row', gap: 5, align: 'center' },
            children: [
              { type: 'Label', id: `c-name-${v.seat}`, props: { text: v.name, size: 'sm', bold: true, color: v.out ? 'dim' : 'text' } },
              ...(v.isHero ? [{ type: 'Label', id: `c-you-${v.seat}`, props: { text: 'YOU', size: 'xs', color: 'dim' } } as LayoutNode] : []),
              ...(v.isButton ? [{ type: 'Badge', id: `c-btn-${v.seat}`, props: { text: 'D', tone: 'warn' } } as LayoutNode] : []),
            ],
          },
          { type: 'Label', id: `c-chips-${v.seat}`, props: { text: fmt(v.chips), font: 'impact', size: v.isHero ? 28 : 20, color: v.out ? 'dim' : 'gold', glow: !v.out } },
        ],
      },
    ],
  };
  const meta: LayoutNode = {
    type: 'Panel', id: `c-seat-meta-${v.seat}`, props: { bare: true },
    layout: { direction: 'row', gap: 6, align: 'center' },
    children: [
      { type: 'Tag', id: `c-tag-${v.seat}`, props: { label: v.isHero ? '你' : '对手', tone: v.isHero ? 'normal' : 'accent', size: 'sm' } },
      { type: 'Label', id: `c-cloth-${v.seat}`, props: { text: `👗 ${v.clothes}`, size: 'sm', color: 'sub' } },
      ...(v.committed > 0 ? [{ type: 'Label', id: `c-bet-${v.seat}`, props: { text: `注 ${fmt(v.committed)}`, size: 'sm', color: 'gold' } } as LayoutNode] : []),
    ],
  };
  const children: LayoutNode[] = bub ? [bub, head, meta] : [head, meta];
  // active 读秒条（原型倒计时环的闭集近似·环绕头像=报 PUI Avatar.ring）
  if (v.isActor) children.push({ type: 'ProgressBar', id: `c-timer-${v.seat}`, props: { value: 65, max: 100, tone: 'accent' } });

  return {
    type: 'Panel', id: `c-seat-${v.seat}`,
    props: { bg: { custom: v.isHero ? CARD_FILL_HERO : CARD_FILL }, edge, action: 'seat_view', actionArg: String(v.seat) },
    layout: { x, y, width: w, height: h, direction: 'column', gap: 5, padding: 10, opacity: v.out ? 0.42 : v.folded ? 0.55 : 1, ...(fx ? { fx } : {}) },
    children,
  };
}

// ── 顶带（SB 徽章 + 盲注 impact + POT 金发光大字 + ⚙♪）──────────────────────────
function buildTopBar(v: TableView): LayoutNode {
  return {
    type: 'Panel', id: 'c-top', props: { bg: { custom: 'linear-gradient(180deg,rgba(8,5,14,0.92),rgba(8,5,14,0.15) 82%,rgba(8,5,14,0))' } },
    layout: { x: 0, y: 0, width: FIELD_W, height: 76, direction: 'row', align: 'center', justify: 'between', padding: 16 },
    children: [
      {
        type: 'Panel', id: 'c-blind', props: { bg: { custom: CARD_FILL }, edge: 'gold' },
        layout: { direction: 'row', gap: 10, align: 'center', padding: 8, radius: 10 },
        children: [
          {
            type: 'Panel', id: 'c-sb', props: { bg: { custom: 'linear-gradient(160deg,#c0392b,#7a1420)' }, edge: 'gold' },
            layout: { direction: 'row', justify: 'center', align: 'center', width: 30, height: 28, radius: 6 },
            children: [{ type: 'Label', id: 'c-sb-t', props: { text: 'SB', font: 'impact', size: 14, color: 'gold' } }],
          },
          {
            type: 'Panel', id: 'c-blind-col', props: { bare: true }, layout: { direction: 'column', gap: 0 },
            children: [
              { type: 'Label', id: 'c-blind-v', props: { text: `盲注 ${v.blindLabel}`, font: 'impact', size: 20, color: 'text' } },
              { type: 'Label', id: 'c-hand-n', props: { text: `第 ${v.handNo} 手 · 现金局`, size: 'xs', color: 'dim' } },
            ],
          },
        ],
      },
      {
        type: 'Panel', id: 'c-pot', props: { bare: true },
        layout: { direction: 'column', align: 'center', gap: 0 },
        children: [
          { type: 'Label', id: 'c-pot-l', props: { text: 'POT · 底池', font: 'mono', size: 'xs', color: 'warn' } },
          { type: 'Label', id: 'c-pot-v', props: { text: `◉ ${fmt(v.pot)}`, font: 'impact', size: 44, color: 'gold', glow: true } },
        ],
      },
      {
        type: 'Panel', id: 'c-menu', props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Button', id: 'c-log', props: { label: '📋', kind: v.showLog ? 'primary' : 'ghost', action: 'toggle_log' } },
          { type: 'Button', id: 'c-sound', props: { label: v.muted ? '🔇' : '♪', kind: 'ghost', action: 'sound_toggle' } },
          { type: 'Button', id: 'c-gear', props: { label: '⚙', kind: 'ghost', action: 'menu_open' } },
        ],
      },
    ],
  };
}

// ── 底牌区（大牌斜摆 + 金光 + 成牌胶囊·§5.4）────────────────────────────────────
function buildHeroCards(v: TableView): LayoutNode {
  return {
    type: 'Panel', id: 'c-hole', props: { bare: true },
    layout: { x: Math.round(FIELD_W / 2 - 150), y: FIELD_H - 172, width: 300, direction: 'column', align: 'center', gap: 8 },
    children: [
      {
        type: 'Panel', id: 'c-hole-row', props: { bare: true },
        layout: { direction: 'row', gap: 12, justify: 'center' },
        children: [cardNode('c-hole-0', v.heroHole[0] ?? null, 'lg', -6), cardNode('c-hole-1', v.heroHole[1] ?? null, 'lg', 6)],
      },
      {
        type: 'Panel', id: 'c-hole-cap', props: { bg: { custom: 'rgba(224,180,88,0.14)' }, edge: 'gold' },
        layout: { direction: 'row', justify: 'center', padding: 5, radius: 14 },
        children: [{ type: 'Label', id: 'c-hole-name', props: { text: `最优成牌 · ${v.heroHandName || '—'}`, font: 'serif', size: 'sm', bold: true, color: 'gold' } }],
      },
    ],
  };
}

// ── 行动条（三色大按钮 Panel+action：弃牌 blood / 跟注 jade-sheen / 加注 gold-sheen + 副标签 + 滑杆）──
function bigBtn(id: string, main: string, sub: string, fill: string, mainColor: 'text' | 'ink', action: string, arg?: string, flex = 1): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: fill as never, action, ...(arg ? { actionArg: arg } : {}) },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 0, padding: 12, radius: 11, flex },
    children: [
      { type: 'Label', id: `${id}-m`, props: { text: main, font: 'impact', size: 18, color: mainColor } },
      { type: 'Label', id: `${id}-s`, props: { text: sub, font: 'mono', size: 'xs', color: mainColor === 'ink' ? 'ink' : 'dim' } },
    ],
  };
}
function buildActionBar(v: TableView): LayoutNode {
  const callMain = v.toCall > 0 ? `跟注 ${fmt(v.toCall)}` : '过牌';
  const main: LayoutNode = {
    type: 'Panel', id: 'c-act-main', props: { bare: true },
    layout: { direction: 'row', gap: 9, align: 'stretch' },
    children: [
      bigBtn('c-act-fold', '弃牌', 'FOLD', 'blood', 'text', 'act_fold', undefined, 1),
      bigBtn('c-act-call', callMain, v.toCall > 0 ? 'CALL' : 'CHECK', 'jade-sheen', 'text', 'act_check_call', undefined, 1.2),
      ...(v.canRaise ? [bigBtn('c-act-raise', `加注 ${fmt(v.raiseValue)}`, 'RAISE', 'gold-sheen', 'ink', 'act_raise', 'slider', 1.2)] : []),
    ],
  };
  const quick: LayoutNode = {
    type: 'Panel', id: 'c-quick', props: { bare: true },
    layout: { direction: 'row', gap: 6, justify: 'end' },
    children: [
      { type: 'Button', id: 'c-q-half', props: { label: '½ 池', kind: 'quiet', action: 'act_raise', actionArg: 'half' } },
      { type: 'Button', id: 'c-q-two3', props: { label: '⅔ 池', kind: 'quiet', action: 'act_raise', actionArg: 'twoThird' } },
      { type: 'Button', id: 'c-q-pot', props: { label: '满池', kind: 'quiet', action: 'act_raise', actionArg: 'pot' } },
      { type: 'Button', id: 'c-q-allin', props: { label: '全下', kind: 'quiet', action: 'act_raise', actionArg: 'allin' } },
    ],
  };
  const children: LayoutNode[] = [main];
  if (v.canRaise) {
    children.push({
      type: 'Panel', id: 'c-raise-wrap', props: { bg: { custom: 'rgba(12,8,18,0.7)' }, edge: 'gold' },
      layout: { direction: 'row', align: 'center', gap: 12, padding: 8, radius: 10 },
      children: [
        { type: 'Label', id: 'c-raise-l', props: { text: 'RAISE', font: 'mono', size: 'xs', color: 'dim' } },
        { type: 'Slider', id: 'c-raise-slider', props: { min: v.minRaise, max: v.maxRaise, value: v.raiseValue, step: 25, action: 'set_raise' }, layout: { flex: 1 } },
        { type: 'Label', id: 'c-raise-v', props: { text: fmt(v.raiseValue), font: 'impact', size: 22, color: 'gold' } },
      ],
    });
  }
  children.push(quick);
  return {
    type: 'Panel', id: 'c-act', props: { bare: true },
    layout: { x: FIELD_W - 372, y: FIELD_H - 182, width: 356, direction: 'column', gap: 9 },
    children,
  };
}

// ── 衣柜面板（正装：立绘区虚线框 + 行渐变金边 + 图标方块 + 面值 impact + 换筹码金键）──────
function buildWardrobe(w: WardrobeView): LayoutNode {
  const rows: LayoutNode[] = w.rows.map((r) => ({
    type: 'Panel', id: `c-wr-${r.id}`, props: { bg: { custom: r.pawned ? 'rgba(30,26,32,0.5)' : 'rgba(224,180,88,0.06)' }, edge: r.pawned ? undefined : 'gold' },
    layout: { direction: 'row', gap: 12, align: 'center', justify: 'between', padding: 11, radius: 11, opacity: r.pawned ? 0.5 : 1 },
    children: [
      {
        type: 'Panel', id: `c-wr-l-${r.id}`, props: { bare: true }, layout: { direction: 'row', gap: 11, align: 'center' },
        children: [
          {
            type: 'Panel', id: `c-wr-ic-${r.id}`, props: { bg: { custom: r.pawned ? 'linear-gradient(150deg,#3a3640,#1a1820)' : 'linear-gradient(150deg,#5a3d2e,#2a1a12)' }, edge: r.pawned ? undefined : 'gold' },
            layout: { width: 40, height: 40, justify: 'center', align: 'center', radius: 9 },
            children: [{ type: 'Label', id: `c-wr-em-${r.id}`, props: { text: ITEM_EMOJI[r.id] ?? '👗', size: 'lg' } }],
          },
          {
            type: 'Panel', id: `c-wr-nm-col-${r.id}`, props: { bare: true }, layout: { direction: 'column', gap: 0 },
            children: [
              { type: 'Label', id: `c-wr-nm-${r.id}`, props: { text: r.name, size: 'md', bold: true, color: r.pawned ? 'dim' : 'text' } },
              { type: 'Label', id: `c-wr-st-${r.id}`, props: { text: r.pawned ? '已当 · 立绘层消失' : '在穿', size: 'xs', color: r.pawned ? 'dim' : 'sub' } },
            ],
          },
        ],
      },
      {
        type: 'Panel', id: `c-wr-r-${r.id}`, props: { bare: true }, layout: { direction: 'row', gap: 12, align: 'center' },
        children: [
          { type: 'Label', id: `c-wr-val-${r.id}`, props: { text: r.pawned ? '已典当' : `面值 ${fmt(r.value)}`, font: r.pawned ? 'ui' : 'impact', size: r.pawned ? 'sm' : 20, color: r.pawned ? 'dim' : 'gold' } },
          ...(w.isHero && !r.pawned
            ? [{ type: 'Panel', id: `c-wr-pawn-${r.id}`, props: { bg: 'gold-sheen' as never, action: 'pawn_item', actionArg: r.id }, layout: { padding: 9, radius: 9, justify: 'center' }, children: [{ type: 'Label', id: `c-wr-pawn-t-${r.id}`, props: { text: '换筹码', font: 'impact', size: 'sm', color: 'ink' } }] } as LayoutNode]
            : []),
        ],
      },
    ],
  }));
  const panel: LayoutNode = {
    type: 'Panel', id: 'c-wardrobe-card', props: { bg: { custom: 'linear-gradient(160deg,rgba(34,22,38,0.98),rgba(14,9,18,0.99))' }, edge: 'gold' },
    layout: { x: Math.round(FIELD_W / 2 - 400), y: 100, width: 800, height: 500, direction: 'row', gap: 0, radius: 16 },
    children: [
      {
        type: 'Panel', id: 'c-wr-portrait', props: { bg: { custom: 'linear-gradient(180deg,#2a1a12,#160f0b)' } },
        layout: { width: 300, direction: 'column', align: 'center', justify: 'center', gap: 12, padding: 20 },
        children: [
          {
            type: 'Panel', id: 'c-wr-frame', props: { bare: true, dashed: true, edge: 'gold' },
            layout: { direction: 'column', align: 'center', justify: 'center', gap: 12, padding: 22, radius: 12, width: 200, height: 300 },
            children: [
              { type: 'Avatar', id: 'c-wr-face', props: { name: w.name.slice(0, 1), size: 88, shape: 'circle' } },
              { type: 'Label', id: 'c-wr-face-l', props: { text: `${w.name} 立绘`, font: 'impact', size: 26, color: 'gold' } },
              { type: 'Label', id: 'c-wr-face-s', props: { text: '分层立绘区 · 3:4 · 典当逐层消失', size: 'xs', color: 'dim' } },
            ],
          },
        ],
      },
      {
        type: 'Panel', id: 'c-wr-list-wrap', props: { bare: true },
        layout: { direction: 'column', gap: 14, padding: 24, flex: 1 },
        children: [
          {
            type: 'Panel', id: 'c-wr-hdr', props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'center' },
            children: [
              {
                type: 'Panel', id: 'c-wr-hdr-l', props: { bare: true }, layout: { direction: 'column', gap: 0 },
                children: [
                  { type: 'Label', id: 'c-wr-title', props: { text: `${w.name} · 衣柜`, font: 'impact', size: 30, color: 'text' } },
                  { type: 'Label', id: 'c-wr-mode', props: { text: w.isHero ? '自己视角 · 在穿件可典当换筹码' : '对手视角 · 只读（件名 + 面值可见）', size: 'xs', color: 'dim' } },
                ],
              },
              { type: 'Button', id: 'c-wr-close', props: { label: '✕', kind: 'ghost', action: 'panel_close' } },
            ],
          },
          { type: 'Panel', id: 'c-wr-rows', props: { bare: true }, layout: { direction: 'column', gap: 9 }, children: rows },
        ],
      },
    ],
  };
  return {
    type: 'Panel', id: 'c-wardrobe-scrim', props: { bg: { custom: 'rgba(4,2,8,0.72)' }, action: 'panel_close' },
    layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H },
    children: [panel],
  };
}

// ── 主菜单屏 SC-1（对齐 texas-main-menu 稿·左立绘 + 右标题按钮 + 左下角色卡）──────────────
export interface MenuView { playerName: string; playerChips: number; blindLabel: string; }
export function buildMenu(m: MenuView): LayoutNode {
  const portrait: LayoutNode = {
    type: 'Panel', id: 'c-menu-portrait', props: { bare: true, dashed: true, edge: 'gold' },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 12, padding: 22, width: 300, height: 440, radius: 12 },
    children: [
      { type: 'Label', id: 'c-menu-p-badge', props: { text: 'C-CHAR-HERO', font: 'mono', size: 'xs', color: 'warn' } },
      { type: 'Avatar', id: 'c-menu-p-face', props: { name: m.playerName.slice(0, 1), size: 96, shape: 'rounded' } },
      { type: 'Label', id: 'c-menu-p-title', props: { text: '· 主角立绘', font: 'impact', size: 26, color: 'gold' } },
      { type: 'Label', id: 'c-menu-p-size', props: { text: '尺寸 300 × 440 · 竖幅', size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'c-menu-p-anchor', props: { text: '风格锚 · 二次元 / 柔光 / 暖夜 / 不露骨', size: 'xs', color: 'dim' } },
    ],
  };
  const right: LayoutNode = {
    type: 'Panel', id: 'c-menu-right', props: { bare: true },
    layout: { direction: 'column', align: 'end', gap: 14, width: 440 },
    children: [
      {
        type: 'Panel', id: 'c-menu-title-row', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'end', justify: 'end' },
        children: [
          { type: 'Label', id: 'c-menu-t1', props: { text: '德州', font: 'serif', size: 72, bold: true, color: 'text' } },
          { type: 'Label', id: 'c-menu-t2', props: { text: '夜宴', font: 'serif', size: 72, bold: true, color: 'danger' } },
        ],
      },
      { type: 'Label', id: 'c-menu-sub', props: { text: '六人环桌 · 押注见真章 · 步步为局', size: 'md', color: 'sub' } },
      {
        type: 'Panel', id: 'c-menu-blind', props: { bg: { custom: 'linear-gradient(160deg,#c0392b,#7a1420)' }, edge: 'gold' },
        layout: { direction: 'row', gap: 8, align: 'center', padding: 7, radius: 8 },
        children: [
          { type: 'Label', id: 'c-menu-blind-l', props: { text: '本局盲注', size: 'xs', color: 'gold' } },
          { type: 'Label', id: 'c-menu-blind-v', props: { text: m.blindLabel, font: 'impact', size: 18, color: 'gold' } },
        ],
      },
      {
        type: 'Panel', id: 'c-menu-redpack', props: { bg: { custom: 'linear-gradient(90deg,rgba(224,180,88,0.2),rgba(200,53,43,0.15))' }, edge: 'warn' },
        layout: { direction: 'row', justify: 'center', padding: 6, radius: 16 },
        children: [{ type: 'Label', id: 'c-menu-rp-t', props: { text: '🧧 每日首局 +88 红包', size: 'sm', color: 'gold' } }],
      },
      { type: 'Button', id: 'c-menu-start', props: { label: '开始上桌', kind: 'hero', action: 'start_game' }, layout: { width: 280 } },
      { type: 'Button', id: 'c-menu-continue', props: { label: '继续上局', kind: 'ghost', action: 'continue_game' }, layout: { width: 280 } },
      { type: 'Button', id: 'c-menu-settings', props: { label: '设置', kind: 'ghost', action: 'menu_open' }, layout: { width: 280 } },
    ],
  };
  const roleCard: LayoutNode = {
    type: 'Panel', id: 'c-menu-role', props: { bg: { custom: CARD_FILL }, edge: 'gold' },
    layout: { x: 40, y: FIELD_H - 130, width: 240, direction: 'row', gap: 12, align: 'center', padding: 12, radius: 12 },
    children: [
      { type: 'Avatar', id: 'c-menu-role-av', props: { name: m.playerName.slice(0, 1), size: 52, shape: 'circle' } },
      {
        type: 'Panel', id: 'c-menu-role-col', props: { bare: true }, layout: { direction: 'column', gap: 2 },
        children: [
          { type: 'Label', id: 'c-menu-role-name', props: { text: m.playerName, size: 'md', bold: true, color: 'text' } },
          { type: 'Label', id: 'c-menu-role-chips', props: { text: `◉ ${fmt(m.playerChips)}`, font: 'impact', size: 20, color: 'gold', glow: true } },
        ],
      },
    ],
  };
  return {
    type: 'Screen', id: 'c-menu', props: { bg: { custom: 'radial-gradient(ellipse at 50% 26%,#33221a 0%,#1c110c 46%,#0d0806 82%)' } },
    layout: { width: FIELD_W, height: FIELD_H },
    children: [
      {
        type: 'Panel', id: 'c-menu-stage', props: { bare: true },
        layout: { x: 90, y: 130, width: FIELD_W - 180, height: 460, direction: 'row', align: 'center', justify: 'between' },
        children: [portrait, right],
      },
      roleCard,
      { type: 'Label', id: 'c-menu-ver', props: { text: 'v0.1.0 · 盒庭线', font: 'mono', size: 'xs', color: 'dim' }, layout: { x: FIELD_W - 200, y: FIELD_H - 40, width: 180 } },
    ],
  };
}

// ── 游戏日志面板（owner 2026-07-17 查 bug·确定性事件流·右侧可开关滚动）──────────────
const LOG_TAG_COLOR: Record<GameEvent['tag'], 'sub' | 'text' | 'gold' | 'warn' | 'ok'> = {
  deal: 'ok', blind: 'sub', action: 'text', street: 'gold', showdown: 'gold', pawn: 'warn', info: 'ok',
};
function buildLogPanel(log: GameEvent[]): LayoutNode {
  const rows: LayoutNode[] = log.map((e) => ({
    type: 'Label', id: `c-log-${e.seq}`, props: { text: e.text, font: 'mono', size: 'xs', color: LOG_TAG_COLOR[e.tag] },
  }));
  return {
    type: 'Panel', id: 'c-logpanel', props: { bg: { custom: 'linear-gradient(160deg,rgba(20,14,26,0.97),rgba(10,7,16,0.98))' }, edge: 'gold', scroll: true },
    layout: { x: FIELD_W - 366, y: 84, width: 350, height: 456, direction: 'column', gap: 6, padding: 14 },
    children: [
      {
        type: 'Panel', id: 'c-log-hdr', props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'center' },
        children: [
          { type: 'Label', id: 'c-log-title', props: { text: '📋 牌局日志 · 查 bug', font: 'impact', size: 18, color: 'gold' } },
          { type: 'Button', id: 'c-log-close', props: { label: '✕', kind: 'ghost', action: 'toggle_log' } },
        ],
      },
      { type: 'Label', id: 'c-log-seed', props: { text: '确定性事件流 · 同 seed 同日志', size: 'xs', color: 'dim' } },
      { type: 'Divider', id: 'c-log-div', props: {} },
      { type: 'Panel', id: 'c-log-rows', props: { bare: true, scroll: true }, layout: { direction: 'column', gap: 5, flex: 1 }, children: rows },
    ],
  };
}

// ── 牌桌主屏（组装·绝对定位坐标零改动·z 序：felt→底池→公共牌→顶带→座位→底牌→行动条→日志→衣柜）──
export function buildTable(v: TableView): LayoutNode {
  const feltTable: LayoutNode = {
    type: 'Panel', id: 'c-felt', props: { bg: { custom: FELT_BG }, vignette: true, edge: 'gold' },
    layout: { x: 210, y: 120, width: FIELD_W - 420, height: 400, radius: 200 },
    children: [
      { type: 'Label', id: 'c-felt-mark', props: { text: '德州夜宴', font: 'serif', size: 32, bold: true, color: 'dim' }, layout: { x: Math.round((FIELD_W - 420) / 2 - 70), y: 150, width: 140, opacity: 0.22 } },
    ],
  };
  const potChips: LayoutNode = {
    type: 'Label', id: 'c-pot-felt',
    props: { text: `底池 ◉ ${fmt(v.pot)}`, font: 'impact', size: 20, color: 'gold', glow: true },
    layout: { x: Math.round(FIELD_W / 2 - 80), y: 200, width: 160 },
  };

  const opp = OPPONENT_ANCHORS.map((a) => {
    const sv = v.seats.find((s) => s.seat === a.seat)!;
    const { x, y } = anchorTopLeft(a);
    return seatCard({ ...sv, name: a.name }, x, y, SEAT_W, SEAT_H);
  });
  const hero = v.seats.find((s) => s.isHero)!;
  const heroCard = seatCard(hero, 20, FIELD_H - 168, 236, 108);

  const children: LayoutNode[] = [
    feltTable, potChips, buildBoard(v), buildTopBar(v),
    ...opp, heroCard, buildHeroCards(v), buildActionBar(v),
  ];
  if (v.showLog) children.push(buildLogPanel(v.log));
  if (v.openWardrobe !== null && v.wardrobe) children.push(buildWardrobe(v.wardrobe));

  return { type: 'Screen', id: 'c-table', props: {}, layout: { width: FIELD_W, height: FIELD_H }, children };
}
