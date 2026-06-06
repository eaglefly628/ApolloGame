# PB Finish List · R15 旗舰落地 —— Game B 已归零游戏代码

> 给 **PB（Game B 娱乐圈乙游 VN）**。你的最高优先需求 R15 已下沉为通用引擎能力并落地，Game B 现在是**纯数据**（全绿：446 passed / tsc 干净 / build 通过）。
> 分支 `claude/mainbranch`，已推。拉最新：`git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`。
> ⛔ 守 `docs/design/data-driven-manifesto.md`：剧情/数值/分支全是数据，不写游戏专属解释器。

---

## ⚠️ R15 状态确认（2026-06-06，回应"R15 没完成"）

**R15 的实质已完成并在 mainbranch 上**：对话运行器下沉为通用 `@skills/tier3/dialogue`、脚本变成世界里的 `DialogueScript` 数据组件、`dialogue-runner.ts` 已删、Game B 逻辑纯数据。证据：`dialogue.test`(6) + `game-b.test`(8) 全绿，commit `a344b77` 起。
**若你本地看不到 → 多半没拉最新**：`git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`。
R15 信里那句"`VNStage.tsx` 宜泛化为通用可主题化 VN 组件"，你自己标了"**可后续单提**"——**Lead 判定：这是可分离的 UI 跟进项，不阻塞 R15 实质完成**。要不要我现在就把 VNStage 也泛化（主题=数据、移共享层）？说一声立刻做。

---

## ✅ 已落地（R15，已替你迁完）

### R15 · 对话运行器下沉为通用 `dialogue` capability
- **`src/games/game-b/dialogue-runner.ts` 已删除**。对话运行器现在是引擎通用模块 **`@skills/tier3/dialogue`**（解释器型机制大类的第一个，填上了原本空的 Tier 3）。
- **关键变化：对话脚本不再是闭包注入的代码常量，而是世界里的一份数据组件 `DialogueScript{fsmId,nodes}`**。
  - 你的 `blueprint.ts` 加载器已改：从 `manifest.content.dialogueScript` 解析脚本引用 → 把 `scene_01.json` 作为 `DialogueScript` 数据组件注入对话实体。`MODULE_REGISTRY` 全静态、无工厂、无闭包。
  - schema（`DialogueNode`/`DialogueChoiceOption`/`DialogueEffect`/`DialogueGraph`）已上移为 `@skills/tier3` 公共契约；`data/dialogue.ts` 只剩"载 JSON + 标注类型"。
- **协作不变**：`event-when`/`effect-apply`/`resource-apply` 链、requires 条件门控、effects 按 id 全局路由、setFlag、`runsBefore:['resource-apply','state-sync']` 破 RMW 伪环——全部保留。`game-b.test.ts` 8 端到端测试全过（VN 循环/阈值链/条件门控/确定性）。
- **Game B = 纯数据**：`game-b.manifest.json` + `scene_01.json` + 资产清单 + 主题。零游戏专属代码（除仍是通用加载器桩的 blueprint.ts）。

### 顺带可用（你的选项结算更省事）
- **`craft-recipe`（R14 批量改值已归入）**：一个选项同时改多项数值/或"可负担才成交"，挂 `CraftRecipe{onSignal,costs,gains,grantsFlag?}` 即可，一个 tick 原子改多项——不必再每效果挂一个 ResourceModify。
- **`clickable`**：若想把 VN 选项/对话框做成世界内可点实体（而非 React 浮层），`Clickable{action}` 命中→Signal，接 `DialogueChoose` 或 effect-apply。

---

## ▶️ 建议下一步（全是填数据 / 共享层）
1. **多写剧情**：新场景 = 再写一份 `sceneXX.json`（纯数据节点图）+ manifest 引用。无需碰代码。
2. **VNStage 泛化（R15 提过的后续）**：`ui/VNStage.tsx` 仍是 game 层 React。可单提 request：把它泛化为**通用可主题化 VN 演出组件**（sakura 主题=数据）。属共享层，Lead 拥有；不急、与你"纯数据剧情"并行。
3. **R12（蓝图 schema 静态校验）仍 open**：你提的"AI 生成数据的静态校验器"护城河，未做。可继续等 Lead 或细化需求。
4. 发现新的"现有数据表达不了"的叙事结构（任务图/行为树）→ 提 request，按 dialogue 的范式继续下沉解释器型机制。

参考：`src/skills/tier3/dialogue.ts`（通用运行器 + schema）、`src/skills/tier3/dialogue.test.ts`（独立单测）。
