# 下一批派发提案 · Batch T1-完结（Tier 1 收尾）

> 起草人：Programmer A · 2026-06-03 · 状态：**待 Lead / 用户审阅后派发**
> 依据：`wiki/atom-skill-periodic-table.md` Tier 1 表 + `docs/workflow/lead-protocol.md` 派发协议

---

## 为什么是这一批

Tier 1（直接结算）还差 4 个：rotation-apply / animation / hierarchy-resolve / counter。
其中前 3 个**彼此独立**（各自独立文件 + 独立测试），且复用的组件（`Velocity`/`Transform`/`Timer`/`Frame`/`Hierarchy`）
**全部已存在于 `protocol/components.ts`**，本批**无新增共享组件 → 几乎零合并冲突**。
→ 正好 **3-wide** 并行（架构甜点区）。`counter` 只是 `resource(min=-∞,max=+∞)` 的特化，
拟作为 Macro/config 折叠，不单独占一个 Programmer，留到下一轮处理。

> 并行度说明：本批是独立原子，3-wide 最优。等回到 Tier 2 强耦合物理（collision-bounce / gravity / friction 等）时应降到 2-wide。

---

## 前置（Lead 执行）

1. **集成 Programmer A 分支**：把本次 progress 同步 + 本提案合入 cloud main branch（`claude/mainbranch`），
   使下面 3 个 worktree 的基线包含最新 progress.md。
2. **无需写新 protocol 接口**——本批复用既有组件，protocol/components.ts 不动。

---

## 三个并行任务

| Programmer | 原子 | reads → writes | phase | 关键点 |
|-----------|------|----------------|-------|--------|
| **A** | rotation-apply | `Velocity.angular` → `Transform.rotation` | Update(0) | motion-apply 的旋转镜像，纯积分 |
| **B** | animation | `TimerDone` + `Frame` → `Frame.index` | Update(0) | 计时器到点推进帧；`index = (index+1) % total`，loop |
| **C** | hierarchy-resolve | `Hierarchy` + parent `Transform` → child `Transform` | **Resolve(10)** | 读父写子，组件图会自环 → 必须排到 Resolve 阶段；内部按父链深度排序（先根后叶） |

### 设计提示

- **A / rotation-apply**：与 motion-apply 对称。`transform.rotation += velocity.angular`（注意与 fixed-step 的 dt 约定保持一致，参考 `motion-apply` 现有实现）。
- **B / animation**：`Frame{index,total}` + `Timer` 通常挂同一实体。`timer-advance` 在 Update 阶段产出 `TimerDone`，animation 读/消费 `TimerDone` → 组件拓扑自动把它排在 timer-advance 之后，缺省 phase 即可。
- **C / hierarchy-resolve**：这是本批唯一有顺序陷阱的。它读 `Transform`（父）又写 `Transform`（子），在纯组件图上互为前驱会判成环——这正是 `SystemPhase` 存在的理由（参考 `collision-resolve` 用 `Resolve`）。系统内部需先处理根、再处理子（按 `Hierarchy.parentId` 链拓扑），多级嵌套要一次解算到位。

---

## 派发模板（Lead 复制即用）

> 三个 Agent 在**同一条消息**中并行派发（`run_in_background: true` + `isolation: "worktree"`）。
> ⚠️ 已内置 **Step 0 基线重置**（worktree 从 master 空提交创建，不继承当前分支——见 progress.md 已知问题）。

```
Agent({
  description: "Programmer {X}: {atom-name}",
  isolation: "worktree",
  run_in_background: true,
  prompt: `
你是 Apollo Engine 的 Programmer {X}。

## Step 0 · 基线（必须先做）
git fetch origin claude/mainbranch
git reset --hard origin/claude/mainbranch

## 你的任务
实现 Tier 1 原子：{atom-name}（{reads} → {writes}，phase={phase}）

## 全局上下文（先读）
- wiki/atom-skill-periodic-table.md —— Tier 1 表，定位 {atom-name} 的公式
- docs/workflow/programmer-role.md —— 编码规范 / defineCapability 格式 / 自检清单
- src/engine/core/types.ts —— IWorld、SystemDeclaration、SystemPhase
- src/engine/core/define-capability.ts —— defineCapability 模式
- src/engine/protocol/components.ts —— 共享组件（本批组件已存在，勿改）
- src/tier1/motion-apply.ts —— 同层参照实现（命名 / dt 约定 / 测试风格）

## 交付物
1. src/tier1/{atom-name}.ts —— defineCapability() 实现
2. src/tier1/{atom-name}.test.ts —— vitest（默认值 / 核心计算 / 边界：零值·多级·loop 环绕）
3. 在 src/tier1/index.ts 导出（仅追加你这一行，减少与同批冲突）

## 约束
- 纯 ECS 数据 + 系统，无副作用；组件是 POD
- 只用 world.query / getComponent / addComponent；不引入外部依赖
- 不改 protocol/components.ts（本批复用既有组件）
- 完成后跑：npx tsc --noEmit && npx vitest run
- commit message 以 [Programmer {X}] 开头
`
})
```

逐 Programmer 替换：

- **A**：`{atom-name}=rotation-apply` · `{reads}=Velocity.angular` · `{writes}=Transform.rotation` · `{phase}=Update`
- **B**：`{atom-name}=animation` · `{reads}=TimerDone+Frame` · `{writes}=Frame.index` · `{phase}=Update`
- **C**：`{atom-name}=hierarchy-resolve` · `{reads}=Hierarchy+Transform(parent)` · `{writes}=Transform(child)` · `{phase}=Resolve`

---

## 收口（Lead）

1. 三个通知到齐 → 交叉 review（A→B, B→C, C→A，参考 lead-protocol 模板）
2. `npx tsc --noEmit && npx vitest run` 全绿
3. 合并 3 个 worktree → 清理 `git worktree remove`（vitest 会重复收集 worktree 副本）
4. 更新 `progress.md`：Tier 1 → **6/7**（counter 留作 Macro）
5. 下一轮候选：counter 折叠为 Macro + 开启 Tier 2 余下组合（建议降到 2-wide）

---

## 验收标准（每个原子）

- [ ] 组件字段与周期表 Tier 1 公式一致
- [ ] reads/writes/consumes/phase 声明正确
- [ ] 测试覆盖：默认值 + 核心计算 + 边界（零值 / 负值 / 多级嵌套 / loop 环绕）
- [ ] `npx tsc --noEmit` exit 0 且 `npx vitest run` 全绿
- [ ] commit message 含 `[Programmer X]`
