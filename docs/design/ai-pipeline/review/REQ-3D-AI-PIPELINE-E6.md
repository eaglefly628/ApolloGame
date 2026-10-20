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


## 返工记录（施工导航 · 2026-10-21）

分段返工锁ac59eb057；本段替代上文初交版本的最终证据口径，等待独立复查，不自判通过。另一位复查人实际发现两类阻塞：eye=[0,0,0]、target=[1e-170,0,0]虽通过协议却被原生lookAt的长度平方下溢转向-Z；有限正fov/near/far也可能让原生投影或其Float32上传/逆矩阵产生Infinity/NaN。原GPU反例WSWsGF及独立lens日志由复查人保留，非只读代码推断。

### 修了什么与验法

- `camera-rig.ts`只在E6直接取景的极小非零delta（maxabs<1e-150）按最大分量缩放后单位化，交原生lookAt等价射线；原始eye、target和真实距离不变，普通取景、旧orbit/tween/shake不改。`camera-shot-rig.test.ts`新增6项 `keeps the actual native viewing direction for accepted near-point data`，覆盖正负X、MIN正Z、MIN混合轴、大平移与阈值附近；测实际方向、独立单位方向原生矩阵、有限性与输入未变。
- `components/camera-shot.ts`新增无three依赖的纯 `validateCameraShotProjection`：按现用中心WebGL原计算顺序检查投影系数、稀疏原生逆矩阵与Float32上传矩阵的逆；相关必要非零系数必须能安全上传。载体静态准入检查显式lens；`applyView`用实际viewport/场景默认lens/原dist解析far，在改原生相机前再次校验。明确拒收，不悄悄替换lens；无Shot旧路径保持。
- 数值准入不把raw near/far的Float32精度当额外限制：far=1e307、near=40/far=40+7e-15实测原生及上传逆安全，仍接受。契约补明仅保证矩阵数值安全，不承诺场景可见性。拒例含fov=MIN、1e-300、near=1e308/far=1.7e308及MIN/2MIN；还分开覆盖仅原生逆失败、仅上传矩阵逆失败与零缩放。协议测试由31增至52项，均用真实THREE矩阵/F32作为外部证据。
- Rig再增7项 `rejects unsafe resolved shot projection before mutating the current native camera`：上述4坏例、自定义默认fov、极端viewport和默认far<=显式near；拒收后原生position/quaternion/projection及current身份逐值不变。新增Rig共25项，旧相机20项一并验证。
- 正式GPU探针新增nearRays阶段，正式World表+Signal驱动原ThreeRenderer，+X1e-170/+Z MIN/对角MIN与单位参考比实际方向、view、原生上传与像素；隐藏目标marker后图像必须不同，避免空画面假等价。补实际writeSequence字段逐次比较，getVersion仍单独作tick版本检查，二者不混称。

冻结后的8文件150项定向测试exit0，其中E6共130项，旧相机回归20项；记录 `/private/tmp/aiflow-e6-correction-frozen-targeted.log`。原始观测/core/net/controller装载语义不改；本次产品改动只有协议与Rig两处及对应测试、GPU证据脚本和文档。

### 本次撤修验红

均在额外临时副本，先断言精确锚点唯一hit=1，绿0→真实断言红1→逐字恢复绿0；正式源码及用户工作区不撤修。

| 范围 | 撤修后的实际失败 | 记录 |
|---|---|---|
| 极小delta归一分支 | 6项中5红，正X实际dot=1e-170，断言 `expected 1e-170 to be greater than 0.9999` | `/private/tmp/apollo-e6-correction-rig-red-fjuxvht0/report.json` |
| 实际上下文投影预检调用 | 7项真实断言红：`expected [Function] to throw an error`，坏lens/默认值未被拒收 | 同上 |
| 协议系数/两类逆/载体接线10锚点 | 每个独立真实拒收断言红，撤原生逆与上传逆各自命中相应反例；恢复四文件88/88 | `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e6-lens-red-2904lge8/report.json` |
| 正式GPU极小delta分支 | +X1e-170方向变[1e-170,0,-1]，实际direction/view/world误差1；恢复全部11阶段0 | `/private/tmp/apollo-e6-final-nearray-s85a8g7i/receipt.json`，红Yf86aW、恢复oDULeu报告 |

### 最终真实GPU与冻结口径

正式11阶段0：`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e6-browser-eVtl7k/report.json`。near三例方向误差<=2.22e-16、world/view误差0、实际GPU上传<=2.98e-8；可见目标像素与单位参考同hash，藏目标后不同。原十阶段仍实际执行。

2145次snapshot/full+incremental hash/实际writeSequence/tick version/dirty对拍不变；2000tick与5reload资源保持。native115createBuffer=115deleteBuffer、live0，最终geometry0/texture0，旧World与destroy订阅释放。只有1条精确预期的last-matching WARN，未知WARN/error0。仍复用已有generic Blender字节，没有启动Blender、付费API或声称生产人物/水壶质量通过。

最终24源码/测试/脚本SHA：`/private/tmp/aiflow-e6-correction-frozen-sources.json`。协议1cf5c2fc9aa77c857983525c14e8e1c916fbea03857c38fff0e143ecd64adef0，Rig293a03536e03f0f7dced665e34123bda4876872eb1270d4c743d59797f8270e8；探针入口5f5fd31f070efb6f048c146dc8c1b70408ad9d44b6900cfb417ef9483395b51b、browser0e94ae604ac59488124b2b7fe086d5c237a93fdbe47f6c0f40407705fcf2cca4。


### 冻结版本门禁（返工最终）

| 步骤 | 退出码 / 结果 |
|---|---|
| scoped --run：eslint / depcruise | 0 / 1，仅指定game113相对导入基线 |
| sim-DOM fence / 原生node:test | 0 / 0，原生5/5 |
| tsc | 0 |
| full Vitest | 1，661个实际文件、7032/7033；只有指定depcruise-fence基线1例，pending/todo0 |
| build / docs-ref / context-budget | 0 / 0 / 0 |
| art-ledger-guard | 2，game-a art-03、game-c art-017既有WARN，黑户基线未增 |

最终整套续跑器exit0；末行仍为 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志 `/private/tmp/aiflow-e6-correction-final-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`，机读 `-steps.json`、`-vitest.json`；实际scoped末行 `❌ 门禁失败于 depcruise（退出码 1）`，`/private/tmp/aiflow-e6-correction-final-scoped.log`，simDOM `/private/tmp/aiflow-e6-correction-sim-dom.log`。修补中途第一套检查不是最终交付依据；源冻结后重跑此整套，24项SHA再次核对无漂移。

已读最终全量235条WARN/stderr等相关上下文（含测试名关键词），索引 `/private/tmp/aiflow-e6-correction-final-warning-inventory.txt`；topological-sort仍只有故意互emit/listens的L/P用例，旧Mock/拒收/迁移/资源分组诊断、HappyDOM localhost:3000 ECONNREFUSED与Vite大chunk未隐藏。无Unhandled Errors汇总；正式GPU严格仅1条精确预期WARN。

本次交付仍仅引擎工具能力与技术测试证据；真实Tripo/ARP/Mixamo和V1真人R1未完成，不签任何人门。待未参与施工的另一位复查人落独立判词。


### 独立交叉复查判词（2026-10-21·E6）

复查人：Codex 独立复查代理，未参与 E6 施工。审查从原提交 `7066cb03c9407096fa150d7a3acff56902136e0d` 延续到修补提交 `3730f2f6602ffde5ec56cf31c928806d9125ebe0`；分段锁 `90d165f1e`，返工锁 `ac59eb057`。已先读 AGENTS→CLAUDE、工单/R3、镜头契约与施工导航；导航及施工自陈不作为通过证据。所有复制、对抗、撤修和执行均在新的独立临时副本，未改施工树或用户工作区，未提交/推送、未启动 Blender、未签人门。

**判定：经两类实证问题修补并独立复验，最终提交的 E6 通用镜头表、被动组件观测接缝及原生相机接线独立复查通过。** 保留指定 game113 依赖基线和既有美术台账 WARN；原提交的官方测试/GPU绿灯没有被直接当作最终通过。

1. **最终源码与完整复跑。** 本段24个源码/测试/脚本对照 `/private/tmp/aiflow-e6-correction-frozen-sources.json` 及最终提交 Git blob；全部 `src/`、`scripts/` 1,167个文件亦逐项核 Git blob，全量结束后字节未变。独立记录 `/private/tmp/apollo-e6-independent-final-all-blob-check.json`、`/private/tmp/apollo-e6-independent-final-source-sha.json`。执行根为 `/private/tmp/apollo-e6-independent-20261021`；额外对抗副本为 `/private/tmp/apollo-e6-adversarial-20261021`。没有用无Git副本的 scoped 零改动冒充 full；eslint、depcruise、sim-DOM及完整计划均实际独立执行。

   | 独立最终步骤 | actual exit / 实测 |
   |---|---|
   | 原生 spritegen `node --test` | 0，5/5；该node:test文件从Vitest排除 |
   | eslint / depcruise / sim-DOM | 0 / 1 / 0；dep唯一 `games/game113/guide-art.ts → src/assets/asset-index.ts` |
   | tsc | 0 |
   | full Vitest | 1，661实际文件，7032/7033；唯一失败文件 `scripts/depcruise-fence.test.mjs`，唯一失败断言“绿腿：真仓零违规”；pending=0、todo=0 |
   | build / docs-ref / context-budget | 0 / 0 / 0 |
   | art-ledger-guard | 2；既有game-a art-03、game-c art-017缺文件，旧黑户基线未增 |

   每轮实际使用宿主授权环境、固定 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，full maxWorkers4/minWorkers1，未改原断言/超时，未豁免NO_BROWSER、EPERM或NoSuite。原提交独立首轮6998/6999同样只有旧基线，但没有替代修补后的最终全量。最终逐步退出码与失败项在 `/private/tmp/apollo-e6-independent-full-steps.json`、`/private/tmp/apollo-e6-independent-full-vitest.json`；各步日志同名前缀，原轮另存 `apollo-e6-independent-original-full-*`。

2. **先实证、再修补、同反例复验。**

   - 原协议接受单键 `eye=[0,0,0]`、`target=[1e-170,0,0]`，原生相机实际方向却为 `[1e-170,0,-1]`。独立CPU断言红；独立真实GPU报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e6-browser-WSWsGF/report.json` 退出1：与等价正常+X视线相比，实际native view差1、5次GPU上传view差1，pixels由 `61b30738` 变成 `890435b6`。该错误不是只比较lookAt参数字面值。施工方在E6极小视线分支稳定归一化，保原镜头距离和普通/legacy路径；独立重跑同CPU和GPU反例均绿，原GPU修后记录 `apollo-e6-browser-Abbhqc/report.json` 的native/GPU view差均0、pixels相同。另96组MIN/1e-170混合轴与平移，最大方向dot误差 `4.999999969612645e-9`；原生local-shake等价对照矩阵误差0。
   - 原载体校验接受的四个数值组合不能安全绘制：`fov=Number.MIN_VALUE`、`fov=1e-300`、`near=1e308/far=1.7e308`、`near=MIN/far=2*MIN`。独立实际原生projection或Float32上传数据出现Infinity/NaN，记录 `/private/tmp/apollo-e6-independent-lens-expanded.log`，4项断言红；`orthoSize=MIN`因旧frustum clamp原本有限，没有误报。修后按实际native投影系数、逆矩阵及Float32结果做opt-in校验，四个反例拒收，Engine.load前后snapshot/hash/writeSequence/version/dirty/tickRate均保原状；运行时实际上下文在改动原生相机前预检。也独立核实 `far=1e307` 和 `near=40/far=40.00000000000001` 的原生及Float32矩阵可用，促使修补去掉过保守的raw裁面范围/精度限制；这两个正例最终仍可用。无Shot旧Camera3D装载、原MIN ortho clamp均保持。

   最终官方8文件150项与自写3文件13项合计11文件163/163、exit0、pending/todo0，记录 `/private/tmp/apollo-e6-independent-final-focused.json`。原红与修后结果均保留；独立没有修产品源。复查夹具曾因restore起始写序不同、及误按注释假设shake会重新瞄准目标而各有伪红，实查既有行为后分别改为同起点增量/原生等价对照；这两项未被当作产品缺陷或豁免。

3. **自选 unique-hit 撤修。** 另选最终字节未变的 `component-observers.ts` 深冻结步骤 `for (const { copy } of pending) Object.freeze(copy);`，先断言hit=1。自写两项选择范围先exit0；只撤深冻结后exit1、1绿1红，实际断言为冻结状态 expected true、received false；精确恢复后exit0。该选择过滤了另一个近点用例，不将被过滤项算通过；另完整重跑观测两文件17/17、pending0，以及上述最终163/163。恢复SHA `28460c7b9bcf9c97ae1309c008f3fed4704763690add4125f40d430783668530` 与最终源码相同。记录 `/private/tmp/apollo-e6-independent-mutation-report.json`，不是编译失败或超时验红。

   自选观测对抗实际发布/立即移除20,000次完全同payload Signal，独立冻结快照、发布次数、一个pending、消费起点及取消后注册表释放均通过；同次交付内取消另一监听/新增监听的次序也独立验证。官方实际World回归另覆盖add/replace、remove/consumes索引完成后通知、destroy/restore/applyDelta、getter与异常隔离、10k取消，以及Tracer/Recorder原tick槽。2k双World观测对拍检查snapshot/full+incremental hash/writeSequence/delta/version/dirty及query顺序相同；Signal仍对hash敏感，没有为通过测试排除Signal。未加入或改动sim系统、相位或执行顺序。

4. **最终真实GPU与纯读/生命周期。** 独立在最终冻结副本重跑正式脚本十一阶段，报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e6-browser-C2PgLg/report.json`，探针entry SHA `5f5fd31f070efb6f048c146dc8c1b70408ad9d44b6900cfb417ef9483395b51b`、browser SHA `0e94ae604ac59488124b2b7fe086d5c237a93fdbe47f6c0f40407705fcf2cca4`。硬切/三ease/末键、同payload重播/中断、144Hz不误重启、legacy orbit/follow/ortho/tween、等值替换/改表/删除、同id/换World/restore均实际通过。末帧真实绘制，三种曲线各随后3帧hold均skip。

   相机eye/world矩阵最大误差约 `2.354e-14`，真实上传view/projection最大误差 `2.1022432239448108e-7`；公开pick、screenToWorld、post、WorldUI与实际渲染使用同一CameraRig.current。WorldUI最大CSS坐标误差 `.0003366915347982058px`，低于既有序列化精度对应的`.001px`阈值。新增三个近视线GPU场景包含可见marker与隐藏对照，真实方向误差≤`2.221e-16`，native world/view差0、单位视线pixels完全相同；不是空画面相等。

   实际timeline5tick catch-up、同系统瞬生即灭/consumes和动态加表后发Signal均切到预期镜头，旧tick observer完整保留。2k双World完整/增量hash对照一致；最终2145次渲染前后直接检查snapshot/hash/version/writeSequence/dirty不变。原探针曾只检查version却在错误文本写writeSequence，独立核读指出后补实际写序号断言；另自建直接写序号探针 `apollo-e6-browser-dGtLOx/report.json` 亦完整通过2145次，不把version冒称seq。

   steady及5轮reload均6geometry/7texture/26native buffers，不增长；销毁前保留活镜头表确认订阅在场，destroy后真实取消且再发布Signal不复活。原生buffer实际115创建/115删除、live0，geometry0/texture0/contextlost=true。已逐张目击同目录load/wide/closeup/pan四张实机PNG，机位/构图和既有WorldUI标签随真实相机变化；该目击不冒充正式角色美术或V1审美验收。

5. **告警及遗留口径。** 正式最终GPU仅一条精确预期“last matching publication wins”诊断，已读；其余WARN/error仍会失败。独立全量stderr整理为 `/private/tmp/apollo-e6-independent-full-warning-inventory.txt`，535条归一去重行对照本轮原提交与前段独立已读清单，仅模块/依赖数量统计为新增。故意L/P topo环来自system-graph互emit/listens用例；Mock降级/坏输入、人门拒收、模拟迁移配额、HappyDOM localhost:3000连接拒绝/清理和Vite大chunk均已核读，未出现Unhandled Errors汇总。没有新增语义告警被默许。art WARN2仍是game-a art-03及game-c art-017缺文件，依赖基线只保指定一条及对应Vitest一例。

通过范围仍为世界空间eye/target闭集关键帧、绘制消费时计时、同绘制间隔最后一个匹配决定；不承诺亚帧/音频同步、骨骼跟拍、自由轨道、镜头生成或完成Signal。未提供观测的自定义IWorld按契约明确WARN回基础相机。实际投影上下文不安全时拒收，不静默夹成另一镜头；无Shot旧相机语义未扩改。角色/道具均为现有T5 generic-blender-fixture与简化测试物，不是生产人物/水壶/院落。`realArpValidated=false`、`realMixamoValidated=false`、`realTripoValidated=false`、`blenderStarted=false`；真实来源、授权、付费流程和动作质量仍待验，真人门未签，V1另段处理。
