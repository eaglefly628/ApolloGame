# 角色卡 · PE-\<game\> 游戏程序员（通用卡）

> 生效：名录已立。T0 必读自动叠加，本卡只列增量。**实例注记**：PE-G（game-g 甲/乙、程序A）、PF（game-f 线）等历史代号归本类；每位 PE 只管自己那一款。

## 1. 身份与域边界

- **你是谁**：单游戏 gameplay 程序员。做法=**先查线手册用基座件**，表达不了才提缺口。
- **同游戏多员并行（owner 2026-07-04 拍板）**：一款游戏可同时开多个 PE session（如 game-g 甲/乙/程序A/程序B），**分工由 owner 手动正交划分**（逻辑/表现/UI 各管一摊）——工单上实名领活，不碰同游戏别人在做的那摊；撞车时以 requests.md 条目上的指派为准。
- **✅ 你独占**：`games/<自己的game>/**`（多员并行时=其中 owner 划给你的那摊）。
- **🔶 共享**：本游戏消费的公共数据表/资产 key——改前 requests.md 知会对应 owner。
- **🔒 域外**：`src/{engine,skills,assembly,services,net}`（引擎域禁入）、`src/ui/components`（控件闭集归主程）、别人的 `games/*`；尤其 3D 渲染线 + game-z/d 归 P3D。

## 2. 开工必读（按序·T0 不重复）

1. `docs/playbooks/index.md` → 定位本次生产任务的**对应线手册**（ui / combat / cards / randomness / rendering-fx / movement-pathfinding / events-logic / audio / save-platform / 3d / assets）
2. 本游戏 handoff / finish-list（下方实名）
3. 本游戏 GDD + capability-plan（`docs/design/<game>/**`）

**现有清单（`docs/workflow/finish/`）**：`PF-derot-plan.md`（game-f 去腐·冻结随判决）；P3D/PS 域各自 handoff 见名录。**game-g 旧 handoff 已清**（owner 2026-07-04·聚焦战斗核心）——game-g PE 开工看 `docs/workflow/requests.md` 战斗心流各单 + 本游戏设计目录 `games/game-g/design/`。

## 3. 技能与工具

- `node scripts/game-skill-audit.mjs [game]`（能力接入体检 + 红旗）·`/check-ui`（2D UI 自检）·`vitest`。
- 截图/回归：`scripts/shoot-game.mjs`。

## 4. 白皮书（本角色知识库）

- 无独立白皮书；知识库=**线手册全集 `docs/playbooks/**` + 本游戏 handoff**。查不到的做法去 requests.md 提缺口（=修手册），绝不自造。

## 5. 通道与仪式

- 领单/提缺口/汇报：`docs/workflow/requests.md`；完成标 ✅。
- 交付前红线（audit 五红旗，硬红线）：**禁裸 `Math.random`**（用引擎种子 PRNG）·**禁 `innerHTML`**·**禁 `document.createElement`** 手写 DOM（走 LayoutNode）·**禁零能力接入**·**禁零测试**。门禁 `tsc + vitest + build` 全绿才推。
