// Game B ·《雀宴》鸣牌流程接线测试（naki-design P3a·碰/吃 + call window + 优先级 + 门清不回退）。
// 直接构造受控局面（覆盖既有随机 walkthrough 难触发的鸣牌分支）+ 全局守恒/手数不变式。
import { describe, it, expect } from 'vitest';
import {
  startMatch,
  discard,
  playerCall,
  playerPass,
  aiTurn,
  nextRound,
  isPlayerCallWindow,
  type MatchState,
} from './game-state.js';

// 牌种速记。
const M = (n: number): number => n - 1;
const P = (n: number): number => 9 + (n - 1);
const S = (n: number): number => 18 + (n - 1);
const TON = 27, NAN = 28, SHAA = 29, PEI = 30, HAKU = 31, HATSU = 32, CHUN = 33;

// 安全「杂牌 13」：全孤张（间隔≥3 / 字牌）——绝不听牌·防建局面时误荣。
const JUNK_A = [M(1), M(4), M(7), P(1), P(4), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, CHUN];
const JUNK_B = [M(2), M(5), M(9), P(2), P(6), S(3), S(8), NAN, PEI, HATSU, P(9), S(1), M(7)];

/** 建一个开了鸣牌闸的受控空局面（各家杂牌·可覆写）。 */
function controlled(seed = 1): MatchState {
  const m = startMatch(seed);
  m.interactiveCalls = true;
  const rs = m.cur;
  rs.hands = [JUNK_A.slice(), JUNK_A.slice(), JUNK_A.slice(), JUNK_A.slice()];
  rs.melds = [[], [], [], []];
  rs.rivers = [[], [], [], []];
  rs.riichi = [false, false, false, false];
  rs.drawn = null;
  rs.awaitDiscard = false;
  rs.forbiddenDiscard = [];
  rs.callWindow = null;
  rs.lastDiscard = null;
  rs.phase = 'playing';
  return m;
}

/** 全局牌数守恒（P3a 无杠·王牌恒 14）：手 + 河 + 副露 + 摸 + 山 + 王 = 136。 */
function totalTiles(m: MatchState): number {
  const rs = m.cur;
  let t = rs.wall.length + rs.dead.length + (rs.drawn !== null ? 1 : 0);
  for (let s = 0; s < 4; s++) {
    t += rs.hands[s]!.length + rs.rivers[s]!.length;
    t += rs.melds[s]!.reduce((a, meld) => a + meld.tiles.length, 0);
  }
  return t;
}

describe('鸣牌 P3a · 碰（pon）', () => {
  it('玩家碰 AI 弃牌：窗口→playerCall→副露成·跳玩家·待打', () => {
    const m = controlled();
    m.cur.hands[0] = [M(3), M(3), P(1), P(4), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, CHUN, NAN]; // 玩家有两张 3m
    m.cur.turn = 1;
    m.cur.drawn = M(3); // 座 1 打 3m
    discard(m, M(3));
    expect(isPlayerCallWindow(m)).toBe(true);
    expect(m.cur.callWindow!.options.pon).toBe(true);
    playerCall(m, { type: 'pon' });
    expect(m.cur.melds[0]!.length).toBe(1);
    expect(m.cur.melds[0]![0]!.kind).toBe('pon');
    expect(m.cur.melds[0]![0]!.tiles).toEqual([M(3), M(3), M(3)]);
    expect(m.cur.turn).toBe(0); // actor 跳玩家
    expect(m.cur.awaitDiscard).toBe(true); // 无摸·须打
    expect(m.cur.hands[0]!.filter((t) => t === M(3)).length).toBe(0); // 两张 3m 已入副露
    expect(m.cur.rivers[1]!).not.toContain(M(3)); // 被鸣牌离河
    expect(totalTiles(m)).toBe(136);
  });

  it('玩家过（不碰）：AI 无鸣→下家摸·无副露', () => {
    const m = controlled();
    m.cur.hands[0] = [M(3), M(3), P(1), P(4), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, CHUN, NAN];
    m.cur.turn = 1;
    m.cur.drawn = M(3);
    discard(m, M(3));
    expect(isPlayerCallWindow(m)).toBe(true);
    playerPass(m);
    expect(m.cur.melds[0]!.length).toBe(0); // 未碰
    expect(m.cur.callWindow).toBe(null);
    expect(m.cur.turn).toBe(2); // 下家（座 1 的下家）摸
    expect(m.cur.drawn).not.toBe(null);
    expect(totalTiles(m)).toBe(136);
  });

  it('AI 碰役牌（玩家为弃牌者·无玩家窗口）：座 2 碰中', () => {
    const m = controlled();
    m.cur.hands[2] = [CHUN, CHUN, P(1), P(4), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, NAN, M(1)]; // 座 2 有两张中（役牌）
    m.cur.turn = 0;
    m.cur.drawn = CHUN; // 玩家打中
    discard(m, CHUN);
    expect(isPlayerCallWindow(m)).toBe(false); // 玩家是弃牌者·无窗口
    expect(m.cur.melds[2]!.length).toBe(1);
    expect(m.cur.melds[2]![0]!.kind).toBe('pon');
    expect(m.cur.turn).toBe(2); // 跳座 2
    expect(m.cur.awaitDiscard).toBe(true);
    expect(totalTiles(m)).toBe(136);
  });

  it('AI 不碰客风（非役牌）：座 2 有两张西（客风）但不碰', () => {
    const m = controlled();
    // 座 2 = 南家（dealer=0·座2 座风=西）→ 西是自风=役牌？座2 seatWind=(2-0)%4=2=西 → 西对座2 是自风役牌！改用北客风。
    m.cur.hands[2] = [PEI, PEI, P(1), P(4), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, NAN, M(1)]; // 北：座2 客风·非场风
    m.cur.turn = 0;
    m.cur.drawn = PEI;
    discard(m, PEI);
    expect(m.cur.melds[2]!.length).toBe(0); // 客风不碰
    expect(m.cur.turn).toBe(1); // 下家摸（无人鸣）
    expect(totalTiles(m)).toBe(136);
  });
});

describe('鸣牌 P3a · 吃（chi·仅下家）', () => {
  it('玩家吃上家：窗口给搭子候选→playerCall(chi)→顺子副露', () => {
    const m = controlled();
    m.cur.hands[0] = [M(2), M(4), P(1), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, CHUN, NAN, PEI]; // 玩家有 2m4m
    m.cur.turn = 3; // 上家（座 3）→ 玩家(0) 是其下家
    m.cur.drawn = M(3);
    discard(m, M(3));
    expect(isPlayerCallWindow(m)).toBe(true);
    expect(m.cur.callWindow!.options.chi.length).toBe(1);
    const cand = m.cur.callWindow!.options.chi[0]!;
    playerCall(m, { type: 'chi', chi: cand });
    expect(m.cur.melds[0]!.length).toBe(1);
    expect(m.cur.melds[0]![0]!.kind).toBe('chi');
    expect(m.cur.melds[0]![0]!.tiles).toEqual([M(2), M(3), M(4)]);
    expect(m.cur.turn).toBe(0);
    expect(m.cur.awaitDiscard).toBe(true);
    // 喰い替え禁：嵌张吃 → 仅禁現物 3m
    expect(m.cur.forbiddenDiscard).toEqual([M(3)]);
    expect(totalTiles(m)).toBe(136);
  });

  it('非下家不能吃：玩家有搭子但弃牌者非上家 → 无吃选项', () => {
    const m = controlled();
    m.cur.hands[0] = [M(2), M(4), P(1), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, CHUN, NAN, PEI];
    m.cur.turn = 1; // 座 1 打 → 玩家不是其下家（下家是座 2）
    m.cur.drawn = M(3);
    discard(m, M(3));
    expect(m.cur.callWindow).toBe(null); // 无碰无吃无荣 → 不设窗口
    expect(m.cur.turn).toBe(2);
    expect(totalTiles(m)).toBe(136);
  });

  it('両面吃禁筋：4m5m 吃 3m → forbiddenDiscard = {3m,6m}', () => {
    const m = controlled();
    m.cur.hands[0] = [M(4), M(5), P(1), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, CHUN, NAN, PEI];
    m.cur.turn = 3;
    m.cur.drawn = M(3);
    discard(m, M(3));
    const cand = m.cur.callWindow!.options.chi.find((c) => c.consume[0] === M(4))!;
    playerCall(m, { type: 'chi', chi: cand });
    expect(m.cur.forbiddenDiscard.sort((a, b) => a - b)).toEqual([M(3), M(6)]);
    // 打出禁牌被忽略（喰い替え）
    const before = m.cur.rivers[0]!.length;
    discard(m, M(6)); // 6m 被禁 → 无效
    expect(m.cur.rivers[0]!.length).toBe(before);
    // 打合法牌成功
    discard(m, TON);
    expect(m.cur.rivers[0]!).toContain(TON);
    expect(m.cur.forbiddenDiscard).toEqual([]); // 打后清
  });
});

describe('鸣牌 P3a · 优先级', () => {
  it('荣压碰：座 2 可荣 + 玩家可碰同张 → 荣结算（无副露）', () => {
    const m = controlled();
    // 座 2 听 3m 单骑：手 = 4 面子 + 单张 3m 待对（用简单形）。构造 13 张听 3m。
    // 面子：123m 456p 789s 白白白 + 3m 单骑 → 13 张听 3m（单骑）。
    m.cur.hands[2] = [M(1), M(2), M(3), P(4), P(5), P(6), S(7), S(8), S(9), HAKU, HAKU, HAKU, M(3)];
    m.cur.hands[0] = [M(3), M(3), P(1), P(7), S(1), S(4), TON, SHAA, CHUN, NAN, PEI, M(9), P(9)]; // 玩家两张 3m 可碰
    m.cur.turn = 1;
    m.cur.drawn = M(3); // 座 1 打 3m
    discard(m, M(3));
    // 座 2 能荣（3m 和了）→ 即使玩家在窗口选碰，荣也压碰。
    if (isPlayerCallWindow(m)) playerCall(m, { type: 'pon' });
    expect(m.cur.phase).toBe('win');
    expect(m.cur.result!.type).toBe('ron');
    expect(m.cur.result!.winner).toBe(2);
    expect(m.cur.melds[0]!.length).toBe(0); // 碰未成（荣压）
  });
});

describe('鸣牌 P3a · 门清不回退 + 交互 walkthrough', () => {
  it('非交互（默认）：整场无任何副露（门清路径逐字节等价的哨兵）', () => {
    for (const seed of [11, 22, 33]) {
      const m = startMatch(seed); // interactiveCalls 默认 false
      let guard = 0;
      while (!m.over && guard++ < 80) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 500) aiTurn(m);
        expect(m.cur.melds.every((ms) => ms.length === 0)).toBe(true); // 门清恒无副露
        nextRound(m);
      }
      expect(m.over).toBe(true);
    }
  });

  it('交互 AI-vs-AI：多 seed 打穿·恒守恒 136·点数守恒·手数不变式', () => {
    for (const seed of [7, 19, 88, 123, 2024]) {
      const m = startMatch(seed);
      m.interactiveCalls = true; // AI 之间会碰役牌
      let guard = 0;
      while (!m.over && guard++ < 100) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 800) {
          aiTurn(m);
          expect(totalTiles(m)).toBe(136); // 每步守恒
        }
        // 点数守恒（每局 delta Σ=0·脱衣不动点）
        if (m.cur.result) expect(m.cur.result.delta.reduce((a, b) => a + b, 0)).toBe(0);
        nextRound(m);
      }
      expect(m.over).toBe(true);
      expect(m.scores.reduce((a, b) => a + b, 0)).toBe(200000); // 4×50000 恒定（无供托残留时）
    }
  });

  it('玩家总「过」：交互整场能打穿（模拟 owner 每次点过·不卡死）', () => {
    for (const seed of [7, 19, 88, 123]) {
      const m = startMatch(seed);
      m.interactiveCalls = true;
      let guard = 0;
      while (!m.over && guard++ < 100) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 900) {
          if (m.cur.callWindow) playerPass(m); // 玩家（seat 0）永远「过」——callWindow 只对玩家设
          else aiTurn(m); // 推进当前 seat（含玩家打牌·AI 启发代打）
          expect(totalTiles(m)).toBe(136);
        }
        nextRound(m);
      }
      expect(m.over).toBe(true);
      // 玩家永远过 → 玩家 seat 0 恒无副露
      // （注：本 walkthrough seat 0 打牌用 AI 启发·仅验「过」路径全程不卡·守恒）
    }
  });

  it('交互模式确实产生副露（统计·证明鸣牌真的发生）', () => {
    let sawMeld = false;
    for (const seed of [7, 19, 88, 123, 2024, 555, 909]) {
      const m = startMatch(seed);
      m.interactiveCalls = true;
      let guard = 0;
      while (!m.over && guard++ < 100 && !sawMeld) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 800) {
          aiTurn(m);
          if (m.cur.melds.some((ms) => ms.length > 0)) { sawMeld = true; break; }
        }
        if (!sawMeld) nextRound(m);
      }
      if (sawMeld) break;
    }
    expect(sawMeld).toBe(true); // 至少一局有 AI 碰役牌
  });
});
