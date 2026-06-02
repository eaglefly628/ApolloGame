# Apollo Engine — 原子 Skill 清单 v4 (游戏元素周期表)

> **判定标准：能用其他原子的组合描述 → 不是原子。每个原子回答一个且仅一个问题。**
>
> v4 变更：整合 Gemini 审核反馈。移除 UI 投影类原子，加入 camera/visibility/random。
> Transform 折中方案：position 独立，rotation+scale 合并。Tier 按数据流重新定义。
>
> 审核状态: v4 待审核

---

## 原子表 (22 个)

### 空间 — "它在哪？它朝哪？多大？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| A1 | **position** | `Position { x, y }` | 实体在世界的什么位置？ |
| A2 | **orientation** | `Orientation { rotation, scaleX, scaleY }` | 实体的朝向和大小？ |

> position 独立——大量逻辑实体（触发器、计分点、音源）只需位置，不需要旋转和缩放。
> rotation + scale 合并为 orientation——几乎所有需要旋转的实体也需要缩放，且渲染管线会一起消费。

### 运动 — "它怎么动？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| B1 | **velocity** | `Velocity { vx, vy }` | 实体当前的运动方向和速度？ |
| B2 | **acceleration** | `Acceleration { ax, ay }` | 实体的速度在怎么变？ |
| B3 | **mass** | `Mass { value }` | 实体有多重？（0=不可移动） |

> mass 不是 resource 的特化——它没有 current/max 结构，不触发 modify 事件，参与碰撞响应的计算方式完全不同。

### 形状 — "它占多大地方？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| C1 | **shape** | `Shape { kind: 'box'|'circle', width?, height?, radius? }` | 实体的碰撞/占位几何形状？ |

> 基础几何体用 kind 区分。如未来需要多边形，另加 shape-complex 原子，不膨胀此原子。

### 碰撞 — "它碰到了什么？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| D1 | **overlap-detect** | `Overlap { entityA, entityB, normalX, normalY, depth }` | 哪两个实体重叠了？ |

> 纯检测，纯事实。响应（推开、弹性、触发）全部是消费者，归组合层。

### 时间 — "过了多久？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| E1 | **timer** | `Timer { id, elapsed, duration, loop }`, `TimerDone { timerId }` | 倒计时/间隔走到哪了？到了吗？ |

### 数值 — "它有多少？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| F1 | **resource** | `Resource { id, current, max }`, `ResourceModify { resourceId, amount }` | 某种有上限的数值？ |
| F2 | **counter** | `Counter { id, value }`, `CounterModify { counterId, delta }` | 某种无上限的数值？ |
| F3 | **flag** | `Flag { id, active }` | 某个条件开还是关？ |

### 标识 — "它是谁？跟谁有关？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| G1 | **tag** | `Tag { tags: string[] }` | 实体属于哪些分类？ |
| G2 | **relation** | `Relation { kind, targetId }` | 实体跟谁有什么关系？（parent、targeting、owned-by） |

> relation(kind='parent') 可驱动空间变换继承——当 kind='parent' 时，组合层的 transform-inherit 系统读取父实体 position 进行矩阵乘法。

### 控制 — "它是否参与世界？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| H1 | **visibility** | `Visibility { visible, active }` | 实体是否可见？是否参与系统运算？ |

> visible 控制渲染跳过，active 控制逻辑跳过。高频操作，影响所有 System 的 Query 行为。
> 不能用 flag 替代——flag 是游戏逻辑层面的开关，visibility 是引擎基础设施层面的开关。

### 输入 — "外部说了什么？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| I1 | **input-capture** | `RawInput { source, key?, x?, y?, phase? }` | 这帧有什么外部原始信号？ |
| I2 | **action-map** | `Action { name, value }` | 原始信号对应什么语义动作？ |

### 状态 — "它处于什么模式？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| J1 | **state** | `State { current, previous }`, `StateChanged { from, to }` | 实体当前的离散状态？ |

### 生命周期 — "它存在吗？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| K1 | **spawn** | `SpawnRequest { templateId, x, y }` | 需要创建一个新实体。 |
| K2 | **destroy** | `DestroyRequest { entityId }` | 需要移除一个实体。 |

### 感知 — "玩家看到/听到什么？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| L1 | **sprite** | `Sprite { textureKey, anchorX, anchorY }` | 实体用什么图？ |
| L2 | **color** | `Color { tint, alpha }` | 实体当前的颜色/透明度？ |
| L3 | **frame** | `Frame { index, total }` | 精灵的当前帧？ |
| L4 | **sound** | `Sound { clipId, volume, loop }` | 播放什么声音？ |
| L5 | **camera** | `Camera { zoom, viewportW, viewportH }` | 观察窗口多大？世界坐标如何映射到屏幕？ |

> camera 是独立原子——它回答了其他 22 个原子都没回答的问题："玩家的观察窗口"。
> 没有 camera，渲染管线无法确立坐标映射基准。

### 世界级 — "世界本身的属性"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| W1 | **random** | `RandomSeed { seed, sequence }` | 可控随机数。AI 决策、特效粒子、掉落概率的熵源。 |

> 不是实体级组件，而是世界级服务。挂在特殊的"world"实体上，所有系统可读。

---

## 原子总数：23 (22 实体级 + 1 世界级)

```
空间:     A1 position       A2 orientation
运动:     B1 velocity       B2 acceleration    B3 mass
形状:     C1 shape
碰撞:     D1 overlap-detect
时间:     E1 timer
数值:     F1 resource       F2 counter         F3 flag
标识:     G1 tag            G2 relation
控制:     H1 visibility
输入:     I1 input-capture  I2 action-map
状态:     J1 state
生命周期: K1 spawn          K2 destroy
感知:     L1 sprite  L2 color  L3 frame  L4 sound  L5 camera
世界级:   W1 random
```

---

## UI 层处理

v3 的 bar-display 和 text-display **不再是原子**。

UI 通过 **ui-binding 机制** 处理（属于 Tier 2 组合层）：

```
ui-binding = resource/counter/flag + 渲染层 React 组件

实体不知道自己的 HP 会被显示为血条——
它只有 resource(id='hp', current=50, max=100)。
UI 层通过 binding 声明读取这个 resource 并投影为 Bar/Text/任意 UI。
```

这样 UI 展示方式可以无限扩展（血条、饼图、小地图标记、头顶名字），而原子表保持稳定。

---

## 涌现分层 (按数据流方向定义)

### Tier 1 — 直接结算 (Kinematic)

无状态的数值应用。A 写了 X，B 读 X 算出 Y，完毕。

| 组合 | 公式 | 数据流 |
|------|------|--------|
| motion-apply | position += velocity | velocity → position |
| accel-apply | velocity += acceleration | acceleration → velocity |
| animation | frame.index++ per timer | timer → frame |
| lifetime | timer done → destroy | timer → destroy |

### Tier 2 — 规则与约束 (Resolution)

涉及条件判断或状态修改。需要读检测结果后决定怎么做。

| 组合 | 公式 | 数据流 |
|------|------|--------|
| collision-separate | overlap → 按 mass 比推开 position | overlap + mass → position |
| collision-bounce | overlap → 按 mass 反转 velocity | overlap + mass → velocity |
| grounded-check | overlap + tag(ground) → flag(grounded) | overlap + tag → flag |
| trigger-zone | overlap + tag(trigger) → event | overlap + tag → flag/event |
| cooldown | timer → flag(ready) | timer → flag |
| resource-regen | timer → resource.current++ | timer → resource |
| ui-binding | resource/counter → React overlay | resource → UI (非 ECS) |
| gravity | mass → acceleration.ay | mass → acceleration |
| friction | velocity → acceleration(反向) | velocity → acceleration |
| transform-inherit | relation(parent) + position(parent) → position(child) | relation + position → position |

### Tier 3 — 系统级玩法 (Mechanics)

跨实体的复合逻辑。多个 Tier 2 串联成完整的游戏机制。

| 组合 | 来源 |
|------|------|
| health-system | resource(hp) + resource-modify + ui-binding |
| shield-absorb | resource(shield) + resource-modify 拦截链 |
| poison-dot | timer + resource-modify(周期) |
| invincible-frame | timer + flag(block damage) |
| knockback | timer + velocity(覆写) |
| pickup-item | trigger-zone + destroy + resource-modify |
| platformer-jump | action-map + flag(grounded) + velocity |
| projectile | spawn + velocity + lifetime + overlap-detect + destroy |

### Tier 4 — 心智与黑盒 (Behaviors)

包含状态机或决策逻辑。对 LLM 来说是"一句话能描述的行为"。

| 组合 | 来源 |
|------|------|
| ai-patrol | state + timer + velocity(方向切换) |
| ai-chase | state + relation(target) + position + velocity |
| ai-attack-pattern | state + timer(cooldown) + spawn(弹幕) |
| dialogue | trigger-zone + state + input + text-display |
| anim-state-machine | state + transition-rules + animation |

---

## Macro 机制 (回答 Gemini 的最终问题)

> "Claude 面对 Tier 4 时，是用预制件还是每次从 24 个原子推演？"

**答案：Macro 层——预编译的 Tier 2/3 组合，供 AI 快速调用。**

```
原子 (23个)          ← 不可变的基础真理
  ↓
Macro Library        ← 预编译的 Tier 2/3 "积木块"
  ├─ physics-body    = position + velocity + acceleration + mass + shape
  ├─ health-system   = resource(hp) + resource-modify + ui-binding
  ├─ platformer-move = input → action → velocity + gravity + grounded
  ├─ projectile      = spawn + velocity + lifetime + overlap + destroy
  └─ ...
  ↓
Tier 4 行为          ← Claude 用 Macro 组装，不回到原子
  ↓
Assembly 蓝图        ← 最终游戏
```

**Claude 的工作方式：**
- 规划阶段：从原子表理解可能性边界
- 开发阶段：从 Macro Library 拿现成积木
- 创新阶段：当 Macro 不够用时，回到原子组合新 Macro

**Macro 的定义方式：** 就是一个 `defineCapability()`，但在 describe.semantic 中标注 `['macro', 'tier-2']`，表明它不是原子。registry 中原子和 macro 分开索引。

---

## 涌现验证

| 游戏类型 | 使用的原子 (23个中) |
|---------|-------------------|
| **平台跳跃** | position, orientation, velocity, acceleration, mass, shape, overlap-detect, timer, resource, flag, tag, input-capture, action-map, state, spawn, destroy, sprite, color, frame, sound, camera (21/23) |
| **弹幕射击** | position, velocity, acceleration, shape, overlap-detect, timer, resource, counter, flag, tag, input-capture, action-map, spawn, destroy, sprite, frame, sound, camera, random (19/23) |
| **回合制 RPG** | position, orientation, resource, counter, flag, tag, relation, input-capture, action-map, state, sprite, color, frame, sound, camera, timer, random (17/23) |
