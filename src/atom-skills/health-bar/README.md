# Atom Skill: Health Bar

**ID:** `health-bar`
**语义类型:** Render / UI Bridge

## 功能

读取 `Health` 组件，计算百分比，通过 React DOM overlay 渲染一个可视化的生命条。

## 数据流

```
reads: Health → [health-bar.render] → writes: BarDisplay → React DOM 更新
```

## 组件

| 组件名 | 语义类型 | 描述 |
|--------|---------|------|
| `BarDisplay` | Render | `{ percentage, color, label }` UI 渲染数据 |

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `barColor` | string | `#22c55e` | 满血时颜色 |
| `lowColor` | string | `#ef4444` | 低血时颜色 |
| `lowThreshold` | number | 0.3 | 低血阈值（百分比） |

## 依赖

- 读取: `Health` (来自 `health`)
- 无下游消费者
