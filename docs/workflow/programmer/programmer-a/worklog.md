# Programmer A · 工作日志

> 按 session 倒序追加。每条记录：做了什么、验证、产出位置。

---

## 2026-06-03 · Session 1 —— 上手 + 进度同步 + 下一批规划

**背景**：上手项目。发现 `docs/workflow/progress.md` 停留在「Tier 1 2/7」，而 git log 已推进到
Tier 2 物理（顺序冲量求解器 + 动态 AABB 树宽相位）+ lockstep 联机 + 可玩双人平台跳跃 demo。文档与代码脱节。

**做了什么**

1. **全局认知**：读周期表（26 原子 + Tier 1-4 涌现表 + Macro 层）、引擎核心（types / world / define-capability）、
   protocol、workflow（lead-protocol / programmer-role / session-*）、tier1 / tier2 / net 源码。
2. **同步 `progress.md`**：
   - Tier 1 修正为 **3/7**（motion-apply / accel-apply / lifetime ✅；待 rotation-apply / animation / hierarchy-resolve / counter）。
   - 新增「Tier 2 进度」「物理 / 联机 / 引擎增强（SystemPhase / aabb-tree / contact / lockstep）」段落。
   - 测试数从旧的 151 更新为实测 **228 passed / 46 files**；`tsc --noEmit` exit 0。
3. **起草下一批派发提案** → `next-batch-proposal.md`（Tier 1 收尾，3 个独立原子 3-wide）。
4. **建立本目录**（Programmer A）并经 `../outbox.md` 通知 Lead。

**验证**

- `npm install && npx vitest run` → **228 passed (46 files)**，exit 0
- `npx tsc --noEmit` → exit 0

**产出**

- 改：`docs/workflow/progress.md`
- 新：`docs/workflow/programmer/programmer-a/{README,worklog,next-batch-proposal}.md`
- 改：`docs/workflow/programmer/outbox.md`（通知 Lead）

**分支**：`claude/adoring-heisenberg-Bstre`（= cloud main branch 当前等价点，未直接动 `claude/mainbranch`）。
