// ═══════════════════════════════════════════════════════════════
//  Protocol Layer — 共享组件接口
// ═══════════════════════════════════════════════════════════════
//
//  这里集中声明跨 atom-skill 共享的 Component 接口（TypeScript 形状）。
//  每个原子 skill 拥有自己的组件定义，但需要被多个 skill 读写的组件
//  在此声明，作为它们之间的契约 (protocol)。
//
//  组件语义分类（defineCapability.provides.category 标注）：
//    Resource — 持久数值，{ current, min, max }
//    Event    — 一次性，被 consume 后消失
//    Intent   — 表达"想做某事"的请求
//    Effect   — 临时状态，有字段、有持续时间
//    Marker   — 无字段，存在即有意义
//    Config   — 持久配置
//    Render   — 每帧更新，驱动 UI/渲染层
//
//  约定：World 每个实体每种 type 只存一个组件 (Map<type, Component>)。
//  契约由 Lead 预先写入，Programmer 直接 import，不在此文件追加，避免合并冲突。
//  参见 wiki/atom-skill-periodic-table.md
// ═══════════════════════════════════════════════════════════════

import type { Component, EntityId } from '../core/types.js';

// ── A1 transform ── 实体在世界的位置、朝向和大小
export interface Transform extends Component {
  readonly type: 'Transform';
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// ── F1 resource ── 某种有上下限的数值 (hp / mp / stamina ...)
export interface Resource extends Component {
  readonly type: 'Resource';
  id: string;
  current: number;
  min: number;
  max: number;
}

// ── F1 resource ── 修改某资源的事件 (read-then-consume)
export interface ResourceModify extends Component {
  readonly type: 'ResourceModify';
  resourceId: string;
  amount: number;
}

// ── F2 flag ── 某个条件开还是关
export interface Flag extends Component {
  readonly type: 'Flag';
  id: string;
  active: boolean;
}

// ── B1 velocity ── 实体当前的运动方向、速度和角速度
export interface Velocity extends Component {
  readonly type: 'Velocity';
  vx: number;
  vy: number;
  angular: number;
}

// ── E1 timer ── 倒计时/间隔（按 tick 计数，World 无 dt）
export interface Timer extends Component {
  readonly type: 'Timer';
  id: string;
  elapsed: number;
  duration: number;
  loop: boolean;
}

// ── E1 timer ── 计时完成事件（read-then-consume，由下游系统消费）
export interface TimerDone extends Component {
  readonly type: 'TimerDone';
  timerId: string;
}

// ── G1 tag ── 实体属于哪些分类（bitmask，位运算 O(1)）
export interface Tag extends Component {
  readonly type: 'Tag';
  flags: number;
}

// ── B2 acceleration ── 实体的速度在怎么变
export interface Acceleration extends Component {
  readonly type: 'Acceleration';
  ax: number;
  ay: number;
}

// ── B3 mass ── 实体有多重（0 = 不可移动）
export interface Mass extends Component {
  readonly type: 'Mass';
  value: number;
}

// ── C1 shape ── 碰撞/占位几何形状
export interface Shape extends Component {
  readonly type: 'Shape';
  kind: 'box' | 'circle' | 'polygon';
  width?: number;
  height?: number;
  radius?: number;
  // polygon: 局部空间凸多边形顶点，扁平存 [x0,y0,x1,y1,...]（不含旋转，旋转留待刚体阶段）。
  vertices?: number[];
}

// ── G2 relation ── 实体跟谁有什么逻辑关系（非空间）
export interface Relation extends Component {
  readonly type: 'Relation';
  kind: string;
  targetId: EntityId;
}

// ── H1 visibility ── 是否可见 / 是否参与系统运算
export interface Visibility extends Component {
  readonly type: 'Visibility';
  visible: boolean;
  active: boolean;
}

// ── L1 sprite ── 实体用什么图、渲染层级
export interface Sprite extends Component {
  readonly type: 'Sprite';
  textureKey: string;
  anchorX: number;
  anchorY: number;
  zOrder: number;
}

// ── L2 color ── 实体当前的颜色/透明度
export interface Color extends Component {
  readonly type: 'Color';
  tint: number;
  alpha: number;
}

// ── L3 frame ── 精灵的当前帧
export interface Frame extends Component {
  readonly type: 'Frame';
  index: number;
  total: number;
}

// ── L4 sound ── 播放什么声音
export interface Sound extends Component {
  readonly type: 'Sound';
  clipId: string;
  volume: number;
  loop: boolean;
}

// ── L5 camera ── 观察窗口参数（世界→屏幕映射基准）
export interface Camera extends Component {
  readonly type: 'Camera';
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  viewportW: number;
  viewportH: number;
}

// ── L6 text ── 显示什么文字
export interface Text extends Component {
  readonly type: 'Text';
  content: string;
  fontSize: number;
  fontFamily: string;
  anchor: string;
  lineSpacing: number;
}

// ── I1 input-capture ── 这帧的外部原始信号（由 runtime 注入）
export interface RawInput extends Component {
  readonly type: 'RawInput';
  source: string;
  key?: string;
  x?: number;
  y?: number;
  phase?: string;
}

// ── I2 action-map ── 原始信号对应的语义动作
export interface Action extends Component {
  readonly type: 'Action';
  name: string;
  value: number;
}

// ── net: controllable ── 该实体由哪个玩家(playerId)操控；input 命令按 speed 写入其 Velocity
export interface Controllable extends Component {
  readonly type: 'Controllable';
  playerId: string;
  speed: number;
}

// ── J1 state ── 实体在某状态机的当前离散状态
export interface State extends Component {
  readonly type: 'State';
  fsmId: string;
  current: string;
  previous: string;
}

// ── J1 state ── 状态切换事件（read-then-consume）
export interface StateChanged extends Component {
  readonly type: 'StateChanged';
  fsmId: string;
  from: string;
  to: string;
}

// ── K1 spawn ── 创建新实体的请求（模板展开由 assembly 层负责）
export interface SpawnRequest extends Component {
  readonly type: 'SpawnRequest';
  templateId: string;
  x: number;
  y: number;
}

// ── K2 destroy ── 移除实体的请求（read-then-consume）
export interface DestroyRequest extends Component {
  readonly type: 'DestroyRequest';
  entityId: EntityId;
}

// ── A2 hierarchy ── 实体挂在谁下面、本地偏移多少
export interface Hierarchy extends Component {
  readonly type: 'Hierarchy';
  parentId: EntityId;
  localX: number;
  localY: number;
  localRotation: number;
  localScaleX: number;
  localScaleY: number;
}

// ── W1 random ── 可控随机数（确定性重放基石），挂在 world 实体
export interface RandomSeed extends Component {
  readonly type: 'RandomSeed';
  seed: number;
  sequence: number;
}

// ── D1 overlap-detect ── 哪两个实体重叠了，法线与穿透深度
export interface Overlap extends Component {
  readonly type: 'Overlap';
  entityA: EntityId;
  entityB: EntityId;
  normalX: number;
  normalY: number;
  depth: number;
}

// ── ground-sense ── 实体这帧是否站在地面上（marker，存在即着地，每帧由 ground-sense 重算）
export interface Grounded extends Component {
  readonly type: 'Grounded';
}

// ── bounds-clamp ── 实体允许活动的世界矩形（含边界）。bounds-clamp 据此把 AABB 钳进去。
export interface Bounds extends Component {
  readonly type: 'Bounds';
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ── trigger-zone ── 触发事件：实体 other 进入了触发区 zone（每帧重算，read-then-consume 或每帧清重标）。
export interface Trigger extends Component {
  readonly type: 'Trigger';
  zone: EntityId;
  other: EntityId;
}

// ── W2 spatial-query ── 空间查询服务配置，挂在 world 实体
export interface SpatialIndex extends Component {
  readonly type: 'SpatialIndex';
  cellSize: number;
  kind: 'grid' | 'quadtree';
}
