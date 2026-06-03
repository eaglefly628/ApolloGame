# 动画模块知识

> 覆盖原子：animation (frame)、anim-state-machine

## 核心原则

- 帧动画是 timer → frame index 的直接映射：计时器 tick，到时切下一帧。
- 动画状态机管理"什么时候播什么动画"：state(idle/run/jump) + 转换规则 + 对应动画。
- 动画数据和游戏逻辑完全分离 — 动画 System 只读 State 和 Timer，不写 Velocity 等游戏组件。

## 帧动画

- Frame 组件：{ index, total }。每次 Timer 触发，index = (index + 1) % total。
- 播放速度通过 Timer.duration 控制，不是通过跳帧。
- 非循环动画：播到 total-1 停止，发出 TimerDone 事件。

## 动画状态机

- 每个状态绑定一个动画序列。
- 转换规则基于游戏状态：grounded + vx!=0 → run，!grounded → jump，vx==0 → idle。
- 转换时重置 Frame.index = 0。
- 双轨道混合：身体动画 + 表情动画可以独立控制（用不同的 fsmId）。

## 骨骼动画（扩展层）

- **Spine**：骨骼 + 插值，适合动作类（Hollow Knight、Dead Cells、Hades）。
  - 集成方式：Spine 输出姿态快照 → 写入扩展组件 → 渲染层读取。
- **Live2D**：网格变形，适合少量高品质立绘（明日方舟、碧蓝航线、乙游）。
  - 集成方式：参数快照模式，每帧把 ECS 状态映射为 Live2D 参数。
  - 性能注意：一个 Live2D 模型的开销远大于 Spine，同屏数量有限。

## 常见陷阱

- 动画切换时忘记重置帧计数器 — 导致新动画从中间帧开始播。
- 状态机转换条件写太宽松 — 导致动画在两个状态间快速抖动。加一个最小停留时间。
- 不要用动画 System 驱动游戏逻辑（"攻击帧到了才出伤害"）— 应该反过来，用 Timer 事件触发伤害，动画只是视觉表现。

## 参考来源

- *Game Programming Patterns* Ch.14 Type Object — 帧动画的数据驱动设计
- Hollow Knight 动画状态机 — 双轨道混合的实战参考
- Spine AnimationState API — 骨骼动画集成的标准接口
