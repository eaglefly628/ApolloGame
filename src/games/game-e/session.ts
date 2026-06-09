import { Engine } from '../../runtime/engine.js';
import type { Resource, PlayedHand, Flag, StringVar, ScoreTrace, ScoreEvent } from '@engine/protocol/components.js';
import { buildGameEBlueprint, buildJokerEntities, jokerToEntities, toEngineCard, R_CHIPS, R_MULT, R_MONEY, R_HAND_SCORE, R_ROUND_SCORE, R_HANDS_LEFT, R_DISCARDS_LEFT, R_BLIND, V_HAND_TYPE } from './blueprint.js';
import { shuffledDeck, mulberry32, type Card } from './deck.js';
import type { HandType } from './hand-rankings.js';
import { STARTER_JOKERS, type JokerCard } from './jokers.js';
import { blindRequirement, BLIND_ORDER, type BlindKind } from './blinds.js';

// ════════════════════════════════════════════════════════════════════════
//  Game E · 回合流程脚本（GameSession）
//
//  ★ 形态声明（与 Lead/用户敲定）：回合流程是一段**线性、过程化的脚本**——
//    这是「游戏=数据」之外被**明确接受**的代码形态（把发牌→出/弃→冲线→结算→商店→下一道
//    这种线性编排硬拼成数据状态机太形而上学）。脚本只做**编排**，不含算分/小丑/牌型逻辑——
//    那些仍是引擎能力 + 数据（poker-hand/card-scoring/effect-apply/ScoreTrace）。
//
//  分层：
//    · 引擎+数据：判牌型、逐张、小丑加乘、合并、逐步 trace（确定性、可测、可 lockstep）。
//    · 本脚本：线性回合编排（盲注/手数/弃牌/抽牌/商店/经济/胜负），读如瀑布。
//    · React(game-e.tsx)：薄表现层——渲染 session 状态 + 把点击转成 session 调用 + 回放 trace。
//
//  无 React 依赖 → 可 headless 单测（回合逻辑不靠 UI 验证）。
// ════════════════════════════════════════════════════════════════════════

export const HAND_SIZE = 8;
export const HANDS_PER_BLIND = 4;
export const DISCARDS_PER_BLIND = 3;
export const JOKER_SLOTS = 5;
export const REROLL_COST = 5;
const BLIND_REWARD: Record<BlindKind, number> = { small: 3, big: 4, boss: 5 };

/** 出牌结算结果（供 UI 回放 trace + 推进流程）。 */
export interface PlayResult {
  type: HandType;
  chips: number;
  mult: number;
  score: number;
  events: ScoreEvent[]; // 引擎逐步 trace（UI 回放，不重算）
  outcome: 'continue' | 'won-blind' | 'lost'; // 继续本盲注 / 过线进商店 / 出牌耗尽失败
}

export class GameSession {
  private engine!: Engine;
  private deck: Card[] = [];
  private deckPtr = 0;
  private seed: number;

  ante = 1;
  blindIdx = 0; // 0 small / 1 big / 2 boss
  owned: JokerCard[] = [];
  hand: Card[] = [];

  constructor(seed = 20260608) {
    this.seed = seed;
    this.reset();
  }

  // ── 引擎资源读写（薄封装）──
  private resOf(id: string): Resource | undefined {
    for (const [eid] of this.engine.world.query('Resource')) {
      const r = this.engine.world.getComponent<Resource>(eid, 'Resource');
      if (r && r.id === id) return r;
    }
    return undefined;
  }
  get(id: string): number { return this.resOf(id)?.current ?? 0; }
  private set(id: string, v: number): void {
    const r = this.resOf(id);
    if (r) r.current = Math.max(r.min, Math.min(r.max, v));
  }

  // 投影 getter（供 UI / 测试读）。
  get target(): number { return this.get(R_BLIND); }
  get roundScore(): number { return this.get(R_ROUND_SCORE); }
  get handsLeft(): number { return this.get(R_HANDS_LEFT); }
  get discardsLeft(): number { return this.get(R_DISCARDS_LEFT); }
  get money(): number { return this.get(R_MONEY); }
  get blindKind(): BlindKind { return BLIND_ORDER[this.blindIdx]; }

  /** 整局重开：新引擎（开局 0 小丑）+ 回到 Ante1 小盲注。 */
  reset(): void {
    this.engine = new Engine({ tickRate: 60 });
    this.engine.load(buildGameEBlueprint(buildJokerEntities([])));
    this.engine.world.addComponent('table', { type: 'ScoreTrace', events: [] } as ScoreTrace); // 开启逐步 trace
    this.owned = [];
    this.ante = 1;
    this.blindIdx = 0;
    this.startBlind();
  }

  /** ① 一道盲注开局：重置回合资源 + 设盲注线 + 洗牌发 8 张。 */
  startBlind(): void {
    this.set(R_ROUND_SCORE, 0);
    this.set(R_HANDS_LEFT, HANDS_PER_BLIND);
    this.set(R_DISCARDS_LEFT, DISCARDS_PER_BLIND);
    this.set(R_CHIPS, 0); this.set(R_MULT, 0); this.set(R_HAND_SCORE, 0);
    this.set(R_BLIND, blindRequirement(this.ante, this.blindKind));
    this.engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = [];
    this.seed += 1;
    this.deck = shuffledDeck(this.seed);
    this.deckPtr = HAND_SIZE;
    this.hand = this.deck.slice(0, HAND_SIZE);
  }

  private drawTo(kept: Card[]): Card[] {
    const need = HAND_SIZE - kept.length;
    const drawn = this.deck.slice(this.deckPtr, this.deckPtr + need);
    this.deckPtr += drawn.length;
    return [...kept, ...drawn];
  }

  /** ② 出牌：引擎结算（牌型/逐张/小丑/合并 + 边沿累加 round_score、hands-1）→ 读 trace + 真值 → 推进流程。 */
  play(selected: readonly number[]): PlayResult | null {
    if (selected.length === 0 || this.handsLeft <= 0) return null;
    const chosen = selected.map((i) => this.hand[i]).filter(Boolean);

    this.engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = chosen.map(toEngineCard);
    this.engine.world.getComponent<Flag>('scoring', 'Flag')!.active = true;
    this.engine.world.tick();

    const chips = this.get(R_CHIPS), mult = this.get(R_MULT), score = this.get(R_HAND_SCORE);
    let type: HandType = 'high_card';
    for (const [eid] of this.engine.world.query('StringVar')) {
      const v = this.engine.world.getComponent<StringVar>(eid, 'StringVar');
      if (v && v.id === V_HAND_TYPE) type = v.value.replace(/-/g, '_') as HandType;
    }
    const traceComp = this.engine.world.getComponent<ScoreTrace>('table', 'ScoreTrace');
    const events: ScoreEvent[] = traceComp ? traceComp.events.map((e) => ({ ...e })) : [];

    // 收尾一拍：清出牌 + 关 scoring（disarm 边沿门）。
    this.engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = [];
    this.engine.world.getComponent<Flag>('scoring', 'Flag')!.active = false;
    this.engine.world.tick();

    // 抽牌补手（移除已出）。
    const keep = new Set(selected);
    this.hand = this.drawTo(this.hand.filter((_, i) => !keep.has(i)));

    // 推进流程（线性判定）。
    let outcome: PlayResult['outcome'] = 'continue';
    if (this.roundScore >= this.target) {
      const reward = BLIND_REWARD[this.blindKind] + this.handsLeft + Math.min(5, Math.floor(this.money / 5));
      this.set(R_MONEY, this.money + reward);
      outcome = 'won-blind';
    } else if (this.handsLeft <= 0) {
      outcome = 'lost';
    }
    return { type, chips, mult, score, events, outcome };
  }

  /** ③ 弃牌：扣弃牌额度 + 补牌（不计分、不耗出牌次数）。 */
  discard(selected: readonly number[]): boolean {
    if (selected.length === 0 || this.discardsLeft <= 0) return false;
    this.set(R_DISCARDS_LEFT, this.discardsLeft - 1);
    const keep = new Set(selected);
    this.hand = this.drawTo(this.hand.filter((_, i) => !keep.has(i)));
    return true;
  }

  /** 商店货：从未拥有的小丑里种子化取 3 张。 */
  rollShop(rngSeed = this.seed): JokerCard[] {
    const rng = mulberry32(rngSeed);
    const pool = STARTER_JOKERS.filter((j) => !this.owned.some((o) => o.id === j.id));
    const tmp = [...pool];
    const offer: JokerCard[] = [];
    for (let k = 0; k < 3 && tmp.length; k++) offer.push(tmp.splice(Math.floor(rng() * tmp.length), 1)[0]);
    return offer;
  }

  /** ④ 买小丑：扣钱 + 加入 owned + 把它的实体注入运行中的引擎。 */
  buyJoker(j: JokerCard): boolean {
    if (this.owned.length >= JOKER_SLOTS || this.money < j.cost) return false;
    this.set(R_MONEY, this.money - j.cost);
    const ents = jokerToEntities(j, this.owned.length);
    for (const [eid, comps] of Object.entries(ents)) {
      this.engine.world.createEntity(eid);
      for (const [type, data] of Object.entries(comps as Record<string, object>)) {
        this.engine.world.addComponent(eid, { type, ...(data as object) } as never);
      }
    }
    this.owned = [...this.owned, j];
    return true;
  }

  reroll(): boolean {
    if (this.money < REROLL_COST) return false;
    this.set(R_MONEY, this.money - REROLL_COST);
    return true;
  }

  /** ⑤ 进下一道盲注（Boss 后进下一 Ante）。 */
  nextBlind(): void {
    this.blindIdx += 1;
    if (this.blindIdx > 2) { this.blindIdx = 0; this.ante += 1; }
    this.startBlind();
  }
}
