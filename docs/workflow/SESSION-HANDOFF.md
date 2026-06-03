# Session 交接总结 · 2026-06-03

> 新 session 先读本文件 + `progress.md` 恢复上下文。

## 1. 技术现状

- **272 passed**，`tsc --noEmit` 干净，`npm run build` 通过。分支 `claude/mainbranch`（即默认分支）。
- **引擎**：`SystemPhase`（Update/Rotate/Resolve/PostResolve/Commit，先按 phase 分桶再组件拓扑）；
  动态 AABB 树宽相位（每帧从组件重建 → rollback 安全）；`contact.ts`（box/circle 解析 + 凸多边形 **SAT**）；
  `snapshot/restore` + 确定性 `hashSnapshot`；模拟路径只用 IEEE 确定算子（无 hypot/sin/cos）。
- **Tier 1**：accel-apply、motion-apply、lifetime、rotation-apply、animation、hierarchy-resolve（运动学/挂接收尾；counter→Macro 待定）。
- **Tier 2**：collision-resolve（顺序冲量求解器：逆质量+速度冲量+NGS 位置迭代）、ground-sense、jump、bounds-clamp、trigger-zone、friction。
- **物理**：凸多边形 SAT（仅平移；刚体旋转=接触点+力矩=Stage 2，未做）。
- **联机**：双标签页帧同步平台跳跃（`LockstepClient`+BroadcastChannel+平台世界+跳跃+斜坡），确定性逐 tick 同哈希。`main.tsx` 即此 demo。

## 2. 并行多智能体工作流 —— 实验结论（重要）

本 session 试了"5 并行"（Lead 2 + PA 3）。结论：

- **小型、低耦合任务上，并行多智能体得不偿失**：协调开销（派发 / inbox-outbox / 跨 session 同步 / 合并 / 交叉 review / 人来回纠正）**远超写代码本身**。单 agent 顺序写更快。
- **后台子 Agent 的真正价值 = 上下文隔离（省 Lead 的 context），不是提速。** 跨 session（独立 PA）= 纯协调开销，对"快任务"是负收益。
- **并行只在两种情况值得**：① 总工作量会撑爆单个 context（必须拆给各有独立 context 的子 agent）；② 单块任务本身很大（几小时，墙钟并行收益压过协调）。两者本批都不满足。
- **低耦合是双刃**：易并行，但也使顺序写很快、并行收益小。
- **实测代价**：人来回纠正分工 2 次、`1515` 测试假象排查、白扔 PA 域 3 个已跑完产物。本批 PA 最终未交付其 3 个 → Lead 自补完成（rotation/animation/hierarchy），正印证"单 agent 更快"。
- **建议默认工作模式**：Lead 单 session 顺序写小原子；后台子 Agent 仅在 context 将爆时用（纯为隔离）；inbox/outbox 更适合"跨 session 持久化/续上下文"，不适合"实时并行协作"。

## 3. 待决策 / 下一步

- **相位模型升级**：整数相位已 5 个（每个"改 Transform"的系统独占一阶段），在吃紧。建议升级为**显式 before/after 排序（runsAfter）**。Gemini review 与 Lead 均提过。
- **Stage 2 刚体旋转**：接触点（SAT + 裁剪）+ 力矩 + 转动惯量 → 方块落斜坡能转着贴合。按真实需求再上。
- **真网络联机**：把 lockstep 的 `Channel` 从 BroadcastChannel 换成 WebRTC/WS（+ 信令/NAT），`LockstepClient` 不动。
- **玩法层**：用 trigger-zone 做合作目标（开关/钥匙）；friction 让斜坡能站住。

## 4. 关键文件

- `docs/workflow/progress.md`（全局进度）
- `src/engine/core/{world,types,topological-sort}.ts`、`src/engine/spatial/{aabb-tree,contact}.ts`
- `src/tier1/*`、`src/tier2/*`
- `src/net/lockstep-tab.ts`、`src/assembly/platformer-lockstep.ts`、`src/main.tsx`
- `docs/workflow/{lead-protocol,programmer-role}.md`
