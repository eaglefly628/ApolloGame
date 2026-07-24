# Pixel Pour ·《色流工坊》— 新立项（2026-07-23）

> 槽位 **game102**（owner 2026-07-23 拍板定槽）· 题材：**Pixel Flow（Loom Games / Scopely）核心玩法复刻**。
> 与已删旧作无关；GD 立项包落 `docs/design/game102/`。

## 槽位归属（owner 2026-07-23 已定）

**owner 拍板：本作即 game102**（不用字母槽，沿用 owner 的数字编号口径）。
现有字母槽 a/b/c/d/e/f/g/i/q/t/x/z 均无「传送带+同色消除」这类休闲玩法，本作为全新品类。
GD 阶段**只产 `docs/design/game102/` 文档**、**不改 `src/launcher.tsx`**；launcher 注册（加 `id:'game102'` GAMES 条目）
与源码目录由 PE/PST 在实现阶段落地（GD 域外·CLAUDE.md 域边界）。

## 状态

- 市场调研：✅ `market-research.md`
- 立项 brief：✅ `brief.md`
- GDD（核心设定+数值+关卡+商业化）：✅ `gdd.md`
- 能力总览 capability-plan：✅ **Lead 已裁决 ①（2026-07-23）**——先组合表达·零运行时游戏层例外·不预下沉（工单 `requests.md` REQ-G102-CAPREVIEW 已完结）
- Claude Designer 设计图文稿：✅ `pixel-pour-designer.html`（自包含可视化设计稿·已按实机截图校准）
- **UI 布局设计稿**：✅ `ui-layout-spec.html`（四屏·映射真实 LayoutNode 控件·零新控件需求·交 PUI 作 .dc.html/LayoutNode 1:1 基准）
- 可玩核心玩法参考原型：✅ `prototype.html`（像素画棋盘+钥匙+弹药20·实机校准·非引擎游戏代码）
- **PE 开工 handoff**：✅ `pe-handoff.md`（单文件入口·数据 schema + manifest 装配 + 能力接线 + 八阶段清单·从 S3 开工）
- **S4 验收剧本**：✅ `acceptance/`（8 份 `.scenario.jsonc` + README·GD 出·PE 只写适配器不改剧本）
- **特殊炮 spec**：✅ `special-cannons.md`（owner 2026-07-24 拍板：彩虹🌈+连锁🔗+激光⚡手动·追加补给区·可强制激活）→ 工单 REQ-G102-SPECIAL(PE) / REQ-G102-UI-2(PUI)
- **下一步（可派工开工）**：① **PE** 读 `pe-handoff.md` 从 **S3 骨架关**开工（`board game102`）；② **PUI** 据 `ui-layout-spec.html` 出 .dc.html + LayoutNode（工单 REQ-G102-UI）；两线可并行

## 角色与边界（CLAUDE.md）

- 本包由 **GD（游戏策划）** 产出：**只产数据与文档，零游戏层代码**。
- `prototype.html` = 设计参考 mockup（对标 game-a `guandan-lite-mockup.html`、game-c `layout-mockup.html`），
  用于向 owner/PE 传达核心手感，**不作为引擎/游戏层实现**；正式实现须走 §capability-plan → PE 数据装配。
- 正式游戏 UI 必须用 LayoutNode 纯数据（UI 铁律），play-field 走 render 组件+引擎渲染器。

## 阅读顺序

1. `brief.md` — 一分钟看懂做什么、为什么。
2. `market-research.md` — 市场依据（品类/商业数据/玩法拆解/竞品）。
3. `gdd.md` — 核心设定、数值表、关卡曲线、失败与商业化。
4. `capability-plan.md` — 数据驱动如何落地（消费哪些引擎能力、缺口在哪）。
5. `pixel-pour-designer.html` — 设计图文稿（可视化）；`prototype.html` — 上手试玩。
