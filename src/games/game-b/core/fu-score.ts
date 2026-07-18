// Game B ·《雀宴》麻将核切片④a —— 符计算 + 点数表（headless 纯逻辑核·清单 §4/§5）。
//
// 积木边界（owner 铁令 TS 只补引擎没有的日麻缝·消费既有件不重造）：
//   · 牌码基元 = tiles-def.ts（isTerminalOrHonor 判幺九）；结构类型 = yaku.ts（type-only·无运行时环）。
// 纯函数·零副作用·零随机·零 IO/UI。口径真相 = docs/design/game-b/mahjong-core-tests.md §4/§5：
//   底符 20 + 门前清荣和 +10；平和自摸 20 符（自摸 2 符不计）；七対子 25 符固定；
//   面子符（v1 无杠）明刻中2/幺九4·暗刻中4/幺九8；雀头役牌+2·连风対子+2（R-1·GD-B 2026-07-18 圈定=2符）；
//   待ち 边/嵌/单骑 +2·两面/双碰 0；自摸 +2（平和例外）；符一位切上；**无切上满贯**。
import { isTerminalOrHonor } from './tiles-def.js';
import type { WinContext, Decomp, WinInterp } from './yaku.js';

/** 雀头符：三元/自风/场风 +2；连风(自风==场风) +2（R-1·GD-B 2026-07-18 圈定=2符·对齐雀魂/天凤）；客风/数牌 0。 */
export function pairFu(pairKind: number, ctx: WinContext): number {
  if (pairKind < 27) return 0; // 数牌雀头 0 符
  if (pairKind >= 31) return 2; // 三元牌（白發中）
  const w = pairKind - 27; // 风牌 0東1南2西3北
  const isSeat = w === ctx.seatWind;
  const isRound = w === ctx.roundWind;
  // 连风牌（自风==场风·如东场东家的东对子）：R-1 GD 圈定 **2 符**（雀魂/天凤口径·4符=竞技变体）——
  // 自风+场风各计一次会双 2 符，但标准口径连风雀头**只计一档 2 符**（非叠加）。
  if (isSeat || isRound) return 2;
  return 0; // 客风雀头 0 符
}

/**
 * 符计算（v1 无杠·门前清恒真）。
 * isPinfu=true 时抑制自摸 +2 → 平和自摸恒 20 符；平和荣和走通用式 = 20+10 = 30 符。
 */
export function calcFu(decomp: Decomp, interp: WinInterp, ctx: WinContext, isPinfu: boolean): number {
  if (decomp.form === 'chiitoi') return 25; // 七対子固定 25 符（不加不进位）
  if (decomp.form === 'kokushi') return 20; // 役满不看符·代表值
  let fu = 20; // 底符
  if (!ctx.tsumo) fu += 10; // 门前清荣和 +10（v1 恒门清）
  for (let i = 0; i < decomp.melds.length; i++) {
    const m = decomp.melds[i]!;
    if (m.type !== 'triplet') continue; // 顺子 0 符
    const to = isTerminalOrHonor(m.kind);
    const concealed = ctx.tsumo || i !== interp.ronMinkoIndex; // 荣和双碰该刻→按明刻计
    fu += concealed ? (to ? 8 : 4) : (to ? 4 : 2);
  }
  fu += pairFu(decomp.pair, ctx);
  if (interp.waitType === 'kanchan' || interp.waitType === 'penchan' || interp.waitType === 'tanki') fu += 2; // 边/嵌/单骑
  if (ctx.tsumo && !isPinfu) fu += 2; // 自摸 +2（平和例外）
  return Math.ceil(fu / 10) * 10; // 符一位切上（22→30）
}

/**
 * 番+符 → 基本点 + 档位名。基本点 = 符×2^(2+番)。
 * **无切上满贯**：仅当 raw ≥ 2000 才升满贯（30符4番=1920 不升→7700/庄11600·60符3番同理）。
 * 数え役满（R-8）：13+ 番 = 一倍役满点（base 8000·非三倍满封顶）。
 */
export function limitAndBase(han: number, fu: number): { base: number; limit: string } {
  if (han >= 13) return { base: 8000, limit: '数え役満' }; // R-8 累计役满
  if (han >= 11) return { base: 6000, limit: '三倍満' };
  if (han >= 8) return { base: 4000, limit: '倍満' };
  if (han >= 6) return { base: 3000, limit: '跳満' };
  if (han === 5) return { base: 2000, limit: '満貫' };
  const raw = fu * Math.pow(2, 2 + han);
  if (raw >= 2000) return { base: 2000, limit: '満貫' }; // 40符4番/70符3番… 自然到顶
  return { base: raw, limit: '' };
}

const ceil100 = (x: number): number => Math.ceil(x / 100) * 100; // 百位切上

export interface Payment {
  fromEach?: number; // 庄自摸·闲家每家付
  fromDealer?: number; // 闲自摸·庄家付
  fromNonDealer?: number; // 闲自摸·闲家每家付
  ron?: number; // 荣和·放铳者付总额
  total: number; // 和了家收到总额（不含供托/本场）
}

/**
 * 基本点 → 四家支付（全百位切上）。base 已含役满倍数（役满传 8000×mult）。
 * 闲荣×4·庄荣×6·自摸闲=庄付2×基/闲付1×基·自摸庄=各付2×基。
 */
export function buildPayment(base: number, isDealer: boolean, tsumo: boolean): Payment {
  if (tsumo) {
    if (isDealer) {
      const each = ceil100(base * 2); // 庄自摸·各家付 2×基
      return { fromEach: each, total: each * 3 };
    }
    const fromDealer = ceil100(base * 2); // 闲自摸·庄家付 2×基
    const fromNonDealer = ceil100(base); // 闲自摸·闲家各付 1×基
    return { fromDealer, fromNonDealer, total: fromDealer + fromNonDealer * 2 };
  }
  const ron = ceil100(base * (isDealer ? 6 : 4)); // 庄荣×6·闲荣×4
  return { ron, total: ron };
}
