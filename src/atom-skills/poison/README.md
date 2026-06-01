# Atom Skill: Poison

**ID:** `poison`
**语义类型:** Debuff / Damage-over-Time

## 功能

中毒效果。每帧检查有 `Poisoned` 组件的实体，产生 `HealthModifyEvent` 持续扣血。倒计时归零后自动移除中毒状态。

## 数据流

```
reads: Poisoned → [poison.tick] → writes: HealthModifyEvent, Poisoned(countdown--)
                                  → removes: Poisoned (when remainingTicks ≤ 0)
```

## 提供的组件 (Schema)

| 组件名 | 语义类型 | 字段 | 描述 |
|--------|---------|------|------|
| `Poisoned` | Marker | `damagePerTick: number, remainingTicks: number` | 中毒状态，存在即每帧扣血 |

## 输入契约

| 需要读取 | Schema | 来源约束 |
|---------|--------|---------|
| `Poisoned` | `{ damagePerTick: number, remainingTicks: number }` | 自身提供。由外部 skill（如攻击、陷阱）挂到目标 Entity 上 |

## 输出契约

| 写入 | Schema | 谁来消费 |
|------|--------|---------|
| `HealthModifyEvent` | `{ amount: number }` | 任何 consumes HealthModifyEvent 的 skill（如 health） |

> **注意**：poison 不消费 HealthModifyEvent，只写入。health skill 负责消费。
> 多个来源（key-input、poison、其他）可以同帧写入 HealthModifyEvent。

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `damagePerTick` | number | 3 | 每帧中毒伤害 |
| `duration` | number | 60 | 中毒持续帧数 |
