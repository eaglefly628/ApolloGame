// Game A ·《掼蛋夜宴》—— 盘循环编排脚本（GuandanSession·capability-plan §4 例外①·owner 过审）。
//
// ★ 形态声明（照 game-e session.ts 正样例·手册 cards.md §②钦定）：盘间流程是一段**线性、过程化的编排脚本**——
//   发牌→[进贡/还贡/抗贡]→墩圈轮转→盘结算→升级→run 终局。脚本只做编排，不含判型/压制/AI 策略逻辑：
//   · 判型/压制/候选 = 引擎 t3-hand-pattern 纯函数（config 数据在 rules.ts·A-S1 条件②）
//   · AI 策略        = t2-behavior-tree 数据树 + ai.ts 候选估值 glue（例外②）
//   · 随机           = mulberry32/seededShuffle 种子 PRNG（**零裸 Math.random**）
//   · 黑板/资源镜像  = 内嵌 Engine world（blueprint.ts·Resource/Flag=UI 绑定与 BT 黑板）
// 确定性：同 {seed, stake, tier} + 同 hero 输入序列 → 同全程（walkthrough 测试钉死双跑）。
// A-004 对照结论：t3-flow 声明式转移表达不了「四家轮转+墩圈计数+接风」算法环 → 按例外①落此脚本；
//   flow 保留在蓝图管粗相位（boot→table-idle），细轮转归本脚本（结论回填 requests.md A-004）。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { Card, RandomSeed, Resource } from '@zerocraft/engine/engine/protocol/components.js';
import { mulberry32, seededShuffle } from '@zerocraft/engine/atom-skills/index.js';
import { matchPattern, beats, legalResponses, effRank, type HandPatternConfig, type PatternMatch } from '@zerocraft/engine/skills/tier3/index.js';
import { buildTableBlueprint } from './blueprint.js';
import { chooseTurn, personalityOf, pickLead, pickMinResponse, type Personality } from './ai.js';
import {
  buildDeck108, guandanConfig, codeRank, codeSuit, SEATS, HAND_SIZE,
  INITIAL_FUNDS, RESULT_MULTS, BONUS_RESIST_MULT, BONUS_SKY_MULT, ROUND_MULT_CAP,
  DRESS_TIERS, DRESS_OUT_MONEY_MULT, LEVEL_START, LEVEL_UPS, LEVEL_ACE,
  RANK_BIG_JOKER, SUIT_HEART, type SeatSpec, type AiTierSpec,
} from './rules.js';

export type SeatId = SeatSpec['id'];
/** 行牌序（逆时针·南→西→北→东）。 */
export const TURN_ORDER: readonly SeatId[] = ['hero', 'west', 'partner', 'east'];
export const teamOf = (seat: SeatId): 0 | 1 => (seat === 'hero' || seat === 'partner' ? 0 : 1);
export const partnerOf = (seat: SeatId): SeatId =>
  seat === 'hero' ? 'partner' : seat === 'partner' ? 'hero' : seat === 'west' ? 'east' : 'west';

export const FAMILY_CN: Record<string, string> = {
  single: '单张', pair: '对子', triple: '三同张', full: '三带二', straight: '顺子',
  tube: '三连对', plate: '钢板', bomb: '炸弹', 'straight-flush': '同花顺', sky: '四大天王',
};

// ── 诊断日志（owner 调试期·浏览器 F12 console 对照出牌 ↔ 判型）─────────────────────
// 浏览器默认开（owner 对照牌型）；测试环境默认静音（门禁输出干净）。运行时可 setPlayDebug 切换。
let PLAY_DEBUG = typeof process === 'undefined' || !process.env?.VITEST;
export function setPlayDebug(on: boolean): void {
  PLAY_DEBUG = on;
}
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const RANK_GLYPH: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '小王', 16: '大王' };
/**
 * 牌码 → 可读（♠9 / 大王）。给 playLevel 时，红桃级牌=逢人配（百搭）标 🃏——
 * 让玩家看懂「2-6-7-8-9 顺子」「QQQ+KK+♥2 钢板」这类含百搭的合法牌型（owner 2026-07-18 困惑根因）。
 */
export function fmtCardCode(code: number, playLevel?: number): string {
  const r = codeRank(code);
  if (r >= 15) return RANK_GLYPH[r];
  const base = `${SUIT_GLYPH[codeSuit(code)]}${RANK_GLYPH[r] ?? r}`;
  return playLevel !== undefined && codeSuit(code) === SUIT_HEART && r === playLevel ? `${base}🃏` : base;
}
/** 一手牌 → 可读串（供日志/调试）；playLevel 在场则标逢人配。 */
export function fmtHand(codes: readonly number[], playLevel?: number): string {
  return codes.map((c) => fmtCardCode(c, playLevel)).join(' ');
}

// 出牌日志条目（宿主可读·也 console 输出）。
export interface PlayLogEntry {
  round: number;
  seat: SeatId;
  seatName: string;
  action: 'lead' | 'follow' | 'pass';
  cards: number[];
  family: string | null; // 判型（pass=null）
  tier: number | null;
  wilds: number; // 本手用的逢人配（红桃级牌百搭）张数——让玩家看懂含百搭的合法牌型
  beatWhat: string | null; // 压过的当前墩描述（领出/pass=null）
}

export interface TrickPlay {
  seat: SeatId;
  cards: number[];
  match: PatternMatch;
}
export interface TributeRecord {
  from: SeatId;
  to: SeatId;
  card: number;
  returned: number | null; // 还贡牌（抗贡时无记录）
}
export type Combo = 'double' | 'first-third' | 'first-fourth';
export interface RoundResult {
  ranking: SeatId[];
  winnersTeam: 0 | 1;
  combo: Combo;
  baseMult: number;
  bonusResist: number;
  bonusSky: number;
  totalMult: number; // 封顶后
  dressOutDoubled: boolean; // 输方有人已在底线档 → 金钱罚 ×2
  payPerPlayer: number; // 每人收付额（已含 ×2）
  levelUp: number;
  levelAfter: [number, number];
  aResult: 'none' | 'passed' | 'stay'; // 打 A 局：过 / 一四不过（停 A 重打）
}
export type Phase = 'playing' | 'settled' | 'run-won' | 'run-lost';

export interface SessionOptions {
  seed: number;
  stake?: number;
  tier?: AiTierSpec['id']; // 三家 AI 同档（公平·gdd §5）
}

export class GuandanSession {
  readonly seed: number;
  readonly stake: number;
  readonly tier: AiTierSpec['id'];
  private rng: () => number;
  /** 黑板/资源镜像世界（blueprint 装配·BT tick 与 UI 绑定共用）。 */
  readonly engine: Engine;

  round = 0;
  phase: Phase = 'playing';
  levels: [number, number] = [LEVEL_START, LEVEL_START];
  playLevel = LEVEL_START;
  cfg: HandPatternConfig = guandanConfig(LEVEL_START);
  wallets: Record<SeatId, number> = { hero: INITIAL_FUNDS, partner: INITIAL_FUNDS, west: INITIAL_FUNDS, east: INITIAL_FUNDS };
  dress: Record<SeatId, number> = { hero: DRESS_TIERS, partner: DRESS_TIERS, west: DRESS_TIERS, east: DRESS_TIERS };
  hands: Record<SeatId, number[]> = { hero: [], partner: [], west: [], east: [] };
  /** 本盘起始手牌快照（发牌+进贡后·play 前）——供「本盘完整记录」复制给作者分析 AI 强弱（owner 2026-07-18）。 */
  initialHands: Record<SeatId, number[]> = { hero: [], partner: [], west: [], east: [] };
  finished: SeatId[] = [];
  lastRanking: SeatId[] | null = null;
  lastFirstTeam: 0 | 1 = 0;
  turn: SeatId = 'hero';
  currentTrick: TrickPlay | null = null;
  /** 本墩各座最近一手（座前小牌桌显示·像真扑克·出=牌+型，过=pass）；收墩清空。UI 镜像·非规则真相。 */
  seatPlay: Partial<Record<SeatId, { cards: number[]; family: string | null; pass: boolean }>> = {};
  /** 最近落子座（座前牌入场动效只播它·防全桌/上一张一起重播·UI 镜像·非规则真相）。startRound 清 null。 */
  lastPlayed: SeatId | null = null;
  /** 本墩已应对（过牌/被压后再表态）的座位计数。 */
  private responded = 0;
  /** 本墩需应对的活跃座数（=除持墩者外的活跃座）；responded 达此数即收墩。 */
  private respondersNeeded = 0;
  tributes: TributeRecord[] = [];
  resisted = false; // 本盘抗贡
  lastResult: RoundResult | null = null;
  /** 宗师偷看记录（AI 座 → 其每个对手被看的 2 张·发牌期种子化·UI 明示用）。 */
  peeks: Partial<Record<SeatId, Partial<Record<SeatId, number[]>>>> = {};
  /** 头游走科的最后一手（天王炸终结彩头判定）。 */
  private winnerLastPlay: PatternMatch | null = null;
  /** 出牌流水（owner 诊断·每手一条·宿主可读 + PLAY_DEBUG 时 console 输出）。 */
  playLog: PlayLogEntry[] = [];

  private logPlay(seat: SeatId, action: PlayLogEntry['action'], codes: number[], match: PatternMatch | null): void {
    const beatWhat =
      action === 'follow' && this.currentTrick
        ? `${FAMILY_CN[this.currentTrick.match.family] ?? this.currentTrick.match.family} ${fmtHand(this.currentTrick.cards, this.playLevel)}`
        : null;
    const entry: PlayLogEntry = {
      round: this.round,
      seat,
      seatName: SEATS.find((s) => s.id === seat)?.name ?? seat,
      action,
      cards: [...codes],
      family: match?.family ?? null,
      tier: match?.tier ?? null,
      wilds: match?.wildsUsed ?? 0,
      beatWhat,
    };
    this.playLog.push(entry);
    if (PLAY_DEBUG && typeof console !== 'undefined') {
      if (action === 'pass') {
        console.log(`[掼蛋·第${entry.round}盘] ${entry.seatName} 过`);
      } else {
        const wildTag = match && match.wildsUsed > 0 ? `·含${match.wildsUsed}张逢人配` : '';
        const fam = match ? `${FAMILY_CN[match.family] ?? match.family}(tier${match.tier})${wildTag}` : '?';
        const tail = beatWhat ? ` ⟶ 压过 ${beatWhat}` : '（领出）';
        console.log(`[掼蛋·第${entry.round}盘] ${entry.seatName} ${action === 'lead' ? '领出' : '跟'} ${fmtHand(codes, this.playLevel)} = ${fam}${tail}`);
      }
    }
  }

  constructor(opts: SessionOptions) {
    this.seed = opts.seed;
    this.stake = opts.stake ?? 100;
    this.tier = opts.tier ?? 'l1';
    this.rng = mulberry32(opts.seed);
    this.engine = new Engine();
    this.engine.load(buildTableBlueprint({ seed: opts.seed, stake: this.stake }));
    this.startRound();
  }

  // ── 盘生命周期 ─────────────────────────────────────────────────────────────
  startRound(): void {
    this.round += 1;
    this.playLevel = this.levels[this.lastFirstTeam]; // R4 默认：打上盘头游队当前级（首盘=2）
    this.cfg = guandanConfig(this.playLevel);
    this.finished = [];
    this.currentTrick = null;
    this.seatPlay = {};
    this.lastPlayed = null;
    this.responded = 0;
    this.respondersNeeded = 0;
    this.tributes = [];
    this.resisted = false;
    this.winnerLastPlay = null;
    this.lastResult = null;
    this.phase = 'playing';

    // 发牌（种子洗牌·27×4 逆时针）
    const deck = seededShuffle(buildDeck108(), Math.floor(this.rng() * 0x7fffffff));
    for (const [i, seat] of TURN_ORDER.entries()) {
      this.hands[seat] = deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE);
      this.sortHand(seat);
    }

    // 进贡/还贡/抗贡（G1-G4）→ 定首出
    let leader: SeatId;
    if (this.round === 1 || !this.lastRanking) {
      leader = TURN_ORDER[Math.floor(this.rng() * TURN_ORDER.length)]; // R6 首盘种子定家
    } else {
      leader = this.resolveTribute(this.lastRanking);
    }
    this.turn = leader;

    // 宗师偷看（L4·发牌期种子化取每对手 2 张·公平告知=UI 明示）
    this.peeks = {};
    if (this.tier === 'l4') {
      for (const seat of TURN_ORDER) {
        if (seat === 'hero') continue;
        const mine: Partial<Record<SeatId, number[]>> = {};
        for (const opp of TURN_ORDER) {
          if (teamOf(opp) === teamOf(seat)) continue;
          const h = this.hands[opp];
          const a = Math.floor(this.rng() * h.length);
          let b = Math.floor(this.rng() * h.length);
          if (b === a) b = (b + 1) % h.length;
          mine[opp] = [h[a], h[b]];
        }
        this.peeks[seat] = mine;
      }
    }
    this.mirrorToWorld();

    // 本盘起始手牌快照（发牌+进贡后·play 前）——供「本盘完整记录」复制 + console 落底（F12 兜底·owner 分析 AI 用）。
    for (const seat of TURN_ORDER) this.initialHands[seat] = [...this.hands[seat]];
    if (PLAY_DEBUG && typeof console !== 'undefined') {
      console.log(`[掼蛋·第${this.round}盘·发牌] 打${this.playLevel} seed=${this.seed} · ` +
        TURN_ORDER.map((s) => `${SEATS.find((x) => x.id === s)?.name}:${fmtHand(this.initialHands[s], this.playLevel)}`).join(' ｜ '));
    }
  }

  /**
   * 本盘完整记录（起始四家手牌 + 进贡 + 逐手出牌流水 + 结果）——玩家复制贴给作者分析 AI 强弱（owner 2026-07-18）。
   * 取本盘（this.round）；结算屏调=刚打完那盘、菜单中调=进行中那盘。
   */
  roundTranscript(): string {
    const nameOf = (s: SeatId): string => (SEATS.find((x) => x.id === s)?.name ?? s) + (s === 'hero' ? '(你)' : '');
    const lines: string[] = [
      `《掼蛋夜宴》第 ${this.round} 盘 · 打 ${this.playLevel} · seed=${this.seed} · 难度=${this.tier}`,
      '— 起始手牌（发牌+进贡后）—',
      ...TURN_ORDER.map((s) => `  ${nameOf(s)}：${fmtHand(this.initialHands[s], this.playLevel)}`),
    ];
    if (this.tributes.length) {
      lines.push('— 进贡 —');
      for (const t of this.tributes) lines.push(`  ${nameOf(t.from)} → ${nameOf(t.to)}：${fmtCardCode(t.card, this.playLevel)}${t.returned != null ? `（还 ${fmtCardCode(t.returned, this.playLevel)}）` : ''}`);
    }
    lines.push('— 出牌流水 —');
    for (const e of this.playLog.filter((x) => x.round === this.round)) {
      if (e.action === 'pass') lines.push(`  ${e.seatName} 过`);
      else lines.push(`  ${e.seatName} ${e.action === 'lead' ? '领出' : '跟'} ${fmtHand(e.cards, this.playLevel)} = ${FAMILY_CN[e.family!] ?? e.family}${e.wilds > 0 ? `（含${e.wilds}逢人配）` : ''}`);
    }
    if (this.lastResult) {
      const r = this.lastResult;
      lines.push('— 结果 —', `  名次：${r.ranking.map(nameOf).join(' > ')} · ${r.combo} · 我方级 ${r.levelAfter[0]} / 对方级 ${r.levelAfter[1]}`);
    }
    return lines.join('\n');
  }

  /** 次盘起进贡结算；返回首出座。 */
  private resolveTribute(rank: SeatId[]): SeatId {
    const doubleDown = teamOf(rank[2]) === teamOf(rank[3]); // 对方一二 → 双下
    const givers: SeatId[] = doubleDown ? [rank[2], rank[3]] : [rank[3]];
    const receivers: SeatId[] = doubleDown ? [rank[0], rank[1]] : [rank[0]];

    // G3 抗贡：应贡方合计持双大王 → 免贡·头游先出
    const bjCount = givers.reduce((n, s) => n + this.hands[s].filter((c) => codeRank(c) === RANK_BIG_JOKER).length, 0);
    if (bjCount >= 2) {
      this.resisted = true;
      return rank[0];
    }

    // 进贡：各交最大牌（红桃级牌除外）；双下大者归头游、次者归二游
    const paid = givers
      .map((from) => ({ from, card: this.takeTributeCard(from) }))
      .sort((a, b) => this.effOf(b.card) - this.effOf(a.card));
    for (const [i, p] of paid.entries()) {
      const to = receivers[Math.min(i, receivers.length - 1)];
      this.hands[to].push(p.card);
      this.sortHand(to);
      // 还贡 ≤10（自动策略：最小的 ≤10 非逢人配；hero 选牌 UI=S5 SC-3 Modal 接）
      const back = this.takeReturnCard(to);
      this.hands[p.from].push(back);
      this.sortHand(p.from);
      this.tributes.push({ from: p.from, to, card: p.card, returned: back });
    }
    // 首出：单下=进贡者；双下=进大贡者
    return doubleDown ? paid[0].from : givers[0];
  }

  private effOf(code: number): number {
    return effRank(codeRank(code), this.cfg);
  }
  private isWild(code: number): boolean {
    return codeSuit(code) === SUIT_HEART && codeRank(code) === this.playLevel;
  }
  private takeTributeCard(seat: SeatId): number {
    const h = this.hands[seat];
    const pool = h.filter((c) => !this.isWild(c));
    const pick = (pool.length > 0 ? pool : h).reduce((a, b) => (this.effOf(b) > this.effOf(a) ? b : a));
    h.splice(h.indexOf(pick), 1);
    return pick;
  }
  private takeReturnCard(seat: SeatId): number {
    const h = this.hands[seat];
    const low = h.filter((c) => codeRank(c) <= 10 && !this.isWild(c));
    const pool = low.length > 0 ? low : h;
    const pick = pool.reduce((a, b) => (this.effOf(b) < this.effOf(a) ? b : a));
    h.splice(h.indexOf(pick), 1);
    return pick;
  }

  // ── 行牌 ──────────────────────────────────────────────────────────────────
  private isActive(seat: SeatId): boolean {
    return this.hands[seat].length > 0;
  }
  private actives(): SeatId[] {
    return TURN_ORDER.filter((s) => this.isActive(s));
  }
  private nextActiveAfter(seat: SeatId): SeatId {
    const i = TURN_ORDER.indexOf(seat);
    for (let k = 1; k <= TURN_ORDER.length; k++) {
      const s = TURN_ORDER[(i + k) % TURN_ORDER.length];
      if (this.isActive(s)) return s;
    }
    return seat;
  }

  toCards(codes: readonly number[]): Card[] {
    return codes.map((c) => ({ suit: codeSuit(c), rank: codeRank(c) }));
  }

  /** 领出=任意合法牌型；应对=能压住当前墩。null=过（领出不可过）。 */
  legalCheck(seat: SeatId, codes: number[] | null): { ok: boolean; why?: string; match?: PatternMatch } {
    if (this.phase !== 'playing') return { ok: false, why: '盘已结束' };
    if (this.turn !== seat) return { ok: false, why: '未轮到' };
    if (codes === null) {
      if (!this.currentTrick) return { ok: false, why: '领出不可过' };
      return { ok: true };
    }
    const hand = [...this.hands[seat]];
    for (const c of codes) {
      const i = hand.indexOf(c);
      if (i < 0) return { ok: false, why: '所选牌不在手' };
      hand.splice(i, 1);
    }
    const m = matchPattern(this.toCards(codes), this.cfg);
    if (!m) return { ok: false, why: '不是合法牌型' };
    if (this.currentTrick && !beats(this.toCards(codes), this.toCards(this.currentTrick.cards), this.cfg)) {
      return { ok: false, why: '压不过当前墩' };
    }
    return { ok: true, match: m };
  }

  /** 出牌/过（hero 与 AI 共用推进口）。返回 false=非法（状态不变）。 */
  act(seat: SeatId, codes: number[] | null): boolean {
    const chk = this.legalCheck(seat, codes);
    if (!chk.ok) return false;
    this.lastPlayed = seat; // 最近落子座（座前牌入场动效只播它·防全桌/上一张一起重播·owner 2026-07-20）

    if (codes === null) {
      this.logPlay(seat, 'pass', [], null); // 读旧墩前记（此处 pass 无墩引用）
      this.seatPlay[seat] = { cards: [], family: null, pass: true }; // 座前小牌桌：本墩此座过
      this.responded += 1;
    } else {
      const isLead = this.currentTrick === null;
      this.logPlay(seat, isLead ? 'lead' : 'follow', codes, chk.match!); // 记在 currentTrick 更新前（beatWhat 读旧墩）
      for (const c of codes) this.hands[seat].splice(this.hands[seat].indexOf(c), 1);
      if (isLead) this.seatPlay = {}; // 新墩领出=清上墩座前牌，本座重记
      this.seatPlay[seat] = { cards: [...codes], family: chk.match!.family, pass: false }; // 座前小牌桌：本墩此座出的牌
      this.currentTrick = { seat, cards: codes, match: chk.match! };
      if (this.hands[seat].length === 0) {
        this.finished.push(seat);
        if (this.finished.length === 1) this.winnerLastPlay = chk.match!;
      }
      // 新墩：除持墩者（若仍活跃）外的活跃座各需应对一轮。出光则不占分母（不在 actives 内）。
      this.responded = 0;
      this.respondersNeeded = this.actives().length - (this.isActive(seat) ? 1 : 0);
    }

    // 盘终判定：三家走科 或 一队双走科（余下名次按 手牌少→行牌序 补齐）
    const firstTwoSameTeam = this.finished.length >= 2 && teamOf(this.finished[0]) === teamOf(this.finished[1]);
    if (this.finished.length >= 3 || firstTwoSameTeam) {
      const rest = TURN_ORDER.filter((x) => !this.finished.includes(x)).sort(
        (a, b) => this.hands[a].length - this.hands[b].length || TURN_ORDER.indexOf(a) - TURN_ORDER.indexOf(b),
      );
      this.settleRound([...this.finished, ...rest]);
      return true;
    }

    // 收墩：其他活跃座全部应对完（含持墩者出光的情形）→ 墩归持墩者；
    // 持墩者活跃=领出；出光=队友接风；队友也出光=下一活跃座领出（轮转永不指向出光座·治卡死根因）。
    if (this.currentTrick && this.responded >= this.respondersNeeded) {
      const holder = this.currentTrick.seat;
      this.currentTrick = null;
      this.responded = 0;
      this.respondersNeeded = 0;
      this.turn = this.isActive(holder)
        ? holder
        : this.isActive(partnerOf(holder))
          ? partnerOf(holder)
          : this.nextActiveAfter(holder);
      return true;
    }
    this.turn = this.nextActiveAfter(seat);
    return true;
  }

  /**
   * 提示（gdd 二轮拍板·各难度一致·与 AI 同一启发）：
   *   · 领出（无当前墩）= pickLead（先出小牌·保留大牌·倾长倒库存·不领炸/不拆炸）——修「提示恒给最小单张」。
   *   · 应对（有当前墩）= pickMinResponse（最小的不拆炸压牌·省大牌）；只剩拆炸的压牌返回 null=建议过（炸留反压）。
   * 返回牌码数组（宿主按显示顺序映射成下标高亮）；null=领不出/无非拆炸可压（只能过）。
   * 应对经 legalBeats 防御性复核（见其注·引擎判读歧义 A-008 已修 `214fc846`·复核幂等·保证提示牌点出去必被 act 收）。
   */
  hint(seat: SeatId): number[] | null {
    const hand = this.toCards(this.hands[seat]);
    const target = this.currentTrick ? this.toCards(this.currentTrick.cards) : null;
    const responses = this.legalBeats(hand, target);
    // 传 hand → 提示尽量不拆 ≥3 组（owner 2026-07-18「别拆我三条凑对子」）。
    const pick = target === null ? pickLead(responses, this.cfg, hand) : pickMinResponse(responses, this.cfg, hand);
    return pick ? pick.cards.map((c) => c.suit * 100 + c.rank) : null;
  }

  /**
   * 该座应对时是否**无任何合法压牌**（含炸弹在内都压不过）→ 只能过。
   * 供 UI 高亮「过」按钮引导玩家（owner 2026-07-18：没有更大的牌时「过」应高亮·不该让人自己找）。
   * 领出（无当前墩·必须出）/ 非当前座 / 盘已结束 → false（那些情形不是「只能过」）。
   */
  canOnlyPass(seat: SeatId): boolean {
    if (this.phase !== 'playing' || this.turn !== seat || !this.currentTrick) return false;
    return this.legalBeats(this.toCards(this.hands[seat]), this.toCards(this.currentTrick.cards)).length === 0;
  }

  /**
   * 合法应对枚举（引擎 legalResponses 的自洽包装·**防御性复核**）。
   * 曾治引擎 A-008 缺口：legalResponses 用「意图牌型」枚举，含逢人配的牌可有多判读，act/legalCheck 用 matchPattern
   * 取**最强**判读——最强判读落到另一普通型家族时（如 QQ+KK+两逢人配：意图钢板 QQQ-KKK，matchPattern 判成更强
   * 的三连对 Q-K-A 跨家族压不过原钢板），legalResponses 声称能压、act 却判非法。**引擎已修**（REQ-HANDPAT
   * `214fc846`·legalResponses 现自洽复核规范判读→返回集 ⊆ 合法集）。本 beats 复核降为**防御性冗余**（幂等·恒真·
   * 保留作跨版本护栏+文档意图·退亦无害），只留「规范判读真能压目标」的应对。领出无需过滤（任意牌型皆合法领）。
   */
  private legalBeats(hand: Card[], target: Card[] | null): PatternMatch[] {
    const responses = legalResponses(hand, target, this.cfg);
    if (target === null) return responses;
    return responses.filter((m) => beats(m.cards, target, this.cfg));
  }

  /** 推进一步 AI（轮到 AI 座时调用；hero 轮次/盘终为 no-op）。返回是否有动作。 */
  aiStep(): boolean {
    if (this.phase !== 'playing' || this.turn === 'hero') return false;
    const seat = this.turn;
    const holder = this.currentTrick?.seat ?? null;
    const opponents = TURN_ORDER.filter((s) => teamOf(s) !== teamOf(seat));
    const decision = chooseTurn(
      this.engine.world,
      {
        cfg: this.cfg,
        hand: this.toCards(this.hands[seat]),
        target: this.currentTrick ? this.toCards(this.currentTrick.cards) : null,
        partnerWinning: holder !== null && holder !== seat && teamOf(holder) === teamOf(seat),
        minOppCards: Math.min(...opponents.map((s) => this.hands[s].length)),
        tier: this.tier,
        personality: personalityOf(SEATS.find((s) => s.id === seat)!),
        jitter: this.rng(),
        // 宗师读牌真消费（L4·A-019）：本座偷看到的对手牌码（各对手 2 张·发牌期种子取）压平入决策。
        peekedOpp: this.tier === 'l4' ? Object.values(this.peeks[seat] ?? {}).flat() : undefined,
      },
      this.worldSeed(),
    );
    const ok = this.act(seat, decision.cards);
    if (!ok) this.act(seat, null); // 兜底（理论不可达：候选来自 legalResponses）
    return true;
  }

  // ── 结算（gdd §4 + §2.4 + 服饰罚 §3）────────────────────────────────────────
  private settleRound(ranking: SeatId[]): void {
    const winnersTeam = teamOf(ranking[0]);
    const mateAt = ranking.findIndex((s, i) => i > 0 && teamOf(s) === winnersTeam);
    const combo: Combo = mateAt === 1 ? 'double' : mateAt === 2 ? 'first-third' : 'first-fourth';
    const baseMult = combo === 'double' ? RESULT_MULTS.doubleWin : combo === 'first-third' ? RESULT_MULTS.firstThird : RESULT_MULTS.firstFourth;
    const bonusResist = this.resisted ? BONUS_RESIST_MULT : 0;
    const bonusSky = this.winnerLastPlay?.family === 'sky' ? BONUS_SKY_MULT : 0;
    const totalMult = Math.min(baseMult + bonusResist + bonusSky, ROUND_MULT_CAP);

    const losers = TURN_ORDER.filter((s) => teamOf(s) !== winnersTeam);
    const dressOutDoubled = losers.some((s) => this.dress[s] <= 1);
    const payPerPlayer = this.stake * totalMult * (dressOutDoubled ? DRESS_OUT_MONEY_MULT : 1);
    for (const s of TURN_ORDER) {
      this.wallets[s] = teamOf(s) === winnersTeam ? this.wallets[s] + payPerPlayer : Math.max(0, this.wallets[s] - payPerPlayer);
    }
    for (const s of losers) if (this.dress[s] > 1) this.dress[s] -= 1; // 底线档不再脱（→金钱罚翻倍）

    // 级数推进与过 A（A1-A3）
    const levelBefore = this.levels[winnersTeam]; // 升级前级（levelUp 增量的权威基准）
    const wasAtAce = levelBefore === LEVEL_ACE;
    let aResult: RoundResult['aResult'] = 'none';
    if (wasAtAce) {
      if (combo === 'first-fourth') aResult = 'stay'; // 一四不过·停 A 重打
      else aResult = 'passed';
    } else {
      const up = combo === 'double' ? LEVEL_UPS.doubleWin : combo === 'first-third' ? LEVEL_UPS.firstThird : LEVEL_UPS.firstFourth;
      this.levels[winnersTeam] = Math.min(LEVEL_ACE, this.levels[winnersTeam] + up);
    }
    this.lastRanking = ranking;
    this.lastFirstTeam = winnersTeam;
    this.lastResult = {
      ranking,
      winnersTeam,
      combo,
      baseMult,
      bonusResist,
      bonusSky,
      totalMult,
      dressOutDoubled,
      payPerPlayer,
      levelUp: this.levels[winnersTeam] - levelBefore, // 实际级数增量（封顶后·打A局不升=0）——修非双上恒 0 的派生 bug（GD-A 剧本①报）

      levelAfter: [...this.levels] as [number, number],
      aResult,
    };
    this.phase = aResult === 'passed' ? (winnersTeam === 0 ? 'run-won' : 'run-lost') : 'settled';
    this.mirrorToWorld();
  }

  /** 下一盘（settled 后调用；run 终局为 no-op）。 */
  nextRound(): boolean {
    if (this.phase !== 'settled') return false;
    this.startRound();
    return true;
  }

  // ── 世界镜像（Resource=UI 绑定源+黑板宿主·sim 真相在本脚本）─────────────────────
  private worldSeed(): RandomSeed | undefined {
    return this.engine.world.getComponent<RandomSeed>('rng', 'RandomSeed') ?? undefined;
  }
  private setRes(id: string, value: number): void {
    for (const [eid] of this.engine.world.query('Resource')) {
      const r = this.engine.world.getComponent<Resource>(eid, 'Resource');
      if (r?.id === id) {
        r.current = value;
        return;
      }
    }
  }
  private mirrorToWorld(): void {
    this.setRes('wallet', this.wallets.hero);
    this.setRes('round', this.round);
    this.setRes('level-ours', this.levels[0]);
    this.setRes('level-theirs', this.levels[1]);
    for (const s of TURN_ORDER) this.setRes(`dress-${s}`, this.dress[s]);
  }

  private sortHand(seat: SeatId): void {
    this.hands[seat].sort((a, b) => this.effOf(a) - this.effOf(b) || codeSuit(a) - codeSuit(b));
  }
}
