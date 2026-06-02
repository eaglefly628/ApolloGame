# Lead Programmer 工作协议

> 主 Claude 的循环调度手册。每批 3 个原子，派发 → 收取 → 审核 → 下一批。

---

## 角色

Lead（主程序员）不直接写原子 skill 代码，职责是：

1. **规划** — 按依赖拓扑选下一批 3 个原子
2. **契约** — 在 `protocol/components.ts` 写好共享接口
3. **派发** — 用 Agent(background, worktree) 启动 3 个 Programmer
4. **审核** — 每个 Programmer 完成后 review 代码 + 跑测试
5. **交叉审核** — 让 Programmer 互审（A→B, B→C, C→A）
6. **集成** — 合并 worktree 到主分支，解决冲突
7. **循环** — 更新进度，回到步骤 1

---

## 循环流程

```
┌─────────────────────────────────────────────────┐
│                  LEAD 主循环                      │
│                                                   │
│  1. 读 progress.md → 确定下一批 3 个原子            │
│  2. 写 protocol 接口 (共享类型)                     │
│  3. 并行启动 3 个 Programmer Agent (background)     │
│     ├─ Programmer A → worktree-a                  │
│     ├─ Programmer B → worktree-b                  │
│     └─ Programmer C → worktree-c                  │
│  4. 等待 3 个通知 (自动)                            │
│  5. 逐个 review:                                   │
│     - tsc --noEmit                                │
│     - vitest run                                  │
│     - 代码风格一致性                                │
│  6. 交叉审核:                                      │
│     - 启动 3 个 review Agent                       │
│     - A 审 B, B 审 C, C 审 A                      │
│  7. 合并到主分支, 更新 progress.md                   │
│  8. 下一批 → 回到 1                                │
└─────────────────────────────────────────────────┘
```

---

## 派发 Prompt 模板

```
Agent({
  description: "Programmer X: {atom-name}",
  isolation: "worktree",
  run_in_background: true,
  prompt: `
你是 Apollo Engine 的 Programmer {A/B/C}。

## 你的任务
实现原子 skill: {atom-id} {atom-name}

## 全局上下文
阅读以下文件获取完整理解:
- wiki/atom-skill-periodic-table.md — v6 原子周期表 (26 个核心原子)
- docs/workflow/programmer-{a/b/c}.md — 你的角色文档
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
- commit 完成后 message 标注 [Programmer {X}]
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

## 批次计划 (依赖拓扑排序)

| 批次 | A | B | C | 前置 |
|------|---|---|---|------|
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
