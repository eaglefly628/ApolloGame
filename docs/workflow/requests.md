# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停·**编号唯一：开单前 grep 同名防重号**——2026-08-08 game108 GD-01 重号复盘）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-PUI-ANIM-CONTINUITY · 布局更新不得反复重启无关子树动画 · [2026-10-26] · owner iOS试玩反馈 · 指派：PUI · 施工主体：待抢锁 · status: open · P1 · 类型: 既有UI更新行为修复
> 实证：game108掉血震屏改变duel-screen根layout，server.ts更新用outerHTML替换整树；真实Chrome约100ms内根替换7次、每次160后代，内部260ms apollo-pop对应重启7次。两游戏rAF中位/p95仍约16.7ms，不可把此问题归给模拟器。完整步骤/原始探针：docs/design/ios-animation-diagnosis-2026-10-26.md。
> 验收：同类型/同id的可变布局/props更新应保留不受影响子树与动画连续性，输入handler不重复；父锚点、结构性替换、卸载与旧控件行为不回退；真实浏览器+至少两处锚点验红+相关/全量门禁+check-ui。边界src/ui/**及本域测试/手册，游戏量化问题另交game108维护方；不在本单重造UI框架。

<!-- REQ-3D-RENDER-BIND：owner 2026-10-26 判A，P3D/本聊天抢锁；共享3D协议、component-map/registry与NON_DETERMINISTIC登记在本单授权面，主程已知会；正文见requests-3d.md。不新增sim能力或改hash算法。 -->

### REQ-112-UI-12 · 通用原生分层角色 LayoutNode 控件 · [2026-10-21] · owner 判 A · **施工主体 = PUI（game112 聊天委派 `pui_native_ui` · 本行即锁）** · status: in-progress（0700fd787已锁，实现完成，独立复查与目标GPU验收中） · P1
- **真人判词**：「A：补通用控件，由 PUI 施工（推荐）」。复用已有 `mountNativeCharacter`，不实施 Game112 专用 iframe 例外；不扩 sim/确定性能力。
- **实查 / A/B / 验收**：`docs/design/game112/requests.md` 同号单。现有 `ComponentType`/`ImageProps`/catalog 无原生模型消费者，Image 的 sprite/meshMotion 不能解 `.stretch`。
- **写死边界**：PUI 只改 `src/ui/**`、`games/game-i/**`、UI 手册及本域测试；提供闭集数据控件、catalog/validate、同源播放器装载、静态 poster 回退、重载/卸载及命中透传。不得改引擎端口、sim、工作台 vendor 或其它游戏；Game112 消费/发行运行时由本聊天分别负责。
- **交付**：手册+活范例+正反测试（含超时/坏资源/过期异步/更新不重建/销毁）、独立复跑/锚点验红及真实游戏验收。只提交代码和小数据，候选美术不进 Git；复查人≠施工人。共享 `server/types/catalog` 合并必须保留同期 parent-anchor 工作，不擅修或撤掉它。

<!-- REQ-MOBILE-SHELL 已按 owner 2026-10-26 授权完成通用 iOS 发布能力，独立复查与边界见 docs/design/ios-publish-review-2026-10-26.md；真实设备/签名/Apple 后台条件缺席时发行门仍 blocked。旧暂停记录查 git 历史。 -->

<!-- REQ-P3TAIL（架构路线图 P3 收尾（M1 施工中·M2–M4 未开））owner 2026-10-16 令**暂停出池**（引擎进入新阶段·需求池清理）——全文查 git 历史（git log -S REQ-P3TAIL）·重启时恢复原文 -->

<!-- REQ-AUTOSAVE-任务收工自动存档（P1·owner 2026-08-10 令「跑完的结果就没了·希望它主动去上传」）**2026-08-19 全件完结出池**：
     本体（bf820b37）先本地提交→跑门禁→绿了才推·挂 art_jobs 收工与编排器子进程退出两处·features.autoPush 开关·
     「📦 产物落点」卡回答「在哪/存住没」。主程复查 PASS（2026-08-18·四轮 sabotage 三咬一漏）+ syncSmoke 越界追认成立。
     **余项 F1/F2 已清（PST·2026-08-19）**：F1=补落点腿 ⑩–⑬（detect_form 判序 / 三形态落点全集·docs/design 每档必在列 /
     状态端点逐处分摊 + 卡带行报自有仓 / 拒绝路径），冒烟 25→52 腿，**复现主程那一刀（砍掉 docs/design 整类）实测 7 腿转红**、
     形态判序颠倒 ⑩ 转红；顺手删掉那句不实的「另测」注释。F2=`_dirty` 的 git 失败分支改为**留痕再降级**
     （空列表在上游读作「无产物·跳过」，与「真的干净」同形，不喊一声就是一次静默的白跑）。图纸
     auto-artifact-sync-2026-08（图纸已随 2026-08-24 清理删除）。判词与全文查 git 历史 grep REQ-AUTOSAVE。 -->

<!-- REQ-DOKI-APPS-「获取卡带」下沉共享接线层（P1·owner 2026-08-15 令）**2026-08-18 全件完结出池·主程双路独立复查 PASS**：
     ① 共享层 dokiworld/shared/ apps-gateway（8433c8e3·抢锁 session）：createAppsGateway 带超时/降级/dispose 薄适配 + appsDeclared；9 测不 mock SDK（真 createAppsHostExtension 对端）。复查实证：launch 缺省超时真 1 小时（apps.js:14）·「未声明就不发」快速拒绝非等超时（1.5ms 即红）·reasonOf 只读 error.code 顺带消解双份 SDK dual-package 隐患·通用性成立（src 零 game108 字样）。
     ② game108 结算屏消费（3801e35a·owner 判「结算屏加入口”）：setAppPicks/onAppPick 宿主缝 + 推荐位 LayoutNode（空则整条不画——复查以提交两侧 buildDuelScreen 全量倾印逐字节相同机器证明「非 DokiWorld 宿主逐像素同旧版」）+ manifest 五步一致（EXTENSIONS 单一真相）+ 投影⑤只收能真拉起的（input contract 缺则不画留痕）；render-only 亲测=picks 翻转三跑 hash 流逐拍相同；SDK 别名只打进一份（唯一字面量各恰 1 次）；顺手复活 witness leg④（клickStart「#phase-t 出现」在说明屏下恒真的假绿→改「世界动作真出现」·复查探针 6/6 坐实根因）。witness 终态 PASS=50 FAIL=0。
     ③ 后续①（dokiworld 测试接门）主程随 GUARDGATE 落·两处手册过期口径已更正。三轮+三轮撤修验红各恰中。全文查 git 历史。 -->

<!-- REQ-S18PANEL-开发面板补 S1–S8 八关（P1·owner 2026-08-16 令「都要有按钮·不能采用老路子」）**2026-08-18 全件完结出池**：
     ① 存为项目（Lead 施工·50804eb1·终审 PASS）：POST /api/projects + gaps 七键归一 + 对话认领关浏览器不丢 + 工坊「💾 存为项目」钮。
     ② S2 机器缺口门 + ③ canEnter 认缺口（抢锁 session 施工·48817307 + 修复 67893d49 + route 对齐 828ce031）：capability-gaps.json 台账（四闭集·三纯函数）·S2.gate=gap-check 与 board 同一只嘴·orderGate 缺口锁·board 带 blockedBy/gaps/gapErrors。首轮独立复查 FAIL（三条判据外实测伤：编排器真回归/越界门/缺口锁 fail-open→gapsHash）全修后**再复查 PASS**（复查人≠施工人·五轮 sabotage 恰中·验收原话端到端复现·跨侧 route 活体对账·零回归=状态/退出码/指纹全等）。
     交回主程两件已落：armed 日志空数组假话一行修；「慢车道点名补跑」面 Lead 裁 **B 案**落地=scripts/slow-lane-guard.mjs 警告态基线棘轮（新红硬拦·在案红响亮放行·转绿逼降基线）+ scoped-gate slowLane 面触发 + 与 vite.config DEEP_GLOBS 对账锚测试——同批 Lead 裁掉 audit-ratchet 两条存量红（game102/game211 HARDLINE 基线亲批入册·两单结案），慢车道基线仅剩 acceptance 一条（REQ-G102-ADAPTER 等 GD 改剧本 schema 在案）。
     再复查四条非阻断（S2 文本行后缀≠逐字节/编排器陈旧注释/提交语措辞/gaps 展示层小疵）记档不阻。全文查 git 历史。 -->

<!-- REQ-DIALOGUE-剧情基础线（P1·owner 令·转型关键路径）→ **2026-08-16 关闭出池**（不占槽·同 PIPESOFT/SPECTRACE/RENDERCHECK 先例：下一步触发者不在池内）：**M1–M4 四件全 ✅ Lead 对抗性验收毕**（2026-08-10·22 例独立复跑绿 + 双破坏锚点命中：撤 neutral 降级锚→恰 3 红、撤 weight 语义→加权测红；game-i 展台 audit + 棘轮 PASS）。**余项 = M4 Sample 示范游戏**，owner 已定与「亲测约会游戏试点」合流 ⇒ **触发者 = owner 本人**，挂池子里只会占槽空等。图纸唯一真相仍在 `docs/design/dialogue-line-blueprint-2026-08.md`（派工时照它）；四件的落点与判词全文查 git 历史 grep REQ-DIALOGUE。**owner 跑完试点带回反馈即重开本条。** -->

<!-- REQ-ENGINEAUDIT-引擎全量评审落地（P1·owner 2026-08-04 令·15 子系统 110+ 发现·报告=docs/design/engine-review-2026-08-04.md）**2026-08-16 全项完结出池**：P0+21 处早批已推（批0 确定性/lockstep 加入死锁 ce3903c1/存档装配/sim 正确性/owner 四裁/Sprite.anchor·全文查历史）；根因② 组件全集基准 e8a0b02c3；Q1 audit 进门+棘轮。**根因①（最后一项）两半件均主程施工+独立复查 agent PASS**：
     (a) op:'set' 专项（98576a9b·owner 判 C）——ResourceModify 加 op:'set'|'add'（缺省 add 存量零变·词表对齐 FlowAction/Effect），resource-apply 接 set+queueResourceMod 合并规则；matrix-duel 清零搬回结算拍（set 载体·同拍原子·旧「槽被占静默漏拍」面消失·复查还实证旧实现连拍结算读陈旧蓄力的潜伏 bug 被顺手治愈），settle 诚实申报读 Resource+撤背书断言，不成环=显式 runsBefore ['resource-apply','self-rule'] 压反向软边（规则③）+定序测试连成环 warn 断言为零。复查全库 4645 例复跑·四轮 sabotage 恰中。
     (b) 对账守卫收口（08b41d9d）——declaration-audit.test.ts 两道防线：①文件字面组件访问 ⊆ 同文件**系统级**申报并集（聚合级只算文档·首日逮 9 处真瞒报全数诚实化：resource-apply 读 PrefabOrigin=SPENDONFIRE 同病·hitbox 读 PrefabOrigin/Transform·prefab 写 PrefabOrigin/HexPos·navmesh-bake 读 NavAgent·anim-state/caster 读 Relation·collision-resolve 读 Sensor）②全库 SCC 点名棘轮（多环红少环也红·禁静默漂移）。诚实申报闭合的新真环用 prefab-spawn「展开殿后」runsAfter 十连钉死=各环平局裁决现状序（复查方 dump 8 游戏落序前后逐字节相同=零行为变化）；**全库环告警 63（晨）→0**；game102 三剧本/game-103 缺 adapter 存量红经修改前 HEAD 隔离对照坐实零新伤。复查两条非阻断建议（keybind 切片锚定/docblock 数字）已同批清。
     余档：~~A 诚实申报~~/~~B 记债~~ 三选项与判词全文查 git 历史及 docs/design/game108/review/REQ-108-ENG-04-05-06.md；「运行时探针对账」（变量传入组件名的下一级覆盖）=守卫文件头在案的声明性局限，真撞到再立单。已转派：UI 契约批→PUI 完结·渲染专项→3D 池 REQ-3D-RENDERHYG。**根因④ 受信执行环境→owner 2026-08-05 令搁置（未理解·待重讲后再定·此行保活）**。 -->

<!-- REQ-UICONTRACT-UI 契约批（P1·引擎评审 §6⑨）已完结：PUI 三条（modalClose/comboClick 补 ActionSink 回退 · 键控锚点改 firstContentAnchor · 动效扫描抽 initDynamics 幂等且 mount/update 各扫一次）+ Lead item④（Sprite.anchorX/Y 抽 spriteAnchorOffset 纯函数真消费）全部落地。Lead 对抗性验收 PASS：6 例守卫独立复跑绿·撤 update 侧 initDynamics 实测转红 2 例·撤 item④ 修复转红 2 例。P2/P3 尾巴（bindings 不递归 node props / layout-solver 忽略 cols / typewriter+emoji 掉字 / apollo-kit 像素字体退化 / onboarding 缩放错位…）按报告 §5 原文另清·不占槽。全文查 git 历史。 -->

<!-- REQ-STATUSSET-资源见底置状态位（game107 带出）→ **owner 2026-08-05 令废除出池**：107 尚未开工·无现役游戏被阻塞·不该占引擎硬槽。**spec 原文完整降级存 `docs/design/game107/requests.md`**（不占槽），107 真开工时先按核心规则重核「能否用现有闭集重组」再决定升回。 -->

<!-- REQ-CARTART-卡带美术存储归位（P1·PST 提·owner 选方案 b-full）→ **2026-08-06 Lead 追认越界·结案出池**：两处跨域改动（`scripts/art-replace.mjs` 写盘落点 + `scripts/art-ledger-guard.mjs` 发现口径/台账根）**均予追认**——改法正确（都收敛到单一真相 `artRoot`，没有另起一套口径）、面最小、与 Python 侧 `paths.py::art_root` 同源。**追认时实证撞出并已修一处真 bug**：`art-replace.mjs` `fill` 的「无台账」错误分支把 `ROOT` 写成了 `root`（`run()` 内无该绑定）→ 撞上无台账的游戏不是干净报错退出而是 **ReferenceError 崩栈**；已修 + 补 2 例子进程 CLI 守卫（原 47 例单测全走导出函数，够不着 CLI 分支）·撤修复实测转红 1 例。复验：cartridge-art-smoke 18/18 · art-ledger-guard WARN(exit 2·gate allowExit 内·两条死账为既有存量) · scoped-gate scope=full 全绿。**留尾不占槽**：①`pipeline.json` 仍落 `public/games/<slug>/`（不在 art/ 下·消费方是生产板另一条线）②JS `artRoot` 用 `existsSync` 而 Py `art_root` 用 `.is_dir()`——`library/<slug>` 若是文件则两边分叉；判定不可达（需手工在 library 下造同名文件），记债不修。图纸全文 `docs/design/cartridge-art-storage-2026-08.md`。 -->

<!-- REQ-ARTGUARD-黑户判据认索引记账（P2·PST 提）已完结：判据②落地——art/index.json path 命中且有来源登记（provenance 对象 或 license+source 双齐）即免黑户·原判据①/死账/SKIP 前缀不动。黑户 65→5（非预期 3：施工方逐条实查证明「62 有登记」是算术不是核实，真有登记 60；差的 2 张 game-a 程序化桌面 SVG 真无账——施工方拒绝代写游戏账本凑数=正确，Lead 认可基线留 2 并开 A-028 归 game-a PE 清账）。Lead 终审 PASS：20 测独立复跑绿·施工方双验红（撤并集行→55 张扑克回黑+FAIL 退 1·撤登记检查→3 例红）·Lead 第三轮破坏（双齐弱化为只查 license→恰边界测红）。尾巴：gen/mock 入 SKIP 前缀未裁——唯一现行例证 game-a art-03 死账已在 A-026,随那单处理,守卫不预扩。全文查 git 历史。 -->


<!-- REQ-NETGAPS（P2·测试护栏·指派主程）已完结（2026-08-27·施工=Lead 本 session·owner 2026-08-26「约束和补全所有用例」令下并批·净测试零行为变）：① AdversarialBus（批内倒序+每 3 条压后一轮）40 轮 → 双端零 desync·synced·tick>20·逐端同 tick 同 hash（lockstep-tab.test.ts）；② C1-C4 成员抖动产 5 桶 > MAX_INPUT_EPOCHS=4 + 离场超时（PEER_TIMEOUT 拍数推满）→ 幸存端仍推进仍 synced，epoch 序列锚点数组钉死；③ 盲区 canary（net.test.ts）：同内容异创建序双世界 snapshotOrder 不等而 hashSnapshot 相等——钉死声明 lockstep 对 order 盲，并 order 属设计变更另议（未立单·真要并入时对 hashWithOrder 先例）。两处撤修验红均锚点命中（①改推进断言红「expected 3 to be greater than 20」·②锚点数组红）。全文查 git 历史。 -->

<!-- REQ-S3CLICK（骨架关「点击打穿」机器门（复查 FAIL 后自 08-16 停滞））owner 2026-10-16 令**暂停出池**（引擎进入新阶段·需求池清理）——全文查 git 历史（git log -S REQ-S3CLICK）·重启时恢复原文 -->

<!-- REQ-108-ENG-07（我 2026-08-08 开的「全局条件→扣指定一侧血」引擎缺口单）**已撤销·不占槽**：
     ① 编号撞车——该号早被「结算门下的 intent 生命周期」占用（我开单时只 grep 了本文件，没扫 gdd.md）；
     ② 举证经主程实查**证伪**并回驳 wontfix——`t2-self-rule` 的 `whenGlobal`（全局 id 求值）+ `do`（施于自身）
        两头都有，等价数据写法与证明测试见 `src/skills/tier2/self-rule.test.ts`「罚血形态·回驳证明」3 例。
     2026-08-08 已按该写法接线完成（game108 罚血真扣血·验收剧本 12/12 绿）。全文查 git 历史与
     `docs/design/game108/requests.md` 的回驳单。**教训：开单编号前扫全套 docs/design/<game>/*.md，不只扫 requests。** -->

<!-- REQ-UIFX-2D 表现件补齐（P1·owner 2026-08-08 令·game108 设计定稿 v3 带出）已完结：A `Particles` 对位 Vfx3D 全轴扩写（color/colorGradient/size 分档/shape:'cone'+coneAngle/flyTo 复用 AnchorRef/trail{segments,width,fade,blend}/gravity/drag/stagger·particleSimSpec/particleSize 纯函数·rAF 胶水 render-only）+ B `ProgressBar shape:'liquid'`（radius 按盒裁·fillColor·错频双脊+slosh·气泡）+ ⑤ Label.tween 字号缩放与 anim:'tick' 节拍一并做。顺手真修四处审计基建假绿（gallery 六入口 buildGallery 参数漂移崩且 exit 0／ui-audit 对 display:none 祖先量幻影对比度／Badge tone undefined／sectionTitle dim→sub）。Lead 终审 PASS：16 例独立复跑绿·施工方三轮验红（R1 stagger/R2 slosh/R3 scale 胶水）·Lead 第四轮 sabotage（particleSize 缺省档拍平→恰中 `expected 8 to be 12`）。存量债（tab3dui 35 处硬对比·tab-new 未入审计）归 PUI 主 session 立单；game108 侧接入（粒子替换/烤水面换液面件·S5 偏差 #1/#2 届时划掉）归 game108 自治。全文查 git 历史。 -->

<!-- REQ-WAITUNTIL-验收剧本条件等待（P1·owner 2026-08-09 判 A·game108 复盘第五缺口）已完结：剧本步骤加 `{"waitUntil":[断言…],cap:N}`——断言复用 expect 闭集零新词表·先查后拍·封顶 FAIL 带已等拍数·waitedTicks 入 trace（同 seed 同轨连它一起比）·裸 tick 仍合法。主程施工（🔴 共享 harness）：schema+runner+13 例守卫·深车道点名跑绿（37 过·2 红=game-103 缺 adapter+game102 剧本漂移，经 HEAD 隔离 worktree 复跑坐实为存量且各有在案工单）·双撤修验红锚点命中（AND 语义反转→「多断言 AND 语义」红·撤 cap 校验→「cap 必填」红）。手册口径入 testing.md 验收剧本节；game108 迁移=REQ-108-GD-03（游戏自治·非强制）。spec 与判词全文查 git 历史。 -->

<!-- REQ-DEEPREVIEW-引擎底层深审战役（P1·owner 2026-08-10 令三轨全选）已完结：四路证据全回·Lead 终审毕。**体检报告全文 = `docs/design/engine-deep-review-2026-08.md` 体检结果节**（实证护住 6 面 / 裸奔 6 项已开单：REQ-GUARDGATE/DESYNC/SAVEORDER+根因① spec 扩充+3D 池 G211 单 / 记债 5 笔附理由）。战果：根因② 全集基准合入 e8a0b02c3（A1 探针当验收对照·当日闭环幽灵名裸奔）；RandomSeed.sequence NaN 潜伏 bug 直接修（撤修验红在案）；108 变更 38 笔逐笔过账体系判定=转的。余下施工挂 REQ-ENGINEAUDIT（根因①主程/Q1 已派）。 -->

<!-- REQ-DESYNC-lockstep 分歧要大声（P1·深审 A2①）已完结（53bc35ac·主程施工+独立复查 agent PASS·复查人≠施工人）：三态 syncState solo/pending/synced/desynced（缺可比数据不再默认 true·synced 须真实可比拍背书）+ 双判定点（stepTo 补拍侧 + onMessage 收报侧=领先端盲区正解）+ 首诊 console.error 一声 + onDesync 事件（每 epoch 一次·红牌不摘）+ HUD 分叉/对齐分画。施工方三轮验红（撤三态/撤收报比对/撤一次性守卫）+ 复查方自选三轮（撤本端留存恰红 2·撤 epoch 过滤恰红 1·撤 epoch 清零双重锁死）全恰中锚点；复查建议已采纳=点名用例改「健康跑过热身期后中途篡改」确保真走盲区路径（撤收报比对现恰咬它）。确定性面零沾染（复查 diff 全扫实证）。存量备注：epoch key 无代数的在途报文别名窗口=既有机制特性非本单回归。全文查 git 历史。 -->

<!-- REQ-SAVEORDER-存档 order 入指纹 fail-closed（P2·深审 A2②）已完结（fd062871·主程施工+独立复查 agent PASS·复查人≠施工人）：meta.hash=hashWithOrder(snapshot,order)（determinism.ts 单一真相·order 缺席严格退化 hashSnapshot=旧档语义不变）——反转/增删/整段剥除一律 CorruptSaveError；并入主 hash 而非旁挂指纹=剥除攻击封死（复查实证承重）。旧档兼容真（手工构造旧格式读通·键序退回语义实读确认）；envelope 不动成立（checksum 覆盖整 blob·不经手 snapshotOrder）；meta.hash 全库无活世界对表消费方。施工方两轮验红+复查方三轮（完整双侧复原恰红 2·撤 JSON.stringify 构造出裸拼碰撞样本证其承重·撤 restore 传参存活→行为面缺口已补一条混排 id 回环断言 query 序）。记档：canonical entityId/字段名裸拼的既有碰撞面被继承（威胁模型外·防损坏非认证）。全文查 git 历史。 -->

<!-- REQ-GUARDGATE-引擎面守卫接线批（P1·深审带出）已完结：① engine-random-guard 新守卫（引擎五目录非测试面禁裸 Math.random·白名单 2 条各附实查理由:atoms/random 法定点+mp-client peerId 信道身份非 sim 随机）② loop-stop [time-wait] 修红（假钟接管·断言未削·反序验红实证）+ hygiene 接门 ③ art-replace-smoke 纳门（美术面触发）——全走新 facesOf 面触发机制（改哪面跑哪守卫·不给无关改动加时长）。Lead 终审 PASS：33 测独立复跑绿·施工方三轮验红（种样本恰咬 matrix-duel:257/回退恰红 [time-wait]/清 FACE_GUARDS 恰 3 红）·Lead 第四轮（杀 testHygiene 旗→恰 4 红）。**Lead 顺手叠了 DOKI-APPS 后续①**：dokiworld/** 测试接门（facesOf.dokiApps + doki-app-test runner·真跑 33 条 app 测·撤注入恰锚点红）。全文查 git 历史。 -->


<!-- REQ-ARTPROMPT-提示词编辑被忽略（P1·PST 复查带出+owner 精简合并）已完结：职责拆分铁律落死——query=身份键（界面编辑永不写·rowIdentity 零改动）·prompt=生效主体（任何界面改词一律写它·null 显式清除）；全部改词入口 trace 换链（studio 面板/工坊详情卡/CLI --prompt 正名·--query 旧名兼容）；owner 精简同办：主体 prompt>query>desc（仅兜 query 空·实测 631 活行零 cacheKey 漂移零重生成扣费·122 行空 query 行为逐字节不变→全量生效不留双轨）。Lead 终审 PASS：67+47 独立复跑绿·施工方三轮验红（塞回 query→6 红含身份污染锚/撤精简→恰 2 色值红/撤预填→恰 2 红）·Lead 第四轮（null 不清除→恰点名红）·顺手补 artbrowser.py prompt 回带一行。施工方自曝一次 stash 误操作已复原并披露（诚实合格）。全文查 git 历史。 -->


<!-- REQ-DOKIPACK-DokiWorld 出包线（P1·owner 2026-08-12 令「以后产物都往这里打包」）首件已完结出池：手册 docs/playbooks/dokiworld-pack.md + 规范快照 docs/design/dokiworld/ 在档=常备产线；game108 首包 ✅ Lead 终审 PASS——dokiworld/game108/（manifest 生成器§5 逐条校验·SDK 薄接线零规则·toGameResult 纯函数=血差线性投影与验收剧本同口径·12 测独立复跑绿·施工方 outcome 反转验红+Lead 钳位破坏恰中边界测·无宿主等待屏与 createAppHost 真握手挂载双目击截图在档）。game108 加 setWorldObserver 只读观察口（照 setCard 形态·render-only）。**下一步触发者=owner**：整目录复制/PR 到 dokiworld-apps 仓 + 真宿主跑一遍（§12 末项·本仓无那边推送权）。**记债**：引擎两条站点绝对资产约定（/games/<slug>/art·/ui-fonts）在 iframe 子路径下逃包，现由打包层改写+复制资产兜住——「资产 URL 基准可配置」是引擎缺口候选,下个游戏出包再撞就立单下沉。后续游戏照手册,World 形态等首个剧情向产物。 -->

<!-- REQ-PIPELINE-GUARDS（流程板规则加机器牙齿·六项）owner 2026-10-16 令**移除出池**——其中①「人门只收真人签字」并入 REQ-AIFLOW-GATES；其余五项全文查 git 历史（git log -S REQ-PIPELINE-GUARDS） -->

<!-- REQ-AIFLOW-GROUND：独立复查通过，判词40d205fb9；施工5a6a7ed4b（2026-10-20）。按完工清池规则移出，全文查git历史。 -->

<!-- REQ-AIFLOW-SCENELOAD：独立复查通过，判词08ba7e0ac；施工955826af4。按完工清池规则移出，全文查git历史。 -->

### REQ-AIFLOW-SPLIT-3D · 拆层单进 3D：资产类型按行声明 · build 行不进出图台账 · [2026-10-23] · Lead 立（game628 定 3D 后实查带出·属已裁 A 的 REQ-AIFLOW-SPLIT 范围内修补·🟢） · **施工主体 = Codex（2026-10-23·本行即锁）** · 复查 = 另派 · status: 返工已交·待独立复查（Claude·SP1·2026-10-25） · P1 · 类型: 工具链扩写
> 实查：`scripts/asset-split.mjs` 推导台账时 `kind` 写死 `'sprite'`；`art-replace` 按 kind 选供应商（`model3d` → tripo/meshy，其余 → 2D 生图），故 3D 项目里 `route:generate/character` 的道具 / 人物会被当成 2D 图批量出图；`route:build` 行由 T7 `blender-job` 用图元搭建（`checkSplit` 要求 build 行 source 为 primitive），不该进出图台账。
> 要做：拆层行加可选字段 `asset: 'sprite' | 'model3d'`（缺省 sprite，旧拆层单不变）；`model3d` 行推导为 `kind:'model3d'`；`route:build` 行不进台账（打 skip 日志）；`blender-job` 校验口径不变。验收：3D 道具行进台账为 model3d 且 art-replace 选 tripo；build 行不进台账；旧拆层单推导结果逐字节不变；撤修验红。

### GAP-AIFLOW-REFS · 拆层行按关键图切图并作参考图喂给生成 · [2026-10-24] · Lead 实查带出（缺口复盘） · **⚖ 待 owner 判 A/B** · 施工主体：待裁 · status: open · P1 · 类型: 工具链扩写（🟢 仅 `scripts/`）
> 实查：`asset-split` 不切图（全仓 `crop` 零命中）；`art-replace::genRowAsset` 只把文字提示词交适配器，拆层行 `refs` 在生成路径零引用，所以 3D 道具只能文生、跟关键图脱节。A = bbox 确定性切图 + 台账带切图路径 + model3d 走 Tripo 单图、sprite 走 GPT Image 2.5 输入图（provenance 记 SHA）；B = 人工逐行 `ai-gen --ref` 再手动回写。**Lead 推荐 A**。全文：`docs/design/ai-pipeline/gap-review-2026-10-24.md` §二。

### REQ-MOTION-M2 · 动画库入库与目录（FBX → 标准骨架 GLB · 自动测量 · 闭集标签） · [2026-10-27] · owner 判 A · 🟢 工具链 · **施工主体 = Codex（2026-10-27·本行即锁）** · status: in-progress（108 角色及 2445 动画下载已核验） · P1
> spec：`docs/workflow/handoff-codex-motion-line.md` ■ M2；字段与词表：流程图 §2。

### REQ-MOTION-M3 · 动画预览台（Skin × 动作网格） · [2026-10-27] · owner 判 A · 🟢 工具 · **施工主体 = Codex（2026-10-27·本行即锁）** · status: in-progress（依赖 M1 PASS、M2） · P2
> spec：派工单 ■ M3。

### REQ-MOTION-M4 · 演绎内容动作匹配（确定性检索 + skill） · [2026-10-27] · owner 判 A · 🟢 工具 + skill · **施工主体 = Codex（2026-10-27·本行即锁）** · status: in-progress（依赖 M2） · P1
> spec：派工单 ■ M4。

### REQ-MOTION-M5 · 动画库扩展（Mixamo 滑杆变体 · 带皮角色下载 · 裁剪/镜像/补循环 · 其它来源） · [2026-10-27] · owner 判 A · 🟢 工具扩写 · **施工主体 = Codex（2026-10-27·本行即锁）** · status: in-progress（依赖 M2） · P2
> spec：派工单 ■ M5。

### GAP-MOTION-M6 · 补全动作烘焙入库（基础动作 + IK + 挂点 → 新动作 GLB） · [2026-10-28] · owner 提（擦火柴等库中缺失动作） · **owner 本会话判 A** · **施工主体 = Codex（2026-10-27·本行即锁）** · status: in-progress · P1 · 类型: 工具链（🟢）
> 实查：运行时补全可由 M4 选最近动作 + `Attach3D` + `IK3D`（权重读动作图 flag）+ 时间线重组，**不报缺口**；但 IK 只在渲染时生效，无工具把结果烘焙成新动作，补出来的动作进不了库。A = `motion-library compose` 用引擎同一套动画 / IK 代码逐帧求解烘焙入库；B = 每个游戏运行时自拼。**Lead 推荐 A**。全文：`docs/design/ai-pipeline/motion-completion.md`。

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
