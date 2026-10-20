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
