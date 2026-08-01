# 组件语义词汇表

ZeroCraft Preview 的组件分为 **7 种语义类型**。每种类型有明确的行为约定，AI 可通过类型推断组件的用途。

## 总览

| 语义类型 | 生命周期 | 典型字段 | 示例 |
|---------|---------|---------|------|
| **Resource** | 持久 | `current`, `max` | Health, Mana, Stamina |
| **Event** | 一次性 (被 consume) | `amount`, `source` | HealthModifyEvent, DamageEvent |
| **Intent** | 一次性 (被 consume) | `target` | AttackIntent, DefendIntent |
| **Effect** | 临时, 有持续时间 | `remainingTicks`, 效果参数 | Poisoned, Burning, Stunned |
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

### Effect — 临时效果, 有字段, 有持续时间

存在于 Entity 上的临时状态，有参数和持续时间。与 Marker 的区别：Effect 有字段（伤害量、剩余时间等）。

```typescript
interface Poisoned {
  type: 'Poisoned';
  damagePerTick: number;     // 效果参数
  remainingTicks: number;    // 持续时间
}
```

**约定**：
- 必须有 `remainingTicks` 或等价的持续时间字段
- 对应的 System 每帧递减计时器，归零后自动移除
- 典型用途：Buff/Debuff（中毒、灼烧、加速、护盾增益等）

**与其他类型的区别**：
- vs **Marker**：Marker 无字段，Effect 有参数和时间
- vs **Config**：Config 持久不变，Effect 会过期消失
- vs **Event**：Event 被 consume 后当帧消失，Effect 跨帧存在

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
- **Effect** → 这个实体身上有个临时效果，会自动过期
- **Marker** → 这个实体处于某种状态（无参数）
- **Config** → 这是实体的固有配置
- **Render** → 这是给渲染用的数据
