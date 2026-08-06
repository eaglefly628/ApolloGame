# 能力总览 Capability Plan — game108《拳律 / Rule of Three》（S2 送审稿 **v2.0**）

> Lead session · 2026-08-06 · **v2 = 随 GDD v2 超休闲重构同步改写**（v1 全文查 git 历史）。
> 立项卡=`brief.md` · 规则语义=`gdd.md`（条款 `【R-108-NN】`）。
> **形态 = 编译期 TS 游戏**（局外元层 + 六屏）· slot = `game108`。
> **plan 未过审不写游戏层系统代码**（CLAUDE.md 能力总览铁律）。
> 能力名对照 `src/skills/{atoms,tier1,tier2,tier3}` 真实 `id` 逐个核准（口径以 registry 为准）。

## 0. v1 → v2 能力面变化摘要

**净减**：整条卡牌线删除（`t2-card-pile` / `t2-card-play` / 洗回）——v1 的手牌与弃牌区被 owner 判为记忆负荷，
由**公开蓄力槽**承接信息层。`t2-craft-recipe` 大幅缩水（洞察点资源规划已删）。`t2-stats` 删除（虚胖·HP 用 `Resource` 足够）。

**净增**：三时区节拍（`t3-flow` + `e1-timer`）· 六条蓄力槽（`f1-resource` × 6 + 可见绑定）。

**升级**：判定表要在**对局进行中**被逆转碎片改写【R-108-42】——`t2-matrix-duel` 已落地且**每拍重 fold patches**，此需求零成本满足。

## 1. 游戏一句话

六条公开蓄力槽 + 秘密同时出招 + 当场凿改胜负规则的猜拳对决；一场 60-90 秒，零记忆零算术。

## 2. 消费的引擎能力（对照 registry 实名）

| capability（注册 id） | 用来做什么 | 状态 |
|---|---|---|
| **`t2-matrix-duel`** | **同时决策 × 收益矩阵结算**：判定表 + 补丁（beats/payoff/add-throw）+ 胜负 + 扣血 + 具名信号【R-108-01/12/40/42】 | ✅ **现有**（`REQ-MATRIXDUEL` 已落地·`5bfa84f48`·Lead 终审 PASS） |
| ↳ `payoff` 支持蓄力缩放 | 伤害 = base + **出手方**蓄力 × step【R-108-13】 | 🔴 **打回返工**（`e3a568fb` 已落但**取不到「按侧」**·实测证伪·`REQ-108-ENG-01` 重开·**S3 卡口未解除**） |
| `x3-string-variable` + `t2-event-when` + `t2-effect-apply` | **出过的手蓄力清零**【R-108-14】：记本回合所出手 → 6 条静态规则（3 手 × 2 侧）置零 | ✅ 现有（**重组·不开单**） |
| `t3-flow`（`GameFlow`） | **三时区四拍状态机**（T1蓄力→T2出招→T3对决→T4结算）+ 对局胜负收束 + 爬塔层进【R-108-01/15/50】 | ✅ 现有 |
| `e1-timer`（原子） | 每时区 3/3/2/1 秒倒计时 + 超时顺延【R-108-02】 | ✅ 现有 |
| `f1-resource`（原子） | **六条蓄力槽**（双方各三）· 双方血量 100 · 烟雾次数【R-108-03/10/15/20】 | ✅ 现有 |
| `t2-event-when`（`EventWhen`+`Signal`） | 条件成立发信号：蓄力满锁定、血量 ≤50 触发逆转、HP≤0、AI 策略规则命中【R-108-10/42/15/30】 | ✅ 现有 |
| `t2-effect-apply`（`Effect`） | 信号改世界：蓄力 +1 / 扣血 / 给碎片 / 开关烟雾旗【R-108-10/13/20】 | ✅ 现有 |
| `t2-weighted-spawn`（`WeightedSpawn`） | AI **两次**决策各按权重表确定性抽取（T1 蓄哪手 / T2 出哪手·消费世界 `RandomSeed`）【R-108-30】 | ✅ 现有（**出招落点改经 `REQ-108-ENG-02` 的 `intentSignals`**——weighted-spawn 只产 `SpawnRequest`，挂不了 intent） |
| `t2-self-rule`（`SelfRule`） | 对手实体读自身状态施自身效（血少改段 / 蓄满必兑现）【R-108-32】 | ✅ 现有 |
| `t2-modifier-stack`（`ModifierSource`+`ModifierTotals`） | 遗物对**收益**的加成聚合（重拳 +10 / 铁布衫 −10 / 回响 +20）【R-108-43】 | ✅ 现有 |
| `t2-craft-recipe`（`CraftRecipe`） | 花费换取：**烟雾**（扣 1 次数 → 置隐藏旗）【R-108-20】 | ✅ 现有 |
| `f2-flag`（原子） | 烟雾隐藏旗 · 蓄满锁定旗 · 逆转已触发旗【R-108-10/20/42】 | ✅ 现有 |
| `t3-timeline`（`Timeline`） | 演出节拍：亮拳三连 cue / 石板凿改重刻 / 雾散曝光（cue 只发信号）【§13】 | ✅ 现有 |
| `t3-dialogue`（`Dialogue`） | 对手表演台词（UI 侧 `dialog`/`portrait` 投影消费）【R-108-31】 | ✅ 现有 |
| `t2-text-binding` | 数值→文案（伤害数 / 蓄力值 / 血量） | ✅ 现有 |
| `w1-random`（`RandomSeed`）+ `chancePass`/`randomInt` | **一切随机**：AI 两次抽选 / 破绽概率门 / 二选一抽取【R-108-30/31/41】 | ✅ 现有 |
| `j1-state` / `x3-string-variable` | 对手段位状态 / 表演台词键 | ✅ 现有（原子） |
| UI：`LayoutNode`（`ui/components`）+ `@ui/starters` | 六屏（见 §4.6） | ✅ 现有 |
| 壳层：`engine/host`（`mountHost`+`createRunLoop`）· `services/persist` | 运行环 + 局外小态（图鉴 / 每日种子 / 榜） | ✅ 现有公共件（禁手写） |

> 先例台：数据化效果表=`games/game-e/jokers.ts`（`{op,target,value,when}` 声明式）；种子对掷=`games/game-g/clash-resolve.ts`；
> 流程机=`games/game-g/flow-walk.test.ts`；UI 达标=`games/game-g` 六屏 + `games/game-i`。

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它（禁游戏层自写解释器） |
|---|---|---|
| `DUEL_MATRIX` | `{throws[], beats{}, payoff{}, tie{}}` + 运行时 `patches[]`【R-108-12/13/40】 | `t2-matrix-duel`（**已落地**·payoff 缩放待扩写） |
| `RELICS` | 12 件遗物/碎片 = 判定表补丁 + modifier 条目【R-108-43】 | `t2-matrix-duel`（补丁）+ `t2-modifier-stack`（收益） |
| `OPPONENTS` | 5 名对手：**两张策略表**（蓄力表 + 出招表）/ 破绽参数 / 台词键【R-108-32】 | `t2-event-when`+`t2-weighted-spawn`+`t2-self-rule`+`t3-dialogue` |
| `PHASES` | 三时区四拍与各自秒数【R-108-01/02】 | `t3-flow` + `e1-timer` |
| `LADDER` | 3 层 × (2 常规 + 1 精英) + Boss + 层间回复【R-108-50】 | `t3-flow` |
| `SCREENS` | 六屏 LayoutNode 树【§13】 | `mountUI`（闭集控件） |

> 红线自查：本表**无一行**是「数据表 + 待写的游戏层解释器」——`DUEL_MATRIX`/`RELICS` 的解释器 = **已落地的
> `t2-matrix-duel`**；唯一未就位的是 `payoff` 蓄力缩放一个字段（§4），扩写落地前不动玩法骨架（虚胖数据零容忍）。

## 4. 申请的游戏层代码例外（逐条过审）

### ⚖ 缺口裁决协议（**owner 2026-08-06 立·本项目适用**）

> owner 原话：「不到万不得已，我们不用代码，必须灵活。但这个准则是**用之前先查**，
> 是补缺口还是直接游戏独有逻辑，**我来判定**。」

三步，缺一步即违规：

1. **先查**——任何「现有能力表达不了」的判断，必须先对 `capability-registry` + 对应生产线手册**实查**过，
   并在本文件留下「查了什么、为什么重组不成」的原文（不是印象、不是"应该没有"）。
2. **摆两条路**——重组不成时，把 **A 补引擎缺口（能力下沉/扩写）** 与 **B 游戏独有逻辑（游戏层代码）**
   并列写出，各附代价、影响面、通用性、以及「选错了以后要付什么」。**Lead 给推荐，但不下裁决。**
3. **owner 判**——A/B 由 owner 拍板。**Lead 不得自裁后追认。**

> 与 CLAUDE.md 核心规则 2/3 的关系：原文是「真表达不了的缺口 → 下沉通用 capability」由 Lead 裁；
> 本协议把 **A/B 这一格的裁决权收归 owner**，Lead 的职责缩为「查证 + 举证 + 推荐」。
> **✅ owner 2026-08-06 裁：提升为全库规则**——已写进 `CLAUDE.md` 核心规则 3（压过原「Lead 裁」口径）。
> 本节保留作 game108 的就地引用，口径以 CLAUDE.md 为准。

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| **无** | 游戏层只有：蓝图装配 + §3 数据表 + LayoutNode 屏构造 + `engine/host` 壳接线 —— 均非自由规则代码 | — | — | — |

**本 plan 现有两个引擎缺口，均已由 owner 判 A（`REQ-108-ENG-01` 按侧缩放返工 / `REQ-108-ENG-02` 出招输入接缝）：**

### 已解除的卡口：`t2-matrix-duel` 已落地（`5bfa84f48`·Lead 终审 PASS）

v2 最重的那条新需求——**对局进行中改写判定表**【R-108-42 逆转碎片】——**落地版天然满足**：
`resolveDuelMatrix` 在**每次结算时重新按书写序 fold 一遍 patches（纯函数·零缓存态）**，
所以往 `DuelMatrix.patches` push 一条，下一拍结算即生效。**无需任何引擎改动。**
另有三条 v2 遗物白捡：`DuelTie.selfDamage` 支持负数（同调=平局回血）· `selfDamageOnLose`（剪刀祭）· `add-throw` 补丁（第四指·空手）。

### ✅ 唯一缺口：`payoff` 蓄力缩放（**owner 2026-08-06 判 A**·工单 `REQ-108-ENG-01`）

**① 先查（已实查·留痕）**：亲读 `src/skills/tier2/matrix-duel.ts` —— `DuelPayoff.damage` 是**固定整数**，
`DuelEffect` 只做「按 Resource id 全局路由加减」，`patches` 三闭集（beats / payoff / add-throw）**无条件字段**、
按书写序无条件 fold。查 `t2-modifier-stack`：matrix-duel 不读 `ModifierTotals`。查 `condition.ts`：`id` 静态。
→ **重组路走不通的实证结论**，非印象。

**② 两条路（Lead 举证·不下裁决）**：

| | **A 补引擎缺口**（扩写 `t2-matrix-duel`） | **B 游戏独有逻辑**（游戏层算伤害） |
|---|---|---|
| 做法 | `DuelPayoff.damage` 扩为可选 `{base,scaleByResource,step}` | 游戏层订阅结算信号 → 读蓄力 → 自算 → 自己扣血 |
| 改动面 | 引擎一处取值 + 落盘门校验 + 点名测试；缺省仍收整数 = 零回归 | 游戏层新增一个结算器 |
| 通用性 | **高**——蓄力/怒气/连击/加注倍率/兵力，同一形状 | 零（只服务本作） |
| 代价 | 引擎多一个字段（词表增宽） | **两处结算并存**：matrix-duel 已经在写 `ResourceModify` 扣血，游戏层再算一遍 = 双真相；且要绕开它为「扣血当拍生效」特意拆的 Update/Commit 两相位定序 |
| 风险 | 低 | **高**——审计红旗边缘（游戏层自写规则 system）、确定性与定序自负、`t2-matrix-duel` 的落盘门管不到它 |
| Lead 推荐 | ✅ 推荐 A | — |
| **owner 裁决 2026-08-06** | ✅ **判 A·照此施工** | ❌ 不采 |

**③ 为什么 Lead 推荐 A**：穷举静态规则（「蓄力=1→10 / =2→20 / =3→30」×3 手×2 侧 = 18 条 `t2-event-when`）
纸面可写，但**会被本作自己的遗物打碎**——「蓄海」把蓄力上限 3→4【R-108-43】，
**静态规则集无法预先穷举一个可被数据改写的上限**。这是「数据能改、规则集不能跟着改」的结构性矛盾，不是行数问题。
而 B 会在同一件事上造出第二个结算真相，是本仓库反复吃过亏的形态。

**A 的边界（防加宽·若你选 A）**：只动 `DuelPayoff.damage` 的类型与结算取值一处 + 落盘门校验
（`scaleByResource` 须存在且非 `hpResource`）+ 点名测试（含「缺省固定整数零回归」一例）；
**不碰**胜负判定 / 补丁 fold / 定序拆相位。

<details><summary>原下沉 spec（若判 A 则照此施工）</summary>

- **要什么**：`DuelPayoff.damage` 由固定整数扩为可选 `{base, scaleByResource, step}` —— 伤害 = `base + 该侧该手蓄力资源 × step`
  （本作 = `10 + 蓄力 × 10`）。按侧 local 寻址，同 `hpResource` 口径；纯整数、无浮点。
- **为什么不能重组**（Lead 评判·已走过「能否现有能力表达」）：穷举静态规则（「蓄力=1→10 / =2→20 / =3→30」×3 手×2 侧 = 18 条
  `t2-event-when`）在**纸面上**能表达，但**会被本作自己的遗物打碎**——遗物「蓄海」把蓄力上限 3→4【R-108-43】，
  静态规则集无法预先穷举一个**可被数据改写的上限**。这是「数据能改、规则集不能跟着改」的结构性矛盾，不是行数多少的问题。
- **通用性**：任何「同时决策 + 可变系数结算」都吃它——蓄力/怒气/连击/加注倍率/兵力数值，全是同一个形状。
- **边界（防加宽）**：只动 `DuelPayoff.damage` 的类型与结算取值一处 + 落盘门校验（`scaleByResource` 必须存在且非 `hpResource`）
  + 点名测试；**不碰**胜负判定、补丁 fold、定序拆相位。

</details>

### 不开单的两处（重组解决·留痕·**已按协议先查**）

- **出过即清零【R-108-14】**：`x3-string-variable` 记本回合所出手 → **6 条静态 `t2-event-when` → `t2-effect-apply` 置零**
  （3 手 × 2 侧）。上限可变不影响它（置零与上限无关），故与上一条不同，**重组成立 → 依协议第 1 步即终止，不上报 A/B**。
- **三时区节拍**：`t3-flow` 四状态 + `e1-timer`，现成。

### ✅ S3 实查发现（2026-08-06·**owner 判 A**·工单 `REQ-108-ENG-02`）：出招没有数据通路

**症状**：UI 点 `throw.rock`【R-108-70】→ 世界里出现 `DuelIntent`，**这一步没有任何现有能力能做**。
AI 出招【R-108-30】同理（它也要产 intent），**一个缺口卡住玩家与 AI 两侧**。

**① 先查（实查·留痕·非印象）**

| 查了什么 | 结论 |
|---|---|
| `Effect.kind` 闭集（`protocol/components/logic.ts:113`） | `set-flag`/`set-flag-tagged`/`modify-resource`/`set-state`/`set-sensor`/`set-visible`/`set-visible-tagged`/`destroy`/`destroy-tagged`/`reset-timer` —— **没有「加组件」** |
| `SelfAction.kind`（同文件 `:212`） | `set-flag`/`modify-resource`/`set-state`/`destroy`/`spawn` —— 同样没有 |
| `t3-prefab` | 只**新建实体**（id=`模板#seq:localId`），**不往已存在实体挂组件** |
| `t2-weighted-spawn` | 产 `SpawnRequest` → 走 prefab，同上，**给不了 p1/p2 挂 intent** |
| `t2-matrix-duel` 自身 | `describe` 原文：「给双方实体各挂 `DuelIntent`」——**它假定别人挂好，自己不提供入口** |
| intent 能不能挂在别的实体上 | ❌ 不行：结算把**持 intent 的实体**当作该侧，伤害就扣在它的 `hpResource` 上 → intent 必须与 hp 同实体 |

⇒ **重组路走不通的实证结论**。

**② 两条路（Lead 举证·不下裁决）**

| | **A 补引擎缺口** | **B 游戏独有逻辑** |
|---|---|---|
| 做法 | 给 `t2-matrix-duel` 补**输入接缝**：`DuelMatrix.intentSignals?: Record<手, 信号名>` —— 收到该名 Signal 时，把 `Signal.source` 那一侧的 intent 置为对应手（沿 `t3-dialogue`「能力自带闭集 UI 输入接缝」的先例） | host 层在 UI handler 里直接 `world.addComponent(p1, DuelIntent)` |
| 合不合规 | 合：UI 只发具名信号，世界改动仍在 sim 能力层 | **违 `events-logic.md` 红线**：「写世界 = 具名 Signal 入队由能力消费·handler 里绝不塞自由逻辑」 |
| 覆盖面 | 玩家 + AI **一次解决**（AI 侧发同名信号即可） | 玩家、AI 各写一套 |
| 通用性 | 高：任何「同时出招」对抗都要这条缝 | 零 |
| 风险 | 低（additive·不填=零回归） | 高：游戏层自写世界写入 = 审计红旗边缘；AI/回放/lockstep 都得自己兜 |

**✅ owner 2026-08-06 判 A**（工单 `REQ-108-ENG-02`·spec 已写死·施工主体=主程）。Lead 推荐理由：`matrix-duel` 是解释器型能力，**输入接缝本就该由它自己定义**——
`t3-dialogue` 早有同形先例（`dialogue.advance`/`dialogue.choose` + arg 通道，零游戏 handler）。
现在的状态相当于「能力有出口没入口」。

**A 的边界（防加宽·若判 A）**：只加 `intentSignals` 读信号置 intent 一处 + 落盘门（信号名非空、手必须在 `throws` 内）
+ 点名测试（玩家侧信号产 intent / AI 侧同名信号产 intent / 不填=零回归）；**不碰**判定、补丁 fold、定序、伤害缩放。

## 4.5 美术接入

- **皮肤槽清单**：① 对手立绘 → `portrait.art`（`emotion` 变体：常态/攥拳/得意/受创/摊牌——**表演型 tell 的载体**）；
  ② 规则石板 → `Panel.skin`(+`skinSlice` 9-slice)；③ 三个大出招键 → `UITheme.buttonSkins`（一 kind 一皮）；
  ④ 蓄力槽 → `ProgressBar` 主题皮 + 满槽特效；⑤ 遗物/碎片图标 → `Card.media`；⑥ 背景/面纹 → `UITheme.texture`/`panelTexture`。
- **台账产出**：编译期游戏 → 照 `scripts/game-g-art-requirements.mjs` 样板写推导脚本（脚本名：`scripts/game108-art-requirements.mjs`）。
- **首版占位**：程序化槽/石板 + 立绘占位（`portrait` 缺图落名首字占位，不空白）；**占位不是美德**，台账保号，风格锚到位即逐行替换。
- **文生图**：对手立绘走风格包锚（PA 出「暗调拳馆」锚）；如实披露 AI 生成。
- **表演关键帧风险**：静态立绘 + 表情切换若读不出 tell，需补 2-3 帧关键动作（S4 试玩定夺·台账预留位）。

## 4.6 UI 呈现 · 华丽起手

- **house 主题**：**`apolloOnyx`「玄铁」**（apollo-kit）。**不自写 UITheme**。风格锚若落「织金拳馆」→ 换 `apolloBrocade` 一个参数。
- **起手包**：主菜单 `buildStarterHome`、结算 `buildStarterResult`（`@ui/starters`）——**不从空白搭朴素屏**。
- **成熟件清单**（对 `ui-playbook §0` 橱窗货架）：**六条蓄力槽** `ProgressBar` + `bind`（常驻·零操作可读=玩法硬需求）·
  倒计时 `ProgressBar.shape:'ring'` · 三个大出招键 `Button.kind:'hero'` + `shape` + `press3d`（触屏按压反馈）·
  规则石板 `Panel.shape:'shield'` + `Panel.skin` · 对手 `portrait`(+`glow`) + `dialog`(`typewriter`) ·
  判定瞬间 `Particles` + `Label.format` + `anim:'floatUp'`/`popOut` · 主 CTA `fx:'sheen-hover'` · 选路 `LevelPath` · 图鉴 `Tabs`+`Card.media`。
- **烟雾表现**：遮罩层 + `fx`（**render-only·不进 sim/hash**；隐藏是表现，真值仍在世界里）。
- 交付前跑 `/check-ui`（四关 + `validateLayoutNode` 零 issue + `ui-audit` 归零·深/亮两主题各一遍）。

## 4.7 代码准入阶梯申报

| 规则 | 落级 | 说明 |
|---|---|---|
| 判定（查表定胜负）【R-108-12】 | L1 | `t2-matrix-duel`（**已落地**） |
| 伤害按蓄力缩放【R-108-13】 | **L1·阻塞** | `t2-matrix-duel.payoff` 缩放式已落但取不到按侧值（打回返工）；游戏层仍零代码 |
| 出过即清零【R-108-14】 | L1 | `x3-string-variable` + 6 条 `t2-event-when` → `t2-effect-apply`（重组·不开单） |
| 局内/局间凿改（含增设第四手）【R-108-40/41/42】 | **L0 纯数据** | `t2-matrix-duel.patches`（**每拍重 fold → 局内改写天然支持**） |
| 遗物收益加成【R-108-43】 | L1 | `t2-modifier-stack` |
| 三时区四拍 + 倒计时 + 超时顺延【R-108-01/02】 | L1 | `t3-flow` + `e1-timer` |
| 六条蓄力槽 + 上限锁【R-108-03/10】 | L1 | `f1-resource` × 6 + `t2-event-when`(满则锁) → `f2-flag` |
| 血量与死亡【R-108-15】 | L1 | `Resource` + `t2-event-when` → `t2-effect-apply` |
| 烟雾【R-108-20/21/22】 | L1 | `t2-craft-recipe`(扣次数) + `f2-flag`(隐藏旗) + UI 遮罩(render-only) |
| 逆转碎片触发【R-108-42】 | L1 | `t2-event-when`(血≤50 且未触发) → `t2-weighted-spawn`(抽二选一) |
| AI 两次决策【R-108-30】 | L1（**S3 验证**） | `t2-event-when` → `t2-weighted-spawn`；不成走 capgap |
| 表演 tell【R-108-31】 | L1 | `chancePass` 种子门 + `x3-string-variable` + `t3-dialogue` 投影 + `portrait.emotion` |
| 六屏 UI【§13】 | **L0 纯数据** | LayoutNode 闭集 + `@ui/starters` |
| 演出节拍【§13】 | L1 | `t3-timeline` cue 发信号 |
| 局外元层（图鉴/每日种子/分数榜）【R-108-52/53】 | L1 | `services/persist` 公共件 |

> **L3（受控 TS 卡带）/ L4（自由代码）：本项目零申报。**

## 5. 确定性声明 + 实现约定

### 🔒 实现约定（复查侧 2026-08-06·**已修正一次·见下方作废说明**）

**六条蓄力槽一律用「各侧唯一 id」**：`p1.charge.rock` / `p1.charge.paper` / `p1.charge.scissors` /
`p2.charge.rock` / … —— **绝不两侧共用同一个 `charge_rock`**。

> ⚠ **本条只解决「命名不撞」，不解决「按侧取值」**（原写法暗示它能治，**那是错的·已实测证伪**）：
> `DuelMatrix.payoff` 双方共用一张、`scaleByResource` 只能填一个 id，所以无论同 id 还是唯一 id，
> 缩放都取不到「出手方自己那条槽」。**【R-108-13】在引擎返工（`REQ-108-ENG-01` 打回）落地前无法照策划实现**——
> S3 骨架不得先按错数字焊死。详见 `requests.md`「复查侧验收（改判）」。

**为什么**：`t2-matrix-duel.resolveDamage` 的资源寻址是 local →（找不到）global 回落；而引擎一实体一组件、
出手方那份 `Resource` 已被 `hp` 占用 → 蓄力槽必然另居实体 → **local 永远落空 → 一律走全局回落**。
全局回落只能命中唯一一份：两侧同 id 时，它没法知道该取哪一侧的槽。

**⚠ 后果已随引擎改动变化（`e06fb61c`·2026-08-06）**：
- **过去**（`e3a568fb`～`e06fb61c` 之间）：取第一个同 id 的，**静默算错侧的伤害**——
  已实测 p2 用自身蓄力 0 的手取胜却按 p1 的槽结算，无报错无告警，只是数字错。
- **现在**：全局命中 ≥2 份 → **运行期点名硬抛**（报份数 + 全部涉事实体 + 改法建议），
  与 `matrix-duel` 对「表外的手」「>2 份 DuelIntent」同口径：永不自愈的数据错不许静默。

**所以硬抛的作用被限定住了**：它只在「两侧共用同一个 id」时触发，把那种配错从"静默算错侧"变成"当场崩"。
**但按上方作废说明，本约定改用唯一 id 后只有 1 份命中 → 硬抛根本不触发，而缩放依然取错侧**
（实测：表填 `p1.charge.rock`、p2 出手取胜，p2 自己槽=0 应打 0 伤，实得 15）。
⇒ **硬抛不是「按侧取值」的解，只是同 id 配错的安全网**；真正的解是 `REQ-108-ENG-01` 返工
（`scaleByResource` 按出手方组装）。落盘门两件事都抓不到——它只看 `DuelMatrix` 数据，
既看不见世界里挂了几份同 id 资源，也不知道运行期谁是 attacker。
详见 `requests.md` 复查侧验收「发现一」+「改判」。

**S4 验收剧本必须带一条对拍**：双方同手蓄力不同时，各自伤害只跟**自己**那条槽走。



- **随机源**：世界单例 `RandomSeed`；游戏层**零裸 `Math.random`**（`game-skill-audit` 红旗）。
- **seed 来源**：常规局开局一次性取并存档；**每日挑战 = 日期码派生**（同日同塔·可比可回放）。
- **消费点**：AI 两次抽选【R-108-30】· 破绽概率门【R-108-31】· 二选一抽取【R-108-41/42】· 超时顺延【R-108-02】。
- **回放**：初始 seed + 操作序列（`matrix-duel` 纯整数查表，无浮点分支）。**v1.5 异步幽灵对战直接建在这条上**【R-108-61】。
- **lockstep**：v1 无需求。**v2 实时 PvP 走权威服务器 + 状态同步，不走帧同步**【R-108-62】——
  同时出招下帧同步天然可作弊（对端先收到对方命令才被迫提交），公平问题非同步问题。
- 表现层随机抖动**不进 sim**（`Particles` 位置确定式派生 · 烟雾遮罩 render-only）。

## 6. 评审记录

- **提交人 / 日期**：Lead session（GD 兼稿）/ 2026-08-06（v2）
- **Lead 初裁**：🔶 **有条件通过**——条件两项：
  1. **`payoff` 按侧缩放【R-108-13】——🔴 仍是 S3 卡口**（`e3a568fb` 未达自身 spec·复查侧改判打回·修法 A/B 待 owner 判）；
  2. AI 两次决策【R-108-30】在 S3 首个验证项**先查**——重组跑通即终止；跑不通则**按协议摆 A/B 上报 owner**，
     Lead 不自裁。（这是本项目下一个大概率的 A/B 岔路口。）
- **S2 人门签**：**✅ owner（junbai.li）2026-08-06 签**——逐条 review 27 条 `【R-108-NN】` 条款后答「签」，
  Lead session **代录**（口谕落账·非代签）。签的范围 = 本 plan v2.0 + GDD v2.0 + 立项卡 v2.0。
  详见 `brief.md`「人门签记录」。**流程板自 S3 起开卡**，届时由 CLI 补落台账。
- **owner 2026-08-06 两裁已落**：① `payoff` 缩放判 **A**（补引擎缺口）；② 缺口裁决协议**提升全库**（已写进 CLAUDE.md 核心规则 3）。
- **owner 立的验证口径**：**玩法验证完全依赖策划文档**——`gdd.md` 的 `【R-108-NN】` 条款是唯一裁判，
  实现与条款不符 = 实现错（改实现，不改条款）；条款本身要改 = GD 改并留痕，不许施工方就地"解释"。
  载体 = `REQ-SPECTRACE` 追踪矩阵（S4 落 `docs/design/game108/spec-trace.json`·§15 剧本已带「验的条款」列）。
