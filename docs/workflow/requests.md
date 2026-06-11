# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

> ✅ **本程 Lead 批量结案（2026-06-05）** —— 三游戏共需 + 三人开工阻塞一次性下沉为通用能力（全绿 446 passed / tsc / build）：
> - **共需**：`clickable`(命中→Signal·三家) · `craft-recipe`(经济/批量改值=R14+REQ-C-003) · `zone-occupancy`(REQ-006) · `dialogue`(R15) · `match3-board`(REQ-C-001) · AIGP 端口(REQ-C-004) · Tween loop(REQ-004) · 渲染器 Sprite 穿皮(REQ-005)。
> - **已迁纯数据**：Game A 删 `coop-goal.ts`（通关=Zone 数据）；Game B 删 `dialogue-runner.ts`（剧情=DialogueScript 数据）。
> - **各自开工清单见 `docs/workflow/finish/{PA,PB,PC}-finish-list.md`**。仍 open：R9（资产文档 review）、R12（蓝图 schema 静态校验）。
> - 注：PA 口头提的"REQ-007/008"在池中无此编号，按 PA 实际仅剩两条 open（REQ-004/005）解读并已落地。

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

### R5 · [2026-06-03] · PB · Game B · status: **done**（2026-06-05，Lead：多目标/计数由 zone-occupancy 覆盖；多条件 and/or 已在 ConditionExpr）· 优先级: P1

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

### R7 · [2026-06-03] · PB · Game B · status: **done**（2026-06-05，Lead：跨阈值由 Condition + event-when edge 覆盖，迟滞=armed）· 优先级: P2

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

### R9 · [2026-06-03] · PB · 框架级（Game B 首验） · status: **in-progress**（2026-06-07，Lead+Gemini 已评审收敛）· 优先级: 架构级 · **类型: REVIEW 请求 → 落地计划**

> 📦 **review 包**：`review-for-gemini-assets.txt`（设计文档）+ `review-for-gemini-asset-addressing.txt`（v6 寻址规范 + Lead 反馈）+ `review-for-gemini-asset-CODE.txt`（1546 行真实实现）。
>
> ✅ **Gemini + Lead 评审收敛（2026-06-07）—— 资产寻址规范裁决**：
> - **现有实现 ~90% 已覆盖，坚决不重做**（双方一致，无漏判）：`AssetManager.resolve` 已归一化 sx/sy/sw/sh、`CanvasRenderer.drawImage` 与规范逐字节同款、`Frame+Timer+animation` 已是确定性 tick 动画、`AssetIndex` 已是清单基建、Sound 已匹配。
> - **回驳**：`SpriteAnimation` 单体组件（与 Frame+Timer+animation 等价、后者更正交）、`Sprite.spriteId` 改名（无功能差、徒增迁移）。
> - **落地计划（融入 R9，不另立案号）—— ✅ 三增量全部落地（2026-06-07，全量 568 绿）**：
>   1. ✅ **资产 key 硬校验（护城河）**：新增 `FieldType 'assetKey'`，sprite.textureKey/sound.clipId 声明为它；`validateAssetRefs` 对清单校验，接进 `parseManifest(raw, {assetKeys})`——**opt-in**：提供清单 key 集即对未知 key 拒绝加载（防 AI 编造，同 R12 家族）。编译期 `.d.ts`（次优先）暂缓——游戏在向纯数据迁，运行期校验才是数据路径的真护城河。
>   2. ✅ **命名动画 clip 层（资产层）**：`AnimationDescriptor{key,atlas,frames[]}`（独立注册表，不污染 descriptor 联合体）；`resolve(animKey, index)` → 有序帧名 → 委托底层 atlas 取矩形。ECS 不变；顺带把 `Renderable`/渲染器接上 `Frame.index`（此前序列帧根本没逐帧渲染）。无双轨。
>   3. ✅ **Node 资产打包工具（AOT 离线）**：`src/assets/pack-atlas.ts` 纯转换（FTP JSON→AssetIndex atlas 条目，有单测）+ `registerAssetIndex` 见 spec.frames 即注册成 atlas + `scripts/pack-atlas.mjs` 无依赖 fs 胶水。**唯一输出 AssetIndex**，不造第二个 manifest。
> - ✅ **代码级 review 修复（Gemini 拿 1546 行真码逐行审，2026-06-07）**：修掉 **AudioSync 切歌 bug**（clipId 原位改不响应——存 clipId 快照而非组件引用）、**CanvasRenderer textCache 无界泄漏**（帧末按本帧渲染集反向清理）、**AssetManager inflight 失败不清理**（catch 清 inflight 留重试活路）、**AssetIndex baseUrl 缺斜杠**（防御补 `/`）；collectRenderables 装箱经裁定为 IPC/Worker/AI 解耦的合理 trade-off，保留不动。+4 回归测试，全量 557 绿。
> - ✅ **AI 资产闭环收尾（2026-06-07，全量 621 绿）—— 甲+乙**：
>   - **甲·从蓝图自动派生资产清单**：`deriveAssetIndex/collectAssetRefs`（src/assembly）扫蓝图所有 `assetKey` 字段值 = 这局引用的全部资产 key → tbf 购物单。**与逻辑同源 → textureKey 与资产 id 天生对齐**，根除"逻辑/资产 key 漂移"。字段 schema 加 `assetType` 按类归类。+4 测试。
>   - **乙·接进 generate→热载**：launcher 生成结果区显示"引擎自动提取本局所需资产 N 项"（缺图自动占位）。+ 生成请求已带 `buildCapabilityCatalog(ALL_CAPABILITIES)` → apollo.py 注入 prompt（引擎自描述，新能力零 prompt 维护、不漂移）。
>   - 闭环：**一句话 → AI 产蓝图 → 引擎自动列出所需资产(key 与逻辑一致) → 热载即玩(缺图占位)** —— "AI 算力平替"在资产侧的铁证。
> - **PB 不阻塞部分仍可做**：Game B 槽位契约实例 + procedural 占位 provider（文档 §8）。

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

### R12 · [2026-06-04] · PB · Game B · status: **done**（2026-06-06，Lead）· 优先级: P2 · **类型: DX 摩擦（搭 v0.1 实测）**

> ✅ **Lead 决议 + 落地（2026-06-06）**：**接受，且升级为护城河**。`parseManifest`（manifest 桥接）已让"AI/预设产的 manifest 直接加载"，这层静态校验正是"最弱 LLM 也能产对数据"的强制点。
> **落地**：`src/assembly/validate-manifest.ts` `validateComponentData()` —— **复用各 capability 已声明的 `components.provides[Type].fields` 当 schema，绝不另造**：
> - **error（拒绝加载）**：声明 number/boolean 的字段给了别的基元类型（会坏模拟）。
> - **warning（不阻断）**：数据字段不在组件声明字段中（疑似拼错，如 `currrent`）；降级因 schema 完整性不保证，且告警反向暴露"未声明完整字段"的组件。
> - **只严格查 number/boolean**：本引擎 string 被复杂字段当占位用（dialogue.nodes 实为对象图、shape.kind 是枚举），严格查会误报，故跳过。
> 已接入 `parseManifestDetailed`：类型错抛、未知字段进 warnings。**三游戏真实蓝图零类型 error**；+7 测试，全量 536 绿。
> 注：当前护住 parseManifest（AI/studio 加载路径）；待 TODO「游戏加载器并入 parseManifest」后，三家手写蓝图也一并纳入校验。

**标题**：Blueprint 实体的组件数据不按组件 schema 做类型检查

- **摩擦**：`EntityBlueprint = { [type: string]: Omit<Component,'type'> }` 是 string 索引——蓝图里把 `Resource` 的字段拼错、或组件名打错，`tsc` **不报错**。
- **我当时的绕过（坦白）**：肉眼对照 `protocol/components.ts` 的 interface 填字段，纯靠人。
- **请主程分析**：能否让蓝图按 component type 关联到对应 interface 做类型校验（防错/DX）。AI 编排自动生成蓝图时，这层静态校验尤其值钱（呼应框架的"静态校验器"护城河）。

---

### R13 · [2026-06-04] · PB · Game B · status: **done**（2026-06-05，Lead：findByComponentId 助手 + clickable 命中→Signal 均已落）· 优先级: P3 · **类型: DX 摩擦（小）**

**标题**：没有"取命名单例/某 fsm 实体"的便捷查询；UI 点击仍走直接改世界（= 已存在的 R3）

- **摩擦 1**：定位对话状态机实体要 `query('State')` 全扫 + 过滤 `fsmId==='dialogue'`，没有"按组件字段取实体/取单例"的助手。绕过：循环过滤（可接受，低优先）。
- **摩擦 2（重申 R3）**：`VNStage.tsx` 的点击用 `engine.world.addComponent(...)` **直接改世界**（非确定性 per-tick 输入）。这是 **R3** 那条，我在 demo 里**明确是临时 hack**，正式需 R3 的"React 事件→当帧 input source"约定。此处仅标注，不重复开需求。

---

### R14 · [2026-06-04] · PB · Game B · status: **done**（2026-06-05，Lead：批量/原子/可负担改资源归入 craft-recipe）· 优先级: P3 · **类型: 接口摩擦（推 v0.2 实测）**

> ✅ Lead 落地(DX 助手部分，同时解 R13 摩擦1 + PC REQ-C-002 的"按 id 找实体")：`src/engine/core/query.ts` 的 `findByComponentId(world,type,idField,id)` / `getComponentById` —— 游戏层不再手写"扫实体找 id"。⏳ **待做**：批量/原子改资源(`ResourceModifyBatch` 或"可负担才成交")——与 PC REQ-C-003 同源，归一个"经济/批量改值"capability 一起做。

**标题**：一实体一组件 → 一个 tick 内施加多个 `ResourceModify` 不便

- **摩擦**：一个选项可能同时改多项数值（好感 +5 且 事业 +2）。但「一实体一组件」约束下，一个实体一个 tick 只能挂一个 `ResourceModify`，没法在一个实体上一次性发多个。
- **我当时的绕过（坦白，已是干净版）**：把每个效果的 `ResourceModify` 挂到**它目标资源各自的实体**上（按 id 扫描定位）——各效果指向不同资源=不同实体，天然不冲突、无孤儿实体。能用，但要 game 层自己扫实体。
- **请主程分析**（低优先）：是否值得一个"批量改资源"入口，比如 `ResourceModifyBatch{ mods: [{id,amount}] }`，或允许事件型组件在同实体多实例。VN 选项常一次改多项；阈值/检定结算也会。
- **关联 DX**：和 R13 摩擦 1 同源——game 层反复在写"按 id 找实体"（resource/flag）。一个引擎侧 `world.findByComponentId(type, idField, id)` 助手（或暴露已有的 `buildConditionLookup`）能让两个游戏都少写扫描。

---

### R15 · [2026-06-04] · PB · 框架级 · status: **done**（2026-06-05，Lead：下沉为通用 @skills/tier3 dialogue，Game B 纯数据、删 dialogue-runner.ts）· 优先级: **高（架构对齐）** · **类型: 通用模块请求**

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

---

### R16 · [2026-06-05] · PB · 框架级 · status: **done**（2026-06-06，Lead，全量泛化）· 优先级: 中（架构对齐，非阻塞）· **类型: 通用模块请求（R15 的演出层后续）**

> ✅ **Lead 决议 + 落地（2026-06-06）**：**接受，全量泛化**。Lead 初判"单一 VN 消费者有过度设计风险、建议先做不投机的一刀"，用户（决策者）澄清 **@ui widget 将跨 A/B/C 复用**（非单一消费者）→ rule-of-three 顾虑解除，按 R16 字面全量做。
> **落地内容**：
> - **通用 @ui/vn 组件库**（游戏无关、主题+数据驱动）：`VNStage`（编排）+ `StatPanel`/`PortraitSlot`/`DialogBox`/`ChoiceList`（布局中立 widget，A/B/C 可复用）；`types.ts` 定 `VNBinding`/`VNStageProps`。
> - **主题数据**：`@ui/themes/sakura-otome/theme.ts` 实例化此前**休眠未用**的 `ThemeTokens`/`GameTheme` 类型（色板/排版/形状取自同目录 spec.md）。配色/字体/形状从代码外提为数据。
> - **binding 从 manifest 派生**：manifest 加 `ui` 段（dialogueEntity/stats[{id,label}]/flags/portrait）；`blueprint.ts` `buildGameBBinding()` 读它。STAT_LABEL/实体名/立绘从硬编码搬进数据。
> - **R3 确定性输入接缝**：dialogue 能力加读 `InputQueue` 路径——UI 经 `enqueueAction("dialogue.advance"/"dialogue.choose",{x:index})` 在 tick 边界注入（与显式 DialogueAdvance/DialogueChoose 组件等价）；`game-b.tsx` 接 `QueuedInputSource`，**选项点击不再直接 world.addComponent 改世界**（消除原 mid-frame hack）。
> - **删 `src/games/game-b/ui/VNStage.tsx`**：Game B 演出 = 通用组件 + sakura 主题数据 + manifest 绑定数据，**游戏层零 VNStage 代码**（仅剩 blueprint.ts 加载器桩，待框架 module-loader 取代）。
> **tsc 干净 / build 通过 / dialogue +4 测试（InputQueue 接缝）共 19 绿；rebase 上游后全量 527 绿**。

**标题**：把 `VNStage` 泛化为**通用可主题化 VN 演出组件** —— 清掉 Game B 最后一块游戏层代码

- **背景**：R15 已把对话**逻辑**下沉为通用 `@skills/tier3/dialogue`，Game B 内容已纯数据。现在 Game B 仅剩两块 `.ts`：① `blueprint.ts`（通用 manifest→world 加载器桩，应由框架 module-loader 取代）② **`ui/VNStage.tsx`（VN 演出层，本请求对象）**。按数据驱动宣言，演出层也该是**通用、可主题化、数据驱动**的共享组件，而非每个 VN 游戏各写一份 React。

- **VNStage 现在做了什么（本质通用）**：读世界投影成 VN 画面——背景层 + 立绘槽（带表情）+ 属性面板（ui-binding 读 Resource）+ 对话框（打字机、CSS 换行）+ 选项（按 `optionAvailable` 过滤条件门控）。任何 VN/Galgame 都要这套。

- **现在哪些是游戏专属（应外提为数据/config）**：
  - 硬编码实体名（`'dialogue'` 状态机、`'S_warmed_flag'` 指示灯）；
  - 属性标签表 `STAT_LABEL`（魅力/智慧/…，中文）；
  - sakura 配色与布局常量；
  - 占位立绘/背景（真资产走资产流程 R9）。

- **请求（交 Lead 评估）**：在共享 UI 层（`@ui`）提供一个**通用 `VNStage` 组件**，由**数据/config 驱动**：
  - `theme`（配色/字体/布局 token = 数据，sakura 只是一份主题数据）；
  - 绑定描述（哪个对话实体/State、要显示哪些 Resource + 标签、立绘槽位与表情来源）——理想从 manifest 派生；
  - 选项点击**走 R3 的确定性输入接缝**（`QueuedInputSource.enqueueAction`），而非现在 demo 里直接 `world.addComponent` 改世界（那是我标注过的临时 hack）。
  - 落库后：Game B 的 `ui/VNStage.tsx` 删除，演出 = 选通用组件 + 一份主题/绑定数据。

- **边界/优先级**：**不阻塞**——当前 VNStage 能跑、Game B v0.3 已可玩。这是"清掉最后一块游戏层代码、把 VN 演出沉淀成模块库资产"的架构收尾。是否值得现在做、以及通用组件的确切契约，**请 Lead 评估**（可能与 sakura-otome 主题、资产流程 R9 一起规划）。

- **对齐价值**：VN 演出组件是 Skin/UI 模块库该有的一块（与 R15 对话运行器对称：逻辑 + 演出两条腿都通用化）。VN/Galgame/RPG 复用，写一次复利。

---

### R17 · [2026-06-05] · PB · 框架级（Game B v0.4 拉动） · status: **done**（2026-06-06，Lead）· 优先级: 高（v0.4 阻塞）· **类型: 通用模块请求**

> ✅ **Lead 决议 + 落地（2026-06-06）**：**接受**。用宪法尺子核验过现有代码——`choice.requires` 的 `ConditionExpr` 叶子无 random、`random` 原子 `systems:[]`（只有辅助函数无掷骰系统）、`event-when/effect-apply` 都掷不了骰 → 确认是**现有数据真表达不了的缺口**，非重组可解。
> **形态：并入通用 `@skills/tier3/dialogue` 当第三种节点 `check`，不另起 `skill-check`**——dialogue 本就是「图遍历解释器」，check 与 line/choice 同形（读节点→改 `State.current`+effects），`successNext/failNext` 即同图节点 id；另起独立能力会复制一份 State 游标分支机制=两个解释器，违反 manifesto §4（先重组/扩展）。
> **确定性**：掷骰用世界现成 `RandomSeed`（mulberry32），进 `world.snapshot()` 重放结果一致（验收点）；系统诚实声明 reads/writes 含 `RandomSeed`。无 RandomSeed 时退化为 roll=0 纯阈值（仍确定）。
> **落库**：`dialogue.ts` 加 `DialogueCheck` 节点 + `resolveCheck` 纯逻辑；`score = resource(attribute) + floor(resource(bonusFrom)/bonusDiv) + roll(1..dice)`，`≥difficulty`→successNext+successEffects 否则 failNext+failEffects（失败非 Game Over，走另一条故事）。版本 1.0.0→1.1.0，+9 测试（含 dice:1 钉死公式 / 同 seed 重放一致 / 无 seed 退化）。**505 passed / tsc / build 全绿。**
> **PB 游戏层**：Game B v0.4 的检定节点 = 在 DialogueScript 里加 check 节点 + 一个 RandomSeed 实体，**零游戏代码**。

**标题**：对话模块加 `check` 节点（确定性骰子检定）—— 概率成功/失败分支

- **想实现的游戏行为（v0.4 检定系统）**：关键节点掷骰：`检定分数 = 基础属性 + 好感修正 + 随机(1..N)`，`≥ 难度` → 成功路线（好感+、解锁），否则失败路线（**失败不是 Game Over，走另一条故事**）。对照 `game-b-otome-vn.md` §2.4 + §五的 `check{attribute,difficulty}/successNext/failNext`。

- **已经试了什么（确认是真缺口，非我没找）**：
  - **确定性属性门控**已能做（v0.2/v0.3 用 `requires` ConditionExpr）——但那是"达标即过"，无随机方差。
  - `random` 原子只有 `RandomSeed` 数据 + `nextRandom/randomInt` **辅助函数**，`systems: []`——**没有数据驱动的"掷骰"系统**。
  - `ConditionExpr` 叶子无 `random`；`event-when`/`effect-apply` 不能掷骰。
  - 通用 `dialogue` 模块只有 `line`/`choice`，**无 check 节点**（无 successNext/failNext/概率分支）。
  - 结论：骰子检定**无法用现有数据表达**，且我**不写游戏层掷骰 hack**（守数据驱动宣言）。

- **建议方案（交 Lead 评估；倾向并入通用 dialogue 模块，与 line/choice 并列第三种节点）**：
  ```
  // DialogueNode 第三种：check
  { kind: 'check',
    attribute: string,        // 基础属性 Resource id（如 'charm'）
    bonusFrom?: string,       // 好感修正 Resource id（如 'affection_S'，按系数计）
    bonusDiv?: number,        // 好感修正系数（如 /10），缺省 1
    dice: number,             // 掷 1..dice（如 20）
    difficulty: number,
    successNext: string, failNext: string,
    successEffects?: DialogueEffect[], failEffects?: DialogueEffect[] }
  ```
  - 运行器遇 check 节点（收到 DialogueAdvance 或自动）：从世界的 `RandomSeed` 实体取 `randomInt(seed,1,dice+1)`（推进序列）；`score = resource(attribute) + floor(resource(bonusFrom)/bonusDiv) + roll`；`score≥difficulty` → 施 successEffects、`State.current=successNext`，否则 fail 分支。
  - **确定性**：用现成 `RandomSeed`（mulberry32，已是确定性 PRNG）+ 进 `world.snapshot()` → 存档/重放结果一致（正是 §四"检定骰子确定性，存档重放结果一致"的验收点）。
  - 落库后：Game B 的检定节点 = 纯数据（脚本里加 check 节点 + 一个 RandomSeed 实体），零游戏代码。

- **边界**：**阻塞 v0.4**（检定是 v0.4 核心）。是否并入 dialogue vs 独立 `skill-check` 能力，请 Lead 定。这是"图遍历解释器"再加一种节点类型，与 R15 同源。

---

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

### [2026-06-04] · PA · Game A · status: **done**（2026-06-04，Lead）· REQ-002 sensor / 非实心触发体（trigger-zone 与 collision-resolve 抢同一份 Overlap）

> ✅ Lead 落地：新增 `Sensor` 标记组件；`collision-resolve` 跳过"任一方挂 Sensor"的接触对（不做物理推开），overlap-detect/trigger-zone 照常消费。开关/压力板/触发区 = 给实体加 `Sensor`(数据)即可站进去。比绑死 ZONE_FLAG 更通用、数据驱动。2 测试(sensor 跳过 + 无 sensor 对照)。

- **想实现的游戏行为**：合作机关第一类——A 踩开关/压力板 → 发触发事件（开门、激活）。这是《双人成行》入门核心（踩开关 / 限时门 / 重量台）。
- **已经试了什么**：按 `trigger-zone` 文档，开关 = `Tag(ZONE_FLAG)` + `Shape` + `Transform`；玩家重叠 → `overlap-detect` 出 `Overlap` → `trigger-zone` 发 `Trigger{zone,other}`。
- **卡在哪 / 缺什么**：`collision-resolve`（`src/skills/tier2/collision-resolve.ts`）读**所有** `Overlap` 对当实体碰撞解算（只看 Transform/Shape/Velocity/Mass，`invA+invB>0` 即推开），**完全不排除 trigger zone**。后果：开关同时是一堵实心墙——玩家走进去被弹开（站不进区域）；站顶上则被解算到"恰好不重叠"→ 不产 `Overlap` → `trigger-zone` 不触发。`trigger-zone`（要重叠）与 `collision-resolve`（消重叠）抢同一份 `Overlap`，**语义互斥，缺 sensor（非实心碰撞体）概念**。
- **建议方案**：`collision-resolve` 跳过"任一方是 trigger zone（`Tag.flags & ZONE_FLAG`）"的接触对——只让 `overlap-detect`/`trigger-zone` 消费、不做物理解算。最小改动、复用现有 `ZONE_FLAG` 约定；或更通用引入 `Sensor` 标记 / `Collider{ solid:boolean }`。确定性不受影响（只是少解算一对）。
- **阻塞**：踩开关 / 限时门 / 重量台（第一批合作机制**全部**）。我**未 hack 绕过**——雏形里开关相关机制暂缺，等本需求落地。

---

### [2026-06-04] · PA · Game A · status: **done**（2026-06-04，Lead）· REQ-003 ground-sense 支持"站在动态支撑上"（踩搭档/踩箱无法起跳）

> ✅ Lead 落地：`ground-sense` 改**不动点传播**——骑乘者落地 ⟺ 支撑是静态地面 **或** 支撑本帧也 Grounded（动态搭档/箱子）。链式（A 踩 B 踩地）迭代到稳定，结果与顺序无关 → 确定性/lockstep 安全。与 collision-resolve 已有的"Grounded 动态当静态支撑"对齐。2 测试。

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

### REQ-C-001 · [2026-06-05] · PC · Game C · status: **done**（2026-06-05，Lead：@skills/tier3 match3-board 算法型机制）· 优先级: **P0**（阻塞可玩棋盘）

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

### REQ-C-002 · [2026-06-05] · PC · Game C · status: **done**（2026-06-05，Lead：@skills/tier2 clickable）· 优先级: P1

**标题**：通用「可点击实体」—— 指针命中 tag 实体 → 配置化语义动作 / 信号

- **想实现的游戏行为**：点棋盘某格(选中 / 交换)；点缝纫店按钮(缝制)。
- **已经试了什么**：R3 已落地输入接缝(`PointerInputSource` → 单例 `InputQueue`，屏幕坐标按 tick 确定性注入)；`renderable.ts` 已有 `screenToWorld` 逆投影。
- **卡在哪 / 缺什么**：R3 明确「命中测试 / 语义解析归游戏层」，且 `action-map` 无 system。没有通用「屏幕点 → 命中世界实体 → 发一个配置好的 `Signal`/`Action`」能力。每个游戏自己写命中 = 游戏层逻辑代码(违反第一性原则)。
- **建议方案**：通用 `clickable` capability —— 实体挂 `Clickable{ action }` + `Transform` + `Shape`；系统读 `InputQueue` 的 down 坐标 → `screenToWorld`(已有) → AABB / spatial-query(W2) 命中 → 在命中实体上产出 `Action{name}`/`Signal`。确定性(只读 InputQueue + 几何比较)。
- **复用**：点击器 / 网格 / 按钮 / 拖拽起点通用；也是 REQ-C-001 交换输入的来源。

---

### REQ-C-003 · [2026-06-05] · PC · Game C · status: **done**（2026-06-05，Lead：@skills/tier2 craft-recipe，与 R14 归一）· 优先级: P2

**标题**：通用「配方 / 消费」经济 —— 信号触发时材料足够则扣料并解锁（主动缝制）

- **想实现的游戏行为**：玩家点「缝制初心围裙」→ 若材料够，扣掉材料、解锁该衣服(主动养成，区别于 v0.1 的被动阈值解锁)。
- **已经试了什么**：被动里程碑解锁已用 `event-when` 阈值做到。但「**主动花费**(扣料换衣)」表达不了。
- **卡在哪 / 缺什么**：`effect-apply` 的 `modify-resource` 是无条件加减，**不校验「是否付得起」**，也不能**原子地「同时扣多项 + 置 flag」**；事件型组件一实体一份(R14)，一次扣多料不便。缺「可负担则成交、否则整单不动」的通用经济能力。
- **建议方案**：通用 `craft-recipe` capability —— `CraftRecipe{ onSignal, costs:[{id,amount}], grantsFlag, grantsState? }`；系统在 `onSignal` 在场且**所有 costs 可负担**时，一次性扣全部料 + 置 flag(/set-state)，否则整单不动(原子性)。确定性(只读写确定数值)。
- **复用**：商店 / 合成 / 建造 / 科技树通用。可与 R14「批量改资源」合并考虑。

---

### REQ-C-004 · [2026-06-05] · PC · 框架级（Game C 拉动） · status: **done**（2026-06-05，Lead：src/services/aigp Null/Http AishePort）· 优先级: 架构级 · **类型: 表现后端**

**标题**：爱诗(AIGP)视频生成后端 —— 消费「外观 → 提示词」产出短视频展示（周期表「扩展 C」X4–X7 首次落地拉动）

- **想实现的游戏行为**：把女孩当前换装(lookId) → 一段提示词 → 爱诗生成竖屏短视频做展示 / 分享。这是 Game C 的「输出点」。
- **已经试了什么**：已把「外观 → 视频提示词」做成**纯数据表**(`theme.ts` `LOOK_PROMPTS` / `composeAishePrompt`)，即周期表 **X4 ShadowDictionary** 的数据形态。
- **卡在哪 / 缺什么**：全项目**无任何视频 / AIGP 后端**(类比 R1 之前无贴图、R8 之前无音频)。提示词只是字符串，没人拿去生成。这是**表现层旁路、不进确定性 sim**。
- **建议方案**：类比 R1(资产) / R8(音频)，加一个 AIGP 端口(`EnginePort` 风格)：`AishePort.generate(prompt, opts) → videoHandle`，`NullAishePort`(headless / 测试静默) + 真后端(调外部视频生成 API)。周期表「扩展 C」X4–X7(`ShadowDictionary` / `SemanticMaterial` / `ConditioningMask` / `LatentAnchor`)是其数据契约。**确定性边界**：旁路异步、绝不碰 world / snapshot / hash(与资产 / 音频同纪律)。
- **类型**：框架级(类比 R9 资产文档)，可先出设计文档，再落 Null 端口 + 真后端。

---

### [2026-06-04] · PA · Game A · status: **done**（2026-06-05，Lead：Tween loop/pingpong + loops）· REQ-004 Tween 加 loop / pingpong（连续往复移动平台）

> 背景：用户定原则——游戏要**数据驱动**，能用组件数据表达就别写游戏专属代码。本需求正是为了让"移动平台"留在数据层。

- **想实现的游戏行为**：连续往复的移动平台 / 电梯来回 / 巡逻台——平台跳跃的常见元素。
- **已经试了什么**：用 R6 `Tween` 纯数据驱动平台位置（`Tween{target:'Transform.y', from, to, duration}`）。**一次性升降已验证可纯数据表达且能载人**（`src/games/game-a/moving-platform.test.ts`：平台升起带着上方玩家一起升）。
- **卡在哪 / 缺什么**：`Tween` 是**一次性**（`src/skills/tier1/tween.ts`：`elapsed>=duration` 即写终值并 `removeComponent`），**无 loop/pingpong** → 单个数据组件无法表达连续往复。按数据驱动原则，我**不写游戏专属系统去循环它**（那就违背原则）。
- **建议方案**：`Tween` 加可选 `loop?: 'none'|'restart'|'pingpong'`（+ 可选 `loops?: number`，缺省 ∞）。到点：`restart` 归零重跑；`pingpong` 交换 from/to 再归零。纯数据、snapshot 友好、确定性不变。Game B 循环呼吸/漂浮立绘、Game A 移动平台/巡逻台都用。
- **阻塞**：连续移动平台 / 电梯 / 巡逻台（一次性升降已可做）。

---

### [2026-06-04] · PA · Game A · status: **done**（2026-06-05，Lead：渲染器优先 Sprite + chooseRenderMode 纯函数）· REQ-005 渲染器让 Sprite 给可碰撞实体"穿皮"（Shape 当前盖过 Sprite）

- **想实现的游戏行为**：给带碰撞的实体（玩家/箱子/平台）穿美术皮（贴图），同时保留碰撞。
- **已经试了什么**：资产清单（数据）+ `Sprite{textureKey}`（数据）已接通——**无碰撞的 Sprite-only 实体（背景、目标旗）能正常画贴图**（`src/games/game-a/assets.ts` + 蓝图）。给玩家再挂 Sprite 试穿皮。
- **卡在哪 / 缺什么**：`collectRenderables` + `CanvasRenderer`（`src/renderer/canvas-renderer.ts:84-99`）按 if-else 绘制，**Shape 分支在 Sprite 之前**——实体只要有 Shape（碰撞需要），就画几何方块、**忽略 Sprite**。可碰撞实体显示不了贴图皮。
- **建议方案**：渲染器优先 Sprite（有 textureKey 且资产就绪即画贴图，否则退化几何）；或给显式 render hint（Sprite 存在即覆盖 Shape 的可视，Shape 仅作碰撞）。属渲染器/表现层，归共享层。**影响几乎所有 action 类游戏**（实体普遍既要碰撞又要美术）。
- **阻塞**：玩家/敌人/可推箱的角色美术。**未 hack**（不搞双实体+手动同步的 kludge），等渲染器决策。

---

### [2026-06-04] · PA · Game A · status: **done**（2026-06-05，Lead：zone-occupancy，已迁 Game A 删 coop-goal.ts）· 优先级: **高（数据驱动对齐）** · REQ-006 把 coop-goal 下沉成通用能力（通关条件应是数据，不是代码）

> 依据：`data-driven-manifesto.md` §8 已点名 `src/games/game-a/coop-goal.ts` 是**代码债**。按"发现非数据驱动 → 提需求下沉"的纪律主动提出。

- **想实现的游戏行为**：通关条件"两名玩家都进入目标区"应是**数据**（蓝图里一个声明），而不是手写系统。更一般：声明式目标/胜负（区域占据、收集齐、到达点）。
- **现状（非数据驱动）**：`coop-goal.ts` 是手写 capability —— 系统读两个玩家 `Transform`、判矩形内、写 `Flag`。确定性、能跑，但**是游戏专属代码** = 宣言负债。它存在只因当前没有"把区域占据条件表达成数据"的能力。
- **为什么现在只能写代码**：(a) 区域进入检测要 **sensor（REQ-002，open）**——否则目标区挂 Shape 会被 collision 推开；(b) "所有目标都满足"的**多源聚合条件（R5 condition 的多目标/计数版，open）**。两块都没落地，故只能游戏层硬读坐标。
- **建议方案（请 Lead 选）**：
  - **路径 A（组合现有，待 REQ-002 + R5）**：目标区 = `trigger-zone`(sensor) → 每个玩家进区发 Trigger/Flag；`condition` 聚合"两玩家 Flag 都真"→ 输出 `coop-clear` Flag。全数据，`coop-goal.ts` 删除。
  - **路径 B（下沉成通用 capability）**：一个 `objective` / `zone-occupancy` 能力 —— 数据声明 `{zone, requiredTags|entities, count, outFlag}`，引擎判"区内满足数量的目标"→ 写 outFlag。Game A 通关 / Game B 到达 / 平台门控都复用。
- **验收**：`coop-goal.ts` 可删；通关条件用纯数据（蓝图里一个 objective 组件/实体）表达。
- **关联**：REQ-002(sensor) + R5(condition) 是路径 A 前置；本条是它们的"游戏级目标"消费场景。
- **附带承认**：宣言 §8 也点名 `*.ts 蓝图`（`blueprint.ts`/`level.ts`）应变**纯数据 Game Manifest** + 通用 loader 解释。我支持该方向（与 Lead 偿还方向一致）；属框架级，可单列，本条聚焦 coop-goal。

---

### REQ-008 · [2026-06-06] · PA · Game A · status: **done**（2026-06-06，Lead）· 优先级: 高 · **类型: 真缺口（信号→物理改动）**

**标题**：`Effect` 缺"物理效果"——开关能检测、但门开不了（踩开关 → 一面墙变可穿过，断在最后一环）

- **Lead 评判（接受，真缺口非冗余）**：`zone-occupancy`/`condition`/`event-when` 能把"踩到了/两人都在"变成 flag/signal（逻辑态），但 `effect-apply` 原来只能改逻辑态（flag/resource/state），**不能改物理**——toggle 门的 Sensor、隐藏/销毁障碍都表达不了。这条"信号→物理改动"现有数据**换种组合也补不出**（尺子：最弱 LLM 也写不出），故下沉，而非回驳。逻辑门控（到达 Zone 才过关）与物理门是两类正当机制，不互相替代。
- **落地**：`effect-apply` 加物理 kind（按 `targetEntity` 定位）：
  - `set-sensor`（value 布尔）：给目标实体加/去 `Sensor` → collision-resolve 跳过它 = 可穿过（**踩开关→墙变门**）。
  - `set-visible`（value 布尔）：切目标 `Visibility.visible`（门消失/出现）。
  - `destroy`：发 `DestroyRequest` → destroy-apply 移除目标（清障碍）。
  - 数据写法：`Effect{ onSignal:"plate_on", kind:"set-sensor", targetEntity:"wall_3", value:true }`。Commit 相位，一拍反馈，确定性。5 测试。
- **延后（按需再提）**：`move`（连续移动门）建议用信号触发 `Tween`（需一个"signal→加 Tween"小能力，另议）；`spawn` 需模板展开（assembly 层），单提。

---

### REQ-C-005 · [2026-06-05] · PC · Game C · status: open · 优先级: P1 · 类型: 能力扩展（match3-board）

**标题**：糖果传奇式组合消除 / 特殊棋子 —— match3-board 算法扩展（配置驱动）

- **想实现的游戏行为**：4 连 → 生成条形棋子（消整行/列）；5 连 / T / L → 更强（炸一片 / 同色全消）；特殊棋子相撞产生组合效果。让消除有「多种结果组合」（用户明确要对标糖果传奇）。
- **已经试了什么**：现有 `match3-board` 只判 ≥3 同色消除并产料；养成/换装链已接好。
- **卡在哪 / 缺什么**：「按连线**形状**生成特殊棋子 + 触发时的范围/整行/同色消除 + 特殊×特殊组合」是**算法扩展**，`Condition→Event→Effect` 等数据表达不了（用户也确认「生成算法是特殊 system，无法涌现」）。**游戏层不写**。
- **建议方案（请主程定）**：扩 `match3-board`，config 驱动的组合规则表 —— `matchShape(line4|line5|T|L|square) → spawnSpecial(kind)`；`special → effect(clear-row|clear-col|area(r)|same-color)`；`special×special` 组合效果表。确定性（整数 + RandomSeed）。产料仍走 `ResourceModify`。**纯通用**：所有三消复用。

---

### REQ-C-006 · [2026-06-05] · PC · Game C · status: open · 优先级: P2 · 类型: 能力健壮性（match3-board）

**标题**：无可行步 → 自动重排（防死局）

- **想实现的游戏行为**：全盘没有任何可消除交换（死局）时自动洗牌到「有解且无连线」，不卡死。
- **已经试了什么**：我已修掉一个**开局死盘 bug**——之前蓝图用 `(c+2r)%6` 规则条纹盘，无初始连线但**任何相邻交换都凑不成连**；改为「逐格避开左二/上二同色」的随机开局盘（已加测试断言「至少一个可行步」）。
- **卡在哪 / 缺什么**：`match3-board` 稳定（match→idle）只保证**无连线**，不检测**是否存在可行步**；补块/连锁后理论上仍可能死局。检测可行步 + 重排是算法，**游戏层不写**。
- **建议方案**：`match3-board` 进 idle 时若「扫所有相邻交换均无连线」→ 用 `RandomSeed` 重排到「有解且无连线」。确定性。

---

### REQ-C-007 · [2026-06-05] · PC · Game C · status: open · 优先级: P2 · 类型: 特效组件（表现层，用户授权可提）

**标题**：三消手感特效组件 —— 消除迸裂 / 下落 / 连锁强调（交换滑动已自做基础版）

- **想实现的游戏行为**：消除时棋子迸裂/粒子高光、空位上方棋子平滑下落、连锁逐级强调。手感别「死板地闪」。
- **已经试了什么**：交换/无效回弹的**滑动**我已在 `game-c.tsx` 自绘画板（表现层）做了基础版；棋子花纹（字形）也已画回。
- **卡在哪 / 缺什么**：更重的「迸裂/下落/连锁」特效若每个游戏各自在画板里硬写 = 表现层负债。用户已明示「特效组件可向主程要」。
- **建议方案**：可复用的「棋盘 juice / 特效」约定 —— 或让 `match3-board` 在消除/下落时产出 `Tween`(现成 Tier1) 驱动视图格 `Transform/Color.alpha`，渲染器照画；或一个通用 particle/VFX 能力。**表现层、不进 sim/hash**（与音频/资产/爱诗端口同纪律）。三消及一切网格游戏复用。

---

### REQ-ARPG · [2026-06-07] · 用户 · Game D（ARPG PoC，投资路演靶点）· status: **in-progress**（2026-06-07，Lead）· 优先级: 高 · **类型: 战略垂直切片 + 能力簇**

> **背景**：用户提《Apollo AIGP 垂直切片：暗黑类 ARPG PoC》蓝图。Lead 逐层对照真实代码评审，结论：
> - **T1（Transform/Shape/Mass/Resource/Sprite/Frame/Color/Tween）/ T2-A（collision-resolve）/ T2-B（Condition→Event→Effect）全部已覆盖**；§3 资产管线 ≈ R1+R9；§4 demo 闭环 ≈ studio+parseManifest（已建）。
> - **回驳 T4 的「YAML→Node.js 编译器」**：违反最高纲领（在确定性引擎外塞自由代码编译器、旁路 parseManifest+R12 数据契约、且反噬 demo "AI 直出引擎数据"的论点）。**用户采纳反提案 B：数据级 `prefab` 能力**（引擎确定性展开，AI 产数据不产代码）。
> - **真缺口簇「关系型战斗」**：现有涌现层是单例/全局-id 取向（VN flag/单 hp），ARPG 要逐实体（N 怪各自 hp/status、接触路由、计算数值、阵营过滤）。**用户决定：先下沉能力簇，再装配游戏。**
>
> **进度**：
> - ✅ **关系型战斗核心 = `@skills/tier2/hitbox`**（一个能力覆盖 5 缺口）：复用 trigger-zone（伤害区标 ZONE_FLAG → Trigger）→ hitbox 读 Trigger，按 `Tag` 阵营(targetMask) + `Status` 门(requireMask) 过滤，对命中目标施**局部** ResourceModify（逐目标，scope:'local'）+ 置/清 `Status` 位；伤害支持固定 `amount` 与计算 `fracOfMax`(% maxHP)；多 Trigger 自然 AOE fan-out。新增 `Hitbox`/`Status` 组件。顺手补 `ResourceModify.scope` 字段声明（R12）。**7 测试含全链路集成（overlap→trigger→hitbox→resource），全量 543 绿。**
> - ✅ **数据级 `prefab` 能力 = `@skills/tier3/prefab`**（T4 授权层）：复用 spawn 原子的 `SpawnRequest`（请求契约已有、展开系统此前为空）→ 从单例 `PrefabLibrary`（模板=数据）确定性展开实体（唯一 id `tid#seq:local`、Transform 偏移到 (x,y)、深拷贝隔离实例）。新增 `PrefabLibrary`/`PrefabTemplate`。**money-shot 集成测试**：`SpawnRequest{frost_nova}`（数据）→ 展开 nova → overlap→trigger→hitbox→resource → 敌人真扣血 + 冻结，**零游戏代码、零编译器**——正是 PoC 论点。+7 测试，全量 551 绿。
> - ✅ **game-d 纯数据切片 = `src/games/game-d/`**：`buildGameDBlueprint` 装配 PrefabLibrary（frost_nova 冰冻 CC + shatter_smash 碎冰真伤两份模板=数据）+ 敌人。**涌现叠加测试（蓝图 §3）**：冰霜新星冻住范围内 enemy_a（不及范围外 enemy_b）→ 碎冰重锤只对**冰冻的** enemy_a 结算 20% maxHP 真伤并解冻、对范围内但未冰冻的 enemy_b **不结算**——条件组合**涌现自数据**，非硬编码。蓝图可加载 + 确定（hash 一致）。+2 测试，全量 553 绿。
>
> **✅ 引擎侧 + 数据切片完成**（hitbox 战斗簇 + prefab 授权层 + game-d 涌现切片，全链路 money-shot 已证）。
> **✅ studio NL→热载 路演路径（2026-06-07，Lead）**：闭环本已存在；真缺口 = apollo.py 的生成 System Prompt 手维护、只列平台跳跃十来个能力（hitbox/prefab 全缺 → ARPG 战斗无法 NL 生成，且漂移）。修法（引擎自描述）：`buildCapabilityCatalog(ALL_CAPABILITIES)` 从 describe 自动派生目录 → launcher 随 /api/generate 送 → apollo.py 注入 `{CAPABILITY_CATALOG}` 占位符。**任何能力登记即对 AI 可见、零 prompt 维护、不漂移**；ARPG 战斗现可 NL 生成。582 绿。
> **Game-D 已派专人（狗程序员，有引擎权限）**：`src/games/game-d` 归他；引擎现为共同所有，我勤 rebase、避让其活面、协作式评审。
> **follow-up（非阻塞）**：资产 key 校验接进 launcher 热载（R9① 设施已就绪，待生成游戏真引用资产 + launcher 载 AssetIndex）、game-d 可玩化（专人做）、§3 资产管线（R9）落地真序列帧。

> **✅ 第二批（2026-06-07，Programmer D）—— 三缺口下沉 + 完整可玩切片（588 passed / tsc / build 全绿）**：
> - **D-001 数据驱动 AI**：拆成两个单一职责能力（**对齐 wiki/skills 周期表 ai-chase = state + spatial-query(nearest) + relation(target) + transform + velocity**，而非单体）：`@skills/tier3/aggro`（Perception→`Relation{kind:'target'}`，索敌产物化，复用 spatial-query 新增 `nearestByTag`）+ `@skills/tier2/steering`（读 Relation(target)→Velocity，seek/flee + `haltStatusMask` CC 定身）。AI 行为=数据装配，**Tier4 重新清空**（行为是 Macro 组合，非常驻代码）。配套 `@skills/tier2/mortal`（逐实体 hp≤0 死亡 + `dropTemplate` 掉落）。
> - **D-002 信号→生成桥**：`@skills/tier3/caster`（Signal + at:self/pointer/target → `SpawnRequest` → prefab 展开；`at:'target'` 复用 aggro 的 Relation(target)）。补上 REQ-008 显式延后的"运行时按数据释放技能"入口。
> - **D-003 限时/持续效果**：`@skills/tier2/over-time`（DoT/regen/定时状态，对应周期表 poison-dot/resource-regen），并给 `hitbox` 加 `statusDuration`/`dot*` 字段（命中挂 OverTime）→ **修掉旧切片"手动 destroy 才停冻"的 hack**（定时冻结自动解冻）。定序：`hitbox` runsBefore `over-time`；`steering` runsBefore `hitbox`/`over-time`（CC 读上一拍 Status，破一拍反馈环，R10 同法）。
> - **game-d = 完整数据切片**：英雄(操控+相机+会死) + 三怪(ai-chase 追逐) + 冰霜新星/碎冰/烈焰/掉落(PrefabTemplate) + 点地/索敌施法(Caster)。6 测试证：AI 追逐、caster 释放、冰冻=定身+90tick 自动解冻、碎冰只打冰冻目标涌现、死亡掉落、确定性——**零 ARPG 专属代码**。
> - **⚠️ 流程教训（已立规）**：开发前**漏读 `wiki/skills` 游戏开发知识库 + 周期表**（角色文档点名必读），致 `behavior` 一度做成单体、`over-time` 未对齐 poison-dot 框架。已补读并按更严格的原子分解重构。**今后每个新能力先读 wiki/skills 对应模块 + 周期表再设计。**
> - **follow-up（非阻塞）**：怪→英雄接触伤害（怪挂子攻击区，已论证可组合）、序列帧 VFX、低血逃跑/巡逻等模式（state+condition 数据，待逐实体 condition→state 小能力）。

> **✅ 第三批（2026-06-07，Programmer D）—— 可玩化：按键绑定 + Canvas 渲染 + R9 资产（623 passed / tsc / build 全绿）**：
> - **按键→Signal**：新 `@skills/tier2/keybind`（`KeyBinding{key,signal}` 数据 → 读 InputQueue 具名动作 → Signal；clickable 的非空间孪生，键位映射=数据，input.md 纪律）。键盘源 `KeyboardInputSource` 加"动作键"（边沿触发具名动作事件）。`caster` 加 `originEntity`（技能绑定实体把锚点/索敌委托英雄，绕过"一实体一 Caster"、不引入定序环）。
> - **Canvas 渲染**：`game-d.tsx` 挂载（Engine + CanvasRenderer + KeyboardInputSource）+ 注册进 launcher 卡带。WASD 移动、1/2/3 释放冰霜新星/碎冰/烈焰、camera-follow 跟随。渲染器现成（box 几何 + 相机投影）。
> - **R9 资产**：`game-d/assets.ts` 声明 `GAME_D_ASSETS`（英雄/怪/掉落/三技能 SVG 占位），实体/模板挂 `Sprite` 穿皮；缺真资产退化几何（asset-flow ③）。
> - **离线看帧**：`render-frame.ts` 复用纯函数 collectRenderables 把世界投影成 SVG（无浏览器也能确定性"看一帧"，缓解交接 §4「没在真浏览器看过一帧」）。**诚实**：仍未在真浏览器跑过（无 playwright/chromium），离线帧是数据级代理，非人眼/VLM 评审。

> **✅ 第四批（2026-06-07，Programmer D，Lead 批 approve&merge 后定调）—— R14 真修（631 passed / tsc / build 全绿）**：
> 根因 = 引擎"一实体一类型一组件"。Lead 评判：值得现在动（卡真实战斗）。**架构裁决：不动引擎内核**（多实例化全 API 涟漪 + 破确定性 + 反宪法，回驳），**能力层用"单组件持列表"**解（与 MatchBoard.cells / CraftRecipe.costs 同范式）。**爆炸半径锁在战斗簇**，不碰 match3/dialogue/game-b/c：
> - **A 同帧多段伤害**：**不改 `ResourceModify` 的 shape**（零波及别的游戏），resource 原子加 `queueResourceMod()` 累加助手——同实体+同 resourceId+同 scope 则 `amount+=`。hitbox/over-time 改用它 → N 段命中打同一 hp 累加不丢。已知边界（罕见、战斗不触发）：同实体本帧改多个**不同局部资源**时退化为覆盖（与历史一致，无回归），真撞到再上 list。
> - **B 燃烧+冰冻并存**：`OverTime` 改持 `TimedEffect[]`（仅 over-time/hitbox 用）。逐效果计时/到期、`id` 同则刷新防叠爆；hitbox 命中可**同时**挂 DoT + 定时状态（不再二选一）。`addTimedEffect` 助手。
> - **测试**：over-time +"燃烧+冰冻并存各自到期"+"多 DoT 累加不覆盖"；hitbox +"同时挂 DoT+定时状态"。game-d 切片不改自过（读 Status 非 OverTime）。
> - **Status bitmask 本就支持同时点亮多状态位**——卡的只是计时那半，B 补上。

> **✅ 第五批（2026-06-07，Programmer D，用户 GDD 评审后对齐）—— 背景/地图：tilemap 能力 + 第一张地牢房（637 passed / tsc / build 全绿）**：
> 用户提商业级地图/Sprite动作/怪物等级/打击感 GDD。逐条数据驱动评判（见对话）：**地图/动画/怪/VFX 仍全是数据，引擎只加几台通用解释器**。地图生成范式**对齐 Hades 式**（手作房间 tilemap 数据 + 确定性 dungeon 拼接），非 Diablo 纯噪声（商业级靠"设计"非噪声、更数据驱动）。优先级：地图优先。
> - **`@skills/tier2/tilemap`**（真缺口）：`Tilemap` 组件（数据=cols/rows/tileSize/origin + layers[{data:number[],collides,tileset}]，瓦片非实体）+ `tile-collision` 系统（Resolve 相位、runsAfter collision-resolve，动态体推出实心瓦片）。CanvasRenderer 加画瓦片（按 tileId 从 tileset 取源矩形）。地图=数据，引擎=碰撞+渲染两台通用解释器，零 game-d 专属代码。
> - **第一张地牢房**：`game-d/map.ts` 一份 Tilemap（石地+四面围墙实心+火把/地裂装饰）+ tileset 资产（R9 SVG 占位条带）。**一份 Tilemap = 一个 Hades 拼接积木**——后续 dungeon 能力按种子拼多份。英雄/怪被墙框在房内。
> - **后续（已对齐顺序，未做）**：`anim-state`(动作动画 clip→帧) → VFX 打击感(ParticleRequest 粒子+抖屏+闪白+击退,表现层) → dungeon 生成(Hades) → 掉落/装备红黄绿(延后,需 derived-stat)。怪物等级=纯数据(prefab 模板+数值表)，引擎不加码。

> **✅ 第六批（2026-06-07，Programmer D）—— 动作动画 anim-state（655 passed / tsc / build 全绿）**：
> - **`@skills/tier2/anim-state`**（周期表 anim-state-machine）：`AnimState` 组件（clip 表 状态→{sheet?,from,count,fps,loop}）+ 系统按 `State{fsmId}` 或 `Velocity` 选 clip、在帧区间内推 `Frame.index`。复用现成 sprite-sheet 资产 + 渲染器 resolve(key,frame)，**不重造帧/图**。`animation` 原子只线性循环全帧，anim-state 是 clip 子区间 + 状态选择的补充。
> - **铁律**：动画**只表现、绝不驱动逻辑**（伤害靠 Timer/逻辑）；Commit 相位读最终速度；只写 Frame/Sprite，无 sim 读其输出→无环；确定（整数 tick + 由 Velocity 派生）。
> - **game-d**：英雄/怪改用 4 帧走路 sprite-sheet（SVG 占位，摆腿+起伏）+ Frame + AnimState → **移动自动播走路、静止站立**。怪物等级=纯数据（prefab 模板+数值），引擎不加码（已回驳"要新能力"）。
> - **后续未做**：VFX 打击感 → dungeon 生成(Hades) → 掉落/装备。怪物 AI 深度设计（巡逻/警戒/攻击模式/精英/成群）= 后续，靠 state+condition+aggro/steering **加数据不加代码**。

> **✅ 第七批（2026-06-08，Programmer D）—— 精灵动画加厚：攻击动画 + 朝向（660 passed / tsc / build 全绿）**：
> 用户定调"动画系统天花板=Live2D"，但**先做精灵动画为主**（Live2D/骨骼搁置，待用户再想）。讨论结论：动画系统是"统一 rig（姿态快照+挂点 Socket+驱动 System+可插拔后端）"，精灵/Spine/Live2D/3D 预渲染都是后端；周期表 X1 skeletal-pose / X2 socket 已预埋；Socket(挂点) 是最该先落的（一箭双雕：动画挂载+装备穿戴），不依赖外部 SDK——**待用户决定**。
> - **anim-state 加 `attackClip`**：自动派生——站定且有 Relation(target)（追到你身边）→ 播攻击；移动→走；无目标→站。零信号、零新耦合（复用已读 Velocity/Relation）。
> - **新 `@skills/tier2/facing`**（Commit 相位，表现层）：按移动(velocity)/目标(Relation target)方向翻转 Transform.scaleX（碰撞/命中已 abs，安全）；静止保持上次朝向。
> - **game-d**：敌人 sheet 加 2 帧攻击扑击（6 帧）+ 朝前亮条让翻转可读；英雄/怪挂 Facing + 敌人 attackClip。怪追到你身边**站定播攻击**、**面朝目标**。
> - **诚实**：骨骼/Live2D 运行时(Spine/Cubism/Rive)都是外部 SDK+WebGL，本环境(无 chromium)没法验证渲染；能在此做实做绿的是数据层(SkeletalPose+Socket+驱动 System)。

---

### REQ-009 · [2026-06-06] · PA · Game A · status: **done**（2026-06-09，主程4）· 优先级: **P1** · 类型: 真缺口（事件→重置/启动计时器）

> ✅ **落地（主程4，861 绿）**：`effect-apply` 加 kind **`reset-timer`**——信号在场时按 `targetEntity` 定位 Timer，`elapsed=0`（从此刻重新计时）；`value>0` 则一并设 `duration`。配 `condition{kind:'timer',cmp:'gte',value:N}`→event-when→effect 即"踩下那刻起 N 拍自动关门/塌陷"等限时机制**纯数据涌现**。Effect.kind 联合 + reads/writes 加 Timer。+3 测（归零/设 duration/未触发不动）。与 OverTime 按拍衰减互补（前者定时点、后者连续衰减）。

**标题**：`effect` 缺"重置/启动计时器" —— 限时类机制（踩下→开门→N 秒自动关）当前组合不出

- **想实现的游戏行为**：限时门 / 限时平台 / 倒计时机关 —— 某事件（踩开关/进区域/拾取）发生**那一刻起**算 N tick，到点触发（关门 / 平台塌陷 / 失败）。
- **已经试了什么（PA，确认组合不出）**：现有链 `zone-occupancy→flag→event-when→effect` 全跑通；`condition` 能读 `timer.elapsed`。但：
  - `effect` 的 kind 只有 set-flag/modify-resource/set-state/set-sensor/set-visible/destroy —— **没有"重置/启动 Timer"**。
  - `Timer` 从创建即自走（timer-advance 每 tick +1），**无法"从踩下那刻重新计时"**。
  - 也没有"按 tick 衰减 resource"做倒计时（modify-resource 是一次性增量，非每帧）。
  - → "按下那刻起 N 秒自动关"**当前数据组合不出来**（"按住开/松开关"那种已能做，差的就是"定时自动"）。
- **建议方案**：`effect` 加 kind **`reset-timer`**（按 `targetEntity` 定位 Timer：`elapsed=0`，可选 `value`→设 `duration`）。配合现有 `condition{kind:'timer',id,cmp:'gte',value:N}`→event-when→effect 关门，"限时"即纯数据涌现。最小、与 timer/condition/effect 链严丝合缝。
- **优先级 P1**：限时类机制的通用前置；Game A 限时门/塌陷平台、Game B 限时选择、Game D 技能 CD 都可能用。**不阻塞当前**（其余玩法已能做）；按"落地不口头"规则 back up 入池。

> ✅ **Lead 裁决（2026-06-08）：接受，真缺口**。effect 六种 kind 表达不了"按事件重置/启动计时"，确认组合不出。D 的方案对：`effect` 加 `reset-timer`（按 targetEntity 定位 Timer，elapsed=0、可选设 duration）→ 配 condition(timer.gte N)→event-when→effect 关门，限时纯数据涌现。最小、与 timer/condition 链严丝合缝。**实现者注**：倒计时另有一路可复用——挂 `OverTime{amountPerTick:-1,period:1}`（D-003）做按拍衰减资源，到 0 触发；reset-timer 与它互补（前者定时点、后者连续衰减）。谁接都行（effect-apply 是共享引擎），实现前 fetch+merge。

---

### REQ-010 · [2026-06-08] · Lead（Gemini 复审）· 框架级 · status: open · 优先级: **P3 / future** · 类型: 确定性增强（电竞级 lockstep）

**标题**：浮点 → 定点数 / 整数运算，根除跨架构 1-ULP desync

- **背景**：Gemini 复审指出 steering/launch 的 `Math.sqrt`÷ 归一、以及一切 IEEE 浮点，在不同 CPU 架构（ARM vs x86）或 JIT 激进优化（FMA）下存在 **1-ULP（末位）差异**。这些值经 Velocity 积分进 Transform → 决定 Hitbox/Overlap 相交 → **有几率引发跨端 desync**。
- **现状裁决（Gemini + Lead 一致）**：**MVP 可容忍，标 tech-debt**。单机 / 同构端 lockstep 无碍；致命级的"sim 读本地相机"已修（226fe1c）。
- **何时必须做**：要做**跨架构帧同步联机**（如 Windows x86 玩家 ↔ Mac ARM 玩家 P2P lockstep）才需。方案：把向量/距离等关键运算换成**定点数（fixed-point）** + **整数平方根/LUT 查表**，彻底消除浮点不确定性。
- **范围**：steering/launch/collision-resolve/tile-collision 等所有产出进 hash 的浮点运算；是引擎级系统性改造，**不阻塞当前**。Steam 单机发布完全不需要；跨平台联机对战才提上日程。

---

### REQ-011 · [2026-06-08] · PE（Lead 评审后下沉）· 框架级 / 卡牌玩法 · status: **done（已落地）** · 优先级: **P1** · 类型: 真缺口（扑克牌型评估 + 持牌集合）

> **落地（Lead）**：`src/skills/tier3/poker-hand.ts`（+ `.test.ts` 39 测）。纯函数 `evaluateHand(cards)→{type,rankCounts,suitCounts,isFlush,isStraight}`（全 12 牌型含五条/同花葫芦/同花五；A 高/低顺、同花顺优先、并列取高、按花色/点数计数迭代接口都覆盖）；系统 `poker-eval`（Update 相位）读同实体 `PlayedHand`→按 `rankingTable` **set** 基础 `chips/mult` Resource + 可选写牌型名 `StringVar`。组件 `Card/PlayedHand/PokerHand` 入 components.ts，注册入 registry。**严守评审边界**：未做选牌 UI/洗牌/盲注/回合（留给 clickable/random/condition/effect 重组）；**未纳入 spec 里的 `deck?` 字段**——评估器不读它，纳入即死数据（反 manifesto），牌组/发牌属选牌装配层（用 `random`）。与 REQ-012 集成测已验「基础分→小丑 ×mult」整链。

**标题**：`@skills/tier3/poker-hand` —— 确定性「一手牌 → 牌型 + 基础分」评估器（Balatro 式小丑牌的玩法底座）

- **想实现的游戏行为**：Balatro 式 roguelike 卡牌。玩家从手牌选若干张「出牌」，引擎判定牌型（高牌/对子/两对/三条/顺子/同花/葫芦/四条/同花顺…），给出该牌型的**基础 chips + 基础 mult**；小丑牌再在此之上按「牌型 / 花色 / 点数 / 逐张」做修正（见 REQ-012）。最终 `score = chips × mult` 与盲注线（一条 `condition: resource gte threshold`）比较。
- **PE 可行性评审结论（已对照现有能力逐条裁）**：
  - chips / mult / money / score → 复用 `Resource`（按 id 全局路由）。**不新增**。
  - 「出牌/弃牌/盲注线/回合状态机/选牌/洗牌发牌/经济」→ 全部用现有 `event-when / condition / effect-apply / state / clickable / spawn / random` **重组**，**回驳任何「新写计分 system / 回合 system」的提法**（manifesto §4：先重组）。Game C 的 `clickable` 选格、`random` 种子 PRNG 即选牌/洗牌的现成料。
  - **真表达不了的唯一缺口**：没有任何能力持有「这手已出的牌」这个**有序卡集合**，也没有「5 张是不是同花顺」的**牌型检测器**。尺子检验：牌型**分值表**最弱 LLM 能产出（数据）；但「检测牌型」是**算法**，LLM 产不出同一份数据 → 必须下沉成引擎里的确定性解释器。
  - **有先例**：与已落地的 `match3-board`（数据=棋盘数组，引擎=连消检测）、`tilemap`（数据=瓦片数组，引擎=碰撞）**完全同构** —— 合法的 Tier3 通用能力，非游戏专属代码。
- **建议组件契约（实现者可调整命名，遵 components.ts 风格）**：
  - `PokerHand{ rankingTable, deck? }`（config 类）：`rankingTable` = 牌型→{baseChips, baseMult} 的**纯数据表**（设计可调，不写死在代码）；牌定义 = {suit, rank}（数据）。
  - `PlayedHand{ cards: {suit,rank}[] }`（event/state 类）：本次出的牌（有序，供逐张迭代）。由选牌交互（clickable→signal→effect 装配）填充——**不在本能力里做选牌 UI**。
  - 系统 `poker-eval`：读 `PlayedHand` → 确定性判定最高牌型 → 写出 `chips`/`mult` 两个 Resource 的基础值（或写 `StringVar/State` 记牌型名供 condition 读，做「打出同花→某小丑触发」）。**只算分、不碰渲染、不驱动逻辑之外的状态**。
- **确定性边界**：纯整数/枚举比较（点数、花色、计数），不碰浮点超越函数 → lockstep/录放安全。牌型判定是纯函数，输入=有序卡集，输出稳定。
- **开工前必读**：`wiki/skills/index.md` 找棋盘/匹配类模块 + 细看 `src/skills/tier3/match3-board.ts` 既有范式，别另起炉灶。
- **验收**：覆盖全部牌型判定（含边界：A 高/低顺、同花顺优先级、并列取高）+ 「逐张/按花色计数」迭代接口的测试；tsc + vitest + build 全绿。

---

### REQ-012 · [2026-06-08] · PE（Lead 评审后下沉）· 框架级 · status: **done（已落地）** · 优先级: **P1** · 类型: 真缺口（声明式效果：乘法 + 有序结算）

> **落地（Lead）**：`Effect` 加可选 `op:'add'|'mul'|'set'`（缺省 `add`）+ `order:number`（缺省 0），改 `effect-apply.ts` 的 `modify-resource`：先把同信号命中的 Effect 收进 `hits` 按 `order` 升序（并列按 eid tie-break）排序，再逐条就地连写 `r.current`（`mul`=×、`set`=、`add`=+，照常钳 [min,max]）。**最小、向后兼容**：老数据（无 op/order）行为不变（回归测已验）。新增 8 测含「先 + 后 ×=30」与「先 × 后 +=25」证明 order 决定结果、mul 钳上下限、eid tie-break。与 REQ-011 合用即 Balatro 小丑 ×Mult。

**标题**：`effect-apply` 的 `modify-resource` 加 `op`（add|mul|set）+ `Effect.order` —— 让「×倍率」和「小丑结算顺序」成为数据

- **想实现的游戏行为**：Balatro 小丑大量是 **`×mult` / `×money`**（如「+50% Mult」「每有 \$5 则 ×0.x Mult」），且**结算顺序语义关键**——Balatro 小丑从左到右依次结算，`×` 在 `+` 之后结果不同。
- **PE 可行性评审结论**：
  - 现状 `effect-apply` 的 `modify-resource` 只有 `current + value`（**纯加法**），`×mult` **当前数据组合不出**（乘法依赖 mult 的动态当前值，加法的静态 value 表达不了）→ **真缺口**。
  - 这**不是新能力**，是给**现有 capability 补一字段的 DSL 扩展**。尺子检验：最弱 LLM 能产出 `{ kind:"modify-resource", op:"mul", value:1.5, order:3 }` → 合格的数据接口，**非自由代码**。
  - 结算顺序：现状 `effect-apply` 按 `world.query('Effect')` 的 entity 顺序遍历——确定但**隐式、非声明**。乘法引入顺序依赖后，必须把顺序变成**显式数据**（`Effect.order` 升序结算），既对齐 Balatro 语义，又利于审计/确定性。
- **建议改动（最小、向后兼容）**：
  - `Effect` 加可选 `op: 'add'|'mul'|'set'`（缺省 `'add'`，**老数据零改动**）；`modify-resource` 分支按 op 结算：`add`→`current+value`、`mul`→`current*value`、`set`→`value`，结算后照常钳进 [min,max]。
  - `Effect` 加可选 `order: number`（缺省 0）；effect-apply 在施加前**按 order 升序排序**同一信号命中的 Effect，再依次结算 → 顺序即数据。
  - 同帧多 Effect 改同一 Resource 时，乘法**就地累乘**当前值（不能像加法那样靠 `queueResourceMod` 累加后一次写）——实现者注意：modify-resource 走的是 effect-apply 内联写 `r.current`，不经 `ResourceModify` 队列，按 order 顺序就地连写即可，天然有序确定。
- **确定性边界**：乘法仍是确定运算（同 order 同输入 → 同输出）；只读/写确定 Resource，不碰浮点超越函数。`order` 进 snapshot 即录放安全。
- **依赖关系**：与 REQ-011 合用即可拼出完整 Balatro 小丑；单独做也能让现有逻辑链表达「×」类效果（如 Game D 的暴击倍率、Game B 的属性加成乘区）。**可并行实现**。
- **验收**：add/mul/set 三 op + 多 Effect 按 order 有序结算（含「先 + 后 ×」与「先 × 后 +」结果不同）的测试；老数据（无 op/order）行为不变的回归；tsc + vitest + build 全绿。

---

### REQ-013 · [2026-06-08] · Lead（Game E 缺口审计后下沉）· 框架级 · status: **done**（2026-06-08，Lead；commit 7e0b408/960cf10 已落，本程对账翻牌）· 优先级: **P1 / 核心阻塞** · 类型: 真缺口（声明式效果：值取自资源 / 量纲动态值）

> ✅ **落地（已在代码，本程对账确认）**：`Effect` 加可选 `valueFrom:{resourceId,coeff?,timesResourceId?}`；`effect-apply.ts` 的 `modify-resource` 在场则 `v = resource[resourceId].current × (timesResourceId ? resource[timesResourceId].current : coeff ?? 1)`，否则用静态 `value`，再按 op 结算钳 [min,max]。缺资源按 0。game-e 蓝图 `score_combine`（hand_score=chips×mult，timesResourceId）+ `joker_bull`（每$1+2c，coeff）已用，整合测验过。**注：之前账实不符（commit 已落但状态留 open），本程翻牌。**

**标题**：`effect-apply` 的 `modify-resource` 加 `valueFrom`（值 = 资源 ×（系数 | 另一资源））—— 让「`score += chips × mult`」「每 \$1 +2 筹码」成为数据

- **背景（Game E 计分链审计暴露）**：Balatro 最终计分 `score += chips × mult`，**两个动态资源相乘**。REQ-012 的 `op:'mul'` 只能 `资源 × 静态常量`，乘不了两个动态资源 → **当前连一分都算不出来**（设计稿 §5 把它误当「mul+add 链」，是错的）。同类还有「量纲动态值」小丑（Bull 每 \$1+2c、Banner 每剩 1 弃牌 +30c）和星球牌升级（chips += level × 增量）。
- **Lead 评审（过 manifesto 尺子）**：
  - **回不掉**：`op:mul` 静态常量不行；`stats.ts` 的 `(base+Σadd)×Πmul` 是**单 stat 内**算、乘不了两个不同资源；craft-recipe 也不行 → 现有能力真表达不了。
  - **不是新能力**，是给现有 capability 补一字段的**微型 DSL 扩展**（同 REQ-012 性质）。尺子：最弱 LLM 能产 `{op:'add', targetId:'score', valueFrom:{resourceId:'chips', timesResourceId:'mult'}}` → 数据接口✓。
  - **对 PE 提案的修正**：PE 的 `valueFrom:{resourceId,coeff}` 系数是**静态**的，解 Bull/Banner 够、但解不了 `chips×mult`（系数得是资源）→ 必须加 `timesResourceId`（系数也可是资源）。一改**同时解掉**：最终计分、量纲动态值（~15 张）、星球升级。
- **改动（最小、向后兼容）**：`Effect` 加可选 `valueFrom:{ resourceId:string; coeff?:number; timesResourceId?:string }`；`modify-resource` 取值时若有 `valueFrom` 则 `v = resource[resourceId].current × (timesResourceId ? resource[timesResourceId].current : coeff ?? 1)`，否则照旧 `Number(value)`；再按 `op` 结算、钳 [min,max]。缺 `valueFrom` 老数据零改动。
- **确定性边界**：double×double 正确舍入（跨平台一致，同 op:mul 纪律），lockstep/录放安全。极高 ante（>2^53）精度退化但**全平台同样退化**（Balatro 自身亦 naninf），不破确定性。
- **验收**：`score += chips×mult`（两资源相乘）、`chips += coeff×money`（系数×资源）、缺 valueFrom 回归不变；钳上下限；tsc + vitest + build 全绿。

---

### REQ-014 · [2026-06-08] · Lead（Game E 缺口审计后下沉）· 框架级 / 卡牌玩法 · status: **done**（2026-06-08，主程4：@skills/tier3 card-scoring）· 优先级: **P2** · 类型: 真缺口（逐张计分迭代器）

> ✅ **Lead（主程4）评审 + 落地（2026-06-08，全量 772 绿）**：
> - **复核 ACCEPT，并点破一个捷径陷阱**：起手 4 张计数小丑（Greedy/Lusty 每♦♥+3m、Scary Face 每人头+30c、Even Steven 每偶+4m）其实能用聚合计数绕过（poker-eval 已算 suitCounts，配 REQ-013 `valueFrom` 写 `mult += count(♦)×3`）。**但聚合是有漏洞的捷径**——决定性反例是 **retrigger（Hanging Chad 首张重触发2次）**：首♦被重触发时 Greedy 在那张牌上要触发 3 次（+9m），`count(♦)×3` 丢了位置身份、永远表达不了。retrigger 与逐张小丑是**乘性耦合**，不可分解为独立聚合 → 逐张迭代是**正确抽象**（且自然涵盖那 4 张计数小丑）。
> - **落库 `src/skills/tier3/card-scoring.ts`**（poker-hand 伴生件，同属 Tier3「算法/解释器型机制」）：系统 `card-score-pass`（Update，`runsAfter:['poker-eval']` 在牌型基础分之上 add；`runsBefore:['resource-apply','string-apply']`；早于 effect-apply=Commit → 逐张 +mult 先于 hand-level ×mult，对齐 Balatro「逐张计分先于独立小丑」）。
>   - 组件（入 components.ts + 注册表自动反推）：`PerCardScore{chipsResource,baseChipsByRank}`（逐张 baseChips 累加，纯数据点数表，引擎不写死）、`PerCardRule{when,op,targetResource,value}`（一条逐张小丑=一个实体，与 Effect 同构）、`PerCardRetrigger{when,extra}`（Hanging Chad/Red Seal/Mime 折叠于此）。
>   - 谓词 `PerCardWhen`：`always/suit/rankIn/index/and/or/not`——**刻意不烘焙 Balatro 常量**：人头=`rankIn[11,12,13]`、偶=`rankIn[2,4,6,8,10]`、奇=`rankIn[3,5,7,9,14]`，全数据表达（A=14 靠数据排除出"偶"，而非 `%2`）。
> - **幂等**：poker-eval 每 tick 重 set 基础分 → 本 pass 每 tick 重 add → 多 tick 持平（与现有链一致）。**确定性**：卡序由 PlayedHand.cards 定；规则/重触发按实体 id 排序（同 effect-apply eid tie-break）；纯整数/IEEE 加乘。
> - **接进 game-e**：牌桌挂 `PerCardScore`（chips = 牌型基础 + Σ每张牌 baseChips），6 个既有计分测全部按逐张 baseChips 重算（手工推导）。+18 能力单测（谓词/baseChips/逐张小丑/retrigger 乘性耦合/与 poker-eval 幂等）+2 game-e 真引擎涌现测（Greedy 5♦→+15m→126×69=8694；Hanging Chad×Greedy 首♦重触发→Greedy 7 次+21m→130×87=11310，证聚合表达不了的耦合）。
> - **未做（YAGNI，留后续）**：把起手 14 张的 on_card_scored 小丑全量接进默认蓝图（会扰动 6 个既有测的算术）；逐张 `S_card_scored` 信号广播给 condition/effect（当前内联结算已覆盖证实需求，相位模型下逐张喂外部 condition 是反模式，暂不做）。

**标题**：`@skills/tier3` 逐张计分 pass —— poker-hand 的伴生件：按序走每张计分牌、透出逐张上下文、累加 baseChips、支持 retrigger

- **背景**：Balatro「On Scored」逐张小丑（Greedy 每张♦+3m、Scary Face 每张人头+30c、Even Steven 每张偶+4m、Hanging Chad 首张重触发）+ **核心的逐张 baseChips 累加**（chips = 牌型 base + Σ每张牌 chips）。我落地的 REQ-011 是**最小评估器**，只出牌型 + base，**不做逐张迭代**。
- **Lead 评审**：**回不掉**——Condition→Event→Effect 是反应式布尔，迭代有序子集合 + 逐元素绑定上下文它做不到，正是 match3-board/poker-hand 那类「算法/解释器型机制」。尺子：逐张规则 `{trigger:on_card_scored, when:{card_suit:♦}, op:add, value:3}` 最弱 LLM 能产；**迭代是算法（引擎）、逐张规则是数据**。→ ACCEPT，作 poker-hand 的 Tier3 伴生 capability。
- **内容**：出牌时按序遍历每张计分牌 → 累加该牌 baseChips；把「当前牌花色/点数/人头/奇偶/序号」**确定性地透出给现有 condition/effect**（设计难点，要细写：用瞬态 current-card 变量喂条件）；发 `S_card_scored` 信号；支持 `retrigger`（perCard 重复次数，把 Hanging Chad/Red Seal/Mime 折叠进来）。
- **确定性边界**：纯整数/枚举遍历，牌序确定（PlayedHand.cards 有序），不碰浮点超越函数。
- **依赖**：建在 REQ-011 之上；与 REQ-013 合用即可点亮起手 14 张中剩余的逐张/动态小丑。
- **验收**：逐张 baseChips 累加 + 按花色/点数/人头/奇偶逐张触发 + retrigger 重复结算的确定性测试；tsc + vitest + build 全绿。

---

### REQ-015 · [2026-06-08] · 并行 session（coop-vs-Boss MVP 设计稿）· status: **wontfix（已被现有能力覆盖）** · 类型: Lead 对账 / 去重

**标题**：`pattern-score` 新能力提案 —— 回驳，与已落地 `poker-hand`（REQ-011）功能等价

- **背景**：`docs/game-design/balatro-coop-vs-boss.md` 把 `pattern-score`（"对一组牌的花色/点数多重集求值 → 命中最高优先级牌型 → 产 chips/mult"）列为"唯一核心新能力"。但这与周期表已落地的 `poker-hand`（REQ-011）**功能等价**；该提案大概率写于 REQ-011 落地同期、未及对账。
- **Lead 裁决（manifesto §4：已被现有能力覆盖 → 回驳，给等价数据写法）**：
  - 等价映射：提案 `patterns:[{name,when:"5 same suit",chips,mult}]` = `poker-hand` 的 `rankingTable:{flush:{chips,mult}}` + 引擎内置牌型求值器；"命中最高优先级" = `poker-hand` 优先链；"产 ScorePacket" = `poker-eval` 写 chips/mult Resource。
  - **且 `poker-hand` 是更优设计**：牌型判定**固定内置**（12 型 + rankMaxCount/pairCount/isStraight/isFlush 派生原语供 condition 组合"含某型"），**不需要**提案里 `when:"3 of a kind + pair"` 那种**字符串谓词 DSL**（要写解析器 = 逼近自由代码，违纲领）。
  - 结论：**不另立 `pattern-score`**。coop-vs-Boss 的认牌型直接挂 `poker-hand`（REQ-011），牌型表即数据。若将来出现**非扑克**牌面图案需求（如"凑和=15"），再单独评估——当前 YAGNI。
- **顺带对账**（同文档另两项）：
  - `reduce-chain`（顺序敏感小丑 / 有序累加器折叠）：扁平+有序+乘法主流情形**已被 REQ-012（`Effect.order`）+ REQ-013（`valueFrom`）覆盖**。仅"队列小丑/流经站数"这类**跨结算累积状态**是残差，**MVP 缓做**（与文档自评一致）。
  - `card-pile`（牌库/抽弃/确定性洗牌）：与 REQ-014 备注同——**先验证 random+spawn+state+zone 重组**，别扭再下沉小助手，不预先提单（YAGNI）。

---

### BUG-001 · [2026-06-08] · PE（Game E 试玩复现）· 引擎 card-scoring（REQ-014）· status: **done**（2026-06-08，主程4）· 优先级: **P1（算分错误）**

> ✅ **修复（主程4，按 PE 建议补丁，全绿）**：`poker-hand.ts` 新增导出纯函数 `scoringCardIndices(cards)`（全员计分牌型→全部；计数型→点数计数≥2 的牌；高牌→最高单张）；`card-score-pass` 改为只遍历计分牌（`scoringCardIndices` 过滤），且 `index` 改为**计分序位置**（首张计分牌=pos0，对齐 Balatro retrigger/逐张语义）。**严守 PE 注意点**：`PlayedHand.cards` 保留全部出牌不删（poker-eval 判型 + Half Joker 按张数判数仍准）；只在「加 baseChips/触发逐张规则」时过滤。逐张小丑（Greedy 等）现只在计分牌触发。已重算 card-scoring/joker-wiring/game-e 受影响断言为 Balatro 语义 + 加 BUG-001 回归测（垫牌不计、高牌只计最高单张、对子只计两张）+ poker-hand 加 9 条 scoringCardIndices 直测。tsc+vitest+build 全绿。

**标题**：逐张计分把**全部出牌**都加 baseChips，应只算「计分牌」（垫牌 kicker 不计分）

- **现象（算分错误）**：出一手「对子 K,K + 垫牌 2,5,9」，引擎把 5 张牌的 baseChips 全加了（K10+K10+2+5+9=36）。Balatro 规则：**只有构成牌型的牌计分**，对子只算两张 K（+20），垫牌 2/5/9 不加筹码。→ 当前 chips 偏高。
- **最小复现**：`buildGameEBlueprint`，`PlayedHand.cards=[K♠,K♣,2♠,5♥,9♦]`，scoring=true，tick；读 `chips`。实测含全 5 张逐张分（36），应为只两张 K（20）。同理三条只算 3 张、高牌只算最高单张、两对/四条只算成对的；同花/顺子/葫芦/同花顺/五条/同花葫芦/同花五=全 5 张计分。
- **根因**：`src/skills/tier3/card-scoring.ts` 的 `card-score-pass` 循环 `for (index of played.cards)` 遍历**全部**出牌累加 baseChips + 触发逐张规则（`PerCardRule`），未区分计分牌。`evaluateHand` 也未返回计分牌集。逐张小丑（Greedy「每张计分♦…」等）按 Balatro 也**只该在计分牌上触发**，同此根因。
- **建议补丁（已在 PE 侧验证逻辑，纯函数，确定性）**：在 `poker-hand.ts` 加导出
  ```ts
  // 计分牌下标：同花/顺/葫芦/同花顺/五条/同花葫芦/同花五→全部；高牌→最高单张；
  // 对子/两对/三条/四条→点数计数≥2 的那些牌（垫牌排除）。
  export function scoringCardIndices(cards: readonly Card[]): number[] { /* 见下 */ }
  ```
  在 `card-score-pass` 内 `const scoring = new Set(scoringCardIndices(played.cards));`，循环首行 `if (!scoring.has(index)) continue;`（baseChips + 逐张规则都跳过非计分牌）。
- **注意（实现者）**：① `PlayedHand.cards` 仍须保留**全部出牌**（poker-eval 判型、Half Joker「≤3 张」判数都依赖真实张数）——只在「加 baseChips/触发逐张规则」时按 scoring 过滤，**不要**在装配层预删牌（会让 Half Joker 等按张数的小丑误判，PE 已踩坑验证）。② 会改动 `card-scoring.test.ts` 现有用合成小牌集的断言（它们假定全牌计分，非 Balatro 语义）——需把那些用例的牌改成「全员计分的手牌」（如用 `[5,5]` 对子代替 `[5,7]`）并重算期望，保持 retrigger/逐张机制测试意图。

---

### BUG-002 · [2026-06-08] · PE（Game E 试玩复现）· `src/game-e.tsx`（游戏表现层）· status: **open** · 优先级: **P2（缺玩法）**

**标题**：缺「弃牌」操作 —— 选牌后无法弃掉换新牌（`discards_left` 资源已存在但无入口）

- **现象**：Game E 只有「出牌 / 新一局」，**没有弃牌按钮**。玩家想弃掉烂牌换新（Balatro 核心操作）做不到。蓝图已有 `R_DISCARDS_LEFT`（discards_left=3）资源，但 UI 无入口、引擎无消耗路径。
- **建议补丁（游戏层薄表现，与 play 同款）**：在 `game-e.tsx` 加 `discard()`：选中≥1 张且 `discards_left>0` 时 →（输入层）`discards_left -= 1`、移除选中牌、`drawTo` 补到 8 张、**不开 scoring/不耗 hands_left/不计分**；加「♻ 弃牌（n）」按钮 + HUD 显示弃牌次数。PE 已实现过一版可直接参考（约 15 行）。
- 备注：与 BUG-001 无关，可独立修。

---

### 备注 · #3（已知设计项，非本批）：开局不应自带小丑

- Balatro：开局**无小丑**，打过盲注后进商店/卡包选奖励才获得。当前 `game-e.tsx` / 蓝图把全 14 张 `STARTER_JOKERS` 派生进场 → 既不符设定，也是「分数看起来爆表」的主因（×3/×2/Banner+90/Scary+60 等常驻）。
- **主程4 备注**：引擎机制 `buildJokerEntities` 本身正确（数据驱动派生）；"开局全 14 张"只是 `game-e.tsx` 的演示装配选择。**PE 改 `game-e.tsx` 的 `buildGameEBlueprint(buildJokerEntities(STARTER_JOKERS))` → 开局传空/curated，打盲注后再装配** 即可（game-e.tsx 是 PE 域，主程4 不动）。

---

> 🔎 **主程4 引擎层 bug 审计（2026-06-08，独立于 PE 提单）** —— 自动审计 + 人工核实，确认以下引擎/能力层真 bug。均为 Lead 域；**因 PE 正并行改 game-e，避免冲突，先登记给 owner 排期，授权后再修**。

### BUG-003 · [2026-06-08] · 主程4（引擎审计）· 引擎 World.consume + tier1 lifetime/animation · status: **done**（2026-06-08，主程4）· 优先级: **P1（静默丢事件）**

> ✅ **修复（生产者自清模式，仿 event-when 清 Signal）**：`timer-advance` 每拍起先移除上拍 TimerDone；`lifetime`/`animation` 由 `consumes:['TimerDone']` 改 `reads:['TimerDone']` → 同一 TimerDone 可被多消费者共读、不再被先跑者全局删光。`life` 计时 + 动画帧计时同拍触发时 DestroyRequest 与帧推进**并存**（回归测 `timer-consume.test.ts` 钉死）。一拍生命周期不变（次拍 timer-advance 自清，不重复推进）。**未改 World.consume 引擎契约**（最小改动）；"禁止同组件多系统 consume 的校验"留 follow-up。

**标题**：`TimerDone` 被 `lifetime` 与 `animation` 两系统同时 `consumes` —— 全局消费导致 animation 饿死丢帧

- **根因（已核实）**：`World.tick`（`src/engine/core/world.ts:93-100`）的 consume 是"每个系统执行后从**所有实体**删除该组件类型"（全局）。`TimerDone` 同时被 `lifetime`（`tier1/lifetime.ts:21`）和 `animation`（`tier1/animation.ts:17`）声明 consume，二者同 Update 相位、无定序边，注册序 lifetime 在前 → lifetime 先跑并**全局删光** TimerDone → animation 看不到。
- **后果**：同一 tick 内只要有 `life` 计时器到点 + 有动画帧计时器到点，**精灵帧停止推进**（静默，非崩溃）。Game D（投射物 life + anim-state 动画并存）会触发。两端同样丢失 → 不致 desync，但行为错误。
- **修复方向（待授权）**：consume 语义改为"读到即消费"（按系统实际触及实体），或 TimerDone 由 `timer` 在每 tick 起清（仿 event-when 清 Signal），消费方改 `reads`。会动 animation/lifetime 的 consume 测试。**建议同时在 assembly 校验层禁止"同一组件被多系统 consume"**（根除同类隐患）。

### BUG-004 · [2026-06-08] · 主程4（引擎审计）· 引擎 tier2 mortal · status: **done**（2026-06-08，主程4）· 优先级: **P2（实体泄漏）**

> ✅ **修复（在 prefab 侧精准回收，解耦无误删）**：`prefab-spawn` 展开后，若持 SpawnRequest 的实体**仅此一个组件**（`comps.size===1`，即 mortal 的 `drop:<id>` 专用载体）→ `destroyEntity` 回收；caster 等把 SpawnRequest 挂在持久实体（组件数 >1）→ 不动，仅其 SpawnRequest 照常被 consume。根除空实体泄漏 + id 复用抛错，且不误删施法者。回归测 `prefab.test.ts`（载体销毁 / 持久实体保留）。

**标题**：死亡掉落载体实体 `drop:<id>` 永不回收（长局/刷怪无界增长 + id 复用可抛错）

- **根因**：`tier2/mortal.ts` 死亡时 `createEntity('drop:'+id)` 挂 `SpawnRequest`；`prefab` 只消费 SpawnRequest（删组件）**不销毁载体**，空实体永久残留。若 id 回收复用且同名实体再死，`createEntity('drop:'+id)` 因已存在抛错（`world.ts:15`）。
- **后果**：每个带 `dropTemplate` 的怪死亡泄漏一个空实体（进 snapshot/hash 拖慢）；极端下抛错中断 tick。
- **修复方向**：prefab 展开后销毁载体实体，或载体加 `life=1` 自销毁 Timer。

### BUG-005 · [2026-06-08] · 主程4（引擎审计）· 引擎 atoms spatial-query + tier1 tween · status: **done**（2026-06-08，主程4）· 优先级: **P3（确定性脆弱 / 数据健壮性）**

> ✅ **修复**：① `queryNearest` 排序加 id 升序 tie-break（与 `nearestByTag` 一致）→ 等距时不依赖构建/遍历序，两端构建序不同也选同一组，lockstep 不分叉。② `tween` `duration<=0` 即时到终值+done+移除，绝不进入"每帧到点→pingpong 交换"的抖动死循环。各加回归测。

- **spatial-query `queryNearest`**（`atoms/spatial-query/index.ts:62`）：距离相等时 `sort((a,b)=>a.d2-b.d2)` 无 id tie-break，依赖数组（=query 插入）序 + sort 稳定性。同端录放安全，但两端构建序不同（rejoin/快照恢复后追加实体）可能选出不同实体 → **潜在 desync**。同文件 `nearestByTag` 已正确做 id tie-break，**此处不一致**，建议补齐。
- **tween `duration<=0` 配无限 loop**（`tier1/tween.ts`）：`elapsed>=duration` 恒真，pingpong 每帧抖动、永不收敛（仅表现层，不进 hash）。建议 `duration<=0` 时忽略 loop 或校验层拒绝。

> 确定性总体判断（审计结论）：**地基可信**——模拟内随机=确定 PRNG(mulberry32 纯整数)、超越函数(sin/cos)被刻意排除只用 Math.sqrt(IEEE 跨端一致)、Date.now/Math.random 仅在 net 传输层不进模拟、快照按值 structuredClone、拓扑排序 Kahn 稳定。唯一真威胁是上述 consume 契约(BUG-003)与 queryNearest tie-break(BUG-005)。
- 改法（数据级）：`buildGameEBlueprint(buildJokerEntities([]))` 开局空小丑；小丑改由「过盲注 → 商店 craft-recipe 购买 → 派生实体」获得。**待 #1/#2 后做**（用户已排序）。

---

### REQ-016 · [2026-06-08] · PE（合作 vs Boss 联机评审）· 框架级 / 卡牌玩法 · status: **done（重组，无新组件 + card-play 接缝）**（2026-06-08，主程4）· 优先级: **P2** · 类型: 数据契约扩展（非新能力）

> ✅ **主程4 评审 + 落地（过 manifesto 尺子）**：**回驳新 Beat/Resonance 组件——共鸣读侧是纯重组**：每玩家牌型 = 各自 `PokerHand.handTypeVar`（写两份 StringVar `ht_p1`/`ht_p2`，已支持）；跨玩家共鸣 = `condition`(and(string ht_p1=flush, string ht_p2=straight)) + `event-when` + `effect`(boss_hp 全局路由)。**零新 system / 零新组件**。已在 `src/net/coop-cards.test.ts` 真 lockstep 双 peer 证明涌现（共鸣命中 boss 额外 -500、未命中不触发）。
> **唯一真引擎缺口（已补）= 确定性「出牌」输入**：`RawInputData` 加 `values?:number[]`（结构化载荷，承载牌码 suit*100+rank）；新通用能力 `@skills/tier2/card-play`（命令流→按 `PlayedHand.owner` 路由各玩家出牌 + 置 scoring Flag，reset-then-apply，可 lockstep）。**「本拍共振目标」的每拍随机生成属回合流程（REQ-017）装配**，不在此另立组件。

**标题**：「本拍上下文」暴露给 condition —— `Beat{resonantType}` / `Resonance{p1Type,p2Type}`（共鸣/接力小丑底座）

- **背景**：合作 vs Boss 的「共振/接力」小丑要读**本拍跨玩家信息**——"队友这拍打了同花 → 我 ×2"、"本拍共振目标=顺子，两人互补命中 → 暴击"。现有 `condition` 只能按 id 读 resource/flag/state/string，**读不到「双方这拍各打了什么牌型 + 当前共享共振目标」**。
- **PE 评审（过 manifesto 尺子）**：这是 **数据契约扩展，不是新 Tier3 能力**。poker-eval（REQ-011）已会写「单方牌型名」到 StringVar；只需扩成：① 按玩家写各自这拍牌型（`p1Type/p2Type`，或多份 StringVar/Resource 按 playerId 路由）；② 一个「本拍共振目标」资源/StringVar（由种子 RNG 每拍翻）。共振/接力小丑 = `condition 读这些 + effect 全局路由`，纯数据组合，零新 system。设计稿 `balatro-coop-flow.md` §2/红线①、`balatro-coop-vs-boss.md` §4.6 均已点名此为「唯一引擎小契约」。
- **建议形态**：`Beat{ resonantType: string }`（单例，种子翻）+ 双方牌型暴露（复用 poker-eval 的 handTypeVar，按 playerId 写两份 StringVar，如 `hand_type_p1`/`hand_type_p2`）。condition 的 `string` 叶子即可读。**不必新组件也行**——纯靠"按 playerId 命名的 StringVar/Resource + 现有 condition"重组；`Beat/Resonance` 只是给个语义壳，二选一。
- **依赖/不阻塞**：单人 MVP 不需要；做联机/共鸣才需。建议与 REQ-017 一起排。

---

### REQ-017 · [2026-06-08] · PE（单人数据驱动化 + 联机共同前置）· 框架级 / 卡牌玩法 · status: **done（引擎侧全交付；game-e.tsx 改写归 PE）**（2026-06-09，主程4）· 优先级: **P1（单人/联机共同地基）** · 类型: 回合流程下沉为数据状态机

> ✅ **主程4 引擎侧落地（848 绿，不碰 game-e.tsx）**——回合流程"下沉 sim"的引擎缺口全补齐，并证明流程本体是纯数据装配：
> - **真缺口 1 = 牌库/手牌进 sim**：新 `@skills/tier2/card-pile`（牌库/手牌确定性管理：发牌→按手牌**下标**出牌/弃牌→自动补手）。让"发牌→选→出/弃→补"全进 sim（不再活 React）→ 单人数据化 + lockstep 双端同序。+7 单测。（与 card-play 分工：card-play=直接喂牌码无牌库；card-pile=带牌库的完整出牌管理。重叠面待 rule-of-three 复核，见 `tier3-skill-governance.md`。）
> - **真缺口 2 = 动态阈值条件**：condition 的 resource 叶子加 `vsResource?`（与另一资源比，如 `round_score≥blind`，盲注随 ante 变是静态值表达不了的）。是 REQ-013 valueFrom 在"条件读侧"的对称扩展。+1 测。
> - **回合状态机本体 = 纯重组（零新能力，已证）**：`State{fsmId:'round'}` + `event-when(condition)` + `effect set-state` 表达 playing→won/lost 转移；`gate_commit(edge)` 累加 round_score/递减 hands_left。`round-flow.test.ts` 端到端证明：card-pile 发牌→下标出同花→poker/card-scoring 计分→round_score 累加→State 转 won；hands 耗尽→转 lost。**全数据装配、零 game-e.tsx、零新 FSM/phase-sequencer 能力（YAGNI 确认）。**
> 🟡 **剩余归 PE**：把 game-e.tsx 回合流程改写成上述数据状态机（State+condition+effect+card-pile），删命令式手写逻辑。**做完即"加第二组 owner 牌桌+第二路命令"=联机**（coop-cards.test 已坐实）。

**标题**：把「回合/拍流程」从 React 命令式下沉成 **sim 内数据状态机**（State + event-when + effect），走统一输入

- **现状（债）**：`src/game-e.tsx` 现在用 **React 命令式驱动**引擎（点按钮 → UI 手动 `world.tick()` + 直接读写 Resource）。能跑单人，但：① 回合流程（发牌→选→出/弃→结算→过线→商店→下一道）是**手写 UI 逻辑**，非数据（违 manifesto，UI 应只是薄层）；② **无法 lockstep 联机**——联机必须「收齐两端输入→同一拍 tick→双端同 hash」，命令式驱动做不到。
- **PE 评审**：设计稿 §五已给出目标形态——回合流程 = `State{fsmId:'round'}` + `event-when`(条件转移) + `effect`(set-state/改资源) 的**数据状态机**，输入经统一输入层（clickable/keybind/lockstep 队列）进来。**先判定能否纯重组**：转移条件（round_score≥线、hands≤0…）= condition 现成；发牌/补牌 = random+spawn/数据；选牌 = clickable。**大概率纯数据装配，零新能力**；若「多步异步流程编排」确有表达不了的点（如倒计时相位、同时锁定），再评估下沉一个通用 `phase-sequencer`/`turn` 小能力（先别预设，按 YAGNI 装配时再看）。
- **一鱼两吃**：这块是**单人「数据驱动化」与联机的共同前置**——流程进了 sim 后，联机 = 「加第二组玩家实体 + 接第二路 lockstep 输入」，不重写。**做这一条，单人更纯 + 联机水到渠成。**
- **同时收编**：把现有 game-e.tsx 里手写的「逐张计分演出/动效」也纳入讨论——理想是引擎吐一条**逐步计分 trace（事件流）**供 UI 回放（或下沉通用 tween/演出表现能力），UI 不再自己重建计分序。（用户已同意「先手写、回头数据驱动化」，此条登记该讨论。）

---

### REQ-018 · [2026-06-08] · PE（联机评审）· 框架级 / 基础设施 · status: **open** · 优先级: **P3（真·远程对战才需，最后做）** · 类型: 网络传输层（infra）

**标题**：真·跨设备远程传输 + 延迟处理（现 lockstep 仿真核已就绪，只差传输/缓冲）

- **现状（核实 `src/net/`）**：确定性 **lockstep 仿真核已落地**（`FixedStepClock` 定步长 + 命令排序 + `hashSnapshot` 双端校验 + 输入队列 + `LockstepSession`）。**传输层只有 `lockstep-tab.ts`（BroadcastChannel，同机两标签）** + `mp-client.ts`；**没有真·互联网传输（WebSocket/WebRTC 信令）**。
- **缺什么**：① **传输**：WS/WebRTC 信令 + 帧/命令收发（把 BroadcastChannel 换成可跨设备的 channel，复用现有 LockstepSession 接口）；② **延迟处理**：lockstep「收齐两端才推进」遇网络延迟会卡 → 需 **输入延迟缓冲（input-delay）** 或回滚（rollback），目前是无延迟同机模型。
- **PE 评审**：这是 **基础设施，与游戏数据驱动设计正交**——不缺 game skill。**同机/两标签先验证完全够**（hashSnapshot 双端同步是真的），真·远程对战才提上日程。建议**排在最后**：先单人 MVP（REQ-017）→ 同机两标签验共鸣（现成）→ 调参好玩 → 才做远程传输。
- **确定性已安全**：卡牌计分是整数+乘法，不碰 REQ-010 的浮点跨架构问题（那只关 steering/sqrt）→ **卡牌 co-op 即使跨平台也确定**，传输层补上即可。
- ✅ **主程4 进展**：2 人 lockstep coop 卡牌**确定性已在 `src/net/coop-cards.test.ts` 坐实**（两 peer 同 hash + 共享 boss + 共鸣，全经现成 `LockstepSession`）。**只差本条传输层**（同机两标签 `lockstep-tab.ts` 已可用）；真远程仍 P3 最后做。

---

### REQ-019 · [2026-06-08] · PE（去代码化 #10）· 框架级 / 卡牌玩法 · status: **done（引擎部分；UI 回放归 PE）**（2026-06-08，主程4）· 优先级: **P1（去代码化关键：消解 game-e.tsx 手算计分演出）** · 类型: 真缺口（小钩子：计分链输出逐步 trace）

> ✅ **引擎部分落地（主程4，按自评 4 条红线，838 绿）**：
> - 组件 `ScoreTrace{events:ScoreEvent[]}`（通用，`phase` 自由 string）+ 共享 helper `src/skills/score-trace.ts`（`clearScoreTrace`/`appendScoreEvent`，**opt-in**：无 ScoreTrace 单例则全 no-op）。
> - 三系统按真实执行序 append：`poker-eval`（首系统清空 + 记 `base` set chips/mult，source=牌型名）；`card-score-pass`（每计分牌 `percard` source=`card:<下标>`、命中逐张小丑 `percard-rule` source=规则实体 id）；`effect-apply`（**仅 modify-resource** 记 `effect`，source=Effect 实体 id；含 combine）。每条记本步 `after`（钳后真值）。
> - **排除出 hashSnapshot**（determinism.ts NON_DETERMINISTIC 加 `ScoreTrace`，同 Camera）→ lockstep 不受影响。每拍由 poker-eval 单点清空重建（不累积）。
> - 测试 `score-trace.test.ts`：顺序 seq 连续 / 各 target 末步 after==资源真值 / source 语义 / opt-in 无 trace 照常 / 篡改 trace 不变 hash。
> 🟡 **剩余归 PE**：`game-e.tsx` 删手算计分帧序，改读 `ScoreTrace.events` 按时间轴回放（base/percard 计数器跳+卡高亮、effect 小丑抖动、combine 大跳）。主程不碰 game-e.tsx。

> 🔎 **主程4 Lead 评审（2026-06-08）**：**ACCEPT**。过尺子核验——「逐步顺序+每步增量+每步后值」只有计分链内部知道，UI 重算就是要消解的专有代码+分叉风险 → 是引擎该补的**输出钩子**，非新 Tier3 能力（poker-eval/card-score-pass/effect-apply 各加几行 append + `ScoreTrace` 组件 + 排除出 hash）。设计稿 `game-e-score-trace.md` 方向正确。
> **实现前必加的设计红线（交给实现者，含我自己）**：
> 1. **effect-apply 是通用能力（A/B/C/D 全用）—— trace append 必须 opt-in 门控**：仅当世界存在 `ScoreTrace` 单例时才记录，否则非卡牌游戏每条 effect 都被无谓 append（开销+污染）。在 effect-apply 里 `if (!hasScoreTrace) return 原逻辑`。
> 2. **限定 modify-resource**：只记数值变更步，不记 set-flag/set-sensor 等（trace 是"计分"叙事）。
> 3. **排除出 hashSnapshot**（同 Camera 先例，确认 determinism.ts 的排除集加入 `ScoreTrace`）；每次计分起清空 events（建议由计分链首系统 poker-eval 在评估开头清，单一清空点，避免三处各清竞态）。
> 4. **phase 字段用自由 string 而非 Balatro 专属枚举**，保住"分步结算演出"对遗物/伤害分解的通用复用面。
> **归属**：引擎部分（ScoreTrace + append + 排除 hash + 单测）属主程域；UI 回放消解属 game-e.tsx(PE)。可与 REQ-017 并行。**本程仅评审，未实现**（用户指示）。

**标题**：计分链吐「逐步计分 trace」事件流 —— UI 只回放，消解手算帧序的专有代码

- **背景（去代码化）**：`game-e.tsx` 为做「逐张报分 + 小丑抖动」演出，**自己重算了一遍计分顺序/增量**（专有游戏代码 + 与引擎结果分叉风险）。正确做法：**引擎是唯一真相**，它本就按确定顺序逐步改 chips/mult，把每步**记下来**给 UI 回放即可。详设计稿 `docs/game-design/game-e-score-trace.md`。
- **PE 评审（重组 vs 缺口）**：重组不够——「逐步顺序 + 每步增量 + 每步后值」只有计分链自己知道，UI 重算就是要消解的代码。故是**引擎该补的输出**；但**不是新 Tier3 能力**，是给已有 `poker-eval`/`card-score-pass`/`effect-apply` 各加几行 append + 一个 `ScoreTrace` 组件。**通用**：任何「分步结算要演出」的玩法（遗物结算/伤害分解）可复用。
- **建议形态**：`ScoreTrace{ events: ScoreEvent[] }` 挂牌桌单例，计分开头清空；三系统按真实执行序 append `ScoreEvent{ seq, phase, target, op, value, chips, mult, cardIndex?, jokerId?, source? }`（记本步后 chips/mult）。**排除出 hashSnapshot**（表现输出，同 Camera 先例）。单测：trace 末条 == 资源真值；顺序确定。
- **收益**：game-e.tsx 删掉计分帧序逻辑，改「读 ScoreTrace.events 按时间轴回放」——演出触发点全来自数据，换规则/加小丑 trace 自动变、UI 不改。**这是 #10 那条唯一真缺口；其余去代码化项（#1–9）归 REQ-017。**
- **依赖**：可与 REQ-017 并行（独立于流程下沉）；建议紧随其后，让 game-e.tsx 一次性退化为零逻辑薄壳。

---

### REQ-020 · [2026-06-09] · 用户（宪法澄清：流程脚本化）· 框架级 · status: **done**（2026-06-09，主程4）· 优先级: **P1（流程可创作性 / 跨所有游戏）** · 类型: 声明式状态机解释器（DSL，非自由代码）

> **用户提案**：游戏流程千差万别、难全拆散件数据；可接受 LLM 为状态流转写"脚本"——前提足够简单、像数据、线性瀑布。
> **Lead 裁决（ACCEPT，钉死"脚本"=声明式状态机非自由代码）**：见 `docs/design/tier3-skill-governance.md` §4.5（宪法澄清）。要点：① 能接受闭语法声明式状态机（when 复用 ConditionExpr、do 复用 Effect 动词子集），不接受自由代码字符串（不变量②红线）；② 它是 dialogue 的同构，受祝福；③ **治理判据补充：散件能重组但最弱 LLM 难一致产出 → 建"收敛解释器"是正当理由**（加的不是表达力，是可创作性=不变量②本体）。
> ✅ **落地（855 绿，不碰 game-e.tsx）**：
> - `@skills/tier3/flow`：解释器读 `GameFlow{id,current,states:[{id,onEnter:FlowAction[],transitions:[{when:ConditionExpr,to,do:FlowAction[]}]}]}` → onEnter(edge) + 按声明序求值转移(首个 when 成立即跳)。FlowAction 动词 = set-flag/set-state/modify-resource(add|set)。确定性、entered 进 snapshot。
> - ConditionExpr 加 `always` 叶子（线性瀑布转移）。
> - 组件 GameFlow/FlowState/FlowTransition/FlowAction 入 protocol，注册表自动反推。
> - `flow.test.ts`(+7)：回合 won/lost 分支**收成一份 GameFlow**（消解 ~10 个散件 EventWhen/Effect）、线性瀑布 deal→select→play、onEnter 边沿只跑一次、流程间 set-state 联动、确定性。
> - **跨所有游戏复用**（A 通关/失败、B 场景流、C 回合、D 波次、E ante→盲注→商店），非品类专属。
> 🟡 **后续（归 PE / 后续程）**：game-e.tsx 回合流程改用一份 GameFlow（替代命令式 + 替代我 round-flow.test 里的散件 gate/effect）；与 card-pile + 计分链 + ScoreTrace 合龙成纯数据单人 MVP。

**标题**：声明式「游戏流程状态机」解释器 —— 流程 = 一份 GameFlow 数据（读如线性瀑布脚本，本质数据）

---

> 🎮 **Game F（自走棋 auto-chess）三缺口 —— 主程4 抽象成引擎通用能力 + 逐条评审（2026-06-09）**。
> 共同根：前 5 个游戏的逻辑链只碰**全局单例**（按 id 路由）；自走棋是第一个压满「**实体寻址轴**」的品类——self（实体本地）/ set-读（集合计数）/ set-写（集合施效）。三条都**抽象成跨游戏能力**，非自走棋私货。

### REQ-021 · [2026-06-09] · 主程4（Game F 拉动，抽象为引擎级）· 框架级 · status: **done**（2026-06-09，主程4）· 优先级: **高（Phase2 阻塞；最普适）** · 类型: 真缺口（逻辑链「实体本地 self」作用域）

> ✅ **落地（主程4，872 绿）**：`@skills/tier2/self-rule`——`SelfRule{when,do,once?}`：遍历挂 SelfRule 的实体，对**每个实体用其自身组件**求 when（`evaluateSelfCondition` 镜像全局条件树但读 self 组件、id 可选校验）、对**自身**施 do（set-flag/modify-resource/set-state/destroy）。once=上升沿一次（armed 迟滞），缺省 level。**通用化 mortal/over-time**。确定性：每实体只读写自身 → 跨实体无干扰、与遍历序无关（确定性测证反序创建同结果）。+5 测。引擎"实体寻址轴"的 **self 端**已补。

**标题**：Condition→Effect 增「**实体本地(self)**」作用域 —— 对每个实体「读自身条件→对自身施效」，数据驱动

- **想实现的游戏行为**：自走棋每个单位**自治**——"我 HP≤0 → 我死亡掉落"、"我获 buff → 我 +攻"、"我血<30% → 我狂暴"。单位是 prefab 动态展开的**多实体**，同模板。
- **已试（确认组合不出）**：`mortal`(自身资源≤阈值→destroy 自身)、`over-time`(自身限时效果)、`steering` 都是 self-scoped，**证明 self pattern 存在但各自硬编码**（mortal 只做死亡）。无**通用**"对每个实体：读自身组件求条件→对自身施动作"的数据规则。
- **卡在哪 / 缺什么**：`event-when` 的 condition 按**全局 id** 读（`lookup.resource(id)` 找持有该 id 的**单例**）；`effect` 按全局 id 写。**没有 self 作用域**。唯一 id **烘不进共享单位模板**（prefab 展开的 100 个单位用同一份数据，没法各带唯一 id 的全局 condition/effect）→ 全局链表达不了"动态多实体各自治"。**这是真缺口**（mortal 是它的死亡特例）。
- **建议方案**：通用 self 规则——`SelfRule{ when:SelfCondition, do:FlowAction[], once? }`：系统遍历挂 SelfRule 的实体，对**每个实体用其自身组件**求值 when、对**自身**施 do（复用 FlowAction 动词 + condition 叶子，但作用域=self 实体而非全局 id）。mortal/over-time 是其特例。
- **Lead 裁决（主程4）：ACCEPT·开发**。最普适——所有"实体自治"品类受益。**抽象层级 = 给逻辑链加 self 寻址轴**（不是自走棋专属规则）。
- **跨游戏用例**：弹幕敌群（每敌自身 AI/死亡）、塔防（每塔自身冷却/索敌）、RTS、组队 RPG（每成员自身 buff/狂暴线）、Game D 怪物自治。

### REQ-022 · [2026-06-09] · 主程4（Game F 拉动，抽象为引擎级）· 框架级 · status: **done**（2026-06-10，Lead，裁剪后落地）· 优先级: **中（Phase3 羁绊）** · 类型: 真缺口（集合读：按 Tag/归属计数 + 越阈值信号）

> ✅ **落地（2026-06-10，Lead，889 绿）**：`@skills/tier2/group-count`——`GroupCount{countResource, requiredTag?}`：按 Tag 掩码数全场实体，每 tick **set** 进 Resource（钳 [min,max]）。多 counter 共享一次遍历；`runsBefore:['resource-apply']` 按库内惯例破 RMW 伪环；写 Resource → 拓扑自动先于 event-when（同 tick 出阈值信号）。+9 测试（含重组证明）。
> **对原案的两处裁剪（manifesto §4 先重组，测试为证）**：
> 1. **`thresholds:[{at,signal}]` 回驳**——「越阈值锁存发信号（迟滞）」= `event-when{kind:'resource',cmp,mode:'edge'}` 已有的 armed 语义；多档阈值（3/6/9 羁绊）=多个 EventWhen 实体。集成测试「羁绊阈值信号 = event-when(edge) 重组」钉死：跨线触发一次、持续不重复、跌破复位、再跨再触发。
> 2. **`owner` 过滤字段回驳**——requiredTag 取「含齐」(ALL-bits，与 Status.requireMask 同款) 后，归属=再加一个 Tag bit（`P1_BIT|WARRIOR_BIT`=「P1 的战士」），无需第二个过滤维度。
> 用法（羁绊）：`GroupCount{countResource:"warrior_count",requiredTag:WARRIOR}` + `EventWhen{when:{kind:"resource",id:"warrior_count",cmp:"gte",value:3},mode:"edge",signal:"synergy_warrior"}` + Effect/craft-recipe 按名消费。

**标题**：`group-count` —— 对一组实体按 Tag/归属**计数** → 写 count 资源 + 越阈值发信号

- **想实现的游戏行为**：羁绊——"场上 ≥3 个'战士' → 触发战士羁绊"；波次"敌人数→0 → 过关"；"人口数 → 难度档"。
- **已试**：`spatial-query` 能数范围内实体；`zone-occupancy` 能"区域内有/几个占用"。但 `Zone` 是**空间+布尔**（占用/空），表达不了"**按归属(owner/tag) 计数 → 写成数值资源 → 越阈值锁存发信号**"。
- **卡在哪**：无"对一组实体按 Tag/owner **计数**（集合读）→ count 资源 + 阈值信号"的通用能力。
- **建议方案**：`group-count` capability——`GroupCount{ filter:{tag?/owner?}, countResource, thresholds?:[{at,signal}] }`：每 tick 数匹配实体写 `countResource`，跨阈值（迟滞防抖）发信号。复用 spatial-query/Tag 计数原语。
- **Lead 裁决（主程4）：ACCEPT·开发**。**抽象层级 = 通用"集合计数→数值+信号"**（非羁绊专属）。
- **重组证明**：`Zone` 空间布尔 ≠ 按归属计数+数值+锁存。**跨游戏用例**：波次清场、收集目标(集齐 N)、人口/存活数难度、阵营兵力对比。

### REQ-023 · [2026-06-09] · 主程4（Game F 拉动，抽象为引擎级）· 框架级 · status: **open（不 greenlit·倾向先重组 YAGNI）** · 优先级: 低（评估中）· 类型: 集合写（效果 fan-out 到一组实体）

**标题**：`group-effect` —— 把效果 fan-out 到一组实体（集合写）

- **想实现的游戏行为**：羁绊光环——"3 战士羁绊 → 所有战士 +10 攻"。
- **建议方案**：`group-effect`：`GroupEffect{ filter, action }` 把 action 施给每个匹配实体。
- **Lead 裁决（主程4）：不 greenlit·倾向先重组（YAGNI）**。多数逐单位羁绊光环可用 **REQ-022 group-count（数羁绊层数）→ 写一个全局 buff 资源 → 各单位 stat/hitbox 读该全局 buff（已有全局 id 路由）** 重组绕过——**不必逐单位 fan-out**。只有出现"各单位状态异质、必须逐个写、全局共享值表达不了"的羁绊时才下沉。**不为想象需求提前拓宽引擎。** 待真实拉动再评估。

---

### REQ-F-024 · [2026-06-10] · Programmer F（用户拉动；Game F 自走棋核心）· 框架级 · status: **done**（2026-06-10，主程4，引擎三件套；game-f 数据换层归 F）· 优先级: 高（TFT 保真核心移动）· 类型: 真缺口（六边形棋盘 + 确定性网格寻路）

> ✅ **Lead 复核 ACCEPT + 落地（主程4，925 绿）**：F 的重组证伪成立（库内确无图搜索）；宪法对齐（棋盘=数据、A*=代码）；跨游戏通用。按最小三件套实现：
> - **hex（纯算法核心）** `src/skills/tier2/hex.ts`：axial 坐标 + hexDistance + 固定 6 邻居序 + **确定性 A* `hexNextStep`**（求"走向目标相邻格的下一步"，避被占格；启发=hex 距离 admissible，open 按 fScore 升/cellKey 升 tie-break → 路径唯一确定，lockstep 安全）。+9 测（绕障/围死=null/确定性/边界）。
> - **grid-move（系统）** `src/skills/tier2/grid-move.ts`：读 Relation(target)→占位集→A* 下一格→每 GridMover.period tick 走一格→写 HexPos + 投影 Transform（精确二进制分数 1/2,3/4，跨端无漂移）。取代 steering 在网格场景。+6 测。
> - **组件**：`HexBoard{cols,rows,tileSize,origin}` / `HexPos{q,r}`（SIM 真相进 hash）/ `GridMover{period}`。SIM 态住整数 HexPos，Transform 仅投影供渲染/战斗距离（aggro/hitbox 仍读 Transform）。
> - **YAGNI**：加权代价/地形/飞行押后（未拉动）。
> 🟡 **归 F**：game-f 棋盘=一份 HexBoard 数据、站位=数据、移动 steering→grid-move（aggro/caster/hitbox/mortal/经济不变）。
> 🔧 **顺手修**：并行 session 的 group-count 漏加进 ALL_CAPABILITIES 列表（只在 import 里）→ manifest 解析不到 GroupCount；已补 groupCount + gridMove 入列表。

> **本程已证伪「能否重组」（按核心铁律，附代码依据）**：
> - `steering` 是**贪婪直线 seek**（朝 Relation(target) 到 stopRange 停，`src/skills/tier2/steering.ts:113`），**绕不开被占格/友军**。
> - `tilemap` 是**方格** + tile-collision（把动态体推出实心墙），**非六边形、无寻路**。
> - `spatial-query` 只有 nearest/range 查询，**无图搜索**；全工程 `pathfind/A*/navmesh/BFS/dijkstra` grep **全空**。
> → 现有数据/能力**真表达不了**「在六边形格上绕开单位走到目标相邻格」。**真缺口，合法下沉。**
> **宪法对齐**：棋盘布局/站位 = **数据**（最弱 LLM 能填 hex 坐标）；寻路算法 = **代码能力**（最弱 LLM 产不出 A*）→ 正确下沉为引擎通用能力。**跨游戏复用**（战棋/RTS/塔防/roguelike/自走棋），非 game-f 私货。

**标题**：六边形棋盘 + 确定性网格寻路 —— 金铲铲/TFT 式自动战斗移动

- **想实现的游戏行为**：备战在**六边形棋盘**摆子；战斗中棋子**沿六边形格寻路**走向目标——一格一单位、绕开被占格、到攻击距离停、目标移动/路被堵则**重算路径**。与金铲铲之战的棋盘与寻路一致。
- **已经试了什么**：game-f MVP-0 现用 `steering`(贪婪直线)+`collision-resolve` 近似——**能打但不是格上移动、不绕障、非六边形**，达不到金铲铲保真。
- **卡在哪 / 缺什么**：① 无六边形网格表示；② 无格占位（一格一单位）；③ 无寻路算法（图搜索）；④ 无逐格移动系统。
- **建议方案（最小三件套，交主程裁；建议先 BFS 占位版，A*/加权/地形后续）**：
  1. **hex-grid（数据 + 占位）**：`HexGrid{ cells:[轴向/立方坐标], ... }` + 每格 occupancy（一格一单位）。类比 `tilemap` 但六边形 + 占位语义。**棋盘布局/站位 = 数据**。
  2. **grid-pathfind（基本 A* 算法）**：hex 图上 **A***（启发函数 = 六边形距离 hex-distance，admissible/一致）求「到目标相邻格」的下一步，避开被占格。**确定性**：固定邻居遍历序 + 整数代价 + 确定 tie-break（fScore 相等取格 id 升序）→ lockstep/录放安全（与引擎确定性边界对齐）。用户点名：**最基本的 A***，通用、很多游戏复用。
  3. **grid-move（移动系统）**：单位按下一步**逐格移动** + 占位转移 + 到点 re-path；取代/补充 `steering` 在网格场景（aggro 仍写目标，grid-move 替 steering 算"下一格"）。
- **game-f 适配（落地后，纯数据换层）**：棋盘 = 一份 hex-grid 数据；站位 = 数据；移动 `steering`→`grid-move`；战斗结算（aggro/caster/hitbox/mortal）与经济**不变**。备战拖拽放子 = `clickable` + 占位写入（数据）。
- **YAGNI 注记**：建议主程先做**基本 A***（hex 坐标 + 占位避让 + 单位代价 + hex 距离启发 + 逐格移动），加权代价/地形/飞行/位移技能等押后真实拉动。**不为想象需求提前拓宽。**

---

### REQ-F-025 · [2026-06-10] · Programmer F（Game F 接 grid-move 暴露）· 框架级 · status: **done**（2026-06-10，主程4，采 F 1 行修复）· 优先级: 高（阻塞 game-f 接寻路）· 类型: 系统定序 bug（拓扑成环）

> ✅ **落地（主程4，926 绿）**：`grid-move` 系统加 `runsAfter:['aggro']` —— 显式边覆盖反向的 Transform 组件推断边，破 aggro↔grid-move 2-环（同 poker-eval/dialogue 显式定序先例）。语义：aggro 本拍选目标→grid-move 据此走，Transform 下拍被 aggro 读（一拍反馈，确定性不变）。+1 回归测（aggro+grid-move 同场不抛环 + 单位索敌沿 hex 寻路到相邻）。**F 可接 game-f grid-move 数据换层、推 mainbranch。**
> 🟡 **follow-up（非阻塞，主程4 记）**：更彻底可拆 `grid-move` 只写 HexPos + 另设 PostResolve 投影系统 HexPos→Transform，根除"移动写 Transform↔索敌读 Transform"环类；当前 1 行已够，待更多 Transform-环案例再做。

> **现象**：game-f 首次让 `grid-move` 与 `aggro` **同场跑** → 引擎拓扑排序抛环：
> `aggro`(reads `Transform`, writes `Relation`) ↔ `grid-move`(reads `Relation`, writes `Transform`) **互为前驱**（同 Update 相位，组件推断边成 2-环；连带 13 个系统判进同一 SCC 报错）。
> `grid-move.test` 手注 Relation、未带 aggro，故未撞上；自走棋 aggro+grid-move **必同场 → 必现**。
> **已本地确认修复（1 行；加后 game-f 3 测全过、棋子正常沿 hex A\* 寻路对冲）**：grid-move 系统加 `runsAfter: ['aggro']`
> —— 语义正确：aggro 本拍选目标 → grid-move 据此走；grid-move 写的 Transform 由 aggro **下一拍**读，打破同拍反向边。确定性不变。
> **请主程定夺落地（我不改引擎）**：
> - 最小：grid-move system 声明 `runsAfter:['aggro']`。
> - 更彻底（可选）：grid-move 只写 HexPos，另设一个 PostResolve 投影系统 HexPos→Transform，**根除**「移动写 Transform ↔ 索敌读 Transform」这类环。
> 落地后我即把 game-f 的 grid-move 数据换层（已就绪、stash 待接）接上 → 推 mainbranch。

---

### REQ-F-026 · [2026-06-10] · Programmer F（Game F 表现层暴露）· 框架级 · status: **done**（2026-06-10，Lead 评审 greenlit + 落地 `t1-hierarchy-cascade`）· 优先级: 中（表现 bug：挂件不随宿主死）· 类型: 真缺口（父体销毁 → 级联销毁 Hierarchy 子体）

> **现象（game-f bug：方块死后名字残留）**：棋子头顶名字 = 独立实体 + `Hierarchy{parentId:棋子}` 跟随。棋子被 `mortal`→`destroy-apply` 销毁后，名字实体成**孤儿**（`hierarchy-resolve` 见父无 Transform → skip，留原地）→ **死了的方块名字残留屏幕**。
> **通用性**：任何"挂件"（名牌/血条/武器/光环/buff 图标）都该**随宿主销毁而销毁**，不止自走棋。
> **证伪重组（按铁律，附依据）**：① `mortal` 纯本地（要求实体自身有匹配 Resource）——名字无 hp，挂不了；② 名字给 `Mortal{resource:'hp'}` 需全局唯一 hp id，但会破坏 hitbox（按固定 'hp' 局部扣血）；③ 同体不行——一实体 Sprite+Text 互斥（`chooseRenderMode` text 优先盖掉 token）；④ `self-rule` 读自身组件，读不到"父是否还在"。→ 现有数据/能力**表达不了"子随父死"**。**真缺口。**
> **建议（交主程裁，1 系统/小改）**：`destroy-apply` 移除实体 E 时，**连带移除所有 `Hierarchy.parentId===E` 的实体**（级联，可递归多级）；或等价 `hierarchy-cascade` 系统。确定性：纯按引用删、与遍历序无关。
> 落地后 game-f 名字即随棋子死亡消失（零游戏改动）。其余两个 bug（名字镜像/720p）我已纯数据修。
>
> **Lead 裁决（主程4）：greenlit，已落地。** 独立复核确认真缺口——除 PE-F 四条外，额外排除了它没提的重组路径：**prefab 载体回收**只回收单组件请求载体、无「按实例分组销毁」；**relation + 收割系统**与提案功能等价且冗余（挂件本就需 Hierarchy）；**lifetime** 表达不了动态父死时刻；**event-when→effect-apply 链**需新增「实体是否存在」condition 叶子 + 每子手写一条 watch 数据 = O(子) 脆弱装配，**过不了「最弱 LLM 一致产出」尺子**。
> **定性修正**：不是新轴/新 capability，是**补全 `hierarchy` 的生命周期语义**——它此前只做「子跟父变换」(hierarchy-resolve)，漏了「子存活以父为界」；孤儿是 hierarchy 的潜伏 bug。
> **落地方案**（优于 PE-F 两建议、且不脏引擎核心）：新增 tier1 `hierarchy-cascade` 系统，按**生命周期铁律（请求制销毁）**排在 destroy-apply **之前**，沿 `Hierarchy.parentId` 把 DestroyRequest **传播给后代传递闭包**（多级一帧），destroy-apply 一趟移除父+全部后代 → **同帧、绝不残留一帧孤儿**。**不**把 `'Hierarchy'` 硬编进 `world.destroyEntity`（核心保持组件无知）。
> 确定性：销毁集 = 后代传递闭包，与遍历序无关；`parentId` 为空 = 根，永不波及（亦即「父死子留」逃生门）；环引用由 doomed 集单调增长保证终止。**零新增数据**（复用挂件本就有的 parentId 边）。**默认级联**（对齐 Unity/Godot/Unreal），罕见保留场景后续用「死前置空 parentId」或 `detachOnParentDestroy` 标志（YAGNI）。
> 文件：`src/skills/tier1/hierarchy-cascade.ts` + 注册 `capability-registry.ts`/barrel + 8 测（单层/多级/不误伤/根逃生门/环终止/定序无关）；tsc + vitest(934 绿) + build 全绿。
> **game-f 接入（归 PE-F，1 行数据）**：把 `hierarchyCascadeCapability` 加进 game-f blueprint 的 capabilities 列表即生效，零游戏代码。

---

### REQ-F-027 · [2026-06-10] · Programmer F（用户反馈：棋盘成平行四边形）· 框架级 · status: **done**（2026-06-10，Lead，HexBoard.layout 加 'offset'）· 优先级: 中（自走棋棋盘观感）· 类型: grid-move 投影正交化

> **现象（用户反馈）**：grid-move 的 HexPos→Transform 投影是 axial 斜投影 `x = ox + q*ts + r*ts/2`——r 越大 x 累积右移 → 整盘渲染成**平行四边形**（斜菱形），不像金铲铲那种规整矩形棋盘。用户要**正交投影**、横竖各 ~12 格。
> **game-side 修不了**：单位 Transform 由 grid-move 每拍投影写入（game-f 不能覆盖）；改投影 = 改引擎。
> **建议（交主程裁，投影换式/加模式，不动 hexNextStep 邻接）**：
> - 正交方格：`x = ox + q*ts`, `y = oy + r*ts`（矩形棋盘，6 邻接渲染为含斜向）；或
> - offset-rows（TFT 式六边形矩形）：`x = ox + q*ts + (r&1)*ts/2`（奇数行 +半格、不累积斜）→ 规整矩形 + 仍是六边形观感。
> 落地后 game-f 设 ~12×12 正交棋盘（纯数据 cols/rows）。寻路逻辑（axial 邻接）不变。
>
> **Lead 裁决（主程4）：greenlit，已落地。** 真引擎缺口（投影写死在 grid-move、game 覆盖不了）。**采 offset-rows，不采纯正交方格**——纯方格丢六边形交错观感；offset(奇行半格、不累积)=金铲铲/TFT 那种规整矩形外轮廓 + 六边形交错，正是用户要的。**做成数据开关而非换死公式**：`HexBoard.layout?: 'axial'|'offset'`，**缺省 'axial'**（现有蓝图/测试逐字节不变），game-f 设 `'offset'` 即可。确定性：`(r&1)` 整数 + `ts/2` 精确二进制分数，无 sqrt/超越，跨端一致；**不动 `hexNextStep`**（邻接寻路不变）。`orthogonal` 纯方格 YAGNI 暂不加。
> 文件：`components.ts`(HexBoard+layout) + `grid-move.ts`(project 按 layout) + 4 测（axial 回归/offset 偶奇行/不累积/y 一致）；tsc+vitest(940)+build 全绿。
> **game-f 接入（归 PE-F，纯数据）**：HexBoard 加 `layout:'offset'` + 按需 cols/rows(~12×12)。

---

### REQ-F-028 · [2026-06-10] · Programmer F（Game F 接 flow 暴露）· 框架级 · status: **done**（2026-06-10，Lead，采 F 具名 runsAfter）· 优先级: 中（游戏流程阶段机）· 类型: 系统定序 bug（拓扑成环，同 REQ-F-025 类）

> **现象**：game-f 加 `flow`（回合阶段机：备战→战斗→结算）→ 引擎拓扑成环：`flow`(RMW Flag/Resource：写 in_combat、读 present 旗标) ↔ `zone-occupancy`(RMW Flag：读写 present 旗标) 互为前驱。
> **证伪绕过**：换 `group-count`（计数写 Resource）也不行——它 `reads:['...Resource']` 即 RMW Resource，与 flow（RMW Resource）同样成环。
> **根因同 REQ-F-025**（grid-move↔aggro）：两个 RMW 同组件的系统无显式定序 → 判环。
> **建议（交主程裁）**：`flow` 系统加 `runsAfter:['zone-occupancy','group-count']`（语义：先数清存活/羁绊计数，flow 再据此判阶段转移）；或把 flow 作为"流程总控"显式排在所有 Flag/Resource 计数类系统之后（更通用，利于任何"流程读派生事实"的游戏）。
> 落地后我接 game-f 的 flow 阶段机（备战→战斗→结算→gameover，数据已设计就绪）。
>
> **Lead 裁决（主程4）：greenlit，已落地（同 REQ-F-025 类，1 行定序）。** 给 `flow` 加 `runsAfter:['zone-occupancy','group-count']`——显式边覆盖反向组件推断边，破两个 RMW 伪环（flow↔zone-occupancy 同 RMW Flag、flow↔group-count 同 RMW Resource）。**采具名 runsAfter，不采「排在所有计数类之后」的泛化**（无法显式表达 + YAGNI；将来加新计数系统再按需具名）。与 flow 现有 `runsBefore:[event-when,resource-apply,...]` 合成一致偏序链 `zone-occupancy/group-count → flow → event-when/resource-apply`，无新环。语义：先数清占位/羁绊派生事实，flow 再据此判阶段转移。
> 文件：`flow.ts`(+runsAfter 1 行) + 1 守护测（三者同场不抛环 + flow 据计数转 done）；tsc+vitest(940)+build 全绿。

---

### REQ-F-029 · [2026-06-10] · Programmer F（用户反馈：要实时血条/蓝条）· 框架级 · status: **done（引擎侧 t2-gauge，定序经 REQ-F-031 修正为 PostResolve；game-f 已接入 2026-06-10：每棋子血/蓝四条子实体，缩条/充条测绿）** · 优先级: 中（自走棋观感/可读性）· 类型: 真缺口（Resource → 实时条/gauge 渲染）

> **现象（用户反馈）**：棋子头顶血量/蓝量**不更新**（我的标签是装配期写死的静态数字 Text，无法随 hp/mana 变化）。用户要**绿色血条 + 蓝色蓝条**（别用数字）。
> **证伪重组**：① 渲染器只画 `Sprite/Text/Shape`，无"按 Resource 比例画条"的路径；② Text.content 静态，无"Resource→Text"更新系统；③ Shape.width/Transform.scaleX 静态，无"Resource→scaleX"系统；④ tween 按时间不按资源。→ 现有数据/能力**画不了随资源变化的条**。**真缺口（每个有血条的游戏都要，通用表现层能力）。**
> **关键约束**：血条是棋子的**子覆盖物**（Hierarchy parent=棋子，悬头顶）；棋子 hp 用**共享 id 'hp'**（hitbox 局部路由依赖它，不能改唯一 id）→ 子条必须读**父实体**的 Resource（全局按 'hp' 取会取错单位）。mana 已是唯一 id `mp_<英雄>`（可全局取）。
> **建议（交主程裁，二选一；通用 hp/护盾/蓝/读条皆用）**：
> - (A) 系统式 `Gauge{ resourceId, fromParent?:bool }`：每 tick 设本实体 `Transform.scaleX = clamp(资源.current/max,0,1)`（资源取自 `fromParent? Hierarchy.parentId 的 Resource : 自身`）；条=Shape/Sprite 子体，颜色用 Color（绿血/蓝蓝）。锚左缩（pivot 左对齐，从右端掉血）。
> - (B) 渲染器式 `Bar{ resourceId, color, w, h, fromParent? }`：渲染器据资源画填充矩形。
> 落地后 game-f：每棋子挂 hp 绿条(fromParent,读父'hp') + mana 蓝条(读 `mp_<id>`) 两个子条，纯数据、实时。
>
> **Lead 裁决（2026-06-10）**：**接受——真缺口核实成立，但两个提案的载体都回驳，修正后落地为 tier2 `gauge`。**
> - 缺口核实：渲染器确只画 Sprite/Text/Shape（box 以中心 `fillRect(-w/2..)`）；全库无任何 Resource→视觉投影系统；string-variable 是字符串容器与此无关；tween 按时间。重组确实表达不了 → 收。知识库 `wiki/skills/resource.md` 同向（血条=读 current/max→投影成条；单向 ECS→表现）。
> - **(B) 渲染器 Bar 回驳**：资源寻址 + 父子寻径是 sim 语义，塞进渲染器 = canvas/ascii/未来后端各自重复实现 + 无头环境测不了 + 破坏 `renderable.ts`「引擎无关纯渲染数据」契约。
> - **(A) 原载体回驳、方向采纳**：写 `Transform.scaleX` 不可行——`hierarchy-resolve`(PostResolve) 每帧 `c.scaleX = p.scaleX * localScaleX` 重写子 Transform（双 writer 打架、定序敏感）；且渲染 box 中心 pivot，缩放是**对称收缩**，做不出"左端钉死从右端掉血"。
> - **落地载体**：gauge 写 **`Shape.width` + `Hierarchy.localX`**（localX = leftX + 现宽/2 → 左端恒在 leftX）。两字段装配期之外无并发 writer；phase Update + 组件拓扑自动让资源写者(resource-apply/flow/group-count)先行、hierarchy-resolve(PostResolve) 同帧带走——**零显式定序边、零环、渲染器零改动**。寻址按提案：`fromParent` 读宿主（共享 id 'hp'）；缺省先自身后全局（与 ResourceModify R11 auto 一致）。
> - 引擎已落：`Gauge{resourceId, fromParent?, width, leftX?}` + `t2-gauge`（10 测：左锚恒定/全局路由/自身优先/clamp+min≠0/健壮跳过/ResourceModify→resource-apply→gauge→resolve 整链同帧/确定性）。tsc + vitest 951 + build 全绿。game-f 两子条接入归 PE-F（inbox F-5，纯数据）。
>
> **Programmer F 接入回报（2026-06-10）**：能力本身正确（孤立 10 测全绿），但接进 game-f 实际战斗世界 **tsc 通过、vitest 拓扑成环报错**：`Circular dependency detected among systems: event-when, caster, prefab-spawn, overlap-detect, trigger-zone, hitbox, over-time, resource-apply, destroy-apply, mortal, gauge, hierarchy-cascade`。**game-f 数据层无法自解**（capabilities 数组顺序只是平局 tiebreak、不能覆盖组件推断边；定序属能力定义层，非游戏数据层）。已**回退 game-f 接入**保持全绿，缺口转 **REQ-F-031**（同 REQ-F-025/028 类的系统定序 bug）。

---

### REQ-F-030 · [2026-06-10] · Programmer F（Game F 控制技能）· 框架级 · status: **done（引擎侧 GridMover.haltStatusMask；game-f 已接入 2026-06-10：八阵图 setMask FROZEN + statusDuration 120 自动解，冻敌测绿）** · 优先级: 中（自走棋控制/CC）· 类型: 真缺口（grid-move 缺 haltStatusMask，被控不停步）

> **背景**：自走棋要"控制"（冰冻定身/眩晕/定身）——被控单位停步。game-f 已能 hitbox.setMask 置 Status 位 + over-time 定时解除，但**单位照常 grid-move 走位、无视 Status**。
> **证伪重组（按铁律）**：grid-move 系统 `reads:['HexBoard','HexPos','GridMover','Relation']`——**不读 Status**，每 period 照走，无法被 Status 门控；数据层也停不住它（Relation 无条件删、period 无系统据 Status 改、无"按 Status 跳过移动"接缝）。**先例**：旧 `steering` 有 `haltStatusMask`（自身 Status 含位→速度归零=定身，game-d 冰冻定身即此），grid-move 取代它进网格时**漏带了这半**。→ 现有数据/能力**表达不了"被冻棋子站着不动"**。**真缺口（grid-move 功能缺口，对齐 steering 已有语义）。**
> **建议（交主程评估/定夺）**：grid-move 加 `haltStatusMask`（读单位 Status，含该掩码则本 tick 不走；reads 加 'Status'）。确定性不变（纯位与）。落地后诸葛"八阵图"等控制技 setMask=FROZEN+statusDuration → 被冻定身、到点解冻（同 game-d，纯数据）。
> **暂不提（已评估）**：被冻禁攻击=需 condition 加 Status 叶子（次要，先定身）；buff/增益=撞"hitbox 读活属性+self/group 寻址"一簇、非单一原子缺口（YAGNI 待重组）。
>
> **Lead 裁决（2026-06-10）**：**接受——按提案落地，零修正。** 缺口核实：grid-move 不读 Status；Effect/SelfAction 闭语法写不了 GridMover.period、删不掉 Relation（aggro 每拍重写）→ 重组确实表达不了；steering 有 `haltStatusMask` 而 grid-move 取代它进网格时漏带，属**功能对齐**而非加宽引擎。落地：`GridMover.haltStatusMask?`（逐实体字段，镜像 Steering）+ grid-move 读 Status、命中掩码本 tick 不走且**节奏时钟暂停**（elapsed 不累计 → 解控按剩余节奏恢复、无补步突进）。定序：读 Status 会经「grid-move 写 Transform→overlap→trigger→hitbox」第三方链成环——**与 steering 同款破法** `runsBefore:['hitbox','over-time']`（读上一拍 Status，CC 延迟一帧生效，与 Condition→Effect 同纪律；无 hitbox 的世界两 id 被忽略）。纯位与，确定性不变。4 测（冻住不走+解冻恢复 / 时钟暂停无补步 / 掩码不匹配照走 / overlap+trigger+hitbox+over-time 五系统同场拓扑守护）。PE-F 接入纯数据：控制技 setMask=FROZEN + statusDuration + GridMover 加 haltStatusMask:FROZEN（inbox F-6）。
> **附带提醒（CC 一拍延迟）**：与 steering/game-d 完全同纪律——技能拍上 FROZEN 的那一拍单位可能还走最后一步，次拍起定身。60tps 不可感知；lockstep 双端一致。

---

### REQ-F-031 · [2026-06-10] · Programmer F（REQ-F-029 接入暴露）· 框架级 · status: **done（gauge 移 PostResolve + runsBefore hierarchy-resolve，采纳 PE-F 方案 A）** · 优先级: 中（阻塞 game-f 接血条/蓝条；REQ-F-029 的接入前置）· 类型: 系统定序 bug（拓扑成环，同 REQ-F-025/028 类）

> **现象**：把 `t2-gauge`（REQ-F-029）接进 game-f——给每棋子挂"绿 hp 条 + 蓝 mana 条"两个子实体（`Shape`+`Color`+`Gauge`+`Hierarchy`，纯数据）——tsc 过，但 `world.tick()` 抛环：`Circular dependency detected among systems: event-when, caster, prefab-spawn, overlap-detect, trigger-zone, hitbox, over-time, resource-apply, destroy-apply, mortal, gauge, hierarchy-cascade`。回退接入前 game-f 全绿，**仅加 `gaugeCapability` + gauge 子条即复现**。
>
> **根因（精确，逐边核过各 capability 的 reads/writes）**：`gauge` 系统 `reads:['Gauge','Resource','Hierarchy']`、`writes:['Shape','Hierarchy']`。在"碰撞→伤害→改血"战斗图里恰好闭成 5 元环（组件推断边 writer(X)→reader(X)）：
> ```
> gauge        --writes Shape-->  overlap-detect(reads Transform,Shape)
> overlap-detect --writes Overlap--> trigger-zone(reads Overlap,Tag)
> trigger-zone --writes Trigger-->  hitbox(reads Trigger,Hitbox,Tag,Status,Resource)
> hitbox       --writes ResourceModify--> resource-apply(consumes ResourceModify, writes Resource)
> resource-apply --writes Resource--> gauge(reads Resource)   ← 闭环
> ```
> 即环由 gauge **同时写 `Shape`（被 `overlap-detect` 读）+ 读 `Resource`（被 `resource-apply` 写）** 闭合。REQ-F-029 落地说明的"零环"只核了 Shape 的**直接**读者（collision/clickable/cascade/resolve 不回写 gauge 读集），**漏了 collision→trigger→hitbox→resource 这条把 Shape 经伤害管线绕回 Resource 的传递路径**——而"带血条的战斗单位"正是 gauge 的招牌用例（能力 whenToUse 自陈"血条/蓝条挂受击棋子"），战斗图+gauge 必然共存。游戏数据层无法自解（capabilities 数组序只作平局 tiebreak、覆盖不了组件推断边；显式定序属能力定义层）。
>
> **建议（交主程裁，二选一；纯定序/相位，不改 gauge 语义与字段，确定性不变）**：
> - **(A 首选) gauge 移到 `SystemPhase.PostResolve` + `runsBefore:['hierarchy-resolve']`**：gauge 是**终态表现投影**——跨 phase 定序让它落在所有 Update 变更（overlap/hitbox/resource-apply）之后，读到本帧最终 Resource、写 Shape 时碰撞早已读完（无 Update 内反向边）；同相 `runsBefore` hierarchy-resolve 让 localX 同帧被消费（resolve 读 Hierarchy 写 Transform，不回写 gauge 读集→无新环）。最干净、最贴 gauge 本质。
> - **(B) 留 Update，给 gauge 系统加 `runsAfter:['overlap-detect']`**：经核 `overlap-detect` 是战斗簇里**唯一**读 `Shape` 又传递回写 Resource 的系统（trigger-zone 读 Overlap、hitbox 读 Trigger/Resource，均不读 Shape；clickable 读 Shape 但不回写 Resource→不成环）。`runsAfter` 显式边覆盖反向组件推断边（topological-sort.ts §60）破掉 gauge→overlap，余下 resource-apply→gauge 自然把 gauge 排到链尾。更省（1 行），但依赖"唯一 Shape 回写者"这一事实，将来若有新 Shape 读者回写 Resource 需再具名（略脆，故列次选）。
>
> **落地后 game-f 接入（已备好，纯数据，~5 分钟）**：见交接 `docs/workflow/finish/PF-finish-list.md §5`——每棋子挂"暗轨道+彩填充"两组（hp 绿读父共享 'hp'、mana 蓝读各自 `mp_<id>`）、名字标签上移让位、capabilities 加 `gaugeCapability`，tsc+vitest+build 全绿才推。
>
> **Lead 裁决（2026-06-10）**：**接受——根因诊断完全正确，采纳首选方案 (A)，已落地。** 自认：F-029 落地说明里的"零环"审计只核了 Shape 的直接读者，漏了 overlap-detect(Update,读 Shape) 经伤害管线传递回写 Resource 的路径——PE-F 逐边核对无误，此环在"战斗单位挂血条"这一招牌场景必现，是我的审计盲区。**(A) 采纳理由**：gauge 本质是终态表现投影，PostResolve 是它语义上的家（"基于已解算结果再改表现"）——跨相位与全部 Update 系统无边，**结构性消环**且读到本帧最终 Resource（伤害已结算，比 Update 内更新鲜）；同相 runsBefore:['hierarchy-resolve'] 钉死"先条宽后投影"。**(B) 回驳理由**：runsAfter:['overlap-detect'] 依赖"overlap-detect 是唯一传递回写者"这一当下事实，未来任何新的 Shape 读者回写 Resource 即复发，逐边补丁治标。代价披露：Update 内 Shape 读者(overlap/clickable)读到上一帧条宽——条不参战不可点，无语义影响（已写进能力头注释）。+1 守护测（gauge+overlap+trigger+hitbox+resource-apply 同场复现环→不抛+同帧缩条）；契约测断言 phase=PostResolve。tsc + vitest 957 + build 全绿。

---

### REQ-F-032 · [2026-06-10] · 策划 PF（Game F 流转规范拉动）· 框架级 · status: **done（引擎侧：A 路线最小化变体——纯重组 + 三处收窄扩展、零新系统；game-f 已接入 2026-06-10：8 持久槽位 + 复合棋子模板 + deploy/wipe 双信号 + round_flow 多回合循环，两回合循环测绿）** · 优先级: **高（MVP-1 多回合循环的唯一阻塞点）** · 类型: 真缺口（回合重置：棋子战斗实例的批量展开/清场）

> **要表达的语义（金铲铲铁律，见 `game-f-flow-spec.md` §3.3）**：阵容跨回合**持久**（买到的英雄/星级/装备/站位），棋子的**战斗状态每回合归零**（满血满蓝重新开战）；敌方阵容每回合按**关卡表**换装。即「备战进入拍：按 我方阵容数据+关卡表 展开两队棋子实例；结算拍：清掉本回合全部战斗实例」。
> **证伪重组**：① 现 blueprint 把棋子烘进装配期实体 → 死了就没了，flow 回 prep 也不会复活（单局版根因）；② `flow` 动作只有 set-flag/set-state/modify-resource，**无法生成/销毁实体**；③ `caster` 能按信号展开 prefab，但 `template` 是静态单模板，表达不了「按阵容数据展开 N 个异构棋子到各自 HexPos」；④ `World.snapshot/restore` 是引擎 API，**未暴露为数据可调用**，且恢复会连经济/血量一起回滚（结算 delta 要在快照外记账，语义拧巴）。→ 纯数据重组不出来，**真缺口**。
> **候选两路（交主程裁）**：
> - **(A) 短暂实例式（策划倾向）**：阵容=持久数据（槽位单例：英雄码/星级/HexPos/装备），新通用能力「**按清单展开**」——flow/信号触发时遍历阵容/关卡表条目，逐条 `SpawnRequest`（模板+落点+参数覆盖）；清场=按 Tag 批量销毁（destroy 已有，或 group-effect 窄化为 destroy-by-tag）。展开的实例用 **REQ-021 self 作用域**（已 done）跑棋子内部链 → 顺手消灭「唯一 id 烘不进共享模板」的 MVP 限制，直通 Phase 2 重复棋子。更贴 ECS/确定性。
> - **(B) 快照恢复式**：把 snapshot/restore 暴露为 flow 动作（快照点=开战拍，恢复点=结算后），结算结果（金币/血量/连胜）记在快照外的「账本」实体再回写。改动小，但「哪些状态在快照外」的边界语义易碎，且帮不到 Phase 2。
> **YAGNI 自审**：不是为想象需求——没有它，flow-spec §3.2/§3.3 的多回合循环（MVP-1 全部内容）无法落地；且「按清单展开实体」是军团/波次刷怪/关卡装载的通用形状（Game A/D 的波次硬编码在装配期，同样受益）。
>
> **Lead 裁决（2026-06-10）**：**缺口成立（四条证伪逐一核实），方向采 (A)，但按宣言铁律再压一遍"先重组"后，(A) 还能更瘦——不建任何新系统。**
> - **"按清单展开"系统回驳（A 的瘦身）**：阵容槽位本来就可以是**持久实体**，每槽挂 `Caster{onSignal:'deploy', template:英雄, at:'self'}`——N 槽收到同一信号各自展开自己的棋子，"遍历清单"被实体系统天然吃掉。买/卖=增删槽实体、换人=改 template、挪位=改 overrides 里的 HexPos，全是纯数据编辑。重组只差三块真缺口，全部收窄下沉：
>   1. **`SpawnRequest.overrides`**（localId→组件→字段补丁）+ prefab 深拷贝后逐字段合并——同模板展开异构实例（各自 HexPos/Tag/星级数值），这是任何路线都绕不开的一块；
>   2. **`Caster.overrides` 透传**——槽位声明自己棋子的补丁；
>   3. **`Effect kind:'destroy-tagged'`**（value=Tag 掩码）——清场。运行时实例 id 装配期不可知，单 targetEntity 寻址不可用，按 Tag 批量是唯一数据寻址（即 REQ-023 group-effect 当年"倾向重组"的裁决维持：通用集合写仍不收，只收这枚有真实驱动的最窄动词）。
> - **(B) 快照恢复式回驳**：把 restore 暴露成 flow 动作会击穿「snapshot=全部真相」不变量——"账本在快照外"意味着 hash/lockstep 校验要带豁免名单（确定性雷区，ScoreTrace 当年 opt-in 排除 hash 已是慎之又慎的特例）；restore 还会连 PrefabLibrary.seq / RandomSeed 一起回滚（实例 id 复用、随机序重放错位，皆隐蔽 bug）；且对 Phase 2（同模板重复棋子）毫无帮助。改动小是假象，语义债是真的。
> - **确定性**：展开按 query 序逐槽产请求、prefab.seq 单调 → 每回合实例 id 全新且可重放；destroy-tagged 集合语义与遍历序无关；清场经 Commit 写请求 → 次拍 cascade（F-026）连挂件一并移除。
> - 4 验收测（roster-round.integration：overrides 合并+模板隔离 / caster 透传 / **整轮循环** 三槽展开→按阵营清场连名牌→槽位幸存→次回合 id 全新 / 不误伤）。tsc + vitest 961 + build 全绿。
> - **接入注意（已写进 inbox F-7）**：caster at:'self' 用槽位 Transform 当落点，棋子 Transform 次拍才被 grid-move 按 HexPos 投影对齐——槽位 Transform 直接放投影坐标即可消除一帧跳变；'deploy'/'wipe' 信号由 flow onEnter 置 Flag → event-when(edge) 产出；敌方按关卡换装 = 每阶段一组敌方槽实体用 'deploy_stage_N' 区分信号，纯数据。

---

### REQ-F-033 · [2026-06-10] · PE-F（接入 F-7/REQ-F-032 时暴露）· 框架级 · status: **done（'@local:' 显式标记重映射，采纳 PE-F 倾向的方案 B；game-f 已接入 2026-06-10：复合棋子模板 10 实体经 '@local:main' 整体生灭，名牌/条/大招/级联全活，测绿）** · 优先级: **高（F-7 回合重置接入的前置 → 顶替 F-032 成为 MVP-1 阻塞点）** · 类型: 真缺口（prefab 多实体模板的**内部实体引用**不重映射）

> **要表达的语义**：金铲铲棋子 = 「单位 + 头顶名牌 + 血条/蓝条×4 + 蓝量 sidecar + 大招接线」的**复合体**（一族 ~10 实体）。F-7 把棋子改成模板每回合重展开后，这一族必须**整体**随展开而生、随单位而动、随清场而灭——即模板内部 `Hierarchy.parentId` / `Caster.originEntity` 等**实体引用字段**要指向「同一次展开出的兄弟实例」。
> **现状（读 `prefab.ts:28-47 instantiate` 证实）**：深拷贝逐字段照搬——模板里写 `parentId:'main'`，展开后仍是字面 `'main'`；而实例真名是 `hero_x#<seq>:main`（seq 全局单调、装配期不可知）→ 引用**悬空**。
> **证伪重组（逐条）**：
> ① 悬空不是报错而是**静默错**：hierarchy-resolve 见父无 Transform 跳过（条/名牌不跟随）；hierarchy-cascade 只在「父实体收到 DestroyRequest」时传播，而名为 `'main'` 的实体永不存在 → 挂件**永不级联**——每回合在棋盘上多一层永生孤儿；ultcast 的 `originEntity` 悬空 → 读不到 Relation(target)，大招哑火。
> ② `Caster.overrides` 救不了：补丁值是装配期静态数据，写不出含运行时 seq 的实例 id。
> ③ 挂件留作持久实体也不行：persistent parentId 只能指向固定 id，棋子实例 id 每回合全新。
> ④ REQ-F-032 验收测里的「名牌级联」是**运行时手工**挂到实例 id 上（`roster-round.integration.test.ts:117-119`，模拟挂件）——纯数据层没有这条"展开后再附挂"的路；库内既有多实体模板恰好都无内部引用，此前从未踩到。
> → 现有数据/能力表达不了「带挂件的复合预制」。**真缺口**（即 Unity/Godot nested-prefab 内部引用序列化的标配语义）。
> **建议（交主程裁，PE-F 倾向 B）**：
> - **(B) 显式标记**：模板数据里实体引用写 `'@local:main'`；instantiate 时凡字符串字段值带 `@local:` 前缀 → 重写为 `${templateId}#${seq}:${其后缀}`。**显式零误伤**（普通字符串/信号名/资源 id 绝不撞），对任意组件（含未来新组件）一体适用，最弱 LLM 也写得出（口诀："指兄弟就写 @local:"）；overrides 补丁值同样过这层重写（槽位可改指向）。
> - **(A) 协议注册表**：protocol 维护「实体引用字段」清单（`Hierarchy.parentId` / `Caster.originEntity` / `Effect.targetEntity` / `Zone.requiredEntities` / `Relation.targetId`…），instantiate 对清单内字段、值==某 localId 时重映射。模板数据零新语法，但隐式（localId 偶然叫 'hp'/'main' 这类撞名会误映射），且清单要随协议演进人工维护。
> - 两案确定性同：纯字符串改写、展开拍即定、随实体进 snapshot/hash；不触碰任何系统执行序。
> **YAGNI 自审**：非想象需求——F-7 当下就被它卡死；且「复合预制」是通用形状：炮塔+炮管、boss+弱点、单位+血条/名牌、弹幕母体+子弹（子弹要认母体）……Game A/D 波次同受益。不补则 REQ-F-026/029 的头顶挂件与 REQ-F-032 的短暂实例**互斥**（要么有条不能重生、要么重生没条），显然是缺的一块拼图而非加宽引擎。
>
> **Lead 裁决（2026-06-10）**：**接受——缺口属实（instantiate 逐字段照搬已亲核；"静默孤儿"四条证伪成立），采纳 PE-F 倾向的 (B) 显式 `@local:` 标记，已落地。**
> - **(B) 采纳理由**：显式单一前缀=闭语法**零误伤**（信号名/资源 id/普通字符串不可能撞）；对任意组件、任意嵌套深度（数组如 Zone.requiredEntities 一体适用）、含未来新组件**零维护**；最弱 LLM 一句口诀（"指兄弟就写 @local:"）即可一致产出——三条全压宣言尺子。
> - **(A) 注册表回驳**：隐式重映射存在撞名误伤类缺陷（localId 偶然等于某注册字段的合法字符串值即被静默改写）；清单须随协议演进人工维护，漏登记的字段比今天的悬空藏得更深。
> - 实现：`instantiate` 在深拷贝+Transform 偏移+overrides 合并**之后**深 walk 重映射（补丁值同享，槽位可改指向）；后缀不在本模板 localId 集 → **原样保留**（typo 在数据里显眼可 grep，不静默指向错误实体）。纯字符串改写、展开拍即定、随实体进 snapshot/hash，确定性不变。`LOCAL_REF_PREFIX` 自 prefab 导出。
> - **接线注意（已写进 inbox F-7）**：sidecar（大招接线等）**也要挂** `Hierarchy{parentId:'@local:main'}` 才随主体级联——级联只沿 Hierarchy 边走（F-026 契约），只有 originEntity 引用会清场幸存为孤儿（验收测试特意覆盖此坑）。
> - +2 验收测（复合棋子：名牌/血条/ult 四实体随展开而生·gauge 读父 hp·随单位而动·多实例隔离不串·随清场全级联 ／ 未知后缀保留+overrides 改指向）。tsc + vitest 963 + build 全绿。

---

### REQ-F-034 · [2026-06-10] · PE-F（用户实测反馈：移动瞬移、要 smooth）· 框架级 · status: **done（GridMover.glideSpeed 恒速滑行，采纳 PE-F 方案 A；game-f 已接入 2026-06-10：glideSpeed=0.8（策划建议下限），每拍位移 ≤0.8 测绿）** · 优先级: 高（用户点名的观感 bug；任何网格游戏通用）· 类型: 真缺口（grid-move 视觉移动只有"逐格瞬移"）

> **现象（用户实测）**：棋子移动是瞬移——每 `period`（48）拍 Transform 从旧格直接跳到新格（实测 x 一拍跳 18px），观感生硬。要平滑滑行。
> **现状（读 `grid-move.ts:121,146-148` 证实）**：`syncTransform` **每拍**把 Transform 硬钉到 `project(HexPos)`（不移动也钉，"每拍保持 Transform 与格同步"）；走步拍直接改 HexPos 后再钉到新格投影点。
> **证伪重组（逐条）**：
> ① grid-move 每拍独占写 Transform → 数据层任何"平滑器"（tween/velocity/第二个系统）都是 Transform 双 writer，要么打架要么定序耦合——没有数据接缝；
> ② `tween` 目标是装配期静态数据，追不了每步变化的动态格点；
> ③ `steering`（连续移动）已被 grid-move 取代且无格占位/A* 语义，回退=丢 REQ-F-024 全部成果。
> → 游戏层表达不了"格是逻辑真相、视觉连续滑行"。**真缺口**（行业标配语义：logical cell 与 visual position 分离 + 移动补间，战棋/roguelike/推箱子通用）。
> **建议（交主程裁，PE-F 倾向 A）**：
> - **(A) `GridMover.glideSpeed?: number`（px/tick）**：设了则 syncTransform 不再硬钉，而是 Transform 以恒速逼近 `project(HexPos)`（`min(glideSpeed, 剩余距离)`，到点即贴齐）；缺省不设 = 现行瞬移，**零迁移**。恒速直线、纯 IEEE 算术（含 sqrt，IEEE-754 正确舍入）→ 确定性不变；HexPos 仍是占位/寻路/hash 的 SIM 真相。
> - **(B) 定比逼近（每拍走剩余距离的 k%）**：免 sqrt、自带 ease-out，但渐近不达（要 epsilon 贴齐），速度随距离变化、跨格快慢不均。
> - 附带改善：`caster at:'target'` 在目标 **Transform** 处展开打击区——平滑后打击区落在单位视觉位置上，命中观感同步变好。
> **YAGNI 自审**：用户当下点名 + 通用形状（任何 HexPos/GridMover 游戏都要），非想象需求。game-f 接入=每棋子 GridMover 加一个字段（纯数据，落地后 PE-F 即接）。
>
> **Lead 裁决（2026-06-10）**：**接受——缺口属实（grid-move 独占写 Transform，数据层无平滑接缝，亲核），采纳 PE-F 倾向的 (A) 恒速 glideSpeed，已落地。**
> - **(A) 采纳理由**：恒速、可预测、到点**精确贴齐**（无 epsilon 渐近）；缺省不设=原瞬移行为，全部既有回归零迁移；sqrt 属项目已裁定的确定性算术类（6b9164a 弃 hypot 改 sqrt 先例 + steering 同类；IEEE-754 对 sqrt 规定正确舍入，Transform 不被 Condition 读）。**(B) 定比逼近回驳**：渐近不达须 epsilon、视觉速度随距离不均。
> - **实现要点**：① HexPos 仍是占位/寻路/hash 的 SIM 真相（逻辑瞬步），Transform=视觉投影恒速逼近——logical cell / visual position 分离的行业标配；② **每拍恒一次滑行**（走步拍不再步后补滑，否则该拍 2×速度不均匀——首版实测修正）；③ 冻结（F-030）检查挪到滑行同步之前：**定身=时间静止，视觉滑行一并停**，解控原地续滑；④ 数据提示：glideSpeed ≥ 格距/period，否则长追击视觉掉队。
> - 附带收益（PE-F 已指出）：F-032 槽位展开的"一帧跳变"在滑行模式下自然消失（从槽位滑进格点）。
> - 4 测（缺省瞬移回归 / 逻辑瞬步+视觉恒速+精确贴齐 / 冻结停滑解冻续滑 / 滑行轨迹确定性）。tsc + vitest 1013 + build 全绿。game-f 接入派 PE-F（inbox F-8，每棋子一个字段）。

---

### REQ-F-035 · [2026-06-10] · 策划 PF（审查第 9 轮拦截 `299b498` 配套处方）· 框架级 · status: **done（SelfRule.whenGlobal 全局阶段门 + self-rule 定序排雷）** · 优先级: **高（阻塞普攻链 self-rule 迁移 = 阻塞 Phase 2 合体路线的一半）** · 类型: 真缺口（self 链缺「全局阶段门」）

> **要表达的语义（flow-spec §3.3 铁律）**：备战/结算期**不动手**——普攻只在 `in_combat==true` 期间触发。现普攻链用 `EventWhen{when: timer ∧ flag(in_combat)}` 全局链表达，工作正常；迁到 `SelfRule`（拆唯一 id 脚手架、通向合体）后**此门丢失**。
> **证伪重组（逐条）**：
> ① `evaluateSelfCondition`（`self-rule.ts`）**只读自身组件、无全局回退**——`flag` 叶子读的是实体自己的 Flag，单位没有也不该有 `in_combat` 副本；
> ② `299b498` 提的「目标存在性当战斗门」**在本流程失效**：deploy 发生在 prep（§3.3 prep ⑥，玩家备战期要看阵/摆阵），aggro 无门、立即写 Relation(target) → 备战期就有目标 → SelfRule spawn 备战期就开打；结算期（wipe 前 60 拍）幸存者同样会继续互殴；
> ③ 给每单位发自身 `Flag{id:'in_combat'}` 副本 = 群发写一组实体 = Gap C（REQ-023 不 greenlit）领域，且模板烘不进运行时相位。
> → 纯数据重组不出来，**真缺口**。
> **建议（交主程裁，最小形态）**：`SelfRule` 加可选 **`whenGlobal?: ConditionExpr`**（按**全局** id 求值，与 self `when` 取 AND；缺省缺省不设=零迁移）。普攻迁移后写 `whenGlobal:{kind:'flag',id:'in_combat',equals:true}` 即恢复阶段门。通用收益：任何"实体自治但受全局相位/规则约束"的品类（波次刷怪冻结、回合制行动门、暂停）同形。
> **范围注**：大招半边**不被阻塞**可先迁——蓝条只由普攻攒（普攻有门→备战蓝不涨→`mp≥100` 备战期不可能成立），自身资源阈值天然 self。详见 inbox F-5★ 策划批注。
>
> **Lead 裁决（2026-06-10）**：**接受——按提案落地，零修正；并顺手排掉一窝潜伏定序雷。**
> - 缺口核实：`evaluateSelfCondition` 纯 self 作用域无全局回退（亲核）；策划对 ② 的判定正确——`299b498` 的"目标存在性当战斗门"在本流程失效（deploy 在 prep、aggro 无门 → 备战期即有目标；结算期幸存者续殴），予以采信并修正该提交的处方。③ 群发副本=REQ-023 领域不收，判定一致。
> - 落地：`SelfRule.whenGlobal?: ConditionExpr`（按全局 id 求值，与 when 取 AND、先求短路；缺省不设零迁移）。once 语义：门关期 armed 不动，跨相位保持待发。复用 buildConditionLookup（lazy，仅有门规则才建索引）。
> - **附带排雷（实现时发现）**：self-rule 与 flow / zone-occupancy / group-count / resource-apply **互为 RMW**（Flag/Resource/State）且无任何显式边——四个同场拓扑必抛环，此前纯因从未同场而潜伏，PE-F 一接 F-9 必踩（F-031 同款）。已补 `runsAfter:['flow','resource-apply','zone-occupancy','group-count']`：先定相位/结算/数清事实，单位再自治行动——whenGlobal 的**同帧新鲜门**正依赖 flow 先行（combat 拍置 flag 当拍生效、resolution 拍关门当拍停手，守护测试验证）。
> - +3 测（门关跳过/门开恢复/零迁移；once×门跨相位；五系统同场不抛+相位同帧生效）。tsc + vitest 1031 + build 全绿。F-9 迁移解锁。

---

### REQ-F-036 · [2026-06-10] · PE-F（按 F-9 处方接入实测暴露）· 框架级 · status: **done（二刷：self-rule 补 runsAfter:['hitbox']，决策坐结算链尾；game-f 已接入复核 2026-06-10——F-9 贴回 14/14 测绿，含 2×关羽不串台 + 阶段门关停断言）** · 优先级: ~~高~~（已解除） · 类型: 系统定序 bug（拓扑成环，同 REQ-F-025/028/031 类）

> **复测补充（2026-06-10，1e875ef 排雷后带 whenGlobal 重接）**：环**缩了没断**——12→10 系统：`flow`/`zone-occupancy` 已被排雷边拆出 ✓，残 SCC = `self-rule, event-when, caster, prefab-spawn, hitbox, over-time, resource-apply, destroy-apply, mortal, hierarchy-cascade`。
> **残环走向（按组件 writer→reader 边推演）**：`self-rule 写 Flag → event-when 读 Flag → 写 Signal → caster → SpawnRequest → prefab-spawn → …结算链… → hitbox → over-time → resource-apply ——(排雷边 runsAfter)→ self-rule`，主程新加的 `resource-apply 先行` 回边与 `self-rule→event-when` 前向边合围。引擎守护测「五系统同场」没带 caster/prefab/hitbox/cascade 这条链 → 没踩到。
> **建议二刷方向（仍交主程裁）**：环里 self-rule 的**出边**只有"写 Flag/State 被 event-when 读"这一类（SpawnRequest/DestroyRequest 是 consume 单向）。可裁 (A) `event-when runsBefore self-rule` 显式边——self 写的 Flag 晚一拍才被全局链看见，与 grid-move/steering"一拍延迟"同纪律；(B) 收窄 self-rule 声明（若 do 动作集可静态推导：不含 set-flag 的规则世界无该写边——动静较大）。复现条件照旧：game-f 蓝图 + selfRuleCapability 即抛。

> **现象（最小复现=game-f 蓝图 + selfRuleCapability）**：按 F-9 处方迁普攻（unit 挂 `Timer{id:'atk'}+SelfRule{spawn strike at:'target'}`），capabilities 加 `selfRuleCapability` → `world.tick()` 抛 **12 系统 SCC**：`flow, self-rule, event-when, caster, prefab-spawn, hitbox, over-time, resource-apply, destroy-apply, mortal, zone-occupancy, hierarchy-cascade`。去掉 selfRuleCapability 即恢复全绿；**接入 diff 已存档 PF-finish-list §5.4，修后原样贴回**。
> **根因（读 self-rule.ts 系统声明）**：self-rule `reads:[SelfRule,Resource,Flag,State,Timer,StringVar,Transform,Relation]`、`writes:[SelfRule,Flag,Resource,State,DestroyRequest,SpawnRequest]`——**对 Resource/Flag 是 RMW**，与战斗图里同样 RMW 这两组件的 flow / resource-apply / effect-apply 互为前驱成环；写 DestroyRequest/SpawnRequest 又汇入 mortal/cascade/caster→prefab 链。能力定义**零显式定序边**；引擎侧 9+4 验收测的小世界没有完整战斗图，踩不到（与 REQ-F-031 gauge 当年完全同型）。
> **游戏层无解**：capabilities 数组只是平局 tiebreak、覆盖不了组件推断边（F-031 已证）；定序属能力定义层。
> **建议（交主程按 F-031/F-030 方法论裁）**：
> - (A) self-rule 加 `runsBefore:['hitbox','over-time']`（必要时含 resource-apply 相关边）——决策系统读**上一拍**状态，与 grid-move/steering 的"CC 一拍延迟"同纪律（60tps 不可感知；普攻本就 45 拍一发）；
> - (B) 移相位（决策先行相位），结构性与结算链脱钩——代价是 self-rule 读到的 Resource 是上一拍终值（语义同 A）。
> 注意点：self-rule 写 DestroyRequest 与 mortal 的汇流、写 SpawnRequest 与 caster 的汇流，定序时一并钉死；加一条「self-rule 进完整战斗图不抛环」守护测（F-031 同款）。
>
> **Lead 裁决（2026-06-10，二刷）**：**接受复测结论，残环已断；但两个建议方向都未采用，按更紧的根因另裁。**
> - **真根因比推演更紧**：残环不是经 event-when→caster→prefab 的长链——那串是 Kahn 剩余的**下游受害者**（祖先卡死则后代 in-degree 永不归零，报错把它们一并列出）。真核是**三元环**：`self-rule —(写 Resource 被 hitbox 读：攻防数值)→ hitbox —(ResourceModify)→ resource-apply —(F-035 显式边)→ self-rule`。F-035 守护测的五系统小世界没带 hitbox → 漏网（与 F-031 同型，已补刀）。
> - **建议 (A)（self-rule runsBefore hitbox/over-time）不可用**：与既有显式链 `hitbox →(runsBefore)→ resource-apply →(F-035 runsAfter)→ self-rule` 合成**显式边环**——显式边互相打架无解，除非推翻 F-035 刚发布的"同帧终值"语义。**(B)（移相位）代价同 A 且动静更大**，回驳。
> - **落地**：`self-rule` runsAfter 补 `'hitbox'` → 决策系统坐**结算链尾**（flow 定相位 → hitbox 判伤 → resource-apply 落账 → 单位据本拍终值自治），与 F-035 语义一脉；1 行改动。写 SpawnRequest/DestroyRequest 与 caster/mortal 仅为同汇（请求集合语义），writer 间无需定序——采纳提醒但无需新边。
> - +1 守护测：**15 能力全家桶**（flow/zone/group/resource/overlap/trigger/hitbox/over-time/mortal/event-when/caster/prefab/destroy/cascade/self-rule）同场不抛 + whenGlobal 门同帧。tsc + vitest 1036 + build 全绿。F-9 解锁：PF-finish-list §5.4 的接入 diff 可原样贴回。

---

### REQ-F-039 · [2026-06-10] · PE-F（推演 F-9 完整迁移到底时暴露；原编 037 与主程 odd-r 单撞号，让号改 039）· 框架级 · status: **wontfix-covered（回蓝=over-time 现有能力重组；附等价数据写法）** · 优先级: 中（Phase 2 合体要把大招也去唯一 id 时才真撞上） · 类型: 真缺口（一实体一 SelfRule 装不下"回蓝+放大招"两条自治规则）

> **背景**：F-9 批注说"大招半边可先迁（蓝由普攻攒）"——**方向对，但有两个隐藏依赖**，提前钉死防返工：
> ① **at:'target' 的目标从哪来**：大招 SelfRule 落在蓝 sidecar（mp 在它身上，墙：一实体一 Resource、unit 已被 hp 占用），而 spawn at:'target' 读**自身** Relation——sidecar 没有。**纯数据可解**（无需引擎）：sidecar 挂 `Transform + Hierarchy(随主) + Perception{targetTag:敌}` → aggro 给 sidecar 自己的 Relation（位置=主身位，锁的就是近敌）。此法已可用，记录在案防别人再撞。
> ② **真缺口在"攒蓝信号源"**：普攻半边迁完后 `atk_<英雄>` 信号消失 → 现 `Effect{onSignal:atk_<id>, mp+20}` 的攒蓝**失去挂点**。改时基回蓝（sidecar `SelfRule{when timer, do:[mp+4]}`）可保节奏——但 sidecar 唯一的 SelfRule 名额已被"蓝满→放→清"占用：**一实体一 SelfRule，回蓝(level)与放大招(once)两条规则挤不下**。挂第二个 sidecar 也不行（do 仅施自身，别人的 mp 写不到）。
> **建议（交主程裁）**：(A) `SelfRule` 组件化为**规则数组**（`rules:[{when,do,once,armed}]`，单数形态兼容）——任何"一实体多条自治规则"（回蓝+放招、低血狂暴+濒死逃跑）同形；(B) spawn 动作加 `at:'parent-target'`（沿 Hierarchy 借宿主 Relation，免 ① 的 Perception 间接法）——可与 A 并案或独立。
> **范围**：F-9 普攻半边（035+036 后）不需要本条；大招去唯一 id（Phase 2 合体的另一半）需要。gauge 蓝条的 `mp_<id>` 全局路由届时改 `fromParent` 指 sidecar 即解（纯数据）。
>
> **Lead 裁决（2026-06-10）**：**回驳——"挤不下"的前提不成立，回蓝被现有能力字面覆盖（manifesto §4 先重组）。**
> - **等价数据写法**：时基回蓝不该用 SelfRule，`over-time` 本就是"周期改自身资源"的专职能力且原生支持永久效果——sidecar 挂 `OverTime{effects:[{id:'mp_regen', resource:'mp', amountPerTick:+4, period:30, duration:0, elapsed:0}]}`（`duration<=0=永久`、`amountPerTick 正=regen` 皆为契约注释原文；局部寻址恰中 sidecar 自己的 mp）。SelfRule 名额自然腾给"蓝满→放→清"。
> - **(A) 规则数组回驳**：上述重组成立 → 当下无真缺口；"一实体多自治规则"待出现 over-time 表达不了的第二例（如两条都需 once 沿语义）再议——届时本条重开。
> - **(B) at:'parent-target' 回驳**：① 的 Perception sidecar 法你已验证可用（纯数据），单 enum 便利性不值得在重组可用时加宽（YAGNI）；① 写法已沉淀进 inbox F-9 批注防再撞。
> - 证明回蓝重组的既有测试：over-time 套件（regen/永久效果路径）。零引擎改动。

---

### REQ-F-040 · [2026-06-10] · PE-F（商店三件套 P0 接入推演暴露；原编 038 顺位让号改 040）· 框架级 · status: **done（A1 playedCodeResource + A2 playCosts，零新系统；接入派 inbox F-11）** · 优先级: **高（MVP-1 商店 P0 的唯一引擎缺口）** · 类型: 真缺口（已购牌码读不出来——「按数据值分发」缺最后一环）

> **要表达的语义（flow-spec §3.3 操作表 + §4.5）**：买人=点商店槽 i → `play(i)` 从手牌取出**英雄码** + 扣金 → **据码**生成对应英雄的阵容槽实体。发/选/弃/补 card-pile 全包，扣钱 craft-recipe 全包，造槽 Caster+模板全包——**断在"据码"**。
> **证伪重组（逐条）**：
> ① 牌码躺在 `PlayedHand.cards`，全库**无任何系统按值分发**（poker-eval 是德州牌型判定，读 cards 只产 chips/mult）；
> ② `Caster.template`/`SpawnRequest.templateId` 是静态字符串，无按值选模板的形态；
> ③ ConditionExpr 叶子只有 resource/flag/state/timer/string——**读不到 PlayedHand** → 现成的 banded EventWhen 分发模式（经济三件套同款）缺"码→Resource"最后一环；
> ④ 设计稿 §4.5 原案写的是"选购的英雄落到 PlayedHand → **装配层据码展开**"——即游戏代码做分发，宪法禁区，不可照做。
> **建议（交主程裁，PE-F 倾向 A 全套）**：
> - **(A1) `CardPile.playedCodeResource?: string`**：play 成交拍把取出的牌码写进该 Resource（单张=该码；商店 handSize 语义一次买一张）→ 既有 banded `EventWhen{resource eq 码}` 即可分发到每英雄专属信号 → `Caster` 造槽。零新系统、最弱 LLM 可写（每英雄一行 band）。
> - **(A2) `CardPile.playCosts?: [{id,amount}]`**：可负担才执行 play（取牌+补手+写码原子在 card-pile 内）；否则现序是 card-pile(Update) 先取牌、craft-recipe(Commit) 后查钱——**买不起也丢牌**的时序硬伤，挂两件套修不了（recipe 退不了牌）。
> - (B) 独立 `card-read` 系统（PlayedHand→Resource）：解耦但多一个系统，A1 一字段可达同效。
> **YAGNI 自审**：商店 P0 当下卡死；「从手牌选一张→按它是什么生效」是卡牌品类通用形状（商店/锦囊/事件卡全同形）。
>
> **Lead 裁决（2026-06-10）**：**接受 A 全套（A1+A2），回驳 B；并预排一窝定序雷。**
> - 缺口核实四条全对（含对设计稿 §4.5"装配层据码展开"的宪法否决——判定正确）。**(B) 独立 card-read 回驳**：A1 一字段同效，B 多一个系统还引入 PlayedHand 消费时序问题。
> - **A1**：play 成交拍把牌码写进 `playedCodeResource` 指向的 Resource（恰取 1 张时；全局 id 路由 + 钳 [min,max]，数据侧把 max 设大于最大牌码）→ banded `EventWhen{resource eq 码}` 分发，零新系统。**A2**：`playCosts` 全部付得起才执行（验→扣→取牌单系统原子；被拒=本拍视同没出牌：牌不丢、区清空、scoring Flag 不脉冲）——时序硬伤诊断正确（craft-recipe 在 Commit 退不了 Update 已取的牌）。
> - **预排雷**：A 使 card-pile RMW Resource → 与 flow/zone-occupancy/group-count/self-rule/resource-apply 互 RMW；且 **flow↔card-pile 的 Flag 互锁今天就潜伏**（双方都 RMW Flag，E-1 回合数据化一接必抛——F-031/035/036 同型第四次）。一次钉死：card-pile `runsBefore` 扩为七件套（输入先行纪律：玩家输入应用→计数/相位/结算/自治再反应，全部同帧新鲜）。
> - 4 测（成交链 / 拒单五断言 / 零迁移 / 六系统同场守护）。tsc + vitest 1037 + build 全绿。游戏侧接入派 **inbox F-11**。

### REQ-F-037 · [2026-06-10] · Lead（外审 Q5 裁决 (c) 拉动）· 框架级 · status: **done（'odd-r' 错位矩形棋盘；'offset' 标废弃，迁移派 PE-F inbox F-10）** · 优先级: 高（站位敏感品类的博弈直觉） · 类型: 拓扑同构升级（F-027 的修正案）

> **背景**：F-026/027/028 包外审（Gemma/Gemini）Q5 裁决：F-027 的 'offset' 投影错位"视觉相邻≠逻辑相邻"（每格 6 邻中 1 个投影在 1.5ts 外、1 个视觉邻格逻辑距 2），在自走棋这类站位敏感品类不可接受（绕后/贴脸距离骗人）；(b) 邻接随布局切换=表现污染 sim 拓扑，违数据驱动红线；**必须 (c)：sim 严格 axial，矩形观感来自棋盘形状**。
> **Lead 裁决**：采纳 (c)，但以**新增 `layout:'odd-r'`** 落地而非改 'offset' 语义——直改会当场打破 game-f（旧坐标在新边界越界），而游戏数据迁移归 PE-F（分工铁律）+ 全绿才推。
> - 'odd-r'：每行 axial q 范围随 −(r>>1) 平移（offset col=q+(r>>1)∈[0,cols)）；hexDistance/HEX_DIRS/A* **零改动**（axial 封闭算术保留）；真投影 x=q·ts+r·ts/2 自然呈规整矩形+交错——**几何≡拓扑**，6 邻投影距全 <1.05ts。
> - 附带修了一个**真 bug**：cellKey=r·cols+q 在负 q 下跨行撞键（(-1,2) 与 (7,1) 同键）——A* 内部与 grid-move 占位集统一改用导出的 `hexCellKey`（odd-r 以 col 为键列）。
> - `offsetToAxial/axialToOffset` 自 hex.ts 导出（游戏侧按 (col,row) 摆子的换算）。'offset' 标废弃仅留迁移窗口，PE-F 迁完（F-10）即删分支。
> - 4 测（换算往返+交错矩形投影 / 6 邻 <1.05ts / 负 q 行首寻路+边界裁切 / 撞键回归）。tsc + vitest 1035 + build 全绿。
> - **尾款（2026-06-10）**：F-10 迁移完成（0dc786a）→ 废弃 'offset' 分支已删（类型并集/投影分支/旧回归测一并清，HexLayout='axial'|'odd-r'）。
>
> **同包外审其余结论归档**（全文 `docs/review/2026-06-10-f026-028-external-verdict.md`）：F-026 Q1–Q4 全过、代码审查通过；Q7 确认 F-028 同帧新鲜方向（离散逻辑 vs 连续反馈两分法）；**Q6（RMW 推断层治理）回驳**——外审方案"RMW 写降级仅留入边"会把 resource-apply 这类**真生产者**的出边一并删除，下游（gauge/flow/mortal）先后退化为注册序 tie-break，F-028/F-035 特意钉的同帧新鲜保证全部**静默失效**（响亮报错→隐藏一帧滞后 bug）；且该方案只治 mutual-RMW 类，对 F-025（互为纯生产/消费）与 F-031（经第三方传递闭环）两类无效。维持"报错+显式钉边逼出语义决策"纪律；观察阈值：显式边对超 ~10 再重审（现 6 对）。

### REQ-F-041 · [2026-06-10] · PE-F（F-11 商店五件套 v2 §4.6 推演暴露）· 框架级 · status: **done（A refreshOnSignal + B '@signal-source' 哨兵；接入派 inbox F-12）** · 优先级: 高（商店五件套余下三件——刷新/锁店/卖出——的共同前置） · 类型: 真缺口 ×2（信号驱动不了 card-pile 操作；运行时实体无数据可达的销毁寻址）

> **背景**：买入核心已落（playCosts 原子验扣 + bought_code 分发 + bench_space 当 playCosts 第二货币防席满，全纯数据、15 测绿）。v2 §4.6 余下三件全部撞墙：
> **缺口 A：信号→card-pile 操作桥（刷新/锁店共需）**
> ① prep 自动刷新 = 弃 5 补 5——`card-pile` 只消费 `InputQueue` 的 `discard` 动作；flow 动作只有 set-flag/set-state/modify-resource，**写不了 InputQueue**；clickable/event-when 产的是 Signal，card-pile **不读 Signal**。2 金手动刷新同断点（craft-recipe 能扣钱，弃牌没有信号消费者）。
> ② F-11 的"刷新=重写 deck（flow effect）"实测不成立——flow 无此动作类型。
> **建议 A（最窄动词）**：`CardPile.refreshOnSignal?: string`——信号在场 → 弃全部手牌 + 按 handSize 补满（弃/补是它既有内功，只加一个触发面）；锁店 = 数据侧在信号链上游用 `shop_locked` Flag 条件挡住（既有 EventWhen 重组，零新增）。
> **缺口 B：卖出的销毁寻址**
> 买入产生的席位 marker 是**运行时实例**（`bench_<将>#<seq>:seat`，seq 装配期不可知）；`Effect{kind:'destroy', targetEntity}` 是静态数据 → 指不到；destroy-tagged 是**批量**掩码语义（卖一个不能全清）。clickable 点席位产 `Signal{source:被点实体}`——**source 里有精确实例 id，但 Effect 无"作用于信号源"的寻址**。
> **建议 B（最窄寻址）**：`Effect.targetEntity` 支持哨兵 `'@signal-source'`（destroy/set-* 作用于触发信号的 source 实体）——「点谁卖谁/点谁选谁」是指针品类标配形状（卖棋子/拆塔/弃卡同形）。卖价返还（金 + bench_space+1 + 袋归还）= 既有 Effect/craft-recipe 重组。
> **YAGNI 自审**：两缺口都是 v2 §4.6 硬性条目的唯一断点；A 是"输入域→sim 操作"的通用桥，B 是指针交互的通用寻址。
>
> **Lead 裁决（2026-06-10）**：**A、B 均按提案接受（双缺口核实，重组路径确不存在）；并自认一笔——F-11 批注里我写的"刷新=flow effect 重写 deck"不可实现（flow 无此动作），PE-F 纠错正确。**
> - **A `CardPile.refreshOnSignal`**：完全贴合 caster/Effect 的 onSignal 既有惯用法（组件声明触发面，零新系统）；弃/补皆 card-pile 既有内功。锁店=信号链上游 Flag 条件挡（EventWhen 重组）判定正确，零引擎。**语义钉死**：① 同拍撞 play/discard 输入 → 输入忽略（刷新优先，下标已失效，退化输入要确定性明确）；② 定序——card-pile 读 Signal 与 event-when（读 Flag 写 Signal）互锁，按输入先行补 `runsBefore:['event-when','clickable']`：clickable 自带 runsAfter:['event-when']（先清后标），仅钉 ew 会合成 cp→ew→clickable→(Signal)→cp 三元环（game-f 全家桶 15 测当场抓出）——两个都钉，刷新读上一拍信号（prep/点击级操作 16ms 不可感知）。
> - **B `Effect.targetEntity:'@signal-source'`**：F-033 '@local:' 开创的闭语法哨兵家族第二员；信号源是运行时实例唯一的数据可达句柄，判定正确。实现为全部实体寻址 kind（destroy/set-sensor/set-visible/reset-timer）统一过 targetsOf 解析——同拍多源各自生效（点两个席位都卖，集合语义）；静态 targetEntity 行为不变。
> - 5 测（换批 / 零迁移+撞拍输入忽略 / event-when 互锁守护 / 点谁卖谁 / 双源+静态回归）。tsc + vitest 1045（含 game-f 全家桶 15 测）+ build 全绿。卖出返还（金+bench_space+袋归还）= 既有 Effect/craft-recipe 重组，随接入派 **inbox F-12**。

---

### REQ-F-042 · [2026-06-10] · PE-F（用户实测"看不到商店"）· 框架级 · status: **done（A handCodeResources 手牌镜像 + B playOnSignals 信号出牌；接入派 inbox F-14）** · 优先级: **高（商店玩法已全通但不可见不可点——用户体验断层的主因之一）** · 类型: 真缺口 ×2（手牌内容无数据出口；点击→出牌无路由）

> **现象（用户实测）**：商店买/刷/锁/卖 sim 全通（16 测绿），但屏幕上**没有商店**——5 个在售英雄无可视化、无法点击购买。
> **证伪重组**：① 手牌是 `CardPile.hand: number[]` 纯数据，**无任何系统把牌码投影成可见实体**（Sprite.textureKey 静态、无"据码换贴图"形态）；② 购买输入是 `InputQueue {key:'play', values:[i]}`——clickable 只产 Signal，**无 Signal→play 路由**；launcher 指针层只发坐标事件。
> **建议（最窄两件，交主程裁）**：(A) `CardPile.handCodeResources?: string[]`——每槽牌码实时写进对应 Resource（如 shop_slot_1..5；0=空）→ 现成 banded EventWhen 即可驱动每槽 marker 展开/销毁（与买入分发同构）；(B) `CardPile.playOnSignals?: string[]`——第 i 个信号在场=play(i)（clickable 槽位按钮 → 信号 → 出牌），与 refreshOnSignal 同族触发面。
> **YAGNI 自审**：任何带手牌/商店 UI 的卡牌品类同形；是"sim 全数据"路线下 UI 可见性的必经缺口。
>
> **Lead 裁决（2026-06-10）**：**A、B 均按提案接受（双缺口核实；两件都是 card-pile 既有哲学的顺延，零新系统、零新定序边）。**
> - **(A) handCodeResources**：F-040 bought_code 把"成交事件"产物化，本条把"手牌状态"产物化——同一思想从事件扩到状态镜像。实现在补牌**之后**逐槽写（终态镜像，marker 链当拍见最新）；空槽写 0；钳 [min,max]。
> - **(B) playOnSignals**：与 refreshOnSignal 同族触发面（F-041 已把 event-when/clickable 两条边钉死，本条搭现成顺风车）。**语义钉死**：每拍至多一单（最低下标优先——同拍双击是退化输入；多买连拍点即可）；InputQueue 显式 play 优先于信号 play；刷新拍一并忽略；照常过 playCosts 可负担门。
> - 2 测（镜像三态：初值/买后/空槽 ／ 信号出牌+同拍双击只成交一单）。tsc + vitest 1052 + build 全绿。接入派 **inbox F-14**。

---

### REQ-F-043 · [2026-06-10] · PE-F（用户实测"看不到金币/回合"）· 框架级 · status: **done（t2-text-binding，gauge 姊妹件；接入派 inbox F-15）** · 优先级: 高（HUD 数字全员不可见：金币/回合/玩家血/等级） · 类型: 真缺口（Resource→Text 数字投影缺位）

> **证伪重组**：`Text.content` 装配期静态（REQ-F-029 证伪原文已钉过"无 Resource→Text 更新系统"）；gauge 只投影成**条宽**——血条蓝条够用，金币/回合数需要**数字**。
> **建议**：tier2 `text-binding`（或 gauge 姊妹件）：`TextBinding{resourceId, prefix?, suffix?}` 每拍把 Resource.current 写成自身 Text.content（如「金币 12」「回合 3-2」）。确定性同 gauge（表现投影、进/不进 hash 由主程按 Text 现状裁）。
> **YAGNI 自审**：金币/回合/血量/等级四处当下就要；任何有数字 HUD 的游戏同形。
>
> **Lead 裁决（2026-06-10）**：**接受——缺口在 F-029 证伪时即已钉过（当时用户要条不要数字故未建），现在数字 HUD 真到了。落地 `t2-text-binding`，与 gauge 完全同纪律**：寻址同款（fromParent / 先自身后全局 R11 auto）、phase 同款（PostResolve 终态投影——F-031 教训直接继承，读本拍最终 Resource）、确定性同款（String(number) 为 ES 规范确定转换，content 进 snapshot/hash 与 gauge 宽度同纪律）。**零定序边**：Text 无任何 sim 读者。`TextBinding{resourceId, fromParent?, prefix?, suffix?}`。
> - 复合文案（如「回合 3-2」两个数）= 两个 Text 实体或并排布局，引擎不做模板字符串（保闭语法，单资源单绑定）。
> - 6 测（契约/全局路由+前后缀/fromParent/健壮/与 resource-apply 同帧终态/确定性）。tsc + vitest 1052 + build 全绿。接入派 **inbox F-15**。

---

### REQ-F-044 · [2026-06-10] · PE-F（批C 主角拾取接入，§4.7 预案兑现）· 框架级 · status: **open（待主程评估）** · 优先级: 高（主角拾取入账=Phase 2.5 收口件；"一次性触碰结算"是拾取/独头弹/踩雷通用形状） · 类型: 真缺口（hitbox 无"结算即耗尽"；trigger-zone 双 zone 互斥使"双向两清"不可表达）

> **现象（实测）**：§4.7 的"双向 hitbox 两清"映射有隐藏假设破产——`trigger-zone` 规则=**恰好一方** ZONE_FLAG（两方都 zone → 不产 Trigger，源码注释原文），而球(要写主角 loot)与主角(要杀球)都得是 zone 才能互相结算 → 死锁。单 zone 方向则：球作 zone 写 loot=**每拍重复入账**（站着不走=金币泵）；主角作 zone 杀球=拿不到赏金。
> **证伪重组**：① 让球带 Timer 寿命=未拾取也消失（语义错）；② loot 钳 max+清零链=泵变慢仍是泵；③ 死亡掉"信用区"二段 drop=寿命 1 拍的结算竞态不可靠且三件套绕行（baroque，审查必拍）。→ 缺的是**单发结算**原子语义。
> **建议（交主程裁，倾向 A）**：(A) `Hitbox.consumeOnHit?: boolean`——本拍有任一命中结算后，对**自身（zone 实体）**发 DestroyRequest（cascade 连挂件）。拾取品/独头弹/一次性陷阱同形，最弱 LLM 一个布尔。球=zone{Hitbox{resource:'loot', amount:-5, targetMask:PROTAG}, consumeOnHit}（hitbox amount=伤害语义，入账=负数；§4.7 草图符号反了，已实测钉死），主角零附件。(B) trigger-zone 允许双 zone 配对（影响所有既有 zone 语义，面大，预期回驳）。
> **YAGNI 自审**：批C 当下卡死入账；"碰一下结算一次然后消失"在任何带拾取/弹药的品类都是标配。

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

> **存证（2026-06-10）**：REQ-021 self-rule 扩展 `spawn` 动作（self 轴的 caster 对偶，`{kind:'spawn',template,at:'self'|'target'}`）已由并行 Lead session 落地 @ `299b498`——同模板多实例各自节拍生成、不齐射，解 Game F「每英雄唯一 id 脚手架」。本 Lead 复审：方向符合宣言（既有动词集收窄扩展、非新系统），组合后 tsc + vitest 1028 全绿亲验；接入任务在 inbox **F-9**（原误编 F-5 撞号，已改）。


（Lead 实现后把需求移到这里，标 done + 对应 commit / 新原子名）

### [2026-06-10] · 用户（直发 Lead） · 引擎原生 · status: done · 资源库 v1.3：确定性像素扫描层（不用 API 的程序扫）
- 需求：不花 API 钱，写程序在库里一张张扫、自动打标。
- 落地（`docs/design/asset-library.md` §5.7）：纯核心 png-decode + pixel-tags（HSV 色桶→定序事实标签：颜色/明暗/透明/体量/暖冷调；零随机零 I/O 已单测）+ scan-pixels 脚本双模式（FreeArtLib 全量→tags-scan.json；--assets 合并项目索引）+ build-artlib-index 自动并入 → 搜索/AI 选材零改动吃到；apollo 导入钩子免费必跑。诚实边界：程序只出事实层，主体识别归语义层。
- 首扫：4687/4892 张并入；语义↔色证对账嫌疑 39 条（待人工裁决）。15 条新测试，1039 全绿。

### [2026-06-10] · 用户（直发 Lead） · 引擎原生 · status: done · 资源库 v1.2：入库主动扫描标注（Claude 视觉管线）
- 需求：新资产入库时主动扫描打标；并评估存量 4761 张蛮力重扫成本。
- 落地（`docs/design/asset-library.md` §5.6）：apollo `POST /api/assets/autotag`（contact-sheet 放大 6× → Claude 视觉按受控词表打标 → tags+provenance.autotag 写回索引，单张失败不拖批）；导入向导步骤④默认开「写库后自动扫描标注」。复审抓到并修正 jellyfish 错标（electric→poison）。
- 成本结论：~$0.003/张（Opus 4.8）；存量回填 ≈$13、Batch 半价 ≈$6.5 —— 蛮扫不贵，贵的是占会话；回填走 Batch 脚本，待用户确认花费后执行。

### [2026-06-10] · 用户（直发 Lead） · 引擎原生 · status: done · 资源库 v1.1：语义标签上图 + AI 选材（接 cc3265d）
- 需求：cc3265d 的像素扫描语义标签 ① 能显示在图片上；② 能让 AI 合理选择素材。
- 落地（见 `docs/design/asset-library.md` §5.5）：
  - `artlibSemanticTags()`（与 artlibTokens 合并逻辑严格同构）→ LibraryRecord.semanticTags；网格卡片缩略图底部叠加语义标签条（黛紫 ≤2+n，悬停全量），详情面板语义/结构分组、点击即过滤。
  - **排序器单点** `rankRecords`（名称全等>语义tag>任意tag>子串，AND 全中，确定性稳定序）：浏览器搜索默认 relevance 出序，AI 选材走同一个函数——所见即所选。
  - **AI 选材机制** `resolveArtRefs`（assembly）：manifest 里 `"textureKey":"art:<关键词>"` → 进透视器前确定性替换 top-1 真实 id，无命中原样保留（占位不炸），resolutions 留痕审计；apollo.py 生成 prompt 附写法+常用语义词。宣言尺子：LLM 只产查询字符串，选材在确定性解释器。

### [2026-06-10] · 用户（直发 Lead） · 引擎原生 · status: done · 资源库重构 v1（统一资产库 + 2D 贴图导入器 + 壳层视觉基调）
- 需求：资产库不止美术贴图，**全游戏资源统一整合**——按常见游戏资源分类建目录树；浏览器对标成熟资源管理器（搜索/下拉/tag 过滤）；浏览器兼任**数据导入器**，先聚焦 2D 贴图三种来源（散图/未切割精灵表/乱命名目录）的导入归一化。另：主页+资源库+各游戏返回钮统一「清幽·高雅·高级·秩序」视觉基调。
- 落地（mockup 用户拍板后实施，见 `docs/design/asset-library.md` + `asset-library-mockup.html`）：
  - 统一模型 `src/assets/library.ts`：LibraryRecord + 三来源适配器（项目 index / FreeArtLib / 游戏清单只读）+ 纯查询 + 7 类型分类法（新增 font）；消解了"三套索引互不兼容、studio 每游戏一个 case"的债。
  - 导入器纯核心 `src/assets/import/{sniff,profile,normalize,slice}.ts`：字节头嗅探（PNG/JPEG/WebP/GIF 宽高+透明）、归一化 profile（**规则即数据**，可复放）、planImport（变体分组/hash 剔重/slug/冲突改名/分类规则）、网格切割数学。
  - UI `src/studio/{AssetLibrary,AssetImportWizard}.tsx`（取代 ArtLibBrowser）；写盘 apollo.py `POST /api/assets/import`（路径锁 assets/ 子树、重复 id 整批拒绝、先校验后写）。
  - AssetIndex v2 可选字段（category/tags/source/license/provenance，向后兼容）+ `spec.sheet` → SpriteSheetDescriptor 注册。
  - 壳层基调 `src/ui/shell-theme.ts`（青瓷×墨蓝×淡金设计令牌）：launcher 门面 + GameRunner 统一返回浮钮（游戏代码零改）+ 资源库全量取用。
- 确定性边界不变：全在表现层，sim 只持字符串 key。验收：tsc 干净，983 tests 全绿（新增 ~80），build 通过，apollo 端点冒烟 4/4。

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
