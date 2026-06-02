# Apollo Engine — 原子 Skill 清单 (游戏元素周期表)

> 从游戏底层语义出发，列出所有简单 2D 游戏的基础构件。
> 不为某个具体游戏设计，而是游戏这个**概念本身**的原子能力。
>
> 审核状态: 待审核

---

## 分层总览

```
Layer 0 — 时空基础    让实体存在于世界中，有位置、有时间
Layer 1 — 物理交互    让实体能动、能碰、能受力
Layer 2 — 资源生命    让实体有数值、有状态、能死能活
Layer 3 — 输入意图    让玩家和 AI 能操控实体
Layer 4 — 行为状态    让实体有行为模式、有有限状态
Layer 5 — 视听反馈    让一切变化被看到、听到
```

---

## Layer 0 — 时空基础

| # | Atom Skill | 语义 | provides | reads | 说明 |
|---|-----------|------|----------|-------|------|
| 0.1 | **transform** | Config/Render | `Transform { x, y, rotation, scaleX, scaleY }` | — | 位置、朝向、缩放。一切空间计算的根。 |
| 0.2 | **timer** | Resource/Effect | `Timer { elapsed, duration, loop }`, `TimerDoneEvent` | — | 通用倒计时/计时器。冷却、延迟、动画计时的基础。 |
| 0.3 | **lifetime** | Effect | `Lifetime { remainingTicks }` | — | 实体生存期。归零后自动销毁实体（子弹、特效粒子、临时物体）。 |
| 0.4 | **tag** | Marker | `Tag { tags: string[] }` | — | 实体标签/分组。碰撞过滤、阵营判断、查询筛选的基础。 |

---

## Layer 1 — 物理交互

| # | Atom Skill | 语义 | provides | reads | 说明 |
|---|-----------|------|----------|-------|------|
| 1.1 | **velocity** | Resource | `Velocity { vx, vy }` | `Transform` | 速度。每帧按 vx/vy 更新 Transform 位置。 |
| 1.2 | **gravity** | Config/Effect | `Gravity { force }` | `Velocity` | 重力。每帧给 Velocity.vy 加力。平台跳跃、抛物线的基础。 |
| 1.3 | **friction** | Config | `Friction { factor }` | `Velocity` | 摩擦力/阻力。每帧衰减 Velocity。用于地面减速、空气阻力。 |
| 1.4 | **bounding-box** | Config | `BoundingBox { width, height, offsetX, offsetY }` | `Transform` | 碰撞包围盒。定义实体的物理占位大小。 |
| 1.5 | **collision-detect** | Event | `CollisionEvent { entityA, entityB, overlapX, overlapY }` | `Transform`, `BoundingBox`, `Tag` | 碰撞检测。每帧扫描重叠，产生 CollisionEvent。不处理响应。 |
| 1.6 | **collision-resolve** | — (纯逻辑) | — | `CollisionEvent`, `Transform`, `Velocity` | 碰撞响应。消费 CollisionEvent，推开实体或反弹。 |
| 1.7 | **world-bounds** | Config | `WorldBounds { minX, minY, maxX, maxY }` | `Transform`, `Velocity` | 世界边界。阻止实体出界。 |

---

## Layer 2 — 资源与生命

| # | Atom Skill | 语义 | provides | reads | 说明 |
|---|-----------|------|----------|-------|------|
| 2.1 | **health** | Resource | `Health { current, max }`, `Dead` | `HealthModifyEvent` | 生命值。已实现。 |
| 2.2 | **shield** | Resource | `Shield { current, max }` | `HealthModifyEvent` | 护盾。拦截伤害。已实现。 |
| 2.3 | **stamina** | Resource | `Stamina { current, max, regenRate }` | `StaminaCostEvent` | 体力值。跑步、翻滚、重击消耗，自动回复。 |
| 2.4 | **resource-pool** | Resource (通用) | `ResourcePool { id, current, max, regenRate }` | `ResourceModifyEvent` | 通用资源池。MP、弹药、能量、怒气等都是它的实例。 |
| 2.5 | **poison** | Effect | `Poisoned { damagePerTick, remainingTicks }` | — | 中毒持续伤害。已实现。 |
| 2.6 | **cooldown** | Effect | `Cooldown { skillId, remainingTicks }` | — | 技能冷却。阻止同一技能连续使用。 |
| 2.7 | **invincible** | Effect/Marker | `Invincible { remainingTicks }` | `HealthModifyEvent` | 无敌帧。拦截所有伤害事件。受击后短暂无敌。 |

---

## Layer 3 — 输入与意图

| # | Atom Skill | 语义 | provides | reads | 说明 |
|---|-----------|------|----------|-------|------|
| 3.1 | **key-input** | Event | `KeyboardListener`, `HealthModifyEvent` | — | 键盘输入。已实现（demo 用途，后续会泛化）。 |
| 3.2 | **input-map** | Config/Event | `InputMap { action→key }`, `ActionEvent { action }` | — | 输入映射。将原始按键转为语义动作（jump, attack, move_left）。解耦键位和逻辑。 |
| 3.3 | **move-intent** | Intent | `MoveIntent { dirX, dirY }` | `ActionEvent` | 移动意图。将 ActionEvent 转为方向意图，由 velocity 消费。 |
| 3.4 | **jump-intent** | Intent | `JumpIntent { force }` | `ActionEvent`, `Grounded` | 跳跃意图。仅在 Grounded 状态下生效，给 Velocity.vy 一个冲量。 |
| 3.5 | **attack-intent** | Intent | `AttackIntent { target, skillId }` | `ActionEvent`, `Cooldown` | 攻击意图。检查冷却后发出攻击。 |
| 3.6 | **ai-brain** | Intent | `AIBrain { strategy }` | 多种 (Health, Transform, Tag...) | AI 决策。读取世界状态，产出 MoveIntent / AttackIntent 等。 |

---

## Layer 4 — 行为与状态

| # | Atom Skill | 语义 | provides | reads | 说明 |
|---|-----------|------|----------|-------|------|
| 4.1 | **state-machine** | Config/Marker | `StateMachine { current, transitions }`, `StateChangeEvent` | 多种触发条件 | 有限状态机。idle→walk→run→jump→attack→hurt→dead。 |
| 4.2 | **grounded** | Marker | `Grounded` | `CollisionEvent`, `Transform` | 着地检测。是否站在地面上。跳跃、下落状态的判据。 |
| 4.3 | **knockback** | Effect | `Knockback { vx, vy, remainingTicks }` | `Velocity` | 击退效果。受击后施加瞬间速度偏移。 |
| 4.4 | **spawn** | Event | `SpawnRequest { templateId, x, y }`, `Spawned` | — | 生成实体。用于发射子弹、召唤物、掉落物。 |
| 4.5 | **destroy-on-contact** | Marker/Logic | `DestroyOnContact` | `CollisionEvent` | 接触即销毁。子弹命中、陷阱触发、拾取物消失。 |
| 4.6 | **pickup** | Event | `Pickupable { effectType, amount }`, `PickupEvent` | `CollisionEvent`, `Tag` | 拾取系统。碰到可拾取物 → 触发效果（回血、加弹药、得分）。 |

---

## Layer 5 — 视听反馈

| # | Atom Skill | 语义 | provides | reads | 说明 |
|---|-----------|------|----------|-------|------|
| 5.1 | **status-bar** | Render | `StatusBarSource`, `BarDisplay` | 任意 Resource | 通用状态条。已实现。 |
| 5.2 | **sprite-render** | Render | `Sprite { textureKey, anchor }` | `Transform` | 精灵渲染。ECS → Phaser Sprite 同步。 |
| 5.3 | **animation** | Render | `AnimationState { current, loop, speed }` | `StateMachine` / 多种 | 动画控制。状态 → 播放对应动画。 |
| 5.4 | **screen-shake** | Render/Effect | `ScreenShake { intensity, duration }` | `HealthModifyEvent`, `CollisionEvent` | 屏幕震动。大伤害/碰撞时的镜头反馈。 |
| 5.5 | **flash-effect** | Render/Effect | `FlashEffect { color, duration }` | `HealthModifyEvent` | 闪白/闪红。受击瞬间的视觉反馈。 |
| 5.6 | **floating-text** | Render/Event | `FloatingText { text, color, x, y }` | `HealthModifyEvent` 等 | 飘字。伤害数字、治疗数字、经验值。 |
| 5.7 | **sound-trigger** | Render/Event | `SoundTrigger { soundId }` | 多种 Event | 音效触发。攻击声、受击声、拾取声。 |

---

## 统计

| Layer | 数量 | 状态 |
|-------|------|------|
| 0 — 时空基础 | 4 | 0 已实现 |
| 1 — 物理交互 | 7 | 0 已实现 |
| 2 — 资源生命 | 7 | 3 已实现 (health, shield, poison) |
| 3 — 输入意图 | 6 | 1 已实现 (key-input) |
| 4 — 行为状态 | 6 | 0 已实现 |
| 5 — 视听反馈 | 7 | 1 已实现 (status-bar) |
| **总计** | **37** | **5 已实现** |

---

## 涌现组合示例

当原子 Skill 积累后，游戏从组合中涌现：

| 游戏类型 | 需要的 Atom Skills |
|---------|-------------------|
| **平台跳跃** | transform + velocity + gravity + jump-intent + grounded + collision-detect + collision-resolve + world-bounds + sprite-render + animation |
| **俯视角 RPG** | transform + velocity + health + stamina + attack-intent + ai-brain + state-machine + collision-detect + pickup + floating-text |
| **弹幕射击** | transform + velocity + lifetime + spawn + destroy-on-contact + collision-detect + health + input-map + cooldown + screen-shake |
| **回合制战斗** | health + shield + resource-pool + attack-intent + ai-brain + state-machine + cooldown + status-bar + animation + floating-text |

> 同样 37 个原子，不同组合 → 不同游戏类型。这就是涌现。
