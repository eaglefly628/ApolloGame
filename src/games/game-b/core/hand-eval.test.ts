// Game B ·《雀宴》麻将核切片② —— 和了形/听牌测试（清单 §2 逐条点名）。
// 口径真相=docs/design/game-b/mahjong-core-tests.md §2；判型宁可慢也要对·手牌以具体牌码构造断言。
// 牌码速查（tiles-def.ts）：man1-9=0-8 · pin1-9=9-17 · sou1-9=18-26 · 東27 南28 西29 北30 白31 發32 中33。
// 赤5：普5码+100（man5红=104·pin5红=113·sou5红=122）。
import { describe, it, expect } from 'vitest';
import { isWinningHand, tenpai, winsWithMelds, tenpaiWithMelds } from './hand-eval.js';

describe('§2 标准形 4 面子+雀头（顺/刻混合）判和', () => {
  it('顺+刻混合：man123+man456+pin789+sou222(刻)+東東(雀头)', () => {
    // 3 顺 + 1 刻 + 1 雀头 = 14
    expect(isWinningHand([0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27, 27])).toBe(true);
  });

  it('对对和形（全刻）：man111+man999+pin555+東東東+中中', () => {
    expect(isWinningHand([0, 0, 0, 8, 8, 8, 13, 13, 13, 27, 27, 27, 33, 33])).toBe(true);
  });

  it('赤5 归一：顺子含赤man5(104) 照普5 判和', () => {
    // man123 + man4·5红·6 + pin123 + sou789 + 中中；104 经 kindOf → man5(种码4)
    expect(isWinningHand([0, 1, 2, 3, 104, 5, 9, 10, 11, 24, 25, 26, 33, 33])).toBe(true);
  });

  it('非 14 张（13/15/空）一律非和了形', () => {
    expect(isWinningHand([])).toBe(false);
    expect(isWinningHand([0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27])).toBe(false); // 13
    expect(isWinningHand([0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27, 27, 27])).toBe(false); // 15
  });
});

describe('§2 七对子判和（四枚同牌≠两对）', () => {
  it('七个不同对子判和', () => {
    // man1·man3·pin2·pin5·sou7·東·中 各成对
    expect(isWinningHand([0, 0, 2, 2, 10, 10, 13, 13, 24, 24, 27, 27, 33, 33])).toBe(true);
  });

  it('四枚同牌不作两对：man1×4 + 5 对 → 非七对且无标准解 → 不判和', () => {
    // man1×4 · man3×2 · pin2×2 · pin5×2 · sou7×2 · 中×2（14 张·仅 6 种）
    expect(isWinningHand([0, 0, 0, 0, 2, 2, 10, 10, 13, 13, 24, 24, 33, 33])).toBe(false);
  });
});

describe('§2 国士无双 13 面 / 单骑判和', () => {
  const KOKUSHI_13 = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; // 13 幺九各一

  it('13 面听：13 种幺九各一 → 听全部 13 种', () => {
    expect(tenpai([...KOKUSHI_13])).toEqual([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
  });

  it('13 面补任一幺九即和（以补 man1 为例）', () => {
    expect(isWinningHand([...KOKUSHI_13, 0])).toBe(true); // man1 成对
  });

  it('单骑听：man1 已成对·缺中(33) → 单骑听中', () => {
    // man1,man1(雀头) + man9,pin1,pin9,sou1,sou9,東,南,西,北,白,發（缺 中）
    const hand = [0, 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32];
    expect(tenpai(hand)).toEqual([33]);
    expect(isWinningHand([...hand, 33])).toBe(true);
  });
});

describe('§2 无役形（有形无役）— 纯形层判和·1 番缚属役表层(§3)', () => {
  it('无字无三色的普通数牌形：形合法 → isWinningHand=true（yaku 不在本层）', () => {
    // man123+man567+pin456+sou789+南南；含幺九(非断幺)·南非役牌·非三色 → 荣和无役，
    // 但「1 番缚·无役不得和」需役评估(§3)，纯形层一律判 true。
    expect(isWinningHand([0, 1, 2, 4, 5, 6, 12, 13, 14, 24, 25, 26, 28, 28])).toBe(true);
  });
});

describe('§2 听牌枚举：搭子形逐类点名（两面/嵌张/边张/双碰/单骑）', () => {
  it('两面待ち：man23 → 听 man1/man4', () => {
    // man2,man3 + 東東 + pin123 + pin567 + sou234
    const hand = [1, 2, 27, 27, 9, 10, 11, 13, 14, 15, 19, 20, 21];
    expect(tenpai(hand)).toEqual([0, 3]);
  });

  it('嵌张待ち：man1_3 → 只听 man2', () => {
    // man1,man3 + 中中 + pin111 + sou789 + man789
    const hand = [0, 2, 33, 33, 9, 9, 9, 24, 25, 26, 6, 7, 8];
    expect(tenpai(hand)).toEqual([1]);
  });

  it('边张待ち：man89 → 只听 man7', () => {
    // man8,man9 + 東東 + pin234 + sou678 + man234
    const hand = [7, 8, 27, 27, 10, 11, 12, 23, 24, 25, 1, 2, 3];
    expect(tenpai(hand)).toEqual([6]);
  });

  it('双碰待ち：man1 对 / 中 对 → 听 man1/中', () => {
    // man1,man1 + 中,中 + pin123 + sou456 + man567
    const hand = [0, 0, 33, 33, 9, 10, 11, 21, 22, 23, 4, 5, 6];
    expect(tenpai(hand)).toEqual([0, 33]);
  });

  it('单骑待ち：4 面子成型·東 单张 → 只听 東', () => {
    // 東 + man123 + pin456 + sou789 + man567
    const hand = [27, 0, 1, 2, 12, 13, 14, 24, 25, 26, 4, 5, 6];
    expect(tenpai(hand)).toEqual([27]);
  });
});

describe('§2 多面复合待ち（≥3 面）全枚举', () => {
  it('三面延べ单骑：sou2345678 → 听 sou2/sou5/sou8', () => {
    // sou2-8(七连) + man111 + pin999；延べ形三面听
    const hand = [19, 20, 21, 22, 23, 24, 25, 0, 0, 0, 17, 17, 17];
    expect(tenpai(hand)).toEqual([19, 22, 25]);
  });

  it('九莲宝灯纯正形：sou1112345678999 → 听全 9 种 sou', () => {
    const hand = [18, 18, 18, 19, 20, 21, 22, 23, 24, 25, 26, 26, 26];
    expect(tenpai(hand)).toEqual([18, 19, 20, 21, 22, 23, 24, 25, 26]);
  });
});

describe('§2 非听牌形 tenpai=[]（流局罚符依据）', () => {
  it('散张无搭子无对子（man/pin/sou 各 1·4·7 + 4 字牌单张）→ 空听', () => {
    const hand = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 29, 31, 33];
    expect(tenpai(hand)).toEqual([]);
  });

  it('非 13 张一律空听（14 张完成形也不当听牌处理）', () => {
    expect(tenpai([])).toEqual([]);
    // 一副已完成的 14 张：非「13 张听牌」语义 → []
    expect(tenpai([0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27, 27])).toEqual([]);
  });
});

// ── §6 鸣牌加法扩展：meld-aware 和了 / 听牌（详尽用例在 meld.test.ts·此处补锚点）──
describe('§6 winsWithMelds/tenpaiWithMelds · 加法不破门清核', () => {
  it('meldCount=0 委托旧核：与 isWinningHand / tenpai 逐例等价', () => {
    const win14 = [0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27, 27]; // 门清和了形
    expect(winsWithMelds(win14.slice(0, 13), 0, 27)).toBe(isWinningHand(win14));
    const wait13 = [1, 2, 27, 27, 9, 10, 11, 13, 14, 15, 19, 20, 21]; // man23 两面 → 听 man1/man4
    expect(tenpaiWithMelds(wait13, 0)).toEqual(tenpai(wait13));
  });

  it('副露后暗手：各 meldCount 正例和了（(4-mc) 面子 + 雀头）', () => {
    // mc1：man123 pin456 sou78 東東 + sou9 → 3 面子 + 雀头
    expect(winsWithMelds([0, 1, 2, 12, 13, 14, 24, 25, 27, 27], 1, 26)).toBe(true);
    // mc2：man123 pin11 sou78 + sou6 → 2 面子 + 雀头
    expect(winsWithMelds([0, 1, 2, 9, 9, 24, 25], 2, 23)).toBe(true);
    // mc3：man23 東東 + man1 → 1 面子 + 雀头
    expect(winsWithMelds([1, 2, 27, 27], 3, 0)).toBe(true);
    // mc4：東 单骑 + 東 → 雀头
    expect(winsWithMelds([27], 4, 27)).toBe(true);
  });

  it('副露 meldCount≥1 不成七対 / 国士（长度天然排除·只走标准形）', () => {
    // 七対子形（14 张）喂给 mc1（要求 10 张暗手）→ 长度守卫 false
    expect(winsWithMelds([0, 0, 2, 2, 10, 10, 13, 13, 24, 24, 27, 27, 33], 1, 33)).toBe(false);
  });
});
