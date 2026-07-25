# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-TAPSPAWN-加权掉表生成器原语（tap→耗资源→加权 spawn） · [2026-07-24] · PE-101 报（capability-plan §6 G1「撞墙→下沉 tap-cost-spawn」的回报）→ Lead/主程 裁 · status: **⚖ Lead 裁 ✅ 下沉 `weighted-spawn`（2026-07-24·spec 已备·⏸ 缓建）** · 优先级: P3（**owner 2026-07-24：game101 先迭代设计·M1 不急** → 不现在建·待 M1 提上日程再动手·spec 现成） · 类型: 引擎通用能力缺口（合并/idle/gacha 通用·主程域）
> **⏸ 缓建（owner 2026-07-24「game1 先迭代·M1 不急」）**：裁决 ✅ 下沉 + spec 已定（下方），但**不现在建**——game101 先做设计/布局/经济迭代（GD-101/PE-101 域），M1 灰盒（需本件）待 owner 提上日程再由主程/Opus 照 spec 施工。
> **⚖ Lead 裁（2026-07-24）：✅ 下沉**——PE-101 已源码复核实锤真墙（无「加权运行时 spawn」原语·`caster`/`self-rule` 只固定 template·`effect-apply` 不能 create·`draft-offer` 加权核 private + 自建 seed 不接世界 `RandomSeed`）；正是 G1 §6 预祝福的 `tap-cost-spawn`。合并/idle/gacha/loot 通用·真缺口非重组可得（宪法 §2）。
> **⚖ Lead spec（→主程/Opus 施工）**：新 **ECS capability `weighted-spawn`**（`src/skills/tier2/weighted-spawn.ts`·`defineCapability`·登记 `src/assembly/capability-registry.ts`）——组件 `WeightedSpawn{ onSignal, cost?:{id,amount}, table:[{templateId,weight}] }`；系统：收 `Signal.name==onSignal` → 若 cost 则**原子 afford**（不足整单不动·同 `craft-recipe` 口径）+扣 → 读**世界 `RandomSeed` 单例** `nextRandom` 加权抽 templateId → 发 `SpawnRequest{templateId, x/y=自身 Transform}`；相位早于 spawner 消费。**必用世界 RandomSeed（禁 fixed seed·保 sim hash/回放确定性）**。**并**从 `draft-offer` 抽出+导出纯函数 `weightedPick(entries, rand)`（DRY·draft-offer 内部复用之）。测试：afford 拒/扣·同 RandomSeed 序列同抽·加权分布·SpawnRequest 落点·空表/权重 0 边角。game101 只经 `generators.json` 数据消费（零游戏层加权/裸 Math.random）。
> - **想实现的行为**：生成器（merge/idle 通用）——点一下 → 若资源(体力)≥cost 扣费 → 从掉落表 `[{item,w}]` 按**引擎种子 PRNG** 加权抽一个 item → 在生成器处 `SpawnRequest` 该 item。数据已备 `src/games/game101/config/generators.json`。
> - **已试（子代理源码复核契约）**：✅ 扣费半场可组合＝`clickable`(点→Signal)+`craft-recipe`(onSignal·costs 原子 afford+扣)（game-q build-pad 近乎现成模板）。❌ **加权 spawn 半场无原语**：`caster`/`self-rule` 只 spawn **固定 template**；`effect-apply` writes 无 SpawnRequest（能 destroy 不能 create）；`draft-offer.weightedPickDistinct` **private 未导出**、`rollOffer` 导出但**自建 mulberry32(seed)·不接世界 `RandomSeed`**、且**未接线成 SpawnRequest**。无任何能力把 `{item,w}[]`+`RandomSeed`→选 template→`SpawnRequest`。❌ 且单点「afford→spawn」不干净可组合（craft-recipe 无成功 Signal·caster 无 cost）。
> - **卡在哪**：缺「加权运行时 spawn」原语（＝§6 预判的 `tap-cost-spawn`）。**禁游戏层手写加权/裸 Math.random**（manifesto 红线）→ 必须下沉引擎。
> - **建议方案（§6 已预祝福其形）· 边界**：下沉通用能力 `tap-cost-spawn`（或 `weighted-caster`）——组件 `TapSpawn{ onSignal, cost?:{id,amount}, table:[{item,w}] }`；系统在信号时（可选 afford+扣 cost）→ 读世界 `RandomSeed` 走 `nextRandom` 加权抽 → 发 `SpawnRequest{templateId, at:self}`。**必用世界 RandomSeed（禁 fixed seed·保 hash 确定性/回放）**。可拆两件：①从 `draft-offer` 抽出并**导出纯函数 `weightedPick(items,weights,rand)`**；② `caster` 加 `table?` 变体 / 新 `weighted-caster` capability 消费之。**触碰范围**：`src/skills/**`（新 capability + 导出 draft-offer 纯函数 + 测试），game101 只经数据消费。撞墙实证＝`docs/design/game101/requests.md REQ-101-06`。

### REQ-MERGEDIG-合并挖掘·二消清邻格阻碍层（merge-proximity-clear） · [2026-07-25] · GD-101 报（owner 核心乐趣·参考图 Gossip Harbor 实机·IP 不入库）→ Lead/主程 裁 · status: **✅ 实现已交·待 Lead 复核**（PE-101 按 owner「game101 核心循环端到端建·不必等裁」标准建·同 merge-on-place/order-fulfill 口径；Lead 复核 API/边界后转 done 归档腾槽） · 优先级: P1（game101 核心乐趣·心流加成器·merge/match 品类通用） · 类型: 引擎机制能力缺口（主程域·先重组再下沉）
> **✅ 实现（2026-07-25·PE-101·commit 见下·标记 Lead 复核·非绕过）**：下沉 `t2-merge-proximity-clear`（`src/skills/tier2/merge-proximity-clear.ts`·登记 registry）——`merge-on-place` 合成时发 `MergeEvent{x,y}`（新增·加性·5 测仍绿）→ 本件读 `MergeEvent` + 单例 `MergeProximity{cellSize,radius,dec}` → 对半径内 `Blocker{layers,reveal}` 各 −dec·归零 DestroyRequest + reveal（spawn=SpawnRequest / resource=资源+amount 钳限）。Chebyshev 邻格判定（整数格·确定性·无随机·消费 MergeEvent）。**减层全在引擎 sim·零游戏层/宿主扫格**（红线守）。7 单测（3×3 减层/归零清层+reveal spawn/reveal resource/多层/缺单例零回归/消费）。组件 `Blocker`/`MergeEvent`/`MergeProximity`（component-map+baseline 更）。game101 只经 `board-cover.json` 数据消费（游戏工单 REQ-101-08·真机挖开目击在案）。**若 Lead 判 API/相位/边界需调，PE 配合改。**
> **想实现的行为**：合并板整片被**阻碍层**（沙层/锁格）盖住·不可用；玩家**二消**（`merge-on-place` 拖同类合成）在 cell C 发生 → **C 的 3×3 网格邻格 `Blocker.layers` 各 −N**（N=decPerMerge）→ 某格归零 → 发**解锁信号**（供 `event-when` 清层 + `caster/prefab`/`resource-apply` 露出格内能量/宝箱/宝石/物品）。空间随游玩渐进挖开=**空间即奖励**（Gossip Harbor 招牌·owner 定核心乐趣）。通用于任何 merge/match 游戏的「合并/消除清邻格覆盖层」。
> **已试（GD 源码复核）**：`merge-on-place` 只裁「拖 from 落 to → 合成/移动/交换」·**无「合并事件→影响空间邻格」挂钩**。原语 `spatial-query.queryRange(x,y,radius)` **已有**（范围查询·距离并列按 id tie-break·确定性）。`match3-board` **已证同型逻辑**（`clear`→`neighbors4(i)`→减邻格 `blockers`·source line 527「格层减层」·`clearable=blockers==0`）——但绑在**三消**状态机（swap/find-runs/gravity/refill）·merge-2 不要那套。**故当前无任一能力把「merge-on-place 合并结算」接到「减 3×3 邻格 Blocker」。**
> **卡在哪 / 缺什么**：缺「**合并事件 → 空间邻格递减 + 归零信号**」的通用挂钩。**禁游戏层/宿主手写扫 3×3 减邻格 solver**（manifesto §3 红线·且宿主非确定性 sim·须进 hash/回放）→ 必须下沉引擎。
> **建议方案（Lead 裁）· 边界**：下沉通用 **`merge-proximity-clear`**（或给 `merge-on-place` 加姊妹相位）——组件 `Blocker{layers, reveal?}`；系统监听合并结算（需 `merge-on-place` 发「合并落点 cell/坐标」信号/事件·或新件直接观测该拍新合成实体）→ `queryRange(mergeX,mergeY,radius)` 取带 `Blocker` 的邻格 → `layers -= decPerMerge`（钳 0）→ `layers==0` 发解锁信号。**复用 `queryRange` + 参照 `match3-board` 减邻格逻辑**·确定性（id tie-break·无随机）。**触碰范围**：`src/skills/**`（新 `merge-proximity-clear.ts` 或改 `merge-on-place.ts` + `src/assembly/capability-registry.ts` 登记 + 测试）；game101 只经 `board-cover.json` 数据消费（零游戏层扫格）。需求实证＝`docs/design/game101/{systems-economy.md §5.5, config-schema.md §10, capability-plan.md §2.5 G6, requests.md REQ-101-08}`。

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
