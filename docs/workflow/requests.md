# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-UI-异型容器 shape + 槽位容器 Slots（Panel/Card 非矩形 + 多槽餐盘/背包格通用）· [2026-07-24] · PE-101 报（owner「多 slot + 异型 UI 是底层需求」定性）→ PUI 裁 · status: open · 优先级: P2（game101 顾客卡基准保真·非阻断·现用闭集顶着） · 类型: UI 基座控件缺口（PUI 域·全游戏通用）
> owner 2026-07-24 把「多 slot 餐盘」「异型限时菜单」定性为**底层需求**。PE-101 架构评审（先评判）后拆成一主一辅，报 PUI：
> - **① 异型容器（真缺口·主）**：基座异型只在 `Button.shape`（8 款 ShapeToken）+ `layout.chamfer`（矩形切角）；**`Panel`/`Card` 无 shape 枚举**，非矩形容器（如 Gossip Harbor 顾客行右侧「动态异形限时菜单」卡）只能靠贴图皮硬凑。**建议薄加性**：给 `Panel`（含 `Card`）加 `shape?:ShapeToken`（**复用现有闭集枚举 + `render.ts SHAPE_CSS`**·非自由 clip-path），命中区=包围盒（同 Button）。异型须给足 width/height。
> - **② 槽位容器 Slots（便利下沉·辅·可选）**：多 slot 餐盘/背包格用 `Panel(row)+N 子 Card` **现有闭集已能表达**（非硬缺口）；但值得下沉语义控件 `Slots{count, items:[{icon?,filled,deliverable?}], onDropAction?}`（空槽虚线/满槽✓/拖入高亮统一封装·订单餐盘＋背包＋合成台通用）。PUI 裁是否值得建，或维持游戏层拼装。
> **边界**：`src/ui/**`（catalog/types/render/validate + 主题）=PUI 独占域；game101 只经数据消费。game101 侧指针见 `docs/design/game101/requests.md REQ-101-07`。**PE 不越界改 `src/ui/**`**；落地前 game101 顾客卡用现有 `Panel+children` 顶着（异型菜单降级为矩形卡·待本件落地升级）。

### REQ-SURVIVOR武器缺口-3 薄件（弹射 bounce / 诱饵 aggro 重定向 / pull 吸附）· [2026-07-24] · PE-game-103 报（capability-plan §4 E4「待核」的回报）→ Lead 裁 · status: **⚖ Lead triaged（2026-07-24·三条定形·M3 开工时建·不阻塞 M2·现不预建 YAGNI）** · 优先级: P2（game-103 M3 武器·**不阻塞 M2**） · 类型: 引擎 capability 薄缺口（Roguelite 武器通用·先重组再下沉）
> **⚖ Lead 裁（2026-07-24·triaged）**：三条 PE 已源码复核实锤真薄缺口·定形如下·**M3 武器开工时按此建**（M2 六武器不受影响·现不预建）：
> - **bounce（W7）→ 薄加性字段 `Launch.bounce?:{times,targetTag}`**（命中后 up to times 次 nearestByTag 重定向该抛射体）。launch fire-once 无法干净重组「同一抛射体转向」→ 加字段是对的薄口·通用于任何跳弹。
> - **lure（W8）→ 薄加性 aggro/Perception `lureTag` + lure 标记**（带 lure tag 的诱饵实体在半径内盖过默认目标优先级）·通用于嘲讽/诱饵。（备选重组=诱饵在场信号→改一群敌 steering 目标·需区域施加器·同 pull——倾向 lure 薄口更干净。）
> - **pull（黑洞）→ 优先重组**：黑洞锚点 + 半径内敌临时挂 `Steering{target:锚点,seek}`＝被拉向锚点（steering 本就 self-toward-target）。真缺口=「按邻近给一群实体批量设 steering 目标」的**区域施加器**——现无则下沉薄 `pull-field`；M3 先试重组·撞墙再沉。
> **结论**：三条留 open P2·形已定·M3 开工时建（bounce/lure 薄加性·pull 先试重组）；撞墙 spec Lead 亲笔·Opus 施工。
> 三条 M3 武器缺口（细节另存本地 `.apollo/cap-gaps.jsonl`·gitignored·故要点内联于此供 Lead 裁）。GD 立场（capability-plan §4）：倾向重组·真薄缺口才下沉；M1–M2 已具核心武器/三选一/波次能力、不受影响。
> - **弹射 bounce（W7 跳弹）**：`t2-launch` 只一次定向直飞(fire-and-forget)·无「命中后按剩余次数 nearestByTag 重定向连锁」。裁：launch 加 `bounce` 字段 / 下沉薄件 `bounce-relay`。
> - **诱饵 aggro 重定向（W8）**：`t3-aggro` 的 Perception 恒认阵营 tag·无「临时把某群敌目标改指诱饵实体」（放置✅+自爆✅·缺 aggro 改指）。裁：Perception 加目标优先/lure 半径 / 下沉 `lure-taunt` 薄件。
> - **pull 吸附（进化 黑洞脉冲）**：`t2-steering` 是「自身朝/离目标」·无「把一群他者拉向锚点」（作用对象相反）。裁：敌临时挂 seek 指黑洞锚点重组 / 下沉 `pull-field`。
> 撞墙实证＝`src/games/game-103/`（M2 六武器 straight/nova/beam/boomerang/orbit/pet 已落·这 3 类射法表达不了）。

### REQ-SURVIVOR被动轴-玩家属性 modifier 桥（stat-bind）+ Launch 无目标兜底方向 · [2026-07-24] · PE-game-103 报（owner v2「接全 8 被动」撞墙）→ Lead 裁 · status: **⚖ Lead 裁 ✅ 真缺口·spec 已备·owner 拍板排期 R3 建（stat-bind 解锁被动多样性）+ Launch fallbackDir 薄加性准（同批）** · 优先级: P1（R3·game-103 被动多样性核心·roguelite 通用） · 类型: 引擎能力缺口（stat/modifier 消费桥 + launch 边角·主程域）
> **⚖ Lead 裁（2026-07-24·核过源码·并 `REQ-STATS-BRIDGE` 同缺口去重于此）：✅ 真缺口**——`t2-modifier-stack` 聚合出 `ModifierTotals` 但**全库零消费**（`grep getComponent ModifierTotals` 空）；移速=`Controllable.speed`(引擎读死)、攻速=武器 `Timer.duration`(固定)、范围=prefab `Shape.radius`(固定)、`Steering.speed`/`Caster` cd 全固定 config·不读 effective → 移速/攻速/范围/最大生命 类被动**算了没人用**。非重组可得（无「聚合总量投影到消费端字段」的件）。
> **⚖ Lead spec（→主程/Opus·P1）**：下沉 **`stat-bind`**（属性桥·投影器）——组件 `StatBind{ bindings:[{ source:'ModifierTotals'|'Stats', key, component, field, op?:'set'|'mul'|'add', base? }] }`；系统每 tick 读该实体 source[key] → 按 op 投影进 `component[field]`（`moveSpeed→Controllable.speed/Steering.speed(mul base)`·`range→Shape.radius/Hitbox.radius`·`attackSpeed→Timer.duration/Caster.cooldown(逆)`·`maxHp→Resource.max`）。确定性（读已算数值·写数值字段·无随机）。边界=`src/skills/**`+测试·游戏只经数据挂 StatBind。备选（各消费件加 effective 读取分支）回驳=散改多件不如一投影桥通用。
> **+ Launch 无目标兜底方向 → ✅ 薄加性准**：`t2-launch` toward:'target' 无敌时清零速度（`launch.ts:17`）→ 无敌那刻发的子弹卡原地。裁：Launch 加 `fallbackDir?`（无目标时沿它/发射者朝向）·缺省=现行为零回归。**并入本单同批建**（薄字段）。
> **待 owner 排期建**（不阻塞已交付的分离/绕转/波次；被动伤害/暴击/回血 PE 已纯数据接 4/8）。撞墙实证＝`src/games/game-103/`（被动 4/8 已接·移速/攻速/范围待桥；子弹 launch 无目标冻结）。

### REQ-TAPSPAWN-加权掉表生成器原语（tap→耗资源→加权 spawn） · [2026-07-24] · PE-101 报（capability-plan §6 G1「撞墙→下沉 tap-cost-spawn」的回报）→ Lead/主程 裁 · status: **⚖ Lead 裁 ✅ 下沉 `weighted-spawn`（2026-07-24·spec 已备·⏸ 缓建）** · 优先级: P3（**owner 2026-07-24：game101 先迭代设计·M1 不急** → 不现在建·待 M1 提上日程再动手·spec 现成） · 类型: 引擎通用能力缺口（合并/idle/gacha 通用·主程域）
> **⏸ 缓建（owner 2026-07-24「game1 先迭代·M1 不急」）**：裁决 ✅ 下沉 + spec 已定（下方），但**不现在建**——game101 先做设计/布局/经济迭代（GD-101/PE-101 域），M1 灰盒（需本件）待 owner 提上日程再由主程/Opus 照 spec 施工。
> **⚖ Lead 裁（2026-07-24）：✅ 下沉**——PE-101 已源码复核实锤真墙（无「加权运行时 spawn」原语·`caster`/`self-rule` 只固定 template·`effect-apply` 不能 create·`draft-offer` 加权核 private + 自建 seed 不接世界 `RandomSeed`）；正是 G1 §6 预祝福的 `tap-cost-spawn`。合并/idle/gacha/loot 通用·真缺口非重组可得（宪法 §2）。
> **⚖ Lead spec（→主程/Opus 施工）**：新 **ECS capability `weighted-spawn`**（`src/skills/tier2/weighted-spawn.ts`·`defineCapability`·登记 `src/assembly/capability-registry.ts`）——组件 `WeightedSpawn{ onSignal, cost?:{id,amount}, table:[{templateId,weight}] }`；系统：收 `Signal.name==onSignal` → 若 cost 则**原子 afford**（不足整单不动·同 `craft-recipe` 口径）+扣 → 读**世界 `RandomSeed` 单例** `nextRandom` 加权抽 templateId → 发 `SpawnRequest{templateId, x/y=自身 Transform}`；相位早于 spawner 消费。**必用世界 RandomSeed（禁 fixed seed·保 sim hash/回放确定性）**。**并**从 `draft-offer` 抽出+导出纯函数 `weightedPick(entries, rand)`（DRY·draft-offer 内部复用之）。测试：afford 拒/扣·同 RandomSeed 序列同抽·加权分布·SpawnRequest 落点·空表/权重 0 边角。game101 只经 `generators.json` 数据消费（零游戏层加权/裸 Math.random）。
> - **想实现的行为**：生成器（merge/idle 通用）——点一下 → 若资源(体力)≥cost 扣费 → 从掉落表 `[{item,w}]` 按**引擎种子 PRNG** 加权抽一个 item → 在生成器处 `SpawnRequest` 该 item。数据已备 `src/games/game101/config/generators.json`。
> - **已试（子代理源码复核契约）**：✅ 扣费半场可组合＝`clickable`(点→Signal)+`craft-recipe`(onSignal·costs 原子 afford+扣)（game-q build-pad 近乎现成模板）。❌ **加权 spawn 半场无原语**：`caster`/`self-rule` 只 spawn **固定 template**；`effect-apply` writes 无 SpawnRequest（能 destroy 不能 create）；`draft-offer.weightedPickDistinct` **private 未导出**、`rollOffer` 导出但**自建 mulberry32(seed)·不接世界 `RandomSeed`**、且**未接线成 SpawnRequest**。无任何能力把 `{item,w}[]`+`RandomSeed`→选 template→`SpawnRequest`。❌ 且单点「afford→spawn」不干净可组合（craft-recipe 无成功 Signal·caster 无 cost）。
> - **卡在哪**：缺「加权运行时 spawn」原语（＝§6 预判的 `tap-cost-spawn`）。**禁游戏层手写加权/裸 Math.random**（manifesto 红线）→ 必须下沉引擎。
> - **建议方案（§6 已预祝福其形）· 边界**：下沉通用能力 `tap-cost-spawn`（或 `weighted-caster`）——组件 `TapSpawn{ onSignal, cost?:{id,amount}, table:[{item,w}] }`；系统在信号时（可选 afford+扣 cost）→ 读世界 `RandomSeed` 走 `nextRandom` 加权抽 → 发 `SpawnRequest{templateId, at:self}`。**必用世界 RandomSeed（禁 fixed seed·保 hash 确定性/回放）**。可拆两件：①从 `draft-offer` 抽出并**导出纯函数 `weightedPick(items,weights,rand)`**；② `caster` 加 `table?` 变体 / 新 `weighted-caster` capability 消费之。**触碰范围**：`src/skills/**`（新 capability + 导出 draft-offer 纯函数 + 测试），game101 只经数据消费。撞墙实证＝`docs/design/game101/requests.md REQ-101-06`。

### REQ-MERGE-ON-PLACE-方格拖放合并原语（拖同类才合·非自动合并）· [2026-07-24] · PE-101 报（S4 可玩接线源码复核）→ Lead/主程 裁 · status: open · 优先级: P3（**owner：game101 M1 不急同 REQ-TAPSPAWN**·当前用自动合并可玩·非阻断） · 类型: 引擎通用能力缺口（merge/消除品类·主程域）
> - **想实现的行为**：真·合并手感——玩家**拖**一个物到另一个**同模板**物所在格才合成次级（拖到空格=移动·拖到异类=交换/不动）；物品平时**不自动合并**。Gossip Harbor/合并品类标配。
> - **已试（子代理源码复核·PE 域内组合）**：❌ 无原语。`t3-merge-rule` 是**自动合并**（每拍数 PrefabOrigin≥need 即合·不看位置）→ 板上 2 同类必自动塌缩，非拖拽触发。`t2-drag-place` 能移动已放置物但**只吸六角 HexPos·无方格分支·且落占用格只做交换、不查占用者模板/不触发合成**。`t2-grid-drag-square` 是**托盘 polyomino 盖章**（不移动已放置物·不合并）。`match3-*`=连线消除非 N 合 1。无任何能力做「方格拖放·落同类格→combine」。
> - **卡在哪**：缺「方格拖放合并」原语（drop-onto-same-template→combine at drop cell）。
> - **建议方案 · 边界**：下沉通用 `merge-on-place`——组件 `MergeOnPlace{ boardId, need }`；系统消费拖拽 drop 动作（`synthesizeDrag` 已产）→ 方格 `squarePointToCell` 定落格 → 若落格占用者与被拖物**同模板**且计数≥need → 发 `DestroyRequest`×need + `SpawnRequest{into, at:drop cell}`；否则移动/交换（复用 drag-place 落位逻辑的方格版）。**触碰范围**：`src/skills/**`（新 capability + 方格拖放桥·或给 drag-place 加方格分支 + 合成钩）+ 测试；game101 只经数据消费。**当前 game101 用 `merge-rule` 自动合并顶着可玩**（本件落地后换真拖拽手感）。

### REQ-STYLE-SWAP-工坊风格库（命名风格预设 + 一键换风格）· [2026-07-22] · owner 拍板（「加风格类型下拉·新建风格·存本地·Apply 换掉全部 UI 风格」）→ **引擎侧 Lead ✅ done · 工坊 UI 指派 PST** · status: **引擎 ✅ done（Lead 2026-07-22）；工坊 UI open（PST）** · 优先级: P1 · 类型: 风格换装（引擎已具·工坊 UI 缺口）
> **owner 愿景**：美术台本加「风格类型」下拉——可**新建风格**（存本地）、选一套风格**一键 Apply** → 当前游戏全部美术按该风格重生成换掉。多套命名风格可存本地、随时切。
> **架构评审（Lead·先评判）**：换皮引擎 + 风格包 + 选择器**大半已存在**（9 内置风格包=已定义风格·批量生成+替换写回=换皮·工坊已有风格包 chips + 整体风格锚输入）——不重建。真缺口=①owner **自建命名风格存本地**②一键 Apply。
> **【引擎侧 ✅ done（Lead 2026-07-22·commit 见下）】**
> - **本地命名风格库**：`.apollo-styles.json`（gitignored·同 BYO-key 就近本机）并入 `STYLE_PACKS`（本地覆盖同名内置）；`style-packs.mjs` 加 `validateStylePack`/`saveLocalStyle`/`deleteLocalStyle`/`readLocalStyles`；`listStylePacks` 每条带 `local` 标位。
> - **端点**：`POST /api/art/styles {pack}`（存自建风格·Node 校验+归一化）·`POST /api/art/styles/delete {packId}`（删·内置不可删）·`GET /api/art/style-packs` 已回 `local` 标位。
> - **提示词按 kind 分层**（修「换皮把 UI 画成场景」）：`dialectPrompt` bg/splash 用含场景 promptZh/En；sprite/texture/UI 用 `uiPromptZh/En`（仅配色+质感+孤立无场景·缺则回退·零回归）。vegas-victoriana 已授 ui 变体作样板；**其余包 ui 变体待 PA 逐包补**（缺=回退旧行为·不阻塞）。
> - **一键 Apply（当前游戏 in place）= 现有 `POST /api/art/batch {slug, packId}`**（按选定风格整批重生成·编译期游戏 batch 即登记 skinKey 别名上画面；卡带线再 `POST /api/art/replace`）。`reskin` 端点=另一路（fork 新卡带·reskinOf 谱系·非本需求）。
> **【工坊 UI open·指派 PST·`workshop/index.dc.html`（PST 域）】**
> 1. 风格屏加**风格下拉/chips**：列 `/api/art/style-packs`（含 `local` 标位·自建风格可标「自建·可删」）。
> 2. **「+ 新建风格」表单**：名称 + 中/英风格提示词 + 调色板(取色) + provider(qwen/seedream…) + 选填 uiPrompt → `POST /api/art/styles`；自建风格旁「删除」→ `POST /api/art/styles/delete`。
> 3. **「🎭 一键 Apply 此风格」按钮**：对当前游戏调 `/api/art/batch`（选定 packId）[+ 卡带线 `/api/art/replace`] → 全部美术按该风格重生成换掉；忙碌态 + 结果回显（复用现 artResultBox）。
> 4. **手动尺寸输入（owner 2026-07-22·「AI 给的尺寸不精确·让我改」）**：详情卡加「目标尺寸 WxH」输入（缺省=行原生 spec）→ 重新生成时传 `size` 给 `/api/art/regenerate`。**引擎已 done**：`resetRow` 存 `row.targetSize`·生成按面积放大到火山 ≥921600 下限·回来 scale-back 到目标（`resizeImageTo`）·`/api/art/regenerate {size:'WxH'}` 已透传。PST 只加输入框 + 传参。
> **边界**：引擎（`style-packs.mjs`/`art-replace.mjs`/`art_replace.py`/`server.py`/`t2_replace.py`）=Lead ✅ done；工坊 UI（风格下拉+新建表单+Apply 按钮+尺寸输入）=PST；各内置包 uiPrompt 变体补全=PA。

### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。

### REQ-PANELSKIN-Panel 贴图皮槽 · 复合按钮（`Panel`+子节点）没法换贴图皮 · [2026-07-22] · PE-C 报（owner「按钮变贴图」落地撞缺口）→ Lead/PUI 裁 · status: **✅ done（PUI 2026-07-22·待 Lead 验收 + PE-C 消费）** · 优先级: P2 · 类型: UI 基座控件缺口（PUI 域）
> **PUI 交付（2026-07-22·按 Lead 建议原样落）**：`PanelProps.skin?`（+`skinSlice?`）·语义同 `ButtonProps.skin`——`render.ts panelSkinCss`（cover / `skinSlice` 走 border-image 九宫格）·`renderPanel` chrome 优先消费·**guard `!bare`**（bare 不吃皮·同 panelTexture）·**不强制白字**（children 各自定色·区别 Button.skin）·缺省无=面板零回归。**children 与皮共存叠渲**（皮作底·子节点在其上）——动态金额（「Call {betAmt}」50→200→800）走 LayoutNode 活文字、不烤进图；配 `action`=整容器可点=复合贴图按钮。types+render+catalog+`ui.md`(复合贴图按钮行)+测试 `panel-skin.test.ts`（5 例·cover/children叠渲/动态数额/可点/9-slice/零回归）。全绿 tsc0/vitest3286/build。**PE-C 消费**：主行动键 `Panel skin: textureOverrideUri('game-c/ui/btn-fold') ?? undefined` + 两色 Label 子节点照旧。
> **缺口**：`ButtonProps.skin`/`skinSlice`（cover/9-slice 贴图皮）只 `Button` 组件有；`PanelProps` 无 cover 图槽（`image` 是 `ScreenProps` 专属·`Panel` 只 tiled `bgTexture`·平铺≠按钮皮）。游戏里**复合按钮**（文+金额/图标两色·必须 `Panel`+子 `Label`·非单 `label` 串）就换不了贴图皮。实例：game-c 主行动键 弃/跟/加/All-in（`hud.ts buildStoryActionBar`·`Panel bg:custom+edge+press3d`+两色 Label）——owner「按钮变贴图」主诉这几个键落不了地；改 `Button` 会丢两色复合标签。
> **建议（PUI 裁）**：给 `PanelProps` 加 cover `skin?`（+`skinSlice?`）·语义同 `ButtonProps.skin`（`render.ts renderPanel` 消费·`skinSlice` 走 border-image 九宫格/缺省 cover·guard `!bare`·缺省无=面板零变化）。游戏侧即可 `skin: textureOverrideUri('game-c/ui/btn-fold') ?? undefined` 换主行动键皮。**评判**：现闭集真表达不了复合按钮换皮（`bgTexture` 平铺不对·`Button` 丢复合内容）→ 真缺口·非重组可解。game-c 次级按钮（Button·kind 皮）已接·此条只差复合 Panel 皮。
> **owner 2026-07-22 追加决策依据（评估过替代方案·仍要此条）**：① 考虑过「文字烤进贴图·纯 cover 皮不叠字」——owner 接受**丢本地化**，但**跟注键金额是动态的**（「跟注 50」的 50 每手随下注额变·`50→200→800`）→ **动态数字无法烤进固定图**·必须「贴图打底 + 文字/金额叠渲」= 本条 cover-skin（叠文字层）而非纯 cover。② 故 cover `skin` 需与既有子节点（复合 Label：局部化文案 + 动态金额两色）**共存叠渲**（skin 作底层背景·子节点照常在其上）——非替换内容。这样一举保住：贴图 + 动态金额 + 本地化 + 现深金边观感。owner 已同意报此条为正解、不走烤字 hack。

### REQ-FX-SHEEN-HOVER · 流光 sheen 悬停触发变体（+cooldown·非常驻扫光） · [2026-07-23] · PE-C 报（owner「流光只在鼠标移上去的按钮才有·且有冷却」）→ PUI 裁 · status: open · 优先级: P3（观感·非阻断·game-c 已先撤常驻 sheen） · 类型: UI 特效库缺口（PUI 域）
> **触发**：owner 看了常驻 `fx:[{kind:'sheen'}]`（`apollo-sheen-sweep 3.2s infinite`）觉得「太难看·太吵」——要「**鼠标移到那几个特别按钮上才流光·且有 cooldown**（扫一下→冷却→再触发·非无限循环）」。现 sheen CSS（`server.ts` `[data-fx~="sheen"]::after {animation …infinite}`）只有**常驻**一档；`ripple` 有 `:active` 触发先例、`flipcard` 有 `:hover` 先例，但 sheen 无悬停档。
> **缺口**：闭集里没有「悬停触发 + 冷却」的 sheen——game-c 想让主行动键（弃/跟/加/All-in）悬停时扫一道流光、松开/冷却期不扫，表达不了（只能常驻或没有）。
> **建议（PUI 裁·闭集内加档·勿散写 CSS）**：给 `sheen` 加触发档，二选一——① `fx:[{kind:'sheen', on:'hover'}]`（VisualEffect 加 `on?:'always'|'hover'`·缺省 always 向后兼容）→ CSS `[data-fx~="sheen-hover"]:hover::after{animation:apollo-sheen-sweep <ms> ease-out}`（非 infinite·一次·:hover 再触发天然带「移出→再移入」冷却）；或 ② 新 kind `sheen-once`/hover 语义同理。**cooldown** 可用「animation 播完即停 + `:hover` 才重播」实现（移开鼠标=重置·天然冷却）。落地后 game-c 主行动键填该档、其余面板不加（owner「只留那几个特别按钮」）。
> **PE-C 现状（不阻塞）**：已先撤掉全部常驻 sheen（`hud.ts` 主行动键/底池/席卡/面板等）·仅保 `press3d` 按压反馈 + `pattern:'stripe'` 贴图质感；hover-sheen 档一到即接主行动键。

<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结迁归档（requests-archive.md）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


### REQ-FACEART-画框修缮 · faceArtSlice 9-slice 真浏览器不渲染 + 手册补行 + border-image 审计盲区提前清 · [2026-07-22] · Lead 复核发现 → **指派：PUI** · status: open · 优先级: P3（无活消费者·非阻断） · 类型: UI 基座缺陷修缮 + 工具债（PUI 域）
> ① `render.ts:721` faceArtSlice 覆盖 div 缺 `border-style:solid;border-width:${slice}px`——border-image 渲染前提不满足，真浏览器一像素不画（同文件 `skinCss`/`panelSkinCss` 均已显式设，唯此处漏）；修法=对齐 panelSkinCss 口径 + **真浏览器目击一次**（happy-dom 字符串断言测不出此病）。② `docs/playbooks/ui.md` 图标行补 `Panel.titleIcon`/`Tabs.tab.icon`（ab2a316c 落地未回填手册）。③ **border-image 审计盲区工具债提前清**（原 REQ-UIAUDIT 后置项）——本次正是「audit 测不出 border-image 白画」的同类病在 PUI 自家交付里咬了自己，实证该盲区值得现在补：ui-audit 对带 border-image 的元素校验 border-style/width 前提，缺=报警。
> 附 Lead 裁决：REQ-UIRECON「通告 game-b/c」项**豁免**——引擎修复对两家透明兜住、无需其任何动作，补知会=空跑（game-a 兜底可退已在 A-012 闭环）。

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
