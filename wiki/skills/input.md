# 输入模块知识

> 覆盖原子：input-capture、action-map、controllable

## 核心原则

- 原始输入和语义动作两层分离：RawInput("KeyW") → Action("jump")。
- 输入源可替换：KeyboardInputSource、TouchInputSource、NetworkInputSource 都实现同一接口。
- MultiInputSource 合并多个源 — 本地双人各一个键盘源，联机时换成网络源，引擎代码不变。

## 输入缓冲（Input Buffering）

- 玩家在"不能跳"的帧按了跳跃键，缓冲几帧，"能跳"时自动执行。
- 实现：RawInput 带 timestamp，action-map 检查最近 N 帧内是否有该输入。
- 标准缓冲窗口：3-6 帧（60fps 下约 50-100ms）。

## Coyote Time

- 玩家离开平台边缘后几帧内仍允许跳跃 — 补偿视觉与操作的时间差。
- 实现：Grounded marker 移除后，再保留一个 coyote timer（通常 4-6 帧）。
- 和输入缓冲配合使用效果最佳。

## 触屏输入

- 虚拟摇杆：touch start 记录原点，touch move 计算偏移方向和力度。
- 点击区域：屏幕分区（左半移动、右半动作），或叠加透明按钮。
- 触屏没有"按住"和"松开"的天然反馈 — 需要视觉提示。

## 常见陷阱

- 窗口失焦时没有释放按键 — 切 tab 回来发现角色还在走。监听 blur/visibilitychange 清空输入状态。
- action-map 不要在 System 里硬编码键位 — 键位映射放 Config 组件或 Assembly 蓝图，支持自定义。
- 网络模式下输入必须标记 tick 编号 — 确定性回放依赖这个。

## 参考来源

- Celeste coyote time — 宽容时间窗的标准实现
- Apollo MultiInputSource — 本地双人到联机的无缝切换实现
- *Juice it or Lose it* (GDC 2012) — 输入手感优化的经典演讲
