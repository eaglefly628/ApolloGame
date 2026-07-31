# World.query 性能优化方案（✅ 已实施 2026-06-10，方案 A + 两处增强）

> 问题来自引擎自审：`World.query` 是规模化第一硬伤。本文给方案、权衡、迁移与风险，供决策后实施。
>
> ✅ **实施记录（2026-06-10）**：按 §4 落地于 `src/engine/core/world.ts`，外加两处实测驱动的增强：
> 1. **单调跳排序**：候选从 Set 出来时若 creationSeq 已升序（组件从未 remove→re-add 的常见情形）则免排序；
> 2. **稠密退化**：候选过半（`rarest.size×2 > entities.size`）直接走旧式插入序全扫——索引剪不动时不付索引税。
>
> **微基准（E=5000，µs/次，vite-node）**：稀有查询(8 命中) 103.1→**2.9**（36×）；稠密(全命中) 231.5→**196.8**（持平略快，第一版无增强时曾倒退到 580——排序比较器双重 Map.get 主导，故加增强①②）；未持有 type 136.9→**0.2**。
> **行为零变证明**：全量 880 绿（含 lockstep/录放确定性）+ 新增 `world-index.test.ts` 8 条对拍守护（随机 2000 步操作序列 vs 朴素全扫参照、consume 路径、destroy/restore 重建、remove→re-add 保序）。
> `tick()` 的 consume 循环同时改走索引（O(E)→O(持有者数)）并保持索引一致。§5 的 queryEach/eid-only 仍按需后置。

## 1. 现状与瓶颈

```ts
query(...types) {
  const results = [];
  for (const [id, comps] of this.entities)   // ← 全表扫描所有实体
    if (types.every(t => comps.has(t))) results.push([id, comps]); // ← 每次新建数组 + tuple
  return results;
}
```

- **每次调用全表扫描** `O(E × |types|)`，`E`=实体总数。
- **每系统每 tick 调用 1+ 次**：~67 能力，多数 execute() 至少一次 query。一 tick 成本 ≈ `O(E × S)`（S=系统数）+ 大量临时数组/tuple 分配 → GC 抖动。
- 卡牌（E 小）无感；**Game D 弹幕/刷怪（E 大）会卡**，且每 tick 分配在移动端尤其痛。

## 2. 目标与不可破的约束

- **确定性铁律**：query 返回顺序必须保持**逐字节确定**（lockstep 双端、录放一致）。当前顺序 = `this.entities` 的**插入序（=实体创建序，destroy 删除）**。**优化后必须等价此序**，否则依赖 query 顺序的系统行为漂移（hash 本身 canonical 排序不受影响，但"取首个匹配实体""按序结算"类系统会变）。
- **API 兼容**：`query(...types) → Array<[eid, comps]>` 签名与现有 ~67 能力调用点不变（否则全量迁移，风险爆炸）。

## 3. 方案对比

| 方案 | 做法 | 收益 | 成本/风险 | 评 |
|---|---|---|---|---|
| **A. 倒排组件索引**（推荐） | 维护 `Map<type, Set<eid>>`，add/remove/destroy 同步更新；query 取**最稀有 type** 的集合做候选，再按其余 type 过滤 | 扫描从 `O(E)` 降到 `O(k)`（k=最稀有 type 的实体数，多数查询 k≪E） | 中：World 内部改动，索引一致性需测；顺序需处理 | **采纳** |
| B. 完整 archetype 存储 | 按"精确组件集"分桶，query 遍历匹配桶 | 最快 | 高：大改 + 组件增删时实体迁桶（事件型组件 Signal/TimerDone 每帧增删 → 频繁迁桶抖动）；当前规模过度 | 暂不（YAGNI） |
| C. query 结果缓存 | 缓存 query→结果，结构变更失效 | 同 tick 重复查询省 | 低收益：事件型组件每帧增删 → 缓存频繁失效抖动 | 否 |

## 4. 推荐方案 A 详细设计（确定性安全版）

**核心：倒排索引只用来"剪枝候选"，返回序仍 = 实体创建序 → 行为逐字节不变。**

新增 World 私有结构：
- `creationSeq: Map<eid, number>` + 单调计数器 `nextSeq`（createEntity 时分配）。
- `typeIndex: Map<ComponentType, Set<EntityId>>`。

维护点：
- `createEntity(id)`：分配 `creationSeq[id]=nextSeq++`。
- `addComponent(id, c)`：`typeIndex.get(c.type)?.add(id)`（无则建 Set）。
- `removeComponent(id, t)`：`typeIndex.get(t)?.delete(id)`。
- `destroyEntity(id)`：从所有 `typeIndex[t]` 删 id（遍历该实体现有 comps 的 type 即可，O(该实体组件数)）+ 删 creationSeq + entities。

新 query：
```ts
query(...types) {
  if (types.length === 0) return [...this.entities].map(...); // 退化：全量（仍创建序）
  // 选最稀有 type 作候选集（最小 Set）
  let rarest = types[0], min = this.typeIndex.get(rarest)?.size ?? 0;
  for (const t of types) { const s = this.typeIndex.get(t)?.size ?? 0; if (s < min) { min = s; rarest = t; } }
  const cand = this.typeIndex.get(rarest); if (!cand) return [];
  const out = [];
  for (const eid of cand) {
    const comps = this.entities.get(eid)!;
    if (types.every(t => comps.has(t))) out.push([eid, comps] as [EntityId, ...]);
  }
  // 关键：按 creationSeq 排序 → 与旧实现的"插入序"逐字节一致（确定性 + 行为零变）
  out.sort((a, b) => this.creationSeq.get(a[0])! - this.creationSeq.get(b[0])!);
  return out;
}
```

复杂度：`O(k log k + k×|types|)`，`k`=最稀有 type 实体数。绝大多数查询带一个稀有 type（PokerHand/Caster/Mortal/Perception…只几个实体）→ k 极小，远胜 `O(E)`。

**为什么排序仍快**：k≪E，`k log k` 可忽略；且只对**匹配候选**排序，不碰全表。

## 5. 进一步优化（A 之后，可选，需额外审计）

1. **去掉排序**：若审计确认所有 query 消费者都"顺序无关或自己显式 sort"（effect-apply/card-scoring/caster/aggro 已 sort eid），则可省掉 creationSeq 排序，返回候选集顺序。**收益有限、风险（行为漂移）较高 → 默认保留排序，除非剖析显示排序是热点。**
2. **零分配 visitor API**：加 `queryEach(types, fn)` 就地回调，避免 `results` 数组 + tuple 分配。但需逐能力迁移调用点（大）。**按需**：先上索引，若 GC 仍是瓶颈再迁热点系统。
3. **返回 eid-only**：多数系统 `query` 后只用 eid + getComponent，`comps` tuple 多余。可让热点改用 `queryEntities`。follow-up。

## 6. 迁移与验证
1. 实施 A（World 内部，~1 文件）。
2. **回归**：全量 vitest 必须逐条绿（顺序保持 → 行为不变是设计目标）。
3. **确定性**：跑 `coop-cards`/`net` lockstep 测，双 peer hash 不变。
4. **微基准**：建一个 E=5000 实体世界，对比 query 前后 tick 耗时（ZeroCraftBench 加一项或独立 bench）。
5. 索引一致性单测：add/remove/destroy 后 query 结果 == 朴素全扫结果（对拍）。

## 7. 风险
- **索引一致性 bug**：任何漏更新（某处直接改 entities 不走 add/removeComponent）→ 索引与真相分叉。当前所有组件增删都走 World 方法（已核），但需加"对拍测试"长期守护。
- **顺序回归**：creationSeq 排序保证零行为变；若图省略排序则需全量消费者审计（不建议首版做）。

## 8. 建议
**先实施方案 A（确定性安全版，保留排序）**——最高杠杆、风险可控、行为零变、被全套回归 + 对拍测试守护。archetype（B）等真实 E 上万再议。queryEach（5.2）作 GC 二阶段。
