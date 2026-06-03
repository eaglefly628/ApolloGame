# Apollo Engine — 游戏开发知识库

> 按 Apollo 的 Tier 层级组织，每条资源直接映射到可开发的 skill。
> 只收录经过 AAA/知名商业游戏验证的方案。调研时间：2026-06-03

---

## 原则

- 只收录有**已上线游戏验证**的方案（标注验证游戏）
- 每条资源标注它对 Apollo **哪个 Tier / 哪个 skill** 有指导价值
- "能变成 skill" > "有意思"

---

## 一、经验证的 ECS 架构参考

| 来源 | 验证游戏 | 核心要点 | 对 Apollo 的价值 |
|------|---------|---------|-----------------|
| **守望先锋 ECS** — Timothy Ford, GDC 2017 ([Vault](https://www.gdcvault.com/play/1024001/)) | Overwatch (暴雪) | 混合 ECS + 确定性 63Hz tick + 网络回滚 | Tier 1: motion-apply 的确定性循环设计；W1 random 的确定性种子方案 |
| **地牢围攻数据驱动对象系统** — Scott Bilas, GDC 2002 ([PDF](https://www.gamedevs.org/uploads/data-driven-game-object-system.pdf)) | Dungeon Siege (Gas Powered Games) | 组合代替继承，处理 7300+ 对象类型 | defineCapability 模式的理论源头；assembly 蓝图设计 |
| **Celeste 物理与状态机** — Matt Thorson & Noel Berry | Celeste (Matt Makes Games) | 手写整数物理 + 极简状态机 + coyote time | Tier 2: grounded-check, collision-separate；Tier 4: platformer 行为 |
| **Hollow Knight 2D 碰撞** — Team Cherry | Hollow Knight | Unity 2D Physics + 自定义碰撞层 | Tier 2: collision-separate, trigger-zone；D1 overlap-detect 的 layer 设计 |
| **Dead Cells ECS 架构** — Sébastien Bénard | Dead Cells (Motion Twin) | Haxe + 自定义 ECS，实体池化 + 组件重用 | 对象池 skill（Tier 2）；spawn/destroy 的生命周期优化 |
| **Factorio 数据导向优化** — Wube Software | Factorio | 百万实体级 DoD 优化，空间分区 + belt 批处理 | W2 spatial-query 的网格分区实现；大规模实体性能 |

---

## 二、按 Tier 映射的技术参考

### Tier 1 — 直接结算 (Kinematic)

| Apollo Skill | 参考来源 | 验证 | 要点 |
|-------------|---------|------|------|
| **motion-apply** | Celeste source, *Game Programming Patterns* Ch.2 Game Loop | Celeste | 定步长 tick、子步进积分、整数/定点坐标避免浮点漂移 |
| **accel-apply** | *Game Physics Engine Development* (Millington) Ch.3 | — | 显式欧拉 vs 半隐式欧拉积分，Apollo 用半隐式（先更新速度再更新位置） |
| **hierarchy-resolve** | Unity Transform 源码, Godot Node2D | Unity/Godot | 脏标记 + 延迟求解；避免每帧全量矩阵乘法 |
| **animation** | *Game Programming Patterns* Ch.14 Type Object | — | frame.index++ per timer，帧动画是 timer → frame 的直接映射 |
| **lifetime** | Dead Cells 实体池 | Dead Cells | timer done → destroy，配合对象池回收而非真正 delete |

### Tier 2 — 规则与约束 (Resolution)

| Apollo Skill | 参考来源 | 验证 | 要点 |
|-------------|---------|------|------|
| **gravity** | Box2D v3 b2World_Step, Celeste | 多款 | 重力是常量加速度，不是力——直接写 acceleration.ay，不走力学积分 |
| **collision-separate** | *Real-Time Collision Detection* (Ericson) Ch.4, Box2D Position Solver | 行业标准 | AABB 穿透分离：按 mass 比推开，normal × depth |
| **collision-bounce** | Box2D Contact Solver, *2D Game Collision Detection* (Schwarzl) | 行业标准 | 弹性碰撞：反射速度 = v - 2(v·n)n × restitution |
| **grounded-check** | Celeste "coyote time" 实现 | Celeste | overlap + tag(ground) + 宽容时间窗 → flag(grounded) |
| **trigger-zone** | Hollow Knight 触发区域设计 | Hollow Knight | overlap + tag(trigger) → 事件，不产生物理响应 |
| **friction** | Box2D v3 摩擦模型, *Game Physics Cookbook* (Szauer) | 行业标准 | 库仑摩擦简化：速度方向的反向加速度，clamp 到零 |
| **range-detect** | Factorio 空间分区, *Real-Time Collision Detection* Ch.7 | Factorio | spatial-query(radius) → relation(target)，网格分区 O(1) |
| **damage-number** | 暗黑破坏神系列, 原神 | 多款 | resource-modify → spawn + text + velocity(上飘) + lifetime |
| **ui-binding** | React/Unity UI Toolkit 数据绑定模式 | 行业通用 | resource → UI 层单向投影，不参与 ECS 内部结算 |

### Tier 3 — 系统级玩法 (Mechanics)

| Apollo Skill | 参考来源 | 验证 | 要点 |
|-------------|---------|------|------|
| **health-system** | *Game Programming Patterns* Ch.5 Observer | 几乎所有游戏 | resource(hp) + resource-modify + ui-binding，事件链 |
| **platformer-jump** | Celeste 跳跃手感调优, *Juice it or Lose it* (GDC 2012) | Celeste | action-map + flag(grounded) + velocity + 可变重力（上升轻、下落重） |
| **projectile** | Dead Cells 弹幕系统 | Dead Cells | spawn + velocity + lifetime + overlap + destroy，配合对象池 |
| **knockback** | Hollow Knight 击退设计 | Hollow Knight | timer + velocity(覆写) + 无敌帧联动 |
| **auto-target** | Hades 自动索敌 | Hades | spatial-query(nearest) + tag(enemy) + relation(target) |

### Tier 4 — 心智与行为 (Behaviors)

| Apollo Skill | 参考来源 | 验证 | 要点 |
|-------------|---------|------|------|
| **ai-patrol** | *AI for Games* (Millington) Ch.3 Steering | 行业通用 | state + timer + velocity(方向切换)，巡逻路径点 |
| **ai-chase** | F.E.A.R. GOAP — Jeff Orkin, GDC 2006 ([PDF](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf)) | F.E.A.R. | state + spatial-query(nearest) + relation(target)，GOAP 比 FSM 更灵活 |
| **dialogue** | *Procedural Narrative Generation* GDC 2017, 模拟人生涌现叙事 GDC | Sims 系列 | trigger-zone + state + input + string-variable |
| **anim-state-machine** | Hollow Knight 动画状态机, Spine AnimationState | Hollow Knight | state + transition-rules + animation，双轨道混合 |

### 乙游方向 (Tier 3/4 扩展)

| Apollo Skill | 参考来源 | 验证 | 要点 |
|-------------|---------|------|------|
| **check.resolve** | 效用 AI — Dave Mark, GDC 2010 ([Vault](https://www.gdcvault.com/play/1012410/)) | 多款策略/RPG | 响应曲线 + 权重计算检定分数，domainSlot 插入关系值修正 |
| **love-interest.event** | 火焰纹章支援系统, 乙游通用 | FE 系列 | resource 阈值触发 → 情感选择 → 多路径后果 |
| **settlement.resolve** | 信长之野望/三国志 周期结算, Persona 系列 | 多款 | 三线资源汇总 → 解锁判定 → 下一周期配置 |

---

## 三、物理引擎选型（已验证）

| 引擎 | 验证游戏 | 推荐场景 | Apollo 集成方式 |
|------|---------|---------|----------------|
| **Box2D v3** | Angry Birds, Limbo, Crayon Physics | 标准 2D 物理 | 双世界同步：ECS Transform ↔ Box2D Body |
| **Rapier 2D** | Bevy 生态游戏 | 需要跨平台确定性 | 同上 + 确定性保证 |
| **Matter.js** | Phaser 内置 | 快速原型 | 最简集成，性能天花板低 |
| **自写 AABB** | Celeste, Dead Cells | 平台跳跃类 | Apollo D1 overlap-detect 已有，足够 platformer |

---

## 四、渲染与动画（已验证）

| 技术 | 验证游戏/引擎 | Apollo 集成 |
|------|-------------|------------|
| **PixiJS** | 数千款 HTML5 游戏 | 替换 CanvasRenderer，Sprite 批处理性能提升 10 倍+ |
| **Spine** | Hollow Knight, Dead Cells, Hades | 扩展层 X1 skeletal-pose 的姿态快照来源 |
| **Live2D** | 明日方舟, 碧蓝航线, 大量乙游 | 扩展层 ×，参数快照模式，适合少量高品质角色 |
| **Canvas2D** | Apollo 当前 | 够用于 MVP，后续可平滑升级 |

---

## 五、必读清单（3 份，按角色）

### 给主程序（写 skill 的人）

1. [Game Programming Patterns](https://gameprogrammingpatterns.com/) — 免费在线，直接覆盖所有核心模式
2. [Building an ECS 系列](https://ajmmertens.medium.com/building-an-ecs-1-where-are-my-entities-and-components-63d07c7da742) — ECS 存储层原理
3. [Mike Acton CppCon 2014](https://www.youtube.com/watch?v=rX0ItVEVjHc) — 1 小时视频，DoD 核心思想
4. *2D Game Collision Detection* (Schwarzl) — Tier 2 碰撞 skill 的算法参考
5. Celeste 源码分析 — platformer 手感的黄金标准

### 给设计师（设计乙游玩法的人）

1. 效用 AI — Dave Mark GDC 2010 演讲 — 情感决策系统的数学基础
2. *AI for Games* (Millington) — FSM/行为树/GOAP 选型
3. 模拟人生涌现叙事 GDC 演讲 — 涌现式叙事如何实现
4. 火焰纹章支援系统分析 — 关系值 + 事件触发的经典实现

### 给架构师（设计引擎的人）

1. *Game Engine Architecture* (Gregory 4e) — 引擎全局视野
2. 守望先锋 GDC 2017 — 工业级 ECS 的确定性 + 网络同步
3. *Real-Time Collision Detection* (Ericson) — 碰撞与空间分区的金标准
4. Factorio 技术博客 — 百万实体级优化思路
