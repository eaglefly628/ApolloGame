# game111 · 需求单（游戏级·不占引擎槽）

> **为什么放这里而不是 `docs/workflow/requests.md`**：
> ① **实测**引擎池字符预算已满——`context-budget` 报 **24783/25000 字符**（槽位 4/10 尚有余，卡的是字符），加三条即红灯拦推送。
> ② **本仓先例**（`requests.md` 内 REQ-DIALOGUE 2026-08-16 出池原话）：「**下一步触发者不在池内**」的需求不占槽。本三件的下一步触发者 = **Lead 批 `capability-plan.md` §6**，尚未发生，现在占引擎槽属抢跑。
>
> **晋升规则**：`capability-plan.md` 过审、且有主程真接单时，把对应条目**原文搬进** `docs/workflow/requests.md` 并抢锁（改「施工主体」为自己并推一次）。搬之前先清池腾字符。
>
> **编号唯一**：开单前 `grep` 同名防重号（2026-08-08 game108 GD-01 重号复盘）。

---

## REQ-111-ENG-01 · LLM NPC 决策端口 `NpcAgentPort`

- **owner 裁决**：2026-09-12 判 **A（下沉引擎）**（`framework.md` §6 缺口②）
- **归属**：🔴 主程面 · **指派：Opus** · **施工主体 = 主程 = 本 session（2026-09-12 抢锁）** · status: **in-progress** · P1 · **已晋升引擎池 = `REQ-111-AINPC`**
- **捆绑**：与 `REQ-111-ENG-02` 同批做。**只做端口不做 barrier = 最坏组合**（有了调模型的能力，却没有把结果确定性落地的能力，不确定性直漏 sim）。

**想实现的行为**
照 `EnginePort` / `AishePort` 风格定一个窄契约：

```
interface NpcAgentPort {
  decide(ctx: AgentContext): Promise<Intent[]>;
}
```

配两个实现：
- `NullNpcAgentPort` —— **确定性桩**。固定规则产意图（如按需求最低项选动词），无网可跑。**这是全库测试基建**：没有它，任何 AI 游戏的测试都进不了 CI。
- `HttpNpcAgentPort` —— 真后端。

**已经试了什么（实查留痕）**
- `grep -rilE "llm|openai|anthropic|prompt" src/ --include=*.ts` → 命中全部为无关词（UI 文案 + AIGP 提示词）。registry 无任何 LLM 端口。
- `src/services/aigp/aishe-port.ts` 是唯一外部 AI 先例，但文件头原文：「**绝不碰 world / snapshot / hash**（异步旁路，与资产、音频同纪律）」。而 NPC 决策**必须**写世界 → **不能照抄**，只能照其**端口哲学**另立一件。

**卡在哪**
缺「外部 AI 服务 → 确定性 sim」的入口契约。

**边界（复查门核对用）**
- 新增 `src/services/npc-agent/**`；registry 登记；同提交回填 `docs/playbooks/opponent-ai.md` 一行（手册与 registry 同步是下沉工作的一部分）。
- **端口不写世界**——只产 `Intent[]`，落地归 `REQ-111-ENG-02`。
- **不碰 sim / snapshot / hash**。

**图纸**：`framework.md` §1.2 · §6② · `capability-plan.md` §2.3

---

## REQ-111-ENG-02 · 异步意图收齐门 `intent-barrier`

- **owner 裁决**：2026-09-12 判 **A（下沉引擎）**（`framework.md` §6 缺口③）
- **归属**：🔴 **主程面**（碰定序/相位 · 确定性与快照 hash · lockstep · 新增 system）· **指派：Opus** · **施工主体 = 主程 = 本 session（2026-09-12 抢锁）** · status: **in-progress** · P1 · **已晋升引擎池 = `REQ-111-AINPC`**

**想实现的行为**
1. 本回合登记 N 个待决 NPC。
2. 异步回包收齐后，**按 npcId 排序**一次性注入 `applyCommands`。
3. 超时 / 失败 → 按**回合数**判据（**禁墙钟**）确定性降级，补默认意图（如 `rest()`）。

**已经试了什么（实查留痕）**
- `src/skills/tier3/flow.ts` 管相位跳转，**不等异步回包**。
- `src/net/lockstep.ts` 有「收齐再步进」的 barrier 形状，但它等的是**同步到达的对端命令**，不是 Promise。
- `src/net/commands.ts` 已钉死「应用前一律按 playerId 排序——顺序只由内容决定，与网络到达次序无关」，但**未覆盖「回包迟到 / 失败」**。
- 三者之间缺这一格。

**卡在哪**
这是整条链上**唯一会污染确定性的地方**。按到达序应用 → 每次跑出的世界都不同 → 存档 / 录放 / lockstep 全废。症状是「偶发 desync / 存档读出来不一样」，属本仓最难查的 bug 形状。

**红线（施工必读）**
- 判据用整数回合数，零浮点、零墙钟（`debug-trace` 红线②同源：回放要对得上）。
- **定序**：新增相位链 `INTENT → COMMIT → SETTLE` 有闭环风险，而 `topological-sort` 在 CYCLEHAZ B 后**只告警不抛**，落序不合语义仍照跑 → 接缝静默失效（ENG-03 实证：引入的 Commit 相位环，**定序用例全绿**、第一轮复查仍漏）。
  → **必须读 stderr 告警**，并加一条「断言 `topological-sort` warn 数为零」的定序测试。**绿灯不等于没话说。**
- 任何新增的意图缓存/调试组件**必须登记 `NON_DETERMINISTIC`**（`determinism.ts` 原文：「名单靠手维护，拼错一个名字即静默失效——多算→误报 desync，少算→假绿」）。

**边界**：`src/net/**` 或 `src/skills/tier2/**` + `determinism.ts` 名单核对 + 定序测试。

**图纸**：`framework.md` §6③ · `capability-plan.md` §5.2

---

## REQ-111-ENG-03 · 记忆能力 `t2-memory`

- **owner 裁决**：2026-09-12 判 **A（下沉引擎）**（`framework.md` §6 缺口①）
- **归属**：🔴 主程面（进 hash · 影响快照体积与存档）· **指派：Opus** · **施工主体 = 主程 = 本 session（2026-09-12 抢锁）** · status: **in-progress** · P1 · **已晋升引擎池 = `REQ-111-MEMORY`**

**想实现的行为**
- 记忆条目 = 数据：主体 / 客体 / 时刻（回合号）/ 强度 / 标签 / **来源**。
- 逐回合强度衰减（可复用 `t2-over-time` 的形状与确定性口径）。
- **确定性 top-K 检索**：标签命中 + 强度 + 时近打分排序。**整数权重，禁浮点排序**——浮点跨端 JIT/FMA 可能 1 ULP 漂移，纳入排序即误报 desync（`determinism.ts` 对 Camera 的同款理由）。
- `share`：把一条记忆复制给另一 NPC 并**打折强度**。这是涌现叙事「链式影响」的唯一载体。

**已经试了什么（实查留痕）**
- registry 实查：**无任何记忆能力**（无编码/遗忘/联想/检索，无跨实体流转）。
- `src/skills/tier1/event-log.ts` 只是**平铺事件流水**——无衰减、无检索、无归属，且**未注册为 capability**。
- `f1-resource` + `x3-string-variable` 硬凑 = 在游戏层写一个检索解释器 = 宪法明禁的「数据表 + 游戏层自写解释器」虚胖数据（game-g 天罡/地煞教训）。

**卡在哪**
「谁在何时对谁做了什么，且这件事会淡忘、会被传开」——现有能力零表达。

**通用性证据（owner 判 A 的依据）**
`docs/design/game101/`（海港绯闻）以「绯闻传播」为名，与本原语同构。判 B 则 101 / 108 / 111 各写一套，正是 `modifier-stack` 下沉前「库里出现三次却各写一套」的原样。

**边界**
- `src/skills/tier2/memory.ts` + registry 登记 + 同提交回填 `docs/playbooks/opponent-ai.md`（该手册现有「记忆=资源台账」一行需同步更新）。
- 注意快照体积与**存档兼容**（进 hash 的新组件会改变旧档指纹语义，需给迁移口径）。

**图纸**：`framework.md` §6① · `capability-plan.md` §2.3

---

## 已结案

（暂无）
