# game102《色流工坊 / Pixel Pour》· 游戏级工单池

> 游戏级工单随游戏走·**不占引擎 10 硬槽**（CLAUDE.md）。引擎级下沉一旦经 Lead 确认，升级进 `docs/workflow/requests.md`。
> 状态：`open` / `in-review` / `done`（附 commit）/ `wontfix`（附理由）。

---

## 待处理 / 进行中

### REQ-G102-VISCANNON · 核心可见性：色炮上轨可见 + 可见子弹（owner 急件·本次提交）· [2026-07-25] · PE 落 → owner 验收 · status: **✅ done（本次提交·下附「真环轨」引擎限制）** · 优先级: P0 · 类型: play-field 可视化
> **owner 反馈**：核心玩法看不见——「炮台看不到出现在轨道上，也看不到发出的子弹，无法判断为何吸掉像素」；要更好看的矢量图炮。
> **PE 落地（组合表达·零游戏层 system·守裁①）**：色炮 = 亮色**圆盘炮体** + 深色**炮口小盘**（`hierarchy` 子件随体走）；生成于补给口后由 `aggro`(锁最近同色格)+`steering`(seek·`FIRE.moveSpeed/stopRange`)**可见地游向像素格**（吸色车）；每 `reload` 拍炮口发**可见曳光弹** `tracer_<color>`（`launch` 朝最近同色直飞·render-only 无 Hitbox·不参与结算）；消除仍由 `bullet_<color>` 即时命中区确定性完成（净落弹=ammo 不变）。新接能力：`steering`/`launch`/`hierarchy-resolve`/`hierarchy-cascade`（皆引擎既有）。验收剧本 01/02/03/05 数字不变（24 vitest 绿）。
> **⚠ 引擎限制实证（真环轨做不成·非 PE 偷懒）**：owner 原意「从起点**环绕一圈**到终点」。`t2-orbit-motion`（圆周运动）与索敌/抛射簇（`aggro`/`launch`/`steering` 全 `runsBefore motion-apply`）**成拓扑环**——`orbit-motion` `runsAfter motion-apply` + 写 Transform 被 `aggro` 读 → `aggro→motion-apply→orbit-motion→aggro` 死环（引擎 `topological-sort` 报「Circular dependency」，实测复现）。故**「真圆环绕 + 逐格索敌开火」当前引擎无法共存**。取**可见游动吸色**折中（steering 驾炮游向像素·满幅像素画上移动明显）。若 owner 坚持真环轨 → 需引擎侧给 `orbit-motion` 与索敌簇的兼容定序（`docs/workflow/requests.md` 走下沉·Lead 裁）。

### REQ-G102-ADAPTER · S4 验收适配器（PE 落 adapter·剧本 schema 阻塞报 GD）· [2026-07-24] · GD 验收发现 → PE 落 → 回 GD · status: **in-review（阻塞在剧本 schema·待 GD 改）** · 优先级: P0 · 类型: 验收接线
> **GD 验收实测**：`acceptance-run.mjs --game game102` → 原缺 `acceptance-adapter.ts`。**PE 已落**（下 ①），但暴露真阻塞在剧本 schema（②）。
> **① adapter 已落**：`src/games/game102/acceptance-adapter.ts`（createWorld/applySignal/readWorld·纯接线零规则·不改剧本）。动作已接 `tapSupply:<color>`/`tapSlot:<i>`；投影已接 `remain.<color>`/`remain.total`/`conveyor.count`/`tray.count`/`score`/`combo`/`moves`/`flow`(StringVar 投自 GameFlow)。特殊炮 rainbow/chain/laser/aim + keys/doorOpen = REQ-G102-SPECIAL/关型后续（pending）。
> **② 阻塞·剧本 schema 不符（剧本错=GD 改·PE 不改剧本铁律）**：`acceptance/01~08` 写成 `{level, steps:[{do,then,expect对象}]}` DSL，而 harness（`scripts/acceptance-schema.mjs`）只认 `{game, config, steps:[{signal}|{tick:N}|{expect:[{res,eq}]}]}`——8 份全报「坏剧本·schema」（缺 `game`、用 `level` 非 `config`、`do/then/expect对象` 非 `signal/tick/expect数组`）。**跑 `acceptance-run.mjs` 现零剧本可解析**（adapter 齐了也跑不了）。
>   **请 GD**：把 8 份改成 harness schema（每步拆 `{signal:"tapSupply:blue"}`→`{tick:60}`→`{expect:[{res:"remain.blue",eq:0},…]}`·`level`→`config`·补 `game:"game102"`）；或经 Lead 裁 harness 扩展支持 README 的 DSL。PE 可提供转好格式的草案供 GD 审（不擅改）。
> **③ 核心行为已按剧本确切数字自验**（walkthrough·`game102.walkthrough.test.ts`）：01 消色(remain.blue=0/red=1/total=1/score>0/playing) · 02 弹尽入槽(remain.blue=3/conveyor=0/tray=1)+点槽复用(→0/victory) · 05 判负(remain.blue=2/defeat)。剧本改成 harness 格式即可跑真 conformance（GD 二次对抗性验收）。

### REQ-G102-BURST · 突破容量「快连堆炮 5→10」撞墙报缺口（conveyor-queue 候选）· [2026-07-24] · PE 实证 → **Lead 裁** · status: **open** · 优先级: P2 · 类型: 能力缺口（Lead 裁①回补通道）
> **背景**：REQ-G102-CAPREVIEW Lead 裁① 三条时序疑点之一「突破态 5→10」明列「组合表达不了再下沉 conveyor-queue」。PE 落 S4 玩法实证撞墙。
> **撞墙实证（最小复现）**：剧本 04 = 同一拍 6× `tapSupply:blue` → 期望 conveyor.count=6。**实测只生成 1 门炮**：补给分发用 `Caster{onSignal:'tapSupply_<color>', template:'cannon_<color>'}`，**Caster 每拍最多一发**（N 个同名同拍信号 → 1 次生成），无法 N 信号→N 生成。（probe：6 clicks 同拍 → beltCannons=1。）
> **已试的拼法**：① Caster on 补给（每拍 1 发·不够）；② effect-apply spawn（同 onSignal 每拍一次·同限）；③ SelfRule spawn 按 pending 计数每拍一发（=跨 6 拍才 6 门·剧本要同拍）。均表达不了「同拍 N 快连 → N 炮上带 + 容量 5→10 突破切换」。
> **候选下沉**：`conveyor-queue`（传送带队列·容量/突破切换/快连堆入·确定性·服务本类「排队→到位触发」玩法）——或更小的「spawn-per-signal-occurrence 分发器」。**spec 由 Lead 亲笔·Opus 施工·裁前 game102 不游戏层自写 burst/队列散逻辑**（守 Lead 裁①红线）。
> **现状**：剧本 04 标 **pending**（walkthrough `it.skip`·非红）；01/02/03/05 核心已按剧本数字自验绿。cap 未切/未强制=本缺口一并处理。

### REQ-G102-SPECIAL · 特殊炮三门（彩虹/连锁/激光）· [2026-07-24] · GD 提 → **PE** · status: **open** · 优先级: P1 · 类型: 玩法扩展
> **spec**：`docs/design/game102/special-cannons.md`（owner 2026-07-24 拍板三选）。验收剧本 `acceptance/06~08`（GD 已出）。
> **① 彩虹炮 🌈**：`matchAny` 标·命中任意色——**纯数据组合·无下沉**，直接做。
> **② 连锁炮 🔗**：连通同色 flood 消除——**先试 event-when 级联组合**；实证撞墙（无邻接连通解释器）→ 回本表报缺口，候选下沉 `flood-clear`（附最小复现+已试拼法·Lead 裁·**裁前不游戏层自写 flood**）。
> **③ 激光炮 ⚡（手动触发）**：手动 aim 态 → 选行/列 → 清该线同色——**先试 clickable+action+Flag 组合**；撞墙 → 报缺口候选 `aim-target` 输入能力。UI 侧瞄准高亮/热区归属与 PUI 会审。
> **通用**：强制激活来源/掉率/数值全 config（special-cannons §0/§5）；特殊炮=一次性稀有道具·追加补给区特殊炮区。
> **边界**：本单=PE play-field/逻辑；补给区特殊炮槽 UI=PUI（REQ-G102-UI-2）。撞墙走缺口通道·守 Lead 裁①。

### REQ-G102-UI-2 · 补给区「特殊炮区」+ 激光瞄准 overlay · [2026-07-24] · GD 提 → **PUI** · status: **open** · 优先级: P2 · 类型: UI 增量
> 承 REQ-G102-UI（已 done）。据 special-cannons §4：① 补给区常规色炮**之后**追加「特殊炮区」（每门一槽·稀有色边 + 数量 `Badge`·可点）；② 激光手动瞄准态的**行/列高亮 overlay + 热区**（LayoutNode overlay vs render 高亮·与 PE 会审归属）。控件优先闭集内（Badge/Panel/Button）·缺则报缺口不手写。

### REQ-G102-TILEMAP-VERDICT · S3 tilemap 适配核对回执（PE 落地实证）· [2026-07-24] · PE 提 → 存档 · status: **✅ done（组合表达·无引擎缺口）** · 优先级: P1 · 类型: 适配核对
> **背景**：pe-handoff §2 待验 + Lead 裁①实机校准补充——「位图棋盘倾向 `tilemap`，PE 落地核对适配度，不合再报缺口」。
> **实证结论：`t2-tilemap` 不适配中央「可消除像素画棋盘」——但这不是引擎缺口，改用现有实体路线即可（零下沉·守 Lead 裁①）。**
> - **为何不适配**：`t2-tilemap`（`src/skills/tier2/tilemap.ts`）**唯一系统 = `tile-collision`**（把动态 box 体推出实心墙格 + 渲染器画格）；瓦片显式「**非实体**、不进 tick」。它**没有** per-cell hp 递减、命中消除/移除格、按色计数 的任何解释器。而本作核心循环=「同色弹命中格 → hp-1 → 归零消除 → 按色 `group-count` → 收集钥匙」全部要求作用在**实体**上：`t2-group-count`/`t2-launch`/`t2-hitbox` 均 `world.query(...)` 实体组件、**读不到 Tilemap**（已核源码）。用 tilemap 装棋盘 = 填了一张没有解释器消费的死数据（虚胖数据·宪法禁）。
> - **采纳路线（组合表达·现有能力原生消费）**：棋盘 = **一格一实体 BoardCell**（`Transform`+`Shape(box)`+`Tag(色位|CELL_BIT[|KEY_BIT])`+`Resource(hp)`+`Color`）。按色计数 = `t2-group-count{requiredTag:色位|CELL_BIT → Resource remain_<color>}`；命中消除/钥匙收集 = S4 用 `t2-launch`/`t2-hitbox`/`t2-event-when`/`t2-effect-apply` 接线。**与 capability-plan §4 第二行 GD 倾向（「方块=带颜色+hp 的实体阵」）一致。**
> - **证据**：`src/games/game102/blueprint.ts`（`boardCells()`/`colorCounters()`）+ `game102.skeleton.test.ts`（load+2tick 绿 + group-count 按色数出在板同色格：blue=9/lblue=10/teal=2）。故 game102 蓝图**不含 `t2-tilemap`**。
> - **未来若需静态背景/墙层**（本作无）方可另起 tilemap 层——与棋盘无关。**无新能力缺口·不升级引擎池。**

## 已完结（附 commit·done 迁此）

### REQ-G102-UI · UI 实装（据布局稿出 .dc.html + LayoutNode）· [2026-07-23→2026-07-24] · GD 提 → **PUI** · status: **✅ done（本次提交）** · 优先级: P1 · 类型: UI 实装
> **交付基准**：`ui-layout-spec.html`（GD 布局稿·四屏·零新控件）+ `game102-screens.dc.html`（PUI 视觉稿·卡通像素风·「稿=1:1 复刻基准」）。
> **产出**：① 四屏 `.dc.html` 视觉稿真渲染目击（双主题）；② LayoutNode 纯数据实装 `src/games/game102/hud.ts`——`buildTopBar`（对局 HUD：关号/🔑Badge/得分/暂停 + 宝箱门 ProgressBar）· `buildBurst`（连击 Float 飘分 + 突破 Particles 星爆）· `buildResult`（结算 Rating 星级 + 钥匙 Badge + confetti）· `buildSelect`（LevelPath 蛇形选关）· `buildRevive`（失败续命 Modal + Toast）；③ `pixelPour` 皮（`ui-theme.ts`·夜紫底 + 天青主强调 + 缃金点睛 + 像素糖果厚唇钮·程序化 data-URI·零外部资产）。
> **控件**：全落 34 闭集（Panel/Label/Badge/ProgressBar/Button/Modal/Rating/LevelPath/Float/Particles/Toast·`hud.test.ts` 有闭集守卫）——**零新控件·零手写逃生**（符合 manifesto 先重组）。
> **写世界纪律**：全 action 信号（pause/resume/retry/next/back/play/revive_ad/revive_pay/give_up）皆宿主生命周期动作·handler 不塞自由逻辑/DOM；play-field 落子走 render+clickable（不经 UI）。
> **待定项裁定**：待命槽/补给交互层 = **PE render+clickable**（play-field 域·实体带 hp/命中/按色计数·与 REQ-G102-TILEMAP-VERDICT 的实体棋盘同源）；PUI 侧不出其框标（避免与 render 实体双拥），HUD 顶栏/飘层/结算/选关/续命为 PUI 全部产出。
> **边界守恒**：play-field（像素画/传送带/色炮/弹道/待命槽/补给实体）= PE render 层·不在本单文件。
> **门禁**：四屏 `tools/audits/game102-*.audit.ts` 过 `ui-audit` 照妖镜（0 重叠·0 对比硬失败·390×844）；`hud.test.ts` 7 例（validateLayoutNode 零 issue 多态覆盖 + 闭集守卫）绿；tsc/build 全绿。

### REQ-G102-CAPREVIEW · capability-plan 评审（提请 Lead）· [2026-07-23] · GD 提 → **Lead 评审** · status: **✅ done（⚖ Lead 裁决 ①·2026-07-23）** · 优先级: P1 · 类型: 能力评审 + 架构裁决
> **⚖ Lead 裁决（2026-07-23·核过 §4 组合路径 + registry 六件源码存在）：裁 ①——准以「先组合表达·零运行时游戏层例外」立项，不预下沉 `conveyor-queue`。**
> - **理由（manifesto §4 先重组 + YAGNI）**：GD 列的组合路径经核属实——`event-when` / `effect-apply` / `zone-occupancy` / `tray` / `launch` / `group-count` 六件 registry **全在**（已核 `src/skills/tier2/` 源码存在）。「排队→到位触发→查同色→抛射」是这些件的标准生产线管道编排，**非新形状**。预下沉 `conveyor-queue` 属「未撞墙先造」（过度设计·宪法反对）。
> - **三条时序疑点的组合摆法**：队首递进=`zone-occupancy` 队首 + `event-when` 到位边沿；突破态 5→10 切换=`event-when` 条件树切容量数据（数据表两档·非新逻辑）；弹尽入槽=`event-when`（`group-count`剩余=0 边沿）→ `tray` 待命槽。**先按数据编排试**。
> - **回补通道**：PE 落地若实证某条组合**真表达不了**（附最小复现 + 已试的拼法），再回本表升级进引擎池 `docs/workflow/requests.md` 占槽走下沉——那时 spec 由 Lead 亲笔、Opus 施工。**在此之前 game-102 零游戏层 system 代码红线不破**（散逻辑=违规·撞墙走缺口通道·绝不游戏层自写编排）。
> - **附两条**：中央方块「同色可消/隐藏图案层」=render 组件视图路线（play-field 走渲染器·不手写 DOM）✅ 准；balance-sim 脚本例外=authoring-time 工具（同各游戏 sim 脚本先例·不进 manifest/运行时·产物入库照登记）✅ 准。
> - **实机校准补充受理（2026-07-23）**：金钥匙收集件 + 宝箱门目标计量（100）= `event-when`+`resource`/`gauge`+`effect-apply` 表达（非新缺口）；中央棋盘位图像素画倾向 `tilemap`——**PE 落地时核对 `tilemap` 对「位图→带色格阵+特殊件坐标」的适配度**，不合再回本表报缺口。弹药 20 / 容量 5 均数据参数·不涉能力变更。
> **结论**：game-102 可开工 §1-3 数据面 + §4 组合装配；撞墙即回本表补申请。
> ——原评审请求全文——
> **§4 首行——「传送带队列 + 自动同色开火」的编排怎么落？** GD 初判：可由现有能力组合表达——`event-when`/`effect-apply`（到位→查同色→触发）+ `zone-occupancy`（容量/队首）+ `tray`（待命槽）+ `launch`（抛射）+ `group-count`（剩余同色）。即「排队→到位触发」生产线管道，非真缺口。存疑：有序编排（队首递进、突破态 5→10 切换、弹尽入槽时序）若组合表达不了，倾向下沉通用 `conveyor-queue`。**边界自证**：GD 阶段零游戏层代码（`prototype.html`=设计参考 mockup）；正式 UI 走 LayoutNode，play-field 走 render 组件。
