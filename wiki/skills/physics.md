# 物理模块知识

> 覆盖原子：gravity、friction、mass

## 核心原则

- **重力是常量加速度，不是力**。直接写 `acceleration.ay += gravityValue`，不走 F=ma 积分。
- 摩擦是速度方向的反向加速度，clamp 到零（不能让摩擦把物体推回去）。
- mass = 0 表示不可移动的静态物体。碰撞时静态物体不受任何影响。

## 可变重力（Jump Feel）

platformer 的跳跃手感核心：上升和下落用不同的重力值。
- 上升阶段（vy < 0）：用较小的重力，让角色"飘"一下。
- 下落阶段（vy > 0）：用较大的重力（通常 2-3 倍），让下落更"脆"。
- 松开跳跃键时立即切到大重力 — 短按轻跳、长按高跳。

## 摩擦模型

库仑摩擦的游戏简化版：
- 地面摩擦：每 tick 把水平速度乘一个衰减系数（0.8-0.95）。
- 空中摩擦：衰减系数接近 1（几乎无摩擦），保持空中操控感。
- 注意 clamp：`if (Math.abs(vx) < threshold) vx = 0`，避免无限微小滑动。

## 常见陷阱

- 重力不要加在 accel-apply 里 — gravity 是独立 skill，写入 Acceleration 组件，由 accel-apply 统一处理。
- 不要给静态物体（mass=0）累加重力 — 它们不该受力。
- 摩擦和输入加速度的交互：摩擦在 motion-apply 之前，输入加速度在 accel-apply 时。注意执行顺序。

## 参考来源

- Celeste 跳跃调优 — 可变重力的标准实现
- Box2D v3 摩擦模型 — 库仑摩擦在碰撞接触点的实现
- *Game Physics Cookbook* (Szauer) — 简化摩擦公式推导
