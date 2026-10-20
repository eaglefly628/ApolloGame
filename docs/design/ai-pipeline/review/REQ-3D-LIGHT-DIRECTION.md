# Review 单 · REQ-3D-LIGHT-DIRECTION

| 项 | 说明 |
|---|---|
| 工单 | 兑现Light3D已声明的directional/spot方向归一化契约 |
| 分段锁 | a47bd5d63，2026-10-21，先单独推锁后施工 |
| 施工 | 本session；独立复查人不参与产品或探针施工 |
| 复查 | 独立复跑、撤修验红、实际反例与告警阅读；施工方不给自己结论 |
| 提交 | 见本单施工提交历史；提交信息附session URL |
| 改动面 | `src/renderer/three/lights.ts`；新增`src/renderer/three/light-direction.test.ts`、`scripts/verify-light-direction-browser.mjs`、`scripts/fixtures/light-direction/browser-probe.mjs`；新增`docs/design/ai-pipeline/light-direction.md`、本Review；`docs/playbooks/3d.md`一行导航；`docs/workflow/requests-3d.md`本单状态 |

## 做了什么

三路已有方向读取在原缺省分量填齐后，对有限非零向量做maxAbs缩放+hypot单位化，继续交给three原生灯光与阴影。无Light路径精确保留；零/非有限值保留原数值和原生行为，跳过归一化用有界WARN交代。没有新增协议、capability、sim逻辑或游戏层代码。

## 逐条怎么自己验

| 核什么 | 独立复跑方式 / 预期 |
|---|---|
| 先有真实缺陷 | 旧LightRig+原生ShadowCamera/WebGLLights报告 `/private/tmp/apollo-light-direction-research-20261021/report.json`：unit主灯中心NDC.z=-.44144，8倍后3.59459且出视锥。另真实Chrome旧源隔离副本`/private/tmp/apollo-light-old-source-w2jqsaqx`，用相同GPU工具可重现unit主阴影深度48179个占用采样、8倍0；不是用mock判断真实GPU |
| 三路有同一把尺 | `npx vitest run src/renderer/three/light-direction.test.ts src/renderer/three/lights.test.ts`：新增37+原8例；实际WebGLLights、ShadowCamera、Frustum与Float32上传可表示性，unit/8倍/tiny/MIN/MAX，各路缺省/partial |
| 无Light兼容 | 同上精确native矩阵断言（包含-0），先用数据光再回无Light，位置/光色/强度/lightSig均回原值；真实GPU `--case legacy --legacy-reference <旧report>`逐字段相同 |
| 无效值不偷偷新政策 | 同上zero/NaN/±Infinity按旧原数值及原生行为；当前entity/value状态一次WARN，恢复/移除/无Light/换scene/dispose清记录，反复变值也不保历史缓存 |
| 输入只读 | 两个真实World、20k次CPU更新，完整快照/full+incremental hash/writeSequence/dirty不变；GPU每次真实renderer.sync也比较同一组指标 |
| 实际GPU方向/阴影 | `node scripts/verify-light-direction-browser.mjs`：main/extra/spot各unit/8/1e-300/1e300独立renderer，总13场景。方向uniform/原生朝向/阴影camera视图投影裁剪/原生PCF深度/画面像素比对；main与spot关receiveShadow另拍，必须存在真实影差。extra原本不投影，不把主灯影当它投的影 |
| 资源与日志 | GPU报告destroy前forceContextLoss拦截内检查native四类handles与GPU计数0；重复destroy无再释放，完整World保持到destroy；有效方向无未知WARN |
| 已结案不回退 | 原样ENV三路与V1五节奏工具，各自原始文件SHA不变，回归报告另附 |

## 施工方重点标出的兼容变化与边界

1. 显式Light3D完全没填dir时沿原缺省方向，但按原接口承诺变成单位长度；主灯距离从原缺省向量长度×3.2radius改成3.2radius。完全没Light3D的老默认路径不变。独立复查请分别核这两个分支。
2. 零或非有限方向仍然可能产生无效原生矩阵；本单不宣称支持它们，不混入新的fallback/reject语义。日志只存当前无效状态，随已处理灯清理。
3. spot现有跳渲签名疑点不在本次修复；每个GPU变体独立renderer不依赖其方向变更失效处理。世界坐标本身极大而不能表示加1，也非方向归一化承诺。没有付费资产、人门或视觉质量通过声明。

## 撤修验红（施工自证，不是复查判词）

CPU报告 `/private/tmp/apollo-light-direction-red-7f7mjzz5/report.json`：原绿37，19个关键锚点分别隔离副本撤修、每次anchor uniqueHits=1；各退出1且实际AssertionError，精确恢复后37绿，productionUnchanged=true。包含三路接线、maxAbs数值稳定、partial/no-Light、无效值保留与日志清理。不能用编译错误或超时充当红灯。

GPU最终同版旧源反例`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-light-direction-browser-2bV7oL/report.json`，恢复`.../apollo-light-direction-browser-rgOv5A/report.json`全13场景exit0。5个GPU锚点（stable-helper、main-direction、extra-direction、spot-direction、legacy-default）各anchorHits=1、撤修exit1、恢复exit0、恢复产品SHA精确一致；完整原锚点/替换literal、实际失败指标与每个report在`/private/tmp/apollo-light-gpu-withdraw-aj9b7nu1/receipt.json`。主灯8倍撤修后cameraView/frustum/depth/pixels不符且actualShadow=false；extra/spot极值方向uniform和像素实红；legacy撤修是与旧默认字段exact=false，不使用运行超时、TypeError或不存在Chrome当红。

恢复版三路四种比例实际uniform分别一致；主灯PCF占用采样48179、spot22603，影差像素分别10569与25746。no-Light与最终同版旧源逐字段精确相同。13场景26次sync只读检查；post-init原生跟踪buffer195/195、texture60/60、framebuffer30/30、renderbuffer0/0，在forceContextLoss前contextLost=false、GPU geometry/texture=0、native live=0；重复destroy不多释放，spot两个shadow RT各dispose一次。extra不投影，报告里的shadow只用于主灯对照，不能读成extra投影验证。

产品与测试SHA：lights.ts `ffd63b749bc8e739f0abdad56662e800d5eba844b486e2e4c29c39fa5483ef17`；light-direction.test.ts `7adb470960a5166cd8f5f022fd0eaceef5e9e2d1c4a810d91cb20cf9dc9d59b9`。GPU工具SHA：entry `68787758eb3926c07a1d151536a9d10f9ee2d5aada77cd40ed2071a12990dbcd`，browser `37793f513462802703fb1bfa9c54812e2438cbd7a7188d77dcd3db5e44ad41c5`。

## 门禁与交付收据

施工定向45/45、tsc与两源ESLint各exit0。实际完整scoped门禁 `/private/tmp/aiflow-light-final-scoped.log` exit0，665文件7115/7115；各步eslint0、depcruise0、tsc0、vitest全量0、build0、docs-ref0、context-budget0；art-ledger-guard2仍仅game-a/art-03与game-c/art-017旧死账，沿守卫原allowExit规则，无新增豁免。额外原生spritegen5/5 exit0、sim-dom-fence exit0；收据 `/private/tmp/aiflow-light-final-step-exits.json`。末行`✅ 门禁全绿（scope=full）`。

日志逐块对照ENV已核基线：222个stderr上下文，差异为临时PNG路径、旧storage模拟配额栈、scene验证拒收重复次数及HappyDOM teardown AbortError；没有Light新运行时WARN，没有未处理异常汇总或浏览器缺失。旧topo negative循环/Mock降级/拒收测试告警、构建chunk提示及美术旧账仍如实保留，不用exit0代替告警阅读。新CPU故障输入WARN由具名测试spy并断言内容和次数，真实有效GPU场景无WARN。

GPU最终probe只增加显式pre-forceContextLoss收据与spot双RT所有者观察，不替换输出或产品逻辑；最终SHA见上，独立复查须以该版为准。GPU撤修与原ENV/V1回归逐项收据见本节完工追加；独立复查判词由独立复查人单独提供。

### 冻结后原工具回归

- 原ENV三路`.../apollo-environment-browser-dGbgyX/report.json` exit0；Sky/Room/HDRI反射、脏标、缓存与销毁不回退。
- 原V1五节奏`.../apollo-v1-browser-Xcvg0A/report.json` exit0；提水壶原始manifest/CPU/browser与fixture工具不改，仍是原动作、IK、挂点、镜头数据。
- 完整施工证据持久目录：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/light-direction-final-20261021/`，含冻结4文件、旧/新同版13场景PNG与report、CPU19/GPU5撤修、原ENV/V1回归、完整门禁与告警收据。截图为技术测试场景，不能作生产美术或人门通过声明。

---

### REQ-3D-LIGHT-DIRECTION 独立复查判词（2026-10-21）

独立结论：本单既有 Light3D 方向归一化契约修复通过独立交叉复查。审查提交 `281cc2a5044427f1b815087e6c8eb7a2d57cebbe`，父提交 `4890f18c6a7490cf3bed28f9026ddf3d48dd78d1`。复查人未参与产品或探针施工；本次在 `/private/tmp/apollo-light-independent-20261021` 及另一个自有旧源码副本中完成独立复跑、撤修、原反例和告警审读。未写施工/用户工作区，未提交、推送、启动 Blender、调用付费服务或签真人门。施工 Review 和收据仅用于导航，没有代替我的执行结果。

不可变提交中全部 1181 个 src/scripts 文件的集合及逐项 Git blob 与实测副本完全一致，无多余、缺失或漂移；产品、CPU测试、GPU入口、browser 四项冻结 SHA 均一致。契约、Review、3D手册和 requests-3d 四文档从该提交读取并核原文，最终 docs-ref/context-budget 又独立运行各 exit0。对账原文在 `independent-proof/final-immutable-commit-audit.json`，原生回归结束后再次核对仍一致。变更面为一个既有 LightRig、专属测试/探针及文档，没有公共协议、capability、sim、游戏或 PUI 修改。

**CPU 与自选边界。** 我独立运行新增37例、既有 Light8、ENV11、Camera25，再加自己编写的8例，共5文件89/89，failed/pending/todo=0，报告 `logs/apollo-light-independent-restored-focused.json`。原生 WebGLLights、ShadowCamera、Frustum 和 Float32 矩阵均实际参与；没有用 mock 方向函数替代。新增37例中两实际 World 共20k次更新的 snapshot/full与incremental hash/writeSequence/dirty不变，partial/default、MIN子正规数、近MAX、无效值及诊断清理均已亲跑。

我的8例另核：三路单轴 MIN/MAX、全MAX、MAX与MIN混合，在旋转相机下与原生参考方向/阴影矩阵一致且有限；从数据光回到无Light，在三组平移中心/半径上与不可变旧 LightRig 的位置、矩阵、光色、强度和子对象类型逐值相同；zero/NaN/±Infinity包括原生NaN矩阵与旧版一致；无效spot掉出局部灯预算时清诊断记录、重新进入时只再记当前一次。测试及不可变旧源码保存于 `independent-proof/light-boundary.test.ts.evidence`、`legacy-lights.ts`。自己的8例没有混进下述正式全量计数。

兼容口径分别核过：完全没有 Light3D 的历史暖主光/冷补光精确保留；显式 directional 没填dir时，仍先补原 `(-.78,-.62,-.5)`，再兑现单位化承诺，因此主灯距离改为3.2×radius，这是实际兼容变化，不能写成所有既有画面逐值不变。部分分量也先补原缺省。zero/非有限输入只跳过归一化并有界WARN，仍保留旧数值及可能无效的原生结果，未被当成有效方向或悄悄加fallback；point/ambient与原预算未变。

**自行选择的唯一锚点撤修。** 在自有副本将唯一 `return { x: x / length, y: y / length, z: z / length };` 撤为 `return go;`，先断言hit=1。CPU点名8倍主灯用例真实 AssertionError：距离25.6应为3.2，exit1；精确恢复产品 SHA `ffd63b749bc8e739f0abdad56662e800d5eba844b486e2e4c29c39fa5483ef17` 后89/89绿。第一次名称过滤漏掉展开标题中的引号，实际全跳过/exit0，未计为红灯；原记录保留，纠正过滤后才计上述真实红，见 `independent-proof/normalization-withdrawal.json`。

同一锚点再做真实GPU撤修：正式13场景先绿；hit=1撤修后 `native-withdrawal-red/report.json` 实测 main8 的深度占用0、关影像素差0、中心出阴影视锥，cameraView/frustum/depth/pixels/actualShadow比较拒收，report.ok=false且进程exit1。不是编译错误、TypeError、Chrome缺失或超时。精确恢复同一SHA，再完整13场景绿且旧无Light逐字段相同，证明 `independent-proof/native-unit-withdrawal.json`。这是我自己执行的同一锚点CPU和GPU闭环，不冒称重跑施工方全部19/5锚点。

**不可变旧源码反例与正式原生恢复。** 我另建 `/private/tmp/apollo-light-independent-old-native-20261021`，旧 LightRig 来自父提交 Git blob（SHA `a79ab2023804354772ba40745947222daa73b76927c6ce5913ec890220d3ced7`），只装相同最终探针。报告 `old-native-counterexample/report.json`（原目录 `apollo-light-direction-browser-ikA3qa`）实测：main单位输入PCF深度占用48179、实际关影差10569像素；同向8倍变为占用0/影差0，中心NDC.z约3.590705、出锥，但有效方向uniform未变。三路1e-300/1e300的上传方向都退成0，报告7项比较失败、进程exit1。该夹具的中心/半径与施工CPU研究不同，以上数字取我自己的报告。旧版单位与8倍主灯PNG已目击，有影→无影的实际差异成立。

最终源码正式报告 `native-final/report.json`（`apollo-light-direction-browser-kN7TUD`）exit0；撤修精确恢复后的完整报告 `native-restored/report.json`（`apollo-light-direction-browser-ekrFmP`）亦exit0。全部原生运行首步即使用授权宿主环境和显式固定Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，没有改阈值或超时。三路×unit/8/1e-300/1e300，加无Light共13个独立场景、12项跨比例比较全真：实际上传方向uniform、原生朝向、阴影view/projection/裁剪、实际PCF depthTexture采样和主画面像素符合预期。MIN/MAX/partial的实际WebGLLights与shadow边界在CPU层验证，未冒称它们都是这13个GPU输入。

主灯四种比例均PCF占用48179、关影差10569像素；spot均22603、25746。额外directional只验证它的uniform/照明像素；它原本不投影，报告中该路线的shadow来自主灯对照，未误读成额外灯投影。深度证据来自原生PCF depthTexture的sampler2DShadow观察，不是颜色附件；观察着色器没有替换产品灯光/阴影输出。已目击恢复后的main8真实阴影、extra极大方向光照和spot极小方向阴影。无Light与我自己旧源报告的 uniform/nativeRay/shadow/pixels/shadowPixels/camera 六字段逐项精确相同。

13场景26次renderer.sync纯读检查，并在完整World仍加载时直接destroy、重复destroy；每次 `beforeForceContextLoss` 明确contextLost=false、GPU geometry/texture=0、四类native live=0且create=delete。合计init后buffer195/195、texture60/60、framebuffer30/30、renderbuffer0/0；spot两个shadow RT各dispose1，其余对应主RT各dispose1，context-loss各只调用一次。它们是init后被跟踪分配的回收，不是全进程物理显存承诺。13个有效场景的console/page诊断均为空。

**原工具共享回归。** 原ENV入口/browser SHA未变，我独立跑 `env-regression/report.json`（`apollo-environment-browser-NiFKYa`）三路exit0，105次纯读，Sky/Room/HDR四类handle依次为68/16/1/0、61/6/3/1、334/45/29/1创建并全部删除，所有者各一次；完整World直接destroy的既有pre-loss断言通过。ENV三张PNG与我前次独立终验 `oYvuzp` 逐字节同，本次再次目击。唯一WARN为刻意坏HDR在hdr-bad-first的bad initial token，重试/steady/destroy没有重复，完整栈已读。

V1原manifest/两探针SHA未变，我独立跑 `v1-regression/report.json`（`apollo-v1-browser-0mfhTA`）exit0。五种节奏各2000tick，完整/incremental hash序列逐项相同；销毁后五次GPU0/0、native buffer113/113/live0（带五次重载）或28/28/live0。七张PNG与前次自己独立报告 `8Srl3R` 逐字节同。20条诊断均为load/reload尚未ready时既有Attach/IK各一次，ready=false与阶段逐条核过，没有ready后新增告警。不把V1夹具owned maps=0代替ENV或Light原生资源覆盖。

**完整门禁与告警。** 自有Git副本按父提交实际改动面分类为FULL，ESLint、depcruise都独立实际全跑，没有无Git副本scoped0替代。strict=1、宿主环境显式fixedChrome，Vitest maxWorkers4/minWorkers1。`logs/apollo-light-independent-full-steps.json`记录：

| 步骤 | actual exit / 结果 |
|---|---|
| ESLint / depcruise / sim-DOM | 0 / 0 / 0；1461 modules、5251 dependencies，零越界 |
| spritegen独立node:test | 0，5/5，无failed/cancelled/skipped/todo |
| TypeScript / Vitest | 0 / 0；665文件7115/7115，failedFiles=[]、failed/pending/todo=0 |
| build / docs-ref / context-budget | 0 / 0 / 0；提交后四文档最终guards另跑0/0 |
| art-ledger | 2，仅既有允许档；缺来源0，旧黑户5/死账2如实保留 |

没有旧game113红例外，也没有NoSuite/EPERM/NO_BROWSER当通过。每步日志已读取。全量221个stderr段、399条去重提取行（含并发子进程交错的info）与我已阅ENV日志对照；367行语义一致，其余32行已逐行读，均为临时路径/job hash或交错的mock/fixture commit/decision消息，无Light新增运行时WARN。故意L/P定序环、Mock降级/坏输入拒收、人门拒收、存储配额注入、HappyDOM取消/localhost拒连仍按原负例语义保留，无Unhandled/uncaught汇总。build三个>500kB chunk提醒，以及game-a art-03、game-c art-017旧缺文件WARN2未消音。告警原文与对照保存在 `logs/apollo-light-independent-warning-audit.json`；CPU无效方向日志由具名测试核内容、次数及缓存清理，不把spy静音当作无日志证据。

本单没有剩余实证阻塞。通过范围限于既有有限非零方向的归一化、三路原生接线和上述兼容/生命周期回归；极大世界坐标造成target加单位向量不可表示，以及spot只改方向/角度/penumbra的既有跳渲签名疑点，不因本次比例输入独立renderer测试而获通过声明，也未混修。技术夹具没有生产美术质量结论；`realTripoValidated/realMixamoValidated/realArpValidated/productionApproved/formalV1Validated/humanR1Validated`仍false。

独立证据持久总收据：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/light-direction-independent-20261021/independent-receipt.json`。文中短路径均相对此目录，含实际全量日志、独立测试与撤修literal/命中证明、原生旧红/正式/撤红/恢复报告、PNG、原ENV/V1回归、冻结源码及不可变提交指纹。复查署名：独立交叉复查agent，非本单施工人。
