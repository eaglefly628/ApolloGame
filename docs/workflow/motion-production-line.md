# 动画生产线 · 工具流（M1–M5·owner 2026-10-27 全部判 A）

> 目标：一个**全动画库**（自己的、元数据齐全、可扩展），任何角色（Skin）都能用库里任何动作；童话剧等演绎型内容的 AI 生产从库里**自动匹配**动作并能**预览**。
> 方案与实查：`docs/design/ai-pipeline/motion-library-plan.md`。本文件是**施工与使用的流程图**：每一步用什么工具、吃什么、产什么、谁把关。

## 0. 两条硬约定

1. **标准骨架 = `apollo-humanoid-v1`**（引擎既有：`Hips / Spine / Chest / Neck / Head / Left|Right UpperArm·LowerArm·Hand / Left|Right UpperLeg·LowerLeg·Foot` 17 根必备骨，允许额外骨如手指、肩、Spine1）。库里的动作和所有 Skin 都用这套命名；Mixamo 的 `mixamorig:*` 在入库时改名（§2 映射表）。静止姿态统一 **T-pose、Y 轴向上、面朝 +Z**。
2. **版权**：Mixamo 原件及其转出的动作 GLB 只在本机库（`~/ApolloAssets/`），不进公开仓库；仓库只放工具、词表、清单与测试夹具（夹具用自造假骨架）。

## 1. 全流程

```
┌─ 来源 ───────────────┐   ┌─ M2 入库 ─────────────────────────┐   ┌─ 库 ──────────────────────┐
│ Mixamo（mixamo-fetch）│──▶│ motion-library ingest              │──▶│ ~/ApolloAssets/motion-lib/ │
│ M5：滑杆变体          │   │  FBX → 改名到标准骨架 → GLB 动作    │   │  clips/<id>.glb            │
│ M5：CC0 动捕/付费库   │   │  自动测量：时长/帧/循环/根运动/接触 │   │  catalog.json（目录）      │
│ M5：AI 生成动作       │   │  AI 起草标签与描述 → 人确认         │   │  skins/<id>.glb            │
└──────────────────────┘   └───────────────────────────────────┘   └─────────────┬─────────────┘
                                                                                  │
┌─ Skin ───────────────────────────┐                                              │
│ Mixamo 角色（M5 带皮下载）         │── motion-library skin-ingest（同改名）──────▶│
│ Tripo 人物 → T4 规范化 → ARP 绑骨  │                                              │
└──────────────────────────────────┘                                              ▼
┌─ M3 预览台 ──────────────────────┐   ┌─ M4 匹配 ─────────────────────┐   ┌─ 游戏 / 演绎内容 ─────────┐
│ Skin × 动作网格，筛选，逐帧看      │◀──│ motion-match「奶奶伸手抱起她」 │──▶│ AnimGraph3D（clips 带       │
│ 同时验收 M1 重定向是否穿模        │   │  → 候选排序（确定性）          │   │  retarget:'humanoid'）     │
└──────────────────────────────────┘   │  → agent 在候选里选 → 写数据   │   │ + 时间线 flag 驱动切换     │
                                        └──────────────────────────────┘   └───────────────────────────┘
                                  M1（引擎）：同名骨骼、不同身材的 Skin 共用同一份动作
```

## 2. 分步说明

| 步 | 工具 / 能力 | 输入 | 产出 | 把关 |
|---|---|---|---|---|
| ① 下载 | `scripts/mixamo-fetch.mjs`（已交付；owner 2026-10-28 报约 2500 个动作已下完，Skin 与骨骼定义见派工单补充指令） | `docs/design/ai-pipeline/mixamo-list.json` | `~/ApolloAssets/mixamo/<id>.fbx` + `manifest.json` | owner 提供 token；Codex 执行（派工单 `handoff-codex-mixamo-download.md`） |
| ② 入库（M2） | `scripts/motion-library.mjs ingest` | 上一步 FBX + manifest | `motion-lib/clips/<id>.glb`（标准骨架、单 clip、无皮）+ `catalog.json` 条目 | 工具自动测量；标签与描述由 AI 起草、人确认（`status: draft → confirmed`） |
| ③ Skin（M2 + M5） | `motion-library skin-ingest`；Mixamo 角色由 M5 下载，Tripo 人物走既有 T4 + T5 | 角色 FBX / GLB | `motion-lib/skins/<id>.glb` | 骨架校验（17 根必备骨、T-pose、髋高 > 0） |
| ④ 一库多 Skin（M1·**已施工**） | `AnimGraph3D.clips[*].retarget:'humanoid'` | 库动作 + 任一 Skin | 运行时重定向后的动作 | 预览台目视 + E4 IK 修穿插 |
| ⑤ 预览（M3） | `scripts/motion-preview.mjs`（本机起页面） | `catalog.json` + skins + clips | Skin × 动作网格浏览页，可筛选 | 人看；复查 agent 用 T6 动作帧序列抽查 |
| ⑥ 匹配（M4） | `scripts/motion-match.mjs` + skill `motion-match` | 剧本一拍（文字 + 可选情绪 / 接触 / 时长） | 前 N 候选（确定性排序）→ agent 选定 → AnimGraph3D / 时间线 cue 数据 | 复查人核对选择理由；agent 不得写目录外的动作 id |
| ⑦ 扩展（M5） | `mixamo-fetch` 清单支持滑杆覆盖、带皮角色下载；`motion-library variant`（裁剪 / 镜像 / 补循环）；其它来源同入库规范 | 现有条目或新来源 | 新目录条目（`derivedFrom` 记出处） | 同 ② |

### Mixamo → 标准骨架改名表（M2 用）

| Mixamo | 标准骨架 | 说明 |
|---|---|---|
| `mixamorig:Hips` | `Hips` | |
| `mixamorig:Spine` | `Spine` | |
| `mixamorig:Spine1` | `Spine1` | 额外骨，保留 |
| `mixamorig:Spine2` | `Chest` | |
| `mixamorig:Neck` / `Head` | `Neck` / `Head` | |
| `mixamorig:LeftShoulder` | `LeftShoulder` | 额外骨，保留（`LeftUpperArm` 仍是 `Chest` 的后代，满足骨架校验） |
| `mixamorig:LeftArm` / `LeftForeArm` / `LeftHand` | `LeftUpperArm` / `LeftLowerArm` / `LeftHand` | 右侧同理 |
| `mixamorig:LeftUpLeg` / `LeftLeg` / `LeftFoot` | `LeftUpperLeg` / `LeftLowerLeg` / `LeftFoot` | 右侧同理 |
| `mixamorig:LeftToeBase`、手指、`HeadTop_End` 等 | 去掉 `mixamorig:` 前缀保留 | 额外骨 |

### 目录条目（catalog.json，M2 定稿；以下为最低字段）

```json
{ "id": "reach-out", "file": "clips/reach-out.glb", "sha256": "…", "source": { "kind": "mixamo", "searchTerm": "Reaching Out", "mixamoName": "…", "fbxSha256": "…" },
  "fps": 30, "frames": 61, "durationS": 2.0, "loop": false, "inPlace": true, "rootMotion": "none",
  "category": "gesture", "emotion": ["tender"], "intensity": 2, "contacts": ["right-hand"],
  "descZh": "向前伸出右手，像要接住什么", "descEn": "reaches forward with the right hand",
  "tags": ["reach", "offer"], "derivedFrom": null, "status": "draft" }
```

闭集词表（M2 定，工具与测试钉住）：`category` ∈ idle / locomotion / gesture / emotion / interaction / combat / reaction / pose；`emotion` ∈ neutral / happy / sad / tender / afraid / angry / surprised / tired / cold；`intensity` 1–3；`contacts` ∈ left-hand / right-hand / both-hands / feet / seat / ground / partner；`rootMotion` ∈ none / forward / turn / vertical。

## 3. 施工单与顺序

| 单 | 归属 | 依赖 | 状态 |
|---|---|---|---|
| **M1** 一库多 Skin 重定向 | 🔴 主程（Claude） | — | **独立复查 FAIL · 待原施工方返工（STEP 时序）** · Review 单 `docs/design/ai-pipeline/review/REQ-MOTION-M1.md` |
| **M2** 入库与目录 | 🟢 Codex | 第一批 Mixamo 下载完成 | 待抢锁 |
| **M3** 预览台 | 🟢 Codex | M1 PASS、M2 | 待抢锁 |
| **M4** 匹配 | 🟢 Codex | M2 | 待抢锁 |
| **M5** 扩展与 Skin 下载 | 🟢 Codex | Skin 下载部分已提前（2026-10-28）；其余依赖 M2 | 待抢锁 |
| **M6** 补全动作烘焙入库 | 🟢 Codex | M2、M4 | **owner 本会话已判 A**（`docs/design/ai-pipeline/motion-completion.md`） |

每单照旧：施工人 ≠ 复查人；Codex 施工的由 Claude 复查，M1 由 Codex 复查；owner 最后可以按 §4 自己验收。派工指令全文：`docs/workflow/handoff-codex-motion-line.md`。

## 4. owner 验收（全部单 PASS 后）

1. 在本机跑 `node scripts/motion-preview.mjs`：随便挑两个身材不同的 Skin，同一动作并排播放，看有无明显穿插、滑步。
2. 给一句剧本（例：「奶奶慢慢弯腰，把小女孩抱进怀里」）跑 `node scripts/motion-match.mjs "<剧本>"`，看前 5 个候选是否合理。
3. 打开 `catalog.json`，抽 10 条看标签和描述是否准确。
