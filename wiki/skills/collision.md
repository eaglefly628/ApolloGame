# 碰撞模块知识

> 覆盖原子：overlap-detect、collision-separate、collision-bounce

## 核心原则

- 碰撞分两阶段：**宽相位**（broad phase）快速排除不可能碰的对，**窄相位**（narrow phase）精确计算穿透。
- 宽相位用空间分区（网格或 AABB 树），窄相位用 AABB 重叠检测。
- 碰撞响应和碰撞检测是两个独立 skill — 检测只输出 Overlap 组件，响应读取 Overlap 再行动。

## AABB 重叠检测

两个轴对齐矩形重叠条件：四个边界都有交集。
- overlapX = min(right1, right2) - max(left1, left2)
- overlapY = min(bottom1, bottom2) - max(top1, top2)
- 两个 overlap 都 > 0 才算碰撞
- 穿透法线取 overlap 较小的轴方向

## 分离（Separation）

- 按质量比分配推开距离：质量大的少动，质量小的多动。
- mass = 0 表示不可移动（地面、墙壁），对方承受全部推开。
- 分离公式：偏移 = normal × depth × (对方mass / 总mass)

## 弹性碰撞（Bounce）

- 反射速度 = v - 2(v·n)n × restitution
- restitution = 0：完全非弹性（贴住）；restitution = 1：完全弹性（等速反弹）
- 先做分离再做弹跳，顺序不能反。

## 碰撞层过滤

- 用 Tag 组件的 bitmask 做层过滤：只有指定 tag 组合才产生碰撞。
- 常见分层：ground、player、enemy、projectile、trigger。
- trigger 层只检测重叠，不产生物理响应。

## 常见陷阱

- 浮点精度导致"卡墙"：分离后下一帧又检测到微小穿透，反复弹跳。加一个极小的分离余量（skin width）。
- 多实体堆叠时的求解顺序：先解静态碰撞（地面），再解动态碰撞（实体间）。
- 不要在碰撞检测 System 里直接修改 Transform — 输出 Overlap 组件，由 collision-separate 统一处理。

## 参考来源

- *Real-Time Collision Detection* (Ericson) Ch.4 — AABB 碰撞的权威参考
- Box2D v3 Position Solver — 工业级分离求解
- Celeste 碰撞系统 — platformer 场景的最佳实践
- Hollow Knight — Unity 2D Physics + 自定义碰撞层
