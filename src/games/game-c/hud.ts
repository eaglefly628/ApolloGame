// Game C ·《六人德州》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·夜宴系主题皮）。
// 两层 1:1 律（生产总线红线·Lead 2026-07-17）：S4 结构 1:1（布局/信息层级/状态可见性照稿·素皮）；
//   本文件=S5 视觉 1:1「换正装」——字体/渐变/纹样/发光纯观感替换，**布局锚点零改动**。
// 写世界只经 action 信号；宿主 HandlerMap 消化。3D 视口（牌桌/立体筹码）=scene 层 render-only；本层 2D HUD 浮层。
// 中英切换（owner 2026-07-20）：一切用户可见文案走 strings.ts 的 t(lang,key)/fmt*（v.lang 贯穿）；**默认英语**（宿主定 lang）。
import type { LayoutNode } from '@ui/components/index.js';
import type { Card } from '@engine/protocol/components.js';
import {
  opponentAnchors, anchorTopLeft, cardFace, SEAT_W, SEAT_H, FIELD_W, FIELD_H,
} from './theme.js';
import type { GameEvent } from './game-log.js';
import {
  type Lang, type LastMove, t, fmtHand, fmtCall, fmtRaise, fmtBet, fmtBest, fmtShowdownTitle,
  fmtValue, fmtWardrobeTitle, fmtPortrait, fmtHands, fmtItems, fmtMove,
} from './strings.js';

// ── 视图数据（宿主从 M1 sim 状态纯读投影·outcome-first）─────────────────────────
export interface SeatView {
  seat: number; name: string; chips: number; committed: number; clothes: number;
  folded: boolean; allIn: boolean; out: boolean; isActor: boolean; isHero: boolean; isButton: boolean;
  lastMove?: LastMove; // 上一动作气泡（结构化·UI 层本地化文案+着色·标准德州行动史）
}
export interface WardrobeRow { id: string; name: string; value: number; pawned: boolean; }
export interface WardrobeView { seat: number; name: string; isHero: boolean; rows: WardrobeRow[]; }
export interface TableView {
  lang: Lang; // 界面语言（owner 2026-07-20 中英切换·默认 en·宿主持久）
  playerCount: number; // 入局人数 2~6（owner 2026-07-20·渲染主角 + (count-1) 对手座）
  blindLabel: string; handNo: number; pot: number;
  board: Card[]; heroHole: Card[]; heroHandName: string; // heroHandName=宿主已本地化的牌型显示名
  seats: SeatView[]; toCall: number; canRaise: boolean; minRaise: number; maxRaise: number; raiseValue: number;
  muted: boolean; openWardrobe: number | null; wardrobe?: WardrobeView;
  showLog: boolean; log: GameEvent[]; // 游戏日志（确定性事件流·查 bug·owner 2026-07-17）
  phase: 'betting' | 'showdown' | 'gameover'; // 玩法阶段（摊牌屏/局终屏叠加）
  isHeroTurn: boolean; // 轮到主角真人行动（行动条才显·否则等待提示）
  showdown?: ShowdownView; finale?: FinaleView;
}
export interface ShowdownView {
  rows: Array<{ name: string; type: string; best: Card[]; hole: Card[]; won: number; isWinner: boolean }>; // name/type=宿主已本地化
  potTotal: number;
}
export interface FinaleView { win: boolean; hands: number; heroChips: number; heroPawned: number; }

const ITEM_EMOJI: Record<string, string> = { earrings: '💎', gloves: '🧤', socks: '🧦', top: '👚', skirt: '👗', lingerie: '🎀' };
const fmt = (n: number): string => n.toLocaleString('en-US');
// 夜宴系面渐变（原型座位卡/面板底·§1 深胡桃·custom 保质感·主题特定纹样）。
const CARD_FILL = 'linear-gradient(160deg,rgba(30,20,34,0.94),rgba(14,9,18,0.96))';
const CARD_FILL_HERO = 'linear-gradient(160deg,rgba(40,26,44,0.96),rgba(16,10,22,0.97))';

// ── 语言切换段控（EN / 中·当前档 primary 高亮·发 set_lang 信号·顶栏与菜单共用）──
function langToggle(l: Lang, idp: string): LayoutNode {
  const btn = (lang: Lang, label: string): LayoutNode => ({
    type: 'Button', id: `${idp}-${lang}`, props: { label, kind: l === lang ? 'primary' : 'ghost', action: 'set_lang', actionArg: lang },
  });
  return {
    type: 'Panel', id: idp, props: { bare: true }, layout: { direction: 'row', gap: 4, align: 'center' },
    children: [btn('en', 'EN'), btn('zh', '中')],
  };
}

// ── 公共牌 / 底牌（白牌 face:light·红黑对比·§5.3 Decal3D 牌面正装）──────────────
function cardNode(id: string, c: Card | null, size: 'sm' | 'md' | 'lg', rotate?: number): LayoutNode {
  const layout = rotate ? { rotate } : {};
  if (!c) return { type: 'PlayingCard', id, props: { rank: '', suit: '♠', faceUp: false, face: 'dark', size }, layout };
  const f = cardFace(c);
  return { type: 'PlayingCard', id, props: { rank: f.rank, suit: f.suit, faceUp: true, face: 'light', size }, layout };
}

// ── 座位卡（正装：夜宴渐变底 + 状态 edge 金/翠/红 + active/allin 发光 + 读秒 + 状态气泡）────
function statusBubble(v: SeatView, l: Lang): LayoutNode | null {
  const mk = (text: string, bg: string, color: 'ok' | 'danger' | 'dim' | 'gold' | 'sub'): LayoutNode => ({
    type: 'Panel', id: `c-bub-${v.seat}`, props: { bg: { custom: bg } },
    layout: { direction: 'row', justify: 'center', padding: 3, radius: 12 },
    children: [{ type: 'Label', id: `c-bub-t-${v.seat}`, props: { text, size: 'xs', bold: true, color } }],
  });
  if (v.out) return mk(t(l, 'bubble.out'), 'rgba(80,80,88,0.3)', 'dim');
  if (v.folded) return mk(t(l, 'bubble.fold'), 'rgba(120,120,130,0.2)', 'dim');
  if (v.allIn) return mk(t(l, 'bubble.allin'), 'linear-gradient(90deg,rgba(200,53,43,0.9),rgba(192,57,43,0.9))', 'gold');
  if (v.isActor) return mk(t(l, 'bubble.thinking'), 'rgba(127,214,176,0.15)', 'ok');
  // 行动气泡：上一动作（跟注/过牌/加注·标准德州行动史·让玩家看清各家做了什么）。
  if (v.lastMove) {
    const { text, isRaise } = fmtMove(l, v.lastMove);
    return mk(text, isRaise ? 'rgba(224,180,88,0.2)' : 'rgba(40,30,44,0.75)', isRaise ? 'gold' : 'sub');
  }
  return null;
}

function seatCard(v: SeatView, x: number, y: number, w: number, h: number, l: Lang): LayoutNode {
  const edge = v.allIn ? 'danger' : v.isActor ? 'jade' : v.out || v.folded ? undefined : 'gold';
  const fx = v.isActor ? [{ kind: 'glow' as const, color: 'jade' as const }] : v.allIn ? [{ kind: 'glow' as const, color: 'danger' as const }] : undefined;
  const bub = statusBubble(v, l);

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
      { type: 'Tag', id: `c-tag-${v.seat}`, props: { label: v.isHero ? t(l, 'seat.you') : t(l, 'seat.opp'), tone: v.isHero ? 'normal' : 'accent', size: 'sm' } },
      { type: 'Label', id: `c-cloth-${v.seat}`, props: { text: `👗 ${v.clothes}`, size: 'sm', color: 'sub' } },
      ...(v.committed > 0 ? [{ type: 'Label', id: `c-bet-${v.seat}`, props: { text: fmtBet(l, v.committed), size: 'sm', color: 'gold' } } as LayoutNode] : []),
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

// ── 顶带（SB 徽章 + 盲注 impact + POT 金发光大字 + 语言段控 + ⚙♪）──────────────────
function buildTopBar(v: TableView): LayoutNode {
  const l = v.lang;
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
              { type: 'Label', id: 'c-blind-v', props: { text: `${t(l, 'top.blind')} ${v.blindLabel}`, font: 'impact', size: 20, color: 'text' } },
              { type: 'Label', id: 'c-hand-n', props: { text: fmtHand(l, v.handNo), size: 'xs', color: 'dim' } },
            ],
          },
        ],
      },
      {
        type: 'Panel', id: 'c-pot', props: { bare: true },
        layout: { direction: 'column', align: 'center', gap: 0 },
        children: [
          { type: 'Label', id: 'c-pot-l', props: { text: t(l, 'top.pot'), font: 'mono', size: 'xs', color: 'warn' } },
          { type: 'Label', id: 'c-pot-v', props: { text: `◉ ${fmt(v.pot)}`, font: 'impact', size: 44, color: 'gold', glow: true } },
        ],
      },
      {
        type: 'Panel', id: 'c-menu', props: { bare: true }, layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          langToggle(l, 'c-lang'),
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
        children: [{ type: 'Label', id: 'c-hole-name', props: { text: fmtBest(v.lang, v.heroHandName), font: 'serif', size: 'sm', bold: true, color: 'gold' } }],
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
  const l = v.lang;
  const callMain = v.toCall > 0 ? fmtCall(l, v.toCall) : t(l, 'act.check');
  const main: LayoutNode = {
    type: 'Panel', id: 'c-act-main', props: { bare: true },
    layout: { direction: 'row', gap: 9, align: 'stretch' },
    children: [
      bigBtn('c-act-fold', t(l, 'act.fold'), 'FOLD', 'blood', 'text', 'act_fold', undefined, 1),
      bigBtn('c-act-call', callMain, v.toCall > 0 ? 'CALL' : 'CHECK', 'jade-sheen', 'text', 'act_check_call', undefined, 1.2),
      ...(v.canRaise ? [bigBtn('c-act-raise', fmtRaise(l, v.raiseValue), 'RAISE', 'gold-sheen', 'ink', 'act_raise', 'slider', 1.2)] : []),
    ],
  };
  const quick: LayoutNode = {
    type: 'Panel', id: 'c-quick', props: { bare: true },
    layout: { direction: 'row', gap: 6, justify: 'end' },
    children: [
      { type: 'Button', id: 'c-q-half', props: { label: t(l, 'quick.half'), kind: 'quiet', action: 'act_raise', actionArg: 'half' } },
      { type: 'Button', id: 'c-q-two3', props: { label: t(l, 'quick.two3'), kind: 'quiet', action: 'act_raise', actionArg: 'twoThird' } },
      { type: 'Button', id: 'c-q-pot', props: { label: t(l, 'quick.pot'), kind: 'quiet', action: 'act_raise', actionArg: 'pot' } },
      { type: 'Button', id: 'c-q-allin', props: { label: t(l, 'quick.allin'), kind: 'quiet', action: 'act_raise', actionArg: 'allin' } },
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
function buildWardrobe(w: WardrobeView, l: Lang): LayoutNode {
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
              { type: 'Label', id: `c-wr-st-${r.id}`, props: { text: r.pawned ? t(l, 'wr.pawnedState') : t(l, 'wr.wornState'), size: 'xs', color: r.pawned ? 'dim' : 'sub' } },
            ],
          },
        ],
      },
      {
        type: 'Panel', id: `c-wr-r-${r.id}`, props: { bare: true }, layout: { direction: 'row', gap: 12, align: 'center' },
        children: [
          { type: 'Label', id: `c-wr-val-${r.id}`, props: { text: r.pawned ? t(l, 'wr.pawnedVal') : fmtValue(l, r.value), font: r.pawned ? 'ui' : 'impact', size: r.pawned ? 'sm' : 20, color: r.pawned ? 'dim' : 'gold' } },
          ...(w.isHero && !r.pawned
            ? [{ type: 'Panel', id: `c-wr-pawn-${r.id}`, props: { bg: 'gold-sheen' as never, action: 'pawn_item', actionArg: r.id }, layout: { padding: 9, radius: 9, justify: 'center' }, children: [{ type: 'Label', id: `c-wr-pawn-t-${r.id}`, props: { text: t(l, 'wr.cashIn'), font: 'impact', size: 'sm', color: 'ink' } }] } as LayoutNode]
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
              { type: 'Label', id: 'c-wr-face-l', props: { text: fmtPortrait(l, w.name), font: 'impact', size: 26, color: 'gold' } },
              { type: 'Label', id: 'c-wr-face-s', props: { text: t(l, 'wr.portraitSub'), size: 'xs', color: 'dim' } },
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
                  { type: 'Label', id: 'c-wr-title', props: { text: fmtWardrobeTitle(l, w.name), font: 'impact', size: 30, color: 'text' } },
                  { type: 'Label', id: 'c-wr-mode', props: { text: w.isHero ? t(l, 'wr.modeHero') : t(l, 'wr.modeOpp'), size: 'xs', color: 'dim' } },
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

// ── 主菜单屏 SC-1（对齐 texas-main-menu 稿·左立绘 + 右标题按钮 + 左下角色卡 + 右上语言段控）──────────────
export interface MenuView { lang: Lang; playerCount: number; playerName: string; playerChips: number; blindLabel: string; }
// 入局人数段控（2~6·当前档金 primary·发 set_players·owner 2026-07-20·默认 6）。
function playerCountSel(m: MenuView): LayoutNode {
  return {
    type: 'Panel', id: 'c-menu-players', props: { bare: true },
    layout: { direction: 'row', gap: 6, align: 'center', justify: 'end' },
    children: [
      { type: 'Label', id: 'c-menu-players-l', props: { text: t(m.lang, 'menu.players'), size: 'sm', color: 'sub' } },
      ...[2, 3, 4, 5, 6].map((n): LayoutNode => ({
        type: 'Button', id: `c-menu-players-${n}`,
        props: { label: String(n), kind: m.playerCount === n ? 'primary' : 'ghost', action: 'set_players', actionArg: String(n) },
      })),
    ],
  };
}
export function buildMenu(m: MenuView): LayoutNode {
  const l = m.lang;
  const portrait: LayoutNode = {
    type: 'Panel', id: 'c-menu-portrait', props: { bare: true, dashed: true, edge: 'gold' },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 12, padding: 22, width: 300, height: 440, radius: 12 },
    children: [
      { type: 'Label', id: 'c-menu-p-badge', props: { text: 'C-CHAR-HERO', font: 'mono', size: 'xs', color: 'warn' } },
      { type: 'Avatar', id: 'c-menu-p-face', props: { name: m.playerName.slice(0, 1), size: 96, shape: 'rounded' } },
      { type: 'Label', id: 'c-menu-p-title', props: { text: t(l, 'menu.portraitTitle'), font: 'impact', size: 26, color: 'gold' } },
      { type: 'Label', id: 'c-menu-p-size', props: { text: t(l, 'menu.portraitSize'), size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'c-menu-p-anchor', props: { text: t(l, 'menu.portraitAnchor'), size: 'xs', color: 'dim' } },
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
          { type: 'Label', id: 'c-menu-t1', props: { text: t(l, 'menu.titleA'), font: 'serif', size: 72, bold: true, color: 'text' } },
          { type: 'Label', id: 'c-menu-t2', props: { text: t(l, 'menu.titleB'), font: 'serif', size: 72, bold: true, color: 'danger' } },
        ],
      },
      { type: 'Label', id: 'c-menu-sub', props: { text: t(l, 'menu.subtitle'), size: 'md', color: 'sub' } },
      {
        type: 'Panel', id: 'c-menu-blind', props: { bg: { custom: 'linear-gradient(160deg,#c0392b,#7a1420)' }, edge: 'gold' },
        layout: { direction: 'row', gap: 8, align: 'center', padding: 7, radius: 8 },
        children: [
          { type: 'Label', id: 'c-menu-blind-l', props: { text: t(l, 'menu.blindLabel'), size: 'xs', color: 'gold' } },
          { type: 'Label', id: 'c-menu-blind-v', props: { text: m.blindLabel, font: 'impact', size: 18, color: 'gold' } },
        ],
      },
      {
        type: 'Panel', id: 'c-menu-redpack', props: { bg: { custom: 'linear-gradient(90deg,rgba(224,180,88,0.2),rgba(200,53,43,0.15))' }, edge: 'warn' },
        layout: { direction: 'row', justify: 'center', padding: 6, radius: 16 },
        children: [{ type: 'Label', id: 'c-menu-rp-t', props: { text: t(l, 'menu.redpack'), size: 'sm', color: 'gold' } }],
      },
      playerCountSel(m),
      { type: 'Button', id: 'c-menu-start', props: { label: t(l, 'menu.start'), kind: 'hero', action: 'start_game' }, layout: { width: 280 } },
      { type: 'Button', id: 'c-menu-continue', props: { label: t(l, 'menu.continue'), kind: 'ghost', action: 'continue_game' }, layout: { width: 280 } },
      { type: 'Button', id: 'c-menu-settings', props: { label: t(l, 'menu.settings'), kind: 'ghost', action: 'menu_open' }, layout: { width: 280 } },
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
      { type: 'Panel', id: 'c-menu-lang', props: { bare: true }, layout: { x: FIELD_W - 150, y: 24, width: 120, direction: 'row', justify: 'end' }, children: [langToggle(l, 'c-menu-lang-seg')] },
      { type: 'Label', id: 'c-menu-ver', props: { text: t(l, 'menu.version'), font: 'mono', size: 'xs', color: 'dim' }, layout: { x: FIELD_W - 200, y: FIELD_H - 40, width: 180 } },
    ],
  };
}

// ── 游戏日志面板（owner 2026-07-17 查 bug·确定性事件流·右侧可开关滚动）──────────────
const LOG_TAG_COLOR: Record<GameEvent['tag'], 'sub' | 'text' | 'gold' | 'warn' | 'ok'> = {
  deal: 'ok', blind: 'sub', action: 'text', street: 'gold', showdown: 'gold', pawn: 'warn', info: 'ok',
};
function buildLogPanel(log: GameEvent[], l: Lang): LayoutNode {
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
          { type: 'Label', id: 'c-log-title', props: { text: t(l, 'log.title'), font: 'impact', size: 18, color: 'gold' } },
          { type: 'Button', id: 'c-log-close', props: { label: '✕', kind: 'ghost', action: 'toggle_log' } },
        ],
      },
      { type: 'Label', id: 'c-log-seed', props: { text: t(l, 'log.seed'), size: 'xs', color: 'dim' } },
      { type: 'Divider', id: 'c-log-div', props: {} },
      { type: 'Panel', id: 'c-log-rows', props: { bare: true, scroll: true }, layout: { direction: 'column', gap: 5, flex: 1 }, children: rows },
    ],
  };
}

// ── 公共牌（桌心·2D HUD 浮层·盖在 3D 呢面桌心之上·让玩家看清·真贴图 S6）──────────────────
function buildCommunity(community: Card[]): LayoutNode {
  const slots: LayoutNode[] = [];
  for (let i = 0; i < 5; i++) slots.push(cardNode(`c-comm-${i}`, community[i] ?? null, 'md'));
  return {
    type: 'Panel', id: 'c-community', props: { bare: true },
    layout: { x: Math.round(FIELD_W / 2 - 175), y: 300, width: 350, direction: 'row', gap: 7, justify: 'center' },
    children: slots,
  };
}

// ── 等待提示（非主角轮·行动条位置显「等待…」）─────────────────────────────────
function buildWaiting(l: Lang): LayoutNode {
  return {
    type: 'Panel', id: 'c-waiting', props: { glass: true },
    layout: { x: FIELD_W - 372, y: FIELD_H - 96, width: 356, direction: 'row', justify: 'center', align: 'center', padding: 16, radius: 11 },
    children: [{ type: 'Label', id: 'c-waiting-t', props: { text: t(l, 'waiting'), size: 'md', color: 'sub' } }],
  };
}

// ── 摊牌屏（owner 2026-07-18 重设计·防 5~6 人 freeze）：定高卡=顶公共牌 + 中滚动各家最优五张组合 + 底确认键常驻 ─
//   旧版列高随人数长、y 固定 → 6 人时确认键掉出 720 视口按不到=freeze。今：卡定高、组合列 scroll:flex1、确认键钉底永远可点。
//   name/type=宿主已本地化（座位名 + 牌型名·随 lang）。
function buildShowdown(sd: ShowdownView, board: Card[], l: Lang): LayoutNode {
  // 顶：公共牌板（共享底牌·5 张 md·金边突出）
  const boardRow: LayoutNode = {
    type: 'Panel', id: 'c-sd-board', props: { bg: { custom: 'rgba(224,180,88,0.08)' }, edge: 'gold' },
    layout: { direction: 'column', align: 'center', gap: 6, padding: 10, radius: 12 },
    children: [
      { type: 'Label', id: 'c-sd-board-l', props: { text: t(l, 'sd.community'), font: 'mono', size: 'xs', color: 'warn' } },
      {
        type: 'Panel', id: 'c-sd-board-row', props: { bare: true },
        layout: { direction: 'row', gap: 7, justify: 'center' },
        children: Array.from({ length: 5 }, (_, i) => cardNode(`c-sd-board-${i}`, board[i] ?? null, 'md')),
      },
    ],
  };
  // 中：各家最优五张组合（依次排开·赢家金边高亮·可滚动·左名右分池）
  const rows: LayoutNode[] = sd.rows.map((r, i) => {
    const combo: LayoutNode[] = r.best.length
      ? r.best.map((c, k) => cardNode(`c-sd-best-${i}-${k}`, c, 'sm'))
      : [{ type: 'Label', id: `c-sd-muck-${i}`, props: { text: t(l, 'sd.muck'), size: 'sm', color: 'dim' } } as LayoutNode];
    return {
      type: 'Panel', id: `c-sd-row-${i}`, props: { bg: { custom: r.isWinner ? 'rgba(224,180,88,0.14)' : 'rgba(30,22,26,0.5)' }, edge: r.isWinner ? 'gold' : undefined },
      layout: { direction: 'row', align: 'center', gap: 10, padding: 9, radius: 10, opacity: r.isWinner ? 1 : 0.85 },
      children: [
        {
          type: 'Panel', id: `c-sd-nm-col-${i}`, props: { bare: true }, layout: { direction: 'column', gap: 2, width: 132 },
          children: [
            {
              type: 'Panel', id: `c-sd-nm-row-${i}`, props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' },
              children: [
                { type: 'Label', id: `c-sd-crown-${i}`, props: { text: r.isWinner ? '🏆' : `#${i + 1}`, size: 'sm', color: r.isWinner ? 'gold' : 'dim' } },
                { type: 'Label', id: `c-sd-nm-${i}`, props: { text: r.name, font: 'serif', size: 'md', bold: r.isWinner, color: r.isWinner ? 'gold' : 'text' } },
              ],
            },
            { type: 'Label', id: `c-sd-ty-${i}`, props: { text: r.type, size: 'xs', color: r.isWinner ? 'gold' : 'sub' } },
          ],
        },
        { type: 'Panel', id: `c-sd-combo-${i}`, props: { bare: true }, layout: { direction: 'row', gap: 4, justify: 'center', flex: 1 }, children: combo },
        { type: 'Label', id: `c-sd-won-${i}`, props: { text: r.won > 0 ? `+${fmt(r.won)}` : '—', font: 'impact', size: r.isWinner ? 22 : 16, color: r.won > 0 ? 'gold' : 'dim' } },
      ],
    };
  });
  const card: LayoutNode = {
    type: 'Panel', id: 'c-sd-card', props: { bg: { custom: 'linear-gradient(160deg,rgba(34,22,38,0.98),rgba(14,9,18,0.99))' }, edge: 'gold', accent: true },
    layout: { x: Math.round(FIELD_W / 2 - 340), y: 40, width: 680, height: 640, direction: 'column', align: 'stretch', gap: 12, padding: 22, radius: 16 },
    children: [
      { type: 'Label', id: 'c-sd-title', props: { text: fmtShowdownTitle(l, sd.potTotal), font: 'impact', size: 26, color: 'gold', glow: true } },
      boardRow,
      { type: 'Divider', id: 'c-sd-div', props: {} },
      { type: 'Panel', id: 'c-sd-rows', props: { bare: true, scroll: true }, layout: { direction: 'column', gap: 8, flex: 1 }, children: rows },
      { type: 'Button', id: 'c-sd-next', props: { label: t(l, 'sd.next'), kind: 'hero', action: 'continue_showdown' }, layout: { width: 300 } },
    ],
  };
  return { type: 'Panel', id: 'c-sd-scrim', props: { bg: { custom: 'rgba(4,2,8,0.72)' } }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H }, children: [card] };
}

// ── 局终屏（胜=通吃满堂 / 负=输得精光 + 战绩 + 再来一局/回大厅·§5.4 E 画板）─────────────
function buildFinale(f: FinaleView, l: Lang): LayoutNode {
  const stat = (id: string, label: string, val: string): LayoutNode => ({
    type: 'Panel', id, props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'center', padding: 4 },
    children: [
      { type: 'Label', id: `${id}-l`, props: { text: label, size: 'sm', color: 'sub' } },
      { type: 'Label', id: `${id}-v`, props: { text: val, font: 'impact', size: 22, color: 'gold' } },
    ],
  });
  const card: LayoutNode = {
    type: 'Panel', id: 'c-fin-card', props: { bg: { custom: f.win ? 'linear-gradient(160deg,#2a1e0e,#160f0b)' : 'linear-gradient(160deg,#2a0f11,#160b0c)' }, edge: f.win ? 'gold' : 'danger', accent: true },
    layout: { x: Math.round(FIELD_W / 2 - 260), y: 150, width: 520, direction: 'column', align: 'center', gap: 16, padding: 30, radius: 16 },
    children: [
      { type: 'Label', id: 'c-fin-sub', props: { text: f.win ? t(l, 'fin.winSub') : t(l, 'fin.loseSub'), font: 'impact', size: 20, color: f.win ? 'gold' : 'danger' } },
      { type: 'Label', id: 'c-fin-title', props: { text: f.win ? t(l, 'fin.winTitle') : t(l, 'fin.loseTitle'), font: 'serif', size: 52, bold: true, color: f.win ? 'gold' : 'danger', glow: true } },
      { type: 'Label', id: 'c-fin-flavor', props: { text: f.win ? t(l, 'fin.winFlavor') : t(l, 'fin.loseFlavor'), size: 'sm', color: 'sub' } },
      {
        type: 'Panel', id: 'c-fin-stats', props: { bg: { custom: 'rgba(0,0,0,0.28)' } }, layout: { direction: 'column', gap: 6, padding: 14, radius: 10, width: 360 },
        children: [
          stat('c-fin-hands', t(l, 'fin.hands'), fmtHands(l, f.hands)),
          stat('c-fin-chips', t(l, 'fin.chips'), fmt(f.heroChips)),
          stat('c-fin-pawn', t(l, 'fin.pawned'), fmtItems(l, f.heroPawned)),
        ],
      },
      {
        type: 'Panel', id: 'c-fin-btns', props: { bare: true }, layout: { direction: 'row', gap: 12, justify: 'center' },
        children: [
          { type: 'Button', id: 'c-fin-again', props: { label: t(l, 'fin.again'), kind: 'hero', action: 'restart' }, layout: { width: 180 } },
          { type: 'Button', id: 'c-fin-exit', props: { label: t(l, 'fin.exit'), kind: 'ghost', action: 'back_menu' }, layout: { width: 150 } },
        ],
      },
    ],
  };
  return { type: 'Panel', id: 'c-fin-scrim', props: { bg: { custom: 'rgba(4,2,8,0.82)' } }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H }, children: [card] };
}

// ── 牌桌主屏（纯 2D LayoutNode·owner 2026-07-18 转 2D：大牌桌 + 顶带 + 公共牌 + 座位·文案随 v.lang）──
export function buildTable(v: TableView): LayoutNode {
  const l = v.lang;
  // 对手座：按入局人数取锚点（6=手工布局·<6=上弧均布）；只渲染真在场的对手（座 1..count-1）。
  const opp = opponentAnchors(v.playerCount).map((a) => {
    const sv = v.seats.find((s) => s.seat === a.seat)!;
    const { x, y } = anchorTopLeft(a);
    return seatCard({ ...sv, name: l === 'en' ? a.nameEn : a.name }, x, y, SEAT_W, SEAT_H, l);
  });
  const hero = v.seats.find((s) => s.isHero)!;
  const heroCard = seatCard(hero, 20, FIELD_H - 168, 236, 108, l);

  // z 序（DOM 顺序·2D HUD 层·透明区透出 scene 层 3D 牌桌+物理筹码）：顶带 → 公共牌 → 座位卡/底牌 → 行动条/等待 → 日志/衣柜 → 摊牌/局终最上。
  const children: LayoutNode[] = [
    buildTopBar(v), buildCommunity(v.board), ...opp, heroCard, buildHeroCards(v),
  ];
  if (v.phase === 'betting') children.push(v.isHeroTurn ? buildActionBar(v) : buildWaiting(l));
  if (v.showLog) children.push(buildLogPanel(v.log, l));
  if (v.openWardrobe !== null && v.wardrobe) children.push(buildWardrobe(v.wardrobe, l));
  if (v.phase === 'showdown' && v.showdown) children.push(buildShowdown(v.showdown, v.board, l));
  if (v.phase === 'gameover' && v.finale) children.push(buildFinale(v.finale, l));

  // Screen bg transparent → 露出 scene 层夜宴厅暗背景（ROOM_BG）；2D 大牌桌=scene 层 3D。
  return { type: 'Screen', id: 'c-table', props: { bg: 'transparent' }, layout: { width: FIELD_W, height: FIELD_H }, children };
}
