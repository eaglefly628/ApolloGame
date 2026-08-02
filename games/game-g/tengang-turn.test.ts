// 天罡·回合制接搁浅维度（doc20 §二·design G 2026-06-20 派甲）行为测试：morale(哀兵/督战) · stamina(薪火) · draw(川流/广纳/战潮) · siege(死守/攻城锤)。
// 直接设 tengangA（绕过聚合器·只验 turn-combat 的 apply 钩子）。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina, NO_TENGANG } from './combat-types.js';
import { initTurnBattle, deployUnit, drawCard, endTurn, clashOdds, castTengang, castTengangAt, tengangTargetKind, SACRIFICE_BUFF, HAND_MAX, A_GOAL, B_GOAL, type TurnUnit, type PokerCard } from './turn-combat.js';

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

// ── 掷骰系天罡·集成（REQ-G-天罡原生重构 §四.2·改掷经 clashOdds 预报生效）──
describe('Game G · 掷骰系天罡集成（铁骰占优必胜 / 改掷抬预报）', () => {
  const place = (b: ReturnType<typeof initTurnBattle>, ra: string, rb: string): void => {
    b.lanes[0].a = [unit('a0', ra, 4)]; b.lanes[0].b = [unit('b0', rb, 5)];
  };
  it('铁骰(autoWinGE)：我前锋战力 ≥ 敌 → 预报 100%（免掷直接胜）', () => {
    const b = initTurnBattle({ seed: 5 }); place(b, 'K', '9'); // ea(13) ≥ eb(9)
    expect(clashOdds(b, 0)).toBeLessThan(1);                    // 无铁骰：非必胜
    b.a.tengangA = { ...NO_TENGANG, autoWinGE: 1 };
    expect(clashOdds(b, 0)).toBe(1);                            // 铁骰：占优必胜 → 100%
  });
  it('铁骰：我前锋战力 < 敌 → 不触发（仍按掷骰预报）', () => {
    const b = initTurnBattle({ seed: 5 }); place(b, '9', 'K');  // ea(9) < eb(13)
    b.a.tengangA = { ...NO_TENGANG, autoWinGE: 1 };
    expect(clashOdds(b, 0)).toBeLessThan(1);                    // 不占优 → 铁骰不生效
  });
  it('擒王(killGeneralRout)：斩敌主将 → 该路敌全溃（余部清空）', () => {
    const b = initTurnBattle({ seed: 5 });
    b.a.tengangA = { ...NO_TENGANG, autoWinGE: 1, killGeneralRout: 1 }; // 占优必胜确保斩将 + 擒王触发
    b.lanes[0].a = [unit('a0', 'K', 4)];
    b.lanes[0].b = [unit('b0', '2', 5, 0, true), unit('b1', '3', 6)]; // 敌主将 b0 前锋 + 余部 b1
    endTurn(b); // 我方行动：碰撞 → 占优必胜斩主将 → 擒王 → 该路余部全溃
    expect(b.lanes[0].b.length).toBe(0); // 全溃·清空
    expect(b.lanes[0].bGenDead).toBe(true);
  });
  it('鬼手(rollBonus)/磐石(rollFloor)/灌铅骰(rollTwice)：改掷 → 预报升（我为下风也抬）', () => {
    const mk = (fx: Partial<typeof NO_TENGANG>): number => {
      const b = initTurnBattle({ seed: 5 }); place(b, '9', 'K'); // 我下风(9 vs 13)
      b.a.tengangA = { ...NO_TENGANG, ...fx };
      return clashOdds(b, 0)!;
    };
    const base = mk({});
    expect(mk({ rollBonus: 2 })).toBeGreaterThan(base);  // 鬼手改掷+2
    expect(mk({ rollFloor: 2 })).toBeGreaterThan(base);  // 磐石掷下界+2
    expect(mk({ rollTwice: 1 })).toBeGreaterThan(base);  // 灌铅骰掷两次取高
  });
});

// ── 选路 op 天罡（片C·castTengangAt·REQ-G-天罡原生重构 §四.3·策划定案 0bde67dc）──
describe('Game G · 选路 op 天罡（castTengangAt·即时一次性）', () => {
  const tg = (id: string): { kind: 'tengang'; id: string } => ({ kind: 'tengang', id });
  it('tengangTargetKind：疾行/驰援/舍车=own-lane · 泥沼=enemy-lane · 铁索=global · 虎符=null', () => {
    expect(tengangTargetKind('swiftmarch')).toBe('own-lane');
    expect(tengangTargetKind('rush')).toBe('own-lane');
    expect(tengangTargetKind('discard2')).toBe('own-lane');
    expect(tengangTargetKind('mire')).toBe('enemy-lane');
    expect(tengangTargetKind('ironchain')).toBe('global');
    expect(tengangTargetKind('tigertally')).toBe(null);
  });
  it('castTengang 拒绝选路天罡（须走 castTengangAt·手牌不动）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.hand = [tg('swiftmarch')];
    expect(castTengang(b, 'a', 0)).toBe(false);
    expect(b.a.hand.length).toBe(1);
  });
  it('疾行 swiftmarch：我该路整列即时 +1 格推进', () => {
    const b = initTurnBattle({ seed: 5 }); b.lanes[1].a = [unit('a0', '5', 2)]; b.a.hand = [tg('swiftmarch')];
    expect(castTengangAt(b, 'a', 0, 1)).toBe(true);
    expect(b.lanes[1].a[0].slot).toBe(3); // 2→3
    expect(b.a.hand.length).toBe(0);      // 消耗
  });
  it('泥沼 mire：敌该路本回合不推进（跳过一次 advance·用后清）', () => {
    const b = initTurnBattle({ seed: 5 }); b.lanes[1].b = [unit('b0', '5', 6)]; b.a.hand = [tg('mire')];
    expect(castTengangAt(b, 'a', 0, 1)).toBe(true);
    expect(b.lanes[1].bSkipAdvance).toBe(true);
    endTurn(b); const before = b.lanes[1].b[0].slot; endTurn(b); // a 空推 → b 行动·该路跳过
    expect(b.lanes[1].b[0].slot).toBe(before); // 未推进
    expect(b.lanes[1].bSkipAdvance).toBe(false); // 用后清
  });
  it('铁索 ironchain：敌全军减速 2 回合（global·lane 忽略）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.hand = [tg('ironchain')];
    expect(castTengangAt(b, 'a', 0, -1)).toBe(true);
    expect(b.slowB).toBe(2);
  });
  it('驰援 rush：指定路凭空 +2 援兵（战力3·无将·无 buff）', () => {
    const b = initTurnBattle({ seed: 5 }); b.a.hand = [tg('rush')];
    expect(castTengangAt(b, 'a', 0, 0)).toBe(true);
    expect(b.lanes[0].a.length).toBe(2);
    expect(b.lanes[0].a.every((u) => u.points === 3 && u.buff === 0 && !u.general)).toBe(true);
  });
  it('舍车 discard2：弃该路回库 + 另两路当前兵各 +8 战力', () => {
    const b = initTurnBattle({ seed: 5 });
    b.lanes[0].a = [unit('a0', '5', 1)]; b.lanes[1].a = [unit('a1', '6', 1)]; b.lanes[2].a = [unit('a2', '7', 1)];
    const deckBefore = b.a.pokerDeck.length; b.a.hand = [tg('discard2')];
    expect(castTengangAt(b, 'a', 0, 0)).toBe(true); // 弃上路
    expect(b.lanes[0].a.length).toBe(0);            // 上路清空
    expect(b.a.pokerDeck.length).toBe(deckBefore + 1); // 回库(非销毁)
    expect(b.lanes[1].a[0].buff).toBe(SACRIFICE_BUFF); // 中路 +8
    expect(b.lanes[2].a[0].buff).toBe(SACRIFICE_BUFF); // 下路 +8
  });
  it('抢滩 beachhead：我该路整列抢到中线（前锋达 slot 4）', () => {
    const b = initTurnBattle({ seed: 5 }); b.lanes[1].a = [unit('a0', '5', 1)]; b.a.hand = [tg('beachhead')];
    expect(tengangTargetKind('beachhead')).toBe('own-lane');
    expect(castTengangAt(b, 'a', 0, 1)).toBe(true);
    expect(b.lanes[1].a[0].slot).toBe(4); // 1→中线 4
  });
});

// ── AOE 天罡（片E·aoePower·REQ-G-天罡原生重构 §三·数值待 sim）──
describe('Game G · AOE 天罡（火攻/齐射/塌方·范围削战力）', () => {
  const tg = (id: string): { kind: 'tengang'; id: string } => ({ kind: 'tengang', id });
  it('tengangTargetKind：AOE=enemy-lane', () => {
    expect(tengangTargetKind('firestorm')).toBe('enemy-lane');
    expect(tengangTargetKind('volley')).toBe('enemy-lane');
    expect(tengangTargetKind('quagmire')).toBe('enemy-lane');
  });
  it('火攻 firestorm：敌该路全体 −4 战力', () => {
    const b = initTurnBattle({ seed: 5 }); b.lanes[0].b = [unit('b0', '9', 6, 2), unit('b1', '8', 7, 1)]; b.a.hand = [tg('firestorm')];
    expect(castTengangAt(b, 'a', 0, 0)).toBe(true);
    expect(b.lanes[0].b[0].buff).toBe(2 - 4); expect(b.lanes[0].b[1].buff).toBe(1 - 4); // 全体 −4
  });
  it('齐射 volley：敌该路最前 2 格 −6（第3个不吃）', () => {
    const b = initTurnBattle({ seed: 5 }); b.lanes[0].b = [unit('b0', '9', 6), unit('b1', '8', 7), unit('b2', '7', 8)]; b.a.hand = [tg('volley')];
    expect(castTengangAt(b, 'a', 0, 0)).toBe(true);
    expect(b.lanes[0].b[0].buff).toBe(-6); expect(b.lanes[0].b[1].buff).toBe(-6); expect(b.lanes[0].b[2].buff).toBe(0); // 只前 2
  });
  it('塌方 quagmire：敌该路 −3 战力 + 本回合不推进', () => {
    const b = initTurnBattle({ seed: 5 }); b.lanes[0].b = [unit('b0', '9', 6)]; b.a.hand = [tg('quagmire')];
    expect(castTengangAt(b, 'a', 0, 0)).toBe(true);
    expect(b.lanes[0].b[0].buff).toBe(-3); expect(b.lanes[0].bSkipAdvance).toBe(true);
  });
});
