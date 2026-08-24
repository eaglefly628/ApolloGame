import { describe, it, expect } from 'vitest';
import { GameSession } from './session.js';
import { STARTER_JOKERS } from './jokers.js';
import { planetForHand } from './planets.js';
import { handScoreAtLevel } from './hand-rankings.js';
import { blindRequirement } from './blinds.js';
import { toEngineCard, jokerToEntities } from './blueprint.js';

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

  it('过线→won-blind→nextBlind 推进盲注/Ante（seed 13 实测第 3 手过线·钉单值）', () => {
    // 加固（2026-08-24）：原 toContain(['won-blind','lost','continue']) 三态全收=什么都没钉，
    // nextBlind 断言又包在 if 里——seed 1 实测 4 手全 'lost' 不过线，该分支从未执行过（空转绿）。
    // 换 seed 13（实测：前两手 continue·第 3 手 roundScore 311 ≥ 300 过线 won-blind）→ 全部无条件化。
    const s = new GameSession(13);
    expect(s.play([0, 1, 2, 3, 4])!.outcome).toBe('continue');
    expect(s.play([0, 1, 2, 3, 4])!.outcome).toBe('continue');
    const res = s.play([0, 1, 2, 3, 4]);
    expect(res!.outcome).toBe('won-blind'); // 钉死实际 outcome 单值
    expect(s.roundScore).toBeGreaterThanOrEqual(s.target); // 过线的定义性前置
    s.nextBlind(); // 无条件推进断言
    expect(s.ante).toBe(1); // small→big 不换 Ante
    expect(s.blindIdx).toBe(1); // 0(small) → 1(big)
    expect(s.blindKind).toBe('big');
    expect(s.roundScore).toBe(0); // 新盲注重置
    expect(s.handsLeft).toBe(4);
    expect(s.discardsLeft).toBe(3);
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

  it('含同花小丑(REQ-E-022)：打出同花 → Crafty +80 筹码生效（引擎 isFlush Flag → 门 → effect）', () => {
    const flush5: { suit: 'spades'; rank: '2' | '5' | '7' | '9' | 'K' }[] = [
      { suit: 'spades', rank: '2' }, { suit: 'spades', rank: '5' }, { suit: 'spades', rank: '7' }, { suit: 'spades', rank: '9' }, { suit: 'spades', rank: 'K' },
    ];
    const fillers = [{ suit: 'hearts', rank: '3' }, { suit: 'clubs', rank: '4' }, { suit: 'diamonds', rank: '6' }] as const;
    const plain = new GameSession(1);
    plain.hand = [...flush5, ...fillers] as never;
    const r0 = plain.play([0, 1, 2, 3, 4])!;
    expect(r0.type).toBe('flush');

    const withJ = new GameSession(1);
    expect(withJ.buyJoker(STARTER_JOKERS.find((j) => j.id === 'crafty_joker')!)).toBe(true); // 含同花 +80 筹码
    withJ.hand = [...flush5, ...fillers] as never;
    const r1 = withJ.play([0, 1, 2, 3, 4])!;
    expect(r1.type).toBe('flush');
    expect(r1.chips).toBe(r0.chips + 80); // Crafty 的 +80 筹码确实加上了
  });

  it('双产出小丑(B组)：Scholar 每张 A +20筹+4倍 两条效果都生效', () => {
    const hand5 = [
      { suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }, { suit: 'spades', rank: 'Q' }, { suit: 'spades', rank: 'J' },
    ];
    const fillers = [{ suit: 'clubs', rank: '3' }, { suit: 'diamonds', rank: '6' }, { suit: 'hearts', rank: '8' }] as const;
    const plain = new GameSession(1);
    plain.hand = [...hand5, ...fillers] as never;
    const r0 = plain.play([0, 1, 2, 3, 4])!; // 一对 A，计分牌=2 张 A

    const withJ = new GameSession(1);
    expect(withJ.buyJoker(STARTER_JOKERS.find((j) => j.id === 'scholar')!)).toBe(true); // cost 4 = 起始钱
    withJ.hand = [...hand5, ...fillers] as never;
    const r1 = withJ.play([0, 1, 2, 3, 4])!;
    expect(r1.chips).toBe(r0.chips + 40); // 2 张 A × +20 筹码
    expect(r1.mult).toBe(r0.mult + 8); // 2 张 A × +4 倍率（extra 第二条效果）
  });

  it('计数缩放(REQ-E-023①)：Abstract Joker 每小丑 +3 倍（countOf 数 JOKER tag）', () => {
    const hand5 = [
      { suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: 'K' }, { suit: 'clubs', rank: '9' }, { suit: 'diamonds', rank: '7' }, { suit: 'spades', rank: '4' },
    ]; // 高牌（无对/顺/同花）
    const fillers = [{ suit: 'clubs', rank: '2' }, { suit: 'diamonds', rank: '3' }, { suit: 'hearts', rank: '5' }] as const;
    const plain = new GameSession(1);
    plain.hand = [...hand5, ...fillers] as never;
    const r0 = plain.play([0, 1, 2, 3, 4])!;
    const withJ = new GameSession(1);
    expect(withJ.buyJoker(STARTER_JOKERS.find((j) => j.id === 'abstract_joker')!)).toBe(true);
    withJ.hand = [...hand5, ...fillers] as never;
    const r1 = withJ.play([0, 1, 2, 3, 4])!;
    expect(r1.mult).toBe(r0.mult + 3); // 拥有 1 个小丑（自身）→ +3×1 倍率
  });

  it('概率门(REQ-E-023②)：Bloodstone 接成带 chance 的 PerCardRule（引擎逐张 roll）', () => {
    const s = new GameSession(1);
    expect(s.buyJoker(STARTER_JOKERS.find((j) => j.id === 'business_card')!)).toBe(true); // cost 4
    // 出一手含人头牌，多次不报错（命中与否由世界 RNG 定，确定性、不崩）。
    s.hand = [{ suit: 'spades', rank: 'K' }, { suit: 'hearts', rank: 'Q' }, { suit: 'clubs', rank: 'J' }, { suit: 'diamonds', rank: '9' }, { suit: 'spades', rank: '7' }, { suit: 'clubs', rank: '2' }, { suit: 'diamonds', rank: '3' }, { suit: 'hearts', rank: '5' }] as never;
    const r = s.play([0, 1, 2, 3, 4]);
    expect(r).not.toBeNull();
    // 加固（2026-08-24）：原 toBeGreaterThanOrEqual(0) 恒真（money min=0 夹取）。seed 确定 → 钉终值。
    // seed 1 实测值：起始 $4 − 购价 $4 = $0，本局概率门未命中（K/Q/J 三张 roll 全空）→ 终值恰 $0。
    expect(s.money).toBe(0);
  });

  it('留手牌(REQ-E-023③)：Baron/Shoot the Moon 接成 held PerCardRule（留手 pass 求值）', () => {
    const baron = jokerToEntities(STARTER_JOKERS.find((j) => j.id === 'baron')!, 0);
    const pcr = (baron['j_baron'] as unknown as { PerCardRule: { held?: boolean; op: string; when: { ranks: number[] } } }).PerCardRule;
    expect(pcr.held).toBe(true); // 对留手牌求值
    expect(pcr.op).toBe('mul');
    expect(pcr.when.ranks).toEqual([13]); // K
  });

  it('判型修饰(REQ-E-023⑤)：Four Fingers 接成无计分实体的 tag-only（被动，买入点 mod flag）', () => {
    const ff = jokerToEntities(STARTER_JOKERS.find((j) => j.id === 'four_fingers')!, 0);
    const e = ff['j_four_fingers'] as unknown as Record<string, unknown>;
    expect(e.PerCardRule).toBeUndefined();
    expect(e.Effect).toBeUndefined();
    expect(e.Tag).toBeDefined(); // 仅占 tag（供 countOf 计入）
  });

  it('自增长(REQ-E-023④)：Green Joker 每出一手 +1 倍率累加', () => {
    const hi = [{ suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: 'K' }, { suit: 'clubs', rank: '9' }, { suit: 'diamonds', rank: '7' }, { suit: 'spades', rank: '4' }, { suit: 'clubs', rank: '2' }, { suit: 'diamonds', rank: '3' }, { suit: 'hearts', rank: '5' }];
    const s = new GameSession(1);
    expect(s.buyJoker(STARTER_JOKERS.find((j) => j.id === 'green_joker')!)).toBe(true); // cost 4 = 起始钱
    s.hand = [...hi] as never;
    const r1 = s.play([0, 1, 2, 3, 4])!; // 计数 0 → +0；出牌后 +1
    s.hand = [...hi] as never;
    const r2 = s.play([0, 1, 2, 3, 4])!; // 计数 1 → +1 倍率
    expect(r2.mult).toBe(r1.mult + 1);
  });

  it('被动小丑：Juggler 手牌 +1 / Drunkard 弃牌 +1（每道开局读 owned）', () => {
    const s = new GameSession(1);
    expect(s.buyJoker(STARTER_JOKERS.find((j) => j.id === 'juggler')!)).toBe(true); // cost 4
    s.blindIdx = 1; s.startBlind(); // 重开一道（大盲注），被动生效
    expect(s.hand.length).toBe(9); // 8 + 1
    const s2 = new GameSession(1);
    s2.buyJoker(STARTER_JOKERS.find((j) => j.id === 'drunkard')!);
    s2.blindIdx = 1; s2.startBlind();
    expect(s2.discardsLeft).toBe(4); // 3 + 1
    expect(s2.hand.length).toBe(8);
  });

  it('Boss 诅咒：boss 道按表施加（Ante1 高墙=盲注线翻倍）', () => {
    const s = new GameSession(1);
    expect(s.boss).toBeNull(); // small 道无 boss
    s.blindIdx = 2; s.startBlind();
    expect(s.boss?.id).toBe('the_wall');
    expect(s.target).toBe(blindRequirement(1, 'boss') * 2);
  });

  it('Boss 诅咒（追加）：燧石牌型基础分减半 / 尖牙出牌扣 $', () => {
    // ante9 = 燧石(halve_base)：pair 基础 {10,2} → {5,1}。
    const flint = new GameSession(1); flint.ante = 9; flint.blindIdx = 2; flint.startBlind();
    expect(flint.boss?.effect).toBe('halve_base');
    expect(flint.handBase('pair')).toEqual({ chips: 5, mult: 1 });
    // 离开燧石道（普通道）→ 基础分还原。
    flint.ante = 9; flint.blindIdx = 0; flint.startBlind();
    expect(flint.handBase('pair')).toEqual({ chips: 10, mult: 2 });
    // ante10 = 尖牙(pay_per_play)：出 5 张扣 $5。
    const tooth = new GameSession(1); tooth.ante = 10; tooth.blindIdx = 2; tooth.startBlind();
    expect(tooth.boss?.effect).toBe('pay_per_play');
    const before = tooth.money;
    tooth.play([0, 1, 2, 3, 4]); // ante10 盲注线极高，单手不过线 → 无奖励，净扣 5
    expect(tooth.money).toBe(before - 5);
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

// ⚔ 对抗性输入（docs/playbooks/testing.md ⚔ 清单·加固 2026-08-24）：
// 三条拒绝路径——额度尽的弃牌键 / 买不起的购卡键（⚔「点已禁用的键」）/ 越界下标出牌（⚔ 同行「禁用是真
// 禁用还是只画灰」——sim 层收到 UI 本不该给的输入时的真实行为）。
describe('game-e · GameSession ⚔ 拒绝路径', () => {
  it('discardsLeft=0 再弃 → false·手牌/额度零变化（⚔「点已禁用的键」）', () => {
    const s = new GameSession(1);
    expect(s.discard([0])).toBe(true);
    expect(s.discard([0])).toBe(true);
    expect(s.discard([0])).toBe(true); // 3 次额度用尽
    expect(s.discardsLeft).toBe(0);
    const hand = s.hand.map((c) => `${c.suit}${c.rank}`).join(',');
    const hl = s.handsLeft;
    expect(s.discard([0])).toBe(false); // 第 4 次：拒绝
    expect(s.discardsLeft).toBe(0); // 不掉成负
    expect(s.hand.map((c) => `${c.suit}${c.rank}`).join(',')).toBe(hand); // 不弃不补·手牌原样
    expect(s.handsLeft).toBe(hl); // 也不误耗出牌数
  });

  it('钱不够 buyJoker → false·钱/owned/引擎零注入（⚔「点已禁用的键」）', () => {
    const s = new GameSession(1);
    expect(s.money).toBe(4); // 起始 $4（实测）
    const dear = STARTER_JOKERS.find((j) => j.id === 'triboulet')!; // cost 20 > 4
    expect(dear.cost).toBeGreaterThan(s.money);
    expect(s.buyJoker(dear)).toBe(false); // 拒绝
    expect(s.money).toBe(4); // 没扣钱
    expect(s.owned).toHaveLength(0); // 没入手
    const r = s.play([0, 1, 2, 3, 4]); // 出一手：未注入的小丑不得参与计分（引擎侧也干净）
    expect(r).not.toBeNull();
  });

  it('play 全越界下标 → 实测非 no-op：空手计分 0 分·不动手牌不加分·仍耗一手（钉现状）', () => {
    // ⚠ 评审假设「越界下标 no-op」与实测不符——如实按真实行为钉（不改游戏逻辑·2026-08-24 实跑）：
    //   play([99]) selected 非空过闸 → chosen 过滤成空手照走计分 tick → {score:0, outcome:'continue'}，
    //   handsLeft 4→3（耗一手），手牌/roundScore 不变。UI 只会给手内下标·此为 sim 层现状基线。
    const s = new GameSession(1);
    const hand = s.hand.map((c) => `${c.suit}${c.rank}`).join(',');
    const r = s.play([99]);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(0); // 空手 0 分
    expect(r!.chips).toBe(0);
    expect(r!.mult).toBe(0);
    expect(r!.outcome).toBe('continue');
    expect(s.handsLeft).toBe(3); // 实测：耗一手（非 no-op·钉现状）
    expect(s.roundScore).toBe(0); // 不加分
    expect(s.hand.map((c) => `${c.suit}${c.rank}`).join(',')).toBe(hand); // 手牌原样（无移无补）
    expect(s.hand).toHaveLength(8);
    expect(s.play([])).toBeNull(); // 空选 = 真拒绝腿（null·不耗手）
    expect(s.handsLeft).toBe(3);
  });
});
