// game211 · 精锐 / 替身 / 血量层（owner 2026-08-10 定的数值架构）。
//
// owner 原话：「每一张精锐卡，其实派出打的是自己的**替身**，输了减少自己**血量**。」
//
// 为什么这个设计能解掉「数值控制」这个死结（实测支撑，非空谈）：
//   前面三条路都想在**单张牌的落面**上做文章，全部失败或有作弊感——
//     · 出手瞄准自旋          → 只值 ±7pt（`--aim/--jitter` 实测，jitter 怎么调都没用）
//     · 改牌的质量            → 10:1 才 +6pt 且非单调（30:1 又消失）
//     · 落地时推一把          → 能到 82%，但那是**接管物理**，owner 判「作弊也不好」
//   根因是薄圆盘落地翻倒那一下极度敏感，与真实抛硬币难以作弊同因。
//
//   **替身模型换了个层级下手**：不碰单张落面（保持诚实的 50/50），
//   而是让「输一次」的**代价**由数值决定——血厚的精锐输得起更多次。
//   于是：物理零接管 · 数值真生效 · 观感无穿帮，三者同时成立。
//
// 场上那 240 张牌 = **替身**（不是本尊）。一个替身阵亡 → 其精锐 −1 血 → 若还有血，再派一个替身上场。
// 一方所有精锐血尽 = 该方灭亡。
//
// 本模块是**纯函数**：不碰世界、不碰物理、不碰渲染、不用壁钟、不用裸随机。
import type { Side } from './melee-campaign.js';

/** 一张精锐卡（本尊·不上场）。 */
export interface Elite {
  readonly id: string;
  readonly side: Side;
  /** 当前血量。每有一个自己的替身阵亡就 −1；归零 = 该精锐出局。 */
  readonly hp: number;
  /** 初始血量（数值旋钮·养成/稀有度的落点）。 */
  readonly maxHp: number;
  /** 韧性 0..1：自己的替身阵亡时，以此概率**不扣血**（「重伤未死」）。等价于放大有效血量。 */
  readonly toughness?: number;
  /** 锐气 0..1：自己的替身阵亡时，以此概率让**对面**也扣 1 血（「临死反扑」）。改的是交换比。 */
  readonly riposte?: number;
}

// ⚠ 一条**算出来的**设计约束（别浪费一个维度）：「一轮派几个替身」**对胜负是中性的**。
// 每对替身独立 50/50 → 我方替身阵亡概率恒 0.5，与投放数无关；投 N 个平均死 N/2，
// 对面同理，交换比恒 1:1。多投只加快双方消耗**节奏**，不改变谁先耗尽。
// 故投放数只能当**节奏/观感**旋钮，不能当强度旋钮。真正造成不对称的只有下面三类：
//   ① 血量      —— 输得起几次
//   ② 韧性      —— 每次输的**代价**打折（等价于放大血量，但可做成概率型、手感不同）
//   ③ 锐气/反伤 —— 改**交换比**（我输一次 = 对面也扣一次，把劣势局拖成互耗）

/** 场上一个替身与其主人的绑定。 */
export interface Proxy {
  readonly id: string;
  readonly eliteId: string;
  readonly side: Side;
}

/** 建一队精锐（纯函数）。`hps` 逐张给血量 → 想做「一队里有厚有薄」直接传不等长的数。 */
export function makeElites(side: Side, hps: readonly number[]): Elite[] {
  return hps.map((hp, i) => ({ id: `${side}-e${i}`, side, hp, maxHp: hp }));
}

/** 还活着的精锐（hp > 0）。 */
export function aliveElites(elites: readonly Elite[]): Elite[] {
  return elites.filter((e) => e.hp > 0);
}

/** 某方剩余总血量（= 还能承受多少次替身阵亡·这就是「国力」）。 */
export function totalHp(elites: readonly Elite[], side: Side): number {
  let n = 0;
  for (const e of elites) if (e.side === side && e.hp > 0) n += e.hp;
  return n;
}

/** 胜负：一方总血量归零 → 另一方胜；同时归零 → 平。 */
export function winnerOfRoster(elites: readonly Elite[]): Side | 'draw' | null {
  const r = totalHp(elites, 'red'), b = totalHp(elites, 'blue');
  if (r > 0 && b > 0) return null;
  if (r > 0) return 'red';
  if (b > 0) return 'blue';
  return 'draw';
}

/** 按「每个活着的精锐派 `perElite` 个替身」铺场（纯函数）。
 *  ⚠ 派出的替身数受**血量**限制：血只剩 1 的精锐最多同时派 1 个替身在场——
 *  否则一轮里死两个替身却只扣得起 1 血，血量这个旋钮就漏了。 */
export function spawnProxies(elites: readonly Elite[], perElite: number, gen: number): Proxy[] {
  const out: Proxy[] = [];
  for (const e of aliveElites(elites)) {
    const n = Math.min(perElite, e.hp);
    for (let i = 0; i < n; i++) out.push({ id: `p${gen}-${e.id}-${i}`, eliteId: e.id, side: e.side });
  }
  return out;
}

/** 结算替身阵亡（纯函数）。
 *  每个阵亡替身：① 掷一次**韧性** —— 中则本次不扣血；② 未中则主人 −1 血；
 *  ③ 无论是否扣血，掷一次**锐气** —— 中则**对面**随机一张（按 id 全序取第一张活的）也 −1 血。
 *  `roll()` = 数值层的随机（引擎种子 PRNG）——**与物理落面无关**：物理那层永远诚实 50/50，
 *  数值只决定「一次失败要付多少代价」。
 *  抽取顺序固定：按 deadProxies 顺序、每个先韧性后锐气 → 同输入必得同输出（可回放）。 */
export function applyProxyLosses(
  elites: readonly Elite[],
  deadProxies: readonly Proxy[],
  roll: () => number = () => 1,
): Elite[] {
  const hp = new Map(elites.map((e) => [e.id, e.hp]));
  const byId = new Map(elites.map((e) => [e.id, e]));
  // 对面活着的精锐（按 id 全序）——反伤落点，取第一张，确定性。
  const foeAlive = (side: Side): string | undefined =>
    elites.filter((e) => e.side !== side && (hp.get(e.id) ?? 0) > 0).map((e) => e.id).sort()[0];

  for (const p of deadProxies) {
    const owner = byId.get(p.eliteId);
    if (!owner) continue;
    const tough = owner.toughness ?? 0;
    if (!(tough > 0 && roll() < tough)) {                    // ① 韧性未中 → 扣血
      hp.set(owner.id, Math.max(0, (hp.get(owner.id) ?? 0) - 1));
    }
    const rip = owner.riposte ?? 0;
    if (rip > 0 && roll() < rip) {                            // ② 锐气中 → 对面也扣 1
      const foe = foeAlive(owner.side);
      if (foe) hp.set(foe, Math.max(0, (hp.get(foe) ?? 0) - 1));
    }
  }
  return elites.map((e) => (hp.get(e.id) === e.hp ? e : { ...e, hp: hp.get(e.id) ?? e.hp }));
}

/** 一场替身对决的结算（纯函数）：`flip()` = 这个替身的落面（true=正面=活）。
 *  **抽取顺序固定**：逐对、先 a 后 b —— 同一串 flip 序列必得同一结果（可回放/可对拍）。
 *  物理这一层**完全公平**：flip 与替身主人的血量、战力无关。数值只体现在「输得起几次」。 */
export function resolveProxyDuel(
  aProxies: readonly Proxy[],
  bProxies: readonly Proxy[],
  flip: () => boolean,
): { aDead: Proxy[]; bDead: Proxy[]; pairs: number } {
  const pairs = Math.min(aProxies.length, bProxies.length);
  const aDead: Proxy[] = [], bDead: Proxy[] = [];
  for (let i = 0; i < pairs; i++) {
    if (!flip()) aDead.push(aProxies[i]!);
    if (!flip()) bDead.push(bProxies[i]!);
  }
  return { aDead, bDead, pairs };
}
