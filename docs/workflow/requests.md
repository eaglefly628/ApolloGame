# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中



### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ Lead 对抗性验收 PASS（2026-08-04）**：`scripts/style-packs.json` 3 条（`sakura-nijigen` 三游戏共用人物锚 / `vegas-victoriana` game-c 场景锚 / `modern-manor` game-a 场景锚·PA 2026-07-17 `fb5b17b81`）。独立复核：提交面恰 2 文件干净；三条目照 apollo-toon 样板全字段无多无少（uiPrompt 字段属后续 `f683c961c` 引擎单·非本交付）；vegas stylePrompt 与 REQ-C-ART ① 原文锚**逐字一致**、8 色逐一换算与拍板基准**全吻合**；sakura 与 game-b gdd §九 锚逐项吻合（成年明示在 prompt·共用锚正确略去 game-b 专属"和风"词）；modern-manor 合 brief §2.2 口径；零厂牌词。独立复跑：style-packs 7 测绿+全量门禁绿（tsc·vitest 426 文件/3791·build）。


<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结（查 git 历史）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


<!-- REQ-RETRO-引擎大扫除（P0·owner 全权授 Lead）已完结（查 git 历史）。 -->

<!-- REQ-RETRO2-能力库整理（P1·owner 三裁缩范围）已完结（查 git 历史）。 -->

### REQ-DIALOGUE-剧情基础线 · 剧情向 Dialogue 能力做成基础件+Sample+Template · [2026-08-03] · owner 令（约会性单机超休闲转型线·owner 同日令启动） → **图纸在档：`docs/design/dialogue-line-blueprint-2026-08.md`（派工唯一真相）** · status: **in-progress（M1 ✅ PUI done·待 Lead 对抗性验收；M2/M3 next）** · 优先级: P1（转型关键路径） · 类型: 能力线（引擎+UI 基座+样板）
> 四里程碑（详见图纸）：M1 闭集 VN 控件三件（dialog/choiceList/portrait·PUI·high·**第一步**·验收过即退役 ui/vn）→ M2 立绘/表情链（emotion→资产 key 纯数据表·PUI+PA）∥ M3 伴侣在场件（presence 起手模板+事件→反应数据表·PUI）→ M4 Sample 示范游戏 + `@ui/starters` 剧情起手包。t3-dialogue 已完备**不改**（输入接缝已为闭集 UI 预留 arg 通道）。悬置段=DokiWorld 数值双向契约，等 owner 三样材料（真卡 schema/宿主接口文档/双人确认）。每步 Lead 对抗性验收。
> **⚖ Lead 对抗性验收 M1（2026-08-04）：✅ PASS·带一条整改**——独立复核：tsc/VN 三测试文件/decouple 全 0；`resolveDialogue` 结构投影器亲读（DI 接口·ui 不碰 @skills=正确）；「另立投影器而非扩标量 UIDataSource」评判成立。**撞车留痕**：Lead 派的施工代理与本 PUI 会话双头同单（协同缺口·教训=开工先在池子标施工主体），代理版**未推**保留本地参考分支 `m1-alt`（739ea35dd·其 game-i 演示真跑 dialogueCapability 世界）。**整改（并入 M2 首项）**：正典展台是 literal props 静态摆拍（图纸要求真跑三控件·活范例纪律未达）——照 `m1-alt` 的真世界驱动方案改造 dialogue-demo（真 tick·真信号·真投影刷新）。**退役令随整改后触发**。**PUI 线施工主体自此=owner 的 PUI 会话**（Lead 不再派 UI 代理·防再撞）。
> **M1 ✅ done（PUI·2026-08-04·待 Lead 对抗性验收）**：catalog 闭集新增三控件 `dialog`/`choiceList`/`portrait`（沿 panelTexture 先例·types+render+catalog describe+validate 自动认+点名测试+ui.md 回填+house 主题取色可皮）。**投影读世界**=另立结构投影器 `resolveDialogue(tree, DialogueSource)`（bindings.ts·DI 接口·ui 不 import @skills）——因标量 UIDataSource 表达不了「变长选项+逐项 optionAvailable」这类结构投影；写世界=`dialogue.advance`/`dialogue.choose`+arg 下标（t3-dialogue 已认 arg 串·零游戏 handler）。守卫：`src/ui/components/dialogue.test.ts`（8 例·validate/渲染/投影/可选性门控/bind 未命中透传）+ catalog-coverage 41 型 + game-i `dialogue-demo.ts`（`💬 剧情·VN 对话三件` tab·+测试+audit 0 阻断）。scoped-gate 全绿。**Lead 评判**：M1 确为真闭集缺口（非可重组·游戏代码建选项列=「代码重建 UI 树」反模式）·PUI 独立复核同判接受。**退役令待触发**：M1 验收过→ PUI 出小单标 `ui/vn` deprecated 并删。

### REQ-PIPESOFT-管线软件 · 八步法软件化：一句话入口+向导壳+阶段编排器+IDE 接入 · [2026-08-03] · owner 批（四裁在图纸头）→ **图纸：`docs/design/pipeline-software-plan-2026-08.md`（唯一真相）** · status: **in-progress（P0 施工中·P1 待 Lead 出编排器细图）** · 优先级: P1（与剧情线并行·域不冲突） · 类型: 生产线基建（workshop 壳=PST 域·编排器/MCP=引擎 scripts）
> P0 ✅（阶梯成文·`217b87d60`）→ P1a ✅ 编排器核（`5f070a4ed`·Lead 终审 PASS·九偏差裁决在编排器图纸尾）→ P1b ✅ 向导壳（`89b3f9bd4`·Lead 终审 PASS·三偏差照准：两模式解读=workshop 壳内第三入口不碰 studio 旧板；wizard-concept 不预填 name=不伪造数据由会话补；2.5s 快路径阈值=运行态调参。真浏览器四截图在案·人门空签灰钮不代填亲验·测试卡带已清）→ **P2 MCP+斜杠命令+板红拦推 hook：排队·建议 P3 试点跑过一轮再动**（试点只需 P1）→ P3 试点=owner 自派 RPS 走全程（Lead 只管软件不管游戏内容·真机联调首项=编排器权限口径 acceptEdits+允许清单）。红线：无特权通道·代签禁止·阶梯降级留痕。**留验项已核（Lead 2026-08-04）**：4 红全在冒烟 ⑥ cart-S8 段·归属=`4ba420899`（07-17 REQ-GATE-硬化 F 阶段顺序闸）——⑥ 段全新卡带直打 S8 被顺序闸拒（S1-S7 未绿），P1b「非本单引入」**属实**；性质=冒烟脚本过期非产品 bug（顺序闸是终审过的正当特性·冒烟不在门禁内故静默腐化）。修复 spec（low·可派）：⑥ 改两腿——A 直打 S8 断言**被顺序闸拒**（新特性入冒烟）；B 经 CLI `--out-of-order "冒烟专测"` 放行后保留原 mock 债红/清债绿/gameHash 断言（HTTP 网关未透出 out-of-order·壳要不要透留 owner 定，冒烟走 CLI 即可）。

### REQ-SPECTRACE-条款追踪 · 策划细则→机器验收的追踪矩阵+守卫（无限更新循环） · [2026-08-04] · owner 令（复查不靠人看·按细则收工） → **图纸：`docs/design/spec-trace-blueprint-2026-08.md`** · status: **in-progress（V1 施工中·试点 game-c）** · 优先级: P1（客观复查线①） · 类型: 生产线基建（守卫+文档规约）
> 三件套：细则编号`【R-<游戏>-<序号>】`（GD 写）+ 追踪矩阵 spec-trace.json（数据）+ spec-trace-guard（未覆盖/死引用/**过期=文档改了旧检查自动失效**/孤儿 四判·bless 带证据留痕）。human 型验收合法但占比上报表。V1 独立跑不接门禁；V2 接 S4/S5 门+复查门清单+stale 自动开单（与编排器汇流）。
> **⚖ Lead 终审 V1（2026-08-04）：✅ PASS**（`74236fddb`）——独立复跑：守卫 game-c 真跑绿（25 条款/33 checks·human 21.2% 如实上报）·35 测独立绿·假信心自查在案（短路哈希比较→过期测试转红）。两处具体化裁决**照准**：test 型粒度=文件路径（与 bless「真跑该文件」语义一致）；scenario id=剧本文件名（与 acceptance-run 发现机制一致）。**试点首跑战果=逮出两处真 spec/实现漂移 + 一处过期清单**：已开 game-c 工单 REQ-C-116（桌形口径失同步·GD-C）/ **REQ-C-117（典当阈值 <3BB+性格 vs 实现 <1BB 统一·等 owner/GD 裁 A 改文档 B 补实现）** / REQ-C-118（acceptance README 过期）。V2 待试点周期反馈后启动。

### REQ-RENDERCHECK-渲染裁判 · 渲染器当客观判定器：三探针进机器门 · [2026-08-04] · owner 令（「用渲染器直接判定」·连提两次=授权） → Lead 口径已出 · status: **R1 ✅ done（`8d813d1a8`·Lead 终审 PASS）；R2/R3 排队（试点反馈后）** · 优先级: P1（客观复查线②） · 类型: 生产线基建（机器门加严）
> **⚖ Lead 终审 R1（2026-08-04）：✅ PASS**——独立复跑：16 测绿·亲跑 game-i 探针退出码 0·game-e 门证亲阅（真实画面·证据绑 gameHash）。五偏差**全照准**：①boardFor S3 显示修正=必要且顺手修掉「编译游戏恒绿」潜伏 bug；②完整 gate 验证做一次性人工核（保测试套沙箱纪律·接线逻辑由纯函数测试常驻盖）；③路由拦截收窄=fail-closed 方向正确（卡带形态探针需后端·今仓无卡带·留 R2 期评估）；④方差阈值 15=实测标定（实画面 260-540 vs 纯色 0·17 倍余量·出假红再调）；⑤测试留快车道（280ms）。假信心自查在案（阈值置 0→4 测转红）。
> R1 渲染冒烟（S3 门·真浏览器装载→非空白像素方差+零控制台错+机器自动截图=门证·施工会话截图作业退役）→ R2 真界面走查（S4 门·验收剧本操作序列经真实 UI 重放·闭集控件自动盖机器可寻标签=通用驱动器红利）→ R3 标准照比对（S5/S8 门·固定种子固定帧·像素漂移机器发现+人裁意图·探针模式冻结动效）。验收物类型=SPECTRACE 矩阵的 `probe` 型（两案汇流）。

### REQ-DESIGNLINE-设计稿产线 · 策划需求→设计稿→落档定稿的自动流水（消灭手动搬运） · [2026-08-04] · owner 令（「现在都是手动来回上线·要自动打通」） → Lead 案（双轨）·排队等工坊面空闲 · status: **open（过渡轨排队：等沉浸模式落地防撞·主轨试产随后）** · 优先级: P1 · 类型: 生产线基建（PST 域+编排器扩展）
> **双轨**：①过渡轨（先装·止血）=设计需求单自动起草一键复制 + 工坊**收稿箱**（上传/投递 `.dc.html` 自动归位游戏目录+登记档案指纹）——owner 继续用 Claude Design 网页但搬运消失；②主轨（试产定夺）=编排器扩「设计会话」类型（无头+游戏 UI 设计技能包+house 风格锚+需求单→ `.dc.html` 直接落档），工坊预览+反馈框→一键修订轮，**定稿=人门**（登记指纹·自动挂「在档=1:1 复刻基准」铁律·将来接 R3 实现 vs 稿像素比对）。事实前提：Claude Design 网页产品无可编程拉起接口——「自动拉起对话」只能在自养会话轨实现。主轨质量由 owner 试产一屏亲比后定夺全切与否。
> **⚖ Lead 终审 过渡轨（2026-08-04）：✅ PASS**（`6ef243086`·全库门禁绿·同批交付沉浸布局修正+三处隐藏+换新会话钮）——五偏差照准：base64 收稿沿 upload 先例够用；上下文百分比 200k 硬编码=已标「估算值」诚实口径；风格包未锚定占位=预期分支；`concept_digest` 每轮无条件算（15s 超时上限）=沿既有 digest 写法·记微债随后续优化；requests.md 不代更=域纪律正确（本行即 Lead 补记）。换新会话=复用既有 reset 机制下沉到每 tab+接力包并入生产板阶段摘要（不造第二真相=正确）。测试卡带清理亲核干净。**主轨试产一屏排队（R1 后）**。

<!-- REQ-MATRIXDUEL-同时决策矩阵（P1·game108 带出）已完结：t2-matrix-duel 落地·Lead 终审 PASS（5bfa84f48·裁决与偏差全文查 git 历史）。后续 payoff 缩放扩写=REQ-108-ENG-01，因 10 硬槽已满而降级放 docs/design/game108/requests.md（不占槽·Lead 已裁·待派工）。 -->


### REQ-CYCLEHAZ-既有定序成环隐患 · 能力两两 RMW 对撞装载成环（普查 65 对·远超原报四件） · [2026-08-04] · 审核会话核查 ✅ → **⚖ Lead 终裁（2026-08-04）：B 止血先行·C 相位化另单排期·不并行**（B=安全网：纯推断 2-环确定性平局裁决+留痕·显式边环照抛真错照拦；C 动 101 能力+全量回归·以 B 落地与剧情线实战反馈喂饱普查再动刀） · status: **B done（待 Lead 对抗性验收）·C 相位化另单待立** · 优先级: **P1（Lead 升档：剧情线 M4 Sample 必踩——dialogue×flow、dialogue×timeline 均在环清单·原 P2「现役未踩到」评估失效）** · 类型: 引擎核定序卫生
> **⚖ Lead 核查结论（2026-08-04·xhigh）**：①最小复现=**2 件**：t3-timeline + f1-resource（双方 RMW `Resource`→组件推断边互为前驱成 2-环）；原报四件中 **keybind 根本不在环上**、event-when 是叠加 3-环（event-when→timeline→resource-apply→event-when）。②全库普查（101 能力两两配对=5050 对）**65 对成环**——热点=Resource/Flag/State/CardPile 等黑板组件；含 card-play×card-pile、dialogue×flow、dialogue×timeline 等必然同装组合。③根因=**类问题非点问题**：组件推断边规则下任意两系统 RMW 同一黑板组件即互锁，显式申报需 O(n²)——65 处点修=劣解，申报制不可持续。
> **方案 spec（owner 裁）**：**B 止血（推荐先行·指派 Opus·high）**=topologicalSort 对「纯组件推断互锁 2-环（零显式边参与）」按 tier 序+注册序确定性平局裁决+console 留痕——装载炸降级为确定性可审计顺序；显式边参与的环**仍抛**（真申报 bug 照旧拦）。**C 正解（中期·照 matrix-duel「拆相位=成环正解」判例）**=能力按语义定 phase（input→intent→logic→apply/结算）跨桶天然无环——需 101 能力相位普查+现役游戏全量回归，单独立单排期。引擎核定序面 xhigh 不降档（B 实现面机械·high 可）。
> **✅ B done（Opus·2026-08-04·待 Lead 对抗性验收）**：`topologicalSort` 加环分流——Kahn **无环走原路**（与改动前逐位同序·现役世界零回归面）；成环则 Tarjan 切最小 SCC，**砍环内推断边、留环内显式边**，按「平局键升序且服从显式边」给环内定全序链（裁决参与全图传播·下游仍排在整环之后，非砍一条边了事）+ `console.warn` 留痕（点名成员/闭环组件/裁决序/「显式申报可覆盖」）。测试：engine 22 + assembly 7（真能力走 World.addSystem→tick）+ system-graph fidelity 改契约；假信心自查=短路「申报自相矛盾照抛」判定 → 3 测转红（并据此把断言从 `/Circular/` 收紧到断判词·防兜底网给假绿），复原全绿。**两处偏差待裁**：①判据由「环上有任一显式边即抛」收紧为「**显式边自成环**（申报自相矛盾）才抛」——核查点名的 3-环 event-when→timeline→resource-apply 恰恰带一条**正确**显式边（`timeline.runsAfter:['event-when']`），按原判据会连坐炸掉正常申报（越申报越易炸），与止血目的相反；现判据下该 3-环装得进且显式边被服从。②平局键=**系统注册序**（`SystemDeclaration` 无 tier 字段·engine 核不可反向依赖 assembly 注册表）：按注册表序（atoms→t1→t2→t3）装载时它**就等于**「tier 序优先·同 tier 按注册序」（已测试钉死），但蓝图若把 capabilities 乱序列出则键随之变——要真·tier 序须给能力/系统加 tier 标记或改装载序（后者会动现役独立系统的相对序=大回归面，B 不碰）。
> **⚖ Lead 终审 B（2026-08-04）：✅ PASS**——独立复跑 40 测/tsc 全 0；慢车道 3 红=已知旧账（代理以独立 worktree 对 origin 复跑逐条同名实证）。两偏差**照准且第一条实为纠我 spec 之错**：①抛环判据收紧为「显式边自成环（申报自相矛盾）才抛」——我原判据「环上任一显式边即抛」会连坐正确申报、与验收项②自相矛盾（**spec 缺陷在我·留痕**）；②平局键=注册序（引擎核不得反依赖 assembly 注册表·按注册表序装载时等价 tier 序·每世界恒定录放一致）——真 tier 键随 C 一并考虑。其假信心自查逮出断言假绿（/Circular/ 撞兜底网文案）并收紧判词=优秀。**排队两尾巴**：B.2 防线回补（撞环回归测试 not.toThrow 已失效→SCC 数进棘轮基线·low）；C 相位化（101 能力 phase 普查+tier 标记+全量回归·等剧情线实战反馈·xhigh）。

### REQ-ARTPIPE2-美术管线二期 · 台账强制（无账不录入）+ Unreal 式资产浏览器（目录/历史/回滚/替换工作流） · [2026-08-04] · owner 令（「美术台账不全该不该强制」+「预览操作器太像玩具·要完整工作流」） → Lead 规划中（侦察→图纸→owner 过目→分批派工） · status: **open（侦察毕·细图纸在档 `docs/design/artpipe2-blueprint-2026-08.md`·待 owner 过目后 A1 先行）** · 优先级: P1 · 类型: 生产线基建（守卫+PST 美术平台）
> 总纲：**不重造轮子**——历史/备份=git 承载（浏览器只做呈现与回滚操作）·台账+assets/index=唯一账本（浏览器是视图非第二真相）。四翼：A1 台账强制（双向对账守卫：黑户文件/死账行/缺来源=红·棘轮基线存量挂账·入口补漏——同时执法 AI 披露红线）→ A2 浏览器核心（目录树+缩略图网格+预览+拖入自动登记）→ A3 历史回滚（每资产 git 提交史+一键回退+前后对比）→ A4 替换工作流（消费方视图+替换+逐行人审）。待裁：src/studio 旧资产浏览器（白名单产品耦合 3 条）与新浏览器关系。侦察项：黑户/裸路径底数·现有平台件清单·studio 关系材料。

### REQ-ENGINEAUDIT-引擎全量评审落地 · 15 子系统深审+2 流程审计（110+ 发现·1 P0/~30 P1） · [2026-08-04] · owner 令（「全量 review 引擎+能修直接修+两问」）→ **报告在档：`docs/design/engine-review-2026-08-04.md`（唯一真相·全清单/根因/两问答复/工单分诊）** · status: **进行中（已修推 13 处/3 提交·门禁全绿；余按报告 §6 分诊）** · 优先级: **P0（含 1 条已实测复现 P0）** · 类型: 引擎质量总账
> **已修并推**（3 提交 `0031b950d`/`3b8e2757c`/`29cf511ba`·回归 +10）：确定性护栏（restore version++·NON_DETERMINISTIC 补 Mesh3D/Coachmark·canonical undefined·字符串转义防碰撞·bench 一票否决·StateChanged 自清）+ 注入面（cartridge innerHTML·art-replace slug 穿越·render.ts number props 消毒）+ voxel 批 dispose 崩溃。
> **待办（报告 §6 排序）**：①**P0 lockstep-tab 加入死锁**（实测复现·立即修）②存档/装配正确性批（save hash 不验/envelope 丢档/BoardCell 双 provider/__proto__ 蒸发）③**根因① reads/writes 申报对账守卫 + §3.1 补齐组**（CYCLEHAZ B 已解锁）④**根因② 运行时组件全集基准**（解锁 NON_DETERMINISTIC 对账·装配校验·catalog 共用）⑤**根因④ 受信执行环境**（回应 Q2 卡点漏洞·服务端 CI 独立复跑+签名证据+CODEOWNERS·低成本止血=编排器全板复验）⑥Q1 消费路径（dump-catalog 分档+capgap 断链+audit 进推送门补逃逸抓捕+pick-list·顺清 game102 audit 实况红旗）⑦sim 逻辑批⑧渲染专项⑨UI 契约批。**四条贯穿根因见报告 §4——修根因 > 逐点补。**

### REQ-UICONTRACT-UI 契约批 · 数据驱动 UI 四处「能力卡承诺了、渲染/挂载侧没做到」· [2026-08-05] · Lead 提（引擎全量评审 §6 工单⑨·owner 2026-08-05 令派 PUI）→ **指派：PUI** · status: open · 优先级: **P1（四条均为「按文档写数据却静默失效」——最伤数据驱动信誉的一类）** · 类型: UI 基座契约修复
> 全清单/详情唯一真相 = `docs/design/engine-review-2026-08-04.md`（§3.3 表 + §5「UI 核 / UI 周边」）。本单只列 P1 四条；P2/P3 尾巴（bindings 不递归 node 型 props、layout-solver 忽略 cols、未知 type 注释逃逸、typewriter+emoji 掉字、apollo-kit 像素字体静默退化、onboarding 缩放宿主错位…）随批清、按报告原文取。
> **Lead 已核**：这四条我复核为真发现，但落在 `src/ui/**` = PUI 域，按域界不擅改，故整批转派。
> 1. **`ui/components/server.ts:503` modalClose / comboClick 缺 ActionSink 回退（P1）** —— 纯信号游戏（不挂 sink）**点遮罩关不掉 Modal**、下拉点不动 = 玩家卡死在弹窗里。同文件其它 handler 有回退，这两处漏。
> 2. **`ui/components/server.ts:124` 键控补丁锚点取 `firstElementChild`（P1）** —— 把子节点插到 Panel chrome（vignette/title）**之前** → 标题/暗角错位。结构一变就错，属脆锚点；应按语义锚（内容容器）定位。
> 3. **`ui/components/server.ts:293` `update()` 新引入的 tween/typewriter/flyto/bgscroll 永不初始化（P1）** —— 扫描只在 mount 跑一次，故**首屏之后由数据新增的动效全是死的**（写了没反应，最像"引擎坏了"）。
> 4. **`Sprite.anchorX/anchorY` 承诺了不消费** —— ⚠ 此条**不在 PUI 域**：真身在 `src/renderer/renderable.ts:64` 投影链（2D 渲染器 = Lead 自持），报告把它归进 UI 批是分类偏差，**PUI 请勿动**，Lead 另行处理。
> **边界（复查门核对用）**：`src/ui/components/**` + 对应 `*.test.ts`；不碰 `src/renderer/**`、不碰引擎核。
> **验收要求**：每条配回归测试（先写复现→红→修→绿），并在 PR/回执里贴「撤掉修复即转红」的证据（本轮引擎批已示范此纪律）；碰 LayoutNode 渲染的按手册跑 `check-ui` 自检。

### REQ-STATUSSET-资源见底置状态位 · 给 `t2-effect-apply` / `t2-self-rule` 的 do 闭集补 `set-status`/`clear-status` · [2026-08-05] · game107《逆位·深渊》属性防御系统带出 · status: **open（S2 卡口·未落地则属性破防只能退化为二元 combo）** · 优先级: P2 · 类型: 现有能力闭集补齐（非新能力）
> **要什么**：`t2-effect-apply` 的 `Effect.kind` 与 `t2-self-rule` 的 `SelfRule.do[].kind` 各补两项 —— `set-status{mask}` / `clear-status{mask}`（写目标 `Status.flags` 位）。二者现有闭集已是 `set-flag`/`set-state`/`modify-resource`/`destroy`，本项**同形状加两条**，不新增组件、不新增能力。
> **为什么需要**：`t2-hitbox` 的门控读的是 `Status.flags`（`requireMask`/`setMask`/`clearMask`），但**全库没有任何能力能把「某个 Resource 见底」变成 Status 位**——`effect-apply`/`self-rule` 只能写 `Flag`/`State`，与 `Status` 不互通。于是「**防御条被打空 → 后续伤害才落到 HP**」这一环断了。
> **为什么不能重组**（已按核心规则逐条核过）：① `Hitbox` 的资源门只有 hp 专用的 `requireHpFracBelow/Above`，不能门控任意 Resource；② `Status` 位目前只有 `hitbox`(setMask/clearMask) 与 `over-time` 会写，二者都由「命中/计时」驱动，无法由「资源阈值」驱动；③ 用 `Flag` 替代不行——`Hitbox` 不读 `Flag`。**链路缺的就是 Flag→Status 这一跳。**
> **通用性（非游戏专属）**：任何「破盾/破甲/破韧性后进入虚弱」的战斗设计同吃——魂系削韧、MOBA 护盾、塔防护甲层、Boss 阶段门。是 `Condition→Event→Effect` 三段式在 Status 维度上的补齐，属既有设计的对称缺口。
> **替代方案（若 Lead 更倾向改 hitbox 侧）**：给 `Hitbox` 加通用 `requireResourceAtOrBelow{id,value}`（泛化现有 hp 专用门）。二选一即可，GD 倾向前者（更通用、受益面更广）。
> **边界（防加宽）**：**不含**百分比抗性乘算（game107 明确不做隐形乘数，走可见的防御条）、**不含**新的伤害类型通道（属性用 `Resource` 一条一条表达即可）。允许触碰：`src/skills/tier2/effect-apply.ts` + `self-rule.ts` + registry describe + 点名测试 + `docs/playbooks/combat.md` 回填一行。
> **降级方案（未落地时）**：game107 退化为「二元状态叠加 combo」（`Hitbox.setMask`+`requireMask`，registry「冰霜新星→碎冰重锤」同款），可跑但失去「防御条数值可见 + 逐点剥防」的核心读面板体验。
> 消费方与验收语义：`docs/design/game107/{gdd.md §4.2 属性防御, capability-plan.md §5.5}`。

### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 查 git 历史（owner 2026-08-03 拍板删除归档层·`git log --oneline --grep=REQ-XXX` 或按提交信息 grep·随时可恢复）

## 需求模板（复制这段填写·先确认：游戏级工单请写该游戏的 `docs/design/<game>/requests.md`，此处只收引擎级）

```
### [YYYY-MM-DD] · [提出人角色] · status: open
- 想实现的行为：
- 已经试了什么（哪些能力 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案（可选）· 边界（本单允许触碰的文件范围·复查门核对用）：
```

---
