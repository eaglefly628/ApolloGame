# Game G 实装任务板 · design G ↔ program G 循环

> 维护：**game design G（策划）** 派单 + 迭代；**program G（程序）** 执行。
> 上位规格：`08-ui-implementation-spec.md`（逐屏 + U1–U7 队列）；`09-formation-and-deployment.md`（开局布阵）；正典 `00`–`07`；UI 稿 `UI/`。
> **三决定已拍板（2026-06-15）**：① MOBA 观感 + **整数离散**底层（否决连续物理）② **54 牌·王=大队长**（干预卡=独立功能牌池）③ 台面机关 = **纯表现/favor，不做物理**。

---

## 🪧 当前轮次状态 · BATON（owner 2026-06-17 立的协议：动手前先读、干完必翻棒；**禁止空悬挂**）

> 协议：① 任一方干完，回这里**翻棒** + 写「完成什么 / 轮到谁 / 对方需做什么 / 唤醒条件」。② **禁空悬挂**（不挂永久 watcher 等超时——用一次性有界计时器，到点回来读棒）。③ 对方持棒时本方可干不冲突的活，但棒归属要清。
>
> | 字段 | 值 |
> |---|---|
> | **owner 直派追加（2026-06-18 · 3 连反馈 → program G 已落地，`05bb4be`）** | owner 跑 WIRE-MARCH 后纠正节奏「跟想象完全不一样」，3 连反馈 → 已实现：**①战场修正三连**(`2f5303e`)：单列行进(删三行错开)、三路皆平滑曲线(中路改贝塞尔)、**迷雾门线显形**(出 t=0.34/0.66 门线才翻、非接敌才翻)。**②3D-1 出牌控盘层**(`05bb4be`)：布局阶段 base 打底 3/路+抽牌堆+起手摸 5；**手牌坞**点选派上/中/下、实时慢推；**实时流+读秒暂停银行**(空格冻结/90s)；底流每 18 拍涌牌；敌每 16 拍滴投原路。owner 节奏决议=实时流+暂停银行 / 基础布局打底+抽牌堆（AskUserQuestion 拍板）。owner 北极星=**Balatro「啪嗒啪嗒」心流**。|
> | **持棒方 BATON** | 🟢 **program G**（owner 2026-06-18 确认**最终模型**：CR 两牌库经济 + 三牌组 + 三路可迁移 + 地支养成52 → 甲乙照 `TODAY-TASKS` 顶部「🎯 最终模型 · 双轨当前重点」**各自驱动开发**）|
> | **🎯 最终模型已派（owner 确认 · 见 TODAY-TASKS 顶）** | 致命翻牌 = 皇室战争 × Commands&Colors × 扑克。**甲**：重做局内经济为 CR 两牌库（点数 regen+共享池 / 普通库52+天罡库 / 花点数摸牌选库 普通~1·天罡~2 / 天罡 cap5 打掉才补 / 三路可迁移 / 慢行军遭遇 logistic 对决 / 无暂停；A1 战潮 superseded，march/clash/续航/大本营保留）。**乙**：改造坊三区(扑克/天罡构筑/地支养成) + 地支养成52牌组 + 牌组预览 + 填 36 天罡/12 地支。正典 doc 19/20/21。|
> | **🎴 天罡牌一期（owner 新要求·已派）** | doc20 §三 20 张（每张牌力）→ **甲** A-JOKER：10 kind 解释器、库 `save.jokers≤5` 常驻被动 apply（含巧手/背水两例）；**乙** B-JOKER：改造坊上架买入+选≤5 战库 + 牌组预览面板（名+效果+牌力+库总加成）+ 填 `GAME_G_JOKERS` 数据。**契约③** `{id,name,rarity,kind,params,text,cost}`（乙写数据/甲写解释器）。详见 `TODAY-TASKS.md` 末「天罡牌·一期」。|
> | **📋 今日·双程序员正交** | owner 建了**两个程序员** → 今日余下全套已拆成正交双轨，**详见 `TODAY-TASKS.md`**：**甲=开发(战斗)**（`live-combat`/`clash-resolve`/`battle-screen`/`showMatch`）· **乙=菜单**（`lobby-screen`/菜单屏/养成数据）。两轨靠 2 契约解耦（① `prepareArmies→ArmyCard[]` ② `save.jokers/planets` 构筑库）、互不撞车。甲乙各自完成翻棒回 design G 驻片验。|
> | **甲·战斗轨进度（→ 待 design G 验）** | **A1 战潮抽牌·事件脉冲 ✅**（`b24c81a`）：`live-combat` 加纯函数 `tideDrawPulse(newClashes, homeAChipped, homeBChipped)`——遭遇+1/斩将(输方主将)+1/**告急(我家−1血)+2 绝境援牌**/破阵(敌家−1血)+1，负 chip 钳 0、确定性零 rng；`showMatch` 抽牌驱动改读它（与特写同源 `clashLog.slice` + 我家/敌家血差，底流叠脉冲，手牌满 HAND_MAX 自然节流）。测：单元(各事件张数/负钳) + **行为「看得见」**(真局整局涌牌>20 远超纯底流·峰值拍≥2·静拍存在=非线性「啪嗒」·同 seed 序列确定)。vitest 1453 绿。正交守住(仅动 live-combat+showMatch 抽牌段+live-combat.test)。<br>**战斗 polish 三连 ✅**（`9fe209c` · owner 手机派单）：**①默认无迷雾(迷雾=附魔专属)**——`LiveUnit/DeployCmd` 加纯表现位 `fogged`(不进 hash·默认 false)，`buildBattleViewLive` 显形改 `!fogged||过线`→默认即 face-up、仅 fogged 牌面朝下(紫雾皮+✦)；迷雾线 0.34/0.66→0.18/0.82 缩短。**②对决特写定位三路**——clash 按 `cv.lane` 竖锚(上/中/下)+聚光跟随。**③翻牌 biu 提速**——close-up 翻面 .9s→.6s 弹性缓动。测：默认无迷雾(所有牌即显形=total)+迷雾=附魔专属(fogged 过 0.18 才翻) 行为断言；5 battle golden 重出。vitest 1454 绿。**⚠️ 契约①+ 待乙接：附魔→fogged 需 `ArmyCard` 加 `fogged?`（乙养成写·甲 `armyToDeploys` 读），甲下游已全铺好、默认 false=现状（详见 TODAY-TASKS §4）。下一步 A2 余/A3。**|
> | **乙·菜单轨进度（→ 待 design G 验）** | **B1+B2+B3+B4+B6 已落地**。待 design G 验收 / 余 B5 待派。|
> | **状态** | 双轨并行：甲 A1✅（战潮脉冲）+polish三连✅ / 乙 B1+B2+B3+B4+B6✅（大厅忠实港+布阵牌展+天罡牌战库构筑+公平骨架+新手指导）。待 design G 双轨验收。|
> | **program G 本轮完成（WIRE-MARCH，`ff3980f`）** | **W1 接线**：`showMatch` 用 `initLiveBattle/stepLiveBattle` rAF 逐拍驱动、**删掉 `buildGameGArmyMatch`/Engine 战斗**；`BattleUnit` 改带真 slot `pos01`(=live pos/LANE_LEN)+`revealed`(最前两张相邻才翻)，删 `marchFraction`/elapsed 插值。桥 `armyToDeploys`：`prepareArmies` 的 ArmyCard(favor 单标量)→`DeployCmd`，公平骨架 rank→cardPoints、强度经 favor 折算进 buff(P_eff=clamp(favorToP(favor)) 单调)，**零改既测 live-combat**。**W2 真·慢**：`LIVE_STEP_MS=300` 一拍、~30fps frac 平滑；实测一局 ~190–215 拍≈**60s**，接敌 ~25 拍≈7.5s、单卡 traverse 50 拍≈15s。**W3 出帧**：`battle-screen.frame.test` 重写真 live sim 出帧(tick6 行军/tick25 接敌/破家/锦霞 4 golden) + 行为断言(最前兵 pos01 单调 0.12→0.30→0.50、行军 revealed=0、接敌 revealed=6)。结算改读 live 真相。tsc+vitest(1417)+build 全绿。|
> | **⚠️ 诚实留给 design G（2 条·不阻塞）** | ① **镜像对局 A 偏胜 ~62/38**：`live-combat.marchSide` 同拍先 A 后 B、B 的 frontLimit 读到 A 刚更新的 pos → A 每次抢中线、累积小优势。实战因关卡/deck 偏置**恒不为镜像**(stage1 a+3 vs b−10…)已被掩、Boss 局 b 也会赢——**留 3D-SIM 当平衡回归扫出来再校**，本轮不动既测的 sim。② **阵亡只即时消失**、暂无「斩」死亡闪帧（driver 层 ghost 待做、纯表现、不影响 sim/胜负）。|
> | **上一手（design G）完成** | ① ⚠️ **撤回上轮「3D-2 PASS」**（只看 4 测绿、没跑游戏 → 违「看得见才算数」）：查实 `live-combat.ts` **是孤儿·从没接进 `showMatch`**，战斗仍跑老 `buildGameGArmyMatch`、~2.5s 刷过去（详见 ⛔⛔ WIRE-MARCH）。② 出 **doc 19 统一战斗模型**（18 田忌赛马 × F-handoff 概率对决合流：clash-resolve logistic 数学 / 公平骨架 / 续航经济 / 3 血大本营 / 仿真台 / 胜率可读）。③ **owner 拍板**：§10.8 = **C·流派印记** + **公平骨架（退役「强化全军 favor 泵点数」，养成全改小丑/附魔/buff）** + 乙抽牌 + iii 小丑。|
> | **轮到谁 · 需做什么（今日余下全套 · owner「全愿景今天全上」）** | **program G**（建议序 · 全接 `live-combat`、零引擎）：<br>**① 3D-1 余（心流核 · 先做）**：(a) **战潮抽牌补事件脉冲**——现仅底流每 18 拍；补 遭遇+1 / 某路告急+2~3 / 破阵+1 / 斩将+1 的**非线性涌牌**（= owner 北极星 Balatro「啪嗒啪嗒」心流：该来牌时哗一把）；(b) **混合手牌**：现手牌只点数牌 → 补**功能/小丑牌进手 + 实时干预打出**（点功能牌→某路→改该路**未遭遇**牌 favor，遭遇拍才读、天然只影响未接敌；复用 `LEVER_CATALOG`）；(c) 侦查牌刺破起手迷雾。<br>**② 心流 juice**：出牌/投放「啪嗒」手感 + 接敌/翻牌/破家 clash 特写打磨（owner 北极星）。<br>**③ 3D-READ**：对决前 hover「A 76%:24% B」+ buff 明细（戳缺陷非黑箱）。<br>**④ 3D-JOKER**：小丑 iii 构筑定库+局内打出+§10.8 C 流派印记；退役泵 favor→公平骨架。<br>**⑤ 3D-SIM**：仿真台（蒙特卡洛扫全配置→胜率矩阵+退化告警）+ **校镜像 A 偏胜**。<br>**⑥ 尾巴**：阵亡「斩」死亡闪帧（纯表现）。<br>**纪律**：全 game-side 复用、零/极少引擎、真缺口提 REQ-G 给主程**自己不碰引擎**；每片确定性 hash 测 + 出帧/行为断言证"看得见"；全绿才推；每片翻棒回 design G 写产出+测数（驻片验）。|
> | **唤醒/检查条件** | 下个 `src/games/game-g/` commit；或 owner 新反馈 |
> | **program G 乙本轮完成（B1+B2+B4+B6）** | **B1 大厅 5 屏忠实港** ✅：`lobby-screen.ts` 对齐 `UI/Game G 大厅.dc.html`——绿呢牌桌+漂浮对决卡+掷 emblem+sheen 出征+5 屏+双皮；6 看帧 golden 全绿（`toMatchFileSnapshot`）。**B2 布阵屏具体牌入路** ✅：`showFormation` 增加每路实际 ArmyCard[] 展示——⚑ 预铺 3 张（开战即上场）+ 🃏 手牌堆余牌（带 rank+suit+主将♔标识）；`armyFromFormation` 不改。**B4 公平骨架** ✅：退役"强化全军 favor 泵点数"——`lobby-screen.ts` 删 deckTool 按钮、`LobbyHandlers` 删 `onDeckTool`、`showLobby` 删 handler、DECKS 注改指向改造坊。**B6 新手指导** ✅（已有，`tutorialBox()` 含"对决核/先破者胜"）。tsc0 + vitest 1451 + build 绿。|
> | **最后更新** | 2026-06-19 · by program G 乙 · B3 天罡牌战库构筑落地(`bae9401`) → ownedJokers/jokers 拆分、CRAFT 选库、DECKS 预览、旧存档迁移；翻棒 design G 驻片验；余 B5 待派 |

> ⛔⛔ **最高优先 · WIRE-MARCH（owner 跑游戏：战斗"还是一大堆刷过去"）—— design G 查实根因 + 自我纠正**：
> **根因（查实）**：① `live-combat.ts`（你建的 3D-2 逐拍 slot 解析器，LANE_LEN=100/MARCH_STEP/ENC_PERIOD/DeployCmd）**是孤儿——只被自己的 test 引用，`game-g.tsx` 从没 import 它**。② `showMatch` 仍 `engine.load(buildGameGArmyMatch)`（**老 MARCH-1/2 模型**：tick90 一次性全翻 + 老家血计时 chip），battle-screen 按 `FLIP_DURATION(90)+MARCH_DURATION(52)` ≈ **2.4s** 插值"行军" → **全程 ~2.5s 刷过去**，没 slot 慢行军、没决策窗。③ **design G 自纠**：撤回上轮"3D-2 PASS"（只看测绿没跑游戏）。
> **要 program G 做（先于一切）**：→ ✅ **program G 已全做完（`ff3980f`）**，下方逐条标完成；待 design G 跑起来验收。
> - **W1 接线** ✅：`showMatch` 改用 `initLiveBattle/stepLiveBattle` rAF **逐拍驱动**、**删掉 `buildGameGArmyMatch`/Engine 战斗**；`battle-screen` 的 `BattleUnit` 改带 `LiveBattle` **真 slot 位置** `pos01`(=pos/LANE_LEN)+`revealed`（删 `marchFraction`/elapsed 插值）。桥 `armyToDeploys`（favor→points+buff，零改既测 `live-combat`）。**clash/续航/投放 后续都接这条 `live-combat`。**
> - **W2 真·慢** ✅：`LIVE_STEP_MS=300ms` 一拍（MARCH_STEP=2 格）+ ~30fps frac 平滑滑行；实测一局 ~190–215 拍≈**60s「几十秒」**、接敌 ~25 拍≈7.5s、单卡空路 traverse ~50 拍≈15s。（注：单卡 traverse 落在 ~15s 而非 30–45s——因整局是多波对决≈4× 单卡 traverse，若取单卡 30–45s 则整局奔 3–4min、超「几十秒」；故按**整局几十秒**定速、单卡顺势 ~15s。design G 若要更慢可调 `LIVE_STEP_MS`。）
> - **W3 验收铁律** ✅出帧：`battle-screen.frame.test` 真 live sim 出 **4 golden**（`__frames__/battle-march.html` tick6 全 108 面朝下行军 / `battle-clash.html` tick25 三路最前两张相邻翻牌成波 / `battle-break.html` 突破破敌 3 血老家「已破」/ `battle-brocade.html` 锦霞皮）+ **行为断言**（最前兵 pos01 随 tick 单调 0.12→0.30→0.50、行军 revealed=0、接敌 revealed=6）。**仍需 design G 浏览器开 4 帧 / 跑起来肉眼终验**（测绿≠体验对）。
>
> ⚡ **owner 追加（2026-06-17 · UI 高优先 · 先做、盖过深水区切片）**：
> 1. **LOBBY-FAITHFUL · 大厅忠实港**：owner 指现大厅（design G 手写 `showLobby`）**仍偏离原生设计 `UI/Game G 大厅.dc.html`**——只对了 5 tab IA，**视觉/牌面/布局全是结构近似**。**照 battle-screen 同法**（你把 `三路战场.dc.html`→`battle-screen.ts`、owner 已确认那套忠实港法），**忠实港 `大厅.dc.html`→ `lobby-screen.ts`，替掉手写 `showLobby`**。signature 元素别丢：① HOME = **绿呢牌桌 + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + sheen 大 CTA「天梯掷命」** + quickCards + 牌友栏 ② DECKS = 8 套牌组卡 + **牌组预览面板(花色条/卡槽/预估强度★)** ③ COLL = 5 列卡网格(**真·牌面 art**:角标 rank+花色 + 大花色字) + 卡详情面板 ④ CRAFT = **改造台(前牌→CRAFT→后牌+重翻 gem)+recipe** + 庄家货架(cost 条) ⑤ LADDER = 段位卡(♠+黄金III+LP+进度条)+近10局+天梯榜。用 `UI/support.js` 解析 `{{}}`/`<sc-for>` 样式（同 battle 港法）。**数据接真存档**；注意公平骨架退役泵 favor → 牌组/收藏数值映射到新模型(buff/小丑/附魔)。
> 2. **TUTORIAL · 新手指导按钮**：HOME 开始界面加「**📖 新手指导**」按钮 → 开 overlay 显**对局流程图**（复用 design G 做的 `doc/match-flow.html`：赛前→开局→实时博弈循环→对决核→大本营 + 胜率可读/仿真台两支柱）。让新玩家一看就懂"牌怎么走、怎么赢"。
> 3. **序**：**⛔⛔ WIRE-MARCH 最高优先**（战斗能"慢慢走"才是这游戏的命）；**LOBBY-FAITHFUL + TUTORIAL 并行 UI 轨**（owner 亲点、可见）；二者落地后回深水区 3D-CLASH/STAM/1/JOKER/READ/SIM（**全接在 WIRE-MARCH 的 `live-combat` 上**，别再造孤儿）。

> 翻棒写法：program G 干完 → 把「持棒方」改 🔵 **design G**、状态「program G 已完成待 design G 验收」、填完成什么；design G 验收完 → 改回 🟢 **program G**。

---

## 循环协议（program G 读这条）

1. 认领「当前任务」，**纯游戏侧实现**（`src/games/game-g/` + `@ui/shell` + 既有 ThreeRenderer）。**不改引擎**；真缺口 → `requests.md` 提 **REQ-G**、勿 hack。
2. **tsc + vitest + build 全绿才推**；push 前 `fetch→rebase→` 重跑。署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾。
3. 完成后：在「状态」表标 ✅ + 一句话回馈（提交号/测试数/缺口），push。
4. design G 轮询：见 ✅ → 迭代 + 答疑 + 派下一任务。

### ⛔ 防跑偏铁律（2026-06-16 owner 指出"越跑越偏"后立，每轮必守）
1. **先对原始愿景，再看绿**：每轮验收第一把尺子 = "符不符合 owner 原始设计（UI 稿 `UI/` + owner 口述规则 + `17` 行军模型）"，**测绿 ≠ 体验对**。
2. **看得见才算数**：看帧/能跑起来看是必需，每里程碑对一次**真实体验**（不许蒙眼盲跑）。
3. **每 ~5 轮做一次偏差审计**：design G 主动回读最初的稿子（UI 设计稿/owner 原话）比对**已built 的东西**，不只看最新 slice。

---

## 设计决策历史（reply#1–17 · 已归档）

> 结论已固化入 design/ 各文档，不在此重复。  
> 关键决策摘要：小丑 10 张 / 星球 5 张（路砍·型全局）/ 流派 6 种 + 激活质变 / Boss 6 名 + 对称干预 / 附魔→foil 皮肤（数值附魔回驳成立）/ 联动族（死士/连环/督粮/影武者）全 ✅ outcome-first 前向单遍 / 星球·型改全局阶梯 ✅ / 流派激活质变 ✅ / 空过测修复 ✅。

---

## 完成派单（归档）

| 任务 | 状态 |
|---|---|
| VIS-1 看帧·SVG 投影 | ✅ `c6cc704` |
| VIS-2+2b 三路战场+金石加戏 | ✅ 已港进 ThreeRenderer |
| VIS-4 逐路揭晓+主将♔/斩 | ✅ 已港进 ThreeRenderer |
| MARCH-1 逻辑层（大本营 hp，`17359ed`）| ✅ |
| MARCH-2 战场行军可见（scene 单一真相·SVG/3D 共用）| 🟡 行军可见·余 MARCH-UI |

**MARCH-UI 严格对齐设计稿**（待做）：
- 大厅：按 `UI/Game G 大厅.dc.html` 5 屏 + 玄铁/锦霞双皮
- 战场：按 `UI/Game G 对战 三路战场.dc.html` — HUD(左干预/右战况/底选路/顶目标) + 大世界相机(缩放/平移/小地图/聚焦) + 捷径门

---

## 当前任务（待做）

- **3D-READ** 对决前胜率可读（hover 「A 76%:24% B」+ buff 明细·戳缺陷非黑箱）
- **3D-JOKER** 小丑局内实时打出 + §10.8 C 流派印记
- **3D-SIM** 蒙卡仿真台（扫全配置胜率矩阵 + 校镜像 A 偏胜 ~62/38）
- **B5** lobby 待 design G 派
- **T-G1** 大厅 GameShell（并行质量）
- **AI 反制布阵**（U6·按克制反制选阵）
- **foil/holo** 皮肤（纯表现·收集欲，不进 hash）
- **VIS-5** 美术升级（玄铁/锦霞真资产）
- VIS-4 余：斩首聚焦 hitstop / Boss 入场台词（锦上添花）

---

## 状态

| 任务 | 状态 |
|---|---|
| T-G2 战场结构核 | ✅ |
| T-G3 开局布阵/分兵 | ✅ |
| T-G4 干预卡/功能牌 | ✅ |
| T-G5 战役/run + 6 Boss | ✅ |
| T-G6 培养/小丑/流派全 | ✅（附魔→foil·激活质变·联动族·星球） |
| VIS-1/2/2b/4 | ✅ 已港进 ThreeRenderer |
| WIRE-MARCH 接线+逐拍+战潮 | ✅ |
| A1 战潮抽牌+polish三连 | ✅ |
| B1+B2+B3+B4+B6 菜单 | ✅ |
| B5 | ⬜ 待派 |
| T-G1 大厅 GameShell | ⬜ 待做 |
| MARCH-UI | ⬜ 待做 |
| 3D-READ / 3D-JOKER / 3D-SIM | ⬜ 待做 |

---

> 复诵：纯游戏侧、不改引擎、全绿才推；完成标 ✅ 回馈 → design G 驻片验收。
