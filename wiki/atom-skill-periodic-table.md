# Apollo Engine — 原子 Skill 清单 v3 (游戏元素周期表)

> **判定标准：能用其他原子的组合描述出来的，不是原子。**
> **每个原子回答一个且仅一个问题。**
>
> 审核状态: v3 待审核

---

## 原子表 (Atom Table)

### 空间 — "它在哪？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| A1 | **position** | `Position { x, y }` | 实体在世界的什么位置？ |
| A2 | **rotation** | `Rotation { angle }` | 实体朝哪个方向？ |
| A3 | **scale** | `Scale { sx, sy }` | 实体有多大？ |

> v2 的 transform 是这三者的打包。拆开后每个都是独立概念：一个实体可以有位置但没有旋转（UI 元素），可以有缩放但没有位置（全局设置）。

### 运动 — "它怎么动？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| B1 | **velocity** | `Velocity { vx, vy }` | 实体当前往哪移、多快？ |
| B2 | **acceleration** | `Acceleration { ax, ay }` | 实体的速度在怎么变？ |
| B3 | **mass** | `Mass { value }` | 实体有多重？（0=不可移动） |

### 形状 — "它占多大地方？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| C1 | **shape** | `Shape { kind: 'box'|'circle', width?, height?, radius? }` | 实体的碰撞/占位形状是什么？ |

> v2 拆成 bounding-box 和 bounding-circle 两个 skill，但"形状"才是原子概念。具体是什么形取决于 kind 字段。

### 碰撞 — "它碰到了什么？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| D1 | **overlap-detect** | `Overlap { entityA, entityB, normalX, normalY, depth }` | 哪两个实体重叠了？重叠方向和深度是多少？ |

> 这是纯检测——只产生事实描述（谁碰了谁），不做任何响应。碰撞分离、弹性反弹、触发区域、地面检测全部是它的消费者。一个原子足矣。

### 时间 — "过了多久？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| E1 | **timer** | `Timer { id, elapsed, duration, loop }`, `TimerDone { timerId }` | 这个倒计时/间隔走了多久？到了吗？ |

> cooldown、lifetime、dot 间隔、无敌帧、动画帧进等全部是 timer 的实例或消费者。

### 数值 — "它有多少？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| F1 | **resource** | `Resource { id, current, max }`, `ResourceModify { resourceId, amount }` | 某种有上限的数值是多少？（HP、MP、弹药、体力） |
| F2 | **counter** | `Counter { id, value }`, `CounterModify { counterId, delta }` | 某种无上限的数值是多少？（分数、击杀数、金币） |
| F3 | **flag** | `Flag { id, active }` | 某个条件是开还是关？（门锁、无敌、已触发） |

### 标识 — "它是谁？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| G1 | **tag** | `Tag { tags: string[] }` | 实体属于哪些分类？（player, enemy, ground, projectile） |
| G2 | **relation** | `Relation { kind, targetId }` | 实体跟谁有什么关系？（parent-of, owned-by, targeting） |

> v2 的 hierarchy 只是 relation(kind='parent') 的特例。relation 是更原子的概念。

### 输入 — "外部说了什么？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| H1 | **input-capture** | `RawInput { source, key?, x?, y?, phase? }` | 这一帧外部有什么原始信号进来？（键盘/触摸/手柄统一） |
| H2 | **action-map** | `Action { name, value }` | 原始信号对应什么语义动作？（jump=1.0, move_x=-0.5） |

> v2 拆成 keyboard-capture + touch-capture，但输入源不是概念区别——都是"外部信号"。统一为一个 input-capture，按 source 区分。action-map 是唯一的翻译层。

### 状态 — "它处于什么模式？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| I1 | **state** | `State { current, previous }`, `StateChanged { from, to }` | 实体当前处于什么离散状态？刚发生了什么切换？ |

> 纯数据容器 + 切换事件。不含转换规则——规则是消费者（组合层的事）。

### 生命周期 — "它存在吗？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| J1 | **spawn** | `SpawnRequest { templateId, x, y }` | 需要在世界中创建一个新实体。 |
| J2 | **destroy** | `DestroyRequest { entityId }` | 需要从世界中移除一个实体。 |

### 视觉 — "它看起来什么样？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| K1 | **sprite** | `Sprite { textureKey, anchorX, anchorY, visible }` | 实体用什么图显示？ |
| K2 | **color** | `Color { tint, alpha }` | 实体当前是什么颜色/透明度？ |
| K3 | **frame** | `Frame { index, total }` | 精灵当前显示第几帧？（动画的最小单位） |

> v2 的 animation-clip 是 frame + timer 的组合。frame 才是原子——"当前第几帧"。帧怎么推进是 timer 的事。

### 音频 — "它听起来什么样？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| L1 | **sound** | `Sound { clipId, volume, loop }` | 播放一个声音。 |

### 显示 — "信息怎么呈现？"

| # | Atom | Component | 回答的问题 |
|---|------|-----------|-----------|
| M1 | **bar-display** | `BarSource { resourceId, label, colors }`, `BarDisplay { pct, color, label, val, max }` | 用条形展示一个 resource 数值。 |
| M2 | **text-display** | `TextDisplay { text, color, x, y, lifetime? }` | 在某个位置显示文字。 |

---

## 原子总数：24

```
空间:     A1 position    A2 rotation     A3 scale
运动:     B1 velocity    B2 acceleration B3 mass
形状:     C1 shape
碰撞:     D1 overlap-detect
时间:     E1 timer
数值:     F1 resource    F2 counter      F3 flag
标识:     G1 tag         G2 relation
输入:     H1 input-capture  H2 action-map
状态:     I1 state
生命周期: J1 spawn       J2 destroy
视觉:     K1 sprite      K2 color        K3 frame
音频:     L1 sound
显示:     M1 bar-display M2 text-display
```

---

## 涌现分层 (Emergence Tiers)

### Tier 1 — 两个原子的直接组合

| 组合 | 原子公式 | 说明 |
|------|---------|------|
| motion-apply | velocity + position | 每帧 pos += vel |
| accel-apply | acceleration + velocity | 每帧 vel += accel |
| rotation-apply | angular-vel(=velocity变体) + rotation | 每帧 rot += omega |
| animation | frame + timer | 每帧按 timer 推进 frame.index |
| lifetime | timer + destroy | timer 到期 → destroy |
| boundary-clamp | position + shape(世界边界) | 不让实体出界 |

### Tier 2 — 三个或更多原子的组合

| 组合 | 原子公式 | 说明 |
|------|---------|------|
| gravity | acceleration + mass + flag(gravity-on) | 持续向下加速 |
| friction | acceleration + velocity + mass | 速度反向衰减 |
| collision-separate | overlap-detect + position + mass | 按质量比推开 |
| collision-bounce | overlap-detect + velocity + mass | 弹性反弹 |
| grounded-check | overlap-detect + tag(ground) + flag(grounded) | 脚底有地面→标记着地 |
| trigger-zone | overlap-detect + tag(trigger) + flag | 进入区域→触发 |
| resource-regen | resource + timer | 定时回复 |
| cooldown | timer + flag | 计时器到→开关打开 |
| input-intent | action-map + state + resource(检查) | 动作→意图（检查前置条件） |

### Tier 3 — 复合系统

| 组合 | 来源 | 说明 |
|------|------|------|
| health-system | resource(hp) + resource-modify + bar-display | 血量+伤害+显示 |
| shield | resource(shield) + resource-modify 拦截链 | 伤害吸收 |
| poison | timer + resource-modify(周期触发) | 持续伤害 |
| invincible | timer + flag(block damage) | 无敌帧 |
| knockback | timer + velocity(覆写) | 击退 |
| pickup | trigger-zone + destroy + resource-modify | 拾取 |
| platformer-jump | input-intent + flag(grounded) + velocity(vy冲量) | 跳跃 |
| anim-state-machine | state + animation + state-transition-rules | 动画状态机 |

### Tier 4 — 高级行为

| 组合 | 来源 | 说明 |
|------|------|------|
| ai-patrol | state + timer + velocity(方向切换) | 巡逻 |
| ai-chase | state + position(自己) + relation(target) + velocity | 追击 |
| ai-flee | state + position + relation(threat) + velocity | 逃跑 |
| ai-attack-pattern | state + timer(cooldown) + spawn(弹幕) | 攻击模式 |
| dialogue-system | trigger-zone + state + text-display + input-capture | 对话 |
| inventory | counter(多个slot) + flag(equipped) + resource-modify | 物品栏 |

---

## 涌现验证

| 游戏类型 | 纯原子 (24个里用几个) |
|---------|---------------------|
| **平台跳跃** | position, velocity, acceleration, mass, shape, overlap-detect, timer, resource, flag, tag, input-capture, action-map, state, spawn, destroy, sprite, color, frame, sound (19/24) |
| **弹幕射击** | position, velocity, acceleration, shape, overlap-detect, timer, resource, counter, flag, tag, input-capture, action-map, spawn, destroy, sprite, frame, sound, text-display (18/24) |
| **回合制 RPG** | position, resource, counter, flag, tag, relation, input-capture, action-map, state, sprite, color, frame, sound, bar-display, text-display, timer (16/24) |

> 24 个原子，每个只回答一个问题，不可再拆。一切游戏行为从组合中涌现。
