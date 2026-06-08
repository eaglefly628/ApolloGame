# Game E · Boss 盲注 Debuff 目录 + 能力评审（PE）

> 单人 MVP 的 Boss 盲注现在只有 ×2 分数线、**没有 debuff**。Balatro 的 Boss 盲注核心就是「带一条诅咒规则」。
> 本文把官方 Boss debuff 按**机制原型**归类，逐类过 manifesto 尺子：**现有能力能组合 → 数据；真表达不了 → 标小缺口**。
> 配套：`game-e-joker-roguelike.md`（单人）、`balatro-coop-vs-boss.md`（合作）。Boss debuff 接线点依赖 **REQ-017（回合流程下沉数据状态机）** —— 本目录是它落地后即可填的**数据 + 评审**，先备好不阻塞。

---

## 0. 接线模型（数据形态）

一条 Boss 盲注 = 一份数据：`Boss{ name, scoreMult, debuff }`。`debuff` 是声明式规则，挂在「选中该盲注」时（`on_blind_selected` 信号）置入世界、过盲注后撤销。多数 debuff = `condition + effect`（改资源/置 flag），随回合状态机（REQ-017）的 `selecting/scoring` 相位读。

```jsonc
boss = { Boss:{ name:"The Wall", scoreMult:4 },              // 大墙：线 ×4（普通 Boss ×2）
         BossDebuff:{ kind:"score_mult", value:2 } }          // = 在 ×2 基础上再 ×2
```

---

## 1. Debuff 机制原型 × 能力评审

| 原型 | 官方例子 | 数据写法 | 裁决 |
|------|---------|---------|------|
| **加大分数线** | The Wall（线特大） | `Boss.scoreMult` 提高（盲注线 = base × mult，REQ-017 已读） | 🟢 **重组**（纯数值） |
| **砍出牌/弃牌/手牌额度** | The Manacle(-1 手牌)、The Water(0 弃牌)、The Needle(只 1 手) | `on_blind_selected` → `effect modify-resource`(`hands_left`/`discards_left`/手牌 size 减) | 🟢 **重组**（现成 effect 改资源） |
| **基础 chips/mult 减半** | The Flint（base chips&mult 半） | `effect op:'mul' value:0.5` 作用于 chips/mult（REQ-012 已支持 mul） | 🟢 **重组** |
| **每出一张牌扣钱** | The Tooth(-$1/张) | 逐张：`PerCardRule{ op:'add', targetResource:'money', value:-1 }`(REQ-014) 或结算后按张数 effect | 🟢 **重组** |
| **出牌张数约束** | The Psychic(必须出 5 张)、The Mouth(只许一种牌型) | 出牌按钮门控：`condition`(hand_size eq 5 / hand_type 锁定) 决定能否 commit；REQ-017 状态机的 `selecting→scoring` 转移加这条 condition | 🟢 **重组**（条件门控） |
| **不准重复牌型** | The Eye(本盲注每种牌型只算一次)、The Mouth | 需记「本盲注已出过的牌型集合」→ 用 flag/StringVar 标记 + condition 读 | 🟡 **重组（多步）**：每出一手 set 该牌型 flag，下次 condition 拒/零分；与 REQ-016「本拍上下文」同源思路，纯数据多步涌现 |
| **★ 指定花色/点数的牌不计分** | The Club(♣ debuff)、Goad(♠)、Window(♦)、Head(♥)、Plant(人头) | 计分时**跳过被 debuff 的牌**（不加 baseChips、不触发逐张小丑） | 🔴 **真缺口（小钩子）**：card-scoring 的「计分牌」判定需再过滤一层「未被 debuff」。建议 `PlayedCard`/牌带 `debuffed` 标志，或 BossDebuff 提供「禁某 suit/rank」谓词，scoringCardIndices 排除之。**小扩展，非新能力** |
| **★ 抽到的牌盖着(face down)** | The House/Fish/Wheel/Mark/Serpent | 纯**表现层**（牌面朝下显示）——不影响计分数据；UI 层一个 flag 即可 | 🟢 **重组（表现层）**，sim 无关 |
| **改已打出牌型等级** | The Arm(降本手牌型 1 级) | `effect modify-resource`(该牌型 level -1) → poker-eval 读 level（若牌型分支持升级资源） | 🟡 **取决于牌型升级是否已资源化**（星球牌同款依赖）；未做则连星球牌一起评估 |

---

## 2. 裁决汇总

- **~85% 的 Boss debuff = 现有能力重组**（改资源额度、×0.5 base、出牌条件门控、扣钱、表现层盖牌），**零新能力**，等 REQ-017 回合状态机落地即可挂 `on_blind_selected → condition/effect` 数据。
- **唯一真缺口（小钩子）**：**「指定花色/点数的牌不计分」**（Club/Goad/Window/Head/Plant 等一大类）——需 card-scoring 的计分牌判定再过滤一层「未被 debuff 的牌」。建议给牌或 BossDebuff 一个「禁 suit/rank」谓词，`scoringCardIndices` 排除之。**小扩展（REQ-014 的副产物），非新 Tier3 能力**。
- **依赖**：① 接线点等 **REQ-017**（回合状态机 + `on_blind_selected` 信号）；② 「降牌型等级 / 不重复牌型」与**星球牌升级**共享「牌型 level 资源化」前置——做星球牌时一并评估。
- **不预先提单**：先等 REQ-017 落地，验证「砍额度 / ×0.5 / 条件门控」这批纯数据 debuff 能跑通；再就「牌不计分」小钩子单独提 REQ（与 BUG-001 的 scoringCardIndices 同处，改动集中）。

---

## 3. 起步 Boss debuff 数据（REQ-017 后即可填）

每个 Ante 的 Boss 随机选一条（先做这 5 条纯重组的，验证闭环）：

| Boss | 效果 | 数据 |
|------|------|------|
| The Wall | 分数线 ×2（更硬） | `scoreMult:4`（普通 ×2 之上） |
| The Manacle | 手牌 -1（发 7 张） | `effect`: 手牌 size -1 @ blind_selected |
| The Water | 本盲注 0 弃牌 | `effect set discards_left=0` |
| The Needle | 本盲注只 1 次出牌 | `effect set hands_left=1` |
| The Flint | 基础 chips/mult 减半 | `effect op:mul value:0.5` on chips & mult |

> 这 5 条全是 `on_blind_selected → effect modify-resource`，REQ-017 一通就能挂上、`game-e.test.ts` 加用例验证，零新能力。
