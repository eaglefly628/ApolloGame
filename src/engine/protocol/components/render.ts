// Protocol · 表现层（渲染 / 动画 / 音 / 相机 / 文字 / 缓动）─────────────────────────────
// 每帧驱动 UI/渲染的"软逻辑"组件：可见性、精灵图层、颜色、帧、血条、动画状态机、朝向、声音、相机、文字、Tween。
// 红线：表现层只表现，**绝不驱动逻辑、绝不被 Condition 读**（Tween 浮点插值不喂逻辑数值，防跨端 1-ULP 漂移）。
import type { Component } from '../../core/types.js';
import type { LayoutNode } from '@ui/components/index.js'; // 仅类型（erased·无运行时环）：WorldUI3D 富内容 = LayoutNode（UI 铁律）

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

// ── Mesh3D（render-only，通用「3D 物件即数据」原语）── 一个有体积/双面、可翻面的 3D 物体（牌/骰/棋子）。
// 本件是**引擎通用「3D 物件」原语**（非某游戏私货的手写 Three.js）——任意实体挂上
// 即被 3D 后端渲成一个 box/plane，与 2D Renderable **同场混排**（per-object opt-in 3D，不是整场景 3D）。
// 「3D JSON」= 这些 Mesh3D 的数据描述（类比 UILayout 之于 2D UI），游戏只**描述**、引擎**解释**渲染，
// 不再每游戏手写 Three.js。3D 位姿取同实体 Transform：x,y→位置；rotation→绕 flipAxis 的**翻面角**
// （0=正面朝镜头、π=反面）。红线：表现层组件，**绝不被 Condition 读、绝不进 sim 逻辑/hash**。
// 纹理/导入/骨骼/动画不在此（那是各游戏私货 or action 方向，触发方向漂移预警）。
// 骰面（render-only·程序化 pip 贴图）：一面的元素色底 + 点数。复刻美术设计案 3D 命运骰（原型 dieFaceTex）。
export interface DieFace { color: number; pip: number; emissive?: number; src?: string } // color/emissive=0xRRGGBB；pip=1..6；src=手绘面贴图 URL(在场则替代程序化 pip 贴图)

// 体素表面程序化贴图（render-only·复刻美术设计案「带精美贴图的体素」·原型 topTex/sideTex/wallTex）。
// 在场 → 渲染器给 box 的顶面刷 topTex（格纹 + 颗粒 + 勾缝）、四周刷 sideTex；wall:true → 全面用侧墙纹。
// 纯色 tint 表达不了这层网格质感 → 这是体素世界的通用美术能力（下沉到 3D 基座·全体素物件共用）。
export interface VoxelTex {
  top: number;              // 顶面主色 0xRRGGBB
  side: number;             // 侧面主色 0xRRGGBB
  top2?: number;            // 顶面点缀色（缺省=top 微调）
  side2?: number;           // 侧面点缀色（缺省=side 微调）
  trim?: number;            // 墙顶饰条色（wall 用）
  pattern?: 'grass' | 'stone' | 'crystal' | 'plain'; // 顶面纹样母题（草叶/石纹/晶裂/纯颗粒）
  wall?: boolean;           // true=墙体（六面同侧墙纹 + 顶饰条），false=地台（顶面网格 + 侧面）
  tile?: number;            // 一格世界尺寸（缺省 2·据物体尺寸算重复次数出网格）
  topSrc?: string;          // 顶面**手绘贴图 URL**（在场则替代程序化 topTex·Cloud Design 素材）
  sideSrc?: string;         // 侧面/墙体手绘贴图 URL（在场则替代程序化 sideTex）
}

export interface Mesh3D extends Component {
  readonly type: 'Mesh3D';
  // box=有厚度·正反两面可分色；plane=双面薄片（单色）；sphere/cylinder/cone/capsule/torus=圆润单材质图元（three 内建·单色）。
  shape: 'box' | 'plane' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'torus';
  width: number; // 物体宽（世界单位，与 Transform.x/y 同尺；相机自适配取景）。sphere/cylinder/cone/capsule/torus：直径
  height: number; // 物体高。sphere：忽略（取 width 作直径·正球）；cylinder/cone/capsule：柱/锥高；torus：忽略
  depth?: number; // box 厚度；缺省=短边*薄板比（下限 1）。plane/圆润图元忽略
  tube?: number; // torus 专用·管半径占主半径的比例（缺省 0.35）；其它图元忽略
  frontTint: number; // 正面(+z)色 0xRRGGBB
  backTint?: number; // 反面(-z)色；缺省=frontTint
  edgeTint?: number; // box 四边色；缺省深灰
  flipAxis?: 'x' | 'y'; // Transform.rotation 作为绕此轴的翻面角；缺省 'x'（前后翻）
  /** 六面 pip 骰子（render-only·程序化贴图·复刻美术设计案 3D 命运骰）。在场 → box 建成 6 面元素色 + 白点材质，
   *  替代 frontTint/backTint 纯色（size 取 width）。面序 = BoxGeometry [右,左,顶,底,前,后]。骰盅/掷骰/战利品/Title 共用。 */
  dieFaces?: DieFace[];
  /** 玻璃骰（render-only·配合 dieFaces·owner 2026-07-01 近观概念定）：六面改用**透明玻璃材质**（MeshPhysical·transmission），
   *  骰面圆角 pip 贴图作**贴花**浮于其上——贴花外的四角 + 立方体棱(楞)是**通透玻璃**（可透见背景/背面），呈高级透玻璃感。 */
  dieGlass?: boolean;
  /** 体素表面程序化贴图（render-only·复刻「带精美贴图的体素」）。在场 → 顶面网格纹 + 侧面纹，替代纯色 tint。地台/墙/基座共用。 */
  voxelTex?: VoxelTex;
}

// ── Glow3D（render-only·加性辉光精灵·复刻美术设计案原型 glowSprite）──────────────────────────────
// 一个始终朝镜头的**径向渐变加性光晕**，挂在实体的 Transform3D 位置上（火盆/灯笼/门/宝石/元素物的暖光）。
// 纯表现（NON_DETERMINISTIC）：颜色 + 尺寸 + 透明度。渲染器建 THREE.Sprite（AdditiveBlending·depthWrite:false）。
// 体素世界靠它出「自发光暖光晕」——纯色 emissive + bloom 表达不了这种柔光扩散，是通用氛围能力（全 3D 场景共用）。
export interface Glow3D extends Component {
  readonly type: 'Glow3D';
  color: number;    // 光晕色 0xRRGGBB
  scale: number;    // 直径（世界单位）
  opacity?: number; // 基础不透明度（缺省 0.6·可被脉动改·此处静态基值）
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

// ── AnimState3D（render-only，骨骼动画播放 · 3D 后端）──────────────────────────────────────
// 让导入式 glTF 模型播它自带的动画 clip（骨骼/蒙皮）。挂在带 Model3D 的实体上：渲染器据此建 three AnimationMixer
// 播指定 clip（按名）。换 clip 名 = 切动作（idle↔run·渲染器淡入过渡）。speed=播放倍速·loop=循环。
// 红线：纯表现，绝不进 sim/hash（render-only·入 NON_DETERMINISTIC）。弱 LLM 只填 clip 名 + 倍速·填不了骨骼矩阵。
export interface AnimState3D extends Component {
  readonly type: 'AnimState3D';
  clip: string; // 动画名（glTF clip·如 'Run'/'Walk'）
  speed?: number; // 播放倍速·缺省 1
  loop?: boolean; // 循环·缺省 true（false=播一遍停在末帧）
}

// ── Anim3D（render-only，程序化位姿动画驱动 · 3D 后端）────────────────────────────────────────
// **底层程序化动画方法集**（owner 2026-07-06）：让实体的 Transform3D 分量按**数据描述的运动通道**随壁钟自动演化——
// 把「自转 / 浮动 / 摆动 / 入场弹出 / 有机漂移」这类动画从游戏层手写逐帧改分量（绕基座）**下沉成纯数据**（可组合）。
// 两类通道：**循环(loop·随壁钟持续)** = spin/bob/osc/noise（绕作者初值演化）；**一次性(once·播一遍保持终值)** = ease（入场/强调）。
//   同 field 多通道**叠加(compose)** → 组合出复杂运动（如 x/z 两 osc 相位差 π/2 = 环绕；spin+bob 同 rotY = 变速自转）。
// 红线：**纯表现**——绝不进 sim/hash（render-only·入 NON_DETERMINISTIC）。弱 LLM 只填 field/波形/标量·填不了插值代码。
export type Anim3DField = 'x' | 'y' | 'z' | 'rotX' | 'rotY' | 'rotZ' | 'scale';
export type Anim3DWave = 'sine' | 'triangle' | 'saw' | 'square'; // osc 周期波形（皆归一 [-1,1]）
export type Anim3DCurve = 'linear' | 'cubicOut' | 'outBack'; // ease 缓动曲线（outBack=带回弹过冲·弹出感）
export type Anim3DChannel =
  // ── 循环通道（loop·绕作者初值·t=经过秒）──
  | { kind: 'spin'; field: 'rotX' | 'rotY' | 'rotZ'; rate: number } // 初值 + rate(rad/秒)·t —— 匀速自转
  | { kind: 'bob'; field: Anim3DField; amp: number; freq: number; phase?: number } // 初值 + amp·sin(t·freq+phase) —— 正弦浮动（= osc sine 简写）
  | { kind: 'osc'; field: Anim3DField; wave: Anim3DWave; amp: number; freq: number; phase?: number } // 初值 + amp·wave(t·freq+phase) —— 通用周期振荡（摆动/机械/闪烁）
  | { kind: 'noise'; field: Anim3DField; amp: number; freq: number; seed?: number } // 初值 + amp·noise(t·freq+seed) —— 确定性噪声漂移（有机游走·神经质待机）
  // ── 一次性通道（once·播一遍→保持终值·入场/强调）──
  | { kind: 'ease'; field: Anim3DField; from: number; to: number; dur: number; curve?: Anim3DCurve; delay?: number }; // from→to 经 dur 秒（delay 后起·curve 缺省 cubicOut）·**绝对值**（不绕初值）
export interface Anim3D extends Component {
  readonly type: 'Anim3D';
  channels: Anim3DChannel[]; // 多通道叠加（loop 绕初值加·ease 覆写绝对值·同 field 求和）
}

// ── Pivot3D（render-only，3D 父合成/层级）──────────────────────────────────────────────────────
// 让一组子实体的 Transform3D 位姿在渲染前**合成到本实体（pivot）的变换下**——即把「整座竞技场 + 骰壳 + 柔光」
// 当作**一个单元**一起转/缩/移（Cloud Design 骰钟转场 §F：旧场裹进骰壳、整体螺旋升走换层）。
// 我方 Transform3D 是逐实体世界位姿·无 3D 父子层级（Hierarchy 是 2D 的）→ 这是那个真缺口的下沉。
// 合成：childWorld = T(pivot 平移)·T(center)·R(pivot 欧拉)·S(pivot scale)·T(-center)·childLocal
//   （绕 center 转/缩·再叠 pivot 自身平移；pivot 无变换时 = 恒等·子实体位姿不变·向后兼容）。
// pivot 自身的变换 = 本实体的 Transform3D（可被 Anim3D 或运行时胶水驱动）。渲染器 collect 后据此改子实体最终位姿。
// 红线：**纯表现**——绝不进 sim/hash（render-only·入 NON_DETERMINISTIC）。弱 LLM 只填 children 列表 + center 标量。
export interface Pivot3D extends Component {
  readonly type: 'Pivot3D';
  children: string[]; // 受本 pivot 变换合成的子实体 id（它们的 Transform3D 视为 pivot 局部坐标）
  centerX?: number; // 旋转/缩放的中心（世界坐标·缺省 0）——竞技场螺旋应设成场中心
  centerY?: number;
  centerZ?: number;
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
  quat?: readonly [number, number, number, number]; // 可选四元数(x,y,z,w)·在场则覆盖欧拉角（物理翻滚等需无万向锁的旋转·render-only）
}

// ── Pickable3D（render-only，3D 对象拾取标记 · 输入层）──────────────────────────────────────────
// 标记一个实体「可被指针拾取」。渲染器 `pick(clientX,clientY)` 对所有 Pickable3D 实体的**世界包围盒**做射线求交，
// 命中最近者返回其实体 id + 信号名。命中结果由游戏输入胶水经 `ActionSink.enqueueAction(signal,{arg:entityId})` 入队
// → keybind 产 `Signal{name:signal,arg:entityId}` → sim 能力按名消费（照 2D `t2-clickable` 先例；但 3D raycast 在
// **输入层**做——与鼠标点击同类外源输入·本地合法·**不碰 sim 确定性**）。红线：纯表现标记，**绝不被 Condition 读、绝不进 hash**。
export interface Pickable3D extends Component {
  readonly type: 'Pickable3D';
  signal: string; // 指针拾取(click)命中时游戏应发的信号名（arg=命中实体 id）
  hover?: string; // 可选·指针悬停命中时的信号名（游戏在 pointermove 调 pick 时用）
}

// ── RigidBody3D（render-only，表现物理 · TA）──────────────────────────────────────────────
// 真物理刚体（cannon-es 驱动·**纯表现**：滚色子/掉落/翻滚·**不进 sim/hash·不为联机同步**·owner 2026-06-30「为表现非同步」）。
// 渲染侧物理子系统每帧步进 → 把结果(位置+四元数)写回同实体 Transform3D（render-only）→ 渲染器照常画。
// 体形/尺寸默认取同实体 Mesh3D（box→半尺寸·sphere→半径）；mass=0=静态。红线：render-only 自由区，可用随机/时间。
export interface RigidBody3D extends Component {
  readonly type: 'RigidBody3D';
  shape?: 'box' | 'sphere'; // 缺省取 Mesh3D.shape（box/sphere）
  mass?: number; // 质量·缺省 1（0=静态不动）
  restitution?: number; // 弹性 0..1·缺省 0.3
  friction?: number; // 摩擦·缺省 0.4
  vx?: number; vy?: number; vz?: number; // 初速度
  avx?: number; avy?: number; avz?: number; // 初角速度（翻滚）
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
  env?: number; // 环境光照(IBL)强度·>0 时渲染器装环境贴图 → PBR 金属/玻璃才有反射可照（缺省 0=不装·向后兼容）
  // 真环境贴图（REQ-3D ⑤·= texture/HDRI 资产 key·equirect .hdr 字节）：在场且就绪 → RGBELoader+PMREM 真反射；
  // 缺省 / 未就绪 → 回退程序化中性影室（RoomEnvironment）。env(强度) 仍生效。包体预算：建议 ≤2k 分辨率（掌机 cartridge）。
  envMap?: string;
}

// ── L2 color ── 实体当前的颜色/透明度
// ── Light3D（render-only，数据化光照 · 3D 盒庭）──────────────────────────────────────────────
// 把写死在渲染器 init 里的灯搬进数据：游戏蓝图声明灯，引擎解释。可挂多盏（sun + ambient + 补光）。
// kind:'directional' = 平行光（太阳·dir 为光的去向）；'ambient' = 环境光（无方向·整体补亮）。
// 第一盏带 castShadow 的平行光当主阴影灯（盒庭模式自动框场景投软影）。无任何 Light3D → 退回引擎默认
// 暖主光 + 冷补光（向后兼容·three-lab/现有游戏不受影响）。红线：纯表现，绝不进 sim/hash（NON_DETERMINISTIC）。
export interface Light3D extends Component {
  readonly type: 'Light3D';
  kind: 'directional' | 'ambient' | 'point' | 'spot'; // point/spot = TA Phase 2 动态局部光
  color: number; // 0xRRGGBB
  intensity: number;
  dirX?: number; // directional 去向 / spot 朝向（渲染器归一化·缺省盒庭暖侧光向）。ambient/point 忽略。
  dirY?: number;
  dirZ?: number;
  castShadow?: boolean; // directional·是否当主阴影灯（盒庭通常一盏投影·缺省取首盏平行光）。point/spot v1 不投影。
  // ── point / spot（局部光·**可移动**：缺省读同实体 Transform3D，否则 2D Transform(x→X,y→Z)+baseY；
  //     把 Light3D 挂在移动实体上 → 光随之走）。预算：渲染器限同时 2 盏动态 point/spot。
  x?: number; y?: number; z?: number; // 显式世界位（优先）
  baseY?: number; // 2D Transform 情形的离地高度
  range?: number; // 衰减距离（0=无限·建议给值做局部光）
  decay?: number; // 衰减指数（缺省 2·物理）
  angle?: number; // spot 锥半角(弧度)
  penumbra?: number; // spot 半影柔边 0..1
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
  // 环境光遮蔽（AO·GTAO 地面真值·TA Phase 4）：缝隙/接触处压暗 → 箱庭玩具感的「厚度/接地」。
  // intensity=AO 叠加强度(缺省 1)；radius=采样世界半径(缺省随场景尺度·盒庭 ~4)；scale=衰减(缺省 1)。
  ao?: { intensity?: number; radius?: number; scale?: number };
  // 色彩分级（TA Phase 4·绘本调色板）：exposure=曝光×、contrast=对比(1=原)、saturation=饱和(1=原)、
  // brightness=亮度+、tint=整体染色 0xRRGGBB(×·缺省白不变)。
  grade?: { exposure?: number; contrast?: number; saturation?: number; brightness?: number; tint?: number };
  // 抗锯齿（TA Phase 4·SMAA·清 toon 硬边锯齿）。
  aa?: boolean;
}

// ── Material3D（render-only·TA Phase 5）── 物件 PBR 材质：从**封闭预设集**（assets/pbr-materials）选一种 + 微调。
// preset=预设名（matte/steel/gold/glass/rock/dirt/wood…·闭集·拼错回退 matte）；可覆盖 color/roughness/metalness/emissive。
// 挂在 Mesh3D 实体上 → 渲染器用物理材质渲（金属反光/玻璃透射/岩石哑光…）。不进 hash。带 Material3D 的物件走单 mesh
// （不进哑光实例化批）：特征物件用·量大同款仍用默认哑光实例化。
export interface Material3D extends Component {
  readonly type: 'Material3D';
  preset: string; // PBR 预设名（闭集·见 assets/pbr-materials）；materialRef 在场时作后备（材质资源无 preset 才用它）
  // 材质数据资产引用（REQ-Resource ④·render-only·= 索引 type:'material' 条目 id）：渲染器据它从材质目录
  // （buildMaterialCatalog）查 MaterialSpec 作基底，下面的 inline 字段（已定义者）覆盖之 → 合成有效材质。
  // 缺省或查无 → 纯用 inline preset/参数（向后兼容）。材质 = 引 texture key 的数据·非硬编码预设。
  materialRef?: string;
  color?: number; // 覆盖基色 0xRRGGBB
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  surface?: SurfaceDetail; // 程序化表面细节（normal/roughness 贴图·渲染器据参数生成·见下）
  // 真实贴图（REQ-Resource ①·render-only·= texture 资产 id·字段名照 THREE 标准）：渲染器据 key 从 AssetManager 取
  // THREE.Texture 挂材质，**按用途设色彩空间**（map=albedo→sRGB·normal/roughness/ao→线性·法线误设 sRGB 会渲染错）。
  // 显式 map 覆盖同通道的程序化 surface；缺省回退 surface/纯色（共存·向后兼容）。
  map?: string; // 反照率贴图（albedo·sRGB）
  normalMap?: string; // 法线贴图（线性）
  roughnessMap?: string; // 粗糙度贴图（线性）
  aoMap?: string; // 环境光遮蔽贴图（线性）
  // REQ-3D 贴图槽补齐 ④（render-only·= texture 资产 id）：
  metalnessMap?: string; // 金属度贴图（线性）
  emissiveMap?: string; // 自发光贴图（sRGB·= texture 资产 id·配 emissive 色 + emissiveIntensity）
  ormMap?: string; // ORM 打包图（一图三通道 R=AO/G=Roughness/B=Metalness·线性）→ 同图挂 ao/rough/metal 三槽（three 惯例）；显式单图覆盖对应通道
  // UV 平铺（render-only）：repeat=各轴重复次数（缺省 1）；offset=[x,y] UV 偏移。作用于本材质所有贴图槽。
  tiling?: { repeat?: number; offset?: readonly [number, number] };
}

// 程序化表面细节（render-only·TA Phase 5）：渲染器据参数生成 normal + roughness 贴图（DataTexture）—— **不需美术贴图文件**，
// 闭集 pattern + 几个标量（弱 LLM 能填）。同「天空盒按 Sky3D 数据程序化生成纹理」先例。red 线：render-only·不进 hash。
export interface SurfaceDetail {
  pattern: 'bumps' | 'noise' | 'scratches'; // 凸点/噪声/划痕（闭集程序化图案）
  tiles?: number; // UV 重复次数（缺省 3·越大纹理越密）
  normal?: number; // 法线强度（→ material.normalScale·缺省 1·0=平）
  rough?: number; // 粗糙度起伏幅度 0..1（凸处更光/凹处更哑·缺省 0.3）
  scale?: number; // 特征频率（缺省 1·越大颗粒越细）
}

// ── Fog3D（render-only·TA Phase 4）── 距离雾（scene.fog 线性）：远处柔化 + 盒庭「装在玻璃盒里」的纵深。
// color=雾色(常取天色)·near=起雾相机距离·far=全雾距离。挂一个即开；天空盒材质 fog:false 不受影响。
export interface Fog3D extends Component {
  readonly type: 'Fog3D';
  color: number; // 0xRRGGBB
  near: number;
  far: number;
}

// ── WorldUI3D（TA Phase 3·render-only·不进 hash）── 世界空间 UI（头顶飘字/血条/名字）。
// 锚在**自身实体**上（读其 Transform3D / 2D Transform），offsetY 抬到头顶。渲染器把锚点投影到屏幕，
// 在该处用引擎 UI 库 `mountUI` 挂一棵 **LayoutNode**（**UI 铁律**：仍是 LayoutNode·经真 UI 库渲染·不手写 DOM）。
// v1 = 静态文字 Label（头顶飘字）；动态绑定（HP/名字变量）后续。**渲染线只做世界锚 + 投影**，控件本体归主程 UI 库。
export interface WorldUI3D extends Component {
  readonly type: 'WorldUI3D';
  text?: string; // 头顶文字（简写·单 Label·node 缺省时用）
  // 富世界空间 UI（REQ-3D-世界空间 UI·owner 2026-07-07「3D UI 表达」）：挂**任意 LayoutNode**（面板/血条/名牌/多行·
  // 走引擎 UI 库渲染·UI 铁律）→ 锚世界点投影到屏幕·随实体每帧跟随（血条跟单位·背相机/出屏自动隐）。在场则替代 text。
  // 这是「世界空间 UI = LayoutNode 锚到世界物件屏幕投影点」的 screen-overlay billboard 路（非贴到 3D 面片的 diegetic·那另论）。
  node?: LayoutNode;
  offsetY?: number; // 锚点之上的高度（缺省 6）
  size?: 'xs' | 'sm' | 'md' | 'lg'; // Label 字号（text 简写用·缺省 sm）
  color?: string; // Label 颜色（text 简写用·UI 库语义色·缺省默认）
  glow?: boolean; // 发光（text 简写用）
}

// ── TA 地基（Phase 0）：曲线 / 渐变（render-only 值类型·随寿命/时间演化的 TA 通用原语）──────────────
// 关键点按 t∈[0,1] 排好；曲线给标量、渐变给颜色+透明。供 VFX(size/color over life)、灯闪烁、材质 ramp 复用。
export interface Curve { keys: Array<{ t: number; v: number }>; mode?: 'linear' | 'step' | 'smooth'; }
export interface Gradient { stops: Array<{ t: number; color: number; alpha?: number }>; } // color=0xRRGGBB

// ── Vfx3D（TA Phase 1·render-only·不进 hash）── 数据驱动粒子发射器（Niagara-lite 闭集模块）。
// 渲染器 VfxSystem 读它 + 实体世界位（Transform3D / 2D Transform / 显式 x,y,z）→ 池化 Points 粒子 CPU 模拟。
// render-only → 可用时间/随机自由（不碰 sim·不进 hash）。预算：每发射器 max 上限 + 渲染器全局 cap。
export interface Vfx3D extends Component {
  readonly type: 'Vfx3D';
  // 发射
  rate?: number; // 每秒持续发射数（缺省 0）
  lifetime: number; // 粒子寿命(秒)
  lifeVar?: number; // 寿命随机幅度(秒)
  max?: number; // 本发射器粒子上限（缺省 256·预算）
  // 形状（发射初速方向）：point=四散、cone=绕 +Y 锥、sphere=球内
  shape?: 'point' | 'cone' | 'sphere';
  coneAngle?: number; // cone 半角(弧度·缺省 0.4)
  emitRadius?: number; // sphere 发射半径 / 初始位置抖动（缺省 0）
  speed?: number; // 初速(单位/秒·缺省 4)
  speedVar?: number; // 初速随机幅度
  // 力
  gravity?: number; // -Y 加速度(单位/秒²·缺省 0)
  drag?: number; // 阻尼(每秒比例 0..n·缺省 0)
  attractor?: { x: number; y: number; z: number; strength: number }; // 点吸引力场：对每颗粒子施弹簧力 F=strength·(target−pos)。
  // 配 drag 阻尼 = 阻尼弹簧 = 缓入缓出（趋近时力变小·自然加减速·不夸张）。典型用法：粒子跟随鼠标聚集（游戏每帧把光标 unproject 的世界点写进 x/y/z）。缺省无 = 不施力。
  // 外观
  size?: number; // 基础粒子尺寸(世界尺度·缺省 1)
  sizeCurve?: Curve; // size-over-life（0..1 乘 size·缺省恒 1）
  color?: number; // 单色(0xRRGGBB·无 gradient 时)
  colorGradient?: Gradient; // color-over-life（覆盖 color）
  blend?: 'add' | 'alpha'; // 混合（add=发光/魔法·alpha=烟尘·缺省 add）
  // 发射器世界位（缺省读同实体 Transform3D，否则 2D Transform(x→X,y→Z)+baseY）
  x?: number; y?: number; z?: number;
  baseY?: number; // 2D Transform 情形的离地高度
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
