# 3D 渲染线 · 需求 / 工单池（owner 2026-06-28 立独立池）

> **这是什么**：Apollo「3D 盒庭」渲染线 + Game Z 的**需求 / 工单单一真相**（从主 `requests.md` 分出·避免 3D 条目淹没在通用 UI/游戏需求里）。
> **归属**：3D 渲染线由 **P3D** 主管（代码边界契约见 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`）。本池由 owner/主程 派单、P3D 执行、Lead 评审标状态。
> **新 3D 需求都进这里**（不进 `requests.md`）；通用 UI 库 / 其它游戏需求仍进 `requests.md`。

---

## REQ-3D-程序化 normal/roughness 贴图 · [2026-06-30] · owner（选「程序化生成」） → P3D（TA Phase 5） · status: **✅ done（P3D 2026-06-30·已推）** · 类型: 渲染能力补全（PBR 表面细节·零美术文件）

> **owner 选型**：normal/roughness 走**程序化生成**（非美术贴图资产）——同「天空盒按 Sky3D 数据程序化生成纹理」先例·零美术管线依赖·弱 LLM 能填参数。
>
> **✅ 落地（全 render-only·P3D 渲染线域）**：
> - **数据** `Material3D.surface?: SurfaceDetail`（`render.ts`·render-only·不进 hash）：闭集 `pattern`('bumps'|'noise'|'scratches') + `tiles`/`normal`/`rough`/`scale` 标量。
> - **生成器** `renderer/three/surface-tex.ts`：`buildSurfaceMaps` 据参数**确定性**生成 normal + roughness `DataTexture`（128²·value-noise/fbm/sin·无随机 → 同参数同图·稳定不闪）。法线由高度场环绕中央差分求（平铺无缝）；roughness 凸光凹哑×材质 base。线性数据贴图（非 sRGB）。
> - **接入** `material.ts`：`buildPbrMaterial(def, surface?)` 挂 `normalMap`/`normalScale`(=surface.normal·运行时可调不重生)/`roughnessMap`；`pbrSig` 纳入 surface；`disposeMesh` 释放生成贴图。
> - **demo**：陈列台给岩石(noise 凹凸)/土/木(scratches 木纹)/钢(拉丝)/金(bumps 锤打) 挂 surface → 截图明显浮雕，无 surface 的(哑光/塑料/铁/铜/玻璃)仍光滑。
> - 测试 `surface-tex.test`(4·尺寸/wrap/repeat·法线 Z 朝外·确定性逐字节·bumps 有浮雕)。tsc+vitest(1972)+build 全绿。
> - **⬜ 待续**：法线强度 `normal` 现走 normalScale（运行时调）；要更多图案（grid/voronoi 砖纹）或真实贴图按 key 加载（标准 PBR 工作流）按需再加。

---

## REQ-3D-真物理模拟（色子/表现物理·cannon-es） · [2026-06-30] · owner → P3D · status: **✅ done（P3D 2026-06-30·cannon-es·已推）** · 类型: render-only 表现能力（刚体物理）

> **owner 拍板（2026-06-30·提前到现在做·「马上要用」）**：做**色子真物理模拟**——**为表现非同步**（滚色子读朝上/画面用途·不需两边一致·要一致就单机）。**「用现成物理库·别自己开发·要简化点的」** → 选 **`cannon-es`**（纯 JS/TS·无 WASM 异步·three.js 圈轻量刚体标配·正好「简化」；Rapier 更强但 WASM 重·表现色子用不上）。
>
> **✅ 落地（全 render-only·P3D 渲染线域·cannon-es 仅在 renderer/three 下 import → 进 3D chunk·2D 游戏不连带）**：
> - **数据** `RigidBody3D`（`render.ts`·**render-only·入 NON_DETERMINISTIC·不进 sim/hash**）：shape/mass/restitution/friction/初速/初角速。体形尺寸取同实体 Mesh3D。+ `Transform3D.quat`（可选四元数·物理翻滚无万向锁）。登记 component-map。
> - **子系统** `renderer/three/physics.ts` `PhysicsSystem`：cannon `World`(重力-42)+静态地面 Plane·每帧步进 → 把刚体位置+四元数写回 `Transform3D`（render-only）→ 渲染器照常画（`applyPose` quat 路径）。睡眠优化（停稳就睡）。活跃刚体数折进 renderSig 持续重渲。
> - **接入** `three-renderer`：sync 顶部步进（collect 前）；`rollDice()`（按钮调·置位 → 下帧重掷=抬高+随机翻滚·render-only 随机自由）；destroy 释放。
> - **demo**：game-z 三颗塑料色子（红/蓝/绿·中心区）掉落翻滚停稳；调试面板「🎲 掷骰子（真物理）」按钮重掷。截图：色子从空中落定（随机朝向）→ 点按钮重掷→再翻滚落定。
> - 测试 `physics.test`(3·重力下落+落地不穿地+写 quat·无刚体返回 0·RigidBody3D/Transform3D 不进 hash)。tsc+vitest(1975)+build 全绿。**新依赖 `cannon-es@0.20.0`**（render-only·进 3D chunk）。
> - **⬜ 待续**：① 色子点数面（pip 贴图/读朝上面 → 输出结果·按需）；② 刚体间互撞（现各自落地·要堆叠/碰撞加 broadphase 调参）；③ 若要进 sim（确定性物理）须换定点/同步方案——owner 言明暂不需要。

---

## REQ-3D-关卡重构「永远追逐」+ 杂项（去腐/大字/Toggle 绕过） · [2026-06-30] · owner → P3D（Game Z 域） · status: **✅ v1 done（P3D 2026-06-30·已推）** · 类型: 关卡数据重构 + 体验修

> **owner 拍板（2026-06-30·多条合并）**：把 game-z 关卡重设成「**永远追逐**」——鸭子 AI 在前面自动跑、追兵在后追逐、一切动态；缩小场景、去掉低画质绿尖塔林、材质陈列台字号放大；并复诉「所有开关型 UI 视觉点击不变」的 bug。
>
> **✅ v1 落地（纯数据 + 运行时胶水·零专属 system）**：
> - **永远追逐玩法**：鸭子(hero) **AI 绕环形赛道自动跑**（game-z.ts `autoRun` 胶水·每帧把 Velocity 设成赛道切线 + 拉回半径 TRACK_R=30·**同 WASD 输入胶水先例**·WASD 可接管）；**三只追兵**(`NavAgent` + `Relation target=hero`)循自动烘焙 NavGraph 一路追（速度略低 → 永远追不太上）；**相机跟随鸭子**(`mode:'follow'`)。截图验证：鸭子 t3→t8 绕跑移位、追兵尾随。
> - **关卡去腐 + 缩小**（owner「缩小一半 + 去绿尖塔林·画质 low」）：删 `forest()`(~320 尖塔)/蘑菇/鹅卵石径/Toad/静态鸭/平台/迷墙/斜墙等纯装饰；地台 240²→**160²**；保留**有碰撞体**的障碍（内圈三石墩 + 外圈四石柱·部分 PBR 钢/铜）+ 中心金属信标(gold)+魔法喷泉 VFX。
> - **材质陈列台**：保留（北侧·材质球·IBL 反射）；**标名字号 xs→md**（owner「字太小」）；「🔬 看材质陈列台」机位按钮照旧。
> - **⚠️ Toggle 视觉点击不更新——game-z 侧绕过**（根因是主程 UI 库 bug·已记 `requests.md` REQ-UI-BUG-Toggle视觉点击不更新）：点 Toggle 后其隐藏 checkbox 抢焦点 → UI 库 reconcile「焦点保护」误跳过重建。**绕过 = 改态后先 `document.activeElement.blur()` 再 `menuUi.update()`**（解焦 → 面板正常重建反映新 checked）。截图验证：点「AO 遮蔽」开关绿→灰、从属滑块随之显隐。**根治仍待主程改 server.ts。**
> - 测试：`diorama.test` 改测追逐关卡（鸭子胶囊 + 追兵 NavAgent/Relation + 障碍 box 碰撞 + 三追兵 target=hero + 信标 gold）。tsc+vitest(1968)+build 全绿。
> - **⬜ 待续**：① **关卡流式加载（streaming·往右动态加载）= owner 要的下一大块·真能力缺口·需设计**（见下「流式加载提案」）；② 程序化 normal/roughness 贴图（owner 已选「程序化生成」·排队中）；③ 鸭子自动跑现为运行时胶水（含 trig·单机测试台 OK·若上多人 lockstep 需下沉成确定性 capability）。

> **🔭 流式加载（streaming）提案（待 owner 确认再做）**：owner 以为「three 已有 streaming 能力」——**澄清：引擎暂无关卡流式能力，是真缺口**。按数据驱动宪法评判=**该做但需设计**（关卡块=数据·加载器=固定解释器）。关键设计点（**determinism**）：关卡块若带碰撞体/寻路体（sim·进 hash），流式增删实体必须**逐 tick 跨端一致**（否则 lockstep desync）——故触发条件须取**确定性 sim 量**（如鸭子前进距离），不能取 render-only 相机。建议形态：`StreamChunk` 数据（块蓝图 + 沿 +X 的区间）+ `chunk-stream` capability（按鸭子 X 距离确定性地 spawn 前方块 / despawn 后方块·对象池复用）。**先确认要不要做 + 单机够不够（单机可放宽 determinism）再开工。**

---

## REQ-3D-材质测试台（IBL 环境光 + 材质陈列板·「我怎么测材质」） · [2026-06-30] · owner → P3D（3D 渲染线·TA Phase 5） · status: **✅ done（P3D 2026-06-30·IBL + 11 预设陈列台·截图验证·已推）** · 类型: 渲染能力补全（金属反射缺 IBL）+ 测试台数据

> **背景**：owner 问「我怎么测这个材质？」。PBR 金属/玻璃**没有环境贴图就乌黑死板**（金属本色=反射环境·无环境可反射→近黑）——这是材质看不出效果的根因，不是预设数值问题。
>
> **✅ 落地（全在 P3D 渲染线域）**：
> - **IBL 环境光照（真能力补全）**：`Sky3D` 加 `env?: number`（IBL 强度·render-only·缺省 0=不装·向后兼容）。渲染器 `syncEnv`：`env>0` → 懒建一次中性影室 `RoomEnvironment` 烘成 PMREM → `scene.environment` + `scene.environmentIntensity`（数据驱动·变才写·destroy 释放）。金属/玻璃自此有反射成像。中性 studio 环境与 sky 色解耦·稳定可预期（材质测试要的是基准光照·非场景天色干扰）。
> - **材质陈列台（纯数据·测试台）**：`diorama` 加 `materialBoard()`——北侧独立石台一排 11 个样品块，每块挂一种闭集预设（哑光/塑料/岩石/土/木/钢/铁/金/铜/玻璃/自发光）+ 头顶飘字标名（WorldUI3D）。样品转 45° 让两面各吃一侧反射（更显金属/粗糙度差异）。零专属代码：样品 = `Mesh3D` box + `Material3D{preset}`。game-z 默认相机可拖向北看陈列台。
> - **验证**：临时把相机对准陈列台截图——金属（钢/铁/金/铜）IBL 下呈金属反射（金=金色、铜=铜色、钢/铁=暗金属），玻璃半透，介电（岩石/土/木）显本色；标名飘字到位。tsc+vitest(1967)+build 全绿。
> - **✅ 追加（owner 2026-06-30·同日）—— 材质球 + 实测参考值 + 看材质机位**：
>   - **`sphere` 基元（真能力补全·过 geometry 管线）**：`Mesh3D.shape` 加 `'sphere'`（box/plane→+sphere·width=直径）。接全管线：`geometry.ts`（`buildMesh3D`/`buildInstancedMesh3DGeometry` 新 `sphereGeo`·单色烤）、`three-projection`（`mesh3dDepth`/`mesh3dBatchKey` 认 sphere·同直径同色归一批）、`material.ts buildPbrMesh3D`（高段 SphereGeometry·反射顺滑）。+2 纯函数测（depth/batchKey sphere）。**球比方块显材质好得多**（高光/粗糙度/反射差异），业界材质球惯例。陈列台样品换成材质球。
>   - **金属 base color 换 Filament 实测 sRGB 参考值**（owner「从现代引擎里找」）：`pbr-materials.ts` 金 0xFFD991(1.00,0.85,0.57)·铜 0xF7BD9E(0.97,0.74,0.62)·钢 0xC4C7C7(Filament 铁色)·铁 0x9A9DA0(铸铁暗档)；介电 albedo 取实测（橡木/花岗岩/干土）。来源注 Filament Materials guide。截图：金/铜/钢/铁四金属在 IBL 下各自正确反射、玻璃透、介电哑光。
>   - **「看材质陈列台」机位按钮（render-only 写 Camera3D）**：调试面板加 `Button`「🔬 看材质陈列台」/「🏠 回总览」（UI 铁律·LayoutNode Button·action 经 handler 写 `Camera3D` 机位预设 `BOARD_CAM`/`HOME_CAM`·退 follow）。一键正对陈列台看清材质。截图验证 11 球清晰排开。
> - **⬜ 待续（按需·非本次）**：① IBL 来源可选 sky 派生（现中性 studio·够用）；② 法线/粗糙度/金属度贴图精修（现纯参数）；③ 调试面板加 PBR 参数实时调；④ 更多金属预设（银/铝/铬·Filament 表已有值·按需加）。

---

## REQ-3D-BUG-后处理黑屏（AO/分级脏数值） · [2026-06-30] · owner 报 → P3D（3D 渲染线·后处理域） · status: **✅ fixed（P3D 2026-06-30·根因定位 + 渲染器 finite 兜底 + 面板域修正 + 回归测试·已推）** · 类型: 渲染健壮性 bug（脏数值喂 shader → 整片黑屏）

> **现象（owner 2026-06-30）**：「AO 强度的时候，屏幕动一下，屏就全黑了」「要改任何东西都会改，对比改那个也会黑屏」。即调试面板拖滑块改后处理参数后 → 3D 画面整片黑（HUD/世界飘字等 DOM 叠层仍在·只 WebGL 黑）。
>
> **根因（无头 Chromium 稳定复现 + 逐层 bisect 定位·非 GPU 玄学）**：链条 = **UI 库 Slider 偶发回调 `undefined`（见 `requests.md` REQ-UI-BUG-Slider回调偶发undefined）→ `Number(undefined)=NaN` 写进 `Post3D.ao.intensity` → `PostPipeline` 直传 `gtao.blendIntensity=NaN` → GTAO blend `mix(1,ao,NaN)=NaN` → 整片黑**。
> - **次因（即便不 NaN 也危险）**：`blendIntensity` 是 AO 的**不透明度 [0,1]**（0=不施加·1=全施加），**非强度倍率**。GTAO blend = `1 − intensity·(1−ao)`，`intensity>1` 让有遮蔽处(ao<1)算出负值→钳 0→黑。原面板「AO 强度」滑块范围 0..3、默认 1.1，**本就探进危险区**。
>
> **✅ 修法（全在 P3D 渲染线域·`renderer/three/**` + `games/game-z/**`）**：
> - **渲染器 finite 兜底（真·能力修·健壮性铁律）**：新 `renderer/three/num-guard.ts`（`clamp01`/`posOr`/`fin` 纯函数）——`PostPipeline.render` 喂 GPU 前，AO `intensity` 钳 [0,1]·NaN→1，`radius`/`scale` 取正·NaN→缺省；分级 `exposure/contrast/saturation/brightness` 全 finite 兜底。**渲染器绝不把 NaN/超界喂进 shader**（弱 LLM 写脏数据 / UI 抖动都不黑屏）。
> - **面板域修正**：「AO 强度」滑块范围改 0..1（其合法域）、默认 0.85；`diorama` 初值 1.1→0.85；滑块 handler 只接受 `Number.isFinite` 值（脏回调丢弃·与渲染器兜底双保险）。
> - **回归测试** `num-guard.test.ts`（3·NaN/undefined/超界→安全回退）。tsc+vitest(1965)+build+无头截图全绿（拖滑块至上界 + 转相机不再黑）。
> - **连带产出**：定位过程挖出两个 UI 库（主程域）bug，已记 `requests.md`：① **Toggle 视觉点击不更新**（owner 同日另报·`reconcile` 焦点保护误伤 Toggle）；② **Slider 回调偶发 undefined**（本黑屏的上游触发源）。

---

## REQ-3D-Nav 导航网格自动烘焙（寻路数据 + 寻路碰撞·game-z 验证） · [2026-06-28] · owner → P3D（owner 授权跨界·**复用主程 pathfind**） · status: **✅ done（P3D 2026-06-28·自动生成·复用主程 NavGraph·端到端验证·已推）** · 类型: 真能力缺口（碰撞几何→可走拓扑**自动生成**）

> **⚠️ 知会主程（owner 2026-06-28 拍板·关于你的 `REQ-寻路`）**：owner 要 game-z 验证「寻路数据 + 寻路碰撞」。你的 `pathfind`（航点图 NavGraph + 通用 A* + 沿路跟随 + collision-resolve 避让）很好，**我全盘复用、一行没改**。唯一分歧：owner **不接受手摆 NavGraph**（「我摆这些东西太麻烦了，也没有手摆需求……一定要像 Recast 这样自动生成」）。结论 = **不取代你的 runtime，只在它上游加一层「自动生成 NavGraph」**：
> - **共存（owner「不能共存吗」）**：场上摆 `NavMesh`（范围+格边长+半径）→ `navmesh-bake` 自动烘 `NavGraph`；只摆手写 `NavGraph`（无 NavMesh）→ 烘焙不动、用你的手摆图。**二选一·同一下游 pathfind**。
> - 你那段 `NavGraph`/`NavAgent`/`NavPath`/`pathfind`/`astar.ts` **保持不变**；手摆路径仍可用（你若不需要可不管）。本 REQ 不动你的代码。
>
> **✅ 落地（P3D 2026-06-28·已推）—— 自动生成（Recast 思路·确定性轻量版）**：
> - **新组件** `NavMesh`（`spatial.ts`·烘焙配置·单例：范围矩形 + 格边长 + agentRadius·进 hash）。注册 `assembly/component-map.ts`。**作者零手摆航点**——只圈个范围。
> - **纯函数核** `engine/spatial/navmesh.ts`：`gridFromBounds` + `rasterizeBlocked`（障碍 AABB→封格·「寻路碰撞」）+ `bakeNavGraph`（可行走格→**主程 NavGraph 结构**：节点=空格中心、八向边·斜边防穿角）。整数化·跨端逐位确定。
> - **能力** `skills/atoms/navmesh-bake`：读 `NavMesh` + `Collider3D` → 写**主程的 `NavGraph`**（每帧重烘·rollback 安全）。排除 trigger / NavAgent。`runsBefore nav-follow + motion-apply`（图先就绪 + 破 Transform 环）。
> - **下游零改**：主程 `pathfind`(`nav-follow`) 照常读 NavGraph → A* → 写 Velocity → `motion-apply` 走动。
> - **debug 可视化（P3D 渲染线域）** `renderer/three/nav-debug.ts`（render-only）：青点=航点（没点处=被碰撞封住）+ 暗青线=连边 + 黄线=`NavPath` 规划路径。接入 `three-renderer`（`setDebugNav`）。
> - **game-z 验证**：`NavMesh` 罩草地台 + 三石墩障碍（`obstacle()`·碰撞+寻路双用）+ 橙盒追兵（**主程 `NavAgent` + `Relation(target=hero)` + `Velocity`**）→ 自动绕障碍逼近小黄鸭。菜单加「🧭 导航网格」+ N 键。截图：青点网格自动避开所有碰撞体、追兵沿黄线绕行。
> - **扩充关卡 + 多 agent 蛇形迷墙（owner 2026-06-28「扩充一倍 + 加寻路碰撞展示」）**：地台 70²→**100²**（NavMesh/相机随扩）；加四角石柱 + **两道交错长墙（各留缺口）的蛇形迷墙**；**第二个追兵**（蓝盒·从 100² 远端出发·必须穿迷墙两缺口）→ 展示长程绕路 + 多 agent 同时寻路。**烘焙器改进**：排除带 `Velocity` 的动态体（玩家/追兵不当静态障碍·不在自己导航上挖洞·`runsBefore motion-apply` 已保序）。+1 测（动态体不烘进图）。
> - **测试**：`navmesh.test`(5·栅格化/封格无节点/防穿角/确定性) + `navmesh-bake.test`(4·**端到端绕墙不穿墙**[配主程 pathfind] + **共存：无 NavMesh 不烘** + 两世界 hash 一致)。tsc+vitest+build+截图全绿（主程 `pathfind`/`astar` 测试一并跑绿·未碰你的代码）。
> - **⬜ 待续（按需）**：静态障碍只在变更时重烘（现每帧·盒庭够）；多边形 navmesh（现栅格·真要更强壮再升）；动态体避让走主程 collision-resolve（game-z 暂无 2D resolve·靠图拓扑静态避障已够）。

---

## REQ-3D-Collision 3D 逻辑碰撞（触发/重叠·升维 2D） · [2026-06-28] · owner+P3D → 主程（sim/能力域评审） · status: **🚧 P1 + debug 线框/可点击菜单 + P2(精简 hull·凸多面体 SAT) 已落（owner 2026-06-28 授权 P3D 跨界落·知会主程评审）；P3 物理表现轨待（YAGNI）** · 类型: 真能力缺口（3D 逻辑碰撞·升维复用）

> **⚠️ 知会主程（owner 授权 P3D 跨界落 sim·同资产层先例）**：本 REQ 的 sim 半边落在你的域（`engine/spatial` + `skills/atoms` + sim 组件 `spatial.ts`）——**owner 2026-06-28 当面授权 P3D 实现 P1**。改动**严格镜像 2D 碰撞**（同确定性纪律：只用 +−×÷/sqrt/min/max·无 sin/cos/hypot），**进 hash·rollback 安全**，不碰 2D 碰撞代码。请评审；如与并行改动撞 rebase 喊我。
>
> **✅ P1 已落（P3D 2026-06-28·已推）**：
> - **数据**：`Collider3D`（sphere/box/capsule·进 hash·`spatial.ts`）+ `Overlap3D`（重叠事件）。确定性位置模型：**planar 取 2D `Transform`(进 hash·x→X、y→Z)，垂直/形状取 `Collider3D`(进 hash)——不碰 render-only `Transform3D`**。胶囊限竖直(Y 轴·角色标准)→ 各测试退化「XZ 距离 + Y 区间」全解析。
> - **窄相位**：`engine/spatial/contact3d.ts`（纯函数·镜像 2D `contact.ts`·确定性）——球/盒(AABB)/竖直胶囊两两接触 + 法线/深度。
> - **能力**：`skills/atoms/overlap-detect-3d`——每帧重建（按 id 升序）+ **暴力 N² AABB 宽相位**（轻量盒庭够·升维树是 scale 路）+ 窄相位 → 产 `Overlap3D`。
> - **demo**：game-z 加 `overlapDetect3dCapability` + hero `Collider3D` 胶囊 + 触发区 zone（半透明绿垫 Mesh3D[render] + `Collider3D` box trigger[sim]·同 2D Transform 驱动渲染+碰撞）；HUD 读 `Overlap3D` 亮「🔔 触发区」。截图验证。
> - 测试：`contact3d.test`(7·含 **Y 分离不重叠** 真 3D + 确定性逐位) + `overlap-detect-3d.test`(3·含 **Collider3D 进 hash** 验证 + 触发进出) + diorama 碰撞。tsc+vitest(1886)+build+截图全绿。
> - **✅ debug 线框可视化（P3D 渲染线域·提案 §边界「P3D 天然拥有的那块 ①」已落）**：`renderer/three/collider-debug.ts`（新·`ColliderDebug` 类·render-only·池管理·只读 world 不写 sim）——读 sim `Collider3D`+2D `Transform` 画线框（box→Box·sphere→Sphere·竖直 capsule→Capsule·**位置映射严格同 `contact3d`**：planar 取 Transform、垂直取 Collider3D `baseY/height`）；trigger=绿、实心=黄；`MeshBasicMaterial wireframe`。接入 `three-renderer` `sync`（`setDebugColliders(on)` 开关 + renderSig 失效重渲）。**可点击菜单**（owner 2026-06-28 加需求）：game-z 左下 `pointer-events:auto` 独立宿主 + `LayoutNode` `Button`（action `toggleDebug` 经 mountUI handler 入队·**UI 铁律**·无自由 DOM/CSS 逻辑）+ `C` 键快捷。截图验证（hero 胶囊线框 + zone 盒线框 + 按钮 ON）。
>
> **✅ P2 已落（P3D 2026-06-28·owner 批「现在落精简 hull+3D SAT」·已推）—— 评审后大幅重定范围，回驳原 P2 三件中的两件半**：
> - **架构评审先行（CLAUDE.md 核心规则 #2）**：读 2D `contact.ts` 发现本引擎**从不在运行时旋转碰撞体**（`contact.ts:7`「无旋转」）——2D 表达「转过的盒」是用 `polygon` + **预烘焙顶点**（world 顶点 = 局部顶点 + 平移·不乘旋转矩阵），数据层就解了 sin/cos 确定性难题。据此回驳：
>   - **OBB（按角度）→ 回驳**：算朝向基底需 sin/cos → 破坏跨机逐位确定（2D 正为此绕开）；「转过的盒」功能上 = 凸包顶点 / 或 AABB 拆分（manifesto C-档），可重组。
>   - **cylinder → 回驳**：角色 XZ 阻挡上圆柱≈胶囊（只差平顶/圆顶）→ 功能等价 capsule·YAGNI。
>   - **GJK+EPA → 回驳为当前形态**：对「渲染轻引擎」过度复杂（owner：不要过度复杂·不能特别费）；SAT 对有界顶点凸包直接给穿透深度·复用 2D `satPolyPoly`/`satPolyCircle` 心智模型即可。GJK 是规模路·真撑爆顶点数再说。
> - **落地（唯一站得住的精简形态）**：新碰撞体档 `hull` = **预烘焙局部顶点 + 面法线轴**（`Collider3D.verts`/`axes`·照搬 2D `polygon` 套路·运行时只平移不旋转·无 sin/cos）。一举吃掉「OBB」的**正确**表达（转过的盒 = 8 顶点 hull）+ 任意凸关卡块/斜坡/斜墙。
>   - **窄相位**：`engine/spatial/sat3d.ts`（新·确定性 3D SAT）——`satPolyPoly3`（A 面法线 ∪ B 面法线 ∪ **边×边叉积轴** → 盒/OBB 精确 15 轴）+ `satPolySphere3`（面法线 ∪ 最近顶点→球心·镜像 2D `satPolyCircle`）。只用 +−×÷/sqrt + 叉积·**无三角函数**。
>   - **接入** `contact3d.ts`：hull 介入 → SAT 路；其余保持 P1 解析（**逐位不变**）。胶囊 vs hull = 段上取离 hull 心最近 Y 的单球（轻量·保守·够角色站台/撞墙）。
>   - **debug 线框**：`collider-debug.ts` 加 hull（`ConvexGeometry` 从顶点重建·render-only）。
>   - **demo**：game-z 加 `angle-wall`（绕 Y 转 30° 石板·Transform3D.rotY render + hull collision·**顶点由轴+半尺寸只用 ×/+ 生成→跨机确定**）。开菜单见斜置 hull 线框（黄）——证明 SAT 按真朝向判定·非轴对齐 AABB。
>   - **测试**：`contact3d.test` +5（轴对齐 hull·**转 45° 真旋转：球落 AABB 内但盒外→SAT 判分离**·hull-hull 15 轴·hull-胶囊·确定性）。tsc+vitest+build+截图全绿。
> - **✅ 3D 碰撞响应（owner 2026-06-28「鸭子穿墙·只检测没碰撞」→ 补响应）**：`skills/atoms/collision-resolve-3d`（镜像 2D `collision-resolve`·确定性 sim·进 hash·Resolve 阶段）——读 `Overlap3D` → 顺序冲量(速度) + NGS(位置)把动态体推出静态墙。**XZ 地面解算**（取接触法线水平分量·实体竖直锁 baseY·纯竖直接触跳过）；逆质量：无 Velocity=静态、有=动态；trigger 不解算（触发区可穿入）。game-z 接入 → 小黄鸭撞墙被挡、贴墙滑。测试 4（推出/速度清/trigger 跳过/两世界 hash 一致）。
> - **⬜ 待续**：动态-动态堆叠/质量分摊已支持(同 2D 核)·更复杂刚体走 P3 物理表现轨（纯表现·Rapier·YAGNI）。
> **架构守则（贯穿·下同）不变。**


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

## REQ-3D-PBR-IBL PBR 金属需环境贴图（无 IBL 纯金属发黑） · [2026-06-29] · PI → P3D（3D 渲染线·材质域） · status: **✅ done（P3D 2026-06-30·TA Phase5 IBL·Sky3D.env）** · 类型: 渲染正确性（PBR 金属可读性）

> **现象**：`Material3D` 的金属预设（`gold`/`steel`/`copper`·metalness:1）渲出来**发黑**——建 game-i「PBR 材质」展台时实测：纯金属盒几乎全黑，只有直接镜面高光一点。
> **根因**：`MeshStandardMaterial` metalness=1 **没有漫反射**，全靠**反射环境**。渲染器没设 `scene.environment`（无 IBL/PMREM env map）→ 金属反射的是黑色 → 发黑。介电材质（木/岩/玻璃/自发光）不受影响、渲得对。
> **建议**（P3D 定夺）：用 `PMREMGenerator` 从 **Sky3D 程序天空**生成一张 env map 设 `scene.environment`（盒庭天空当 IBL 源）——金属即反射天色、显出金属光泽；天变则重生成（脏标）。一处加、所有 PBR 金属受益。
> **展示台侧已绕**（不等修）：金属用 `Material3D` 的 `metalness` 覆盖压到 ~0.4 让基色显出来（合法数据·展台可读）；P3D 补 IBL 后即可回纯预设（metalness:1 显真金属反射）。
>
> **✅ P3D 已交付（2026-06-30·同日）**：`Sky3D.env?:number` 开 IBL（RoomEnvironment→PMREM→scene.environment）。展台 game-i 材质场景已用 `env:1` + 回退纯金属预设（去掉 metalness 绕法）→ 金属正确反射环境。结案。
