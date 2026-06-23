# Game G · 非-UI 数据腐烂审计 + 数据驱动化路线（Lead · 2026-06-23）

> **尺子（宪法 `data-driven-manifesto.md`）**：「最弱的 LLM 能不能也产出一模一样的数据？」
> 能 → 数据接口；不能（要写自由代码）→ 拒绝，做成 DSL 或下沉成 capability。
> **范围**：**排除 UI**（UI 架构另由架构程序员基于 Apollo 重做；本审计不碰 `lobby-*`/`turn-battle-screen`/`game-g.tsx` 表现层）。聚焦**战斗 / 数据 / 装配**层。

## 0. 现状一句话
上一轮去腐已退役「旧实时战斗核 `live-combat` + 旧战斗屏」。剩余非-UI 腐烂收敛为 **3 簇**，按价值排序。
模范公民 `clash-resolve.ts`（logistic 胜率解算核·确定性纯函数）= 正是「该是代码的代码」，**保留不动**。

---

## 簇 1（P0 · 数据驱动头号）：效果系统「半截数据化」

**腐在哪**
- 两个宽结构体：`TengangFx`(22 字段) / `DishaFx`(21 字段)。每张天罡/地煞 = `Partial<Fx>`，`aggregate*` 手工逐字段相加。
- `turn-combat.ts` 逐字段硬编码 apply：`b.dishaB.firstStrike` / `.lastStandGeneral` / `.phalanxPerAdj` / `.batteryEveryTurns` / `fx.noRout`… 散落 8+ 处。
- `tengangFxOf`（`game-g-build.ts`）是一座**桥**：把**已数据化**的 `TiangangCard.params`（`{op,value,filter,scope}`）用一长串 `kind+op` if-else **编译回**老宽结构体。
- 地煞**根本没数据化**——连 `params` 前脸都没有，纯宽结构体。

**尺子判定**：加一个新 Boss 战术（地煞）= 改结构体字段 **+** 改 aggregator **+** 在 combat 写 apply 代码。最弱 LLM 产不出「纯数据新地煞」。**FAIL**。

**正确形态就在仓库里**（`tiangang-data.ts`）：`params = {op:'add',value:1}` / `{op:'mul',value:1.5,filter:'highest'}` / `{op:'killGeneralRout'}` / `{op:'revenge',value:14}`——通用 op+params，注释已写「甲写解释器读」。新卡 = 纯数据。**PASS**。

**目标架构**：把 params op-DSL 立为**唯一真相**，天罡地煞共用。一个 op 声明三件事：
- **何时（hook）**：`clash` / `turn-start` / `advance` / `home` / `onPlay`
- **作用于谁（target filter）**：全军 / 最前 / 最强 / 同路相邻 / 主将 / 某路 …
- **改什么（modifier）**：+点数 / ×倍率 / +胜率 / +胜率下限 / 先手 / 不溃 / 2命 / +源泉 / 定时压路 …

`turn-combat` 里写**一个**解释器：按 hook 分发、吃 op-list。删掉两个宽结构体 + `tengangFxOf` 桥 + 逐字段 apply。

**判定：做（最高价值），也是最硬的一块。** 内容在持续长（36 天罡 + 关 6-20 地煞包），每个现在都要写代码 → 解释器立刻回本且复利。这是把「效果解释器」作为确定性能力**下沉进战斗核**——正合纲领。**非 YAGNI**。
**做法**：先定 op schema；**天罡先迁**（DSL 已就绪）→ **地煞再迁**；全程 `turnHash` 回归绿（行为不漂移）；大改走分支。

---

## 簇 2（P1 · 去腐 + 结构）：`blueprint.ts` 920 行杂货铺 + 退役引擎/3D/行军子系统靠测试续命

**腐在哪**
- `buildGameG3DFlip` / `buildGameGDuel3D` / `buildGameGArmyMatch` / `decideFaceUp` / `flipCardEntity` / `flip*` / `FateCard` / `MARCH_*` / `MATCH_*` —— **零生产引用**（唯一「引用」是 `clash-resolve.ts` 一句注释「取代 decideFaceUp」）。只剩 3 个 oracle 测试（`game-g.test` / `.battle` / `.growth`）续命。这是与 `live-combat` 同源的**另一条退役血脉**（引擎/3D 装配），尚未清。
- 920 行一个文件混了三种东西：**(a)** 上述退役子系统；**(b)** 活数据表（`FORMATION_PRESETS` / `BETWEEN_BUFFS` / `LEVER_CATALOG` / `standardArmy` / `BOSS_ROSTER`）；**(c)** 活逻辑（`resolveArmy` / `rankFavor` / `prepareArmies` / `applyTiangangs` / archetype）。

**目标**
- **(2a)** 删退役引擎/3D/行军/duel builders + 对应 oracle 测试断言（**需拆**——3 个测试同时测了活数据层，不能整文件删）。
- **(2b)** `blueprint.ts` 拆成：数据叶子（`formations-data` / `buffs-data` / `levers-data` / `army-data` / `boss-roster-data`，对齐现有 `campaign-data` / `tiangang-data` / `dizhi-data` 命名）+ 一个薄 build/逻辑模块。

**判定：做。** (2a) 纯去腐（删死码·镜像 `live-combat` 退役）；(2b) 结构卫生。低风险（除测试需拆活/死断言）。清晰度 ROI 高。
**做法**：(2a) 可上主干（纯删·像 `battle-screen.ts` 那次）；(2b) 走分支。

---

## 簇 3（P2 · 数据驱动 · 同族小腐）：杠杆 levers + 流派 archetype
`LEVER_CATALOG`(`Record<LeverKind>`) + apply 里 `iv.kind==='decapitate'` switch —— 同 disha 的小号腐烂。
**别单独写 lever 解释器**：等簇 1 的 effect-op DSL 落地，把杠杆效果**折进同一 DSL**。在此之前不动（只 6 个杠杆·不阻塞）。

---

## 保留（是对的代码 · 别碰）
- `clash-resolve.ts`：logistic 胜率解算核·确定性纯函数 —— 模范「固定解释器」。
- `*-data.ts`（campaign / tiangang / dizhi / economy）+ `hero-codex` + `portraits`：已是数据叶子（上一轮去腐成果）。

---

## 推荐次序（尊重并行 UI 重写 + 主干稳定）
| 步 | 内容 | 分支 | 风险 |
|---|---|---|---|
| **0** | 退役死的引擎/3D/行军 builders + oracle 测试（簇 2a）。镜像 `live-combat` 退役·纯删 | **可上主干** | 低 |
| **1** | 设计 effect-op DSL（op/hook/target）+ 写解释器；天罡先迁→地煞迁（簇 1）。`turnHash` 全程绿 | 分支 | 中-高 |
| **2** | 拆 `blueprint` 数据叶子（簇 2b）+ 折杠杆（簇 3） | 分支 | 中 |

行为保持（`turnHash` 回归绿）；大重构走 `claude/kind-gates-xtajic`（主干不要动）；纯删可走主干。

## 为什么这是对的（非过度设计）
effect-op DSL 是「owner 要个新 Boss 战术 → **甲写代码**」（今天）和「→ **谁都能写一行数据**」（目标）之间的差。这正是宪法的全部意义。
