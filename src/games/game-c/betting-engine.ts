import { compareRank, type HandRank } from './holdem-eval.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》下注圈状态机（capability-plan §4-b·owner 2026-07-17 TS 口径）
//
//  为什么是 TS 而不是数据表：轮转/min-raise/短 all-in 不重开/边池切层是**带循环与集合运算的状态机算法**，
//  Condition→Event→Effect 表达不了（plan §3 已对照）。本模块=确定性纯状态机：全整数、无随机、无 IO；
//  随机只存在于发牌（holdem-eval·引擎 seededShuffle）与 AI（M2·引擎 RandomSeed），不在这里。
//  积木缝合面：筹码栈/底池在装配层是引擎 Resource（plan §2），本机输出的 Settlement 由薄编排层写回——
//  本模块不private藏一套平行世界，只算一手牌内的合法行动与分池。
//
//  规则口径（GDD §3·标准德州零发挥）：
//    · min-raise=上一完整加注增量（首注基准=大盲）；不足 min-raise 的 all-in 不重开已行动者的加注权；
//    · 多人 all-in 逐层切边池，每池独立比牌；未被跟注的溢出注退回本人；
//    · 平分奇数筹码给按钮后顺时针最先者（"位置靠前"）；
//    · 盲注不足额=短缴 all-in（currentBet 仍=大盲：跟注下限标准）；
//    · 手间轮转=死按钮规则（大盲永远前进一个活人，小盲/按钮随位——可死盲/死钮）；两人=按钮即小盲。
// ═══════════════════════════════════════════════════════════════

export interface BettingConfig {
  smallBlind: number;
  bigBlind: number;
}

export type SeatId = number;

/** 入手参与者（活人+带入栈）。 */
export interface HandSeat {
  seat: SeatId;
  stack: number;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'done';

export interface PlayerHandState {
  seat: SeatId;
  stack: number; // 手内剩余
  committed: number; // 本街已投
  total: number; // 整手累计投入（边池切层依据）
  folded: boolean;
  allIn: boolean;
  /** 自最近一次完整加注后是否已行动（兼作加注权：true=只许跟/弃——短 all-in 不重开的机制位）。 */
  acted: boolean;
}

export interface Positions {
  button: SeatId; // 可为已淘汰空位（死按钮：只作行动序基准）
  sb: SeatId; // 应缴小盲的**座位**；该座不在场=死小盲（无人缴）
  bb: SeatId; // 大盲（死按钮规则下恒为活人）
}

export interface HandState {
  cfg: BettingConfig;
  players: PlayerHandState[]; // 座位升序
  pos: Positions;
  street: Street;
  currentBet: number; // 本街最高 committed
  lastRaiseSize: number; // 最近一次完整加注增量（min-raise 基准；街首=大盲）
  actor: SeatId | null; // 轮到谁（null=无人可行动）
  /** 全员弃牌收池的赢家（street='done' 时有值；摊牌路径无）。 */
  uncontested?: SeatId;
}

export interface LegalActions {
  fold: true;
  check?: true;
  call?: number; // 需追加的筹码（不足额=全下跟注,即 min(此值,栈)）
  raise?: { min: number; max: number }; // raise-to 口径（本街 committed 目标值）；max=全下位
}

export interface PotLayer {
  amount: number;
  eligible: SeatId[]; // 有资格争此池的未弃牌者（座位升序）
  winners?: SeatId[]; // settle 后回填
}

export interface Settlement {
  pots: PotLayer[];
  refund: { seat: SeatId; amount: number } | null; // 未被跟注的溢出退回
  payouts: Record<SeatId, number>; // 各席从池里赢得的总额（不含退回）
}

// ── 座位环工具 ─────────────────────────────────────────────────

const SEAT_RING = 6; // 六人桌固定环大小（GDD：6 座位）

/** 从 from 顺时针找下一个在 live 集合里的座位（不含 from 本身）。座位号即环位 0..5。 */
export function nextLiveSeat(live: readonly SeatId[], from: SeatId): SeatId {
  const set = new Set(live);
  for (let step = 1; step <= SEAT_RING; step++) {
    const s = (from + step) % SEAT_RING;
    if (set.has(s)) return s;
  }
  throw new Error('nextLiveSeat: 无活座位');
}

/** 手间轮转（死按钮规则）：大盲前进一个活人；新小盲=旧大盲**座位**（人没了=死小盲）；
 *  新按钮=旧小盲**座位**（人没了=死按钮）。两人残局：按钮即小盲（另一人大盲）。 */
export function nextPositions(prev: Positions, live: readonly SeatId[]): Positions {
  if (live.length < 2) throw new Error('nextPositions: 至少两名活人');
  const bb = nextLiveSeat(live, prev.bb);
  if (live.length === 2) {
    const other = live.find((s) => s !== bb)!;
    return { button: other, sb: other, bb };
  }
  return { button: prev.sb, sb: prev.bb, bb };
}

/** 首手开局定位：给定按钮，顺位取小盲/大盲；两人=按钮即小盲。 */
export function initialPositions(live: readonly SeatId[], button: SeatId): Positions {
  if (live.length === 2) {
    const bb = nextLiveSeat(live, button);
    return { button, sb: button, bb };
  }
  const sb = nextLiveSeat(live, button);
  const bb = nextLiveSeat(live, sb);
  return { button, sb, bb };
}

// ── 一手牌状态机 ────────────────────────────────────────────────

function playerAt(st: HandState, seat: SeatId): PlayerHandState {
  const p = st.players.find((x) => x.seat === seat);
  if (!p) throw new Error(`座位 ${seat} 不在本手`);
  return p;
}

/** 缴注（含盲注/跟注/加注共用）：只动本人三件套，不足额自动 all-in。 */
function pay(p: PlayerHandState, amount: number): void {
  const real = Math.min(amount, p.stack);
  p.stack -= real;
  p.committed += real;
  p.total += real;
  if (p.stack === 0) p.allIn = true;
}

/** 开一手：缴盲（不足额=短缴 all-in；死小盲跳过）→ 定翻前首行动者。 */
export function startHand(cfg: BettingConfig, seats: readonly HandSeat[], pos: Positions): HandState {
  if (seats.length < 2) throw new Error('startHand: 至少两人');
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  for (const s of sorted) if (s.stack <= 0) throw new Error(`座位 ${s.seat} 无筹码不可入手（先典当或淘汰——局级规则）`);
  const st: HandState = {
    cfg,
    players: sorted.map((s) => ({
      seat: s.seat, stack: s.stack, committed: 0, total: 0, folded: false, allIn: false, acted: false,
    })),
    pos,
    street: 'preflop',
    currentBet: cfg.bigBlind, // 跟注下限=大盲（盲注短缴不降低跟注线：标准规则）
    lastRaiseSize: cfg.bigBlind,
    actor: null,
  };
  const sbP = st.players.find((p) => p.seat === pos.sb);
  if (sbP) pay(sbP, cfg.smallBlind); // 死小盲：座位不在场即无人缴
  pay(playerAt(st, pos.bb), cfg.bigBlind);
  st.actor = findNextActor(st, pos.bb);
  if (st.actor === null) closeStreet(st); // 极端：盲注即全员 all-in → 直通摊牌
  return st;
}

/** 本街是否行动闭合：所有未弃未 all-in 者已缴平 currentBet 且已行动；
 *  仅剩 ≤1 人可行动且已缴平时无条件闭合（无对手可回应，选项无意义）。 */
function streetClosed(st: HandState): boolean {
  const alive = st.players.filter((p) => !p.folded && !p.allIn);
  if (alive.length === 0) return true;
  if (alive.length === 1) return alive[0].committed === st.currentBet;
  return alive.every((p) => p.committed === st.currentBet && p.acted);
}

/** 从 from 顺时针找下一个需要行动的人（未弃、未 all-in、且（未缴平或未行动））。 */
function findNextActor(st: HandState, from: SeatId): SeatId | null {
  if (streetClosed(st)) return null;
  const seats = st.players.map((p) => p.seat);
  let cur = from;
  for (let i = 0; i < seats.length + SEAT_RING; i++) {
    cur = nextLiveSeat(seats, cur);
    const p = playerAt(st, cur);
    if (!p.folded && !p.allIn && (p.committed !== st.currentBet || !p.acted)) return cur;
  }
  return null;
}

const STREET_NEXT: Record<string, Street> = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown' };

/** 收街：committed 已累计在 total → 清本街状态，推进街/终局。 */
function closeStreet(st: HandState): void {
  for (const p of st.players) { p.committed = 0; p.acted = false; }
  st.currentBet = 0;
  st.lastRaiseSize = st.cfg.bigBlind;
  st.actor = null;
  const unfolded = st.players.filter((p) => !p.folded);
  if (unfolded.length <= 1) {
    st.street = 'done';
    st.uncontested = unfolded[0]?.seat;
    return;
  }
  const canAct = unfolded.filter((p) => !p.allIn);
  if (st.street === 'river' || canAct.length <= 1) {
    // 河后 → 摊牌；或除 ≤1 人外全 all-in → 无下注意义,剩余公共牌直跑到摊牌（揭示节奏归表现层）。
    st.street = 'showdown';
    return;
  }
  st.street = STREET_NEXT[st.street];
  st.actor = findNextActor(st, st.pos.button); // 翻后首行动=按钮后第一个可行动者
}

/** 当前行动者的合法动作集（供 UI 行动条与 AI 决策叶取用——口径单一真相）。 */
export function legalActions(st: HandState): LegalActions {
  if (st.actor === null) throw new Error('legalActions: 本街无行动者');
  const p = playerAt(st, st.actor);
  const toCall = st.currentBet - p.committed;
  const out: LegalActions = { fold: true };
  if (toCall <= 0) out.check = true;
  else out.call = toCall;
  const allInTo = p.committed + p.stack;
  if (!p.acted && allInTo > st.currentBet) {
    // 加注权在手（未行动/被完整加注重开）：min=标准 min-raise 位；不足 min 只能整栈 all-in（短加注）。
    const minTo = st.currentBet + st.lastRaiseSize;
    out.raise = { min: Math.min(minTo, allInTo), max: allInTo };
  }
  return out;
}

export type Action =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call' }
  | { kind: 'raise'; to: number }; // raise-to：本街 committed 目标值（含首注 bet）

/** 行动一步（原地推进状态机；非法动作抛错——上游 UI/AI 应先取 legalActions）。 */
export function act(st: HandState, seat: SeatId, action: Action): HandState {
  if (st.street === 'showdown' || st.street === 'done') throw new Error('本手下注已结束');
  if (st.actor !== seat) throw new Error(`未轮到座位 ${seat}（当前 ${st.actor}）`);
  const p = playerAt(st, seat);
  const toCall = st.currentBet - p.committed;

  if (action.kind === 'fold') {
    p.folded = true;
  } else if (action.kind === 'check') {
    if (toCall > 0) throw new Error('面对下注不可过牌');
    p.acted = true;
  } else if (action.kind === 'call') {
    if (toCall <= 0) throw new Error('无注可跟（应过牌）');
    pay(p, toCall); // 栈不足自动全下跟注
    p.acted = true;
  } else {
    const allInTo = p.committed + p.stack;
    if (p.acted) throw new Error('加注权已用（短 all-in 不重开）');
    if (action.to <= st.currentBet) throw new Error('加注目标须高于当前注');
    if (action.to > allInTo) throw new Error('加注超出栈');
    const increment = action.to - st.currentBet;
    const isFull = increment >= st.lastRaiseSize;
    if (!isFull && action.to !== allInTo) throw new Error(`不足 min-raise（增量 ${increment} < ${st.lastRaiseSize}）只能整栈 all-in`);
    pay(p, action.to - p.committed);
    st.currentBet = action.to;
    if (isFull) {
      st.lastRaiseSize = increment;
      for (const q of st.players) if (q !== p && !q.folded && !q.allIn) q.acted = false; // 完整加注重开行动
    }
    p.acted = true;
  }

  const unfolded = st.players.filter((q) => !q.folded);
  if (unfolded.length <= 1) {
    // 全弃收池：直接终局（当街 committed 保留在 total，settle 统一退未跟注溢出）。
    for (const q of st.players) { q.committed = 0; q.acted = false; }
    st.currentBet = 0;
    st.actor = null;
    st.street = 'done';
    st.uncontested = unfolded[0]?.seat;
    return st;
  }
  st.actor = findNextActor(st, seat);
  if (st.actor === null) closeStreet(st);
  return st;
}

// ── 分池与结算 ─────────────────────────────────────────────────

/** 边池切层（含未跟注溢出退回）：层帽=未弃牌者去重 total 升序；
 *  每层金额=Σ_全员 clamp(total, 上帽, 本帽)；资格=未弃且 total≥本帽（弃牌者的钱按层沉入，人无资格）。 */
export function potLayers(st: HandState): { pots: PotLayer[]; refund: Settlement['refund'] } {
  const totals = new Map<SeatId, number>(st.players.map((p) => [p.seat, p.total]));
  const live = st.players.filter((p) => !p.folded);
  let refund: Settlement['refund'] = null;
  // 未被跟注的溢出：唯一最高投入的活人，超出「其他任意人最高投入」的部分退回本人。
  const liveSorted = [...live].sort((a, b) => b.total - a.total);
  if (liveSorted.length >= 1) {
    const top = liveSorted[0];
    const othersMax = Math.max(0, ...st.players.filter((p) => p !== top).map((p) => p.total));
    if (top.total > othersMax) {
      refund = { seat: top.seat, amount: top.total - othersMax };
      totals.set(top.seat, othersMax);
    }
  }
  const caps = [...new Set(live.map((p) => totals.get(p.seat)!))].filter((c) => c > 0).sort((a, b) => a - b);
  const pots: PotLayer[] = [];
  let prev = 0;
  for (const cap of caps) {
    let amount = 0;
    for (const p of st.players) amount += Math.min(totals.get(p.seat)!, cap) - Math.min(totals.get(p.seat)!, prev);
    const eligible = live.filter((p) => totals.get(p.seat)! >= cap).map((p) => p.seat).sort((a, b) => a - b);
    if (amount > 0) pots.push({ amount, eligible });
    prev = cap;
  }
  return { pots, refund };
}

/** 结算：每池独立取 eligible 中最大全序值者平分；奇数筹码按「按钮后顺时针最先」逐一给。
 *  ranks 只需覆盖未弃牌者；全弃收池（street='done'）免 ranks。结果写回各席 stack。 */
export function settle(st: HandState, ranks?: ReadonlyMap<SeatId, HandRank>): Settlement {
  if (st.street !== 'showdown' && st.street !== 'done') throw new Error('下注未结束不可结算');
  const { pots, refund } = potLayers(st);
  const payouts: Record<SeatId, number> = {};
  const credit = (seat: SeatId, amt: number): void => { payouts[seat] = (payouts[seat] ?? 0) + amt; };

  for (const pot of pots) {
    let winners: SeatId[];
    if (pot.eligible.length === 1 || st.uncontested !== undefined) {
      winners = st.uncontested !== undefined ? [st.uncontested] : [...pot.eligible];
    } else {
      if (!ranks) throw new Error('摊牌结算需要 ranks');
      let bestSeats: SeatId[] = [];
      let best: HandRank | null = null;
      for (const seat of pot.eligible) {
        const r = ranks.get(seat);
        if (!r) throw new Error(`缺少座位 ${seat} 的摊牌全序值`);
        const c = best === null ? 1 : compareRank(r, best);
        if (c > 0) { best = r; bestSeats = [seat]; }
        else if (c === 0) bestSeats.push(seat);
      }
      winners = bestSeats;
    }
    pot.winners = winners;
    const base = Math.floor(pot.amount / winners.length);
    let rem = pot.amount - base * winners.length;
    for (const w of winners) credit(w, base);
    // 奇数筹码：按钮后顺时针最先者优先（GDD §3「奇数筹码给位置靠前者」）；按钮自身=末位。
    const dist = (s: SeatId): number => (s - st.pos.button - 1 + SEAT_RING * 2) % SEAT_RING;
    const order = [...winners].sort((a, b) => dist(a) - dist(b));
    for (let i = 0; rem > 0; i++, rem--) credit(order[i % order.length], 1);
  }

  // 落账：池款/退回进栈，本手投入清零（手结清=筹码全在栈上；重复 settle 天然无款可派）。
  for (const p of st.players) {
    p.stack += (payouts[p.seat] ?? 0) + (refund?.seat === p.seat ? refund.amount : 0);
    p.total = 0;
    p.committed = 0;
  }
  return { pots, refund, payouts };
}

/** 深拷贝（AI 前瞻/测试脚本用；状态全 POD）。 */
export function cloneHand(st: HandState): HandState {
  return {
    ...st,
    players: st.players.map((p) => ({ ...p })),
    pos: { ...st.pos },
  };
}
