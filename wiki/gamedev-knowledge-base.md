# Apollo Engine — 游戏开发知识库

> 2D ECS 游戏引擎开发的参考资源，涵盖开源项目、经典书籍、GDC 演讲、技术深挖。
> 调研时间：2026-06-03

---

## 一、ECS 框架（开源）

| 名称 | 仓库 | Stars | 语言 | 说明 |
|------|------|-------|------|------|
| **Bevy ECS** | [bevyengine/bevy](https://github.com/bevyengine/bevy) | ~46k | Rust | Archetype + Sparse Set 混合，并行调度 + 变更检测。ECS 引擎标杆 |
| **Flecs** | [SanderMertens/flecs](https://github.com/SanderMertens/flecs) | ~8.3k | C | 首个支持 Entity Relationships 的 ECS，v4.1 内存降 5 倍 |
| **EnTT** | [skypjack/entt](https://github.com/skypjack/entt) | ~12.7k | C++ | Sparse Set 架构，"按需付费"设计，被大量商业项目采用 |
| **bitECS** | [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS) | ~1.3k | TS/JS | 极简 SoA 存储，~5KB，零依赖。**与 Apollo 的 Web/TS 方向最直接相关** |
| **ECSY** | [ecsyjs/ecsy](https://github.com/ecsyjs/ecsy) | ~1.2k | JS | Mozilla 主导，API 清晰。已停维但架构设计仍是 JS ECS 经典 |
| **miniplex** | [hmans/miniplex](https://github.com/hmans/miniplex) | ~1k | TS | "温和"的实体管理器，注重 DX，适合 React/Three.js 集成 |
| **Becsy** | [LastOliveGames/becsy](https://github.com/LastOliveGames/becsy) | ~290 | TS | 目标多线程 ECS，融合 Flecs 思路。TS 生态最有野心的 ECS |
| **Hecs** | [Ralith/hecs](https://github.com/Ralith/hecs) | ~1k | Rust | 轻量 Archetype ECS，API 极简，易读易学 |

### ECS 学习资源

| 资源 | 链接 | 说明 |
|------|------|------|
| **ECS FAQ** | [SanderMertens/ecs-faq](https://github.com/SanderMertens/ecs-faq) | Flecs 作者写的 ECS 常见问题合集，必读 |
| **awesome-ecs** | [jslee02/awesome-entity-component-system](https://github.com/jslee02/awesome-entity-component-system) | ECS 库和资源的精选列表 |
| **ecs-benchmark (JS)** | [noctjs/ecs-benchmark](https://github.com/noctjs/ecs-benchmark) | JS/TS ECS 库横向性能基准 |
| **Building an ECS 系列** | [#1](https://ajmmertens.medium.com/building-an-ecs-1-where-are-my-entities-and-components-63d07c7da742) / [#2](https://ajmmertens.medium.com/building-an-ecs-2-archetypes-and-vectorization-fe21690805f9) / [#3](https://ajmmertens.medium.com/building-an-ecs-storage-in-pictures-642b8bfd6e04) | Flecs 作者图解 ECS 内部数据结构 |

---

## 二、2D 游戏引擎

| 名称 | 仓库 | Stars | 语言 | 说明 |
|------|------|-------|------|------|
| **Phaser** | [phaserjs/phaser](https://github.com/phaserjs/phaser) | ~37.8k | JS | 最流行的 HTML5 2D 框架，内置 Arcade + Matter.js 双物理 |
| **PixiJS** | [pixijs/pixijs](https://github.com/pixijs/pixijs) | ~44k | TS | 最快的 2D WebGL/WebGPU 渲染库，可作为 Apollo 渲染后端 |
| **Godot** | [godotengine/godot](https://github.com/godotengine/godot) | ~93k | C++ | 全能 2D/3D 引擎，Node/Scene 树架构 |
| **LÖVE** | [love2d/love](https://github.com/love2d/love) | ~8.4k | C++/Lua | 极简 2D 框架，参考"最小核心 + 脚本层"思路 |
| **Defold** | [defold/defold](https://github.com/defold/defold) | ~5.6k | C++/Lua | King 开源，组件化架构，跨平台含 Web |
| **Cocos Creator** | [cocos/cocos-engine](https://github.com/cocos/cocos-engine) | ~9.1k | TS | Entity-Component 架构，国内生态完善 |
| **Excalibur** | [excaliburjs/Excalibur](https://github.com/excaliburjs/Excalibur) | ~1.8k | TS | 纯 TS 2D 引擎，API 友好 |

---

## 三、2D 物理引擎

| 名称 | 仓库 | 语言 | 说明 |
|------|------|------|------|
| **Box2D v3** | [erincatto/box2d](https://github.com/erincatto/box2d) | C | 行业标准，v3.1 纯 C 重写，SIMD + 多线程，性能比 v2 提升 2 倍+ |
| **Rapier 2D** | [dimforge/rapier](https://github.com/dimforge/rapier) | Rust | 高性能，官方 WASM+JS 绑定，**跨平台确定性**，有 Bevy 官方插件 |
| **Matter.js** | [liabru/matter-js](https://github.com/liabru/matter-js) | JS | 纯 JS，零依赖，~87KB，API 最简，适合原型 |
| **Planck.js** | [piqnt/planck.js](https://github.com/piqnt/planck.js) | TS | Box2D v2 的 TS 重写，API 与 Box2D 一致 |
| **Phaser Box2D** | [phaserjs/phaser-box2d](https://github.com/phaserjs/phaser-box2d) | JS | Box2D v3 的纯 JS 移植，<70KB，MIT |
| **box2d3-wasm** | [Birch-san/box2d3-wasm](https://github.com/Birch-san/box2d3-wasm) | C→WASM | Box2D v3 WASM 编译，支持 SIMD + Web Workers |

### 物理引擎选型

| 场景 | 推荐 | 理由 |
|------|------|------|
| 高性能 2D Web 游戏 | Box2D v3 (Phaser Box2D / box2d3-wasm) | 行业标准，v3 性能优异 |
| 需要跨平台确定性 | Rapier 2D | 唯一跨平台确定性选项 |
| 快速原型/教学 | Matter.js | 最简 API，内置渲染 |
| 同时需要 2D+3D | Rapier | 同引擎提供 2D 和 3D |

### ECS 与物理集成模式

**双世界同步（标准做法）**：物理引擎维护自己的 World，ECS System 每帧双向同步：

```
PhysicsSystem:
  1. 将 ECS Kinematic 实体的 Transform 写入物理 Body
  2. 调用 world.step()
  3. 将物理 Dynamic 实体的位置/速度写回 TransformComponent
  4. 碰撞事件 → ECS 事件队列
```

---

## 四、骨骼动画 & Live2D

### Spine

| 属性 | 详情 |
|------|------|
| 版本 | 4.2 |
| 运行时 | [EsotericSoftware/spine-runtimes](https://github.com/EsotericSoftware/spine-runtimes) (~4.4k stars) |
| 许可证 | 专有（Essential $69, Professional $379） |
| Web 集成 | pixi-spine（PixiJS 插件） |

**ECS 集成**：姿态快照模式——每帧从 Spine 运行时提取骨骼变换写入 `SkeletalPose` 组件（纯数据），后续系统只读快照，不直接访问 Spine 运行时。

### Live2D

| 属性 | 详情 |
|------|------|
| 版本 | Cubism 5 SDK |
| 技术 | 网格变形动画（非骨骼），参数驱动 |
| 许可证 | 专有（小企业免费，年销 >2000 万日元需付费） |
| Web SDK | TypeScript，WebGL 渲染 |
| PixiJS 插件 | [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) (~1.4k stars) |

**ECS 集成**：参数快照模式——组件存储当前参数值 Map，System 更新参数值并传入 Cubism SDK Core 获取网格数据。适合少量高质量角色。

### DragonBones

免费开源 (MIT) 但 **JS 运行时 2015 年后停止维护**，不建议新项目使用。

### Bullet Physics（2D）

Bullet 主要是 3D 引擎，2D 支持有限（`btBox2dShape`）。纯 2D 项目 **Box2D 完胜**。

---

## 五、经典书籍

### P0 必读（免费在线）

| 书名 | 作者 | 说明 |
|------|------|------|
| **Game Programming Patterns** | Robert Nystrom | [gameprogrammingpatterns.com](https://gameprogrammingpatterns.com/) — 游戏循环、组件模式、对象池、空间分区等核心模式 |
| **Data-Oriented Design** | Richard Fabian | [dataorienteddesign.com](https://dataorienteddesign.com/dodbook/) — ECS 的理论根基 |

### P1 核心

| 书名 | 作者 | 年份 | 说明 |
|------|------|------|------|
| **Game Engine Architecture** | Jason Gregory | 2024 (4e) | 引擎架构圣经，Naughty Dog 首席程序员著 |
| **Real-Time Collision Detection** | Christer Ericson | 2004 | 碰撞检测金标准，空间分区 + BVH + 相交测试 |
| **2D Game Collision Detection** | Thomas Schwarzl | 2013 | 专门针对 2D，与 Apollo 定位完全匹配 |
| **AI for Games** | Ian Millington | 2019 (3e) | 游戏 AI 最全面参考：寻路、行为树、FSM、效用 AI |
| **Entity-Component System Design Patterns** | Richard Johnson | 2024 | 唯一专门讲 ECS 设计模式的书 |

### P2 按需

| 书名 | 作者 | 年份 | 说明 |
|------|------|------|------|
| **Game Physics Engine Development** | Ian Millington | 2010 (2e) | 从零构建物理引擎，含 2D 章节 |
| **Game Physics Cookbook** | Gabor Szauer | 2017 | 100+ 碰撞检测/物理公式食谱 |
| **Programming Game AI by Example** | Mat Buckland | 2004 | FSM、steering behaviors、A* 寻路实例 |
| **Procedural Generation in Game Design** | Short & Adams | 2017 | 矮人要塞作者参与，程序化生成设计 |
| **Essential Mathematics for Games** | Van Verth & Bishop | 2015 (3e) | 向量、矩阵、插值——引擎背后的数学 |

---

## 六、GDC 演讲 & 技术文章

### ECS 与数据导向设计

| 标题 | 演讲者 | 年份 | 链接 |
|------|--------|------|------|
| **Data-Oriented Design and C++** | Mike Acton (Insomniac) | CppCon 2014 | [YouTube](https://www.youtube.com/watch?v=rX0ItVEVjHc) |
| **A Data-Driven Game Object System** | Scott Bilas | GDC 2002 | [PDF](https://www.gamedevs.org/uploads/data-driven-game-object-system.pdf) |
| **Overwatch Gameplay Architecture and Netcode** | Timothy Ford (Blizzard) | GDC 2017 | [GDC Vault](https://www.gdcvault.com/play/1024001/) |
| **Data Oriented Approach to Using Component Systems** | Mike Acton (Unity) | GDC 2018 | [YouTube](https://www.youtube.com/watch?v=p65Yt20pw0g) |
| **Deep Dive into DOD for a Cross-platform UGC Engine** | YAHAHA Studios | GDC 2023 | [GDC Vault](https://www.gdcvault.com/play/1029021/) |
| **Using Rust For Game Development** | Catherine West | RustConf 2018 | [YouTube](https://www.youtube.com/watch?v=aKLntZcp27M) |

### ECS 性能

| 标题 | 来源 | 链接 |
|------|------|------|
| **Sparse-set vs Archetype ECS 性能对比** | CGVC 学术论文 2025 | [PDF](https://diglib.eg.org/bitstreams/766b72a4-70ae-4e8e-935b-949d589ed962/download) |
| **ECS Benchmark (C/C++)** | abeimler | [GitHub](https://github.com/abeimler/ecs_benchmark) |
| **Exploring Concurrency in ECS** | arXiv 2025 | [PDF](https://arxiv.org/pdf/2508.15264) |

**核心结论**：Archetype 适合大规模迭代（>10 万实体），Sparse Set 适合频繁增删组件。2D 游戏数千~数万实体时差异不大。

### 游戏 AI

| 标题 | 演讲者 | 年份 | 说明 |
|------|--------|------|------|
| **Three States and a Plan: AI of F.E.A.R.** | Jeff Orkin | GDC 2006 | GOAP 标杆案例 |
| **Improving AI Decision Modeling Through Utility Theory** | Dave Mark & Kevin Dill | GDC 2010 | 效用 AI 奠基演讲 |
| **AI Arborist: Cultivation of Behavior Trees** | Anguelov et al. | GDC 2017 | 行为树最佳实践 |
| **Deciding on an AI Architecture** | — | GDC | FSM/行为树/GOAP/效用 AI 选型 |

### 2D 渲染优化

| 标题 | 来源 | 链接 |
|------|------|------|
| **GLES2 2D Batching** | Godot 官方 | [文章](https://godotengine.org/article/gles2-renderer-optimization-2d-batching/) |
| **Unity Tilemap 优化** | Unity 官方 | [文章](https://unity.com/how-to/optimize-performance-2d-games-unity-tilemap) |
| **Bevy 2D Rendering** | DeepWiki | [文章](https://deepwiki.com/bevyengine/bevy/5.9-2d-rendering-and-sprites) |

### AI 原生游戏开发（2024-2025 前沿）

| 标题 | 来源 | 年份 | 说明 |
|------|------|------|------|
| **From Text to Gameplay: GenAI on Behavior Trees** | GDC AI Summit | 2024 | 用 LLM 自动生成行为树 |
| **LLM as Core Gameplay: 1001 Nights** | GDC AI Summit | 2025 | LLM 作为核心玩法机制 |
| **Game Generation via LLMs** | arXiv | 2024 | [论文](https://arxiv.org/pdf/2404.08706) |
| **SEELE: AI-Native Game Dev Platform** | Seeles.ai | 2025 | 文本到游戏全流程生成 |

### 程序化叙事

| 标题 | 来源 | 说明 |
|------|------|------|
| **Procedural Narrative Generation** | GDC 2017 | 社会模拟 + 戏剧管理 |
| **Emergent Storytelling in The Sims** | GDC | 涌现式叙事的经典案例 |

---

## 七、对 Apollo Engine 的选型建议

### 当前阶段（Tier 1/2）

- **ECS 核心**：Apollo 已有自己的 ECS 实现。参考 **bitECS**（SoA + 函数式 API）和 **Flecs** 的 Entity Relationships 进一步优化
- **渲染层**：以 **PixiJS** 或 **Canvas2D**（已有）作为渲染后端，与 ECS 完全解耦
- **物理集成**：推荐 **Rapier2D WASM**（性能 + 确定性）或 **Planck.js**（纯 TS + Box2D 兼容）

### Tier 3/4（乙游方向）

- **骨骼动画**：**Spine**（如需专业 2D 骨骼）或 **Live2D**（如需高品质角色表现）
- **AI**：效用 AI（Dave Mark 的响应曲线）最适合乙游的情感决策系统
- **叙事**：参考 GDC 的程序化叙事演讲 + LLM 原生叙事

### 必读资源优先级

```
P0（立即读）:
  - Game Programming Patterns (免费在线)
  - Data-Oriented Design (免费在线)
  - Mike Acton CppCon 2014 (1 小时视频)
  - Sander Mertens Building an ECS 系列

P1（核心参考）:
  - Game Engine Architecture (4e)
  - Real-Time Collision Detection
  - Overwatch GDC 2017 演讲

P2（按需查阅）:
  - AI for Games — 当需要 AI 系统时
  - 2D Game Collision Detection — 当做物理时
  - Procedural Generation in Game Design — 当做 PCG 时
```
