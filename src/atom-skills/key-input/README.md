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

## 组件

| 组件名 | 语义类型 | 描述 |
|--------|---------|------|
| `HealthModifyEvent` | Event | 一次性生命值修改事件 |
| `KeyboardListener` | Marker | 标记实体接受键盘输入 |

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `healAmount` | number | 10 | 每次治疗量 |
| `damageAmount` | number | 10 | 每次伤害量 |

## 依赖

- 无前置依赖
- 被 `health` atom-skill 消费
