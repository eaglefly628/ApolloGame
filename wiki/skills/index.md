# Apollo 游戏开发技能索引

> Level 0 — 常驻加载。当你需要实现某类功能时，用 Read 工具读取对应文件。

| 分类 | 覆盖原子 | 触发场景 | 路径 |
|------|---------|---------|------|
| ECS 架构 | defineCapability, World, Assembly | 新建 skill / 修改引擎结构 | wiki/skills/ecs-architecture.md |
| 运动 | motion-apply, accel-apply, hierarchy | 实现位移/加速/父子跟随 | wiki/skills/motion.md |
| 碰撞 | overlap-detect, collision-separate, collision-bounce | 实现碰撞检测或响应 | wiki/skills/collision.md |
| 物理 | gravity, friction, mass | 实现重力/摩擦/质量相关 | wiki/skills/physics.md |
| 动画 | animation, frame, anim-state-machine | 实现帧动画/状态机动画 | wiki/skills/animation.md |
| 输入 | input-capture, action-map, controllable | 处理键盘/触屏/手柄输入 | wiki/skills/input.md |
| 渲染 | sprite, camera, text, color, visibility | 渲染层/画面/UI 相关 | wiki/skills/rendering.md |
| 生命周期 | spawn, destroy, timer, lifetime | 实体创建/销毁/计时 | wiki/skills/lifecycle.md |
| AI 行为 | ai-patrol, ai-chase, state, dialogue | 实现 NPC 行为/决策 | wiki/skills/ai-behavior.md |
| 资源系统 | resource, resource-modify, damage-number, ui-binding | 血量/MP/伤害数字/UI 绑定 | wiki/skills/resource.md |
| 空间查询 | spatial-query, range-detect, trigger-zone | 范围检测/空间分区 | wiki/skills/spatial.md |
| 网络同步 | random-seed, lockstep, determinism | 联机/确定性/帧同步 | wiki/skills/networking.md |
| 乙游扩展 | check.resolve, love-interest, settlement | Tier 3/4 乙游玩法方向 | wiki/skills/otome.md |

## 使用规则

1. **不要一次性读取所有文件** — 只读当前任务涉及的分类
2. 每个文件包含：核心原则、编码约定、常见陷阱、参考来源
3. 具体算法实现不在此收录 — 需要时用 WebSearch 查询
