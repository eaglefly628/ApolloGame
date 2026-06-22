# 地煞能力词汇 v2 · Boss 被动 Buff 扩充（owner 2026-06-21 头脑风暴）

> owner：给地煞牌想一批"自带被动 Buff"，前 10–20 关用这些组合控胜率；后面再想更奇古怪的。
> design G 评判（CORE RULE）：能用现有 op 表达 → 复用（回驳新增）；真表达不了 → 下沉成新 op 派甲。

## 一、owner 提的 7 条 → 评判

| # | owner 想法 | 评判 | 落点 |
|---|---|---|---|
| 1 | **泉水增长翻倍**（Boss 源泉 regen ×2） | ✅ **已覆盖** | 现有 `{kind:bonusMana, value:N}`（每回合多 N 源泉）= 翻倍效果。直接用。 |
| 2 | **撤退返还泉水加成**（胜者回库返 1.5×/2× 而非半费） | 🟡 **真缺口·小 op** | 新 `{kind:economy, op:withdrawRefundMul, value:1.5\|2}`：改 `resolveClash` 回库那行 `mana += cost*mul`（默认 0.5）。极小改。 |
| 3 | **一次执行两个动作**（破"四选一"互斥·Boss 可同回合 抽天罡+放牌） | 🔴 **真缺口·新 op** | 新 `{kind:action, op:extraAction, value:1}`：Boss 每回合可多锁 1 类动作（`actionTaken` 放宽到 N 类）。强经济 buff·控胜率。 |
| 4 | **改变城堡血量** | ✅ **已覆盖** | 现有 `{kind:homeHp, value:N}`。 |
| 5 | **急行军**（Boss 兵推进更快） | ✅ **已覆盖** | 现有 `{kind:tempo, op:advance, value:1, scope:lane\|all}`。 |
| 6a | **冰冻我们的行动**（玩家少一个动作/跳过） | 🔴 **真缺口·新 op** | 新 `{kind:control, op:freeze, everyTurns:N}`：每 N 回合冻玩家本回合 1 类动作。 |
| 6b | **恐吓/劝退我们的兵离场**（吓退玩家前锋） | 🔴 **真缺口·新 op** | 新 `{kind:control, op:intimidate, everyTurns:N}`：每 N 回合吓退玩家某路前锋 1 张（退场/回库）。≈ 暂缓的「诅咒(bounce)」近亲，可合并实现。 |
| 7 | **隐形 / 迷雾**（看不清 Boss） | ✅ **已设计** | `{kind:fog, turns:N}`（disha-pack 已用·关17+）。「隐形」= fog 的表现态（Boss 牌面板盖暗·见 doc24 §九）。 |

**结论**：7 条里 **4 条已覆盖/已设计**（泉水翻倍/城堡血/急行军/隐形），**3 条半是真缺口** → 下沉 4 个新 op（含撤退返还）派甲。

## 二、新 op 规格（派甲 · DishaFx 扩字段 · 确定性）
1. `{kind:economy, op:withdrawRefundMul, value:1.5}` —— Boss 胜者回库返还花费 ×value（默认 0.5）。`DishaFx.withdrawRefundMul`；`resolveClash` 回库行乘之（仅 Boss 侧）。
2. `{kind:action, op:extraAction, value:1}` —— Boss 每回合多执行 1 类互斥动作（四选一→可选 value+1 类）。`DishaFx.extraActions`；`aiTakeTurn` 按 `1+extraActions` 类放宽 `actionTaken` 锁。⚠ 仅 Boss 侧·玩家仍四选一。
3. `{kind:control, op:freeze, everyTurns:N}` —— 每 N 回合，玩家**本回合少 1 类动作**（冻一格）。`DishaFx.freezeEveryTurns`；玩家回合起按 `turn%N==0` 标记冻结。仿 `batteryEveryTurns` 周期机制。
4. `{kind:control, op:intimidate, everyTurns:N}` —— 每 N 回合，**吓退玩家某路前锋 1 张**（退场/回库·`b.rng` 选路·确定性）。`DishaFx.intimidateEveryTurns`；推进阶段触发。**与暂缓的 `REQ-G-诅咒地煞(bounce)` 同族** → 甲可一并实现（bounce=回起点/库·intimidate=吓退·同一"周期移除玩家兵"机制，参数化 mode）。

> 这 4 个 + 现有词汇 = **前 10–20 关地煞组合料**（owner：前期用这些拼，后期想更怪的）。
> **数据驱动**：全是 Boss 侧 DishaFx 字段 + 周期/结算钩子，无新引擎子系统；周期类仿 `batteryEveryTurns`，经济类改 `resolveClash`/`aiTakeTurn` 各一行。
> **不阻塞当前 lore/disha 重写**：4 个重写子代理用的是现有 op 词汇；甲实装这 4 个新 op 后，design G 再把 `extraAction/freeze/intimidate/withdrawRefundMul` 织进**关6-20**的地煞组合、并 sim 标定。
