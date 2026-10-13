import { defineCapability } from '@engine/core/define-capability.js';
import { sortedIds } from '@engine/core/query.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { NavGraph, NavAgent, NavPath, Transform, Velocity, Relation, Status } from '@engine/protocol/components.js';
import { astar } from '@engine/spatial/astar.js';
import { dist } from '@engine/math/vec2.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';
import { selectPatrolGoal } from './pathfind-patrol.js';
import { exactGraphKey, clearGraphKeyCache, validExplicitGraph } from './pathfind-graph-key.js';

// ═══════════════════════════════════════════════════════════════
//  pathfind —— 连续自由空间寻路（航点图 NavGraph + 通用 A* + 沿路跟随）。grid-move（六格离散）的连续坐标对偶。
//
//  读单例 NavGraph（航点 + 连边·**摆放并行数据**）+ 自身 Relation(kind:'target')(aggro 写的索敌目标) → 把
//  自身位置与目标点各吸附到最近航点 → 通用 A*(astar.ts) 求节点路径 → 缓存进 NavPath → 沿航点逐段
//  steer（写 Velocity·被 motion-apply 积分）→ 末段直奔目标点、到 arriveRange 停。
//
//  复用最大化（只下沉「图 + A* + 跟随」这一真缺口·其余全用现成）：
//   · 索敌目标 = 既有 Relation(target)（同 steering/grid-move·零新概念）；
//   · 移动 = 写 Velocity → 既有 motion-apply 积分（不自己挪 Transform）；
//   · **动态避让 = 既有 collision-resolve**（nav 定速后由它推开·正交·零新碰撞代码）；
//   · 静态可走性 = 作者只在可走处连边（NavGraph 即「可走拓扑」·或对接 tilemap 实心瓦片）。
//
//  确定性（lockstep/录放安全·进 hash，与 3D 渲染 render-only 相反）：A* 节点序按整数 id tie-break 唯一确定
//  （见 astar.ts）；Euclidean 用 IEEE sqrt（与 steering/grid-move glide 同确定性类·Velocity/NavPath 不被
//  Condition 读）；逐 agent 按 id 排序处理；NavPath via=整数下标序进 hash。
//  CC 定身：NavAgent.haltStatusMask 命中自身 Status → 速度归零（同 Steering/GridMover）。
//  定序：runsAfter aggro（目标先定）；runsBefore motion-apply（先定速再移动·破 读Transform/写Velocity 环）+
//  hitbox/over-time（读「上一拍」Status 做 CC·冻结延迟一帧·与 Condition→Effect 同纪律）。
// ═══════════════════════════════════════════════════════════════

// Pure derived graph cache: exact serialized keys, bounded; clearing is semantically inert.
const preparedGraphs = new Map<string, ReturnType<typeof buildAdjacency>>();
export function clearPathfindGraphCache(): void { preparedGraphs.clear(); clearGraphKeyCache(); }

const TARGET = 'target';

// 两点 Euclidean（确定性 IEEE sqrt）= @engine/math/vec2 `dist`（同序 dx = bx − ax, dy = by − ay）。

// 世界点 → 最近航点下标（确定性：按下标序遍历·平方距离比较·相等取小下标）。空图 → -1。
export function nearestNode(nav: NavGraph, x: number, y: number): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < nav.nodes.length; i++) {
    const n = nav.nodes[i];
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// NavGraph → 邻接表 + 边代价表（无向；cost 缺省 = Euclidean）。每 tick 现建（小图·确定性·rollback 安全·守界跳非法边）。
export function buildAdjacency(nav: NavGraph): { adj: number[][]; edgeKey: (a: number, b: number) => number; edgeCost: Map<number, number> } {
  const N = nav.nodes.length;
  const adj: number[][] = nav.nodes.map(() => []);
  const edgeCost = new Map<number, number>();
  const edgeKey = (a: number, b: number): number => Math.min(a, b) * N + Math.max(a, b);
  for (const e of nav.edges) {
    if (e.a < 0 || e.a >= N || e.b < 0 || e.b >= N || e.a === e.b) continue;
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
    const c = e.cost ?? dist(nav.nodes[e.a].x, nav.nodes[e.a].y, nav.nodes[e.b].x, nav.nodes[e.b].y);
    edgeCost.set(edgeKey(e.a, e.b), c);
  }
  return { adj, edgeKey, edgeCost };
}

/** Generated grids require the actual cell, never nearest-point snapping through walls. */
export function graphCell(nav: NavGraph, x: number, y: number): number {
  const g = nav.grid;
  if (!g || !Number.isFinite(x) || !Number.isFinite(y)) return -1;
  const c = Math.floor((x - g.originX) / g.cellSize), r = Math.floor((y - g.originY) / g.cellSize);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.blocked[r * g.cols + c]) return -1;
  return r * g.cols + c;
}
function nodeInCell(nav: NavGraph, x: number, y: number): number {
  const ci = graphCell(nav, x, y);
  if (ci < 0) return -1;
  return nav.nodes.findIndex(n => graphCell(nav, n.x, n.y) === ci);
}
export const pathfindCapability = defineCapability({
  id: 't2-pathfind',
  version: '1.0.0',

  describe: {
    name: 'pathfind',
    summary: '连续自由空间寻路：NavGraph + Relation(target) 或固定 patrol 航点 → A* 求航点路径 → 沿路写 Velocity。巡逻到点才切下一目标；动态避让可接 crowd-avoidance。',
    semantic: ['tier2', 'movement', 'pathfind', 'navigation'],
    whenToUse:
      '连续坐标自由空间寻路（绕障走向目标·非网格）：世界放一个 NavGraph{nodes,edges}（在可走处布航点连边）；单位挂 NavAgent{speed,arriveRange}+Relation(target,由 aggro 写)。引擎 A* 沿航点引路、写 Velocity（motion-apply 积分、collision-resolve 避让）。网格场景用 grid-move、定点贪婪用 steering。',
    examples: [
      'NPC 巡游：NavAgent{speed:2,arriveRange:8} + Relation{kind:"target",targetId:门} + 世界 NavGraph → 沿航点绕墙走到门口停',
      '往返巡逻：NavAgent{speed:0.05,arriveRange:0.15,patrol:{waypoints:[{x:0,y:0},{x:10,y:0}],loop:true}} → 每到端点才切换目标，路径仍走 A*',
      '怪物追击：NavAgent{speed:3,arriveRange:24,haltStatusMask:FROZEN} + aggro 写 target → 沿可走航点逼近、被冻结停',
    ],
  },

  components: {
    provides: {
      NavGraph: {
        category: 'config',
        describe: '航点图（摆放并行数据·单例）：nodes=航点世界坐标(下标即 id)，edges=连边(下标·无向·cost 缺省 Euclidean)。在可走处布点连边 = 声明「可走拓扑」。',
        fields: {
          grid: { type: 'string', describe: 'Optional derived grid geometry: corner origin, cellSize/cols/rows, blocked/cost; strict point lookup and source-cell 10/14 terrain cost' },
          nodes: { type: 'string', describe: '航点对象数组 [{x,y},…]（下标即节点 id）' },
          edges: { type: 'string', describe: '连边对象数组 [{a,b,cost?},…]（a/b=节点下标·无向·cost 缺省=两端 Euclidean 距离）' },
        },
      },
      NavAgent: {
        category: 'config',
        describe: '沿 NavGraph 走向 Relation(target) 或自身 patrol 固定航点的移动意图（写 Velocity）。无目标/被 CC → 停。',
        fields: {
          graphId: { type: 'string', describe: 'Optional NavGraph/profile entity id; missing/invalid/unreachable graph stops (no straight-line fallback)' },
          speed: { type: 'number', describe: '移动速度（Velocity 模长·单位/tick）' },
          arriveRange: { type: 'number', describe: '到终点此距离内即停' },
          waypointRange: { type: 'number', describe: '到当前航点此距离内即推进下一航点（缺省 max(speed,arriveRange)·防一拍一停）' },
          repathPeriod: { type: 'number', describe: '每多少 tick 强制重算路径（缺省 30）；目标移动 > arriveRange 也触发' },
          haltStatusMask: { type: 'number', describe: '自身 Status 含这些位时停（冻结/眩晕 CC·同 Steering.haltStatusMask）' },
          patrol: { type: 'string', describe: '可选 {waypoints:[{x,y}],index?,loop?}；到达当前固定点后才切下一个目标，仍使用本 NavGraph A*；有 patrol 时不读 Relation' },
        },
      },
      NavPath: {
        category: 'config', // 持久 per-entity 状态（同 GridMover 体例）；引擎写·游戏不手填（见 describe）。
        describe: '引擎写的缓存路径（确定性派生·进 hash·游戏不手填）：via=待经航点下标序·gx/gy=规划目标点·age=自上次重算 tick。',
        fields: {
          graphId: { type: 'string', describe: 'Engine cached selected graph entity' },
          graphKey: { type: 'string', describe: 'Exact serialized graph identity; dynamic changes invalidate path' },
          reachable: { type: 'boolean', describe: 'Explicit graph path found; false means stop' },
          via: { type: 'number[]', describe: '剩余待经航点下标序（引擎写）' },
          gx: { type: 'number', describe: '规划时目标点 x' },
          gy: { type: 'number', describe: '规划时目标点 y' },
          age: { type: 'number', describe: '自上次重算的 tick 数' },
        },
      },
    },
    reads: ['NavGraph', 'NavAgent', 'NavPath', 'Transform', 'Relation', 'Status'],
    writes: ['Velocity', 'NavPath', 'NavAgent'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'nav-follow',
      phase: SystemPhase.Update,
      runsAfter: ['aggro'],                                  // 目标由 aggro 写 Relation → nav 据此寻路（同 grid-move 破环纪律）
      runsBefore: ['motion-apply', 'hitbox', 'over-time'],   // 先定速再移动；读上一拍 Status 做 CC（同 steering/grid-move）
      reads: ['NavGraph', 'NavAgent', 'NavPath', 'Transform', 'Relation', 'Status'],
      writes: ['Velocity', 'NavPath', 'NavAgent'],
      consumes: [],
      execute(world: IWorld) {
        // Legacy singleton is queried lazily: explicit profiles may coexist even in strict mode.
        let legacy: NavGraph | undefined;
        let legacyQueried = false;
        const prepared = new Map<NavGraph, ReturnType<typeof buildAdjacency>>();
        const validGraphs = new Map<NavGraph, boolean>();
        const graphKeys = new Map<NavGraph, string>();
        let replanned = 0, rejected = 0, stopped = 0;
        const trace = findDebugTrace(world);
        const patrolTransitions: string[] | undefined = trace ? [] : undefined;
        let patrolTurnCount = 0;
        for (const id of sortedIds(world, 'NavAgent', 'Transform')) {
          const ag = world.getComponent<NavAgent>(id, 'NavAgent')!;
          const t = world.getComponent<Transform>(id, 'Transform')!;
          const explicit = ag.graphId !== undefined;
          if (!explicit && !legacyQueried) {
            legacyQueried = true;
            const gid = world.singleton('NavGraph');
            if (gid !== undefined) legacy = world.getComponent<NavGraph>(gid, 'NavGraph');
          }
          const navG = explicit ? world.getComponent<NavGraph>(ag.graphId!, 'NavGraph') : legacy;
          if (!explicit && (!navG || navG.nodes.length === 0)) continue; // Preserve legacy missing-graph behavior.


          // Velocity 确保存在。
          let v = world.getComponent<Velocity>(id, 'Velocity');
          if (!v) {
            world.addComponent(id, { type: 'Velocity', vx: 0, vy: 0, angular: 0 } as Velocity);
            v = world.getComponent<Velocity>(id, 'Velocity')!;
          }

          if (explicit && navG && !validGraphs.has(navG)) validGraphs.set(navG, validExplicitGraph(navG));
          if (!navG || (explicit && (!validGraphs.get(navG)
            || !Number.isFinite(ag.speed) || ag.speed < 0 || !Number.isFinite(ag.arriveRange) || ag.arriveRange < 0
            || !Number.isFinite(t.x) || !Number.isFinite(t.y))) || navG.nodes.length === 0) {
            v.vx = 0; v.vy = 0; world.removeComponent(id, 'NavPath'); rejected++; continue;
          }
          let graphKey: string | undefined;
          if (explicit) {
            graphKey = graphKeys.get(navG);
            if (!graphKey) { graphKey = exactGraphKey(navG); graphKeys.set(navG, graphKey); }
          }
          let adjacency = prepared.get(navG) ?? (graphKey ? preparedGraphs.get(graphKey) : undefined);
          if (!adjacency) {
            adjacency = buildAdjacency(navG);
            if (graphKey) {
              if (preparedGraphs.size >= 32) preparedGraphs.delete(preparedGraphs.keys().next().value!);
              preparedGraphs.set(graphKey, adjacency);
            }
          }
          prepared.set(navG, adjacency);
          const { adj, edgeKey, edgeCost } = adjacency;
          const costOf = (a: number, b: number): number => {
            if (navG.grid) {
              const na = navG.nodes[a], nb = navG.nodes[b];
              const ci = graphCell(navG, na.x, na.y);
              return navG.grid.cost[ci] * (na.x !== nb.x && na.y !== nb.y ? 14 : 10);
            }
            return edgeCost.get(edgeKey(a, b)) ?? dist(navG.nodes[a].x, navG.nodes[a].y, navG.nodes[b].x, navG.nodes[b].y);
          };
          // CC 定身（冻结/眩晕）→ 停。
          if (ag.haltStatusMask) {
            const st = world.getComponent<Status>(id, 'Status');
            if (st && (st.flags & ag.haltStatusMask) !== 0) { v.vx = 0; v.vy = 0; stopped++; continue; }
          }

          // 固定巡逻目标只在真正到达航点时切换，避免追逐移动目标时在到达半径边界反复启停。
          let gx: number, gy: number;
          if (ag.patrol) {
            const selected = selectPatrolGoal(ag.patrol, t.x, t.y, ag.arriveRange);
            if (!selected) { v.vx = 0; v.vy = 0; world.removeComponent(id, 'NavPath'); rejected++; continue; }
            if (selected.changed) {
              ag.patrol.index = selected.index;
              if (patrolTransitions) { patrolTurnCount++; if (patrolTransitions.length < 8) patrolTransitions.push(`${id}:${selected.index}`); }
            }
            gx = selected.x; gy = selected.y;
          } else {
            const rel = world.getComponent<Relation>(id, 'Relation');
            const tt = rel && rel.kind === TARGET ? world.getComponent<Transform>(rel.targetId, 'Transform') : undefined;
            if (!tt) { v.vx = 0; v.vy = 0; stopped++; continue; }
            gx = tt.x; gy = tt.y;
          }

          if (explicit && (!Number.isFinite(gx) || !Number.isFinite(gy)
            || (navG.grid && (graphCell(navG, t.x, t.y) < 0 || graphCell(navG, gx, gy) < 0)))) {
            v.vx = 0; v.vy = 0; world.removeComponent(id, 'NavPath'); rejected++; continue;
          }

          // 网格路径只在目标换格或定期到期时重算；同格内的移动由末段直接追踪实时目标。
          // 避免动态目标的浮点坐标每 tick 改变时反复执行整张网格 A*。
          let path = world.getComponent<NavPath>(id, 'NavPath');
          const repath = ag.repathPeriod ?? 30;
          const goalChanged = navG.grid
            ? !!path && graphCell(navG, path.gx, path.gy) !== graphCell(navG, gx, gy)
            : !!path && dist(path.gx, path.gy, gx, gy) > ag.arriveRange;
          const needReplan = !path || goalChanged || path.age >= repath
            || (!explicit && path.graphId !== undefined)
            || (explicit && (path.graphId !== ag.graphId || path.graphKey !== graphKey
              || (!navG.grid && (path.gx !== gx || path.gy !== gy))));
          if (needReplan) {
            const startNode = navG.grid ? nodeInCell(navG, t.x, t.y) : nearestNode(navG, t.x, t.y);
            const goalNode = navG.grid ? nodeInCell(navG, gx, gy) : nearestNode(navG, gx, gy);
            const full = startNode >= 0 && goalNode >= 0
              ? astar(startNode, goalNode, (n) => adj[n], costOf, (n) => {
                if (navG.grid) {
                  const dx = Math.abs(navG.nodes[n].x - navG.nodes[goalNode].x) / navG.grid.cellSize;
                  const dy = Math.abs(navG.nodes[n].y - navG.nodes[goalNode].y) / navG.grid.cellSize;
                  return 14 * Math.min(dx, dy) + 10 * Math.abs(dx - dy);
                }
                return explicit ? 0 : dist(navG.nodes[n].x, navG.nodes[n].y, navG.nodes[goalNode].x, navG.nodes[goalNode].y);
              })
              : null;
            const via = full ? full.slice(1) : []; // 去起点(已在/近)·留待经航点；无路=空 → 末段直奔目标点近似
            if (!path) {
              world.addComponent(id, { type: 'NavPath', via, gx, gy, age: 0 } as NavPath);
              path = world.getComponent<NavPath>(id, 'NavPath')!;
            } else { path.via = via; path.gx = gx; path.gy = gy; path.age = 0; }
            if (explicit) { path!.graphId = ag.graphId; path!.graphKey = graphKey; path!.reachable = full !== null; }
            else { delete path!.graphId; delete path!.graphKey; delete path!.reachable; }
            replanned++;
          }
          if (!path) continue; // 安全（needReplan 含 !path → 上方必建；此守卫供 TS 收窄）
          path.age = (path.age ?? 0) + 1;
          if (explicit && !path.reachable) { v.vx = 0; v.vy = 0; rejected++; continue; }

          // 推进：吃掉所有已到达的航点（防一拍一停）。
          const wpRange = navG.grid ? 1e-8 : ag.waypointRange ?? Math.max(ag.speed, ag.arriveRange);
          while (path.via.length > 0) {
            const n = navG.nodes[path.via[0]];
            if (dist(t.x, t.y, n.x, n.y) <= wpRange) path.via.shift();
            else break;
          }

          // 当前目标点：还有航点 → 朝 via[0]；否则末段直奔终点 (gx,gy)。
          const finalLeg = path.via.length === 0;
          const wx = finalLeg ? gx : navG.nodes[path.via[0]].x;
          const wy = finalLeg ? gy : navG.nodes[path.via[0]].y;
          const d = dist(t.x, t.y, wx, wy);
          if (finalLeg && (d <= ag.arriveRange || d === 0)) { v.vx = 0; v.vy = 0; continue; } // 到终点停
          if (d === 0) { v.vx = 0; v.vy = 0; continue; }
          const speed = navG.grid ? Math.min(ag.speed, d) : ag.speed;
          v.vx = (wx - t.x) / d * speed;
          v.vy = (wy - t.y) / d * speed;
        }
        if (patrolTurnCount) appendTrace(trace, world.getVersion(), 'nav-follow', 'transition', `patrol ${patrolTurnCount}: ${patrolTransitions!.join(',')}`, 'Reached fixed waypoint');
        if (replanned) appendTrace(trace, world.getVersion(), 'nav-follow', 'decision', `replanned ${replanned}`, 'Target, graph selection, geometry or period changed');
        if (rejected || stopped) appendTrace(trace, world.getVersion(), 'nav-follow', 'reject', `invalid/unreachable ${rejected}; halted/no target ${stopped}`, 'Explicit graph failures stop; no straight-line fallback');
      },
    },
  ],
});
