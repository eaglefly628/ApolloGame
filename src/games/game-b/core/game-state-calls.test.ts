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
  canAnkan,
  ankanKinds,
  declareAnkan,
  canKakan,
  declareKakan,
  declareTsumo,
  canTsumo,
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

describe('鸣牌 P3b · 杠（暗杠/大明杠/加杠 + 岭上/新宝牌 + 抢杠）', () => {
  it('暗杠：手中 4 张同种 → 组暗杠·即翻新宝牌·岭上摸·守恒', () => {
    const m = controlled();
    m.cur.hands[0] = [M(5), M(5), M(5), P(1), P(2), P(3), P(4), S(7), S(8), S(9), TON, TON, HAKU];
    m.cur.turn = 0;
    m.cur.drawn = M(5); // 摸到第 4 张 5m
    expect(canAnkan(m)).toBe(true);
    expect(ankanKinds(m)).toEqual([M(5)]);
    const doraBefore = m.cur.doraInd.length;
    declareAnkan(m, M(5));
    expect(m.cur.melds[0]!.length).toBe(1);
    expect(m.cur.melds[0]![0]!.kind).toBe('ankan');
    expect(m.cur.melds[0]![0]!.tiles.length).toBe(4);
    expect(m.cur.doraInd.length).toBe(doraBefore + 1); // 暗杠即翻新宝牌（R-3）
    expect(m.cur.kanCount).toBe(1);
    expect(m.cur.drawn).not.toBe(null); // 岭上摸
    expect(m.cur.drawnRinshan).toBe(true);
    expect(m.cur.dead.length).toBe(14); // 王牌恒 14（活山尾补）
    expect(totalTiles(m)).toBe(136);
  });

  it('大明杠：暗手 3 张 + 他家弃牌 → 玩家 minkan 选项→岭上摸·守恒', () => {
    const m = controlled();
    m.cur.hands[0] = [PEI, PEI, PEI, P(1), P(4), P(7), S(1), S(4), S(7), TON, SHAA, HAKU, M(1)]; // 三张北
    m.cur.turn = 1;
    m.cur.drawn = PEI; // 座 1 打第 4 张北
    discard(m, PEI);
    expect(isPlayerCallWindow(m)).toBe(true);
    expect(m.cur.callWindow!.options.minkan).toBe(true);
    const doraBefore = m.cur.doraInd.length;
    playerCall(m, { type: 'minkan' });
    expect(m.cur.melds[0]![0]!.kind).toBe('minkan');
    expect(m.cur.melds[0]![0]!.tiles.length).toBe(4);
    expect(m.cur.turn).toBe(0);
    expect(m.cur.drawn).not.toBe(null); // 岭上摸 → 待打
    expect(m.cur.doraInd.length).toBe(doraBefore + 1);
    expect(m.cur.dead.length).toBe(14);
    expect(totalTiles(m)).toBe(136);
  });

  it('加杠：已碰某种 + 摸/手中第 4 张 → 升杠·岭上·守恒（无人抢）', () => {
    const m = controlled();
    m.cur.melds[0] = [{ kind: 'pon', tiles: [HATSU, HATSU, HATSU], from: 2, called: HATSU }];
    m.cur.hands[0] = [HATSU, P(1), P(4), P(6), S(1), S(3), S(5), S(7), M(9), M(2)]; // 10 张·含第 4 张發
    m.cur.turn = 0;
    m.cur.drawn = M(1);
    expect(canKakan(m)).toBe(true);
    const doraBefore = m.cur.doraInd.length;
    declareKakan(m, HATSU);
    expect(m.cur.melds[0]![0]!.kind).toBe('kakan');
    expect(m.cur.melds[0]![0]!.tiles.length).toBe(4);
    expect(m.cur.doraInd.length).toBe(doraBefore + 1);
    expect(m.cur.drawn).not.toBe(null); // 岭上摸
    expect(totalTiles(m)).toBe(136);
  });

  it('抢杠：加杠牌正是他家听牌 → 该家荣·加杠不成立·加杠家放铳', () => {
    const m = controlled();
    m.cur.melds[0] = [{ kind: 'pon', tiles: [CHUN, CHUN, CHUN], from: 2, called: CHUN }];
    m.cur.hands[0] = [CHUN, P(1), P(4), P(6), S(1), S(3), S(5), S(7), M(9), M(2)]; // 玩家持第 4 张中·欲加杠
    m.cur.hands[2] = [M(1), M(2), M(3), P(4), P(5), P(6), S(7), S(8), S(9), TON, TON, CHUN, CHUN]; // 座 2 听中（+東東雀头）
    m.cur.turn = 0;
    m.cur.drawn = M(1);
    declareKakan(m, CHUN);
    expect(m.cur.phase).toBe('win');
    expect(m.cur.result!.type).toBe('ron');
    expect(m.cur.result!.winner).toBe(2); // 座 2 抢杠荣
    expect(m.cur.result!.loser).toBe(0); // 加杠家放铳
    expect(totalTiles(m)).toBe(136);
  });

  it('立直后禁杠（v1·不变听暗杠=债）：riichi 家 canAnkan=false', () => {
    const m = controlled();
    m.cur.hands[0] = [M(5), M(5), M(5), P(1), P(2), P(3), P(4), S(7), S(8), S(9), TON, TON, HAKU];
    m.cur.turn = 0;
    m.cur.drawn = M(5);
    m.cur.riichi[0] = true;
    expect(canAnkan(m)).toBe(false);
  });

  it('交互 walkthrough 出现杠（统计·证明 AI/流程真的杠）', () => {
    let sawKan = false;
    for (const seed of [7, 19, 88, 123, 2024, 555, 909, 4321, 100]) {
      const m = startMatch(seed);
      m.interactiveCalls = true;
      let guard = 0;
      while (!m.over && guard++ < 120 && !sawKan) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 900) {
          aiTurn(m);
          if (m.cur.melds.some((ms) => ms.some((md) => md.kind === 'ankan' || md.kind === 'minkan' || md.kind === 'kakan'))) { sawKan = true; break; }
          if (m.cur.kanCount > 0) { sawKan = true; break; }
        }
        if (!sawKan) nextRound(m);
      }
      if (sawKan) break;
    }
    expect(sawKan).toBe(true); // 至少一局有杠
  });
});

describe('GD-B 复审修红（D2 1番縛り / D7 海底禁杠 / D5b 槍槓役）', () => {
  // 无役闭手听牌：111m 999m 345p 678p + 5s 单骑（幺九刻杀断幺·刻子杀平和·无役牌·未立直）→ 荣 5s = 无役。
  const NO_YAKU_13 = [M(1), M(1), M(1), M(9), M(9), M(9), P(3), P(4), P(5), P(6), P(7), P(8), S(5)];

  it('D2 · 无役闭手荣和被拒（1番縛り）；给个役（立直）则同张可荣', () => {
    // 非交互（默认·荣自动结算）建局。
    const m = startMatch(1);
    Object.assign(m.cur, {
      hands: [NO_YAKU_13.slice(), JUNK_B.slice(), JUNK_B.slice(), JUNK_B.slice()],
      melds: [[], [], [], []], rivers: [[], [], [], []], riichi: [false, false, false, false],
      drawn: S(5), turn: 1, phase: 'playing', awaitDiscard: false, forbiddenDiscard: [], callWindow: null,
    });
    discard(m, S(5)); // 座1 打 5s（主角能荣其「形」但无役）
    expect(m.cur.phase).not.toBe('win'); // 无役 → 荣被拒（1番縛り）

    const m2 = startMatch(1);
    Object.assign(m2.cur, {
      hands: [NO_YAKU_13.slice(), JUNK_B.slice(), JUNK_B.slice(), JUNK_B.slice()],
      melds: [[], [], [], []], rivers: [[], [], [], []], riichi: [true, false, false, false], // 立直=役
      drawn: S(5), turn: 1, phase: 'playing', awaitDiscard: false, forbiddenDiscard: [], callWindow: null,
    });
    discard(m2, S(5));
    expect(m2.cur.phase).toBe('win'); // 有役（立直）→ 荣成立
    expect(m2.cur.result!.winner).toBe(0);
    expect(m2.cur.result!.yakuLabel).toContain('立直');
  });

  it('D7 · 海底禁杠：活山空时 canAnkan/canKakan=false（防王牌跌13）', () => {
    const m = controlled();
    m.cur.hands[0] = [M(5), M(5), M(5), P(1), P(2), P(3), P(4), S(7), S(8), S(9), TON, TON, HAKU];
    m.cur.turn = 0;
    m.cur.drawn = M(5);
    expect(canAnkan(m)).toBe(true); // 有活山时可杠
    m.cur.wall = []; // 活山空（海底）
    expect(canAnkan(m)).toBe(false); // 海底禁杠
  });

  it('D5b · 抢杠和了带槍槓役（闭手抢和家真算分含槍槓）', () => {
    const m = controlled();
    m.cur.melds[0] = [{ kind: 'pon', tiles: [CHUN, CHUN, CHUN], from: 2, called: CHUN }];
    m.cur.hands[0] = [CHUN, P(1), P(4), P(6), S(1), S(3), S(5), S(7), M(9), M(2)];
    // 座 2 闭手听中（123m 456p 789s 東東 + 中）·荣中带 槍槓。
    m.cur.hands[2] = [M(1), M(2), M(3), P(4), P(5), P(6), S(7), S(8), S(9), TON, TON, CHUN, CHUN];
    m.cur.melds[2] = [];
    m.cur.turn = 0;
    m.cur.drawn = M(1);
    declareKakan(m, CHUN);
    expect(m.cur.result!.type).toBe('ron');
    expect(m.cur.result!.winner).toBe(2);
    expect(m.cur.result!.yakuLabel).toContain('槍槓'); // 抢杠役接线（D5b）
  });
});

describe('P6a/G1 · 真役符接线（门清 + 开手 calledMelds 走 scoreWin 引擎）', () => {
  it('闭手自摸：结算走真引擎（yakuLabel/scoreLabel 落位·非占位·守恒）', () => {
    const m = controlled();
    // 门清全顺 + 東東雀头（庄=座0·東=连风）·摸 東 单骑自摸 → 至少「門前清自摸和」。
    m.cur.hands[0] = [M(2), M(3), M(4), P(3), P(4), P(5), S(4), S(5), S(6), S(7), S(8), S(9), TON];
    m.cur.melds[0] = []; // 闭手
    m.cur.turn = 0;
    m.cur.drawn = TON; // 東東 雀头单骑自摸
    expect(canTsumo(m)).toBe(true);
    declareTsumo(m);
    const r = m.cur.result!;
    expect(r.type).toBe('tsumo');
    expect(r.winner).toBe(0);
    expect(r.yakuLabel).toBeTruthy(); // 真役种明细（占位=undefined）
    expect(r.scoreLabel).not.toContain('占位'); // 真档位标签
    expect(r.delta.reduce((a, b) => a + b, 0)).toBe(0); // 守恒
    expect(r.delta[0]!).toBeGreaterThan(0); // 和了家收点
  });

  it('⑦ 开手有役自摸（碰役牌 中）：走真算分·非占位·delta Σ=0 守恒·和者收点（G1）', () => {
    const m = controlled();
    m.cur.melds[0] = [{ kind: 'pon', tiles: [CHUN, CHUN, CHUN], from: 2, called: CHUN }]; // 碰中（役牌）
    // 暗手 10 张 + 摸 → 3 面子 + 雀头（配合副露=4 面子+雀头）。
    m.cur.hands[0] = [M(2), M(3), M(4), P(3), P(4), P(5), S(7), S(8), S(9), TON];
    m.cur.turn = 0;
    m.cur.drawn = TON; // 東東 雀头单骑
    expect(canTsumo(m)).toBe(true);
    declareTsumo(m);
    const r = m.cur.result!;
    expect(r.type).toBe('tsumo');
    expect(r.scoreLabel).not.toContain('占位'); // 开手真算分（非占位·G1 落地）
    expect(r.yakuLabel).toContain('役牌 中'); // 碰的中=役牌 1 番
    expect(r.delta.reduce((a, b) => a + b, 0)).toBe(0); // Σ=0 守恒
    expect(r.delta[0]!).toBeGreaterThan(0); // 和者收点
  });

  it('开手无役自摸（碰客风北·含幺九顺）：scoreWin 无役 → 占位兜底·仍守恒', () => {
    const m = controlled(); // 座0=庄=東·北=客风（非役牌）
    m.cur.melds[0] = [{ kind: 'pon', tiles: [PEI, PEI, PEI], from: 2, called: PEI }]; // 碰北（客风·无役牌）
    m.cur.hands[0] = [M(1), M(2), M(3), P(4), P(5), P(6), S(6), S(7), M(9), M(9)]; // 10 张
    m.cur.turn = 0;
    m.cur.drawn = S(8); // 补 678s（无役：含 1m/9m 幺九→非断幺·北客风→无役牌·456p/678s 中张→非混全）
    expect(canTsumo(m)).toBe(true);
    declareTsumo(m);
    const r = m.cur.result!;
    expect(r.type).toBe('tsumo');
    expect(r.scoreLabel).toContain('占位'); // 无役 → 占位兜底（守恒优先）
    expect(r.delta.reduce((a, b) => a + b, 0)).toBe(0); // Σ=0 守恒
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
