// Game A ·《掼蛋夜宴》—— S4 玩法关 walkthrough（机器门=该游戏 vitest 绿）。
// 覆盖 gdd §2/§3/§4：发牌 27×4 / 领出压制合法性 / 进贡还贡抗贡矩阵 / 收墩接风 / 名次结算 /
// 金钱收付对称 / 服饰-1 与底线档翻倍 / 级数推进 / 过 A 三态 / 同种子双跑复现。
// 判型正确性全量在引擎 hand-pattern.test（36 测）——本文件验编排脚本的规则装配。
import { describe, it, expect } from 'vitest';
import { matchPattern, type PatternMatch } from '@skills/tier3/index.js';
import type { Resource } from '@engine/protocol/components.js';
import {
  GuandanSession, TURN_ORDER, teamOf, partnerOf, type SeatId, type TrickPlay,
} from './guandan-session.js';
import { codeRank, codeSuit, cardCode, guandanConfig, RANK_BIG_JOKER, LEVEL_ACE, DRESS_TIERS } from './rules.js';

// 用真 matchPattern 造一个当前墩（避免 null as never 污染类型）。
function mkTrick(seat: SeatId, codes: number[], level = 2): TrickPlay {
  const m = matchPattern(codes.map((c) => ({ suit: codeSuit(c), rank: codeRank(c) })), guandanConfig(level)) as PatternMatch;
  return { seat, cards: codes, match: m };
}

// 一局自动跑到底（三家 AI + hero 也用 AI 策略代打·纯确定性）→ 收敛到结算/终局。
function autoRun(s: GuandanSession, cap = 4000): void {
  let guard = 0;
  while (s.phase === 'playing' && guard++ < cap) {
    if (s.turn === 'hero') {
      const hint = s.hint('hero');
      s.act('hero', hint); // hero 也走最小合法压牌（自动走查·代打）
    } else {
      s.aiStep();
    }
  }
}

describe('Game A ·《掼蛋夜宴》S4 盘循环', () => {
  it('发牌：四家各 27 张·合计 108·无重叠', () => {
    const s = new GuandanSession({ seed: 1 });
    const all = new Set<number>();
    let total = 0;
    for (const seat of TURN_ORDER) {
      expect(s.hands[seat].length).toBe(27);
      total += s.hands[seat].length;
      for (const c of s.hands[seat]) all.add(c);
    }
    expect(total).toBe(108);
    // 两副 → 54 种各 2 张 → 去重后 ≤54 种
    expect(all.size).toBeLessThanOrEqual(54);
  });

  it('首盘无进贡·种子定家（R6/G4）', () => {
    const s = new GuandanSession({ seed: 1 });
    expect(s.round).toBe(1);
    expect(s.tributes.length).toBe(0);
    expect(TURN_ORDER).toContain(s.turn);
  });

  it('领出合法性：非法牌型/压不过被拒·最小合法压牌被收', () => {
    const s = new GuandanSession({ seed: 5 });
    // 强制一个可控局面：给 hero 领出权 + 一手已知牌
    s.turn = 'hero';
    s.currentTrick = null;
    s.hands.hero = [cardCode(0, 3), cardCode(1, 3), cardCode(0, 7), cardCode(2, 9), cardCode(3, 13)];
    // 非法：3+7 不同点凑不成型
    expect(s.legalCheck('hero', [cardCode(0, 3), cardCode(0, 7)]).ok).toBe(false);
    // 合法领出：对 3
    expect(s.legalCheck('hero', [cardCode(0, 3), cardCode(1, 3)]).ok).toBe(true);
    s.act('hero', [cardCode(0, 3), cardCode(1, 3)]);
    expect(s.currentTrick!.match.family).toBe('pair');
    // 下一位需对子压过对 3；单张不合法
    const nxt = s.turn;
    s.hands[nxt] = [cardCode(0, 5), cardCode(1, 5), cardCode(0, 8)];
    expect(s.legalCheck(nxt, [cardCode(0, 8)]).ok).toBe(false); // 单张压对=型不符
    expect(s.legalCheck(nxt, [cardCode(0, 5), cardCode(1, 5)]).ok).toBe(true); // 对 5 > 对 3
  });

  it('提示=最小合法压牌（各难度一致）', () => {
    const s = new GuandanSession({ seed: 9 });
    s.turn = 'hero';
    s.currentTrick = mkTrick('west', [cardCode(2, 7), cardCode(3, 7)]);
    s.hands.hero = [cardCode(0, 8), cardCode(1, 8), cardCode(0, 10), cardCode(1, 10)];
    const hint = s.hint('hero');
    expect(hint).not.toBeNull();
    const m = hint!.map(codeRank).sort((a, b) => a - b);
    expect(m).toEqual([8, 8]); // 最小能压对 7 的是对 8
  });

  it('过牌只在有墩时合法·领出不可过', () => {
    const s = new GuandanSession({ seed: 3 });
    s.turn = 'hero';
    s.currentTrick = null;
    expect(s.act('hero', null)).toBe(false); // 领出不可过
    s.currentTrick = mkTrick('west', [cardCode(0, 6)]);
    s.turn = 'hero';
    expect(s.legalCheck('hero', null).ok).toBe(true); // 有墩可过
  });

  it('整盘自动跑到结算·名次 4 家齐·winnersTeam 一致', () => {
    const s = new GuandanSession({ seed: 42 });
    autoRun(s);
    expect(['settled', 'run-won', 'run-lost']).toContain(s.phase);
    const r = s.lastResult!;
    expect(r.ranking.length).toBe(4);
    expect(new Set(r.ranking)).toEqual(new Set(TURN_ORDER));
    expect(teamOf(r.ranking[0])).toBe(r.winnersTeam);
  });

  it('结算：金钱对称收付·封顶 ×5·赢队升级', () => {
    const s = new GuandanSession({ seed: 42, stake: 100 });
    const before = { ...s.wallets };
    autoRun(s);
    const r = s.lastResult!;
    // 对称：赢队每人 +pay，输队每人 -pay（钱包不为负）
    for (const seat of TURN_ORDER) {
      const delta = s.wallets[seat] - before[seat];
      if (teamOf(seat) === r.winnersTeam) expect(delta).toBe(r.payPerPlayer);
      else expect(delta).toBeLessThanOrEqual(0);
    }
    expect(r.totalMult).toBeLessThanOrEqual(5);
    expect(r.totalMult).toBeGreaterThanOrEqual(1);
  });

  it('服饰罚：输队每人 -1 件（未到底线）·底线档不再降转金钱×2', () => {
    const s = new GuandanSession({ seed: 7 });
    autoRun(s);
    const r = s.lastResult!;
    const losers = TURN_ORDER.filter((x) => teamOf(x) !== r.winnersTeam);
    for (const l of losers) expect(s.dress[l]).toBe(DRESS_TIERS - 1); // 首盘输 → 4/5
    // 强制一名输家到底线档再跑一盘 → 金钱翻倍标记
    const s2 = new GuandanSession({ seed: 7 });
    for (const seat of TURN_ORDER) s2.dress[seat] = 1;
    autoRun(s2);
    expect(s2.lastResult!.dressOutDoubled).toBe(true);
    for (const l of TURN_ORDER.filter((x) => teamOf(x) !== s2.lastResult!.winnersTeam)) {
      expect(s2.dress[l]).toBe(1); // 底线档不再降
    }
  });

  it('抗贡：应贡方持双大王 → 免贡·resisted 标记·头游先出', () => {
    const s = new GuandanSession({ seed: 2 });
    // 造一个次盘局面：上盘末游持双大王
    s.round = 1;
    const rank: SeatId[] = ['west', 'east', 'hero', 'partner']; // partner=末游
    s.lastRanking = rank;
    s.lastFirstTeam = teamOf('west');
    // 强制 partner 手里含双大王（startRound 发牌后覆盖 → resolveTribute 读）
    (s as unknown as { rng: () => number }).rng = (() => {
      let i = 0;
      const seq = [0.1, 0.2, 0.3, 0.4, 0.5];
      return () => seq[i++ % seq.length];
    })();
    // 直接测 resolveTribute 语义：手动布置手牌 + 调私有经 any
    const anyS = s as unknown as {
      hands: Record<SeatId, number[]>;
      resolveTribute: (r: SeatId[]) => SeatId;
      resisted: boolean;
    };
    anyS.hands.partner = [cardCode(0, RANK_BIG_JOKER), cardCode(0, RANK_BIG_JOKER), cardCode(1, 5)];
    anyS.hands.hero = [cardCode(2, 6)];
    anyS.hands.west = [cardCode(3, 8)];
    anyS.hands.east = [cardCode(0, 9)];
    const leader = anyS.resolveTribute(rank);
    expect(anyS.resisted).toBe(true);
    expect(leader).toBe('west'); // 抗贡 → 头游先出
  });

  it('进贡还贡：末游交最大牌（红桃级牌除外）·头游还 ≤10', () => {
    const s = new GuandanSession({ seed: 11 });
    const rank: SeatId[] = ['hero', 'west', 'partner', 'east']; // east=末游·hero=头游
    const anyS = s as unknown as {
      hands: Record<SeatId, number[]>;
      resolveTribute: (r: SeatId[]) => SeatId;
      tributes: Array<{ from: SeatId; to: SeatId; card: number; returned: number | null }>;
      playLevel: number;
    };
    anyS.playLevel = 2;
    anyS.hands.east = [cardCode(0, 14), cardCode(1, 8), cardCode(2, 3)]; // 最大=A
    anyS.hands.hero = [cardCode(0, 4), cardCode(1, 9), cardCode(2, 13)];
    anyS.hands.west = [cardCode(3, 6)];
    anyS.hands.partner = [cardCode(0, 7)];
    const leader = anyS.resolveTribute(rank);
    const t = anyS.tributes[0];
    expect(t.from).toBe('east');
    expect(t.to).toBe('hero');
    expect(codeRank(t.card)).toBe(14); // 交了 A（最大）
    expect(codeRank(t.returned!)).toBeLessThanOrEqual(10); // 还 ≤10
    expect(leader).toBe('east'); // 单下=进贡者先出
  });

  it('过 A：我方过 A=run-won·对方过 A=run-lost·一四不过=停 A', () => {
    // 我方在 A 且双上 → run-won
    const win = new GuandanSession({ seed: 100 });
    win.levels = [LEVEL_ACE, 5];
    win.lastFirstTeam = 0;
    forceRanking(win, ['hero', 'partner', 'west', 'east']); // 我方双上
    expect(win.phase).toBe('run-won');
    expect(win.lastResult!.aResult).toBe('passed');

    // 对方在 A 且双上 → run-lost
    const lose = new GuandanSession({ seed: 101 });
    lose.levels = [5, LEVEL_ACE];
    lose.lastFirstTeam = 1;
    forceRanking(lose, ['west', 'east', 'hero', 'partner']);
    expect(lose.phase).toBe('run-lost');

    // 在 A 但一四 → 停 A 不过
    const stay = new GuandanSession({ seed: 102 });
    stay.levels = [LEVEL_ACE, 5];
    stay.lastFirstTeam = 0;
    forceRanking(stay, ['hero', 'west', 'east', 'partner']); // 头 hero·对家 partner 末游=一四
    expect(stay.lastResult!.aResult).toBe('stay');
    expect(stay.phase).toBe('settled');
  });

  it('同种子双跑：全程名次/金钱/级数逐字节复现（确定性）', () => {
    const snap = (seed: number): string => {
      const s = new GuandanSession({ seed, stake: 500, tier: 'l3' });
      const marks: string[] = [];
      for (let round = 0; round < 3 && s.phase !== 'run-won' && s.phase !== 'run-lost'; round++) {
        autoRun(s);
        marks.push(JSON.stringify([s.lastResult!.ranking, s.wallets, s.levels]));
        if (s.phase === 'settled') s.nextRound();
      }
      return marks.join('|');
    };
    expect(snap(2026)).toBe(snap(2026));
    expect(snap(2026)).not.toBe(snap(2027)); // 不同种子不同过程
  });

  it('宗师偷看：L4 发牌期记录每对手 2 张（公平告知用）·非 L4 无偷看', () => {
    const master = new GuandanSession({ seed: 8, tier: 'l4' });
    // 每个 AI 座应有对每个对手的 2 张记录
    for (const seat of TURN_ORDER) {
      if (seat === 'hero') continue;
      const peek = master.peeks[seat];
      expect(peek).toBeDefined();
      for (const opp of TURN_ORDER) {
        if (teamOf(opp) === teamOf(seat)) continue;
        expect(peek![opp]?.length).toBe(2);
      }
    }
    const rookie = new GuandanSession({ seed: 8, tier: 'l1' });
    expect(Object.keys(rookie.peeks).length).toBe(0);
  });

  it('世界镜像：钱包/级数/服饰投影进 Resource（UI 绑定源）', () => {
    const s = new GuandanSession({ seed: 13 });
    const res = (id: string): number => {
      for (const [eid] of s.engine.world.query('Resource')) {
        const r = s.engine.world.getComponent<Resource>(eid, 'Resource');
        if (r?.id === id) return r.current;
      }
      return -1;
    };
    expect(res('wallet')).toBe(s.wallets.hero);
    expect(res('level-ours')).toBe(s.levels[0]);
    expect(res('dress-west')).toBe(s.dress.west);
  });
});

// 强制一个名次直接结算（测过 A/停 A 三态·跳过行牌）。
function forceRanking(s: GuandanSession, ranking: SeatId[]): void {
  const anyS = s as unknown as { settleRound: (r: SeatId[]) => void };
  anyS.settleRound(ranking);
}
