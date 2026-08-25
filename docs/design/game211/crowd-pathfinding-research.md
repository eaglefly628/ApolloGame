# 群体 AI 寻路 · 调研（owner 2026-08-10 要求）

> **结论先行**：对「上千单位涌向少数目标 + 大地图」这个场景，**Flow Field（流场）是对症解**；
> 本仓现成的 **A*-per-agent 会撞墙**——实测两者差 **2~3 个数量级**，且 A* 有 500ms 级的首拍卡死。
> 所有数字来自 `games/game211/pathfind-scale.bench.test.ts`（真引擎能力 + 参考实现·非估算）。

---

## §1 先查本仓有什么（实查留痕·非印象）

| 面 | 现成能力 | 实现要点 |
|---|---|---|
| 连续空间寻路 | `t2-pathfind` | `NavGraph{nodes,edges}` 纯数据 + 通用 A*，路径缓存进 `NavPath`，沿航点 steer |
| 网格寻路 | `t2-grid-move` | 六边形棋盘内建 A* |
| 固定轨道 | `t2-path-follow` | 航点巡逻/传送带·不索敌不绕障 |
| 局部避让 | `t2-steering{separation}` | 半径内同群邻居线性衰减斥力·走 `queryRange` 空间网格分桶 |
| 导航网烘焙 | `d2-navmesh-bake` | 静态几何 → 可走网格 |
| 邻居查询 | `queryRange` | **空间网格分桶**（`spatial-query/index.ts:81`）→ 复杂度跟邻居数走，不跟总数走 |

**没有的**（精确 grep `flowField/FlowField/流场/velocityObstacle/ORCA/boid`，零命中）：
流场 · ORCA/RVO · Continuum Crowds · 完整 Boids（只有 separation 一项）。

**⚠ 一条决定性的实现细节**：本仓 A* 的 open 表是**线性扫描取 min + `open.find()` 做 decrease-key**
（`src/engine/spatial/astar.ts:30-50`），单次查询约 **O(V²)**。
源码自己注明「小图用数组 + 线性取 min → 确定（不依赖插入/Map 序）」——
这不是缺陷，在小图上它更快也更确定；但它把「图能多大」这条约束摆到了台面上。

---

## §2 实测：A*-per-agent vs Flow Field

### ① A*-per-agent（本仓 `t2-pathfind`）

| 单位数 / 图规模 | 首拍（全体同时求路） | 稳态（走缓存路径） |
|---|---|---|
| 200 / 576 节点 | 176.0ms | 2.46ms/tick |
| 500 / 576 节点 | 112.9ms | 4.26ms/tick |
| 1000 / 576 节点 | 200.8ms | **9.12ms/tick** 🟡 |
| **500 / 2304 节点** | **534.1ms** ❌ | **20.36ms/tick** ❌ |

两条要命的地方：

1. **首拍 100~534ms**：所有单位同时求路 = **6~32 帧的卡死**。在 RTS 里这不是"慢一点"，是**画面停住**。
   而且它会反复发生——目标一变（前线推移、目标被打死）就要重算。
2. **对图规模超线性**：单位数不变（500），图从 576 → 2304 节点（4×），稳态从 4.26 → 20.36ms（**4.8×**）。
   这正是 O(V²) open 表的形状。**大地图直接出局**。

### ② Flow Field（Dijkstra 铺满 + 每单位 O(1) 查表）

| 图规模 | 铺场耗时（**一次·服务全部单位**） |
|---|---|
| 24×24 = 576 节点 | 0.83ms |
| 48×48 = 2304 节点 | 1.01ms |
| 96×96 = 9216 节点 | 1.57ms |
| **192×192 = 36864 节点** | **6.11ms** |

### ③ 查表本身

| 单位数 | 每 tick |
|---|---|
| 1000 | **0.0745ms** |
| 4000 | 0.1016ms |

### ④ 同口径对照（1000 单位 · 中等地图）

| | 首拍 | 稳态/tick | 大地图（36864 节点） |
|---|---|---|---|
| A*-per-agent | 200~534ms ❌ | 9~20ms ❌ | 外推到秒级 ❌ |
| **Flow Field** | **1.6ms** | **0.07ms** ✅ | 6.11ms 一次 + 0.07ms/tick ✅ |

**每 tick 差约 130~290 倍，且首拍卡死整个消失。**

---

## §3 算法谱系（群体寻路的三个正交子问题）

「群体寻路」不是一个算法，是三层。**分开选，别混着比**：

### A. 全局路径 —— 怎么绕过静态障碍走到目标

| 算法 | 成本形状 | 擅长 | 本项目判断 |
|---|---|---|---|
| **A\* per agent** | O(N × 单次A*) | 单位少、**目标各不相同** | ❌ 实测撞墙（§2） |
| **Flow Field / Vector Field** | O(V) 一次 + O(1)/单位 | **单位多、目标少** | ✅ **对症** |
| HPA\* / 分层寻路 | 分块预计算 + 块内 A* | 超大图 + 目标分散 | 🟡 备选：若将来目标真的很分散 |
| Navmesh + Funnel（Recast/Detour 系） | 多边形导航网 + 拉绳 | 复杂几何、路径要"贴墙走得漂亮" | 🟡 几何精度需求高时；本仓已有 `navmesh-bake` 半件 |
| JPS（Jump Point Search） | 均匀网格 A* 的对称性剪枝 | 网格图**单体**加速 | 🟡 只降常数，不改 O(N×…) 的形状 |
| 势场 / Potential Field | O(V) | 简单 | ❌ 有**局部极小**（凹形障碍卡死）；Dijkstra 铺满的流场没有这个病 |

> **为什么流场对我们特别对症**：我们的单位**目标高度集中**（推向对方基地 / 少数占领点）。
> A* 的成本 ∝ 单位数 × 图规模；流场 ∝ 图规模，**与单位数无关**。
> 场景与算法的成本形状**正好对上**，这才是选型的依据，不是"流场更先进"。

### B. 局部避让 —— 怎么不互相挤穿

| 算法 | 特点 | 本项目判断 |
|---|---|---|
| **Steering separation**（本仓已有） | O(邻居)·简单·确定性好·走空间网格 | ✅ **够用，已在跑** |
| ORCA / RVO2 | 数学保证无碰撞、轨迹平滑 | ❌ 每单位一个线性规划，O(N×邻居) 且常数大；浮点 LP 的确定性对 lockstep 是风险 |
| Social Force Model | 拟人（行人流） | ❌ 军事单位不该"像行人一样躲闪" |
| 物理刚体推挤 | 最真实 | ❌ 实测 150 刚体就吃满帧（`cannon-army-bench`），与"海量"直接冲突 |

### C. 群体协调 —— 怎么不堵死 / 保持队形

| 手段 | 说明 | 本项目判断 |
|---|---|---|
| Boids 三件套（separation / alignment / cohesion） | 我们只用了 separation | 🟡 alignment 可加，让同批单位朝向一致（观感提升，成本低） |
| **Continuum Crowds**（Treuille et al. 2006） | 流场 + **密度场**：拥堵反馈进代价，人群自动分流绕开堵点 | ⭐ **流场的自然升级**，正好治"所有人挤同一条路"，建议作 v2 |
| Formation slots（队形槽） | 单位占编队里的固定位 | 🟡 我们是"洪流"不是"小队"，暂不需要 |
| Flow field + 分层（局部场 / 全局场） | 近处细、远处粗 | 🟡 超大地图再说 |

---

## §4 流场的代价与坑（诚实列出·别只讲好处）

1. **一个场只服务一个目标**。K 个目标 = K 个场。实测 96×96 一个场 1.57ms ⇒ **~5 个目标可以，50 个不行**。
   → 我们的设计（对方基地 + 少数占领点）正好在这个范围内；若将来要"每个单位各自索敌"，流场不适用那一段
   （那段应该继续用现在的 `steering{seek}` 索最近敌人——**流场管"走到战场"，steering 管"打谁"**，两者分工）。
2. **动态障碍要重铺场**（建筑倒塌 / 残骸）。解法：分块重铺或降低重铺频率（每 N tick 一次），不必每帧。
3. **精度受网格分辨率限制**。格子粗了会"贴墙不自然"；96×96 覆盖 60×34 的战场已经够细。
4. **不能表达"每个单位有自己的目标"**。这是它与 A* 的根本分工线，不是缺陷。
5. **确定性反而是优势**：整数网格 + Dijkstra + 全序 tie-break ⇒ 比浮点 A* 更容易做到逐位可复现，
   对 lockstep / 录放友好。

---

## §5 建议的落地路径

| 期 | 做什么 | 收益 |
|---|---|---|
| **P0** | 把当前 demo 的「集结点 + `steering{seek}`」换成**单目标流场** | 立刻支持大地图 + 静态障碍；首拍卡死消失 |
| P1 | 多目标（占领点）：每目标一个场，单位按归属查 | 「投放点选择」有了地理意义 |
| P2 | 密度反馈（Continuum Crowds 思路）：拥堵格代价升高 | 治「全挤中路」，自动分流 |
| P3 | 地形代价进边权（公路快 / 沼泽慢 / 高地绕行） | 地形真正影响战术，而不只是贴图 |

**分工不变**：流场负责「走到战场」，`steering{separation}` 负责「别挤」，`steering{seek}` 负责「打谁」。
三层正交，互不替代。

---

## §6 归属：这是**引擎级能力**，该下沉（待裁）

**先查结论**：本仓无流场；且 A* / steering / path-follow 三者**重组不出**流场
（它们都是"每个单位自己算"的形状，而流场的本质是"算一次全场共享"——不是同一个数据流）。

**缺口裁决协议 · 摆两条路**（Lead 给推荐·不自裁）：

| | **A｜下沉引擎能力 `t2-flow-field`** | **B｜game211 游戏层自己实现** |
|---|---|---|
| 做什么 | 新能力：`FlowField{cellSize,origin,w,h,blocked?,goal}`（**纯摆放数据**）+ `FlowAgent{speed}`；系统铺场 + 写 `Velocity`，`runsBefore motion-apply`（与 steering 同链） | 在 `rts-demo.ts` 里写铺场与查表循环 |
| 代价 | 占 `docs/workflow/requests.md` 一个硬槽；要设计确定性与重铺策略 | **违反硬红线**「游戏层不写 movement system」（`movement-pathfinding.md` §③ 明文），且下一个 RTS/塔防/幸存者游戏还要再抄一遍 |
| 通用性 | 任何 RTS / 塔防 / 幸存者 / 大群怪 都要 | 零 |
| 选错要付什么 | 若最终只有 game211 用，多占一个槽 | 全库重复造轮子 + 破宣言 |

**Lead 推荐 A**。理由：
① 流场是**教科书级通用件**，不是 game211 专属；
② 手册 `movement-pathfinding.md` §⑤ 明写「新运动模式现有能力表达不了 → 提缺口，**不在游戏层写 movement system**」——这正是那条路径；
③ 它天生是**纯数据 + 确定性解释器**的形状（网格 + 边权 + Dijkstra），完全符合数据驱动宣言的尺子：
   最弱 LLM 只需要填「格子多大、哪些格不可走、目标在哪」。

**但这条归 owner/Lead 判**，本调研只摆事实与代价，不自裁、不先写代码。

---

## §7 一句话总结

> **A* 是"每个单位自己算"，流场是"算一次全场共享"。
> 我们的场景是上千单位涌向少数目标——成本形状正好对上流场，实测每 tick 差 130~290 倍、
> 且首拍 500ms 的卡死整个消失。局部避让继续用现成的 steering separation，两者正交叠加。**

---

## §8 最新技术补遗（owner 2026-08-10「我们给一些最新技术的调研」）

§3 那份是算法谱系。这一节补**近年工程实践**，给主程当施工依据。

### 8.1 业界怎么落地流场：三遍管线 + LOS 波

流场在工业界已经是**标准形态**，不是新东西——最早用于 **Supreme Commander 2**，后来 **Planetary Annihilation**
也是这条路。经典参考是 Elijah Emerson 的《Crowd Pathfinding and Steering Using Flow Field Tiles》（Game AI Pro 第 23 章）。

落地形态高度统一，就是 §6 spec 里那三遍：

1. **cost field** 通行代价 → 2. **integration field** 从目标多源 Dijkstra 铺满 → 3. **flow field** 每格取最优邻格方向

**值得单独拿出来的一条：LOS pass（视线波）。** Emerson 的实现里，波传播分两遍——
**先做一遍带视线判定的传播**，再做常规传播。作用是：**开阔地里的单位直指目标**，
而不是沿着网格量化出来的方向走出锯齿。这是「流场看起来假不假」的分水岭，成本很低，
已写进工单 M2。（参考实现 `yoreei/crowd_pathfinder` 的流程就是
`UpdateCostFields → PropagateWave(LOS) → PropagateWave → CalculateFlowFields`。）

### 8.2 外部实测：与我们的测量互相印证

`yoreei/crowd_pathfinder`（Unreal + flow-tile）对比 stock 寻路：

| 场景 | 流场 | stock | 倍数 |
|---|---|---|---|
| 50 单位 | 982.5 µs | 2.1 ms | 2× |
| 200 单位·简单图 | 1.6 ms | 6.3 ms | 4× |
| 200 单位·迷宫图 | 6 ms | 5.1 ms | 1.2×（几乎打平） |

**关键的一句在文字里，不在表里**：该实现明确指出
**`PropagateWave` 与 `CalculateFlowFields` 不随单位数增长，只有「转成引擎路径」的适配层随单位数增长。**

这正是我们自己测出来的结论（§2③：1000 单位查表 0.0745ms、4000 单位 0.1016ms —— 近乎常数）。
两边独立得到同一个结论，可信度高。

**同时也要读懂那条 1.2×**：迷宫图上优势缩到几乎没有。原因是迷宫里可走格少、A* 展开也少，
流场「铺满全图」的固定成本反而显得贵。⇒ **流场的优势与「开阔程度 × 单位数」正相关**。
我们的战场是开阔平原 + 上千单位，正好在它最擅长的那一端；但如果将来做巷战/隧道图，
要重新量，别照搬这里的倍数。

### 8.3 GPU 流场：能做，但我们**不该做**

近两年 Unity DOTS 生态出了 GPU compute shader 版流场（如 `kingstone426/NativeFlowField`），
把整个铺场丢给 GPU，宣称支持数千 agent 的动态环境实时重建。

**但对本仓不适用，理由是架构性的**：本仓的 sim **要进 hash、要 lockstep/录放**，
而 **GPU 浮点跨设备一致性是真风险**（不同驱动/精度模式结果可能不逐位相同）。
本仓的分工是明确的——**渲染面才是 render-only 自由区**（物理都被限定成 render-only 不进 hash），
sim 面必须确定性。流场属于 sim（它决定单位往哪走，进 hash），**留在 CPU**。

而且从我们自己的数字看也没必要：192×192 = 36864 格铺一次 6.11ms，分块增量后更低。
**GPU 是在解一个我们还没有的问题。** 已写进工单「明确不做」。

### 8.4 MAPF 那一族（CBS / LaCAM / 学习式）：**别引进来**

学术界近两年 MAPF（Multi-Agent Path Finding）很热，2025 年有综述
《Where Paths Collide: A Comprehensive Survey of Classic and Learning-Based Multi-Agent Pathfinding》（arXiv 2505.19219），
2026 年有动态环境的 D-MAPF 系统性研究（arXiv 2606.03735），还有 RL / CNN 策略式的
（如 RAILGUN, arXiv 2503.02992）。

**但那是另一个问题。** MAPF 求的是「为每个 agent 规划**互不冲突**的完整路径」——
典型场景是仓储机器人：不能撞、要保证到达、路径要可执行。它的代价是**联合规划**（CBS 之类要搜冲突树）。

RTS 要的不是这个：我们要的是**涌流 + 局部避让**——单位互相挤一挤、绕一绕都没关系，
甚至那正是「大军推进」的观感来源。**把 MAPF 引进 RTS 是过度设计**：
付出联合规划的代价，去买一个我们不需要的保证。已写进工单「明确不做」。

> 判断依据（记给后来人）：**看这个算法在为什么代价买什么保证**。
> MAPF 买的是「无冲突 + 完备性」，代价是联合搜索；RTS 不需要那个保证，所以不该付那个代价。

### 8.5 一句话给主程

> **流场不是新技术，是 2010 年代 RTS 就验证过的标准解；照三遍管线做，加 LOS 波提观感，
> 分块增量应对动态障碍。GPU 版和 MAPF 都别碰——一个破确定性，一个解错问题。**

**参考来源**：
- [Crowd Pathfinding and Steering Using Flow Field Tiles — Elijah Emerson, Game AI Pro Ch.23](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf)
- [yoreei/crowd_pathfinder — flow-tile 的 Unreal 实现与实测数据](https://github.com/yoreei/crowd_pathfinder)
- [How to RTS: Basic Flow Fields](https://howtorts.github.io/2014/01/04/basic-flow-fields.html)
- [RTS Pathfinding 1 – Flowfields — jdxdev](https://www.jdxdev.com/blog/2020/05/03/flowfields/)
- [kingstone426/NativeFlowField — Unity DOTS 的 GPU compute 流场](https://github.com/kingstone426/NativeFlowField)
- [Where Paths Collide: A Comprehensive Survey of Classic and Learning-Based MAPF (2025)](https://arxiv.org/abs/2505.19219)
- [On dynamic multi-agent pathfinding methods: review, simulations and modifications (2026)](https://arxiv.org/abs/2606.03735)
- [RAILGUN: A Unified Convolutional Policy for MAPF (2025)](https://arxiv.org/pdf/2503.02992)

---

## §9 归属结论（owner 2026-08-10 已判）

owner 拍板：**下沉引擎能力**，且**提给主程写**（本调研不施工、不抢锁）。
工单已入池：`docs/workflow/requests.md` → **`REQ-FLOWFIELD`**（P1·施工主体=主程·复查=Lead），
spec、确定性红线、M1~M4 分期、两条「明确不做」全部写死在单里。

---

## §9 SC2 与 Reynolds 原码实查（2026-08-24·owner 令「用文章中的代码去实现，不要自己去想」）

### 9.1 先说清楚能查到什么、查不到什么

**《星际争霸 II》不开源，没有代码可抄。** 公开的是 GDC 2011 上 Blizzard 首席工程师 James Anhalt 那场
关于 SC2 群体移动的讲述，以及围绕它的技术复述。可核实到的架构是**三层**：

1. **地形 → 导航网格**：对地形与建筑做**受约束 Delaunay 三角剖分**（建筑增删时重算并缓存）；
2. **路径**：在 navmesh 上跑经典 **A\***，再用 **funnel 算法**把折线拉直（按单位半径收边）；
3. **局部**：上面再叠**转向 + 碰撞避让**层——**转向模型基于 Craig Reynolds 的 Boids**。

⇒ 所以「SC2 的分离力怎么写」这个问题，能落到代码的答案**就是 Reynolds 那一套**。
（另注：SC2 走的是 navmesh+A\*，**不是**流场；流场那一脉的公开工程实现是
Supreme Commander 2 的 Elijah Emerson，即 Game AI Pro 第 23 章 flow-field tiles。
本仓走流场是因为我们的实测：A\*-per-agent 在 500 单位/2304 格上首拍 619ms。）

### 9.2 抄到的原码（Reynolds 本人的 OpenSteer）

`meshula/OpenSteer` · `include/OpenSteer/SteerLibrary.h` · `steerForSeparation`：

```cpp
// add in steering contribution
// (opposite of the offset direction, divided once by distance
// to normalize, divided another time to get 1/d falloff)
const Vec3 offset = (**otherVehicle).position() - position();
const float distanceSquared = offset.dot(offset);
steering += (offset / -distanceSquared);
...
steering = steering.normalize();
```

`src/SimpleVehicle.cpp` · `applySteeringForce`（力**怎么施加**，这半条同样重要）：

```cpp
const Vec3 clippedForce = adjustedForce.truncateLength (maxForce ());   // 截断，不是归一化
Vec3 newAcceleration = (clippedForce / mass());
const float smoothRate = clip (9 * elapsedTime, 0.15f, 0.4f);
blendIntoAccumulator (smoothRate, newAcceleration, _smoothedAcceleration);  // 指数平滑，压抖
newVelocity += _smoothedAcceleration * elapsedTime;
newVelocity = newVelocity.truncateLength (maxSpeed ());
```

### 9.3 我们照做了什么、有意偏离了什么（偏离都带理由与实测）

| 项 | Reynolds 原码 | 本仓 `t2-flow-field` | 说明 |
|---|---|---|---|
| 衰减律 | `offset / -d²`（**1/d**） | **照抄** | 我第一版自创了线性 `1-d/R`，已换回原式；测试钉死「距离减半→力翻倍」（线性只会 1.5×） |
| 求和 | 逐邻居累加 | **照抄** | 「夹中间的合力相消≈0、边上的大」这条物理由求和保证 |
| 大小控制 | `normalize()` 后交给 maxForce 截断 + 质量 + **平滑累加器** + maxSpeed 截断 | **只截断，不归一化** | ⚠ **唯一有意偏离**：本引擎直接写速度，没有质量/dt/惯性那条链；照抄 normalize 的实测后果是「所有人受力一样大 ⇒ 整堆平移、间距恒 0.0100」 |
| 抖动抑制 | 加速度**指数平滑累加器** | 到达减速带 + settle 系数 | 效果已实测收敛（间距 0.567→0.738→0.763→0.767 稳住）。若 Demo 里仍见抖，**上 canon 的平滑累加器**——代价是要给单位加一份引擎写的运行态（进 hash），届时再评估 |
| 邻域 | `inBoidNeighborhood`（min/max 距离 + 视角） | 流场网格的一格（本格 + 8 邻格） | 我们本来就有网格，拿它当邻居索引；视角项 RTS 用不上 |
| 标度 | `1/mass * dt` | 常数 `SEP_SCALE=0.1` | 那条链在本引擎里坍缩成一个常数 |

### 9.4 留给 Demo 之后再定的两件

1. **要不要上平滑累加器**（canon 治抖的正解·需给单位加进 hash 的运行态）；
2. **要不要 ORCA/RVO2**（`snape/RVO2` 有可读源码）——它给的是「保证不碰撞」的强承诺，
   代价是每单位解线性规划。owner 的方向是「软力、允许瞬时重叠」，与 ORCA 的承诺**不是一回事**，
   除非 Demo 显示软力压不住，否则不引进（见 §8 对 MAPF 的同款判断）。

**来源**：
- [Game AI Pro Ch.23 · Crowd Pathfinding and Steering Using Flow Field Tiles（Emerson）](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf)
- [OpenSteer（Reynolds 本人的库·本节代码出处）](https://github.com/meshula/OpenSteer)
- [RVO2（ORCA 参考实现·备选）](https://github.com/snape/RVO2)
- [SC2 群体移动的技术复述（GDC 2011 James Anhalt 那场）](https://ap011y0n.github.io/Group-Movement/)
- [GameDev.net：SC2 用 CDT navmesh + A\* + funnel 的讨论串](https://gamedev.net/forums/topic/648438-how-to-do-starcraft-2-pathfinding/)
