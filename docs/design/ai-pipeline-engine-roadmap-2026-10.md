# AI 协同生产流程 · 引擎能力路线图（2026-10-16）

> **owner 2026-10-16 裁决**：走 **A = 自研引擎**，不用 Unity/Godot；目标是把《Across the Stars》式流程（`docs/workflow/ai-production-flow.md`）需要的能力**泛化进引擎**。本 session 只做分析与拆解，**不写代码**；实现由 owner 派 Codex 按本文逐项施工。
> 顺序原则：**先引擎能力，后游戏**。每项 = 一张可直接派工的写死 spec（目标 · 实查 · 数据形状 · 归属 · 验收 · 依赖）。
>
> **owner 2026-10-16 追加裁决**：
> 1. 原流程里**我们没有的部分全部在引擎侧补足**；Unity 在原流程里的角色（组装可玩场景）由我们引擎承担（E 层 + E5）。
> 2. **与 Tripo、Blender 做正式整合**（T3 / T4 / T7）。
> 3. **绑骨走原流程**：Blender + **Auto-Rig Pro（付费，接受）** + Mixamo（§3 Q1 判 B）。
> 4. 目标是**把原流程完整走通**，验收 = V1 竖切。

---

## 0. 现状实查（2026-10-16·对代码核过）

| 流程环节 | 引擎现有 | 出处 |
|---|---|---|
| 文生 3D 模型 | ✅ `ai-gen.mjs` 的 tripo / meshy 适配器（**仅文本→glb**） | `scripts/ai-gen.mjs` 头注释 |
| 文生 2D 图 | ✅ qwen（万相）/ seedream 适配器（**仅文本**，无参考图入参） | 同上 |
| glTF 模型显示 | ✅ `Model3D{modelKey,scale,tint}` + `ModelPool` | `src/engine/protocol/components/render.ts`、`src/renderer/three/models.ts` |
| 骨骼动画 | 🔶 `AnimState3D{clip,speed,loop}`：**只播模型自带的单个 clip**，换名淡入；无混合树、无状态机、不能用外部动作文件 | 同上 |
| 程序化位姿动画 | ✅ `Anim3D`（spin/bob/osc/noise/ease/spring） | `src/renderer/three/anim3d.ts` |
| 3D 拾取 · 图元 · 贴图槽 · HDRI | ✅ `Pickable3D` · cylinder/cone/capsule/torus · metal/emissive/ORM · `Sky3D.envMap` | `docs/workflow/requests-3d.md`「交互与材质补全批」 |
| 相机 | ✅ `Camera3D` orbit / follow | `render.ts` |
| 3D 逻辑碰撞 · 导航烘焙 | ✅ `d1-overlap-detect-3d` · `d-collision-resolve-3d` · `d2-navmesh-bake` | `capability-registry.gen.ts` |
| 模型压缩加载（Draco/meshopt/KTX2） | ❌ `src/renderer` 内无 | grep 零命中 |
| 骨骼挂点（道具挂手） | ❌ 无 socket / bone attach | grep 零命中 |
| IK | ❌ 无 | grep 零命中 |
| 模型导入标准（尺度/朝向/轴心/面数校验） | ❌「模型线最散」 | `docs/design/3d-asset-pipeline-standard.md` §0 |
| 截图 harness | ✅ `scripts/shoot-game.mjs` | — |
| 参考图比对审查 | ❌ self-check 只比 GDD 文字 | `docs/playbooks/self-check.md` |

---

## 1. 能力清单（四层·共 14 项）

原流程 → 本仓对应：Image 2.5 出图 = T1 · 看图拆资产 = T2 · Tripo = T3 · Opus 操控 Blender = T7（+T4） · Auto-Rig Pro + Mixamo = T5 · Unity 组装 = E1–E5 · 独立审查 agent 多机位盲审 = T6 + R1 复查门 · Astra 修 bug = 现有施工/复查门纪律。

### T 层 · 离线工具链（`scripts/`·sim 外·产物=提交进库的固定资产）

**T1 参考图生成** —— K1/K2/D1 的地基，2D 也需要
- 目标：`ai-gen.mjs` 新增 `--ref <png>...`（风格/造型参考）与 `--edit <png>`（图生图改局部）；provenance 记参考图哈希。
- 数据：`node scripts/ai-gen.mjs seedream "<prompt>" --ref keyart/street.png --game game115`。
- 验收：mock 模式下参考图哈希进 provenance；真调走支持参考图的 provider；`ai-gen.test.mjs` 加用例。
- 归属：🟢 扩写（已有适配器加可选入参）。

**T2 关键图工作区 + 拆层单 schema**
- 目标：固定 `docs/design/<slug>/keyart/` 结构；拆层单落**机读** `asset-split.json`：`[{id, scene, bbox:[x,y,w,h], route:"generate"|"build"|"character", skinKey, prompt, refs[], state:"proposed"|"approved"}]`；脚本由它画标注图 `keyart/<scene>-split.png`，并由 `approved` 行推导美术台账（同 art-pipeline「台账只列有消费槽的行」）。
- 验收：守卫拒收无 `skinKey` 行；`proposed` 行不进台账；标注图可重复生成（同输入同图）。
- 归属：🟢 扩写（台账推导脚本已有样板 `scripts/game112-art-requirements.mjs`）。

**T3 图生 3D / 多视图生 3D**
- 目标：tripo 适配器新增 `image_to_model`（单图）与 `multiview_to_model`（前/后/左/右四视图，即人物 T-Pose 四视图路线）；输出 glb + provenance（含输入图哈希）。「局部重生成」若 provider API 不提供，降级为整体重生成 + 人选优。
- 验收：mock 跑通；四视图缺一拒跑；以 Tripo 当期 API 文档为准。
- 归属：🟢 扩写。

**T4 模型规范化管线（Blender 无头）**
- 目标：`scripts/model-normalize.mjs` 调 `blender --background --python`：统一 **+Y 朝上、1 单位 = 1 米、轴心落脚底**，面数预算、贴图 ≤2k，导出 glb（Draco/meshopt 压缩）；输出 `assets/index.json` 条目的 `spec{scale, up, pivot, tris, bytes}`。
- 验收：对 3 个 Tripo 样本跑出同规格；校验器对超预算 / 轴向错的模型给可读报错；无 Blender 环境时明确跳过并提示，不静默。
- 归属：🔴 主程（资产导入面 + 跨游戏共享）。

**T5 绑骨与动作导入**（✅ owner 判 B：Blender + Auto-Rig Pro + Mixamo）
- 目标 ①·绑骨：经 T7 在 Blender 里对 T4 规范化后的人物跑 **Auto-Rig Pro Smart**：脚本按模型包围盒与四视图给出初始标记点，**标注截图交人确认/微调**后生成骨架并自动蒙皮；导出带标准人形骨骼命名的 glb。
- 目标 ②·动作：Mixamo 无官方 API → **人工**按动作清单下载 FBX（Without Skin）放入 `assets/_inbox/mixamo/`；脚本经 T7 用 Auto-Rig Pro **Remap** 重定向到本项目骨架，每个动作导出为独立动作 glb（供 E2 动作库消费），并登记 `assets/index.json`（`type:'animation'`·`spec{skeleton, fps, frames, loop}`）。
- 动作清单：`docs/design/<slug>/motion-list.md`（动作名 · Mixamo 搜索词 · 是否需 IK 修正）；没有现成动作的（如提水壶）选最接近的一条并标「需 E4 修正」。
- 许可：Auto-Rig Pro 每台施工机一份授权，**不入库**；脚本检测插件缺失时**明确报错退出**，不静默跳过。Mixamo 动作按 Adobe 条款可用于商业游戏，provenance 记来源。
- 验收：一个 Tripo 人物绑骨后在 Blender 里播 3 个重定向动作无穿模/翻折；导出的动作 glb 在引擎里经 E2 能绑到该模型。
- 依赖：T7、T4。归属：🔴 主程。

**T7 Blender 桥**（「agent 操控 Blender」·T4/T5/D1 的「直接搭」都靠它）
- 目标 ①·无头作业：`scripts/blender-job.mjs <job.json>` 调 `blender --background --python`，job = 纯数据 `{op, inputs[], params, outputs[]}`，op 为闭集（`normalize` · `rig-arp` · `retarget-arp` · `build-scene` · `render-views`）；每次作业落日志 + 输出文件哈希，可复跑。
- 目标 ②·搭场景：`build-scene` 吃 D1 拆层单里 `route:"build"` 的行 + Tripo 道具，由 agent 写的 bpy 脚本搭场景（脚本作为作业产物入库可审），按 **E5 节点命名约定**导出整场景 glb。
- 目标 ③·看图反馈：`render-views` 按关键图机位出渲染图，供 agent 自查和 R1 盲审比对（Blender 侧预览，引擎侧截图仍走 T6）。
- 可选：接 Blender MCP 做交互式搭建；无头作业是**必备主线**，MCP 只是加速。
- 验收：同一 job 两次运行产物哈希一致（不含时间戳）；无 Blender 时明确报错；op 闭集外拒跑。
- 归属：🔴 主程（跨游戏共享面）。

**T6 R1 对抗盲审 harness**
- 目标：`scripts/keyart-review.mjs <slug> <scene>`：按**机位预设**（2D = 固定帧；3D = `Camera3D` 预设视角列表）截图 → 与关键图并排出对比图 + 客观指标（色调直方图距离、构图分区亮度）→ 生成 `self-check/R1-keyart-review.md` 骨架，由**非施工 agent** 逐项填差异单。
- 验收：同场景同机位两次截图一致；对比图落 `self-check/shots/`；指标只作参考，不当通过阈值（裁决仍是复查人）。
- 归属：🟢 扩写（基于 `shoot-game.mjs`）。

### E 层 · 引擎运行时（`src/renderer/three-*`·全部 render-only·入 `NON_DETERMINISTIC`·**P3D 域**）

**E1 压缩模型加载**
- 目标：`ModelPool` 接 Draco / meshopt 解码 + KTX2 贴图（网页包体），解码器随构建本地打包，不走 CDN。
- 验收：同一模型压缩前后显示一致；未压缩模型照旧可用（向后兼容）。
- 依赖：T4。

**E2 动作库 + 动画图 `AnimGraph3D`**（即「交互与材质补全批」③ BlendSpace，**本次转正拉动**）
- 目标 ①：动作可来自**外部动作资产**，按骨骼名绑到任意同骨架模型（一套动作多角色共用）。
- 目标 ②：数据化状态机 + 混合：
  `AnimGraph3D{ clips:{名:{asset?,clip,speed?,loop?}}, states:{名:{clip}|{blend:{param,points:[{at,clip}]}}}, transitions:[{from,to,whenParam,cmp,value,fade}], params:{名:来源} }`；参数来源限闭集（`speed` 读 Velocity、`flag:<id>`、`state:<fsm>`）。
- 红线：sim 不读动画；参数只从 sim **单向**读出。
- 验收：idle↔walk↔run 按速度平滑混合；外部动作 clip 绑到 2 个不同模型都正确；与现有 `AnimState3D` 共存（不改其语义）。
- 依赖：T5（动作资产）。

**E3 骨骼挂点 `Attach3D`**
- 目标：实体挂到另一实体模型的**命名骨骼**上：`Attach3D{ parentId, bone, offset:[x,y,z], rot:[x,y,z] }`（如水壶挂右手）。
- 验收：父模型播动画时挂件跟随；父实体销毁时挂件随之隐藏不报错；骨骼名不存在时 WARN 一次并回退挂到父根节点。
- 依赖：E2（动作中验证跟随）。

**E4 IK `IK3D`**（「手对到壶把上」）
- 目标：在动画之后施加的 render-only 修正：
  `IK3D{ chains:[{ kind:"two-bone", root, mid, end, target:{entity, bone?, offset}, pole?, weight }], lookAt?:{bone, target, weight} }`；`weight` 可被 E2 参数驱动（伸手时渐入）。
- 验收：手臂链末端误差 < 1cm（测试用纯函数解析解）；`weight=0` 时与无 IK 完全一致；目标不可达时伸直不翻折。
- 依赖：E2、E3。

**E5 场景 glb 拆实体**
- 目标：Blender 搭的整场景 glb 按**节点命名约定**展开为实体：`col_*` 生成碰撞体、`nav_*` 参与导航烘焙、`pick_*` 带 `Pickable3D`、`spawn_*` 作出生点；其余只显示。
- 数据：蓝图里 `SceneImport3D{ modelKey, rules:"default" }`，展开在装载期确定性完成（同输入同实体 id）。
- 验收：一个含四类节点的样例场景展开后，碰撞 / 导航 / 拾取都可用；快照 hash 两跑一致。
- 归属：🔴 主程 + P3D 协作（装载期展开碰 sim 实体与快照 hash）。

### P 层 · 流程门（`scripts/game-pipeline.mjs`）

**P1 K/D/R 三道门进生产板**
- 目标：`board` 显示 K2「画面定稿」、D1「拆层确认」两道人门，以及 R1 复查门；机器态从工件推导（`keyart/` 存在、`asset-split.json` 全 `approved`、`R1-keyart-review.md` 在档）。
- 验收：缺工件时对应关显示红；人门只能 `signoff`，不可由 agent 代签。
- 归属：🔴 主程（生产板是跨游戏共享面）。

### V 层 · 验证切片（施工完成后才开）

**V1 game-z「提水壶」竖切**（P3D 实验台）
- 一个 Tripo 生成并规范化的人物 + 水壶道具 + Blender 搭的小院子场景；人物 idle→walk→提起水壶（E2 混合 + E3 挂手 + E4 对把手），再过 R1 盲审。
- 这是整条链路的端到端验收，**通过前不在发售游戏里用 3D 人物**。

---

## 2. 实施顺序（按依赖·每步独立提交、全量门禁绿）

| 阶段 | 项 | 解锁什么 |
|---|---|---|
| **第 1 步 · 定调与审查（2D 就能用）** | T1 → T2 → T6 → P1 | K1/K2/D1/R1 全流程；game115（2D）即可按新流程走 |
| **第 2 步 · 3D 资产进得来** | T7 → T3 → T4 → E1 | Blender 桥打通；Tripo 生成的道具/人物经 Blender 规范化后进引擎、网页包体可控 |
| **第 3 步 · 3D 场景** | E5 | Blender 搭的场景直接变可玩场景（碰撞/导航/拾取） |
| **第 4 步 · 3D 人物** | T5 → E2 → E3 → E4 | 绑骨、动作库、混合、挂手、IK |
| **第 5 步 · 端到端验收** | V1 | 证明整条链路可用 |

第 1 步不依赖 P3D，可与第 2 步并行。

---

## 3. 裁决记录与待办

- **Q1 · 绑骨与动作来源（T5）**：✅ **owner 2026-10-16 判 B**——走原流程 Blender + Auto-Rig Pro（付费接受）+ Mixamo，目标是完整走通。（备选 A「Tripo 自带绑骨/重定向 API」不做。）
- **Q2 · 施工主体**：owner 派 Codex 施工。E1–E4 属 P3D 域（`src/renderer/three-*`）；T4/T5/T7/E5/P1 属 🔴 主程面。按 CLAUDE.md「施工与复查」：Codex **开工第一动作是在工单上抢锁**（把施工主体改成自己并推一次）；**复查人另派，不得是施工方**，复查按四步铁律（独立复跑 · 撤修验红 · 实证复现 · 读告警）。
- **Q3 · 登记**：3D 资产与运行时项（T3 · T4 · T5 · T7 · E1–E5 · V1）登记在 3D 独立池 `docs/workflow/requests-3d.md` 总单 `REQ-3D-AI-PIPELINE`。通用项（T1 · T2 · T6 · P1）属引擎池 `docs/workflow/requests.md`，**该池现 10/10 满槽，需 Lead/owner 先清出一个槽再登记**；在此之前以本文 §1 为写死 spec。
- **采购口径**：owner 2026-10-16 表态可购买所需 API / 插件，或接入其他工作流；选型以「能脚本化、产物可复现、许可允许商用」为准。
- **施工机前置**：Blender（固定一个 LTS 版本）+ Auto-Rig Pro 授权 + Tripo API key（env `TRIPO_API_KEY`，不入库）+ 图像 provider key。云端 session 网络受限，真调 API 与 Blender 作业需在放开网络、装好 Blender 的机器上跑；mock 路径保证门禁可绿。

---

## 4. 不做清单（防过度设计）

- 不做运行时 AI 生成（生成只在离线工具链，产物是固定资产；sim 永不调 AI）。
- 不做全身 IK / 布料 / 物理骨骼：本流程只需「手臂两骨 IK + 看向」。
- 不做 Unity/Godot 导出或互通。
- 不做通用编辑器 UI：拆层确认用标注图 + 生产板签字，不建可视化编辑器。
