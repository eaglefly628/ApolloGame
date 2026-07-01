// 天罡·回合制接搁浅维度（doc20 §二·design G 2026-06-20 派甲）行为测试：morale(哀兵/督战) · stamina(薪火) · draw(川流/广纳/战潮) · siege(死守/攻城锤)。
// 直接设 tengangA（绕过聚合器·只验 turn-combat 的 apply 钩子）。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina, NO_TENGANG } from './combat-types.js';
import { initTurnBattle, deployUnit, drawCard, endTurn, HAND_MAX, A_GOAL, B_GOAL, type TurnUnit, type PokerCard } from './turn-combat.js';

const unit = (id: string, rank: string, slot: number, buff = 0, general = false): TurnUnit =>
  ({ id, rank, suit: 'S', points: cardPoints(rank), buff, general, stamina: cardStamina(rank), staminaLeft: cardStamina(rank), slot });
const poker = (id: string, rank: string): PokerCard => ({ kind: 'poker', id, rank, suit: 'S', general: false, buff: 0 });

describe('Game G · 天罡回合制接搁浅维度（morale/stamina/draw/siege·甲实装）', () => {
  it('哀兵(revenge)：我主将亡 → 该路余部 +14（替溃散）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.tengangA = { ...NO_TENGANG, revenge: 14 };
    b.lanes[0].aGenDead = true; // 主将已亡
    b.lanes[0].a = [unit('a0', '9', 4)]; b.lanes[0].b = [unit('b0', '9', 5)];
    endTurn(b); endTurn(b); // 行动阶段一场遭遇
    expect(b.lastClash?.a.morale).toBe(14); // 余部暴怒(非 −ROUT)
  });

  it('督战(noRout)：我主将亡 → 不溃散（士气位 0·非 −ROUT）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.tengangA = { ...NO_TENGANG, noRout: 1 };
    b.lanes[0].aGenDead = true;
    b.lanes[0].a = [unit('a0', '9', 4)]; b.lanes[0].b = [unit('b0', '9', 5)];
    endTurn(b); endTurn(b); // 行动阶段一场遭遇
    expect(b.lastClash?.a.morale).toBe(0); // 不溃
  });

  it('薪火(relay)：一张阵亡 → 同路下一张接棒续航 +2', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.tengangA = { ...NO_TENGANG, relay: 2 };
    b.lanes[0].a = [unit('a0', '2', 4, -1), unit('a1', '9', 3)]; // 弱前锋(pEff1·恒掷1) + 后备
    b.lanes[0].b = [unit('b0', 'A', 5, 20)];                  // 碾压敌(pEff30)→ 我前锋掷1必负(掷平也按战力判敌)→必死
    endTurn(b); // 顺序回合：我方放完即推进→我前锋攻 b0 必死→薪火接棒（此刻查·尚未轮到敌方反扑·owner ②）
    expect(b.lanes[0].a.some((u) => u.id === 'a0')).toBe(false);   // 前锋阵亡
    const back = b.lanes[0].a.find((u) => u.id === 'a1');
    expect(back?.staminaLeft).toBe(cardStamina('9') + 2);         // 接棒 +2
  });

  it('战潮(clashElixir)：每遭遇掷命 → 返 1 召唤源泉', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.tengangA = { ...NO_TENGANG, clashElixir: 1 }; b.a.mana = 0;
    b.lanes[0].a = [unit('a0', '9', 4)]; b.lanes[0].b = [unit('b0', '9', 5)];
    endTurn(b); endTurn(b); // 行动阶段一场遭遇 → 进下一轮我方放置
    expect(b.a.mana).toBe(2); // 战潮返 1 + 新一轮放置回合 +1（无战潮则只 1·此处验返还）
  });

  it('川流(onPlay)：放牌后免费补抽 1 张', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.tengangA = { ...NO_TENGANG, onPlay: 1 };
    b.a.mana = 2; b.a.hand = [poker('h0', 'Q')]; b.a.pokerDeck = [poker('d0', '7')];
    expect(deployUnit(b, 'a', 0, 1)).toBe(true);
    expect(b.a.hand.map((c) => c.id)).toEqual(['d0']); // 补抽到 d0
    expect(b.a.pokerDeck.length).toBe(0);
  });

  it('广纳(handMax)：手牌上限 8 → +2 = 10', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.mana = 20;
    b.a.hand = Array.from({ length: HAND_MAX }, (_, i) => poker('h' + i, '7'));
    b.a.pokerDeck = [poker('d0', '8'), poker('d1', '9')];
    expect(drawCard(b, 'a', 'poker')).toBe(false);          // 满 8 → 不能抽
    b.a.tengangA = { ...NO_TENGANG, handMaxAdd: 2 };
    expect(drawCard(b, 'a', 'poker')).toBe(true);           // 上限抬到 10 → 能抽
    expect(b.a.hand.length).toBe(HAND_MAX + 1);
  });

  it('死守(siegeDefend)：我大本营首次被破免疫（吸收·不掉血）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.tengangA = { ...NO_TENGANG, siegeDefend: 1 }; b.active = 'b';
    b.lanes[0].b = [unit('b0', '7', B_GOAL)]; // 敌已抵我家边缘
    endTurn(b); // 敌越线破家 → 死守吸收
    expect(b.homeA).toBe(b.homeMax);     // 未掉血
    expect(b.homeAShieldUsed).toBe(1);
  });

  it('攻城锤(siegeChip)：我兵破敌大本营 → 多 chip 1（共 −2）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.tengangA = { ...NO_TENGANG, siegeChip: 1 };
    b.lanes[0].a = [unit('a0', '7', A_GOAL)]; // 我兵已抵敌家末格
    endTurn(b); endTurn(b); // 行动阶段：越线破敌家 → −2
    expect(b.homeB).toBe(b.homeMax - 2);
  });
});
