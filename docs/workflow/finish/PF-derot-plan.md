# PF 执行计划 · game-f 去腐（LEAD→PF 交办落地）

> Programmer F ｜ 2026-06-14 ｜ 承 `requests.md` 的 `LEAD→PF` 去腐交办（game-f 由「程序」变回「数据」）。
> 原则：纯游戏侧；不为 game-f 特例往共享引擎堆能力（守 Lead 回驳的脉冲下沉边界）。每阶段独立绿、可推送。

---

## 〇、读交办后的关键发现（影响排期，先记账）

交办验收要求 `game-f.tsx → ~30 行薄 mount`（全 HUD 变 GameShell 数据）+ 商店脉冲改 `GameShell 按 CardPile.hand 渲染`。
**但实测 `@ui/shell` GameShell（Stage 1）是闭集节点**：`col/row/panel/tabs/text/stat/bar/button`。它能装：
- ✅ 顶栏（STAGE/相位/倒计时/连胜 = text+stat）
- ✅ 玩家卡（hp/xp/gold/攻岛进度/贡献/空席 = stat+bar）
- ✅ 简单按钮（开战/买经验 = button→signal）

**装不下**（超出闭集，需 GameShell 长出**通用**节点，属引擎侧/Lead 决策）：
- ❌ 商店卡面（带英雄图、按 `CardPile.hand` 列表渲染、点卡买入）—— 交办 item 3 的前提
- ❌ 点将台 / 三选一 弹窗（modal）
- ❌ 拖拽布阵（drag-place，画布交互）
- ❌ 牵绊栏（按势力/职业动态行）、装备格（grid）
- ❌ namelayer / ghostlayer（画布叠层：头顶名 + 敌阵预览）

→ **结论**：去腐的"展平 blueprint 生成器/脉冲""壳层数据化"**大部分可纯游戏侧做**；但「商店/富交互 HUD 完全 GameShell 化、30 行 mount」**卡在 GameShell 表达力**——需要 Lead 给 GameShell 加**通用** UI 节点（`card-grid`(绑组件列表+图)/`image`/`modal`/`drag-slot`），这些跨游戏复用（game-e 卡牌、game-d HUD 都吃）、**不是 game-f 脉冲下沉**，合规。已回写 requests.md 提请 Lead 评估（见末）。

---

## 一、分阶段（每步 tsc+vitest+build 全绿才推；1159 测试逐步守）

| 阶段 | 内容 | 依赖 | 风险 |
|---|---|---|---|
| **A** | `blueprint.ts` 生成器**展平为字面实体**：`band`(经济/利息/连胜/连败/伤害/贡献/攻岛 ~30 处)、`visSwap`、`chrome` 调用点 → 内联 JSON 实体（值算死写定值）。helper 删除或退化为纯数据常量 | 无（纯游戏侧） | 中（实体多，但产出逐字等价、测试守得住） |
| **B** | 顶栏 + 玩家卡 → GameShell `UILayout` 数据；按钮走 `ActionEnqueuer`（真输入，替假点击桥那几个）；删对应手写 DOM | 无（GameShell 现成节点够用） | 中（输入接缝从画布 clickable 改 action-map） |
| **C** | per-hero/per-stage 模板生成器（`templatesFor`/`slotEntity`/`heroOverrides` 循环）→ 评估能否展平为 manifest 数组（或界定为"合法数据展开"留 loader） | 无 | 高（最重，最易碰测试） |
| **D（阻塞）** | 商店脉冲清零 + 点将台/拖拽/牵绊/装备/叠层 全 GameShell 化 → 30 行 mount | **GameShell 通用节点（Lead）** | 阻塞，等引擎侧 |

排期：**A → B → C**（全游戏侧、不阻塞，逐步把"在数据里编程"压下来）；**D 待 Lead 给 GameShell 通用节点**后做。

---

## 一·补 执行进度（2026-06-15 更新）

- **A** ✅ 已达：`band/visSwap/chrome` 生成器构造已展平（Lead 复核确认）。
- **B** ✅ 已达：顶栏 + 主公卡 → `GAME_F_UI`（`game-f-ui.ts`）；`GameShell` mount；删手写玩家卡（72bc789）。
- **C** ✅ 界定结案：`makeRoundFlow`/`templatesFor`/`slotEntity` 经 Lead 裁为**合法薄展开器**（"数据驱动≠零函数"），**保留**，不计入"生成器构造"目标。
- **D（商店分项）** ✅ 已达：Lead 加 `image` 节点后，商店 = 3×(`image`+`button`)（`GAME_F_UI` 点将台面板）；
  - shop_face StringVar 投影（c53b243）；**canvas 两段脉冲（shop_marks/shop_marks2）+ 大卡模板 + 占位框 → 清零**（96e1fb2）。脉冲标记 114 → 0 ✅。
- **D（剩余）** ⛔ **浏览器视觉验证阻塞**：删重复 DOM HUD（`buildSoloHud`：底栏/点将台 modal/牵绊栏/装备格/叠层）+ 退役 ready/reroll/lock 假点击桥 + `game-f.tsx` → ~30 行薄 mount。
  - 卡点：GameShell 与 canvas 棋盘叠放后的实际渲染/拖拽/三选一 modal 显示**无头环境不可见**，删可见 DOM 即"无验证发布 UI"。
  - 另：三选一 rune modal、棋盘拖拽布阵仍属 DOM/canvas（Lead 裁：不归 GameShell），其假点击/叠层按设计保留。

## 二、不做（守边界）
- 不把 game-f 脉冲下沉成引擎能力（Lead 已回驳）。
- 不为 game-f 私货扩 GameShell；只在确属**通用**节点时请 Lead 评估（card-grid/image/modal）。
- lobby（局外，246 行）暂不动——交办聚焦局内壳 + blueprint；lobby GameShell 化等 D 一并。

## 三、验收对齐
- A 完：blueprint `band/visSwap/chrome` 生成器构造 → 0；实体为字面 JSON。
- B 完：顶栏+玩家卡为数据；那几个按钮假点击桥删除。
- C 完：模板生成器收敛（或明确界定合法 loader 展开）。
- D 完（待引擎）：脉冲 → 0；`game-f.tsx` → ~30 行薄 mount。
- 全程 tsc + vitest + build 绿。
