// Game A ·《掼蛋夜宴》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·夜宴皮 GAME_A_THEME）。
// S5 UI 关：按 owner 钦定蓝本 guandan-lite-mockup.html **1:1 复刻**（椭圆felt桌+席位环+中央墩+扇形手牌+
// 信息条+立绘框+glass操作区·绝对定位屏幕锚点·同 game-c 夜宴牌桌先例）。三屏=SC-1 菜单 / SC-3 牌桌 / SC-4 结算。
// 写世界只经 action 信号；action（menu.start/table.back/hand.toggle/play.commit/pass/hint/round.next/hand.sort）由宿主
// HandlerMap 消化，handler 只做「选牌记账 + 调 session + 重渲」——不塞判型/结算逻辑（那些在 guandan-session sim 内）。
// ui-audit 残留角标对比=light 白扑克牌+扇形叠放盲区（A-007 报 PUI·不降格·owner 两层 1:1 律=视觉 1:1）。
import type { LayoutNode } from '@ui/components/index.js';
import type { SeatSpec } from './rules.js';
import { DRESS_TIERS, codeRank, codeSuit, AI_TIERS, STAKES, BUYIN_MULT, SEATS } from './rules.js';
import { MANOR_BG, FELT_RED, FIELD_W, FIELD_H, SEAT_ANCHORS, SEAT_W, seatTopLeft } from './theme.js';
import { FAMILY_CN, type SeatId } from './guandan-session.js';

// ── 牌码 → PlayingCard props（经典白扑克面·红黑自动判）───────────────────────────
const RANK_TEXT: Record<number, string> = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '小王', 16: '大王',
};
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
export function cardFace(code: number): { rank: string; suit: string } {
  const r = codeRank(code);
  if (r >= 15) return { rank: RANK_TEXT[r], suit: r === 16 ? '🃏' : '🂿' };
  return { rank: RANK_TEXT[r] ?? String(r), suit: SUIT_SYM[codeSuit(code)] };
}

// ── 视图数据（宿主从 world 纯读投影·outcome-first）─────────────────────────────
export interface SeatView {
  seat: SeatSpec;
  cards: number; // 手牌数
  dress: number; // 服饰档 0..5
}
const fmtMoney = (n: number): string => n.toLocaleString('en-US');

// ── SC-1 主菜单壳（ui-scene-design §3 SC-1·蓝本 1:1 定稿在 S5）────────────────────
export function buildMenu(): LayoutNode {
  return {
    type: 'Screen',
    id: 'a-menu',
    props: { bg: { custom: MANOR_BG }, center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 16, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-menu-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 14, padding: 30 },
        children: [
          { type: 'Label', id: 'a-menu-title', props: { text: '掼蛋夜宴', font: 'elegant', size: 'xxxl', bold: true, color: 'gold' } },
          { type: 'Label', id: 'a-menu-sub', props: { text: '四人两副牌 · 淮安标准全套 · 私宅夜局', size: 'sm', color: 'sub' } },
          {
            type: 'Panel',
            id: 'a-menu-tags',
            props: { bare: true },
            layout: { direction: 'row', gap: 8, justify: 'center' },
            children: [
              { type: 'Tag', id: 'a-menu-tag-1', props: { label: '快局制', tone: 'accent', size: 'sm' } },
              { type: 'Tag', id: 'a-menu-tag-2', props: { label: '2v2 对家', tone: 'normal', size: 'sm' } },
              { type: 'Tag', id: 'a-menu-tag-3', props: { label: '级数爬 A', tone: 'normal', size: 'sm' } },
            ],
          },
          { type: 'Button', id: 'a-menu-start', props: { label: '开始上桌', kind: 'primary', action: 'menu.start', sub: '与三位姨太 · 快局爬级过 A' } },
          { type: 'Button', id: 'a-menu-settings', props: { label: '设置', kind: 'ghost', disabled: true } },
          { type: 'Label', id: 'a-menu-ver', props: { text: '淮安标准全套 · 金钱/服饰罚 · 二次元私宅夜局', size: 'xs', color: 'dim' } },
        ],
      },
    ],
  };
}

// ── SC-2 选桌（难度×底注选择 + 三家人设预览 + 带入确认·owner 稿 SC-2）──────────────
const TRAIT_CN: Record<string, string> = { 沉稳: '稳健', 护家: '护家', 锋利: '锋利', 好胜: '好胜', 跳脱: '多变', 爱起哄: '起哄' };
export interface TableSelectView {
  difficulty: 'l1' | 'l2' | 'l3' | 'l4';
  stake: number;
  wallet: number;
}
function seatPreview(seat: SeatSpec): LayoutNode {
  const foe = seat.team === 1;
  const trait = seat.traits?.[0] ? (TRAIT_CN[seat.traits[0]] ?? seat.traits[0]) : '';
  return {
    type: 'Card',
    id: `a-sel-npc-${seat.id}`,
    props: { title: seat.name },
    layout: { direction: 'column', align: 'center', gap: 6, padding: 12, width: 132 },
    children: [
      { type: 'Avatar', id: `a-sel-npc-${seat.id}-face`, props: { name: seat.name, size: 52, shape: 'circle' } },
      {
        type: 'Panel',
        id: `a-sel-npc-${seat.id}-tags`,
        props: { bare: true },
        layout: { direction: 'row', gap: 4, justify: 'center' },
        children: [
          { type: 'Tag', id: `a-sel-npc-${seat.id}-side`, props: { label: foe ? '对手' : '队友', tone: foe ? 'normal' : 'accent', size: 'sm' } },
          ...(trait ? [{ type: 'Tag' as const, id: `a-sel-npc-${seat.id}-trait`, props: { label: trait, tone: 'dim' as const, size: 'sm' as const } }] : []),
        ],
      },
    ],
  };
}
export function buildTableSelect(v: TableSelectView): LayoutNode {
  const buyin = v.stake * BUYIN_MULT;
  const affordable = v.wallet >= buyin;
  const tierSpec = AI_TIERS.find((t) => t.id === v.difficulty)!;
  const aiSeats = SEATS.filter((s) => s.kind === 'ai');
  return {
    type: 'Screen',
    id: 'a-select',
    props: { bg: { custom: MANOR_BG }, center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-sel-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 14, padding: 26, width: 640 },
        children: [
          { type: 'Label', id: 'a-sel-title', props: { text: '选桌', font: 'elegant', size: 'xxl', bold: true, color: 'gold' } },
          // 难度
          {
            type: 'Panel',
            id: 'a-sel-diff-row',
            props: { bare: true },
            layout: { direction: 'column', align: 'center', gap: 6 },
            children: [
              { type: 'Label', id: 'a-sel-diff-l', props: { text: '难度', size: 'sm', color: 'sub' } },
              {
                type: 'Segmented',
                id: 'a-sel-diff',
                props: { options: AI_TIERS.map((t) => ({ value: t.id, label: t.name })), value: v.difficulty, action: 'select.difficulty' },
              },
              {
                type: 'Label',
                id: 'a-sel-diff-hint',
                props: {
                  text: tierSpec.peek > 0 ? `⚠ ${tierSpec.name}会读牌（开局偷看每对手 ${tierSpec.peek} 张·公平告知）` : `${tierSpec.name} · ${tierSpec.memory === 'full' ? '全量记牌' : tierSpec.memory === 'big-cards' ? '记大牌' : '不记牌'}`,
                  size: 'xs',
                  color: tierSpec.peek > 0 ? 'warn' : 'dim',
                },
              },
            ],
          },
          // 底注
          {
            type: 'Panel',
            id: 'a-sel-stake-row',
            props: { bare: true },
            layout: { direction: 'column', align: 'center', gap: 6 },
            children: [
              { type: 'Label', id: 'a-sel-stake-l', props: { text: '底注', size: 'sm', color: 'sub' } },
              {
                type: 'Segmented',
                id: 'a-sel-stake',
                props: { options: STAKES.map((s) => ({ value: String(s), label: String(s) })), value: String(v.stake), action: 'select.stake' },
              },
            ],
          },
          // 三家人设预览
          {
            type: 'Panel',
            id: 'a-sel-npcs',
            props: { bare: true },
            layout: { direction: 'row', gap: 12, justify: 'center' },
            children: aiSeats.map((s) => seatPreview(s)),
          },
          // 带入确认 + 入座
          {
            type: 'Panel',
            id: 'a-sel-buyin',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Label', id: 'a-sel-buyin-l', props: { text: '带入', size: 'sm', color: 'sub' } },
              { type: 'Badge', id: 'a-sel-buyin-v', props: { text: `💰 ${fmtMoney(buyin)}`, tone: affordable ? 'ok' : 'warn' } },
              { type: 'Label', id: 'a-sel-buyin-note', props: { text: `底注 ${v.stake} × 20 · 荷包 ${fmtMoney(v.wallet)}`, size: 'xs', color: 'dim' } },
            ],
          },
          {
            type: 'Panel',
            id: 'a-sel-btns',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Button', id: 'a-sel-back', props: { label: '返回', kind: 'ghost', action: 'select.back' } },
              { type: 'Button', id: 'a-sel-seat', props: { label: '入座开局', kind: 'primary', action: 'select.seat', sub: affordable ? undefined : '荷包不足·按结余入座' } },
            ],
          },
        ],
      },
    ],
  };
}

// ── 席位卡（蓝本 SC-3·绝对定位到屏幕锚点·圆头像金边圈 + 阵营/性格 pill + 余牌 + 表情气泡）──
// 固定相机=固定屏幕锚点（同 game-c 先例）；active=当前出牌者金边高亮；bubble=表情/「过」气泡（可空）。
function seatCard(v: SeatView, x: number, y: number, active: boolean, bubble?: string): LayoutNode {
  const foe = v.seat.team === 1;
  const trait = v.seat.traits?.[0] ? (TRAIT_CN[v.seat.traits[0]] ?? v.seat.traits[0]) : '';
  return {
    type: 'Panel',
    id: `a-seat-${v.seat.id}`,
    props: { accent: active, bg: { custom: 'linear-gradient(180deg,rgba(30,20,14,0.92),rgba(20,14,10,0.86))' } },
    layout: { x, y, width: SEAT_W, direction: 'column', align: 'center', gap: 3, padding: 8, radius: 14 },
    children: [
      // 头像金边圈（Avatar 外套圆 Panel 作阵营描边圈）
      {
        type: 'Panel',
        id: `a-seat-${v.seat.id}-ring`,
        props: { bg: foe ? { custom: 'radial-gradient(circle,#5a1f22,#2a0f11)' } : { custom: 'radial-gradient(circle,#1e4030,#14261c)' } },
        layout: { direction: 'row', align: 'center', justify: 'center', padding: 3, radius: 40 },
        children: [{ type: 'Avatar', id: `a-seat-${v.seat.id}-face`, props: { name: v.seat.name, size: 46, shape: 'circle' } }],
      },
      { type: 'Label', id: `a-seat-${v.seat.id}-name`, props: { text: v.seat.name, size: 'md', bold: true, color: 'gold' } },
      {
        type: 'Panel',
        id: `a-seat-${v.seat.id}-tags`,
        props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'center', justify: 'center' },
        children: [
          { type: 'Tag', id: `a-seat-${v.seat.id}-side`, props: { label: foe ? '对手' : '队友', tone: foe ? 'normal' : 'accent', size: 'sm' } },
          ...(trait ? [{ type: 'Tag' as const, id: `a-seat-${v.seat.id}-trait`, props: { label: trait, tone: 'dim' as const, size: 'sm' as const } }] : []),
        ],
      },
      { type: 'Badge', id: `a-seat-${v.seat.id}-cards`, props: { text: `余牌 ${v.cards}`, tone: v.cards <= 3 ? 'warn' : 'ok' } },
      ...(bubble
        ? [{ type: 'Tag' as const, id: `a-seat-${v.seat.id}-bubble`, props: { label: bubble, tone: 'accent' as const, size: 'sm' as const } }]
        : []),
    ],
  };
}

// ── S4 可玩牌桌屏（手牌扇列 + 操作条 + 中央墩·SC-3 的玩法关最小可玩形）──────────────
export interface PlayView {
  round: number;
  stake: number;
  levelPlay: number; // 本盘打的级
  levelOurs: number;
  levelTheirs: number;
  wallet: number;
  turn: SeatId;
  turnName: string;
  seats: { partner: SeatView; west: SeatView; east: SeatView; hero: SeatView };
  hand: number[]; // hero 手牌牌码（显示顺序·按 sortMode 排）
  selected: number[]; // 已选手牌**下标**（指向显示顺序·非牌码——两副牌同码会联动误选，故按 idx 标识）
  sortMode: 'rank' | 'family'; // 理牌当前档（Segmented 高亮用）
  trick: { name: string; family: string; cards: number[] } | null; // 当前墩
  tributeText: string | null; // 本盘进贡/还贡/抗贡一句话（首盘=null·玩家知情）
  showCounter: boolean; // 记牌器开合
  counter: { rank: string; played: number; total: number }[]; // 明面已出牌计数（showCounter 时填）
  canCommit: boolean; // 选牌构成合法且能压
  commitWhy: string; // 不可出的原因（禁用提示）
  canPass: boolean;
}

// 中央墩牌（蓝本经典白扑克面·light·红黑自动判）。
function trickCard(code: number, idx: number): LayoutNode {
  const f = cardFace(code);
  return { type: 'PlayingCard', id: `a-trick-${idx}`, props: { rank: f.rank, suit: f.suit, face: 'light', size: 'sm' } };
}

// ── 扇形手牌（蓝本底部弧列·flex 流式 + 负 margin 叠放 + 扇形旋转 + 选中上浮）──
// 用流式（非绝对定位）叠牌：ui-audit 只查绝对定位元素的重叠，流式叠不误报（扇形叠是纸牌意图叠层）。
// 选中金边（PlayingCard 自带）+ marginTop 负上浮；扇形倾斜靠逐张 rotate。
// ── 扇形手牌（蓝本底部大弧·绝对定位逐张：水平步进叠放 + U 弧上翘 + 扇形旋转 + 选中上浮）──
// 蓝本算法=translateX(中心偏移)+translateY(弧形+lift)+rotate；U 弧（中间牌低·两端翘起=手持牌形），
// 端牌 rotate 左逆右顺。per-card 垂直弧 flex 表达不了 → 绝对定位。
// audit 提示：扇形叠放=纸牌意图叠层，ui-audit 判重叠是盲区（LayoutNode 缺 data-allow-overlap·A-007 报 PUI）。
const HAND_CARD_W = 64;
const HAND_L = 132; // 左端（避主角立绘框·框右缘 96）
const HAND_AVAIL = 760; // 手牌横向可用宽（右侧留 glass 操作区）
function buildHandFanNodes(hand: number[], selected: number[]): LayoutNode[] {
  const n = hand.length;
  if (n === 0) return [];
  const mid = (n - 1) / 2;
  const step = Math.min(HAND_CARD_W - 2, Math.round(HAND_AVAIL / Math.max(1, n - 1)));
  const totalW = step * (n - 1);
  const startX = HAND_L + Math.round((HAND_AVAIL - totalW) / 2);
  const baseY = FIELD_H - 112; // 中间牌顶 y（两端向上翘）
  const MAX_LIFT = 48; // 两端上翘幅度（U 弧深）
  const MAX_ROT = 19; // 端牌旋转角
  return hand.map((c, i) => {
    const f = cardFace(c);
    const sel = selected.includes(i);
    const t = mid === 0 ? 0 : (i - mid) / mid; // 归一化 -1..1
    const lift = Math.round(t * t * MAX_LIFT); // U 弧：|t| 大 → 上翘多（y 小）
    const rot = Math.round(t * MAX_ROT * 10) / 10; // 左端逆时针 / 右端顺时针
    return {
      type: 'PlayingCard',
      id: `a-hand-${i}`,
      // actionArg=手牌**下标**（非牌码·两副牌同码会联动误选）
      props: { rank: f.rank, suit: f.suit, face: 'light', size: 'md', selected: sel, action: 'hand.toggle', actionArg: String(i) },
      layout: { x: startX + i * step, y: baseY - lift - (sel ? 22 : 0), rotate: rot },
    };
  });
}

export function buildPlay(v: PlayView): LayoutNode {
  const heroTurn = v.turn === 'hero';
  const anchorOf = (id: 'partner' | 'west' | 'east'): { x: number; y: number } =>
    seatTopLeft(SEAT_ANCHORS.find((s) => s.id === id)!);
  const pA = anchorOf('partner');
  const wA = anchorOf('west');
  const eA = anchorOf('east');

  // 中央出牌区（桌心·牌型标签 + 四家最近一手 + 行动提示）——作 felt 子节点（祖孙嵌套·audit 不判桌面重叠）。
  const centerChildren: LayoutNode[] = v.trick
    ? [
        { type: 'Tag', id: 'a-p-trickname', props: { label: v.trick.name, tone: 'accent', size: 'md' } },
        {
          type: 'Panel',
          id: 'a-p-trickcards',
          props: { bare: true },
          layout: { direction: 'row', gap: 5, justify: 'center' },
          children: v.trick.cards.map((c, i) => trickCard(c, i)),
        },
        { type: 'Label', id: 'a-p-turn', props: { text: heroTurn ? '待你应对' : `${v.turnName} 出牌中…`, size: 'sm', color: heroTurn ? 'gold' : 'sub' } },
      ]
    : [{ type: 'Label', id: 'a-p-lead', props: { text: heroTurn ? '轮到你领出' : `${v.turnName} 领出中…`, font: 'serif', size: 'lg', bold: true, color: heroTurn ? 'gold' : 'sub' } }];
  const centerZone: LayoutNode = {
    type: 'Panel',
    id: 'a-p-center',
    props: { bare: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 8, width: 380 },
    children: centerChildren,
  };
  // 进贡/还贡横幅（本盘有则显·felt 子节点=祖孙嵌套·玩家知情盘首进贡）。
  const feltChildren: LayoutNode[] = [];
  if (v.tributeText) {
    feltChildren.push({
      type: 'Panel',
      id: 'a-p-tribute',
      props: { bg: { custom: 'linear-gradient(180deg,rgba(200,53,43,0.28),rgba(30,20,14,0.9))' } },
      layout: { direction: 'row', align: 'center', justify: 'center', gap: 6, padding: 7, radius: 16, margin: 6 },
      children: [{ type: 'Label', id: 'a-p-tribute-l', props: { text: `🎴 ${v.tributeText}`, size: 'sm', color: 'gold', bold: true } }],
    });
  }
  feltChildren.push(centerZone);
  // 椭圆红呢牌桌（radius 大=胶囊椭圆·felt 红呢 + 暗角 + 金边）·进贡横幅 + 出牌区 flex 居中于桌心（felt 子节点）。
  const feltTable: LayoutNode = {
    type: 'Panel',
    id: 'a-felt',
    props: { bg: { custom: FELT_RED }, vignette: true, accent: true },
    layout: { x: 232, y: 148, width: FIELD_W - 464, height: 322, radius: 160, direction: 'column', align: 'center', justify: 'center', gap: 8 },
    children: feltChildren,
  };

  // 级牌信息条（牌桌下方 pill 一行）。
  const infoBar: LayoutNode = {
    type: 'Panel',
    id: 'a-p-info',
    props: { bg: { custom: 'linear-gradient(180deg,rgba(30,20,14,0.94),rgba(20,14,10,0.9))' } },
    layout: { x: FIELD_W / 2 - 210, y: 512, width: 420, direction: 'row', gap: 12, align: 'center', justify: 'center', padding: 8, radius: 20 },
    children: [
      { type: 'Tag', id: 'a-p-level', props: { label: `级牌 ${v.levelPlay}`, tone: 'accent', size: 'sm' } },
      { type: 'Label', id: 'a-p-lv', props: { text: `我方 ${v.levelOurs} · 对方 ${v.levelTheirs}`, size: 'sm', color: 'sub' } },
      { type: 'Badge', id: 'a-p-stake', props: { text: `底注 ${v.stake}`, tone: 'ok' } },
      { type: 'Label', id: 'a-p-round', props: { text: `第 ${v.round} 盘`, size: 'sm', color: 'sub' } },
    ],
  };

  // 主角立绘框（左下·A-CHAR-HERO 占位·S6 真立绘）。
  const heroPortrait: LayoutNode = {
    type: 'Panel',
    id: 'a-p-portrait',
    props: { vignette: true },
    layout: { x: 12, y: 566, width: 84, height: 126, direction: 'column', align: 'center', justify: 'center', gap: 4, padding: 8 },
    children: [
      { type: 'Avatar', id: 'a-p-portrait-face', props: { name: v.seats.hero.seat.name, size: 64, shape: 'rounded' } },
      { type: 'Label', id: 'a-p-portrait-l', props: { text: '主角立绘', size: 'xs', color: 'dim' } },
      { type: 'Label', id: 'a-p-portrait-dress', props: { text: `服饰 ${v.seats.hero.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
    ],
  };

  // 操作区（右下 glass·金钱 + 理牌 Segmented + 提示/过/出牌）。
  const actionBar: LayoutNode = {
    type: 'Panel',
    id: 'a-p-actions',
    props: { glass: true },
    layout: { x: FIELD_W - 322, y: 566, width: 306, direction: 'column', gap: 8, align: 'stretch', padding: 12 },
    children: [
      {
        type: 'Panel',
        id: 'a-p-act-top',
        props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center', justify: 'between' },
        children: [
          { type: 'Badge', id: 'a-p-wallet', props: { text: `💰 ${fmtMoney(v.wallet)}`, tone: 'ok' } },
          {
            type: 'Segmented',
            id: 'a-p-sort',
            props: { options: [{ value: 'rank', label: '按点数' }, { value: 'family', label: '按牌型' }], value: v.sortMode, action: 'hand.sort' },
          },
        ],
      },
      {
        type: 'Panel',
        id: 'a-p-act-btns',
        props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center', justify: 'end' },
        children: [
          { type: 'Button', id: 'a-p-counter', props: { label: v.showCounter ? '▤ 收起' : '▤ 记牌器', kind: 'quiet', action: 'tools.counter' } },
          { type: 'Button', id: 'a-p-hint', props: { label: '提示', kind: 'ghost', action: 'play.hint', disabled: !heroTurn } },
          { type: 'Button', id: 'a-p-pass', props: { label: '过', kind: 'quiet', action: 'play.pass', disabled: !heroTurn || !v.canPass } },
          { type: 'Button', id: 'a-p-commit', props: { label: '出牌', kind: 'primary', action: 'play.commit', disabled: !heroTurn || !v.canCommit } },
        ],
      },
      {
        type: 'Label',
        id: 'a-p-why',
        props: {
          text: heroTurn ? (!v.canCommit && v.selected.length > 0 ? v.commitWhy : '点牌选中 · 出牌或过') : `${v.turnName} 行动中…`,
          size: 'xs',
          color: heroTurn && !v.canCommit && v.selected.length > 0 ? 'warn' : 'dim',
        },
      },
    ],
  };

  const backWrap: LayoutNode = {
    type: 'Panel',
    id: 'a-p-backwrap',
    props: { bare: true },
    layout: { x: FIELD_W - 96, y: 12, width: 84 },
    children: [{ type: 'Button', id: 'a-p-back', props: { label: '返回', kind: 'ghost', action: 'table.back' } }],
  };

  // 记牌器（居中模态浮层·明面已出牌计数·点「▤ 记牌器」开·点遮罩/关闭收·不开天眼）。
  const counterPanel: LayoutNode | null = v.showCounter
    ? {
        type: 'Modal',
        id: 'a-p-counter-modal',
        props: { title: '记牌器 · 明面已出牌（不开天眼）', size: 'sm', closable: true, closeAction: 'tools.counter' },
        children: [
          { type: 'Label', id: 'a-p-counter-hint', props: { text: '各点数 已出 / 共 · 剩余可推断谁手里还有大牌', size: 'xs', color: 'sub' } },
          {
            type: 'Table',
            id: 'a-p-counter-table',
            props: {
              columns: [
                { key: 'rank', label: '点数', width: 72 },
                { key: 'played', label: '已出', width: 72, align: 'center' },
                { key: 'left', label: '剩余', align: 'center' },
              ],
              rows: v.counter.map((r) => ({
                id: `cnt-${r.rank}`,
                cells: { rank: r.rank, played: `${r.played}/${r.total}`, left: String(r.total - r.played) },
                tone: (r.total - r.played === 0 ? 'dim' : 'normal') as 'dim' | 'normal',
              })),
            },
          },
        ],
      }
    : null;

  // z 序（DOM 顺序）：桌 → 中央墩 → 席位 → 信息条 → 立绘/操作 → 手牌扇（最上·可点）→ 返回。
  return {
    type: 'Screen',
    id: 'a-play',
    props: {},
    layout: { width: FIELD_W, height: FIELD_H },
    children: [
      feltTable, // 含中央出牌区（祖孙嵌套）
      seatCard(v.seats.partner, pA.x, pA.y, v.turn === 'partner'),
      seatCard(v.seats.west, wA.x, wA.y, v.turn === 'west'),
      seatCard(v.seats.east, eA.x, eA.y, v.turn === 'east'),
      infoBar,
      heroPortrait,
      actionBar,
      ...buildHandFanNodes(v.hand, v.selected),
      ...(counterPanel ? [counterPanel] : []),
      backWrap,
    ],
  };
}

// ── 盘结算浮层（SC-4·名次+金钱+级数+服饰·run 终局变体）──────────────────────────
export interface ResultView {
  ranking: { seat: SeatId; name: string; team: 0 | 1 }[];
  winnersTeam: 0 | 1;
  comboLabel: string; // 双上/一三/一四
  totalMult: number;
  payPerPlayer: number;
  levelAfter: [number, number];
  dressOutDoubled: boolean;
  phase: 'settled' | 'run-won' | 'run-lost';
}
export function buildResult(v: ResultView): LayoutNode {
  const runEnd = v.phase !== 'settled';
  const title = v.phase === 'run-won' ? '过 A · 通关！' : v.phase === 'run-lost' ? '对方过 A · 游戏结束' : '本盘结算';
  const heroWon = v.winnersTeam === 0;
  const rankRows = v.ranking.map((r, i) => ({
    id: `rank-${i}`,
    cells: { no: `${i + 1}`, name: r.name, side: r.team === 0 ? '我方' : '对方' },
    tone: (r.team === v.winnersTeam ? 'accent' : 'normal') as 'accent' | 'normal',
  }));
  const dressLine: LayoutNode = v.dressOutDoubled
    ? { type: 'Label', id: 'a-r-dress', props: { text: '有姨太已至底线档 · 金钱罚 ×2', size: 'xs', color: 'warn' } }
    : { type: 'Label', id: 'a-r-dress', props: { text: '输方姨太各褪一件', size: 'xs', color: 'sub' } };
  const actionBtn: LayoutNode = runEnd
    ? { type: 'Button', id: 'a-r-home', props: { label: '回主菜单', kind: 'primary', action: 'table.back' } }
    : { type: 'Button', id: 'a-r-next', props: { label: '下一盘', kind: 'primary', action: 'round.next' } };
  return {
    type: 'Screen',
    id: 'a-result',
    props: { bg: { custom: 'linear-gradient(180deg,rgba(20,10,11,0.94),rgba(20,10,11,0.98)),#140a0b' }, center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-r-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 12, padding: 26 },
        children: [
          { type: 'Label', id: 'a-r-title', props: { text: title, font: 'elegant', size: 'xxl', bold: true, color: runEnd ? (heroWon ? 'gold' : 'danger') : 'gold' } },
          {
            type: 'Table',
            id: 'a-r-rank',
            props: {
              columns: [
                { key: 'no', label: '名次', width: 48, align: 'center' },
                { key: 'name', label: '座' },
                { key: 'side', label: '阵营', width: 64, align: 'center' },
              ],
              rows: rankRows,
            },
          },
          {
            type: 'Panel',
            id: 'a-r-money',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Tag', id: 'a-r-combo', props: { label: v.comboLabel, tone: 'accent', size: 'sm' } },
              { type: 'Badge', id: 'a-r-mult', props: { text: `×${v.totalMult}`, tone: 'ok' } },
              { type: 'Badge', id: 'a-r-pay', props: { text: `${heroWon ? '+' : '-'}${fmtMoney(v.payPerPlayer)}`, tone: heroWon ? 'ok' : 'warn' } },
              { type: 'Label', id: 'a-r-lv', props: { text: `级数 我 ${v.levelAfter[0]} · 敌 ${v.levelAfter[1]}`, size: 'sm', color: 'sub' } },
            ],
          },
          dressLine,
          actionBtn,
        ],
      },
    ],
  };
}
