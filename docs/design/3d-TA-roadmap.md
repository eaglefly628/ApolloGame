# Apollo 3D 渲染线 · TA（Technical Art）路线图

> **这是什么**：箱庭式 + 偏卡通风格 3D 游戏的**美术表现管线**单一真相。列清要从现代引擎泛化到我们这台轻量
> 数据驱动 3D 引擎上的 TA 能力、各自的数据组件草案、渲染器实现、优先级、归属与验收。
> **归属**：3D 渲染线 = **P3D** 域（render-only·不进 hash）。世界 UI 触 UI 库边界 → 知会主程（见 §5）。
> **owner 2026-06-28 拍板**：出此路线图、**一个个实现·每个做完 owner 确认效果再下一个**。
> 关联：`3d-baking-pipeline.md`（烘焙·归档待启）、`requests-3d.md`（工单池）、`data-driven-manifesto.md`（宪法）。

---

## 0. 统领判断：render-only = 「无确定性枷锁」的表现特区

整条 3D 渲染线 **render-only·不进 hash**。sim 那边为跨机逐位一致连 `sin/cos` 都不敢用；TA 这条线**完全自由**——可用时间、`Math.random`、GPU、逐帧 delta。这是超能力不是限制：现代引擎的炫特效搬过来，**唯一纪律是 ①数据驱动 ②预算可控**，不是确定性。

---

## 1. 架构原则（五条·贯穿所有 TA 能力）

1. **render-only·单向绑 sim**：VFX/灯/后处理/世界 UI **读** sim 事实（实体死→爆 burst、HP→血条）触发表现，**永不写 hash**。一条干净单向流。
2. **闭集「模块」词汇表**（Niagara 该被泛化的部分）：搬其**数据模型**（spawn/velocity/force/color/size… 模块堆叠的组合力），**不搬** GPU compute 后端。每个模块是**数据描述、渲染器解释**——守住「最弱 LLM 也能产出同样数据」（不让它写自由 update 代码）。
3. **曲线/渐变是一等数据**：尺寸随寿命、颜色随寿命、光照闪烁、材质渐变……全建在可复用的 `Curve`/`Gradient` 原语上。**TA 线的真地基。**
4. **预算入数据**：粒子数、灯数、Volume 数、贴花数都有**数据上限**（owner「效率可考虑下支持一两个就够」→ 写进组件/渲染器 cap）。
5. **数据组件 + 渲染器 pass，不写游戏代码**：每件 = 加 render-only 组件 + 渲染器加一个解释 pass。游戏层只摆数据。

---

## 2. 能力清单（分阶段）

> 每条：**缺口 / 数据组件草案 / 渲染器 / 归属 / 工作量 / 依赖 / 验收**。组件名为草案，落地时定稿。

### Phase 0 · 地基：曲线 / 渐变原语 ⭐先做
- **缺口**：无任何随寿命/随时间的参数演化表达。
- **数据**：`Curve`（关键点 `[{t,v}]` + 插值模式 linear/step/smooth）、`Gradient`（`[{t,rgba}]`）。纯数据小类型，跨 VFX/材质/灯/后处理复用。
- **渲染器**：`sampleCurve(c,t)` / `sampleGradient(g,t)` 纯函数（render util）。
- **归属**：P3D。**工作量**：S（半天）。**依赖**：无。
- **验收**：单测采样正确；被 Phase 1 VFX 消费。

### Phase 1 · VFX 模块系统（Niagara-lite）⭐主体
- **缺口**：完全没有粒子/特效。
- **数据**：`Vfx3D`（挂实体·跟 Transform3D/世界点）= 闭集模块组合：
  - emit（rate / burst / 寿命）· shape（点/锥/球/盒发射）· init velocity（方向锥 + 速度范围）·
    force（重力/阻尼/涡流）· size-over-life（Curve）· color-over-life（Gradient）· sprite（贴图 + 混合 additive/alpha）· space（world/local）· loop/once。
- **渲染器**：`VfxSystem`——池化 + **InstancedMesh/Points** CPU 模拟（几千粒子级·非 GPU compute）。预算 cap（总粒子上限）。
- **归属**：P3D。**工作量**：L。**依赖**：Phase 0。
- **验收**：game-z 放 1–2 个发射器（落点尘土 / 触发区魔法环 / 追兵被抓爆点）；截图见效果；render-only 不进 hash（改 VFX 不变 world hash 的测试）。

### Phase 2 · 动态点 / 聚光灯（1–2 盏·够用）
- **缺口**：`Light3D` 只有 directional + ambient。
- **数据**：`Light3D.kind += 'point' | 'spot'`（pos 可由行为层每帧改→**移动点光**；point：color/intensity/range/decay；spot 加 angle/penumbra/dir）。可选 `flicker`（Curve·闪烁/呼吸）。
- **渲染器**：扩 `LightRig`；**预算 cap = 2 盏动态点/聚光**；点光阴影贵→默认**无影点缀光**、最多 1 盏带影（可选）。
- **归属**：P3D。**工作量**：M。**依赖**：Phase 0（flicker 用 Curve）。
- **验收**：game-z 一盏跟随的暖色点光（如挂在追兵/一个发光 orb）移动照亮周围；截图。

### Phase 3 · 世界空间 UI
- **缺口**：UI 只能屏幕 HUD；无头顶血条/名字/飘字/世界招牌。
- **数据**：`WorldUI3D`（锚=实体或世界点 + 一棵 **LayoutNode** + 模式 billboard/surface + 缩放/朝相机）。**仍走 UI 库 LayoutNode·不破铁律**。
  - 形态 A **billboard**（屏幕空间贴世界点）：血条/名字/「!」/飘伤害。复用 LayoutNode 渲染器 + 一次世界→屏幕投影。
  - 形态 B **surface**（场景内贴图面片）：招牌/终端屏。LayoutNode 渲到贴图、贴 Mesh3D 面片，受透视/遮挡/光照。
- **渲染器**：投影锚点（billboard）/ LayoutNode→CanvasTexture→quad（surface）。
- **归属**：**P3D 做世界锚 + 投影/贴面**；**LayoutNode 控件归主程 UI 库**（缺控件→知会主程·见 §5）。**工作量**：M（先 billboard）。
- **验收**：game-z 小黄鸭/追兵头顶 billboard 名字或状态条随相机旋转正确贴位；截图。

### Phase 4 · 全局后处理栈 + Post Volume
- **缺口**：仅移轴+泛光（已撤）；无 AO/AA/雾/调色；无区域 Volume。
- **数据**：扩 `Post3D`（或拆 `Grade3D`/`Fog3D`）——**AO（SSAO/GTAO）· AA（SMAA/FXAA）· 雾（距离/高度）· 调色（曝光/对比/饱和/冷暖/提黑 或 LUT）· 自适配移轴 DoF（焦带随世界尺度/主体）**。`PostVolume3D`（bounds + 一套 Post 设置 + 优先级）按相机位置**混合**。
- **渲染器**：扩 `PostPipeline`（加 pass）；Volume 混合器。
- **归属**：P3D。**工作量**：AO/AA/雾/调色各 S–M；Volume M；自适配 DoF M。**依赖**：调色可用 Gradient。
- **验收**：分项截图（AO 接触阴影、雾纵深、调色情绪、DoF 不再整屏虚）；Volume 进区域后处理切换。
- **顺序内**：先全局四件（AO→AA→雾→调色），**再** Volume，**最后**自适配 DoF 重加。

### Phase 5 · 材质参数化（toon ramp / 软 PBR）
- **缺口**：所有盒子同一哑光标准材质 + 面色，无法美术定向。
- **数据**：`Material3D`（roughness/metalness/emissive/贴图/法线 **或** toon ramp（Gradient 当 cel 阶梯）+ rim）。
- **渲染器**：材质工厂按数据建（MeshStandard 参数化 / MeshToon + ramp）。
- **归属**：P3D。**工作量**：M。**依赖**：Gradient（ramp）。
- **验收**：同一盒子切 toon ramp vs 软 PBR 对比截图。

### Phase 6 · 离线烘焙 AO / lightmap（启用归档设计）
- **缺口**：静态箱庭无烘焙软 GI/AO（最省的成片厚润感）。
- **数据**：构建期生成 → 提交为数据（贴图/顶点色），运行时只读（render-only·或当 sim 也确定，因离线烘一次）。
- **归属**：P3D + 资产层（owner 已授权）。**工作量**：L。**依赖**：`3d-baking-pipeline.md`。
- **验收**：静态盒庭烘 AO 前后对比；运行时零额外开销。

### 附 · 小件（穿插做·都极便宜）
- **相机震屏/冲击**（命中反馈·render-only）。**贴花/投影器**（地面血迹/标记/假阴影）。**vignette+颗粒**（取景·并入 Post）。

---

## 3. 轻引擎红线（明确**不做**的，除非 owner 另拍）
- ❌ GPU compute 万级粒子（Niagara 后端）→ 用 CPU-instanced 几千级。
- ❌ 全 IBL/SSR/CSM 那套重写实管线 → 走 stylized-cheap（AO/雾/调色/toon ramp/半球光）。
- ❌ 超过预算的动态光（>2 盏动态点/聚光、>1 盏点光阴影）。
- ❌ 游戏层手写特效/材质/UI 代码 → 一律数据 + 渲染器解释。

---

## 4. 执行节奏（owner 2026-06-28）
**一个个来。每个能力做完 → 截图给 owner 确认效果 → 确认后再起下一个。** 全绿（tsc+vitest+build+截图）才推。

> **进度（P3D 2026-06-28·GameZ 试验场）**：✅ Phase 0 曲线/渐变 · ✅ Phase 1 VFX 粒子 · ✅ Phase 2 动态 point/spot 局部光（预算 2·可移动） · ✅ Phase 3 世界 UI 头顶飘字（billboard·走 LayoutNode） · ✅ Phase 4 起步 **AO 环境光遮蔽**（GTAO·Post3D.ao·接触阴影）。另：✅ collision-resolve-3d（owner 插队·让角色真撞墙）。⬜ 续：雾/调色/AA → Post Volume → 自适配移轴 DoF → 材质 ramp → 烘焙；世界 UI surface 形态/动态绑定（HP）待续。

推荐顺序：**Phase 0 曲线/渐变 → Phase 1 VFX → Phase 2 动态点光 → Phase 3 世界 UI(billboard) → Phase 4 全局后处理(AO/AA/雾/调色)→Volume→自适配DoF → Phase 5 材质 ramp → Phase 6 烘焙**。小件穿插。

## 5. 与主程的边界（UI 铁律）
世界 UI 的 **LayoutNode 本体 = 主程 UI 库（`ui/components`）**；P3D 只做「世界锚 + 3D 投影/贴面」这层渲染。**世界 UI 若需新 LayoutNode 控件 → 写 `requests.md` 让主程扩**，P3D 不手写 React/自由 DOM。开 Phase 3 前先与主程对齐这条接缝。
