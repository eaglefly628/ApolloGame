# 空间查询模块知识

> 覆盖原子：spatial-query、range-detect、trigger-zone

## 核心原则

- 空间查询回答"某点/范围附近有哪些实体"— 不是碰撞检测，是信息检索。
- 用空间索引加速：网格分区 O(1) 查邻居，暴力遍历 O(n) 不可接受。
- trigger-zone 是 overlap + tag 过滤 + 事件触发，不产生物理推开。

## 网格分区（Grid Partition）

- 世界划分为固定大小的格子（cellSize），每个实体按 Transform 位置归入格子。
- 查询时只检查目标格子及相邻格子 — O(1) 时间复杂度。
- cellSize 选择：大于最大实体的碰撞半径，小于最小查询范围。通常 64-128 像素。
- 每帧重建 vs 增量更新：实体少（<1000）全量重建更简单；实体多用增量。

## AABB 树（动态）

- 另一种空间索引：平衡二叉树，叶节点是实体 AABB，内部节点是合并 AABB。
- 查询用 AABB 重叠测试从根往下剪枝。
- 适合实体大小差异大的场景（大 boss + 小子弹共存）。
- ZeroCraft 已有 `src/engine/spatial/aabb-tree.ts` 实现。

## 范围检测（Range Detect）

- spatial-query(圆心, 半径) → 返回范围内所有实体。
- 加 Tag 过滤：只关心 tag(enemy) 的实体。
- 用途：自动索敌（auto-target）、技能范围、爆炸伤害。

## 触发区域（Trigger Zone）

- 一个不可见实体，有 Shape 但不产生物理响应。
- overlap-detect 检测到进入 → 发出事件（开门、对话、剧情触发）。
- 用 Tag.flags 的 trigger 位标记，碰撞 System 跳过物理响应。

## 常见陷阱

- 网格 cellSize 太小 → 一个实体跨多个格子，查询反而变慢。
- 空间索引在实体移动后没更新 → 查询结果是上一帧的位置。确保在 motion-apply 之后重建索引。
- range-detect 不要每 tick 对所有实体查 — 只对有 "range-detect" 需求的实体查。

## 参考来源

- Factorio 空间分区 — 百万实体级网格分区优化
- *Real-Time Collision Detection* (Ericson) Ch.7 — 空间分区数据结构
- ZeroCraft aabb-tree.ts — 当前项目的 AABB 树实现
