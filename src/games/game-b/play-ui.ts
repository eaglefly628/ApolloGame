// Game B ·《雀宴》—— 对局可玩 UI（LayoutNode·从 MatchState 投影·S4「逻辑跑起来」交互层）。
// UI 铁律：全 LayoutNode 闭集·写世界只走 action 信号（玩家点手牌→play-tile·自摸→act-tsumo…）。
// 手牌交互在 HUD（可靠·守铁律）；3D 牌桌=氛围场景。视觉素皮（sakura）·1:1 精修留 S5。
import type { LayoutNode } from '@ui/components/index.js';
import type { MatchState } from './core/game-state.js';
import { canTsumo, canRiichi, labelTile, seatWind, isWinLikeEnd, CLOTH_LABELS, STRIP_ITEMS } from './core/game-state.js';
import { doraFromIndicator } from './core/wall.js';
import { FIELD_W, FIELD_H } from './theme.js';

export const PLAY_TILE = 'play-tile'; // arg=牌码
export const ACT_TSUMO = 'act-tsumo';
export const ACT_RIICHI = 'act-riichi';
export const NEXT_ROUND = 'next-round';
export const TOGGLE_LOG = 'toggle-log';
export const BACK_MENU = 'back-menu';

const WIND = ['東', '南', '西', '北'];
// 席位视觉位置（seat 0=玩家南下·1 右·2 上·3 左·出牌 0→1→2→3）。
const SEAT_POS: Array<{ x: number; y: number }> = [
  { x: 16, y: FIELD_H - 108 }, // 0 南（玩家·左下）
  { x: FIELD_W - 188, y: Math.round(FIELD_H * 0.42) }, // 1 右
  { x: FIELD_W / 2 - 86, y: 60 }, // 2 上
  { x: 16, y: Math.round(FIELD_H * 0.42) }, // 3 左
];

function seatCard(m: MatchState, seat: number): LayoutNode {
  const active = m.cur.turn === seat && m.cur.phase === 'playing';
  const wind = WIND[seatWind(seat, m.dealer)];
  const isDealer = seat === m.dealer;
  const p = SEAT_POS[seat]!;
  return {
    type: 'Panel', id: `seat-${seat}`, props: { accent: active },
    layout: { x: p.x, y: p.y, width: 172, padding: 8, gap: 5, direction: 'column' },
    children: [
      {
        type: 'Panel', id: `seat-${seat}-r`, props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Avatar', id: `seat-${seat}-av`, props: { name: m.seatNames[seat]!.slice(-1), size: 32, shape: 'circle' } },
          {
            type: 'Panel', id: `seat-${seat}-nm`, props: { bare: true }, layout: { direction: 'column', gap: 1, flex: 1 },
            children: [
              { type: 'Label', id: `seat-${seat}-name`, props: { text: `${m.seatNames[seat]}${isDealer ? '·庄' : ''}${m.cur.riichi[seat] ? '·立直' : ''}`, size: 'sm', bold: true, color: m.cur.riichi[seat] ? 'danger' : 'text' } },
              { type: 'Label', id: `seat-${seat}-pts`, props: { text: m.scores[seat]!.toLocaleString('en-US'), size: 'sm', bold: true, color: 'danger' } },
            ],
          },
          { type: 'Tag', id: `seat-${seat}-w`, props: { label: wind!, tone: active ? 'accent' : 'normal', size: 'sm' } },
        ],
      },
      // 衣物章行（gdd §七直击脱衣·剩余亮/脱掉熄灭·主角满且豁免）
      {
        type: 'Panel', id: `seat-${seat}-cloth`, props: { bare: true }, layout: { direction: 'row', gap: 3 },
        children: CLOTH_LABELS.map((lab, i): LayoutNode => {
          const on = i < m.clothing[seat]!;
          return { type: 'Tag', id: `seat-${seat}-cl${i}`, props: { label: lab, size: 'sm', tone: on ? 'normal' : 'dim', active: on } };
        }),
      },
    ],
  };
}

// 各家牌河（最近弃牌·labelTile 小 Tag 排·玩家河多显几张）。
function riverStrip(m: MatchState, seat: number): LayoutNode {
  const river = m.cur.rivers[seat]!;
  const show = river.slice(-(seat === 0 ? 12 : 6));
  const p = SEAT_POS[seat]!;
  const near = { x: p.x, y: seat === 2 ? p.y + 84 : (seat === 0 ? p.y - 42 : p.y + 84) };
  return {
    type: 'Panel', id: `river-${seat}`, props: { bare: true },
    layout: { x: near.x, y: Math.max(0, near.y), width: 320, direction: 'row', gap: 2 },
    children: show.map((c, i): LayoutNode => ({
      type: 'Tag', id: `river-${seat}-${i}`, props: { label: labelTile(c), size: 'sm', tone: 'dim' },
    })),
  };
}

// 玩家手牌排（底部·每张可点打出·摸牌分开高亮）。
function playerHand(m: MatchState): LayoutNode {
  const rs = m.cur;
  const hand = rs.hands[0]!;
  const canPlay = rs.turn === 0 && rs.drawn !== null && rs.phase === 'playing';
  const locked = rs.riichi[0]; // 立直后锁手牌·只能摸切（打 drawn）
  const tiles: LayoutNode[] = hand.map((c, i): LayoutNode => ({
    type: 'Button', id: `h-${i}`,
    props: { label: labelTile(c), kind: 'ghost', disabled: !canPlay || locked, action: PLAY_TILE, actionArg: String(c) },
  }));
  if (rs.drawn !== null) {
    tiles.push({
      type: 'Button', id: 'h-drawn',
      props: { label: labelTile(rs.drawn), kind: 'primary', disabled: !canPlay, action: PLAY_TILE, actionArg: String(rs.drawn) },
    });
  }
  return {
    type: 'Panel', id: 'player-hand', props: { bare: true },
    layout: { x: 0, y: FIELD_H - 52, width: FIELD_W, direction: 'row', gap: 3, justify: 'center' },
    children: tiles,
  };
}

function infoBadge(m: MatchState): LayoutNode {
  const dora = m.cur.doraInd.map((d) => labelTile(doraFromIndicator(d))).join(' ');
  return {
    type: 'Panel', id: 'info', props: { bg: { custom: 'rgba(30,20,30,0.72)' }, dashed: true },
    layout: { x: 14, y: 12, padding: 8, gap: 3, direction: 'column' },
    children: [
      { type: 'Label', id: 'info-l', props: { text: `東${m.roundNo}局 · ${m.honba}本場 ｜ 供托 ${m.kyotaku / 1000} ｜ 余牌 ${m.cur.wall.length}`, size: 'sm', color: 'jade' } },
      { type: 'Label', id: 'info-d', props: { text: `宝牌 ${dora}`, size: 'sm', color: 'gold' } },
    ],
  };
}

function subtitle(m: MatchState): LayoutNode {
  const last = m.log.all().slice(-1)[0];
  const txt = m.cur.phase === 'playing'
    ? (m.cur.turn === 0 ? '轮到你——点手牌打出' : `${m.seatNames[m.cur.turn]} 思考中…`)
    : (last?.text ?? '');
  return {
    type: 'Panel', id: 'sub', props: { bg: { custom: 'rgba(24,16,24,0.82)' } },
    layout: { x: FIELD_W / 2 - 200, y: FIELD_H - 96, width: 400, padding: 7, align: 'center' },
    children: [{ type: 'Label', id: 'sub-l', props: { text: txt, size: 'sm', color: 'jade' } }],
  };
}

function actionBar(m: MatchState): LayoutNode {
  const tsumo = canTsumo(m);
  return {
    type: 'Panel', id: 'acts', props: { bare: true },
    layout: { x: FIELD_W - 250, y: 12, direction: 'row', gap: 8 },
    children: [
      { type: 'Button', id: 'act-tsumo', props: { label: '自摸', kind: 'hero', disabled: !tsumo, action: ACT_TSUMO } },
      { type: 'Button', id: 'act-riichi', props: { label: '立直', kind: 'primary', disabled: !canRiichi(m), action: ACT_RIICHI } },
      { type: 'Button', id: 'act-log', props: { label: '📜 日志', kind: 'quiet', action: TOGGLE_LOG } },
      { type: 'Button', id: 'act-menu', props: { label: '☰', kind: 'quiet', action: BACK_MENU } },
    ],
  };
}

function logPanel(m: MatchState): LayoutNode {
  const evs = m.log.recent(16);
  return {
    type: 'Panel', id: 'logpanel', props: { bg: { custom: 'rgba(18,12,20,0.94)' }, title: '游戏日志（查 bug）' },
    layout: { x: FIELD_W - 372, y: 54, width: 356, height: FIELD_H - 120, padding: 10, gap: 2, direction: 'column' },
    children: evs.map((e, i): LayoutNode => ({
      type: 'Label', id: `log-${i}`,
      props: { text: `[${e.round}] ${e.actor}·${e.text}`, size: 'xs', color: e.kind === 'tsumo' || e.kind === 'ron' ? 'gold' : e.kind === 'score' ? 'danger' : 'sub' },
    })),
  };
}

function resultOverlay(m: MatchState): LayoutNode {
  const r = m.cur.result!;
  const title = r.type === 'draw' ? '荒牌流局' : (r.type === 'tsumo' ? `${m.seatNames[r.winner!]} 自摸和了` : `${m.seatNames[r.winner!]} 荣和`);
  const rows: LayoutNode[] = [
    { type: 'Label', id: 'res-t', props: { text: title, size: 'xl', bold: true, color: 'gold', font: 'serif' } },
  ];
  if (r.type !== 'draw') rows.push({ type: 'Label', id: 'res-w', props: { text: `和了牌 ${labelTile(r.winTile!)}${r.loser !== null ? `（放铳 ${m.seatNames[r.loser]}）` : ''}`, size: 'sm', color: 'sub' } });
  // 本局脱衣汇总（直击制·gdd §七）
  const stripSum = (r.stripped ?? []).map((n, i) => (n > 0 ? `${m.seatNames[i]} 脱${n}（余 ${m.clothing[i]}/${STRIP_ITEMS}）` : null)).filter(Boolean);
  if (stripSum.length) rows.push({ type: 'Label', id: 'res-strip', props: { text: `直击脱衣 · ${stripSum.join('　')}`, size: 'sm', color: 'danger' } });
  rows.push({
    type: 'Panel', id: 'res-delta', props: { bare: true }, layout: { direction: 'column', gap: 2 },
    children: r.delta.map((d, i): LayoutNode => ({ type: 'Label', id: `res-d-${i}`, props: { text: `${m.seatNames[i]}　${d >= 0 ? '+' : ''}${d}　→ ${m.scores[i]!.toLocaleString('en-US')}`, size: 'sm', color: d > 0 ? 'ok' : d < 0 ? 'danger' : 'sub' } })),
  });
  rows.push({ type: 'Button', id: 'res-next', props: { label: m.over ? '返回主菜单' : '下一局 ▸', kind: 'hero', action: m.over ? BACK_MENU : NEXT_ROUND } });
  return {
    type: 'Modal', id: 'result', props: { title: m.over ? '终局' : '本局结算', closable: false },
    children: [{ type: 'Panel', id: 'res-body', props: { bare: true }, layout: { direction: 'column', gap: 10, align: 'center', padding: 6 }, children: rows }],
  };
}

export interface PlayHudOpts { logOpen: boolean }

export function buildPlayHud(m: MatchState, opts: PlayHudOpts): LayoutNode {
  const children: LayoutNode[] = [
    infoBadge(m),
    actionBar(m),
    ...[0, 1, 2, 3].map((s) => seatCard(m, s)),
    ...[0, 1, 2, 3].map((s) => riverStrip(m, s)),
    playerHand(m),
    subtitle(m),
  ];
  if (opts.logOpen) children.push(logPanel(m));
  if (isWinLikeEnd(m)) children.push(resultOverlay(m));
  return { type: 'Panel', id: 'play-root', props: { bare: true }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H }, children };
}
