import { describe, it, expect } from 'vitest';
import { standardArmy } from './index.js';
import { initLiveBattle, stepLiveBattle, runLiveBattle, liveHash, cardStamina, tideDrawPulse, TIDE_PULSE, MARCH_STEP, migrateRear, NO_TENGANG, type DeployCmd, type ClashEvent, type TengangFx } from './live-combat.js';
import { aggregateTengang, tengangFxOf } from './game-g.js';

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
  const ce = (aWins: boolean, aGen: boolean, bGen: boolean): ClashEvent => ({ tick: 1, lane: 0, winrate: 0.5, roll: 0.5, aWins, tie: null, a: { rank: '7', suit: 'S', general: aGen, points: 7, buff: 0, morale: 0, tengang: 0, pEff: 7 }, b: { rank: '7', suit: 'H', general: bGen, points: 7, buff: 0, morale: 0, tengang: 0, pEff: 7 } });

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
    expect(aggregateTengang(['tigertally']).powerAll).toBe(2);        // 虎符 power+2
    expect(aggregateTengang(['ghosthand']).pEffAdd).toBe(1);          // 鬼手 odds add+1
    expect(aggregateTengang(['bedrock']).winFloor).toBeCloseTo(0.05); // 磐石 winFloor+5%
    expect(aggregateTengang(['fewtroops']).powerLE3).toBe(6);         // 寡兵 ≤3张+6
    expect(aggregateTengang(['twinblade']).comboPair).toBe(6);        // 双锋 含对子+6
    expect(aggregateTengang(['bannerman']).moraleLeader).toBe(4);     // 旗手 士气+4
    expect(aggregateTengang(['unyield']).stamPlus).toBe(1);           // 不屈 续航+1
    expect(aggregateTengang(['widehand']).handMaxAdd).toBe(2);        // 广纳 手牌上限+2
    expect(aggregateTengang(['markdecap'])).toEqual(NO_TENGANG);      // 斩首印(arcane 质变)=甲 v2 未接 → 零修正·不崩
    const both = aggregateTengang(['tigertally', 'ghosthand']);       // 多种叠加
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
    expect(clashWR(aggregateTengang(['tigertally']))).toBeGreaterThan(base);     // 虎符 +2 战力 → 胜率↑
    expect(clashWR(aggregateTengang(['ghosthand']))).toBeGreaterThan(base); // 巧手 +1 掷命点 → 胜率↑
    expect(clashWR(aggregateTengang(['fewtroops']))).toBeGreaterThan(base);  // 寡兵：我方本路仅 1 张(≤3) → +6 → 胜率↑
    const weak = clashWR(NO_TENGANG, 40);                                  // 敌 +40 → 我方触底(≈3%)
    expect(weak).toBeLessThan(0.1);                                        // 确实压到底附近
    expect(clashWR(aggregateTengang(['bedrock']), 40)).toBeGreaterThan(weak); // 稳手 winFloor 抬底(→≈8%)
  });

  it('天罡 flat 批补（doc20 §二·确定生效·无 live 挂点）：灌铅骰 kHard / 铁骰 noUpset / 鼎立 trips / 老兵 stamFaces —— 映射 + 效果', () => {
    // ① 映射（合成卡·不依赖乙上架数据；op 形 = 甲侧契约 doc20 §二）
    expect(tengangFxOf([{ kind: 'odds', params: { op: 'kHard', value: 1 } }]).kHard).toBe(1);           // 灌铅骰
    expect(tengangFxOf([{ kind: 'odds', params: { op: 'noUpset' } }]).noUpset).toBe(1);                 // 铁骰
    expect(tengangFxOf([{ kind: 'combo', params: { op: 'trips', bonus: 12 } }]).comboTrips).toBe(12);   // 鼎立
    expect(tengangFxOf([{ kind: 'stamina', params: { op: 'stamPlus', value: 1, filter: 'faces' } }]).stamFaces).toBe(1); // 老兵
    expect(tengangFxOf([{ kind: 'stamina', params: { op: 'stamPlus', value: 1 } }]).stamPlus).toBe(1);  // 全军(无 filter)→仍 stamPlus
    expect(tengangFxOf([])).toEqual(NO_TENGANG);

    // ② 灌铅骰 kHard：占优时 logistic 变硬(k↓) → 同样优势·胜率更高；均势(差0)仍 .5（logistic(0) 与 k 无关）。
    const clashWR2 = (fx: TengangFx, aBuff = 0): number => {
      const b = initLiveBattle(11); b.tengangA = fx;
      const dep: DeployCmd[] = [
        { tick: 1, side: 'a', lane: 0, unit: { id: 'a', rank: '7', suit: 'S', general: false, buff: aBuff } },
        { tick: 1, side: 'b', lane: 0, unit: { id: 'b', rank: '7', suit: 'H', general: false } },
      ];
      for (let i = 0; i < 300 && b.clashSeq === 0; i++) stepLiveBattle(b, dep);
      return b.lastClash!.winrate;
    };
    expect(clashWR2({ ...NO_TENGANG, kHard: 2 }, 6)).toBeGreaterThan(clashWR2(NO_TENGANG, 6)); // 占优 → kHard 抬更高
    expect(clashWR2({ ...NO_TENGANG, kHard: 2 }, 0)).toBeCloseTo(0.5, 5);                      // 均势 → 不偏

    // ③ 铁骰 noUpset：占优(胜率≥50%)必胜；同一"会翻车"的种子上 base 翻车 → 铁骰救回（证明确改了结果·非恒赢）。
    const aWinsAt = (fx: TengangFx, seed: number): boolean => {
      const b = initLiveBattle(seed); b.tengangA = fx;
      const dep: DeployCmd[] = [
        { tick: 1, side: 'a', lane: 0, unit: { id: 'a', rank: '7', suit: 'S', general: false, buff: 2 } }, // 我方占优 wr≈.6
        { tick: 1, side: 'b', lane: 0, unit: { id: 'b', rank: '7', suit: 'H', general: false } },
      ];
      for (let i = 0; i < 300 && b.clashSeq === 0; i++) stepLiveBattle(b, dep);
      return b.lastClash!.aWins;
    };
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
    const upsetSeed = seeds.find((s) => !aWinsAt(NO_TENGANG, s)); // base 会翻车的种子（占优仍可能爆冷）
    expect(upsetSeed).toBeDefined();
    expect(aWinsAt({ ...NO_TENGANG, noUpset: 1 }, upsetSeed!)).toBe(true);            // 同种子 → 铁骰救回
    expect(seeds.every((s) => aWinsAt({ ...NO_TENGANG, noUpset: 1 }, s))).toBe(true); // 占优全胜·无爆冷

    // ④ 鼎立 trips：本路≥3张同点 → 该牌 tengang 加成含 +12；仅对子不触发。
    const tripTg = (ranks: string[]): number => {
      const b = initLiveBattle(7); b.tengangA = { ...NO_TENGANG, comboTrips: 12 };
      const dep: DeployCmd[] = [
        ...ranks.map((r, i) => ({ tick: 1, side: 'a' as const, lane: 0, unit: { id: 'a' + i, rank: r, suit: 'S', general: false } })),
        { tick: 1, side: 'b', lane: 0, unit: { id: 'b', rank: '7', suit: 'H', general: false } },
      ];
      for (let i = 0; i < 300 && b.clashSeq === 0; i++) stepLiveBattle(b, dep);
      return b.lastClash!.a.tengang;
    };
    expect(tripTg(['7', '7', '7'])).toBe(12); // 三条 → +12
    expect(tripTg(['7', '7', '8'])).toBe(0);  // 仅对子(2 同点) → 鼎立不触发

    // ⑤ 老兵 stamFaces：只人头牌(JQKA)吃续航加成；非人头牌不吃。
    const stamOf = (rank: string, faces: number): number => {
      const b = initLiveBattle(5); b.tengangA = { ...NO_TENGANG, stamFaces: faces };
      stepLiveBattle(b, [{ tick: 1, side: 'a', lane: 0, unit: { id: 'a', rank, suit: 'S', general: false } }]);
      return b.lanes[0].a[0].stamina;
    };
    expect(stamOf('K', 2)).toBe(stamOf('K', 0) + 2); // 人头牌 +2
    expect(stamOf('5', 2)).toBe(stamOf('5', 0));     // 非人头牌 不加
  });

  it('天罡 power 4 锁（doc20 §二「实装细则」·派甲实装）：锋矢 front / 擎天 highestRank ×mul（虎符/寡兵 v1 已测）', () => {
    // ① 映射（合成卡·锁定 scope/op 形 = 甲侧契约）
    expect(tengangFxOf([{ kind: 'power', params: { op: 'add', value: 4, scope: 'front' } }]).powerFront).toBe(4);                // 锋矢
    expect(tengangFxOf([{ kind: 'power', params: { op: 'mul', value: 1.5, scope: 'highestRank' } }]).powerMulHighest).toBe(1.5); // 擎天
    expect(tengangFxOf([{ kind: 'power', params: { op: 'add', value: 2, scope: 'all' } }]).powerAll).toBe(2);                    // 虎符(scope:all)→全军
    expect(tengangFxOf([{ kind: 'power', params: { op: 'add', value: 6, scope: 'lane', filter: 'countLE3' } }]).powerLE3).toBe(6); // 寡兵

    // ② 效果：投 a 牌(指定 rank/lane) + 目标路投弱 b → 跑到首对决 → 读拆解(lastClash.a)。
    const clashA = (fx: TengangFx, aCards: { rank: string; lane: number }[], bLane: number) => {
      const b = initLiveBattle(7); b.tengangA = fx;
      const dep: DeployCmd[] = [
        ...aCards.map((c, i) => ({ tick: 1, side: 'a' as const, lane: c.lane, unit: { id: 'a' + i, rank: c.rank, suit: 'S', general: false } })),
        { tick: 1, side: 'b', lane: bLane, unit: { id: 'b', rank: '2', suit: 'H', general: false } },
      ];
      for (let i = 0; i < 300 && b.clashSeq === 0; i++) stepLiveBattle(b, dep);
      return b.lastClash!.a;
    };
    // 锋矢：每路最前(前锋)+4 → 该牌 tengang 含 +4。
    expect(clashA({ ...NO_TENGANG, powerFront: 4 }, [{ rank: '7', lane: 0 }], 0).tengang).toBe(4);
    expect(clashA(NO_TENGANG, [{ rank: '7', lane: 0 }], 0).tengang).toBe(0); // 无锋矢 → 0

    // 擎天：全军 base 点数最高的单张 ×1.5（add→mul→floor）；非最强不×（单张·army-wide）。
    expect(clashA({ ...NO_TENGANG, powerMulHighest: 1.5 }, [{ rank: 'A', lane: 0 }], 0).pEff).toBe(Math.floor(14 * 1.5)); // A(14) 独军最强 → 21
    expect(clashA(NO_TENGANG, [{ rank: 'A', lane: 0 }], 0).pEff).toBe(14);                                              // 无擎天 → 14
    expect(clashA({ ...NO_TENGANG, powerMulHighest: 1.5 }, [{ rank: 'K', lane: 0 }, { rank: 'A', lane: 0 }], 0).pEff).toBe(13); // K 前锋·同军有更强 A → K 非最强 → 不×
    expect(clashA({ ...NO_TENGANG, powerMulHighest: 1.5 }, [{ rank: 'K', lane: 0 }], 0).pEff).toBe(Math.floor(13 * 1.5)); // K 独军最强 → 19
  });

  it('50:50 平局裁定（owner · 点数大者胜 → 续航高者 → 重揉）：战力相等不纯靠运气', () => {
    const tieClash = (aRank: string, aBuff: number, bRank: string, bBuff: number): ClashEvent => {
      const b = initLiveBattle(3);
      const dep: DeployCmd[] = [
        { tick: 1, side: 'a', lane: 0, unit: { id: 'a', rank: aRank, suit: 'S', general: false, buff: aBuff } },
        { tick: 1, side: 'b', lane: 0, unit: { id: 'b', rank: bRank, suit: 'H', general: false, buff: bBuff } },
      ];
      for (let i = 0; i < 200 && b.clashSeq === 0; i++) stepLiveBattle(b, dep);
      return b.lastClash!;
    };
    // 战力相等(7+8=15 vs 9+6=15)·点数不同 → 'points' 裁定·点数大者(敌9)胜
    const ev1 = tieClash('7', 8, '9', 6);
    expect(ev1.a.pEff).toBe(ev1.b.pEff); expect(ev1.winrate).toBeCloseTo(0.5);
    expect(ev1.tie).toBe('points');
    expect(ev1.aWins).toBe(false); // 敌 9 点数大 → 胜（不靠掷点）
    // 全相等(7+5 vs 7+5) → 'roll' 裁定（重揉·这一掷定）
    const ev2 = tieClash('7', 5, '7', 5);
    expect(ev2.a.pEff).toBe(ev2.b.pEff); expect(ev2.tie).toBe('roll');
    expect(typeof ev2.aWins).toBe('boolean');
    // 战力不等(7+10=17 vs 9) → 正常概率掷命·tie=null
    const ev3 = tieClash('7', 10, '9', 0);
    expect(ev3.a.pEff).not.toBe(ev3.b.pEff); expect(ev3.tie).toBe(null);
    // 确定性：同输入 → 同裁定
    expect(tieClash('7', 8, '9', 6).aWins).toBe(ev1.aWins);
  });
});
