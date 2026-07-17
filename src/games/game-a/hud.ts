// Game A ·《掼蛋夜宴》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律）。
// S5 UI 关按 owner 钦定蓝本 guandan-lite-mockup.html 1:1 复刻（缺口届时提 requests.md 报 PUI）；
// 本文件立 SC-1 主菜单壳 + 牌桌骨架屏 + S4 可玩牌桌屏（手牌扇列/操作条/中央墩/结算浮层），控件全取 catalog 闭集实名。
// 写世界只经 action 信号；action（menu.start/table.back/hand.toggle/play.commit/pass/hint/round.next）由宿主 HandlerMap 消化，
// handler 只做「选牌记账 + 调 session + 重渲」——不塞判型/结算逻辑（那些在 guandan-session sim 内）。
import type { LayoutNode } from '@ui/components/index.js';
import type { SeatSpec } from './rules.js';
import { HAND_SIZE, DRESS_TIERS, codeRank, codeSuit } from './rules.js';
import { MANOR_BG, CARD_BACK_ID, cardAssetUrl } from './theme.js';
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
export interface TableView {
  wallet: number;
  stake: number;
  round: number;
  levelOurs: number;
  levelTheirs: number;
  flowState: string;
  deckCount: number; // 庄桌未发牌数（骨架=108）
  partner: SeatView;
  west: SeatView;
  east: SeatView;
  hero: SeatView;
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
          { type: 'Button', id: 'a-menu-start', props: { label: '开始上桌 · 骨架桌（底注 100）', kind: 'primary', action: 'menu.start' } },
          { type: 'Button', id: 'a-menu-settings', props: { label: '设置', kind: 'ghost', disabled: true } },
          { type: 'Label', id: 'a-menu-ver', props: { text: 'S3 骨架版 · 发牌与出牌循环于玩法关（S4）接入', size: 'xs', color: 'dim' } },
        ],
      },
    ],
  };
}

// ── 席位卡（骨架·SC-3 席位区的最小形·S5 按蓝本重排）──────────────────────────────
function seatCard(id: string, v: SeatView): LayoutNode {
  const foe = v.seat.team === 1;
  return {
    type: 'Panel',
    id: `a-seat-${id}`,
    props: {},
    layout: { direction: 'column', align: 'center', gap: 5, padding: 10 },
    children: [
      { type: 'Avatar', id: `a-seat-${id}-face`, props: { name: v.seat.name, size: 40, shape: 'circle' } },
      { type: 'Label', id: `a-seat-${id}-name`, props: { text: v.seat.name, size: 'sm', bold: true } },
      {
        type: 'Panel',
        id: `a-seat-${id}-row`,
        props: { bare: true },
        layout: { direction: 'row', gap: 6, align: 'center' },
        children: [
          { type: 'Badge', id: `a-seat-${id}-cards`, props: { text: `余牌 ${v.cards}`, tone: 'ok' } },
          { type: 'Tag', id: `a-seat-${id}-side`, props: { label: foe ? '对手' : '队友', tone: foe ? 'normal' : 'accent', size: 'sm' } },
        ],
      },
      { type: 'Label', id: `a-seat-${id}-dress`, props: { text: `服饰 ${v.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
    ],
  };
}

// ── 牌桌骨架屏（挂载目击件：world 活值投影 + 本地牌资产上画面）────────────────────
export function buildTable(v: TableView): LayoutNode {
  return {
    type: 'Screen',
    id: 'a-table',
    props: { bg: { custom: MANOR_BG } },
    layout: { direction: 'column', gap: 10, padding: 16, justify: 'between' },
    children: [
      // 北 · 对家
      {
        type: 'Panel',
        id: 'a-north',
        props: { bare: true },
        layout: { direction: 'row', justify: 'center' },
        children: [seatCard('partner', v.partner)],
      },
      // 中带：西席 · 中央出牌区骨架 · 东席
      {
        type: 'Panel',
        id: 'a-mid',
        props: { bare: true },
        layout: { direction: 'row', justify: 'between', align: 'center', gap: 12 },
        children: [
          seatCard('west', v.west),
          {
            type: 'Panel',
            id: 'a-center',
            props: { bg: 'sunken', vignette: true },
            layout: { direction: 'column', align: 'center', gap: 8, padding: 18, flex: 1 },
            children: [
              {
                type: 'Image',
                id: 'a-center-deck',
                props: { src: cardAssetUrl(CARD_BACK_ID), fit: 'contain', radius: 6 },
                layout: { width: 72, height: 100 },
              },
              { type: 'Label', id: 'a-center-deckn', props: { text: `牌库 ${v.deckCount} 张 · 未发`, size: 'sm', color: 'sub' } },
              { type: 'Label', id: 'a-center-note', props: { text: '牌桌骨架就绪 · 发牌/出牌循环于玩法关（S4）接入', size: 'xs', color: 'dim' } },
              {
                type: 'Panel',
                id: 'a-info',
                props: { bare: true },
                layout: { direction: 'row', gap: 8, align: 'center', justify: 'center' },
                children: [
                  { type: 'Tag', id: 'a-info-level', props: { label: `级牌 ${v.levelOurs}`, tone: 'accent', size: 'sm' } },
                  { type: 'Label', id: 'a-info-lv', props: { text: `我方 ${v.levelOurs} · 对方 ${v.levelTheirs}`, size: 'xs', color: 'sub' } },
                  { type: 'Badge', id: 'a-info-stake', props: { text: `底注 ${v.stake}` } },
                  { type: 'Label', id: 'a-info-round', props: { text: `第 ${v.round} 盘`, size: 'xs', color: 'sub' } },
                  { type: 'Tag', id: 'a-info-flow', props: { label: `流程 ${v.flowState}`, tone: 'dim', size: 'sm' } },
                ],
              },
            ],
          },
          seatCard('east', v.east),
        ],
      },
      // 南 · 主角条
      {
        type: 'Panel',
        id: 'a-hero-bar',
        props: {},
        layout: { direction: 'row', justify: 'between', align: 'center', gap: 12, padding: 12 },
        children: [
          {
            type: 'Panel',
            id: 'a-hero-id',
            props: { bare: true },
            layout: { direction: 'row', gap: 8, align: 'center' },
            children: [
              { type: 'Avatar', id: 'a-hero-face', props: { name: v.hero.seat.name, size: 36, shape: 'circle' } },
              { type: 'Label', id: 'a-hero-name', props: { text: v.hero.seat.name, size: 'sm', bold: true } },
              { type: 'Badge', id: 'a-hero-wallet', props: { text: `💰 ${fmtMoney(v.wallet)}`, tone: 'ok' } },
            ],
          },
          { type: 'Label', id: 'a-hero-hand', props: { text: `手牌 ${v.hero.cards}/${HAND_SIZE} · 服饰 ${v.hero.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
          { type: 'Button', id: 'a-hero-back', props: { label: '返回主菜单', kind: 'ghost', action: 'table.back' } },
        ],
      },
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
  hand: number[]; // hero 手牌牌码（已排序）
  selected: number[]; // 已选牌码
  trick: { name: string; family: string; cards: number[] } | null; // 当前墩
  canCommit: boolean; // 选牌构成合法且能压
  commitWhy: string; // 不可出的原因（禁用提示）
  canPass: boolean;
}

// face:dark（暗牌面白字·私宅暗色调协调）：亦规避 ui-audit 对 light 牌面黑花色角标的识别盲区
// （♠♣ 纯黑角标在白牌面被误判 1.11·真人清晰可读）——盲区已报 PUI（requests.md REQ-UI-PlayingCard-audit）。
function trickCard(code: number, idx: number): LayoutNode {
  const f = cardFace(code);
  return { type: 'PlayingCard', id: `a-trick-${idx}`, props: { rank: f.rank, suit: f.suit, face: 'dark', size: 'sm' } };
}
function handCard(code: number, idx: number, selected: boolean): LayoutNode {
  const f = cardFace(code);
  return {
    type: 'PlayingCard',
    id: `a-hand-${idx}`,
    props: { rank: f.rank, suit: f.suit, face: 'dark', size: 'md', selected, action: 'hand.toggle', actionArg: String(code) },
  };
}

export function buildPlay(v: PlayView): LayoutNode {
  const heroTurn = v.turn === 'hero';
  return {
    type: 'Screen',
    id: 'a-play',
    props: { bg: { custom: MANOR_BG } },
    layout: { direction: 'column', gap: 8, padding: 14, justify: 'between' },
    children: [
      // 北 · 对家
      { type: 'Panel', id: 'a-p-north', props: { bare: true }, layout: { direction: 'row', justify: 'center' }, children: [seatCard('partner', v.seats.partner)] },
      // 中带：西 · 中央墩 · 东
      {
        type: 'Panel',
        id: 'a-p-mid',
        props: { bare: true },
        layout: { direction: 'row', justify: 'between', align: 'center', gap: 12 },
        children: [
          seatCard('west', v.seats.west),
          {
            type: 'Panel',
            id: 'a-p-center',
            props: { bg: 'sunken', vignette: true },
            layout: { direction: 'column', align: 'center', gap: 8, padding: 16, flex: 1 },
            children: [
              v.trick
                ? {
                    type: 'Panel',
                    id: 'a-p-trick',
                    props: { bare: true },
                    layout: { direction: 'column', align: 'center', gap: 6 },
                    children: [
                      { type: 'Tag', id: 'a-p-trickname', props: { label: v.trick.name, tone: 'accent', size: 'sm' } },
                      { type: 'Panel', id: 'a-p-trickcards', props: { bare: true }, layout: { direction: 'row', gap: 4 }, children: v.trick.cards.map((c, i) => trickCard(c, i)) },
                    ],
                  }
                : { type: 'Label', id: 'a-p-lead', props: { text: '等待领出', size: 'sm', color: 'sub' } },
              {
                type: 'Panel',
                id: 'a-p-info',
                props: { bare: true },
                layout: { direction: 'row', gap: 8, align: 'center', justify: 'center' },
                children: [
                  { type: 'Tag', id: 'a-p-level', props: { label: `打 ${v.levelPlay}`, tone: 'accent', size: 'sm' } },
                  { type: 'Label', id: 'a-p-lv', props: { text: `我 ${v.levelOurs} · 敌 ${v.levelTheirs}`, size: 'xs', color: 'sub' } },
                  { type: 'Badge', id: 'a-p-stake', props: { text: `底注 ${v.stake}`, tone: 'ok' } },
                  { type: 'Label', id: 'a-p-round', props: { text: `第 ${v.round} 盘`, size: 'xs', color: 'sub' } },
                ],
              },
              { type: 'Tag', id: 'a-p-turn', props: { label: heroTurn ? '轮到你出牌' : `${v.turnName} 思考中…`, tone: heroTurn ? 'accent' : 'dim', size: 'sm' } },
            ],
          },
          seatCard('east', v.seats.east),
        ],
      },
      // 南 · 手牌扇列 + 操作条
      {
        type: 'Panel',
        id: 'a-p-south',
        props: {},
        layout: { direction: 'column', gap: 8, padding: 10 },
        children: [
          {
            type: 'Panel',
            id: 'a-p-hand',
            props: { bare: true },
            layout: { direction: 'row', justify: 'center', gap: 2, align: 'end' },
            children: v.hand.map((c, i) => handCard(c, i, v.selected.includes(c))),
          },
          {
            type: 'Panel',
            id: 'a-p-bar',
            props: { bare: true },
            layout: { direction: 'row', justify: 'between', align: 'center', gap: 10 },
            children: [
              {
                type: 'Panel',
                id: 'a-p-id',
                props: { bare: true },
                layout: { direction: 'row', gap: 8, align: 'center' },
                children: [
                  { type: 'Avatar', id: 'a-p-face', props: { name: v.seats.hero.seat.name, size: 32, shape: 'circle' } },
                  { type: 'Badge', id: 'a-p-wallet', props: { text: `💰 ${fmtMoney(v.wallet)}`, tone: 'ok' } },
                  { type: 'Label', id: 'a-p-dress', props: { text: `服饰 ${v.seats.hero.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
                ],
              },
              {
                type: 'Panel',
                id: 'a-p-actions',
                props: { bare: true },
                layout: { direction: 'row', gap: 8, align: 'center' },
                children: [
                  { type: 'Button', id: 'a-p-hint', props: { label: '提示', kind: 'ghost', action: 'play.hint', disabled: !heroTurn } },
                  { type: 'Button', id: 'a-p-pass', props: { label: '过', kind: 'quiet', action: 'play.pass', disabled: !heroTurn || !v.canPass } },
                  { type: 'Button', id: 'a-p-commit', props: { label: '出牌', kind: 'primary', action: 'play.commit', disabled: !heroTurn || !v.canCommit } },
                ],
              },
            ],
          },
          heroTurn && !v.canCommit && v.selected.length > 0
            ? { type: 'Label', id: 'a-p-why', props: { text: v.commitWhy, size: 'xs', color: 'warn' } }
            : { type: 'Label', id: 'a-p-why', props: { text: heroTurn ? '点牌选中 · 出牌或过' : '', size: 'xs', color: 'dim' } },
        ],
      },
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
