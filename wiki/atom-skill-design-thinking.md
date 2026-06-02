# Apollo Engine — 原子 Skill 设计思考过程

> 本文记录了从 v1→v3 的完整推导过程和设计决策，供外部审阅和反馈。

---

## 1. 我们在做什么

Apollo Engine 是一个 AI-native 的游戏框架。核心理念是：**游戏由原子能力（Atom Skill）组合而成**。每个 Atom Skill 是一个自描述的 ECS Capability，包含组件定义、系统逻辑、LLM 描述和编辑器参数。

我们需要定义一张"游戏元素周期表"——列出所有简单 2D 游戏的基础原子构件。不为某个具体游戏设计，而是游戏这个概念本身的不可再分单元。

之后的工作流是：主程 Claude 规划下一批 Atom Skill → 分配给 3 个并行 session 开发 → 交叉审核 → 循环。当原子积累到临界量，游戏从组合中涌现。

---

## 2. 判定标准

**一个 Atom Skill 必须满足：**
- 不能用其他两个原子的组合描述出来
- 只回答一个且仅一个问题
- 去掉它，某类游戏就无法存在

**不是原子的标志：**
- 它是两个已有原子的时序组合（如 animation = frame + timer）
- 它是某个原子的特化（如 keyboard-capture 和 touch-capture 都是 input-capture 的特例）
- 它需要上下文才有意义（如 grounded 需要 collision + tag 才能工作）

---

## 3. 三轮迭代过程

### v1 (37 个) — 从游戏品类常见系统出发

思路：列出平台跳跃、RPG、射击等游戏的常见系统，每个系统一个 Skill。

问题：
- 混淆了"系统"和"原子"。friction（摩擦）其实是 acceleration + velocity 的组合策略
- poison、shield、invincible 是 health + timer 的组合，不是基础构件
- ai-brain 太大，一个 Skill 装不下，该拆成多个行为模式
- animation 一个 Skill 解决了帧播放+状态切换，不够原子

### v2 (35 个) — 参考《Game Engine Architecture》分层

参考 Jason Gregory 的分层模型：collision detection 比 physics 更底层，skeletal animation clip 比 state machine 更底层。

改进：
- 把 poison/shield/invincible/cooldown/knockback 移到"组合层"
- 把 collision-resolve 拆成 collision-separate（推开）和 collision-bounce（弹性反弹）
- 把 ai-brain 拆成 patrol/chase/flee/attack 四个独立行为
- 把 health 泛化为通用 resource { id, current, max }

问题（用户反馈）：
- 还是不够原子。collision-separate 和 collision-bounce 是碰撞检测的消费策略，不是原子
- patrol/chase/flee/attack 连 Tier 1 组合都不配，是 Tier 3-4 级别的复合行为
- resource-regen 是 resource + timer 的组合
- intent-move/intent-interact 是 action-map 的特化

### v3 (24 个) — 回归第一性原理

思路切换：不从"游戏品类需要什么"出发，而是问"游戏世界里有哪些不可替代的独立概念？"

用物理学类比：
- 位置、速度、质量、时间是基本量
- 力、加速度、能量是导出量
- 游戏也应该有"基本量"和"导出量"

最终 24 个原子，按概念域分组：

| 域 | 原子 | 回答的问题 |
|----|------|-----------|
| 空间 (3) | position, rotation, scale | 它在哪？朝哪？多大？ |
| 运动 (3) | velocity, acceleration, mass | 它怎么动？速度怎么变？多重？ |
| 形状 (1) | shape | 它占多大空间？什么形状？ |
| 碰撞 (1) | overlap-detect | 它碰到了什么？ |
| 时间 (1) | timer | 过了多久？到了吗？ |
| 数值 (3) | resource, counter, flag | 有多少(有上限)？多少(无上限)？开还是关？ |
| 标识 (2) | tag, relation | 它是谁？跟谁有关系？ |
| 输入 (2) | input-capture, action-map | 外部说了什么？对应什么动作？ |
| 状态 (1) | state | 它处于什么模式？ |
| 生命周期 (2) | spawn, destroy | 创建/销毁实体 |
| 视觉 (3) | sprite, color, frame | 用什么图？什么色？第几帧？ |
| 音频 (1) | sound | 播什么声音？ |
| 显示 (2) | bar-display, text-display | UI 信息怎么呈现？ |

---

## 4. 涌现分层模型

原子之上是 4 层涌现：

```
原子 (24)
  ↓
Tier 1 — 两个原子直接组合
  motion-apply = velocity + position
  animation = frame + timer
  lifetime = timer + destroy
  
Tier 2 — 三个以上原子组合
  gravity = acceleration + mass + flag
  collision-separate = overlap-detect + position + mass
  grounded = overlap-detect + tag + flag
  cooldown = timer + flag
  
Tier 3 — 复合系统
  health-system = resource(hp) + bar-display
  shield = resource(shield) + resource-modify 拦截
  poison = timer + resource-modify
  platformer-jump = action-map + flag(grounded) + velocity
  
Tier 4 — 高级行为
  ai-patrol = state + timer + velocity
  ai-chase = state + relation + position + velocity
  dialogue = trigger-zone + state + text-display + input
  inventory = counter + flag + resource-modify
```

关键验证：用纯 24 个原子（不用任何组合层 Skill）能直接描述平台跳跃、弹幕射击、回合制 RPG 三种游戏。

---

## 5. 参考来源

- **Jason Gregory《Game Engine Architecture》**：分层模型——collision detection 比 physics 更底层，skeletal clip 比 state machine 更底层
- **Bevy ECS (Rust)**：Position/Velocity/Sprite 分离，细粒度原子组件
- **Flecs**：模块化组件系统，800+ 组件用分层管理
- **Unity DOTS**：SystemGroup 排序，SoA 内存布局
- **Hazelight (双影奇境)**：UE5 + AngelScript，DefaultComponent 模式，无耦合组件组合

---

## 6. 待解决的问题

1. **v2 的 transform 拆成 position/rotation/scale 是否过度？** 大部分实体三者都有，拆开后每次空间计算都要 query 三个组件。是概念纯粹重要还是实用效率重要？

2. **shape 合并 box 和 circle 到一个组件是否合理？** 用 kind 字段区分。如果未来加 polygon，shape 会不会膨胀？

3. **碰撞只有一个 overlap-detect 原子，响应全推到组合层。** 这意味着最基础的"两个东西碰了会推开"需要 Tier 2 才能实现，开发者的最小可用集是否太高？

4. **bar-display 和 text-display 是否算原子？** 它们是 UI 层的呈现方式，跟引擎核心概念不在同一层级。

5. **camera 去哪了？** 摄像机跟随 = relation + position，震动 = timer + position-offset。但 camera 在几乎所有游戏中都存在，是否值得作为独立原子？

---

## 7. 寻求反馈

请评审以下内容：
1. 24 个原子是否有遗漏或冗余？
2. 判定标准（不能由两个原子组合描述）是否合理？
3. 涌现分层（Tier 1-4）的划分是否清晰？
4. 上述 5 个待解决问题的建议？
