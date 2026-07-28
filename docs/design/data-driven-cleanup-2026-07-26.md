# 数据驱动整改批 · 工单（Lead 裁·owner 2026-07-26）

> **开工时间：明天下午（客户晨会后）** —— owner 拍板：晨会 demo 前只保「正常性」，整改压到会后。
> **正常性基线（2026-07-26 夜·Lead 核）**：`tsc` 0 · game101/102/103 测试 91/91 绿 · `npm run build` OK。三 game 均在 launcher 注册、结构可 demo。**本批全部为会后整改·今夜零游戏码改动**。
> 背景=101/102/103 数据驱动代码 review（三路并行审·2026-07-26）。**game102 不在本批**（voxel「真身之争」另等 owner 拍板 A/B/C）。

## A. game101（小瑕·PE-101 域）
1. **虚胖数据**：`config/generators.json` 的 `cooldownSec`（G4 承诺的冷却没接 `timer-advance`·`blueprint.ts:77-105` 只读 energyCost/dropTable）+ `config/energy.json` 的 `overcapAllowed`（全库零读取）。**裁：** 接上 G4 冷却，或删掉未生效字段。零风险优先删。
2. **游戏层放置 solver `relocateGenSpawns`**（`game101.ts:65-87`·每帧裸扫棋盘找空格 + 直写 world API·未过 capability-plan）。**裁：软违规·该下沉**——通用「就近空格落子」策略，下沉给 `caster`/`prefab-spawn` 加 `at:'nearest-empty'` 或薄能力 `spawn-relocate`，补报 capability-plan G7。行为等价须真机验（会后做·别晨会前动）。
3. **juice 手搓 setTimeout**（`game101.ts:296/304/327`·没走声称的 `t3-timeline`·plan 与代码脱节）。**裁：** 迁 `t3-timeline` 数据表，或更新 plan 文档反映现状（render-only juice·非 sim·择一消除脱节）。

## B. game-103（最干净·0 硬违规·仅 2 灰区 + 1 文档）
1. **`spawn-director` 建而未用**（E3 波次改用 Timer+SelfRule+GroupCount 手摆 47 spawner·`theme.ts:332-359`+`blueprint.ts:510-538`）。当前重组**合规**（全文档化字段·无自由码），但把下沉的 `spawn-director` 晾成死代码。**裁：** 二选一——① 103 改接 `spawn-director`（更省·用上资产·但改波次行为·会后真机验）；② 正式**保留** `spawn-director` 给 pe-handoff 提的 M3/M4 击杀数动态调频（文档标 reserved·当前 M1/M2 重组为等价合规）。倾向②（不折腾已跑通的波次·避 demo 风险）。
2. **`evoReady` 复合布尔在宿主 TS**（`game-103.ts:78`）。**裁：接受**——延用已批的 draft-offer「宿主持纯函数态」E1 先例（小·低频·不写 sim·不进 hash）。可选优化=收进 `event-when`·非必须。
3. **过期头注**（`blueprint.ts:14` 仍写「E1–E4…未接」但已接好）。**裁：** 顺手清（trivial）。

## C. 跨 game·系统性：「下沉→消费」闭环纪律（非「零消费」通杀 guard）
> **Lead 复核修正 owner「首解决 sunk-but-unused」的口径**：准确扫描（名+id 双查）后，真「零游戏消费」的 defineCapability 有 16 个，但绝大多数是**健康的**——
> - **库广度**（jump/friction/ground-sense/dice-roll/card-play/stats/block-grid/slot-payout…）：为未来/其它品类（平台跳跃/卡牌/骰子/老虎机）备的通用积木，当前无游戏用 ≠ 死代码。**库本就该比任一游戏宽。**
> - **刚下沉待消费**（bounce-relay/pull-anchor/queue-slots）：本 session 刚建·PE 明天接 manifest 数据即消费。
> - **真·浪费（唯一）= `spawn-director`**：为 103 下沉、103 却手搓等价物绕过（=本批 B-1）。
>
> **裁：不建「每能力必须有消费者」的通杀 guard**（会误杀库广度 + 待消费）。真正要治的是**「为某 plan 下沉、该 game 却 bypass」**这一窄类。**药方（会后做·轻量）**：capability-plan 落地体检时加一条——plan 里承诺「消费 capability X」的，`game-skill-audit` 顺带核该 game 是否真引用 X（名或 id），不一致则黄旗（提示：改接 or 改 plan）。范围窄、不碰库广度。

## 不做 / 待 owner
- **game102 voxel「真身之争」**（A 换回合规 mount2D / B 收编 voxel 玩法进能力数据 / C 限时 spike 挂债）——**等 owner 拍**，不在本批。
- 本批全部**会后（明天下午）开工**，逐条真机验、别晨会前动游戏码。
