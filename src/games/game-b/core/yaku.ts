// Game B ·《雀宴》麻将核切片④ —— 役种识别 + 番/符/点结算（headless 纯逻辑核·清单 §3/§4/§5）。
//
// 积木边界（owner 铁令 TS 只补引擎没有的日麻缝·消费既有件不重造）：
//   · 牌码/基元 = tiles-def.ts（kindOf/isRed/isTerminalOrHonor/tileNumber）；
//   · 宝牌 = wall.ts 的 doraFromIndicator；符/点 = fu-score.ts。
//   · 和了形分解由本文件枚举（hand-eval 只判 bool·不返回面子分解）。
// v1 **纯门清**（无鸣牌·无杠）：所有和牌手门前清 → 无喰い下がり（全按门清满番）；
//   门清自摸和恒成立（自摸时）；无杠 → 无岭上/杠子符/杠宝；四暗刻=4 暗刻（门清天然全暗）。
// 取高原则：一手多种分解/解释（二盃口 vs 七対·嵌张 vs 两面）取番符最高解（比点数总额）。
// 纯函数·零副作用·零随机·零引擎依赖（只 import tiles-def/wall/fu-score）。
// 口径真相 = docs/design/game-b/mahjong-core-tests.md §3；裁决行 R-1(连风雀头符=2·yaku 层場風+自風双计)/R-7(单倍役满)/R-8(累计役满)。
import { kindOf, isRed, isTerminalOrHonor, tileNumber, NUM_KINDS } from './tiles-def.js';
import { doraFromIndicator } from './wall.js';
import { calcFu, limitAndBase, buildPayment, pairFu, type Payment } from './fu-score.js';

// ── 对外契约 ───────────────────────────────────────────────────────────────
export interface WinContext {
  hand14: number[]; // 14 张和了手（含和了牌·升序无所谓）
  winTile: number; // 和了牌码
  tsumo: boolean; // true=自摸 / false=荣和
  seatWind: number; // 自风 0-3（東南西北）
  roundWind: number; // 场风（东风战恒 0=東）
  isDealer: boolean; // 和了家是否庄家
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  haitei: boolean; // 海底(自摸)/河底(荣和)
  doraIndicators: number[]; // 表宝牌指示牌
  uraIndicators: number[]; // 里宝牌指示牌（仅立直和了计·未立直传 []）
  tenhou?: boolean; // 天和（庄家第一巡自摸·调用方判定置位）——签名微调（WinContext 无第一巡信息·外部注入）
  chiihou?: boolean; // 地和（闲家第一巡自摸无鸣·调用方判定置位）——签名微调
  chankan?: boolean; // 槍槓（抢加杠·荣和限定 1 番·外部注入·D5b）
  rinshan?: boolean; // 嶺上開花（杠后岭上自摸 1 番·外部注入·D5a）
}

export interface YakuEntry {
  name: string;
  han: number;
}
export interface ScoreResult {
  yaku: YakuEntry[]; // 役种明细（含宝牌/赤/里=名+番·但宝牌不成役）
  han: number; // 总番（含宝牌·役满时为 0）
  fu: number; // 符（役满/满贯档不看符·填代表值）
  yakuman: number; // 役满倍数（0=非役满/数え·1=单倍·2=两倍…）
  points: Payment; // 点数支付（调用方按此结算四家 ±·加供托/本场）
}

// ── 内部分解结构 ────────────────────────────────────────────────────────────
export interface Meld {
  type: 'seq' | 'triplet';
  kind: number; // seq=最低牌种码·triplet=牌种码
}
export interface Decomp {
  form: 'standard' | 'chiitoi' | 'kokushi';
  melds: Meld[]; // standard=4 面子·chiitoi/kokushi=[]
  pair: number; // standard=雀头种·kokushi=成对幺九·chiitoi=-1
  pairs?: number[]; // chiitoi=7 对子种
}
export interface WinInterp {
  waitType: 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon';
  ronMinkoIndex: number; // 荣和双碰化明刻的 meld 下标（自摸/非双碰=-1）
}

const DRAGONS = [31, 32, 33]; // 白發中
const GREEN = new Set([19, 20, 21, 23, 25, 32]); // sou2,3,4,6,8,發（绿一色成分·标准含发）
const KOKUSHI_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; // 13 幺九
const WIND = ['東', '南', '西', '北'];

// ── 和了形分解枚举 ─────────────────────────────────────────────────────────
function toCounts(tiles: number[]): number[] {
  const c = new Array<number>(NUM_KINDS).fill(0);
  for (const t of tiles) c[kindOf(t)]!++;
  return c;
}

/** 就地增删还原·穷举「余牌拆成若干面子」的全部方式（最低未消耗牌为面子起点·完备）。 */
function enumMelds(counts: number[]): Meld[][] {
  let i = 0;
  while (i < NUM_KINDS && counts[i] === 0) i++;
  if (i === NUM_KINDS) return [[]]; // 拆净 → 一种空解
  const out: Meld[][] = [];
  if (counts[i]! >= 3) {
    counts[i]! -= 3;
    for (const rest of enumMelds(counts)) out.push([{ type: 'triplet', kind: i }, ...rest]);
    counts[i]! += 3;
  }
  if (i < 27 && i % 9 <= 6 && counts[i + 1]! > 0 && counts[i + 2]! > 0) {
    counts[i]!--; counts[i + 1]!--; counts[i + 2]!--;
    for (const rest of enumMelds(counts)) out.push([{ type: 'seq', kind: i }, ...rest]);
    counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
  }
  return out;
}

/** 国士无双分解（13 幺九各 ≥1·恰一对·无非幺九）。 */
function enumKokushi(counts: number[]): Decomp[] {
  for (let k = 0; k < NUM_KINDS; k++) {
    if (!KOKUSHI_KINDS.includes(k) && counts[k]! !== 0) return [];
  }
  let pair = -1;
  for (const k of KOKUSHI_KINDS) {
    const c = counts[k]!;
    if (c < 1) return [];
    if (c === 2) { if (pair !== -1) return []; pair = k; }
    else if (c !== 1) return [];
  }
  return pair === -1 ? [] : [{ form: 'kokushi', melds: [], pair }];
}

/** 枚举 14 张的全部和了分解（标准形所有雀头×面子解 + 七対子 + 国士·去重）。 */
function enumDecomps(counts: number[]): Decomp[] {
  const results: Decomp[] = [];
  for (let p = 0; p < NUM_KINDS; p++) {
    if (counts[p]! >= 2) {
      counts[p]! -= 2;
      for (const melds of enumMelds(counts)) {
        if (melds.length === 4) results.push({ form: 'standard', melds, pair: p });
      }
      counts[p]! += 2;
    }
  }
  // 七対子（恰 7 个不同对子·四枚同牌≠两对）
  const pairs: number[] = [];
  let chiitoiOk = true;
  for (let k = 0; k < NUM_KINDS; k++) {
    if (counts[k] === 0) continue;
    if (counts[k] === 2) pairs.push(k);
    else { chiitoiOk = false; break; }
  }
  if (chiitoiOk && pairs.length === 7) results.push({ form: 'chiitoi', melds: [], pair: -1, pairs });
  results.push(...enumKokushi(counts));

  const seen = new Set<string>();
  const uniq: Decomp[] = [];
  for (const d of results) {
    const key = `${d.form}|${d.pair}|${d.pairs?.join(',') ?? ''}|${d.melds.map((m) => m.type + m.kind).join(',')}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(d); }
  }
  return uniq;
}

/** 某分解下·和了牌可落在哪些面子/雀头 → 逐一枚举待ち解释（取高原则由上层比点数）。 */
function interpsFor(d: Decomp, w: number): WinInterp[] {
  if (d.form !== 'standard') return [{ waitType: 'tanki', ronMinkoIndex: -1 }];
  const out: WinInterp[] = [];
  if (d.pair === w) out.push({ waitType: 'tanki', ronMinkoIndex: -1 });
  for (let i = 0; i < d.melds.length; i++) {
    const m = d.melds[i]!;
    if (m.type === 'triplet') {
      if (m.kind === w) out.push({ waitType: 'shanpon', ronMinkoIndex: i });
    } else {
      const b = m.kind;
      if (w >= b && w <= b + 2 && Math.floor(b / 9) === Math.floor(w / 9)) {
        let wt: WinInterp['waitType'];
        if (w === b + 1) wt = 'kanchan';
        else if (w === b && tileNumber(b) === 7) wt = 'penchan'; // 789 待 7（曾持 89）
        else if (w === b + 2 && tileNumber(b) === 1) wt = 'penchan'; // 123 待 3（曾持 12）
        else wt = 'ryanmen';
        out.push({ waitType: wt, ronMinkoIndex: -1 });
      }
    }
  }
  return out.length > 0 ? out : [{ waitType: 'ryanmen', ronMinkoIndex: -1 }];
}

// ── 结构谓词 ───────────────────────────────────────────────────────────────
function anyIn(counts: number[], lo: number, hi: number): boolean {
  for (let k = lo; k <= hi; k++) if (counts[k]! > 0) return true;
  return false;
}
function allNonzero(counts: number[], pred: (k: number) => boolean): boolean {
  for (let k = 0; k < NUM_KINDS; k++) if (counts[k]! > 0 && !pred(k)) return false;
  return true;
}
function countConcealedTriplets(d: Decomp, interp: WinInterp, ctx: WinContext): number {
  let n = 0;
  for (let i = 0; i < d.melds.length; i++) {
    if (d.melds[i]!.type !== 'triplet') continue;
    if (ctx.tsumo || i !== interp.ronMinkoIndex) n++;
  }
  return n;
}
/** 三色同顺：三花色各有一同 rel 起手顺子。 */
function hasSanshokuSeq(seqs: Meld[]): boolean {
  const bySuit: Set<number>[] = [new Set(), new Set(), new Set()];
  for (const s of seqs) bySuit[Math.floor(s.kind / 9)]!.add(s.kind % 9);
  for (const rel of bySuit[0]!) if (bySuit[1]!.has(rel) && bySuit[2]!.has(rel)) return true;
  return false;
}
/** 一気通貫：某花色齐 123/456/789（rel 0,3,6）。 */
function hasIttsuu(seqs: Meld[]): boolean {
  for (let suit = 0; suit < 3; suit++) {
    const rels = new Set(seqs.filter((s) => Math.floor(s.kind / 9) === suit).map((s) => s.kind % 9));
    if (rels.has(0) && rels.has(3) && rels.has(6)) return true;
  }
  return false;
}
/** 三色同刻：三花色各有一同 rel 刻子。 */
function hasSanshokuTriplet(trips: Meld[]): boolean {
  const bySuit: Set<number>[] = [new Set(), new Set(), new Set()];
  for (const t of trips) { if (t.kind < 27) bySuit[Math.floor(t.kind / 9)]!.add(t.kind % 9); }
  for (const rel of bySuit[0]!) if (bySuit[1]!.has(rel) && bySuit[2]!.has(rel)) return true;
  return false;
}
/** 面子含幺九（chanta/junchan 成分）：刻子看牌种·顺子看是否含 1/9（rel 0 或 6）。 */
function setHasTermHonor(m: Meld): boolean {
  if (m.type === 'triplet') return isTerminalOrHonor(m.kind);
  const rel = m.kind % 9; // seq kind<27
  return rel === 0 || rel === 6;
}

// ── 宝牌 ───────────────────────────────────────────────────────────────────
function countDoraHan(hand14: number[], indicators: number[]): number {
  let n = 0;
  for (const ind of indicators) {
    const dk = doraFromIndicator(ind);
    for (const t of hand14) if (kindOf(t) === dk) n++;
  }
  return n;
}

// ── 单解释评分 ─────────────────────────────────────────────────────────────
function evalInterp(
  d: Decomp,
  interp: WinInterp,
  ctx: WinContext,
  counts: number[],
  doraHan: number,
  akaHan: number,
  uraHan: number,
): ScoreResult | null {
  const yaku: YakuEntry[] = [];
  let yakuman = 0;

  // 全局花色/幺九旗标
  const hasMan = anyIn(counts, 0, 8);
  const hasPin = anyIn(counts, 9, 17);
  const hasSou = anyIn(counts, 18, 26);
  const hasHonor = anyIn(counts, 27, 33);
  const numSuits = (hasMan ? 1 : 0) + (hasPin ? 1 : 0) + (hasSou ? 1 : 0);
  const allTermHonor = allNonzero(counts, (k) => isTerminalOrHonor(k));
  const allHonor = allNonzero(counts, (k) => k >= 27);
  const allTermNum = allNonzero(counts, (k) => k < 27 && (tileNumber(k) === 1 || tileNumber(k) === 9));
  const allGreen = allNonzero(counts, (k) => GREEN.has(k));
  const isTanyao = allNonzero(counts, (k) => !isTerminalOrHonor(k));

  // ── 役满（优先·命中即忽略普通役）───────────────────────────────────────
  if (ctx.tsumo && ctx.tenhou && ctx.isDealer) { yaku.push({ name: '天和', han: 0 }); yakuman++; }
  else if (ctx.tsumo && ctx.chiihou && !ctx.isDealer) { yaku.push({ name: '地和', han: 0 }); yakuman++; }
  if (d.form === 'kokushi') { yaku.push({ name: '国士無双', han: 0 }); yakuman++; } // R-7 单倍（13 面不做 W）
  if (allHonor) { yaku.push({ name: '字一色', han: 0 }); yakuman++; }
  if (allTermNum) { yaku.push({ name: '清老頭', han: 0 }); yakuman++; }
  if (allGreen) { yaku.push({ name: '緑一色', han: 0 }); yakuman++; }
  if (d.form === 'standard') {
    const trips = d.melds.filter((m) => m.type === 'triplet');
    const concealed = countConcealedTriplets(d, interp, ctx);
    if (trips.length === 4 && concealed === 4) { yaku.push({ name: '四暗刻', han: 0 }); yakuman++; } // R-7 单倍
    if (trips.filter((m) => DRAGONS.includes(m.kind)).length === 3) { yaku.push({ name: '大三元', han: 0 }); yakuman++; }
    const windTrip = trips.filter((m) => m.kind >= 27 && m.kind < 31).length;
    const pairIsWind = d.pair >= 27 && d.pair < 31;
    if (windTrip === 4) { yaku.push({ name: '大四喜', han: 0 }); yakuman++; } // R-7 单倍
    else if (windTrip === 3 && pairIsWind) { yaku.push({ name: '小四喜', han: 0 }); yakuman++; }
  }
  if (yakuman > 0) {
    const fu = calcFu(d, interp, ctx, false);
    return { yaku, han: 0, fu, yakuman, points: buildPayment(8000 * yakuman, ctx.isDealer, ctx.tsumo) };
  }

  // ── 普通役 ─────────────────────────────────────────────────────────────
  if (ctx.doubleRiichi) yaku.push({ name: '両立直', han: 2 });
  else if (ctx.riichi) yaku.push({ name: '立直', han: 1 });
  if (ctx.ippatsu && (ctx.riichi || ctx.doubleRiichi)) yaku.push({ name: '一発', han: 1 });
  if (ctx.tsumo) yaku.push({ name: '門前清自摸和', han: 1 }); // v1 恒门清
  if (ctx.haitei) yaku.push({ name: ctx.tsumo ? '海底摸月' : '河底撈魚', han: 1 });
  if (ctx.chankan && !ctx.tsumo) yaku.push({ name: '槍槓', han: 1 }); // 抢加杠（荣和限定·D5b）
  if (ctx.rinshan && ctx.tsumo) yaku.push({ name: '嶺上開花', han: 1 }); // 杠后岭上自摸（D5a）
  if (isTanyao) yaku.push({ name: '断幺九', han: 1 });
  if (numSuits === 1 && hasHonor) yaku.push({ name: '混一色', han: 3 });
  else if (numSuits === 1 && !hasHonor) yaku.push({ name: '清一色', han: 6 });
  if (allTermHonor) yaku.push({ name: '混老頭', han: 2 }); // 役满字一色/清老頭已先返回·此处必混

  let isPinfu = false;
  if (d.form === 'chiitoi') {
    yaku.push({ name: '七対子', han: 2 });
  } else if (d.form === 'standard') {
    const seqs = d.melds.filter((m) => m.type === 'seq');
    const trips = d.melds.filter((m) => m.type === 'triplet');
    const concealed = countConcealedTriplets(d, interp, ctx);

    isPinfu = seqs.length === 4 && pairFu(d.pair, ctx) === 0 && interp.waitType === 'ryanmen';
    if (isPinfu) yaku.push({ name: '平和', han: 1 });

    const seqCount = new Map<number, number>();
    for (const s of seqs) seqCount.set(s.kind, (seqCount.get(s.kind) ?? 0) + 1);
    let iipeiPairs = 0;
    for (const v of seqCount.values()) iipeiPairs += Math.floor(v / 2);
    if (iipeiPairs >= 2) yaku.push({ name: '二盃口', han: 3 }); // 与一盃口/七対互斥·取高由上层
    else if (iipeiPairs === 1) yaku.push({ name: '一盃口', han: 1 });

    if (hasSanshokuSeq(seqs)) yaku.push({ name: '三色同順', han: 2 });
    if (hasIttsuu(seqs)) yaku.push({ name: '一気通貫', han: 2 });
    if (hasSanshokuTriplet(trips)) yaku.push({ name: '三色同刻', han: 2 });

    const everyTermHonor = d.melds.every(setHasTermHonor) && isTerminalOrHonor(d.pair);
    if (everyTermHonor && seqs.length >= 1) {
      if (!hasHonor) yaku.push({ name: '純全帯么九', han: 3 });
      else yaku.push({ name: '混全帯么九', han: 2 });
    }

    if (trips.length === 4) yaku.push({ name: '対々和', han: 2 });
    if (concealed >= 3) yaku.push({ name: '三暗刻', han: 2 });

    for (const t of trips) {
      if (t.kind === 31) yaku.push({ name: '役牌 白', han: 1 });
      else if (t.kind === 32) yaku.push({ name: '役牌 發', han: 1 });
      else if (t.kind === 33) yaku.push({ name: '役牌 中', han: 1 });
      else if (t.kind >= 27) {
        const wv = t.kind - 27;
        if (wv === ctx.roundWind) yaku.push({ name: `場風 ${WIND[wv]}`, han: 1 });
        if (wv === ctx.seatWind) yaku.push({ name: `自風 ${WIND[wv]}`, han: 1 }); // 连风→场风+自风双计（R-1）
      }
    }
    if (trips.filter((m) => DRAGONS.includes(m.kind)).length === 2 && DRAGONS.includes(d.pair)) {
      yaku.push({ name: '小三元', han: 2 });
    }
  }

  const yakuHan = yaku.reduce((s, y) => s + y.han, 0);
  if (yakuHan === 0) return null; // 无役（含光宝牌）→ 1 番缚·不得和

  if (doraHan > 0) yaku.push({ name: '宝牌', han: doraHan });
  if (akaHan > 0) yaku.push({ name: '赤宝牌', han: akaHan });
  if (uraHan > 0) yaku.push({ name: '裏宝牌', han: uraHan });
  const totalHan = yakuHan + doraHan + akaHan + uraHan;
  const fu = calcFu(d, interp, ctx, isPinfu);
  const { base } = limitAndBase(totalHan, fu);
  return { yaku, han: totalHan, fu, yakuman: 0, points: buildPayment(base, ctx.isDealer, ctx.tsumo) };
}

/** a 是否比 b 优（役满>点数>番>符）。 */
function better(a: ScoreResult, b: ScoreResult): boolean {
  if (a.yakuman !== b.yakuman) return a.yakuman > b.yakuman;
  if (a.points.total !== b.points.total) return a.points.total > b.points.total;
  if (a.han !== b.han) return a.han > b.han;
  return a.fu > b.fu;
}

/** 算一次和了的番/符/点。无役（含光宝牌）→ 返回 null（1 番缚·不得和）。 */
export function scoreWin(ctx: WinContext): ScoreResult | null {
  if (ctx.hand14.length !== 14) return null;
  const counts = toCounts(ctx.hand14);
  const decomps = enumDecomps(counts);
  if (decomps.length === 0) return null;
  const w = kindOf(ctx.winTile);
  const doraHan = countDoraHan(ctx.hand14, ctx.doraIndicators);
  const akaHan = ctx.hand14.filter(isRed).length; // 赤5 每枚 +1
  const uraHan = (ctx.riichi || ctx.doubleRiichi) ? countDoraHan(ctx.hand14, ctx.uraIndicators) : 0;

  let best: ScoreResult | null = null;
  for (const d of decomps) {
    for (const interp of interpsFor(d, w)) {
      const r = evalInterp(d, interp, ctx, counts, doraHan, akaHan, uraHan);
      if (r && (best === null || better(r, best))) best = r;
    }
  }
  return best;
}
