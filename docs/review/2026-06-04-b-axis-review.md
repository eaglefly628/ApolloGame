# B 轴涌现基础库 · 外部 Review 结论与处置（2026-06-04）

> 评审对象：`review-for-gemini-emergence.txt`（Condition→Event→Effect + tween + 调度器 + 全局路由）。
> 两轮：① Gemini 架构级（6 个开放问题）② 代码级 reviewer（5 缺陷 + 1 亮点）。本文记结论与已做处置。

## 一、架构级（Gemini，对应导出文档 Q1–Q6）

| # | 结论 | 处置 |
|---|---|---|
| Q1 一拍反馈模型 | **确认最优**：同 tick 合链会让状态空间退化为可能不收敛的连续迭代；`Update 产/Commit 结算 + N+1 生效` 是双缓冲状态机，换 100% 时序确定性与无环。16.6ms 延迟可接受。 | 维持，无需改 |
| Q2 表达力 | **确认 YAGNI 正确**。将来要算术必须扩 `ConditionExpr`(AST 加 `MathExpr` 节点)，**坚决不用字符串迷你语言**（运行时解析开销 + GC + `eval` 在小游戏环境被禁）。 | 维持；扩展方向记录在案 |
| Q3 直接改 vs 事件 | **确认直接改正确**：走 ResourceModify 会两拍延迟（产事件→下帧消费→再下帧可读），状态流转泥泞。直接写把闭环锁在 Commit。 | 维持 |
| Q4 全局路由遮蔽 | **真隐患**：词法遮蔽——本意改全局 `hp`，宿主实体恰好带同名局部 `Resource(hp)` 会被静默改局部。 | **已修**：`ResourceModify`/`StringSet` 加 `scope?: 'local'\|'global'`（缺省 auto）。改全局态显式写 `'global'` 即不被局部遮蔽。 |
| Q5 跨 phase 定序 | **确认不支持**：phase 是宏观边界、严格单调；`runsAfter` 是桶内微观工具。跨 phase 必须只由 phase 号决定。 | 维持（现状正是跨 phase 引用忽略） |
| Q6 tween 浮点 | **极限隐患**：跨端 FMA 不一致 → 1 ULP 差异；若 tween 驱动被 Condition 读的数值（Resource.current），阈值触发会帧错位、蝴蝶效应断步。 | **已修**：从 `TweenTarget` 移除 `Resource.current`，tween 只驱动 Transform/Color（非 Condition 叶子）。逻辑数值渐变改整数分步。 |

## 二、代码级（5 缺陷 + 1 亮点）

| # | 缺陷 | 处置 |
|---|---|---|
| Bug1 | `effect-apply` set-flag 用 `Boolean(ef.value)` → `Boolean("false")===true`，开关永远关不掉。 | **已修**：`f.active = ef.value === true \|\| ef.value === 'true'`（+ 回归测试 string `"false"` → false）。 |
| Perf2 | `tween` 完成后不移除，僵尸组件每帧空赋值。 | **已修**：完成即写终值 + `removeComponent('Tween')`；测试改为断言完成后 Tween 被移除。 |
| Perf3 | `find*` 全表 O(N)，event-when 每帧 O(EventWhen×叶子×N)。 | **已修**：`buildConditionLookup`（按 id 懒加载 memo 索引，O(1)）；event-when/effect-apply 每 execute 建一次复用；resource/string-apply 全局路由也用一次性 id 索引。 |
| Perf4 | event-when 每帧 destroy/create Signal 实体 → V8 内存碎片/GC。 | **已修**：Signal 直接挂在 EventWhen 实体上，`removeComponent`/`addComponent` 清重标，规避实体增删。 |
| Perf5 | tween `comp[field]=value` 动态下标 → V8 放弃 JIT 内联。 | **已修**：`writeField` 改硬编码点号访问的 `switch`（单态写入）。 |
| 亮点 | 拓扑破环 `componentEdges[v].delete(u)`——用显式边反向擦除推断边打破 RMW 伪环。 | 保留（reviewer 激赏）。 |

## 验收
全部修复后：**348 passed，tsc 干净，build 通过**。两位 reviewer 均判定可合并主分支。
