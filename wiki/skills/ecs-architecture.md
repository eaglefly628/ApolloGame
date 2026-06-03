# ECS 架构知识

> 覆盖：defineCapability、World、Assembly、拓扑排序、组件语义

## 核心原则

- **Entity = ID**，没有逻辑。Component = 纯数据，没有方法。System = 纯逻辑，没有状态。
- 组合代替继承：一个实体的行为完全由它挂载的 Component 集合决定。
- 每个 System 通过 `defineCapability` 自描述它读什么、写什么，引擎用拓扑排序自动排执行顺序。

## 编码约定

- 每种 Component type 在一个实体上只存一份（Map<type, Component>）。
- 事件型组件（ResourceModify、TimerDone、StateChanged）用 read-then-consume 模式：下游系统读取后移除。
- Assembly 蓝图是纯声明式数据（实体 + 组件列表），不包含逻辑代码。

## 组件语义分类

| 类别 | 含义 | 生命周期 |
|------|------|---------|
| Resource | 持久数值 { current, min, max } | 长期存在 |
| Event | 一次性信号 | 被消费后移除 |
| Intent | "想做某事"的请求 | 被处理后移除 |
| Marker | 无字段，存在即有意义 | 按需添加/移除 |
| Config | 持久配置 | 不变 |
| Render | 驱动渲染层 | 每帧更新 |

## 常见陷阱

- System 之间不要直接调用，只通过 Component 通信。
- 不要在 System 内缓存 Entity 引用 — Entity 可能被 destroy。
- Assembly 蓝图里的数值要可调，不要硬编码到 System 里。

## 参考来源

- 守望先锋 ECS (GDC 2017) — 工业级 ECS 的确定性设计
- 地牢围攻数据驱动系统 (GDC 2002) — defineCapability 模式的理论源头
- Dead Cells ECS — 实体池化 + 组件重用的实战案例
