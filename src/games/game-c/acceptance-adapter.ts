// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》验收剧本薄适配（REQ-ACCEPT·图纸③·PE 落·纯接线零规则）
//
//  契约（scripts/acceptance-run.mjs）：createWorld(seed,config?) / applySignal / readWorld。
//  game-c 的玩法核是 HoldemSession（capability-plan §4-d 线性 session 脚本·非 ECS 系统），
//  故本适配把 session 包成 World-like 门面：tick()=驱动一个 AI 行动（**镜像宿主 timer stepAI**·
//  同一真实代码路径），readWorld 把牌局机读态**纯投影**成 Resource/Flag/StringVar 供 runner 断言。
//  零规则：这里不判胜负/不算注/不决定 AI——全部走 session 真逻辑；本文件只做「读 session → 摆成标量」。
//
//  剧本断言口径（docs/design/game-c/acceptance/*.scenario.jsonc·作者=GD 从 gdd 派生）：
//    res  button/sb-seat/bb-seat/actor/current-bet/pot/last-aggressor/hand-no/community-count
//         /stack-<i>/commit-<i>/total-<i>/won-<i>/wardrobe-<i>/reveal-first/winner-count
//         /showdown-pot/won-total
//    flag hero-turn/pending-ai/phase-betting/phase-showdown/phase-gameover/folded-<i>/allin-<i>
//    sv   street/phase/hero-hole/reveal-order/winner-type/last-action-<i>
//  信号：hero_act{action,to?} · next_hand · pawn{seat,item}
// ═══════════════════════════════════════════════════════════════
import { HoldemSession } from './game-session.js';
import type { Action, SeatId } from './betting-engine.js';
import { cardStr } from './game-log.js';

const SEATS: SeatId[] = [0, 1, 2, 3, 4, 5];

interface ResourceC { id: string; current: number; }
interface FlagC { id: string; active: boolean; }
interface StringVarC { id: string; value: string; }
type ScalarC = ResourceC | FlagC | StringVarC;

interface ScenarioConfig { smallBlind?: number; bigBlind?: number; startStack?: number; }

/** World-like 门面：包一局 HoldemSession，投影机读态标量、tick 驱动 AI。 */
export class HoldemAcceptanceWorld {
  readonly session: HoldemSession;
  constructor(seed: number, config?: ScenarioConfig) {
    const sb = config?.smallBlind ?? 25;
    const bb = config?.bigBlind ?? 50;
    const stack = config?.startStack ?? 1000;
    this.session = new HoldemSession(seed, { smallBlind: sb, bigBlind: bb }, stack);
  }

  /** 一 tick = 驱动一个待行动 AI（宿主 timer 同款）；主角轮/摊牌/局终则 no-op（安全过量 tick）。 */
  tick(): void {
    if (this.session.pendingAI) this.session.stepAI();
  }

  /** 各标量投影成「一实体一组件」：实体 id = 组件 id（runner 按 type 取组件）。 */
  private scalars(): Map<string, ScalarC & { _type: 'Resource' | 'Flag' | 'StringVar' }> {
    const s = this.session;
    const m = new Map<string, ScalarC & { _type: 'Resource' | 'Flag' | 'StringVar' }>();
    const res = (id: string, current: number): void => { m.set(id, { _type: 'Resource', id, current }); };
    const flag = (id: string, active: boolean): void => { m.set(id, { _type: 'Flag', id, active }); };
    const sv = (id: string, value: string): void => { m.set(id, { _type: 'StringVar', id, value }); };

    // ── 局面标量（庄位/盲位/行动者/注/池）──
    res('hand-no', s.handNo);
    res('button', s.buttonSeat);
    res('sb-seat', s.pos.sb);
    res('bb-seat', s.pos.bb);
    res('actor', s.hand?.actor ?? -1);
    res('current-bet', s.hand?.currentBet ?? 0);
    res('pot', s.pot());
    res('last-aggressor', s.lastAggressor ?? -1);
    res('community-count', s.community.length);
    sv('street', s.hand?.street ?? 'none');
    sv('phase', s.phase);
    sv('hero-hole', s.holeOf(0).map(cardStr).join(' '));

    // ── 相位/主角轮（可观察「轮到谁」）──
    flag('hero-turn', s.isHeroTurn);
    flag('pending-ai', s.pendingAI);
    flag('phase-betting', s.phase === 'betting');
    flag('phase-showdown', s.phase === 'showdown');
    flag('phase-gameover', s.phase === 'gameover');

    // ── 逐座标量 ──
    for (const seat of SEATS) {
      res(`stack-${seat}`, s.stackOf(seat));
      res(`commit-${seat}`, s.committedOf(seat));
      res(`total-${seat}`, s.totalOf(seat));
      res(`wardrobe-${seat}`, s.wardrobeLeft(seat));
      const st = s.seatState(seat);
      flag(`folded-${seat}`, st.folded);
      flag(`allin-${seat}`, st.allIn);
      sv(`last-action-${seat}`, s.lastAction[seat] ?? '');
      const row = s.showdown?.rows.find((r) => r.seat === seat);
      res(`won-${seat}`, row?.won ?? 0);
    }

    // ── 摊牌展示（开牌顺序/赢家）──
    const sd = s.showdown;
    res('reveal-first', sd?.rows[0]?.seat ?? -1);
    res('winner-count', sd?.winners.length ?? 0);
    res('showdown-pot', sd?.potTotal ?? 0);
    res('won-total', sd ? sd.rows.reduce((a, r) => a + r.won, 0) : 0);
    sv('reveal-order', sd ? sd.rows.map((r) => r.seat).join(',') : '');
    sv('winner-type', sd?.rows.find((r) => r.won > 0)?.type ?? '');
    return m;
  }

  getAllEntities(): string[] { return [...this.scalars().keys()]; }

  getComponent(id: string, type: string): Record<string, unknown> | null {
    const c = this.scalars().get(id);
    if (!c || c._type !== type) return null;
    const { _type, ...rest } = c;
    void _type;
    return rest as Record<string, unknown>;
  }
}

// ── 薄适配契约导出 ─────────────────────────────────────────────
export function createWorld(seed: number, config?: ScenarioConfig): HoldemAcceptanceWorld {
  return new HoldemAcceptanceWorld(seed, config);
}

export function applySignal(world: HoldemAcceptanceWorld, signal: string, args?: Record<string, unknown>): void {
  const s = world.session;
  switch (signal) {
    case 'hero_act': {
      const kind = String(args?.action ?? '') as Action['kind'];
      if (kind === 'raise') s.heroAct({ kind: 'raise', to: Number(args?.to ?? 0) });
      else if (kind === 'fold' || kind === 'check' || kind === 'call') s.heroAct({ kind });
      else throw new Error(`hero_act: 未知 action ${JSON.stringify(args?.action)}（fold/check/call/raise）`);
      break;
    }
    case 'next_hand':
      s.nextHand();
      break;
    case 'pawn':
      s.pawn(Number(args?.seat), String(args?.item));
      break;
    default:
      throw new Error(`未知信号 ${JSON.stringify(signal)}（game-c 认 hero_act/next_hand/pawn）`);
  }
}

export function readWorld(world: HoldemAcceptanceWorld): HoldemAcceptanceWorld {
  return world; // 标准接线：门面自身即读视图（getAllEntities/getComponent 就绪）
}
