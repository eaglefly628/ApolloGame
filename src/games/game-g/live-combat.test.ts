import { describe, it, expect } from 'vitest';
import { standardArmy } from './index.js';
import { initLiveBattle, stepLiveBattle, runLiveBattle, liveHash, cardStamina, tideDrawPulse, TIDE_PULSE, MARCH_STEP, migrateRear, NO_TENGANG, type DeployCmd, type ClashEvent, type TengangFx } from './live-combat.js';
import { aggregateTengang } from './game-g.js';

// doc 18/19 · live 解析器 + 3D-CLASH 对决核 + 3D-STAM 续航：验证 live 化后 outcome-first 不破（确定性逐拍 hash）
// + 公平骨架（base=点数·双方同副；强弱来自经营 buff）+ 胜负方向 + live buff 杠杆 + 续航退场（战线接力·神牌不包打）。
const preboard = (side: 'a' | 'b', buff: number): DeployCmd[] =>
  standardArmy(side, 0).map((c) => ({ tick: 1, side, lane: c.lane, unit: { id: c.id, rank: c.rank, suit: c.suit, general: c.general, buff } }));
const fresh = (seed: number): ReturnType<typeof initLiveBattle> => initLiveBattle(seed); // 3 血大本营（默认 HOME_BLOOD）

describe('Game G · live-combat（doc18/19 · live + pairwise clash + 续航）', () => {
  it('确定性：同 seed + 同投放流 → 逐拍 liveHash 一致、收敛出胜负（outcome-first 不破）', () => {
    const d = [...preboard('a', 2), ...preboard('b', 0)];
    const b1 = fresh(7), b2 = fresh(7);
    for (let i = 0; i < 3000 && b1.winner === 'pending'; i++) {
      stepLiveBattle(b1, d);
      stepLiveBattle(b2, d);
      expect(liveHash(b1)).toBe(liveHash(b2));
    }
    expect(b1.winner).not.toBe('pending');
    expect(b1.winner).toBe(b2.winner);
  });

  it('一张牌一张牌·一格格往前爬（owner 钉死：不是一堆刷过去）：每拍 +MARCH_STEP；两军相隔时只爬不打、最前两张相邻才对决', () => {
    // 单 A 无敌：每拍 pos 增 MARCH_STEP，一格格慢慢爬向敌家。
    const b = initLiveBattle(9);
    stepLiveBattle(b, [{ tick: 1, side: 'a', lane: 0, unit: { id: 'a0', rank: '7', suit: 'S', general: false } }]);
    const p1 = b.lanes[0].a[0].pos;
    stepLiveBattle(b);
    expect(b.lanes[0].a[0].pos - p1).toBe(MARCH_STEP); // 每拍 +一格、慢慢爬（非瞬移/批量刷）
    // 两军远隔：开打前只相向爬、不死（最前两张没相邻就不对决）。
    const c = initLiveBattle(9);
    const d: DeployCmd[] = [{ tick: 1, side: 'a', lane: 0, unit: { id: 'a0', rank: '7', suit: 'S', general: false, buff: 50 } }, { tick: 1, side: 'b', lane: 0, unit: { id: 'b0', rank: '7', suit: 'H', general: false } }];
    for (let i = 0; i < 5; i++) stepLiveBattle(c, d);
    expect(c.lanes[0].a.length).toBe(1);
    expect(c.lanes[0].b.length).toBe(1); // 没相邻 → 没人死（强 A 也没"刷过去"秒杀）
    expect(c.lanes[0].a[0].pos).toBeLessThan(c.lanes[0].b[0].pos); // A 左·B 右、相向爬
  });

  it('公平骨架 · 胜负方向：经营 buff 强者攻克敌 3 血老家 → 胜；反向 → 负（base 点数同副、不泵 favor）', () => {
    const settle = (aBuff: number, bBuff: number, seed: number): string => {
      const b = fresh(seed);
      runLiveBattle(b, [...preboard('a', aBuff), ...preboard('b', bBuff)]);
      return b.winner;
    };
    expect(settle(14, 0, 7)).toBe('a');
    expect(settle(0, 14, 7)).toBe('b');
  });

  it('续航：赢一场 −续航，续航尽退场（数字牌 stamina 1 → 赢即退、不能包打 → spent 累计·战线接力）', () => {
    expect(cardStamina('5')).toBe(1); expect(cardStamina('K')).toBe(2); expect(cardStamina('JOKER')).toBe(3);
    const b = fresh(5);
    const mk = (id: string, side: 'a' | 'b', buff: number): DeployCmd => ({ tick: 1, side, lane: 0, unit: { id, rank: '5', suit: 'S', general: false, buff } });
    const d: DeployCmd[] = [mk('a0', 'a', 20), mk('a1', 'a', 20), mk('a2', 'a', 20), mk('b0', 'b', 0), mk('b1', 'b', 0), mk('b2', 'b', 0)];
    runLiveBattle(b, d);
    expect(b.lanes[0].spentA).toBeGreaterThanOrEqual(1); // 强 A 赢了也续航尽退场（非单卡包打 → 逼接力/轮转）
  });

  it('live buff 杠杆：中路投高 buff 强援 → 该路更稳、我家受创不更多（以少胜多基底；遭遇拍读当下 P_eff）', () => {
    const base = [...preboard('a', 0), ...preboard('b', 4)];
    const reinforce: DeployCmd[] = [0, 1, 2].map((i) => ({ tick: 1, side: 'a', lane: 1, unit: { id: `a_re${i}`, rank: 'K', suit: 'S', general: false, buff: 14 } }));
    const homeAfter = (extra: DeployCmd[]): number => { const b = fresh(11); runLiveBattle(b, [...base, ...extra]); return b.homeA; };
    expect(homeAfter(reinforce)).toBeGreaterThanOrEqual(homeAfter([]));
  });

  it('终止性：投放流跑到底必出胜负、不死循环（< maxTicks）', () => {
    const b = fresh(3);
    runLiveBattle(b, [...preboard('a', 0), ...preboard('b', 0)]);
    expect(['a', 'b', 'draw']).toContain(b.winner);
    expect(b.tick).toBeLessThan(4000);
  });
});

// A1 战潮抽牌·事件脉冲（owner 北极星 Balatro「啪嗒」心流）：非线性涌牌 = 底流 + 遭遇/斩将/告急/破阵。
describe('Game G · A1 战潮抽牌·事件脉冲（doc18 §10.3 乙 · tideDrawPulse 纯函数·确定性）', () => {
  const ce = (aWins: boolean, aGen: boolean, bGen: boolean): ClashEvent => ({ tick: 1, lane: 0, winrate: 0.5, roll: 0.5, aWins, a: { rank: '7', suit: 'S', general: aGen, points: 7, buff: 0, morale: 0, pEff: 7 }, b: { rank: '7', suit: 'H', general: bGen, points: 7, buff: 0, morale: 0, pEff: 7 } });

  it('事件→张数：遭遇+1 / 斩将(输方主将)+1 / 告急(我家掉血)+2 / 破阵(敌家掉血)+1；负 chip 钳 0', () => {
    expect(tideDrawPulse([], 0, 0)).toBe(0); // 静拍不涌
    expect(tideDrawPulse([ce(true, false, false)], 0, 0)).toBe(TIDE_PULSE.encounter); // 遭遇 1
    expect(tideDrawPulse([ce(true, false, true)], 0, 0)).toBe(TIDE_PULSE.encounter + TIDE_PULSE.decap); // 斩了 b 主将
    expect(tideDrawPulse([ce(false, true, false)], 0, 0)).toBe(TIDE_PULSE.encounter + TIDE_PULSE.decap); // 斩了 a 主将
    expect(tideDrawPulse([], 1, 0)).toBe(TIDE_PULSE.crisis); // 我家掉 1 血 → 绝境援牌（峰值）
    expect(tideDrawPulse([], 0, 2)).toBe(2 * TIDE_PULSE.breach); // 敌家掉 2 血 → 趁胜追击
    expect(tideDrawPulse([ce(true, false, false), ce(false, true, false)], 1, 1)).toBe(1 + (1 + 1) + 2 + 1); // 综合
    expect(tideDrawPulse([], -3, -1)).toBe(0); // 负 chip 钳 0
  });

  it('行为·非线性「看得见」：跑一局，整局涌牌远超纯底流、且有"哗一把"峰值拍(≥2)、静拍为 0；同 seed 涌牌序列确定', () => {
    const run = (): { total: number; bursts: number; quiet: number } => {
      const b = fresh(7); const d = [...preboard('a', 6), ...preboard('b', -4)];
      let prevLen = 0, total = 0, bursts = 0, quiet = 0;
      for (let i = 0; i < 3000 && b.winner === 'pending'; i++) {
        const ha = b.homeA, hb = b.homeB; stepLiveBattle(b, d);
        const p = tideDrawPulse(b.clashLog.slice(prevLen), ha - b.homeA, hb - b.homeB); prevLen = b.clashLog.length;
        total += p; if (p >= 2) bursts++; if (p === 0) quiet++;
      }
      return { total, bursts, quiet };
    };
    const a = run(), c = run();
    expect(a).toEqual(c); // 确定性：同 seed → 同涌牌序列
    expect(a.total).toBeGreaterThan(20); // 整局涌了不少援牌（非纯底流·该来牌哗一把）
    expect(a.bursts).toBeGreaterThan(0); // 有峰值拍（≥2 张：斩将/告急）
    expect(a.quiet).toBeGreaterThan(0); // 也有静拍（行军/再逼近·不涌）→ 非线性节奏
  });

  it('三路兵力迁移（doc21 ⭐ owner）：搬队尾后备到另一路·重新 staging·确定性不消耗 rng·outcome-first 安全', () => {
    const live = initLiveBattle(5);
    const dep: DeployCmd[] = [
      { tick: 1, side: 'a', lane: 0, unit: { id: 'a0', rank: '5', suit: 'S', general: false } },
      { tick: 1, side: 'a', lane: 0, unit: { id: 'a1', rank: '6', suit: 'H', general: false } },
      { tick: 1, side: 'a', lane: 0, unit: { id: 'a2', rank: '7', suit: 'D', general: false } },
    ];
    stepLiveBattle(live, dep); // 上路 3 张 A（无敌·自由行军），队尾 a2 = 后备（离敌最远）
    expect(live.lanes[0].a.length).toBe(3);
    expect(live.lanes[2].a.length).toBe(0);
    const seqBefore = live.rng.sequence;
    expect(migrateRear(live, 'a', 0, 2)).toBe(true); // 上→下 搬队尾后备
    expect(live.lanes[0].a.length).toBe(2);          // 上路少一张
    expect(live.lanes[2].a.map((u) => u.id)).toEqual(['a2']); // 搬的是队尾后备 a2、入下路
    expect(live.rng.sequence).toBe(seqBefore);       // 不消耗 rng → 不破确定性 hash（outcome-first 安全）
    expect(migrateRear(live, 'a', 1, 1)).toBe(false); // 同路 → 拒
    expect(migrateRear(live, 'a', 1, 0)).toBe(false); // 源(中路)空 → 拒
    // 确定性：同序列迁移 → 同 hash
    const run = (): string => { const b = initLiveBattle(5); stepLiveBattle(b, dep); migrateRear(b, 'a', 0, 2); stepLiveBattle(b, dep); return liveHash(b); };
    expect(run()).toBe(run());
  });

  it('A-JOKER 天罡效果（doc20 §二 · cast 后持续·只己方）：aggregateTengang 映射 + clash ΔWR 量级对', () => {
    // 契约③ {kind,params} → 扁平修正 映射
    expect(aggregateTengang(['hufu']).powerAll).toBe(2);              // 虎符 power+2
    expect(aggregateTengang(['qiaoshou']).pEffAdd).toBe(1);           // 巧手 odds add+1
    expect(aggregateTengang(['wenshou']).winFloor).toBeCloseTo(0.05); // 稳手 winFloor+5%
    expect(aggregateTengang(['guabing']).powerLE3).toBe(6);           // 寡兵 ≤3张+6
    expect(aggregateTengang(['tonghuakui']).powerSameSuit).toBe(3);   // 同花魁 同花+3
    expect(aggregateTengang(['duizijue']).comboPair).toBe(6);         // 对子诀 含对子+6
    expect(aggregateTengang(['lingqi']).moraleLeader).toBe(4);        // 令旗 士气+4
    expect(aggregateTengang(['tiehan']).stamPlus).toBe(1);            // 铁汉 续航+1
    expect(aggregateTengang(['guangna']).handMaxAdd).toBe(2);         // 广纳 手牌上限+2
    expect(aggregateTengang(['beishui'])).toEqual(NO_TENGANG);        // 背水(odds.reroll)=v2 未接 → 零修正·不崩
    const both = aggregateTengang(['hufu', 'qiaoshou']);              // 多种叠加
    expect(both.powerAll).toBe(2); expect(both.pEffAdd).toBe(1);

    // clash ΔWR：跑到首次对决读 winrate（=我方胜率）。天罡只己方 → 各加成抬我方胜率。
    const clashWR = (fx: TengangFx, bBuff = 0): number => {
      const b = initLiveBattle(11); b.tengangA = fx;
      const dep: DeployCmd[] = [
        { tick: 1, side: 'a', lane: 0, unit: { id: 'a', rank: '7', suit: 'S', general: false } },
        { tick: 1, side: 'b', lane: 0, unit: { id: 'b', rank: '7', suit: 'H', general: false, buff: bBuff } },
      ];
      for (let i = 0; i < 300 && b.clashSeq === 0; i++) stepLiveBattle(b, dep);
      return b.lastClash!.winrate;
    };
    const base = clashWR(NO_TENGANG); // 均势 7v7 ≈ .5
    expect(clashWR(aggregateTengang(['hufu']))).toBeGreaterThan(base);     // 虎符 +2 战力 → 胜率↑
    expect(clashWR(aggregateTengang(['qiaoshou']))).toBeGreaterThan(base); // 巧手 +1 掷命点 → 胜率↑
    expect(clashWR(aggregateTengang(['guabing']))).toBeGreaterThan(base);  // 寡兵：我方本路仅 1 张(≤3) → +6 → 胜率↑
    const weak = clashWR(NO_TENGANG, 40);                                  // 敌 +40 → 我方触底(≈3%)
    expect(weak).toBeLessThan(0.1);                                        // 确实压到底附近
    expect(clashWR(aggregateTengang(['wenshou']), 40)).toBeGreaterThan(weak); // 稳手 winFloor 抬底(→≈8%)
  });
});
