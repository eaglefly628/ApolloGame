// turn-combat 单机回合制核（doc24 · A0 重构）：回合状态机 + 离散 9 格 slot 棋盘 + 互斥动作 + 推进/遭遇掷命(复用 clash-resolve) + 确定性 hash。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './live-combat.js';
import {
  initTurnBattle, drawCard, deployUnit, castTengang, discardCard, endTurn, aiTakeTurn, turnHash, turnActive,
  MANA_START, A_DEPLOY_SLOT, A_GOAL, TURN_HOME_BLOOD,
  type PokerCard, type TengangHandCard, type TurnUnit, type TurnBattle,
} from './turn-combat.js';

const poker = (id: string, rank: string, suit = 'S', buff = 0, general = false): PokerCard => ({ kind: 'poker', id, rank, suit, general, buff });
const tg = (id: string): TengangHandCard => ({ kind: 'tengang', id });
const unit = (id: string, rank: string, slot: number, buff = 0, general = false): TurnUnit =>
  ({ id, rank, suit: 'S', points: cardPoints(rank), buff, general, stamina: cardStamina(rank), staminaLeft: cardStamina(rank), slot });

describe('Game G · turn-combat（doc24 单机回合制 · A0 重构）', () => {
  it('init：A 先手·圣水起步·双方 3 血·空轨', () => {
    const b = initTurnBattle({ seed: 1 });
    expect(b.active).toBe('a'); expect(b.turn).toBe(1);
    expect(b.a.mana).toBe(MANA_START); expect(b.b.mana).toBe(0); // 后手 b 回合开始才 +1
    expect(b.homeA).toBe(TURN_HOME_BLOOD); expect(b.homeB).toBe(TURN_HOME_BLOOD);
    expect(b.lanes.every((l) => l.a.length === 0 && l.b.length === 0)).toBe(true);
  });

  it('抽牌：花圣水进手牌；圣水不够停', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('p0', '7'), poker('p1', '8')] } });
    expect(drawCard(b, 'a', 'poker')).toBe(true);
    expect(b.a.hand.length).toBe(1); expect(b.a.mana).toBe(0); expect(b.actionTaken).toBe('draw');
    expect(drawCard(b, 'a', 'poker')).toBe(false); // 圣水 0 → 停
    expect(b.a.hand.length).toBe(1);
  });

  it('互斥：本回合只能一类动作（抽后不能放）；弃牌免费且互斥', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('p0', '7')] } });
    b.a.mana = 5; b.a.hand.push(poker('h0', 'K'));
    expect(drawCard(b, 'a', 'poker')).toBe(true);   // 选了"抽"
    expect(deployUnit(b, 'a', 1, 0)).toBe(false);   // 同回合不能再"放"
    // 弃牌：另起一局验免费
    const c = initTurnBattle({ seed: 1 }); c.a.hand.push(poker('h0', 'K'), poker('h1', '3'));
    const manaBefore = c.a.mana;
    expect(discardCard(c, 'a', 0)).toBe(true);
    expect(c.a.mana).toBe(manaBefore); // 弃牌不耗圣水
    expect(c.a.hand.length).toBe(1); expect(c.actionTaken).toBe('discard');
    expect(drawCard(c, 'a', 'poker')).toBe(false);  // 已锁 discard → 不能抽
  });

  it('放牌：扑克兵上场到我方部署格 + 花圣水；放牌可顺手开门', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 2; b.a.hand.push(poker('h0', 'Q'));
    expect(deployUnit(b, 'a', 0, 1, true)).toBe(true);
    expect(b.lanes[1].a.length).toBe(1);
    expect(b.lanes[1].a[0].slot).toBe(A_DEPLOY_SLOT);
    expect(b.lanes[1].gate).toBe(true);              // 附赠开门
    expect(b.a.mana).toBe(1); expect(b.actionTaken).toBe('deploy');
    expect(turnActive(b)).toBe(true);                // 场上有兵 → 未决
  });

  it('endTurn：active 方推进自己兵一格 + 切换 + 下一方 +1 圣水', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].a.push(unit('a0', '7', A_DEPLOY_SLOT)); // 我方兵在部署格
    endTurn(b);
    expect(b.lanes[0].a[0].slot).toBe(A_DEPLOY_SLOT + 1); // 向敌家推一格
    expect(b.active).toBe('b'); expect(b.b.mana).toBe(1); // 后手开局 +1
    expect(b.turn).toBe(2);
  });

  it('无敌路推进到底 → 敌大本营 −1 血、该兵退场', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].a.push(unit('a0', '7', A_DEPLOY_SLOT));
    let guard = 0;
    while (b.homeB === TURN_HOME_BLOOD && guard++ < 40) endTurn(b); // 反复推进直到抵敌家
    expect(b.homeB).toBe(TURN_HOME_BLOOD - 1);
    expect(b.lanes[0].a.length).toBe(0); // 抵家后退场
  });

  it('相邻遭遇 → 掷命对决（复用 clash-resolve）；战力相等按点数大者胜(确定性)', () => {
    const b = initTurnBattle({ seed: 1 });
    // A: 5 点 +9 buff = pEff 14；B: K(13) +1 buff = pEff 14 → 平 → 点数大者(K 13 > 5)胜 → A 阵亡。
    b.lanes[0].a.push(unit('a0', '5', A_DEPLOY_SLOT, 9));
    b.lanes[0].b.push(unit('b0', 'K', A_DEPLOY_SLOT + 2, 1)); // 敌前锋 2 格外
    endTurn(b); // A 推进 → 与 B 相邻 → 掷命
    expect(b.clashSeq).toBe(1);
    expect(b.lastClash?.tie).toBe('points');
    expect(b.lastClash?.aWins).toBe(false);
    expect(b.lanes[0].a.length).toBe(0); // A 输 → 阵亡
    expect(b.lanes[0].b.length).toBe(1);
  });

  it('判负：大本营血归 0 → 该方负', () => {
    const b = initTurnBattle({ seed: 1, homeMax: 1 });
    b.lanes[0].a.push(unit('a0', 'A', A_GOAL)); // 已在敌区末格 → 下次推进越线破家
    let guard = 0;
    while (b.winner === 'pending' && guard++ < 10) endTurn(b);
    expect(b.homeB).toBe(0); expect(b.winner).toBe('a');
  });

  it('确定性：同 seed + 同脚本 → 逐回合 turnHash 完全一致；掷命真消费 rng（复用 clash 核）', () => {
    const run = (seed: number): { hashes: string[]; clashSeq: number } => {
      const b = initTurnBattle({
        seed,
        a: { pokerDeck: [poker('a0', '9'), poker('a1', 'J'), poker('a2', '6')] },
        b: { pokerDeck: [poker('z0', '8'), poker('z1', 'Q'), poker('z2', '4')] },
      });
      const hashes: string[] = [turnHash(b)];
      let guard = 0;
      while (turnActive(b) && b.winner === 'pending' && guard++ < 200) {
        if (b.active === 'a') {
          const pi = b.a.hand.findIndex((c) => c.kind === 'poker');
          if (pi >= 0 && b.a.mana >= 1 && b.actionTaken === null) deployUnit(b, 'a', pi, guard % 3);
          else if (b.a.mana >= 1 && b.actionTaken === null && b.a.pokerDeck.length) drawCard(b, 'a', 'poker');
          endTurn(b);
        } else {
          aiTakeTurn(b);
        }
        hashes.push(turnHash(b));
      }
      return { hashes, clashSeq: b.clashSeq };
    };
    const r1 = run(20), r2 = run(20);
    expect(r1.hashes).toEqual(r2.hashes);     // 逐回合 hash 完全一致（确定性 · 同输入同 seed 可回放）
    expect(r1.clashSeq).toBeGreaterThan(0);   // 掷命真发生过 → rng 真消费、clash 核真被复用
  });

  it('castTengang：天罡进 castIds + 花圣水（持续修正由 caller 经 aggregateTengang 重算）', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 2; b.a.hand.push(tg('hufu'));
    expect(castTengang(b, 'a', 0)).toBe(true);
    expect(b.a.castIds).toEqual(['hufu']); expect(b.a.mana).toBe(1); expect(b.actionTaken).toBe('cast');
  });
});
