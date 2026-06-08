# Game E · 去代码化审计（game-e.tsx 专有游戏代码 → 数据）

> ⛔ 纲领：**游戏=数据，代码只属引擎确定性解释器。不该有专有游戏代码。**
> 现状诚实认账：`src/game-e.tsx` 为赶手感，堆了大量**专有游戏逻辑**（回合/盲注/商店/计分演出/经济/胜负）。本审计逐条列出「现在的代码 → 目标数据形态 → 哪台现有能力解释 → 重组 or 真缺口 → 归属」，作为 **REQ-017（回合流程下沉）** 的完整清单，确保**不只下沉流程，连计分演出/商店/经济/胜负全部消解**，最终 `game-e.tsx` 退化成**零游戏逻辑的薄表现层**。
>
> 尺子：「最弱 LLM 能产出这份数据吗？」能→数据；不能（要写自由代码）→ 才考虑下沉通用能力。

---

## 0. 终态目标

`game-e.tsx` 只剩两件事，**无任何游戏规则**：
1. **投影**：读 World 的 Resource/StringVar/实体 → 画成画面（卡/小丑/HUD/Boss 条）。
2. **输入适配**：把点击/按钮转成**具名信号**（`clickable`/`keybind` 产 Signal），喂给引擎。

回合流程、计分、商店、经济、胜负——**全在 blueprint 数据 + 引擎能力里跑**。换皮/换规则只改数据，不改这个文件。

---

## 1. 逐条审计（current code → data）

| # | game-e.tsx 现在手写的（专有代码） | 目标数据形态 | 哪台能力解释 | 裁决 | 归属 |
|---|---|---|---|---|---|
| 1 | **回合/相位状态机**（`phase: playing/shop/lost` + startBlind/nextBlind/转移） | `State{fsmId:'round'}` + `event-when`(条件转移) + `effect`(set-state) | state + event-when + effect + condition | 🟢 重组 | **REQ-017** |
| 2 | **出牌/弃牌触发**（按钮 onClick → 手动 tick + 直接读写资源） | 按钮=`clickable`→`Signal`("play"/"discard")；引擎按信号跑 | clickable + event-when + effect | 🟢 重组 | REQ-017 |
| 3 | **round_score 累加 / hands-discards 递减**（已部分在引擎边沿门，但 UI 还手动 set） | 全走引擎边沿信号（已有 `hand_committed`）；UI 不再 set | effect-apply（已做） | 🟢 已基本在引擎，去掉 UI 里的 set | REQ-017 |
| 4 | **弃牌扣额度**（UI 直接 `set(discards_left-1)`） | `discard` 信号 → `effect modify-resource discards_left -1` | effect-apply | 🟢 重组（移进数据） | REQ-017 |
| 5 | **过线判定 + 胜负**（UI `if rs>=blind / hands<=0`） | `condition`(resource gte/lte) → `event-when` → set-state(shop/lost) | condition + event-when | 🟢 重组 | REQ-017 |
| 6 | **过盲注结算 $**（UI 算 base+剩手+利息） | `effect`/`craft-recipe` 在「过盲注」信号上改 money（利息=condition 阶梯 + valueFrom） | effect-apply + REQ-013 valueFrom | 🟢 重组 | REQ-017 |
| 7 | **商店买小丑/重摇**（UI buyJoker：扣钱 + 手动注入实体） | 买=`craft-recipe`(costs:[money]→grants 小丑实体)；商店货=随机数据 | craft-recipe + random + prefab/派生 | 🟢 重组（Game C 缝制同款） | REQ-017 后续 |
| 8 | **发牌/抽牌/补牌**（UI drawTo + deckPtr） | 牌堆/手牌=实体 + `random` 洗牌 + 抽牌信号→spawn 到手牌区 | random（已确定性）+ spawn + zone | 🟡 重组（可能小助手 `card-pile`，YAGNI 先重组） | REQ-017 后续 |
| 9 | **选牌（toggle ≤5）** | 牌=`Clickable`→选中 flag；「≤5」=数据约束（容量） | clickable + 选中标记数据 | 🟢 重组 | REQ-017 |
| 10 | **★ 逐张计分演出**（UI 手算 frame 序列：基础→逐张→小丑→终值） | 引擎计分时吐**逐步 trace 事件流**（{source,target,delta,chips,mult}）；UI 纯回放 | 🔴 **小缺口**：card-scoring/effect-apply 加「计分 trace」事件输出（不改计分结果，只额外记一串事件供回放）；UI 不再重建序列 | **候选 REQ（演出 trace）** |
| 11 | **动画**（CSS 飞入/飞出/抖动/pop 关键帧） | 表现层。可保留为薄 CSS，或进一步数据化（animation 描述符+通用解释器） | 渲染层 | 🟢 表现层（可接受薄层；trace 驱动后触发点来自数据） | 表现层 |
| 12 | **排序（花色/点数）** | 纯显示排序（不改 sim） | 表现层 | 🟢 表现层薄层（可留） | 表现层 |
| 13 | **资源读取**（get/resOf 投影 HUD） | 读 World 投影 = 薄层本职 | 渲染层 | 🟢 **本就该留**（这是合法的薄层） | 保留 |

---

## 2. 裁决汇总

- **绝大多数（#1–9）= 现有能力重组**，归 **REQ-017**（回合流程下沉数据状态机）一次性消解：流程/出弃/累加/胜负/结算/商店/发牌/选牌全部变成 `State + condition + event-when + effect + clickable + craft-recipe + random` 数据。
- **唯一真缺口（小）= #10 逐张计分演出 trace**：引擎计分时额外吐一串「逐步事件」（不改结果，只供 UI 回放）→ UI 不再手算帧序列。这是**小钩子**（card-scoring/effect-apply 加事件输出），非新 Tier3 能力。**建议单独提一条 REQ**（演出 trace）。
- **合法保留的薄层（#11–13）**：CSS 动画、显示排序、读世界投影——这些是表现层本职，**不算专有游戏代码**（不含规则、不进 sim）。动画的**触发时机**应来自数据/trace，而非 UI 自己判规则。
- **可能的小助手（#8 card-pile）**：牌堆/抽弃若重组别扭再下沉，当前 YAGNI 先用 random+spawn+zone 重组。

---

## 3. 验收（去代码化做完的标志）

- `game-e.tsx` **不含任何游戏规则**：grep 不到「分数线判定 / 牌型条件 / 商店扣钱 / 胜负 if」这类逻辑；只剩「读 World 画 UI」+「click→signal」。
- 换规则（盲注曲线/小丑/Boss/商店内容）**只改 blueprint 数据**，game-e.tsx 一行不动。
- 计分演出由**引擎 trace 数据**驱动回放，UI 不重建计分序。
- 全程 tsc + vitest + build 绿；回合流程有引擎层测试（不依赖 React）。

> 一句话：REQ-017 把 #1–9 消解为数据；#10 加一条「计分 trace」小钩子；#11–13 保留为合法薄表现层。做完 game-e.tsx = 纯壳，游戏 100% 是数据。
