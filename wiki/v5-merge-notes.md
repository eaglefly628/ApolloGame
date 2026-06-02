# Apollo v5 合并决策记录

> v4 (Claude) 与 AIGP 蓝图 (Gemini) 的对比分析及合并决策。

---

## 采纳 (来自 AIGP 蓝图)

| 决策 | 原因 |
|------|------|
| 新增 `Hierarchy` 原子 | 空间父子继承是高频操作，`Relation(kind='parent')` 缺少 `localOffset`，每次变换需额外 query。专用组件消除运行时开销 |
| `Velocity` 增加 `angular` | 旋转速度是独立自由度，旋转飞行物、自旋特效需要 |
| `Resource` 增加 `min` | 允许非零下限（如温度不低于 -50），比 `max: Infinity` 的 Counter hack 更语义化 |
| `State` 增加 `fsmId` | 一个实体可有多套状态机（行为状态 + 动画状态），fsmId 区分 |
| `Tag` 改为 `Bitmask` | 60Hz 下 `string[].includes()` 开销不可忽视，位运算 O(1) |
| `Sprite` 增加 `zOrder` | 2D 渲染排序是基础需求，不应推到 System 层 |
| `Camera` 增加 `offsetX/Y, rotation` | 摄像机震动、平移需要偏移和旋转，仅 zoom + viewport 不够 |
| 扩展层分层设计 | 骨骼动画、叙事、AIGP 作为可选扩展，不污染核心原子表 |

## 拒绝 (保留 v4 设计)

| 决策 | 原因 |
|------|------|
| 不合并 Transform | Position 独立是核心设计——大量逻辑实体（触发器、音源）只需位置。Transform 作为 Tier 1 Macro 存在 |
| 不合并 Lifecycle | SpawnRequest 挂在请求实体（需 templateId + 坐标），DestroyRequest 挂在目标实体。数据形状不同，分别更自然 |
| 不去掉 Counter | Counter(无上限) 与 Resource(有上限) 语义不同。击杀数、经验值不是 `Resource{min:0, max:Infinity}` |
| 不去掉 Visibility | 引擎级"跳过渲染/跳过逻辑"不能用游戏逻辑层 Flag 代替（Gemini 自己在 v4 审核时建议加的） |
| 不去掉 Random | 确定性重放(replay)需要可控随机种子，不是可选的 |
| UI-Binding 不升为原子 | 数据流单向 ECS→UI，不参与 ECS 内部结算，保持 Tier 2 组合层 |
| Overlap 保留详细字段 | normalX/Y + depth 是碰撞响应的必需数据，简化为 List<EntityID> 会导致 Tier 2 无法结算 |

## 新增扩展层

| 层 | 原子 | 来源 |
|----|------|------|
| 扩展 A: 骨骼动画 | `Skeletal-Pose` | AIGP 蓝图。姿态快照是纯数据，不含时间轴，原子性成立。但 2D 小游戏暂不需要 |
| 扩展 B: 叙事 | `Socket`, `String-Variable` | AIGP 蓝图。换装/女性向/对话系统刚需 |
| 扩展 C: AIGP 旁路 | `Shadow-Dictionary`, `Semantic-Material`, `Conditioning-Mask`, `Latent-Anchor` | AIGP 蓝图。AI 视频生成专用，完全游离于核心 ECS 之外 |

---

## 数量变化

| 版本 | 核心原子 | 世界级 | 合计 | 扩展 |
|------|---------|--------|------|------|
| v4 | 24 | 1 | 25 | 无 |
| v5 | 25 | 1 | 26 | +7 (3层) |
| 净增 | +1 (hierarchy) | 0 | +1 | — |
