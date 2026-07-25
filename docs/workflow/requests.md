# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-SPENDONFIRE-发射即扣发射源一发（per-shot 扣弹·N 实体各自计数）· [2026-07-25] · PE-game102 报（owner 环轨玩法「面上还剩几发/打光消失/选错色满弹返回」撞墙）→ Lead 裁 · status: **open** · 优先级: P1（game102 核心机制前提·塔防/射击/弹药类通用） · 类型: 引擎能力缺口（主程域·先重组已证不可得）
> **想实现的行为**：一门炮有 `ammo` 发子弹；**每真正命中一发才 ammo-1**（选错色/空过那圈**不减**）→ ① 炮面动态显示「还剩几发」② 打光即中途消失 ③ 选错色满弹返回平台。轨道上**同时 N 门炮各持自己的 ammo**。通用于塔防/射击/任何「N 个发射体各自弹药计数」。
> **已试（PE 源码复核）**：开火 = `self-rule{ do:[spawn bullet at:'target', modify-resource ammo -1] }`。**两条都不成**：① `at:'target'` 无目标时天然跳过 spawn（对），但**同 do 里的 `modify-resource` 无条件照跑** → 空过也扣弹（`self-rule.ts` do 动作彼此独立·无「spawn 成功才扣」绑定）；② 想让**子弹**回头扣发射源的 ammo：`ResourceModify` 仅 `local`/`global` 作用域（`components/logic.ts`）——local=改子弹自己、global=按 id 串扣**第一门**同名 ammo炮（N 炮全共享 `ammo` id → 扣错炮）。**无 source 路由**（虽 `PrefabOrigin.source` 已存在、`hitbox.ts findScaleResource` 已用它做 per-caster 读，但**写**侧无对应）。`self-rule` 的 `when` 条件闭集（resource/flag/state/timer/string）**无「有 target 才成立」门** → 也无法把扣弹 gate 在开火上。
> **卡在哪 / 缺什么**：缺「**命中/发射即扣其发射源实体一发**」的 per-entity per-shot 消耗——N 实体各自计数、确定性、进 hash。**禁游戏层自写 N 炮弹药散逻辑**（红线）→ 下沉引擎。
> **建议方案（Lead 裁·二选一）· 边界**：① **`ResourceModify` 加 `scope:'source'`**——resource-apply 遇 source 作用域时改 `PrefabOrigin.source` 实体上的该 id 资源（复用已有 source 盖章·最薄）；子弹模板挂 `ResourceModify{resourceId:'ammo', amount:-1, scope:'source'}` → 子弹只在**真生成时**（=有目标）才存在 → 天然 per-shot 扣发射源。或 ② 新薄件 `spend-on-fire`：发射体命中/生成即对 `PrefabOrigin.source` 扣一发。**触碰范围**：`src/skills/**`（resource-apply 加 source 路由 + 测试）+ `src/engine/protocol/components/logic.ts`（scope 枚举加 'source'）；game102 只经数据消费。撞墙实证＝`docs/design/game102/core-experience-v2.md §2.1 F` + `src/games/game102/blueprint.ts`（`cannon_*` 开火 do）。

### REQ-TAPSPAWN-加权掉表生成器原语（tap→耗资源→加权 spawn） · [2026-07-24] · PE-101 报（capability-plan §6 G1「撞墙→下沉 tap-cost-spawn」的回报）→ Lead/主程 裁 · status: **⚖ Lead 裁 ✅ 下沉 `weighted-spawn`（2026-07-24·spec 已备·⏸ 缓建）** · 优先级: P3（**owner 2026-07-24：game101 先迭代设计·M1 不急** → 不现在建·待 M1 提上日程再动手·spec 现成） · 类型: 引擎通用能力缺口（合并/idle/gacha 通用·主程域）
> **⏸ 缓建（owner 2026-07-24「game1 先迭代·M1 不急」）**：裁决 ✅ 下沉 + spec 已定（下方），但**不现在建**——game101 先做设计/布局/经济迭代（GD-101/PE-101 域），M1 灰盒（需本件）待 owner 提上日程再由主程/Opus 照 spec 施工。
> **⚖ Lead 裁（2026-07-24）：✅ 下沉**——PE-101 已源码复核实锤真墙（无「加权运行时 spawn」原语·`caster`/`self-rule` 只固定 template·`effect-apply` 不能 create·`draft-offer` 加权核 private + 自建 seed 不接世界 `RandomSeed`）；正是 G1 §6 预祝福的 `tap-cost-spawn`。合并/idle/gacha/loot 通用·真缺口非重组可得（宪法 §2）。
> **⚖ Lead spec（→主程/Opus 施工）**：新 **ECS capability `weighted-spawn`**（`src/skills/tier2/weighted-spawn.ts`·`defineCapability`·登记 `src/assembly/capability-registry.ts`）——组件 `WeightedSpawn{ onSignal, cost?:{id,amount}, table:[{templateId,weight}] }`；系统：收 `Signal.name==onSignal` → 若 cost 则**原子 afford**（不足整单不动·同 `craft-recipe` 口径）+扣 → 读**世界 `RandomSeed` 单例** `nextRandom` 加权抽 templateId → 发 `SpawnRequest{templateId, x/y=自身 Transform}`；相位早于 spawner 消费。**必用世界 RandomSeed（禁 fixed seed·保 sim hash/回放确定性）**。**并**从 `draft-offer` 抽出+导出纯函数 `weightedPick(entries, rand)`（DRY·draft-offer 内部复用之）。测试：afford 拒/扣·同 RandomSeed 序列同抽·加权分布·SpawnRequest 落点·空表/权重 0 边角。game101 只经 `generators.json` 数据消费（零游戏层加权/裸 Math.random）。
> - **想实现的行为**：生成器（merge/idle 通用）——点一下 → 若资源(体力)≥cost 扣费 → 从掉落表 `[{item,w}]` 按**引擎种子 PRNG** 加权抽一个 item → 在生成器处 `SpawnRequest` 该 item。数据已备 `src/games/game101/config/generators.json`。
> - **已试（子代理源码复核契约）**：✅ 扣费半场可组合＝`clickable`(点→Signal)+`craft-recipe`(onSignal·costs 原子 afford+扣)（game-q build-pad 近乎现成模板）。❌ **加权 spawn 半场无原语**：`caster`/`self-rule` 只 spawn **固定 template**；`effect-apply` writes 无 SpawnRequest（能 destroy 不能 create）；`draft-offer.weightedPickDistinct` **private 未导出**、`rollOffer` 导出但**自建 mulberry32(seed)·不接世界 `RandomSeed`**、且**未接线成 SpawnRequest**。无任何能力把 `{item,w}[]`+`RandomSeed`→选 template→`SpawnRequest`。❌ 且单点「afford→spawn」不干净可组合（craft-recipe 无成功 Signal·caster 无 cost）。
> - **卡在哪**：缺「加权运行时 spawn」原语（＝§6 预判的 `tap-cost-spawn`）。**禁游戏层手写加权/裸 Math.random**（manifesto 红线）→ 必须下沉引擎。
> - **建议方案（§6 已预祝福其形）· 边界**：下沉通用能力 `tap-cost-spawn`（或 `weighted-caster`）——组件 `TapSpawn{ onSignal, cost?:{id,amount}, table:[{item,w}] }`；系统在信号时（可选 afford+扣 cost）→ 读世界 `RandomSeed` 走 `nextRandom` 加权抽 → 发 `SpawnRequest{templateId, at:self}`。**必用世界 RandomSeed（禁 fixed seed·保 hash 确定性/回放）**。可拆两件：①从 `draft-offer` 抽出并**导出纯函数 `weightedPick(items,weights,rand)`**；② `caster` 加 `table?` 变体 / 新 `weighted-caster` capability 消费之。**触碰范围**：`src/skills/**`（新 capability + 导出 draft-offer 纯函数 + 测试），game101 只经数据消费。撞墙实证＝`docs/design/game101/requests.md REQ-101-06`。


### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。

<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结迁归档（requests-archive.md）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 全文见 `requests-archive.md`

> 所有 done/wontfix/作废 条目（含裁决理由与完工摘要）已归档到 `requests-archive.md`；查旧单先 grep 它。本池只留活跃 open/in-progress/排队 条目（防每读付历史 token·owner 2026-07-04 token 底盘优化）。

## 需求模板（复制这段填写·先确认：游戏级工单请写该游戏的 `docs/design/<game>/requests.md`，此处只收引擎级）

```
### [YYYY-MM-DD] · [提出人角色] · status: open
- 想实现的行为：
- 已经试了什么（哪些能力 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案（可选）· 边界（本单允许触碰的文件范围·复查门核对用）：
```

---
