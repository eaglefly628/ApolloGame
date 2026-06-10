# Programmer Inbox

> Lead 写入任务，Programmer 轮询读取。
> 格式约定：每个任务一个 section，状态标记 pending/in-progress/done。

## ✅ 批次 T1-完结 —— 已由 Lead 自补完成（2026-06-03），勿重复

> PA 未在本 session 周期内交付该 3 个；按"小型低耦合任务单 agent 更快"的结论，Lead 直接写完并集成到 mainbranch：
> `rotation-apply`(Rotate) / `animation`(Update,consume TimerDone) / `hierarchy-resolve`(PostResolve)，相位已修正、测试全绿（全量 272 passed）。
> 下方为原派发存档（保留以备查）。

### 原派发存档 · 批次 T1-完结（派给 Programmer A，3-wide 并行）

> **基线**：`claude/mainbranch`（已含 Lead 写好的契约：`SystemPhase` 加 `Rotate`/`PostResolve`、`Trigger` 组件）。
> **开工前必做**：`git fetch origin claude/mainbranch && git reset --hard origin/claude/mainbranch`。
> 详细设计参考你自己的 `programmer-a/next-batch-proposal.md`，但**相位以下方 Lead 修正为准**。
> 自检：`tsc --noEmit` 干净 + 各自 `vitest` 全绿 + 只在 `src/tier1/index.ts` 追加一行 export + 不碰引擎核心/protocol。完成写 `outbox.md`。

### 任务 1 · rotation-apply — status: pending
- 文件：`src/tier1/rotation-apply.ts` + `.test.ts`
- `reads ['Transform','Velocity'] → writes ['Transform']`；**`phase: SystemPhase.Rotate`**
  （修正：原提案写 Update 会与 motion-apply 在 Transform 上同阶段、两个读改写判成环）
- 公式：`transform.rotation += velocity.angular`（motion-apply 的镜像，定步长无 dt）

### 任务 2 · animation — status: pending
- 文件：`src/tier1/animation.ts` + `.test.ts`
- `reads ['TimerDone','Frame'] → writes ['Frame']`；`phase: Update`（缺省，省略 phase 字段）
- 计时到点推进：`frame.index = (index + 1) % total`（loop 环绕）；`TimerDone` 的 read/consume 与 `timer-advance` 保持一致

### 任务 3 · hierarchy-resolve — status: pending
- 文件：`src/tier1/hierarchy-resolve.ts` + `.test.ts`
- `reads ['Hierarchy','Transform'] → writes ['Transform']`；**`phase: SystemPhase.PostResolve`**
  （修正：原提案写 Resolve 会与 collision-resolve 在 Transform 上同阶段、判成环）
- 子世界 Transform = 父复合本地偏移（位置相加、旋转相加、缩放相乘；**最小形态本地偏移不随父旋转**，避免 sin/cos）；按父链深度先根后叶，多级一帧到位

> **协调说明**：Lead 先前误用后台子 Agent 把这 3 个也跑了——但那是 Lead session 内的并行；按分工**这 3 个归 Programmer A 的独立 session**。Lead 误跑产物已丢弃，请 A 从干净基线自建。`counter` 折叠为 Macro，留到下一轮。

---

## 派发 · Game E / Game F 数据接线（2026-06-10，Lead/主程4）

> **边界（用户 2026-06-10 拍板）**：游戏层（`src/games/**`）一律归各 PE，Lead 只动引擎+文档、不动手接线。
> **基线**：`claude/mainbranch` @ `f3fbc89`（引擎能力全部就绪：tsc + vitest 934 + build 全绿）。
> **开工前必做**：`git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`（多 session 并行，push 前同样 fetch→rebase）。
> 自检：tsc + vitest + build 全绿才推。完成在本节任务行标 done 并写 `outbox.md`。

### 给 PE-E（Game E · 小丑牌）

#### 任务 E-1 · REQ-017/020 回合流程数据化 — status: pending
- 用 `flow`（声明式状态机=流程数据，onEnter+条件转移+`after` 时序门）+ `card-pile`（牌库/手牌 sim 内管理：发牌/下标出牌/弃牌/补牌）把 game-e 回合流程重写为**纯数据**，替掉手写回合代码。
- 出牌输入接缝 `card-play`（REQ-016/017，按 owner 路由）已就绪。

#### 任务 E-2 · REQ-019 ScoreTrace 计分回放 — status: pending（你已在接，继续）
- 读 `score-trace` 逐步 trace 做计分回放 UI（trace 已排除出 hash、opt-in）。

### 给 PE-F（Game F · 金铲铲）

#### 任务 F-1 · REQ-F-026 接入 hierarchy-cascade（1 行数据） — status: pending
- game-f blueprint 的 capabilities 列表加 `hierarchyCascadeCapability`（`@skills/tier1/index.js` 已导出；manifest 用 id `t1-hierarchy-cascade`）。
- 即修「死棋子头顶名字残留」：父销毁同帧级联清后代，引擎侧已落 `f3fbc89`（8 测绿）。零游戏代码。

#### 任务 F-2 · REQ-021/022 自治/羁绊接线 — status: pending
- `self-rule`（实体本地条件→对自身施效）+ `group-count`（按 Tag 计数→Resource，阈值=event-when 重组）接金铲铲自治/羁绊。

> ⚠️ **别在游戏层 workaround 引擎缺口**：REQ-F-027（grid-move 投影正交化）/ REQ-F-028（flow↔zone-occupancy 环）是引擎侧、归主程，落地后另行通知再接线。
