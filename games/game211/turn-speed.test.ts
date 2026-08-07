// 行军速度（owner 2026-06-21：大王/小王(★/王/JOKER) 与 老K 疾行 2 格/回合）实装验收。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { initTurnBattle, deployUnit, endTurn, unitSpeed, type TurnBattle } from './turn-combat.js';

const giveHand = (b: TurnBattle, rank: string): void => { b.a.hand.push({ kind: 'poker', id: rank + '1', rank, suit: 'S', general: false, buff: 0 }); };

describe('Game G · 行军速度（owner 2026-06-21）', () => {
  it('unitSpeed：★/王/JOKER/老K → 2 格；其余 → 1 格', () => {
    for (const r of ['★', '王', 'JOKER', 'K']) expect(unitSpeed(r)).toBe(2);
    for (const r of ['A', 'Q', 'J', '10', '7', '2']) expect(unitSpeed(r)).toBe(1);
  });

  it('空路推进：K 一回合走 2 格、普通牌(7) 走 1 格', () => {
    const b = initTurnBattle({ seed: 1 });
    giveHand(b, 'K'); expect(deployUnit(b, 'a', 0, 0)).toBe(true); // 上路·落部署区 slot 0
    endTurn(b); endTurn(b); // 走完双方放置 → 行动阶段推进
    expect(b.lanes[0].a[0].slot).toBe(2); // 0 → 2（疾行）

    const c = initTurnBattle({ seed: 1 });
    giveHand(c, '7'); deployUnit(c, 'a', 0, 0); endTurn(c); endTurn(c);
    expect(c.lanes[0].a[0].slot).toBe(1); // 0 → 1（常速）
  });

  it('疾行兵不越过敌前锋：停在敌前一格触发掷命·不与敌重叠', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].b.push({ id: 'e', rank: '9', suit: 'S', points: cardPoints('9'), buff: 0, general: false, stamina: 3, staminaLeft: 3, slot: 3 }); // 敌兵深入到我半区 slot 3
    giveHand(b, 'K'); deployUnit(b, 'a', 0, 0); // 我 K 落 slot 0·speed 2
    endTurn(b); endTurn(b); // 行动阶段：两军同时推进
    expect(b.lastClash).not.toBeNull(); // 疾行贴上敌前锋 → 触发掷命
    // 无论谁胜，场上不会出现我兵与敌兵同格(越位重叠)
    const occ = new Map<number, number>();
    for (const u of [...b.lanes[0].a, ...b.lanes[0].b]) occ.set(u.slot, (occ.get(u.slot) ?? 0) + 1);
    for (const n of occ.values()) expect(n).toBe(1);
  });
});
