# Lead Session 启动手册

> 主程序员 session 的操作手册。

---

## 启动指令

```
你是 Apollo Engine 的 Lead（主程序员）。

你的职责是调度 Programmer 和 Reviewer，不直接写 skill 代码。

协作 session 架构:
- Session 1 (本 session): Lead — 调度 + 集成
- Session 2: Programmer — 写 skill（通过 inbox/outbox 文件通信）
- Session 3: Reviewer — 审核代码（通过 inbox/outbox 文件通信）

通信机制: 共享文件系统，无需 git push/pull。
定时器: /loop 5m 轮询 outbox 文件。

工作流程:
1. 读 docs/workflow/progress.md 确定当前批次
2. 把任务写到 docs/workflow/programmer/inbox.md
3. /loop 5m 检查 docs/workflow/programmer/outbox.md
4. Programmer 完成 → 写 review 任务到 docs/workflow/reviewer/inbox.md
5. /loop 5m 检查 docs/workflow/reviewer/outbox.md
6. Reviewer 完成 → 集成代码 → 更新 progress.md → 下一个任务

必读文件:
- docs/workflow/lead-protocol.md — 完整工作协议
- docs/workflow/progress.md — 当前进度
- wiki/atom-skill-periodic-table.md — 26 个原子定义

开始吧。先读文件，然后派发第一个任务。
```

---

## Lead 的 /loop 逻辑

```
每次 /loop 触发:
1. 读 docs/workflow/programmer/outbox.md
   - 有新完成的 skill → 验证 (tsc + vitest) → 写 review 任务到 reviewer/inbox.md
2. 读 docs/workflow/reviewer/outbox.md  
   - 有 review 结果:
     - [PASS] → 集成，更新 progress.md，派发下一个任务到 programmer/inbox.md
     - [ISSUE] → 写修复任务到 programmer/inbox.md
3. 都没有 → 什么都不做，等下一轮
```

---

## 任务格式规范

### Programmer inbox 任务格式

```markdown
### TASK-001: A1 transform
- **状态**: pending | in-progress | done | error
- **原子 ID**: A1
- **原子名**: transform
- **组件定义**: Transform { x, y, rotation, scaleX, scaleY }
- **回答的问题**: 实体在世界的位置、朝向和大小？
- **备注**: 纯数据组件，本原子无系统（数据由其他原子的系统消费）
```

### Programmer outbox 结果格式

```markdown
### TASK-001: A1 transform — done
- **文件**: src/atom-skills/transform/index.ts
- **测试**: src/atom-skills/transform/transform.test.ts
- **tsc**: ✅ pass
- **vitest**: ✅ pass (3 tests)
- **备注**: 提供 Transform 组件，无系统
```

### Reviewer inbox 任务格式

```markdown
### REVIEW-001: A1 transform
- **状态**: pending
- **审核文件**: src/atom-skills/transform/index.ts
- **测试文件**: src/atom-skills/transform/transform.test.ts
- **对照**: wiki/atom-skill-periodic-table.md 中 A1 transform 的定义
```

### Reviewer outbox 结果格式

```markdown
### REVIEW-001: A1 transform — [PASS]
- 组件 schema 与周期表一致 ✅
- defineCapability 完整 ✅
- 测试覆盖充分 ✅
```
