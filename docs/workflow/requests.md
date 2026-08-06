# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中



<!-- REQ-STYLESET-风格库 apollo-toon（PA+PUI）→ **owner 2026-08-05 令暂停后移出池**（不占槽）。图纸唯一真相仍在 `docs/design/styleset-artlib-plan-2026-07-16.md`。**已落地未验收的存量**：M0 台账底座 + M0.5 现装可视版 + 三游戏风格锚（均 Lead 验收 PASS）· **M0.6 主题指针 = PUI 已 done 但未经 Lead 对抗性验收，随暂停冻结**——重启时 Lead 必须先补验 M0.6 再往下走。未做：M1 试产/M2 建库（等真 key·连 REQ-AIGEN 卡口）· M3 对齐 · M4 出口游戏换装。遗留债：ui-audit border-image 盲区 + 亮主题 dim 假阳（PUI 工具债）· 默认主题是否切 apollo-toon 等 owner。重启即重开本条。 -->

<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结（查 git 历史）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


<!-- REQ-RETRO-引擎大扫除（P0·owner 全权授 Lead）已完结（查 git 历史）。 -->

<!-- REQ-RETRO2-能力库整理（P1·owner 三裁缩范围）已完结（查 git 历史）。 -->

### REQ-DIALOGUE-剧情基础线 · 剧情向 Dialogue 能力做成基础件+Sample+Template · [2026-08-03] · owner 令（约会性单机超休闲转型线·owner 同日令启动） → **图纸在档：`docs/design/dialogue-line-blueprint-2026-08.md`（派工唯一真相）** · status: **in-progress（M1 ✅ PUI done·待 Lead 对抗性验收；M2/M3 next）** · 优先级: P1（转型关键路径） · 类型: 能力线（引擎+UI 基座+样板）
> 四里程碑详见图纸。**M1 ✅ 全闭环**（三控件+整改真跑展台+ui/vn 已退役 `6c425414a`·Lead 抽验绿·判词全文查 git 历史）；**M3 伴侣在场件 ✅ done（PUI·2026-08-05·待 Lead 验收）**：`@ui/starters/presence.ts`——`ReactionTable`(gameEvent→反应候选[]·纯数据) + `pickReaction(table,event,seed)`(确定性选句·加权·无裸 Math.random·录放一致) + `buildPresence(...)`(用 M1 三件拼装：立绘金框高亮 + dialog kind:'choice' 被动气泡·非新控件) + `SAMPLE_REACTIONS`；守卫 `presence.test.ts`(6) + game-i `🫂 伴侣在场件`展台(`presence-demo.ts`·四 event·+测试+audit 0 阻断·截图在案)。**M2 立绘/表情链 ✅ PUI 半 done（PUI·2026-08-05·待 Lead 验收；PA 半=真图走美术台账·未阻塞接线）**：`@ui/starters/emotion-art.ts`——`EmotionArtTable`(characterId×emotion→assetKey·纯数据表) + `resolveEmotionArt`(**分级降级**：指定情绪→neutral 锚→none·绝不空白) + `emotionArtResolver`(合成 `resolveArt(emotion)→URL` 回调·**双级降级**：表缺情绪→neutral·key 缺图→neutral 图) + `SAMPLE_EMOTION_ART`；`buildPresence` 加 `resolveArt` 参数按情绪出图。守卫 `emotion-art.test.ts`(8·exact/neutral/none 降级链 + resolver 接线 + buildPresence 贯通)；game-i `🫂` 展台接 emotionArtResolver（happy/excited 出图·gentle/calm 缺表→降级 neutral·程序化占位·截图在案）。真 assetKey 由 PA 台账填（等文生图·不影响接线）。**M4 Sample 最后**。**悬置段=DokiWorld 数值双向契约 → owner 2026-08-05：「回头再说·我先去要接口」**（owner 自去索取真卡 schema/宿主接口文档/双人确认三样材料）——**故本段不挂在池子里等、也不阻塞 M2/M4**；材料到手再重启该段。若最终要不到，M4 Sample 按「不依赖 Doki」形态收口（Lead 已备此退路）。

<!-- REQ-PIPESOFT-管线软件（P1）→ **owner 2026-08-05 令关闭出池**（不占槽）：P0 代码准入五级阶梯 + P1a 编排器核（三命令/串行锁/看门狗/独立重验）+ P1b 向导模式 **全 Lead 终审 PASS**（`217b87d60`/`5f070a4ed`/`89b3f9bd4`·判词查 git 历史）。**下一步的触发者=owner 本人**：owner 明示「等这轮清理完，我自己跑一次这个软件、拿一个游戏验证这个阶段」——故 P3 试点不挂在池子里等，改由 owner 跑完带回反馈再重开本条。**owner 跑的入口**：① 工坊界面（`/workshop/`）→ 沉浸态主按钮里的「向导」= P1b 向导模式（一句话→步进器·库级锁横幅）；② 命令行编排器 `node scripts/pipeline-orchestrator.mjs <dispatch|status|abort>`（P1a·每步只派一个阶段·会话退出后自己 spawn 该阶段门以退出码落判定）。图纸唯一真相 `docs/design/pipeline-software-plan-2026-08.md` + 细图 `docs/design/pipeline-orchestrator-spec-2026-08.md`。**排队中的后续**（重开时接着做）：P2 IDE 接入；小尾巴=冒烟⑥修复 spec 已写死（low·查 git 历史 grep 留验项）。红线不变：无特权通道·代签禁止·阶梯降级留痕。 -->

### REQ-SPECTRACE-条款追踪 · 策划细则→机器验收的追踪矩阵+守卫（无限更新循环） · [2026-08-04] · owner 令（复查不靠人看·按细则收工） → **图纸：`docs/design/spec-trace-blueprint-2026-08.md`** · status: **in-progress（V1 施工中·试点 game-c）** · 优先级: P1（客观复查线①） · 类型: 生产线基建（守卫+文档规约）
> 三件套=细则编号【R-游戏-序号】+追踪矩阵 spec-trace.json+四判守卫（未覆盖/死引用/过期/孤儿·bless 带证据）。**V1 ✅ Lead 终审 PASS**（`74236fddb`·试点首跑逮出两处真 spec/实现漂移·已开 REQ-C-116/117/118·判词全文查 git 历史）；**V2**（接 S4/S5 门+复查门+stale 自动开单）等试点周期反馈。
> **⚠ 漂移单路由铁律（owner 2026-08-05 明训·Lead 认领此前流程错误）**：守卫抓到的「**某游戏 spec 与该游戏实现不符**」= **该游戏自治范围**——**GD 裁规则口径、PE 补实现**，落该游戏 `docs/design/<game>/requests.md`，**不得上抛引擎需求池、也不得上抛 owner/主程**。此前 REQ-C-117 写成「等 owner/GD 裁」并被 Lead 念给 owner，是把游戏内部规则冲突升级成 owner 决策，属流程错误，已改直接指派 GD-C（owner 顺手裁了 A 案）。**只有一种例外才上引擎池**：漂移根因是**引擎缺能力**（游戏想按 spec 做但现有闭集表达不了）——那才是真缺口、走 Lead 评审下沉。V2 自动开单必须照此路由分流。

### REQ-RENDERCHECK-渲染裁判 · 渲染器当客观判定器：三探针进机器门 · [2026-08-04] · owner 令（「用渲染器直接判定」·连提两次=授权） → Lead 口径已出 · status: **R1/R2/R3 全 ✅ PASS；R2c ⚖ 已定案（owner 2026-08-05 授权 Lead 定）·①规约已落手册·②③排队** · 优先级: P1（客观复查线②） · 类型: 生产线基建（机器门加严）
> **R2a done**（`70b36bc8c`/`b92f90b8f`）：`render.ts` 20 处发 action 信号点位叠 `data-ui-id`（单控件=节点 id·复合子项 Table 行/Tabs 页签/VirtualList 行/ContextMenu 项=子项自身 id·Checkbox/Toggle/RadioGroup 隐藏 input 镜回外层节点 id）+ 既有 `data-action`/`data-arg`。**偏差**：spec 写 `data-action-arg`，落地用既有 `data-arg`（引擎已用此名·server.ts dispatch 读它·改名=真行为变更非机械叠加·未擅自拍板改名，据实报）。点名测试+既有 412 例 UI 测试全绿；game-g `__frames__` 3 份 golden 帧随附加属性重生成（逐字节核对=纯附加）。
> **R2b done**（同上两提交 + `c33437aa8`/`fb602ca78`）：`scripts/ui-walkthrough-probe.mjs`——真起服+真 Chromium 逐剧本 signal 步骤找活体 `[data-action]`(+arg) 真点击，报告 UI 可驱动率（不设阈值门·同 spec-trace human 占比先例）。补 launcher 域只读调试口 `window.__zcProbe`（dev-only·读 DOM 动作快照·不碰 sim/hash）。`game-pipeline.mjs` S4 门追加 `interpretUiWalkthrough`/`withUiWalkthroughGate`（exit 3=⚠不红·1=红·低可驱动率不判红）。测试 30 例+假信心自查（短路 `findMatchingAction` 恒真→6 例转红·复原绿）。**game-a 实跑**（8 剧本·退出码 0）：UI 可驱动率 **0/19（0.0%）**——诚实发现：验收剧本 signal 词表（薄适配契约 play/pass/play-round/…）与真 UI data-action 词表（menu.start/hand.toggle/…）不同源，多条 `play` 另因 `args.cards` 数组结构性非单击可表达；独立核证 `__zcProbe` 在菜单屏读到 5 条活体动作（非调试口坏了）。`expect` 断言步骤（26 条）本轮未核（仅读 DOM 动作清单·未读仿真世界态·据实标注·未越 launcher 域碰游戏内部状态）。
> **⚖ Lead 终审 R2（2026-08-05）：✅ PASS·带结构性发现**——独立复跑 30 测绿·render 22 处标签亲核·game-a 走查证据在档。两偏差照准：①属性名沿既有 `data-arg`（spec 手误·改名才是行为变更）；②调试口只出 DOM 动作清单不出世界状态（诚实最小·expect 标「未核」不造假）。**词表断层定性**：旧剧本=引擎信号词表·真 UI=另一词表→驱动率 0% 属实且管道无辜。**R2c ⚖ 定案（owner 2026-08-05「这个你来定」授权·Lead 裁）**：①新游戏剧本用 UI 词表书写=原生可驱动（GD 规约·手册回填）；②老游戏按需补「信号→UI 步骤映射表」（纯数据·不强制）；③世界状态核验=host 契约加可选调试收集器（引擎面小设计）。驱动率不门红=正确。status 改 R1/R3/R2 全 ✅·R2c 排队。
> **⚖ R2c 定案落地（2026-08-05）**：owner 明训升格为原则——「**做出来的东西必须和策划案完全一致**·策划案 review 时逐条对齐」。
> ①**已落制度**（本轮完成）：`docs/playbooks/game-production.md` 验收剧本循环律并入**词表对齐律**——剧本步骤名必须用真 UI 动作名（`data-action`）、禁用引擎内部信号名；策划案 review 逐条对齐「剧本步骤↔UI 动作↔规则条款」三者，对不上当场改、不留到施工后。
> ②老游戏映射表（信号→UI 步骤·纯数据·不强制）=按需做·排队。③世界态核验通道（host 契约加可选调试收集器，让探针能读仿真状态而非只读 DOM）=引擎面小设计·排队。
> **owner 自验计划**：owner 做新游戏时亲自走一遍这套（机器人已上岗），拿真实体验反馈再定 ②③ 优先级。
> **R1 冒烟 ✅ + R3 标准照 ✅ 双 Lead 终审 PASS**（`8d813d1a8`/`0e4937e11`·机器亲拍门证+基准照+漂移演示在案·判词全文查 git 历史）。

### REQ-DESIGNLINE-设计稿产线 · 策划需求→设计稿→落档定稿的自动流水（消灭手动搬运） · [2026-08-04] · owner 令（「现在都是手动来回上线·要自动打通」） → Lead 案（双轨）·排队等工坊面空闲 · status: **open（过渡轨排队：等沉浸模式落地防撞·主轨试产随后）** · 优先级: P1 · 类型: 生产线基建（PST 域+编排器扩展）
> **过渡轨 ✅ Lead 终审 PASS**（`6ef243086`·需求单一键复制+收稿箱+定稿人门·判词全文查 git 历史）；**主轨**（编排器扩设计会话·无头+设计技能包→.dc.html 直落档）等 owner 试产一屏亲比后定夺全切。

<!-- REQ-MATRIXDUEL-同时决策矩阵（P1·game108 带出）已完结：t2-matrix-duel 落地·Lead 终审 PASS（5bfa84f48·裁决与偏差全文查 git 历史）。后续 payoff 缩放扩写=REQ-108-ENG-01，因 10 硬槽已满而降级放 docs/design/game108/requests.md（不占槽·Lead 已裁·待派工）。 -->


<!-- REQ-CYCLEHAZ-定序成环（P1）已完结：B 止血落地 887c410f7·Lead 终审 PASS（全文查 git 历史）；后置不占槽：B.2 SCC 棘轮（low）+ C 相位化（xhigh·等剧情线实战反馈）——要做时重开。 -->

<!-- REQ-ARTPIPE2-美术管线二期（P1·owner 令）整案已完结：A1 台账守卫+棘轮（无账不录入·新增黑户拦推送）→ A2 三栏资产浏览器（徽标/拖入自动登记）→ A3 git 历史回滚 → A4 替换工作流+消费方反查，四翼全 Lead 终审 PASS（判词全文查 git 历史 grep ARTPIPE2）。后置不占槽尾巴：①studio 旧 AssetLibrary 退役（功能对等已达·退役时清解耦白名单 3 条+approve 端点 note 转服务端强制）②game-z 裸路径 1 处（无 requests 文件·随 P3D 线记）③裸路径三单已落 A-027/B-015/REQ-I-裸路径收编。 -->

### REQ-ENGINEAUDIT-引擎全量评审落地 · 15 子系统深审（110+ 发现）· [2026-08-04] · owner 令 → **报告=唯一真相 `docs/design/engine-review-2026-08-04.md`** · status: **in-progress（P0 + 21 处已修推·门禁全绿；余 3 项见下）** · 优先级: P1（P0 已清·降档） · 类型: 引擎质量总账
> **已修并推（Lead·全部「先实证复现→修→撤修复验红」）**：批0 确定性护栏/注入面/voxel 崩溃 13 处（`0031b950d`/`3b8e2757c`/`29cf511ba`）→ **P0 lockstep 加入死锁**（`ce3903c1`·输入按 epoch 缓存·实测 A 停 2×inputDelay/B 停 inputDelay）→ 存档装配批（envelope checksum 覆盖持久化形态 · save 读档校验 fail-closed · manifest `__proto__` 拒收）→ sim 正确性批（card-pile 空出牌 · effect-apply NaN/mul 清零 · friction/ground-sense 漏过滤 Sensor=二段跳 · merge-on-place 撞名硬崩 · matrix-duel ≥3 死锁）→ owner 四裁（共用组件推断不猜+守卫 · 快照带创建序 · TS 卡带执行侧闸门）→ Sprite.anchor 真消费。
> **余下 3 项（待 owner 分配）**：①**根因① reads/writes 申报对账守卫 + §3.1 补齐组 13 处**（引擎定序契约批改·Lead 判定须独立专项·CYCLEHAZ B 已解锁）②**根因② 运行时组件全集基准**（扩 `build-component-map.mjs`·解锁 NON_DETERMINISTIC 对账+装配校验+catalog 共用）③**Q1 消费路径**（dump-catalog 分档 + capgap 断链 + audit 进推送门 + pick-list 决策树·多为低成本小活）。
> **已转派/已裁**：UI 契约批→PUI（已完结）· 渲染专项→P3D（`REQ-3D-RENDERHYG` 在 3D 池）· **根因④ 受信执行环境→owner 2026-08-05 令搁置**（未理解·待重讲后再定）。

<!-- REQ-UICONTRACT-UI 契约批（P1·引擎评审 §6⑨）已完结：PUI 三条（modalClose/comboClick 补 ActionSink 回退 · 键控锚点改 firstContentAnchor · 动效扫描抽 initDynamics 幂等且 mount/update 各扫一次）+ Lead item④（Sprite.anchorX/Y 抽 spriteAnchorOffset 纯函数真消费）全部落地。Lead 对抗性验收 PASS：6 例守卫独立复跑绿·撤 update 侧 initDynamics 实测转红 2 例·撤 item④ 修复转红 2 例。P2/P3 尾巴（bindings 不递归 node props / layout-solver 忽略 cols / typewriter+emoji 掉字 / apollo-kit 像素字体退化 / onboarding 缩放错位…）按报告 §5 原文另清·不占槽。全文查 git 历史。 -->

<!-- REQ-STATUSSET-资源见底置状态位（game107 带出）→ **owner 2026-08-05 令废除出池**：107 尚未开工·无现役游戏被阻塞·不该占引擎硬槽。**spec 原文完整降级存 `docs/design/game107/requests.md`**（不占槽），107 真开工时先按核心规则重核「能否用现有闭集重组」再决定升回。 -->

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
