# Session 交接总结 · 2026-06-03

> 新 session 先读本文件 + `progress.md` 恢复上下文。
>
> **工作目录 = `MemBrain`**（本地 clone 目录名）；GitHub 远端仓库是 `eaglefly628/ApolloGame`。
> 看到 cwd 是 `MemBrain` 而 git remote 是 `ApolloGame` 属正常,别当成走错仓库。

## 1. 技术现状

- **286 passed**，`tsc --noEmit` 干净，`npm run build` 通过。分支 `claude/mainbranch`（即默认分支）。
- **目录结构（2026-06-04 重组）**：所有 skill 收拢到 `src/skills/{atoms,tier1,tier2,tier3,tier4}`（tier3/tier4 占位待 request 拉动）。别名 `@skills/*`、`@atom-skills/*`(→skills/atoms)、`@assets/*`。见 `src/skills/README.md`。
- **资产系统（新，表现层）**：`src/assets/` —— `AssetManager` + 可插拔 loader（Stub/Image），描述符分 4 kind（texture/atlas/sprite-sheet/**prerendered-sequence=3D→2D 离线一等公民**），统一归约为「源图+子矩形」。只按 string key 工作、不碰 snapshot → lockstep 安全。3D→2D 的门已留宽（不接 3D 工具链）。`CanvasRenderer` 可选接入。
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

## 协作模型 v2（已敲定 —— 取代上面的"并行 skill programmer"）

不再"把 skill 任务传来传去"（那是过度设计）。新分工：

- **Lead（主程，本 session 角色）= 引擎 owner**：只接需求、实现/扩展引擎、守护确定性与契约、收敛重复需求为通用原子。
- **Game Creator PA / PB = 引擎使用者**：各做一个小游戏；引擎做不到时**提需求**（写 `requests.md`），**不自己改引擎**。
- **为什么这才是"对的并行"**：游戏 vs 引擎是不同 context、只通过"需求"窄接口耦合、两个不同游戏多样化压测引擎（需求被真实游戏拉动，避免 YAGNI）。
- **边界**：引擎/共享层（`engine/**`、`skills/**`（atoms+tier1-4）、`assets/**`、`protocol`、`SystemPhase`）只接需求（可附建议补丁，**Lead 是合并闸门**）；游戏层 PA/PB 完全自由。
- **新 Lead session 开局**：读本文件 + `game-creator-role.md`（发给 PA/PB）+ `requests.md`（需求池），然后等 PA/PB 的需求来驱动引擎演化。

## 3. 待决策 / 下一步

- **相位模型升级**：整数相位已 5 个（每个"改 Transform"的系统独占一阶段），在吃紧。建议升级为**显式 before/after 排序（runsAfter）**。Gemini review 与 Lead 均提过。
- **Stage 2 刚体旋转**：接触点（SAT + 裁剪）+ 力矩 + 转动惯量 → 方块落斜坡能转着贴合。按真实需求再上。
- **真网络联机**：把 lockstep 的 `Channel` 从 BroadcastChannel 换成 WebRTC/WS（+ 信令/NAT），`LockstepClient` 不动。
- **玩法层**：用 trigger-zone 做合作目标（开关/钥匙）；friction 让斜坡能站住。

## 4. 关键文件

- `docs/workflow/progress.md`（全局进度）
- `src/engine/core/{world,types,topological-sort}.ts`、`src/engine/spatial/{aabb-tree,contact}.ts`
- `src/skills/{atoms,tier1,tier2,tier3,tier4}/*`（见 `src/skills/README.md`）
- `src/assets/*`（资产系统：asset-manager / asset-types / image-loader）
- `src/net/lockstep-tab.ts`、`src/assembly/platformer-lockstep.ts`、`src/main.tsx`
- `docs/workflow/{lead-protocol,programmer-role}.md`
