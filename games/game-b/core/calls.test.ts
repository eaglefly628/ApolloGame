// Game B ·《雀宴》鸣牌合法性检测测试（naki-design §2/§3·逐型正反例 + 喰い替え + 优先级）。
import { describe, it, expect } from 'vitest';
import {
  chiCandidates,
  canPon,
  canDaiminkan,
  ankanCandidates,
  kakanCandidates,
  kuikaeForbidden,
  resolveClaims,
  type CallClaim,
} from './calls.js';
import type { Meld } from './meld.js';

// 牌种速记：man 1-9=0-8 · pin 1-9=9-17 · sou 1-9=18-26 · 東南西北=27-30 · 白發中=31-33。
const M = (n: number): number => n - 1; // man n（1-9）→ 种码
const P = (n: number): number => 9 + (n - 1); // pin n
const S = (n: number): number => 18 + (n - 1); // sou n
const TON = 27, HAKU = 31, CHUN = 33;
const RED5M = 104; // 赤5萬（kindOf=4=普5萬种）

describe('鸣牌·吃（chiCandidates·仅同色数牌成顺）', () => {
  it('嵌张：暗手 {2m,4m} 吃 3m → 一候选 [1,3]', () => {
    const cs = chiCandidates([M(2), M(4)], M(3));
    expect(cs).toEqual([{ consume: [M(2), M(4)] }]);
  });
  it('三向搭：暗手 {1m,2m,4m,5m} 吃 3m → 三候选（低端/嵌/高端）', () => {
    const cs = chiCandidates([M(1), M(2), M(4), M(5)], M(3));
    expect(cs).toEqual([
      { consume: [M(1), M(2)] }, // 3m 作高端
      { consume: [M(2), M(4)] }, // 3m 作嵌张
      { consume: [M(4), M(5)] }, // 3m 作低端
    ]);
  });
  it('边端：暗手 {2m,3m} 吃 1m → 一候选（低端·penchan 反）', () => {
    expect(chiCandidates([M(2), M(3)], M(1))).toEqual([{ consume: [M(2), M(3)] }]);
  });
  it('字牌不可吃：暗手含相邻数值也拒（东南西北白發中无顺）', () => {
    expect(chiCandidates([TON, HAKU], TON)).toEqual([]);
  });
  it('不跨花色：暗手 {8m,9m} 吃 1p（种码相邻但异色）→ 空', () => {
    expect(chiCandidates([M(8), M(9)], P(1))).toEqual([]);
  });
  it('不跨花色：暗手 {1p,2p} 吃 9m → 空', () => {
    expect(chiCandidates([P(1), P(2)], M(9))).toEqual([]);
  });
  it('赤5 归普5 参与吃：暗手 {赤5m,6m} 吃 4m → 候选 {5m,6m}', () => {
    expect(chiCandidates([RED5M, M(6)], M(4))).toEqual([{ consume: [M(5), M(6)] }]);
  });
  it('无搭 → 空', () => {
    expect(chiCandidates([M(1), M(9), P(5)], M(5))).toEqual([]);
  });
});

describe('鸣牌·碰 / 大明杠（任意家·按枚数）', () => {
  it('碰：暗手 2 张同种 → true；1 张 → false', () => {
    expect(canPon([CHUN, CHUN, M(1)], CHUN)).toBe(true);
    expect(canPon([CHUN, M(1)], CHUN)).toBe(false);
  });
  it('碰：赤5 + 普5 计同种（2 张）→ true', () => {
    expect(canPon([RED5M, M(5)], M(5))).toBe(true); // 赤5m + 普5m 同种
  });
  it('大明杠：暗手 3 张同种 → true；2 张 → false（只够碰）', () => {
    expect(canDaiminkan([TON, TON, TON], TON)).toBe(true);
    expect(canDaiminkan([TON, TON], TON)).toBe(false);
  });
});

describe('鸣牌·暗杠 / 加杠候选（自家回合）', () => {
  it('暗杠：手中（含摸）某种 4 张 → 候选含该种；3 张不列', () => {
    expect(ankanCandidates([M(3), M(3), M(3), M(3), P(1)])).toEqual([M(3)]);
    expect(ankanCandidates([M(3), M(3), M(3), P(1)])).toEqual([]);
  });
  it('暗杠：赤5 + 三枚普5 = 4 张同种 → 候选 [4]', () => {
    expect(ankanCandidates([RED5M, M(5), M(5), M(5)])).toEqual([M(5)]);
  });
  it('加杠：已碰某种 + 手中持第 4 张 → 候选含该种', () => {
    const melds: Meld[] = [{ kind: 'pon', tiles: [HAKU, HAKU, HAKU], from: 2, called: HAKU }];
    expect(kakanCandidates([HAKU, M(1)], melds)).toEqual([HAKU]);
  });
  it('加杠：有碰但手中无第 4 张 → 空', () => {
    const melds: Meld[] = [{ kind: 'pon', tiles: [HAKU, HAKU, HAKU], from: 2, called: HAKU }];
    expect(kakanCandidates([M(1), M(2)], melds)).toEqual([]);
  });
  it('加杠：吃副露不升杠（仅碰可加）', () => {
    const melds: Meld[] = [{ kind: 'chi', tiles: [M(1), M(2), M(3)], from: 3, called: M(3) }];
    expect(kakanCandidates([M(1), M(1)], melds)).toEqual([]);
  });
});

describe('鸣牌·喰い替え禁（R-2·現物 + 両面筋）', () => {
  it('両面吃低端：4-5 吃 3 → 禁 {3m,6m}', () => {
    expect(kuikaeForbidden(M(3), [M(4), M(5)])).toEqual([M(3), M(6)]);
  });
  it('両面吃高端：5-6 吃 7 → 禁 {4m,7m}', () => {
    expect(kuikaeForbidden(M(7), [M(5), M(6)])).toEqual([M(4), M(7)]);
  });
  it('両面吃低端：2-3 吃 1 → 禁 {1m,4m}（2-3 待 1/4·筋=4）', () => {
    expect(kuikaeForbidden(M(1), [M(2), M(3)])).toEqual([M(1), M(4)]);
  });
  it('両面吃高端：7-8 吃 9 → 禁 {6m,9m}（7-8 待 6/9·筋=6）', () => {
    expect(kuikaeForbidden(M(9), [M(7), M(8)])).toEqual([M(6), M(9)]);
  });
  it('真 penchan 吃：1-2 吃 3 → 仅禁 {3m}（1-2 只待 3·无筋）', () => {
    expect(kuikaeForbidden(M(3), [M(1), M(2)])).toEqual([M(3)]);
  });
  it('嵌张吃：2-4 吃 3 → 仅禁 {3m}（嵌张无筋）', () => {
    expect(kuikaeForbidden(M(3), [M(2), M(4)])).toEqual([M(3)]);
  });
  it('碰：consume=null → 仅禁現物', () => {
    expect(kuikaeForbidden(CHUN, null)).toEqual([CHUN]);
  });
  it('筋不跨花色：8-9 吃 7（sou）→ 禁 {7s}（6s 是筋·在段内故禁）', () => {
    // 8s-9s 吃 7s（吃低端）→ 筋=9s+1=越界 → 仅禁 7s
    expect(kuikaeForbidden(S(7), [S(8), S(9)])).toEqual([S(7)]);
  });
});

describe('鸣牌·优先级裁决（resolveClaims·荣>碰/杠>吃）', () => {
  it('荣压碰压吃', () => {
    const claims: CallClaim[] = [
      { seat: 1, type: 'chi' },
      { seat: 2, type: 'pon' },
      { seat: 3, type: 'ron' },
    ];
    expect(resolveClaims(claims)).toEqual([{ seat: 3, type: 'ron' }]);
  });
  it('碰压吃（无荣）', () => {
    const claims: CallClaim[] = [
      { seat: 1, type: 'chi' },
      { seat: 2, type: 'pon' },
    ];
    expect(resolveClaims(claims)).toEqual([{ seat: 2, type: 'pon' }]);
  });
  it('大明杠与碰同档（任取其一·至多一家）', () => {
    const claims: CallClaim[] = [{ seat: 2, type: 'minkan' }];
    expect(resolveClaims(claims)).toEqual([{ seat: 2, type: 'minkan' }]);
  });
  it('多家荣 → 双响全返回', () => {
    const claims: CallClaim[] = [
      { seat: 1, type: 'ron' },
      { seat: 3, type: 'ron' },
    ];
    expect(resolveClaims(claims)).toEqual([
      { seat: 1, type: 'ron' },
      { seat: 3, type: 'ron' },
    ]);
  });
  it('仅吃 → 吃胜出', () => {
    expect(resolveClaims([{ seat: 1, type: 'chi' }])).toEqual([{ seat: 1, type: 'chi' }]);
  });
  it('无主张 → 空', () => {
    expect(resolveClaims([])).toEqual([]);
  });
});
