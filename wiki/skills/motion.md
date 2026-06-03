# 运动模块知识

> 覆盖原子：motion-apply、accel-apply、hierarchy-resolve

## 核心原则

- **半隐式欧拉积分**：先更新速度（v += a），再更新位置（p += v）。顺序不能反。
- 定步长 tick：所有运动按固定 tick 推进，不用 dt 乘法。World 没有 deltaTime 概念。
- 整数/定点坐标优先：浮点数会累积漂移，确定性重放时两端不一致。能用整数就不用浮点。

## 编码约定

- motion-apply 只做一件事：把 Velocity 加到 Transform 上。不做边界检查、不做碰撞。
- accel-apply 只做一件事：把 Acceleration 加到 Velocity 上。不做重力（重力有单独 skill）。
- hierarchy-resolve 用脏标记 + 延迟求解：只有父级 Transform 变了才重算子级。

## 子步进（Sub-stepping）

高速物体（子弹）一帧移动距离可能超过自身体积，导致穿透。解决方案：
- 把一次大位移拆成多次小位移，每步做碰撞检测。
- 或用射线检测（raycast）代替离散位移。
- Apollo 当前用离散步进，高速场景需加子步进。

## 常见陷阱

- 不要用 `Math.hypot` — 它在不同平台实现不同，破坏确定性。用 `Math.sqrt(x*x + y*y)`。
- 不要在 motion-apply 里读 Acceleration — 职责分离，accel-apply 负责。
- hierarchy 的矩阵乘法不要每帧全量算 — 用脏标记判断是否需要更新。

## 参考来源

- Celeste 整数物理：platformer 手感的黄金标准
- *Game Programming Patterns* Ch.2 Game Loop：定步长循环设计
- *Game Physics Engine Development* (Millington) Ch.3：显式 vs 半隐式欧拉对比
