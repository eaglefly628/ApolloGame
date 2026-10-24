# AI 全套生产能力 · 缺口复盘（2026-10-24）

> 对照目标：《Across the Stars》那套做法（文档 → 生图定调 → 拆资产 + 人确认 → Tripo → Blender 规范化 / 搭景 → 绑骨 + 动作 + IK → 引擎复刻 → 多机位盲审 → Claude Design 出 UI）。
> 口径：逐环节对 `codex/mainbranch` 实查代码，不凭印象；每条写「查了什么」。
> 结论先说：**不需要全面改造引擎。** 运行时各件基本齐了。还差的是**步骤之间的接缝**（上一步的产物下一步没接上），加上**真实服务一次都没跑过**。所以本轮要补的是接缝，不是重写。

## 一、逐环节现状

| # | 环节 | 状态 | 实查 |
|---|---|---|---|
| 1 | 文档（GDD / 能力计划 / 定稿包） | ✅ | game628 已有 brief / gdd / design-freeze / capability-plan |
| 2 | 生图定调、参考图、补视角 | ✅ 离线 · 真实未跑 | `ai-gen --ref / --edit`、GPT Image 2.5 适配器 |
| 3 | 风格同源（生图 + UI） | 🔶 返工已交 · 待复查 | STYLETOKENS（ST1 已修，见 Review 单末节） |
| 4 | 拆资产 + 人确认 | 🔶 SPLIT-3D 复查 FAIL（1 处） | 见 `review/REQ-AIFLOW-SPLIT-3D.md` |
| **5** | **拆出来的资产按关键图单独生成** | ❌ **接缝断** | 见 §二 GAP-AIFLOW-REFS |
| 6 | Tripo 图生 / 多视图生 3D | ✅ 离线 · 真实未跑 | `tripo-generation.mjs`（单图 / 四视图） |
| 7 | Blender 规范化、搭景 | ✅ 离线 · 真实未跑 | `model-normalize.mjs`（只出候选，审批门写索引，刻意人工）、`blender-job` build-scene |
| 8 | 绑骨 + 动作 + IK | ✅ 离线 · 真实未跑 | `character-pipeline.mjs` + S3 回灌手册、E2 / E3 / E4 |
| 9 | 引擎复刻场景 | ✅ | E5 场景拆实体、E6 镜头、R4 分段加载、R2 贴地 |
| 10 | 游戏状态驱动画面（火苗变暗、溶解、发光） | ⏳ 待 owner 判 | G1 · GAP-628-04 |
| 11 | 拖拽环视 | ⏳ 待 owner 判 | G2 · GAP-628-05 |
| 12 | 多机位盲审（静帧 + 动作帧序列） | ✅ | REVIEW（T6） |
| 13 | Claude Design 出 UI | 🔶 返工已交 · 待复查 | DSYNC（DS1 / DS2 已修）；推送靠 owner 跑 `/design-sync` |
| 14 | 画面质感 | ✅ | `Post3D`：bloom / 移轴景深 / 暗角 / SMAA、toon + 描边、`Fog3D`、IBL、局部光阴影 |

## 二、新缺口 · GAP-AIFLOW-REFS：拆层行的参考图没人用（⚖ 待 owner 判 A/B）

**实查**
- `scripts/asset-split.mjs` 推导台账时，每行都带 `refs`（关键图路径）和 `spec.w/h`（来自 bbox），但**不切图**。文档原话：「脚本不执行切图、建模或生成资产」。全仓 `scripts/` 中 `crop` 零命中。
- `scripts/art-replace.mjs` 的 `batchGenerate → genRowAsset` 只把**文字提示词**交给适配器：model3d 是 `ADAPTERS[provider].generate(prompt, { mock, apiKey })`，2D 同理。`refs` 在生成路径上零引用，只在拆层并行合并里搬运。
- `tripo-generation.mjs` 本身支持单图 / 四视图，但只能经 `ai-gen` CLI 一行一行手动调用，结果也不回写台账。

**后果**：本作 23 个热点物件、火柴 / 火柴盒都是「以关键图为参考单独生成」（design-freeze §4）。现在批量出图只能**文生**：Tripo 拿到的是一句话，不是关键图里那个物件，风格和造型都会跟关键图脱节。这正是原流程最关键的一步：同一张关键图派生出所有资产，所以风格天然统一。

**为什么重组不成**：切图（bbox → PNG）没有任何现有能力；台账批量路径也没有任何字段把参考图交给适配器。两段都得加代码。

| | A · 补工具链接缝（🟢 已有能力扩写，只碰 `scripts/`） | B · 人工逐行跑 |
|---|---|---|
| 做法 | ① `asset-split` 按 bbox 从关键图确定性切出 `split/<id>.png`（同输入同字节）；② 台账行带切图路径；③ `batchGenerate` 遇到有参考图的行：model3d 走 Tripo 单图（切图）入参，sprite 把切图作为输入图交 GPT Image 2.5（适配器有输入图时已走 edits 端点；提示「把这个物件单独画出来、透明底」），provenance 记参考图 SHA | 每行手动 `ai-gen tripo --ref <自己切的图>`，再手动回写台账 |
| 代价 | 约同 SPLIT-3D 两倍：切图 + 一个可选台账字段 + 两处适配器入参 + 测试 | 30 余行逐个手动，provenance 不进台账，C8 合并与重跑保号全部失效 |
| 影响面 | 只影响带 refs 的拆层行；旧台账逐字节不变（照 SPLIT-3D 的做法钉夹具） | 无代码改动 |
| 选错的代价 | 选 A 但真实 Tripo 单图效果差：退回 B 即可，切图本身仍然有用 | 选 B：风格同源这一核心卖点要靠人肉维持，每个新游戏都重复这份手工 |

**Lead 推荐 A。** 这是整条链上唯一「代码已经各自齐了、但数据没流过去」的断点，补上之后拆层 → 生成才能批量跑。

## 三、仍待 owner 判的两条（不变）

- **G1 · 游戏状态驱动渲染参数**（GAP-628-04）：Lead 推荐 **A**（通用 render-only 绑定组件，P3D 域）。本作「火苗越弱越暗」是核心观感，选 B 等于 game628 自写宿主胶水。
- **G2 · 拖拽环视**（GAP-628-05）：Lead 推荐 **B**（删设计，固定机位 + E6 镜头）。

## 四、「全面改造引擎」为什么不推荐

- 渲染：路线已定，跟 three.js，不和 Unity / Unreal 拼画质；§一·14 的质感件已够本作用。缺什么，等真实关键图出来、盲审判「不达标」再按条补，不预先做。
- 编排器（一条命令串起整游戏的 Tripo → 规范化 → 绑骨 → 搭景 → 导入）：继续 **YAGNI**。各步命令都在，但**没有一步跑过真实服务**。先手动跑通一个角色、一个场景，看哪一步真的痛，再决定编排什么。现在做编排器，等于给一条没跑通的路修高架。
- 真正的最大风险不在引擎，在**真实链路**：Tripo / Blender / Auto-Rig Pro / Mixamo / 生图 key 一样都还没配。所有 ✅ 都是「离线 + Mock 通过」。

## 五、owner 侧待办（卡住开工的都在这里）

| 项 | 说明 |
|---|---|
| 判 A/B | GAP-AIFLOW-REFS（§二）、G1、G2 |
| 配真实服务 | Tripo key、Blender LTS、Auto-Rig Pro 授权、Mixamo 账号、GPT Image key：到位后先跑一个角色一个场景（GAP-628-03 锁 S6） |
| 风格令牌定稿 | 看 `public/games/game628/art/style-tokens.json`，改 `status: final` |
| 推设计系统 | 跑导出命令，会话里启动 `/design-sync` |
| 填真人白名单 | `docs/roles/humans.json`（人门签字的前提） |
