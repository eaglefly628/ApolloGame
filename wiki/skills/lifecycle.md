# 生命周期模块知识

> 覆盖原子：spawn、destroy、timer、lifetime

## 核心原则

- 实体的创建和销毁都是**请求制**：写入 SpawnRequest / DestroyRequest 组件，由专门 System 统一执行。
- 不要在 System 逻辑中直接调 world.createEntity / world.removeEntity — 破坏执行顺序确定性。
- Timer 按 tick 计数，没有 dt — `elapsed++` 每 tick 加一，到 duration 发出 TimerDone。

## 对象池（Entity Pooling）

- 频繁 create/destroy 会产生 GC 压力（子弹、粒子、伤害数字）。
- 池化方案：destroy 时不删除实体，设 visibility.active = false；spawn 时优先从池里取。
- 复用时必须重置所有组件到初始值 — 否则会带着上一次的状态。

## Timer 模式

- **倒计时**：elapsed 从 0 涨到 duration，触发 TimerDone，loop=false 则停止。
- **间隔循环**：loop=true，触发后 elapsed 归零继续。用于持续效果（毒/灼烧/回血）。
- **一次性延迟**：duration=N, loop=false。N tick 后做一件事。

## Lifetime = Timer + Destroy

- lifetime skill 就是：给实体挂一个 timer，TimerDone 时写入 DestroyRequest。
- 子弹、粒子、伤害数字都用这个模式。

## Spawn 模板

- SpawnRequest.templateId 指向 Assembly 蓝图中的模板 — spawn System 按模板展开组件。
- 模板里的 x/y 由 SpawnRequest 覆盖（生成位置 = 请求位置）。

## 常见陷阱

- destroy 在当前 tick 立即生效的话，后续 System 可能读到已删除实体。解决：destroy 统一在 tick 末尾执行。
- Timer 的 elapsed 不要用浮点数 — 整数 tick 保证确定性。
- 池化时忘记清理 Relation 组件 — 旧的 targetId 可能指向不存在的实体。

## 参考来源

- Dead Cells 实体池 — Haxe ECS 中池化 + 组件重用的实战案例
- *Game Programming Patterns* Ch.19 Object Pool — 池化模式的经典讲解
