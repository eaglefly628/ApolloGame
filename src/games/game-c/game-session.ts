import type { Card } from '@engine/protocol/components.js';
import { mulberry32 } from '@atom-skills/random/index.js';
import {
  startHand, act, legalActions, settle, initialPositions, nextLiveSeat,
  type BettingConfig, type HandState, type Action, type SeatId, type Positions,
} from './betting-engine.js';
import { dealHoldem, holdemRank, bestOf7, HOLDEM_TYPE_ORDER, type HoldemDeal, type HandRank } from './holdem-eval.js';
import { CLOTHING_ITEMS } from './wardrobe.js';
import { HAND_NAME_CN } from './theme.js';
import { describeAction, cardStr, type GameEvent } from './game-log.js';

type Street = HandState['street'];

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》玩法会话（capability-plan §4-d 线性 session 脚本·game-e 先例明许）
//
//  职责：把 M1 逻辑核（holdem-eval 牌逻辑 + betting-engine 下注状态机）编排成**完整可玩一局**——
//    一手循环：发牌 → 收盲 → 翻前/翻牌/转牌/河牌下注圈（主角真操作 + 五姨太 AI）→ 摊牌 holdemRank 比牌
//    settle 分池 → 结算入栈 → 按钮轮转 → 淘汰（筹码 0 且无衣可当=剥光出局）→ 下一手 / 局终。
//    典当续命：筹码不足缴盲注点衣物换筹码（wardrobe 面值·owner 拍板自由点选）。
//  AI（占位·真行为树+读牌 oracle=M2·capability-plan §4-c）：种子 PRNG 简单手力策略（强跟/加·弱弃·不退化）——
//    **不作弊**：只读自己底牌 + 已揭示公共牌算手力，绝不看对手底牌/牌堆。
//  确定性：发牌 + AI 决策全走种子 PRNG（同 seed 同局·可回放/测试）。筹码是 sim 资源（3D 物理筹码=render-only 旁路）。
// ═══════════════════════════════════════════════════════════════

export interface SessionSeat {
  seat: SeatId; stack: number; pawned: Set<string>; eliminated: boolean; name: string;
}
export type SessionPhase = 'betting' | 'showdown' | 'gameover';
export interface ShowdownRowLite { seat: SeatId; type: string; best: Card[]; value: HandRank; won: number; hole: Card[]; }
export interface ShowdownResult { rows: ShowdownRowLite[]; winners: SeatId[]; potTotal: number; }

const SEAT_NAMES = ['主角', '大姨太', '二姨太', '三姨太', '四姨太', '五姨太'];

/** 手力粗估 0..1（AI 占位·不作弊：只看自己底牌 + 已揭示公共牌）。翻前按底牌，翻后按最优牌型档。 */
export function handStrength(hole: readonly Card[], community: readonly Card[]): number {
  if (hole.length < 2) return 0;
  if (community.length < 3) {
    const hi = Math.max(hole[0].rank, hole[1].rank), lo = Math.min(hole[0].rank, hole[1].rank);
    if (hole[0].rank === hole[1].rank) return Math.min(1, 0.55 + (hole[0].rank - 2) * 0.035); // 对子 0.55..1
    let s = 0.16 + (hi - 2) * 0.022 + (lo - 2) * 0.011;
    if (hole[0].suit === hole[1].suit) s += 0.06; // 同花
    if (hi - lo <= 2) s += 0.05; // 连张
    return Math.min(0.5, s);
  }
  const cards = [...hole, ...community]; // 5..7 张 → bestOf7 牌型档
  return Math.min(1, bestOf7(cards).value[0] / 8 + 0.06);
}

export class HoldemSession {
  readonly cfg: BettingConfig;
  private readonly seed: number;
  private readonly rng: () => number;
  seats: SessionSeat[];
  buttonSeat: SeatId = 0;
  pos: Positions;
  handNo = 0;
  hand: HandState | null = null;
  deal: HoldemDeal | null = null;
  phase: SessionPhase = 'betting';
  showdown: ShowdownResult | null = null;
  winnerSide: 'hero' | 'opponents' | null = null;
  events: GameEvent[] = []; // 实时牌局日志（查 bug·owner 2026-07-17）
  lastAggressor: SeatId | null = null; // 本手最后 bet/raise 者（摊牌 reveal 起点·标准德州）
  lastAction: Record<SeatId, string> = {}; // 各座上一动作文案（UI 行动气泡·CHECK/CALL 50/RAISE/FOLD）
  private dealIdxBySeat = new Map<SeatId, number>();
  private seq = 0;
  private lastStreet: Street = 'preflop';
  private recordAction(seat: SeatId, action: Action, toCall: number): void {
    const txt = action.kind === 'fold' ? '弃牌' : action.kind === 'check' ? '过牌'
      : action.kind === 'call' ? (toCall > 0 ? `跟注 ${toCall}` : '过牌') : `加注 ${action.to}`;
    this.lastAction[seat] = txt;
    if (action.kind === 'raise') this.lastAggressor = seat;
    this.log('action', describeAction(seat, action, toCall));
  }
  private log(tag: GameEvent['tag'], text: string): void { this.events.push({ seq: this.seq++, tag, text }); if (this.events.length > 200) this.events.shift(); }
  private logStreet(): void {
    if (!this.hand || !this.deal) return;
    const cur = this.hand.street;
    if (cur === this.lastStreet) return;
    this.lastStreet = cur;
    if (cur === 'flop') this.log('street', `🃏 翻牌 · ${this.deal.board.slice(0, 3).map(cardStr).join(' ')}`);
    else if (cur === 'turn') this.log('street', `🎴 转牌 · ${cardStr(this.deal.board[3])}`);
    else if (cur === 'river') this.log('street', `🀄 河牌 · ${cardStr(this.deal.board[4])}`);
  }

  constructor(seed = 20260717, cfg: BettingConfig = { smallBlind: 25, bigBlind: 50 }, startStack = 1000) {
    this.seed = seed; this.cfg = cfg; this.rng = mulberry32(seed);
    this.seats = [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: startStack, pawned: new Set<string>(), eliminated: false, name: SEAT_NAMES[seat] }));
    this.pos = initialPositions([0, 1, 2, 3, 4, 5], 0);
    this.startHand();
  }

  get hero(): SessionSeat { return this.seats[0]; }
  get isHeroTurn(): boolean { return this.phase === 'betting' && this.hand?.actor === 0; }
  get community(): Card[] {
    if (!this.deal || !this.hand) return [];
    const n = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5, done: 5 }[this.hand.street] ?? 0;
    return this.deal.board.slice(0, n);
  }
  pot(): number { return this.hand ? this.hand.players.reduce((a, p) => a + p.total, 0) : 0; }
  /** 座位手内实时筹码（UI 投影用·手内在 hand.players、手间在 session.stack）。 */
  stackOf(seat: SeatId): number { const p = this.hand?.players.find((x) => x.seat === seat); return p ? p.stack : this.seats[seat].stack; }
  /** 座位本街已投入注（UI 投影·座位卡「注 N」）。 */
  committedOf(seat: SeatId): number { return this.hand?.players.find((x) => x.seat === seat)?.committed ?? 0; }
  /** 座位本手累计投入（3D 物理筹码抛掷 diff 用·只增不减·街收池不回退）。 */
  totalOf(seat: SeatId): number { return this.hand?.players.find((x) => x.seat === seat)?.total ?? 0; }
  /** 座位本手是否弃牌 / 全下（UI 状态徽章）。 */
  seatState(seat: SeatId): { folded: boolean; allIn: boolean } {
    const p = this.hand?.players.find((x) => x.seat === seat);
    return { folded: p?.folded ?? false, allIn: p?.allIn ?? false };
  }
  private live(): SeatId[] { return this.seats.filter((s) => !s.eliminated).map((s) => s.seat); }
  wardrobeLeft(seat: SeatId): number { return CLOTHING_ITEMS.length - this.seats[seat].pawned.size; }
  holeOf(seat: SeatId): Card[] {
    const idx = this.dealIdxBySeat.get(seat);
    return this.deal && idx !== undefined ? this.deal.holes[idx] : [];
  }
  legalForHero(): ReturnType<typeof legalActions> | null {
    return this.isHeroTurn && this.hand ? legalActions(this.hand) : null;
  }

  // ── 开一手（缴盲前自动典当续命 → 淘汰无衣者 → 定位 → 发牌 → 收盲 → 推进）─────────────
  private startHand(): void {
    for (const seat of this.live()) this.autoPawnIfBroke(seat);
    for (const s of this.seats) if (!s.eliminated && s.stack <= 0 && this.wardrobeLeft(s.seat) === 0) s.eliminated = true;
    const live = this.live();
    if (live.length < 2) { this.endGame(); return; }
    if (!live.includes(this.buttonSeat)) this.buttonSeat = nextLiveSeat(live, this.buttonSeat);
    this.pos = initialPositions(live, this.buttonSeat);
    this.handNo += 1;
    this.deal = dealHoldem(this.seed + this.handNo * 7919, live.length);
    this.dealIdxBySeat = new Map(live.map((seat, i) => [seat, i]));
    this.hand = startHand(this.cfg, live.map((seat) => ({ seat, stack: this.seats[seat].stack })), this.pos);
    this.phase = 'betting'; this.showdown = null; this.lastStreet = 'preflop';
    this.lastAggressor = null; this.lastAction = {};
    this.log('deal', `🎲 第 ${this.handNo} 手 · 发牌 · ${live.length} 家 · 主角底牌 ${this.holeOf(0).map(cardStr).join(' ')}`);
    this.log('blind', `🔵 小盲 座${this.pos.sb} ${this.cfg.smallBlind} · 大盲 座${this.pos.bb} ${this.cfg.bigBlind}`);
    this.settleIfDone(); // 罕见：发牌即全 all-in → 直接摊牌（否则等宿主 timer 逐步推进 AI）
  }

  // ── 典当（点哪件当哪件·owner 拍板）+ 缴盲兜底 ────────────────────
  // REQ-C-106 裁定（PE-C 2026-07-18）=**手内即时生效**（续命本意：点衣换筹当下就能跟注）。
  //   同步当前手 hand.players 栈——① 本手下注即可用刚换的筹码；② 经 settle 的 syncStacks 保全
  //   （旧码只加 session.seats.stack·手内不同步且被 syncStacks 覆盖→蒸发·守恒破）。
  //   边界：已 all-in（本手已打光坐庄旁观）者不就地解 all-in（避免重开已闭合行动）——加的筹码随
  //   syncStacks 落到局级栈·下一手 startHand 即用；未 all-in 者（正常续命流：面注→点当→跟）当下可用。
  pawn(seat: SeatId, itemId: string): boolean {
    const s = this.seats[seat];
    const item = CLOTHING_ITEMS.find((c) => c.id === itemId);
    if (!item || s.pawned.has(itemId) || s.eliminated) return false;
    s.pawned.add(itemId); s.stack += item.value;
    const p = this.hand?.players.find((x) => x.seat === seat);
    if (p) p.stack += item.value; // 手内同步（守恒·可用）；all-in 标志不动=换来的筹码顺延下一手
    return true;
  }
  private autoPawnIfBroke(seat: SeatId): void {
    const s = this.seats[seat];
    const remaining = CLOTHING_ITEMS.filter((c) => !s.pawned.has(c.id)).sort((a, b) => a.value - b.value);
    let i = 0;
    while (s.stack < this.cfg.bigBlind && i < remaining.length) { this.pawn(seat, remaining[i].id); i++; }
  }

  /** 主角输入是否合法（对照 legalActions 单一真相；raise 落在 [min,max] 即合法）。 */
  private heroActionLegal(action: Action): boolean {
    if (!this.hand) return false;
    const la = legalActions(this.hand);
    switch (action.kind) {
      case 'fold': return la.fold;
      case 'check': return !!la.check;
      case 'call': return la.call !== undefined;
      case 'raise': return !!la.raise && action.to >= la.raise.min && action.to <= la.raise.max;
    }
  }

  // ── 主角行动（分步·宿主 timer 接管 AI 节奏·不自动循环）──────────────
  heroAct(action: Action): void {
    if (!this.isHeroTurn || !this.hand) return;
    // 防御 no-op（REQ-C-108② GD-C 裁引擎层）：非法输入如「非主角轮」一样静默拒绝——真 UI 里非法键本就置灰
    //   不可点，heroAct 收到越界输入应态不变，而非把 act() 的 throw 冒泡崩掉宿主。合法性单一真相在 betting-engine。
    if (!this.heroActionLegal(action)) return;
    const toCall = this.hand.currentBet - (this.hand.players.find((p) => p.seat === 0)?.committed ?? 0);
    act(this.hand, 0, action);
    this.recordAction(0, action, toCall);
    this.logStreet();
    this.settleIfDone();
  }

  // ── 分步演出 API（宿主 timer 逐个驱动·可观察「轮到谁思考/行动」·标准德州节奏）─────
  /** 是否有 AI 待行动（宿主 timer 每拍调 stepAI）。主角轮 / 摊牌 / 局终时 false。 */
  get pendingAI(): boolean {
    return this.phase === 'betting' && !!this.hand && this.hand.street !== 'showdown' && this.hand.street !== 'done'
      && this.hand.actor !== null && this.hand.actor !== 0;
  }
  /** 执行一个 AI 行动（分步·不循环）。返回刚行动的座位供 UI 高亮/气泡；街闭合/摊牌自动结算。 */
  stepAI(): SeatId | null {
    if (!this.pendingAI || !this.hand) { this.settleIfDone(); return null; }
    const seat = this.hand.actor!;
    const la = legalActions(this.hand);
    const toCall = la.call ?? 0;
    const action = this.aiDecide(seat, la);
    act(this.hand, seat, action);
    this.recordAction(seat, action, toCall);
    this.logStreet();
    this.settleIfDone();
    return seat;
  }
  private aiDecide(seat: SeatId, la: ReturnType<typeof legalActions>): Action {
    if (!this.hand) return { kind: 'fold' };
    const s = handStrength(this.holeOf(seat), this.community) + (this.rng() - 0.5) * 0.18;
    const toCall = la.call ?? 0;
    const pot = this.pot();
    // 加注额必须落在合法区间 [min,max]（min=当前注+上一完整加注增量；不足 min 只能整栈 all-in=max）。
    // ⚠曾只 Math.min(max,…) 不夹下界：面对大 lastRaiseSize 时按池比定的目标 < min 且 ≠ 全下 → act 抛「不足 min-raise」崩手
    // （主角先下大注→AI 再加注即触发·会话 fuzz 抓出）。夹到 [min,max] 恒合法。
    const raiseTo = (r: { min: number; max: number }, desired: number): number => Math.max(r.min, Math.min(r.max, desired));
    if (toCall > 0) {
      // 面对下注：强牌再加注（价值/施压）→ 合理牌跟注 → 便宜时宽跟 → 垃圾牌弃（占位策略·不作弊）。
      if (s > 0.66 && la.raise) return { kind: 'raise', to: raiseTo(la.raise, this.hand.currentBet + Math.max(this.cfg.bigBlind, Math.round(pot * 0.6))) };
      if (s > 0.30) return { kind: 'call' };
      if (toCall <= this.cfg.bigBlind && s > 0.20) return { kind: 'call' }; // 便宜牌宽跟（限进/守大盲）
      return { kind: 'fold' };
    }
    // 无注可跟（可过）：两对+/对子档价值下注 → 其余过牌（让牌局有真实下注/加注节奏·非纯过牌到底）。
    if (s > 0.34 && la.raise) return { kind: 'raise', to: raiseTo(la.raise, la.raise.min + Math.round(pot * 0.5)) };
    return la.check ? { kind: 'check' } : { kind: 'fold' };
  }
  private settleIfDone(): void {
    if (!this.hand || this.phase !== 'betting') return;
    if (this.hand.street === 'showdown') this.doShowdown();
    else if (this.hand.street === 'done') this.doUncontested();
  }

  // ── 摊牌（牌逻辑核心：holdemRank 比牌 → settle 分池 → 结算入栈）───────────
  private doShowdown(): void {
    if (!this.hand || !this.deal) return;
    const board = this.deal.board;
    const ranked = this.hand.players.filter((p) => !p.folded).map((p) => {
      const r = holdemRank(this.holeOf(p.seat), board);
      return { seat: p.seat, value: r.value, best: r.best, type: HAND_NAME_CN[HOLDEM_TYPE_ORDER[r.value[0]]] ?? '' };
    }).sort((a, b) => cmpRank(b.value, a.value) || (a.seat - b.seat));
    const potTotal = this.pot();
    const s = settle(this.hand, new Map<SeatId, HandRank>(ranked.map((r) => [r.seat, r.value])));
    this.syncStacks();
    const winners = ranked.map((r) => r.seat).filter((seat) => (s.payouts[seat] ?? 0) > 0);
    // 摊牌展示顺序（标准德州·WebSearch 确认）：last aggressor 先亮·全 check 则 button 左手先·顺时针依次。
    const contenders = ranked.map((r) => r.seat);
    const byseat = new Map(ranked.map((r) => [r.seat, r]));
    this.showdown = {
      rows: this.revealOrder(contenders).map((seat) => {
        const r = byseat.get(seat)!;
        return { seat, type: r.type, best: r.best, value: r.value, won: s.payouts[seat] ?? 0, hole: this.holeOf(seat) };
      }),
      winners, potTotal,
    };
    for (const seat of this.revealOrder(contenders)) {
      const r = byseat.get(seat)!;
      this.log('showdown', `${winners.includes(seat) ? '🏆' : '·'} ${this.seats[seat].name} · ${r.type} · ${r.best.map(cardStr).join(' ')}`);
    }
    this.phase = 'showdown';
  }
  /** 摊牌 reveal 顺序：last aggressor 起（有下注）/ button 左手起（全 check），顺时针取摊牌者。 */
  private revealOrder(contenders: SeatId[]): SeatId[] {
    if (!this.hand) return contenders;
    const set = new Set(contenders);
    const all = this.hand.players.map((p) => p.seat);
    let cur = this.lastAggressor !== null && set.has(this.lastAggressor) ? this.lastAggressor : nextLiveSeat(all, this.buttonSeat);
    const order: SeatId[] = [];
    for (let i = 0; i < all.length + 6 && order.length < contenders.length; i++) {
      if (set.has(cur) && !order.includes(cur)) order.push(cur);
      if (order.length >= contenders.length) break;
      cur = nextLiveSeat(all, cur);
    }
    return order;
  }
  private doUncontested(): void {
    if (!this.hand) return;
    const potTotal = this.pot();
    const s = settle(this.hand);
    this.syncStacks();
    const w = this.hand.uncontested ?? this.hand.players.find((p) => !p.folded)?.seat ?? 0;
    this.showdown = { rows: [{ seat: w, type: '（全弃收池·无摊牌）', best: [], value: [0], won: s.payouts[w] ?? 0, hole: [] }], winners: [w], potTotal };
    this.log('showdown', `🏆 ${this.seats[w].name} 收池 ${potTotal}（对手全弃）`);
    this.phase = 'showdown';
  }
  /** betting-engine.settle 已把款项写进 HandState.players[].stack；同步回 session 局级栈。 */
  private syncStacks(): void {
    for (const s of this.seats) {
      const p = this.hand?.players.find((x) => x.seat === s.seat);
      if (p) s.stack = p.stack;
    }
  }

  // ── 下一手 / 局终（摊牌屏「继续」时调）─────────────────────────
  nextHand(): void {
    if (this.phase === 'gameover') return;
    for (const s of this.seats) if (!s.eliminated && s.stack <= 0 && this.wardrobeLeft(s.seat) === 0) s.eliminated = true;
    if (this.hero.eliminated) { this.winnerSide = 'opponents'; this.phase = 'gameover'; return; }
    if (this.seats.slice(1).every((s) => s.eliminated)) { this.winnerSide = 'hero'; this.phase = 'gameover'; return; }
    this.buttonSeat = nextLiveSeat(this.live(), this.buttonSeat);
    this.startHand();
  }
  private endGame(): void {
    this.winnerSide = this.hero.eliminated || this.hero.stack <= 0 ? 'opponents' : 'hero';
    this.phase = 'gameover';
  }
  stats(): { hands: number; heroChips: number; heroPawned: number } {
    return { hands: this.handNo, heroChips: this.hero.stack, heroPawned: this.hero.pawned.size };
  }
}

function cmpRank(a: HandRank, b: HandRank): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
