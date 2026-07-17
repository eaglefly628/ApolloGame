// Game B ·《雀宴》麻将核切片③ —— 局状态机（发牌→摸打→自摸/荣和→流局→结算→连庄·headless）。
//
// 积木边界（owner 铁令 TS 只补引擎没有的日麻缝·消费既有件不重造）：
//   洗牌/骰/派生 = `wall.ts`（引擎 w1-random 种子 PRNG）· 和了/听牌 = `hand-eval.ts`（§2）·
//   牌码/基元 = `tiles-def.ts`· 随机 = 引擎 randomInt（AI tiebreak·禁裸 Math.random）。
// 本文件补的缝 = 「一局的回合流程」：摸→打→他家荣和检测→轮转→流局→点数移动→连庄/进局。
//   ⚠ 点数=**简版占位固定分**（让循环转起来·可玩可见）；真役/符/番计分=§3（裁决行待 GD-B 会审）。
//   ⚠ AI=**简版进张启发**（打孤张·PRNG tiebreak）；真人设 BT=gdd §五 t2-behavior-tree（B-006 记债）。
//   鸣牌（吃碰杠）/立直/振听 = 后续切片（本切片=摸切打循环 + 门清和了·先让一局能跑通打穿）。
import { randomInt, type RandomSeed } from '@atom-skills/random/index.js';
import { kindOf, isTerminalOrHonor } from './tiles-def.js';
import { dealWall } from './wall.js';
import { isWinningHand, tenpai } from './hand-eval.js';
import { doraFromIndicator } from './wall.js';
import { GameLog } from './game-log.js';

export type Phase = 'playing' | 'win' | 'draw';

export interface RoundResult {
  type: 'tsumo' | 'ron' | 'draw';
  winner: number | null; // 和了家 seat
  loser: number | null; // 放铳家 seat（ron）
  winTile: number | null;
  delta: number[]; // 四家点数变动（Σ=0）
  tenpaiFlags?: boolean[]; // 流局各家听牌
  handSnapshot?: number[]; // 和了手（含和牌·结算面板用）
  stripped?: number[]; // 本局各家脱衣件数（直击制·gdd §七）
}

export interface RoundState {
  hands: number[][]; // 四家暗手（升序·不含 drawn）
  rivers: number[][]; // 四家牌河（打出序）
  wall: number[]; // 活山摸序（shift 取）
  dead: number[]; // 王牌
  doraInd: number[]; // 宝牌指示牌（翻开·初始 1）
  turn: number; // 当前行动 seat
  drawn: number | null; // 当前 turn 刚摸的牌（待打）；null=已打待下家摸
  lastDiscard: number | null; // 最近打出的牌（荣和/UI 高亮）
  phase: Phase;
  result: RoundResult | null;
  dealer: number;
}

export interface MatchState {
  scores: number[]; // 四家点数（gdd 起点 50000）
  roundNo: number; // 东风战 1-4
  honba: number; // 本场
  kyotaku: number; // 供托（立直棒·简版预留）
  dealer: number; // 庄家 seat
  rng: RandomSeed; // 唯一随机源（SessionIn.seed 派生）
  seatNames: string[]; // 四席名（['主角','绫','莉世','小夜']）
  clothing: number[]; // 四家剩余衣物件数（gdd §七·主角=PLAYER_SEAT 豁免不脱）
  cur: RoundState;
  log: GameLog;
  over: boolean; // 整场终（东4 打完 / 击飞）
}

const STARTING = 50000; // gdd 起点
const PLAYER_SEAT = 0; // 玩家席（南/主角）
export const STRIP_ITEMS = 5; // 每姨太衣物件数（gdd §三 ⚙ 5 件·簪/打挂/帯/襦袢/足袋）
/** 衣物件名（席位卡衣物章·剩余亮/脱掉熄灭）。 */
export const CLOTH_LABELS = ['簪', '掛', '帯', '襦', '足'] as const;

/** 座风：dealer=东·逆时针 → 0东1南2西3北。 */
export function seatWind(seat: number, dealer: number): number {
  return (seat - dealer + 4) % 4;
}
const WIND_NAME = ['東', '南', '西', '北'];
const roundName = (m: MatchState): string => `東${m.roundNo}局`;

/** 开一场（东风战·发东1局）。 */
export function startMatch(seed: number, seatNames = ['主角', '绫', '莉世', '小夜']): MatchState {
  const m: MatchState = {
    scores: [STARTING, STARTING, STARTING, STARTING],
    roundNo: 1,
    honba: 0,
    kyotaku: 0,
    dealer: 0,
    rng: { type: 'RandomSeed', seed, sequence: 0 },
    seatNames,
    clothing: [STRIP_ITEMS, STRIP_ITEMS, STRIP_ITEMS, STRIP_ITEMS], // 主角(0)满且豁免·姨太可脱
    cur: null as unknown as RoundState,
    log: new GameLog(),
    over: false,
  };
  startRound(m);
  return m;
}

/** 发一局（配牌 + 庄家首摸）。 */
export function startRound(m: MatchState): void {
  const seed = randomInt(m.rng, 0, 0x7fffffff); // 每局派生子 seed（单 seed 贯穿）
  const deal = dealWall({ seed, akaDora: true });
  m.cur = {
    hands: deal.hands.map((h) => [...h]),
    rivers: [[], [], [], []],
    wall: [...deal.drawWall],
    dead: deal.deadWall,
    doraInd: [deal.doraIndicator],
    turn: m.dealer,
    drawn: null,
    lastDiscard: null,
    phase: 'playing',
    result: null,
    dealer: m.dealer,
  };
  m.log.push({ round: roundName(m), actor: '系统', kind: 'round', text: `开局·庄=${m.seatNames[m.dealer]}·本场 ${m.honba}` });
  m.log.push({ round: roundName(m), actor: '系统', kind: 'dora', text: `宝牌指示=${labelTile(deal.doraIndicator)}（宝牌=${labelTile(doraFromIndicator(deal.doraIndicator))}）` });
  drawTile(m); // 庄家首摸
}

/** 当前 turn 摸一张（活山空→流局）。 */
function drawTile(m: MatchState): void {
  const rs = m.cur;
  if (rs.wall.length === 0) { ryuukyoku(m); return; }
  rs.drawn = rs.wall.shift()!;
  m.log.push({ round: roundName(m), actor: m.seatNames[rs.turn]!, kind: 'draw', text: `摸 ${labelTile(rs.drawn)}（余 ${rs.wall.length}）`, tile: rs.drawn });
}

/** 当前 turn 是否可自摸（门清·纯形·§3 加役闸）。 */
export function canTsumo(m: MatchState): boolean {
  const rs = m.cur;
  return rs.phase === 'playing' && rs.drawn !== null && isWinningHand([...rs.hands[rs.turn]!, rs.drawn]);
}

/** 宣告自摸和了。 */
export function declareTsumo(m: MatchState): void {
  const rs = m.cur;
  if (!canTsumo(m)) return;
  const winHand = [...rs.hands[rs.turn]!, rs.drawn!];
  settleWin(m, 'tsumo', rs.turn, null, rs.drawn!, winHand);
}

/** 打出一张（tileCode 可为 drawn=摸切 或手牌任一=手切）。检测他家荣和→否则下家摸。 */
export function discard(m: MatchState, tileCode: number): void {
  const rs = m.cur;
  if (rs.phase !== 'playing' || rs.drawn === null) return;
  const full = [...rs.hands[rs.turn]!, rs.drawn];
  const idx = full.indexOf(tileCode);
  if (idx < 0) return; // 非法牌·忽略
  full.splice(idx, 1);
  rs.hands[rs.turn] = full.sort((a, b) => kindOf(a) - kindOf(b) || a - b);
  rs.drawn = null;
  rs.rivers[rs.turn]!.push(tileCode);
  rs.lastDiscard = tileCode;
  m.log.push({ round: roundName(m), actor: m.seatNames[rs.turn]!, kind: 'discard', text: `打 ${labelTile(tileCode)}`, tile: tileCode });

  // 他家荣和检测（逆时针近家优先·单荣·多家荣和=§3 双响裁决）；振听家禁荣（舍张振听·防非法荣和）。
  for (let off = 1; off <= 3; off++) {
    const i = (rs.turn + off) % 4;
    if (isWinningHand([...rs.hands[i]!, tileCode]) && !isFuriten(m, i)) {
      settleWin(m, 'ron', i, rs.turn, tileCode, [...rs.hands[i]!, tileCode]);
      return;
    }
  }
  // 无荣和·轮转下家摸
  rs.turn = (rs.turn + 1) % 4;
  drawTile(m);
}

/** 简版结算（占位固定分·让点数动起来·§3 真役符替换）。 */
function settleWin(m: MatchState, type: 'tsumo' | 'ron', winner: number, loser: number | null, tile: number, winHand: number[]): void {
  const rs = m.cur;
  const isDealer = winner === m.dealer;
  const delta = [0, 0, 0, 0];
  const honbaEach = m.honba * 100; // 自摸每家 +100/本场
  const honbaRon = m.honba * 300; // 荣和放铳 +300/本场
  if (type === 'tsumo') {
    for (let i = 0; i < 4; i++) {
      if (i === winner) continue;
      const base = isDealer ? 2000 : (i === m.dealer ? 2000 : 1000); // 占位：庄自摸各付2000·闲自摸庄付2000他闲付1000
      const pay = base + honbaEach;
      delta[i]! -= pay;
      delta[winner]! += pay;
    }
  } else {
    const base = (isDealer ? 7700 : 5200) + honbaRon; // 占位：闲和放铳付5200·庄和放铳付7700
    delta[loser!]! -= base;
    delta[winner]! += base;
  }
  // 供托（立直棒）归和者
  delta[winner]! += m.kyotaku;
  m.kyotaku = 0;
  for (let i = 0; i < 4; i++) m.scores[i]! += delta[i]!;
  rs.result = { type, winner, loser, winTile: tile, delta, handSnapshot: winHand };
  rs.phase = 'win';
  m.log.push({ round: roundName(m), actor: m.seatNames[winner]!, kind: type, text: `${type === 'tsumo' ? '自摸' : '荣和'} ${labelTile(tile)}${loser !== null ? `（放铳=${m.seatNames[loser]}）` : ''}`, tile });
  m.log.push({ round: roundName(m), actor: '系统', kind: 'score', text: `点移 ${delta.map((d, i) => `${m.seatNames[i]}${d >= 0 ? '+' : ''}${d}`).join(' ')}` });
  rs.result!.stripped = applyStrip(m, type, winner, loser); // 直击脱衣（gdd §七）
}

/** 直击脱衣（gdd §七·2026-07-17 定稿）：放铳者脱 1／被自摸支付的三家中姨太各脱 1；
 *  主角(PLAYER_SEAT)豁免不脱·脱光(0)后只扣分不再脱·立直棒/罚符/流局不触发。 */
function applyStrip(m: MatchState, type: 'tsumo' | 'ron', winner: number, loser: number | null): number[] {
  const stripped = [0, 0, 0, 0];
  const strip = (seat: number): void => {
    if (seat === PLAYER_SEAT) return; // 主角豁免
    if (m.clothing[seat]! <= 0) return; // 脱光后不再脱（只扣分）
    m.clothing[seat]!--;
    stripped[seat] = 1;
    m.log.push({ round: roundName(m), actor: m.seatNames[seat]!, kind: 'info', text: `被直击·脱 ${CLOTH_LABELS[STRIP_ITEMS - 1 - m.clothing[seat]!] ?? '衣'}（余 ${m.clothing[seat]} 件）` });
  };
  if (type === 'ron' && loser !== null) strip(loser); // 放铳者脱
  else if (type === 'tsumo') for (let i = 0; i < 4; i++) if (i !== winner) strip(i); // 被自摸三家各脱
  return stripped;
}

/** 舍张振听：某家待ち牌种含其自家牌河任一 → 该家不能荣和（防非法荣和）。 */
export function isFuriten(m: MatchState, seat: number): boolean {
  const waits = tenpai(m.cur.hands[seat]!);
  if (waits.length === 0) return false;
  const river = m.cur.rivers[seat]!.map((c) => kindOf(c));
  return waits.some((w) => river.includes(w));
}

/** 荒牌流局（听牌罚符 3000·标准分配）。 */
function ryuukyoku(m: MatchState): void {
  const rs = m.cur;
  const tp = rs.hands.map((h) => tenpai(h).length > 0);
  const nTen = tp.filter(Boolean).length;
  const delta = [0, 0, 0, 0];
  if (nTen > 0 && nTen < 4) {
    const recv = Math.round(3000 / nTen);
    const pay = Math.round(3000 / (4 - nTen));
    for (let i = 0; i < 4; i++) delta[i]! += tp[i] ? recv : -pay;
  }
  for (let i = 0; i < 4; i++) m.scores[i]! += delta[i]!;
  rs.result = { type: 'draw', winner: null, loser: null, winTile: null, delta, tenpaiFlags: tp };
  rs.phase = 'draw';
  m.log.push({ round: roundName(m), actor: '系统', kind: 'ryuukyoku', text: `荒牌流局·听牌 ${tp.map((t, i) => (t ? m.seatNames[i] : null)).filter(Boolean).join('/') || '无'}` });
  if (delta.some((d) => d !== 0)) m.log.push({ round: roundName(m), actor: '系统', kind: 'score', text: `罚符 ${delta.map((d, i) => `${m.seatNames[i]}${d >= 0 ? '+' : ''}${d}`).join(' ')}` });
}

/** 一局终 → 连庄判定 + 进局 / 整场终（东4 打完 / 击飞<0）。返回是否整场结束。 */
export function nextRound(m: MatchState): boolean {
  const rs = m.cur;
  if (rs.phase === 'playing') return false;
  const r = rs.result!;
  const dealerKept = r.type === 'draw' ? !!r.tenpaiFlags?.[m.dealer] : r.winner === m.dealer;
  // 击飞（gdd ⚙ 点数<0 即全场终）
  if (m.scores.some((s) => s < 0)) {
    m.over = true;
    m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: '击飞·整场终局' });
    return true;
  }
  if (dealerKept) {
    m.honba++;
    m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: `连庄（本场 ${m.honba}）` });
  } else {
    m.honba = 0;
    if (m.roundNo >= 4) { // 东4 非连庄打完 → 终局
      m.over = true;
      m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: '东风战终局' });
      return true;
    }
    m.roundNo++;
    m.dealer = (m.dealer + 1) % 4;
  }
  startRound(m);
  return false;
}

// ── AI（简版进张启发·打孤张·PRNG tiebreak·记债换 t2-behavior-tree gdd §五/B-006）──────────
/** 一张牌在手中的保留价值（越低越先打·孤立幺九/字牌最低）。 */
function tileValue(code: number, hand: number[]): number {
  const k = kindOf(code);
  const cntSame = hand.filter((x) => kindOf(x) === k).length; // 含自身
  let v = (cntSame - 1) * 4; // 对子/刻子搭
  if (k < 27) {
    const n = k % 9;
    const has = (kk: number): boolean => n >= 0 && hand.some((x) => kindOf(x) === kk);
    if (n >= 1 && has(k - 1)) v += 2; // 相邻（两面/边张搭）
    if (n <= 7 && has(k + 1)) v += 2;
    if (n >= 2 && has(k - 2)) v += 1; // 隔一（嵌张搭）
    if (n <= 6 && has(k + 2)) v += 1;
    if (n >= 2 && n <= 6) v += 1; // 中张微权（留好用张）
  }
  if (isTerminalOrHonor(code)) v -= 1; // 幺九字牌略贬（优先舍）
  return v;
}

/** AI 选打哪张（当前 turn·含 drawn·价值最低者·PRNG tiebreak）。 */
export function aiChooseDiscard(m: MatchState): number {
  const rs = m.cur;
  const full = [...rs.hands[rs.turn]!, rs.drawn!];
  const uniq = [...new Set(full)];
  let worst = full[0]!;
  let worstVal = Infinity;
  for (const t of uniq) {
    const v = tileValue(t, full);
    if (v < worstVal || (v === worstVal && randomInt(m.rng, 0, 2) === 0)) {
      worst = t;
      worstVal = v;
    }
  }
  return worst;
}

/** 当前 turn 走一步 AI（自摸则宣·否则选牌打）。用于 AI 席 + headless walkthrough。 */
export function aiTurn(m: MatchState): void {
  if (m.cur.phase !== 'playing') return;
  if (canTsumo(m)) { declareTsumo(m); return; }
  discard(m, aiChooseDiscard(m));
}

/** 是否轮到玩家行动（UI：等玩家点牌/自摸）。 */
export function isPlayerTurn(m: MatchState): boolean {
  return m.cur.phase === 'playing' && m.cur.turn === PLAYER_SEAT && m.cur.drawn !== null;
}

/** 本局是否已终（和了/流局·UI 弹结算浮层）。 */
export function isWinLikeEnd(m: MatchState): boolean {
  return m.cur.phase === 'win' || m.cur.phase === 'draw';
}

/** UI 驱动：自动推进 AI 席直到轮到玩家 或 本局终。 */
export function runUntilPlayerOrEnd(m: MatchState, maxSteps = 200): void {
  let n = 0;
  while (m.cur.phase === 'playing' && m.cur.turn !== PLAYER_SEAT && n++ < maxSteps) {
    aiTurn(m);
  }
}

// ── 展示辅助 ───────────────────────────────────────────────────────────────
const NUM_LABEL = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 牌码 → 短标签（日志/字幕·如 5万/③筒/7索/東/中·赤5 带 赤）。 */
export function labelTile(code: number): string {
  const k = kindOf(code);
  const red = code >= 100 ? '赤' : '';
  if (k < 9) return `${red}${NUM_LABEL[k]}萬`;
  if (k < 18) return `${red}${k - 9 + 1}筒`;
  if (k < 27) return `${red}${k - 18 + 1}索`;
  return ['東', '南', '西', '北', '白', '發', '中'][k - 27]!;
}
export { WIND_NAME, PLAYER_SEAT };
