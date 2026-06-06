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

// ── clickable ── 指针命中该实体的 Shape 时，在该实体上产出一个配置好的 Signal（命中→信号，REQ-C-002）。
// 通用「可点击实体」：棋盘格 / 缝纫按钮 / 选项 / 拖拽起点都用它，免得每游戏自己写命中测试（违反数据驱动）。
// 命中走「读单例 InputQueue 的指针坐标 → screenToWorld 逆投影 → 对 Transform+Shape 做 AABB」，确定性。
export interface Clickable extends Component {
  readonly type: 'Clickable';
  action: string; // 命中时产出的 Signal.name（下游 effect-apply / craft-recipe / match3 等按名消费）
  phase?: string; // 触发的指针相位 'down'|'up'，缺省 'down'
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

// ── sensor ── 非实心碰撞体标记（REQ-002）。挂了它的实体仍参与 overlap-detect/trigger-zone（感知），
// 但 collision-resolve **跳过**含它的接触对（不做物理推开）。开关/压力板/触发区 = Sensor，玩家能站进去。
export interface Sensor extends Component {
  readonly type: 'Sensor';
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

// ── zone-occupancy ── 声明式区域占据目标：区内匹配目标达数量阈值 → 置 outFlag（REQ-006，下沉 coop-goal）。
// 把「胜负/通关/到达/区域占据/收集齐」表达成纯数据，不写游戏专属系统。判实体中心点是否落入世界矩形。
export interface Zone extends Component {
  readonly type: 'Zone';
  outFlag: string; // 满足时置 true、否则 false 的 Flag id（按 id 全局定位）
  minX: number;
  minY: number;
  maxX: number;
  maxY: number; // 世界矩形（含边界）
  requiredTag?: number; // 选择器A：只数 Tag.flags 含此位的实体（位与非零即匹配）
  requiredEntities?: EntityId[]; // 选择器B：指定实体名单（与 requiredTag 二选一；都缺=所有带 Transform 的实体）
  count?: number; // 数量阈值。Tag/全体模式缺省=1；entities 模式缺省=名单长度（全部在内）
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

// 到点后的循环模式（REQ-004）：none=停（默认，向后兼容）；restart=归零重跑（from→to 往复）；
// pingpong=交换 from/to 再归零（来回往复，如巡逻台/呼吸立绘）。纯数据、snapshot 友好、确定性不变。
export type TweenLoop = 'none' | 'restart' | 'pingpong';

export interface Tween extends Component {
  readonly type: 'Tween';
  target: TweenTarget; // 驱动同实体上的哪个组件字段
  from: number;
  to: number;
  elapsed: number; // 已过 tick 数（每帧 +1）
  duration: number; // 总 tick 数（<=0 视为立即到 to）
  easing: TweenEasing;
  done: boolean; // elapsed>=duration 后置 true（snapshot 友好）
  loop?: TweenLoop; // 到点后的循环模式（缺省 none）
  loops?: number; // 循环程数（restart/pingpong 有效）；缺省=无限。每完成一程递减，到 1 后停在终值
}

// ── effect-apply ── Condition→Event→**Effect** 的 Effect 侧：信号在场时施加一个声明式效果。
// 跑在 Commit 阶段（晚于产信号的 event-when=Update），其对 Flag/State/Resource 的写入由下一 tick 的
// 条件读到（标准离散反馈：一拍延迟）。"信号→置 flag→下帧条件读 flag" 即让多步机制涌现。
export interface Effect extends Component {
  readonly type: 'Effect';
  onSignal: string; // 当本 tick 存在此名 Signal 时触发
  kind: 'set-flag' | 'modify-resource' | 'set-state' | 'set-sensor' | 'set-visible' | 'destroy';
  targetId: string; // 逻辑 kind：set-flag→Flag.id；modify-resource→Resource.id；set-state→State.fsmId（按 id 全局定位）
  // 物理 kind（set-sensor/set-visible/destroy，REQ-008）：要改动的目标实体 id（按实体定位，不走全局 id 路由）。
  targetEntity?: EntityId;
  value: number | string | boolean; // modify-resource=数值增量；set-flag/set-sensor/set-visible=布尔；set-state=目标状态名
}

// ── craft-recipe ── 配方/经济：信号到达且所有 costs 可负担时，**原子地**扣全部料 + 产出 gains + 置 flag/state。
// 「可负担才成交，否则整单不动」(REQ-C-003 主动缝制/商店/合成/建造) + 「一次原子改多项资源」(R14 选项批量改值)
// 归一为一个经济/批量改值 capability。effect-apply 的 modify-resource 是无条件单项加减；本能力是它的
// 条件化、原子化、多项化超集。跑在 Commit 阶段（消费 Update 产的 Signal）。确定性：只读/写确定数值。
export interface CraftRecipe extends Component {
  readonly type: 'CraftRecipe';
  onSignal: string; // 触发信号名（通常来自 clickable / event-when）
  costs: ReadonlyArray<{ id: string; amount: number }>; // 需扣除的资源（amount>0=消耗量）；空数组=无成本（纯批量产出）
  gains?: ReadonlyArray<{ id: string; amount: number }>; // 成交时同时增加的资源（可选；批量改值/合成产物）
  grantsFlag?: string; // 成交时置 true 的 Flag id（可选）
  grantsState?: { fsmId: string; value: string }; // 成交时设置的 State（可选）
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

// ── match3-board ── 三消棋盘机制（REQ-C-001）：网格消除（交换/找连/消除产出/重力/补块/连锁）。
// 这是「算法/解释器型机制」大类的代表——Condition→Event→Effect 表达不了"带网格扫描/循环的算法"。
// 相位状态机：idle（读点击选格/发起交换）→ swapped（首扫，无连线则回退）→ match（找≥3连线）
// → clear（按 kindResource 发 ResourceModify 产料/币、置 -1）→ fall（按列下沉）→ refill（顶部确定性随机补）
// → match（连锁）…稳定无连线 → idle。确定性：整数网格 + RandomSeed 整数 PRNG 补块，不碰浮点超越函数。
// 产出走现成 ResourceModify → resource-apply 结算 → game-c 升级/换装链自动点亮（游戏数据不动一行）。
export interface MatchBoard extends Component {
  readonly type: 'MatchBoard';
  cols: number;
  rows: number;
  kindCount: number; // 棋子种类数
  cells: number[]; // 长 cols*rows，值=种类 0..kindCount-1，-1=空
  kindResource: string[]; // 种类→产出 Resource id（消该种 → ResourceModify 该 id）
  matAmount: number; // 每消一格给对应材料的量
  coinResource: string; // 货币 Resource id（空串=不产币）
  coinPerTile: number; // 每消一格给的货币
  kindTint: number[]; // 种类→视图底色（match-view-sync 写 Color.tint）
  kindLabel: string[]; // 种类→视图文字（match-view-sync 写 Text.content）
  phase: string; // 'idle'|'swapped'|'match'|'clear'|'fall'|'refill'
  selIndex: number; // 当前选中格（-1=无）
  swapA: number; // 本次交换两格（-1=无）
  swapB: number;
  stepTimer: number; // 相位推进节拍计数
  stepDelay: number; // 相位间等待 tick 数（让连锁可见；0=即时）
  selectAction: string; // 选中格的信号名（clickable 命中格子时发的 Signal.name）
}

// ── match3-board 视图格 ── 把逻辑格 index 绑到一个可点/可显示的实体（纯数据，游戏蓝图静态建好）。
// match-view-sync 据 cells 改它的 Color.tint/Text.content；clickable 命中它发选中信号。capability 不创建/销毁实体。
export interface BoardCell extends Component {
  readonly type: 'BoardCell';
  boardId: EntityId;
  index: number;
}
