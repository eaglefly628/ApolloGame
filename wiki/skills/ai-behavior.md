# AI 行为模块知识

> 覆盖原子：ai-patrol、ai-chase、state、dialogue

## 核心原则

- 游戏 AI 不是机器学习 — 是**手写规则让 NPC 看起来聪明**。
- 三种主流方案：有限状态机（FSM）、行为树（BT）、目标导向行动规划（GOAP）。
- Apollo 的 State 组件支撑 FSM；复杂 AI 可扩展为 BT 或 GOAP。

## FSM（有限状态机）

- 最简单、最常用。每个 NPC 同一时刻只在一个状态。
- 状态转换条件基于游戏数据：距离、血量、flag、timer。
- 适合：巡逻/追击/攻击/逃跑 等状态少于 10 个的 AI。
- 缺点：状态多了以后转换条件爆炸式增长（"状态机意大利面"）。

## 行为树（Behavior Tree）

- 树形结构：Selector（选一个能跑的）、Sequence（按顺序全跑）、Leaf（具体行动）。
- 比 FSM 更好组合和复用 — 子树可以插拔。
- 适合：中等复杂度 AI（10-30 种行为的 NPC）。
- Apollo 当前不内置 BT，但可以用 State + 自定义 System 模拟。

## GOAP（目标导向行动规划）

- NPC 声明目标（"杀死玩家"）和可用动作（"移动"、"攻击"、"拾取武器"），规划器自动搜索动作链。
- 适合：高度动态的 AI（F.E.A.R. 的士兵会翻桌子掩护、包抄夹击）。
- 开发成本高，小游戏不需要。

## 巡逻（Patrol）

- state(patrol) + timer + velocity(方向切换)。
- 路径点模式：预设 waypoint 列表，到达一个后切换到下一个。
- 简单模式：左右来回走，碰墙或 timer 到时反向。

## 追击（Chase）

- spatial-query 找最近的 tag(player) → relation(target) → 朝 target 方向设速度。
- 追击距离阈值：超出范围回到 patrol。
- 避免完美追踪 — 加一点延迟或预测误差，让 AI 有"反应时间"。

## 对话（Dialogue）

- trigger-zone + state + input → 显示 Text。
- 分支对话：State 组件 track 对话进度，Action 组件接收玩家选择。
- 数据驱动：对话内容放在 JSON/Assembly 蓝图里，不硬编码。

## 常见陷阱

- AI System 执行频率不需要每 tick — 可以每 N tick 决策一次，降低 CPU 开销。
- 追击时忘记检查视线（line of sight）— NPC 穿墙追人。
- 状态切换太灵敏 — NPC 在边界条件上反复切状态。加滞后（hysteresis）。

## 参考来源

- F.E.A.R. GOAP (GDC 2006) — GOAP 的经典工业实现
- *AI for Games* (Millington) — FSM/BT/GOAP 选型的权威教材
- 模拟人生涌现叙事 (GDC) — 事件驱动的 NPC 行为涌现
