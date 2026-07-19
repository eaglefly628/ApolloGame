// Game B ·《雀宴》麻将核切片③ —— 局状态机（发牌→摸打→自摸/荣和→流局→结算→连庄·headless）。
//
// 积木边界（owner 铁令 TS 只补引擎没有的日麻缝·消费既有件不重造）：
//   洗牌/骰/派生 = `wall.ts`（引擎 w1-random 种子 PRNG）· 和了/听牌 = `hand-eval.ts`（§2）·
//   牌码/基元 = `tiles-def.ts`· 随机 = 引擎 randomInt（AI tiebreak·禁裸 Math.random）。
// 本文件补的缝 = 「一局的回合流程」：摸→打→他家荣和检测→轮转→流局→点数移动→连庄/进局。
//   点数=真役/符/番计分（scoreWin·门清/开手 G1/G2/G3 均真算）；无役兜底走占位固定分（守恒优先）。
//   ⚠ AI=**简版进张启发**（打孤张·PRNG tiebreak）；真人设 BT=gdd §五 t2-behavior-tree（B-006 记债）。
//   鸣牌（吃碰杠）/立直/振听 = 后续切片（本切片=摸切打循环 + 门清和了·先让一局能跑通打穿）。
import { randomInt, type RandomSeed } from '@atom-skills/random/index.js';
import { kindOf, isTerminalOrHonor } from './tiles-def.js';
import { dealWall } from './wall.js';
import { isWinningHand, tenpai, winsWithMelds, tenpaiWithMelds } from './hand-eval.js';
import { doraFromIndicator } from './wall.js';
import { GameLog } from './game-log.js';
import type { Meld } from './meld.js';
import { chiCandidates, canPon, canDaiminkan, ankanCandidates, kakanCandidates, resolveClaims, kuikaeForbidden, type ChiCandidate, type CallClaim } from './calls.js';
import { scoreWin, type WinContext, type ScoreResult } from './yaku.js';

export type Phase = 'playing' | 'win' | 'draw';

/** 玩家（seat 0）对某弃牌的可鸣选项（P4 HUD 亮按钮·碰/吃/荣 + 大明杠 P3b）。 */
export interface PlayerCallOptions {
  ron: boolean;
  pon: boolean;
  minkan: boolean; // 大明杠（暗手 3 张 == 弃牌）
  chi: ChiCandidate[]; // 可吃搭子候选（≥2 需选一）
}
/** 鸣牌窗口：某家弃牌后暂停·玩家(0)待决；AI(1-3)主张已算入 pending，待玩家决定后统一裁优先级。 */
export interface CallWindow {
  discarder: number; // 弃牌者（抢杠窗口=加杠家）
  tile: number; // 被鸣候选牌码（抢杠窗口=加杠牌种）
  options: PlayerCallOptions; // 玩家可选
  pending: CallClaim[]; // 已决 AI 主张（碰/荣/大明杠·P3a 无 AI 吃/杠）
  robKakan?: boolean; // 抢杠窗口（仅荣·过则加杠成立岭上摸·非下家摸）
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
  yakuLabel?: string; // 役种明细（真算分·结算面板显示·如「立直 門前清自摸和 平和 ドラ2」）
  scoreLabel?: string; // 番符档位（如「3翻30符」/「満貫」/「数え役満」）
  meldsSnapshot?: Meld[]; // 和了家副露（结算面板显示开手·闭手为空）
}

export interface RoundState {
  hands: number[][]; // 四家暗手（升序·不含 drawn·不含副露）
  melds: Meld[][]; // 四家副露（吃/碰·杠=P3b）——naki-design §1
  rivers: number[][]; // 四家牌河（打出序）
  wall: number[]; // 活山摸序（shift 取）
  dead: number[]; // 王牌（恒 14·杠时尾摸+活山补·守恒 bookkeeping）
  doraInd: number[]; // 已翻表宝牌指示牌（初 1·每杠 +1·至多 5）
  doraPool: number[]; // 预备表宝牌指示（含初·至多 5·杠翻示取序·naki-design §5）
  uraPool: number[]; // 预备裏宝牌指示（至多 5·立直和了翻·P6 消费）
  kanCount: number; // 已杠次数（岭上摸 / 新宝牌索引·四杠散了判据）
  turn: number; // 当前行动 seat
  drawn: number | null; // 当前 turn 刚摸的牌（待打）；null=已打待下家摸 / 鸣牌后待打
  drawnRinshan: boolean; // 当前 drawn 是否岭上牌（岭上开花判定·P6·且不作海底）
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
  // 表/裏宝牌指示预备池（王牌顶排·标准位：表=偶 index 4/6/8/10/12·裏=其下 5/7/9/11/13·至多 5 层）。
  const dw = deal.deadWall;
  const doraPool = [dw[4]!, dw[6]!, dw[8]!, dw[10]!, dw[12]!];
  const uraPool = [dw[5]!, dw[7]!, dw[9]!, dw[11]!, dw[13]!];
  m.cur = {
    hands: deal.hands.map((h) => [...h]),
    melds: [[], [], [], []],
    rivers: [[], [], [], []],
    wall: [...deal.drawWall],
    dead: [...deal.deadWall],
    doraInd: [doraPool[0]!],
    doraPool,
    uraPool,
    kanCount: 0,
    turn: m.dealer,
    drawn: null,
    drawnRinshan: false,
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
  rs.drawnRinshan = false; // 活山摸=非岭上
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
  settleWin(m, 'tsumo', rs.turn, null, rs.drawn!, winHand, { rinshan: rs.drawnRinshan }); // 岭上開花旗（D5a·闭手含暗杠 P6b 才行使）
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
  rs.drawnRinshan = false; // 岭上机会已消耗（打出=不再岭上开花）
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
      if (canRon(m, i, tile)) { // 形 + 非振听 + 有役（D2·1番縛り）
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
  rs.rivers[discarder]!.pop(); // 被鸣牌离弃牌者牌河（入副露·防再荣/振听误判）
  rs.lastDiscard = null;
  rs.turn = seat;
  if (type === 'minkan') { // 大明杠：暗手 3 张 + 弃牌 → 4·岭上摸后待打
    const taken: number[] = [];
    for (let n = 0; n < 3; n++) { const i = hand.findIndex((t) => kindOf(t) === k); if (i >= 0) taken.push(hand.splice(i, 1)[0]!); }
    rs.melds[seat]!.push({ kind: 'minkan', tiles: [...taken, tile].sort((a, b) => kindOf(a) - kindOf(b) || a - b), from: discarder, called: tile });
    rs.drawn = null;
    rs.awaitDiscard = false;
    rs.forbiddenDiscard = [];
    m.log.push({ round: roundName(m), actor: m.seatNames[seat]!, kind: 'info', text: `大明杠 ${labelTile(tile)}（供=${m.seatNames[discarder]}）` });
    rinshanDraw(m); // 岭上摸 → drawn≠null·打后 openCallWindow
    revealKanDora(m); // 简化即翻（R-3「明杠打后翻」精确时序=P6 债·占位分下无差别）
    return;
  }
  // 碰/吃：暗手 2 张 + 弃牌 → 3·无摸待打 + 喰い替え禁
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
  if (canRon(m, seat, tile)) return { seat, type: 'ron' }; // 形 + 非振听 + 有役（D2）
  if (rs.riichi[seat]) return null; // 立直锁手·不鸣（仍可荣·上一行已判）
  if (canPon(rs.hands[seat]!, tile) && isYakuhai(m, seat, tile)) return { seat, type: 'pon' };
  return null;
}

/** 玩家（seat 0）对某弃牌的可鸣选项（交互模式·P4 HUD 消费）。 */
function playerCallOptions(m: MatchState, discarder: number, tile: number): PlayerCallOptions {
  const rs = m.cur;
  const seat = PLAYER_SEAT;
  const ron = canRon(m, seat, tile); // 形 + 非振听 + 有役（D2·1番縛り）
  const pon = !rs.riichi[seat] && canPon(rs.hands[seat]!, tile);
  const minkan = !rs.riichi[seat] && rs.wall.length > 0 && canDaiminkan(rs.hands[seat]!, tile); // 海底不得杠（D7）
  const chi = !rs.riichi[seat] && seat === (discarder + 1) % 4 ? chiCandidates(rs.hands[seat]!, tile) : [];
  return { ron, pon, minkan, chi };
}

/** 玩家决定「过」（不鸣）：抢杠窗口→加杠成立岭上摸；普通窗口→AI 主张照常裁应用。 */
export function playerPass(m: MatchState): void {
  const cw = m.cur.callWindow;
  if (!cw) return;
  m.cur.callWindow = null;
  if (cw.robKakan) { resolveKakanRob(m, cw, null); return; }
  resolveAndApplyCalls(m, cw.discarder, cw.tile, cw.pending);
}

/** 玩家决定鸣牌（荣/碰/吃/大明杠）：与 AI 主张合并裁优先级（荣>碰/杠>吃）。抢杠窗口只认荣。 */
export function playerCall(m: MatchState, choice: { type: 'ron' | 'pon' | 'chi' | 'minkan'; chi?: ChiCandidate }): void {
  const cw = m.cur.callWindow;
  if (!cw) return;
  m.cur.callWindow = null;
  if (cw.robKakan) { resolveKakanRob(m, cw, choice.type === 'ron' ? PLAYER_SEAT : null); return; }
  const claims: CallClaim[] = [...cw.pending, { seat: PLAYER_SEAT, type: choice.type }];
  applyWinners(m, cw.discarder, cw.tile, resolveClaims(claims), choice.chi);
}

/** 抢杠裁决：有人荣→加杠不成立·加杠家放铳；无人荣→加杠成立·岭上摸。 */
function resolveKakanRob(m: MatchState, cw: CallWindow, playerRonSeat: number | null): void {
  const claims: CallClaim[] = [...cw.pending];
  if (playerRonSeat !== null) claims.push({ seat: playerRonSeat, type: 'ron' });
  if (claims.length > 0) {
    const w = claims.reduce((a, b) => (callOffset(cw.discarder, a.seat) <= callOffset(cw.discarder, b.seat) ? a : b));
    settleWin(m, 'ron', w.seat, cw.discarder, cw.tile, [...m.cur.hands[w.seat]!, cw.tile], { chankan: true }); // 抢杠荣（放铳=加杠家·带槍槓 1 番 D5b）
    return;
  }
  finalizeKan(m); // 无人抢 → 加杠成立·岭上摸 + 翻新宝牌
}

/** headless/AI 代决玩家鸣牌窗口（seat 0 亦 AI 时·AI-vs-AI walkthrough 用）：抢杠窗口→AI 荣/过；普通→碰/荣/过。 */
export function aiResolveCallWindow(m: MatchState): void {
  const cw = m.cur.callWindow;
  if (!cw) return;
  if (cw.robKakan) { // 抢杠：能荣则荣（同 aiDecideCall 荣逻辑），否则过
    if (winsWithMelds(m.cur.hands[PLAYER_SEAT]!, m.cur.melds[PLAYER_SEAT]!.length, cw.tile) && !isFuriten(m, PLAYER_SEAT)) playerCall(m, { type: 'ron' });
    else playerPass(m);
    return;
  }
  const claim = aiDecideCall(m, PLAYER_SEAT, cw.discarder, cw.tile);
  if (claim) playerCall(m, { type: claim.type as 'ron' | 'pon' });
  else playerPass(m);
}

// ── 杠（暗杠/大明杠/加杠 + 岭上摸 / 新宝牌 / 抢杠·naki-design §5·P3b）─────────────────────
/** 岭上摸：王牌前区取 1·活山尾补 1（王牌恒 14·守恒 bookkeeping）；标记 drawnRinshan + kanCount++。 */
function rinshanDraw(m: MatchState): void {
  const rs = m.cur;
  const tile = rs.dead.shift();
  if (tile === undefined) { ryuukyoku(m); return; } // 王牌耗尽（理论极限·兜底流局）
  if (rs.wall.length > 0) rs.dead.push(rs.wall.pop()!); // 活山尾补进王牌（守恒·杠减活山→局终得更快）
  rs.drawn = tile;
  rs.drawnRinshan = true;
  rs.kanCount++;
  m.log.push({ round: roundName(m), actor: m.seatNames[rs.turn]!, kind: 'draw', text: `岭上摸 ${labelTile(tile)}（第 ${rs.kanCount} 杠·余 ${rs.wall.length}）`, tile });
}

/** 翻新表宝牌指示（杠·至多 5 层）。R-3「明杠打后翻」精确时序=P6 债（占位分下与即翻无差别）。 */
function revealKanDora(m: MatchState): void {
  const rs = m.cur;
  if (rs.doraInd.length >= rs.doraPool.length) return; // 已翻满 5 层
  rs.doraInd.push(rs.doraPool[rs.doraInd.length]!);
  m.log.push({ round: roundName(m), actor: '系统', kind: 'dora', text: `杠·新宝牌指示 ${labelTile(rs.doraInd[rs.doraInd.length - 1]!)}（宝牌 ${labelTile(doraFromIndicator(rs.doraInd[rs.doraInd.length - 1]!))}）` });
}

/** 加杠成立（未被抢）→ 岭上摸 + 翻新宝牌（续摸打）。 */
function finalizeKan(m: MatchState): void {
  rinshanDraw(m);
  revealKanDora(m);
}

/** 暗杠候选牌种（自家回合·含刚摸·某种 4 张）；立直后禁（v1·不变听暗杠=债）；海底（活山空）禁杠（D7）。 */
export function ankanKinds(m: MatchState): number[] {
  const rs = m.cur;
  const t = rs.turn;
  if (rs.phase !== 'playing' || rs.drawn === null || rs.callWindow !== null || rs.riichi[t] || rs.wall.length === 0) return [];
  return ankanCandidates([...rs.hands[t]!, rs.drawn]);
}
export function canAnkan(m: MatchState): boolean { return ankanKinds(m).length > 0; }

/** 宣暗杠（kind=4 张同种）：组暗杠副露·即翻新宝牌（R-3）·岭上摸续摸打。 */
export function declareAnkan(m: MatchState, kind: number): void {
  const rs = m.cur;
  const t = rs.turn;
  if (!ankanKinds(m).includes(kind)) return;
  const all = [...rs.hands[t]!, rs.drawn!];
  const taken: number[] = [];
  const rest: number[] = [];
  for (const c of all) { if (kindOf(c) === kind && taken.length < 4) taken.push(c); else rest.push(c); }
  rs.hands[t] = rest.sort((a, b) => kindOf(a) - kindOf(b) || a - b);
  rs.drawn = null;
  rs.melds[t]!.push({ kind: 'ankan', tiles: taken.sort((a, b) => kindOf(a) - kindOf(b) || a - b), from: t, called: kind });
  m.log.push({ round: roundName(m), actor: m.seatNames[t]!, kind: 'info', text: `暗杠 ${labelTile(kind)}` });
  revealKanDora(m); // 暗杠即翻（R-3）
  rinshanDraw(m);
}

/** 加杠候选牌种（自家回合·已碰某种 + 手中/摸含第 4 张）；立直后禁；海底（活山空）禁杠（D7）。 */
export function kakanKinds(m: MatchState): number[] {
  const rs = m.cur;
  const t = rs.turn;
  if (rs.phase !== 'playing' || rs.drawn === null || rs.callWindow !== null || rs.riichi[t] || rs.wall.length === 0) return [];
  return kakanCandidates([...rs.hands[t]!, rs.drawn], rs.melds[t]!);
}
export function canKakan(m: MatchState): boolean { return kakanKinds(m).length > 0; }

/** 加杠可被抢杠的家（非加杠家·能荣加杠牌·非振听）。国士抢暗杠 v1 不做（R-6·此为加杠抢=标准允许）。 */
function kakanRobbers(m: MatchState, declarer: number, kind: number): number[] {
  const out: number[] = [];
  for (let off = 1; off <= 3; off++) {
    const i = (declarer + off) % 4;
    if (canRon(m, i, kind, true)) out.push(i); // chankan=true·抢加杠恒带槍槓（有役闸不误挡）
  }
  return out;
}

/** 宣加杠（kind）：升碰为加杠·开抢杠窗口（可荣→杠不成立放铳）；未抢→岭上摸 + 翻新宝牌。 */
export function declareKakan(m: MatchState, kind: number): void {
  const rs = m.cur;
  const t = rs.turn;
  if (!kakanKinds(m).includes(kind)) return;
  const all = [...rs.hands[t]!, rs.drawn!];
  const i4 = all.findIndex((c) => kindOf(c) === kind);
  const fourth = all.splice(i4, 1)[0]!;
  rs.hands[t] = all.sort((a, b) => kindOf(a) - kindOf(b) || a - b);
  rs.drawn = null;
  const pon = rs.melds[t]!.find((md) => md.kind === 'pon' && kindOf(md.tiles[0]!) === kind)!;
  pon.kind = 'kakan';
  pon.tiles = [...pon.tiles, fourth].sort((a, b) => kindOf(a) - kindOf(b) || a - b);
  m.log.push({ round: roundName(m), actor: m.seatNames[t]!, kind: 'info', text: `加杠 ${labelTile(kind)}` });
  const robbers = kakanRobbers(m, t, kind);
  const pending: CallClaim[] = robbers.filter((s) => s !== PLAYER_SEAT).map((s) => ({ seat: s, type: 'ron' as const }));
  if (m.interactiveCalls && robbers.includes(PLAYER_SEAT)) {
    rs.callWindow = { discarder: t, tile: kind, options: { ron: true, pon: false, minkan: false, chi: [] }, pending, robKakan: true };
    return; // 等玩家抢/过（aiResolveCallWindow 代决）
  }
  if (pending.length > 0) { // AI 抢杠
    const w = pending.reduce((a, b) => (callOffset(t, a.seat) <= callOffset(t, b.seat) ? a : b));
    settleWin(m, 'ron', w.seat, t, kind, [...rs.hands[w.seat]!, kind], { chankan: true }); // 带槍槓 1 番（D5b）
    return;
  }
  finalizeKan(m);
}

/** AI 是否该暗/加杠（保守：仅当杠后仍听牌·不破手）——确定性·记债换 t2-behavior-tree。 */
function aiShouldKan(m: MatchState): { type: 'ankan' | 'kakan'; kind: number } | null {
  const rs = m.cur;
  const t = rs.turn;
  const keepsTenpai = (concealedAfter: number[], meldCountAfter: number): boolean =>
    tenpaiWithMelds(concealedAfter, meldCountAfter).length > 0;
  for (const kind of ankanKinds(m)) {
    const rest = [...rs.hands[t]!, rs.drawn!].filter((c) => kindOf(c) !== kind);
    if (keepsTenpai(rest, rs.melds[t]!.length + 1)) return { type: 'ankan', kind };
  }
  for (const kind of kakanKinds(m)) {
    const rest = [...rs.hands[t]!, rs.drawn!];
    rest.splice(rest.findIndex((c) => kindOf(c) === kind), 1);
    if (keepsTenpai(rest, rs.melds[t]!.length)) return { type: 'kakan', kind }; // 加杠不增 meldCount（升碰）
  }
  return null;
}

/** 结算档位显示名（役満/数え/三倍満…満貫/番符）。 */
function scoreDisplayLabel(s: ScoreResult): string {
  if (s.yakuman > 0) return s.yakuman === 1 ? '役満' : `${s.yakuman}倍役満`;
  if (s.han >= 13) return '数え役満';
  if (s.han >= 11) return '三倍満';
  if (s.han >= 8) return '倍満';
  if (s.han >= 6) return '跳満';
  if (s.han >= 5) return '満貫';
  return `${s.han}翻${s.fu}符`;
}

/** 构和了上下文（settleWin + 荣和「有役」闸共用·闭手/开手真算分口径·東風戦恒東场）。 */
function buildWinContext(m: MatchState, winner: number, tile: number, tsumo: boolean, winHand: number[], opts?: { chankan?: boolean; rinshan?: boolean }): WinContext {
  const rs = m.cur;
  return {
    hand14: winHand, winTile: tile, tsumo, // 开手 winHand=[...暗手, 和牌]=14−3k 张（暗手不含副露）
    seatWind: seatWind(winner, m.dealer), roundWind: 0,
    isDealer: winner === m.dealer, riichi: rs.riichi[winner]!,
    doubleRiichi: false, ippatsu: false, // 债（未 track 两立直/一发·G4·主程另接）
    haitei: rs.wall.length === 0 && !rs.drawnRinshan, // 海底摸月/河底撈魚（岭上不算）
    doraIndicators: rs.doraInd,
    uraIndicators: rs.riichi[winner] ? rs.uraPool.slice(0, rs.doraInd.length) : [], // 立直和了才看里宝
    chankan: opts?.chankan, rinshan: opts?.rinshan,
    calledMelds: rs.melds[winner]!.map((md) => ({ kind: md.kind, tiles: md.tiles })), // 开手真算分（G1·闭手=[]）
  };
}

/**
 * 荣和「有役」闸（D2·1番縛り·GD-B 2026-07-18 复审必修）：日麻最低一役才能荣。
 * · 闭手/开手一律以该荣和牌构 WinContext 跑 scoreWin（含 calledMelds·G1 真算分）·**必须有役（≠null）** 才允许荣。
 *   （P6b 前开手曾暂放行·今开手真算分已落·完成 D2 开手闸——无役开手荣被正确拒。）
 * · chankan=抢加杠荣（恒带槍槓 1 番·故抢杠恒有役·不误挡）。
 * 自摸不用此闸（门前清自摸恒带門前清自摸和；开手无役自摸走占位兜底·见 settleWin）。
 */
function hasRonYaku(m: MatchState, seat: number, tile: number, chankan = false): boolean {
  return scoreWin(buildWinContext(m, seat, tile, false, [...m.cur.hands[seat]!, tile], { chankan })) !== null;
}

/** 荣和合法性（形 + 非振听 + 1番縛り有役闸）。chankan=抢加杠。 */
function canRon(m: MatchState, seat: number, tile: number, chankan = false): boolean {
  return winsWithMelds(m.cur.hands[seat]!, m.cur.melds[seat]!.length, tile) && !isFuriten(m, seat) && hasRonYaku(m, seat, tile, chankan);
}

/**
 * 结算和了：**门清/开手一律走真役符引擎 scoreWin（G1/D6·含 calledMelds 真算分）**。
 * 「闭手」判据不再是 `melds.length===0`：门前含暗杠亦走真算分（暗杠不破门清·D6）。
 * 占位固定分只当 scoreWin 返回 null（无役·如开手无役自摸）时兜底——守恒不破。
 * 引擎 Payment → 四家 delta（+本场）；供托归和者；结算标签（役种/番符）落 result 供面板显示。
 * opts.chankan/rinshan：抢杠/岭上開花役旗（D5a/D5b·注入 WinContext）。
 */
function settleWin(m: MatchState, type: 'tsumo' | 'ron', winner: number, loser: number | null, tile: number, winHand: number[], opts?: { chankan?: boolean; rinshan?: boolean }): void {
  const rs = m.cur;
  const isDealer = winner === m.dealer;
  const delta = [0, 0, 0, 0];
  const honbaEach = m.honba * 100; // 自摸每家 +100/本场
  const honbaRon = m.honba * 300; // 荣和放铳 +300/本场

  // 真算分：全手（闭手 calledMelds=[]·含暗杠/开手 calledMelds=rs.melds[winner]）走 scoreWin；无役兜底走占位。
  const score: ScoreResult | null = scoreWin(buildWinContext(m, winner, tile, type === 'tsumo', winHand, opts));

  if (score) {
    const p = score.points;
    if (type === 'tsumo') {
      for (let i = 0; i < 4; i++) {
        if (i === winner) continue;
        const base = isDealer ? p.fromEach! : (i === m.dealer ? p.fromDealer! : p.fromNonDealer!);
        const pay = base + honbaEach;
        delta[i]! -= pay; delta[winner]! += pay;
      }
    } else {
      const pay = p.ron! + honbaRon;
      delta[loser!]! -= pay; delta[winner]! += pay;
    }
  } else { // 占位兜底：scoreWin 无役（如开手无役自摸·门清核不挡自摸形）——守恒优先·固定分
    if (type === 'tsumo') {
      for (let i = 0; i < 4; i++) {
        if (i === winner) continue;
        const base = isDealer ? 2000 : (i === m.dealer ? 2000 : 1000);
        const pay = base + honbaEach; delta[i]! -= pay; delta[winner]! += pay;
      }
    } else {
      const base = (isDealer ? 7700 : 5200) + honbaRon;
      delta[loser!]! -= base; delta[winner]! += base;
    }
  }

  for (let i = 0; i < 4; i++) m.scores[i]! += delta[i]!; // delta=和了点移（Σ=0 守恒）
  m.scores[winner]! += m.kyotaku; // 供托（立直棒）归和者·不计入 delta（守恒不破·立直扣在 declareRiichi）
  m.kyotaku = 0;

  const yakuLabel = score ? score.yaku.map((y) => `${y.name}${y.han > 0 ? y.han : ''}`).join(' ') : undefined;
  const scoreLabel = score ? scoreDisplayLabel(score) : '占位分（无役兜底）';
  rs.result = { type, winner, loser, winTile: tile, delta, handSnapshot: winHand, yakuLabel, scoreLabel, meldsSnapshot: [...rs.melds[winner]!] };
  rs.phase = 'win';
  m.log.push({ round: roundName(m), actor: m.seatNames[winner]!, kind: type, text: `${type === 'tsumo' ? '自摸' : '荣和'} ${labelTile(tile)}${loser !== null ? `（放铳=${m.seatNames[loser]}）` : ''}`, tile });
  if (score) m.log.push({ round: roundName(m), actor: '系统', kind: 'info', text: `${yakuLabel} · ${scoreLabel}` });
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
  const kan = aiShouldKan(m); // 暗/加杠（保守·仅不破听）→ 岭上摸后本函数再入
  if (kan) { if (kan.type === 'ankan') declareAnkan(m, kan.kind); else declareKakan(m, kan.kind); return; }
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
