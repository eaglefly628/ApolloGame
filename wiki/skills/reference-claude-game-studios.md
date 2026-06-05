# 技术参考：Claude Code Game Studios 模式分析

> **来源**: https://github.com/Donchitos/Claude-Code-Game-Studios
> **用途**: 作为 Apollo Engine 开发流程的技术参考，取其精华

---

## 一、项目概述

这是一个把 Claude Code 打造成**完整游戏开发工作室**的框架：
- **49 个专业 Agent**（三层级：总监→部门lead→专员）
- **73+ 个 Slash Command**（覆盖策划→开发→测试→发布全流程）
- **12 个 Git Hook**（自动校验提交、资产、session 生命周期）
- **11 条路径规则**（按目录强制编码规范）

支持 Godot 4 / Unity / Unreal 三大引擎，但核心价值不在引擎，而在**工作流编排**。

---

## 二、值得 Apollo 借鉴的模式

### 1. Hook 驱动的质量门禁

他们在 `.claude/settings.json` 里配了完整的 hook 链：

| 时机 | Hook | 作用 |
|------|------|------|
| SessionStart | `session-start.sh` | 初始化环境 + 检测上次 session 的间隔 |
| PreToolUse(Bash) | `validate-commit.sh` | 提交前校验代码质量 |
| PreToolUse(Bash) | `validate-push.sh` | 推送前校验 |
| PostToolUse(Write) | `validate-assets.sh` | 写入资产后自动检查完整性 |
| PostToolUse(Edit) | `validate-skill-change.sh` | 修改 skill 定义后校验 |
| PreCompact | `pre-compact.sh` | 压缩 context 前保存关键状态 |
| PostCompact | `post-compact.sh` | 压缩后恢复/校验 |
| Stop | `session-stop.sh` | session 结束时清理 |

**Apollo 可借鉴**: 我们目前没有 hook。可以加：
- `validate-commit`: 确保 `tsc --noEmit` 和 `vitest run` 通过才能提交
- `validate-assets`: 检查资产清单 `assets/index.json` 与实际文件一致
- `session-start`: 自动输出当前项目状态（分支、测试、待办）

### 2. 路径规则（Path-Scoped Rules）

他们为不同目录制定了不同的编码规范：

```
.claude/rules/
├── gameplay-code.md    → src/gameplay/ 下的代码必须遵守
├── engine-code.md      → src/engine/ 下的代码必须遵守
├── network-code.md     → src/net/ 下的代码必须遵守
├── ui-code.md          → src/ui/ 下的代码必须遵守
├── shader-code.md      → shaders/ 下的代码必须遵守
├── test-standards.md   → tests/ 下的代码必须遵守
├── data-files.md       → 数据文件的格式规范
├── design-docs.md      → 设计文档的格式规范
├── narrative.md        → 剧情文本的写作规范
├── ai-code.md          → AI 行为代码的规范
└── prototype-code.md   → 原型代码（允许放宽标准）
```

**Apollo 可借鉴**: 我们可以为不同目录设定规则：
- `src/skills/atoms/` — 每个原子必须有 defineCapability、必须有 test
- `src/assembly/` — 只允许纯数据（JSON 蓝图），不允许逻辑代码
- `docs/game-design/` — 文档格式模板

### 3. Agent 分层协作模型

三层 Agent 体系，每层用不同能力的模型：

```
Tier 1 — 总监（Opus）
  Creative Director / Technical Director / Producer
  职责：方向决策、架构审核、优先级排序

Tier 2 — 部门 Lead（Sonnet）
  Game Design Lead / Programming Lead / Art Lead / QA Lead
  职责：任务拆解、代码审查、模块设计

Tier 3 — 专员（Sonnet/Haiku）
  Gameplay Programmer / Engine Programmer / AI Programmer ...
  职责：具体实现、编写测试、修 bug
```

**Apollo 可借鉴**: 我们多 session 并行开发时（用户 + PB + 我），可以参考这个分层：
- 用户 = Producer（决定做什么、优先级）
- 主程 Session = Lead Programmer（架构、代码审查）
- 专项 Session = Specialist（具体功能实现）

### 4. Slash Command 覆盖全流程

他们的 73+ 个 skill 按开发阶段组织：

**策划阶段**: `/brainstorm` `/quick-design` `/create-epics` `/create-stories`
**架构阶段**: `/architecture-decision` `/architecture-review` `/create-architecture`
**开发阶段**: `/code-review` `/dev-story` `/test-setup`
**测试阶段**: `/bug-report` `/bug-triage` `/smoke-check` `/playtest-report`
**发布阶段**: `/release-checklist` `/launch-checklist` `/changelog` `/patch-notes`
**运维阶段**: `/tech-debt` `/perf-profile` `/security-audit`

**Apollo 可借鉴**: 我们可以建立自己的 slash command 体系：
- `/apollo-status` — 项目状态一览
- `/apollo-atom-new` — 创建新原子的脚手架
- `/apollo-blueprint-validate` — 校验蓝图 JSON
- `/apollo-game-test` — 运行游戏端到端测试
- `/apollo-gen` — 一句话生成游戏

### 5. 行为约束模式

他们的 Agent 定义里有严格的行为边界：

```markdown
## What NOT to Do:
- Make high-level architecture decisions independently
- Override game design choices
- Directly implement features (delegate to specialists)
- Modify art pipelines or build infrastructure

## Coding Standards:
- Maximum cyclomatic complexity: 10 per method
- Method length limit: 40 lines
- Dependency injection required; no static singletons
- Configuration from data files, never hardcoded
```

**Apollo 对应**: 我们的数据驱动第一性原则（`docs/design/data-driven-manifesto.md`）就是类似的约束。可以更具体化为 rule 文件。

---

## 三、他们有但我们不需要的

| 他们的设计 | 为什么 Apollo 不需要 |
|-----------|---------------------|
| 多引擎支持（Godot/Unity/UE） | 我们是自研引擎，不需要适配第三方 |
| 49 个 Agent 分工 | 我们团队小（2-3 session），过度分工反而慢 |
| 人工审批每一步 | 我们的数据驱动原则已经是更好的约束 |
| 大量模板文件 | 我们的 wiki/skills 层级知识库已经覆盖 |

---

## 四、他们没有但我们有的

| Apollo 独有 | 意义 |
|------------|------|
| ECS 原子架构（26 atoms） | 比传统 OOP 更适合 AI 组装 |
| Assembly 蓝图（纯 JSON） | 他们的游戏还是代码，我们的游戏是数据 |
| 一句话生成游戏 | 多 LLM 支持 + 蓝图校验器 |
| 确定性帧同步 | snapshot/replay/hash 验证 |
| 层级知识库（按需加载） | token 经济优化，他们没有这个概念 |
| 数据驱动第一性原则 | "游戏=数据，代码=解释器"比他们更纯粹 |

---

## 五、建议的 Apollo 行动项

按优先级排序：

### P0 — 立即可做
1. **加 Hook**: 在 `.claude/settings.json` 配 `validate-commit`（tsc + vitest 通过才能提交）
2. **加 StatusLine**: 显示当前分支 + 测试状态 + atom 数量

### P1 — 近期
3. **路径规则**: 为 `src/skills/atoms/`、`src/assembly/`、`docs/` 各写一个规则文件
4. **Slash Commands**: 建立 `/apollo-status` `/apollo-validate` 等核心命令

### P2 — 中期
5. **Session 模板**: 每次新 session 启动时自动加载项目状态和待办
6. **Code Review Skill**: 类似他们的 `/code-review`，但针对数据驱动原则做检查

---

*分析时间: 2026-06-05 · 供主程参考*
