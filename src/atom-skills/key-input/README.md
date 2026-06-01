# Atom Skill: Key Input

**ID:** `key-input`
**语义类型:** Event Producer

## 功能

监听键盘事件，产生 `HealthModifyEvent` 组件。

- 按 `↑` 或 `W` → 产生 `HealthModifyEvent { amount: +10 }`
- 按 `↓` 或 `S` → 产生 `HealthModifyEvent { amount: -10 }`

## 数据流

```
键盘按键 → [key-input.capture] → writes: HealthModifyEvent
```

## 提供的组件 (Schema)

| 组件名 | 语义类型 | 字段 | 描述 |
|--------|---------|------|------|
| `HealthModifyEvent` | Event | `amount: number` | 一次性生命值修改事件。正=治疗，负=伤害 |
| `KeyboardListener` | Marker | (无) | 标记实体接受键盘输入 |

## 输入契约

| 需要读取 | Schema | 来源约束 |
|---------|--------|---------|
| `KeyboardListener` | (marker, 无字段) | 自身提供 |

## 输出契约

| 写入 | Schema | 谁来消费 |
|------|--------|---------|
| `HealthModifyEvent` | `{ amount: number }` | 任何 consumes HealthModifyEvent 的 skill |

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `healAmount` | number | 10 | 每次治疗量 |
| `damageAmount` | number | 10 | 每次伤害量 |
