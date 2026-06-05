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

### R1 · [2026-06-03] · PB · Game B · status: **done**（2026-06-04，Lead，commit asset 系统）· 优先级: **P0**（阻塞一切 VN 画面）

**标题**：贴图精灵渲染 —— 渲染器要能加载并绘制 `Sprite.textureKey`（背景图 + 立绘）

- **想实现的游戏行为**：画一张背景图（办公室/咖啡厅）+ 角色立绘（带 z 分层、左右站位）。
- **已经试了什么**：给实体挂 `Sprite{textureKey, zOrder}` + `Transform`。
- **卡在哪 / 缺什么**：`CanvasRenderer.sync` 对 `r.sprite` 只画 `fillRect(-8,-8,16,16)` 占位方块，**完全无视 `textureKey`**，没有任何图片加载/缓存/绘制路径。无图 = VN 没法看。
- **建议方案**：渲染器（`src/renderer`，共享层）加 image 资产加载缓存（`HTMLImageElement`/`drawImage`），`collectRenderables` 已经把 `sprite` 透出。可配合 `Color.alpha`（渲染器已读 `globalAlpha`）做淡入。这是后端能力，非新原子。
- **✅ Lead 落地（引擎/共享层部分）**：新建 `src/assets/`（`AssetManager` + `ImageAssetLoader`，加载/缓存/解析），`CanvasRenderer` 接 `assets`：`Sprite.textureKey` 就绪即 `drawImage` 真图、否则退化占位方块；`zOrder` 走原有 `collectRenderables` 排序；淡入用 `Color.alpha`（已支持）。**背景图直接用 `texture` kind；立绘表情差分用 `atlas` kind（一图多帧）**。
  - **PB 游戏层只需**：写一份 asset manifest（key→src），`new AssetManager(new ImageAssetLoader())` → `registerManifest` → `await loadAll()` → `new CanvasRenderer({ assets })`。给实体挂 `Sprite{textureKey}` 即显图。
  - **未覆盖（仍 open）**：R2 多行文本、R3 指针输入是另两件事，本条不含。立绘**按帧切换表情**（atlas frame 选择）属 C 范围/可后续小需求——当前 `Sprite` 无 frame 字段，渲染器先按整 key 取整图/默认帧。

---

### R2 · [2026-06-03] · PB · Game B · status: **done**（2026-06-04，Lead，Batch II）· 优先级: **P0\***

> ✅ Lead 落地：渲染器侧多行/自动换行（采纳方案①）。`Text` 加可选 `maxWidth`；`renderer/text-layout.ts` 的 `wrapLines`（纯函数，可测：硬 \n + 空格断词 + 长 token/CJK 按字符断）；CanvasRenderer 按 fontSize+lineSpacing 逐行绘制。React-DOM 浮层路径仍可用，二选一。6 测试。


**标题**：对话文本多行/自动换行渲染

- **想实现的游戏行为**：对话框里一段长台词按框宽换行、多行显示、可翻页。
- **已经试了什么**：`Text{content}` 渲染。
- **卡在哪 / 缺什么**：`fillText(content,0,0)` 单行硬画，**无换行、无多行、无分页**。
- **建议方案（两条，请 Lead 拍）**：
  ① 渲染器侧支持按 maxWidth 断词换行（可能需要一个 `TextBox{content,maxWidth,lineHeight}` 渲染概念，区别于点状 `Text`）；或
  ② **架构规避**：对话框/选项/面板全部用 **React-DOM 浮层**（`GameOverlay` 已是 React DOM，CSS 原生换行），canvas 只画背景+立绘。**这样 R2 直接消失**。我倾向 ②，但需 Lead 确认这是被祝福的 UI 路径（见 R3）。

---

### R3 · [2026-06-03] · PB · Game B · status: **done**（2026-06-04，Lead，Batch II）· 优先级: **P0\***

> ✅ Lead 落地：指针/点击的确定性按 tick 注入接缝。`Command` 加 `actions?: RawInputData[]`；`net/queued-input.ts` 的 `QueuedInputSource`（UI/React onClick 调 `enqueueAction(name,{x,y})`）+ `PointerInputSource`（浏览器 pointer 事件）；`applyCommands` 把 actions 落成 `RawInput` 实体（每 tick 先清后标）。**命中测试/选项解析归游戏层**（可用 spatial-query 或 DOM）。4 测试。


**标题**：点击/指针输入接入 + 确定性 per-tick 注入约定

- **想实现的游戏行为**：玩家点选项 → 推进剧情、改好感。
- **已经试了什么**：`input-capture` schema 支持 pointer，`action-map` 定义 `Action`。
- **卡在哪 / 缺什么**：`main.tsx` **只 wire 了键盘**，pointer 事件不进 `RawInput`；`action-map` 无 system；无命中测试（点了哪个选项）。点击当前完全断路。
- **建议方案**：
  - 若走 R2-① canvas 方案：需 pointer→RawInput 接入 + 屏幕坐标→实体命中测试。
  - 若走 R2-② React-DOM 方案：UI 用原生 `onClick`，但**点击需作为确定性输入按 tick 灌进世界**（叙事状态仍住世界里，符合 `EnginePort` "输入按 tick 注入" 模型）。请 Lead 给一个"React 事件 → 当帧 input source"的约定/入口（哪怕只是一个 `engine.enqueueAction(name,value)`）。这是确定性边界，归引擎定。

---

### R4 · [2026-06-03] · PB · Game B · status: **done**（2026-06-04，Lead）· 优先级: P1

> ✅ Lead 落地：`string-variable` 扩展原子（`src/skills/atoms/string-variable/`）—— `StringVar{id,value}` + `StringSet{id,value}` 一次性写事件 + `string-apply` 系统（**全局按 id 路由**，同实体优先，仿 R11）。并加了 Condition 的 `string` 叶子（`{kind:'string',id,equals}`），可直接门控剧情节点/结局标识。不计入核心 26（`extensionAtomCapabilities`）。3 条测试。

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

### R6 · [2026-06-03] · PB · Game B · status: **done**（2026-06-04，Lead）· 优先级: P1

**标题**：`tween / interpolate`（Tier 1 候选）—— 数值随时间朝目标缓动

- **想实现的游戏行为**：立绘淡入淡出（`Color.alpha`）、场景切换淡黑、好感条平滑填充、立绘滑入（`Transform.x`）。
- **已经试了什么**：`animation`（Tier1）只做离散 `frame.index++`；`Bar.tsx` 用 CSS transition；打字机可用 `timer.elapsed` 切片。
- **卡在哪 / 缺什么**：无 ECS 内**确定性**连续插值（存档重放一致、不靠 CSS）。难点 = 字段寻址（写"哪个组件的哪个字段"）。
- **✅ Lead 落地**：`Tween{ target, from, to, elapsed, duration, easing, done }`（Tier1，`src/skills/tier1/tween.ts`）。定步长：`elapsed` 每帧 +1，`value = from+(to-from)*ease(t)` 写回同实体目标字段；到点 `done` 并锁定终值。**字段寻址按建议收口为高价值白名单**：`Transform.{x,y,rotation,scaleX,scaleY}` / `Color.alpha` / `Resource.current`（写 Resource.current 时尊重上下限）。缓动 `linear/easeIn/easeOut/easeInOut` 全多项式（不碰 sin/cos）→ 确定性、录放一致。7 条测试。

---

### R7 · [2026-06-03] · PB · Game B · status: open · 优先级: P2

**标题**：`resource-threshold`（Tier 2 候选）—— 资源跨阈值触发

- **想实现的游戏行为**：好感阈值事件（30/60/90）、失败结局（体力归零 / 全好感<20）。
- **已经试了什么**：`resource-apply` 只 clamp 不产"越线"信号；`trigger-zone` 是空间触发不适用。
- **卡在哪 / 缺什么**：无"数值跨阈值→事件"通用原子；跨越检测需上一帧值，纯无状态系统做不了，需承载阈值配置+迟滞状态的组件。
- **建议方案**：`ResourceThreshold{ resourceId, threshold, direction, armed }`，Tier2 越线发 `Trigger`/`Flag` 并 `armed=false`，回落复位（迟滞防抖）。**过度设计风险已知**，可先留游戏层。

---

### R8 · [2026-06-03] · PB · Game B · status: **done**（2026-06-04，Lead，Batch II）· 优先级: P2

> ✅ Lead 落地：`src/services/audio/`——`AudioPort` 端口 + `NullAudioPort`(headless/测试) + `WebAudioPort`(浏览器,clipId→url) + `AudioSync`(读世界 `Sound` 组件 diff → play/stop,"Sound 存在=应在响")。MVP 用 Null 即静音。2 测试。


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

### R9 · [2026-06-03] · PB · 框架级（Game B 首验） · status: open · 优先级: 架构级 · **类型: REVIEW 请求**

**标题**：资产清单 + 资产管理器设计文档 review —— `docs/design/asset-manifest-and-manager.md`

- **背景**：产品愿景"小白一句话成游戏"缺了护城河的另一条腿——**美术/音频资产**。现状：引擎零资产侧（无清单契约、无库、无生成集成、无管理器）。
- **提案**：引擎附带一个 **TBF（待填充）资产清单数据结构** + **资产管理器工具**。打开即知"还差哪些资产/名字/描述/规格"，用户在引导下**一步步填**，四条 provider（一键生成 / 从库选 / 手动上传 / 程序化占位），人在环、保留掌控；AI 只是其中一条路径。与模块 pipeline 同构（策展+选择+生成增量+占位兜底），与 `EnginePort`/确定性边界对齐（资产是表现层、不进模拟哈希）。
- **请 Lead review 的点**：见文档 §9 七个开放问题（canonical schema 落点 / Provider 是否并入 EnginePort / X7 锚定实现 / 生成后端+网络策略 / 版权过滤归属 / 占位规格 / 导出策略）。
- **同步**：用户会另请 **Gemini** 并行 review 本文档。
- **PB 不阻塞的部分**（收敛后即做）：Game B 槽位契约实例 + `procedural` 占位 provider（见文档 §8）。
- **关联**：消费端是 R1（贴图渲染）/ R8（音频后端）。

---

### R10 · [2026-06-04] · PB · Game B · status: **done**（2026-06-04，Lead）· 优先级: P1 · **类型: 接口摩擦（搭 v0.1 实测）**

**标题**：System 依赖声明无法表达"两个系统读改写同一组件"——dialogue-runner 与 state-sync 在 `State` 上冲突

- **摩擦**：`dialogue-runner` 真实地读 `State.current` 并写它（推进节点）；`state-sync` 也读改写 `State`。两者都诚实声明 `reads+writes:['State']` → 组件拓扑互为前驱 → **判成环**。
- **我当时的绕过（坦白）**：runner 声明成 `reads:[]`（**谎报**，实际内部 `getComponent` 读 State.current），只靠 `writes:['State']` 把自己排到 state-sync 前。能跑，但声明不诚实；换个场景（两个游戏系统都要 RMW 同一组件）就没干净出路，只能抢 `SystemPhase`——而整数相位已吃紧（`progress.md` 自己也提了）。
- **请主程分析**：是否引入**显式 `runsAfter/runsBefore` 排序**，或允许声明"read-modify-write 同组件"而不判环（生产者-消费者之外的第三种关系）。这是会反复撞到的通用问题。
- **✅ Lead 落地**：`SystemDeclaration` 增加可选 `runsAfter?: string[]` / `runsBefore?: string[]`（按系统 id，phase 内生效）。拓扑排序里**显式边会覆盖相反方向的组件推断边** → 两系统都诚实声明 `reads+writes:['State']` 也能用一句 `runsBefore`/`runsAfter` 确定定序、打破 RMW 伪环；不再需要谎报 reads 或抢 phase。无显式定序时 RMW 仍判环（不掩盖真冲突）；矛盾的显式边也仍判环。
  - **PB 改法**：`dialogue-runner` 恢复诚实 `reads:['State']`，加 `runsBefore:['state-sync']`（或 state-sync 加 `runsAfter:['dialogue-runner']`）。
  - 实现：`src/engine/core/topological-sort.ts` + `types.ts`；6 条新测试覆盖（含 dialogue-runner/state-sync 场景）。整数 `SystemPhase` 保留，跨 phase 仍由 phase 号定序。

---

### R11 · [2026-06-04] · PB · Game B · status: **done**（2026-06-04，Lead）· 优先级: P1 · **类型: 接口摩擦（搭 v0.1 实测）**

**标题**：Resource 修改是实体局部的，没有"按 id 全局修改某资源"的路由

- **摩擦**：`ResourceModify` 必须挂在**与目标 `Resource` 同一实体**上（`resource-apply` 要求同实体且 `id` 匹配）。游戏层想"给好感_S +5"时，得先知道好感_S 这个 Resource 住在哪个实体。
- **我当时的绕过（坦白）**：强行约定 **`entityId === resourceId`**，runner 把 `ResourceModify` `addComponent` 到与资源 id 同名的实体。多资源/多角色好感时这约定脆弱、且把"路由"责任泄漏到游戏层。
- **✅ Lead 落地**：`resource-apply` 改为超集——先看同实体匹配 id（**按实体定位，多角色同名资源各改各的，向后兼容**），否则**全局按 id 路由**到持有该资源的实体（与 Condition 的"按 id 全局读"读侧对称）。`ResourceModify{ resourceId:"affection_S", amount:5 }` 挂在任意实体（如对话事件实体）即可，不必知道资源住哪。撤掉 `entityId===resourceId` 脆弱约定。2 条新测试（全局路由 + 同实体优先）。
  - 这同时是 **Condition→Event→Effect** 链里 **Effect 侧的第一块**（按 id 改数值）。

---

### R12 · [2026-06-04] · PB · Game B · status: open · 优先级: P2 · **类型: DX 摩擦（搭 v0.1 实测）**

**标题**：Blueprint 实体的组件数据不按组件 schema 做类型检查

- **摩擦**：`EntityBlueprint = { [type: string]: Omit<Component,'type'> }` 是 string 索引——蓝图里把 `Resource` 的字段拼错、或组件名打错，`tsc` **不报错**。
- **我当时的绕过（坦白）**：肉眼对照 `protocol/components.ts` 的 interface 填字段，纯靠人。
- **请主程分析**：能否让蓝图按 component type 关联到对应 interface 做类型校验（防错/DX）。AI 编排自动生成蓝图时，这层静态校验尤其值钱（呼应框架的"静态校验器"护城河）。

---

### R13 · [2026-06-04] · PB · Game B · status: open · 优先级: P3 · **类型: DX 摩擦（小）**

**标题**：没有"取命名单例/某 fsm 实体"的便捷查询；UI 点击仍走直接改世界（= 已存在的 R3）

- **摩擦 1**：定位对话状态机实体要 `query('State')` 全扫 + 过滤 `fsmId==='dialogue'`，没有"按组件字段取实体/取单例"的助手。绕过：循环过滤（可接受，低优先）。
- **摩擦 2（重申 R3）**：`VNStage.tsx` 的点击用 `engine.world.addComponent(...)` **直接改世界**（非确定性 per-tick 输入）。这是 **R3** 那条，我在 demo 里**明确是临时 hack**，正式需 R3 的"React 事件→当帧 input source"约定。此处仅标注，不重复开需求。

---

### R14 · [2026-06-04] · PB · Game B · status: open · 优先级: P3 · **类型: 接口摩擦（推 v0.2 实测）**

**标题**：一实体一组件 → 一个 tick 内施加多个 `ResourceModify` 不便

- **摩擦**：一个选项可能同时改多项数值（好感 +5 且 事业 +2）。但「一实体一组件」约束下，一个实体一个 tick 只能挂一个 `ResourceModify`，没法在一个实体上一次性发多个。
- **我当时的绕过（坦白，已是干净版）**：把每个效果的 `ResourceModify` 挂到**它目标资源各自的实体**上（按 id 扫描定位）——各效果指向不同资源=不同实体，天然不冲突、无孤儿实体。能用，但要 game 层自己扫实体。
- **请主程分析**（低优先）：是否值得一个"批量改资源"入口，比如 `ResourceModifyBatch{ mods: [{id,amount}] }`，或允许事件型组件在同实体多实例。VN 选项常一次改多项；阈值/检定结算也会。
- **关联 DX**：和 R13 摩擦 1 同源——game 层反复在写"按 id 找实体"（resource/flag）。一个引擎侧 `world.findByComponentId(type, idField, id)` 助手（或暴露已有的 `buildConditionLookup`）能让两个游戏都少写扫描。

---

### R15 · [2026-06-04] · PB · 框架级 · status: open · 优先级: **高（架构对齐）** · **类型: 通用模块请求**

**标题**：把"对话/叙事运行器"提升为通用共享模块 —— 让 Game B 归零游戏专属代码（数据驱动原则）

- **背景（与用户+Lead 对齐的原则）**：游戏 = **数据**（manifest + 内容），不是代码。游戏专属 `.ts` 应趋近于零；非写不可的代码必须是**通用、可复用的库模块**，由 manifest 选中+喂数据，不是某个游戏的私货。

- **现状违规**：`src/games/game-b/dialogue-runner.ts` 是**游戏层代码**（脚本解释器 capability）。但它**本质通用**（任何 VN/RPG 都要"跑一棵对话脚本"）。

- **为什么这段代码非有不可（说明）**：现有通用系统表达不了**数据依赖的状态转移**与**表驱动文本**——
  - `effect-apply` 只能 `set-state` 到**固定值**，做不到"跳到当前节点的 `next`"（next 是逐节点数据）。
  - 无系统能"按 `State.current` 查脚本表 → 写 `Text.content`"。
  → 必须有一个**脚本解释器**读对话数据驱动 state/text/effect。

- **请求**：把它收编为**通用"叙事/对话运行器"共享模块**（Lead 拥有，放 `src/skills/` 或服务层），契约 = 一份**声明式对话脚本数据结构**（节点图：line/choice + effects + `requires` 条件树 + next）。我已有可跑实现 + 8 测试（`src/games/game-b/dialogue-runner.ts`），**可直接当建议补丁**，Lead review 后泛化落库。
  - 落库后：删 game-b 的 `dialogue-runner.ts`，Game B = **纯数据**（对话脚本 JSON + blueprint manifest + 资产清单 + 主题）。
  - 同理 `ui/VNStage.tsx` 宜泛化为**通用可主题化 VN 演出组件**（sakura 主题=数据），不留作 game 代码（可后续单提）。

- **对齐价值**：叙事运行器是模块库该有的一块（VN/RPG/Galgame 通用），写一次复利。正是护城河。

### [2026-06-03] · PA · Game A · status: **done**（2026-06-04，Lead，Batch I）· REQ-001 相机 / 卷轴（世界→屏幕变换 + 合作跟随相机）

> ✅ Lead 落地：`tier2/camera-follow`（CameraTarget 目标 AABB 中点 → Camera.offset，贴合 zoom，相机实体挂 Bounds 则钳关卡内）+ CanvasRenderer 世界→屏幕投影（读 Camera 施加 translate+scale，无相机则 1:1）。PA 用法：给两角色挂 `CameraTarget`，建一个挂 `Camera{viewportW/H}`(+可选 `Bounds`=关卡矩形) 的相机实体即可。6 测试。


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

### [2026-06-04] · PA · Game A · status: open · REQ-002 sensor / 非实心触发体（trigger-zone 与 collision-resolve 抢同一份 Overlap）

- **想实现的游戏行为**：合作机关第一类——A 踩开关/压力板 → 发触发事件（开门、激活）。这是《双人成行》入门核心（踩开关 / 限时门 / 重量台）。
- **已经试了什么**：按 `trigger-zone` 文档，开关 = `Tag(ZONE_FLAG)` + `Shape` + `Transform`；玩家重叠 → `overlap-detect` 出 `Overlap` → `trigger-zone` 发 `Trigger{zone,other}`。
- **卡在哪 / 缺什么**：`collision-resolve`（`src/skills/tier2/collision-resolve.ts`）读**所有** `Overlap` 对当实体碰撞解算（只看 Transform/Shape/Velocity/Mass，`invA+invB>0` 即推开），**完全不排除 trigger zone**。后果：开关同时是一堵实心墙——玩家走进去被弹开（站不进区域）；站顶上则被解算到"恰好不重叠"→ 不产 `Overlap` → `trigger-zone` 不触发。`trigger-zone`（要重叠）与 `collision-resolve`（消重叠）抢同一份 `Overlap`，**语义互斥，缺 sensor（非实心碰撞体）概念**。
- **建议方案**：`collision-resolve` 跳过"任一方是 trigger zone（`Tag.flags & ZONE_FLAG`）"的接触对——只让 `overlap-detect`/`trigger-zone` 消费、不做物理解算。最小改动、复用现有 `ZONE_FLAG` 约定；或更通用引入 `Sensor` 标记 / `Collider{ solid:boolean }`。确定性不受影响（只是少解算一对）。
- **阻塞**：踩开关 / 限时门 / 重量台（第一批合作机制**全部**）。我**未 hack 绕过**——雏形里开关相关机制暂缺，等本需求落地。

---

### [2026-06-04] · PA · Game A · status: open · REQ-003 ground-sense 支持"站在动态支撑上"（踩搭档/踩箱无法起跳）

- **想实现的游戏行为**：能力差异核心——B 举 A / A 踩在 B 头上 / A 踩 B 推来的箱子 → 再跳上更高平台。
- **已经试了什么**：让 A 落在 B（动态）或 box（动态 + Mass）上。叠放本身稳（Lead 已让 `collision-resolve` 把"Grounded 的动态体当静态支撑"，堆叠不挤穿）。
- **卡在哪 / 缺什么**：`ground-sense`（`src/skills/tier2/ground-sense.ts`）只在"对方**无 Velocity**（静态）"时标 `Grounded`（`aDyn && !bDyn` / `bDyn && !aDyn`）。站在**动态**搭档/箱子上时双方都 dynamic → **不标 Grounded** → `jump` 系统（要 `Grounded`）不触发 → **跳不起来**。collision 已认它是支撑、ground-sense 却不认 —— 两者对"什么算落地"的判定不一致。
- **建议方案**：`ground-sense` 在"脚下动态体本帧也 `Grounded`（或属静态支撑链）"时，也给上方实体标 `Grounded`——与 `collision-resolve` 已有的"Grounded 动态当静态支撑"对齐。按确定序求值支撑链以保 lockstep。
- **阻塞**：踩搭档垫高 / 推箱垫脚（能力差异批）。同样**未 hack**——雏形不含这类机制，等落地。

---

> **PC 缺口分析综述（2026-06-05，Game C《缝纫物语》女孩换装三消）**
> 引擎今天=确定性 ECS（26 原子 + Tier1-2 + Condition→Event→Effect + tween + 贴图/音频后端 + 按 tick 指针注入）。
> Game C 要的「网格消除 + 资源养成 + AIGP 视频输出」三条维度，A/B 都没压过。
> 已对照真实代码确认：**能用现成能力表达的部分我已全部装配成纯数据**（`src/games/game-c/`：材料经济=resource、缝纫店升级链=event-when+effect-apply、外观=state/text、爱诗提示词=数据表；`game-c.test.ts` 5 测试证明升级链确定性点亮，零游戏系统代码）。下列是**真正表达不了、需引擎下沉**的缺口，我**未在游戏层 hack**，按角色规矩提需求。

---

### REQ-C-001 · [2026-06-05] · PC · Game C · status: open · 优先级: **P0**（阻塞可玩棋盘）

**标题**：三消棋盘机制 —— 网格消除（交换 / 找连 / 消除产出 / 重力 / 补块 / 连锁）通用 capability

- **想实现的游戏行为**：6 种材料棋子的网格三消。点选相邻两棋交换；形成 ≥3 同色连线则消除，并产出对应材料；空位上方棋子下落、顶部按确定性随机补新；连锁(cascade)继续结算。
- **已经试了什么**：用现成原子把**能表达的全做成数据**了——材料经济(`resource`)、缝纫店解锁链(`event-when`+`effect-apply`)、外观(`state`/`text`)，并测试通过(`src/games/game-c/`)。棋盘**表现**(格子摆位/底色/字形)也能用 `transform`+`shape`+`color`+`text` 纯数据摆出来。
- **卡在哪 / 缺什么**：现有数据底座(原子 + Condition→Event→Effect + tween)**无法表达带「网格邻接扫描 / 循环」的算法**：`Condition` 只求值布尔树，`effect-apply` 只能 set-flag/modify-resource/set-state 到**固定目标**，二者都没有「遍历整盘找 ≥3 连线 / 按列下沉 / 补块」的能力。这不是换种组合能补的，是**缺一格通用机制**——周期表「涌现验证」表里确实没有 Match-3 这格。
- **建议方案（建议补丁；实现 + 确定性 review 归 Lead）**：下沉为通用 Tier3 capability `match3-board`，**config 驱动**(任意行列 / 种类数 / 产出映射)、**确定性**(用 `RandomSeed` 整数 PRNG 补块，仅 `+−×÷`，不碰浮点超越函数 → lockstep / 录放安全)。最简契约草案：

  ```
  Component MatchBoard {              // 棋盘单例（config + 相位状态机）
    cols, rows, kindCount: number
    cells: number[]                  // 长 cols*rows，值=种类 0..kindCount-1，-1=空
    kindResource: string[]           // 种类→产出 Resource id（消该种 → ResourceModify 该 id）
    coinResource: string; coinPerTile: number
    phase: string                    // 'idle'|'swapped'|'match'|'clear'|'fall'|'refill'
    selIndex, swapA, swapB: number   // 选中格 / 本次交换两格（无连线则回退）
    stepTimer, stepDelay: number     // 相位推进节拍（让连锁可见）
  }
  Systems（确定性、相位定序）：
    match-resolve：swapped→match(扫全盘找≥3横/竖) → clear(标记格各按 kindResource
      发 ResourceModify +coin、置 -1) → fall(每列下沉补空) → refill(顶部空位 nextRandom 补)
      → match(连锁)；稳定无连线→idle。交换后首扫无连线 → 回退 swapA/swapB → idle。
    match-view-sync：由 cells 写各「视图格子」实体的 Color.tint/Text.content（Commit 相位）。
  ```
  - 产出走现成 `ResourceModify`(写到预建「每材料一个」承载实体，零实体 churn) → `resource-apply` 结算 → **game-c 已装配好的升级 / 换装 / 展示链自动点亮，游戏数据不动一行**。
  - 「视图格子」实体由游戏蓝图静态建好(纯数据)，capability 只改其外观，不创建 / 销毁实体。
- **影响面 / 复用**：任何三消 / 连连看 / 网格解谜复用 —— 周期表该补的「Match-3」机制格，写一次复利。
- **不阻塞**：v0.1 养成 / 展示数据层已独立可回归；本需求阻塞 v0.2 起的可玩棋盘。

---

### REQ-C-002 · [2026-06-05] · PC · Game C · status: open · 优先级: P1

**标题**：通用「可点击实体」—— 指针命中 tag 实体 → 配置化语义动作 / 信号

- **想实现的游戏行为**：点棋盘某格(选中 / 交换)；点缝纫店按钮(缝制)。
- **已经试了什么**：R3 已落地输入接缝(`PointerInputSource` → 单例 `InputQueue`，屏幕坐标按 tick 确定性注入)；`renderable.ts` 已有 `screenToWorld` 逆投影。
- **卡在哪 / 缺什么**：R3 明确「命中测试 / 语义解析归游戏层」，且 `action-map` 无 system。没有通用「屏幕点 → 命中世界实体 → 发一个配置好的 `Signal`/`Action`」能力。每个游戏自己写命中 = 游戏层逻辑代码(违反第一性原则)。
- **建议方案**：通用 `clickable` capability —— 实体挂 `Clickable{ action }` + `Transform` + `Shape`；系统读 `InputQueue` 的 down 坐标 → `screenToWorld`(已有) → AABB / spatial-query(W2) 命中 → 在命中实体上产出 `Action{name}`/`Signal`。确定性(只读 InputQueue + 几何比较)。
- **复用**：点击器 / 网格 / 按钮 / 拖拽起点通用；也是 REQ-C-001 交换输入的来源。

---

### REQ-C-003 · [2026-06-05] · PC · Game C · status: open · 优先级: P2

**标题**：通用「配方 / 消费」经济 —— 信号触发时材料足够则扣料并解锁（主动缝制）

- **想实现的游戏行为**：玩家点「缝制初心围裙」→ 若材料够，扣掉材料、解锁该衣服(主动养成，区别于 v0.1 的被动阈值解锁)。
- **已经试了什么**：被动里程碑解锁已用 `event-when` 阈值做到。但「**主动花费**(扣料换衣)」表达不了。
- **卡在哪 / 缺什么**：`effect-apply` 的 `modify-resource` 是无条件加减，**不校验「是否付得起」**，也不能**原子地「同时扣多项 + 置 flag」**；事件型组件一实体一份(R14)，一次扣多料不便。缺「可负担则成交、否则整单不动」的通用经济能力。
- **建议方案**：通用 `craft-recipe` capability —— `CraftRecipe{ onSignal, costs:[{id,amount}], grantsFlag, grantsState? }`；系统在 `onSignal` 在场且**所有 costs 可负担**时，一次性扣全部料 + 置 flag(/set-state)，否则整单不动(原子性)。确定性(只读写确定数值)。
- **复用**：商店 / 合成 / 建造 / 科技树通用。可与 R14「批量改资源」合并考虑。

---

### REQ-C-004 · [2026-06-05] · PC · 框架级（Game C 拉动） · status: open · 优先级: 架构级 · **类型: 表现后端**

**标题**：爱诗(AIGP)视频生成后端 —— 消费「外观 → 提示词」产出短视频展示（周期表「扩展 C」X4–X7 首次落地拉动）

- **想实现的游戏行为**：把女孩当前换装(lookId) → 一段提示词 → 爱诗生成竖屏短视频做展示 / 分享。这是 Game C 的「输出点」。
- **已经试了什么**：已把「外观 → 视频提示词」做成**纯数据表**(`theme.ts` `LOOK_PROMPTS` / `composeAishePrompt`)，即周期表 **X4 ShadowDictionary** 的数据形态。
- **卡在哪 / 缺什么**：全项目**无任何视频 / AIGP 后端**(类比 R1 之前无贴图、R8 之前无音频)。提示词只是字符串，没人拿去生成。这是**表现层旁路、不进确定性 sim**。
- **建议方案**：类比 R1(资产) / R8(音频)，加一个 AIGP 端口(`EnginePort` 风格)：`AishePort.generate(prompt, opts) → videoHandle`，`NullAishePort`(headless / 测试静默) + 真后端(调外部视频生成 API)。周期表「扩展 C」X4–X7(`ShadowDictionary` / `SemanticMaterial` / `ConditioningMask` / `LatentAnchor`)是其数据契约。**确定性边界**：旁路异步、绝不碰 world / snapshot / hash(与资产 / 音频同纪律)。
- **类型**：框架级(类比 R9 资产文档)，可先出设计文档，再落 Null 端口 + 真后端。

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
