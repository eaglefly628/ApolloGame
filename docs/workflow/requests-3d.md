# 3D 渲染线 · 需求 / 工单池（owner 2026-06-28 立独立池）

> **这是什么**：ZeroCraft「3D 盒庭」渲染线 + Game Z 的**需求 / 工单单一真相**（从主 `requests.md` 分出·避免 3D 条目淹没在通用 UI/游戏需求里）。
> **归属**：3D 渲染线由 **P3D** 主管（代码边界契约见 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`）。本池由 owner/主程 派单、P3D 执行、Lead 评审标状态。
> **⭐ 3D 线定位（owner 2026-10-16 定）**：渲染**不与 Unity/Unreal 对抗**——渲染能力跟随 **three.js** 升级（自带功能 / 成熟开源库），本引擎只做数据外壳，不自研渲染算法。**3D 线的重点 = 整合业内工具链**：Tripo 生成模型 · Blender 规范化与搭建 · 生图模型定调 · 绑骨与动画流程。新 3D 工单按此准入（详 `docs/design/ai-pipeline-engine-roadmap-2026-10.md` 顶部裁决）。
> **新 3D 需求都进这里**（不进 `requests.md`）；通用 UI 库 / 其它游戏需求仍进 `requests.md`。

---

## REQ-3D-RENDER-BIND · 通用画面参数绑定（GAP-628-04） · [2026-10-26] · owner 判 A · **施工主体 = Codex / P3D（2026-10-26·本行即锁）** · status: 施工完·待独立复查（Claude） · P1
> owner 本聊天明确选择：火光 / 幻象等效果下沉通用能力，后续故事复用。实查与 A/B 成本见 game628 的 engine-readiness-2026-10-23 G1；不是给游戏加专属 system，也不扩 effect-apply 写渲染字段。
> spec：新增 render-only 闭集数据绑定，读 Resource 比例 / Flag / Signal，驱动同体 Light3D.intensity、Material3D.dissolve.progress、Vfx3D.rate、Glow3D.opacity；可声明缓动；hover来源为只在表现侧保存的指针状态，复用既有pick射线，移开/取消/失焦/销毁清理，不向sim发布纯视觉悬停信号。不能把DOM/游戏自由代码藏进绑定。解释器只读sim，使用独立表现覆盖，不改源组件、Signal消费或hash。materialRef重组必须保留本单绑定输出；dissolve须作用于导入GLB的逐实例材质，复用既有shader、不替换模板或误释放共享纹理。无绑定组件时保持原渲染路径。
> 必做：原始数据拒收 / 资源缺失与异常明确日志；多tick信号不丢、重复render不重播、回档/换世界/删除重建/销毁清理；逐实体材质与实例批隔离，缓动持续脏帧；NON_DETERMINISTIC、组件字典与manifest验证齐全；CPU行为、确定性、真实WebGL和至少两处唯一锚点撤修验红。
> 边界：3D协议组件与component-map/registry、确定性排除登记（不改hash算法）、3D渲染器/解释器及测试、必要的manifest校验/生成字典及纯表现输入接线、契约与3D手册。不得改game628玩法、其它游戏、2D/sim规则或UI域。实现后交非施工方复查，施工方不判PASS。

## REQ-3D-AI-PIPELINE · AI 协同生产流程的 3D 资产与运行时能力（T3 图生3D · T4 模型规范化 · T5 绑骨动作 · T7 Blender 桥 · E1 压缩加载 · E2 动作库+AnimGraph3D · E3 骨骼挂点 · E4 IK · E5 场景 glb 拆实体 · V1 提水壶竖切） · [2026-10-16] · owner 立（裁 A=自研引擎·不用 Unity/Godot·与 Tripo/Blender 正式整合·绑骨判 B=Blender+Auto-Rig Pro+Mixamo·付费 API/插件接受）→ **P3D**（T4/T5/T7/E5 主程面·协作） · 施工主体 = Codex（2026-10-18 抢锁·本行即锁） · status: V1离线整链已独立复查通过（施工74cdf9619·2026-10-21；E6已独立复查通过3730f2f66；E4已独立复查通过（施工acc1a4479）；E3已独立复查通过34199bb4f；E2已独立复查通过dd0374031；T5(+S3)离线能力已独立复查通过d137f4555，真实ARP/Mixamo/Tripo待验；T7/T3/T4/E1/R4/E5/R2已独立复查通过；V1正式付费来源与真人R1待验） · 优先级: P1 · 类型: 能力下沉
> 写死 spec（数据形状·验收·依赖·顺序）全文：`docs/design/ai-pipeline-engine-roadmap-2026-10.md` §1–§3。E 层全部 render-only·入 `NON_DETERMINISTIC`（E5 装载期展开除外·须双跑 hash 一致）。
> 原「交互与材质补全批」③ BlendSpace 由本单拉动转正（= E2）。复查人 ≠ 施工人。
> **2026-10-16 owner 追加（判 A）**：**E6 剧情镜头编排**（render-only `CameraShot3D`·镜头表 + 信号触发 + 缓动·路线图 §3.5 R3）并入本单；**T5 同单交付 S3**「人工步骤回灌手册」（Tripo 网页局部重生成 · Mixamo 下载 · Auto-Rig Pro 标记确认：人做完放哪、脚本怎么接回）。

<!-- REQ-3D-TESTGAPS（P3D 测试面五项）owner 2026-10-16 令**暂停出池**——全文查 git 历史（git log -S REQ-3D-TESTGAPS）·重启时恢复原文 -->

<!-- REQ-3D-RENDER-EFFICIENCY（渲染效率（部分已交·待 V1 实测再开））owner 2026-10-16 令**暂停出池**——全文查 git 历史（git log -S REQ-3D-RENDER-EFFICIENCY）·重启时恢复原文 -->

<!-- REQ-3D-W1高效引擎（W1 高效引擎（W1-E 健壮未做·与渲染效率合并重开））owner 2026-10-16 令**暂停出池**——全文查 git 历史（git log -S REQ-3D-W1高效引擎）·重启时恢复原文 -->

## 已归档条目索引（已结条目全文查 git 历史·归档层随 owner 2026-08-03 拍板删除）

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

## 路线图记录（已做 / 待长）

- ✅ **数据组件基座**：`Mesh3D`/`Transform3D`/`Camera3D`/`Sky3D`（主程）+ `Model3D`（P3D·glTF 导入）+ `Light3D`（数据化光照·sun/ambient）+ `Post3D`（移轴/泛光后处理）——**P3D 已把光照 + 后处理数据化超额做出**。
- ⏳ **W1 高效低开销**（实例化 + 零浪费 + 静态跳渲）= 当前主线（见上）。
- 🔭 **待长**：可旋转交互（输入→`Camera3D.yaw/pitch`·render-only）；玩法（owner 解冻后）；UI↔世界锚（把世界特效锚到 UI 元素屏幕位·需要时一个通用 seam·别每游戏手写）。
