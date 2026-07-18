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
import { codeRank, codeSuit, cardCode, guandanConfig, sortHand, RANK_BIG_JOKER, LEVEL_ACE, DRESS_TIERS } from './rules.js';

// 用真 matchPattern 造一个当前墩（避免 null as never 污染类型）。
function mkTrick(seat: SeatId, codes: number[], level = 2): TrickPlay {
  const m = matchPattern(codes.map((c) => ({ suit: codeSuit(c), rank: codeRank(c) })), guandanConfig(level)) as PatternMatch;
  return { seat, cards: codes, match: m };
}

// 一局自动跑到底（三家 AI + hero 也用 AI 策略代打·纯确定性）→ 收敛到结算/终局。
// 返回步数（用于卡死检测：收敛应远小于 cap）。
function autoRun(s: GuandanSession, cap = 4000): number {
  let guard = 0;
  while (s.phase === 'playing' && guard++ < cap) {
    if (s.turn === 'hero') {
      const hint = s.hint('hero');
      s.act('hero', hint); // hero 也走最小合法压牌（自动走查·代打）
    } else {
      s.aiStep();
    }
  }
  return guard;
}

// 活跃座 = 手里仍有牌。turn 永远指向活跃座（除非盘/run 已终）——防「轮转指向出光座 → 卡死」回归。
function turnIsActive(s: GuandanSession): boolean {
  return s.hands[s.turn].length > 0;
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

  // ── levelUp 派生字段=实际级数增量（GD-A 验收剧本①报「非双上恒 0」派生 bug·PE 修）────────────
  it('结算 levelUp=实际级数增量：双上+3/一三+2/一四+1/打A局不升=0', () => {
    const up = (levels: [number, number], ranking: SeatId[]): number => {
      const s = new GuandanSession({ seed: 1 });
      s.levels = [...levels] as [number, number];
      forceRanking(s, ranking);
      return s.lastResult!.levelUp;
    };
    expect(up([2, 2], ['hero', 'partner', 'west', 'east'])).toBe(3); // 双上 +3
    expect(up([2, 2], ['hero', 'west', 'partner', 'east'])).toBe(2); // 一三 +2（旧 bug 恒报 0）
    expect(up([2, 2], ['hero', 'west', 'east', 'partner'])).toBe(1); // 一四 +1（旧 bug 恒报 0）
    expect(up([14, 5], ['hero', 'partner', 'west', 'east'])).toBe(0); // 打 A 局双上=过 A·不再升
    expect(up([12, 2], ['hero', 'partner', 'west', 'east'])).toBe(2); // 封顶：12+3→14（实增 2·非 3）
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

  // ── 卡死回归（owner 报「两家出光后卡死」）──────────────────────────────────────
  it('不卡死：50 seed 整盘自动跑均收敛（步数远小于 cap）·turn 每步指向活跃座', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = new GuandanSession({ seed, tier: seed % 4 === 0 ? 'l4' : 'l2' });
      let guard = 0;
      while (s.phase === 'playing' && guard++ < 4000) {
        expect(turnIsActive(s), `seed ${seed} 第 ${guard} 步 turn=${s.turn} 指向出光座`).toBe(true);
        if (s.turn === 'hero') s.act('hero', s.hint('hero'));
        else s.aiStep();
      }
      expect(guard, `seed ${seed} 未收敛（疑卡死）`).toBeLessThan(4000);
      expect(['settled', 'run-won', 'run-lost']).toContain(s.phase);
    }
  });

  it('不卡死：持墩者出光后队友接风·剩两家不同队继续打到盘终', () => {
    const s = new GuandanSession({ seed: 5 });
    // 造：hero 领出对 3 出光（模拟持墩者出光），队友/对手继续
    s.turn = 'hero';
    s.currentTrick = null;
    s.hands.hero = [cardCode(0, 3), cardCode(1, 3)];
    s.hands.partner = [cardCode(0, 5), cardCode(1, 5), cardCode(0, 9)];
    s.hands.west = [cardCode(2, 6), cardCode(3, 6), cardCode(0, 10)];
    s.hands.east = [cardCode(2, 8), cardCode(3, 8), cardCode(0, 13)];
    s.act('hero', [cardCode(0, 3), cardCode(1, 3)]); // hero 出光（对 3）
    expect(s.hands.hero.length).toBe(0);
    // 继续跑到盘终·全程 turn 不指向 hero（已出光）
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 500) {
      expect(s.turn, '出光的 hero 不该再轮到').not.toBe('hero');
      expect(turnIsActive(s)).toBe(true);
      s.aiStep(); // 剩余全是 AI 座
    }
    expect(guard).toBeLessThan(500);
    expect(s.lastResult!.ranking[0]).toBe('hero'); // hero 头游（首个出光）
  });

  // ── 三同张可出（owner 报「点三张只能出一对」根因=选牌联动·sim 层判型正确）────────
  it('三同张 triple 领出合法·四张同点=炸弹（非三带一）', () => {
    const s = new GuandanSession({ seed: 3 });
    s.turn = 'hero';
    s.currentTrick = null;
    s.hands.hero = [cardCode(0, 9), cardCode(1, 9), cardCode(2, 9), cardCode(0, 4)];
    // 点三张 9 → triple（sim 接受）
    expect(s.legalCheck('hero', [cardCode(0, 9), cardCode(1, 9), cardCode(2, 9)]).match?.family).toBe('triple');
    // 四张 9 → bomb（非三带一·四张同点是炸弹）
    s.hands.hero = [cardCode(0, 9), cardCode(1, 9), cardCode(2, 9), cardCode(3, 9)];
    expect(s.legalCheck('hero', [cardCode(0, 9), cardCode(1, 9), cardCode(2, 9), cardCode(3, 9)]).match?.family).toBe('bomb');
  });

  // ── 领出真实性：hint 领出给组合牌型（防单张流退化·owner 2026-07-18 报「按规则模拟不真实」）──
  it('hint 领出=倾长组合牌型（非最小单张）·合法可出', () => {
    const s = new GuandanSession({ seed: 5 });
    s.turn = 'hero';
    s.currentTrick = null;
    // 一对 5 + 顺子 6-7-8-9-10 + 散单 K —— 领出应给顺子(最长)，绝非最小单张
    s.hands.hero = [
      cardCode(0, 5), cardCode(1, 5), cardCode(0, 6), cardCode(1, 7), cardCode(2, 8), cardCode(3, 9), cardCode(0, 10), cardCode(0, 13),
    ];
    const hint = s.hint('hero');
    expect(hint).not.toBeNull();
    expect(hint!.length).toBeGreaterThan(1); // 不是单张流
    const chk = s.legalCheck('hero', hint!);
    expect(chk.ok).toBe(true);
    expect(chk.match!.family).toBe('straight'); // 最长牌型=顺子
  });

  it('hint 领出不拆炸弹·不主动领炸（四张同点保留）', () => {
    const s = new GuandanSession({ seed: 5 });
    s.turn = 'hero';
    s.currentTrick = null;
    // 四张 6（炸）+ 散单 8/10/Q —— 领出只能给单张，且不动 4 张 6
    s.hands.hero = [cardCode(0, 6), cardCode(1, 6), cardCode(2, 6), cardCode(3, 6), cardCode(0, 8), cardCode(0, 10), cardCode(0, 12)];
    const hint = s.hint('hero')!;
    const chk = s.legalCheck('hero', hint);
    expect(chk.ok).toBe(true);
    expect(chk.match!.family).toBe('single');
    expect(hint.map(codeRank)).not.toContain(6); // 炸弹牌未被拆去凑牌型
  });

  // ── hint 往返（owner 报「提示给错牌·正确的牌打不出去」根因=idx 基准错位）──────────────
  // 宿主把 hint 牌码按**显示顺序**(理牌 family/rank)映射成下标高亮·出牌时再按同序取回；
  // 此不变量（映射与出牌同基准）保证 hint 高亮的牌点出去必合法。任一序错位即回归此 bug。
  it('hint 往返：理牌 family 序下 码→下标→码 一致且合法', () => {
    const s = new GuandanSession({ seed: 5 });
    s.turn = 'hero';
    s.currentTrick = null;
    s.hands.hero = [
      cardCode(0, 5), cardCode(1, 5), cardCode(0, 6), cardCode(1, 7), cardCode(2, 8), cardCode(3, 9), cardCode(0, 10), cardCode(0, 13),
    ];
    const hintCodes = s.hint('hero')!;
    // 复刻 game-a.ts play.hint 的宿主映射（显示序=sortHand family）
    const display = sortHand(s.hands.hero, 'family', s.playLevel);
    const selected: number[] = [];
    for (const code of hintCodes) {
      const i = display.findIndex((cc, k) => cc === code && !selected.includes(k));
      if (i >= 0) selected.push(i);
    }
    const committed = selected.map((i) => display[i]); // 出牌 selectedCodes：按同一显示序取回
    expect([...committed].sort((a, b) => a - b)).toEqual([...hintCodes].sort((a, b) => a - b));
    expect(s.legalCheck('hero', committed).ok).toBe(true); // hint 高亮的牌点出去必合法
  });

  it('整局领出不退化单张流：跨盘确有组合牌型领出', () => {
    const combos = new Set<string>();
    for (let seed = 40; seed < 50; seed++) {
      const s = new GuandanSession({ seed, tier: 'l2' });
      autoRun(s);
      for (const e of s.playLog) if (e.action === 'lead' && e.family && e.family !== 'single') combos.add(e.family);
    }
    expect(combos.size).toBeGreaterThan(0); // 见到对/三/顺/连对… 至少一种（非纯单张）
  });

  // ── AI 黑板接线回归（owner 报「AI 全程最小单张」·根因=蓝图缺 bb-* → BT 恒落 move:min）───────
  it('AI 座领出走策略树倾长牌型（黑板接线·非纯单张）', () => {
    const combos = new Set<string>();
    for (let seed = 20260717; seed < 20260723; seed++) {
      const s = new GuandanSession({ seed, tier: 'l3' });
      let g = 0;
      while (s.phase === 'playing' && g++ < 4000) {
        if (s.turn === 'hero') s.act('hero', s.hint('hero'));
        else s.aiStep();
      }
      // 只看非 hero（AI）座的领出——BT 死时这里恒为 single
      for (const e of s.playLog) if (e.action === 'lead' && e.seat !== 'hero' && e.family && e.family !== 'single') combos.add(e.family);
    }
    expect(combos.size).toBeGreaterThan(0);
  });

  // ── 引擎判读歧义兜底（A-008·逢人配令一手牌可多家族判读·matchPattern 取最强可能跨家族压不过）──────
  it('应对滤掉「规范判读压不过」的歧义牌：提示/合法应对必被 act 收', () => {
    const s = new GuandanSession({ seed: 5 });
    s.playLevel = 5;
    s.cfg = guandanConfig(5); // 打 5 → ♥5=逢人配
    s.turn = 'hero';
    // 当前墩=钢板 JJJ-QQQ
    s.currentTrick = mkTrick('east', [cardCode(0, 11), cardCode(2, 11), cardCode(3, 11), cardCode(0, 12), cardCode(2, 12), cardCode(3, 12)], 5);
    // hero 手：QQ+KK+两逢人配（意图钢板 QQQ-KKK，但 matchPattern 判成三连对 Q-K-A 压不过钢板）+ 真炸四张 3
    s.hands.hero = [
      cardCode(1, 12), cardCode(1, 12), cardCode(2, 13), cardCode(3, 13), cardCode(1, 5), cardCode(1, 5),
      cardCode(0, 3), cardCode(1, 3), cardCode(2, 3), cardCode(3, 3),
    ];
    const hint = s.hint('hero');
    expect(hint).not.toBeNull();
    const chk = s.legalCheck('hero', hint!); // 提示的牌点出去必被 act 收（不再给打不出去的牌）
    expect(chk.ok).toBe(true);
    expect(chk.match!.family).toBe('bomb'); // 真炸=唯一合法压钢板的解（歧义钢板已滤）
  });

  // ── 座前小牌桌 seatPlay（owner 2026-07-18·像真扑克·本墩各座最近一手·收墩清）───────────
  it('seatPlay：记本墩各座最近一手（出=牌+型/过=pass）·新墩领出清空', () => {
    const s = new GuandanSession({ seed: 5 });
    s.turn = 'hero';
    s.currentTrick = null;
    s.hands.hero = [cardCode(0, 6), cardCode(1, 6), cardCode(0, 3)];
    s.hands.west = [cardCode(2, 9), cardCode(3, 9), cardCode(0, 2)];
    s.hands.partner = [cardCode(0, 5)];
    s.hands.east = [cardCode(1, 8)];
    s.seatPlay = {};
    s.act('hero', [cardCode(0, 6), cardCode(1, 6)]); // 领出对 6
    expect(s.seatPlay.hero).toMatchObject({ cards: [cardCode(0, 6), cardCode(1, 6)], pass: false });
    s.act('west', [cardCode(2, 9), cardCode(3, 9)]); // 对 9 压过
    expect(s.seatPlay.west).toMatchObject({ pass: false });
    expect(s.seatPlay.hero).toBeDefined(); // hero 的仍在（本墩内累积）
    s.act('partner', null); // 过
    expect(s.seatPlay.partner).toMatchObject({ pass: true, cards: [] });
    // 新墩领出清上墩各座牌（造收墩后局面：currentTrick=null + 旧 seatPlay·west 领出）
    s.currentTrick = null;
    s.turn = 'west';
    s.seatPlay = { hero: { cards: [cardCode(0, 6)], family: 'single', pass: false }, east: { cards: [], family: null, pass: true } };
    s.hands.west = [cardCode(0, 4)];
    s.act('west', [cardCode(0, 4)]); // west 领出新墩
    expect(s.seatPlay.hero).toBeUndefined(); // 上墩已清
    expect(s.seatPlay.east).toBeUndefined();
    expect(s.seatPlay.west).toMatchObject({ cards: [cardCode(0, 4)], pass: false });
  });

  // ── 出牌日志（owner 诊断·每手一条·family/tier 正确）──────────────────────────────
  it('playLog：每手出牌/过各记一条·family/tier 与判型一致·压过记录旧墩', () => {
    const s = new GuandanSession({ seed: 5 });
    s.turn = 'hero';
    s.currentTrick = null;
    s.hands.hero = [cardCode(0, 6), cardCode(1, 6)];
    s.hands.west = [cardCode(2, 9), cardCode(3, 9), cardCode(0, 2)];
    s.playLog = [];
    s.act('hero', [cardCode(0, 6), cardCode(1, 6)]); // 领出对 6
    s.act('west', [cardCode(2, 9), cardCode(3, 9)]); // 对 9 压过对 6
    const lead = s.playLog[0];
    expect(lead).toMatchObject({ seat: 'hero', action: 'lead', family: 'pair', tier: 0, beatWhat: null });
    const follow = s.playLog[1];
    expect(follow).toMatchObject({ seat: 'west', action: 'follow', family: 'pair', tier: 0 });
    expect(follow.beatWhat).toContain('对子'); // 压过的旧墩描述
  });
});

// 强制一个名次直接结算（测过 A/停 A 三态·跳过行牌）。
function forceRanking(s: GuandanSession, ranking: SeatId[]): void {
  const anyS = s as unknown as { settleRound: (r: SeatId[]) => void };
  anyS.settleRound(ranking);
}
