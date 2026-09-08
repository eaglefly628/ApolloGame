# 底层功能库与共享件手册（base-lib · 2026-09-08 立）

> **定位**：做任何游戏、写任何 tier 能力之前先查这张表——**表里有的必须用，手写同形 = `game-skill-audit` 红旗 `engineTwin`**（localStorage./GameLog/recordScore/Math.imul 计红·基线只降不升）。owner 2026-09-08：「event-log、local-store、事件总线我都需要，以后做的时候让他们用这个来消费。」
> 出处：`docs/design/engine-base-tier-review-2026-09-06.md`（§3.2 B 类 · §6 功能库地图）。sim 面全部纯函数、零 trig 零 hypot、逐位可复现。

## 1. 数学 `@engine/math`（桶 `index.ts`·可直 import 子模块）

| 要做什么 | 用 | 别再手写 |
|---|---|---|
| 钳位/插值/符号/环绕/比较器 | `scalar`: `clamp clamp01 lerp invLerp remap smoothstep sign signOr1 wrap cmpNum cmpStr` | `Math.max(lo,Math.min(hi,v))`（lo>hi 时语义不同·见评审）· 三元 clamp · `a<b?-1:…` |
| 向量长度/距离/点叉积/单位化/圆盒命中 | `vec2`: `len len2 dist dist2 dot cross normalize normalizeInto inCircle inBox` | `Math.sqrt(dx*dx+dy*dy)` · `dx/d, dy/d` |
| 行主序网格 | `grid`: `index indexOrNeg colOf rowOf inBounds adjacent4 cellFloor cellNearest cellCenter cellOrigin NEIGHBORS4/8 forEachNeighbor` | `r*cols+c` · `Math.floor((x-ox)/size)`（floor=左上角原点·round=中心原点，**两个名字两种语义**） |
| 直线/视线/泛洪/连通域 | `grid`: `bresenhamLine lineOfSight floodFill connectedComponents` | 自写 BFS |
| 六边形 | `@skills/tier2/hex.js`（axial/odd-r/距离/邻接/A*） | — |
| 线段相交/点在多边形/点到线段/射线打盒·圆 | `geom2`: `segmentsIntersect segmentIntersectT pointInPolygon pointSegmentDist2 raycastAabb raycastCircle` | — |
| 缓动 | `ease`: `ease(kind,x) easeIn easeOut easeInOut easeSmooth easeOutBack`（tween 同源） | tween 私有 switch |
| 哈希 | `hash`: `fnv1a32 hashInts fnvMixInt`；快照 hash 仍走 `@net/determinism.fnv1aHex` | 本地 `Math.imul(h, 0x01000193)` |
| 整数拍计时 | `tick`: `advanceTimer everyN remaining progress`（= Timer 原子语义） | 组件里自写 `elapsed += 1; if (elapsed >= duration)` |
| 几何（碰撞/A*/导航） | `@engine/spatial`: `contactBetween aabbOf halfExtents astar bakeNavGraph` | — |

## 2. 世界查询 `@engine/core/query` + `IWorld`

| 要做什么 | 用 |
|---|---|
| 按语义 id 找实体（Resource.id / Flag.id / State.fsmId / StringVar.id…） | `world.byId(type, idField, id)`（O(1) 索引·创建序首个·严格模式按 reads 把关）；便捷 `findByComponentId / getComponentById` |
| 确定性遍历 | `sortedIds(world, ...types)`——**系统里遍历多实体一律用它**（lockstep 序稳定） |
| 世界随机种子 | `worldSeed(world)`（黑板单例） |
| 单例组件 | `world.singleton(type)` |
| 条件/求值/写入（规则内核） | `@engine/logic`: `ctxOf selfCtx evalCondition evalValue applyWrite`（唯一的一份 clamp） |
| tick 内事件总线 | `world.emit(type, ev)` / `world.events(type)` + 系统申报 `emits/listens`——**同拍发出→同拍消费的瞬时事件走它**（多读者·不进快照）；跨拍挂起等消费的仍用组件 + consumes（Signal/ResourceModify） |

## 3. 随机 `@atom-skills/random`（裸 `Math.random` = 红线）

| 要做什么 | 用 |
|---|---|
| sim 内取数 | `nextRandom(seed) randomInt chancePass` |
| 派生独立流（AI 性格流·sim 外 meta 流·每波流） | `deriveSeed(seed, label)` → 新 `RandomSeed` |
| 洗牌/抽签袋（不放回·抽空重洗）/加权抽取/正态浮动 | `seededShuffle` · `createShuffleBag drawFromBag` · `@skills/tier2/weighted-pick.weightedPick` · `gaussianApprox` |

## 4. 数据糖（manifest 装载期折算·零运行时改动）

| 写法 | 折成 |
|---|---|
| 数字字段 `"2s" / "500ms" / "1.5min"` | 按 `meta.tickRate` 折整数拍 |
| 顶层 `tags: { enemy: 1, boss: 2 }` + 数字字段 `"enemy\|boss"` | 位或；未知名硬错点名 |

## 5. 共享件（引擎已下沉·游戏侧必须消费）

| 要做什么 | 用 | 所在手册 |
|---|---|---|
| 流水事件日志（对局记录/回放文本/UI 滚动条） | `@skills/tier1/event-log.js`: `createEventLog()` → `push recent all clear dump`（旁路观测·不进 hash） | events-logic.md |
| 局外小态 / 本地榜 / 偏好 | `@services/persist`: `localStore(key, fallback, codec)` + `jsonCodec/textCodec/intCodec/flagCodec` · `insertRanked` | save-platform.md |
| 牌码 / 建牌堆 | `@skills/tier2/cardboard-codec.js`: `cardCode codeSuit codeRank isJoker buildDeck({decks,jokers,minRank})` | cards.md |
| 修正栈聚合 | `@skills/tier2/modifier-stack.js: aggregateModifiers` | combat.md |
| 宿主壳 / 运行环 / 美术装载 | `engine/host mountHost createRunLoop` · `assets/game-art-load` | game-production.md |

## 6. 查不到怎么办

标准工具箱里还没有的（如定点数、颜色数学进 sim、时间缩放）多半是**有意不做**——理由在评审 §3.4 / §6。真缺件走 `docs/workflow/requests.md` 缺口裁决三步；**别在游戏里先写一份**。
