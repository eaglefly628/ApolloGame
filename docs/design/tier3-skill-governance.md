# Tier3 能力治理 + 现有 genre skill 审计（Lead 决议）

> 配套最高纲领 `data-driven-manifesto.md`。本文回答两个问题：
> ① **什么时候该建一个新 Tier3「品类 skill」？**（治理规则，给 PA/PB/PC/PE 统一尺子）
> ② **现有 genre skill 能不能被打散的组件拼回去？**（重组复核审计）

---

## 1. 立场：专门 skill ≠ 游戏专属代码

manifesto 从不要求"少数万能 skill 覆盖一切"。它要的是两条**不变量**：
1. 用户/LLM 只填**数据**、永不写代码；
2. 同样数据、不同强弱 LLM 产出**一致**。

→ **一个品类专门的 skill 完全合法——只要它是"数据喂养的固定确定性解释器"。** `poker-hand` 只服务扑克类、却让所有扑克游戏变纯数据：这是 manifesto 的**兑现**，不是违背。

**红线**：专门 skill 的"动词"固定（引擎写、审计过），游戏填的是"宾语"（数据）。一旦 skill 开始吃"灵活到等于在 JSON 里编程"的脚本，不变量②破功 → 退回 DSL 收窄或拆解。

**硬指标对齐**（manifesto §7）：品类 skill 进引擎**不计入**"游戏层代码债"——它是引擎词汇。它是把某游戏压到"100% 数据"的手段。

---

## 2. 决策判据：该不该建新 Tier3 skill（按顺序）

| # | 问 | 是 → | 否 → 下一问 |
|---|---|---|---|
| 1 | 能用现有 capability **重组**表达？ | **回驳**（manifesto §4 先重组），给等价数据写法 | ↓ |
| 2 | 已被现有能力**功能覆盖**？ | **回驳**（标 done-covered，给证明测试） | ↓ |
| 3 | 是**确定性算法/解释器**，且面向游戏的接口是**最弱 LLM 也能填的数据**？**且 ≥2~3 个同品类游戏会用**（rule of three）？ | **ACCEPT**，建 Tier3 解释器（确定性、审计、品类复用） | ↓ |
| 4 | 是**单游戏专属逻辑 / 要写自由代码**？ | 不是 skill。消成数据；真不行才走 §5 沙箱 custom capability 并记债 | — |

**两个失败模式（提需求/评审时盯死）**：
- **过早品类化**：为只有 1 个游戏的品类建包 → 投机、必返工。**等真实游戏拉动**（rule of three）。
- **解释器滑向自由逻辑**：吃的脚本越来越像代码 → 不变量②破。

---

## 3. 心智模型："genre pack"（品类解释器包）

Tier3 = **按品类的解释器库**，每包三五个数据驱动解释器：

| 品类 | 包内 skill | 游戏填的数据 |
|---|---|---|
| 卡牌 | poker-hand · card-scoring · card-play | rankingTable / 逐张规则 / 出牌输入 |
| VN | dialogue | 对话图 JSON |
| 三消 | match3-board | 棋盘 config |
| ARPG | aggro · steering · hitbox · mortal · prefab · caster | 模板/感知/技能数据 |

引擎 = "品类解释器的库"；游戏 = 选包 + 填数据。**能力数随品类增长是健康的**——只要每个过 §2 判据。

---

## 4. 现有 genre skill 重组复核审计（2026-06-08，主程4）

> 尺子：**Condition→Event→Effect（反应式布尔）+ 原子能否拼出它？** 拼不出（要带循环/网格扫描/有序迭代/图遍历/数据依赖转移/多实体展开）→ 是真解释器，保留。

| skill | 核心算法 | 能否重组拼回？ | 裁决 |
|---|---|---|---|
| **poker-hand** | 牌型判定（计数/排序短路）+ 计分牌集 | ✗ 带计数/排序的算法，C→E→E 表达不了 | **保留**（真解释器） |
| **card-scoring** | 逐张迭代 + retrigger 乘性耦合 | ✗ 有序迭代 + 逐元素上下文，聚合表达不了 | **保留** |
| **dialogue** | 图遍历：按 State 游标查脚本表 → 写 Text + 数据依赖转移(next) | ✗ effect 只能 set 固定值、无"跳到节点 next"、无"表驱动文本" | **保留** |
| **match3-board** | 网格 ≥3 连扫描 + 重力 + 补块 + 连锁相位机 | ✗ 网格邻接扫描 + 循环 | **保留** |
| **prefab** | 从数据模板确定性展开**多实体** + 深拷贝 + 偏移 | ✗ 多实体结构展开，无原子做"宏展开" | **保留**（且是反 YAML-编译器的祝福方案） |
| **aggro** | 逐实体 nearestByTag → 写 Relation(target) | △ **薄**（基本是 atom nearestByTag 的一层循环+写 Relation） | **保留**：reuse 站得住（Relation 被 steering/caster/facing **三家**消费，rule of three 达标） |
| **caster** | Signal + 位置策略(self/pointer/target) → SpawnRequest{算好坐标} | △ **可整合** | **保留但标整合机会**（见下） |
| **card-play** | 命令流 → 按 owner 路由 PlayedHand + scoring flag | △ 目前**单一消费者**(Game E) | **保留但 provisional**：rule of three 未达；待第二个卡牌游戏再判通用性 |

### 🟠 审计真发现：caster 的两个整合机会（建议，未执行，待授权）
1. **caster 可并入 effect-apply 作 `kind:'spawn'`**：caster 本质 = "Signal 在场 → 写一个 SpawnRequest"，与 effect-apply 的 "Signal → set-flag/modify-resource" **同形**。把它做成 `Effect{kind:'spawn', template, at:'self'|'pointer'|'target'}` 就能**消解 caster 这个独立能力**，统一"信号→世界改动"的单一表面（少一个能力、少一份信号扫描）。位置策略 self/pointer/target 变 effect 的数据字段。
2. **caster 的 `at:'target'` 与 aggro 索敌重复**：caster 自己又跑一遍 nearestByTag，而 aggro 已把"最近目标"产物化成 `Relation(target)`。caster 应**读现成 Relation** 而非重扫 → 去掉一处重复扫描 + 行为一致。

> 结论：**8 个 genre skill 中 6 个是不可约解释器（保留无疑）；aggro 薄但 reuse 达标；caster 是唯一明确的"可整合/去重"项，card-play 待 rule-of-three 复核。** 整体健康，无冗余能力堆积，但 caster 整合值得排期（小、降复杂度、统一信号→世界改动表面）。

---

## 4.5 宪法澄清：声明式「流程/状态机 DSL」受祝福（2026-06-09，用户拍板 + 主程4 落地 REQ-020）

**用户提案**：游戏流程（Game State）千差万别，难以全拆成散件数据；**可以接受 LLM 为状态流转写"脚本"——前提是足够简单、像数据、线性瀑布**。

**Lead 精确化 + 裁决（ACCEPT，但钉死"脚本"= 声明式状态机，非自由代码）**：
- **能接受**：闭语法的**声明式状态机数据**——`states:[{id,onEnter,transitions:[{when:ConditionExpr, to, do:FlowAction[]}]}]`。`when` 复用现有条件树、动作复用 Effect 动词子集。读起来像线性瀑布脚本，**本质是数据**，由固定引擎解释器（`flow` 能力）跑。
- **不能接受**：`when:"() => ..."` 之类自由代码字符串——那一刻不变量②（最弱 LLM 一致）就死。差别 = manifesto §6「做成 DSL（可）vs 写代码（拒）」。
- **它是 `dialogue` 的同构**（图遍历解释器），dialogue 早被祝福 → 通用 `flow` 状态机解释器完全对齐。

**⭐ 治理判据的重要补充（§2 的精炼）**：**"散件能重组、但最弱 LLM 难一致产出"本身就是建一个"收敛解释器"的正当理由。**
- 即：§2 判据 #1（"能重组就回驳"）有一个例外——当重组形态**散落/顺序敏感/指代间接**到最弱 LLM 无法稳定复现时，**可创作性/一致性（不变量②的本体）**就是缺口。此时建一个**收敛解释器**（不加表达力、加可创作性），是 manifesto 的兑现而非违背。
- 例：回合流程用 EventWhen+Effect+State 散件**能**表达（已证），但散成 ~10 个实体；`flow` 把它收成**一份 GameFlow 数据** → 这是 ACCEPT 的正当理由。
- **防滥用**：此例外只给"收敛/可创作性"，不给"图省事新建能力"。仍须过：闭语法、确定性、复用现有原语（不另造表达式语言）、rule of three。

**REQ-020 落地**：`@skills/tier3/flow`（声明式状态机解释器）+ ConditionExpr 加 `always` 叶子（线性瀑布）。`flow.test.ts` 证：回合 won/lost 分支收成一份 GameFlow、线性瀑布、onEnter 边沿、流程间 set-state 联动。**跨所有游戏复用**（通关/场景/回合/波次/ante），非品类专属。

## 5. 治理流程（落地）
- 任何"要个新 skill"的请求，评审先走 §2 判据表，结论（ACCEPT/回驳）+ 理由写进 `requests.md`。
- 新 Tier3 skill 开工前读 `wiki/skills/` 对应品类 + 周期表，避免另起炉灶/重叠。
- 每隔若干程做一次 §4 式重组复核，防能力库无序膨胀；发现可整合项（如 caster）排期收敛。
- **Tier4 保持"数据装配"**：AI 行为 = aggro+steering+state+condition 拼；真装配不出来 → 下沉成 Tier3 解释器，**不在 Tier4 写一次性代码**。
