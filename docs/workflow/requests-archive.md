# requests.md · 已完结条目归档

> 由主程 2026-07-03 归档手术生成：完结（✅/wontfix）条目全文移入本文件，活跃/排队条目留在主池。查旧条目先 grep 本文件。

### REQ-UI-web字体加载（数据化）+ 第3字体槽 + Label ink 令牌 · [2026-07-02] · P3D（game-d 对齐 Cloud Design 撞到·全 app 受益） → 主程（UI 库域） · status: **✅ done（主程 2026-07-02·①机制下沉 + ③令牌落地·②已存→回驳；剩 vendor woff2 数据活）** · 类型: 真能力缺口（3 项·尺子已过·不可重组）

> **背景（owner 2026-07-02「用色/字体必须跟 Cloud Design 对齐」）**：对齐 game-d《骰途》到 Cloud Design 设计案时定位到——**字体走样不是能力问题、是全 app 从不加载 web 字体**。三项缺口都属 UI 库域（`src/ui/**`·主程），game-d 侧无法数据化解决：
>
> 1. **web 字体加载（主缺口·全 app 受益）**：全仓多主题（game-d/game-g/sanguo/ink-wash/fantasy-medieval…）在 `UITheme.fontUi/fontSerif` 里引用 `'Noto Sans SC'`/`'Noto Serif SC'`/`'Cinzel'` 等，**但运行时 `index.html` 从不加载这些 Google Fonts**（只 `game-g/doc/*.html` 设计稿里有 `<link>`）→ 浏览器全部静默回退系统字体，跟设计天差地别。**尺子**：弱 LLM 只该填「要哪几款字体」（数据），不该手写 `<link>`/`@font-face`。**建议**：`UITheme` 加 `webfonts?: Array<{family,weights?,url?}>`（或复用资产系统 `font` kind），`mountUI` 首次挂载时确保注入一次（去重·全局）。确定无关（纯表现）。
> 2. **第 3 字体槽（display/装饰衬线）**：`UITheme` 现只有 `fontUi`(正文)/`fontSerif`(标题)/`fontMono` 三槽；设计案却要 **3 种文字字体**——正文 `Noto Sans SC`、中文标题「骰途」`Noto Serif SC`、英文副标「TOWER OF FATE」`Cinzel`（辨识度极高的装饰衬线）。现无第 3 槽 → 副标只能退回 serif（错）。**建议**：加 `fontDisplay?` 槽 + `Label` 支持 `font:'display'`。
> 3. **Label `ink` 深色令牌**：金按钮上的深墨字（原型 `#3a2406` on gold）无对应语义色——`Label.color` 语义档全是亮色（text/sub/gold/ok…），深色墨字表达不了。game-d.ts 已挂 TODO（`gd-start-t`）。**建议**：`Label.color` 闭集加 `'ink'`（映射 `UITheme.ink?`·深色）。**（体量最小·可先做）**
>
> **影响面**：①修一处全 app 字体归位；②③ game-d Title 屏 1:1 需要。均 render-only/表现层·不碰 sim/hash。P3D 侧已把 game-d 色令牌逐色取样对齐（本 session·commit 见 game-d），字体待此三项落地后接。
>
> **主程评审 + 落地回执（2026-07-02·CORE RULE 已过·render-only 无关 sim/hash）**：
> - **① web 字体加载 → ✅ 接（真缺口·下沉一处全 app 受益）**：核实属实——运行时 `index.html` 只声明 `'Inter'` 却从不加载任何 web 字体，全主题静默回退系统字体（`game-g/doc/*.html` 的 Google Fonts `<link>` 只在设计稿·非运行时）。**把 `game-g/fonts.ts` 已跑通的自托管 @font-face 打法通用化进 UI 库**：`UITheme.webfonts?: WebFont[]`（`{family,url,weight?,style?}`·纯数据）+ `ensureWebfonts()`（去重·全局单 `<style id=apollo-webfonts>`；`mountUI` 自动调、renderNode-only 屏自调一次）。尺子过：弱 LLM 只填「要哪款 + 打包后 woff2 URL」，引擎生成 @font-face·不手写 CSS。`src/ui/components/req-webfont-ink.test.ts`。
> - **② 第 3 字体槽 → 🔁 回驳（已覆盖·done-covered）**：`UITheme` 早已有 `fontUi/fontMono/fontPixel/fontDisplay/fontSerif` **5 槽**、`Label.font` 已收 `'ui'|'mono'|'pixel'|'display'|'serif'`（REQ-UI-骰途逐像素② + REQ-UI-fontPixel令牌 落的）。game-d **直接填数据**即可：正文 `fontUi:'Noto Sans SC'`、中文标题 `fontSerif:'Noto Serif SC'`(Label `font:'serif'`)、英文副标 `fontDisplay:'Cinzel'`(Label `font:'display'`)。无需新增槽——当年"只有 3 槽"的判断已过期。
> - **③ Label `ink` 深墨字 → ✅ 接（小·令牌补全）**：`Label.color` 闭集 +`'ink'`、`UITheme.ink?`（缺省回退 `bg0`）、SHELL 补默认 `#2a1f12`、catalog `COLOR` 同步（顺带补回早前漏登的 `mine/foe`）。game-d 的 `gd-start-t` TODO 可拆。
> - **剩余=数据活（非机制·不阻塞·派 asset-manager / 有网环境）**：要真「高级感」，各主题需各自 **vendor 子集化 woff2** 再在 `theme.webfonts` 声明。① 已把机制铺好：**game-g 可即刻把 `fonts.ts` 的 12 个 woff2 URL 挪进自己 theme 的 `webfonts` 走通用路径、删掉自写注入**；SHELL 基座 premium 字体集同理待 vendor（本沙箱无网抓不了字体，故只落机制、不擅塞字体文件）。

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

### REQ-UI-数字补间 / 富文本 · [2026-06-23] · Lead 登记（UI 库域） · status: **✅ done（owner 2026-06-25「都做完不要等·早晚需求」·下沉为 Label.tween / Label.spans）** · 类型: 真能力缺口下沉（manifesto 尺子已过）

> `LabelProps.tween:{from,to,ms?,decimals?}`（数字滚动·easeOutCubic·render-only）+ `LabelProps.spans:[{text,color?,bold?}]`（多段着色）。折进 Label 不新建控件。验收 `label-tween-spans.test.ts`。3D/SVG/hex/WorldFollower 回驳（见迁移指南 §4）。详情见 git。

### REQ-UI-3缺口（变换/动画/拖放） · [2026-06-23] · Lead 主导（UI 库域·跨游戏重构前置） · status: **✅ done（声明式下沉·game-i 同提交）** · 类型: 真能力缺口下沉（manifesto §4 评审通过）

> 三游戏(E/F/G)数据驱动 UI 重构缺口收敛到 3 个声明式字段并下沉(`src/ui/components`)：`LayoutConstraints.rotate/scale`(CSS transform·扇形手牌)、`anim/animMs/animDelay`(具名入场关键帧·发牌)、`draggable/dropZone`(HTML5 拖放·放牌落子)。验证 `dnd-transform-anim.test.ts` + game-i 第5页。② 回驳归 renderer/世界层(浮动血条/逐帧精灵/hex/SVG斜梯/命令式计分时间轴)；③ 假缺口(多选≤N/牌面渲染=重组)。详情见 git。

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

### REQ-G-卦象结算加减 · [2026-06-21] · owner→甲（Game G·结算逻辑） · status: **✅ done（甲·`settleTurn` 战利品按今日卦象±·确定性·大吉+2…大凶−2·夹≥0）** · 类型: 战斗逻辑（结算期·甲域）
> 一局结算按今日卦象 ±战利品(大吉+2…大凶−2·夹≥0)·确定性进 hash·`settleTurn`。详情见 git。
### REQ-E-023 · [2026-06-18] · PE（Game E 小丑牌 · 牌库扩展总纲）· 框架级 · status: **⑥ 仅余 open（①②③⑤ done · ④ wontfix）** · 类型: 多个真缺口（逐项独立）

> 目标：可玩小丑 31 → 趋近 150（catalog 150 已全）。六能力拆分，详见 `docs/game-design/game-e-joker-rollout.md` + git 历史。
> **进度**：① countOf（按 Tag 掩码数实体）**done** · ② 确定性概率 roll（chancePass）**done** · ③ 留手牌结算 pass（HeldHand）**done** · ④ 自增长 **wontfix/重组**（Resource+Effect+valueFrom 覆盖·Counter 冗余）· ⑤ HandMods（four_fingers/shortcut/smeared）**done 部分** · ⑥ 跨实体复制/改牌 **defer(P3)**。
> **⑥ 仍 open（唯一未闭合）**：无干净最小切片（小丑排序/相邻、运行时改牌库 = 抗数据化），整包下沉=inner-platform，撞防臃肿红线。真要做按族逐个最小 REQ（先"只读复制"族需干净小丑排序接口；再"改牌库"族需运行时牌库变更的快照/确定性契约），各附弱-LLM 尺子证明，不一次性塞。①②③⑤已闭合不阻塞⑥。

---

### REQ-023 · [2026-06-09] · 主程4（Game F）· status: **wontfix（2026-06-15·重组覆盖）** · 类型: group-effect 集合写

> 羁绊光环可用 group-count→全局 buff 资源→各单位读 重组绕过；仅"各单位异质、全局值表达不了"才下沉（→ 后由 REQ-F-065 命中该留口）。详情见 git。

---

### REQ-F-064 · [2026-06-15] · game-f（Boss 技能）· status: **wontfix / done-covered（2026-06-15）** · 类型: 现有能力重组（非缺口）

> 信长全军 buff = group-count→dmg_scale→hitbox 读；秀吉援军 = Caster→prefab；真田自残血加伤 = Condition(自身 hp)→Effect→scaleByResource。三技能均现有能力可表达 → 回驳。详情见 git。

---

### PG-乙→甲 · [2026-06-21] · Game G · status: **✅ done（并入 REQ-G-退役旧战斗核·`a0970248`/`8c6c2751`）** · 类型: 战斗段死代码清理

> game-g.tsx 旧实时血脉（showMatch/live-combat/battle-screen）+ Engine 血脉（buildGameGMatch）已随退役旧核全删。详情见 git。

---

### REQ-G-战斗结构 · [2026-06-21] · design G → 甲 · Game G · status: **✅ 核心已实现（战胜硬币 50/50 + 3D + 玩家亲掷/AI自动）；stayPMul/续航门 随天罡地煞重设计再落** · 类型: 真缺口（结构性）

> 掷命胜者「人头=留场续攻 / 人面=回牌库+返半费」(`resolveClash` 种子化硬币·`coin-flip.ts` CSS-3D)。调参钩子(stayPMul/续航门/CLASH_WIN_STAY_P)并入后续天罡/地煞重设计批次随平衡标定。完整契约 doc24 §4.2 + boss-config-1-5.md。详情见 git。

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

### REQ-FX-战斗特效抽象 · [2026-06-27] · owner → 主程（UI 库域 + 架构） · status: **✅ done（主程·两正交特效库·防开关爆炸）** · 类型: 真能力下沉 + 架构定调

> **owner**：战斗要一堆特效，抽象成数据，但**别每效一个布尔开关（恶性膨胀）**——「把它变成一个正交的、可叠加的抽象效果合集」。仔细分辨：有的是 UI 通用特效，有的是游戏专属实体特效，两个都要建立、且正交可叠加。
> **主程评审 + 落地**：分成**两个正交特效库**（详 `docs/design/effects-architecture.md`）：
> - **库 A·UI 特效（`LayoutNode.fx: VisualEffect[]`）= 真缺口·已下沉**：一个字段一串特效，闭集 kind（pulse/float/shake/pop/glow/sheen/flash）+ 参数（color 语义色/ms/intensity/once），可叠加、render-only CSS、校验器把关闭集。**替代 sheen?/glow? 开关爆炸**（旧 bool 并入作别名）。**铁律：新特效=加一个 kind（评审过的确定性 CSS），绝不再加布尔旗标。** 实现 render.ts `fxToCss` + server.ts 关键帧 + validate.ts 闭集校验，验收 `ui-fx.test.ts`（11 测）。
> - **库 B·战场/实体特效 = 已覆盖·零新系统**：粒子/爆炸/闪光 = `PrefabTemplate`(数据) + `caster`/`tween`/`lifetime`/`Timer` 现成能力组合（参照 spawn-lab/combat-lab）。游戏的「特效库」= 一组 prefab 数据（游戏层），**不下沉任何新 system**（CORE RULE：已覆盖→不加）。
> - **正交 + 叠加**：库 A 改 UI 元素自我动画；库 B 在世界生成特效实体；同一处可叠（牌 fx shake+flash 的同时战场 caster 爆炸）。
> **给所有 session/PG**：UI 战斗反馈一律用 `layout.fx`（从闭集 kind 选），**别再提/加 `xxx?:boolean` 特效开关**；缺 kind → 提 requests，主程评审后加**一个 kind**。


_（REQ-3D-W1高效引擎 已移至 [`requests-3d.md`](./requests-3d.md)。）_

### REQ-UI-BUG-style属性引号截断 · [2026-06-28] · PI → 主程（UI 库域·render.ts 序列化） · status: **✅ done（主程 2026-07-01·根因=主题字体名双引号在 style="" 提前闭合属性→字体名一律单引号·修 9 处字体栈·`theme-font-quote-safe.test.ts`）** · 类型: 渲染正确性 bug（击穿已发特性）

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

### REQ-UI-BUG-fx与绝对定位不兼容 · [2026-06-28] · PI → 主程（UI 库域·render.ts/layoutStyle） · status: **✅ done（主程 2026-07-01·x/y 在场时剥掉 fx 的 position:relative·absolute 赢·`ui-bugfix-fx-toggle-slider.test.ts`）** · 类型: 两 render-only 特性不组合

> **现象**：一个 LayoutNode 同时给 `layout.x/y`（绝对定位叠层）+ `layout.fx:[{kind:'sheen'}]`（流光）时，**绝对定位失效**——元素退回 `position:relative`，x/y 变成「相对正常流位置的偏移」而非「相对父原点的绝对坐标」，于是跑位（在别处堆叠）。建 MMO HUD 施法条（绝对定位 + sheen）时实测：声明 y:460、实际渲染 position:relative + 落到 y:515。
>
> **根因（已定位）**：`sheen`（及任何需 ::after/::before 叠层的 fx）要求宿主 `position:relative` 才能定位伪元素；layoutStyle 里这个 `position:relative` **覆盖了 x/y 本应给的 `position:absolute`**。两个 render-only 特性在同一节点上互斥。
>
> **证据**：`getComputedStyle(#cast)` → `{position:'relative', top:'460px', left:'395px'}`（本该 absolute）。同 HUD 里另一个「绝对定位 + sheen」的目标施法条只是**碰巧**没跑偏（它是页面里第一个 relative 元素、正常流位≈0，相对偏移≈绝对坐标）。
>
> **建议修法（主程定夺）**：x/y 存在时，让 `position:absolute` 赢（sheen 的 ::after 用 absolute 宿主也能定位——absolute 同样是 positioned ancestor）；即 fx 不要硬写 `position:relative`，改成「仅当无 x/y 时才补 relative」。
>
> **展示台侧已用合法组合绕开**（不等修复）：定位壳(x/y·无 fx) 裹 特效内卡(fx·流式填充)——`{Panel x/y bare}>{Panel fx ...}`。MMO HUD 两条施法条均已这样写、overlap 审计归零。属可接受的数据写法，但**「直接在绝对定位节点上挂 fx」是直觉写法、应能用**，故报缺口。

### REQ-UI-BUG-Toggle视觉点击不更新 · [2026-06-30] · P3D（game-z 调试面板实测） → 主程（UI 库域·server.ts reconcile 焦点保护） · status: **✅ done（主程 2026-07-01·焦点保护只认文本控件·checkbox/radio 放行重建·`ui-bugfix-fx-toggle-slider.test.ts`）** · 类型: 渲染正确性 bug（控件视觉与状态脱节）

> **现象（owner 2026-06-30 报）**：点 `Toggle` 开关，**开关的视觉（轨道色 + 圆钮位置）不跟着变**——但绑定的 `action` 效果**确实生效**（AO/雾/分级被切了）。即「逻辑对、视觉死」。game-z 渲染调试面板每个 Toggle 都中招。
>
> **根因（已定位·非玄学）**：`Toggle` 的开/关视觉是 `renderToggle` 据 `p.checked` **算出来的内联样式**（track bg / 圆钮 left），包在一个**隐藏 `<input type=checkbox>`** 外的styled `<span>` 上。点击时 label 激活那个隐藏 checkbox → **checkbox 拿到焦点**（`document.activeElement` = `#{id}-i`，在 Toggle 的 `<span id>` 内）。随后 handler 调 `menuUi.update(tree())` 走 `reconcileNode` → `patchFocusedInput(el, newN)`（server.ts:50）：它见「焦点是个 INPUT 且在本节点内」就**无脑 `return true`（跳过 outerHTML 重建）**（server.ts:64）——本意是保护**文本 Input/Combobox** 的光标/IME，却**误伤了 Toggle/Checkbox/Radio**：这些控件的焦点落在隐藏 checkbox 上，而视觉在外层 styled span，跳过重建 → **视觉永远停在旧 `checked`**。
>
> **证据**：`patchFocusedInput` 仅对 `newN.type==='Input'` 做了就地同步（server.ts:57），其余（含 Toggle）一律落到 `return true` 跳重建；而 Toggle 视觉无任何「就地同步」分支 → 必停在旧值。
>
> **建议修法（主程定夺·二选一）**：① 焦点保护**只认文本控件**——`active.type` 为 `text/search/textarea/select`（或 Input/Combobox 类型）才跳重建；checkbox/radio（Toggle/Checkbox/Radio 的内部输入）**不在保护范围**，照常 outerHTML 重建（隐藏 checkbox 丢焦点无害·点击交互已完成）。② 给 Toggle/Checkbox/Radio 也加「就地同步 checked + 重算视觉样式」分支（类似 Input 的 value 同步）。**①更简、面更广。** 属 UI 库统一 reconcile 策略，P3D 不擅改 server.ts，交主程。
>
> **影响面**：不止 game-z——**任何「点 Toggle/Checkbox 后调 `update()` 刷新面板」的界面都中招**（控件视觉与真值脱节、误导用户以为没生效）。建议连带审 Checkbox/Radio 的 update 路径。

### REQ-UI-BUG-Slider回调偶发undefined · [2026-06-30] · P3D（game-z 调试面板实测） → 主程（UI 库域·server.ts dispatch） · status: **✅ done（主程 2026-07-01·根因=dispatch 同绑 click+change·值控件非 change 事件不派发·`ui-bugfix-fx-toggle-slider.test.ts`）** · 类型: 健壮性 bug（脏值入回调）

> **现象（P3D 追 AO 黑屏时连带挖出）**：拖 `Slider`（`<input type=range>`）一次交互，绑定的 `change` handler 被调**两次**——第一次给正确数值串（如 `"0.65"`），**第二次给 `undefined`**。下游 `Number(undefined)=NaN` 写进 render-only 组件 → 后处理 shader 算 NaN → **整片黑屏**（game-z AO 黑屏的直接触发源；P3D 侧已加 finite 兜底双保险挡住，但脏回调本身应在 UI 库根治）。
>
> **复现**：game-z 渲染调试面板拖「AO 强度」滑块 → 实测 handler 收到序列 `["aoInt=\"0.65\"", "aoInt=undefined"]`（无头 Chromium 抓到·稳定复现）。
>
> **疑似根因（请主程核）**：`dispatch`（server.ts:194）对 `change` 事件，`INPUT` 分支 `arg = inp.value`（range 恒为数值串、不该是 undefined）。出现 undefined 说明**有第二个 `change` 事件**其 `el`/取值路径不落在 range 的 `inp.value` 上（可能是面板重建中旧 input 被移除时浏览器补发的 `change`、或 closest 命中了无值元素）。建议：dispatch 对 range/数值类 change **只在 `inp.value` 为有效串时才派发**（或统一「数值控件回调保证 finite」），别把 undefined 透传给游戏 handler。
>
> **影响面**：任何用 Slider 写数值的界面都可能吃到一发 `undefined`/NaN；控件层应保证「数值控件的回调实参恒为有效数值串」，不应让每个消费方各自 `Number.isFinite` 兜底。

### REQ-Resource · 引擎底层统一资源(Resource)层：3D 资产走 2D 贴图同款资产管理路线 · [2026-06-30] · owner → 主程/Lead（引擎核心资产层域·跨 2D/3D） · status: **✅ Lead 评审通过（接受·扩现有 Asset 层非新建·归属 hybrid·A/B 定 B + 钉死共享契约消返工·2026-07-01）** · 类型: 引擎底层架构（资产管理统一）

> **★ 主程/Lead 裁决（2026-07-01·已逐条硬验 P3D 断言属实：`registerAssetIndex` 确 `type!=='texture'` 即 skip·`AssetType` 已列全 7 型 + freeform `spec`·`Material3D` 有 preset/程序化 surface 无 map 字段·mesh 走 `registerManifest(GAME_Z_ASSETS)` 绕索引）**：
> **接受。** 尺子过：真缺口（运行时桥只 texture·材质贴图缺失·mesh 绕索引），但**索引 schema 已含全类型 + `spec` 字段 = 好底子** → 是「**扩现有 `AssetIndex`/bridge**」非「新建系统」（P3D「不推倒重来」判断对）。三红线守得住（① 资产 render-only·sim 只持 key 不进 hash；② import options/材质/贴图用途全数据·弱 LLM 尺子；③ 增量向后兼容）。
>
> **校正 1（命名·避撞名）**：**别引入新的 `Resource` 类型**——引擎已有 sim `Resource` 组件（hp/mana·logic.ts），撞名必乱。owner「以 Resource 控制」= 现有 **Asset 层（`AssetIndex` 单一真相 + key 引用）扩成全类型**，沿用 `Asset*` 命名，不新造 Resource。
> **校正 2（YAGNI）**：只给**有消费者的类型**定 `spec` 闭集（texture/mesh/material）；sound/font/video 占位不急（Phase 4 按需）·别为没消费者的类型先造 schema。
> **核心契约（engine-core·跨 2D/3D·Lead 定/把关）**：`AssetIndexEntry.spec` 从 freeform 收成**按 type 判别的闭集**（texture:`{usage,colorSpace,wrap?,tiling?}` / mesh:`{scale?,genCollision?}` / material:`{...引 texture key}`）+ 注册期校验。这是弱 LLM 尺子落点，必须闭集。
>
> **归属（hybrid）**：
> - **① 材质贴图消费端**（`Material3D.map` + 渲染器按 colorSpace 取图）= **P3D 域·owner 已授权·现在就做**。
> - **②③**（`registerAssetIndex` 桥全类型 + 收编 manifest + `spec` 闭集 schema）= engine-core：**契约（spec schema）Lead 定/把关；实现授权 P3D 跨界落**（同 NavMesh / model-loader / 3D 碰撞先例）——Lead 出 schema，P3D 照填实现 + Lead review。**此跨界授权待 owner 点头**（技术上我推荐照先例授权）。
> - **④** 材质成索引资产 / sound·font = 按需·后置。
>
> **A/B → 定 B（现在就落①）·且预先 bless 两个共享契约点彻底消返工**：① 骑的是**已成熟稳定的 texture-key 路径**（texture 早已端到端桥接），**不依赖 ②③ 的统一设计**。P3D 担心的返工来自「key 引用方案将来变」——但 **texture key 引用不会变**（是成熟路径）。为零返工，现钉死 ① 需要的两个契约点：
> 1. **texture `spec.usage`** = `'albedo'|'normal'|'roughness'|'metalness'|'orm'|'sprite'` + **`spec.colorSpace`** = `'srgb'|'linear'`（闭集·P3D 现按此给 game-z 贴图填数据·渲染器按 colorSpace 取图：法线/粗糙=linear·albedo=srgb）。
> 2. **`Material3D` 加 `map?/normalMap?/roughnessMap?/aoMap?`**（= texture key·render-only·字段名照 THREE 标准钉死）。
> 钉死这两点 → ① 完全前向兼容·零返工 → **P3D 现在就做 ①**。
>
> **★ owner 2026-07-01 授权 P3D 跨界落 ②③（照先例）→ Lead 交流/契约文档已发**：`docs/workflow/finish/P3D-asset-layer-handoff.md`（含 `spec` 闭集 schema + 全类型桥接设计 + Material3D 消费端 + 代码边界 + 分期验收 + Lead review 检查点）。P3D 照此实现：① 独立做、②③ 跨界实现合并前 Lead review。
>
> **★★ owner 2026-07-01 架构细化（拍板·压过契约 §2.2「搬进共享 index」原话）——游戏本地库 vendoring 模型**：
> - **共享库不被游戏直接引用**：外层 `assets/index.json`（3 万项 devicon/立绘货架）是**被引用/被 copy 的源**，不是游戏运行时直接引用对象。
> - **游戏只引自己的本地美术库/本地索引**（hermetic·目录安全干净）。游戏要用共享库资源 → **copy 进自己的本地美术目录**（vendoring），本地索引再引这份拷贝。
> - **② 的「收编 manifest」= 每游戏自持一份 `AssetIndex` 数据**（game-z 已如此·owner 认可我 §4.6 的偏离为正解），**不并入共享 index**。game-z 当前资产（程序化自产贴图 + 直接登记的 CC 模型）本就零依赖共享库 → 已满足此架构。
> - **⑤（新·real gap·接受·待消费者）vendoring skill**：把资源从共享库 copy → 游戏本地美术目录 + 补本地索引条目（携 usage/colorSpace/license/provenance）。**归属**：创作/构建期**工具**（`scripts/`·确定性·弱 LLM 可跑），**非 `src/skills` 运行时能力**（别误沉引擎）。**Lead 判定 YAGNI 不现在做**：当前零游戏消费共享货架，为无消费者的工具先造 = 过度设计。第一个"游戏要用共享库某资产"的真场景出现时再落。engine-core 域（跨共享库 + 各游戏本地库）→ 主程/Lead 把关（或照先例授权 P3D）。

> **owner 2026-06-30 拍板要 review + 提需求**：把「3D 美术资产（模型 / 材质 / 材质贴图）」**走和 2D 贴图完全同一条资产管理路线 —— 即 Resource 路线**：建**统一的资源目录结构 + 引用方法 + 消费端 + 共用数据端**。owner 原话：**「我们的引擎底端需要一个以 Resource 的控制」**。要 P3D 把需求扔出来给主程看。
> **详尽 review + 分期提案见** `docs/design/asset-pipeline-review.md`（P3D 2026-06-30 汇编·含现状逐类型对照 + 借鉴 Godot 的点）。
>
> **现状缺口（review 结论·摘要）**：
> - **2D 贴图**端到端已成熟（sniff→去重→归一化 `assets/index.json`→`registerAssetIndex` 桥接·带溯源）——**好底子·不推倒**。
> - **但运行时 `registerAssetIndex` 只桥 `texture`**（`asset-index.ts:152`）；`mesh` 走各游戏**手写 manifest 绕过索引**（`registerManifest(GAME_*_ASSETS)`）；`material` **写死在 `pbr-materials.ts`**；**材质贴图(albedo/normal/roughness)完全没管线**（owner 卡的「真实贴图」）。→ 只有 texture 一种数据端到端打通。
>
> **需求 = 建统一 Resource 层（借鉴 Godot「资产=Resource·每资产带导入描述·统一索引桥所有类型」·但作数据非搬编辑器/C++）**：
> 1. **共用数据端**：`assets/index.json` 成为**所有类型**的单一真相（texture/mesh/material/sound/font…）；`AssetIndexEntry.spec` 规范化**类型专属 import options（作数据·弱 LLM 可填）**——尤其**贴图 `usage`(albedo/normal/roughness/orm)+`colorSpace`(srgb/linear)**（法线图必须线性·设错渲染错）。
> 2. **目录结构**：`assets/{texture,mesh,material,sound,font}/<category>/<id>.<ext>`（导入器已按 `assets/<type>/<category>/` 归一化·把 mesh/material 纳入同结构·**收编各游戏手写 manifest 进索引**·模型也进统一溯源/许可/检索，现 fox.glb 只在 CREDITS）。
> 3. **引用方法**：sim/蓝图/组件**只持 key**（可哈希·render-only 消费）；`registerAssetIndex` 桥接**所有**类型（mesh→ModelPool·material→Material3D 数据·texture-map→材质贴图）；材质成**引 texture key 的资产**（取代硬编码预设 / 预设降为「内置材质 Resource」）。
> 4. **消费端（材质贴图·P3D 域·可先落）**：`Material3D.map/normalMap/roughnessMap`(=texture key) + 渲染器按 key + `colorSpace` 取 THREE.Texture 挂材质·与现程序化 `surface` 并存。**owner 授权 P3D 先做这半边**（同资产层跨界授权先例·纯 3D 渲染线 + 美术库数据·不动引擎核心索引）。
>
> **分期**（详见 review 文 §5）：① 材质贴图消费端(P3D 可独立) → ② `registerAssetIndex` 桥 mesh/material·收编 manifest(主程) → ③ spec 类型专属 options 定闭集 schema + 导入器扩 `.glb`/贴图 usage 自动猜(主程) → ④ 材质成索引资产 / sound·font 接入(按需)。
>
> **红线（守住·评审时校）**：① 资产是 render-only 表现层（sim 只持 key·不进 hash）；② 导入选项/材质/贴图用途**全是数据**（弱 LLM 尺子·别开自由代码口子）；③ 增量·向后兼容（现有 2D texture 路径不动）。
>
> **请主程/Lead 裁**：整套 Resource 层的引擎核心半边（②③④·动 `src/assets` 跨 2D/3D）该主程做，还是**授权 P3D 跨界落**（同 model-loader / 3D 碰撞先例）？消费端① owner 已授权 P3D 先做。

---

### REQ-UI-骰途逐像素 · LayoutNode 补 3 项通用能力（毛玻璃 / 衬线字体槽 / Image 透明度）· [2026-07-01] · P3D（game-d）→ 主程 · status: **✅ done（主程 2026-07-01·3 项全接受实现·`panel-glass-serif-opacity.test.ts`）** · 类型: UI 库闭集扩容（下沉成通用控件能力）

> **★ 主程裁决·3 项全接受（2026-07-01）**：均过尺子（真缺口·闭集/数字字段·跨游戏通用·PI 已先自我回驳能重组的）：
> - **① Panel 毛玻璃**：`PanelProps.glass?: boolean` → `backdrop-filter:blur(10px)` + 半透玻璃底（默认 `rgba(20,24,32,.5)`·要别的色调用 `bg` 传半透 rgba 覆盖）。与整屏 `Screen.blur` 正交（这是 per-Panel）。
> - **② Label 衬线槽**：`Label.font` 加 `'serif'` + `UITheme.fontSerif?`（缺省回退 fontUi·同 pixel/display 先例）。衬线标题 + 无衬线正文混排。
> - **③ 透明度**：下沉成**通用 `LayoutConstraints.opacity?`**（0..1·非数字回退 1）——比只给 Image 更一致（同 radius/rotate/scale 一族·任意节点生效·Image/装饰/剪影/水印用）。⚠️ 别用在正文文字（破对比·见 ui-playbook）。
> 落点 `types/render/catalog.ts`（catalog 收 serif/glass 闭集 → validate 自动拦拼写错·opacity 同 rotate lenient）。
> **④ Button 自由 bg/fg（owner 状态表列·不在本 REQ）→ 回驳/重组**：自由 hex 配色破「颜色=语义令牌·不收 raw hex」红线；且**可重组**——`Panel.action`+`bg`+`edge`+`radius` = 自定义配色的可点容器（带 Label 子）。真要「Button 形 + 精确色」再走 Label-size 先例的「语义档 | 精确值」，而非裸 bg/fg。

> **背景**：owner 要 game-d《骰途》2D UI（命运骰盅 / HUD / Title chrome）**逐像素复刻** Cloud Design 概念图，并拍板走 **A（扩 LayoutNode·不破 UI 铁律）**。我（P3D）对着原型逐项核对，**先自我回驳能重组的**，只把**闭集控件真表达不了的**提上来。三项都是**跨游戏通用**能力（非 game-d 私货）：
>
> **1. Panel 毛玻璃（frosted glass·backdrop-blur）**
> - 需求：HUD/骰盅面板浮在 3D 场景上时是**磨砂玻璃**（原型 `backdrop-filter:blur(8px)` + 半透底 + 细边）。现 `Panel` 只有实底/`bg`/`accent`，**表达不了 backdrop-blur**（`Screen.blur` 是整屏模糊·不同）。
> - 建议：`PanelProps.glass?: boolean`（或 `blur?: number`）→ 渲染加 `backdrop-filter:blur` + 半透底。**复用面**：所有「HUD/面板浮在 3D/大图之上」的游戏（game-d/i/z…）。
>
> **2. Label 衬线字体槽 + 主题 fontSerif 令牌**
> - 需求：标题/骰名用 **Noto Serif SC**（骰途 logo / 命运骰盅 / 骰名），正文仍 sans。现 `Label.font` = `ui|mono|pixel|display`，**无 serif**；把 `theme.fontUi` 设成 serif 会让**全部**文字变衬线。
> - 建议：`Label.font` 增 `'serif'` 槽 + `UITheme.fontSerif?` 令牌（缺省回退 fontUi）。同 pixel/display 先例。**复用面**：任何要「衬线标题 + 无衬线正文」混排的游戏。
>
> **3. Image 透明度（+ 可选 tint）**
> - 需求：塔剪影/装饰/暗态元素要**半透**叠加（原型 tower silhouette opacity .92、faded 元素）。现 `ImageProps` 无 opacity。
> - 建议：`ImageProps.opacity?: number`（0..1）。**复用面**：所有需要淡入装饰/水印/剪影的 UI。
>
> **我已自我回驳（不提·能重组）**：① 任意渐变底——`Panel.bg` 已收 CSS 串（我已用 `linear-gradient`）；② 折角布片——用「负 x/y + rotate 的定位 Panel」可拼；③ 倒角——已有 `chamfer`。
>
> **红线守住**：都是**闭集枚举/数字字段**（最弱 LLM 能填 `glass:true` / `font:'serif'` / `opacity:.9`），不开自由 CSS 口子。落地前 game-d 的 2D UI 维持「神似」，这 3 项下沉后即逐像素收口。

> **补充（2026-07-01·owner 反馈按钮颜色不一致）**：**4. Button 自定义配色**——原型 hero 键是确切 `linear-gradient(180deg,#ffd982,#f0a93a)` + 文字 `#3a2406`；现 `Button kind:'hero'` 是引擎固定金色样式（受 `theme.gold` 驱动·渐变/文字色写死）。要逐像素得让 `ButtonProps` 收可选 `bg`/`fg`（闭集：令牌或 hex 串，同 Panel.bg 先例）。暂用 `theme.gold` 调暖逼近。

### REQ-APOLLO-PROMPT-去手抄词汇表 · apollo.py 生成 prompt 改为全依赖自动 catalog · [2026-07-02] · 主程 → **指派：Opus** · status: **✅ 完成（2026-07-02）** · 类型: 防漂移收口
> 改动摘要（2026-07-02）：删 `GAME_GEN_SYSTEM_PROMPT` 手写「## Available Atom Components」整节（漂移源）+ 冗余 platformer 能力清单；词汇一律靠 `{CAPABILITY_CATALOG}` 注入。保留结构性指导（manifest 形状/最小可跑示例/art:约定/640x400 画布/纯 JSON），Rules 内组件名收敛到少量已核实真名（Camera/Mass/Bounds/Color）。`_FALLBACK_CATALOG` 12 条对照 registry 核实无漂移，加「部分应急词汇表·完整目录由前端注入」注释+prompt 文案。顺修 game-a 过期注释。tsc/vitest/build/ast 全绿。
> 病灶（2026-07-02 归档盘点核实）：`GAME_GEN_SYSTEM_PROMPT` 手写组件清单漂移——漏 Hierarchy/StringVariable/全部 3D 原子，却把非原子的 Controllable/Grounded/Bounds 列在 "Atom Components" 标题下；手写清单与 registry 必然持续漂移（capability-catalog.ts 头注早已声明此规律）。
> **实现 spec（Lead 已定）**：① 删 prompt 内手写组件/原子清单，词汇一律依赖 `{CAPABILITY_CATALOG}` 注入（buildCapabilityCatalog 自动派生·零 prompt 维护）；② 保留且仅保留结构性指导——manifest 形状、最小可跑 JSON 示例、`art:<关键词>` 资产约定、640x400 2D 画布约定；③ `_FALLBACK_CATALOG` 保留应急，但注释+prompt 文案标明"部分词汇，完整目录由前端注入"；④ 顺修 apollo.py:474 一带 game-a 过期注释；⑤ 验证 = `python3 ast.parse` 语法 + tsc/vitest/build 三门禁全绿（防连带），直推 mainbranch，完工回本条标 ✅。

### REQ-STUDIO-M0-库地基 · 创作台 v1（本地网页版）用户游戏库后端 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02）** · 类型: 产品化·新增（不碰引擎核）
> ✅ 完工摘要（2026-07-02·Opus）：`library/<slug>/{manifest.json,meta.json}` 约定 + 版本化（探测 git→每游戏独立 git 仓每存一提交；无 git→`snapshots/<ts>.json` 降级）落地，`library/` 进 .gitignore。apollo.py 加 7 端点：`GET /api/library`、`POST /api/library/create`、`GET/PUT /api/library/<slug>/manifest`（PUT 先跑校验后落盘）、`POST /api/library/install-sample`、`GET /api/library/<slug>/history`、`POST /api/library/<slug>/rollback`（新增 do_PUT + 可变状态码 _send_json；路径经 `_game_dir` 归一化 + slug 白名单双重防穿越）。校验闸门 `scripts/manifest-check.mjs`（vite-node 跑引擎真 parseManifest，零新依赖）+ vitest 用例 3 条；冒烟 `scripts/library-api-smoke.py` 14 检查全过（git+快照双模）。门禁 tsc+vitest(2101)+build+ast 全绿。**未碰 src/ 与 launcher.tsx**（前端接入 M1 另派）。
> 背景：owner 拍板把引擎包装成 To-C 创作产品（外部用户带自己 LLM key 产纯数据游戏、引擎只读封锁）。v1 形态=本地网页版（apollo.py 服务+浏览器）；本条=M0 库地基（后端），M1 卡带架/M2 向导另派。首页方案与里程碑全景见 owner 会话记录。
> **实现 spec（Lead 已定）**：
> ① `library/` 目录约定：`library/<slug>/manifest.json`（游戏唯一真相·纯数据）+ `meta.json`（name/subtitle/color/accentColor/icon/createdAt/updatedAt/provider）+ 版本化（git 可用→`git init`+每次保存 commit；不可用→`snapshots/<ts>.json` 降级）。**`library/` 加入 .gitignore**（用户数据不入引擎仓）。
> ② apollo.py 新端点（路径穿越防护照 `handle_asset_import` 模式，一切写操作严格限定 library/ 子树）：`GET /api/library`（列表：slug+meta+valid）；`POST /api/library/create {name, template?}`（slug 化去重+脚手架+git init 首 commit；template=preset 名则从 PRESET_BLUEPRINTS 拷）；`GET /api/library/<slug>/manifest`；`PUT /api/library/<slug>/manifest {manifest, note?}`（**先校验后落盘**：调 ③ 的 CLI 退出码 0 才写+commit，-m 取 note）；`POST /api/library/install-sample`（装官方示例卡带）；`GET /api/library/<slug>/history`（git log 或快照列表）；`POST /api/library/<slug>/rollback {rev}`。
> ③ 新建 `scripts/manifest-check.mjs`：node CLI，stdin 读 manifest JSON → 跑引擎 `parseManifest`（TS 执行方式施工者裁量：查 devDeps 现成 runner，vite 必在可用 vite-node；或其它零新依赖方案）→ error>0 则 exit 1 并打印错误清单（供回喂 LLM）。
> ④ 测试：manifest-check 配 vitest 用例（合法/非法 manifest）；apollo.py 端点写 python 冒烟脚本（起服务打请求，含 `../` 路径穿越必须 4xx 的用例）。
> ⑤ 门禁 tsc+vitest+build 全绿 + apollo.py ast 过，直推 mainbranch；**不碰 launcher.tsx / src 引擎域**；完工本条标 ✅。

### REQ-STUDIO-M1-卡带架接库 · 创作台 v1 前端：玩家模式 + 数据卡带运行器 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02·Opus·返修后）** · 类型: 产品化·前端（不碰引擎）
> ✅ **返修摘要（2026-07-02·Lead 验收打回 5 缺陷全修·真浏览器 E2E 15 检全过）**：①【致命】玩家模式 LAUNCH 无反应——根因=LibraryShelf 自拉 + launcher 另存一份**永远为空**的 libEntries（玩家模式 early-return 不拉）→ 点击查不到条目静默 no-op；修=library 列表收敛 launcher 单一数据源（两模式统一拉），LibraryShelf 改受控展示、操作条直接携带 entry 不再查旁路状态；**补 launcher 层集成测试 `src/launcher.player.test.tsx`（4 例·渲整个 Launcher 走真接线：空库欢迎态/上架→▶→canvas→返回/历史浮层可达/状态灯两态）防「单元绿集成断」复发**。②四键操作条补齐——`LibActionBar`（▶开始/✎继续创作/⟲版本历史/⤓导出 disabled）经 `CartridgeCarousel.renderLaunchArea` 在**架上**替代 library 卡带的单 LAUNCH 大按钮（内置卡带不变）；`VersionHistoryOverlay` 独立浮层从架上可达（列 entries·逐行回滚→刷新）。③状态灯误报——local(Ollama) 后端不需 key 恒 available=true≠真在跑；判定改**只计配了 key 的云 provider**（`LOCAL_PROVIDER_IDS` 排除·探活留 M3）。④页脚去手抄数字（26 Atoms/v0.6 过期口径→「Apollo Engine · 数据驱动 · Deterministic Lockstep」）。⑤console 404=浏览器自动请求 /favicon.ico（index.html 无 icon·M1 前就有）；修=data-URI favicon 一行。DataCartridgeRunner 简化为挂载即自动运行（loading/running/error 三态）。playwright-core 真浏览器旅程（vite+API 双活）：玩家模式→卡带→操作条→状态灯→历史浮层→▶canvas→返回架上 15 检 ALL PASS + 全程零 console error 零 4xx；dev 模式回归 7 检全过。门禁 tsc+vitest(2121/290 文件)+build 全绿。
> ✅ 完工摘要（2026-07-02·Opus）：玩家模式 `?mode=player`（隐藏内置 GAMES/DevTools/透视器/资源库入口，卡带架源=`GET /api/library`；空库=欢迎语「你的游戏架还是空的」+ 呼吸虚线「＋ 新建游戏」空卡位[160×240·prefers-reduced-motion 降级]+「⤓ 装入官方示例卡带」）；dev 模式现状不变 + 库卡带追加在内置之后。新建 `src/studio/library-model.ts`（纯：`metaToGameEntry` 缺省色兜底 #1e3a5f/#38bdf8·`libSlug` 分流·`providerStatus` 状态灯）+ `src/studio/DataCartridgeRunner.tsx`（`EmptyShelf`/`StatusLight`/`LibraryShelf`/`DataCartridgeRunner`——操作条「▶开始游戏[GET manifest→resolveArt→parseManifest→抽 StudioInspector 引擎生命周期全屏纯运行·左上返回架上] / ✎继续创作[开 GameCreator 预置游戏名] / ⟲版本历史[浮层列 history·逐行回滚] / ⤓导出 disabled」）。`launcher.tsx`：`CartridgeCarousel` 加 `games` prop（复用现有 `Cartridge` 视觉不改）、顶栏 API 状态灯（读 `/api/generate/providers`：任一 available→绿「已连接·<name>」/全无→琥珀「未配置 API Key」·纯显示）、`GameCreator` 加 `seed` prop。测试 3 组（happy-dom·`vi.stubGlobal` fetch）：meta→GameEntry 纯函数 9 例 + 空库欢迎态渲染「新建游戏」+ 数据卡带最小 manifest 无头挂载引擎 canvas 就位不抛错。门禁 tsc+vitest(2112)+build 全绿。**未碰 src/{engine,skills,assembly,renderer,ui,games}**（只读 import）。
> 前置：M0 ✅（library 七端点·校验落盘·git 版本化）。本条=首页方案（owner 已过目 mockup）的 M1 落地。
> **实现 spec（Lead 已定）**：
> ① **玩家模式**：URL `?mode=player`。玩家模式下内置 GAMES 与 DevTools 隐藏，卡带架数据源=`GET /api/library`；空库态=欢迎语「你的游戏架还是空的」+ 虚线呼吸「新建游戏」空卡位（点击→打开现有 GameCreator 面板，M2 再升级向导）+「装入官方示例卡带」次按钮（`POST /api/library/install-sample` 后刷新）。dev 模式（无参）一切照旧 + library 卡带追加显示。
> ② **library 卡带**：meta.json → GameEntry 映射（name/subtitle/color/accentColor/icon），**复用现有 Cartridge 组件不改视觉**。
> ③ **DataCartridgeRunner**：选中 library 卡带出操作条「▶ 开始游戏 / ✎ 继续创作（打开 GameCreator）/ ⟲ 版本历史 / ⤓ 导出（禁用占位）」。▶ = GET manifest → resolveArtRefs（照 openInStudio 流程 launcher.tsx:746-759）→ parseManifest → **全屏纯运行**（无检查器 chrome，左上「← 返回架上」）。⟲ = 浮层列 `GET history`，逐行「回滚」调 rollback 后刷新。
> ④ **顶栏 API 状态灯**：读 `/api/generate/providers`——有 key→绿「已连接·<provider>」，无→琥珀「未配置 API Key」（点击占位，M3 设置页）。
> ⑤ 约束：只动 `src/launcher.tsx` + 新建同层组件；**不碰 src/{engine,skills,assembly,renderer,ui,games}**（只读 import 允许）；视觉照 mockup。
> ⑥ 测试：happy-dom 无头用例——空库态渲染含「新建游戏」；meta→GameEntry 映射单测；DataCartridgeRunner 以最小合法 manifest 无头挂载不抛错。门禁 tsc+vitest+build 全绿直推；完工标 ✅。

### REQ-STUDIO-M2-创作向导与迭代回路 · 创作台 v1 灵魂件：说一句创意→卡带 + 对话式修改 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02·Opus）** · 类型: 产品化（apollo.py+前端，不碰引擎）
> ✅ 完工摘要（2026-07-02·Opus）：**① 创作向导**（新建 `src/studio/CreationWizard.tsx`·右滑面板·SHELL 令牌，与 M0/M1 壳层同风格）：玩家模式「＋新建游戏」（空架 EmptyShelf 大卡位 / 非空架显式按钮 / onNewGame 均入向导 create 态）→ 游戏名 + 一句话创意 + 当前 provider 显示 + 「开始生成」→ **预览试玩**（新增 `ManifestPreview` 复用 DataCartridgeRunner 的 `RunOnly` 运行核·**喂 manifest 而非拉 slug**）+「保存入库 / 弃掉重来」→ 保存 = POST create + PUT manifest{note:'初版生成'} → 刷架并选中新卡带（CartridgeCarousel 加一次性 `selectId`/`onSelected`）。**② revise**（handle_generate 扩 `mode:'revise'`：user 消息=`## Current game manifest\n<JSON>\n\n## User instruction\n<指令>\n\nOutput the COMPLETE revised manifest as pure JSON.`·仍注入 catalog 系统词）→ 「✎继续创作」玩家模式开向导 revise 态（拉当前 manifest + 版本数）·保存 PUT{note:指令摘要≤50}。**③ 服务端 autofix**：`/api/generate {autofix:true}` → JSON parse +（子进程）manifest-check 校验 → 失败把错误文本回喂当下一轮 user 消息重问 ≤3 次·返回 `{manifest, attempts, fixed_errors}`；耗尽→人话「换个说法」+ 可折叠原始错误；网络/传输错不重试网络层。autofix=False 保持旧 GameCreator 行为（单轮 + 软告警·不加硬校验闸）。**④ mock provider**（`APOLLO_MOCK_LLM=1` 才现于 providers·生产不可见）：generate 回内置合法 manifest（platformer 预设）、revise 对首个可见实体 Color.tint 做确定性染色、`APOLLO_MOCK_BAD_N=<n>` 前 n 次回坏 JSON 驱动 autofix。**LLM 传输层重构**：`_call_*`/`_do_llm_request`/`call_llm` 收敛成单一 `_provider_request(provider, api_key, model, system, messages)`（system+messages 多轮·mock 在此短路），autofix 多轮与单轮生成共用。**⑤ 全中文化**：玩家模式隐藏旧英文 GameCreator（dev 模式沿用不动·裁量），入口即向导。**验收**：`scripts/studio-m2-smoke.py` mock 全链路 16/16（autofix 恢复 attempts=3/fixed_errors=2·autofix 耗尽 attempts=3/fixed_errors=3·非 autofix 坏 JSON 即失败·revise 确定性改一处·mock 关闭不可见）；`src/studio/creation-wizard.test.tsx` happy-dom 4 例（create 生成→预览→保存 create+PUT·失败人话+原始错误折叠·autofix 提示·revise 全链路）；`scripts/studio-m2-e2e.mjs` playwright-core（executablePath→已装 chromium-1194·不进 package.json）真浏览器 **14/14 全过**（起服务→玩家模式→＋新建→填名+创意→生成→预览 canvas→保存入库→卡带上架→✎继续创作→指令→预览→保存→⟲版本历史≥2 条→回滚·**全程零 console error**）。门禁 tsc+vitest(2125/291 文件)+build+apollo.py ast 全绿；e2e 造的 `library/e2e-smoke-game*` 已清。**未碰 src/{engine,skills,assembly,renderer,ui,games}**（只读 import）。
> 前置：M0 ✅（library 端点）+ M1 ✅返修后（玩家模式/操作条/DataCartridgeRunner，真浏览器 9/9 验收）。
> **实现 spec（Lead 已定）**：
> ① **创作向导（右滑面板，照首页方案屏②）**：玩家模式点「＋新建游戏」→ 右滑面板：游戏名 + 一句话创意 + 当前 provider 显示 + 「开始生成」。生成走现有 `POST /api/generate`（前端带 catalog，现 GameCreator 同款）→ 得 manifest → **预览试玩**（复用 DataCartridgeRunner 运行态，带「保存入库 / 弃掉重来」）→ 保存 = `POST /api/library/create {name}` + `PUT manifest {note:'初版生成'}` → 刷新卡带架并选中新卡带。
> ② **对话式迭代**：「✎ 继续创作」→ 面板迭代态：显示游戏名+当前版本，输入修改指令（如「金币掉落改两倍」）→ apollo.py 扩展 `POST /api/generate` 支持 `{mode:'revise', current_manifest, instruction, catalog}`（prompt=系统词+当前 manifest JSON+指令，要求输出**完整**修改后 manifest 而非 diff）→ 校验 → 预览 → 保存 = `PUT {note:<指令摘要≤50字>}`（自动成为 git commit message，人话版本历史由此而来）。
> ③ **失败自动重试回路（落地 ai-dev-pipeline §7-5）**：重试在 **apollo.py 服务端**做——`/api/generate` 加 `{autofix:true}`：LLM 输出 → JSON parse + `manifest-check.mjs` 校验 → 失败把错误文本回喂 LLM 重问，≤3 次；返回 `{manifest, attempts, fixed_errors}`。前端显示「生成中…第 N 次自动修正」。重试耗尽 → 人话提示换个说法 + 可折叠查看原始错误。
> ④ **测试基建（关键裁量已定）**：apollo.py 加 `mock` provider（env `APOLLO_MOCK_LLM=1` 时可用）：generate 返回固定合法 manifest、revise 返回按指令做一处确定性修改的 manifest、可配置前 N 次返回坏 JSON 以测 autofix 回路——供冒烟与 e2e 全流程无 key 可测。
> ⑤ UI 全中文化（旧英文 Create Game 条替换为向导入口）；约束：只动 apollo.py + launcher.tsx/src/studio 组件 + index.html（如需）；**不碰 src/{engine,skills,assembly,renderer,ui,games}**。
> ⑥ 验收标准：冒烟脚本（mock provider 全链路含 autofix 触发）+ happy-dom 集成测试 + **playwright-core 真浏览器完整旅程必跑并贴结果**（新建→生成→预览→保存→上架→继续创作→修改→版本历史出现两条→回滚）。门禁 tsc+vitest+build 全绿 + apollo.py ast；直推；完工标 ✅。

### REQ-STUDIO-M3M4-设置页与体检 · 创作台 v1 收尾：BYO key 设置 + 卡带体检 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02·Opus）** · 类型: 产品化（apollo.py+前端，不碰引擎）
> ✅ 完工摘要（2026-07-02·Opus）：**① M3 设置页（BYO key）**：新建 `src/studio/SettingsPanel.tsx`（右滑面板·SHELL 令牌·与 M2 向导同风格）——顶栏状态灯（`StatusLight` 加 `onClick`）点开；provider 列表**千问排第一**（qwen→anthropic→deepseek→openai 兼容→ollama[标「本地·免 key」]，mock 仅 env 开时追加），每项 API key 输入（type=password·打码占位）+ model 下拉（用 GET 返回 models）+「测试连接」+「设为默认」。存储：apollo.py 加 `GET/PUT /api/settings` 读写仓库根 `.apollo-config.json`（**已进 .gitignore**·结构 `{providers:{<id>:{apiKey?,model?}},default?}`·进程内缓存·PUT 后失效重读）；`get_api_key` 优先级改 **config > env > .env**；GET 打码字段 `apiKeyMasked`=前3位***尾4位（短 key 全星号·**绝不回传原文**·测试断言 raw key 不泄漏）；PUT 只在前端 dirty 项才送 apiKey（未改动不覆盖·空串=清除）。`POST /api/settings/test {provider}`：mock→立即 ok / local→探 Ollama `/api/version`（2s 超时）/ 云 provider→当前生效配置发 `max_tokens=8` ping（`_provider_request` 加 max_tokens 参）→ `{ok,error?}`。**状态灯增强**：config 配了云 key 也算「已连接」——`get_available_providers`/`get_api_key` 已把 config 计入，保存后前端 bump `providersRefresh` 重拉即转绿（M1 只认 env）。**② M4 体检**：薄 CLI `scripts/bench-manifest.mjs`（vite-node·照 manifest-check 模式）stdin 读 manifest → parseManifest → 跑引擎真 `benchBlueprint`（src/bench/apollo-bench.ts·120 tick 五轴 Structure/Load/Determinism/Numeric/Visual·阈 70）→ stdout `{score,pass,threshold,axes,spatial,evolves}`（build() 每次从原始 JSON 文本重解析产全新蓝图·保证 determinism 两跑独立）；`POST /api/library/<slug>/bench` 起该 CLI 子进程（60s 超时）透传；`LibActionBar` 加「🩺 体检」→ 新 `BenchOverlay`（DataCartridgeRunner.tsx）浮层显五轴分条 + 总分/100 + 及格线 70（≥70 绿/<70 琥珀·列各轴中文名+分+notes）。**验收**：`scripts/studio-m3m4-smoke.py` mock 全链路 24/24（settings 写→GET 打码 CON***1234→优先级 config 盖假 env→model-only PUT 不动 key→test mock ok/未配置 provider 报错/未知 provider 报错→config 云 key 令 providers.available=True→install-sample bench 出五轴满分 pass=True/threshold=70/未知游戏 404→`.apollo-config.json` git 忽略断言）；`src/studio/settings-panel.test.tsx` happy-dom 4 例（千问第一/打码占位/local 免 key·填 key→测试连接先 PUT 仅 dirty 送 apiKey 再 test·体检浮层五轴+及格线·bench 失败错误态）；`scripts/studio-m3m4-e2e.mjs` playwright-core 真浏览器 **13/13 全过**（点状态灯→设置面板开→千问第一→mock 行填 key→测试连接 ok→关面板→架上中心卡带 🩺 体检→五轴浮层出分/100·**全程零 console error**·造的 config+库数据已清）。门禁 tsc+vitest(2129/292 文件)+build+apollo.py ast 全绿。**未碰 src/{engine,skills,assembly,renderer,ui,games,bench}**（bench CLI 只读 import apollo-bench/manifest）。
> 前置：M0-M2 全部 ✅（真浏览器验收）。本条两小件合并施工，完成即 v1 功能完整。
> **M3 设置页（BYO key）spec**：
> ① 顶栏状态灯改可点击 → 设置面板：provider 列表（**千问排第一**·anthropic/deepseek/openai 兼容随后·ollama 标「本地·免 key」），每项可填 API key + 选 model；「测试连接」按钮 → 新端点 `POST /api/settings/test {provider}`（用当前配置发最小探活请求；mock/ollama 特判）。
> ② key 存储：新端点 `GET/PUT /api/settings` → 写仓库根 `.apollo-config.json`（**必须进 .gitignore**；结构 `{providers:{qwen:{apiKey,model}}, default:'qwen'}`）；`get_api_key` 优先级改 **config > env > .env**；GET 返回 key 一律打码（前缀+尾 4 位），前端永不回显完整 key。
> **M4 体检按钮 spec**：
> ③ 操作条加「🩺 体检」→ 新端点 `POST /api/library/<slug>/bench`：薄 node CLI（照 manifest-check.mjs 模式，vite-node 跑）把 manifest → parseManifest → 喂 `src/bench/apollo-bench.ts`（先读其真实入口签名）→ 返回 `{score, axes, pass}`（及格线 70）；前端浮层展示五轴分。
> ④ 测试：settings 冒烟（写→读打码→优先级 config>env→测试连接 mock）+ bench 冒烟（sample manifest 出分）+ **playwright 真浏览器旅程贴结果**（点状态灯→设置面板→填 mock key→测试连接→体检→五轴显示）。门禁 tsc+vitest+build+ast 全绿；直推；完工标 ✅。
> 约束：apollo.py + src/studio/** + launcher.tsx + .gitignore；**不碰 src/{engine,skills,assembly,renderer,ui,games}**（bench CLI 只读 import 现有模块）。

### REQ-PLAYBOOKS-十线手册 · 按 playbooks/index.md 起草各生产线接线图手册 · [2026-07-03] · 主程 → **指派：Opus** · status: **✅ done（Opus 2026-07-03）** · 类型: 文档（工作流基建）

> **✅ 完工（Opus 2026-07-03）**：11 本已就位（35–41 行/本·均 ≤80）。**3d.md 由 P3D 抢先提交（域主，字段级更精准），我 defer 保留其版、不 clobber**；余 10 本（ui/rendering-fx/movement-pathfinding/events-logic/combat/cards/randomness/assets/audio/save-platform）为本次交付。ui.md 做薄壳指向 ui-playbook + 只补引擎接线（LayoutNode→mountUI→ActionSink→Signal·UI_CATALOG·coachmark/onboarding-overlay·/check-ui）。一次性核对（我的 10 本）：**48 能力 id 全 grep 命中（`id:'x'`@src/skills）· 53 路径全 test -e 命中 · 84 符号全命中（27 个组件在 component-map，余在 src/）· 零缺失**。docs-only·tsc --noEmit 退出码 0。
> **写作中发现的「手册答不上=待评审缺口」（如实上报）**：① **口径漂移**——spec/CLAUDE.md 写「game-e 1163 行手写 React 反面教材」+「68 张数据小丑」均已过期：game-e 现无 .tsx（React 屏已移除、view.ts 仅 75 行）、joker-catalog.ts 现为「全 150 张」。按「不手抄数字」铁律我未写死数字，ui.md 反面教材改指 game-f.tsx（970 行冻结手写 React·真实存在）+ 注 game-e 旧屏已移除。② **能力 id 不在 capability-registry.ts**——spec 第 3 条要求「id 在 capability-registry.ts 或 component-map.ts grep 得到」，实际 registry 只 import 变量名（`diceRollCapability`）不含 id 字符串（`t2-dice-roll`）；id 真相在各 skill 文件 `id:'…'`（= CAPABILITY_REGISTRY 的 key）。我据此把核对靶改为 src/skills（更准），组件名仍核 component-map。③ `condition` 非 capability 而是复用纯函数模块（`src/skills/tier2/condition.ts`），events-logic.md 已按「被 event-when/flow 复用的 ConditionExpr」表述、未虚构 id。以上三点建议主程回填 spec/llm-onboarding §4 数字口径。
> 背景：owner 拍板建立「先查手册后动手」工作流（防 game-d Title/HUD 式绕基座）。立柱已就位（`docs/playbooks/index.md` 总目录+铁律+角色名录，CLAUDE.md 已设开工必读铁律）。本条=起草 10 本线手册。
> **spec（Lead 已定）**：按 index.md 表格逐本写 `docs/playbooks/{ui,rendering-fx,3d,movement-pathfinding,events-logic,combat,cards,randomness,assets,audio,save-platform}.md`（11 个文件，ui.md 做薄壳指向 ui-playbook+补引擎接线：mountUI/ActionSink/Signal/coachmark）。每本铁规：①≤80 行；②索引式五段结构=「做 X→能力**实名**（对照 capability-registry 逐个 grep 核实存在）→样例指针（registry examples / 正样例游戏文件路径，须真实存在）→本线红线→查不到怎么办(requests.md)」；③**不手抄字段表/数字**（指向机读真相）；④正样例引用：game-e 计分核（cards）、game-g lobby 六屏+sfx（ui/audio）、game-i（ui）、game-g clash/dice 族（combat/randomness）、M0-M2 创作台（save 线可引 library 版本化）；⑤红线必含：randomness=裸 Math.random 禁令、ui=手写 DOM 禁令、3d=P3D 域边界（引 P3D-game-z-handoff §0.1）。
> 验收自证：写个一次性核对脚本（或命令序列）证明——手册里出现的每个能力 id 都能在 capability-registry.ts grep 到、每个文件路径都存在；报告贴核对输出。docs-only 提交，tsc 抽查即可；直推 mainbranch；完工标 ✅。

---

## 🆕 design G 战斗心流/数值线 REQ（2026-07-01 合并入主干）

> design G 分支并入。以下 game-G REQ 承接「掷战力骰 + 战斗心流 + 数值理论」线（详 `design/theory-numbers-and-flow.md` + `IMPL-PLAN-combat-flow.md`）。
> **⚠ 与既有 REQ 的两处交叠（待 owner/各 session 对齐）**：
> - 本组 `REQ-G-英雄专属战术牌+改掷层` = 上面 `REQ-G-即时法术/功能牌` 的**完整设计版**（同"功能牌>战斗牌"方向）→ 两者应合并·以 `hero-signature-cards.md` 为准。
> - 本组 `REQ-G-起手源泉`（6→**4**·design G 2026-06-23）vs 上面 `REQ-G-战斗公平与顺序回合 ①`（6→**3** + 双方摸3·2026-06-28）→ **数字待 owner 定**（4 或 3·都双方对称）。
> - 团队更名：以下条目里的「甲」= 现 **程序A**（逻辑）·表现/演出归 **程序B**。
### REQ-STUDIO-DESIGN-设计先行创作流 · 创作台主工作流升级：讨论→分解→对齐→定稿→原型 · [2026-07-03] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-03·Opus）** · 类型: 产品化（apollo.py+前端，不碰引擎）
> ✅ 完工摘要（2026-07-03·Opus）：**① design 目录端点**（apollo.py）：`GET /api/library/<slug>/design`（树+内容 `{files:{rel:内容}}`）、`PUT /api/library/<slug>/design/<path>`（仅 .md·写后 commit·note 可选）。路径防护 `_valid_design_relpath`=后缀白名单(.md)+每段字符白名单 `[A-Za-z0-9._-]`+形状白名单（顶层 `<name>.md` 或 `systems/<name>.md`·深度≤2）+`_write_design_file` 归一化后再断言在 design/ 子树内（纵深）；`_list_library` 加 `hasDesign`。**② /api/generate 四新模式**（复用 autofix 骨架·校验器各异）：`design-chat`（无状态·前端带全 messages·system=引导四问[类型与参照物/核心循环/胜负与进程/内容规模]·够料回复带机器可测标记行 `[READY_TO_BREAKDOWN]`→服务端剥标记+回 `ready` 布尔）；`design-breakdown`（讨论纪要→严格 JSON `{files:{pitch.md,systems/*.md,content.md,capability-plan.md}}`·`_parse_design_files` 校验 JSON 形状+文件名白名单+至少 pitch/capability-plan·失败走 autofix 式回喂重问≤3·成功一次落盘+单 commit "design breakdown"·capability-plan 对照注入 catalog 标 ✅现有/⏳缺口）；`design-revise`（`{file_path,current_content,instruction}`→修订全文·`_strip_fence` 去围栏·前端拿到再 PUT）；`prototype`（服务端从磁盘读该 slug 的 design 全文拼 GDD→manifest·走既有 `_generate_with_autofix` 硬校验回路）。**③ 前端**：新建入口双选卡 `EntryChoice`（🗣 设计一个游戏[推荐]/⚡ 快速生成→旧 CreationWizard）；`DesignStudio.tsx`（全屏·讨论态[游戏名+聊天窗+分解按钮 ready 后可用]→目录浏览[左树右文·每篇「改这里」走 design-revise→PUT]→顶部「设计定稿→生成原型」→复用 M2 `ManifestPreview` 预览→保存 PUT manifest{note:'原型生成 v1'}）；已有 design 卡带「✎ 继续创作」→ `ContinueChoice`（📐改设计[开 DesignStudio initialSlug]/🎚快改数值[M2 revise]）。launcher 线 `hasDesign` 分流。**④ mock 扩展**（`APOLLO_MOCK_LLM=1`）：design-chat 第二轮 user 起带标记；breakdown 出固定小 GDD（投骰子比大小系统·capability-plan 标 ✅w1-random ✅t2-dice-roll ⏳t9-best-of-series[假想]）；prototype 出合法 manifest；`APOLLO_MOCK_BAD_N` 对 breakdown/prototype 同生效（产 JSON 的模式才注坏 JSON·chat/revise-text 不注）。**验收**：`scripts/studio-design-smoke.py` 41/41（design CRUD+路径攻击 5 类全 4xx+四模式+breakdown/prototype 坏 JSON 重问+文件名白名单单元+hasDesign）；`scripts/studio-design-e2e.mjs` playwright 真浏览器 **19/19**（双选卡→设计工作台→填名→讨论两轮 ready→分解→左树 4 文件→改一处对齐[内容变化+commit 数增]→定稿生成原型 canvas→保存入库上架→history 含设计类 + 原型 commit·**全程零 console error**）；`src/studio/design-studio.test.tsx` happy-dom 4 例（双选/继续双选/全链路/继续已有 design 直进目录）。门禁 tsc+vitest(2134/293 文件)+build+apollo.py ast 全绿。**未碰 src/{engine,skills,assembly,renderer,ui,games}**（只读 import）。
> owner 拍板：主创作流从「一句话生成」改为**设计先行**——输入是游戏策划案（或从讨论窗开始构想对齐），AI 分解成 game design 目录，反复对齐细节玩法，定稿后才生成原型。一句话生成降级保留为「⚡ 快速模式」。渊源=ai-dev-pipeline 六段 [1]Brief[2]Spec 的产品化 + capability-plan 闸门进 To-C 流程。
> **实现 spec（Lead 已定）**：
> ① **design 目录**：`library/<slug>/design/{pitch.md, systems/<系统名>.md, content.md, capability-plan.md}`——与游戏同库同 git（设计文档版本化免费）。新端点 `GET /api/library/<slug>/design`（树+内容）、`PUT /api/library/<slug>/design/<path>`（仅 .md·路径防护照 manifest 模式·写后 commit）。
> ② **/api/generate 四个新模式**（复用 autofix 骨架，校验器各异）：`design-chat`（{messages[]} 多轮构想讨论；system=引导四问：类型与参照物/核心循环/胜负与进程/内容规模；够料主动建议「可以分解了」）；`design-breakdown`（讨论纪要或策划案 → JSON {files:{path:content}} 生成 design 目录；**capability-plan.md 须对照注入 catalog 标注 ✅现有能力/⏳缺口**）；`design-revise`（{file_path, current_content, instruction} → 修订全文）；`prototype`（{design_files} → manifest，走既有 autofix 校验回路，生成主输入=GDD 全文）。
> ③ **前端双模式**：创作入口选「🗣 设计一个游戏（推荐）」/「⚡ 快速生成」。设计模式=讨论窗（聊天 UI）→「分解成设计稿」→ design 目录浏览器（左树右文·逐篇「改这里：」输入=design-revise·每轮 commit）→「设计定稿→生成原型」→ 接 M2 既有预览/保存/迭代。原型后小改走 M2 revise，大改引导回设计层。
> ④ **mock provider 扩展**：design-chat 脚本化两轮后建议分解；design-breakdown 输出固定小 GDD（≥1 系统+capability-plan 标 2 现有 1 缺口）；prototype 输出合法 manifest——全流程无 key 可 e2e。
> ⑤ 验收：冒烟（design 端点+路径防护+四模式 mock）+ **playwright 完整旅程贴逐步结果**（讨论两轮→分解→目录 4 文件→对齐改一处→定稿→原型 canvas→保存入库→history 含设计 commit）；门禁 tsc+vitest+build+ast 全绿；直推；完工标 ✅。
> 约束：apollo.py + src/studio/** + launcher.tsx；**不碰 src/{engine,skills,assembly,renderer,ui,games}**。

---

### REQ-CAP-三件下沉 · modifier-stack / timeline / save-port（owner 2026-07-03 全批）· 主程出图 → **指派：Opus** · status: ✅ **done（2026-07-03·Opus·三件各自提交全绿直推）** · 类型: 引擎 capability 下沉（正确性关键）
> 出处：底座终审 §二🔴。三件按序施工、各自独立提交、**每件落地同提交回填对应 playbook**（手册铁律）。开工前按 CLAUDE.md 查 wiki/skills 对应篇（serialization/animation/scene-management/math-utils 按需）。
>
> **件① `t2-modifier-stack` 修正聚合栈（最难，先做）** — ✅ **done（2026-07-03·Opus）**
> - 完工：`src/skills/tier2/modifier-stack.ts`（纯函数核 `aggregateModifiers` + Update 系统 + `modifierCtx` 复用 condition.ts 求值器）；组件 `ModifierSource`/`ModifierTotals` 入 logic.ts + component-map 闭集；registry 注册 + t2-stats 注记「待迁·记债」。测试 `modifier-stack.test.ts`（14 例·含三套表达力夹具 + 缺口钉死）。回填 combat.md。门禁 tsc+vitest(2156)+build 退出码全 0。
> - **表达力验收结论**：地煞 DishaFx（sum/max/or）**完全可表达**；天罡 TengangFx（add 累加 + powerMulHighest 取大）**完全可表达**；小丑计分：静态 add/mul + hand_contains 门控（→gate）+ valueFrom（Banner/Bull）+ countTag（→group-count 物化）**可表达**。**表达不了（v2 输入·已测钉死差异）**：① 顺序交织（×mult 先于 +mult）——相位聚合 add 全先于 mul，≠ effect-apply 逐条顺序结算（留在 effect-apply/card-scoring）；② 概率门（Bloodstone 1/2 ×1.5）——gate 只吃确定性 ConditionExpr、无 num/den 掷（留在 effect-apply.chance）；③ 非线性 econ（interest=floor(money/5)×v）——valueFrom 只有线性 ×scale、无整除。
> - 裁决：不扩 t2-stats（实体属性向，表达不了字段表+合并策略+门控），新建通用件；t2-stats 原样不动、registry 注记「待迁 modifier-stack」记债。
> - 组件（进闭集）：`ModifierSource`（数据行数组：`{id, target:string(字段id), op:'add'|'mul'|'max'|'min'|'or'|'floor', value?:number, valueFrom?:{resourceId,scale?}, gate?:ConditionExpr(复用 tier2/condition.ts), order?:number}`）+ `ModifierTotals`（系统写：`{totals:{[target]:number|boolean}}`）。
> - 双形态（照 dice.ts 先例）：纯函数核 `aggregateModifiers(rows, ctx)`（确定性：order→id 排序；应用序固定 add→mul→max/min→or→floor→clamp，对齐 clash-resolve 已文档化的 pEff 序；ctx 提供 resource/flag 读取器供 valueFrom/gate）+ Update 相位系统（收集实体上全部 ModifierSource→写 ModifierTotals）。
> - **表达力验收（硬门槛）**：测试夹具用三套真实词汇各抽 ≥6 条改写——game-e 小丑行（jokers.ts:90-170 的 add/mul×chips/mult/money+countTag+门控）、game-g TengangFx op（game-g-build.ts TENGANG_OPS 已实装 18 op 抽样）、game-g DishaFx+DISHA_MERGE（sum/max/or 策略）——逐条断言聚合结果与原实现语义一致；**表达不了的如实列在报告里**（那是 v2 输入，不许硬凑）。
> - 回填 `docs/playbooks/combat.md`。**不碰 src/games/**（e/g 的迁移由各域 owner 另立 REQ）。
>
> **件② `t3-timeline` 演出时间线** — ✅ **done（2026-07-03·Opus）**
> - 完工：`src/skills/tier3/timeline.ts`（确定性 tick 调度器·runsAfter event-when/keybind/clickable）；组件 `Timeline`/`TimelinePlayback` + `TimelineCue`/`TimelineCueDo` 入 logic.ts + component-map 闭集；tier3 index + registry 注册。测试 `timeline.test.ts`（7 例）。回填 events-logic.md（加「演出时序」节 + flow vs timeline）。门禁 tsc+vitest(2165)+build 退出码全 0。
> - cue 四闭集 do：signal（发 Signal 带 arg·新建瞬时实体）/ flag（写 Flag 按 id）/ resource（写 Resource·op add/set·钳）/ spawn（发 SpawnRequest·prefab 展开）。瞬时实体单调 seq id、下一 tick 本系统开头回收（无泄漏）。**绝不走墙钟**（游标按 tick）。
> - **skipOnSignal 终态一致性测试结果**：钉死通过——「起播后逐 tick 播到底」vs「起播后 skip 一 tick 补发剩余」vs「同拍起播+skip」三路终态**完全一致**（r=10, f=true, g=true）。快进按 at 升序补发 → 直写 cue 终态全在持久 Flag/Resource、可比、相等。
> - 裁决：sim 侧确定性调度器，**tick 制绝不走墙钟**（lockstep 红线）；cue 的效果=发 Signal（带 arg）/写 Flag/写 Resource/发 SpawnRequest 四种闭集动作，表现层（UI/渲染）订阅信号自行演——timeline 管"何时"，tween 管"怎么动"，互不越权。
> - 组件：`Timeline`（`{cues:[{at:number(tick), do:{kind:'signal'|'flag'|'resource'|'spawn', ...}}], playOnSignal:string, speed?:number, loop?:boolean}`）+ 运行态 `TimelinePlayback`（系统写：`{t, playing}`）；播完发 `timeline:done:<id>` 信号。支持 `skipOnSignal`（确定性快进：一次 tick 内按序补发全部剩余 cue，回放安全）。
> - 参照需求（只读参考勿改）：game-g 演出编排 game-g.tsx:433-533（banner→cue→掷骰→结算时序）、game-d 骰壳转场（refcode 03 评估）。examples 至少给「回合开场三连 cue」+「转场」两个可抄 manifest 片段。
> - 回填 `docs/playbooks/events-logic.md`（加"演出时序"节）。
>
> **件③ SAVE-PORT 存档端口（本地+网络）** — ✅ **done（2026-07-03·Opus）**
> - 完工：`src/services/save/`——`save-port.ts`（SavePort 接口 + SaveEnvelope/SaveMeta/SaveCodec/SaveMigration 类型）、`envelope.ts`（sealEnvelope/openEnvelope/computeChecksum/CorruptSaveError·信封核心）、`memory-save-port.ts`、`local-save-port.ts`、`bridge-save-port.ts`（BridgeSavePort + FileSavePort/CloudSavePort + SaveFileBridge + createMemoryFileBridge）、`index.ts`。测试 `envelope.test.ts`(11) + `save-port.test.ts`(16·happy-dom·四后端同契约)。回填 save-platform.md。门禁 tsc+vitest(2192)+build 退出码全 0。
> - **信封/迁移/坏档测试结果（真实现真测·全绿）**：① round-trip：seal→open 还原 data 原样；② checksum 损坏报错不静默——篡改 data/checksum/savedAt/schema 任一 → `CorruptSaveError`；③ schema 迁移链 v1→v2→v3（每版差异=一个 SaveMigration 步·归纳 game-g-save 内联迁移）→ 旧档链式升级；缺步→报「迁移链断裂」；env.schema 高于当前→拒绝降级；gameId 串档→报错；④ checksum 确定性（规范化·字段序无关）。
> - **裁量决定**：(a) 四后端共用 `BridgeSavePort`（File/Cloud 只换桥），去重。(b) **FilePort 真桥留 TODO**（electron preload contextBridge 暴露 fs·无头不可测）→ 用 `createMemoryFileBridge` 测契约（已绿）；文件头注明真桥接线路径。(c) **CloudPort 复用 services/storage 既有 `SteamCloudBridge`**（含 `createMockSteamCloudBridge` 假后端·无真账号全链路可测·已绿），非空实现。(d) **未做可选件 `t2-save-trigger`**（YAGNI：当前无消费方·无 SaveSlot 需求；信封+端口已是完整下沉·薄能力件待真需求拉动再立，避免过度设计）。
> - 裁决：**服务+端口形态**（照 services/audio SynthAudioPort、services/platform 先例），非重能力：`src/services/save/`——`SavePort` 接口 `{list(), read(slot), write(slot, envelope), remove(slot)}`；三后端：`LocalStoragePort`（web）、`FilePort`（electron/掌机，经现有平台桥）、`CloudPort`（挂 services/platform 的 Steam 云存档既有钩子）。
> - **版本化信封（引擎强制）**：`{schema:number, gameId, savedAt:tick或外注时间戳, checksum, data:unknown}`；读到旧 schema 走游戏注册的 `migrate(from,to,data)` 链（照 game-g-save.ts 既有迁移写法归纳成通用签名）；checksum 不符→报坏档不静默。
> - 能力层薄件 `t2-save-trigger`（可选做，若做：`SaveSlot` 组件+收 `save:<slot>`/`load:<slot>` 信号→经 port 存读声明的 Resource/Flag 集）；确定性注意：savedAt 时间戳由宿主注入不由 sim 取墙钟。
> - 参照（只读）：game-g-save.ts（迁移先例）、game-f account.ts（META 形状）、platform-hooks.ts（云钩子）。回填 `docs/playbooks/save-platform.md`。
>
> 每件：registry 注册（守护测试会强制）+ describe 达标（summary/whenToUse/≥2 examples）+ 测试对齐 skills 1:1 文化 + 门禁全绿分件直推。


## —— 2026-07-03 主程清池追加（作废 / 冻结 / 完结归档）——

> 主程清池手术（owner 指示：久置需求直接清）：以下条目从主池 `requests.md` 移出。**作废/冻结** 条目盖章说明；**完结（done/结案）** 条目保原状归档。查旧单先 grep 本文件。

### REQ-ARCH-SAVE · [2026-06-21] · program G 乙（owner 2026-06-21 钦定 · 存档持久化 + 云存档服务）· 框架级 · status: **open** · 优先级: 中 · 类型: 真缺口（持久化/同步=易错基础设施·过弱-LLM 尺子·≥多游戏拉动）
> 【作废 2026-07-03·主程清池（owner 指示：久置需求直接清）】原因：已被 save 端口下沉取代（302b196f·2026-07-03）

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

### LEAD→PG · [2026-06-18] · Game G · status: **open（可选迁移，game-g 自决）** · 类型: 通用能力已就绪 → 可选去腐
> 【作废 2026-07-03·主程清池（owner 指示：久置需求直接清）】原因：超两周无认领·owner 清池令（可选迁移·game-g 自决·无动静）

**能力已落 mainbranch（`f78ee97`）**：render-only **`Mesh3D`** 通用「3D 物件即数据」原语 —— `shape:box|plane` + 尺寸 + `frontTint/backTint/edgeTint` + `flipAxis`（翻面复用 `Transform.rotation`）。引擎通用 `ThreeRenderer` 即可把它渲成真盒/薄片、翻面、与 2D `Renderable` 同场混排；`frame-svg` 翻面感知正交投影（无头 golden）。纯表现、不进 sim/hash。

**可选交办（game-g 自决，不强制）**：`game-g/three-renderer.ts`（364 行）里**通用的那半**（Scene/相机/灯光/BoxGeometry/mesh 同步/相机自适配）可改为复用引擎 `Mesh3D`/`ThreeRenderer`——把牌**描述成 `Mesh3D` 数据**，删掉手写 Three.js 基建，趋近「游戏是数据」。**边界（务必守）**：game-g 的**牌面纹理（faceTexture/backTexture）+ 抛飞/相撞/逐路揭晓编排（pairKey/side/clash/marchScreenPos）= 你的私货 juice，留 game-g**，不下沉。即「通用几何/材质/翻面用引擎，专属皮与编排自己叠」。

**为何标可选**：现 `Card3D` 工作正常，迁移收益=减手写 Three.js（非 bug 修复）；且 Lead 不替 game-g 改游戏渲染（lane 红线）→ 由 program G 自评取舍。

### REQ-024 · [2026-06-21] · PA · Game A · status: open · 优先级: P2 · 类型: 真缺口（effect 无法驱动"已存在实体"的物理动作）
> 【作废 2026-07-03·主程清池（owner 指示：久置需求直接清）】原因：消费方游戏已删除（game-a）

**标题**：`effect` 缺"施加冲量 / 注入动作" —— 协作里"A 命令 B 原地起跳 / 被弹射 / 被推一格"组合不出

- **想实现的游戏行为**：双人切换协作解谜中，A 对另一角色 B 下指令让 B 做出**物理动作**（原地起跳越缝、被机关弹射、被推一格）。蹲下/待命（`effect set-state`）、开火（`caster`→`prefab`+`launch` spawn 新弹体）都已能纯数据做；差的只是"让一个**已存在**的实体获得速度/冲量/动作"。
- **已经试了什么**：`keybind`(键→Signal) → `effect-apply`(targetEntity:B)。但 `effect.kind` 仅 set-flag/modify-resource/set-state/set-sensor/set-visible(-tagged)/destroy(-tagged)/reset-timer —— **无一能写 Velocity 或注入 Action**。`jump` 能力要 `Action{name:'jump'}`+`Grounded`，却没有"信号→给某实体挂 Action"的数据通路；`launch` 是自带组件的投射物机制、且 effect 不能"加组件"；`caster` 只能 spawn 新实体、不改 B。
- **卡在哪 / 缺什么**：信号无法对**已存在**实体施加速度/冲量/动作 → "命令 B 真起跳/被推/被弹"表达不了。（纯展示可用 set-state 换"跳跃姿势"顶替，但无真实位移。）
- **建议方案**：`effect` 增 kind **`apply-impulse`**（对 `targetEntity` 的 `Velocity` 叠加 `{vx?,vy?}`，可 valueFrom 资源）或 **`inject-action`**（给 `targetEntity` 挂 `Action{name,value}`，复用 jump 等既有消费者）。最小、与 jump/launch/velocity 链对齐；"信号→现有实体动起来"一通百通（命令 B、机关弹射、击退）。
- **优先级 P2**：协作"指令 B 物理动作"的通用前置；**不阻塞当前**（蹲下/待命/开火/单人切换都不需要它）。按"落地不口头"back up 入池。

### REQ-F-062 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open（Lead 打回细化，暂不实现——见评判）** · 优先级: 低-中 · 类型: 真缺口（aggro 索敌策略不可选，只能最近）
> 【冻结·随 game-f 判决重开（owner 2026-06-25 冻结令）·主程清池 2026-07-03】

**标题**：aggro 索敌策略（最远 / 最高威胁 / 最低血，非只最近）

- **想实现**：刺客绕后锁后排、狙击锁最高威胁、嘲讽——玩家卡牌「绕后奇袭」+ 太阁 Boss 政宗/岛津。
- **卡在哪**：`src/skills/tier3/aggro.ts` 写死 `nearestByTag`；`Perception` 只有 targetTag/sightRadius，**无策略字段**，数据层无开关。
- **建议**：`Perception.policy?: 'nearest'|'farthest'|'highestStat'|'lowestHp'`（缺省 nearest，向后兼容）+ spatial-query 加对应变体（沿用 id tie-break 保确定性）。不改语义、不动定序。
- **Lead 评判（打回细化，暂不实现）**：① 核心 policy enum（nearest/farthest/lowestHp）确是真缺口（`aggro.ts` 写死 nearest、`Perception` 无策略字段）；但 ② **「嘲讽」不属本能力**——嘲讽是**目标侧**强制他人改指向，`Perception.policy`（攻击者侧）实现不了张飞嘲讽，混入是误判，须另案（目标侧机制）；③ **「最高威胁 highestStat」欠定义**——项目无"威胁"Resource，缺 stat 来源字段；④ **未被真实数据拉动**——关羽斩杀/张飞嘲讽仅在设计稿 HTML，实装数据零引用。按「不为想象需求拓宽引擎」（REQ-023 同纪律）**暂不实现**；待真实单位钉死具体策略需求，再落 nearest/farthest/lowestHp（嘲讽另案）。

### LEAD→PF · [2026-06-14] · Game F · status: **⏸ 大部 done·余暂挂（game-f 暂停开发）** · 类型: 去腐交办（game-f 程序→数据）
> 【冻结·随 game-f 判决重开（owner 2026-06-25 冻结令）·主程清池 2026-07-03】

> game-f 曾是"在数据里编程"(2658 行·生成器 56 处·脉冲标记 114)。去腐进度：
> - ✅ 脉冲清零(114→0)、band/visSwap/chrome 展平(byte 等价)、商店卡/名牌从 ROSTER 派生。
> - ⛔ makeRoundFlow/templatesFor 字面化 **回驳**(薄确定性展开器·"数据驱动≠零函数")；脉冲下沉成引擎能力 **回驳**(单游戏臃肿勿注入共享引擎)。
> - ⛔ ②「game-f.tsx→完整 GameShell」**owner-overridden 暂挂**(撤 GameShell/canvas 并存·保留手写 DOM HUD)；`GAME_F_UI` 蓝本留作参考。Lead 已加通用 GameShell `image` 节点(非 game-f 下沉)。
> - 余 blueprint→manifest 全量展平(低优先)。game-f 暂停 → 整体搁置。详情见 git。

### BUG-G-源泉徽标 · [2026-06-21] · owner→game-g 乙（甲代登记·勿越界）· status: **done（乙回滚·见下方 commit）** · 类型: 表现回滚

> owner playtest：战场源泉变成右上角水滴，要回旧版底部横条 water bar。乙 revert `3791fcde` 对 `turn-battle-screen.ts` 的源泉段(恢复 waterBar/waterCap/waterTube·删 fontBadge)。详情见 git。

### REQ-ARCH-COACH · [2026-06-21] · design G（owner 2026-06-21 钦定 · 引擎通用新手引导）· 框架级 · status: **done（表现层·Lead `ac64e1c1`·design G 验收 PASS 2026-06-21）** · 优先级: 中 · 类型: 真缺口（仅表现层）+ 重组（逻辑层·无需引擎）

> 新手引导 = 数据表(步骤/锚点/文案)，引擎固定 coachmark 渲染器解释。✅ Lead 落表现层最小包(`ac64e1c1`)：`Coachmark` render-only 组件 + `renderer/coachmark.ts`(纯·7测) + `ui/onboarding-overlay.ts`(DOM·覆盖两套UI) + GameShell `UINode.anchor`(`data-anchor`)。逻辑层(首次/步骤/seen/点对)=游戏侧重组(flow+flag+save)，不提需求。完整案 `docs/design/onboarding-coachmark-capability.md` + 清单 `game-g/design/DEV-CHECKLIST-onboarding.md`。详情见 git。

### REQ-E-022 · [2026-06-18] · PE（Game E 小丑牌）· status: **done（引擎+接线 2026-06-18）** · 类型: 真缺口（poker-eval 缺 isFlush/isStraight 派生事实）

> `PokerHand.isStraightFlag?/isFlushFlag?` 派生事实（同 rankMaxCount 族）→ 解锁 Crazy/Droll/Devious/Crafty/The Order/The Tribe（可玩 25→31）。详情见 git。

### REQ-E-021 · [2026-06-18] · PE（Game E 小丑牌）· status: **done（引擎侧 2026-06-18）** · 类型: 真缺口（逐张计分读不到「牌自带的修正」）

> `Card.mods?:{op,target,value}[]` + `Card.retrigger?`（per-card 附魔/红蜡封）；card-scoring 逐张循环套用。架构裁决：不扩成通用 Buff 抽象（语境=循环本身·避 inner-platform）。详情见 git。

### REQ-F-065 · [2026-06-17] · 策划 PF（装备 atk·owner 钦定路A）· status: **done（引擎侧 2026-06-17）** · 类型: 真缺口（per-unit 异质缩放）

> `scaleByResource` 先查施法者本地资源再回退全局（补 `SpawnRequest/PrefabOrigin.source` 源 threading）→ 装备 atk 逐单位异质生效、退星级模板族爆炸。详情见 git。

### REQ-F-061 · [2026-06-13] · 主策划（Game F）· status: **done（2026-06-13）** · 类型: 真缺口（hitbox 缺血量条件门+处决）

> `Hitbox.requireHpFracBelow?/requireHpFracAbove?/executeBelow?`（命中那刻读目标 hp 比例做 gate/斩杀·乘法比较保确定性·零迁移）。详情见 git。

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


## —— 2026-07-04 主程清池复核批（★ 清单裁决：结案 / 作废 / 粘连拆出）——

### REQ-UI-Gemini评审 · [2026-06-26] · Lead 评审（UI 库域·外部 Gemini code review 收敛） · status: **部分 done（C2/C3 已实现）· 余回驳/记录** · 类型: 架构评审收敛
> 【结案 2026-07-04·主程清池复核】C2/C3 done·A1/A3/C1/C4 回驳有记录·A2 备案（真实用例出现再提新单）。无剩余动作。

> 外部 Gemini review 7 条，Lead 以宣言尺子收敛：✅ **C2**(样式注入硬化·`num()`+anim 白名单·XSS 测) + **C3**(焦点丢失·`patchFocusedInput` 就地覆写不重建) 已实现。🟡 **A2**(bind fast-path) 记录待用例。❌ 回驳 **A1**(弃 CSS flex 改 JS 绝对定位=倒退)、**A3**(FSM 承载手势·时序态已在解释器·YAGNI)、**C1**(拆判别联合类型·毁数据契约)、**C4**(actionArg Record·现做法更干净)。详情见 git。

---

### REQ-025 · [2026-06-25] · PA · 双人合作平台跳跃（上100层/冲100米）· status: open · 优先级: P1 · 类型: 真缺口（effect 无法改碰撞体 Shape + 命令模型无蹲下输入）
> 【作废 2026-07-04·主程清池复核】无立项消费方（未指名游戏·非出口 D/G）；新游戏一律先过 capability-plan（2026-07-02 铁律）——真要做时随 plan 重提，所涉缺口（碰撞体可变 Shape/蹲下输入）届时一并评审。

**标题**：缺"蹲下钻缝"能力 —— `effect` 写不了 `Shape`、命令模型没有蹲下输入

- **想实现的游戏行为**：双人闯关里角色**蹲下**缩小碰撞体，钻过低矮缝隙/在低天花板下通行（合作解谜常用：A 蹲下当矮台阶 / B 蹲身钻过 A 撑开的缝）。这是用户点名要的技能之一。
- **已经试了什么**：① 动画/姿势用 `set-state`→`AnimState` clip="crouch" 可做（纯表现，OK）。② 但要真正"钻低缝"必须**缩小碰撞箱高度**。全库只有 `gauge` 在运行时写 `Shape.width`（血条专用、按 Resource 比例、每帧覆写，不能复用）；`effect-apply` 的 `writes` 是 Flag/Resource/State/Sensor/Visibility/Destroy/Timer/RandomSeed —— **没有 `Shape`**；`Effect.kind` 也无写 Shape 的项。`Transform.scaleY` 能改但碰撞读 `Shape.height` 不读缩放（facing 正是靠这点：scaleX 不影响碰撞）→ 缩 sprite 不缩碰撞箱。③ 命令模型 `Command.move{dx,dy}+jump`（commands.ts）**没有蹲下输入**，KeyMap 也无。
- **卡在哪 / 缺什么**：没有"信号/状态 → 改某实体 `Shape.height`"的数据通路；也没有蹲下这个输入意图。
- **建议方案**：① `effect-apply` 增 `Effect.kind:'set-shape'`（写 `targetEntity` 的 `Shape.height/width/radius`，把 `Shape` 加进 effect-apply 的 writes）——与 `set-sensor` 同类、整数字段、确定性安全。蹲下即纯数据：蹲键→condition→ 两个 Effect（`set-state "crouch"` 给动画 + `set-shape height:15` 缩碰撞）；松开复原 height:30。② 命令模型/KeyMap 加"蹲下"意图（或约定 `dy:1`=蹲下，让数据逻辑读）。**一个注意点**：低天花板下松开蹲下会把人顶穿——只在头顶净空时才复原（用 sensor/overlap 条件判，纯数据可表达，非第二个引擎特性）。
- **优先级 P1**：上100层/冲100米的"蹲下"技能前置。**不阻塞主体**（爬塔用 boost 当协作核心；蹲下能力到位后再接）。按"落地不口头"back up 入池。

---

### REQ-G-诅咒地煞 · [2026-06-21] · design G → 甲 · Game G · status: **⏸ 暂缓（owner：诅咒先不做·关5 改用 bossFavorBias/bonusMana 杠杆）** · 优先级: P3（备案）
> 【作废 2026-07-04·主程清池复核】被 REQ-G-地煞新op #4 吸收（intimidate 与 curse/bounce 同族·该单 spec 已注明「甲可一并参数化实现 mode: bounce vs intimidate」）；owner 暂缓原判保留·随该单复活，不必单独挂池。

> Boss 被动「诅咒」(每 N 回合 bounce 玩家随机兵)：真缺口但与 `batteryEveryTurns` 同构、可加同类新 op。备案暂不实现。数据形 `{kind:'curse',op:'bounceUnit',everyTurns,mode,pick}`；接入清单见 `boss-config-1-5.md §七`。

---

### REQ-G-说明同步 · [2026-06-21] · design G → 乙（菜单/帮助屏域） · Game G · status: open · 优先级: P2（玩家可见·信息已过期） · 类型: 表现层（文案同步·数据已在 doc26）
> 【作废重开 2026-07-04·主程清池复核】战斗模型大改中（三行为/碰撞才战斗/退役机关门/起手源泉），doc26 将随之重写——现在同步帮助文案=做两遍。心流 Phase 收口后按新 doc26 一次做对，届时 design G 重开新单（本单 4 点清单可作底稿）。

> **owner 2026-06-21「更新下游戏说明」**。design G 已更新设计源 `doc26 玩法手册`；**但游戏内帮助中心文案是 `lobby-overlays.ts · helpBox` 写死的（乙域）·已过期** → 派乙照 doc26 同步：
> 1. **掷命对决**（helpBox 中级 L31）补 **🪙 战胜硬币（留场续攻）**：赢一场后抛币——**人面=留场乘胜追击 / 字面=回牌库+返半费**（你按钮亲掷·敌方自动·投掷后才揭晓）。
> 2. **❗事实错误（helpBox 高级 L48）**：「Boss 库=**12 随机天罡**+3 地煞」→ 改 **「16 扑克 + 5 天罡 + 3 地煞」（写死·与你 16+5 对称）**。
> 3. 补 **👁 Boss 牌面板**：战场顶部能看 Boss 的 3 地煞 + **5 天罡明牌 + 缩略牌组（点开放大看 16 兵牌）+ 手牌**（明牌可破=counter-pick 核心）；后期「迷雾」地煞会盖暗。
> 4. **放牌按点数收费**（中级 L30）可补一句：2-4 免费 / 5-7=1 / 8-10=2 / JQKA=3。
> **乙只改 helpBox 文案**（菜单屏域）；战斗屏面板本身=甲（`REQ-G-Boss牌面板`）。doc26 为准。

---

### REQ-UI-Label深色令牌(ink) · Label.color 补一个「深墨」语义令牌（金/亮底上的深字）· [2026-07-01] · P3D（game-d Title hero 键）→ 主程 · status: **待主程** · 类型: UI 库闭集扩容（语义令牌·非 raw hex·合 manifesto）
> 【结案 2026-07-04·主程清池复核】已落地：`'ink'` 入 Label.color 闭集 + `UITheme.ink`（types.ts:116/:493·守护测试 `req-webfont-ink.test.ts`·随 REQ-UI-web字体 ③ 同批 2026-07-02）。剩 game-d 一行切换（`gd-start-t` 的 TODO(REQ-UI-ink)）=P3D 域·已并入 REQ-GAMED 接线单顺手带。
>
> **场景**：`Panel.action + bg:'linear-gradient(#ffd982,#f0a93a)'` 拼的金色 hero 键（「开 始 攀 塔」），原型文字是**深墨色 #3a2406**（金底上深字=高对比高级感）。现 `Label.color` 闭集 `text|sub|dim|jade|gold|ok|warn|danger|mine|foe` **全是亮/彩色，没有深色**——金底上只能放亮字，对比弱、发糊，逐像素还原不了。
>
> **回驳过自己（不走 raw hex）**：不是要 `color:'#3a2406'`（破「颜色=语义令牌」红线）。要的是**一个语义令牌** `'ink'`（深墨·= `theme.ink`，缺省回退很深的 `bg0` 或专设 `#2a1c0a` 级）→ 加进 `Label.color`（及 `spans.color`）union + `UITheme.ink?`。同 pixel/serif/mine/foe 先例（闭集加档·弱 LLM 只在闭集里选）。
>
> **复用面**：任何「深字压在金/亮/暖底」的 CTA / 徽标 / 高亮块（不止 game-d）。**当前 game-d 用 `color:'text'` 亮字临时顶（见 `gd-start-t` 的 `TODO(REQ-UI-ink)`），令牌到位即切 `'ink'`。**

---

### REQ-G-Boss-AI · [2026-06-21] · design G → 甲（引擎域·AI） · Game G · status: **✅ 实装+sim验证（2026-06-23·甲 commit 4c8b9d6e+aa8728c1）·待接真 loader 重标** · 优先级: **P0（解锁整个公平难度模型）** · 类型: 真缺口（Boss AI 太弱）
> 【结案 2026-07-04·主程清池复核】核心 AI 缺口已闭合（两层实装+sim 验证·难度旋钮复活）。两条活尾由他单接管：(a) 强玩家 sim=REQ-G-Player-AI（in-progress·P0-TOP），(b) 真 loader 重标=design G 标定线（IMPL-PLAN-combat-flow）。

> **✅ design G 2026-06-23 验收**：甲改进后重扫 `simulate-balance.ts`（N=500）——**两层都忠实实装**：① 公平·公开盘面反应式启发（防漏路回防/趁势压优势路/疾行驰援·全档生效·零 per-boss 代码）；② 信息不对称 `foeIntel`（读玩家手牌+牌库顶3张预读·**仅 aiTier≥3 启用**·关3-5）·正合 `boss-ai-spec.md` 难度阶梯。
> **效果**：关1（aiTier=1·仅靠①层·不读手牌）WR 从坏态 ~96-100% → **新手 76%**；**难度旋钮复活**（bossDelta 0→76%·+6→54%·+12→37%·旧坏态对旋钮免疫）→ 整个公平难度模型解锁。
> **剩余**：(a) 待 `REQ-G-Player-AI` 强玩家落地后 sim 才完全可信（现玩家仍贪心）；(b) 待接真 loader（我更新的 boss-config：favorBias0/源泉4/主将3命/破家回库/16写死牌组）后 design G 重扫定稿 98%→60% 曲线。**核心 AI 缺口已闭合。**

> **owner 公平性原则 + design G sim 实证**（详 `design/balance-philosophy-fairness.md`）：难度只能来自明牌地煞·禁止偷源泉/暗数值。但 sim 镜像测试发现根因——**Boss AI 太菜**：
> - 纯镜像（双方同牌组+天罡+地支·都贪心）→ 玩家 **52.8% ≈ 50%**（战斗公平 ✓）。
> - 同配置但 Boss 用现 utility-AI(aiTier5) → 玩家 **82.5%**（AI 同牌也输 82.5%）。
> **派甲（P0）**：强化 `aiTakeTurn` utility-AI 到 ~玩家水平：① 不被"贪心铺最便宜兵+推进"白嫖压制（学会铺场/卡位/集中突破）；② 守势 boss 也要会抓机会反推、威胁玩家家（现在守势 boss 永远威胁不到玩家·只能拖）。**修好前**所有关卡只能靠偷资源造假难度（owner 已禁）→ 这是平衡模型的总开关。
> 修好后 design G 用**纯明牌地煞**重标 98%→60%(前10关) 难度曲线·全公平。

---

### REQ-BASE-引擎卫生三件 · tray 补注册+守护测试 / Card3D 清遗 / view.ts 死码删 · [2026-07-03] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-03·Opus）** · 类型: 引擎卫生（零风险）
> 【归档注 2026-07-04·主程清池复核】本单登记时误粘在 REQ-G-碰撞才战斗「程序B 待做」行尾（行内粘连），复核时拆出归档；正文逐字保留如下。
> ✅ 完工摘要（2026-07-03·Opus）：**① t2-tray 补注册**：`trayCapability` 入 `capability-registry.ts`（tier2 分组·drag-place 之后）→ 自动进 `buildCapabilityCatalog` 词汇表（describe 质量达标·无需补）。新增守护测试 `src/assembly/registry-guard.test.ts`：`import.meta.glob(['../skills/**/*.ts','!*.test.ts'])` 扫全部 skill 模块 + 鸭子判定 CapabilityDefinition（id/version/describe/components/systems），断言每个 id 都在 ALL_CAPABILITIES；带「glob 非空跑」下限（>70·防路径写错=假绿）。**自证**：临时从数组撤掉 tray → 测试红、点名 `t2-tray`（tier2/index.ts + tray.ts 两处），恢复即绿。**② Card3D 清遗**：全库 grep 证零消费（仅 component-map 闭集 + render.ts 接口自身+注释；game-g 三渲已删 `three-renderer.ts` 不存在）→ 删 `render.ts` 的 `Card3D` interface + `component-map.ts` 的 import/闭集条目 + `renderer/index.ts` 过期注释；顺带清 `render.ts` Mesh3D 注释里对 Card3D 的悬挂引用。（game-g/blueprint.ts:11「均删见 git 史」是 PG 私档历史注记·不越界动。）**③ game-e view.ts 死码删**：`buildGameEView` 全库仅 `view.test.ts` 自引用 → 删 `view.ts`+`view.test.ts`+ barrel `export * from './view.js'`。删后 game-e 引擎触点收敛为纯计分链（cardScoring/pokerHand/effectApply/eventWhen/flag/resource/stringVariable）——视图带来的 transform/sprite/**frame(l3-frame)**/text 视觉原子不再被 game-e 消费（如实化评审所指）。门禁 tsc+vitest(293 文件/2134 例)+build 退出码全 0·直推。
> 出处：底座终审 `docs/design/base-capability-review-2026-07-03.md` §二⚙️。
> spec：① **t2-tray 补注册**：`src/skills/tier2/`（tray 相关 capability 对象）加入 `capability-registry.ts` ALL_CAPABILITIES（对照现有条目风格）；**加守护测试**：扫 `src/skills/**` 全部 `defineCapability` 导出，断言每个都在 ALL_CAPABILITIES（防再漏，放 assembly 层测试）。② **Card3D 清遗**：从 `component-map.ts`/`components` 闭集移除已退役的 Card3D（先全库 grep 证零消费再删；renderer/index.ts 里的过期注释一并清）。③ **game-e view.ts 死码删**：`src/games/game-e/view.ts`（buildGameEViewBlueprint 全库零调用，评审两度点名）删除 + 其 import 清理；若有引用它的测试一并删。
> 门禁 tsc+vitest+build 全绿直推；此活涉引擎域（registry/component-map），属主程授权的引擎卫生，照 spec 严格执行不越范围；完工标 ✅。

---

### REQ-PA-文档一致性五件 · PA 自查清单 Lead 裁决 · [2026-07-04] · PA 提报 → 主程裁决 → 指派：PA · status: **✅ done（PA `de8e1827`·Lead 验收 REVIEW: PASS 2026-07-04）** · 类型: 防漂移整改（PA 自查·全收）
> **Lead 验收（2026-07-04·复核 diff + 独立复跑 guard/门禁全绿）**：①② 快照标注+机读指针完全照裁决修法（未追手抄精确数·「现约 4.9k / 约 3 万」量级词不会漂）；④ assets.md 批量入库行落位·脚本名核真·「加一个包=加一条 PACKS 配置」措辞还顺手强化了数据驱动口径；⑤ 头注改准（curl 出口面与工具层发现面分开说清）。**零偏差**。唯一瑕疵=忘翻工单状态，本行由 Lead 代关。
> **Lead 裁决（2026-07-04·五条全收·PA 报告质量嘉奖——含自曝，正是要的审计文化）**：
> ① `docs/design/art-library-tags.md` 数字陈旧（4761 vs 实际 4892）· ② `art-library-handoff.md` 顶部总数自漂（29818 vs 30588）——**病根=手抄会动的数字**（机读真相铁律）。修法不是改数字：**改为「快照 YYYY-MM-DD」标注 + 一句「实时数以 `FreeArtLib/index.json` 为准」**；分类占比等分析性数字保留但一律挂快照日期。
> ③ 「PA」双义（asset-flow 的 PA=游戏创作者 vs 名录 PA=资产管理员）——**Lead 已亲改三处**：requests.md 池头术语注、asset-flow.md 标题与导语、CLAUDE.md 核心规则 2 措辞；历史条目不追改（池头注兜底）。
> ④ `docs/playbooks/assets.md` 缺批量入库线——**接受回填**（手册铁律：手册对产出负全责）：加一行「批量灌入共享货架 → `scripts/import-art-pack.mjs` / `import-emoji.mjs` → 登记 FreeArtLib index」+ 指向 PA handoff 细节。
> ⑤ `import-art-pack.mjs` 头注「仅 GitHub 可达」过时——PA 域脚本注释，顺手改（属 PA 例行维护，非「写代码」红线范畴）。
> 附思考：①② 这类数字漂移 docs-ref-guard 管不了（它只核路径）；**先用「快照标注」约定治本**，若再犯 ≥2 次，再议给 art 文档加核数脚本（数字 vs index.json 计数），现在不建（YAGNI）。

### REQ-QA-测试审计强化三件 · audit 分层判词 / bench p99+delta / 测试代码体检 · [2026-07-04] · 主程（CCGS 深读采纳·见 reference §八） · status: **✅ done（Opus 2026-07-04·门禁全绿 tsc/vitest 303f-2231t/build 均 0）** · 类型: 质量工具强化
> **spec（Lead 图纸）**：① `scripts/game-skill-audit.mjs` 输出分层：**红=已破不变量**（裸 Math.random/innerHTML/自写解释器）·**黄=缺失防线**（零测试/零能力接入/未登记），末行判词 token `AUDIT: PASS|WARNINGS|FAIL` + 对应退出码（0/0/1）。② ApolloBench 帧时轴补 **p99/max 判定**（均值绿尖峰红=CONCERNS·超标帧按帧号点名）+ 同场景 **prior 结果留档做 delta 回归行**（改善也记录）。③ 新脚本 `scripts/test-hygiene-check.mjs`：扫全部 `*.test.ts` 的真时间等待（墙钟 setTimeout/sleep/Date.now）、外部 IO（真 fetch/http）、裸 Math.random；**白名单放行有意用例**（fake timers/mock 合法）；判词 token+退出码。准则出处 `docs/playbooks/testing.md` 红线节。门禁全绿直推；涉 `src/bench`（主程域）按本 spec 施工不越范围。
>
> **✅ 完工摘要（Opus 2026-07-04）**：
> - **① `scripts/game-skill-audit.mjs`**：三层分类——🔴红（裸 Math.random/innerHTML/createElement 手写 DOM，进判词）· 🟡黄（零能力接入/零测试，进判词）· ⚠建议（既有 nakedFill 裸 bg 色，非红线·不进判词·不改退出码，予以保留）。末行 `AUDIT: PASS|WARNINGS|FAIL`；退出码 红→1、黄/绿→0。判词=任一红→FAIL / 无红有黄→WARNINGS / 全清→PASS。**「自写解释器」为人审项（capability-plan 评审）——合法小枚举 switch 与真绕引擎解释器无法可靠 regex 分辨（见 game-e/jokers.ts 经济结算 switch），不列自动红旗以免误报，已在脚本头注明。** 当前全库判词=FAIL（8 款游戏均有 createElement 等既有欠账·符合 engine-llm-readiness-review 记录，工具如实点名）。
> - **② ApolloBench 帧时轴**（`src/bench/apollo-bench.ts` 加纯函数 `computeFrameStats/measureFrameTime/frameTimeDelta` + `run-bench.ts` 接线）：墙钟测量每 tick，报 mean/p99/max，**均值绿而 p99/max 尖峰超预算（默认 1000/60ms）→ CONCERNS 并按帧号点名**；prior 留档 `bench-results/frame-times.json`（**gitignore**·墙钟按机器波动不入库），次跑出 **Δmean/Δp99/Δmax 回归行**（↑退化/↓改善/≈持平·改善也记录）。**确定性 hash 逻辑与五轴打分完全未动**（帧时独立墙钟维度·不进 total/退出码）。判词样例：`PASS game-f — mean 0.41ms · p99 1.77ms · max 2.20ms`；`Δp99 ↓改善 2.75ms → 1.77ms (-35.8%)`。
> - **③ 新 `scripts/test-hygiene-check.mjs`**：扫全部 `src/**/*.test.ts` 三禁（真时间等待/外部 IO/裸随机），白名单顶部数组注理由；自动豁免 fake timers·mock fetch。末行 `HYGIENE: PASS|WARNINGS|FAIL`+退出码（硬违规→1）。**存量违规清单**：仅 2 处裸 Math.random——(a) `src/skills/tier3/roster-round.integration.test.ts:258` 只作唯一实体 id、非测随机 → **顺手改确定性单调计数器 `reqSeq++`**（已修）；(b) `src/debug/debug.test.ts:70` 故意非确定的 test-flaky capability（被测对象就是 Math.random 制造的非确定，用于验 Recorder 抓非确定回放）→ **白名单放行**（换种子=去掉被测特性）。无真时间等待/外部 IO 违规。首跑收口=WARNINGS（仅 1 白名单例外）。
> - **点名测试**：`src/bench/apollo-bench.frame.test.ts`（7 例·合成数组测 p99/max 判定·尖峰点名·delta 三向·空输入·真引擎 measure）；roster 修改由既有 12 例覆盖仍绿。三工具均自证运行输出见上。

### REQ-DOCS-指针守护脚本 · 角色卡/手册/白皮书引用的路径·脚本名·agent 名自动核真 · [2026-07-04] · 主程（CCGS 参考 §七 裁决） · status: **✅ done（2026-07-04·Opus 施工·全套门禁绿）** · 类型: 防口径漂移基建
> 源起：CCGS skill 测试框架思想采纳（`wiki/skills/reference-claude-game-studios.md §七`）——工作流零件也要可测。capability 层已有 `registry-guard.test.ts`，文档层缺同款。
> **spec（Lead 图纸）**：`scripts/docs-ref-guard.mjs` 进 vitest：扫 `docs/roles/**` + `docs/playbooks/**` 里的 ①反引号包裹的 `docs/`/`src/`/`scripts/` 路径（存在性）②`scripts/*.mjs|py|sh` 脚本名（存在性）③agent 名（对照 `.claude/agents/*.md`）。白名单机制放行有意的示例路径（如模板占位符）。红=指哪个文件哪一行断了。本次角色卡验收人肉核了 58 处，固化成机器活。
>
> **✅ 完工（Opus 2026-07-04）**：
> - **落点**：`scripts/docs-ref-guard.mjs`（守护脚本·纯 node/fs·`node scripts/docs-ref-guard.mjs` 直跑）+ `scripts/docs-ref-guard.test.mjs`（4 例行为契约·含失败路径·随 `npx vitest run` 跑）。判词 `DOCS-REF: PASS|FAIL` + 退出码；红行格式 `<file>:<line>  \`<ref>\`  → <原因>`。
> - **扫描面（比 spec 略扩）**：`docs/roles/** + docs/playbooks/** + docs/qa/**`（qa 层 2026-07-04 新立·同属工作流零件文档，一并纳入）。检 ①路径引用前缀 `docs/`·`src/`·`scripts/`·`wiki/`·`.claude/`（存在性，含 `.claude/agents|skills` 路径=agent/技能存在性兜底）②agent/技能裸名近似拼写（对照 `.claude/agents/*.md` 去 .md + `.claude/skills/*/` 目录名，编辑距离=1 报错字/改名残留，精确命中放行）。修饰剥离：`path:line`、空格分隔的 `§x`/`L76`、`path/**`·`foo-*.mjs` glob、`src/{a,b}` 花括号展开、`a·b` 中点连写。
> - **白名单**：**0 条**。占位符（含 `<` `>` `YYYY` `xxx` `[category]`）走自动规则放行；显式白名单数组（顶部·带理由字段）当前为空——现 3 树内全部真路径引用都实指存在文件，无「规范外的有意示例路径」需登记。
> - **断链发现清单（本单主要价值）**：**0 处真断链**——264 路径引用全部命中真文件、agent/技能名近似检测 0 命中。首跑唯一红点 `src/{engine 非 assets,skills,games 逻辑}`（`docs/qa/specs/asset-manager.md:8`）经核**非断链**：是散文里花括号未闭合的口语化标注、非真路径 → 修的是**检测器**（未闭合花括号 fragment 略过），未动文档。另修正初版误判：`scripts/dist.py`·`scripts/*-smoke.py`·`scripts/studio-*` 等一度被当「CCGS 侧示例·Apollo 无此文件」入白名单，实测这些 `.py` 脚本**真实存在**（早前 `ls *.mjs` 过滤漏看）→ 已移出白名单、由存在性检查自然放行。**留给 Lead 裁的项：无**。
> - **门禁**：`tsc --noEmit` 0 · `vitest run` 0（302 files / 2228 tests）· `npm run build` 0。
