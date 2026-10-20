# REQ-3D-AI-PIPELINE · V1 离线整链预验交付导航

> 施工主体：Codex；分段锁deb7e4024；计划12fa38b7b已附独立评审。本文是施工导航，复查方须独立执行，不采信自陈为通过判词。真实Tripo/ARP/Mixamo、生产美术与真人R1未验，不签人门、不自判PASS。未修改src、games或PUI。

## 做了什么

用19个已有provider和render-only闭集数据串起：idle→真实导航贴地→到站停稳→外部动画/右臂IK伸手→Signal及Commit显隐交接→骨骼挂壶抬升→镜头切换。规范manifest不藏自由玩法system。导航站位与面对把手独立，两个同臂IK链依次作用于独立world锚，不从当前手持物反追自身。最终制作数据固定，运行期不临时改位姿补交接。

新增独立资产包工具，6项AssetIndex/group=v1；源GLB、动画、骨架、场景数据与几何SHA实查，外部动画字节保留，hero只去内嵌animation。水壶来自MIT three TeapotGeometry，4032三角形、高.35m，真实把手顶点落账。普通门禁用明确合成单元输入、无网络/Blender/凭据；本机真实GLB/GPU整链另跑并分层记录。细节见 `docs/design/ai-pipeline/v1-offline-integration.md`。

## 改动面

- `scripts/fixtures/v1-teapot/{manifest.json,cpu-scene.mjs,browser-probe.mjs}`：规范闭集数据、单元场景、浏览器采样断言。
- `scripts/lib/v1-teapot-fixtures.mjs`、`scripts/prepare-v1-teapot-fixtures.mjs`、`scripts/v1-teapot-fixtures.test.mjs`：离线资产组装/校验与16项测试。
- `scripts/v1-teapot.test.mjs`：8项CPU接线、原生动画/IK与双World测试。
- `scripts/verify-v1-teapot-browser.mjs`：真实GPU入口，报告/截图/帧序列；无生产发布、人门或流程签字。
- 本页、分层契约、Game Z能力计划的key说明、3D手册一行与总单状态；不动已结案工单或其它施工方文件。

## 怎么自己验

1. `npx vitest run scripts/v1-teapot-fixtures.test.mjs scripts/v1-teapot.test.mjs --maxWorkers=2 --minWorkers=1`，24项退出0。单元输入不读取本机已有T5/场景文件；不能据此声称真实GLB整链通过。
2. 资产测试16项：实际Teapot顶点/拓扑/米制、MIT源码与许可SHA；真实AssetManager/ModelAssetLoader/group释放重载；原动画与骨架保持；非空/链接/覆盖/竞态写入拒收；坏scene SHA/几何/mock标记、伪paid/approved/采样/clip/骨架拒收；raw壶尺寸/压缩拒收；CLI导入无副作用。
3. CPU8项：实名provider与SceneImport实际几何目录；真实停步后reach Flag；contact Signal发布时旧显隐尚在、同tick Commit后完成交接；导航与面对目标分离；原生Graph idle/walk/reach保持及参数只读；双IK链渐变、dt0不跳、最终抬升；镜头Signal闭集；真实壶把手与台面；2000tick双World完整/增量hash、snapshot/delta/writeSequence/dirty对拍。
4. 真实浏览器按契约先准备独立资产包，再执行verifier，检查报告的固定manifest SHA、五种render节奏、实际boneTexture读回、挂件/手端/把手连续、像素/阴影/公开pick、资源与World只读。不能只查配置和非黑截图。

## 撤修验红

只在额外自有副本撤关键代码/数据，唯一锚点hit=1；实际AssertionError exit1，精确恢复后exit0。不把TypeError、编译失败或超时计作红灯。

| 面 | 实际撤修与恢复 | 收据 |
|---|---|---|
| 资产22处 | 16项baseline0→逐处实际AssertionError1→每次restore0，最终16/16；clip负例改成第二个合法不同名clip，隔离本层约束 | `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-v1-fixtures-red-mc9wss1l/report.json` |
| CPU21处 | textual+structural hit1；到区宽度、idle、reach/carry、显隐、绑定/目标、同key、把手台面、镜头Signal等；逐处0→AssertionError1→0，最终8/8 | `/private/tmp/v1-teapot-cpu-red-20261021/report.json` |

CPU撤修使用制作期校准前快照f91e2bac…；收据明确记录该SHA，原生挂点首轮标定后76f12f3f…已重跑8项。第二轮仅更正sun静态单位方向，最终清单2cede7f38b4b283580b136e46cd401ba1a84fe519d8bc4ac770c7a96ed18308a另按新基线重跑，不偷换快照。最初关闭reach导致测试解引用undefined的TypeError未计，增加明确存在性断言后重跑21处，全部真正AssertionError。

## 门禁与真实证据

最终8项源/数据SHA清单 `/private/tmp/aiflow-v1-frozen-sources.json`，基底551c17e99360a4a6a14b439a2c7c608168065f5b；manifest2cede7f38b4b283580b136e46cd401ba1a84fe519d8bc4ac770c7a96ed18308a，浏览器fb541212ebb7d3c4acef2b85f06f5f8ba278e05a30e9fafea4c885e52f31a7ab，入口9c5da626509e3feb085f29ba430e0b0128b91e7d99f5b7d3cf705becd148834a。

实际 `node scripts/scoped-gate.mjs --run` 退出0，末行 `✅ 门禁全绿（scope=full）`；最终源码版本运行，非零改动空门禁。日志 `/private/tmp/aiflow-v1-frozen-final-scoped.log`，步骤码 `/private/tmp/aiflow-v1-final-step-exits.json`。远端fcbfe2f76已修game113旧基线，0689f9a25正确分离原生node:test；本单只合入，不修改那些文件，最终不使用旧dep/fence例外。

| 步骤 | actual exit / 结果 |
|---|---|
| eslint / depcruise / tsc | 0 / 0 / 0 |
| full Vitest | 0；663文件7067/7067，无失败/待办/Unhandled Errors汇总 |
| build / docs-ref / context-budget | 0 / 0 / 0 |
| art-ledger-guard | 2；既有game-a art-03、game-c art-017路径缺文件WARN2，scoped既定允许档；另实际单跑核码2 |
| 原生spritegen node:test | 0；5/5，独立执行，不混入Vitest |

首轮新base完整门禁同为0、7067/7067；随后补“每个held实际render都核完整挂件矩阵”观测一行，浏览器SHA变化，因此最终重跑整轮，不把首轮当最终源证据。首轮222个stderr上下文/191去重行已逐项读：现有坏输入/Mock降级/人门拒收、故意L/P拓扑环、HappyDOM localhost:3000连接拒绝；build大chunk与旧台账WARN如实保留，没有新增V1运行时错误。正式GPU证据另列，施工方不填写复查通过判词。

### 最终真实GPU与撤修

最新基底551c17e99、冻结8文件，正式baseline报告 `apollo-v1-browser-ZZfuk3/report.json`；五个渲染接缝各撤唯一hit1锚点，源码SHA逐项恢复后，最终完整重放为 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-v1-browser-Ign0v6/report.json`，退出0、五节奏全部完成。完整收据 `/private/tmp/apollo-v1-gpu-withdraw-8twyjwmh/receipt.json`。

- 撤native外部Mixer：walk实际动作断言红；撤IK：真实手端距把手.804414m；撤最终E3sync：dt0交接手未动但把手跳.829345m、矩阵差1.467602；撤E6 native applyView：相机实际矩阵差1.636123；撤shadow update：真实PCF depthTexture缺失。全部exit1，均永久断言而非超时/TypeError；精确恢复后完整五节奏exit0。E3被更早的原生连续性断言拒收，临时收据只纠正预期报错文字，未放宽断言。
- 30/60/120Hz及每render追赶2/5个sim tick；reach134、contact195、held226各次一致。60Hz专门dt0边界手位移0、把手位移2.079e-8m、壶完整矩阵差5.960e-8；正常节奏有时间流逝，不声称其位移为0，实际手/把手位移约.018862m/8.33ms、.071135m/33.33ms、.155942m/83.33ms，逐render受原生连续性断言约束。
- 真17骨GLB：precontact手端误差4.174e-8m，carry误差3.933e-8m、抬高.25m；实际GPU骨纹理RGBA/FLOAT读回palette误差0。完整挂件矩阵逐held render核对，原生误差0；相机由原Signal触发，实际native矩阵与独立采样一致；公开pick只命中当前可见壶，没有旧实例ghost。
- 每次真实backend.sync前后核完整snapshot/full与incremental hash、真实writeSequence/version/dirty；每种节奏2000tick双World一致。最终五次累计8695次纯读检查。PCF用实际depthTexture原生sampler2DShadow读回，idle6798b29f→walk9de068b8（120Hz为e2607bdf）→接触8c0a75e3，非仅看color attachment；截图与像素另在报告。
- steady均为7geometry/4texture/28native buffers；5次真实驱逐重载后平台不长。含重载的destroy buffer113创建/113删除/live0；其余4次28/28/0。forceContextLoss前原生WebGLTexture handle Set归零，最终gl.info geometry0/texture0、模板/实例/动作/解析队列0。当前直光配置material-owned maps为空，不把空的dispose-once条件冒充Sky覆盖。
- runtime共20条、只两种精确预期消息：Attach无drawable与IK model未就绪；5次初载各2条、5次重载各2条，均对应实际未就绪阶段；steady无新增，未知WARN/error拒收。parser的11类render-only无provider提示保留并解释，不添加空provider。

可持久查看的最终真实7阶段PNG与frames.html（采样帧序列，不冒称连续录像）、report、冻结表和门禁日志放在 `/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/v1-teapot-final-20261021/`。正式V1、真实付费来源、productionApproved及humanR1均false；本段browser未启动Blender。

## 已知局限

- 角色/动作、场景和水壶是可追溯自产技术替身，不是生产美术；付费来源、授权动作质量、地面弯腰、关节自然度与真人R1仍未验。桌面取壶不冒称地面拾取。
- 原始未压缩壶用于本段演示。既有T4另经本机Blender真实后台规范化为Draco 132728→23024字节、退出0，但该压缩产物未用于本段包；旁证目录为 `v1-kettle-normalization-20261021`，不冒充Tripo。
- 原生Sky/IBL旧生命周期失败已真实发现并留证；当前固定配置不启用可选Sky，仅sun/fill。旧问题未当基线或已修，将另锁修复，不能靠放宽GPU归零断言掩盖。

## 交叉复查

待未参与本段施工的独立复查方完成自己的复跑、撤修、实证与告警核对。本文不代表正式V1结案。


### V1 离线整链独立复查判词（2026-10-21）

复查人：独立复查代理，未参与本段施工。审查提交 `74cdf9619fd2fc54daf83c0dea56cb18344c94aa`，基底 `551c17e99360a4a6a14b439a2c7c608168065f5b`。**结论：该冻结配置的离线整链技术预验独立复查通过，无本段遗留阻塞；正式 V1、真实付费/授权来源、生产美术与真人 R1 仍未验证。** 施工 Review 仅作导航，本判词依据以下独立证据。

在自有 Git 副本 `/private/tmp/apollo-v1-final-independent-20261021` 复查；全部 src/scripts 共1175项内容逐项与审查提交 Git blob 一致，8项冻结清单全吻合，最终manifest为 `2cede7f38b4b283580b136e46cd401ba1a84fe519d8bc4ac770c7a96ed18308a`。独立 full 以551c基底上的实际12文件delta分类为FULL，再完整执行门禁；不是无改动副本的空scoped。提交后的5份文档亦已复制Git原文字节，另跑docs/context均0。本段提交未改src、games或PUI；新基底的GroundTeleport及game113围栏修复均已纳入独立验证，不沿用旧dep/fence豁免。

独立定向两文件24/24，exit0，failed/pending/todo均0。19个显式provider、6个实际资产key、停步后134tick reach、195tick发布后Commit显隐、独立导航与朝向、外部动作/IK/镜头及2000tick双World检查均复跑。另独立CLI复用现存真实T5/场景字节生成 `/private/tmp/apollo-v1-independent-real-bundle-20261021`，六份GLB与施工包逐字节一致，SHA与原骨架/外部动作保持，paid/production字段均false。自选9个坏输入：四项来源/批准旗标分别用true或字符串false，以及保留SHA却改导航几何的候选，全部在写输出前拒收。新基底上的自选实证还包括133/195tick恢复后重播到360保持snapshot/full与incremental hash一致，以及越界GroundTeleport意图只消费、完整结果等于正常V1对照。

独立撤修有两处，均唯一锚点hit=1且精确恢复：①撤掉资产工具的paid/production输入守卫，原approval拒收断言实际变为promise resolved，exit1；恢复源SHA `a916955a…` 后24项再exit0。②只在自有manifest副本把held Attach.offset.x增加.05，真实浏览器在194→195tick、dt0、手位移0时测得把手跳 `.0499999936m`，原生连续性断言直接exit1，无TypeError或超时；副本精确恢复最终manifest SHA后，完整五节奏再exit0。canonical源码未被该数据对抗改动。

最终独立真实GPU恢复报告为 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-v1-browser-XBIPAc/report.json`；首次全量重放为同目录上层的 `apollo-v1-browser-ndqOsI/report.json`，红灯为 `apollo-v1-browser-8pT1Hf/report.json`。使用固定Chrome、宿主授权环境，实际ANGLE Metal Apple M5。30/60/120Hz及每render追赶2/5tick均完成；五条2000tick哈希序列逐项相同，累计8695次sync纯读核对未改snapshot/full/incremental hash/writeSequence/version/dirty。60Hz零时间交接矩阵差 `5.960e-8`、把手位移 `2.079e-8m`；precontact手端误差 `4.174e-8m`、carry误差 `3.933e-8m`，实际抬升约.25m。骨纹理真实FLOAT读回误差0，最终挂件原生矩阵误差0，GPU矩阵最大误差约 `1.71e-7`。正常时间流逝下按逐render连续性断言验收，不将其位移冒称为0。

真实PCF depthTexture经sampler2DShadow观察，idle深度hash `6798b29f` 至walk `9de068b8`（120Hz为 `e2607bdf`），骨纹理/像素亦确实变化；没有将阴影color attachment当深度证据。公开pick只命中当前可见壶，相机实际矩阵与Signal镜头独立采样一致。5次驱逐重载后稳定为7geometry/4texture/28个跟踪native buffer；含重载销毁113创建/113删除/live0，其余四次28/28/0，最终GPU geometry/texture与模型/动作/解析缓存均0。当前material-owned maps数量为0，不将空条件冒充纹理dispose或Sky/IBL覆盖。

已实际目击自己的idle/walk/reach/precontact/contact/carry/held七张PNG：台面接触前后连续，壶最终明显离台；恢复重放七张PNG与已目击版本逐字节相同。方块替身、动作自然度和地面阴影条纹均不能作为生产画面质量通过。截图是阶段采样，不是连续录像。

| 独立完整门禁 | actual exit / 结果 |
|---|---|
| eslint / depcruise / sim-DOM / tsc | 0 / 0 / 0 / 0 |
| 原生spritegen node:test | 0；5/5，未混入Vitest |
| 标准full Vitest（workers4/min1） | 0；663文件7067/7067，failedFiles空、failed/pending/todo均0 |
| build / docs-ref / context-budget | 0 / 0 / 0 |
| art-ledger-guard | 2；既有5黑户/2死账，缺来源0；game-a art-03及game-c art-017文件缺失仍保留 |

已读完整定向日志、全量221个stderr上下文的167种去重正文/368条去重诊断，以及build/台账和GPU告警。L/P拓扑环属于具名定序负例；其余为Mock降级、坏输入/人门拒收、存储故障注入与HappyDOM localhost连接拒绝；build保留大于500kB chunk提示。无Unhandled/NoSuite/EPERM/NO_BROWSER汇总。GPU20条仅为5次初载和5次重载各自的Attach无drawable/IK模型未就绪两条，逐条核阶段与未就绪事实，steady无新增，未放宽告警断言。

执行审计保留：最初一次轻量测试误设施工cwd，已剔除其独立证据资格并在自有树完整重跑；自写对抗脚本的输出目录与strict启动设置错误亦在修正验证环境后原样复跑，不作为产品基线或撤修红灯。最终所有正式验证均在独立树、正确strict与宿主环境完成。未修改施工/用户树，未提交推送、启动Blender、付费服务或填写真人批准。

证据索引：独立副本 `.independent/final-review-evidence.json`、`commit-blob-verification.json`、`final-withdrawal.json`、`gpu-manifest-withdrawal.json`；`/private/tmp/apollo-v1-independent-full-steps.json`及各步日志、`/private/tmp/apollo-v1-final-independent-focused.json`、`/private/tmp/apollo-v1-final-independent-red.json`、`/private/tmp/apollo-v1-independent-warning-audit.json`、`/private/tmp/apollo-v1-independent-gpu-{red,restored}.log`。固定配置不启用Sky，导航记录的Sky/IBL旧生命周期缺陷仍须另单修复，本判词不覆盖它。正式V1、realArp/realMixamo/realTripo、productionApproved、humanR1均false。
