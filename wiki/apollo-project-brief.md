# ZeroCraft Preview — 项目总结报告

> ⚠ **历史文档（口径已过期）**：原子数/能力数/游戏清单/测试数以机读真相为准（`docs/llm-onboarding.md` §0）。本文仅存考古价值，新 session/新 LLM 勿以此为教材。

> 用途：给外部协作者（Claude / 设计师 / 项目经理）的完整项目概览
> 生成时间：2026-06-03

---

## 一、项目定位

**ZeroCraft Preview** 是一个基于 ECS（Entity-Component-System）架构的 2D 游戏引擎，运行在浏览器端（TypeScript + Canvas2D），目标平台包括 Web 和微信小游戏。

**核心愿景**：通过有限的原子化技能（Atom Skill）组合，涌现出无限的游戏玩法。最终支持"一句话生成游戏"— 用户描述需求，LLM 自动选择原子组合生成可运行的游戏。

**当前阶段**：26 个核心原子已全部实现，Tier 1（运动学）和 Tier 2（物理规则）已完成，本地双人平台跳跃 Demo 可玩。

---

## 二、架构设计

### 2.1 ECS 核心

```
Entity（实体）= 纯 ID，没有逻辑
Component（组件）= 纯数据，没有方法
System（系统）= 纯逻辑，没有状态
```

- 每个 System 通过 `defineCapability()` 自描述它读什么、写什么
- 引擎用**拓扑排序**（Kahn 算法）自动计算 System 执行顺序
- 组件语义分类：Resource / Event / Intent / Marker / Config / Render

### 2.2 四层涌现模型

```
Tier 1: Kinematic（运动学）     — 直接结算：位移、加速、动画、计时
Tier 2: Resolution（规则约束）   — 碰撞、重力、摩擦、边界
Tier 3: Mechanics（系统玩法）    — 血量、跳跃、弹幕、击退
Tier 4: Behaviors（行为智能）    — AI 巡逻、追击、对话、状态机
```

每一层只依赖下层的原子，通过组合涌现更复杂的行为。

### 2.3 26 个核心原子

| 分区 | 原子 |
|------|------|
| A 位置 | transform, hierarchy |
| B 运动 | velocity, acceleration, mass |
| C 几何 | shape |
| D 碰撞 | overlap-detect |
| E 时间 | timer |
| F 数值 | resource, flag |
| G 分类 | tag, relation |
| H 开关 | visibility |
| I 输入 | input-capture, action-map |
| J 状态 | state |
| K 生死 | spawn, destroy |
| L 渲染 | sprite, color, frame, sound, camera, text |
| W 世界 | random-seed, spatial-query |

### 2.4 Assembly 蓝图

游戏关卡/场景是**声明式数据**：

```typescript
const blueprint = {
  entities: [
    {
      id: 'player',
      components: [
        { type: 'Transform', x: 100, y: 300 },
        { type: 'Velocity', vx: 0, vy: 0 },
        { type: 'Shape', kind: 'box', width: 24, height: 24 },
        { type: 'Controllable', playerId: 'p1', speed: 3 },
      ]
    },
    // ...
  ]
};
engine.load(blueprint);
```

这是支持"LLM 生成游戏"的基础 — Claude 只需要输出这种 JSON，不需要写代码。

---

## 三、技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 语言 | TypeScript 5.x | 严格模式，判别联合做组件类型 |
| 运行时 | 浏览器 | Canvas2D 渲染，Web Audio 音频 |
| 构建 | Vite | 开发热更新 + 生产构建 |
| 测试 | Vitest | 151+ 单元测试，覆盖所有原子 |
| UI | React 18 | Overlay 模式叠加在 Canvas 上方 |
| 联机 | BroadcastChannel | 本地多 Tab 帧同步，可替换为 WebSocket |

### 升级路径

- Canvas2D → **PixiJS**（性能 10x+）
- 自写碰撞 → **Box2D v3 / Rapier 2D**（复杂物理）
- 帧动画 → **Spine**（骨骼动画）/ **Live2D**（乙游立绘）
- 本地联机 → **WebSocket / WebRTC**（远程联机）

---

## 四、项目结构

```
src/
├── engine/
│   ├── core/           # World、类型定义、拓扑排序
│   ├── protocol/       # 26 个共享组件 TypeScript 接口
│   └── spatial/        # AABB 树、碰撞接触
├── atom-skills/        # 26 个原子 skill（每个一个目录 + 测试）
├── tier1/              # Tier 1 涌现系统（motion-apply, accel-apply, lifetime）
├── tier2/              # Tier 2 涌现系统（collision, ground-sense, jump, bounds）
├── assembly/           # 游戏蓝图（platformer, platformer2p, playground）
├── net/                # 网络层（输入、帧同步、确定性守卫）
├── renderer/           # 渲染后端（Canvas2D, ASCII, 可扩展）
├── runtime/            # 引擎入口（Engine 类）
├── debug/              # 调试工具（录制、回放、快照、Tracer）
├── ui/                 # React UI 层（GameOverlay）
└── main.tsx            # 应用入口

wiki/
├── atom-skill-periodic-table.md    # 原子技能元素周期表（核心设计文档）
├── otome-capability-binding.json   # 乙游能力绑定规范
├── gamedev-knowledge-base.md       # 游戏开发知识库（AAA 验证）
├── skills/                         # 分层技能知识库（23 个模块）
│   ├── index.md                    # Level 0 索引（常驻加载）
│   ├── motion.md                   # 运动模块知识
│   ├── collision.md                # 碰撞模块知识
│   └── ... (23 files)              # 其他模块
└── frame-sync.md                   # 帧同步设计文档

docs/workflow/                      # 开发工作流文档
├── lead-protocol.md                # Lead 工作协议
├── programmer-role.md              # 程序员角色规范
├── session-lead.md                 # Lead session 启动手册
└── session-programmer.md           # Programmer session 启动手册
```

---

## 五、已完成的里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| 引擎核心 | World + defineCapability + 拓扑排序 | ✅ 完成 |
| 26 原子 | 所有原子 skill + 单元测试 | ✅ 26/26 |
| Tier 1 | motion-apply, accel-apply, lifetime | ✅ 完成 |
| Tier 2 | collision-resolve, ground-sense, jump, bounds-clamp | ✅ 完成 |
| 联机基础 | 确定性守卫 + 锁步协议 + 本地双 Tab | ✅ 完成 |
| 可玩 Demo | 双人平台跳跃（WASD / 方向键） | ✅ 可玩 |
| 测试 | 151+ 测试用例通过 | ✅ 通过 |
| 知识库 | 23 模块分层知识库 | ✅ 完成 |
| 设计文档 | 周期表 v6 + 乙游绑定 + 四引擎验证 | ✅ 完成 |

---

## 六、下一步计划

### 近期（Tier 3 — 系统玩法）

- health-system：血量 + 受伤 + 死亡事件链
- platformer-jump：可变重力跳跃 + coyote time
- projectile：弹幕/子弹系统（spawn + velocity + lifetime + overlap）
- knockback：击退 + 无敌帧
- auto-target：自动索敌（spatial-query + tag 过滤）

### 中期（Tier 4 — 行为智能 + 乙游方向）

- AI 巡逻/追击/对话
- 乙游检定系统（check.resolve + 关系值修正）
- 情感事件（好感度阈值触发）
- 周期结算（多线资源汇总 → 解锁判定）

### 远期（产品化）

- "一句话生成游戏"：Claude API + system prompt（原子清单）→ 输出 Assembly JSON → Engine.load()
- 微信小游戏适配
- PixiJS 渲染升级
- 可视化关卡编辑器

---

## 七、"一句话生成游戏"的可行性

ZeroCraft 的架构天然支持 LLM 驱动的游戏生成：

1. **原子有限**：26 个核心原子 + 扩展原子，是有限组合空间
2. **蓝图是数据**：Assembly 是纯 JSON，不是代码，LLM 输出稳定
3. **涌现表是食谱**：哪些原子组合出什么玩法已经文档化
4. **分层知识库是 system prompt**：30 行索引常驻，详细知识按需加载

```
用户："做一个有重力的双人对战游戏"
  → Claude 读取原子清单
  → 选择：Transform + Velocity + Gravity + Shape + Overlap + Collision + Controllable
  → 输出 Assembly JSON
  → Engine.load() → 可玩游戏
```

---

## 八、关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| ECS vs 继承 | ECS | 组合式架构天然适合 LLM 组装 |
| 物理引擎 | 自写 AABB | 平台跳跃够用，复杂物理再接 Box2D |
| 渲染 | Canvas2D | MVP 最简，升级路径清晰 |
| 联机模型 | 确定性锁步 | 只同步输入，带宽极小 |
| 状态管理 | 组件即状态 | 无中心状态，序列化/快照/回放天然支持 |
| UI | React Overlay | 成熟生态，游戏逻辑与 UI 解耦 |
| 知识库 | 分层懒加载 | token 经济，按需读取 |

---

## 九、团队与协作模型

- **Lead（设计师助理）**：文档、工具、知识库、架构决策
- **Programmer（主程序员）**：原子实现、Tier 涌现、测试
- 协作方式：共享 git 分支（claude/mainbranch），文件系统 IPC
- 质量守卫：vitest 全量测试 + tsc 类型检查 + 确定性哈希校验
