# REQ-3D-AI-PIPELINE · T5(+S3) 离线能力交付导航

> 施工主体：Codex；分段锁 ada24193d（2026-10-20）。R2 已独立复查通过 40d205fb9、收尾 15f3ccccd。此文为施工自证导航，不能替代另一位复查人实跑，不签人门、不自判 PASS。**交付范围仅离线工具/Mock/人工回灌校验；真实 ARP Smart/Remap、Tripo/Mixamo 组合验收仍待依赖。**

## 做了什么

T4 最终静态 GLB → 实际 CPU 解码量尺（含 Draco/meshopt）→ T7 四机位渲染 → 13 个包围盒启发式标记提案和编号 PNG。模型/PNG/机位/点位绑定 SHA；真人确认只消费既有白名单记录，输入变化使旧确认失效；没有替 owner 确认的命令。

T7 原 rig-arp/retarget-arp 增 typed 数据协议，Mock 产物含真实三角/蒙皮/骨架/采样动作结构，不再以空 GLB 证明 typed 入口。真实仍区分缺授权插件和缺受测版本适配器，非零退出；未猜不存在的 Smart/Remap Python API、未换用其它绑骨生产路线。

人工回灌先验证/快照 exact bytes，再产生独立待审候选（animation spec 为 skeleton/fps/frames/loop）；不写共享索引、不自动批准。GLB 检查实际默认场景可达的蒙皮、有限访问器、权重、骨架层级/IBM、同 bind/rest 指纹、单 clip 和采样。真实动作来源另解析 binary FBX 7.1..7.7 记录、压缩数组、有效动画曲线/连接；来源自述/格式通过不等于许可或 Remap 已实测。

S3 的 Tripo 网页变体、Smart 标记微调、Mixamo 下载/Remap 三处人工操作，分别说明文件落点、SHA 失效条件与脚本接回方式。详细闭集与手册：`docs/design/ai-pipeline/character-rigging.md`。

## 改动面

- `scripts/character-pipeline.mjs`、`scripts/lib/character-inputs.mjs`、`scripts/character-pipeline.test.mjs`：prepare/run/return/motion-list，四视图、确认/来源绑定、独立候选/Mock 域。
- `scripts/lib/character-glb.mjs`、`scripts/character-glb.test.mjs`：真实 GLB/skin/动作校验、默认场景可达、骨架指纹。
- `scripts/lib/character-fbx.mjs`、`scripts/character-fbx.test.mjs`：离线 binary FBX 结构/动画连接验证。
- `scripts/blender-job.mjs`、`scripts/blender-job.test.mjs`、`scripts/blender-character.test.mjs`、`scripts/blender/worker.py`：typed T5 入口、快照与结构 Mock、真实缺能力失败传播，保留旧 T7 入口识别兼容。
- `scripts/character-pipeline.integration.mjs`、`scripts/fixtures/character-pipeline/{blender-character.py,mock-character.mjs,mock-fbx.mjs}`：自产离线夹具，真实 Blender 导出/播放/复现与明确模拟来源。
- `scripts/lib/blender-runtime.mjs`、`scripts/blender-runtime.test.mjs`：本轮用户报告的 macOS seatbelt 原生 Blender 启动崩溃防护，同时接 T7 与直接集成入口。
- T5/S3 契约、T7 契约更新、3D 手册一行、此 Review、3D 总单状态。未改游戏、sim、PUI；既有已结案工单未回退，T7桥按本次T5范围扩写。

## 怎么自己验

1. 无 key/网络/原生 Blender：`npx vitest run scripts/character-glb.test.mjs scripts/character-fbx.test.mjs scripts/character-pipeline.test.mjs scripts/blender-character.test.mjs scripts/blender-job.test.mjs scripts/blender-runtime.test.mjs --maxWorkers=4 --minWorkers=1`。当前定向 **343/343，exit0**，日志 `/private/tmp/aiflow-t5-all-targeted-final2.log`；含白名单空、旧确认变更、坏时间轴/权重/IBM、未选 scene 不能凑 skin、matching SHA 的假 FBX、单动作限制、同名不同 rest、产物不覆盖等。
2. `node scripts/character-pipeline.integration.mjs --mock --out-dir <新目录>`：真实可解析的小型 skin/采样动作只作 Mock；输出 realValidation/realArpValidated/realMixamoValidated/realTripoValidated 均不可冒称真实生产验收。缺 Blender 的真实入口明确 skipped 与 realValidation=false。
3. 正常授权环境、固定 Blender 4.5.14：`BLENDER_BIN=<完整程序> node scripts/character-pipeline.integration.mjs --out-dir <新目录>`。构造自有普通 Blender 17 骨骼、376 导出顶点，每个 clip 31 采样/1 秒；两次真实导出并由 GLTFLoader + AnimationMixer 采样实际关节和蒙皮顶点。施工报告 `/private/tmp/apollo-character-root-real-20261020/report.json`；idle/walk/reach 最大蒙皮变化分别 0.16327356 / 0.53469896 / 0.77072907 米。三 GLB 双跑字节、语义、pose 一致，跨 run joint/vertex 差为0；统一骨架 SHA `d978ae66d7bc3e72a8a846741ab3a946c1d9578d327cf80c7631f4bcea8d46a2`。source=generic-blender-fixture，真实 ARP/Mixamo/Tripo 均 false。
4. T4 → prepare 真实闭环：`/private/tmp/aiflow-t5-real-prepare.mjs`（自造静态三角模型，不是人物来源证据）实际规范化/Draco，再让 prepare 真解码、真渲染四图，两跑编号 PNG 字节一致，typed rig Mock 有实际 skin。报告 `/private/tmp/apollo-t5-real-prepare-20261020/report.json`；marker SHA `3ce27ff17cd7635a5145c32dba2e55e1a2115c83bebe9851bd14e74e214148ed`，humanConfirmation/realArpValidated 为 false。
5. Binary FBX 另由官方本机 Blender 原生导出器导出自制 armature 动作，解析为 254 对象/307连接/162曲线/5022采样/1 秒，`/private/tmp/t5-official-blender-motion.fbx`、`/private/tmp/t5-export-motion-fbx.log`。仅证明该结构兼容，没有 Mixamo、ARP 或付费服务执行。

## 早期独立实证发现及修复

另一位复查人自行复现三个问题后打回：多 clip 回灌会使首 clip 消费者播错；未选中 scene 的 skin mesh 被拿来满足验证导致角色不可见；纯文本假 FBX 可凭 SHA/来源自述进候选。现已分别补单 clip 门、默认场景实际可达门、binary FBX 结构/动画连接门并有测试/撤修。复查方仍须用自己的原探针重跑，不采信本段自陈。

## 撤修验红

全部在独立临时副本撤改，不撤施工树；每处先断言唯一锚点命中1、原定向 baseline exit0，再撤修断言变红 exit1，主源已冻结 SHA `/private/tmp/aiflow-t5-frozen-sources.json`。

| 撤修 | 测试锚点 | 红灯输出 |
|---|---|---|
| 去掉模型 SHA 比对 | `rejects model SHA` | expected function to throw |
| 去掉确认摘要比对 | `consumes existing confirmation only from the human whitelist and invalidates edits` | expected function to throw |
| 去掉真实候选拒 Mock GLB | `does not let Mock output become a real candidate` | promise resolved instead of rejecting |
| 去掉目标 bind/rest 比对 | `rejects another rest skeleton even with matching bone names` | promise resolved instead of rejecting |
| 去掉 manual return 单 clip 门 | `rejects extra clips in manual animation return before first-clip consumers see them` | promise resolved instead of rejecting |
| 去掉 source 实际 bounds 比对 | `rejects marker bounds that differ from the actual hashed source geometry` | promise resolved instead of rejecting |

汇总与逐次日志 `/private/tmp/apollo-t5-root-red-final-20261020/report.json`。GLB 核心另23处和默认场景新增7处：`/private/tmp/apollo-t5-glb-recursion-20261020/report.json`、`/private/tmp/apollo-t5-glb-active-scene-recursion-final-20261020/report.json`，含同样总时长但错误 fps/sample count 的独立断言，避免时长门掩盖采样门。

T7 typed/实际结构/帧数/rest/单 clip/Mock 拒收/真实失败另9处：`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-t5-bridge-revert-di85h_sb/results.json`。FBX header/记录边界/动画结构/连接/时间/有限值/终止等另9处：`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-t5-fbx-revert-qitrql2f/results.json`。每项均命中唯一锚点、baseline0→withdrawn1，不把未执行的变更计入验红。

## 用户报告的 Blender 崩溃

2026-10-20 23:20:33，施工子代理先在 Codex seatbelt 沙箱直接启动 Blender，PID34713 在约0.4秒内崩于 Metal 初始化（`supports_barycentric_whitelist → metal_is_supported → GPU_backend_type_selection_detect → WM_init`），业务 Python 尚未执行。同命令在已授权正常环境成功，原报告 `Blender-2026-10-20-232035.ips`；不能据此说用户工程损坏。此前另一次同类启动报告230421也保留，未删除诊断文件或更改用户设置。

必要修补：`blender-runtime` 在 macOS + CODEX_SANDBOX=seatbelt、按PATH解析可执行别名、识别已知 Blender 名称/程序真实链接时**启动前非零拒收**；T7 与 T5 直接入口统一调用。不会自动提权、清除环境标志、静默降级或关闭系统崩溃提示。Mock 无需启动原生 Blender；真实验证只在宿主授权环境串行跑。该守卫覆盖已知入口，不冒称修好 Blender 所有原生崩溃或任意自定义 wrapper。

9项专门测试使用 harmless Node 可执行替身，实际断言 child-started 文件不存在、真实目标无发布/无 result、Mock 可用。两个入口各自撤掉唯一 guard 后，替身被启动、断言 `expected true to be false`，exit1；证据 `/private/tmp/apollo-blender-startup-red-final-20261020/report.json`。另撤掉 PATH 别名解析，点名别名测试由 baseline0 变为 exit1（未生成拦截理由）；全程只运行假文件/Node替身。**验红没有启动原生 Blender，不以再弹一次崩溃窗口证明修复**。

## 已知局限 / 尚未完成的真实验收

- Smart/Remap 自动化尚缺授权插件、固定版本受测适配器和真实输入。真实 op 当前明确失败；人工 UI 导出可回灌，但 sourceEvidence=user-supplied，realArpValidated/realMixamoValidated=false。没有把它当整链 T5 完工。
- 标记点是包围盒候选，不识别解剖；真实人物 T/A-Pose、左右、手指、关节穿模/翻折、inPlace 根运动都须真人检查。构造夹具只验证格式与实际播放。
- Binary FBX 仅当前明确写出的支持子集；GLB 不支持 sparse/morph/第二套权重/压缩动作，未覆盖的输入须先在 DCC 显式处理，不能静默丢弃。
- 原始来源许可、ARP 购买资格、Mixamo 下载者记录不能由 SHA 或字符串证明，工具不代签。未填写真实 human 名单、不批准资产、不改任何游戏。
- animation 索引候选可交原资产审核，真正 E2 运行时外部 clip 注册/绑定由下一段实现；未复用现有2D atlas AnimationDescriptor冒充3D动作。

## 门禁记录

实际 `node scripts/scoped-gate.mjs --run`：eslint=0，depcruise=1，末行 `❌ 门禁失败于 depcruise（退出码 1）`，日志 `/private/tmp/aiflow-t5-final2-scoped.log`。已知基线精确为 `games/game113/guide-art.ts → src/assets/asset-index.ts`，没有改 game113 或放宽围栏。

对原 full 计划未执行的后续步骤逐个实跑并核退出码：

| 步骤 | 退出码 / 实测 |
|---|---|
| eslint | 0（实际 scoped） |
| depcruise | 1（唯一允许基线） |
| native node:test | 0，spritegen原生5项，不让Vitest误跑出NoSuite |
| tsc | 0 |
| vitest:full | 1，**6556/6557**；实际failed file/断言各1，精确为depcruise-fence的`绿腿：真仓零违规`，pending/todo均0 |
| build | 0；仅既有chunk大小提示 |
| docs-ref | 0 |
| context-budget | 0 |
| art-ledger-guard | 2，既有允许WARN：game-a art-03、game-c art-017路径缺文件 |

续跑器 `/private/tmp/aiflow-complete-gate.mjs t5-final2` 自身exit0，逐步日志 `/private/tmp/aiflow-t5-final2-{步骤}.log`、机器测试结果 `aiflow-t5-final2-vitest.json`、退出码 `aiflow-t5-final2-steps.json`，末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。Vitest保持原断言和超时，使用maxWorkers4/minWorkers1；未吞管道退出码、未新增基线。最初全量6554/6555同样只有该1例，后因独立复查发现PATH别名保护漏口而修复重跑，新增两项测试后才得到上述最终结果。

最终17个源码/测试/夹具指纹与 `/private/tmp/aiflow-t5-frozen-sources.json` 一致；构造门禁后只补Review与状态。原生启动防护验证没有运行Blender，诊断目录仍仅230421与232035两份既有报告。

## 交叉复查

待另一位复查人对冻结提交执行四步。可独立认定离线工具范围的结果，真实 ARP/Mixamo 整链验收保持待补，不由施工方给自己判词。


## 正式独立复查判词（2026-10-20）

**PASS，仅限本次约定的离线工具、Mock、人工回灌格式校验和已知原生启动防护范围。真实ARP Smart/Remap、Mixamo/Tripo来源与整链验收仍待补，未将整张T5生产验收结案。** 被审施工提交 `43970e051aad190af231f3cafe2c3c2d05cdcd62`，复查人与施工人分离。新的独立副本 `/private/tmp/apollo-character-review-final-20261021`，17项源码/测试/夹具SHA与冻结清单逐字节吻合；未改构造源码、工单或人门。以下是复查方实际执行的四步记录。

### ① 独立复跑

先核CLI实际支持 `--base`，执行 `node scripts/scoped-gate.mjs --base ada24193d --run`，正确识别22文件/full范围；eslint退出0，depcruise退出1，仅指定 `games/game113/guide-art.ts → src/assets/asset-index.ts` 原基线。独立阅读续跑器后补原full计划，使用原断言、原超时、maxWorkers4/minWorkers1；原生spritegen文件从Vitest排除，交原生node:test执行，没有新增NoSuite基线。

| 步骤 | 独立退出码 / 结果 |
|---|---|
| actual scoped --run | 1，eslint0 / 指定depcruise1 |
| spritegen原生node:test | 0，5项 |
| tsc / build | 0 / 0 |
| Vitest全量 | 1，6556/6557；pending/todo=0；635个实际文件中仅指定围栏1文件/1断言失败 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2，仅game-a art-03、game-c art-017在案缺文件WARN |

日志 `/private/tmp/aiflow-t5-independent-{scoped,complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`，机读 `aiflow-t5-independent-vitest.json`、`aiflow-t5-independent-steps.json`。完整续跑器退出0，末行“除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）”。

### ② 自选不同锚点撤修验红

只在自己的另一个隔离副本 `/private/tmp/apollo-character-review-fixed` 撤修。该副本17项源码先与正式冻结点逐字节匹配，每处先断言锚点恰命中1，再baseline0→撤修1→恢复0；没有改正式门禁树。

| 独立撤修 | 实际红灯 |
|---|---|
| return发布从原已验证Buffer改成await后重读磁盘结果文件 | 自己的并发篡改探针命中AssertionError：写出的SHA实际 `2d01a723…`，应为原快照 `c2552e15…`。恢复后源/结果在await期间实际改变，发布仍是原已验字节、8份输入快照SHA均吻合 |
| 原生启动保护误去掉sandbox条件，使正常授权环境也被拦 | `does not mistake unrelated fake-process unit fixtures or other platforms for this observed failure` 命中AssertionError：正常darwin/sandbox=null应为null，实际返回拦截理由；恢复后通过 |

日志 `/private/tmp/t5-independent-red-{immutable-return,authorized-launch}.log`、`t5-independent-restored-{immutable-return,authorized-launch}.log`，汇总 `t5-independent-red-summary.json`。第一处是自选TOCTOU断言，不靠另一门提前拒收冒称验红；第二处仅纯函数与harmless Node替身，**验红没有启动原生Blender或再次制造崩溃弹窗**。

### ③ 对抗与实证

- 早期独立发现并打回的三个漏洞，已用自己的原探针对最终源码再次验证：多clip回灌由单clip门拒；默认scene不含skin mesh由实际可达几何门拒；非FBX纯文本由binary结构门拒。前两项使用有效binary FBX，确保未被FBX门提前遮住。另明确带mock的源rig不能进入真实候选。最终报告 `/private/tmp/t5-independent-final-adversarial.log`（输入证据目录 `t5-independent-adversarial-oxNDcR`），stderr同名。
- 早期另发现PATH别名漏口；最终绝对路径、物理symlink、PATH别名均已独立复验。9项专门测试通过，实际断言假进程未启动；源SHA匹配正式提交。纯函数正常授权环境返回null，不清环境变量、不绕过权限、不声称所有Blender崩溃已修。
- 定向早期177项、修复轮97项及9项启动保护已独立运行；最终全部纳入上述6557项全量。独立TOCTOU探针使用自己临时目录中的测试白名单/确认记录，不触碰真人名单、不签真实人门；严格验证发布消费同一份已验输入快照。
- **真实Blender证据来自本复查人在早期轮亲自执行的双跑**：`/private/tmp/apollo-character-independent-real-20261020/report.json`，不是施工人的报告。两轮各idle/walk/reach共6个实际GLB，三种播放pose不同，最大蒙皮顶点变化分别0.16327356 / 0.53469896 / 0.77072907米，重复导出semantic/pose一致；统一骨架SHA `d978ae66d7bc3e72a8a846741ab3a946c1d9578d327cf80c7631f4bcea8d46a2`。
- 早期真实执行后，Blender夹具源码逐字节未变，direct runner差异仅新增启动guard的import/call，原播放/复现逻辑未变。正式轮用最终GLB校验器重新读取上述6个真实文件，全部通过默认scene实际可达、蒙皮、单clip、31采样与骨架指纹；记录 `/private/tmp/t5-independent-final-existing-glbs.json`。**正式轮没有再次启动原生Blender**。这些报告source为generic-blender-fixture、realArpValidated/realMixamoValidated为false，不是ARP/Mixamo生产证据。
- 正式轮另独立解析已有 `/private/tmp/t5-official-blender-motion.fbx`，得到binary7400、254对象、307连接、162曲线、5022采样、1秒；记录 `/private/tmp/t5-independent-existing-fbx.json`。这里只独立验证该文件格式，没有重新导出或将作者给的来源说明当许可/Remap证明。T4→真实四图的作者实证仅作导航，未冒充本复查人的独立重跑；本轮可判范围的prepare/render接线由确定性Mock与既有T7协议覆盖。

### ④ 读取告警、崩溃栈与边界

已读完整门禁和自己的实证日志。唯一拓扑软环日志来自topological-sort故意测试的既有 `[L,P]`，不是本改动引入；构建仅既有chunk大小提示；台账仅上述两项在案WARN。缺ARP/缺适配器、proposed未确认、Mock降级与结构拒收均有明确日志和非零/模拟域区分，不能被读成真实生产成功。

只读实际诊断 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/blender.crash.txt`，确认 `_platform_strstr → supports_barycentric_whitelist → MTLBackend::metal_is_supported → GPU_backend_type_selection_detect → wm_homefile_read_ex → WM_init`，Python backtrace为空。未重演启动崩溃、未删除诊断或改变用户系统设置。保护仅覆盖已识别的Mac seatbelt/已知Blender入口；任意自定义wrapper与其它原生崩溃不在保证内。

S3手册公开了人工文件落点、SHA失效、标记确认/版本归档、Mixamo逐clip下载与回灌入口；没有代做确认、下载付费插件、写入真人姓名、发布资产或签生产门。本次离线工具范围没有剩余阻塞。**真实ARP受测版本适配器、真实Tripo人物与Mixamo动作、许可及人工动作质量/E2实际绑定继续保留待验，不以本判词关闭。**
