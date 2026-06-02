# Lead Programmer 工作协议

> 主 Claude 的循环调度手册。每批 3 个原子，派发 → 收取 → 审核 → 下一批。

---

## 架构概览

```
用户: "执行 Batch N" 或 "执行全部"
  │
  ▼
Lead (主 Claude，本 session)
  │
  ├─► Programmer A ── background Agent, worktree 隔离
  ├─► Programmer B ── background Agent, worktree 隔离
  └─► Programmer C ── background Agent, worktree 隔离
        │
        └─ 完成后自动通知 Lead（内建机制，无需轮询）
```

### 关键机制约束

| 机制 | 能力 | 限制 |
|------|------|------|
| **background Agent** | 同 session 内并行子任务，完成自动通知 Lead | 不能跨 session |
| **worktree 隔离** | 每个 Programmer 在独立 git worktree 工作，互不干扰 | 无变更时自动清理 |
| **/loop 定时器** | session 内定时执行检查（如 `/loop 5m check-status`） | 单 session 内，不跨 session |
| **progress.md** | 跨 session 的持久化状态，新 session 读取即恢复上下文 | 需 Lead 主动更新 |
| **session 间通信** | ❌ 不支持。无消息总线、无事件、无共享内存 | — |

### 推荐节奏

```
一个 session = 一个批次 = 3 个并行 Programmer
完成后 push + 更新 progress.md → session 可结束
下一个 session: 读 progress.md → 继续下一批
```

一个 session 处理 1 批（3 个 skill）完全不触发 context 压缩。
如果 context 余量充足，可以连续执行多批。

---

## 角色

Lead（主程序员）不直接写原子 skill 代码，职责是：

1. **规划** — 读 progress.md，按依赖拓扑选下一批 3 个原子
2. **契约** — 在 `protocol/components.ts` 写好共享接口
3. **派发** — 用 Agent(background, worktree) 并行启动 3 个 Programmer
4. **等待** — background Agent 完成后自动收到通知（无需轮询）
5. **审核** — review 代码 + 跑 tsc + vitest
6. **交叉审核** — 让 Programmer 互审（A→B, B→C, C→A）
7. **集成** — 合并 worktree 到主分支，解决冲突
8. **更新** — 更新 progress.md，push
9. **循环** — 回到步骤 1，或结束 session

---

## 单批次执行流程

```
┌─────────────────────────────────────────────────────────┐
│                   BATCH N 执行流程                        │
│                                                           │
│  1. Lead 读 progress.md → 确定 Batch N 的 3 个原子         │
│  2. Lead 写 protocol 接口（如本批有共享组件）                 │
│  3. Lead 发送一条消息，包含 3 个 Agent tool call:            │
│     ┌──────────────────────────────────────────┐          │
│     │ Agent A (background, worktree) → atom X  │──┐       │
│     │ Agent B (background, worktree) → atom Y  │──┤ 并行   │
│     │ Agent C (background, worktree) → atom Z  │──┘       │
│     └──────────────────────────────────────────┘          │
│  4. 收到通知 A ✅ → review A                               │
│     收到通知 B ✅ → review B                               │
│     收到通知 C ✅ → review C                               │
│  5. 交叉审核 (可选，3 个 review Agent 并行):                 │
│     A 审 B, B 审 C, C 审 A                                │
│  6. tsc --noEmit + vitest run                             │
│  7. 合并 3 个 worktree → 主分支                             │
│  8. 更新 progress.md → commit + push                       │
│  9. ✅ 继续下一批  |  ❌ 暂停，报告问题等用户指示              │
│                                                           │
│  如果 context 充足 → 自动执行 Batch N+1                     │
│  如果 context 紧张 → push + 结束 session                    │
└─────────────────────────────────────────────────────────┘
```

---

## /loop 定时器使用场景

`/loop` 在本工作流中的合理用途：

### 场景 1: 用户离开后的进度监控
```
/loop 10m "读 progress.md，报告当前批次状态"
```
用户不在时，Lead 定时汇报进度到输出（用户回来能看到）。

### 场景 2: 外部变更检测
```
/loop 5m "git fetch origin && git diff HEAD..origin/claude/mainbranch --stat"
```
检测是否有外部（其他 session 或用户）推送了变更。

### 注意
- background Agent 完成会自动通知，**不需要** /loop 去轮询 Agent 状态
- /loop 是同 session 内的，session 结束即停止

---

## 派发 Prompt 模板

三个 Agent 在同一条消息中并行派发：

```
Agent({
  description: "Programmer A: {atom-name}",
  isolation: "worktree",
  run_in_background: true,
  prompt: `
你是 Apollo Engine 的 Programmer A。

## 你的任务
实现原子 skill: {atom-id} {atom-name}

## 全局上下文
阅读以下文件获取完整理解:
- wiki/atom-skill-periodic-table.md — v6 原子周期表 (26 个核心原子)
- docs/workflow/programmer-a.md — 你的角色文档
- src/engine/core/define-capability.ts — defineCapability 模式
- src/engine/core/types.ts — 核心类型
- src/engine/protocol/components.ts — 共享组件接口

## 交付物
1. src/atom-skills/{atom-name}/index.ts — defineCapability() 实现
2. src/atom-skills/{atom-name}/{atom-name}.test.ts — vitest 测试
3. 如有共享组件 → 更新 protocol/components.ts

## 约束
- 纯 ECS 数据 + 系统，无副作用
- 组件是纯数据结构（POD）
- 系统只通过 world.query / world.getComponent / world.addComponent 操作
- 不引入任何外部依赖
- 完成后运行: npx tsc --noEmit && npx vitest run
- commit message 以 [Programmer A] 开头
`
})
```

---

## 交叉审核 Prompt 模板

```
Agent({
  description: "Cross-review: {reviewer} reviews {author}",
  run_in_background: true,
  prompt: `
你是 Programmer {reviewer}，负责审核 Programmer {author} 的代码。

阅读:
- src/atom-skills/{atom-name}/index.ts
- src/atom-skills/{atom-name}/{atom-name}.test.ts
- wiki/atom-skill-periodic-table.md 中 {atom-id} 的定义

审核要点:
1. 组件 schema 是否与周期表定义一致？
2. 系统的 reads/writes/consumes 声明是否正确？
3. 测试是否覆盖核心行为？
4. 有无遗漏的边界情况？

输出: 200 字以内的审核报告。问题标 [ISSUE]，建议标 [SUGGEST]，通过标 [PASS]。
`
})
```

---

## 错误处理

| 错误类型 | Lead 行为 |
|---------|----------|
| Agent 返回编译错误 | Lead 修复或重新派发该 Programmer |
| 测试失败 | Lead 分析原因，修复后重跑 |
| worktree 合并冲突 | Lead 手动解决（通常是 protocol/components.ts 冲突） |
| context 接近压缩 | 立即 push + 更新 progress.md + 结束 session |
| 用户中断 | 保存当前状态到 progress.md + push |

---

## 批次计划 (依赖拓扑排序)

| 批次 | Programmer A | Programmer B | Programmer C | 前置依赖 |
|------|-------------|-------------|-------------|---------|
| 1 | A1 transform | F1 resource | F2 flag | 无 |
| 2 | B1 velocity | E1 timer | G1 tag | 无 |
| 3 | B2 acceleration | G2 relation | H1 visibility | 无 |
| 4 | B3 mass | I1 input-capture | J1 state | 无 |
| 5 | C1 shape | I2 action-map | K1 spawn | I1→I2 |
| 6 | A2 hierarchy | K2 destroy | W1 random | A1→A2 |
| 7 | D1 overlap-detect | L1 sprite | L2 color | A1+C1→D1 |
| 8 | L3 frame | L4 sound | L5 camera | L1→L3 |
| 9 | L6 text | W2 spatial-query | — | A1→W2 |

---

## 进度追踪

每批完成后更新 `docs/workflow/progress.md`。
新 session 启动时第一步：读 progress.md 恢复上下文。
