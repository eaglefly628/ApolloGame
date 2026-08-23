// game211 · RTS 数值战斗核心（owner 2026-08-10：「3D 场景里大规模海量 NPC 对战的 RTS，
// 唯一操作是布置兵种相克 + 对应的投放点」「**不用抛掷了，按照数值计算伤害还有一些战场规则**」）。
//
// **纯函数**：不碰世界、不碰物理、不碰渲染、不用壁钟、不用裸随机 → 可无头跑几千场做平衡标定。
//
// ⚠ 与本仓既有的「抛牌决命」是**两条线**：那条线的落面是诚实的 50/50 且不可偏置
//（实测见 `scripts/game211-throw-lab.mjs`）。本模块**不用抛掷**，走确定性数值伤害，
// 于是「相克」可以直接做成伤害倍率、可精确标定、可算清楚——这正是数值 RTS 要的。
//
// ── 设计要点：让「相克」有兵种直觉，而不是四个换皮的数字 ──
// 四兵种在 **hp / dmg / range / speed** 四个维度上各有极端，环形相克的方向也跟着物理直觉走：
//   ♠ 枪兵 克 ♥ 骑兵 —— 长枪拒马，专治冲锋
//   ♥ 骑兵 克 ♦ 弓兵 —— 高速贴脸，弓手无还手之力
//   ♦ 弓兵 克 ♣ 盾兵 —— 射程压制，盾牌追不上
//   ♣ 盾兵 克 ♠ 枪兵 —— 厚甲扛住，磨死枪阵
// 环形 ⇒ **没有万能兵种**，配比永远有得选，这是「唯一操作」还能有深度的根据。

/** 兵种 = 扑克花色（owner：花色刻在牌面上）。 */
export const SUITS = ['spade', 'heart', 'diamond', 'club'] as const;
export type Suit = (typeof SUITS)[number];

/** 一个兵种的属性（**纯数据表**·平衡就是改这张表·不改代码）。 */
export interface UnitStat {
  readonly label: string;
  readonly tint: number;
  /** 生命值。 */
  readonly hp: number;
  /** 每次攻击的基础伤害。 */
  readonly dmg: number;
  /** 攻击间隔（tick）。 */
  readonly cooldown: number;
  /** 攻击距离（世界单位）。近战 ~2，远程 ~9。 */
  readonly range: number;
  /** 移动速度（世界单位 / tick —— 与 `Steering.speed` 同口径，别按秒填）。 */
  readonly speed: number;
  /** 投放消耗（决定投放节奏·强兵更贵）。 */
  readonly cost: number;
}

/** 兵种表。四维各有极端 → 相克之外还有「阵型/射程分层」的自然玩法。 */
export const UNIT: Record<Suit, UnitStat> = {
  // 均衡近战·便宜·打骑兵
  spade: { label: '♠ 枪兵', tint: 0x8f6fd8, hp: 100, dmg: 12, cooldown: 30, range: 2.2, speed: 0.14, cost: 10 },
  // 高速高伤低血·冲锋·打弓兵
  heart: { label: '♥ 骑兵', tint: 0xd2453c, hp: 80, dmg: 18, cooldown: 26, range: 2.0, speed: 0.26, cost: 16 },
  // 远程高伤低血慢·打盾兵
  diamond: { label: '♦ 弓兵', tint: 0xe0a13a, hp: 60, dmg: 16, cooldown: 40, range: 9.0, speed: 0.10, cost: 18 },
  // 厚血低伤慢·肉盾·打枪兵
  club: { label: '♣ 盾兵', tint: 0x3fa86b, hp: 220, dmg: 7, cooldown: 34, range: 2.2, speed: 0.09, cost: 14 },
};

/** 环形相克：♠→♥→♦→♣→♠（键克值）。 */
const COUNTERS: Record<Suit, Suit> = {
  spade: 'heart',
  heart: 'diamond',
  diamond: 'club',
  club: 'spade',
};

/** 相克伤害倍率。1.75 = 「明显但不碾压」：被克方仍能靠数量/血量周旋，配比才有权衡。 */
export const COUNTER_MUL = 1.75;
/** 反被克时的减伤（被自己克制的对象打，吃得少一点 → 相克是**双向**的，读表更直觉）。 */
export const COUNTERED_MUL = 0.8;

/** a 是否克 b。 */
export function counters(a: Suit, b: Suit): boolean {
  return COUNTERS[a] === b;
}

/** 伤害倍率（纯函数）：攻方 vs 守方。 */
export function damageMul(attacker: Suit, defender: Suit): number {
  if (counters(attacker, defender)) return COUNTER_MUL;
  if (counters(defender, attacker)) return COUNTERED_MUL;
  return 1;
}

/** 一次攻击的最终伤害（纯函数·确定性·无随机）。 */
export function damageOf(attacker: Suit, defender: Suit): number {
  return UNIT[attacker].dmg * damageMul(attacker, defender);
}

/** 打死一个目标需要几次攻击（纯函数·平衡表的可读口径）。 */
export function hitsToKill(attacker: Suit, defender: Suit): number {
  return Math.ceil(UNIT[defender].hp / damageOf(attacker, defender));
}

/** 击杀耗时（tick·纯函数）：hits × cooldown。跨兵种比较「谁先打死谁」用这个，比看单发伤害准。 */
export function ticksToKill(attacker: Suit, defender: Suit): number {
  return hitsToKill(attacker, defender) * UNIT[attacker].cooldown;
}

/** 一对一谁赢（纯函数·同时开打·忽略走位）：先打死对方的赢；同时死判平。
 *  这是平衡表最直接的验收口径——**环形相克必须每一环都成立**。 */
export function duelWinner(a: Suit, b: Suit): Suit | 'draw' {
  const ta = ticksToKill(a, b), tb = ticksToKill(b, a);
  if (ta < tb) return a;
  if (tb < ta) return b;
  return 'draw';
}

/** 克制关系表（供 HUD 直接渲染「谁克谁」的箭头·与判定同一份真相·不另抄一份）。 */
export function counterPairs(): Array<{ from: Suit; to: Suit }> {
  return SUITS.map((s) => ({ from: s, to: COUNTERS[s] }));
}

// ══════════════════════════════════════════════════════════════
//  战场规则（owner「还有一些战场规则」）
// ══════════════════════════════════════════════════════════════

/** 投放配比（玩家操作之一）：每个兵种投多少份额。 */
export type Composition = Readonly<Record<Suit, number>>;
export const EMPTY_COMP: Composition = { spade: 0, heart: 0, diamond: 0, club: 0 };

export function compTotal(c: Composition): number {
  return SUITS.reduce((s, k) => s + (c[k] ?? 0), 0);
}

/** 按配比挑下一个要投放的兵种（纯函数·**确定性轮转**·不用随机）。
 *  用「最大欠账」轮转：按比例本该投出的量 − 已投出的量，取欠得最多的。
 *  同配比每次投出的序列完全一致 → 可回放；且比例收敛比随机快得多（不会连出五个同兵种）。
 *  平手按 SUITS 顺序兜底（全序·结果唯一）。 */
export function nextSpawnSuit(comp: Composition, sent: Composition): Suit | null {
  const total = compTotal(comp);
  if (total <= 0) return null;
  const done = compTotal(sent);
  let best: Suit | null = null;
  let bestDebt = -Infinity;
  for (const s of SUITS) {
    const want = comp[s] ?? 0;
    if (want <= 0) continue;
    const debt = ((done + 1) * want) / total - (sent[s] ?? 0);
    if (debt > bestDebt + 1e-9) { bestDebt = debt; best = s; }
  }
  return best;
}

/** 兵力资源（战场规则·决定投放节奏 = 玩家的第二个决策维度）。 */
export interface Supply {
  readonly current: number;
  readonly max: number;
  /** 每 tick 回复量。 */
  readonly regen: number;
}

/** 资源回复（纯函数·钳在 max）。 */
export function regenSupply(s: Supply): Supply {
  return s.current >= s.max ? s : { ...s, current: Math.min(s.max, s.current + s.regen) };
}

/** 能否投放该兵种（纯函数）。 */
export function canAfford(s: Supply, suit: Suit): boolean {
  return s.current >= UNIT[suit].cost;
}

/** 扣除投放消耗（纯函数·不足则原样返回，由调用方先 `canAfford` 判）。 */
export function paySupply(s: Supply, suit: Suit): Supply {
  const c = UNIT[suit].cost;
  return s.current >= c ? { ...s, current: s.current - c } : s;
}

/** 战线位置（纯函数·战场规则的核心读数）：双方最前沿的中点。
 *  `redFront` = 红方推进到的最大 x（红从 −x 往 +x 打）；`blueFront` = 蓝方推进到的最小 x。
 *  返回值 >0 = 红方占优（战线被推向蓝方半场）。没有单位的一方用己方基地位置兜底。 */
export function frontLine(redMaxX: number | null, blueMinX: number | null, halfX: number): number {
  const r = redMaxX ?? -halfX;
  const b = blueMinX ?? halfX;
  return (r + b) / 2;
}

/** 胜负（战场规则）：战线推过对方基地线即胜；双方都还在则未分。 */
export function frontWinner(front: number, halfX: number, winMargin = 0.9): 'red' | 'blue' | null {
  if (front >= halfX * winMargin) return 'red';
  if (front <= -halfX * winMargin) return 'blue';
  return null;
}
