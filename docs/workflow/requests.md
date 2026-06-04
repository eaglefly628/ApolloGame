# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

> **PB 缺口分析综述（2026-06-03，Game B 乙游 VN）**
> 引擎今天的真实形态 = **确定性 2D 物理/平台跳跃 ECS + debug 渲染器 + 纯键盘输入**。
> 一个 VN ≈ 叙事引擎 + 演出 + UI + 音频 + 存档。现有 `resource/flag/state/text/timer/random` 是**最底层数据积木**，VN 形状的系统几乎整层缺失。
> 已对照真实代码验证的硬事实：
> - `canvas-renderer.ts`：`Sprite` → 画 16×16 **占位方块**，`textureKey` 被忽略（**画不了图片**）；文本 = `fillText` **单行不换行**。
> - 全项目 **无音频后端**（`Sound` 是死数据，没人播）。
> - `main.tsx` **只接键盘**；pointer/click 不进世界；`action-map` 无 system，无命中测试。
> - UI = `useComponent` + `Bar`（1 个 widget）+ `GameOverlay`（debug HUD）；主题是 `spec.md`/类型目录，**无实现组件**。
> 下列**仅引擎/共享层**需求，按 Game B v0.1→v1.0 的拉动排优先级。游戏层活（对话运行器/菜单/检定/存档界面）我 PB 自己做，附在末尾仅供参考、非需求。

---

### R1 · [2026-06-03] · PB · Game B · status: open · 优先级: **P0**（阻塞一切 VN 画面）

**标题**：贴图精灵渲染 —— 渲染器要能加载并绘制 `Sprite.textureKey`（背景图 + 立绘）

- **想实现的游戏行为**：画一张背景图（办公室/咖啡厅）+ 角色立绘（带 z 分层、左右站位）。
- **已经试了什么**：给实体挂 `Sprite{textureKey, zOrder}` + `Transform`。
- **卡在哪 / 缺什么**：`CanvasRenderer.sync` 对 `r.sprite` 只画 `fillRect(-8,-8,16,16)` 占位方块，**完全无视 `textureKey`**，没有任何图片加载/缓存/绘制路径。无图 = VN 没法看。
- **建议方案**：渲染器（`src/renderer`，共享层）加 image 资产加载缓存（`HTMLImageElement`/`drawImage`），`collectRenderables` 已经把 `sprite` 透出。可配合 `Color.alpha`（渲染器已读 `globalAlpha`）做淡入。这是后端能力，非新原子。

---

### R2 · [2026-06-03] · PB · Game B · status: open · 优先级: **P0\***（可被 React-DOM 方案规避）

**标题**：对话文本多行/自动换行渲染

- **想实现的游戏行为**：对话框里一段长台词按框宽换行、多行显示、可翻页。
- **已经试了什么**：`Text{content}` 渲染。
- **卡在哪 / 缺什么**：`fillText(content,0,0)` 单行硬画，**无换行、无多行、无分页**。
- **建议方案（两条，请 Lead 拍）**：
  ① 渲染器侧支持按 maxWidth 断词换行（可能需要一个 `TextBox{content,maxWidth,lineHeight}` 渲染概念，区别于点状 `Text`）；或
  ② **架构规避**：对话框/选项/面板全部用 **React-DOM 浮层**（`GameOverlay` 已是 React DOM，CSS 原生换行），canvas 只画背景+立绘。**这样 R2 直接消失**。我倾向 ②，但需 Lead 确认这是被祝福的 UI 路径（见 R3）。

---

### R3 · [2026-06-03] · PB · Game B · status: open · 优先级: **P0\***（与 R2 方案联动）

**标题**：点击/指针输入接入 + 确定性 per-tick 注入约定

- **想实现的游戏行为**：玩家点选项 → 推进剧情、改好感。
- **已经试了什么**：`input-capture` schema 支持 pointer，`action-map` 定义 `Action`。
- **卡在哪 / 缺什么**：`main.tsx` **只 wire 了键盘**，pointer 事件不进 `RawInput`；`action-map` 无 system；无命中测试（点了哪个选项）。点击当前完全断路。
- **建议方案**：
  - 若走 R2-① canvas 方案：需 pointer→RawInput 接入 + 屏幕坐标→实体命中测试。
  - 若走 R2-② React-DOM 方案：UI 用原生 `onClick`，但**点击需作为确定性输入按 tick 灌进世界**（叙事状态仍住世界里，符合 `EnginePort` "输入按 tick 注入" 模型）。请 Lead 给一个"React 事件 → 当帧 input source"的约定/入口（哪怕只是一个 `engine.enqueueAction(name,value)`）。这是确定性边界，归引擎定。

---

### R4 · [2026-06-03] · PB · Game B · status: open · 优先级: P1

**标题**：`string-variable`（周期表 X3 扩展原子，未实现）—— string 容器

- **想实现的游戏行为**：持久化语义字符串状态：当前剧情节点 id、玩家取名、动态文本替换变量、结局标识、上次选择。
- **已经试了什么**：核心原子只有 number(`Resource`)/bool(`Flag`) 容器；`State.current` 是字符串可临时承载**单个**对话指针；对话内容放 JSON。
- **卡在哪 / 缺什么**：protocol 无通用 string 容器；`atom-skills/` 无 `string-variable`。周期表扩展 B 已明确预留 X3 并标"对话系统刚需"，只是没实现。多个并存的命名字符串变量无处安放。
- **建议方案**：仿 `Resource`+`ResourceModify`+`resource-apply` 三件套：
  ```
  interface StringVariable extends Component { keyId: string; value: string; locId: string }
  interface StringSet      extends Component { keyId: string; value: string }   // 一次性写事件
  // string-apply: query('StringVariable','StringSet') 匹配 keyId → v.value = s.value
  ```
  纯 POD + 一次性事件，`structuredClone` 友好 → 自动进 `world.snapshot()`。属扩展原子层，不污染核心 26。

---

### R5 · [2026-06-03] · PB · Game B · status: open · 优先级: P1

**标题**：`condition` 谓词求值（Tier 2 候选）—— 组合条件门控选项/分支

- **想实现的游戏行为**：选项/分支按条件出现："好感_S ≥ 30 且 见过_T 且 非 已拒绝"。
- **已经试了什么**：`Flag` 是单 bool；`Resource` 是单数值。组合判断只能游戏层硬写 if。
- **卡在哪 / 缺什么**：无把"读多个 resource/flag → 求一个 bool"产物化的通用能力。VN 分支大量依赖它；Game A 的钥匙/开关门控同理。
- **建议方案**：一个可声明的谓词组件（`Condition{ clauses:[{kind:'resource'|'flag', id, op, value}], mode:'and'|'or' }` → 输出一个 `Flag`/`Trigger`），由 Tier 2 系统求值。**过度设计风险已知**：若只我用得上，Lead 可判定留游戏层。提出来是为暴露"是否两游戏共需"。

---

### R6 · [2026-06-03] · PB · Game B · status: open · 优先级: P1

**标题**：`tween / interpolate`（Tier 1 候选）—— 数值随时间朝目标缓动

- **想实现的游戏行为**：立绘淡入淡出（`Color.alpha`）、场景切换淡黑、好感条平滑填充、立绘滑入（`Transform.x`）。
- **已经试了什么**：`animation`（Tier1）只做离散 `frame.index++`；`Bar.tsx` 用 CSS transition；打字机可用 `timer.elapsed` 切片。
- **卡在哪 / 缺什么**：无 ECS 内**确定性**连续插值（存档重放一致、不靠 CSS）。难点 = 字段寻址（写"哪个组件的哪个字段"）。
- **建议方案**：`Tween{ target, field, from, to, elapsed, duration, easing }`，Tier1 推进 `value = from+(to-from)*ease(t)`；或退一步只支持 `Resource.current`/`Color.alpha` 高频字段避开泛型寻址。**渲染器已读 `globalAlpha = Color.alpha`，tween 一到淡入即通**。Game A 镜头/击退也用 —— 跨游戏复用价值高。

---

### R7 · [2026-06-03] · PB · Game B · status: open · 优先级: P2

**标题**：`resource-threshold`（Tier 2 候选）—— 资源跨阈值触发

- **想实现的游戏行为**：好感阈值事件（30/60/90）、失败结局（体力归零 / 全好感<20）。
- **已经试了什么**：`resource-apply` 只 clamp 不产"越线"信号；`trigger-zone` 是空间触发不适用。
- **卡在哪 / 缺什么**：无"数值跨阈值→事件"通用原子；跨越检测需上一帧值，纯无状态系统做不了，需承载阈值配置+迟滞状态的组件。
- **建议方案**：`ResourceThreshold{ resourceId, threshold, direction, armed }`，Tier2 越线发 `Trigger`/`Flag` 并 `armed=false`，回落复位（迟滞防抖）。**过度设计风险已知**，可先留游戏层。

---

### R8 · [2026-06-03] · PB · Game B · status: open · 优先级: P2（MVP 可静音）

**标题**：音频播放后端 —— 消费 `Sound` 播 BGM/SFX/语音

- **想实现的游戏行为**：BGM 循环、选择音效、关键台词语音、声道音量、淡入淡出。
- **已经试了什么**：给实体挂 `Sound{clipId,volume,loop}`。
- **卡在哪 / 缺什么**：**全项目无任何音频后端**，`Sound` 没人播。
- **建议方案**：类似渲染器的一个 audio 后端（`EnginePort.audio` 风格：`play/stop`，声道、loop、crossfade），消费 `Sound` 组件。MVP 阶段可静音延后。

---

> **更正存档相关认知（PB 自我修正）**：`world.snapshot()/restore()` 是 JSON 可序列化的 POD（验证属实），机制白送；但**存档系统**（具名槽位/缩略图/章节元数据/自动存档）是**游戏层**的活，且前提是叙事状态全部落成 ECS 组件（依赖 R4）。"白送"指机制，不指系统。
>
> **游戏层（PB 自己做，非需求，列此仅供 Lead 了解全貌）**：对话运行器/脚本解释器、选项菜单/属性面板/存读档界面/结局画廊（React-DOM）、检定逻辑、日程循环、结局判定、JSON 对话数据、sakura-otome 主题组件实现。

---

### [2026-06-03] · PA · Game A · status: open · REQ-001 相机 / 卷轴（世界→屏幕变换 + 合作跟随相机）

- **想实现的游戏行为**：
  合作冒险的关卡要**比屏幕大**（卷轴）。同屏不分屏：相机取两名玩家的中点，**动态缩放**保证两人都在视野内；
  两人离太远则相机拉远；相机框钳在关卡边界内（不露界外空白）。这是 Game A 整个体验的地基（`game-a-coop-platformer.md` 2.1 明确要求）。

- **已经试了什么**：
  - v0.1 已用 `bounds-clamp` 在固定 640×400 世界里跑通双人移动/跳跃/平台（`src/games/game-a/`）。
  - 查渲染器：`src/renderer/canvas-renderer.ts:38` 是 `ctx.translate(r.x, r.y)` —— **世界坐标 1:1 画到固定画布，无任何相机变换**，世界无法比视口大。
  - 查 `Camera` 组件（L5，`protocol/components.ts`）：字段齐全（zoom/offsetX/offsetY/viewportW/H），但**全工程零消费者**（纯数据，无相机系统、渲染器不读它）。

- **卡在哪 / 缺什么**（引擎做不到的点）：
  1. **渲染器没有世界→屏幕投影**：无法表现"世界大于视口 + 卷动"。
  2. **没有相机系统**：`Camera` 组件没人写、没人读。

- **建议方案 / 伪代码**（Lead review 后定；相机跟随放共享层还是做成可复用系统由你决定，渲染器变换肯定属共享层）：
  ```
  // ① 渲染器（共享基础设施）施加相机变换：世界投影到屏幕。读"相机实体"(Camera+Transform)或 world 单例。
  render(world):
    cam = readCamera(world)                      // center=Transform.xy, zoom, viewport
    ctx.save()
    ctx.translate(viewportW/2, viewportH/2)
    ctx.scale(cam.zoom, cam.zoom)
    ctx.translate(-cam.centerX, -cam.centerY)    // 世界向相机反方向平移 = 卷轴
    for r in renderables: drawWorld(r)           // 实体仍用世界坐标，相机统一施加变换
    ctx.restore()

  // ② 合作跟随相机系统（可复用：跟随被 tag 标记的目标集合）。
  camera-follow.execute(world):
    targets = entities tagged CameraTarget       // Game A: 两名玩家
    aabb = unionAABB(targets.transform)
    cam.centerX, cam.centerY = aabb.center
    fitZoom = min(viewportW/(aabb.w+margin), viewportH/(aabb.h+margin))
    cam.zoom = clamp(fitZoom, minZoom, 1)
    clampCameraBoxInsideLevelBounds(cam, levelBounds)   // 不露界外
  ```
  - 配套：`bounds-clamp` 已支持钳到任意边界（设 Bounds=关卡尺寸即可，纯 config，无需改引擎）。
  - 确定性：相机若只影响**渲染**就不进哈希、不破坏 lockstep；若写进世界状态需保证算子确定并纳入快照。

- **影响面 / 复用**：Game B（乙女 VN）多半也要相机（对话镜头/平移）。两个游戏共用，适合收敛成通用原子，别为 Game A 做一次性 hack。

- **不阻塞 v0.1**：v0.1（固定屏）已交付可回归；本需求阻塞的是 **v0.2 起的卷轴大关卡**。

---

## 需求模板（复制这段填写）

```
### [YYYY-MM-DD] · [提出人 PA/PB] · [游戏名] · status: open
- 想实现的游戏行为：
- 已经试了什么（哪些原子 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案 / 伪代码 / 补丁（可选）：
- 最小复现（若是 bug）：
```

---

## 已完成存档

（Lead 实现后把需求移到这里，标 done + 对应 commit / 新原子名）

### [2026-06-04] · Owner · 引擎原生 · status: done · 美术资产管理系统（Asset System）
- 想实现的行为：游戏用字符串键引用美术（贴图/立绘/表情差分/序列帧），引擎负责加载、缓存、解析；并为「后续 3D→2D 渲染」留好门。
- 缺什么：`Sprite.textureKey` 早有键间接、`Renderable` 后端无关，但**没有任何资产加载/解析层**——键指向的美术没人解析。
- 落地（B 方案：门留宽、不接 3D 工具链）：
  - 新模块 `src/assets/`：`AssetManager`（注册/加载/缓存/解析，幂等去重）+ 可插拔 `AssetLoader`（`StubAssetLoader` 无 I/O 供 headless/测试；`ImageAssetLoader` 浏览器真实图片）。
  - 描述符显式分 4 个 kind：`texture` / `atlas`（图集，对应 Game B 表情差分）/ `sprite-sheet` / **`prerendered-sequence`（3D 模型离线预渲染的 2D 序列，3D→2D 一等公民）**。四种统一归约为「源图 + 子矩形(sx,sy,sw,sh)」。
  - 句柄**不透明**：换 loader/后端（含未来 3D）不动上层。
  - `CanvasRenderer` 可选接入 `assets`：贴图就绪画真图，否则退化占位方块（sim 不受影响）。
- 确定性边界：资产层是表现层，只按 string key 工作，**绝不碰 world/snapshot/hash** → lockstep 安全。
- 验收：14 条新测试，全绿；总 286 passed，tsc 干净，build 通过。
