# AI 协同生产流程图（v1 · 2026-10-16）

> owner 2026-10-16 令：拆解《The Little Prince: Across the Stars》式 AI 制作流程，形成**我们自己的开发流程图**，并入项目开发流程。
> 本文 = 拆解 + 分析 + 新流程图。它**不替代**八阶段生产板（`docs/playbooks/game-production.md`），而是把 AI 工具链**挂到 S1–S8 上**：每一步落在哪一关、由谁做、过哪道门。
> 首个试用项目：game628《最后的火柴》（`docs/design/game628/brief.md`）。

---

## 1. 原流程拆解（owner 转述版·名称已校正）

> 来源：owner 转述的制作分享 + 公开报道（作者 Sac 只公开了工期与工具组合，完整流程称将开源；以下属二手资料，无法逐项核实）。
> 名称校正：Triple/Tribal → **Tripo**；Ops → **Opus 5.5**；Autore rig Pro → **Auto-Rig Pro**；Astra → **GPT-6 Astra**。

**分工**：Fable 5.1 写需求文档 · GPT Image 2.5 出图 · Tripo 做模型 · Opus 5.5 写代码并操控 Blender / Unity · GPT-6 Astra 修 bug。

**场景三步**
1. 用 Image 2.5 先定一张满意的场景图，再补俯视、侧视角度。
2. 让 AI 看图拆资产：哪些交给 Tripo 单独生成、哪些在 Blender 里直接搭，标在图上，**人来确认**。
3. 把 Tripo 做好的道具和参考图一起交给 Opus 照图复刻；做完派**独立审查 agent 多机位盲审**，和参考图不一样就接着改。

**人物四步**
1. Image 2.5 出 T-Pose 四视图。
2. Tripo SmartMesh P2.0 多视图生成模型，网格不对就局部重生成。
3. 用 Auto-Rig Pro 自动绑骨蒙皮。
4. 去 Mixamo 找动作；没有现成的（如提水壶）就找最接近的，再用 IK 把手一点点对到壶把上。

**三点启发**：① 从统一的生图开始，先把画面定下来，风格就好控；② 复杂场景启用对抗式审查，另一个 agent 专门挑刺；③ 自动化程度已很高，建模、绑骨、写代码基本都是 agent。

---

## 2. 分析：哪些我们已有、哪些要改、哪些是缺口

| 原流程环节 | 我们现状 | 判定 |
|---|---|---|
| 需求文档先行 | S1 立项卡 + S2 capability-plan（Lead 过审才动工） | ✅ 已覆盖，更严 |
| **先定一张关键图，再补视角** | 现行美术线是「台账逐行出图」（`docs/playbooks/art-pipeline.md` 八步），风格锚是**文字**；没有「整图定调」这一步 | 🔶 **流程要改**：关键图前置到 S2 之后、S3 之前 |
| 看图拆资产 · 标图 · 人确认 | 台账由 manifest `art:` / `skinKey` 槽推导，不从图出发 | 🔶 **流程要改**：新增「拆层单」工件 + 人门 |
| 道具单独生成 | `scripts/ai-gen.mjs` 逐行生成 | ✅ 已有 |
| **带参考图生成**（风格/造型一致） | `ai-gen.mjs` 无参考图入参；art-pipeline「查不到」节点名点「参考图模式」须提单 | ❌ **缺口 G1** |
| 照图复刻 | S3–S5 施工 | ✅ 已有 |
| **独立 agent 多机位盲审** | 复查门（复查人 ≠ 施工人）+ self-check 截图对齐单；但对齐对象是 **GDD 文字**，不是**参考图** | 🔶 **流程要改**：对齐单增「参考图比对」段 |
| 人物 T-Pose → 多视图建模 → 绑骨 → 动作 → IK | 引擎能载 glTF（`src/renderer/three/models.ts`），**只播单 clip、无混合/状态机、无 IK**；外部模型导入未标准化（`docs/design/3d-asset-pipeline-standard.md` §0） | ❌ **缺口 G2–G4**（仅 3D 项目需要） |
| AI 修 bug | 施工 → 撤修验红 → 复查门 | ✅ 已有，纪律更严 |

**结论**：原流程最值钱的是**两个前置/后置的「图」**——前面用一张图定调，后面拿同一张图挑刺。我们的门禁骨架已经比它严，缺的正是这两张图。

---

## 3. 新流程图

```mermaid
flowchart TD
  S1["S1 立项卡<br/>brief.md · owner 签"] --> S2["S2 能力计划<br/>capability-plan · Lead 签"]
  S2 --> ENG{"引擎选型<br/>owner 裁 A/B/C"}

  ENG --> K1["K1 关键图定调<br/>每场景 1 张主图 · 生图模型"]
  K1 --> K2["K2 补视角<br/>俯视 / 侧视（3D）· 状态变体（2D）"]
  K2 --> KG{"人门：画面定稿？"}
  KG -- 否 --> K1
  KG -- 是 --> D1["D1 看图拆层<br/>AI 出拆层单 + 标注图"]
  D1 --> DG{"人门：拆层确认？"}
  DG -- 否 --> D1
  DG -- 是 --> SPLIT{"资产去向"}

  SPLIT -- 单独生成 --> G["生成道具/层<br/>ai-gen 带参考图（G1）· 3D 走 Tripo"]
  SPLIT -- 直接搭建 --> B["场景内搭建<br/>2D 切图拼层 · 3D Blender"]
  SPLIT -- 人物 --> C1

  subgraph CHAR["人物线（仅 3D 项目）"]
    C1["T-Pose 四视图"] --> C2["多视图建模<br/>坏网格局部重生成"]
    C2 --> C3["自动绑骨蒙皮"]
    C3 --> C4["动作库取最接近动作"]
    C4 --> C5["IK 精修接触点"]
  end

  G --> S3
  B --> S3
  C5 --> S3
  S3["S3 骨架关<br/>manifest 装载 + 空跑"] --> S4["S4 玩法关<br/>闭环 + 验收剧本"]
  S4 --> S5["S5 UI 关<br/>LayoutNode · 华丽起手"]
  S5 --> S6["S6 美术关<br/>台账写回 · 照关键图复刻"]
  S6 --> R1["R1 对抗盲审<br/>独立 agent 多机位截图 vs 关键图"]
  R1 --> RG{"与关键图一致？"}
  RG -- 否 · 出差异单 --> S6
  RG -- 是 --> S7["S7 品质关<br/>八维评分卡"]
  S7 --> S8["S8 终检关<br/>全量门禁 · 发布"]
```

### 3.1 新增步骤定义（插在原八关之间·不改八关语义）

| 步 | 插在 | 做什么 | 产物（落 `docs/design/<slug>/`） | 门 |
|---|---|---|---|---|
| **K1 关键图定调** | S2 后 · S3 前 | 每场景出一张主图，统一画风从它开始 | `keyart/<scene>.png` + `keyart/README.md`（提示词、模型、种子） | — |
| **K2 补视角** | K1 后 | 3D：俯视 / 侧视；2D：状态变体（如火苗强弱） | `keyart/<scene>-<view>.png` | **人门：画面定稿**（owner 签） |
| **D1 看图拆层** | K2 后 | AI 把主图拆成资产清单，标注每项去向（单独生成 / 直接搭 / 人物），清单逐项对应皮肤槽 | `asset-split.md` + `keyart/<scene>-split.png`（标注图） | **人门：拆层确认**（owner 签）→ 再进台账 |
| **R1 对抗盲审** | S6 后 · S7 前 | **非施工 agent** 多机位/多帧截图，与关键图逐项比对（构图、色调、光源、层次、比例），出差异单；不一致回 S6 | `self-check/R1-keyart-review.md` + `self-check/shots/` | **复查门**（复查人 ≠ 施工人·按 `docs/playbooks/review-gates.md` 四步铁律） |

### 3.2 硬规则

- **关键图是 S6 的唯一视觉基准**：R1 只比关键图，不比「我觉得好看」；关键图要改，回 K2 重签。
- **拆层单 = 台账来源**：D1 每行必须落到一个真实消费槽（`art:` 或 `skinKey`），与 art-pipeline「台账只列有消费槽的行」同律；无槽行不许进台账。
- **盲审 = 不给施工说明**：复查 agent 只拿关键图 + 截图，不读施工方的自陈，避免被引导。
- **AI 只开方子、人点头**：K2 / D1 两道人门不可由 agent 代签（同 game-production「不许代签」）。

---

## 4. 引擎分支（✅ owner 2026-10-16 裁 A：自研引擎·不用 Unity/Godot）

| | A. ZeroCraft（自研） | B. Unity | C. Godot |
|---|---|---|---|
| 场景线（K1–D1–R1） | ✅ 全可用 | ✅ | ✅ |
| 人物线（G2–G4） | ❌ 需先补引擎 | ✅ 现成（人形重定向 + IK 工具） | 🔶 可用，链路需自建 |
| S3–S8 门禁 | ✅ 全套现成 | ❌ 需另建 | ❌ 需另建 |
| 推荐用途 | **2D 项目 · 系列首章** | 必须 3D 且求快 | 不推荐（两头不占） |

裁决：走 A，并把流程所需能力泛化进引擎（人物线也补）。逐项 spec 与实施顺序见 `docs/design/ai-pipeline-engine-roadmap-2026-10.md`。

---

## 5. 缺口清单（owner 已判补·拆解见路线图）

> 引擎池 `requests.md` 现 10/10 满槽；以下按缺口裁决协议先摆路，owner 判后再入对应池。

| # | 缺口 | 实查 | A 补能力 | B 不补 | 影响 |
|---|---|---|---|---|---|
| **G1** | 带参考图生成 | `scripts/ai-gen.mjs` 无参考图入参 | 扩 `ai-gen` 支持参考图 / 图生图（工具面·🔴 走主程） | 只用文字风格锚，靠人工挑图保一致 | **K1/D1 核心**，2D 也需要 · **推荐 A** |
| G2 | 外部模型导入标准 | `3d-asset-pipeline-standard.md` §0「模型线最散」 | P3D 补 glb 导入 + scale/校验 | 手工导入 | 仅 3D |
| G3 | 动画混合 / 状态机 | 只播单 clip；`docs/design/godot-vs-apollo.md` §4A 已列为最高借鉴项 | P3D 下沉 `AnimGraph3D`（render-only） | 单 clip 硬切 | 仅 3D |
| G4 | IK（手对物体） | `src` 内无 IK 实现 | P3D 下沉 render-only IK | 选不需接触的动作 / 改镜头回避 | 仅 3D |

---

## 6. 首个试用：game628

- K1/K2：7 个场景各出一张主图 + 火苗强 / 弱两档变体。
- D1：拆成 `capability-plan.md §4.5` 的六类皮肤槽（背景 / 幻象层 / 热点物件 / 小女孩姿态 / 火柴 / 相册卡）。
- R1：每章截火苗强、中、弱三帧，与关键图比对。
- 人物线：不触发（2D 剪影）。

---

## 7. 设计定稿线（UI · Claude Design）与「设计定稿包」（2026-10-16 加）

> owner 2026-10-16 提：原来 UI 都在 Claude Design 里做，现在要把它并进完整的设计定稿流程，缺能力就在引擎补。

### 7.1 现有设计稿线（REQ-DESIGNLINE·实查）

| 环节 | 现有 | 出处 |
|---|---|---|
| 发：UI 需求单 | ✅ 从验收剧本 / 蓝图动作 / GDD 屏清单自动推导，带风格锚 | `scripts/ui-brief.mjs` |
| 做：出稿 | 🔶 owner 手动在 Claude Design 网页做，再手动搬回 | — |
| 收：收稿 + 台账 | ✅ 单文件 / zip 收稿箱 → `docs/design/<slug>/ui-refs/` + `design-ledger.json`（draft→final 真人签） + 需求单动作对账 | `main_entry/design_ingest.py` |
| 量：稿子量盒子 | 🔶 只有 game108 专用版 | `scripts/game108-design-measure.mjs` |
| 令牌：颜色 / 字号 / 圆角 | 🔶 手抄成代码 | `games/game108/design-tokens.ts` |
| 复刻：结构 1:1（S4）+ 视觉 1:1（S5） | ✅ 规则在档 | `docs/playbooks/game-production.md` 两层 1:1 律 |
| 比对：我们渲出的屏 vs 稿 | ❌ 无通用工具 | — |

### 7.2 设计定稿包（每款游戏一份·S2 后、S3 前一次定稿）

| 件 | 内容 | 来源 |
|---|---|---|
| ① 玩法 | GDD + capability-plan | S1 / S2 |
| ② 风格令牌 | **一份**配色 / 字体 / 圆角 / 质感，同时喂给生图提示词和 UI 主题 | 新（缺口 U3） |
| ③ 场景关键图 | K1 / K2 | §3 |
| ④ 角色设定 | 三视图 / T-Pose 四视图（3D） | 人物线 |
| ⑤ UI 稿 | Claude Design 稿，**用我们的控件和令牌出**，以③为视觉参考 | 本节 |

**一道人门「设计定稿」**（owner 签）：五件齐、互相不打架（UI 风格与关键图一致）才签。签后改设计 = 开变更单，不许施工方就地改数字。

### 7.3 UI 线新流程

```mermaid
flowchart TD
  T0["U1 控件库同步到 Claude Design<br/>我们的控件 + house 主题 → 设计系统"] --> B1["发需求单<br/>ui-brief.mjs + 风格令牌 + 关键图"]
  B1 --> C1["Claude Design 出稿<br/>只用同步过去的控件"]
  C1 --> I1["收稿<br/>design_ingest · 动作对账"]
  I1 --> M1["U2 量稿 + 提令牌<br/>通用 design-measure"]
  M1 --> G1{"人门：设计定稿<br/>五件齐 · 风格一致"}
  G1 -- 否 --> C1
  G1 -- 是 --> L1["S4 结构 1:1 · S5 视觉 1:1<br/>LayoutNode 复刻"]
  L1 --> R2["U4 UI 盲审<br/>同一把尺子量我们的屏 vs 稿"]
  R2 -- 有差异 --> L1
  R2 -- 一致 --> OK["进 S6 / S7"]
```

### 7.4 缺口（⚖ 待 owner 判 A/B·UI 基座归 PUI·收稿线归 PST）

| # | 缺口 | 实查 | A 补 | B 不补的代价 | Lead 推荐 |
|---|---|---|---|---|---|
| U1 | **控件库同步成 Claude Design 设计系统** | 稿子现在用自由 HTML 画，复刻时要翻译成闭集控件，翻不过去就报 PUI 扩控件；Claude Design 支持设计系统项目（同步需 owner 启动 `/design-sync`） | 把 UI 控件目录（`src/ui/components/catalog.ts`）+ house 主题导出成设计系统预览包，同步过去 | 稿子永远是「自由画、再翻译」，翻译失真和扩控件扯皮一直有 | **A** · PUI |
| U2 | **通用量稿** | 只有 game108 专用版 | 把 `game108-design-measure.mjs` 泛化为 `design-measure.mjs <slug>`，产机读基准 JSON | 每款游戏重写一遍或靠目测 | **A** · PUI |
| U3 | **统一风格令牌**（2026-10-22 落地：美术根下 `style-tokens.json`，非 docs 目录——游戏运行时要能 fetch） | 生图风格在 `scripts/style-packs.json`，UI 主题在 UITheme，game108 令牌手抄成代码；三处各管各的 | 一份 `style-tokens.json`（每游戏）同时生成生图提示词风格段和 UITheme 覆盖；量稿时从稿子里提取 | 场景图和 UI 风格容易各走各的 | **A** · PUI + PST |
| U4 | **UI 盲审** | 无「我们渲出的屏 vs 稿」比对 | 并入 T6：同一 harness 既比场景关键图，也按 U2 的基准逐件比盒子位置 / 尺寸 / 颜色 | 1:1 只能靠人眼 | **A** · 并入 T6 |
