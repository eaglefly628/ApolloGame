# 工作流零件 QA 层（docs/qa/）

> 2026-07-04 立（owner 拍板「CCGS 可直接 copy 的直接操作」）。移植自 CCGS Skill Testing Framework 的**行为 spec 骨架**（源料 `docs/ref/`），按 ZeroCraft 形态改造：无 director 门、无 May-I-write；判词=闭集 token、门禁=退出码、域边界=角色卡/handoff。

## 这里放什么

- **模板**：`skill-spec-template.md`（技能）· `agent-spec-template.md`（子代理）。
- **spec**：`specs/<零件名>.md`——我方每个 `.claude/skills/*` 与 `.claude/agents/*` 一份行为 spec（5 测例含失败路径 + 静态断言 + Coverage Notes）。
- 机器侧守护（路径核真/测试卫生）见 `scripts/`（REQ-DOCS-指针守护 / REQ-QA-三件）。

## 使用规则（CCGS 原则照抄·两条）

1. **spec 描述现状行为，不是理想行为**——它可能编码了 bug。零件实际行为与 spec 不符 = 「待调查」而非「零件必错」：先修零件，再改 spec 对齐修后行为。
2. **改零件（SKILL.md / agent .md）前先读它的 spec**；改完对照 5 测例走查一遍，行为变了就同提交更新 spec——spec 与零件不同步=本层失职。

## 边界

- 只测**工作流零件**（skill/agent 的行为契约），不测游戏（游戏走 `docs/playbooks/testing.md` 测试线）、不测引擎 capability（走 vitest + registry-guard）。
- 零件数量少（现 2 技能+2 代理），**不建 catalog**——本目录文件列表即清单；上两位数再议登记表。
