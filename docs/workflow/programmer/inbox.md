# Programmer Inbox

> Lead 写入任务，Programmer 轮询读取。
> 格式约定：每个任务一个 section，状态标记 pending/in-progress/done。

## 当前任务 · 批次 T1-完结（派给 Programmer A，3-wide 并行）

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
