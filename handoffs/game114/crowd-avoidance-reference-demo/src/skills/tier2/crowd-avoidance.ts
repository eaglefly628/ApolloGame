import { defineCapability } from '@engine/core/define-capability.js';
import { sortedIds } from '@engine/core/query.js';
import { SystemPhase, type IWorld } from '@engine/core/types.js';
import { DynamicAabbTree } from '@engine/spatial/aabb-tree.js';
import { aabbOf, contactBetween } from '@engine/spatial/contact.js';
import type { CrowdAvoidance, CrowdVelocity } from '@engine/protocol/components/crowd.js';
import type { Transform, Velocity, FlowAgent, FlowField, PathFollow, NavGraph, Shape, Line3D, Mass } from '@engine/protocol/components.js';
import { orcaVelocity, type OrcaAgent, type OrcaStats } from './orca.js';
import { cellIndex, cellOf, getBakedField } from './flow-field-core.js';
import { flowGuideWeight, blendFlowDirection, routeProjection, usableGuideField } from './crowd-flow-guide.js';
import { advanceRouteRepath, planRouteRejoin, prepareRepathGrid, selectEdgeRepaths,
  type EdgeRepathCandidate, type PreparedRepathGrid, type RepathObstacle } from './crowd-route-repath.js';
import { exactGraphKey, validExplicitGraph } from './pathfind-graph-key.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';

const valid = (a: CrowdAvoidance): boolean => Number.isFinite(a.radius) && a.radius > 0 &&
  Number.isFinite(a.maxSpeed) && a.maxSpeed >= 0 &&
  (a.timeHorizon === undefined || (Number.isFinite(a.timeHorizon) && a.timeHorizon > 0)) &&
  (a.maxNeighbors === undefined || (Number.isSafeInteger(a.maxNeighbors) && a.maxNeighbors >= 1)) &&
  (a.neighborDistance === undefined || (Number.isFinite(a.neighborDistance) && a.neighborDistance > 0)) &&
  (a.yieldAfterTicks === undefined || (Number.isSafeInteger(a.yieldAfterTicks) && a.yieldAfterTicks >= 3)) &&
  (a.minRadiusScale === undefined || (Number.isFinite(a.minRadiusScale) && a.minRadiusScale > 0 && a.minRadiusScale <= 1)) &&
  (a.radiusStep === undefined || (Number.isFinite(a.radiusStep) && a.radiusStep > 0 && a.radiusStep <= 1)) &&
  (a.nudgeStrength === undefined || (Number.isFinite(a.nudgeStrength) && a.nudgeStrength > 0 && a.nudgeStrength <= 1)) &&
  (a.zeroEscape === undefined || typeof a.zeroEscape === 'boolean') &&
  (a.priorityMode === undefined || a.priorityMode === 'mass-stall') &&
  (a.desiredInertia === undefined || (Number.isFinite(a.desiredInertia) && a.desiredInertia >= 0 && a.desiredInertia < 1)) &&
  (a.flowGuide === undefined || (a.flowGuide !== null && typeof a.flowGuide === 'object' &&
    typeof a.flowGuide.fieldId === 'string' && a.flowGuide.fieldId.length > 0 &&
    (a.flowGuide.weight === undefined || (Number.isFinite(a.flowGuide.weight) && a.flowGuide.weight >= 0 && a.flowGuide.weight <= 1)) &&
    (a.flowGuide.repathDistance === undefined || (Number.isFinite(a.flowGuide.repathDistance) && a.flowGuide.repathDistance > 0)) &&
    (a.flowGuide.pathfindDistance === undefined || (Number.isFinite(a.flowGuide.pathfindDistance) && a.flowGuide.pathfindDistance > 0)) &&
    (a.flowGuide.releaseDistance === undefined || (Number.isFinite(a.flowGuide.releaseDistance) && a.flowGuide.releaseDistance >= 0
      && a.flowGuide.pathfindDistance !== undefined && a.flowGuide.releaseDistance < a.flowGuide.pathfindDistance)) &&
    (a.flowGuide.occupancyPenalty === undefined || (Number.isFinite(a.flowGuide.occupancyPenalty) && a.flowGuide.occupancyPenalty >= 0 && a.flowGuide.occupancyPenalty <= 4)) &&
    (a.flowGuide.pathfindPeriod === undefined || (Number.isSafeInteger(a.flowGuide.pathfindPeriod) && a.flowGuide.pathfindPeriod >= 1)) &&
    (a.flowGuide.edgeRepathSlots === undefined || (Number.isSafeInteger(a.flowGuide.edgeRepathSlots) && a.flowGuide.edgeRepathSlots >= 1)))) &&
  (a.debugVectorPrefix === undefined || (typeof a.debugVectorPrefix === 'string' && a.debugVectorPrefix.length > 0)) &&
  (a.debugVectorScale === undefined || (Number.isFinite(a.debugVectorScale) && a.debugVectorScale > 0)) &&
  (a.debugVectorY === undefined || (Number.isFinite(a.debugVectorY) && a.debugVectorY >= 0));

function canCollide(a: Shape, b: Shape): boolean {
  return !!(((a.category ?? -1) & (b.mask ?? -1)) && ((b.category ?? -1) & (a.mask ?? -1)));
}

function nudgeSide(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
  return hash & 1 ? 1 : -1;
}

function clearDebugVectors(world: IWorld, cfg: CrowdAvoidance): void {
  if (typeof cfg.debugVectorPrefix !== 'string' || !cfg.debugVectorPrefix) return;
  for (const suffix of ['desired', 'raw', 'actual', 'avoid']) {
    const line = world.getComponent<Line3D>(`${cfg.debugVectorPrefix}:${suffix}`, 'Line3D');
    if (line) line.points = [];
  }
}

function arrowPoints(x: number, y: number, vx: number, vy: number, scale: number, height: number): Line3D['points'] {
  const dx = vx * scale, dz = vy * scale;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < .015) return [];
  const tx = x + dx, tz = y + dz;
  const hx = dx / length, hz = dz / length;
  const head = Math.min(.24, length * .22);
  return [[x,height,y],[tx,height,tz],
    [tx - hx * head - hz * head * .55,height,tz - hz * head + hx * head * .55],
    [tx,height,tz],
    [tx - hx * head + hz * head * .55,height,tz - hz * head - hx * head * .55]];
}

function writeDebugVectors(world: IWorld, cfg: CrowdAvoidance, t: Transform,
  desired: {x:number;y:number}, raw: {x:number;y:number}, actual: {x:number;y:number}): number {
  const prefix = cfg.debugVectorPrefix;
  if (!prefix) return 0;
  const scale = cfg.debugVectorScale ?? 50, height = cfg.debugVectorY ?? 1;
  const lines: Array<[string, Line3D['points']]> = [
    ['desired', arrowPoints(t.x,t.y,desired.x,desired.y,scale,height)],
    ['raw', arrowPoints(t.x,t.y,raw.x,raw.y,scale,height+.04)],
    ['actual', arrowPoints(t.x,t.y,actual.x,actual.y,scale,height+.08)],
    ['avoid', arrowPoints(t.x+desired.x*scale,t.y+desired.y*scale,
      actual.x-desired.x,actual.y-desired.y,scale,height+.12)],
  ];
  let missing = 0;
  for (const [suffix, points] of lines) {
    const line = world.getComponent<Line3D>(`${prefix}:${suffix}`, 'Line3D');
    if (line) line.points = points;
    else missing++;
  }
  return missing;
}

export const crowdAvoidanceCapability = defineCapability({
  id: 't2-crowd-avoidance', version: '1.0.0',
  describe: {
    name: 'crowd-avoidance',
    summary: 'A*、流场及速度意图共用 ORCA：快照邻居、避让后写速度、再移动。旧流场 ORCA 保持不变。',
    semantic: ['tier2', 'movement', 'crowd', 'avoidance'],
    whenToUse: '不同目标/不同体型的地面单位互相避让。每个参与单位挂 CrowdAvoidance；先装导航再装本能力和 motion-apply。不能与同单位 FlowAgent.orca/separation 双开（保留旧配置并留痕）。零期望速度保持停止；ORCA 无解仍可能重叠，需碰撞修正。',
    examples: ['NavAgent{graphId:"small",speed:0.04,arriveRange:0.1} + CrowdAvoidance{radius:0.6,maxSpeed:0.04}', 'FlowAgent{fieldId:"large",speed:0.03} + CrowdAvoidance{radius:2,maxSpeed:0.03}'],
  },
  components: {
    provides: {
      CrowdAvoidance: { category: 'config', describe: '共享 ORCA 配置；不同导航目标仍相互可见，同物理地面使用相同 group。', fields: {
        radius: { type: 'number', describe: '圆形足迹半径，有限正数' },
        maxSpeed: { type: 'number', describe: '最大速度，世界单位/tick，有限非负数' },
        timeHorizon: { type: 'number', describe: '前瞻 tick 数，缺省 8，有限正数；不是秒' },
        maxNeighbors: { type: 'number', describe: '最多考虑的最近邻居数，缺省 8，正整数' },
        neighborDistance: { type: 'number', describe: '可选邻域距离，有限正数；缺省按双方最大速度和半径推导' },
        group: { type: 'string', describe: '物理地面分组，缺省全在同组；不要按目标或体型分组' },
        yieldAfterTicks: { type: 'number', describe: '可选整数 ≥3：连续几乎无位移后才收缩圆形碰撞足迹，前约三分之一先试侧向扰动；需同实体 Shape.circle 且半径与 radius 相同' },
        minRadiusScale: { type: 'number', describe: '收缩下限相对初始半径的比例 (0,1]，缺省 0.8' },
        radiusStep: { type: 'number', describe: '每拍收缩/恢复初始半径的比例 (0,1]，缺省 0.025；恢复会检查周围空位' },
        nudgeStrength: { type: 'number', describe: '先尝试固定侧向扰动矢量的强度 (0,1]，缺省 0.5；硬碰撞始终保留' },
        zeroEscape: { type: 'boolean', describe: '可选：首次 ORCA 速度接近零且仍有移动意图时，以侧向候选期望速度重新求解；缺省关闭' },
        priorityMode: { type: 'string', describe: '可选 mass-stall：按 Mass.value（缺省1）× 连续卡住时间分配避让责任；卡住30步优先级翻倍，最多提高至5倍；缺省双方各让一半。Mass 可按体积配置。' },
        desiredInertia: { type: 'number', describe: '可选 [0,1)：把上拍真实速度混入路线期望速度，再交 ORCA 求解，抑制载具急转与摆动；零移动意图仍立即停止。缺省0' },
        flowGuide: { type: 'string', describe: '可选 {fieldId,weight?,repathDistance?,pathfindDistance?,releaseDistance?,occupancyPenalty?,pathfindPeriod?,edgeRepathSlots?}：偏离路线先受共享 FlowField 引导，更远时可用同 profile 的 NavGraph/A* 绕占用格回路；edgeRepathSlots 按空侧优先限制同路活跃回路数，久卡可越限，然后交 ORCA；无场或不可达保留原意图' },
        repathPath: { type: 'string', describe: '引擎记录的回路 A* 途经节点与目标，随快照保存；作者无需填写' },
        debugVectorPrefix: { type: 'string', describe: '可选调试线实体前缀；预建 :desired/:raw/:actual/:avoid 四条 Line3D，actual 为碰撞前 ORCA 采用速度' },
        debugVectorScale: { type: 'number', describe: '调试矢量可视长度倍率，缺省 50，须为有限正数' },
        debugVectorY: { type: 'number', describe: '调试矢量高度，缺省 1，须为有限非负数' },
        stuckTicks: { type: 'number', describe: '运行时连续无前向进展步数；快照状态' },
        clearTicks: { type: 'number', describe: '运行时连续恢复步数；快照状态' },
        nudgeTicks: { type: 'number', describe: '运行时侧向扰动保持时间；快照状态' },
        lastX: { type: 'number', describe: '上一拍位置 x；快照状态' },
        lastY: { type: 'number', describe: '上一拍位置 y；快照状态' },
      } },
      CrowdVelocity: { category: 'config', describe: '系统每拍捕获的实际速度；快照可恢复，作者无需填写。', fields: {
        vx: { type: 'number', describe: '本拍开始时 x 速度' }, vy: { type: 'number', describe: '本拍开始时 y 速度' },
      } },
    },
    reads: ['CrowdAvoidance', 'CrowdVelocity', 'Transform', 'Velocity', 'FlowAgent', 'FlowField', 'PathFollow', 'NavGraph', 'Shape', 'Mass', 'Sensor', 'Line3D'],
    writes: ['CrowdAvoidance', 'CrowdVelocity', 'Velocity', 'Shape', 'Line3D'], consumes: [],
  },
  config: {},
  systems: [
    {
      id: 'crowd-capture', phase: SystemPhase.Intent,
      reads: ['CrowdAvoidance', 'Velocity'], writes: ['CrowdVelocity'], consumes: [],
      execute(world) {
        for (const id of sortedIds(world, 'CrowdAvoidance')) {
          const v = world.getComponent<Velocity>(id, 'Velocity');
          world.addComponent(id, { type: 'CrowdVelocity', vx: v?.vx ?? 0, vy: v?.vy ?? 0 } as CrowdVelocity);
        }
      },
    },
    {
      id: 'crowd-avoidance',
      runsAfter: ['steering', 'nav-follow', 'path-follow', 'flow-field', 'accel-apply', 'drag-place'],
      // Bounce writes the following tick's reaction velocity after motion;
      // prevent its inferred Velocity edge pointing back into this solve.
      runsBefore: ['motion-apply', 'hitbox', 'over-time', 'bounce-relay'],
      reads: ['CrowdAvoidance', 'CrowdVelocity', 'Transform', 'Velocity', 'FlowAgent', 'FlowField', 'PathFollow', 'NavGraph', 'Shape', 'Mass', 'Sensor', 'Line3D'],
      writes: ['CrowdAvoidance', 'Velocity', 'Shape', 'Line3D'], consumes: [],
      execute(world) {
        const ids = sortedIds(world, 'CrowdAvoidance', 'Transform');
        if (!ids.length) return;
        const trace = findDebugTrace(world);
        const stats: OrcaStats = { degenerate: 0, oneSided: 0, infeasible: 0 };
        let invalid = 0; let dual = 0; let stopped = 0; let solved = 0;
        let recoveryRejected = 0; let recoveryBlocked = 0; let shrunk = 0; let restored = 0; let nudged = 0;
        let zeroRecovered = 0; let zeroUnresolved = 0; let missingVectors = 0; let invalidPriorityMass = 0; let weighted = 0;
        let guided = 0; let guideUnavailable = 0; let routePlanned = 0; let routeFollowing = 0; let routeUnavailable = 0; let routeDeferred = 0;
        // 先以实际位移和本拍的路线意图判定卡住。只改变圆形地面足迹，模型网格从不参与碰撞。
        // Shape 与 ORCA 共用有效半径；全部状态写回组件以保持快照/重放确定。
        const recovering: string[] = [];
        const recoveryReady = new Set<string>();
        for (const id of ids) {
          const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
          if ((cfg.yieldAfterTicks === undefined && cfg.priorityMode === undefined) || !valid(cfg)) continue;
          const shape = world.getComponent<Shape>(id, 'Shape');
          const t = world.getComponent<Transform>(id, 'Transform')!;
          const v = world.getComponent<Velocity>(id, 'Velocity');
          const flow = world.getComponent<FlowAgent>(id, 'FlowAgent');
          if (flow?.orca || flow?.separation) continue;
          if ((cfg.yieldAfterTicks !== undefined &&
              (shape?.kind !== 'circle' || !Number.isFinite(shape.radius) ||
               shape.radius! > cfg.radius + 1e-9 || shape.radius! < cfg.radius * (cfg.minRadiusScale ?? .8) - 1e-9 ||
               (cfg.lastX === undefined && Math.abs(shape.radius! - cfg.radius) > 1e-9) || world.hasComponent(id, 'Sensor'))) || !v ||
              ![t.x,t.y,v.vx,v.vy,cfg.lastX ?? t.x,cfg.lastY ?? t.y].every(Number.isFinite)) {
            recoveryRejected++; continue;
          }
          if (cfg.yieldAfterTicks !== undefined) recoveryReady.add(id);
          const intent = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
          const dx = t.x - (cfg.lastX ?? t.x), dy = t.y - (cfg.lastY ?? t.y);
          const displacement = Math.sqrt(dx * dx + dy * dy);
          // 绕行即使横向于期望方向也算运动；只把真正几乎原地不动视为卡住。
          const blocked = cfg.lastX !== undefined && intent > cfg.maxSpeed * .25 && displacement < cfg.maxSpeed * .1;
          cfg.stuckTicks = blocked ? Math.min((cfg.stuckTicks ?? 0) + 1, cfg.yieldAfterTicks === undefined ? 120 : Number.MAX_SAFE_INTEGER) : 0;
          cfg.clearTicks = blocked ? 0 : (cfg.clearTicks ?? 0) + 1;
          cfg.lastX = t.x; cfg.lastY = t.y;
          if (cfg.yieldAfterTicks === undefined) continue;
          const body = shape!; // 上方仅在启用收缩时验证 Shape.circle
          const nudgeAfter = Math.max(1, Math.floor(cfg.yieldAfterTicks / 3));
          cfg.nudgeTicks = cfg.stuckTicks >= nudgeAfter ? 12 : Math.max(0, (cfg.nudgeTicks ?? 0) - 1);
          if (cfg.stuckTicks >= cfg.yieldAfterTicks) {
            const next = Math.max(cfg.radius * (cfg.minRadiusScale ?? .8), body.radius! - cfg.radius * (cfg.radiusStep ?? .025));
            if (next < body.radius!) { body.radius = next; shrunk++; }
          } else if (cfg.clearTicks >= 4 && body.radius! < cfg.radius - 1e-9) recovering.push(id);
        }
        // 恢复前做真实形状接触检查；若周围没有容纳圆柱截面的空位，保持收缩而不弹开邻居。
        if (recovering.length) {
          const shapeIds = sortedIds(world, 'Shape', 'Transform');
          const shapeTree = new DynamicAabbTree();
          for (const id of shapeIds) shapeTree.insert(id, aabbOf(world.getComponent<Transform>(id, 'Transform')!, world.getComponent<Shape>(id, 'Shape')!));
          for (const id of recovering) {
            const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
            const t = world.getComponent<Transform>(id, 'Transform')!;
            const shape = world.getComponent<Shape>(id, 'Shape')!;
            const candidate: Shape = { ...shape, radius: Math.min(cfg.radius, shape.radius! + cfg.radius * (cfg.radiusStep ?? .025)) };
            const neighbors = shapeTree.query(aabbOf(t, candidate));
            const clear = neighbors.every(other => {
              if (other === id || world.hasComponent(other, 'Sensor')) return true;
              const otherShape = world.getComponent<Shape>(other, 'Shape')!;
              return !canCollide(candidate, otherShape) || !contactBetween(t, candidate,
                world.getComponent<Transform>(other, 'Transform')!, otherShape);
            });
            if (clear) { shape.radius = candidate.radius; shapeTree.insert(id, aabbOf(t, shape)); restored++; }
            else recoveryBlocked++;
          }
        }
        // 所有输入先快照；循环中不读其他单位刚求出的速度。
        const samples = new Map<string, { agent: OrcaAgent; cfg: CrowdAvoidance; desired: {x:number;y:number}; pref: {x:number;y:number}; move: boolean; legacy: boolean }>();
        const trees = new Map<string, { tree: DynamicAabbTree; speed: number; radius: number }>();
        const guideFields = new Map<string, ReturnType<typeof getBakedField> | null>();
        const repathGrids = new Map<string, PreparedRepathGrid | null>();
        const repathGraphKeys = new Map<NavGraph, string | null>();
        const preplannedRoutes = new Map<string, number[]>();
        let repathObstacles: Array<RepathObstacle & { group: string }> | undefined;
        const edgeGranted = new Set<string>();
        if (ids.some(id => world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.flowGuide?.edgeRepathSlots)) {
          const actors = ids.flatMap(id => {
            const t = world.getComponent<Transform>(id, 'Transform');
            const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance');
            const shape = world.getComponent<Shape>(id, 'Shape');
            const radius = shape?.kind === 'circle' ? shape.radius : cfg?.radius;
            if (!t || !cfg || !Number.isFinite(t.x) || !Number.isFinite(t.y) ||
                !Number.isFinite(radius) || !(radius! > 0) || world.hasComponent(id, 'Sensor')) return [];
            return [{ id, x: t.x, y: t.y, radius: radius!, group: cfg.group ?? '' }];
          });
          repathObstacles = actors;
          const buckets = new Map<string, { fieldId: string; group: string; slots: number; active: string[];
            candidates: EdgeRepathCandidate[] }>();
          const goals = new Map<string, { x: number; y: number }>();
          for (const actor of actors) {
            const cfg = world.getComponent<CrowdAvoidance>(actor.id, 'CrowdAvoidance')!;
            const guide = cfg.flowGuide;
            const flow = world.getComponent<FlowAgent>(actor.id, 'FlowAgent');
            if (flow?.orca || flow?.separation) {
              delete cfg.repathPath;
              continue;
            }
            if (!guide?.edgeRepathSlots || !guide.pathfindDistance || !valid(cfg)) continue;
            const key = `${guide.fieldId}\u0000${actor.group}`;
            let bucket = buckets.get(key);
            if (!bucket) {
              bucket = { fieldId: guide.fieldId, group: actor.group,
                slots: guide.edgeRepathSlots, active: [], candidates: [] };
              buckets.set(key, bucket);
            }
            bucket.slots = Math.min(bucket.slots, guide.edgeRepathSlots);
            const path = world.getComponent<PathFollow>(actor.id, 'PathFollow');
            const projection = path ? routeProjection(world.getComponent<Transform>(actor.id, 'Transform')!, path) : null;
            const v = world.getComponent<Velocity>(actor.id, 'Velocity');
            if (cfg.repathPath) {
              if (!projection || projection.distance <= (guide.releaseDistance ?? guide.pathfindDistance / 2)) {
                delete cfg.repathPath;
              } else {
                if ((cfg.stuckTicks ?? 0) < Math.max(12, Math.floor((cfg.yieldAfterTicks ?? 60) / 2))) {
                  bucket.active.push(actor.id);
                }
                continue;
              }
            }
            if (!projection || !v || ![v.vx, v.vy].every(Number.isFinite) || !(v.vx !== 0 || v.vy !== 0)) continue;
            if (projection.distance < guide.pathfindDistance) continue;
            if ((cfg.stuckTicks ?? 0) >= Math.max(12, Math.floor((cfg.yieldAfterTicks ?? 60) / 2))) {
              edgeGranted.add(actor.id);
              continue;
            }
            bucket.candidates.push({ ...actor, desiredX: v.vx, desiredY: v.vy,
              stuckTicks: cfg.stuckTicks ?? 0 });
            goals.set(actor.id, { x: projection.goalX, y: projection.goalY });
          }
          for (const bucket of buckets.values()) {
            if (bucket.active.length > bucket.slots) {
              const activeCandidates = bucket.active.map(id => {
                const actor = actors.find(other => other.id === id)!;
                const velocity = world.getComponent<Velocity>(id, 'Velocity');
                return { ...actor, desiredX: velocity?.vx ?? 0, desiredY: velocity?.vy ?? 0,
                  stuckTicks: world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.stuckTicks ?? 0 };
              });
              const retained = selectEdgeRepaths(activeCandidates,
                actors.filter(actor => actor.group === bucket.group), bucket.slots);
              for (const id of bucket.active) {
                if (!retained.has(id)) delete world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.repathPath;
              }
              bucket.active = bucket.active.filter(id => retained.has(id));
            }
            const available = Math.max(0, bucket.slots - bucket.active.length);
            if (!available || !bucket.candidates.length) continue;
            const graph = world.getComponent<NavGraph>(bucket.fieldId, 'NavGraph');
            if (!graph?.grid || !validExplicitGraph(graph)) continue;
            repathGraphKeys.set(graph, exactGraphKey(graph));
            const key = `${bucket.fieldId}\u0000${bucket.group}`;
            const prepared = prepareRepathGrid(graph,
              actors.filter(actor => actor.group === bucket.group));
            repathGrids.set(key, prepared);
            if (!prepared) continue;
            const ranked = selectEdgeRepaths(bucket.candidates,
              actors.filter(actor => actor.group === bucket.group), bucket.candidates.length);
            let granted = 0;
            for (const id of ranked) {
              const actor = bucket.candidates.find(candidate => candidate.id === id)!;
              const goal = goals.get(id)!;
              const guide = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.flowGuide!;
              const via = planRouteRejoin(prepared, actor.x, actor.y, goal.x, goal.y,
                guide.occupancyPenalty ?? 0);
              if (!via) continue;
              edgeGranted.add(id);
              preplannedRoutes.set(id, via);
              if (++granted >= available) break;
            }
          }
        }
        for (const [idx, id] of ids.entries()) {
          const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
          const t = world.getComponent<Transform>(id, 'Transform')!;
          const v = world.getComponent<Velocity>(id, 'Velocity');
          const old = world.getComponent<CrowdVelocity>(id, 'CrowdVelocity');
          const flow = world.getComponent<FlowAgent>(id, 'FlowAgent');
          const legacy = !!(flow?.orca || flow?.separation);
          if (legacy) dual++;
          if (!valid(cfg) || ![t.x, t.y, v?.vx ?? 0, v?.vy ?? 0, old?.vx ?? 0, old?.vy ?? 0].every(Number.isFinite)) {
            invalid++;
            if (v && !legacy) { v.vx = 0; v.vy = 0; }
            clearDebugVectors(world, cfg);
            continue;
          }
          let desired = { x: v?.vx ?? 0, y: v?.vy ?? 0 };
          if (cfg.flowGuide && !legacy && (desired.x !== 0 || desired.y !== 0)) {
            const path = world.getComponent<PathFollow>(id, 'PathFollow');
            const projection = path ? routeProjection(t, path) : null;
            const weight = path ? flowGuideWeight(t, path, cfg.flowGuide) : null;
            if (weight === null) guideUnavailable++;
            else if (weight > 0) {
              const fid = cfg.flowGuide.fieldId;
              const field = fid ? world.getComponent<FlowField>(fid, 'FlowField') : undefined;
              if (!field || field.id !== fid) guideUnavailable++;
              else {
                let baked = guideFields.get(fid!);
                if (baked === undefined) {
                  baked = usableGuideField(field) ? getBakedField(field) : null;
                  guideFields.set(fid!, baked);
                }
                if (!baked) guideUnavailable++;
                else {
                  const {col,row} = cellOf(field,t.x,t.y);
                  const cell = cellIndex(field,col,row);
                  const guidedDesired = cell < 0 ? null : blendFlowDirection(desired,
                    {x:baked.dir[cell*2],y:baked.dir[cell*2+1]},weight);
                  if (guidedDesired) { desired = guidedDesired; guided++; }
                  else guideUnavailable++;
                }
              }
            }
            if (cfg.flowGuide.pathfindDistance) {
              if (cfg.flowGuide.edgeRepathSlots && !cfg.repathPath && projection &&
                  projection.distance >= cfg.flowGuide.pathfindDistance && !edgeGranted.has(id)) {
                routeDeferred++;
              } else {
                const fid = cfg.flowGuide.fieldId;
                const graph = world.getComponent<NavGraph>(fid, 'NavGraph');
                const step = advanceRouteRepath(cfg, t, graph && Array.isArray(graph.nodes) ? graph : undefined,
                  projection, desired, () => {
                    if (!graph?.grid) return null;
                    if (!repathGraphKeys.has(graph)) repathGraphKeys.set(graph,
                      validExplicitGraph(graph) ? exactGraphKey(graph) : null);
                    return repathGraphKeys.get(graph) ?? null;
                  }, () => {
                    const group = cfg.group ?? '';
                    const key = `${fid}\u0000${group}`;
                    if (!repathGrids.has(key)) {
                      if (!graph?.grid || repathGraphKeys.get(graph) === null) repathGrids.set(key, null);
                      else {
                        repathObstacles ??= ids.flatMap(otherId => {
                          const other = world.getComponent<Transform>(otherId, 'Transform');
                          const otherCfg = world.getComponent<CrowdAvoidance>(otherId, 'CrowdAvoidance');
                          const shape = world.getComponent<Shape>(otherId, 'Shape');
                          const radius = shape?.kind === 'circle' ? shape.radius : otherCfg?.radius;
                          if (!other || !otherCfg || !Number.isFinite(other.x) || !Number.isFinite(other.y)
                            || !Number.isFinite(radius) || !(radius! > 0) || world.hasComponent(otherId, 'Sensor')) return [];
                          return [{ x: other.x, y: other.y, radius: radius!, group: otherCfg.group ?? '' }];
                        });
                        repathGrids.set(key, prepareRepathGrid(graph,
                          repathObstacles.filter(other => other.group === group)));
                      }
                    }
                    return repathGrids.get(key) ?? null;
                  }, preplannedRoutes.get(id));
                desired = step.desired;
                if (step.status === 'planned') routePlanned++;
                else if (step.status === 'following') routeFollowing++;
                else if (step.status === 'unavailable') routeUnavailable++;
              }
            }
          }
          let pref = desired;
          if (cfg.desiredInertia && !legacy && (desired.x !== 0 || desired.y !== 0)) {
            const keep = cfg.desiredInertia;
            pref = {x: desired.x * (1-keep) + (old?.vx ?? 0) * keep,
              y: desired.y * (1-keep) + (old?.vy ?? 0) * keep};
          }
          if (recoveryReady.has(id) && (cfg.nudgeTicks ?? 0) > 0 && (pref.x !== 0 || pref.y !== 0)) {
            const side = nudgeSide(id), strength = cfg.nudgeStrength ?? .5;
            const factor = 1 / Math.sqrt(1 + strength * strength);
            pref = { x: (pref.x - side * pref.y * strength) * factor,
              y: (pref.y + side * pref.x * strength) * factor };
            nudged++;
          }
          const move = !legacy && cfg.maxSpeed > 0 && (pref.x !== 0 || pref.y !== 0);
          // 停止者按静止不互惠障碍参与，移动者承担完整避让；不会被 ORCA 自发推走。
          const effectiveRadius = recoveryReady.has(id)
            ? world.getComponent<Shape>(id, 'Shape')!.radius! : cfg.radius;
          const mass = world.getComponent<Mass>(id, 'Mass');
          const massValue = mass && Number.isFinite(mass.value) && mass.value > 0 ? mass.value : 1;
          if (cfg.priorityMode === 'mass-stall') {
            weighted++;
            if (mass && massValue === 1 && mass.value !== 1) invalidPriorityMass++;
          }
          const agent: OrcaAgent = { x: t.x, y: t.y, vx: move || legacy ? old?.vx ?? 0 : 0, vy: move || legacy ? old?.vy ?? 0 : 0,
            radius: effectiveRadius, idx, reciprocal: move,
            priority: cfg.priorityMode === 'mass-stall'
              ? Math.min(1e6, massValue * (1 + Math.min(cfg.stuckTicks ?? 0, 120) / 30)) : 1 };
          samples.set(id, {agent, cfg, desired, pref, move, legacy});
          const key = cfg.group ?? '';
          let bucket = trees.get(key);
          if (!bucket) { bucket = {tree: new DynamicAabbTree(), speed: 0, radius: 0}; trees.set(key, bucket); }
          bucket.speed = Math.max(bucket.speed, cfg.maxSpeed, Math.sqrt(agent.vx * agent.vx + agent.vy * agent.vy));
          bucket.radius = Math.max(bucket.radius, agent.radius);
          bucket.tree.insert(id, {minX:t.x-agent.radius,minY:t.y-agent.radius,maxX:t.x+agent.radius,maxY:t.y+agent.radius});
        }
        for (const [id, s] of samples) {
          const v = world.getComponent<Velocity>(id, 'Velocity');
          if (s.legacy) { clearDebugVectors(world, s.cfg); continue; }
          if (!s.move) {
            if (v) {v.vx=0;v.vy=0;}
            missingVectors += writeDebugVectors(world, s.cfg, world.getComponent<Transform>(id, 'Transform')!, s.desired, {x:0,y:0}, {x:0,y:0});
            stopped++; continue;
          }
          const b = trees.get(s.cfg.group ?? '')!;
          const h = s.cfg.timeHorizon ?? 8;
          const range = s.cfg.neighborDistance ?? h * (s.cfg.maxSpeed + b.speed) + s.agent.radius + b.radius;
          const a = s.agent;
          const neighbors = b.tree.query({minX:a.x-range,minY:a.y-range,maxX:a.x+range,maxY:a.y+range})
            .filter(other => other !== id)
            .map(other => samples.get(other)!.agent)
            .map(other => ({other,d2:(other.x-a.x)**2+(other.y-a.y)**2}))
            .filter(n => n.d2 <= range * range)
            .sort((x,y) => x.d2-y.d2 || x.other.idx-y.other.idx)
            .slice(0,s.cfg.maxNeighbors ?? 8).map(n=>n.other);
          let out = orcaVelocity(a, neighbors, s.pref, s.cfg.maxSpeed, h, 1, stats);
          const raw = {x:out.x,y:out.y};
          const rawSpeed2 = raw.x*raw.x + raw.y*raw.y;
          const desiredSpeed = Math.sqrt(s.desired.x*s.desired.x + s.desired.y*s.desired.y);
          if (s.cfg.zeroEscape && desiredSpeed > s.cfg.maxSpeed * .25 &&
              rawSpeed2 < (s.cfg.maxSpeed * .08) ** 2) {
            const side = nudgeSide(id);
            let bestSpeed2 = rawSpeed2;
            for (const sign of [side, -side]) {
              const lateral = {x: -s.desired.y * sign, y: s.desired.x * sign};
              const candidate = orcaVelocity(a, neighbors, lateral, s.cfg.maxSpeed, h, 1, stats);
              const speed2 = candidate.x*candidate.x + candidate.y*candidate.y;
              const forward = candidate.x*s.desired.x + candidate.y*s.desired.y;
              if (forward >= -s.cfg.maxSpeed*desiredSpeed*.02 &&
                  speed2 > bestSpeed2 + (s.cfg.maxSpeed*.12)**2) {
                out = candidate; bestSpeed2 = speed2;
              }
            }
            if (bestSpeed2 > rawSpeed2) zeroRecovered++;
            else zeroUnresolved++;
          }
          if (v) {v.vx=out.x;v.vy=out.y;} solved++;
          missingVectors += writeDebugVectors(world, s.cfg, world.getComponent<Transform>(id, 'Transform')!, s.desired, raw, out);
        }
        if (invalid || dual || recoveryRejected || recoveryBlocked || missingVectors || invalidPriorityMass || guideUnavailable || routeUnavailable || routeDeferred || stats.degenerate || stats.oneSided || stats.infeasible)
          appendTrace(trace, world.getVersion(), 'crowd-avoidance', 'reject',
            `非法 ${invalid} · 非法优先级质量 ${invalidPriorityMass} · 流场不可用 ${guideUnavailable} · 回路不可达 ${routeUnavailable} · 边缘名额等待 ${routeDeferred} · 收缩配置不匹配 ${recoveryRejected} · 恢复空间不足 ${recoveryBlocked} · 缺调试线 ${missingVectors} · 重复配置保留旧行为 ${dual} · 退化 ${stats.degenerate} · 单方避让 ${stats.oneSided} · 无解 ${stats.infeasible}`);
        if (nudged || shrunk || restored || zeroRecovered || zeroUnresolved) appendTrace(trace, world.getVersion(), 'crowd-avoidance', 'transition',
          `侧向扰动 ${nudged} · 零速重解成功 ${zeroRecovered} · 仍为零 ${zeroUnresolved} · 兜底收缩 ${shrunk} · 安全恢复 ${restored}`);
        appendTrace(trace, world.getVersion(), 'crowd-avoidance', 'commit', `求解 ${solved} · 保持停止 ${stopped} · 质量/卡顿加权 ${weighted} · 网格流场引导 ${guided} · A* 重算 ${routePlanned} / 跟随 ${routeFollowing}`);
      },
    },
  ],
});
