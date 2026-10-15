import type { Component } from '../../core/types.js';

/** 通用 ORCA，接在导航意图与位移之间；单位/tick，圆形足迹。 */
export interface CrowdAvoidance extends Component {
  readonly type: 'CrowdAvoidance';
  radius: number;
  maxSpeed: number;
  timeHorizon?: number; // ticks，缺省 8
  maxNeighbors?: number; // 正整数，缺省 8
  neighborDistance?: number; // 缺省按双方最大速度/半径及 horizon 推导
  group?: string; // 同一物理地面分组，缺省同组；不按导航目标/体型隔离
  yieldAfterTicks?: number; // 可选整数≥3：连续几乎无实际位移多少 tick 后收缩圆形足迹；之前先侧向扰动
  minRadiusScale?: number; // 收缩下限，缺省 0.8；相对原始 radius
  radiusStep?: number; // 每 tick 收缩/恢复的原始半径比例，缺省 0.025
  nudgeStrength?: number; // 卡住初期先侧向偏置期望速度的比例，缺省 0.5
  zeroEscape?: boolean; // ORCA 首次解接近零且仍有移动意图时，用侧向期望速度重解；缺省关闭
  anticipatoryOffset?: number; // 可选 (0,1]：前方邻居按双方圆形半径和提前偏移期望方向，强度上限；仍由 ORCA/硬碰撞约束
  priorityMode?: 'mass-stall'; // 可选：Mass.value × 连续卡住时长决定避让责任；缺省仍为对半避让
  desiredInertia?: number; // 可选 [0,1)：先用上一拍实际速度平滑期望方向，再交 ORCA；0=无惯性
  flowGuide?: { // 可选：按 PathFollow 当前航点读取共享网格流场，在远离路线时把场方向混入期望速度
    fieldId: string; // 由 NavigationProfile 输出的 FlowField；多源 goals 可沿巡逻线铺成回路走廊
    weight?: number; // 路线上流场权重 [0,1]，缺省0；离线后平滑增至1
    repathDistance?: number; // 离路线此距离起加大流场权重；缺省1世界单位
    pathfindDistance?: number; // 更远时用同 profile 的 NavGraph 做 A* 回路；不设则不启用
    releaseDistance?: number; // 回到路线此距离内退出 A*；缺省 pathfindDistance/2
    occupancyPenalty?: number; // A* 进入被动态单位占用格的附加代价比例；缺省0
    pathfindPeriod?: number; // 活跃回路每多少 tick 重新规划；缺省45
    edgeRepathSlots?: number; // 可选正整数：同 field/group 同时启用回路的名额，空侧较多者先进入；久卡者可越过名额
  };
  repathPath?: { via: number[]; goalX: number; goalY: number; routeIndex: number; segmentKey: string;
    age: number; graphId: string; graphKey: string }; // 运行态，随快照保存
  debugVectorPrefix?: string; // 可选 Line3D 调试线前缀：:desired/:raw/:actual/:avoid；actual 为碰撞前 ORCA 采用速度
  debugVectorScale?: number; // 速度矢量的可视长度倍率，缺省 50
  debugVectorY?: number; // 可视矢量所在高度，缺省 1
  stuckTicks?: number; // 运行时状态，参与快照
  clearTicks?: number; // 运行时连续恢复步数，参与快照
  nudgeTicks?: number; // 运行时侧向引导保持步数，参与快照
  lastX?: number; // 上一拍求解时的位置，参与快照
  lastY?: number;
}

/** Intent 阶段记录本拍开始时的实际速度，避免把刚生成的期望速度当实际速度。 */
export interface CrowdVelocity extends Component {
  readonly type: 'CrowdVelocity';
  vx: number;
  vy: number;
}
