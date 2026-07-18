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
import { isWinningHand, tenpai, winsWithMelds, tenpaiWithMelds } from './hand-eval.js';
import { doraFromIndicator } from './wall.js';
import { GameLog } from './game-log.js';
import type { Meld } from './meld.js';
import { chiCandidates, canPon, resolveClaims, kuikaeForbidden, type ChiCandidate, type CallClaim } from './calls.js';

export type Phase = 'playing' | 'win' | 'draw';

/** 玩家（seat 0）对某弃牌的可鸣选项（P4 HUD 亮按钮·P3a 碰/吃；杠=P3b）。 */
export interface PlayerCallOptions {
  ron: boolean;
  pon: boolean;
  chi: ChiCandidate[]; // 可吃搭子候选（≥2 需选一）
}
/** 鸣牌窗口：某家弃牌后暂停·玩家(0)待决；AI(1-3)主张已算入 pending，待玩家决定后统一裁优先级。 */
export interface CallWindow {
  discarder: number; // 弃牌者
  tile: number; // 被鸣候选牌码
  options: PlayerCallOptions; // 玩家可选
  pending: CallClaim[]; // 已决 AI 主张（碰/荣·P3a 无 AI 吃/杠）
}

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
  hands: number[][]; // 四家暗手（升序·不含 drawn·不含副露）
  melds: Meld[][]; // 四家副露（吃/碰·杠=P3b）——naki-design §1
  rivers: number[][]; // 四家牌河（打出序）
  wall: number[]; // 活山摸序（shift 取）
  dead: number[]; // 王牌
  doraInd: number[]; // 宝牌指示牌（翻开·初始 1）
  turn: number; // 当前行动 seat
  drawn: number | null; // 当前 turn 刚摸的牌（待打）；null=已打待下家摸 / 鸣牌后待打
  awaitDiscard: boolean; // 鸣牌（碰/吃）后无摸·待鸣家打出（drawn=null 但仍须打）
  forbiddenDiscard: number[]; // 喰い替え禁打牌种（本巡·打出后清空·R-2）
  callWindow: CallWindow | null; // 玩家(0)待鸣窗口（非 null=流程暂停等玩家决定）
  lastDiscard: number | null; // 最近打出的牌（荣和/UI 高亮）
  riichi: boolean[]; // 四家是否已立直（立直后锁摸切·§3 加立直役/一发/裏宝）
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
  interactiveCalls: boolean; // 鸣牌总闸（默认 false=门清兼容路径逐字节等价；P4 UI 置 true 开碰/吃/荣窗口）
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
    interactiveCalls: false, // 默认门清兼容；开鸣牌由 UI/测试显式置 true
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
    melds: [[], [], [], []],
    rivers: [[], [], [], []],
    wall: [...deal.drawWall],
    dead: deal.deadWall,
    doraInd: [deal.doraIndicator],
    turn: m.dealer,
    drawn: null,
    awaitDiscard: false,
    forbiddenDiscard: [],
    callWindow: null,
    lastDiscard: null,
    riichi: [false, false, false, false],
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

/** 当前 turn 是否可自摸（副露感知·melds 空=门清纯形·§3 加役闸）。 */
export function canTsumo(m: MatchState): boolean {
  const rs = m.cur;
  return rs.phase === 'playing' && rs.drawn !== null &&
    winsWithMelds(rs.hands[rs.turn]!, rs.melds[rs.turn]!.length, rs.drawn);
}

/** 宣告自摸和了。 */
export function declareTsumo(m: MatchState): void {
  const rs = m.cur;
  if (!canTsumo(m)) return;
  const winHand = [...rs.hands[rs.turn]!, rs.drawn!];
  settleWin(m, 'tsumo', rs.turn, null, rs.drawn!, winHand);
}

/**
 * 打出一张（tileCode = drawn 摸切 / 手牌任一手切 / 鸣牌后待打）。
 * 打出后开「鸣牌窗口」——非交互（门清兼容）路径 = 与鸣牌前逐字节等价（他家荣→否则下家摸）。
 */
export function discard(m: MatchState, tileCode: number): void {
  const rs = m.cur;
  if (rs.phase !== 'playing' || rs.callWindow !== null) return; // 窗口未决不得打
  if (rs.drawn === null && !rs.awaitDiscard) return; // 无牌可打
  if (rs.forbiddenDiscard.includes(kindOf(tileCode))) return; // 喰い替え禁（R-2·防御·AI/UI 不应给出）
  const full = rs.drawn !== null ? [...rs.hands[rs.turn]!, rs.drawn] : [...rs.hands[rs.turn]!];
  const idx = full.indexOf(tileCode);
  if (idx < 0) return; // 非法牌·忽略
  full.splice(idx, 1);
  rs.hands[rs.turn] = full.sort((a, b) => kindOf(a) - kindOf(b) || a - b);
  rs.drawn = null;
  rs.awaitDiscard = false;
  rs.forbiddenDiscard = [];
  rs.rivers[rs.turn]!.push(tileCode);
  rs.lastDiscard = tileCode;
  m.log.push({ round: roundName(m), actor: m.seatNames[rs.turn]!, kind: 'discard', text: `打 ${labelTile(tileCode)}`, tile: tileCode });
  openCallWindow(m, rs.turn, tileCode);
}

/** 弃牌者到 seat 的逆时针距（1=下家…3=上家）——荣/鸣近家优先裁据。 */
const callOffset = (from: number, seat: number): number => (seat - from + 4) % 4;

/**
 * 弃牌后开鸣牌窗口。
 * · 非交互（m.interactiveCalls=false·当前 UI/门清 walkthrough）：仅他家荣和（近家优先·非振听）→ 否则下家摸——**逐字节等价鸣牌前**。
 * · 交互（P3a+·测试/P4 UI 开）：收集 AI 碰/荣主张 + 玩家可鸣选项；玩家有选项→暂停窗口，否则即裁即应用。
 */
function openCallWindow(m: MatchState, discarder: number, tile: number): void {
  const rs = m.cur;
  if (!m.interactiveCalls) {
    for (let off = 1; off <= 3; off++) {
      const i = (discarder + off) % 4;
      if (winsWithMelds(rs.hands[i]!, rs.melds[i]!.length, tile) && !isFuriten(m, i)) {
        settleWin(m, 'ron', i, discarder, tile, [...rs.hands[i]!, tile]);
        return;
      }
    }
    advanceDraw(m, discarder);
    return;
  }
  // ── 交互鸣牌路径 ──
  const pending: CallClaim[] = [];
  for (let off = 1; off <= 3; off++) {
    const seat = (discarder + off) % 4;
    if (seat === PLAYER_SEAT) continue; // 玩家单列（options）
    const claim = aiDecideCall(m, seat, discarder, tile);
    if (claim) pending.push(claim);
  }
  if (discarder !== PLAYER_SEAT) {
    const options = playerCallOptions(m, discarder, tile);
    if (options.ron || options.pon || options.chi.length > 0) {
      rs.callWindow = { discarder, tile, options, pending };
      return; // 暂停·待 playerCall/playerPass（headless AI 由 aiResolveCallWindow 代决）
    }
  }
  resolveAndApplyCalls(m, discarder, tile, pending);
}

/** 无荣无鸣·下家摸（原流程尾）。 */
function advanceDraw(m: MatchState, discarder: number): void {
  m.cur.turn = (discarder + 1) % 4;
  drawTile(m);
}

/** 裁优先级并应用（荣>碰/杠>吃）；playerChi=玩家吃选中的搭子。 */
function applyWinners(m: MatchState, discarder: number, tile: number, winners: CallClaim[], playerChi?: ChiCandidate): void {
  const rs = m.cur;
  if (winners.length === 0) { advanceDraw(m, discarder); return; }
  if (winners[0]!.type === 'ron') {
    // 近家单荣（门清行为一致）；双响=债（gdd·naki-design §3 记）。
    const nearest = winners.reduce((a, b) => (callOffset(discarder, a.seat) <= callOffset(discarder, b.seat) ? a : b));
    settleWin(m, 'ron', nearest.seat, discarder, tile, [...rs.hands[nearest.seat]!, tile]);
    return;
  }
  const w = winners[0]!;
  applyCall(m, w.seat, w.type, discarder, tile, w.seat === PLAYER_SEAT ? playerChi : undefined);
}

function resolveAndApplyCalls(m: MatchState, discarder: number, tile: number, claims: CallClaim[]): void {
  applyWinners(m, discarder, tile, resolveClaims(claims));
}

/**
 * 应用碰/吃（P3a）：组副露·从暗手取牌·被鸣牌离河入副露·跳 actor·无摸待打（awaitDiscard）+ 喰い替え禁。
 */
function applyCall(m: MatchState, seat: number, type: CallClaim['type'], discarder: number, tile: number, chi?: ChiCandidate): void {
  const rs = m.cur;
  const hand = rs.hands[seat]!;
  const k = kindOf(tile);
  const consumeKinds = type === 'pon' ? [k, k] : [chi!.consume[0], chi!.consume[1]];
  const forbidden = type === 'pon' ? kuikaeForbidden(tile, null) : kuikaeForbidden(tile, chi!.consume);
  const taken: number[] = [];
  for (const ck of consumeKinds) {
    const i = hand.findIndex((t) => kindOf(t) === ck); // 每种取一枚（赤5 计宝牌不论位置·任取）
    if (i >= 0) taken.push(hand.splice(i, 1)[0]!);
  }
  rs.melds[seat]!.push({
    kind: type === 'pon' ? 'pon' : 'chi',
    tiles: [...taken, tile].sort((a, b) => kindOf(a) - kindOf(b) || a - b),
    from: discarder,
    called: tile,
  });
  rs.rivers[discarder]!.pop(); // 被鸣牌离弃牌者牌河（入副露·防再荣/振听误判）
  rs.lastDiscard = null;
  rs.turn = seat;
  rs.drawn = null;
  rs.awaitDiscard = true; // 鸣后无摸·须打一张
  rs.forbiddenDiscard = forbidden;
  m.log.push({ round: roundName(m), actor: m.seatNames[seat]!, kind: 'info', text: `${type === 'pon' ? '碰' : '吃'} ${labelTile(tile)}（供=${m.seatNames[discarder]}）` });
}

/** 该牌种对某家是否役牌（三元白發中 / 自风 / 场风·东风战场风恒東）——AI 碰倾向 + P6 役判据。 */
function isYakuhai(m: MatchState, seat: number, tile: number): boolean {
  const k = kindOf(tile);
  if (k >= 31) return true; // 白發中
  if (k >= 27) {
    const wind = k - 27; // 0東1南2西3北
    return wind === seatWind(seat, m.dealer) || wind === 0; // 自风 or 场风（東風戦恒東场）
  }
  return false;
}

/** AI 鸣牌决策（P3a 简版·确定性）：能荣（非振听）→ 荣；役牌 ≥2 → 碰；否则不鸣（吃=P5·杠=P3b）。 */
function aiDecideCall(m: MatchState, seat: number, _discarder: number, tile: number): CallClaim | null {
  const rs = m.cur;
  if (winsWithMelds(rs.hands[seat]!, rs.melds[seat]!.length, tile) && !isFuriten(m, seat)) return { seat, type: 'ron' };
  if (rs.riichi[seat]) return null; // 立直锁手·不鸣（仍可荣·上一行已判）
  if (canPon(rs.hands[seat]!, tile) && isYakuhai(m, seat, tile)) return { seat, type: 'pon' };
  return null;
}

/** 玩家（seat 0）对某弃牌的可鸣选项（交互模式·P4 HUD 消费）。 */
function playerCallOptions(m: MatchState, discarder: number, tile: number): PlayerCallOptions {
  const rs = m.cur;
  const seat = PLAYER_SEAT;
  const ron = winsWithMelds(rs.hands[seat]!, rs.melds[seat]!.length, tile) && !isFuriten(m, seat);
  const pon = !rs.riichi[seat] && canPon(rs.hands[seat]!, tile);
  const chi = !rs.riichi[seat] && seat === (discarder + 1) % 4 ? chiCandidates(rs.hands[seat]!, tile) : [];
  return { ron, pon, chi };
}

/** 玩家决定「过」（不鸣）：AI 主张照常裁应用。 */
export function playerPass(m: MatchState): void {
  const cw = m.cur.callWindow;
  if (!cw) return;
  m.cur.callWindow = null;
  resolveAndApplyCalls(m, cw.discarder, cw.tile, cw.pending);
}

/** 玩家决定鸣牌（荣/碰/吃）：与 AI 主张合并裁优先级（玩家的荣压 AI 碰·AI 荣压玩家碰…）。 */
export function playerCall(m: MatchState, choice: { type: 'ron' | 'pon' | 'chi'; chi?: ChiCandidate }): void {
  const cw = m.cur.callWindow;
  if (!cw) return;
  m.cur.callWindow = null;
  const claims: CallClaim[] = [...cw.pending, { seat: PLAYER_SEAT, type: choice.type }];
  applyWinners(m, cw.discarder, cw.tile, resolveClaims(claims), choice.chi);
}

/** headless/AI 代决玩家鸣牌窗口（seat 0 亦 AI 时·AI-vs-AI walkthrough 用）：同 AI 策略决碰/荣/过。 */
export function aiResolveCallWindow(m: MatchState): void {
  const cw = m.cur.callWindow;
  if (!cw) return;
  const claim = aiDecideCall(m, PLAYER_SEAT, cw.discarder, cw.tile);
  if (claim) playerCall(m, { type: claim.type as 'ron' | 'pon' });
  else playerPass(m);
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
  for (let i = 0; i < 4; i++) m.scores[i]! += delta[i]!; // delta=和了点移（Σ=0 守恒）
  // 供托（立直棒）归和者：走 scores·不计入 delta（否则破坏 delta 守恒·立直扣在 declareRiichi）
  m.scores[winner]! += m.kyotaku;
  m.kyotaku = 0;
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

/** 舍张振听：某家待ち牌种含其自家牌河任一 → 该家不能荣和（防非法荣和·副露感知·melds 空=门清）。 */
export function isFuriten(m: MatchState, seat: number): boolean {
  const waits = tenpaiWithMelds(m.cur.hands[seat]!, m.cur.melds[seat]!.length);
  if (waits.length === 0) return false;
  const river = m.cur.rivers[seat]!.map((c) => kindOf(c));
  return waits.some((w) => river.includes(w));
}

/** 荒牌流局（听牌罚符 3000·标准分配）。 */
function ryuukyoku(m: MatchState): void {
  const rs = m.cur;
  const tp = rs.hands.map((h, i) => tenpaiWithMelds(h, rs.melds[i]!.length).length > 0);
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

/** 整场终局收尾：残供托（立直棒）归第 1 位（gdd）+ 置 over → 终局点数守恒。 */
function finishMatch(m: MatchState): void {
  if (m.kyotaku > 0) {
    const lead = m.scores.indexOf(Math.max(...m.scores));
    m.scores[lead]! += m.kyotaku;
    m.kyotaku = 0;
    m.log.push({ round: roundName(m), actor: '系统', kind: 'score', text: `残供托 ${m.kyotaku} 归第1位 ${m.seatNames[lead]}` });
  }
  m.over = true;
}

/** 一局终 → 连庄判定 + 进局 / 整场终（东4 打完 / 击飞<0）。返回是否整场结束。 */
export function nextRound(m: MatchState): boolean {
  const rs = m.cur;
  if (rs.phase === 'playing') return false;
  const r = rs.result!;
  const dealerKept = r.type === 'draw' ? !!r.tenpaiFlags?.[m.dealer] : r.winner === m.dealer;
  // 击飞（gdd ⚙ 点数<0 即全场终）
  if (m.scores.some((s) => s < 0)) {
    m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: '击飞·整场终局' });
    finishMatch(m);
    return true;
  }
  if (dealerKept) {
    m.honba++;
    m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: `连庄（本场 ${m.honba}）` });
  } else {
    m.honba = 0;
    if (m.roundNo >= 4) { // 东4 非连庄打完 → 终局
      m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: '东风战终局' });
      finishMatch(m);
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

/** AI 选打哪张（当前 turn·含 drawn；鸣牌后无摸则仅暗手·滤喰い替え禁·价值最低者·PRNG tiebreak）。 */
export function aiChooseDiscard(m: MatchState): number {
  const rs = m.cur;
  const full = rs.drawn !== null ? [...rs.hands[rs.turn]!, rs.drawn] : [...rs.hands[rs.turn]!];
  const legal = full.filter((t) => !rs.forbiddenDiscard.includes(kindOf(t)));
  const pool = legal.length > 0 ? legal : full; // 全禁兜底（不该发生）
  const uniq = [...new Set(pool)];
  let worst = pool[0]!;
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

/** 当前 turn 能否立直（门清·听牌·持点≥1000·牌山≥4·未立直；简版=无副露即门清）。 */
export function canRiichi(m: MatchState): boolean {
  const rs = m.cur;
  const t = rs.turn;
  // 立直须门清（melds 非空=已副露·禁立直）。
  if (rs.phase !== 'playing' || rs.drawn === null || rs.melds[t]!.length > 0 || rs.riichi[t] || m.scores[t]! < 1000 || rs.wall.length < 4) return false;
  const full = [...rs.hands[t]!, rs.drawn];
  for (const x of new Set(full)) { // 存在一打法使 13 张听牌
    const rest = [...full];
    rest.splice(rest.indexOf(x), 1);
    if (tenpai(rest).length > 0) return true;
  }
  return false;
}

/** 宣立直（简版：自动选一个使听牌的打法·扣 1000 进供托·标记锁·打出宣言牌·§3 加立直役/一发/裏宝）。 */
export function declareRiichi(m: MatchState): void {
  if (!canRiichi(m)) return;
  const rs = m.cur;
  const t = rs.turn;
  const full = [...rs.hands[t]!, rs.drawn!];
  let tile: number | null = null;
  for (const x of new Set(full)) {
    const rest = [...full];
    rest.splice(rest.indexOf(x), 1);
    if (tenpai(rest).length > 0) { tile = x; break; }
  }
  if (tile === null) return;
  rs.riichi[t] = true;
  m.scores[t]! -= 1000;
  m.kyotaku += 1000;
  m.log.push({ round: roundName(m), actor: m.seatNames[t]!, kind: 'riichi', text: '立直！（-1000 供托）' });
  discard(m, tile); // 打出立直宣言牌
}

/** 当前 turn 走一步 AI（待鸣窗口→代决；自摸→宣；立直后→锁摸切；听牌→立直；否则进张打）。AI 席 + headless walkthrough 用。 */
export function aiTurn(m: MatchState): void {
  const rs = m.cur;
  if (rs.phase !== 'playing') return;
  if (rs.callWindow !== null) { aiResolveCallWindow(m); return; } // 先决待鸣窗口（seat 0 亦 AI）
  if (canTsumo(m)) { declareTsumo(m); return; }
  if (rs.riichi[rs.turn] && rs.drawn !== null) { discard(m, rs.drawn); return; } // 立直后锁摸切
  if (canRiichi(m)) { declareRiichi(m); return; } // 门清听牌→立直（记债换 t2-behavior-tree 人设概率）
  discard(m, aiChooseDiscard(m)); // 含鸣牌后无摸待打（awaitDiscard）
}

/** 是否轮到玩家行动（UI：等玩家点牌/自摸·含鸣牌后待打）。 */
export function isPlayerTurn(m: MatchState): boolean {
  const rs = m.cur;
  return rs.phase === 'playing' && rs.callWindow === null && rs.turn === PLAYER_SEAT && (rs.drawn !== null || rs.awaitDiscard);
}

/** 是否有玩家待决鸣牌窗口（UI：亮碰/吃/荣/过按钮·仅交互模式设窗口）。 */
export function isPlayerCallWindow(m: MatchState): boolean {
  return m.cur.phase === 'playing' && m.cur.callWindow !== null;
}

/** 本局是否已终（和了/流局·UI 弹结算浮层）。 */
export function isWinLikeEnd(m: MatchState): boolean {
  return m.cur.phase === 'win' || m.cur.phase === 'draw';
}

/** UI 驱动：自动推进 AI 席直到轮到玩家（行动 或 待鸣窗口）或 本局终。 */
export function runUntilPlayerOrEnd(m: MatchState, maxSteps = 200): void {
  let n = 0;
  while (m.cur.phase === 'playing' && n++ < maxSteps) {
    if (m.cur.callWindow !== null) break; // 玩家待鸣（窗口仅玩家有选项时设）→ 停给 UI
    if (m.cur.turn === PLAYER_SEAT && (m.cur.drawn !== null || m.cur.awaitDiscard)) break; // 轮到玩家打
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
