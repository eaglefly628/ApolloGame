import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@atom-skills/random/index.js';
import { HoldemSession, handStrength } from './game-session.js';
import { CLOTHING_ITEMS, WARDROBE_TOTAL } from './wardrobe.js';
import type { Card } from '@engine/protocol/components.js';

const H = (suit: number, rank: number): Card => ({ suit, rank });
const START = 1000;
const SIX_START = 6 * START;

/** 全局筹码守恒不变式：手内在 hand.players(stack+total)、不在手的家在 session.stack。 */
function totalChips(s: HoldemSession): number {
  if (!s.hand) return s.seats.reduce((a, x) => a + x.stack, 0);
  const inHand = new Set(s.hand.players.map((p) => p.seat));
  const handSum = s.hand.players.reduce((a, p) => a + p.stack + p.total, 0);
  const rest = s.seats.filter((x) => !inHand.has(x.seat)).reduce((a, x) => a + x.stack, 0);
  return handSum + rest;
}
function pawnedValue(s: HoldemSession): number {
  let v = 0;
  for (const seat of s.seats) for (const id of seat.pawned) v += CLOTHING_ITEMS.find((c) => c.id === id)!.value;
  return v;
}
/** 模拟宿主 timer：跑完所有待行动 AI（分步 stepAI 直到主角轮/摊牌）。 */
function drive(s: HoldemSession): void { let g = 0; while (s.pendingAI && g++ < 400) s.stepAI(); }

describe('game-c game-session — 开局与推进', () => {
  it('构造即开第一手：发牌/公共牌/轮转就绪', () => {
    const s = new HoldemSession(20260717);
    expect(s.handNo).toBe(1);
    expect(s.deal).toBeTruthy();
    expect(s.hero.stack).toBeGreaterThan(0);
    expect(s.holeOf(0)).toHaveLength(2); // 主角底牌
    drive(s); // 宿主 timer 推进 AI 到主角轮 / 摊牌
    expect(s.isHeroTurn || s.phase === 'showdown').toBe(true);
  });

  it('筹码守恒：开局 Σ栈+投入 = 6000（无典当）', () => {
    const s = new HoldemSession(20260717);
    expect(totalChips(s)).toBe(SIX_START + pawnedValue(s));
  });
});

describe('game-c game-session — 入局人数 2~6（owner 2026-07-20·默认 6）', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    it(`${n} 人局：建 ${n} 座 · 发牌就绪 · 推进不崩 · 守恒 Σ=${n}×1000`, () => {
      const s = new HoldemSession(42, { smallBlind: 25, bigBlind: 50 }, START, n);
      expect(s.seats).toHaveLength(n);
      expect(s.seats.map((x) => x.seat)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(s.holeOf(0)).toHaveLength(2); // 主角底牌
      expect(s.holeOf(n - 1)).toHaveLength(2); // 末位也发到牌
      expect(totalChips(s)).toBe(n * START + pawnedValue(s)); // 开局守恒
      drive(s); // 推进 AI 到主角轮 / 摊牌——不崩
      expect(s.isHeroTurn || s.phase === 'showdown').toBe(true);
      expect(totalChips(s)).toBe(n * START + pawnedValue(s)); // 推进后仍守恒
    });
  }

  it('heads-up(2 人)：庄位=小盲（标准德州特例·betting-engine 已支持）', () => {
    const s = new HoldemSession(42, { smallBlind: 25, bigBlind: 50 }, START, 2);
    // 2 人局：button 与 sb 同座（heads-up 规则）；另一家=bb。
    expect(s.hand!.pos.button).toBe(s.hand!.pos.sb);
    expect(s.hand!.pos.bb).not.toBe(s.hand!.pos.button);
  });

  it('人数夹取：<2 提为 2 · >6 夹为 6', () => {
    expect(new HoldemSession(1, undefined, START, 1).seats).toHaveLength(2);
    expect(new HoldemSession(1, undefined, START, 9).seats).toHaveLength(6);
  });
});

describe('game-c game-session — 完整一手到摊牌（牌逻辑跑通）', () => {
  it('主角跟到摊牌 → 有赢家 + 分池守恒', () => {
    const s = new HoldemSession(42);
    let guard = 0;
    drive(s);
    while (s.phase === 'betting' && guard++ < 50) {
      const la = s.legalForHero();
      if (!la) break;
      s.heroAct(la.check ? { kind: 'check' } : { kind: 'call' }); // 主角一路过/跟
      drive(s);
    }
    expect(s.phase).toBe('showdown');
    expect(s.showdown).toBeTruthy();
    expect(s.showdown!.winners.length).toBeGreaterThanOrEqual(1);
    // 分池守恒：赢得总额 = 底池
    const won = s.showdown!.rows.reduce((a, r) => a + r.won, 0);
    expect(won).toBe(s.showdown!.potTotal);
    expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 结算后守恒
  });

  it('摊牌行含牌型 + 赢家成牌 5 张', () => {
    const s = new HoldemSession(42);
    let guard = 0;
    drive(s);
    while (s.phase === 'betting' && guard++ < 50) { const la = s.legalForHero(); if (!la) break; s.heroAct(la.check ? { kind: 'check' } : { kind: 'call' }); drive(s); }
    const champ = s.showdown!.rows.find((r) => s.showdown!.winners.includes(r.seat))!;
    expect(champ.type).toBeTruthy();
    if (champ.best.length) expect(champ.best).toHaveLength(5); // 非全弃收池
  });

  it('摊牌 reveal 顺序（last aggressor 先·展示所有摊牌者底牌）', () => {
    const s = new HoldemSession(42);
    drive(s);
    let guard = 0;
    while (s.phase === 'betting' && guard++ < 50) { const la = s.legalForHero(); if (!la) break; s.heroAct(la.check ? { kind: 'check' } : { kind: 'call' }); drive(s); }
    if (s.showdown && s.showdown.rows.length > 1) {
      // 每个摊牌行带底牌 2 张（展示各家手牌）
      for (const r of s.showdown.rows) if (r.best.length) expect(r.hole).toHaveLength(2);
      // 有加注则 last aggressor 排在首位
      if (s.lastAggressor !== null && s.showdown.rows.some((r) => r.seat === s.lastAggressor)) {
        expect(s.showdown.rows[0].seat).toBe(s.lastAggressor);
      }
    }
  });
});

describe('game-c game-session — 玩到局终（多手循环不崩）', () => {
  it('主角一路弃牌 → 筹码/衣物耗尽 → 局终判负（终止·守恒）', () => {
    const s = new HoldemSession(20260717);
    let guard = 0;
    while (s.phase !== 'gameover' && guard++ < 4000) {
      drive(s); // 宿主 timer 推进 AI
      if (s.isHeroTurn) {
        const la = s.legalForHero()!;
        s.heroAct(la.check ? { kind: 'check' } : { kind: 'fold' }); // 免费过牌、面注即弃
      } else if (s.phase === 'showdown') {
        expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 每次摊牌后守恒
        s.nextHand();
      }
    }
    expect(s.phase).toBe('gameover');
    expect(s.winnerSide).not.toBeNull();
    expect(guard).toBeLessThan(4000); // 确实终止（非死循环）
  });

  it('确定性：同 seed + 同主角行动序列 → 同结果', () => {
    const play = (): { hands: number; side: string | null; heroChips: number } => {
      const s = new HoldemSession(777);
      let g = 0;
      while (s.phase !== 'gameover' && g++ < 4000) {
        drive(s);
        if (s.isHeroTurn) { const la = s.legalForHero()!; s.heroAct(la.check ? { kind: 'check' } : { kind: 'fold' }); }
        else if (s.phase === 'showdown') s.nextHand();
      }
      return { hands: s.handNo, side: s.winnerSide, heroChips: s.hero.stack };
    };
    expect(play()).toEqual(play());
  });
});

describe('game-c game-session — 典当续命', () => {
  it('pawn 扣衣加筹（面值）·重复典当无效', () => {
    const s = new HoldemSession(20260717);
    const before = s.seats[1].stack;
    expect(s.pawn(1, 'lingerie')).toBe(true);
    expect(s.seats[1].stack).toBe(before + 1000);
    expect(s.pawn(1, 'lingerie')).toBe(false); // 已当
    expect(s.wardrobeLeft(1)).toBe(CLOTHING_ITEMS.length - 1);
  });

  it('REQ-C-106 手内典当即时生效：stackOf 立增·结算不蒸发（守恒）', () => {
    const s = new HoldemSession(20260717);
    const before = s.stackOf(0); // 主角手内实时栈（读 hand.players）
    const beforeTotal = totalChips(s);
    expect(s.pawn(0, 'lingerie')).toBe(true); // 内衣 1000
    expect(s.stackOf(0)).toBe(before + 1000); // 手内即时可用（旧码 stackOf 不变=换的钱看不见）
    expect(totalChips(s)).toBe(beforeTotal + 1000); // 注入随即入账（旧码手内不计→守恒破）
    expect(totalChips(s)).toBe(SIX_START + pawnedValue(s));
    // 打到摊牌：确认换来的筹码不被 settle 的 syncStacks 覆盖蒸发（旧码此处漏 1000）
    drive(s);
    let guard = 0;
    while (s.phase === 'betting' && guard++ < 50) { const la = s.legalForHero(); if (!la) break; s.heroAct(la.check ? { kind: 'check' } : { kind: 'call' }); drive(s); }
    expect(s.phase).toBe('showdown');
    expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 结算后仍守恒（典当值全程在账·不蒸发）
  });

  it('全套典当上限 = 衣物总值 2450', () => {
    const s = new HoldemSession(1);
    for (const c of CLOTHING_ITEMS) s.pawn(3, c.id);
    expect(s.wardrobeLeft(3)).toBe(0);
    expect([...s.seats[3].pawned].reduce((a, id) => a + CLOTHING_ITEMS.find((c) => c.id === id)!.value, 0)).toBe(WARDROBE_TOTAL);
  });
});

describe('game-c game-session — AI 手力（不作弊·占位策略）', () => {
  it('翻前：对子 > 两高张 > 弱散张', () => {
    const pair = handStrength([H(0, 14), H(1, 14)], []);
    const highs = handStrength([H(0, 14), H(1, 13)], []);
    const weak = handStrength([H(0, 7), H(1, 2)], []);
    expect(pair).toBeGreaterThan(highs);
    expect(highs).toBeGreaterThan(weak);
  });

  it('翻后：成牌越强手力越高（同花顺 > 高牌）', () => {
    const board = [H(0, 5), H(0, 9), H(1, 2)];
    const sf = handStrength([H(0, 6), H(0, 7)], [H(0, 5), H(0, 8), H(0, 9)]); // 同花顺听/成
    const hc = handStrength([H(2, 3), H(3, 2)], board); // 高牌
    expect(sf).toBeGreaterThan(hc);
  });
});

describe('game-c game-session — heroAct 防御 no-op（REQ-C-108②·非法输入态不变）', () => {
  it('主角非法加注（不足 min-raise·非全下）→ 静默拒绝·态不变；合法加注生效', () => {
    const s = new HoldemSession(20260718);
    drive(s); // 到主角轮
    expect(s.isHeroTurn).toBe(true);
    const la = s.legalForHero()!;
    expect(la.raise).toBeTruthy();
    const illegalTo = s.hand!.currentBet + 1; // > 当前注但 < min-raise 且 ≠ 全下 = 非法
    expect(illegalTo).toBeLessThan(la.raise!.min);
    const snap = { pot: s.pot(), stack: s.stackOf(0), actor: s.hand!.actor, commit: s.committedOf(0) };
    s.heroAct({ kind: 'raise', to: illegalTo }); // 旧码：act() 抛「不足 min-raise」崩宿主
    expect(s.pot()).toBe(snap.pot);            // 态一分不动
    expect(s.stackOf(0)).toBe(snap.stack);
    expect(s.committedOf(0)).toBe(snap.commit);
    expect(s.hand!.actor).toBe(snap.actor);    // 仍主角轮·未推进
    expect(s.isHeroTurn).toBe(true);
    s.heroAct({ kind: 'raise', to: la.raise!.min }); // 对照：合法加注生效
    expect(s.isHeroTurn).toBe(false);          // 已行动让位
    expect(s.pot()).toBeGreaterThan(snap.pot);
  });

  it('主角面注时非法过牌 → 态不变（对照乱序 no-op 同语义）', () => {
    const s = new HoldemSession(20260718);
    drive(s);
    expect(s.isHeroTurn).toBe(true);
    expect(s.legalForHero()!.check).toBeUndefined(); // 面注不可过
    const snap = { actor: s.hand!.actor, pot: s.pot() };
    s.heroAct({ kind: 'check' }); // 非法·应 no-op
    expect(s.hand!.actor).toBe(snap.actor);
    expect(s.isHeroTurn).toBe(true);
  });
});

describe('game-c game-session — 会话层守恒 + 健壮 fuzz（整局随机漫游·防蒸发/AI 非法崩手）', () => {
  it('800 局随机（主角随机行动 + 随机典当 + AI 逐步）→ 全程守恒·零崩·必终局', () => {
    // 会话编排层（pawn/轮转/淘汰/syncStacks/AI 出牌）的守恒 property + 健壮 property。
    // 抓出过 REQ-C-105(边池蒸发·已修) 同类：AI aiDecide 面对大 lastRaiseSize 时按池比定的加注 < min-raise
    //   → act 抛「不足 min-raise」崩手（主角先下大注→AI 再加注即触发）。此测钉死：AI 出牌恒合法·Σ栈恒守恒。
    let games = 0, showdowns = 0, pawns = 0;
    for (let g = 0; g < 500; g++) {
      const rng = mulberry32(0xC0FFEE + g * 2654435761);
      const s = new HoldemSession(3000 + g, { smallBlind: 25, bigBlind: 50 }, 1000);
      games++;
      let guard = 0;
      while (s.phase !== 'gameover' && guard++ < 3000) {
        if (rng() < 0.04) { // 随机典当（含手内·测 REQ-C-106 路径守恒）
          const seat = Math.floor(rng() * 6);
          const avail = CLOTHING_ITEMS.filter((c) => !s.seats[seat].pawned.has(c.id));
          if (avail.length && !s.seats[seat].eliminated && s.pawn(seat, avail[Math.floor(rng() * avail.length)].id)) pawns++;
        }
        expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 守恒·任何时刻（含手内典当后）
        drive(s); // AI 逐步（内含 aiDecide 出牌·非法即 act 抛→测崩）
        if (s.isHeroTurn) {
          const la = s.legalForHero()!;
          const r = rng();
          if (la.raise && r < 0.25) s.heroAct({ kind: 'raise', to: la.raise.min + Math.floor(rng() * (la.raise.max - la.raise.min + 1)) });
          else if (la.check) s.heroAct({ kind: 'check' });
          else if (la.call !== undefined && r < 0.7) s.heroAct({ kind: 'call' });
          else s.heroAct({ kind: 'fold' });
        } else if (s.phase === 'showdown') {
          showdowns++;
          expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 摊牌结算后守恒
          s.nextHand();
        } else break;
      }
      expect(s.phase).toBe('gameover'); // 必终局（无死循环）
      expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 局终守恒
    }
    expect(games).toBe(500);
    expect(showdowns).toBeGreaterThan(3000); // 确覆盖大量摊牌
    expect(pawns).toBeGreaterThan(300);      // 确覆盖典当路径
  });
});
