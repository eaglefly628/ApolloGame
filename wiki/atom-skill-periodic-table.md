# Apollo Engine — 原子 Skill 清单 v2 (游戏元素周期表)

> 参考 Jason Gregory《Game Engine Architecture》分层模型重构。
> **原则：只放真正的原子——不能再拆的最小构件。能由两个原子组合出的东西不进此表。**
>
> 审核状态: v2 待审核

---

## 分层总览

```
Layer 0 — 存在        实体存在于世界中的最基本属性
Layer 1 — 运动        实体能动
Layer 2 — 碰撞        实体能碰
Layer 3 — 数值        实体有数
Layer 4 — 输入        外部能控制实体
Layer 5 — 渲染基础    实体能被看到、听到
Layer 6 — 行为基础    实体有行为模式
```

以上为原子层。以下由原子组合而来：

```
Combo A — 物理组合      gravity = force + velocity, friction = force + velocity, ...
Combo B — 战斗组合      shield, poison, knockback, invincible, ...
Combo C — 交互组合      pickup, destroy-on-contact, ...
Combo D — AI 组合       patrol, chase, flee, ...
```

---

## Layer 0 — 存在 (Entity Primitives)

一切的根。没有这些，实体不存在于世界中。

| # | Atom Skill | provides | 说明 |
|---|-----------|----------|------|
| 0.1 | **transform** | `Transform { x, y, rotation, scaleX, scaleY }` | 空间位置。一切空间计算的起点。 |
| 0.2 | **tag** | `Tag { tags: string[] }` | 分类标签。碰撞过滤、阵营、查询的基础。 |
| 0.3 | **hierarchy** | `Parent { parentId }`, `Children { childIds }` | 父子关系。UI 挂载、武器跟随、编组。 |

---

## Layer 1 — 运动 (Kinematics)

让实体能动。纯运动学，不涉及力。

| # | Atom Skill | provides | reads | 说明 |
|---|-----------|----------|-------|------|
| 1.1 | **velocity** | `Velocity { vx, vy }` | `Transform` | 线速度。每帧 position += velocity。 |
| 1.2 | **acceleration** | `Acceleration { ax, ay }` | `Velocity` | 加速度。每帧 velocity += acceleration。力、重力、摩擦都通过写 Acceleration 实现。 |
| 1.3 | **mass** | `Mass { value, inverseMass }` | — | 质量。碰撞响应、力计算的基础。inverseMass=0 表示不可移动(墙壁/地面)。 |
| 1.4 | **angular-velocity** | `AngularVelocity { omega }` | `Transform` | 角速度。每帧 rotation += omega。旋转类运动的基础。 |

---

## Layer 2 — 碰撞 (Collision)

让实体能碰。检测与响应严格分离。

| # | Atom Skill | provides | reads | 说明 |
|---|-----------|----------|-------|------|
| 2.1 | **bounding-box** | `BoundingBox { width, height, offsetX, offsetY }` | — | AABB 包围盒定义。不做检测，只是形状数据。 |
| 2.2 | **bounding-circle** | `BoundingCircle { radius }` | — | 圆形包围盒。子弹、球体、爆炸范围。 |
| 2.3 | **collision-detect** | `CollisionEvent { entityA, entityB, normalX, normalY, depth }` | `Transform`, `BoundingBox`/`BoundingCircle`, `Tag` | 碰撞检测。每帧扫描重叠，产生 CollisionEvent。只检测，不响应。 |
| 2.4 | **collision-separate** | — | `CollisionEvent`, `Transform`, `Mass` | 碰撞分离。消费 CollisionEvent，按质量比推开重叠实体。最小单位的响应。 |
| 2.5 | **collision-bounce** | — | `CollisionEvent`, `Velocity`, `Mass` | 碰撞弹性反弹。消费 CollisionEvent，反转/衰减速度分量。 |
| 2.6 | **world-bounds** | `WorldBounds { minX, minY, maxX, maxY }` | `Transform`, `Velocity` | 世界边界约束。 |
| 2.7 | **trigger-zone** | `TriggerZone { width, height }`, `TriggerEnterEvent`, `TriggerExitEvent` | `Transform`, `BoundingBox` | 触发区域。不产生物理响应，只产生进入/离开事件。门、陷阱、区域的基础。 |

---

## Layer 3 — 数值 (Values)

让实体有数。最通用的数值容器。

| # | Atom Skill | provides | reads | 说明 |
|---|-----------|----------|-------|------|
| 3.1 | **resource** | `Resource { id, current, max }`, `ResourceModifyEvent { resourceId, amount }` | — | **通用资源容器**。HP、MP、体力、弹药、经验值都是它的实例。一个 skill 解决所有 current/max 数值。 |
| 3.2 | **resource-regen** | — | `Resource`, `Timer` | 资源自动回复。每隔 N 帧回复 M 点。stamina regen、MP regen 都是它。 |
| 3.3 | **timer** | `Timer { id, elapsed, duration, loop, paused }`, `TimerDoneEvent { timerId }` | — | **通用计时器**。倒计时、间隔、延迟。cooldown、lifetime、dot 间隔、无敌帧持续时间都从它涌现。 |
| 3.4 | **counter** | `Counter { id, value }`, `CounterModifyEvent { counterId, delta }` | — | 通用计数器。击杀数、分数、连击数、楼层数。没有 max，纯累加/递减。 |
| 3.5 | **flag** | `Flag { id, value: boolean }` | — | 通用开关。门是否打开、是否已触发、是否可交互。比 Marker 更灵活（有 id 可多个共存）。 |

---

## Layer 4 — 输入 (Input)

让外部能控制实体。原始信号到语义动作。

| # | Atom Skill | provides | reads | 说明 |
|---|-----------|----------|-------|------|
| 4.1 | **keyboard-capture** | `KeyState { pressed: Set, justDown: Set, justUp: Set }` | — | 键盘状态捕获。每帧快照当前按键状态。纯数据，不解释含义。 |
| 4.2 | **touch-capture** | `TouchState { touches: Array<{x,y,phase}> }` | — | 触摸/鼠标状态捕获。支持多点触控。 |
| 4.3 | **input-action** | `InputAction { action: string, value: number }` | `KeyState` / `TouchState` | 输入→动作映射。将"按了A键"转为"jump 1.0"。解耦物理按键和游戏语义。 |
| 4.4 | **intent-move** | `MoveIntent { dirX, dirY, magnitude }` | `InputAction` | 移动意图。将 action 转为方向。 |
| 4.5 | **intent-interact** | `InteractIntent { targetId? }` | `InputAction`, `TriggerEnterEvent` | 交互意图。"对面前的东西按下交互键"。对话、拾取、开门的基础。 |

---

## Layer 5 — 渲染基础 (Render Primitives)

让实体能被看到、听到。只是最基础的渲染指令，不含状态逻辑。

| # | Atom Skill | provides | reads | 说明 |
|---|-----------|----------|-------|------|
| 5.1 | **sprite** | `Sprite { textureKey, anchorX, anchorY, visible }` | `Transform` | 精灵定义。ECS→Phaser Sprite 同步的最小单位。 |
| 5.2 | **animation-clip** | `AnimClip { clipId, frameStart, frameEnd, fps, loop }` | `Sprite` | **单个**动画片段播放。不管状态切换，只管"播放这段帧序列"。 |
| 5.3 | **tint** | `Tint { color, alpha }` | `Sprite` | 颜色覆盖。受击变红、中毒变绿、隐身半透明。 |
| 5.4 | **camera** | `CameraTarget`, `CameraShake { intensity, remaining }` | `Transform` | 摄像机跟随和震动。 |
| 5.5 | **audio-clip** | `AudioPlay { clipId, volume, loop }` | — | 播放一个音频片段。不管何时播放，只管"播"。 |
| 5.6 | **status-bar** | `StatusBarSource`, `BarDisplay` | 任意 Resource | 通用状态条。✅ 已实现。 |
| 5.7 | **floating-text** | `FloatingText { text, color, x, y, lifetime }` | — | 飘字。纯渲染指令——"在这个位置显示这段文字然后消失"。 |

---

## Layer 6 — 行为基础 (Behavior Primitives)

让实体有行为模式。

| # | Atom Skill | provides | reads | 说明 |
|---|-----------|----------|-------|------|
| 6.1 | **state-machine** | `FSM { current, previous }`, `StateChangeEvent { from, to }` | — | 有限状态机**骨架**。只管"当前状态是什么、切换时发事件"。不管状态对应什么行为。 |
| 6.2 | **state-transition** | `TransitionRule { from, to, condition }` | `FSM`, 多种条件组件 | 状态转换规则。"idle→walk when MoveIntent exists"。从 FSM 拆出来的条件判断。 |
| 6.3 | **spawn** | `SpawnRequest { templateId, x, y, components }` | — | 动态创建实体。消费 SpawnRequest，在世界中创建新实体。 |
| 6.4 | **destroy** | `DestroyRequest { entityId, delay? }` | `Timer`(optional) | 销毁实体。可立即或延迟销毁。 |

---

## 组合层 (由原子涌现，不在周期表内)

以下是两个或更多原子的组合，**不属于原子表**，但记录在此说明涌现路径。

### Combo A — 物理组合
| 组合 Skill | 由哪些原子组合 | 说明 |
|-----------|--------------|------|
| gravity | acceleration + mass | 每帧给 acceleration.ay += 9.8 * mass |
| friction | acceleration + velocity | 每帧给 acceleration 加反向力 |
| lifetime | timer + destroy | timer 到期 → destroy-request |
| grounded | collision-detect + tag | 检测脚底是否有 tag=ground 的碰撞 |

### Combo B — 战斗组合
| 组合 Skill | 由哪些原子组合 | 说明 |
|-----------|--------------|------|
| health | resource (id=hp) | health 就是 resource 的一个实例 |
| shield | resource (id=shield) + resource-modify 拦截 | 拦截伤害事件 |
| poison | timer + resource-modify | 每帧由 timer 触发 resource 扣减 |
| invincible | timer + flag (id=invincible) | flag 阻止伤害事件 |
| cooldown | timer + flag (id=cooldown:skillId) | flag 阻止技能使用 |
| knockback | timer + velocity 覆写 | 强制设定 velocity 持续 N 帧 |

### Combo C — 交互组合
| 组合 Skill | 由哪些原子组合 | 说明 |
|-----------|--------------|------|
| pickup | trigger-zone + intent-interact + destroy | 进入区域+交互→获得效果+销毁物体 |
| destroy-on-contact | collision-detect + destroy | 碰撞→销毁 |
| door | trigger-zone + flag + state-machine | 区域内+交互→flag翻转→状态切换 |

### Combo D — AI 组合
| 组合 Skill | 由哪些原子组合 | 说明 |
|-----------|--------------|------|
| ai-patrol | state-machine + intent-move + timer | 定时切换巡逻方向 |
| ai-chase | state-machine + intent-move + transform(读取目标位置) | 向目标移动 |
| ai-flee | state-machine + intent-move + transform | 远离目标 |
| ai-attack | state-machine + attack-intent + timer(cooldown) | 进入范围→攻击 |

---

## 统计

| Layer | 数量 | 说明 |
|-------|------|------|
| 0 — 存在 | 3 | transform, tag, hierarchy |
| 1 — 运动 | 4 | velocity, acceleration, mass, angular-velocity |
| 2 — 碰撞 | 7 | bbox, bcircle, detect, separate, bounce, world-bounds, trigger-zone |
| 3 — 数值 | 5 | resource, resource-regen, timer, counter, flag |
| 4 — 输入 | 5 | keyboard, touch, input-action, intent-move, intent-interact |
| 5 — 渲染 | 7 | sprite, animation-clip, tint, camera, audio-clip, status-bar, floating-text |
| 6 — 行为 | 4 | state-machine, state-transition, spawn, destroy |
| **原子总计** | **35** | |
| 组合层 | 16+ | 由原子涌现，不计入原子表 |

---

## 涌现验证

用纯原子组合出游戏，不依赖任何组合层 Skill：

| 游戏类型 | 原子 Skills |
|---------|------------|
| **平台跳跃** | transform, velocity, acceleration, mass, bbox, collision-detect, collision-separate, world-bounds, keyboard-capture, input-action, intent-move, sprite, animation-clip, camera, state-machine, state-transition, spawn, destroy, timer, counter |
| **俯视角 RPG** | transform, velocity, mass, bbox, collision-detect, trigger-zone, keyboard-capture, input-action, intent-move, intent-interact, resource, resource-regen, timer, flag, sprite, animation-clip, tint, status-bar, floating-text, state-machine, state-transition, audio-clip |
| **弹幕射击** | transform, velocity, acceleration, bbox, bcircle, collision-detect, world-bounds, keyboard-capture, input-action, sprite, timer, resource, counter, spawn, destroy, camera, floating-text |

> 35 个原子，0 个组合层 Skill，依然能描述完整游戏。这是真正的原子。
