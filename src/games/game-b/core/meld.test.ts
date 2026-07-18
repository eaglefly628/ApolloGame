// Game B ·《雀宴》麻将核 —— 鸣牌数据模型 + meld-aware 和了/听牌（naki-design §1/§6·加法不破门清核）。
// 牌码速查（tiles-def.ts）：man1-9=0-8 · pin1-9=9-17 · sou1-9=18-26 · 東27 南28 西29 北30 白31 發32 中33。
// 赤5：普5码+100（man5红=104·pin5红=113·sou5红=122·经 kindOf 归其普5 种）。
// 长度绳：暗手（不含和牌）= 13-3*meldCount；一副露 = 1 面子（占 3 手数）。
import { describe, it, expect } from 'vitest';
import type { Meld, MeldKind } from './meld.js';
import { isKan, meldConsumesFromHand } from './meld.js';
import { winsWithMelds, tenpaiWithMelds, isWinningHand, tenpai } from './hand-eval.js';

/** 造一个形状合理的 Meld（这些函数只读 kind·tiles/from/called 仅承载）。 */
function mk(kind: MeldKind, tiles: number[]): Meld {
  return { kind, tiles, from: 0, called: tiles[0]! };
}

describe('meld.ts · 数据模型纯查询', () => {
  it('meldConsumesFromHand：吃/碰=2 · 大明杠=3 · 暗杠=4 · 加杠=1', () => {
    expect(meldConsumesFromHand(mk('chi', [0, 1, 2]))).toBe(2);
    expect(meldConsumesFromHand(mk('pon', [9, 9, 9]))).toBe(2);
    expect(meldConsumesFromHand(mk('minkan', [9, 9, 9, 9]))).toBe(3); // 大明杠：暗手 3 + 弃牌 1
    expect(meldConsumesFromHand(mk('ankan', [27, 27, 27, 27]))).toBe(4); // 暗杠：暗手（含刚摸）4
    expect(meldConsumesFromHand(mk('kakan', [9, 9, 9, 9]))).toBe(1); // 加杠：碰的 3 张在副露·仅补 1
  });

  it('isKan：三种杠=true · 吃/碰=false', () => {
    expect(isKan(mk('minkan', [9, 9, 9, 9]))).toBe(true);
    expect(isKan(mk('ankan', [27, 27, 27, 27]))).toBe(true);
    expect(isKan(mk('kakan', [9, 9, 9, 9]))).toBe(true);
    expect(isKan(mk('chi', [0, 1, 2]))).toBe(false);
    expect(isKan(mk('pon', [9, 9, 9]))).toBe(false);
  });
});

describe('winsWithMelds · meldCount=1（暗手 10 张 → 3 面子 + 雀头）', () => {
  // man123 + pin456 + sou78 + 東東（两面听 sou6/sou9）
  const concealed = [0, 1, 2, 12, 13, 14, 24, 25, 27, 27];
  it('正例：+sou9 / +sou6 均和', () => {
    expect(winsWithMelds(concealed, 1, 26)).toBe(true); // sou789
    expect(winsWithMelds(concealed, 1, 23)).toBe(true); // sou678
  });
  it('反例：+中（杂牌）/ +sou1（不成顺）不和', () => {
    expect(winsWithMelds(concealed, 1, 33)).toBe(false);
    expect(winsWithMelds(concealed, 1, 18)).toBe(false);
  });
});

describe('winsWithMelds · meldCount=2（暗手 7 张 → 2 面子 + 雀头）', () => {
  it('两面听：man123 + pin11 + sou78 → +sou6/+sou9 和·+sou1 不和', () => {
    const c = [0, 1, 2, 9, 9, 24, 25];
    expect(winsWithMelds(c, 2, 26)).toBe(true);
    expect(winsWithMelds(c, 2, 23)).toBe(true);
    expect(winsWithMelds(c, 2, 18)).toBe(false);
  });
  it('双碰听：man123 + pin11 + 東東 → +pin1/+東 和·+中 不和', () => {
    const c = [0, 1, 2, 9, 9, 27, 27];
    expect(winsWithMelds(c, 2, 9)).toBe(true); // pin111 + 東東
    expect(winsWithMelds(c, 2, 27)).toBe(true); // 東東東 + pin11
    expect(winsWithMelds(c, 2, 33)).toBe(false);
  });
  it('赤5 和牌归一：man123 + pin4_6 + 東東 → +pin5红(113) 补 pin456 和', () => {
    expect(winsWithMelds([0, 1, 2, 12, 14, 27, 27], 2, 113)).toBe(true);
  });
});

describe('winsWithMelds · meldCount=3（暗手 4 张 → 1 面子 + 雀头）', () => {
  it('两面听：man23 + 東東 → +man1/+man4 和·+中 不和', () => {
    const c = [1, 2, 27, 27];
    expect(winsWithMelds(c, 3, 0)).toBe(true); // man123
    expect(winsWithMelds(c, 3, 3)).toBe(true); // man234
    expect(winsWithMelds(c, 3, 33)).toBe(false);
  });
  it('单骑听：man123 + 東 → +東 和·+中 不和', () => {
    const c = [0, 1, 2, 27];
    expect(winsWithMelds(c, 3, 27)).toBe(true);
    expect(winsWithMelds(c, 3, 33)).toBe(false);
  });
});

describe('winsWithMelds · meldCount=4（暗手 1 张 → 单骑雀头·四副露）', () => {
  it('单骑：東 → +東 和·+中 不和', () => {
    expect(winsWithMelds([27], 4, 27)).toBe(true);
    expect(winsWithMelds([27], 4, 33)).toBe(false);
  });
});

describe('winsWithMelds · 非法输入守卫', () => {
  it('concealed 长度 ≠ 13-3*meldCount → false', () => {
    expect(winsWithMelds([0, 1, 2], 1, 5)).toBe(false); // 期望 10 张
    expect(winsWithMelds([0, 1, 2, 12, 13, 14, 24, 25, 27, 27], 0, 26)).toBe(false); // mc0 期望 13
  });
  it('meldCount 越界（<0 / >4 / 非整数）→ false', () => {
    const c = [0, 1, 2, 12, 13, 14, 24, 25, 27, 27];
    expect(winsWithMelds(c, 5, 26)).toBe(false);
    expect(winsWithMelds(c, -1, 26)).toBe(false);
    expect(winsWithMelds(c, 1.5, 26)).toBe(false);
  });
});

describe('tenpaiWithMelds · 各 meldCount 多面待ち枚举', () => {
  it('meldCount=1 两面：man123 pin456 sou78 東東 → [sou6, sou9]', () => {
    expect(tenpaiWithMelds([0, 1, 2, 12, 13, 14, 24, 25, 27, 27], 1)).toEqual([23, 26]);
  });
  it('meldCount=2 双碰：man123 pin11 東東 → [pin1, 東]', () => {
    expect(tenpaiWithMelds([0, 1, 2, 9, 9, 27, 27], 2)).toEqual([9, 27]);
  });
  it('meldCount=2 两面：man123 pin11 sou78 → [sou6, sou9]', () => {
    expect(tenpaiWithMelds([0, 1, 2, 9, 9, 24, 25], 2)).toEqual([23, 26]);
  });
  it('meldCount=3 两面：man23 東東 → [man1, man4]', () => {
    expect(tenpaiWithMelds([1, 2, 27, 27], 3)).toEqual([0, 3]);
  });
  it('meldCount=4 单骑：東 → [東]', () => {
    expect(tenpaiWithMelds([27], 4)).toEqual([27]);
  });
  it('非听：man123 pin456 sou7 東 中 白（散张）→ []', () => {
    expect(tenpaiWithMelds([0, 1, 2, 12, 13, 14, 24, 27, 33, 31], 1)).toEqual([]);
  });
  it('长度 / 越界守卫 → []', () => {
    expect(tenpaiWithMelds([0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27], 1)).toEqual([]); // 13 张 @ mc1
    expect(tenpaiWithMelds([27], 5)).toEqual([]);
    expect(tenpaiWithMelds([27], -1)).toEqual([]);
  });
});

// ── meldCount=0 等价旧核（回归钉·加法不破的证明）──────────────────────────────
describe('meldCount=0 与门清核逐例等价（回归钉）', () => {
  it('三形赢牌：标准 / 七対子 / 国士 经 winsWithMelds(mc0) 全 true 且与 isWinningHand 一致', () => {
    // 标准形（man123 man456 pin789 sou222 + 東单骑）
    const stdC = [0, 1, 2, 3, 4, 5, 15, 16, 17, 19, 19, 19, 27];
    expect(winsWithMelds(stdC, 0, 27)).toBe(isWinningHand([...stdC, 27]));
    expect(winsWithMelds(stdC, 0, 27)).toBe(true);
    // 七対子（6 对 + 中单骑）
    const sevenC = [0, 0, 2, 2, 10, 10, 13, 13, 24, 24, 27, 27, 33];
    expect(winsWithMelds(sevenC, 0, 33)).toBe(isWinningHand([...sevenC, 33]));
    expect(winsWithMelds(sevenC, 0, 33)).toBe(true);
    // 国士无双 13 面（补 man1）
    const kokuC = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    expect(winsWithMelds(kokuC, 0, 0)).toBe(isWinningHand([...kokuC, 0]));
    expect(winsWithMelds(kokuC, 0, 0)).toBe(true);
  });

  // 简易确定性 LCG（种子化·零 Math.random·可复现）。
  function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }
  /** 34 种各 4 枚 = 136 张牌山（普通码·无赤·等价性与赤无关）。 */
  function buildWall(): number[] {
    const w: number[] = [];
    for (let k = 0; k < 34; k++) for (let n = 0; n < 4; n++) w.push(k);
    return w;
  }
  function shuffled(rng: () => number): number[] {
    const w = buildWall();
    for (let i = w.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [w[i], w[j]] = [w[j]!, w[i]!];
    }
    return w;
  }

  it('随机 400 手对拍：winsWithMelds(c,0,w) ≡ isWinningHand([...c,w])', () => {
    const rng = makeRng(0x9e3779b1);
    for (let iter = 0; iter < 400; iter++) {
      const w = shuffled(rng);
      const concealed = w.slice(0, 13);
      const winTile = w[13]!;
      expect(winsWithMelds(concealed, 0, winTile)).toBe(isWinningHand([...concealed, winTile]));
    }
  });

  it('随机 400 手对拍：tenpaiWithMelds(c,0) ≡ tenpai(c)', () => {
    const rng = makeRng(0x1234abcd);
    for (let iter = 0; iter < 400; iter++) {
      const concealed = shuffled(rng).slice(0, 13);
      expect(tenpaiWithMelds(concealed, 0)).toEqual(tenpai(concealed));
    }
  });
});
