# Atom Skill: Status Bar

**ID:** `status-bar`
**语义类型:** Render / UI Bridge (通用)

## 功能

通用状态条组件。读取任意 `{ current, max }` 结构的 Resource 组件，生成 `BarDisplay` 渲染数据。

**不绑定任何特定资源**——通过 `StatusBarSource.sourceComponent` 配置指向哪个组件。

### 可复用场景

- 生命值 (HP) → `sourceComponent: 'Health'`
- 魔法值 (MP) → `sourceComponent: 'Mana'`
- 体力 (Stamina) → `sourceComponent: 'Stamina'`
- 经验值 (EXP) → `sourceComponent: 'Experience'`
- 充能条 → `sourceComponent: 'Charge'`

## 数据流

```
reads: StatusBarSource → 动态读取 sourceComponent 指向的资源
→ [status-bar.sync] → writes: BarDisplay → React UI 渲染
```

## 提供的组件 (Schema)

| 组件名 | 语义类型 | 字段 | 描述 |
|--------|---------|------|------|
| `StatusBarSource` | Config | `sourceComponent: string, label: string, highColor: string, midColor: string, lowColor: string, lowThreshold: number, midThreshold: number` | 配置条形指向哪个资源 |
| `BarDisplay` | Render | `percentage: number, color: string, label: string, current: number, max: number` | 条形渲染数据 |

## 输入契约

| 需要读取 | Schema | 来源约束 |
|---------|--------|---------|
| `StatusBarSource` | 见上表 | 自身提供 |
| 任意 Resource | `{ current: number, max: number }` | **通用契约**——任何符合 current/max 的 Resource 组件 |

> status-bar 通过 `StatusBarSource.sourceComponent` 动态绑定。只要目标组件有 `current` 和 `max` 字段就能工作。

## 输出契约

| 写入 | Schema | 谁来读取 |
|------|--------|---------|
| `BarDisplay` | `{ percentage, color, label, current, max }` | React UI 层（GameOverlay） |

## 使用方式

在 Entity 上挂 `StatusBarSource` 指定数据源：

```typescript
// HP 条 (绿→黄→红)
{ type: 'StatusBarSource', sourceComponent: 'Health', label: 'HP',
  highColor: '#22c55e', midColor: '#eab308', lowColor: '#ef4444',
  lowThreshold: 0.3, midThreshold: 0.6 }

// MP 条 (蓝色系)
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
