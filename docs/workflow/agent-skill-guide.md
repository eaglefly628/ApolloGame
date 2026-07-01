# Apollo · Agent / Skill 准则（怎么把工作流固化成 `.claude/` 基建）

> owner 2026-07-01 拍板：把散在 `CLAUDE.md` / `docs/workflow` / 各 session 脑子里的**角色 + 仪式**，固化成 Claude Code 可调用的 `.claude/agents`（角色）+ `.claude/skills`（仪式）。
> **这本身就很数据驱动宣言**：让 harness **直接执行**工作流配置，而不是每个 session 口头复述一遍。本文 = 建/审这些基建的准则。

---

## 0. 分层（关键：各司其职·别互相重复）

| 层 | 职责 | 谁读/触发 |
|---|---|---|
| `CLAUDE.md` | 常驻宪法 / 边界 / 铁律（每 session 必读） | 所有 session·常驻 |
| `wiki/skills/**` | 按需查的引擎开发知识库（24 模块·实现某类功能时读） | 按需 Read |
| `docs/design/**` · `docs/workflow/**` | 设计真相 / 契约 / 需求池 / 交接单（权威文档） | 引用来源 |
| **`.claude/agents/<name>.md`** | **角色人格**：system prompt + 边界 + 条件 + 工具/模型档 | 按 description 自动委派 / `@name` / `--agent` |
| **`.claude/skills/<name>/SKILL.md`** | **可调用的仪式/流程**（重复动作的可执行摘要） | 按 description 自动唤起 / `/name` |
| （相邻·后置）hooks | 用 SessionStart / pre-push 把 gate·分支纪律**自动强制** | harness 生命周期 |

**不重复原则**：agent/skill **引用**权威文档（`docs/**`、`wiki/**`），**不复制**其全文——文档更新，agent/skill 仍指向活的那份。

---

## 1. 何时建一个 Agent（角色/steward）

**判据**：一个**边界/人格独特**的角色——有自己的操作域、红线、典型任务，会被反复以「整个工作流」spawn。
- ✅ 例：`asset-manager`（资产层 steward）、`game-publisher`（发布 steward）。规划中：`lead`（评判+引擎+review）、`game-dev`（游戏=数据·不碰引擎）、`p3d`（3D 线）。
- ❌ 别为「一次性任务」或「和现有角色边界相同」建 agent。

**Agent 文件格式**（`.claude/agents/<name>.md`·经 claude-code-guide 核准）：
```yaml
---
name: kebab-case-唯一           # 必填·小写+连字符
description: 何时委派它（含触发词·中英均可·「凡碰 X → 用它」）  # 必填·驱动自动委派
color: cyan|orange|...          # 可选·任务列表显示色
# tools/model 省略 = 继承全部/会话模型（end-to-end steward 一般省略即可）
---
（body = 该角色的 system prompt·**不继承** Claude Code 主 prompt）
```

**Agent body 骨架**（照 `asset-manager.md` / `game-publisher.md`）：
1. **一句话定位** + **先读透**（指向权威文档·别凭记忆）。
2. **世界观 / 现有基建**（该域的架构锚点·别重造）。
3. **红线**（该域的硬不变量）。
4. **硬约束 · 边界 + 条件**：前置条件（满足才动手）/ 绝不 / 停下问 Lead·owner（升级）/ 收尾门禁。
5. **典型任务怎么做**。
6. **边界 + 协同**（操作域·跟谁协同·哪些改动要 Lead review）。
7. **纪律**（分支 + gate + 署名 + 机密红线·同全员）。
8. **参考**（锚点文档/代码）。

---

## 2. 何时建一个 Skill（仪式/流程）

**判据（rule-of-three）**：一个**重复出现**的可执行流程/自检。头两三次手做，第 N 次「又来了」→ 固化成 skill。
- ✅ 例：`check-ui`（2D UI 自检仪式）。规划中：`adjudicate`（CORE RULE 需求评审）、`gate`（tsc+vitest+build 认退出码）、`ship`（fetch→rebase→gate→push）、`new-capability`（按 tier 脚手架能力）。
- ❌ 别把「一段知识」做成 skill（那是 `wiki/**` / `docs/**`）；skill 是**流程**不是**读物**。

**Skill 文件格式**（`.claude/skills/<name>/SKILL.md`·目录名即 `/命令名`）：
```yaml
---
name: kebab-case
description: 这个仪式干啥 + 何时自动唤起（含触发词）   # 推荐·驱动自动唤起
when_to_use: 补充触发语境（短语/用例）              # 可选
allowed-tools: Read, Grep, Glob, Bash              # 可选·连字符!·免提示的工具
# disable-model-invocation: true → 只 /手动调；context: fork → 隔离子代理跑
---
（body = 简洁**可执行**指令·<500 行·细节 link 到 docs·别复制全文）
```
- **保持 SKILL.md 精简**：说**做什么**、不说为什么；深度细节引用 `docs/**`（progressive disclosure）。
- `` ```bash `` 里给命令**作指令**（我据情跑）；只有确要自动预跑输出才用 `` !`cmd` `` / `` ```! ``（慎用·别每次唤起就跑重活）。

---

## 3. 现有清单 + roadmap（基建也守 rule-of-three·别铺动物园）

**已落地**
- Agents：`asset-manager`（资产层）· `game-publisher`（发布→Steam）。
- Skills：`check-ui`（2D UI 自检）。

**候补（真出现第 2、3 次重复需求再加）**
- Agents：`lead` · `game-dev` · `p3d`。
- Skills：`adjudicate` · `gate` · `ship` · `new-capability` · `derot-audit` · `handoff`。

---

## 4. 通则（每个 agent/skill 都守）
- **格式先核准**：建前用 `claude-code-guide` 对齐 Claude Code 当前 agent/skill 格式，别凭记忆。
- **命名** kebab-case；**description** 带触发词、驱动自动委派/唤起。
- **引用不复制**：指向 `docs/**` / `wiki/**` 权威源。
- **同全员纪律**：分支 `claude/mainbranch`·`fetch→rebase→gate→push`·`tsc+vitest+build` 全绿才推·机密不进仓库·署名 `Claude <noreply@anthropic.com>`·信息以 session URL 结尾·产物不写模型标识。
- **落盘 `.claude/` 进版本库**（团队/多 session 共享）。
