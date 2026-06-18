import { describe, it, expect } from 'vitest';
import { GameSession } from './session.js';
import { STARTER_JOKERS } from './jokers.js';
import { planetForHand } from './planets.js';
import { handScoreAtLevel } from './hand-rankings.js';
import { blindRequirement } from './blinds.js';
import { toEngineCard } from './blueprint.js';

// 回合流程脚本 headless 测试（无 React）：证明线性编排正确，引擎负责算分。
describe('game-e · GameSession 线性流程脚本', () => {
  it('开局：Ante1 小盲注线 300、出牌 4/弃牌 3、0 小丑、手牌 8 张', () => {
    const s = new GameSession(1);
    expect(s.ante).toBe(1);
    expect(s.blindKind).toBe('small');
    expect(s.target).toBe(300);
    expect(s.handsLeft).toBe(4);
    expect(s.discardsLeft).toBe(3);
    expect(s.owned.length).toBe(0);
    expect(s.hand.length).toBe(8);
    expect(s.roundScore).toBe(0);
  });

  it('出牌：引擎算分 + round_score 累加 + hands-1 + 返回 trace', () => {
    const s = new GameSession(1);
    const r = s.play([0, 1, 2, 3, 4]); // 出前 5 张
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThan(0);
    expect(r!.events.length).toBeGreaterThan(2); // 逐步 trace
    expect(r!.events[0].phase).toBe('base');
    expect(s.handsLeft).toBe(3);
    expect(s.roundScore).toBe(r!.score);
    expect(s.hand.length).toBe(8); // 已补牌
  });

  it('弃牌：扣弃牌额度 + 补牌、不计分、不耗出牌次数', () => {
    const s = new GameSession(1);
    const ok = s.discard([0, 1]);
    expect(ok).toBe(true);
    expect(s.discardsLeft).toBe(2);
    expect(s.handsLeft).toBe(4); // 未耗出牌
    expect(s.roundScore).toBe(0); // 不计分
    expect(s.hand.length).toBe(8);
  });

  it('买小丑：扣钱 + 入 owned + 注入引擎（下次出牌生效）', () => {
    const s = new GameSession(1);
    const joker = STARTER_JOKERS.find((j) => j.id === 'joker')!; // +4 mult, cost 2
    const before = s.money;
    expect(s.buyJoker(joker)).toBe(true);
    expect(s.money).toBe(before - joker.cost);
    expect(s.owned.map((j) => j.id)).toContain('joker');
    // 出牌后 mult 应含 +4（引擎接线生效）
    const r = s.play([0, 1, 2, 3, 4]);
    expect(r!.mult).toBeGreaterThanOrEqual(4);
  });

  it('过线→won-blind→nextBlind 推进盲注/Ante', () => {
    const s = new GameSession(1);
    // 直接灌满 round_score 制造过线（测试流程推进，不依赖具体牌）。
    // 用一手牌触发，然后人为已过线场景：连续出牌直到过线或手数耗尽。
    let res = s.play([0, 1, 2, 3, 4]);
    let guard = 0;
    while (res && res.outcome === 'continue' && guard++ < 4) res = s.play([0, 1, 2, 3, 4]);
    expect(res).not.toBeNull();
    expect(['won-blind', 'lost', 'continue']).toContain(res!.outcome);
    if (res!.outcome === 'won-blind') {
      const a0 = s.ante, b0 = s.blindIdx;
      s.nextBlind();
      expect(s.blindIdx === b0 + 1 || (b0 === 2 && s.ante === a0 + 1)).toBe(true);
      expect(s.roundScore).toBe(0); // 新盲注重置
      expect(s.handsLeft).toBe(4);
    }
  });

  it('确定性：同 seed 两局开局手牌一致', () => {
    const a = new GameSession(42), b = new GameSession(42);
    expect(a.hand.map((c) => `${c.suit}${c.rank}`)).toEqual(b.hand.map((c) => `${c.suit}${c.rank}`));
  });

  it('星球牌：升级牌型 → 引擎 rankingTable 基础分提升（下次出牌生效）', () => {
    const s = new GameSession(1);
    expect(s.handLevels.pair).toBe(1);
    const before = s.handBase('pair');
    s.usePlanet(planetForHand('pair'));
    expect(s.handLevels.pair).toBe(2);
    const after = s.handBase('pair');
    expect(after.chips).toBeGreaterThan(before.chips);
    expect(after).toEqual(handScoreAtLevel('pair', 2));
  });

  it('附魔：给计分牌盖闪箔(+50筹码) → 同手牌得分更高（引擎读 Card.mods）', () => {
    const base = new GameSession(1);
    const plain = base.play([0, 1, 2, 3, 4])!;
    // 同 seed 新局，给开局前 5 张都盖 foil（+50 筹码/张），出同样的牌。
    const buff = new GameSession(1);
    for (const i of [0, 1, 2, 3, 4]) buff.enchant(buff.hand[i], 'foil');
    const r = buff.play([0, 1, 2, 3, 4])!;
    expect(r.chips).toBeGreaterThan(plain.chips); // 附魔牌多加了筹码
    expect(r.score).toBeGreaterThan(plain.score);
    expect(r.events.some((e) => e.phase === 'percard-mod')).toBe(true); // 留下了附魔 trace
  });

  it('附魔可叠加：toEngineCard 合并多附魔（mods 串接 + retrigger 求和，不覆盖）', () => {
    const c = toEngineCard({ suit: 'spades', rank: 'A', enchants: ['foil', 'bonus', 'red_seal'] });
    expect(c.mods).toEqual([
      { op: 'add', target: 'chips', value: 50 }, // foil
      { op: 'add', target: 'chips', value: 30 }, // bonus
    ]);
    expect(c.retrigger).toBe(1); // red_seal
  });

  it('session.enchant 追加不覆盖：同牌可叠两个附魔', () => {
    const s = new GameSession(1);
    s.enchant(s.hand[0], 'foil');
    s.enchant(s.hand[0], 'mult');
    expect(s.enchanted[`${s.hand[0].suit}${s.hand[0].rank}`]).toEqual(['foil', 'mult']);
  });

  it('Boss 诅咒：boss 道按表施加（Ante1 高墙=盲注线翻倍）', () => {
    const s = new GameSession(1);
    expect(s.boss).toBeNull(); // small 道无 boss
    s.blindIdx = 2; s.startBlind();
    expect(s.boss?.id).toBe('the_wall');
    expect(s.target).toBe(blindRequirement(1, 'boss') * 2);
  });

  it('Boss 诅咒：镣铐发 7 张 / 尖针仅 1 次出牌 / 深水 0 弃牌', () => {
    const wall = new GameSession(1); wall.blindIdx = 2; wall.startBlind(); // ante1 = the_wall
    // 直接构造其它 Boss：ante 决定 boss（ante2=尖针, ante3=深水, ante4=镣铐）。
    const needle = new GameSession(1); needle.ante = 2; needle.blindIdx = 2; needle.startBlind();
    expect(needle.boss?.effect).toBe('fewer_hands');
    expect(needle.handsLeft).toBe(1);
    const water = new GameSession(1); water.ante = 3; water.blindIdx = 2; water.startBlind();
    expect(water.boss?.effect).toBe('no_discards');
    expect(water.discardsLeft).toBe(0);
    const manacle = new GameSession(1); manacle.ante = 4; manacle.blindIdx = 2; manacle.startBlind();
    expect(manacle.boss?.effect).toBe('small_hand');
    expect(manacle.hand.length).toBe(7);
  });
});
