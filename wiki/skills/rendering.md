# 渲染模块知识

> 覆盖原子：sprite、camera、text、color、visibility

## 核心原则

- 渲染层是 ECS 的单向投影：只读 Transform/Sprite/Color 等组件，绝不写回。
- 渲染后端可替换：Canvas2D → PixiJS → WebGL，collectRenderables 提取逻辑不变。
- visibility.visible 控制是否渲染，visibility.active 控制是否参与系统运算。

## Canvas2D（当前后端）

- 够用于 MVP 和原型验证。
- 每帧 clearRect → 按 zOrder 排序 → 逐个绘制。
- 性能天花板：~500 个精灵开始卡顿（取决于设备）。

## PixiJS 升级路径

- 替换 CanvasRenderer 为 PixiRenderer，接口不变。
- Sprite 批处理（batching）：相同纹理的精灵合并为一次 draw call，性能提升 10 倍+。
- 集成方式：ECS 的 Sprite/Transform 每帧同步到 Pixi DisplayObject。

## 相机系统

- Camera 组件定义观察窗口：zoom、offset、viewport 尺寸。
- 世界坐标 → 屏幕坐标：screenX = (worldX - camera.offsetX) × zoom。
- 相机跟随：每帧把 camera.offset 插值到目标实体的 Transform。
- 屏幕抖动：给 camera.offset 加随机偏移 + 衰减 timer。

## 文字渲染

- Text 组件：content、fontSize、fontFamily、anchor。
- 伤害数字：spawn 一个带 Text + Velocity(上飘) + Lifetime 的实体。
- 多语言：content 存 key，渲染时查翻译表。

## 常见陷阱

- zOrder 排序每帧都做 — 如果实体多，用插入排序（近乎有序数组上 O(n)）。
- 不要在渲染 System 里修改 Transform — 渲染是只读操作。
- 相机 zoom 会影响碰撞判断的视觉 — 确保碰撞在世界坐标做，不受 zoom 影响。

## 参考来源

- PixiJS — 数千款 HTML5 游戏验证的 2D WebGL 引擎
- Apollo CanvasRenderer — 当前实现，升级时保持接口不变
