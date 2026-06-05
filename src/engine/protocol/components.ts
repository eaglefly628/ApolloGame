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
  // 寻址作用域（防"变量遮蔽"，Gemini Q4）：'local'=仅同实体；'global'=强制按 id 全局路由（不被同名局部资源静默抢走）；
  // 缺省=auto（同实体匹配优先，否则全局）。改全局态时显式写 'global' 更稳。
  scope?: 'local' | 'global';
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

// ── camera-follow ── 标记：相机要跟随的目标（合作相机取所有目标的 AABB 中点）。空 marker。
export interface CameraTarget extends Component {
  readonly type: 'CameraTarget';
}

// ── L6 text ── 显示什么文字
export interface Text extends Component {
  readonly type: 'Text';
  content: string;
  fontSize: number;
  fontFamily: string;
  anchor: string;
  lineSpacing: number;
  // 可选：按此像素宽度自动换行（多行）。<=0 或缺省 = 不自动换行（仍按 \n 硬换行）。
  maxWidth?: number;
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

// 一条原始输入事件（指针/点击/UI 动作）。x/y=屏幕或世界坐标，phase 如 'down'|'up'|'move'|'action'，
// key 可承载语义动作名（如 'choice:2'）。命中测试/语义解析归游戏层。
export interface RawInputData {
  readonly source: string;
  readonly key?: string;
  readonly x?: number;
  readonly y?: number;
  readonly phase?: string;
}

// ── 输入队列（单例）── 本 tick 的原始输入事件列表。挂在唯一实体上，每 tick 整体覆写（零实体分配），
// 取代"每次点击建/毁 RawInput 实体"的高频 GC 范式。游戏层读 actions 做命中/语义解析。
export interface InputQueue extends Component {
  readonly type: 'InputQueue';
  actions: ReadonlyArray<RawInputData>;
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

// ── 逻辑：Condition → Event（B 轴枢纽，离散逻辑层）─────────────────────────────
// 比较算子（确定性：只比较数/字符串/bool，不碰浮点超越函数）。
export type CmpOp = 'lt' | 'lte' | 'eq' | 'ne' | 'gte' | 'gt';

// 布尔条件树：and/or/not 组合在「按语义 id 读世界值」的比较叶子上。纯 POD，
// structuredClone 友好 → 自动进 world.snapshot()。threshold/状态判定/机关门控都是它的特例。
export type ConditionExpr =
  | { readonly kind: 'and'; readonly of: ConditionExpr[] }
  | { readonly kind: 'or'; readonly of: ConditionExpr[] }
  | { readonly kind: 'not'; readonly of: ConditionExpr }
  | { readonly kind: 'resource'; readonly id: string; readonly cmp: CmpOp; readonly value: number }
  | { readonly kind: 'flag'; readonly id: string; readonly equals?: boolean }
  | { readonly kind: 'state'; readonly fsmId: string; readonly equals: string }
  | { readonly kind: 'timer'; readonly id: string; readonly cmp: CmpOp; readonly value: number }
  | { readonly kind: 'string'; readonly id: string; readonly equals: string };

// ── event-when ── 条件成立时发信号。逻辑核心层，不直接产生效果(Effect 后置)。
export interface EventWhen extends Component {
  readonly type: 'EventWhen';
  signal: string; // 触发时产出的信号名
  when: ConditionExpr; // 布尔条件树
  mode: 'edge' | 'level'; // edge=上升沿触发一次(迟滞)；level=条件为真时每帧持续触发
  armed: boolean; // 边沿检测内部状态：true=已在本轮触发、等条件回落后复位
}

// ── event-when 产出 ── 信号事件：某 EventWhen 这帧触发了。每帧先清后标。
export interface Signal extends Component {
  readonly type: 'Signal';
  name: string; // 信号名（= EventWhen.signal）
  source: EntityId; // 发出该信号的 EventWhen 实体 id
}

// ── tween ── 数值随时间朝目标缓动（B 轴"连续"柱）。定步长：elapsed 每帧 +1，单位=tick。
// 缓动用多项式（不碰 sin/cos）。**只驱动不被 Condition 读的"表现/软逻辑"字段**（Transform/Color）：
// 浮点插值与现有物理同属 IEEE +/-/* 确定性类，但绝不喂给 Condition 比较的逻辑数值（如 Resource.current），
// 以免跨端 1 ULP 差异造成阈值触发帧错位（Gemini Q6）。逻辑数值渐变请用整数分步（timer + ResourceModify）。
export type TweenTarget =
  | 'Transform.x'
  | 'Transform.y'
  | 'Transform.rotation'
  | 'Transform.scaleX'
  | 'Transform.scaleY'
  | 'Color.alpha';

export type TweenEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Tween extends Component {
  readonly type: 'Tween';
  target: TweenTarget; // 驱动同实体上的哪个组件字段
  from: number;
  to: number;
  elapsed: number; // 已过 tick 数（每帧 +1）
  duration: number; // 总 tick 数（<=0 视为立即到 to）
  easing: TweenEasing;
  done: boolean; // elapsed>=duration 后置 true（snapshot 友好）
}

// ── effect-apply ── Condition→Event→**Effect** 的 Effect 侧：信号在场时施加一个声明式效果。
// 跑在 Commit 阶段（晚于产信号的 event-when=Update），其对 Flag/State/Resource 的写入由下一 tick 的
// 条件读到（标准离散反馈：一拍延迟）。"信号→置 flag→下帧条件读 flag" 即让多步机制涌现。
export interface Effect extends Component {
  readonly type: 'Effect';
  onSignal: string; // 当本 tick 存在此名 Signal 时触发
  kind: 'set-flag' | 'modify-resource' | 'set-state';
  targetId: string; // set-flag→Flag.id；modify-resource→Resource.id；set-state→State.fsmId（均按 id 全局定位）
  value: number | string | boolean; // modify-resource=数值增量；set-flag=布尔；set-state=目标状态名
}

// ── string-variable ── 命名字符串容器（周期表 X3：对话/换装/结局标识刚需）。
export interface StringVar extends Component {
  readonly type: 'StringVar';
  id: string; // 语义标识（如 "story-node"、"ending"、"player-name"）
  value: string;
}

// ── string-variable 写事件 ── 一次性设置 id=X 的字符串变量（全局按 id 路由，执行后被消费）。
export interface StringSet extends Component {
  readonly type: 'StringSet';
  id: string;
  value: string;
  // 同 ResourceModify.scope：'local'/'global'/缺省 auto。防变量遮蔽（Gemini Q4）。
  scope?: 'local' | 'global';
}
