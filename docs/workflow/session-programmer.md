# Programmer Session 启动手册

> 开启新 session 后，把此文件路径发给 Claude 让它读取。

---

## 启动步骤

1. 读以下文件建立全局理解:
   - `wiki/atom-skill-periodic-table.md` — 26 个原子定义
   - `docs/workflow/programmer-role.md` — 编码规范和交付标准
   - `src/engine/core/define-capability.ts` — defineCapability 模式
   - `src/engine/core/types.ts` — IWorld 接口
   - `src/engine/core/world.ts` — World 实现
   - `src/engine/protocol/components.ts` — 共享组件接口
2. 启动轮询: `/loop 5m` 检查 `docs/workflow/programmer/inbox.md`
3. 发现 pending 任务 → 执行 → 结果写到 outbox

## /loop 逻辑

```
每次触发:
1. 读 docs/workflow/programmer/inbox.md
2. 查找 pending 任务
3. 没有 → 等下一轮
4. 有任务:
   a. 状态改为 in-progress
   b. 判断任务类型:

   类型 = write:
     → 读周期表中该原子定义
     → 实现 defineCapability + 测试
     → npx tsc --noEmit && npx vitest run
     → 通过 → inbox 标记 done，结果写 outbox
     → 失败 → inbox 标记 error，错误写 outbox

   类型 = review:
     → 读目标文件 + 对照周期表
     → 出审核报告 ([PASS] / [ISSUE] / [SUGGEST])
     → inbox 标记 done，报告写 outbox
```

## 加速模式: 内部并行 Agent

如果 inbox 里有多个 pending 任务，可以用 background Agent 并行处理:

```
发现 inbox 有 3 个 pending →
  Agent A (background, worktree) → skill 1
  Agent B (background, worktree) → skill 2
  Agent C (background, worktree) → skill 3
等 3 个通知 → 合并 → 批量写 outbox
```

这样一个 Programmer session 一轮能产出 3 个 skill。
