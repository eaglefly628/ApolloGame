# AI 数据编辑器 —— 架构设计 + Gemini 评审请求（2026-06-07）

> 双重用途：① ZeroCraft「可视/AI 双模编辑器」的长期设计文档；② 自包含的 Gemini 外审包（含真实代码摘录 + §6 评审问题）。把整份发给 Gemini 即可评审，无需它读仓库。

---

## 0. 给 Gemini：背景 + 请评审什么

ZeroCraft Preview = **游戏即数据**：ECS 引擎是固定的确定性解释器；一局游戏 = 一份 **Manifest**（`{ capabilities:[能力id], entities:{ 实体id:{ 组件名:数据 } } }`），导出/导入对称（`exportManifest`/`parseManifest`）。原子组件（29 核心+1 扩展）+ Tier1/2/3 能力 + 逻辑链 Condition→Event→Effect。

现在要在其上做一个**商业级编辑器**，目标两条：(a) 对人类友好（传统可视化编辑）；(b) **对任意强弱大语言模型都鲁棒**——我们刻意要支持多模型，弱到 7B 本地模型也要能稳定产出可用编辑，不赌单一强模型。

**核心原则**：**编辑器 = 底层数据的"强类型投影"；大模型 = 一个受限的"表单填写器/结构化提取器"，不是生成器。** 难的部分（校验、纠错、预览、撤销）全压在确定性编辑器代码里。请评审下面的架构并回答 §6。

---

## 1. 现有地基（请对着这些真实代码评审，非空想）

**1a. 能力自描述 schema**（`src/engine/core/define-capability.ts`）—— 编辑器 Inspector 的元数据源：
```ts
export type FieldType = 'number'|'string'|'boolean'|'EntityId'|'string[]'|'number[]';
export interface ComponentSchema {
  category: 'resource'|'event'|'intent'|'marker'|'config'|'render'|'effect';
  describe: string;
  fields: Record<string, { type: FieldType; describe: string }>;   // 每字段:类型 + 人话
}
export interface CapabilityConfig {            // 能力级旋钮:已自带 UI 提示 + 填参问题
  type: 'number'|'string'|'boolean'|'select';
  default: unknown; describe: string; question: string;            // ← question = 问题驱动填参
  ui: { control: 'slider'|'toggle'|'chips'|'input'; min?:number; max?:number; step?:number; options?:string[] };
}
export interface CapabilityDefinition {
  id: string; describe: { name; summary; semantic; whenToUse; examples };
  components: { provides: Record<ComponentType, ComponentSchema>; reads; writes; consumes };
  config: Record<string, CapabilityConfig>; systems: SystemDeclaration[];
}
```
> 要点：**组件字段(type+describe)** 与 **能力 config(ui 控件 + min/max/step/options + question)** 都已是数据。Inspector 表单与"问题驱动填参"可直接从这里自动生成。

**1b. 强校验拦截器 R12**（`src/assembly/validate-manifest.ts`）—— AI/手改产出的数据护城河：
```ts
validateComponentData(capabilities, entities): { errors: SchemaIssue[]; warnings: SchemaIssue[] }
// 复用各能力 provides[Type].fields 当 schema，绝不另造：
//   error（拒绝加载）：声明 number/boolean 的字段给了别的基元类型
//   warning（不阻断）：字段不在声明字段中（疑似拼错，并反向暴露未声明完整的组件）
//   刻意只硬查 number/boolean（string 被复杂字段当占位，严格查会误报）
```

**1c. 能力注册表 = 闭合词表**（`src/assembly/capability-registry.ts`）：
```ts
CAPABILITY_REGISTRY: Map<id, CapabilityDefinition>      // id→能力对象（manifest 加载地基）
COMPONENT_PROVIDERS: Map<组件类型, 能力id>              // 组件→提供它的能力（反推/校验）
resolveCapabilities(ids) // 未知 id 立刻抛错  ｜ inferCapabilityIds(entities) // 据组件反推能力（兜底）
```

**1d. 加载管线**（`src/assembly/manifest.ts`，`parseManifestDetailed`）：raw → 结构校验 → 解析/推断 capabilities → 无 provider 告警 → **R12 类型校验（error 拒载）** → 可运行 `WorldBlueprint`。

**1e. 执行落地体检 ZeroCraftBench**（`src/bench/`）：把蓝图喂进真引擎跑 N tick，按 Structure/Load/Determinism/Numeric/Visual 打分 —— **编辑后的"安全网"**（改坏了：NaN/全跑出屏 → 分数掉，自动告警/驳回）。

---

## 2. 编辑器 = 数据的强类型投影（GUI）

- **Scene View**：复用 `CanvasRenderer`，引擎跑在 **Edit Mode**（暂停 tick，仅渲染 Transform + Shape/Sprite）。拖拽实体 = 实时改 `Transform.x/y`。
- **Hierarchy**：映射 `world.getAllEntities()` + `Hierarchy` 组件。
- **Inspector（重点，绝不放代码框）**：Schema-Driven 动态表单，从 §1a 自动生成——
  - `number` → 滑块（min/max/step 取自 `config.ui`）；`boolean` → 开关；枚举 → chips/下拉（options）；
  - `textureKey` → 下拉，**数据源严格绑定 AssetIndex（只能选、不能瞎填）**；
  - `ConditionExpr`（B 轴条件树）→ 图形化积木/逻辑树点选。
- 结论：**人和 AI 改的是同一份 JSON；UI 是数据的可视化投影。**

## 3. 防御性 AI 管线（弱模型也鲁棒）

```
自然语言 + 选中实体上下文 + schema 菜单
  └─▶ LLM 产 edit-ops[]（纯 JSON，极小输出面）
        └─▶ 模糊解析（别名吸附:"重力"→Acceleration.ay）
              └─▶ 强校验（R12 + 注册表:非法丢弃/带错重试一次/Inspector 标红）
                    └─▶ 应用为数据 patch（不可变 diff）
                          └─▶ 预览(parseManifest+引擎) + ZeroCraftBench 打分 ─▶ 撤销/重做
```
- **收缩操作空间**：闭合 edit-op 集（`set/nudge/setColor/addComponent/removeComponent/addEntity/removeEntity/enableCapability`）。模型只做"从自然语言提取 组件名/字段名/数值 → 吐 JSON"，不写逻辑——7B 也能做好。
- **上下文限定**：只喂**选中实体**的组件列表 + 相关 schema，不喂整局 JSON。上下文越小，弱模型注意力越集中。
- **AI 粗加工 + 人类精调**：AI 改完 → Inspector 滑块/数值**立即反映** → 改太夸张就直接拖回。AI 搭框架，UI 兜底精调。

## 4. 模型无关的关键杠杆（对"不赌强模型"这条硬约束）
1. **输出面极小**：几条 op、每条几个字段（弱模型强于短结构化、弱于长篇生成）。
2. **闭合词表**：op 类型 / 组件名 / 字段名 / 能力 id 全部枚举自注册表 → 模型从菜单挑，不发明。
3. **确定性兜底**：模糊解析吸附近似词 + R12 拒非法 + 一次带错重试 → **正确性在代码里，不在模型里**。
4. **接地**：喂当前真实数据 + schema → 改现实不改幻觉。
5. **可预览可撤销**：op 应用即预览 + 体检分 → 改错当场可见/自动驳回，绝不静默上车。

## 5. 我（Claude）提请 Gemini 裁的两处细化/分歧
- **R1：别依赖原生 tool-calling。** 用户初稿写"给模型一组 API Tool Calls 规范"。我倾向让模型吐**纯 JSON edit-ops 文本、我们自己解析 + 模糊吸附**，而非依赖各家 provider 的 native function-calling——弱/本地 7B 的 native tool-call 经常格式坏甚至不支持（= 反复重试"空转"）。纯文本自解析更跨模型。**Gemini 站哪边？**
- **R2：ConditionExpr 别让模型吐整棵树。** 连"搭条件树"对弱模型都偏难。倾向把条件构建也拆成 ops（`addLeaf{resource,cmp,value}` / `setLogic{and|or}`），或只暴露"从预置条件模板选 + 填阈值"。**会不会牺牲表达力？**

## 6. 给 Gemini 的评审问题（请逐条回应）
1. **edit-ops 粒度**：作为"模型无关编辑"的接口面，这个粒度对吗？会不会太细（改一处要发多 op）或太粗（一个 op 干太多、难校验）？
2. **模糊解析层**：把"重力/颜色/速度"吸附到具体字段——是必要鲁棒性还是隐患？如何防"自信地改错字段"（silent wrong target）？吸附该有多激进，边界在哪？
3. **弱模型评测**：我们打算建 edit-eval（自然语言→期望效果，跨 Claude/Qwen/本地模型测成功率）。指标设计有什么坑？如何避免"过拟合到测试用例"、如何度量"跨模型一致性"？
4. **native tool-calling vs 纯 JSON 自解析**（§5 R1）你怎么选？
5. **上下文限定 vs 全局编辑**：只喂选中实体会不会丢"跨实体编辑"（"让所有平台变蓝"）？限定与全局如何取舍？
6. **自描述够不够**：`config.ui`(slider/min/max/options) + `question` 这套，够驱动商业级 Inspector + 问题驱动填参吗？还缺什么元数据？
7. **校验严格度**：R12 目前只硬查 number/boolean（string/数组跳过避免误报）。对 AI 产数据够吗？哪些该升级成 error（拒载）？枚举/范围/引用完整性要不要进强校验？
8. **隐性风险 / 同行教训**：这套架构最大的隐性风险是什么？Unity/Unreal/Roblox/Defold（及它们的 AI 助手）在"数据驱动 + AI 编辑"上有哪些可借鉴的成败教训？

## 7. 落地切片（MVP，先做这个）
`set/nudge/setColor` 三 op + 确定性应用器 + 别名解析表（重力/速度/颜色/大小高频项）+ `edit-eval`（6~8 例）+ 对话框走 `/api/edit`。**确定性部分（应用器 + 解析 + eval）完全不依赖任何模型即可测通**——这是整套"模型无关"的硬地基；LLM 端点后接，强弱模型都灌进同一管线。
