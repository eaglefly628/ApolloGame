# 粒子系统模块知识

> 覆盖：粒子发射器、粒子池、视觉特效

## 核心原则

- 粒子 = 大量短生命周期的简单实体（位置 + 速度 + 颜色 + 生命值）。
- 粒子不是 ECS 实体 — 数量太多（几百到几千），单独管理用专用数据结构。
- 粒子纯视觉，不参与碰撞和游戏逻辑。

## 粒子发射器

```typescript
interface ParticleEmitter {
  x: number; y: number;            // 发射位置
  rate: number;                     // 每秒发射数
  maxParticles: number;             // 池大小
  lifetime: { min: number; max: number };       // 粒子寿命（tick）
  speed: { min: number; max: number };          // 初始速度范围
  angle: { min: number; max: number };          // 发射角度范围
  gravity: number;                  // 粒子受的重力
  color: { start: number; end: number };        // 颜色渐变
  alpha: { start: number; end: number };        // 透明度渐变
  scale: { start: number; end: number };        // 大小渐变
}
```

- 每 tick：按 rate 生成新粒子 → 更新所有活粒子（位移 + 衰减）→ 移除死粒子。
- 发射形状：点发射、圆形发射、矩形发射、沿线段发射。

## 粒子池（必须）

- 预分配固定数量的粒子对象，用环形缓冲区或空闲列表管理。
- 发射时从池里取，死亡时归还。
- 池满时策略：丢弃新粒子 / 回收最老的粒子。

```typescript
// SoA 布局（Structure of Arrays）— 粒子最适合这种布局
const MAX = 1000;
const xs = new Float32Array(MAX);
const ys = new Float32Array(MAX);
const vxs = new Float32Array(MAX);
const vys = new Float32Array(MAX);
const lives = new Float32Array(MAX);  // 剩余生命，0 = 死亡
let count = 0;
```

- Float32Array 连续内存布局 → CPU 缓存友好 → 遍历快。

## 常见特效配方

| 特效 | 参数要点 |
|------|---------|
| **爆炸** | 全方向（0-360°）、高初速、短寿命、红→橙→黄渐变 |
| **烟雾** | 向上缓慢飘动、低初速、长寿命、灰色→透明 |
| **火花** | 窄角度发射、高初速、受重力、黄→白 |
| **落叶** | 随机角度、极低速、正弦横向摆动、长寿命 |
| **血溅** | 受击方向扇形、中速、受重力、红色 |
| **尘土** | 着地时向两侧发射、低速、短寿命、棕色→透明 |
| **拖尾** | 跟随实体位置发射、零初速、短寿命、渐隐 |

## 渲染

### Canvas2D
- 每个粒子一次 `fillRect` 或 `drawImage`。
- 1000 个 1px 方块粒子在 Canvas2D 上性能可接受。
- 有纹理的粒子用预渲染的小图。

### WebGL / PixiJS
- 粒子用 point sprite 或 instanced rendering — 一次 draw call 画全部。
- PixiJS 有 `@pixi/particle-emitter` 插件。
- 性能：WebGL 下 10000+ 粒子无压力。

## 与 ECS 的集成方式

粒子系统不放在 ECS tick 循环里，而是作为渲染层的附属：

1. ECS 事件触发粒子：碰撞 → 火花，死亡 → 爆炸，跳跃 → 尘土。
2. 通过事件组件传递：`{ type: 'ParticleRequest', effect: 'explosion', x, y }`。
3. 渲染层的粒子管理器消费请求，独立更新和渲染。
4. 粒子 tick 可以和 ECS tick 同步，也可以用自己的更新频率。

## 高级技术

### 曲线编辑器
- 粒子属性（速度、大小、颜色、透明度）随生命周期变化，用曲线控制。
- 开发工具：可视化曲线编辑器，实时预览效果。

### 子发射器
- 粒子死亡时触发新的发射器 — 烟花（上升粒子 → 爆炸粒子）。

### 力场
- 粒子受外部力场影响：风、漩涡、吸引点。
- 实现：每 tick 给粒子加额外加速度。

## 常见陷阱

- 粒子太多导致 Canvas2D 卡顿 — 超过 500 个就要考虑 WebGL。
- 粒子位置用浮点但渲染用整数 — 可能看起来"抖动"。渲染时 Math.round。
- 粒子的随机参数必须用确定性 PRNG — 否则联机时两端粒子不同步（如果粒子影响游戏性的话）。
- 纯视觉粒子可以用 Math.random — 不影响确定性，两端不同也没关系。

## 前沿技术

- **GPU 粒子 (WebGPU Compute)**：粒子更新和渲染全在 GPU，百万粒子级别。
- **Signed Distance Field (SDF) 粒子**：用 SDF 做粒子形状，支持 metaball 效果（水滴融合）。
- **粒子 LOD**：远处粒子合并或降频更新，近处保持高精度。

## 参考来源

- *Juice it or Lose it* (GDC 2012) — 粒子效果对游戏手感的影响
- PixiJS particle-emitter — Web 端粒子系统的成熟库
- Dead Cells 视觉反馈 — 2D 动作游戏粒子效果的标杆
