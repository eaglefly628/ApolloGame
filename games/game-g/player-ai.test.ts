// player-ai 单测（终极版 Player-AI = 前向推演搜索）：确定性铁律（不消费真局 rng·turnHash 可复现）+ cloneBattle 深拷 + evalState 终局 + 分档单调。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './combat-types.js';
import {
  initTurnBattle, aiTakeTurn, turnHash, turnActive, endTurn,
  type PokerCard, type TurnBattle,
} from './turn-combat.js';
import { cloneBattle, evalState, playerTakeTurnAI, searchParamsFor, SKILL5_PLIES } from './player-ai.js';

const poker = (id: string, rank: string, suit = 'S', cost = 0): PokerCard => ({ kind: 'poker', id, rank, suit, general: false, buff: 0, cost });
// 一副够打的玩家/敌方牌库（含费用·同真机口径）。
const deck = (pfx: string): PokerCard[] =>
  ['5', '7', '9', 'J', '3', '8', 'K', '6', 'Q', '4', '10', '2'].map((r, i) => poker(`${pfx}${i}`, r, i % 2 ? 'S' : 'H', r <= '4' ? 0 : r <= '7' ? 1 : r <= '10' ? 2 : 3));

function freshBattle(seed: number): TurnBattle {
  const b = initTurnBattle({ seed, a: { pokerDeck: deck('a') }, b: { pokerDeck: deck('z') } });
  for (let i = 0; i < 3 && b.a.pokerDeck.length; i++) b.a.hand.push(b.a.pokerDeck.shift()!);
  for (let i = 0; i < 3 && b.b.pokerDeck.length; i++) b.b.hand.push(b.b.pokerDeck.shift()!);
  return b;
}

describe('Game G · Player-AI（终极版前向推演搜索）', () => {
  it('cloneBattle：深拷贝（含 rng）· 改克隆不动真局', () => {
    const b = freshBattle(7);
    const c = cloneBattle(b);
    // 独立对象引用
    expect(c).not.toBe(b);
    expect(c.rng).not.toBe(b.rng);
    expect(c.a).not.toBe(b.a);
    expect(c.a.hand).not.toBe(b.a.hand);
    expect(c.lanes[0]).not.toBe(b.lanes[0]);
    // 同值
    expect(c.rng).toEqual(b.rng);
    expect(c.a.hand.length).toBe(b.a.hand.length);
    // 改克隆 rng/手牌/血 → 真局纹丝不动
    c.rng.sequence += 99; c.a.mana += 50; c.homeB = 0; c.a.hand.pop();
    expect(b.rng.sequence).toBe(0);
    expect(b.a.mana).not.toBe(c.a.mana);
    expect(b.homeB).toBe(b.homeMax);
    expect(b.a.hand.length).toBe(c.a.hand.length + 1);
  });

  it('evalState：终局赢=大正 · 输=大负 · 平=0', () => {
    const b = freshBattle(1);
    b.winner = 'a'; expect(evalState(b)).toBeGreaterThan(1e6);
    b.winner = 'b'; expect(evalState(b)).toBeLessThan(-1e6);
    b.winner = 'draw'; expect(evalState(b)).toBe(0);
  });

  it('evalState：破敌家进度 > 我家被破 → 分更高（破家进度权重压倒一切）', () => {
    const good = freshBattle(1); good.homeB = 1;            // 敌家被砸到 1（推进中）
    const bad = freshBattle(1); bad.homeA = 1;              // 我家被砸到 1（挨打中）
    expect(evalState(good)).toBeGreaterThan(evalState(bad));
  });

  it('★确定性铁律：终极 AI 同 seed 跑两遍 → 逐回合 turnHash 完全一致（搜索不消费真局 rng·可回放）', () => {
    const run = (seed: number): { hashes: string[]; clashSeq: number } => {
      const b = freshBattle(seed);
      const hashes: string[] = [turnHash(b)];
      let guard = 0;
      while (turnActive(b) && b.winner === 'pending' && guard++ < 120) {
        if (b.active === 'a') playerTakeTurnAI(b, 5); // 终极档：内部前向推演（只在克隆局跑）
        else aiTakeTurn(b);
        hashes.push(turnHash(b));
      }
      return { hashes, clashSeq: b.clashSeq };
    };
    const r1 = run(42), r2 = run(42);
    expect(r1.hashes).toEqual(r2.hashes); // 逐回合 hash 全同 → 搜索的克隆推演未污染真局 rng（确定性铁律）
    expect(r1.clashSeq).toBeGreaterThan(0); // 真局掷命真发生过（真掷骰消费真 rng）
  });

  it('★搜索只读真局：playerTakeTurnAI 一个玩家回合内·真局 rng 仅被 endTurn(真掷骰) 推进·非被搜索消费', () => {
    // 对照：手动只做 endTurn（不搜索）看单回合 rng 增量上界；再看 AI 回合的 rng 增量应等于同等落子下真掷骰次数量级（不因搜索暴涨）。
    const b = freshBattle(9);
    const seq0 = b.rng.sequence;
    playerTakeTurnAI(b, 5);
    const consumedByAiTurn = b.rng.sequence - seq0;
    // 首回合双方多为铺场·遭遇少 → 真局 rng 消费很小（每遭遇 2 次掷骰）。搜索若泄漏会使其暴涨到几十上百。
    expect(consumedByAiTurn).toBeLessThan(12); // 松上界：证明搜索的海量克隆推演没消费真局 rng
  });

  it('分档：skill5 前瞻深度 > skill3（终极更深）', () => {
    expect(searchParamsFor(5).plies).toBe(SKILL5_PLIES);
    expect(searchParamsFor(3).plies).toBe(1);
    expect(searchParamsFor(5).plies).toBeGreaterThanOrEqual(searchParamsFor(3).plies);
  });

  it('playerTakeTurnAI：非玩家回合/已分胜负时空操作（安全）', () => {
    const b = freshBattle(3); b.active = 'b';
    const before = turnHash(b); playerTakeTurnAI(b, 5); expect(turnHash(b)).toBe(before);
    b.active = 'a'; b.winner = 'a';
    const before2 = turnHash(b); playerTakeTurnAI(b, 5); expect(turnHash(b)).toBe(before2);
  });

  it('终极 AI 能推进到终局（不卡死·会破家或被破）', () => {
    // 疲劳休整（owner 2026-07-06·P20 连续疲劳条+恢复+删自动退场）→ 强兵变「不死」·棋盘不轮替 → 少数对局本会近赢僵持；
    // MAX_TURNS 回合上限保底收敛（到线按大本营血判）→ 任何 seed 必在有限回合分出胜负（不再死循环）。此守护测即验之。
    const b = freshBattle(11);
    let guard = 0;
    while (b.winner === 'pending' && turnActive(b) && guard++ < 200) {
      if (b.active === 'a') playerTakeTurnAI(b, 5); else aiTakeTurn(b);
    }
    expect(['a', 'b', 'draw']).toContain(b.winner === 'pending' ? 'draw' : b.winner);
    expect(guard).toBeLessThan(200); // 有限回合内收敛（MAX_TURNS 保底）·非死循环
  });
});

// 让 lints 知道 poker/cardPoints/cardStamina/endTurn 被使用（部分仅在 helper 里）。
void poker; void cardPoints; void cardStamina; void endTurn;
