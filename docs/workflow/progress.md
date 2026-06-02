# 开发进度

> Lead 每完成一批更新此文件。Programmer 读取此文件了解全局进度。

---

## 批次状态

| 批次 | A | B | C | 状态 |
|------|---|---|---|------|
| 1 | A1 transform | F1 resource | F2 flag | ✅ done |
| 2 | B1 velocity | E1 timer | G1 tag | pending |
| 3 | B2 acceleration | G2 relation | H1 visibility | pending |
| 4 | B3 mass | I1 input-capture | J1 state | pending |
| 5 | C1 shape | I2 action-map | K1 spawn | pending |
| 6 | A2 hierarchy | K2 destroy | W1 random | pending |
| 7 | D1 overlap-detect | L1 sprite | L2 color | pending |
| 8 | L3 frame | L4 sound | L5 camera | pending |
| 9 | L6 text | W2 spatial-query | — | pending |

## 已完成原子

| 原子 | commit | 组件 | 系统 | 测试 |
|------|--------|------|------|------|
| A1 transform | cf3ead3 | `Transform{x,y,rotation,scaleX,scaleY}` | —（纯数据） | 16 |
| F1 resource | 1c4d5ba | `Resource` + `ResourceModify` | `resource-apply`（clamp） | 12 |
| F2 flag | 92adb3b | `Flag{id,active}` | —（纯数据） | 18 |

进度：**3 / 26** 核心原子。`tsc --noEmit` 通过，`vitest` 46 passed。

## 已知问题

- **category 枚举缺 "state" 类**：Transform / Flag 是"持久可变状态"，7 类枚举（resource/event/intent/marker/config/render/effect）无完美匹配，本批统一归 `config`。待定是否给 `ComponentCategory` 增加 `state` 类。
- **运维 · worktree 基线**：Agent worktree 隔离从 master（空初始提交 `f366c5a`）创建，**不继承当前分支**。Programmer 需先 `git fetch origin claude/mainbranch && git reset --hard origin/claude/mainbranch` 再开工（本批 B/C 自行处理，A 被中断后由 Lead 从 worktree 恢复并提交）。**下批派发 prompt 必须内置此 Step 0**。
- **运维 · vitest 扫描 worktree**：`.claude/worktrees/` 下的测试副本会被 vitest 重复收集；集成后须 `git worktree remove` 清理（该目录已 gitignore）。
