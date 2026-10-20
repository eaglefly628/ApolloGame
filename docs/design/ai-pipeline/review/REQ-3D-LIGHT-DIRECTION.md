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
