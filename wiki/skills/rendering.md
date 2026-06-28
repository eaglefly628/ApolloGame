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

## 3D 盒庭渲染线（Three.js · render-only 数据组件）

技术栈：**纯 Three.js**（`three` + `three/addons`），全代码库零裸 WebGL——能用 ThreeJS 做的就别手写 GL。
后端 `ThreeRenderer`（`src/renderer/three-renderer.ts`），几何纯函数在 `three-projection.ts`（node 可测）。

- **数据组件（render-only·不进 sim/hash）**：`Mesh3D`（box/plane 体块）、`Transform3D`（真三维位姿）、
  `Camera3D`（轨道相机单例=盒庭模式·运行时输入可改 yaw/pitch 旋转）、`Sky3D`（程序化天空盒）、
  `Model3D`（导入式 glTF 模型）、`Light3D`（数据化光照·directional/ambient·多盏）、`Post3D`（后处理·移轴景深+泛光）。
  新增 render-only 组件必登记 `net/determinism.ts` 的 `NON_DETERMINISTIC`（相机/光/阴影/材质/位姿跨 GPU 浮点非确定）。
- **后处理（Post3D·EffectComposer）**：水平+垂直 tilt-shift ShaderPass（移轴景深·Captain Toad 微缩感）+ UnrealBloomPass。
  懒建管线，参数每帧从数据设 uniform/enabled；无 Post3D → 直接 `gl.render`（向后兼容）。SwiftShader 软件 GL 下也能跑（无头截图验证）。
- **数据化光照（Light3D）**：首盏 castShadow 平行光当主阴影灯（盒庭 placeShadow 自动框场景），其余平行光池管理，
  ambient 整体补亮；无 Light3D → 退回引擎默认暖主光+冷补光。`dir` 是「光的去向」（位置方向取反）。
- **旋转交互**：拖拽/滚轮等输入改 `Camera3D` 的 yaw/pitch/distance = 运行时输入胶水（同键盘→Velocity 先例·input 捕获是运行时职责），不进 sim/hash。
- **实例化绘制（W1-A·高效低开销）**：同「视觉签名」（`mesh3dBatchKey`=shape+尺寸+逐面色）的多个 `Mesh3D` → 一个
  `InstancedMesh`（1 draw call）。**全渲染器内部、零数据改动**——游戏照常摆 N 个 `Mesh3D` 实体，渲染器自动批，
  **绝不往数据加 `instanced` 旗标**（那会把渲染关切泄进数据·违宣言）。逐面色**烤进几何 `vertexColors`**（实例共享一个材质，
  色靠几何携带·故色不同=不同批）；透明盒(alpha<1)走单 mesh fallback。位姿合成复用一个 dummy `Object3D`（别每帧每实体 new）。
  坑：`InstancedMesh` 默认按单实例包围盒做视锥剔除会误剔散布的整批 → `frustumCulled=false`（或维护 boundingSphere）。
- **每帧零浪费（W1-B）**：颜色/alpha 是 uniform，每帧重传即可，**别设 `material.needsUpdate`**（会触发 shader 重编译）；
  仅贴图引用变（USE_MAP define 翻转）才 needsUpdate。不透明物体 `transparent:false`（走 opaque 管线·early-z·不排序）。
- **观感快赢（W1-D）**：`ACESFilmicToneMapping`+曝光（PBR 通透不削顶·天空盒材质 `toneMapped:false` 保程序化色）；
  `setPixelRatio(min(dpr,2))`（retina 不糊·上限防超采样）。
- **模型导入（glTF）**：蓝图只持 `modelKey`（保纯）；资产层 `ModelAssetLoader` 取 `.glb` 字节(ArrayBuffer·**零 three 依赖**)，
  `ThreeRenderer` 用 `GLTFLoader.parse(bytes)` 解析成 three 场景。**解析一次入模板缓存 → 多实例 `clone(true)`**（共享几何省显存，
  每实例 clone 材质供独立染色/释放）。导入走 asset key、loader 在引擎（同 sprite 先例），别在蓝图塞 URL/二进制。
- **光照/阴影**：暖白主光 + 冷蓝补光 + 哑光材质；盒庭模式每帧 `placeShadow` 按场景包围盒重定位主光 + 调正交视锥
  （PCFSoftShadowMap 在 three 0.184 已弃用 → 用 PCFShadowMap）。
- **静态资产 + 无头截图**：模型放 `public/models/`（vite 在 dev/build/preview 都从根服·base='/'）；
  `scripts/shoot-game.mjs`（SwiftShader 软件 WebGL）出真 3D 回归图。
- **向后兼容铁律**：无 `Camera3D` 必退回原 2D 俯视自适配（别破坏 2D 后端 / three-lab / 现有游戏）。

### 3D 常见陷阱
- **glTF 节点内建 scale**：物体真实尺寸 ≠ accessor POSITION min/max（节点常带缩放）。Duck 的 mesh-local 高 154，
  但节点缩到 ~2.2 单位 → 按裸 accessor 定 `Model3D.scale` 会差几十倍。**按渲染后 `Box3.setFromObject` 包围盒**定 scale。
- **clone 共享几何/材质**：`Object3D.clone(true)` 复制节点但**共享** geometry+material。逐实例释放 clone 会误伤模板/兄弟实例
  → 只释放实例自 clone 的材质，几何随模板在 `destroy` 释放。
- **模型原点未必在脚底**：glTF 原点可能在中心/偏移（Duck min.y>0）→ 落地面时可能轻微悬浮，按需补 y 偏移。
- **GLTFLoader.parse 是异步**：首帧 kick 解析、标 pending 防每帧重复；未就绪本帧不画（同 sprite 未就绪占位）。

## 参考来源

- PixiJS — 数千款 HTML5 游戏验证的 2D WebGL 引擎
- Apollo CanvasRenderer — 当前实现，升级时保持接口不变
- Three.js（`three` + `three/addons`）— 3D 盒庭渲染线后端；GLTFLoader 走 addons
- Khronos glTF-Sample-Assets — 基础测试模型来源（见 `public/models/CREDITS.md`）
