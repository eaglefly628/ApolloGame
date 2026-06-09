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

// ── Status ── 实体身上的动态状态位掩码（frozen/burning/stunned…），运行时被战斗能力置/清位。
// 与 Tag（静态身份/阵营）区分：Status 是会变的战斗状态。位语义由游戏数据定义（与 Tag 同风格）。
export interface Status extends Component {
  readonly type: 'Status';
  flags: number;
}

// ── Hitbox ── 伤害源（攻击判定）。挂在被 ZONE_FLAG 标记的 Sensor+Shape+Transform 实体上：
// trigger-zone 先产出 Trigger{zone:hitbox, other:目标}，hitbox 能力据此对每个进入的目标——
// 若 Tag 匹配 targetMask（阵营过滤）且 Status 满足 requireMask（如碎冰要求 frozen）——
// 按 amount/fracOfMax 算伤害、以局部 ResourceModify 路由到该目标，并可置/清其 Status 位。
// AOE = 多 Trigger 自然 fan-out；逐目标 = 局部寻址；计算伤害 = fracOfMax；阵营/状态门 = mask。
export interface Hitbox extends Component {
  readonly type: 'Hitbox';
  resource: string; // 目标身上要改的 Resource id（如 'hp'）
  amount?: number; // 固定伤害（正数 = 伤害；内部按负向施加）
  fracOfMax?: number; // 计算伤害 = 目标该资源 max 的此分数（如 0.2 = 20% max）
  targetMask?: number; // 仅作用于 Tag.flags 含此位的目标（阵营过滤；缺省/0 = 不限）
  requireMask?: number; // 仅作用于 Status.flags 含齐此位的目标（如碎冰要求 frozen）
  setMask?: number; // 命中后给目标 Status 置这些位（如 frozen）
  clearMask?: number; // 命中后清目标 Status 这些位（如碎冰解除 frozen）
  // ── 时间维度（D-003 over-time 集成）：命中时给目标挂 OverTime，把"瞬时命中"延展成"持续效果"。──
  statusDuration?: number; // >0：命中置 setMask 后，过 N tick 自动清这些位（定时冻结/眩晕，免手动清场）。
  dotPerTick?: number; // >0：每 dotPeriod tick 对目标 resource 造成此真伤（中毒/燃烧 DoT，挂 OverTime）。
  dotPeriod?: number; // DoT 结算周期（tick，缺省 1）。
  dotDuration?: number; // DoT 总时长（tick）。
}

// ── TimedEffect ── 一个限时/持续效果（DoT/regen/定时状态）。多个并存在 OverTime.effects 列表里。
// id：同 id 刷新（重置）而非叠加，防持续源无限叠层；不同 id 共存（燃烧 vs 冰冻 vs 毒，R14 真修 B）。
export interface TimedEffect {
  id?: string; // 效果标识（同 id 刷新、不同 id 共存）；缺省=每次都叠加一条
  resource?: string; // 周期改的资源 id（如 'hp'）；缺省 = 不改资源（纯定时状态，如定时冻结）
  amountPerTick?: number; // 每 period 改的量（负=DoT，正=regen）；缺省 0
  period: number; // 每多少 tick 结算一次（>=1）
  duration: number; // 总时长 tick（>0）；<=0 = 永久（靠外部/clearStatusOnEnd 之外的方式清）
  elapsed: number; // 已过 tick（每帧 +1，进 snapshot 可重放）
  clearStatusOnEnd?: number; // 到期时清自身 Status 的这些位（定时冻结到期解冻）
}

// ── OverTime ── 限时/持续效果容器（D-003 + R14 真修 B）：挂在受影响实体自身，持一个 TimedEffect 列表，
// 逐实体、局部寻址。每帧每个效果 elapsed+1；到 period 整数倍 → 对自身 resource 发局部 ResourceModify
// （多个效果的改值经 queueResourceMod 累加）；effect.elapsed≥duration 到期 → 清其 clearStatusOnEnd 位并从列表移除；
// 列表空 → 自销毁组件（不毁实体）。一实体可同时燃烧+冰冻+中毒（各自计时/到期），修掉"一实体一 OverTime"的缺口。
// 确定性：纯整数 tick 计数，按列表序处理（加性累加→序无关）。
export interface OverTime extends Component {
  readonly type: 'OverTime';
  effects: TimedEffect[]; // 并存的限时效果（燃烧/冰冻/毒…各自一条）
}

// ── Prefab ── 数据级预制模板（T4 授权层，反 YAML 编译器）。模板 = 一组实体的组件蓝图（纯数据）。
// AI/数据产出 SpawnRequest{templateId,x,y}（复用 spawn 原子的请求契约）→ prefab 能力查库、确定性展开为
// 实体+组件（唯一 id、Transform 偏移到 x,y、深拷贝隔离）。"AI 写高层数据、引擎确定性展开"，无自由代码。
export interface PrefabTemplate {
  // localId → { 组件类型 → 组件数据（不含 type 字段，与 manifest 约定一致） }
  entities: Record<string, Record<string, Record<string, unknown>>>;
}
export interface PrefabLibrary extends Component {
  readonly type: 'PrefabLibrary';
  templates: Record<string, PrefabTemplate>; // 模板库（数据）
  seq: number; // 实例计数器 → 确定性唯一 id（进 snapshot 可重放）
}

// ── Caster ── 信号→生成桥（D-002）：把"按键/点地/条件成立"的 Signal 变成一条算好坐标的 SpawnRequest，
// 由 prefab 能力展开成技能/陷阱/召唤/掉落。补上 prefab 缺的"运行时释放"入口（REQ-008 显式延后的那块）。
// at 决定生成位置：'self'=施法者自身、'pointer'=光标世界坐标(screenToWorld 逆投影)、'target'=最近的 targetTag 阵营。
// 确定性：只读 Signal/InputQueue/Transform/Tag + 几何比较；按施法者 id 升序结算；坐标取整前为 IEEE 算术（不喂 Condition）。
export interface Caster extends Component {
  readonly type: 'Caster';
  onSignal: string; // 收到此名 Signal 时释放（来自 clickable / event-when / keybind 输入绑定）
  template: string; // PrefabLibrary 里的模板 id
  at: 'self' | 'pointer' | 'target'; // 生成位置来源
  targetTag?: number; // at:'target' 时找最近的 Tag.flags 含此位的实体（缺省找最近任意实体）
  // 锚点实体（缺省=施法者自身）：at:'self' 在它身上生成、at:'target' 以它为索敌原点并复用它的 Relation(target)。
  // 让独立的"技能绑定"实体把锚点/索敌委托给英雄，绕过"一实体一 Caster"对多技能的限制，无需 hierarchy。
  originEntity?: EntityId;
}

// ── Perception ── 数据驱动 AI 的"索敌"原子（D-001，对应周期表 auto-target/range-detect）。逐实体感知
// sightRadius 内最近的 targetTag 阵营 → 写 Relation{kind:'target', targetId}（无则清）。把"看见谁"产物化成
// 通用 Relation(target)，供 steering(朝它移动)/朝向/caster(at:'target' 复用) 等多消费者复用——不再各自重扫。
// 这是库里 ai-chase = state + spatial-query(nearest) + **relation(target)** + transform + velocity 的索敌段。
export interface Perception extends Component {
  readonly type: 'Perception';
  targetTag: number; // 感知的阵营（Tag.flags & targetTag）
  sightRadius: number; // 感知半径（<=0 = 无限视野）
}

// ── Steering ── 数据驱动 AI 的"转向"原子（D-001）。读自身 Relation{kind:'target'} → 朝目标 seek（到 stopRange
// 停=攻击距离）或 flee（远离）→ 写 Velocity（被 motion-apply 积分、受碰撞/摩擦介入）。无目标→停（idle）。
// 模式(seek/flee)与"巡逻↔追击↔逃跑"的转移交给 state+condition 当**数据**（库 ai-chase 的 state 段），不焊进本组件。
// 确定性：方向归一化用 IEEE sqrt/÷（Velocity 不被 Condition 读 → lockstep 安全）。
export interface Steering extends Component {
  readonly type: 'Steering';
  mode: 'seek' | 'flee'; // seek=朝 Relation(target)(到 stopRange 停)；flee=远离
  speed: number; // 移动速度（写入 Velocity 的模长，单位/tick）
  stopRange: number; // seek 到此距离内即停（攻击/保持距离）；flee 忽略
  haltStatusMask?: number; // 自身 Status 含这些位时停止行动（冻结/眩晕/定身 CC → 速度归零）；缺省不受控
}

// ── Mortal ── 逐实体死亡/可破坏（D-001 配套）：自身 resource <= atOrBelow 即发 DestroyRequest 销毁自己。
// 补"涌现逻辑层是全局-id、表达不了 N 怪各自 hp<=0 死亡"的缺口。怪死/可破坏障碍/到期拾取物通用。
export interface Mortal extends Component {
  readonly type: 'Mortal';
  resource: string; // 监视的资源 id（如 'hp'）
  atOrBelow: number; // current <= 此值即销毁自身（通常 0）
  dropTemplate?: string; // 死亡时在原地（自身 Transform）发 SpawnRequest 展开此模板（掉落物/尸体/爆炸）
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

// ── anim-state ── 动作动画状态机的 clip 与状态机（表现层；动画只表现、绝不驱动逻辑）。
// 一个 clip = sprite-sheet 的一段帧区间 [from, from+count) + 节奏(fps=每帧 tick)/是否循环 + 可选 sheet(切贴图)。
export interface AnimClip {
  sheet?: string; // 此 clip 用哪张 sprite-sheet（缺省=保持当前 Sprite.textureKey）
  from: number; // 起始帧索引
  count: number; // 帧数
  fps: number; // 每帧停留 tick 数（越大越慢；<1 视为 1）
  loop: boolean; // 循环 or 播到末帧停
}
export interface AnimState extends Component {
  readonly type: 'AnimState';
  clips: Record<string, AnimClip>; // 状态名 → clip
  fsmId?: string; // 设了就读 State{fsmId}.current 当 clip 名；否则按 Velocity 自动 move/idle
  moveClip: string; // 自动模式：移动时的 clip 名
  idleClip: string; // 自动模式：静止时的 clip 名
  attackClip?: string; // 自动模式：站定且有 Relation(target)（追到目标身边）时的 clip 名；缺省=站立播 idle
  current: string; // 内部：当前 clip 名
  elapsed: number; // 内部：当前帧已播 tick
}

// ── facing ── 朝向翻转（表现层）：按移动方向(velocity)或目标方向(Relation target)把实体水平翻转
// （Transform.scaleX 取正=朝右 / 取负=朝左镜像；碰撞/命中已对 scaleX 取绝对值，翻转安全）。静止时保持上次朝向不抖。
export interface Facing extends Component {
  readonly type: 'Facing';
  mode: 'velocity' | 'target'; // 按移动方向 or 按 Relation(target) 方向定朝向
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
  // 结构化数值载荷（REQ-016/017）：承载列表型输入（如卡牌游戏「出哪几张牌」的牌码 suit*100+rank、菜单多选下标）。
  // 让富输入（不止指针 x/y）也能经确定性命令流注入 → lockstep 安全。
  readonly values?: readonly number[];
}

// ── 输入队列（单例）── 本 tick 的原始输入事件列表。挂在唯一实体上，每 tick 整体覆写（零实体分配），
// 取代"每次点击建/毁 RawInput 实体"的高频 GC 范式。游戏层读 actions 做命中/语义解析。
export interface InputQueue extends Component {
  readonly type: 'InputQueue';
  actions: ReadonlyArray<RawInputData>;
}

// ── keybind ── 具名输入动作 → Signal（D-步骤1）。clickable 的"非空间孪生"：读单例 InputQueue 的动作事件，
// 若某事件 key 命中 KeyBinding.key（且相位匹配）→ 产出 Signal{name:signal}。键位映射=数据（蓝图里填，
// 最弱 LLM 可填、可重绑），下游 caster/craft-recipe/effect 等照常按名消费。确定性：只读 InputQueue + 字符串比较。
export interface KeyBinding extends Component {
  readonly type: 'KeyBinding';
  key: string; // 匹配 InputQueue 事件的 key（物理键如 '1'/'q'，或语义动作名如 'cast_nova'）
  signal: string; // 命中时产出的 Signal.name
  phase?: string; // 仅匹配此相位（如 'down'|'action'）；缺省=任意相位
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

// ── tilemap ── 瓦片地图（地图=数据：二维数组 + tileset assetKey；引擎=瓦片碰撞 + 渲染两台通用解释器）。
// 瓦片不是实体、不进 tick；只在碰撞时被查询、被渲染器画。一个 collides 层里**非零**瓦片=实心(mass0 静态体)，
// 0=空/可通行。多层分工：floor(不挡)/walls(挡)/decoration(不挡)。瓦片在世界里的位置：左上角 (originX,originY)，
// 瓦片 (c,r) 覆盖世界 [originX+c*tileSize, +tileSize) × [originY+r*tileSize, +tileSize)。
// 这是 Hades 式拼接的"房间"积木：一份 Tilemap = 一个房间；dungeon 能力(后)按种子拼多份。
export interface TileLayer {
  name: string; // 'floor' | 'walls' | 'decoration' | …
  data: number[]; // 长 cols*rows，row-major，0=空，>0=tileId（tileset 里第几格，1-based）
  collides: boolean; // 该层非零瓦片是否实心（参与瓦片碰撞）
  tileset: string; // 图块集 assetKey（R9；渲染器据 tileId 算源矩形）
}
export interface Tilemap extends Component {
  readonly type: 'Tilemap';
  cols: number; // 横向格数
  rows: number; // 纵向格数
  tileSize: number; // 每格像素
  originX: number; // 瓦片 (0,0) 左上角的世界 x（房间可放任意位置 → Hades 拼接）
  originY: number;
  layers: TileLayer[];
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
  // resource 叶子：与静态 value 比；或（REQ-017）与另一资源 vsResource.current 比（动态阈值，如 round_score≥blind）。
  // vsResource 在场时优先（value 退化为缺资源时的回退）。是 REQ-013 valueFrom 在"条件读侧"的对称扩展。
  | { readonly kind: 'resource'; readonly id: string; readonly cmp: CmpOp; readonly value: number; readonly vsResource?: string }
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
  // modify-resource 的运算（REQ-012，让「×倍率」成为数据）：'add'=current+value / 'mul'=current*value / 'set'=value。
  // 缺省 'add'（老数据零改动）；结算后照常钳进 [min,max]。Balatro 小丑的 ×mult、伤害倍率、属性乘区皆用此。
  op?: 'add' | 'mul' | 'set';
  // 结算顺序（REQ-012）：同信号命中的多个 Effect 按 order **升序**依次结算（乘法引入顺序依赖，顺序须是显式数据）。
  // 缺省 0；并列再按 Effect 所在实体 id 升序 tie-break → 确定、可审计、录放安全。
  order?: number;
  // 值取自资源（REQ-013，量纲动态值 / 两资源相乘）：有则 modify-resource 的 v =
  //   resource[resourceId].current × (timesResourceId ? resource[timesResourceId].current : coeff ?? 1)，
  // 否则用静态 value。缺省=用 value（老数据零改动）。解 Balatro 最终计分 score += chips×mult（timesResourceId）、
  // Bull「每 $1 +2 筹码」chips += coeff×money（coeff）、星球牌升级 chips += level×每级增量。确定性同 op:mul（IEEE 乘，正确舍入）。
  valueFrom?: { resourceId: string; coeff?: number; timesResourceId?: string };
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

// ── poker-hand 牌（REQ-011）── 一张牌 = {花色, 点数}，纯整数枚举（确定性：相等/大小比较，不碰浮点）。
// suit：0..3（♠♥♦♣，仅用于"是否同花"的相等比较，无大小语义）。
// rank：2..14（J=11,Q=12,K=13,A=14；A 在顺子里也可当 1 凑 A-2-3-4-5 的"轮子"低顺）。
// 牌不是组件，是被 PlayedHand.cards 持有的纯数据（如 StatModifier 之于 Stats）。
export interface Card {
  suit: number;
  rank: number;
}

// ── poker-hand 出牌（REQ-011）── 本次"出"的一手牌（有序，供逐张迭代 / 按花色·点数计数）。
// 由选牌交互（clickable→signal→effect 装配）填充——**不在 poker-hand 能力里做选牌 UI / 洗牌发牌**
// （那些用现有 clickable/random/effect-apply 重组）。cards 为空=本帧不评估（基础分由装配层在新回合清零）。
export interface PlayedHand extends Component {
  readonly type: 'PlayedHand';
  cards: Card[];
  // 可选归属玩家 id（多人/coop）：card-play 按它把某玩家的「出牌」输入路由到对应牌桌的 PlayedHand。
  // 单人留空（装配层直接填 cards）。
  owner?: string;
}

// ── poker-hand 评估器配置（REQ-011；Tier3「算法/解释器型机制」大类，与 match3-board/tilemap 同构）──
// Condition→Event→Effect 表达不了"5 张是不是同花顺"这种带计数/排序的算法；本配置 + poker-eval 系统补这格缺口。
// rankingTable = 牌型名→{baseChips, baseMult} 的纯数据表（最弱 LLM 能产；设计可调，不写死在代码）。
// 系统读同实体上的 PlayedHand → 确定性判定最高牌型 → 把基础 chips/mult **set** 进两个 Resource（基础值），
// 再由小丑（effect-apply 的 op:'mul'/order，REQ-012）在其上做修正 → score=chips×mult 与盲注线（condition）比。
// 只算分、不碰渲染、不驱动逻辑外状态。确定性：纯整数/枚举比较与计数，牌型判定是纯函数（有序卡集→稳定输出）。
// 派生事实输出（REQ-011 完善）：poker-eval 把求值器已算出的「包含谓词原语 + 出牌张数」写成 condition 可读的
// Resource/Flag/StringVar，全部**可选、按需配**（配了且目标存在才写）。有了这组原语，"含对子/含三条/含两对/含顺/含同花/
// 含葫芦"等**包含**判定就是 condition 的组合表达（如 rankMaxCount≥2=含对子、and(rankMaxCount≥3,pairCount≥2)=含葫芦），
// 不必为每种牌型写专门 flag。修正「含对子≠最高牌型是对子」（葫芦也含对子）这一真 bug——只看 handTypeVar 会漏触发。
export interface PokerHand extends Component {
  readonly type: 'PokerHand';
  rankingTable: Record<string, { chips: number; mult: number }>; // 牌型名 → 基础分（纯数据表）
  chipsResource: string; // 写基础 chips 的 Resource id（按 id 全局定位）
  multResource: string; // 写基础 mult 的 Resource id
  handTypeVar?: string; // 可选：写**最高**牌型名的 StringVar id（"打出同花顺→某小丑"这类"恰是某型"判定）
  rankMaxCountResource?: string; // 可选：最大同点张数（2=含对子,3=含三条,4=含四条,5=含五条）写入此 Resource
  pairCountResource?: string; // 可选：点数计数≥2 的种数（2=含两对）写入此 Resource
  isStraightFlag?: string; // 可选：是否含顺子写入此 Flag.id
  isFlushFlag?: string; // 可选：是否含同花写入此 Flag.id
  handSizeResource?: string; // 可选：本次出牌张数写入此 Resource（Half Joker「出牌≤3张」等）
}

// ── card-scoring 逐张谓词（REQ-014）── 对"当前计分牌"求值的小词汇表（纯数据，最弱 LLM 可产）。
// 刻意只含卡面属性（花色/点数集合/序号）+ 布尔组合；**不烘焙任何 Balatro 常量**：
//   人头 = rankIn[11,12,13]；偶(Even Steven)=rankIn[2,4,6,8,10]；奇(Odd Todd)=rankIn[3,5,7,9,14]——全由数据表达。
// 与通用 Condition 不同：Condition 读世界 Flag/Resource/State，这里读的是迭代中瞬态的"当前牌"，故是卡域专用谓词。
export type PerCardWhen =
  | { kind: 'always' }
  | { kind: 'suit'; suit: number } // 该牌花色 == suit（0..3）
  | { kind: 'rankIn'; ranks: number[] } // 该牌点数 ∈ ranks（人头/偶/奇/具体点数都用它）
  | { kind: 'index'; eq: number } // 该牌在出牌序列中的序号 == eq（首张=0，供 retrigger/首张型小丑）
  | { kind: 'and'; of: PerCardWhen[] }
  | { kind: 'or'; of: PerCardWhen[] }
  | { kind: 'not'; of: PerCardWhen };

// ── card-scoring 配置（REQ-014；Tier3「算法/解释器型机制」，poker-hand 的逐张伴生件）──
// 挂"牌桌"单例（与 PlayedHand 同实体）：逐张 pass 按序遍历 PlayedHand.cards，对每张（含 retrigger 重复）
// 把该牌 baseChips 累加进 chipsResource。Condition→Event→Effect 是反应式布尔、表达不了"有序迭代 + 逐元素上下文 +
// retrigger 乘性耦合"——正是本能力补的缺口（与 match3-board/poker-hand 同构）。baseChipsByRank 纯数据，引擎不写死。
export interface PerCardScore extends Component {
  readonly type: 'PerCardScore';
  chipsResource: string; // 逐张 baseChips 累加进此 Resource（在 poker-eval set 的牌型基础分之上 add）
  baseChipsByRank: Record<string, number>; // 点数(字符串键)→该牌基础筹码，如 {"10":10,"11":10,"14":11}；缺键=0
}

// ── card-scoring 逐张规则（REQ-014）── 一条逐张小丑 = 一个 PerCardRule 组件（与 effect-apply 的 Effect 同构，
// 每张小丑一个实体）。逐张 pass 遍历每张计分牌，对每条 when 命中当前牌的规则，按 op 改 targetResource（钳上下限）。
// 例：Greedy{when:{kind:'suit',suit:2},op:'add',targetResource:'mult',value:3}（每张♦+3 倍率）。
export interface PerCardRule extends Component {
  readonly type: 'PerCardRule';
  when: PerCardWhen;
  op: 'add' | 'mul';
  targetResource: string;
  value: number;
}

// ── card-scoring retrigger（REQ-014）── 重触发规则（Hanging Chad/Red Seal/Mime 折叠于此）。
// when 命中的牌，在逐张 pass 里被额外计分 extra 次（共 1+extra 次）：该牌的 baseChips 与所有命中它的 PerCardRule
// 都随之重复结算——这正是聚合计数表达不了、必须逐张迭代的乘性耦合。例：Hanging Chad{when:{kind:'index',eq:0},extra:2}。
export interface PerCardRetrigger extends Component {
  readonly type: 'PerCardRetrigger';
  when: PerCardWhen; // 哪些牌重触发（如 index==0 = 首张）
  extra: number; // 额外重复次数（Hanging Chad = 2）
}

// ── score-trace（REQ-019）── 逐步计分 trace：计分链各系统按真实执行序 append 每一步，UI 只回放、不重算。
// 通用「分步结算演出」输出（卡牌计分 / 遗物结算 / 伤害分解皆可复用）。**排除出 hashSnapshot**（纯表现输出，同 Camera）。
// opt-in：只有世界存在 ScoreTrace 单例时计分链才记录；非此类玩法零开销。每次计分由首系统(poker-eval)清空重建。
export interface ScoreEvent {
  seq: number; // 步序（= append 时 events 长度，0,1,2…）
  phase: string; // 阶段语义（自由 string：'base'|'percard'|'percard-rule'|'effect'…，保通用复用面）
  target: string; // 本步改的 Resource id（如 'chips'/'mult'/'score'）
  op: 'set' | 'add' | 'mul'; // 本步运算
  value: number; // 本步的量（add 加量 / mul 倍率 / set 值）
  after: number; // 本步后 target 的当前值（供 UI 计数器跳动）
  source?: string; // 语义来源（牌型名 / 'card:<i>' / Effect 实体 id），UI 据它高亮/抖动
}
export interface ScoreTrace extends Component {
  readonly type: 'ScoreTrace';
  events: ScoreEvent[];
}

// ── card-pile（REQ-017）── 牌库/手牌的 sim 内确定性管理（卡牌品类 staple）。
// deck=抽牌堆（预洗好的牌码数组，front=下一张，纯数据→确定性，lockstep 双端同序）；hand=当前手牌；
// handSize=目标手牌数。card-pile 系统：处理 play/discard 输入（按手牌**下标**选牌）+ 抽牌补到 handSize。
// 让"发牌→选→出/弃→补牌"全进 sim（非 React），是回合流程数据状态机化 + lockstep 联机的共同前置。
// 与 card-play(直接喂牌码、无牌库) 的区别：card-pile 是**带牌库的完整出牌管理**（下标选牌 + 自动补牌）。
export interface CardPile extends Component {
  readonly type: 'CardPile';
  owner?: string; // 输入路由 + scoring Flag id（多人各一份 CardPile）
  deck: number[]; // 抽牌堆（牌码 suit*100+rank，预洗好；front=下一张）
  hand: number[]; // 当前手牌（牌码）
  handSize: number; // 目标手牌数（抽牌补到这个数）
}

// ── StatModifier ── 属性修正（①，ARPG）：来自具名 source（装备/buff/光环/天赋/boon）的一条加/乘修正。
// 装备→push 一条（source=装备 id），卸下→按 source 滤除。同一 source 可有多条（改多 stat）。
export interface StatModifier {
  stat: string; // 目标 stat 名（如 'attack'、'maxHp'、'moveSpeed'）
  add?: number; // 加值（缺省 0）
  mul?: number; // 乘值（缺省 1）
  source: string; // 来源 id（按它增删，如 'ring_of_power'、'buff_haste'）
}

// ── Stats ── 属性修正系统（①）：一个组件装多 stat 的「基础值 + 修正列表 → 有效值」分层。
// 有效值 effective[s] = (base[s] + Σ mods.add) × Π mods.mul。系统 stat-apply 每帧重算 effective。
// 一组件多 stat → 绕开「一实体一组件」；下游（hitbox 伤害读 attack、steering 读 moveSpeed、maxHp→Resource.max）
// 读 effective。装备/buff/光环/天赋/Hades-boon 全是"往 mods 里增删条目"=纯数据组合，不写游戏代码。
// 确定性：纯整数/IEEE 算术，遍历按 stat 名 + 列表序（加性/乘性，序内累加）→ 录放一致。
export interface Stats extends Component {
  readonly type: 'Stats';
  base: Record<string, number>; // 基础值（裸属性）
  mods: StatModifier[]; // 当前生效的修正（来源增删）
  effective: Record<string, number>; // 折算结果（stat-apply 每帧重算；下游读这个）
}

// ── Launch ── 直线弹/抛射（②，ARPG）：发射瞬间定一次方向 → 写一次 Velocity → 自删 Launch，之后由
// motion-apply 直飞（fire-and-forget）。区别于 steering 的**持续**重定向（那是追踪弹/homing，已被 steering 覆盖）。
// toward:'target' 朝最近 targetMask 阵营（复用 spatial-query.nearestByTag）；'dir' 朝固定 (dirX,dirY)（归一化）。
// 飞弹 = prefab 模板{Transform,Shape,Sensor,Tag(ZONE),Hitbox,Velocity,Launch,Timer(life)}，caster 生成即自发射。
// 确定性：方向归一化用 IEEE sqrt/÷（与 steering 同类，安全）；nearestByTag 按 id tie-break。
export interface Launch extends Component {
  readonly type: 'Launch';
  speed: number; // 初速模长（单位/tick）
  toward: 'target' | 'dir'; // target=朝最近 targetMask 实体；dir=固定方向
  targetMask?: number; // toward:'target' 时索敌阵营（Tag.flags & targetMask）
  dirX?: number; // toward:'dir' 时方向（会归一化；缺省 0）
  dirY?: number;
}
