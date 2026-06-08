# Game E：《小丑牌·Apollo》Balatro 式扑克 roguelike（Joker Roguelike）

> 负责人：PE（Programmer E / Game Creator）
> 定位：引擎验证游戏 —— 压测「**有序 / 乘法计分结算** + **牌型评估** + **roguelike 构筑经济**」三条全新维度
> 参考：Balatro（LocalThunk）。数值源：[Balatro Wiki · Poker Hands](https://balatrowiki.org/w/Poker_Hands)、[Balatro Wiki · Blinds and Antes](https://balatrowiki.org/w/Blinds_and_Antes)、[Module:Blind Score](https://balatrowiki.org/w/Module:Blind_Score)、[Score Calculation 指南](https://steamcommunity.com/sharedfiles/filedetails/?id=3169032575)

> ⛔ 先读最高原则 `docs/design/data-driven-manifesto.md`：**游戏是数据，不是代码。**
> 本游戏的逻辑（牌型评估、计分结算、盲注门控、构筑经济）必须是**引擎 capability**（现成的用、缺的提需求下沉），
> 游戏目录里只有**数据**（牌组 / 牌型表 / 盲注曲线 / 小丑定义 / 流程）。PE 不写游戏专属系统。
>
> 尺子：「最弱的 LLM 能不能也产出一模一样的数据？」每张小丑都是一行 `{trigger, condition, op, target, value}` 数据 → 能 → 数据接口。

---

## 一、游戏概要

玩家是赌徒，用一副 52 张扑克牌打出「牌型」赚取分数，在**有限的出牌/弃牌次数**内打过逐级抬高的**盲注分数线**。真正的爽点不在扑克本身，而在 **小丑牌（Joker）构筑**：每张小丑是一条「**当[计分事件]发生、在[某条件]下，把[chips/mult/money]做[加/乘]修改**」的规则，多张小丑**有序叠乘**滚出指数级分数。

**一句话**：打扑克牌型攒 `chips × mult`，靠小丑牌构筑把分数滚到爆表，过盲注、进商店、再构筑——一局 roguelike。

三条支柱：

1. **主玩法 · 扑克牌型（操作层）**：从手牌选 ≤5 张出牌，引擎判定牌型 → 给基础 `chips + mult`；逐张计分加 chips。
2. **核心玩法 · 小丑构筑（规则层）**：小丑槽（默认 5）里的每张小丑按声明顺序结算，加/乘 chips 或 mult。**顺序 + 乘法**是分数指数化的关键。
3. **元玩法 · 盲注 / 商店经济（roguelike 层）**：过盲注得 `$`，商店买小丑 / 卡包 / 星球牌（升牌型等级）/ 塔罗牌（改牌），逐 ante 抬高分数线。

---

## 二、核心循环

```
┌──────────────────────────────────────────────────────────────────────┐
│  一个 Ante = 三道盲注：Small(×1) → Big(×1.5) → Boss(×2，带 debuff)        │
│                                                                        │
│   ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐            │
│   │ 抽手牌   │──▶│ 选≤5 出牌 │──▶│ 评牌型     │──▶│ 逐张计分  │            │
│   │(8 张)   │   │(或弃牌重抽)│  │base ch+mult│   │(+chips)  │            │
│   └─────────┘   └──────────┘   └───────────┘   └────┬─────┘            │
│        ▲                                            ▼                  │
│        │                                   ┌──────────────────┐        │
│        │ 还有出牌次数                        │ 小丑按 order 结算  │        │
│        │                                   │ (+ch /+mult /×mult)│        │
│        │                                   └────────┬─────────┘        │
│        │                                            ▼                  │
│        │                              score += chips × mult            │
│        │                                            │                  │
│   ┌────┴───────┐  否(还没过线 & 有次数)              ▼                   │
│   │ 累计 score  │◀──────────────────────  score ≥ 盲注线 ?              │
│   └────────────┘                                   │ 是                │
│                                                    ▼                   │
│                                    过盲注 → 结算 $ → 商店构筑 → 下一道盲注 │
└──────────────────────────────────────────────────────────────────────┘
```

- **出牌 / 弃牌**：每道盲注给固定**出牌次数 hands**（默认 4）+ **弃牌次数 discards**（默认 3）。出牌结算分数；弃牌丢掉选中牌、从牌堆补抽，不计分。
- **过线**：累计 score ≥ 盲注分数线 → 过盲注。出牌次数用尽仍没过 → 失败（Game Over）。
- **结算 $**：过盲注基础奖励 + 剩余出牌次数返利 + 利息（每 $5 生 $1，上限 $5）。
- **商店构筑**：花 $ 买小丑 / 星球牌（升某牌型等级）/ 塔罗牌（改单张牌：加花色/点数/封蜡）/ 卡包。

---

## 三、内容设计（数据）

> 全部为**纯数据表**，落在 `src/games/game-e/` 的内容模块；引擎只提供解释器（牌型评估 = REQ-011、有序乘法结算 = REQ-012、其余现成）。

### 3.1 牌组（`deck.ts` — 一副标准 52 张）

- **花色 suit**：`spades ♠` / `hearts ♥` / `diamonds ♦` / `clubs ♣`。
- **点数 rank**：`2..10, J, Q, K, A`。
- **每张牌的基础 chip 值**（计分时该牌进牌即加）：

| 点数 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K | A |
|------|---|---|---|---|---|---|---|---|----|---|---|---|---|
| chips | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 10 | 10 | 10 | **11** |

> 牌定义 = `{ suit, rank, baseChips }`（数据）。后续塔罗/封蜡可在单张牌上**叠加** `enhancement / seal / edition`（见 §3.6 与 §七的「效果叠加」）。

### 3.2 牌型分值表（`hand-rankings.ts`）—— Level 1 基础 + 每级增量

> 计分公式：`base_chips + Σ(出牌中每张牌的 chips)` 作为 chips，`base_mult` 作为 mult 起点；小丑再修正；最后 `score += chips × mult`。
> 升级靠**星球牌**（每用一次 +1 级，加性增量，可叠）。数值源：Balatro Wiki · Poker Hands。

| 牌型 | id | Lv1 Chips | Lv1 Mult | 每级 +Chips | 每级 +Mult |
|------|----|----------:|---------:|-----------:|-----------:|
| 高牌 High Card | `high_card` | 5 | 1 | +10 | +1 |
| 对子 Pair | `pair` | 10 | 2 | +15 | +1 |
| 两对 Two Pair | `two_pair` | 20 | 2 | +20 | +1 |
| 三条 Three of a Kind | `three_kind` | 30 | 3 | +20 | +2 |
| 顺子 Straight | `straight` | 30 | 4 | +30 | +3 |
| 同花 Flush | `flush` | 35 | 4 | +15 | +2 |
| 葫芦 Full House | `full_house` | 40 | 4 | +25 | +2 |
| 四条 Four of a Kind | `four_kind` | 60 | 7 | +30 | +3 |
| 同花顺 Straight Flush | `straight_flush` | 100 | 8 | +40 | +4 |
| 五条 Five of a Kind ✦ | `five_kind` | 120 | 12 | +35 | +3 |
| 同花葫芦 Flush House ✦ | `flush_house` | 140 | 14 | +40 | +4 |
| 同花五 Flush Five ✦ | `flush_five` | 160 | 16 | +50 | +3 |

> ✦ = 隐藏牌型，需借助卡牌增强（如让多张同点）才打得出。顺子识别含 `A2345`（A 低）与 `10JQKA`（A 高）；并列取最高牌型。

### 3.3 盲注分数曲线（`blinds.ts`）—— White Stake 基础分

> 每个 Ante 有一个**基础分 base**；三道盲注的分数线 = `base × 倍率`：**Small ×1 / Big ×1.5 / Boss ×2**。
> base 数值源：Balatro Wiki · Module:Blind Score（White/基础难度）。

| Ante | base | Small(×1) | Big(×1.5) | Boss(×2) |
|-----:|-----:|----------:|----------:|---------:|
| 1 | 300 | 300 | 450 | 600 |
| 2 | 800 | 800 | 1,200 | 1,600 |
| 3 | 2,000 | 2,000 | 3,000 | 4,000 |
| 4 | 5,000 | 5,000 | 7,500 | 10,000 |
| 5 | 11,000 | 11,000 | 16,500 | 22,000 |
| 6 | 20,000 | 20,000 | 30,000 | 40,000 |
| 7 | 35,000 | 35,000 | 52,500 | 70,000 |
| 8 | 50,000 | 50,000 | 75,000 | 100,000 |

**无限模式（Ante 9+）增量曲线**（base 续表，源同上）：

| Ante | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|-----:|--:|---:|---:|---:|---:|---:|---:|---:|
| base | 110,000 | 560,000 | 7,200,000 | 3.0e8 | 4.7e10 | 2.9e13 | 7.7e16 | 8.6e20 |

> 这是**查表数据**（非闭式公式），曲线呈超指数增长。引擎侧只做一条 `condition: resource(score) gte threshold` 判定（现成 event-when）；threshold 由数据表按 `(ante, blindKind)` 取。**盲注线是数据，门控是现成能力。**
> Boss 盲注另带 **debuff**（如「♦ 牌不计分」「首手强制弃牌」「手牌减 1」）——这些 debuff 同样应表达成数据（条件门控 + effect 改 chips/规则），见 §四缺口评估。

### 3.4 小丑牌分类学（官方 150 张，截至 1.0.1o）—— 这是数据契约的依据

> 全游戏共 **150 张小丑**（105 起手解锁 + 45 条件解锁），4 稀有度（Common 61 / Uncommon 64 / Rare 20 / Legendary 5）。源：[Balatro Wiki · Jokers](https://balatrogame.fandom.com/wiki/Jokers)。
> 官方把小丑按**效果产出**分 **7 型**——这 7 型正是我们数据契约 `{op,target}` 的枚举依据：

| 型 | 符号 | 含义 | 映射到我们的数据 `(op,target)` | 靠什么能力 |
|----|------|------|------------------------------|-----------|
| 加 Chips | `+c` | 加 chips | `add · chips` | ✅ 现成 effect（部分需 REQ-011 取条件/逐张） |
| 加 Mult | `+m` | 加 mult | `add · mult` | ✅ 现成 effect（同上） |
| 乘 Mult | `Xm` | 乘 mult | `mul · mult` | 🟠 REQ-012（多数还需 REQ-011 条件） |
| Chips&Mult | `++` | 同时加 chips+mult | 两条 effect | ✅/🔴 上面两者组合 |
| 经济 | `+$` | 给 money | `add · money` | ✅ 现成 effect（按时机挂信号） |
| 重触发 | `...` | 让某牌/某次计分重复 N 次 | `retrigger · N` | 🔴 见 §4.3（REQ-011 钩子 / 候选缺口） |
| 效果 | `!!` | 改规则/造牌/加槽/免费重摇… | 异质，逐个裁 | 🟡 见 §4.3 覆盖分析（部分新机制） |

**激活时机（Activation）——决定 effect 挂在哪个信号上（事件分类学）**：

| 时机 | 含义 | 对应信号 |
|------|------|---------|
| Indep. | 出牌结算时独立触发一次 | `S_hand_scored` |
| On Scored | 每张**计分牌**触发（被 debuff/未进牌型则不触发） | 逐张计分信号（REQ-011 迭代产出） |
| On Held | 按**留在手里**的牌触发 | `S_hand_held`（REQ-011 需透出「手牌」集合，非仅出牌） |
| On Played | 出牌**那一刻**（评分前） | `S_hand_played` |
| On Discard | 弃牌时触发 | `S_discard` |
| On Other Jokers | 读其它小丑状态（Baseball/Blueprint） | 跨小丑引用 |
| Mixed / N/A | 自累积状态 / 被动改规则 | 见 §4.3 |

**编辑 Edition（= 用户要的「效果叠加在牌/小丑上」的官方机制）**：小丑与扑克牌都可带一层 edition，叠加额外效果、抬高价格：

| Edition | 叠加效果 | 数据 `(op,target,value)` |
|---------|---------|--------------------------|
| Base | 无 | — |
| Foil | +50 Chips | add · chips · 50 |
| Holographic | +10 Mult | add · mult · 10 |
| Polychrome | ×1.5 Mult | **mul** · mult · 1.5 |
| Negative | +1 小丑槽（不占位） | 改槽位资源 |

> **关键结论**：edition 与小丑**同构**——都是一条 `{op,target,value}` effect，统一走 REQ-012 的有序结算。这正面证明「**效果叠加在牌上**」不需要单独机制，与小丑共用同一套数据接口。

### 3.5 起手小丑集（`jokers.ts`）—— 精选 14 张，刻意铺满 7 型 × 激活时机

> **设计意图**：这 14 张全部是**官方真实小丑**（名字/数值/型号均对齐官方表），刻意覆盖 7 型 + 各激活时机，用来验证 REQ-011 / REQ-012 是否足以表达。每行标注官方型号 + 靠什么能力。
> 字段（数据契约）：`{ id, name, rarity, cost, trigger, when?, op, target, value, perCard? }`。

| # | 小丑 | 效果 | trigger（触发时机） | when（条件） | op·target·value | 靠什么能力 |
|---|------|------|--------------------|-------------|------------------|-----------|
| 1 | Joker | +4 Mult | 出牌结算 | — | add · mult · 4 | ✅ **现成**（Resource+event-when+effect-apply） |
| 2 | Greedy Joker | 每张计分的 ♦ +3 Mult | 逐张计分 | card.suit=♦ | add · mult · 3 | 🔴 REQ-011 逐张迭代 |
| 3 | Lusty Joker | 每张计分的 ♥ +3 Mult | 逐张计分 | card.suit=♥ | add · mult · 3 | 🔴 REQ-011 逐张迭代 |
| 4 | Jolly Joker | 含对子 → +8 Mult | 出牌结算 | hand 含 pair | add · mult · 8 | 🔴 REQ-011 写牌型 → ✅ 现成 condition |
| 5 | Zany Joker | 含三条 → +12 Mult | 出牌结算 | hand 含 three_kind | add · mult · 12 | 🔴 REQ-011 |
| 6 | Half Joker | 出牌 ≤3 张 → +20 Mult | 出牌结算 | handSize ≤ 3 | add · mult · 20 | 🔴 REQ-011 元数据(张数) |
| 7 | Scary Face | 每张计分的人头牌 +30 Chips | 逐张计分 | card.rank∈{J,Q,K} | add · chips · 30 | 🔴 REQ-011 逐张迭代 |
| 8 | Even Steven | 每张计分的偶数牌 +4 Mult | 逐张计分 | card.rank 为偶 | add · mult · 4 | 🔴 REQ-011 逐张迭代 |
| 9 | Banner | 每剩 1 次弃牌 +30 Chips | 出牌结算 | — (读 discards 资源) | add · chips · 30×N | ✅ **现成**（读 Resource，按量加） |
| 10 | Bull | 每有 \$1 +2 Chips | 出牌结算 | — (读 money 资源) | add · chips · 2×\$ | ✅ **现成**（读 Resource，按量加） |
| 11 | Cavendish | ×3 Mult | 出牌结算 | — | **mul** · mult · 3 | 🟠 REQ-012 乘法 op |
| 12 | The Duo | 含对子 → ×2 Mult | 出牌结算 | hand 含 pair | **mul** · mult · 2 | 🔴 REQ-011 + 🟠 REQ-012 |
| 13 | Golden Joker | 回合结束 +\$4 | 回合结束 | — | add · money · 4 | ✅ **现成**（回合结束信号→effect） |
| 14 | Hanging Chad | 首张计分牌额外重触发 2 次 | 逐张计分 | card = 第一张 | retrigger · 2 | 🔴 REQ-011（retrigger 钩子，见 §四） |

> **顺序的意义（为何需要 REQ-012 的 `order`）**：把 #1 Joker(+4 Mult) 放在 #11 Cavendish(×3 Mult) 之前 vs 之后，结果不同：`(m+4)×3` ≠ `m×3+4`。Balatro 小丑从左到右结算 → 顺序必须是**声明式数据**（`Effect.order`），不能靠 entity 偶然次序。
>
> 同型其它小丑（不在起手 14 但同机制，落地即数据加行）：Wrathful(♠+3m)/Gluttonous(♣+3m)、Mad/Crazy/Droll(两对/顺/同花 +m)、Sly/Wily/Clever/Devious/Crafty(含某牌型 +c)、The Trio/Family/Order/Tribe(含某牌型 ×m)、Smiley Face(人头+5m)、Odd Todd(奇数+31c)、Scholar(A +20c+4m=`++`)、Walkie Talkie(10/4 +10c+4m)。**全是改数值/改条件的数据，不加代码。**

### 3.5.1 全 150 覆盖分析（PE 架构评审产出）

> 把官方 150 张按 7 型 + 机制聚类，评估 **REQ-011（牌型/逐张）+ REQ-012（乘法/有序）落地后能覆盖多少**，残差是什么。这是本游戏作为「引擎验证游戏」最有价值的一张表。

| 机制聚类 | 代表小丑 | 数量级 | REQ-011+012 后能否表达 | 残差缺口 |
|---------|---------|-------|----------------------|---------|
| 固定加 chips/mult/$ | Joker、Golden Joker | 多 | ✅ 完全（现成 effect） | 无 |
| 含某牌型 → 加/乘 | Jolly、Sly、The Duo/Trio/Family | 多 | ✅ 完全（REQ-011 写牌型 → condition → REQ-012 op） | 无 |
| 逐张计分（花色/点数/奇偶/人头） | Greedy、Even Steven、Scary Face、Fibonacci、Triboulet | 多 | ✅ 完全（REQ-011 逐张迭代 + condition） | 无 |
| **量纲动态值（每 \$1 / 每张 / 每槽）** | Bull、Banner、Abstract、Bootstraps、Blue Joker、Erosion、Stone/Steel Joker | **~15+** | 🟠 **不能**：现 effect 的 `value` 是**静态常量**，表达不了「value = 系数 × 某资源/计数」 | **候选 REQ-013**（见 §4.3） |
| **小丑自累积状态**（"This Joker gains X…"） | Ride the Bus、Green、Constellation、Hologram、Campfire、Vampire、Obelisk | **~20+** | 🟠 **部分**：自累积可用「每小丑一个 Resource + 信号自增」做（现成），但小丑用该 Resource 当 value 仍依赖上面的「动态值」缺口 | 同上 REQ-013 |
| **重触发 retrigger** | Hanging Chad、Mime、Dusk、Hack、Sock&Buskin、Seltzer | ~7 | 🟡 **取决于 REQ-011 接口**：若逐张迭代留「对某张请求 K 次结算」钩子 → 数据；否则小幅追加 | REQ-011 钩子或微扩展 |
| **改评估规则**（被动 N/A） | Four Fingers、Shortcut、Splash、Pareidolia、Smeared | ~6 | 🟡 **需 REQ-011 接受规则修饰位**（4 张成顺/同花、有间隔顺、全员计分、全算人头、花色等价） | REQ-011 入参加 ruleFlags |
| **造牌 / 改牌**（塔罗/星球/幽灵/加牌入组） | 8 Ball、Marble、DNA、Midas Mask、Cartomancer | ~20 | 🟡 **需「生成/改牌」能力**：spawn 现成，但「往牌组永久加牌 / 改单牌增强」需牌组作为持久数据被改 | 牌组改写（可用 spawn+数据，待 REQ-011 牌组形态定） |
| **复制 / 指向其它小丑** | Blueprint、Brainstorm、Baseball、Joker Stencil | ~4 | 🟡 **需小丑间引用**（读"右侧/最左/某稀有度"小丑的 effect） | 跨实体引用（可用 Relation 现成原子表达，待装配验证） |
| **概率** | Bloodstone、8 Ball、Business Card、Oops!All 6s | ~10 | ✅ 可表达（random 原子 + condition），Oops 改概率=改数据 | 无（random 现成） |
| **元/经济规则**（加槽/加手牌/免费重摇/债务/卖牌禁用 Boss） | Negative、Juggler、Chaos、Credit Card、Luchador | ~20 | ✅ 多数现成（改资源/改槽位/改规则数据） | 无 |

**结论（PE 裁决）**：
- **REQ-011 + REQ-012 落地后，约 ⅔ 的小丑（固定值 + 含牌型 + 逐张 + 概率 + 多数经济）即纯数据可表达**，无新代码。
- **唯一明确的新缺口是「量纲动态值」**（value = 系数 × 资源/计数），它一并解掉「自累积状态」一大类（~35 张）。这是 effect-apply 的又一处**微型 DSL 扩展**（`valueFrom:{resourceId,coeff}`），不是新能力 → **候选 REQ-013，建议待 REQ-011/012 落地后提**（避免与在改的 effect-apply 撞车 + 避免过度设计）。
- retrigger / 规则修饰 / 造牌 / 小丑互引 这四类，**大概率是 REQ-011 的接口设计副产物**（留钩子即数据），不预先提单，待 REQ-011 接口定稿逐一裁。**全程不为单张小丑写游戏 system。**

### 3.6 商店 / 经济（`shop.ts` + 现成 craft-recipe）

| 项 | 价格区间 | 作用 | 靠什么能力 |
|----|---------|------|-----------|
| 小丑牌 | \$2–\$10（按稀有度） | 加入小丑槽（默认 5 槽） | ✅ craft-recipe 消费 + 装配 Effect 实体 |
| 星球牌 | \$3 | 某牌型 +1 级（加 §3.2 增量） | ✅ effect modify-resource（牌型等级资源） |
| 塔罗牌 | \$3 | 改单张牌（加花色/点数/增强） | 🟠 改单牌 = 在牌数据上**叠加** enhancement（见 §3.6） |
| 卡包 | \$4–\$6 | 开 N 选 K（小丑/星球/塔罗） | ✅ 现成随机(random)+clickable 选择 |
| 重摇 Reroll | \$5 起，递增 | 刷新商店内容 | ✅ random + 经济扣费 |

**经济规则（数据 + 现成能力）**：过盲注基础 \$ + 剩余 hands 返利（每 1 次 +\$1）+ **利息**（每 \$5 生 \$1，上限 \$5）。利息 = 一条 `condition` 阶梯 → effect modify money，纯数据。

### 3.7 卡牌增强 / 封蜡 / 版式（`enhancements.ts` — 「效果叠加在牌上」）

> 对应用户要求：**功能描述效果可以叠加在牌上**。一张扑克牌 = 基础 `{suit,rank,baseChips}` + 可选叠加层，**全是数据**，渲染时按层合成（见 §七）：

| 叠加层 | 字段 | 例子 | 计分时的数据效果 |
|--------|------|------|-----------------|
| 增强 enhancement | `enhancement` | Bonus(+30 chips)/Mult(+4 mult)/Glass(×2 mult,1/4 碎)/Steel(在手×1.5 mult)/Gold(回合末+\$3)/Wild(算任意花色)/Stone(+50 chips 无花色点) | 计分该牌时追加 chips/mult/规则 |
| 封蜡 seal | `seal` | Gold(计分+\$3)/Red(重触发1次)/Blue(留手生成星球)/Purple(弃牌生成塔罗) | 触发额外事件 |
| 版式 edition | `edition` | Foil(+50 chips)/Holographic(+10 mult)/Polychrome(×1.5 mult)/Negative(不占槽) | 计分追加，版式也可挂在**小丑**上 |

> 增强/封蜡/版式都是「该牌计分时叠加的一条 effect」——与小丑同构（都是 `{op,target,value}`），**统一走 REQ-012 的有序结算**。这证明「效果叠加在牌上」与「小丑」是同一套数据机制的两个出口，不需要各写一套。

---

## 四、引擎能力映射（有 vs 缺）

> 这是本游戏作为「引擎验证游戏」的核心产出：暴露引擎在 **有序/乘法计分 + 牌型评估** 维度的缺口。逐条用 manifesto 尺子裁过。

### 4.1 现成能力即可表达（**回驳任何新写 system 的提法**）

| 游戏需求 | 用什么现成能力 |
|---------|--------------|
| chips / mult / score / money / hands / discards 数值 | `resource`（按 id 全局路由 R11） |
| 「出牌时触发」「含对子时触发」「\$≥X 时触发」 | `event-when` + `ConditionExpr`（and/or/not + resource/flag/state/string 叶子） |
| 加法类小丑/增强（+chips、+mult、+\$） | `effect-apply` kind:`modify-resource`（current+value） |
| 盲注分数线门控 | `event-when` 的 `condition: resource(score) gte threshold`（threshold 取自 §3.3 数据表） |
| 回合状态机（抽→选→出/弃→结算→商店→下一道） | `state` 原子 + 逻辑链（见 §五流程） |
| 选牌 / 出牌 / 弃牌交互 | `clickable`（Game C 选格已验证）→ Signal → effect |
| 洗牌 / 抽牌 / 卡包随机 | `random`（种子 PRNG，确定性）+ `spawn` |
| 买小丑 / 星球 / 塔罗的消费 | `craft-recipe`（攒料→消费→装配，Game C 已用） |
| 利息 / 返利经济 | `condition` 阶梯 → `effect modify-resource` |

→ 目标：`src/games/game-e/` **零游戏系统代码**，数据测试证明计分链在能力上确定性跑通。

### 4.2 引擎缺口（已提需求，主程序实现中）

| 缺口 | 需求 | 性质 |
|------|------|------|
| 扑克牌型评估 + 持牌有序集合（逐张/按花色迭代） | **REQ-011** `@skills/tier3/poker-hand` | 真缺口·新 Tier3 能力（对齐 match3-board 范式） |
| `×倍率` 乘法 + 小丑结算顺序（`op:add\|mul\|set` + `Effect.order`） | **REQ-012** effect-apply 扩展 | 真缺口·现有能力的微型 DSL 扩展（向后兼容） |

### 4.3 待评估的潜在第三缺口（**先不提单，待 REQ-011 落地再裁**）

- **retrigger（重触发）**：#14 Hanging Chad、Red Seal、Mime 等让某张牌/某次计分**重复触发 N 次**。这是 REQ-011「逐张迭代」的一个钩子——若 REQ-011 的迭代接口设计成「可对单张牌请求 K 次结算」，则 retrigger 是数据（`perCard.retrigger:N`），**无需新能力**；若没留钩子，才需小幅追加。**诚实标注：待 REQ-011 接口定稿再判定，不预先提单（避免过度设计）。**
- **Boss debuff**：「♦ 不计分 / 手牌 -1 / 首手强制弃」。多数可用 `condition + effect` 表达（门控规则改数据）；个别「不计分」需 REQ-011 的逐张迭代支持「跳过某张」标志。同样待 REQ-011 接口定稿评估。

---

## 五、回合流程状态机（数据，非代码）

> 整个回合用一个 `State{fsmId:"round"}` + 逻辑链驱动，**无回合 system**。每个转移 = `event-when`(条件) → `effect-apply`(set-state)。

```
deal ──(选牌完成 signal)──▶ selecting ──(出牌 signal)──▶ scoring
  ▲                              │ (弃牌 signal)              │
  │                              ▼                            ▼
  └──(还有 hands & 未过线)── settle ◀──(score 结算/比线)── resolve
                                 │ (score≥线)
                                 ▼
                              shop ──(离开商店)──▶ deal(下一道盲注)
                                 │ (hands 用尽且未过线)
                                 ▼
                              game_over
```

- `deal`：洗牌(random) + 抽 8 张到手牌(spawn)。
- `selecting`：clickable 选 ≤5 张；出牌/弃牌按钮 = 两个 Signal。
- `scoring`：REQ-011 评牌型 → 写 base chips/mult → REQ-012 按 order 跑小丑/增强 → `score += chips×mult`（一条 mul+add 的 effect 链）。
- `resolve`：`condition score gte 盲注线` → 过线 set-state `shop`；否则回 `settle`。
- `settle`：hands 减 1；`condition hands lte 0` → `game_over`。

---

## 六、开发路线（与引擎迭代对齐）

| 版本 | 引擎依赖 | 游戏交付物 |
|------|---------|-----------|
| **v0.1（本版）** | 全现成（resource/event-when/effect/condition/state） | 设计稿（本文件）+ 内容数据表（牌组/牌型/盲注/小丑/增强）+ **「平凡小丑 +4 Mult」最小加法计分链**（纯数据 + 测试，证明数据闭环）；牌型/乘法缺口已提 REQ-011/012 |
| **v0.2（待 REQ-012）** | effect-apply `op:mul`+`order` 落地 | `score = chips × mult` 真正成立；乘法小丑(Cavendish)、版式(Polychrome)可玩；**有序结算**测试（先+后× ≠ 先×后+） |
| **v0.3（待 REQ-011）** | poker-hand 能力落地 | 真扑克：选牌→评牌型→逐张计分；条件/逐张小丑(Greedy/Jolly/Half)全部点亮；牌型评估测试 |
| **v0.4** | clickable + craft-recipe（现成）+ random | 完整回合：抽/选/出/弃 + 盲注三道 + 商店买小丑/星球/塔罗 + 经济利息 |
| **v0.5** | 资产流程（R1 texture/atlas，现成） | 卡面美术（底图+小丑/名字/效果叠加渲染）+ launcher 卡带接入可玩 |
| **v1.0** | serialization（白送机制） | 存档 + 完整一周目（8 ante）+ 无限模式 + 小丑图鉴 |

---

## 七、美术方向 + 「效果叠加在牌上」资产管线

> 用户已上传 **150 张小丑美术 + 卡面素材**。**⚠️ 接入状态（诚实标注）**：网页对话上传的图片**不会落到远程容器的文件系统**（附到对话、非仓库工作区），故本 session 内我**无法把这些图片作为文件提交/接线**。下面的管线 + 命名约定已就绪，**素材一旦进仓库即自动绑定，零代码改动**。
>
> **素材落地三选一**（任一即可让 150 张自动生效）：
> 1. 用户把素材推到本分支的 `assets/game-e/jokers/`（推荐，见下命名约定）；
> 2. 给我一个可下载的 zip / URL（网络策略允许时我 fetch 进仓库）；
> 3. 告诉我素材现有的文件名清单，我写一张 `jokerId → 文件名` 映射表对齐。
>
> **命名约定（按 joker id，让 150 张零配置绑定）**：`assets/game-e/jokers/<joker_id>.png`（如 `joker.png` `greedy_joker.png` `cavendish.png`…，id 用 §3.4 的蛇形小写）。`game-e/assets.ts` 用官方 150 id 列表批量注册 `texture` key：`j_<id> → assets/game-e/jokers/<id>.png`，小丑数据的 `artKey` 默认 = `j_<id>`。缺图自动退化占位方块（sim 不受影响）。卡面底图同理：`assets/game-e/card-frame.png` → key `card_frame`。

**卡面 = 底图 + 数据叠加层，渲染时合成（全部走现成资产系统 R1）**：

```
一张卡（小丑或扑克牌）的渲染 = 多个 Sprite/Text 按 zOrder 叠：
  [底层] card_frame   ← 用户上传的卡牌素材底图（texture key）
  [中层] art          ← 小丑美术 / 扑克花色点数（texture/atlas key，数据指定）
  [上层] name         ← 小丑名（text 原子）
  [底注] effect_text  ← 效果描述（text 原子，由 §3.4 的 {op,target,value} 自动生成人话）
  [角标] cost/edition ← 价格、版式光效（Foil/Holo/Poly 叠色，数据驱动）
```

- 「**功能描述效果叠加在牌上**」= `effect_text` 层：把小丑/增强的数据 `{op,target,value,when}` **自动翻译成一句中文描述**（如 `mul·mult·3` → "×3 倍率"），叠在底图上。**描述是数据的投影，不手写**——一张小丑改了数值，卡面文字自动跟着变。
- 底图、花色图标、小丑美术全用 string key 经 `AssetManager`（texture/atlas kind）；缺图时退化占位方块也能跑（sim 不受影响）。
- 风格建议：致敬 Balatro 的高对比霓虹像素 + CRT 噪点；版式光效（Foil 冷光 / Holographic 彩虹 / Polychrome 流光）用 `Color`/alpha 数据叠加，表现层不进 sim。

> **素材交接**：把上传的卡牌底图放到 `assets/`（建议 `assets/game-e/card-frame.png` 或纳入 FreeArtLib 索引），在 `game-e/assets.ts` 注册一个 `texture` key 即可被卡面底层引用。我可在文件就位后接线。

---

## 八、引擎验证重点

Game E 给引擎引入两条 A/B/C/D 都没压过的全新维度：

| 维度 | 怎么压测 | 对引擎的意义 |
|------|---------|------------|
| **有序 + 乘法计分结算** | 多张小丑/增强按 order 加乘叠加，先+后× 与先×后+ 结果不同 | 验证 effect-apply 从「加性·顺序无关」扩到「有序·含乘法」后**仍确定**（REQ-012）；这是一切「构筑叠乘」类游戏（Balatro/杀戮尖塔遗物）的通用底座 |
| **牌型评估即数据解释器** | 5 张牌 → 牌型判定 + 逐张/按花色迭代 | 验证「规则评估」能否像 match3-board 一样收敛成确定性通用能力（REQ-011），而非游戏专属算法 |
| **roguelike 构筑经济** | 小丑槽 + 商店 + 星球升级 + 塔罗改牌 + 利息 | 验证 craft-recipe / condition / random 撑不撑得起「买→装配规则→改基线」的构筑循环；增强/封蜡/版式证明「效果叠加」与「小丑」同构 |

---

## 九、验收标准（按版本）

**v0.1（本版，纯数据 + 设计 + 最小链）**

- [ ] 设计稿（本文件）齐备：牌组/牌型/盲注/小丑/增强全部表达为数据表，数值对齐权威源
- [ ] 内容数据模块 `game-e/{deck,hand-rankings,blinds,jokers,enhancements}.ts` 落地为纯数据
- [ ] 一致性测试：牌型表覆盖全 12 型、盲注 base 单调递增、每张小丑的 target∈{chips,mult,money} 且 op∈{add,mul,set}
- [ ] 「平凡小丑 +4 Mult」加法计分链装配为纯数据 + 测试（现成能力，今天全绿）
- [ ] 牌型/乘法缺口已提规范需求 REQ-011 / REQ-012（已提，主程序实现中）

**v0.2（待 REQ-012）**

- [ ] `score = chips × mult` 成立；乘法小丑可玩；有序结算（先+后× ≠ 先×后+）测试通过

**v0.3（待 REQ-011）**

- [ ] 选牌→评牌型→逐张计分确定性跑通；条件/逐张小丑全部点亮
```
