# 性能优化模块知识

> 覆盖：帧预算、GC 回避、批处理、内存布局、性能剖析

## 核心原则

- 60fps = 每帧 16.67ms 预算。超过就掉帧，玩家能感知。
- 游戏性能瓶颈 90% 来自三个地方：GC 暂停、draw call 过多、O(n²) 算法。
- 先量测再优化 — 不要猜。用 Performance API 和 Chrome DevTools 定位瓶颈。

## 帧预算分配

| 阶段 | 目标预算 | 说明 |
|------|---------|------|
| Input 采集 | < 0.5ms | 读键盘/触屏状态 |
| ECS tick | < 8ms | 所有 System 执行 |
| 碰撞检测 | < 3ms | 宽相位 + 窄相位 |
| 渲染 | < 4ms | Canvas/WebGL draw |
| UI 更新 | < 1ms | React 差异更新 |
| **总计** | **< 16.67ms** | |

- 用 `performance.now()` 在关键段落插桩测量。
- ZeroCraft 的 Tracer 已有计时功能（src/debug/tracer.ts）。

## GC 回避

JavaScript GC 是 stop-the-world — 一次 minor GC 5-10ms，major GC 50ms+。

### 避免在热路径创建对象

```typescript
// ❌ 每 tick 创建新对象
function tick() { const pos = { x: e.x, y: e.y }; ... }

// ✅ 预分配复用
const _pos = { x: 0, y: 0 };
function tick() { _pos.x = e.x; _pos.y = e.y; ... }
```

### 避免在热路径创建数组

```typescript
// ❌ 每帧 filter 创建新数组
const alive = entities.filter(e => e.active);

// ✅ 原地遍历
for (const e of entities) { if (!e.active) continue; ... }
```

### 对象池

- 子弹、粒子、伤害数字用池。
- 池大小 = 同屏最大数量 × 1.5（留余量）。
- 复用时 reset 所有字段，不要依赖默认值。

## 批处理

### 渲染批处理
- 相同纹理的精灵合并为一次 draw call。
- Canvas2D：按 textureKey 排序后连续绘制。
- WebGL/PixiJS：自动 batch，只要不切换纹理/shader。

### System 批处理
- 一个 System 遍历所有匹配实体 — 比每个实体跑所有 System 缓存友好。
- 组件数据紧凑排列：同类型组件存在连续数组里（Structure of Arrays）。

## 数据导向设计（DoD）

- CPU 缓存行 = 64 字节。数据连续排列 → 缓存命中率高 → 速度快。
- ECS 天然适合 DoD：System 遍历同类组件 = 顺序读内存。
- 实际影响：1000 实体时 DoD 比 OOP 快 2-5 倍；10000 实体时快 10 倍+。

### SoA vs AoS

```typescript
// AoS (Array of Structures) — 当前 ZeroCraft 方式
entities = [ { x: 1, y: 2, vx: 3, vy: 4 }, { x: 5, y: 6, vx: 7, vy: 8 } ]

// SoA (Structure of Arrays) — 更缓存友好
xs = [1, 5]; ys = [2, 6]; vxs = [3, 7]; vys = [4, 8];
```

- SoA 在 JS 里用 TypedArray（Float32Array）效果最好。
- ZeroCraft 当前用 AoS（Map<EntityId, Component>），百实体级够用。千实体级考虑 SoA。

## 空间分区复杂度

| 数据结构 | 构建 | 查询 | 适合 |
|---------|------|------|------|
| 暴力遍历 | O(1) | O(n²) | < 50 实体 |
| 网格分区 | O(n) | O(1) 邻居 | 均匀分布 |
| AABB 树 | O(n log n) | O(log n) | 大小差异大 |
| 四叉树 | O(n log n) | O(log n) | 稀疏分布 |

## 性能剖析工具

| 工具 | 用途 |
|------|------|
| Chrome DevTools Performance | 火焰图、帧时间线 |
| Chrome DevTools Memory | 堆快照、分配追踪 |
| `performance.now()` | 手动插桩计时 |
| `performance.mark/measure` | 命名标记，DevTools 可视化 |
| ZeroCraft Tracer | System 级别计时 |
| `--js-flags="--trace-gc"` | Node.js GC 日志 |

## 渐进式优化路径

1. **先让它跑起来** — 正确性优先。
2. **量测** — 用 profiler 找到最慢的那 20%。
3. **算法优化** — O(n²) → O(n log n)，空间分区。
4. **减少分配** — 对象池、预分配、避免临时对象。
5. **批处理** — 渲染合批、System 遍历优化。
6. **数据布局** — SoA、TypedArray（只在真正需要时）。

## 常见陷阱

- 过早优化：SoA + TypedArray 在 100 实体时没有意义，反而降低可读性。
- JSON.parse 大文件阻塞主线程 — 用 Worker 或流式解析。
- `Array.sort` 对小数组用插入排序 — 但大数组 V8 用 TimSort，不稳定。渲染排序需要稳定排序。
- requestAnimationFrame 回调里做太多事 — 把逻辑放 tick，rAF 只做渲染。

## 前沿技术

- **OffscreenCanvas + Worker**：渲染在独立线程，主线程只跑逻辑。
- **SharedArrayBuffer**：主线程和 Worker 共享内存，零拷贝。适合 SoA 组件数据。
- **WebAssembly (WASM)**：C/Rust 编译到 WASM，物理和碰撞计算提速 5-10 倍。
- **WebGPU Compute**：GPU 通用计算，适合大规模粒子/流体模拟。
- **Scheduling API (scheduler.postTask)**：按优先级调度任务，避免低优先级任务阻塞渲染。

## 参考来源

- Mike Acton CppCon 2014 — 数据导向设计的核心思想（1小时视频）
- Factorio 技术博客 — 百万实体级优化的真实案例
- Chrome DevTools Performance 文档 — 帧剖析和内存分析教程
