// game211 · 大混战战役核心（owner 2026-08-10：「24 张牌 = 1 个 Group，红蓝各 5 组 = 10 组 = 240 张，
// 在场上移动互相厮杀，活下来的重新组成小 Group，直到只剩一色」）。
//
// **本模块是纯函数**：不碰世界、不碰物理、不碰渲染、不用壁钟、不用裸随机。
// 只回答「给定当前编组 + 一场对决的结果，场面变成什么样」。于是整场战役可以在 node 里跑几千遍，
// 在写任何渲染之前就回答「这个 demo 到底成不成立、会不会打不完、会不会一边倒」。
// （这套「先无头跑统计再写表现」的路子刚在 `scripts/game211-throw-lab.mjs` 上验证过一次：
//   40 张牌的样本连 55% 和 50% 都分不开，几千张才看得出真相。）
//
// ── 对决的概率模型（不是拍的，是量出来的）──
// 每张牌落地正面=活、反面=死，实测 8000 张 → 正面率 50.50%，95% CI [49.40%, 51.60%]，p=0.38
// （`scripts/game211-throw-lab.mjs`）。两张牌各自独立翻（`duel-spike.ts` 刻意不镜像旋转，
// 就是为了让同组两张的落面**互相独立**）。于是一对牌的结局分布是：
//   双正(25%)=都活 · 双反(25%)=都死 · 一正一反(50%)=正面那张活
// **每对的存活期望 = 1.0 张**——即一场对决平均干掉参战牌的一半，且红蓝**对称**。
// 这条对称性决定了整场战役是一次公平随机游走：谁先被清零纯看运气，不存在系统性偏袒。
// 故本模块用 `flip()` 抽象「一张牌的生死」，生产接真物理、跑统计接引擎种子 PRNG——两者同分布。

/** 阵营。 */
export type Side = 'red' | 'blue';

/** 场上的一个小队。`cards` 只存数量与身份无关的牌 id（牌本身无个体差异——生死纯看落面）。 */
export interface Group {
  readonly id: string;
  readonly side: Side;
  readonly cards: readonly string[];
  /** 大地图上的位置（sim 口径·2D 平面；渲染怎么投影是消费方的事）。 */
  readonly x: number;
  readonly y: number;
}

/** 一场对决的结果。 */
export interface DuelResult {
  /** 实际配对数 = min(双方人数)。多出来的牌**这场不参战**（见 `pairCount` 头注）。 */
  readonly pairs: number;
  readonly aSurvivors: readonly string[];
  readonly bSurvivors: readonly string[];
  /** 本场双方各死了几张（= pairs*2 − 存活数·供统计）。 */
  readonly aDead: number;
  readonly bDead: number;
}

/** 满编人数（owner 定：24 张 = 1 个 Group）。 */
export const GROUP_SIZE = 24;
/** 每方初始组数（owner 定：红蓝各 5 组）。 */
export const GROUPS_PER_SIDE = 5;
/** 初始总牌数 = 24 × 5 × 2 = 240。 */
export const TOTAL_CARDS = GROUP_SIZE * GROUPS_PER_SIDE * 2;

/** 配对数（纯函数）：两队人数不等时按**少的那边**配对，多出来的牌这场站着不参战。
 *  为什么不是「多的一方以多打少」：一张牌的生死只由**自己**的落面决定（正面=活），
 *  没有「二打一」这种机制可言——硬塞进来只会变成凭空多杀。少配对是唯一不引入新规则的解法。 */
export function pairCount(a: number, b: number): number {
  return Math.min(a, b);
}

/** 判一场对决（纯函数）。`flip()` 返回 true = 这张牌正面朝上 = 活。
 *  调用顺序固定为「逐对、先 a 后 b」——同一串 flip 序列必得同一结果（可回放/可对拍）。 */
export function resolveDuel(
  aCards: readonly string[],
  bCards: readonly string[],
  flip: () => boolean,
): DuelResult {
  const pairs = pairCount(aCards.length, bCards.length);
  const aSurvivors: string[] = [];
  const bSurvivors: string[] = [];
  for (let i = 0; i < pairs; i++) {
    if (flip()) aSurvivors.push(aCards[i]!);
    if (flip()) bSurvivors.push(bCards[i]!);
  }
  // 没配上对的牌原样存活（这场没参战）。
  for (let i = pairs; i < aCards.length; i++) aSurvivors.push(aCards[i]!);
  for (let i = pairs; i < bCards.length; i++) bSurvivors.push(bCards[i]!);
  return {
    pairs,
    aSurvivors, bSurvivors,
    aDead: aCards.length - aSurvivors.length,
    bDead: bCards.length - bSurvivors.length,
  };
}

/** 重编组（纯函数·owner「剩下的那个活着的牌重新组成小的 Group」）：
 *  把同色的散兵按**就近**并进不超过 GROUP_SIZE 的小队。
 *  确定性：先按 (x, y, id) 全序排，再顺序装桶——同输入必得同输出。
 *  ⚠ 空队直接消失（不留 0 人的幽灵队·否则调度器会拿它去配对）。 */
export function regroup(groups: readonly Group[], maxSize: number = GROUP_SIZE): Group[] {
  const out: Group[] = [];
  for (const side of ['red', 'blue'] as const) {
    const mine = groups.filter((g) => g.side === side && g.cards.length > 0);
    if (!mine.length) continue;
    // 全序：位置优先（就近合并），位置相同再按 id 兜底。
    const sorted = [...mine].sort((p, q) => (p.x - q.x) || (p.y - q.y) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
    let bucket: string[] = [];
    let bx = 0, by = 0, bn = 0;
    const flush = (): void => {
      if (!bucket.length) return;
      out.push({ id: `${side}-g${out.filter((g) => g.side === side).length}`, side, cards: bucket, x: bx / bn, y: by / bn });
      bucket = []; bx = 0; by = 0; bn = 0;
    };
    for (const g of sorted) {
      for (const c of g.cards) {
        if (bucket.length >= maxSize) flush();
        bucket.push(c);
        // 桶的位置 = 并进来的各源队位置的均值（按牌数加权·即人多的队更能定位置）。
        bx += g.x; by += g.y; bn += 1;
      }
    }
    flush();
  }
  return out;
}

/** 还剩几张（纯函数）。 */
export function countBySide(groups: readonly Group[]): Record<Side, number> {
  const n: Record<Side, number> = { red: 0, blue: 0 };
  for (const g of groups) n[g.side] += g.cards.length;
  return n;
}

/** 胜负判定（纯函数）：一色被清零 → 另一色胜；都还在 → null；**同时清零 → 'draw'**。
 *  同归于尽是真会发生的（双反 25%），不能当成没这回事——最后一对互相打光就是平局。 */
export function winnerOf(groups: readonly Group[]): Side | 'draw' | null {
  const n = countBySide(groups);
  if (n.red > 0 && n.blue > 0) return null;
  if (n.red > 0) return 'red';
  if (n.blue > 0) return 'blue';
  return 'draw';
}

/** 开局编组（纯函数）：红蓝各 GROUPS_PER_SIDE 组、每组 GROUP_SIZE 张，分列大地图两侧。
 *  `spread` = 同侧各队沿 y 的间距；`halfX` = 两军初始相距的一半。 */
export function initialGroups(halfX: number, spread: number): Group[] {
  const out: Group[] = [];
  for (const side of ['red', 'blue'] as const) {
    const dir = side === 'red' ? -1 : 1;
    for (let k = 0; k < GROUPS_PER_SIDE; k++) {
      const cards = Array.from({ length: GROUP_SIZE }, (_, i) => `${side}-${k}-${i}`);
      out.push({
        id: `${side}-g${k}`,
        side,
        cards,
        x: dir * halfX,
        y: (k - (GROUPS_PER_SIDE - 1) / 2) * spread,
      });
    }
  }
  return out;
}

/** 最近的一对红蓝小队（纯函数）：返回该开打的那一对，没有敌对双方则 null。
 *  全序 tie-break：先距离、后 `aId`、再 `bId` —— 同输入必得同输出（可回放·与 `duel-scheduler` 同口径）。
 *  真 demo 里位置由 steering 每 tick 更新，本函数只做「当下谁离谁最近」的判断，不关心他们怎么走过来的。 */
export function nextEncounter(groups: readonly Group[]): { a: Group; b: Group; dist: number } | null {
  const reds = groups.filter((g) => g.side === 'red' && g.cards.length > 0);
  const blues = groups.filter((g) => g.side === 'blue' && g.cards.length > 0);
  let best: { a: Group; b: Group; dist: number } | null = null;
  for (const a of reds) {
    for (const b of blues) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best) { best = { a, b, dist: d }; continue; }
      if (d < best.dist) { best = { a, b, dist: d }; continue; }
      if (d > best.dist) continue;
      // 距离相等 → 按 id 字典序定序（否则遍历顺序会悄悄决定结果·破坏可回放）
      if (a.id < best.a.id || (a.id === best.a.id && b.id < best.b.id)) best = { a, b, dist: d };
    }
  }
  return best;
}

/** 把一场对决的结果写回编组表（纯函数）：替换掉参战的两队，其余不动。**不做重编组**（那是单独一步）。 */
export function applyDuel(groups: readonly Group[], aId: string, bId: string, r: DuelResult): Group[] {
  return groups
    .map((g) => (g.id === aId ? { ...g, cards: r.aSurvivors } : g.id === bId ? { ...g, cards: r.bSurvivors } : g))
    .filter((g) => g.cards.length > 0);
}
