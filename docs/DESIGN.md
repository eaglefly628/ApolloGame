# Apollo Engine — Technical Design Document v1（历史/已分叉，2026-06-07 归档为摘要）

> ⚠️ **这是最早期的技术设计 v1，项目实际走向与它的「具体方案」已大幅分叉。**
> 原文（767 行，含 Phaser 后端 / 回合制战斗 demo / health·combat·turn capability 等**从未按此实现**的设计）保留在 **git history**。此处只留"当初设想 → 实际落地了什么"的对照摘要，避免误导接手者。
> **当前真相**：宪法 `docs/design/data-driven-manifesto.md`、现状 `docs/workflow/SESSION-HANDOFF.md`、以及自描述的代码（`src/engine/core/define-capability.ts`、`src/engine/protocol/components.ts`）。

---

## 当初设想（v1）
自然语言 → AI 组装游戏逻辑 → **Phaser** 渲染 → 可玩游戏；MVP = 一个 **Phaser 渲染的回合制战斗 Demo**，4 个自描述 capability（health / combat / turn / render-bridge）端到端跑通。

## 实际落地 vs 放弃（对照）

| v1 设想 | 现状 | 说明 |
|---|---|---|
| **Phaser 3** 渲染后端 + `phaser-backend.ts` | **CanvasRenderer**（Canvas2D，`src/renderer/`） | 经 `collectRenderables` 引擎无关投影；Phaser 虽在依赖里但游戏未用。`RendererBackend` 接口预留思想保留。 |
| **回合制战斗 demo**：health/combat/turn capability | **26 原子 + Tier1/2/3 能力 + 三游戏**（平台/VN/三消） | 战斗 demo 从未实现；能力体系完全不同。 |
| `assembly/demo.world.ts` | `src/assembly/demo.assembly.ts` + **Manifest 桥接** | 蓝图概念延续，并进化为可导入导出的规范 manifest。 |
| `.apollo/registry.json` 自描述索引 | 已 gitignore，未成主路径 | 自描述元数据改为活在 `defineCapability.describe`（被透视器/校验器消费）。 |
| React DOM overlay UI | 仍用 React（launcher/studio），ECS→渲染单向 | 这条思想保留。 |

## 仍然成立、被延续的设计决策
- **ECS over OOP**：AI 可读 / 可组合 / 可拓扑排序 —— 项目的根基。
- **Descriptor 内联在 capability（单一真相源，不与代码脱节）** —— 即今天的 `defineCapability.describe`，被数据透视器 + R12 校验器消费。
- **ECS → 渲染 单向同步**（渲染器只是画笔，不持状态）—— 确定性边界的一部分。
- **SystemPhase + 拓扑排序调度**（多个读改写同组件的系统各占相位/显式 runsAfter）—— 已实现并演进。

> 已放弃/不再适用：Phaser 主后端、回合制战斗题材、JSON registry 索引、微信换 Cocos Backend 的具体计划。需要原始全文请查 git history（本文件 2026-06-07 之前的版本）。
