import type { Card } from '@engine/protocol/components.js';
import { cardFace } from './theme.js';
import { dealHoldem, bestOf7, HOLDEM_TYPE_ORDER, holdemRank, type HoldemDeal, type HandRank } from './holdem-eval.js';
import {
  startHand, act, initialPositions, type BettingConfig, type HandState, type Action,
} from './betting-engine.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》游戏日志（owner 2026-07-17「加游戏日志查 bug」）
//
//  定位：**确定性事件流**——同 seed + 同脚本 → 逐条一致的可读牌局历史（发牌/盲注/行动/进街/摊牌/结算）。
//  查 bug 价值：① 屏上日志面板实时看牌局怎么走的（UI/逻辑 bug 定位）；② 测试断言日志行（引擎行为回归——
//  betting/摊牌逻辑一变、日志即变红）；③ M2 AI 万手 sim 时逐手 replay 验非退化策略。
//  纪律：纯读 sim 状态派生文本，不回写、不进 hash、无随机（随机只在发牌 seed）——render/debug 旁路。
// ═══════════════════════════════════════════════════════════════

export interface GameEvent {
  seq: number;
  tag: 'deal' | 'blind' | 'action' | 'street' | 'showdown' | 'pawn' | 'info';
  text: string;
}

const SUIT_NAME = ['♠', '♥', '♦', '♣'];
export const cardStr = (c: Card): string => { const f = cardFace(c); return `${f.rank}${SUIT_NAME[c.suit] ?? f.suit}`; };
const cardsStr = (cs: readonly Card[]): string => cs.map(cardStr).join(' ');
const seatName = (seat: number): string => (seat === 0 ? '主角' : `${['', '大', '二', '三', '四', '五'][seat] ?? seat}姨太`);

/** 把一个下注动作格式化成可读行（M4 真交互接入时复用同一格式器 → 日志口径单一真相）。 */
export function describeAction(seat: number, action: Action, toCall: number): string {
  const who = `${seatName(seat)}(座${seat})`;
  switch (action.kind) {
    case 'fold': return `${who} 弃牌`;
    case 'check': return `${who} 过牌`;
    case 'call': return `${who} 跟注 ${toCall}`;
    case 'raise': return `${who} 加注到 ${action.to}`;
  }
}

/** 演示手 replay（宿主素坯定格用）：发牌 → 翻前全跟 → 翻牌让到主角，逐步记事件。
 *  确定性：同 seed 逐条日志一致（game-log.test 钉死）。返回定格状态 + 事件流。 */
export function replayDemoHand(seed: number, cfg: BettingConfig): {
  st: HandState; deal: HoldemDeal; flop: Card[]; heroHandType: string; events: GameEvent[];
} {
  const events: GameEvent[] = [];
  let seq = 0;
  const log = (tag: GameEvent['tag'], text: string): void => { events.push({ seq: seq++, tag, text }); };

  const deal = dealHoldem(seed, 6);
  log('deal', `🎲 发牌 · seed ${seed} · 6 席落座 · 各 1000 筹码`);
  log('deal', `🂠 主角底牌 ${cardsStr(deal.holes[0])}`);

  const seats = [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: 1000 }));
  const st = startHand(cfg, seats, initialPositions([0, 1, 2, 3, 4, 5], 0));
  log('blind', `🔵 小盲 座${st.pos.sb} 缴 ${cfg.smallBlind} · 大盲 座${st.pos.bb} 缴 ${cfg.bigBlind}`);

  const step = (seat: number, action: Action): void => {
    const toCall = st.currentBet - st.players.find((p) => p.seat === seat)!.committed;
    act(st, seat, action);
    log('action', describeAction(seat, action, toCall));
  };
  for (const s of [3, 4, 5, 0, 1]) step(s, { kind: 'call' });
  step(2, { kind: 'check' });
  const flop = deal.board.slice(0, 3);
  log('street', `🃏 翻牌 · ${cardsStr(flop)} · 底池 ${st.players.reduce((a, p) => a + p.total, 0)}`);
  for (const s of [1, 2, 3, 4, 5]) step(s, { kind: 'check' });

  const heroHandType = HOLDEM_TYPE_ORDER[bestOf7([...deal.holes[0], ...flop]).value[0]];
  log('info', `▶ 轮到 主角(座${st.actor}) 行动 · 当前最优成牌 ${heroHandType}`);
  return { st, deal, flop, heroHandType, events };
}

/** 摊牌结算日志（供 M4 摊牌屏/查bug用·纯读 ranks 排名）：多席按全序值排名成行。 */
export function showdownLog(ranksBySeat: ReadonlyMap<number, { hand: readonly Card[]; board: readonly Card[] }>): GameEvent[] {
  const rows: Array<{ seat: number; value: HandRank; type: string; best: Card[] }> = [];
  for (const [seat, { hand, board }] of ranksBySeat) {
    const r = holdemRank(hand, board);
    rows.push({ seat, value: r.value, type: HOLDEM_TYPE_ORDER[r.value[0]], best: r.best });
  }
  rows.sort((a, b) => { for (let i = 0; i < Math.max(a.value.length, b.value.length); i++) { const d = (b.value[i] ?? 0) - (a.value[i] ?? 0); if (d) return d; } return a.seat - b.seat; });
  return rows.map((r, i) => ({
    seq: i, tag: 'showdown' as const,
    text: `${i === 0 ? '🏆' : `#${i + 1}`} ${seatName(r.seat)}(座${r.seat}) · ${r.type} · ${cardsStr(r.best)}`,
  }));
}
