# 网络同步模块知识

> 覆盖原子：random-seed、lockstep、determinism

## 核心原则

- Apollo 的联机模型是**确定性锁步（Deterministic Lockstep）**：所有客户端跑相同逻辑，只同步输入。
- 确定性 = 相同输入 + 相同初始状态 → 相同结果。每 tick 的哈希必须一致。
- 一旦确定性被破坏，两端状态会永久分叉 — 没有自愈机制。

## 确定性要求

| 允许 | 禁止 |
|------|------|
| Math.sqrt(x*x + y*y) | Math.hypot(x, y) — 跨平台实现不同 |
| 整数运算 | 浮点运算的中间精度差异 |
| RandomSeed 组件的 PRNG | Math.random() |
| 固定 tick 步进 | requestAnimationFrame 的 dt |
| 确定性的遍历顺序 | Map/Set 的插入顺序依赖 |

## 锁步协议

1. 每个客户端收集本地输入，标记 tick 编号。
2. 发送输入给所有对端。
3. 等待收到所有对端当前 tick 的输入。
4. 所有客户端用相同输入推进同一 tick。
5. 每 N tick 交换哈希，不一致则报错（desync）。

## 输入延迟 vs 回滚

- **输入延迟**（Apollo 当前）：收到所有人的输入才推进。简单可靠，延迟 = 最慢玩家的网络延迟。
- **回滚（Rollback）**：先用预测输入推进，收到真实输入后回滚重算。延迟更低但实现复杂。
- 格斗游戏用回滚（GGPO），RTS 用锁步（星际争霸）。

## RandomSeed

- 全局随机数挂在 world 实体上：seed + sequence。
- PRNG 算法：每次调用 sequence++，输出 = hash(seed, sequence)。
- 所有需要随机数的 System 必须用这个 PRNG，不能用 Math.random()。

## BroadcastChannel（本地多 tab 联机）

- Apollo 用 BroadcastChannel API 在浏览器多 tab 间同步输入。
- 适合开发调试：开两个 tab 就是两个玩家。
- 生产环境替换为 WebSocket 后端，接口不变。

## 常见陷阱

- 新加的 System 如果遍历实体的顺序不确定 → 破坏确定性。用 entityId 排序。
- 浮点数的 -0 和 +0 哈希不同 — normalize 为 0。
- console.log 里的 Math.random() 也会影响全局状态 — 调试时注意。

## 参考来源

- 守望先锋 (GDC 2017) — 确定性 63Hz tick + 网络回滚的工业实现
- 星际争霸 lockstep — RTS 锁步同步的经典案例
- Apollo frame-sync.md — 当前项目的帧同步设计文档
