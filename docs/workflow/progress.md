# 开发进度

> Lead 每完成一批更新此文件。Programmer 读取此文件了解全局进度。
> **执行模式**：Tier 1 核心原子由 Lead 主程序直接实现；Programmer 派发工作流（后台 Agent / inbox-outbox）留给 Tier 2 组合层。

---

## 批次状态

| 批次 | A | B | C | 状态 |
|------|---|---|---|------|
| 1 | A1 transform | F1 resource | F2 flag | ✅ done |
| 2 | B1 velocity | E1 timer | G1 tag | ✅ done |
| 3 | B2 acceleration | G2 relation | H1 visibility | ✅ done |
| 4 | B3 mass | I1 input-capture | J1 state | ✅ done |
| 5 | C1 shape | I2 action-map | K1 spawn | ✅ done |
| 6 | A2 hierarchy | K2 destroy | W1 random | ✅ done |
| 7 | D1 overlap-detect | L1 sprite | L2 color | ✅ done |
| 8 | L3 frame | L4 sound | L5 camera | ✅ done |
| 9 | L6 text | W2 spatial-query | — | ✅ done |

## 已完成原子

| 原子 | 组件 | 系统 | 测试 |
|------|------|------|------|
| A1 transform | `Transform{x,y,rotation,scaleX,scaleY}` | —（纯数据） | 16 |
| A2 hierarchy | `Hierarchy{parentId,localX,localY,localRotation,localScaleX,localScaleY}` | —（resolve 属 Tier 1） | 4 |
| B1 velocity | `Velocity{vx,vy,angular}` | —（纯数据） | 4 |
| B2 acceleration | `Acceleration{ax,ay}` | —（纯数据） | 4 |
| B3 mass | `Mass{value}` | —（纯数据） | 4 |
| C1 shape | `Shape{kind,width?,height?,radius?}` | —（纯数据） | 5 |
| D1 overlap-detect | `Overlap{entityA,entityB,normalX,normalY,depth}` | `overlap-detect`（AABB/圆相交） | 5 |
| E1 timer | `Timer{id,elapsed,duration,loop}` + `TimerDone` | `timer-advance`（tick 计数，fire-once/loop） | 7 |
| F1 resource | `Resource` + `ResourceModify` | `resource-apply`（clamp） | 12 |
| F2 flag | `Flag{id,active}` | —（纯数据） | 18 |
| G1 tag | `Tag{flags}` bitmask | —（纯数据） | 5 |
| G2 relation | `Relation{kind,targetId}` | —（纯数据） | 3 |
| H1 visibility | `Visibility{visible,active}` | —（纯数据） | 4 |
| I1 input-capture | `RawInput{source,key?,x?,y?,phase?}` | —（运行时注入） | 4 |
| I2 action-map | `Action{name,value}` | —（绑定属 assembly） | 3 |
| J1 state | `State{fsmId,current,previous}` + `StateChanged` | `state-sync`（切换检测） | 4 |
| K1 spawn | `SpawnRequest{templateId,x,y}` | —（spawner 属 assembly） | 3 |
| K2 destroy | `DestroyRequest{entityId}` | `destroy-apply`（移除实体） | 3 |
| L1 sprite | `Sprite{textureKey,anchorX,anchorY,zOrder}` | —（render 数据） | 4 |
| L2 color | `Color{tint,alpha}` | —（render 数据） | 4 |
| L3 frame | `Frame{index,total}` | —（render 数据） | 4 |
| L4 sound | `Sound{clipId,volume,loop}` | —（render 数据） | 4 |
| L5 camera | `Camera{zoom,offsetX,offsetY,rotation,viewportW,viewportH}` | —（render 数据） | 4 |
| L6 text | `Text{content,fontSize,fontFamily,anchor,lineSpacing}` | —（render 数据） | 4 |
| W1 random | `RandomSeed{seed,sequence}` + `nextRandom()` 助手 | —（按需取数） | 5 |
| W2 spatial-query | `SpatialIndex{cellSize,kind}` + `queryRange/queryNearest` 助手 | —（按需查询） | 5 |

进度：**26 / 26** 核心原子 ✅ 全部完成。`tsc --noEmit` 通过，`vitest` 144 passed（含 demo 集成），`npm run build` 通过。

## 已知问题

- **category 枚举缺 "state" 类**：Transform / Flag 是"持久可变状态"，7 类枚举（resource/event/intent/marker/config/render/effect）无完美匹配，本批统一归 `config`。待定是否给 `ComponentCategory` 增加 `state` 类。
- **运维 · worktree 基线**：Agent worktree 隔离从 master（空初始提交 `f366c5a`）创建，**不继承当前分支**。Programmer 需先 `git fetch origin claude/mainbranch && git reset --hard origin/claude/mainbranch` 再开工（本批 B/C 自行处理，A 被中断后由 Lead 从 worktree 恢复并提交）。**下批派发 prompt 必须内置此 Step 0**。
- **运维 · vitest 扫描 worktree**：`.claude/worktrees/` 下的测试副本会被 vitest 重复收集；集成后须 `git worktree remove` 清理（该目录已 gitignore）。
- **数据型原子无系统**：input-capture / action-map / spawn 只定义组件契约（systems 为空）——其行为（DOM 捕获、按键→动作绑定、模板实例化）依赖运行时/assembly，非通用纯 ECS 逻辑。对比 destroy 有 `destroy-apply`（移除逻辑通用、无需注册表）。
- **SpatialIndex 字段重命名**：周期表写 `type: 'grid'|'quadtree'`，但 `type` 是引擎 Component 判别字段（保留），故重命名为 `kind`（与 Shape.kind 一致）。
- **接线 + demo 已完成**：26 原子统一导出于 `src/atom-skills/index.ts`；`demo.assembly` 用真实 Engine 跑通"子弹飞行 → 撞墙检测 → 寿命自毁"，`demo.integration.test` 验证拓扑协作，`npm run build` 通过。
- **Tier 1 涌现层进度 2/7**：已实现 `motion-apply`、`lifetime`（demo 所需，置于 `src/tier1/`）；待实现 rotation-apply / accel-apply / animation / hierarchy-resolve / counter。
