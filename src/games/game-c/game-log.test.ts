import { describe, it, expect } from 'vitest';
import type { Card } from '@engine/protocol/components.js';
import { replayDemoHand, replayFullHand, showdownLog, describeAction, cardStr, type GameEvent } from './game-log.js';
import type { BettingConfig } from './betting-engine.js';

const CFG: BettingConfig = { smallBlind: 25, bigBlind: 50 };
const H = (suit: number, rank: number): Card => ({ suit, rank });

describe('game-c game-log — 确定性事件流（查 bug 基石）', () => {
  it('同 seed → 逐条日志一致；异 seed → 不同', () => {
    const a = replayDemoHand(20260717, CFG);
    const b = replayDemoHand(20260717, CFG);
    const c = replayDemoHand(20260718, CFG);
    expect(a.events).toEqual(b.events);
    expect(a.events).not.toEqual(c.events);
  });

  it('事件流覆盖 发牌→盲注→翻前行动→翻牌→翻牌圈→轮到主角', () => {
    const { events, st } = replayDemoHand(20260717, CFG);
    const tags = events.map((e) => e.tag);
    expect(tags[0]).toBe('deal');
    expect(tags).toContain('blind');
    expect(tags).toContain('action');
    expect(tags).toContain('street');
    expect(tags[tags.length - 1]).toBe('info');
    // 定格断言：轮到主角、翻牌圈、底池 300（6×50）
    expect(st.actor).toBe(0);
    expect(st.street).toBe('flop');
    expect(st.players.reduce((s, p) => s + p.total, 0)).toBe(300);
  });

  it('盲注行记录小盲/大盲座位与额度', () => {
    const { events } = replayDemoHand(20260717, CFG);
    const blind = events.find((e) => e.tag === 'blind')!;
    expect(blind.text).toContain('小盲 座1 缴 25');
    expect(blind.text).toContain('大盲 座2 缴 50');
  });

  it('翻牌行记录三张公共牌 + 底池', () => {
    const { events, flop } = replayDemoHand(20260717, CFG);
    const street = events.find((e) => e.tag === 'street')!;
    for (const c of flop) expect(street.text).toContain(cardStr(c));
    expect(street.text).toContain('底池 300');
  });

  it('describeAction 四类动作格式（M4 真交互复用同格式器）', () => {
    expect(describeAction(0, { kind: 'fold' }, 0)).toBe('主角(座0) 弃牌');
    expect(describeAction(1, { kind: 'check' }, 0)).toBe('大姨太(座1) 过牌');
    expect(describeAction(3, { kind: 'call' }, 50)).toBe('三姨太(座3) 跟注 50');
    expect(describeAction(0, { kind: 'raise', to: 150 }, 50)).toBe('主角(座0) 加注到 150');
  });
});

describe('game-c game-log — 完整一手 replay（牌逻辑全程：发牌→摊牌→分池）', () => {
  it('确定性：同 seed 逐字段一致；走满四街到摊牌', () => {
    const a = replayFullHand(20260717, CFG);
    const b = replayFullHand(20260717, CFG);
    expect(a.rows).toEqual(b.rows);
    expect(a.payouts).toEqual(b.payouts);
    expect(a.board).toHaveLength(5); // 翻+转+河 5 张公共牌
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
  });

  it('摊牌牌逻辑：六家 holdemRank 排名·赢家拿底池·筹码守恒', () => {
    const r = replayFullHand(20260717, CFG);
    expect(r.rows).toHaveLength(6); // 六家全摊牌（全跟到河牌）
    expect(r.potTotal).toBe(300); // 6×50
    expect(r.winners.length).toBeGreaterThanOrEqual(1);
    // 排名降序：rows[0] 是赢家之一
    expect(r.winners).toContain(r.rows[0].seat);
    // 分池守恒：payouts 总额 = 底池
    const paid = Object.values(r.payouts).reduce((s, n) => s + n, 0);
    expect(paid).toBe(300);
    // 事件流覆盖四街 + 摊牌
    const tags = r.events.map((e) => e.tag);
    expect(tags.filter((t) => t === 'street')).toHaveLength(3); // 翻/转/河
    expect(tags).toContain('showdown');
    expect(r.events[r.events.length - 1].text).toContain('赢得底池');
  });

  it('赢家成牌 5 张 + 中文牌型（摊牌屏投影用）', () => {
    const { rows, winners } = replayFullHand(20260717, CFG);
    const champ = rows.find((x) => winners.includes(x.seat))!;
    expect(champ.best).toHaveLength(5);
    expect(champ.type).toBeTruthy();
  });
});

describe('game-c game-log — 摊牌日志（排名·查bug）', () => {
  it('按牌力降序排名·冠军标🏆', () => {
    const board = [H(0, 14), H(1, 13), H(2, 5), H(3, 9), H(0, 2)];
    const ranks = new Map([
      [0, { hand: [H(0, 9), H(1, 9)], board }], // 三条9
      [1, { hand: [H(2, 14), H(3, 14)], board }], // 三条A（更大）
      [3, { hand: [H(0, 7), H(1, 6)], board }], // 高牌
    ]);
    const rows = showdownLog(ranks) as GameEvent[];
    expect(rows).toHaveLength(3);
    expect(rows[0].text).toContain('🏆');
    expect(rows[0].text).toContain('大姨太'); // 座1 三条A 冠军
    expect(rows[1].text).toContain('主角'); // 座0 三条9 第2
    expect(rows[2].text).toContain('三姨太'); // 座3 高牌 末位
  });

  it('平手同名次（确定性 seat tie-break）', () => {
    const board = [H(0, 14), H(1, 13), H(2, 5), H(3, 9), H(0, 2)];
    const tie = { hand: [H(0, 3), H(1, 4)], board }; // 双方打公共牌 A-high
    const rows = showdownLog(new Map([[2, tie], [4, tie]]));
    expect(rows).toHaveLength(2);
    expect(rows[0].text).toContain('座2'); // seat 升序 tie-break
  });
});
