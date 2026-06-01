# Atom Skill: Status Bar

**ID:** `status-bar`
**语义类型:** Render / UI Bridge (通用)

## 功能

通用状态条组件。读取任意 `{ current, max }` 结构的 Resource 组件，生成 `BarDisplay` 渲染数据。

**不绑定任何特定资源**——通过 `StatusBarSource` 配置指向哪个组件。

### 可复用场景

- 生命值 (HP) → 指向 `Health`
- 魔法值 (MP) → 指向 `Mana`
- 体力 (Stamina) → 指向 `Stamina`
- 经验值 (EXP) → 指向 `Experience`
- 充能条 → 指向 `Charge`

## 数据流

```
reads: StatusBarSource.sourceComponent → 动态读取对应 Resource
→ [status-bar.sync] → writes: BarDisplay → React UI 渲染
```

## 组件

| 组件名 | 语义类型 | 描述 |
|--------|---------|------|
| `StatusBarSource` | Config | 配置条形指向哪个资源，以及颜色、标签 |
| `BarDisplay` | Render | `{ percentage, color, label, current, max }` |

## 使用方式

在 Entity 上挂 `StatusBarSource` 指定数据源：

```typescript
// 显示 HP 条
{ type: 'StatusBarSource', sourceComponent: 'Health', label: 'HP',
  highColor: '#22c55e', midColor: '#eab308', lowColor: '#ef4444',
  lowThreshold: 0.3, midThreshold: 0.6 }

// 显示 MP 条 (蓝色系)
{ type: 'StatusBarSource', sourceComponent: 'Mana', label: 'MP',
  highColor: '#3b82f6', midColor: '#8b5cf6', lowColor: '#6b21a8',
  lowThreshold: 0.2, midThreshold: 0.5 }
```

## 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `highColor` | string | `#22c55e` | 数值充足时颜色 |
| `midColor` | string | `#eab308` | 数值中等时颜色 |
| `lowColor` | string | `#ef4444` | 数值不足时颜色 |
| `lowThreshold` | number | 0.3 | 低值阈值 |

## 依赖

- 读取: 任意 `{ current, max }` Resource 组件（通过 StatusBarSource 配置）
- 无下游消费者（UI 层直接读 BarDisplay）
