# 资源系统模块知识

> 覆盖原子：resource、resource-modify、damage-number、ui-binding

## 核心原则

- Resource 是 { current, min, max } 三元组 — 血量、MP、体力、好感度都是这个结构。
- 修改资源通过 ResourceModify 事件组件 — 不直接写 current，保证修改可追踪。
- UI 绑定是单向投影：ECS 数据 → UI 层显示。UI 不写回 ECS。

## Resource 生命周期

1. Assembly 蓝图定义初始值：`{ type: 'Resource', id: 'hp', current: 100, min: 0, max: 100 }`
2. 触发修改：其他 System 写入 `{ type: 'ResourceModify', resourceId: 'hp', amount: -20 }`
3. resource System 消费 ResourceModify：`current = clamp(current + amount, min, max)`
4. 下游检查：current <= min → 触发死亡 / current >= max → 触发满血事件

## 伤害数字（Damage Number）

- ResourceModify 触发后 → spawn 一个文字实体：
  - Text 组件（显示伤害值）
  - Velocity（向上飘动）
  - Lifetime（1-2 秒后销毁）
  - Color（红色伤害 / 绿色治疗）
- 位置 = 被击中实体的 Transform + 随机偏移（避免重叠）。

## UI 绑定

- 不要在 ECS System 里操作 DOM / React — ECS 层不知道 UI 存在。
- React 组件通过 useWorldVersion hook 每 tick 读取 World 状态，自行渲染。
- 血条 = 读 Resource.current / Resource.max → 渲染为进度条。

## 多资源实体

- 一个实体可以有多个 Resource（hp + mp + stamina）。
- 区分靠 Resource.id 字段。
- ResourceModify.resourceId 精确指定修改哪个资源。

## 常见陷阱

- 先检查 current <= 0 再消费 ResourceModify — 否则死亡后还能继续受伤。
- ResourceModify 必须被消费（移除）— 不消费会每 tick 重复扣血。
- clamp 时注意顺序：先加 amount 再 clamp，不要先 clamp 再加。

## 参考来源

- 暗黑破坏神系列 — 伤害数字的行业标准视觉反馈
- *Game Programming Patterns* Ch.5 Observer — 资源变化事件链
- React/Unity UI Toolkit — 单向数据绑定模式
