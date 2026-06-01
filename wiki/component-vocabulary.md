# 组件语义词汇表

Apollo Engine 的组件分为 **6 种语义类型**。每种类型有明确的行为约定，AI 可通过类型推断组件的用途。

## 总览

| 语义类型 | 生命周期 | 典型字段 | 示例 |
|---------|---------|---------|------|
| **Resource** | 持久 | `current`, `max` | Health, Mana, Stamina |
| **Event** | 一次性 (被 consume) | `amount`, `source` | HealthModifyEvent, DamageEvent |
| **Intent** | 一次性 (被 consume) | `target` | AttackIntent, DefendIntent |
| **Marker** | 条件性 | (无字段) | Dead, Defending, CurrentTurn |
| **Config** | 持久 | 配置参数 | CombatStats, TurnOrder, StatusBarSource |
| **Render** | 每帧更新 | 渲染数据 | BarDisplay, Sprite, Transform |

## 详细说明

### Resource — 有 current/max 的数值

持久存在于 Entity 上，表达一种可变资源。

```typescript
interface Health {
  type: 'Health';
  current: number;  // 当前值
  max: number;      // 最大值
}
```

**约定**：
- 必须有 `current` 和 `max` 字段
- 可被 status-bar 等 UI 技能通用读取
- 修改通过 Event 驱动，不直接外部赋值

### Event — 一次性事件

挂到 Entity 上的一次性数据包，被对应 System consume 后自动删除。

```typescript
interface HealthModifyEvent {
  type: 'HealthModifyEvent';
  amount: number;   // 正数=治疗, 负数=伤害
}
```

**约定**：
- 必须在某个 System 的 `consumes` 中声明
- 不跨帧存活
- 是 Atom Skill 间通信的主要方式

### Intent — 意图声明

表达外部输入（玩家操作、AI 决策）。被 System 转化为 Event。

```typescript
interface AttackIntent {
  type: 'AttackIntent';
  target: EntityId;
}
```

**约定**：
- 来自外部（键盘、AI、网络）
- 被对应的逻辑 System consume 后转化为 Event
- Intent → Event 的转化过程中应用游戏规则

### Marker — 存在即有意义

无字段（或极少字段），存在于 Entity 上表达一种状态。

```typescript
interface Dead {
  type: 'Dead';
}
```

**约定**：
- 用 `hasComponent()` 检查，不需要读字段
- 添加/移除即为状态切换

### Config — 持久配置

长期存在于 Entity 上，描述实体的固有属性或配置。

```typescript
interface StatusBarSource {
  type: 'StatusBarSource';
  sourceComponent: string;
  label: string;
  highColor: string;
  // ...
}
```

**约定**：
- 游戏运行中通常不变
- 可被编辑器直接修改
- 为其他 System 提供参数

### Render — 渲染数据

每帧由 System 更新，Renderer Bridge 或 React overlay 读取。

```typescript
interface BarDisplay {
  type: 'BarDisplay';
  percentage: number;
  color: string;
  label: string;
  current: number;
  max: number;
}
```

**约定**：
- 不包含游戏逻辑，只是渲染指令
- 由逻辑层 System 写入，表现层读取
- 是逻辑层和表现层的桥梁

## AI 可读性

LLM 通过组件的语义类型可以推断：
- **Resource** → 这个实体有一种可变数值
- **Event** → 这是一次性的事情发生了
- **Intent** → 这是外部想要做什么
- **Marker** → 这个实体处于某种状态
- **Config** → 这是实体的固有配置
- **Render** → 这是给渲染用的数据
