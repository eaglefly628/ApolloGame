# Review：REQ-3D-AI-PIPELINE · T3 单图 / 四视图生成

施工锁 `775305301`（先独立推送锁行再施工）；本阶段为3D总单的T3（交付日期2026-10-20），后续T4/E1仍继续施工。施工方只交自证，正式判词由独立复查方追加；未签生产人门。

## 做了什么

接受已定T3：实查已有Tripo适配器仅V2 text_to_model，registry与资产加载器不执行远程模型生成；T1参考图读取可复用，但不能提交命名四视图或保存生成任务信息。依owner路线图§1/§3既定判A扩写，不新增自由代码入口。

新增V3单图/命名四视图上传、提交、轮询、GLB下载与来源记录；前左后右顺序固定，缺/重复/未知视图及输入混用在mock下同样拒收。单图编辑明确降级整体重生并留来源，mock零网络、输出真实可解析的模拟GLB，不把mesh替换成PNG。既有V2文字和2D接口维持原语义；新字段沿generate→pending传递，仍由原人审登记门控制，不自动写索引。

## 改动面

- `scripts/ai-gen.mjs`：按Tripo图片模式分发，mesh mock保护，generation来源字段贯通。
- `scripts/tripo-inputs.mjs`：PNG不可变快照/重算SHA、命名视图与CLI闭集校验。
- `scripts/tripo-generation.mjs`：V3请求、轮询、下载验收、显式mock与降级日志。
- `scripts/ai-gen.tripo.test.mjs`：离线、替身网络、CLI、拒收及兼容测试。
- `scripts/ai-gen.test.mjs`：隔离CLI夹具只补复制两个静态import依赖；原REFGEN行为断言未改。
- `docs/design/m2.5-registration-contract.md`：先补可选references.view/generation契约，再实现。
- `docs/design/ai-pipeline/tripo-generation.md`、`docs/playbooks/assets.md`：使用/真实限制与工具入口。
- 本Review和`docs/workflow/requests-3d.md`阶段状态。无游戏、UI、renderer、sim或资产索引改动。

## 怎么自己验

1. `npx vitest run scripts/ai-gen.tripo.test.mjs scripts/ai-gen.test.mjs`：覆盖输入哈希与快照同源、完整四视图、显式image模式不能绕过命名view完整性、mock零fetch及GLB、edit降级、pending不写index；旧2D PNG和Tripo V2文本回归。
2. fetch替身逐次检查multipart字节及token命名映射、V3真实端点/模型/参数、task轮询、HTTPS下载不附Authorization；业务失败、HTTP失败、缺字段、未知终态、超时、无效GLB均拒收且不泄key。没有调用真实付费API。
3. 独立复查早期实证发现GLB下载验收漏项：缺BIN但JSON仍引用、非法尾chunk、外部资源仍被记成功。补全结构/资源边界及三条永久拒收测试后，请复查方复跑同一原复现。
4. 真实隔离CLI从本地图走pending，检查mock:true、四个view/SHA、generation.operation/apiVersion且无伪taskId；共享或游戏index不自动出现。输入变化必须改变mock字节。

## 撤修验红（施工自证）

在独立临时副本逐条撤修；锚点均断言恰好命中1次，finally恢复源字节，主施工目录不受影响。脚本`/private/tmp/aiflow-t3-red.mjs`。

| 撤修 | 测试锚点 | 真实结果 |
|---|---|---|
| 撤命名view必须走完整multi的守卫 | `preloaded duplicate/unknown/missing views` | exit1、AssertionError，原应拒绝的单front+显式image被接受 |
| 去掉mock替换PNG的texture类型限定 | `single PNG stays mesh GLB` | exit1、AssertionError，GLB magic断言命中 |
| CLI去掉generation传递 | `CLI mock preserves four view hashes` | exit1、AssertionError，来源字段断言命中 |

日志`/private/tmp/aiflow-t3-{views,glb,provenance}-red.log`。独立复查方另选SHA、视图次序、pending传递三个锚点，具体证据由其正式记录。另对下载结构校验作整体旧版回撤：唯一函数边界锚点命中、旧新锚点状态断言命中，三种损坏GLB全部exit1（promise resolved pending instead of rejecting），恢复后新增三项及旧回归共63项exit0。日志`/private/tmp/tripo-glb-structure-rollback-red.log`与`/private/tmp/tripo-final-focused.log`。

## 最容易错的接缝

- 官方多视图允许少于四张，但本仓按路线图强制四张；不能根据ref位置猜视图。单图的role=edit不声称修改了局部网格。
- provider图生接口不消费文字prompt，提示词只作本地描述；上传字节与SHA来自同一快照。
- signed下载URL不应得到API鉴权，也不应进入永久溯源；错误不能打印带key的服务端message。

## 已知局限 / 偏离

- owner已明确尚未购买配置Tripo，并授权无API时先用mock/其他离线方法持续推进。本阶段没有真实服务调用、没有3个真实Tripo样本，不冒称真实模型质量/许可已验；mock来源始终标明。T3本身路线图验收为mock和缺视图拒收；T4的真实Tripo样本另保留待补实证。
- 固定当期官方V3模型名，不承诺未来服务永久保持；协议来源已列工具文档四个官方页面。
- 只接本地PNG≤20MiB，未扩JPEG/WebP，不做自动图像造型质量判断；无key自动mock沿原适配器惯例，真实程序失败不会自动伪装mock成功。
- 旧V2文本适配器维持兼容，此阶段未借机重写其网络行为。

## 门禁

**除基线 depcruise 外全绿**。2026-10-20最终稳定集：全量5955/5956通过、0 pending/todo，唯一失败是指定game113围栏；JSON确认新增T3全部36项在内并通过。定向新旧63项exit0。正式scoped末行`❌ 门禁失败于 depcruise（退出码 1）`；余项实际逐步补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0、depcruise1，仅game113/guide-art.ts） |
| tsc / build | 0 / 0 |
| vitest全量 | 1（仅指定围栏1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，无新增棘轮） |
| spritegen原生node:test | 0（5项，原生文件从Vitest排除并独立执行，不删断言） |
| T3+原ai-gen定向 | 0（36+27=63项） |

本面未触发art-smoke/backupSmoke等额外面守卫。最终日志`/private/tmp/aiflow-t3-final2-{scoped,complete}.log`、各步日志及Vitest JSON；定向`/private/tmp/aiflow-t3-final2-targeted.log`。GLB修补前跑过一轮不作为最终证明；最终轮覆盖修后源码与新增三例。未调用真实Tripo、未签任何生产门，正式独立复查判词另填。
