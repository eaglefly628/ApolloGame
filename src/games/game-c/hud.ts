// Game C ·《六人德州》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·夜宴系主题皮·S5 素坯）。
// 布局 1:1 参照 art-data-manual §5（视觉权威）+ ui-brief §3；控件全取 catalog 闭集实名，零新控件。
// 写世界只经 action 信号（act_fold/act_check_call/act_raise/seat_view/pawn_item/panel_close/menu_open/sound_toggle）；
// S5 骨架期这些 action 由宿主 HandlerMap 消化（衣柜开关=本地 state；下注真接 sim=M4）——handler 绝不塞自由逻辑。
// 3D 视口（牌桌/凳/筹码物理）=M3 render-only 接；本素坯用程序化 felt 渐变占位（同 game-a/t 先例）。
import type { LayoutNode } from '@ui/components/index.js';
import type { Card } from '@engine/protocol/components.js';
import {
  C, FELT_BG, OPPONENT_ANCHORS, anchorTopLeft, cardFace, SEAT_W, SEAT_H, FIELD_W, FIELD_H,
} from './theme.js';

// ── 视图数据（宿主从 M1 sim 状态纯读投影·outcome-first）─────────────────────────
export interface SeatView {
  seat: number;
  name: string;
  chips: number;
  committed: number; // 本街当前注（0=未下注）
  clothes: number; // 剩余衣物件数
  folded: boolean;
  allIn: boolean;
  out: boolean; // 出局（筹码 0 且无衣可当）
  isActor: boolean; // 当前行动者
  isHero: boolean; // 主角位
  isButton: boolean; // 庄家钮
}
export interface WardrobeRow { id: string; name: string; value: number; pawned: boolean; }
export interface WardrobeView { seat: number; name: string; isHero: boolean; rows: WardrobeRow[]; }
export interface TableView {
  blindLabel: string; // '25 / 50'
  handNo: number;
  pot: number;
  board: Card[]; // 已翻公共牌（0/3/4/5 张）
  heroHole: Card[]; // 主角底牌 2 张
  heroHandName: string; // 当前最优牌型中文
  seats: SeatView[]; // 6 席（含主角·座位升序）
  toCall: number; // 主角需跟注额（0=可过牌）
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  raiseValue: number; // 加注滑杆当前值
  muted: boolean;
  openWardrobe: number | null; // 打开的衣柜座位（null=未开）
  wardrobe?: WardrobeView;
}

const ITEM_EMOJI: Record<string, string> = { earrings: '💎', gloves: '🧤', socks: '🧦', top: '👚', skirt: '👗', lingerie: '🎀' };
const fmt = (n: number): string => n.toLocaleString('en-US');

// ── 公共牌 / 底牌 ──────────────────────────────────────────────────────────────
function cardNode(id: string, c: Card | null, size: 'md' | 'lg'): LayoutNode {
  if (!c) return { type: 'PlayingCard', id, props: { rank: '', suit: '♠', faceUp: false, face: 'dark', size } };
  const f = cardFace(c);
  return { type: 'PlayingCard', id, props: { rank: f.rank, suit: f.suit, faceUp: true, face: 'light', size } };
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

// ── 座位卡（对手环 + 主角位共用·§5.4 座位卡）────────────────────────────────────
function statusChip(v: SeatView): LayoutNode | null {
  if (v.out) return { type: 'Badge', id: `c-st-${v.seat}`, props: { text: '出局', tone: 'dim' } };
  if (v.folded) return { type: 'Badge', id: `c-st-${v.seat}`, props: { text: '已弃', tone: 'dim' } };
  if (v.allIn) return { type: 'Badge', id: `c-st-${v.seat}`, props: { text: 'ALL-IN', tone: 'warn' } };
  if (v.isActor) return { type: 'Badge', id: `c-st-${v.seat}`, props: { text: '● 思考中', tone: 'ok' } };
  return null;
}

function seatCard(v: SeatView, x: number, y: number, w: number, h: number): LayoutNode {
  const st = statusChip(v);
  const headRow: LayoutNode = {
    type: 'Panel', id: `c-seat-head-${v.seat}`, props: { bare: true },
    layout: { direction: 'row', gap: 8, align: 'center' },
    children: [
      { type: 'Avatar', id: `c-av-${v.seat}`, props: { name: v.name, size: v.isHero ? 46 : 36, shape: 'circle' } },
      {
        type: 'Panel', id: `c-seat-col-${v.seat}`, props: { bare: true },
        layout: { direction: 'column', gap: 1 },
        children: [
          {
            type: 'Panel', id: `c-name-row-${v.seat}`, props: { bare: true },
            layout: { direction: 'row', gap: 5, align: 'center' },
            children: [
              { type: 'Label', id: `c-name-${v.seat}`, props: { text: v.name, size: 'sm', bold: true, color: v.out ? 'dim' : 'text' } },
              ...(v.isButton ? [{ type: 'Badge', id: `c-btn-${v.seat}`, props: { text: 'D', tone: 'warn' } } as LayoutNode] : []),
            ],
          },
          { type: 'Label', id: `c-chips-${v.seat}`, props: { text: `◉ ${fmt(v.chips)}`, font: 'impact', size: v.isHero ? 'xl' : 'lg', color: v.out ? 'dim' : 'gold' } },
        ],
      },
    ],
  };
  const metaRow: LayoutNode = {
    type: 'Panel', id: `c-seat-meta-${v.seat}`, props: { bare: true },
    layout: { direction: 'row', gap: 6, align: 'center' },
    children: [
      { type: 'Tag', id: `c-tag-${v.seat}`, props: { label: v.isHero ? '你' : '对手', tone: v.isHero ? 'normal' : 'accent', size: 'sm' } },
      { type: 'Label', id: `c-cloth-${v.seat}`, props: { text: `👗 ${v.clothes}`, size: 'sm', color: 'sub' } },
      ...(v.committed > 0 ? [{ type: 'Label', id: `c-bet-${v.seat}`, props: { text: `注 ${fmt(v.committed)}`, size: 'sm', color: 'gold' } } as LayoutNode] : []),
      ...(st ? [st] : []),
    ],
  };
  return {
    type: 'Panel', id: `c-seat-${v.seat}`,
    props: { accent: v.isActor, edge: v.isHero ? 'gold' : undefined, action: 'seat_view', actionArg: String(v.seat) },
    layout: { x, y, width: w, height: h, direction: 'column', gap: 5, padding: 9, opacity: v.out ? 0.5 : 1 },
    children: [headRow, metaRow],
  };
}

// ── 顶带（§5.1·左盲注 / 中 POT / 右菜单声音）────────────────────────────────────
function buildTopBar(v: TableView): LayoutNode {
  return {
    type: 'Panel', id: 'c-top', props: { bg: { custom: 'linear-gradient(180deg,rgba(22,14,10,0.92),rgba(22,14,10,0.4))' } },
    layout: { x: 0, y: 0, width: FIELD_W, height: 64, direction: 'row', align: 'center', justify: 'between', padding: 14 },
    children: [
      {
        type: 'Panel', id: 'c-blind', props: {},
        layout: { direction: 'row', gap: 8, align: 'center', padding: 8 },
        children: [
          { type: 'Label', id: 'c-blind-l', props: { text: '盲注', size: 'sm', color: 'sub' } },
          { type: 'Label', id: 'c-blind-v', props: { text: v.blindLabel, font: 'impact', size: 'lg', color: 'gold' } },
          { type: 'Label', id: 'c-hand-n', props: { text: `· 第 ${v.handNo} 手`, size: 'sm', color: 'sub' } },
        ],
      },
      {
        type: 'Panel', id: 'c-pot', props: { bare: true },
        layout: { direction: 'column', align: 'center', gap: 0 },
        children: [
          { type: 'Label', id: 'c-pot-l', props: { text: 'POT', size: 'xs', color: 'sub' } },
          { type: 'Label', id: 'c-pot-v', props: { text: `◉ ${fmt(v.pot)}`, font: 'impact', size: 'xxl', color: 'gold' } },
        ],
      },
      {
        type: 'Panel', id: 'c-menu', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Button', id: 'c-sound', props: { label: v.muted ? '🔇' : '🔊', kind: 'ghost', action: 'sound_toggle' } },
          { type: 'Button', id: 'c-gear', props: { label: '⚙', kind: 'ghost', action: 'menu_open' } },
        ],
      },
    ],
  };
}

// ── 底牌区 + 牌型提示（底带中·§5.4）─────────────────────────────────────────────
function buildHeroCards(v: TableView): LayoutNode {
  return {
    type: 'Panel', id: 'c-hole', props: { glass: true },
    layout: { x: Math.round(FIELD_W / 2 - 150), y: FIELD_H - 168, width: 300, direction: 'column', align: 'center', gap: 6, padding: 10 },
    children: [
      {
        type: 'Panel', id: 'c-hole-row', props: { bare: true },
        layout: { direction: 'row', gap: 8, justify: 'center' },
        children: [cardNode('c-hole-0', v.heroHole[0] ?? null, 'lg'), cardNode('c-hole-1', v.heroHole[1] ?? null, 'lg')],
      },
      { type: 'Label', id: 'c-hole-name', props: { text: v.heroHandName || '—', font: 'serif', size: 'lg', bold: true, color: 'gold' } },
    ],
  };
}

// ── 行动条（底带右·§5.4·fold/check-call/raise + 尺度快捷）──────────────────────
function buildActionBar(v: TableView): LayoutNode {
  const callLabel = v.toCall > 0 ? `跟注 ${fmt(v.toCall)}` : '过牌';
  const quick: LayoutNode = {
    type: 'Panel', id: 'c-quick', props: { bare: true },
    layout: { direction: 'row', gap: 6, justify: 'end' },
    children: [
      { type: 'Button', id: 'c-q-half', props: { label: '½池', kind: 'quiet', action: 'act_raise', actionArg: 'half' } },
      { type: 'Button', id: 'c-q-two3', props: { label: '⅔池', kind: 'quiet', action: 'act_raise', actionArg: 'twoThird' } },
      { type: 'Button', id: 'c-q-pot', props: { label: '满池', kind: 'quiet', action: 'act_raise', actionArg: 'pot' } },
      { type: 'Button', id: 'c-q-allin', props: { label: '全下', kind: 'quiet', action: 'act_raise', actionArg: 'allin' } },
    ],
  };
  const mainRow: LayoutNode = {
    type: 'Panel', id: 'c-act-main', props: { bare: true },
    layout: { direction: 'row', gap: 8, justify: 'end', align: 'center' },
    children: [
      { type: 'Button', id: 'c-act-fold', props: { label: '弃牌', kind: 'ghost', action: 'act_fold' } },
      { type: 'Button', id: 'c-act-call', props: { label: callLabel, kind: 'primary', action: 'act_check_call' } },
      ...(v.canRaise ? [{ type: 'Button', id: 'c-act-raise', props: { label: '加注', kind: 'hero', sub: `${fmt(v.raiseValue)}`, action: 'act_raise', actionArg: 'slider' } } as LayoutNode] : []),
    ],
  };
  const children: LayoutNode[] = [quick, mainRow];
  if (v.canRaise) {
    children.push({
      type: 'Slider', id: 'c-raise-slider',
      props: { min: v.minRaise, max: v.maxRaise, value: v.raiseValue, step: 25, label: '加注额', action: 'set_raise' },
    });
  }
  return {
    type: 'Panel', id: 'c-act', props: { glass: true },
    layout: { x: FIELD_W - 372, y: FIELD_H - 176, width: 356, direction: 'column', gap: 8, padding: 12 },
    children,
  };
}

// ── 衣柜面板（点座位卡弹出·§3.5 / §5.4·左立绘区 + 右列表）───────────────────────
function buildWardrobe(w: WardrobeView): LayoutNode {
  const rows: LayoutNode[] = w.rows.map((r) => ({
    type: 'Panel', id: `c-wr-${r.id}`, props: { bare: !!r.pawned },
    layout: { direction: 'row', gap: 10, align: 'center', justify: 'between', padding: 8, opacity: r.pawned ? 0.45 : 1 },
    children: [
      {
        type: 'Panel', id: `c-wr-l-${r.id}`, props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Label', id: `c-wr-ic-${r.id}`, props: { text: ITEM_EMOJI[r.id] ?? '👗', size: 'lg' } },
          { type: 'Label', id: `c-wr-nm-${r.id}`, props: { text: r.name, size: 'md', color: r.pawned ? 'dim' : 'text' } },
        ],
      },
      {
        type: 'Panel', id: `c-wr-r-${r.id}`, props: { bare: true },
        layout: { direction: 'row', gap: 10, align: 'center' },
        children: [
          { type: 'Label', id: `c-wr-val-${r.id}`, props: { text: r.pawned ? '已典当' : `◉ ${fmt(r.value)}`, size: 'sm', color: r.pawned ? 'dim' : 'gold' } },
          ...(w.isHero && !r.pawned
            ? [{ type: 'Button', id: `c-wr-pawn-${r.id}`, props: { label: '换筹码', kind: 'primary', action: 'pawn_item', actionArg: r.id } } as LayoutNode]
            : []),
        ],
      },
    ],
  }));
  const panel: LayoutNode = {
    type: 'Panel', id: 'c-wardrobe-card', props: { title: `${w.name} · 衣柜`, accent: true },
    layout: { x: Math.round(FIELD_W / 2 - 320), y: 110, width: 640, direction: 'row', gap: 16, padding: 18 },
    children: [
      {
        // 左=立绘区（分层立绘 REQ-C-立绘换装 挂起·未产出前头像大图回退·§5.4）
        type: 'Panel', id: 'c-wr-portrait', props: { vignette: true },
        layout: { direction: 'column', align: 'center', justify: 'center', width: 200, height: 300, gap: 8, padding: 12 },
        children: [
          { type: 'Avatar', id: 'c-wr-face', props: { name: w.name, size: 120, shape: 'rounded' } },
          { type: 'Label', id: 'c-wr-face-l', props: { text: '立绘待产出', size: 'xs', color: 'dim' } },
        ],
      },
      {
        type: 'Panel', id: 'c-wr-list', props: { bare: true },
        layout: { direction: 'column', gap: 6, flex: 1 },
        children: [
          { type: 'Label', id: 'c-wr-hint', props: { text: w.isHero ? '点「换筹码」典当续命（每件一条 craft-recipe）' : '对手衣柜只读 · 件名与面值可见', size: 'xs', color: 'sub' } },
          ...rows,
          { type: 'Button', id: 'c-wr-close', props: { label: '关闭', kind: 'ghost', action: 'panel_close' } },
        ],
      },
    ],
  };
  return {
    type: 'Panel', id: 'c-wardrobe-scrim', props: { bg: { custom: 'rgba(8,4,3,0.72)' }, action: 'panel_close' },
    layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H },
    children: [panel],
  };
}

// ── 牌桌主屏（组装·绝对定位浮层·DOM 顺序=z 序：桌→牌→座→带→衣柜）────────────────
export function buildTable(v: TableView): LayoutNode {
  const feltTable: LayoutNode = {
    type: 'Panel', id: 'c-felt', props: { bg: { custom: FELT_BG }, vignette: true },
    layout: { x: 210, y: 120, width: FIELD_W - 420, height: 400, radius: 200 },
    children: [],
  };
  const potChips: LayoutNode = {
    type: 'Label', id: 'c-pot-felt',
    props: { text: `底池 ◉ ${fmt(v.pot)}`, font: 'impact', size: 'lg', color: 'gold' },
    layout: { x: Math.round(FIELD_W / 2 - 70), y: 200, width: 140 },
  };

  const opp = OPPONENT_ANCHORS.map((a) => {
    const sv = v.seats.find((s) => s.seat === a.seat)!;
    const { x, y } = anchorTopLeft(a);
    return seatCard({ ...sv, name: a.name }, x, y, SEAT_W, SEAT_H);
  });
  const hero = v.seats.find((s) => s.isHero)!;
  const heroCard = seatCard(hero, 20, FIELD_H - 168, 232, 108);

  // z 序（DOM 顺序）：桌→底池→公共牌→顶带 → 座位卡/底牌/行动条浮于顶带之上（顶带角落内容与座位不横向撞·完整可见）→ 衣柜最上。
  const children: LayoutNode[] = [
    feltTable, potChips, buildBoard(v), buildTopBar(v),
    ...opp, heroCard, buildHeroCards(v), buildActionBar(v),
  ];
  if (v.openWardrobe !== null && v.wardrobe) children.push(buildWardrobe(v.wardrobe));

  return {
    type: 'Screen', id: 'c-table', props: {},
    layout: { width: FIELD_W, height: FIELD_H },
    children,
  };
}
