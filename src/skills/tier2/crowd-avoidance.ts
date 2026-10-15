import { defineCapability } from '@engine/core/define-capability.js';
import { sortedIds } from '@engine/core/query.js';
import { SystemPhase, type IWorld } from '@engine/core/types.js';
import { DynamicAabbTree } from '@engine/spatial/aabb-tree.js';
import type { CrowdAvoidance, CrowdVelocity } from '@engine/protocol/components/crowd.js';
import type { Transform, Velocity, FlowAgent, FlowField, PathFollow, NavGraph, Shape, Line3D, Mass } from '@engine/protocol/components.js';
import { type OrcaAgent, type OrcaStats } from './orca.js';
import { cellIndex, cellOf, getBakedField } from './flow-field-core.js';
import { flowGuideWeight, blendFlowDirection, routeProjection, usableGuideField } from './crowd-flow-guide.js';
import { advanceRouteRepath, prepareRepathGrid } from './crowd-route-repath.js';
import { exactGraphKey, validExplicitGraph } from './pathfind-graph-key.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';
import { valid, nudgeSide } from './crowd-config.js';
import { clearDebugVectors, writeDebugVectors } from './crowd-debug-vectors.js';
import { updateFootprints } from './crowd-footprint.js';
import { prepareEdgeRepaths } from './crowd-edge-repath.js';
import { solveCrowdVelocity } from './crowd-orca-solve.js';

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
      CrowdAvoidance: { category: 'config', describe: '共享 ORCA 配置；同物理地面使用相同 group。repathPath、stuckTicks、clearTicks、nudgeTicks、lastX、lastY 是引擎保存的运行时状态，作者无需填写。', fields: {
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
        anticipatoryOffset: { type: 'number', describe: '可选 (0,1]：前方圆形邻居按双方实际半径和提前侧偏，数值是最大侧向强度；ORCA 与硬碰撞仍约束结果' },
        priorityMode: { type: 'string', describe: '可选 mass-stall：按 Mass.value（缺省1）× 连续卡住时间分配避让责任；卡住30步优先级翻倍，最多提高至5倍；缺省双方各让一半。Mass 可按体积配置。' },
        desiredInertia: { type: 'number', describe: '可选 [0,1)：把上拍真实速度混入路线期望速度，再交 ORCA 求解，抑制载具急转与摆动；零移动意图仍立即停止。缺省0' },
        flowGuide: { type: 'string', describe: '可选 {fieldId,weight?,repathDistance?,pathfindDistance?,releaseDistance?,occupancyPenalty?,pathfindPeriod?,edgeRepathSlots?}：偏离路线先受共享 FlowField 引导，更远时可用同 profile 的 NavGraph/A* 绕占用格回路；edgeRepathSlots 按空侧优先限制同路活跃回路数，久卡可越限，然后交 ORCA；无场或不可达保留原意图' },
        debugVectorPrefix: { type: 'string', describe: '可选调试线实体前缀；预建 :desired/:raw/:actual/:avoid 四条 Line3D，actual 为碰撞前 ORCA 采用速度' },
        debugVectorScale: { type: 'number', describe: '调试矢量可视长度倍率，缺省 50，须为有限正数' },
        debugVectorY: { type: 'number', describe: '调试矢量高度，缺省 1，须为有限非负数' },
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
        let nudged = 0;
        let zeroRecovered = 0; let zeroUnresolved = 0; let anticipatorySteered = 0; let missingVectors = 0; let invalidPriorityMass = 0; let weighted = 0;
        let guided = 0; let guideUnavailable = 0; let routePlanned = 0; let routeFollowing = 0; let routeUnavailable = 0; let routeDeferred = 0;
        const { recoveryReady, recoveryRejected, recoveryBlocked, shrunk, restored } = updateFootprints(world, ids);
        // 所有输入先快照；循环中不读其他单位刚求出的速度。
        const samples = new Map<string, { agent: OrcaAgent; cfg: CrowdAvoidance; desired: {x:number;y:number}; pref: {x:number;y:number}; move: boolean; legacy: boolean }>();
        const trees = new Map<string, { tree: DynamicAabbTree; speed: number; radius: number }>();
        const guideFields = new Map<string, ReturnType<typeof getBakedField> | null>();
        const edgePrepass = prepareEdgeRepaths(world, ids);
        const { repathGrids, repathGraphKeys, preplannedRoutes, edgeGranted } = edgePrepass;
        let repathObstacles = edgePrepass.repathObstacles;
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
          const { raw, out, recovered, unresolved, steered } = solveCrowdVelocity(
            id, a, neighbors, s.pref, s.desired, s.cfg.maxSpeed, h, s.cfg.zeroEscape, stats, s.cfg.anticipatoryOffset);
          if (steered) anticipatorySteered++;
          if (recovered) zeroRecovered++;
          if (unresolved) zeroUnresolved++;
          if (v) {v.vx=out.x;v.vy=out.y;} solved++;
          missingVectors += writeDebugVectors(world, s.cfg, world.getComponent<Transform>(id, 'Transform')!, s.desired, raw, out);
        }
        if (invalid || dual || recoveryRejected || recoveryBlocked || missingVectors || invalidPriorityMass || guideUnavailable || routeUnavailable || routeDeferred || stats.degenerate || stats.oneSided || stats.infeasible)
          appendTrace(trace, world.getVersion(), 'crowd-avoidance', 'reject',
            `非法 ${invalid} · 非法优先级质量 ${invalidPriorityMass} · 流场不可用 ${guideUnavailable} · 回路不可达 ${routeUnavailable} · 边缘名额等待 ${routeDeferred} · 收缩配置不匹配 ${recoveryRejected} · 恢复空间不足 ${recoveryBlocked} · 缺调试线 ${missingVectors} · 重复配置保留旧行为 ${dual} · 退化 ${stats.degenerate} · 单方避让 ${stats.oneSided} · 无解 ${stats.infeasible}`);
        if (nudged || shrunk || restored || zeroRecovered || zeroUnresolved || anticipatorySteered) appendTrace(trace, world.getVersion(), 'crowd-avoidance', 'transition',
          `提前侧偏 ${anticipatorySteered} · 侧向扰动 ${nudged} · 零速重解成功 ${zeroRecovered} · 仍为零 ${zeroUnresolved} · 兜底收缩 ${shrunk} · 安全恢复 ${restored}`);
        appendTrace(trace, world.getVersion(), 'crowd-avoidance', 'commit', `求解 ${solved} · 保持停止 ${stopped} · 质量/卡顿加权 ${weighted} · 网格流场引导 ${guided} · A* 重算 ${routePlanned} / 跟随 ${routeFollowing}`);
      },
    },
  ],
});
