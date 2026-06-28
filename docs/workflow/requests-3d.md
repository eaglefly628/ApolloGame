# 3D 渲染线 · 需求 / 工单池（owner 2026-06-28 立独立池）

> **这是什么**：Apollo「3D 盒庭」渲染线 + Game Z 的**需求 / 工单单一真相**（从主 `requests.md` 分出·避免 3D 条目淹没在通用 UI/游戏需求里）。
> **归属**：3D 渲染线由 **P3D** 主管（代码边界契约见 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`）。本池由 owner/主程 派单、P3D 执行、Lead 评审标状态。
> **新 3D 需求都进这里**（不进 `requests.md`）；通用 UI 库 / 其它游戏需求仍进 `requests.md`。

---

## REQ-3D-W1高效引擎 · [2026-06-28] · owner → P3D（3D 渲染线）· status: **open（P3D 执行中）** · 类型: 设计纲领 + 真能力（实例化绘制）

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
