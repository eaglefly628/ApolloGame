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
