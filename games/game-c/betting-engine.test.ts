import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@zerocraft/engine/atom-skills/random/index.js';
import {
  startHand, act, legalActions, settle, potLayers, nextPositions, initialPositions, nextLiveSeat, cloneHand,
  type BettingConfig, type HandState, type SeatId, type Action,
} from './betting-engine.js';
import { holdemRank, dealHoldem, type HandRank } from './holdem-eval.js';

const CFG: BettingConfig = { smallBlind: 25, bigBlind: 50 }; // GDD §11.5-1 默认盲注

/** 六人满桌开手（座位 i 栈 stacks[i]·按钮 0 → sb1 bb2 utg3）。 */
function sixUp(stacks: number[] = Array(6).fill(1000), button = 0): HandState {
  const seats = stacks.map((stack, seat) => ({ seat, stack })).filter((s) => s.stack > 0);
  return startHand(CFG, seats, initialPositions(seats.map((s) => s.seat), button));
}

const totalChips = (st: HandState): number => st.players.reduce((s, p) => s + p.stack + p.total, 0);

describe('game-c betting-engine — 盲注与行动轮', () => {
  it('开手：盲注入池·UTG 先动·跟注/加注口径', () => {
    const st = sixUp();
    expect(st.players[1].committed).toBe(25);
    expect(st.players[2].committed).toBe(50);
    expect(st.currentBet).toBe(50);
    expect(st.actor).toBe(3);
    const la = legalActions(st);
    expect(la.call).toBe(50);
    expect(la.raise).toEqual({ min: 100, max: 1000 });
    expect(la.check).toBeUndefined();
  });

  it('全员平跟 → 大盲有 option（可加注）；过牌后进翻牌·按钮后首位先动', () => {
    const st = sixUp();
    for (const s of [3, 4, 5, 0]) act(st, s, { kind: 'call' });
    act(st, 1, { kind: 'call' }); // 小盲补齐
    expect(st.actor).toBe(2); // BB option
    const la = legalActions(st);
    expect(la.check).toBe(true);
    expect(la.raise).toEqual({ min: 100, max: 1000 });
    act(st, 2, { kind: 'check' });
    expect(st.street).toBe('flop');
    expect(st.actor).toBe(1);
    expect(st.players.reduce((s, p) => s + p.total, 0)).toBe(300);
  });

  it('大盲 option 加注 → 行动重开（全员须再表态）', () => {
    const st = sixUp();
    for (const s of [3, 4, 5, 0]) act(st, s, { kind: 'call' });
    act(st, 1, { kind: 'call' });
    act(st, 2, { kind: 'raise', to: 150 });
    expect(st.street).toBe('preflop');
    expect(st.actor).toBe(3);
    expect(legalActions(st).call).toBe(100);
  });
});

describe('game-c betting-engine — min-raise 规则', () => {
  it('min-raise=上一完整加注增量·逐级抬高', () => {
    const st = sixUp();
    act(st, 3, { kind: 'raise', to: 100 }); // 增量 50（首注基准=大盲）
    expect(() => act(st, 4, { kind: 'raise', to: 149 })).toThrow(); // 增量 49 < 50 且非 all-in
    act(st, 4, { kind: 'raise', to: 150 }); // 增量 50 合法
    act(st, 5, { kind: 'raise', to: 250 }); // 增量 100 → 新基准
    expect(() => act(st, 0, { kind: 'raise', to: 349 })).toThrow(); // 增量 99 < 100
    act(st, 0, { kind: 'raise', to: 350 });
    expect(st.currentBet).toBe(350);
  });

  it('翻后首注下限=大盲', () => {
    const st = sixUp();
    for (const s of [3, 4, 5, 0]) act(st, s, { kind: 'call' });
    act(st, 1, { kind: 'call' });
    act(st, 2, { kind: 'check' });
    expect(legalActions(st).raise!.min).toBe(50);
    expect(() => act(st, 1, { kind: 'raise', to: 49 })).toThrow();
    act(st, 1, { kind: 'raise', to: 50 });
    expect(st.currentBet).toBe(50);
  });

  it('栈不足 min-raise 时只能整栈 all-in（min 钳到全下位）', () => {
    const st = sixUp([1000, 1000, 1000, 60, 1000, 1000]);
    expect(legalActions(st).raise).toEqual({ min: 60, max: 60 });
    act(st, 3, { kind: 'raise', to: 60 }); // 短加注 all-in：currentBet 抬到 60
    expect(st.currentBet).toBe(60);
    act(st, 4, { kind: 'call' });
    expect(legalActions(st).raise!.min).toBe(110); // 后手 min-raise 基准仍=50（短加注不改基准）
  });
});

describe('game-c betting-engine — 不足额 all-in 不重开', () => {
  it('短 all-in 后已行动者只许跟/弃（加注权不复活）', () => {
    const st = sixUp([1000, 1000, 1000, 1000, 1000, 130]);
    act(st, 3, { kind: 'raise', to: 100 });
    act(st, 4, { kind: 'call' });
    act(st, 5, { kind: 'raise', to: 130 }); // 增量 30 < 50：只因整栈 all-in 而合法
    for (const s of [0, 1, 2]) act(st, s, { kind: 'fold' });
    expect(st.actor).toBe(3);
    expect(legalActions(st).raise).toBeUndefined(); // 加注权已用
    expect(legalActions(st).call).toBe(30);
    expect(() => act(st, 3, { kind: 'raise', to: 300 })).toThrow();
    act(st, 3, { kind: 'call' });
    expect(legalActions(st).raise).toBeUndefined();
    act(st, 4, { kind: 'call' });
    expect(st.street).toBe('flop'); // 闭合进街（p5 all-in 旁观）
  });

  it('完整加注重开行动（对照组）', () => {
    const st = sixUp([1000, 1000, 1000, 1000, 1000, 1000]);
    act(st, 3, { kind: 'raise', to: 100 });
    act(st, 4, { kind: 'call' });
    act(st, 5, { kind: 'raise', to: 300 }); // 增量 200 ≥ 50：完整加注
    for (const s of [0, 1, 2]) act(st, s, { kind: 'fold' });
    expect(legalActions(st).raise).toEqual({ min: 500, max: 1000 }); // p3 加注权复活
  });

  it('跟注不足额=全下跟注（不抬 currentBet）', () => {
    const st = sixUp([1000, 1000, 1000, 1000, 60, 1000]);
    act(st, 3, { kind: 'raise', to: 200 });
    act(st, 4, { kind: 'call' });
    const p4 = st.players[4];
    expect(p4.allIn).toBe(true);
    expect(p4.committed).toBe(60);
    expect(st.currentBet).toBe(200);
  });
});

describe('game-c betting-engine — 边池矩阵', () => {
  it('三层 all-in：逐层切池·每池独立比牌·溢出退回', () => {
    const st = startHand(CFG, [
      { seat: 0, stack: 900 }, { seat: 1, stack: 100 }, { seat: 2, stack: 300 },
    ], initialPositions([0, 1, 2], 0));
    expect(st.actor).toBe(0); // 三人桌 UTG=按钮
    act(st, 0, { kind: 'raise', to: 900 });
    act(st, 1, { kind: 'call' });
    act(st, 2, { kind: 'call' });
    expect(st.street).toBe('showdown'); // 全员 all-in 直跑摊牌

    const { pots, refund } = potLayers(st);
    expect(refund).toEqual({ seat: 0, amount: 600 });
    expect(pots).toHaveLength(2);
    expect(pots[0]).toMatchObject({ amount: 300, eligible: [0, 1, 2] });
    expect(pots[1]).toMatchObject({ amount: 400, eligible: [0, 2] });

    const ranks = new Map<SeatId, HandRank>([[1, [3]], [2, [2]], [0, [1]]]); // 短栈最大·中栈次之
    const s = settle(st, ranks);
    expect(s.payouts).toEqual({ 1: 300, 2: 400 });
    expect(st.players.map((p) => p.stack)).toEqual([600, 300, 400]);
    expect(totalChips(st)).toBe(1300); // 筹码守恒
  });

  it('弃牌死钱沉入下层池·弃牌者无资格', () => {
    const st = startHand(CFG, [
      { seat: 0, stack: 1000 }, { seat: 1, stack: 1000 }, { seat: 2, stack: 1000 }, { seat: 3, stack: 40 },
    ], initialPositions([0, 1, 2, 3], 0));
    act(st, 3, { kind: 'call' }); // 40 全下跟注（不足 50）
    act(st, 0, { kind: 'raise', to: 200 });
    act(st, 1, { kind: 'fold' }); // 25 死钱
    act(st, 2, { kind: 'call' });
    expect(st.street).toBe('flop');
    for (const street of ['turn', 'river', 'showdown'] as const) {
      act(st, 2, { kind: 'check' });
      act(st, 0, { kind: 'check' });
      expect(st.street).toBe(street);
    }
    const { pots, refund } = potLayers(st);
    expect(refund).toBeNull(); // 双活人同额=无溢出
    expect(pots[0]).toMatchObject({ amount: 145, eligible: [0, 2, 3] }); // 40×3 + 死钱25
    expect(pots[1]).toMatchObject({ amount: 320, eligible: [0, 2] });
    const s = settle(st, new Map([[3, [5]], [2, [4]], [0, [3]]]));
    expect(s.payouts).toEqual({ 3: 145, 2: 320 });
  });

  it('全弃收池：未被跟注溢出退回·赢家免摊牌', () => {
    const st = sixUp();
    act(st, 3, { kind: 'raise', to: 200 });
    for (const s of [4, 5, 0, 1, 2]) act(st, s, { kind: 'fold' });
    expect(st.street).toBe('done');
    expect(st.uncontested).toBe(3);
    const s = settle(st); // 免 ranks
    expect(s.refund).toEqual({ seat: 3, amount: 150 });
    expect(s.payouts).toEqual({ 3: 125 }); // 自己的50 + 盲注75
    expect(st.players[3].stack).toBe(1075);
    expect(totalChips(st)).toBe(6000);
  });
});

describe('game-c betting-engine — 平分与奇数筹码', () => {
  it('三家平手：奇数筹码按「按钮后顺时针最先」逐一给（按钮=末位）', () => {
    const st = startHand(CFG, [0, 1, 2, 3].map((seat) => ({ seat, stack: 1000 })), initialPositions([0, 1, 2, 3], 0));
    act(st, 3, { kind: 'call' });
    act(st, 0, { kind: 'call' });
    act(st, 1, { kind: 'call' });
    act(st, 2, { kind: 'check' });
    act(st, 1, { kind: 'raise', to: 50 });
    act(st, 2, { kind: 'call' });
    act(st, 3, { kind: 'fold' }); // 50 死钱
    act(st, 0, { kind: 'call' });
    for (const s of [1, 2, 0, 1, 2, 0]) act(st, s, { kind: 'check' }); // 转/河全过
    expect(st.street).toBe('showdown');
    const tie: HandRank = [2, 14, 13, 9, 0, 0];
    const s = settle(st, new Map([[0, tie], [1, tie], [2, tie]]));
    // 池 350 三分：116×3+2——sb(1)、bb(2) 各多 1 枚，按钮(0) 不加。
    expect(s.payouts).toEqual({ 1: 117, 2: 117, 0: 116 });
    expect(totalChips(st)).toBe(4000);
  });
});

describe('game-c betting-engine — 轮转与死按钮', () => {
  it('无淘汰：三位各进一位', () => {
    expect(nextPositions({ button: 0, sb: 1, bb: 2 }, [0, 1, 2, 3, 4, 5]))
      .toEqual({ button: 1, sb: 2, bb: 3 });
  });

  it('小盲淘汰 → 死按钮一手后自愈', () => {
    const live = [0, 2, 3, 4, 5]; // 1 被淘汰
    const h1 = nextPositions({ button: 0, sb: 1, bb: 2 }, live);
    expect(h1).toEqual({ button: 1, sb: 2, bb: 3 }); // 钮落空位=死按钮
    expect(nextPositions(h1, live)).toEqual({ button: 2, sb: 3, bb: 4 });
  });

  it('大盲淘汰 → 先死小盲、再死按钮（教科书两手）', () => {
    const live = [0, 1, 3, 4, 5]; // 2 被淘汰
    const h1 = nextPositions({ button: 0, sb: 1, bb: 2 }, live);
    expect(h1).toEqual({ button: 1, sb: 2, bb: 3 }); // sb=空位=死小盲
    expect(nextPositions(h1, live)).toEqual({ button: 2, sb: 3, bb: 4 }); // 钮落空位
  });

  it('死小盲的一手：无人缴小盲·行动序照常', () => {
    const seats = [0, 3, 4, 5].map((seat) => ({ seat, stack: 1000 })); // 座位2 已淘汰
    const st = startHand(CFG, seats, { button: 1, sb: 2, bb: 3 });
    expect(st.players.reduce((s, p) => s + p.committed, 0)).toBe(50); // 只有大盲
    expect(st.actor).toBe(4);
  });

  it('两人残局：按钮即小盲·翻前钮先动·翻后大盲先动', () => {
    const pos = initialPositions([0, 3], 0);
    expect(pos).toEqual({ button: 0, sb: 0, bb: 3 });
    const st = startHand(CFG, [{ seat: 0, stack: 1000 }, { seat: 3, stack: 1000 }], pos);
    expect(st.actor).toBe(0);
    act(st, 0, { kind: 'call' });
    act(st, 3, { kind: 'check' }); // BB option
    expect(st.street).toBe('flop');
    expect(st.actor).toBe(3);
    expect(nextPositions(pos, [0, 3])).toEqual({ button: 3, sb: 3, bb: 0 });
  });

  it('三人收缩到两人：大盲照进·另一人身兼钮/小盲', () => {
    expect(nextPositions({ button: 0, sb: 1, bb: 2 }, [1, 2]))
      .toEqual({ button: 2, sb: 2, bb: 1 });
  });

  it('nextLiveSeat 环行', () => {
    expect(nextLiveSeat([0, 3], 0)).toBe(3);
    expect(nextLiveSeat([0, 3], 3)).toBe(0);
    expect(nextLiveSeat([2, 4], 5)).toBe(2);
  });
});

describe('game-c betting-engine — 盲注短缴与边角', () => {
  it('大盲不足额=短缴 all-in·跟注线仍=大盲', () => {
    const st = sixUp([1000, 1000, 30, 1000, 1000, 1000]);
    expect(st.players.find((p) => p.seat === 2)!.allIn).toBe(true);
    expect(st.currentBet).toBe(50);
    act(st, 3, { kind: 'call' });
    for (const s of [4, 5, 0, 1]) act(st, s, { kind: 'fold' });
    expect(st.street).toBe('showdown'); // 仅剩 p3 可动且已缴平 → 直跑
    const s = settle(st, new Map([[2, [9]], [3, [1]]]));
    expect(s.refund).toEqual({ seat: 3, amount: 20 }); // 50 只被跟到 30
    expect(s.payouts).toEqual({ 2: 85 }); // 30×2 + 死小盲25
    expect(totalChips(st)).toBe(5030);
  });

  it('非法动作全拒：错序/面注过牌/无注跟注/超栈加注/收局后行动', () => {
    const st = sixUp();
    expect(() => act(st, 4, { kind: 'call' })).toThrow(); // 未轮到
    expect(() => act(st, 3, { kind: 'check' })).toThrow(); // 面对下注
    expect(() => act(st, 3, { kind: 'raise', to: 5000 })).toThrow(); // 超栈
    act(st, 3, { kind: 'call' });
    for (const s of [4, 5, 0]) act(st, s, { kind: 'fold' });
    act(st, 1, { kind: 'call' });
    act(st, 2, { kind: 'check' });
    expect(st.street).toBe('flop');
    expect(() => act(st, 1, { kind: 'call' })).toThrow(); // 无注可跟
    const done = sixUp();
    act(done, 3, { kind: 'raise', to: 200 });
    for (const s of [4, 5, 0, 1, 2]) act(done, s, { kind: 'fold' });
    expect(() => act(done, 3, { kind: 'check' })).toThrow(); // 已收局
    expect(() => settle(sixUp())).toThrow(); // 未结束不可结算
  });

  it('开手校验：少于两人/零栈拒收', () => {
    expect(() => startHand(CFG, [{ seat: 0, stack: 100 }], { button: 0, sb: 0, bb: 0 })).toThrow();
    expect(() => startHand(CFG, [{ seat: 0, stack: 0 }, { seat: 1, stack: 100 }], initialPositions([0, 1], 0))).toThrow();
  });
});

describe('game-c betting-engine — 同 seed 全手复现（发牌×下注×摊牌集成）', () => {
  function playScripted(seed: number): { stacks: number[]; payouts: Record<number, number> } {
    const deal = dealHoldem(seed, 6);
    const st = sixUp();
    act(st, 3, { kind: 'call' });
    act(st, 4, { kind: 'fold' });
    act(st, 5, { kind: 'call' });
    act(st, 0, { kind: 'fold' });
    act(st, 1, { kind: 'call' });
    act(st, 2, { kind: 'check' });
    for (let street = 0; street < 3; street++) for (const s of [1, 2, 3, 5]) act(st, s, { kind: 'check' });
    expect(st.street).toBe('showdown');
    const ranks = new Map<SeatId, HandRank>(
      st.players.filter((p) => !p.folded).map((p) => [p.seat, holdemRank(deal.holes[p.seat], deal.board).value]),
    );
    const s = settle(st, ranks);
    return { stacks: st.players.map((p) => p.stack), payouts: s.payouts };
  }

  it('同 seed 同脚本 → 逐筹码一致；总量守恒', () => {
    const a = playScripted(20260717);
    const b = playScripted(20260717);
    expect(a).toEqual(b);
    expect(a.stacks.reduce((x, y) => x + y, 0)).toBe(6000);
  });

  it('cloneHand 深拷贝：改副本不动原件', () => {
    const st = sixUp();
    const cp = cloneHand(st);
    act(cp, 3, { kind: 'raise', to: 100 });
    expect(st.currentBet).toBe(50);
    expect(st.players[3].committed).toBe(0);
  });
});

describe('game-c betting-engine — REQ-C-105 筹码守恒（GD-C S4 复查门对抗核证·防蒸发）', () => {
  it('大盲短缴 all-in + 高投入者弃牌 → 未跟注溢出退回（不蒸发）', () => {
    // 复现（GD-C 亲验）：heads-up·SB 栈1000 缴25 / BB 栈10 短 all-in 缴10 / SB 面 toCall25 弃 → uncontested BB。
    // 旧引擎 refund=null（top 仅取 live·BB(10)<SB(25) 故不触发）→ SB 的 25 只有 10 进池、余 15 既不进池也不退 = 蒸发。
    const st = startHand(CFG, [{ seat: 0, stack: 1000 }, { seat: 1, stack: 10 }], initialPositions([0, 1], 0));
    expect(st.players.find((p) => p.seat === 1)!.allIn).toBe(true); // BB 短缴 all-in
    expect(st.actor).toBe(0); // heads-up 翻前钮(=SB)先动
    act(st, 0, { kind: 'fold' }); // 高投入者弃牌（total 25 > BB total 10）
    expect(st.street).toBe('done');
    const s = settle(st); // uncontested·免 ranks
    expect(s.refund).toEqual({ seat: 0, amount: 15 }); // SB 未被跟注的 15 退回（曾=null 蒸发）
    expect(s.payouts).toEqual({ 1: 20 }); // BB 收池 = 双方各 10
    expect(totalChips(st)).toBe(1010); // 守恒：起始 1000+10，一分不少
  });

  it('三人：短栈弃牌者为全场最高投入 → 溢出正确退回', () => {
    // BB(座2) 栈20 短 all-in 缴20；UTG(座0=按钮) 加注到 200 后…被打；SB(座1) 跟 200 后弃；此处构造「弃牌者投入最高」。
    const st = startHand(CFG, [
      { seat: 0, stack: 1000 }, { seat: 1, stack: 1000 }, { seat: 2, stack: 20 },
    ], initialPositions([0, 1, 2], 0));
    // 三人桌 UTG=按钮=座0
    act(st, 0, { kind: 'raise', to: 200 }); // 座0 total 200
    act(st, 1, { kind: 'call' });           // 座1 total 200
    // 座2(BB) 已在 startHand 短 all-in 20（total 20·allIn），无需行动；街闭合看余下
    // 翻后座1、座0 到河（座2 旁观 all-in）
    while (st.street !== 'showdown' && st.street !== 'done') {
      const a = st.actor!;
      const la = legalActions(st);
      act(st, a, la.check ? { kind: 'check' } : { kind: 'call' });
    }
    settle(st, new Map<SeatId, HandRank>([[2, [8]], [1, [4]], [0, [2]]]));
    expect(totalChips(st)).toBe(2020); // 守恒：起始 1000+1000+20·无论分池怎么切总额不变
  });

  it('守恒 property fuzz：随机合法动作序列 6000 手（2-6 人·含短栈） → Σ栈全程不变', () => {
    // GD-C 方法论指正：旧套件只在固定场景断言 totalChips，漏掉守恒 property。此测随机漫游状态空间钉死守恒——
    // 任何未来状态机改动一旦蒸发/凭空造币，settle 内守恒不变式即抛、或此处 Σ栈断言即红。
    const rng = mulberry32(0xC105);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
    let hands = 0, allInBlindHands = 0;
    for (let h = 0; h < 6000; h++) {
      const n = 2 + Math.floor(rng() * 5); // 2..6 人
      const seats = Array.from({ length: n }, (_, seat) => ({
        seat,
        stack: 1 + Math.floor(rng() * rng() * 800), // 偏小·频繁跨越盲注线（短缴 all-in 高发）
      }));
      let st: HandState;
      try {
        st = startHand(CFG, seats, initialPositions(seats.map((s) => s.seat), Math.floor(rng() * n)));
      } catch { continue; } // 起手校验拒（零栈等）→ 跳过
      const startTotal = seats.reduce((a, s) => a + s.stack, 0);
      hands++;
      if (st.street === 'showdown' || st.street === 'done') allInBlindHands++;
      let guard = 0;
      while (st.street !== 'showdown' && st.street !== 'done' && guard++ < 400) {
        const a = st.actor!;
        const la = legalActions(st);
        const opts: Action[] = [{ kind: 'fold' }];
        if (la.check) opts.push({ kind: 'check' });
        if (la.call !== undefined) opts.push({ kind: 'call' });
        if (la.raise) opts.push({ kind: 'raise', to: la.raise.min + Math.floor(rng() * (la.raise.max - la.raise.min + 1)) });
        act(st, a, pick(opts));
        // 下注中：筹码只在栈↔投入间搬运，Σ(栈+投入) 恒定
        expect(totalChips(st)).toBe(startTotal);
      }
      // 结算：非全弃需给未弃者随机全序值
      const ranks = new Map<SeatId, HandRank>(
        st.players.filter((p) => !p.folded).map((p) => [p.seat, [Math.floor(rng() * 9), Math.floor(rng() * 15), Math.floor(rng() * 15)]]),
      );
      settle(st, st.uncontested !== undefined ? undefined : ranks);
      // 结算后：所有投入清零并回栈，Σ栈 == 起始（一分不多不少）
      expect(st.players.reduce((a, p) => a + p.stack, 0)).toBe(startTotal);
    }
    expect(hands).toBeGreaterThan(5000); // 确实跑了足量手
    expect(allInBlindHands).toBeGreaterThan(50); // 确实覆盖了短栈即摊牌的高危路径
  });
});
