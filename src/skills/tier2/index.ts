// Tier 2 涌现层（规则与约束 / 感知 / 控制）。读取 Tier 1 与检测原子的结果，施加约束、派生事实、响应输入。
// 跨阶段用 SystemPhase 显式定序（Update→Resolve→Commit），避免与"读位置/读速度"的系统在纯组件拓扑上成环。
export { collisionResolveCapability } from './collision-resolve.js';
export { groundSenseCapability } from './ground-sense.js';
export { jumpCapability, JUMP_SPEED } from './jump.js';
export { boundsClampCapability } from './bounds-clamp.js';
export { triggerZoneCapability, ZONE_FLAG } from './trigger-zone.js';
export { frictionCapability } from './friction.js';
export { eventWhenCapability } from './event-when.js';
export { evaluateCondition } from './condition.js';
export { effectApplyCapability } from './effect-apply.js';
export { cameraFollowCapability } from './camera-follow.js';
export { clickableCapability } from './clickable.js';
export { craftRecipeCapability } from './craft-recipe.js';
export { zoneOccupancyCapability } from './zone-occupancy.js';
export { hitboxCapability } from './hitbox.js';
export { overTimeCapability } from './over-time.js';
export { mortalCapability } from './mortal.js';
export { steeringCapability } from './steering.js';
export { keybindCapability } from './keybind.js';
export { statsCapability, computeEffective } from './stats.js';
export { launchCapability } from './launch.js';
export { tilemapCapability, findTilemap, isSolidTile } from './tilemap.js';
