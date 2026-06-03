# 数学工具模块知识

> 覆盖：向量运算、插值、缓动函数、角度、随机

## 核心原则

- 游戏数学 90% 是向量加减和插值 — 不需要线性代数库，手写几个函数就够。
- 所有数学运算必须确定性：不用 Math.hypot、不用 Math.random、注意浮点精度。
- 能用整数的场景不用浮点：像素坐标、瓦片坐标、tick 计数。

## 向量运算

```typescript
// 基础运算（不创建新对象，直接操作分量）
length(x, y) = Math.sqrt(x * x + y * y)   // 不用 Math.hypot
normalize(x, y) → { x/len, y/len }         // len=0 时返回 {0,0}
dot(ax, ay, bx, by) = ax*bx + ay*by
cross2d(ax, ay, bx, by) = ax*by - ay*bx    // 2D 叉积是标量
distance(x1, y1, x2, y2) = length(x2-x1, y2-y1)
```

- 不要创建 Vector2 类实例做临时运算 — GC 压力。用分量直接算。
- 需要距离比较时用 `distanceSquared` 避免 sqrt。

## 线性插值（Lerp）

```typescript
lerp(a, b, t) = a + (b - a) * t    // t ∈ [0, 1]
```

- 用途：平滑移动（相机跟随）、颜色渐变、音量过渡。
- t 不 clamp 会超调 — 除非故意要弹性效果。
- 帧率无关 lerp：`value = lerp(value, target, 1 - Math.pow(smoothing, dt))`。Apollo 用固定 tick 所以直接用常量 t 即可。

## 缓动函数（Easing）

| 函数 | 公式 | 视觉效果 |
|------|------|---------|
| easeInQuad | t² | 慢启动 |
| easeOutQuad | 1-(1-t)² | 慢停止 |
| easeInOutQuad | 分段 | 慢启慢停 |
| easeOutBounce | 分段弹跳 | 落地弹跳 |
| easeOutElastic | 弹簧衰减 | 弹性 UI |
| easeOutBack | 超调回弹 | UI 弹出 |

- t 是归一化时间（elapsed / duration），输出是归一化进度。
- 用途：UI 动画、伤害数字飘动、角色受击闪烁。
- 不要在物理运算里用 easing — 物理用真实的力和加速度。

## 角度与方向

```typescript
// 弧度制（TS Math 全用弧度）
atan2(dy, dx) → 弧度角（-π 到 π）
// 角度归一化到 [-π, π]
normalizeAngle(a) = a - Math.round(a / (2*PI)) * (2*PI)
// 最短旋转方向
shortestAngle(from, to) = normalizeAngle(to - from)
```

- 2D 游戏里"朝向"通常只用 ±1（左右翻转），不用真正的角度。
- 需要射击方向时才用 atan2。

## 矩形运算

```typescript
// AABB 包含检测
contains(rect, px, py) = px >= rect.x && px <= rect.x + rect.w && ...
// AABB 相交
intersects(a, b) = a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y
// 扩展 AABB（加边距）
inflate(rect, margin) = { x: rect.x-margin, y: rect.y-margin, w: rect.w+2*margin, h: rect.h+2*margin }
```

## Clamp 与 Remap

```typescript
clamp(value, min, max) = Math.max(min, Math.min(max, value))
remap(value, inMin, inMax, outMin, outMax) = outMin + (value-inMin)/(inMax-inMin) * (outMax-outMin)
```

- clamp 是最常用的数学工具 — 血量、坐标、音量都要 clamp。
- remap 把一个范围映射到另一个：距离 [0,500] → 音量 [1,0]。

## 确定性随机

- Apollo 用 RandomSeed 组件的 PRNG，不用 Math.random()。
- 常用算法：xorshift32、mulberry32 — 简单快速，周期足够。
- 随机范围：`min + (prng() % (max - min + 1))`（整数），`min + prng01() * (max - min)`（浮点）。
- 洗牌：Fisher-Yates，用 PRNG 而非 Math.random。

## 常见陷阱

- `Math.sqrt(-epsilon)` 返回 NaN — 在 length 计算前检查是否为负（浮点精度问题）。
- 角度差超过 π 时旋转方向反了 — 用 shortestAngle。
- lerp 的 t > 1 时超调 — UI 动画可以接受，物理运算不行。
- 整数除法用 `Math.floor(a/b)` 而非 `a/b|0` — 后者对负数行为不同。

## 前沿技术

- **WASM SIMD**：浏览器支持 SIMD 指令，批量向量运算加速 4 倍。适合粒子系统、大量实体运动。
- **Fixed-point arithmetic**：用整数模拟小数（×1000），完全确定性。适合联机核心逻辑。
- **Spatial hashing with bit tricks**：用位运算加速空间哈希的键计算。

## 参考来源

- *Game Programming Patterns* — lerp 和缓动在游戏中的应用
- easings.net — 所有标准缓动函数的可视化和公式
- Apollo src/atom-skills/random/index.ts — 当前 PRNG 实现
