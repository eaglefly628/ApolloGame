import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld } from '@engine/core/types.js';
import type { FlowField, FlowAgent, Transform, Velocity, Status } from '@engine/protocol/components.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';

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

/** 取（或铺）一张场。导出 `clearFlowFieldCache` 供测试证明「缓存不改变结果」。 */
export function getBakedField(field: FlowField): BakedField {
  lookups++;
  const hit = cache.get(field.id);
  if (hit && sameInputs(hit.snap, field)) return hit.baked;
  const baked = bakeFlowField(field);
  bakes++;
  cache.set(field.id, { snap: snapshotOf(field), baked });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest !== undefined && oldest !== field.id) cache.delete(oldest);
  }
  return baked;
}
export function clearFlowFieldCache(): void { cache.clear(); bakes = 0; lookups = 0; }

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
        for (const [fid, f] of fields) baked.set(fid, getBakedField(f));
        // `los` 是 M2 的活（M1 不实现）——摆了就说一声，别让作者以为已经生效。
        for (const [fid, f] of fields) {
          if (f.los) { appendTrace(trace, tick, 'flow-field', 'reject', `场 ${fid} 的 los 被忽略（视线优化属 M2·M1 未实现）`, '摆着不报错，但这一版不生效'); break; }
        }

        let moved = 0; let stopped = 0; let noField = 0; let offGrid = 0;
        for (const [id, comps] of agents) {
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

          // 到达（离最近 goal 够近）→ 停。放在查表前：终点那一格的方向是 (0,0)，
          // 但 arriveRange 通常大于一格，靠格内方向兜不住。
          if (a.arriveRange !== undefined && a.arriveRange > 0 && nearestGoalDist(field, t.x, t.y) <= a.arriveRange) {
            v.vx = 0; v.vy = 0; stopped++; continue;
          }

          const bf = baked.get(a.fieldId)!;
          const { col, row } = cellOf(field, t.x, t.y);
          const ci = cellIndex(field, col, row);
          if (ci < 0) { v.vx = 0; v.vy = 0; offGrid++; continue; }   // 走出网格 → 停（越界不猜方向）

          const dx = bf.dir[ci * 2];
          const dy = bf.dir[ci * 2 + 1];
          if (dx === 0 && dy === 0) { v.vx = 0; v.vy = 0; stopped++; continue; }  // 终点格/墙里/孤岛
          // 方向归一化：整数方向 → 单位向量 ×speed（浮点只在这一步·同 steering 的 IEEE 用法）。
          const m = Math.sqrt(dx * dx + dy * dy);
          v.vx = (dx / m) * a.speed;
          v.vy = (dy / m) * a.speed;
          moved++;
        }

        // 密度守则：每 system 每 tick ≤3 条·无事 0 条。这里只在「有单位没动起来」时各报一条摘要。
        if (noField > 0) appendTrace(trace, tick, 'flow-field', 'reject', `${noField} 个单位找不到自己的场 → 停`, '检查 FlowAgent.fieldId 与 FlowField.id 是否对上');
        if (offGrid > 0) appendTrace(trace, tick, 'flow-field', 'reject', `${offGrid} 个单位在网格外 → 停`, '网格没覆盖到它们站的地方');
        if (moved > 0 || stopped > 0) appendTrace(trace, tick, 'flow-field', 'commit', `写 Velocity：${moved} 走 / ${stopped} 停`, `场 ${fields.size} 张`);
      },
    },
  ],
});
