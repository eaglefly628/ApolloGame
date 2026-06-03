# 瓦片地图模块知识

> 覆盖：Tilemap 渲染、图块集、Tiled 编辑器、瓦片碰撞

## 核心原则

- 瓦片地图是 2D 游戏最高效的关卡构建方式 — 一个二维数组 + 一张图块集 = 整个关卡。
- 瓦片是静态的：不是 ECS 实体，不参与 tick 循环。只在碰撞检测时被查询。
- 分层：地面层（碰撞）、装饰层（只渲染）、前景层（遮挡玩家）。

## 数据结构

```typescript
interface Tilemap {
  width: number;          // 横向格数
  height: number;         // 纵向格数
  tileSize: number;       // 每格像素（16/32/64）
  layers: TileLayer[];
}

interface TileLayer {
  name: string;           // 'ground' | 'decoration' | 'foreground'
  data: number[];         // 一维数组，row-major，0 = 空格
  collides: boolean;      // 是否参与碰撞检测
}
```

- 坐标转换：`tileX = Math.floor(worldX / tileSize)`, `tileY = Math.floor(worldY / tileSize)`。
- 索引转换：`index = tileY * width + tileX`。

## Tiled 编辑器

- 行业标准的 2D 地图编辑器（免费开源）。
- 导出 JSON 格式，可直接解析为上述数据结构。
- 支持：正交/等距/六角地图、动画瓦片、对象层（放置敌人、触发器）。
- 对象层 → ECS 实体：Tiled 里放的每个对象 → 场景加载时 spawn 对应实体。

## 图块集（Tileset）

- 一张大图包含所有瓦片，按网格切割。
- 每个瓦片有 ID（从 1 开始，0 = 空）。
- 渲染时：瓦片 ID → 计算在图块集中的 UV 坐标 → 绘制到对应位置。

```typescript
// 从瓦片 ID 计算图块集中的源矩形
const col = (tileId - 1) % tilesPerRow;
const row = Math.floor((tileId - 1) / tilesPerRow);
const srcX = col * tileSize;
const srcY = row * tileSize;
```

## 瓦片碰撞

- 不需要对每个瓦片做 AABB 检测 — 只检查实体周围的瓦片。
- 查询算法：实体 AABB → 覆盖哪些瓦片坐标 → 查这些瓦片是否 collides。

```typescript
const startCol = Math.floor(entityLeft / tileSize);
const endCol = Math.floor(entityRight / tileSize);
const startRow = Math.floor(entityTop / tileSize);
const endRow = Math.floor(entityBottom / tileSize);
for (let r = startRow; r <= endRow; r++)
  for (let c = startCol; c <= endCol; c++)
    if (getTile(layer, c, r) !== 0) { /* 碰撞 */ }
```

- 穿透分离和实体碰撞相同：normal × depth 推开。
- 瓦片等效于 mass=0 的静态物体。

## 渲染优化

- **只画可见区域**：根据相机位置计算可见瓦片范围，只绘制这些。
- **离屏缓存**：把整层瓦片预渲染到一张大 Canvas，滚动时只做 drawImage 偏移。
- **图块集合批**：所有瓦片共用同一张纹理 → WebGL 下一次 draw call 画整层。
- 动画瓦片（水面、岩浆）：用全局 Timer 切换帧，所有同类瓦片同步动画。

## 自动图块（Auto-tiling）

- 根据相邻瓦片自动选择正确的边角图案。
- Wang tiles / Blob tileset：4 位/8 位邻接掩码 → 对应图块 ID。
- Tiled 内置地形画笔支持自动图块。

## 大地图处理

- 超大地图（1000×1000+）不能一次性加载 — 分块（chunk）加载。
- 每个 chunk 是 16×16 或 32×32 瓦片，按需加载和卸载。
- 无限地图：程序化生成 chunk，噪声函数决定地形。

## 常见陷阱

- Tiled 导出的坐标系 y 轴向下 — 和某些引擎的 y 轴向上不同，注意翻转。
- 瓦片 ID 从 1 开始（Tiled 约定）— 代码里容易写成从 0 开始。
- 碰撞检测时实体移动太快跳过瓦片 — 和实体碰撞一样需要子步进。
- 装饰层不要参与碰撞 — 否则背景花草会挡住角色。

## 前沿技术

- **LDtk（Level Designer Toolkit）**：比 Tiled 更现代的关卡编辑器，JSON 导出，内置自动图块和实体定义。
- **Wave Function Collapse**：基于约束传播的程序化瓦片生成，比纯噪声更有结构感。
- **GPU Tilemap 渲染**：用 instanced rendering 或纹理数组，一次 draw call 画整张地图。

## 参考来源

- Tiled Map Editor — 2D 地图编辑的行业标准工具
- Celeste 关卡设计 — 像素完美瓦片碰撞的参考实现
- LDtk — 现代关卡编辑器（Dead Cells 作者开发）
