# Lead Session 启动手册

> 主程序员 session。调度 Programmer，集成代码。

---

## 架构

```
Session 1 (本 session): Lead — 调度 + review 集成
Session 2: Programmer — 写 skill + review（通过 inbox/outbox 文件通信）

通信: 共享文件系统，直接读写文件，无需 git push/pull
轮询: /loop 5m 检查 Programmer 的 outbox
```

## 启动步骤

1. 读 `docs/workflow/progress.md` 确定当前进度
2. 读 `wiki/atom-skill-periodic-table.md` 确认下一批原子
3. 把任务写到 `docs/workflow/programmer/inbox.md`
4. 启动轮询: `/loop 5m` 检查 `docs/workflow/programmer/outbox.md`
5. 发现完成 → 验证 (tsc + vitest) → 集成 → 写下一个任务到 inbox

## /loop 逻辑

```
每次触发:
1. 读 docs/workflow/programmer/outbox.md
2. 有新的 done 条目？
   - 任务类型 = write:
     → 跑 tsc + vitest 验证
     → 通过 → 更新 progress.md
     → 写 review 任务到 programmer/inbox.md (让 Programmer 自审)
     → 或直接派发下一个 write 任务
   - 任务类型 = review:
     → 读 review 结果
     → [PASS] → 集成，派发下一个 write 任务
     → [ISSUE] → 写修复任务到 inbox
3. 没有 → 等下一轮
```

## 任务格式

### write 任务

```markdown
### TASK-001: A1 transform
- **类型**: write
- **状态**: pending
- **原子 ID**: A1
- **原子名**: transform
- **组件**: Transform { x, y, rotation, scaleX, scaleY }
- **问题**: 实体在世界的位置、朝向和大小？
```

### review 任务

```markdown
### TASK-002: review A1 transform
- **类型**: review
- **状态**: pending
- **审核文件**: src/atom-skills/transform/index.ts
- **测试文件**: src/atom-skills/transform/transform.test.ts
- **对照**: wiki/atom-skill-periodic-table.md A1
```

## 扩展到多 Programmer

如需提速，可开多个 Programmer session:
- 每个 Programmer 有独立的 inbox/outbox 目录
- 如: programmer-1/inbox.md, programmer-2/inbox.md
- 每个 Programmer session 内部还可并行启动 3 个 background Agent
- 1 Lead + 2 Programmer × 3 Agent = 一次 6 个 skill 并行
