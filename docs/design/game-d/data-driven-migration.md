# game-d《骰途》数据驱动迁移设计（体检报告整改 · owner 2026-07-02）

体检结论（已核实属实）：game-d 整套战斗/状态是闭包里手写的 `S` 对象 + 纯函数，引擎只当 3D 场景宿主用——
`capabilities: []`、`Math.random()` 绕过种子化随机、手写 `loadoutPattern` 重造 poker-hand、双人按钮假（都绑 `start`）、0 测试。数据占比 ~12%，上限 70-85%。

**纲领**：game = 数据（blueprint：components + capabilities + signals + keybinds），engine = 解释器；
线性编排允许一段薄 session 脚本（game-e `session.ts` 先例：只编排、不含算分/牌型/规则）。不绕过核心，缺口下沉成 capability。

## 目标架构（照 game-e/game-f）
- 状态 = 组件：`Resource`(sum/mult/damage/foeHp/heroHp/room/rerolls)、`Flag`(thrown/committed)、`StringVar`(pattern)、`State/GameFlow`(phase 机)。**不再是 `S` 对象**。
- 规则 = 能力：`poker-hand`(牌型计数)+`card-scoring`(逐骰 sum)+`effect-apply`(damage=sum×mult)+`event-when`+`condition`(挑战门槛 vs 敌)+`mortal`(HP)+`flow`(房间推进)+`keybind`(输入)+`random`(种子)。
- 输入 = 信号：`LayoutNode action → mountUI ActionSink → enqueueAction → InputQueue → keybind → Signal → Effect`（照 game-f `kb_ready_btn→Signal→eff_ready`）。**删掉直接 mutate `S` 的 handlers。**
- RNG = `RandomSeed` + `nextRandom`/`randomInt`/`seededShuffle`（可回放/lockstep）。

## 复用现有能力（~80%·无需新引擎工作）
| 环节 | 复用 | 备注 |
|---|---|---|
| 种子掷骰/洗牌 | `random`(RandomSeed/randomInt/seededShuffle) | ✅ 已接（见下「已完成」）|
| 牌型计数(对子/N 条/顺/同花/五条) | `poker-hand`(evaluateHand/rankMaxCount/pairCount) | 元素→rank·✅ 已接 loadoutPattern |
| 伤害 sum-of-pips | `card-scoring` PerCardScore.baseChipsByRank | 恒等表 value→chips |
| damage = sum×mult | `effect-apply` valueFrom.timesResourceId | 一行 Effect |
| 挑战门槛(sum≥t/element≥n/pair/contains) | `event-when` + `condition` | 编译 foe.conds → and(...) |
| 敌 HP/英雄心/死亡 | `mortal` + `Resource` | — |
| 房间/层推进 + 胜负 | `flow`(GameFlow states/transitions) | 替代 JS 循环 |
| 输入(roll/reroll/commit/选骰) | `keybind` + `clickable` | 每 action 一个 KeyBinding |

## 真缺口 → 下沉成 capability（主程域·requests.md 已登记）
1. **`dice-roll` capability（主缺口）**：读 `DicePool{dice:[{faces:[{value,element}]}]}` + `RandomSeed`(+`LockMask` 只重掷未锁)，`Update` 相位写 `RolledDice{faces}`（早于 poker-eval）。现无任何东西「掷一个声明的骰池」；poker-hand 只消费已填好的 PlayedHand。
2. **wild/百搭**：`evaluateHand` 无通配；wild 骰算任意值/元素。扩 poker-hand 加 wild 参数，或在 dice-roll 里归一化 wild。
3. **元素敏感对子**：敌「对子」= 同元素+同值联合，poker-hand 只按值 或 按花色单计。加 `pairCount` 变体参数或小 `dice-pattern` 派生事实。
4. **敌反制/禁骰**：`discardHighLow`（结算前禁 N 颗）无能力。加数据化「结算前骰过滤」（`DiceCounter{kind}`）。
5. **6 色同花确认**：poker-hand flush 对 suit int 泛用（6 元素可跑），但 HandType 枚举/handMods 是扑克花色形；请主程确认复用 `isFlushFlag` 表 6 色「同花」是否在契约内，否则走 `dice-pattern`。
6. **双人 co-op（netcode 缺口）**：真双人 = lockstep 联机（种子已同步就绪，但缺 netcode/房间/角色）。当前双人按钮不该假装单机=双人。

## 已完成（本 session·我方域·无新引擎工作·门禁绿 + 测试）
- ✅ **种子化随机 + run-seed 开局生成**：挂 `RandomSeed`（entity `gd-rng`·种子开局从时钟播种·每局不同可出货），`rnd()` 走 `nextRandom` → 掷骰/抽奖确定性可回放。**删 `Math.random()`。** TODO：接存档持久化 run-seed / 联机 host 广播。
- ⚠️ **poker-hand 复用只到「影子」，本体未还债**：改的是**展示函数** `loadoutPattern`（骰盅 UI 显示牌型名）→ 复用 `evaluateHand().rankCounts`+`rankMaxCount`。**体检点名的真轮子是战斗路径的 `combat.ts detectPattern`（`damageOf` 调它算伤害），它含百搭顶点/顶色，`evaluateHand` 无通配 → 现在不能真替**（待 wild capability·REQ-GAMED §2）。**债未还清。**
- ✅ **测试**：`game-d-sim.test.ts`（21 例）——种子确定性 + `loadoutPattern` + **`detectPattern` 全牌型行为锁定**（真替 poker-hand 前的护栏）。此前 0 测试。

## 待办（等主程填 dice-roll 等缺口后·我方接线）
- 把 `S` 状态迁成 Resource/Flag/StringVar/GameFlow 组件；战斗规则迁成上表能力 + 数据。
- UI handlers 改成信号（keybind→Signal→Effect），删直接 mutate `S`。
- 房间/层推进改 `flow` 数据状态机。
- 双人：netcode 落地前，按钮诚实标注（非静默走单机）。
</content>
