import { sortedIds } from '@engine/core/query.js';
import type { IWorld } from '@engine/core/types.js';
import { DynamicAabbTree } from '@engine/spatial/aabb-tree.js';
import { aabbOf, contactBetween } from '@engine/spatial/contact.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { Transform, Velocity, FlowAgent, Shape } from '@engine/protocol/components.js';
import { valid } from './crowd-config.js';

function canCollide(a: Shape, b: Shape): boolean {
  return !!(((a.category ?? -1) & (b.mask ?? -1)) && ((b.category ?? -1) & (a.mask ?? -1)));
}

export function updateFootprints(world: IWorld, ids: string[]) {
  let recoveryRejected = 0, recoveryBlocked = 0, shrunk = 0, restored = 0;
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
  return { recoveryReady, recoveryRejected, recoveryBlocked, shrunk, restored };
}
