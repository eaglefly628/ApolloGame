# 能力总览 Capability Plan — game-d《骰途 · TOWER OF FATE》

> 按 CLAUDE.md「游戏能力总览铁律」补交（存量游戏欠账整改·体检点名后）。交 Lead 评审通过后，
> 待主程 P0 `dice-roll` capability + wild 扩展落地，即照本 plan 把手写 sim 迁成能力驱动。
> 落地后 `node scripts/game-skill-audit.mjs game-d` 核偏差。配套：`docs/design/game-d/data-driven-migration.md`（迁移设计）。

## 1. 游戏一句话

双人协作骰子 roguelike 爬塔——掷「元素骰组」凑成牌型、满足敌人挑战门槛砸血、逐层（翠庭/古殿/熔心/晶顶）推进。参照物：Balatro（点数×倍率计分）+ 骰子牌型 + 肉鸽爬塔。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册 id） | 用来做什么 | 状态 |
|---|---|---|
| `w1-random`（randomCapability·`nextRandom`/`randomInt`/`seededShuffle`） | 一切随机：掷骰面、战利品三选一、洗牌（**游戏层禁裸 Math.random**） | ✅ 现有·**已接**（`gd-rng` RandomSeed + run-seed 开局播种） |
| `resource-apply`（resourceCapability） | 数值态：sum/mult/damage/foeHp/heroHp/room/rerolls | ✅ 现有 |
| flagCapability | 布尔态/信号源：thrown/committed/challenge-met | ✅ 现有 |
| `string-apply`（stringVariableCapability） | 文本态：当前牌型名 | ✅ 现有 |
| `t3-poker-hand`（pokerHandCapability·`evaluateHand`/`rankMaxCount`/`pairCount`） | 牌型判定（对/三/四/五/顺/同色/葫芦）+ 派生事实 | ✅ 现有·**展示函数已接**；战斗 detectPattern 待 wild 后真替 |
| cardScoringCapability（`card-score-pass`） | 逐骰累加（sum = Σpips·baseChipsByRank 恒等表） | ✅ 现有 |
| eventWhenCapability + `condition`（`evaluateCondition`） | 敌人挑战门槛（sum≥t / element≥n / pair / contains）→ 信号 | ✅ 现有 |
| effectApplyCapability | 伤害 = sum×mult（`valueFrom.timesResourceId`）·扣血·per-die 加成 | ✅ 现有 |
| keybindCapability | 输入信号：roll/reroll/commit/选骰/装骰（`KeyBinding{key:action,signal}`） | ✅ 现有 |
| clickableCapability | 点选：锁骰/选骰组（3D/2D 命中 → 信号） | ✅ 现有 |
| `t3-flow`（flowCapability·`GameFlow{states,transitions}`） | 房间/层推进 + 胜负状态机（替手写循环） | ✅ 现有 |
| `t2-mortal`（mortalCapability） | 敌 HP / 英雄心 归零判定 | ✅ 现有 |
| **`dice-roll`（待注册）** | 读 `DicePool`+`RandomSeed`(+`LockMask` 重掷未锁·+禁骰参数) → `Update` 相位写 `RolledDice` | ⏳ **主程 P0 建（Lead 已准）**·与 game-g 战力骰同族 |
| **poker-hand wild（`HandMods` 扩展·待）** | 百搭骰顶点/顶色的最优牌型 | ⏳ **主程建（Lead 已准）** |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `DICE_CATALOG`（dice.ts） | 骰子目录（元素/面/点数/大小） | `dice-roll` capability（**禁游戏层自写掷骰**） |
| 牌型倍率表（豹子×4/四条×3.5/…） | 牌型→伤害倍率 | `poker-hand` 判型 → `StringVar`/`Resource` → `effect-apply` 乘 |
| 敌人 FOE conds（sum≥t/element≥n/pair/contains） | 每关挑战门槛 | 编译成 `ConditionExpr` → `event-when`（**元素敏感对子=复合 rank `element*16+value` 重组·Lead 裁决 §3·非新能力**） |
| 敌反制（banHighest/banLowest n） | 结算前禁 N 颗骰 | `dice-roll` 的 post-roll 过滤参数（Lead 裁决 §1 并入·非单立能力） |
| 房间/层进度 + 胜负 | roll→resolve→advance/defeat/victory | `flow` GameFlow（数据状态机） |
| 伤害公式 sum×mult | — | `effect-apply valueFrom.timesResourceId` |

> 红线自检：本表无「数据表 + 待写游戏层解释器」——每张表的解释器要么现有 capability，要么已下沉待建（dice-roll/wild·Lead 已准）。

## 4. 申请的游戏层代码例外（逐条过审）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| 薄 session 编排脚本（照 game-e `session.ts`：仅编排「掷→copy RolledDice→置 committed→tick→读结果」，**不含算分/牌型/规则**） | 线性回合编排是宣言明许的唯一非数据代码形态（game-e 先例） | ~120 | 待审 | 常驻·同 game-e |
| 3D 渲染/表现动画驱动（title 骰自转 / 过场 / 掷骰落场 / 战利品扇形 —— `engine.subscribe` 里改 render-only `Transform3D`/`Glow3D`/`Material3D`） | **render-only 表现层（P3D 域·NON_DETERMINISTIC·不进 hash）**，非 sim 规则；render-only 明许用时间/随机（同 title 骰自转先例） | ~200 | 待审 | 常驻·渲染线 |
| `combat.ts detectPattern` 手写（临时并存） | 含**百搭顶点/顶色**，`evaluateHand` 无通配 → 现不能真替 | 现存 ~25 | 待审（临时） | **待 wild capability 落地即真替 poker-hand·已有全牌型护栏测试** |

> 审计红旗自检：裸 Math.random=已消除（走 `w1-random`）；innerHTML/createElement=UI 全走 LayoutNode（无）；零能力接入=本 plan 即整改；零测试=已补 `game-d-sim.test.ts`(21 例)。

## 5. 确定性声明

- **随机源**：引擎种子 PRNG `w1-random`（`RandomSeed` 组件 `gd-rng`）。**run-seed 开局生成**（单人从时钟播种一次），之后整局由种子确定。TODO：随存档持久化 / 联机由 host 广播（双方同种子）。
- **回放 / 双人 lockstep**：**目标是**——sim 侧全走种子 PRNG + 整数/枚举 + 按 entity id 定序，hash 稳定可回放/lockstep。
- **非确定性风险点（须隔离在 render-only）**：3D 渲染/动画层（Transform3D/Glow3D/粒子/过场）用时间/`Date.now`/`Math.random` —— 属 render-only，不进 determinism hash（`NON_DETERMINISTIC` 集），不得回流影响 sim 组件。**当前 sim 仍是手写 `S` 对象（未进 world 组件）= 最大非确定性债**，本迁移即消除它（S→Resource/Flag/StringVar/State）。
- co-op netcode（传输/lockstep 调度）= REQ-GAMED §6 另立 net 基建线（并 game-f），不在本 plan。

## 6. 评审记录

- 提交人 / 日期：P3D（game-d owner） / 2026-07-02
- Lead 裁决：⏳ 待审（能力缺口部分已在 REQ-GAMED 单独裁决完毕：dice-roll ✅P0 / wild ✅ / 元素对子 ❌回驳-复合rank重组 / 6色同花 ✅契约内 / netcode ⏫另立）
</content>
