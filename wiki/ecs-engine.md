# ECS 引擎核心

## 概念

ZeroCraft Engine 使用 **Entity-Component-System (ECS)** 架构：

- **Entity** — 一个 ID，没有行为，只是组件的容器
- **Component** — 纯数据，有 `type` 标识（如 `Health`, `Dead`）
- **System** — 纯逻辑，声明自己读写什么组件，引擎自动排序执行

## World

`World` 是 ECS 的核心容器，管理所有 Entity 和 Component，执行所有 System。

### API

```typescript
interface IWorld {
  // Entity
  createEntity(id: EntityId): void;
  destroyEntity(id: EntityId): void;
  getAllEntities(): EntityId[];

  // Component
  addComponent(entityId: EntityId, component: Component): void;
  removeComponent(entityId: EntityId, type: ComponentType): void;
  getComponent<T extends Component>(entityId, type): T | undefined;
  hasComponent(entityId: EntityId, type: ComponentType): boolean;

  // Query
  query(...types: ComponentType[]): Array<[EntityId, Map<ComponentType, Component>]>;
  queryEntities(...types: ComponentType[]): EntityId[];

  // State
  getVersion(): number;    // 每 tick +1, 驱动 React re-render
}
```

### tick() 流程

```
world.tick()
  │
  ├─ 1. 确保 Systems 已拓扑排序
  │
  ├─ 2. 按顺序执行每个 System
  │     ├─ system.execute(world)
  │     └─ 自动清理 system.consumes 声明的组件
  │
  └─ 3. version++
```

## 拓扑排序

### 规则

引擎根据 System 的 `reads/writes/consumes` 声明自动推导执行顺序：

| 关系 | 规则 |
|------|------|
| A `writes` X, B `reads` X | A 在 B 前面 |
| A `writes` X, B `consumes` X | A 在 B 前面 |
| 循环依赖 | 抛错，阻止加载 |

### 算法

使用 **Kahn's Algorithm**（BFS 拓扑排序）：
1. 构建有向图：writes → reads/consumes 边
2. 找入度为 0 的节点入队
3. 逐个出队，减少邻居入度
4. 全部出队 = 有效排序；剩余 = 循环依赖

### 已知限制：动态依赖

某些 Skill 通过配置字段动态读取组件（如 `status-bar` 的 `StatusBarSource.sourceComponent` 指向 `Health`），但 `reads` 声明中无法体现这种运行时绑定。拓扑排序不知道 `status-bar` 依赖 `Health`。

**当前处理约定**：
1. 创建有动态依赖的 Skill 时，开发工具应提示开发者确认执行顺序
2. 记录到 Assembly 蓝图的备注中，供后续 review
3. 未来由 Component Agent（主程 Claude）在组装时检测并建议 `reads` 补充声明

### 示例

```
key-input.capture   writes: [HealthModifyEvent]
health.apply        reads:  [HealthModifyEvent]  consumes: [HealthModifyEvent]
status-bar.sync     reads:  [Health]

自动排序结果:
  1. key-input.capture  → 产生 HealthModifyEvent
  2. health.apply       → 消费事件, 更新 Health
  3. status-bar.sync    → 读取 Health, 生成 BarDisplay
```

## SystemDeclaration 接口

```typescript
interface SystemDeclaration {
  readonly id: string;               // 唯一标识: '<skill>.<action>'
  readonly reads: ComponentType[];   // 我需要读取的组件
  readonly writes: ComponentType[];  // 我会写入/修改的组件
  readonly consumes: ComponentType[];// 我读完后引擎会自动删除
  execute(world: IWorld): void;      // 实际逻辑
}
```

### reads vs writes vs consumes

| 声明 | 含义 | 引擎行为 |
|------|------|---------|
| `reads` | 我需要读这个组件的数据 | 排序：写入者必须在我前面 |
| `writes` | 我会创建或修改这个组件 | 排序：读取者必须在我后面 |
| `consumes` | 我读完后这个组件应该被删除 | 排序同 reads + 执行后自动删除 |

**consumes 的典型用途**：一次性事件（如 `HealthModifyEvent`、`DamageEvent`）。产生后被处理一次就消失，不会在下一帧残留。
