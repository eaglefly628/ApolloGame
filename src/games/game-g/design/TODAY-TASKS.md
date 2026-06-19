# Game G · 今日 Task（双程序员并行 · 正交）— 2026-06-18

> owner：今天**完成 Game G**。建了**两个程序员**，任务**正交**（互不撞车）：**甲 = 开发(战斗)** / **乙 = 菜单(大厅·布阵·养成屏)**。
> 正典：`doc 17/18/19`（战斗模型）+ `doc 20`（**天罡牌**养成层 · 原"小丑牌"已 owner 拍板正式定名「**天罡牌**」）+ `UI/Game G 大厅.dc.html`（菜单设计稿）。验收：design G 逐 commit 驻验（绿 + 出帧/行为断言 + 对愿景）。
> 🏷 **命名 + 牌组结构（owner 2026-06-18 拍板 · 乙照此重设计菜单）**：① 原"小丑牌"→ **天罡牌**、原"星球牌"→ **地支牌**。② **三独立牌组（不是"融入"）**：**扑克牌组**(52·上场打) / **天罡牌组**(局内法术) / **地支牌组**(第二轴·局外升档)——**改造坊分三区管理、取消"把点数牌融入小丑"旧概念**（doc20 §〇）。**菜单/UI/文案一律显「天罡牌」「地支牌」**；代码内部 `joker`/`planet` 标识符不强求改。
> ⛔ **局内经济大改（owner 2026-06-18 · 抄皇室战争 + 两牌库「前线」式 · 详见 `doc 21`）**：牌**不是时间到了就放** → **点数(圣水)回复 → 花点数摸牌·玩家选库**。**两个独立牌库**：① 普通库(52 点数牌·cycle·可囤积 ~7) ② 天罡库(法术·**上限 5·打掉才补**)。打牌：点数牌部署三路慢行军遭遇掷命 / 天罡牌施法。**砍读秒暂停**(纯实时)·快节奏(点数 regen 快·出牌快)。先破 3 血大本营。**取代**战潮/天机能量。**甲：`A1 战潮` superseded → 做 CR 两牌库点数经济**(march/clash/续航/大本营**保留**)。**乙：改造坊三区·构筑普通库 + 天罡库**(各 cost)。cost/regen 数值待真机调。
> **已落地（地基·勿重做）**：慢行军 / 对决核 logistic / 续航·3血 / 大厅忠实港骨架 / 3D-1 控盘层基础（手牌坞·实时派路·抽牌堆·读秒暂停）。tsc0/vitest1418/build 绿。

---

## 🎯 最终模型（owner 确认 2026-06-18）· 双轨当前重点（程序员从这开干）
> 设计定稿：**致命翻牌 = 皇室战争(点数·实时·推塔) × Commands&Colors(三路·牌驱动·掷骰) × 扑克(公平+养成)**。三独立牌组 + 两层。正典 `doc 19/20/21`。
> **一句话**：52 扑克(局内固定兵·公平) + 天罡(局内法术·点数抽) + 地支(局外养成 52 牌)；局内 **点数回复 · 两库共享池 · 花点数摸牌选库(普通~1/天罡~2) · 天罡 cap5 打掉才补 · 部署三路(可迁移) · 慢行军遭遇掷命对决 · 天罡施效果 · 先破 3 血大本营 · 无暂停**。

**🅰 甲 · 战斗｜当前重点 = 重做局内经济为「CR 两牌库」（取代战潮/天机能量 · A1 superseded）**
- 点数(elixir) **regen + 共享一个池**；快节奏（regen 快 / 出牌快）。
- **两库**：普通库(52 cycle · 大手牌囤积 ~7) + 天罡库；**花点数摸牌 · 玩家选库**（摸普通 ~1 点 / 摸天罡 ~2 点）；**天罡 cap 5 · 打掉才补**。
- 部署**上/中/下三路**；⭐ **经「捷径门」三路可迁移**（上↔中/中↔下 · 门开才通 · **天罡牌可开/关门** · 增援/堵敌 · 原战场设计稿就有）。
- 慢行军 → **遭遇 logistic 对决** → **天罡牌打出施效果** → **3 血大本营 · 无暂停**。
- march/clash/续航/大本营**保留**；复用 `live-combat`/`clash-resolve`。详 `doc 21`。

**🅱 乙 · 菜单｜当前重点 = 三牌组改造坊 + 地支养成 + 天罡/数据**
- 改造坊**三区**：① 扑克(52·看) ② 天罡(构筑天罡库) ③ **地支(养成区)**。
- ⭐ **地支 = 养成你的 52 牌组/军队**（收集不同地支牌 → 升级牌组底盘 · doc20 §三 12 地支）。
- 天罡库构筑 + **牌组预览**（战库天罡 名+效果+牌力 + 库总加成 + 地支已升档）。**UI 显「天罡牌/地支牌」**。
- 填数据：**36 天罡**(doc20 §二) + **12 地支**(doc20 §三)。

**契约（不变 · 防撞车）**：① `prepareArmies→ArmyCard[]` ② save 牌库(普通/天罡/地支)+构筑 schema ③ `GAME_G_JOKERS {kind,params}`。甲只改战斗文件 / 乙只改菜单文件 / `game-g.tsx` 各改各函数。

---

## ⛓ 正交边界（铁律 · 动手前必读）

1. **只改自己「拥有」的文件/函数**；对方的**只读**。
2. **`game-g.tsx` 是共享文件**：甲只动 `showMatch` + 战斗驱动函数；乙只动 `showLobby`/`showFormation`/`showPrep`/`showBetween` + 菜单装配。**`mount()` 路由骨架 + 顶部 import 块 = 冻结**——要加 import 各加各的行，**别重排、别删对方的**。
3. **`blueprint.ts` 归乙**（养成数据 + 布阵→army）；甲**只读**。甲要新战斗常量 → 放自己文件（`live-combat.ts`/`clash-resolve.ts`），**不写 blueprint**。
4. **两个接口契约（先各确认、不许私改 shape）**：
   - **① `prepareArmies(setup) → { a, b: ArmyCard[] }`**：乙改"布阵/养成 → 军队"的产出逻辑，**甲只认 `ArmyCard[]`**（`{id,rank,suit,favor,lane,general}`）这个 shape 不变。
     - **①+ 扩展提案（甲提·2026-06-18·待乙接·非破坏）**：owner 定「出场带迷雾=附魔专属·默认无」。甲下游已全铺好 `fogged`（`LiveUnit`/`DeployCmd.unit.fogged?`/`battle-screen` 默认 false=现状·不进 hash）。**乙若做"迷雾附魔"**：给 `ArmyCard` 加可选 `fogged?: boolean`（附魔养成写），甲 `armyToDeploys` 读它→`DeployCmd.unit.fogged`。不加=保持默认无迷雾，**不破现有 shape**（甲已不依赖该字段存在）。
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
| **B3 ⭐ 重设计** | **改造坊三牌组（owner 纠偏·不融入）** | **取消"把点数牌融入小丑"！** 改造坊**分三区**：**扑克牌组**(52·看/改造) · **天罡牌组**(选 ≤5 进战库 `save.jokers`·契约②) · **地支牌组**(`save.planets`·升档)。三组**各自独立、互不融合**。+ §10.8 C 流派印记（集齐解锁轻被动）。UI 显「天罡牌/地支牌」。|
| **B4** | **公平骨架** | 退役"强化全军 favor 泵点数" → 牌组/收藏数值映射新模型(buff/小丑/附魔)。**保持 `prepareArmies→ArmyCard[]{favor}` 接口不变**（甲读）。|
| **B5** | 收藏屏 / 天梯屏 | 真牌面 art + 花色/点数/稀有度筛选 / 段位 + 全服榜（接真存档）。|
| **B6** | 新手指导 overlay | HOME「📖 新手指导」按钮 → 开 overlay 显 `doc/match-flow.html` 对局流程图。|

---

## 验收（design G 驻片）
每片：① 对愿景（doc 17/18/19 + 大厅设计稿）② 绿（tsc+vitest+build）③ **看得见**（出帧/行为断言，非空绿）。甲乙各自完成 → 在 `PROGRAM-G-TASKS.md` BATON 翻棒回 design G、写产出+测数。

> 一句话：**甲把"边打边投的心流博弈"做满（A1 脉冲领衔），乙把"大厅+布阵+养成"对齐设计稿做满（B1 大厅领衔）；两条轨靠两个契约（ArmyCard[] / save 构筑库）解耦，互不撞车。今天收口 Game G。**

---

## 🎴 天罡牌·一期（20 张）双轨派单（doc 20 §三 · 继 B3 战库地基 · owner 新要求）
> owner：天罡牌逐期加厚，先建**一期 20 张**（每张带牌力）。库地基(`ownedJokers`/`jokers ≤5`)乙已落(B3)。现填这 20 张的**效果 + 改造坊上架 + 预览**。**完成 = 养成层能玩。**

**🅰 甲 · A-JOKER 天罡牌一期效果（战斗侧 · 库里常驻被动 apply）**
- ⭐ **天机能量经济 + draft（doc20 §〇基础 · owner 共设计 · 触发模型已变）**：开局**三选一**激活 1 张（非 5 张全开局被动）；战斗中"打击"(对决胜/翻正/破阵)产**天机能量** → 攒够**选择**：抽/激活一张天罡牌 or 别的操作(重摇/改命)。新建天机能量资源 + 选择 UI（你的战斗地盘·零引擎）。**初值待 owner 推敲定**（doc20 §〇开放：起手方式/能量来源/操作清单）。
- **10 kind 解释器**：每 kind 一个解释器（`odds/power/combo/morale/tempo/stamina/draw/lane/siege/arcane`），**激活后的**天罡牌 apply 进 `prepareArmies`/`clash-resolve`/`live-combat`（读已激活集，复用现成 buff 源）。20 张 = kind × 参数。
- **20 张 = kind × 参数**（doc20 表的数据形）。**牌力对齐**：每张配测断言其 ΔWR 量级与 §三 P̂ 大致符。
- odds/tempo 等需 `live-combat` 暴露挂点（你的地盘）；零引擎。含 owner 两例：**巧手**(odds +1)、**背水**(odds reroll afterLoss)。

**🅱 乙 · B-JOKER 天罡牌一期 · 改造坊上架 + 牌组预览（菜单侧）**
- 改造坊：20 张天罡牌**上架**（材料买 → `ownedJokers`）+ **选 ≤5 进战库**（`jokers`，B3 框架已有，填 20 张数据 + UI）。
- **牌组预览面板**（doc20 §四 · owner 点名）：主页/牌组屏显**战库 ≤5 张**每张【名 + 效果 + 牌力⭐ + P̂】+ **整库总加成汇总**（点数总+ / 胜率总+ / 流派印记亮灯）。Balatro 式一眼看懂强度来源。
- 数据：20 张 名/描述/牌力/稀有/cost（doc20 §三）→ 填进 `GAME_G_JOKERS`（你的养成数据地盘）。**UI 文案显「天罡牌」。**

**契约③（新增·先对齐再各做）**：`GAME_G_JOKERS` 每张 = `{id,name,rarity,kind,params,text,cost}`（doc20 §三数据形）。**乙写这份养成数据、甲写 kind 解释器读它**。先把 `{kind,params}` schema 钉死（doc20 §三 10 kind）再并行。

> **⏳ 甲催乙（2026-06-19 · A-JOKER 卡数据）**：CR 两牌库经济 + 三路迁移已落（甲），战斗里**天罡能摸/能打/能循环**，但**施法暂无数值效果** —— 因为 `GAME_G_JOKERS` 还是**旧 JokerCard 形**（`kind: suit-synergy/polarize/morale/lane-pref/diehard/link…` + `amount/lane/moraleMul`），**不是** contract③ 的 doc20 §三 10-kind `{kind,params}`（`odds/power/combo/morale/tempo/stamina/draw/lane/siege/arcane`）。
> **请乙**：把 `GAME_G_JOKERS` 迁到 contract③ 形、填 **36 天罡（或先一期子集）** 的 `{kind,params}`（doc20 §二 数据形）。**甲这边 A-JOKER 10 个 kind 解释器一拿到数据就能接**（读已激活集 → apply 进 `prepareArmies`/`clash-resolve`/`live-combat`，复用现成 buff 源·零引擎）。**schema 不动代码、纯数据**，最弱 LLM 可填。

