# 全动画库 · 方案与缺口（2026-10-27·⚖ 待 owner 判 A/B）

> owner 要求（2026-10-27）：Mixamo 下载完成后形成**自己的动画库**；再下载一批 **Skin（角色）**，库里任何动作都能套到任何 Skin 上；库能**微调、扩展、补充**，元数据**拉全拉齐**；以后童话剧等**演绎型内容**的 AI 生产，能从库里**自动匹配**动作，并能**预览演示**。
> 口径：逐层对 `codex/mainbranch` 实查，写「查了什么」；能用现有能力重组的不报缺口。

## 一、目标形态（五层）

| 层 | 是什么 | 产物 |
|---|---|---|
| L1 动作目录 | 每个动作一条完整记录：id、来源、时长 / 帧数 / fps、loop、inPlace、根运动、接触点（手 / 脚）、动作类别、情绪、强度、中英文描述 | 动作 GLB（标准骨架）+ 目录 JSON |
| L2 Skin | 角色模型，全部用同一套**标准骨架命名**（Mixamo `mixamorig:*`）；身材比例可以不同 | 角色 GLB |
| L3 预览台 | Skin × 动作网格，点开即播，可按标签筛选；同时也是 L2 能否套用的实证 | 一个浏览页（只读库） |
| L4 匹配 | 剧本一拍（「奶奶伸手把她抱起」）→ 候选动作排序 → 产出 AnimGraph3D / 时间线数据 | 确定性检索命令 + agent 规程 |
| L5 微调扩展 | 变体（速度、镜像、裁剪、补循环、手臂间距、能量等 Mixamo 滑杆）、IK 修正、接入其它来源（CC0 动捕、付费库、AI 生成动作） | 新目录条目，与原条目同骨架 |

## 二、逐层实查

| 层 | 现有能力（已核） | 结论 |
|---|---|---|
| 播放外部动作 | `AnimGraph3D.clips[*].asset` 可引用独立动作资产（`src/engine/protocol/components/anim-graph.ts`）；`ModelPool.buildGraph` → `bindSkeletalClip` 绑到角色骨骼（`src/renderer/three/models.ts:351`、`skeletal-clips.ts:201`） | ✅ 现成 |
| **一库多 Skin** | `bindSkeletalClip` 先 `assertSameSkeleton`（`skeletal-clips.ts:153`）：骨骼名、数量**以及静止 / 绑定矩阵、父链矩阵**必须近似相等，否则拒收。身材比例不同的两个角色，即使骨骼名完全相同也会被拒 | ❌ **缺口 M1** |
| 演出编排 | 时间线 cue 可写 flag / signal（`src/skills/tier3/timeline.ts`）；`AnimGraph3D.params` 可读 `flag:<id>` / `state:<id>` 并按条件切换（`anim-graph.ts` `AnimGraphParamSource`）；混合点、淡入、E4 IK、E6 镜头、渲染参数绑定（REQ-3D-RENDER-BIND）都在 | ✅ 重组成立：「第 3 秒奶奶伸手」= 时间线写 flag → 动作图切状态，不需要新能力 |
| 目录元数据 | 资产索引已有 `type:'animation'`（`src/assets/asset-index.ts:18`），可选 `category / tags / source / license / provenance` 且有校验；T5 回灌产物 `spec:{skeleton,fps,frames,loop}` | 🔶 字段容器现成，可用命名空间标签（`emotion:sad`、`contact:hand`）表达；**缺的是批量把 FBX 变成规范 GLB 并自动量出元数据的工具**（缺口 M2） |
| FBX → GLB 规范化 | T7 Blender 无头作业桥、T5 人物回灌只收人工单条、按目标角色逐条 Remap 烘焙 | ❌ 没有「整库批量、统一骨架、自动测量」的作业（并入 M2） |
| 预览台 | 全仓 `scripts/` 与游戏里无动作浏览页（game-i 是 UI 展示台，game108-art-previews 是 2D） | ❌ 缺口 M3 |
| 匹配 | 无动作检索；游戏 AI 生产靠 agent 自由挑选 | ❌ 缺口 M4 |
| 变体 | 动作图有 `speed`、混合；E4 IK；Mixamo 导出接口本身带镜像 / 裁剪 / 速度 / 手臂间距及各动作专属滑杆（`mixamo-fetch` 的 `gms_hash.params`） | 🔶 运行时变速、混合现成；**下载侧变体、离线裁剪 / 镜像 / 补循环缺**（缺口 M5） |
| Skin 下载 | `mixamo-fetch` 只下动作（Without Skin） | 🔶 并入 M5 的工具扩写（同一接口导出带皮角色） |

## 三、缺口与 A/B（Lead 推荐，不裁决）

### M1 · 一库多 Skin：同名骨骼、不同身材的动作重定向（🔴 引擎·P3D 域·render-only）

- **A · 引擎补运行时重定向**：骨骼名一致而静止姿态不同时，按「只传旋转 + 髋部位移按身高比例缩放」重定向（three.js `SkeletonUtils.retargetClip` 同类做法），动作图声明 `retarget:'humanoid'` 才启用，缺省仍走现在的严格同骨架。代价约同 E2 一半；全部 3D 游戏共用；动作不进 sim，不碰确定性。选错的代价：极端体型（矮胖 / Q 版）会有手脚穿插，需要 E4 IK 兜底或退回 B。
- **B · 离线逐对烘焙**：Blender / ARP Remap 把每个动作对每个 Skin 各烘一份。零引擎改动，但文件数 = Skin 数 × 动作数（10 个角色 × 300 个动作 = 3000 个文件），每加一个角色要重烘全库。
- **Lead 推荐 A**。B 在库小时可行，库一大就是乘法爆炸，与「全动画库」目标冲突。

### M2 · 动作目录与批量规范化工具（🟢 工具链·`scripts/`）

- **A**：`motion-library` 工具。① Blender 作业把本地 FBX 批量转成标准骨架的动作 GLB；② 自动量出时长 / 帧数 / 根运动 / 是否首尾可循环；③ 目录 JSON 定闭集词表（类别、情绪、强度、接触点）+ 中英文描述（AI 起草、人确认）；④ 以 `type:'animation'` 资产条目登记到本地索引。原件与 GLB 只在本机库，仓库只留词表与工具。
- **B**：人工维护表格，逐个在 Blender 里转。
- **Lead 推荐 A**：47 个还能手工，上百个之后元数据就会不齐，L4 匹配也无从谈起。

### M3 · 动作预览台（🟢 工具·只读）

- **A**：浏览页读本地库，Skin × 动作网格播放、按标签筛选，用引擎同一渲染器（顺带验证 M1）。
- **B**：在 Blender 里逐个看。
- **Lead 推荐 A**（M1 通过后做；体量小）。

### M4 · 演绎内容自动匹配（🟢 工具 + skill）

- **A**：确定性检索命令（剧本一拍的关键词 / 情绪 / 接触 → 目录排序，同输入同输出）+ skill 规程（agent 读候选、选定、写出 AnimGraph3D / 时间线数据，复查人核对）。agent 只在候选里选，不凭空编动作 id。
- **B**：agent 每次自己读整份目录挑。
- **Lead 推荐 A**：可复查、可审计，库大了也不爆上下文。

### M5 · 微调扩展与 Skin 下载（🟢 工具扩写）

- **A**：`mixamo-fetch` 清单支持每项覆盖 Mixamo 滑杆参数（同一动作派生多档变体）并能下载带皮角色；Blender 作业补裁剪 / 镜像 / 补循环；其它来源（CC0 动捕、付费库、AI 生成）走同一入库规范。
- **B**：只用 Mixamo 原样动作。
- **Lead 推荐 A，但排在 M1–M4 之后**，等第一批库跑通再扩。

## 四、建议顺序

M2（先把 Codex 正在下的那批变成规范库）→ M1（一库多 Skin）→ M3（预览台，同时验收 M1）→ M4（匹配）→ M5（扩展）。M1 属 🔴，归主程施工；其余 🟢 可派 Codex。每单照旧：施工人 ≠ 复查人。

## 五、版权边界（不变）

Mixamo 原件和由它转出的动作 GLB 都只放本机库，不进公开仓库；仓库里只放工具、词表和不含原件的目录结构说明。游戏发布时动作嵌在游戏包里，这是条款允许的用法。
