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
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。


<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结（查 git 历史）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


<!-- REQ-RETRO-引擎大扫除（P0·owner 全权授 Lead）已完结（查 git 历史）。 -->

<!-- REQ-RETRO2-能力库整理（P1·owner 三裁缩范围）已完结（查 git 历史）。 -->

### REQ-DIALOGUE-剧情基础线 · 剧情向 Dialogue 能力做成基础件+Sample+Template · [2026-08-03] · owner 令（约会性单机超休闲转型线·owner 同日令启动） → **图纸在档：`docs/design/dialogue-line-blueprint-2026-08.md`（派工唯一真相）** · status: **in-progress（M1 ✅ PUI done·待 Lead 对抗性验收；M2/M3 next）** · 优先级: P1（转型关键路径） · 类型: 能力线（引擎+UI 基座+样板）
> 四里程碑（详见图纸）：M1 闭集 VN 控件三件（dialog/choiceList/portrait·PUI·high·**第一步**·验收过即退役 ui/vn）→ M2 立绘/表情链（emotion→资产 key 纯数据表·PUI+PA）∥ M3 伴侣在场件（presence 起手模板+事件→反应数据表·PUI）→ M4 Sample 示范游戏 + `@ui/starters` 剧情起手包。t3-dialogue 已完备**不改**（输入接缝已为闭集 UI 预留 arg 通道）。悬置段=DokiWorld 数值双向契约，等 owner 三样材料（真卡 schema/宿主接口文档/双人确认）。每步 Lead 对抗性验收。
> **⚖ Lead 对抗性验收 M1（2026-08-04）：✅ PASS·带一条整改**——独立复核：tsc/VN 三测试文件/decouple 全 0；`resolveDialogue` 结构投影器亲读（DI 接口·ui 不碰 @skills=正确）；「另立投影器而非扩标量 UIDataSource」评判成立。**撞车留痕**：Lead 派的施工代理与本 PUI 会话双头同单（协同缺口·教训=开工先在池子标施工主体），代理版**未推**保留本地参考分支 `m1-alt`（739ea35dd·其 game-i 演示真跑 dialogueCapability 世界）。**整改（并入 M2 首项）**：正典展台是 literal props 静态摆拍（图纸要求真跑三控件·活范例纪律未达）——照 `m1-alt` 的真世界驱动方案改造 dialogue-demo（真 tick·真信号·真投影刷新）。**退役令随整改后触发**。**PUI 线施工主体自此=owner 的 PUI 会话**（Lead 不再派 UI 代理·防再撞）。
> **M1 ✅ done（PUI·2026-08-04·待 Lead 对抗性验收）**：catalog 闭集新增三控件 `dialog`/`choiceList`/`portrait`（沿 panelTexture 先例·types+render+catalog describe+validate 自动认+点名测试+ui.md 回填+house 主题取色可皮）。**投影读世界**=另立结构投影器 `resolveDialogue(tree, DialogueSource)`（bindings.ts·DI 接口·ui 不 import @skills）——因标量 UIDataSource 表达不了「变长选项+逐项 optionAvailable」这类结构投影；写世界=`dialogue.advance`/`dialogue.choose`+arg 下标（t3-dialogue 已认 arg 串·零游戏 handler）。守卫：`src/ui/components/dialogue.test.ts`（8 例·validate/渲染/投影/可选性门控/bind 未命中透传）+ catalog-coverage 41 型 + game-i `dialogue-demo.ts`（`💬 剧情·VN 对话三件` tab·+测试+audit 0 阻断）。scoped-gate 全绿。**Lead 评判**：M1 确为真闭集缺口（非可重组·游戏代码建选项列=「代码重建 UI 树」反模式）·PUI 独立复核同判接受。**退役令待触发**：M1 验收过→ PUI 出小单标 `ui/vn` deprecated 并删。

### REQ-PIPESOFT-管线软件 · 八步法软件化：一句话入口+向导壳+阶段编排器+IDE 接入 · [2026-08-03] · owner 批（四裁在图纸头）→ **图纸：`docs/design/pipeline-software-plan-2026-08.md`（唯一真相）** · status: **in-progress（P0 施工中·P1 待 Lead 出编排器细图）** · 优先级: P1（与剧情线并行·域不冲突） · 类型: 生产线基建（workshop 壳=PST 域·编排器/MCP=引擎 scripts）
> P0 ✅（阶梯成文·`217b87d60`）→ P1a ✅ 编排器核（`5f070a4ed`·Lead 终审 PASS·九偏差裁决在编排器图纸尾）→ P1b ✅ 向导壳（`89b3f9bd4`·Lead 终审 PASS·三偏差照准：两模式解读=workshop 壳内第三入口不碰 studio 旧板；wizard-concept 不预填 name=不伪造数据由会话补；2.5s 快路径阈值=运行态调参。真浏览器四截图在案·人门空签灰钮不代填亲验·测试卡带已清）→ **P2 MCP+斜杠命令+板红拦推 hook：排队·建议 P3 试点跑过一轮再动**（试点只需 P1）→ P3 试点=owner 自派 RPS 走全程（Lead 只管软件不管游戏内容·真机联调首项=编排器权限口径 acceptEdits+允许清单）。红线：无特权通道·代签禁止·阶梯降级留痕。**留验项**：P1b 施工中见 `pipeline-smoke.py` 4 条 pre-existing 基线红（stash 对比证非本单引入）——下次巡检核对归属。

### REQ-SPECTRACE-条款追踪 · 策划细则→机器验收的追踪矩阵+守卫（无限更新循环） · [2026-08-04] · owner 令（复查不靠人看·按细则收工） → **图纸：`docs/design/spec-trace-blueprint-2026-08.md`** · status: **in-progress（V1 施工中·试点 game-c）** · 优先级: P1（客观复查线①） · 类型: 生产线基建（守卫+文档规约）
> 三件套：细则编号`【R-<游戏>-<序号>】`（GD 写）+ 追踪矩阵 spec-trace.json（数据）+ spec-trace-guard（未覆盖/死引用/**过期=文档改了旧检查自动失效**/孤儿 四判·bless 带证据留痕）。human 型验收合法但占比上报表。V1 独立跑不接门禁；V2 接 S4/S5 门+复查门清单+stale 自动开单（与编排器汇流）。
> **⚖ Lead 终审 V1（2026-08-04）：✅ PASS**（`74236fddb`）——独立复跑：守卫 game-c 真跑绿（25 条款/33 checks·human 21.2% 如实上报）·35 测独立绿·假信心自查在案（短路哈希比较→过期测试转红）。两处具体化裁决**照准**：test 型粒度=文件路径（与 bless「真跑该文件」语义一致）；scenario id=剧本文件名（与 acceptance-run 发现机制一致）。**试点首跑战果=逮出两处真 spec/实现漂移 + 一处过期清单**：已开 game-c 工单 REQ-C-116（桌形口径失同步·GD-C）/ **REQ-C-117（典当阈值 <3BB+性格 vs 实现 <1BB 统一·等 owner/GD 裁 A 改文档 B 补实现）** / REQ-C-118（acceptance README 过期）。V2 待试点周期反馈后启动。

### REQ-RENDERCHECK-渲染裁判 · 渲染器当客观判定器：三探针进机器门 · [2026-08-04] · owner 令（「用渲染器直接判定」·连提两次=授权） → Lead 口径已出（图纸随 R1 施工时落） · status: **open（R1 排队·SPECTRACE V1 后启动）** · 优先级: P1（客观复查线②） · 类型: 生产线基建（机器门加严）
> R1 渲染冒烟（S3 门·真浏览器装载→非空白像素方差+零控制台错+机器自动截图=门证·施工会话截图作业退役）→ R2 真界面走查（S4 门·验收剧本操作序列经真实 UI 重放·闭集控件自动盖机器可寻标签=通用驱动器红利）→ R3 标准照比对（S5/S8 门·固定种子固定帧·像素漂移机器发现+人裁意图·探针模式冻结动效）。验收物类型=SPECTRACE 矩阵的 `probe` 型（两案汇流）。

### REQ-DESIGNLINE-设计稿产线 · 策划需求→设计稿→落档定稿的自动流水（消灭手动搬运） · [2026-08-04] · owner 令（「现在都是手动来回上线·要自动打通」） → Lead 案（双轨）·排队等工坊面空闲 · status: **open（过渡轨排队：等沉浸模式落地防撞·主轨试产随后）** · 优先级: P1 · 类型: 生产线基建（PST 域+编排器扩展）
> **双轨**：①过渡轨（先装·止血）=设计需求单自动起草一键复制 + 工坊**收稿箱**（上传/投递 `.dc.html` 自动归位游戏目录+登记档案指纹）——owner 继续用 Claude Design 网页但搬运消失；②主轨（试产定夺）=编排器扩「设计会话」类型（无头+游戏 UI 设计技能包+house 风格锚+需求单→ `.dc.html` 直接落档），工坊预览+反馈框→一键修订轮，**定稿=人门**（登记指纹·自动挂「在档=1:1 复刻基准」铁律·将来接 R3 实现 vs 稿像素比对）。事实前提：Claude Design 网页产品无可编程拉起接口——「自动拉起对话」只能在自养会话轨实现。主轨质量由 owner 试产一屏亲比后定夺全切与否。
> **⚖ Lead 终审 过渡轨（2026-08-04）：✅ PASS**（`6ef243086`·全库门禁绿·同批交付沉浸布局修正+三处隐藏+换新会话钮）——五偏差照准：base64 收稿沿 upload 先例够用；上下文百分比 200k 硬编码=已标「估算值」诚实口径；风格包未锚定占位=预期分支；`concept_digest` 每轮无条件算（15s 超时上限）=沿既有 digest 写法·记微债随后续优化；requests.md 不代更=域纪律正确（本行即 Lead 补记）。换新会话=复用既有 reset 机制下沉到每 tab+接力包并入生产板阶段摘要（不造第二真相=正确）。测试卡带清理亲核干净。**主轨试产一屏排队（R1 后）**。

### REQ-MATRIXDUEL-同时决策矩阵 · 「同时出招 × 收益矩阵」结算解释器（`matrix-duel`） · [2026-08-04] · game108《拳律》立项带出（owner 同日批 108） → **指派：Opus**（spec 已写死·见下） · status: **open（S3 卡口·未落地不进玩法骨架）** · 优先级: P1 · 类型: tier2 能力下沉
> **要什么**：`DuelMatrix{throws[],beats{},payoff{},tie{},patches[]}` + 双方 `DuelIntent{throw}` → 两侧 intent 齐备即结算：查表定胜负 → 发具名 `Signal` + 写 `ResourceModify`（伤害/附带效果）→ 清 intent。`patches` 在对局开始时按序确定性套用（**改 beats / 改 payoff / 增 throw 维度**三类补丁）。
> **为什么不能重组**（Lead 评判·已按核心规则走过「能否现有能力表达」）：`ConditionExpr` 的 `id` 是**静态**的，无法按「本回合两侧出招」动态查表。三手可硬写 9 条 `t2-event-when` 规则，但 ① 遗物**运行时改写**判定表、② 遗物**增设第四手**（3×3→4×4）静态规则集表达不了——放弃它等于放弃该作签名机制。
> **为什么值得进引擎**（通用·非游戏专属）：任何同时决策收益矩阵对决同吃——猜拳全变体（含蜥蜴斯波克）、田忌赛马、押注对决、兵种相克战棋。纯整数查表 → 确定性/可回放/可审计。
> **边界（防加宽）**：**不含** AI 策略选招（走 `t2-event-when`+`t2-weighted-spawn` 重组）、**不含**手牌（`t2-card-pile`）、**不含**押注（`t2-craft-recipe`+`t2-modifier-stack`）。允许触碰：`src/skills/tier2/matrix-duel.ts` + registry 注册 + `component-map` + 点名测试 + `docs/playbooks/events-logic.md` 回填一行。
> 消费方与验收语义：`docs/design/game108/{gdd.md 条款 R-108-01~04/30/31, capability-plan.md §4}`。

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
