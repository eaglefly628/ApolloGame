// Game B ·《雀宴》局状态机 walkthrough —— headless 全 AI 跑通完整一场（S4「逻辑跑起来」证据）。
// 证：一局能终（自摸/荣和/流局）·一场能打穿（东1→终局·不死循环）·点数守恒·同 seed 复现。
import { describe, it, expect } from 'vitest';
import {
  startMatch, aiTurn, nextRound, canTsumo, declareTsumo, discard,
  isWinLikeEnd, isFuriten, canRiichi, declareRiichi, playerCall, playerPass, STRIP_ITEMS, type MatchState,
} from './game-state.js';
import { isWinningHand, tenpai } from './hand-eval.js';

// 单局跑到终（全 AI·含玩家席也 AI 驱动·防死循环 guard）。
function playRound(m: MatchState): void {
  let guard = 0;
  while (m.cur.phase === 'playing' && guard++ < 400) aiTurn(m);
  expect(guard).toBeLessThan(400); // 未触 guard = 正常终局
}

// 一整场（东风战·连庄进局·防死循环 guard）。
function playMatch(seed: number): MatchState {
  const m = startMatch(seed);
  let guard = 0;
  while (!m.over && guard++ < 60) {
    playRound(m);
    nextRound(m);
  }
  expect(m.over).toBe(true);
  return m;
}

describe('game-b 局状态机 · 完整一场 walkthrough', () => {
  it('一场打穿·正常终局·点数守恒（Σ=200000）', () => {
    const m = playMatch(20260717);
    expect(m.over).toBe(true);
    expect(m.scores.reduce((a, b) => a + b, 0)).toBe(200000); // 简版无立直棒·delta 守恒
    expect(m.log.size()).toBeGreaterThan(20);
    expect(m.roundNo).toBeGreaterThanOrEqual(1);
  });

  it('单局必终于 win/draw·result 自洽', () => {
    const m = startMatch(7);
    playRound(m);
    expect(['win', 'draw']).toContain(m.cur.phase);
    const r = m.cur.result!;
    expect(r).toBeTruthy();
    expect(r.delta.reduce((a, b) => a + b, 0)).toBe(0); // 局内点移守恒
    if (r.type !== 'draw') {
      expect(r.winner).not.toBeNull();
      expect(isWinningHand(r.handSnapshot!)).toBe(true); // 和了手确是和了形
      if (r.type === 'ron') expect(r.loser).not.toBeNull();
    } else {
      expect(r.tenpaiFlags).toHaveLength(4);
    }
  });

  it('确定性：同 seed 逐局 [ranking, scores, clothing] 拼接串逐字节相同·异 seed 不同（对齐 game-a 口径）', () => {
    // 升格（测试加固 2026-08-24）：原只比终局 scores——中途分歧再收敛也能绿。改为每局终记
    // [名次, 四家点数, 四家衣物] 拼接成串，双跑逐字节比对（任何一局任何一路分歧即红）。
    const trace = (seed: number): string => {
      const m = startMatch(seed);
      const lines: string[] = [];
      let guard = 0;
      while (!m.over && guard++ < 60) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 400) aiTurn(m);
        const ranking = [0, 1, 2, 3].sort((a, b) => m.scores[b]! - m.scores[a]! || a - b);
        lines.push(JSON.stringify([ranking, m.scores, m.clothing]));
        nextRound(m);
      }
      expect(m.over).toBe(true);
      return lines.join('|');
    };
    expect(trace(999)).toBe(trace(999));
    expect(trace(999)).not.toBe(trace(31415)); // 不同 seed 不同牌局
  });

  it('多场随机 seed 全部能打穿·无死循环·恒守恒', () => {
    for (const seed of [1, 2, 42, 100, 2024, 88888]) {
      const m = playMatch(seed);
      expect(m.over).toBe(true);
      expect(m.scores.reduce((a, b) => a + b, 0)).toBe(200000);
    }
  });

  it('自摸通路：canTsumo→declareTsumo 结算为 win（构造和了摸牌）', () => {
    // 找一个自摸出现的 seed（全 AI 跑·统计到至少一次 tsumo 结算通路走过）
    let sawTsumo = false;
    let sawRon = false;
    let sawDraw = false;
    for (let s = 0; s < 40 && !(sawTsumo && sawDraw); s++) {
      const m = startMatch(s * 137 + 1);
      let g = 0;
      while (!m.over && g++ < 60) {
        let sg = 0;
        while (m.cur.phase === 'playing' && sg++ < 400) aiTurn(m);
        const t = m.cur.result?.type;
        if (t === 'tsumo') sawTsumo = true;
        if (t === 'ron') sawRon = true;
        if (t === 'draw') sawDraw = true;
        nextRound(m);
      }
    }
    // 拆开或断言（测试加固 2026-08-24）：确定性 seed 扫描下三种终局各自必然出现（实跑确认：
    // seed=s*137+1, s∈[0,40) 下 sawTsumo/sawRon/sawDraw 全 true）——「‖」会让自摸通路悄悄失守仍绿。
    expect(sawTsumo).toBe(true); // 自摸结算通路确实走过
    expect(sawRon).toBe(true); // 荣和结算通路确实走过
    expect(sawDraw).toBe(true); // 也出现过流局
  });

  it('玩家打牌通路：isWinLikeEnd + discard 合法牌推进', () => {
    const m = startMatch(555);
    // 玩家席（seat0=庄·首家）有 drawn·打出摸到的牌（摸切）应合法推进到下家
    expect(m.cur.turn).toBe(0);
    expect(m.cur.drawn).not.toBeNull();
    const drawn = m.cur.drawn!;
    if (!canTsumo(m)) {
      discard(m, drawn);
      // 打出后：要么他家荣和终局、要么轮转（turn 前进且有人摸牌）
      expect(m.cur.rivers[0]).toContain(drawn);
      expect(m.cur.phase === 'win' || m.cur.turn !== 0 || m.cur.phase === 'draw').toBe(true);
    }
    expect(isWinLikeEnd(m) || m.cur.phase === 'playing').toBe(true);
  });
});

describe('game-b 脱衣直击制（gdd §七）+ 振听', () => {
  it('主角豁免恒不脱·姨太可被直击脱衣（多场统计）', () => {
    let heroAlways = true;
    let taiStripped = false;
    for (const seed of [1, 7, 42, 100, 2024, 88888, 313, 999]) {
      const m = playMatch(seed);
      if (m.clothing[0] !== STRIP_ITEMS) heroAlways = false; // 主角(0)豁免·恒满
      if (m.clothing.slice(1).some((c) => c < STRIP_ITEMS)) taiStripped = true;
    }
    expect(heroAlways).toBe(true); // 主角永不脱（gdd 2026-07-17 定稿）
    expect(taiStripped).toBe(true); // 至少一场姨太被直击脱衣
  });

  it('放铳/自摸触发脱衣·脱光后不再脱·clothing 不越界负', () => {
    for (const seed of [1, 42, 999, 2024, 55555]) {
      const m = playMatch(seed);
      expect(m.clothing.every((c) => c >= 0 && c <= STRIP_ITEMS)).toBe(true); // 0..5 界内
    }
  });

  it('舍张振听：待ち含自家牌河 → isFuriten=true·禁荣（防非法荣和）', () => {
    const m = startMatch(1);
    // 听 pin3 的手（man123456789 + 東東 雀头 + pin12 搭）
    m.cur.hands[1] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 9, 10];
    expect(tenpai(m.cur.hands[1]!)).toContain(11); // 听 pin3(=11)
    m.cur.rivers[1] = [11]; // 自家河里有 pin3 → 舍张振听
    expect(isFuriten(m, 1)).toBe(true);
    m.cur.rivers[1] = [33]; // 河里无听牌 → 非振听
    expect(isFuriten(m, 1)).toBe(false);
  });
});

describe('game-b 立直（简版·流程完整·番留 §3）', () => {
  it('听牌可立直·declareRiichi 扣 1000 进供托·标记锁', () => {
    const m = startMatch(1);
    // 玩家(0)首家有 drawn·构造听牌手（man123456789 + 東東 + pin1 + drawn=pin2·打 pin2 后听? 直接摆听牌形）
    m.cur.hands[0] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 9, 10]; // 13 张·摸一张后判
    m.cur.drawn = 33; // 摸 中（打掉后 13 张听 pin3）
    expect(canRiichi(m)).toBe(true);
    const before = m.scores[0]!;
    declareRiichi(m);
    expect(m.cur.riichi[0]).toBe(true);
    expect(m.scores[0]).toBe(before - 1000); // 扣立直棒
    expect(m.kyotaku).toBe(1000); // 进供托
  });

  it('非听牌不能立直·点数不足不能立直', () => {
    const m = startMatch(2);
    m.cur.hands[0] = [0, 2, 4, 6, 8, 9, 11, 13, 15, 17, 27, 29, 31]; // 散张非听
    m.cur.drawn = 33;
    expect(canRiichi(m)).toBe(false);
    // 点数不足
    m.cur.hands[0] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 9, 10];
    m.cur.drawn = 33;
    m.scores[0] = 500;
    expect(canRiichi(m)).toBe(false);
  });

  it('立直后供托归和者（settleWin 回收 kyotaku）', () => {
    // B-014 处置（测试加固 2026-08-24）：原 if/else 是死断言——构造失败走 else expect(true) 恒绿。
    // 改为构造**既定必和**局面（man111 222 333 444 四刻 + 東東雀头·实跑确认 canTsumo=true）后直断。
    const m = startMatch(555); // 庄=seat0·首摸在手·turn=0
    m.kyotaku = 2000; // 场上 2 根立直棒
    m.cur.hands[0] = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 27]; // 13 张：man1/2/3/4 各刻 + 東
    m.cur.drawn = 27; // 摸 東 成雀头 → 和了形
    const before = m.scores[0]!;
    expect(canTsumo(m)).toBe(true); // 必和局面·直断（不再 if 分支）
    declareTsumo(m);
    expect(m.cur.phase).toBe('win'); // declareTsumo 真生效
    expect(m.cur.result!.type).toBe('tsumo');
    expect(m.cur.result!.winner).toBe(0);
    expect(m.kyotaku).toBe(0); // 供托被和者取走
    expect(m.scores[0]).toBe(before + m.cur.result!.delta[0]! + 2000); // 和者进账=点移+全额供托
  });
});

// ⚔ 对抗性输入（docs/playbooks/testing.md ⚔「连点同一个键」·sim 层·测试加固 2026-08-24）：
// 鸣牌窗口是玩家唯一的"按钮时刻"——连点 碰/过 不得二次生效或跨窗口生效。
describe('game-b 鸣牌窗口 ⚔ 连点（同窗二次 playerCall / 窗口关闭后 playerCall = no-op）', () => {
  // 构造确定性碰窗口：座1 打 白(31)·玩家(0)手握两张 31 → options.pon 亮。
  function makePonWindow(): MatchState {
    const m = startMatch(1);
    m.interactiveCalls = true;
    const rs = m.cur;
    rs.turn = 1;
    rs.drawn = 31; // 座1 待打 白
    rs.hands[0] = [31, 31, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // 两张白=可碰·散张非听
    rs.hands[2] = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]; // 散张：不荣不碰
    rs.hands[3] = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
    discard(m, 31); // 座1 打出 → 开玩家碰窗口
    expect(m.cur.callWindow).not.toBeNull();
    expect(m.cur.callWindow!.options.pon).toBe(true);
    return m;
  }
  const snap = (m: MatchState): string => JSON.stringify({
    hands: m.cur.hands, melds: m.cur.melds, rivers: m.cur.rivers, turn: m.cur.turn,
    drawn: m.cur.drawn, awaitDiscard: m.cur.awaitDiscard, forbidden: m.cur.forbiddenDiscard,
    callWindow: m.cur.callWindow, wall: m.cur.wall.length, scores: m.scores, phase: m.cur.phase,
  });

  it('同一窗口二次 playerCall → 只第一下生效·第二下 no-op（态逐字节不变）', () => {
    const m = makePonWindow();
    playerCall(m, { type: 'pon' }); // 第一下：碰成立
    expect(m.cur.melds[0]).toHaveLength(1);
    expect(m.cur.melds[0]![0]!.kind).toBe('pon');
    expect(m.cur.turn).toBe(0); // 跳 actor 到碰家
    expect(m.cur.awaitDiscard).toBe(true); // 鸣后待打
    const after = snap(m);
    playerCall(m, { type: 'pon' }); // 连点第二下：窗口已消费 → 必须 no-op
    expect(snap(m)).toBe(after);
    expect(m.cur.melds[0]).toHaveLength(1); // 绝不双碰
  });

  it('窗口被「过」关闭后 playerCall → no-op（态逐字节不变）', () => {
    const m = makePonWindow();
    playerPass(m); // 过：窗口关闭·流程走到下家摸
    expect(m.cur.callWindow).toBeNull();
    const after = snap(m);
    playerCall(m, { type: 'pon' }); // 迟到点击：窗口已关 → no-op
    expect(snap(m)).toBe(after);
    expect(m.cur.melds[0]).toHaveLength(0); // 玩家未得副露
  });
});
