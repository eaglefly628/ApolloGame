# REQ-3D-ENV-LIFECYCLE · 既有天空/环境资源修复交付导航

> 施工主体：Codex；分段锁f5cf0b166（2026-10-21）。本单只修已有资源所有权，来自V1真实反例；不改V1冻结数据，不签真人门，不自判PASS。独立复查方仍须自己复跑/撤修/实证/读告警。

## 做了什么

按既有disposeMesh与three原生对象的所有权，修复天空map重复释放、PMREM输出RT丢失、临时Room InstancedMesh矩阵buffer未释放，以及HDR替换/回退的旧结果与临时eq/generator清理。实际environment UUID/强度及完整skySig纳入既有跳渲签名，兑现迟到贴图、云开关和云色更新；静止缓存命中继续skip。组件协议、sim、游戏与PUI不变，不重开旧暂停效率工单。所有权与失败边界见 `docs/design/ai-pipeline/environment-lifecycle.md`。

## 改动面

`src/renderer/three-renderer.ts`、`src/renderer/three/environment-lifecycle.test.ts`；`scripts/verify-environment-lifecycle-browser.mjs`、`scripts/fixtures/environment-lifecycle/browser-probe.mjs`；本页、所有权契约、3D手册一行与本单状态。

## 怎么自己验

1. `npx vitest run src/renderer/three/environment-lifecycle.test.ts src/renderer/three/camera-rig.test.ts`：ENV11+既有Camera25，36/36退出0；独立执行tsc与两文件ESLint均0。普通测试不需Chrome、Blender、网络或凭据。
2. ENV11逐条：天空replace/remove/destroy各一次dispose；cloud-enable/cloud-tint真实sync重绘并核remove/readd/静止skip；Room output RT、真实InstancedMesh instanceMatrix和共享几何材质分派；已暴露Room/generator失败清理；HDR迟到/同key新buffer/缓存命中；actualenv UUID/强度重绘；A→B→bad→同key新bytes恢复；eq/generator finally与旧HDR RT回退。转换边界使用受控替身，释放事件与分派使用真实原生对象，不冒充GPU。
3. `RENDER_PROBE_CHROMIUM=<本机Chrome> node scripts/verify-environment-lifecycle-browser.mjs`：sky/room/hdr三路；也可 `--case sky|room|hdr` 点名。入口自产64x32 RGBE Radiance字节，记录SHA/来源，无真实摄影或付费素材；实际HDRLoader/PMREM/ThreeRenderer，原生GPU证据另看报告。
4. 原生观察跟踪**init之后**的buffer/texture/framebuffer/renderbuffer create/delete与所有者dispose，在原forceContextLoss之前取证，明确是所测分配相对基线的归还，不把上下文丢失当资源清理。最终destroy保留完整World，核snapshot/full与incremental hash/writeSequence/version/dirty不变，不先删除实体绕过destroy分支。

## 撤修验红

只撤额外自有副本，唯一锚点hit=1，必须实际AssertionError红、精确恢复绿。最终产品b257d9d8…与测试addbe498…的CPU19锚点全部闭环：copy绿11→逐处红exit1→精确还原→最终绿11；原施工源无漂移。报告 `/private/tmp/apollo-env-lifecycle-red-wouaw8uj/report.json`、冻结 `/private/tmp/env-lifecycle-frozen.json`。

19处覆盖：三处Sky重复mapdispose；Room output owner、instanceMatrix、共享资源、generator内部对象；HDR destroy/swap/failure输出、source identity、late bytes、failed-byte memo、eq/generator finally；env UUID/intensity dirty、Sky dirty、missing日志有界。初版latebytes负例先发生TypeError，未计为有效红，补明确先验后最终19处全为真正AssertionError。

独立复查另选cloud-enable/tint实证：旧49a189源虽重建map且dispose一次，但gl.render仍1应2；构造方自己重建同反例亦红，再补现有skySig入renderSig。新两项均绿，资源修复其它逻辑逐字未变。首轮单元绿不能代替该实际绘制反例。

## 门禁与真实证据

最终四项源码SHA清单 `/private/tmp/aiflow-env-final-frozen-sources.json`；基底030f29caa，产品b257d9d883fa95d4bdca18a6dcb0eee5f5819b0415513e78e1b938448c8fe460，CPU测试addbe49807221ea60a3c2b061c5cca09c981d6033e52bdf5bfedb6612b1683ad，GPU入口9570939c6ab1c15189a62ff97cfdbfe74d90e4bc021838cab653bdcb3213f789，browser8f74599c9b3c729d2446837ca78c240d2d71fc10d05abc426d514647b35fd928。

旧三路失败留在 `/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/environment-lifecycle-construction-20261021/construction-receipt.json`：env0的11张map各dispose2；Room在contextalive时buffer/texture/FBO/RBO各遗留1；HDR从waiting→ready实际环境UUID换/parse1，但主draw次数不增、renderSig相同。HDR问题依据真实draw与环境身份，不靠空/旧readPixels猜因果。

探针自身两处修正如实保留：早期teardown先删World会漏最终destroy的Sky分支，最终改为World原样direct destroy；早期camera.far=40裁掉SKY_RADIUS2000，最终far5000真实看见天空后才将云层pixel变化作为证据。前版观测不作为最终覆盖，不更改产品阈值。最终完整门禁、三路GPU与撤修/恢复报告另补；当前主干已修game113旧基线，不沿用旧例外。

### 最终门禁与GPU恢复

最终源实际scoped --run退出0，末行 `✅ 门禁全绿（scope=full）`；日志 `/private/tmp/aiflow-env-final-scoped.log`，步骤码 `/private/tmp/aiflow-env-final-step-exits.json`。eslint/depcruise/tsc/full Vitest/build/docs/context均0；664文件7078/7078全通过，无failed/pending/todo或Unhandled汇总。sim-DOM另跑0，原生spritegen node:test另跑0、5/5。art-ledger-guard为既定允许的2，只有旧game-a art-03、game-c art-017缺文件WARN2。没有使用旧game113基线例外。

已读最终224个stderr上下文/192条去重非栈诊断；与V1已阅清单相比仅新增fake Blender 100ms timeout负例的ETIMEDOUT，实查 `scripts/blender-job.test.mjs` 的 `enforces timeout and leaves an error log with no published output`，不是启动真实Blender或新增崩溃。其余为既有Mock/坏输入/人门拒收、故意L/P定序环、HappyDOM localhost拒连，build大chunk和台账WARN保留。第一轮源/探针后来补真实destroy、可见天空与独立cloud反例，故又对最终四SHA完整重跑，不将前轮绿灯冒充最终覆盖。

最终GPU恢复 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-environment-browser-aDXleL/report.json`，sky/room/hdr三路退出0；15处native关键锚点预先hit1，各真红exit1并逐次精确恢复b257源，随后完整三路exit0。收据 `/private/tmp/apollo-env-final-gpu-g9d3izrx/receipt.json`，详细指标同目录final-metrics.json；没有以TypeError、编译失败或超时当撤修红。

| GPU路径 | init后原生创建=删除（buffer / texture / framebuffer / renderbuffer） | 所有权 / 纯读 |
|---|---|---|
| Sky env0 | 68=68 / 16=16 / 1=1 / 0=0 | 13张map与对应geometry/material各dispose1；19次World纯读 |
| Room | 61=61 / 6=6 / 3=3 / 1=1 | output RT1、generator1、共享geometry1/material8、临时InstancedMesh1各dispose1；18次纯读 |
| HDR | 334=334 / 45=45 / 29=29 / 1=1 | 13eq、13HDR RT+1Room RT、14generator各dispose1；68次纯读 |

四类跟踪handle总计463/67/33/2创建并全部删除；这些是init后分配的相对基线，非全进程物理显存声明。原forceContextLoss调用前已有contextalive、GPU0/0、四Set为0且create=delete断言，随后重复destroy不增加释放/丢上下文调用。RT纹理没有额外Texture-only dispose事件，实际由RT所有者释放。

真实天空云开关/云色主draw 1→2→3，pixels 642f1095→21728a79→6c2269db；静止cachehit不重绘。HDR等候Room主draw2→A就绪3→B5→同key新bytes恢复7，实际env UUID/像素变化；相同字节cachehit不再parse/转换，循环保持平台。HDR parse14次含13好1坏；唯一WARN在hdr-bad-first，原因bad initial token，重试/steady/cache/destroy均无新增。完整World保留到direct destroy，105次纯读检查未改snapshot/full与incremental hash/writeSequence/version/dirty。

共享Renderer原样回归V1：`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-v1-browser-x4JVjy/report.json`，五节奏各2000tick均退出0，既有V1入口/浏览器/manifest的三个SHA逐字不变；含重载销毁113/113/live0、其余28/28/0，五次GPU0/0。没有为资源修复回退已结案V1或放宽原阈值。

全部ENV旧/新原生报告、输入HDR字节、15撤修、最终指标、精确源码/探针与V1共享回归持久保留在 `/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/environment-lifecycle-construction-20261021/`，入口construction-receipt.json。root最终门禁和冻结表同目录保存，独立复查尚待自己的执行判词。

## 已知局限

修复已取得的output RT与已暴露临时资源所有权；three PMREM内部渲染抛异常且尚未返回output的状态，未实测时不承诺全面恢复。测试使用自产离线HDR与Sky数据，付费来源、生产美术与真人R1未验。V1离线整链独立结论在其专属Review，本单不代签。

## 交叉复查

待另一位未参与本单施工的独立复查方执行；施工方不填写通过判词。


### REQ-3D-ENV-LIFECYCLE 独立复查判词（2026-10-21）

独立结论：本单既有 Sky/Room/HDRI 生命周期修复通过独立交叉复查。审查提交为 `32c097ecd462333dc728fdda9608328b9ab1a1af`，基底为 `030f29caa996ffc101b5b54529734885d714ea7c`。复查人未参与本单产品施工；我在 `/private/tmp/apollo-env-independent-20261021` 自有副本执行复跑、撤修、对抗和告警审读，未改施工树或用户原工作区，未提交、推送、启动 Blender 或调用付费服务。施工 Review 和收据只用于导航，未作为通过证据。

已独立核对不可变提交的全部 1178 个 `src/`、`scripts/` 文件：文件集合及逐项 Git blob 完全一致，四项冻结 SHA 与提交及实测副本一致，无额外、缺失或漂移文件。最终契约、Review、3D 手册、requests-3d 四文档亦从该提交读取并核对原文，随后独立运行 docs/context 均退出 0。完整对账在 `independent-proof/final-immutable-commit-audit.json`。本单仅改变 Renderer、专属测试/探针及四文档，没有组件协议、sim、游戏或 PUI 改动。

**独立反例与撤修闭环。** 初版候选 `49a189fe…` 的既有定向测试通过后，我另写两例静态 env0 Sky 对抗：只开启 clouds、只改变 cloudTint。两例都真实调用 ThreeRenderer.sync，观察到 map 更换、旧 map 恰好 dispose 一次，但主 draw 仍为 1，应为 2；原断言各以 AssertionError 退出 1，记录在 `logs/apollo-env-independent-boundary.json`。这是 CPU 接线与 draw 计数证据，不冒充 GPU。报告施工方后，由施工方修复；我未修改产品。最终 `b257d9d8…` 对同一组未放宽的独立断言通过，连同 ENV11、Camera25、Light8，共 46/46，失败/pending/todo 均 0。独立新增两例保留为证据文件，没有混入下述正式全量计数。

我自行选择两个唯一命中锚点，在自有副本实际撤修并精确恢复：

- HDR 同 key 缓存去掉 `this.hdriSource === source`，hit=1。定向断言实际报 `parse expected 2 calls, got 1`，退出 1；该命令按名称过滤，其余 10 例为过滤跳过，不是正式全量 pending。恢复源码 SHA 精确回到 `b257d9d8…`，同组 46/46 退出 0。证明在 `independent-proof/corrected-hdr-withdrawal.json`。
- 只撤 renderSig 的 `|sky:${this.skySig}`，hit=1，撤后源码逐字节恰为原 `49a189fe…`。使用同一冻结原生探针，真实 Chrome 报 `Sky clouds enable rebuilt texture but did not draw changed native pixels`，mainDraw 仍为 1，退出 1；不是 TypeError、编译错误或超时。原生红报告为 `native-sky-withdrawal-red/report.json`。精确恢复最终 SHA 后，同一冻结探针完整 sky/room/hdr 三路退出 0，证明在 `independent-proof/native-sky-withdrawal.json`。

另将副本 Renderer 换成不可变基底030原文，用相同最终探针独立复现原 Room 缺陷：`forceContextLoss` 原方法尚未调用、contextLost=false 时，buffer/texture/framebuffer/renderbuffer 各 live=1，GPU texture=1；真实资源断言退出 1。见 `native-original-room-red/report.json` 及 `independent-proof/native-old-room-reproduction.json`。这是整份旧源码对照，不冒称单锚点撤修。恢复后所有 1178 个源码/脚本再次与审查提交一致。

**正式原生复跑。** 显式固定 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 并在授权宿主环境执行，未改阈值或超时。正式恢复报告为 `native-final/report.json`，原始目录 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-environment-browser-oYvuzp/`。源码与两探针均为最终四项 SHA，三路退出 0。

| 路径 | init 后 buffer / texture / framebuffer / renderbuffer 创建=删除 | 所有权与纯读检查 |
|---|---|---|
| Sky env0 | 68=68 / 16=16 / 1=1 / 0=0 | 13 张独占 map 及对应 geometry/material 各 dispose1；19 次纯读 |
| Room | 61=61 / 6=6 / 3=3 / 1=1 | output RT1、generator1、临时 InstancedMesh1、共享 geometry1/material8 各 dispose1；18 次纯读 |
| HDR | 334=334 / 45=45 / 29=29 / 1=1 | 13 张临时 eq、14 个 RT、14 个 generator 各 dispose1，RT texture-only dispose0；68 次纯读 |

销毁保留完整 World，不先删实体；三路共 105 次 snapshot/full 与 incremental hash/writeSequence/version/dirty 纯读检查。冻结探针在原 `forceContextLoss` 前执行 contextalive、GPU0/0、四个跟踪 Set 均0与 create=delete 的断言，然后才丢上下文；重复 destroy 不增加释放或 context-loss 调用。正式成功 JSON 的 `once` 字段在 context loss 之后，我没有把它错称为原始销毁前快照。为保留销毁前实数，我另在自有证据入口仅增加导出既有 `window.envReport.beforeForceContextLoss`，未改变产品、冻结 browser 探针或断言；补跑三路仍退出0，`native-preloss-capture/report.json` 明确保存三路 contextLost=false、GPU0/0、四类 live0 和上述平衡计数，入口差异与 SHA 另存 `independent-proof/env-preloss-capture-provenance.json`。这些是 init 后所测分配相对基线的回收，不能外推为全进程物理显存承诺。

Sky clouds/tint 的主 draw 1→2→3，真实像素 hash `642f1095→21728a79→6c2269db`，静止命中继续 skip。HDR 等候 Room→A 到达→B 到达→同 key 新 bytes 恢复的主 draw 为 2→3→5→7，环境身份及像素实际改变；同 bytes 命中不再 parse/转换，开关与替换循环保持有界平台。HDR 共 parse14 次（13 好1坏），唯一原生警告在 `hdr-bad-first`，为刻意坏头部的 `bad initial token`；后续坏输入命中、steady、cache、destroy 无新增。已读完整诊断栈，并实际查看 Sky/Room/HDR 三张 PNG：场景、可见天空与反射差异符合这些技术断言，未据此签生产美术质量。

共享 Renderer 的既有 V1 回归由我另跑，`v1-shared-regression/report.json`，原始报告 `apollo-v1-browser-8Srl3R/report.json`，退出0。60/30/120Hz 及 catch-up2/5 五种节奏各2000 tick，full/incremental hash 序列完全一致；销毁后五次 GPU0/0，native buffer113/113/live0（带五轮重载）或28/28/live0。V1 manifest/两探针 SHA 未变，七张 PNG 与我原 V1 独立终验 `XBIPAc` 逐字节一致，本次又查看接触前、接触、抬起及持壶画面。20条诊断全部为首次 load/五轮 reload 模型尚未 ready 时既有 Attach/IK 各一次，阶段与 ready=false 明确，无 ready 后新增警告。V1 的 owned material maps=0 是该夹具条件，未用它替代本单 Sky map/RT 覆盖。

**独立完整门禁。** 在 Git 副本按基底真实改动分类执行 full 计划，ESLint 与 depcruise 均实际全量运行；不是无 Git 副本的 scoped0。宿主环境显式固定 Chrome，Vitest maxWorkers4/minWorkers1。结果见 `logs/apollo-env-independent-full-steps.json`：

| 步骤 | actual exit / 实际结果 |
|---|---|
| ESLint / depcruise / sim-DOM | 0 / 0 / 0；依赖 1460 modules、5245 edges，零越界 |
| spritegen 原生 node:test | 0，5/5，无 skipped/cancelled/todo；与 Vitest 分开 |
| TypeScript / Vitest 全量 | 0 / 0；664 文件、7078/7078，failedFiles=[]，failed/pending/todo=0 |
| build / docs / context | 0 / 0 / 0；提交后四文档最终 docs/context 另跑亦0 |
| art-ledger | 2，仅既有允许档；缺来源0，旧黑户5、死账2如实保留 |

没有沿用已修复的 game113 depcruise/fence 红例外，没有 NoSuite/EPERM/NO_BROWSER 当通过，也未改断言超时。逐个门禁日志均已读取。全量 stderr 221 个上下文、379 条去重诊断行已审读；368 行与我此前独立 V1 全量已读内容一致，新增11行均为 HappyDOM Fetch 的 AbortError 与 teardownWindow/AsyncTaskManager 取消栈，未见 Unhandled/uncaught 汇总。其余是已有故意 L/P 环、Mock/坏输入/人门拒收、存储失败注入和 localhost 拒连。build 保留三个 >500kB chunk 提醒；台账明确为旧 game-a art-03、game-c art-017 缺文件，未消音或改记为0。完整告警索引为 `logs/apollo-env-independent-warning-audit.json`。

本结论限于已取得 output RT 与已暴露临时资源、现有缓存/替换/失败回退/销毁及实际刷新接线。Room/HDR 各至多一个缓存结果，关闭环境时保留有界缓存到 destroy 不等于每次关闭立即零占用。上游 PMREM 在内部异常且尚未返回 output 时，其未暴露 RT 的任意 GPU 故障恢复未被实证，不给予通过声明。测试 HDR 为自产 Radiance、人物/场景复用已有离线夹具；`realTripoValidated/realMixamoValidated/realArpValidated/productionApproved/formalV1Validated/humanR1Validated` 仍 false。没有剩余本单实证阻塞，本单通过不代签正式付费 V1 或真人 R1。

独立证据已持久保存：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/environment-lifecycle-independent-20261021/independent-receipt.json`。以上短路径均相对此目录，收据含实际日志、原始红/恢复报告、HDR输入、PNG、冻结源码、独立测试/撤修原文及逐文件 SHA。复查署名：独立交叉复查 agent，非本单施工人。
