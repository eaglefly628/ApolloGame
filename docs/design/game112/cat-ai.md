# Game 112《星尾会客厅》· 猫 AI 设定（对手 AI 章 · 必填档）

> **依据**：`docs/playbooks/opponent-ai.md` §「AI 设定必填」（有对手/NPC 决策的游戏必须有 AI 设定在档·初版可基本·随迭代同步更新·S4 复查点名查）。
> **口径**：性格 = 数据不是代码（同一棵树/同一张表·性格只改黑板值）；概率 = 引擎种子骰；决策分级落握手旗、一级一拍；`DebugTrace` 记 `decision` / `reject`。
> **状态**：v0 · 2026-09-23 · 🟡 GD-112 提案（随 `capability-plan.md` §4.65 一并过审）。数值全是占位，S4 调校。
> **摘要在** `capability-plan.md` §4.65；本档是详设。

---

## 0. 猫有两套"脑子"，都不是人脑

| 场景 | 猫在决定什么 | 载体 | 随机源 |
|---|---|---|---|
| **星牌桌**（对手 AI） | 出哪张·放哪个星盘·用不用猫爪 | `t2-behavior-tree` 纯数据树 + 性格黑板 `Resource` | `nextRandom(RandomSeed)` 经 `deriveSeed(seed,'cat-card:<catId>')` |
| **逗猫角 / 陪伴**（行为 AI） | 理不理你·什么时候扑·扑不扑得中·被拒绝时装没事 | `t3-flow` 狩猎链 FSM + `Effect.chance{num,den}` 种子概率门 | 同上，标签 `'cat-hunt:<catId>'` |

两套都**只读公开信息**（定手窗·坑①）；关系值**不给数值优势**（GDD §10.4：好感只解锁表演/牌背/友好让步档）。

---

## 1. 星牌桌对手 AI

### 1.1 性格一句话（四档·每猫一档·数据字段 `cardPersona`）

| persona | 一句话 | 黑板值（占位） |
|---|---|---|
| `cautious` 谨慎 | 攒到像样的组合再落，宁可空过也不送分 | hoard=70 · aggression=20 · clawRate=15 · tempo=40 |
| `competitive` 好胜 | 看见能得星光的盘立刻抢，爪子也舍得用 | hoard=20 · aggression=85 · clawRate=45 · tempo=60 |
| `playful` 贪玩 | 爪子当玩具，动不动就换盘拨牌，分数其次 | hoard=30 · aggression=40 · clawRate=80 · tempo=50 |
| `sleepy` 困倦 | 想快点结束，倾向清库快、决策短 | hoard=10 · aggression=35 · clawRate=10 · tempo=90 |

黑板值落成每猫四个 `Resource`：`bb-hoard.<catId>` / `bb-aggression.<catId>` / `bb-clawrate.<catId>` / `bb-tempo.<catId>`（全局 id 唯一·events-logic.md「全局 id 路由」坑）。**换性格 = 换四个数，不换树。**

### 1.2 决策口径（一棵树·所有性格共用）

```
selector
├─ sequence [条件: 本回合已决策旗 off]                         ← 一级一拍（坑⑧）
│   ├─ action: enumerate-moves        → 黑板: 候选着法（数据·非随机）
│   ├─ selector
│   │   ├─ sequence [cond: 有直接得分着法 ∧ aggression ≥ 骰(0..99)]   → action: take-best-score
│   │   ├─ sequence [cond: clawRate ≥ 骰 ∧ 猫爪次数 > 0 ∧ 有猫爪着法]  → action: use-claw
│   │   ├─ sequence [cond: hoard ≥ 骰 ∧ 有保留着法]                    → action: hold-and-place-low
│   │   └─ action: place-by-tempo    （tempo 高 → 清库最快的盘；低 → 期望值最高的盘）
│   └─ action: set-flag decided.<catId>                        ← 握手旗（坑⑤）
└─ action: idle
```

- **候选着法枚举 / 估值** = 注册叶（TS 例外·`capability-plan.md` §4 申报·记债）。叶只读：自己手牌、三个星盘顶部公开牌、双方星光、剩余猫爪次数。**不读玩家手牌**（定手窗）。
- **骰** = `nextRandom(seed)*100`，seed 由 `deriveSeed(worldSeed,'cat-card:'+catId)` 派生一次、随局推进。
- **账期**（坑②）：AI 的"心态"只在**回合结算后**更新，不在出牌拍里读本拍结果。

### 1.3 心态机（`j1-state` · fsmId `mood-card.<catId>`）

| 态 | 进入条件（数据·`t2-event-when` edge） | 对黑板的修正（`t2-modifier-stack` gate=state） |
|---|---|---|
| `calm` 初始 | 局开始 | 无 |
| `eager` 上头 | 连得两次星光 | aggression +15 |
| `sulky` 闹脾气 | 连失两次 / 被压牌 | clawRate +20 · hoard −10 |
| `drowsy` 犯困 | 回合数 ≥ N（每猫 `napAfterTurns`） | tempo +30 |

心态只改表演选择与黑板修正，**不改规则**；表演片段由媒体层按 `StateChanged` 投影（见 `framework.md` §2）。

### 1.4 难度阶怎么爬（数据档位 `difficulty`）

| 档 | 叫法（UI 用词） | 差异（全是数） |
|---|---|---|
| `gentle` 友好让步 | "让它慢慢来" | 估值噪声 ±30 · 猫爪次数 −1 · 不抢玩家正在攒的盘 |
| `normal` 平常 | "认真打" | 估值噪声 ±10 |
| `sharp` 精明 | "它今天很清醒" | 噪声 0 · 会预判玩家下一张能配的盘（仍只读公开牌） |

高关系解锁 `gentle` 档的**可选**开关与新表演，不解锁任何数值优势（GDD §10.4）。

### 1.5 公平边界（复查门核对）

1. 叶只读公开信息（写死在叶签名的 world 查询白名单，测试钉死）。
2. 猫爪动作 = 规则内动作，次数与玩家同源同表。
3. 所有随机走种子骰；同 seed 同输入 → 同着法（回放测试）。
4. `DebugTrace`：每回合 ≤3 条：`decision`（选了哪支）· `reject`（有得分着法却因骰未过而放弃 = 必记）· `commit`（着法摘要）。

---

## 2. 逗猫角 / 陪伴行为 AI

> ⚠ **owner 2026-09-24：逗猫改用视频实现，不做拖羽毛棒；本节狩猎链参数保留为「选玩具 → 按状态播片」的状态表草案，随逗猫重设计更新。**

### 2.1 狩猎链（`t3-flow` · id `hunt.<catId>`）

状态闭集：`Rest → Notice → Track → Stalk → Pounce → Catch | Miss → Hold | Search | Groom → Rest`，外加 `Ignore`。转移条件读 Flag/Resource/Timer（`after` 做伏击驻留拍）；**随机分支**（Catch/Miss、Search/Groom、"假装不感兴趣"）由 `Effect{kind:'set-flag', chance:{num,den}}` 先落旗、flow 下一拍读旗（握手旗·一级一拍）。

> ⚠ 驱动量缺口：转移里的"玩具进入关注区 / 缓慢移动 / 速度合适 / 未及时逃开"需要玩具**实时位置与速度**进 sim 并被条件读到——现有 ConditionExpr 无距离/速度叶、无指针跟随能力。见 `framework.md` §6 缺口 ④。裁决前狩猎链先以「区占用旗」（`t2-zone-occupancy`）近似关注区，做不了速度判定。

### 2.2 玩耍性格（每猫 `playPersona` · 全是数）

| 参数 | 含义 | 布偶猫「雪团」占位 |
|---|---|---|
| `noticeRange` | 关注区半径（世界单位） | 220 |
| `stalkPatience` | Stalk 驻留拍数（`after`） | 24 |
| `pounceChance` | Stalk→Pounce 概率 `num/den` | 6/10 |
| `catchChance` | Pounce→Catch 概率 | 5/10 |
| `feignChance` | Notice→Ignore（假装不感兴趣） | 2/10 |
| `groomAfterMiss` | Miss→Groom 概率（否则 Search） | 6/10 |
| `staminaTicks` | 玩累阈值（`t2-over-time` 扣兴致） | 900 |
| `toyBias` | 玩具偏好修正表 `{feather:+2, ball:0, bag:+1, light:-1, rope:+1}` | — |

兴致（`mood.<catId>`）与安心（`ease.<catId>`）作为转移门槛（`resource gte`）；玩具偏好经 `t2-modifier-stack` 修正 `pounceChance` 的分子（gate 读当前玩具 StringVar）。

### 2.3 触摸偏好（陪伴）

每猫每区一条偏好分 `Resource touch-pref.<catId>.<zone>`（zone ∈ head/cheek/chin/back/paw）；命中区信号 → `EventWhen`（and: 偏好 ≥ 阈 · 安心 ≥ 阈）→ `set-state accept | refuse`。**拒绝不扣关系**（GDD §9.1）。

> ⚠ 方向/速度/持续时长读不到（Signal 不带数值）——首版只按"区 + 当前安心/兴致"判，见 `framework.md` §6 缺口 ⑤。

### 2.4 离线小事件（"田螺姑娘"）

不是 AI 决策，是**宿主输入 + 种子抽样**：宿主按离开时长分档注入 `offline.short|long|days` → `t2-keybind` → `t2-weighted-spawn`（每猫一张权重表：纸袋藏牌 / 玩具叼到桌边 / 睡过你的位置 / 打翻杯垫…）→ `t3-prefab` 在布置点展开。**不消耗稀有资源、不改设置**（表里只有装饰性模板）。

---

## 3. 测试红线（S4 点名）

- 每个 persona 一条点名测试：同 seed 下 `competitive` 的抢分次数 > `cautious`（撤修验红：把 aggression 两档调成同值 → 该例转红）。
- 定手窗结构测试：叶的 world 查询白名单不含玩家 `CardPile.hand`。
- 狩猎链回放：同 seed + 同输入序列 → 同 `StateChanged` 序列。
- `DebugTrace` 只读重建：开 trace 跑一局，能答"为什么这回合没用猫爪"。
