# 乙游扩展模块知识

> 覆盖原子：check.resolve、love-interest.event、settlement.resolve
> 开发阶段：Tier 3/4 方向，Tier 1/2 完成后启动

## 核心原则

- 乙游的核心循环是"选择 → 数值变化 → 情感反馈 → 关系进展"。
- 所有机制复用 ECS 基础原子 — 好感度是 Resource，情感节拍是 Event，关系是 Relation。
- defineCapability 需要扩展 domainSlot — 让 skill 描述可以插入领域特定的修正值。

## 检定系统（Check Resolve）

- 玩家做选择 → 计算检定分数 → 判定成功/失败 → 触发后果。
- 分数 = 基础值 + 属性修正 + 关系值修正 + 随机骰子。
- 效用 AI 的响应曲线（response curve）决定每个因子的权重。
- 检定类型：魅力检定、智慧检定、体力检定 — 对应不同属性 Resource。

## 情感事件（Love Interest Event）

- Resource 阈值触发：好感度到达 30/60/90 → 解锁对应情感事件。
- 事件中玩家选择 → 分支后果（好感+10 / 好感-5 + 解锁隐藏线）。
- 多路径结构：不是单线剧情，是基于数值的分支网络。

## 周期结算（Settlement Resolve）

- 参考信长之野望/Persona 的时间推进模型。
- 每周期（一天/一周/一幕）结算：三线资源汇总 → 解锁判定 → 配置下一周期。
- 三线资源示例：事业线 + 社交线 + 个人成长线。
- 结算结果影响下一周期可用选项和事件池。

## 领域词汇

| 游戏概念 | ECS 映射 |
|---------|---------|
| 好感度 | Resource { id: 'affection_角色名' } |
| 属性（魅力/智慧/体力） | Resource { id: 'charm' / 'wisdom' / 'stamina' } |
| 角色关系 | Relation { kind: 'love-interest', targetId } |
| 情感状态 | State { fsmId: 'emotion', current: 'happy' } |
| 选择 | Action { name: 'choice_1' } |
| 回合/周期 | Timer { id: 'period', duration: N } |

## 三文件接口范式

乙游实现分三层文件：
1. **领域词汇** — 定义游戏概念到 ECS 的映射关系
2. **能力绑定** — 每个 stage 需要哪些 capability，domainSlot 填什么
3. **表现钩子** — 情感事件触发什么 UI / 动画 / 音效

## 常见陷阱

- 好感度不能只涨不跌 — 需要负面事件和选错的惩罚，否则没有决策张力。
- 检定系统的随机成分不能太大 — 玩家需要感觉到"我的选择有影响"。
- 多角色攻略线要防止数值串台 — Resource.id 必须包含角色标识。

## 参考来源

- 火焰纹章支援系统 — 关系值 + 阈值事件的经典实现
- Persona 系列 — 周期结算 + 日程管理的标杆
- 效用 AI (Dave Mark, GDC 2010) — 响应曲线用于情感决策
- wiki/otome-capability-binding.json — ZeroCraft 的乙游能力绑定规范
