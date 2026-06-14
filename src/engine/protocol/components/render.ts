// Protocol · 表现层（渲染 / 动画 / 音 / 相机 / 文字 / 缓动）─────────────────────────────
// 每帧驱动 UI/渲染的"软逻辑"组件：可见性、精灵图层、颜色、帧、血条、动画状态机、朝向、声音、相机、文字、Tween。
// 红线：表现层只表现，**绝不驱动逻辑、绝不被 Condition 读**（Tween 浮点插值不喂逻辑数值，防跨端 1-ULP 漂移）。
import type { Component } from '../../core/types.js';

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

// ── 3D 卡牌（render-only，Three.js 后端解释）── 一张正反两面的薄牌；3D 位姿取自同实体 Transform：
// x,y → 3D 位置，rotation → 绕 X 轴翻面角（0=正面朝镜头、π=反面）。胜负已定 → tween Transform.rotation
// 到目标面，渲染器只把它画成 3D 翻转。红线：表现层组件，绝不被 Condition 读、绝不进 sim 逻辑/hash。
export interface Card3D extends Component {
  readonly type: 'Card3D';
  frontTint: number; // 正面色 0xRRGGBB
  backTint: number; // 反面色 0xRRGGBB
  width: number; // 牌宽（像素，渲染器按比例缩到 3D 单位）
  height: number; // 牌高
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

// ── gauge（REQ-F-029）── Resource 比例 → 条形 Shape 投影（血条/蓝条/读条/护盾；gauge 系统每 tick 写）。
// 条实体 = 宿主的 Hierarchy 子体：gauge 写自身 Shape.width = 比例*width、Hierarchy.localX = leftX + 现宽/2
// （左锚：左端钉死在 leftX，从右端缩——血条惯例）。跟随靠 hierarchy-resolve、随宿主销毁靠 hierarchy-cascade。
// 载体特意不用 Transform.scaleX：hierarchy-resolve(PostResolve) 每帧重写子 Transform（双 writer 打架），
// 且渲染 box 以中心为 pivot、缩放只能对称收缩，锚不了左。
export interface Gauge extends Component {
  readonly type: 'Gauge';
  resourceId: string; // 跟踪的 Resource.id
  fromParent?: boolean; // true=读 Hierarchy.parentId 宿主实体上的 Resource（共享 id 'hp' 场景，全局取会取错单位）；缺省=先自身后全局首个同 id（R11 auto 同款）
  width: number; // 满值时条宽(px)
  leftX?: number; // 条左端相对宿主的固定 x 偏移（左锚）。缺省 -width/2（满条时居中于宿主）
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
  // 重放保留（REQ-F-057 落子 juice）：true=到点后**不移除组件**、停在终值置 done（done 实体每帧零开销跳过），
  // 供运行时倒带重放（drag-place 落子把 elapsed=0/done=false → 压扁回弹再播一次）。缺省=到点移除（原语义）。
  keep?: boolean;
}

// ── text-binding（REQ-F-043）── Resource 数字 → Text 投影（gauge 的姊妹件；HUD 金币/回合/等级/楼层）。
// text-binding 系统(PostResolve)每拍把目标 Resource.current 写成自身 Text.content = prefix+值+suffix。
// 寻址同 gauge：fromParent=读 Hierarchy.parentId 宿主；缺省先自身后全局首个同 id（R11 auto）。
export interface TextBinding extends Component {
  readonly type: 'TextBinding';
  resourceId: string; // 跟踪的 Resource.id
  fromParent?: boolean; // true=读宿主实体 Resource（共享 id 场景）；缺省=先自身后全局
  prefix?: string; // 文案前缀（如「金币 」）
  suffix?: string; // 文案后缀（如「 金」）
}
