# Game G · 今日 Task（双程序员并行 · 正交）— 2026-06-18

> owner：今天**完成 Game G**。建了**两个程序员**，任务**正交**（互不撞车）：**甲 = 开发(战斗)** / **乙 = 菜单(大厅·布阵·养成屏)**。
> 正典：`doc 17/18/19`（战斗模型）+ `UI/Game G 大厅.dc.html`（菜单设计稿）。验收：design G 逐 commit 驻验（绿 + 出帧/行为断言 + 对愿景）。
> **已落地（地基·勿重做）**：慢行军 / 对决核 logistic / 续航·3血 / 大厅忠实港骨架 / 3D-1 控盘层基础（手牌坞·实时派路·抽牌堆·读秒暂停）。tsc0/vitest1418/build 绿。

---

## ⛓ 正交边界（铁律 · 动手前必读）

1. **只改自己「拥有」的文件/函数**；对方的**只读**。
2. **`game-g.tsx` 是共享文件**：甲只动 `showMatch` + 战斗驱动函数；乙只动 `showLobby`/`showFormation`/`showPrep`/`showBetween` + 菜单装配。**`mount()` 路由骨架 + 顶部 import 块 = 冻结**——要加 import 各加各的行，**别重排、别删对方的**。
3. **`blueprint.ts` 归乙**（养成数据 + 布阵→army）；甲**只读**。甲要新战斗常量 → 放自己文件（`live-combat.ts`/`clash-resolve.ts`），**不写 blueprint**。
4. **两个接口契约（先各确认、不许私改 shape）**：
   - **① `prepareArmies(setup) → { a, b: ArmyCard[] }`**：乙改"布阵/养成 → 军队"的产出逻辑，**甲只认 `ArmyCard[]`**（`{id,rank,suit,favor,lane,general}`）这个 shape 不变。
   - **② `save.jokers[]` + `save.planets{}` = 构筑库**：乙（改造坊）**写**、甲（战斗）**读**（seed 抽牌堆 + 局内打出）。schema 不变。
5. 各自 push 前 `fetch → rebase →` 重跑 **tsc + vitest + build 全绿**；各自配测；翻棒只写自己那半（BATON 各占一行）。
6. 撞到契约要改 → **先在本文件改契约 + 知会对方**，再动代码。

---

## 🅰 开发任务（战斗 gameplay）— 程序员 **甲**

**拥有（只你改）**：`live-combat.ts` · `clash-resolve.ts` · `battle-screen.ts` · `game-g.tsx` 内 `showMatch` + 战斗驱动（`armyToDeploys`/`favorToP`/`snapLivePos`/`buildBattleViewLive`/`control`/rAF 循环）· 新建 `sim.ts` · `battle-screen.frame.test.ts`/`live-combat.test.ts`/`clash-resolve.test.ts`
**只读不改**：`blueprint.ts`（读 `prepareArmies→ArmyCard[]` / `LEVER_CATALOG` / `GAME_G_JOKERS`）· `save.jokers/planets`（读构筑库）· `lobby-screen.ts`

| # | 任务 | 要点 |
|---|---|---|
| **A1 ⭐** | **战潮抽牌·事件脉冲**（owner 北极星 Balatro「啪嗒」心流·**最缺·先做**）| 现仅底流每 18 拍；补**非线性涌牌**：遭遇 +1 / 某路告急 +2~3 / 破阵 +1 / 斩将 +1。该来牌时"哗"一把。`live-combat` 暴露这些事件、`showMatch` 抽牌驱动读它。|
| **A2** | **心流 juice** | 出牌/投放的「啪嗒」手感反馈 + 接敌/翻牌/破家 clash 特写（爽点）。纯表现层。|
| **A3** | **功能牌进手 + 实时干预打出** + 侦查牌 | 手牌里加功能牌；点功能牌→某路→改该路**未遭遇**牌 favor（遭遇拍才读、天然只影响未接敌·不破 hash；复用 `LEVER_CATALOG`）。侦查牌刺破起手迷雾。|
| **A4** | **3D-READ 胜率可读** | 对决前 hover「A 76% : 24% B」+ 展开 buff 明细（戳缺陷、非黑箱老虎机）。`battle-screen` 侧。|
| **A5** | **小丑局内打出执行** | 读 `save.jokers`（契约②）→ 抽到打出触发效果。**乙做"构筑选哪些进库"，你做"局内抽到打出生效"。**|
| **A6** | 阵亡「斩」死亡闪帧 | 现在阵亡直接消失 → 加死亡闪/ghost（纯表现·不动 sim）。|
| **A7** | **3D-SIM 仿真台** | 新 `sim.ts`：离线蒙特卡洛扫全配置 → 胜率矩阵 + 退化告警（统治解/死牌红牌）。**顺带扫出并校"镜像 A 偏胜 ~62/38"**那条。|

---

## 🅱 菜单任务（大厅 · 布阵 · 养成屏）— 程序员 **乙**

**拥有（只你改）**：`lobby-screen.ts` · `game-g.tsx` 内 `showLobby`/`showFormation`/`showPrep`/`showBetween` + 菜单 view/回调装配 · `blueprint.ts` 养成数据（`GAME_G_JOKERS`/`PLANETS`/`FOILS` / 牌组 favor·公平骨架 / `Formation`/`armyFromFormation`）· `lobby-screen.frame.test.ts`
**只读不改**：`live-combat.ts`/`clash-resolve.ts`/`battle-screen.ts`/`showMatch`

| # | 任务 | 要点 |
|---|---|---|
| **B1 ⭐** | **大厅 5 屏忠实港·收尾**（owner 亲点·先做）| 逐屏对 `UI/Game G 大厅.dc.html`：HOME 招牌(✓绿呢牌桌+对决卡+sheen CTA) / DECKS **牌组预览面板**(花色条/卡槽/预估强度★) / COLL **真牌面 art**(角标 rank+花色+大花色字)+卡详情 / CRAFT **改造台**(前牌→CRAFT→后牌+重翻 gem)+货架 / LADDER **段位卡**(♠+黄金III+LP+进度)+近10局+榜。用 `UI/support.js` 解析样式。|
| **B2** | **布阵屏「指派具体牌入路」** | owner 原话"选哪些扑克走上路"：每路选**基础布局**牌 + 余进抽牌堆（改/补现 ±军官数）。**产出仍经 `prepareArmies → ArmyCard[]`（契约①·甲读）**。|
| **B3** | **改造坊：小丑 iii 构筑定库** | 选哪些小丑/星球/附魔进战斗库 = 写 `save.jokers/planets`（契约②·甲局内读打出）+ **§10.8 C 流派印记**（集齐解锁轻被动）。|
| **B4** | **公平骨架** | 退役"强化全军 favor 泵点数" → 牌组/收藏数值映射新模型(buff/小丑/附魔)。**保持 `prepareArmies→ArmyCard[]{favor}` 接口不变**（甲读）。|
| **B5** | 收藏屏 / 天梯屏 | 真牌面 art + 花色/点数/稀有度筛选 / 段位 + 全服榜（接真存档）。|
| **B6** | 新手指导 overlay | HOME「📖 新手指导」按钮 → 开 overlay 显 `doc/match-flow.html` 对局流程图。|

---

## 验收（design G 驻片）
每片：① 对愿景（doc 17/18/19 + 大厅设计稿）② 绿（tsc+vitest+build）③ **看得见**（出帧/行为断言，非空绿）。甲乙各自完成 → 在 `PROGRAM-G-TASKS.md` BATON 翻棒回 design G、写产出+测数。

> 一句话：**甲把"边打边投的心流博弈"做满（A1 脉冲领衔），乙把"大厅+布阵+养成"对齐设计稿做满（B1 大厅领衔）；两条轨靠两个契约（ArmyCard[] / save 构筑库）解耦，互不撞车。今天收口 Game G。**
