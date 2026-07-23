# Pixel Pour ·《色流工坊》— 新立项（2026-07-23）

> 代号 **game102**（owner 口径）· 题材：**Pixel Flow（Loom Games / Scopely）核心玩法复刻**。
> 与已删旧作无关；本包为 GD 立项候选，落 `docs/design/pixel-pour/`（尚未占用字母槽）。

## 槽位归属（待 owner 拍板）

现有槽位 a/b/c/d/e/f/g/i/q/t/x/z 均已占用，且无「传送带+同色消除」这类休闲玩法。
本包**暂不占字母槽**、**不改 `src/launcher.tsx`**，待 owner 指定正式字母（建议 game-p）后，
整目录改名迁入即可（迁移=一次目录 rename + launcher 加一行 GAMES 条目）。

## 状态

- 市场调研：✅ `market-research.md`
- 立项 brief：✅ `brief.md`
- GDD（核心设定+数值+关卡+商业化）：✅ `gdd.md`
- 能力总览 capability-plan（开工前必过审）：✅ 草案 `capability-plan.md`（**待 Lead 评审**）
- Claude Designer 设计图文稿：✅ `pixel-pour-designer.html`（自包含可视化设计稿）
- 可玩核心玩法参考原型：✅ `prototype.html`（GD 设计参考·非引擎游戏代码）
- 引擎能力缺口：⏳ 见 capability-plan §2/§4，需 Lead 裁决后走 requests.md 下沉

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
