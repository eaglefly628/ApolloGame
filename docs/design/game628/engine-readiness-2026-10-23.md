# game628《最后的火柴》· 3D 开工前引擎就绪盘点（2026-10-23）

> 口径：按 game628 的 3D 做法（与《Across the Stars》同一套：生图定调 → 拆资产 → Tripo / Blender → 绑骨动作 → 引擎内复刻 → 对抗盲审），把每个环节对照引擎**当前主干代码**实查，不凭印象。
> 结论先说：**生产链工具和 3D 运行时已经基本齐了**，引擎侧还差 **1 处要补（G3）+ 2 处待 owner 判（G1、G2）**；其余卡点在 owner 侧的真实服务配置，以及三张待复查的单。

## 一、已就绪（有代码、有测试、有独立复查记录）

| 环节 | 能力 |
|---|---|
| 生图定调、补视角、T-Pose 四视图 | `ai-gen --ref / --edit`、GPT Image 2.5 适配器（REFGEN） |
| 风格同源 | 风格令牌（STYLETOKENS·**待复查**）；game628 草案在 `public/games/game628/art/style-tokens.json` |
| 拆资产、人确认 | `asset-split.json` + 标注图 + 台账推导（SPLIT·含 C8） |
| Tripo 生成 | 图生 3D / 多视图生 3D（T3·离线与 Mock） |
| Blender | 无头作业桥（T7）、模型规范化与压缩（T4、E1） |
| 绑骨与动作 | Auto-Rig Pro + Mixamo 离线编排与人工回灌手册（T5 + S3） |
| 引擎内复刻 | 场景 glb 拆实体（E5）、动作库与混合（E2）、骨骼挂点（E3）、IK（E4）、剧情镜头（E6）、分段加载（R4）、贴地行走与传送（R2 + GROUND-TELEPORT） |
| 盲审 | 关键图 / UI 稿比对、动作帧序列（REVIEW） |
| 流程门 | 画面定稿、拆层确认两道人门 + 关键图复查门（GATES） |
| UI 定稿 | 控件库导出为 Claude Design 设计系统（DSYNC·**待复查**） |
| 端到端 | V1「提水壶」离线整链（CPU 24/24） |
| 物理手感 | 刚体逐体弹性 / 摩擦（RB-MATERIAL·**待复查**） |

## 二、引擎还差的

### G3 · 拆层单进 3D（**直接修**·已登记 `REQ-AIFLOW-SPLIT-3D`）

- 实查：`scripts/asset-split.mjs` 推导台账时资产类型写死 `sprite`；`scripts/art-replace.mjs` 按类型选供应商（`model3d` → Tripo，其余 → 2D 生图）。所以 game628 的 3D 道具、人物会被当成 2D 图批量出图；而 `route:build` 行本该由 Blender 用图元搭，不该进出图台账。
- 属于已裁 A 的 SPLIT 范围内的修补，不是新能力，不需要再裁。

### G1 · 游戏逻辑驱动 3D 渲染参数（**待 owner 判 A/B**·GAP-628-04）

- 本作要的效果：火苗越弱点光越暗；擦亮时幻象溶解浮现、熄灭时溶解消散；火苗粒子随火苗缩小；鼠标悬停热点发光。
- 实查：`Light3D.intensity`、`Material3D.dissolve`、`Vfx3D.rate`、`Glow3D` 都是只影响画面的渲染字段；时间线 cue 只能写 signal / flag / resource / spawn，`effect-apply` 写不了渲染组件；`Anim3D` 只能动位置 / 旋转 / 缩放。全仓唯一「渲染侧读游戏信号」的先例是 `CameraShot3D`，只管镜头。
- **A · 下沉通用能力**：一个 render-only 绑定组件，读 Resource 比例、Flag 或 Signal，按闭集写到上述渲染字段，可带缓动。代价：渲染线新增一个组件 + 解释器（P3D 域），约同 E6 的体量；收益：所有 3D 游戏共用，数据驱动。
- **B · 游戏独有逻辑**：game628 宿主每帧手写胶水，直接改渲染字段。代价：游戏专属代码，每个游戏重写一遍，违反「游戏 = 数据」；收益：最快。
- **Lead 推荐 A。**

### G2 · 玩家拖拽环视幻象（**待 owner 判 A/B**·GAP-628-05）

- 实查：相机只按 `Camera3D` 数据算矩阵，全仓没有「指针拖拽 → 相机角度」的输入通路（3D 池路线图里一直是待长项）。
- **A · 下沉相机环视输入能力**：指针拖拽改 yaw / pitch，限角度、可回弹。
- **B · 改设计**：只用固定机位 + E6 剧情镜头，删掉 GDD 里「可环视」一句。
- **Lead 推荐 B**：玩法是点选热点，不需要自由环视；网页和手机上操作更简单。以后真有游戏需要再补。

### 不需要补（重组成立）

- 「火灭后热点不可点」：熄灭时用 `effect-apply` 的 `set-visible-tagged` 隐藏本章热点，隐藏物体不渲染也拾取不到。S3 骨架时补用例钉住即可。
- 文字、相册、字幕：UI 叠在 3D 画布上（LayoutNode），现成。
- 音频、存档、多语言：现成。

### 暂不做（YAGNI）

- 「整游戏 3D 资产一条命令构建」（按拆层单 + 动作清单串起 Tripo → 规范化 → 绑骨 → 搭景 → 导入）：各步命令都已存在，先用真实链路手动跑通一个角色，再决定是否值得做编排器。

## 三、不是引擎、但卡住开工的

| 项 | 谁 | 说明 |
|---|---|---|
| 真实服务配置 | owner | Tripo key、Blender LTS、Auto-Rig Pro 授权、Mixamo 账号、生图 key。到位前人物与场景只能走 Mock，不得标完成（GAP-628-03 锁 S6） |
| 三张单的独立复查 | 非本会话（如 Codex） | RB-MATERIAL、STYLETOKENS、DSYNC |
| 推设计系统到 Claude Design | owner | 跑导出命令后在会话里启动 `/design-sync` |
| 风格令牌定稿 | owner | 看一眼草案，改 `status: final` |
| 游戏级工单 | Codex 可做 | G628-07 文本改编、G628-09 动作清单、G628-06 UI 需求单（见 `requests.md`） |

## 2026-10-26 裁决补记（不重写上方历史盘点）

owner 已明确选择 G1=A、G2=B。G1转REQ-3D-RENDER-BIND并已抢锁，尚不能记交付；G2已把GDD改为固定机位+CameraShot3D剧情镜头，机读缺口标wontfix并留裁决来源。选择不等于人门签字或本作已完成。
