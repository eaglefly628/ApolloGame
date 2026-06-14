# 01 · 局内 · 掷命对决（战斗核心）

> 承 `00`。本篇定义**原子掷命**（单张牌正反定生死）+ 一局收口 + 干预。实现参考：`../blueprint.ts`、`../game-g.test.ts`。
> 📎 其上的**军事结构**（三三制 / 三路 / 将领 / 布阵）见 `06`；**功能牌 / 培养**见 `07`。本篇是它们共用的底层掷命内核。

---

## 一、胜负规则 `decideFaceUp(favor, rng) → boolean`（v2 核心，已实现）

- `P(正面=活) = clamp(favor / 100, 0.05, 0.95)`；用引擎 PRNG `nextRandom(RandomSeed)`（mulberry32，确定性）。
- **favor** = 牌的属性 / 局外升级偏置（数据，0..100）；越高越易活，但保留 **5% 翻盘**（赌感）、封顶 95%（永不必然）。
- **确定性 / 可重放 / 多人一致**：同 `seed` + 同牌序 → 同结果。`buildGameGDuel3D(cards, seed)` 按牌序逐张掷。

> 这是"先定胜负"的唯一"规则代码"：小、纯、确定、可测。如需彻底零游戏码，未来可下沉成通用「加权种子掷」capability（YAGNI，暂不做——单条 helper 不值得拓宽引擎）。

---

## 二、一局收口 `buildGameGMatch`（MVP-1，已实现）

一局 = 两队牌各自掷命 + 数存活 + 判胜负 + 结算：

```
对每张牌 decideFaceUp(favor, seed)            ← 规则先定每张正/反（确定性）
  → 3D 翻牌演出(tween 翻到既定面)              ← 表现层，不进 hash
  → group-count 数各队存活(=各队正面数)        ← 现成能力
  → Timer 门(等翻牌演完) + event-when(vsResource 比两队存活, edge)   ← 判胜负
  → set-state winner + 结算掉材 mats           ← 数据动作
```

- **判胜负载体**：MVP-1 用 **Timer-gated banded `event-when`(vsResource)** 代替完整 `flow` 状态机——单局更轻；多回合 run/round flow 留到 Phase（见 `05`）。
- **"演完才定"**：`Timer` 门保证翻牌动画播完再结算，避免胜负闪现（表现与逻辑解耦但节奏对齐）。
- **确定性背书**：`game-g.test.ts` 断言"同 seed 逐拍 hash 一致""判胜负与规则回放一致""我胜掉材"。

---

## 三、干预系统（Phase-3 · 玩家"改命"）

干预 = **改 `decideFaceUp` 的上游输入**，全是数据决策，**不碰表现层**：

| 干预 | 数据形 | 效果 |
|---|---|---|
| 祝福 | 临时 `+favor` | 提高该牌活的概率 |
| 诅咒 | 临时 `−favor` | 降低对方牌活的概率 |
| 重翻 | 用同 RNG 再 roll 一次 | 再赌一次（确定性序列内）|
| 护盾 | 反面免死一次（消耗）| 把"死"挡成"活"，一次性 |

- 通路：`clickable` / signal → `effect`（改 favor 资源 / 触发重翻信号）。**零新能力。**
- 多人干预 = 很多玩家提交干预命令 → 服务器按拍合入、重算确定性胜负 → 广播（见 `04`）。

---

## 四、数据映射与复用（house style：先复用，缺的才提）

| 机制 | 复用 / 缺口 | 说明 |
|---|---|---|
| 胜负正/反面 | **一条 helper** | `decideFaceUp`（整数 + PRNG），lockstep 安全 |
| 翻牌动画 | **复用 `tween`** | 写 `Transform.rotation` 到既定面（0/π）|
| 数存活 | **复用 `group-count`** | 各队正面数 |
| 判胜负 | **复用 `flow`/`event-when`(vsResource)** | gameF 原样 |
| 52 牌组 / 发牌 | **复用 `card-pile`** | 标准 52 牌 |
| 干预 | **复用 `clickable`+`effect`** | 改 favor 输入 |
| 结算掉材 | **复用 banded `event-when`→`effect`** | gameE/gameF 已证 |

> **结论**：局内战斗 = 一条小规则 + 全套现成能力重组，**零新 capability**。
