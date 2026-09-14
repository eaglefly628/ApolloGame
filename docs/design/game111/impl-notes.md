# game111 · 施工笔记（框架层·2026-09-14）

> 记两类东西：**与 plan 的偏差（= 债，须销）** 和 **施工中撞出来的引擎缺口（= 报给主程）**。
> 口径：plan 与实现不一致 = 债，要么改实现要么改 plan（重审）。不许默认放着。

## 1. 已交付（框架层·可跑可测）

| 件 | 位置 | 说明 |
|---|---|---|
| L0 世界数据表 | `games/game111/world-data.ts` | 分区 / 人设卡（含智能等级）/ 需求曲线 / 意图闭集 / 记忆标签 / 称号表 |
| 世界装配 | `games/game111/blueprint.ts` | 纯数据 + 宿主层 `setupTown`；意图落地 = 预展开的 `KeyBinding`+`Effect` 表 |
| prompt 组装 | `games/game111/agent-context.ts` | plan §4 例外②（Lead 有条件准）——只填引擎给定的 `AgentContext` 形状 |
| 回合驱动 | `games/game111/turn-driver.ts` | 宿主层六步；坑①定手窗 / 坑②账期 已封 |
| 测试 | `games/game111/game111.test.ts` | 24 例·含 sabotage 锚点与尺子自证 |
| DeepSeek 接入 | `scripts/game111-deepseek-proxy.mjs` | 开发期代理（形状翻译 + key 不进浏览器）·`--selftest` 15 例零网络 |
| 无头演示 | `scripts/game111-demo.ts` | 自证用；可切 Null 桩 / 真后端 |

**架构落点（framework.md §1.2 的论点在代码上的证据）**：意图不是宿主直接塞进世界的，而是
`QueuedInputSource.enqueueAction` → `net/applyCommands` → `t2-keybind` → `Signal` → `t2-effect-apply`。
**LLM NPC 与远端人类玩家走的确实是同一条路。** 这不是设计上的比喻，是实现上的同一段代码。

> 为什么必须这样：`t2-event-when` 每拍开头 `for (const [sid] of world.query('Signal')) removeComponent(...)`
> **清全场 Signal**，所以宿主在拍间塞的信号必被清掉；而 `keybind` 申报了 `runsAfter event-when`，
> 是数据驱动的合法入口。首版想直接塞信号，是读了 `event-when.ts:71` 才改的。

## 2. 与 capability-plan 的偏差（债）

### 偏差 ①：回合七相位未用 `t3-flow` 摊开

- **plan §3 原文**：`TURN_PHASES` → `t3-flow`。
- **实现**：相位在**宿主层**（`turn-driver.ts` 的六步）摊开，`GameFlow` 仅承载粗粒度世界态。
- **理由**：`INTENT` 相位要等异步回包。把它并进 flow，会让 flow 与 `t2-intent-barrier` 互为前驱
  ——正是 🔴 主程面那类「一放 Update 就闭合成环，而 `topological-sort` 只告警不抛、落序不合语义仍照跑」
  的坑（CLAUDE.md ENG-02/03 实证）。`intent-barrier.ts` 的系统声明里，主程已经为同一件事改过一版
  （首版让门自己读 `TurnOrder.round` → 真 2-环）。
- **销账路径**：要摊开，需主程先给定序结论（flow 与 barrier 谁在谁之前、怎么不成环）。在那之前，
  宿主层摊开是**语义等价且无环**的写法。**不自裁改 plan，等复查门裁。**

### 偏差 ②：意图闭集 v0 只有四个动词

- **plan §2.3 / framework §2.3** 列了五类动词（含 `feed_post` / `take_photo` 等社区类）。
- **实现**：v0 = `move_to` / `talk_to` / `rest` / `observe`。
- **理由**：社区类动词要 spawn 帖子实体，而 `Effect` 的 kind 闭集里**没有 spawn**
  （`set-flag|set-flag-tagged|modify-resource|set-state|set-sensor|set-visible|set-visible-tagged|destroy|destroy-tagged|reset-timer`）。
  硬上就得在游戏层写一个「读 verb → 造实体」的分支 = plan §4 明令不申请的解释器。
- **销账路径**：小星书那一段等 UI 阶段一并处理；届时若仍表达不了，走缺口裁决协议摆 A/B，**不偷偷写解释器**。

### 偏差 ③：BT 叶尚未注册（plan §4 例外①已准，但本阶段没用上）

L3 NPC 的行为模式树在 v0 未接（现有 NPC 是 L1/L2/L4，没有 L3）。例外①**已批未用**，不算债，
但记在此以免复查门误判「批了没做 = 漏做」。

## 3. 撞出来的引擎缺口（报主程·本层不自行改）

### 缺口：`ComponentDataMap` 未登记五个新组件

- **现象**：`TurnOrder` / `Memory` / `MemoryRules` / `IntentBarrier` / `IntentInbox` 写进 `WorldBlueprint`
  的实体表会被 TS 拒绝：`Object literal may only specify known properties, and 'Memory' does not exist in type 'EntityBlueprint'`。
- **根因**：`src/assembly/demo.assembly.ts:18` 的 `EntityBlueprint = { [K in keyof ComponentDataMap]?: ... }`，
  而 `src/assembly/component-map.ts` 的 `ComponentDataMap` 里没有这五型。`t2-turn-order`（2026-09-09 下沉）
  与 LLM 三件套（2026-09-13 下沉）都只登了 registry，没登 blueprint 的组件映射。
- **影响**：**任何游戏都无法在 blueprint 里声明这五个组件**，只能运行时 `addComponent` 补。
  对 `IntentBarrier`/`Memory` 尚可（`openBarrier`/`remember` 本就是引擎给的运行时路径），
  但 `MemoryRules`/`TurnOrder` 是**纯配置组件**，本该躺在 blueprint 里，现在只能在宿主层 addComponent。
- **归属**：`src/assembly/component-map.ts` = **跨游戏共享面 → 🔴 只归主程**（CLAUDE.md 施工归属第 1 条；
  「拿不准按 🔴 走」）。本层**不自行改动**，已开单：`docs/design/game111/requests.md` REQ-111-ENG-04。
- **当前绕法**：`blueprint.ts` 的 `setupTown()` —— 走引擎自己的挂载路径，语义等价、零自造。

## 4. 自证实测撞出的两条配平教训（已修·记着别再犯）

1. **衰减必须明显小于单动作回复量**。首版四项衰减合计 16、单动作回复 25，实跑六回合全员归零——
   一回合只能做一件事，所以「四项之和」对的是「一个动作」，不是「四个动作」。现 11 < 18。
2. **每条降级/规则的动词必须真能回补那一项需求**。首版 Null 桩把 `curiosity` 垫底映射到 `move_to`，
   而 `move_to` 只改所在地、不回好奇心 → 十回合全员卡在「动身去后山」刷屏。**活锁不是模型的毛病，
   是规则表自己把自己锁死了。** 真后端也吃这条：prompt 里给的动词语义要和 Effect 表真实对得上。

## 5. 下一阶段（未做·不是欠账清单，是 owner 定过的分期）

owner 2026-09-14 的原话是「**先**搭起框架」。框架已可跑可测可接真模型。尚未做的是**表现层**：
LayoutNode UI（`apolloOnyx` + `@ui/starters` + `Connector` 关系网 + `VirtualList` 小星书）、
玩家↔NPC 对话入口、称号的玩家侧解锁路径。这三件都在 capability-plan §4.6 写死了用什么件，
开工前按 UI 铁律先读 `docs/design/ui-playbook.md` + `docs/playbooks/ui.md`，交付前跑 `/check-ui`。
