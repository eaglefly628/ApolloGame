// Game B ·《雀宴》麻将核切片④a —— 符计算 + 点数表测试（清单 §4·§5·边角全点名）。
// 口径真相 = docs/design/game-b/mahjong-core-tests.md §4/§5 + 裁决 R-1(连风=2符·GD-B 2026-07-18 圈定)/无切上满贯/R-8(数え役满)。
// 直测导出纯函数（calcFu/pairFu/limitAndBase/buildPayment）以精确覆盖矩阵·避免 scoreWin 取高遮蔽；
// 另附 scoreWin 集成例钉死「30符4番≠满贯 / 40符4番=满贯」的无切上满贯边界。
import { describe, it, expect } from 'vitest';
import { calcFu, pairFu, limitAndBase, buildPayment } from './fu-score.js';
import { scoreWin, type WinContext, type Decomp, type Meld, type WinInterp } from './yaku.js';

function ctx(over: Partial<WinContext> = {}): WinContext {
  return {
    hand14: [], winTile: 0, tsumo: false, seatWind: 1, roundWind: 0, isDealer: false,
    riichi: false, doubleRiichi: false, ippatsu: false, haitei: false, doraIndicators: [], uraIndicators: [],
    ...over,
  };
}
const seq = (k: number): Meld => ({ type: 'seq', kind: k });
const tri = (k: number): Meld => ({ type: 'triplet', kind: k });
const D = (melds: Meld[], pair: number, form: Decomp['form'] = 'standard'): Decomp => ({ form, melds, pair });
const RY: WinInterp = { waitType: 'ryanmen', ronMinkoIndex: -1 };
const KAN: WinInterp = { waitType: 'kanchan', ronMinkoIndex: -1 };
const PEN: WinInterp = { waitType: 'penchan', ronMinkoIndex: -1 };
const TANKI: WinInterp = { waitType: 'tanki', ronMinkoIndex: -1 };

// ── §4 符计算 ──────────────────────────────────────────────────────────────
describe('§4 底符 / 门前清荣和 / 特例', () => {
  const allSeq = D([seq(0), seq(3), seq(9), seq(12)], 17); // 全顺·pin9 数牌雀头
  it('平和荣和 = 30 符（底20 + 门清荣和10）', () => {
    expect(calcFu(allSeq, RY, ctx(), true)).toBe(30);
  });
  it('平和自摸 = 20 符（自摸 2 符不计）', () => {
    expect(calcFu(allSeq, RY, ctx({ tsumo: true }), true)).toBe(20);
  });
  it('七対子 = 25 符固定', () => {
    expect(calcFu(D([], -1, 'chiitoi'), TANKI, ctx({ tsumo: true }), false)).toBe(25);
  });
  it('非平和自摸 +2 符（22→切上 30）', () => {
    // 全顺·两面·数牌雀头·自摸但按非平和算 → 20+2 = 22 → 30
    expect(calcFu(allSeq, RY, ctx({ tsumo: true }), false)).toBe(30);
  });
});

describe('§4 面子符矩阵（明/暗刻 × 中张/幺九 = 2/4/4/8·经切上边界观测）', () => {
  it('两暗刻中张（4+4）荣和 = 40 符', () => {
    // 20 + 10(门清荣和) + 4 + 4 = 38 → 40
    expect(calcFu(D([tri(19), tri(20), seq(9), seq(12)], 17), RY, ctx(), false)).toBe(40);
  });
  it('两暗刻幺九（8+8）荣和 = 50 符（越 40/50 界·钉死幺九暗刻=8）', () => {
    // 20 + 10 + 8 + 8 = 46 → 50
    expect(calcFu(D([tri(0), tri(8), seq(9), seq(12)], 17), RY, ctx(), false)).toBe(50);
  });
  it('四暗刻幺九自摸单骑 = 60 符', () => {
    // 20 + 8×4 + 2(单骑) + 2(自摸) = 56 → 60
    expect(calcFu(D([tri(0), tri(8), tri(9), tri(17)], 18), TANKI, ctx({ tsumo: true }), false)).toBe(60);
  });
  it('明刻幺九（4·荣和双碰）四刻 = 60 符；同形若误作暗刻(8)则为 70 → 钉死明刻幺九=4', () => {
    // 3 暗刻幺九(8×3=24) + 1 明刻幺九(4·ron 该刻) = 28·+20+10 = 58 → 60（≠70）
    const dc = D([tri(0), tri(8), tri(9), tri(17)], 26); // pair sou9
    expect(calcFu(dc, { waitType: 'shanpon', ronMinkoIndex: 3 }, ctx(), false)).toBe(60);
  });
  it('明刻中张（2·荣和双碰）四刻 = 50 符', () => {
    // 3 暗刻中张(4×3=12) + 1 明刻中张(2) = 14·+20+10 = 44 → 50
    const dc = D([tri(19), tri(20), tri(10), tri(4)], 16);
    expect(calcFu(dc, { waitType: 'shanpon', ronMinkoIndex: 3 }, ctx(), false)).toBe(50);
  });
});

describe('§4 雀头符（役牌+2·连风=2符 R-1 GD-B 圈定·客风/数牌 0）', () => {
  it('数牌雀头 0 符', () => { expect(pairFu(15, ctx())).toBe(0); });
  it('三元雀头（中）+2 符', () => { expect(pairFu(33, ctx())).toBe(2); });
  it('自风雀头（南·seat1）+2 符', () => { expect(pairFu(28, ctx({ seatWind: 1, roundWind: 0 }))).toBe(2); });
  it('场风雀头（東·round0·seat南）+2 符', () => { expect(pairFu(27, ctx({ seatWind: 1, roundWind: 0 }))).toBe(2); });
  it('连风雀头（東·seat0 round0）= 2 符（R-1 圈定·对齐雀魂/天凤·非叠加）', () => { expect(pairFu(27, ctx({ seatWind: 0, roundWind: 0 }))).toBe(2); });
  it('客风雀头（西·非自非场）0 符', () => { expect(pairFu(29, ctx({ seatWind: 1, roundWind: 0 }))).toBe(0); });
});

describe('§4 待ち符（边/嵌/单骑+2·两面/双碰 0）', () => {
  const m = D([seq(0), seq(3), seq(9), seq(12)], 17); // 全顺数牌雀头（隔离待ち符）
  it('两面 0 符 → 20+10 = 30', () => { expect(calcFu(m, RY, ctx(), false)).toBe(30); });
  it('嵌张 +2 → 32 → 40', () => { expect(calcFu(m, KAN, ctx(), false)).toBe(40); });
  it('边张 +2 → 32 → 40', () => { expect(calcFu(m, PEN, ctx(), false)).toBe(40); });
  it('单骑 +2 → 32 → 40', () => { expect(calcFu(m, TANKI, ctx(), false)).toBe(40); });
});

// ── §5 点数表 ──────────────────────────────────────────────────────────────
describe('§5 基本点 = 符×2^(2+番) + 档位', () => {
  it('1番30符 → base 240', () => { expect(limitAndBase(1, 30)).toEqual({ base: 240, limit: '' }); });
  it('3番40符 → base 1280', () => { expect(limitAndBase(3, 40)).toEqual({ base: 1280, limit: '' }); });
  it('5番 → 満貫 base 2000（不看符）', () => { expect(limitAndBase(5, 20).base).toBe(2000); });
  it('6-7番 → 跳満 3000', () => { expect(limitAndBase(6, 30).base).toBe(3000); expect(limitAndBase(7, 40).base).toBe(3000); });
  it('8-10番 → 倍満 4000', () => { expect(limitAndBase(8, 20).base).toBe(4000); expect(limitAndBase(10, 30).base).toBe(4000); });
  it('11-12番 → 三倍満 6000', () => { expect(limitAndBase(11, 20).base).toBe(6000); });
  it('13+番 → 数え役満 8000（R-8·非三倍满封顶）', () => { expect(limitAndBase(13, 20)).toEqual({ base: 8000, limit: '数え役満' }); });
});

describe('§5 无切上满贯（30符4番/60符3番 不升满贯·40符4番自然到顶）', () => {
  it('30符4番 → base 1920（≠2000·不升满贯）', () => { expect(limitAndBase(4, 30)).toEqual({ base: 1920, limit: '' }); });
  it('60符3番 → base 1920（同不升）', () => { expect(limitAndBase(3, 60)).toEqual({ base: 1920, limit: '' }); });
  it('40符4番 → 満貫 2000（raw 2560≥2000 自然到顶）', () => { expect(limitAndBase(4, 40)).toEqual({ base: 2000, limit: '満貫' }); });
  it('闲家 30符4番荣和 = 7700 / 庄家 = 11600', () => {
    expect(buildPayment(1920, false, false).ron).toBe(7700);
    expect(buildPayment(1920, true, false).ron).toBe(11600);
  });
});

describe('§5 支付比例（闲荣×4·庄荣×6·自摸闲2/1/1·自摸庄各×2·百位切上）', () => {
  it('1番30符 闲家自摸 = 庄付500/闲付300（总1100·百位切上）', () => {
    const p = buildPayment(limitAndBase(1, 30).base, false, true); // base 240
    expect(p.fromDealer).toBe(500); // ceil100(480)
    expect(p.fromNonDealer).toBe(300); // ceil100(240)
    expect(p.total).toBe(1100);
  });
  it('1番30符 庄家自摸 = 各付500（总1500）', () => {
    const p = buildPayment(240, true, true);
    expect(p.fromEach).toBe(500);
    expect(p.total).toBe(1500);
  });
  it('3番30符 闲家自摸 = 庄付2000/闲付1000（总4000·标准值）', () => {
    const p = buildPayment(limitAndBase(3, 30).base, false, true); // base 960
    expect(p.fromDealer).toBe(2000);
    expect(p.fromNonDealer).toBe(1000);
    expect(p.total).toBe(4000);
  });
});

describe('§5 满贯以上定额表（庄 1.5 倍）', () => {
  const cases: [string, number, number, number, number, number][] = [
    // 档名, base, 闲荣, 庄荣, 闲自摸total, 庄自摸total
    ['満貫', 2000, 8000, 12000, 8000, 12000],
    ['跳満', 3000, 12000, 18000, 12000, 18000],
    ['倍満', 4000, 16000, 24000, 16000, 24000],
    ['三倍満', 6000, 24000, 36000, 24000, 36000],
    ['役満', 8000, 32000, 48000, 32000, 48000],
  ];
  for (const [name, base, koRon, oyaRon, koTsumo, oyaTsumo] of cases) {
    it(`${name}：闲荣${koRon}/庄荣${oyaRon}/闲自摸${koTsumo}/庄自摸${oyaTsumo}`, () => {
      expect(buildPayment(base, false, false).ron).toBe(koRon);
      expect(buildPayment(base, true, false).ron).toBe(oyaRon);
      expect(buildPayment(base, false, true).total).toBe(koTsumo);
      expect(buildPayment(base, true, true).total).toBe(oyaTsumo);
    });
  }
  it('満貫闲自摸拆分 = 庄付4000/闲付2000', () => {
    const p = buildPayment(2000, false, true);
    expect(p.fromDealer).toBe(4000);
    expect(p.fromNonDealer).toBe(2000);
  });
  it('役満闲自摸拆分 = 庄付16000/闲付8000', () => {
    const p = buildPayment(8000, false, true);
    expect(p.fromDealer).toBe(16000);
    expect(p.fromNonDealer).toBe(8000);
  });
});

// ── scoreWin 集成：无切上满贯边界（端到端） ─────────────────────────────────
describe('§5 scoreWin 集成·无切上满贯边界', () => {
  it('立直+平和+断幺+宝牌1 = 4番30符荣和（闲）→ 7700（不升满贯）', () => {
    // man234 pin345 sou456 man678 pin88·和 sou6 两面·全简→断幺·全顺数牌雀头两面→平和
    const r = scoreWin(ctx({
      hand14: [1, 2, 3, 11, 12, 13, 21, 22, 23, 5, 6, 7, 16, 16], winTile: 23,
      riichi: true, doraIndicators: [0], // man1→宝man2·手含 man2 ×1 = 宝1
    }));
    expect(r!.fu).toBe(30);
    expect(r!.han).toBe(4); // 立直1+平和1+断幺1+宝1
    expect(r!.points.ron).toBe(7700); // 无切上满贯
    expect(r!.points.total).toBe(7700);
  });
  it('立直+断幺+暗刻+宝牌2 = 4番40符荣和（闲）→ 8000（满贯·自然到顶）', () => {
    // sou222(暗刻) man234 pin345 man678 pin88·和 man6 两面·全简→断幺
    const r = scoreWin(ctx({
      hand14: [19, 19, 19, 1, 2, 3, 11, 12, 13, 5, 6, 7, 16, 16], winTile: 5,
      riichi: true, doraIndicators: [0, 0], // 宝man2 ×1·两指示 = 宝2
    }));
    expect(r!.fu).toBe(40);
    expect(r!.han).toBe(4); // 立直1+断幺1+宝2
    expect(r!.points.ron).toBe(8000); // 满贯定额
  });
});
