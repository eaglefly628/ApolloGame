# Asset Manifest & Asset Manager — 资产清单与资产管理器设计

> 作者：**PB（Programmer B）** · 状态：**草案，待 review（Lead + Gemini）** · 日期：2026-06-03
> 定位：**Skin 层契约 + 工具**——与"模块库"并列的护城河第二条腿。
> 关联：`docs/design/modular-game-framework.md`（三层分离 / `EnginePort` / AIGP 旁路 X5·X7）、
> `docs/workflow/requests.md`（R1 贴图渲染 / R8 音频后端）。

---

## 0. 一句话

引擎附带一个**"待填充（To-Be-Filled）资产清单"数据结构** + 一个**资产管理器工具**：打开它就知道这个游戏**还差哪些资产、各叫什么、什么描述、什么规格**；用户在引导下**一步步填**，填法有四条（一键生成 / 从库选 / 手动上传 / 程序化占位），AI 只是其中一条路径，**人始终在环、保留掌控**。

## 1. 战略定位：为什么是"契约 + 人在环"，不是"AI 全自动出图"

`modular-game-framework.md` 1.1 节确立的护城河逻辑——**质量沉淀在策展资产里，AI 只做选/填/补，不做从零裸生成**（裸生成 = gameslop，Steam 评分低 15–20%）——对**美术资产同样成立**：

- 每张图现 call 文生图从零生成 → 角色跨表情换脸、跨场景画风漂移、风格不统一、版权/安全失控。
- 正解与模块 pipeline 同构：**策展库（护城河）+ AI 语义选择（智能导购）+ 生成式增量（增强）+ 程序化占位（永远能跑的兜底）**，**重心放在契约（数据结构）上**，而不是某个生成模型上。

**关键差异化**：我们交付的不是"生成器"，是**资产契约 + 管理器工具**。生成后端可替换（Gemini / SDXL / 本地 / 未来任意），契约不变——和"引擎是可插拔后端"一个哲学。

## 2. 核心数据结构：Asset Manifest（TBF 清单）

### 2.1 槽位 Schema（每条 = 一个待填充资产槽位）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 稳定槽位 id（如 `char_S.portrait`、`bg.office`）。**逻辑核心只引用它，永不引用二进制**。 |
| `category` | enum | `background｜character_portrait｜cg｜ui_theme｜icon｜bgm｜sfx｜voice` |
| `name` | string | 人类可读名（"立绘 · 角色S"）。 |
| `description` | string | 语义描述：**既给人看、又作文生图 prompt 种子**。 |
| `requiredBy` | string[] | 溯源：哪些场景/实体/模块引用它（管理器据此告诉用户"哪一幕在等这张图"）。 |
| `spec` | object | 技术规格 = 规范化目标：`type, width, height, aspect, transparent, anchor, format, duration, loop`。 |
| `consistencyGroup` | string? | **同组 = 同一人/同一画风，必须成套填**（立绘多表情、跨场景同角色）。 |
| `anchorRef` | string? | 一致性锚点 id → 锁身份/画风（周期表 X7 `LatentAnchor`），防换脸/漂移。 |
| `variants` | object[]? | 差分子项（表情差分等）：`{ key, description }`，作为一致的一套生成/上传。 |
| `tags` | string[] | 供策展库语义检索（智能导购）。 |
| `status` | enum | `empty｜placeholder｜filled｜approved`（见 2.2）。 |
| `fill` | object? | 填充溯源：`{ method:'procedural｜library｜generative｜upload', source, license, seed?, prompt?, ref }`。 |

### 2.2 status 生命周期状态机

```
(创建槽位)──▶ placeholder ──(某 provider commit + 规范化)──▶ filled ──(人确认)──▶ approved
                  ▲                                              │
                  └──────────────(可重填/重生成，filled→filled)──┘
```

- 槽位一创建即落 `placeholder`（程序化占位）→ **游戏从第一刻起就能跑、永远能跑**，填充是渐进的。
- `empty` 仅用于"连占位都没有"的极端态（一般不出现）。
- `approved` = 人类拍板的最终态；导出正式包时只认 `approved`（或可配置降级到 `filled`）。

### 2.3 一致性组与锚点（X5 / X7）

裸生成最大的命门是一致性，单独拎出来约束：
- **`consistencyGroup`**：管理器把同组槽位**作为一套**处理——一键生成时同批出、用同一 `anchorRef`。
- **`anchorRef` → X7 `LatentAnchor`**：锁角色身份/全局画风（seed / reference image / IP-Adapter，具体依生成后端，先留抽象）。
- **`ui_theme` 槽位**关联全局画风锚点 → 背景、立绘、UI 风格统一（对应 X5 `SemanticMaterial`）。

### 2.4 完整示例（乙游 VN 风格 · 节选）

```jsonc
{
  "gameId": "sample-otome",
  "styleAnchor": { "id": "global.style", "description": "日系乙游，柔粉色调，清透厚涂" },
  "slots": [
    {
      "id": "bg.office", "category": "background", "name": "背景 · 制作人办公室",
      "description": "现代娱乐公司办公室，落地窗，黄昏光线，柔粉色调",
      "requiredBy": ["scene_01_meeting_S"],
      "spec": { "type": "image", "width": 1280, "height": 720, "format": "png" },
      "status": "placeholder", "fill": null
    },
    {
      "id": "char_S.portrait", "category": "character_portrait", "name": "立绘 · 角色S（高冷前辈导演）",
      "description": "30代男性，西装，高冷气质，半身立绘，透明背景",
      "requiredBy": ["char_S"],
      "spec": { "type": "image", "transparent": true, "anchor": "bottom-center", "width": 720, "height": 1280 },
      "consistencyGroup": "char_S", "anchorRef": "char_S.seed",
      "variants": [
        { "key": "neutral", "description": "平静" }, { "key": "cold", "description": "冷淡" },
        { "key": "smile", "description": "罕见微笑" }, { "key": "blush", "description": "脸红" },
        { "key": "shock", "description": "震惊" }
      ],
      "status": "placeholder", "fill": null
    },
    {
      "id": "bgm.daily", "category": "bgm", "name": "BGM · 日常",
      "description": "轻松温柔、都市钢琴", "requiredBy": ["scene_daily_*"],
      "spec": { "type": "audio", "loop": true, "format": "mp3" },
      "status": "placeholder", "fill": null
    }
  ]
}
```

## 3. 自动派生：清单从蓝图来（开发期 / 产品期统一）

**清单不手工维护，从游戏蓝图/内容里自动聚合**——和"模块 manifest 聚合成 Game Manifest"同构：

- 蓝图/内容**声明**它引用的资产槽位（`Sprite.textureKey="char_S.portrait@neutral"` 等语义引用）。
- 构建期扫描所有引用 → 去重 → 生成 Asset Manifest（带 `requiredBy` 溯源）。

于是**同一个结构服务两端**：
- **开发期（我们现在）**：它是"这个游戏还差哪些美术"的活规格。
- **产品期（小白用户）**：把这份清单交给资产管理器，用户在引导下填掉。

开发和终端用户共用同一套契约，不是两套。

## 4. 填充 Provider 接口（可插拔四路，同一契约）

```ts
interface AssetProvider {
  id: 'procedural' | 'library' | 'generative' | 'upload';
  canFill(slot: AssetSlot): boolean;
  // 提案候选：库/生成返回多个供"导购"选；上传/占位返回一个
  propose(slot: AssetSlot, ctx: FillContext): Promise<AssetCandidate[]>;
  // 用户选定 → 产出规范化前的原始资产 + 溯源
  commit(slot: AssetSlot, choice: AssetCandidate): Promise<RawAsset>;
}
```

| Provider | 行为 | 面向 |
|---|---|---|
| `procedural` | SVG/CSS 程序化占位，零依赖永远兜底（默认） | 兜底 |
| `library` | 策展库语义检索，给 3–4 个好选项（智能导购） | 都可 |
| `generative` | 按 `description`+`anchorRef` 调文生图/文生乐，同组成套出 | 小白【一键生成】 |
| `upload` | 手动传文件 → 进规范化 | 老手 |

四条路都往**同一个槽位契约**写 `fill`——这就是"覆盖小白到老手"的工具集。

## 5. 资产管理器（引擎附带工具，UX）

```
┌─ 资产管理器 ──────────── 进度 [▓▓▓░░░░] 3/12 已填 ─┐
│ ▸ 背景 (1/3)                                        │
│   bg.office   "制作人办公室…"  [占位] [一键生成][选库][上传] │
│ ▾ 立绘 · 角色S  组(0/5 表情)  ⚠ 需成套填             │
│   预览缩略 · 描述 · [一键生成整组][上传整组][选库]   │
│ ▸ 音频 (0/2)                                        │
└────────────────────────────────────────────────────┘
```

- 按 `category` / 场景分组的清单 + 进度条。
- 每槽一行：名字 + 描述 + 预览 + `status` + provider 按钮。
- `consistencyGroup` **作为一套**操作（整组生成/上传）。
- 填充即：provider `commit` → 规范化 → 写 `status=filled` + `fill` 溯源；人确认 → `approved`。

## 6. 规范化流水线

无论来源，落库前统一到 `spec`：

```ts
interface Normalizer { process(raw: RawAsset, spec: AssetSpec): Promise<NormalizedAsset>; }
// 抠图(立绘透明) · 统一尺寸/锚点(表情差分对齐眼线) · 打图集 · 压缩 · 格式转换 · 版权/安全过滤
```

## 7. 与运行时对接 & 确定性边界

- **AssetResolver**：`slot.id` →（`filled/approved` 取真资产，否则取 `placeholder`），保证缺资产也可玩。
- **加载**：经 `EnginePort.asset.preload(bundle)` 预载；运行时 `view.spawn(entity, visualType)` 把 `visualType`(=slot.id) 映射到解析结果。**消费端 = `requests.md` R1（贴图渲染）/ R8（音频后端）**。
- **确定性**：资产是**表现层**。逻辑核心只引用 `slot.id`（稳定字符串），**像素/音频不进模拟哈希**。→ 填充/重生成**不破坏 lockstep / 录放确定性**。这条缝和 `EnginePort` 一致、天然干净。

## 8. 归属与分期

| | 现在能做（不阻塞 Game B） | 需立项（框架级，Lead 拥有 canonical） |
|---|---|---|
| **PB** | 定义 Game B 的**槽位契约**实例；实现 **`procedural` 占位 provider**；蓝图里用语义引用挂槽位 | — |
| **Lead / 架构** | — | canonical Asset Manifest schema + AssetResolver + Provider 接口；`library` 检索；`generative` 集成 + X7 锚定；规范化流水线；资产管理器工具 UI |

**Game B 是第一个、也是最吃资产的验证消费者**（多角色 × 多表情 + 多背景 + UI 主题 + BGM/语音）——像它压测叙事系统一样压测资产 pipeline。飞轮一致。

## 9. 给 Reviewer 的开放问题（Lead + Gemini）

1. **canonical schema 落点**：放哪个包/路径？每游戏一份 `asset-manifest.json` vs 从 Game Manifest 聚合派生——倾向后者（§3），请确认。
2. **Provider 是否并入 `EnginePort` 家族**，还是独立 `AssetPort`？（生成/上传是编辑期能力，运行期只需 `asset.preload`——可能该分两层。）
3. **一致性锚定（X7）实现路径**：seed lock / reference image / IP-Adapter？依赖生成后端，先留抽象接口是否可接受？
4. **生成后端选型 + 网络/key 策略**：Gemini image / SDXL / 本地？谁持有 key、什么网络策略放行？
5. **版权 / 安全过滤**归谁、在规范化哪一步。
6. **`procedural` 占位规格**：占位要"能看"到什么程度才够验证手感/演出（纯色块够吗，还是要简笔立绘 + 表情符号）？
7. **导出策略**：正式包认 `approved` 还是可降级 `filled`？缺 `approved` 时是否允许带占位发布。

---

> **下一步**：本草案推 mainbranch 后挂 `requests.md` review 请求给 Lead；Gemini 同步 review。收敛后 PB 落地 §8 的"现在能做"两件事（槽位契约 + 占位 provider）。
