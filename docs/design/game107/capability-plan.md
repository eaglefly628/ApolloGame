# 能力总览 Capability Plan — game107《逆位·深渊》（S2 送审稿）

> 2026-08-04 · 形态=编译期 TS 游戏（同 game-103·待 owner 拍板）；slot=`game107`（待分配）。
> **plan 未过审不写游戏层系统代码**（CLAUDE.md 能力总览铁律）。规则语义=`gdd.md`。
> 能力名已对照真实 registry 核准（`src/skills/{atoms,tier1,tier2,tier3}` 实名，非照抄 game-103 文档）。

---

## 1. 游戏一句话

全局俯瞰的**逆位割草**：你是深渊之主，用有限资源投放怪物，对付一群不断涌入、各自独立成长的 game-103 幸存者——
**割弱者、拖强者、择机收割养肥的**，15 分钟内收够养分且守住核心。

## 2. ⭐ 核心论证：本作 = game-103 的输入端对调

这是本 plan 最重要的一条，也是"该不该做"的答案：**本作几乎不需要新引擎能力**。

| 实体 | game-103 由谁驱动 | game107 由谁驱动 | 引擎侧改动 |
|---|---|---|---|
| 幸存者英雄 | `input-capture`+`controllable`+`action-map` | **`t2-behavior-tree`**（纯数据行为树 + 注册叶） | 换驱动源，模拟层不动 |
| 怪物群 | `t2-spawn-director` 波表（静态数据） | **玩家实时指令**（`t2-clickable` → `spawn`） | 换指令源，实体不动 |
| 升级三选一 | 玩家点选 `t2-draft-offer` | **AI 估值表选取** `t2-draft-offer` | 同一个核，换消费者 |
| 相机 | `camera` 跟随玩家 | 固定全局视角 | 更简单 |

**其余全部原样复用**：`t1-motion-apply` / `t2-steering` / `t3-aggro` / `t3-caster` / `t3-prefab` /
`t2-launch` / `t2-hitbox` / `t2-mortal` / `t2-stats` / `t2-modifier-stack` / `t2-over-time` / `t2-dice-roll` /
`t2-event-when` / `t3-merge-rule`(进化) / `t2-bounds-clamp` / `spawn` / `spatial-query` / `overlap-detect` / `timer`。

> 结论：**一套模拟跑两个视角**。game-103 已付的引擎成本在本作上边际成本≈0，
> 且两作互为对方的 AI 陪练（107 的英雄 AI 可直接回灌 103 做演示/回放对手）。

## 3. 消费的引擎能力（对照 registry 实名）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `t2-behavior-tree` (`BehaviorTree`) | **英雄 AI 外层策略**：探索/抢宝石/拆裂隙/转讨伐的优先级树 | ✅ 现有 |
| `t2-steering` (`Steering`) | 英雄风筝走位（flee+separation）、怪物追击（seek） | ✅ 现有（含 2026-07-24 新增 separation） |
| `t3-aggro` (`Perception`) | 怪物锁英雄 / 英雄武器锁最近怪物 | ✅ 现有 |
| `t3-caster` + `t3-prefab` + `t2-launch` + `t2-hitbox` | 英雄武器自动开火全链（**与 103 同一条**） | ✅ 现有 |
| `t2-mortal` | 怪物/英雄死亡 | ✅ 现有 |
| `atoms/destroy` (`DestroyRequest`) | ★ **回收**：移除实体但**不走死亡路径** → 不掉经验宝石 | ✅ 现有 |
| `t2-stats` + `t2-modifier-stack` | 英雄被动聚合；**腐化科技对全体怪物的加成**（局外 source 同构） | ✅ 现有 |
| `t2-over-time` (`OverTime`) | 腐蚀 DoT / 腐化领地持续伤害 | ✅ 现有 |
| `t2-draft-offer` | 英雄升级三选一（AI 消费） | ✅ 现有（103 已下沉） |
| `t2-dice-roll` (`DicePool`) | 掉落判定 / 三选一随机 | ✅ 现有 |
| `atoms/resource` (`Resource`) | 魂能 / 腐化度 / 养分 / 核心 HP / 裂隙 HP | ✅ 现有 |
| `t2-group-count` (`GroupCount`) | ★ **人口上限**（摘要原文即列「人口」用例）+ 在场英雄数 | ✅ 现有 |
| `t2-event-when` (`EventWhen`+`Signal`) | 腐化层级门 / 讨伐级门(Lv≥7) / 配额达标门 / 兽群耗尽门 | ✅ 现有 |
| `t2-effect-apply` (`Effect`) | ★ **伤害→资源**：信号驱动 `modify-resource`（痛苦汲取 / 赏金 / 养分） | ✅ 现有 |
| `t2-self-rule` (`SelfRule`) | 怪物 per-entity 自治（摘要原文即列「塔防」用例） | ✅ 现有 |
| `t2-trigger-zone` (`TriggerZone`) | **腐化领地**：进圈 → 挂 DoT + 减速 | ✅ 现有 |
| `t2-clickable` (`Clickable`) | 建裂隙 / 投放 / 回收的点击入口（action 信号入队） | ✅ 现有 |
| `t2-bounds-clamp` | 圆形竞技场边界 | ✅ 现有（形状=圆·待核） |
| `spawn` / `spatial-query` / `overlap-detect` / `timer` | 生成 / 范围查询 / 接触伤害 / 各类计时 | ✅ 现有 |
| UI：`LayoutNode`（`ui/components`） | HUD（三资源/英雄列表/层级）+ 投放栏 | ✅ 现有 |

> **`t2-spawn-director` 在本作不消费**——它的职责被玩家取代。这正是"逆位"在架构上的体现。

## 4. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它（禁游戏层自写解释器） |
|---|---|---|
| `MONSTERS` | 9 种怪物属性 + 层级 + 特性 | `t3-aggro`+`t2-steering`+`t2-hitbox`+`t2-mortal` |
| `HERO_KIT` | 英雄属性 + 武器 + 被动 + 进化（**直接复用 103 的表**） | `t3-caster`+`t2-modifier-stack`+`t3-merge-rule` |
| `HERO_BT` | 英雄行为树（探索/抢宝石/拆裂隙/讨伐的优先级） | `t2-behavior-tree`（叶=注册的 TS 例外·见 §5） |
| `DRAFT_POLICY` | 三选一 AI 估值权重表 | `t2-draft-offer` + `t2-weighted-pick` |
| `ECONOMY` | 三资源转化率 / 裂隙递增造价 / 赏金曲线 / 配额 | `atoms/resource` + `t2-effect-apply` |
| `TIERS` | 腐化层级门槛 + 科技加成 | `t2-event-when` + `t2-modifier-stack` |
| `COHORT` | 涌入节奏 / 总数 / 在场上限 / 入场无敌 | `timer` + `spawn` + `t2-group-count` |

> **红线自检**：每张表都指向现成能力做解释器，无「表 + 待写游戏层 for 循环」。

## 5. 申请的游戏层代码例外（逐条过审）

| # | 申请项 | 理由 | GD 自评 |
|---|---|---|---|
| X1 | `t2-behavior-tree` 的**叶函数**（英雄 AI 的 condition/action，如 `nearestGemSafe`/`shouldRaid`） | BT 契约本身要求消费方注册叶（`registerBTLeaves(gameId,{...})`），属**能力设计内的既定例外** | ✅ 合规·非违规自由代码 |
| X2 | 无 | 经济层四件事（汲取/赏金/回收/领地）经核查**全部可由现成件重组**：`effect-apply`+`resource`+`destroy`+`trigger-zone` | ✅ **不申请下沉**（CORE RULE §2 先重组） |

> **GD 诚实核查记录**：初稿曾拟把「伤害→资源」「回收不掉落」「人口上限」三处申请为新能力；
> 逐条对 registry 核查后**全部撤回**——`t2-effect-apply` 的 `modify-resource`、`atoms/destroy`（与 `t2-mortal` 死亡路径分离）、
> `t2-group-count`（摘要原文即写「人口」）已分别覆盖。**本作对引擎的净新增需求 = 0。**

## 5.5 待 Lead 核的两个薄点

| # | 事项 | 说明 |
|---|---|---|
| Y1 | `t2-bounds-clamp` 是否支持**圆形**边界 | GDD 用圆形竞技场；若只支持矩形，退化为矩形场地（设计可接受）或走 capgap |
| Y2 | `t2-trigger-zone` 能否表达**半径随资源变化**的动态圈 | 腐化领地半径 = f(腐化度)。若不能，退化为分档（每层级一个固定半径）——**GD 认为分档即可，不必下沉** |

## 6. 确定性声明

- 随机源：引擎种子 PRNG（`t2-dice-roll` / `atoms/random`），seed 单局开局注入；**游戏层禁裸 Math.random**。
- 平衡模拟器 `scripts/game107-balance-sim.mjs` 已全程使用 mulberry32 种子 PRNG，同 seed 同轨（可回放）。
- 实体更新序按 entity id 稳定定序（沿用 103 的 Lead 补裁约束）。
- 实体规模：同时 8 英雄 + ≤30 怪物 + 宝石（**已加 45s 存在时限防无限累积**），显著小于 103 的百敌规模。

## 7. 评审记录

- 提交人 / 日期：GD / 2026-08-04
- **owner 口述定向（2026-08-04·四轮）**：见 `brief.md` §1；关键转折=改多英雄群落 + 牧养经济。
- **待 owner 拍板**：形态 / slot / `brief.md` §6 待定项。
- **待 Lead 裁**：§5.5 的 Y1/Y2 两个薄点（均有可接受的退化方案，非阻塞）。
- ⚠ **本 plan 不构成开工许可**：`gdd.md` §7「收割窗口」为设计侧阻塞项，须先定案（见 `brief.md` §5）。
