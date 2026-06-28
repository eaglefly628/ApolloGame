# Apollo 游戏开发技能索引

> Level 0 — 常驻加载。当你需要实现某类功能时，用 Read 工具读取对应文件。

| 分类 | 覆盖原子/主题 | 触发场景 | 路径 |
|------|-------------|---------|------|
| ECS 架构 | defineCapability, World, Assembly | 新建 skill / 修改引擎结构 | wiki/skills/ecs-architecture.md |
| 运动 | motion-apply, accel-apply, hierarchy | 实现位移/加速/父子跟随 | wiki/skills/motion.md |
| 碰撞 | overlap-detect, collision-separate, bounce | 实现碰撞检测或响应 | wiki/skills/collision.md |
| 物理 | gravity, friction, mass | 实现重力/摩擦/质量相关 | wiki/skills/physics.md |
| 动画 | animation, frame, anim-state-machine | 实现帧动画/状态机动画 | wiki/skills/animation.md |
| 输入 | input-capture, action-map, controllable | 处理键盘/触屏/手柄输入 | wiki/skills/input.md |
| 渲染 | sprite, camera, text, color, visibility | 渲染层/画面/UI 显示 | wiki/skills/rendering.md |
| 生命周期 | spawn, destroy, timer, lifetime | 实体创建/销毁/计时 | wiki/skills/lifecycle.md |
| AI 行为 | ai-patrol, ai-chase, state, dialogue | 实现 NPC 行为/决策 | wiki/skills/ai-behavior.md |
| 资源系统 | resource, resource-modify, damage-number | 血量/MP/伤害数字/UI 绑定 | wiki/skills/resource.md |
| 空间查询 | spatial-query, range-detect, trigger-zone | 范围检测/空间分区 | wiki/skills/spatial.md |
| 网络同步 | random-seed, lockstep, determinism | 联机/确定性/帧同步 | wiki/skills/networking.md |
| 乙游扩展 | check.resolve, love-interest, settlement | Tier 3/4 乙游玩法方向 | wiki/skills/otome.md |
| 序列化 | 存档/读档, JSON, 二进制, 版本迁移 | 实现存档/状态快照 | wiki/skills/serialization.md |
| TypeScript | 判别联合, branded type, 泛型, 性能 | TS 类型设计/模式选择 | wiki/skills/typescript-patterns.md |
| UI 系统 | HUD, 菜单, 对话框, React 集成 | 实现游戏界面/交互 | wiki/skills/ui-system.md |
| **UI 实操手册** | **防重叠/颜色对比/透明度/布局卫生·建库准则** | **做任何 UI/HUD/菜单前必读·自检清单** | **docs/design/ui-playbook.md** |
| 音频 | Web Audio, SFX, BGM, 空间音效 | 实现音效/音乐播放 | wiki/skills/audio.md |
| 场景管理 | 场景切换, 关卡加载, 游戏状态机 | 实现多场景/关卡系统 | wiki/skills/scene-management.md |
| 瓦片地图 | Tilemap, Tiled, 图块碰撞, 自动图块 | 实现瓦片关卡 | wiki/skills/tilemap.md |
| 数学工具 | 向量, lerp, easing, 角度, PRNG | 数学运算/插值/缓动 | wiki/skills/math-utils.md |
| 性能优化 | GC 回避, 批处理, DoD, 剖析 | 性能瓶颈/帧预算优化 | wiki/skills/performance.md |
| 资源加载 | 图集, 预加载, 异步加载, 缓存 | 实现资源管理/加载流程 | wiki/skills/asset-loading.md |
| 粒子系统 | 发射器, 粒子池, 视觉特效 | 实现爆炸/烟雾/拖尾等特效 | wiki/skills/particles.md |
| UI 主题化 | CSS tokens, 多风格套装, AI 生成主题 | 设计/切换 UI 视觉风格 | wiki/skills/ui-theming.md |

### 外部参考

| 参考 | 内容 | 触发场景 | 路径 |
|------|------|---------|------|
| Claude Game Studios | Hook/Rules/Agent/Skill 工作流模式 | 改进开发流程/加 hook/加 slash command | wiki/skills/reference-claude-game-studios.md |

## 使用规则

1. **不要一次性读取所有文件** — 只读当前任务涉及的分类
2. 每个文件包含：核心原则、编码约定、常见陷阱、前沿技术、参考来源
3. 具体算法实现不在此收录 — 需要时用 WebSearch 查询
4. 共 24 个模块，按需加载单个模块约 60-80 行（≈1000 tokens）
