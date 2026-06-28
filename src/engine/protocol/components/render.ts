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
  side?: string; // 'a'|'b'：对阵一方（render-only，供 3D 抛飞相撞编排配对）
  pairKey?: number; // 配对键：同 pairKey 的 a/b 互为对手，跃向同一相撞点（render-only）
  rank?: string; // 牌面点数 A/2..10/J/Q/K（render-only，渲染器画牌面用；缺省纯色）
  suit?: string; // 花色 S/H/D/C（♠♥♦♣）（render-only）
}

// ── Mesh3D（render-only，通用「3D 物件即数据」原语）── 一个有体积/双面、可翻面的 3D 物体（牌/骰/棋子）。
// 区别于 game-g 专属 Card3D（扑克牌面纹理 + 抛飞相撞编排是它的私货）：本件是**引擎通用原语**——任意实体挂上
// 即被 3D 后端渲成一个 box/plane，与 2D Renderable **同场混排**（per-object opt-in 3D，不是整场景 3D）。
// 「3D JSON」= 这些 Mesh3D 的数据描述（类比 UILayout 之于 2D UI），游戏只**描述**、引擎**解释**渲染，
// 不再每游戏手写 Three.js。3D 位姿取同实体 Transform：x,y→位置；rotation→绕 flipAxis 的**翻面角**
// （0=正面朝镜头、π=反面）。红线：表现层组件，**绝不被 Condition 读、绝不进 sim 逻辑/hash**。
// 纹理/导入/骨骼/动画不在此（那是各游戏私货 or action 方向，触发方向漂移预警）。
export interface Mesh3D extends Component {
  readonly type: 'Mesh3D';
  shape: 'box' | 'plane'; // box=有厚度、正反两面可分色；plane=双面薄片（单色）
  width: number; // 物体宽（世界单位，与 Transform.x/y 同尺；相机自适配取景）
  height: number; // 物体高
  depth?: number; // box 厚度；缺省=短边*薄板比（下限 1）。plane 忽略
  frontTint: number; // 正面(+z)色 0xRRGGBB
  backTint?: number; // 反面(-z)色；缺省=frontTint
  edgeTint?: number; // box 四边色；缺省深灰
  flipAxis?: 'x' | 'y'; // Transform.rotation 作为绕此轴的翻面角；缺省 'x'（前后翻）
}

// ── Model3D（render-only，导入式 3D 模型 · glTF）──────────────────────────────────────────────
// Mesh3D 的 box/plane 原语表达不了圆润模型（蘑菇人、道具、生物…）→ 用真模型：渲染器据 modelKey 从
// AssetManager 取 glTF 字节、解析成 three 场景显示。位姿走同实体 Transform3D（盒庭真三维）或 2D Transform
// （盒庭模式落地面），与 Mesh3D 同套位姿路径（per-object opt-in 3D，不是整场景 3D）。资产走 key
// （sim 持 key 保纯·同 sprite 先例），蓝图**绝不塞 URL/二进制**（导入铁律）。
// 红线：纯表现，**绝不被 Condition 读、绝不进 sim 逻辑/hash**（已入 determinism NON_DETERMINISTIC）。
export interface Model3D extends Component {
  readonly type: 'Model3D';
  modelKey: string; // 资产 key → glTF 模型（AssetManager 解析；蓝图只持 key·不塞 URL/二进制）
  scale?: number; // 等比缩放覆盖（缺省 1；与 Transform3D.scale 叠乘）
  tint?: number; // 可选整体染色 0xRRGGBB（缺省用模型自带材质）
}

// ── Transform3D（render-only，真三维位姿 · 3D 后端专用）─────────────────────────────────────
// 给实体一份**完整三维位姿**（x 右 / y 上=高度 / z 朝镜头 · 世界单位），让盒庭/积木场景真正立体堆叠。
// 区别于 2D Transform（x,y 在屏幕平面 + zOrder 微分层 = 2.5D billboard）：挂了本件的实体，3D 后端用它定位姿
// （地面=XZ 平面、Y=高度），不再走 2D 投影；2D 后端退化画其 (x,y) 正面（per-object opt-in，同 Mesh3D）。
// 「3D 盒庭 = Transform3D + Mesh3D 的纯数据」——游戏只描述，引擎解释渲染，不每游戏手写 Three.js。
// 红线：纯表现，**绝不被 Condition 读、绝不进 sim 逻辑/hash**（已入 determinism NON_DETERMINISTIC）。
export interface Transform3D extends Component {
  readonly type: 'Transform3D';
  x: number; // 右(+)
  y: number; // 上(+)=高度（地面 y=0，物体下沿坐地）
  z: number; // 朝镜头(+)=景深近
  rotX?: number; // 欧拉角(弧度)·缺省 0
  rotY?: number;
  rotZ?: number;
  scale?: number; // 等比缩放·缺省 1
}

// ── Camera3D（render-only，3D 盒庭轨道相机 · 单例）─────────────────────────────────────────
// 3D 后端的取景：绕场景中心(或 pivot)的轨道相机。yaw/pitch 定观察角(弧度)，distance 定远近(缺省=自适配包围盒)。
// 挂一个带 Camera3D 的实体即进「盒庭模式」：相机不再强制俯视，而是按角度环绕、开柔和阴影（Captain Toad 风）。
// 无 Camera3D → 退回原俯视自适配（向后兼容 · three-lab 不受影响）。pitch 正=俯视，等距盒庭约 0.6。
// 红线：纯表现，绝不进 hash（同 2D Camera · 已入 NON_DETERMINISTIC）。
// REQ-3D-Camera（owner 2026-06-28）：相机 = **数据(语义参数) + 固定解释器(渲染器算矩阵)**——游戏永不调相机方法、
// 永不持矩阵，只填这些语义参数；渲染器据此 lookAt / 算正交·透视 / 跟随。多模式用 `mode` 枚举，绝不放 4×4 矩阵。
export interface Camera3D extends Component {
  readonly type: 'Camera3D';
  yaw: number; // 绕 Y 轴方位角(弧度)·0=正前、正=向右环绕
  pitch: number; // 俯仰角(弧度)·正=俯视，等距约 0.6
  distance?: number; // 相机到 pivot 距离(世界单位)·缺省=自适配框住包围盒
  pivotX?: number; // 注视点·缺省=场景包围盒中心（mode:'follow' 时由 target 实体位覆盖）
  pivotY?: number;
  pivotZ?: number;
  projection?: 'perspective' | 'ortho'; // 投影·缺省 perspective；ortho=等距微缩盒庭
  fov?: number; // 透视视场角(度)·缺省=渲染器构造默认（per-scene 数据，不再写死在 option）
  orthoSize?: number; // 正交半高(世界单位)·缺省=场景包围盒半径
  near?: number; // 近裁面·缺省 1（配 W1-C 深度收紧）
  far?: number; // 远裁面·缺省=distance+天空盒半径余量
  mode?: 'orbit' | 'follow'; // orbit=绕 pivot 环绕(缺省)；follow=注视/环绕 target 实体（随它走）
  target?: string; // follow 模式注视/环绕的实体 id
  pitchMin?: number; // 俯仰夹角下/上限(弧度)·缺省不夹（行为层运镜 + 解释器都按此夹）
  pitchMax?: number;
}

// ── Sky3D（render-only，天空盒 · 单例）──────────────────────────────────────────────────────
// 最简天空盒：内面朝里的大球，画一张「天顶→地平线渐变 + 程序化云朵」的画布纹理裹住盒庭。
// clouds=叠程序化云团（云色 cloudTint）；scroll=云缓慢飘动（render-only·绕 Y 微转）。无图片资产、纯程序化。
// 红线：纯表现，绝不进 hash（已入 NON_DETERMINISTIC）。
export interface Sky3D extends Component {
  readonly type: 'Sky3D';
  top: number; // 天顶色 0xRRGGBB
  bottom: number; // 地平线色 0xRRGGBB
  clouds?: boolean; // 叠程序化云团
  cloudTint?: number; // 云色·缺省白
  scroll?: number; // 云飘速度（0=不动·render-only）
}

// ── L2 color ── 实体当前的颜色/透明度
// ── Light3D（render-only，数据化光照 · 3D 盒庭）──────────────────────────────────────────────
// 把写死在渲染器 init 里的灯搬进数据：游戏蓝图声明灯，引擎解释。可挂多盏（sun + ambient + 补光）。
// kind:'directional' = 平行光（太阳·dir 为光的去向）；'ambient' = 环境光（无方向·整体补亮）。
// 第一盏带 castShadow 的平行光当主阴影灯（盒庭模式自动框场景投软影）。无任何 Light3D → 退回引擎默认
// 暖主光 + 冷补光（向后兼容·three-lab/现有游戏不受影响）。红线：纯表现，绝不进 sim/hash（NON_DETERMINISTIC）。
export interface Light3D extends Component {
  readonly type: 'Light3D';
  kind: 'directional' | 'ambient';
  color: number; // 0xRRGGBB
  intensity: number;
  dirX?: number; // 平行光「去向」（渲染器归一化·缺省盒庭暖侧光向）。ambient 忽略。
  dirY?: number;
  dirZ?: number;
  castShadow?: boolean; // 平行光·是否当主阴影灯（盒庭通常一盏投影·缺省取首盏平行光）
}

// ── Post3D（render-only，后处理管线 · 3D 盒庭微缩感）─────────────────────────────────────────
// 数据化后处理：移轴景深（tilt-shift·Captain Toad 招牌「微缩模型」感·清晰带外上下渐糊）+ 泛光（bloom）。
// 挂一个 Post3D 单例即开 EffectComposer 管线渲染；无则直接渲染（向后兼容）。纯表现·不进 hash。
export interface Post3D extends Component {
  readonly type: 'Post3D';
  // 移轴景深：focus=清晰带的屏幕纵向位置(0 底~1 顶·缺省 0.5)；intensity=模糊强度(缺省 ~3)。
  tiltShift?: { focus?: number; intensity?: number };
  // 泛光：strength=强度·radius=扩散·threshold=亮度阈值。
  bloom?: { strength?: number; radius?: number; threshold?: number };
}

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

// ── Coachmark（REQ-ARCH-COACH · render-only 新手引导高亮）── 一步引导的表现数据：把某个 UI 元素（data-anchor 键）
// 高亮出来——全屏半透明遮罩 + 锚点处镂空 + 一句话气泡。OnboardingOverlay 解释器读它渲染。红线：**纯表现**——
// 绝不进 hash/sim、不被 Condition 读、不回灌 gameplay（高亮各端可不同，同 outcome-first）。可见性由 visibleWhen
// 绑的 Flag（如当前 step 的 coach_active）驱动——流程/「看过不再弹」用现有 flow+flag+save 重组，本组件只管「画高亮」。
export interface Coachmark extends Component {
  readonly type: 'Coachmark';
  anchor: string; // 目标 UI 元素的 data-anchor 键（GameShell UINode.anchor 或手写 DOM 的 data-anchor 属性）
  text: string; // 气泡文案（一句话）
  shape?: 'rect' | 'circle'; // 镂空形（缺省 rect）
  pad?: number; // 镂空外扩像素（缺省 8）
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'; // 气泡相对锚点位置（缺省 auto：择空间大的一侧）
  arrow?: boolean; // 气泡指向箭头（缺省 true）
  dimColor?: number; // 遮罩色 0xRRGGBB（缺省 0x000000）
  dimAlpha?: number; // 遮罩透明度 [0,1]（缺省 0.6）
  visibleWhen?: string; // 绑定 Flag id：该 Flag active 才显示（缺省=总显示）。流程把当前 step 的 flag 置真即亮对应 mark
}
