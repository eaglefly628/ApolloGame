# Atom Skill: Shield

**ID:** `shield`
**语义类型:** Resource / Interceptor

## 功能

护盾系统。拦截 `HealthModifyEvent` 中的伤害（负数 amount），用 `Shield` 资源吸收伤害后将剩余伤害写回 `HealthModifyEvent`。治疗事件（正数 amount）不拦截。

## 数据流

```
reads: HealthModifyEvent + Shield
→ [shield.absorb]
→ writes: HealthModifyEvent(remaining damage), Shield(reduced)
```

## 提供的组件 (Schema)

| 组件名 | 语义类型 | 字段 | 描述 |
|--------|---------|------|------|
| `Shield` | Resource | `current: number, max: number` | 护盾资源。符合 current/max 通用资源契约，可被 status-bar 显示 |

## 输入契约

| 需要读取 | Schema | 来源约束 |
|---------|--------|---------|
| `HealthModifyEvent` | `{ amount: number }` | 无约束——来自任何伤害/治疗来源 |
| `Shield` | `{ current: number, max: number }` | 自身提供 |

## 输出契约

| 写入 | Schema | 谁来消费 |
|------|--------|---------|
| `HealthModifyEvent` | `{ amount: number }` (吸收后的剩余伤害) | 任何 consumes HealthModifyEvent 的 skill（如 health） |
| `Shield` | `{ current: number, max: number }` (吸收后扣减) | 任何 reads Shield 的 skill（如 status-bar） |

## 拓扑排序位置

```
[任意 HealthModifyEvent writer] → shield.absorb → [任意 HealthModifyEvent consumer]
```

shield 因为同时 reads 和 writes `HealthModifyEvent`，会被拓扑排序自动插入到所有 writer（产生伤害/治疗事件的 skill）和 consumer（最终处理事件的 skill）之间。**零改动已有代码。**

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxShield` | number | 50 | 最大护盾值 |
