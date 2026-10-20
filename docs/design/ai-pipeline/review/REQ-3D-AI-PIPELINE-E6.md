# REQ-3D-AI-PIPELINE · E6 剧情镜头交付导航

> 施工主体：Codex；分段锁90d165f1e（2026-10-21）；E4已由另一位复查人结案48c4732b5。此页仅施工导航，不签真人门、不自判PASS。没有启动Blender/调用付费API，不改游戏/PUI、Signal生产者、系统相位或既有录制接口。

## 做了什么

`CameraShot3D{shots,onSignal}` 用闭集表描述秒制eye/target关键帧和既有linear/cubicOut/inOut缓动，复用CameraRig的原生透视/正交相机、lens、shake。实际Signal发布触发首键硬切，同值重发重播，后触发打断前者，末键保持；删除、换世界、同id重建、restore清旧播放。没有自动播放/自由脚本/完成Signal。语义、预算和实查见 `docs/design/ai-pipeline/camera-shots.md`。

帧末轮询Signal会漏掉catch-up中被下一tick销毁的timeline cue，因此新增World通用被动组件观测：匹配add/replace完成写入/索引后给独立冻结快照，remove含consumes、destroy/restore给生命周期通知。多监听可取消，异常隔离，无监听不复制/分配通知；setObserver/Tracer/Recorder原单槽语义保持。观测不进entities/snapshot/hash/delta，不touch/emit/改执行序。相机只保最后一个待触发决定，不积无限队列，回调只更新表现私态。

只解释既有getCamera3D所选的首个有效相机，同体镜头表装载闭集/引用/预算/载体验证，所有表在装载前后原子校验。绑定动态加表后同一catch-up发信号，表等值替换不停播；配置变化与原地坏数据安全退回基础相机。中途视线重合保最近有效取景一次诊断。取景进入实际绘制签名，硬切与最后帧提交，保持结束后停止重绘；镜头期间不叠legacy tween/follow平滑。最终同一CameraRig.current用于post、raycast、反射、WorldUI、Diegetic。

## 改动面（文件清单）

- `src/engine/core/{world,types,component-observers,component-observers.test}.ts`：必要被动观测旁路，保留sim操作原序；`src/net/component-observation-purity.test.ts`验证旁路不改变模拟。
- `src/engine/protocol/components/camera-shot.ts`、`camera-shot.test.ts`、`render.ts`；`src/assembly/component-map.ts`、`component-universe.gen.ts`、`scripts/component-manifest-baseline.json`仅登记CameraShot3D。
- `src/assembly/camera-shots.ts`、`camera-shots.test.ts`、`scene-import.ts`、`validate-manifest.ts`；`src/net/determinism.ts`与`camera-shots.test.ts`只排CameraShot3D，不排Signal。
- `src/renderer/three/camera-shots.ts`、`camera-shots.test.ts`、`camera-rig.ts`、`camera-shot-rig.test.ts`、`src/renderer/three-renderer.ts`。
- `scripts/verify-camera-shots-browser.mjs`、`scripts/fixtures/camera-shots/browser-probe.mjs`；镜头契约、3D手册、本页、3D总单状态。

## 怎么自己验

1. `camera-shot.test.ts`31项：plain/POD/未知字段、tuple/坐标范围、at0/严格递增/600秒、shot1..32/键1..64/总512、binding1..64/信号唯一/引用、共享载体yaw/pitch/lens安全范围。`assembly/camera-shots.test.ts`14项：同体有效Camera3D、动态信号允许、sync/async/direct/template原子拒收与E5前后、不收窄无Shot旧相机。
2. `core/component-observers.test.ts`15项：实际发布、同payload3次add、独立深冻结、remove/consumes索引完成后、destroy/restore/applyDelta、异常监听与恶意getter保原写入、订阅变动/取消、10k次卸载无引用增长；真实timeline2/3/4/5tick追赶、skip多cue、同系统瞬生即灭；Tracer和Recorder仍工作。`net/component-observation-purity.test.ts`2项：2000双World full/incremental hash/writeSequence/delta/version/dirty与query顺序对拍相同。
3. `three/camera-shots.test.ts`15项：硬切、三种曲线、重播/打断、单pending、首个有效相机、动态表/等值/改表、World/restore/同id、纯读参数与非有限时间、退化视线恢复、取消真实回调。`net/camera-shots.test.ts`7项：CameraShot3D加/改/删排hash，Signal/真实sim字段仍敏感；双World原生THREE.Camera共20k CPU更新，snapshot/hash/writeSequence/dirty不变。CPU证据不冒充GPU。
4. `camera-shot-rig.test.ts`12项：独立原生Perspective/Ortho相机world/inverse/projection矩阵、复用对象、lens/近远默认、local shake、镜头不叠旧tween、移除回旧orbit、竖直/边界坐标有限、独立实例与共用ease。既有 `three-camera3d.test.ts`20项同时通过。
5. `RENDER_PROBE_CHROMIUM=<固定Chrome> node scripts/verify-camera-shots-browser.mjs <已有T5 run-1目录>`：十阶段真实AssetIndex→AssetManager→ModelPool→ThreeRenderer，观察实际原生camera/lookAt/上传view+projection矩阵、pixels、post、公开pick/screenToWorld与已有WorldUI；不用另一份假相机替代绘制。真实timeline5tick后Signal已销毁仍切最后匹配，现有tick observer继续收到全部tick。

新增7测试文件共96项均通过；数据四文件67、观测两文件17、原生相机新增12与既有20分别实跑，不把重叠回归累计为新增。

## 撤修验红

只在额外临时副本撤修，61处均先断言锚点唯一hit=1，baseline0→真实断言红/exit1→恢复0；没有撤正式源码或用户工作区，不以编译失败/超时充数。

| 范围 | 撤修与实际断言 | 证据 |
|---|---|---|
| 协议/载体/装载/控制器/hash36处 | 闭集/时间/预算/引用/载体、前后入口、首台选择、发布/中断/保持/配置与世界重置、退化视线、取消、hash等；恢复67/67 | `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e6-data-red-3u6gaen1/report.json` |
| 被动观测15处 | 发布/独立clone/deepfreeze、remove/consumes/索引完成、destroy/reset、异常隔离、getter安全与不额外读type；恢复17/17 | `/private/tmp/e6-component-observers-red-20261021/report.json` |
| 原生相机6处 | 取消eye/实际lookAt、忽略base lens/orthoSize、丢shake、改变共用linear曲线；原生矩阵/像素对应CPU前提/旧相机回归断言红，恢复32/32 | `/private/tmp/apollo-e6-rig-red-2z5ulkzh/report.json` |
| 主集成真实GPU4处 | 跳镜头消费及删实际取景签名分别报`First hard-cut frame did not render`；跳applyView测得eye/matrix误差3.6；删shots.clear报`Renderer destroy retained camera-shot World.componentObservers subscription`；每次恢复完整十阶段0 | `/private/tmp/apollo-e6-renderer-red-yow_7w3l/report.json` |

施工自证还发现取消订阅原断言不足，补实际unsubscribe次数后撤修变红；首个raw Camera3D为falsy时初版query[0]不等价旧getCamera3D跳falsy，改为选首个存在相机并加回归。这两处没有放宽协议/断言，最终源码再次完整门禁。测试中短暂的未定义@debug别名与可写夹具cast已分别改为实际相对入口/unknown桥，不增加alias或改变数据接口。

## 门禁与真实证据

实际scoped --run：eslint0、depcruise1，唯一已有 `games/game113/guide-art.ts → src/assets/asset-index.ts`；末行 `❌ 门禁失败于 depcruise（退出码 1）`，未修改game113或扩大基线。

| 步骤 | 退出码 / 实测 |
|---|---|
| eslint / depcruise | 0 / 1（指定基线） |
| sim-DOM fence | 0，不引DOM/three/时钟进core观测 |
| 原生spritegen node:test | 0，5/5，未让Vitest制造NoSuite |
| tsc | 0 |
| full Vitest | 1，6998/6999，661个实际文件，只有指定depcruise-fence断言1例；pending/todo0 |
| build / docs-ref / context-budget | 0 / 0 / 0 |
| art-ledger-guard | 2，game-a art-03/game-c art-017旧缺文件WARN，旧黑户基线未增 |

完整续跑器自身0，末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。最终日志 `/private/tmp/aiflow-e6-final2-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`、机读`-vitest.json`/`-steps.json`；scoped `/private/tmp/aiflow-e6-final2-scoped.log`，simDOM `/private/tmp/aiflow-e6-sim-dom.log`。固定Chrome、maxWorkers4/minWorkers1、未改旧断言/超时。首轮全量亦仅基线，但控制器兼容修补后再次全量才记为最终。

告警清单 `/private/tmp/aiflow-e6-warning-inventory.txt`，全量258条相关上下文，故意topo环仍为system-graph互emit/listens用例；既有Mock降级/坏输入拒收/迁移配额、HappyDOM localhost:3000 ECONNREFUSED与Vite大chunk保留，无Unhandled Errors汇总。正式GPU只有一条精确预期last-matching诊断，其余WARN/error为失败。

最终GPU报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e6-browser-7aQhVM/report.json`，同目录load/wide/closeup/pan四张真实PNG。Apple M5 Metal WebGL2，三ease与硬切原生eye/target/world矩阵误差0，实际上传view/projection约1e-7；末帧有真实pixels变化，随后3帧hold均skip。144Hz同tick36帧不重启，同payload重播/打断、legacy tween绕过、同表等值替换/改表/删除、同id/换World/restore均实测。

公开pick命中、screenToWorld往返、post/render/WorldUI/rays均用实际CameraRig.current。WorldUI CSS坐标误差<.001px（原style序列化到小数有限精度，初探1e-6过严后以实际精度核对，产品未改）；原生矩阵误差阈值仍严格保留。timeline5catch-up、同系统瞬生即灭/consumes、动态加表再发Signal都真实切到预期取景且旧tick observer保留。

2k双World完整/增量hash一致，2128次渲染前后snapshot/writeSequence纯读；steady6geometry/7texture/nativebuffer26不长，5reload相同。切World后旧订阅undefined；destroy前保留活镜头表先确认订阅在场，destroy后确认真正取消，再发布Signal也不复活旧订阅。原生91createBuffer/91deleteBuffer、live0，最终geometry0/texture0/contextlost=true。

冻结24个源码/测试/脚本SHA `/private/tmp/aiflow-e6-frozen-sources.json`；探针SHA verify `b5a573fccf5c9ebdc8b9977a0f6c93c85506d92ccd7ed67734c045a2403b5afd`、fixture `ce9181b811bbd46c5daab8b6ca2b3003bb1a1d05719489bf2e87be57cd6a1a7d`。

## 已知局限 / 细化口径

- 初版关键帧是世界eye/target，不含人物骨骼跟拍、自由轨道、关节/剧情状态或完成Signal；lens继续取Camera3D。触发从绘制消费时刻计时，同绘制间隔匹配发布只保最后一个；不是亚帧/音频同步。
- 观测是World的被动旁路，不取代原tick observer或改变sim；自定义不支持observeComponents的IWorld明确WARN回基础相机。恢复出来的Signal不当新发布；applyDelta沿既有add/replace实际发布语义，不扩网络协议。
- 现有T5 generic-blender-fixture、简化道具与已有WorldUI标签仅作测试；非生产人物、水壶或院落。ARP/Mixamo/Tripo真实输入/授权/质量待验，paid flags全部false、blenderStarted=false。V1与真人盲审另段，不以此结案。

## 交叉复查

待另一位未参与施工的复查人对冻结提交执行独立复跑、唯一锚点撤修、实证与读告警；施工方不填写通过判词。
