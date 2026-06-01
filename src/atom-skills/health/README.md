# Atom Skill: Health

**ID:** `health`
**语义类型:** Resource Manager

## 功能

管理实体的生命值。消费 `HealthModifyEvent`，更新 `Health` 组件。

- 收到正数 amount → 治疗（不超过 max）
- 收到负数 amount → 伤害（不低于 0）
- current ≤ 0 → 挂 `Dead` 标记

## 数据流

```
consumes: HealthModifyEvent → [health.apply] → writes: Health, Dead
```

## 提供的组件 (Schema)

| 组件名 | 语义类型 | 字段 | 描述 |
|--------|---------|------|------|
| `Health` | Resource | `current: number, max: number` | 生命值资源。符合 current/max 通用资源契约 |
| `Dead` | Marker | (无) | 生命值归零标记。存在即表示死亡 |

## 输入契约

| 需要消费 | Schema | 来源约束 |
|---------|--------|---------|
| `HealthModifyEvent` | `{ amount: number }` | **无约束**——任何 skill 都可以写此事件 |

> 例如：key-input、poison、fall-damage、fire-dot 都可以产生 HealthModifyEvent。
> health skill 不关心事件从哪来，只关心 amount 字段。

## 输出契约

| 写入 | Schema | 谁来读取 |
|------|--------|---------|
| `Health` | `{ current: number, max: number }` | 任何 reads Health 的 skill（如 status-bar） |
| `Dead` | (marker) | 任何 reads Dead 的 skill |

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxHealth` | number | 100 | 最大生命值 |
