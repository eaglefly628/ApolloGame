# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

<!-- REQ-ARTTOOL-01/02（P1/P2·game108 S6 实测带出）已完结：batch 无 key 零回写+非占位行跳过点名·rowIdentity 按素材（skinKey→槽→query 三级回退·护住 styleset 消费方）·Lead 终审 PASS（8551d45f8·58 测独立复跑绿·双撤修验红在案·回退链偏差照准=兼顾双消费方的正解·顺带发现已落 REQ-108-ART-02）。 -->


### REQ-SCORECARD-2D · 视觉评分卡八维是 **3D 线口径**，2D 数据 UI 游戏套不上（**不得自行跳维·请裁**）· [2026-08-08] · game108 S7 实测带出 · status: open · 优先级: P2 · 类型: 手册/判据口径
> **先查过**（协议第一步）：`docs/playbooks/visual-scorecard.md` §五明写「维度不适配新品类（如纯文字游戏无"世界密度"）
> → 提缺口**由 Lead 裁维度豁免**，**不得自行跳维**」。故本条不是自作主张，是照手册走的那一步。
>
> **哪两维套不上**（第三维「世界密度」其实适配，不申请豁免）：
> · **材质**：2 分底线是「主要表面用了**材质系统**（preset/贴图/surface）」——2D 数据 UI 没有 3D 材质系统，
>   一个 preset 都挂不上。等价问题应是「表面有没有质感：描边/纹理/渐变层次，而非全场 flat」。
> · **渲染管线**：2 分底线是「**主光 + 补光**有意图；Post3D/氛围至少一项」——本作没有光照与后处理，一盏灯都没有。
>   等价问题应是「有没有做过整屏的明暗 / 景深 / 氛围处理」。
>
> **不裁会怎样**（这才是它值一张单的原因）：这两维会被判 1 分 ⇒ 拖垮 premium，而**低分不指向任何可执行的修法**
> ——PE 看着「材质 1 分」除了给素坯糊特效没别的可做，而糊特效正是手册 §四红线禁的那件事。
> **分数必须能指导施工，否则它只是个装饰。**
>
> **两条路**（Lead/owner 判·我不自裁）：
> · **A 加一套 2D 口径**：八维不变、每维给「3D 底线 / 2D 底线」两行判据（改的是手册，影响全库 2D 线：
>   game-a/b/c/d/e/f/g/i/101/102/103/108 —— 其实**多数游戏都是 2D**，现在都在拿 3D 尺子量）。
> · **B 逐游戏豁免**：本作在 pipeline 里记两维豁免（改的是数据，只影响 game108；但下一个 2D 游戏还得再申请一次）。
>
> **我的推荐（只是推荐）**：**A**。理由是这不是 game108 的特例——本库 2D 游戏占绝大多数，
> B 会让每个 2D 游戏都重走一遍同样的申请，而「重复申请同一件事」正是该下沉的信号。
> **代价**：改手册要重估已打过分的 3D 线游戏（game-z）会不会因判据改写而分数漂移。


<!-- REQ-STYLESET-风格库 apollo-toon（PA+PUI）→ **owner 2026-08-05 令暂停后移出池**（不占槽）。图纸唯一真相仍在 `docs/design/styleset-artlib-plan-2026-07-16.md`。**已落地未验收的存量**：M0 台账底座 + M0.5 现装可视版 + 三游戏风格锚（均 Lead 验收 PASS）· **M0.6 主题指针 = PUI 已 done 但未经 Lead 对抗性验收，随暂停冻结**——重启时 Lead 必须先补验 M0.6 再往下走。未做：M1 试产/M2 建库（等真 key·连 REQ-AIGEN 卡口）· M3 对齐 · M4 出口游戏换装。遗留债：ui-audit border-image 盲区 + 亮主题 dim 假阳（PUI 工具债）· 默认主题是否切 apollo-toon 等 owner。重启即重开本条。 -->

<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结（查 git 历史）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


<!-- REQ-RETRO-引擎大扫除（P0·owner 全权授 Lead）已完结（查 git 历史）。 -->

<!-- REQ-RETRO2-能力库整理（P1·owner 三裁缩范围）已完结（查 git 历史）。 -->

### REQ-DIALOGUE-剧情基础线 · 剧情向 Dialogue 能力做成基础件+Sample+Template · [2026-08-03] · owner 令（约会性单机超休闲转型线·owner 同日令启动） → **图纸在档：`docs/design/dialogue-line-blueprint-2026-08.md`（派工唯一真相）** · status: **in-progress（M1 ✅ PUI done·待 Lead 对抗性验收；M2/M3 next）** · 优先级: P1（转型关键路径） · 类型: 能力线（引擎+UI 基座+样板）
> 四里程碑详见图纸。**M1 ✅ 全闭环**（三控件+整改真跑展台+ui/vn 已退役 `6c425414a`·Lead 抽验绿·判词全文查 git 历史）；**M3 伴侣在场件 ✅ done（PUI·2026-08-05·待 Lead 验收）**：`@ui/starters/presence.ts`——`ReactionTable`(gameEvent→反应候选[]·纯数据) + `pickReaction(table,event,seed)`(确定性选句·加权·无裸 Math.random·录放一致) + `buildPresence(...)`(用 M1 三件拼装：立绘金框高亮 + dialog kind:'choice' 被动气泡·非新控件) + `SAMPLE_REACTIONS`；守卫 `presence.test.ts`(6) + game-i `🫂 伴侣在场件`展台(`presence-demo.ts`·四 event·+测试+audit 0 阻断·截图在案)。**M2 立绘/表情链 ✅ PUI 半 done（PUI·2026-08-05·待 Lead 验收；PA 半=真图走美术台账·未阻塞接线）**：`@ui/starters/emotion-art.ts`——`EmotionArtTable`(characterId×emotion→assetKey·纯数据表) + `resolveEmotionArt`(**分级降级**：指定情绪→neutral 锚→none·绝不空白) + `emotionArtResolver`(合成 `resolveArt(emotion)→URL` 回调·**双级降级**：表缺情绪→neutral·key 缺图→neutral 图) + `SAMPLE_EMOTION_ART`；`buildPresence` 加 `resolveArt` 参数按情绪出图。守卫 `emotion-art.test.ts`(8·exact/neutral/none 降级链 + resolver 接线 + buildPresence 贯通)；game-i `🫂` 展台接 emotionArtResolver（happy/excited 出图·gentle/calm 缺表→降级 neutral·程序化占位·截图在案）。真 assetKey 由 PA 台账填（等文生图·不影响接线）。**M4 剧情起手包 ✅ PUI 半 done（PUI·2026-08-05·待 Lead 验收）**：`@ui/starters/story-starter.ts` `buildStoryStarter({dialogueEntityId,speakerName?,listenerName?,place?,affinityBind?})`——复制即跑的 VN 剧情屏模板（对标 buildStarterHome/Result）：portrait+dialog+choiceList **bind 已接线**（resolveDialogue 投影 speaker/text/emotion/**art**/options）+ 好感 pill（bind Resource）+ 环境微光 + house 金框货架起手。**M1↔M2 缝合**：`DialogueView` 加 `art?`（源侧经 emotionArtResolver 出图）·`resolveDialogue` 填 `portrait.art` → 立绘随节点情绪换脸（分级降级）。守卫 `story-starter.test.ts`(4·合法闭集/投影后信号全通+立绘换脸/好感 bind/复制即跑 mountUI)。**M4 Sample 示范游戏（GD 剧本+PE slug）= 待 GD/PE 协作**（起手包已就位·复制即用）。**悬置段=DokiWorld 数值双向契约 → owner 2026-08-05：「回头再说·我先去要接口」**（owner 自去索取真卡 schema/宿主接口文档/双人确认三样材料）——**故本段不挂在池子里等、也不阻塞 M2/M4**；材料到手再重启该段。若最终要不到，M4 Sample 按「不依赖 Doki」形态收口（Lead 已备此退路）。

<!-- REQ-PIPESOFT-管线软件（P1）→ **owner 2026-08-05 令关闭出池**（不占槽）：P0 代码准入五级阶梯 + P1a 编排器核（三命令/串行锁/看门狗/独立重验）+ P1b 向导模式 **全 Lead 终审 PASS**（`217b87d60`/`5f070a4ed`/`89b3f9bd4`·判词查 git 历史）。**下一步的触发者=owner 本人**：owner 明示「等这轮清理完，我自己跑一次这个软件、拿一个游戏验证这个阶段」——故 P3 试点不挂在池子里等，改由 owner 跑完带回反馈再重开本条。**owner 跑的入口**：① 工坊界面（`/workshop/`）→ 沉浸态主按钮里的「向导」= P1b 向导模式（一句话→步进器·库级锁横幅）；② 命令行编排器 `node scripts/pipeline-orchestrator.mjs <dispatch|status|abort>`（P1a·每步只派一个阶段·会话退出后自己 spawn 该阶段门以退出码落判定）。图纸唯一真相 `docs/design/pipeline-software-plan-2026-08.md` + 细图 `docs/design/pipeline-orchestrator-spec-2026-08.md`。**排队中的后续**（重开时接着做）：P2 IDE 接入；小尾巴=冒烟⑥修复 spec 已写死（low·查 git 历史 grep 留验项）。红线不变：无特权通道·代签禁止·阶梯降级留痕。 -->

<!-- REQ-SPECTRACE-条款追踪（P1）→ **2026-08-06 关闭出池**（不占槽·同 PIPESOFT 先例：下一步触发者不在池内）：**V1 ✅ Lead 终审 PASS**（`74236fddb`·三件套=细则编号【R-游戏-序号】+ 追踪矩阵 spec-trace.json + 四判守卫（未覆盖/死引用/过期/孤儿·bless 带证据）·game-c 试点**首跑即逮出两处真 spec/实现漂移**）。**漂移单路由铁律已成文**（owner 2026-08-05 明训·见 `docs/design/spec-trace-blueprint-2026-08.md` 路由节）：游戏 spec↔自己实现不符=游戏自治（GD 裁规则/PE 补实现·落该游戏 requests）·**禁上抛引擎池或 owner**；仅当根因是引擎缺能力才走 Lead 评审下沉。**待重开**：V2（接 S4/S5 门 + 复查门 + stale 自动开单·开单目标目录必须照上述路由分流）——**触发条件=试点跑满一个周期后的真实反馈**，无反馈不动。 -->

<!-- REQ-RENDERCHECK-渲染裁判（P1）→ **2026-08-06 关闭出池**（不占槽·同上先例）：**R1 冒烟 / R2 UI 走查 / R3 标准照 三探针全 ✅ Lead 终审 PASS**（`8d813d1a8`/`0e4937e11`/`70b36bc8c`/`b92f90b8f`/`c33437aa8`/`fb602ca78`·机器门证在档）。**R2 的结构性发现**：game-a 实跑 UI 可驱动率 **0/19**——非管道故障，是**验收剧本用引擎信号词表（play/pass）、真 UI 挂另一套（menu.start/hand.toggle）**，两套词表从未同源；且部分步骤（play 带 args.cards 数组）本质非单击可表达。**R2c ⚖ 已定案**（owner 2026-08-05「这个你来定」授权 Lead）：owner 同时把它升格为原则——「**做出来的东西必须和策划案完全一致**·策划案 review 时逐条对齐」。**①已落制度**：`docs/playbooks/game-production.md` 验收剧本循环律并入**词表对齐律**（剧本步骤名必须用真 UI 动作名 `data-action`·禁用引擎内部信号名·review 逐条对齐「剧本步骤↔UI 动作↔规则条款」三者）。**待重开**：②老游戏「信号→UI 步骤」映射表（纯数据·不强制）③世界态核验通道（host 契约加可选调试收集器，让探针能读仿真状态而非只读 DOM）——**触发条件=owner 做新游戏时亲自走一遍三探针后的真体验反馈**，据以定②③优先级。 -->

<!-- REQ-DESIGNLINE-设计稿产线（P1）→ **2026-08-06 关闭出池**（不占槽·同上先例）：**过渡轨 ✅ Lead 终审 PASS**（`6ef243086`·需求单一键复制 + 收稿箱 + 定稿人门——"手动来回搬运"这个最疼的点已止血）。**主轨未做**（编排器扩设计会话·无头 + 设计技能包 → `.dc.html` 直落档）：决策点=**要不要全切机器产设计稿**，而这个判断必须 owner 亲眼比一屏（审美与"够不够用"的标准在 owner 那）。**重开的第一步 = Lead 先用主轨产一张设计稿，与现有人工稿并排给 owner 比**，比完再定全切/维持。图纸与双轨方案全文查 git 历史 grep DESIGNLINE。 -->

<!-- REQ-MATRIXDUEL-同时决策矩阵（P1·game108 带出）已完结：t2-matrix-duel 落地·Lead 终审 PASS（5bfa84f48·裁决与偏差全文查 git 历史）。后续 payoff 缩放扩写=REQ-108-ENG-01，因 10 硬槽已满而降级放 docs/design/game108/requests.md（不占槽·Lead 已裁·待派工）。 -->


<!-- REQ-CYCLEHAZ-定序成环（P1）已完结：B 止血落地 887c410f7·Lead 终审 PASS（全文查 git 历史）；后置不占槽：B.2 SCC 棘轮（low）+ C 相位化（xhigh·等剧情线实战反馈）——要做时重开。 -->

<!-- REQ-ARTPIPE2-美术管线二期（P1·owner 令）整案已完结：A1 台账守卫+棘轮（无账不录入·新增黑户拦推送）→ A2 三栏资产浏览器（徽标/拖入自动登记）→ A3 git 历史回滚 → A4 替换工作流+消费方反查，四翼全 Lead 终审 PASS（判词全文查 git 历史 grep ARTPIPE2）。后置不占槽尾巴：①studio 旧 AssetLibrary 退役（功能对等已达·退役时清解耦白名单 3 条+approve 端点 note 转服务端强制）②game-z 裸路径 1 处（无 requests 文件·随 P3D 线记）③裸路径三单已落 A-027/B-015/REQ-I-裸路径收编。 -->

<!-- REQ-DESIGNLINE·二期（P1·owner 令）已完结：ui-brief 推导器（三源动作清单+屏清单+品味槽+输出契约）+ 向导 S3 后一键生成 + ZIP 收稿（防穿越/白名单/保相对路径）+ 收稿对账（briefCheck）+ design-import CLI（--watch 按 owner 裁决剔除）·Lead 终审 PASS（61aaf5e84·25 测独立复跑绿·game108 真需求单亲阅·判词全文查 git 历史）。副产战果：game-a 双词表零重叠再实证·game108 剧本盖 6/10 动作→已落 REQ-108-GD-01（游戏自治路由）。待 owner：分享链接无痕测试结果（定 --url 模式做否）·主轨亲比。 -->

### REQ-ENGINEAUDIT-引擎全量评审落地 · 15 子系统深审（110+ 发现）· [2026-08-04] · owner 令 → **报告=唯一真相 `docs/design/engine-review-2026-08-04.md`** · status: **in-progress（P0 + 21 处已修推·门禁全绿；余 3 项见下）** · 优先级: P1（P0 已清·降档） · 类型: 引擎质量总账
> **已修并推（Lead·全部「先实证复现→修→撤修复验红」）**：批0 确定性护栏/注入面/voxel 崩溃 13 处（`0031b950d`/`3b8e2757c`/`29cf511ba`）→ **P0 lockstep 加入死锁**（`ce3903c1`·输入按 epoch 缓存·实测 A 停 2×inputDelay/B 停 inputDelay）→ 存档装配批（envelope checksum 覆盖持久化形态 · save 读档校验 fail-closed · manifest `__proto__` 拒收）→ sim 正确性批（card-pile 空出牌 · effect-apply NaN/mul 清零 · friction/ground-sense 漏过滤 Sensor=二段跳 · merge-on-place 撞名硬崩 · matrix-duel ≥3 死锁）→ owner 四裁（共用组件推断不猜+守卫 · 快照带创建序 · TS 卡带执行侧闸门）→ Sprite.anchor 真消费。
> **余下 3 项（待 owner 分配）**：①**根因① reads/writes 申报对账守卫 + §3.1 补齐组 13 处**（引擎定序契约批改·Lead 判定须独立专项·CYCLEHAZ B 已解锁）②**根因② 运行时组件全集基准**（扩 `build-component-map.mjs`·解锁 NON_DETERMINISTIC 对账+装配校验+catalog 共用）③**Q1 消费路径**（dump-catalog 分档 + capgap 断链 + audit 进推送门 + pick-list 决策树·多为低成本小活）。
> **已转派/已裁**：UI 契约批→PUI（已完结）· 渲染专项→P3D（`REQ-3D-RENDERHYG` 在 3D 池）· **根因④ 受信执行环境→owner 2026-08-05 令搁置**（未理解·待重讲后再定）。

<!-- REQ-UICONTRACT-UI 契约批（P1·引擎评审 §6⑨）已完结：PUI 三条（modalClose/comboClick 补 ActionSink 回退 · 键控锚点改 firstContentAnchor · 动效扫描抽 initDynamics 幂等且 mount/update 各扫一次）+ Lead item④（Sprite.anchorX/Y 抽 spriteAnchorOffset 纯函数真消费）全部落地。Lead 对抗性验收 PASS：6 例守卫独立复跑绿·撤 update 侧 initDynamics 实测转红 2 例·撤 item④ 修复转红 2 例。P2/P3 尾巴（bindings 不递归 node props / layout-solver 忽略 cols / typewriter+emoji 掉字 / apollo-kit 像素字体退化 / onboarding 缩放错位…）按报告 §5 原文另清·不占槽。全文查 git 历史。 -->

<!-- REQ-STATUSSET-资源见底置状态位（game107 带出）→ **owner 2026-08-05 令废除出池**：107 尚未开工·无现役游戏被阻塞·不该占引擎硬槽。**spec 原文完整降级存 `docs/design/game107/requests.md`**（不占槽），107 真开工时先按核心规则重核「能否用现有闭集重组」再决定升回。 -->

<!-- REQ-CARTART-卡带美术存储归位（P1·PST 提·owner 选方案 b-full）→ **2026-08-06 Lead 追认越界·结案出池**：两处跨域改动（`scripts/art-replace.mjs` 写盘落点 + `scripts/art-ledger-guard.mjs` 发现口径/台账根）**均予追认**——改法正确（都收敛到单一真相 `artRoot`，没有另起一套口径）、面最小、与 Python 侧 `paths.py::art_root` 同源。**追认时实证撞出并已修一处真 bug**：`art-replace.mjs` `fill` 的「无台账」错误分支把 `ROOT` 写成了 `root`（`run()` 内无该绑定）→ 撞上无台账的游戏不是干净报错退出而是 **ReferenceError 崩栈**；已修 + 补 2 例子进程 CLI 守卫（原 47 例单测全走导出函数，够不着 CLI 分支）·撤修复实测转红 1 例。复验：cartridge-art-smoke 18/18 · art-ledger-guard WARN(exit 2·gate allowExit 内·两条死账为既有存量) · scoped-gate scope=full 全绿。**留尾不占槽**：①`pipeline.json` 仍落 `public/games/<slug>/`（不在 art/ 下·消费方是生产板另一条线）②JS `artRoot` 用 `existsSync` 而 Py `art_root` 用 `.is_dir()`——`library/<slug>` 若是文件则两边分叉；判定不可达（需手工在 library 下造同名文件），记债不修。图纸全文 `docs/design/cartridge-art-storage-2026-08.md`。 -->

### REQ-ARTGUARD-黑户判据认索引记账 · 62/65「黑户」是假阳·把判词钉死在 WARN · [2026-08-06] · PST 提（owner 认可）· status: **open（待 Lead 裁 + 派工·守卫属 Lead 独占域）** · 优先级: P2 · 类型: 守卫判据修正
> **实证（非推测·2026-08-06 实跑）**：全仓 65 个黑户里，**62 个在各游戏 `art/index.json` 有完整来源登记**——game-a 的 55 张是 CC0 vendored 扑克（`license:"Public Domain"`·`source:"notpeter/Vector-Playing-Cards"`·`provenance.pulledFrom` 精确到源 URL·`status:filled`，游戏正靠 `cardAssetId()→索引` 消费），game-103 的 4 个 fx 同样三件齐，game-c 的 1 个有 provenance。**真正无账的只有 3 个**（game101 superpowers faceset·索引里也没有·已落 `docs/design/game101/requests.md`）。
> **根因**：`blackHouseholdFiles()` 只拿 `art-ledger.json` 的 servedPath 做 covered 集，**完全不读 `art/index.json`**。于是"记账在资产索引、不在需求台账"的合法 vendored 资产被永久判成黑户 → 判词长期钉死 WARN、**真信号被 62 条噪声淹没**；且这 65 条已全部写进棘轮基线 `scripts/art-ledger-baseline.json`（game-a:57/game-103:4/game101:3/game-c:1），等于把噪声固化了。
> **建议判据（Lead 裁）**：文件不算黑户当满足其一——① 被台账行 servedPath 覆盖（现规则不变）；② 在该游戏 `art/index.json` 有 `path` 命中的条目**且有来源登记**（`provenance` 对象存在 **或** `license`+`source` 齐）。落地后同步**瘦身基线**只留真黑户（棘轮只紧不松）。
> **明确不做**：给 55 张扑克逐张编台账号——违背 owner「一行=一种素材」去重原则，它们不是 55 个独立美术需求而是一副成套 vendored 牌面。
> **需 Lead 权衡的取舍**：认索引记账 = 把"记账可信度"下放给 index.json（与台账同信任级）。好处是判词恢复可用；代价是伪造索引条目也能过——但那与伪造台账行同级，且需留下 license/source 痕迹。另：`SKIP_DIR_PREFIXES` 已含 `orig`/`ai/pending`，备份目录不是新假阳源（已核）。
> **验收**：改后全仓黑户从 65 → 3（且这 3 个正是 game101 那单要清的）；判词随之可回 PASS。

### REQ-S3CLICK-骨架关加「点击打穿」机器门 · [2026-08-07] · owner 判 **A** · status: **in-progress** · **施工主体 = 策划 session（本行即占锁）** · 复查 = 楚晨 · 优先级: P1 · 类型: 流程门

- **病**：S3 骨架关全程**一次都不点**（机器门 = manifest + 装载 + 空跑 2 拍 + 渲染探针）。
  于是「按钮画得好看但点了没反应」能一路绿着过 S3——game108 实测踩到两发，都不报错：
  ① 宿主自搓 rAF 圈直接 `world.tick()`，绕过 `Engine.step()` 里注入输入那一句 ⇒ 队列一直填、没人取；
  ② `props.bind` 没跑 `resolveBindings` ⇒ 进度条永远画在 0，文字却是对的。
  **单测绿（自己往队列塞）+ 渲染探针绿（只画图），只有真点才露馅。**
- **同病史**：owner 2026-07-17「**绿门不可玩**」复盘的药方是给 S4 加验收剧本，
  **S3 这层的洞当时没补** ⇒ 同一个病换个位置又犯。
- **界**：S3 问「信号打得穿吗」（点一下世界动没动）；S4 问「规则对吗」（打穿之后赢的是不是该赢的）。
  接线断了属于骨架，不属于玩法——推给 S4 发现的话，验收剧本跑不动时分不清是规则错还是线没通，排查成本翻倍。
- **做法**（owner 判 A·最小断言）：S3 门追加通用点击探针——扫活体 DOM 的 `[data-action]` 控件逐个点，
  断言 ① 至少有一个点完 DOM 真的变了 ② 全程零控制台 error。**不验玩法、不需要 AI、不需要结算闭环。**
- **不回溯**（owner 2026-08-07 明示）：现存游戏进**可见的**豁免名单（照 `pipeline-registry-guard`
  的 `LEGACY_NO_BOARD` 先例·名单带理由·非静默跳过），**新游戏受检**。
- **边界**（复查门核对用）：`scripts/click-probe.mjs`（新）+ `scripts/game-pipeline.mjs` 的 S3 门读码一处
  + 其单测。**不碰**别的阶段门、不碰渲染探针、不改任何游戏。

<!-- REQ-108-ENG-07（我 2026-08-08 开的「全局条件→扣指定一侧血」引擎缺口单）**已撤销·不占槽**：
     ① 编号撞车——该号早被「结算门下的 intent 生命周期」占用（我开单时只 grep 了本文件，没扫 gdd.md）；
     ② 举证经主程实查**证伪**并回驳 wontfix——`t2-self-rule` 的 `whenGlobal`（全局 id 求值）+ `do`（施于自身）
        两头都有，等价数据写法与证明测试见 `src/skills/tier2/self-rule.test.ts`「罚血形态·回驳证明」3 例。
     2026-08-08 已按该写法接线完成（game108 罚血真扣血·验收剧本 12/12 绿）。全文查 git 历史与
     `docs/design/game108/requests.md` 的回驳单。**教训：开单编号前扫全套 docs/design/<game>/*.md，不只扫 requests。** -->

### REQ-UIFX-2D 表现件补齐：**UI 层粒子对位 3D** + **液面件** · [2026-08-08] · owner 令（game108 设计定稿 v3 带出） → **指派：PUI**（`src/ui/**` 是 PUI 域） · status: **open** · 优先级: P1 · 类型: UI 基座扩件（render-only）

**起因**：Claude Design 给 game108 的 v3 定稿里有两样表现，**闭集里现在做不了**。
owner 2026-08-08 判词：「这是个偏美术的东西…粒子拖尾以前我们在 3D 里面实现过，所以应该是能做的…
**我也不希望你用它的这个每一帧换新皮的锁死的方法**。」——即：**不许游戏层每帧生成新贴图绕过去**，
该由渲染器承担的动画就交给渲染器，游戏只给静态数据。

#### ① 先查（实查·留原文）

| 查了什么 | 结论 | 出处 |
|---|---|---|
| UI 闭集 `Particles` | **只有 4 个预设 kind**（confetti/coins/stars/sparkle）+ `count` + `loop` + `follow:'cursor'`。**没有颜色、没有方向/目标、没有尺寸、没有拖尾** | `src/ui/components/types.ts:377-386` |
| 同件的自述 | 「UI 层发射器（**世界层对等件=Vfx3D**）」 | 同上 :375 |
| 世界层 `Vfx3D` | **已经是 Niagara-lite 闭集发射器**：`rate/lifetime/shape(point\|cone\|sphere)/coneAngle/speed/gravity/drag/attractor/size/sizeCurve/color/colorGradient/blend` | `protocol/components/render.ts:494-521` |
| 3D 拖尾 | **已有 `Trail3D`**：`segments/width/color/minDist/fade/blend` | 同上 :526-534 |
| UI 闭集里有没有液面/波纹/按父圆角裁剪 | **一个都没有**（`liquid`/`wave`/`clipChildren`/`overflow` 全库零命中） | `types.ts` 全文 grep |
| `ProgressBar` | 已有 `value/max/tone/shape('bar'\|'ring')/size/bind` —— **形态轴已经开着**，加一档是同族扩写不是新件 | `types.ts:362-372` |

**⇒ 不是「能不能」的问题，是「3D 有、UI 层没有」。** owner 说的「3D 里实现过」经查属实，
UI 层那个同名件只是个四预设的门面。

#### ② 要补的两件（都是 render-only·不进 sim/hash）

**A · `Particles` 扩写到与 `Vfx3D` 对位**（**主项**）
定稿要的原文：「14 颗射出，直径 12–30 六档，芯白 → 牌色 → 牌色 75% 径向渐变，外挂 26px 同色光晕 + 5px 白描边；
先向上窜 90px 再俯冲，飞行 600ms、每颗错开 36ms；落点一记 200×130 的同色落地光晕」+「**加拖尾**」。
缺的轴（照 `Vfx3D` 的既有命名，别另起一套）：
- `color` / `colorGradient`（现在粒子色写死在预设里）
- `size` + 尺寸分档（定稿要六档 12–30）
- **方向与目标**：`shape:'cone'` + `coneAngle`，以及**飞向某个 LayoutNode**（可复用已有的锚引用
  `AnchorRef{kind:'node',id}`——`layout.flyTo` 已经在用同一套寻址，别新造第三套）
- **拖尾**：对位 `Trail3D` 的 `segments/width/fade/blend`
- `gravity` / `drag`（定稿的「先窜上去再俯冲」= 初速 + 重力，不是手写关键帧）

**B · 液面件 = `ProgressBar` 加 `shape:'liquid'`**（**同族扩写·不新增控件**）
定稿要的原文：「水面是**两条错频的椭圆脊**叠加：主脊 20px scaleY 1↔.5 且左右荡 ±3%（900ms），
副脊 16px 白 55% 反向荡（1250ms）——两条不同步才有晃动感，单条只会像呼吸。
整杯水挂 `rt3-slosh`：以杯底为轴 ±1.6° 摇（1300ms）。另有 **3 颗气泡**（16/11/20px，白 60–75%）
从底往上窜 210px，周期 1.5/1.8/2.1s 错开发。」
建议字段（沿用该件既有口径）：`shape:'liquid'` + `radius`（按盒圆角裁）+ `fillColor` + `wave?:boolean` + `bubbles?:number`。
**游戏只给一个标量 `value`**（水位）——四段过冲的曲线 game108 已经算好了（`POUR_KEYS`），
不需要引擎管；引擎只管「把这个水位画成会晃的水面 + 气泡」。

#### ③ 为什么不能在游戏层解决（= owner 那句「不许每帧换新皮」的技术面）

现在的注水是把水面**烤进卡皮的 SVG**（闭集控件没有"按父圆角裁剪"，只能这么做）。
要让水面逐帧形变，就得**每帧生成一张新 data-URI** ⇒ `mountUI` 判定 props 变了 ⇒
**整屏面板 outerHTML 全量重建 + `<img>` PNG 重新请求**——2026-08-07 实测踩过，
表现是**网络永远闲不下来、`networkidle` 直接超时**，真渲染探针跑不完。
所以这不是"偷懒不做"，是那条路本身有害。

#### ④ 边界（复查门核对用）

`src/ui/components/types.ts`（两处 props）+ `server.ts` 的渲染胶水 + 其单测 + game-i 展示台一格。
**不碰**任何游戏；game108 接上后把 `self-check/S5-design-v3-alignment.md` 的偏差 #1/#2 划掉。

#### ⑤ 同族小项（PUI 一并判·不做也不阻塞）

- `Label.tween` 期间**字号同步缩放**（定稿：伤害跳数时字号 .82 → 1）——现在 tween 只管数值。
- 一个 **steps 节拍**的 `anim`（定稿：罚血「−1」印章每秒跳一下 `steps(1,end)`）。

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
