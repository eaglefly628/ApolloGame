# Godot 4.x vs ZeroCraft Preview —— 对比与「值得借鉴什么」

> 给 owner 决策用。**结论先行**：Godot 是极好的**设计参考**，但它的代码/运行时与 ZeroCraft 的两条铁律（数据驱动 + lockstep 确定性）**根本不同源**——所以价值在「把 Godot 的某些**概念**映射成 ZeroCraft 的 `组件 + capability` 数据模型」，**绝不是搬代码**。
> 调研基于 Godot 官方文档（docs.godotengine.org，stable=4.x，4.3/4.4/4.5 版页确认在线）+ 官方博客 + godot-jolt 维护者原话。本文由 P3D 汇编（owner 2026-06-30 授权调研，最终由 owner 裁决）。

---

## 1. TL;DR —— 值得认真考虑借鉴的（按价值排序）

1. **AnimationTree / 状态机 / BlendSpace 做成「数据」** —— 我们刚落地基础骨骼动画（播单 clip），下一步就缺「idle/walk/run 按速度混合 + 状态转移」这层。Godot 的 `AnimationNodeStateMachine` + `BlendSpace1D/2D` 整套是**资源（数据）**、gameplay 只推标量参数 → 完美契合我们「组件描述 + 解释器跑」。**最该借鉴的第一名。**
2. **「animate any property」轨道模型 + method-call 轨道** —— Godot 的 Animation 可对**任意节点的任意属性**打关键帧（含调方法）。映射到我们 = 一个通用 `Timeline/Track` 数据组件（关键帧驱动任意 render-only 字段 / 发 action 信号），统一相机运镜、UI 动效、过场。
3. **Resource（.tres）共享数据模型** —— Godot 把「材质/动画/曲线…」抽成**可独立存、引用计数共享**的数据资源。我们的预设（pbr-materials / 曲线 / 渐变）已是雏形；可形式化成「具名共享资源 + 实体引 key」，减少蓝图重复。
4. **Scene 实例化 / 继承（可复用数据子树）** —— Godot 场景=可实例化的蓝图、且支持「继承+局部覆盖」。映射到我们 = **蓝图片段（prefab）+ 实例覆盖**，正好接「关卡动态加载」那条线（块=可复用蓝图子树）。
5. **Visual Shader = 图即数据** —— Godot 的可视化着色器图编译成等价 shader。我们的 `Vfx3D`（闭集粒子）/`SurfaceDetail`（程序化贴图）已是这个思路；材质/后处理若要再扩，可走「节点图数据 → 固定解释器生成 shader」而非自由 GLSL。
6. **非渲染的两条「反面教材」很有用**：Godot **不是确定性物理、不是 lockstep**（高层联机=权威+场景复制）。这恰好**反向印证**我们 lockstep + 数据驱动是差异化护城河——**别借联机/物理那套**。

---

## 2. ZeroCraft 是什么（一句话锚定）

ZeroCraft = **TypeScript 的数据驱动 + lockstep 确定性 ECS 引擎**，配一条 three.js「盒庭」3D 渲染线。两条铁律：
- **数据驱动**：整个游戏是数据（组件 + 蓝图）；代码只是一台**固定的确定性解释器**（capability）。尺子：「最弱的 LLM 能不能也产出一模一样的数据？」
- **lockstep 确定性**：sim 必须跨机逐位一致（哈希校验 desync）；**render-only 是自由区**（不进 hash·可用随机/壁钟——VFX、IBL、骨骼动画、cannon-es 物理都落这里）。

---

## 3. 并排对比

| 维度 | Godot 4.x | ZeroCraft | 关键差异 |
|---|---|---|---|
| **架构** | 场景树 + Node（数据与逻辑**捆绑**在节点上·OOP） | ECS·组件=纯数据·capability=纯逻辑（数据/逻辑**分离**） | Godot 官方博文自承「无 Data/System 分离」——与我们正相反 |
| **作者方式** | **代码驱动**：脚本挂节点、命令式 GDScript/C# | **数据驱动**：蓝图填数据·弱 LLM 可写 | 我们的护城河 |
| **渲染** | Forward+/Mobile/Compat·Vulkan/D3D12/Metal·SDFGI/VoxelGI/Lightmap·SSAO/SSR/SSIL/体积雾 | three.js·GTAO/Bloom/Grade/SMAA·IBL·PBR·程序化贴图·实例化·脏标跳渲 | Godot 渲染**功能面大得多**（GI/SSR/体积雾是我们没有的）；但都是 C++ 内部·不可移植 |
| **动画** | AnimationPlayer（任意属性轨道）+ **AnimationTree（混合树/状态机/BlendSpace·资源）** + Skeleton3D + Tween | 刚落地：`AnimState3D` 播单 glTF clip（骨骼·render-only） | **我们缺混合/状态机层**——这是最大可借鉴点 |
| **物理** | GodotPhysics / Jolt(4.4 内置·4.6 默认)·**非跨平台确定性** | cannon-es（render-only 表现物理·色子）+ 自研确定性 2D/3D 碰撞（进 hash） | Godot 物理**不确定**·不能 lockstep；我们 sim 物理是定制确定性 |
| **脚本/作者** | GDScript（VM）/C#/C++(GDExtension) | 无脚本运行时·全是数据 + 固定 TS 解释器 | 我们没有、也不要游戏侧脚本运行时（破确定性 + 破数据驱动） |
| **联机** | 高层 = **权威 + 场景复制**（MultiplayerSpawner/Synchronizer + @rpc·ENet/WS/WebRTC）·**无内置 lockstep** | **lockstep**（只同步输入 + 哈希校验·确定性 sim） | 模型相反·不可混 |
| **UI** | Control 节点 + 锚点/容器 + Theme 资源 + 焦点导航 | `ui/components` LayoutNode（闭集控件·数据描述·action 信号） | 思路相近（数据化 UI）；Godot 的**容器自动布局 + Theme 级联**值得对照 |
| **资产管线** | 非破坏式 import（`.import` sidecar·缓存·ResourceImporter·Basis 压缩） | AssetManager（按 key 取字节·glTF/图片）·无 import 配置层 | Godot 的「源不动 + sidecar 配置 + 自动重导」是成熟样板（接我们「真实贴图管线」时可借） |
| **扩展** | GDExtension（运行时挂原生库·不重编引擎） | capability 注册（TS 模块） | 形态不同·我们靠 TS 模块即够 |
| **确定性** | **非**跨平台确定（物理/浮点/编译器差异） | **跨机逐位**（确定性纪律 + 哈希守卫） | 我们的根本约束·Godot 不具备 |

---

## 4. 值得借鉴的 —— 作为**数据驱动概念**映射到 ZeroCraft（绝非搬码）

> 每条：Godot 怎么做 → 映射成我们的「组件 + capability」 → 价值/工作量

**A. 动画状态机 + 混合树 + BlendSpace（★最高价值）**
- Godot：`AnimationTree` 持一棵**资源化**的混合图（Blend2/Add/OneShot/Transition）+ `AnimationNodeStateMachine`（状态 + 转移条件 + xfade）+ `BlendSpace1D/2D`（按 blend_position 在多 clip 间三角插值，如按速度 walk→run）。gameplay 只 `set("parameters/...", value)`。
- 映射 ZeroCraft：扩 `AnimState3D` → **`AnimGraph3D`（render-only 数据）**：`{ states:[{name,clip}], transitions:[{from,to,when}], blend:{param, points:[{at,clip}]} }`；渲染侧解释器（已有 AnimationMixer 基础）按数据建 blend/crossfade。**触发参数若来自 sim（如速度）= 确定性输入·render-only 解释**。
- 价值：**高**（追逐游戏立刻能 idle/run 平滑切换、按速度混合）。工作量：中。**建议下一个做这个。**

**B.「animate any property」+ method-call 轨道 → 通用 Timeline 组件**
- Godot：Animation 轨道可 key 任意属性、还能 call-method。
- 映射：`Timeline3D`（render-only）= `{ tracks:[{ target:'字段路径'|'action信号', keys:[{t,v}], ease }] }`，解释器按时间插值写 render-only 字段或 enqueue action。统一相机运镜、过场、UI 动效（我们现在这些各写各的）。
- 价值：中-高。工作量：中。

**C. Resource 共享数据模型**
- Godot：材质/动画/曲线 = 可独立存、引用计数共享的资源；实例可「local override」。
- 映射：把 `pbr-materials` / 曲线 / 渐变 形式化成**具名共享资源表 + 实体引 key + 可选覆盖**（我们 `Material3D{preset, 覆盖}` 已是雏形）。减蓝图重复、利于「弱 LLM 选 key」。
- 价值：中。工作量：低-中。

**D. Scene 实例化/继承 → prefab 蓝图子树（接关卡加载线）**
- Godot：场景 = 可实例化蓝图 + 继承 + 局部覆盖。
- 映射：**蓝图片段（prefab）** = 可复用实体子树数据；「关卡加载」capability 实例化 prefab + 覆盖位置。正好是 owner 排的下一个任务（按位置加载/卸载关卡）的底座。
- 价值：高（直接服务关卡线）。工作量：中。

**E. 资产 import 管线（接「真实贴图」时）**
- Godot：源文件不动 + `.import` sidecar 记导入参数 + 缓存 + 自动重导 + Basis 跨平台压缩。
- 映射：owner 卡在「真实贴图美术管线怎么做」——可借此样板：**美术库里每张贴图配一份 import 描述（数据）**，构建期归一化/压缩成运行时资源，蓝图只引 key。**这正是把贴图做成数据驱动的答案。**
- 价值：中（解 owner 的贴图管线疑虑）。工作量：中-高。

**F. Visual Shader = 图即数据**（已部分在走）
- 我们 `Vfx3D`/`SurfaceDetail` 已是「闭集参数 → 解释器生成 GPU 效果」。若材质/后处理要再扩，延续「节点图数据 → 固定解释器」，**别开自由 GLSL 口子**（破弱-LLM 尺子）。

---

## 5. **不要**借鉴的（及原因）

- **Godot 的联机（权威 + 场景复制 + @rpc）** —— 与我们 lockstep（只同步输入 + 哈希校验）**模型相反**。Godot 自己也**没有**内置 lockstep/回滚；社区要做得自带定点物理（SG Physics / Klotho）。我们已有 lockstep，别混入复制模型。
- **把 sim 物理交给 Jolt/GodotPhysics** —— **非跨平台确定**（Jolt 维护者明说「Godot Jolt 不保证确定性」·`-ffast-math` 直接破）。我们 sim 必须确定 → sim 物理只能定制定点/确定性；cannon-es 只配**表现物理**（已这么做）。
- **GDScript/C# 脚本运行时挂在游戏对象上** —— 破「数据驱动」（逻辑回到代码）+ 破确定性。我们的 capability 是**引擎侧固定解释器**，不是游戏侧脚本。
- **Node 把数据与逻辑捆绑的 OOP 模型** —— 与我们 ECS（数据/逻辑分离·弱-LLM 只填数据）冲突。借**概念**（场景树的可组合性 → prefab）可以，搬**架构**不行。
- **C++ 渲染内部（SDFGI/VoxelGI/clustered forward…）** —— 不可移植到 three.js；要类似效果走 three 的对应方案（如 light probes / SSR addon），而非搬 Godot。

---

## 6. 推荐（owner 先考虑哪个）

按「价值 × 契合我们当前线」排：

1. **动画状态机 + 混合（AnimGraph3D）** —— 紧接刚做的骨骼动画，让角色 idle/run 平滑切换、按速度混合。**最顺、最该先做。**
2. **prefab 蓝图子树** —— 作为「关卡动态加载/卸载」（owner 已排的下一任务）的数据底座，一举两得。
3. **资产 import 管线** —— 当 owner 想推进「真实贴图」时，用 Godot 的 sidecar 样板把贴图做成数据驱动（解他卡住的美术管线问题）。
4. 通用 Timeline 组件、Resource 共享表 —— 锦上添花，按需。

> **底线复诵**：ZeroCraft 的差异化 = 数据驱动 + lockstep。任何从 Godot 借来的东西，必须 ① 表达成数据（弱-LLM 尺子）、② sim 侧保持确定（render-only 才自由）。满足这两条就借**概念**，否则只当反面参照。
