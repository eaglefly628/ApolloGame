# Review：REQ-3D-AI-PIPELINE · E1 压缩模型加载

施工锁`2d224d49b`（2026-10-20先独立推送再施工）。施工方只交自证，正式判词由独立复查追加；不自判PASS，不签生产人门。T4独立通过记录`c5e39e6d3`；本阶段仍非3D总单全部完成。

## 做了什么

接受路线图既定E1：实查ModelPool只new GLTFLoader再parse，未接Draco/meshopt/KTX2；资产ModelAssetLoader只获取ArrayBuffer，registry/现有组合不包含压缩解码。按owner路线图§1/§3既定判A扩写three原生消费端，不自研压缩算法、不改sim或游戏代码。

ModelPool懒接本地Draco、内嵌WASM的meshopt模块和按GPU能力检测的KTX2；ThreeRenderer传实际WebGLRenderer，旧构造及未压缩模型兼容。按解析实例管理几何/材质/纹理/图片/嵌入Blob，释放解码worker并阻止迟到初始化复活；KTX2失败不允许变成缺图模型成功，并发其它模型不受影响。

## 改动面

- `src/renderer/three/models.ts`：每parser资源scope、失败与清理世代、压缩接线、嵌入图片URL所有权。
- `src/renderer/three/model-codecs.ts`：r184原生codec接线与初始化/worker生命周期；BASE_URL本地目录。
- `src/renderer/three-renderer.ts`：已有ModelPool构造处传this.gl，未增加游戏字段。
- `src/renderer/three/model-codecs.test.ts`：协议/生命周期普通离线单测，旧models.test保留。
- `scripts/compressed-models.integration.mjs`：真实Chrome开发根路径与生产子路径、实际GPU解码/几何/画面/释放验证。
- `scripts/fixtures/compressed-models/`：自产立方体及四色贴图的raw/Draco/meshopt/KTX2固定小夹具，provenance记录编码器、许可及SHA，生成脚本只用显式离线工具、不在测试下载。
- `public/__vendor/three-r184/`：复制未修改的5个官方依赖解码文件（1348203 bytes），manifest及许可证/NOTICE。
- `scripts/model-codecs-vendor.test.mjs`：版本、来源字节及完整SHA核对，避免未来升级静默错配。
- `THIRD-PARTY-NOTICES.md`、3D手册、新数据契约`docs/design/ai-pipeline/compressed-model-loading.md`、本Review与总单status。

## 怎么自己验

1. `npx vitest run src/renderer/three/model-codecs.test.ts src/renderer/three/models.test.ts scripts/model-codecs-vendor.test.mjs`：检查本地接线、旧行为、KTX需GPU检测、初始化前后清理、迟到资源及新世代、KTX2吞错提升整模型失败、并发资源所有权，另验vendor5文件SHA/版本/许可。
2. `RENDER_PROBE_CHROMIUM=<本机Chrome> E1_KEEP_EVIDENCE=1 node scripts/compressed-models.integration.mjs`：实际运行本地Vite开发根路径与build后`/e1-subpath/`，四种GLB都必须来自真实文件且压缩扩展required（没有raw fallback）。读解码几何/索引、每类12三角，render后读RGBA并截图；三压缩对raw最大像素差0；KTX2须实际GPU compressed texture16×16。
3. 抓浏览器解码器请求：四个WASM/wrapper必须从当前BASE_URL本地`__vendor/three-r184/`取得，生产输出5文件与源逐字节相同，不能依赖CDN/API。读取真实KTX2 404错误，ModelPool具名诊断恰1次；保留Three原生日志，不以吞日志凑数量。
4. 延迟真实Draco/KTX2初始化WASM请求→dispose→放行，等待全部资源清零；初始化后真实转码中取消也必须清零；无worker、无解码器或embedded图片Blob残留，旧世代不污染新错误/缓存，后续可重新真实加载。404也不能缓存缺图模型。
5. 独立早期另跑并发KTX2失败+raw/Draco/meshopt成功及旧`new ModelPool(assets)`签名：前三种真实成功，KTX2明确报缺GPU检测，不签任何人门。

## 早期独立复查打回

- 原Three的loadImageSource只在成功时revoke嵌入图片URL。即使worker和解码器Blob已清，KTX2延迟初始化取消、真实transcode取消或404仍留`image/ktx2` 244字节临时Blob。
- 修补为每parser scope拥有embedded URL，失败finally与dispose均幂等释放，bufferView迟到先检scope closed。只临时替同parser图片def副本让原方法同步捕获uri后立即恢复，不修改全局URL，不串并发key。永久真实清零断言不能忽略“不是decoder”的图片Blob。

## 撤修验红

隔离副本逐项撤修，锚点均断言恰1次，finally恢复原字节，未撤改主施工树：

| 撤修 | 命中测试 | 真实结果 |
|---|---|---|
| 去掉setDRACOLoader接线 | `connects local Draco + bundled meshopt...` | exit1 / AssertionError：实际未接入decoder |
| meshopt接线替换为supported:false（关闭实际解码支持） | 同上 | exit1 / AssertionError：supported应为true |
| 去掉parser.options.ktx2Loader赋值 | 同上 | exit1 / AssertionError：本次parser无KTX2 loader |

脚本`/private/tmp/aiflow-e1-red.mjs`与`/private/tmp/aiflow-e1-{draco,meshopt,ktx2}-red.log`、汇总`/private/tmp/aiflow-e1-sabotage.log`。第一轮完全删除meshopt接线触发未定义属性TypeError，未冒充目标断言；随后以显式unsupported decoder关闭支持，确切断言转红，测试断言未改。每轮源码字节恢复。

临时图片泄漏另有真实修前红/修后绿：永久integration的全Blob清零条件曾在旧实现真实失败，独立脚本直接读回244B image/ktx2残留；修后初始化前/已发送转码任务取消及404全清。独立复查方会在最终SHA上另做自己的锚点撤修，不以施工自证替判词。

## 已知局限 / 偏离

- 全部真实解码、构建、截图与释放验证只用离线自产夹具，不需Tripo/API；不冒称真实Tripo服务或其3样本已验。T4真实Tripo样本仍待后补。
- 5个解码文件约1.35MB，由网站本地按需加载；小夹具的容器开销可能大于raw，不承诺每个模型都更小。真实模型大小/质量仍需数据预算审查。
- three当前固定0.184.0；生命周期补桥有r184私有Draco接缝，升级须连vendor和完整真实回归一起核。vendor版本/字节测试防错配。
- GPU可用格式由Three KTX2 detectSupport决定；无renderer时旧未压缩/Draco/meshopt继续可用，KTX2明确拒收。当前桌面Chrome验证不替代移动设备真机性能测试。
- 本阶段不做分组卸载/进度UI，属后续R4；不改变既有动画图、染色或sim hash语义。

## 最终门禁

**除基线 depcruise 外全绿**。2026-10-20冻结版本全量6015/6016通过、0 pending/todo，唯一失败为指定game113围栏。定向21项（codec12+旧models2+vendor7）、tsc、真实Chrome双部署路径integration均exit0。真实最终证据`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e1-real-vWb7c5/report.json`及同目录截图；日志`/private/tmp/e1-tests-{unit,tsc,real}-final.log`。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0、depcruise1，仅game113/guide-art.ts） |
| tsc / build | 0 / 0 |
| vitest全量 | 1（仅对应围栏基线1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，无新增棘轮） |
| spritegen原生node:test | 0（5项，原生runner独立执行，不减少断言） |
| E1定向 / 真实Chrome integration | 0 / 0（21项 / dev及build子路径） |

本面未触发其它face guards。正式末行`❌ 门禁失败于 depcruise（退出码 1）`；余计划实际补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。完整日志`/private/tmp/aiflow-e1-final-{scoped,complete}.log`、各步及Vitest JSON。未签任何人门，独立复查另写最终判词。
