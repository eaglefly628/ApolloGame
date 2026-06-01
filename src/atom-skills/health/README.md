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
reads: HealthModifyEvent → [health.apply] → writes: Health, Dead
```

## 组件

| 组件名 | 语义类型 | 描述 |
|--------|---------|------|
| `Health` | Resource | `{ current: number, max: number }` |
| `Dead` | Marker | 生命值归零标记 |

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxHealth` | number | 100 | 最大生命值 |

## 依赖

- 消费: `HealthModifyEvent` (来自 `key-input`)
- 被 `health-bar` atom-skill 读取
