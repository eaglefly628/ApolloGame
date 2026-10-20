# Review：REQ-AIFLOW-SCENELOAD · R4 场景资源组

施工锁`a42528474`（2026-10-20先单独推送后施工）。施工方交测试与撤修自证，正式结论由独立复查追加；不自判PASS，不签人门。E1独立通过`148d13ebc`。

## 做了什么

接受既定R4：实查AssetManager只有单key/all加载，既有ModelPool没有逐key驱逐；单靠旧loadAll不能分段或释放解码模板。按owner路线图§3.5的判A扩写资产层，不新增游戏脚本或sim system。

本地AssetIndex可声明纯数据groups/initialGroup，通用宿主只预载所选组；旧索引保留loadAll。组内key去重、跨组引用计数，旧load/loadAll用常驻pin兼容。进度含成功/失败数量与错误，支持重试、取消、卸载与订阅。每请求identity阻止晚到结果污染新世代。ModelPool按key释放实例、模板和GPU资源，保留其它组共享资源。

`createAssetGroupDataSource`把进度接到现有LayoutNode资源/flag绑定，同时转发世界数据源的resource/value/flag/list；只读表现层，不改UI基座、world或快照hash。

## 改动面

- `src/assets/asset-types.ts`、`asset-groups.ts`、`asset-manager.ts`：纯数据组、进度/驱逐事件、optional loader.release、引用计数及请求identity。
- `src/assets/asset-index.ts`、`game-art-load.ts`、`index.ts`：索引元数据解析/登记、初始组选择、取消后不登记及出口。
- `src/assets/asset-group-source.ts`：现有UI数据源结构适配。
- `src/services/manifest-game.ts`：消费同一装载器，卸载时取消索引并clear资产。
- `src/renderer/three/models.ts`：逐key解码资源释放与旧parse隔离。
- 新测试`src/assets/{asset-groups,asset-group-source,game-art-groups}.test.ts`、`src/renderer/three/model-groups.test.ts`。
- `scripts/scene-asset-groups.integration.mjs`：真实raw/Draco/KTX2跨组生命周期，开发根路径和build子路径。
- 契约`docs/design/ai-pipeline/scene-asset-groups.md`、资产手册本行、本Review及工单status。

## 怎么自己验

1. 定向10文件测试：`npx vitest run src/assets/asset-groups.test.ts src/assets/asset-group-source.test.ts src/assets/game-art-groups.test.ts src/assets/asset-manager.test.ts src/assets/asset-index.test.ts src/assets/game-art-load.test.ts src/renderer/three/models.test.ts src/renderer/three/model-groups.test.ts src/renderer/three/model-codecs.test.ts src/renderer/three/render-hygiene.test.ts`。138/138，exit0；其中新组测试61项。
2. 检查组配置原子校验、重复key、空组、失败等待全部结算及仅重试失败项；不同组共享key只一次I/O，释放最后一组才回收，旧load pin不被误删。取消立即拒facade但不破坏其它组；clear/取消后老成功或老失败不能覆盖新cache或删除新inflight。
3. 用真实World数据源与resolveBindings消费进度，确认ProgressBar/Label及loading/ready/failed显隐；原型方法依赖私有this的fallback仍完整转发。未知名字回原数据源。索引只选initialGroup，未选与无初始组资产I/O为0；旧无groups索引仍全载。
4. `RENDER_PROBE_CHROMIUM=<本机Chrome> node scripts/scene-asset-groups.integration.mjs`：真实离线GLB与本地decoder，不用付费API；开发/build子路径各两代加载。释放A时保留共享Draco和B的KTX2；最后释放后池实例4→3→0，跟踪几何/材质/纹理/clone材质均恰释放一次；renderer.memory几何/纹理归0；重新加载各key每代一次，最终worker/Blob归0。
5. 原`compressed-models.integration.mjs`完整真实回归exit0：三种压缩对raw像素差0，下载/解码中取消及失败清理仍成立。R4证据`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r4-real-a0ZAJ7/report.json`；E1回归`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e1-real-XzZWhL/report.json`。

## 撤修验红

隔离副本运行`/private/tmp/aiflow-r4-red.mjs`，五处各断言源码锚点恰1次；每轮finally恢复原字节，不动施工树、不改测试断言。以下均exit1且明确AssertionError：

| 撤修 | 命中测试 | 红灯输出 |
|---|---|---|
| 驱逐守卫去掉groupRefs条件 | `multiple groups share a key...` | `expected false to be true`（另一组共享key被提前驱逐） |
| 旧成功缓存写入去掉request identity | `late old success after the new generation is ready...` | `expected { descriptor: ... } to be { descriptor: ... }`（新代被覆盖） |
| UI成功数固定为0 | `real resolveBindings maps successful keys...` | `expected { value: +0, max: 2 } to match object { value: 1, max: 2 }` |
| initialGroup改回loadAll | `initialGroup fetches only its members...` | `expected ['title','house','unused'] to deeply equal ['title']` |
| 去掉逐key模板资源dispose | `subscribes lazily and evicts all A instances...` | `expected "dispose" to be called once, but got 0 times` |

原始输出`/private/tmp/aiflow-r4-{shared,identity,progress,initial,gpu}-red.log`；恢复后定向138项全绿。独立复查另做自己的锚点撤修和实证，不采信这些自陈作为判词。

## 已知局限 / 偏离

- 进度按成功key数量统计，非下载字节或GPU解码百分比；空组显示1/1而统计total仍0，不编造精细进度。
- 场景选择是显式组API，纯数据首屏用initialGroup；现有仓库无统一world State切场景协议，不猜测状态或自动切组。与R4预载/卸载/进度既定范围一致。
- 释放不强制中断底层loader网络；立即取消调用方等待，晚到资源通过可选release回收且不能复活缓存。loader需自己实现句柄析构，旧loader兼容；现有图像为HTMLImageElement、模型为ArrayBuffer，GPU由ModelPool独立管理。
- observer/析构异常明确console.error并隔离，未知组操作拒收日志；只读未知进度返回undefined，避免UI轮询刷屏。
- 真实解码用自产离线夹具，不冒称Tripo真实模型已验；未购买API按owner许可保留mock路线。本阶段不改任何游戏层、PUI或sim。

## 最终门禁

**除基线 depcruise 外全绿**。冻结源码全量6076/6077通过、0 pending/todo，唯一失败为指定game113围栏。各步实际退出码：

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0；depcruise1，仅game113/guide-art.ts） |
| tsc / build | 0 / 0 |
| vitest全量 | 1（仅对应围栏基线1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，无新增棘轮） |
| spritegen原生node:test | 0（5项，按原生runner保留全部断言） |
| R4定向 / R4真实Chrome / E1真实回归 | 0 / 0 / 0 |

本面无其它face guards。正式末行`❌ 门禁失败于 depcruise（退出码 1）`；余计划实际补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志`/private/tmp/aiflow-r4-scoped.log`、`/private/tmp/aiflow-r4-final-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`与Vitest JSON；定向`/private/tmp/aiflow-r4-targeted.log`。

正式复查人另写判词，本施工方未签任何人门。

## 独立复查判词（2026-10-20）

**R4 PASS；整体门禁仍有既有 game113 依赖围栏 1 例，不能称全库全绿。** 复查人与施工方及其 core/tests/renderer 子代理独立；从冻结提交 `955826af4c502f62ed52be870825a9cb12fdfc59` 建立 `/private/tmp/apollo-r4-formal-review-955826af4`，自行执行以下四步，未以施工自陈代替证据。全过程未修改施工树或原仓在途改动，最终源码及脚本 tracked diff 为 0；本次提交只追加本节。

1. **独立复跑**：10 文件定向 **138/138**、另写的 observer/共享重试对抗 **5/5**，均 exit0。`scoped-gate --run --base HEAD^` 确认 FULL，eslint0，depcruise1且仅 `games/game113/guide-art.ts → src/assets/asset-index.ts`。独立完整 Vitest **6076/6077、pending/todo 均0**，唯一失败为同一 depcruise 绿腿；已核对 HEAD^ 中该 import 原已存在，R4 未改该文件或围栏配置。tsc/build/docs-ref/context-budget 均0，spritegen 原生 node:test **5/5、exit0**；art-ledger2为既有 WARN。
   首轮完整测试受沙盒限制为6071/6077：额外3例 listen EPERM、2例浏览器探测失败。随后以 `require_escalated` 与固定 `RENDER_PROBE_CHROMIUM=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 重跑全量，上述5例全部恢复；未删除或改写测试断言。日志 `/private/tmp/r4-independent-scoped-955826af4.log`、`/private/tmp/r4-independent-targeted-955826af4.log`、`/private/tmp/r4-independent-955826af4-{complete.json,vitest-escalated.log,vitest-escalated.json}`。
2. **带命中断言的撤修验红**：在另一个隔离副本逐轮替换并 finally 恢复原字节；每个源码锚点均断言恰命中1次，且失败必须包含 AssertionError，未把运行故障当红灯。

   | 独立撤修 | 自行量得的红灯 |
   |---|---|
   | 去掉 AssetManager 成功写缓存的 request identity 判断 | 晚到旧成功覆盖新代；对应测试 exit1、对象 identity 断言失败 |
   | 去掉 ModelPool 成功回调的 parse identity 判断 | 旧 A 提前被接纳/覆盖新 A；两项对应测试 exit1、`old-a` 不等于 `new-a` |
   | 对同一 parse 锚点运行独立真实 worker 竞态 probe | 旧真实 Draco 结果放回后，强制重建实例取到旧模板；exit1、`recreatedGeometrySame` 为 false |

   撤修脚本 `/private/tmp/r4-independent-red-955826af4.mjs`；结果 `/private/tmp/r4-independent-955826af4-red.json`，各轮日志同前缀 `*-red.log`。恢复后与冻结源逐字节比较一致，正常独立5例及真实竞态重新通过。
3. **实证复现**：独立5例覆盖 loading 通知内 clear并同名换组（旧I/O未启动）、逐key eviction 通知内重启多key组、成功进度通知内释放并立即重载、failed通知内重试、两失败组并发重试共享key且保留direct pin。既有真实 World/resolveBindings 的 ProgressBar/Label、fallback 私有this、initialGroup零多余I/O、旧API驻留、取消/clear世代测试亦自行复跑通过。
   真实 Chrome `155.0.8059.85` 另跑三套：R4 raw/Draco/KTX2在dev根路径与build子路径各两代，共享组及几何/材质/纹理精确dispose通过；独立probe分别延迟真实Draco decode与Basis transcode回调，evict/reload单key时另一key照常完成，新代ready后放回旧回调，再sweep并重建实例，仍取新代geometry，最终worker/Blob均0；既有E1完整真实回归也exit0，压缩对raw像素max/mean均0，取消/失败清理通过。证据分别为 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r4-real-kfMDSI/report.json`、`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r4-independent-race-5MTun4/report.json`、`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e1-real-WinXL9/report.json`。
4. **读告警**：逐项查看定向/全量stderr、真实浏览器诊断及构建/台账输出。R4拒收、模拟失败、取消与stale丢弃日志均对应主动对抗输入；真实浏览器诊断无error，未见新增未处理异步错误。构建只有既有chunk体积提示；台账存量WARN与上述game113围栏明确保留，未隐去或扩大成R4免责项。

结论仅覆盖已写R4契约：显式资源组、成功key数进度及现有UI数据源接线；不宣称自动推断世界切场景、字节进度或真实Tripo付费样本验收。本复查不签任何人审门；工单收口由施工负责人依据本独立结论处理。
