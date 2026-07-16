# UI 绑定层设计稿 v1（REQ-UI-锚定与绑定层 ②）· PUI · 2026-07-16

> **状态：设计稿·待 Lead + PST 共审**（spec 铁律「设计稿先行·不许直接开写」）。过审才施工。≤2 页。
> 目标：LayoutNode 属性可**声明式绑定世界状态**，弱 LLM 不写 TS builder 也能交付活 HUD。**闭集词汇·非自由表达式语言。**

## 0. 现状（绑定层已有的一半·不重造）

- `UIDataSource` DI（`bindings.ts`）：`resource(id)→{current,max}` · `value(id)→string` · `flag(id)→bool`（游戏/引擎注入·解耦 ECS）。
- `resolveBindings(tree, ds)`：**渲染前纯函数 pass**，把带绑定的节点读世界填成字面值 → 交 `renderNode`（renderNode 保持世界无关）。现填：`Label.bind`(resource→text 前缀+current) · `ProgressBar.bind`(resource→value/max) · `Image.bind`(string→src) · `visibleWhen`(flag→剔子树)。
- **红线（守住）**：绑定=`id 字符串`（最弱 LLM 能填）· **只读显示**（写世界走 `action` 信号）· 缺 reader/未命中=安全默认（不误删·不崩）。

## 1. 词汇闭集（Binding Vocabulary）—— **PST 共审核心**（进生成 prompt 词表）

**① 源前缀闭集** `Ref = "<kind>:<id>"`（现 `bind` 字段是裸 id·本设计**加前缀区分源**）：
| 前缀 | 读 | 用途 |
|---|---|---|
| `resource:<id>` | `{current,max}` 数值 | 血/金/经验/计时/进度 |
| `flag:<id>` | 布尔 | visibleWhen / enabledWhen |
| `string:<id>` | 字符串 | 名字/描述/头像 src |

**不收**：自由表达式 / 算术 / 条件 / 多源组合（`resource:a + resource:b`）——那是 TS 逃生，**回驳**。向后兼容：裸 id（无前缀）默认按 `resource`（现行为）。

**② 可绑属性白名单（Bindable-Prop Registry·闭集）** —— 每控件哪些 prop 可绑、配哪种源。生成器只能对表内组合填 `bind`：
| 控件.prop | 源 | 说明 |
|---|---|---|
| `Label.text` | resource / string | resource→数值（配 format/模板）；string→整串 |
| `ProgressBar.value(+max)` | resource | current→value · max→max |
| `Image.src` / `Avatar.src` | string | 动态图 URL |
| `Badge.text` | resource / string | 计数药丸/状态 |
| `(node).visibleWhen` | flag | 已有（`!` 取反·剔子树） |
| `(node).enabledWhen` | flag | **新增候选**（为假→灰置 disabled·不剔树）·待 Lead 裁 |

**③ 格式化（数值绑定的显示）**：
- 复用 `Label.format`（既有闭集·compact 1.2K/time mm:ss/percent/int）。
- **模板占位闭集** `{cur}` / `{max}` / `{v}`(=cur)：如 `'金 {cur}'` · 血条文字 `'{cur}/{max}'`。**只这三个占位**（非自由插值·非表达式）。

## 2. 声明形态（复用既有字段·不新造语法）

- **统一走既有 `bind:'<ref>'` 字段**（Label/ProgressBar/Image 已有）+ 扩到 Badge/Avatar + 同控件的 `format`/模板 prop。
- **不采** spec 示例的 `text:{bind,format}` 对象形态——与既有 `bind:string` 字段**冲突**、且给弱 LLM 两套写法。**统一一套**（`bind` 字段 + `format`/模板）。→ **设计决策，请 Lead 裁。**
- `visibleWhen`(flag) 已有；评估加 `enabledWhen`(flag)。

## 3. 更新时机 + 与 visibleWhen/tween/format 的关系

- **时机（保持现模型）**：世界变更 → 重跑 `resolveBindings(tree, ds)` → `mountUI.update(newTree)`（最小 diff·不重挂·态不丢）。game-i 已是此模型（`ui.update`）。
- **四者正交可叠**：`bind`（取世界值）→ `format`/模板（怎么显示）→ `tween`（可选·数字变化的平滑过渡）→ `visibleWhen`（结构在不在树里）。互不侵占。
- **高频数值**（血/计时每帧变）：默认每次 update 直接跳变；是否给绑定值**可选 tween 过渡**（bind 值变化时自动滚动到新值）= P2 评估项（避免每帧起 tween 的开销）。

## 4. 红线（不破）

- Ref=闭集前缀 + id 字符串·**绝不收自由表达式**；只读显示·写世界走 action；`resolveBindings` 纯函数渲染前 pass·不污染 `renderNode`；缺 reader/未命中=安全默认。

## 5. 待 Lead 裁的设计决策

- **(a) 声明形态**：统一 `bind` 字段 vs spec 的 `text:{bind,format}` 对象？（PUI 倾向前者·与既有一致·一套写法）
- **(b) 模板占位闭集**：`{cur}{max}{v}` 够不够？要不要更多（如 `{pct}`）？
- **(c) `enabledWhen`（flag→灰置）**：本单纳入还是 P2？

## 6. PST 共审点（词表进生成 prompt）

- 源前缀三种（resource/flag/string）够覆盖生成需求吗？世界状态 id 词表从哪来（= 游戏 capability-plan 的资源/旗标清单·生成器需实名对照）？
- **可绑属性白名单**（§1②）= 生成 prompt 里「可填 bind 的白名单表」——PST 的生成器直接吃这张表，别让它对表外 prop 填 bind。
- 模板占位闭集会进 prompt 词汇——`{cur}{max}{v}` 范围请 PST 确认够用（避免生成器想写自由插值）。

## 7. 分期（过审后）

- **P1（本单②）**：`bind` 加源前缀 + 扩 Badge/Avatar + format/模板占位 + **bindable-prop 白名单固化**（catalog 标注 + 校验器挡表外绑定）+ 点名测试 + **game-i 活范例**（一屏绑定 HUD：金币 Label.bind+format、血条 ProgressBar.bind、名字 Avatar.bind、visibleWhen 开关）。
- **P2（评估）**：`enabledWhen` · 绑定值 tween 过渡 · 更多控件。

> **交付物本身 = 本设计稿**。过 Lead + PST 共审后，PUI 才按 §7 P1 施工。未过审前**不写代码**。
