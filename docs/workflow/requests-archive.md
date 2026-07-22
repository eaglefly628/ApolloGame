# requests.md · 已完结条目归档

> 由主程 2026-07-03 归档手术生成：完结（✅/wontfix）条目全文移入本文件，活跃/排队条目留在主池。查旧条目先 grep 本文件。

### REQ-AIGEN-软件内文本生成资产 · Tripo(3D)+千问/Seedream(2D) 接入创作台 · [2026-07-04] · owner 拍板 → PA 建生成框架(资产侧) · status: **✅ done（owner 2026-07-22 拍板「标记已完成」；Lead 归档腾槽）** · 类型: 新能力(外部 AI 服务·表现层旁路)

> **⚖ Lead 结案摘要（2026-07-22·owner「REQ-AIGEN 文本生成资产 这个标记已经完成」）**：AIGEN 核心愿景（软件内自然语言 → 生成资产：3D=Tripo·2D=千问/Seedream）已端到端打通并经 owner 真机验证：
> - **框架**（PA·`scripts/ai-gen.mjs`+`.test.mjs`）：厂商无关适配器注册表 + mock 合法资产 + 连库 + provenance + 真调门控 + `providerSettings()`——mock 全链绿。
> - **运行时 UI + 设置 UI**：已随 Workshop（`workshop/index.dc.html` 素材屏详情卡）+ T1/T2 端点建成（key 设置在木纹工坊设置屏·数据驱动 genKeys/genOptions）。
> - **Seedream 真调落地（owner 07-21 美术主力·本 session 打通）**：`ai-gen.mjs` seedream 适配器（火山方舟 `images/generations` 同步调）+ `config.py` GEN_KEY/GEN_OPTIONS（模型 ID 自由填·免硬编码漂移）+ `t2_replace.py`/`assets.py`/`art-replace.mjs` 全链接入 + row.orig 快照（还原不丢原图）。**owner Mac 真机确认生成成功**（曾遇 ModelNotOpen=账号侧未开通模型·owner 开通 `doubao-seedream-5-0-pro-260628` 后通）。
> - **真 key 前置**：已解除（owner 已购火山方舟 key 并真机跑通）。
> **遗留（不阻塞本单结案·如需单立）**：Seedance(文生视频)/NanoBanana/PixVerse 仅有 key 槽、无真实 adapter 装配——非本单「文生图/文生 3D 资产」核心愿景所需（视频线是另一族 provider）；owner 若要接视频线再单开工单。qwen 2D、tripo/meshy 3D、seedream 2D 三线已真实装配。

> **owner 愿景**：软件内用自然语言描述 → 生成资产（3D 用 **Tripo**·2D 用 **千问/DashScope 万相**），落进资产库。先 mock 打通全框架。
> **PA 已交付（资产侧·`scripts/ai-gen.mjs` + `ai-gen.test.mjs`·mock 全绿）**：厂商无关生成框架 = 适配器注册表（`tripo` 文本→glb·`qwen` 文本→png）+ mock 产合法资产（glb/png·prompt 播种）+ **连库**（落 `assets/index.json` 或游戏本地 `art/index.json`·带 provenance 厂商/prompt/模型/mock/日期）+ 真调门控（fetch Tripo v2 openapi / DashScope 万相·密钥走 env `TRIPO_API_KEY`/`DASHSCOPE_API_KEY`·**绝不入库**·本环境 GitHub-only 真调被挡→`--mock`）+ 设置视图 `providerSettings()`（envKey/是否已配/打码·可被 server/UI 复用）。哲学同 `src/services/aigp`（非确定性旁路·不碰 sim/hash）。
> **待主程/PE（跨域·非 PA）**：① **设置 UI + server**——把 Tripo/DashScope key 接进 `apollo.py` 设置系统（现 `LLM_PROVIDERS` 是 chat 域·生成域另起一套或并入）+ 创作台设置屏（LayoutNode·UI铁律·复用 `providerSettings()` 形状与 `apiKeyMasked` 打码）。② **运行时生成 UI**——创作台输入 prompt→调生成→资产入本地库→即时可用（异步任务·pending/进度·参照 aigp 视频端口 handle 模式）。③ 浏览器侧直调需把生成逻辑做成 `src/services/ai-gen/` 端口（node 侧 `ai-gen.mjs` 是 authoring-time 参照）。
> **真调前置**：放宽网络的环境/session（Tripo/DashScope 域名本环境 403）+ 用户付费 key（owner 已购）。许可按各家订阅商用条款（provenance 已记）。
> **owner 2026-07-16 口径**：真 key 验证**等 owner 买到 key 再开**——「很多事情还没有完备，需要一次性把这事弄完」。在那之前本单挂起、任何 session 不催不动；REQ-STYLESET M1 同卡此口（连动启动）。
> **+ meshy 适配器接入（PST 2026-07-07·owner 直接要「接入 meshy 顺便接菜单」）**：`ai-gen.mjs` ADAPTERS 加第三家 `meshy`（文本→3D glb·kind:mesh·envKey `MESHY_API_KEY`·mock→cube.glb 占位·真调走 Meshy v2 openapi `POST /openapi/v2/text-to-3d` mode:preview → 轮询 `model_urls.glb`·门控同 tripo）；apollo.py 白名单 `GEN_ADAPTERS=('tripo','meshy','qwen')`（新增 provider 两处同改=脚本注册+此白名单）；创作台 `AssetGenPanel` 适配器菜单加 🗿 Meshy(3D) 一档 + provider key 状态自动列出。测试：`ai-gen.test` 注册表 + meshy mock glb·render 测断言菜单含 Meshy。门禁 tsc0/vitest2318/build0。**ai-gen.mjs=PA 框架·此 provider 扩展请 PA 会审**（真调端点/字段是否随 Meshy-6 漂移）。
### REQ-UIRECON-换根重挂 · UI reconciler 换根节点 id 静默 no-op=跨屏死机 · [2026-07-18] · PE-A 报（A-012·owner 实证「死机」）→ Lead 核真接 → **指派：PUI** · status: **✅ done（PUI 2026-07-18·待 Lead 验收）** · 优先级: P1（UI 基座 bug·全游戏受益） · 类型: UI 基座 bug（PUI 域）
> **根因**：`reconcileNode` 起手 `uiFindById(host,newN.id)`——换根（新根 id≠旧根 id·如 `a-play`→`a-result`）时 host 只有旧根元素→找不到**静默 return + curRoot 已推进**→此后一切 update 永久 no-op（含菜单开合）=「跨屏死机」。根自身换 id 无父可兜（子换 id 由父 `uiChildKeysSame` 兜）。
> **PUI 修（`src/ui/components/server.ts update()`）**：整根重挂条件从「仅换皮」扩为「换皮 **OR** `curRoot.id !== newRoot.id`」→ 按**旧**根 id 找现有元素、`outerHTML` 换成新根渲染（同换皮分支既有路径）；reconcile 只管同根。回归测试 `update-patch.test.ts`「换根」例（a-play→a-result→a-result'→a-play·验切屏出新屏/旧屏走 + **后续 update 仍活**）。全绿 tsc/vitest/build。**通告三 PE**：game-a 宿主兜底（mountedRootId 重挂）现可退（保留亦无害）；game-b/c 同险现由引擎兜住、无需再兜。

### REQ-UIAUDIT-叠层与动效 · 「意图叠层」标记字段 + audit 锚定件/角标盲区豁免（+ bounce 动效档后置） · [2026-07-18] · PE-A 报（A-007+A-011 并单）→ Lead 裁决接 → **指派：PUI** · status: **✅ done ①②③（PUI 2026-07-18·落地 `8f1096d1`·Lead 验收 PASS）** · 优先级: P2 · 类型: UI 基座工具债+小扩展（PUI 域）
> **⚖ Lead 验收（2026-07-18）：①②③ ✅ PASS**——diff 守界（additive 字段+定色豁免+audit 一行）；临时 worktree 独立跑新测 6/6 绿；golden 帧 word-diff 核实仅两处标记插入。④+border-image 后置照准。
> **交付 ①②③**：① `layout.allowOverlap:true`→渲染 `data-allow-overlap`（`types.ts`+`render.ts` renderNode 属性块·ui-audit 已支持该属性重叠豁免）——扇形手牌/牌堆/Float 锚定件意图叠层（game-a 牌桌 58 处误报消）；② `PlayingCard` 根自动挂 `data-audit-skip-contrast`（红黑花色=定色语义原语·不吃 WCAG）+ ui-audit `closest()` 免其内文字对比（33 处角标假阳消·游戏零改）；③ Float/Connector 等 JS 活取 rect 件静态摆 0,0 的重叠误报 = 同 ① 加 `allowOverlap` 豁免（无需另做）。测试 `card-overlap-audit.test.ts`（6 例）+ `ui.md` 回填 + 端到端（3 叠放红角标牌→0 重叠 0 对比）。全绿 tsc0/vitest/build。
> **余项后置（不占槽·工具债·PUI 后续批清·要做时重开小条）**：④ 动效闭集 +`bounce`（常驻 scale 弹簧关键帧·注意力指示器通用·现 `float+glow` 近似已达效）；⑤ ui-audit 对 `border-image` 白字皮盲区（对 `data-apollo-skin` 件按皮底判·非采样父面·M0.5 apollo-toon 遗留）。二者非阻断。

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
> 改动摘要（2026-07-02）：删 `GAME_GEN_SYSTEM_PROMPT` 手写「## Available Atom Components」整节（漂移源）+ 冗余 platformer 能力清单；词汇一律靠 `{CAPABILITY_CATALOG}` 注入。保留结构性指导（manifest 形状/最小可跑示例/art:约定/640x400 画布/纯 JSON），Rules 内组件名收敛到少量已核实真名（Camera/Mass/Bounds/Color）。`_FALLBACK_CATALOG` 12 条对照 registry 核实无漂移，加「部分应急词汇表·完整目录由前端注入」注释+prompt 文案。顺修一处已删旧游戏的过期注释。tsc/vitest/build/ast 全绿。
> 病灶（2026-07-02 归档盘点核实）：`GAME_GEN_SYSTEM_PROMPT` 手写组件清单漂移——漏 Hierarchy/StringVariable/全部 3D 原子，却把非原子的 Controllable/Grounded/Bounds 列在 "Atom Components" 标题下；手写清单与 registry 必然持续漂移（capability-catalog.ts 头注早已声明此规律）。
> **实现 spec（Lead 已定）**：① 删 prompt 内手写组件/原子清单，词汇一律依赖 `{CAPABILITY_CATALOG}` 注入（buildCapabilityCatalog 自动派生·零 prompt 维护）；② 保留且仅保留结构性指导——manifest 形状、最小可跑 JSON 示例、`art:<关键词>` 资产约定、640x400 2D 画布约定；③ `_FALLBACK_CATALOG` 保留应急，但注释+prompt 文案标明"部分词汇，完整目录由前端注入"；④ 顺修 apollo.py:474 一带已删旧游戏的过期注释；⑤ 验证 = `python3 ast.parse` 语法 + tsc/vitest/build 三门禁全绿（防连带），直推 mainbranch，完工回本条标 ✅。

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

### REQ-024 · [2026-06-21] · PA · status: 作废（2026-07-03 主程清池）· 原文已抹除
> 【抹除 2026-07-17·owner 令「A 位重启为全新游戏·旧作信息全库清除」】原单要点仅存引擎侧：`effect` 缺「对**已存在**实体施加冲量 / 注入动作」的 kind（当时建议方向 `apply-impulse` / `inject-action`）；随消费方旧游戏删除而作废。将来真实数据再拉动同类需求 → 重新开单评审，勿引本单为既成裁决。

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


> **【作废 2026-07-05·清池】被 REQ-G-动作模型-三行为自由 取代·owner 2026-07-05 清池（顺序制若未落再单提）**
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


> **【作废 2026-07-05·清池】owner 2026-07-05 拍板清池（真需要 Boss 天罡写死对齐再提）**
### REQ-G-Boss写死明牌天罡 · [2026-06-28] · PG → 战斗/loader 域 · status: **open（UI 侧已亮明牌·待战斗侧写死对齐）** · 类型: 配置对齐（boss-config-1-5 §五·五 + §七·#1）
> **背景**：按策划 `boss-config-1-5.md` 重配关1-5「明牌 counter-pick」（设计称「核心乐趣」）。**PG 已落 UI/数据侧**：`StageCampaign` 加 `deckTheme/bossTiangang/counterTip`，主页 Boss 情报 + 战役页亮出「⚡明牌天罡 + 🎯克制提示」（关1=旗手·不屈 / 铺场快攻绕开耐久…，关2-5 同 §五·五 表）。
> **缺口（战斗/loader 域·非 PG lane）**：`level.ts` 的 `boss.tiangang` 当前仍是**随机 12 张**（`bossTiangang`），与 UI 亮的明牌不一致 → 玩家「照明牌配克制」会落空。请战斗/loader 把 `boss.tiangang` 按 boss-config §五·五 **写死 ≤5**（张数随关爬 2/3/3/4/5），id 对照：关1 `bannerman,unyield` / 关2 `tigertally,bannerman,bedrock` / 关3 `tigertally,flow,twinblade` / 关4 `arrowhead,tripod,tigertally,relay` / 关5 `atlas,leaddice,irondice,tigertally,arrowhead`。
> 接好后「看明牌→配克制→碾过去」闭环成立·design G 再纳入 Boss 天罡重扫平衡（§七 备注）。


> **【作废 2026-07-05·清池】旧决策快照·已被当前心流重构落地·owner 2026-07-05 清池**
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


> **【作废 2026-07-05·清池】绝大部分被 IMPL-PLAN-combat-flow 心流重构吸收·owner 2026-07-05 拍板清池**
### REQ-G-战场UI批次 · [2026-06-21] · owner→game-g 乙（甲代登记·战场屏 owner 授权乙动）· status: **open ⚠️ owner 二次催办（2026-06-21 playtest：1/3/6/9 仍看不到·请乙优先）** · 类型: 表现层一批（playtest 连发）
> 【Lead 注 2026-07-04】战斗屏正被心流重构重塑（IMPL-PLAN-combat-flow·三行为/碰撞才战斗/满仪式）——乙开工前先与该线核对，已被吸收的项勿重复做；owner 催办的 1/3/6/9 仍优先。

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


> **【归档 2026-07-05·清池】#2/#3/#6/#7 已完成·残留 #5 并入当前战斗线·#1 待 owner 数据再提·2026-07-05 归档**
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


> **【作废 2026-07-05·清池】纯表现·战斗 UI 重写自然覆盖·太早·owner 2026-07-05 清池**
### REQ-G-Boss牌面板 · [2026-06-21] · design G → 甲（战斗屏域） · Game G · status: open · 优先级: P2（明牌可破核心体验·非阻塞战斗逻辑） · 类型: 表现层（数据已在·纯渲染）

> **owner 2026-06-21**：「Boss 5 张天罡也要这样去抽和摸；我们应该能看到他的手牌和天罡牌，但现在没地方看。」+「在他地煞牌下面放一个微小的牌组，手点上去就放大看具体哪几张·是缩小 scale 过的小牌。」
> **评判（design G）**：纯**表现层**——数据全在（`TurnBattle.b`：`pokerDeck/tengangDeck/hand/castIds` + 关卡 16牌组+5天罡明牌）；**无引擎/数据缺口**，只差战斗屏渲染（甲地盘）。机制侧已对：Boss 天罡同玩家从 `tengangDeck` **抽/摸再打**（`drawCard('b','tengang')`→`castTengang`·花源泉·非免费）→ 面板只"看牌"不改机制。
> **派甲（doc24 §九 已补规范）**：① 顶部 Boss 牌面板：3 地煞（明牌·在途）**之下**放 scale 过的 **mini-deck**（16扑克+5天罡 loadout·明牌 counter-pick 靶）；② 点/悬停 **放大**成可读网格看清具体哪几张（小尺寸=设计·放大解决可读）；③ Boss **手牌+已打天罡可见**（数量+内容·明牌哲学）。乙不碰（战斗屏=甲）。
> **🌫 暗牌/迷雾态（owner 2026-06-21 追加·未来）**：面板留一个**隐藏态**——Boss 带 `fog`（迷雾）地煞时 mini-deck/手牌翻背面·不可放大（玩家看不清·AI 本有全信息）。**`fog` 已在 disha-pack 设计（关17+）**·不是新能力。**关1-5 全明牌不加 fog**（明牌可破=核心）；fog 留后期/Ascension。

---


> **【作废 2026-07-05·清池】关6-20 未做·无消费方·太早·owner 2026-07-05 清池（真做那些关再加）**
### REQ-G-地煞新op · [2026-06-21] · design G → 甲（引擎域） · Game G · status: open · 优先级: P2（丰富前10-20关·非阻塞） · 类型: 真缺口（4 个新 Boss disha op·下沉）

> owner 头脑风暴一批 Boss 被动 Buff。design G 评判：7 条里 4 条已覆盖（泉水翻倍=bonusMana / 城堡血=homeHp / 急行军=tempo advance / 隐形=fog），**3 条半是真缺口 → 下沉 4 个新 op**。完整规格见 `design/disha-op-vocab-v2.md §二`。
> **派甲（DishaFx 扩字段·确定性·仿现有 batteryEveryTurns/resolveClash 钩子·无新子系统）**：
> 1. `{kind:economy, op:withdrawRefundMul, value:1.5}` —— Boss 胜者回库返还花费 ×value（默认0.5）。改 `resolveClash` 回库行（仅 Boss 侧）。
> 2. `{kind:action, op:extraAction, value:1}` —— Boss 每回合多 1 类互斥动作（破四选一·**仅 Boss**）。`aiTakeTurn` 放宽 actionTaken 锁到 1+value 类。
> 3. `{kind:control, op:freeze, everyTurns:N}` —— 每 N 回合冻玩家本回合 1 类动作。仿 batteryEveryTurns。
> 4. `{kind:control, op:intimidate, everyTurns:N}` —— 每 N 回合吓退玩家某路前锋 1 张（退场/回库·b.rng 选·确定性）。**与暂缓的 REQ-G-诅咒地煞(bounce) 同族**·甲可一并参数化实现（mode: bounce回起点/库 vs intimidate吓退）。
> 落地后 design G 把这些织进关6-20 地煞组合 + sim 标定。当前 lore/disha 重写子代理用现有词汇·不阻塞。

---


> **【作废 2026-07-05·清池】关11-52 未立项·无消费方·太早·owner 2026-07-05 清池（真做那些关再加）**
### REQ-G-地煞新op-v3 · [2026-06-21] · design G → 甲（引擎域） · Game G · status: open · 优先级: P2（关11-52 特色·非阻塞·有降级兜底） · 类型: 真缺口（通用 op·下沉）

> 关11-52 想象力设计提了 ~38 个新 op，design G 收敛成 8 个通用原语 + 优先级清单（详 `design/disha-op-vocab-v3.md`）。**每条都有现有 op 降级映射 → sim 现在能跑·不阻塞。** 甲择优实装高杠杆通用 op（覆盖最多关·复用最大）：
> 1. 🥇 `terrain.laneLock`/`chokepoint`（棋盘几何改写·一个 op 给 N 关地形特色·李舜臣窄海峡）。
> 2. 🥇 `phase.cycle`（Boss 周期切换 fx 组·一关多形态·武田风林火山）。
> 3. 🥈 `aura.invulnerable{everyTurns,dur}` + `rally.revive`（周期无敌/复生·终章）。
> 4. 🥈 `control.disarm`/`sever`（点杀玩家最强牌/废连携）+ v2 freeze/intimidate。
> 5. 🥉 `offense.breakthrough`/`jumpAdvance`（胜后连推/跳格）+ 已设计 deepDecay。
> 6. 🥉 v2 四件（extraAction/freeze/intimidate/withdrawRefundMul·见 REQ-G-地煞新op）。
> 长尾(mirage/minefield/volleyRelay…)先用降级映射上线。实装后 design G 用真地煞重跑 sim 定稿。

---

## 2026-07-15 池清仓（owner「清除 requests.md」·Lead 执行·32 条已完结全文迁入）

### NOTE-PA→game-q · game-q 台账 24/31 行无 skinKey → 平台填不回，确认是否有意 · [2026-07-09] · PA 契约会审派生（`art-platform-handoff-2026-07-09.md` §致 PA·观察 3）→ **game-q 已回复（见末行）** · status: **closed（spawn-portal 采纳·余有意·2026-07-09）** · 类型: 覆盖度知会（game-q 域自决）
> **背景**：PA 会审美术平台契约时对了 `public/games/game-q/art/art-ledger.json`——31 行需求里**只有 7 行带 `skinKey`**（base·pad·3 敌体·2 塔体），其余 **24 行无 skinKey**。按终态档 §五，编译期游戏线写回=**skinKey 别名登记**，故**这 24 行现无法经平台生成/填回**（fill/upload 的 skinKey 别名无锚点）。
> **无 skinKey 的 24 行**（都是次要/子部件·多半有意不上皮）：base-core/rim/shield、pad-0-pc、burst_*/zap_*:flash（FX）、enemy_*:hpbar/inner、tower_*:core/ring、spawn-portal、track-glow/nglow/node/seg。
> **求确认（二选一·你的域你定）**：① **有意**（这些是程序化 FX/轨段/子部件·不需换皮）→ 无需动作，回此条标「有意·closed」即可；② **该可换皮的漏了**（如 spawn-portal / tower core 你想上真美术）→ 照交接档「加可换皮实体三行」给对应视觉实体加 `Sprite` 皮肤槽（theme skin key → blueprint `Sprite` 行 → `npx vite-node scripts/game-q-art-requirements.mjs` 重跑·编号 append-only 旧号不动·新行自带 skinKey）。
> **PA 立场**：schema 本身无缺陷（四项契约会审全 PASS）；这纯是 game-q 的皮肤槽**覆盖度**取舍，故只知会不开实现单、不直改你的蓝图。
> **game-q 回复（2026-07-09·域自决）**：② 采纳 **spawn-portal**（独立场景焦点=敌出生门·值真美术）——已加皮肤槽（`theme SKIN.spawn` + `blueprint` Sprite 行·重跑台账 append-only：art-27 得 `skinKey=q/spawn`·旧号零变·现 8 行带皮）。tower core 不采（子部件·并入 `q/tower-*` 塔皮）。余 22 行确认 **①有意·保留程序化**：FX（burst/zap flash·主题色驱动随调色板换皮）、Gauge 血条（hpbar/base-shield·会缩放不能静态皮）、子部件（base-core/rim、pad-pc、enemy inner·并入父皮）、射程环（玩法提示）、车道（track-*·NavGraph 绘制+调色板换皮）。谢 PA 会审。**closed**。

### NOTE-game-q→PST · 美术台账平台两处可用性缺口（owner 现场）：卡面无描述 + 未生成行无占位图 · [2026-07-09] · game-q 程序员（owner 现场反馈）→ **PST（ArtLedgerPanel 域）** · status: **✅ done（owner 现场授权 game-q 直接改·2026-07-09·知会 PST）** · 类型: 平台 UX 缺口（数据已齐·纯 ArtLedgerPanel 渲染·不改台账数据）
> **✅ 落地（owner「你就帮他改了吧·转来转去麻烦」授权直改 ArtLedgerPanel·PST 已被 owner 知会）**：① 卡面加 `query` 人读描述行（不再只 art-NN·一眼分清）；② `swatchDataUri()`——从 `placeholder.current` 的「形状·#色」画 SVG 色块占位图（circle/box/polygon→圆/方/六边），卡面+详情「占位/原始」框都用它 → 未生成行也有「这长啥样」的图；③ 卡片点选默认词 + 详情 `📝 提示词` 用 `prompt||query`（原只取 query·忽略回填的 `prompt`）。台账数据零改（纯渲染）。验证：新增 `art-ledger-render.test.tsx`（客户端渲染注入台账行·断言 query 描述 + SVG 色块图形状/色）；门禁 tsc0/vitest2359/build0。
> **owner 现场痛点**：美术台账平台里「无法知道什么是什么」——卡片只有编号，看不出这条需求是什么；描述词/提示词也看不到。
> **根因（读 `ArtLedgerPanel.tsx` 定位·数据都在台账里·纯渲染缺口·非数据缺口）**：
> ① 卡面（`:153-165`）只渲染 `no`+来源标+缩略图+`kind`——**不显 `query`/`context`**（描述在 `:176` 详情面板·要点开才见）→ 一屏「art-01 sprite / art-02 sprite」分不清。
> ② `thumbUrl`（`:44-47`）只认 `gen.servedPath` → **未生成行（needs-art）无任何缩略图**；详情「占位/原始」框（`:191`）只显 `placeholder.current` **文本**（「2D 色块（circle·#ff5c7a）」）不是图。
> **建议（都在 ArtLedgerPanel·台账数据无需加）**：A. 卡面加一行 `query`（或 `context` 截断）→ 一眼辨认；B. 未生成行画**占位色块图**：`placeholder.current` 已含形状+色（或让 `deriveRequirements` 顺带补结构化 `placeholder:{shape,tint,w,h}`），panel 据此画 SVG 圆/方色块当占位缩略图；C. 详情/重生成默认词用 `prompt||query`（现 `:155` 只取 `query`·忽略回填的 `prompt`）。
> **game-q 可配合**：若要真占位图（非 SVG 色块），我可在 game-q 侧把各实体 Shape+Color 渲成占位 PNG 落 `art/placeholders/` 并在台账加 `placeholder.thumb`——PST 定方案我照做（不越域直改平台）。

### REQ-DEMO-T1-美术替换工作流·产线段 · placeholder 先行+替换列表推导+批量生成+对位替换 · [2026-07-07·07-08 owner 定形两段式] · Lead 图纸=`docs/design/art-replacement-workflow.md`（**唯一权威·本条只摘要**） → **指派：PST（施工）·PA 会审契约（风格包库/台账 schema/缓存键）** · status: **✅ done（PST 产线段 2026-07-08 + Lead 亲手收口 2026-07-09·终态=`docs/design/art-platform-2026-07-09.md`·整改三单 R1/R2/R3 owner 撤单由 Lead 合并落地：平台归一双数据源/去 mock 硬编码/key 配置面+注入/编号 append-only/game-q 皮肤槽写回/风格包迁数据文件·真 key 端到端待 owner key）** · 优先级: **P0** · 期限: 7/13 · 类型: 产品化·美术管线
> **owner 2026-07-08 定形（替代 07-07 初稿「库查不到就地生成」）**：先出可玩游戏（art: 一律解析到免费库=placeholder）→ 游戏输出**替换列表**（2D/3D/声音/启动画/粒子全类型登记·每条编号/规格/表现描述·**机器从组件数据推导**）→ 配风格包 → 调万相/Tripo/Meshy **整批产出风格统一美术** → 按编号对位替换。换皮/单槽优化=同一机制重跑（工作流档 §二）。
> **施工件（详 spec=工作流档 §三-§六·此处点名交付物）**：
> ① **列表推导器**（apollo.py 编排步）：扫 manifest 美术槽位 → art-replace-list.json（**与美术台账合一·一份文件两个视角**·编号 art-01… 确定性分配重跑不漂移·spec/context 从 Shape/Transform/Model3D 等组件数据推导）；
> ② **风格包库** style-packs 纯数据文件（闭集·demo 前调稳 3 包·中英双方言 prompt+palette+negative+params 钉死 provider/model(+seed)·refImage 定调图槽·**PA 会审 schema**）；
> ③ **批量生成器**（apollo.py 端点 + `scripts/ai-gen.mjs` 既有 wanx/tripo/meshy adapters）：并发·内容寻址缓存 hash(provider+prompt+参数)·**断点续跑（status 即断点·replaced 行不重扣费）**·无 key 行=凭证探针输出+mock 占位（绝不静默顶替）；
> ④ **确定性后处理**：palette-snap（量化到风格包调色板）+ 按 spec 缩放/栅格（mock 路径同走）；
> ⑤ **对位替换**：按编号重钉 manifest 引用（落盘前 parseManifest 零 error 铁律不变）+ status 流转 + provenance 硬字段（model/prompt/date/license）；
> ⑥ **模板/系统提示改口径**：主体视觉实体默认 Sprite+art: 引用（换皮前提=有皮肤槽·game-q 全程序化色块=反面教材）；
> ⑦ **进度可视化**：批处理「美术 n/m」阶段灯（与 REQ-STUDIO 心跳余项并一批）；
> ⑧ **测试**：工作流档 §六 四条验收口径全数落 smoke（mock 全链 / 断点续跑 / 真 key 一款端到端 / 编号稳定性断言）；门禁全绿直推。
> 边界：src/assembly 引擎不动；sfx/music 列表登记但冲刺期不生成（声音走合成数据 `docs/playbooks/audio.md`·采样=冲刺后 B 件）；particle=配置槽不生成图。完工标 ✅ 待 Lead 验收（真 key 一款 placeholder→整批换装→真浏览器可玩且风格成套）。
> **✅ 产线段完工回执（PST·2026-07-08·全在服务/脚本层·src/assembly 引擎零改）**：大脑 `scripts/art-replace.mjs`（derive/batch/replace 纯函数导出+CLI）+ `scripts/style-packs.mjs`（②·3 包闭集·中英双方言 prompt+palette+negative+post+params·**schema 待 PA 会审**）+ apollo.py 薄胶水端点 `POST /api/art/derive|batch|replace`·`GET /api/art/style-packs|ledger`。① **列表推导器**：扫 manifest `art:` 槽位（同 resolveArtRefs 口径）→ `public/games/<slug>/art/art-ledger.json`（=替换列表·同一份文件两视角）·编号 art-01…按槽位标识确定性分配（重跑不漂移）·kind 从组件/字段推(Sprite→sprite/bg·Model3D→model3d)·spec 从 Shape/Transform/Model3D 数据推·context 底稿。③④ **批量生成器**：风格方言化 prompt→ai-gen ADAPTERS(wanx/tripo/meshy)→**palette-snap**(量化到风格包调色板·同批成套·mock 同走)+按 spec 尺寸→落 `art/gen/<no>`+登记游戏本地 index+provenance 硬字段；**内容寻址缓存** hash(provider+prompt+model+seed)·**断点续跑**(status+cacheKey+文件在=命中不重扣费)·**凭证探针**(无 key 行=探针输出+mock 占位·绝不静默顶替)。⑤ **对位替换**：按编号重钉 manifest 引用为 gen/ 本地 id→status=replaced·**落盘前过 parseManifest 零 error 铁律**(复用 library_put_manifest 的 check+版本化)。⑥ **系统提示改口径**：主体视觉实体默认 Sprite+`art:` 皮肤槽（game-q 反面教材写进 prompt）。⑧ **测试**：`art-replace.test.mjs` 11 单测(推导/编号稳定/palette-snap/缓存续跑/替换/原 manifest 不改)+全链冒烟 `art-replace-smoke.py` **20 断言**(§六①全链 derive→batch→replace 零 error·②断点续跑全缓存·④编号稳定·进程内 API·快照恢复零污染)。门禁 tsc0/vitest2348/build0。**§六③真 key 端到端**=本环境 GitHub-only 无 key 跑不了，待放宽网络 session + owner key（大脑真调路径已写·Meshy/Tripo/万相 adapters 就绪）。**余**：⑦批处理进度灯 UI（并心跳余项）+ T2 台账浏览墙/单槽点名替换（数据面已就绪·台账+status+localId 齐备）。
> **Lead 复核（2026-07-09·对抗性审计 8 提交 + 独立复跑 tsc0/vitest 2353/build0·smoke 33 断言实数核对）REVIEW: CONCERNS**——地基收下（推导器/台账/断点续跑/palette-snap/三式/换皮全是真的且有测试），但对照 owner 三点期望有 12 处偏差（4 处死穴级：服务端无条件 --mock=UI 永远出不了真图；生成 key 不注入子进程；「写回游戏」最后一环不存在；平台对 game-q 硬编码+与台账墙双头重复）。**整改=REQ-DEMO-R1（studio 侧）+ REQ-DEMO-R2（game-q 侧）**，两单落地+真 key 端到端后 T1/T2 才关账。

### REQ-DEMO-T2-换皮流水线+台账浏览/单槽替换 · 同玩法×新风格锚=新卡带；按编号点名优化 · [2026-07-07] · Lead 图纸 → **指派：PST** · status: **✅ done（PST 2026-07-08 + Lead 亲手收口 2026-07-09·台账墙升级双数据源平台=唯一美术 UI·cockpit 退役·终态=`docs/design/art-platform-2026-07-09.md`）** · 优先级: P0 · 期限: 7/18 · 类型: 产品化·量产乘法器+优化闭环
> **✅ 完工回执（PST·2026-07-08·全在服务/脚本层 + studio 产品面·引擎零改）**：① **单槽重解析地基**（换皮/点名共用）——`art-replace.mjs` `resetRow`（单行打回·可改 prompt·留 history）/`swapSlot`（钉已存在资产 id）/`resetAllRows`（换皮整批），CLI `regen`/`swap`/`reskin`。② **换皮**——`POST /api/art/reskin`：copytree 新卡带（玩法 manifest 一字不改）+ `meta.reskinOf` 谱系 + 复制台账 + 换风格包整批重跑 + 过 parseManifest 零 error 落盘，失败回滚。③ **台账浏览墙**（owner 硬要求）——`src/studio/ArtLedgerPanel.tsx`：缩略图墙（编号 art-01…+槽位语义+来源标 generated/📚库/⬆上传/⚙MOCK+缩略图）+ 点开看 prompt/provenance/history；库卡带操作条加「🎨 美术台账」入口（`LibActionBar`）。④ **按编号三式替换**——`POST /api/art/regenerate`（改 prompt 重生成·可选风格包）/`/api/art/swap`（从共享库钉资产 id）/`/api/art/upload`（上传写盘+登记本地 index+钉引用），三式都过 parseManifest 零 error·台账留替换历史。⑤ **并排预览**（占位/现用）在详情面板。⑥ **测试**——`art-replace.test.mjs` +2（resetRow/swapSlot）·render 测（ArtLedgerPanel）·全链冒烟 `art-replace-smoke.py` 扩到 **33 断言**（⑦点名重生成改prompt其余编号不动·⑧库选换钉id+历史·⑨换皮新卡带 parseManifest零error+玩法diff空+美术全换新+reskinOf）。门禁 tsc0/vitest2352/build0。**真 key 端到端**（真浏览器点名 art-N→重生成→游戏里换上）待放宽网络 session + owner key；mock 全链已通。
> **spec**：① **单槽重解析机制（地基·换皮与优化共用）**：T1 编排器支持指定槽位子集重跑——换皮=全槽、点名优化=单槽；重跑即重钉引用+更新台账+新 provenance。② **换皮**：studio 选已有卡带→换风格包→对**同一张替换列表**整批重跑批处理（玩法 manifest 一字不改·工作流档 §二）→存新卡带（slug-v2·meta 记 reskinOf 谱系）；批量模式=一套玩法 × N 风格包一次出 N 款。③ **台账浏览面板（owner 硬要求）**：逐游戏缩略图墙——每格显编号（art-01…）+槽位语义+来源标（generated/library/MOCK·unreviewed 角标）；点开看 prompt/provenance。④ **按编号三式替换**：重新生成（可改 prompt）/ 从共享库选换 / 上传替换——三式都走单槽重解析，台账留替换历史。⑤ 换皮结果并排预览（原/新）。⑥ 测试：reskin 后 parseManifest 零 error、玩法数据 diff=空、美术引用全换新；单槽替换后其余槽位引用与编号不动（断言编号稳定）；smoke 进批量冒烟。完工标 ✅ 待 Lead 验收（真浏览器走「浏览→点名 art-N→重生成→游戏里换上」全旅程）。
> **Lead 复核（2026-07-09）REVIEW: CONCERNS**——三式/换皮/台账墙地基收下；偏差：①三式/换皮线**绕过人审直写**（与 cockpit 的 M2.5 姿态分叉·裁决=按 owner 07-07 归置闭环统一：单行=预览→入库确认·批量=快速通道带 unreviewed 标·共享货架仍 M2.5）②前端写死 mock:true ③upload 无内容嗅探。并入 REQ-DEMO-R1 整改。

### REQ-WORKSHOP-统一工作台+整链打通 · Workshop 主界面（状态机+双角色对话+订阅通道）+ 数据桥 + cart-S8 · [2026-07-10] · **owner 定稿·Lead 出图** → **Lead 亲手施工（owner 07-11「有足够 token·你亲自做」改派）·维护移交 PST** · status: **✅ done（C1+C2+B+A+E 五批全落·待 owner 验收）** · 优先级: **P0（冲刺主线）** · 类型: 产品化·工作台与打通
> **完工回执（Lead·2026-07-11）**：C1 数据桥七件+C2 cart-S8（`74079c77`）；B 订阅通道+anthropic 4.7+ 合规+`/api/agent/chat` 双角色（`8dcf80b9`）；A 壳接线（EDIT 对白编辑屏=策划/程序双 tab+待应用改动卡「✔应用/✕放弃」+八关灯+⬇下载包；CREATE 真生成链；ASSETS 接真台账；PUBLISH=下载包；SETTINGS=订阅 token+默认通道+**文生图 genKeys 三行（owner 07-11 追加·千问万相/Tripo/Meshy 收编）**）+ apollo 三端点（GET /games/* 静态·GET /api/library/\<slug\>/export 内存 zip·GET /api/catalog）+ launcher 导流（LibActionBar 🏭/真⤓导出·保存成功「下一步→🏭」·S6↔美术台返回栈·旧 GameCreator 退役·⇄ Workshop 链接）。
> **门禁实数**：tsc 0 err；vitest 318 文件/2398 测试全绿；pipeline-smoke 44 断言（+⑧ 壳伺服面 10 条：壳/静态 200·穿越 403·zip 头+排除 mock/.git/snapshots·catalog 形状）；art-replace-smoke 45 断言；壳 Component node 冒烟（8 屏×空/满态+provider 决策+事件处理器）；服务端 curl 自证 10 腿（generate→create→PUT→board→双角色 chat→applyPending→ledger→export→settings 打码/清除）。维护交接档=`docs/workflow/finish/PST-workshop-handoff.md`。
> **验收六修（owner 07-11 真机验收反馈·当日落地·spec §八.1）**：①三对话入口（+美术 art 角色·台账 digest 系统词）②对话持久化（`/api/agent/chats`·`.apollo/workshop-chats/`·进工坊恢复）③模型/思考档 chips（默认 Opus 4.8+high·Fable 5 标「另计费」·CLI `--effort`）④debug 日志对齐（`[LLM]` 传输层打点+`/api/llm-logs`+壳🐞调试块）⑤games filter 三 chips ⑥生成进度真话（真实链路分步+秒表·治「卡 92%」误导）+落盘路径上卡。pipeline-smoke 44→54 断言。
> **验收批 2（owner 07-11 续测·当日落地·spec §八.2）**：①生成=服务端后台任务（`/api/generate/job(s)`·切屏/刷新不丢·壳启动恢复看板·mock 全链冒烟）②订阅通道两实证根治——300s 超时→心跳看门狗（吐流不杀·180s 停滞收割·1800s 保险上限）；`tool_use` 吃回合空 result→`--append-system-prompt` 钉纯文本生成器+禁用名单补全（计划/提问/技能类）+流式打捞 ③思考实况（stream-json 流式→`_LLM_LIVE`/`/api/llm-live`·看板「🧠 已流出 N 字」·对话实况字数）④设计先行流上壳（CREATE 双模式：聊想法→提纲 MD 壳内可见→逐篇修订落盘→原型后台任务·服务端四模式零新建纯重组）。pipeline-smoke 54→65 断言。
> **验收批 3-14（owner 07-11 连续真机验收·当日全落·记录=spec §八.2-八.5）**：对话区体验/全局模型选择/原型 job 修复/设计现场持久化/底案=活工件/▶ 运行直达/删卡带/game-NNN 编号/旧 CLI 降级/用量可见/LLM TRACE 滚动窗/方案 A 原生 session resume/编辑工坊底案直改/bench 智能跳转/一条命令全起/bare 纯游戏页/装载自诊/ThreadingHTTPServer 破案/空卡带明报/**「能存必须能跑」落盘装载门+运行器错误明报+agent House Rules**（末批 `37e97f38`）。pipeline-smoke 65→101 断言。
> **唯一 spec=`docs/design/workshop-spec-2026-07-10.md`（本条只做指针·以 spec 为准照图施工）**。owner 三问已拍板记 spec §七：主入口直接走 Workshop+旧货架保留切换按钮；对话编辑=策划/程序双入口（策划兼美术更换）·显式按钮落盘·不多开；档位默认 Opus 4.8·可切 Fable 5（展示）/Sonnet（量产）；**Claude 通道=订阅+setup-token+Agent SDK 原封不动（不买 API·不花新钱）**。
> **载体对齐（spec §〇.五·2026-07-11）**：Workshop 壳已由 workshop 施工 session 落地基（`c3dd4743` 原版设计壳 apollo 伺服+游戏库屏接真数据·LayoutNode 豁免 owner 已拍板）——A 批=**在壳上接线**（非新建 React 面板）；对话端点统一 `/api/agent/chat`（语义=spec §2.3·mode/role/messages）；壳侧「待接线」清单（AI 新建屏 agent 循环/素材库/设置/发布）**并入本单**，workshop session 即本单施工者之一，与 PST 分批对齐勿重复施工。
> **批次（spec §六·C1/C2/B 可并行→A→E）**：C1 数据桥（meta.description/建库自动立项卡/POST /api/pipeline/concept/PUT 后自动 derive 台账/换皮谱系/导流补线）+ pipeline-smoke 骨架；C2 cart-S8 轻量终检（manifest-check∧bench∧mock债=0·证据绑 gameHash·mockDebt/writeConcept 导出+单测）；B claude-code 订阅通道（**子进程工具面全禁**·token 打码不落日志）+ anthropic raw 通道弃用型号修复与 4.7+ 合规 + `/api/agent/chat` 双角色编排；A Workshop 壳接线（状态机两态/双角色对话屏/**素材库屏接 `/api/art/*` 与共享货架（owner 07-10 点名）**/设置屏/⇄ 旧工作台互切/launcher 侧导流补线/退役旧 GameCreator）；E 测试文档（spec §五门禁·壳侧=端点级+curl 自证+真浏览器评委路径走查+手册回填）。
> **红线（spec §四）**：不做一键跑八关；落盘必过 parseManifest 门+版本化；mock 三道闸不变；引擎目录零触碰。每批完工回执照 T1/T2 格式附门禁实数；Lead 对抗性验收 diff。

### REQ-ARCH-卡带要不要放开自带 TS · [2026-07-11] · owner 提问 → Lead 评判 → **owner 双拍板·Lead 当日施工（批15）** · status: **✅ 落地（受控形态）——自由 TS 常态化仍不开** · 类型: 架构方向（宪法级）
> **裁决与落地（owner 07-11 三连拍板·批15 `pipeline-smoke ⑬` 钉死）**：①owner「我怕到29号没累积到能力，是不是有个开关可以隐藏一下，对一些展示游戏打个勾允许生产 ts 逻辑」＋②「你说的这个管线（缺口→强模型下沉快速通道）我也批准，但也做成一个配置能关」→ Lead 落两件：
> - **capgap 快速通道**（`features.capgap` 默认开可关）：三角色 agent 遇词表表达不了 → ```capgap 结构化提案围栏 → `.apollo/cap-gaps.jsonl` 台账 + `GET /api/capgaps` + 对话留痕；下沉仍走 Lead 裁决→派工（通道只是机器直达，不代裁决）。
> - **TS 例外开关（受控逃生门·非自由 TS）**：`features.tsCarts` **默认关=隐藏开关**（配置 `{"features":{"tsCarts":true}}` 或 `APOLLO_FEATURE_TSCARTS=1` 才现形）→ 编辑工坊每卡带 ⚡ 打勾（`meta.allowTs`）→「程序」对话可提议 `library/<slug>/logic.ts`（契约=`export cartCapability`·defineCapability·id=cart-<slug>）→ **cart-logic-check 独立装载门**（模块装载+契约+与 manifest 合体真引擎 2 tick）→ 壳「✔ 应用」PUT `/api/library/<slug>/logic` 落盘（git 版本化·空串=撤除）。运行器 hasLogic 合体装载（dev 线·vite 管线）。**记债明示**：列表 allowTs/hasLogic 旗、该卡带退出回放/换皮/bench 保证。**manifest 仍纯数据、TS 绝不进 JSON。**
> - **红线保持**：绝不 eval 字符串；logic.ts 走与引擎系统同一 ESM/装载/定序管线；确定性纪律写进 agent 系统词（禁 Math.random/Date.now/DOM）。
> **owner 原话**：「AI卡带生成的游戏没有TS，为什么要这样限制他们？纯靠数据驱动做成是不是非常困难？该写TS就写TS啊。」
> **Lead 立场（详见 07-11 当日汇报·宪法=data-driven-manifesto）**：不建议给卡带开自由 TS。①确定性/回放/lockstep/bench/换皮量产全建立在「引擎解释纯数据」上，卡带进代码=整套门禁与台账体系失效；②AI 生成的代码直接在玩家页执行=任意代码执行面；③每款游戏变成一个要 tsc/review/依赖管理的软件项目，弱模型档位直接出局（manifesto 尺子）；④「该写 TS 就写 TS」的正道**已经存在**——数据表达不了的缺口下沉为引擎 capability（TS 写在引擎里·词表增长·所有游戏受益），而非散进单个游戏（game-d 绕引擎=前车之鉴）。owner 感到的「纯数据很难」实证上主要是**坏稿无门+失败无因**（07-11 批14 已治），其次是词表缺口（走下沉通道）。
> **重启时点**：owner 想再议时，Lead 出一页三路对比（纯数据 vs 卡带自带TS vs 受限DSL/沙箱脚本）附代价收益与迁移成本，再拍板。
> **⏫ owner 价值排序更新（2026-07-11 当日追加·宪法尺子待修订）**：「强模型、弱模型不是我们重点，重点是**能出东西，能出复杂的东西**。用弱语言模型能做这种事情不是第一要素了，能用强语言模型做，我们并不抵触。」——manifesto 的「最弱 LLM 也能产出同样数据」尺子降级；「复杂产出能力」升为第一要素。Lead 据此更新论证：上条③弱模型下限论**作废**；①体系论②安全论仍立（与模型强弱无关）；建议解法=「缺口→强模型下沉」快速通道（强模型写 TS 进**引擎**·非进卡带·复杂度落成可复用资产），详见当日汇报。manifesto 正文修订待本单裁决时一并做。

### REQ-K-美术管线接入 · 老虎机手写 canvas 绕基座（owner 2026-07-10 点名「为什么没有美术需求表」） · [2026-07-10] · Lead 问责定性 → **指派：game-k 程序员** · status: **✅ done（game-k 程序员自补 ae34696c·Lead 验收：10 行台账全带皮肤槽·「无美术台账」黄旗消·createElement×7=plan 基线登记的表现层例外）** · 优先级: P1 · 类型: 手册整改（编译期游戏美术接入）
> **问责定性（按 07-03 铁律：不问谁绕的·只问手册哪没接住）**：`game-k/art.ts` 全程手写 canvas 程序化美术（注释自豪"零外部图片"）——直接绕过美术管线；`docs/playbooks/art-pipeline.md` 红线明文「主体视觉实体必须有皮肤槽」但当时**无门禁抓**。手册的牙已补：`game-skill-audit` 现对无 art-ledger 的游戏打 🟡「无美术台账」黄旗（全库存量一起点名·还债各归各主）。
> **要做（按 art-pipeline.md 编译期三行·game-q 样板）**：① 主体视觉实体（转轮符号/机身/拉杆/背景）加 `Sprite` 皮肤槽（与现程序化观感并存·未填资产观感零变——程序化烘焙可作回退保留，皮肤就绪即盖过）；② 照 `scripts/game-q-art-requirements.mjs` 写 game-k 推导脚本产台账；③ mount 拉本地 index 注册 AssetManager。完工=美术平台选 game-k 出台账·audit 黄旗消。
> 备注：t3-slot-payout 下沉本身是好活（Lead 后补验收）；本单只管美术接入。

### REQ-G-美术台账接入 · game-g 美术资源数据配置驱动到台账（PST 2026-07-13 提·Lead 评审通过） · [2026-07-13] · PST 提需求 → PST 步1/步2 + **Lead 亲手批28 完成全面台账化（owner 07-14 全权授权）** · status: **✅ done（2026-07-14）** · 优先级: **P1（出口游戏=D+G·7·29 美术线·audit 黄旗存量欠账）** · 类型: 手册整改（编译期游戏美术接入·REQ-K 同款）
> **Lead 评审**：该做。game-g 现状=纯程序化 SVG 底纹（`art-textures.ts` data-URI 喂 Panel.bgTexture/牌面·双皮=fill/stroke 令牌）——零台账零皮肤槽，与 game-k 整改前同模式；07-13 的通用工具（`scripts/game-blueprint-to-ledger.mjs`·58539995）已实证 game-g「代码驱动无单一蓝图」走不了干净路径，必须 per-game 接线。**无新引擎能力需求**，全程照 `docs/playbooks/art-pipeline.md` 编译期三行 + game-q/game-k 样板施工。
> **spec（照图施工·完工标 ✅ 待 Lead 验收）**：
> ① **台账推导脚本** `scripts/game-g-art-requirements.mjs`（照 `game-q-art-requirements.mjs` 样板）：枚举视觉件清单——主页牌桌底纹/牌面（军衔×玄铁金+锦霞双皮）/主将「将」艺术字衬底/对决三栏特写件/3D 骰（model3d 类·列行即可）/战役图/HUD 面板底纹（来源=art-textures.ts 各导出 + home-screen/turn-battle-screen/campaign-screen 的视觉消费点）→ 产 `public/games/game-g/art/art-ledger.json`（deriveRequirements schema·status='needs-art'·每行详细英文描述+规格+当前程序化占位描述）。
> ② **皮肤槽接线（双形态·观感零变铁律）**：(a) play-field world 实体若有可 Sprite 化对象 → `Sprite{textureKey}` 与 Shape 并存；(b) **LayoutNode/Panel 纹理类**（bgTexture/牌面/衬底=game-g 主体）→ skinKey 别名登记本地 `public/games/game-g/art/index.json`，mount 拉起注册 AssetManager（照 game-k `skinAssets` 样板）——真图就绪自动盖过程序化回退，**未填=观感零字节变化**（程序化烘焙保留为回退·REQ-K 同语义）。
> ③ **写回=fill 线**：编译期游戏走 regenerate→fill 既有端点语义（重钉 manifest 的动作平台自动隐藏）；**绝不改蓝图/渲染代码来换皮**（art-pipeline 红线）。
> ④ **边界**：`clash-dice-3d` 3D 骰=P3D 独占域——台账列行可以，3D 侧接线动作先知会 P3D（P3D-game-z-handoff §0.1）；turn-battle-screen 牌面属程序B 域正好同域。
> ⑤ **验收**：美术平台/工坊素材屏选 game-g 出台账（行行有详细描述·规格·占位说明）；`node scripts/game-skill-audit.mjs game-g`「无美术台账」黄旗消；未生成真图前游戏观感零变（前后截图对比）；/check-ui 过；tsc+vitest+build 三绿。
> **✅ 完工回执（Lead 亲手·批28·2026-07-14）**：台账=`scripts/game-g-art-requirements.mjs` → 60 行（53 行保号保现身
> ——PST 现况账升级：skinKey+富英文描述词+规格刷新·replaced 现身=程序化 svg；+7 新槽：主页/战役/对战背景板·
> 硬币双面·牌背·3D 骰）。消费点接线四处：牌桌呢面 feltBrocadeUri 覆盖优先（home-screen）、主页/战役屏 Screen.image
> cover 背景板（覆盖在场才生效）、硬币双面贴图、覆盖装载泛化（game-g.tsx 双通道 hero+tex·大厅在场时真图到位重绘一次）。
> 全部消费点=真图未到观感零字节变化（game-g 219 测绿·含帧回归）。**剩两处待接**：对战屏背景板（战斗屏根节点·下一批）、
> 牌背（引擎 PlayingCard 无 back prop·已提 REQ-UI-PlayingCard-back 缺口单）；3D 骰=行已立·接线归 P3D。
> **换皮操作口径（owner 美术升级用）**：工坊素材屏选 game-g → 逐行 ⚡ 重新生成（描述词已备好可直接出图/可改词）→
> ⤵ 替换写回=fill 别名登记 → 游戏即换（立绘/呢面/背景/硬币全线）。

### REQ-G-ART-v2 全部美术台账化 + 图标统一升级 · [2026-07-15] · owner 口头三连（「全部美术的台账加升级」「很多图标统一风格升级」「54~63 没有预览占位符」）→ Lead 亲手 · status: **✅ done（批30-32·2026-07-15）** · 类型: 台账扩面 + 引擎图文位下沉
> **交付**：game-g 台账 63→**110 行**（52 立绘 + 呢面 + 8 屏背景板全 + 硬币双面 + 牌背 + 3D 骰 + 3 按钮皮 +
> 6 幕故事插画 + 2 卡池 banner + **34 枚套装图标**·统一风格锚写死 query 尾·生肖 12 全）。
> **引擎下沉（批29-32 累计）**：UITheme.buttonSkins 主题级按钮皮 / PlayingCard.backArt / CoinFlip.headsArt+tailsArt /
> Button.icon / Tag.icon / Label spans[].img / Card.media URL 检测——全 additive·不填零回归。
> **占位快照**：57 个 needs-art 行全部生成「当前实际观感」确定性 SVG（emoji/CSS 渐变/主题底近似）→
> row.placeholder.servedPath·工坊行封面回落——台账行行有脸。
> **接线**：图标 v1 五处（顶栏 7 pill/浮层启动器 5 键/商城余额 4/改造坊生肖 chips/收藏页头）——覆盖在场才换、
> 无=原 emoji（观感零变）；长尾 emoji 槽随屏改造逐步接（消费模式已定型=iconUri/iconPill/iconBtnProps/iconSpan）。
> **去腐**：icons.ts（4 枚内联 SVG·41k token·lobby-screen 退役后孤儿）删除。
> **诚实边界（未台账化·候选下一批）**：战斗屏 bespoke 兵牌面/棋盘装饰（接 hero 覆盖需 owner 点头设计）、
> 正文行内 emoji 长尾、天罡 38 张逐张牌面 art（现按 kind 图标覆盖）、发布封面（发布线已有独立文生图）。

### REQ-UI-PlayingCard-back 牌背贴图 prop · [2026-07-14] · Lead（game-g 台账化撞到控件缺口）→ 主程（ui/components 控件集） · status: **✅ done（主程亲手·批29·2026-07-15）** · 类型: 基座控件扩 prop（additive·非逃生）
> **缺口**：引擎 `PlayingCard` 控件只有正面 `art`，无牌背贴图 prop——game-g 台账 art-59（牌背图）出图后无处消费。
> **要做（主程·render.ts+types）**：`PlayingCardProps` 加可选 `backArt?: string`（已解析 URL·背面替代现程序化背纹·缺省观感零变）；翻面/背面渲染点接入；加一条 render 测试。到位后 game-g 覆盖装载已有的 tex 通道直接接。
> **✅ 完工回执（批29·owner 07-15「不只立绘，还有按键/背景/牌面」）**：`backArt?: string` 落 types+render+catalog（faceUp:false
> 整面 cover·替代纹样字符与 backPattern·无=原样零变）；render 测试 2 断言组（playing-card.test）；game-g 主页 duel-back 已接
> （覆盖在场才设）。同批一并下沉 **UITheme.buttonSkins 主题级按钮皮槽**（kind→{skin,skinSlice}·node 级 skin 优先·一个 kind
> 一张皮全游戏一体换），game-g 三主题挂 getter、台账扩 art-61~63（btn-hero/primary/ghost）、对战屏背景板 art-56 接线毕。

### REQ-PA-3D公用货架 · Free Library 增公用 3D 基础素材 + 3D vendoring + 本地目录标准 · [2026-07-04] · owner 拍板 → **指派：PA（资产侧 ①②③④a）· P3D（游戏侧切换 ④b）** · status: **PA 侧 ✅ done（①②③④a·分步全绿推）；④b 转 `requests-3d.md`「REQ-3D-货架接入」待 P3D** · 类型: 架构补全（vendoring 模型的 3D 半边·真缺口）
> **PA 施工回执（2026-07-04·分步全绿推）**：① 货架备料工具 `scripts/gen-shelf-3d.mjs`——11 材质(数据型 `mat/*`)+3 基础 mesh(程序化 glb `mesh/plane|cube|sphere`·three GLTFLoader 实测可解析)+3 程序化贴图(`tex/plank_*`·usage 闭集)+1 渐变天空盒(`env/sky-gradient`·纯 Node PNG)。② `vendor-asset.mjs` 支持数据型(material 无 path·免 copy)+文件型(mesh glb/贴图)——`game-z` vendor 了 mat/mesh fixture，`vendor.test` 覆盖两路。③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 已写进 `playbooks/assets.md ⑥`。④a 程序化贴图产进货架。守护测 `src/assets/shelf-3d.test.ts`。
> **owner 愿景**：Free Library = 统一货架（2D + 公用 3D 基础素材）；每游戏开工按需 vendor 到本地美术目录，一律不直引货架。
> **现状核对（PA 2026-07-04）**：2D ✅（`vendor-asset.mjs` + 游戏本地 `art/index.json` 已通）；3D ❌——共享 `assets/index.json` 全 2D（type 仅 texture+1 sound·零 mesh/material/hdr）；程序化贴图散落 `public/textures/` 被游戏直引（=反 vendoring 例）；3D 素材各游戏自持、无公用货架。
> **四步**：① 共享 3D 货架——登记公用数据资产进 `assets/index.json`(+spec)：基础 mesh(cube/sphere/plane glb)、材质(pbr 预设降为 `type:'material'` 数据条目)、程序化贴图(gen-textures 产物登记)、天空盒(1–2 CC0 HDRI ≤2k)。② 扩 `scripts/vendor-asset.mjs` 支持 copy mesh/material/hdr 进本地并携 spec(scale/colorSpace/genCollision)+补测(现仅测过 2D)。③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 写进 `playbooks/assets.md`(PA handoff backlog #4 收口)。④a gen-textures 产物改「产进货架」而非散落。④b（P3D 域·转 `requests-3d.md`）game-z/game-d 停直引 `public/textures/` → 改从本地 `art/` vendor。
> **边界**：`MaterialSpec/MeshSpec` 已存在(不新增 schema)；渲染消费端已就绪(P3D render 半定稿)。PA 分步推、门禁全绿；碰渲染/游戏代码先知会 P3D。

### REQ-QC-三门复查·流程板加「复查门」+ S7 评分卡长机器牙齿 · [2026-07-15] · owner（「每步要有其他 session 复查/自检·品质比想象低」+「美术下限非常低·要的是原来那个自检打分管线」）→ Lead 诊断+施工 · status: **✅ done（Lead 亲手施工 2026-07-15·门禁全绿直推 mainbranch·已在 block-blast-mini 真演闭环）** · 优先级: **P0（owner 主诉·品质防线）** · 类型: 生产流程基建（质量控制层）
> **Lead 诊断（品质为什么低）**：①机器门全测「能不能跑」不测「好不好」（bench 70=能跑≠好玩好看）；②品质所在的 S6/S7 恰是纯人门无机器牙齿——session 跑完 S3-S5 机器绿即宣布完成，S6/S7 实际被跳过；③无第二双眼睛——session 自己给自己打分（game-k 病根），唯一独立检查=owner 本人签不过来。**你给的八维评分卡（REQ-ART-TGS A）此前只挂在文档里、没接进流程当门——「美术下限低」正是这缺口。**
> **✅ 落地（三门制）**：每关=机器门（真跑）→ **复查门（另一 session 按清单对抗性核证·落账）** → 人门（owner 签）。`game-pipeline.mjs` 新增：`checklist <slug> <SN>`（打印该关复查清单·复查 session 开工第一命令）、`review <slug> <S2|S3|S4|S5|S8> --verdict PASS|CONCERNS|FAIL --note --by`（空 note/无 by 拒收·绑内容指纹·游戏一动复查过期）、`scorecard <slug> --scores "八维:0-3" --by --note`（**S7 品质关机器牙齿=评分卡落账：任一维 0 分=该关红灯·全维≥2 才 premium·八维必须全打不得跳维**）。看板三行门态·status=三门合成（复查 FAIL=整关红）。豁免：S1（owner 亲提）、S6（复核已内嵌美术平台逐行 ☑）。新手册 `docs/playbooks/review-gates.md`（复查 session 工作法+防橡皮图章红线）；回填 game-production.md/index.md/testing.md。
> **真演闭环（block-blast-mini·复查门首战战果）**：独立复查 agent 照单复查——S2 PASS·S3 PASS·S4 **CONCERNS**·S5 **CONCERNS**·S7 评分卡 **VISUAL: 5/24 · PREMIUM: NO**（世界密度/材质/渲染管线/VFX=0 → 板上红灯）。**复查逮出施工方（Lead 本人）没报的 5 个问题**：①游戏未注册进 launcher=玩家无入口；②终局只置 Flag 不可见+此后拖拽静默拒=软锁；③托盘槽形状不可见（与已登记的高亮预览是两回事）；④audit 对 builtin 纯数据游戏误报「零能力接入」（工具不扫 public/games manifest·待小单修）；⑤S8 证据过期须重跑。①②③=block-blast-mini 续做工作项（S4/S5 复查 note 在案）；④=审计工具小缺口（待单）。**这正是复查门的存在证明：机器门全绿的东西，另一双眼睛仍逮出一把真问题。**测试：`scripts/game-pipeline.review.test.mjs` 8 例（复查语义/评分卡语义/三门合成/FAIL 压过机器绿/指纹过期/豁免关不受扰）。
> **给 PST 的接续单**：工坊生产板 UI 现只显示机器门/人门两行——board JSON 已加 `review` 字段（additive·端点自动透传），请 PST 在 GamePipelinePanel 补第三行「复查门」显示 + scorecard 摘要（照 CLI 版式）。**诚实边界**：复查门抬的是「纪律+品质下限」；游戏好不好玩仍靠 S7 评分卡+owner 试玩，工具替代不了人的品味。

### REQ-STAB-系统调度依赖图 lint（积木稳定性工具）· [2026-07-13] · owner（「评估分层 Tier 积木稳定性」→ 批建议①）· status: **✅ done（Lead 亲手施工 2026-07-13·门禁全绿直推 mainbranch）** · 优先级: P2（架构健康基建） · 类型: 稳定性工具（引擎调度分析）
> **背景（Lead 积木稳定性评估结论）**：分层/测试/确定性/护栏都强，唯一规模化脆点=**系统调度定序网**（42→现 83 条手动 runsBefore/runsAfter 边靠人肉维护·共享组件 RMW 易成环）。引擎 topological-sort 在 load 时硬失败兜底（不静默 desync），但报错把「环+一切被卡下游」全列出（over-report）、不指哪条边闭的环——加新积木定序费脑。此工具把「反应式 load 抛错」升级成「主动可视化 + 精确切环」。
> **✅ 完工（Lead 2026-07-13）**：`src/assembly/system-graph.ts`——与引擎 topological-sort 边模型**逐条对齐**（组件推断边+显式覆盖+phase 分桶），**Tarjan 精确切最小 SCC**（vs 引擎 over-report）+ 点名闭环 RMW 组件 + 破环建议；检出两类恒为 bug 的形态：**悬空显式边**（runsBefore/runsAfter 指不存在系统=静默失效）、**重复 system id**。CLI `scripts/system-graph-audit.mjs`（vite-node·判词 `SYSTEM-GRAPH: PASS|FAIL`）：无参=全局体检（SCC 作信息·全局超集环非 per-game bug）；`<capId…>`=**查某游戏能力子集共装会不会 load 抛环**（这才是真问题·退出码 1）。
> **实测**：全局 67 系统/83 显式边·**0 悬空/0 重复**·Tarjan 切出 4 个全局超集环（phase0 的 36 系统巨环=核心组件 RMW·现实从不同装）；子集 `t2-bounds-clamp t2-facing` 即报「共装会抛环·闭环组件 Transform」——工具当场逮出真实潜在定序张力。门禁：`src/assembly/system-graph.test.ts` 10 例（真数据硬不变量 0 悬空/0 重复 + 每能力自身可排 + **与引擎 topo-sort fidelity 对拍**：2元/3元环检出即引擎真抛、显式破环即不抛）。回填 testing 手册。tsc 0 · vitest **2462** · build 0。
> **建议②（组件清单守卫）✅ done（Lead 2026-07-13·owner 批「做一张会自动报警的清单」）**：`scripts/component-manifest-guard.mjs` 扫 protocol/components 全部 `readonly type:'X'`（118 个共同零件）对比冻结基线 `component-manifest-baseline.json`；加/改名/删任一组件而没同提交 `--update` 更新基线 → `COMPONENT-MANIFEST: FAIL` 退出码 1（改动逼进 diff·防共同语言静默漂移搞坏在用它的游戏）。门禁 `scripts/component-manifest-guard.test.mjs` 5 例（当前=基线 + diff 检出自证）。回填 testing 手册。**建议③（版本纪律 semver 化）未做**·偏纪律可缓·另立待 owner 批。

### REQ-CAP-grid-drag-square-方形网格拖放输入桥（Block Blast 核心机制②）· [2026-07-13] · GD/PE（Block Blast）报缺口（本地 Workshop·未走上传·owner「别等上传直接做」）→ Lead 评审下沉 · status: **✅ done（Lead 亲手施工 2026-07-13·核心落子桥·门禁全绿直推 mainbranch）** · 优先级: P1（Block Blast 核心·与①配对） · 类型: 引擎 capability 下沉（Tier2 输入桥·引擎域）
> **Lead 评审（CORE RULE）→ 认缺口·接受**。①能否重组→不能：`t2-drag-place` 只 `snap:'hex'`（写 HexPos·移动单个持久实体上场），本机制是**方形吸附 + polyomino 盖章**（消耗托盘形状、产放置意图·非移动实体）·输出路径与坐标系全不同。②已覆盖→没有。③真缺口→下沉 Tier2 输入桥 `t2-grid-drag-square`（与 drag-place 同层同定位·方形+盖章）。
> **✅ 完工（Lead 2026-07-13）**：`src/skills/tier2/grid-drag-square.ts`——纯函数 `squarePointToCell`（世界点→就近方格·导出可测）+ 一系统：读壳层 `drag` 动作→命中 `BlockTrayPiece` 托盘块取 slot→终点吸附方格 (col,row)→写 `PlaceBlockIntent`（block-grid 接缝·`runsBefore block-place` 同拍消费落子）。新组件 `BlockTrayPiece{boardId,slot}` + `BlockGrid` 补方格几何 `{originX,originY,cellSize}`（可选·向后兼容）。注册 tier2/index + registry（能力 85→86·registry-guard/catalog 绿）。
> **数据驱动实证**：纯 JSON manifest（`['t2-grid-drag-square','t3-block-grid']` + 托盘块 + 注入 drag）→ 1 tick：拖起点命中托盘块→终点吸附格(2,0)→写意图→block-grid 落子该格 + 用掉槽，一拍到位。**测试**：`grid-drag-square.test.ts` 6 例（纯吸附 3 组 + 集成：命中落子/未命中不产/无几何 no-op）。门禁：tsc 0 · vitest **2452** · build 0。
> **残项（诚实登记·未做·需你/GD 定）**：**拖拽中「合法/非法高亮预览」未做**——本引擎输入模型 `drag` 动作只在**松手**合成（起点+终点），实时 hover 需壳层开 `PointerInputSource` 的 `opts.move` 流 + 一套「预览高亮」渲染约定（引擎无先例·是新面）。当前落子桥不依赖它即完全可玩（Block Blast 无 ghost 预览也能玩·只是少一层手感）。高亮预览作独立后续件：需定 ①开 move 实时流 ②预览怎么表达成数据（临时 Color 覆盖 / 新 Preview 覆层组件）+ 走 render 组件的接法。待裁。

### REQ-CAP-block-grid-方块网格棋盘能力（Block Blast 核心机制①）· [2026-07-13] · GD/PE（Block Blast）报缺口 → Lead 评审下沉 · status: **✅ done（Lead 亲手施工 2026-07-13·门禁全绿直推 mainbranch）** · 优先级: P1（Block Blast 核心·没它游戏跑不起来） · 类型: 引擎 capability 下沉（Tier3 算法机·确定性关键·引擎域）
> **Lead 评审（CORE RULE·独立核实非照单收）→ 认缺口·接受**。①**能否重组**→不能：多格 polyomino 落点合法性 + 整行整列扫描消除 + 无子可落判负=带网格扫描/循环的算法，`Condition→Event→Effect` 反应式布尔表达不了（match3-board 当年下沉为 Tier3 的理由一字不差）。②**是否已覆盖**→没有：读码实锤 `t2-drag-place` 只支持 `snap:'hex'`（写 HexPos·单实体单格·无方形无 polyomino）；`t3-match3-board` 是「交换→三连→重力→补块」正交规则；`t2-tray` 只是一排槽位。三者都表达不了。③真缺口→下沉新 Tier3 `t3-block-grid`。④非游戏专属：Block Blast/Woodoku/俄罗斯方块类通用·config 驱动（最弱 LLM 只填棋盘尺寸+形状定义+计分参数纯数据）。
> **✅ 完工（Lead 2026-07-13·纯数据可跑已验）**：`src/skills/tier3/block-grid.ts`——纯函数核 `canPlace/applyPlace/fullLines/clearLines/canPlaceAnywhere/anyTrayPlaceable`（导出可测·整数网格·零裸随机）+ 两系统 `block-place`（消费 `PlaceBlockIntent{slot,col,row}`→判定/落子/消整行整列/`ResourceModify` 计分/托盘 `RandomSeed` 确定性补形/`Flag` 判负）+ `block-view-sync`（据 cells 写 `BoardCell.Color.tint`）。新组件 `BlockGrid`/`BlockShapeDef`/`PlaceBlockIntent` 入 `components/cardboard.ts`；注册 `tier3/index` + `capability-registry`（ALL_CAPABILITIES 84→85·registry-guard 绿·已入 buildCapabilityCatalog 供 LLM 消费）。
> **数据驱动实证**：纯 JSON manifest（`capabilities:['t3-block-grid']`）→ parseManifest→load→1 tick：单格落 (2,0) 补满行0→整行清空→托盘确定性补形，全绿。**测试**：`block-grid.test.ts` 17 例（纯函数 6 组 + 引擎集成：放置/消行计分/非法拒绝/确定性补形/判负/视图同步）。门禁：tsc 0 · vitest **2446** pass · build 0。
> **接缝（给缺口②）**：放置意图走 `PlaceBlockIntent` 组件——**配套输入桥 `grid-drag-square`（方形吸附+polyomino 预览+合法/非法高亮）作为缺口②另立**，写同一 Intent 即插入；本能力只管「判定+结算」，现可由点击/测试直接驱动。
> **治理提示**：Block Blast 的 `capability-plan`（`docs/design/<game>/capability-plan.md`）我在库里**没找到**——按铁律新游戏开工前须交能力总览过审，请补齐（本次先下沉了无争议的通用缺口①·符合 owner 07-11 capgap 快速通道 + 「能出复杂的东西=第一要素」价值序）。缺口②`grid-drag-square` 待 GD/PE 正式报单，我再评审下沉。

### REQ-VECTOR-ART-美术资源统一「贴图 | 程序矢量」一等 resolver · [2026-07-13] · owner 提出统一抽象 → PST 评审接受·建步1 proof · status: **✅ 三步全落·Lead 验收通过 2026-07-14（步1 ✅PST 763738c5·步2 ✅PST 01347725·步3 ✅Lead 0474b1a4）** · 优先级: P1（owner 主诉·代码游戏安全换皮的地基） · 类型: 能力下沉候选（引擎资产 resolver·Lead 域）
> **owner 洞见（PST 评审=对·宪法方向）**：美术资源 = 一个**统一间接层**——台账/索引里一个条目 resolve 出来的可以是 ①raster 贴图 也可以是 ②procedural/vector 矢量描述；**底层两者一回事**（都是"这个槽当前长这样"）。把游戏当前所有矢量图**变成索引条目**（指向矢量描述），美术资源统一、可安全热替换。
> **现状（机读真相）**：`src/assets/asset-index.ts` 的 `AssetType` = texture/mesh/material/sound/animation/video/font——**无 procedural/vector 一等类型**；`resolveArtRefs` 只解 `art:<query>`→FreeArtLib 精灵（raster）。程序化美术（如 game-g `art-textures.ts`/`portraits.ts`）活在渲染代码里·不进索引·渲染直接调=二等公民。**统一抽象底层未落地=真缺口。**
> **三步安全落地（帧回归兜底·数据驱动·绝不改蓝图逻辑）**：
> - **步1（PST·已做·非破坏）**：把 game-g 52 名将立绘（portraits.ts）+ 绿呢底纹（art-textures.ts）**落成真 .svg 矢量文件** + 美术台账索引（`source:procedural·style:vector`）→ `public/games/game-g/art/`（`scripts/game-g-art-index.mjs`）。游戏美术库直接显示 53 条矢量美术·**只写文件不碰渲染**（game-g 211 测全绿·含帧回归）。
> - **步2（渲染指向索引·程序B/owner 授权 PST 代做·golden 帧保命）**：art-textures/portraits 的取图改成**先查索引**（默认条目=当前程序化输出）→ 渲染"指向美术库"但观感零变（`__frames__` diff 全绿证零变）。
> - **步3（真下沉·此单·Lead/引擎域）**：引擎加**一等 `procedural`/`vector` 资产 + resolver**——`textureKey → 索引 → (生成器 | raster 文件)` 统一解析·保参数化（如 game-g 双皮 玄铁金/锦霞）。落地后每条目**热替换**（矢量↔真图·重设计矢量·渲染代码零改）。
> **请 Lead 裁**：a) 认不认此缺口（vs 现「贴图 data-URI 塞 path」够用）；b) resolver 契约定形（新 AssetType `vector`？还是 texture + `spec.generator`？参数化怎么带）；c) 派工。加测试证「同一 textureKey·索引指 raster vs 指 vector·渲染都对·切换零改调用点」。
> **⚖ Lead 裁决（2026-07-13·契约定形·施工认领）**：
> **a) 认缺口**。统一间接层方向=对（owner 洞见成立）：参数化程序矢量不进索引就永远是二等公民——换皮/热替换/台账都够不着它；「data-URI 塞 path」只覆盖**静态**矢量（步1 落盘的 .svg 文件即此类·已够用），**参数化生成器**（双皮 fill/stroke 令牌类）是真表达不了的缺口。
> **b) 契约=texture + `spec.generator`（不加新 AssetType）**。理由：type=消费契约——渲染器拿到的一律是可绘贴图，矢量/程序化是**来源**细节不是消费类型；单独 'vector' 型会叉开每个消费开关（Sprite/皮肤槽/台账/打包全要分叉），而 spec 判别=既有先例（material 数据型免 path 同款）。定形：①索引条目 `type:'texture'` + `spec.generator = { name, params? }`（params 值限 number|string|boolean·纯数据）·带 generator 者免 path（spec 闭集 schema 注册期校验·name 必须在生成器表内）；②引擎新增 `src/assets/texture-generators.ts` **生成器注册表**：`registerTextureGenerator(name, fn)`（fn: params→data-URI·**确定性纯函数**·禁随机/时钟/IO）+ `resolveGeneratedSrc(entry)`；③接线=AssetManager register/resolve 期把 generator 条目解析成 `src=data-URI` → loader/渲染器/皮肤别名/打包全线零改；④**热替换语义**：同一 textureKey 的条目在 `path`（raster）↔ `spec.generator`（矢量）间切换=只改索引数据·调用点零改；⑤参数化=params 全在索引（game-g 双皮=同 generator 两组 params）；⑥game 专属生成器（coinLatticeTile/portraits）在 game 模块 `registerTextureGenerator` 登记（编译线），通用花纹类可后续下沉共享。
> **✅ Lead 对抗性验收（2026-07-14·全过）**：①步1——53 条索引过引擎 parseAssetIndex 真校验、53 个 .svg 文件真身在盘、只写文件不碰渲染 ✓；②步2——覆盖注册表语义正确（命中真图/未命中回退程序化·现全程序化条目=观感零变），「没加载完就不画」时序论证成立（大厅无立绘=同步渲染保集成契约·立绘子屏打开前覆盖已后台就绪），绝对路径 path 与取用方式自洽，game-g 214 测全绿含帧回归 ✓；③game-d 台账 83 行 ✓；④审计：AUDIT FAIL=存量基线债（8/29/31 与 audit-baseline 一字不差），RATCHET PASS=本系列零新增红旗 ✓。**两条非阻塞备注**：a) game-g 索引 path 用绝对形态（与 registerAssetIndex(baseUrl) 相对约定不同——现消费端自洽；日后接 AssetManager 用 baseUrl='' 即可，勿双前缀）；b) 下一步顺理成章=双皮参数化底纹迁 `spec.generator` 条目（吃步3 契约·registerTextureGenerator 登记 coinLatticeTile 族），PST 可接。
> **c) 派工=Lead 亲手**（引擎资产层·确定性关键·REQ-PKG 先例不下放），即刻排期。测试按 PST 原单四腿：raster/generator 同 key 都渲染、切换零改调用点、生成器确定性（同 params 同 URI）、spec 校验负腿（未注册 name/坏 params 拒）。步2（渲染指向索引·golden 帧）待步3 落地后 PST 接续。

### REQ-PKG-数据游戏打成独立可运行包·引擎「从内联 manifest 启动」钩子 · [2026-07-12] · owner（workshop 发布屏「打包下载=直接可运行文件」）→ PST 建流程撞到真缺口 · status: **✅ done（Lead 亲手施工 2026-07-12·web 单文件线·门禁全绿直推 mainbranch·待 owner 真机双击验收）** · 优先级: P1（owner 主诉：要能打包"我生成的游戏"·非样例） · 类型: 能力下沉候选（发布线×引擎·game-publisher/Lead 域）
> **✅ 完工回执（Lead·2026-07-12）**——CORE RULE 评判：**认缺口·接受**。判据：①「重组现有能力」尺子对**游戏内容**不对**发布/构建基建**（此为引擎团队代码本分·非游戏数据）；②功能未覆盖——`build:cartridge:single`(VITE_SINGLEFILE) 只认工程游戏静态 import（`VITE_TARGET_GAME`→`src/games/<id>`），库卡带是运行时 fetch 的纯数据 manifest，离线无服务器可 fetch=真表达不了；③修法=最小确定性钩子把**既有解释器**（parseManifest+Engine.load+CanvasRenderer·与 `DataCartridgeRunner` 同一条路）接到内联数据源，非新游戏逻辑、不碰引擎核。契约裁决：**a)** 认缺口；**b)** Lead 亲手施工（小·自包含·确定性关键路径），不派；**c)** 全局名/脚本契约定形见下。
> **落地**：① 抽 `src/studio/cart-run-core.ts`（`runBlueprintInto`+键盘接线+装载探针·从 `DataCartridgeRunner.RunOnly` 抽出·在线/离线共用一条路杜绝语义漂移）；② 引擎钩子 `src/cartridge-inline-run.ts`（读 `window.__APOLLO_INLINE_CART__` manifest 对象·可选 `__APOLLO_INLINE_META__={title,subtitle}`→parseManifest→跑·未注入/坏稿明报不白屏）；③ `cartridge-entry.ts` 加 `__inline__` 分支（静态可 DCE·工程游戏不牵连进数据运行时）；④ `scripts/package-web.mjs <slug> [out]`（`VITE_TARGET_GAME=__inline__`+`VITE_SINGLEFILE=1` 构建通用外壳→内联 manifest 进 `<head>`·覆盖 title·**自包含体检**无 http(s) 外链才落盘）；⑤ apollo `_pkg_build_platform` web 分支：库卡带（不在 `_CARTRIDGE_ENGINE_GAMES`）→ 走 package-web，工程游戏路径原样。
> **契约定形（apollo 按此调·已接）**：全局 `window.__APOLLO_INLINE_CART__`=manifest 纯对象；可选 `window.__APOLLO_INLINE_META__`={title,subtitle}；脚本 `node scripts/package-web.mjs <slug> [outFile]`（缺省 `release/<slug>/<slug>.html`）。
> **测试**：`src/cartridge-inline-run.test.ts`（5·readInlineCart 契约+**内联 manifest 空跑 2 tick**+mount 出 canvas+坏稿引爆）；`scripts/package-web.test.mjs`（12·注入顺序/title/`</script>`转义/自包含扫描/卡带读取）；`scripts/package-web-smoke.mjs`（opt-in 端到端真构建·Lead 亲跑=**222KB 自包含单 HTML·零外链·manifest 真内联** PASS）。门禁：tsc 0 · vitest **2429** pass · build 0。
> **残项（诚实登记·未做）**：① manifest 里 `art:` 引用**打包期未解析**→离线包退化占位（art: 解析 + FreeArtLib/资产 base64 内联=后续件·纯 Shape/Color 游戏含全部模板起步款已完全离线可跑）；② Mac/Win 桌面库卡带（electron 装该单文件）未接，本次只做 owner 主诉的「网页版单文件双击即玩」。二者可另立单。
> **owner 诉求**：workshop 发布屏——每游戏选平台「打包」→「下载」出**直接可运行**产物（网页版=单文件双击即玩·Mac=.dmg）。**每平台一行·打包/下载并列**的 list（PST 已做）。
> **PST 已落地（本次·apollo.py+壳·门禁绿）**：① 发布屏改造成「每游戏 × 每平台（网页版/Mac/Win/掌机/工程包）· 打包 · 下载」并列 list；② apollo 后台打包任务 `POST /api/package/job`{slug,platform} + `GET /api/package/job?id=` 轮询 + `GET /api/package/download?id=` 取产物；③ **内置工程游戏（e/f/g/x）真打包**：网页版=卡带单文件自包含 HTML（`VITE_SINGLEFILE`·实测 game-g→5.8MB·0 外链·双击即玩）、掌机=build_game.py、Mac/Win=electron-builder（非 macOS 诚实拦截给命令·不伪造）。
> **真缺口（此单）**：**生成的库卡带（纯数据 manifest）打不成独立单文件/桌面包**——现 cartridge/electron 管线只认 `src/games/<id>` 工程游戏（`VITE_TARGET_GAME`）；生成的游戏是 `library/<slug>` 数据，运行时靠**在线 fetch** manifest（`?game=lib:<slug>`），离线单文件里没服务器可 fetch。
> **要下沉的能力（manifesto 对味：游戏=数据·引擎=解释器；打包=引擎 bundle + 内联数据）**：**cartridge/launcher 引导层能「从内联 manifest 启动」**——读一个注入的全局（如 `window.__APOLLO_INLINE_CART__`=manifest 对象）时，走既有 parseManifest+load 路径直接跑它，跳过 fetch。配一个 `scripts/package-web.mjs <slug> <out>`：把运行时 bundle + 该 slug 的 manifest 内联进**单个自包含 HTML**（file:// 双击即玩）。落地后 apollo `_pkg_build_platform` 的 web 分支对库卡带即通，桌面同理（electron 装该单文件）。
> **边界**：钩子在 **cartridge 引导/launcher（非 `src/{engine,skills,assembly,renderer,services,net}` 锁定引擎核）**+新 build 脚本+vite cartridge 配置=**发布线（game-publisher）/Lead 域**；PST 不擅改。**请 Lead 裁**：a) 认不认此缺口（vs 现 zip 够用）；b) 派 game-publisher 还是并入 REQ-PUBLISH；c) 全局名/脚本契约定形（apollo 按此调）。加一条测试证「输出自包含+能从内联 manifest 空跑 2 tick」。

### REQ-QA-发行测试假信心修 · mock-steam 排序 / achievements 幂等 断言补全 · [2026-07-04] · 主程（测试意义性复核撞到）→ **发行工程师（PS）域** · status: **✅ done（PS 2026-07-04·两处断言补全 + 自证红·门禁全绿）** · 优先级: P2（小·非阻塞·但属「假信心」测试=比没测更糟） · 类型: 测试正确性修（断言没验测试名声称的行为）
> **✅ 完工（PS 2026-07-04）**：① `mock-steam.test.ts` 排行榜——给 `leaderboard` 事件补 `board` 快照（经既有 `onEvent` 通道观测·不碰 SteamBridge 契约/不耦合 LS key），断言乱序上传 30/90/60 后榜单 `[90,60,30]` 降序 + 严格非递增。② `achievements.test.ts` 幂等——改为 toast 计数：同端口再解锁 + 跨持久化二次端口解锁，均断言仍恰 1 个 toast（旧断言只验 `isAvailable` 常量）。**验收自证**：临时去 mock 排序 → ① 红（`[30,90,60]≠[90,60,30]`）；临时去幂等守卫 → ② 红（`expected 2 to be 1`）；恢复后 tsc + vitest(2245) + build 全绿。边界内（仅两 `*.test.ts` + mock 事件补 `board` 字段）。
> **源起**：主程 2026-07-04 全库测试意义性复核（4 子代理分片精查）发现两条**「假信心」测试**——测试名声称测了某行为，但断言根本没验它，被测逻辑改错也照绿。均在 `src/services/platform`（PS 域），故派 PS 修（Lead 出诊断 spec，PS 施工）。
>
> **① `src/services/platform/mock-steam.test.ts:22-30`**：测试名意在「排行榜高分在前」，body 只 `uploadLeaderboardScore` 三个分数、**从未断言返回/查询的榜单是降序**。→ mock 若升序或不排序都不会红。
> - **修复须证**：上传三个乱序分数后，查询榜单，断言**按分数降序**（高分 index 更靠前）；至少断言「更高分不会排在更低分之后」。若 mock 当前实现未真排序，一并把排序补上（这才是被测行为）。
>
> **② `src/services/platform/achievements.test.ts:28-30`**：声称验「toast 幂等」，实际只断言 `port2.isAvailable() === true`（一个 mock 常量），**幂等从未被检查**。
> - **修复须证**：对同一成就 `unlock` 两次，断言 **toast/解锁只触发一次**（数 toast 调用次数，或验解锁集合幂等/已解锁不再回调）。
>
> **验收门槛**：改完两处断言在「故意打断被测行为」时**真会红**（PS 自证：临时把 mock 排序去掉 / 幂等去掉 → 测试应红）；tsc+vitest+build 全绿直推 mainbranch。**边界**：只动这两个 `*.test.ts`（必要时连带补 mock 的真实排序/幂等实现·仍在 PS 平台域内），不外溢。

### REQ-STUDIO-低模生成四件 · owner 用 deepseek 实测暴露「词汇灌注≠弱模友好」 · [2026-07-06] · owner 实测（3 轮校验不过·184k tokens/单局）→ Lead 诊断出图 → **指派：Opus** · status: **✅ done（Opus·2026-07-06·门禁全绿直推·待 Lead 真浏览器验收 + owner 真 deepseek 重测）** · 优先级: **P0（owner 实际堵点·创作台核心命题）** · 类型: 产品化·生成管线架构
> **Lead 验收（2026-07-06）REVIEW: PASS**：独立复跑门禁全 0 + smoke 44/44 + 真浏览器 e2e 12/12；引擎域零触碰核实（错误改写/词汇裁剪全在 apollo.py 侧·manifest-check 一字未动=正确的分层）；词汇裁剪实测 41.9k→10.4k 字符（-75%）·重试轮仅 +1.8k（轮次裁剪生效）。**剩最后一步实测留 owner：真 deepseek key 同题重测（目标 ≤1 轮通过·对比 184k 基线）——本环境无 key。**
> **✅ 完工回执（Opus·2026-07-06·四件 + 交互日志一批）**：
> **① 模板起步+增量修改（默认路径·最大杠杆）**：apollo.py `TEMPLATE_LIBRARY` 6 模板（**逐个过 manifest-check 全绿**）——`bounce`(弹跳小球)/`platform-jump`(平台跳跃·收编 PRESET)/`pong`(弹球对战·收编 PRESET)/`collect`(收集金币)/`dice`(掷骰子)/`cards`(卡牌桌)。新 `mode:'template-edit'`：关键词选最近模板 → prompt=「这是能跑的基线 manifest + 用户想法 → 输出**修改后的完整 manifest**」→ autofix 硬校验回路。前端 `CreationWizard` create 态加「生成方式」双选：**「从模板改」（默认·各档模型都稳）/「自由生成」（从零·适合强模型）**；预览态标注「基于「X」模板修改」。
> **② 词汇按题材裁剪**：关键词→模板+能力族纯数据映射（`TEMPLATE_KEYWORDS`/`CAPABILITY_FAMILIES`/`_BASE_ATOM_IDS`）；`_slice_catalog` 把前端送来的**全量** catalog（82 能力·41.9k 字符≈10k tokens）按能力 id 切块 → 只留「基础原子(13)+模板已用族+题材族」子集。**样例**：`掷骰子`→模板 `dice`·族 `[dice,ui]`→子集 **10.4k 字符≈2.6k tokens**（裁掉 ~75%，排除 match3/3D 等无关能力·字节稳定可缓存）。校验错误点名**被裁掉的真实能力**时 `rebuild_system` 下轮补该族全量（`bounce` 子集遇 `t2-dice-roll` 错误→补 `w1-random`/`t2-keybind` 整族）。
> **③ 校验错误 LLM 化**（侵入最小=apollo.py 侧 `_llm_ify_error` 映射层·不改引擎校验器）：**对照**——① 前 `manifest: 未知 capability id: zz-bogus（不在能力注册表内）` → 后「capabilities 数组里出现了目录中没有的能力 id：\`zz-bogus\`。把它们删掉，或替换成"能力目录"里真实列出的 id」；② 前 `组件数据类型错误 —— ball.Velocity.vx —— Velocity.vx 应为 number，实为 string` → 后「实体 \`ball\` 的组件 \`Velocity\` 的字段 \`vx\` 必须是 number——把它的值改成 0 这样的纯数字（不要加引号）」。回喂只带「上轮 manifest + 本轮错误指令」，**裁掉更早轮次失败输出**；`fixed_errors` 仍留原始错误供前端「查看原始校验错误」区块。（前端半件·显著区块=前批已 done。）
> **④ token/缓存卫生**：system+子集 catalog 逐轮字节稳定（不重排重拼·最大化 provider 前缀缓存）；每轮记 `promptChars`。**每轮对比样例**（同一次生成）：`template-edit`=17116(pass)｜坏轮 17111(fail)｜`autofix-2`=18910(pass)——**重试轮只 +1.8k**（回喂上轮 manifest+错误指令），非累积历史失败的超线性膨胀。对比 184k 基线的病根「每轮全量 catalog ~10k tokens 从零作曲」：模板路径每轮 catalog 降到 ~2.6k tokens + 只改基线（输出小、闭集内）。
> **⑤ 交互日志（心跳单第 0 项）**：apollo.py 每次 LLM 往返落一行 JSONL 到 `.apollo/llm-logs/YYYY-MM-DD.jsonl`（新 gitignore）：`{ts,provider,model,mode(chat|generate|revise|prototype|breakdown|template-edit|autofix-k),promptChars,responseChars,validation(pass|fail|skip|n/a|error),errors[截断200],elapsedMs,usage?}`。**API key 绝不落盘**；全文默认不落，`APOLLO_LOG_VERBOSE=1` 才落 prompt/response 全文（全文仍无 key·key 只在 HTTP 头）。**样例行**：`{"ts":"…","provider":"mock","model":"mock","mode":"autofix-2","promptChars":18910,"responseChars":612,"validation":"pass","errors":[],"elapsedMs":1}`。今天「三轮失败是什么」从此 `cat` 一下就有答案。
> **测试**：新 `scripts/studio-lowmodel-smoke.py`（**44 断言全绿**·mock·模板全绿+关键词映射+子集裁剪+家族扩+错误改写+日志 schema+**弱模基准 `APOLLO_MOCK_BAD_MANIFEST_N` 自证**：坏 manifest 一轮→指令化回喂+轮次裁剪+attempts=2 修复通过）；新 `scripts/studio-lowmodel-e2e.mjs`（playwright·**12 断言全绿**·「从模板改」全链真浏览器旅程：新建→快速生成→双选默认从模板改→骰子创意→预览 canvas+模板标注→入库→切自由生成仍可生成·零 console error）；`scripts/dump-capability-catalog.mjs`（catalog parity 工具）；vitest `creation-wizard.test.tsx` +1 例（默认 template-edit / 切自由生成无 mode / 预览标注）。**门禁**：docs-ref-guard PASS · tsc 0 · vitest **2315** pass · build 0 · `ast.parse(apollo.py)` OK · 存量 studio-design/draft-smoke 零回归。**真 deepseek 同题重测（目标 ≤1 轮修复·对比 184k）本环境无 key→留 owner/Lead**。边界：`apollo.py` + `src/studio/CreationWizard.tsx` + `.gitignore` + 3 测试/工具脚本。
> **实测证据**：deepseek 做"最简单的游戏"——自动修复 3 轮仍未过校验；单局 184,368 tokens（输入 171k：缓存命中 122k + 未命中 49k；输出 13k）。**流程本身是"读规则"的**（system=manifest 骨架+全量自动 catalog"single source of truth, do not invent"+art 词汇+Rules+最小样例；校验错误逐轮回喂）——但对弱模型仍失败，病根=让弱模型**在 81 项词汇表里从零作曲**。
> **spec（Lead 图纸·四件）**：
> 1. **模板起步+增量修改（最大杠杆）**：简单请求不再从零生成——按题材选最近的**能跑模板 manifest**（示例卡带库），LLM 只做增量修改（改名/改数值/换实体/换 art 词）——输出小、闭集内、校验通过率数量级提升。生成模式二选一入口：「从模板改」（默认）/「自由生成」（强模型才建议）。
> 2. **词汇按需裁剪**：catalog 全量≈28k 字符（~8k tokens/轮）——按请求题材注入**子集**（如卡牌请求=卡牌族+基础原子 ~3k tokens），子集选择用关键词映射表（纯数据），漏词汇时校验错误会点名→下轮自动补入该族。
> 3. **校验错误 LLM 化 + 失败详情显性化**：manifest-check 每条错误改写成「一句可执行修改指令」（指名字段+给合法值示例）；前端「查看原始校验错误」从 11px 折叠链接升级为错误态的**显著区块**（owner 实测没找到它）。**【前端半件 ✅ done·Opus 2026-07-06·随 BUG-STUDIO-设计中间态丢失 顺手做掉】** CreationWizard 的「查看原始校验错误」已从 11px 折叠链接升级为**默认展开 + 带边框标题的显著区块**（danger 色·`⚠ 查看原始校验错误（N 条·AI 未能满足的硬约束）`）；余下服务端半件（错误 LLM 化改写成可执行指令）仍属本单，待接单实现。
> 4. **token/缓存卫生**：system+catalog 逐轮字节稳定（最大化 provider 前缀缓存——本次 122k 命中证明有效）；autofix 回喂只带「上轮 manifest+本轮错误」，裁掉更早轮次的失败输出（防对话超线性膨胀）。
> **验收**：mock+真 provider 各过一遍「模板改」路径；弱模型基准=deepseek 同题重测，目标 ≤1 轮修复通过；token/局记录进完工摘要对比 184k 基线。门禁全绿。

### BUG-STUDIO-设计中间态丢失 · 讨论模式对话一按回车蒸发+蹦出怪 sample（owner 亲测·deepseek） · [2026-07-04] · owner → **指派：Opus（owner 2026-07-06 加急「先修好存盘」·不等 PST session·PST 到岗后接维护）** · status: **✅ done（Opus 2026-07-06·门禁全绿直推·待 Lead 真浏览器验收）** · 优先级: **P0（owner 正在用的主流程·设计稿=产出物不许丢）** · 类型: 产品缺陷（状态持久化+相变纪律+降级纪律）
> **Lead 验收注**：根因判定修正——我原诊断③「疑静默降级」只对了一半：**主触发链=launcher 全局 Enter 监听冒泡启动样例卡带**（施工方复现钉死·比我的假设更准，按偏差三分法记 INTENTIONAL-超预期）；**副病=pickProvider 把 mock 排真 provider 之前**（确实存在静默顶替路径·一并修死）。设计稿从此每轮落盘、刷新/相变/误触永不丢。
> **✅ 完工回执（Opus·2026-07-06·"怪 sample"触发链已复现定点）**：
> **★「怪 sample」根因坐实（复现到精确链路·非静默降级）**：`CartridgeCarousel`（`src/launcher.tsx:291`）挂了 **window 级 keydown handler**，Enter→启动当前选中的库卡带。设计台讨论模式按**裸 Enter**时事件冒泡到这个全局 handler → 启动一盘库里的 sample 卡带 → 设计台连同对话一并卸载 = owner 说的「按回车蹦出怪 sample + 此前对话全消失」。**修**：① 该 handler 加护栏——焦点在 input/textarea/contenteditable 或 `e.defaultPrevented` 一律让路；② DesignStudio/CreationWizard 模态根 `onKeyDown` stopPropagation 兜底。e2e 自证：修前裸 Enter 后设计台 count=0（被卸载）、修后仍在。
> **① 草稿持久化（第一必达·永不丢）**：apollo.py 新端点 `GET/PUT/DELETE /api/design-drafts[/<id>]`——未定名落 `.apollo/design-drafts/<id>.json`（新 gitignore），卡带定名后随卡带迁移 `library/<slug>/design/draft.json`（旧未定名文件清掉·不留双份）；内容白名单 `{id,slug,name,provider,phase,ready,messages,files,manifest,updatedAt}`；路径防护照 `_lib_*`/design 先例（draft-id 白名单 + 归一化断言在 DRAFTS_DIR 内·`../`/斜杠/超长全 4xx·坏 JSON 跳过不炸）。前端 DesignStudio：`messages/phase/files` 变化即防抖(400ms)落盘 + 关闭/换页(beforeunload·keepalive)立即 flush；打开设计台列未完成草稿（服务端时间倒序）一键**恢复**（GET 全量回填）；「弃置草稿」二次确认显式按钮；入库成功即 DELETE 草稿。**刷新/相变/换页永不丢** e2e 验收。
> **② 相变纪律**：聊天框裸 Enter=换行、Ctrl/⌘+Enter 才发送（原样）；改稿框补 Ctrl/⌘+Enter；游戏名 `<input>` 裸 Enter `preventDefault`；相变后（设计稿/原型态）头栏「💬 对话记录(N)」抽屉可回看讨论线程（只读·绝不销毁）；发送键提示醒目一档。
> **③ 失败不降级**：provider 失败/不可解析 → **红条**「⚠ 出错了」(原文 `<details>` 可展开) + 线程原样保留；无静默降级路径——`pickProvider` 修好（配 key 的真云 provider 优先·mock 仅 `APOLLO_MOCK_LLM=1` 才在列且排 local 之前·UI 带醒目 **MOCK** 角标）。**这是「怪 sample」的第二嫌疑**：旧 `pickProvider` 把 mock 排最前，owner 环境若开了 mock，配了 deepseek 也被 mock 内置样例顶掉——现云 key 优先。**顺手做掉 REQ-STUDIO-低模 ③ 前端半件**：CreationWizard「查看原始校验错误」11px 折叠链接 → 默认展开·带边框标题的**显著区块**（见该单）。
> **④ 测试**：新 e2e `scripts/studio-design-draft-e2e.mjs`（**14 断言全绿**·三例）；新 smoke `scripts/studio-design-draft-smoke.py`（**30 断言**·草稿 CRUD 生命周期+路径攻击）；vitest 补 4 例（裸 Enter 不发送/相变·provider 失败保留线程·关闭 flush 落草稿·打开列草稿一键恢复）。原 `studio-design-e2e`(19)/`studio-design-smoke`(41) 零回归。**门禁**：docs-ref-guard PASS · tsc 0 · vitest 2314 pass · build 0。边界：`apollo.py`+`src/studio/{DesignStudio,CreationWizard}.tsx`+`src/launcher.tsx`(轮播键盘护栏)+`.gitignore`+两测试脚本。
> **owner 现象**：设计工作台·配 deepseek·讨论模式——按回车后蹦出一个"奇怪的 sample"，此前对话全部消失。
> **Lead 根因诊断（已读码·两个结构病坐实 + 一个触发点待复现）**：
> ① **中间态零持久化（核心病·坐实）**：`DesignStudio.tsx` 的 `messages/phase/files/name` 全在 React useState（:159-172），无任何草稿落盘、无恢复路径——任何相变/卸载/刷新=对话蒸发。owner 说的"中间态 session 不能这样打断"就是它。
> ② **相变吞对话（坐实）**：phase 从 'chat' 切走后对话视图不可回看；相变触发点需全面审计（chat 发送=Ctrl/⌘+Enter :378 本身没错，但存在其他输入面/流程把动作系在裸 Enter 或自动推进上的嫌疑）。
> ③ **"怪 sample"来源（待 PST 复现定点）**：嫌疑=deepseek 返回不合 schema 时被静默降级成占位/mock 形产物顶替（mock 只该在 APOLLO_MOCK_LLM=1 显式态存在）。用 deepseek 或 mock 模拟坏返回复现"回车→sample"精确触发链，回报本单。
> **spec（Lead 图纸）**：
> 1. **草稿持久化**：每轮 chat 往返后服务端落草稿（未定名 `.apollo/design-drafts/<id>.json`·定名后 `library/<slug>/design/draft.json`）：`{messages, phase, files, name, provider, updatedAt}`；打开设计台列未完成草稿一键恢复；弃置=显式按钮。刷新/相变/换页永不丢。
> 2. **相变纪律**：进入分解/定稿/原型只能显式按钮触发；审计全部输入控件 Enter 语义（textarea=换行·Ctrl+Enter 发送；`<input>`/`<form>` 一律 preventDefault 不得触发相变）；相变后对话线程仍可回看（tab/抽屉），绝不销毁。
> 3. **失败不降级**：provider 调用失败/返回不可解析 → 红条报错（原文可展开）+ 线程原样保留；mock 产物只在 APOLLO_MOCK_LLM=1 且 UI 带「MOCK」角标——**绝不无声顶替真 provider 输出**（同美术台人审门一个哲学：静默降级=假绿）。
> 4. **测试**：e2e 三例——两轮讨论→刷新→线程在；裸 Enter 不触发任何相变；provider 500→错误条+线程保留。smoke 补草稿 CRUD。门禁全绿；Lead 真浏览器旅程验收。
> **owner 临时自救（修复前）**：发送=Ctrl/⌘+Enter（裸回车本不该发送）；对话暂无持久化，修复前别在讨论模式攒长对话。

### REQ-ART-M2.5-人审门 · AI 生成产物改「待审区」·人点入库才登记 · [2026-07-04] · Lead 图纸 → **指派：PST（owner 2026-07-04 开设 PST 角色 session·照单施工）·PA 会审登记契约** · status: **✅ done（PST 2026-07-06·门禁全绿直推·待 Lead 真浏览器验收）** · 优先级: **P1（宪法级缺口·工坊改造第一刀）** · 类型: 产品化·资产治理（不碰引擎核）
> **spec（Lead 图纸）**：① **待审区**：`/api/assets/generate` 产物改落 `assets/ai/pending/`（游戏本地则 `public/games/<g>/art/ai/pending/`）+ 独立 `pending.json` 清单（**绝不进 assets/index.json**），返回预览 URL。② **审核端点** `POST /api/assets/review`：`{id, action:'approve'|'reject'}`——approve=移文件出 pending + 登记 index，**provenance 硬校验**（model/prompt/date/license 缺一拒绝登记）；reject=删 pending 文件+清单项。路径防护照 asset-import 先例。③ **UI**（`AssetGenPanel`/`AssetLibrary`）：生成后显示预览 + 「✓ 入库 / ✕ 弃置」双按钮（替换现"已生成并登记"直落文案）；AssetLibrary 加「待审区」入口 + 待审计数 badge。④ **测试**：smoke 走全链（mock 生成→pending 不在 index→approve→在 index 且 provenance 全→reject→pending 清空）+ 渲染测试更新；**grep 自证无任何"生成即登记"残留路径**。⑤ 门禁全绿直推；完工标 ✅ 待 Lead 验收（真浏览器过一遍生成→审→入库旅程）。出处：`docs/design/art-pipeline-vision-2026-07.md §七`。
> **✅ 完工回执（PST·Opus·2026-07-06）**：① **待审区**——`scripts/ai-gen.mjs` `writePending()`：生成落 `assets/ai/pending/`（游戏 `public/games/<g>/art/ai/pending/`）+ `pending.json`，**绝不写 index.json**；run() 生成路径删旧「直写 index」段（唯一入 index 的门=approve）。② **端点**（apollo.py 薄胶水·PST 服务面）——`POST /api/assets/review`（approve=provenance 硬校验过才移文件入 index·`reviewPending()`；reject=删待审文件+清项）+ `GET /api/assets/pending`（聚合共享货架+各游戏待审）；入参/路径防护（非法 action、`..` 穿越 id 挡）。③ **UI**——`AssetGenPanel` 生成后预览 + ✓入库/✕弃置（替"已生成并登记"）；`AssetLibrary` 加「🕒 待审区」入口 + 待审计数 badge；新 `src/studio/AssetPendingReview.tsx`（列待审·预览·provenance·双按钮·provenance 不全禁点入库）。④ **测试**——`ai-gen.test.mjs` +7 单测（待审/approve/reject/provenance 硬校验/游戏落点/未知项）；全链冒烟 `scripts/art-review-smoke.py`（**17 断言**·进程内起 API·快照恢复零仓库污染·退出码门禁·含 provenance 缺 model→approve 被拒自证）；render 测试更新（生成到待审区 + 待审区入口 + AssetPendingReview 渲染）；**grep 自证**唯一「生成即登记」字样=测试注释里的否定引用，代码零残留（index 写仅在 approve 分支）。⑤ **门禁**：tsc 0 · vitest 2310 pass · build 0 · 冒烟 17/17。边界：`apollo.py`+`scripts/ai-gen*`+`src/studio/**`（PST 域）；`ai-gen.mjs` 属登记契约·请 **PA 会审** `writePending/reviewPending/provenanceMissing` 的条目 shape 与硬字段口径。

### REQ-QA-红旗棘轮 · audit 加基线对比——红旗计数只许降不许升·进门禁 · [2026-07-04] · 主程（owner「有规则为什么还手写了5处·要复查规则」） · status: ✅ **done（Opus 施工 2026-07-06·门禁全绿直推）** · 类型: 质量强制基建（把规则从文字变成机器）
> **Lead 验收（2026-07-04）REVIEW: PASS**：独立复跑（AUDIT: FAIL 存量如实 + RATCHET: PASS·全套退出码亲测）+ 自做红测（篡改 game-z 基线 → RATCHET: FAIL 点名正确·恢复即绿）。验收中另撞到 flow-walk 门禁级 flaky——另立 BUG-G-flow-walk 单（与棘轮无关）。
> **完工摘要（Opus 2026-07-06）**：① `scripts/audit-baseline.json` 已建（`{_doc, games}` 结构·数值=当前 HEAD audit 实测灌入·存量既往不咎）——基线快照：game-d `{0,0,3}`·game-e `{3,0,1}`·game-f `{0,27,14}`·game-g `{8,29,31}`·game-h `{1,0,2}`·game-i `{0,0,5}`·game-x `{0,0,3}`·game-z `{0,0,4}`（序=nakedRandom/innerHTML/createElement）。② `game-skill-audit.mjs` 加 `runRatchet` 追加段：超基线→`RATCHET: FAIL`+退出码 1+点名「游戏 指标: 基线 X → 现 Y（+N）」；低于→打印降基线提示（不红）；等于→静默。既有 `AUDIT` 判词/用法零改，最终退出码=`(anyRed||ratchetFail)?1:0`（子集调用只比对审到的游戏）。③ `scripts/audit-ratchet.test.mjs` 进 vitest（spawn CLI·断言全 8 款 `RATCHET: PASS`·基线覆盖 8 款）。④ **自证红**：临时把 game-z createElement 基线 4→3 → CLI 打 `RATCHET: FAIL` 点名 `game-z document.createElement: 基线 3 → 现 4（+1）` 退出码 1、ratchet 测试转红；恢复即绿（2 tests pass）。⑤ 回填 `docs/playbooks/testing.md` 红线区一行 + `docs/playbooks/ui.md` 棘轮行 `audit-baseline` → 反引号 `scripts/audit-baseline.json`。门禁：docs-ref-guard PASS / tsc 0 / vitest 2295 pass / build 0。抬基线唯一合法姿势=baseline 条目挂 `reason:"REQ-xxx"`（机器不验单号真伪·diff 验收可见）。
> **为什么规则没拦住（Lead 定性·非幻觉）**：①手册有真缺口——浮层/连线/斩击特效 LayoutNode 表达不了（锚定件当时未立单）；②审计无牙——game-g 存量 62 处红旗常年 `AUDIT: FAIL`，红海里 +5 无信号（破窗效应）；③owner 现场 playtest 连发需求，速度压过"提缺口等裁决"流程。session 明知规则（新增处还写了自辩注释），是**激励失衡**不是失忆。修法=给规则装牙。
> **spec（Lead 图纸）**：① 新建机读基线 `scripts/audit-baseline.json`：每游戏 `{nakedRandom, innerHTML, createElement}` 计数（以当前 HEAD 实测数灌入=存量既往不咎·含本批 +5）。② `game-skill-audit.mjs` 加基线对比段：任一计数 **高于基线 → `RATCHET: FAIL` 退出码 1**·点名游戏+指标+新增行；低于基线 → 提示"同提交把基线降下来"（降基线=还债的仪式感·同提交必须改 baseline 文件）。③ 薄 vitest 包装 `scripts/audit-ratchet.test.mjs`（照 docs-ref-guard.test 模式）扫全部 8 款 → **红旗增量从此挡在推送门禁里**。④ 抬基线的唯一合法姿势：baseline 条目带 `reason:"REQ-xxx"` 字段挂缺口单号（机器不验单号真伪·但 diff 在验收时一眼可见）。⑤ 回填 `playbooks/ui.md` + `testing.md` 各一行。门禁全绿直推。

### BUG-G-flow-walk 满局走查临界超时（门禁级 flaky·全量并发下翻车） · [2026-07-04] · 主程（棘轮验收撞到） → **程序A/程序B（谁的演出拍谁修）** · Game G · status: **✅ done（程序B 2026-07-06·按 Lead 修法①）** · 优先级: **P1** · 类型: 测试健壮性（演出节奏拖垮走查预算）
> **现象**：`flow-walk.test.ts` 单跑两次全绿；全量 vitest 并发负载下 ~40s 翻车（此前收敛 ~5s）。**根因链**：playtest 批把演出节奏放慢（行军 1 秒/步·每兵 2 秒起身落地·前奏 2s），满局走查跟着墙钟节奏变长 → 负载一挤过线。
> **修法方向（Lead·二选一或并用）**：① 走查测试进 headless 时演出**快进**——timeline 拍走 `skipOnSignal` / pacing 系数=0（演出时长是表现参数，不该进 sim 测试预算；`playbooks/testing.md` 三禁「真时间等待」精神同源）；② 走查断言「N tick 内收敛」而非墙钟。修完在全量并发下连过 3 次才算数。
> **✅ done（程序B 2026-07-06·采 Lead 修法①·演出快进）**：`game-g.tsx` 加 opt-in `window.__ggFastPerf` → `FAST_PERF`/`pT()`/`pMs()`：headless 走查把行军(walkTicks)/前奏(showClashCue DUR)/横幅(showBanner)/掷骰(doClashRoll TOTAL 42→2)/收场(clash-settle cues·zoom out)全部墙钟拍折成 ≤1 tick——演出逻辑照跑(仍捕演出抛错)·只是不再拖满 pump 预算。`flow-walk.test.ts` mount 前置 `__ggFastPerf=true`。**真机默认 1·原节奏零改**（FAST_PERF 仅 opt-in 生效）。**验收**：flow-walk 58s→2.7s；全量并发(309 files)**连过 3 次**（flow-walk 3.4s/11.9s/3.6s·worst 远低 40s 翻车线）；tsc 0 · vitest 2297 · build ok。（另：P20 的 MAX_TURNS 保底收敛同时消除了「满局不结」这一潜在超时源。）

### REQ-G-起手源泉 · [2026-06-23] · design G → 甲（引擎域·常量） · Game G · status: ✅ **done（`MANA_START=4` 已落 turn-combat.ts:24·2026-07-04 回标）** · 优先级: P1 · 类型: 已覆盖（纯常量调值·非新能力）

> **owner 2026-06-23**：起手源泉 6 太高（玩家一上来铺满·开局没张力）→ 改 **4**·**双方对称**（玩家和 Boss 都起手 4）。
> **派甲（一行改）**：`turn-combat.ts` `MANA_START = 6` → `MANA_START = 4`（`MANA_PER_TURN=1` 不变·双方同源·sim 经 `initTurnBattle` 自动继承）。
> **无新能力**——只调常量。design G 在 4 源泉 + 两 AI 落地后重标 WR 曲线。

---

### REQ-G-主将命数参数化 · [2026-06-23] · design G → 甲（引擎域·地煞参数） · Game G · status: ✅ **done（`lastStandGeneral` 整数命已落·turn-combat.ts:399·2026-07-04 回标）** · 优先级: P1 · 类型: 已覆盖 + 小泛化（布尔→整数）

> **owner 2026-06-23**：关1 列奥尼达有"温泉关"属性 → **主将战败 3 次才退场**（噱头 + 教学：玩家学会"避开主将路·田忌赛马打别路破家"）。
> **现状**：`disha.ts` `lastStandGeneral: boolean`（=主将硬编码 **2 命**·首负残喘退1格不亡）。
> **派甲（小泛化·不是新能力）**：把 `lastStandGeneral` 从 `boolean` 改成 **命数 `number`**（`lastStandGeneral: 0|n`·n=主将战败几次才退）；`laststand` spec → `{ lastStandGeneral: 3 }`（关1 列奥尼达）。**老的 true 等价 2**（兼容）。明牌·玩家可见可破·不偷。
> **为何不是新 capability**：现有 op 已表达"主将多命"·只是把写死的 2 提成参数·属 manifesto §4「已覆盖+参数化」·不新增能力面。

---

### REQ-G-破家善后 · [2026-06-23] · design G → 甲（引擎域·战斗逻辑） · Game G · status: ✅ **done（`advanceColumnToBase` 破家后回牌库+返半费·turn-combat.ts:470-473·2026-07-04 回标）** · 优先级: P1 · 类型: 逻辑缺口补全（已覆盖·复用现成回库路径·非新能力）· 规格: `design/24-turn-based-combat-model.md §4.2.6`

> **owner 2026-06-23 提的逻辑缺口**：一支兵攻进敌大本营、扣掉 1 格血后**怎么处理·原本没交代**。现行 `advanceColumnToBase`(L397-413) 是 `splice` 掉 = **凭空消失**。
> **owner 裁决**：**回牌库**（不消失·可再抽再上）。① 逻辑更顺（破家是大功·不该蒸发·班师回库）；② **不能留场续打**（大本营不是兵·没敌前锋可对决·留场=白嫖每回合砸家·破坏平衡）。
> **派甲（小改·复用现成）**：`advanceColumnToBase` 把"扣血后 splice 丢弃"改成**走 §4.2 掷命「人面·回库」分支**——`pokerDeck.push({该兵})` + `mana += (cost??0)/2`（**直接复用 `resolveClash` L378-382 那段回库逻辑·别另写**）。
> **为何非新能力**：回库+半返路径已存在（掷命人面分支）·这里只是让"破家"也走同一条善后·把"消失"替成"回库"。属 manifesto §4 已覆盖。
> **效果**：3 血大本营 = 至少 3 次独立破门突破（强牌可反复抽出再冲·每次冲完回库 → "持续攻城"节奏·非一兵无限砸穿）·吻合 homeHp=3 持久围攻设计。
> **开放旋钮**：破家半费返还若 sim 显示攻城经济过快·可单独清零（只回库不返费）。先按"与人面一致"实装·sim 再裁。

---

### REQ-G-开局排阵 · [2026-06-23] · design G → 甲（引擎域·init） · Game G · status: ✅ **done（`boss.startFormation` 数据能力 + `hold` 静守已落·turn-combat.ts:90/113 + level.ts·2026-07-04 回标；关1 守军 8♠/9♥ 摆隘口。张数/摆位数值仍归 design G 用 sim 标）** · 优先级: P1 · 类型: 真缺口（开局摆兵·当前不可表达）→ 下沉成数据能力 `boss.startFormation`

> **owner 2026-06-23**：提难度的公平办法——与其给 Boss **偷加源泉**（已禁·不公平），不如让 Boss **开局就有 N 张牌排好在场上**。**明牌**（玩家开局看得见这堵墙·可绕可针对）→ 公平·可破。专治"守势 boss 开局攒不出场面、威胁不到玩家"。
> **CORE RULE 评判**：① 能组合现有能力？**否**——当前两军开局空场、兵只能回合内 `deployUnit` 入场·没有"开局已在场"的表达。② 已覆盖？**否**——`thermopylae` 的"隘口守军"只是抽象 `nearBasePower +1` buff·不是真卡。③ **真缺口 → 下沉成通用数据能力**（确定性·可复用·明牌·审计过）。
> **下沉能力**：`boss.startFormation: [{rank,suit,lane,slot?}]`（数据·写在 boss 配置）。派甲在 `initTurnBattle` 末尾按列表把这些卡**直接放到 Boss 侧对应 lane/slot**（复用 `deployUnit` 的落位逻辑·或直接 push 进 `lane.b`+设 slot）·**不花源泉**（开局既定·明牌）。纯数据驱动·零 per-boss 代码·任何 boss 可用。
> **顺带做实"隘口守军"**：关1 列奥尼达 `startFormation = [8♠@lane?slot8, 9♥@slot7]`（2 张守军排隘口）→ 把原抽象 buff 换成场上看得见的两张墙兵（更直观·契合"300死守隘口"幻想）。
> **关1 取 2 张**（教学关·一点开局压力）；后续关爬 3-4。**design G 用 sim 标张数 + 定每个 boss 摆哪些卡哪条路。**
> **公平边界**：仅"开局明牌摆兵"·玩家看得见、可绕可counter（对应玩家的 out-prepare）。**不是**偷源泉/暗数值。玩家侧不需要对称开局排阵（玩家的对称优势=counter-pick）。
>
> **★ 守军行为 = 静守不动（owner 2026-06-23 拍板·重要契约）**：开局排阵兵默认**静态死守**（守势 boss 本色·非攻势抢先一波）。甲实装这 4 条：
> 1. **不前压**：`advanceBoth` 跳过守军·它不向玩家家推进·守在原 slot。
> 2. **不自动冲家**：堵反直觉 bug——`advanceColumnToBase`（某路只 Boss 兵时自动行军砸玩家家·L397-413）**对守军不触发**。守军是防御单位·绝不主动冲锋。
> 3. **接触才交战**：仅玩家兵推到守军相邻格 → 正常 `resolveClash`；玩家不进这路则守军一直静守。
> 4. **赢了守原位**：守军赢掷命后**不走留场前推·继续守原位不追击**（死守语义）。
> **实现建议**：给 `TurnUnit` 加 `hold?: boolean`（startFormation 守军置 true）→ advance/advanceColumnToBase/留场前推三处都 `if (u.hold) continue/skip`。**YAGNI**：当前只需 hold（守势）；将来若有攻势 boss 要"前压排阵兵"再加 advance 模式·现在不做。
> **「看得见≠会动」**（owner 点的细节）：守军是玩家"打/绕"的**情报**·不是逼近威胁。这正是守势难度的公平来源——你看得见、可避，但想破它家就得啃过这堵墙。

---

### REQ-G-谁打谁·战前锚场 + 战后场上标结果（对决可读性）· [2026-07-03] · owner → 程序B（表现·程序A 供数据·已足） · Game G · status: **①战前锚场 done + ②战后驻留徽标 done（2026-07-04）· 余：胜者滑入推进动画归 REQ-G-碰撞才战斗②** · 优先级: P1 · 类型: 演出可读性（非新数值）
> **程序B done（2026-07-04）**：① 战前锚场——`showClashCue` 已改板载锚点(环 `#u-<a.id>`/`#u-<b.id>` + 连线 + VS + 路名·我橙敌蓝·走 t3-timeline)，看清场上哪对要打（前 session 落地·commit 见 git log）。② 战后驻留徽标——留场胜者头顶飘现「⚔胜·连胜N」徽标锚真实兵位(`#u-<id>` 实时屏幕矩形)·**驻留 ~3s 再淡出**(补足旧对折飘字仅 1s 太快看不清·owner「可回看」)；纯 DOM 覆层·不动 tb/rng/turnHash·不churn golden。斩标(败者)走 tear VFX(同族·瞬时·败者已离场无牌可钉)。**余**：胜者「敌前一格→敌腾出格」的滑入推进位移动画——需在掷骰特写期间保持胜者显示在旧格(model/view 分离)·风险较高·归口到 `REQ-G-碰撞才战斗 §程序B②` 一并做。
> **owner 2026-07-03**：「现在看不清楚谁要打谁就开始了」+「结算完以后，把击退/结果标在牌型展示上·我知道谁打了谁」。现状 `showClashCue`（game-g.tsx:395）是**全屏 VS 弹窗**闪 ~2s——脱离真实棋盘、看不出是场上**哪两枚**在打；结算结果也只进特写框（owner 反复说「结算框看不清」）。
> **程序A 判断（本 session）**：这是纯**表现/演出**，逻辑侧数据已全出、无需程序A 新增——`advanceMovePhase` 返回的 `pending` 路 id = 战前哪几路要掷命、每路前锋两枚可由 `colOf(lane, a/b)[0]` 取；`lastClash`/`clashLog` 出 `a/b`(含 `id`)、`aWins`、`winStays`、`loserVacatedSlot`（胜者推进后的 slot 即在场上兵位上）。程序B 只读播、不改结果。
> **程序B 待做**：
> ① **战前·锚在真实棋盘**（替/补全屏弹窗）：移动相滑到位后，对每条 `pending` 路把**将交战的两枚场上兵**（锚 `u-<id>`）高亮/描边 + 二者之间画连线或悬「VS」标（我橙敌蓝·沿用 cue 配色），让 owner 一眼看出是**场上哪对**要打，再切/叠掷骰特写。全屏 VS 可保留作二级强调，但主可读性锚在场上。
> ② **战后·结果标在牌上**：掷命结算毕，胜者牌上钉「胜·推进/戴冠」、败者「斩/败」标（与 REQ-G-满仪式 §战场阵亡/胜利 VFX 同族·同一批做）；被击退/推进用场上滑动位移表达（见上条 REQ-G-碰撞才战斗 §程序B②）。标记短暂驻留可回看，不塞进结算框。
> **A/B 接口**：全在 `pending`(战前路 id) + `lastClash`/`clashLog`(战后 a/b/id/aWins/winStays/slot)。程序B 不需程序A 改逻辑。

### REQ-G-动作模型-三行为自由 · [2026-07-03] · design G → 程序A(逻辑+AI)+程序B(UI) · Game G · status: **逻辑+AI done ／ 程序B 三行为 UI done（2026-07-04）** · 优先级: **P0（owner 拍板·核心回合模型改·压 sim/标定）** · 规格: `design/24-turn-based-combat-model.md §二`
> **注（2026-07-04 程序A）**：`discardCard`(弃牌返0.5源泉) 仍在（game-g.tsx:594 玩家UI + player-ai 标 `void`未进搜索）——这**不是**本单要退役的"免费纯弃牌"(那个已被 swap 取代)，是另一条 0.5 返费续航微操，是否保留/进 AI 搜索归 design G 裁决。
> **程序B done（2026-07-04·三行为 UI）**：动作菜单 4 键 → **抽/打/换 三区**（顶钮 grid cols=3·互不互斥·不再据 actionTaken 置灰）；点开哪个 → 右侧子菜单二选一各显源泉开销（抽扑克/抽天罡 各 💧1 · 部署扑克 💧按点/打天罡 💧1 · 补扑克/补天罡 免费）。换牌=选补牌库→点手里1张→弃并随机补1张(免费·1/回合·用尽后顶钮/子钮置灰·再点提示已用尽)。走 LayoutNode 底座(Button 闭集·label 内嵌开销文案·零手写 CSS/DOM)；battle-coach 文案/锚点同步(打天罡=combat-cast·部署扑克=combat-deploy·未点开回退顶钮)；旧四选一互斥+纯弃牌 UI 退役。tsc+vitest(183)+build 全绿·playwright 四态截图验收。`discardCard` 玩家 UI 入口本次由「换」取代移除(逻辑导出留存待 design G 裁 AI 侧)。

> **owner 2026-07-03**：四选一 + 「放牌⊥打天罡」互斥限制太多、策略性一般 → 改 **三行为（抽/打/换）· 互不互斥 · 源泉唯一门**（源泉本就稀缺=天然闸·不必再叠动作互斥）。
> **程序A（逻辑）**：
> 1. **去掉动作大类互斥**：`canAct`/`actionTaken` 退役"本回合只能一类"锁——`抽(天罡/扑克)`、`打(天罡/部署扑克)` 一回合内**任意混、只要 `mana≥cost`**；攒源泉留后手照旧。
> 2. **换牌 = 新动作**：选中手牌 1 张 → 弃 + 从选定牌库(天罡/扑克)**随机补 1 张** → **`SWAP_PER_TURN=1`（硬帽·破无限churn死循环）· `SWAP_COST=0`（免费）**。旧"免费纯弃牌"退役（被换取代）。
> 3. **更新终极 Player-AI 动作枚举**（`player-ai.ts`）：候选动作集 = 抽/打自由混 + 换(1/回合) → 前向搜索按新合法动作枚举（这直接改变 sim 胜率·见下）。
> 4. 确定性：turnHash 回归照绿（换牌消费 rng 抽替换牌·顺序固定）。
> **程序B（表现/UI·走引擎 UI 基座·别手写）**：动作菜单从 4 键 → **抽 / 打 / 换 三区**：点抽/打 → 右侧子菜单高亮（抽天罡·抽扑克 / 打天罡·部署扑克）**各显源泉开销**；换牌 = 选中一张手牌触发（1/回合·免费·用完置灰）。查 `docs/playbooks/index.md` UI 线 + 交付前 `check-ui`。
> **未来（不现做·记池）**：换牌成本可由 Boss 地煞按关加税/上锁（`swapTax`/`swapLock`·明牌杠杆·见 `disha-native-power-redesign §三·五`）。
> ⚠ **design G 重算连带**：动作模型变 → 现关1 调参曲线（贪心11%→终极51%·~70%@bossDelta−8）**作废**；程序A 更新 AI 枚举后 **design G 用终极 AI 重扫关1 标定**。玩家自由度↑ → 大概率更强 → 关1 胜率上移。

> 【程序B 附注 2026-07-03】我原拟提「通用 Timeline 演出组件」——rebase 发现**主程已下沉 `t3-timeline`**（上条 REQ-G-演出迁时间线 + tick 制确定性 cue 调度器）→ 我的请求**冗余撤回**。game-g 战斗清晰度演出（移动 g-march 浮起落下已落地 + 待做的战前配对高亮/战后斩·冠场上 VFX）**改走 `t3-timeline`**（owner「用 timeline 底座·不手写」）——与 REQ-G-演出迁时间线（指派程序A）自然衔接，我这边表现层订阅 timeline 信号自演。

---

### REQ-G-退役机关门 + Boss自由混 · [2026-07-03] · design G → 程序A(逻辑+AI)·程序B(删门UI) · Game G · status: **逻辑 done（程序A 2026-07-04 核实：门整套已删·turnHash 无 g 段·城门令出池 36→35·aiDecide 已同规则自由混无门决策·Boss 无换牌·player-ai 无门枚举·turn-combat/turnmatch 20 测绿）／ 程序B 删门UI open ／ **design G 关1重标 ✅ done（2026-07-04·核变后 bossDelta=0 稳在 73.5% 通关/95.5% 单场·对称改没偏心公平点·见 boss-config §一末「✅✅ 核心大改后重标」）·终扫待 loader 接 16写死牌组** · 优先级: **P0（owner 拍板·地基清理·解锁关1对称标定）** · 规格: `design/24-turn-based-combat-model.md §三` + `balance-philosophy-fairness.md §五`
> **程序B 待清（门 UI 死引用·2026-07-04 程序A 巡出）**：`turn-battle-screen.ts:705`（放牌后翻门 toast）+ `:789`（deploy sub-label「放完可点机关门翻门调度」）· `overlays.ts:35/41`（帮助文案「可顺手开关机关门 / 机关门换路」）· `sound.ts:14-15`（`gateOpen`/`gateClose` 死音效定义）· `campaign-data.ts:80` 注释（无害）。逻辑侧已无门·这些仅残留表现文案/死音效·程序B 一并清。

> **owner 2026-07-03 两条**：① **机关门/换路整套退役**（不给乐趣·高复杂度低价值·旧实时CR遗留）；② **Boss 也一开始就自由混**（对称同规则·Boss 无换牌·难度只来自明牌 kit·不靠给 Boss 降规则）。
> **程序A（逻辑）**：
> 1. **砍机关门整套**：删 `turn-combat.ts` 的 `GATES`/`gatesOpen`/`gateMove`/`toggleGate`/`tryGate` + `advanceBoth` 里门分流(diverted) + `deployUnit` 的 `gateToggle` 参数 + `turnHash` 的 `g<gates>` 段；**天罡「城门令」从 36 池摘除**（或标退役·`game-g-build`/天罡数据）；AI(`aiDecide`) 去掉开/关门决策；`player-ai.ts` 去掉门相关枚举。清理相关测试/golden（有意行为改变·报告说明）。
> 2. **Boss 也自由混**：`aiDecide`/`aiTakeTurn` 去掉"每回合单大类"的稳定基线限制（你上轮注释标的开关）→ **Boss 与玩家同规则自由混 抽/打**。**Boss 无换牌**（换牌是玩家专属 QoL·别给 Boss）。
> 3. **确定性**：turnHash 回归照绿（删门段是有意改变·更新断言）。
> **程序B**：删战斗屏的机关门 UI（门钮/门态渲染）。
> ⚠ **design G 连带**：Boss 自由混后关1 公平配置从 54%→~14%（Boss kit 值 ~36 分）→ **design G 用"双方自由混"重跑·把关1 Boss kit（布防 4→2静守 + 地煞 + 牌力偏置）减弱到玩家 ~70%**（教学关本就该弱·见 `balance-philosophy-fairness §五`）。**程序A 改完 → design G 标定。**
> **✅ design G 标定回填（2026-07-04）**：实测**对称核变没把公平点推离 70%**——`bossDelta=0` 时终极 AI 通关 **73.5%**（≈70% 目标）·无需减弱 Boss kit。原估「Boss 自由混→14%」是**旧口径误判**（那 14% 是 sim 的 Boss暗箱强牌 bug 所致·已由 `f9727ae5` 修·非 Boss 自由混本身）。**遗留待 owner 拍**：贪心真新手通关仅 24%（5战全胜复利·单场 78%）→ 关1 是否该 5 战 / 目标是否改按单场量（详 boss-config §一）。

---

### REQ-G-天罡目标op机制对齐（程序A → design G·施工前必答）· [2026-07-04] · 程序A → design G · Game G · status: **✅ 已答（design G + owner 对齐 2026-07-04·定案入 `design/tiangang-native-redesign.md §四·补`）** · 优先级: **P1（阻塞天罡原生重构 片C 的 5 个 op）** · 规格补充: `design/tiangang-native-redesign.md §四.3 + §四·补`
> **✅ design G 答复（owner 对齐 2026-07-04·5 op 机制/数值全钉死·详见 tiangang-native-redesign §四·补）**：
> - **时长模型 = 混合**（owner 拍板）：**疾行/泥沼/驰援/舍车 = 即时一次性**（无持久状态·契合"操作前置·掷骰执命"哲学·消掉 laneFx 状态机·更确定性防雪球）；**仅铁索 = 持久**（epic 全军减速墙·带 N 回合全局倒计时·单值非每路状态）。**叠加**：即时类天然叠加棋盘封顶·无需 cap；铁索刷新时长不叠深。
> - **① 疾行**：我该路兵即时 +1格推进（epic 可 +2）。**② 泥沼**：敌该路本回合不推进（跳过 advance·单路即时）。**③ 铁索**：敌全军 speed−1（下限1）持续 N=2回合（param·epic）。**④ 驰援**：指定路 +2 固定援兵（战力3·无将·无buff·落部署格·只花天罡cost·不掏牌库·不额外源泉；兵数/战力 param）。**⑤ 舍车**：弃一路→**回牌库**（复用人面/破家回库·非销毁）+ 另两路当前兵各 +X战力（施放瞬间快照·烙兵身·永久随兵·不需 laneFx）；**+X 起标 +8·待 GD sim**。
> - **程序A 可开工片C**：`castTengangAt(b,side,handIdx,lane)` 即时类立即应用 + 铁索全局倒计时 fx；点路 UI 归程序B。数值（舍车+X/驰援体量/铁索N）落地后 GD sim 复核。
> **背景**：天罡原生重构 §四.3 的 5 个 op 设计意图是高层文案，**机制/数值未钉死 → 程序A 无法确定性实装**（否则=模糊数据/我替策划拍脑袋）。owner 2026-07-04 已定「目标类走玩家选路·不自动」。请 design G 逐条拍板（每条给了工程建议·选一个或改）：
>
> **通用问题（先定·影响状态设计）**：
> - **持续时长**：这些效果是 **①本回合限** / **②持续 N 回合** / **③整局持久**？（程序A 建议：疾行/泥沼=整局持久按路挂；驰援/舍车=即时一次性。混合最合理。）
> - **叠加**：同一路施两张疾行 → 叠加(speed+2) 还是不叠(封顶+1)？（建议：叠加但设上限·防爆炸。）
>
> **① 疾行 swiftmarch（该路 speed+1·抢攻）**：
> - speed+1 作用于**该路现有兵 + 后续入场兵**（按路挂）还是只当前兵？（建议：按路挂·现有+后续都吃。）
> - speed 机制已在（`unit.speed`）→ 直接给该路 units speed+1。**要 design G 确认：+1 够不够抢攻·还是要+2。**
>
> **② 泥沼 mire（敌该路减速）/ 铁索 ironchain（敌全军减速·epic）**：
> - 「减速」= **①speed−1（下限 1·永远能走 1 格）** / **②隔回合推进（该路敌每两回合才动一次）**？（建议：①speed−1 更简单可控·②隔回合更狠但要计回合状态。）design G 定哪种 + 泥沼(单路)/铁索(全军) 数值同不同。
>
> **③ 驰援 rush（指定路凭空+2兵）**：
> - +2 兵是**什么兵**？(a) 固定低值援兵(如 rank 3·无 buff·无 general)　(b) 从我牌库顶抽 2 张即时上场　(c) 定义一种"援兵"token(固定战力)。（建议：(a) 固定援兵最可控·不掏牌库不破经济。）
> - 落在哪个格？（建议：我方部署格 slot 0 起·同 deployUnit 落位。）花不花额外源泉？（建议：只花天罡本身 cost·凭空=不额外。）
>
> **④ 舍车 discard2（弃一路·另两路各+10战力·田忌）**：
> - 「弃一路」= 那路我方兵 **①回牌库(可再抽再上·同破家/人面回库)** / **②销毁(彻底移除)**？（建议：①回库·符合"舍"非"毁"·且经济友好。）
> - 「另两路+10战力」= 作用于**两路现有兵**还是**含后续入场**？持久还是本场？（建议：按路挂持久·现有+后续都 +10·与疾行同状态模型。）
>
> **答完后 → 程序A 落地**：`castTengangAt(b,side,handIdx,lane)` + per-lane 效果状态（`laneFx`）；铁索(无目标)可先做。点路 UI 归程序B（另接）。

### REQ-G-突深边角·敌新兵反向传送+越界 bug（战局 log 实锤）· [2026-07-04] · owner playtest → 程序A(turn-combat 移动逻辑) · Game G · status: **✅ done（程序A 2026-07-04）** · 优先级: **P1（战斗核正确性·位置腐坏·非纯表现）** · 类型: 逻辑 bug（移动 clamp 边角）
> **✅ 修复（程序A 2026-07-04）**：根因=前锋停敌前一格的 clamp `limit=foeFront−dir` 假设「本兵在敌前锋接近侧」，玩家突深后敌兵已被越过→反向顶穿棋盘(6S 6→8、7S 8→9 越界)。修法=**加「接近侧」守卫**（`dir>0? slot<=foeFront : slot>=foeFront`）：仅接近侧才 clamp 停敌前一格，**已突穿则不反向顶·正常朝本方目标推进**。改 3 处——`advanceColumnVsFoe` clamp（②）、`advanceSideMove` 碰撞判据（③·加同守卫防突穿后一律误判碰撞）、`advanceLaneOneStep`(疾行·同 clamp)。**① deploy 落身后**：与 ②③ 修好后位置不再腐坏，突穿侧敌新兵正常奔我家(非无限反弹)——「落身后=无效防」是玩法有效性(design 域)非崩溃，不强改 deploy(GD 「或允许但标记」)，如需避免落身后另立数值单。加突深回归测试(玩家 A@7 贴敌家·敌 6S@6 落身后→敌移动无越界 slot、突穿侧不反向)。全 206 game-g 测绿·turnHash 常规无漂移(仅突深边角行为变·有意)。design G 可 sim 复扫破家路径。
> **owner 2026-07-04 战局 log 疑「表现 bug」**：第1战 T7 下路末次对决——「6S 从下路最后一格进攻我倒数第二位，显示成第三位打第二位·很奇怪·是不是数值对只是表现错」。**GD 逐行 trace（turn-combat.ts）结论：不是纯表现·底层 slot 真腐坏。** log 里 `移动:[6S:6→8、7S:8→9]` 精确复现（slot 9 越界·敌兵反向增格）。
> **根因链（"玩家突深"边角·三处叠加）**：
> 1. **突深**：我 AS 打穿到 slot7（贴敌家8·killed 9H 后占腾出格前进）。
> 2. **敌新兵落我身后**：敌 deploy zone `[8,7,6]`（`turn-combat.ts:161`），8=7S/7=AS(占)→6S 落 **slot6·在 AS(@7) 身后**（本该挡我却落我背后·无效防）。
> 3. **移动 clamp 反向传送**（`turn-combat.ts:479` `limit = foeFrontSlot - dir`）：敌前锋=最低格=6S@6·foeFront=AS@7。i=0：t=6+(−1)=5→`Math.max(5, 7−(−1)=8)`=**8**（6S 6→8·被往回顶到敌家·反 dir）；i=1：7S t=7→`Math.max(7, ahead8+1=9)`=**9**（越界·slot9 不存在）。`limit=foeFront−dir` 假设「敌在玩家上方往下逼近」·突深后敌在玩家**下方**→ clamp 把敌兵往上推穿棋盘。
> 4. **碰撞误判**（`:524` `dir<0: natural<=foe[0].slot`）：敌在玩家下方时永远 `<=`·每帧误判碰撞。
> **数值 vs 表现裁定**：**clash 配对（两路前锋对撞）+ 战力/掷骰运算本身自洽**（AS对折8掷3 vs 6S战力5掷4→6S胜·算术没错）→ 「谁打谁+胜负」结果可信；**但 slot 位置被腐坏**（6S@8/7S@9 越界）→ 渲染按 slot 画就成了「第三位打第二位」的错位。**所以：不是纯表现·是位置逻辑 bug 连累了表现。**
> **程序A 待修（spec·GD 报缺·代码归程序A）**：突深边角下——① deploy zone 落子应避免落在**玩家前锋身后**（或允许但标记）；② `advanceColumnVsFoe` 的 `limit` clamp 需处理「己方兵已在敌前锋另一侧」——不该把它反向顶穿棋盘·应就地/正常向本方目标推进（此时该敌兵其实该走它自己那条路奔我家·或与"贴身后"的我方单位另判）；③ 碰撞判据 `:524` 同步修（方向感知·别一律 `<=`）。④ 加突深回归测试（玩家单兵打穿到贴敌家 slot7-8·敌再 deploy/move·断言无越界 slot、无反向位移）。**turnHash 若变=有意·更新断言。**
> **GD 附注**：这是「单兵突破打穿到贴敌家」的残局边角·常规对峙不触发（故前6回合正常）·但破家临门一脚正是玩家追求的高光时刻→**值得修**（不然每次快破家都可能位置错乱/误判）。修好后 design G sim 复扫破家路径。

## 2026-07-15 二次清仓（owner「只留 10 条硬需求」·done/暂缓迁入）

### REQ-CTX-上下文预算三件 · 池清仓+预算封顶守卫+复查范围核查（owner「信息量大了 session 读不完·会偏离」批①②③）· [2026-07-15] · Lead 诊断+施工 · status: **✅ done（Lead 2026-07-15·门禁全绿直推）** · 优先级: P0（防偏离基建） · 类型: 流程基建
> 实测诊断：T0 必读集健康（~1.5 万字符=窗口零头）；真炸弹=requests.md 曾 13 万字符（done 回执不归档）。落地：①**池清仓**——32 条已完结全文迁 `requests-archive.md`（池 13.1万→6.7万字符·活跃条目一条未动）；②**上下文预算守卫** `scripts/context-budget-guard.mjs`（判词 `CONTEXT-BUDGET: PASS|FAIL`·进 vitest 门禁）：requests 池封顶 9 万字符（超=红·逼归档）、T0 必读四文件各封顶、**每本手册 ≤80 行从君子约定变机器卡**；基线 `context-budget-baseline.json`（抬预算=显式改基线 diff 可见）；③**范围核查**=每关复查清单第一条（git diff 对照工单「边界」栏·越界=FAIL）+ review-gates.md 红线。测试 `context-budget-guard.test.mjs` 5 例。

### REQ-UI-标题图标槽 · Panel.title / Tabs.tab 加图标位（接受已解析 URL·emoji/文字回退） · [2026-07-15] · PST（game-g 图标全覆盖·owner「干净的美术全覆盖」撞到控件缺口）→ 主程（ui/components 控件集） · status: **✅ done（主程 2026-07-15·当日达）** · 类型: 基座控件扩 prop（additive·非逃生）
> **源起**：owner 07-15「所有美术素材都要能替代·emoji 也要统一风格·都要有连线」。game-g 套装图标已全覆盖接线（批32 + PST 07-15 第二批：fortune/deck/dice/target/shield/skull/mana/shard-tiangang 等，走 `iconUri(token)` → `Label.span.img`/`Card.media`/`Button.icon`/`Tag.icon`），**唯 3 枚接不了**：`dizhi 🀄` / `craft 🔨` 只出现在 `Panel.title`（如 deck-screen 地支段标题、craft-screen 改造坊标题）与 `Tabs.tabs[].label`（导航标签）——这两个 prop 是**纯字符串·无内联图标位**（现有图标位只在 Label.spans[].img / Card.media / Tag·Button.icon）。硬接要么把 Panel.title 拆成额外 header Label（改结构·破布局·不"干净"）、要么塞进 Tabs 标签串（emoji 混文字·非图片）。
> **申请（additive·闭集加位·零回归）**：① `PanelProps` 加 `titleIcon?: string`（已解析 URL）——非 bare 且有 title 时，标题前渲 `<img height:1.05em>`（同 `Button.icon`/`Card.media` 的 URL→img 口径·render.ts 已有 esc+尺寸样板）；缺省=不渲（现有所有 Panel.title 零变）。② `TabsProps.tabs[]` 加可选 `icon?: string`——active/非 active 标签文字前渲同款小 img；缺省=纯文字（现有导航零变）。
> **到货后 PST 一行接线**：`{ title: '地支牌', titleIcon: iconUri('dizhi') ?? undefined }`、Tabs 标签 `{ id:'craft', label:'改造坊', icon: iconUri('craft') ?? undefined }`——真图在场即换、无则纯标题（观感零变），dizhi/craft 即并入"全覆盖"。**trophy 🏆** 另路（天梯行现为裸 innerHTML 串·非 LayoutNode·待 ladderLines 数据化后同法接·PST game-g 域自理，不占本单）。
> **为何走 requests**：`render.ts`/`types.ts` = 基座控件集（主程域·UI铁律「表达不了→requests.md 扩控件·绝不手写逃生」）。这是 REQ-UI-PlayingCard-back/xl 同款「控件缺口·additive 扩 prop」。
> **✅ 完工回执（主程）**：`PanelProps.titleIcon` + `TabsProps.tabs[].icon` 落 types+render+catalog（1.05em 随字号·同 Button.icon 口径·esc 防注入·缺省纯文字**字节不变**）；icon-slots.test +2 组断言（含零回归腿）。PST 可按单内写法接线 dizhi/craft；trophy 待 ladderLines 数据化自理（不占本单·口径确认）。

### REQ-ART-美术工坊愿景 · 美术库改造为「美术编辑器」（货架可视化+AI 加工+接线器）· [2026-07-04] · owner 提出 → Lead 调研出稿 · status: **✅ owner 已批（2026-07-04）·分期开工：M2.5 ✅done（PST 2026-07-06·待 Lead 验收）·M1 排队** · 优先级: P1（方向级） · 类型: 产品化·资产管线（**主责 PST·副责 PA 治理契约·风格锚素材=GD-\<game\>**）
> 一句话：不做 DCC，做**货架管理器+AI 加工台+游戏接线器**三合一，作创作台第三面板（复用 apollo.py/BYO-key/本地 Git）。AI 铁律：修复/变体/生成全是**闭集操作+数据配方**，产物带 provenance 硬字段、**人审门后才入库**。分期 M1 货架可视化 → M2 导入/接线 UI → M3 AI 2D → M4 3D 外链；M0=REQ-PA-3D（在跑）。owner 拍板后 M1 起单派工。

### REQ-026 · [2026-06-26] · PA · game-h 你造我塔/是男人就X层 · status: **⏸ 暂缓/搁置（owner 2026-07-04 拍板先移出活跃池·暂不下沉评估）** · 优先级: P1(rope/spring) P2(conveyor/respawn) · 类型: 真缺口（想象力机关 = effect 写不了 Velocity/Transform、无双体约束）
> 【Lead 注 2026-07-04】owner 指示先搁置本条（暂不做弹簧/绳索/传送带/重生的引擎下沉评估）。记录与下方分析全保留；要重启时按现有拆解（P1 rope+spring 先做）直接接续，无需重提。game-h 现「召唤二重奏版」可玩可测，本条不阻塞。

**标题**：缺"会动的平台个性"与"双体绳索"——参考 NS-SHAFT(平台有个性) + Pico Park(身体当机关) 的灵魂机关当前组合不出

参考有想象力的纵向跳跃游戏后，最出彩的几样机关都卡在同一类引擎缺口（effect 只能改 flag/resource/state/sensor/visible/destroy/timer，**写不了 Velocity / Transform**；也无双实体约束）：

- **弹簧/起跳台（NS-SHAFT 之魂·P1）**：踩上去被弹得很高 → 跨越普通跳够不到的大缺口。需"接触/信号 → 给该实体 `Velocity.vy = -大值`"。建议 `effect.kind:'apply-impulse'`（写 Velocity，可叠加）或一个 `Spring` 组件（contact→给踩它的实体设 vy）。
- **传送带（P2）**：站上去被持续推向一侧。需"站立其上 → 每帧 `Velocity.vx += k`"。建议 `Conveyor{vx}` 组件（ground-sense 命中→加速）。
- **绳索/拴绳（Pico Park 之魂·P1）**：两名玩家被绳拴住——一个坠落另一个可拉住、可借绳荡过缺口、限制别走太散。需**双实体距离约束**（`Tether{a,b,maxLen}` + 一个约束求解 system，确定性）。这是双人游戏最大的想象力来源。
- **坠落重生/检查点（"是男人"紧张感·P2）**：掉出底部/碰危险 → 传回上一个检查点。需"信号 → 设某实体 `Transform.x/y`"（`effect.kind:'teleport'` 或 `Respawn{to}`）。配合"底部追命危险区"(zone→已可扣血)成立硬核基调。

**已试/为何组合不出**：召唤台(plate→set-sensor)、相位/踩碎(timer+set-sensor)、踩头借力(REQ-003)、危险扣血(zone→modify-resource) 都能纯数据做（game-h 已用召唤台做出"你造我塔"二重奏）；但上面四样都要"改 Velocity/Transform"或"双体约束"，现有 effect/组件表达不了。

**优先级**：rope + spring 先做（P1，立刻把 game-h 从"配合解谜"升级到"想象力满格"）；conveyor/respawn 次之（P2）。**不阻塞当前**（game-h 召唤二重奏版已可玩可测）。落地不口头入池。

---

### REQ-G-疲劳休整恢复 · [2026-07-04] · owner → design G(裁定+数值)+程序A(战斗核逻辑+AI)+程序B(恢复演出) · Game G · status: **✅ done（PG·owner 2026-07-06 当面连问三决落·见文末回执）；⚠ sim/关1 难度重标遗留 design G** · 优先级: P1(核心战斗核·压核心稳) · 类型: 战斗核疲劳模型改（离散→连续）+ 平衡重标
> **owner 2026-07-04**：「疲劳被扣战力的牌在场上，下一轮只要不战斗，就恢复 10%，并给个效果。」
> **程序B 评判（受资深程序员+架构师视角·CORE RULE·先审后做）——这不是纯表现、是战斗核逻辑+平衡改，回给 design G / 程序A 定，理由：**
> 1. **现模型不支持"恢复10%"**：疲劳 = **离散 `wins` 连胜数** × `0.5^wins`（每胜战力对折·`turn-combat.ts:249`），满 `WIN_CAP=3` 光荣回库。`0.5^wins` 是整数幂·**没有可连续恢复的"疲劳值"**（owner 想的是一根可回的疲劳条·与现"连胜对折"离散模型不是一回事）。要"恢复10%"须把疲劳**从 `0.5^wins` 重构成连续疲劳量**（如 `fatigue 0..1`·`effMul=1-fatigue`·胜→`fatigue += (1-fatigue)*0.5`·休整→`fatigue -= 0.1`）。= **战斗核模型重构**，非加个字段。
> 2. **平衡反噬**：连胜对折的**设计目的**＝「强兵越战越弱·弱兵车轮磨死它」（`turn-combat.ts:34-35`）。给恢复 = 强兵歇一轮回血 → **部分抵消车轮战**·关1/sim 胜率曲线全作废须**重标**（design G）。owner 要确认这是想要的方向。
> 3. **确定性/turnHash**：每休整轮改疲劳=每轮状态变更→**须无 rng·整数/半整数量化**（本作 pEff 走 round·连续疲劳得定点量化）保回放/lockstep。
> 4. **AI 连带**：`halvedEff`/AI 挑软柿子(`turn-combat.ts:271/627`)按 `0.5^wins` 估·模型变→AI 更新。
> **待 design G 定（spec 问题）**：① "恢复10%"是 **底战力的10%** / **已失战力的10%** / **疲劳值降10个百分点**？② 与 `WIN_CAP=3 光荣回库` 交互（恢复能不能拖过 cap·或续场）？③ "不战斗"判定＝本轮该兵无 clash（`heldIds` 已有此信号可复用）？④ 恢复上限（回到满血 or 封顶）？
> **域**：模型+数值+AI = **design G + 程序A**（战斗核·正确性关键路径·不降档）；**恢复演出（场上「休整中·战力回升」效果 + 数字回升）= 程序B**（本人·逻辑落地后接手·`heldIds`＋新疲劳字段一到就做）。
> **建议**：先 design G 拍模型+方向（尤其平衡反噬 ②），程序A 落连续疲劳+AI+确定性回归测，再 design G sim 重标，最后程序B 补恢复效果。**别让程序B 直接往战斗核塞个拍脑袋的 10%**（会伤确定性+平衡）。
>
> **✅ done（PG·owner 2026-07-06 当面连问三决直接落·授权改战斗核带确定性测）**：模型/数值/演出一并落（owner 在场逐条拍板·非拍脑袋）。
> - **模型**：`TurnUnit.fatiguePm∈[0,1000]`（战力损失千分比）替离散 `0.5^wins`。`pEff` 加整数千分比档 `×(1000−fp)/1000`（无浮点·确定性）。**胜** → `fp += round((1000−fp)×0.5)`（0→500→750→875…·有效战力仍逐胜对折·首几场逐字等价旧模型=owner「数值对了」）。
> - **恢复（决①）**：owner 选「疲劳值降 10 个百分点」；判定＝**本轮真前进(movedNow)且没参战(foughtNow)** → `fp −= REST_RECOVER_PM(100)`（夹≥0·封顶回满）。取「前进」而非「不战」既忠 owner 原话「每走一步恢复」、又让龟缩兵不自愈。
> - **退场（决②）**：owner「这设计过时了·没必要退场」→ **删 WIN_CAP=3 光荣回库**（无自动退场·纯疲劳条治理）。
> - **收敛保底（决③）**：删退场+恢复 → 强兵「不死」·棋盘不轮替 → 少数对局僵持不结（AI-vs-AI+脚本活局实测复现·部分 seed 老模型即僵）。owner 选「加回合上限判胜」→ `MAX_TURNS=60` 到线按大本营血判（高者胜·平则平）。常规对局 ~20-45 回合即结·够不到此线（安全网·非平衡旋钮）。
> - **AI**：`halvedEff` + 软柿子加权改读 `fatiguePm`；`cloneBattle` 带 `foughtNow/movedNow:[]`（EV 推演隔离）。
> - **表现（程序B）**：场上 💢N% 疲劳徽（替 🔥N连胜）；对决明细「战损·疲劳 −N% 战力（本轮不战可回10%）」行 + extras「累计胜N·疲劳N%·歇一轮回一成」；休整回血飘绿「💚休整 +N% 战力」。
> - **门禁**：tsc 0 · vitest 2293 · build ok · 确定性测（疲劳累加/休整回血/无退场）新增。**⚠ 遗留给 design G**：sim 胜率曲线/关1 难度须按新模型重标（REQ 原预判②·MAX_TURNS 值也待 sim 校）。

---

### REQ-UI-积木接口完备性批（Gemini review → P3D 复核裁决 · 交主程/UI）· [2026-07-15] · P3D 转交 → 主程/UI 域（src/ui/components·🔒） · status: **①②③✅ done（UI 域·2026-07-15）·④ 暂缓** · 优先级: P3（接口稳健性·非阻塞·无正确性 bug） · 类型: UI 校验/类型收紧
> **【UI 回执 2026-07-15·①②③ 落地】** 新增 `lintLayoutNode`（`validate.ts`·**与 validateLayoutNode 硬门分离**·全 severity:'warn'·非阻塞·零 issue 门不受影响）：②bg 裸串疑似拼错令牌→`naked-fill` warn（合法令牌/预设/{custom}/CSS 色形不报）·③layout 专用词误塞 props→`bad-layout-placement` warn（**排除 radius** 防误报 Image）·①scroll 祖先内 3D 变换→`flatten-3d` warn。`lint-layout.test` 7 例；index 导出。**⑤ 已按 P3D 采纳改掉 render.ts:162 + types.ts:130 那两句过期「命中区=包围盒」注释**（clip-path 会裁命中区）。**④ Slider debounce 暂缓**（无拥堵实锤·涉 mountUI 输入层节流·待真需求）。类型层弃 `(string&{})` 走渐进（硬删破存量·先 lint 提示）。
> **来源**：owner 让 Gemini review 全量 UI 积木接口（types/catalog/validate）。P3D 逐条对抗性复核（对照 render.ts 实现事实），采纳下列 4 项，回驳 2 项。**归 UI 域·P3D 不改·此单交主程/UI 裁工。**
> **① scroll + 3D flatten 联立校验（低优）**：祖先 `overflow≠visible`（如 Panel `scroll:true`）会把 `transform-style` 算成 `flat`，子树 `z/rotateX/rotateY` 失效。裁：validate 加跨字段警告——节点/祖先 `scroll:true` 且子项带 3D layout(`z/rotateX/rotateY`) → warn。
> **② PanelFill 裸串逃生舱收紧（最该修·与 UI 铁律同向）**：`PanelFill = SurfaceToken|FillPreset|{custom:string}|(string & {})` 的裸 `(string&{})` + catalog 把 `bg` 定成 `type:'string'` → validate 完全不校验 `bg`，弱模型易吐脏串致 fallback 失败。`{custom}` 已是显式逃生口·裸串冗余且弱化闭集（我们自己注释也承认「裸串仍收 back-compat」=自由逃生）。裁：validate 对 `bg` 裸串做警告（非 `#/rgb/rgba/linear-gradient` 前缀即 `bad-enum` 提示）；类型层逐步弃 `(string&{})`。走警告不硬删（护存量数据）。
> **③ fx/anim 误塞 props 定向 lint**：validate 只校验 `node.layout.fx`；误写 `props.fx`/`props.anim` 静默失效。现策略对未列字段宽容（有意防误报）——但对**已知 layout 专用词**（fx/anim/radius/rotate/rotateX/rotateY/z/scale/tilt3d/perspective）出现在 props 定向拦截，零误报高价值。裁：加 `bad-layout-placement` 警告，引导移入 layout。
> **④ Slider debounce 声明（低优）**：UI 铁律禁 handler 塞逻辑（只入队 action 信号）→ 防抖**除做成声明式 prop 别无表达路径**，故天然合法（非过度设计）。当前无拥堵实锤·低优。裁：高频控件（Slider…）可加 `debounce?:number` prop 声明·由消费侧节流。
> **【P3D 回驳·不做】⑤ 异形按钮包围盒误触**：Gemini 前提事实反了——现代浏览器 `clip-path` **会**裁命中测试（透明角点击穿透·不误触），那句"命中区仍是矩形包围盒"只对 border-radius 成立。渲染器异形全走 `clip-path:polygon`（render.ts:165-171）→ 命中区本就正确·**无 bug**。唯一真收获：render.ts:162 注释「命中区仍是元素包围盒」是过期错误·误导后人——**建议主程改掉这句注释**（不改行为）。
> **【P3D 暂缓·YAGNI】⑥ bind → BindingExpression（player.gold 嵌套路径）**：无具名消费者·8 款游戏 flat ResourceId 够用·path 迷你文法=无驱动者的 DSL 扩张（违反 CORE RULE 避免过度设计）。等真有游戏需嵌套绑定再开。
>
> **【P3D 施工红线·2026-07-15·Gemini 给了具体 validate.ts 重构·复核后：思路采纳·代码勿照抄】**
> Gemini 后续交了整份重构 validate.ts。P3D 对照 render.ts/catalog.ts 实测复核，**决定性缺陷**记此，施工者（主程/UI）务必规避：
> - **🔴 props 污染检查的黑名单会误杀合法 props**：Gemini 的 `layoutOnlyKeys` 含 `radius`（=Image 圆角 prop·catalog:90）、`height`（=VirtualList 视口高 prop·catalog:246·默认320），以及 `width/align/justify/opacity/cols/gap/padding/flex/scale/rotate/x/y/margin/direction`——这些既是 LayoutConstraints 名又是真实 prop 名。按名一刀切会**判 catalog 自己的 VirtualList sample(`height:140`) 非法**·违反 validate「不误报未列合法字段」纪律。**正解**：只拦严格 layout-only 且绝不做 prop 名的键——`fx/anim/animMs/rotateX/rotateY/tilt3d/perspective/z/sheen/chamfer/draggable/dropZone`；或按该组件 catalog spec 白名单减集。
> - **🟡 bg 收紧走 warn 不走 hard-fail**（②既定·护 back-compat 存量裸串数据）；Gemini 把它做成 `bad-format` 硬 issue=破坏性变更。且令牌表应从 types 单一源导入·勿复制进 validate（防漂移）。
> - **🟢 3D flatten 检测**：`scroll`/overflow→flatten 铁对；**`glass`/backdrop-filter→flatten 存疑**（CSS flatten 列表明确的是 `filter`·backdrop-filter 未定论）·真浏览器验证前勿断言 glass。渲染器是「谁有3D谁自带 preserve-3d」(render.ts:117)·故 flatten 仅嵌套3D 才咬人=低频·符合①低优定级。`has3DTransformsInSubtree` 每节点重扫=O(n²)·宜一趟自底向上。
> - **⚪ 杂**：删 `// cite:` 噪声·收敛 `any`·新增 kind(`constraint-conflict`/`bad-format`) 同步进 `UiIssue` 联合。

## 2026-07-15 owner 逐槽裁定（1移除/5完成/6撤单/9压后）

> 【owner 2026-07-15 裁：撤出主池】纲领文档仍在 docs/design/demo-sprint-2026-07-29.md·执行走流程板与各角色档
### REQ-DEMO-0729-审核冲刺总纲 · 自然语言→playable·30 款/周换皮量产·美术 API 自动接线 · [2026-07-07] · **owner 定向（7/29-30 审核）** → Lead 出纲领 · status: **in-progress（冲刺主线·压过一切非冲刺工单）** · 优先级: **P0（死线级）** · 类型: 产品化冲刺（纲领=`docs/design/demo-sprint-2026-07-29.md`）
> 审核口径：引擎能否用自然语言快速生成 playable 游戏；量化=周产 ~30 款、换皮为主力、基本玩法 OK 即可。最大缺口=美术（game-q 实证零真资产）。
> **核心判断（Lead）**：`art:` 引用已是弱 LLM 数据接口（`src/assembly/resolve-art-refs.ts`）——**全在服务层，不动引擎**。**工作流定形（owner 2026-07-08·两段式）**：placeholder 先行（免费库·秒可玩）→替换列表→整批风格统一生成→对位替换；正式档=`docs/design/art-replacement-workflow.md`。
> **归置与优化闭环（owner 2026-07-07 拍板·替代 Lead 原「两轨制」提法）**：①自动生成直接落**该游戏自己的资产目录**+本地索引（provenance+unreviewed 标·立即可玩）——owner 认可可行；②**硬要求**：每游戏出**美术台账**（资产编号 art-01…·槽位语义·prompt·来源·缩略图），studio 可浏览、可**按编号点名替换**（重生成/库内换/上传换）——「做完以后需要有一个完整的浏览和优化的流程」；③共享货架不变：进共享 index 仍过 M2.5 人审门。
> 分单：T1（下条·PST+PA·7/13）→ T2 换皮（下下条·7/18）→ T3 批量冒烟（Opus·7/20）→ T4 3D 线待拉动（P3D 知会·不进关键路径）→ T5 彩排（Lead 主持·7/27）。
> **队列重排（冲刺期有效）**：PST=T1→心跳余项（并入 T1 进度灯）→T2；**音频 B 件、M1 货架墙、REQ-3D-像素断言、REQ-CAP-改掷收编一律冲刺后**；引擎域冻结非必要改动。

> 【owner 2026-07-15 裁：完成】核心（作业模型 job+轮询+elapsed 心跳）已被 Workshop 服务端异步任务批覆盖（main_entry/jobs.py）·owner 认定完成
### REQ-STUDIO-生成进度与心跳+交互日志 · 长生成黑箱→阶段灯/心跳/秒表 + LLM 往返 JSONL 日志 · [2026-07-04·07-06 扩] · owner → **指派：PST 或 Opus（P0 存盘单完工后立即接·同 apollo.py 防并行冲突）** · status: **第 0 项 ✅ done（Opus·2026-07-06·随低模四件单同批做掉·门禁全绿）；余项（作业模型/阶段灯/BusyIndicator）排队待 PST** · 优先级: P1 · 类型: 产品体验（长任务可见性）
> **✅ 第 0 项完工回执（Opus·2026-07-06·随 REQ-STUDIO-低模四件同批·同 apollo.py 区域合批防冲突）**：apollo.py 每次 LLM 往返落一行 JSONL 到 `.apollo/llm-logs/YYYY-MM-DD.jsonl`（新 gitignore）——覆盖全部往返模式（`chat`/`generate`/`revise`/`prototype`/`breakdown`/`template-edit`/`autofix-k`）：`{ts,provider,model,mode,promptChars,responseChars,validation,errors[截断200],elapsedMs,usage?}`。**API key 绝不落盘**；prompt/response 全文默认不落（只落长度），`APOLLO_LOG_VERBOSE=1` 才落全文（全文仍无 key）。日志接线在统一传输层 `_provider_request`（度量）+ 各 handler（mode/validation）·best-effort（异常吞掉不拖垮生成）。排障口径已随低模单落进测试。**余下 1-4 项**（作业模型 job-id 轮询·阶段闭集·BusyIndicator 统一件·延迟档 e2e）**未做**·仍属本单待 PST/后续 session 接（与已落的 apollo.py 日志无冲突）。门禁：随低模四件单一并全绿（tsc/vitest 2315/build/ast）。
> **owner 现象**：生成稿子过程系统一直在工作，但界面无任何进度/心跳——用户不知道是活着还是死了。
> **spec（Lead 图纸）**：
> 0. **LLM 交互日志（owner 2026-07-06 追加「辅助诊断」·本单第 0 项·最先做）**：apollo.py 每次 LLM 往返落一行 JSONL 到 `.apollo/llm-logs/YYYY-MM-DD.jsonl`（gitignore）：`{ts, provider, model, mode(chat|generate|autofix-k), promptChars, responseChars, validation:'pass'|'fail', errors[截断], elapsedMs, usage?{provider 回的 token 数}}`——**API key 绝不落盘**；prompt/response 全文默认不落（只落长度），`APOLLO_LOG_VERBOSE=1` 才落全文（本地排障用）。排障口径回填 `docs/playbooks/testing.md` 一行。今天那种"三轮失败是什么"的问题从此 `cat` 一下就有答案。
> 1. **作业模型（照 steam-publisher serve.py 轮询先例·弃长连接）**：生成类端点（`/api/generate`·design 各段·`/api/assets/generate`）改「提交即回 job-id → 前端轮询 `GET /api/jobs/<id>`」：`{stage, detail, elapsedMs, heartbeatAt, done?, error?}`。轮询短请求天然免疫代理断长连接——这就是"心跳维持"的正解。
> 2. **阶段闭集（诚实进度·非百分比）**：`submitted → provider 响应中 → 校验中 → 自动修复 k/3 → 落盘 → done|error`。**禁止假百分比进度条**——LLM 无真进度，编造=对用户撒谎；给的是：阶段灯 + 已耗时秒表 + 最后心跳时间（>15s 无心跳显"可能卡住"黄条，超时显式红）。
> 3. **前端统一件**：一个 BusyIndicator 组件（阶段灯/秒表/心跳/出错红条），DesignStudio、CreationWizard、AssetGenPanel 三处共用——别一处一套。
> 4. **测试**：mock provider 加人为延迟档 → e2e 断言阶段灯逐段点亮、心跳时间戳在跳、错误路径出红条不丢线程（接 P0 单的"失败不降级"）；smoke 补 job 生命周期（submit→poll→done / submit→error）。
> 5. 二期可选（本单不做）：取消按钮（DELETE job·杀子进程）——先记不实现。
> 门禁全绿；Lead 验收=真浏览器盯一次真实生成全程（或 mock 延迟档）。

> 【owner 2026-07-15 裁：B 撤单】A+D 已 done·C 在 3D 池；B（音频线）细节过期·撤单待 owner 重新分配
### REQ-ART-TGS吸收四件 · threejs-game-skills 对照吸收（视觉评分卡/音频线/像素QA/手册红线） · [2026-07-06] · owner 给源 → Lead 调研裁决（`art-pipeline-vision §八`）→ **owner 已批（2026-07-06）** · status: **落地中：A+D ✅ done（Lead 亲笔 2026-07-07）· B spec 就绪→指派 PST（**冲刺后**·被 REQ-DEMO-0729 队列重排压后）· C spec 已移 `docs/workflow/requests-3d.md`（P3D 域·同被压后）** · 优先级: P2 · 类型: 质量护栏吸收（不采其代码生成路线·宪法相反）
> ↑（旧影·早期归档轮副本）本单后回池续活至 07-17 暂停——**最新状态与 ⏸ 暂停判词见本文件后部同名条目**（grep 第二处为准）。
> 一句话：他家"AAA"不是描述词，是四道门（评分卡全维≥2/证据台账/反捷径工艺律/canvas 像素断言）——护栏纪律照单吸收，代码生成路线回驳。详见愿景稿 §八对照表。
> **A ✅（Lead 亲笔）**：新 `docs/playbooks/visual-scorecard.md`（8 维 0-3 分·premium=全维≥2·证据台账+资产来源台账+凭证探针·反捷径工艺律·判词 `VISUAL: n/24 · PREMIUM: YES|NO`）；挂点=playbooks/index 一行 + P3D 视觉验收（3d.md 红线区指回）+ PS 出货内门（PS-steam-finish-list 阶段区一行）。
> **D ✅（Lead 亲笔·手册回填）**：`docs/playbooks/3d.md` 红线区加工艺顺序律（先造型→材质→光照→特效·禁 glow 冒充）+ 主角面禁纯程序化（无 blocker 记录不豁免）；`docs/playbooks/testing.md` 红线区加凭证探针（空口 skip 不采信）+ 做X表挂评分卡行。
> **B spec（Lead 图纸·指派 PST·工坊 M3.5·与其他 studio 单碰 `apollo.py`/`scripts/ai-gen.mjs` 须串行——排 REQ-STUDIO 心跳余项之后）**：① `scripts/ai-gen.mjs` 加 audio adapter：类型闭集 `sfx|ambience|ui`；BYO-key provider（有 key 走真调，无 key→**先贴凭证探针输出**再走 mock 兜底=确定性占位 wav+MOCK 标记，绝不静默顶替）。② 产物一律落待审区（**复用 M2.5 人审门** writePending/reviewPending·绝不直登 index），provenance 硬字段同 2D/3D（model/prompt/date/license 缺一拒登）。③ 定位：`SynthAudioPort`/SfxSpec 合成=数据仍是首选路（见 `docs/playbooks/audio.md`）；工坊采样线只补合成表达不了的（音乐床/环境底噪）——声音货架从现存 1 条起步。④ 测试：`scripts/ai-gen.test.mjs` 增音频四例（pending/approve/reject/provenance 缺字段拒）+ `scripts/art-review-smoke.py` 扩音频类型断言。⑤ 门禁全绿直推；完工标 ✅ 待 Lead 验收 + PA 会审登记契约。

> 【owner 2026-07-15 裁：压后】无正式 appid·发行轨整体搁置·重启时另开单（PS 契约硬化成果在 archive/PS handoff）
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

## 2026-07-15 owner 二轮裁定（2撤单/4压后）

> 【owner 2026-07-15 裁：撤单】非当前重点·随冲刺总纲一并撤·重定冲刺目标时再开
### REQ-DEMO-T3-批量吞吐冒烟 · 周产 30 款的机器证据 · [2026-07-07] · Lead 图纸 → **指派：Opus 档 session/子代理** · status: open（T1 完工后接） · 优先级: P1 · 期限: 7/20 · 类型: 冲刺 QA
> **spec**：① 新建批量冒烟脚本（scripts 下·batch-gen-smoke）：mock LLM+mock 美术连出 N=10 款 e2e——生成→美术编排→parseManifest 零 error→audit 无新红旗；判词 token `BATCH: PASS|FAIL`+退出码；fail-fast（哪款第几步死点名）。② 真 key 抽 3 款全真跑通，记录单款耗时/成本/token 写进回执（demo 出示件·折算周产能）。③ 照 `docs/playbooks/testing.md` 三禁（mock 路径零外部 IO·种子固定）。完工标 ✅ 待 Lead 验收。

> 【owner 2026-07-15 裁：压后】随 Steam 轨整体压后（PS 后端契约成果保留在案·apollo 代理+向导页 UI 未做·重启时续)
### REQ-PUBLISH-创作台一键发布 · player 模式内「打包→上传 Steam」一键流水线 · [2026-07-04] · owner 口头指派 → PS 转呈（跨 PS↔PST 域） · status: **裁决完毕（Lead 2026-07-04·见文末）·PS 先行硬化契约·PST 排队接 UI** · 优先级: P2（产品体验·非阻塞） · 类型: 产品化·发行管线接入创作台（后端多已存在·主要是接线）
> **源起**：owner 2026-07-04：创作台 **player 模式**下把发布按钮/路口接好——一键打包、填自己的 Steam ID/AppID，让用户「一条流水线产出游戏」。**范围裁决（owner 当面答 PS 二选）**：① 承载面 = **创作台 player 模式（网页）**；② 深度 = **尽量一路到 Steam 上传**（能自动的自动到 steamcmd upload 为止）。
>
> **后端多已存在（接线，非造轮子）**：`steam-publisher/serve.py`（HTTP API：配置→build 裸目录→生成 VDF→steamcmd 上传·含实时日志轮询）、`scripts/dist.py`（打包菜单）、`electron-builder.yml`、平台接线（成就/云/富状态）均就绪。缺的是①把它接进 studio player 模式 UI ②一条 studio 能稳定调的发布 API。
>
> **PS 提议域切分（请 Lead 裁）**：
> - **PST 域（UI）**：player 模式内「发布」区——选游戏/平台、填 AppID/DepotID/builder 账号（=用户 Steam ID）、进度与日志展示。走 studio 现有 React 产品面（非游戏 UI 铁律范畴）。
> - **PS 域（管线契约）**：提供 studio 可调的稳定发布 API/CLI：`package(game,platforms)`→`genVDF(appId,depots)`→`upload(builder)`，带进度/日志流。由现有 `steam-publisher/serve.py` 端点收敛/硬化而来（apollo.py 转发 或 studio 直连本地端口）。= PS 施工物。
>
> **必须显式标给用户的「不能自动」三步（architect 诚实·Valve 无 API）**：① 用户自己的 $100 合作伙伴账号 + 真 AppID/DepotID；② 本机装 steamcmd + 首次缓存登录（Steam Guard 令牌需终端手输一次）；③ 上传后后台 **Set Live**（防误推线上·故意手动）。故「一路到 Steam」= 自动到 upload 为止 + 向导显式引导这三步，非黑箱全自动（细节 `steam-publisher/RELEASE-PROCESS.md`）。
>
> **请 Lead 裁**：a) 域切分是否如上（PST 接 UI / PS 供管线 API）；b) 接入形态——studio 直连 steam-publisher 本地端口 vs 经 apollo.py 转发 vs 内嵌重写；c) 派工。
>
> **Lead 裁决（2026-07-04）**：
> a) **域切分照准**——与角色卡边界严丝合缝（PST=studio 前端+apollo.py 服务面；PS=steam-publisher 管线），无需调整。
> b) **接入形态=经 apollo.py 转发**（薄代理 `/api/publish/*` → steam-publisher serve.py）。理由：①studio 前端现在只认一个后端缝（`/api/*` 相对路径），M5 Electron 打包正靠这条缝换传输层——直连第二个本地端口会破缝+引 CORS+双服务生命周期；②发布是危险面操作，收进 apollo.py 统一走已有的路径防护/审计口；③内嵌重写=造第二套管线，回驳。转发层**只透传不塞逻辑**（进度/日志流原样代理）。
> c) **派工**：PS 先行（自请照准）——serve.py 编排 API 硬化成稳定契约（`package→genVDF→upload` 三段 + 进度/日志 + 判词 token 收口）+ mock/480 冒烟；PST 随后接 player 模式发布区 UI（**「三步不能自动」必须做成显式向导页**，不许藏在文档里）；两段各自门禁绿，联调验收=Lead。P2 维持（各自接在当前核心工作之后）。status 更新 → **裁决完毕·PS 可先行**。
>
> **PS 契约硬化完成（2026-07-04·owner「可以先做」+ Lead 裁准 PS 先行）**：`serve.py` 按 Lead c) 硬化成稳定契约——**三段命名** `stage_package/stage_genvdf/stage_upload` + `plan_pipeline` 组合 + additive `POST /api/plan`；**判词 token 收口**（段判词 `ST_OK/ST_BLOCKED`、任务判词 `JOB_IDLE/RUNNING/DONE/ERROR`·`job_status()`，接进 `/api/state`+`/api/log`，消费端不 scrape 日志）；无真账号冒烟 `scripts/steam-publish-smoke.py`（480·**24 断言**·退出码门禁·自证可红·登记 testing 手册）。apollo.py 薄代理 `/api/publish/*` 透传即用。**余：apollo.py 代理（服务面域）+ PST 接向导页 UI**。详见 `finish/PS-steam-finish-list.md`。

### REQ-M3-三消二期 · match3-board 特殊糖+格层+目标接线（糖果传奇级机制补全） · [2026-07-16] · owner 拍板（新三消游戏立项前置）→ Lead 出图 → **指派：Opus** · status: ✅ done·Lead 对抗性验收 PASS（2026-07-16·归档） · 优先级: P0 · 类型: 引擎 capability 二期（tier3·正确性关键·不降档）
> **背景**：一期 `src/skills/tier3/match3-board.ts`（REQ-C-001·换/找连/消/重力/补/连锁·确定性相位机·14 测）核心健全零消费方；糖果传奇级还差特殊糖、格层（果冻/障碍）、目标接线。
> **图纸（Lead·组件/语义/测试写死）**：
> 1. **格编码**：cells 仍纯整数——低位=色 0..kindCount-1 + 高位 flag 闭集 `STRIPED_H/STRIPED_V/WRAPPED/COLORBOMB`（球无色·色位哨值）；导出 `makeCell/cellColor/cellSpecial` helper，全整数位运算保确定性。
> 2. **特殊糖生成**（消除结算按 run 形状）：4 连=条纹（方向走 config `stripedOrientation:'perpendicular'|'parallel'`·缺省 perpendicular）；L/T 交叉=WRAPPED；5 连=COLORBOMB。生成位=玩家交换格优先、连锁时 run 中点。
> 3. **触发效果**：条纹=整行/列；包装=3×3（V1 一次爆）；彩球+普通交换=全盘清该色；`comboTable` config 闭集预置 4 条（纹+纹=十字、纹+包=3行3列、包+包=5×5、球+球=全盘）；被波及特殊糖连锁引爆用**显式工作队列+已处理集**（有界·防递归）。
> 4. **格层**：MatchBoard 加可选 `jelly?: number[]`（0/1/2·本格参与消除减 1）+ `blockers?: number[]`（>0=hp·邻接消除减 1；-1=石块不可动不可消）；重力/补块尊重石块（不落不补不滑）；层变化只改 BoardCell 外观（config 映射·不增删实体）。
> 5. **步数与目标**：`movesResource?`——合法交换扣 1（非法步回退不扣）；果冻/障碍消除按 `jellyResource?`/`blockerResource?` 写 ResourceModify（沿 kindResource 模式）→ 胜负走现成 Condition，**不新造胜负系统**。
> 6. **红线**：确定性（RandomSeed·整数·禁裸随机/Date）；相位机纪律不破；组件契约只加可选字段（旧 config 行为逐字节不变）；一期 14 测零回归。
> 7. **测试点名（缺一不关单）**：编码 helper；4 连横/竖×两种 orientation；L/T 产包装；5 连产球；各效果清除集；4 条 combo；引爆队列有界；果冻减层/清零计数；障碍减 hp/石块不动不补；重力绕石块；moves 扣减+非法步不扣；目标资源写出；同 seed 全程复现；一期全量回归。
> 8. **回填**：`docs/playbooks/casual-toolkit.md` 加三消一行。完工标 ✅ 待 Lead 对抗性验收。
>
> **✅ 完工回执（Opus·2026-07-16）**：`match3-board.ts`——全整数格编码(`makeCell`/`cellColor`/`cellSpecial`·旧纯色编码=自身逐字节兼容) + 特殊糖生成(4连条纹随`stripedOrientation`·L/T包装·5连彩球·生成位交换格优先/连锁取run中点) + 触发效果(行/列/3×3/全色) + **有界连锁引爆**(显式工作队列+已处理集·互指条纹环收敛) + `comboTable`组合(cross/threeRowsCols/fiveByFive/wholeBoard·彩球换普通清该色) + 格层(`jelly`减层·`blockers`邻接减hp/石块-1分段重力不落不补) + `jelly/blocker/movesResource`写ResourceModify→现成Condition判目标。组件契约 `MatchBoard` **仅加可选字段**·一期14测零回归·门禁全绿(tsc+vitest 349文件2665测·match3 由14→37+build+2 guard)。回填 casual-toolkit.md。
>
> **⚖ Lead 对抗性验收（2026-07-16·判 PASS·关单归档）**：独立复跑全绿（tsc·vitest 349 文件/2666·build·双守卫）；亲读核心 diff——格编码旧值逐字节兼容、`resolveClear` 有界队列（每特殊糖至多处理一次）、分段重力/障碍位不补、彩球连锁引爆确定性取全盘最多色（并列取最小色号）、L/T 并查集判交叉——实现与图纸相符；「一期测试零改动」核实（唯一删除行=import 展开）。**偏差裁决**：①comboTable 不进 describe.fields——INTENTIONAL 准许（FieldType 闭集不为单字段扩张·契约注释已记·弱 LLM 发现性受损再走 capgap）；②层视图不内建——INTENTIONAL 准许（机制/表现分离·避免臆造 config 形状），**留尾巴**：新三消游戏若首发含果冻/障碍关，S2 计划门前由 Lead 补「LayerCell 静态覆盖格」小 spec（blueprint 静态建覆盖实体·能力只改外观·沿 BoardCell 同型·零实体增删），防游戏层自写视图 system 违宪——此尾巴记入该游戏 capability-plan，不占引擎池槽。

### REQ-UI-emoji图渲 · 文本里的 emoji 自动渲成库里美术图（Twemoji·render-only） · [2026-07-16] · owner「emoji 直接用库里美术 emoji 替换·别逐个手转槽」→ PA 出映射底座 → **指派：PUI（UI 库渲染线域）** · status: **✅ done·Lead 对抗性验收 PASS（2026-07-16·归档）** · 优先级: P1（game-g 456 处 + 全线通用·省掉逐处 icon 槽手转） · 类型: 引擎 UI 库能力（render-only）
> **owner 意图**：UI 文本里大量用 emoji 当图标（game-g 光运行时 UI 就 456 处）；不必逐个手转 Image 槽——**我们有 4871 张 Twemoji 美术图**（共享货架 `assets/emoji/<码点>.png`·CC-BY·category:emoji），让渲染器**自动把文本里的 emoji 换成对应美术图**（像 Discord/Twitter twemoji-parse）一次覆盖全线 + 以后所有 emoji。
> **PA 已交付底座（`b34ba961` 之后·本单）**：`scripts/emoji-resolve.mjs`（+`.test.mjs` 4 测绿）——`resolveEmoji(char)` → `{cp, id, path, match:'exact'|'alias'|'none'}`，码点算法与 `import-emoji.mjs` 一致（严丝合缝库内文件名）；`exact`=库直中 `assets/emoji/<cp>.png`，`alias`=Unicode 符号就近替（`★→⭐`·`SYMBOL_ALIAS`·可逐个否决）。`coverage(game)` 出覆盖表。**game-g 实测 74 种/456 处=直中 68/415 + alias 6/41 + 无 0（100% 可映射）**；映射表 `docs/design/game-g/emoji-art-mapping.md`、emoji 清单 `docs/design/game-g/emoji-icon-inventory.md`。
> **PUI 施工 spec**：① 渲染层（`Text`/`Label`/`spans`/`Button.label` 等文本路）渲染时扫文本 emoji 码点 → 内联替换成 `<img src=已解析资产>`（1em·baseline·随字号）；非 emoji 照旧、缺省零回归。**复用现有「URL 按图渲」机制**（批32：`Button.icon`/`Tag.icon`/`Label.spans[].img`/`Card.media` 已支持已解析 URL 内联图渲·`icon-slots.test.ts`）——本单是把「手动填 URL 槽」升级成「文本 emoji 自动解析」。② 取图=调 PA `resolveEmoji`。③ **资产可达（PUI+PA 会审二选一）**：(a) 直引共享 served `/assets/emoji/<cp>.png`（简单·但破本地 hermetic）；(b) build 期按游戏扫用到的 emoji → 只 vendor 那批进本地（干净·PA 可给"游戏 emoji 清单→vendor 列表"）。**(b) 机制 PA 已建**：`scripts/emoji-vendor.mjs`（+`.test.mjs` 2 测·默认 dry-run·`--apply` 才写）——扫游戏 UI emoji→去重解析→copy 进 `public/games/<g>/art/emoji/<cp>.png` + 登记本地 index（id=`emoji/<cp>`·码点键·带 `vendoredFrom`）。**game-g dry-run=71 张唯一美术图待 vendor**；PUI 定 (b) 就 `--apply` 一下即可。倾向 (b)、可先 (a) 打通。④ **opt-out**：某处要保字形（代码块/刻意）给转义开关。⑤ 红线：render-only·不进 sim/hash·尺寸/对齐走令牌·不新增控件（是渲染器增强·catalog 描述回填一行）。⑥ 测试：含 emoji 文本→渲 img src=对应资产 + 非 emoji 零变 + alias 生效 + opt-out + `/check-ui` 过 + **game-i 展示台活范例一段**。完工标 ✅ 待 Lead 真浏览器验收 + PA 会审映射接线（`resolveEmoji` 用对）。
> **边界**：`src/ui/**` 渲染器 = PUI 独占（PA 不碰）；映射底座 `scripts/emoji-resolve.mjs` + `SYMBOL_ALIAS` + emoji 货架 = PA 维护（alias 调整/新符号 PA 会审）。**落地后 game-g 456 处 emoji 无需逐个转槽**——批32 的手动 icon-槽路只留给"非 emoji 的专属美术图标"。
> **PUI 回执（done·2026-07-16）**：① 渲染层 `src/ui/components/emoji.ts`（纯浏览器安全）+ 渲染器 `escT`（esc→emojify）接入 **Label.text/spans · Button.label/sub · Tag · Badge · Tabs · Card.title/sub/media-glyph** 七类显示文本位；配置 = `UITheme.emoji:{base,size?}`（挂主题·mountUI 已线程 theme 到 renderNode·零签名改）；不配=文本 emoji 零回归（escT 退化成 esc·字节一致·全绿证）。② cpName + SYMBOL_ALIAS **与 PA `emoji-resolve.mjs` 一致**；alias（★→⭐ 等）静态改写码点。③ 资产可达=**方案(b) vendor 进本地**（`node scripts/emoji-vendor.mjs game-i --apply`·79 张→`public/games/game-i/art/emoji/`·served·hermetic）；base 指过去。④ opt-out=`Label.raw:true`（保字形·代码块/刻意）。⑤ render-only·不进 sim/hash·1em 随字号·零新控件（catalog 补 Label.raw 一行 + ui.md 新增「文本 emoji 自动图渲」行）。⑥ 测试 `emoji.test.ts`（19 测·cpName/alias/emojify/renderNode 集成/raw 逃生/属性不误转/零回归）+ `/check-ui` 两审绿（`tabemoji-daylight`+`tabnew-daylight`·重叠0/对比0）+ **真浏览器验收**（game-i UI 模块独立「🎨 emoji 美术」tab `t-emoji` 段 + 全 hub·79/79 emoji img 全加载·零破图·截图存证）。全套绿：tsc0 / vitest 2662 / build✓。**关键踩坑（与 PA 会审项）**：渲染端检测范围必须 = `emoji-audit.mjs` ICON 范围（`1F300-1FAFF·2600-26FF·2694-2699·1F004·2654-265F·2660-2667`）——起初用 `\p{Extended_Pictographic}` 比 vendor 宽，✨(2728·Dingbats 块 audit 故意不收) 被转成 <img> 却无 vendor 资产=破图；已把 `emoji.ts` 的 ICON 类**镜像 audit** → 渲染集 ⊆ vendor 集、破图归零（✨/箭头/勾叉留字形·符合「排印记号不图标化」）。**同步债**：该 ICON 范围两处（audit 侧 PA / render 侧 PUI）须保持一致；ZWJ/肤色家族的组合图 vendor（audit 现逐码点检测）留 PA 侧后续（game-i 现零多码点 emoji）。**game-i `art/index.json` 现承载两类**（tex/* UI 皮 + emoji/* vendor）→ `ui-assets.test.ts` 改按 `emoji/` 前缀分类比对。
>
> **⚖ Lead 对抗性验收（2026-07-16·Fable 亲验·owner 授权「review 代码可关就关」）：判 PASS 关单。**
> - **独立复跑**：emoji.test.ts 19 + emoji-resolve/emoji-vendor/ui-assets 共 30 测全绿；tsc/vitest 全量/build 三绿（推送门禁同跑）。
> - **代码亲审**：escT 只接**内容文本位**（Button.label/sub·Label.text/spans·Tag·Badge·Tabs·Card），HTML 属性（title/value/option/data-arg）零污染；format 数字路保 esc；raw 逃生贯通 text/spans 两路；base/size 防属性越狱。
> - **镜像核对（代 PA 会审映射接线）**：cpName/SYMBOL_ALIAS/ICON 范围三样与 emoji-resolve.mjs / emoji-audit.mjs 逐字一致；vendor 完备性亲测=missing 0·计划↔磁盘 80 张一一对齐。**回执自标的同步债已机器化**：新增 `scripts/emoji-sync-guard.test.mjs`（5 测：cpName 行为等价/alias 逐条相等/ICON 逐字一致/alias 源必在渲染范围/alias 目标必在库）——两侧词表自此谁单改谁红，改动须 PA+PUI 同提交同改。
> - **真浏览器（swiftshader·hub→UI 控件→🎨 emoji 美术 tab）**：83 张 emoji `<img>` 全加载·零破图·零网络请求失败；页签图渲 4 处 ✓；对照段=自动段 4 img（emoji-cmp-a）vs raw 段保字形 🎲🎴🎯🏅（emoji-cmp-b）✓；截图目检成立。
> - **遗留（不阻塞关单）**：① ZWJ/肤色**组合图 vendor** 留 PA 侧后续（audit 现逐码点检测·game-i 现零多码点 emoji）；② game-g 456 处的实际接线=game-g 侧开 theme.emoji + vendor --apply（游戏级工单·写 game-g 自己的需求单·不占引擎池）。

### REQ-UI-锚定与绑定层 · UI 声明化二期（REQ-ARCH-ANCHOR 历史欠账收账） · [2026-07-04] · owner 亲派 → **指派：PUI（UI 基座 + 展示台程序员）** · status: **①锚定 ✅ PASS（PUI 2026-07-16·Lead 验收 CONCERNS→偏差B 文档诚实化已修·转 PASS 关账）；②绑定层 设计稿已交·待 Lead+PST 共审（PUI 2026-07-16·`docs/design/ui-binding-layer-2026-07-16.md`·过审才施工）** · 优先级: **P1（弱 LLM 产完整游戏的最大单一杠杆·底座终审 🔴#3）** · 类型: 引擎 UI 库能力（render-only）

> **✅ ①锚定完工回执（PUI·2026-07-16·请 Lead review·真浏览器 demo 已截图自证）**：
> - **闭集新件两枚**：`Float{anchorTo:{kind:'entity'/'node',id,at?,offset?},ttlTicks?}`（children 每帧钉目标 live rect·头顶名牌/血条/伤害数）+ `Connector{from,to:anchorRef,style:solid/dashed/arrow,tone令牌,label?}`（「谁打谁」连线）。进 `ComponentType` 闭集 + `catalog`(38 覆盖门) + 校验器同步。
> - **锚源两路**：`node`=同 mountUI 树 LayoutNode id（`host.querySelector('#id')`）；`entity`=渲染层给实体 DOM 盖统一锚标 `data-entity-anchor="<id>"`（**契约·渲染器出·非游戏自造 `u-<id>`**）。`at`=center/top/bottom/left/right + `offset`。
> - **定位机制**：`mountUI` 起 rAF 跟随循环（`ensureAnchorLoop`·mount + 每次 update 幂等启动·无锚定件自停省帧·teardown 取消）——每帧读目标 `getBoundingClientRect` 摆 Float(fixed·跟随滚动) / 连 Connector 两端；**目标消失/隐藏(rect 0)→自隐**（不悬空不报错）。**render-only·不进 sim/hash**·线色走令牌非裸 hex。
> - **消灭的病**：game-g `game-g.tsx:372/411-413/440` 手写 `getElementById('u-'+id)`+`getBoundingClientRect`+`createElement`（createElement×27 红旗大源）现有数据退路——战场替换由甲/程序B 随战斗 UI 批消费（不在本单强做）。
> - **测试与自证**：`anchor-float.test.ts`（5·渲染标记/箭头虚线/mountUI 挂载+teardown 不抛/校验器）+ `/check-ui` 过（ui-audit tabnew 0 阻断）+ **game-i「🆕 新控件/特性」`t-anchor` 段活范例**（战场三单位 + 名牌 Float + HP 条 Float + 攻击箭头 Connector + 关系虚线·swiftshader 截图已验各就位）。回填 `docs/playbooks/ui.md`「锚定层」行。tsc+vitest(2629)+build 三绿。
> - **②绑定层**：按 spec「设计稿先行·不许直接开写」——**未动**（需与 PST 共审绑定语法闭集设计稿·过 Lead 审才施工）。
>
> **⚖ Lead 对抗性验收（2026-07-16·Fable 亲验）：①判 CONCERNS——实现放行，entity 路两尾巴（B 修完本条 ① 转 PASS）。**
> - **独立复跑**（非采信自报·本容器 npm ci 全新装）：tsc ✅ · vitest 345 文件/2633 全过 ✅ · build ✅ · context-budget/docs-ref PASS。
> - **真浏览器行为探针**（swiftshader·hub→UI 控件→新控件 tab）：名牌 Float transform=(327,245) 恰=目标 rect(286,251,82×116) 顶中点+offset(−6) ✓；HP Float (327,379)=底中点+12 ✓；Connector line (368,309)→(408,309)=赵右缘→关左缘 ✓；−120 箭头/关系虚线目检 ✓。5 点名测试/catalog 38 门/校验器/ui.md 回填/②正确克制/rebase 保 REQ-ART-TGS 均核实 ✓。
> - **偏差A · OUT OF SCOPE（回改 spec §1·Lead 自领）**：「渲染层给实体 DOM 盖 `data-entity-anchor`」在现引擎不成立——2D play-field 是 canvas-renderer（无逐实体 DOM），3D 是 WebGL 同理；全库该属性**零生产者**（唯一消费点 `src/ui/components/server.ts:295`）。且现病灶不需要它：game-g 战场单位本身是 LayoutNode（`turn-battle-screen.ts:253`·id=`u-<id>`）→ node 路已对症。裁决：**entity 路降级为预留契约**（YAGNI·出现 canvas/WebGL 实体锚定的真消费者时再开引擎单——rect 注册表或 DOM 代理·Lead 域设计；CSS3D/Diegetic3D 面归 P3D）。spec §1 前半句作废，以本裁决为准。
> - **偏差B · ERROR（打回一行·指派 PUI·P2 小活）**：回执/手册把 entity 路写成已通路径——`docs/playbooks/ui.md` 锚定行「游戏战场用这个」+ `catalog.ts:147` describe + `gallery.ts:847` 注记会引弱 LLM 走死路（浮层永远自隐·零报错·正是手册铁律要防的坑）。修法：三处改注「**entity=预留·生产端未接·现一律用 node 路**」。
> - **✅ 偏差B 修复回执（PUI 2026-07-16·关 CONCERNS）**：Lead 点名三处 + 我自查出第 4 处（`types.ts` AnchorRef JSDoc 同样把 entity 写成已通）——**四处全改注**「entity=预留契约·生产端未接（2D canvas/3D WebGL 无逐实体 DOM·全库零生产者）·别用·现一律 node 路」：① `ui.md` 锚定行 ② `catalog.ts` Float.anchorTo describe ③ `gallery.ts` t-anchor-note ④ `types.ts` AnchorRef JSDoc。**代码零改**（entity 分支保留为预留契约·符合偏差A裁决·真消费者出现再开引擎单）。门禁全绿（tsc+vitest+build+docs-ref+budget）。**本条 ① 转 PASS 关账**；②绑定层照旧等设计稿共审。
> **owner 2026-07-04**：「UI 锚定点加绑定层，派给 UI 程序员做，我让 UI 程序员查。」出处：底座终审 `docs/design/base-capability-review-2026-07-03.md §二🔴#3 + §四.3`（锚定与绑定**分两步**·锚定先行）。
> **要消灭的病（现状证据）**：game-g 战场徽标/VS 连线/胜负挂牌全靠手写 `getElementById('u-'+id)` + `getBoundingClientRect` + `createElement`（`game-g.tsx:372/411-413/440`）——正是 audit 红旗 createElement×27 的一大来源；每个游戏都会再犯，因为**引擎没给「把浮层钉在活动目标上」的数据说法**。
>
> **① 锚定（立即施工·范围收窄）——spec（Lead 图纸）**：
> 1. **锚源契约**：渲染层给每个实体 DOM 节点盖统一锚标（如 `data-entity-anchor="<entityId>"`·引擎渲染器出，非游戏自造 `u-<id>`）；LayoutNode 控件沿用既有 `anchor` 键位（引导锚与浮层锚同一注册表，语义不混：引导=spotlight，浮层=定位基准）。
> 2. **浮层控件（闭集新成员）**：`Float{ anchorTo:{kind:'entity'|'node', id, at?:'center'|'top'|'bottom'|'left'|'right', offset?:{x,y}}, children, ttlTicks? }`——引擎渲染循环每帧读目标 live rect 定位（纯表现·不进 sim/hash）；目标消失→浮层随之隐藏（不悬空、不报错）。
> 3. **连线控件**：`Connector{ from:anchorRef, to:anchorRef, style:令牌闭集(实线/虚线/箭头), label? }`——「谁打谁」连线的数据说法。
> 4. **红线**：render-only（sim/Condition 绝不读浮层位置）；定位计算不进 lockstep hash；样式走令牌不收 raw hex；控件进 component 闭集 + catalog + 校验器同步。
> 5. **测试与消费自证**：控件级点名测试（锚定/偏移/目标消失回收）+ `/check-ui` 过 + **game-i 展示台加一个锚定 demo 页**（活范例铁律）；game-g 战场替换由甲/程序B 随战斗 UI 批消费（不在本单强做，但本单落地后其红旗 DOM 有了退路）。
>
> **② 绑定层（设计稿先行·不许直接开写）**：目标=LayoutNode 属性可声明绑定世界状态（如 `text:{bind:'resource:gold', format:'金 {v}'}`·闭集表达式：resource/flag/stringVariable+格式化，**不是**自由表达式语言），让弱 LLM 不写 TS builder 也能交付活 UI。**约束**：必须与创作台 UI 生成（PST）共审设计——绑定词汇会直接进生成 prompt 词汇表；先交 ≤2 页设计稿（绑定语法闭集+更新时机+与现有 visibleWhen/tween 的关系）给 Lead 审，过审才施工。
> **✅ ②设计稿已交（PUI 2026-07-16·待 Lead + PST 共审·未写一行代码）**：`docs/design/ui-binding-layer-2026-07-16.md`（≤2 页）。要点：**绑定层已有一半**（`resolveBindings` + `bind` 字段 + `visibleWhen`）——本设计在其上①源前缀闭集 `resource:/flag:/string:`（裸 id 向后兼容按 resource）②**可绑属性白名单**（每控件哪些 prop 可绑配哪种源·生成器只能对表内组合填 bind·校验器挡表外）③格式化=复用 `Label.format` + 模板占位闭集 `{cur}{max}{v}`（非自由插值）。**三处待 Lead 裁**：(a) 统一 `bind` 字段 vs spec 的 `text:{bind,format}` 对象形态（PUI 倾向前者·与既有一致）(b) 模板占位范围 (c) `enabledWhen` 本单纳入还是 P2。**PST 共审点**：可绑白名单表直接进生成 prompt·源 id 词表 = 游戏 capability-plan 资源/旗标清单。过审后按设计稿 §7 P1 施工。
> 门禁全绿直推；①②各自独立提交；完工标 ✅ 待 Lead 对抗性验收（真浏览器 demo 必查）。
>
> **⚖ Lead 关账（2026-07-16·owner「第六条是不是也该关掉了？」→ 授权关闭）**：①锚定已 PASS（偏差B 四处改注核实·CONCERNS 转 PASS），本单收口归档。**②绑定层未施工零代码**——设计稿在 `docs/design/ui-binding-layer-2026-07-16.md`（PUI 已交·三处待裁 a/b/c + PST 共审点见稿），owner 要启动时**新开槽/新 session 拉起**，不留空挂条目占槽（对齐 owner 同日「做不完的撤出主池·我新开 session 做」的清池方针）。

### REQ-INPUT-拖拽交换 · 三消拖拽滑动手势（竖屏触屏主输入） · [2026-07-16] · owner 拍板（game-t）→ Lead 出图 → **派工撤回·owner 将新开 session 亲自安排（owner 2026-07-16「8和9不要做了，我新开session做」）——池内任何 session 勿动工·spec 保留供新 session 照图施工** · status: **✅ done·Lead 对抗性验收 PASS（2026-07-16·归档）** · 优先级: P1 · 类型: 引擎输入面（render/input-only·不进 sim/hash）
> **目标**：在 BoardCell 上按下→向四邻方向拖过阈值（如 0.4 格）→ 释放，等价于「点选两格交换」——**产出与现有点选完全相同的选中/交换信号**（`t3-match3-board` idle 相位零改动·sim 不知道输入形态）。
> **评判前置（先重组律）**：施工首步对照现有 `drag-place` / `grid-drag-square` / `i1-input-capture`+`i2-action-map` 能否重组表达；能则薄配置接线，不能再加最小新件（如 `dragSwap?: boolean` 挂输入映射）——**报告里必须写明重组结论**。
> **验收**：触屏/鼠标各一路测试（拖过阈值=交换信号·未过阈值=视为点选·斜向取主轴）；确定性（输入→信号纯映射·无时间随机）；不破既有点选路（game-i/现有消费零回归）。完工标 ✅ 待 Lead 对抗性验收。
> **回执（OPS 施工·2026-07-16·commit 3ce0e157）✅ 待 Lead 对抗性验收**：新增 `t2-match3-drag-swap`（`src/skills/tier2/match3-drag-swap.ts`）+ 注册 + 19 测（含 clickable+match3-board 全链集成）。**重组结论**：drag-place/grid-drag-square 产的是域意图(HexPos/PlaceBlockIntent)非选中 Signal、i1/i2 仅契约无系统——三者均不可重组表达；**复用 clickable**：BoardCell 配 `Clickable{action,phase:'down'}`，指针**按下**即由 clickable 选中起点格 A（第一半，逐字节点选），本能力只补**主轴方向邻格 B** 的选中 Signal（与点 B 逐字节同形）→ idle 判相邻交换。两拍天然落在真实 down/up 事件、**零暂存组件·不进 hash·idle 相位零改动**（世界状态轨迹与点两格逐字节一致）。阈值 0.4 格（`DRAG_SWAP_THRESHOLD_CELLS`）、斜向取主轴、越界不换、触屏/鼠标 source 无关。门禁：tsc+vitest(2714)+build 全绿（隔离 worktree 于最新 origin 复核·避并发污染）。
>
> **⚖ Lead 对抗性验收（2026-07-16·判 PASS·关单归档）**：设计复核——复用 clickable 只补邻格 B 信号、两拍落真实 down/up、零暂存组件、不进 hash、与点选两格世界轨迹逐字节同（红线内最优解）；19 条点名测试含 clickable+match3-board 全链集成与触屏/鼠标两路；当前 HEAD 全套门禁独立复跑绿（tsc·vitest 355 文件/2728·build）。**偏差三条全 INTENTIONAL 准许**：独立能力形态（优于挂输入映射·同族先例）；契约要求 BoardCell 用 Clickable{phase:down}（已写进 whenToUse）；阈值 0.4 为模块常量（不碰相位机文件）。**治理注记**：本单曾遭「派工撤回」与 Lead 派单竞态——成品经 owner 复盘流程后保留消费（PE-T T-002② 排队接入）；教训=派工前重读工单最新状态（LEAD 卡已补）。

### REQ-AUDIT-守门 · 审计棘轮防自基线 + 宿主骨架下沉（game-t 流程失守复盘·机器补牙） · [2026-07-16] · owner 拍板「影响照手册交付的全是 P1·马上落地」→ Lead 出图 → **指派：Opus（A 先行·C 续做）** · status: **A+C ✅ 交付·待 Lead 对抗性验收**（2026-07-16） · 优先级: P1 · 类型: 质量门禁基建（证据源=game-t T-003③ + Lead 复盘）
> **事故机制（记档）**：`game-skill-audit` 棘轮提示语「无基线条目（新游戏？请加入 audit-baseline.json）」**亲口教施工 session 自写基线**——PE-T 照做（`6142237d` 把自己 createElement:5 写进基线），棘轮空转、AUDIT FAIL 照推。
> **A·棘轮防自基线（先行）**：①基线中红旗>0 的条目必须带 `approvedBy:"LEAD"`+date+reason，缺=RATCHET FAIL（违规者不得自写豁免）；②删除邀请式提示语，改「新游戏红旗即 FAIL·豁免找 Lead 裁决」；③audit FAIL 语义改为「未被 Lead 批注基线覆盖的红旗才 FAIL」——同步解 game-t T-003③ 报的「S5 对编译期宿主恒红」；④`audit-ratchet.test.mjs` 断言随新语义收紧。**同批落 Lead 裁决记录**：game-q/game-t 各 5 处宿主容器 createElement（`game-t.ts:47-59`·骨架非 UI 内容）基线条目补 `approvedBy:"LEAD"`+reason「宿主骨架·C 件下沉后归零」。
> **B·完成口径 ✅ done（Lead 亲笔本批）**：game-production.md 红线区+启动词模板——宣布完成必须附 board 全绿，否则只许说「做到 SN」。
> **C·宿主骨架下沉（A 落地后同代理续做）**：game-q/game-t 重复的 5 容器 mount 骨架（wrapper/scene/topHost/bottomHost/overlayHost+定尺缩放）下沉引擎公用 helper（render-only·API 取两家现状交集）；迁移 game-q 消费自证；**game-t 迁移归 PE-T（T-005②·勿代改）**；迁移后基线 createElement 归零、撤 approvedBy。测试：helper 单测 + game-q 零回归。
> 完工标 ✅ 待 Lead 对抗性验收。
> **A ✅ done（Opus·2026-07-16·待 Lead 对抗性验收·commit 80b9e706）**：`game-skill-audit.mjs` 判词收敛=「未被 Lead 批注基线覆盖的红旗才 FAIL」（AUDIT+RATCHET 双段同解 S5 编译期宿主恒红·被批红旗显示但不红判）；`audit-baseline.json` 9 条红旗>0 全补 `approvedBy:"LEAD"`+date+reason（game-q/game-t=宿主骨架 2026-07-16·余 7 款=存量既往不咎 2026-07-04 执行落档），缺批注/新游戏红旗/超基线三态即 RATCHET FAIL；旧「请加入基线」邀请语删除。`audit-ratchet.test.mjs` +3 测（真基线全批注静态查 + 自写豁免/新游戏红旗两对抗·`APOLLO_AUDIT_BASELINE` 固定基线跑真源）。门禁全绿 tsc0/vitest2752/build0/双守卫。**偏差**：①加 `APOLLO_AUDIT_BASELINE` env 覆盖（仅对抗测试用·真跑默认真基线）；②7 款存量批注为「既往不咎」=落档非新豁免（Lead 可复核）。
> **C ✅ done（Opus·2026-07-16·待 Lead 对抗性验收·commit 本提交）**：新引擎公用宿主 helper `src/engine/host/mount-host.ts`（render-only·纯 DOM·零 sim 依赖）——wrapper/scene(定尺缩放)/topHost/bottomHost/overlayHost 五容器 + 等比缩放/teardown/fit，API 取 game-q 现状（栏高/背景参数化·缺省不设背景）。`game-q.ts` 迁移消费（删本地 22 行骨架+缩放·样式逐属性等价·walkthrough 11 测零回归）；game-q 基线 createElement 5→0 并撤 approvedBy（棘轮只降不升）。helper 单测 `mount-host.test.ts` 7 例（结构/z 分层/缩放含回退/fit/teardown 摘监听）。**game-t 迁移不做**（归 PE-T·T-005②·其基线条目保持批注态）。门禁全绿 tsc0/vitest2759/build0/双守卫。**偏差**：helper 返回额外露 `fit()` 手动补触发口（game-q 未用·加分测试口·additive）。
>
> **⚖ Lead 对抗性验收（2026-07-16·A/C/E/F 四件合并验收·判 PASS）**：独立复跑全绿（tsc·vitest 357 文件/2760·build）；域界核对零越线（禁区 game-t 实现/并行文件零触碰）。**牙口实弹探针（Lead 亲手）**：①伪造自基线（剥 approvedBy）→ RATCHET FAIL exit 1 ✓；②S2-S4 欠复查/人门时跑 S5 → 拒跑 exit 1 指名欠项 ✓；③`--out-of-order` 放行且 ⚠乱序落痕上板 ✓；④全库审计 AUDIT: WARNINGS / RATCHET: PASS exit 0（S5 恒红已解）✓。**偏差裁决**：APOLLO_AUDIT_BASELINE / APOLLO_PIPELINE_ROOT 测试注入（生产不设·行为零变）INTENTIONAL 准许；7 款存量批注按 2026-07-04 既往不咎史实落档 INTENTIONAL 准许；冻结名单硬列测试常量（将来 launcher 加机器旗时改解析）记小债；helper 露 fit() additive 准许。game-q 迁移零回归、基线 createElement 归零并撤批注（棘轮锁定成果）✓。

### REQ-GATE-硬化 · 注册即有板 + 阶段顺序闸（Lead 全链漏洞复查 E/F 件） · [2026-07-16] · owner「影响照手册交付的全是 P1·马上落地」→ Lead 出图 → **指派：Opus** · status: **✅ done·Lead 对抗性验收 PASS（2026-07-16·归档）** · 优先级: P1 · 类型: 质量门禁基建
> **E·注册即有板**：新 vitest 守卫（`scripts/pipeline-registry-guard.test.mjs`）——`src/launcher.tsx` GAMES 注册的每款非冻结游戏必须有 `public/games/<slug>/pipeline.json` 且 S1 立项卡字段非空；**没进生产线就上不了架**。存量缺板游戏先盘点进白名单（带日期·逐步清偿·白名单不许新增）。
> **F·阶段顺序闸**：`scripts/game-pipeline.mjs` 的 `gate <slug> <SN>` 在 S&lt;N 存在非绿（含复查门/人门）时**拒跑**，除非 `--out-of-order "<理由>"` 显式落进 pipeline.json 并在板上显 ⚠乱序标——跳关可以，但从「悄悄跳」变「记录在案的决定」。
> 红线：pipeline.json 仍只经 CLI/端点写；两件各配点名测试；不碰 game-t（清库重跑在即）。完工标 ✅ 待 Lead 对抗性验收。
> **✅ Opus 完工（2026-07-17·待 Lead 对抗性验收）**：E=新守卫 `scripts/pipeline-registry-guard.test.mjs`（12 测·解析 launcher GAMES·boardStatus 真验·白名单卫生+反向自证「确属缺板」）；F=`game-pipeline.mjs` 加 `priorGaps`/`orderGate` 顺序闸（前置非全绿拒跑·退出码 1+指名欠项）+ `--out-of-order "<理由>"` 记 `pipeline.json.outOfOrder[]`+board 行首 ⚠乱序标（旧板无字段零回归·pipeline.json 仍只经 CLI 写·加 `APOLLO_PIPELINE_ROOT` 测试注入根），点名测试进 `game-pipeline.test.mjs`（+8=20 测·纯函数+CLI 真退出码端到端）。**存量白名单盘点**：GAMES 9 款中 game-f 冻结免检、game-t 已有板；缺板 7 款进白名单=game-e/g/i/x/z/d/q（逐步清偿·不许新增）。门禁：tsc0·vitest 356 文件/2749·build0 全绿。
>
> **⚖ Lead 对抗性验收（2026-07-16·A/C/E/F 四件合并验收·判 PASS）**：独立复跑全绿（tsc·vitest 357 文件/2760·build）；域界核对零越线（禁区 game-t 实现/并行文件零触碰）。**牙口实弹探针（Lead 亲手）**：①伪造自基线（剥 approvedBy）→ RATCHET FAIL exit 1 ✓；②S2-S4 欠复查/人门时跑 S5 → 拒跑 exit 1 指名欠项 ✓；③`--out-of-order` 放行且 ⚠乱序落痕上板 ✓；④全库审计 AUDIT: WARNINGS / RATCHET: PASS exit 0（S5 恒红已解）✓。**偏差裁决**：APOLLO_AUDIT_BASELINE / APOLLO_PIPELINE_ROOT 测试注入（生产不设·行为零变）INTENTIONAL 准许；7 款存量批注按 2026-07-04 既往不咎史实落档 INTENTIONAL 准许；冻结名单硬列测试常量（将来 launcher 加机器旗时改解析）记小债；helper 露 fit() additive 准许。game-q 迁移零回归、基线 createElement 归零并撤批注（棘轮锁定成果）✓。

### REQ-ART-TGS吸收四件 · threejs-game-skills 对照吸收（视觉评分卡/音频线/像素QA/手册红线） · [2026-07-06] · owner 给源 → Lead 调研裁决（`art-pipeline-vision §八`）→ **owner 已批（2026-07-06）** · status: **落地中：A+D ✅ done（Lead 亲笔 2026-07-07）· B spec 就绪→指派 PST（**冲刺后**·被 REQ-DEMO-0729 队列重排压后）· C spec 已移 `docs/workflow/requests-3d.md`（P3D 域·同被压后）** · 优先级: P2 · 类型: 质量护栏吸收（不采其代码生成路线·宪法相反）
> 一句话：他家"AAA"不是描述词，是四道门（评分卡全维≥2/证据台账/反捷径工艺律/canvas 像素断言）——护栏纪律照单吸收，代码生成路线回驳。详见愿景稿 §八对照表。
> **A ✅（Lead 亲笔）**：新 `docs/playbooks/visual-scorecard.md`（8 维 0-3 分·premium=全维≥2·证据台账+资产来源台账+凭证探针·反捷径工艺律·判词 `VISUAL: n/24 · PREMIUM: YES|NO`）；挂点=playbooks/index 一行 + P3D 视觉验收（3d.md 红线区指回）+ PS 出货内门（PS-steam-finish-list 阶段区一行）。
> **D ✅（Lead 亲笔·手册回填）**：`docs/playbooks/3d.md` 红线区加工艺顺序律（先造型→材质→光照→特效·禁 glow 冒充）+ 主角面禁纯程序化（无 blocker 记录不豁免）；`docs/playbooks/testing.md` 红线区加凭证探针（空口 skip 不采信）+ 做X表挂评分卡行。
> **B spec（Lead 图纸·指派 PST·工坊 M3.5·与其他 studio 单碰 `apollo.py`/`scripts/ai-gen.mjs` 须串行——排 REQ-STUDIO 心跳余项之后）**：① `scripts/ai-gen.mjs` 加 audio adapter：类型闭集 `sfx|ambience|ui`；BYO-key provider（有 key 走真调，无 key→**先贴凭证探针输出**再走 mock 兜底=确定性占位 wav+MOCK 标记，绝不静默顶替）。② 产物一律落待审区（**复用 M2.5 人审门** writePending/reviewPending·绝不直登 index），provenance 硬字段同 2D/3D（model/prompt/date/license 缺一拒登）。③ 定位：`SynthAudioPort`/SfxSpec 合成=数据仍是首选路（见 `docs/playbooks/audio.md`）；工坊采样线只补合成表达不了的（音乐床/环境底噪）——声音货架从现存 1 条起步。④ 测试：`scripts/ai-gen.test.mjs` 增音频四例（pending/approve/reject/provenance 缺字段拒）+ `scripts/art-review-smoke.py` 扩音频类型断言。⑤ 门禁全绿直推；完工标 ✅ 待 Lead 验收 + PA 会审登记契约。
>
> **⏸ owner 暂停（2026-07-17）**：「第四件先暂停」——剩件 B（音频 adapter·PST）随单暂停出池。A/D 已完结、C 在 3D 池另管。重启=把 B spec（上文）新开槽拉起，原文在此不丢。

### REQ-M3-三期 · game-t 引擎补件包（①LayerCell 层视图 ②锦鲤定向消除 ③朱印二次钤印） · [2026-07-16] · owner 拍板（game-t 首发含果冻/障碍关+后 10 关机制）→ Lead 出图 → **派工撤回·owner 将新开 session 亲自安排（owner 2026-07-16「8和9不要做了，我新开session做」）——池内任何 session 勿动工·spec 保留供新 session 照图施工** · status: open（挂起待 owner 拉起） · 优先级: P1 · 类型: 引擎 capability 三期（tier3·正确性关键·不降档）
> **① LayerCell 层视图**（二期验收留的尾巴·防游戏层自写视图 system 违宪）：新 render-only 组件 `LayerCell{ boardId, index, layer:'jelly'|'blocker' }`——blueprint **静态**建覆盖实体（沿 BoardCell 同型·零实体增删），match-view-sync 每帧按 MatchBoard 的 jelly/blockers 状态改其外观（config 外观映射：层数/hp→Sprite/Color/透明度·清零→隐藏）。测试：jelly 减层外观变/清零隐、blocker hp 变化、砚石恒显、糖珠视图零回归。
> **② 锦鲤（定向消除·CC"鱼"同构）**：新特殊棋子 flag `KOI=5`（编码位仍 bit8-10·闭集内加一）；引爆=确定性游向「最优先未完成目标格」（优先级：墨渍>冰纹瓷>随机目标色格·同级取最小 index）消除之；生成规则 config（如 goals 含 jelly 时 2×2 方连生成——照 CC 惯例·写死进 config 闭集）；combo：锦鲤+锦鲤=3 条齐发、锦鲤+条纹/包装=目标格代爆该特殊效果。
> **③ 朱印二次钤印**：WRAPPED 引爆后**原地保留一回合再爆一次 3×3**（CC wrapped 惯例）；实现=clear 相位标记「二爆待决」队列（确定性·不进新组件），fall/refill 后于下个 match 相位补爆；config 开关 `wrappedTwice?: boolean`（缺省 false=二期行为逐字节不变）。
> **④ 棋盘手感动画层（owner 2026-07-16 补拍板·硬需求清单=game-t GDD §五点五 十条）· 架构终裁（Lead 2026-07-16）=(c) 引擎级 `MatchBoardView` 渲染器**：render-only **DOM 瓦片渲染器**（引擎渲染线新组件·非游戏代码）——读 MatchBoard 状态渲 tile DOM，内建动画通道：交换滑动/非法弹回/下落缓动+落地微弹/消除缩淡（绝不瞬消）/特殊棋子聚拢生成/收集飞向目标（可指 HUD 元素 id·沿 flyTo 语义）/CSS3D 质感（tile z 景深·按压沉降·选中抬起）。config=皮肤映射（色/特殊→资产 key 或令牌）+ 时长参数（全部可跳过）。**分叉裁决记录**：(a) canvas cell-tween 表达 3D 质感吃亏；(b) LayoutNode 板=逼出 game-g 式千行游戏层视图（违背 game-t 纯数据卡带立项）——均否。(c) 先例=Diegetic3D/CSS3D 引擎渲 DOM 之路。**红线**：全部 render-only——sim 结果先定、动画只是回放表现（跳过动画结果逐字节同·bench/回放/lockstep 零影响）；测试=渲染标记/动画 config 生效/teardown 干净/sim hash 零变化。
> **红线与门禁**：同 REQ-M3-二期（全整数确定性/相位机纪律/可选字段向后兼容/一期+二期 37 测零回归/点名测试缺一不关单）。完工标 ✅ 待 Lead 对抗性验收。
>
> **⏸ owner 暂停出池（2026-07-17）**：「三消三期也暂停·把需求池释放出来」——①-④ spec 与 ④(c) MatchBoardView 架构终裁全文保留在此。**连带**：本单是 game-t S3 装配前置，暂停即 game-t 装配线同卡（game-t 工单池已记指针·勿开 S3）。重启=owner 拉起+新开槽。

### REQ-M3-计分倍率 · t3-match3-board 连锁计分倍率 config（game-t S4 平衡阻断） · [2026-07-16] · 提出人 PE-T → 待 Lead 裁决 · status: open · 优先级: P1 · 类型: 引擎 capability 可选扩展（正确性关键·不降档）
> **缺口**：GDD §四 与 GD-T 已交付的 30 关定标（balance-sim·200 seeds）计分口径=「单格 60 × **连锁每级 ×1.5** + 收笔」；引擎 `t3-match3-board` 今日只有平铺 `coinPerTile`——**分数型关卡（1-6/26 等）与全表星阈运行时打不到定标值**（sim 与 runtime 口径漂移·恰是 conformance test 未覆盖的 score 面）。
> **候选（先重组已对照）**：现有 Effect.valueFrom/comboTable 均触不到相位机内的连锁级——需 config 可选字段下沉，如 `chainScale?: number`（缺省 1=现行为逐字节不变；clear 相位按 cascade 级对 coin 产出乘 `chainScale^级`，全整数化方案由 Lead 定：如 ×3/2 用整数分子分母避免 IEEE 漂移）。落地后 game-t 蓝图加一行 config 即对齐 GD 表，无需重定标。
> **关联**：可并入 REQ-M3-三期批次施工（同文件·同红线：可选字段向后兼容+一/二期测试零回归）。game-t 侧台账=`docs/design/game-t/requests.md` T-003①。
>
> **⏸ Lead 连带暂停出池（2026-07-17·随 owner「三消线暂停·释放池子」裁决）**：本单唯一消费者=game-t 定标对齐（S4），game-t 线已随 REQ-M3-三期/拖拽暂停——单独留池=死槽。spec 保留在此；game-t 重启时与三期一并新开槽（可并批施工·原文已注）。owner 若要单独先做，招呼一声即拉回。

### REQ-INPUT-拖拽-onlyFlag · t2-match3-drag-swap 邻格信号不查 Clickable.onlyFlag（输入闸可绕） · [2026-07-17] · 提出人 PE-T（run2 消费时发现）→ 待 Lead 裁决 · status: open · 优先级: P2 · 类型: 已验收件缺陷回报（输入面·不进 sim/hash）
> **现象**：桥在邻格 B 上发信号前只查 `Clickable` 存在、不查其 `onlyFlag`（clickable 自己查）——B 的闸旗为 false 时「点 B 无信号、拖到 B 有信号」，破坏「与点选逐字节同形」承诺；连拖两次可在输入闸落下后仍完成交换（game-t 终步结算窗 lastcall 可被翻盘）。**建议修法**：发信号前补 `onlyFlag` 同款检查（与 clickable 共用语义·一处 if）。game-t 宿主已双保险（终局 dispose 输入源），修后可撤。验收：闸落时拖拽不产邻格信号 + 既有 235 行测试零回归。
>
> **⏸ Lead 连带暂停出池（2026-07-17·随 owner「拖拽线暂时用不到」裁决）**：t2-match3-drag-swap 能力本体已验收在库（archive 有验收单）；本缺陷=输入闸可绕（P2·不进 sim/hash），唯一暴露面 game-t 已有宿主双保险（终局 dispose 输入源·T-102 记账）。缺陷记录在案不丢；拖拽线重启或出现第二消费者时新开槽修。
### REQ-VN-退役 · game-b 残留收尾：src/ui/vn 零消费退役 + 3 处过期注释 · [2026-07-17] · GD-B 提 → 指派：PUI（①③}+ PST（②） · status: **⏸ 撤回让位（2026-07-17·未执行·内容仍有效）** · 优先级: P3 · 类型: 去腐
> **撤回原因**：owner 同日三连立项（game-a/b/c），主池 10/10 满、REQ-VOICE-语音输出端口（P1·立项刚需）按「先清后加」顶槽；本单为 P3 去腐、由同提单人 GD-B 自撤让位。**主池有槽时任何角色可按下文原文重提。**
> ① `src/ui/vn/**` 退役（7 文件·game-b 乙女 VN 演出组件层）：全库零外部消费，CLAUDE.md UI 铁律已判「待退役·VN 零消费可随时退」——单=执行退役；连带 `src/ui/themes/sakura-otome/theme.ts` 头注「喂给 @ui/vn」与 `src/ui/shell/types.ts:16`「与 @ui/vn 同款」提法改口；完工后 LEAD 同步删 CLAUDE.md 该行「/ui/vn」字样。**注（2026-07-17）**：game-b 新项目《雀宴》已复用 sakura-otome 主题——退役 vn 时勿动主题本体。
> ② studio 两处注释把 game-b 当现存事实：`src/studio/assets-model.ts:26`·`src/studio/StudioInspector.tsx:228`——改通用表述（usedBy 为场景 id 时仅展示）。
> ③ `src/ui/themes/sanguo/theme.ts:3`「对齐 game-b 的 sakuraOtomeTheme 范式」→ 改「主题在 src/ui/themes/·游戏只消费」。
> 判保留（勿动）：sakura-otome 主题（主题库资产·且已被新 game-b 选用）；`src/skills/tier3/dialogue.ts:11` 出处注释；归档/评审/过期头文档；wiki/skills/otome.md。验收：全库 grep game-b 仅剩归档层+出处注释+新《雀宴》文档；门禁全绿。

### B-003（game-b）· 引擎缺口盘点与提单 · [2026-07-17] · GD-B → LEAD · status: ✅ done（2026-07-17 当日结） · P1 · 类型: 游戏级工作票（game-b）
> 盘点三件：a 语音输出端口=真缺口 → 提主池 REQ-VOICE-语音输出端口（P1·TTS speechSynthesis 即时档+采样档同接口·腾槽=GD-B 自撤 REQ-VN-退役）；b 行为树解释器=游戏层 TS 先行记下沉债（TS 已获 owner 授权·不占池·成熟后 capgap 提案）；c 机位切换/3D 点击=回驳已覆盖（Camera3D 运镜过渡 bump trigger + Pickable3D 射线拾取·2026-07-17 核实·实名出处记 capability-plan §2/§2.5）。

### REQ-GUANDAN-牌型 · 掼蛋判型+压制序+逢人配（先裁 poker-hand 可否重组） · [2026-07-17] · 提出人 GD-A（《掼蛋夜宴》game-a S2 前置·owner 07-17 清池授权入池）→ 待 Lead 裁决 · status: **✅ done·Lead 对抗性验收 PASS（2026-07-17·归档）** · 优先级: P1 · 类型: 能力缺口候选（正确性关键·不降档）
> - 想实现：掼蛋牌型闭集判定（单/对/三同张/三带二/顺5/三连对木板/钢板二连三/炸弹4-10张/同花顺/四大天王）+ 压制比较序（天王炸>6+张炸>同花顺>5炸>4炸>普通牌型·同型比大·级牌>A）+ **红桃级牌逢人配**（除大小王外百搭）。
> - 已有能力对照：`t3-poker-hand` 有 rankingTable+wild——但掼蛋型（变长连对/钢板/变长炸弹族/跨型压制序）疑似超出扑克 ranking 表达力；请 Lead 先裁**可否重组**，不能再下沉（建议 `guandan-hand` 或泛化表驱动 hand-pattern）。
> - 要求：纯函数判型·种子确定性·可回放；消费方=game-a《掼蛋夜宴》（编译期 TS·capability-plan 随 S2 送审）；设计档 `docs/design/game-a/`。
> - 边界：`src/skills/tier3/**`+registry 注册（Lead 域）；游戏层绝不自写判型解释器（虚胖数据禁令）。
> **⚖ Lead 裁决（2026-07-17·重组=否·接为真缺口）**：`t3-poker-hand` 重组不可行——它是 Balatro 域**计分器**：牌型固定闭集（high-card…flush-five）·评一手出 chips/mult；无变长牌族（4-10 炸/三连对/钢板）、无跨型压制序（炸弹族>普通型）、无「甲能否压乙」成对比较接口、无级牌语义——这些是判定器本身的域差，不是 rankingTable 数据填得出来的。**方向：不做 guandan 专属件，下沉通用表驱动 `t3-hand-pattern`**——牌族 DSL 闭集（计数组+连续段+长度域+花色约束+百搭）+ 压制序数据表（族阶+同族比较规则令牌）+ 双接口（成对压制比较 / 合法应对枚举）；掼蛋=首个数据 config + 淮安规则 conformance 测试，同族游戏（斗地主/跑得快）后续零代码接入。poker-hand 原件不动（计分域）；其 isStraightRanks/wild 枚举技法可借鉴。**spec 出图=Lead 亲笔**（正确性关键不降档），随 game-a S2 节奏；出图后标指派 Opus。
> **⚖ Lead 图纸（2026-07-17 亲笔·即付施工·指派 Opus）**：`src/skills/tier3/hand-pattern.ts`——
> ① **牌族 DSL 闭集**（config·纯数据）：`family = {name, kind:'ntuple'|'sequence'|'tuple-sequence'|'flush-sequence'|'fixed-set', n?:{min,max}, runLen?, groupSize?, composition?:number[], suited?}`。掼蛋族表=单(ntuple1)/对(2)/三(3)/三带二(composition[3,2])/顺子(seq·runLen5)/三连对(tuple-seq·groupSize2×runLen3)/钢板(tuple-seq·3×2)/炸弹(ntuple·n4..10)/同花顺(flush-seq·5)/天王炸(fixed-set·4王)。
> ② **压制序=数值阶表**（data）：`tierOf(match)→number`（普通型 tier0=仅同族同长比 rank；炸弹族按长度/同花顺/天王排 t1..t9 全数值化·高阶压低阶）+ 同族比较规则令牌（byRank / byLenThenRank）。
> ③ **级牌语义**（config）：`{levelRank, wildCard:{suit:'heart',rank:levelRank}}`——rank 序重映射（级牌插 A 之上小王之下）；逢人配=有界确定性枚举取最优（**借鉴 poker-hand wild 枚举技法**·并列取枚举序首解）。
> ④ **三接口**（纯函数·全整数）：`matchPattern(cards,cfg)`（判型）；`beats(a,b,cfg)`（成对压制）；`legalResponses(hand,target,cfg)`（合法应对枚举·**确定性排序·首个=最小合法压牌**——game-a 提示按钮与 AI 候选共用）。
> ⑤ 红线与测试：poker-hand 零改动；tier3 落位+registry 注册；conformance=淮安全套逐族判型/压制矩阵/级牌重映射/逢人配枚举/应对枚举含最小合法首位/同 seed 复现/空手牌与不可压边角。game-a 淮安 config 作 fixture。开工先读 `wiki/skills/` 卡牌类知识库。
> **✅ 施工完成（Opus 2026-07-17·待 Lead 对抗性验收）**：`src/skills/tier3/hand-pattern.ts`（三接口 matchPattern/beats/legalResponses·全整数纯函数·无 ECS 系统=编译期 TS 游戏直 import）+ `.test.ts`（36 测·淮安全套 conformance）+ index 桶出口 + registry 注册（`t3-hand-pattern`）。5 kind 闭集（ntuple/sequence/tuple-sequence/flush-sequence/fixed-set）+ 压制阶 config 数据（`tier:number|{byLength}`）+ 级牌 eff 重映射 + 逢人配有界枚举（借鉴 poker-hand·并列取枚举序首解）；legalResponses 升序·首个=最小合法压牌·偏好少用逢人配。poker-hand 本体零改动。**偏差（据实报 Lead）**：①三带二/炸弹的组结构统一收进 `ntuple`（composition 固定多组 / n 变长单组）——图纸①把「三带二(composition[3,2])」与「炸弹(ntuple)」并列，实现按此不新增 kind、维持 5 闭集；②legalResponses 排序键补「用逢人配数」维度（提示不浪费逢人配）；③掼蛋 config 为**测试 fixture**（未从能力导出·守「能力游戏无关」），game-a 自带同形 config。门禁：tsc0/vitest 2840/build0。
>
> **⚖ Lead 对抗性验收（2026-07-17·四单合并·判 PASS）**：独立复跑全绿（tsc·vitest 360 文件/2840·build·双守卫）；hand-pattern 核心语义亲查（级牌 eff=15 位序正确·matchPattern 最强解释优先·legalResponses 首位=最小合法且同强度省逢人配·beats 阶表全数值化）；BT 深度上限 64+叶注册硬校验；Voice 参数探针 10 断言非空口。偏差全 INTENTIONAL 准许（hand-pattern 三条：ntuple 统一收编/排序补 wildsUsed 维度/config 仅作 fixture 守游戏无关；BT 无组件纯解释器=回合制正解；Voice 落位以 Lead 图纸为准+音色异步回升属加分设计）。MANUAL CHECK 移交 owner：TTS 真发声真浏览器听验。

### REQ-BT-行为树 · 通用行为树能力（纯数据树+确定性解释器·先裁 condition/flow 可否重组） · [2026-07-17] · 提出人 GD-A（《掼蛋夜宴》AI·owner 意向 BT）→ 指派 Opus · status: **✅ done·Lead 对抗性验收 PASS（2026-07-17·归档）** · 优先级: P1 · 类型: 能力缺口候选（通用向·非单游戏拓宽）
> - 想实现：AI 外层策略=**纯数据行为树**（selector/sequence/condition/action 节点闭集）+ 通用确定性解释器。掼蛋消费面：记牌四档（记忆保真度分档）、宗师开局偷看 2 张、性格标签（稳健/激进/多变）→ 行为权重；内层出牌=候选生成+估值表（数据）。
> - 已有能力对照：condition/flow/event-when 可表达简单分支——「树形优先级+运行时黑板+跨游戏复用」疑似缺口；请 Lead 裁①重组是否够②不够则通用下沉（独立于掼蛋·NPC/敌 AI 皆可复用）。`wiki/skills/ai-behavior.md` 有行业知识。
> - 要求：全种子 PRNG·无裸随机·AI 决策进确定性轨可回放；spec 细化随 game-a S2 capability-plan。
> - 边界：`src/skills/**`+registry（Lead 域）；游戏层只产 BT 数据与估值表。
> **⚖ Lead 裁决（2026-07-17·重组=不够·接为通用缺口·设计先行）**：condition/flow/event-when 只能摆平铺分支；「优先级选择树+黑板+可复用子树+逐 tick 确定性推进」是结构性缺口，硬拼必然逼游戏层长出私有解释器（违宪）。**接**：通用 `behavior-tree` capability——树=纯数据、节点闭集 v1 收紧为 selector/sequence/condition/action（+invert 修饰），黑板=复用既有 Resource/Flag/StringVar 读写（不另立存储），随机全走种子 PRNG、决策进确定性轨可回放。**收窄两刀**：①记牌保真度分档/性格权重/偷看=游戏数据（估值表/黑板初值），不进引擎节点集；②「内层出牌候选生成+估值」属 REQ-GUANDAN-牌型 的合法应对枚举接口，别塞进 BT。**流程**：开工前先读 `wiki/skills/ai-behavior.md`（铁律）；先交 ≤2 页设计稿（节点闭集+黑板契约+与 condition/flow 的关系）过 Lead 审再施工。
> **⚖ Lead 合并注记（2026-07-17）**：与同日重复单「REQ-BT-行为树能力」（Lead 于 game-b/c S2 评审中并行开出·spec 同向）**并入本条腾槽**。消费方定格三家：game-a（记牌分档/性格权重）+ game-b（三姨太人设/难度三档）+ game-c（五性格模板·plan §4c）。补充口径（自被并条·与设计先行不冲突）：引擎件设计稿过审前，各游戏可本地薄实现，但**树数据结构必须照引擎设计稿定稿形状**（迁移零改数据）；叶=消费方注册表（未注册名装载即错）。
> **⚖ Lead 设计稿（2026-07-17 亲笔·即为「设计先行」过审稿·指派 Opus 施工）**：`src/skills/tier2/behavior-tree.ts`——
> ① **树=纯数据**：`{root: Node}`·`Node = {type:'selector'|'sequence'|'invert'|'condition'|'action', name?, children?, leaf?, args?}`（v1 闭集就这五种·parallel/decorator 等 YAGNI 不做·后议走 capgap）。装载期校验：结构/深度上限/叶名必在注册表。
> ② **黑板=既有存储**：条件/动作叶读写现成 Resource/Flag/StringVar——**不新立存储组件**；叶签名 `(world, entity, args, seed) → boolean|Action`。
> ③ **叶注册表**：capability 提供 `registerBTLeaves(gameId, {name: fn})`；游戏注册自己的条件/动作叶（TS 例外口径下的合法游戏层代码）；config 里声明用到的叶名单。
> ④ **确定性**：tick 制逐帧重评估（selector 优先级语义）；一切随机经传入 RandomSeed；同 seed 同黑板→同决策轨（回放/万手 sim 依据）。
> ⑤ **与 condition/flow 的关系**（收录进能力注释防误用）：BT=每 tick 重评估的优先级策略树；t3-flow=状态驻留流转机——互补不替代。
> ⑥ 测试：五节点语义各一/invert/深树有界/未注册叶装载错/seed 复现/三游戏形状 fixture（a 记牌档权重·b 三姨太人设·c 五性格模板——只作数据形状用例·不实装游戏逻辑）。开工先读 `wiki/skills/ai-behavior.md`（裁决铁律）。
> **✅ Opus 完工回执（2026-07-17·待 Lead 对抗性验收）**：`src/skills/tier2/behavior-tree.ts`（+`.test.ts` 18 测绿）——五节点闭集解释器（selector 优先级／sequence 全过／invert 取反／condition／action）+ 装载校验（结构／深度上限 `MAX_BT_DEPTH=64`／叶名在册·抛出版+清单版）+ 叶注册表 `registerBTLeaves(gameId,{name:fn})`（分域·按名查表·迭代序不影响求值）+ 确定性 `tickBehaviorTree(tree,gameId,world,entity,seed?)`（随机经**传入 RandomSeed**·同 seed 同黑板同决策轨）。桶出口 + registry 注册齐。三游戏形状 fixture（a/b/c·仅数据形状 stub·不实装逻辑）。
> **偏差（据实报回）**：设计稿①②未明示引擎组件/系统——按「黑板复用既有 Resource/Flag/StringVar·不新立存储」「游戏层只产 BT 数据·各游戏本地薄实现」「随机传入」三口径，落为**无组件（`provides:{}`·component-manifest 126 未变）无系统的纯解释器 capability**：消费方在自己决策点调 `tickBehaviorTree`（牌桌按回合决策·非引擎每帧驱动·避免 turn-based 每帧误触发）；action 叶可返 `BTAction` 载荷·解释器沿成功路径 surface 决策；未注册叶=装载校验抛错（硬拦）／运行时 fail-closed。门禁：tsc0 · vitest 2804 · build0 · component-manifest PASS。
>
> **⚖ Lead 对抗性验收（2026-07-17·四单合并·判 PASS）**：独立复跑全绿（tsc·vitest 360 文件/2840·build·双守卫）；hand-pattern 核心语义亲查（级牌 eff=15 位序正确·matchPattern 最强解释优先·legalResponses 首位=最小合法且同强度省逢人配·beats 阶表全数值化）；BT 深度上限 64+叶注册硬校验；Voice 参数探针 10 断言非空口。偏差全 INTENTIONAL 准许（hand-pattern 三条：ntuple 统一收编/排序补 wildsUsed 维度/config 仅作 fixture 守游戏无关；BT 无组件纯解释器=回合制正解；Voice 落位以 Lead 图纸为准+音色异步回升属加分设计）。MANUAL CHECK 移交 owner：TTS 真发声真浏览器听验。

### REQ-VOICE-语音输出端口 · TTS 即时档 + 采样档同接口（game-b 立项刚需·新游戏 a/c 可共用） · [2026-07-17] · GD-B 提（owner 指令「需求池提给主程执行」；⚖ 游戏要语音+owner 无音源包→语音合成先发声）→ **LEAD 出图/施工（或派 Opus）** · status: **✅ done·Lead 对抗性验收 PASS（2026-07-17·归档）** ·待 Lead 对抗性验收） · 优先级: P1 · 类型: 引擎能力（services 音频线扩展·表现层旁路）
> **需求面契约（GD 口径·架构 Lead 终裁）**：游戏侧只发语音事件 `{charId, event, text(日文台词), params?}`（事件键闭集=`docs/design/game-b/voice-pack-spec.md` §2·17 键）；端口一个接口两档实现——
> ① **TTS 档（v1 默认·零资产零 key）**：浏览器 speechSynthesis·per-char 参数 `{lang:'ja-JP', voiceHint?, rate, pitch}`（spec §0 有三姨太参数草案）；无 ja 音色→降级③。
> ② **采样档（将来配音）**：按 spec §1 命名 wav 资产·同事件键查台账播放；缺文件→降级①。
> ③ **兜底**：SynthAudioPort 合成提示音+字幕（现有·零改动）。
> **⚖ Lead 图纸（2026-07-17 亲笔·指派 Opus）**：`src/services/voice/`（services 域·表现层旁路·NON-DETERMINISTIC OK·不进 sim/hash）——`VoicePort` 接口 `{speak(evt:{charId,event,text,params?}):boolean, stop(), dispose()}`；`TtsVoicePort`（speechSynthesis·ja-JP 优先·无 API/无音色→return false 让调用方走兜底③·headless=no-op）；`SamplePackVoicePort(manifest)`（事件键→wav 资产 key·照 `docs/design/game-b/voice-pack-spec.md` §1/§2 契约·缺键 return false 回落 TTS）；组合器 `createVoiceChain([sample?, tts])` 依序尝试。测试：headless no-op 不抛/事件分派/缺键回落链/**TTS 参数构造断言（mock speechSynthesis·凭证探针纪律——不许空口 skip）**；真发声=MANUAL CHECK 交 owner。红线：不碰 SynthAudioPort 本体；三姨太参数草案（spec §0）作 fixture。
> **红线**：表现层非确定性旁路（不进 sim/hash/回放）；headless/SSR 静默 no-op（同 SynthAudioPort 哲学）；同 char 新事件顶掉旧朗读；**游戏层不直调 speechSynthesis**（端口=src/services 引擎域）。
> **验收**：端口单测（事件→调用形状/降级链①→③/headless no-op）+ 试听入口（建议 game-i sounds 台加一行·PUI 会审）+ `docs/playbooks/audio.md` 回填一行。消费方=game-b（gdd §十）；game-a/c 立项案语音位可共用。
> **腾槽记录**：REQ-VN-退役（P3 去腐·同为 GD-B 所提）撤回让位入档（先清后加·档内可重提）。
> **⚖ Lead 裁决（2026-07-17·接·spec 即图纸·指派 Opus 档施工）**：真缺口（引擎无语音输出路）；契约合格——端口进 `src/services/` 与 SynthAudioPort 同哲学（非确定性旁路·headless no-op·游戏层禁直调 speechSynthesis）全对。补三处裁决：① 端口名 `VoicePort`·落 `src/services/audio/voice-port.ts`（与合成同域）；② 降级链①→③探测须**运行时惰性**——speechSynthesis.getVoices 异步就绪，首帧空表不算「无 ja 音色」，就绪前入队或降级兜底后回升；③ 事件键闭集校验归**消费方** spec（game-b voice-pack-spec §2），端口本身收任意 string（引擎不背单游戏词表）。验收照单 + `audio.md` 回填。spec 已足，可派 Opus 档 session 照此施工。
> **✅ OPS 施工回执（2026-07-17·Opus 档·待 Lead 对抗性验收）**：`src/services/voice/`（新目录·6 文件：voice-port/tts-voice-port/sample-pack-voice-port/voice-chain/null-voice/index）+ `voice.test.ts`（25 测·含三姨太 spec §0 凭证探针 mock 断言 lang/rate/pitch/voice·非空 skip）。门禁全绿：tsc 0 / vitest 2786 全过 / build 0。裁决①②③已落：②getVoices 每 speak 重查·空表本次回落不永久判无ja、就绪回升；③端口收任意 string。**⚠偏差待裁**：落 `src/services/voice/`（照图纸行 51 + 派工范围「新目录」6 文件），非裁决①的 `services/audio/voice-port.ts`——若 Lead 要归 audio 域同域，`git mv` 零改可迁。`audio.md` 已回填一行。**未做**（越域）：game-i sounds 试听台一行=PUI 域（走 requests.md 报 PUI）；**真发声=MANUAL CHECK 交 owner**（headless CI 无 speechSynthesis 只验构造形状）。
>
> **⚖ Lead 对抗性验收（2026-07-17·四单合并·判 PASS）**：独立复跑全绿（tsc·vitest 360 文件/2840·build·双守卫）；hand-pattern 核心语义亲查（级牌 eff=15 位序正确·matchPattern 最强解释优先·legalResponses 首位=最小合法且同强度省逢人配·beats 阶表全数值化）；BT 深度上限 64+叶注册硬校验；Voice 参数探针 10 断言非空口。偏差全 INTENTIONAL 准许（hand-pattern 三条：ntuple 统一收编/排序补 wildsUsed 维度/config 仅作 fixture 守游戏无关；BT 无组件纯解释器=回合制正解；Voice 落位以 Lead 图纸为准+音色异步回升属加分设计）。MANUAL CHECK 移交 owner：TTS 真发声真浏览器听验。

### B-001（game-b）· 共享角色卡格式 · [2026-07-17] · GD-B → owner · status: ✅ done（2026-07-17 当日结·二批拍板收口） · P1 · 类型: 游戏级工作票（game-b）
> ⚖ owner 拍板：v1 共享卡=仅 `{name, avatar}`（"卡格式你先认为他只有名字和头像"）——生效口径落 `docs/design/game-b/character-card-format-needs.md §0`（含 id 对账建议+成年闸信任边界记录）；原完整字段愿望清单降级为 v2 参考保留原档。连锁简化：主角无立绘/语音/牌风/带入金字段·主角不脱（同批拍板）→ adapter 极薄。完整格式将来定稿时另起单。

### REQ-ACCEPT-验收剧本 harness · GD-测试×PE-修复循环的机器执行器（三游戏「绿门不可玩」复盘·owner 拍板） · [2026-07-17] · Lead 出图 → **指派：Opus** · status: **✅ done（Opus 2026-07-18·Lead 对抗性验收 PASS 2026-07-18）** · 优先级: **P0（三游戏 S4 重验前置）** · 类型: 质量门禁基建（正确性关键·不降档）
> **根因记档**：S4 walkthrough=PE 自写自测——理解错则测码同错门照绿；GDD 规则从未成为第三方可执行断言。药方=**验收剧本循环**：GD（懂规则方）写剧本，harness 驱动真引擎逐步对账，PE 照红单修：剧本=GD 域纯数据，PE 不得改（剧本错=GD 改+记录）。
> **⚖ Lead 图纸**：
> ① **剧本 schema**（`docs/design/<game>/acceptance/*.scenario.jsonc`·GD 作者）：`{name, game, seed, config?, steps:[ {signal,args?,by?} | {tick:N} | {expect:[断言...]} ]}`；断言闭集=读世界机读态：`{res:"名",eq/gte/lte}`（Resource）/`{flag:"名",eq}`/`{sv:"名",eq}`（StringVar）/`{comp:{entity,component,field},eq}`——**只读世界状态,不读 DOM**。
> ② **通用 runner**（`scripts/acceptance-run.mjs` + vitest 形态 `scripts/acceptance.test.mjs`）：装载游戏 headless→逐 step 喂信号/推 tick→断言→**失败报告=步号+期望 vs 实际+当步状态快照**（天然 bug 单格式）；`--game <g>` 跑单家；全部剧本进 vitest（推送门禁自动咬）。
> ③ **薄适配契约**（`src/games/<g>/acceptance-adapter.ts`·PE 落·计划门 §4 记账 ~50 行）：`{createWorld(seed,config), applySignal(world,signal,args,by), readWorld(world)→机读态}`——纯接线零规则；runner 只认此契约。
> ④ **S4 门升级**（`game-pipeline.mjs`）：S4 机器门在原 vitest 绿之上**加存在性检查**：`acceptance/` 场景数 ≥3 且 conformance 全绿，否则 S4 gate FAIL（防零剧本空转）；复查清单 S4 加一条「剧本作者=GD 非 PE（git blame 抽查）+ 附真浏览器试玩截图序列（开局→N 步→终局→重开）」。
> ⑤ 测试：runner 用合成 fixture 世界自测（信号/断言/失败报告格式/确定性同 seed 同轨）；schema 校验器（坏剧本装载即错）。三游戏 adapter 与剧本=各 PE/GD 随 S4 落（不在本单）。
> 完工标 ✅ 待 Lead 对抗性验收。落地后**三游戏现有 S4 一律重验**（无剧本=门红）。
> **✅ 完工回执（Opus 2026-07-18）**：① `scripts/acceptance-schema.mjs`（闭集 schema + 带行位 JSONC 解析器·注释/尾逗号·坏本装载即错）；② `scripts/acceptance-run.mjs`（通用 runner·经薄适配契约 createWorld/applySignal/readWorld 驱动真引擎·**机读态提取集中在 runner 不下放各 PE**＝防自写自测掩 bug·失败=步号+期望 vs 实际+快照·`--game` 单跑·退出码咬）；③ `scripts/acceptance.test.mjs`（合成 fixture 自测 26 例：信号/tick/各算子/失败报告/同 seed 同轨/schema 拒坏本 + 真游戏动态扫）；④ `game-pipeline.mjs` S4 门＝存在性(≥3 场景)+conformance 绿（compiled/cart 通用·`acceptanceScenarioCount` 纯函数可测）+ 复查清单 S4 加两行（剧本作者=GD 抽查·真浏览器截图序列）；⑤ 回填 `testing.md`。门禁全绿（tsc+vitest+build+双守卫）。
> **偏差（据实报 Lead）**：(a) `readWorld` 定为**纯 passthrough**（`(w)=>w`）——机读态提取（扫 Resource/Flag/StringVar/comp）集中在 runner，非各 adapter 手写：直服本 harness 的 RCA（提取写错会掩断言失败）。(b) cart S4 也要 ≥3 场景+conformance，但 conformance 需 `src/games/<g>/acceptance-adapter.ts`——**通用 cart 适配机制不在本单**（adapter=各 PE/GD 随 S4 落）；有剧本无 adapter=门红（诚实态）。(c) runner 判 main 用 `VITEST` 环境变量（vite-node 剥脚本名·唯一 import 方是 vitest·gate 是 spawn 非 import）。
> **⚖ Lead 对抗性验收（2026-07-18）：✅ PASS（附两处验收加固·同提交落）**——独立重跑门禁绿（tsc=0·vitest 3070/3070·build=0）；探针：schema 坏本五错逐条带行位 ✓ / 有剧本无 adapter=红 ✓ / 指名零剧本=红 ✓ / 全库无剧本=中性绿 ✓ / gate <3 场景拒过 ✓。偏差 (a)(b) 照准；偏差 (c) 验出**假绿边缘**：`VITEST` 变量穿透嵌套 spawn → runner 误判被 vitest import → 静默退 0＝conformance 假绿（生产 shell 无此变量故平时正确，但 vitest 内跑 gate CLI 即触发）。加固①＝gate spawn 显式握手 `APOLLO_ACCEPTANCE_CLI=1`（runner 见之无条件跑 main·假绿路径封死）；加固②＝gate spawn 用绝对脚本路径 + 透传 `APOLLO_ACCEPTANCE_ROOT`（temp 根注入下原为崩溃式落红·现真判词穿透到 gate 摘要）。新增回归测锁死两洞（3 场景无 adapter → gate 点名「缺 adapter」·`game-pipeline.test.mjs`）。状态改 done 归档腾槽；**三游戏 S4 重验令即日生效**（无剧本=门红·GD 补 ≥3 剧本 + PE 落 adapter 后重跑 gate）。

### REQ-HANDPAT-歧义自洽 · t3-hand-pattern legalResponses 与 act/beats 判读口径一致化 · [2026-07-18] · PE-A 报（A-008）→ Lead 裁决 ✅ 接（引擎正确性 bug）→ **指派：Opus** · status: **✅ done（Opus 2026-07-18·Lead 对抗性验收 PASS 2026-07-18）** · 优先级: P1 · 类型: 引擎 capability bug（正确性关键·不降档）
> **根因**：`legalResponses` 按「意图家族」枚举应对并以该家族比压制；`act`/`legalCheck`/`beats` 走 `matchPattern` **最强判读**——含逢人配的一手多判读时，最强判读落到另一普通型家族→跨家族压不过→legalResponses 承诺的牌 act 拒收（实证：墩=钢板 JJJ-QQQ，QQ+KK+两♥5 按钢板 QQQ-KKK 返回，规范判读=三连对 Q-K-A 更强→拒）。后果=提示按钮给「打不出去的牌」/AI 空过（game-a 已游戏层兜底滤除·引擎修好可退）。
> **⚖ Lead spec**：修 `legalResponses`——每个候选生成后用**规范口径自洽复核**：应对仅当 `beats(play.cards, target, cfg)`=true 才纳入；领出仅当 `matchPattern` 非空。**不改 beats/legalCheck 语义**（「任一判读能压」方向回驳=改判定语义·风险大）。测试点名：① A-008 实证例复现（修前红修后绿）；② **不变量测**=∀ legalResponses 返回项 legalCheck 必过（含逢人配多手枚举）；③ 既有 conformance 测零回归。game-a 兜底 filter 去留=PE-A 自裁（幂等）。
> **✅ 完工回执（Opus 2026-07-18）**：改 `src/skills/tier3/hand-pattern.ts` 唯一处=`legalResponses`——**生成 + `sortResponses` 去重排序保持逐字节不变**，仅在**末端**加一道 `.filter`：`canon = matchPattern(p.cards, cfg)`，`!canon` 剔除（领出/应对同门），有 target 时再 `beatsMatch(canon, mt)`（谓词 ≡ `beats(p.cards,target,cfg)`）才留。刻意置于去重之后=不动 raw/去重池，与消费方 game-a AI 的 `raw.filter((m)=>beats(m.cards,target,cfg))`（`ai.ts:141`）**幂等**——存活集逐字段一致。`beats/legalCheck/matchPattern` 语义与剪枝优化零改。测试（+2，共 38 绿）：①A-008 实证=QQ+KK+两♥5 应对钢板 JJJ-QQQ 该 6 张任何判读（plate/tube）都不进返回集（**已亲验修前红**：无修版旧码按 plate rank13 返回→`expected true to be false`；修后绿·仅剩 QQ+ww/KK+ww 两 4 炸且逐条 `beats` 自洽）；②不变量=7 组含逢人配手×各类墩确定性枚举 ∀p∈legalResponses⇒`matchPattern(p.cards)≠null` 且（有 target）`beats(p.cards,target)`（checked>0 防真空）；③既有 36 conformance + game-a/b 全 acceptance 剧本零回归。**偏差（据实报）**：初版把 gate 放进生成内层循环并入集 canon，改动了去重池/表示→触发 game-a 03/06/07/08 剧本 AI 走位漂移（生成期剔除会让原本被非法候选占住去重键的合法候选此消彼长）；按 Lead「不得扩大范围/幂等」回退为**去重后末端 filter、入集不变**，全绿。未碰 game-a/ui/剧本。
> **⚖ Lead 对抗性验收（2026-07-18）：✅ PASS**——修法=生成/去重不动、末端按规范判读 `.filter`（与 game-a AI 现行 `raw.filter(beats)` 幂等·剧本零漂移的理由成立）；**突变探针亲验**：临时树拆掉过滤→恰新增 2 测红、既有 36 测绿（测试真咬住修复·非摆设）；独立重跑门禁全绿。偏差（末端 filter 而非生成内层）照准——两次内层尝试触发剧本漂移的查因合理，回退守住「不得扩大范围」。已知边界记档：`sortResponses` 去重键按家族口径，理论上存在「同键合法候选被非法代表挤掉」的完备性缝隙（soundness 已保证=承诺必兑现；completeness 与修前 game-a 行为逐字段一致·非本单契约·域外旧账随 t3-hand-pattern 下轮演进再裁）。game-a 兜底 filter 现可退（PE-A 自裁·幂等保留亦无害）。

### REQ-CHARCARD-平台角色卡桥 · 网页平台 CharacterDraft → 引擎统一角色卡（三游戏共用） · [2026-07-18] · owner 发放平台格式+拍板「统一做到引擎层」 → Lead 出图 → **指派：Opus** · status: ✅ done（返工 v2.1·Opus 2026-07-18·待 Lead 复验） · 优先级: P0（A-001/B-裁决③/C-104 合流·三游戏对接前置） · 类型: 引擎 services 能力（外部数据桥·纯确定性）
> **背景**：owner 平台角色卡格式已发放（`CharacterDraft`：name/gender/kind/opening/cardDescription/description/personality/speakingStyle/boundaries/catchphrases[]/backstory/worldView/eraBackground/rules/coreConflicts/exampleDialogues/conversationStyle/replySettings/tags[]/adultConfirmed/visibility/backgroundPublic/moreSettings/updatedAt + 媒体三源 image·avatar·animation 各 {Url,DataUrl,OssKey}+imageMode/imageName/animationName + format）。此前 v1={name,avatar} 口径（game-b 2026-07-17）由本单升级取代；`docs/design/game-b/character-card-format-needs.md` 保留为消费方愿望单参考。
> **⚖ Lead 图纸**：落位 `src/services/character-card/`（profile/voice 先例·**不进 skills tier**——外部平台数据≠sim capability）。
> ① `types.ts`：`PlatformCharacterDraft`（宽容读·全字段可缺）+ `ApolloCharacterCard` 规范卡＝`{id, name, gender?, kind?, media:{avatarUrl?,imageUrl?,animationUrl?,imageName?,animationName?}, persona:{opening?,description?,cardDescription?,personality?,speakingStyle?,boundaries?,catchphrases[],backstory?,worldView?,eraBackground?,rules?,coreConflicts?,exampleDialogues?,conversationStyle?,replySettings?}, tags[], adultConfirmed, visibility?, backgroundPublic?, updatedAt?, passthrough}`。
> ② `normalizeCharacterCard(input: unknown, opts?) → {card, issues[]}`：**绝不 throw**；issues={level:'error'|'warn', field, msg}。error=非对象/name 空/（opts.requireAdult 时）adultConfirmed≠true；warn=零头像媒体/id 回退用 name/仅 ossKey 无解析器。媒体每槽取优 **Url > DataUrl > OssKey**（OssKey 经 `opts.resolveOssKey?:(key)=>string`·无解析器→该源弃+warn）。字符串 trim、空串→undefined；catchphrases/tags 滤空+按序去重（**不排序**·保作者序）；未识别字段原样进 `passthrough`（SessionOut 回传对账）。id 规则：`opts.id ?? draft 内可辨 id ?? name`（回退记 warn）。**纯确定性：零网络/零时钟/零随机**；同输入深等输出。
> ③ `toSeatCard(card) → {id,name,avatar}`：v1 投影（game-b 既有席位 adapter 零改动）。`isCardUsable(result)`=零 error。
> ④ 手册 `docs/playbooks/character-card.md`（≤80 行·index.md 同提交登记）：平台字段→规范卡映射表、媒体取优、成年硬闸（a/b/c 姨太题材=requireAdult:true 强制）、passthrough/SessionOut id 对账纪律、三游戏消费样板（SessionIn 席位→normalize→游戏侧投影：牌风/立绘/语音仍属游戏附加数据不入共享卡）、红线（DataUrl 不入美术台账/不入 sim hash；卡文本=外部不可信输入·展示层长度截断）。
> ⑤ 测试：满卡/空卡（截图 emptyCharacterDraft 同构 fixture）/媒体取优矩阵/成年闸开关/宽容读未知字段进 passthrough/确定性深等/v1 投影兼容。**不碰 src/games/**（三游戏消费=各 PE 随后接）。
> 完工标 ✅ 待 Lead 对抗性验收。
> **完工回执（Opus 2026-07-18）**：落位 `src/services/character-card/`（types.ts + character-card.ts + index.ts + character-card.test.ts·profile/voice 先例结构）。`normalizeCharacterCard(input, opts?)→{card,issues[]}` 绝不 throw·纯确定性（零网络/时钟/随机·同输入深等·JSON 键序稳定）；媒体三源每槽取优 Url>DataUrl>OssKey（`opts.resolveOssKey` 解析·无解析器/解析空/解析器抛错→弃+warn）；`opts.requireAdult` 成年硬闸（≠true→error）；`opts.id?>draft.id>name` 回退记 warn；catchphrases/tags 滤空+按序去重（不排序）；未消费字段（moreSettings/imageMode/format/未知）原样进 passthrough。`toSeatCard`=v1 {id,name,avatar}（avatar 取头像退回主图·席位 adapter 零改动）·`isCardUsable`=零 error。手册 `docs/playbooks/character-card.md`（53 行）+ index.md 同提交登记。测试 17 例（满卡/空卡 emptyDraft 全集/媒体取优矩阵/成年闸开关/未知字段进 passthrough/确定性深等/toSeatCard 兼容/非对象不 throw）。门禁全绿。**据实偏差**：①passthrough 采「未消费即透传」口径——imageMode/format/moreSettings 一并纳入（图纸只点名「未识别字段」·此为 SessionOut 圆满回传的保守选择）；②persona.replySettings/conversationStyle 按图纸②规范卡当**字符串**收（平台若发对象则不入 persona·亦不入 passthrough·因属已消费键）——如需保留对象形态请 Lead 裁。未碰 games/ui/skills。
> **⚖ Lead 验收 FAIL → spec 修正（媒体平铺）→ 返工 v2（2026-07-18）**：归因=Lead 图纸「媒体三源 image·avatar·animation 各 {Url,DataUrl,OssKey}」是把平台真格式压缩成的**错误速记**（v1 桥读不了真平台卡）——Opus 照错图施工忠实无过，spec 缺陷责在 Lead。平台真格式=**媒体键全部平铺无嵌套**（`imageMode/imageDataUrl/avatarDataUrl/imageName/imageUrl/avatarUrl/imageOssKey/avatarOssKey/animationDataUrl/animationName/animationOssKey`·平台无 animationUrl 但宽容读容忍）。
> **返工 v2 完工回执（Opus 2026-07-18）**：①`PlatformCharacterDraft` 改平铺媒体键（11 键 + 容忍 animationUrl）·**删嵌套 MediaSource 读法与类型**（平台格式=唯一真相·不做双形读）。②每槽取优不变 Url>DataUrl>OssKey（avatar 槽=avatarUrl/avatarDataUrl/avatarOssKey…·animation 容忍 animationUrl 优先）·issue field 用真实键名（如 `avatarOssKey`）。③`CONSUMED_KEYS` 全平铺媒体键（imageMode/format/moreSettings 维持 passthrough·Lead 照准偏差①）。④**偏差②改 Lead 裁决=统一规则**：任何已消费键值类型不符（replySettings 对象/catchphrases 非数组/name 数字/adultConfirmed 非布尔）→ **原值进 passthrough + warn**·不静默丢弃。⑤测试全改平铺真格式（23 例）·新增 emptyCharacterDraft 平铺逐键同构夹具（断言 passthrough 恰含 imageMode/format/moreSettings 三键）+ 类型不符→passthrough+warn 4 例。⑥手册映射表改平铺键名 + ②b 新节。门禁全绿。未碰 games/ui/skills。
> **⚖ Lead 复验（返工 v2·2026-07-18）：实现与统一规则 ✅ 合格；夹具与真相不符 → v2.1 修正**：owner 截图 emptyCharacterDraft 实为 **36 键**（非 v2 猜的 26·缺 10 个已消费 persona 键·部分默认值有出入）·行为无影响但结构守卫断言钉错真相。**返工 v2.1（Opus 2026-07-18）**：夹具逐键替换为截图 36 键（顺序/值照原图·kind='角色'/format='文本'/visibility='public'/backgroundPublic=true/conversationStyle='default'/moreSettings=false）·结构守卫改 36·相应断言更新（非空默认值落规范卡·passthrough 仍恰含 {imageMode,format,moreSettings} 三键不变量不动）·回执「26 键」全改「36 键」。门禁全绿。未碰 games/ui/skills。
> **⚖ Lead 终验（2026-07-20）：✅ PASS**——两轮返工闭环：v1 FAIL=桥读嵌套形而平台真格式为平铺（**归因=Lead spec 速记错误**·验收抓获）；v2 修平铺+统一「类型不符→passthrough+warn」规则；v2.1 夹具照 owner 原图改 36 键逐键同构。终验证据：①独立探针直喂真格式满卡（Url 压 DataUrl/OssKey ✓·DataUrl 退级 ✓·OssKey 经解析器 ✓·对象型 replySettings 不入 persona 但原样回传+warn ✓·passthrough 恰 4 键 ✓·席位投影 id 回退 ✓·空卡双 error 拒卡 ✓）；②突变探针=取优反转→1 测红（测试真咬）；③独立全套门禁绿（vitest 3359）。手册 59 行合格（§③ game-a 称谓笔误 Lead 顺手校正）。消费接线=三 PE 随 S 阶段落（样板在手册 §⑤）。

### REQ-ARTLIB-空白台账 · 素材屏对 fileless placeholder 行显空白缩略图（reconcile 豁免它→PASS≠平台可见） · [2026-07-22] · PE-C 报 → Lead 裁决 ✅ 接①·回驳② → **指派：Opus（PST 域施工·照 REQ-C-104 先例）** · status: **✅ done（Opus 2026-07-22·Lead 对抗性验收 PASS）** · 优先级: P2 · 类型: 创作台素材屏 UX（platform/PST 域·跨游戏）
> **✅ 回执（Opus 2026-07-22·PST 域施工）**：`src/studio/ArtLedgerPanel.tsx` 落平台侧兜底——抽 `ThumbCell` 组件：真图优先渲染→`<img> onError` 落程序占位签（404 免 fs 探测）；`status placeholder/tbf` 且无真图（fileless）直渲占位签（类目色底 `kindTint` + `desc` 文案 + status 标「占位·待产/待补图/缺图·占位」·`data-placeholder-sign` 标记）。详情侧「现用/占位」预览格同抽 `PreviewBox`（onError 退文字）。**据实偏差（超裁决建议·必要）**：game-c 台账是 authored-inventory `ref` 形状（无 `slot`），旧代码第 257 行 `r.slot.entity` 裸读 → 渲 game-c **整屏崩溃**（非仅空白）；故把 `LedgerRow.slot` 改选填、补 `desc?`/`ref?`、全部 `.slot` 访问改 `?.` 守卫——这是「让 fileless 行能渲占位签」的前置（不修则 game-c 连墙都出不来）。**红线守住**：纯显示层，零写文件/零改台账（`art-ledger.json` 未动）/零改行状态；未碰 `asset-reconcile.mjs`、`src/games/**`、`src/ui/**`。测试：`art-ledger-render.test.tsx` +3 例（fileless 无真图直出签·有 servedPath 先真图→onError 落签·game-c 真 90 行不崩溃）。端到端目击：game-c 真台账 28 个 placeholder 行（art-001~006+069~090）当前带 PE-C 自救 SVG servedPath → 仍渲真图（保留）；若某图 404 或 gen=null（如自救前），该格从空白/破图变占位签（desc「夜景背幕…」+「缺图·占位」标）。
> **⚖ Lead 裁决（2026-07-22）**：**接 ①**（平台侧程序占位缩略图·一处修全游戏受益·真缺口：authored-inventory 约定允许合法无文件行、显示层无兜底）。**回驳 ②**（①落地后 fileless 行不再空白，「会空白」警告即失效；「该行无真图」的信息 status:placeholder + S6 MOCK 债已承载——再加警告=守卫噪音）。**红线**：兜底缩略图**只在创作台素材屏显示层**——绝不写文件、绝不入台账、绝不改行状态（MOCK 债照记；「mock 永不上画面」指游戏画面，创作台占位显示不违此律）。实现建议：`ArtLedgerPanel.tsx` 对 fileless 行（status placeholder/tbf 无 filled 图）直渲程序占位签（desc 文案 + 类目色底 + status 标）+ `<img>` onError 兜底（404 同样落占位签·免 fs 探测）。game-c 自救 SVG（`game-c-art-gen.mjs`）保留亦可、非标准不推广。
> **症状**：创作台美术库/素材屏里 authored-inventory 台账（`art-ledger.json`）很多行显**空白缩略图**（owner 2026-07-22 实证 game-c：Art-001~006 + 069~090 空白）。
> **根因**：素材屏按行 `servedPath` 取缩略图；`status:placeholder` 的行若 servedPath **无真图文件** → 空白。而 `asset-reconcile.mjs` 的 dangling-file 检查**明确豁免 tbf/placeholder 行**（「合法无文件不误报」）——所以「reconcile PASS」**≠**「平台每行可见」。game-b 靠给 placeholder 行塞临时/程序图躲过；game-c 起初纯声明台账 → 空白。**这是 authored-inventory 约定的系统缺口：允许声明无文件行、平台却渲成空白、无守卫提醒。**
> **建议（下沉·择一·Lead 裁决）**：①**平台侧兜底**（推荐·一处修全游戏受益）——素材屏对 fileless/placeholder 行渲染**程序占位缩略图**（desc + 类目色底签），不空白；②或**lint 档**——`asset-reconcile`/audit 加一条**警告**「placeholder 行 servedPath 无文件且无 `spec.generator` → 平台会空白」，让作者知情补图（不 FAIL·只提醒）。
> **game-c 现状（PE-C 已自救·非通用方案·勿当标准）**：`scripts/game-c-art-gen.mjs` 给 28 面素坯各生成夜金 SVG 占位（REQ-VECTOR-ART·`index.json` filled）→ game-c 素材屏满显（`27631194`）。但**不应要求每游戏都手造占位 SVG**——故报此单请 Lead 定通用兜底（platform/PST 域·我不擅改）。
> **⚖ Lead 对抗性验收（2026-07-22）：✅ PASS**——独立复跑 studio 面 15 文件/110 测全绿；diff 核验=ThumbCell（fileless 直渲占位签·类目色底+desc+status 标+data-placeholder-sign）+ img onError 兜底 + PreviewBox 详情格同口径，红线守住（纯显示层·台账零改动·未碰 reconcile/games/ui）。偏差①（slot 改选填+全面守卫）**照准且必要**——game-c ref 形状台账在旧码 `r.slot.entity` 裸读下整屏崩溃，此为「渲出占位签」的前置。偏差②（全量 1 红=game-c vendor.test 既有欠账·非本单引入）核实属实：主干索引 90 条 vs 断言 62——已开 **REQ-C-111** 派 PE-C 即修（阻全员全量门禁·P1）。

### REQ-PA-工坊工位四件 · PA 已做批对齐认定 + 后续任务（owner「直接给他分派」）· [2026-07-04] · Lead 裁决派单 → **指派：PA** · status: **✅ done（PA 2026-07-22·①②③ done + ④ wontfix·全绿归档）** · 优先级: P1 · 类型: 资产治理与数据面（工坊分工=主责 PST·副责 PA）
> **对齐认定（Lead 2026-07-04）**：PA 近批（`d4a38341`→`b34ba961`：mesh/材质货架·程序化贴图+天空盒·9 品类 PBR 材质库·vendor 数据型扩展·右键 copy 入口）**全部落在愿景 M0 + M2 接线器切片上，方向零偏差**。边界更新：owner 已开 PST 角色——**工坊 UI/apollo.py 端点自此归 PST**（`b34ba961` 的右键入口移交 PST 维护）；PA 专注资产逻辑/CLI/契约（`assets/**`·`scripts/` 资产线·index 规范）。
> **① REQ-PA-3D 收尾 · ✅ done（PA 2026-07-22）**：③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 已回填 `docs/playbooks/assets.md ⑥`（分类子目录约定：textures/贴图·models/mesh glb·materials/数据资产·env/天空盒 hdr）；原单 `REQ-PA-3D公用货架` ①②③④a 完成态已在档回标为 ✅ done（④b P3D 切换转 `requests-3d.md`「REQ-3D-货架接入」待 P3D）。**核对时此项已实质完成·本次仅收口记账。**
> **② M2.5 登记契约 · ✅ done（PA 2026-07-22）**：`docs/design/m2.5-registration-contract.md`（≤1 页·登记面单一真相）——两级落点（共享货架/游戏本地）·pending.json 清单结构·pendingEntry=干净 index 条目+4 机制字段（previewPath/pendingFile/finalRel/scope）·index 条目结构·**四硬字段校验（model/prompt/date/license 缺一拒登记·对齐 `provenanceMissing`）**·approve/reject 语义·示例待审条目。M2.5 已由 PST 落地（`scripts/ai-gen.mjs`），本契约=**登记面口径单一真相**（PST 照实现·PA 照审 diff）；`assets.md ⑧` 加指针。
> **③ 三方对账 CLI（M1 数据面前置）· ✅ done（PA 2026-07-16）**：`scripts/asset-reconcile.mjs` + `.test.mjs`（4 测·全绿）。三类 finding（行 schema 位置|期望|实际）：**dangling-file**（FAIL·登记 filled 有 path 但磁盘无文件·site-absolute 路径解析到 public/·相对解析到 assets/·tbf/placeholder 合法无文件不误报）、**orphan-file**（WARN·磁盘有文件但无登记·跳过 index/台账/pending/dotfile/FreeArtLib）、**dangling-key**（FAIL·材质/贴图 spec 的 map/normalMap… 或 vendoredFrom 指向不在册 id）。判词 `RECONCILE: PASS|WARNINGS|FAIL`+退出码（FAIL=1·照 docs-ref-guard）；`--json` 出结构化（M1 报表吃）。scope：`[<game>|--all|--shared|--games]`（默认 all）。实测：共享货架 30k 条 PASS·各游戏本地 70 孤儿 WARN（game-g/k placeholder·game-z shelf 贴图）。
> **④ 配方格式草案 → wontfix·已覆盖（Lead 裁决 2026-07-16·owner 认可）**：「程序化贴图=纯数据」已由 REQ-VECTOR-ART 生成器注册表落地（asset-index `spec.generator{name,params}`·params=纯数据·确定性纯函数·game-g 索引已在用）——再立 recipe 格式=同一概念两套词汇（口径漂移温床·宪法反对）。gen-textures/pack-atlas 保持为 authoring-time 作坊工具（产物入库照登记）；未来若真要数据化 → 收敛到既有 generator 词汇，不另立格式。PA 免写草案。
