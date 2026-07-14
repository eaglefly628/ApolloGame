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
// dice-roll（REQ-GAMED #1）：掷一份声明好的骰池——rollOnSignal 触发→消费 RandomSeed 确定性掷 DicePool→写 RolledDice。
// 锁定重掷（只重掷未锁骰）+ 结算前禁骰（#4 并入）。骰能力族：对掷 opposedRoll 为同族纯函数（dice.ts，非 capability）。
export { diceRollCapability } from './dice-roll.js';
export { rollDicePool, applyBanFilter, opposedRoll, OPPOSED_MAX_REROLL } from './dice.js';
export type { TiePolicy, OpposedResult } from './dice.js';
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
// pathfind（REQ-寻路）：连续自由空间寻路——航点图 NavGraph(摆放数据) + 通用 A*(astar.ts) + 沿路跟随写 Velocity。
// grid-move(六格离散) 的连续坐标对偶；动态避让复用 collision-resolve（正交）。
export { pathfindCapability, nearestNode, buildAdjacency } from './pathfind.js';
// gauge（REQ-F-029）：Resource 比例 → 条形 Shape 投影（实时血条/蓝条/读条；左锚从右端缩，渲染器零改动）。
export { gaugeCapability } from './gauge.js';
// text-binding（REQ-F-043）：Resource 数字 → Text 投影（HUD 金币/回合/等级；gauge 管条、本件管数字）。
export { textBindingCapability } from './text-binding.js';
// drag-place（REQ-F-045）：拖拽摆放输入桥——壳层合成 drag 动作→命中 Draggable→hex 吸附/回席/限额（摆子/放塔通用）。
export { dragPlaceCapability } from './drag-place.js';
export { trayCapability } from './tray.js';
// grid-drag-square（REQ-CAP·Block Blast 机制②）：方形网格 polyomino 拖放输入桥——命中托盘块取 slot、
// 终点吸附方格 → 写 PlaceBlockIntent（block-grid 消费）。区别于 drag-place 的六边+移子（此为方形+盖章）。
export { gridDragSquareCapability, squarePointToCell } from './grid-drag-square.js';
export { hexCellToPoint, hexPointToCell } from './grid-move.js';
// modifier-stack（REQ-CAP 下沉）：修正聚合栈——全场 ModifierSource（字段表+合并策略+门控）→ ModifierTotals。
// stats 的超集（逐字段混合 add/mul/max/min/or/floor + ConditionExpr 门控）；下沉小丑计分/天罡/地煞三处同构聚合。
export { modifierStackCapability, aggregateModifiers, modifierCtx } from './modifier-stack.js';
export type { ModifierRow, ModifierCtx } from './modifier-stack.js';
