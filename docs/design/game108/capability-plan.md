# 能力总览 Capability Plan — game108《拳律 / Rule of Three》（S2 送审稿 **v2.0**）

> Lead session · 2026-08-04 · **v2 = 随 GDD v2 超休闲重构同步改写**（v1 全文查 git 历史）。
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
| ↳ `payoff` 支持蓄力缩放 | 伤害 = base + 蓄力 × step【R-108-13】 | ⏳ **需扩写**（`REQ-MATRIXDUEL-2`·本 plan 唯一缺口） |
| `x3-string-variable` + `t2-event-when` + `t2-effect-apply` | **出过的手蓄力清零**【R-108-14】：记本回合所出手 → 6 条静态规则（3 手 × 2 侧）置零 | ✅ 现有（**重组·不开单**） |
| `t3-flow`（`GameFlow`） | **三时区四拍状态机**（T1蓄力→T2出招→T3对决→T4结算）+ 对局胜负收束 + 爬塔层进【R-108-01/15/50】 | ✅ 现有 |
| `e1-timer`（原子） | 每时区 3/3/2/1 秒倒计时 + 超时顺延【R-108-02】 | ✅ 现有 |
| `f1-resource`（原子） | **六条蓄力槽**（双方各三）· 双方血量 100 · 烟雾次数【R-108-03/10/15/20】 | ✅ 现有 |
| `t2-event-when`（`EventWhen`+`Signal`） | 条件成立发信号：蓄力满锁定、血量 ≤50 触发逆转、HP≤0、AI 策略规则命中【R-108-10/42/15/30】 | ✅ 现有 |
| `t2-effect-apply`（`Effect`） | 信号改世界：蓄力 +1 / 扣血 / 给碎片 / 开关烟雾旗【R-108-10/13/20】 | ✅ 现有 |
| `t2-weighted-spawn`（`WeightedSpawn`） | AI **两次**决策各按权重表确定性抽取（T1 蓄哪手 / T2 出哪手·消费世界 `RandomSeed`）【R-108-30】 | ✅ 现有（重组待 S3 验证·见 §4） |
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

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| **无** | 游戏层只有：蓝图装配 + §3 数据表 + LayoutNode 屏构造 + `engine/host` 壳接线 —— 均非自由规则代码 | — | — | — |

**唯一缺口走下沉，不走例外：**

### 已解除的卡口：`t2-matrix-duel` 已落地（`5bfa84f48`·Lead 终审 PASS）

v2 最重的那条新需求——**对局进行中改写判定表**【R-108-42 逆转碎片】——**落地版天然满足**：
`resolveDuelMatrix` 在**每次结算时重新按书写序 fold 一遍 patches（纯函数·零缓存态）**，
所以往 `DuelMatrix.patches` push 一条，下一拍结算即生效。**无需任何引擎改动。**
另有三条 v2 遗物白捡：`DuelTie.selfDamage` 支持负数（同调=平局回血）· `selfDamageOnLose`（剪刀祭）· `add-throw` 补丁（第四指·空手）。

### 唯一缺口：`payoff` 蓄力缩放（引擎池 `REQ-MATRIXDUEL-2`）

- **要什么**：`DuelPayoff.damage` 由固定整数扩为可选 `{base, scaleByResource, step}` —— 伤害 = `base + 该侧该手蓄力资源 × step`
  （本作 = `10 + 蓄力 × 10`）。按侧 local 寻址，同 `hpResource` 口径；纯整数、无浮点。
- **为什么不能重组**（Lead 评判·已走过「能否现有能力表达」）：穷举静态规则（「蓄力=1→10 / =2→20 / =3→30」×3 手×2 侧 = 18 条
  `t2-event-when`）在**纸面上**能表达，但**会被本作自己的遗物打碎**——遗物「蓄海」把蓄力上限 3→4【R-108-43】，
  静态规则集无法预先穷举一个**可被数据改写的上限**。这是「数据能改、规则集不能跟着改」的结构性矛盾，不是行数多少的问题。
- **通用性**：任何「同时决策 + 可变系数结算」都吃它——蓄力/怒气/连击/加注倍率/兵力数值，全是同一个形状。
- **边界（防加宽）**：只动 `DuelPayoff.damage` 的类型与结算取值一处 + 落盘门校验（`scaleByResource` 必须存在且非 `hpResource`）
  + 点名测试；**不碰**胜负判定、补丁 fold、定序拆相位。

### 不开单的两处（重组解决·留痕）

- **出过即清零【R-108-14】**：`x3-string-variable` 记本回合所出手 → **6 条静态 `t2-event-when` → `t2-effect-apply` 置零**
  （3 手 × 2 侧）。上限可变不影响它（置零与上限无关），故与上一条不同，**重组成立**。
- **三时区节拍**：`t3-flow` 四状态 + `e1-timer`，现成。

**S3 首个验证项**：AI 的**两次**决策（T1 蓄哪手 / T2 出哪手）用「`t2-event-when` 条件命中发信号 → `t2-weighted-spawn` 按权重表
确定性抽取」重组【R-108-30】。互斥条件若不可维护，**走 capgap 提单等裁决，不在游戏层自写选招器**。

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
| 伤害按蓄力缩放【R-108-13】 | **L2 capgap 待裁** | `REQ-MATRIXDUEL-2`（payoff 扩写）；过审即降 L1 |
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

## 5. 确定性声明

- **随机源**：世界单例 `RandomSeed`；游戏层**零裸 `Math.random`**（`game-skill-audit` 红旗）。
- **seed 来源**：常规局开局一次性取并存档；**每日挑战 = 日期码派生**（同日同塔·可比可回放）。
- **消费点**：AI 两次抽选【R-108-30】· 破绽概率门【R-108-31】· 二选一抽取【R-108-41/42】· 超时顺延【R-108-02】。
- **回放**：初始 seed + 操作序列（`matrix-duel` 纯整数查表，无浮点分支）。**v1.5 异步幽灵对战直接建在这条上**【R-108-61】。
- **lockstep**：v1 无需求。**v2 实时 PvP 走权威服务器 + 状态同步，不走帧同步**【R-108-62】——
  同时出招下帧同步天然可作弊（对端先收到对方命令才被迫提交），公平问题非同步问题。
- 表现层随机抖动**不进 sim**（`Particles` 位置确定式派生 · 烟雾遮罩 render-only）。

## 6. 评审记录

- **提交人 / 日期**：Lead session（GD 兼稿）/ 2026-08-04（v2）
- **Lead 初裁**：🔶 **有条件通过**——条件两项：
  1. `REQ-MATRIXDUEL-2`（payoff 蓄力缩放）过审并落地——**未落地不进 S3 玩法骨架**（本体 `t2-matrix-duel` 已落地，卡口已从「整条能力」缩到「一个字段」）；
  2. AI 两次决策的重组【R-108-30】在 S3 首个验证项跑通，或走 capgap 拿到裁决。
- **S2 人门签**：**留给 owner / 另一复查 session**（复查人 ≠ 施工人·本稿由施工方自拟，不自签）。
