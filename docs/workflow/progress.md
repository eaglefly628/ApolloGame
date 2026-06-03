# 开发进度

> Lead 每完成一批更新此文件。Programmer 读取此文件了解全局进度。
> **执行模式**：核心原子 + 引擎能力由 Lead 主程序直接实现；并行扩展两条路——
> ① Lead session 内的**后台 Agent（worktree 隔离）**；② **独立 session** 经 `inbox`/`outbox`/本文件（push 的文件）协调。

---

## 真实状态（Lead 同步 · 2026-06-03）

- 测试：**261 passed**；`tsc --noEmit` 干净；`npm run build` 通过。
- 核心 26 原子 ✅ 全部完成（表见下）。之后已大幅推进到 Tier 1/2 + 物理 + 联机。

### 引擎能力（`src/engine/core`、`src/engine/spatial`）
- **SystemPhase 调度**：`Update(0) / Rotate(4) / Resolve(10) / PostResolve(14) / Commit(20)`。
  拓扑排序「先按 phase 分桶、桶内组件拓扑」——让多个「读改写同一组件」的系统各占一阶段、不判成环。
  （每个改 Transform 的系统独占一相位：motion=Update、rotation=Rotate、collision=Resolve、hierarchy=PostResolve、bounds=Commit。）
- **动态 AABB 树宽相位**（`spatial/aabb-tree.ts`）：每帧从组件重建（纯派生 → rollback 安全），golden 测试 == 暴力。
- **接触几何**（`spatial/contact.ts`）：box/circle 解析 + 凸多边形 **SAT**；只用 `+−×÷/sqrt`（无 hypot/sin/cos）→ 跨机器确定。
- `snapshot/restore`；确定性 `hashSnapshot`；RNG 为整数 mulberry32。

### Tier 1（直接结算，`src/tier1`）
- ✅ `accel-apply`、`motion-apply`、`lifetime`
- ⏳ **派发中（Programmer A，见 inbox）**：`rotation-apply`、`animation`、`hierarchy-resolve`；`counter` 折叠为 Macro 待定。

### Tier 2（规则/感知/控制/约束，`src/tier2`）
- ✅ `collision-resolve`（顺序冲量求解器：逆质量 + 速度冲量 + NGS 位置迭代）
- ✅ `ground-sense`（落地标记）、`jump`（着地起跳）、`bounds-clamp`（世界边界）
- ✅ `trigger-zone`（进区 → `Trigger` 事件）、`friction`（接触切向阻尼）

### 物理 / 联机
- **凸多边形碰撞**（SAT，平移阶段；刚体旋转=接触点+力矩+转动惯量，待 Stage 2）。
- **双标签页帧同步平台跳跃**（`LockstepClient` + BroadcastChannel + 平台世界 + 跳跃，含三角斜坡）：
  确定性测试逐 tick 同哈希。`main.tsx` 即此 demo（开两个标签页 = 两名玩家联机）。

---

## 核心 26 原子表（批次 1–9，✅ 全部完成）

| 原子 | 组件 | 系统 |
|------|------|------|
| A1 transform / A2 hierarchy | `Transform` / `Hierarchy` | —（hierarchy-resolve 见 Tier 1） |
| B1 velocity / B2 acceleration / B3 mass | `Velocity` / `Acceleration` / `Mass` | —（纯数据） |
| C1 shape | `Shape{kind:box\|circle\|polygon, ...}` | —（纯数据；polygon 顶点供 SAT） |
| D1 overlap-detect | `Overlap{entityA,entityB,normalX,normalY,depth}` | `overlap-detect`（AABB 树宽相位 + 窄相位） |
| E1 timer | `Timer` + `TimerDone` | `timer-advance` |
| F1 resource / F2 flag | `Resource`+`ResourceModify` / `Flag` | `resource-apply` / — |
| G1 tag / G2 relation | `Tag{flags}` / `Relation` | —（纯数据） |
| H1 visibility | `Visibility` | —（纯数据） |
| I1 input-capture / I2 action-map | `RawInput` / `Action` | —（运行时/assembly 绑定） |
| J1 state | `State`+`StateChanged` | `state-sync` |
| K1 spawn / K2 destroy | `SpawnRequest` / `DestroyRequest` | —（assembly） / `destroy-apply` |
| L1–L6 render | `Sprite/Color/Frame/Sound/Camera/Text` | —（render 数据） |
| W1 random / W2 spatial-query | `RandomSeed` / `SpatialIndex` | —（`nextRandom` / `queryRange`,`queryNearest` 助手） |

## 基础设施
- **Debug**（`src/debug/`）：`Tracer`（系统前后快照 diff）+ `Recorder`/`replay`（确定性录放）。
- **渲染**（`src/renderer/`）：`collectRenderables` 引擎无关；`AsciiRenderer` / `CanvasRenderer`（已支持 box/circle/polygon）。

## 已知问题 / 运维
- **运维 · worktree 基线**：Agent worktree 从 master 空提交创建、不继承当前分支 → 派发 prompt 内置 `Step 0`（fetch+reset 到 `claude/mainbranch`）。
- **运维 · vitest 扫描 worktree**：已在 `vite.config.ts` 加 `test.exclude: ['**/.claude/**']`（`.claude/worktrees` 也已 gitignore）。集成后仍建议 `git worktree remove` 清理。
- **相位模型在吃紧**：每个「读改写 Transform」的系统都要独占一相位，整数相位已排到 5 个。后续考虑升级为**显式 before/after 排序**（Gemini review 也提过）。
- **刚体旋转待做（Stage 2）**：当前凸多边形只做平移碰撞，方块落斜坡不会转着贴合——需接触点 + 力矩 + 转动惯量。
