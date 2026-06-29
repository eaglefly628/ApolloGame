# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 清理：本池仅保留 Game E/F/G 需求；非 F/G 条目已移除，见 git `41ace96`。）**
> **（2026-06-26 Token 清理：已结案条目（done/wontfix）正文压成一行摘要，完整论证/接线契约见各 commit。open/进行中条目保留全文。）**

---

## 待处理 / 进行中

### REQ-G-战斗公平与顺序回合 · [2026-06-28] · owner 试玩反馈 → 战斗 sim 域（turn-combat.ts·design G 重扫） · status: **open（核心模型+平衡·非 PG lane·PG 仅评判转交）** · 类型: 核心玩法调整（owner 拍板·待战斗/design G 评估实现）
> owner 试玩第一关后三条反馈，均落 `turn-combat.ts`（战斗 session 文件）+ 影响平衡（boss-config 目标通关率按现基线调）。PG 核实现状 + 评判，转交战斗/主程/design G：
>
> **① 起始资源不公平**：现 `MANA_START=6`（玩家 A 起手 6 源泉），敌 B `mana=0`（其回合 +1=1）；`OPENING_HAND=3` **只给 A 摸**（game-g.tsx:318），B 无扑克手牌（仅可施放地煞）。→ **owner 要：双方都 3 源泉 + 双方都摸 3 手牌**。（改 `MANA_START` 6→3 区间 + caller/init 给 B 也摸 OPENING_HAND + B 起始源泉对称。）
>   - PG 评：A 现在「先手 + 资源更多」= 双重优势（教学关 98% 靠它保送）。改 3+3 更公平，但 A 仍有**先手优势**——真公平或许要给 B 一点补偿（B 起始源泉略高 / 后手补正）。这是 design G 的平衡活。
>
> **② 回合改顺序制（核心模型翻转）**：现 `advanceBoth` = 双方兵线**同时**推进（注释：owner 2026-06-21 为 PvP 定的同步模型·替原「只推 active 方」）。→ **owner 要：我放完牌→结束回合→我方推进/攻击；敌放完牌→敌方推进/攻击**（只推 active 方·交替·看得清）。= 回退到「只推 active 方」的顺序推进。
>   - PG 评：可读性确实是同步模型的硬伤（owner「两个一起行动看不清」）。但这是**核心模型翻转**：影响 PvP 地基（当初为 PvP 同步而设）、AI 节奏、战斗 golden、且**改变平衡**。需战斗 session 重构推进阶段 + design G 重扫。
>
> **④ 掷命对决·战力来源必须透明（owner 反复要求·一直未达成 = doc24 A4「3D-READ」）**：对决时显示的有效战力 `P_eff`，玩家**必须看得见每一分从哪来**——底盘点数 + 地支附魔（**具体哪张生肖牌 +X**）+ 天罡（**具体哪张天罡 +X**）+ 士气 + 卦象 + 干预，逐项带来源标签拆解。需 `clash-resolve`/`pEff` 暴露 breakdown（每项 {source, label, delta}）→ `turn-battle-screen` 对决特写渲明细。**非黑箱·这是核心读感**。
> **⑤ 战胜方回库完全返还源泉**：战胜方单位「回库」(cycle) 时**完全返还其源泉消耗**（不打折）。`turn-combat`/`clash-resolve` 经济规则。⚠ 先确认「回库」语义（胜者退回牌库循环？ vs 现「胜者留场续攻」），再定返还点。
> **⑥ 战场单位 hover 看不到信息**：鼠标放到场上兵牌时，看不到该牌的**人物简介 + 当前加成拆解**（地支/天罡/士气/卦象各 +X 来源）。`turn-battle-screen` 给场上兵加 hover 词条（英雄列传简介 + buff 来源拆解·与 ④ 同源数据）。**复用引擎现成能力**：`Tooltip.block`（PG 大厅牌墙已用·grid 不塌）+ 词条 bubble + 视口边界定位（PG 刚下沉）——战斗屏直接套，不必重造。
> **连带**：①②⑤ 改经济/通关率 → boss-config §〇 目标曲线（98/87/75/70/65%）须 design G 用 `simulate-balance.ts` 重扫定稿。
> **PG 边界**：①②④⑤ 全在 `turn-combat.ts`/`clash-resolve.ts`/`turn-battle-screen.ts`/`game-g.tsx 战斗驱动`（战斗域）。PG（大厅/UI）不动战斗逻辑。owner 若要 PG 接手战斗这部分，需显式移交战斗文件归属（战斗 session 已近收尾）。

### REQ-G-Boss写死明牌天罡 · [2026-06-28] · PG → 战斗/loader 域 · status: **open（UI 侧已亮明牌·待战斗侧写死对齐）** · 类型: 配置对齐（boss-config-1-5 §五·五 + §七·#1）
> **背景**：按策划 `boss-config-1-5.md` 重配关1-5「明牌 counter-pick」（设计称「核心乐趣」）。**PG 已落 UI/数据侧**：`StageCampaign` 加 `deckTheme/bossTiangang/counterTip`，主页 Boss 情报 + 战役页亮出「⚡明牌天罡 + 🎯克制提示」（关1=旗手·不屈 / 铺场快攻绕开耐久…，关2-5 同 §五·五 表）。
> **缺口（战斗/loader 域·非 PG lane）**：`level.ts` 的 `boss.tiangang` 当前仍是**随机 12 张**（`bossTiangang`），与 UI 亮的明牌不一致 → 玩家「照明牌配克制」会落空。请战斗/loader 把 `boss.tiangang` 按 boss-config §五·五 **写死 ≤5**（张数随关爬 2/3/3/4/5），id 对照：关1 `bannerman,unyield` / 关2 `tigertally,bannerman,bedrock` / 关3 `tigertally,flow,twinblade` / 关4 `arrowhead,tripod,tigertally,relay` / 关5 `atlas,leaddice,irondice,tigertally,arrowhead`。
> 接好后「看明牌→配克制→碾过去」闭环成立·design G 再纳入 Boss 天罡重扫平衡（§七 备注）。

### REQ-寻路 · [2026-06-28] · owner→Lead 直派（引擎域·Lead 登记） · status: **✅ done（主程 2026-06-28·`astar.test.ts`+`pathfind.test.ts`）** · 类型: 真能力缺口下沉（连续自由空间寻路）

> **owner 直派**：「2D/3D 都要寻路系统·用 pass node 表航点·NavGraph 当摆放并行数据·新建 graph + path finding」。碰撞耦合疑虑由「NavGraph=作者摆放数据(非从 3D 几何烘焙)」化解 → 不等 P3D。
> **CORE RULE 评判**：① 碰撞已覆盖（2D overlap-detect/collision-resolve/tilemap·3D contact3d·P3D 域）→ **不重建**·寻路与之**正交组合**（nav 写 Velocity → collision-resolve 避让）；② 连续自由空间寻路=真缺口（hex A* 锁网格·steering 贪婪无全局路）→ **下沉一个通用能力**。navmesh(多边形) vs 航点图：选**航点图**（最弱 LLM 能手摆·navmesh 需烘焙器违尺子）。
> **落地**（`t2-pathfind`）：`NavGraph{nodes,edges}`(摆放数据·单例) + `NavAgent{speed,arriveRange,…}` + 引擎写 `NavPath`(缓存路径)；通用确定性 A* 抽到 `engine/spatial/astar.ts`（图无关核·hex 后续可复用去重·暂未迁免连累 grid-move）；`nav-follow` 系统复用 `Relation(target)` 索敌 + `motion-apply` 移动 + `collision-resolve` 避让。确定性 in-hash（整数 id tie-break·sqrt 同 steering 类·逐 agent 排序）。维度无关（2D 现用·升 3D 加 z 即可）。
> **🔔 P3D 知会（2026-06-28·owner 拍板）**：owner 不接受手摆 NavGraph（嫌麻烦·要 Recast 式自动生成）。**你的 runtime 我全盘复用、一行没改**；只在上游加了 `navmesh-bake`（`NavMesh` 配置 + `Collider3D` → 自动烘 `NavGraph`，喂你的 `pathfind`）。**手摆与自动烘共存**（场上摆 NavMesh→自动·只摆 NavGraph→手摆）。即你 REQ 里「navmesh 需烘焙器违尺子」那条被 owner 推翻——但**烘焙器=确定性栅格(整数·进 hash)·零手工数据·反而更合尺子**。详见 `requests-3d.md` REQ-3D-Nav。你的 NavGraph 手摆路径仍可用，**无需你做任何事**；若想收编/统一，归你定。
> **owner 需求原话归纳**：要一个**引擎原生的文生图工具**，挂在「资源库」里/旁的按钮：打开→填关键词→（填主流图站 API key）生成一整套美术；产物**自动落进某游戏资源目录 + 自动分类**；**智能**——从项目对白/数据**自动生成提示词 + 需求 + 风格控制**；一键导出所需图；可**单张按引用微调**（指明改库里哪张、怎么改、单独重生）也可批量；配置完**导出一张与需求一一匹配的数据表**，游戏即刻套用。
>
> **架构评审（PG·资深视角）**：这是**内容生产 devtool**（authoring·喂数据驱动引擎），不违宪法——游戏照常「声明需要哪些美术 key」，工具去**兑现**这些 key。**关键：一大半已存在，应重组而非重写**：
> - 已有可复用（主程现成资产线）：`src/studio/{AssetLibrary,AssetBrowser,AssetImportWizard}` + `categorize.ts`（自动分类）+ `edit-ops.ts/edit-resolve.ts`（编辑算子）+ 后端 `apollo.py /api/assets/import`（落盘 `assets/<type>/<分类>/` + `index.json` 增量）+ `src/assets/library.ts`（`manifestRecords(gameId,manifest)` 每游戏清单 + key→资产映射 + 分类法）。→ **导入 / 自动分类 / 资源库 / 映射表 这几块基本现成**。
> - **真缺口（要新建·下沉到 studio/services）**：① **生成 provider 适配层**（统一接口 + 各家实现：OpenAI `gpt-image-1` / Stability / Replicate / Scenario.gg·都有官方 API）；② **LLM 提示词编排**（读项目数据/对白 → 出提示词 + 风格令牌·走 Claude API·我们本就 Anthropic 栈）；③ **按引用编辑**（指定库内资产 id + 修改指令 → img2img/inpaint 单/批重生·可挂到现有 edit-ops）；④ **「美术需求清单 → 兑现 → 回填映射」** 的编排（清单来自游戏数据，见下 PG 可做项）。
> - **必须钉死的约束**：① **Midjourney 无官方 API**（别承诺·改用上面四家）；② **API key = 机密**·绝不进仓库（env / 系统钥匙串 / 后端代持·前端不存明文）；③ **成本闸**（批量前预估张数×单价·确认再跑）；④ provider 输出风格漂移 → 靠 ②的风格令牌 + 固定 seed/style-ref 收敛。
> - **分期建议（别一次性造完·防过度设计）**：**P1** 单 provider（OpenAI）+ 手填提示词 + 复用现有 import 落盘/分类 → 跑通「生成→入库→映射」最小闭环；**P2** LLM 提示词编排 + 风格控制（从游戏数据出需求）；**P3** 按引用单/批编辑；**P4** 多 provider 适配 + 成本闸 + 需求清单全自动兑现。
> - **PG 可立即做（游戏侧·我的 lane·不占主程）**：给 game-g 写**「美术需求清单 manifest」**——把游戏已声明的美术 key 罗列成数据表（52 名将牌面 `hero/<id>`、闪艺 `foil/<id>`、地煞、UI 底纹/牌背槽 + 每项的尺寸/比例(5:7)/风格槽/用途）。这就是工具要兑现的「需求表」、也是 P2 提示词编排的输入。**主程的工具产出按此清单回填，游戏零改即用。**
> **请主程**：评审架构 + 认领（studio/assets/services/net/apollo.py 域）。owner 拍板分期范围后开工。

### REQ-UI-G战斗手牌 · [2026-06-27] · GA（game-g·战斗 UI 数据驱动重构撞到） · status: **✅ 已裁（① 效果半边=`layout.fx` 下沉·done；② 牌面信息层=主程 via REQ-UI-G棋枰 裁决回驳新抽象→格内兵牌/手牌用 PlayingCard+私货皮·随 play-field 现状豁免·保持 bespoke）** · 类型: 真能力缺口下沉（① done / ② 回驳-豁免）

> **★ 对账（GA 2026-06-28·接主程裁决后·结案）**：本 REQ 拆两半——
> - **① 效果/动效半边**（主将 glow·脉冲·发牌飞入）= 主程 `REQ-FX-战斗特效抽象` 的 `layout.fx: VisualEffect[]` **已覆盖·done**（GA 已接 fx 基线·门禁绿）。
> - **② 牌面「信息层」半边**（开销水滴/战力角标/生肖行/主将 frame）= 主程在 `REQ-UI-G棋枰` 裁决里一并定调：**「格内兵牌/手牌牌面用 `PlayingCard` + game-g 生肖/水印 juice 作私货皮·无需新『牌面层』抽象」→ 回驳新下沉**（rule-of-three 未过·别为单游戏臃肿引擎）。手牌牌面属同一「私货 play-field/牌面 juice」族 → **随 play-field 现状豁免·保持 bespoke `handCard()`**（同棋枰·不 lossy 迁·非破坏·不阻塞）。Tooltip 拆解走 `Tooltip.block`（不缺）。
> - **结论**：战斗屏数据驱动范围 = HUD chrome（顶栏/动作菜单/结束回合/设置浮层·**已迁·在主线·全绿**）；手牌牌面 + 棋枰 + 掷命特写 + 源泉条 = 私货 play-field/牌面 juice·**现状豁免保持 bespoke**。本 REQ 结案。

> **背景**：战斗屏 UI 重构（`turn-battle-screen.ts` → LayoutNode）进行中。顶栏 + 动作菜单 + 结束回合钮已迁 LayoutNode（全绿推送）。下一块=**手牌区**，按 UI 铁律应走 LayoutNode（兵牌=`PlayingCard`），但撞到牌面 juice `PlayingCard` 表达不了：
> 1. **召唤源泉开销**（cost 1-3）：原版牌面顶部 N 颗水滴图标。PlayingCard 无 cost/pip。
> 2. **战力 badge**（power）：原版右上显眼红底数字。PlayingCard 只有 `value`(右下小字)·不够显眼、位置不对。
> 3. **生肖行**（zod×3）：牌底 3 格生肖（已激活=亮/未激活=暗）。PlayingCard 无 tag/pip 行。
> 4. **主将标记**（general）：水印「将」+ 顶部「⭐主将」浮标 + 金色脉冲边框。PlayingCard 无强调框/水印。
> 5. **天罡牌**（kind:'gang'）：完全另一种版式（图标圆 + 名 + desc 持续战法），非扑克牌面——PlayingCard 不适用，更像 `Card`。
> 6. **富 tooltip**：悬浮显战力拆解（点数+经营+地支附魔逐项来源）。可用 `Tooltip.bubble` 包 PlayingCard 表达（这条不缺·已有能力）。
>
> **GA 的判断（带理由·请 Lead 定夺）**：
> - 与 **LEAD→PG `[2026-06-18]`** note 直接冲突——那条明说「game-g 的**牌面纹理 + 编排 = 私货 juice·留 game-g·不下沉**」。手牌牌面正是此类。
> - 但 **UI 铁律** 又要求「手牌走 LayoutNode」。两者张力需 Lead 拍板，**GA 不擅自**①手写 React 逃生（破铁律）②无脑加宽 PlayingCard（破防臃肿/私货红线）。
> - **三条路供选**：
>   (a) **下沉**：PlayingCard 加通用卡牌字段 `cost`(pip 数+图标槽) / `stat`(角标) / `tags`(小图标行·filled/empty) / `frame`(强调框)——这些 TCG 类普遍需要、rule-of-three 可论证（E/F/G 都有带开销/战力/标记的牌）。天罡牌走 `Card`。
>   (b) **留 bespoke**：Lead 确认牌面属"私货"·手牌区豁免铁律（play-field-card 性质·近棋枰）→ GA 保留现有手写 handCard，仅迁手牌区外壳（标题/计数）。
>   (c) **混合**：兵牌牌面归 play-field 渲染器（路②·与棋枰格内兵牌同源·本就同款 sideFace），手牌当"待部署的 play-field 卡"一并走渲染器。
> - GA 倾向 **(a)** 若字段确通用（E/F/G 复用），否则 **(c)**（兵牌牌面与棋枰格内兵牌是同一套·一并归渲染器最一致）。**(b)** 最省事但留一块手写违铁律。
>
> **不阻塞**：手牌区暂保持现有手写 handCard（与已迁的顶栏/动作菜单非破坏并存·同过渡期套路）；主程下沉效果属性后 GA 接着做第三块。
>
> ---
> **★ owner steer（2026-06-27·下沉·但要抽象·问题交主程）**：owner 两点拍板——
> 1. 这些 React 式效果应让**主程在 UI 库（解释器）里实现**、游戏层只填数据，不在游戏层手写 React/CSS（即选 (a)·下沉）。
> 2. **但不能「有一个效果就加一个开关」**——那样 `PlayingCard` 属性会爆炸、配置面越铺越宽（owner 原话：「需要抽象一下…这样数据配置会比较多」）。**怎么抽象成通用原子（而非堆 N 个 bool/字段）= 主程域设计活·owner 把这个问题交给主程**。
>
> **故本 REQ 只陈述「手牌要表达什么」（原始需求·不替主程定 API）**——下面是 game-g 战斗手牌的牌面事实，**请主程收敛成通用抽象**（GA 不预设字段·避免把"开关膨胀"写进需求）：
> - 一张「待打出的卡」需展示：**开销**（召唤源泉 1-3·原版画成 N 颗水滴）、**主数值**（战力·显眼角标）、**一组小标记**（生肖×3·已激活/未激活）、**强调态**（主将=水印「将」+脉冲金框）、**稀有度**点、**名/点数/花色**。
> - 交互/动效：选中、买不起置灰、发牌飞入翻面、悬浮看**战力拆解**明细。
> - 另有**非扑克版式的「持续战法」卡**（天罡·图标圆+名+desc·整场加成）。
> - **GA 自查已有、不缺**（供主程参考·缩小缺口面）：发牌飞入/翻面 = `layout.anim:'dealIn'|'flyIn'|'pop'` + `flipOnHover/backFace`；富 tooltip = `Tooltip.bubble`；选中/置灰 = `selected/dimmed`；非扑克卡 ≈ `Card`。**真缺的只是「牌面信息层」那几样**（开销/主数值/标记组/强调态）——请主程判断是扩 `PlayingCard`、还是抽一个更通用的「牌面信息装饰」原子来承载，避免逐效果加字段。
> - **rule-of-three 佐证通用性**：E 小丑牌（小丑带 ×mult/+chips/edition 标记）、F 自走棋（单位带星级/羁绊/费用）、G 战斗手牌（开销/战力/生肖/主将）——三游戏都要「卡牌 + 信息层装饰」，抽象划算。
>
> **同一抽象问题贯穿战斗屏其余 juice**（源泉条收退残影/半格/升腾火花、掷命特写翻起飞入/硬币弹出/火花脉冲）：GA 迁到那几块时同样**只报「要什么效果」、把抽象交主程**，绝不在游戏层留手写 CSS keyframes，也不要求逐效果加开关。

### REQ-UI-G棋枰 · [2026-06-27] · GA（game-g·战斗 UI 重构路②评估·请 Lead/owner 裁决形态） · status: **🔁 owner 2026-06-28 推翻豁免·拍板「激进全量重写为数据驱动 LayoutNode·缺能力开给主程」（GA 重评：x/y 绝对定位+rotate+现有控件可重组·不需新引擎原语·见下「GA 重评 2026-06-28」）** · 类型: 形态裁决 → 转 全量数据化重写

> **★ GA 重评（2026-06-28·能力长进后重新评估·owner 拍板激进重写）**：主程当初「豁免」是按「play-field→canvas/ECS 渲染器」框架（impedance mismatch）；但主程自己澄清「铁律要数据驱动·非必须栅格化」。本次重构期间 LayoutNode 长出关键能力 → **棋枰可纯数据驱动 DOM 重组，不需新引擎原语**：
> - 解锁点：`LayoutConstraints.x/y`=**绝对定位**（render.ts L76·position:absolute）+ `rotate` + `Panel 自带 position:relative`（定位上下文）+ 控件集（`cols` 网格 / `PlayingCard` / `Versus` / `CoinFlip` / `fx` / `Tooltip.block` / `Image` / `anim`）。
> - 逐元素：三路×9 格=Panel grid cols:9；格内兵牌=PlayingCard + x/y 绝对叠 Label(战力/生肖×3/将水印)；斜梯=x/y+rotate 细长 Panel + bgScroll 流动；门钮=Button；城堡/血灯=Panel 组+rotate:45 菱形；掷命特写=Versus+CoinFlip+Label 明细；forecast/落点/clash 环=x/y 叠+fx pulse；hover=Tooltip.block。
> - **rule-of-three 闸不卡**：这是游戏层填数据（重组）·非加引擎能力。
> **owner 拍板**：激进推进·全部数据化落地·缺的能力开给主程做。
>
> **GA 分阶段执行（每段独立全绿可回退）**：① 掷命对决特写(Versus/CoinFlip·无缺口·试点) → ② 棋盘骨架(grid+格+门·需 Panel.action) → ③ 兵牌信息层(PlayingCard+x/y 叠·纯重组) → ④ 斜梯/城堡/源泉(rotate 重组 + 源泉 drain fx)。
>
> **撞到/将撞到的真缺口（已拆成下列 REQ 开给主程并行）**：`REQ-UI-容器可点`(Panel.action·②需) · `REQ-UI-fx源泉消退`(④需) · `REQ-UI-容器描边形`(Panel 边框色/圆角/虚线·②城堡+格框需·新撞)。其余用现有能力重组。
>
> **★ GA 阶段②执行记录（2026-06-28·部分落地 + 新撞缺口）**：
> - ✅ **血灯 hpGem 已数据化**：旋转菱形宝石 → `Label '◆'/'◇'`（亮=`danger` 血红+磷光 / 灭=`dim`）。菱形字符天然即斜方宝石、避开 Panel「圆角恒 10px·小件压不出方钻」坑。最弱 LLM 只填 ◆/◇+令牌。两军大本营血灯均已切（`hpRowNode`）·全绿。
> - 🩹 **顺手修潜伏色 bug**：`GG_BATTLE_THEME` 的 `danger`/`ok` 原桥到 `var(--heart)`/`var(--club)`（大厅令牌·战斗 `THEMES` 集里**未定义** → 红/绿失效）；改桥到战斗自有的 `var(--danger)`(#ff5d62 正是血灯红)/`var(--hp)`。同时修好阶段①掷命特写里 ok/danger 文字色（之前也踩这坑）。
> - 🩹 **补阶段①漏改的测试选择器**：掷命钮迁数据驱动后挂 `data-action`，但 `flow-walk.test.ts`/`game-g.turnmatch.test.ts` 仍查旧 `[data-act="clash-roll/ok"]` → 驱动不动掷命、对局 160 回合不收场（flow-walk 此前一直挂红·非本次引入·已确认 clean tree 也红）。改双挂 `[data-act=...],[data-action=...]` 兼容。（live 委托读 `dataset.act ?? dataset.action`·线上一直 OK·仅测试桩失配。）
> - ⛔ **城堡 fortBase + 格子 chrome 暂保 bespoke·等 `REQ-UI-容器描边形`**：初评「Panel 组+rotate 可重组」低估了 Panel 边框是**令牌专用**（no 阵营橙/蓝描边、no 金边界格、no 虚线放牌区）+ **圆角恒 10px**（城垛/盾压不出形）。硬塞要么大量 hack `bg` 渐变（违「最弱 LLM 同数据」）要么失真。→ 拆出 `REQ-UI-容器描边形` 开给主程·到货再切城堡/格框。兵牌信息层=阶段③(PlayingCard+x/y·另算)。

### REQ-UI-容器可点 · [2026-06-28] · GA（game-g 棋枰数据化重写·阶段②需） · status: **✅ done（主程 2026-06-28·接受·`Panel.action`+`actionArg`·`panel-action-fade-keyframes.test.ts`）** · 类型: 真能力缺口（容器无 action）

> **主程裁决·接受**：真缺口——`Card` 有 action 但强带卡壳 chrome、`Panel` bare 无框却不可点，**「bare 可点容器」两者都给不了**。下沉 `PanelProps.action?`(+`actionArg?`) → 渲 `data-action`[+`data-arg`]+cursor:pointer（同 Button·只信号名·mountUI 委托路由·handler 不塞自由逻辑）。复用面=任何可点卡片区/格子/列表行容器。棋枰格/门可数据化了。

> 棋枰数据化重写时：棋盘的**路轨/格子/门**需「点击→部署/翻门」，但这些是组合容器(`Panel`)·`PanelProps` 无 `action`（只有叶子控件 Button/Tag/Card 可点）→ 组合容器无法发信号·棋盘交互没法数据化。
> 请主程给 **`Panel.action?`（+`actionArg?`）**：非 bare 容器可点→渲 `data-action`[+`data-arg`]（同 Button），让「带 children 的容器」可作点击目标。红线同既有：只发信号名·handler 不塞自由逻辑。复用面：任何「可点的卡片区/格子/列表行容器」。

### REQ-UI-fx源泉消退 · [2026-06-28] · GA（game-g 棋枰数据化重写·阶段④需·owner 点名可做） · status: **✅ done（主程 2026-06-28·接受·fx kind `'fade'`·`panel-action-fade-keyframes.test.ts`）** · 类型: 真能力下沉（fx 闭集补 kind）

> **主程裁决·接受**：「淡出消失」是通用 disappear 效果（消耗/移除/消亡都用），现 fx 闭集无对应（pop=入场、flash=闪色、无 opacity→0）。按 fx 治理（新效果=加一个 kind·非布尔）下沉 kind `'fade'`(opacity→0·forwards 停末态)。源泉「分段半透明消退」= 每段挂 `fx:[{kind:'fade'}]`、分段结构由游戏数据组合。

> 源泉条「召唤源泉」消耗时，原 bespoke 有「刚花掉的格分段半透明消退」动效（g-drain 收退残影）。迁数据驱动后 `layout.fx` 闭集无对应 kind。**owner 2026-06-28 点名「可以让主程做·分段半透明的消失效果」**。
> 请主程给 `fx` 加一个 kind（如 `'fade'`/`'drain'`·分段半透明淡出·once 触发）·或确认用现有 `flash`/`pulse` 近似。非阻塞（先用现有近似·有专用 kind 更保真）。

### REQ-UI-容器描边形 · [2026-06-28] · GA（game-g 棋枰数据化重写·阶段②城堡/格框撞） · status: **✅ done（主程 2026-06-28·owner 插播优先·三字段全接受·`panel-edge-radius-dashed.test.ts`）** · 类型: 真能力缺口（Panel 边框表达力·闭集补字段）

> **主程裁决·三字段全接受（owner 2026-06-28 插播提优先级）**：真缺口——Panel 边框令牌专用（jade/line）、圆角恒 10、无虚线，`bg` 渐变硬凑违尺子；rule-of-three 过（任何棋盘/战棋/卡牌位游戏）。按闭集 + 主题解析下沉（绝不收自由 hex/CSS）：
> - **`Panel.edge?: EdgeColor`**（`'jade'|'gold'|'ok'|'warn'|'danger'|'mine'|'foe'`）——语义/阵营描边色·复用既有语义令牌解析（同 fx 的 `fxColor` 纪律·新增 `edgeColor` 解析器）；`mine`/`foe`=通用我/敌阵营色 → **可选 UITheme 令牌** `mine?`/`foe?`（战斗主题填我橙/敌蓝·缺省回退暖 warn/冷 jadeLine·非对战主题不填零影响）。覆盖默认线 + 优先于 accent。
> - **`LayoutConstraints.radius?: number`**——通用圆角覆盖（放 layoutStyle·末置生效·任意组件·同 rotate/scale/chamfer 一族）；Panel 的 vignette/pattern 叠层同步取此圆角（不再硬编码 10·叠层不露直角）。
> - **`Panel.dashed?: boolean`**——`border-style:dashed`（空格落点圈/占位/拖放框·配 edge 取色 + radius 取圆）。
> 落点：`types/render/catalog/index.ts`（catalog 收 edge 闭集 → validate 自动拦拼写错·radius 同 rotate 走 lenient）。城堡阵营框 / 城垛圆角(radius 小) / 金边界格(edge:gold) / 虚线落点圈(dashed+radius) / 源泉亮段描边(edge) 均可数据化。

> 阶段②搭骨架撞到：棋盘的**大本营城堡 + 格子 chrome** 要的边框形态，现 `Panel` 表达不了（边框只有令牌色 `line`/`accent→jadeLine`·圆角恒 `10px`·无虚线）：
> - **阵营/语义描边色**：我方城堡橙 `#ff7a45` / 敌方蓝 `#3a86d4` 框；边界格金高亮框；放牌区暖橙/冷蓝内描边。← Panel 边框令牌专用·压不出。
> - **圆角控制**：城垛(11×12 圆角 3)/盾(异形圆角)·小件被 Panel 恒 10px 圆角压成胶囊/圆。
> - **虚线描边**：空格的虚线落点圆圈（`2px dashed`）。← 无 dashed。
>
> 请主程在闭集内补 `Panel`（或 `LayoutConstraints`）少量**受控**字段，三者一族一起给（最弱 LLM 能填·绝不收自由 CSS 串）：
> - `Panel.edge?: 'jade'|'gold'|'mine'|'foe'|'ok'|'danger'`（**语义/阵营描边色枚举**·闭集·非自由 hex；`mine`/`foe`=游戏通用「我/敌」阵营色·或主程觉得该叫 `warm`/`cool`）。
> - `LayoutConstraints.radius?: number`（圆角 px·覆盖恒 10·小件用）。
> - `Panel.dashed?: boolean`（虚线边·落点/占位框用）。
>
> 这是「play-field 棋盘格/堡垒」一族·复用面：任何**棋盘/战棋/卡牌位**游戏（game-e/未来战棋）。**判据自检**：是现有令牌真表达不了的缺口（阵营色/异形圆角/虚线）·非能重组（`bg` 渐变硬凑违数据驱动尺子）→ 够格下沉。若主程认为该走**铁律路②「play-field→render 组件/引擎渲染器」**而非给 Panel 加这些（见本 REQ 下方原评估 C 节阻抗失配），请 owner 拍这条架构岔路：**给 UI 库补 play-field 描边原语** vs **game-g 棋盘改走引擎 render 组件**。GA 倾向前者（增量小、已落地血灯/掷命/HUD 在同一 LayoutNode 路·一致）·但听 owner。
>
> **★ GA 全量前瞻盘点（2026-06-28·owner「想想我们这边差什么」·把整张剩余 play-field 一次盘完·避免逐阶段才发现缺口）**：逐件对现有能力核 → **唯一真缺口 = 本 REQ（edge/radius/dashed）**；其余全可现有令牌/近似/PlayingCard 重组 → 按 CORE RULE「能重组→不开新缺口」**一律不再下沉**（防引擎臃肿）：
> | play-field 件 | 现状能表达? | 缺什么 |
> |---|---|---|
> | 血灯 hpGem | ✅ 已切（Label ◆/◇） | — |
> | 掷命特写 | ✅ 已切（Versus/CoinFlip） | — |
> | 路轨 laneRow（点击部署） | ✅ Panel grid cols:9 + **Panel.action**（已到货） | — |
> | 门钮 gate（◉/✕·脉冲·点击） | ✅ Panel.action + Label + **fx pulse** | — |
> | 源泉条段 + 收退 | 🟡 段 bg ✅ + **fx fade**（已到货）✅；亮格描边 | **edge**（亮蓝段描边·本 REQ） |
> | 城堡 fortBase | 🟡 光环/tag/计时器/连接点 ✅ | **edge**(阵营框)+**radius**(城垛/盾)（本 REQ）；盾花色 glyph 暗色→用 `dim` 近似 |
> | 格子 slotCell chrome | 🟡 deploy 底纹 bg ✅ + 落点 fx ✅ + clash 环 accent+pulse ✅ | **edge**(金边界格/deploy 描边)+**dashed**(空格虚线圈)（本 REQ） |
> | 兵牌信息层（阶段③） | ✅ PlayingCard + x/y 叠 Label（战力/生肖/将） | 花色→PlayingCard 内建红黑(2 色近似 4 色)·将水印→`dim` 大字近似·**无新缺口** |
> | 斜梯 ladders | 🟡 rotate 细长 Panel + bgScroll 流动近似 SVG | 连接线原语可不开（rule-of-three 只此一处·近似够用）·**不下沉** |
> | hover tooltips | ✅ Tooltip.block；forecast 档色→ok/warn/sub/danger 令牌语义近似 | **无新缺口** |
>
> 结论给 owner：**我们这边只差这一条（描边形 edge/radius/dashed）**——它一到货，城堡/格框/源泉段全可数据化；兵牌层/门钮/斜梯我**现在就能用近似推**（不卡它）。不该再开别的缺口（Label 任意色/opacity/连接线都能现有令牌或近似重组·开了反而臃肿引擎·违 CORE RULE）。

> **GA 对战斗屏「棋枰 play-field」走引擎渲染器（铁律路②）的评估。结论：现有渲染器与 game-g 棋盘形态阻抗失配·照搬高成本低收益·需 Lead/owner 定形态。**
>
> **A. 棋盘是什么（结构）**：boardWrap = 两端大本营 `fortBase`（城堡+光环脉冲+阵营 tag+**血灯 hpGem ×N**[旋转45°菱形宝石·亮/灭]+我方计时器/敌方**地煞牌行**[hover tooltip·「？」未揭示·已用态]+连接点·敌方整体可点 boss-info+hover boss 浮窗）+ 3×`laneRow`（路名竖排 tag + **9 格 slot 轨**[grid 9列]·每格：边界金高亮/放牌区底纹/虚线圆/**格内兵牌**[=手牌牌面同款 juice]/clash 红环脉冲/落点 👆 高亮/**hover 战力拆解 tooltip**/forecast 胜率徽标）+ `laddersLayer`（绝对覆盖 SVG viewBox 900×400·8 道**斜梯**[底轨+流动虚线箭头 marker+g-flow 动画]+**门钮**[◉/✕·可点 data-gate·脉冲]）。
>
> **B. 引擎渲染器是什么**：ECS `World` → `collectRenderables(world)` → `Renderable[]` → backend（CanvasRenderer 2D **栅格** / Three / SVG / Ascii）。原语：Transform/Shape(box/circle/polygon)/Sprite/Text/Color/Mesh3D/Gauge/Tilemap/HexBoard。范例 game-e：`buildViewEntities`→World→CanvasRenderer。
>
> **C. 核心阻抗失配（关键·该不该做的依据）**：
> 1. **game-g 战斗无 ECS World**：`turn-combat` 是纯 `TurnBattle` 状态（0 处 World/Transform/Renderable·已核）。渲染器吃 World → 要走渲染器须**新建一层 ECS-World 镜像**（lanes/units/forts/gates→entity+Transform·每重渲同步），整层新架构。
> 2. **栅格 vs DOM/CSS/SVG**：CanvasRenderer 栅格化；棋盘是重 DOM/CSS/SVG——渐变/水印字/**hover 磨砂 tooltip(战力拆解·地煞·boss)**/SVG 流动斜梯/虚线环/脉冲/forecast 徽标。栅格化后这些全要重做，**一大半渲染器原语没有**。
> 3. **缺口成片**：直线「3路×9格」轨（Tilemap/HexBoard 是瓦片/六角·非直线格轨）/ 离散血灯（Gauge 是连续条·非 N 颗宝石）/ 斜梯+流动箭头（无连接线/路径动画/箭头原语）/ 可点门钮（canvas 命中测试要 PointerInputSource 另一层）/ hover tooltip（canvas 无 DOM hover）/ forecast·placeable·clash 浮层动画。
>
> **D. GA 判断 + 三选一（请 Lead/owner 裁）**：
> - 直接照搬现有 canvas/ECS 渲染器 = ①造 World 镜像新层 ②栅格里重做全部 DOM/CSS/SVG/hover juice ③填一堆渲染器缺口 → **高成本·低收益·且 hover 拆解等很可能降级**·违「别为单游戏臃肿引擎」。但铁律确要求 play-field 走渲染器（非 LayoutNode）。**冲突根源：现有渲染器是「ECS+栅格」形态·game-g 棋盘是「回合制 DOM/CSS/SVG 盘+hover」**——属引擎域+架构裁决·GA 不单方面定。
>   - **(1) 全量上 ECS+canvas**（守字面）：造 World 镜像+重做 juice+填缺口。成本最高·hover 拆解可能降级。**GA 不建议**（除非 owner 要统一栅格管线且接受投入/降级）。
>   - **(2) 下沉「数据驱动 DOM 棋盘 render 原语」到引擎**（铁律精神·非字面）：承认回合制盘不塞 canvas/ECS·而该有声明式 **DOM 盘组件**（lane/slot 网格+离散血灯+连接线/斜梯+格内卡位）·引擎以 DOM 解释（同 UI 库形态·但归 render 层）。game-g 出数据·引擎出盘。复用面=所有「格盘/路盘」类。**GA 倾向此条**（属主程域设计·Lead 定划不划算/rule-of-three）。
>   - **(3) 暂豁免·棋盘留 bespoke**：Lead 裁定 game-g 棋盘=「私货 play-field」(同牌面 juice 一类)·暂不强迁·等 (2) 通用 DOM 盘原语就绪再迁。**最务实·不阻塞**。
> - **与手牌抽象耦合**：格内兵牌 = 手牌牌面同一套（sideFace/角标/生肖/主将水印）→ 等主程「牌面信息层」抽象出来后两者共用同一卡牌原语。棋盘骨架（格轨/血灯/斜梯/门钮）则是独立缺口。
>
> **E. 不阻塞**：棋盘现手写、能跑、hover 拆解/forecast/动画齐全·非破坏。建议 **(2) 通用 DOM 盘原语 + 主程牌面抽象两者就绪前·棋盘保持现状**·不做 lossy 迁移。

> **主程裁决（2026-06-27）· 取 (3) 现状豁免 + (2) 列为 rule-of-three 触发后的目标 · 驳 (1)**。GA 分析到位、E 建议正确。逐条：
> - **驳 (1) 全量 ECS+canvas**：造 World 镜像层 + 栅格里重做 hover/SVG/动画 juice + 填一堆渲染器缺口 = 成本最高、hover 战力拆解必降级、且「为单游戏臃肿引擎」——违 manifesto。**铁律要的是「数据驱动（非手写 DOM/React）」，不是「必须栅格化」**——别把「走渲染器」字面化成「必须塞进 canvas/ECS」。
> - **(2) 通用数据驱动 DOM 盘 render 原语 = 正确的最终形态，但现在不建（rule-of-three 未过）**：声明式「格盘/路盘」原语（lane/slot 网格 + 离散血灯 + 连接线/斜梯 + 格内卡位·引擎以 DOM 解释·归 render 层）确是铁律精神的正解、复用面也对。但**当前只有 game-g 一家要**——为单游戏造通用盘引擎=过度设计风险（同「别为单游戏大厅造菜单 DSL」前车）。**触发条件：出现第 2 个「格盘/路盘」消费者 → 即下沉成通用 DOM 盘 render 原语。**
> - **取 (3) 现状豁免**：game-g 棋枰 = **私货 play-field**（同 game-g 牌面 juice / 抛飞相撞编排一类·已有豁免先例）。手写能跑、hover 拆解/forecast/SVG 斜梯/动画齐全、非破坏。**暂不强迁**，免 lossy 降级。
> - **边界守住的是什么**：UI chrome（HUD / 菜单 / 面板 / 大厅）**仍必须 LayoutNode**（game-g 大厅已做到）。play-field 棋枰作为复杂 bespoke 容器**暂豁免**——与铁律一致（铁律本就把 play-field 划出 LayoutNode、牌面 juice 也已豁免）。
> - **格内兵牌**：用引擎 `PlayingCard`（LayoutNode 卡原语）渲染、game-g 生肖/水印 juice 作私货皮——本就够，**无需新「牌面层」抽象**。
> **结论给 GA**：棋枰保持现状、不做 lossy 迁移、不阻塞、继续。(2) 已挂账「等第 2 个格盘消费者即下沉」。owner 若要统一栅格管线/即刻通用化可推翻本裁。

### REQ-UI-fx控件叠层 · [2026-06-28] · GA（game-g·接 REQ-FX 给战斗 HUD 补 fx 时撞到） · status: **✅ 已裁（主程 2026-06-28·①误诊-驳 / ②done 导出 `ensureUiKeyframes`）** · 类型: 真能力缺口（fx 叠层未通达自渲染控件）

> **主程裁决**：
> - **① data-fx 不达控件 = 误诊·驳**：实测 `renderNode({type:'Button', layout:{fx:[sheen,flash]}})` → 输出含 `data-fx="sheen flash"`（注入分支的正则 `^(\s*<[tag])` 命中 `<button>`，对自渲染控件同样生效）。data-fx **确实落到了** Button/Tag/PlayingCard 根元素。
> - **② keyframes 隐式依赖 mountIU = 真缺口·done**：你看到的「按钮 sheen 失效」**真因是 ②**——战斗屏走 `renderNode+innerHTML`(非 mountUI)，`@keyframes`/`[data-fx]::after` 没注入 → 有属性无规则 → 静默失效。修：**导出幂等 `ensureUiKeyframes(doc?)`**（从 server.ts 抽出·index 导出）。战斗屏在 innerHTML 前调一次 `ensureUiKeyframes()` 即自注入、不再靠大厅 mountUI 先跑。修了 ② 后按钮 sheen/flash 自然生效（data-fx 本就在）。

> 接主程 `layout.fx`（赞·已用于战斗 HUD：当前回合状态灯 `pulse` 生效）时撞到两处小缺口，报给主程（GA 不擅改 ui 库）：
> 1. **fx 的 `sheen`/`flash` 叠层（`data-fx` 属性）只挂在「通用/Panel 节点」，没挂到自渲染控件（Button/Tag/PlayingCard 等）**：`renderNode` 末段给节点加 `data-fx` 的分支只覆盖通用包装；`Button` 走 `renderButton` 自出 `<button>`，只拿到 fx 的 `style`（`position:relative`），**拿不到 `data-fx="sheen"` 属性** → `[data-fx~="sheen"]::after` 不命中 → **按钮上的 fx sheen/flash 静默失效**（pulse/float/glow 走 `animation/filter` 进 style·不受影响·正常）。GA 现状规避：动作钮不加 sheen；金色 CTA 用 `Button kind:'hero'` 自带 sheen（够用）。建议：把 `data-fx`（及 `data-sheen`/`data-anchor` 等叠层/锚点属性）也输出到自渲染控件的根元素，让 fx 叠层对 Button/Tag/PlayingCard 一致生效。
> 2. **keyframes 仅 `mountUI` 注入（`APOLLO_KEYFRAMES` 私有未导出）**：战斗屏走 `renderNode + innerHTML`（非 mountUI·因 1340×858 `zoom` 缩放 + pointerdown 委托架构），fx/anim 的 `@keyframes` 与 `[data-fx]::after` 规则当前**靠大厅 mountUI 先跑一次注入进 document**（id 守卫幂等·实际流程 lobby 必先于 battle·故能用）。但这是**隐式依赖**。建议：导出 keyframes/fx CSS（或给个 `ensureUiKeyframes(doc)` 幂等 helper），让 renderNode-only 屏自注入、不依赖 mountUI 跑过。**非阻塞**（现流程 work）。

### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

### REQ-UI-Label字阶裸数字 · [2026-06-28] · PG 实现（**owner 当面授权 PG 直接改引擎此一处·非常规**） · status: **✅ done（PG 2026-06-28·`label-size-number.test.ts`）** · 类型: 真能力缺口（curated 字阶太粗·不可重组）
> **背景**：owner 复刻像素稿时问「字体库难道不该所有档都有吗·从 8 到 24 甚至更大」。Label.size 原是 curated 7 档模数阶梯（xs10/sm11/md13/lg16/xl22/xxl28/xxxl34），刻意只给少数档保和谐（同 Tailwind type scale）；但原版手写 CSS 用了 ~20 种 px（8/9/10/11/12/13/14/15/17/18/19/20/21/22/24/26/30/34/50/64），缺 12/14/15/17–21 → 复刻对不齐。**真缺口**（数据层表达不了非档位 px）。
> **下沉**（不枚举每档·更干净）：`Label.size` 兼收 `具名令牌 | number`。render：`typeof size==='number' ? size : sizeMap[token]`；catalog 新增字段类型 `enum-or-number`（具名档查表保和谐默认 + 裸 px 作复刻精确档·8→任意大）；validate：数字放行、令牌拼写错仍拦 bad-enum。向后兼容（旧具名档零回归）。
> **边界声明给主程**：此改动落在 `src/ui/components/{types,render,catalog,validate}.ts`（主程域）。常规该走 REQ 由主程实现，但 **owner 2026-06-28 当面授权 PG 直接改这一处**（不想等排期）。主程如对 `enum-or-number` 命名/校验有更优写法，可径直重构——PG 不占此设计。tsc+vitest(全)+build 全绿已推。

### REQ-UI-G收藏卡 · [2026-06-26] · PG 同步（UI 库域·game-g 收藏页逐页对齐撞到的缺口） · status: **✅ done（主程 2026-06-26·①② 均下沉·`collection-card.test.ts`）** · 类型: 真能力缺口（尺子已过·不可重组）

> game-g 收藏页对齐 Designer comp（`UI/Game G 收藏·牌谱.html`）+ 原版管线时，撞到 2 个 LayoutNode 表达不了、不可重组的缺口：
> ① **PlayingCard 悬停翻面 / 双面 reveal**：原版 `.pcard-wrap:hover` 时 front→back scaleX 横向翻转，露出英雄列传（名/朝代/简介）。引擎 PlayingCard 仅静态 `faceUp`、无悬停翻转、无「正面=牌面 / 背面=信息子树」。Tooltip 只弹气泡不翻卡、faceUp 静态——均不可重组表达。建议：PlayingCard 加 `flipOnHover` + `back:LayoutNode`（背面渲子树·同 `Tooltip.bubble` 思路），或新 `FlipCard` 控件。
> ② **响应式卡宽 + grid 固定列数**（已量原版确切 CSS）：原版收藏卡是**流式**，零固定像素——
>   `.hero-grid6{ grid-template-columns:repeat(6,1fr); gap:14px }` · `.pcard-wrap{ flex:1; min-width:0 }` · `.pcard{ width:100%; aspect-ratio:5/7 }`。
>   即「6 列 + 卡=100% 格宽 + 5:7 比例」。引擎 PlayingCard 是**固定宽**(sm/md/lg=52/64/82px)、Panel grid 只 `auto-fill(minmax(minCol,1fr))` → `1fr` 永远把格子拉宽过卡 → **数据层无论怎么调 minCol 都消不掉卡间空隙**。
>   建议：① `LayoutConstraints` grid `cols:N`（固定列数·覆盖 auto-fill）；② PlayingCard `fluid`（width:100% 充满父格 + 维持 5:7 aspect-ratio·替代固定档）。
> PG 侧已做近似（grid minCol 122 + size lg → ~6 列大卡），但**卡填不满格子→有空隙**、且无翻面；需此 2 能力才能真·一模一样（owner 2026-06-26 点名空隙问题）。

### REQ-UI-G大厅审尺寸/卡内布局 · [2026-06-27] · PG 同步（UI 库域·owner 大厅人肉审批量） · status: **✅ 已评审（主程·①接受 ②③④⑤回驳-已覆盖·裁决见末尾「REQ-UI-G牌组保真批」+ `tag-size-card-overlay.test.ts`）** · 类型: 混合（1 真缺口 + 4 已覆盖）

> owner 大厅逐页审，撞到一批 PG 数据层做不了、需引擎补的：
> ① **Tag 加 `size` 档**：右上货币 pill(商城/金币/钻石) 字太小不够大气·要≈2x。Tag 现 font-size 写死 11px。
> ② **Card 加 `size` 档**：主页 Boss 地煞卡 + 天罡卡 字要大≈1.3x·行高更高。Card title/sub 现写死 12/10px。
> ③ **全局字号对齐**：owner 要求所有字号对齐原版。已扒原版 lobby-styles 字号分布：**常用 11/12/13/15/17px·几乎不用 10px**·大标题 34。对比引擎：Tag 写死 11→应 ~13；Card 副标 10/标题 12→应 ~13/14；**Tabs 导航 12→应 ~15**(原版 .nav 15px·明显偏小)。建议 Card/Tag/Tabs 同 Label 加 size 体系。PG 侧已把 Label `xs(10)` 全抬到 `sm(11)` 对齐原版下限；其余固定字号控件待主程。
> ④ **PlayingCard 卡内布局可调**（牌组扑克）：选中→**中央"选"字**(替/加金边·更醒目)；耗费(💧)槽**右下→右上**(现挡名字)；战力槽**中下→中上**(现与名字重合)。建议 PlayingCard 加 `cost`/`power` 具名槽(固定角位) + `selectedMark` 中央标。
> ⑤ **PlayingCard / Card `hover` 简介 tooltip**：牌组扑克 + 天罡卡 鼠标悬浮显简介(宝物介绍)。建议复用 `Tooltip.bubble` 思路·给 PlayingCard/Card 加 `tip?:LayoutNode`(hover 浮窗)。
> PG 侧已把能数据做的做完(中英混排/多余框/3竖列/翻面乱码/字号 Label 部分/今日卦象/流派strip/去底部条)；以上 5 类待主程。

### REQ-UI-G流光底纹 · [2026-06-26] · PG 同步（UI 库域·主页质感对齐撞到） · status: **✅ done（主程·①layout.sheen ②PlayingCard.backPattern ③Panel.pattern·`sheen-pattern-bigtext.test.ts`）** · 类型: 真能力缺口（通用质感·不可重组）

> game-g 主页对齐原版「质感」时，3 个视觉能力引擎缺通用版（hero CTA 流光已有·bgScroll 滚动 UV 已有不在此列）：
> ① **通用流光 sheen**：原版多处（按钮/字）有 `ggl-sheen`（背景位移流光）。引擎只在 `Button kind:'hero'` 内置 apollo-sheen；Button(ghost/primary)/Label/Card/PlayingCard 都无。建议：加可选 `sheen?:boolean`（或 LayoutConstraints 级）→ 元素上叠 apollo-sheen 流光层。
> ② **PlayingCard 底纹/纹理**：原版红牌背 `.dback i` 是 repeating checkered 条纹格、白牌也有微纹。引擎 PlayingCard 底色纯色/渐变、无纹理（`bgTexture` 只在 Panel/Screen）。建议：PlayingCard 加 `backPattern`/`texture`（checkered/stripe 预设或贴图）。
> ③ **Panel.vignette 条纹叠层**：原版 `.vignette` = 径向柔光 + 45° `repeating-linear-gradient` 条纹；引擎 vignette 只画径向暗角。`bgTexture` 喂 SVG data-uri 不行（texLayer 过滤空格/括号/引号）。建议：vignette 补 45° 条纹选项，或 Panel 加 `pattern:'stripe'|'checker'` 程序化叠层。
> 三者均「质感 flourish」·非内容·但 owner 要求一模一样。PG 侧无法重组表达，待主程下沉。

### REQ-UI-Label大号字 · [2026-06-26] · PG 同步（UI 库域·主页比例对齐撞到） · status: **✅ done（主程·Label.size xxl=28/xxxl=34）** · 类型: 真能力缺口（档位不足）

> game-g 主页对齐原版比例时撞到：原版 felt 大标题 `.felt-h .t{font-size:34px}`（装饰字体 fd），但引擎 `LabelProps.size` 最大档 `xl=22px`（sizeMap xs10/sm11/md13/lg16/xl22）。22 < 34 → 标题偏小、整体比例缩水，达不到原版协调度。
> 建议（小加法）：Label.size 加 `xxl`(~28) / `display`(~34) 档（或新 `Heading` 控件带 fontDisplay）。供大厅命运牌桌标题、弹窗大标题等用。
> PG 现用 xl(22) 顶格近似。

### REQ-UI-Tabs每页签锚点 · [2026-06-26] · PG 同步（UI 库域·新手指导接线撞到） · status: **✅ done（主程 2026-06-26·`tabs[i].anchor` → nav 按钮 data-anchor·`tabs-anchor.test.ts`）** · 类型: 真能力缺口（不可重组）

> game-g 新手指导 coachmark 接线时撞到：Tabs 控件渲染自己的页签按钮，game 层无法给**单个页签按钮**加 `data-anchor`（layout.anchor 只能加在整个 Tabs 节点上）。导致引导步②(导航「我的牌组」)、④(牌组子页签「天罡战法」)、⑥(导航「大厅」)**能推进但无法高亮**那颗页签按钮。
> 现状规避：这 3 步靠 action 信号推进（nav/deckTab Tabs 都带 action），引导流程完整不卡；只是缺高亮气泡。
> 建议（小加法）：`TabsProps.tabs[i].anchor?: string` → renderTabs 给对应 nav 按钮渲 `data-anchor`。即可让 OnboardingOverlay spotlight 到具体页签。

### REQ-STEAM · [2026-06-25] · 本 session 认领（平台轨·Steam 发行） · status: **in-progress（owner 指派·独立轨）** · 类型: 平台服务（非游戏数据）

> **owner（junbai.li）2026-06-25 拍板：Steam 发行作为独立平台轨，由本 session 接管全部事项。** 工作清单见 `finish/PS-steam-finish-list.md`。
>
> **车道**：落点 `electron/`（壳内 steamworks.js 绑定）+ `src/services/platform/`（`SteamworksPlatformPort` 实体）+ `src/services/storage/`（Steam Cloud）+ `scripts/`（depot/上传）。**`PlatformPort` 接口契约不改**（已稳定），只加适配器实体；web/dev 仍走 `NullPlatformPort`。
>
> **与 PG/Lead 边界**：PG（game-g）只消费 PlatformPort，不碰 SDK/壳/管线；服务层原属 Lead 域，经 owner 指派由本 session 实现，登记周知避免撞车。
>
> **选型（已定）**：Electron（沿用，不引入 Tauri）+ steamworks.js（仅壳内）。测试用 480(SpaceWar) appid，待 owner 提供真 appid（$100 入门费）替换。
>
> **阶段**：P0 依赖+init 自检 → P1 成就/统计 → P2 云存档 → P3 富状态/排行榜 → P4 depot/上传管线。联机(Steam Networking)依赖 REQ-010 浮点→定点，殿后。

### REQ-UI-Gemini评审 · [2026-06-26] · Lead 评审（UI 库域·外部 Gemini code review 收敛） · status: **部分 done（C2/C3 已实现）· 余回驳/记录** · 类型: 架构评审收敛

> 外部 Gemini review 7 条，Lead 以宣言尺子收敛：✅ **C2**(样式注入硬化·`num()`+anim 白名单·XSS 测) + **C3**(焦点丢失·`patchFocusedInput` 就地覆写不重建) 已实现。🟡 **A2**(bind fast-path) 记录待用例。❌ 回驳 **A1**(弃 CSS flex 改 JS 绝对定位=倒退)、**A3**(FSM 承载手势·时序态已在解释器·YAGNI)、**C1**(拆判别联合类型·毁数据契约)、**C4**(actionArg Record·现做法更干净)。详情见 git。

### REQ-UI-数字补间 / 富文本 · [2026-06-23] · Lead 登记（UI 库域） · status: **✅ done（owner 2026-06-25「都做完不要等·早晚需求」·下沉为 Label.tween / Label.spans）** · 类型: 真能力缺口下沉（manifesto 尺子已过）

> `LabelProps.tween:{from,to,ms?,decimals?}`（数字滚动·easeOutCubic·render-only）+ `LabelProps.spans:[{text,color?,bold?}]`（多段着色）。折进 Label 不新建控件。验收 `label-tween-spans.test.ts`。3D/SVG/hex/WorldFollower 回驳（见迁移指南 §4）。详情见 git。

### REQ-UI-3缺口（变换/动画/拖放） · [2026-06-23] · Lead 主导（UI 库域·跨游戏重构前置） · status: **✅ done（声明式下沉·game-i 同提交）** · 类型: 真能力缺口下沉（manifesto §4 评审通过）

> 三游戏(E/F/G)数据驱动 UI 重构缺口收敛到 3 个声明式字段并下沉(`src/ui/components`)：`LayoutConstraints.rotate/scale`(CSS transform·扇形手牌)、`anim/animMs/animDelay`(具名入场关键帧·发牌)、`draggable/dropZone`(HTML5 拖放·放牌落子)。验证 `dnd-transform-anim.test.ts` + game-i 第5页。② 回驳归 renderer/世界层(浮动血条/逐帧精灵/hex/SVG斜梯/命令式计分时间轴)；③ 假缺口(多选≤N/牌面渲染=重组)。详情见 git。

### BUG-G-掌机黑屏 · [2026-06-22] · owner→甲（cartridge/战斗屏域·owner 直派 bug 修） · status: **🟡 已修（zoom·`c5608bbc`）· 待真机烧版验证** · 类型: 弱 GPU 渲染回归

> owner 报新烧 cartridge 包「APOLLO OS 绿字开机条 + 黑屏」、同代码 Mac 正常。掌机 = `build:cartridge`（`dist-cartridge`·base `./`·直挂 game-g 无 launcher）·弱 GPU webview。
> **穷尽定位**：非 JS 崩溃——cartridge 真产物无头(happy-dom)挂 game-g 零报错·大厅/战斗 DOM 全渲(605KB)·tsc/vitest1664/build:cartridge 全绿 → 弱 GPU 合成失败。
> **根因**：闪烁修(`7634b027`)把战斗屏首帧烤成 transform:scale 单合成图层·弱 GPU 合成整屏图层失败→黑（旧两段绘制 CPU 先画可见帧＝"闪烁"）。
> **修(`c5608bbc`)**：战斗屏 1340×858 适配 transform:scale → **CSS zoom**（CPU 布局缩放·不合成图层·消闪烁·Mac 等价·zoom 不支持也只裁切不黑＝fail-safe）。
> **待 owner 真机验**。若仍黑次候选：① `cartridge-entry.ts` 整屏 `#game-root` opacity 渐变；② 战斗浮层 backdrop-filter。详见 `SESSION-HANDOFF.md §0`。

### REQ-G-退役旧战斗核 · [2026-06-22] · owner→game-g 甲（combat 域 · 主程评审登记） · status: **✅ done（甲·5 步全清·单一真相·`8c6c2751`/`a0970248`/`d91221a3`）** · 类型: 技术债清理（双核/双屏并存 → 单一真相）

> doc24 实时→回合制大转向后双核/双屏并存。甲 5 步全清：抽共享类型切断 `turn-combat→live-combat` 依赖 → 删旧出征路 `showMatch()` + live 胶水 → 删 `live-combat.ts` → 删旧 `battle-screen*`(乙协同) → 唯一真相 `turn-combat`+`turn-battle-screen`+`clash-resolve`。turnHash 不漂移·门禁全绿。详情见 git。

### REQ-ARCH-MENU-DSL · [2026-06-21] · 框架级（PG-乙 转呈 · owner 拍板「提主程评」）· status: **✅ 主程裁决 2026-06-26：B 方案能力已就绪（LayoutNode + ActionSink 信号绑定·本 session 落地）·见下「主程裁决」** · 类型: 通用能力（已下沉·非单游戏 DSL）

> **缘起**：owner review `lobby-screen.ts` 的 `onClick` —— 一条 ~60 分支的 `else if (act === 'x') { … }` 链，质疑「为什么不用一张表映射、而写条件跳转代码？以后想数据驱动改写还容易吗？真要这样应让引擎提供能力去填数据」。乙作架构评审，结论转呈主程。

**乙的判定（带理由，供主程决策）：**

1. **现状定性**：这段在 `src/games/game-g/lobby-screen.ts` 的**菜单胶水层**，非数据驱动战斗引擎。宣言最咬人处是**战斗**（确定性/公平/可回放）；菜单 chrome 性质不同。但 owner 直觉对——这是「逻辑跳转代码」。

2. **必须分清两种改法（价值天差地别）：**
   - **A. 分发表（闭包 `Record<string,(k)=>void>`）**：纯**可读性**重构。⚠️ **不是数据驱动**——值是函数、仍是代码，过不了宣言尺子「最弱 LLM 能产出一模一样的数据吗？」。把 else-if 换成闭包表就自称数据驱动 = 自欺。
   - **B. 声明式菜单 / 动作绑定 DSL**：菜单结构 + 动作都变**数据**，由引擎一台通用解释器消费。**这才是真数据驱动**（owner 说的「引擎提供能力填数据」），但是**大工程 · 属主程域**。

3. **YAGNI 警告（乙的回驳意见）**：为**单个游戏的大厅**造一套菜单 DSL 引擎，是过度设计风险区（参照 REQ-F 商店「避模板化 DSL 腐烂」的前车之鉴）。菜单里**大半动作已半数据化**（`setTab(k)`/`setSub(k)`/`pickCard(k)` 都拿 `data-k` 泛型处理），真正「一支独立逻辑」的没那么多。**只有当多个游戏都需要数据定义菜单时，这个通用能力才划算**——否则建议 rule-of-three 未到、暂不造。

**请主程裁决**：
- (a) 是否值得在引擎出「声明式 UI 节点 + 动作绑定」通用能力（类似 GameShell 的延伸）？还是判 YAGNI、暂挂？
- (b) 若暂不上 DSL：菜单 chrome 是否就**接受为表现层胶水**（数据驱动火力集中战斗），乙是否可自行做 A（闭包分发表）只为可读性——明确它**不算**数据驱动达标？
- owner 已选「提主程 REQ-ARCH」路径（未选「现在就重构」/「维持现状」），故乙不擅自动 onClick，等主程结论。

**主程裁决（2026-06-26）**：
- **B 方案已落地**——owner 要的「引擎提供能力去填数据」就是本 session 建成的三件套：① 菜单结构=数据(`LayoutNode` 树)；② 动作绑定=数据(`Button.action` 信号名 → `mountUI` ActionSink → `enqueueAction` → InputQueue → `keybind` → `Signal{name,arg}` → sim 能力消费)；③ 纯表现交互(切页/开关弹窗/悬浮)=`mountUI` 内建·零游戏代码。那条 ~60 分支 else-if 就此化成「数据(action 名) + sim 能力(信号消费者) + 引擎内建表现」。
- **但不是「为单游戏大厅造菜单 DSL」**——乙的 YAGNI 警告对。落地的是**通用 UI 库 + 信号总线**，服务所有游戏（game-g/game-i 在用 + 铁律强制全游戏 → rule-of-three 已过），非 bespoke 菜单引擎。
- **A（闭包分发表）回驳**：值是函数=仍代码、过不了尺子（乙判定正确）。别做 A，直接迁信号路。
- **残留**=PG 把 `lobby-screen.ts` onClick 迁到 LayoutNode `action` 信号 + sim 能力（game-g 数据驱动重写·PG 域·现已解锁；game-g 当前仍传 HandlerMap，是非破坏并存的过渡，删一个 handler 即落到信号）。

### REQ-LAUNCHER-EXIT · [2026-06-21] · program G 乙（owner→乙·实属 launcher 域·转交主程）· status: **✅ done（主程·launcher 部分）：返回收进齿轮菜单 `GameOverlayMenu` + `mount(el,{exit})` 退出钩子契约（game-g 经 {exit} 自接·故不为它叠返回钮）。game-g 设置菜单接退出项=乙** · 类型: 启动器 UX + 退出钩子

> owner 2026-06-21（playtest game-g）：「右上角那个『返回主界面/返回卡带』——返回整个大游戏卡带界面的那个统一返回钮——不要摆在那，应该收进游戏自己的设置菜单里当『退出』。」
>
> **定性**：那是 **`src/launcher.tsx` 的统一返回钮**（所有游戏共用·launcher chrome），不属任何单个游戏 → **不是 game-g 能从自己代码里搬的**。乙不越界动 launcher。请主程/launcher-owner：
> 1. **把统一「返回主菜单/卡带」从悬浮角落收起**（或保留但弱化），UX 上不再常驻挡在游戏画面上。
> 2. **给游戏暴露一个退出钩子**：`mount(container, { onExit?: () => void })` 之类（或全局事件 `dispatchEvent('game-exit')`），让游戏能在**自己的设置菜单**里放一个「退出 → 返回卡带」按钮、调它卸载回 launcher。
> 3. 落地后**乙接线**：game-g 设置(⚙)菜单加「退出游戏（返回主菜单）」→ 调 onExit。
> **边界**：纯 launcher/shell UX + 一个回调契约·不碰游戏 sim。

---

### BUG-G-源泉徽标 · [2026-06-21] · owner→game-g 乙（甲代登记·勿越界）· status: **done（乙回滚·见下方 commit）** · 类型: 表现回滚

> owner playtest：战场源泉变成右上角水滴，要回旧版底部横条 water bar。乙 revert `3791fcde` 对 `turn-battle-screen.ts` 的源泉段(恢复 waterBar/waterCap/waterTube·删 fontBadge)。详情见 git。

---

### REQ-G-战场UI批次 · [2026-06-21] · owner→game-g 乙（甲代登记·战场屏 owner 授权乙动）· status: **open ⚠️ owner 二次催办（2026-06-21 playtest：1/3/6/9 仍看不到·请乙优先）** · 类型: 表现层一批（playtest 连发）

> ⚠️ **owner 2026-06-21 二次反馈**：这版仍**看不到敌方源泉数(1)、双方牌库剩余(3)、Boss 3 张地煞+悬停说明(6)**；开销角标(2)是个 `★N` 数字**挡住了牌面字**、且没画成水滴；买不起的牌没暗掉也没提示(9)。owner 明确**仍归乙**做（甲问过是否接手·owner 选乙）。**数据全就绪**，请乙优先收这几条。
>
> owner 2026-06-21 playtest 连发的一批**战场屏(`turn-battle-screen.ts`)表现需求**，归乙。带 🔗 的依赖甲的战斗逻辑钩子（甲并行做，落地后乙接数据）：
>
> 1. **敌方源泉数**：右上角（蓝条已乙回滚✓）显示**敌方(AI)的源泉数量**。
> 2. **每张牌开销=源泉滴数**（⚠️owner 二次催·现有 `★N` 数字**挡住了牌面字**）：把 cost 画成 **N 颗小水滴**（1/2/3 滴·0 不画），**位置别盖住牌面 rank/名字**。✅ 数据已就绪：放牌按 rank 收 0/1/2/3·`PokerCard.cost` 已上卡 + `buildTurnBattleView` 已读 `c.cost`（costPill 在 `turn-battle-screen.ts` handCard·gang 牌用 CAST_COST 同理）。**乙把 `★N` 角标换成水滴图标 + 挪到不挡字的位置即可。**
> 3. **双方牌库剩余**（⚠️owner 二次催·敌我都要）：显示**我方 + 敌方**牌库还剩多少张可抽（读 `tb.a.pokerDeck.length` / `tb.b.pokerDeck.length`·天罡库同理）。
> 4. **结束回合钮**移到**右下角·牌组最右·正方形显眼**位。⚠️ 同步：① `data-anchor="combat-end"` 跟着移（甲 battle-coach 锚点名不变·乙只搬 DOM 位置）；② 新手引导该步高亮会自动跟到新位置。
> 5. **动画**：弃牌→返回牌堆动画；战胜的牌→光荣回牌库动画；源泉**流入蓝条**动画。🔗 依赖甲：弃牌回库 + 战胜牌回库 + 源泉返还的**状态钩子**（甲在 turn-combat/驱动里产出，乙播特效）。
> 6. **敌方头像/地煞**：头像下挂**3 张地煞牌**·标「用没用/效果」；**鼠标悬停头像即显**（不用点）Boss 名 / 地煞详情 / 牌组剩余。
> 7. **敌我配色更分明**（owner 嫌现在不明显·乙 已做边框/水印可在此调色）：**我方=红框 + 略红的红底**；**敌方=黑框 + 灰底**。
> 8. **掷命骰** · 甲做 · status: **🅿️ 备案注销·搁置（owner 2026-06-21：「这个备案先注销注释掉·没想通这个表现·先做战力来源清晰」）**
>    - **旧方案(10颗d10浮层)owner 否决 → 已回退**。否决理由：① 全屏浮层**盖住了原战力明细特写**；② 骰子**反推安排**（`sum` 对齐既定 aWins）→「明显不是随机·太假」。已删 `dice-roll.ts` + `clashDiceRoll`，`playPerf` 回退原特写。
>    - **两颗 d6 加胜率新方案 = 搁置**（owner 2026-06-21 当面：表现没想通、觉得"不够高级" → **先注销/注释这个备案**，结算公式不动）。**改为先做「战力来源清晰」**（见本批 #10 + 已落地：clash 特写补 封顶/擎天对齐行 + 额外效果区）。掷骰子表现晚点再议。
> 9. **源泉不够的牌：暗掉 + 提示**（⚠️owner 二次催）：手牌里**当前源泉买不起的牌**（`card.cost > tb.a.mana`）→ **置灰/降透明·不可选**（别让玩家白点）；玩家若点了 → 浮提示「**源泉不足**」。数据已就绪（`buildTurnBattleView` 有 `b.a.mana` + 每张 `c.cost`）：给 `TurnHandCardView` 加个 `affordable` 标 + 不可选样式即可。
> 10. 🔗 **选牌看加成来源**（owner 2026-06-21 复提·"上次实现的"）：在战场选一张战区牌/手牌时，浮层要显示这张牌**加成的来源拆解**——来自哪些**天罡**(锋矢/虎符/寡兵/同花魁…逐项)、来自哪些**附魔**。
>    - 乙调研结论（如实报告 owner）：当前 `cardTip` 只拿到 `u.buff` 一个**聚合数**（=经营/养成·**含附魔但已按牌组均势摊平**），战斗里 `myBias` 用的是**牌组平均 favor**、不是单张牌自带附魔；天罡/士气加成是**对决时**经 `effPowerBreak` 现算（返回 `{pEff,shift,tg}`，**tg 只是个总数·无逐项标签**）。
>    - 所以「单张牌的附魔来源」诚实地**给不出**（combat 不按张携带附魔）；要做到 owner 想要的逐项来源，需 **甲** 把 `effPowerBreak` 改成**返回带标签的逐项拆解**（如 clash `bonusMine: [label,val][]` 那样·但按 unit），并把它**喂进 slot/hand view**（非对决态也算）。
>    - 乙可接的诚实版（落地后）：浮层显示「天罡(法术)逐项 + 养成(全局·含附魔均势·标注非单张)」；**附魔逐张**则需甲先改 combat 为**按张携带 favor/附魔**（即 #5 的"重写战斗模型"·owner 之前 AskUserQuestion 选了"Something else"·实属本条·待 owner 在"诚实全局版 vs 甲重写按张版"间拍板）。
>    - **进展（2026-06-21）**：**对决特写**侧的来源清晰已基本到位 —— ① 甲打通牌库后每张牌按 rank+suit 带自己 favor/附魔进战斗；② 另 session 补「经营·改造/附魔」**逐生肖**标注；③ 甲补**封顶30 / 擎天倍率对齐行**（明细恰好加到 ＝战力）+ **额外效果区**（平局裁定 / 战胜硬币人头留场·人面回库）。**仍缺**：非对决态（选**手牌/战区牌**悬浮）的逐项来源 —— 需 `effPowerBreak` 返回带标签逐项 + 喂 slot/hand view（甲域）。
>    - **★ owner 2026-06-21 再强调（非常重要）**：「对战时数据来源要清晰·我需要知道打的时候你加的那些东西来自哪里」。→ 对决态已落地（见进展③）。
>    - **✅ owner 2026-06-21 拍板「对决特写这版就够」**：非对决态（平时悬浮看牌）逐项来源**暂不做**（done-covered by 对决态明细）。本条 #10 结案——如后续要悬浮版再开新条（届时 combat 已按张携带 favor/附魔·阻塞已解·可直接做）。
>
> 甲并行做对应**战斗逻辑**（弃牌返源泉+不互斥 / 战胜牌回库+返还 / 放置不可重叠 / 回合流程改同步推进 / **#8 effPowerBreak 逐项标签拆解**），落地后给乙数据/钩子；乙只管战场屏表现。

---

### REQ-G-战斗逻辑批次 · [2026-06-21] · owner→甲（playtest 连发·战斗模型/AI/平衡·乙代登记） · status: **#2/#3/#6 done（owner 派单他 session·混合方案·全套门禁绿）；#4 转交策划；#1 暂缓待 owner 数据；#5 甲 active** · 类型: 战斗逻辑（非表现·甲域）
> owner 2026-06-21 深度 playtest 连发的一批**战斗逻辑/AI/平衡**需求——均属甲（turn-combat / 战斗驱动 / 平衡），乙代登记。乙只在甲落地钩子后接「表现」（全屏通知/fx）。
> **owner 2026-06-21 分工调整（多轮）**：#4 牌力概率反算 → **转交策划**；#1 敌方牌库镜像 → **暂缓**（owner 数据将出·出后甲直接接数据更新建库）；**甲当前只做 #5 敌回合逐步演出钩子**。
>
> **✅ #2/#3/#6 落地（owner 2026-06-21 直接派单·选「混合」+「先做功能·平衡后续单独调」）**：
> - **数据/能力（disha.ts）**：`DISHA_NAME`(id→招牌名) + `DISHA_PLAYABLE`(可施放集) + `splitDisha(ids)→{passive,playable}`。**混合判据**：「打出→整场持续加成」型转可打牌（斯巴达方阵/死战不退/伙伴骑兵/长枪方阵/连环船/挟天子/近卫军/破釜沉舟/霸王之勇/九战九捷，10 张）；**开局/定时/经济/地形结构型留 Boss 被动**（温泉关死守 homeHp/大军压境·机动调度 +源泉/大炮兵定时/锤砧地形夹击，5 张）。每关 ≥1 可施放（含关1：方阵+死战不退）。
> - **#2 地煞可打 cost2（turn-combat.ts）**：新 `DishaHandCard{kind:'disha'}` + `DISHA_COST=2` + `castDisha()`（打出→该 fx 并入 `dishaB` 整场生效·与天罡共用 cast 互斥锁）；init `splitDisha`：被动聚合进 dishaB、可施放进 Boss 起手手牌。
> - **#3 AI 用地煞**：`aiTakeTurn` 加 `scoreDisha`（攒够 2 源泉 + 场上有兵才高分·空场不急）→ Boss 择机打出；`aiTakeTurn` 现**返回打出的地煞 id 列表**（caller 据此通知）。
> - **#6 全屏通知（game-g.tsx·乙表现）**：AI 回合拿 `usedDisha` → 逐张 `showBanner('敌人使用地煞 · XX', 1500)`（串行·复用现成 banner）+ 战斗日志记。
> - **门禁**：tsc 0 · vitest 1703 全绿（disha.test 改 4 例对齐混合模型 + 加 1 例验可施放路+AI 用 → 12 例）· build 0。
> - **⚠️ 留给后续（#4 一并）**：可施放地煞改成「打出才生效」后，关1-5 现有平衡（原按地煞全程常驻标定）会偏弱 → 归 #4 概率反算重标定，**本次未动 sim**（owner 拍板：先做功能）。

1. ⏸ **[暂缓·owner 2026-06-21：数据将出·出后甲直接更新]** **敌方牌库张数错**：现在敌方牌库 **61 张**；按设定应**镜像玩家**——敌也带自己的 **16 张出战牌库 + 3 张地煞 = 19 张**。改敌方建库（现 `b = prepareArmies(...)` 的全 army → 折成 16 picks + 3 地煞·与玩家对称）。等 owner 推出 16+3 数据后接上即可。
2. 🔀 **[转交他人·owner 2026-06-21·不在甲单子]** **地煞=可打的牌·开销 2 源泉**：3 张地煞进敌方牌库/手牌，作为**可施放牌**，cost=2 召唤源泉（不再只是堡垒上的明牌摆设）。
3. 🔀 **[转交他人·owner 2026-06-21·不在甲单子]** **敌 AI 用地煞**：AI 按**情势 + 开销**判断**合理使用地煞**（攒够 2 源泉 + 局势需要时打出·非乱放）。复用/扩 `aiTakeTurn` 评分。
4. 🔀 **[转交策划·owner 2026-06-21·不在甲单子]** **敌方牌力按概率反算增强**：若某关敌方**胜率不足**就给敌方**初始 16 张里部分牌加地支附魔**抬牌力（按需反算强度）。= 关卡难度旋钮·**策划调数据**。
5. ▶ **[甲 active·owner「你看一下怎么做」]** **敌方回合结束=逐个/同步演出**：敌回合结束时，**行动 + 战斗逐个（或同步）演出**——牌移动→遭遇→掷命，让玩家看清过程（非瞬间结算）。甲产出**逐步状态钩子**（每步 move/clash 事件），乙接着播 fx/动画。🔗
6. 🔀 **[转交他人·owner 2026-06-21·不在甲单子]** **敌用地煞 → 全屏通知**（表现）：敌方打出地煞牌时，给**全屏通知**「敌人使用了地煞·XX」让玩家知道。🔗 依赖 #2/#3 的「敌方 cast 地煞」事件钩子。
7. ✅ **[BUG·已修·甲 2026-06-21·乙搜定根因]** **死战不退(lastStand)主将退格 → slot 碰撞 → 后方兵被画面吃掉**（playtest 报「我胜了但敌人没消失·它后面那格的人消失了·黑桃3 没消失」）：
   - 根因位置：`turn-combat.ts` `resolveClash` ~L339-341。我胜 + 敌前锋是**主将** + `dishaB.lastStandGeneral`（关1 地煞·首负不亡）+ 未用过 → 主将不死、`q.shift()` 后 `u.slot = min(SLOTS-1, u.slot+1)` 再 `push + sort`，**没检查 slot+1 是否已被身后兵占用** → 两兵同 slot。
   - 后果：`turn-battle-screen.ts buildTurnBattleView` 的 `bySlot.set(u.slot, …)`（~L562-563）**同 slot 后写覆盖** → 后方那张牌从棋盘消失；败北主将（黑桃3）反留场 → 玩家看到「赢了敌人没消失·它后面的人消失了」。
   - **甲修（终版·级联后挤 + 全屏通知 + 特写正名）**：① 退格改**整列后挤填空**（非换位）——主将退 1 格**仍居本列最前**，避免换位让主将"看着退了两格"（owner 复报「依然在场上·后退了两格」根因=换位 leapfrog）；后方全满到 Boss 家则原地残喘；确定无 RNG·一格一兵。② **全屏通知**（owner 2026-06-21「死战不退激活需要全屏通知」）：`ClashEvent.lastStand` 标记 → 驱动 `showBanner('🛡 死战不退·敌主将首负不亡')`。③ **特写正名**：败者死战不退 → 显「🛡 死战不退·退守」金标，替误导的「反面·阵亡」。回归测试 `disha.test BUG#7`：a0@4/b0@5主将/b1@6 → 胜后断言无同 slot + 主将仍最前(b0.slot<b1.slot) + lastClash.lastStand。gate 全绿(1710)。

---

### REQ-G-卦象结算加减 · [2026-06-21] · owner→甲（Game G·结算逻辑） · status: **✅ done（甲·`settleTurn` 战利品按今日卦象±·确定性·大吉+2…大凶−2·夹≥0）** · 类型: 战斗逻辑（结算期·甲域）
> 一局结算按今日卦象 ±战利品(大吉+2…大凶−2·夹≥0)·确定性进 hash·`settleTurn`。详情见 git。
### REQ-ARCH-SAVE · [2026-06-21] · program G 乙（owner 2026-06-21 钦定 · 存档持久化 + 云存档服务）· 框架级 · status: **open** · 优先级: 中 · 类型: 真缺口（持久化/同步=易错基础设施·过弱-LLM 尺子·≥多游戏拉动）

> owner 2026-06-21：「开一个 REQ 给主程——游戏的存档任务 + 云服务存储任务。」「开了本地一个 Save 目录，打完包以后也有地方可以存。」

**现状（game-g 自证缺口）**：game-g 自己手搓存档——`game-g.tsx` 里 `SAVE_KEY='gameG-save-v1'` + `localStorage.setItem(key, JSON.stringify(save))` / `loadSave()` 手写迁移清洗；音效/BGM 另用 `gg_sfx_muted`/`gg_bgm_*` 散键。**问题**：① 每个游戏各自重造 save/load/迁移/序列化（重复、易错——版本迁移、并发写、损坏兜底是典型弱-LLM 写不稳的代码）；② 只 localStorage = 单设备单浏览器，清缓存即丢、无跨端、无账号、打包成桌面/原生后**没有统一的落盘位置**；③ 明文可改、无校验。**按宣言尺子**：存档持久化 + 云同步 = 确定性接口能表达的**通用基础设施**，不该住游戏层 → 下沉成引擎/服务能力。

**请主程实现（两部分·可分批）：**

**① `SavePort`（本地存档抽象·先做·解 owner「本地 Save 目录」）**
- 统一存档服务：游戏只**声明 schema + 调 save/load**（数据接口·弱-LLM 可填），后端可换：web=localStorage/IndexedDB · 打包桌面(Electron/Tauri)=应用数据目录的存档文件 · 原生=平台沙盒。**同一份游戏代码、换后端不改游戏**。
- 内建：`schemaVersion` + **声明式迁移链**（v1→v2→…·每步纯函数·游戏给迁移表数据，引擎跑）、损坏/缺字段 fail-safe 回默认、原子写（防写一半损坏）、多槽位（multi-slot/多周目）。
- 命名空间：每游戏一个 namespace（`game-g` 下含 save + 设置如 sfx/bgm·收敛散键）。
- **确定性/可测**：save→load 往返等值；迁移链 headless 断言（旧档→新档→hash 一致·= REQ-ARCH-COACH 的 seen 往返同纪律）；后端用可注入的 storage adapter（test 给内存实现）。

**② `CloudSavePort`（云存档服务·后做·解「云服务存储」）**
- 账号/登录 → 服务器存档为真相、本地为缓存（offline-first：本地先写、联网同步）。
- 冲突解决：版本号/时间戳 last-write-wins 起步，预留 merge 钩子；跨设备拉取、防丢。
- 与 ① 同一 `SavePort` 接口，云只是又一后端（游戏侧零改·只在有账号时透明启用）。
- 需后端/鉴权——**这块要 owner 定服务形态**（自建/BaaS/厂商），可能独立于纯前端引擎，建议 ② 待 ① 落地 + owner 定后端再排。

**边界/纪律**：纯持久化+同步基础设施·**不进 sim hash、不回灌 gameplay**（存档是 IO 边缘·同 audio port 先例）；游戏侧仍是「声明数据 + 调接口」，零手写序列化/迁移/网络。**验收**：① save/load 往返 + 迁移链 + 多后端 adapter（含打包后落盘）headless 断言；② 云同步离线→上线一致性 + 冲突用例。
**乙侧接线（落地后）**：game-g 把现有 `loadSave/persist/freshSave` + 散落设置键迁到 `SavePort`（一次性·零功能回归）。

---

### REQ-ARCH-COACH · [2026-06-21] · design G（owner 2026-06-21 钦定 · 引擎通用新手引导）· 框架级 · status: **done（表现层·Lead `ac64e1c1`·design G 验收 PASS 2026-06-21）** · 优先级: 中 · 类型: 真缺口（仅表现层）+ 重组（逻辑层·无需引擎）

> 新手引导 = 数据表(步骤/锚点/文案)，引擎固定 coachmark 渲染器解释。✅ Lead 落表现层最小包(`ac64e1c1`)：`Coachmark` render-only 组件 + `renderer/coachmark.ts`(纯·7测) + `ui/onboarding-overlay.ts`(DOM·覆盖两套UI) + GameShell `UINode.anchor`(`data-anchor`)。逻辑层(首次/步骤/seen/点对)=游戏侧重组(flow+flag+save)，不提需求。完整案 `docs/design/onboarding-coachmark-capability.md` + 清单 `game-g/design/DEV-CHECKLIST-onboarding.md`。详情见 git。


### REQ-E-023 · [2026-06-18] · PE（Game E 小丑牌 · 牌库扩展总纲）· 框架级 · status: **⑥ 仅余 open（①②③⑤ done · ④ wontfix）** · 类型: 多个真缺口（逐项独立）

> 目标：可玩小丑 31 → 趋近 150（catalog 150 已全）。六能力拆分，详见 `docs/game-design/game-e-joker-rollout.md` + git 历史。
> **进度**：① countOf（按 Tag 掩码数实体）**done** · ② 确定性概率 roll（chancePass）**done** · ③ 留手牌结算 pass（HeldHand）**done** · ④ 自增长 **wontfix/重组**（Resource+Effect+valueFrom 覆盖·Counter 冗余）· ⑤ HandMods（four_fingers/shortcut/smeared）**done 部分** · ⑥ 跨实体复制/改牌 **defer(P3)**。
> **⑥ 仍 open（唯一未闭合）**：无干净最小切片（小丑排序/相邻、运行时改牌库 = 抗数据化），整包下沉=inner-platform，撞防臃肿红线。真要做按族逐个最小 REQ（先"只读复制"族需干净小丑排序接口；再"改牌库"族需运行时牌库变更的快照/确定性契约），各附弱-LLM 尺子证明，不一次性塞。①②③⑤已闭合不阻塞⑥。

---

### REQ-E-022 · [2026-06-18] · PE（Game E 小丑牌）· status: **done（引擎+接线 2026-06-18）** · 类型: 真缺口（poker-eval 缺 isFlush/isStraight 派生事实）

> `PokerHand.isStraightFlag?/isFlushFlag?` 派生事实（同 rankMaxCount 族）→ 解锁 Crazy/Droll/Devious/Crafty/The Order/The Tribe（可玩 25→31）。详情见 git。

---

### REQ-E-021 · [2026-06-18] · PE（Game E 小丑牌）· status: **done（引擎侧 2026-06-18）** · 类型: 真缺口（逐张计分读不到「牌自带的修正」）

> `Card.mods?:{op,target,value}[]` + `Card.retrigger?`（per-card 附魔/红蜡封）；card-scoring 逐张循环套用。架构裁决：不扩成通用 Buff 抽象（语境=循环本身·避 inner-platform）。详情见 git。

---

### REQ-F-065 · [2026-06-17] · 策划 PF（装备 atk·owner 钦定路A）· status: **done（引擎侧 2026-06-17）** · 类型: 真缺口（per-unit 异质缩放）

> `scaleByResource` 先查施法者本地资源再回退全局（补 `SpawnRequest/PrefabOrigin.source` 源 threading）→ 装备 atk 逐单位异质生效、退星级模板族爆炸。详情见 git。

---

### REQ-023 · [2026-06-09] · 主程4（Game F）· status: **wontfix（2026-06-15·重组覆盖）** · 类型: group-effect 集合写

> 羁绊光环可用 group-count→全局 buff 资源→各单位读 重组绕过；仅"各单位异质、全局值表达不了"才下沉（→ 后由 REQ-F-065 命中该留口）。详情见 git。

---

### REQ-F-061 · [2026-06-13] · 主策划（Game F）· status: **done（2026-06-13）** · 类型: 真缺口（hitbox 缺血量条件门+处决）

> `Hitbox.requireHpFracBelow?/requireHpFracAbove?/executeBelow?`（命中那刻读目标 hp 比例做 gate/斩杀·乘法比较保确定性·零迁移）。详情见 git。

---

### REQ-F-062 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open（Lead 打回细化，暂不实现——见评判）** · 优先级: 低-中 · 类型: 真缺口（aggro 索敌策略不可选，只能最近）

**标题**：aggro 索敌策略（最远 / 最高威胁 / 最低血，非只最近）

- **想实现**：刺客绕后锁后排、狙击锁最高威胁、嘲讽——玩家卡牌「绕后奇袭」+ 太阁 Boss 政宗/岛津。
- **卡在哪**：`src/skills/tier3/aggro.ts` 写死 `nearestByTag`；`Perception` 只有 targetTag/sightRadius，**无策略字段**，数据层无开关。
- **建议**：`Perception.policy?: 'nearest'|'farthest'|'highestStat'|'lowestHp'`（缺省 nearest，向后兼容）+ spatial-query 加对应变体（沿用 id tie-break 保确定性）。不改语义、不动定序。
- **Lead 评判（打回细化，暂不实现）**：① 核心 policy enum（nearest/farthest/lowestHp）确是真缺口（`aggro.ts` 写死 nearest、`Perception` 无策略字段）；但 ② **「嘲讽」不属本能力**——嘲讽是**目标侧**强制他人改指向，`Perception.policy`（攻击者侧）实现不了张飞嘲讽，混入是误判，须另案（目标侧机制）；③ **「最高威胁 highestStat」欠定义**——项目无"威胁"Resource，缺 stat 来源字段；④ **未被真实数据拉动**——关羽斩杀/张飞嘲讽仅在设计稿 HTML，实装数据零引用。按「不为想象需求拓宽引擎」（REQ-023 同纪律）**暂不实现**；待真实单位钉死具体策略需求，再落 nearest/farthest/lowestHp（嘲讽另案）。

---

### LEAD→PF · [2026-06-14] · Game F · status: **⏸ 大部 done·余暂挂（game-f 暂停开发）** · 类型: 去腐交办（game-f 程序→数据）

> game-f 曾是"在数据里编程"(2658 行·生成器 56 处·脉冲标记 114)。去腐进度：
> - ✅ 脉冲清零(114→0)、band/visSwap/chrome 展平(byte 等价)、商店卡/名牌从 ROSTER 派生。
> - ⛔ makeRoundFlow/templatesFor 字面化 **回驳**(薄确定性展开器·"数据驱动≠零函数")；脉冲下沉成引擎能力 **回驳**(单游戏臃肿勿注入共享引擎)。
> - ⛔ ②「game-f.tsx→完整 GameShell」**owner-overridden 暂挂**(撤 GameShell/canvas 并存·保留手写 DOM HUD)；`GAME_F_UI` 蓝本留作参考。Lead 已加通用 GameShell `image` 节点(非 game-f 下沉)。
> - 余 blueprint→manifest 全量展平(低优先)。game-f 暂停 → 整体搁置。详情见 git。

---

### REQ-F-064 · [2026-06-15] · game-f（Boss 技能）· status: **wontfix / done-covered（2026-06-15）** · 类型: 现有能力重组（非缺口）

> 信长全军 buff = group-count→dmg_scale→hitbox 读；秀吉援军 = Caster→prefab；真田自残血加伤 = Condition(自身 hp)→Effect→scaleByResource。三技能均现有能力可表达 → 回驳。详情见 git。

---

### LEAD→PG · [2026-06-18] · Game G · status: **open（可选迁移，game-g 自决）** · 类型: 通用能力已就绪 → 可选去腐

**能力已落 mainbranch（`f78ee97`）**：render-only **`Mesh3D`** 通用「3D 物件即数据」原语 —— `shape:box|plane` + 尺寸 + `frontTint/backTint/edgeTint` + `flipAxis`（翻面复用 `Transform.rotation`）。引擎通用 `ThreeRenderer` 即可把它渲成真盒/薄片、翻面、与 2D `Renderable` 同场混排；`frame-svg` 翻面感知正交投影（无头 golden）。纯表现、不进 sim/hash。

**可选交办（game-g 自决，不强制）**：`game-g/three-renderer.ts`（364 行）里**通用的那半**（Scene/相机/灯光/BoxGeometry/mesh 同步/相机自适配）可改为复用引擎 `Mesh3D`/`ThreeRenderer`——把牌**描述成 `Mesh3D` 数据**，删掉手写 Three.js 基建，趋近「游戏是数据」。**边界（务必守）**：game-g 的**牌面纹理（faceTexture/backTexture）+ 抛飞/相撞/逐路揭晓编排（pairKey/side/clash/marchScreenPos）= 你的私货 juice，留 game-g**，不下沉。即「通用几何/材质/翻面用引擎，专属皮与编排自己叠」。

**为何标可选**：现 `Card3D` 工作正常，迁移收益=减手写 Three.js（非 bug 修复）；且 Lead 不替 game-g 改游戏渲染（lane 红线）→ 由 program G 自评取舍。

---

### REQ-024 · [2026-06-21] · PA · Game A · status: open · 优先级: P2 · 类型: 真缺口（effect 无法驱动"已存在实体"的物理动作）

**标题**：`effect` 缺"施加冲量 / 注入动作" —— 协作里"A 命令 B 原地起跳 / 被弹射 / 被推一格"组合不出

- **想实现的游戏行为**：双人切换协作解谜中，A 对另一角色 B 下指令让 B 做出**物理动作**（原地起跳越缝、被机关弹射、被推一格）。蹲下/待命（`effect set-state`）、开火（`caster`→`prefab`+`launch` spawn 新弹体）都已能纯数据做；差的只是"让一个**已存在**的实体获得速度/冲量/动作"。
- **已经试了什么**：`keybind`(键→Signal) → `effect-apply`(targetEntity:B)。但 `effect.kind` 仅 set-flag/modify-resource/set-state/set-sensor/set-visible(-tagged)/destroy(-tagged)/reset-timer —— **无一能写 Velocity 或注入 Action**。`jump` 能力要 `Action{name:'jump'}`+`Grounded`，却没有"信号→给某实体挂 Action"的数据通路；`launch` 是自带组件的投射物机制、且 effect 不能"加组件"；`caster` 只能 spawn 新实体、不改 B。
- **卡在哪 / 缺什么**：信号无法对**已存在**实体施加速度/冲量/动作 → "命令 B 真起跳/被推/被弹"表达不了。（纯展示可用 set-state 换"跳跃姿势"顶替，但无真实位移。）
- **建议方案**：`effect` 增 kind **`apply-impulse`**（对 `targetEntity` 的 `Velocity` 叠加 `{vx?,vy?}`，可 valueFrom 资源）或 **`inject-action`**（给 `targetEntity` 挂 `Action{name,value}`，复用 jump 等既有消费者）。最小、与 jump/launch/velocity 链对齐；"信号→现有实体动起来"一通百通（命令 B、机关弹射、击退）。
- **优先级 P2**：协作"指令 B 物理动作"的通用前置；**不阻塞当前**（蹲下/待命/开火/单人切换都不需要它）。按"落地不口头"back up 入池。

---

### REQ-025 · [2026-06-25] · PA · 双人合作平台跳跃（上100层/冲100米）· status: open · 优先级: P1 · 类型: 真缺口（effect 无法改碰撞体 Shape + 命令模型无蹲下输入）

**标题**：缺"蹲下钻缝"能力 —— `effect` 写不了 `Shape`、命令模型没有蹲下输入

- **想实现的游戏行为**：双人闯关里角色**蹲下**缩小碰撞体，钻过低矮缝隙/在低天花板下通行（合作解谜常用：A 蹲下当矮台阶 / B 蹲身钻过 A 撑开的缝）。这是用户点名要的技能之一。
- **已经试了什么**：① 动画/姿势用 `set-state`→`AnimState` clip="crouch" 可做（纯表现，OK）。② 但要真正"钻低缝"必须**缩小碰撞箱高度**。全库只有 `gauge` 在运行时写 `Shape.width`（血条专用、按 Resource 比例、每帧覆写，不能复用）；`effect-apply` 的 `writes` 是 Flag/Resource/State/Sensor/Visibility/Destroy/Timer/RandomSeed —— **没有 `Shape`**；`Effect.kind` 也无写 Shape 的项。`Transform.scaleY` 能改但碰撞读 `Shape.height` 不读缩放（facing 正是靠这点：scaleX 不影响碰撞）→ 缩 sprite 不缩碰撞箱。③ 命令模型 `Command.move{dx,dy}+jump`（commands.ts）**没有蹲下输入**，KeyMap 也无。
- **卡在哪 / 缺什么**：没有"信号/状态 → 改某实体 `Shape.height`"的数据通路；也没有蹲下这个输入意图。
- **建议方案**：① `effect-apply` 增 `Effect.kind:'set-shape'`（写 `targetEntity` 的 `Shape.height/width/radius`，把 `Shape` 加进 effect-apply 的 writes）——与 `set-sensor` 同类、整数字段、确定性安全。蹲下即纯数据：蹲键→condition→ 两个 Effect（`set-state "crouch"` 给动画 + `set-shape height:15` 缩碰撞）；松开复原 height:30。② 命令模型/KeyMap 加"蹲下"意图（或约定 `dy:1`=蹲下，让数据逻辑读）。**一个注意点**：低天花板下松开蹲下会把人顶穿——只在头顶净空时才复原（用 sensor/overlap 条件判，纯数据可表达，非第二个引擎特性）。
- **优先级 P1**：上100层/冲100米的"蹲下"技能前置。**不阻塞主体**（爬塔用 boost 当协作核心；蹲下能力到位后再接）。按"落地不口头"back up 入池。

---

### REQ-026 · [2026-06-26] · PA · game-h 你造我塔/是男人就X层 · status: open · 优先级: P1(rope/spring) P2(conveyor/respawn) · 类型: 真缺口（想象力机关 = effect 写不了 Velocity/Transform、无双体约束）

**标题**：缺"会动的平台个性"与"双体绳索"——参考 NS-SHAFT(平台有个性) + Pico Park(身体当机关) 的灵魂机关当前组合不出

参考有想象力的纵向跳跃游戏后，最出彩的几样机关都卡在同一类引擎缺口（effect 只能改 flag/resource/state/sensor/visible/destroy/timer，**写不了 Velocity / Transform**；也无双实体约束）：

- **弹簧/起跳台（NS-SHAFT 之魂·P1）**：踩上去被弹得很高 → 跨越普通跳够不到的大缺口。需"接触/信号 → 给该实体 `Velocity.vy = -大值`"。建议 `effect.kind:'apply-impulse'`（写 Velocity，可叠加）或一个 `Spring` 组件（contact→给踩它的实体设 vy）。
- **传送带（P2）**：站上去被持续推向一侧。需"站立其上 → 每帧 `Velocity.vx += k`"。建议 `Conveyor{vx}` 组件（ground-sense 命中→加速）。
- **绳索/拴绳（Pico Park 之魂·P1）**：两名玩家被绳拴住——一个坠落另一个可拉住、可借绳荡过缺口、限制别走太散。需**双实体距离约束**（`Tether{a,b,maxLen}` + 一个约束求解 system，确定性）。这是双人游戏最大的想象力来源。
- **坠落重生/检查点（"是男人"紧张感·P2）**：掉出底部/碰危险 → 传回上一个检查点。需"信号 → 设某实体 `Transform.x/y`"（`effect.kind:'teleport'` 或 `Respawn{to}`）。配合"底部追命危险区"(zone→已可扣血)成立硬核基调。

**已试/为何组合不出**：召唤台(plate→set-sensor)、相位/踩碎(timer+set-sensor)、踩头借力(REQ-003)、危险扣血(zone→modify-resource) 都能纯数据做（game-h 已用召唤台做出"你造我塔"二重奏）；但上面四样都要"改 Velocity/Transform"或"双体约束"，现有 effect/组件表达不了。

**优先级**：rope + spring 先做（P1，立刻把 game-h 从"配合解谜"升级到"想象力满格"）；conveyor/respawn 次之（P2）。**不阻塞当前**（game-h 召唤二重奏版已可玩可测）。落地不口头入池。

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

### PG-乙→甲 · [2026-06-21] · Game G · status: **✅ done（并入 REQ-G-退役旧战斗核·`a0970248`/`8c6c2751`）** · 类型: 战斗段死代码清理

> game-g.tsx 旧实时血脉（showMatch/live-combat/battle-screen）+ Engine 血脉（buildGameGMatch）已随退役旧核全删。详情见 git。

---

### REQ-G-战斗结构 · [2026-06-21] · design G → 甲 · Game G · status: **✅ 核心已实现（战胜硬币 50/50 + 3D + 玩家亲掷/AI自动）；stayPMul/续航门 随天罡地煞重设计再落** · 类型: 真缺口（结构性）

> 掷命胜者「人头=留场续攻 / 人面=回牌库+返半费」(`resolveClash` 种子化硬币·`coin-flip.ts` CSS-3D)。调参钩子(stayPMul/续航门/CLASH_WIN_STAY_P)并入后续天罡/地煞重设计批次随平衡标定。完整契约 doc24 §4.2 + boss-config-1-5.md。详情见 git。

---

### REQ-G-诅咒地煞 · [2026-06-21] · design G → 甲 · Game G · status: **⏸ 暂缓（owner：诅咒先不做·关5 改用 bossFavorBias/bonusMana 杠杆）** · 优先级: P3（备案）

> Boss 被动「诅咒」(每 N 回合 bounce 玩家随机兵)：真缺口但与 `batteryEveryTurns` 同构、可加同类新 op。备案暂不实现。数据形 `{kind:'curse',op:'bounceUnit',everyTurns,mode,pick}`；接入清单见 `boss-config-1-5.md §七`。

---

### REQ-G-Boss牌面板 · [2026-06-21] · design G → 甲（战斗屏域） · Game G · status: open · 优先级: P2（明牌可破核心体验·非阻塞战斗逻辑） · 类型: 表现层（数据已在·纯渲染）

> **owner 2026-06-21**：「Boss 5 张天罡也要这样去抽和摸；我们应该能看到他的手牌和天罡牌，但现在没地方看。」+「在他地煞牌下面放一个微小的牌组，手点上去就放大看具体哪几张·是缩小 scale 过的小牌。」
> **评判（design G）**：纯**表现层**——数据全在（`TurnBattle.b`：`pokerDeck/tengangDeck/hand/castIds` + 关卡 16牌组+5天罡明牌）；**无引擎/数据缺口**，只差战斗屏渲染（甲地盘）。机制侧已对：Boss 天罡同玩家从 `tengangDeck` **抽/摸再打**（`drawCard('b','tengang')`→`castTengang`·花源泉·非免费）→ 面板只"看牌"不改机制。
> **派甲（doc24 §九 已补规范）**：① 顶部 Boss 牌面板：3 地煞（明牌·在途）**之下**放 scale 过的 **mini-deck**（16扑克+5天罡 loadout·明牌 counter-pick 靶）；② 点/悬停 **放大**成可读网格看清具体哪几张（小尺寸=设计·放大解决可读）；③ Boss **手牌+已打天罡可见**（数量+内容·明牌哲学）。乙不碰（战斗屏=甲）。
> **🌫 暗牌/迷雾态（owner 2026-06-21 追加·未来）**：面板留一个**隐藏态**——Boss 带 `fog`（迷雾）地煞时 mini-deck/手牌翻背面·不可放大（玩家看不清·AI 本有全信息）。**`fog` 已在 disha-pack 设计（关17+）**·不是新能力。**关1-5 全明牌不加 fog**（明牌可破=核心）；fog 留后期/Ascension。

---

### REQ-G-说明同步 · [2026-06-21] · design G → 乙（菜单/帮助屏域） · Game G · status: open · 优先级: P2（玩家可见·信息已过期） · 类型: 表现层（文案同步·数据已在 doc26）

> **owner 2026-06-21「更新下游戏说明」**。design G 已更新设计源 `doc26 玩法手册`；**但游戏内帮助中心文案是 `lobby-overlays.ts · helpBox` 写死的（乙域）·已过期** → 派乙照 doc26 同步：
> 1. **掷命对决**（helpBox 中级 L31）补 **🪙 战胜硬币（留场续攻）**：赢一场后抛币——**人面=留场乘胜追击 / 字面=回牌库+返半费**（你按钮亲掷·敌方自动·投掷后才揭晓）。
> 2. **❗事实错误（helpBox 高级 L48）**：「Boss 库=**12 随机天罡**+3 地煞」→ 改 **「16 扑克 + 5 天罡 + 3 地煞」（写死·与你 16+5 对称）**。
> 3. 补 **👁 Boss 牌面板**：战场顶部能看 Boss 的 3 地煞 + **5 天罡明牌 + 缩略牌组（点开放大看 16 兵牌）+ 手牌**（明牌可破=counter-pick 核心）；后期「迷雾」地煞会盖暗。
> 4. **放牌按点数收费**（中级 L30）可补一句：2-4 免费 / 5-7=1 / 8-10=2 / JQKA=3。
> **乙只改 helpBox 文案**（菜单屏域）；战斗屏面板本身=甲（`REQ-G-Boss牌面板`）。doc26 为准。

---

### REQ-G-地煞新op · [2026-06-21] · design G → 甲（引擎域） · Game G · status: open · 优先级: P2（丰富前10-20关·非阻塞） · 类型: 真缺口（4 个新 Boss disha op·下沉）

> owner 头脑风暴一批 Boss 被动 Buff。design G 评判：7 条里 4 条已覆盖（泉水翻倍=bonusMana / 城堡血=homeHp / 急行军=tempo advance / 隐形=fog），**3 条半是真缺口 → 下沉 4 个新 op**。完整规格见 `design/disha-op-vocab-v2.md §二`。
> **派甲（DishaFx 扩字段·确定性·仿现有 batteryEveryTurns/resolveClash 钩子·无新子系统）**：
> 1. `{kind:economy, op:withdrawRefundMul, value:1.5}` —— Boss 胜者回库返还花费 ×value（默认0.5）。改 `resolveClash` 回库行（仅 Boss 侧）。
> 2. `{kind:action, op:extraAction, value:1}` —— Boss 每回合多 1 类互斥动作（破四选一·**仅 Boss**）。`aiTakeTurn` 放宽 actionTaken 锁到 1+value 类。
> 3. `{kind:control, op:freeze, everyTurns:N}` —— 每 N 回合冻玩家本回合 1 类动作。仿 batteryEveryTurns。
> 4. `{kind:control, op:intimidate, everyTurns:N}` —— 每 N 回合吓退玩家某路前锋 1 张（退场/回库·b.rng 选·确定性）。**与暂缓的 REQ-G-诅咒地煞(bounce) 同族**·甲可一并参数化实现（mode: bounce回起点/库 vs intimidate吓退）。
> 落地后 design G 把这些织进关6-20 地煞组合 + sim 标定。当前 lore/disha 重写子代理用现有词汇·不阻塞。

---

### REQ-I-展示台升格 · [2026-06-25] · owner（火车上头脑风暴）→ Lead（引擎/展示台域）· Game I · status: **进行中（Lead）** · 类型: 方向 + 真需求若干 · 优先级: P2

> **owner 意图**：把 game-i 从「UI/声音测试场」**升格为「引擎底座能力展示台 / sample 画廊」**——每个底座能力一个 canonical 活样例，作为活文档 + 回归面 + 迁移参照；以后标准代码下沉到这层当 sample。页面**重组为 Hub + 模块**（落地点几个大模块入口：UI / 声音 / 输入 / 动画 / 渲染3D…，点进去出现该块）。
>
> **Lead 评判（CORE RULE）**：接受方向（强对纲领：样例即「这能力真能数据驱动」的证明）。逐项核底座现状——多数是**组合现有 capability**，非新写引擎：
> | 模块 | 底座现状 | 判定 |
> |---|---|---|
> | UI / 声音 | 已是数据样例（mountUI / Web Audio 胶水） | ✓ 已在 |
> | 输入 | `atoms/input-capture`(RawInput)、`atoms/action-map`、`components/input.ts`(KeyBinding/Action) | ✓ 组合现有 → **本轮已做** |
> | 精灵/帧动画 | `atoms/sprite`、`atoms/frame`、`tier1/tween`、`tier1/animation` | ✓ 组合现有（走 renderer 表面·非 mountUI） |
> | 寻路 | `tier2/grid-move`、`tier2/hex`（game-f 在用） | ✓ 组合现有（走 renderer 表面） |
> | 渲染 3D | `renderer/three-renderer`、`three-projection` | ✓ 已具备 |
> | 视频 | 仅 `services/aigp`(AI 生成端口)+`assets`(资源索引)，**无播放渲染能力** | **deferred（真需求·待触发）** |
>
> **纪律**：能力永远在引擎（确定性解释器），样例永远是数据 + 薄宿主胶水（运行时职责），**绝不在游戏层写 bespoke system**；每样例保持「最弱 LLM 能照抄」纯度，**不许长成 mini-game**。分两类样例：**UI 数据样例（mountUI）** vs **渲染/仿真样例（renderer + skills）**，别混。
>
> **视频改判**：owner 明确「以后跟爱诗 AI 合作 + 开场视频要用」→ 不是 wontfix，是 **deferred 的底层真需求**：等真游戏拉动（要播放/渲染视频）再下沉成 capability，先放着不为凑 demo 提前建（避免 YAGNI）。
>
> **已落地（Lead）**：
> - **Hub + 模块重组**：落地积木墙（Card grid·点块进各模块）+ 顶栏返回；mod-ui 套现有 5 UI 子 tab。
> - **🎮 输入底座**：`input-lab.ts`（KeyBinding[] 纯数据 + resolveSignal/applyRawInput 纯函数 + LayoutNode 视图）+ 宿主 bindInputPad 监听胶水；10 测。
> - **✨ 精灵动画**：`anim-lab.ts`（tween 蓝图·4 形状）+ 渲染舞台宿主 syncStage（Engine+CanvasRenderer 挂 #sim-stage·幂等·换皮/退出拆建）；3 测 + Chromium 截图验证。
> - **🧠 游戏 AI（索敌+寻路）**：`ai-lab.ts`（aggro Perception→Relation 锁玩家 + grid-move hex A* 逐格逼近·到相邻停 的纯蓝图）；3 测 + 截图（5 敌从四周寻路合围玩家）。
> - **🧊 3D 渲染**：`three-lab.ts`（Mesh3D 翻面卡/翻滚立方/倾转面 + tween 转 rotation）+ ThreeRenderer 后端（syncStage 按 backend 选 canvas/three）；3 测 + 截图（SwiftShader WebGL 真 3D）。
> - **四根底座支柱**（owner 2026-06-25「先把这 4 档落地」）——全 Canvas、纯蓝图、零专属 system、各带测试 + Chromium 截图：
>   - **🟢 运动与碰撞**（physics-lab）：motion-apply + overlap-detect + **collision-resolve**（按 Mass 推开=真碰撞响应；勘探误判为「无响应」，实测存在）。
>   - **⚔️ 战斗结算**（combat-lab）：弹道(Sensor+Hitbox) → overlap → trigger-zone → hitbox 扣血/灼烧 DoT → mortal → destroy（照搬 game-d 写法）。
>   - **🎆 生成与寿命**（spawn-lab）：Timer(loop)→event-when→caster→prefab 周期生成粒子 + Tween 淡出 + lifetime 自毁。
>   - **🔀 状态机**（fsm-lab）：自由计时器 → event-when（timer 阈值）→ effect-apply（set-state + set-visible）idle→alert→flee→循环（reset-timer 按 targetEntity 定位）。
> 全部「组合现成能力（蓝图 capabilities+entities）」，**零专属 system**。展示台现 10 块全亮。tsc+vitest(1758)+build 全绿。
> **TODO**：序列帧 spritesheet 动画（需真实贴图资产·待资产接入）；视频模块（deferred·爱诗 AI/开场视频拉动再下沉）；Hub 积木异形/点阵底纹（待 owner 拍样式·必要时下沉 renderer 背景/异形布局能力）。

---

### REQ-UI-fontPixel令牌 · [2026-06-27] · PI（game-i 展示台）→ 主程（引擎 UI 域）· status: **✅ done（主程·SHELL+Apollo 基座补 fontPixel 令牌·`font-pixel-default.test.ts`）** · 优先级: P3 · 类型: 令牌补全（小·非结构）

> **缺口**：展示台接 `Label.font` 字体槽时发现——`font:'pixel'` 在 SHELL（及引擎默认主题）里**没有对应的 `fontPixel` 令牌值** → 渲染器静默 fallback 成 `fontUi`，像素字体槽形同虚设。对照：`font:'display'` 有 `SHELL.fontDisplay`（衬线）正常生效。
> **请补**：给 `SHELL`（及引擎自带默认主题）补一个 `fontPixel` 像素/点阵字体栈（如 `'"Silkscreen","DotGothic16",ui-monospace,monospace'`）。`UITheme.fontPixel?` 字段**已在**、只差默认值——填上即可。
> **判据（为何是真缺口不是过度设计）**：font 槽是闭集枚举（最弱 LLM 填 `font:'pixel'`），但其中一个枚举值无后端令牌 = 数据接口不完整，弱模型填了会静默踩空、得不到承诺的像素感。属「能力声明了但没给齐」的补全，不是新功能。
> **暂态**：展示台 `font-disp` 用 `font:'display'` 演示（正常）；`pixel` 待此令牌补上再加一条。

### REQ-UI-引导可演示性 · [2026-06-27] · PI（game-i 展示台）→ 主程（引导/Overlay 域）· status: **✅ 已答（主程·非缺口·见下答复）** · 优先级: P3 · 类型: 问询（可演示性·非缺口）

> **现象**：`LayoutConstraints.anchor`（渲染加 data-anchor·让数据 UI 也能被新手引导 spotlight）目前**无法在展示台独立演示**——它要 `OnboardingOverlay` + 世界 `Coachmark{anchor}` 配套才有意义，单摆一个 data-anchor 节点看不出任何效果。
> **问主程**：有没有「**纯数据触发一段引导**（spotlight 某 anchor + 一句文案）」的最小可调用路径？若有，展示台加一块「🧭 新手引导」样例；若引导本就是宿主运行时编排（非纯数据可触发），请确认——我就在展示台对 anchor 标注「属引导基建·见某游戏引导」而非硬塞一个看不出东西的节点。

> **主程答复（2026-06-27）**：引导 = **数据(Coachmark) + 一次宿主 mount**——内容是纯数据，但要起一层 overlay（同 mountUI/渲染器的挂载，不是零胶水）。
> - 数据侧：世界挂一个 `Coachmark{anchor:'x', text:'…', shape?, placement?, visibleWhen?}`（纯数据·弱模型能填）= 一段引导。
> - 运行侧：宿主调一次 `mountOnboardingOverlay(host, world)`（薄胶水·持续读世界 Coachmark + DOM `data-anchor` 渲 spotlight）。
> - **展示台最小 demo 路径**：gallery host 上 `mountOnboardingOverlay(host, world)` + 给某元素 `layout.anchor:'demo'` + 世界挂 `Coachmark{anchor:'demo', text:'点这里开始'}` → 真会 spotlight，可加「🧭 新手引导」样例。
> - 若不想在展示台起 world/overlay：对 anchor 标注「属引导基建·Coachmark 数据 + OnboardingOverlay 宿主挂载触发」即可，不必硬塞节点。两种都行，你定。
> **不擅自做的理由**：引导 overlay 归引导域、可能跨 session；在搞清「能否纯数据触发」前盲塞 demo 会要么没效果、要么撞引导域的活。先问清归属与触发方式。

### REQ-UI-G牌组保真批（5 条） · [2026-06-27] · PG 同步（UI 库域·大厅/牌组逐页对齐撞到） · status: **已评审（主程·1 接受 4 回驳）** · 类型: 混合（1 真缺口 + 4 已覆盖）

> PG 一次提 5 条牌组/大厅保真需求。Lead 逐条过尺子（能重组/已覆盖→回驳；真缺口→下沉）。证明测试：`tag-size-card-overlay.test.ts`。

> **① 货币 pill（商城/金币/钻石）太小 → ≈2x 大气** · status: **✅ done（接受·下沉 `Tag.size`）**
> - 判据：Tag **无 children 逃生槽**、Label **无药丸 chrome（bg/border/radius）**→ pill 缩放无法重组表达，是真缺口。
> - 下沉：`TagProps.size?: 'sm'|'md'|'lg'`（md=原默认·向后兼容；lg=大气药丸 字16/padding7×15·≈2x）。同 `Modal/PlayingCard.size` 体系、catalog+校验器同步。货币计数 → `Tag{label:'💎1280', size:'lg', tone:'accent'}`。

> **② 主页 Boss 地煞卡：buff 详情 + 行高高 + 字 1.3x** · status: **🚫 wontfix-已覆盖（Card.children + Label.size）**
> - 判据：Card **有 children 逃生**（`children.length ? 自定义体 : 默认 title/sub`）→ 大字 Boss 卡用 children 覆盖默认排版即得，**不需要 Card.size**（加了就是无脑加宽·与 Label 全套 size 体系功能重复）。
> - 等价写法：`Card{tone:'accent', corner:'BOSS', action, children:[ Label{size:'xl' 名}, Panel{bare, gap:6, children:[ Label{size:'lg' buff行}×N ]} ]}`。`xl=22`(默认13的≈1.7x)、`gap`=行距/行高。证明见测试 ②。

> **③ 牌组扑克：选中→中央「选」/ 耗费右下→右上 / 战力中下→中上 / hover→悬浮简介** · status: **🚫 wontfix-已覆盖（Panel relative + x/y 叠层 + visibleWhen + Tooltip.bubble）**
> - 判据：四项全可重组——`layout.x/y` 已触发**绝对定位**（render.ts:33）、Panel 本就 `position:relative`（render.ts:196 锚框）、`visibleWhen` 已在（条件「选」字）、`Tooltip.bubble`/`PlayingCard.flipOnHover` 已是 hover 富气泡。给 PlayingCard 加 valuePos/powerPos/selectedMark 等位置旗标 = 闭集闯入、creep，**回驳**。
> - 等价写法：把 PlayingCard 包进 `Panel{bare, width/height}`，cost/power/「选」用兄弟 `Tag/Label{layout:{x,y}}` 叠到任意角；「选」挂 `visibleWhen:'cardPicked'`；整张再包 `Tooltip{bubble: 简介Panel}` 得 hover 浮窗。证明见测试 ③（cost 落 `left:42px;top:4px`、含 `data-tooltip-bubble`）。

> **④ 天罡卡 hover→悬浮简介** · status: **🚫 wontfix-已覆盖（同③ hover）**：`Tooltip{bubble}` 包牌 或 `PlayingCard{flipOnHover, backFace}`，二者皆已在。
>
> **[PG 回执 2026-06-27·D5/D6 hover 在 grid 里重组失败]**：实测把 `Tooltip` 包到 13 列 grid 的卡上 → Tooltip 触发元素是 `inline-flex span`，**作为 grid item 不随 1fr 拉伸 → 卡塌陷/重叠**（fluid 卡墙碎掉）。`flipOnHover` 又与卡上 cost/power/选 叠层冲突。所以「Tooltip 包牌」这条在 **grid 网格里不成立**。请主程二选一补：① `Tooltip` 加 `block?:boolean`（触发元素 display:block/contents·能作 grid/flex item 拉伸）；② 或给 `PlayingCard`/`Card` 一个 `tip?:string|LayoutNode`（卡内 hover 浮窗·不靠外包 span）。PG 暂留牌组卡无 hover 简介。
>
> **主程答复（2026-06-27）· ✅ 取①·done（`Tooltip.block`·`tooltip-block.test.ts`）**：选①不选②——②要在 PlayingCard/Card/… 各加 tip 槽=闭集 creep；①修的是**坏掉的原语**（Tooltip 只能包内联触发），一处修、所有 grid/flex 场景通用。落地：`TooltipProps.block?:boolean` → 触发元素 `display:block;width:100%`（能作 1fr grid item 撑满不塌；缺省仍 inline-flex 向后兼容）。catalog + 校验器同步。**PG 可恢复牌组卡 hover**：`Tooltip{block:true, bubble:简介Panel}` 包 fluid 卡，13×4 卡墙不碎。（我上批 ③ 配方漏了 grid 拉伸这点，已补——对账完成。）

> **⑤ 全局字号对齐原版（Card/Tag size 体系）** · status: **✅ 覆盖（Tag.size 新增 + Label.size 既有）**：Tag 侧由①补齐；Card 文字侧用 children 里的 `Label.size`（xs..xxxl 全档）。无需独立 Card.size。对齐原版具体字号 = PG 填数据（选 size 档），非引擎活。

> **一句话**：5 条里只有 ① 是「现成能力真表达不了」的缺口（已下沉 Tag.size）；②③④⑤ 全是现成 LayoutNode 重组即得（Card.children / x/y 叠层 / visibleWhen / Tooltip.bubble / Label.size），按 manifesto「先重组、勿加宽」回驳并附等价数据写法 + 证明测试。

> **[PG 消费回执 2026-06-27·D5/D6 已复活·闭环]**：主程 `Tooltip.block` 落地后，牌组扑克 13×4 牌墙每张包 `Tooltip{block:true, bubble:武将词条Panel(名/衔/战力费用/战绩·只中文)}`、天罡槽同法包词条 → hover 悬浮简介到位，**网格保真不塌陷（截图实测 13 列填满）**。tsc+vitest(1922)+build 全绿已推。本批 ②③④⑤ 全程零引擎扩面（纯重组），① Tag.size + Tooltip.block 两处下沉到此全部消费完毕。**结案。**

### REQ-FX-战斗特效抽象 · [2026-06-27] · owner → 主程（UI 库域 + 架构） · status: **✅ done（主程·两正交特效库·防开关爆炸）** · 类型: 真能力下沉 + 架构定调

> **owner**：战斗要一堆特效，抽象成数据，但**别每效一个布尔开关（恶性膨胀）**——「把它变成一个正交的、可叠加的抽象效果合集」。仔细分辨：有的是 UI 通用特效，有的是游戏专属实体特效，两个都要建立、且正交可叠加。
> **主程评审 + 落地**：分成**两个正交特效库**（详 `docs/design/effects-architecture.md`）：
> - **库 A·UI 特效（`LayoutNode.fx: VisualEffect[]`）= 真缺口·已下沉**：一个字段一串特效，闭集 kind（pulse/float/shake/pop/glow/sheen/flash）+ 参数（color 语义色/ms/intensity/once），可叠加、render-only CSS、校验器把关闭集。**替代 sheen?/glow? 开关爆炸**（旧 bool 并入作别名）。**铁律：新特效=加一个 kind（评审过的确定性 CSS），绝不再加布尔旗标。** 实现 render.ts `fxToCss` + server.ts 关键帧 + validate.ts 闭集校验，验收 `ui-fx.test.ts`（11 测）。
> - **库 B·战场/实体特效 = 已覆盖·零新系统**：粒子/爆炸/闪光 = `PrefabTemplate`(数据) + `caster`/`tween`/`lifetime`/`Timer` 现成能力组合（参照 spawn-lab/combat-lab）。游戏的「特效库」= 一组 prefab 数据（游戏层），**不下沉任何新 system**（CORE RULE：已覆盖→不加）。
> - **正交 + 叠加**：库 A 改 UI 元素自我动画；库 B 在世界生成特效实体；同一处可叠（牌 fx shake+flash 的同时战场 caster 爆炸）。
> **给所有 session/PG**：UI 战斗反馈一律用 `layout.fx`（从闭集 kind 选），**别再提/加 `xxx?:boolean` 特效开关**；缺 kind → 提 requests，主程评审后加**一个 kind**。


_（REQ-3D-W1高效引擎 已移至 [`requests-3d.md`](./requests-3d.md)。）_

### REQ-UI-BUG-style属性引号截断 · [2026-06-28] · PI → 主程（UI 库域·render.ts 序列化） · status: **待主程** · 类型: 渲染正确性 bug（击穿已发特性）

> **现象**：`Label` 的 `white-space:pre-line`（多行 `\n`·db56703a 刚发）、`glow`（text-shadow）、`tracking`（letter-spacing）**全部静默失效**——在所有主题下都不生效。建展示台 demo 时实测发现：多行 label 挤成一行、glow 不发光、tracking 无字距。
>
> **根因（已定位·非玄学）**：主题 `UITheme.fontUi` 的值含**未转义的双引号**，如 onyx：
> `"-apple-system, \"Segoe UI\", \"PingFang SC\", … sans-serif"`。
> `renderLabel` 把它拼进 `style="…;font-family:-apple-system, "Segoe UI", …;white-space:pre-line"`。
> 浏览器 HTML 解析器在 `font-family:-apple-system, ` 后的**第一个 `"` 处就把 `style` 属性闭合了**，其后的一切（`Segoe UI"`、`pre-line`、`text-shadow`、`letter-spacing`）被当成废属性丢弃。
> **凡是在 `renderLabel` 数组里排在 `font-family:${fam}` 之后的样式属性，全中招**（当前顺序：font-family → **pre-line / glow / tracking** → ls）。
>
> **证据（Chromium computed style·onyx 主题·game-i 展台 tab-new）**：
> | 元素 | 期望 | 实测 computed |
> |---|---|---|
> | `ml-1`（多行）| white-space:pre-line | `normal`（→ 单行）|
> | `font-glow` | text-shadow:0 0 8px… | `none`（→ 不发光）|
> | `font-track` | letter-spacing:3px | `normal`（→ 无字距）|
>
> **建议修法（主程定夺·二选一）**：① 序列化时对整个 `style="…"` 属性值做 HTML 转义（`"`→`&quot;`）——最稳，但会改动**所有**带 font-family 的组件 golden 字节、须统一重生成快照；② 仅把 `fontUi` 里的字体名用单引号或在拼接处转义。**因为牵涉一大批 golden HTML 快照重生成、属 UI 库统一序列化策略，我（PI）不擅自改 render.ts，交主程裁决。**
>
> **影响面**：不止 Label——任何把含引号文本/主题令牌拼进 `style` 且其后还有属性的渲染路径都可能漏样式。建议顺手审一遍 render.ts 的 `style="${…}"` 拼接是否都过转义。
>
> **展示台侧**：`t-multiline` / `t-font`(glow/tracking) 三段 demo 的**数据是对的**（前向正确），主程修序列化后即自动点亮，无需改 demo。
>
> **⚠️ 升级（2026-06-28·UI 审计工具实测加料·严重度↑）**：此 bug 不止吞「锦上添花」的 glow/tracking——它在 `renderTabs` 里把**页签文字 `color` 整个吞掉**：navBtn 的 style 顺序是 `…font-family:${t.fontUi};…;color:${on?gold:sub}` → color 排在 font-family 之后 → 被引号截断 → **页签文字回退成纯黑 `rgb(0,0,0)`，落在近黑底上 ratio≈1.09、完全不可读**。`tools/ui-audit.mjs` 跑 game-i MMO HUD 一眼抓到（聊天页签「综合/战斗/交易」黑字）。**影响所有用 Tabs 的界面（含 game-g 大厅页签）——是「线上交互控件不可读」级，不是装饰缺失。** 修序列化（整个 style="" 值 HTML 转义）一次性解决 Tabs color + Label glow/tracking/pre-line 全部；会改一大批含 font-family 的 golden 字节、须主程统一重生成，故仍交主程。**建议提优先级。**

### REQ-UI-BUG-fx与绝对定位不兼容 · [2026-06-28] · PI → 主程（UI 库域·render.ts/layoutStyle） · status: **待主程** · 类型: 两 render-only 特性不组合

> **现象**：一个 LayoutNode 同时给 `layout.x/y`（绝对定位叠层）+ `layout.fx:[{kind:'sheen'}]`（流光）时，**绝对定位失效**——元素退回 `position:relative`，x/y 变成「相对正常流位置的偏移」而非「相对父原点的绝对坐标」，于是跑位（在别处堆叠）。建 MMO HUD 施法条（绝对定位 + sheen）时实测：声明 y:460、实际渲染 position:relative + 落到 y:515。
>
> **根因（已定位）**：`sheen`（及任何需 ::after/::before 叠层的 fx）要求宿主 `position:relative` 才能定位伪元素；layoutStyle 里这个 `position:relative` **覆盖了 x/y 本应给的 `position:absolute`**。两个 render-only 特性在同一节点上互斥。
>
> **证据**：`getComputedStyle(#cast)` → `{position:'relative', top:'460px', left:'395px'}`（本该 absolute）。同 HUD 里另一个「绝对定位 + sheen」的目标施法条只是**碰巧**没跑偏（它是页面里第一个 relative 元素、正常流位≈0，相对偏移≈绝对坐标）。
>
> **建议修法（主程定夺）**：x/y 存在时，让 `position:absolute` 赢（sheen 的 ::after 用 absolute 宿主也能定位——absolute 同样是 positioned ancestor）；即 fx 不要硬写 `position:relative`，改成「仅当无 x/y 时才补 relative」。
>
> **展示台侧已用合法组合绕开**（不等修复）：定位壳(x/y·无 fx) 裹 特效内卡(fx·流式填充)——`{Panel x/y bare}>{Panel fx ...}`。MMO HUD 两条施法条均已这样写、overlap 审计归零。属可接受的数据写法，但**「直接在绝对定位节点上挂 fx」是直觉写法、应能用**，故报缺口。
