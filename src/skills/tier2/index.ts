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
export { animStateCapability } from './anim-state.js';
export { facingCapability } from './facing.js';
// card-play（REQ-016/017）：卡牌「出牌」确定性输入接缝——命令流→按 owner 路由各玩家 PlayedHand + scoring Flag。可 lockstep 多人。
export { cardPlayCapability, decodeCard, encodeCard } from './card-play.js';
// card-pile（REQ-017）：牌库/手牌 sim 内确定性管理（发牌/选牌下标/补牌/弃牌）——回合流程数据化 + lockstep 共同前置。
export { cardPileCapability } from './card-pile.js';
// self-rule（REQ-021）：逻辑链实体本地(self)作用域——对每个实体读自身条件→对自身施效。补动态多实体自治缺口。
export { selfRuleCapability, evaluateSelfCondition } from './self-rule.js';
// group-count（REQ-022）：集合读——按 Tag 掩码数全场实体→写数值 Resource（羁绊/波次/人口）。阈值信号=event-when(edge) 重组。
export { groupCountCapability } from './group-count.js';
// grid-move + hex（REQ-024）：六边形棋盘确定性 A* 寻路 + 逐格移动（金铲铲式自动战斗；跨游戏战棋/RTS/塔防复用）。
export { gridMoveCapability } from './grid-move.js';
export { hexDistance, hexNextStep, HEX_DIRS } from './hex.js';
export type { Hex } from './hex.js';
