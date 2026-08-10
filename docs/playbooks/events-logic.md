# 事件与逻辑链手册

> 「条件成立 → 发信号 → 改世界」全用能力串起，游戏层不写规则代码。
> **信号铁律**：写世界 = 具名 `Signal` 经 enqueue 入队 → 由能力系统消费；**handler / 触发点里绝不塞自由逻辑**。
> 机读真相：`describe`（`src/skills/tier2·tier3`）；条件表达式 `src/skills/tier2/condition.ts`（`ConditionExpr`，被多能力复用）。

## ① 做 X → 用什么

| 任务 | 能力实名 | 怎么接（一句） |
|---|---|---|
| 条件成立时发信号 | `t2-event-when` | 挂 `EventWhen{signal,when,mode}`（threshold/状态/门控）；下游 query Signal 消费 |
| 信号直接改世界 | `t2-effect-apply` | 挂 `Effect{onSignal,kind,targetId,value}`（Commit 相位，下拍生效） |
| 按 Tag 掩码批量解锁一片区域的 Flag | `t2-effect-apply`（`kind:'set-flag-tagged'`） | `Effect{onSignal,kind:'set-flag-tagged',tagMask,targetId,value}`：tagMask 命中的实体里 `Flag.id===targetId` 者批量置 active（destroy-tagged/set-visible-tagged 的 Flag 孪生·webbed 区域解锁同款） |
| 顾客点单/收集类多槽交付 + 集齐续单 | `t2-order-fulfill` | 挂 `Order{needItems,filled,reward,pool?,rotateMode?,cursor?}`；`DeliverDrop` 消费落格；`pool` 非空则集齐发奖后轮换下一单（`sequence` 按 cursor 环回 / `weighted` 用世界 `RandomSeed` 加权抽） |
| 点世界实体发信号 | `t2-clickable` | 挂 `Clickable{action}`；命中即入队信号 |
| 按键/具名动作发信号 | `t2-keybind` | 挂 `KeyBinding{key,signal}`；人/AI 共用动作总线 |
| 进入触发区 | `t2-trigger-zone` | 挂 `Tag(ZONE_FLAG)`；靠 overlap-detect 的 Overlap，写 `Trigger` |
| 花费换取 / 一次改多值 | `t2-craft-recipe` | 挂 `CraftRecipe{onSignal,costs,gains}`（商店/合成） |
| 整局流程状态机 | `t3-flow` | 挂 `GameFlow{id,current,states}`；when 复用 `ConditionExpr` |
| 实体各自读条件施自身效 | `t2-self-rule` | 挂 `SelfRule{when,do,once?}`（自走棋/弹幕群自治） |
| 胜负/占据/到达判定 | `t2-zone-occupancy` | 挂 `Zone{outFlag,矩形,requiredTag,count}`；下游读 outFlag |
| 组数量作为可读数值 | `t2-group-count` | 挂 `GroupCount{countResource,requiredTag}`；阈值配 event-when |
| 演出时序（第 N tick 发什么） | `t3-timeline` | 挂 `Timeline{id,cues:[{at,do}],playOnSignal,skipOnSignal?}`；do=signal/flag/resource/spawn 四闭集；播完发 `timeline:done:<id>` |
| 双方同时出招 → 查表定胜负收益 | `t2-matrix-duel` | 对局实体挂 `DuelMatrix{hpResource,throws,beats,payoff,tie,patches?}`，双方实体各挂 `Resource{id:hpResource}` + 本回合 `DuelIntent{throw}`；两侧齐备即结算（写 ResourceModify + 发具名 Signal + 清 intent）。遗物/变体 = `patches` 三闭集（改克制 / 改收益 / 增设一手），坏补丁装载期拒收（`validateDuelMatrix`）。AI 选招 / 手牌 / 押注不归它 |

## ② 样例指针

- registry：`t2-event-when`/`t2-effect-apply`/`t3-flow`/`t3-timeline` 的 `describe.examples`。
- 真实用法：`games/game-g/flow-walk.test.ts`（流程机）、`games/game-i/fsm-lab.ts`（状态机台）。
- UI 侧信号入队见 ui.md（`mountUI` 的 `ActionSink`）。

### 演出时序（timeline·管「何时」）

- **flow vs timeline**：flow=状态机（分支/门控/流程），timeline=固定节拍编排（第 N tick 发什么）。转场/开场三连 cue/演出节拍用 timeline；胜负流程/回合状态用 flow。
- **timeline 管「何时」、tween 管「怎么动」**：cue 只发 `Signal`/写 `Flag`/写 `Resource`/发 `SpawnRequest`（四闭集），表现层订阅信号、tween 演动画——handler 里绝不塞自由演出逻辑。
- **快进**：`skipOnSignal` 一 tick 内按序补发全部剩余 cue，**终态与逐 tick 播放完全一致**（回放安全）。**绝不走墙钟**：游标 t 按 tick 推进。

## ③ 本线红线

- **handler 里绝不塞自由逻辑**：UI/交互只发具名 `Signal`，一切世界改动由 effect/craft/flow 等能力在 sim 里做。
- 条件用 `ConditionExpr`（event-when/flow 复用），不各写一套判定。
- 概率门用 `chancePass` 种子化（randomness.md），**禁裸 `Math.random`**。

## ③′ ⚠ 全局 id 路由 vs 按侧寻址（**对称双方玩法头号坑**·2026-08-07 立·五次事故换来）

> 症状永远一个样：**不报错、就是不生效**。写的人以为接上了，跑起来静悄悄。

引擎里「谁被作用」绝大多数是**全局 id 路由**：`Effect.targetId`、`ConditionExpr{kind:'resource',id}`、
`ProgressBar.bind` 都按一个字符串找目标、**没有 `entity` 字段**。单主角天然对；一旦做**对称双方**
（对战/双打/多座），两侧常必须共用同一 id（解释器按侧 local 寻址），全局路由就**分不清哪一侧**。
game108 一个游戏撞了五次，全是这条：

| 想干的事 | 撞在哪 | 解法 |
|---|---|---|
| 伤害按出手方蓄力缩放 | `payoff` 两侧共用，`scaleByResource` 只吃一个字符串 | 引擎加 `perSide` 相对名（运行期拼 `<侧>.<相对名>`） |
| 出过的手清零 | `Effect.targetId` 全局，分不清清哪侧的槽 | 收进解释器当结算副作用（它才知道谁出了什么） |
| 血量归零判负 | `ConditionExpr` 的 resource **无 `entity` 字段** | **重组**：各侧 `t2-self-rule` 读**自身** → 置各侧唯一 id 的 Flag，再按该 flag 读 |
| 血条绑世界值 | `ProgressBar.bind` 是全局 resourceId | 不 bind，宿主投影按侧填 |
| 玩家动作接进接缝 | **反过来**：消费方按 `Signal.source` 认侧，而「一动作一个 `kb-*` 实体」让 source 永远是 kb 实体 | `KeyBinding.source` 代发 |

**开工前自问三句**（比事后查省一整轮）：① 目标两侧会不会**同名**？同名就别指望全局 id 分得清。
② 要读的是「世界上某个 id」还是「**这一侧自己的**」？后者用 `t2-self-rule`，或让各侧持一个
**各侧唯一 id** 的中间物（Flag/Resource）当转接口。③ 我的消费方若按 `Signal.source` 认人，
**输入侧接得上吗**？—— source 默认是 kb 实体不是行为主体，要认人就填 `KeyBinding.source`。

**给写引擎能力的人**：新解释器若按 source/按侧路由，**必须在 `whenToUse` 写清「上游怎么把 source 填对」**，
且**输入接缝要和输出一起设计**——game108 的 ENG-02(输出)与 ENG-04(输入接不上)本该是同一张单，
拆成两轮就是因为第一轮只想了输出。对不上时是**静默**的。

## ③″ 日志基准（写规则解释器必接）

带逻辑的判定/路由代码**同提交接 trace**（CLAUDE.md 日志基准守则）：`src/skills/debug-trace.ts` opt-in 零开销，「什么都没发生」的分支必记 `reject`；样板 `matrix-duel.test.ts`。

## ④ 正样例 / 反面教材

- ✅ `src/skills/tier2/event-when.ts` + `effect-apply.ts`：条件→信号→效果全数据。
- ✖ 在点击/按键回调里直接改 Resource/State（绕过信号入队 → 破确定性、AI 复用不了）。

## ⑤ 查不到怎么办

现有条件算子/效果 kind 表达不了的规则 → `docs/workflow/requests.md` 提缺口（先看 event-when `when` + effect kind 能否重组）。**不在游戏层写规则 system。**
