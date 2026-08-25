import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld } from '@engine/core/types.js';
import type { FlowField, FlowAgent, Transform, Velocity, Status } from '@engine/protocol/components.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';
import { orcaVelocity, type OrcaAgent, type OrcaStats } from './orca.js';

// ═══════════════════════════════════════════════════════════════
//  t2-flow-field —— 群体流场寻路（REQ-FLOWFIELD·owner 2026-08-10 判 A 下沉引擎）。
//
//  ══ 为什么不是「每个单位跑一次 A*」══
//  实测（`games/game211/pathfind-scale.bench.test.ts`·可复跑）：500 单位 / 48×48 图，
//  A*-per-agent 首拍 534~619ms（60fps 下 32~37 帧画面定住）、稳态 20~23ms/tick；
//  而流场铺一次 1.0~1.1ms（**一次服务全部单位**），单位查表 1000 个 0.075ms/tick。
//  成本形状不同：A* 的成本 ∝ 单位数，流场的成本 ∝ 地图格数、与单位数无关。
//
//  ══ 三遍管线（业界标准形态·Emerson/SupCom2 一脉）══
//    ① cost field        —— blocked + cost → 每格通行代价
//    ② integration field —— 从 goals 做**多源 Dijkstra 铺满全图**
//    ③ flow field        —— 每格指向「积分值最小的邻格」
//  ②用 Dijkstra 而不是势场法：Dijkstra 铺满**没有局部极小**，凹形障碍（U 形墙）里的单位
//  会沿开口绕出去，而不是贴着墙底抖动——这正是势场法在 RTS 里的经典失败形状。
//
//  ══ 🔴 确定性（本能力进 sim/hash/lockstep·这是它归主程的原因）══
//  · **整分积分**：直走计 10、斜走计 14（≈10√2）——全程整数加法，**没有一处浮点参与积分**，
//    故跨平台/跨端逐位相同。（浮点只出现在最后「方向×速度」那一步，与 steering 同一档 IEEE 用法。）
//  · **全序 tie-break**：堆比较用 (积分值, 格索引) 二元组——不依赖插入序、不依赖 Map 迭代序。
//  · **禁墙钟禁随机**：本文件零 `Date.now`/`performance.now`/`Math.random`。
//  · **重建时机确定**：由输入摘要驱动（`blocked/cost/goals/网格几何` 任一变 → 下一 tick 重建），
//    **不是**「等空闲再重建」——那种调度依赖真实耗时，两端机器快慢不同就分叉。
//  · **缓存不是状态通道**：模块级 Map 只是**纯函数记忆化**（键覆盖全部输入），清空它不改变任何
//    输出，只改变耗时。点名测试 `缓存清空后逐位相同` 钉死这一条。
//
//  ══ 分工线（三层正交·别混）══
//  `t2-flow-field` = 走到战场 · `t2-steering{separation}` = 别互相挤 · `t2-steering{seek}` = 打谁。
// ═══════════════════════════════════════════════════════════════

/** 直走代价（×地形代价）。整数——积分场全程整数加法。 */
export const STRAIGHT = 10;
/** 斜走代价（×地形代价）≈ 10√2 的整数近似。用 14 不用 14.142：整数才逐位可复现。 */
export const DIAGONAL = 14;
/** 不可达（未被 Dijkstra 触及 / 被 blocked）。用有限大数而非 Infinity：便于整数比较与快照。 */
export const UNREACHABLE = 0x7fffffff;

/** 八邻域偏移（**固定扫描序**=方向 tie-break 的全序依据·不许改动顺序）。 */
const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, STRAIGHT], [-1, 0, STRAIGHT], [0, 1, STRAIGHT], [0, -1, STRAIGHT],
  [1, 1, DIAGONAL], [1, -1, DIAGONAL], [-1, 1, DIAGONAL], [-1, -1, DIAGONAL],
];

/** NEIGHBORS 的摊平副本（热循环用·**由它派生**，不许手抄第二份走样）。 */
const NB_DX = Int8Array.from(NEIGHBORS.map((n) => n[0]));
const NB_DY = Int8Array.from(NEIGHBORS.map((n) => n[1]));
const NB_STEP = Int8Array.from(NEIGHBORS.map((n) => n[2]));

/**
 * 软分离的权重上限（owner 红线：「流场力一定是最重要的」）。
 * 0.6 的含义：两个都是单位向量时，合成方向相对纯流场最多偏 ~31°——**永远不会掉头**，
 * 只是"让一让"。作者填再大的 weight 也会被钳到这里。
 */
export const SEP_MAX_WEIGHT = 0.6;

/**
 * 软分离的数据底子：把单位按格分桶（计数排序·O(单位)），外加一份平行的坐标表。
 *
 * ══ 为什么要分桶，而不是两两遍历 ══
 * 两两是 O(单位²)（1000 单位 = 50 万对/tick），撑不住。分桶之后每个单位**只看自己这格 + 8 邻格**，
 * 成本 ∝ 局部密度而不是全场人数——这正是「上千单位怎么解开」的答案：**近处的人才推得动你**。
 *
 * ══ 两层力，各管各的（写这版实测出来的分工）══
 * · **两两斥力（按距离衰减）** —— 解「叠成一堆」。必须带衰减：等力的话六个等距排成一行会
 *   **整排同速平移**，绝对位置动了、彼此间距一点没变（实测 minPair 恒定 0.0100，堆只是搬了家）。
 * · **密度梯度** —— 解「整团堵在一个路口」。它是场，方向由分布定，不会两两对冲、不震。
 * 只有前者是 owner 要的那个"把它们弹开"的力；后者是 Continuum Crowds 一脉的宏观疏散。
 */
export interface DensityField {
  readonly count: Int32Array;   // 每格单位数（密度梯度读它）
  readonly start: Int32Array;   // 每格在 items 里的起点（前缀和）
  readonly items: Int32Array;   // 按格分桶后的单位下标（桶内按单位 id 序 = 确定）
  readonly px: Float64Array;    // 单位坐标（下标 = 单位下标）
  readonly py: Float64Array;
  readonly vx: Float64Array;    // 单位当前速度（ORCA 用：互惠避让要知道对方在怎么走）
  readonly vy: Float64Array;
  readonly radius: Float64Array; // 单位碰撞半径（ORCA 用·没开 ORCA 的按 0 计）
  readonly reciprocal: Uint8Array; // 这个单位自己跑不跑 ORCA（1=会还礼·见 orca.ts 的 u/2）
}

/**
 * 网格几何签名 = **ORCA** 邻居索引的键（**空间**相同就共用一份·与跟哪张场无关）。
 *
 * ⚠ **软分离不用它，用 fieldId**（独立复查逼出来的·别再"顺手统一"）：ORCA 落地时我把两者
 * 一起改成了几何键，于是「只开 separation、从不碰 orca」的多场世界**轨迹变了**
 * （复查实测同一世界 40 拍轨迹 hash 从 `2b3faf3e…` 变成 `f40ff7ee…`，末拍某单位 x 从 3.357 变 2.088）——
 * 那是 lockstep / 存档回放面的静默分叉，而当时的口径写的是「不设 orca = 一个字节不变」。
 * 现在两套索引**各建各的**：软分离按 fieldId（= ORCA 落地之前的语义，逐位复原），
 * ORCA 按几何键（跨场也要能互相避让·两队正面对撞不能互相看不见）。
 * 想让软分离也跨场 = **语义扩展**，得单独提、单独测，不许搭车。
 */
export const geoKey = (f: FlowField): string => `${f.cols}x${f.rows}@${f.cellSize}:${f.originX},${f.originY}`;

/** ORCA 缺省前瞻拍数与邻居上限（原码里这两个是每 agent 参数·这里给缺省值）。 */
export const ORCA_TIME_HORIZON = 8;
export const ORCA_MAX_NEIGHBORS = 8;
/**
 * 邻域半径的**相对速度余量** —— 一个**记在案的取舍**，不是随手填的。
 *
 * 原码 `neighborDist` 是独立参数（官方示例 15，而 `timeHorizon × maxSpeed` 只有 5，即 3×）；
 * 本仓由 `timeHorizon × speed × 本常数 + radius` 推导。独立复查指出：只算「我自己跑多远」
 * 会把**迎面来的**邻居低估一半（最坏相对速度 = 双方之和），实测有过距离 9.0、4.15 拍后必撞
 * 的邻居被挡在门外。
 *
 * **但改成 2 实测更糟**（同机·点名用例「两队对穿」）：邻域一宽，每个单位身上挂的 ORCA 约束
 * 从「够用」变成「过约束」，线性规划在 maxSpeed 圆内**无可行解**，落到 LP3 的「最不违反」——
 * 全程最近两心距 **0.70004 → 0.5423**（半径和 0.70，即真的压进去了）。
 * 所以这里**保持 1，并把这条偏离与它的代价一起写在案**：漏网的那类邻居会在进入 4.35 之后
 * 才被约束（那时距碰撞仍有 ~4 拍 < timeHorizon，ORCA 还来得及让），换来的是密集对撞不塌。
 * 想调它 = 调"礼让多早开始"，交 Demo 拿观感定，别在这里拍脑袋。
 */
export const ORCA_RANGE_SLACK = 1;
/** 环形搜索访问过的格子数（只为测试与排查·不参与判定·见 `flowFieldCellVisits`）。 */
let cellVisits = 0;
/**
 * **访问格数**——环形搜索"提前退出"那段唯一的机器判据。
 * 独立复查实测：撤掉提前退出，53 测 + bench 全绿 exit 0，而 1000 单位从 6.827 涨到 39.264ms/tick
 * （5.75× 悬崖）。墙钟不能进 sim 测试（`test-hygiene-check`），所以量这个：
 * 提前退出在时，稠密场每次查询平均访问 ~9 格（一两环）；撤掉就是整个窗口 361→1369 格。
 */
export function flowFieldCellVisits(): number { return cellVisits; }

/**
 * 收集 ORCA 邻居：本格 + 8 邻格里最近的 `maxNeighbors` 个（**按距离平方升序**——
 * 与原码 `Agent::insertAgentNeighbor` 语义一致；平局按单位下标，保证全序、与遍历顺序无关）。
 */
export function orcaNeighbors(
  field: FlowField, dens: DensityField, self: number, col: number, row: number,
  x: number, y: number, range: number, maxNeighbors: number,
): OrcaAgent[] {
  const found: Array<{ d2: number; idx: number }> = [];
  const rangeSq = range * range;
  // ⚠ **逐环外扩、够数就停**（实测逼出来的）：邻域半径 = 前瞻拍数×速度 + 半径，前瞻 8 拍时
  // 窗口是 19×19=361 格；一格一格全扫的代价是 **1000 单位 36.8ms/tick、4000 单位 189ms**
  // ——贵的不是线性规划，是这个窗口。原码用 kd-tree 取「最近的 k 个」，我们用网格做等价的事：
  // 从第 0 环往外一环一环扫，**一旦已经凑够 maxNeighbors 且第 k 近的距离比下一环的最小距离还近**，
  // 就可以停——外面的不可能更近。稠密人群里通常一两环就够。
  const win = Math.max(1, Math.ceil(range / field.cellSize));
  for (let r = 0; r <= win; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue;   // 只扫这一环（切比雪夫距离=r）
        const ni = cellIndex(field, col + dc, row + dr);
        if (ni < 0) continue;
        cellVisits++;
        const from = dens.start[ni];
        const to = from + dens.count[ni];
        for (let p = from; p < to; p++) {
          const j = dens.items[p];
          if (j === self) continue;
          const dx = dens.px[j] - x; const dy = dens.py[j] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < rangeSq) found.push({ d2, idx: j });
        }
      }
    }
    // 够数了就看能不能收工：下一环里任何单位到我的距离都 ≥ r×cellSize（我在自己那格里的任意位置都成立）
    if (found.length >= maxNeighbors) {
      found.sort((p, q) => (p.d2 !== q.d2 ? p.d2 - q.d2 : p.idx - q.idx));
      const kth = Math.sqrt(found[maxNeighbors - 1].d2);
      if (r * field.cellSize >= kth) break;
    }
  }
  found.sort((a, b) => (a.d2 !== b.d2 ? a.d2 - b.d2 : a.idx - b.idx));
  return found.slice(0, maxNeighbors).map(({ idx }) => ({
    x: dens.px[idx], y: dens.py[idx], vx: dens.vx[idx], vy: dens.vy[idx], radius: dens.radius[idx],
    // `idx` 只在「完全同位」的退化分支里定左右（见 orca.ts 差异⑦）；`reciprocal` 决定 u 要不要打对折。
    idx, reciprocal: dens.reciprocal[idx] === 1,
  }));
}

/**
 * 一个单位最多被几个邻居推。封顶是为了**最坏情况可算**：一格里挤 500 人时不至于变成 500×500。
 * 扫描序固定（格序 → 桶内 id 序），所以"取前 N 个"也是确定的，不是随机采样。
 * 代价：极端堆叠时斥力被低估——但那一拍照样在散，下一拍密度就降下来了。
 */
export const SEP_MAX_NEIGHBORS = 12;
/**
 * 密度梯度项的权重（两两斥力取的是**均值**·模长天然 ≤1，所以梯度这一项给 0.5 当配角）。
 * 分工：两两斥力解「叠成一堆」，梯度解「整团堵住」——前者是主力。
 */
export const SEP_GRADIENT_W = 0.5;
/**
 * 斥力标度——把 Reynolds 的「力」换算到本引擎的「速度比例」。
 *
 * ⚠ **本仓与 Reynolds 的结构差异，必须写清楚**：OpenSteer 里 `steerForSeparation` 返回的是**加速度**，
 * 后面还要过 `truncateLength(maxForce)` → `/mass` → 指数平滑累加器 → `+= acc*dt` → `truncateLength(maxSpeed)`
 * （见 `SimpleVehicle::applySteeringForce`）。**本引擎直接写速度**，没有质量、没有 dt、没有惯性，
 * 所以那条链里的 `1/mass * dt` 在这里坍缩成这一个常数。
 * 取 0.1 的依据：邻域边缘（d=radius）单个邻居给 0.1（几乎不动），d=0.25·radius 给 0.4，
 * d≤0.17·radius 触顶被截断 —— 「远处的轻轻让、贴脸的用力推」。
 */
export const SEP_SCALE = 0.1;
/**
 * 到点之后"安顿"的步长系数（相对 speed）。**这是阻尼，不是减速**：
 * 到了地方只剩分离力，若还按行军速度走，一步就冲过平衡间距、下一步被推回来 ⇒ 队伍在终点上抖
 * （实测：间距在 0.36 与 0.02 之间来回荡）。乘个小系数让它收敛。
 * 注意乘的是**常数**，不是归一化——各单位受力大小的差异仍然保留。
 */
export const SEP_SETTLE_SCALE = 0.35;

export interface BakedField {
  readonly cols: number;
  readonly rows: number;
  /** 每格通行代价（≥1 的整数倍率）；0 = 不可走。行主序。 */
  readonly cost: Int32Array;
  /** 积分场：到最近 goal 的最小累计代价（UNREACHABLE = 到不了）。行主序。 */
  readonly integration: Int32Array;
  /** 流场方向（每格一对 dx,dy ∈ {-1,0,1}·0,0 = 停/无出路）。行主序，长度 2N。 */
  readonly dir: Int8Array;
}

/** 行主序索引；越界返回 -1。 */
export function cellIndex(field: FlowField, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= field.cols || row >= field.rows) return -1;
  return row * field.cols + col;
}

/** 世界坐标 → 网格列行（**向下取整**·负坐标同样成立）。 */
export function cellOf(field: FlowField, x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor((x - field.originX) / field.cellSize),
    row: Math.floor((y - field.originY) / field.cellSize),
  };
}

/** ① cost field：blocked=1 → 0（不可走）；否则取 cost（缺省 1·向下取整到 ≥1 的整数）。 */
export function buildCostField(field: FlowField): Int32Array {
  const n = field.cols * field.rows;
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (field.blocked && field.blocked[i]) { out[i] = 0; continue; }
    const c = field.cost ? field.cost[i] : 1;
    // 代价必须是 ≥1 的整数：<1 会让 Dijkstra 的"越走越贵"前提失效（0 代价环）；
    // 非整数会把浮点带进积分场（跨端不可复现）。故这里**向上取整并钳到 ≥1**。
    out[i] = c === undefined || !(c >= 1) ? 1 : Math.ceil(c);
  }
  return out;
}

/**
 * ② integration field：从全部 goals 出发的**多源 Dijkstra**，铺满全图。
 *
 * 堆比较 = (积分值, 格索引) 全序 —— 值相同时按格索引小者先出，故**与插入顺序无关**。
 * 斜走不许切墙角：`(dx,dy)` 都非零时，两个正交邻格必须都可走，否则单位会从两堵墙的对角缝里穿过去。
 */
export function buildIntegration(field: FlowField, cost: Int32Array): Int32Array {
  const { cols, rows } = field;
  const n = cols * rows;
  const integ = new Int32Array(n).fill(UNREACHABLE);
  // 二叉堆（键=积分值·次键=格索引）。用两个平行数组存，避免对象分配。
  const heapVal: number[] = [];
  const heapIdx: number[] = [];
  const less = (a: number, b: number): boolean =>
    heapVal[a] !== heapVal[b] ? heapVal[a] < heapVal[b] : heapIdx[a] < heapIdx[b];
  const swap = (a: number, b: number): void => {
    const v = heapVal[a]; heapVal[a] = heapVal[b]; heapVal[b] = v;
    const i = heapIdx[a]; heapIdx[a] = heapIdx[b]; heapIdx[b] = i;
  };
  const push = (val: number, idx: number): void => {
    heapVal.push(val); heapIdx.push(idx);
    let c = heapVal.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!less(c, p)) break;
      swap(c, p); c = p;
    }
  };
  const pop = (): number => {
    const top = 0;
    const last = heapVal.length - 1;
    swap(top, last);
    const idx = heapIdx.pop()!; heapVal.pop();
    let p = 0;
    for (;;) {
      const l = p * 2 + 1; const r = l + 1;
      let m = p;
      if (l < heapVal.length && less(l, m)) m = l;
      if (r < heapVal.length && less(r, m)) m = r;
      if (m === p) break;
      swap(p, m); p = m;
    }
    return idx;
  };

  // 多源：每个 goal 落格入堆，积分 0（同一格被多个 goal 命中只入一次）。
  for (const g of field.goals) {
    const { col, row } = cellOf(field, g.x, g.y);
    const gi = cellIndex(field, col, row);
    if (gi < 0 || cost[gi] === 0) continue;     // goal 落在图外/墙里 → 这一源无效（其余源照常）
    if (integ[gi] === 0) continue;
    integ[gi] = 0;
    push(0, gi);
  }

  // 热循环手工展开（**只为速度，不改语义**）：邻居偏移摊平成三条常量数组、边界判断内联，
  // 不再走 `cellIndex()` 的函数调用与元组解构——192×192 上实测 15.9ms → 6.4ms。
  // 扫描序与 NEIGHBORS 逐项相同（方向 tie-break 的全序依据不许因优化而变）。
  while (heapVal.length > 0) {
    const cur = pop();
    const curVal = integ[cur];
    const col = cur % cols;
    const row = (cur - col) / cols;
    for (let k = 0; k < 8; k++) {
      const dx = NB_DX[k];
      const dy = NB_DY[k];
      const nc = col + dx;
      const nr = row + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      const nCost = cost[ni];
      if (nCost === 0) continue;                                  // 墙
      if (dx !== 0 && dy !== 0) {                                 // 斜走不切墙角
        if (cost[row * cols + nc] === 0 || cost[nr * cols + col] === 0) continue;
      }
      const nv = curVal + NB_STEP[k] * nCost;
      if (nv < integ[ni]) { integ[ni] = nv; push(nv, ni); }       // 懒删除：旧键出堆时值已更小，自然被跳过
    }
  }
  return integ;
}

/**
 * ③ flow field：每格指向「积分值最小的邻格」。
 * 平局按 `NEIGHBORS` 的固定扫描序取先者（全序·与遍历顺序无关）。
 * 自己就是 goal（积分 0）或四周都到不了 → (0,0) = 停。
 */
export function buildFlow(field: FlowField, cost: Int32Array, integ: Int32Array): Int8Array {
  const { cols, rows } = field;
  const dir = new Int8Array(cols * rows * 2);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (cost[i] === 0 || integ[i] === 0 || integ[i] === UNREACHABLE) continue;   // 墙/终点/孤岛 → (0,0)
      let bestVal = integ[i];
      let bx = 0; let by = 0;
      for (const [dx, dy] of NEIGHBORS) {
        const ni = cellIndex(field, col + dx, row + dy);
        if (ni < 0 || cost[ni] === 0) continue;
        if (dx !== 0 && dy !== 0) {
          const a = cellIndex(field, col + dx, row);
          const b = cellIndex(field, col, row + dy);
          if (a < 0 || b < 0 || cost[a] === 0 || cost[b] === 0) continue;
        }
        if (integ[ni] < bestVal) { bestVal = integ[ni]; bx = dx; by = dy; }
      }
      dir[i * 2] = bx; dir[i * 2 + 1] = by;
    }
  }
  return dir;
}

/** 三遍管线一次跑完（纯函数·同输入必同输出）。 */
export function bakeFlowField(field: FlowField): BakedField {
  const cost = buildCostField(field);
  const integration = buildIntegration(field, cost);
  const dir = buildFlow(field, cost, integration);
  return { cols: field.cols, rows: field.rows, cost, integration, dir };
}

/**
 * 重建判据 = **逐字段精确比对上一次铺场时的输入**（不是哈希摘要）。
 *
 * ⚠ 上一版在这里栽过一次，值得写死教训：曾用 `Math.round(x*1000)` 量化坐标后做 FNV 摘要当缓存键——
 * 而真正吃这些数的 `cellOf`/`buildCostField` 用的是**原始浮点**。于是「摘要相同」≠「场相同」：
 * 两张 `originX` 差 0.0004 的场共享同一份铺好的流场，单位停在不同的位置（独立复查实测：
 * 单独跑停 x=3.0000，同进程先铺过另一张同 id 场后停 x=4.0000）。那不是缓存，是**状态通道**，
 * 在 lockstep 里就是静默分叉。
 *
 * 现在的做法：缓存条目留一份输入快照，命中前**逐字段精确比对**（含数组逐元素）。
 * 代价与哈希同阶（都要扫一遍数组），换来的是**没有别名可能**——不靠"碰撞概率极低"这种话。
 */
interface InputSnapshot {
  cellSize: number; originX: number; originY: number; cols: number; rows: number;
  goals: Array<{ x: number; y: number }>;
  blocked?: number[];
  cost?: number[];
}

function snapshotOf(field: FlowField): InputSnapshot {
  return {
    cellSize: field.cellSize, originX: field.originX, originY: field.originY,
    cols: field.cols, rows: field.rows,
    goals: field.goals.map((g) => ({ x: g.x, y: g.y })),
    ...(field.blocked ? { blocked: Array.from(field.blocked) } : {}),
    ...(field.cost ? { cost: Array.from(field.cost) } : {}),
  };
}

/** 精确比对（`Object.is` 而非 `===`：把 NaN/-0 这类也判得一致，别让它们成为第二种别名）。 */
export function sameInputs(a: InputSnapshot, field: FlowField): boolean {
  if (!Object.is(a.cellSize, field.cellSize) || !Object.is(a.originX, field.originX) || !Object.is(a.originY, field.originY)) return false;
  if (a.cols !== field.cols || a.rows !== field.rows) return false;
  if (a.goals.length !== field.goals.length) return false;
  for (let i = 0; i < a.goals.length; i++) {
    if (!Object.is(a.goals[i].x, field.goals[i].x) || !Object.is(a.goals[i].y, field.goals[i].y)) return false;
  }
  const ab = a.blocked; const fb = field.blocked;
  if ((ab === undefined) !== (fb === undefined)) return false;
  if (ab && fb) {
    if (ab.length !== fb.length) return false;
    for (let i = 0; i < ab.length; i++) if (!Object.is(ab[i], fb[i])) return false;
  }
  const ac = a.cost; const fc = field.cost;
  if ((ac === undefined) !== (fc === undefined)) return false;
  if (ac && fc) {
    if (ac.length !== fc.length) return false;
    for (let i = 0; i < ac.length; i++) if (!Object.is(ac[i], fc[i])) return false;
  }
  return true;
}

/**
 * 铺场记忆化（**纯记忆化，不是状态通道**）：命中要求输入**逐字段精确相同**，所以
 * 「清空缓存」只改耗时、不改任何输出——这条由点名测试用**两张只差 0.0004 的场**咬住，
 * 而不是拿同一个对象铺两次（后者按构造就抓不到别名，是上一版测试的漏洞）。
 * 容量封顶 8 场，超了丢最早的（丢了只是下次重铺，语义不变）。
 */
const CACHE_MAX = 8;
const cache = new Map<string, { snap: InputSnapshot; baked: BakedField }>();
/** 真铺了几次（只为测试与排查·不参与判定）。 */
let bakes = 0;
export function flowFieldBakes(): number { return bakes; }
/**
 * **取场的次数**（同上·只为测试）。与 `bakes` 分开数是有原因的：记忆化会把重复取场吸收掉，
 * 于是「把取场写回单位循环里」这种真回归**只看 bakes 是看不见的**（独立复查实测：撤掉外提后
 * 25 测全绿、bakes 仍是 1，而 4000 单位每 tick 从 0.909ms 涨到 2.676ms）。
 * 取场次数才是那条回归的机器判据：**每 tick 每场恰好一次**。
 */
let lookups = 0;
export function flowFieldLookups(): number { return lookups; }

/**
 * 分桶用摘要——**只决定去哪个桶找，不决定是否命中**（命中权威永远是 `sameInputs` 的逐字段比对）。
 * 所以这里允许量化/有碰撞：撞了无非是那一桶比对失败、重铺一次，**不可能出现别名**。
 *
 * ⚠ 为什么非要它：修 P0 时我把键简化成了裸 `field.id`，于是**同 id 不同内容的两张场并存**时
 * 每次取场必然比对失败 ⇒ 每 tick 重铺。第二轮复查同机 A/B 量出来：192×192
 * **3.87 → 26.08 ms/tick、bakes 2 → 40（命中率归零）**。修一个别名漏洞，换来一个 6.7× 的悬崖，
 * 不划算也没必要——分桶摘要 + 精确比对两者兼得。
 */
function bucketKey(field: FlowField): string {
  let h = 0x811c9dc5;
  const mix = (n: number): void => { h ^= n | 0; h = Math.imul(h, 0x01000193) >>> 0; };
  mix(field.cols); mix(field.rows);
  mix(Math.round(field.cellSize * 1000)); mix(Math.round(field.originX * 1000)); mix(Math.round(field.originY * 1000));
  mix(field.goals.length);
  for (const g of field.goals) { mix(Math.round(g.x * 1000)); mix(Math.round(g.y * 1000)); }
  if (field.blocked) { mix(field.blocked.length); for (let i = 0; i < field.blocked.length; i++) mix(field.blocked[i] ? 1 : 0); }
  if (field.cost) { mix(field.cost.length); for (let i = 0; i < field.cost.length; i++) mix(Math.round(field.cost[i] * 1000)); }
  return `${field.id}|${field.cols}x${field.rows}:${h}`;
}

/** 取（或铺）一张场。导出 `clearFlowFieldCache` 供测试证明「缓存不改变结果」。 */
export function getBakedField(field: FlowField): BakedField {
  lookups++;
  const key = bucketKey(field);
  const hit = cache.get(key);
  if (hit && sameInputs(hit.snap, field)) return hit.baked;   // ← 精确比对是唯一权威（摘要只管分桶）
  const baked = bakeFlowField(field);
  bakes++;
  cache.set(key, { snap: snapshotOf(field), baked });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest !== undefined && oldest !== key) cache.delete(oldest);
  }
  return baked;
}
export function clearFlowFieldCache(): void { cache.clear(); bakes = 0; lookups = 0; }

/**
 * 软分离力（**纯函数**·同输入同输出）：两项相加后归一化。
 *   ① **推离本格质心**——解「叠成一个点」。质心不含自己（一个单位不该被自己推）。
 *   ② **朝密度最低的邻格偏**——解「整团堵死」。这是密度梯度，方向由分布定，不与某个邻居对冲。
 * 返回单位向量；本格只有自己且四周同样空 → (0,0)（没人挤就不必让）。
 */
/**
 * 软分离力（**纯函数**·同输入同输出）：两项相加，**返回原始向量不归一化**。
 *
 * ⚠ 不归一化是**实测逼出来的**：归一化后每个人受力一样大 ⇒ 夹在堆中间的和站在堆边上的
 * 被推得一样狠 ⇒ 整堆分成两块平移、彼此间距一点没变（实测 minPair 恒 0.0100）。
 * 保留大小才有正确的物理：**被两边夹住的人合力≈0（不动），站在边上的人合力大（被弹出去）**，
 * 于是堆从外往里一层层化开。「流场恒主导」不靠归一化保证，靠调用处把模长钳到 SEP_MAX_WEIGHT。
 *   ① **两两斥力（按距离线性衰减）**——越近推越狠。这一项解「叠成一堆」。
 *   ② **密度梯度**——朝 8 邻格里最空的那格偏。这一项解「整团堵住」。
 * 谁都不挤 → (0,0)（没人挤就不必让·不制造无谓抖动）。
 *
 * `useGradient=false` 用在**终点格**：那儿流场没方向，再叠梯度会让整团一起漂出终点、
 * 又被流场拉回来，来回震荡（实测过）。到了地方只要"彼此分开"，不要"整体疏散"。
 */
export function separationDir(
  field: FlowField, dens: DensityField, self: number, col: number, row: number,
  x: number, y: number, useGradient = true,
): { sx: number; sy: number } {
  const c = cellIndex(field, col, row);
  if (c < 0) return { sx: 0, sy: 0 };
  const radius = field.cellSize;          // 邻域 = 一格边长（网格本来就是按这个尺度分桶的）
  let sx = 0; let sy = 0;

  // ① 两两斥力：本格 + 8 邻格（固定格序 → 桶内 id 序 = 确定的扫描序）
  let seen = 0;
  for (let k = -1; k < 8 && seen < SEP_MAX_NEIGHBORS; k++) {
    const nc = k < 0 ? col : col + NB_DX[k];
    const nr = k < 0 ? row : row + NB_DY[k];
    const ni = cellIndex(field, nc, nr);
    if (ni < 0) continue;
    const from = dens.start[ni];
    const to = from + dens.count[ni];
    for (let p = from; p < to && seen < SEP_MAX_NEIGHBORS; p++) {
      const j = dens.items[p];
      if (j === self) continue;
      const dx = x - dens.px[j];
      const dy = y - dens.py[j];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= radius) continue;
      seen++;
      // 完全重合（d=0）不造方向：随便给一个就是伪随机，两端还未必一致。
      // 这一拍靠②的梯度挪一点，下一拍就不重合了。
      if (d === 0) continue;
      // **照 Reynolds 原式**（OpenSteer `SteerLibraryMixin::steerForSeparation`）：
      //   `steering += offset / -distanceSquared`，offset = 对方位置 - 自己位置
      // 即「远离方向 ÷ 距离²」——除两次的原因作者自己注了：一次把方向归一化，再一次得到 **1/d 衰减**。
      // 我第一版自创了线性衰减 `1 - d/radius`，那是我想的、不是文献里的；现在换回原式。
      sx += (dx / (d * d)) * SEP_SCALE;
      sy += (dy / (d * d)) * SEP_SCALE;
    }
  }

  // ⚠ **不归一化、不取均值**——这是与 Reynolds 原码的唯一一处**有意偏离**，理由是引擎结构不同：
  // 他 `steering.normalize()` 之后交给「maxForce 截断 + 质量 + 平滑累加器 + maxSpeed 截断」那条链，
  // 抖动由**平滑累加器**吸收；本引擎直接写速度、没有那条链，照抄 normalize 的实测后果是
  // 「夹中间的和站边上的受力一样大 ⇒ 整堆平移、间距恒 0.0100」。
  // 保留求和 = 保留「合力相消」这条物理，大小控制交给下面的**截断**（截断本身也是 Reynolds 的做法）。

  // ② 密度梯度（朝最空的邻格）
  if (useGradient) {
    let bestN = dens.count[c];
    let bx = 0; let by = 0;
    for (let k = 0; k < 8; k++) {
      const ni = cellIndex(field, col + NB_DX[k], row + NB_DY[k]);
      if (ni < 0) continue;
      if (dens.count[ni] < bestN) { bestN = dens.count[ni]; bx = NB_DX[k]; by = NB_DY[k]; }
    }
    if (bx !== 0 || by !== 0) {
      const m = Math.sqrt(bx * bx + by * by);
      sx += (bx / m) * SEP_GRADIENT_W; sy += (by / m) * SEP_GRADIENT_W;
    }
  }

  return { sx, sy };
}

/** 到最近 goal 的距离（arriveRange 判据·goals 通常个位数）。 */
function nearestGoalDist(field: FlowField, x: number, y: number): number {
  let best = Infinity;
  for (const g of field.goals) {
    const dx = g.x - x; const dy = g.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) best = d;
  }
  return best;
}

export const flowFieldCapability = defineCapability({
  id: 't2-flow-field',
  version: '1.0.0',

  describe: {
    name: 'flow-field',
    summary: '群体流场寻路：一张 FlowField 铺一次（多源 Dijkstra 铺满全图），全部 FlowAgent 查表得方向 → 写 Velocity。成本与单位数无关，千人同屏用它。',
    semantic: ['tier2', 'pathfinding', 'movement', 'rts', 'crowd'],
    whenToUse:
      '成百上千单位走向同一批目标（RTS 推进/塔防怪潮/攻城）。摆 FlowField{网格+goals+blocked/cost} 一张 + 每个单位挂 FlowAgent{fieldId,speed}。少量单位各走各的路用 t2-pathfind（NavGraph+A*）。',
    examples: [
      '大军推进：FlowField{cols:64,rows:64,cellSize:10,goals:[{x:600,y:600}]} + 千个 FlowAgent{fieldId,speed:2}',
      '多点占领：goals 填三个占领点 → 一次铺完，每个单位自动走向最近的那个',
      '地形代价：cost 里公路填 1、沼泽填 3 → 部队自己绕开沼泽走公路',
      '凹形障碍：blocked 摆一个 U 形墙 → 单位沿开口绕出去，不会卡在墙底（Dijkstra 无局部极小）',
    ],
  },

  components: {
    provides: {
      FlowField: {
        category: 'config',
        describe: '一张共享流场：网格几何 + 多源目标 + 静态障碍/地形代价。摆放数据，引擎负责铺。',
        fields: {
          id: { type: 'string', describe: '场 id（FlowAgent.fieldId 按它认领·多阵营/多目标可并存多张）' },
          cellSize: { type: 'number', describe: '格边长（世界单位）' },
          originX: { type: 'number', describe: '网格左下角世界 x' },
          originY: { type: 'number', describe: '网格左下角世界 y' },
          cols: { type: 'number', describe: '列数' },
          rows: { type: 'number', describe: '行数' },
          blocked: { type: 'string', describe: '行主序 0/1 数组·1=不可走（缺省全可走）' },
          cost: { type: 'string', describe: '行主序 ≥1 的地形代价（缺省全 1·公路 1/沼泽 3·非整数向上取整）' },
          goals: { type: 'string', describe: '目标点世界坐标数组 [{x,y}…]·多源一次铺完' },
          los: { type: 'string', describe: '视线直指优化（M2 未实现·M1 忽略并留痕）' },
        },
      },
      FlowAgent: {
        category: 'config',
        describe: '按 fieldId 查流场方向 → 写 Velocity。速度/到达距离/CC 掩码全是数。',
        fields: {
          fieldId: { type: 'string', describe: '认领哪张 FlowField' },
          speed: { type: 'number', describe: '移动速度（写入 Velocity 模长·单位/tick·同 Steering.speed 口径）' },
          arriveRange: { type: 'number', describe: '到最近 goal 此距离内即停（缺省 0）' },
          haltStatusMask: { type: 'number', describe: '自身 Status 含这些位时停（同 Steering/NavAgent 口径）' },
        },
      },
    },
    reads: ['FlowField', 'FlowAgent', 'Transform', 'Status', 'Velocity'],
    writes: ['Velocity'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'flow-field',
      // 与 steering/path-follow 同一条链：读 Transform / 写 Velocity 与 motion-apply 互为前驱=环，
      // 显式 runsBefore 打破（先定速度再移动）。
      //
      // ⚠ `runsAfter:['steering','path-follow']` 是**独立复查逼出来的**（M1 首版漏了）：本系统与它们
      // 都「读+写 Velocity」，组件图上互为前驱 ⇒ 判成 RMW 伪环。实证：steering+path-follow+motion-apply
      // 三件装配无告警，一加 flow-field 就打出
      //   `[topological-sort] phase 0：检测到定序环 [steering, path-follow, flow-field]（闭环组件：Velocity）… 不保证合语义`
      // 而 `topological-sort` 遇环**只告警不抛**（照跑），所以它不会把任何测试打红——
      // 全库 4783 测里这条告警一次没出现过，只因为没人把 steering 与 flow-field 装进同一个世界。
      // 隔壁 `path-follow.ts:117-121` 为**完全相同的理由**早就钉了 `runsAfter:['steering']`，照办。
      // 未装的 id 会被忽略（steering/path-follow 不在的世界里安全）。
      runsAfter: ['steering', 'path-follow'],
      runsBefore: ['motion-apply'],
      reads: ['FlowField', 'FlowAgent', 'Transform', 'Status', 'Velocity'],
      writes: ['Velocity'],
      consumes: [],
      execute(world: IWorld) {
        // 一次 query 拿到「id + 该实体的组件表」，省掉每个单位两次 Map 查找（1000 单位实测省约 25%）。
        // 仍按 id 排序：遍历序必须与 Map 内部序无关（确定性）。
        const agents = world.query('FlowAgent', 'Transform').sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
        if (agents.length === 0) return;

        const trace = findDebugTrace(world);
        const tick = world.getVersion();

        // 场按 id 收拢（同 id 多张 → 取实体 id 排序后的第一张·并留痕，不静默挑一张）。
        const fields = new Map<string, FlowField>();
        let dupes = 0;
        for (const fid of world.queryEntities('FlowField').sort()) {
          const f = world.getComponent<FlowField>(fid, 'FlowField');
          if (!f) continue;
          if (fields.has(f.id)) { dupes++; continue; }
          fields.set(f.id, f);
        }
        if (dupes > 0) appendTrace(trace, tick, 'flow-field', 'reject', `${dupes} 张同 id 的场被忽略`, '同 id 取实体序首张');

        // **每 tick 每场只取一次铺好的场**（不是每个单位取一次）：`getBakedField` 要算输入摘要，
        // 那是 O(格数) 的一遍扫描——放进单位循环里就成了 O(单位数 × 格数)，1000 单位 × 2304 格
        // 实测把每 tick 从 0.1ms 抬到 1.17ms（写这段时真踩到，被性能判据咬住）。
        const baked = new Map<string, ReturnType<typeof getBakedField>>();
        const bakesBefore = flowFieldBakes();
        for (const [fid, f] of fields) baked.set(fid, getBakedField(f));
        const rebaked = flowFieldBakes() - bakesBefore;
        // `los` 是 M2 的活（M1 不实现）——摆了就说一声，别让作者以为已经生效。
        // ⚠ **只在真重铺那一拍说**（第二轮复查实测：原来每 tick 复读，最坏 5 条/tick，超了
        // 「每 system 每 tick ≤3 条」的密度守则——留痕过头等于没留痕，人会开始忽略它）。
        if (rebaked > 0) {
          const withLos = [...fields].filter(([, f]) => f.los).map(([fid]) => fid);
          if (withLos.length > 0) appendTrace(trace, tick, 'flow-field', 'reject', `${withLos.length} 张场的 los 被忽略（视线优化属 M2·M1 未实现）`, `场：${withLos.slice(0, 3).join(',')}`);
        }

        // ── 邻居索引（软分离一份、ORCA 一份·**键不同、成员不同**）───────────────────────
        // 计数排序分桶：两遍 O(单位) + 一遍前缀和 O(格数)。桶内按单位下标序（agents 已按实体 id 排序）= 确定。
        // 只在真有人要用时才建（都没开 = 一个字节不变·零回归）。
        //
        // 为什么是两份而不是一份（血换的，见 geoKey 注释）：
        // · **软分离按 fieldId**——ORCA 落地时我把它顺手改成了几何键，结果「只开 separation」的
        //   多场世界轨迹静默变了（lockstep/存档面）。现在逐位复原为 ORCA 之前的语义。
        // · **ORCA 按几何键，且收下全部单位**——避让邻居是「谁在我附近」，与跟哪张场无关；
        //   而且**没开 ORCA 的单位也得进桶**（纯流场/软分离的队伍不进桶 = 对 ORCA 队完全隐形，
        //   复查实测 ORCA 队对穿纯流场队最近两心距 0.1000、半径和 0.70）。它们的半径按 0 计、
        //   且在 `reciprocal=0` 上标出来 —— 见 orca.ts：不还礼的邻居我要独自让满。
        interface AgentIndex {
          readonly density: Map<string, DensityField>;
          readonly cellIdxOf: Int32Array;   // 单位下标 → 格下标（-1 = 不在这份索引里）
          readonly keyOf: string[];         // 单位下标 → 桶键
        }
        const buildIndex = (
          keyFn: (f: FlowField) => string,
          wants: (a: FlowAgent) => boolean,
        ): AgentIndex => {
          const density = new Map<string, DensityField>();
          const cellIdxOf = new Int32Array(agents.length).fill(-1);
          const keyOf: string[] = new Array(agents.length).fill('');
          const keyField = new Map<string, FlowField>();
          for (const [, f] of fields) if (!keyField.has(keyFn(f))) keyField.set(keyFn(f), f);
          const counts = new Map<string, Int32Array>();
          for (const [g, f] of keyField) counts.set(g, new Int32Array(f.cols * f.rows));
          // 第一遍：数每格几个人
          agents.forEach(([, comps], i) => {
            const a = comps.get('FlowAgent') as FlowAgent;
            if (!wants(a)) return;
            const f = fields.get(a.fieldId);
            if (!f) return;
            const g = keyFn(f);
            const cnt = counts.get(g);
            if (!cnt) return;
            const t = comps.get('Transform') as Transform;
            const { col, row } = cellOf(f, t.x, t.y);
            const ci = cellIndex(f, col, row);
            if (ci < 0) return;
            cellIdxOf[i] = ci; keyOf[i] = g; cnt[ci]++;
          });
          // 前缀和 → 每格起点
          for (const [g, f] of keyField) {
            const cnt = counts.get(g)!;
            const n = f.cols * f.rows;
            const start = new Int32Array(n);
            let acc = 0;
            for (let i = 0; i < n; i++) { start[i] = acc; acc += cnt[i]; }
            density.set(g, {
              count: cnt, start, items: new Int32Array(acc),
              px: new Float64Array(agents.length), py: new Float64Array(agents.length),
              vx: new Float64Array(agents.length), vy: new Float64Array(agents.length),
              radius: new Float64Array(agents.length), reciprocal: new Uint8Array(agents.length),
            });
          }
          // 第二遍：填桶
          const fill = new Map<string, Int32Array>();
          for (const [g, d] of density) fill.set(g, Int32Array.from(d.start));
          agents.forEach(([, comps], i) => {
            const ci = cellIdxOf[i];
            if (ci < 0) return;
            const d = density.get(keyOf[i]);
            const cursor = fill.get(keyOf[i]);
            if (!d || !cursor) return;
            const t = comps.get('Transform') as Transform;
            d.items[cursor[ci]++] = i;
            d.px[i] = t.x; d.py[i] = t.y;
            // ORCA 还要邻居的**当前速度、半径、还不还礼**（互惠的前提是「我知道你在怎么走」）。
            const fa = comps.get('FlowAgent') as FlowAgent;
            const nv = world.getComponent<Velocity>(agents[i][0], 'Velocity');
            d.vx[i] = nv?.vx ?? 0; d.vy[i] = nv?.vy ?? 0;
            d.radius[i] = orcaRadiusOf(fa);
            d.reciprocal[i] = orcaRadiusOf(fa) > 0 ? 1 : 0;
          });
          return { density, cellIdxOf, keyOf };
        };

        // `orca.radius` 必须是正数——填 0/负数/NaN 的话 combinedRadius 塌掉，ORCA 表面上在跑、
        // 实际一条有效约束都没有（静默失效正是本仓最难查的那类 bug）。当作没开 ORCA 处理，
        // **并在单位循环里数一次**（这个函数每单位会被调用好几次，计数放这里会重复计——
        // 第一版就是这么写的，点名用例一跑就报「半径非法 3」而世界里只有一个）。
        const orcaRadiusOf = (a: FlowAgent): number => {
          if (!a.orca) return 0;
          const r = a.orca.radius;
          return Number.isFinite(r) && r > 0 ? r : 0;
        };
        let badRadius = 0;

        const wantSep = agents.some(([, c]) => (c.get('FlowAgent') as FlowAgent).separation !== undefined);
        const wantOrca = agents.some(([, c]) => orcaRadiusOf(c.get('FlowAgent') as FlowAgent) > 0);
        const sepIdx = wantSep ? buildIndex((f) => f.id, (a) => a.separation !== undefined) : null;
        const orcaIdx = wantOrca ? buildIndex(geoKey, () => true) : null;
        const orcaStats: OrcaStats = { degenerate: 0, oneSided: 0 };

        let moved = 0; let stopped = 0; let noField = 0; let offGrid = 0;
        for (let ai = 0; ai < agents.length; ai++) {
          const [id, comps] = agents[ai];
          const a = comps.get('FlowAgent') as FlowAgent;
          const t = comps.get('Transform') as Transform;
          let v = world.getComponent<Velocity>(id, 'Velocity');
          if (!v) {
            world.addComponent(id, { type: 'Velocity', vx: 0, vy: 0, angular: 0 } as Velocity);
            v = world.getComponent<Velocity>(id, 'Velocity')!;
          }

          // CC（冻结/眩晕/定身）→ 停（同 Steering.haltStatusMask 口径）。
          if (a.haltStatusMask) {
            const st = world.getComponent<Status>(id, 'Status');
            if (st && (st.flags & a.haltStatusMask) !== 0) { v.vx = 0; v.vy = 0; stopped++; continue; }
          }

          const field = fields.get(a.fieldId);
          if (!field) { v.vx = 0; v.vy = 0; noField++; continue; }   // 场不在 → 停（不是原地乱走）

          // 到达（离最近 goal 够近）→ **停掉流场力，但软分离照旧**。
          // 硬停是错的（实测）：一群单位同时到点就地钉死 ⇒ 全叠在一个点上，
          // 那正是 RTS 里最显眼的假。到了地方仍然要互相让开，只是不再往前走。
          // 没人挤 ⇒ 分离力天然是 0 ⇒ 真的停住（不抖）。
          // 到达判定 + **减速带**：`arriveRange` 之内=到了（只剩软分离）；之外一个 arriveRange 的范围内
          // 流场力**线性衰减**到 0。没有这条减速带的话，被分离力挤出线外的单位会以**满速**冲回来，
          // 撞进队伍中间、把刚散开的堆又压实——实测就是队伍在终点上以 ~40 拍为周期反复聚散
          // （间距在 0.41 与 0.0007 之间来回荡）。这就是转向行为里的 arrival，RTS 里同样需要。
          let flowScale = 1;
          let arrived = false;
          if (a.arriveRange !== undefined && a.arriveRange > 0) {
            const gd = nearestGoalDist(field, t.x, t.y);
            if (gd <= a.arriveRange) arrived = true;
            else flowScale = Math.min(1, (gd - a.arriveRange) / a.arriveRange);
          }

          const bf = baked.get(a.fieldId)!;
          const { col, row } = cellOf(field, t.x, t.y);
          const ci = cellIndex(field, col, row);
          if (ci < 0) { v.vx = 0; v.vy = 0; offGrid++; continue; }   // 走出网格 → 停（越界不猜方向）

          const dx = bf.dir[ci * 2];
          const dy = bf.dir[ci * 2 + 1];

          // 软分离（可选）：把「让一让」的力叠在流场方向上。
          // **流场恒主导**（owner 红线）：权重钳在 SEP_MAX_WEIGHT，合成后最多偏 ~31°，永不掉头。
          let sx = 0; let sy = 0;
          // **ORCA 优先**（与组件注释一致）：两个都填时软分离被忽略——两套避让叠加没有意义，
          // ORCA 的目标函数本来就是「离期望速度最近」，再往期望速度里掺一个力只会让它偏离得更多。
          const useOrca = orcaRadiusOf(a) > 0;
          if (a.orca && !useOrca) badRadius++;   // 每单位每 tick 恰好数一次
          const sepW = a.separation && !useOrca ? Math.min(Math.max(a.separation.weight, 0), SEP_MAX_WEIGHT) : 0;
          if (sepW > 0) {
            const d = sepIdx?.density.get(field.id);
            // 终点格（流场无方向）只用质心项——见 separationDir 的 useGradient 注释。
            const atGoal = arrived || (bf.dir[ci * 2] === 0 && bf.dir[ci * 2 + 1] === 0);
            if (d) {
              const s2 = separationDir(field, d, ai, col, row, t.x, t.y, !atGoal);
              // **钳模长**（不是归一化）：|sep| ≤ sepW ≤ SEP_MAX_WEIGHT < 1 = |flow| ⇒ 流场恒主导，
              // 而小于上限的力保持原样 ⇒ 「夹中间的不动、站边上的被弹开」这条物理留住了。
              const sm = Math.sqrt(s2.sx * s2.sx + s2.sy * s2.sy);
              if (sm > 0) {
                const k = sm > sepW ? sepW / sm : 1;
                sx = s2.sx * k; sy = s2.sy * k;
              }
            }
          }

          // ── 期望速度（流场 [+软分离] 定出来的「我想怎么走」）─────────────────────────
          let wantX: number; let wantY: number;
          if (arrived || (dx === 0 && dy === 0)) {
            // 已到达 / 终点格 / 墙里 / 孤岛：**没有前进方向**，只剩「互相让开」。
            // ⚠ 这里**不能直接 continue 掉**（实测逼出来的）：ORCA 是**互惠**算法——双方各让一半，
            // 对面若是个"钉死不动"的单位，我只让一半就不够，照样压上去（5v5 对穿实测最近 0.332，
            // 半径和 0.70）。让到点的单位也走 ORCA（期望速度=0），它就会被后来的挤开一点，
            // 这恰好也是 RTS 里正确的观感：站着的人会被推着让路。
            wantX = sx * a.speed * SEP_SETTLE_SCALE;
            wantY = sy * a.speed * SEP_SETTLE_SCALE;
          } else {
            // 流场方向（按到达减速带缩放）+ 软分离，再归一 × speed。
            const fm = Math.sqrt(dx * dx + dy * dy);
            const rawX = (dx / fm) * flowScale + sx;
            const rawY = (dy / fm) * flowScale + sy;
            const m0 = Math.sqrt(rawX * rawX + rawY * rawY);
            if (m0 === 0) { v.vx = 0; v.vy = 0; stopped++; continue; }   // 理论到不了（|sep|≤0.6<1），兜底
            wantX = (rawX / m0) * a.speed;
            wantY = (rawY / m0) * a.speed;
          }

          // ── ORCA 硬避让（owner 2026-08-24「可以上」·移植自 RVO2·见 orca.ts 文件头）────────
          // 期望速度照收，ORCA 只把它改成「最接近且 timeHorizon 拍内不会撞」的那个。
          // **走位仍归流场**——ORCA 的目标函数就是"离期望速度最近"。
          if (useOrca) {
            const d = orcaIdx?.density.get(geoKey(field));
            if (d) {
              const radius = orcaRadiusOf(a);
              const horizon = a.orca!.timeHorizon ?? ORCA_TIME_HORIZON;
              const maxN = a.orca!.maxNeighbors ?? ORCA_MAX_NEIGHBORS;
              // 邻域半径 = 前瞻拍数 × 速度 × 相对速度余量 + 自身半径（见 ORCA_RANGE_SLACK：
              // 只按自己跑多远算，会把迎面高速接近的邻居挡在门外——复查实测过一个 4.15 拍必撞的漏网）。
              const range = horizon * a.speed * ORCA_RANGE_SLACK + radius;
              const neighbors = orcaNeighbors(field, d, ai, col, row, t.x, t.y, range, maxN);
              if (neighbors.length > 0) {
                const out = orcaVelocity(
                  { x: t.x, y: t.y, vx: v.vx, vy: v.vy, radius, idx: ai },
                  neighbors, { x: wantX, y: wantY },
                  a.speed, horizon, 1,          // timeStep=1：本引擎一拍就是一个时间单位
                  orcaStats,
                );
                v.vx = out.x; v.vy = out.y;
                if (out.x === 0 && out.y === 0) stopped++; else moved++;
                continue;
              }
            }
          }

          if (wantX === 0 && wantY === 0) { v.vx = 0; v.vy = 0; stopped++; continue; }
          v.vx = wantX;
          v.vy = wantY;
          moved++;
        }

        // 密度守则：每 system 每 tick ≤3 条·无事 0 条。这里只在「有单位没动起来」时各报一条摘要。
        // ORCA 的三类**静默降级**合并成一条（密度守则：每 system 每 tick ≤3 条）。
        // 三条都是「什么都没发生 / 悄悄少做了一半」的分支，正是必须留痕的那一类。
        if (badRadius > 0 || orcaStats.degenerate > 0 || orcaStats.oneSided > 0) {
          appendTrace(trace, tick, 'flow-field', 'reject',
            `ORCA 降级：半径非法 ${badRadius} · 完全同位 ${orcaStats.degenerate} · 邻居不还礼 ${orcaStats.oneSided}`,
            '半径非法=当没开 ORCA·同位=按下标定左右强行分开·不还礼=我独自让满（见 orca.ts 差异⑦）');
        }
        if (noField > 0) appendTrace(trace, tick, 'flow-field', 'reject', `${noField} 个单位找不到自己的场 → 停`, '检查 FlowAgent.fieldId 与 FlowField.id 是否对上');
        if (offGrid > 0) appendTrace(trace, tick, 'flow-field', 'reject', `${offGrid} 个单位在网格外 → 停`, '网格没覆盖到它们站的地方');
        if (moved > 0 || stopped > 0) appendTrace(trace, tick, 'flow-field', 'commit', `写 Velocity：${moved} 走 / ${stopped} 停`, `场 ${fields.size} 张`);
      },
    },
  ],
});
