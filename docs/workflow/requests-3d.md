# 3D 渲染线 · 需求 / 工单池（owner 2026-06-28 立独立池）

> **这是什么**：Apollo「3D 盒庭」渲染线 + Game Z 的**需求 / 工单单一真相**（从主 `requests.md` 分出·避免 3D 条目淹没在通用 UI/游戏需求里）。
> **归属**：3D 渲染线由 **P3D** 主管（代码边界契约见 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`）。本池由 owner/主程 派单、P3D 执行、Lead 评审标状态。
> **新 3D 需求都进这里**（不进 `requests.md`）；通用 UI 库 / 其它游戏需求仍进 `requests.md`。

---

## REQ-3D-Collision 3D 逻辑碰撞（触发/重叠·升维 2D） · [2026-06-28] · owner+P3D → 主程（sim/能力域评审） · status: **open（spec·待主程评审/授权落点）** · 类型: 真能力缺口（3D 逻辑碰撞·升维复用）

> **owner 2026-06-28 拍板的架构分界（最关键·两套碰撞泾渭分明）**：
> - **逻辑碰撞（触发/重叠）= 确定性 sim**：「进区域 / 撞到 / 命中」喂玩法的事实 → 进权威主机/lockstep 状态 → **进 hash、必须确定性**。**本 REQ 只做这个。**
> - **物理模拟（刚体/弹飞/堆叠/布娃娃）= 纯表现**：**绝不喂逻辑、不进 lockstep/hash**。哪天做可随便用非确定性物理库（Cannon/Rapier 当特效）——**YAGNI·不在本 REQ**。
> 这一刀绕开 3D 物理最难的坑（跨端浮点确定性）：逻辑碰撞只做廉价解析重叠测试（**同 2D 先例·确定性边界不变**）。
>
> **结论：升维复用现成 2D 碰撞能力到 3D**（P3D + owner 评估·主程定夺）。2D 已有成熟确定性分层可直接镜像：
> | 2D 现成（主程域） | 3D 升维 |
> |---|---|
> | `Shape`(box/circle/polygon·进 hash) | `Collider3D`(sphere/AABB/capsule·进 hash·**数据组件**) |
> | `engine/spatial/aabb-tree.ts`(`DynamicAabbTree`·每帧重建·rollback 安全) | 升成 **3D AABB**（同结构·同确定性） |
> | `engine/spatial/contact.ts`(`contactBetween`/`aabbOf`) | 3D 解析窄相位（sphere/AABB/capsule 重叠 + 法线/深度） |
> | `overlap-detect`(atom·产 `Overlap`) | `overlap-detect-3d` 产 `Overlap3D`（法线+深度·或纯触发布尔） |
> | `collision-resolve`(tier2·推开) | 3D 推开（按需·触发区只需重叠事件不需推开） |
>
> **空间分割裁决**：用**升维的动态 AABB 树（BVH）**——不是四叉/八叉树（轻量盒庭几十~低百物体·现成树确定性+rollback 已验证）；物体特别少时暴力 N² AABB 亦可。八叉/网格 YAGNI。
> **碰撞体分档（封顶复杂度·owner「不能特别费」）**：A 解析图元 sphere/AABB/**OBB**/capsule/cylinder（覆盖 90%·角色 capsule + 关卡 box）；B 凸包 multi-convex（GJK·**封顶顶点/块数**）；C 任意三角网格**不做**（静态关卡拆凸块/AABB）。**先做 A 档的 sphere/AABB/capsule + 触发/重叠事件**。
>
> **分期**：
> - **P1（覆盖 90%·先做）**：`Collider3D` 数据(sphere/AABB/capsule) + 3D 动态 AABB 树宽相位 + 解析窄相位 + `Overlap3D` 触发/重叠事件 + （按需）3D 推开。够角色撞墙/落地/触发区。
> - **P2**：OBB + cylinder + 凸包(GJK·有界)。
> - **P3（仅当真要刚体·另起「物理表现轨」）**：堆叠/推/关节 = **纯表现**层·评估 Rapier·不进 hash。
>
> **数据驱动尺子**：`Collider3D` 弱模型填得了 `kind:'capsule', radius:2, height:7, offset:{...}`，**填不了物理引擎不透明 body 句柄**——过尺。碰撞=确定性解释器（能力）。
>
> **边界 / 分工**：碰撞 sim 全在 `engine/spatial` + `skills` + sim 组件 = **🔒 主程域**（§0.1）。**请主程评审本提案并定落点**（主程实现 / 或 owner 像授权资产层那样授权 P3D 跨界落）。**P3D 天然拥有的那块**：① 碰撞体 **debug 线框可视化**（render-only·新 3D render 组件或复用 Mesh3D wireframe·我的渲染线域）；② game-z 接碰撞能力做触发区 demo（小黄鸭进区域亮灯等）。
> **验收**：角色 capsule vs 关卡 AABB 触发/重叠事件确定性（进 hash·rollback 安全·node 单测同 2D `overlap-detect.test` 先例）；debug 线框渲出；tsc+vitest+build 全绿。

---

## REQ-3D-W1高效引擎 · [2026-06-28] · owner → P3D（3D 渲染线）· status: **🚧 进行中（W1-A + W1-B + W1-C + W1-D ✅ 已落 + profiler + 模块化拆分；W1-E 健壮 ⬜ 下一增量）** · 类型: 设计纲领 + 真能力（实例化绘制）

> **进度（P3D 2026-06-28·已推）**：
> - **W1-A 实例化** ✅：同视觉签名(`mesh3dBatchKey`=shape+尺寸+逐面色)的 Mesh3D → 一个 `InstancedMesh`（1 draw call）。逐面色**烤进 `vertexColors`**（多色盒也能批·非仅单色）；复用单 dummy `Object3D` 合 instanceMatrix；超容量 ×2 扩容；空批移除；整体投/受软影；`frustumCulled=false` 防散布整批误剔；透明盒(alpha<1)走单 mesh fallback。验收：game-z 20 盒 → **11 批**（金阶梯 2→1·蘑菇茎 2→1·8 鹅卵石 8→1）。**Model3D 多 mesh 实例化 = W1-A 第二步（待）**。
> - **W1-B 零浪费** ✅：去每帧 `material.needsUpdate`（颜色/alpha 是 uniform）；仅贴图引用变才 needsUpdate；不透明走 opaque 管线。
> - **W1-C 低开销基线** ✅：① 静态帧**脏标跳渲**（渲染签名=位姿hash+相机+灯+后处理+云飘帧·不变则跳 instanceMatrix 上传+阴影+render）；② **阴影按需重算**（`shadowMap.autoUpdate=false`·仅投影体/灯变才 needsUpdate·相机转/云飘不触发阴影重算）；③ near/far 从 0.1–10000 收紧到 ~1–(dist+天空半径)。
> - **W1-D 快赢** ✅：`ACESFilmicToneMapping`+曝光（天空盒 `toneMapped:false` 保色）+ `setPixelRatio(min(dpr,2))`。
> - **profiler（owner「做个 profile state·像虚幻」）** ✅：`renderer.readStats()` 暴露 fps/cpuMs/drawCalls/triangles/programs/geo/tex/batches/instances/models/rendered；game-z LayoutNode HUD 显示（P 键开关·UI 铁律）。
> - **模块化拆分（owner「别全写一个文件·每文件<400 行」）** ✅：`three-renderer.ts` 832→392 行；拆 `renderer/three/{geometry,stats,lights,post,models,batches}.ts`（各 ≤146 行·按子系统分）。
> - **⬜ 待续**：W1-E（resize/模型自动贴地/.glb-only）；W1-A 第二步（Model3D 多 mesh 实例化）。
> - 测试：`mesh3dBatchKey` + `hashPoses/camSig/postSig`（脏标）纯函数单测；tsc+vitest+build+无头截图全绿。零数据改动（绝不加 instanced 旗标）。

> **设计纲领（owner 2026-06-28 拍板）**：要的是**高效率、低开销**的 3D 引擎——**性能是一等设计约束、写进架构，不靠后期优化补**（owner 明言「后期不会做什么优化」）。所以下面不是「以后再说的优化」，是**现在就该达到的基线**。**instanced draw（实例化绘制）是硬要求。**
> **数据驱动铁律不变**：W1 全是**渲染器内部**的事，**零数据 / 零组件 / 零接口改动**——游戏照旧摆 N 个 `Mesh3D`/`Model3D` 实体（纯数据），渲染器自己批。**绝不往数据里加 `instanced:true` 之类渲染旗标**（那是把渲染关切泄进数据，违 manifesto）。

### W1-A · 实例化绘制（headline · 必做）
目标：同一几何的多个实体 → **1 个 draw call**（`THREE.InstancedMesh`），对数据透明。
- **自动分批（batch key 从现有组件派生·不加字段）**：Mesh3D → key=`shape+尺寸(w/h/d)`（同几何）；Model3D → key=`modelKey`（同 glTF）。同 key 进同一 InstancedMesh，每实体一个 `instanceMatrix`（位姿合成 Matrix4）。
- **每帧**：每批只更新 `instanceMatrix`（一次 buffer 上传·`instanceMatrix.needsUpdate=true`）——**廉价 buffer 上传、非 shader 重编**（对照 W1-B#1）。复用单个 `Matrix4`/`Quaternion` 临时对象，**别每帧每实体 new**。
- **动态数量**：实体增减 → 预分配容量 + 设 `mesh.count=活跃数`；超容量再扩容重建；空批移出场景。
- **阴影**：InstancedMesh 整体 `castShadow/receiveShadow`（实例阴影 three 原生支持）。
- **⚠️ 逐面色的坑（务必处理对）**：InstancedMesh 共享**一个**材质，`instanceColor` 只给**每实例一个色**——表达不了 Mesh3D 的 front/back/edge 逐面分色。三选一：① **同色盒批**（front=back=edge 同色的盒子进实例批·`instanceColor` 上色——积木/体素世界大多如此·最划算）；② **逐面色烤进 `vertexColors`**（同图案盒可实例化）；③ **逐面异色盒不实例化**（少量走老单 Mesh 路·保留 `paintMesh3D` 作 fallback）。**建议默认 ①+③ fallback**。
- **Model3D 实例化（分期）**：glTF 是多 mesh 树。现 `clone(true)` 已**共享几何**（几何只传一次 GPU）→ 现状=「N draw call、几何不重传」；实例化要收的是那 **N 个 draw call**。**先把 Mesh3D 实例化做扎实**；多 mesh 模型实例化（每子几何一个 InstancedMesh：`instanceMatrix=实体世界矩阵×子mesh局部矩阵`，或本 three 版的 `BatchedMesh`）作 W1-A 第二步。
- **验收**：N 个同款盒/鸭 → `renderer.info.render.calls` ≈ 批数（非 N）·断言（无头截图脚本可读 `renderer.info`）；batch key 归并 + 矩阵合成抽 `three-projection` 纯函数单测。

### W1-B · 每帧零浪费（review 的性能项 · 现在是必做基线）
1. **去掉每帧 `material.needsUpdate=true`**（`paintMesh3D`/`paint`）——颜色/alpha 是 uniform、每帧本就重传，不需 needsUpdate；只在贴图引用变 / transparent 翻转时设。**这是「低开销」的地板，与实例化同等重要。**
2. **`transparent` 只在 `alpha<1` 时开**（`buildMesh3D` 现恒 true → 按 alpha）——不透明物体走 opaque 管线（early-z + 不排序）。
3. **sync 里别每帧每实体 new 临时对象**（Matrix4/Vector3/Euler 复用单例）。

### W1-C · 低开销基线（写进设计·非后补）
- **静态帧跳渲**：盒庭基本静态 → 维护 dirty 标志（world 版本变 / 相机动 / 云飘 / 有动画）；**没变就不 `gl.render`**。这是「低开销」最大单点（静态盒庭可从满载降到近 0）。云飘/角色走动时记得置 dirty。
- **阴影不动不重渲**：`key.shadow.autoUpdate=false` + 仅 dirty 时 `shadow.needsUpdate=true`。
- **相机 near/far 收紧**（现 0.1–10000=1e5 比·深度精度差）：near~1、far 从天空盒半径派生（顺带减 z-fighting）。

### W1-D · 观感快赢（owner 已「可以」）
- `gl.toneMapping=ACESFilmic`（或本版 AgX）+ `toneMappingExposure≈1.05`——PBR 不削顶、通透。
- `gl.setPixelRatio(Math.min(devicePixelRatio,2))`——retina 不糊。

### W1-E · 健壮（中·进清单）
- `ResizeObserver` → `setSize` + `camera.aspect`（容器变尺寸）。
- 模型自动贴地：`Box3.setFromObject` 算底面 minY、缓存偏移、抬到坐地（消「模型原点须在脚底」踩坑）。
- 文档写明 glTF **.glb / 内嵌资源 only**（`parse(bytes,'')` 不解外部 .bin/贴图）。

### 贯穿 W1 的数据驱动守则
- 实例化 / 批 / 跳渲 / tonemap 全是**渲染器内部**，**零数据改动**——游戏只摆实体数据，渲染器自动高效。
- 别为实例化让数据「迁就渲染器」（如强制同色）——**同色批是渲染器的选择**，数据照常可填逐面色，渲染器决定谁进批、谁走单 mesh fallback。
- 光照/曝光数据化（`Light3D`+曝光字段）**P3D 已超额做出**（见路线图记录）；W1 先把 tonemap 作渲染器默认值即可。

> **优先级**：W1-A 实例化 + W1-B 零浪费 = 第一梯队（效率纲领核心）；W1-C 静态跳渲 = 第二（最大低开销单点）；W1-D 快赢顺手；W1-E 中期。全程 tsc+vitest+build 全绿才推，跨出 3D 渲染线先报主程。

---

## REQ-3D-Camera相机参数补全 · [2026-06-28] · owner → P3D（3D 渲染线）· status: **✅ done（P3D 2026-06-28·三层落地·正交/跟随截图验证）** · 类型: 真能力扩增（3D 线·过四条尺子）

> **✅ 落地（P3D 2026-06-28·已推）**：严守三层铁律——数据补参数 / 解释器算矩阵 / 行为写态。
> - **① 数据层**：`Camera3D` 补 `projection('perspective'|'ortho')`/`fov`/`orthoSize`/`near`/`far`/`mode('orbit'|'follow')`/`target`/`pitchMin`/`pitchMax`（全语义参数·**无矩阵**·多模式用 `mode` 枚举）。
> - **② 解释器层**：新 `renderer/three/camera-rig.ts`（`CameraRig`·持透视+正交两台·按 `projection` 选 active·fov/ortho/near/far 全从数据读）；`mode:'follow'` 由渲染器把注视点解析成 `target` 实体位（收集期捕获位姿·不写 sim/不进 hash）；投影/正交视锥/夹角数学抽 `three-projection` 纯函数（`orthoFrustum`/`clampPitch`）+ node 单测。
> - **③ 行为层**：game-z 拖拽/滚轮写 `Camera3D`（运行时胶水·pitch 夹角读数据）；O 键切正交、F 键切跟随小黄鸭（只写数据·渲染器解释）。
> - 验收：截图确认**正交=等距盒庭**、**follow 相机注视小黄鸭**；fov/pitch 夹角/near-far 全从数据；`renderer.info` 无回归。`fov` 从 `ThreeRendererOptions` 迁到 `Camera3D` 数据。`camSig` 纳入全相机参数（改即重渲）。tsc+vitest+build+截图全绿。**未做（YAGNI·准则点名）**：震屏/镜头过渡（要做时是 render-only 行为写 `Camera3D`+tween·不塞字段）。

> **owner 2026-06-28**：3D 相机要像传统 3D 游戏那样有更多参数（投影 / fov / near-far / 跟随 / 约束）。这是「3D 线被证明的真缺口边」上的**正当扩增**。
> **架构铁律（贯穿）**：**相机 = 数据（`Camera3D`）+ 固定解释器（渲染器算矩阵）**。传统引擎是「Camera 对象带 lookAt/setFov/矩阵方法、游戏调它」；我们这套**反转**——游戏**永不调相机方法、永不持矩阵**，只填 `Camera3D` 数据，渲染器去 lookAt / 算 view·projection 矩阵。三层分工：

### ① 数据层（`Camera3D` 组件补字段 · render-only · 语义参数 · 弱模型能填）
- 现有：`yaw / pitch / distance / pivotX·Y·Z`（保留）。
- 补：`projection?: 'perspective'|'ortho'`（正交=等距微缩盒庭常用）；`fov?`（透视·从 `ThreeRendererOptions` 移到数据·per-scene）；`orthoSize?`（正交半高）；`near?` / `far?`（深度精度·配 W1-C 收紧）；`mode?: 'orbit'|'follow'`；`target?: string`（follow 时注视/环绕的实体 id）；`pitchMin?` / `pitchMax?`（俯仰夹角·game-z 现硬编码在 mount，挪成数据）。
- **绝不放矩阵**——弱模型 litmus：它填得了 `fov:50 / mode:'follow' / target:'duck' / near:1`，**填不了一个 4×4 矩阵**。**多模式用 `mode` 枚举，别开 N 个相机组件。**

### ② 解释器层（`three-projection` 纯函数 + `ThreeRenderer` · 引擎固定 · 算矩阵）
- `projection:'ortho'` → 运行时切 `THREE.OrthographicCamera`（按 orthoSize/aspect 定 frustum）；`'perspective'` → 现 `PerspectiveCamera` 用 `fov`。
- `fov / near / far` 从 `Camera3D` 读（不再写死在构造 option）。
- `mode:'follow'` → 渲染器每 sync 把 `pivot` 解析成 `target` 实体的世界位（Transform3D 或 2D-Transform 落地面位）——**这是「解释」（渲染器读世界），不是新 capability、不写 sim、不进 hash**。
- `pitchMin/Max` 夹 pitch。投影 / lookAt / ortho frustum 数学抽 `three-projection` 纯函数 + node 单测（同 `orbitCamera`/`fitDistance3D` 先例）。

### ③ 行为层（运镜 · 写 `Camera3D` 随时间变 · render-only）
- 输入运镜（拖拽转 yaw/pitch、滚轮改 distance）已是**运行时输入胶水**（game-z mount 先例）——保持；按需可抽成 render-only 小能力。
- 震屏 / 镜头过渡 = **暂不做（YAGNI）**；要做时是 render-only 行为（写 `Camera3D` + 用 `tween`），**不塞进 `Camera3D` 字段**。

> **尺子（别扩歪）**：① 矩阵留解释器、组件只存语义参数；② `mode` 枚举非 N 组件；③ 别投机搬电影机全套（景深 DOF 已是 `Post3D` 的活 / 镜头语言 YAGNI）；④ 运镜是「行为写态」不是 `Camera3D` 字段；⑤ render-only 出 hash（`Camera3D` 已在 `NON_DETERMINISTIC`）。
> **验收**：盒庭可切正交看等距；`mode:'follow', target:'hero'` 时相机跟鸭走；pitch 夹角 / near-far 来自数据；投影 / follow-pivot 纯函数单测；tsc+vitest+build 全绿。
> **这是「3D 线下一个正当扩增」的样板**：数据补参数、解释器算矩阵、行为写态——**三层不混**。跨出 3D 渲染线（如要动资产/核心 ECS）先报主程。

---

## REQ-3D-Model导入 · [2026-06-28] · P3D（3D 渲染线）→ 主程（资产层域）· status: **✅ done（端到端打通·owner 2026-06-28 当面授权 P3D 跨界把资产半边也落）** · 类型: 真能力缺口（box 原语表达不了圆润模型）

> **⚠️ 知会主程**：资产层（`src/assets/`·按契约 🔒 主程域）这次由 P3D 落了——**owner（junbai.li）2026-06-28 当面授权**「资产这块你也去，可以授权你动」。改动**极小且零 three 依赖**，不碰任何 2D 逻辑/现有 kind 行为，全绿。如与并行资产改动撞 rebase 请喊主程。
> **背景**：owner 2026-06-28 拍板做「轻量 3D 渲染场景」——模型导入打头阵（圆润真模型，box/plane 原语表达不了，是真缺口非重组）。纯 Three.js（零裸 WebGL），用 `three/addons` 的 `GLTFLoader`。
> **干净的边界切法（资产层零 three 依赖）**：glTF 解析产物是 three 场景图（渲染概念）。故**资产层只管「key → 取 `.glb` 字节(ArrayBuffer)」（零 three 依赖）**，`GLTFLoader.parse(bytes)` 留在 `ThreeRenderer`。
> **✅ 资产半边（`src/assets/`·owner 授权 P3D 落）**：`asset-types.ts` 加 `ModelDescriptor{kind:'model';key;src}`；`model-loader.ts`（新·`ModelAssetLoader` fetch→ArrayBuffer + `isModelHandle`·零 three）；`asset-manager.ts` 两处 exhaustive switch 补 `'model'`；`index.ts` 导出。测试 `model-loader.test.ts`。
> **✅ render 半边**：`Model3D` render-only 组件（`modelKey` + `scale?` + `tint?`·蓝图只持 key 不塞 URL/二进制）；登记三处（component-map / determinism `NON_DETERMINISTIC` / renderable）；`three-renderer` 按 modelKey 取 ArrayBuffer → `GLTFLoader.parse` 一次入模板缓存 → 多实例 clone（共享几何·每实例 clone 材质供染色/独立释放）→ 位姿走 Transform3D/盒庭落地面/2D 投影同套路 → 投/受软影；未就绪本帧不画（同 sprite 先例）。GLTFLoader 进 three-renderer code-split chunk。
> **✅ 端到端（game-z 真模型 + 截图回归）**：基础模型资产（Khronos glTF-Sample-Assets·`public/models/`·`duck.glb`+`box.glb`·许可见 `CREDITS.md`）；game-z 把方块换 `Model3D{modelKey:'duck'}`（可控）+ 静态 `duck-statue`（共享模板·多实例复用）；无头截图回归确认软影 + 自带材质渲出。**坑**：glTF 节点常带内建 scale，物体真实尺寸 ≠ 裸 accessor min/max → `Model3D.scale` 按**渲染后包围盒**定。

---

## 路线图记录（已做 / 待长）

- ✅ **数据组件基座**：`Mesh3D`/`Transform3D`/`Camera3D`/`Sky3D`（主程）+ `Model3D`（P3D·glTF 导入）+ `Light3D`（数据化光照·sun/ambient）+ `Post3D`（移轴/泛光后处理）——**P3D 已把光照 + 后处理数据化超额做出**。
- ⏳ **W1 高效低开销**（实例化 + 零浪费 + 静态跳渲）= 当前主线（见上）。
- 🔭 **待长**：可旋转交互（输入→`Camera3D.yaw/pitch`·render-only）；玩法（owner 解冻后）；UI↔世界锚（把世界特效锚到 UI 元素屏幕位·需要时一个通用 seam·别每游戏手写）。
