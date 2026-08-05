# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中



### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **⏸ 暂停（owner 2026-08-05 令）·M0.6 已落地未验收随冻结·重启时 Lead 先补验** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0.6 ✅ done（PUI·2026-08-05·待 Lead 对抗性验收）**：`UITheme.cursor?: UICursor{image(data-URI),x?,y?,press?{image,x?,y?}}`（types.ts·闭集令牌·沿 panelTexture 先例）；`mountUI`/`update` 落 host 根——纯函数 `cursorCss()` 算 base/press 值 + djb2 去重键，base 光标设 `host.style.cursor`（面板/文字继承·按钮 `cursor:pointer` 保留），按下态注入 `.apollo-cur-<key>:active`/`*:active` scoped 规则（`!important` 压继承·id 幂等去重）。**缺省无=复位系统箭头（老主题零变化）·触屏不受影响**。apollo-toon 配程序化墨笔尖（斜竹杆+墨锥·尖 (3,3) 热点·按下蘸青墨·provenance:procedural 占位·真图走美术台账逐令牌替换）。守卫：`cursor.test.ts`（6 例·cursorCss 值/键 + 主题令牌存在 + mountUI 落根 + 缺省零变化·happy-dom）；ui.md 回填「主题指针」行。scoped-gate 全绿。
> **已完结里程碑**：M0+M0.5+三游戏风格锚 ✅ 全 Lead 验收 PASS（判词全文查 git 历史）；遗留记债=ui-audit border-image 盲区+亮主题 dim 假阳（PUI 工具债）·默认主题切否 apollo-toon 等 owner（M3 顺手）。


<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结（查 git 历史）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


<!-- REQ-RETRO-引擎大扫除（P0·owner 全权授 Lead）已完结（查 git 历史）。 -->

<!-- REQ-RETRO2-能力库整理（P1·owner 三裁缩范围）已完结（查 git 历史）。 -->

### REQ-DIALOGUE-剧情基础线 · 剧情向 Dialogue 能力做成基础件+Sample+Template · [2026-08-03] · owner 令（约会性单机超休闲转型线·owner 同日令启动） → **图纸在档：`docs/design/dialogue-line-blueprint-2026-08.md`（派工唯一真相）** · status: **in-progress（M1 ✅ PUI done·待 Lead 对抗性验收；M2/M3 next）** · 优先级: P1（转型关键路径） · 类型: 能力线（引擎+UI 基座+样板）
> 四里程碑详见图纸。**M1 ✅ 全闭环**（三控件+整改真跑展台+ui/vn 已退役 `6c425414a`·Lead 抽验绿·判词全文查 git 历史）；**M2 立绘表情链 ∥ M3 伴侣在场件 = owner PUI 会话接手**；M4 Sample 最后。悬置段=DokiWorld 数值双向契约等 owner 三样材料。

### REQ-PIPESOFT-管线软件 · 八步法软件化：一句话入口+向导壳+阶段编排器+IDE 接入 · [2026-08-03] · owner 批（四裁在图纸头）→ **图纸：`docs/design/pipeline-software-plan-2026-08.md`（唯一真相）** · status: **in-progress（P0 施工中·P1 待 Lead 出编排器细图）** · 优先级: P1（与剧情线并行·域不冲突） · 类型: 生产线基建（workshop 壳=PST 域·编排器/MCP=引擎 scripts）
> **P0+P1a+P1b ✅ 全 Lead 终审 PASS**（`217b87d60`/`5f070a4ed`/`89b3f9bd4`·判词与偏差裁决全文查 git 历史）→ **P2 IDE 接入排队**（试点跑一轮再动）→ P3 试点=owner 自派 RPS 走全程（真机首项=编排器权限口径 acceptEdits+允许清单）。小尾巴：冒烟⑥修复 spec 已写死（low·随手可派·查 git 历史 grep 留验项）。红线：无特权通道·代签禁止·阶梯降级留痕。

### REQ-SPECTRACE-条款追踪 · 策划细则→机器验收的追踪矩阵+守卫（无限更新循环） · [2026-08-04] · owner 令（复查不靠人看·按细则收工） → **图纸：`docs/design/spec-trace-blueprint-2026-08.md`** · status: **in-progress（V1 施工中·试点 game-c）** · 优先级: P1（客观复查线①） · 类型: 生产线基建（守卫+文档规约）
> 三件套=细则编号【R-游戏-序号】+追踪矩阵 spec-trace.json+四判守卫（未覆盖/死引用/过期/孤儿·bless 带证据）。**V1 ✅ Lead 终审 PASS**（`74236fddb`·试点首跑逮出两处真 spec/实现漂移·REQ-C-116/117/118 已开单·117 等 owner A/B·判词全文查 git 历史）；**V2**（接 S4/S5 门+复查门+stale 自动开单）等试点周期反馈。

### REQ-RENDERCHECK-渲染裁判 · 渲染器当客观判定器：三探针进机器门 · [2026-08-04] · owner 令（「用渲染器直接判定」·连提两次=授权） → Lead 口径已出 · status: **R1/R2/R3 全 ✅ Lead 终审 PASS；R2c（剧本 UI 词表规约+映射表+世界态核验通道）排队** · 优先级: P1（客观复查线②） · 类型: 生产线基建（机器门加严）
> **R2a done**（`70b36bc8c`/`b92f90b8f`）：`render.ts` 20 处发 action 信号点位叠 `data-ui-id`（单控件=节点 id·复合子项 Table 行/Tabs 页签/VirtualList 行/ContextMenu 项=子项自身 id·Checkbox/Toggle/RadioGroup 隐藏 input 镜回外层节点 id）+ 既有 `data-action`/`data-arg`。**偏差**：spec 写 `data-action-arg`，落地用既有 `data-arg`（引擎已用此名·server.ts dispatch 读它·改名=真行为变更非机械叠加·未擅自拍板改名，据实报）。点名测试+既有 412 例 UI 测试全绿；game-g `__frames__` 3 份 golden 帧随附加属性重生成（逐字节核对=纯附加）。
> **R2b done**（同上两提交 + `c33437aa8`/`fb602ca78`）：`scripts/ui-walkthrough-probe.mjs`——真起服+真 Chromium 逐剧本 signal 步骤找活体 `[data-action]`(+arg) 真点击，报告 UI 可驱动率（不设阈值门·同 spec-trace human 占比先例）。补 launcher 域只读调试口 `window.__zcProbe`（dev-only·读 DOM 动作快照·不碰 sim/hash）。`game-pipeline.mjs` S4 门追加 `interpretUiWalkthrough`/`withUiWalkthroughGate`（exit 3=⚠不红·1=红·低可驱动率不判红）。测试 30 例+假信心自查（短路 `findMatchingAction` 恒真→6 例转红·复原绿）。**game-a 实跑**（8 剧本·退出码 0）：UI 可驱动率 **0/19（0.0%）**——诚实发现：验收剧本 signal 词表（薄适配契约 play/pass/play-round/…）与真 UI data-action 词表（menu.start/hand.toggle/…）不同源，多条 `play` 另因 `args.cards` 数组结构性非单击可表达；独立核证 `__zcProbe` 在菜单屏读到 5 条活体动作（非调试口坏了）。`expect` 断言步骤（26 条）本轮未核（仅读 DOM 动作清单·未读仿真世界态·据实标注·未越 launcher 域碰游戏内部状态）。
> **⚖ Lead 终审 R2（2026-08-05）：✅ PASS·带结构性发现**——独立复跑 30 测绿·render 22 处标签亲核·game-a 走查证据在档。两偏差照准：①属性名沿既有 `data-arg`（spec 手误·改名才是行为变更）；②调试口只出 DOM 动作清单不出世界状态（诚实最小·expect 标「未核」不造假）。**词表断层定性**：旧剧本=引擎信号词表·真 UI=另一词表→驱动率 0% 属实且管道无辜。**R2c 方向（Lead 裁·排队）**：①新游戏剧本用 UI 词表书写=原生可驱动（GD 规约·手册回填）；②老游戏按需补「信号→UI 步骤映射表」（纯数据·不强制）；③世界状态核验=host 契约加可选调试收集器（引擎面小设计）。驱动率不门红=正确。status 改 R1/R3/R2 全 ✅·R2c 排队。
> **R1 冒烟 ✅ + R3 标准照 ✅ 双 Lead 终审 PASS**（`8d813d1a8`/`0e4937e11`·机器亲拍门证+基准照+漂移演示在案·判词全文查 git 历史）。

### REQ-DESIGNLINE-设计稿产线 · 策划需求→设计稿→落档定稿的自动流水（消灭手动搬运） · [2026-08-04] · owner 令（「现在都是手动来回上线·要自动打通」） → Lead 案（双轨）·排队等工坊面空闲 · status: **open（过渡轨排队：等沉浸模式落地防撞·主轨试产随后）** · 优先级: P1 · 类型: 生产线基建（PST 域+编排器扩展）
> **过渡轨 ✅ Lead 终审 PASS**（`6ef243086`·需求单一键复制+收稿箱+定稿人门·判词全文查 git 历史）；**主轨**（编排器扩设计会话·无头+设计技能包→.dc.html 直落档）等 owner 试产一屏亲比后定夺全切。

<!-- REQ-MATRIXDUEL-同时决策矩阵（P1·game108 带出）已完结：t2-matrix-duel 落地·Lead 终审 PASS（5bfa84f48·裁决与偏差全文查 git 历史）。后续 payoff 缩放扩写=REQ-108-ENG-01，因 10 硬槽已满而降级放 docs/design/game108/requests.md（不占槽·Lead 已裁·待派工）。 -->


<!-- REQ-CYCLEHAZ-定序成环（P1）已完结：B 止血落地 887c410f7·Lead 终审 PASS（全文查 git 历史）；后置不占槽：B.2 SCC 棘轮（low）+ C 相位化（xhigh·等剧情线实战反馈）——要做时重开。 -->

### REQ-ARTPIPE2-美术管线二期 · 台账强制（无账不录入）+ Unreal 式资产浏览器（目录/历史/回滚/替换工作流） · [2026-08-04] · owner 令（「美术台账不全该不该强制」+「预览操作器太像玩具·要完整工作流」） → Lead 规划中（侦察→图纸→owner 过目→分批派工） · status: **A1 done（Lead 代理·已验收 PASS）→ A2 done（PST 施工 2026-08-05·待 Lead 验收）→ A3/A4 待派** · 优先级: P1 · 类型: 生产线基建（守卫+PST 美术平台）
> 总纲：**不重造轮子**——历史/备份=git 承载（浏览器只做呈现与回滚操作）·台账+assets/index=唯一账本（浏览器是视图非第二真相）。四翼：A1 台账强制（双向对账守卫：黑户文件/死账行/缺来源=红·棘轮基线存量挂账·入口补漏——同时执法 AI 披露红线）→ A2 浏览器核心（目录树+缩略图网格+预览+拖入自动登记）→ A3 历史回滚（每资产 git 提交史+一键回退+前后对比）→ A4 替换工作流（消费方视图+替换+逐行人审）。待裁：src/studio 旧资产浏览器（白名单产品耦合 3 条）与新浏览器关系。侦察项：黑户/裸路径底数·现有平台件清单·studio 关系材料。
> **✅ A1 回执（2026-08-05）**：`scripts/art-ledger-guard.mjs`（黑户/死账/缺来源三判·servedPath 为真相不假设标准目录树·game-d 83 行非标路径零误判·退出码 0/1/2）+ 棘轮基线 `art-ledger-baseline.json`（实测黑户 187→三游戏建账后 65·只许减不许增）+ 接入 `scoped-gate` 常驻守卫链（exit 2 警告放行/exit 1 硬拦）。game-i(103)/game-z(5)/game102(14) 机械建账（磁盘+本地/共享 index.json 推导·来源全可考·零伪造）。`asset-reconcile.mjs` games 正则盲区（漏 game101/102）已修。测试 14 例+假信心自查（短路棘轮比较→转红→复原转绿）。全库实测：黑户 65（game-103:4/game-a:57/game-c:1/game101:3·存量挂账进基线）·死账 2（game-a art-03/game-c art-017·各开游戏级工单指派 PA·A1 不修）·缺来源 0。门禁：`node scripts/scoped-gate.mjs --run` exit 0（tsc+全量vitest 431文件/3892例+build+四守卫全绿）。
> **⚖ Lead 终审 A1（2026-08-05）：✅ PASS**——独立复跑：守卫退出 2（仅存量死账警示·符合预期）·14 测绿·三游戏台账+棘轮基线（65 黑户存量）四件在档亲核。三偏差照准：退出码三档（1=新增黑户硬拦·2=存量债警示不拦）+ scoped-gate allowExit 泛化；覆盖判定宽扫 servedPath/死账严判 gen.servedPath（防 game-c/d 假阳·正解）；orig/ 备份目录排除。**一处敲打**：为隔离跑门禁 stash 了并行代理在途文件（虽 verify-diff 无损归还）——**此法禁用**，已入 CLAUDE.md 玩火律：要隔离验证去临时 clone。**升级预告**：A2 浏览器落地（拖入自动登记）后「缺来源」从警示升硬红。A2 待派。
> **✅ A2 回执（PST 施工 2026-08-05·提交 `6a39b4214`）**：workshop 新入口「🗂 资产浏览器」——三栏（目录树：游戏×分组/共享库×分组懒加载展开 → 缩略图网格懒加载 `<img loading=lazy>` → 详情栏大图+台账字段+provenance）+ 四态徽标闭集 ⭐final/📝draft/⚠黑户/✕死账（`art-ledger` 行 `status==='approved'`→final·design-ledger `status==='final'`→final·其余 draft·no 落 guard `deadAccounts`→dead·guard `blackHouseholds` 合成条目→blackhouse）。新端点 `GET /api/artbrowser/tree?scope=index|shared|<slug>`（`main_entry/artbrowser.py`·薄封装：只读现拼 art-ledger + design-ledger + assets/index.json 三源，黑户/死账/缺来源外调既有 `art-ledger-guard.mjs --json`，零第二真相/零缓存文件/零写入）。拖入登记复用既有 `/api/art/upload`（同 `ArtLedgerPanel.doUpload` 先例·非新逻辑）：UI 选目标游戏+槽位→落盘钉 provenance→A1「缺来源」随之清账。历史(A3)/替换·消费方(A4) 两个详情栏占位 tab（纯文案·未接后端）。真浏览器验证 9 图（目录树+网格徽标/详情栏/黑户网格/共享库网格/拖入登记后台账行钉真 provenance）+ 临时测试卡带 game-104 全链路验证后 DELETE 清净。门禁 `scoped-gate --run` exit 0（scope=full·tsc+434 文件/3945 例 vitest+build+四守卫全绿）。**已知偏差**（据实报告未拍板）：library 卡带（有 manifest.json）走 `/api/art/upload` 的 swap 分支，落盘后 `gen.servedPath` 缺失（provenance 正常）——浏览器缩略图正确退化图标占位，不在 A2 域内不代修，详见 `docs/workflow/finish/PST-workshop-handoff.md` §2。待 Lead 验收。
> **⚖ Lead 终审 A2（2026-08-05）：✅ PASS**——真浏览器九截图亲阅（三栏/徽标树/黑户网格/拖入登记闭环）·门禁全绿·测试卡带清净核过。三偏差裁决：①FreeArtLib 不并入=**永久窄口径照准**（素材库屏已专职展示·并入=重复建设）；②`t2_replace.py` swap--upload 分支落账缺 gen.servedPath=**存量 bug 收进 A4 一并修**（A4 本就动替换流）；③单组 200 项截断=照准。**A3+A4 合单已派（Lead 自持·施工主体标注防撞）**。

### REQ-ENGINEAUDIT-引擎全量评审落地 · 15 子系统深审+2 流程审计（110+ 发现·1 P0/~30 P1） · [2026-08-04] · owner 令（「全量 review 引擎+能修直接修+两问」）→ **报告在档：`docs/design/engine-review-2026-08-04.md`（唯一真相·全清单/根因/两问答复/工单分诊）** · status: **进行中（已修推 13 处/3 提交·门禁全绿；余按报告 §6 分诊）** · 优先级: **P0（含 1 条已实测复现 P0）** · 类型: 引擎质量总账
> **已修并推**（3 提交 `0031b950d`/`3b8e2757c`/`29cf511ba`·回归 +10）：确定性护栏（restore version++·NON_DETERMINISTIC 补 Mesh3D/Coachmark·canonical undefined·字符串转义防碰撞·bench 一票否决·StateChanged 自清）+ 注入面（cartridge innerHTML·art-replace slug 穿越·render.ts number props 消毒）+ voxel 批 dispose 崩溃。
> **待办（报告 §6 排序）**：①**P0 lockstep-tab 加入死锁**（实测复现·立即修）②存档/装配正确性批（save hash 不验/envelope 丢档/BoardCell 双 provider/__proto__ 蒸发）③**根因① reads/writes 申报对账守卫 + §3.1 补齐组**（CYCLEHAZ B 已解锁）④**根因② 运行时组件全集基准**（解锁 NON_DETERMINISTIC 对账·装配校验·catalog 共用）⑤**根因④ 受信执行环境**（回应 Q2 卡点漏洞·服务端 CI 独立复跑+签名证据+CODEOWNERS·低成本止血=编排器全板复验）⑥Q1 消费路径（dump-catalog 分档+capgap 断链+audit 进推送门补逃逸抓捕+pick-list·顺清 game102 audit 实况红旗）⑦sim 逻辑批⑧渲染专项⑨UI 契约批。**四条贯穿根因见报告 §4——修根因 > 逐点补。**

### REQ-UICONTRACT-UI 契约批 · 数据驱动 UI 四处「能力卡承诺了、渲染/挂载侧没做到」· [2026-08-05] · Lead 提（引擎全量评审 §6 工单⑨·owner 2026-08-05 令派 PUI）→ **指派：PUI** · status: **PUI 三条 ✅ done（PUI 2026-08-05·待 Lead 对抗性验收）；item④ 非 PUI 域→Lead 另处** · 优先级: **P1（四条均为「按文档写数据却静默失效」——最伤数据驱动信誉的一类）** · 类型: UI 基座契约修复
> 全清单/详情唯一真相 = `docs/design/engine-review-2026-08-04.md`（§3.3 表 + §5「UI 核 / UI 周边」）。本单只列 P1 四条；P2/P3 尾巴（bindings 不递归 node 型 props、layout-solver 忽略 cols、未知 type 注释逃逸、typewriter+emoji 掉字、apollo-kit 像素字体静默退化、onboarding 缩放宿主错位…）随批清、按报告原文取。
> **Lead 已核**：这四条我复核为真发现，但落在 `src/ui/**` = PUI 域，按域界不擅改，故整批转派。
> **PUI 三条 ✅ done（2026-08-05·待 Lead 对抗性验收）**（均 `src/ui/components/server.ts` + `ui-contract.test.ts` 6 例·先复现→红→修→绿·撤修即转红证据在案：5 测同时转红/唯 mount 首屏基线保绿）：①`modalClose`/`comboClick` 补 ActionSink 回退（同 `dispatch` 路由：本地 handler 优先·无则 `input?.enqueueAction`）→ 纯信号游戏点遮罩能关 Modal、下拉点得动；②`reconcileChildrenKeyed` 首内容子锚从 `el.firstElementChild` 改**跳过前导无 id chrome（vignette/pattern/title）的 `firstContentAnchor()`** → 键控增删不再把内容插到标题/暗角之前；③四处动效扫描（typewriter/tween/flyto/bgscroll）抽成幂等 `initDynamics(scope)`（`:not([data-dyn-init])` 标记去重），mount + **update 各扫一次** → 首屏后由数据新增/改值的动效不再是死的（顺带 VN 台词每次推进重打字）。**item④**（`Sprite.anchorX/Y` 真身在 `src/renderer/renderable.ts` 投影链）**非 PUI 域·未动**·留 Lead。**P2/P3 尾巴**（§5 报告清单）未纳本轮·按报告原文另清。
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
> **⚖ Lead 下沉裁决（2026-08-05）：照准 A 案**——effect-apply/self-rule do 闭集同形补 set-status/clear-status 两条（对称缺口论证成立·Status 位现仅命中/计时可写=资源阈值驱动链确缺）；B 案（hitbox 泛化资源门）不采——A 受益面更广且零碰 hitbox 语义。**指派待排（high·战斗核邻接·随下一批施工窗）**。
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
