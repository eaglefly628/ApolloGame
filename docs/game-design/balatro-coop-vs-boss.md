# 小丑牌·合作 vs Boss —— MVP 规格 + 能力评审（Lead 决议）

> 在写任何游戏数据前先过纲领尺子：**每块机制 → 现有能力可组合就回驳、真表达不了才下沉新 capability。** 结论先行：**这游戏 ~90% 是现有能力重组，真缺口只有 1 个核心能力 `pattern-score`**（+1 个候选小助手）。这正是"游戏=数据"该有的样子。

## 0. MVP 范围（去风险的构建顺序）
- **MVP-0：单人 vs Boss 核心闭环**（先不联机）——打牌→认牌型出分→分数砸 Boss 血→Boss 每回合诅咒你→商店买小丑→Ante 升级。把"卡牌引擎 + Boss 循环"跑通。
- **MVP-1：加合作**——同一个确定性 World 里塞第二个玩家的实体 + lockstep 输入；两人同砸一个 Boss、Boss 同时诅咒两人。**因为是同一个 World，联机基本是"加一组实体 + 接现成输入层"，不是重写。**
- 刻意不做：1v1 PvP 平衡（那是后续）、顺序敏感小丑、长期 meta。

## 1. 能力评审（核心：接受 or 回驳，带理由）
| 需求 | 现有能力能否组合 | 裁决 |
|---|---|---|
| 认牌型→基础分（同花/葫芦/顺子…→ chips×mult） | 无能力能对"一组牌的花色/点数"求值 | 🔴 **真缺口 → 新能力 `pattern-score`**（见 §2） |
| 牌库/手牌/抽弃（确定性洗牌） | RandomSeed(确定RNG)+Tag/Relation(分区)+小系统 | 🟡 **候选小能力 `card-pile`**（广复用:任何摸牌/抽袋）；也可勉强重组，先评估 |
| 小丑修正（当X→+Y/×Y，**扁平**） | **Condition→Event→Effect**：event-when 读"本手牌型/flag"→ effect 改 mult/chips 资源 | 🟢 **回驳**：现成重组，小丑=纯数据 |
| 顺序敏感小丑（×2 再转乘、流经站数…） | 需"有序累加器折叠" | 🔵 新能力 `reduce-chain`，**MVP 缓做**（扁平小丑先顶；这是队列小丑方向） |
| 分数 → 砸 Boss 血 | effect-apply `modify-resource`（全局按 id） | 🟢 回驳：Boss 血 = 一个 Resource |
| Boss 诅咒（本回合同花不算/冻结小丑/塞废牌） | condition + Flag + effect-apply + Timer/State 排程 | 🟢 回驳：Boss = 数据（一张诅咒排程表） |
| 商店 / 经济 / 买小丑 | **craft-recipe**（够钱才成交、原子扣款 + 给小丑）+ Resource(钱) | 🟢 回驳：商店 = craft-recipe（game-c 缝制同款） |
| 回合 / 轮次 / Ante 升级 | State 机 + Timer + Condition | 🟢 回驳 |
| **合作联机（两人同打 Boss）** | **lockstep + queued-input + 确定性 World/hash**（引擎本就为此造） | 🟢 回驳：现成，加一组实体即可 |
| 跨玩家 / 定向效果（Boss 诅咒落到某玩家） | effect-apply 全局按 id 路由 | 🟢 回驳 |
| 卡牌 UI（手牌/拖拽出牌/小丑排/Boss 条） | Sprite/Text + clickable→Signal + 薄布局 | 🟠 **债提醒**：别写成巨型手写组件，尽量消解为"实体+clickable"数据，布局只做薄层 |

**裁决汇总**：真要新下沉的核心只有 **`pattern-score`**；`card-pile` 是候选小助手（评估后定）；`reduce-chain` MVP 缓做。**其余全部现有能力重组。**

## 2. 唯一核心新能力：`pattern-score`（契约草案）
**为什么非新不可**：现有 `ConditionExpr` 只能"按 id 读 resource/flag/state"，**无法对"一组牌的花色/点数多重集"求值**（"5 张同花""3+2 葫芦"）。认牌型是确定性算法 → 该进引擎；牌型表是数据 → 弱 LLM 也能填。过纲领尺子。
```jsonc
// 挂在"出牌区"实体上：
Component PatternScore {
  reads: "已打出的牌实体集（各带 Card{suit,rank}）",
  patterns: [                               // ← 数据：牌型表（可被任意弱 LLM 照填）
    { name:"flush",      when:"5 same suit",      chips:35, mult:4 },
    { name:"full_house", when:"3 of a kind + pair", chips:40, mult:4 },
    { name:"pair",       when:"2 same rank",      chips:10, mult:2 }
    // …命中最高优先级者 → 产出 ScorePacket{chips,mult}（写 Resource 或发 Signal 带 payload）
  ]
}
```
**唯一真正的引擎活** = 实现"牌多重集谓词"求值器（same-suit/n-of-a-kind/straight）。⚠️ 开工前必读 `wiki/skills/index.md` 对应分类（CLAUDE.md 规定），决定原子分解/命名，别另起炉灶。

## 3. 数据草图（其余皆数据）
```jsonc
card  = { Card:{ suit:"spade", rank:11 }, Sprite:{textureKey:"item/..."}, Clickable:{action:"play"} }
joker = { EventWhen:{ when:{handType:"flush"}, signal:"j_flush" },        // 扁平小丑=condition+effect
          Effect:{ onSignal:"j_flush", kind:"modify-resource", targetId:"mult", value:4 } }
boss  = { Resource:{id:"boss_hp", current:300}, Curse:{ schedule:[             // Boss=排程数据
            {turn:1, kind:"disable_handtype", value:"flush"},
            {turn:2, kind:"freeze_joker", value:"random"} ] } }
shop  = { CraftRecipe:{ onSignal:"buy_x", costs:[{id:"money",amount:6}], grantsFlag:"own_x" } }
信誉/血 = Resource；回合 = State+Timer；玩家2 = 同样一组实体 + 第二路 lockstep 输入。
```

## 4. 验收（合作=确定性，必须守）
- **MVP-0**：单人能打穿一个 Boss；ApolloBench 跑分（Structure/Load/Determinism/Numeric）过阈值。
- **MVP-1**：两玩家不同输入跑同一局 → **双端逐 tick 同 hash**（lockstep 不分叉）= 合作可联机的硬证据。
- 牌型求值器单测：各牌型识别正确、优先级对、确定。

## 5. 下一步（二选一）
- **A·引擎层（推荐先做，它 gates 一切）**：先读 wiki 知识库 → 设计 `pattern-score` 的 defineCapability 契约 + 牌多重集谓词求值器 + 单测；顺带定 `card-pile` 是新能力还是重组。
- **B·策划层**：把 MVP-0 拆成完整数据清单（牌型表 + 12 张扁平小丑 + 一个 Boss 的诅咒排程 + 商店 6 项 + Ante 曲线）。

A 先行更稳：牌型分一通，后面全是数据装配。
