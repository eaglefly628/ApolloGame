# Game G · turn-combat 数据去腐 TODO（Lead 派单 · 2026-06-28 · 待 owner 指派执行人）

> **owner 定调（2026-06-28）**：「不是所有东西都该数据化——游戏复杂度决定了不行——但要把它变成**可控的逻辑**。」
> 即：**能当数据的内容就数据化；本质 bespoke 的对决数学，收敛成「一个闭集词汇表 + 单一解释器」**（受控、可审计、确定性），而非散落的字段膨胀 + 逐字段 if。
>
> 依据：`docs/design/game-g-data-rot-audit.md`（2026-06-23 审计）+ Lead 2026-06-28 复评（已硬验：combat 效果**不能**重组到引擎 `stats`/`effect-apply`，**无 rule-of-three** → 解释器留 game-g 本地·非下沉引擎）。

---

## 0. 纪律铁律（每步都守）

- **分支开发**：开 `claude/combat-derot-*`，**不碰主干**（这是平衡敏感重构）。
- **`turnHash` 绿是命根**：每步跑 `turn-combat.test` / `game-g.battle` / `game-g.growth` 等 golden/确定性回归——**行为零漂移**才算过。**任一步 `turnHash` 变了 = 引入了平衡 bug，回退重做。**
- **逐步切片·绝不 big-bang**：一次迁一相/一 hook，绿了再下一刀。
- **平衡回归**：迁 clash 数学（P3）时，用仿真台/批量对局核对胜率分布不漂（clash-resolve 注释提到的 §十 仿真台）。
- 门禁 `tsc + vitest + build` 全绿才推；提交署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾、产物不写模型标识。
- **引擎边界**：本单**全程在 `src/games/game-g/`**，不改 `src/{engine,skills,assembly}`（解释器是 game-g 本地·非引擎能力）。要引擎补东西先写 `requests.md`。

---

## 1. 现状（已落地·别重做）

- ✅ **天罡 authoring 已全数据化**：36 卡 = `params:{op,value,filter,scope}`（`tiangang-data.ts`）→ `TENGANG_OPS` 注册表（`game-g-build.ts`）。新卡=填数据；新机制=注册表加一行。
- ✅ **地煞聚合 Phase 1**：`DISHA_MERGE` 策略表（`disha.ts`）替手写逐字段合并。
- ✅ **簇2 死代码全清**：`blueprint.ts` 920→94 行 barrel；退役 3D/实时/行军 builders + `prepareArmies` 第二 apply 路已删；数据表拆 `*-data.ts` 叶子。

## 2. 不许动（是对的代码·bespoke 但正确）

- 🔒 `clash-resolve.ts`（logistic 胜率核）——模范固定解释器。
- 🔒 **Boss AI**（`aiTakeTurn` + `score*`）——已数据驱动（性格=`aiProfile` 数据 + 固定打分解释器）。**不是腐烂。**
- 🔒 **战斗主循环**（3 路×9 格 / 推进 / 掷命 / 攻城 / 捷径门）——合法 bespoke（无 rule-of-three·硬塞 ECS=已否掉的 World 镜像）。
- 🔒 纯 `TurnBattle` 状态机（不碰 ECS）——保持，别为「数据化」改成 World+Resource。

---

## 3. 目标模型（两层·这就是「可控的逻辑」）

把天罡/地煞/杠杆统一成**一个效果模型**，分两层：

**A 层 · 数据（可 authoring·最弱 LLM 能填）**：一个效果 = 一组 `EffectOp`，**复用闭集词汇**：
```ts
interface EffectOp { hook: HookId; target?: TargetFilter; op: ModifierId; value?: number; cap?: number }
```
新效果**复用现有 hook/target/op = 纯数据一行**（litmus PASS）。

**B 层 · 受控词汇表（闭集·代码·单一真相）**：三张注册表，解释器按它求值。**新增一个 hook/target/op = 在对应表加一个 handler（受控代码·一处·可审计），绝不散落 if**。这一层就是 owner 说的「可控的逻辑」——它**不是数据**，也不该是；它是闭集解释器。

**词汇表（从现有代码完整抽取·闭集）**：

`HookId`（何时·解释器分发点，对齐审计附录 9 hook）：
`init` · `deploy` · `on-play` · `draw-gate` · `clash-power` · `clash-winrate` · `clash-tie` · `clash-post` · `advance-base` · `turn-start`

`TargetFilter`（作用于谁·按 board 求值）：
`all` · `front` · `champion`(全军最高点) · `count-le3`(列≤3) · `same-suit2`(同列同花≥2) · `pair` · `trips` · `general`(本单位是将) · `general-present`(列内有将) · `near-base`(贴家 N 格) · `mid-lane` · `phalanx-adj`(邻接己兵计数·8邻/同路) · `flanked`(被左右夹) · `win-streak`(连胜计数) · `battery-lane`

`ModifierId`（改什么）：
`power+` · `power×`(擎天) · `winrate+`(百分点) · `winrate-floor` · `k-hard` · `no-upset` · `first-strike` · `no-rout` · `morale-leader` · `revenge` · `stamina+`(可带 faces 过滤) · `relay` · `hand-max` · `on-play-draw` · `mana+` · `siege-chip` · `siege-defend` · `home-hp`

> **解释器形态**：每个 hook 一个求值入口——「取双方该 hook 的 op-list → 逐 op 按 TargetFilter 对 board 求值(bool/计数) → 应用 ModifierId(value/cap)」。替掉 `effPower`/`bossEdge` 的逐字段 if 链。宽结构体 `TengangFx`/`DishaFx` 退化成**内部缓存**（可留作性能聚合）或删除——但**不再被 authoring、不再逐字段 apply**。

---

## 4. Phase 2 · 地煞 authoring → op-DSL（**先做·价值高·风险中**）

> 当前唯一明确 litmus FAIL：加天罡=纯数据，加地煞=手写 `Partial<DishaFx>` 结构体（得懂 20 字段名）。本相把地煞收敛到与天罡同形。**编译层改动·产出同 `DishaFx` → `turnHash` 必须不漂。**

- [ ] **2.1** 定义地煞 `params` op 形态（对齐天罡 `{op,value,filter,scope}`），覆盖现有 15 个地煞（`DISHA_SPECS`）的全部字段语义（allWinPct/generalWinPct/phalanx*/nearBase*/eliteMid/flank/firstStrike*/winStreak*/noRout/lastStand/bonusMana/battery*/homeHp）。
- [ ] **2.2** 把 `DISHA_SPECS` 从 `Record<string, Partial<DishaFx>>` 改写成 `Record<string, EffectOp[]>`（或 `{params}` 列表）。15 条逐条翻译，语义一一对应。
- [ ] **2.3** 写 `DISHA_OPS` 注册表（仿 `TENGANG_OPS`）：op → 写入聚合结果。**能与天罡共用的 op 合并到共享注册表**（如 `winrate+`/`no-rout`/`first-strike`）；地煞专属的（phalanx/nearBase/battery/flank/winStreak/homeHp）单列。
- [ ] **2.4** `aggregateDisha` 改为「读 op-list → 经 `DISHA_OPS` 折算」（保留 `DISHA_MERGE` 合并语义或并入 op handler）。
- [ ] **2.5** 回归：`disha.test`(13) / `tengang.test` / `game-g.battle` / `game-g.growth` 全绿，**`turnHash` 逐回合不变**。
- **验收**：新增一个「复用现有 op」的地煞 = 在 `DISHA_SPECS` 填一行 `EffectOp[]`，零改其它代码。`Partial<DishaFx>` 手写结构体在 authoring 侧消失。

---

## 5. Phase 3 · apply 侧解释器 + 删宽结构体（**后做·风险高·逐 hook 切**）

> 把 `effPower`/`bossEdge`/`resolveClash` 等的逐字段 if 改成「按 hook 取 op-list → 解释器按 TargetFilter 求值」。这是**杀字段膨胀**（`TengangFx` 22 + `DishaFx` 20 字段 = owner 给 UI fx 否掉的「一效果一开关」反面）。**最高风险·必须逐 hook·每步 `turnHash` 绿 + 仿真台平衡回归。**

**先易后难逐 hook 迁**（每个 hook 一刀·绿了再下一刀）：

- [ ] **3.1** 易 hook 先行：`init`(homeHp) · `turn-start`(bonusMana/battery) · `on-play`(draw) · `draw-gate`(handMax) · `deploy`(stamina) — 这些是简单读值·迁完 `turnHash` 绿。
- [ ] **3.2** `clash-tie`(firstStrike) · `clash-post`(relay/lastStand/clashElixir/winStreak) — 中等。
- [ ] **3.3** 啃 `clash-power`（`effPower`）：把 powerAll/pEffAdd/powerFront/powerLE3/powerSameSuit/comboPair/comboTrips/powerMulHighest/moraleLeader/noRout/revenge 逐项改成 op+TargetFilter 求值。**注意 `tgContribOf`（逐张天罡溯源·UI 明细）必须同步走同一解释器**（否则预报与实判裂）。
- [ ] **3.4** 啃 `clash-winrate`（`clashEval`+`bossEdge`）：kHard/winFloor/noUpset + allWinPct/generalWinPct/phalanx/nearBase/eliteMid/winStreak/firstStrike/battery/flank。**保持 `clashEval` 作预报/实判单一真相**（`clashOdds` 复用·别裂）。
- [ ] **3.5** `advance-base`（`advanceColumnToBase`：siegeChip/siegeDefend）。
- [ ] **3.6** 全 hook 迁完 → 删 `TengangFx`/`DishaFx` 的**逐字段 authoring/apply**；结构体仅可留作内部聚合缓存（或删）。
- **验收**：① 全程每步 `turnHash` 零漂移（golden 回归）；② 仿真台批量对局胜率分布与迁移前一致；③ `effPower`/`bossEdge` 不再出现 `fx.xxx` 逐字段 if，改为遍历 op-list；④ 新增一个「复用现有 hook/target/op」的效果 = 纯数据；新机制 = 三注册表之一加一个 handler（受控·一处）。

---

## 6. 簇3 · 杠杆 levers（**最后·折进同模型**）

- [ ] `lever-data.ts` 的 `LEVER_CATALOG`（6 个·decapitate/bless/curse/shield/reinforce/flush）+ `openingLevers`（boss-roster）的 apply，折进 P3 的 op 模型（多半映射到 `clash-power`/`clash-post` 的现有 op）。**P3 落地前不动**（6 个·不阻塞）。

---

## 7. 执行次序建议 + 归属

1. **Phase 2 起步**（地煞 op-DSL·价值清晰·`turnHash` 可保绿）。
2. **Phase 3 逐 hook**（P2 稳定后·分支·仿真台护航）。
3. **簇3 折杠杆**（P3 末）。

> **归属待 owner 指派**。本单是 game-g 域代码（PG 域），但属 Lead 立的深度架构重构。执行人需**先吃透 §3 两层模型**。Lead（主程）可出 op-schema/解释器骨架供接手；接手人主做内容迁移 + apply 逐 hook 切。有引擎缺口走 `requests.md`。

## 8. 参考
- 审计 + 路线：`docs/design/game-g-data-rot-audit.md`（含 §附录 9-hook 效果消费全表）。
- 现有数据驱动先例（照抄形态）：`tiangang-data.ts`(params op-DSL) + `game-g-build.ts`(`TENGANG_OPS`)。
- 别动的对的代码：`clash-resolve.ts`。
